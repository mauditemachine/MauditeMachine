# MM-ARP en plugin VST3 / AU pour Ableton Live : étude de faisabilité

Date : 2026-10-21. Périmètre : le MM-ARP du site (focus `voy`), code dans `src/v4/voyager/*` et `src/v4/audio/{synth,chorus,moog.worklet,chorus.worklet,sends,fx}`.
Méthode : lecture complète du code de l'ARP, mesures sans aucun son (rendus hors ligne, Chromium lancé avec `--mute-audio` et `?mute=1`), recherche web sur l'état des outils en 2026 (sources à la fin).
Les scripts, journaux et WAV de cette étude sont restés hors du dépôt ; l'étude elle-même n'a rien modifié dans le code.

---

> **Mise à jour du 2026-10-22.** Deux étapes de cette étude sont déjà faites dans le site :
> - la sortie MIDI de l'ARP (section 4.1) : les notes et l'horloge vers une sortie choisie dans le panneau MIDI, par exemple le bus IAC vers Ableton (`src/v4/midi/noteout.ts`) ;
> - le banc de référence du moteur et l'export de ses paramètres, base du futur plugin : `npm run arp:bench` (`scripts/arp-bench.mjs`) et `npm run arp:params` (`scripts/arp-params.mjs`).
>
> Le moteur a aussi changé le même jour (filtre sans repliement, PWM, SYNC et FM propres, STACK, WIDE, GLUE, TAPE) : les mesures CPU ci-dessous datent d'avant.

## 0. La réponse courte

**Oui, c'est possible, et ton ARP est même un très bon candidat.** Le son du MM-ARP ne dépend presque pas du navigateur : le cœur (oscillateurs, filtre Moog, enveloppes, FM, SUB, OVERDRIVE, LFO calé au tempo) est un fichier JavaScript de calcul pur, `src/v4/audio/moog.worklet.js` (954 lignes, sans aucun nœud Web Audio). Je l'ai fait tourner tel quel hors du navigateur (dans Node) : il sort **exactement le même signal, échantillon pour échantillon**, que dans le vrai AudioWorklet de Chromium. C'est la preuve qu'on peut le traduire en C++ et vérifier automatiquement que le plugin sonne comme le site.

Ce que je te recommande :

1. **Tout de suite (1 à 2 jours)** : faire sortir les notes de l'ARP du site en MIDI vers Ableton (Web MIDI + bus IAC de macOS), avec l'horloge MIDI. Aujourd'hui le site n'envoie aucune note MIDI (vérifié dans le code). Tu pourras enregistrer tes arpèges dans Ableton et les jouer avec n'importe quel synthé.
2. **Le vrai plugin** : **JUCE (C++)**, formats **VST3 + AU** en binaire universel Apple Silicon / Intel, signé et notarisé, avec une **interface web** (WebView) qui réutilise les composants React 2D qui existent déjà (le Dock et la page KNOBS du téléphone). Le moteur JS du site sert de référence sonore, contrôlée par des tests automatiques.
3. **Effort honnête** : un prototype jouable dans Ableton (son + arp + effets, interface générique) en **2 semaines** ; une **v1 propre** (interface MM-ARP, presets, validation, installeur signé) en **6 à 8 semaines** de développement. Coût fixe minimal : **99 USD/an** (Apple Developer Program). JUCE et le SDK VST3 sont gratuits dans ton cas.
4. **Plus tard** : compiler ce même cœur C++ en WebAssembly pour le site. Le site devient alors la démo gratuite du plugin, avec exactement le même son (et ça sert aussi ton référencement : "essaie le plugin dans ton navigateur").

---

## 1. Ce que contient le MM-ARP aujourd'hui (l'inventaire à porter)

### 1.1 Le moteur de son : 100 % portable

`src/v4/audio/moog.worklet.js` (processeur `mm-voyager`) :
- 12 voix (`MAX_VOICES`, ligne 75), la plus ancienne reprise de son niveau au-delà ;
- par voix : OSC 1 et OSC 2 qui morphent sinus > triangle > dent de scie > carré > impulsion (> FM pour OSC 1), PolyBLEP anti-repliement, RANGE en pieds, SEMI, FINE, hard SYNC, opérateur FM sinus (RATIO 1/2 à 7, indice suivant l'enveloppe du filtre), SUB (1 ou 2 octaves, 3 formes), bruit xorshift ;
- filtre en échelle 4 pôles saturé dans chaque étage (méthode "cheap" de Mystran, rétroaction résolue sans retard), modes MOOG 24 / LP12 / BP / HP en fondu (sorties mélangées façon Xpander), BASS_KEEP, suivi de clavier ;
- deux ADSR à courbe de condensateur, GLIDE logarithmique, petits écarts analogiques par note (DRIFT), place stéréo par note (WIDTH), PHASE de départ ;
- OVERDRIVE façon Tube Screamer (branche passe-haut 720 Hz, courbe tanh asymétrique, passe-bas 4.2 kHz) ;
- LFO "MOD" calé sur la position du transport en temps (ancres `beat` envoyées par l'arp), formes TRI, SAW, RND, SQR, S&H ;
- suréchantillonnage x4 (ordinateur) ou x2 (téléphone), puis décimation par demi-bandes Kaiser (31 et 63 coefficients).

Tout ça est du calcul pur sur des nombres : aucun `OscillatorNode`, aucun `BiquadFilterNode` dedans. Les seules dépendances à l'environnement sont `sampleRate`, `currentFrame`, `registerProcessor`, `Math.random` et le `port` de messages. **Traduction en C++ : directe** (la structure est déjà celle d'un code DSP C : boucles, tableaux, états par voix).

Deux points à adapter pour un plugin :
- **le modèle de note** : le moteur reçoit des notes avec leur durée connue d'avance (`gate`, `moog.worklet.js` lignes 541 à 547 et 615). Pour jouer depuis un clavier ou un clip Ableton, il faut ajouter un vrai `noteOff`. Petit changement ;
- **le hasard** : `Math.random` est utilisé pour la dérive, les phases et les écarts par note. Dans le plugin : un générateur pseudo-aléatoire par instance, avec une graine (pour pouvoir comparer le son du plugin et celui du site au bit près, et pour qu'un bounce soit reproductible).

### 1.2 La chaîne d'effets : un peu de Web Audio natif, facile à refaire

`src/v4/audio/synth.ts` construit, après le moteur :

| Bloc | Dans le site | Dans le plugin |
|---|---|---|
| BASS MONO | séparation Linkwitz-Riley 24 dB : 4 `BiquadFilterNode` Butterworth (Q -3.0103 dB), le bas en mono (`synth.ts` 165 à 205) | 4 biquads, formules du cookbook (attention : le Q des passe-bas Web Audio est en dB) |
| CHORUS Juno-106 | AudioWorklet JS pur `chorus.worklet.js` (mode `juno`, sinc 16 points, filtres BBD), modes OFF / I / II (`chorus.ts` 194 à 370) | traduction directe du worklet |
| DELAY ping-pong | 2 `DelayNode` (interpolation linéaire), HP 260 Hz, 2 LP 4.8 kHz, réinjection 0.35 à 0.68, croche pointée sur le tempo (`synth.ts` 60, 127 à 163) | ligne à retard maison, tempo de l'hôte |
| REVERB | `ConvolverNode` (normalize = false) sur une réponse impulsionnelle **calculée** (bruit filtré décroissant, graines 808 et 909, 2.4 s, `fx.ts` 36 et 83 à 116, `sends.ts` 369 à 371) | même réponse régénérée en C++, convolution JUCE |
| VOLUME et makeup | gains, rampes linéaires de 20 ms (`glide.ts`), formule `volume² x 0.66 / (1 + 0.35 delay + 0.5 reverb)` (`synth.ts` 210 à 240) | `SmoothedValue` linéaire 20 ms |
| SIDECHAIN | baisse la sortie à chaque kick du MM-RYTM (`drums.ts` 1426, `audio/duck.ts`) | sans objet dans un plugin seul : à retirer en v1 (Ableton a ses compresseurs sidechain), ou entrée sidechain VST3 plus tard |

Mesuré dans l'appli (rendu hors ligne de la chaîne complète, `app-check.json`) : la chaîne ARP crée **16 Gain, 7 Biquad, 2 Delay, 1 ChannelMerger, 1 Convolver** plus les deux worklets. Rendu propre : crête -9.64 dBFS, aucune valeur NaN.

### 1.3 L'arpégiateur : la logique est pure, l'horloge est celle du site

- `voyager/chords.ts` (195 lignes, aucun import) : les 8 accords de fa dièse mineur, les degrés de la gamme, les voicings CHORD (BASIC, TRIAD, 7TH, 9TH, 11TH) enchaînés au plus près. **Réutilisable tel quel** (en JS dans une interface web, ou traduit en C++ en une journée).
- `voyager/seq.ts` : la suite AUTO / EDIT (1 à 16 pas, silences, degrés -7 à 24). Pure, dépend seulement de `chords` et `params`.
- `voyager/random.ts` : RANDOM de tout le patch par style (BASSLINE, ACID, PLUCK, LEAD, DARK, ARP), générateur injectable. Pur.
- `voyager/arp.ts` : la mise en temps. Elle dépend du site : horloge audio de la boîte à rythmes (`clock.gridAfter`), tempo et swing (`pattern`), programmation à l'avance de 300 ms (`audio/sched.ts` ligne 34, 450 ms au téléphone), annulation et reprogrammation (`synthCancel`), accents (`ACCENT`, ligne 61), DRIFT. Dans un plugin, cette partie **se réécrit plus simplement** : Ableton donne à chaque bloc audio la position en temps (PPQ), le tempo et l'état lecture. Les pas tombent alors à l'échantillon près, et un bounce hors ligne donne le même résultat qu'en temps réel.

À décider pour le plugin : aujourd'hui l'ARP joue **ses 8 pads d'accords fixes en fa dièse mineur**, une mesure par accord. Dans Ableton tu voudras sûrement deux modes :
- **PADS** : comme le site (les 8 accords, une mesure chacun), avec un paramètre KEY pour transposer la tonalité, et les pads déclenchables par des notes MIDI ;
- **HOLD** : l'arpège des notes que tu tiens (clavier ou clip), comme un arpégiateur classique.
En bonus, le plugin peut aussi **sortir ses notes en MIDI** : Ableton sait récupérer la sortie MIDI d'un VST sur une autre piste.

### 1.4 Le modèle de paramètres : déjà au format VST3

`voyager/params.ts` décrit **53 paramètres** (44 sur la face, 9 TWEAKS sous le capot), tous **normalisés de 0 à 1**, avec des identifiants stables (`cutoff`, `res`, `lfoShape`...), des crans pour 19 d'entre eux et des fonctions de conversion vers les unités physiques (`engineParams`, 37 valeurs envoyées au moteur). VST3 travaille justement en valeurs normalisées 0 à 1 : **la correspondance est un pour un**. On peut générer la liste des paramètres du plugin à partir de `VOY_KNOBS` par un script, pour ne jamais avoir deux listes à maintenir.

Presets : 10 presets d'usine (`state/factory.ts` : ACID, DARK DISCO, INDIE DANCE, MINIMAL, ROLLING, TECHNO, HOUSE, ELECTRO, EBM, ITALO) et les presets utilisateur au format JSON `{ knobs, seq, prog }` (`state/presets.ts` lignes 395 à 465), avec les migrations des anciennes versions (`migrateKnobs`). Si le plugin enregistre son état dans ce même format, **un preset du site s'ouvre dans le plugin et l'inverse**.

### 1.5 Le MIDI aujourd'hui

`src/v4/midi/*` gère très bien l'entrée (MIDI LEARN, CC, notes, pitch bend, la carte du Roto-Control) et un retour vers les contrôleurs (valeurs de CC vers les potards motorisés du Roto, LEDs du séquenceur avec horodatage précis : `seqlink.ts` ligne 291 `seqPerfOf`, qui convertit l'heure audio en heure MIDI). Par contre :
- **aucune note MIDI ne sort** (les seuls `send` sont `midi.ts` lignes 1107 à 1120, `sendValue`, pour les CC / pitch bend du retour, et 1139 à 1162, `rotoSendAt`, pour les CC du Roto, que `seqlink.ts` ligne 394 utilise pour les LEDs) ;
- **aucune horloge MIDI** (pas de 0xF8, 0xFA, 0xFC) ;
- le code refuse volontairement d'envoyer vers un appareil qui n'a pas été appris ("jamais vers un synthé branché à côté", en-tête de `midi.ts`). La sortie de notes devra donc être un choix explicite dans le panneau MIDI.

### 1.6 L'interface

- La machine 3D (Three.js) : 9 fichiers de `voyager/` (environ 4 200 lignes) plus le moteur de scène commun (`scene/`, environ 15 000 lignes). Magnifique, mais lourde à embarquer dans un plugin (WebGL dans chaque instance) et liée au studio (orbite, capot, PCB, voisines).
- **Une interface 2D React existe déjà** et pilote les mêmes stores : `ui/VoyDock.tsx` (accords, RUN, RATE, MODE...), `ui/KnobPanel.tsx` (tous les potards en gros, par section), `ui/SeqLane.tsx` (la suite EDIT), `ui/Scope.tsx`, `ui/VoyTwins.tsx` (environ 2 000 lignes). C'est la meilleure base pour l'interface du plugin en v1.

### 1.7 Résumé : quoi réutiliser, quoi traduire

| Élément | Fichiers | Dans le plugin |
|---|---|---|
| Moteur de son | `moog.worklet.js` | traduction C++ ligne à ligne, référence de test |
| Chorus Juno | `chorus.worklet.js`, `chorus.ts` | traduction C++ |
| Delay, BASS MONO, reverb, volumes | `synth.ts`, `sends.ts`, `fx.ts`, `glide.ts` | réécriture C++ (petite) |
| Accords, suite, RANDOM | `chords.ts`, `seq.ts`, `random.ts` | réutilisés en JS dans l'interface et traduits en C++ pour l'audio |
| Paramètres et presets | `params.ts`, `state/factory.ts`, `state/presets.ts` | liste générée automatiquement, même format JSON |
| Mise en temps de l'arp | `arp.ts`, `audio/sched.ts`, `audio/clock.ts` | réécrite sur la position de l'hôte (plus simple) |
| Interface | `ui/VoyDock.tsx`, `ui/KnobPanel.tsx`, `ui/SeqLane.tsx`, écran `voyager/screen.ts` | réutilisée dans une WebView (v1), la 3D en option (v2) |
| Liens au studio | `synthPort`, `setArpDuck`, `pattern`, `localStorage` | à couper (adaptateurs) |

---

## 2. Ce que j'ai mesuré pour cette étude (aucun son)

### 2.1 Le moteur tourne hors du navigateur

Script `node/render.cjs` : charge `moog.worklet.js` sans le modifier dans Node (seuls `sampleRate`, `currentFrame` et `registerProcessor` sont fournis), rejoue l'arpège par défaut (progression F#m D A E, doubles croches, 123 BPM, 8 mesures, 128 notes) et écrit des WAV de référence dans `wav/` (`default_os4.wav`, `default_os2.wav`, `default_os1.wav`, `stress12_os4.wav`, `stress12_os2.wav`). Résultat : aucune valeur non finie, et deux rendus avec la même graine sont **identiques au bit près** (`reproducibleMaxDiff: 0`).

### 2.2 Même son dans Node et dans le vrai AudioWorklet de Chromium

Script `node/parity.cjs` : le même fichier, les mêmes notes, la même graine, rendus (a) dans Node et (b) dans un `OfflineAudioContext` de Chromium 141 (`parity-os4.json`) :

```
identicalSamplesPct: 100, maxAbsDiff: 0   (216 064 échantillons stéréo, 32 notes, OS x4)
```

Conséquence directe pour le plugin : le JS du site est une **référence sonore exacte et automatisable**. On rend une série de patchs dans Node, on rend les mêmes dans le plugin C++, et un test compare (seuil visé : écart sous -100 dB). C'est ce qui garantit "le plugin sonne comme le site".

### 2.3 Coût CPU du moteur JS (à prendre avec prudence)

Script `node/prof-one.cjs`, un réglage par processus (`node/bench-fresh.log`), notes tenues, temps CPU du processus pour 3 s d'audio à 48 kHz :

| Voix | OS x1 | OS x2 | OS x4 |
|---|---|---|---|
| 1 | 7 % | 15 % | 21 % |
| 4 | 14 % | 21 % | 31 % |
| 8 | 25 % | 35 % | 47 % |
| 12 | 35 % | 48 % | 69 % |

(en % d'un cœur). Attention : la machine de test était partagée (4 cœurs, charge moyenne autour de 16 pendant les mesures, une multiplication-addition dépendante y prend 5.3 ns, soit 4 à 5 fois plus lent qu'un cœur de Mac récent). Les chiffres absolus ne valent donc pas pour ton Mac ; ils montrent l'ordre de grandeur et que le coût monte vite avec les voix et le suréchantillonnage. En C++ optimisé on peut espérer nettement moins (à mesurer sur le prototype, objectif : quelques % d'un cœur par instance pour l'arpège par défaut).

Remarque : la décimation x4 ajoute un retard fixe d'environ 19 échantillons (15 + 31 demi-coefficients : 3.75 + 15.5 échantillons à 48 kHz, 0.4 ms). Le plugin devra le déclarer à Ableton (compensation de latence).

### 2.4 Vérifications dans l'appli (`app-check.cjs`, `app-check.json`, capture `voy-desktop.png`)

Desktop 1440 x 900, `?mute=1&debug=1&m=voy`, `--mute-audio` : intro terminée, moteur chargé (`synthBuilt: true`, `synthFailed: false`), 53 potards (19 à crans, 34 continus, 44 face + 9 TWEAKS), 37 paramètres moteur, 10 presets d'usine, Web MIDI disponible, rendu hors ligne de la chaîne complète correct. Seules erreurs de page : 3 ressources tierces (font-awesome cdnjs, pixel Facebook, gtag) refusées par le proxy de l'environnement de test, sans rapport avec l'ARP.

Vérifié aussi : Chromium 141 n'a **pas** `MIDIOutput.clear()` (`midi-api.cjs`). Une note MIDI envoyée avec un horodatage futur ne peut plus être annulée. Ça compte pour le gain rapide (section 4).

---

## 3. Les options en 2026

### 3.1 Ce qu'Ableton Live 12 accepte sur Mac

- Formats : **VST2, VST3, Audio Units v2 et v3**. **Pas de CLAP** (aucune annonce officielle trouvée ; Bitwig, REAPER, FL Studio l'ont).
- La version Universal de Live ne charge en natif que des plugins compilés pour Apple Silicon : il faut un **binaire universel** (arm64 + x86_64).
- Live sait router la **sortie MIDI d'un VST** vers une autre piste.
- Live 12 embarque **Max 9** (Max for Live dans l'édition Suite).

### 3.2 Les licences qui ont changé

- **SDK VST3 : licence MIT depuis VST 3.8.0 (29 octobre 2025).** Usage commercial libre, plus de double licence GPL / propriétaire, en gardant le texte de copyright. (Les règles d'usage du logo VST restent à vérifier sur le portail Steinberg.)
- **JUCE** : double licence **AGPLv3 / commerciale**. Paliers commerciaux (JUCE 8, repris tels quels par JUCE 9) : **Starter gratuit** jusqu'à 20 000 USD de revenus annuels (sans écran de démarrage imposé), **Indie** 40 USD/mois ou 800 USD une fois (jusqu'à 300 000 USD), **Pro** 175 USD/mois ou 3 500 USD. **JUCE 9** est sorti le 21 juillet 2026 (SVG, polices variables, CoreAudio refait). Le CLAP natif et AudioProcessor v2 sont encore en cours (sans importance pour toi : Ableton ne lit pas le CLAP ; s'il le fallait, `clap-juce-extensions` existe).

### 3.3 Comparaison des chemins

| Outil | Langage | Formats | Interface web | Licence / prix | État 2026 | Verdict pour le MM-ARP |
|---|---|---|---|---|---|---|
| **JUCE 8 / 9** | C++ | VST3, AU, AUv3, AAX, Standalone (CLAP via extension) | oui : `WebBrowserComponent` + relais de paramètres (`WebSliderRelay`, `WebComboBoxRelay`) | gratuit (Starter ou AGPLv3), Indie 800 USD | très actif, standard de l'industrie, très utilisé dans Ableton | **recommandé** |
| iPlug2 | C++ | VST3, AU, AUv3, CLAP, AAX, WAM (web) | exemples HTML/CSS et SwiftUI | type zlib, gratuit même fermé | actif (repo iPlug2OOS conseillé), communauté plus petite | bonne alternative gratuite si JUCE coince |
| Cmajor | langage DSP dédié | export projet JUCE C++, CLAP, HTML/WASM | oui (patch web) | GPLv3 / commerciale pour le moteur, le C++ généré t'appartient | actif mais niche | élégant (une source pour site et plugin), mais il faudrait **réécrire** le DSP dans un nouveau langage |
| Faust | langage DSP | JUCE, WASM, etc. | non (le DSP seulement) | compilateur GPL, code généré libre (exception) | mature | utile pour des blocs, pas pour porter un moteur déjà écrit |
| Elementary Audio | JS | web, natif | oui | MIT 2025 | actif côté bibliothèque ; chemin plugin incertain (non confirmé) | non : ton DSP est échantillon par échantillon, pas un graphe Elementary |
| RNBO (Max) | patch Max | VST3, AU, web, Raspberry | non | add-on payant (prix 2026 non confirmé), licence du code exporté à vérifier | actif | non : réécrire tout en patch |
| nih-plug | Rust | VST3, CLAP | webview expérimentale (plantage connu avec Échap dans Ableton) | ISC | **en maintenance** | non |
| Max for Live | Max + JS (objet `v8`) | appareil .amxd dans Live | jsui / v8ui | inclus dans Live Suite | Max 9 dans Live 12 | **bonne étape intermédiaire** pour l'arpégiateur MIDI (section 4.2) |

### 3.4 Signature, notarisation, distribution sur Mac

- **Apple Developer Program : 99 USD par an.** Il donne les certificats Developer ID (application pour signer les .vst3 / .component, installeur pour signer le .pkg) et la notarisation sans frais en plus. Sans ça, Gatekeeper bloque le plugin chez les autres (chez toi tu peux toujours le lancer).
- Chaîne : compilation universelle (`CMAKE_OSX_ARCHITECTURES="arm64;x86_64"`), signature avec hardened runtime et horodatage, `notarytool`, `stapler`, paquet .pkg signé. Tout ça peut tourner dans **GitHub Actions sur un runner macOS**, les certificats dans les GitHub Secrets (comme tes autres secrets) : tu n'as pas besoin d'installer de chaîne C++ toi-même, seulement de tester dans Ableton. (Les minutes macOS sont gratuites sur un repo public ; sur un repo privé elles sont décomptées plus cher, à vérifier sur ton plan.)
- Validation : `auval` (AU) et `pluginval` (VST3 et AU), plus tes tests dans Ableton (sauvegarde et réouverture d'un set, automation, freeze / bounce).
- Vente : Gumroad prend **10 % + 0.50 USD par vente** en direct (30 % via leur marketplace Discover), plus les frais de paiement. Plugin Boutique et KVR Marketplace fonctionnent à la commission (taux non vérifiés ici, à demander). Tu peux aussi le donner gratuitement au début (visibilité, liste mail).

---

## 4. Les étapes intermédiaires

### 4.1 Gain rapide : l'ARP du site joue dans Ableton (1 à 2 jours)

Le principe : le site envoie ses notes à un bus MIDI virtuel de macOS (IAC), Ableton les reçoit sur une piste MIDI comme venant d'un clavier.

Côté Mac (une fois) : Configuration audio et MIDI > Fenêtre > Afficher le studio MIDI > IAC Driver > cocher "Le périphérique est en ligne", créer un bus "MM-ARP". Dans Ableton : Préférences > Link, Tempo & MIDI, activer "Track" sur l'entrée IAC (et "Sync" si on envoie l'horloge). Navigateur : **Chrome, Edge ou Firefox** (Safari n'a pas Web MIDI). Chrome demande l'autorisation MIDI depuis Chrome 124.

Côté code (estimation) :
- un module `src/v4/midi/noteout.ts` (environ 150 lignes) : sortie choisie explicitement dans le panneau MIDI, canal, interrupteurs NOTES OUT, CLOCK OUT, et "couper le synthé du site" si tu veux seulement le MIDI ;
- un appel dans `voyager/arp.ts` à côté de `noteOn(midi, when, gate, lastMidi, accent)` (ligne 216), avec la vélocité tirée de `accent` ;
- l'heure MIDI calculée avec `seqPerfOf(when)` (`midi/seqlink.ts` ligne 291), déjà éprouvé pour les LEDs du Roto ;
- **piège** : l'arp programme 300 ms à l'avance et reprogramme quand tu touches un potard (`synthCancel`, `arp.ts` ligne 279), or Chrome ne sait pas annuler un message MIDI déjà envoyé (`MIDIOutput.clear()` absent, vérifié). Il faut donc une file interne et n'envoyer chaque note qu'au dernier moment (dans la fenêtre `GUARD_S`, 30 ms, que l'arp ne reprogramme jamais), avec une minuterie de 10 ms ; toujours envoyer les note-off, et "All Notes Off" (CC 123) à STOP ;
- horloge MIDI : 24 impulsions par noire (0xF8) horodatées sur la même horloge audio, START (0xFA) au RUN, STOP (0xFC) au STOP. Ableton peut alors suivre le tempo du site ;
- respecter l'onglet qui pilote (`midi/leader.ts`) pour ne pas doubler les notes avec deux onglets.

Limites : précision de l'ordre de la milliseconde (correct pour enregistrer), l'onglet doit rester actif (un onglet en arrière-plan et muet peut être ralenti par Chrome), et le son reste celui de ton synthé dans Ableton, pas celui du MM-ARP. C'est un outil de composition immédiat, pas le plugin.

### 4.2 Option : un appareil Max for Live "MM-ARP MIDI" (environ 1 semaine)

Live 12 embarque Max 9, dont l'objet `v8` exécute du JavaScript moderne. `chords.ts`, `seq.ts`, `random.ts` et la partie "notes" de `params.ts` peuvent être regroupés (esbuild) et tourner presque tels quels dans un effet MIDI Max for Live, calé sur le transport de Live : tes progressions, tes voicings 7TH / 9TH / 11TH et tes suites EDIT pilotent n'importe quel instrument. Pas de signature Apple à gérer (.amxd). Limite : il faut Live Suite (ou Max for Live), et ce n'est pas le son du MM-ARP. Intéressant si tu veux sortir quelque chose vite, ou en bonus du plugin.

---

## 5. Le chemin recommandé : JUCE, cœur C++ partagé, interface web

### 5.1 Architecture

```
mm-arp-core (C++17, sans JUCE)          <- traduit de moog.worklet.js, chorus.worklet.js, synth.ts, arp.ts, chords.ts, seq.ts
  Engine (12 voix, filtre, ADSR, FM, SUB, OVERDRIVE, LFO, OS + décimation)
  JunoChorus, PingPong, BassMono (LR4), Reverb (IR générée, mêmes graines)
  Arp (PPQ hôte, modes PADS / HOLD, suite EDIT, accents, swing)
  Params (généré depuis VOY_KNOBS : mêmes ids, valeurs 0..1, mêmes conversions)
        |                                   |
  plugin JUCE (VST3 + AU + Standalone)    plus tard : WebAssembly (Emscripten) dans un AudioWorklet du site
  processBlock, état JSON {knobs, seq, prog}, latence déclarée, MIDI in / out
        |
  WebView : bundle Vite des composants React 2D (KnobPanel, VoyDock, SeqLane, écran)
  adaptateur du store voyParams <-> relais de paramètres JUCE (automation Ableton comprise)
```

Pourquoi cette forme :
- **Un seul son** : au début, le JS reste la référence et les tests comparent le C++ au JS (section 2.2) ; ensuite le site peut charger le cœur C++ compilé en WebAssembly. Site et plugin deviennent la même machine.
- **Un seul jeu de paramètres** : généré depuis `params.ts`, les presets passent du site au plugin.
- **L'interface réutilise ce qui existe** au lieu de tout redessiner en C++.

### 5.2 Plan pas à pas du premier prototype (2 semaines)

Semaine 1, le son :
1. Nouveau repo `mm-arp-plugin` (CMake, JUCE récupéré par FetchContent, formats VST3, AU, Standalone, binaire universel).
2. Script `tools/export-voy-params.mjs` dans le repo du site : `VOY_KNOBS`, crans, valeurs par défaut et conversions vers `params.json`, puis génération de `Params.h`.
3. Traduction de `moog.worklet.js` en `Engine.{h,cpp}` : calcul en double, même ordre d'opérations, générateur aléatoire injectable avec graine, ajout d'un `noteOff`.
4. Banc de référence : `render.cjs` et `parity.cjs` de ce dossier, versionnés dans le site (`tools/arp-golden/`), qui produisent des WAV de référence ; un test C++ rend les mêmes notes et compare (écart visé sous -100 dB).
5. Premier essai dans Ableton : notes MIDI vers les voix, interface générique de JUCE (tous les paramètres en curseurs), automation.

Semaine 2, la machine :
6. Arp C++ sur la position de l'hôte : traduction de `scheduleStep` / `advance` (`arp.ts` 155 à 248), `degreeMidi`, `voicedDegrees`, `poolSteps` ; modes PADS (8 accords + KEY) et HOLD ; marche libre quand Ableton est arrêté (option).
7. Effets : chorus Juno, BASS MONO, ping-pong au tempo de l'hôte, reverb (IR de `makeImpulse` régénérée).
8. État du plugin au format des presets du site ; les 10 presets d'usine importés.
9. Compilation GitHub Actions macOS, signature, notarisation, .pkg ; tu l'installes et tu testes (CPU, sauvegarde du set, bounce identique au temps réel).

Ensuite, vers la v1 (semaines 3 à 8) : interface WebView (Dock, KNOBS, suite EDIT, écran), RANDOM par style, navigateur de presets, sortie MIDI des notes, redimensionnement, mode sombre / clair, `pluginval` en mode strict, `auval`, bêta avec quelques producteurs, page produit sur le site.

### 5.3 Estimation

| Étape | Effort |
|---|---|
| Gain rapide Web MIDI + horloge (site) | 1 à 2 jours |
| Max for Live "MM-ARP MIDI" (option) | environ 1 semaine |
| Prototype plugin jouable (son + arp + FX, interface générique) | 2 semaines |
| Interface WebView réutilisant le React 2D | 1.5 à 2 semaines |
| Presets, état, MIDI out, RANDOM, finitions | 1 semaine |
| Validation, installeur, signature, page produit | 1 semaine |
| **v1 complète VST3 + AU macOS** | **6 à 8 semaines** |
| Option 3D (la face Three.js en vue fixe dans le plugin) | + 2 à 3 semaines |
| Option cœur C++ en WebAssembly sur le site | + 1 à 2 semaines |
| Option Windows (VST3) | + 1 semaine, plus un certificat de signature Windows |

Ces durées supposent un développeur C++ audio à l'aise (ou Claude Code qui écrit le code, et toi qui testes sur ton Mac à chaque étape : les allers-retours de test dans Ableton sont le vrai goulot).

### 5.4 Coûts

| Poste | Coût |
|---|---|
| Apple Developer Program (signature + notarisation) | 99 USD / an (obligatoire pour distribuer) |
| JUCE | 0 USD (Starter, moins de 20 000 USD de revenus par an), sinon Indie 40 USD/mois ou 800 USD |
| SDK VST3 | 0 USD (MIT) |
| Xcode, CMake, pluginval | 0 USD |
| GitHub Actions macOS | 0 USD sur repo public ; payant au-delà du quota sur repo privé (à vérifier) |
| Vente | Gumroad 10 % + 0.50 USD par vente ; boutiques à la commission |

### 5.5 Risques et parades

| Risque | Parade |
|---|---|
| Le plugin ne sonne pas exactement comme le site | tests de référence automatiques JS contre C++ (section 2.2), même graine, calcul en double |
| CPU trop élevé avec 12 voix en x4 | C++ optimisé, x2 automatique à 88.2 / 96 kHz, limite de voix réglable, mesure sur ton Mac dès la semaine 1 |
| WebView dans Ableton : clavier qui ne revient pas à Live, premier clic qui sert à donner le focus (signalé sur le forum JUCE) | correctifs connus (renvoi des touches à l'hôte), tests tôt dans Live ; plan B : interface JUCE native |
| Mémoire d'une WebView par instance (plusieurs ARP dans un set) | interface légère en 2D, pas de WebGL en v1 |
| Synchronisation (pas à l'échantillon près, swing, LFO calé) | dériver tout de la position PPQ de l'hôte, plus de minuterie |
| Notarisation qui échoue (compte pas encore activé, signature d'un binaire oublié) | pipeline CI reproductible, vérification `spctl` et `stapler validate` à chaque build |
| Le site et le plugin divergent avec le temps | à terme, le site charge le cœur C++ en WebAssembly : une seule source |

---

## 6. Ce qui est déjà solide (vérifié)

- Le moteur est déterministe et portable : rendu Node identique au bit près à l'AudioWorklet de Chromium 141 (`parity-os4.json`), deux rendus de même graine identiques (`render-results.json`).
- Aucune valeur non finie dans 5 configurations rendues (dont 12 voix, FM, bruit, SUB, OVERDRIVE et MOD ensemble).
- Le modèle de paramètres est propre (0 à 1, ids stables, migrations), donc prêt pour l'automation VST3.
- La logique musicale (accords, voicings, suite EDIT, RANDOM) est séparée de l'horloge et réutilisable.
- La reverb est une réponse calculée et normalisée à l'avance (`normalize = false`) : reproductible à l'identique en C++.
- Le site sait déjà convertir l'heure audio en heure MIDI (`seqPerfOf`) : la sortie de notes s'appuiera dessus.

---

## 7. Fichiers produits pour cette étude

Dossier de travail de l'étude (hors dépôt, non versionné). Le banc de référence versionné est `scripts/arp-bench.mjs`.
- `node/arpcore.cjs` : `params.ts`, `chords.ts`, `seq.ts` regroupés (esbuild) pour Node ;
- `node/render.cjs`, `node/render-results.json`, `wav/*.wav` : rendus de référence ;
- `node/parity.cjs`, `parity-os4.json` : Node contre Chromium ;
- `node/prof-one.cjs`, `node/bench-fresh.log` : coût CPU par voix ;
- `app-check.cjs`, `app-check.json`, `voy-desktop.png` : vérification dans l'appli ;
- `midi-api.cjs` : absence de `MIDIOutput.clear()` dans Chromium.

---

## Sources

- Steinberg, communiqué VST 3.8 (MIT, 29 octobre 2025) : https://ocl-steinberg-live.steinberg.net/_storage/asset/819253/storage/master/Press%20Release%20-%202025-10-29%20-%20VST%203.8%20-%20EN.pdf
- Sonicstate, "VST 3 Now Available Under MIT License" : https://sonicstate.com/news/2025/10/30/vst-3-now-available-under-mit-license
- Wikipédia, Virtual Studio Technology : https://en.wikipedia.org/wiki/Virtual_Studio_Technology
- JUCE, tarifs : https://juce.com/get-juce/
- JUCE 8 EULA : https://juce.com/legal/juce-8-licence/
- JUCE, LICENSE.md (AGPLv3 / commerciale) : https://github.com/juce-framework/JUCE/blob/master/LICENSE.md
- JUCE 9 disponible (21 juillet 2026) : https://forum.juce.com/t/juce-9-is-available-now/69175
- JUCE 9 preview : https://forum.juce.com/t/the-juce-9-preview-branch-is-available-now/68864
- JUCE, feuille de route Q3 2025 : https://juce.com/blog/juce-roadmap-update-q3-2025/
- JUCE, WebBrowserComponent et relais : https://docs.juce.com/master/classWebBrowserComponent.html , https://ccoderun.ca/programming/doxygen/juce/classjuce_1_1WebSliderRelay.html
- Forum JUCE, focus clavier WebView : https://forum.juce.com/t/fixing-webview-keyboard-focus-issue/63987 , https://forum.juce.com/t/webviewplugindemo-juce8-focus-issue/61542 , https://forum.juce.com/t/webview-and-keyboard-input-propagation-issue-to-the-host/62439
- clap-juce-extensions : https://github.com/free-audio/clap-juce-extensions
- iPlug2 : https://github.com/iPlug2/iPlug2 , article : https://pure.hud.ac.uk/en/publications/iplug-2-desktop-plug-in-framework-meets-web-audio-modules/
- Cmajor : https://cmajor.dev/ , https://cmajor.dev/docs/GettingStarted , licence : https://raw.githubusercontent.com/cmajor-lang/cmajor/main/LICENSE.md
- Faust, discussion licence : https://forum.hise.audio/post/115555
- Elementary Audio : https://www.elementary.audio/
- RNBO : https://support.cycling74.com/hc/en-us/articles/10730637742483 , https://cycling74.com/shop/rnbo , https://musicradar.com/news/rnbo-max-launch
- nih-plug : https://github.com/robbert-vdh/nih-plug , webview : https://github.com/maxjvh/nih-plug-webview
- Max 9 (objet v8) : https://cycling74.com/releases/max/9.2.0 , https://www.sonicstate.com/news/2024/10/31/cycling-74-max-9-releasaed
- Ableton, versions de Max : https://help.ableton.com/hc/en-us/articles/209772305
- MIDI Tools de Live 12 : https://www.attackmagazine.com/news/midi-tools-are-here-now-in-our-max-for-live-store/
- Ableton, formats supportés : https://help.ableton.com/hc/en-us/articles/5937501570460-Supported-Plug-in-Formats , https://www.ableton.com/en/live-manual/12/using-plug-ins/ , https://help.ableton.com/hc/en-us/articles/4410323149074-Plug-ins-on-Mac-in-Live-11-1-and-later
- CLAP et Ableton : https://producergrid.com/blog/clap-plugin-format-everything-you-need-to-know/ , https://www.soundonsound.com/reviews/ableton-live-12
- Ableton, sortie MIDI d'un VST : https://help.ableton.com/hc/en-us/articles/209070189-Accessing-the-MIDI-output-of-a-VST-plug-in
- Bus MIDI virtuel (IAC) : https://help.ableton.com/hc/en-us/articles/209774225 , https://support.apple.com/en-au/guide/audio-midi-setup/ams1013/mac
- Chrome, autorisation Web MIDI : https://developer.chrome.com/blog/web-midi-permission-prompt
- Apple Developer Program (99 USD) : https://developer.apple.com/programs/ , notarisation sans frais : https://developer.apple.com/forums/thread/746992 , certificat d'installeur : https://forum.juce.com/t/macos-plugin-installer-signing-certificate/31386 , plugins et macOS : https://www.igorski.nl/on-plugins-and-macos
- Frais Gumroad 2026 : https://checkoutpage.com/blog/gumroad-fees , https://dodopayments.com/blogs/gumroad-fees-explained
