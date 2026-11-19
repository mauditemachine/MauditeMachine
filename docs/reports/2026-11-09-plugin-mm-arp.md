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
