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
