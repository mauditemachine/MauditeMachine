# 2026-11-18 - MM-HELL : le HELL du MM-ARP en VST3 seul

Demande de Mika : « Echobod VST3 : je voudrais que tu fasses l'équivalent de Echobod que j'ai mis dans ARP VST3 en VST3 aussi seul avec une interface optimisée. »

« Echobod » = le module HELL du MM-ARP (façon Echobode de Sonic Charge : un décaleur de fréquence de Bode dans la boucle d'un delay). Le MM-ARP vit sur la branche `claude/nifty-bohr-7ixmpf` (v31), pas encore sur `main`.

## 1. Ce qui a été fait

- **Nouveau plugin `plugin/mm-hell/`** : un effet audio VST3 (stéréo, entrée mono acceptée), « Maudite Machine > MM-HELL » dans Ableton.
- **Le son** : `dsp/Hell.{h,cpp}` est une copie conforme de celui du MM-ARP v31 (commit 8e88e7f9), compilée avec les mêmes options (`-ffp-contract=off`, SSE4.1). Même son au bit près. `tests/hell_test.cpp` est la copie de son test (24/24).
- **Les réglages** (`dsp/HellPatch.{h,cpp}`, sans JUCE) : les 22 réglages du HELL dans les unités des paramètres, avec les lois du MM-ARP ; `settingsOf` (patch + tempo + note MIDI vers le DSP) ; les textes (Hz, ms, notes, R.M., degrés) ; la banque d'usine, portée de `src/v4/plugin/arp/hell.ts`.
- **Le processeur** (`src/PluginProcessor.*`) : 22 paramètres automatisables avec leur texte ; les 24 presets en programmes de l'hôte (un preset règle tout sauf MIX, et met MIX à 35 % s'il était à 0) ; le tempo de l'hôte (SYNC, RANGE SYNC, LFO SYNC) ; la dernière note MIDI reçue (RANGE MIDI) ; l'état du projet (réglages, taille de la fenêtre, programme). MIX 0 : contourné au bit près.
- **L'interface, native** (`src/PluginEditor.*`, `HellLook.*`, `HellControls.*`, `HellViews.*`), sans WebView. Elle reprend les vraies images de la face du MM-ARP (`assets/` : potard du MM-RYTM, capuchon, petit knob fin, levier chrome, touche, cuir, joues de bois), SF Pro Display et Robot Radicals. Disposition dans le sens du son :
  - en-tête : MAUDITE MACHINE, MM-HELL, la banque (PREV, la fenêtre qui déroule les 24 presets en deux colonnes, NEXT, INIT) ;
  - DELAY : DELAY (ms, ou notes avec SYNC), FEEDBACK, SYNC, CROSS ; IN THE LOOP : HIGH-PASS, LOW-PASS, SMEAR ;
  - FREQUENCY SHIFTER : RANGE en quatre touches à LED, le gros potard et son échelle (qui change avec RANGE), SIDEBAND (DOWN, R.M., UP), PHASE, ANTI REFL, SPREAD, la valeur en clair (en SYNC et MIDI : aussi les Hz réels, au tempo ou sur la note) ;
  - HELL : MIX et l'**ECHO MAP**, un écran qui montre chaque répétition (hauteur en Hz, niveau), calculée depuis les réglages : la spirale qui monte ou descend, ce que les filtres de la boucle retirent, ce qui se replie sous 0 Hz, les deux canaux avec SPREAD ou CROSS, l'action du LFO ;
  - LFO : SHAPE (touches avec les formes dessinées), RATE (Hz ou notes), SYNC, AMOUNT, STEREO, TARGET, le VU ivoire à aiguille ;
  - la bande d'info : la pièce survolée, sa valeur, ce qu'elle fait (et l'option survolée pour RANGE, SHAPE, TARGET) ; le tempo et la note MIDI reçue.
- **Les gestes de la face du MM-ARP** : glisser vertical (160 points pour toute la course, Maj : 4 fois plus fin), molette, double-clic ou Alt + clic = valeur par défaut, clic sur levier et touches. L'automation bouge les pièces.
- **Taille** : un plan de 1000 x 620 mis à l'échelle, 1200 px de large à l'ouverture, de 80 % à 200 % par le coin, jamais plus grand que l'écran, gardée dans le projet.
- **Bancs** (`tests/`) : `presets_test` (la banque = celle du MM-ARP, valeur par valeur, référence `presets_ref.inc` tirée de `hell.ts` ; le sens de chaque décalage mesuré sur le DSP ; stabilité des 24 presets ; textes), `host_test` (le vrai processeur sans fenêtre, 8/8), `ui_test` (la vraie fenêtre, gestes de la souris vers les paramètres, 11/11), `snapshot` (captures PNG). Tout passe aussi sous AddressSanitizer / UBSan (DSP et banque).
- **CI** `.github/workflows/plugin-hell.yml` : DSP et banque (Linux), processeur et fenêtre sans hôte (Linux, Xvfb, captures en artefact `MM-HELL-captures`), VST3 macOS universel signé ad hoc (artefact `MM-HELL-macOS`), puis la release `mm-hell-latest` si tout est vert.
- `plugin/mm-hell/INSTALL.md`, `update.sh`, `README.md`.
- `.github/workflows/plugin.yml` (MM-RYTM) : n'est plus déclenché par `plugin/mm-hell/**` (commit séparé, poussé seul avec `[skip ci]`).
- **Identité (précision de Mika : « c'est un plugin Maudite Machine, au lieu de MM-ARP, MM-RYTM, ce sera MM-HELL »)** : MM-HELL est un produit de la famille, au même titre que MM-RYTM et MM-ARP. Éditeur « Maudite Machine » et code fabricant `Mmch` comme eux, produit « MM-HELL » (Ableton : Plug-Ins > Maudite Machine > MM-HELL), release `mm-hell-latest`. L'en-tête porte la ligne de firmware des machines : « FIRMWARE V.1.0 / 2026 » (version du projet CMake, `MMHELL_VERSION`). L'interface ne cite plus le MM-ARP (aide de la banque : « The MM-HELL bank »), INSTALL.md et README présentent MM-HELL comme le produit, et le MM-ARP seulement comme l'origine du moteur.

## 2. Décisions prises et pourquoi

- **Interface native plutôt que WebView** (le MM-ARP est une page web dans une WebView) : c'est « l'interface optimisée ». Pas de moteur web par instance (on peut en mettre sur plusieurs pistes), ouverture immédiate, quelques Mo de mémoire. Le fond, le texte fixe et chaque pièce sont dessinés une fois à la résolution réelle de l'écran (fenêtre x Retina) et gardés. Le minuteur à 30 i/s ne redessine que le VU quand l'aiguille bouge et ce qui a changé. Le look reste celui du MM-ARP : mêmes images, mêmes couleurs (`hood.css`), même typo.
- **Plus dense que la page HELL du MM-ARP** : la page OPEN laissait de grands vides (VU isolé, presets dans une colonne). Ici la banque monte dans l'en-tête, SPREAD rejoint le décaleur (il agit surtout sur lui), RANGE / SHAPE / TARGET passent en touches à LED (un clic, l'état se lit d'un coup d'œil), et la place libérée accueille l'ECHO MAP.
- **ECHO MAP ajouté** : il n'existe pas dans le MM-ARP. Il rend visible ce qu'on entend (spirale, filtres, repliement), sans rien demander au fil audio : il est calculé depuis les réglages, seulement quand ils changent.
- **Cinq presets corrigés** (écart voulu avec le MM-ARP) : BARBER DOWN, ABYSS, DEEP STAIRS, SULFUR RAIN et HELLFIRE SWELL combinaient un décalage négatif et la bande DOWN. Les deux signes s'annulent : ces presets **montaient** alors que leurs noms disent qu'ils descendent. L'ECHO MAP l'a montré, le DSP l'a confirmé (un 1 kHz sort à 1018, 1140, 1055, 1024, 1040 Hz). Ici SIDEBAND passe sur UP, le décalage reste négatif : ils descendent, et leur ANTI REFL (prévu pour une descente) s'enclenche enfin. `presets_test` le vérifie pour tous les presets. Le MM-ARP n'a pas été touché : une tâche séparée est proposée pour le corriger aussi.
- **Paramètres séparés** pour SYNC et la note du DELAY, et pour SYNC et la note du LFO (dans le MM-ARP, un seul réglage à crans) : l'automation est plus lisible. Mêmes valeurs, mêmes lois.
- **TONE et LFO DEPTH** (gardés dans le MM-ARP pour les vieux projets) ne sont pas exposés : neutres, comme dans tous les presets.
- **MIX à 35 % à l'ouverture** : dans le MM-ARP, HELL est coupé par défaut. Ici, c'est l'effet seul, on doit l'entendre dès qu'on le pose. Les réglages par défaut sont ceux d'INIT.
- **RANGE MIDI** : le plugin accepte le MIDI. La dernière note reçue reste après son relâchement (comme dans le MM-ARP).
- **Textes de l'interface en anglais**, comme la face du MM-ARP (INFOS, descriptions des presets).
- **Workflow MM-RYTM** : la release `mm-rytm-latest` est aujourd'hui construite depuis la branche du MM-ARP, plus récente que `main`. Sans l'exclusion, le premier push de MM-HELL l'aurait remplacée par une MM-RYTM plus ancienne.

## 3. Ce qui reste à faire / points en suspens

- **Mika** : installer (`curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-hell-latest/update.sh | bash`) une fois le CI vert, puis l'**écouter** dans Ableton. Aucun son n'a été joué pendant les tests (règle du projet). Les presets restent ceux du MM-ARP, réglés sans écoute.
- **Mika** : vérifier dans Ableton le routage MIDI vers MM-HELL (piste MIDI, MIDI To : la piste de MM-HELL, puis MM-HELL) pour RANGE MIDI. Le code le gère, mais un effet VST3 qui reçoit du MIDI n'a pas été essayé dans Live ici.
- **Validation par pluginval** (le validateur de plugins de Tracktion) : non faite. Le mode auto a refusé d'exécuter le binaire téléchargé. À lancer si tu veux une validation de plus (voir commandes ci-dessous), ou à ajouter au CI.
- **Le MM-ARP** : appliquer la même correction aux cinq presets (tâche proposée « Fix the 5 MM-ARP HELL presets that rise instead of fall »).
- Pas encore de presets utilisateur sur le disque (comme la colonne DISK du MM-ARP) : les presets d'Ableton (disquette de la barre du plugin) font le travail. À ajouter si besoin.
- Pas de compteur CPU dans la fenêtre (le MM-ARP v31 en a un).
- Le jour où le MM-ARP rejoint `main`, `dsp/Hell.*` pourra être partagé entre les deux plugins au lieu d'être copié.

## 4. Commandes utiles ajoutées

- Installer ou mettre à jour MM-HELL (Mac) :
  `curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-hell-latest/update.sh | bash`
- Tests du DSP et de la banque (sans JUCE) :
  `cmake -S plugin/mm-hell -B build-dsp -DMM_BUILD_PLUGIN=OFF && cmake --build build-dsp -j && ./build-dsp/mmhell_hell_test && ./build-dsp/mmhell_presets_test`
- Bancs sans hôte (processeur, fenêtre, captures) :
  `cmake -S plugin/mm-hell -B build-host -DMM_HOST_TEST=ON && cmake --build build-host -j --target mmhell_host_test mmhell_ui_test mmhell_snapshot`
  puis `xvfb-run -a ./build-host/mmhell_ui_test_artefacts/Release/mmhell_ui_test` et `xvfb-run -a ./build-host/mmhell_snapshot_artefacts/Release/mmhell_snapshot snapshots`
- Workflow GitHub **Plugin MM-HELL** (`.github/workflows/plugin-hell.yml`) : artefacts `MM-HELL-macOS` et `MM-HELL-captures`, release `mm-hell-latest`.
- Validation optionnelle (Mac, avec pluginval installé) : `pluginval --strictness-level 10 --validate /Library/Audio/Plug-Ins/VST3/MM-HELL.vst3`
