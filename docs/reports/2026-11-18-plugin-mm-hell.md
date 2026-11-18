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
- **Bancs** (`tests/`) : `presets_test` (la banque = celle du MM-ARP, valeur par valeur, référence `presets_ref.inc` tirée de `hell.ts` ; le sens de chaque décalage mesuré sur le DSP ; stabilité des 24 presets ; textes), `host_test` (le vrai processeur sans fenêtre, 8/8), `ui_test` (la vraie fenêtre, gestes de la souris vers les paramètres, 10/10), `snapshot` (captures PNG). Tout passe aussi sous AddressSanitizer / UBSan (DSP et banque).
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

## Suite (v1.1) : potards qui tournent, 48 presets, menu SETTINGS

Demande de Mika : « que les knobs tournent vraiment ; plus de presets, vraiment plus, complètement différents ; des knobs comme l'image 1 (le potard du MM-RYTM) de tailles différentes selon l'importance, pas comme l'image 2 (le petit knob cannelé) ; un bouton settings dans un menu hamburger, à gauche, avec ces paramètres (l'image 3 : LEATHER TEXTURE, PANEL LIGHT, ACCENT COLOR) ».

### 1. Ce qui a été fait

- **Les potards tournent** (`src/HellControls.cpp`, `Knob`) : le corps du potard du MM-RYTM (base, prise à six lobes, repère) tourne avec la valeur ; le capuchon de métal brossé reste fixe par-dessus (sa lumière ne tourne pas, comme un vrai potard éclairé d'en haut) ; l'ombre reste fixe. Le corps est mis à l'échelle une fois, à la résolution de l'écran, puis dessiné tourné.
- **Un seul modèle, six tailles selon l'importance** : le décaleur 120, MIX 80, DELAY et FEEDBACK 60, RATE et AMOUNT 54, les réglages fins 44 (HIGH-PASS, LOW-PASS, SMEAR, SIDEBAND, PHASE, SPREAD). Le petit knob cannelé est retiré (`assets/fine-knob.png` supprimé). Chaque potard a ses bouts de course (OFF / 4K, 300 / OFF, 0° / 360°…).
- **48 nouveaux presets** (`dsp/HellPatch.cpp`), 72 au total, en 8 familles : THE CLASSICS et MORE HELL (les 24 du MM-ARP), puis six familles de 8 :
  - SPACE & DUB : DARK DISCO THROW, WAREHOUSE, SPACE TAPE, DUB TECHNO CHORD, SLAPBACK, HAAS WIDENER, BASS SAFE DUB, HYPNO THROW ;
  - METAL & RESONATORS : STEEL STRING (une corde accordée en La), IRON BELL, GONG CHAMBER, TIN ROBOT, SPRING TANK, ANVIL, GLASS TUBE, RUSTY PIPE ;
  - MOTION : WIDE CHORUS, JET FLANGER, BARBER FLANGE (flanger sans fin), PHASE WASH, ROTARY, VIBRATO, DOPPLER RIDE, SEASICK ;
  - SPIRALS & ALIENS : SHEPARD RISE, SHEPARD FALL, VORTEX, DALEK, ALIEN RADIO, LASER FIGHT, SONAR, WORMHOLE ;
  - HARMONIC & RHYTHM : FIFTH LADDER, OCTAVE CLIMB, SUB SHADOW, HARMONIC CHOIR (les quatre suivent la note MIDI : chaque répétition monte dans les harmoniques de la note), STUTTER, TEMPO SIREN, POLYRHYTHM, RANDOM ARP ;
  - TEXTURES & DRONES : FROZEN LAKE, INFINITE DESCENT, BLACK HOLE, SPARKLE DUST, UNDERWATER, HAUNTED HALL, BROKEN MACHINE, ACID WATER.
- **La banque** se déroule en 4 colonnes, une section par famille ; la fenêtre montre le numéro et la famille (« 49 / 72 SPIRALS & ALIENS »).
- **Le menu** (trois traits, en haut à gauche, le wordmark décalé à droite) : SETTINGS, WINDOW SIZE (80, 100, 120, 150, 200 %), la ligne de firmware.
- **Le panneau SETTINGS** (`HellViews.cpp`, `SettingsPanel`), dessiné comme celui du MM-ARP (`LookPanel.tsx`, `face.css .mm-look`) : LEATHER TEXTURE, PANEL LIGHT, ACCENT COLOR (la roue des teintes vives et sa pastille), RESET ; glisser, molette, double-clic = valeur de départ ; un clic dehors le ferme. Mêmes lois que `look.ts` et `accent.ts` : cuir 0,7 au départ, lumière 0,5 neutre, teinte 336 = #FF0066 (TSV 100 %, 100 %).
- **La couleur d'accent** est réglable partout : LED, valeurs, sélections, échelle, ECHO MAP, banque, menus (`hl::accent()`).
- **FIRMWARE V.1.1** (version CMake 1.1.0).
- **Bancs** : `presets_test` (72 presets, les 24 premiers = MM-ARP, 8 familles, noms uniques, sens des décalages, niveaux, stabilité), `host_test` (72 programmes), `ui_test` (tailles des potards ; SETTINGS : rails, double-clic, RESET, clic dehors ; 12/12), captures (`10-settings`, `11-iron-bell`, `12-fifth-ladder`).

### 2. Décisions prises et pourquoi

- **« Tourner vraiment »** : avant, l'image du potard restait fixe et seul le repère bougeait (comme dans le MM-ARP). Maintenant les lobes tournent avec le repère. Le capuchon ne tourne pas : son reflet de métal brossé vient de la lumière, qui ne bouge pas.
- **Presets mesurés faute de pouvoir les écouter** : chaque preset est rendu sur un même son (dent de scie de 220 Hz et coup de bruit), et j'ai comparé leurs signatures (durée, brillance, dérive de hauteur, largeur stéréo, mouvement). Trois paires trop proches ont été retravaillées : TREMOLO SHIFT, trop proche de DALEK, est devenu DOPPLER RIDE ; RANDOM ARP et WORMHOLE ont été éloignés de SULFUR RAIN et VORTEX ; TEMPO SIREN a été rendu plus vif. Niveaux mouillés : de -14,8 à +2,6 dB de l'entrée, crête max 1,7 (`presets_test` borne à -20 / +6 dB). Aucun ne saute au visage.
- **Le sens suit le signe** pour les nouveaux presets (SIDEBAND UP, décalage négatif = descente) : la leçon des cinq presets corrigés.
- **Les presets MIDI** (HARMONIC) : un décalage égal à une fraction de la note jouée tombe sur ses harmoniques (0,5 x : quinte, octave, tierce… ; 1 x : octave, puis quinte au-dessus). Sans MIDI routé, le décalage reste à 0.
- **SETTINGS pour tous les MM-HELL** et gardés sur le Mac (`~/Library/Application Support/Maudite Machine/MM-HELL.settings`), pas dans le projet : c'est l'aspect de l'atelier, pas un réglage de son ; toutes les fenêtres ouvertes suivent tout de suite.
- **PANEL LIGHT un peu plus marqué qu'en CSS** (x 1,7) : dans le MM-ARP la variation s'applique deux fois (laque et cuir) ; ici une seule couche.

### 3. Ce qui reste à faire / points en suspens

- **Mika** : installer la v1.1 (même commande `update.sh`), tourner les potards, ouvrir le menu, essayer SETTINGS, et **écouter les 48 nouveaux presets** (réglés et mesurés, jamais écoutés). Dire lesquels garder, lesquels refaire.
- Les presets HARMONIC ont besoin d'une note MIDI routée vers MM-HELL.

## Suite (v1.2) : logos Maudite Machine, Montserrat, potards Moog, cuir

Demandes de Mika : « ce sont les logos que tu dois utiliser pour toutes les machines (image 1 : le logo, image 2 : le M, un peu n'importe où dès qu'il y a de la place) ; pour le nom des machines, Montserrat, bold, -3 px de letterspacing » ; puis « de l'aliasing sur les knobs, je n'aime pas ; je veux des beaux knobs Moog qui tournent bien avec des reflets ; je veux que le cuir noir soit plus apparent ».

### 1. Ce qui a été fait

- **Logos** : les fichiers du site (`public/logo/mauditemachine-logo.svg`, le logo sur deux lignes, et `mauditemachine-logotype.svg`, le M) copiés dans `assets/`, dessinés en vectoriel (`hl::drawLogo`). Le logo empilé remplace le wordmark en police Robot Radicals dans l'en-tête ; il signe aussi le VU (à la place du texte MAUDITE MACHINE). Le M : en haut à gauche du FREQUENCY SHIFTER (une place libre) et au bout de la bande d'info.
- **Le nom MM-HELL** en Montserrat Bold (`assets/Montserrat-Bold.ttf`, licence OFL jointe), serré (`hl::nameFont`), avec FIRMWARE V.1.2 dessous.
- **Potards façon Moog** (`paintMoogKnob`, `HellControls.cpp`), dessinés en vectoriel à la résolution de l'écran : plus d'image tournée (c'est elle qui crénelait). Jupe noire mate éclairée en haut à gauche, prise cannelée (28 à 40 cannelures selon la taille) qui tourne : chaque arête s'éclaire selon son orientation face à la lumière fixe, les reflets défilent quand on tourne ; plateau satiné, repère blanc et son ombre ; capuchon d'alu brossé calculé pixel par pixel (reflets coniques, brossage radial), fixe. Les images `knob.png` et `knob-cap.png` sont retirées.
- **Cuir plus apparent** : le grain de `leather.png` (gris de 15 à 27 sur 255) est contrasté x3.2 au chargement, en luminance seule (la teinte vient de la laque), la tuile passe de 256 à 320 points, et LEATHER TEXTURE est à 100 par défaut.
- Version 1.2.0, bancs à jour (`ui_test` : RESET ramène le cuir à 100).

### 2. Décisions prises et pourquoi

- **L'interlettrage** : -3 px sur un nom de 30 px collait les lettres (HELL se touchait). Ta maquette Figma montre -5 %, soit -3 px pour 60 px : c'est cette proportion qui est appliquée (-0,05 em), quelle que soit la taille.
- **Les noms des fichiers** : `mauditemachine-logo.svg` est le logo sur deux lignes (ton image 1), `mauditemachine-logotype.svg` est le M (ton image 2).
- **Le capuchon** : les secteurs tracés et les anneaux de brossage fins moiraient (des tourbillons « empreinte digitale ») ; le calcul pixel par pixel donne un alu propre. Il n'est fait qu'une fois par taille.
- **MM-ARP et MM-RYTM** ne sont pas touchés ici : MM-ARP vit sur sa branche, et la face du MM-RYTM est aussi celle du site. Une tâche séparée est proposée (« Apply Maudite Machine logos and Montserrat names to MM-ARP and MM-RYTM »).

### 3. Ce qui reste à faire / points en suspens

- **Mika** : réinstaller (même commande `update.sh`) et juger les potards, le cuir, les logos et leurs places.
- La tâche des logos pour MM-ARP et MM-RYTM, et la question : faut-il changer aussi les faces du site, ou seulement les plugins ?
