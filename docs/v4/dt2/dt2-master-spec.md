# MM-RYTM V.6 : cahier maitre de la refonte Digitakt II (16 pistes libres, sans sampling)

2026-10-30. Pour les builders. Lecture seule du depot au moment de l'ecriture (branche `claude/mauditemachine-dev-ipq3x5`, V.5.2 en ligne, V.5.3 LIVE REC construit sur une branche, pas pousse).

Sources : les 7 inventaires de `scratchpad/dt2/inv/` et le manuel Digitakt II OS 1.17. Renvois entre crochets :
[UI n] = `inv-dt-ui.md` section n ; [SEQ n] = `inv-dt-seq.md` ; [SND n] = `inv-dt-sound.md` ; [MEN n] = `inv-dt-menus.md` ;
[FACE n] = `inv-mm-face.md` ; [MOD n] = `inv-mm-model.md` ; [DONE n] = `inv-mm-done.md`. Les valeurs fines, les figures et
les numeros de ligne du code sont dans ces inventaires : ce cahier tranche, place et decoupe. Quand il contredit un
inventaire, ce cahier gagne.

Demande de Mika (2026-10-30) : "refais la Digitakt mais avec mon design ; tous les boutons, le placement des choses et
toutes les fonctionnalites c'est base sur la Digitakt, sans le cote sampler".
Decisions deja prises par Mika : modele Digitakt II ; 16 pistes libres (n'importe quel son sur n'importe quelle piste :
sa banque de samples et les synthes existantes) ; mise en ligne en 2 ou 3 gros morceaux. Choix de ce cahier : 3 morceaux,
V.6.0, V.6.1, V.6.2, precedes d'une preparation P0 qui ne change rien a l'ecoute ni a l'oeil.

Abreviations : DT2 = Digitakt II ; MM = Maudite Machine (le MM-RYTM d'aujourd'hui) ; "A + B" = tenir A puis appui court
sur B ; zone = hotspot ; lane = un builder dans son worktree.

---------------------------------------------------------------------------------------------------------------------

## 0. En une page

1. **La face** garde le corps, les matieres, le noir et la creme, le FUNC orange, les touches en caoutchouc, le logo M et
   l'ecran 4,3 pouces de Mika, mais toutes les commandes prennent la place et la fonction de la DT2 (grille "option A",
   256 x 156 mm inchanges, section 2). Les scenes A/B et le crossfader quittent la face (moteur et MIDI gardes).
2. **Les donnees** : 16 pistes ; les cles BD..CY deviennent les noms des pistes 1 a 8, T9..T16 s'ajoutent ; un seul store
   `tracks` remplace `kit` + `voiceFx` ; tout ce qui est sauve aujourd'hui se relit sans conversion d'id (section 4).
3. **V.6.0 "la face DT2 et les 16 pistes"** : toute la face DT2 dessinee et branchee, 16 pistes libres (menu MACHINE,
   page SRC par machine, MIXER 16), chaque fonction d'aujourd'hui a sa place DT2 (TEMPO, PRESET/KIT, SOUNDS, PAGE et FILL,
   fleches, MAIN VOLUME, LEVEL/DATA, QUANTIZE), moteur de gestes generalise. KEYBOARD et SONG dessinees, inertes "BIENTOT".
4. **V.6.1 "les pages et le sequenceur DT2"** : toutes les pages de son DT2 (TRIG, SRC, FLTR a machines, AMP ADSR, FX
   BR/SRR, 3 LFO), SEND FX et MIXER DT2, SETUP, 128 pas sur 8 pages, PAGE SETUP et vitesses, STEP REC, euclidien,
   KEYBOARD et 36 gammes, TRIG MODES, copier/coller fins, metronome, nudge.
5. **V.6.2 "la structure DT2"** : kit dans le pattern, presets de piste, pool et preset locks, PERFORM KIT, SONG (16
   songs), createur de chaines, projets (IndexedDB, export de fichier), SETTINGS complet, MIDI CONFIG (sync, carte
   Elektron).
6. **P0 avant tout** : pousser V.5.3, capturer les fixtures, decouper `actions.ts` (5372 l.), `screen.ts` (3958 l.),
   `infos.ts`, `targets.ts` en modules, poser les contrats (types, registres, ids reserves). Sans P0, 5 builders en
   parallele se marchent dessus.
7. **Parallele** : 5 ou 6 lanes par version, chaque fichier a UN proprietaire par version (section 5.5), integration
   dans un ordre fixe, relecture contradictoire, verification muette (jamais un son), puis mise en ligne.

---------------------------------------------------------------------------------------------------------------------

## 1. Principe

### 1.1 La regle

- **Fonctions et placement : la DT2.** Chaque touche, potard, LED et menu de la DT2 existe, a la meme place relative et
  avec les memes fonctions primaire, secondaire (FUNC +) et combinaisons ([UI 3], [MEN 2], [SEQ 30]). Quand le manuel se
  contredit, on prend le choix note dans les inventaires ([UI 10], [SEQ 32], [MEN 2.6]) : 128/128 pour la longueur par
  increments, TRIG 9-16 pour les banques, [FUNC] + [TRIG PARAMETERS] = QUANTIZE, etc.
- **Le design : celui de Mika.** Corps, materiaux, couleurs, appearance noir/creme (`applyAppearance`), FUNC orange,
  langage de couleurs DT deja en place (`DT_HEX`, `DT_HEX_LIGHT`), touches en caoutchouc avec temoin, anneaux de valeur,
  ecran monochrome facon OP-1, logo M, serigraphie Maudite Machine. Aucune couleur en dur hors de `theme.ts`, chaque
  teinte nouvelle a sa variante creme (regle D1).
- **Sans sampling, sans materiel.** Retires : l'enregistrement audio, les entrees, l'edition de samples, USB, Overbridge,
  Transfer, SysEx, +Drive, OS, sync DIN, Turbo MIDI, les pistes MIDI (machine MIDI) et les modulations qui demandent un
  clavier MIDI (aftertouch, pitch bend, mod wheel, breath). Garde : choisir un son dans la banque, et importer un fichier
  depuis l'ordinateur (ce n'est pas un enregistrement, ca existe deja).
- **Rien ne se perd.** Patterns, presets, UNDO, liens SHARE, assignations MIDI, setups du Roto et notes du boitier d'avant
  se relisent et gardent leur sens. Aucun id MIDI ne disparait ni ne change d'ordre ; les nouveaux a la fin de leur
  groupe. A reglages de depart, le rendu hors ligne ne bouge pas (ecart <= 1e-6).
- **Aucun son pendant les tests** (CLAUDE.md) : sondes au DOM, compteurs d'evenements, rendus hors ligne ; Chromium
  headless `--mute-audio` ET `?mute=1` ; jamais un navigateur visible, jamais une pre-ecoute "pour voir".

### 1.2 Ce qui part (liste fermee)

Touche SAMPLING et son menu (reaffectee, 1.3), menu SAMPLES de la RAM et du +Drive, slots et quotas de samples, editeur de
samples et de slices, machines WERP, STRETCH, REPITCH, SLICE, GRID (moteurs de sampler sur des boucles ; la banque de Mika
est faite de one-shots) et donc TRIG MODE SLICES, EXTERNAL MIXER, sources IN L/R partout (compresseur, TO MAIN, TO FX),
USB IN/OUT, INT TO MAIN, USB TO MAIN, PRE/POST FADER, SYSEX DUMP, SEND SYSEX, TURBO SPEED, OUT/THRU PORT FUNC DIN,
USB CONFIG, OS UPGRADE, STARTUP MENU (TEST, OS ; ses RESET deviennent des entrees de SYSTEM), filtres COMB- et COMB+
(un DelayNode ne descend pas sous 128 echantillons ; a reconsiderer avec un worklet mesure), PITCH BEND DEPTH, mods
AFTERTOUCH / PITCH BEND / MOD WHEEL / BREATH, pistes MIDI (CHAN, BANK, PROG, VAL/SEL, accords NOT2-4). La serigraphie des
prises arriere disparait.

### 1.3 Ce qu'on garde qui n'est pas Digitakt (une decision par element)

| Element MM | Decision (recommandation appliquee sauf avis contraire de Mika) | Ou | Version |
|---|---|---|---|
| SCENE A, SCENE B, crossfader | **Quittent la face** (la DT2 n'a pas de place pour eux). Moteur, donnees (par emplacement, presets, UNDO), cibles `rytm:scene:a`, `rytm:scene:b`, `rytm:xfade`, notes 79/80 et CC 28 du boitier, pages du Roto : **gardes**. Edition par une page MIXER "SCENES" (la place de l'EXTERNAL MIXER retire) : potard A presse = armer A, potard B presse = armer B (garde comme une tape d'aujourd'hui), H et LEVEL/DATA = crossfader, E et F = nombre de cles de chaque scene. Question Q2 | MIXER, derniere page | 6.0 |
| UNDO / REDO | **Garde** hors face (Cmd+Z, Maj+Cmd+Z, Ctrl+Y, bouton de l'en-tete) : demande de Mika ("j'ai tout perdu") | `state/undo.ts` | 6.0 (16 pistes) |
| OPEN (logo M, capot, PCB, puces du site) | **Garde** : le logo M prend le role du logo de marque DT2 ; place dans la colonne gauche entre LEVEL/DATA et FUNC (la DT2 le met en haut a droite, place prise par les potards sur une face moins profonde). La plaque TWEAKS sous le capot suit la piste active (les potards de sa machine SRC) | `faceplate.open`, `scene/rytmTweaks.ts` | 6.0 |
| INFOS et le `i` de l'ecran | **Garde** (c'est le mode d'emploi), une carte par touche, potard et page nouvelle, en francais, tutoiement | `rytm/infos*` | au fil des 3 versions |
| Telephone (`?portrait=1`) | **Garde sa face a lui, gelee au pixel pres** (pas de face DT2 au doigt). Seules evolutions : 16 pistes par une bascule 1-8 / 9-16 sur les pads et le Dock (6.0) ; une bascule de page du pattern dans le Dock quand un pattern depasse 16 pas (6.1). Il joue tout ce que contient un pattern (moteur commun) | `ui/Dock.tsx`, `scene/pads.ts`, `ui/BeatEditor.tsx` | 6.0, 6.1 |
| HOME (ecran OP-1) | **Quitte la navigation du desktop** : une touche de page rappuyee = sous-page suivante, comme la DT2. Le dessin OP-1 (anneau des pas) devient l'economiseur d'ecran apres 5 min (la DT2 en a un). `rytm:home` et la touche H ouvrent la page TRIG | `scene/screen` | 6.0 (retrait), 6.1 (economiseur) |
| RANDOM du beat entier | **Garde comme extra MM, deplace** : entree "RANDOM BEAT" a la racine du menu PRESET/KIT ; `rytm:random` garde. TRIG puis YES redevient la DT2 (page TRIG au hasard) | menu PRESET/KIT | 6.0 |
| SOLO, ancien MUTE a trois etats (M, Maj + M), double tape et clic droit de mute | **Gardes hors face** (clavier, MIDI, tenue 400 ms en mode MUTE) : aucun conflit DT2 | | 6.0 (16) |
| Grille HTML posee sur les pas (BeatEditor) | Le PTN du desktop devient celui de la DT2 (choix sur les TRIG). La grille reste l'outil du telephone et devient au desktop un extra "EDIT GRID" (SETTINGS > PATTERN > EDIT GRID, et Maj + E), 16 rangees | `ui/BeatEditor.tsx` | 6.0 |
| SHARE (lien du site) | **Garde** ; format v1 fige intact, v2 pour 16 pistes (4.5) | `audio/beatcode.ts` | 6.0 |
| "KIT" d'aujourd'hui (preset de toute la machine + pattern) | 6.0 : la liste actuelle s'ouvre par la touche PRESET/KIT (plus par PTN deux fois). 6.2 : chaque preset devient un pattern de projet avec son kit (les 10 styles d'usine = projet FACTORY, A01 a A10 ; les presets de Mika = projet MES PRESETS) et un kit dans la liste des kits | | 6.0 / 6.2 |
| SWING, STRETCH, BIT, COMP, DIST master (dans SEND FX) ; MASTER et TEMPO (MIXER 2/2) | Ranges aux places DT2 : MASTER = potard MAIN VOLUME, TEMPO = touche TEMPO, SWING = TEMPO (D) en 6.0 ; COMP = MIXER COMPRESSOR, DIST master = FX MIXER MOVD, STRETCH et BIT (extras MM) dans les cases A a D du FX MIXER, vides sur la DT2, en 6.1. En 6.0 la page SEND FX d'aujourd'hui reste telle quelle (SWING y est aussi) | | 6.0 / 6.1 |
| Bornes MM (VEL 9 crans, BPM 100-150, swing 50-67 %) | Aux bornes DT2 : BPM 30-300 au 1/10 et swing 50-80 % en 6.0 ; VEL 1-127 en 6.1. Le SYNC des platines (MM-DECKS) borne de son cote. Sans changer le sens d'aucune donnee (corrige par la critique) : `rytm:enc:tempo` (le potard TEMPO du setup Roto RYTM, `MIDI-roto-setups.csv` l. 27) et `rytm:enc:swing` gardent 100-150 et 50-67 % (libelle LEGACY RANGE ; aujourd'hui `dialRange('tempo')` = `[BPM.min, BPM.max]`, `actions.ts` l. 2910, elargir `BPM` changerait la course du Roto) ; deux cibles neuves a la fin du groupe RYTM prennent 30-300 et 50-80. `fx.swing` garde sa loi (0 = 50 %, 1 = 66,7 %, `SWING.maxDelay` 1/3 inchange) et monte a 1,8 pour 80 %. `BPM.min/max` est lu aussi par `dj/actions.ts` l. 1291 (le SYNC des platines), `state/share.ts`, `rytm/diagrams.ts` (dessin TEMPO du telephone) et `scripts/presets-bpm.test.mjs` (borne 100-150 et BPM entier en dur, porte `presets:test`) : P0 donne aux platines leur propre constante, B2 reecrit le test | | 6.0 / 6.1 |
| Boitier MMHW v2 | **Compatibilite gardee** : ses 14 touches et ses notes gardent leur effet ; les touches nouvelles recoivent des notes proposees (2.7), a confirmer avec `protocol.js` quand Mika le pousse | `hw/` | 6.0 |

### 1.4 Les gestes d'aujourd'hui qui changent de place (indice a l'ecran pendant toute la V.6.0)

| Aujourd'hui | Desormais (DT2) | Indice affiche si l'ancien geste est fait |
|---|---|---|
| PTN deux fois = KIT | touche PRESET/KIT | `KIT: PRESET KEY` |
| FUNC + TRIG = TEMPO ; YES sur TEMPO = TAP | touche TEMPO ; FUNC + TEMPO = TAP ; FUNC + TRIG = QUANTIZE | `TEMPO: TEMPO KEY` |
| FUNC + SRC = SOUNDS | touche SOUNDS ; FUNC + SRC = MACHINE | `SOUNDS: SOUNDS KEY` |
| YES tenu = FILL | PAGE tenu (momentane), YES + PAGE (un cycle), PAGE + YES lache PAGE d'abord (verrou) | `FILL: HOLD PAGE` |
| FUNC + PTN puis pas 1-8 = banques | FUNC + PTN puis TRIG 9-16 = banques A-H ; ou PTN puis LEFT/RIGHT | `BANKS: TRIG 9-16` |
| TRIG puis YES = RANDOM du beat | PRESET/KIT > RANDOM BEAT ; TRIG puis YES = page TRIG au hasard | `RANDOM BEAT: PRESET KEY` |
| potard F de TRIG 1 = uTIME | TRIG tenu + LEFT/RIGHT (les deux en 6.0, le potard part en 6.1) | |
| MASTER dans l'ecran | potard MAIN VOLUME | |
| touches d'ecran du KIT (SRC LOAD, FLTR SAVE, AMP NAME, FX DEL, PTN EXIT) | fleches + LEVEL/DATA + YES/NO ; RIGHT = operations (SAVE TO HERE, RENAME, DELETE) | |
| fleches du clavier = machine voisine (tache 45) | gardees, sauf quand un menu de la machine est ouvert ou qu'un modificateur est tenu (TRIG, PTN, PAGE, KEYBOARD, TRK) : alors fleches DT2 ; Maj + fleches = toujours les fleches DT2 (nudge compris) | |

---------------------------------------------------------------------------------------------------------------------

## 2. La face

### 2.1 La taille : on garde 256 x 156 (option A)

Recommande et retenu : **option A** [FACE 8]. La face garde 256 x 156 mm, le corps, la camera, le cadrage, les voisines,
le capot ; l'ecran garde 106 x 67 (zone active 93,6 x 56,16, 800 x 480 px, 4,3 pouces) et se deplace ; potards a 24 mm
d'emprise, touches a 11 mm de haut, pas (TRIG) a 22 x 19. Pourquoi pas les proportions DT2 (option B, 256 x 196) :
ecran 3,8 pouces contre la demande "plus gros ecran" (2026-10-08, 2026-10-18), corps plus profond de 40 mm (`BODY`, `TILT`,
`MACHINE_H`, intro, capot, sol, texture de serigraphie +7 Mo a refaire), 2 jours de plus et des risques de cadrage, pour
une difference que l'oeil lit peu : la topologie, elle, est identique dans les deux. Question Q1 pour confirmation.

### 2.2 La grille : chaque commande, sa place DT2 et sa place sur la face de Mika

Repere : mm depuis le coin haut gauche de la face, x vers la droite, y vers l'utilisateur (celui de `faceplate.ts`).
DT2 = centre normalise 0..1 releve sur la page 12 du manuel [UI 2]. Valeurs MM = grille A verifiee par
`scratchpad/dt2/tools/gridA2.py` [FACE 8], sauf le bloc des LED de page recale sur PAGE (a re-verifier par
`faceplateCheck()`, qui devient un test). Classes : P = petite 12 x 11 ; L = large 22 x 11 ; G = PAGE 26 x 11 ;
T = TRIG 22 x 19 ; pot = potard. Legende = texte sur le capuchon ; orange = fonction FUNC +, imprimee 1,3 mm sous la
touche (cap 1,25, encre `DT_HEX.orange`).

| Commande | DT2 cx, cy | MM centre (cx, cy) | Taille | Legende | Orange (FUNC +) |
|---|---|---|---|---|---|
| MAIN VOLUME | 0.082, 0.185 | 19, 19 | pot d 20, repere, anneau fin | (serigraphie dessous) MAIN VOLUME | - |
| LEVEL/DATA | 0.082, 0.327 | 19, 45 | pot d 22, anneau | LEVEL/DATA | PRESET POOL |
| Logo M (OPEN) | (logo marque 0.922, 0.088) | 19, 67 (y 62.5..71.5 ; corrige par la critique, voir la note sous la table) | 10.6 x 9 | logo M | - |
| FUNC | 0.093, 0.512 | 19, 83.5 | L | FUNC (capuchon orange) | - |
| KEYBOARD | 0.093, 0.603 | 19, 99.5 | P | KEYBOARD | KB SETUP |
| TRK | 0.093, 0.705 | 19, 115 | L | TRK | MUTE MODE |
| PTN | 0.093, 0.801 | 19, 129.7 | L | PTN | BANK |
| SONG | 0.093, 0.898 | 19, 144.4 | L | SONG | SONG EDIT |
| Ecran (cadre) | 0.317, 0.270 | 87, 41.5 | 106 x 67 (x 34..140, y 8..75) | decalque MAUDITE MACHINE + MM-RYTM dans la bande basse du cadre | - |
| PRESET/KIT | 0.204, 0.512 | 52, 83.5 | P | PRESET | PERFORM |
| SETTINGS | 0.279, 0.512 | 75.5, 83.5 | P | SETTINGS | SAVE PROJ |
| SOUNDS (ex SAMPLING) | 0.354, 0.512 | 99, 83.5 | P | SOUNDS | SAMPLES |
| TEMPO | 0.430, 0.512 | 122.5, 83.5 | P | TEMPO | TAP TEMPO |
| REC | 0.218, 0.603 | 56.5, 99.5 | L | rond | COPY |
| PLAY | 0.317, 0.603 | 87, 99.5 | L | triangle | CLEAR |
| STOP | 0.415, 0.603 | 117.5, 99.5 | L | carre | PASTE |
| Potards A B C D | 0.551 / 0.674 / 0.796 / 0.919, 0.185 | 156 / 182.67 / 209.33 / 236, 20 | pot d 24, anneau 27 segments | lettre | - |
| Potards E F G H | memes x, 0.327 | memes x, 46 | pot d 24 | lettre | - |
| TRIG SRC FLTR AMP FX MOD | 0.549 / 0.623 / 0.698 / 0.772 / 0.847 / 0.922, 0.452 | 150 / 168.4 / 186.8 / 205.2 / 223.6 / 242, 66.5 | P | TRIG SRC FLTR AMP FX MOD | QUANTIZE, MACHINE, SETUP, SEQUENCER, SEND FX, MIXER |
| YES | 0.549, 0.557 | 150, 83.5 | P | YES | SAVE |
| UP | 0.698, 0.557 | 186.8, 83.5 | P | chevron haut | TRIG MODE ; serigraphie orange "double fleche KB OCT" a droite, DANS le cadre des fleches comme sur la page 12 (x 194 a 210 au plus, cap 1,25) (corrige par la critique : l'ancien x 195 a 220 traversait le bord droit du cadre des fleches, x 213) |
| LED de page (2 x 4) | cadre 0.907, 0.563 | cadre 235, 84 (x 222..248, y 79..89) | LED d 3.4 en cx 226 / 232 / 238 / 244, cy 81.5 et 86.5 | - | - |
| NO | 0.549, 0.648 | 150, 99.5 | P | NO | RELOAD |
| LEFT, DOWN, RIGHT | 0.624 / 0.698 / 0.772, 0.648 | 168.4 / 186.8 / 205.2, 99.5 | P | chevrons | uTIME-, TRIG MODE, uTIME+ |
| PAGE | 0.908, 0.648 | 235, 99.5 | G | PAGE | FILL/SETUP |
| TRIG 1 a 8 | 0.218 + 0.0985 i, 0.771 | 47 + 27.143 i, 120.5 | T | numero 1..8 ; cadre des temps sur 1 et 5 | (bande TRACK/MUTE dessous) |
| TRIG 9 a 16 | memes x, 0.898 | memes x, 142.5 | T | numero 9..16 ; cadre sur 9 et 13 | - |

Alignements DT2 tenus [UI 2.2] : colonne YES/NO = colonne de TRIG (page) ; LEFT sous SRC, UP/DOWN sous FLTR, RIGHT sous
AMP ; YES sur la ligne de UP, NO sur celle de LEFT/DOWN/RIGHT ; PAGE et les LED centres sur la colonne TRIG 8 / 16 (235
contre 237) ; KEYBOARD sur la ligne du transport, FUNC sur celle des 4 touches de menu ; MAIN VOLUME et LEVEL/DATA sur
les lignes des rangees de potards (a 1 mm pres) ; potards et touches larges de la colonne gauche alignes par le bord
gauche (x 8), KEYBOARD centree sur leur axe ; SONG sur la ligne des TRIG 9-16 (144.4 contre 142.5, 2 mm pres).
Ecarts voulus : la rangee YES/UP se confond avec celle des touches de menu et NO/fleches avec le transport (la DT2 a
deux grilles decalees de 8 mm, pas la place a 156 mm de profondeur) ; le transport est centre sous l'ecran et non sur
les colonnes TRIG 1-3 (l'ecran 4,3 pouces est plus large que trois colonnes de pas) ; le logo M dans la colonne gauche.

Note du logo M (corrige par la critique) : a cy 64.5 le haut du logo (y 60) touchait la deuxieme ligne de legende sous
LEVEL/DATA (potard d 22 jusqu'a y 56, "LEVEL/DATA" y 57.3..58.7, "PRESET POOL" orange y 59.3..60.6) : `gridA2.py` ne
verifie ni les legendes des deux potards de gauche, ni KB OCT, ni les cadres. A cy 67 il reste 6.5 mm avant FUNC (y 78).
`face:test` (5.6) controle donc AUSSI ces legendes, la serigraphie KB OCT et le jeu entre cadres (>= 0.8 mm).

Pieces qui n'ont plus de place : SCENE A/B et la fente du crossfader (retirer `slotParts` de `machine.ts`), la ligne
d'aide en bas de face (les indices passent a l'ecran et dans INFOS), le wordmark et FIRMWARE a leur place d'aujourd'hui.
Les noms BD..CY sous les pas 1-8 disparaissent (16 pistes libres) : corriger le piege `stepLabels` null de
`sequencer3d.ts` [FACE 3.4].

### 2.3 Serigraphie, cadres, decalque

- **Decalque du cadre de l'ecran** : MAUDITE MACHINE (wordmark, 56 x 3,3) en bas a gauche de la bande basse du cadre (sous
  la zone active), MM-RYTM et `FIRMWARE V.6.x / 2026` a droite, comme "Digitakt II". Le plan de serigraphie (y 0.004) est
  sous le cadre (y 0.02) : un petit maillage a part au-dessus du cadre [FACE 3.7].
- **Legendes de potards** : MAIN VOLUME et LEVEL/DATA sous leurs potards, "PRESET POOL" orange sous LEVEL/DATA ; lettres A
  a H a 6 h sur l'anneau (r 10.6).
- **TRACK/MUTE** : orange, dans la bande de 3 mm entre les deux rangees de TRIG (y 130 a 133), avec l'accolade pointillee
  de TRIG 1 a TRIG 8, comme la DT2.
- **Cadres** (traits fins, coins arrondis, `SILK_LINES` desktop), seulement autour des 5 groupes de la DT2 : potards A-H
  (x 142..250, y 6..59), touches de page (x 142..250, y 60..75.5 ; si le jeu entre les deux cadres est trop serre, un seul
  cadre pour les deux, a juger a la capture), fleches (x 160..213, y 76.5..108.5, UP + LEFT DOWN RIGHT, KB OCT et leurs
  legendes), LED de page (x 222..248, y 79..89 ; sur la DT2 c'est une fenetre sombre en creux, pas un simple trait),
  TRIG 1-16 (x 34..250, y 109.5..154). (Corrige par la critique : avant, le cadre des touches de page finissait a y 76 la
  ou commencait celui des fleches, 0 mm de jeu contre 2 mm sur la DT2, et le cadre des fleches finissait a y 107 en
  coupant les legendes uTIME- / TRIG MODE / uTIME+ imprimees de y 106.3 a 107.9.) Rien autour de la colonne gauche, du menu, du
  transport, de YES/NO. Tout passe par `faceplateCheck()`.
- **Mots ou pictogrammes** : des mots sur PRESET, SETTINGS, SOUNDS, TEMPO, KEYBOARD (demande de Mika en V.4.2 : "les
  icones des fois c'est difficile a deviner") ; chevrons sur les fleches (nouveaux signes dans `FpMark`, `keyLabels.ts
  drawMarks`, `StaticMachine.tsx`) ; rond, triangle, carre sur le transport (existent).

### 2.4 Les LED : couleurs et etats

Teintes : celles de `DT_HEX` (noir) et `DT_HEX_LIGHT` (creme) [DONE 1.4] : rouge #FF2B2B / #D81E1E, jaune #FFD75E /
#E09A10, blanc #F4F1EA / encre #191919, vert #3DDC5A / #1F9E3A, magenta #E04DD8 / #B23AAB, bleu #4DA3FF / #2F78D6, orange
#FF6A13 / #A84300. Rythmes : clignotant = la phase `blink()` actuelle de `rytmFaceKeys.ts` ; double clignotement (nouveau)
= deux eclairs de 80 ms toutes les 600 ms ; "course" = la tete de lecture.

Touches :

| Touche | Etat | LED |
|---|---|---|
| FUNC | repos / tenue / gardee | eteinte / blanc plein / blanc clignotant (capuchon orange toujours) |
| TRK | tenue ou gardee | rouge |
| PTN | vue PTN / vue BANK | rouge / rouge clignotant |
| SONG | SONG mode / SONG EDIT | rouge / rouge clignotant |
| KEYBOARD | mode clavier | rouge |
| PRESET/KIT | menu ouvert / PERFORM KIT | rouge / orange (DT2) |
| SETTINGS, SOUNDS, TEMPO | menu ou liste ouvert | rouge ; TEMPO : eclair blanc a chaque tape de TAP |
| REC | GRID / LIVE / STEP / euclidien actif sur la piste | rouge fixe / rouge clignotant / rouge double clignotement / bleu (DT2) |
| PLAY | lecture / pause | vert / vert clignotant |
| STOP, YES, NO, fleches | appui | eclair blanc (comme aujourd'hui) |
| PAGE | FILL actif (tenu ou verrouille) / FILL "un cycle" en attente | rouge / rouge clignotant |
| TRIG..MOD (page) | page affichee / trig tenu : pages qui portent des verrous | rouge / rouge (les autres eteintes) |

LED de page (8) : allumees faible = pages que compte le pattern ; pleine = page editee ; clignotante = page qui joue ;
eteintes au-dela de la longueur. En 6.0 (16 pas) : LED 1 pleine, les autres eteintes.

TRIG 1-16 [UI 5.2] [SEQ 29] :

| Contexte | Couleur |
|---|---|
| note trig / lock trig / trig a verrous | rouge (rampe de velocite `STEP_LIT` gardee) / jaune / rouge ou jaune clignotant |
| tete de lecture | blanc qui court (sur la page jouee) |
| pas vide | eteint |
| TRK tenu, GRID/STEP REC | piste active rouge |
| vue PTN | blanc faible = pattern avec donnees, rouge = actif, rouge clignotant = en attente ou dans la chaine, eteint = vide |
| vue BANK (TRIG 9-16) | rouge = banque qui joue, rouge clignotant = affichee, blanc faible = pleine |
| GLOBAL MUTE | vert = joue, eteint = mutee, vert clignotant = mutee avec des trigs qui passent |
| PATTERN MUTE | magenta, idem ; mutee dans les deux = magenta clignotant |
| SOLO (extra MM) | blanc |
| KEYBOARD | touches jouables en motif de piano (rangee 9-16 = blanches, 1-8 = noires) ; bleu = notes a l'octave (FOLD) |
| euclidien | bleu = trigs generes |
| STEP REC | pas actif vert double clignotement (ou la couleur du trig present) |
| PAGE tenu (GRID REC) | TRIG 1-8 : pages existantes rouge faible, editee rouge, position maitre clignote ; TRIG 9-16 : vert = pages bouclees, clignote = page qui joue |
| menus a cases (CONTROL ALL CONFIG, COMPRESSOR ROUTING, TO MAIN, TO FX, ROW MUTE) | vert = coche |
| TRIG MODE PRESET POOL | blanc faible = slot occupe |
| appui | eclat neutre (blanc faible, gris sur creme) |

### 2.5 L'ecran : les zones (dessin 320 x 192 unites, 5:3)

La DT2 montre toujours la page active ; on reprend son gabarit [UI 4.1] sur notre 5:3 :

| Zone | Rectangle (unites) | Contenu |
|---|---|---|
| En-tete | x 0..320, y 0..20 | case inversee "A01" (x 2..40 ; clignote quand un pattern attend) ; nom du pattern (x 46..190) suivi d'un "P" clignotant en PERFORM KIT ; pastilles (FILL, CTRL ALL, LIVE REC, P-LOCK, BANK) x 190..246 ; icone du TRIG MODE x 250..264 ; metronome + BPM x 268..318. En SONG mode : "S01 02/04:VERSE A01" et la barre de progression de la ligne. En MUTE : apercu des 16 pistes (carre = joue, trait = mutee, + / X = prepare) a la place du nom. Indices temporaires (2 s, `hintMs`) a la place du nom |
| Colonne gauche | x 0..44, y 22..192 | cadre du type de son ("SMP" = ONESHOT, "SYN" = machine de synthese ; "DEL", "REV", "CHO", "CMP", "MIX", "FX" sur SEND FX et MIXER) ; numero de piste en grand ; nom court du son ; fader vertical LEV (TRK LEV, ou VOL sur SEND FX / MIXER) ; "PREP." clignotant en bas (6.2) |
| Grille des 8 parametres | x 48..302, y 24..190 | 2 x 4 cases (A B C D en haut, E F G H en bas, comme les potards) : dessin + etiquette de 4 lettres ; parametre verrouille = graphisme inverse et valeur du verrou ; case vide = cadre pointille ; parametre "verrou seul" (FILL, COND) = cadenas |
| Indicateur de sous-page | x 306..318, y 24..170 | un point par sous-page, plein = affichee |
| `i` (INFOS) | x 306..318, y 176..190 | zone `lcd-i` gardee |
| Pop-ups | x 50..270, y 40..160 | TRIG MODE (liste a icones), MICRO TIMING (regle + "+1/384"), QUANTIZE, PAGE SETUP, TRACK SWAP, CHAIN, confirmations YES/NO, nommage |
| Menus plein ecran | x 0..320, y 22..192 (en-tete garde, titre a la place du nom) | PRESET/KIT, SETTINGS, SOUNDS, SETUP, SONG EDIT, listes ; barre de defilement a droite ; LEFT = panneau de tri, RIGHT = panneau d'operations |

Regle de placement : la case k de la grille correspond au potard k (meme disposition 2 x 4, la DT2 n'a pas d'autre loi) ;
c'est deja la loi d'aujourd'hui (`FACE_LAW = 'mirror'`, `rytm/pages.ts` l. 769 : le bloc k dans la case k) et les potards
sont deja a droite de l'ecran (cx 134 a 230 contre un ecran x 8..114) : rien a changer a la loi (corrige par la critique).
`lcd-master` et `lcd-tempo` (rdial) quittent l'ecran (MAIN VOLUME et TEMPO sont sur la face), leurs cibles MIDI restent.
L'ecran reste non tactile au desktop (`SCREEN_TOUCH = PORTRAIT`).

### 2.6 Zones, kinds, ids MIDI, notes du boitier

Ids de zones gardes : `func trk pad-edit rec run stop pkey-* yes no pad-open penc-0..7 step-1..16` (MIDI LEARN, INFOS,
sondes, `faceHold`). `rytm:page` est pris (valeur de page) et le kind `page` aussi (pads du site) : la touche PAGE prend
`ptnpage` / `pagekey`.

| Zone nouvelle | kind | Cible MIDI (a la fin du groupe RYTM) | Note proposee du boitier |
|---|---|---|---|
| `mvol` | encoder (param level) | `rytm:enc:level` (existe ; libelle "MASTER" dans le CSV, a renommer MAIN VOLUME sans changer l'id) | CC 29 |
| `data` | data | `rytm:data` (relative : kind NOUVEAU, `MidiTarget.kind` n'a aujourd'hui que `value`, `press`, `hold` ; MIDI LEARN, la detection des CC relatifs et le retour Roto sont a ecrire, travail de B6) | CC 38 |
| `kbd` | kbd | `rytm:keyboard` | 74 |
| `song` | song | `rytm:song` | 75 |
| `preset` | preset | `rytm:preset` | 76 |
| `settings` | settings | `rytm:settings` | 77 |
| `sounds` | sounds | `rytm:sounds` | 78 |
| `tempo` | tempo | `rytm:screen:tempo` (existe) + `rytm:tap` | 81 |
| `up` `down` `left` `right` | arrow (champ `dir`) | `rytm:up` `rytm:down` `rytm:left` `rytm:right` | 82 83 84 85 |
| `ptnpage` | pagekey | `rytm:ptnpage` ; `rytm:fill` anime desormais cette touche | 86 |
| (8 LED de page) | aucune zone | etat dans `__v4.stage.faceKeys.info()` et le snapshot du boitier | |

Cibles gardees sans touche : `rytm:scene:a/b`, `rytm:xfade` (la page SCENES), `rytm:run`, `rytm:clear`, `rytm:random`,
`rytm:mute`, `rytm:solo`, `rytm:home` (page TRIG), `rytm:infos`, `rytm:open`. Les notes du boitier sont "a confirmer avec
protocol.js" ; `npm run hw:test` (qui compte "quatorze touches") est reecrit avec la liste de la face (un `FACE_KEYS_HW`
a part garde l'ordre des 14 touches d'avant pour le boitier actuel).

### 2.7 Saisie web : souris, toucher, clavier

- **Une couche de gestes unique** `state/gesture.ts` (generalise `state/func.ts`, `state/holdLatch.ts`, `pageArm`) :
  toute touche modificatrice a trois etats : tenue (vraie tenue au pointeur, au doigt, au clavier, au MIDI) ; tapee =
  gardee pour la touche suivante pendant 1,5 s (`DT_GESTURE.pageArmMs`) ; FUNC seule garde aussi la double tape =
  verrouillee. NO ou Echap relachent. Modificateurs : FUNC, TRK, PTN, SONG, PAGE, REC, YES, NO, TEMPO, PRESET/KIT,
  KEYBOARD, les 6 touches de page, SETTINGS (tenue 1 s), un TRIG (appui long 350 ms = tenu et garde, comme le P-LOCK
  d'aujourd'hui ; Maj + clic ajoute un TRIG tenu).
- **L'ordre compte** comme sur la DT2 : YES garde puis PAGE = FILL un cycle ; PAGE garde puis YES = FILL verrouille ;
  la validation au relacher de FUNC (mutes prepares, tempo PREP.) se fait au relacher reel ou a la tape suivante de FUNC.
- **Les accords dans une table** `actions/chords/` : chaque entree = (touche, modificateurs, contexte, priorite, action).
  Le premier contexte vrai gagne, dans l'ordre de [MEN 2.5]. Un test enumere la table (pas de doublon a meme priorite,
  chaque entree a un chemin souris, toucher et clavier, chaque entree a une carte INFOS). Chaque lane ajoute ses entrees
  dans son propre fichier de la table (5.5).
- **Potards** : glisser = valeur ; Maj + glisser = fin (comme aujourd'hui) ; Ctrl ou Cmd + glisser = gros pas (le "presser
  et tourner" DT2) ; clic sans glisser = potard "presse" (pour potard + NO = defaut, TRIG + potard presse = retire le
  verrou, potards A/B de la page SCENES) ; double clic = defaut (garde) ; Alt + glisser = sauts musicaux (6.1).
- **Clavier** (seulement quand le MM-RYTM a le focus) : existants gardes (Espace PLAY, Maj + Espace STOP, W REC, E PTN,
  Entree YES, Echap NO, Alt FUNC, P PRESET/KIT, I INFOS, O OPEN, L P-LOCK, M / Maj + M, [ ] pages, Cmd+Z) ; A S D F Z X C
  V = TRIG 1 a 8 et Maj + les memes = TRIG 9 a 16 (en TRIG MODE TRACKS c'est la piste n, comme aujourd'hui) ; T = TRK
  tenu, G = PAGE tenu, N = SONG, K = KEYBOARD, Y = TEMPO, U = SOUNDS, virgule = SETTINGS ; fleches : 1.4. H perd HOME
  (ouvre la page TRIG). Les chiffres du site ne bougent pas. Le builder verifie chaque lettre contre `useKeys.ts`.
- **Toucher** (fenetre etroite du desktop, tablette) : vrai multi-touch, les accords marchent comme sur la machine ; la
  garde reste pour un seul doigt.

---------------------------------------------------------------------------------------------------------------------

## 3. Les fonctions : table des ecarts (DT2 sans sampling contre MM-RYTM V.5.2/V.5.3)

Colonnes : fonction DT2 | ce qui existe deja (ou) | ce qu'il faut faire | version. "-" = rien a faire.

### 3.1 Face et gestes

| Fonction DT2 | Deja la | A faire | Ver. |
|---|---|---|---|
| FUNC + touche, legendes orange | `state/func.ts` (V.5.0) | etendre aux 11 touches nouvelles | 6.0 |
| Accords contextuels (le premier vrai gagne) | en dur dans `stepToggle`, `yesKey`... | table `actions/chords/` + test d'enumeration | 6.0 |
| Touche tenue a la souris | FUNC, TRK, touches de page | `state/gesture.ts` pour tous les modificateurs | 6.0 |
| MAIN VOLUME | MASTER dans l'ecran (`lcd-master`) | potard sur la face (`scene/sideKnobs.ts`) | 6.0 |
| LEVEL/DATA : niveau de la piste, defilement, saisie | non | potard : TRK LEV ; dans un menu : defiler / regler la ligne | 6.0 |
| FUNC + tourner LEVEL/DATA = PRESET BROWSER ; TRIG + tourner = preset lock | non | | 6.2 |
| Presser et tourner = gros pas | Maj = fin | Ctrl/Cmd + glisser | 6.0 |
| Potard presse + NO = defaut | double clic = defaut | clic tenu + NO (double clic garde) | 6.0 |
| FUNC + tourner = sauts (NOTE et TUNE par octave, delay en valeurs BPM) | non | Alt + glisser | 6.1 |
| Touches de page radio ; rappui ou UP/DOWN = sous-page | rappui = onglet ou HOME | sans HOME ; UP/DOWN | 6.0 |
| Tenir une touche de page = toutes les valeurs | non | surcouche | 6.1 |
| Page + YES (hasard), page + NO (recharge) | oui (pageArm) | en 6.2 NO recharge l'etat sauve du projet | 6.0 / 6.2 |
| Page + PLAY (defauts) ; page + REC / STOP (copier / coller la page de parametres) | non | | 6.1 |
| Trig tenu : touches de page qui portent des verrous en rouge | point sur les onglets | touches rouges | 6.0 |
| YES / NO / fleches / LEVEL/DATA dans tous les menus | YES/NO dans KIT et listes | partout ; touches d'ecran du KIT retirees (`presetKeys.ts realU`) | 6.0 |
| Defilement rapide : FUNC + UP/DOWN = une page de liste (manuel 6.3, 9.3.3) (ajoute par la critique) | non | dans tous les menus et listes | 6.0 |
| Presse-papiers UNIQUE : une copie remplace la precedente, quel que soit l'objet (trig, page, page de parametres, piste, son, pattern, ligne de song) (manuel 6.4) (ajoute par la critique) | copies separees | un seul presse-papiers d'etat, pose en P0 avec les contrats | 6.0 |
| 4 fleches | non | navigation, PTN + LEFT/RIGHT, TRIG + LEFT/RIGHT | 6.0 |
| LEFT/RIGHT tenus = nudge -/+10 % | non | | 6.1 |
| PAGE + 8 LED | non | touche, LED (1 page) ; pages | 6.0 / 6.1 |
| FILL : YES + PAGE, PAGE tenu, PAGE + YES (verrou), PAGE encore = fin | YES tenu > 250 ms | sur PAGE ; `rytm:fill` anime PAGE | 6.0 |
| QUICK MUTE FUNC + TRIG 1-16, legende TRACK/MUTE | FUNC + pas 1-8 | 16 ; retirer le message perime `PAGES 1-4` | 6.0 |
| SETTINGS tenu 1 s + TRIG 1-3 (intensite LED LOW/MID/MAX), + TRIG 9 (retroeclairage) | non | multiplicateurs de lueur | 6.0 |
| Economiseur d'ecran | non | dessin OP-1 apres 5 min | 6.1 |
| Logo modele dans le cadre de l'ecran | bande d'en-tete | decalque | 6.0 |
| Messages de place perimes (`SETUP (TRACK LENGTH): V.5.2`, `EUCLID: V.5.3`, `PAGES 1-4: V.5.2`) | oui | remplaces par "BIENTOT : V.6.x" puis par la fonction | 6.0 |

### 3.2 Pistes, machines, pages de son

| Fonction DT2 | Deja la | A faire | Ver. |
|---|---|---|---|
| 16 pistes, tout son sur toute piste | 8 voix a famille fixe | section 4 | 6.0 |
| TRK + TRIG 1-16 = piste active ; TRK SELECT | TRK + pas 1-8 | 16 ; TRK SELECT reglable en 6.0 (PERSONALIZE), defaut = le comportement d'aujourd'hui | 6.0 |
| Menu MACHINE (FUNC + SRC) | MACHINE 909/808/MM dans SRC SYNTH | categorie SRC : ONESHOT, KICK, SNARE, CL HAT, OP HAT, CLAP, LO TOM, HI TOM, CYMBAL (+ modele 909/808/MM dans la page) ; categorie FLTR en 6.1 | 6.0 |
| SRC ONESHOT : A TUNE, B PLAY, C -, D SAMP / E STRT, F LEN, G LOOP, H LEV | SRC MAIN (SOUND VOL PITCH FINE LEN REV) | disposition DT2 ; PLAY = FWD / REV (le REV d'aujourd'hui) puis FWD LOOP / REV LOOP en 6.1 ; STRT = `start` (quitte AMP) ; LEV = `slev` ; FINE sur la 2e sous-page | 6.0 / 6.1 |
| SRC d'une machine de synthese | SRC SYNTH par famille | A TUNE, B PLAY (FWD/REV de la couche), C -, D SND (couche sample) / E F G = potards de la machine, H LEV ; 2e sous-page pour le reste (kick : 5 potards + MIX + MODEL) | 6.0 |
| SRC 2 : la forme d'onde | non | dessin depuis le PCM decode | 6.1 |
| Sample lock | `snd` | depuis toute categorie | 6.0 |
| Liste des samples (D SAMP ; TRIG de la piste = pre-ecoute) | SOUNDS (FUNC + SRC) | touche SOUNDS + potard D ; FUNC + SOUNDS = SAMPLES (importer, retirer ses fichiers) | 6.0 |
| WERP, STRETCH, REPITCH, SLICE, GRID | non | hors | hors |
| FLTR 1 : MULTI-MODE, LOWPASS 4, EQ, LEGACY | un biquad LP/HP/BP | LEGACY = l'actuel (identite) ; MULTI (morph continu LP-BP-HP), LP4 (2 biquads), EQ (peaking) ; FREQ RESO/GAIN TYPE/Q ENV | 6.1 |
| Enveloppe filtre ADSR + DEL + RSET | AD (`fatk fdec`) | SUS, REL, DEL, RSET ; FUNC + A = DEL | 6.1 |
| FLTR 2 : DEL, KEY.T, BASE, WDTH, BW.RT, RSET | non | base-width = 2 biquads par coup, absents au neutre | 6.1 |
| AMP : ATK HOLD DEC SUS REL RSET MODE PAN VOL | ATK HOLD DEC START PAN ; VOL sur SRC | ADSR/AHD ; VOL (= `level`, verrouillable) sur AMP | 6.1 |
| FX : BR OVER SRR ROUT / DEL REV CHR OD.RT | DIST et CHORUS en insert, DELAY, REVERB | BR et SRR calcules dans le worker au rendu du coup (zero CPU ; ROUT affiche PRE, fige) ; OVER dans le worker (OD.RT PRE) ou l'insert DIST d'aujourd'hui (OD.RT POST) ; CHR = envoi | 6.1 |
| MOD 1, 2, 3 (SPD MULT FADE DEST / WAVE SPH MODE DEP), destinations annexe C | 2 LFO, 11 destinations | LFO 3 ; destinations ajoutees a la FIN de `LFO_DESTS` (indices stockes justes). Ajoute par la critique : MULT DT2 (1 a 2K, en BPM OU sur un tempo fixe de 120 BPM, 24 valeurs ; aujourd'hui `LFO_MULTS` = 8 valeurs 1 a 128) : valeurs neuves a la fin de la liste stockee, ordre du potard par une table a part ; SPH devient SLEW quand WAVE = RND (absent) ; DEST : surligner = apercu, YES valide, FUNC + tourner saute d'une section a l'autre ; les destinations LFO vers LFO (LFO1 pour LFO2/3) ; BR, SRR, OVER calcules au worker ne peuvent etre modules qu'au coup (valeur du LFO a l'instant du trig) : ecart documente | 6.1 |
| TRIG 1 : A NOTE, B VEL, C LEN, D PROB / E LFO.T, F FLT.T, G FILL, H COND | NOTE VEL LEN PROB / COND uTIME LFO.T - | disposition DT2 (3.3) | 6.1 |
| TRIG 2 : A RTRG, B VFAD, C LEN, D RATE / - - G PTIM, H PORT | RTRG RATE VFAD RLEN | ordre DT2, VFAD -64..64, portamento | 6.1 |
| NOTE absolue "C 5 (60)" | TUNE +/-24 demi-tons | NOTE 0..127 affichee en notes ; hauteur = NOTE - 60 ajoutee a TUNE, bornee a +/-36 demi-tons par le moteur | 6.1 |
| VEL 1-127 | 9 crans (chiffres 0-9 des pas) | les chiffres restent le format (0 vide, 1-9 note) ; VEL fine = verrou `vel` 1-127 ; la loi de gain passe exactement par `VEL_GAIN` aux 9 crans (identite) ; defaut 100 par piste dans le pattern | 6.1 |
| SETUP > TRACK : LEGATO, NOTE PRIORITY, VELOCITY TO VOL, OCTAVE, PORTAMENTO (SLOPE AMOUNT STYLE LEGATO ONLY GATING), KEY TRACKING (4), VELOCITY MOD (4), RENAME | non | + extras MM : VOICE MODE (MONO / POLY), CHOKE GROUP | 6.1 |
| SETUP > KIT : CONTROL ALL CONFIG, COMPRESSOR ROUTING, TRACK SWAP | CONTROL ALL sur 8 sans config | masques `ctlAll`, `compRoute` ; TRACK SWAP (tenir 2 TRIG) ; + extra MM DUCK SOURCE (`scSrc`, la piste qui pilote le sidechain de l'ARP et de la BASS) | 6.1 |
| CONTROL ALL (TRK + potard, NO annule) | oui, 8 voix, valeur de la voix choisie | 16 | 6.0 |
| TRK + REC / STOP / PLAY = copier / coller / effacer le son de la piste ; TRK + TRIG + REC/STOP | non | copie d'un `TrackSound` | 6.0 |
| Pistes MIDI | non | hors | hors |

### 3.3 Sequenceur

| Fonction DT2 | Deja la | A faire | Ver. |
|---|---|---|---|
| GRID REC ; appui court = retire, appui un peu long = prepare | oui (8 voix) | 16 | 6.0 |
| LIVE REC (REC + PLAY) ; sorties PLAY / REC / STOP ; NO + TRIG efface | V.5.3 (branche, pas poussee) | relire et pousser en P0 ; 16 en 6.0 | P0 / 6.0 |
| LIVE REC sans quantification (REC + double PLAY, uTIME ecrit) ; NO + potard efface un verrou ; OVERDUB ; PARAM LIVE REC ; PREROLL | non | | 6.1 |
| STEP REC (REC + STOP), STANDARD / JUMP (REC + double STOP) | non | | 6.1 |
| STEP REC, gestes du manuel 10.2.4 (ajoute par la critique) : TRIG = pas actif (vert double clignotement), LEFT/RIGHT = pas actif ; FUNC + TRIG n = note sur la piste n puis avance ; KEYBOARD tenu + TRIG = note chromatique puis avance ; NO = efface ou silence puis avance ; YES tenu en posant = LEN de la duree d'appui ; en JUMP, LEN avance et se verrouille ; FUNC + YES / NO sans effet | non | | 6.1 |
| Les actions des TRIG MODES (VELOCITIES, RETRIGS, PRESET POOL) s'enregistrent en LIVE REC (manuel 8.5.4) (ajoute par la critique) | non | | 6.1 ; 6.2 |
| 1ST, LST et A:B comptent les passages de la PISTE quand elle est plus courte que le pattern (manuel 10.7.3) (ajoute par la critique) | passages du pattern | avec les longueurs par piste | 6.1 |
| PAGE SETUP : FUNC + YES bascule PER PATTERN / PER TRACK (ajoute par la critique) | non | | 6.1 |
| Enregistrer depuis un clavier MIDI (canal AUTO) : GRID REC, TRIG tenu + note = NOTE et VEL ; LIVE REC, NOTE VEL LEN ; STEP REC, VEL verrouillee, FUNC tenu = VEL du TRIG (manuel 10.2.2 a 10.2.4) (ajoute par la critique) | non | avec RECEIVE NOTES et les notes entrantes (3.12) | 6.2 |
| Lock trigs (FUNC + TRIG en GRID REC) | oui | 16 | 6.0 |
| P-lock (TRIG tenu + potard) ; TRIG + potard presse = retire | oui (double tape retire) | + potard presse | 6.0 |
| 80 parametres verrouilles par pattern | non borne | compteur + `LOCK LIMIT 80` ; la limite ne refuse que les verrous NEUFS : un pattern d'avant qui en a plus les garde tous (sinon la migration en perd) (corrige par la critique) | 6.1 |
| TRIG + PAGE (ou TRK) + potard = verrou sur tous les trigs de la page | non | | 6.1 |
| Preset lock | non (seul `snd`) | | 6.2 |
| Conditions PRE, NEI, 1ST, LST, A:B et negations | 81 conditions dont FILL, !FILL | FILL sort de COND : parametre FILL a part (G, verrou seul) ; FILL / !FILL stockes deviennent FILL ON / OFF a la lecture (liste stockee gardee, filtree au potard) ; NEI = piste n-1 sur 16 | 6.1 |
| PROB et COND independants | COND gagne sur PROB | joue si FILL ET COND ET PROB ; migration : trig avec COND et PROB < 100 recoit un verrou PROB 100 (identite) | 6.1 |
| FLT.T | non | relance l'enveloppe filtre | 6.1 |
| Micro timing : TRIG + LEFT/RIGHT (pop-up), TRIG + FUNC + fleches = tous | potard F de TRIG 1 | fleches en 6.0 (les deux marchent) ; potard retire en 6.1 | 6.0 / 6.1 |
| Retrigs | oui | ordre DT2 | 6.1 |
| QUANTIZE (FUNC + TRIG) : TRACK (E, TRIG = piste), PATTERN (H) | non | agit sur les uTIME stockes | 6.0 |
| 2 a 128 pas, 8 pages ; PAGE = page suivante en GRID REC ; PAGE + TRIG 1-8 ; PAGE + LEFT/RIGHT | 16 pas | | 6.1 |
| Boucle de pages (PAGE + TRIG 9-16, PAGE + NO) | non | | 6.1 |
| PAGE SETUP : PER PATTERN (LENGTH, SPEED 1/8X a 2X) / PER TRACK (LENGTH, SPEED ; CHANGE, RESET) ; PAGE repete, TRIG, FUNC + UP/DOWN | non | | 6.1 |
| PAGE AUTOCOPY | non | | 6.1 |
| Euclidien (FUNC + AMP) : PL1 PL2 LEN EUC / RO1 RO2 TRO OP ; REC bleu ; conversion FUNC tenu | message de place | `audio/euclid.ts` pur + page | 6.1 |
| Pattern actif : FUNC + REC/STOP/PLAY hors GRID REC | oui | - | - |
| Patterns non actifs depuis PTN : TRIG + REC/STOP/PLAY | non | | 6.0 |
| Sequence de piste : FUNC + REC/STOP/PLAY en GRID REC | oui | 16 | 6.0 |
| Trigs avec verrous : TRIG + REC/STOP/PLAY ; page : PAGE + REC/STOP/PLAY | non | | 6.1 |
| Refaire la combinaison annule PASTE ou CLEAR | non (l'UNDO) | | 6.1 |
| Decaler tous les trigs (FUNC + LEFT/RIGHT en GRID REC) | non | | 6.1 |
| Pre-ecoute d'un trig (TRIG + YES) | non | testee au compteur d'evenements, jamais a l'oreille | 6.1 |
| Sauvegarde / rechargement temporaires (FUNC + YES / NO), sans effet en STEP REC | oui | regle STEP REC | 6.1 |
| TRIG MODE (FUNC + UP/DOWN sur l'ecran principal) : TRACKS, VELOCITIES, RETRIGS ; PRESET POOL | non | icone dans l'en-tete ; SLICES hors | 6.1 ; 6.2 |
| 128 patterns, 8 banques | oui (V.5.2) | - | - |
| PTN puis TRIG (blanc / rouge / eteint) ; PTN ou NO sort ; PTN + TRIG | grille HTML | sur les TRIG | 6.0 |
| FUNC + PTN puis TRIG 9-16 = banques A-H | pas 1-8 | TRIG 9-16 | 6.0 |
| Pattern en attente : position qui clignote en haut a gauche | message `NEXT A05: AT THE BAR` | case A01 clignotante | 6.0 |
| Createur de chaine (PTN puis FUNC + YES ; FUNC + LEFT retire ; YES / NO) ; methode legacy | chaine par tapes en 2 s | | 6.2 |
| TEMPO : A BPM 30-300, B FINE (1/10), D SWING 50-80 % | BPM 100-150, swing 50-67 % (FUNC + TRIG) | menu TEMPO (touche) | 6.0 |
| TAP TEMPO (FUNC + TEMPO, moyenne apres 4 tapes) | YES sur la page TEMPO | | 6.0 |
| Metronome : TEMPO + YES ; E METRO, F SIG., G PREROLL, H VOL | non | clic calcule dans le worker, programme par l'horloge | 6.1 |
| Tempo projet / pattern (FUNC + E) ; tempo PREP. (FUNC + A) | global | | 6.2 |
| PLAY / pause, STOP, STOP x2 coupe les queues | oui | - | - |

### 3.4 Mutes

| Fonction DT2 | Deja la | A faire | Ver. |
|---|---|---|---|
| GLOBAL MUTE (FUNC + TRK, vert), PATTERN MUTE (FUNC + TRK deux fois, magenta) | oui sur 8 | 16 ; clignotement des pistes mutees qui ont des trigs | 6.0 |
| Preparation : FUNC tenu + TRIG, applique au relacher | non | | 6.0 |
| Le dernier mode de MUTE (GLOBAL ou PATTERN) est retenu : FUNC + TRK et QUICK MUTE le reprennent (manuel 8.5.3) (ajoute par la critique) | non | | 6.0 |
| Apercu des 16 pistes en en-tete (carre, trait, +, X) | non | | 6.0 |
| Mutes globaux sauves avec le projet | jamais retenus | | 6.2 |
| ROW MUTE (song) | non | | 6.2 |

### 3.5 KEYBOARD

| Fonction DT2 | Deja la | A faire | Ver. |
|---|---|---|---|
| Mode KEYBOARD (touche), octave (KEYBOARD + UP/DOWN ; UP/DOWN seuls si U/D KEY MODE = KB OCT), KB SETUP (FUNC + KEYBOARD : 36 gammes, ROOT, FOLD ; reglages dans le pattern), NOTE PARAM CHRO/SCALE, jeu enregistre en LIVE et STEP REC, pre-ecoute de preset dans la gamme | non | `audio/scales.ts` pur : intervalles des 36 gammes (le manuel ne les donne pas : a ecrire depuis la theorie, avec un test par gamme) | 6.1 |

### 3.6 FX en envoi (FUNC + FX)

| Fonction DT2 | Deja la | A faire | Ver. |
|---|---|---|---|
| DELAY (1/3) : TIME (1/128 de note cale BPM), X (ping-pong), WID, FDBK, HPF, LPF, REV ; VOL | DELAY : TIME (divisions), FEEDBACK, TONE | | 6.1 |
| REVERB (2/3) : PRE, DEC, FREQ, GAIN, HPF, LPF ; VOL | REVERB (convolueur) : SIZE, TONE, PRE | DEC = taille de la reponse ; FREQ/GAIN = plateau apres le convolueur (ecart documente) | 6.1 |
| CHORUS (3/3) en envoi : DPTH, SPD, HPF, WDTH, DEL, REV ; VOL | chorus insert par voix + chorus global | un bus chorus ; l'insert `chorus` d'heritage reste joue pour les sons migres, sans potard | 6.1 |
| Envois croises chorus -> delay, reverb ; delay -> reverb | non | | 6.1 |

### 3.7 MIXER (FUNC + MOD) et routage

| Fonction DT2 | Deja la | A faire | Ver. |
|---|---|---|---|
| COMPRESSOR : THR ATK REL MUP / RAT SCS SCF MIX ; VOL | COMP dans SEND FX (THRESH RATIO ATTACK RELEASE MAKEUP HPF KNEE MIX) | noms et sources DT2 (SCS : COMP MIX, NOT COMP, MAIN, TRK1-16), SCF bipolaire, barre de reduction ; KNEE en 2e sous-page (extra) | 6.1 |
| INTERNAL MIXER T1-8 et T9-16 (TRK LEV) | LEVELS 8 (`level` = AMP VOL) | deux pages de TRK LEV (`tlev`) | 6.0 |
| FX MIXER : E DEL, F REV, G CHR, H MOVD ; A-D vides | non | MOVD = la DIST master d'aujourd'hui ; A-D = extras MM (STRETCH, BIT, BIT RATE, DIST TONE) | 6.1 |
| Pattern volume (LEVEL/DATA sur les pages MIXER) | non | `mix.vol` du kit | 6.1 |
| EXTERNAL MIXER | non | hors ; la place devient la page SCENES (1.3) | 6.0 |
| AUDIO ROUTING : TO MAIN, TO FX (TRIG verts) | non | masques 16 pistes + FX | 6.1 |

Ordre des pages MIXER : 6.0 = INTERNAL 1-8, INTERNAL 9-16, SCENES ; 6.1 = COMPRESSOR, INTERNAL 1-8, INTERNAL 9-16, FX MIXER,
SCENES (FUNC + MOD repete = page suivante, comme la DT2).

### 3.8 SONG et chaines (tout en 6.2)

| Fonction DT2 | Deja la | A faire |
|---|---|---|
| SONG + TRIG 1-16 = song et SONG mode ; 16 songs, 99 lignes + END (LOOP / STOP) | non | `state/songs.ts` |
| SONG EDIT (FUNC + SONG ou SONG deux fois) : LABEL, PTN (FUNC + tourner = banque), ROW PLAY COUNT, ROW LENGTH 2-1024, ROW TEMPO ou tempo de song, swing par ligne, ROW MUTE, pointeur, PLAYHEAD, nom | non | ecran tableau |
| Lecture : en-tete "S01 02/04:VERSE A01" + barre ; STOP puis PLAY reprend ; STOP x2 = debut ; SONG + LEFT boucle la ligne ; SONG + UP/DOWN ; choisir un pattern = sortir | non | ordonnanceur de patterns branche sur l'horloge |
| Edition : FUNC + DOWN insere, FUNC + UP supprime, FUNC + REC/STOP/PLAY sur la ligne, YES sur un numero = pointeur, TRIG = pre-ecoute | non | |
| CREATE ROWS FROM CHAIN ; createur de chaine ; chaine legacy | chaine par tapes | |

### 3.9 PERFORM KIT (6.2)

FUNC + PRESET/KIT : les changements de son ne s'ecrivent plus dans le kit du pattern et le kit n'est plus recharge au
changement de pattern ; "P" clignotant apres le nom, PRESET/KIT orange ; PRESET/KIT + NO = recharge le kit du pattern,
PRESET/KIT + YES = SAVE KIT. Rien d'existant ; demande le kit dans le pattern.

### 3.10 Presets, kits, pool, projets

| Fonction DT2 | Deja la | A faire | Ver. |
|---|---|---|---|
| Kit dans le pattern (16 sons, niveaux, compresseur, routage, Control All, send FX) | sons, FX, tempo globaux | pool de kits dedoublonne par empreinte | 6.2 |
| PRESET (le son d'une piste) : LOAD, SAVE (nom, tags), MANAGE ; panneaux tri (LEFT : ADD TO POOL, BANK, SORT, FILTER, SEARCH) et operations (RIGHT : LOAD TO TRACK, COPY TO BANK, SAVE TO HERE, RENAME, EDIT TAGS, DELETE, SELECT ALL / UNUSED, TOGGLE) | non (preset = toute la machine) | | 6.2 |
| POOL de 128 presets | non | | 6.2 |
| KIT : LOAD, SAVE, MANAGE, LOAD TO EMPTY | liste "KIT" | | 6.2 (6.0 : la liste actuelle sous PRESET/KIT, + RANDOM BEAT) |
| TRIG + PRESET/KIT = son du trig en preset ; TRK + TRIG + NO = recharge le preset | non | | 6.2 |
| Projets : LOAD (CREATE NEW), SAVE AS, MANAGE (CLEAR DELETE RENAME LOAD FROM SAVE TO TOGGLE INIT NEW PURGE ALL) ; FUNC + SETTINGS = sauver | etat de travail autosauve (localStorage) | IndexedDB ; + EXPORT / IMPORT de fichier (remplace SysEx et Transfer, aux memes grains que SYSEX SEND : projet, pattern, preset, kit) ; le fichier de projet embarque en option les samples importes (IndexedDB `mm-v4-rytm-user`), sinon un projet relu dans un autre navigateur perd ses sons (ajoute par la critique) ; projets d'usine proteges | 6.2 |
| Ecran de nommage DT2 (fleches, LEVEL/DATA, FUNC + YES espace, FUNC + NO efface, FUNC tenu = pop-up, SETTINGS = nom au hasard) | NAME des presets (noms au hasard) | un seul ecran pour patterns, presets, kits, projets, songs | 6.2 |
| Contenu d'usine | 10 styles | projet FACTORY (A01-A10) | 6.2 |

### 3.11 SETTINGS

| Entree | Deja la | A faire | Ver. |
|---|---|---|---|
| Le menu (touche SETTINGS, fleches, LEVEL/DATA, YES, NO) | MidiPanel HTML | cadre du menu | 6.0 |
| PATTERN : RENAME, CLEAR (WHOLE PATTERN / KIT DATA / SEQUENCE DATA, confirmation) ; EDIT GRID (extra) | CLEAR par FUNC + PLAY | en 6.0 et 6.1 le kit est GLOBAL : KIT DATA (et la part kit de WHOLE PATTERN) effacerait les sons de TOUS les patterns ; en 6.0 et 6.1, WHOLE PATTERN = SEQUENCE DATA et KIT DATA s'affiche "CLEAR SOUNDS (ALL PATTERNS)" avec une double confirmation ; le sens DT2 arrive en 6.2 (corrige par la critique) | 6.0 |
| PATTERN : SAVE TO PROJ, RELOAD FROM PROJ (x 3) | non | | 6.2 |
| PERSONALIZE : LED INTENSITY, LED BACKLIGHT, REMEMBER SUBPAGE, TRK SELECT | non | | 6.0 |
| PERSONALIZE : U/D KEY MODE, PAGE AUTOCOPY, NOTE PARAM, LIVE REC OVERDUB, PARAM LIVE REC, SCREEN SAVER (extra) | non | | 6.1 |
| AUDIO ROUTING : TO MAIN, TO FX | non | | 6.1 |
| SYSTEM : ABOUT (firmware.json), STORAGE (`navigator.storage.estimate()`) | non | | 6.0 |
| SYSTEM : RESET VIDE, RETOUR USINE, FORMAT (projets/presets/kits ; samples importes), double confirmation | non | | 6.2 |
| PROJECT, SONG | non | 3.8, 3.10 | 6.2 |
| MIDI CONFIG | panneau MIDI HTML (LEARN, Roto) | 3.12 | 6.2 |

### 3.12 MIDI, Roto-Control, boitier

| Fonction | Deja la | A faire | Ver. |
|---|---|---|---|
| Cibles apprenables | 892 (656 `rytm:*`) | face nouvelle, T9-T16, `tlev`, a la fin ; liste construite paresseusement (environ 1 700 cibles RYTM) | 6.0 |
| Cibles des reglages 6.1 et 6.2 | | a la fin | 6.1 / 6.2 |
| SYNC : CLOCK et TRANSPORT RECEIVE / SEND, PRG CH RECEIVE / SEND | horloge et transport envoyes pour l'ARP (`midi/noteout.ts`) | horloge recue 0xF8 lissee, START/CONTINUE/STOP/SPP, program change 0-127 = A01-H16 en file | 6.2 |
| PORT CONFIG (appareils Web MIDI, OUTPUT CH, PARAM OUTPUT CC/NRPN, ENCODER / TRIG KEY / MUTE DEST, RECEIVE NOTES, RECEIVE CC/NRPN) ; CHANNELS (TRACK 1-16, FX CONTROL = OFF par defaut, AUTO = 1, PRG CHG IN/OUT) | non | | 6.2 |
| MAP ELEKTRON : carte CC/NRPN de l'annexe B ([MEN 5.2] a [MEN 5.5]) | LEARN | table fixe ; NRPN en double [MEN 5.7] : le premier de la table garde son numero, les autres recoivent un numero libre documente "MM" ; LEARN gagne toujours ; un Roto reconnu garde sa carte | 6.2 |
| Notes entrantes 0-15 = pistes, 16-84 = piste active chromatique, C0 sur le canal FX = TAP | non | | 6.2 |
| Roto-Control | setups automatiques, RSEQ 8 voix | pages T9-T16 (VOL, MUTE, PAD) ajoutees a la fin ; aucune ligne gelee de `rotoKeys.ts` touchee | 6.0 |
| Boitier MMHW v2 | 14 touches, LED, moteurs | LED des touches nouvelles, 16 pistes en TRK et MUTE (6.0), 8 LED de page (6.1), notes proposees (2.6) | 6.0 / 6.1 |

### 3.13 Hors portee (rappel)

Tout 1.2, plus : la machine MIDI et ses pages, le sample editor, la detection de transitoires, l'economie de RAM du
+Drive. Possible plus tard (hors V.6) : pistes MIDI via `noteout.ts`, filtres COMB en worklet.

---------------------------------------------------------------------------------------------------------------------

## 4. Les 16 pistes libres

Detail complet : [MOD 3] a [MOD 9]. Ce qui suit est la version tranchee.

### 4.1 Le modele

- **Une piste = un index 0..15**, sa CLE de stockage, de MIDI, de scene et de lien :
  `TRACK_KEYS = ['BD','SD','CH','OH','CP','TOM','HT','CY','T9','T10','T11','T12','T13','T14','T15','T16']`.
  Les cles BD..CY deviennent des **noms de piste** (1 a 8), plus des sons : la piste 1 garde la cle `BD` meme avec une
  caisse claire dessus. C'est ce qui rend toutes les donnees d'avant lisibles telles quelles. Alias acceptes a la lecture
  partout (MIDI appris, scenes, verrous, liens v2) : `T1`..`T8` -> `BD`..`CY` (`normTrackKey`) ; jamais ecrits.
  A l'ecran et dans les libelles MIDI : "T1" a "T16" + le nom du son ("T1 BLUEPRINT", "T9 PSY 12").
- **Separer avant d'elargir** : `ShotId` cesse d'etre `Inst` ; `EngineId = 'BD'|'SD'|'CH'|'CHopen'|'OH'|'CP'|'TOM'|'HT'|'CY'`
  (les 9 algorithmes de `shotsdsp.ts`, inchanges), sinon `SHOT_LOUD`, `VARIANTS`, `renderShot` exigent 16 algorithmes.
  `Inst` NE devient PAS un alias de `TrackKey` (corrige par la critique) : il reste le type des 8 cles d'heritage
  (`theme.ts` l. 1062), celui des tables `Record<Inst, ...>` qui restent a 8 (`VOICE_KEYS`, `INST_NAMES`, `PAD_ARIA`,
  `PADS` du telephone, `beatcode.ts` v1) ; `TrackKey` est un type nouveau, adopte usage par usage. Les 123 references a
  `INSTRUMENTS` (boucles a 8 que le compilateur ne signale pas, [MOD 2.1]) se revoient a la main, liste a l'appui dans le
  rapport de B1.
- **Nouveau `audio/tracks.ts`** (types, defauts, migration, store) : `TrackSound { mach, model, snd, fmach?, p, name? }`,
  `TrackVoice { vmode: 'mono'|'poly', choke: 0..4, gated }`, `KitMix { tlev[16], ctlAll, compRoute, scSrc }` (+ `vol` en
  6.1), `Kit16 { v: 1, tracks[16], voice[16], mix }` ; forme stockee en diffs (`StoredKit16`). API : `get of param set
  setMany machine sample voice mix replace swap subscribe(changed: TrackKey[]) tweak sig engine`. Facades `kit` et `voiceFx`
  pendant 6.0 (pour ne pas toucher 187 appels d'un coup), retirees en 6.1 ; elles gardent TOUTE l'API d'aujourd'hui, pas
  seulement `of()` et `tweak()` : les 187 = environ 125 appels `kit.*` (get 37, layerOf 12, value 11, playsWith 10,
  subscribe 9, valueText 8, sig 8, tweak 7, setVoice 6, choice 4...) et 62 `voiceFx.*` (of 35, subscribe 9, set 7,
  setLfo 6, get 4, reset 1) (corrige par la critique).
- **L'espace des reglages = l'espace des verrous** (`LockId`) : un reglage a UN id, le meme pour le son de la piste, le
  P-LOCK, la cible MIDI `rytm:voice:<K>:<id>`, la scene, CONTROL ALL et le lien v2 [MOD 3.4]. Ids nouveaux reserves en P0
  (ajoutes a la fin des listes) : `tlev` (6.0) ; `sus rel amode arst fsus frel fdel fkey frst fbase fwid bwrt br srr srrt
  odrt chr splay sloop l3*` (6.1) ; reglages de trig `fltt ptim port vel fill` (6.1) ; chaine de verrou `prs` (6.2).
- **Le motif** : `Steps = Record<TrackKey, string>` (16 rangees en memoire) ; `serialize` ecrit les rangees 1 a 8 toujours
  et 9 a 16 seulement si non vides (le JSON d'avant octet pour octet) ; `StoredPattern.setup?` (longueur, vitesse,
  6.1) et `kit?` (empreinte du kit, 6.2). `locks.ts` : `STEPS` variable des 6.0 (pas '0' a '127'), pour ne migrer
  qu'une fois. `StepEvent.mask` sur 16 bits ; `SeqState.v` sur 16 ; NEI = piste n-1.
- **Niveaux** : TRK LEV (`tlev`, potard LEVEL/DATA, pages INTERNAL MIXER, non verrouillable, dans le kit, 0.8 = 0 dB) et
  AMP VOL (`level`, verrouillable) sont deux reglages, comme la DT2. Migration : `tlev = 0.8` partout, `level` garde sa
  valeur et son id MIDI (le Roto qui pilote `rytm:voice:<V>:level` pilote toujours le meme son).

### 4.2 Les machines SRC

| Machine (ordre FIGE, son rang entre dans le lien v2) | Moteur | Ce que ca joue |
|---|---|---|
| ONESHOT | la categorie du sample (BD par defaut) | le sample seul, cale sur sa categorie (le chemin d'un sample lock d'aujourd'hui) |
| KICK, SNARE, CL HAT, OP HAT, CLAP, LO TOM, HI TOM, CYMBAL | BD SD CH(+CHopen) OH CP TOM HT CY | la synthese 909 / 808 / MM + la couche SAMPLE (MIX), exactement le son d'une voix d'aujourd'hui |

La banque ("le pool de samples") = les samples du site par categorie (les 8 dossiers) + ceux importes ; un sample se
choisit depuis n'importe quelle categorie sur n'importe quelle piste. Les pistes 9 a 16 partent en ONESHOT, son OFF,
muettes : c'est ce qui garantit l'identite audio. Un fichier importe sur une piste ONESHOT va dans la categorie du sample
de la piste, sinon dans celle de son moteur.

### 4.3 Le comportement de voix (ce qui remplace les `inst === 'BD'`)

| Aujourd'hui | Desormais |
|---|---|
| `inst === 'BD' ? kickBus : bus` | derive : moteur de la piste = BD -> voie du kick (une piste KICK neuve est traitee comme le kick d'aujourd'hui) |
| `chokeBD` / `bdGate` | `vmode = 'mono'` : le coup suivant de la piste coupe le precedent (3 ms avant de frapper) |
| `chokeOH` / `ohGate` | groupe `choke` + `gated` (8 ms) |
| `CHopen` au pad tenu | moteur CH |
| source du sidechain ARP/BASS = BD | piste `mix.scSrc` (0 = T1) |
| GATE partage SD + CP | `p.gate` par piste (la migration le copie sur T2 et T5) |

Migration : BD {mono}, SD {poly}, CH {poly, choke 1, non gated}, OH {mono, choke 1, gated}, CP TOM HT CY {poly} ; T9..T16
{mono} (la DT2). Pistes poly d'heritage plafonnees a 4 sources (la plus vieille coupee en 8 ms).

### 4.4 Ou vit le kit

- 6.0 et 6.1 : un kit GLOBAL (`tracks`, cle `mm.v4.rytm.tracks.1`), comme aujourd'hui `kit` + `voiceFx`.
- 6.2 : chaque pattern a son kit (la DT2) : `kits: Record<empreinte, StoredKit16>` + `slotKit[128]` (pool dedoublonne,
  IndexedDB) ; copier un pattern ne copie que l'empreinte ; FX en envoi, compresseur et TRK LEV entrent dans le kit ;
  BPM et swing par pattern (mode PTN) ou projet (mode PRJ). Le kit du pattern suivant (file, chaine, song) est
  pre-calcule des qu'il est connu ; il se pose a l'heure de la mesure (`applyVoice` programme a une heure, pas tout de
  suite). Migration : chaque emplacement non vide recoit l'empreinte du kit global du moment (rien ne change au
  chargement). Question Q3. Contenu du kit selon le manuel (chapitre 9 : "Compressor and Master distortion settings",
  "LEVEL settings for the audio tracks and the pattern", "Compressor routing and Control all settings", "Send FX") : les
  16 sons, TRK LEV, le pattern VOL, le compresseur, MOVD (la DIST master d'aujourd'hui), COMPRESSOR ROUTING, CONTROL ALL
  CONFIG et les FX en envoi ; STRETCH et BIT (extras MM du FX MIXER, `mm.v4.rytm.stretch.1` global aujourd'hui) a ranger
  avec eux (complete par la critique).

### 4.5 Migration (une fonction, des portes)

- **Une seule fonction pure** `kit16FromLegacy(kit, voices): Kit16` [MOD 4.2] (apres les traductions d'heritage deja en
  place : `foldFamilies`, `KIT_V`, `oldOh`, `fromR2`, `compLegacy`), appelee par : le chargement du store, `presets.apply`,
  `rytmNow` (empreintes : sinon etoile et faux YOUR SOUND), `undo` (etapes anciennes), `share.dataOfBeat`, les presets
  d'usine. Piste i < 8 : `mach` = la famille (toujours la synthese, meme a syn 0), `model`, `snd`, les 19 reglages + LFO
  de la voix, les 10 potards globaux copies sur chaque piste, la couche ; i >= 8 : piste vide.
- **Table par donnee** :

| Donnee | Regle |
|---|---|
| `mm.v4.pattern.3`, `mm.v4.patterns.1` | lus tels quels, rangees 9-16 a zero ; JSON ecrit identique sans piste 9-16 |
| Verrous, trigs, pmutes | cles BD..CY inchangees, `normTrackKey` a la lecture |
| `mm.v4.kit.1` + `mm.v4.rytm.voices.1` | `kit16FromLegacy` -> `mm.v4.rytm.tracks.1` ; vieilles cles jamais effacees en 6.0/6.1, re-ecrites au mieux (pistes 1 a 8) pour qu'un retour arriere du deploiement retrouve son son ; fin de la double ecriture en 6.2 |
| Presets `mm.v4.presets.1` (+ brouillons, empreintes) | `RytmData` v2 avec `tracks` ; `apply` lit v1 (et d'avant R3, d'avant 2026-10-18) par conversion |
| `state/factory.ts` | forme d'ecriture INCHANGEE (lue comme du texte par `scripts/mm-studio-patterns.mjs`) ; conversion au chargement |
| UNDO `mm.v4.undo.1` | `apply` lit les deux formes |
| SHARE | v1 figee lue et ecrite tant que le beat s'y represente (pistes 9-16 vides, machine = famille de la piste, GATE egal sur T2 et T5, potards de kick de T1 et de caisse claire de T2, et, ajoute par la critique, BPM ENTIER de 100 a 150, swing <= 66,7 %, 16 pas, aucun reglage 6.x hors de son depart : `beatcode.ts` borne `BPM_MIN 100` / `BPM_MAX 150` et `STEPS 16`, sinon le lien changerait le tempo en silence) : les liens des pages SEO ne changent pas ; sinon v2 (masque 16 bits, machine, modele, sample, reglages sur une liste FIGEE `TRACK_P_V2`, comportement, mix, puis verrous, trigs, LFO ; environ 4000 caracteres). La v2 est faite de SECTIONS (type + longueur, une section inconnue sautee a la lecture) : 6.1 (128 pas, setup, VEL fine, reglages neufs, LFO 3) et 6.2 ajoutent des sections au lieu d'une v3 ; `TRACK_P_V2` ne recoit que des ajouts a la fin (corrige par la critique) |
| MIDI appris `mm.v4.midi.1` | aucune conversion ; `targetNow` accepte T1..T8 |
| `rytm:kit:<famille>`, `rytm:kit:<potard>`, `rytm:layer:<f>:<p>` | gardes, libelles LEGACY, pointent sur la piste FIXE de la famille (bd -> T1 ... cy -> T8) ; `rytm:kit:gate` ecrit T2 ET T5 |
| Scenes | aucune conversion ; `cleanScenes(raw, normScene)` pour T1..T8 |
| `rotoKeys.ts` | aucune ligne changee ; pages T9-T16 ajoutees a la fin |
| Boitier | `voice: TrackKey` garde + `track: number` + `trackName` ; 16 LED de pas en TRK et MUTE |
| `mm.v4.rytm.page.3` | `vel` complete a 16 |
| Samples importes | inchanges |
| 6.2 : emplacements | chaque emplacement non vide recoit le kit global ; presets d'avant -> patterns des projets FACTORY et MES PRESETS + un kit chacun |
| 6.1 : COND FILL / !FILL ; COND + PROB | FILL ON / OFF a la lecture ; verrou PROB 100 la ou PROB etait ignoree |
| 6.0 : BPM au 1/10 (30 a 300), swing jusqu'a 80 % (ajoute par la critique) | `bpm` decimal et hors 100..150 accepte a la lecture (aujourd'hui `Number.isInteger` et 100..150, sinon rejete : `audio/pattern.ts` l. 389) ; `fx.swing` garde sa loi (1 = 66,7 %) et monte a 1,8 ; un retour arriere vers V.5.3 retombe sur le tempo d'arrivee pour un BPM decimal ou hors 100..150 (accepte, a ecrire dans le rapport) |
| 6.1 : pas 17 a 128, longueur et vitesse, VEL fine (ajoute par la critique) | `steps[K]` reste la chaine de 16 chiffres de la PAGE 1 : les versions d'avant (et 6.0 si rien ne change) remettent a zero toute rangee qui n'est pas `/^[0-9]{16}$/` (`state/patterns.ts validSteps`, `audio/pattern.ts STEPS_RE`) ; les pages 2 a 8 et le setup vont dans des champs NOUVEAUX facultatifs ; 6.0 les lit deja et les recopie tels quels a l'ecriture (un retour arriere de 6.1 vers 6.0 ne perd rien, vers V.5.3 garde la page 1) ; `locks` au-dela de '15' ignores par les versions d'avant (verifie par une fixture) |

### 4.6 Budget CPU et memoire

Mesure hors ligne (aucun son) du calcul des one-shots [MOD 5.1] : 5 a 120 ms de worker par son au desktop (x3 a x5 au
telephone), 17 a 600 Ko. 16 pistes aux sons tous differents : environ 1,6 s de worker a froid au desktop (5 a 8 s au
telephone) et 10 a 20 Mo de cache, dans les budgets actuels (96 Mo / 40 Mo, 240 entrees). Le vrai risque est le fil
principal et la polyphonie, pas la lecture des tampons.

| Poste | Regle | Seuil verifie par sonde |
|---|---|---|
| Tranches 9-16 | construites a la premiere utilisation | au repos le graphe d'aujourd'hui (compte de noeuds identique) |
| Polyphonie | pistes neuves mono (DT2) ; poly d'heritage plafonnee a 4 ; plafond global de sources | <= 48 sources actives au desktop, <= 24 au telephone (`__v4` compteur) |
| Re-programmation de l'horloge | `hitKey` par piste, `askReschedule(piste)` : seuls les coups de la piste tournee sont refaits | 1 piste re-programmee par cran de potard |
| `prepareLocks`, `prepareScenes` | bornes a la piste changee | |
| CHORUS | un bus en envoi (6.1) ; l'insert d'heritage ne se construit que s'il est engage | <= 4 worklets chorus d'heritage, sinon les plus vieux en bypass |
| BR, SRR, OVER (6.1) | calcules dans le worker au rendu du coup (entrent dans la signature) ; un P-LOCK se prepare comme TUNE | zero worklet par piste |
| 3 LFO x 16 en courbe | resolution bornee (24 points par cycle, 512 au plus), rien a DEP 0 | |
| File du worker (6.2) | kit du pattern suivant pre-calcule ; second worker au desktop si `hardwareConcurrency >= 4` | `shots.info().previous` et `fallback` a 0 sur une chaine de kits differents |
| Cibles MIDI | liste construite paresseusement | |
| Stockage | localStorage (5 Mo pour tout le site) jusqu'a 6.1 ; IndexedDB en 6.2 | presets 5 a 8 Ko ; 128 patterns pleins + kits < 2 Mo |
| Indicateur global | rendu hors ligne d'un pattern dense de 16 pistes (verrous, retrigs 1/32, LFO) | rapport temps reel / temps de calcul >= 8 au desktop |

### 4.7 Portes de migration (en plus des portes communes 5.6)

- **Fixtures** capturees en P0 depuis la production V.5.3 : `localStorage` complet du MM-RYTM (motif, 128 emplacements,
  kit KIT_V 4, voix avec LFO, 5 presets dont un d'avant R3 et un d'avant le 2026-10-18, UNDO, MIDI avec `rytm:kit:hh`) et
  3 liens SHARE, dans `scripts/fixtures/rytm-legacy-*.json` (aucune donnee privee).
- **Identite audio** par `scripts/rytm-ident.mjs` (commite en P0, rendus hors ligne, jamais une ecoute) : pattern
  d'arrivee, pattern verrouille, les 10 presets d'usine, un pattern a scenes : ecart <= 1e-6 contre V.5.3. Les rendus de
  reference sont calcules UNE fois sur le commit V.5.3 et commites (`scripts/rytm-ident.golden.json`, comme
  `scripts/arp-bench.golden.json`) ; aucune lane ne les regenere (ajoute par la critique).
- **Idempotence** : charger, sauver, recharger = meme JSON ; un preset charge n'a pas d'etoile.
- **MIDI** : diff du CSV regenere (`npm run docs:midi`) = seulement des lignes ajoutees, chacune a la fin du bloc de sa
  machine ; aucune ligne d'avant changee ni reordonnee. (Corrige par la critique : `scripts/midi-reference.mjs` ecrit le
  CSV par portee, mm808 puis voy, bass, dj, global : une cible RYTM neuve tombe au milieu du fichier, avant les lignes
  voy, jamais "a la fin".)
- **Telephone** : capture 390 x 844 (`?portrait=1`) identique avant/apres en 6.0, hors la bascule 1-8 / 9-16 et hors le
  dessin TEMPO du telephone, qui lit `BPM.min/max` (`rytm/diagrams.ts` l. 206 et 1342) : il garde 100-150 ou l'ecart est
  accepte et ecrit (precise par la critique).

---------------------------------------------------------------------------------------------------------------------

## 5. Les mises en ligne

### 5.0 P0 : la preparation (un seul builder, avant tout, rien ne change a l'ecoute ni a l'oeil)

1. **Pousser V.5.3 (LIVE REC)** : la branche `worktree-agent-a3f84c671ac17ce70` (22 fichiers, +559/-38) est construite et
   verifiee par son builder mais pas relue : relecture contradictoire, corrections, push. Sinon il faudrait la rebaser
   sur un `actions.ts` decoupe. V.5.4 (64 pas), jamais commencee, est absorbee par V.6.1 (128 pas).
2. **Fixtures et sonde d'identite** (4.7), depuis la production V.5.3.
3. **Decoupage pur** (deplacer, ne rien reecrire) :
   - `src/v4/actions.ts` (5372 l., 190 exports) -> `src/v4/actions/*.ts`, `actions.ts` devient un baril
     (`export * from './actions/x'`) : aucun import du reste du code ne change. Modules proposes (lignes actuelles) :
     `shared` (helpers, `gesture`, `eventAt`, `rand`) ; `tracks` (71-313 : padHit, mute/solo/select, trk*) ; `scenes`
     (314-759) ; `nav` (page, resetView 776-803, openSection..stepMachine 1653-1846) ; `steps` (856-1001, 5217-5297) ;
     `patterns` (chainLine..bankKey 1002-1103, clearPattern, randomPattern, randomVoiceSounds 1195-1310) ; `transport`
     (runToggle..modeHold 1104-1194, setTempo, tapTempo) ; `dials` (readout..dialReset 1322-1652, pageDial, anyDial..dialUnit
     2607-2652, 2759-3142) ; `kit` (soundFamily, soundDial, voyDial..tapVelDial 2110-2606) ; `ctlall` (2653-2758) ; `pages`
     (3143-3333, randomPage, reloadPage 5033-5149) ; `locks` (3334-3975) ; `browser` (3976-4524) ; `face` (4525-5032,
     muteModeKey..muteView 5171-5216) ; `phone` (voy*, machines* 1847-1911, 2045-2109) ; `presets` (1912-2044) ; `mixer`
     (mixerInst..seqDial 5298-5372). Chaque module <= 700 lignes. Les `let` de haut de fichier partages passent dans
     `actions/state.ts` (getters/setters), les autres suivent leur unique utilisateur. Imports circulaires entre modules de
     fonctions : permis SEULEMENT sans appel a l'evaluation. Or `actions.ts` en fait au moins 11 a son chargement
     (`trk.subscribe` l. 282, `rytmLock.subscribe` 337, `editor.subscribe` 1092, `setKnobResolver` 1530,
     `setStepResolver` 1532, `setCtlAllResolver` 2716, `patterns.subscribe` 2733, `samplesChanged.subscribe` 3355,
     `onSampleFailed` 4243, `onSampleLoaded` 4253, `func.subscribe` 4543) et porte 27 `let` de module : ces branchements
     passent dans un `actions/wire.ts` importe EN DERNIER par le baril. Une erreur d'ordre (une `const` importee encore en
     zone morte) ne se voit qu'a l'execution : la porte est le smoke et la sonde d'identite, pas le build (corrige par la
     critique). `actions/shared.ts` et `actions/state.ts` sont figes apres P0 (un ajout = un message a l'integrateur).
   - (ajoute par la critique) `debug.ts` (574 l.) -> `debug/` un fichier par lane + index (sinon trois lanes l'ecrivent en
     6.0) ; `dj/actions.ts` l. 1291 recoit sa propre borne de SYNC (100-150) au lieu de `BPM` ; et, a defaut de les
     decouper, les deux moyeux `ui/Hotspots.tsx` (3201 l.) et `scene/renderer.ts` (3703 l.) recoivent des registres
     (zones de face, jumeaux, ordre de tabulation) ou chaque lane ajoute ses entrees dans son fichier.
   - `src/v4/scene/screen.ts` (3958 l.) -> `scene/screen/` : `core` (toile, en-tete, colonne gauche, zones), `grid` (la
     grille 2 x 4 et ses dessins), `menus/` (un fichier par menu : presets, sounds, tempo, mixer...), `popups`, registre
     des menus (id -> dessinateur) ; `screen.ts` baril.
   - `src/v4/rytm/infos.ts` (1463 l.) -> `rytm/infos/` un fichier par domaine + index ; `src/v4/midi/targets.ts` ->
     `midi/targets/` un fichier par groupe, l'index concatene dans un ORDRE FIGE (les groupes d'aujourd'hui d'abord,
     puis des fichiers vides reserves a chaque lane des 3 versions, dans l'ordre de la section 5.5) : le CSV garde son ordre
     et chaque lane n'ajoute que dans son fichier.
   - `theme.ts` : la partie face (FACE_KEY, FACE_KEYS, KEY_LABELS, SILK_TEXTS, HEAD, PAGE_KNOBS, ENCODER, KNOB_RING, KEYS,
     FACE_TITLE, TWIN_ARIA) -> `theme/face.ts` re-exporte par `theme.ts`.
4. **Contrats** (stubs types, sans comportement) : `audio/tracks.ts` (TRACK_COUNT, TRACK_KEYS, TrackKey, normTrackKey,
   LEGACY_KEYS, types 4.1, signature de `kit16FromLegacy`, interface du store en facade sur `kit` + `voiceFx`) ; liste
   complete `FpButtonId` et kinds de zones (2.6) ; forme etendue de `state/dtFace.ts` (`keyboard`, `song`, `menu`,
   `ptnPage`, `live`) ; interface de `state/gesture.ts` ; squelette `actions/chords/` (un fichier par lane) ; registre
   des menus de l'ecran ; ids MIDI reserves (noms figes) ; ids de reglages reserves (4.1) ; (ajoutes par la critique) le
   presse-papiers unique (`state/clipboard.ts` : un objet type a la fois) ; le kind MIDI relatif (`rytm:data`) ; la forme
   des champs de pas 17-128 et du setup que 6.0 doit deja lire et recopier (4.5).
5. **Porte P0** : tsc toujours a 13 erreurs, build, smoke, hw:test, presets:test, firmware check, `docs:midi` sans diff,
   identite audio exacte, liste des exports du baril `actions.ts` identique a l'avant (script de comparaison).

### 5.1 V.6.0 "la face DT2 et les 16 pistes" (gros morceau 1)

Contenu :
- Toute la face de la section 2 (grille A, classes de touches, potards de gauche, LED de page, cadres, decalque, chevrons,
  creme et noir), scenes et fente retirees, telephone intact.
- Le moteur a 16 pistes (E0 de [MOD 7]) et les 16 pistes visibles (E1) : `tracks`, migration, portes 4.7 ; TRK + TRIG
  1-16, TRIG 1-16 jouent les pistes hors REC, GRID REC et LIVE REC sur 16, mutes et quick mute sur 16 (preparation,
  apercu, clignotement), menu MACHINE (SRC), pages SRC par machine (disposition DT2), SOUNDS et SAMPLES, sample lock de
  toute categorie, MIXER (INTERNAL 1-8, 9-16 en TRK LEV, SCENES), LEVEL/DATA = TRK LEV, CONTROL ALL sur 16, copier le son
  d'une piste (TRK + REC/STOP/PLAY), RANDOM BEAT sur les pistes qui ont un son (roles tires de la machine).
- Chaque fonction d'aujourd'hui a sa place DT2 (1.4) : TEMPO (A BPM 30-300, B FINE, D SWING 50-80 ; FUNC + TEMPO = TAP),
  QUANTIZE (FUNC + TRIG), PRESET/KIT (la liste actuelle + RANDOM BEAT, navigation DT2), PAGE (FILL x 3 gestes), fleches
  (menus, PTN + LEFT/RIGHT, TRIG + LEFT/RIGHT = uTIME), PTN sur les TRIG, banques par TRIG 9-16, patterns non actifs
  copies/colles/effaces depuis PTN, pattern en attente clignotant, MAIN VOLUME, SETTINGS (PATTERN : RENAME, CLEAR x3, EDIT
  GRID ; PERSONALIZE : LED, REMEMBER SUBPAGE, TRK SELECT ; SYSTEM : ABOUT, STORAGE), page + YES/NO, potard presse + NO.
- Couche de gestes `state/gesture.ts`, table des accords, clavier 2.7, jumeaux HTML dans l'ordre de lecture de la face.
- MIDI : cibles de la face nouvelle, T9-T16, `tlev` ; Roto pages T9-T16 ; boitier (LED, notes proposees) ; telephone :
  bascule 1-8 / 9-16.
- Inertes "BIENTOT : V.6.1" (dessines, curseur `FACE_INERT`, activation bloquee, message a l'ecran) : KEYBOARD, FUNC +
  KEYBOARD, FUNC + FLTR (SETUP), FUNC + AMP (SEQUENCER), FUNC + PAGE (PAGE SETUP), FUNC + UP/DOWN (TRIG MODE) ;
  "BIENTOT : V.6.2" : SONG, FUNC + SONG, FUNC + PRESET/KIT (PERFORM), FUNC + SETTINGS (SAVE PROJ), FUNC + tourner LEVEL/DATA.
- Firmware : `node scripts/firmware.mjs bump mm808 major "..."` (V.6.0).

Lanes (6 builders, worktrees partant du commit P0 ; proprietaire unique de chaque fichier) :

| Lane | Perimetre | Fichiers (proprietaire) |
|---|---|---|
| B1 MOTEUR | E0 : `tracks` (store, facades, `kit16FromLegacy`), `EngineId`, 16 cles partout dans l'audio, tranches paresseuses, portes mono/choke, route du kick derivee, `scSrc`, `shots` par piste, re-programmation par piste, `tlev`, plafond de sources, rendus hors ligne a 16 | `audio/**` (tracks, pattern, locks, trig, voicefx, kit, shots, shotsdsp, drums, sends, seq, seqhit, lockfx, clock, morph, morphApplier, beats, samples, usersamples), `state/voices.ts`, `rytm/sceneData.ts`, `rytm/sceneParams.ts`, `debug/audio.ts` (P0 decoupe `debug.ts`) |
| B2 PERSISTANCE | presets v2, UNDO, SHARE v1/v2 (`beatcode.ts` v2 a cote de v1), emplacements a 16, usine par conversion, `rytmNow`, fixtures et tests de migration | `state/{patterns,presets,factory,undo,share,rytmPage,presetBpm,tempoSync}.ts` (les deux derniers ajoutes par la critique : BPM entier et SYNC), `audio/beatcode.ts`, `scripts/fixtures/*`, `scripts/presets*.test*`, `scripts/mm-studio-patterns.mjs` (INSTS seulement) |
| B3 FACE 3D | 2.2 a 2.4 : `faceplate.ts` par touche et par classe, `theme/face.ts`, `rytmFaceKeys.ts` (un InstancedMesh par classe, z par touche, looks, 8 LED de page, zones), `sideKnobs.ts` (MAIN VOLUME, LEVEL/DATA), tailles des potards, chevrons, cadres, decalque, retrait de la fente, numeros des pas seuls, repli SVG, test `face:test` | `rytm/faceplate.ts`, `theme.ts` + `theme/face.ts` (seul a ajouter des teintes en 6.0), `scene/{rytmFaceKeys,sideKnobs,encoders,keyCap,keyLabels,silk,machine,sequencer3d,renderer}.ts`, `fallback/StaticMachine.tsx`, `rytm/stepLeds.ts`, `rytm/trigMarks.ts`, `debug/face.ts` |
| B4 SAISIE ET TOUCHES | 2.7 : `gesture.ts`, table des accords 6.0, `dtFace.ts`, pointeur (tapes, tenues, glisser de `mvol`/`data`, inertes), jumeaux, clavier ; handlers des touches (FUNC, TRK, PTN sur les TRIG, REC, PLAY, STOP, YES, NO, PAGE/FILL, fleches, TEMPO/TAP, PRESET/KIT, SOUNDS, SETTINGS, KEYBOARD et SONG inertes) ; pas et mutes sur 16 | `scene/hit.ts`, `ui/Hotspots.tsx`, `hooks/useKeys.ts`, `state/{func,holdLatch,gesture,dtFace,trk,ctl,fill,editor,playhead}.ts` (fill, editor, playhead ajoutes par la critique : FILL passe sur PAGE), `actions/{face,transport,steps,tracks,patterns,nav}.ts`, `actions/chords/chords60.ts`, `debug/input.ts` |
| B5 ECRAN ET MENUS | 2.5 : gabarit DT2 de l'ecran (en-tete, colonne gauche, grille, indicateur, pop-ups), retrait de HOME, `lcd-master`/`lcd-tempo`, pastilles du KIT ; menus MACHINE, TEMPO, QUANTIZE, PRESET/KIT (navigation DT2 + RANDOM BEAT), SOUNDS/SAMPLES, SETTINGS 6.0, MIXER 16 + SCENES ; pages SRC par machine ; potards et dials sur 16 ; INFOS 6.0 | `scene/screen/**`, `rytm/{pages,pageView,values,faceKnobs,presetKeys,infoIds,diagrams}.ts`, `rytm/infos/**`, `rytm/InfosCard.tsx`, `state/{lcd,lcdMix,lcdSamples,presetMode,rytmInfos,sceneCtl,screenDials}.ts` (sceneCtl et screenDials ajoutes par la critique : scenes vers MIXER, `lcd-master`/`lcd-tempo` retires), `actions/{dials,kit,ctlall,pages,locks,browser,presets,mixer,scenes}.ts`, `scene/rytmTweaks.ts`, `debug/screen.ts` |
| B6 MIDI, ROTO, BOITIER, TELEPHONE | cibles (fichiers reserves de `midi/targets/`), `targetNow` T1..T8, Roto T9-T16, `seqlink` sur 16, boitier (snapshot, LED, `FACE_KEYS_HW`, doc, `hw-leds.test.mjs`), telephone (bascule 1-8 / 9-16 sur pads, Dock, BeatEditor, KnobPanel) | `midi/**`, `hw/**`, `docs/hardware/mmhw-v2-app-side.md`, `scripts/hw-leds.test.mjs`, `ui/{Dock,BeatEditor,KnobPanel,MidiPanel}.tsx`, `scene/{pads,rytmPageKeys}.ts`, `actions/phone.ts` (MidiPanel et rytmPageKeys ajoutes par la critique : sans proprietaire) |

Dependances et ordre : B1 et B3 ne dependent que des contrats P0 ; B2 consomme `kit16FromLegacy` (signature P0, corps
B1 : B2 teste avec le corps de B1 des qu'il est pousse sur sa branche, ou une copie locale) ; B4 et B5 codent contre les
contrats (`tracks`, menus, `dtFace`) ; B6 contre les ids reserves. Integration dans l'ordre B1, B2, B3, B4, B5, B6 sur
`rel/v6.0` (merge `--no-ff`) : les seuls conflits possibles sont dans les barils et registres crees en P0 (aucun si
chacun reste dans ses fichiers). Nuance de la critique : c'est vrai pour les conflits de texte, pas pour les conflits de
sens ; `theme.ts` (B3), `ui/Hotspots.tsx` (B4) et `scene/renderer.ts` (B3) recoivent des demandes de B4, B5 et B6 (zones,
jumeaux, `TWIN_ARIA`, `FACE_TITLE`, ordre de tabulation) : sans les registres de P0, compter une journee d'integration.

Verification 6.0 (en plus de 5.6) : identite et fixtures (4.7) ; `face:test` (`faceplateCheck`, aucune piece hors face,
aucun chevauchement, legendes comprises) ; sonde qui compare la place projetee de chaque zone a la grille ; sonde des
looks de chaque touche (`__v4.stage.faceKeys.info()`) dans chaque etat de 2.4 ; sonde "16 pistes" hors ligne (T9-T16 avec
des sons, verrous, retrig : nombre de coups attendu, rapport temps reel) ; sonde de la table des accords (chaque geste de
1.4 et de 3.1 marque 6.0 joue son action, contexte par contexte) ; sonde des menus (ouvrir, naviguer, valider, sortir par
NO, au DOM et a l'etat) ; captures desktop noir et creme (1440 x 900) et telephone (390 x 844).

Taille : environ 6 000 lignes pour B1 + B2 (dont 1 100 nouvelles, 400 de tests), 3 000 pour B3 + B4, 2 000 pour B5,
800 pour B6.

### 5.2 V.6.1 "les pages et le sequenceur DT2" (gros morceau 2)

Contenu : tout ce qui est marque 6.1 en section 3. En bref : pages TRIG 1/2 et 2/2 DT2 (FLT.T, FILL a part, PTIM/PORT,
VEL 1-127, NOTE absolue, COND sans FILL, PROB independante, uTIME hors potard), SRC 2 (forme d'onde) et PLAY a boucles,
FLTR a machines (MULTI, LP4, EQ, LEGACY) et FLTR 2, AMP ADSR/AHD, FX BR/OVER/SRR/CHR, MOD 1-3 et destinations ; SEND FX
DT2 (DELAY, REVERB, CHORUS en envoi, envois croises) ; MIXER DT2 (COMPRESSOR et sidechain, FX MIXER + MOVD + extras,
pattern volume) ; AUDIO ROUTING ; SETUP (KIT : CONTROL ALL CONFIG, COMPRESSOR ROUTING, TRACK SWAP, DUCK SOURCE ; TRACK :
LEGATO ... VELOCITY MOD, VOICE MODE, CHOKE GROUP) ; 128 pas / 8 pages / LED / boucle de pages / PAGE SETUP (vitesses,
CHANGE, RESET) / PAGE AUTOCOPY ; STEP REC ; LIVE REC complet (non quantifie, OVERDUB, PARAM LIVE REC, PREROLL, NO + potard) ;
euclidien ; KEYBOARD et KB SETUP (36 gammes) ; TRIG MODES TRACKS / VELOCITIES / RETRIGS ; copier/coller/effacer de trigs,
de pages, de pages de parametres, annulation par repetition ; decalage des trigs ; verrou sur toute la page ; limite 80 ;
pre-ecoute de trig ; metronome ; nudge ; FUNC + tourner ; tenir une page = toutes les valeurs ; economiseur d'ecran ;
PERSONALIZE 6.1 ; facades `voiceFx`/`kit` retirees ; telephone : bascule de page du pattern.
Firmware V.6.1 (`bump mm808 minor`).

Prep P1 (un builder, court) : ids de reglages et de cibles 6.1 fixes ; `rytm/pages.ts` (876 l.) decoupe par page
(`rytm/pages/*.ts`, un fichier par touche de page + SEND FX, MIXER, SETUP) ; points d'accroche de l'horloge pour la
longueur et la vitesse par piste (interface) ; registre des pop-ups.

Lanes (5 builders) :

| Lane | Perimetre | Fichiers (proprietaire en 6.1) |
|---|---|---|
| C1 SON | moteur des pages : filtres a machines, ADSR, base-width, BR/SRR/OVER au worker, CHR et bus chorus, DELAY/REVERB DT2, envois croises, LFO 3 et destinations, compresseur DT2 (SCS, SCF, routage), MOVD, TO MAIN / TO FX, portamento, FLT.T, clic du metronome (son), retrait des facades | `audio/{tracks,drums,shots,shotsdsp,shots.worker,sends,lfo,seqhit,lockfx,kit,voicefx,morph,morphApplier,duck,fx,insert,chorus}.ts` (fx, insert, chorus ajoutes par la critique : le bus chorus, OVER et le compresseur DT2 y vivent), worklets |
| C2 SEQUENCEUR | 128 pas et pages, longueur et vitesse par piste, CHANGE/RESET, STEP REC, LIVE REC complet, euclidien (`audio/euclid.ts`), gammes (`audio/scales.ts`) et jeu au clavier, TRIG MODES, COND/FILL/PROB et migration, VEL 1-127, copier/coller fins, decalage, verrou de page, limite 80, nudge, programmation du metronome, pre-ecoute de trig (evenement) | `audio/{pattern,trig,seq,clock,locks,euclid,scales}.ts`, `state/{patterns,rytmLock,dtFace}.ts`, `actions/{steps,transport,patterns}.ts`, `actions/chords/chords61seq.ts` |
| C3 PAGES ECRAN | toutes les pages DT2 a l'ecran (grilles, dessins, verrous inverses, cadenas), SETUP, SEND FX, MIXER, pop-ups (uTIME, PAGE SETUP, TRIG MODE, KB SETUP, QUANTIZE etendu), page euclidienne, surcouche "toutes les valeurs", forme d'onde, economiseur ; dials et valeurs | `scene/screen/**`, `rytm/pages/**`, `rytm/{pageView,values,faceKnobs,diagrams}.ts`, `actions/{dials,pages,mixer,ctlall,kit,locks}.ts` |
| C4 FACE ET GESTES | touche KEYBOARD et octaves, fleches completes (uTIME seul chemin, nudge, decalage), PAGE en GRID REC (pages, boucle), LED de page vivantes, looks bleus/verts (euclidien, STEP REC, boucle, cases), page + PLAY/REC/STOP, TRIG + REC/STOP/PLAY, potard presse, Alt + glisser, clavier 6.1, jumeaux | `scene/{rytmFaceKeys,sequencer3d,renderer,hit}.ts`, `ui/Hotspots.tsx`, `hooks/useKeys.ts`, `state/gesture.ts`, `theme.ts` (seul a ajouter des teintes en 6.1), `actions/face.ts`, `actions/chords/chords61face.ts` |
| C5 MIDI, BOITIER, TELEPHONE, INFOS | cibles des reglages 6.1 (a la fin), Roto (pages ajoutees), LED de page au boitier, telephone (bascule de page, joue les nouveaux reglages), INFOS de toutes les pages et gestes 6.1, PERSONALIZE 6.1 | `midi/**`, `hw/**`, `ui/{Dock,BeatEditor,KnobPanel}.tsx`, `scene/pads.ts`, `rytm/infos/**`, `rytm/infoIds.ts`, `state/settings.ts` |

Frontiere C1 / C2 : C2 decide QUAND et QUOI joue (evenements de pas avec leurs reglages de trig), C1 decide COMMENT ca
sonne (le coup). Contrat P1 : le type `StepEvent` etendu (`vel`, `fltt`, `port`, `ptim`, `fill`) fige avant de commencer.
Frontiere C2 / C4 : C2 fournit les actions de sequenceur, C4 les branche aux touches et aux LED. Integration : C1, C2,
C3, C4, C5.

Verification 6.1 : identite audio avec tous les reglages neufs a leur depart (<= 1e-6) ; une mesure hors ligne par
reglage neuf (exemples : LP4 a FREQ 64 retire plus d'energie au-dessus de la coupure qu'un biquad LP ; BR 4 bits donne
16 niveaux ; SUS 64 tient le niveau attendu entre DEC et REL ; LFO 3 sur PAN deplace l'image ; CHR envoie au bus) ;
sequenceur en tests purs et hors ligne (positions sur 128 pas, polymetrie par piste, CHANGE/RESET, STEP REC
STANDARD/JUMP, euclidien OR/XOR/AND/SUB, 36 gammes contre leurs intervalles, FOLD, TRIG MODES, COND avec FILL migre, PROB
+ COND migre, LIVE REC a heures simulees avec et sans quantification) ; metronome et pre-ecoute comptes en evenements
programmes, jamais entendus ; budget CPU (4.6) : 1 piste re-programmee par cran, sources <= 48, rapport temps reel >= 8 ;
telephone (joue un pattern de 64 pas et ses nouveaux reglages, capture).

Taille : environ 3 500 lignes (son et pages, dont 1 300 d'ecrans et INFOS) + 2 500 (sequenceur et gestes).

### 5.3 V.6.2 "la structure DT2" (gros morceau 3)

Contenu : tout ce qui est marque 6.2 en section 3 : kit dans le pattern (pool par empreinte), BPM et swing par pattern
(PRJ / PTN, PREP.), PERFORM KIT, PRESET de piste (save, load, manager, tags, tri, recherche, protection), POOL et preset
locks (TRIG + LEVEL/DATA), TRIG MODE PRESET POOL, KIT (save, load, manager, LOAD TO EMPTY), FUNC + tourner LEVEL/DATA,
TRIG + PRESET/KIT, TRK + TRIG + NO ; projets (IndexedDB, CREATE NEW, SAVE AS, MANAGE, EXPORT/IMPORT de fichier, projets
FACTORY et MES PRESETS issus des presets d'avant) ; PATTERN SAVE/RELOAD FROM PROJ ; page + NO depuis l'etat sauve ; SONG
complet ; createur de chaine et chaine legacy ; ecran de nommage DT2 ; SETTINGS complet (PROJECT, SONG, SYSTEM RESET VIDE,
RETOUR USINE, FORMAT) ; mutes globaux sauves avec le projet ; MIDI CONFIG (SYNC, PORT CONFIG, CHANNELS, MAP ELEKTRON,
notes entrantes, program change, enregistrement depuis un clavier MIDI) ; fin de la double ecriture des vieilles cles
SEULEMENT dans un V.6.2.1, une fois la 6.2 validee en ligne (corrige par la critique : en 6.2.0 un retour arriere vers 6.1
perdrait tout ce qui a ete fait depuis la mise en ligne ; la 6.2.0 continue d'ecrire la projection localStorage du pattern
actif et des 128 emplacements). Firmware V.6.2.

Prep P2 (un builder, court) : couche de stockage `state/store/idb.ts` (interface, migration localStorage -> IndexedDB
avec repli si IndexedDB est indisponible), point d'accroche de l'horloge "fournisseur du pattern suivant" (utilise par la
chaine et le song sans que leurs lanes touchent `clock.ts`), API "poser un kit a une heure" dans `drums.ts` (stub),
registre des menus 6.2, ids reserves (`prs`, cibles 6.2).

Lanes (5 builders) :

| Lane | Perimetre | Fichiers (proprietaire en 6.2) |
|---|---|---|
| D1 DONNEES | kit dans le pattern, pool de kits, projets et IndexedDB, PATTERN SAVE/RELOAD, BPM/swing par pattern, migration des 128 emplacements et des presets d'avant (projets FACTORY et MES PRESETS + kits), UNDO par emplacement, pre-calcul du kit suivant, kit a l'heure de la mesure, lecture des preset locks dans le moteur, fin de la double ecriture | `state/{patterns,projects,store/**,presets,factory,undo,share}.ts`, `audio/{tracks,drums,shots,clock}.ts` |
| D2 PRESETS, KITS, POOL, PERFORM | stores pool et presets de piste, menus PRESET/KIT (LOAD SAVE MANAGE, tri, operations, tags, recherche), ecran de nommage DT2, preset lock (UI et ecriture du verrou `prs`), TRIG MODE PRESET POOL, PERFORM KIT, FUNC + LEVEL/DATA, TRIG + PRESET/KIT, TRK + TRIG + NO | `state/{pool,trackPresets,perform}.ts`, `audio/presetlock.ts` (pur, consomme par D1), `scene/screen/menus/{preset,kit,naming}.ts`, `actions/presets.ts`, `actions/chords/chords62kit.ts` |
| D3 SONG ET CHAINES | `state/songs.ts`, ordonnanceur de song (via le point d'accroche P2), SONG EDIT, lecture, ROW MUTE, tempo de ligne, END, CREATE ROWS FROM CHAIN, createur de chaine, chaine legacy, gestes SONG | `state/songs.ts`, `audio/songplay.ts`, `scene/screen/menus/{song,chain}.ts`, `actions/song.ts`, `actions/chords/chords62song.ts` |
| D4 SETTINGS ET MIDI CONFIG | arbre SETTINGS complet, SYSTEM, MIDI CONFIG (sync recue/envoyee lissee, transport, program change, appareils, canaux, MAP ELEKTRON, notes entrantes, TAP par C0), cohabitation avec LEARN et le Roto ; tests avec un faux `MIDIAccess` injecte | `state/settings.ts`, `midi/**`, `scene/screen/menus/settings*.ts`, `actions/settings.ts`, `actions/chords/chords62settings.ts` |
| D5 FACE, INFOS, TELEPHONE, BOITIER | looks 6.2 (PRESET/KIT orange, SONG), touches inertes reveillees, indices, INFOS de tout 6.2, telephone (joue le song actif, liste des projets a la place des presets), boitier (SONG, PRESET/KIT) | `scene/rytmFaceKeys.ts`, `theme.ts`, `ui/Hotspots.tsx`, `hooks/useKeys.ts`, `rytm/infos/**`, `ui/{Dock,BeatEditor}.tsx`, `hw/**` |

Integration : D1, D2, D3, D4, D5.

Verification 6.2 : migration des 128 emplacements (chacun recoit le kit global, identite au chargement) ; changement de
pattern a la mesure entre kits differents sans son de remplacement (`shots.info().previous` et `fallback` a 0 sur une
chaine A01 > A02 > A03, rendu hors ligne) ; stockage < 2 Mo pour 128 patterns pleins ; aller-retour EXPORT/IMPORT
octet pour octet ; repli sans IndexedDB (navigation privee : la machine demarre, rien ne plante) ; preset locks : le
journal d'evenements hors ligne montre le bon son par pas ; song : ordre, nombre de passages, longueurs, tempo de ligne,
ROW MUTE, END LOOP/STOP au journal d'evenements ; PERFORM KIT (le kit n'est pas recharge, NO recharge, YES sauve) ; MIDI
CONFIG contre un faux `MIDIAccess` (horloge a 24 PPQN avec gigue, program change, notes 0-15 et 16-84, CC et NRPN de la
carte, aucun echo) ; presets d'usine en projet FACTORY : rendu identique a leur version preset.

Taille : environ 3 000 lignes (donnees, pool, presets de piste, preset locks, IndexedDB, UNDO) + 2 500 (song, settings,
MIDI, INFOS).

### 5.4 Pourquoi cet ordre

- 6.0 d'abord parce que c'est ce que Mika voit et ce qui peut casser des sauvegardes : la face et le modele 16 pistes sont
  les deux fondations, et la migration se verifie sans rien regarder (identite, fixtures).
- 6.1 ensuite parce que les pages et le sequenceur ne touchent pas la structure des donnees (ils ajoutent des reglages a
  la fin des listes) : on peut les mettre en ligne sans risque sur les sauvegardes.
- 6.2 en dernier parce que le kit dans le pattern, les projets et IndexedDB changent la maniere dont tout est range ; on
  le fait quand le reste est stable, avec un retour arriere possible (vieilles cles encore ecrites jusqu'a 6.2).

### 5.5 Regles du parallele (worktrees)

- Chaque lane : `git worktree add .claude/worktrees/v6x-<lane> -b v6x/<lane> <commit de prep>` ; elle ne modifie QUE ses
  fichiers (tableaux ci-dessus). Un besoin dans le fichier d'une autre lane = un message a l'integrateur, jamais un
  commit. Les teintes nouvelles passent par le proprietaire de `theme.ts` de la version.
- Fichiers partages par construction (barils, index des registres, `firmware.json`, `docs/midi/*`, CSV) : seul
  l'integrateur les touche. Les registres (cibles MIDI, accords, menus, INFOS) ont un fichier par lane, crees vides par la
  prep, dans un ordre fige : l'ordre des cibles MIDI dans le CSV ne depend pas de l'ordre de fin des lanes.
- Ordre des fichiers reserves de `midi/targets/` : groupes d'aujourd'hui, puis `face60`, `tracks60`, `phone60`,
  `pages61`, `seq61`, `face61`, `kit62`, `song62`, `settings62`, `face62`.
- Chaque lane commite petit, avec la ligne d'attribution du projet ; elle fait tourner les portes 5.6 sur sa branche
  avant de rendre ; elle rend un rapport court (fichiers, decisions, ce qui reste) que l'integrateur fond dans le rapport
  de session.
- Integration sur `rel/v6.x`, dans l'ordre donne ; puis **relecture contradictoire independante** (un agent qui n'a pas
  construit : bugs, ecarts a ce cahier, ids MIDI, migration, sondes) ; corrections ; verification complete refaite sur la
  branche integree ; firmware ; rapport de session `docs/reports/2026-MM-JJ-rytm-v6x-*.md` (CLAUDE.md) ; commit et push
  sur la branche de travail (deploiement GitHub Pages environ 1 min) ; controle en ligne au DOM.
- Le projet est sur iCloud Drive chez Mika : builds lents, `git log` lent ; garder les worktrees sous `.claude/worktrees/`
  et les supprimer apres integration.

### 5.6 Portes communes (chaque lane, chaque integration)

- `npx tsc --noEmit -p .` : toujours 13 erreurs (les connues), jamais une de plus.
- `SEO_OFFLINE=1 npm run build` ; `node scripts/smoke-v4.mjs` (3 machines x 2 dispositions) ; `npm run hw:test` ;
  `npm run presets:test` ; `node scripts/firmware.mjs check` ; `npm run face:test` (nouveau, 6.0) ; `node
  scripts/rytm-ident.mjs` (nouveau, P0) ; `npm run docs:midi` puis diff (ajouts seulement, a la fin du bloc de leur
  machine : 4.7).
- Sondes Playwright **muettes** : Chromium headless `--mute-audio`, URL `?mute=1&debug=1&m=mm808`, etat lu par `__v4`
  (`stage.faceKeys.info()`, `encoders.info()`, `sideKnobs.info()`, `tracks`, `clockDebug`, `shots.info()`), le DOM
  (`aria-pressed`, classes, jumeaux) et l'analyseur avant le master ; aucune pre-ecoute declenchee "pour voir" ; jamais
  un navigateur visible sur la machine de Mika. Si une ecoute reelle est indispensable, elle est demandee a Mika.
- Pas de tiret cadratin ni demi-cadratin dans le code, les textes, les rapports ; reponses en francais.

---------------------------------------------------------------------------------------------------------------------

## 6. Questions pour Mika (seulement celles qui changent le resultat)

**Reponses de Mika (2026-10-30), toutes sur la recommandation :** Q1 sa taille 256 x 156 et son ecran 4,3 pouces ;
Q2 les scenes A/B quittent la face et vivent dans une page MIXER (MIDI, Roto, boitier gardes) ; Q3 le kit dans le
pattern, comme la Digitakt ; Q4 la touche SAMPLING devient SOUNDS (FUNC + SOUNDS = importer tes fichiers). Le reste de
la liste "on avance avec ces choix" vaut aussi. Decision de l'integrateur sur la critique C3.1 : le moteur a 16 pistes
et la double ecriture (B1 + la partie lecture de B2) sortent d'abord seuls, invisibles, en V.5.9, avant la V.6.0.

1. **Q1, la taille de la face** : on garde ta face 256 x 156 et ton ecran 4,3 pouces, avec la disposition exacte de la
   Digitakt dessus (recommande), ou tu veux les proportions de la Digitakt (machine plus profonde, ecran plus petit,
   3,8 pouces) ?
2. **Q2, les scenes A/B et le crossfader** (Octatrack, pas Digitakt) : ils quittent la face mais restent vivants dans une
   page du MIXER, au MIDI, au Roto et sur ton boitier (recommande) ; ou on les retire completement ; ou tu les veux
   absolument sur la face (ca casse le placement Digitakt) ?
3. **Q3, les sons dans le pattern** (V.6.2) : comme la Digitakt, chaque pattern aura ses propres sons ; changer de pattern
   changera le kit (au depart, tous tes patterns gardent les sons d'aujourd'hui). On y va (recommande), ou tu preferes des
   sons communs a tous les patterns comme maintenant ?
4. **Q4, la touche SAMPLING** : on la garde a sa place sous le nom SOUNDS (le navigateur de ta banque de sons, FUNC +
   SOUNDS = importer tes fichiers ; recommande), ou tu veux une place vide comme une touche aveugle ?

On avance avec ces choix sauf avis contraire (pas besoin de reponse) : mots plutot que pictogrammes sur les touches ;
telephone garde sa face, avec une bascule 1-8 / 9-16 ; UNDO, OPEN, INFOS, SHARE, RANDOM BEAT gardes ; HOME devient
l'economiseur d'ecran ; pistes 9-16 monophoniques comme la Digitakt, 1-8 gardent leur comportement d'aujourd'hui ;
chorus en envoi ; BPM 30 a 300 ; pas de pistes MIDI ni de modulations de clavier MIDI ; MIDI CONFIG (sync, carte
Elektron) en dernier dans V.6.2 ; fleches du clavier : changent toujours de machine sauf quand un menu de la machine est
ouvert ou qu'une touche est tenue ; ton boitier MMHW v2 continue de marcher tel quel, les touches nouvelles ont des
notes proposees a confirmer avec `protocol.js`.

---------------------------------------------------------------------------------------------------------------------

## Critique

Relecture contradictoire du 2026-10-30, en lecture seule : le manuel (`m2.txt`, chapitres 3 a 17 et annexes A a D relus
ligne a ligne), la page 12 rendue a 110 et 300 dpi (`scratchpad/dt2/crit/p12-012.png`, `scratchpad/dt2/crit/hi-012.png`),
et le code (`src/v4`, branche `claude/mauditemachine-dev-ipq3x5`, commit 53251ad). Les corrections evidentes sont faites
dans le texte et marquees "(corrige par la critique)" ou "(ajoute par la critique)". Le reste est a trancher par
l'integrateur (I) ou par Mika (M).

### C1. Fonctions DT2 (hors sampling) qui manquaient a la table des ecarts

Ajoutees dans la section 3 (ou 4) :
1. Defilement rapide FUNC + UP/DOWN = une page de liste (manuel 6.3) : absent du cahier ET des inventaires.
2. Presse-papiers UNIQUE (6.4) : dans [SEQ] et [MEN], pas dans le cahier ; pose en P0, sinon chaque lane fait le sien.
3. Memoire du dernier mode de MUTE pour FUNC + TRK et QUICK MUTE (8.5.3).
4. LFO : MULT DT2 en deux familles (BPM et 120 BPM fixe, 1 a 2K) contre 8 valeurs aujourd'hui (`LFO_MULTS`) ; SLEW quand
   WAVE = RND (absent du code) ; apercu et validation de DEST, FUNC + tourner par sections ; LFO vers LFO (annexe C) ;
   BR, SRR, OVER precalcules ne se modulent qu'au coup.
5. STEP REC : les gestes fins du manuel 10.2.4 (pas actif, FUNC + TRIG n, KEYBOARD + TRIG, NO = silence, YES tenu = LEN,
   JUMP, FUNC + YES/NO sans effet).
6. Les actions des TRIG MODES s'enregistrent en LIVE REC (8.5.4).
7. 1ST, LST, A:B comptent les passages de la PISTE quand elle est plus courte que le pattern (10.7.3).
8. FUNC + YES dans PAGE SETUP bascule PER PATTERN / PER TRACK (10.7).
9. Enregistrer depuis un clavier MIDI (GRID, LIVE, STEP, canal AUTO) : le cahier prevoyait de jouer, pas d'ecrire.
10. Contenu du kit en 6.2 selon le manuel 9 : MOVD, pattern VOL, CONTROL ALL CONFIG, COMPRESSOR ROUTING (et ou ranger
    STRETCH et BIT, extras MM).
11. EXPORT / IMPORT aux grains de SYSEX SEND (projet, pattern, preset, kit) ; samples importes embarques en option.
12. Limite de 80 verrous : seulement pour les verrous neufs (sinon la migration en perd).

A detailler par la lane concernee (pas ajoute, ce ne sont pas des evidences) :
- ONESHOT TUNE : la DT2 va a +/- 5 octaves (60 demi-tons ; FUNC + tourner = octaves, presser + tourner = demi-tons) ; le
  cahier borne le moteur a +/- 36 : ecart a ecrire en 3.2 et dans INFOS (M si ca compte pour lui).
- FLTR LEGACY : sur la DT2, LP ou HP 2 poles seulement ; le BP d'aujourd'hui devient un extra MM a nommer.
- AMP : HOLD = NOTE (la tenue suit le note off) n'est pas ecrit dans la ligne AMP.
- Liste des samples : FUNC + YES = pre-ecoute (environ 10 s), FUNC + RIGHT / LEFT = entrer / sortir d'un dossier (les
  8 categories de la banque comme dossiers), FUNC + YES sur SAMP = aller au slot.
- PRESET / KIT : SHOW ALL SLOTS, banques A-H de 256 presets, banques de kits, deux premiers tags montres dans la liste.
- KEYBOARD : transposition bornee a +4 / -5 octaves ; l'octave visible n'est pas sauvee dans le pattern (KB SETUP l'est).
- Ecran de nommage : copier / coller / effacer y marchent aussi.
- CONTROL ALL touche toujours la piste active, meme decochee dans CONTROL ALL CONFIG.
- SONG : ROW LENGTH affiche K00 a K24 au-dela de 999 ; le song choisi = le dernier joue ou edite ; les songs sont
  autosauves dans l'etat de travail, pas dans le projet.
- Economiseur : la DT2 baisse l'ecran a 5 min ET l'eteint a 60 min.
- PROGRAM CHG IN / OUT CH acceptent AUTO.
Hors ces points, ce qui reste du manuel est le sampling, le materiel, Overbridge, SysEx, OS ou les pistes MIDI (1.2).

### C2. Le placement contre la page 12

- Les centres DT2 du tableau 2.2 sont justes : remesures sur la page 12 a 110 dpi (panneau x 205..741, y 233..672 px), a
  0.004 pres partout, soit moins de 1 mm sur la DT2 (exemples : MAIN VOLUME 0.080 / 0.185, LEVEL/DATA 0.080 / 0.326,
  FUNC 0.091 / 0.510, KEYBOARD 0.601, TRK 0.70, PTN 0.80, SONG 0.897, menus 0.201 / 0.276 / 0.353 / 0.427, transport
  0.216 / 0.315 / 0.414, potards 0.550 / 0.672 / 0.793 / 0.916, touches de page 0.547 a 0.920, YES 0.556, NO 0.647, LED
  0.903 / 0.558, PAGE 0.907 / 0.647, pas des TRIG 0.0989). Les alignements de 2.2 sont ceux de la figure.
- Corrige : KB OCT dans le cadre des fleches (comme la figure) ; jeux entre cadres (0 mm -> 1 mm) ; bas du cadre des
  fleches qui coupait les legendes uTIME- / TRIG MODE / uTIME+ ; logo M qui touchait la legende PRESET POOL.
- `gridA2.py` ne controle ni les legendes des potards de gauche, ni KB OCT, ni les cadres, ni la boite des LED recalee :
  `face:test` doit les controler (ajoute en 2.2).
- Ecarts voulus, a juger a la capture : transport centre sous l'ecran (la DT2 l'aligne sur TRIG 1-3) ; menus et YES sur
  une meme rangee (la DT2 decale sa grille de droite d'environ 8 mm) ; mots au lieu des pictogrammes ; TRIG 22 x 19 alors
  qu'ils sont carres sur la DT2 (17.6 x 17.6 ; 19 x 19 tient au meme pas si Mika les veut carres) ; logo de marque a
  gauche.
- La fenetre des LED de page est en creux sur la DT2 : un simple trait ne la rend pas (precise en 2.3).

### C3. Le plan de mise en ligne

Ce qui tient : l'ordre 6.0, 6.1, 6.2 (la structure en dernier), les ids MIDI seulement ajoutes, les vieilles cles
reecrites, les sondes muettes, le telephone derriere `!PORTRAIT`, une prep courte avant chaque version.

A corriger ou a trancher :
1. (I, recommande fortement) [MOD 7] conseillait de mettre E0 (le moteur a 16 pistes, invisible) en ligne SEUL : c'est
   "la seule etape qui peut casser des sauvegardes". Le cahier le fond dans V.6.0 avec toute la face : un bug de
   migration sortirait avec 12 000 lignes de face et de gestes, et un retour arriere enleverait aussi la face. Proposition :
   un P0b (V.5.9) = B1 + la lecture et la double ecriture de B2, rien de visible, portes d'identite et fixtures, en ligne
   quelques jours avant 6.0. Ce n'est pas un "gros morceau" pour Mika (rien ne change a l'oreille ni a l'oeil) et ca
   separe les deux risques de la 6.0.
2. (corrige, 4.5) Retour arriere de 6.1 vers 6.0 ou V.5.3 : des pas 17-128 ecrits dans `steps[K]` remettraient les
   rangees a zero (`validSteps`, `STEPS_RE /^[0-9]{16}$/` des versions d'avant). Page 1 dans `steps`, le reste dans des
   champs nouveaux que 6.0 lit et recopie deja.
3. (corrige, 4.5) SHARE : la v2 figee en 6.0 ne portait pas 6.1 ; v2 a sections. La v1 doit aussi verifier BPM entier
   100-150, swing <= 66,7 % et 16 pas, sinon le lien change le tempo en silence.
4. (corrige, 1.3) BPM 30-300 et swing 80 % : `rytm:enc:tempo` et `rytm:enc:swing` (setup Roto RYTM) auraient change de
   course, `dj/actions.ts` (SYNC des platines) lit `BPM`, et `scripts/presets-bpm.test.mjs` code 100-150 et le BPM entier
   en dur (la porte `presets:test` aurait casse des l'integration de B1).
5. (corrige, 5.3) La fin de la double ecriture passe en 6.2.1 ; en 6.2.0 un retour arriere vers 6.1 perdrait tout.
6. (corrige en partie, 5.1 et 5.2) Proprietaires manquants : `state/{presetBpm,tempoSync,fill,editor,playhead,sceneCtl,
   screenDials}.ts`, `ui/MidiPanel.tsx`, `scene/rytmPageKeys.ts`, `dj/actions.ts`, `debug.ts` ("partie audio" n'est pas un
   proprietaire) ; en 6.1, `audio/{fx,insert,chorus}.ts` pour C1. Reste (I) : `ui/Lcd.tsx`, `ui/OverviewHelp.tsx`,
   `index.tsx` (reconstruit le Stage a chaque apparence) et le meme crible pour les lanes 6.1 et 6.2 (ex. C2 et C4 se
   partagent `state/dtFace.ts` et `state/gesture.ts` par sens, pas par fichier).
7. (I, ajoute en P0) Les moyeux `ui/Hotspots.tsx` (3201 l.), `scene/renderer.ts` (3703 l.) et `theme.ts` (3055 l.) ne
   sont pas decoupes ; B4, B5 et B6 y ont tous besoin d'entrees (zones, jumeaux, `TWIN_ARIA`, `FACE_TITLE`, ordre de
   tabulation). Registres en P0, sinon integration en serie et une journee de plus.
8. (corrige, 4.7 et 5.6) Portes : "CSV, lignes ajoutees a la fin" etait faux par construction (le CSV s'ecrit par
   machine) ; la capture du telephone bougera par le dessin TEMPO qui lit `BPM` ; les rendus de reference de l'identite se
   figent sur le commit V.5.3.
9. (I) Taille : 6.0 fait environ 12 000 lignes ; la seule relecture contradictoire apres integration arrive trop tard pour
   B1 et B2 : les faire relire par un agent neuf AVANT leur fusion (ce sont elles qui peuvent casser des sauvegardes).
10. (I) 6.0 publie `rytm:keyboard` et `rytm:song` au MIDI alors que leurs touches sont inertes : MIDI LEARN apprendra des
    cibles qui ne font rien ; mettre "SOON" dans le libelle, retire a l'activation (le libelle peut changer, pas l'id).
11. (M, avec Q3) Le kit dans le pattern change aussi ce que sont les presets d'aujourd'hui (projets FACTORY et MES
    PRESETS) et le telephone perd sa liste de presets au profit des projets (D5) : le dire a Mika avec Q3.
12. (I) P0 : le point 1 (pousser V.5.3) suppose sa relecture contradictoire ; les fixtures "depuis la production V.5.3"
    sont des etats fabriques en headless sur le site en ligne (le vrai `localStorage` de Mika n'est que chez lui) : en
    ajouter une capturee par Mika lui-meme si possible (export de son `localStorage` MM-RYTM, sans `data/`).

### C4. Les affirmations sur le code

Verifiees justes dans `src/v4` : `actions.ts` 5372 l. et 190 exports ; `scene/screen.ts` 3958 ; `rytm/infos.ts` 1463 ;
`rytm/pages.ts` 876 ; `midi/targets.ts` 679 ; CSV 892 cibles dont 656 mm808 ; `DT_HEX_DARK` / `DT_HEX_LIGHT` (valeurs
exactes) ; `DT_GESTURE.pageArmMs` 1500 ; `FACE_INERT` vide (l'activation n'est pas bloquee) ; `SCREEN_TOUCH = PORTRAIT` ;
le piege `stepLabels` (`sequencer3d.ts` l. 389) ; `slotParts` (`machine.ts` l. 344) ; `presetKeys.ts realU` ; zones
`lcd-master` / `lcd-tempo` ; `rytm:fill` anime `yes` (`targets.ts` l. 484) ; `rytm:page` deja pris ; 2 LFO, 11
destinations, 7 formes, 5 modes ; `VEL_GAIN` a 10 valeurs ; COND gagne sur PROB (`audio/seq.ts` l. 209) ;
`ShotId = Inst | 'CHopen'` et 9 algorithmes ; cache des one-shots 96 / 40 Mo et 240 entrees, `shots.info()` avec
`previous` et `fallback` ; branche V.5.3 `worktree-agent-a3f84c671ac17ce70` = 22 fichiers, +559 / -38 ; tsc a 13
erreurs (rapports D1 a D3a) ; `?mute=1`, `?debug=1`, `docs:midi`, `hw:test`, `presets:test`, `firmware.mjs bump`
existent ; T G N K Y U et la virgule sont libres dans `hooks/useKeys.ts`.

Fausses ou risquees (corrigees dans le texte) :
- `FACE_LAW` "devient" la correspondance case k = potard k : c'est deja le cas, et les potards sont deja a droite.
- Facades "`voiceFx.of()` et `kit.tweak()`" : les 187 appels couvrent toute l'API des deux stores.
- "`Inst` devient un alias de `TrackKey`" : forcerait a 16 les tables a 8 du telephone et du clavier ; garder `Inst`.
- "Aucun appel a l'evaluation du module" : `actions.ts` fait 11 branchements a son chargement et porte 27 `let`.
- "`rytm:data` (relative)" : le kind relatif n'existe pas (`value`, `press`, `hold`).
- "Diff du CSV = lignes a la fin" : faux par construction.
- Elargir `BPM` "borne de son cote" les platines : non, `dj/actions.ts` lit la meme constante.
- `rytm:enc:level` s'appelle MASTER dans le CSV (renommer le libelle, garder l'id).
- Cites comme existants mais a creer : `audio/tracks.ts`, `state/gesture.ts`, `state/settings.ts`, `state/clipboard.ts`,
  `scene/sideKnobs.ts`, `audio/euclid.ts`, `audio/scales.ts`, `state/songs.ts`, `scripts/fixtures/`,
  `scripts/rytm-ident.mjs`.

A verifier par le builder (non tranche ici) : `bass/keys.ts` et `dj/keys.ts` ecoutent `keydown` en capture : s'assurer
qu'ils laissent passer les nouvelles lettres quand le MM-RYTM a le focus ; `renderer.ts` l. 3522 (crochet de test des
eclairs), `StepEvent.mask` et `flashLv` codent un masque sur `INSTRUMENTS` (8 bits) [MOD 9] ; `pattern.instrument === null`
(les potards reglent tout le pattern) reste une branche du telephone.
