# 2026-11-09 - MM-ARP en plugin VST3 (usage perso)

Demande de Mika : « fais la meme chose pour ARP, le transferer en plugin VST3 pour que je puisse l'installer directement
dans mon disque et l'utiliser avec Ableton ». Meme recette que le MM-RYTM (`plugin/mm-rytm`, 2026-11-08).

## 1. Ce qui a ete fait

- `plugin/mm-arp/dsp/Voyager.{h,cpp}`, `Voyager.fdlibm.inc` (nouveaux) : le port C++ ligne a ligne de
  `src/v4/audio/moog.worklet.js` (tout le moteur), avec les fonctions mathematiques de V8.
- `plugin/mm-arp/dsp/ArpFx.{h,cpp}` (nouveaux) : la chaine de `audio/synth.ts` (BASS MONO, CHORUS Juno-106, DELAY
  ping-pong, TAPE, REVERB de l'ARP, VOLUME), les rampes des AudioParam de Chromium comprises.
- `plugin/mm-arp/dsp/Arp.{h,cpp}` (nouveaux) : la mise en temps de `voyager/arp.ts` sur la position d'Ableton.
- `plugin/mm-arp/src/` (nouveau) : le plugin JUCE 8.0.9 (processeur, fenetre WebView avec la face embarquee).
- `plugin/mm-arp/tests/` (nouveau) :
  - `voyager-ref.mjs`, `voyager_cases.json`, `voyager_compare.cpp`, `voyager_build.sh` : le moteur contre le vrai worklet (85 cas) ;
  - `fx-ref.mjs`, `fx_test.cpp` : les effets contre les worklets (Node) et la chaine (Chromium hors ligne, muet) ;
  - `arp_test.cpp` : l'arpegiateur (18 cas) ;
  - `host_test.cpp` : le processeur JUCE complet sans fenetre (13 cas).
- `plugin/mm-arp/CMakeLists.txt`, `README.md`, `INSTALL.md`, `update.sh`, `.gitignore`, `web/` (nouveaux).
- La face, cote site (rien ne change hors du mode plugin ARP) :
  - `src/v4/plugin/arp/` (nouveau) : ArpFace, bridge, drawer, boot, main, face.css ;
  - `src/v4/theme/base.ts` : `PLUGIN_KIND`, `PLUGIN_ARP` ;
  - `theme.ts`, `voyager/theme.ts`, `scene/renderer.ts` : le cadrage de l'ARP seul, vu de dessus ;
  - `state/focus.ts` : focus 'voy' seul ;
  - `voyager/arp.ts` : mode externe, la tete de lecture vient du C++ ;
  - `voyager/rig.ts`, `seqscreen.ts`, `pads.ts`, `ui/SeqLane.tsx`, `ui/Hotspots.tsx`, `actions/nav.ts`, `hooks/useKeys.ts` : les adaptations du mode plugin ARP ;
  - `audio/synth.ts` : `engineState` exporte, le worklet jamais charge dans la WebView.
- `package.json` : script `plugin:arp:web`.
- `.github/workflows/plugin-arp.yml` (nouveau) :
  - DSP sur Linux ;
  - banc du processeur JUCE sur Linux ;
  - VST3 macOS universel signe ad hoc, en artefact et dans la release `mm-arp-latest`.

## 2. Decisions prises et pourquoi

- **Le son en C++, la face du site dans une WebView** : comme le RYTM. Le plugin joue fenetre fermee et pendant un export.
- **Le moteur identique au bit pres** (85 cas sur 85, g++ et clang, -O2 a -march=native) :
  - la libm du systeme differait de V8 d'un ulp (-148 dB) : le moteur embarque le fdlibm de V8 ;
  - la contraction en FMA fait diverger la resonance : elle est interdite (pragma + `-ffp-contract=off`) ;
  - le plugin fait tourner le moteur par blocs de 128 exactement, comme l'AudioWorklet. La sortie passe par une file, avec 128 echantillons (2,7 ms) de plus declares a Ableton. La latence totale est de 147 echantillons, compensee par Live.
- **Les effets** :
  - les worklets (chorus, tape) sont identiques au bit pres ;
  - le reste est sous -60 dB de la vraie chaine de Chromium (le plancher vient des biquads en float du navigateur) ;
  - l'ARP a sa propre reverbe sur le site (IR_DEFAULT), independante de SIZE / TONE / PRE du RYTM ;
  - le SIDECHAIN n'est pas porte : il n'y a pas de kick dans le plugin.
- **L'arpege cale sur les mesures d'Ableton**, sans etat :
  - la mesure b joue `prog[b % n]` ;
  - la suite repart de sa premiere note au debut de chaque suite de mesures du meme accord ;
  - RAND et DRIFT tirent une graine par position, et la graine est gardee dans le projet ;
  - resultat : une boucle, un export ou une lecture lancee au milieu donnent toujours les memes notes. Au site, l'arpege compte depuis RUN.
- **La face resout les notes** (suite EDIT / AUTO en midi, reservoir de RAND) avec le code du site : moins de portage, pas d'ecart possible sur les voicings.
- **Le MIDI joue le synthe** : velocite 100 = accent 1, note-off reel. Le parametre Arpeggiator coupe l'arpege pour s'en servir en synthe classique.
- **La fenetre fait 1100 x 704** : les proportions de la face. Sous 768 px de large, le renderer passerait en mise en page mobile.
- **Aucun son pendant les tests** : tout est verifie dans des buffers, et Chromium tourne en `--mute-audio`.
- **JUCE compile dans le conteneur cette fois**, pour le banc sans fenetre. J'ai installe les en-tetes X11 et ALSA avec apt.

## 3. Ce qui reste a faire / points en suspens

- **Mika** : quand le build `plugin-arp.yml` est vert, installer avec la commande d'`INSTALL.md`, puis Option + Rescan dans
  Live. Ensuite ecouter :
  - le son contre le site ;
  - l'arpege cale sur Ableton ;
  - RUN de la face Ableton arrete ;
  - les notes MIDI ;
  - la sauvegarde dans le projet ;
  - la charge CPU a 12 voix. Mesure sur la machine de test : 55 a 70 % d'un coeur dans le reglage le plus lourd, probablement 4 a 5 fois moins sur un Mac recent.
- Plus tard, si Mika le veut :
  - la sortie MIDI des notes de l'arpege ;
  - l'automation Ableton des potards ;
  - SIDECHAIN par une entree sidechain VST3 ;
  - une convolution plus legere pour la reverb (12,9 % d'un coeur ici) ;
  - un capot 3D a la place du tiroir.
- Limites connues :
  - deux instances partagent le localStorage de la WebView ; chacune restaure le sien a l'ouverture, comme le RYTM ;
  - le tempo de la face (horloge interne) est celui du motif RYTM du site.

## 4. Commandes utiles ajoutees

- `npm run plugin:arp:web` : construit la face du plugin dans `plugin/mm-arp/build-web`.
- Tests du DSP et comparaison au site, puis le banc du processeur : voir `plugin/mm-arp/README.md` (`mmarp_arp_test`,
  `voyager-ref.mjs` + `mmarp_voyager_compare`, `fx-ref.mjs` + `mmarp_fx_test`, `-DMM_HOST_TEST=ON` + `mmarp_host_test`).
- Installer ou mettre a jour le plugin sur le Mac :

```bash
curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-arp-latest/update.sh | bash
```

## Suite (meme jour) : les potards en parametres de l'hote, les presets sur le disque

Demande de Mika : « tous les parametres disponibles en MIDI », « quand j'appuie sur la fleche du plugin voir les fonctions », « enregistrer un preset directement sur mon disque dur en le nommant ».

### 1. Ce qui a ete fait
- `plugin/mm-arp/dsp/Params.{h,cpp}`, `ParamTable.inc` (genere par `tests/params-gen.mjs`), `tests/params-ref.mjs`, `tests/params_test.cpp` : les lois de `voyager/params.ts` (engineParams, textes), `chords.ts`, `seq.ts` et des effets en C++. 3000 cas, 0 ecart (moteur au bit pres, notes, textes), aucune allocation temps reel.
- `plugin/mm-arp/src/` : les 62 potards (44 de la face, 18 TWEAKS) en parametres de l'hote, plus Arpeggiator et Master. Le moteur, la chaine et l'arpege en sont tires sur le thread audio. Le programme v2 de la face ne porte plus que la suite, la progression, le tempo et le swing. Les gestes vont a l'hote, la synchro marche dans les deux sens sans echo, et les presets passent par les boites de dialogue du Mac.
- Les projets de la premiere version : leurs potards, leur suite et leur progression sont repris de l'etat de la face.
- `src/v4/plugin/arp/` : `bridge.ts` (protocole v2), `disk.ts` et `DiskPresets.tsx` (la colonne DISK du tiroir, le dialogue du nom), `ArpFace.tsx`, `face.css`.
- `tests/host_test.cpp` : 20 cas (automation sans la face, parametres dans le projet, projet de la premiere version).

### 2. Decisions
- **Le C++ porte les lois du site** : sinon l'automation ne ferait rien fenetre fermee. Les valeurs de l'hote passent par `knobClean` (l'arrondi de voyParams.set), pour qu'un reglage sonne exactement comme sur le site.
- **Les presets** sont des fichiers `.mmarp` (le JSON des presets du site : potards, suite, progression), dans `~/Music/Maudite Machine/MM-ARP Presets`. Le nom se tape dans la face, puis la fenetre du Mac permet de choisir l'endroit.
- **Une instance neuve** prend les potards de sa face au premier programme. Ensuite, ce sont les parametres de l'hote qui font foi.

### 3. En suspens
- Mika : mettre a jour avec `update.sh`, puis verifier le triangle, MIDI Map, l'automation (potards qui bougent dans la face) et SAVE / OPEN.
- Tourner MODE, RANGE ou NOTES depuis Ableton ne repasse pas la suite EDIT en AUTO, contrairement a la face du site.
- L'automation appliquee a la face entre dans son UNDO.

## Suite : DRAG MIDI (l'arpege en clip)

Demande de Mika : « un bouton pour transferer les notes dans un clip MIDI automatiquement dans la piste ou on a le plugin ».

### 1. Ce qui a ete fait
- `src/PluginProcessor.cpp` : `arpMidi(cycles)` construit le fichier MIDI de la progression entiere (une mesure par accord, 1, 2 ou 4 fois). Il passe par le meme `mmarp::Arp`, la meme graine et les potards arrondis comme le son. Les accents deviennent des velocites (100 = accent 1), la porte devient la duree. Le fichier est a 960 ticks par noire, au tempo de la face. `arpMidiFile` l'ecrit dans `~/Music/Maudite Machine/MM-ARP Clips`.
- `src/PluginEditor.{h,cpp}` : une bande native de 34 px sous la face, avec la poignee DRAG MIDI (`performExternalDragDropOfFiles`), x1 / x2 / x4, SAVE .MID (boite du Mac) et une ligne d'aide.
- `tests/host_test.cpp` : 3 cas de plus (notes, mesures, fichier).

### 2. Decisions
- **Un VST3 ne peut pas creer de clip dans Live** (aucune API) : le geste standard est de glisser un fichier MIDI depuis le plugin, comme Scaler ou Captain Chords. Live cree le clip a l'endroit du depot.
- **Une bande native, pas un bouton dans la face** : un glisser vers Ableton doit partir d'une vue native (la WebView garde la souris). La fenetre passe donc a 1100 x 738.

### 3. En suspens
- Mika : essayer le glisser dans Ableton, sur une piste et dans l'Arrangement. Couper Arpeggiator pour jouer le clip.

## Suite : le capot 3D, la gestion MIDI, le clip qui a le dessus

Demande de Mika : « quand je clique dans OPEN je dois voir l'interieur, le circuit imprime, comme avant ; la doit y avoir le DRAG MIDI et la gestion MIDI » ; « quand je drag le clip MIDI c'est lui qui a le dessus ».

### 1. Ce qui a ete fait
- La face (`src/v4/plugin/arp/`, `scene/renderer.ts`, `voyager/theme.ts`, `actions/nav.ts`, `voyager/rig.ts`) :
  - OPEN ouvre le vrai capot du site, avec le PCB et les 18 TWEAKS jouables, cadre pour la fenetre (`VOY_PLUGIN_OPEN`) ;
  - le tiroir 2D est retire ;
  - un bandeau sous la carte (`HoodPanel.tsx`) regroupe DRAG MIDI (x1 / x2 / x4, SAVE .MID), DISK, MIDI LEARN (LEARN, la table des CC, les croix, CLEAR ALL) et CLOSE ;
  - le potard arme est cerne d'orange.
- Le C++ :
  - `mm_drag_midi` lance le glisser natif du fichier MIDI depuis l'evenement souris courant (`performExternalDragDropOfFiles`). La bande native sous la face est retiree, la fenetre revient a 1100 x 704 ;
  - MIDI LEARN : `ccMap_` (canal x CC vers potard), le premier CC recu apres l'armement, un CC par potard, le potard pilote par le CC (setValueNotifyingHost). L'etat est garde dans le projet (`MIDIMAP`) ;
  - Clip Priority (parametre `prio`, actif par defaut) : des notes MIDI tenues ou arrivees il y a moins d'une mesure font taire l'arpege interne.
- `tests/host_test.cpp` : 25 cas (MIDI LEARN, Clip Priority en plus).

### 2. Decisions
- **Le glisser part de la face** : JUCE prend l'evenement souris courant de la fenetre, donc le message est envoye pendant que le bouton est tenu. A verifier dans Live. Si le glisser ne part pas, SAVE .MID enregistre le meme clip.
- **Le clip a le dessus sans rien couper** : plus besoin de couper Arpeggiator pour jouer un clip. Clip Priority a OFF rend l'ancien comportement (les deux ensemble).

### 3. En suspens
- Mika : DRAG MIDI depuis le capot (le glisser natif depuis la WebView), MIDI LEARN avec son controleur, et un clip qui joue avec l'arpege qui se tait.
- Capot ouvert, la face est relevee : pour apprendre un potard de la face, LEARN, puis fermer le capot, puis cliquer le potard.

## Suite (2026-11-10) : la face bord a bord

Demande de Mika : « c'est dommage d'avoir les barres noires autour, ca casse le design ».

- `src/v4/voyager/theme.ts` (`VOY_PLUGIN_FACE`) : la marge de 2 % autour de la machine devient un leger debord (0.985). Les joues de bois touchent les bords de la fenetre, le haut et le bas sont pleins. Verifie par une capture Chromium a 1100 x 704.
- La bande noire DRAG MIDI du bas, visible sur la capture de Mika, etait deja retiree dans la version du capot (`56555d4`).
- Ne touche que le mode plugin ARP : le site ne change pas.

## Suite (2026-11-10) : SOUND+, la qualite du VST3 seul

Demande de Mika : « une qualite absolument fantastique, seulement le VST3 ; rajouter des knobs, ameliorer les LFO, plus de destinations dans Target ; quitte a prendre plus de processeur ; le plugin du site, on n'y touche pas ».

### 1. Ce qui a ete fait
- `plugin/mm-arp/extra-params.json` : les 14 reglages du VST3 seul, source unique pour la face et pour le C++ (`tests/extra-gen.mjs` genere `src/ExtraTable.inc`, lu par `src/ExtraParams.h`).
- `dsp/Voyager.{h,cpp}` :
  - surechantillonnage x8, avec un demi-bande Kaiser de plus et `setOs` sans allocation ;
  - LFO 1 seconde destination (`xl1Dest`, `xl1Amt`) ;
  - LFO 2 (`l2Beats`, `l2Shape`, `l2Dest`, `l2Amt`), avec un hasard sans etat ;
  - 10 destinations nouvelles : RES, AMP, PAN, OSC 2 PITCH, OSC MIX, NOISE, SUB, DRIVE, STACK, ENV AMT.
- `dsp/ArpFx.{h,cpp}` :
  - reverb reglable (`makeReverb`, `setReverb`, `takeRetiredReverb`) ;
  - convolution a partitions non uniformes, latence 0 ;
  - master : WARMTH (tanh asymetrique, x4 local), BASS, AIR, WIDTH.
- `src/PluginProcessor.{h,cpp}` :
  - les 14 parametres de l'hote ;
  - QUALITY par `setOs` ;
  - la reverb calculee par un timer du thread du message et echangee sur le thread audio ;
  - MIDI LEARN et la synchro face etendus aux reglages `x*`.
- La face (`src/v4/plugin/arp/` : `extra.ts`, `SoundPlus.tsx`, `tab.ts`, `HoodPanel.tsx`, `bridge.ts`) : l'onglet SOUND+ du capot, la pastille SOUND+ sur la face, le champ `extra` du programme et des presets disque.
- Tests : `tests/hq_test.cpp` (87 controles), `host_test.cpp` (29 cas).

### 2. Decisions et mesures
- **Le site ne change pas.** Les reglages ne sont pas dans `voyager/params.ts`, et chacun, a son neutre, rend le son du site : les 85 cas restent au bit pres. Seul QUALITY part sur HQ.
- **Repliement x4 contre x8** (plus forte raie repliee sous 20 kHz) :

| Cas | x4 | x8 |
| --- | --- | --- |
| Scie C7, filtre ouvert | -89.7 dBc | -109.1 dBc |
| Scie C7, OVERDRIVE plein | -70.0 dBc | -81.1 dBc |
| MS-10 RES 0.95 + OVERDRIVE | -100.9 dBc | -118.2 dBc |

  La sonie est identique a 0.01 dB pres.
- **CPU du moteur** (machine de test lente, reglage le plus lourd) : 1 voix 6.8 % puis 11.1 %, 12 voix 49.5 % puis 94.1 %. A surveiller sur le Mac ; STD reste la.
- **Reverb** : la nouvelle convolution coute 2.2 % au lieu de 9.1 % a 2.4 s, et 2.4 % a 9.6 s. Elle est a -128 dB de l'ancienne.
- **Un preset disque** garde ses reglages SOUND+. Un preset sans eux les remet au neutre, sauf QUALITY.

### 3. En suspens
- Mika : ecouter HQ, le LFO 2, les destinations, la reverb longue, le master ; surveiller le CPU en HQ.
- UNDO, RANDOM et les presets de l'ecran de la machine ne touchent pas a SOUND+.
- Changer QUALITY en cours de jeu fait un trou d'environ 0.1 s.
- WARMTH engagee retarde la sortie de 39 echantillons, non declares a l'hote.

## Suite (2026-11-10) : bois droit, design de la face avant, tout dans OPEN, banque d'usine

Demandes de Mika :
- « mets le bois droit sur les bords » ;
- « le design des rajouts est mauvais, fais-les par rapport au design de la face avant » ;
- « tout dans OPEN, pas melange » (et enrichir le capot) ;
- « les presets pourraient etre meilleurs, plus de disco a la Donna Summer ou de trucs hypnotiques ».

### 1. Ce qui a ete fait
- **Le bois droit** (`src/v4/theme.ts`, `scene/renderer.ts`, plugin ARP seulement) : une camera presque orthographique (champ 0.1 deg, de tres loin). Les joues de bois sont verticales et symetriques au pixel pres (40 px de bois de chaque cote).
- **La face fermee** : aucun ajout, la pastille SOUND+ est retiree.
- **Le capot OPEN** (`src/v4/plugin/arp/` : HoodPanel, SoundPlus, Library (nouveau), DiskPresets, face.css, tab.ts, bridge.ts) : un panneau d'extension dessine comme la face avant (couleurs relevees sur le rendu : panneau #211F1D, serigraphie #D2CDC3 / #B7B2A9, LED VOY_LED). Il a trois pages, choisies par des touches a LED : SOUND+, LIBRARY, TOOLS (CLIP, DISK, MIDI). Une colonne fixe porte un afficheur, LEARN et CLOSE. Les potards sont en SVG facon face, avec leurs legendes de butee comme sur le PCB.
- **La banque d'usine** (`plugin/mm-arp/presets/` : `build.mjs`, `factory.json`, `factory/*.mmarp`) : 32 presets (10 DISCO, 10 HYPNOTIC, 6 DARK, 6 TEXTURE), dans la page LIBRARY.
  - Ils sont verifies par rendu hors ligne avec le DSP du plugin (`tests/presets-render.sh`) : cretes, sonie calee a -23 LUFS, diversite.
  - Les rendus MP3 ont ete envoyes a Mika.

### 2. Decisions
- **Des pages plutot que tout a plat** : a la hauteur fixe du bandeau (172 px), tout ne tenait pas lisiblement. Les pages sont des touches de la machine.
- **Les presets du site restent tels quels.** La mesure montre que cinq d'entre eux (ACID, MINIMAL, ROLLING, HYPNO LOOP, MS HYPNO) jouent le meme motif.

### 3. En suspens
- Mika : ecouter les presets et dire lesquels refaire.
- Le nom d'un preset d'usine ne reste pas dans l'en-tete de l'ecran de la machine.

## Suite (2026-11-11) : le module d'extension de la face avant

Demande de Mika : « sur le VST je voulais encore d'autres fonctions sur le panneau AVANT, donc agrandis la taille generale et fais en sorte de placer plus de choses pour un rendu vraiment hors du commun » (sequenceur par pas, rack d'effets, oscillateurs et filtre).

### 1. Ce qui a ete fait
- **La fenetre** : 1100 x 880 par defaut (5 / 4, proportion 1.25), `src/v4/plugin/arp/scale.ts` (`UI_W`, `UI_H`, `FACE_H`, `MODULE_H`, `UI_ASPECT`). La scene 3D garde le haut (64 % de la largeur, `face.css` `.v4-stage`), a son cadre d'avant.
- **Le module avant** (`FrontModule.tsx`, `face.css`) : toujours visible sous la face, 1100 x 176 dans le repere de la couche a l'echelle. Le panneau anthracite continue, les joues de noyer sont prolongees par une texture tiree du rendu (`wood-l.jpg`, `wood-r.jpg`, raccord en miroir). Trois zones : STEP SEQUENCER, OSC / FILTER +, FX RACK.
- **Les pistes** (`steps.ts`) : `{ acc, slide, gate, rat, prob }`, 16 pas chacune, sous `mm.v4.plugin.arp.steps`, dans `mm_program` (`steps`), dans les presets disque et d'usine (champ `steps`, defauts sinon).
- **Les 23 reglages nouveaux** de `extra-params.json` : memes evenements que SOUND+ ; leurs textes de valeur dans `extra.ts` (Hz, bits, OFF, pourcentages signes).
- `SoundPlus.tsx` : `XKnob` exporte, variante `compact` ; `HoodPanel.tsx` : l'afficheur montre aussi le potard ou le pas touche dans le module.

### 2. Decisions
- **1100 x 880 et pas plus large** : a largeur egale la face prend 64 % de la largeur en hauteur ; plus large, il ne reste plus de place pour le module sous 880 px (MacBook Pro 14 pouces). La face garde donc sa taille, la fenetre grandit vers le bas.
- **Le bois en CSS** plutot que le corps 3D agrandi : la geometrie du corps sert aussi au site ; la texture vient du rendu lui-meme, le raccord est invisible.
- **Les lois d'affichage** (a tenir par le C++) : RATE du phaser 0.05 x 160^v Hz, du flanger 0.03 x (5 / 0.03)^v Hz, HIGH PASS 20 x 100^v Hz, CRUSH 16 - 12 v bits, DOWNSAMPLE 48 kHz x (2 / 48)^v.

### 3. En suspens
- C++ (`plugin/mm-arp/src/PluginEditor.cpp`) : `kW 1100`, `kH 880`, proportion 1.25 ; lire `steps` dans `mm_program`.
- UNDO et RANDOM de la machine ne touchent ni aux pistes ni aux reglages du module (comme SOUND+).
- Une suite AUTO de plus de 16 notes : les pistes bouclent (pas = position modulo 16).

### 4. Commandes
- Aucune nouvelle. Essai : `npm run dev`, `/plugin/mm-arp/web/index.html?mute=1`, fenetre de 1100 x 880.

## Suite (2026-11-11) : le son des trois ensembles, faible latence, raccord au processeur

### 1. Ce qui a ete fait
- `dsp/Arp.{h,cpp}` : les pistes par pas (`stepAcc`, `stepSlide`, `stepGate`, `stepRat`, `stepProb`), `swingOwn`, `ArpSink::noteGlide`.
- `dsp/Voyager.{h,cpp}` : le glissement par note (SLIDE), `xRing`, `xFold` (ADAA), `xNoiseCol`, `xUnison` (5 ou 7), `xHpf`, `xComb` / `xCombFb`.
- `dsp/ArpFx.{h,cpp}` : CRUSH, PHASER 6 etages, FLANGER, PUMP cale au ppq (`setTransport`), `dlyMode` (STEREO, WIDE), SHIMMER.
- `src/PluginProcessor.{h,cpp}` :
  - 37 reglages du VST3 seul (`extra-params.json`), soit 102 parametres de l'hote ;
  - les pistes lues dans `mm_program.steps` ;
  - le clip DRAG MIDI suit les pistes ;
  - la fenetre passe a 1100 x 880, redimensionnable (880 a 2200), sa taille gardee dans le projet.
- **Faible latence** : le moteur rend le bloc de l'hote sans la file de 128. La latence declaree passe de 149 a 21 echantillons (0.4 ms). L'ecart de sonie selon la taille des blocs est de 0.04 dB.
- Tests : `hq2_test` (54 controles), `arp_test` (42 cas), `host_test` (32 cas).

### 2. Decisions
- **La file de 128 est retiree.** Mika veut la latence la plus basse. Le son n'est plus au bit pres du site selon la taille des blocs de l'hote, mais il l'est toujours dans les tests, en blocs de 128.
- **FOLD remplace la table d'ondes** annoncee a Mika, dit a Mika.
- **Les presets sortent a part** : la banque de 40 presets, refaite avec ces fonctions, part dans une seconde mise a jour.

### 3. En suspens
- Mika : charge du processeur avec UNISON 7 + WIDE en HQ.
- FLANGER engage retarde la sortie de 2.5 ms, non declares a l'hote.
- La banque de presets est en cours de refonte.

## Suite (2026-11-11) : la banque d'usine refaite (40 presets)

- `plugin/mm-arp/presets/` (`build.mjs`, `volumes.json`, `calibrate.sh`, `factory.json`, `factory/*.mmarp`) : 40 presets (12 DISCO, 12 HYPNOTIC, 8 DARK, 8 TEXTURE). Chacun est complet : 62 potards, 37 reglages, suite, progression et pistes par pas. Ils utilisent les nouvelles fonctions (PUMP, PHASER, FLANGER, SLIDE, ACCENT, RATCHET, PROB, COMB, SHIMMER, FOLD, RING, CRUSH, UNISON).
- `tests/presets_render.cpp`, `presets-check.mjs`, `presets-render.sh` : le rendu suit le chemin du processeur, en x4 et en x8. Le controle de diversite repose sur 12 descripteurs et une distance entre presets.
- Mesures : distance minimale 2.73 entre deux presets, contre 1.91 pour l'ancienne banque, qui avait 15 paires sous les seuils. La sonie est calee a -23 LUFS (TEXTURE a -25).
- Les rendus MP3 sont envoyes a Mika. A verifier a l'oreille en priorite : SINGING COMB, CRYSTAL MIST, GHOST RATCHETS, SYN TOM FALL, OFFBEAT BELL.
- Ce build n'est parti qu'apres une relance a la main : le push de `0cea0d5` n'avait lance aucun run.

## Suite (2026-11-11) : la refonte de la face (format large, potards metal, OPEN plein cadre)

Demande de Mika : « carre c'est pas bon, plus en largeur », des potards a capuchon metal et graduations chiffrees, un design inspire d'un synthe du commerce qu'il admire, et OPEN qui bascule sur une autre interface complete.

### 1. Ce qui a ete fait
- **Fenetre 1440 x 810 (16 / 9)**, redimensionnable de 1100 a 2560 (`PluginEditor.cpp`, `scale.ts`).
- **Face avant** (`src/v4/plugin/arp/` : Header (nouveau), FrontModule, SoundPlus, face.css ; `src/v4/voyager/` : skin.ts (nouveau), silk.ts, knobs.ts, rig.ts, theme.ts) :
  - un bandeau en haut : logotype, afficheur de la banque avec fleches, version du build, OPEN ;
  - la machine 3D a gauche, memes emplacements et meme echelle ;
  - le rack a droite : OSC +, FILTER +, PHASER, FLANGER, PUMP, CRUSH, SPACE ;
  - le STEP SEQUENCER dessous ;
  - l'habillage : simili noir a grain, bandeaux de section en metal brosse, potards a capuchon gunmetal avec graduations chiffrees, les memes en 3D et en HTML. Les matieres sont procedurales.
- **OPEN** : un second panneau plein cadre, sur une seule page. Il regroupe les 18 TWEAKS en vrais potards (noirs a index blanc), ENGINE, LFO 1, LFO 2, REVERB, MASTER, CLIP, MIDI, LIBRARY (les 40 presets visibles) et DISK. La carte PCB n'est plus montree dans le plugin.

### 2. Decisions
- **Inspire, pas copie** : l'esprit (cuir noir, bandeaux metal, graduations) vient du synthe de reference. La disposition, le logotype, les textes et l'orange des legendes restent ceux de Maudite Machine.
- **Une forme en L** (rack a droite, sequenceur dessous) : une colonne seule etait trop etroite pour les trois modules a cette proportion.

### 3. En suspens
- Mika : le rendu dans Ableton (teinte du noir 3D contre le HTML sur le GPU du Mac), le glisser DRAG MIDI, la taille de la fenetre.
- La carte INFOS de la machine est decalee d'environ 20 px.

## Suite (2026-11-11) : matrice de modulation, controleurs, modes de voix, EQ, distorsion ; OPEN en trois pages

Demande de Mika, en montrant un synthe analogique du commerce : « je veux pas le meme mais je veux toutes les fonctions possibles ».

### 1. Ce qui a ete fait
- `extra-params.json` : 65 reglages du VST3 seul (28 nouveaux : sections matrix, voice, amp, eq, dist). Le plugin expose 130 parametres a l'hote.
- `dsp/Voyager.{h,cpp}` :
  - `pitchBend`, `modWheel`, `aftertouch`, et la velocite comme source ;
  - la matrice de 6 lignes (12 sources, 20 destinations), cles `mNSrc` / `mNDst` / `mNAmt` ;
  - `pbRange`, `voiceMode` (POLY, MONO, LEGATO), `xFeedback`, `ampMode` (CLEAN, TRIODE, PENTODE, SATURATED).
- `dsp/ArpFx.{h,cpp}` : DISTORTION (x4 local + ADAA) et EQ 4 bandes (LOW, MID, HIGH, AIR).
- `src/PluginProcessor.cpp` : le raccord des 22 cles du moteur et des champs de la chaine. Le pitch bend, le CC 1 et la pression de canal vont au moteur ; la velocite accompagne les notes MIDI.
- La face (`src/v4/plugin/arp/` : Matrix.tsx (nouveau), HoodPanel, Header, SoundPlus, extra.ts, face.css) : OPEN en trois pages par onglets.
  - OPTIONS : 36 reglages, dont VOICE, AMP, DISTORTION, EQ.
  - MODULATION : la matrice avec ses selecteurs, LFO 1, LFO 2, le bloc SOURCES.
  - LIBRARY : CLIP, MIDI, LIBRARY, DISK.
- La banque d'usine est regeneree avec les 65 cles, les nouvelles au neutre.
- Tests : `hq3_test` (56 controles), `host_test` (34 cas).

### 2. Decisions
- **Non repris du synthe de reference** : les entrees CV externes et le traitement mid / side du filtre, sans objet ici.
- **Le retour a la note tenue ne redeclenche pas** en MONO et en LEGATO.

### 3. En suspens
- Mika : essayer la matrice (molette, aftertouch, velocite), MONO / LEGATO au clavier, la charge du processeur avec 6 lignes par voix (+50 % mesures).
- DISTORTION, WARMTH et FLANGER engages retardent la sortie (39 a 120 echantillons), non declares a l'hote.
- Les presets d'usine n'utilisent pas encore la matrice ni les modes de voix.

## Suite 2026-11-12 : face épurée et droite (retour « horrible, le bordel partout, lignes blanches »)

### Ce qui a été fait
- Grille unique (colonnes 63,5 px, rangées 100 px) pour la machine 3D (plugin seul, gardé par `PLUGIN_ARP`), le rack et OPEN : `src/v4/plugin/arp/scale.ts`, `src/v4/voyager/theme.ts`, `rig.ts`, `silk.ts`.
- Bandeaux métal clairs, plaques, cadres, chiffres autour des potards et infobulles supprimés ; titres en petites capitales grises avec filet fin.
- Potards noirs en relief : 3D (`voyager/knobs.ts`) et HTML (image du potard 3D, `plugin/arp/knob.png` + `knob.ts`). Deux tailles seulement.
- Valeur affichée dans l'afficheur du bandeau au survol et pendant le geste (`Header.tsx`).
- STEP SEQUENCER sur toute la largeur ; OPEN (OPTIONS, MODULATION, LIBRARY) sur la même grille.

### Décisions
- Sélecteurs à crans sans noms (place) : valeur dans l'afficheur.
- Site et RYTM inchangés au pixel ; tsc 105 erreurs comme avant.

### Reste à faire
- Mika : essai dans Ableton (teinte du noir sur le GPU du Mac), dire s'il veut les noms des crans de RANGE.

## Suite 2026-11-12 : retour à la version de base (demande de Mika)

Mika : « retourne à la version de base avant que nous décidions de rajouter plein de choses, le plugin est complètement détruit, illisible ».

### Ce qui a été fait
- `plugin/mm-arp/`, `src/v4/` et `.github/workflows/plugin-arp.yml` remis à l'état du commit `a447e5a` (2026-11-10 18:23) : face du site bord à bord sans barres noires, 62 potards en paramètres VST3, presets sur le disque, OPEN ouvre le capot PCB avec DRAG MIDI, DISK et MIDI LEARN, le clip a le dessus.
- Retirés : SOUND+ / HQ x8, LFO 2, matrice, rack d'effets, séquenceur par pas, banque de 40 presets, format large 1440 x 810, face épurée. Tout reste dans l'historique git (dernier état : `c5c85cd`).

### Décisions
- Retour complet plutôt que partiel : Mika veut retrouver le plugin tel qu'il l'aimait.

### Reste à faire
- Mika : réinstaller et vérifier. Les projets Ableton enregistrés avec les versions SOUND+ et suivantes peuvent perdre les réglages ajoutés depuis.

## Suite 2026-11-12 (soir) : page 2 d'OPEN, PCB noir

### Ce qui a été fait
- Moteur complet remis sous la face de base (C++ et DSP de `c5c85cd`) : 65 réglages du VST3 seul, matrice, séquenceur par pas, 40 presets. Fenêtre 1100 x 704, redimensionnable de 880 à 2200 (`editorW3`).
- Face avant et page 1 d'OPEN (PCB vert) inchangées, à part un bouton « PAGE 2 › » sous CLOSE.
- Page 2 : PCB noir sobre, mêmes pièces que la page 1 (`src/v4/plugin/arp/Page2.tsx`, `pcbui.tsx`, `page2.css`, `hoodPage.ts`, `library.ts`, `extra.ts`, `steps.ts`, `bridge.ts` v2). Cinq onglets : SOUND, FX, MOD, STEPS, LIBRARY. L'écran reste à sa place (capot levé sans son écran, effet de découpe) et affiche le réglage touché.

### Décisions
- Mika valide désormais sur captures avant chaque publication.
- Pas de découpe sur la page 1 : l'écran y masquerait les TWEAKS.

### Reste à faire
- Mika : essai dans Ableton, surtout l'écran qui reste en place dans la WebView du Mac.

## Suite 2026-11-13 : une seule page OPEN, fenêtre 2x

### Ce qui a été fait
- OPEN : une seule carte noire (`src/v4/plugin/arp/HoodBoard.tsx`, `hood.css`, `pcbui.tsx`, `hoodPage.ts`), plus de PCB vert ni de PAGE 1 / PAGE 2. Le capot se lève toujours avec le trou de l'écran, l'écran reste en place.
- Sept onglets : TWEAKS (ex page 1), SOUND, FX, MOD, STEPS, LIBRARY (+ DISK), MIDI (DRAG MIDI + MIDI LEARN).
- Fenêtre 2x par défaut (2200 x 1408), redimensionnable de 880 à 3300, bornée à l'écran (`PluginEditor.cpp`, état `editorW4`).

### Reste à faire
- Interface secondaire en jaune canard (#D28E05) au lieu de l'orange ; boutons remplaces par des touches carrees sombres facon face avant (composant PcbKey, nom ecrit dessous, allumees en jaune quand actives) ; bandeau du bas de 46 px (MIDI LEARN, 7 onglets, CLOSE). Face avant inchangee au pixel.

## 2026-11-13 (suite) : OPEN en 3 pages, HELL, random hypnotique

### Ce qui a ete fait
- OPEN : 7 onglets fusionnes en 3 pages (SOUND, FX avec sous-pages RACK et HELL, SEQ) ; LIBRARY/DISK, MIDI et LEARN en touches permanentes du bandeau ouvrant un volet.
- Plus de trou pour l'ecran (copie du canvas LCD retiree) ; petit afficheur jaune canard dans le bandeau (parametre touche + valeur).
- Knobs SVG en relief ; parametres 2 a 4 positions en touches noires facon CHORUS avec LED ; selecteurs regles au glisser vertical (14 px par cran), plus de changement au clic simple.
- Double-clic sur la face avant ouvre OPEN sur la section correspondante ; le reset passe a Alt/Cmd/Ctrl + clic (le site garde son reset).
- HELL : delay + decaleur de frequence de Bode dans la boucle de feedback (plugin/mm-arp/dsp/Hell.{h,cpp}), 10 params extra (75 au total), knob HELL (mix) sur la face dans EFFECTS, 12 presets originaux, test DSP dedie (MIX 0 bit-exact, stabilite).
- FILTER + : HIGH PASS / COMB retires des 14 presets usine qui les activaient ; presets/build.mjs refuse desormais ces params ; SINGING COMB devient SINGING NOISE.
- Random hypnotique (src/v4/plugin/arp/hypno.ts) : styles HYPNOTIC, PULSE, ROLLING (cellule de 2 a 4 notes qui boucle, seule la fin varie).

### Decisions prises et pourquoi
- Echobode (Sonic Charge) et non Echoboy : correction de Mika ; noms et valeurs de presets originaux.
- Un preset HELL ne touche pas au MIX, sauf s'il est a 0 (passe a 35 % pour etre entendu).
- Cause FILTER + : DSP deja en vrai bypass a OFF, le probleme venait des presets usine.

### Ce qui reste a faire / points en suspens
- Mika : ecouter HELL, ses presets et SINGING NOISE (regles sans ecoute).
- Les projets Ableton deja sauves gardent leurs valeurs FILTER +.

### Commandes utiles ajoutees
- extra-gen --check et presets/build.mjs --check ajoutes au workflow plugin-arp.yml.

## 2026-11-16 : taille 2x persistante, OPEN Moog retro, clic = OPEN, arc de modulation

### Ce qui a ete fait
- Taille : setResizeLimits forcait 880 dans le constructeur et resized() le memorisait ; taille voulue lue avant, cle d'etat editorW5 (publie seul en 6d4d7cb).
- OPEN restyle en panneau Moog retro (src/v4/plugin/arp/retro/) : potard rendu depuis la vraie scene (retro/knob.png), vraie touche CHORUS (retro/key.png) pour 2 a 4 crans, petit selecteur rotatif pour 5 a 7, laque #23211f, joues bois, bandeau a touches + fenetre de verre. PCB, jaune canard et LCD moderne abandonnes.
- Clic simple immobile (< 3,5 px, < 250 ms) sur un potard de la face = OPEN sur sa section, sans changer la valeur ; glisser = rotation seule ; reset Alt/Cmd/Ctrl + clic ; fermeture CLOSE, Echap ou clic sur une joue.
- Arc lumineux de modulation (maquette A) : Voyager::modView (lecture seule), 12 valeurs modulees en atomiques, evenement mm_mod a 30 Hz depuis l'editeur ; couche SVG sur la face, rAF seulement si modulation ; tests modview_test et host.

### Decisions prises et pourquoi
- Mika : le look VST moderne d'OPEN jurait avec la face Moog ; retour a la DA de la face.
- Plage de l'arc estimee depuis les valeurs recues (min/max recents), pas une profondeur envoyee par le C++.

### Ce qui reste a faire / points en suspens
- Mika : verifier la vitesse d'ouverture d'OPEN sur le Mac et le seuil du clic (3,5 a 6 px = ni rotation ni ouverture).
- OSC MIX, DRIVE, AMP, PAN, PITCH sans arc (pas de potard correspondant).

### Commandes utiles ajoutees
- Test DSP modview_test dans plugin-arp.yml.

## 2026-11-16 (suite) : knobs facon MM-RYTM, selecteur PAGE, MODE en knob, retour a la face

### Ce qui a ete fait
- Knobs de la face et d'OPEN au dessin MM-RYTM (src/v4/voyager/rytmKnob.ts, knobLook.ts repris de la branche RYTM) : base ronde, prise noire 6 lobes, capuchon metal brosse, repere blanc d'un seul morceau, sans couronne de carres (l'arc lumineux reste).
- Navigation OPEN : selecteur rotatif PAGE (SOUND, RACK, HELL, SEQ) dans l'en-tete ; clic sur un nom, glisser, molette, fleches gauche/droite (sauf si un reglage a le focus). Menus haut/bas supprimes ; LIBRARY, MIDI, LEARN en bas a gauche.
- MODE (PING PONG / STEREO / WIDE) en selecteur rotatif a crans.
- En-tete : gros logo MAUDITE MACHINE + MM-ARP (clic = retour a la face), croix retro en haut a droite, Echap et CLOSE.

### Decisions prises et pourquoi
- Mika a choisi la maquette C (selecteur PAGE) et rejete le knob alu au profit du dessin RYTM.

### Ce qui reste a faire / points en suspens
- Camera ARP plus inclinee que RYTM : le capuchon masque une partie du repere vers le haut.
- Echap pendant l'animation d'ouverture : un echec sur trois en test, a surveiller.
- Suite : moteur de reverb facon BigSky (12 machines) + page REVERB.

## 2026-11-16 (suite 2) : reverb facon BigSky + page REVERB

### Ce qui a ete fait
- Moteur C++ porte depuis la reference JS (branche claude/gallant-franklin-3hka73, docs/vst3/sky-reference) : 12 machines (ROOM, HALL, PLATE, SPRING, SWELL, BLOOM, CLOUD, CHORALE, SHIMMER, MAGNETO, NONLINEAR, REFLECTIONS), FDN 8 lignes Householder, lecture Hermite modulee, amortissement 3 bandes cale sur le Tr60, diffuseurs, pre-delay glissant, premieres reflexions ; fondu de 20 ms sur changement de structure, rien d'alloue sur le thread audio.
- 11 params hote (section sky, dont 5 places xSkyP1..P5 selon la machine) ; xSkyType 0 = CLASSIC (ancien convolver).
- Page REVERB dans OPEN (SkyPage.tsx, sky.ts, skyModel.ts) : selecteur PAGE a 5 positions, clic sur le knob REVERB de la face = page REVERB, 12 touches TYPE, fenetre avec nom, enveloppe de queue et reglage touche, INIT, CLASSIC ; memoire par machine (mm.v4.plugin.arp.sky).
- Test sky_test dans plugin-arp.yml : Tr60 HALL/ROOM -2 a -4 %, energie 0.9 a 1.03, 12 machines bornees au max, independance aux blocs, CPU 3.6 a 7 % d'un coeur.

### Decisions prises et pourquoi
- Source : demande de Mika transmise par la session Reverb, confirmee par Mika.
- Projet neuf en HALL (DECAY 0.43 = 2.44 s) ; anciens projets, .mmarp et banque d'usine en CLASSIC (sans xSkyType) : aucun changement de son, tests bit-exact intacts.
- revSize/revTone/revPre/shimmer gardes pour CLASSIC (pas de migration).

### Ce qui reste a faire / points en suspens
- Mika : ecouter les 12 machines (jamais ecoutees).
- Cadre REVERB de la page RACK actif seulement en CLASSIC : a retirer ou annoter selon Mika.
- Changement de machine par automation/preset : la memoire par machine n'est pas rechargee (voulu).

### Commandes utiles ajoutees
- ./build-dsp/mmarp_sky_test (job dsp de plugin-arp.yml).

## 2026-11-16 (suite 3) : cuir, boutons realistes, navigation par touches

### Ce qui a ete fait
- Retrait du cercle orange de focus partout ; valeur sous le knob en gris discret pendant le reglage.
- Knobs OPEN regeneres en vue de dessus orthographique (concentriques) ; knob 3D de la face abaisse (RYTM_KNOB.h 0.27 -> 0.15) pour recentrer le capuchon.
- Fond cuir/tolex noir : normal map sur le capot 3D (texture generee, 512 px), image retro/leather.png dans OPEN.
- Boutons plus realistes : capuchon alu brosse bombe, jupe 40 cannelures, ombres ; touches caoutchouc avec arete et enfoncement ; LED a bague + lentille + halo (attenue).
- Navigation OPEN : selecteur rotatif PAGE remplace par 5 touches encastrees (SOUND, RACK, HELL, REVERB, SEQ) a droite des logos, page active allumee ; fleches du clavier, Echap, croix, CLOSE conserves.

### Decisions prises et pourquoi
- Mika a rejete la maquette facon Legend HZ (bandeaux metal, echelles) : on garde la face actuelle, seuls cuir et boutons changent.
- Navigation : variante C choisie par Mika.

### Ce qui reste a faire / points en suspens
- Fermeture d'OPEN parfois > 1,5 s en rendu logiciel : a verifier sur le Mac.
- Grain du cuir dans OPEN = image fixe (pas de relief eclaire).

## 2026-11-16 (suite 4) : cuir facon Legend HZ, panneau de reglages, clic limite aux knobs lies

### Ce qui a ete fait
- Cuir pleine fleur plus fin (grain ~2x plus fin, relief divise ~3, teinte ~#1A1817, ecart type du grain 2,8 contre 2,3-2,7 sur la reference), variations de lumiere larges, aretes sombres entre sections ; retro/leather.png regenere pour OPEN.
- Panneau de reglages (icone 3 curseurs pres de FIRMWARE et dans l'en-tete d'OPEN) : LEATHER TEXTURE (defaut 70, 0 = laque d'avant au pixel pres), PANEL LIGHT (defaut 50), RESET ; sauve dans l'etat de la face (projet), pas un param hote.
- Clic sur un knob de la face : seuls REVERB (page REVERB), HELL (page HELL), DELAY (RACK/DELAY) ouvrent OPEN ; les autres ne font rien au clic (glisser inchange). Table pageOf dans hellKnob.tsx.

### Decisions prises et pourquoi
- Mika : le cuir v20 etait trop gros et trop marque par rapport a Legend HZ ; il veut pouvoir l'attenuer.
- Mika : seuls les boutons qui ont une page liee doivent ouvrir OPEN.

### Ce qui reste a faire / points en suspens
- Ajouts possibles a pageOf : CUTOFF -> SOUND/FILTER, oscillateurs -> SOUND/OSCILLATORS, MOD -> SEQ/LFO, arpegiateur -> SEQ/ARP, VOLUME -> SOUND/MASTER.

## 2026-11-17 : OPEN dense, leviers et touches au clic, HELL facon Echobode, DISTO

### Ce qui a ete fait
- OPEN en 4 pages (SOUND, HELL, REVERB, SEQ) : le rack (DELAY, PHASER, FLANGER, CRUSH, PUMP) rentre dans SOUND ; clic sur DELAY de la face = SOUND, cadre DELAY.
- Petit knob fin rendu en 3D (three.js) pour les reglages secondaires ; levier chrome 3D a LED pour tous les reglages a 2 choix (clic = bascule) ; touches 3-4 choix : clic = cran suivant en boucle, clic sur nom/LED = ce cran, plus de glisser.
- HELL facon Echobode (DSP Hell.cpp/.h) : 12 params hote ajoutes en fin de liste (CROSS, HIGH-PASS, LOW-PASS, SMEAR, RANGE fine/wide/sync/midi, PHASE, ANTI REFL, LFO SHAPE/SYNC/AMOUNT/STEREO/TARGET) ; SIDEBAND reprend UP/DOWN (centre = R.M.) ; VU LFO alimente par mm_mod (hellLfo) ; migration des anciens projets (C++) et presets (face).
- Page HELL : FREQUENCY SHIFTER en vedette, VU, 24 presets (PREV/NEXT/INIT), MIX = knob HELL de la face (meme param xHellMix).
- Presets d'usine : HELL MIX 0 et reverb CLASSIC imposes au chargement ; presets/build.mjs refuse HELL actif ou reverb non CLASSIC ; presets utilisateur gardent leurs valeurs.
- OVERDRIVE renomme DISTO (plugin seulement, ID dist inchange).
- Tests : hell_test 24/24 (MIX 0 bit-exact, R.M. 0,0 dB, bande opposee -29,9 dB, ANTI REFL -21,2 dB, 16 cas au max crete 4,73, blocs bit-exact), suite DSP 20/20, host OK.

### Decisions prises et pourquoi
- Mika : HELL = Echobode a la sauce MM, presets dans la page, MIX lie a la face, HELL jamais actif dans les presets d'usine.

### Ce qui reste a faire / points en suspens
- Integration de la DISTO facon Decapitator (branche claude/admiring-feynman-5zsgxp) : demandee par Mika, a faire ici avec migration de xDist/xDistTone.
- Presets HELL regles sans ecoute ; RANGE MIDI mis a jour par bloc ; LFO SYNC non recale sur la mesure.

## 2026-11-17 (suite) : DISTO complete (Decapitator x Saturn x Trash), petit knob cannele, levier chrome

### Ce qui a ete fait
- DSP dsp/Decap : PRE FILTER -> saturation multibande (1 a 3 bandes) -> BOX -> POST FILTER -> DYNAMICS -> MIX -> OUTPUT, FEEDBACK, ENV -> DRIVE, LFO (5 formes, 6 cibles), MORPH entre styles ; 12 styles (A E N T P TAPE FUZZ DIODE AMP RECT FOLD CRUSH) + MM (defaut neutre) ; VU ATTITUDE reel (mm_mod distoVu).
- 42 params hote ajoutes en fin de liste ; DRIVE = dist ; ExtraTable regenere (150 reglages).
- Page DISTO dans OPEN (selecteur SOUND, DISTO, HELL, REVERB, SEQ) conforme a la maquette v24 validee, 20 presets, ecran TRANSFER ; clic sur DISTO de la face = page DISTO.
- Pedale DISTORTION (xDist/xDistTone) masquee : params hote gardes (OLD PEDAL, sans effet), conversion au chargement (PluginProcessor::convertPedal, disto.ts distoFromPedal) vers DIODE / DRIVE = xDist / MIX min(1,20*xDist) / AUTO / POST LP 700*(18000/700)^tone.
- Petit knob cannele et levier chrome (fondu 90 ms) partout.
- Tests : decap_test 47/47, suite DSP complete, host 43 controles, evenements 13/13, tsc 105, YAML valide.
- CPU : 1 bande x8 = 5,5 % d'un coeur ; pire cas 3 bandes ~14-15 % (x2/x4/x8 par bande, latence 32 echantillons).

### Decisions prises et pourquoi
- Mika a valide la maquette v24 et demande de masquer la pedale avec conversion.
- MM reste le style par defaut : projets et banque d'usine identiques au bit pres ; build.mjs refuse une DISTO non neutre.

### Ce qui reste a faire / points en suspens
- Projets convertis depuis la pedale : la DISTO est placee apres le moteur (la pedale etait apres CRUSH).
- Presets DISTO regles sans ecoute.
- La branche claude/admiring-feynman-5zsgxp (session Decapitator) est desormais remplacee par ce portage ; elle publie encore sur mm-arp-latest.

## 2026-11-17 (suite 2) : v27, encart EDIT synthe, EQ parametrique 6 bandes, page DELAY, accent #FFD900

### Ce qui a ete fait
- Face : encart EDIT = 8 sections synthe reglables (OSCILLATORS, OSC +, VOICE, FILTER, FILTER +, AMP, PERFORMANCE, OUTPUT) avec vraies zones de clic par piece et MIDI LEARN ; l'editeur de notes passe dans SEQ (piste NOTES).
- Face : DETUNE (pilote STACK) et SPREAD (pilote WIDE) ; petits knobs canneles pour FM, RATIO, OSC 1, OSC 2, NOISE, SUB, SUB WAVE ; SUB OCT en levier ; touches et pads reduits ; levier capsule chrome.
- Accent #FFD900 partout a la place de l'orange (PLUGIN_ACCENT) ; LED et RUN/STOP restent rouges.
- Taille par defaut 1870 (-15 %), cle editorW6.
- Page SOUND : EQ parametrique 6 bandes (BELL, SHELF, NOTCH, HP/LP 12/24/48 dB/oct), analyseur nourri par le C++ (calcule seulement page ouverte), ENGINE, MASTER, rack enrichi (PHASER, FLANGER, CHORUS, CRUSH, PUMP : 17 reglages nouveaux).
- Page DELAY (facon EchoBoy / H-Delay) : 8 styles, 5 modes (SINGLE, DUAL, PING-PONG, WIDE, RHYTHM), SYNC/FREE, NOTE, TAP, CHARACTER, VINTAGE, DUCKING, IN THE LOOP, GROOVE, PRIME, RHYTHM 16 prises (12 motifs), 20 presets ; clic sur DELAY de la face ouvre la page.
- 77 params hote ajoutes en fin de liste ; ancien DELAY garde en OLD, converti au chargement (convertDelay C++, face, build.mjs).
- Tests : echo_test 20/20 (11 empreintes au bit pres, conversion 72/72, MIX 0 40/40, temps exact, EQ mesure au sinus), suite DSP complete, host 51/51 (6 projets, 40/40 presets d'usine au bit pres), evenements 20/20 sans son, tsc 105, YAML valide.
- CPU : page DELAY pire cas 18,9 ms/s (DELAY du site 7,1), EQ 3,8 ms/s, analyseur 1,7 ms/s page ouverte.

### Decisions prises et pourquoi
- Mika a valide les maquettes v26 ("ok code et publie") et demande #FFD900.
- Conversion DELAY : TAPE >= 0,02 donne style TAPE + WOBBLE = TAPE + PING-PONG, sinon DIGITAL (STEREO devient DUAL) ; DLY TIME en SYNC ; FEEDBACK = 0,35 + 0,33 x DELAY ; le potard DELAY de la face devient MIX.
- Nouveaux modules neutres par defaut : projets et banque d'usine identiques au bit pres.

### Ce qui reste a faire / points en suspens
- Projet qui automatise le potard DELAY : FEEDBACK fige a la valeur d'ouverture (avant, il suivait le potard).
- Ancien EQ 4 bandes non converti : reste actif en coulisse (OLD EQ), la page SOUND affiche OLD EQ ON avec RESET.
- Choix pris sans validation : mode WIDE ajoute, RHYTHM par 12 motifs, FEEL +-6 %, GROOVE sans effet en SINGLE, echo max 2 s.
- Rack : PHASER/FLANGER SYNC suivent le tempo sans phase de mesure ; FLANGER DELAY peut cliquer en le bougeant.
- Crochet de test ?probe (window.__mmProbe) dans la face, a retirer si inutile.
- Presets DELAY regles sans ecoute.

## 2026-11-18 : v28, correctifs visuels, bascule animee, RANDOM et banque plus graves

### Ce qui a ete fait
- Listes deroulantes (TYPE de l'EQ, presets DISTO / HELL / DELAY) au premier plan (useRaise dans pcbui.tsx + z-index hood.css).
- OLD EQ ON / RESET deplace dans l'en-tete de l'ecran EQ, sans chevauchement.
- Logo et titre MM-ARP des pages OPEN a la taille et a la hauteur de la face (masque en 100 % auto).
- Bascule face <-> OPEN animee et rapide pour tous les declencheurs (re-clic d'onglet, CLOSE, croix, logo, Echap, OPEN, knob de la face) : carte 220 / 200 ms, capot 3D du plugin 240 + 30 ms (rig.ts, sous PLUGIN_ARP, le site garde ses durees) ; mouvement reduit = fondu 160 ms.
- Chevauchements corriges : FLANGER SYNC / THRU-0, CLR des pistes SEQ, DETUNE contre le filet, colonnes de la LIBRARY.
- RANDOM (hypno.ts, plugin seulement) par familles BASS / ARP / PAD / DARK (~40 % BASS), jamais OCTAVE +1, cutoff <= 0,62, resonance bornee ; HELL une fois sur trois, MIX 0,03 a 0,10 avec un reglage doux (hellGentle, hell.ts).
- Banque d'usine retravaillee : 40 presets (BASS 16, ARP 12, PAD 6, DARK 6), noms parlants, 7 presets avec une touche de HELL (MIX <= 0,10), volumes recales a -23 LUFS (PAD -25), centroide median 635 -> 450 Hz ; categories LIBRARY = BASS, ARP, PAD, DARK.
- presets/build.mjs refuse xHellMix > 0,10 (au lieu de != 0) ; regles reverb CLASSIC, DISTO neutre, ancienne pedale 0 gardees.
- Tests : tsc 105, suite DSP complete, host (anciens projets au bit pres, banque regeneree), presets-check, 16 controles Chromium muet, aucune lecture audio.

### Decisions prises et pourquoi
- Mika : une toute petite dose de HELL dans RANDOM et presets, sons moins aigus et souvent des basslines, logo du back a la taille de la face, bascule rapide mais animee.
- Re-clic sur l'onglet courant garde son role (retour a la face) mais avec l'animation.

### Ce qui reste a faire / points en suspens
- Ecouter RANDOM et la nouvelle banque (reglee par mesures, sans ecoute).
- Vitesse reelle du capot dans le WebView macOS non mesuree ; logo cale dans Chromium (+-1 px possible).
- Choix pris sans validation : poids des familles RANDOM, 7 presets avec HELL, categories LIBRARY renommees.

## 2026-11-18 (suite) : v29, fenetre 20 % plus petite

### Ce qui a ete fait
- PluginProcessor.h : kEditorDefaultW 1496 (1870 x 0,8), kEditorMinW 704 (880 x 0,8), kEditorMaxW 2640 (3300 x 0,8) ; PluginEditor.cpp utilise ces bornes.
- Cle d'etat editorW7 : un projet v26-v28 (editorW6) rouvre a 80 % de sa taille memorisee, un plus ancien a 1496.
- host_test : 1496 par defaut, taille choisie gardee, editorW6 1870 -> 1496, 3300 -> 2640, editorW5 -> 1496. Tout passe.

### Decisions prises et pourquoi
- Mika : "20% moins grand quand on ouvre le vst et 20% moins grand tout court" : defaut, minimum, maximum et tailles deja memorisees reduits de 20 %.

### Ce qui reste a faire / points en suspens
- Verifier la lisibilite a 1496 de large sur l'ecran de Mika ; la face suit seule (pas de borne cote web).

## 2026-11-18 (suite 2) : CI plus rapide

### Ce qui a ete fait
- plugin-arp.yml : le job mac ne attend plus dsp et host (il compile en parallele des tests) et passe par ccache (cache actions/cache ccache-mac-*) ; nouveau job publish (ubuntu) qui attend dsp, host et mac, recupere l'artefact et publie la release mm-arp-latest.

### Decisions prises et pourquoi
- Mika : 15 minutes pour une reduction de taille, c'est trop. Avant : 6,5 min de tests PUIS 6,5 min de compilation Mac. Maintenant : en parallele, et la compilation Mac ne refait que les fichiers touches. La publication reste bloquee si un test echoue.

### Ce qui reste a faire / points en suspens
- Premier run sans cache (~8 min) ; mesurer les suivants (attendu ~6-7 min, borne par les tests DSP).

## 2026-11-18 (suite 3) : v30, accent #FF0066

### Ce qui a ete fait
- theme/base.ts : PLUGIN_ACCENT #FFD900 -> #FF0066, PLUGIN_ACCENT_INK #7A6200 -> #A3003F (lisible sur fond clair).
- voyager/silk.ts : les arcs et pictos des selecteurs WAVEFORM (jaune Typhon 242,194,48) prennent l'accent dans le plugin ; le site garde son jaune.
- theme.ts PAD_GLOW : lueurs des pads du plugin au rose (faint, hover, active, flash, orange, orangeDim) ; le site inchange.
- hood.css : LED de pas de SEQ en degrade derive de l'accent (fini l'ambre #f0a51c) ; face.css : contour clavier en var(--mm-accent).
- Verifie : captures face + 6 pages, 0 pixel jaune restant ; tsc 105 ; aucun son.

### Decisions prises et pourquoi
- Mika : "a la place du jaune tu mets cette couleur FF0066". Les LED et RUN/STOP restent rouges.

### Ce qui reste a faire / points en suspens
- Le rose est proche du rouge des LED : a juger a l'oeil par Mika.

## 2026-11-18 (suite 4) : v31, compteur CPU, optimisation, ACCENT COLOR

### Ce qui a ete fait
- Compteur CPU de l'instance en haut a droite (face, a gauche de SETTINGS ; OPEN, a cote de SETTINGS) : mesure dans processBlock (getHighResolutionTicks), lissee 250 ms, pic tenu 1 s, ventilee MOTEUR / DISTO / DELAY / REVERB / HELL / EQ + RACK / RESTE ; envoi mm_cpu a 10 Hz ; un clic ouvre le detail (etages, pic, voix, HQ/STD, SR/bloc, rendu de la face). Accent au-dela de 50 %, rouge au-dela de 80 %.
- Banc tests/cpu_bench.cpp (option du banc hote) : INIT, 40 presets, pire cas, instances a l'arret, 48 kHz / 128.
- Optimisations : SSE4.1 sur x86_64 (au bit pres, moteur 5-8 % plus vite sur Intel) ; reverb CLASSIC recalculee sur un fil partage basse priorite (le thread du message ne bloque plus 6-40 ms par changement) ; rendu de la face plafonne a 30 images/s dans le plugin, arcs de modulation a 30 Hz.
- Curseur ACCENT COLOR dans SETTINGS (teintes vives a la luminosite de #FF0066, applique en direct, RESET -> #FF0066).
- Tests : tsc 105, suite DSP complete, host 52, Chromium muet 13/13 + 16/16, aucun son.

### Decisions prises et pourquoi
- Mika a gele son CPU : "compteur de cpu en haut a droite" et "optimise le Plugin !".
- Banc : le moteur HQ x8 fait 75-90 % de la charge (banque 16,3 % d'un coeur en HQ contre 11,0 % en STD ; nappes 46 % contre 28 %). QUALITY HQ laisse par defaut : passer en STD change un peu le son, a decider par Mika.

### Ce qui reste a faire / points en suspens
- Decision Mika : QUALITY STD par defaut, mode ECO, ou HQ seulement a faible polyphonie.
- Chiffres mesures sur un Xeon cloud et Chromium sans GPU : a confirmer avec le compteur chez Mika.
- Plafond 30 images/s : fluidite des potards et du capot a juger sur ecran 120 Hz.

## 2026-11-18 (suite 5) : v32, 8 voix, QUALITY ECO / STD / HQ, EXPORT HQ

### Ce qui a ete fait
- 8 voix pleines (plugin, option softVoices) : la 9e note efface en 5 ms la voix la plus faible en release (sinon la plus vieille) ; 12 emplacements ; MONO / LEGATO inchanges.
- QUALITY a 3 crans : ECO x2 (neuf), STD x4 (le site au bit pres, defaut des instances neuves), HQ x8 ; au-dela de 60 kHz chaque cran divise par deux. Migration : HQ reste HQ, STD reste STD, projet sans QUALITY -> HQ.
- EXPORT HQ (nouveau parametre hote en fin de liste, active par defaut) : le rendu hors ligne passe en x8, comme l'Offline accuracy de Diva.
- Moteur au bit pres : sinFast (fdlibm en ligne), triangle sans division hors des fronts : -4 % d'instructions moteur, sin -33 %.
- Mesures (banc, % d'un coeur) : cas de Mika 91,5 % (HQ, 12 voix) -> 71,9 % (HQ, 8 voix) -> 34,1 % (STD) -> 29,3 % (ECO). Profil par bloc : oscillateurs x STACK 53 %, filtres 17 %, voie droite du WIDE 7,5 %.
- Tests : tsc 105, suite DSP (voyager_compare 85/85), host 56, Chromium muet 5/5, aucun son.

### Decisions prises et pourquoi
- Mika : 8 voix ; "optimise chaque bloc, comme les autres plugins". STD par defaut en temps reel, HQ a l'export, comme u-he Diva.
- STD et HQ restent au bit pres (site et anciens projets).

### Ce qui reste a faire / points en suspens
- Objectifs non atteints (STD < 25 %, HQ < 40 %) : il faut des oscillateurs polyBLEP au taux de base et ne sureechantillonner que filtre / saturation / FM (ECO et nouveau HQ), son a valider a l'oreille. Estime -40 a -50 % sur le moteur.
- Multicoeur facon Diva evalue, non conseille pour l'instant.
- ECO non ecoute (repliement plus fort a x2 avec FM et SYNC).
- Une automation de QUALITY d'un ancien projet relirait 0 comme ECO.

## 2026-11-18 (suite 6) : v33, knobs a reflets, rotation fluide, cuir A

### Ce qui a ete fait
- Knobs de la face (voyager/knobs.ts, rytmKnob.ts, scene/renderer.ts, gates PLUGIN_ARP) : carte d'environnement studio (softboxes) reservee aux knobs, jupe vernie (clearcoat 1), capuchon d'alu plus metallique, cannelures au profil arrondi (fini le scintillement des aretes), anisotropie 16 sur le brossage.
- Rotation : 60 i/s pendant un mouvement de knob, une automation ou la bascule du capot, retour au plafond bas 250 ms apres ; l'angle glisse vers sa cible (~35 ms).
- Cuir : relief jusqu'a 2,6 x et satine ; LEATHER TEXTURE par defaut 0,45 (niveau A choisi par Mika).
- Inclus : f6ceb907 (autre session) : 5 presets HELL qui montaient descendent (SIDEBAND UP).
- CLAUDE.md : regle de clarte pour les choix A / B / C (une image par option, lettre sur l'image et en legende).
- Tests : tsc 105 ; MSAA x4 deja actif (pas la cause) ; cout de la face 1,2 ms/image au repos, 1,3 en rotation.

### Decisions prises et pourquoi
- Mika : knobs valides, cuir A, "code et publie" ; piste CPU B (moteur PRO partout, CLASSIC garde pour les anciens projets) lancee a part.
- Aliasing : cause principale probable le plafond a 30 i/s de la v31 (rotation par a-coups) et les aretes vives des cannelures.

### Ce qui reste a faire / points en suspens
- Juger l'aliasing a l'oeil sur Mac ; capuchon un peu plus sombre qu'avant (a eclaircir si besoin).
- Un projet qui a enregistre LEATHER a 0,7 le garde : RESET dans SETTINGS pour revenir au niveau A.
- Moteur PRO (piste CPU B) en cours.

## 2026-11-18 (suite 7) : v34, moteur PRO

### Ce qui a ete fait
- Selecteur ENGINE CLASSIC / PRO (SOUND > ENGINE, nouveau parametre en fin de liste, 229) : instance neuve en PRO, ancien projet en CLASSIC ; un preset d'usine ne change pas le moteur.
- CLASSIC inchange au bit pres (voyager_compare 85/85, 40 presets HQ identiques a la v32).
- PRO : oscillateurs au taux de base (polyBLEP, Catmull-Rom vers le taux du filtre), sauf FM / SYNC / RING ; filtre, saturation, VCA, voie droite, enveloppes, LFO, matrice a x1 (ECO), x2 (STD), x4 (HQ) ; sinus rapide (erreur < 4e-8) ; EXPORT HQ en x4.
- Banc pro_test dans la CI (stabilite, niveaux, repliement, cout).
- Mesures (cas de Mika, echelle v32) : CLASSIC HQ 71,9 % / STD 34,1 % ; PRO HQ 38,4 % (-47 %), PRO STD 21,1 % (-38 %), PRO ECO 17,3 %. Banque STD -29 %.
- Ecart de son PRO STD contre CLASSIC HQ : niveau +-0,37 dB au pire, rien sous 4 kHz, -1 a -1,5 dB a 8 kHz, -3 a -4,7 dB dans la bande 16 kHz.
- Tests : tsc 105, suite DSP + pro_test, host 58, aucun son.

### Decisions prises et pourquoi
- Mika : piste CPU B, "code et publie". Publication de la premiere etape de B (oscillateurs et filtre), le reste suit.

### Ce qui reste a faire / points en suspens
- Objectifs (PRO STD < 15 %, PRO HQ < 25 %) non atteints : reste de la piste B (modulations par paquets, SIMD 4 voix, pow / exp / tanh rapides), estime -25 a -35 % de plus.
- Aigu de PRO STD un peu plus terne (interpolation Catmull-Rom) : a ecouter (MUNICH BASS, STRING PAD, MOON ARP...), a corriger par un meilleur passage au taux du filtre.
- PRO ECO change le caractere de 21 presets.

## 2026-11-19 : v35, le cuir refait d'apres le fond de Legend HZ

### Ce qui a ete fait
- src/v4/voyager/leatherField.ts (nouveau, sans DOM ni three) : le calcul du cuir, des cellules allongees le long du pli (Voronoi a metrique etiree), le pli en biais qui tourne d'une zone a l'autre, sillons fins, grain fin, pores ; leatherBake en fait une photo (lumiere d'en haut a gauche).
- plugin/mm-arp/web/leather-gen.ts + npm run plugin:arp:leather : genere src/v4/plugin/arp/retro/leather.png (tuile de 1024 px en boucle, gris 8 bits, moyenne 23 / 255).
- src/v4/voyager/leather.ts (reecrit) : la photo posee en couleur du plan (toile commune, une copie de texture par plan), setLeatherPhoto / setLeatherAmount / onLeatherReady ; plus de carte de normales.
- src/v4/voyager/silk.ts : le plan de cuir en MeshLambertMaterial (mat, sans reflet), teinte reglee a la mesure (LEATHER.tone, gris neutre), nappes de lumiere par couleurs de sommets ; tout sous PLUGIN_ARP.
- src/v4/plugin/arp/look.ts : charge la photo, LEATHER TEXTURE a 100 au depart, version 2 des reglages (un reglage d'avant reprend le cuir de depart, teinte et lumiere gardees) ; LookPanel.tsx : la scene se redessine a l'arrivee de la photo.
- src/v4/plugin/arp/hood.css : la meme image dans OPEN (348 px, l'echelle de la face), nappes sombres adoucies.
- CLAUDE.md : la regle de clarte des choix A / B / C (ajoutee le 2026-11-18).
- Mesures (capture a la taille par defaut, ramenee a 2000 px) : Legend HZ 22-27 / 255, ecart-type 4,0-4,8 ; face 22-23 / 4,3 ; OPEN 22 / 4,0 ; avant (v34) 17-20 / 11.
- Tests : tsc 105 ; Chromium muet : 11/11 (curseur LEATHER, RESET, reprise des anciens reglages), suites v31 13/13 et v28 16/16 rejouees ; aucun son.

### Decisions prises et pourquoi
- Mika : "ca ne ressemble pas du tout a du cuir, je veux exactement le meme background que l'image 2" ; images AVANT / CIBLE / APRES envoyees etiquetees, validees ("ok publie").
- Cause du rate de la v33 : une carte de normales a cellules de 4 px, relief 2,6, eclairee par la scene = un bruit scintillant. Remplacee par une photo du cuir (rien ne scintille, moins cher a rendre).
- Materiau mat (Lambert) : sur un noir aussi profond le reflet d'un materiau standard pesait autant que la couleur et delavait le grain de moitie.
- Le cuir est recree (meme grain, meme teinte, meme contraste), pas le fichier de Legend HZ.
- LEATHER TEXTURE : 100 = ce cuir, plus bas l'attenue (le sens d'origine du reglage : attenuer).

### Ce qui reste a faire / points en suspens
- Rendu a juger sur le Mac de Mika (captures faites dans Chromium sans GPU).
- A petite taille de fenetre le grain s'adoucit (reduction de la texture).
- Moteur PRO : retour de Mika attendu sur l'aigu (v34), puis seconde moitie de la piste B.

### Commandes utiles ajoutees
- npm run plugin:arp:leather : regenere l'image du cuir (retro/leather.png) depuis leatherField.ts.

## 2026-11-19 (suite) : v36, plus de tache argentee sur la jupe des knobs

### Ce qui a ete fait
- src/v4/voyager/knobs.ts : envMapIntensity de la jupe des potards 1.8 -> 0.45 (le vernis et la rugosite inchanges) ; le capuchon d'alu garde ses reflets.

### Decisions prises et pourquoi
- Mika : "ya un reflet sur le top du knob, on peut voir un coin argente" : la grande softbox du studio (v33) se refletait en blanc sur la crete des lobes. Essais : un vernis plus satine grisait la jupe ; seule la force du studio a ete baissee.

### Ce qui reste a faire / points en suspens
- A juger sur le Mac de Mika en tournant les knobs.

## 2026-11-19 (suite 2) : v37, jupe des knobs mate, knobs des pages qui tournent vraiment

### Ce qui a ete fait
- voyager/knobs.ts : jupe des knobs de la face sans vernis ni reflet du studio (clearcoat 0, envMapIntensity 0, rugosite 0.7) ; le capuchon d'alu garde ses reflets.
- Pages OPEN : le potard est en deux couches, retro/knob-base.png (base, fixe face a la lumiere) et retro/knob-grip.png (la prise a six lobes, qui tourne avec la valeur, sans le liseré clair des cretes) ; le capuchon reste fixe. Les petits knobs fins tournent aussi. Ombre portee posee sur le potard entier (fixe).
- plugin/mm-arp/web/knob-split.py : la decoupe (phase des lobes trouvee par contraste, bord antialiase, base reconstruite sous la prise).
- Tests : tsc 105 ; capture d'un potard d'OPEN a min / milieu / max : la prise tourne de -135 a +135 degres ; aucun son.

### Decisions prises et pourquoi
- Mika : "toujours le relief lumineux sur le bord, j'en veux pas" (le reflet reduit de la v36 ne suffisait pas) et "dans les sous pages aucun bouton ne tourne vraiment physiquement".

### Ce qui reste a faire / points en suspens
- A juger sur le Mac de Mika. Retour attendu sur l'aigu du moteur PRO (v34).

## 2026-11-19 (suite 3) : v38, MIDI IN, plus de raccourcis, ENGINE dans SETTINGS, aigu du moteur PRO

### Ce qui a ete fait
- PluginProcessor.cpp/.h : MIDI IN (NOTES / ARP / LAYER) et HOLD, deux parametres neufs en fin de liste (231). ARP : les touches tenues font l'accord arpege (MODE, RANGE 1 a 3 octaves, OCTAVE ; RATE, GATE, pas de la face), l'horloge interne si Ableton est arrete, HOLD garde l'accord ; LAYER : l'arpege continue sous les notes. Tests host des trois modes.
- hooks/useKeys.ts : dans le plugin, plus aucune lettre ni chiffre ; Echap ferme les pages et menus.
- LookPanel.tsx : ENGINE (CLASSIC / PRO), QUALITY, EXPORT HQ, MIDI IN et HOLD dans SETTINGS ; icone hamburger (face et OPEN). HoodBoard.tsx : ces pieces quittent SOUND, le cadre restant s'appelle ANALYZER, l'EQ reprend ses 22 px.
- dsp/Voyager.cpp : moteur PRO, pre-accentuation a sept points des oscillateurs au taux de base (8 kHz a 0 dB, 16 kHz -0.46 dB en moyenne contre CLASSIC HQ, -3 a -4.7 dB avant). CLASSIC au bit pres (voyager_compare 85/85).
- voyager/rytmKnob.ts : texture du capuchon des knobs de la face en 1024 px (512 avant).

### Decisions prises et pourquoi
- Mika joue avec le clavier MIDI de l'ordi dans Ableton : les raccourcis lettres bloquaient ses notes.
- MIDI IN place dans SETTINGS, a cote du moteur : c'est un reglage d'instance, pas de son.
- L'aigu PRO : une pre-accentuation plutot qu'un polyphase, pour un cout quasi nul.

### Ce qui reste a faire / points en suspens
- Knobs d'OPEN a tres grande taille : images de 260 px a refaire en 1024 px (base, prise, capuchon) et fine-knob en 512 px.
- Les touches non utilisees qui remontent a Ableton : a tester sur le Mac (EDITOR_WANTS_KEYBOARD_FOCUS, focus de la WebView).
- 20 presets a plus de 0.5 dB sur une bande en PRO STD, surtout a 16 kHz quand FM, SYNC ou RING sont engages.
- A ecouter par Mika : PRO, MIDI IN ARP et HOLD.

## 2026-11-19 (suite 4) : v39, knobs d'OPEN nets a tres grande taille

### Ce qui a ete fait
- src/v4/plugin/arp/retro/knob-base.png, knob-grip.png, knob-cap.png : refaites en 1024 px (260 avant), rendues separement par three.js depuis les geometries et les peintures du potard de la face (voyager/rytmKnob.ts), vues exactement de dessus, fond transparent, meme cadrage (la boite = la base + 4 %). Poids : 79 + 56 + 402 Ko = 537 Ko.
- La prise : jupe mate (rugosite 0.7, ni vernis ni studio, comme la face v37), chanfrein des cretes peint comme le dessus (aucun liseré clair), un lobe sous le repere, le pied du capuchon sombre.
- plugin/mm-arp/web/knob-shots.ts (la scene) + knob-shots.mjs (esbuild, Chromium muet par Playwright, PNG ecrit en Node) ; npm run plugin:arp:knobs. knob-split.py (v37) n'est plus utilise.
- CSS inchange (background-size 100 %).
- Tests : tsc 105 ; build de la face, OPEN puis REVERB a 2640 px : gros plan DPR 5 avant / apres (le brossage du capuchon et le bord des lobes nets), DPR 2 avant / apres (ecart moyen 1,2 / 255), trois angles (min / milieu / max) : la prise tourne autour du centre (centre des trois images a 511,5 px exactement), sans bord visible. Aucun son (?mute=1, --mute-audio).

### Decisions prises et pourquoi
- Mika : "qu'ils paraissent toujours les memes" : l'exposition de chaque couche est calee sur les images de 260 px d'avant (meme gris moyen, mesure par anneaux a 260 px).
- La phase des lobes suit maintenant la geometrie (un lobe sous le repere) ; la decoupe v37 l'estimait par contraste, un leger decalage d'angle est donc possible par rapport a avant.
- fine-knob.png laisse tel quel (128 px) : son script de rendu (v25) n'est pas dans le depot, et le petit knob cannele de la face (faceExtras.tsx) n'a pas les memes proportions. A 2640 px il n'est agrandi que d'environ 1,1 fois.
- Pas de pngquant ni d'oxipng ici : PNG RGBA 8 bits, filtre choisi ligne par ligne, zlib 9.

### Ce qui reste a faire / points en suspens
- A juger sur le Mac de Mika a tres grande taille (captures faites dans Chromium sans GPU).
- fine-knob en 512 px si Mika le trouve flou (il faudrait refaire son modele).

### Commandes utiles ajoutees
- npm run plugin:arp:knobs : rend les trois couches des knobs d'OPEN dans src/v4/plugin/arp/retro (ou dans le dossier passe apres --).

## 2026-11-19 (suite 5) : v40, STOP sous Ableton, touches d'OPEN unies

### Ce qui a ete fait
- PluginProcessor.cpp : parametre ARP RUN (STOP / RUN, 1 par defaut) en fin de liste, automatisable, garde dans le projet. Ableton qui joue : STOP coupe l'arpege (12 ms, sauf notes MIDI tenues), RUN le relance au pas suivant de la grille d'Ableton. Ableton a l'arret : horloge interne comme avant.
- hood.css : touches d'OPEN unies et mates, coins arrondis 9 px, sans plateau ni arete ; allumees a l'accent avec halo (maquette A).
- Tests : host (STOP sous transport : -24.7 dB -> -115 dB, pause gardee, relance -25.3 dB), suite DSP, voyager_compare 85/85, tsc 105 ; aucun son.

### Decisions prises et pourquoi
- Mika : "STOP coupe meme si Ableton joue" ; touches : maquettes A / B / C envoyees etiquetees, A choisie ("A, code et publie").
- Relance au pas suivant (pas a la mesure) : retombe juste dans le motif d'Ableton.

### Ce qui reste a faire / points en suspens
- RANDOM : presets de reference de Mika attendus.
- Touches clavier renvoyees a Ableton (a tester sur le Mac).

## 2026-11-20 : v41 a v43, serigraphie nette, knobs = les PNG de Mika, touches en pilules

### Ce qui a ete fait
- v41 (voyager/pads.ts) : les touches de la face en pilules unies et mates (PILL_KEYS) ; v43 : de vraies pilules (bouts en demi-cercles), a leur taille, un noir un rien plus clair que le cuir (27 / 255, mesure sur 73.webp).
- v42 (voyager/silk.ts, rig.ts fitSilk, renderer.ts) : la serigraphie est retracee a la definition de l'ecran (taille de la fenetre x DPR, 400 ms apres un redimensionnement) ; ce qui bouge souvent (couronnes WAVE, LED, noms des touches) passe sur de petits encarts.
- v43 knobs (plugin/arp/vknob.ts, vknobFace.ts, faceExtras.tsx, hellKnob.tsx, pcbui.tsx) : les knobs de la face et des pages d'OPEN sont les PNG de Mika, leurs pixels, seulement decoupes au masque (plugin/mm-arp/web/vknob-cut.py, sources dans vknob-src/) :
  - mika-knob.png : tous les potards a capuchon de metal de la face (HELL compris), le PNG entier tourne ; aussi les grands knobs d'OPEN ;
  - le selecteur : WAVEFORM 1 / 2, RANGE 1 / 2 ; le PNG tourne, son capuchon reste fixe ;
  - le petit : FM, RATIO, OSC 1 / 2, NOISE, SUB, SUB WAVE, DETUNE, SPREAD et les deux FINE ; le PNG tourne, son capuchon reste fixe ;
  - 74.png (detoure de sa capture au disque, son ombre a part et fixe) : les tout petits knobs des pages d'OPEN.
  - Face : un quad par calque (InstancedMesh), texture premultipliee, chaine de reductions precalculee (Lanczos sur l'alpha premultiplie), ni lumiere ni courbe de tons ; ombre portee douce et fixe dessous. Le repere d'origine de chaque PNG est compense.
- v43 touches (pads.ts, silk.ts, rig.ts, faceExtras.tsx) : style de la rangee STYLE d'OPEN (73.webp) pour CLEAR, RANDOM, EDIT, RUN/STOP, PRESET, OPEN, CHORUS et SUB OCT : LED ronde au-dessus (rouge sombre eteinte, accent allumee), pilule pleine d'accent avec un halo a sa forme, nom en accent allume. RUN/STOP n'est plus rouge (accent quand l'arpege joue) ; SUB OCT redevient une touche (plus de levier) ; CHORUS s'allume en marche.
- Tests : tsc 105 ; build de la face ; captures Chromium muet (?mute=1, --mute-audio), aucune lecture.

### Decisions prises et pourquoi
- Mika : "je ne veux pas que tu redessines" : aucun pixel retouche, seulement des masques et des marges transparentes ; le redessin vectoriel essaye d'abord est abandonne.
- mika-knob.png tourne entier (son repere deborde sur le capuchon) ; le petit et le selecteur gardent leur capuchon fixe (decoupe au disque, un demi-pixel en dedans).
- Le commutateur MODE du filtre etait un potard a capuchon de metal : il prend mika-knob.png.
- L'encart d'EDIT (ses knobs) n'est pas touche (un autre chantier en cours).

### Ce qui reste a faire / points en suspens
- Agrandissement (le disque a l'ecran depasse le PNG), largeur de fenetre en px CSS, DPR 2 (en DPR 1 : jamais jusqu'a 2640) : mika-knob.png sur CUTOFF a partir de 1702 (VOLUME 2176, SEMI et les potards moyens 2497, les autres jamais) ; le selecteur et le petit jamais ; OPEN : le knob vedette de HELL des 1148 (x 1,3 a la taille par defaut), les grands knobs x 1,3 a partir de 2031, les autres grands a 2640 (1 pour 1), les tout petits a partir de 2221.
- Pas de halo sous la pilule allumee de CHORUS (seulement sous les touches du plateau).
- A juger sur le Mac de Mika (captures sans GPU).

### Commandes utiles ajoutees
- python3 plugin/mm-arp/web/vknob-cut.py : refait les calques des knobs (src/v4/plugin/arp/vknob) depuis les PNG de Mika.

## 2026-11-20 (suite) : v44, les 7 fondamentales sur les pads, la liste des presets a la souris et au clavier

- Pads du plugin : F#m, G#ø, A, Bm, C#m, D, E, F#m7 (les 7 degres de fa diese mineur dans l'ordre, puis i7). G#ø (G#m7b5)
  plutot que G#dim : il contient Bm et le F#, glisse vers iv / v / i. Le site garde ses accords (SITE_CHORDS).
- Compatibilite : les progressions gardees portent chordBank 2 ; sans marque, elles sont lues en indices du site et
  converties au chargement (TS arpProgOf, C++ parseProg / legacyFromLs, table {0,5,6,4,3,2,7,5}). Seul ecart : Dmaj7 devient
  D en CHORD BASIC / TRIAD. Aucun parametre hote ajoute.
- Liste des presets de l'ecran : un clic choisit, un second clic (450 ms) ou Entree charge, haut / bas naviguent, Echap
  ferme. Les touches ne sont prises QUE liste ouverte ; a la fermeture, la face envoie mm_keys {on:false} et
  PluginEditor::keysToHost() rend le focus a la vue JUCE (les touches repartent vers Ableton). A verifier sur le Mac.
- Rapport detaille : docs/reports/2026-11-20-mm-arp-accords-presets.md. tsc 105, voyager_compare 85/85, host 66 ok.

## 2026-11-20 (suite 2) : v45, banque d'usine refaite en synthe analogique sec, RANDOM aux memes regles

- Mika : "Tous les presets doivent sonner absolument parfait ! sans filtre pas trop aigu ... vraiment bon synth analog !
  evite les fx sur tous les presets ! ou des filtres, si tu en utilises alors pas trop intense !"
- src/v4/plugin/arp/analog.ts : les regles a un seul endroit (banque et RANDOM). Aucun effet (DISTO, CHORUS, DELAY,
  REVERB, TAPE, GLUE, SIDECHAIN, WARMTH, PHASER, FLANGER, PUMP, CRUSH, SHIMMER, HELL, RING, FOLD, HIGH PASS, COMB a 0) ;
  passe-bas seulement, CUTOFF 0.25..0.6, RES <= 0.45, ENV AMT <= 0.5, jamais ouvert au-dela de 6 kHz ; OCTAVE <= 0,
  RANGE <= 4', FM <= 0.2, NOISE <= 0.12.
- presets/build.mjs : 40 presets refaits (BASS 16, ARP 12, PAD 6, DARK 6), 6 renommes ; -23 LUFS (PAD -24). Les 40
  tiennent les cibles en CLASSIC HQ et PRO STD (crete < -4 dBFS, > 6 kHz < 0.36 %, bas-medium >= 35 %). Avant : 15 hors cibles.
- RANDOM (hypno.ts) : tire dans les plages de la banque, remet a 0 les effets du VST3 seul (HELL, PHASER, FLANGER, PUMP,
  CRUSH, SHIMMER, WARMTH, RING, FOLD, HIGH PASS, COMB). 60 tirages : 0 avec effets (60 avant).
- Outils : presets_render --bars --tail --csv, presets-check (nouvelles regles), tests/random-analog.{ts,mjs}.
- Ancienne regle de banque (HELL MIX <= 0.10, reverb CLASSIC, DISTO neutre) remplacee par : effets a 0, filtre modere.

## 2026-11-20 (suite 3) : v46, la vraie page DISTO (option A), PUNISH v2, CLEAN LOW, banque de 18

- Mika (v45 installee) : "je sais pas ce que tu as fait a Disto mais ya pas grand chose de change ! trop complexe" ; les
  refontes n'existaient qu'en maquette derriere des drapeaux d'URL. Choix de Mika : DISTO A, PUNISH "pas en rouge" -> C.
- Les quatre branches de maquettes (barre / SOUND / SEQ, DISTO, DELAY / REVERB / HELL) fusionnees dans la branche
  plugin (derriere drapeaux, sans effet) ; la maquette LFO d'EDIT, en conflit, est reportee a la main par son chantier.
- Page DISTO (DistoPage.tsx, disto2.css) : DRIVE en grand + PUNISH (levier OFF / ON en grand, LED a l'accent, jamais
  rouge), TRANSFER, STYLE en 4 familles (TAPE, TUBE, TRANSISTOR, DESTROY) + MM ENGINE, OUTPUT (MIX, OUTPUT, AUTO), VU
  ATTITUDE ; un seul EQ (LOW CUT + THUMP, TONE, HIGH CUT + STEEP, PRE, POST, CAB) ; CLEAN LOW (zone grisee tiree depuis la
  gauche du graphe : 2 bandes, la basse contournee) ; MOVE (ENV -> DRIVE, LFO RATE / SYNC / DEPTH / TARGET) ; presets en
  liste par famille. 53 reglages a l'ecran -> environ 17. EXTRA ON · RESET quand un reglage cache agit encore. DistoMock.tsx
  et ?distoMock supprimes.
- Nouveau parametre hote DISTO PUNISH (xDPunish2, indice 232) ; xDPunish devient OLD DISTO PUNISH (au bit pres, CLASSIC
  affiche, le premier appui passe en v2).
- PUNISH v2 (dsp/Decap.*) : +20 dB, snarl (+6 dB a 1,4 kHz, -3 dB sous 120 Hz), second etage dur asymetrique
  surechantillonne avec ADAA, compression legere, AUTO qui mesure (+3 dB au-dessus du son sans PUNISH, borne a 18 dB),
  plafond doux -0,3 dBFS, entree / sortie en 15 ms, sans latence. Mesure : +3,08 / +3,08 / +3,03 LU sur trois boucles,
  ecart max 0,63 LU sur 24 cas, crete -0,32 dBFS, aucun NaN. Cout : +19 % avec CLEAN LOW.
- CLEAN LOW : LOW CUT ne coupe plus que la bande saturee (seul changement de son pour un ancien projet en 2 bandes avec
  la basse contournee et LOW CUT engage).
- Banque DISTO : 18 presets facon Decapitator par famille (distoBank.ts) a la place des 20 de disto.ts ; PUNISH recales
  (PARALLEL SMASH +0,3 LU, PUNISH BASS +0,1, PUNISH ME 0,0), cretes <= -6,2 dBFS.
- Tests : decap_test (OFF et OLD au bit pres contre tests/decap_ref.cpp, +3 +/-1 LU, crete, NaN, clics, CLEAN LOW) ;
  host_test 233 reglages ; banque d'usine regeneree (seul ajout "xDPunish2": 0). tsc 105, voyager_compare 85/85.

## 2026-11-20 (suite 4) : v46 (meme build), HELL v2 reel, page A (le vortex)

- Mika : "Pareil pour Hell" (rien n'avait change), puis "pour Hell je veux le A".
- DSP : plugin/mm-arp/dsp/Hell2.{h,cpp}. Chaine CHOP, ECHO (Hell.cpp tel quel), WARP, SHATTER, METAL, SPIN, puis niveau,
  MIX et plafond doux -1 dBFS. MIX = descente (DESCENT : les cercles entrent l'un apres l'autre ; ALL : ensemble).
  Cale sur la position de l'hote (ppq), horloge propre a l'arret ; tirages par case, repetes toutes les 8 mesures (l'export
  rejoue pareil). Aucune allocation dans le thread audio, MIX glisse sur 20 ms, MIX 0 contourne au bit pres.
- 20 parametres en fin de liste : xHellV2 (233, OFF/ON) puis Warp ... Descent (252) ; 253 reglages. Projet d'avant (sans
  xHellV2) : ancien HELL au bit pres ; instance neuve : v2 ; preset disque d'avant avec HELL : ancien HELL.
- Page HELL = option A (HellPage2.tsx, hell2.css) : MIX au centre, six anneaux, cercles I a III a gauche, IV a VI a
  droite, presets ; levier V2. HellPage.tsx, hell2_proto.cpp et hell2-bank-gen.mjs supprimes.
- Banque HELL : 16 presets (THE DESCENT, TAPE DEATH, BARBER SPIRAL, STUTTER GOD, GLASS RAIN, SEASICK, ACID BATH, BLACK
  HOLE, CATHEDRAL OF RUST, HELICOPTER, MELTDOWN, VERTIGO, DEMON CHOIR, GLITCH PRIEST, LAST CALL, LSD).
- Mesures (48 kHz, 120 BPM) : cretes <= -1,00 dBFS sur 16 presets x MIX 25/50/75/100, aucun NaN (l'ancienne banque a
  MIX 50 : +5,1 dBFS, 23 sur 24 au-dessus de 0) ; sync mediane 0,33 (ancienne 0,22) ; difference entre presets
  mediane 0,99 (ancienne 0,85) ; cout 4,7 % d'un coeur au pire.
- Tests : hell2_test (MIX 0 au bit pres, descente, blocs 1/64/333 au bit pres, extremes, 44,1 et 96 kHz) branche au
  CI ; host_test (ordre des parametres, ancien HELL intact). Rapport detaille : docs/reports/2026-11-20-hell-v2-reel.md.
- Ecoute : 16 MP3 a MIX 75 % envoyes a Mika (hell-v2-ecoute.zip).

## 2026-11-20 (suite 5) : v47, DELAY A et REVERB A reels (EQ, WIDTH, DUCK, FREEZE de la reverbe)

- Mika : "reverb toujours aussi vide", "Reverb A aussi" ; DELAY : option A recommandee (echos facon Echo, petit ecran).
- 10 parametres en fin de liste (253 a 262, 263 reglages) : xSkyLoCut, xSkyLoSlope, xSkyMidHz, xSkyMidDb, xSkyMidQ,
  xSkyHiCut, xSkyHiSlope, xSkyWidth, xSkyDuck, xSkyFreeze ; neutres par defaut (anciens projets et banque au bit pres).
- DSP (ArpFx) sur le mouille de la reverbe, apres Sky / convolution et SHIMMER (CLASSIC compris) : EQ 3 bandes (ParamEq,
  contournee au neutre), WIDTH milieu / cote, DUCK (EchoDuck, retour 250 ms). Sky::setFreeze : gains du reseau a 1,
  entree coupee, en 50 ms (sans effet sur SPRING et CLASSIC). Aucune allocation dans le thread audio.
- mm_transport porte ppq et bpm : la tete de lecture du DELAY se cale sur l'hote (hostClock.ts).
- DELAY = option A (DelayPage2.tsx) : echos L / R sur la grille des temps, petit ecran avec presets dans le coin, RHYTHM
  (16 prises, un clic change de motif). Option B, mock et fx2.ts supprimes.
- REVERB = option A (SkyPage2.tsx, skyPost.ts, fxPages.css) : cascade 3D du Tr60 LOW / MID / HIGH, REVERB EQ a trois
  points (Maj ou molette = Q, Alt + clic = neutre), OUTPUT MIX, WIDTH, DUCK, FREEZE ; reglages sans effet grises.
- Mesures (sky_test section 6) : MID +6 -> +5,98 dB, -12 -> -11,94 ; LOW / HIGH CUT a -3 dB a la coupure ; WIDTH mono
  -149 dB sur le cote, 150 % +3,52 dB ; DUCK 100 % coupe le mouille pendant la note ; FREEZE 6 machines : -0,8 a -3 dB
  sur 40 s, sans NaN ni clic (NONLINEAR : la queue tardive seule, environ -15 dB) ; cout 0,7 a 1,6 % d'un coeur.
- Tests : rendus au bit pres contre l'ancien DSP (9 types x 3 blocs), suite CI complete, voyager_compare 85/85,
  host_test. Rapport detaille : docs/reports/2026-11-20-delay-reverb-v46.md.

## 2026-11-20 (suite 6) : v48, barre des pages C, SOUND A, SEQ refaite, LFO et FX MOD dans EDIT

- Choix de Mika : barre "je prefere C", "A pour sound", SEQ "fais encore mieux ! ... precis et aussi simple
  d'utilisation meme si nous avons plein de parametres, quelque chose d'intuitif". LFO dans EDIT : option B.
- Barre des pages (pages2.tsx / pages2.css) : touches mates, LED dans la touche, la page affichee a sa LED a l'accent ;
  ancienne barre (PageKeys) supprimee ; le compteur CPU ne bouge pas.
- SOUND A : EQ en haut (6 bandes), MASTER et ANALYZER a droite, PHASER / FLANGER / CHORUS / CRUSH / PUMP en colonnes,
  barres de titre facon Legend ; Maj + glisser ou molette = Q du point, Alt = fin ; 45 px d'air au-dessus du bandeau.
- SEQ : rangee de 16 LED commune (6 pastilles par pas : quelles pistes agissent), STEP 05 / 08 + PLAYING / REST /
  SKIPPED BY CHANCE / STOPPED, 6 pistes (NOTES, ACCENT, SLIDE, GATE, RATCHET, CHANCE) en onglets avec icone et LED,
  valeurs dessinees et ecrites ; clic = on / off, glisser vertical = valeur, en travers = crayon, clic droit ou double
  clic = remise a zero, poignee END = longueur, pas au-dela grises avec la raison, SHIFT < >, RANDOM doux, CLEAR, ligne
  d'aide. PROB -> CHANCE (libelle). C++ : mm_transport porte skip et dur (Arp, PluginProcessor, PluginEditor), avec ppq
  et bpm ; la LED reste allumee le temps du pas.
- Encart EDIT : bascule SYNTH | LFO | FX MOD ; LFO = LFO 1 (+ TARGET 2, DEPTH 2), LFO 2, HELL (HELL WARP + SPIN quand
  xHellV2 = ON, HELL LFO pour un projet d'avant), DISTO LFO ; FX MOD = PHASER, FLANGER, CHORUS, PUMP ; potards k1 de Mika.
- Aucun parametre hote ajoute. maquette.ts, ?mq et ?lfo supprimes. tsc 105, voyager_compare 85/85, host_test ok,
  arp_test (nouveau controle skip / dur).
- A verifier sur le Mac : les leviers de l'encart (essai automatique capricieux en rendu logiciel), le glisser vertical
  de NOTES (A3 -> A6 en 50 px, a adoucir si trop sensible), la langue des libelles (anglais comme le reste de la face).

## 2026-11-23 : v49, optimisation CPU et latence (LATENCY ZERO, face au repos)

- Mika : "Je voudrais que tu optimise a fond ! je veux soulager au max le CPU et eviter a tout prix la latence sur
  ableton le moins de ms possible."
- Nouveau parametre hote en fin de liste : xLatency (LATENCY EXACT / ZERO, indice 263, 264 reglages). Instances neuves
  et banque d'usine : ZERO ; projet d'avant (sans ce reglage) : EXACT, son son au bit pres (500 empreintes identiques a
  v48). Aucun preset (usine ou disque) ne change LATENCY : c'est un reglage de l'instance, touche dans SETTINGS sous
  ENGINE (sa propre ligne : la ligne ENGINE debordait a quatre).
- Latence : ZERO declare 0 echantillon a tout taux, temps reel et export (avant 16 / 19 / 21 selon QUALITY) ; la DISTO
  (+32) et WARMTH (+39) n'ajoutent plus de retard cache. Pire cas avant : 90 echantillons (2 ms) dont 71 non compenses
  par Ableton. Bug corrige : changer QUALITY ou ENGINE en jouant changeait la latence sans la declarer (EXACT la
  redeclare). Methode : demi-bandes RII a phase minimale (dsp/Halfband.h, facon HIIR, en double) a la place des
  decimateurs a phase lineaire ; DISTO multibande en phase, sec de MIX par le meme aller-retour. Ecart au son d'EXACT :
  0,024 dB au pire par tiers d'octave, repliement au pire -95 dB (mieux qu'avant).
- CPU moteur (ZERO) : effets lourds -22 %, DISTO -23 %, WARMTH -20 %, reverbe HALL par defaut -14 % (BigSky modulee par
  phaseurs), banque PRO -7 %, cas 8 voix de Mika -5 % (le moteur 8 voix reste l'essentiel : pow / exp / tan non touches,
  faute de garantie au bit pres), instance a l'arret -20 %. Le DELAY du site s'endort a envoi nul.
- CPU face : un seul evenement mm_tick par tick du C++ (seulement ce qui change ; au repos un appel par seconde), plus
  rien face cachee (mm_vis, isShowing ; minuteur a 4 Hz, analyseur coupe), scene 3D en pause sous la carte d'OPEN, ecran
  de la 808 desabonne, VU de la DISTO / tete du DELAY / anneaux de HELL dans leurs couches (loop30.ts). Repos : face
  fermee 142 -> 15 ms/s WebKit, pages OPEN SOUND / DISTO / REVERB / SEQ 600-1100 -> environ 9. Compteur CPU a 5 Hz.
- Defaut QUALITY garde a STD (PRO ECO : -27 % de CPU mais aigus nettement plus sombres, a proposer a Mika).
- Tests : CI DSP complete, voyager_compare 85/85 et --blocks, nouveau latency_test (workflow), host_test (6 controles
  v49), face 34/34 en Chromium muet, captures avant / apres identiques. tsc 105.
- Rapports detailles : docs/reports/2026-11-23-optimisation-dsp.md, docs/reports/2026-11-23-optimisation-face.md.
- A verifier sur le Mac : compteur CPU d'Ableton sur DELAY et HELL (composition GPU), la face qui se coupe bien fenetre
  recouverte, LATENCY affiche 0 dans Live (ancien projet : passer LATENCY a ZERO dans SETTINGS).

## 2026-11-23 (suite) : v50, LFO 1 a 4 et MOD MATRIX dans EDIT (option C), page SQ

- Mika (images 83 a 86) : "je voudrais que tous les LFo tu les mettes dans la partie du bas EDIT fait un classement et
  du rangement, je veux que les Lfo puissent etre assignable partout dans le plugin avec un target [...] SQ c'est le
  sequenceur [...] la meme chose que dans la page sequenceur mais en plus simple et plus petit". Maquettes A / B / C +
  SQ + VISEUR ; choix : "C et SQ ok, go". Contrat commun moteur / face (scratchpad v50/CONTRAT-v50.md), deux chantiers
  en parallele.
- 31 parametres hote en fin de liste (264 -> 295, dernier xMx8Amt) : xLfo1Sync / xLfo1Hz, xLfo2Sync / xLfo2Hz (FREE en
  Hz, 0.02 x 500^v ; SYNC par defaut = l'ancien), xLfo4Rate / Shape / Sync (nouveau LFO 4), puis 8 emplacements
  xMx{n}Src (14 sources : les 12 de xM + LFO 3 + LFO 4), xMx{n}Dst (champ "nsteps": 1024 : 0 OFF, 1..19 les cibles
  synthe de xM, 32 + k le reglage hote d'indice k), xMx{n}Amt (bipolaire, 0.5 = rien). LFO 3 = le LFO de la DISTO,
  devenu source globale.
- Table des cibles GENEREE (une source, extra-gen.mjs --check) : src/v4/plugin/arp/modTable.ts et
  plugin/mm-arp/src/ModTable.inc ; 205 cibles groupees OSC / FILTER / ENV / ARP / LFO / SOUND / DISTO / DELAY / HELL /
  REVERB / MASTER. Exclus : crans, leviers, xM* / xMx*, OLD (tape, xDist, OLD EQ), duck, xRevSize / Tone / Pre (la
  reponse CLASSIC se calcule hors du thread audio). KEY est bipolaire (-2,5 a +2,5 autour du do central).
- Compatibilite : rien n'est converti. Les anciennes routes (lfoDest / lfoAmt, xLfo1Dest2, xLfo2Dest, xDLfoTarget,
  xM1..6) restent actives avec leur code ; la face les montre comme "lignes liees" de la matrice quand elles ne sont
  pas neutres. 800 empreintes sur 800 identiques a v49 (50 scenes, CLASSIC / PRO, ECO / STD / HQ, blocs 37 / 128 /
  512, EXACT) ; voyager_compare 85/85 et --blocks ; un projet d'avant s'ouvre et sonne au bit pres. Un emplacement xMx
  vers une cible synthe = la meme ligne xM au bit pres (209 / 209).
- Moteur : cibles synthe calculees par voix ; les potards CUTOFF, RES, ENV AMT, FM, NOISE, RING, FOLD, COMB passent par
  ce chemin avec une echelle ; les autres cibles par un chemin generique par tranches de 32 echantillons, lisse (10 ms
  sur HELL), seulement quand un emplacement vise une cible generique. Aucun emplacement actif : cout +0,1 a +0,2 %.
  4 emplacements : +21 a +25 % en INIT, 8 : +31 a +37 % ; cas 8 voix de Mika + 8 emplacements : +17 a +19 %. LFO
  mesures au millieme (FREE 2,501 / 3,701 Hz, LFO 4 cale sur le transport). Nouveau test mod_test (26 controles, CI).
- Face, par defaut sans drapeau : bascule de l'encart SYNTH | LFO | SQ | FX MOD (ouvre sur LFO). Page LFO : LFO 1 a 4
  (SPEED, SHAPE, levier FREE / SYNC, forme avec point anime, vitesse ecrite a cote du titre) et MOD MATRIX 2 x 4
  (SOURCE, AMT, DESTINATION par familles, viseur), pagination au dela de 8 routes. Viseur : les potards ciblables de
  la face, de l'encart et de la page OPEN montree s'allument, ecran "CLICK A KNOB > LFO 1", clic = assigne sans bouger
  le potard ; Echap / second clic / EDIT baisse = annule. Arcs de modulation sur les cibles (mm_tick.m). La section MOD
  quitte la face (AMP EG descend) : plugin seulement, le site ne change pas. FX MOD : PHASER, FLANGER, CHORUS, PUMP +
  HELL WARP / SPIN (HELL v2) ou HELL LFO. Page SQ : 16 pas (NOTE, ACCENT, SLIDE, GATE / RATCHET / CHANCE), STEPS,
  RATE, SWING, RANDOM, CLEAR, partagee avec la page SEQ (seqEdit.ts) ; la matrice xM quitte la page SEQ. RANDOM laisse
  les emplacements a OFF ; un preset sans xMx les remet a OFF.
- CPU face au repos : 0 image/s face, SYNTH, SQ, face cachee ; 30 images/s page LFO (le point SVG seul).
- Fusion : params.ts n'importe plus theme/base (presets/build.mjs, fx-ref.mjs le lisent tels quels sous Node) : meme
  lecture de PLUGIN_ARP en local.
- Tests : CI DSP complete, mod_test, host_test, extra-gen / build.mjs / params-gen / hell-gen --check, face 43
  controles en Chromium muet (func.js 32, func2.js 11), tsc 105.
- Rapports detailles : docs/reports/2026-11-23-mod-matrix-dsp.md, docs/reports/2026-11-23-mod-matrix-face.md.
- A ecouter / verifier sur le Mac : HELL MIX module vite (carre), MASTER VOLUME module en carre, saut de phase du LFO 3
  quand la DISTO s'engage (lisse 1,5 ms), clic sur les fenetres de la matrice et viseur, Echap pendant une
  assignation, taille du menu DESTINATION, point des LFO cale sur la mesure, sensibilite de NOTE dans SQ, CPU reel
  avec 8 emplacements. Page SEQ : une bande vide reste sous ARP / LFO 1 + / LFO 2 (a retirer si Mika le veut).

## 2026-11-23 (suite) : v51, page SEQ sans bande vide

- Demande de Mika : "enleve aussi la bande vide dans la page SEQ" (la place laissee par la matrice partie dans l'encart
  d'EDIT en v50).
- src/v4/plugin/arp/pages2.tsx : les touches du sequenceur passent de 108 a 298 de haut (PAD_H ; zone de dessin 80 ->
  270), le cadre STEP SEQUENCER de 250 a 440 (SEQ_H), la rangee RANDOM / ARP / LFO 1 + / LFO 2 descend de 330 a 520 :
  bas du contenu a 638 pour un capot de 658. Les dessins des pistes suivent la hauteur (RATCHET mis a l'echelle, les
  autres l'etaient deja) ; le geste vertical (crayon, NOTE) gagne en precision.
- pages2.css : les six onglets de piste (NOTES a CHANCE) passent de 18 a 26 de haut et se repartissent sur toute la
  hauteur des touches.
- Rien ne change pour le son, les parametres hote (295), la page SQ de l'encart ni le site.
- Tests : tsc 105, face en Chromium muet (smoke 8 lignes, func.js et func2.js TOUT OK), captures des six pistes.

## 2026-11-24 : v52, tonalite au choix (2A), colonne des enveloppes (3C), ecrans a points (4A), LED en verre, banque techno

- Mika (images 87 a 91) : la barre des pages dure a attraper ("la fleche est juste sur le mot") ; "les presets ne sont
  pas assez bons ... super super bons ... s'associer facilement a de la musique techno" ; "pourquoi on a pas toutes les
  notes ?" ; trop d'espace sous FILTER EG / AMP EG ; la police des ecrans "intense et trop basique" ; les LED "rouge
  eteinte ... transparent, et quand on selectionne la couleur fondamentale choisie". Maquettes A / B / C envoyees pour
  les points 2, 3, 4 ; choix : 2A, 3C, 4A.
- Barre des pages : le vortex de HELL (hell2.css) debordait sur la barre et prenait la souris (SOUND, DISTO, DELAY : seul
  le mot restait cliquable). Vortex en pointer-events none, .mm-nv au-dessus des pages (z-index 30) ; 10 boutons x 6
  pages verifies par elementFromPoint.
- LED (face.css, hood.css, pages2.css, disto2.css, voyager/ledLens.ts nouveau, silk.ts led(), encart50.ts,
  faceExtras.tsx) : eteintes en verre clair neutre (bague, verre sombre, reflet), allumees a la couleur d'accent, en
  direct quand l'accent change ; plus aucune LED rouge (CHORUS I / II, SUB OCT, RANDOM, pistes et pas du SEQ, encart).
  Restent rouges (alertes, pas des LED) : OLD EQ ON / EXTRA ON, CPU en surcharge, zone rouge du VU, statut d'erreur.
- 4A, afficheur a points : Doto (SIL OFL 1.1) embarquee au plugin seul (plugin/mm-arp/web/fonts, index.html 'MM Dots',
  vite.config.ts), sans le point U+002E (celui de Doto se lit "+", 1/8. pointee) qui retombe sur SF Pro. dots.css :
  REVERB (machine, valeur), DELAY (temps L / R, ecran : titre, tempo, valeur), fenetre des presets HELL, ecran du bas du
  capot. Ecran LCD de la face (voyager/screen.ts, plugin seul) : accord, MM-ARP, tempo, valeur touchee ; FONT_LOADS
  attend 'MM Dots' dans le plugin. Petites etiquettes inchangees.
- 2A, tonalite au choix : xKey (12 crans C..B, depart F#) et xScale (MINOR, MAJOR, DORIAN, PHRYGIAN) en fin de liste,
  297 reglages ; reglages d'instance ("instance": true) : aucun preset (usine, disque) ni RANDOM ne les change, un
  ancien projet s'ouvre en F# MINOR. Tonique = 48 + xKey (C3..B3, F# retombe sur 54). Pads 1 a 7 = degres du mode,
  pad 8 = tonique a 4 sons (m7, maj7 en MAJOR), degre diminue en demi-diminue (ø), notation en dieses. Moteur :
  Params.cpp kKeyTable (48 tonalites), degreeMidi / poolSteps / arpProgram ; PluginProcessor (lecture, DRAG MIDI).
  Face : KeySelect.tsx (pastille "CHORDS F# MINOR" + menu), key.ts, pads, legendes, LCD (ligne du bas "A MINOR 8A"),
  pages SEQ et SQ. F# MINOR identique au bit pres (params_test : 3000 cas F# MINOR = base, + 48 tonalites).
- 3C, colonne des enveloppes : egScreen.ts / EgColumn.tsx : un verre entre FILTER EG et AMP EG qui dessine les deux
  enveloppes (FILTER a l'accent, AMP en pointille) avec la loi du moteur, un point qui suit la voix la plus recente
  (mm_tick.e : Voyager egView, PluginProcessor publishEg, six atomiques, rien au repos, 30 rAF/s en jeu, 0 au repos) ;
  dessous POLARITY (POS / NEG), KEY TRACK, ACCENT (petits potards k3), VOICE (POLY / MONO / LEGATO) : MIDI LEARN,
  INFOS, viseur (KEY TRACK code 80, ACCENT 81). Aucun parametre ajoute. Remise a la valeur de depart : Alt / Cmd /
  Ctrl + clic comme tous les potards de la face.
- Banque d'usine refaite pour la techno (presets/build.mjs, rapport docs/reports/2026-11-24-mm-arp-banque-techno.md) :
  40 presets, 124 a 132 BPM, BASS 12 / ACID 8 / SEQ 12 / CHORD 8 (library.ts) ; regles seches gardees (aucun effet,
  passe-bas modere) ; BASS et ACID en VOICE MODE MONO (analog.ts, presets-check, RANDOM). Mesures v45 -> v52 : sub
  < 100 Hz 19 -> 34 %, 200-400 Hz 22 -> 16 %, largeur < 120 Hz max 16 -> 4.8 %, > 6 kHz max 0.34 -> 0.07 %, -23 LUFS.
  Ecoutes MP3 (avec et sans kick) envoyees a Mika.
- Tests : tsc 105 ; extra-gen (297, 205 cibles), build.mjs --check, presets-check, presets-render x4 / x8 / PRO,
  random-analog ; CI DSP (voyager_compare 85/85), host_test, mod_test, modview_test ; face en Chromium muet : smoke,
  func, func2, funckey (24), egtest (43).

## 2026-11-25 : v53, banque dark disco (80), navigateur de presets (C), OPEN sans diode (A), reglage de vivacite

- Mika (v52 installee) : "le design est vraiment abouti je suis super content !" ; mais "la ou ya de la couleur que ce
  soit un peu plus voyant", "les selecteurs de formes d'onde sont peut-etre un peu trop fins", "les diodes dans OPEN je
  suis pas extra fan", "pas fan du tout des presets ... et de la facon dont je peux les selectionner". Questions
  posees : son des presets ("hypnotique, que je peux deformer ... dark disco, souvent une note repetee, Damon Jee ...
  Donna Summer ... Pablo Bozzi" ; pas son style), effets ("oui, doses, pas beaucoup ... des bons sons de base ...
  souvent des notes style basslines"), selection ("scroller et choisir en cliquant, mieux vaut avoir plus de choix"),
  diodes ("plutot sans diode"). Maquettes A / B / C : presets C, OPEN A ; couleurs : images A / B / C envoyees.
- Constat : la touche PRESET de la face montrait les 19 presets du SITE (state/factory.ts, presetMode 'voy'), pas la
  banque du plugin (seulement dans OPEN > LIBRARY).
- Banque d'usine v53 (presets/build.mjs, rapport docs/reports/2026-11-25-mm-arp-banque-dark-disco.md) : 80 presets,
  BASS 42 / SEQ 20 / LEAD 10 / PAD 8, 105 a 124 BPM (64 entre 115 et 123) ; notes repetees, galops munichois (dont un
  par le vrai echo a la double croche), octaves italo, basses caoutchouc / body / EBM / new beat ; sons de base au
  milieu de leurs courses. Regle "AUCUN effet" -> "effets legers bornes" (analog.ts ANALOG_FX : OVERDRIVE <= 0.25,
  GLUE <= 0.3, CHORUS I ou II, WARMTH <= 0.3, DELAY <= 0.3 cale au tempo, REVERB CLASSIC <= 0.18 courte, jamais sur une
  basse ; le reste a l'arret), RANDOM aux memes plafonds. LIBRARY : colonnes BASS / SEQ / LEAD / PAD qui defilent.
  host_test compte toute la banque (57 au bit pres avec l'ancien DELAY + 23 a page DELAY propre). Ecoutes MP3
  (seul, + kick et charleston, toute la banque) envoyees a Mika.
- Navigateur de presets (choix C : PresetBrowser.tsx, presetPanel.ts, presetBrowser.css, voyager/presetHook.ts,
  actions/presets.ts) : PRESET ouvre en grand la banque du VST3, une colonne par famille (LIB_CATS lu dynamiquement),
  molette, clic = chargement immediat (factoryLoad, UNDO), fleches, Echap ; USER = dossier disque (mm_presets) et
  presets du projet, SAVE / SAVE TO DISK / OPEN FROM DISK ; reglages d'instance intacts ; le nom du preset en tete du
  LCD (voyPatch.named) ; les presets du site ne s'affichent plus dans le plugin.
- OPEN sans diode (choix A, noled.css) : plus aucune diode dans les pages d'OPEN ; touche allumee pleine a l'accent ;
  titre de section actif, levier sur ON, cran choisi, page montree : le mot s'allume ; section a l'arret attenuee.
- Vivacite (voyager/vivid.ts, VIVID_LEVEL) : selecteurs de forme d'onde plus epais (arcs x1.5 / x2 / x2.4), halos,
  pads et touches au vrai accent (lueur apres la courbe ACES), LED, courbe d'enveloppe ; niveaux A / B / C proposes,
  fusionne au niveau 'off' en attendant le choix de Mika (une constante a changer).
- Tests : tsc 105 ; build.mjs --check (80), presets-check, presets-render x4 / x8 / PRO, random-analog ; CI DSP,
  host_test ; face en Chromium muet : smoke, func, func2, funckey, egtest, funcpb (navigateur) TOUT OK.

## 2026-11-25 (suite) : v54, double clic sur un knob = valeur de depart

- Mika : "quand on double clic sur un knob on reset ce meme knob". Avant : un clic seul sur un potard de la face ouvre
  OPEN sur sa page (HELL, REVERB, DELAY, DISTO ; 2026-11-16), la remise passe par Alt / Cmd / Ctrl + clic ; un double
  clic ouvrait la page sans rien remettre. Les potards des pages d'OPEN (PcbKnob) avaient deja le double clic.
- Face (ui/Hotspots.tsx tapDial et onDown, voyager/faceDbl.ts, plugin/arp/hellKnob.tsx) : le deuxieme appui moins de
  300 ms (FACE_DBL.ms) apres le premier lacher, sur le meme potard, le remet a sa valeur de depart. Mesure a l'heure
  des evenements (timeStamp), pas a l'heure du traitement. Un potard qui a sa page l'ouvre 300 ms apres le clic, le
  temps de voir si un deuxieme appui suit (il annule l'ouverture). Alt / Cmd / Ctrl + clic reste une remise.
- Ce qui n'est pas un potard garde son geste au clic : levier, touche a crans, segment de POLARITY / VOICE, onglets et
  fenetres de l'encart, viseur (faceExtras.tsx encartKnob, encart50.ts knob50). Les potards de l'encart (SYNTH, LFO
  SPEED / SHAPE, AMOUNT de la matrice, SWING, FX MOD) se remettent au double clic.
- Tests : tsc 105 ; dbl54/dbl.js (clics horodates par CDP : le rendu logiciel du conteneur met des centaines de ms par
  image) : CUTOFF, RES, REVERB (pas d'OPEN au double clic, OPEN au clic seul), HELL, KEY TRACK, ACCENT, un potard
  d'OPEN, DRIFT et LFO 1 SPEED de l'encart, levier SYNC (deux bascules), deux clics lents (rien), Alt + clic ;
  egtest.js mis a jour (il verifiait que le double clic ne faisait rien). Serie de la face en Chromium muet : smoke,
  func, func2, funckey, egtest, funcpb TOUT OK. Publiee : commit acc9464, zip 2026-11-25 16:43 UTC.

## 2026-11-25 (suite) : v55, vivacite des couleurs au niveau B

- Mika : "couleurs B" (images A / B / C de la v53). voyager/vivid.ts : VIVID_LEVEL = 'B', la face publiee par defaut
  (plus de drapeau d'URL a poser) : selecteurs de forme d'onde plus epais (arcs x2), halo de la forme choisie, encre de
  l'accent hors de la courbe ACES, pads et touches allumes a la teinte exacte de l'accent, LED, courbe d'enveloppe,
  arcs de modulation. Les potards (PNG de Mika), le cuir et les pages d'OPEN ne changent pas ; ?vivid=off|A|C reste
  pour comparer.
- Tests : tsc 105 ; face en Chromium muet sans ?vivid= : __mmProbe.vivid() = B, capture avec l'accent cyan de Mika,
  console sans erreur ; smoke.

## 2026-11-25 (suite) : v56, fiches INFOS de PRESET et de l'ecran

- Mika : "corrige aussi la fiche INFOS de PRESET". Depuis la v53, PRESET, l'ecran et sa pastille PRESETS ouvrent le
  navigateur ; les fiches decrivaient encore la liste de l'ecran du site (fleches, LOAD, SAVE, NAME, DEL, EXIT).
- voyager/infos.ts : fiches 'preset' et 'presets' du plugin (gate PLUGIN_ARP) reecrites (colonnes par famille,
  molette, clic = charge tout de suite, fleches, Entree, Echap, USER, SAVE, SAVE TO DISK, OPEN FROM DISK, tonalite et
  reglages d'instance intacts) ; voyager/diagrams.ts : browserDiagram (quatre colonnes BASS / SEQ / LEAD / PAD, le
  preset charge allume, la fleche de la souris, "CLICK: IT LOADS") au lieu des fleches et des quatre touches. Les
  fiches et le dessin du site ne changent pas.
- Tests : tsc 105 ; INFOS allume dans Chromium muet, survol de PRESET et de la pastille PRESETS : les deux fiches
  du navigateur, captures, console sans erreur.

- Publication : a72cdb5, zip pret a 18:36 UTC. Ecrase a 20:18 UTC par un build de main (ea86661, v53) : le workflow
  publie le dernier build de n'importe quelle branche. Republie par la fusion de main ci-dessous.

## 2026-11-25 (soir) : main refusionnee dans la branche, contexte.md a jour

- Mika : "pourrais tu update le contexte.md totale". contexte.md vit sur main (PR #13) : main fusionnee dans
  claude/nifty-bohr-7ixmpf (seul conflit : CLAUDE.md, version courte de main gardee, l'etat du plugin est dans la
  section 6 de contexte.md) ; firmware:stamp (sources de src/v4 changees en v54 a v56, versions inchangees, le site ne
  bouge pas) ; contexte.md : etat v56, piege de mm-arp-latest, releases publiques verifiees, attentes de Mika.
- Tests apres fusion : tsc 105 ; firmware:check OK ; npm run plugin:arp:web ; dbl54 (double clic) TOUT OK.
