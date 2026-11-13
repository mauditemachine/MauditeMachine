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
