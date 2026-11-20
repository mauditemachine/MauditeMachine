# 2026-11-20 - MM-ARP v44 : maquettes DELAY, REVERB, HELL et plan HELL v2

Phase maquette et plan, rien de publié. Demande de Mika du 2026-11-20 : DELAY "la page entière doit être optimisée"
(le graphisme d'Echo d'Ableton, un petit écran façon écran principal, pas au milieu), REVERB "vraiment très léger, il
faut quelque chose qui claque", HELL "la botte secrète de tout le plugin, intense, chaque preset différent, en sync".

## 1. Ce qui a été fait

- Maquettes en code, sur la vraie face, deux options par page, choisies par l'adresse : `?fx2=A` ou `?fx2=B`. Sans ce
  paramètre (le VST3 ne l'a jamais), les pages d'avant s'affichent, inchangées.
  - `src/v4/plugin/arp/fx2.ts` : la variante, les réglages de maquette (les réglages qui n'existent pas encore côté
    DSP : une valeur en mémoire, aucun son, jamais envoyés au C++), le crochet de capture `window.__fx2`.
  - `src/v4/plugin/arp/fx2Lcd.tsx` : le petit écran du style de l'écran principal (noir, os en trois intensités, SF Pro).
  - `src/v4/plugin/arp/DelayPage2.tsx` : DELAY A et B, la vue des échos (L / R, grille des temps, tête de lecture au tempo).
  - `src/v4/plugin/arp/SkyPage2.tsx` : REVERB A (cascade 3D de la queue) et B (la salle vue de dessus), l'EQ de la reverb.
  - `src/v4/plugin/arp/hell2.ts` : HELL v2, les six cercles, la loi de la descente, les 19 réglages neufs proposés, la
    banque de 16 presets (lue telle quelle par le prototype).
  - `src/v4/plugin/arp/HellPage2.tsx` : HELL A (le vortex) et B (l'escalier).
  - `src/v4/plugin/arp/fx2.css` : tout le CSS neuf (hood.css non touché).
  - Branchements : `DelayPage.tsx` (aiguillage), `HoodBoard.tsx` (aiguillage REVERB et HELL), `SkyPage.tsx` (cinq
    fonctions exportées, rien d'autre).
- Prototype HELL v2 hors ligne (C++, rendu en mémoire, aucun son joué) : `plugin/mm-arp/tests/hell2_proto.cpp` et
  `plugin/mm-arp/tests/hell2-bank-gen.mjs` (non branchés au CMake ni au CI). Il entoure le vrai `dsp/Hell.cpp` des cinq
  cercles neufs et mesure niveau, crête, plafond, queue, largeur, sync, distance entre presets, CPU.
- Images (scratchpad v44) : delay-A/B, reverb-A/B, hell-A/B et les trois AVANT, la lettre écrite en gros sur chaque image.

## 2. Décisions prises et pourquoi

### DELAY (aucun paramètre neuf)

- Le cadre TIME / REPEATS / STYLE du milieu disparaît ; ce qu'il disait passe dans le petit écran, posé dans un coin
  (A : en haut à droite ; B : en bas à gauche), avec les presets (PREV, NEXT, INIT ; la pastille PRESETS ouvre la liste).
  Comme l'écran principal : en tête le nom et le preset, le tempo ; la valeur en grand (le temps : 1/8.) ; une fiche
  FEEDBACK, REPEATS, MODE, STYLE, MIX ; un potard touché prend la place de la valeur en grand.
- La vue des échos (l'idée d'Echo, pas son interface) : les impulsions qui décroissent en dB réels (-60 dB en bas) sur
  la grille des temps en mesures (1, 1.2, 1.3...), L et R séparés (PING-PONG alterne), le son sec en blanc, la courbe de
  décroissance en pointillé, les temps L et R en grand à gauche, une tête de lecture qui court au tempo. La durée montrée
  s'adapte (2, 4, 8 ou 16 temps) pour que les échos remplissent l'écran. A : miroir (L au-dessus, R dessous) ;
  B : deux pistes comme une bande, les répétitions numérotées.
- RHYTHM n'a plus son cadre : en mode RHYTHM, l'écran des échos montre les seize prises, un clic change de motif.
- Pages rangées en trois rangées lisibles : TIME / FEEDBACK MIX / MODE, puis STYLE / CHARACTER (LOFI et ANALOG y
  entrent), puis IN THE LOOP / GROOVE (PRIME y entre) / DUCKING.

### REVERB : inventaire des paramètres hôte

| Réglage page | Paramètre | Ce qu'il fait (DSP d'aujourd'hui) |
|---|---|---|
| MIX | `reverb` (potard REVERB de la face) | l'envoi |
| TYPE | `xSkyType` | CLASSIC (la convolution du site) puis 12 machines |
| DECAY | `xSkyDecay` | le vrai Tr60 (TIME sur NONLINEAR, SIZE en pieds carrés sur REFLECTIONS) |
| PRE-DELAY | `xSkyPre` | v² s (FEEDBACK sur MAGNETO et NONLINEAR) |
| TONE (= le DAMP) | `xSkyTone` | amortit les aigus de la queue (hiMul, hiHz) et ferme le passe-bas de sortie (900 Hz à pleine bande) |
| MOD | `xSkyMod` | la modulation des lignes |
| LOW END | `xSkyLow` | coupe-bas d'entrée (320 à 18 Hz) et durée des graves |
| SIZE, MID, DWELL... | `xSkyP1` à `xSkyP5` | les réglages propres à la machine (HALL : MID, SIZE CONCERT / ARENA ; ROOM : SIZE STUDIO / CLUB...) |
| CLASSIC | `xRevSize`, `xRevTone`, `xRevPre`, `xShimmer` | la reverbe d'avant |

Ce que Mika demande et ce qui manque : DECAY, PRE-DELAY, MIX existent ; DAMP existe sous le nom TONE (il fait les deux :
l'amortissement et le passe-bas) ; SIZE n'existe que par machine (à crans) ; il manque l'EQ, WIDTH, DUCK, FREEZE.

Paramètres neufs proposés (EN FIN de liste ; tous neutres par défaut : projets et banque d'usine au bit près) :

| Paramètre | Loi | Défaut |
|---|---|---|
| `xSkyLoCut` | LOW CUT 20 Hz (OFF) à 2 kHz, 20 x 100^v | 0 (OFF) |
| `xSkyLoSlope` | 12 / 24 dB par octave | 12 |
| `xSkyMidHz` | MID 200 Hz à 8 kHz, 200 x 40^v | 0.5 |
| `xSkyMidDb` | GAIN -12 à +12 dB | 0.5 (0 dB) |
| `xSkyMidQ` | Q 0.4 à 4, 0.4 x 10^v | 0.3 |
| `xSkyHiCut` | HIGH CUT 1 kHz à 20 kHz (OFF), 1000 x 20^v | 1 (OFF) |
| `xSkyHiSlope` | 12 / 24 dB par octave | 12 |
| `xSkyWidth` | 0 (mono) à 150 %, 100 % à 0.5 | 0.5 |
| `xSkyDuck` | la reverb baisse sous le son sec, 0 à 100 % | 0 |
| `xSkyFreeze` | OFF / ON | OFF |

DSP à ajouter (ArpFx.cpp, étape 5, après le fondu Sky / convolution et SHIMMER, donc CLASSIC en profite aussi) :
- l'EQ : une instance de `ParamEq` à trois bandes (HP 12/24, BELL, LP 12/24) sur le mouillé ; neutre = contournée
  (ParamEq::bypassed) ; coût estimé ~2 ms/s (l'EQ 6 bandes de SOUND : 3.8 ms/s) ;
- WIDTH : milieu / côté sur le mouillé, sauté à 100 % ;
- DUCK : la même enveloppe que le DUCKING du DELAY (le sec pilote le gain du mouillé) ;
- FREEZE : Sky seulement (gains du FDN à 1, entrée coupée, amortissement levé ; grisé sur CLASSIC) ;
- pas de SIZE continu : changer la taille du réseau passe par le fondu de 20 ms qui vide les lignes (des trous en le
  tournant) ; SIZE reste le réglage à crans des machines qui l'ont ;
- pour les dessins : facultatif, un niveau du mouillé par mm_mod (`skyVu`) pour animer la cascade ou la salle.

### HELL v2 : le plan

L'idée : HELL devient une DESCENTE en six cercles, chacun un verbe qu'on entend tout de suite. MIX (le potard HELL de la
face, le même `xHellMix`) est la descente : en le tournant, les cercles entrent l'un après l'autre (DESCENT : ECHO dès 0,
WARP à 10 %, SPIN à 22 %, SHATTER à 36 %, CHOP à 50 %, METAL à 64 %, chacun en S jusqu'à 100 %) ou tous ensemble (ALL).
De 0 à 50 % l'écho entre comme aujourd'hui ; au-delà le son direct passe tout entier dans les cercles. MIX 0 : contourné
au bit près (mesuré).

La chaîne (un `Hell2` qui enveloppe `Hell`) : CHOP, puis I ECHO (Hell.cpp tel quel), II WARP, IV SHATTER, VI METAL,
III SPIN, puis le niveau et le plafond.

| Cercle | Ce qu'il fait | Réglages | Algorithme (prototype) |
|---|---|---|---|
| I ECHO | la spirale de Bode d'aujourd'hui | les 22 `xHell*` existants (TIME, FEEDBACK, SHIFT, RANGE, CROSS, filtres, LFO...) | `Hell.cpp` inchangé |
| II WARP | la hauteur plie en mesure | `xHellWarp` (0 à 12 demi-tons, 12 v²), `xHellWarpRate` (1/16 à 4 BAR), `xHellWarpShape` (WOBBLE, BEND, DROP, STOP, RANDOM) | ligne à retard lue à vitesse variable (Hermite 4 points, 4.5 s) ; WOBBLE exact et borné (retard sinusoïdal) ; DROP et STOP repartent à chaque cycle avec un fondu de 8 ms ; calé sur la mesure |
| III SPIN | la pièce tourne, le chorus titube, le filtre balaie | `xHellSpin`, `xHellSpinRate`, `xHellDrunk`, `xHellSweep` | panoramique à puissance constante du milieu ; chorus trois voix à marche aléatoire lissée ; passe-bas résonant (SVF, Q 3.2) de 250 Hz à 11 kHz au tempo |
| IV SHATTER | le son en éclats | `xHellShatter`, `xHellShatterSize` (1/64 à 1/4), `xHellShatterSpray` | grains Hann de la taille SIZE (recouvrement 2), lus dans 2.5 s, hauteurs octave / quinte / quarte, à l'envers selon SPRAY, placés en stéréo |
| V CHOP | la grille bégaie | `xHellChop` (chance), `xHellChopGrid` (1/64 à 1/4), `xHellChopPitch` (-12 à +12 par répétition), `xHellChopGate` | à chaque case, tirage (graine = n° de case) ; la case d'avant rejouée, transposée à chaque répétition ; fondus de 3 ms, GATE à 2 ms |
| VI METAL | anneaux et peignes sur chaque noire | `xHellRing`, `xHellRingTune` (NOTE, x1.5, x2, /2, TEMPO x8, x32), `xHellComb`, `xHellCombSeq` (OCTAVES, FIFTHS, MINOR, CHROMATIC, RANDOM) | modulation en anneau ; peigne à réinjection (0.55 à 0.9) accordé sur la note jouée, une hauteur par noire, glissé |
| MIX | la descente | `xHellDescent` (DESCENT / ALL) | loi ci-dessus |

Le niveau, ce qui manque aujourd'hui : mesuré sur un arpège qui crête à -5.7 dBFS, le Hell.cpp d'aujourd'hui avec les 24
presets de la banque à MIX 50 % donne +1.1 à +6.7 dB de RMS et des crêtes jusqu'à +5.1 dBFS (au-dessus de 0 dBFS pour
23 des 24). HELL v2 met sur la sortie un gain lent (RMS 300 ms : jamais plus de +2 dB sur l'entrée ; crêtes : +3 dB au
plus ; la référence d'entrée garde 3 s de mémoire pour ne pas couper les queues ; descente 30 ms, remontée 500 ms) puis
un plafond doux à -1 dBFS.

Compatibilité : un réglage de plus, `xHellV2` (OFF / ON), absent des anciens projets donc OFF : l'ancien moteur, au bit
près ; la page v2 et ses presets le mettent à ON. La banque de SYNTHÉ d'usine reste à HELL MIX 0 (build.mjs inchangé).
RANDOM (hellGentle, MIX 0.03 à 0.10) ne touche que l'écho : même comportement en descente. Tous les neufs vont en fin de
liste, avec `xHellV2` le premier.

Mesures du prototype (`hell2_proto`, 48 kHz, 120 BPM, arpège F# mineur en doubles croches puis 4 s de silence ; drone
sans rythme pour le sync ; aucun son joué) :
- MIX 0 : contourné au bit près.
- 64 rendus (16 presets x MIX 25, 50, 75, 100 %) : ni NaN ni dépassement ; gain -2.9 à +2.3 dB ; crêtes -1.0 dBFS au plus
  (le plafond), 0 à 0.1 % des échantillons dans la zone douce du plafond ; deux pointes courtes à surveiller à MIX 100 %
  (CATHEDRAL OF RUST et DEMON CHOIR : +4 dB sur 50 ms par la résonance des peignes, sous le plafond).
- La descente (MIX de 0 à 1 en 8 s) : sortie / entrée entre -6 et +4 dB par fenêtres de 250 ms ; pas de saut sauf ceux
  voulus (TAPE DEATH : l'arrêt de bande, 8 dB ; HELICOPTER et GLITCH PRIEST : les coupures, 5 à 7 dB).
- Sync (part du mouvement qui tombe sur le tempo, sur le drone) : témoin hors tempo 0.23 (drone seul 0.19) ; à MIX 100 % : ACID BATH 0.91,
  STUTTER GOD 0.61, CATHEDRAL OF RUST 0.61, HELICOPTER 0.53, THE DESCENT 0.42 ; les presets portés par la hauteur
  (BLACK HOLE, MELTDOWN, BARBER SPIRAL) bougent au tempo mais cette mesure (le flux spectral) les voit mal.
- Différence entre presets (plus proche voisin, timbre + largeur + empreinte du mouvement) : médiane 0.79, minimum 0.50
  (BARBER SPIRAL et LSD) ; l'ancienne banque : 0.80 et 0.64. Cette mesure ne voit pas encore ce qui fait le caractère
  (hauteur qui bouge, bégaiement) : seule l'écoute de Mika tranchera ; les rendus sont prêts.
- CPU : 0.5 à 4 % d'un cœur pour toute la chaîne (prototype en double, non optimisé).

La banque proposée (16 ; valeurs exactes 0..1 dans `hell2.ts`, HELL2_PRESETS ; MIX non touché, 50 % s'il était à 0) :

| Preset | Mène | Réglages (unités de la page) |
|---|---|---|
| THE DESCENT | I II III IV V | ECHO 1/8. FB 0.62 +9 Hz HP 90 LP 7k ; WARP WOBBLE 0.6 st 1 BAR ; SPIN 50 % 2 BAR DRUNK 30 % ; SHATTER 35 % 1/16 SPRAY 35 % ; CHOP 30 % 1/16 -2 st GATE 85 % |
| TAPE DEATH | II I | ECHO 1/4. FB 0.72 -7 Hz LP 2.6k HP 120 ANTI REFL ; WARP STOP 12 st 1 BAR |
| BARBER SPIRAL | I III | ECHO 1/8 FB 0.9 RANGE SYNC +1/temps SMEAR 25 % LP 9k ANTI REFL ; SPIN 60 % 4 BAR |
| STUTTER GOD | V | ECHO 1/16 FB 0.3 ; CHOP 75 % 1/16 -1 st GATE 70 % ; COMB 25 % OCTAVES |
| GLASS RAIN | IV | ECHO 1/8 FB 0.55 +12 Hz CROSS SPREAD 1 HP 300 ; SHATTER 85 % 1/64 SPRAY 80 % |
| SEASICK | II III | ECHO 1/4 FB 0.45 LP 6k ; WARP WOBBLE 0.75 st 2 BAR ; SPIN 45 % 4 BAR DRUNK 90 % |
| ACID BATH | VI III | ECHO 1/16. FB 0.5 HP 150 ; SPIN 25 % 1/8 SWEEP 90 % ; RING 70 % NOTE x1.5 |
| BLACK HOLE | II I IV | ECHO 1/4 FB 0.85 -40 Hz LP 1.8k ANTI REFL ; WARP DROP 5 st 2 BAR ; SHATTER 40 % 1/8 SPRAY 90 % |
| CATHEDRAL OF RUST | VI I | ECHO 1/4 FB 0.78 SMEAR 80 % HP 160 ; COMB 85 % FIFTHS |
| HELICOPTER | III V VI | ECHO 1/32 FB 0.25 ; SPIN 100 % 1/16 ; CHOP 50 % 1/32 GATE 45 % ; RING 35 % TEMPO x32 |
| MELTDOWN | II IV | ECHO 1/4. FB 0.75 -5 Hz LP 3k HP 120 ; WARP RANDOM 7 st 1/2 ; SHATTER 35 % 1/16 SPRAY 30 % |
| VERTIGO | III I II | ECHO 1/8. FB 0.68 +4 Hz CROSS SPREAD 1 LFO STEREO ; WARP BEND 1 st 1/2 ; SPIN 80 % 1 BAR DRUNK 35 % |
| DEMON CHOIR | I VI III | ECHO 1/4 FB 0.7 RANGE MIDI x0.5 DOWN SMEAR 50 % ANTI REFL ; SPIN 30 % 2 BAR DRUNK 60 % ; COMB 55 % MINOR |
| GLITCH PRIEST | V VI | ECHO 1/16T FB 0.35 ; CHOP 70 % 1/64 +7 st GATE 55 % ; RING 60 % NOTE x2 |
| LAST CALL | II III I | ECHO 1/4 FB 0.6 -2 Hz LP 3.5k HP 100 LFO DELAY 2 BAR 30 % ; WARP WOBBLE 1.2 st 4 BAR ; SPIN 70 % 2 BAR DRUNK 70 % SWEEP 20 % |
| LSD | tous (ALL) | ECHO 1/8T FB 0.82 SYNC -1/2 SMEAR 40 % CROSS SPREAD 1 ; WARP BEND 2 st 1/2 ; SPIN 90 % 1/2 DRUNK 50 % SWEEP 60 % ; SHATTER 50 % 1/32 SPRAY 70 % ; CHOP 45 % 1/8T +5 st ; RING 30 % NOTE /2 ; COMB 30 % CHROMATIC |

### Les pages HELL

- A, le vortex : le gros MIX au centre, entouré de six anneaux (I dehors, VI au fond) qui s'allument quand MIX les fait
  entrer, tournent au tempo de leur cercle et prennent sa forme (spirale, onde, hachures, éclats, dents) ; I à III à
  gauche, IV à VI à droite ; sous le vortex : "DESCENT 82 % · 5 OF 6 CIRCLES" (THE DESCENT n'a pas de METAL), MIX MODE, la banque.
- B, l'escalier : MIX en haut à gauche avec ses six marches, le tunnel (un anneau par temps, tordu par WARP, tourné par
  SPIN, haché par CHOP, semé par SHATTER, arrondi par METAL), la banque à droite ; les six cercles en colonnes dans
  l'ordre de la descente, chacun avec "IN THE MIX xx %" et "ENTERS AT MIX xx %".
- Les anciens réglages de l'écho (HP, LP, SMEAR, SPREAD, PHASE, ANTI REFL, LFO) restent des paramètres ; dans la page v2
  ils passeraient dans un volet "ECHO +" (non maquetté).

## 3. Ce qui reste à faire / points en suspens

- Mika : choisir A ou B pour DELAY, REVERB et HELL (images étiquetées).
- Mika : écouter les 16 rendus HELL v2 (scratchpad v44/hell-proto/wav, MIX 75 %, arpège à 120 BPM) : rendus hors ligne,
  jamais joués ici. La banque sera réglée à l'oreille ensuite (BARBER SPIRAL et LSD les plus proches).
- Après validation : coder le DSP (REVERB : EQ, WIDTH, DUCK, FREEZE ; HELL v2 : Hell2 et `xHellV2`), les tests (MIX 0 au
  bit près, plafond, sync, blocs), les paramètres en fin de liste, la migration, puis la publication.
- DELAY : la tête de lecture suit aujourd'hui l'horloge de la page ; pour la caler sur la mesure d'Ableton, envoyer la
  position (ppq) par mm_mod.
- Les maquettes (`?fx2`, `window.__fx2`, réglages de maquette) sont à retirer quand le vrai code les remplace.

## 4. Commandes utiles ajoutées

- Voir une maquette dans la face web : `npm run plugin:arp:web`, servir `plugin/mm-arp/build-web`, ouvrir
  `/?mute=1&probe&fx2=A` (ou `B`), puis OPEN et la page.
- Prototype HELL v2 (aucun son) : `node plugin/mm-arp/tests/hell2-bank-gen.mjs . bank.txt`, puis
  `g++ -O2 -std=c++17 -Iplugin/mm-arp/dsp plugin/mm-arp/tests/hell2_proto.cpp plugin/mm-arp/dsp/Hell.cpp -o hell2_proto`
  et `./hell2_proto bank.txt [dossier des wav]`.
