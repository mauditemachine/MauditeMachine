# 2026-11-18 - MM-RAGE : la DISTO du MM-ARP en VST3 seul

Demande de Mika : « Titre MM-RAGE. Je voudrais que tu fasses l'équivalent de DISTO que j'ai mis dans ARP VST3, en VST3 aussi seul, avec une interface optimisée épurée de la taille de MM-HELL, pour que ce soit agréable à l'œil et facile d'utilisation. Si jamais tu ne peux pas, fais plusieurs pages avec des boutons design. Aussi je trouve qu'il y a de l'aliasing sur les knobs, j'aime pas ça. Je veux des beaux knobs Moog qui tournent bien avec des reflets etc. Je veux que le cuir noir soit plus apparent. » Et l'image 2 (la demande faite pour MM-HELL) : « que les knobs tournent vraiment ; plus de presets, complètement différents ; des knobs de tailles différentes selon l'importance ; un bouton settings dans un menu hamburger en haut à gauche, avec LEATHER TEXTURE, PANEL LIGHT, ACCENT COLOR ».

La DISTO vit dans le MM-ARP (branche `claude/nifty-bohr-7ixmpf`, `plugin/mm-arp/dsp/Decap.*` et `src/v4/plugin/arp/disto.ts`) ; MM-HELL (branche `claude/vibrant-ptolemy-dv2l0v`) a servi de modèle pour le plugin et la fenêtre. Ni l'un ni l'autre n'est sur `main` : MM-RAGE part de `main` et en copie ce qu'il faut.

## 1. Ce qui a été fait

- **Nouveau plugin `plugin/mm-rage/`** : un effet audio VST3 (stéréo, entrée mono acceptée), « Maudite Machine > MM-RAGE » dans Ableton, code fabricant `Mmch`, code plugin `Mmrg`, catégorie Fx Distortion, FIRMWARE V.1.0.
- **Le son** : `dsp/Decap.{h,cpp}` est une copie conforme de celui du MM-ARP v32, compilée avec les mêmes options (`-ffp-contract=off`, SSE4.1) : même son au bit près. `tests/decap_test.cpp` est la copie de son test (tout passe, aussi sous AddressSanitizer / UBSan).
- **Les réglages** (`dsp/RagePatch.{h,cpp}`, sans JUCE) : la DISTO complète dans les unités des paramètres (les lois du MM-ARP), `settingsOf` (patch + tempo vers le DSP), ce qui est grisé (la règle de `distoInert`), les textes (dB, Hz, %, Q, notes).
- **La banque : 85 presets en 9 familles** :
  - THE CLASSICS : INIT et les 20 de la DISTO du MM-ARP, valeur par valeur (`tests/presets_ref.inc`, tiré du vrai `disto.ts` par `tests/presets-ref.mjs`) ;
  - BUS & GLUE : BUS GLUE, TAPE MACHINE, CONSOLE CHANNEL, PARALLEL WARMTH, AIR EXCITER, LOW END GLUE, SOFT CLIPPER, VINTAGE DESK ;
  - DRUMS : KICK THUMP, SNARE CRACK, HAT SIZZLE, ROOM SMASH, BREAKBEAT DIRT, TRANSIENT BITE, 909 DIRT, TOM BOOM ;
  - BASS : ACID SQUELCH, SUB GROWL, REESE GRIT, TUBE BASS, FUZZ BASS, WOBBLE FOLD, DEEP DUB, RECTIFIED OCTAVE ;
  - SYNTHS : LEAD SCREAM, ANALOG HEAT, GLASS FOLD, ARP SHIMMER, CHORD STAB, DARK PAD, PLUCK SNAP, SINGING FEEDBACK ;
  - VOICE & RADIO : TELEPHONE, MEGAPHONE, AM RADIO, WALKIE-TALKIE, VOCAL EDGE, WHISPER GRIT, ROBOT VOICE, DEMON ;
  - LO-FI & TEXTURE : CASSETTE, DUSTY SAMPLER, 8-BIT CONSOLE, BLOWN SPEAKER, RINGING ROOM, FAX MACHINE, PAPER CONE, DIRTY DIGITAL ;
  - MOTION : PUMPING TUBE, FILTER SWEEP, GATED DIRT, MORPH CYCLE, RANDOM TONE, AUTO WAH, CLEAN UP, SLOW TIDE ;
  - DESTRUCTION : TOTAL CARNAGE, SPEAKER RIP, FEEDBACK SCREAM, NOISE WALL, FOLD STORM, SHREDDER, INDUSTRIAL, BLACK HOLE.
- **Le processeur** (`src/PluginProcessor.*`) : 54 paramètres automatisables avec leur texte, construits depuis une seule table (paramètre <-> patch) ; les 85 presets en programmes ; le tempo de l'hôte (LFO SYNC) ; l'ATTITUDE pour le VU ; l'état du projet (réglages, programme, taille de la fenêtre, page ouverte) ; 32 échantillons de latence déclarés, constants.
- **L'interface, native** (`src/PluginEditor.*`, `RageLook.*`, `RageControls.*`, `RageViews.*`), sans WebView, au plan de MM-HELL (1000 x 620, 1200 px à l'ouverture, 80 à 200 %) :
  - **quatre pages derrière des onglets design** (un plateau creusé, la touche de la page allumée à l'accent) : RAGE (STYLE en deux rangées CLASSIC / EXTENDED, l'écran TRANSFER, MORPH et MORPH TO, LOW CUT et THUMP, TONE, HIGH CUT et STEEP), SHAPE (PRE FILTER, BOX, POST FILTER, DYNAMICS, FEEDBACK, FB FREQ, l'écran RESPONSE), BANDS (BANDS, les coupures, la carte des bandes où on les tire, la matrice LOW / MID / HIGH), MOVE (ENVELOPE -> DRIVE, le LFO et sa forme sur une mesure) ;
  - **une colonne toujours là**, à droite : le VU ivoire ATTITUDE (-20 à +3 dB, zone rouge), le DRIVE (le plus gros potard, échelle en dB qui passe à 20..56 avec PUNISH), PUNISH, AUTO, MIX, OUTPUT ;
  - **les potards façon Moog**, dessinés en vectoriel (`paintMoogKnob`) : jupe noire, prise cannelée, dessus noir bombé, insert d'aluminium tourné calculé pixel par pixel à la résolution de l'écran (reflet en nœud papillon, sillons, chanfrein), repère gravé sur l'alu et crème sur le noir. Les cannelures et le repère tournent ; les ombres, le lustre et les reflets restent fixes sous la lumière. Six tailles selon l'importance (DRIVE 100, TONE 68, MORPH / ENV AMOUNT 62-66, LOW CUT / HIGH CUT / MIX / OUTPUT 58, FREQ / RESO 50, bandes 38), avec leur échelle sérigraphiée ;
  - **le cuir relevé** : la tuile du MM-ARP était presque unie (écart type 2,6 sur 255) ; son grain est contrasté (x 7) et éclairé d'en haut à gauche (relief), LEATHER TEXTURE à 100 au départ, un lustre doux par-dessus ;
  - **le menu hamburger en haut à gauche** : SETTINGS (LEATHER TEXTURE, PANEL LIGHT, ACCENT COLOR, RESET, comme le MM-ARP et MM-HELL), WINDOW SIZE, la ligne de firmware ; réglages gardés pour tous les MM-RAGE ;
  - ce qui ne fait rien tel que c'est réglé est grisé ; la bande d'info dit ce que fait la pièce survolée.
- **Bancs** (`tests/`) : `decap_test`, `presets_test` (banque = MM-ARP au bit près, familles, niveaux, diversité des signatures, stabilité de chaque preset au bruit fort puis au silence, textes), `host_test` (le vrai processeur, 10/10), `ui_test` (la vraie fenêtre, 15/15 : gestes, onglets, gris, carte des bandes, MORPH TO, SYNC, PREV / NEXT / INIT, automation, tailles, rotation des potards sous des reflets fixes, SETTINGS), `snapshot` (11 captures PNG).
- **CI** `.github/workflows/plugin-rage.yml` : DSP et banque (Linux, plus la comparaison à `disto.ts` quand la branche du MM-ARP est là), processeur et fenêtre sans hôte (Xvfb, captures en artefact `MM-RAGE-captures`), VST3 macOS universel signé ad hoc (artefact `MM-RAGE-macOS`), puis la release `mm-rage-latest` si tout est vert.
- `.github/workflows/plugin.yml` (MM-RYTM) : n'est plus déclenché par `plugin/mm-rage/**` (commit séparé, poussé seul avec `[skip ci]`).
- `plugin/mm-rage/README.md`, `INSTALL.md`, `update.sh`, `.gitignore`.

## 2. Décisions prises et pourquoi

- **Pages plutôt qu'une seule face** : la DISTO a 54 réglages ; dans 1000 x 620 tout tenait seulement en rapetissant tout (c'est la page du MM-ARP, dense). Mika l'avait prévu (« sinon plusieurs pages ») : quatre pages dans le sens du son, et ce qu'on touche tout le temps (DRIVE, MIX, OUTPUT, le VU) reste visible à droite.
- **Les potards sans image** : le crénelage venait de l'image du potard tournée (une image redimensionnée puis tournée se crénèle sur ses bords). Ici tout ce qui tourne est un tracé vectoriel lissé, à toute taille et tout angle ; l'insert d'alu ne tourne pas (ses reflets viennent de la lumière), il est calculé une fois par taille, au pixel près de l'écran, bord lissé par la couverture exacte. Un test vérifie que l'alu reste identique et que les cannelures bougent.
- **DRIVE 0 reste en circuit** (écart voulu avec le MM-ARP, où DRIVE 0 contourne la DISTO) : sinon le retard passerait de 32 à 0 échantillon à chaque passage par 0, ce que l'hôte ne peut pas compenser proprement. Le contournement, c'est le bouton de l'hôte ou MIX 0 (le sec retardé, au bit près).
- **Pas de style MM** : c'était l'OVERDRIVE du moteur du synthé, il n'existe pas dans un effet seul.
- **Le niveau de référence** : le même que la prise du MM-ARP (VOLUME 75 %, 0,371), pour que les presets du MM-ARP mordent pareil sur une piste qui crête vers -6 dBFS.
- **LFO SYNC et la note séparés** (comme MM-HELL) : l'automation est plus lisible.
- **Presets mesurés faute de pouvoir les écouter** : chaque preset est rendu sur une même matière (kick, charley, basse, un sinus tenu) et comparé par signature (niveau, brillance, grave, harmoniques, mouvement, crête). Neuf presets trop proches d'un autre ont été retravaillés (ROOM SMASH, TUBE BASS, ARP SHIMMER, CLEAN UP, DEEP DUB, SLOW TIDE, puis VINTAGE DESK, FILTER SWEEP, GATED DIRT). Les presets « radio » ou « téléphone », qui coupent le grave, ont reçu du gain de sortie (+2 à +7 dB) : sans le grave, ils restent entre -8,6 et +4 dB de l'entrée. Les 20 du MM-ARP ne sont pas touchés (SMALL RADIO reste le plus discret).
- **La référence des 20 presets** est tirée du vrai `disto.ts` de la branche du MM-ARP (Node 22 et `--experimental-strip-types`, sans rien installer ; le téléchargement d'esbuild a été refusé par le mode auto, cette voie est plus simple de toute façon).
- **Couleur d'accent** : #FF0066 au départ, comme toute la famille ; la capture SETTINGS montre le turquoise de Mika (teinte 168).

## 3. Ce qui reste à faire / points en suspens

- **Mika** : installer une fois le CI vert (`curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-rage-latest/update.sh | bash`), ouvrir MM-RAGE dans Ableton, tourner les potards (le rendu Moog et le cuir sont à juger à l'œil sur l'écran Retina), et **écouter les 64 nouveaux presets** : aucun son n'a été joué pendant les tests (règle du projet). Dire lesquels garder, lesquels refaire.
- Le build macOS n'a pas pu être fait ici (Linux) : c'est le CI qui le fait. Vérifier que la release `mm-rage-latest` apparaît.
- Validation par pluginval : non faite (comme MM-HELL).
- Le jour où le MM-ARP rejoint `main`, `dsp/Decap.*` pourra être partagé au lieu d'être copié, et le look (potards Moog, cuir relevé) pourra être porté à MM-HELL si Mika aime.
- Pas de presets utilisateur sur le disque (les presets d'Ableton font le travail), pas de compteur CPU dans la fenêtre (le pire cas de la DISTO, trois bandes et tout, coûte ~150 ms par seconde stéréo à 48 kHz sur la machine de test (Linux) ; une bande ~55 ms).

## 4. Commandes utiles ajoutées

- Installer ou mettre à jour MM-RAGE (Mac) :
  `curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-rage-latest/update.sh | bash`
- Tests du DSP et de la banque (sans JUCE) :
  `cmake -S plugin/mm-rage -B build-dsp -DMM_BUILD_PLUGIN=OFF && cmake --build build-dsp -j && ./build-dsp/mmrage_decap_test && ./build-dsp/mmrage_presets_test`
- La référence des 20 presets du MM-ARP : `node plugin/mm-rage/tests/presets-ref.mjs --check` (sans `--check` : régénère `presets_ref.inc`).
- Bancs sans hôte (processeur, fenêtre, captures) :
  `cmake -S plugin/mm-rage -B build-host -DMM_HOST_TEST=ON && cmake --build build-host -j --target mmrage_host_test mmrage_ui_test mmrage_snapshot`
  puis `./build-host/mmrage_host_test_artefacts/Release/mmrage_host_test`, `xvfb-run -a ./build-host/mmrage_ui_test_artefacts/Release/mmrage_ui_test` et `xvfb-run -a ./build-host/mmrage_snapshot_artefacts/Release/mmrage_snapshot snapshots`
- Workflow GitHub **Plugin MM-RAGE** (`.github/workflows/plugin-rage.yml`) : artefacts `MM-RAGE-macOS` et `MM-RAGE-captures`, release `mm-rage-latest`.
