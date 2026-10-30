# Inventaire DT2 : menus, combinaisons de touches, MIDI (partie dt-menus)

Source unique : manuel Digitakt II (OS 1.17), texte `m2/m2.txt` (pdftotext -layout) et figures du PDF `m2/m2.pdf`.
Chapitres lus en entier : 14 SETTINGS MENU (l. 3990 a 4475, p. 75 a 84), 15 STARTUP MENU (l. 4479 a 4526, p. 85),
16 SETUP EXAMPLES (l. 4531 a 4607, p. 86 a 87), 17 KEY COMBINATIONS (l. 4610 a 4760, p. 88 a 90), annexes B MIDI
(l. 5738 a 6013, p. 109 a 113), C MODULATION DESTINATIONS (p. 114), D KEYBOARD SCALES (p. 115). Les ecrans des
figures des pages 75 a 84 ont ete regardes (rendu PNG) pour relever les libelles exacts des menus.
Pour etre exhaustif sur les combinaisons, tout le manuel a ete balaye (grep des `[X] + [Y]`, "press and hold",
"double-press", "hold down", "and turn") : les combinaisons hors chapitre 17 sont en 2.3 avec leur section.

Pour le code actuel, lecture seule rapide de `src/v4/midi/*.ts`, `src/v4/hooks/useKeys.ts` et des specs
`docs/v4/digitakt-d1..d3b-spec.md`, seulement pour signaler les conflits avec ce qui existe (section 2.6 et 5.9).

Legende des verdicts web :
- **GARDER** : a refaire tel quel dans la machine web.
- **ADAPTER** : la fonction reste, son support change (stockage local, Web MIDI, banque de samples de Mika, souris).
- **RETIRER** : sampling, entrees audio, USB, Overbridge, Transfer, firmware, materiel.
- **OPTION** : depend d'un arbitrage (pistes MIDI externes, machines SLICE/GRID) : voir section 7.

Conventions : `FUNC+X` = tenir FUNC puis appui court sur X (regle 6.2.3 du manuel). `X hold + Y` = tenir X, appuyer Y.
Les touches s'ecrivent comme sur la face : FUNC, TRK, PTN, SONG, PAGE, REC (le rond, "RECORD"), PLAY, STOP, YES, NO,
TEMPO, SETTINGS, SAMPLING, PRESET/KIT, KEYBOARD, TRIG PARAMETERS (abrege TRIG P.), SRC, FLTR, AMP, FX, MOD,
UP DOWN LEFT RIGHT, TRIG 1 a 16, LEVEL/DATA, potards A a H ("DATA ENTRY"), MAIN VOLUME.
Attention : "TRIG" seul = une touche de pas (TRIG 1 a 16), "TRIG P." = la touche de page TRIG PARAMETERS.

---------------------------------------------------------------------------------------------------------------------

## 1. Les touches de la face et leur seconde fonction (base de toutes les combinaisons)

Source : 3.1 (l. 523 a 601). La seconde fonction est imprimee en orange, elle s'obtient par FUNC + la touche.

| # fig. | Touche | Seule | FUNC + (orange) | Web |
|---|---|---|---|---|
| 1 | MAIN VOLUME | volume des sorties et du casque (encodeur absolu ~320 degres) | - | GARDER (volume de la machine, pas le master du site) |
| 2 | PRESET/KIT | menu PRESET/KIT (presets, kits, pool) | PERFORM KIT (bascule) | GARDER |
| 3 | SETTINGS | menu SETTINGS | SAVE PROJECT (ecrase le projet courant) | GARDER (ADAPTER : sauvegarde locale) |
| 4 | SAMPLING | menu SAMPLING (enregistrer) | SAMPLES (navigateur du +Drive) | RETIRER le SAMPLING ; la seconde fonction SAMPLES peut devenir le navigateur de la banque de Mika (voir 7) |
| 5 | TEMPO | menu TEMPO (BPM, swing, metronome) | TAP TEMPO | GARDER |
| 6 | NO | sortir, reculer, nier | RELOAD (recharge temporaire du pattern) | GARDER |
| 7 | YES | entrer, choisir, confirmer | SAVE (sauvegarde temporaire du pattern) | GARDER |
| 8 | Potards A a H | valeurs ; presser + tourner = gros pas | (FUNC + tourner = sauts de valeur, 6.2.1) | GARDER |
| 9 | TRIG P. | page TRIG (NOTE, VEL...) | QUANTIZE | GARDER |
| 9 | SRC | page SOURCE de la machine SRC | MACHINE (choix de machine) | GARDER |
| 9 | FLTR | page FILTER | SETUP (kit et piste) | GARDER |
| 9 | AMP | page AMP (enveloppe, envois) | SEQUENCER (euclidien) | GARDER |
| 9 | FX | page FX (bit, overdrive, SRR, envois) | SEND FX (delay, reverb, chorus) | GARDER |
| 9 | MOD | page LFO | MIXER | GARDER |
| 10 | LED PATTERN PAGE | nombre de pages du pattern, page active, page qui joue (clignote) | - | GARDER (8 LED, 128 pas) |
| 11 | UP DOWN LEFT RIGHT | navigation, quelques valeurs | (selon contexte, voir 2.5) | GARDER |
| 12 | PAGE | page du pattern a editer ; aussi FILL | PAGE SETUP | GARDER |
| 13 | TRIG 1 a 16 | trigs, p-locks, piste, banque, pattern, song, clavier | QUICK MUTE | GARDER |
| 14 | SONG | + TRIG 1 a 16 : choisir le song | SONG EDIT | GARDER |
| 15 | PTN | + LEFT/RIGHT et TRIG : banque et pattern | BANK (selection de banque) | GARDER |
| 16 | TRK | + TRIG : choisir la piste | MUTE (mode mute) | GARDER |
| 17 | STOP | arret | PASTE | GARDER |
| 18 | PLAY | lecture ; encore = pause | CLEAR | GARDER |
| 19 | REC | GRID RECORDING ; REC + PLAY live ; REC + STOP step | COPY | GARDER |
| 20 | KEYBOARD | mode KEYBOARD | KEYBOARD SETUP | GARDER |
| 21 | FUNC | modificateur | - | GARDER |
| 22 | LEVEL/DATA | niveau de la piste active, valeurs, listes | PRESET MANAGER (panneau) ; FUNC + tourner = PRESET BROWSER (9.2) ; tenir un TRIG + tourner = PRESET POOL (preset lock) | GARDER |
| 23 | Ecran | 128 x 64 OLED | - | GARDER (notre ecran) |

Comportements generaux des touches (8.3, 6.1, 6.2, 6.4) :
- Les touches de pas en selection de piste et les six touches de page sont des boutons radio (une seule active).
- NO recule d'un cran a la fois jusqu'a l'ecran principal ; YES entre, choisit, coche.
- Presser un potard en tournant = gros increments. Potard presse + NO = valeur par defaut.
- Tenir une touche de page = voir toutes les valeurs de la page.
- Presse-papiers unique : une copie remplace toute copie precedente (on ne peut pas avoir un trig et un pattern
  copies en meme temps). Un PASTE ou un CLEAR s'annule en refaisant la meme combinaison (6.4, 10.8.5).
- Economiseur d'ecran : ecran assombri apres 5 min sans action, eteint apres 60 min ; toute touche le reveille
  (l. 906). Web : ADAPTER (assombrir l'ecran 3D, voire baisser la cadence de rendu) ou RETIRER.

---------------------------------------------------------------------------------------------------------------------

## 2. Combinaisons de touches (toutes)

### 2.1 Regles generales

- R1. FUNC : tenir FUNC puis appui COURT sur l'autre touche (6.2.3).
- R2. Le meme accord change de sens selon le contexte (GRID REC actif ou non, ecran SONG EDIT, menu NAMING,
  navigateur, PAGE SETUP...) : l'ordre de priorite est en 2.5. C'est le point le plus important pour le moteur.
- R3. Copier, coller, effacer : REC = COPY, STOP = PASTE, PLAY = CLEAR, avec le modificateur qui dit QUOI
  (FUNC = pattern ou piste, TRIG tenu = trig, TRK = preset, PAGE = page de sequence, touche de page = page de
  parametres, FUNC dans SONG EDIT = ligne). Refaire la combinaison annule un PASTE ou un CLEAR.
- R4. FUNC pendant qu'on tourne = valeurs "musicales" (NOTE par octave, DELAY TIME en valeurs synchronisees au BPM,
  TUNE par octave). Presser et tourner = gros pas (TUNE : par demi-ton ; TEMPO : 4 BPM).

### 2.2 Chapitre 17 (liste du manuel, dans son ordre)

| Id | Combinaison | Contexte | Effet | Web |
|---|---|---|---|---|
| K01 | FUNC+REC | GRID REC | copie la sequence de la piste active (tous ses trigs) | GARDER |
| K02 | FUNC+STOP | GRID REC | colle la sequence copiee sur la piste active | GARDER |
| K03 | FUNC+PLAY | GRID REC | efface la sequence de la piste active | GARDER |
| K04 | TRIG hold + REC | GRID REC | copie le trig avec ses p-locks (plusieurs trigs tenus = plusieurs) | GARDER |
| K05 | TRIG hold + STOP | GRID REC | colle le ou les trigs ; le trig tenu = point de depart, ecarts conserves | GARDER |
| K06 | TRIG hold + PLAY | GRID REC | efface le trig (10.8.5 dit : efface les locks du trig, voir 2.6) | GARDER |
| K07 | FUNC+REC | hors GRID REC | copie le pattern actif | GARDER |
| K08 | FUNC+STOP | hors GRID REC | colle le pattern copie sur le pattern actif | GARDER |
| K09 | FUNC+PLAY | hors GRID REC | efface le pattern actif (tous ses trigs) | GARDER |
| K10 | TRK+REC | partout | copie le preset de la piste choisie | GARDER |
| K11 | TRK+STOP | partout | colle le preset copie sur la piste choisie | GARDER |
| K12 | TRK+PLAY | partout | efface (remet a zero) le preset de la piste choisie | GARDER |
| K13 | PAGE+REC | GRID REC | copie la page de sequence active | GARDER |
| K14 | PAGE+STOP | GRID REC | colle la page copiee sur la page active | GARDER |
| K15 | PAGE+PLAY | GRID REC | efface la page active | GARDER |
| K16 | TRK+TRIG 1-16 | partout | choisit la piste (sans son, sauf reglage TRK SELECT, voir H61) | GARDER |
| K17 | PTN, LEFT/RIGHT, TRIG 1-16 | partout | PTN ouvre la selection ; LEFT/RIGHT = banque A a H ; TRIG = pattern | GARDER |
| K18 | FUNC + fleches | ecran NAMING | choisir une lettre (FUNC tenu ouvre le POP-UP NAMING, les fleches s'y deplacent) | ADAPTER (le clavier tape directement ; garder le pop-up au toucher) |
| K19 | FUNC+NO | ecran NAMING | efface une lettre | GARDER |
| K20 | FUNC+YES | ecran NAMING | insere un espace | GARDER |
| K21 | FUNC+NO | partout (sauf STEP REC, NAMING, recherche) | recharge le pattern actif (depuis la sauvegarde temporaire, sinon depuis l'etat sauve) | GARDER |
| K22 | FUNC+YES | partout (sauf STEP REC, NAMING, PTN, PAGE SETUP, navigateurs) | sauvegarde temporaire du pattern actif | GARDER |
| K23 | TRIG hold + PRESET/KIT | GRID REC | sauve le son de ce trig comme preset, p-locks compris | GARDER |
| K24 | TRIG hold + YES | GRID REC et STEP REC | pre-ecoute du trig, p-locks compris | GARDER |
| K25 | FUNC+SETTINGS | partout | sauve le projet actif (ecrase) | ADAPTER (sauvegarde locale) |
| K26 | touche de page + NO | partout | recharge tous les parametres de cette page depuis leur dernier etat sauve | GARDER |
| K27 | touche de page + YES | partout (pistes audio) | parametres de la page au hasard (nouveau tirage a chaque fois) | GARDER |
| K28 | TRK+TRIG 1-16 + NO | partout | recharge le preset de cette piste depuis son dernier etat sauve | GARDER |
| K29 | FUNC+RIGHT | menu SAMPLES | ouvre un dossier | ADAPTER (dossiers de la banque de Mika) ou RETIRER |
| K30 | FUNC+LEFT | menu SAMPLES | remonte d'un dossier | ADAPTER ou RETIRER |
| K31 | FUNC+SONG | partout | ouvre SONG EDIT (et le referme) | GARDER |
| K32 | FUNC+TRIG P. | partout | menu QUANTIZE | GARDER |
| K33 | FUNC+SRC | partout | menu MACHINE | GARDER |
| K34 | FUNC+FLTR | partout | menu SETUP | GARDER |
| K35 | FUNC+AMP | partout | menu SEQUENCER (euclidien) | GARDER |
| K36 | FUNC+FX | partout | pages SEND FX | GARDER |
| K37 | FUNC+MOD | partout | pages MIXER (FUNC+MOD repete : page suivante, 4 fois = FX MIXER, 12.8) | GARDER |
| K38 | FUNC+PAGE | partout | PAGE SETUP du pattern ou de la piste | GARDER |
| K39 | FUNC+KEYBOARD | partout | KEYBOARD SETUP | GARDER |
| K40 | FUNC+TEMPO | partout | TAP TEMPO (moyenne apres 4 tapes, mise a jour en continuant) | GARDER |
| K41 | LEFT/RIGHT tenu | ecran principal, en lecture | nudge du tempo de +/- 10 % tant qu'on tient, retour au lacher (7.3.1) | GARDER (utile pour caler sur une platine du MM-DECKS) |
| K42 | FUNC+LEFT/RIGHT | GRID REC | decale tous les trigs de la piste d'un pas | GARDER |
| K43 | TRIG hold + LEFT/RIGHT | GRID REC | pop-up MICRO TIMING, regle le decalage du ou des trigs tenus | GARDER |
| K44 | FUNC+UP/DOWN | PAGE SETUP | TRACK LENGTH par increments musicaux (ch. 17 : 2/16 a 64/64 ; 10.7 : 2/16 a 128/128) | GARDER (128) |
| K45 | TEMPO+YES | partout | metronome on/off | GARDER (voir conflit 2.6) |
| K46 | REC+PLAY | partout | LIVE RECORDING (le sequenceur demarre, REC clignote) | GARDER |
| K47 | REC+STOP | partout | STEP RECORDING (REC double-clignote) | GARDER |
| K48 | REC hold + PLAY deux fois | partout | LIVE REC avec ou sans quantification auto (bascule) | GARDER |
| K49 | PAGE hold + LEFT/RIGHT, ou PAGE hold + TRIG allume | GRID REC | change de page de sequence / saute a la page | GARDER |
| K50 | TRIG hold + PAGE (ou TRK), puis tourner un potard | GRID REC | p-lock sur tous les trigs existants de la page (avec TRK : de la piste) | GARDER |
| K51 | FUNC+TRIG | hors GRID REC | mute / unmute d'une ou plusieurs pistes (QUICK MUTE) | GARDER |
| K52 | FUNC hold + TRIG(s), lacher FUNC | mode MUTE | prepare les mutes ; ils s'appliquent au lacher de FUNC | GARDER |
| K53 | FUNC+TRK | partout | mode GLOBAL MUTE (refaire = sortie) | GARDER |
| K54 | FUNC + TRK deux fois | partout | mode PATTERN MUTE | GARDER |
| K55 | KEYBOARD | partout | entre / sort du mode KEYBOARD | GARDER |
| K56 | YES+PAGE | lecture | FILL pour un tour de pattern (actif a la boucle suivante) ; PAGE encore = FILL off | GARDER |
| K57 | PAGE tenu | lecture, hors GRID REC | FILL tant qu'on tient | GARDER |
| K58 | PAGE hold + YES, lacher PAGE avant YES | lecture | FILL verrouille ; PAGE encore = deverrouille | GARDER |
| K59 | potard presse + NO | partout | parametre a sa valeur par defaut | GARDER |
| K60 | touche de page + PLAY | partout | tous les parametres de la page a leurs valeurs par defaut | GARDER |
| K61 | FUNC+YES | menu SAMPLES | pre-ecoute du sample surligne | ADAPTER (navigateur de la banque) |
| K62 | FUNC+YES | PRESET BROWSER / PRESET MANAGER | pre-ecoute du preset surligne | GARDER |
| K63 | TRIG hold + YES | GRID REC et STEP REC | pre-ecoute du trig (doublon de K24) | GARDER |
| K64 | SONG+TRIG 1-16 | partout | choisit le song et entre en mode SONG | GARDER |
| K65 | FUNC+SONG | partout | ecran SONG EDIT (doublon de K31) | GARDER |
| K66 | SONG+LEFT | mode SONG | boucle la ligne qui joue ; refaire = reprise normale | GARDER |
| K67 | SONG+UP | mode SONG | pointeur du song une ligne plus haut | GARDER |
| K68 | SONG+DOWN | mode SONG | pointeur du song une ligne plus bas | GARDER |
| K69 | SONG deux fois | mode SONG | ouvre SONG EDIT | GARDER |
| K70 | FUNC+REC | SONG EDIT | copie la ligne choisie | GARDER |
| K71 | FUNC+STOP | SONG EDIT | colle la ligne copiee sur la ligne choisie | GARDER |
| K72 | FUNC+PLAY | SONG EDIT | remet la ligne au BPM, a la longueur et aux mutes du pattern | GARDER |
| K73 | FUNC+DOWN | SONG EDIT | ajoute une ligne sous la ligne choisie (copie de celle-ci) | GARDER |
| K74 | FUNC+UP | SONG EDIT | supprime la ligne choisie | GARDER |

Doublons dans le chapitre 17 lui-meme : FUNC+YES / FUNC+NO (sauvegarde et rechargement temporaires) y figurent deux
fois ; TRIG + YES aussi ; FUNC+SONG aussi. Ils ne sont comptes qu'une fois.

### 2.3 Combinaisons hors chapitre 17 (dispersees dans le manuel)

| Id | Combinaison | Contexte | Effet | Source | Web |
|---|---|---|---|---|---|
| H01 | FUNC + tourner un potard | pages | sauts de valeur (NOTE par octave, DELAY TIME en valeurs BPM, TUNE par octave) | 6.2.1, A.2.1 | GARDER |
| H02 | presser + tourner un potard | pages, TEMPO | gros pas ; TUNE par demi-ton ; TEMPO par 4 BPM | 6.2, 7.3.1, A.2.1 | GARDER |
| H03 | tenir une touche de page | pages | affiche toutes les valeurs de la page | 6.2, 11.1 | GARDER |
| H04 | touche de page repetee, ou UP/DOWN | pages | sous-page suivante du groupe | 11.1 | GARDER |
| H05 | touche de page + REC ; autre piste ; meme touche + STOP | partout | copie / colle une page de parametres d'une piste a l'autre | 10.8.5 | GARDER |
| H06 | touche de page + PLAY | partout | efface la page de parametres (= K60, remise aux defauts) | 10.8.5 | GARDER |
| H07 | TRK hold + tourner un potard | pages des pistes audio | CONTROL ALL : meme changement sur toutes les pistes audio du pattern (filtre CONTROL ALL CONFIG ; la piste active toujours) | 6.2.2, 9.8.1 | GARDER (existe deja en V.5.2) |
| H08 | NO avant de lacher TRK | CONTROL ALL | annule les changements du CONTROL ALL | 6.2.2 | GARDER |
| H09 | FUNC+UP/DOWN | menus, listes | defilement rapide d'une page d'ecran (listes de presets aussi) | 6.3, 9.3.3 | GARDER |
| H10 | FUNC+UP/DOWN | ecran principal | choix du TRIG MODE (TRACKS, VELOCITIES, RETRIGS, SLICES, PRESET POOL) pour toutes les pistes | 8.5.4 | GARDER (SLICES : OPTION) |
| H11 | PAGE+RIGHT / PAGE+LEFT | TRIG MODE PRESET POOL | groupe de slots du pool joue par les TRIG (1-16, 17-32...) | 8.5.4 | GARDER |
| H12 | PAGE | TRIG MODE SLICES | 16 slices suivantes | 8.5.4 | OPTION (machines SLICE/GRID) |
| H13 | FUNC+TRIG | GRID REC | pose un LOCK TRIG (trigless, jaune) | 10.2.2, 10.8.1 | GARDER (existe en V.5.1) |
| H14 | TRIG appui court sur un trig pose | GRID REC | retire le trig ; un appui un peu plus long prepare l'edition sans retirer | 10.2.2 | GARDER |
| H15 | TRIG hold + tourner un potard | GRID REC, STEP REC | p-lock du parametre sur ce trig (graphisme inverse, TRIG clignote rouge ou jaune) | 10.8.1 | GARDER |
| H16 | TRIG hold + presser le potard verrouille | GRID REC | retire ce seul p-lock | 10.8.1 | GARDER |
| H17 | TRIG hold + tourner LEVEL/DATA | GRID REC | PRESET LOCK : liste du pool, le preset choisi au lacher du TRIG ; tenir le TRIG montre le preset assigne | 10.8.2 | GARDER |
| H18 | TRIG hold + FUNC + LEFT/RIGHT | GRID REC | micro timing de TOUS les trigs poses | 10.4 | GARDER |
| H19 | TRIG hold + note d'un clavier MIDI externe | GRID REC | note et velocite du trig (pistes MIDI : accord jusqu'a 4 notes, la 1re fixe la velocite) | 10.2.2 | ADAPTER (Web MIDI) |
| H20 | PAGE hold + TRIG 1-8 (allumees) | GRID REC | choisit la page a editer (8 pages de 16 pas) | 10.2.2 | GARDER |
| H21 | PAGE hold + TRIG 9-16 | GRID REC | choisit les pages jouees en boucle (vert) ; en haut le TRIG clignotant = position maitre, en bas = page qui joue | 10.2.2 | GARDER |
| H22 | PAGE hold + NO | GRID REC | revient a la lecture de toutes les pages | 10.2.2 | GARDER |
| H23 | TRIG P. deux fois | GRID REC | page RETRIG (TRIG page 2) | 10.5 | GARDER |
| H24 | TRIG 1-16 | menu QUANTIZE | choisit la piste a quantifier (potards E = TRACK, H = PATTERN) | 10.6 | GARDER |
| H25 | PLAY | LIVE REC | sort du LIVE REC, la lecture continue | 10.2.3 | GARDER |
| H26 | REC | LIVE REC | passe en GRID REC | 10.2.3 | GARDER |
| H27 | STOP | LIVE REC | arrete enregistrement et lecture | 10.2.3 | GARDER |
| H28 | NO hold + TRIG(s) | LIVE REC | efface en temps reel les trigs des pistes tenues tant qu'on tient | 10.8.1 | GARDER |
| H29 | NO hold + presser-tenir un potard | LIVE REC | efface en temps reel les locks de ce parametre | 10.8.1 | GARDER |
| H30 | REC hold + STOP deux fois | STEP REC | bascule STANDARD / JUMP | 10.2.4 | GARDER |
| H31 | TRIG / LEFT / RIGHT | STEP REC | TRIG choisit le pas actif (vert double-clignotant) ; LEFT/RIGHT deplace ou saute un pas | 10.2.4 | GARDER |
| H32 | FUNC hold + TRIG 1-16 | STEP REC | pose un note trig sur la piste du TRIG au pas actif, puis avance | 10.2.4 | GARDER |
| H33 | KEYBOARD ; KEYBOARD hold + TRIG allume | STEP REC | clavier chromatique ; pose une note de cette hauteur puis avance ; UP/DOWN = octave | 10.2.4 | GARDER |
| H34 | NO | STEP REC | retire le trig du pas actif ou pose un silence, puis avance | 10.2.4 | GARDER |
| H35 | YES hold pendant qu'on pose un trig | STEP REC | la longueur du trig = la duree d'appui | 10.2.4 | GARDER |
| H36 | FUNC hold pendant des notes MIDI externes | STEP REC | velocite fixe (celle de VEL) au lieu de la velocite recue | 10.2.4 | ADAPTER (Web MIDI) |
| H37 | FUNC+NO, FUNC+YES | STEP REC | ne rechargent / ne sauvent PAS le pattern (protection) | 10.2.4 | GARDER |
| H38 | PLAY ; STOP | STEP REC | ecouter en programmant ; STOP arrete et reste en STEP REC | 10.2.4 | GARDER |
| H39 | FUNC hold en coupant EUC | menu SEQUENCER | convertit la sequence euclidienne en trigs normaux (efface les trigs anterieurs) | 10.3 | GARDER |
| H40 | PTN puis FUNC+YES | selection PTN | ouvre le CHAIN CREATOR (jusqu'a 64 patterns, banques via LEFT/RIGHT) | 10.1.3 | GARDER |
| H41 | FUNC+LEFT | CHAIN CREATOR | retire le dernier pattern de la chaine ; YES valide, NO annule | 10.1.3 | GARDER |
| H42 | PTN hold + TRIG, puis TRIG enchaines en gardant le precedent | partout | chaine "legacy" (meme TRIG plusieurs fois = repete) | 10.1.3 | GARDER (existe deja sous une autre forme) |
| H43 | FUNC+PTN, puis TRIG 9-16 (banque), puis TRIG 1-16 | partout | selection banque/pattern a l'ancienne | 10.1.1 | GARDER (existe en V.5.2) |
| H44 | PTN+TRIG 1-16 | partout | pattern de la banque courante ; PTN ou NO referme | 10.1.1 | GARDER |
| H45 | PTN puis TRIG hold + REC / STOP / PLAY | selection PTN | copie / colle / efface des patterns NON actifs sans quitter le pattern actif | 10.1.1, 10.8.5 | GARDER |
| H46 | STOP STOP (rapide, a l'arret) | partout | coupe aussi les queues des send FX (fondu court) | 10.1.2 | GARDER |
| H47 | PLAY en lecture | partout | pause ; PLAY reprend | 10.1.2 | GARDER |
| H48 | STOP puis PLAY ; STOP deux fois | mode SONG | reprise a la tete de lecture ; tete au debut du song | 10.9.3 | GARDER |
| H49 | SONG+UP/DOWN | mode SONG | choisit la ligne ou sauter ensuite (formulation 10.9.3, voir 2.6) | 10.9.3 | GARDER |
| H50 | PTN+TRIG | mode SONG | quitte le mode SONG pour le pattern | 10.9.3 | GARDER |
| H51 | FUNC hold + tourner le potard PTN | SONG EDIT | change de banque vite | 10.9.1 | GARDER |
| H52 | YES sur la colonne BPM, ou TEMPO | SONG EDIT | menu TEMPO du pattern de la ligne (swing toujours par ligne) | 10.9.1 | GARDER |
| H53 | YES sur un numero de ligne | SONG EDIT | deplace la tete de lecture sur cette ligne | 10.9.2 | GARDER |
| H54 | TRIG 1-16 | SONG EDIT | joue les presets des pistes du pattern de la ligne | 10.9.2 | GARDER |
| H55 | YES sur ROW MUTE puis TRIG | SONG EDIT | mutes de la ligne | 10.9.1 | GARDER |
| H56 | NO ou FUNC+SONG | SONG EDIT | sortie | 10.9.2 | GARDER |
| H57 | FUNC+DOWN | song vide, choix INSERT ROW | insere la premiere ligne ; CREATE ROWS FROM CHAIN : YES, TRIG, LEFT/RIGHT banque, YES | 10.9.2 | GARDER |
| H58 | FUNC+PRESET/KIT | partout | PERFORM KIT on/off ("P" clignotant, touche orange) | 10.10 | GARDER |
| H59 | PRESET/KIT+NO | PERFORM KIT | recharge tout de suite le kit du pattern | 10.10.1 | GARDER |
| H60 | PRESET/KIT+YES | PERFORM KIT | sauve le kit modifie (ouvre SAVE KIT) | 10.10.1 | GARDER |
| H61 | TRK+TRIG | reglage TRK SELECT | NORMAL, SILENT, MANUAL : choisit sans son ; INVERTED : joue sans choisir | 14.7.9 | GARDER |
| H62 | TRK+TRIG+REC, puis TRK+TRIG+STOP | partout | copie le preset d'une piste, le colle sur une autre (variante de K10 et K11) | 9.5 | GARDER |
| H63 | FUNC + tourner LEVEL/DATA | partout | PRESET BROWSER | 9.2 | GARDER |
| H64 | LEFT | navigateurs PRESET / KIT | menu SORTING (ADD TO POOL, SELECT BANK, SORT ABC/123, FILTER par tags, SEARCH, SHOW ALL SLOTS) ; NO ou RIGHT sortie | 9.2, 9.3 | GARDER |
| H65 | RIGHT | PRESET MANAGER, POOL, KIT MANAGER | menu OPERATIONS (LOAD TO TRACK, COPY TO BANK, SAVE TO HERE, RENAME, EDIT TAGS, DELETE, SELECT ALL / UNUSED, DESELECT ALL, TOGGLE protection, SEND SYSEX) ; NO ou LEFT sortie | 9.3.3, 9.3.4, 9.3.7 | GARDER (SEND SYSEX : ADAPTER en export fichier) |
| H66 | YES dans une liste du manager | PRESET MANAGER | coche / decoche un element (operations sur plusieurs) | 9.3.3 | GARDER |
| H67 | TRIG de la piste active | navigateurs de presets ou de samples | pre-ecoute de l'element surligne | 9.3.1, 9.7 | GARDER |
| H68 | TRK+TRIG | PRESET LOAD | change de piste active sans quitter la liste | 9.3.1 | GARDER |
| H69 | KEYBOARD puis TRIG | PRESET LOAD | pre-ecoute du preset dans la gamme choisie | 9.3.1 | GARDER |
| H70 | FUNC+NO | champ SEARCH | efface la recherche | 9.3 | GARDER |
| H71 | TRIG 9-16 (ou 8-16, voir 2.6) | SELECT BANK des navigateurs | choisit la banque de presets ou de kits A a H | 9.3 | GARDER |
| H72 | TEMPO : potard A, B, D ; FUNC + potard E | menu TEMPO | A = BPM, B = decimales, D = swing (50 a 80 %) ; FUNC + E = tempo PROJET ou PATTERN | 7.3.1 | GARDER |
| H73 | FUNC hold + tourner A | menu TEMPO, mode PROJET | tempo prepare, applique au lacher de FUNC ("PREP." clignote) | 7.3.1 | GARDER |
| H74 | note C0 sur le canal FX CONTROL | MIDI entrant | TAP TEMPO depuis un controleur externe | 7.3.1 | ADAPTER (Web MIDI) |
| H75 | KEYBOARD+UP/DOWN (ou UP/DOWN seuls si U/D KEY MODE = KB OCT) | mode KEYBOARD | transpose d'une octave (+4 / -5 octaves) | 8.5.1, 14.7.4 | GARDER |
| H76 | UP/DOWN ; potards ; NO | KEYBOARD SETUP | octave ; KB SCALE, ROOT NOTE, KB FOLD ; sortie | 8.5.2 | GARDER |
| H77 | TRIG | mode MUTE | bascule la piste (allume = joue) ; sortie FUNC+TRK ; la machine se souvient du dernier mode (GLOBAL ou PATTERN), QUICK MUTE compris | 8.5.3 | GARDER |
| H78 | TRK hold + TRIG | GRID REC | choisit la piste (le manuel dit TRACK) | 10.2.2 | GARDER |
| H79 | FUNC+YES | PAGE SETUP | bascule PER PATTERN / PER TRACK | 10.7 | GARDER |
| H80 | PAGE repete ; TRIG | PAGE SETUP | longueur totale vite (pages) ; nombre de pas vite | 10.7.1 | GARDER |
| H81 | LEFT/RIGHT ; UP/DOWN ou LEVEL/DATA ; SETTINGS ; FUNC tenu | NAMING | curseur ; caractere ; NOM AU HASARD ; POP-UP NAMING (toutes les lettres) | 6.5, 6.5.1 | GARDER (SETTINGS = nom au hasard : a garder, c'est drole) |
| H82 | tenir SETTINGS 1 s + TRIG 1-3 | partout | intensite LED et ecran LOW / MID / MAX | 14.7.2 | ADAPTER (lueur des LED 3D) |
| H83 | tenir SETTINGS 1 s + TRIG 9 | partout | retro-eclairage des touches on/off | 14.7.2 | ADAPTER |
| H84 | tenir deux TRIG jusqu'au message | SETUP > KIT > TRACK SWAP | echange deux pistes (sons, presets, sequence) : "TRACKS X AND X SWAPPED" | 9.8.1 | GARDER |
| H85 | TRIG ; UP/DOWN | SETUP > KIT > CONTROL ALL CONFIG, COMPRESSOR ROUTING | pistes concernees ; deux pages (pistes, puis FX et entrees) | 9.8.1 | GARDER (sans les entrees) |
| H86 | YES, UP/DOWN, TRIG (vert = oui) | SETTINGS > AUDIO ROUTING > TO MAIN, TO FX | pistes et FX envoyes au main / aux FX | 14.6.1, 14.6.2 | GARDER (sans les entrees) |
| H87 | LEFT/RIGHT, UP/DOWN, YES | menu MACHINE (FUNC+SRC) | categorie (SRC, FLTR) ; machine ; assigner | A.1 | GARDER |
| H88 | FUNC hold + tourner A | FLTR page 1 | acces direct a DEL (delai de l'enveloppe de filtre) | 11.5 | GARDER |
| H89 | tenir SRC | page SRC | nom du sample charge | A.2.1 | ADAPTER (nom du son de la banque) |
| H90 | tourner D (SAMP) ; TRIG de la piste ; YES ; NO ; FUNC+YES | page SRC | liste des samples du pool ; pre-ecoute ; choisir ; sortir ; aller au slot / ouvrir SAMPLES (QUICK ASSIGN) | 9.7, 9.7.1 | ADAPTER (banque de Mika, sans RAM) |
| H91 | FUNC + presser un potard ; FUNC + presser-tenir | machine MIDI, FLTR/AMP page 1 | active ou coupe un VAL ; nomme le CC | A.2.7 | OPTION (pistes MIDI) |
| H92 | presser le potard ou YES ; FUNC + potard ; NO deux fois | machine MIDI, FLTR/AMP page 2 | applique le CC choisi ; MIDI LEARN du SEL ; annule le learn | A.2.7 | OPTION |
| H93 | LEFT/RIGHT, UP/DOWN, YES, NO | SYSEX SEND / RECEIVE | colonnes, choix, envoi, arret de l'ecoute | 14.5 | RETIRER (remplace par export / import de fichier) |
| H94 | NO repete ; YES | tous les menus | recule jusqu'a l'ecran principal ; entre, coche | 6.1 | GARDER |

### 2.4 Combinaisons du monde sampling (a retirer, listees pour etre complet)

| Combinaison | Contexte | Effet | Source |
|---|---|---|---|
| SAMPLING+YES / SAMPLING+NO | partout | arme l'enregistreur / annule | 13.1 (l. 3722) |
| FUNC + potard F / FUNC + potard G | editeur de sample | zoom vertical / deplace la selection de trim | 7.5 (l. 1202) |
| LEFT / RIGHT (zoome) | editeur de sample | saute au point START / END | 7.5, 13.x |
| FUNC+YES ; potard D | SAMPLING, editeur | pre-ecoute du sample ; mode de pre-ecoute (one shot, loop, avec ou sans tenue) | 7.5 |
| FUNC+SAMPLING | partout | menu SAMPLES (+Drive, RAM) | 13.6 |
| FUNC+YES | menu SAMPLES | charge vers une banque RAM precise ; pre-ecoute (~10 s) | 13.6.x |
| FUNC+RIGHT / FUNC+LEFT | menu SAMPLES | ouvre / remonte un dossier | 17 (= K29, K30) |
| FUNC+YES, FUNC+RIGHT, FUNC+LEFT | SLICE EDITOR | pre-ecoute de la slice ; coupe la slice en deux ; retire la slice | A.2.5 (l. 5241 a 5249) |

Le navigateur de samples (choisir un son dans une banque) n'est pas du sampling : il peut rester, branche sur la
banque de Mika (dossiers par famille), sans RAM ni +Drive. Le SLICE EDITOR depend du choix des machines (OPTION).

### 2.5 Un meme accord, plusieurs sens : ordre de priorite pour le moteur

Le premier contexte vrai l'emporte (deduit des sections citees).

| Accord | Ordre des contextes (le premier vrai gagne) |
|---|---|
| FUNC+REC / STOP / PLAY | 1. ecran SONG EDIT : ligne (K70 a K72) ; 2. GRID REC actif : sequence de la piste (K01 a K03) ; 3. sinon : pattern (K07 a K09) |
| TRIG hold + REC / STOP / PLAY | 1. vue PTN ouverte : patterns non actifs (H45) ; 2. GRID REC : trigs (K04 a K06) |
| FUNC+YES | 1. NAMING : espace (K20) ; 2. vue PTN : CHAIN CREATOR (H40) ; 3. PAGE SETUP : PER PATTERN / PER TRACK (H79) ; 4. navigateur (presets, samples) : pre-ecoute (K61, K62, H90) ; 5. STEP REC : rien (H37) ; 6. sinon : sauvegarde temporaire (K22) |
| FUNC+NO | 1. NAMING : efface une lettre (K19) ; 2. champ SEARCH : efface la recherche (H70) ; 3. STEP REC : rien (H37) ; 4. sinon : rechargement temporaire (K21) |
| FUNC+UP / DOWN | 1. SONG EDIT : supprime / ajoute une ligne (K74, K73) ; 2. PAGE SETUP : TRACK LENGTH (K44) ; 3. menu ou liste : page suivante (H09) ; 4. ecran principal : TRIG MODE (H10) |
| FUNC+LEFT / RIGHT | 1. CHAIN CREATOR : LEFT retire le dernier (H41) ; 2. menu SAMPLES : dossiers (K29, K30) ; 3. GRID REC : decale les trigs (K42) |
| FUNC+TRIG | 1. mode MUTE : prepare (K52) ; 2. STEP REC : note trig sur cette piste (H32) ; 3. GRID REC : lock trig (H13) ; 4. sinon : QUICK MUTE (K51) |
| LEFT / RIGHT seuls | 1. menu ou liste ouverte : navigation ; 2. TRIG tenu (GRID REC) : micro timing (K43) ; 3. PAGE tenu (GRID REC) : page (K49) ; 4. vue PTN : banque (K17) ; 5. STEP REC : pas actif (H31) ; 6. ecran principal en lecture, tenu : nudge (K41) |
| UP / DOWN seuls | 1. menu ou liste : navigation ; 2. mode KEYBOARD avec U/D KEY MODE = KB OCT : octave (H75) ; 3. sinon : sous-pages (H04) |
| PAGE tenu | 1. GRID REC : surcouche des pages (H20 a H22, K49) ; 2. hors GRID REC, en lecture : FILL momentane (K57) |
| YES + PAGE / PAGE + YES | YES d'abord puis PAGE : FILL un tour (K56) ; PAGE tenu + YES, PAGE lache avant YES : FILL verrouille (K58) |
| PLAY | 1. LIVE REC : sort du live, lecture continue (H25) ; 2. en lecture : pause (H47) ; 3. sinon : lecture |
| REC | 1. LIVE REC : passe en GRID REC (H26) ; 2. STEP REC : sort ; 3. sinon : GRID REC on/off |
| NO | 1. CONTROL ALL en cours (TRK tenu) : annule (H08) ; 2. LIVE REC + TRIG ou potard : effacement en temps reel (H28, H29) ; 3. STEP REC : silence (H34) ; 4. menu : recule (H94) |
| TRK+TRIG | reglage TRK SELECT : choisit sans son (NORMAL, SILENT, MANUAL) ou joue sans choisir (INVERTED) (H61) |

### 2.6 Incoherences du manuel, et ecarts avec le code actuel

Incoherences du manuel (a trancher dans la spec) :
- TRACK LENGTH par FUNC+UP/DOWN : "2/16 a 64/64" (ch. 17, reste du DT1) contre "2/16 a 128/128" (10.7). La DT2 a 128
  pas (8 pages) : prendre 128/128.
- TRIG hold + PLAY : "clear the trig" (ch. 17) contre "Clear trig locks" (10.8.5). Proposition : efface les locks si
  le trig en a, sinon le trig (ou suivre le ch. 17 : efface le trig).
- Copie de preset : TRK+REC (ch. 17) contre TRK+TRIG+REC (9.5). Les deux peuvent coexister (H62 choisit la source).
- SONG+UP/DOWN : "deplace le pointeur d'une ligne" (ch. 17) contre "choisit la ligne a jouer ensuite" (10.9.3).
- Selection de banque des navigateurs : "TRIG 8-16" dans plusieurs paragraphes, "TRIG 9-16" ailleurs. 8 banques A a H =
  8 touches : TRIG 9 a 16, comme FUNC+PTN.
- 3.1, touche PAGE (l. 569 a 573) : paragraphe colle par erreur (texte de la copie de patterns).
- QUICK MUTE dit "FUNC + [TRACK] keys" (8.5.3, reste du DT1) : sur la DT2 ce sont les TRIG 1 a 16 (K51).
- Les touches de page + PLAY : "reset aux defauts" (6.2, ch. 17) et "clear the parameter page" (10.8.5) : meme effet.
- Les erreurs de l'annexe B MIDI sont en 5.7.

Ecarts avec la machine actuelle (V.5.0 a V.5.2, specs D1 a D3) a regler pendant la refonte :
- FILL : aujourd'hui tenir YES (spec D2) ; DT2 : PAGE (K56 a K58). La touche PAGE n'existe pas encore sur la face.
- TAP TEMPO : aujourd'hui YES sur la page TEMPO (spec D1) ; DT2 : FUNC+TEMPO, et TEMPO+YES = metronome (K40, K45).
- TEMPO : aujourd'hui seconde fonction de TRIG (spec D1) ; DT2 : touche TEMPO propre, TRIG P. a QUANTIZE en second.
- SRC : seconde fonction SOUNDS aujourd'hui ; DT2 : MACHINE (K33). Le navigateur de sons passe par le potard SAMP
  (H90) ou par la seconde fonction de l'ancienne touche SAMPLING.
- KIT : aujourd'hui PTN deux fois ; DT2 : touche PRESET/KIT (et FUNC+PRESET/KIT = PERFORM KIT).
- RANDOM : aujourd'hui TRIG + YES = beat au hasard ; DT2 : touche de page + YES = la page au hasard (K27), il n'y a pas
  de beat au hasard sur la DT2. A garder comme extra Maudite Machine ou a retirer (question 7).
- TRK deux fois = mute (compat D1) : la DT2 n'a que FUNC+TRK et FUNC + TRK deux fois.
- FUNC + pas 1 a 8 = mute rapide de 8 voix : passe a 16 pistes (K51).
- Clavier du site : fleches LEFT/RIGHT = machine precedente / suivante (useKeys.ts l. 179) ; chiffres 1 a 6 = pages du
  site et OPEN ; lettres = voix ; H, I, L, M, O, P, R, W, E, [, ] deja pris. Les fleches de la DT2 ont trop de roles
  (2.5) pour partager : quand la nouvelle machine a le focus, ses fleches gagnent, et le changement de machine passe par
  une autre touche (par exemple Maj + fleches) ou l'en-tete.

### 2.7 Adapter les combinaisons au web (souris, toucher, clavier)

Le probleme : une souris = un seul pointeur, donc pas d'accord de deux touches. Le site a deja la regle
`state/holdLatch.ts` (spec D1) : une tape garde la touche pour la touche suivante, tenir = momentane, deux tapes
rapides = gardee jusqu'a une nouvelle tape, NO ou Echap relache. Pour couvrir 2.2 et 2.3, il faut l'etendre :

- Modificateurs "gardables" (tape = garde pour la touche suivante) : FUNC, TRK, PTN, SONG, PAGE, REC (pour REC+PLAY,
  REC+STOP, REC + PLAY deux fois), YES (pour YES+PAGE), NO (pour NO + TRIG en LIVE REC), TEMPO (TEMPO+YES),
  PRESET/KIT (+YES, +NO), KEYBOARD (+UP/DOWN, + TRIG en STEP REC), touches de page (+YES, +NO, +REC, +STOP, +PLAY ;
  fenetre de 1,5 s deja en place en D1), SETTINGS tenu (+ TRIG 1 a 3 et 9).
- TRIG tenu (le geste le plus frequent : p-lock, micro timing, copie de trig, preset lock) : appui long (250 a 400 ms)
  sur un pas = pas "tenu" et garde jusqu'a un clic ailleurs sur la grille, Echap ou NO ; pendant ce temps potards,
  fleches, REC, STOP, PLAY, YES, PRESET/KIT et LEVEL/DATA agissent sur lui. Plusieurs pas tenus : Maj + clic ajoute.
- Potard "presse" : clic sans glisser = presse (pour K59 potard + NO, H16 TRIG + potard presse, H91) ; double-clic =
  valeur par defaut (raccourci de K59) ; Maj + glisser = gros pas (H02) ; FUNC (Alt) + glisser = sauts (H01).
- PAGE "tenu" pour FILL momentane : sans GRID REC, garder PAGE enfonce a la souris marche (un seul bouton) ; la tape
  garde la surcouche des pages en GRID REC.
- Toucher (telephone, tablette) : multi-touch reel, les accords marchent comme sur la machine ; la regle de garde
  reste pour ceux qui jouent d'un doigt.
- Clavier : accords physiques. Proposition a valider contre useKeys.ts : Alt = FUNC (existe), Espace = PLAY, Maj +
  Espace = STOP, W = REC, Entree = YES, Echap = NO (existent) ; puis T = TRK tenu, E = PTN (existe), G = PAGE tenu,
  N = SONG, K = KEYBOARD, fleches = fleches de la machine ; TRIG 1 a 8 = touches 1 a 8 et TRIG 9 a 16 = Maj + 1 a 8
  (par `e.code` DigitN, pour ne pas dependre de la disposition) seulement quand la nouvelle machine a le focus, ce qui
  deplace les chiffres de navigation du site (1 a 6) ; touches de page TRIG P., SRC, FLTR, AMP, FX, MOD = F1 a F6 ou
  Q, S, F, A, X, D (conflits a verifier : H, I, L, M, O, P, R deja pris). Ce choix appartient a la spec ; la contrainte
  a retenir : toutes les combinaisons de 2.2 et 2.3 doivent avoir un chemin souris, un chemin toucher et un chemin
  clavier, et l'aide a l'ecran doit les dire.
- Le boitier materiel de Mika (docs/hardware, notes MIDI des touches, spec D1 point "Notes des nouvelles touches") :
  les nouvelles touches (PAGE, SONG, TEMPO, SETTINGS, PRESET/KIT, KEYBOARD, fleches) auront besoin de notes en plus.

---------------------------------------------------------------------------------------------------------------------

## 3. Le menu SETTINGS

### 3.1 L'arbre de la DT2 (complet, avec les libelles des ecrans)

Ouverture : SETTINGS. Navigation : UP/DOWN ou LEVEL/DATA, YES ouvre, NO recule. Racine (ecran p. 75) : PROJECT, SONG,
PATTERN, MIDI CONFIG, SYSEX DUMP, puis (defilement) AUDIO ROUTING, PERSONALIZE, SYSTEM.

```
SETTINGS
+- PROJECT                                   (14.1)
|  +- LOAD PROJECT        liste des projets ; CREATE NEW tout en bas = projet vierge ; remplace le projet actif
|  +- SAVE PROJECT AS     choisir un slot ; FUNC+SETTINGS = sauver en ecrasant le projet courant
|  +- MANAGE PROJECTS     PROJECT MANAGER ; un projet + RIGHT = commandes :
|        CLEAR       remet le slot a neuf
|        DELETE      vide le slot
|        RENAME      ecran NAMING
|        LOAD FROM   charge ce projet (remplace l'actif)
|        SAVE TO     sauve l'actif dans ce slot
|        TOGGLE      protection en ecriture (cadenas : ni ecrase, ni renomme, ni efface)
|        INIT NEW    projet vierge dans un slot vide (slots vides seulement)
|        PURGE ALL   retire du pool les presets et de la RAM les samples non utilises (projet charge seulement)
+- SONG                                      (14.2)  (a gauche : numero et nom du song, "S01 RADAR")
|  +- RENAME | CLEAR | LOAD (liste des songs) | SAVE TO PROJ
+- PATTERN                                   (14.3)  (a gauche : "A01 WISPDISK")
|  +- RENAME
|  +- CLEAR             WHOLE PATTERN | KIT DATA | SEQUENCE DATA   (confirmation YES/NO ; rien n'est perdu tant que
|  |                    le pattern n'est pas sauve dans son slot)
|  +- SAVE TO PROJ      WHOLE PATTERN | KIT DATA | SEQUENCE DATA   (projet sauve au moins une fois avant)
|  +- RELOAD FROM PROJ  WHOLE PATTERN | KIT DATA | SEQUENCE DATA   (pattern sauve au moins une fois avant)
+- MIDI CONFIG                               (14.4)
|  +- SYNC (cases a cocher, LEFT/RIGHT ou YES)
|  |     CLOCK RECEIVE (coche dans la figure) | CLOCK SEND | TRANSPORT RECEIVE (coche) | TRANSPORT SEND
|  |     PRG CH RECEIVE (patterns choisis par program change) | PRG CH SEND (program change au changement de pattern)
|  +- PORT CONFIG (LEFT/RIGHT)
|  |     TURBO SPEED        YES lance la negociation Turbo-MIDI
|  |     OUT PORT FUNC      MIDI | DIN 24 | DIN 48
|  |     THRU PORT FUNC     MIDI | DIN 24 | DIN 48
|  |     INPUT FROM         DISABLED | MIDI | USB | MIDI+USB
|  |     OUTPUT TO          DISABLED | MIDI | USB | MIDI+USB
|  |     OUTPUT CH          AUTO CH | TRACK CH  (canal des potards)
|  |     PARAM OUTPUT       CC | NRPN
|  |     ENCODER DEST       INT | INT+EXT  (potards et LEVEL/DATA envoient-ils du MIDI)
|  |     TRIG KEY DEST      INT | INT+EXT | EXT
|  |     MUTE DEST          INT | INT+EXT | EXT
|  |     RECEIVE NOTES      on/off  (jouer la machine depuis un clavier)
|  |     RECEIVE CC/NRPN    on/off  (piloter les parametres depuis l'exterieur)
|  +- CHANNELS
|        TRACK 1 CHANNEL ... TRACK 16 CHANNEL   OFF | 1-16  (figure : 1, 2, 3, 4, 5... par defaut)
|        FX CONTROL CH      OFF | 1-16  (DELAY, REVERB, CHORUS, COMPRESSOR, master overdrive, en entree et en sortie)
|        AUTO CHANNEL       1-16  (la piste active ; aussi l'enregistrement des pistes MIDI depuis un controleur)
|        PROGRAM CHG IN CH  AUTO | 1-16
|        PROGRAM CHG OUT CH AUTO | 1-16
+- SYSEX DUMP                                (14.5)
|  +- SYSEX SEND      colonne gauche PROJECT | PATTERN ; colonne droite : ACTIVE PROJECT ou le pattern ; YES envoie
|  +- SYSEX RECEIVE   PATTERN (vers un slot) | PRESETS (vers un slot du +Drive, ou ANYWHERE = 1er slot libre) ;
|                     la machine ecoute toujours ; NO arrete. Ni samples envoyes ni recus.
+- AUDIO ROUTING                             (14.6)  (ecran : TO MAIN ..., TO SEND FX ..., USB IN MAIN, USB OUT MAIN,
|  |                                                   INT TO MAIN ON)
|  +- TO MAIN        16 pistes, 3 FX (delay, reverb, chorus) et entrees : qui va aux sorties MAIN (TRIG vert = oui)
|  +- TO FX          16 pistes, 2 FX (delay, chorus) et entrees : qui peut envoyer aux FX
|  +- USB IN         MAIN | OFF  (si USB AUDIO/MIDI)
|  +- USB OUT        MAIN | L:T1-16/R:T1-16 | EXT | OFF
|  +- INT TO MAIN    OFF | ON | AUTO  (avec Overbridge ou en carte son USB)
|  +- USB TO MAIN    0 a +18 dB
|  +- PRE/POST FADER audio USB avant ou apres le niveau de piste
+- PERSONALIZE                               (14.7)
|  +- LED INTENSITY     LOW | MID | MAX   (raccourci : tenir SETTINGS 1 s + TRIG 1-3)
|  +- LED BACKLIGHT     on/off            (raccourci : tenir SETTINGS 1 s + TRIG 9)
|  +- REMEMBER SUBPAGE  on/off  (une touche de page rouvre la derniere sous-page)
|  +- U/D KEY MODE      KB OCT | NAV
|  +- PAGE AUTOCOPY     on/off  (allonger le pattern recopie les pages existantes)
|  +- NOTE PARAM        CHRO | SCALE  (potard A de NOTE : chromatique ou dans la gamme ; presse = l'autre)
|  +- LIVE REC OVERDUB  on/off  (ajouter aux trigs au lieu de les remplacer)
|  +- PARAM LIVE REC    locks enregistres sur tous les pas, ou seulement sur les pas qui ont deja un trig
|  +- TRK SELECT        NORMAL | SILENT | MANUAL | INVERTED  (voir H61)
+- SYSTEM                                    (14.8)
   +- USB CONFIG     OVERBRIDGE | USB MIDI (coche) | USB AUDIO/MIDI  (un seul)
   +- OS UPGRADE     reception de l'OS via Elektron Transfer
   +- FORMAT +DRIVE  PROJ+PST+KIT | SAMPLES  (les samples d'usine ne s'effacent pas)
   +- STORAGE        projets, presets, kits, samples, temps de sample utilise / restant, RAM et +Drive (% et libre)
```

### 3.2 Ce qu'on garde, adapte ou retire

| Entree DT2 | Verdict | Version web proposee |
|---|---|---|
| PROJECT > LOAD PROJECT, CREATE NEW | ADAPTER | liste des projets locaux (IndexedDB) + projets d'usine en lecture seule ; CREATE NEW en bas |
| PROJECT > SAVE PROJECT AS ; FUNC+SETTINGS | ADAPTER | sauver dans un slot local ; FUNC+SETTINGS ecrase le projet courant |
| MANAGE > CLEAR, DELETE, RENAME, LOAD FROM, SAVE TO, INIT NEW | ADAPTER | memes commandes sur les slots locaux |
| MANAGE > TOGGLE (protection) | GARDER | cadenas ; les projets d'usine sont proteges d'office |
| MANAGE > PURGE ALL | ADAPTER | retire du pool les presets inutilises et libere de la memoire les AudioBuffer des samples inutilises |
| (ajout) MANAGE > EXPORT FILE / IMPORT FILE | AJOUT WEB | fichier .json (ou .mmproj) telecharge / choisi : la sauvegarde hors navigateur, remplace le SYSEX DUMP et Transfer |
| SONG > RENAME, CLEAR, LOAD, SAVE TO PROJ | GARDER | tel quel |
| PATTERN > RENAME, CLEAR x3, SAVE TO PROJ x3, RELOAD FROM PROJ x3 | GARDER | tel quel (WHOLE, KIT, SEQUENCE) |
| MIDI CONFIG > SYNC (les 6 cases) | ADAPTER | Web MIDI : CLOCK RECEIVE (horloge entrante 0xF8, a lisser), CLOCK SEND (existe deja pour l'ARP : midi/noteout.ts), TRANSPORT RECEIVE / SEND (0xFA START, 0xFB CONTINUE, 0xFC STOP, et SPP 0xF2 deja envoye), PRG CH RECEIVE / SEND |
| PORT CONFIG > TURBO SPEED | RETIRER | protocole materiel |
| PORT CONFIG > OUT PORT FUNC, THRU PORT FUNC (DIN 24/48) | RETIRER | sync DIN impossible en navigateur ; pas de port THRU |
| PORT CONFIG > INPUT FROM, OUTPUT TO | ADAPTER | choix des appareils Web MIDI : DISABLED, TOUS, ou un appareil (liste `MIDIAccess.inputs/outputs`) ; plusieurs possibles |
| PORT CONFIG > OUTPUT CH, PARAM OUTPUT, ENCODER DEST, TRIG KEY DEST, MUTE DEST, RECEIVE NOTES, RECEIVE CC/NRPN | GARDER | tels quels, en Web MIDI |
| MIDI CONFIG > CHANNELS (TRACK 1-16, FX CONTROL, AUTO, PRG CHG IN, PRG CHG OUT) | GARDER | tels quels ; valeurs par defaut a fixer (section 5.1) |
| (ajout) MIDI CONFIG > MAP : LEARN / ELEKTRON | AJOUT WEB | l'apprentissage actuel (MIDI LEARN, `midi/midi.ts`) et la carte CC/NRPN fixe de l'annexe B (section 5) |
| (ajout) MIDI CONFIG > ROTO-CONTROL | AJOUT WEB | ce qui existe deja (carte automatique, FOLLOW, retour aux potards motorises, un seul onglet pilote) doit garder une place |
| SYSEX DUMP > SEND, RECEIVE | RETIRER | remplace par EXPORT / IMPORT de fichier (projet, pattern, preset, kit) ; Web MIDI SysEx demande une permission en plus et n'apporte rien ici |
| AUDIO ROUTING > TO MAIN | GARDER | pistes et FX (delay, reverb, chorus) vers la sortie de la machine ; sans les entrees. Utile : une piste seulement dans la reverbe |
| AUDIO ROUTING > TO FX | GARDER | pistes et FX (delay, chorus) qui peuvent envoyer aux FX ; sans les entrees |
| AUDIO ROUTING > USB IN, USB OUT, INT TO MAIN, USB TO MAIN, PRE/POST FADER | RETIRER | USB audio, Overbridge |
| PERSONALIZE > LED INTENSITY, LED BACKLIGHT | ADAPTER | intensite de la lueur des LED 3D (LOW, MID, MAX) et retro-eclairage des touches en caoutchouc ; raccourcis H82 et H83 |
| PERSONALIZE > REMEMBER SUBPAGE, U/D KEY MODE, PAGE AUTOCOPY, NOTE PARAM, LIVE REC OVERDUB, PARAM LIVE REC, TRK SELECT | GARDER | tels quels. TRK SELECT : le comportement actuel "en lecture, toucher une voix la choisit sans la jouer" (tache 65) = SILENT ; NORMAL = choisir et jouer (D1) |
| (ajout) PERSONALIZE > SCREEN SAVER | AJOUT WEB (option) | assombrir l'ecran apres 5 min (l. 906) ; peut aussi ralentir le rendu 3D pour la batterie |
| SYSTEM > USB CONFIG | RETIRER | materiel |
| SYSTEM > OS UPGRADE | RETIRER | le deploiement est automatique ; a la place : ABOUT (version firmware.json, "V.6.x") |
| SYSTEM > FORMAT +DRIVE : PROJ+PST+KIT | ADAPTER | efface projets, presets et kits locaux (double confirmation) |
| SYSTEM > FORMAT +DRIVE : SAMPLES | ADAPTER | efface seulement les samples importes par l'utilisateur (glisser-deposer WAV, s'ils sont stockes) ; la banque de Mika ne s'efface pas, comme les samples d'usine |
| SYSTEM > STORAGE | ADAPTER | nombre de projets, presets, kits, samples importes ; `navigator.storage.estimate()` (utilise / quota) au lieu de RAM et +Drive ; pas de "sample time" |
| (ajout) SYSTEM > RESET VIDE, RETOUR USINE | AJOUT WEB | les deux entrees utiles du STARTUP MENU (section 4) |

Arbre web propose (resume) :

```
SETTINGS
+- PROJECT      LOAD (CREATE NEW) | SAVE AS | MANAGE (CLEAR DELETE RENAME LOAD FROM SAVE TO TOGGLE INIT NEW PURGE ALL
|               EXPORT FILE IMPORT FILE)
+- SONG         RENAME | CLEAR | LOAD | SAVE TO PROJ
+- PATTERN      RENAME | CLEAR | SAVE TO PROJ | RELOAD FROM PROJ   (chacun : WHOLE PATTERN, KIT DATA, SEQUENCE DATA)
+- MIDI CONFIG  SYNC | PORT CONFIG (INPUT FROM, OUTPUT TO, OUTPUT CH, PARAM OUTPUT, ENCODER DEST, TRIG KEY DEST,
|               MUTE DEST, RECEIVE NOTES, RECEIVE CC/NRPN) | CHANNELS | MAP (LEARN, ELEKTRON) | ROTO-CONTROL
+- AUDIO ROUTING  TO MAIN | TO FX
+- PERSONALIZE  LED INTENSITY | LED BACKLIGHT | REMEMBER SUBPAGE | U/D KEY MODE | PAGE AUTOCOPY | NOTE PARAM |
|               LIVE REC OVERDUB | PARAM LIVE REC | TRK SELECT | (SCREEN SAVER)
+- SYSTEM       FORMAT (PROJ+PST+KIT, SAMPLES IMPORTES) | STORAGE | RESET VIDE | RETOUR USINE | ABOUT
```

### 3.3 Le modele de sauvegarde (indispensable pour que SAVE / RELOAD aient un sens)

La DT2 a trois couches, et le web doit les garder pour que les commandes du chapitre 14 et du chapitre 17 se
distinguent (5.2, 10.8.6, 14.3) :
1. **Etat de travail** (la RAM, "active working state") : tout ce qu'on touche y est ecrit tout de suite ; il survit a
   l'extinction (la machine redemarre dessus). Web : autosauvegarde continue (localStorage ou IndexedDB), comme
   aujourd'hui.
2. **Projet sauve** (le slot du +Drive) : SAVE PROJECT AS, FUNC+SETTINGS, PATTERN > SAVE TO PROJ ; c'est la reference de
   PATTERN > RELOAD FROM PROJ, de touche de page + NO (K26) et de TRK+TRIG+NO (K28). Web : un slot IndexedDB.
3. **Point temporaire** (FUNC+YES / FUNC+NO) : une copie du pattern actif en memoire ; FUNC+NO revient au point, ou a
   l'etat sauve s'il n'y a pas de point ; perdu au changement de projet. Web : en memoire seulement (pas sauvegarde),
   ce que fait deja la V.5.0.
Les songs sont ecrits dans l'etat de travail ; il faut sauver le projet pour les garder en changeant de projet (10.9.3).
PERFORM KIT : les tweaks ne s'ecrivent pas dans le kit du pattern et le kit n'est pas recharge au changement de
pattern ; PRESET/KIT + YES sauve, + NO recharge (10.10).

Limites de la DT2 (a reprendre ou a reduire, 5.1, 5.2, 10.8.1, 10.1.3, 10.9) : 128 projets ; 1024 kits ; 2048 presets
(8 banques A a H de 256) ; par projet 128 patterns (8 banques de 16), 16 songs de 99 lignes, un pool de 128 presets ;
1 kit (16 presets) par pattern ; 16 pistes ; 128 pas (8 pages) ; 80 parametres verrouilles au plus par pattern ;
une chaine de 64 patterns au plus, non sauvee. Samples : 1016 slots et 400 Mo par projet (sans objet ici : la banque
de Mika est chargee a la demande).

---------------------------------------------------------------------------------------------------------------------

## 4. Le STARTUP MENU (chapitre 15)

Acces : tenir FUNC a l'allumage ; le choix se fait par TRIG 1 a 5.

| Touche | Entree | Effet | Web |
|---|---|---|---|
| TRIG 1 | TEST MODE | auto-test materiel, un son court sur toutes les sorties ; UP/DOWN dans le journal | RETIRER (materiel ; et pas de son sans prevenir, regle du projet) |
| TRIG 2 | EMPTY RESET | efface tous les patterns et presets (l'etat de travail) ; le +Drive reste | ADAPTER : SYSTEM > RESET VIDE (vide le projet actif, garde les projets sauves) |
| TRIG 3 | FACTORY RESET | reinitialise l'etat de travail (patterns et reglages globaux) ; le slot de projet 1 et la banque de presets A sont remis a l'usine | ADAPTER : SYSTEM > RETOUR USINE (recharge le projet d'usine et les presets d'usine ; prevenir que le projet actif sera perdu s'il n'est pas sauve dans un autre slot) |
| TRIG 4 | OS UPGRADE | mise a jour de l'OS par MIDI (Transfer, SYSEX TRANSFER) | RETIRER |
| TRIG 5 | EXIT | quitte le menu | sans objet |

Pas d'allumage dans un navigateur : ces deux entrees vivent dans SYSTEM (avec une confirmation YES/NO). En option,
un raccourci cache : tenir FUNC pendant le chargement de la machine (ou FUNC + SETTINGS tenu 2 s) ouvre un mini menu
STARTUP (RESET VIDE, RETOUR USINE, EXIT), pour depanner un etat de travail casse qui empeche la machine de demarrer.

Chapitre 16 (exemples) : 16.1 sync DIN d'une machine a basse (RETIRER : DIN), 16.2 telephone en USB pour sampler
(RETIRER), 16.3 piloter un synthe avec les pistes MIDI : PORT CONFIG > OUT PORT FUNC = MIDI, OUTPUT TO = MIDI,
TRK+TRIG sur une piste a machine MIDI, SRC > CHAN = canal (OPTION, suit le choix des pistes MIDI).

---------------------------------------------------------------------------------------------------------------------

## 5. L'implementation MIDI (annexe B, et le MIDI disperse dans le manuel)

### 5.1 Les principes

- **Canaux** (14.4.3) :
  - parametres d'une piste : sur TRACK n CHANNEL (OFF = ni recu ni envoye) ; le manuel dit que les canaux par defaut
    sont 1 a 16 pour les pistes 1 a 16 (8.4) ;
  - SEND FX (delay, reverb, chorus), COMPRESSOR, master overdrive : sur FX CONTROL CH (entree et sortie) ;
  - AUTO CHANNEL : la piste active (clavier externe, enregistrement des pistes MIDI) ;
  - program change : PROGRAM CHG IN CH / OUT CH (AUTO = l'auto channel), si PRG CH RECEIVE / SEND sont coches ;
  - la sequence d'une piste MIDI part toujours sur le CHAN de sa page SRC, pas sur TRACK n CHANNEL.
  - Le manuel ne donne pas les valeurs par defaut de FX CONTROL CH et d'AUTO CHANNEL. Avec 16 pistes sur 1 a 16, le
    canal FX en partage forcement un : la table des CC le permet (5.4 reutilise des numeros de CC d'une autre facon),
    donc un canal FX egal a un canal de piste melange les deux cartes. Proposition web : FX CONTROL CH = OFF par defaut
    (ou 16 avec TRACK 16 a OFF), AUTO CHANNEL = 1 ; a arbitrer.
- **Sens** : PARAM OUTPUT choisit CC ou NRPN pour l'envoi ; ENCODER DEST = INT ou INT+EXT ; RECEIVE CC/NRPN accepte les
  deux en entree. NRPN = MIDI standard (CC 99 = NRPN MSB, CC 98 = NRPN LSB, CC 6 = data MSB, CC 38 = data LSB) : le
  manuel ne le detaille pas, c'est la norme.
- **Haute resolution** : vitesse et profondeur des 3 LFO ont un CC LSB (58 a 63) en plus du CC MSB (valeur 14 bits).
- **Notes entrantes** (8.4) : notes 0 a 15 (C0 a D#1) = declenchent les pistes 1 a 16 (sur leurs canaux par defaut),
  quelle que soit la piste active ; notes 16 a 84 (E2 a C7, C5 = note 60 = do central, nommage Elektron) = la piste
  active en chromatique, comme le mode KEYBOARD ; un clavier sur l'AUTO CHANNEL joue la piste active meme hors mode
  KEYBOARD (8.5.2). Velocite des notes : courbe VELOCITY TO VOL (SETUP > TRACK : OFF, LOG, LIN, EXP, EXP 2).
- **Program change entrant** : 0 a 127 = patterns A01 a H16 (8.4), mis en file comme une selection PTN (10.1.1).
- **TAP TEMPO** : note C0 sur FX CONTROL CH (7.3.1). Attention, sur un canal de piste C0 = piste 1 : seul le canal FX
  donne le tap.
- **Horloge et transport** : CLOCK RECEIVE / SEND, TRANSPORT RECEIVE / SEND (14.4.1).
- **Controleurs pour le jeu** (SETUP > TRACK, 9.8.2) : chacun module jusqu'a 4 parametres de piste avec une profondeur :
  KEY TRACKING (la note), VELOCITY MOD (la velocite), AFTERTOUCH, PITCH BEND (+ PITCH BEND DEPTH), MODULATION WHEEL
  (CC 1), BREATH CTRL (CC 2). Web : GARDER, ils marchent avec un clavier Web MIDI.
- **Pistes MIDI** (machine MIDI, A.2.7) : SRC = CHAN (OFF, 1-16, pas de lock), BANK (CC 0), SBNK (CC 32), PROG
  (program change), PB, AT, MW, BC ; FLTR page 1 = VAL1-8, page 2 = SEL1-8 (le numero de CC, MIDI LEARN possible) ;
  AMP page 1 = VAL9-16, page 2 = SEL9-16 ; 2 LFO seulement ; accords de 4 notes. OPTION (section 7).
- **SysEx** : seulement le SYSEX DUMP (projets, patterns, presets ; jamais les samples). RETIRER.

### 5.2 Pistes : TRACK, TRIG, SOURCE (canal de la piste)

| Groupe | Parametre | CC MSB | CC LSB | NRPN (MSB:LSB) |
|---|---|---|---|---|
| TRACK | Mute | 94 | | 1:101 |
| TRACK | Track level | 95 | | 1:100 |
| TRIG | Note | 3 | | 3:0 |
| TRIG | Velocity | 4 | | 3:1 |
| TRIG | Length | 5 | | 3:2 |
| TRIG | Filter Trig | 13 | | - |
| TRIG | LFO Trig | 14 | | - |
| TRIG | Portamento Time | 9 | | 3:7 |
| TRIG | Portamento On/Off | 65 | | 3:8 |
| SOURCE | Tune | 16 | | 1:0 |
| SOURCE | Play Mode | 17 | | 1:1 |
| SOURCE | Sample Bank Select | 24 | | 1:9 |
| SOURCE | Sample Slot Select | 19 | | 1:8 |
| SOURCE | Potard E (selon la machine) | 20 | | 1:4 |
| SOURCE | Potard F (selon la machine) | 21 | | 1:5 |
| SOURCE | Potard G (selon la machine) | 22 | | 1:6 |
| SOURCE | Sample Level | 23 | | 1:7 |

### 5.3 Pistes : FILTER, AMP, EUCLID, FX, MOD (canal de la piste)

| Groupe | Parametre | CC MSB | CC LSB | NRPN (MSB:LSB) |
|---|---|---|---|---|
| FILTER | Filter Frequency | 74 | | 1:20 |
| FILTER | Potard F (selon la machine) | 75 | | 1:21 |
| FILTER | Potard G (selon la machine) | 76 | | 1:22 |
| FILTER | Env. Depth | 77 | | 1:23 |
| FILTER | Attack Time | 70 | | 1:16 |
| FILTER | Decay Time | 71 | | 1:17 |
| FILTER | Sustain Level | 72 | | 1:18 |
| FILTER | Release Time | 73 | | 1:19 |
| FILTER | Env. Delay | 91 | | 1:23 (sic, meme NRPN que Env. Depth) |
| FILTER | Key Tracking | 92 | | 1:69 |
| FILTER | Base | 26 | | 1:51 (sic, meme NRPN que LFO2 Multiplier) |
| FILTER | Width | 27 | | 1:52 (sic, meme NRPN que LFO2 Fade) |
| FILTER | Env. Reset | 111 | | 1:68 |
| AMP | Attack Time | 79 | | 1:30 |
| AMP | Hold Time | 80 | | 1:31 |
| AMP | Decay Time | 81 | | 1:32 |
| AMP | Sustain Level | 82 | | 1:33 |
| AMP | Release Time | 83 | | 1:34 |
| AMP | Env. Reset | 88 | | 1:41 |
| AMP | Mode | 87 | | 1:40 |
| AMP | Pan | 90 | | 1:38 |
| AMP | Volume | 89 | | 1:39 |
| EUCLID | Pulse Generator 1 | - | | 3:8 (sic, meme NRPN que Portamento On/Off) |
| EUCLID | Pulse Generator 2 | - | | 3:9 |
| EUCLID | Euclidean Mode On/Off | - | | 3:14 |
| EUCLID | Rotation Generator 1 | - | | 3:11 |
| EUCLID | Rotation Generator 2 | - | | 3:12 |
| EUCLID | Track Rotation | - | | 3:13 |
| EUCLID | Boolean Operator | - | | 3:10 |
| FX | Bit Reduction | 54 | | - |
| FX | Overdrive | 57 | | - |
| FX | Sample Rate Reduction | 55 | | - |
| FX | SRR Routing | 56 | | - |
| FX | Delay Send | 84 | | 1:36 |
| FX | Reverb Send | 85 | | 1:37 |
| FX | Chorus Send | 12 | | 1:35 |
| LFO 1 | Speed | 102 | 58 | 1:42 |
| LFO 1 | Multiplier | 103 | | 1:43 |
| LFO 1 | Fade In/Out | 104 | | 1:44 |
| LFO 1 | Destination | 105 | | 1:45 |
| LFO 1 | Waveform | 106 | | 1:46 |
| LFO 1 | Start Phase | 107 | | 1:47 |
| LFO 1 | Trig Mode | 108 | | 1:48 |
| LFO 1 | Depth | 109 | 59 | 1:49 |
| LFO 2 | Speed | 112 | 60 | 1:50 |
| LFO 2 | Multiplier | 113 | | 1:51 |
| LFO 2 | Fade In/Out | 114 | | 1:52 |
| LFO 2 | Destination | 115 | | 1:53 |
| LFO 2 | Waveform | 116 | | 1:54 |
| LFO 2 | Start Phase | 117 | | 1:55 |
| LFO 2 | Trig Mode | 118 | | 1:56 |
| LFO 2 | Depth | 119 | 61 | 1:57 |
| LFO 3 | Speed | 78 | 62 | 1:58 |
| LFO 3 | Multiplier | 52 | | 1:59 |
| LFO 3 | Fade In/Out | 53 | | 1:60 |
| LFO 3 | Destination | 28 | | 1:61 |
| LFO 3 | Waveform | 29 | | 1:62 |
| LFO 3 | Start Phase | 30 | | 1:70 |
| LFO 3 | Trig Mode | 31 | | 1:71 |
| LFO 3 | Depth | 86 | 63 | 1:72 |

Note : le FX par piste de la DT2 n'a que Bit Reduction, Overdrive, SRR et SRR Routing en CC, sans NRPN.

### 5.4 Canal FX CONTROL : SEND FX, COMPRESSOR, divers

| Groupe | Parametre | CC MSB | NRPN (MSB:LSB) |
|---|---|---|---|
| DELAY | Delay Time | 21 | 2:0 |
| DELAY | Pingpong | 22 | 2:1 |
| DELAY | Stereo Width | 23 | 2:2 |
| DELAY | Feedback | 24 | 2:3 |
| DELAY | Highpass Filter | 25 | 2:4 |
| DELAY | Lowpass Filter | 26 | 2:5 |
| DELAY | Reverb Send | 27 | 2:6 |
| DELAY | Mix Volume | 28 | 2:7 |
| REVERB | Predelay | 29 | 2:8 |
| REVERB | Decay Time | 30 | 2:9 |
| REVERB | Shelving Freq | 31 | 2:10 |
| REVERB | Shelving Gain | 89 | 2:11 |
| REVERB | Highpass Filter | 90 | 2:12 |
| REVERB | Lowpass Filter | 91 | 2:13 |
| REVERB | Mix Volume | 92 | 2:15 (2:14 absent de la table) |
| CHORUS | Depth | 16 | 2:41 |
| CHORUS | Speed | 9 | 2:42 |
| CHORUS | High Pass Filter | 70 | 2:43 |
| CHORUS | Width | 71 | 2:44 |
| CHORUS | Delay Send | 12 | 2:45 |
| CHORUS | Reverb Send | 13 | 2:46 |
| CHORUS | Mix Volume | 14 | 2:47 |
| COMPRESSOR | Threshold | 111 | 2:16 |
| COMPRESSOR | Attack Time | 112 | 2:17 |
| COMPRESSOR | Release Time | 113 | 2:18 |
| COMPRESSOR | Makeup Gain | 114 | 2:19 |
| COMPRESSOR | Ratio | 115 | 2:20 |
| COMPRESSOR | Sidechain Source | 116 | 2:21 |
| COMPRESSOR | Sidechain Filter | 117 | 2:22 |
| COMPRESSOR | Dry/Wet Mix | 118 | 2:23 |
| COMPRESSOR | Pattern Volume | 119 | 2:24 |
| MISC | Master Overdrive | 17 | 2:37 |

EXTERNAL IN MIXER (canal FX, RETIRER : entrees audio) : Dual Mono 82 / 2:40 ; Input L Level 72 / 2:30 ; Input L Pan
74 / 2:32 ; Input R Level 73 / 2:31 ; Input R Pan 75 / 2:33 ; Input L Delay Send 78 / 2:36 ; Input R Delay Send 79 /
2:35 (sic) ; Input L Reverb Send 80 / 2:38 ; Input R Reverb Send 81 / 2:39 ; Input L Chorus Send 76 / 2:34 ; Input R
Chorus Send 77 / 2:35 (sic) ; en stereo : Input L R Level 72 / 2:30, Balance 74 / 2:32, Delay Send 78 / 2:36, Reverb
Send 80 / 2:38, Chorus Send 76 / 2:34. A ne pas reprendre ; les numeros 72 a 82 du canal FX restent libres chez nous.

### 5.5 Pistes MIDI (VAL) et divers

| Groupe | Parametre | CC MSB | NRPN (MSB:LSB) |
|---|---|---|---|
| CC VAL (pistes MIDI) | VAL1 a VAL8 | 70 a 77 | 1:16 a 1:23 |
| CC VAL (pistes MIDI) | VAL9 a VAL16 | - | 1:60 a 1:67 |
| MISC (canal de la piste) | Pattern Mute | 110 | 1:104 |
| MISC | Sample Slot | 19 | 1:8 (= Sample Slot Select) |
| MISC | Sample Bank | 24 | 1:9 (= Sample Bank Select) |

Les VAL reprennent les numeros du filtre et de l'enveloppe de filtre (70 a 77, 1:16 a 1:23) et ceux du LFO 3 (1:60 a
1:67) : voulu, une piste MIDI n'a ni FLTR audio ni LFO 3. Mute (CC 94) est le mute global de la piste, Pattern Mute
(CC 110) son mute de pattern.

### 5.6 Destinations des LFO (annexe C) et gammes (annexe D)

Destinations, pistes audio : META None ; LFO1 Speed, Multiplier, Fade, Waveform, Start Phase, Trig Mode, Depth
(seulement pour LFO 2 et 3) ; LFO2 les memes (seulement pour LFO 3) ; SRC Tune, Play Mode, Sample Slot, potards E F G,
Level ; FILTER (parametres de la machine), Envelope Depth, Env. Delay, Attack, Decay, Sustain, Release, Env. Reset,
Base, Width, Key Tracking ; AMP Attack, Hold, Decay, Sustain, Release, Pan, Volume ; FX Delay Send, Reverb Send, Chorus
Send, Bit Reduction, SRR, SRR Routing, Overdrive. Pistes MIDI : META None ; LFO1 (pour LFO 2) ; SRC Pitch Bend,
Aftertouch, Mod Wheel, Breath Controller ; CC1 a CC16 Values.
Gammes du KEYBOARD (36) : CHROMATIC, IONIAN (MAJOR), DORIAN, PHRYGIAN, LYDIAN, MIXOLYDIAN, AEOLIAN (MINOR), LOCRIAN,
PENTATONIC MINOR, PENTATONIC MAJOR, MELODIC MINOR, HARMONIC MINOR, WHOLE TONE, BLUES, COMBO MINOR, PERSIAN, IWATO,
IN-SEN, HIRAJOSHI, PELOG, PHRYGIAN DOMINANT, WHOLE-HALF DIMINISHED, HALF-WHOLE DIMINISHED, SPANISH, MAJOR LOCRIAN,
SUPER LOCRIAN, DORIAN b2, LYDIAN AUGMENTED, LYDIAN DOMINANT, DOUBLE HARMONIC MAJOR, LYDIAN #2 #6, ULTRAPHRYGIAN,
HUNGARIAN MINOR, ORIENTAL, IONIAN #2 #5, LOCRIAN bb3 bb7. (Detail probablement aussi chez dt-sound ou dt-seq.)

### 5.7 Erreurs et trous de l'annexe B (a ne pas recopier les yeux fermes)

- NRPN 1:23 donne deux fois : FILTER Env. Depth et FILTER Env. Delay.
- NRPN 1:51 et 1:52 donnes deux fois : FILTER Base / Width et LFO 2 Multiplier / Fade In/Out.
- NRPN 3:8 donne deux fois : TRIG Portamento On/Off et EUCLID Pulse Generator 1.
- NRPN 2:35 donne trois fois : INPUT R Delay Send, INPUT R Chorus Send (et presque Input L Chorus 2:34) : canal FX,
  sans effet pour nous (entrees retirees).
- REVERB : 2:14 manque (Mix Volume saute a 2:15).
- Les sections B.8 et B.9 sont numerotees deux fois (MOD et SEND FX, puis VAL et MISC).
- Sans CC : EUCLID (NRPN seulement), VAL9 a VAL16 ; sans NRPN : Filter Trig, LFO Trig, Bit Reduction, Overdrive, SRR,
  SRR Routing.
- Absents de la table : SWING, BPM, longueur, vitesse, micro timing, conditions, retrigs, parametres de la machine SRC
  au-dela de E F G (A B C D du SRC : Tune, Play, Bank/Slot, Level), RESO et TYPE du filtre (ce sont les potards F G
  "selon la machine"), SEND FX par piste au-dela des trois envois.
Regle proposee : recopier les CC (sans doublon sur un meme canal) ; pour les NRPN en double, garder le premier de la
table pour le parametre du DT1/DT2 le plus ancien (Env. Depth, LFO 2, Portamento) et donner aux autres un numero libre
de notre cote, documente comme "MM, pas Elektron", ou verifier sur une DT2 reelle (question 7).

### 5.8 Brancher cette carte sur nos cibles Web MIDI

Aujourd'hui (lecture de `src/v4/midi/`) : un systeme de cibles (`targets.ts` : id stable, valeur 0 a 1 ou action
press/hold) relie par MIDI LEARN (`midi.ts`), une carte automatique Roto-Control (`roto.ts`, `rotoKeys.ts`, FOLLOW,
retour aux potards motorises), un seul onglet pilote (`leader.ts`), une sortie de notes et d'horloge pour l'ARP
(`noteout.ts` : CLOCK, START, SPP, CONTINUE, STOP, ALL NOTES OFF), le Roto en sequenceur (`seqlink.ts`).
`requestMIDIAccess({ sysex: false })`. Pas trouve : reception d'horloge et de transport, program change, NRPN, carte
fixe par canal.

Proposition pour la machine a 16 pistes :
1. **Les cibles d'abord** : chaque parametre de chaque page de chaque piste (et du canal FX) a une cible stable, par
   exemple `dt:t<1-16>:<page>:<param>` et `dt:fx:<bloc>:<param>` (le nom final est a la spec ; garder les anciennes
   ids `rytm:*` en alias si la machine remplace le MM-RYTM, comme D1 l'a fait).
2. **MAP = LEARN** (existe) : rien ne change, LEARN pointe ces cibles.
3. **MAP = ELEKTRON** (nouveau) : une table fixe "numero de CC ou de NRPN sur un canal -> cible", construite depuis 5.2
   a 5.5 :
   - canal = TRACK n CHANNEL -> piste n ; AUTO CHANNEL -> piste active ; FX CONTROL CH -> SEND FX, COMPRESSOR, master
     overdrive ;
   - SOURCE potards E F G, FILTER potards F G : "ce que notre machine SRC ou FLTR met sur ce potard" (comme la DT2,
     selon la machine) ; c'est aussi la place des sons synthes existants (kick 909 et autres) ;
   - Sample Bank Select (CC 24) et Sample Slot Select (CC 19) : banque = famille de la banque de Mika (kicks, snares,
     ...), slot = son dans la famille ; GARDER, c'est le choix du son par MIDI ;
   - Play Mode (CC 17) : suit ce que nos machines gardent (ONESHOT, sens, boucle) ;
   - Mute 94 et Pattern Mute 110 : vers le mute global et le mute de pattern ;
   - TRIG Note, Velocity, Length : valeurs par defaut de la page TRIG (et p-locks si un pas est tenu, comme la DT2) ;
   - valeurs 7 bits -> echelle du parametre (crans pour les listes) ; LFO Speed et Depth en 14 bits (MSB puis LSB) ;
   - NRPN : machine a etats par canal (CC 99, 98, puis 6 et 38) ; le PARAM OUTPUT choisit ce qui part en echo.
4. **Envoi** (ENCODER DEST = INT+EXT) : un potard tourne envoie son CC (ou NRPN) sur le canal de la piste (OUTPUT CH =
   TRACK) ou sur l'auto channel (OUTPUT CH = AUTO) ; TRIG KEY DEST et MUTE DEST envoient les notes 0 a 15 et les CC 94.
   Garder la protection anti-echo de `midi.ts` (learnEcho) et la regle d'un seul onglet pilote.
5. **Notes entrantes** : notes 0 a 15 -> joue la piste n ; 16 a 84 -> piste active en chromatique (avec la gamme du
   KEYBOARD si KB FOLD) ; C0 sur le canal FX -> TAP TEMPO ; en GRID REC avec un pas tenu -> note et velocite du pas
   (H19) ; en LIVE REC -> enregistrement (avec la longueur au relachement) ; en STEP REC -> pose et avance (H36).
6. **Program change** : entree 0 a 127 -> pattern A01 a H16 (en file, comme PTN) ; sortie au changement de pattern.
7. **Horloge** : reception 0xF8 a 24 PPQN avec lissage (moyenne glissante, le fil principal du navigateur a du jitter),
   START 0xFA / CONTINUE 0xFB / STOP 0xFC, SPP 0xF2 ; envoi : reprendre `noteout.ts` (deja juste en avance de
   CLOCK_AHEAD_S) pour toute la machine.
8. **Conflit avec le Roto-Control** : sa carte automatique et MAP = ELEKTRON peuvent viser les memes numeros ; regle
   proposee : un appareil reconnu comme Roto garde sa carte, les autres suivent MAP ; une assignation LEARN gagne
   toujours (ce que fait deja `midi.ts` : "learned, overrides the Roto map").

---------------------------------------------------------------------------------------------------------------------

## 6. Ce que cette partie retire, en une liste

- Combinaisons : celles de 2.4 (SAMPLING, editeur de sample, SLICE EDITOR si les machines SLICE/GRID partent, menu
  SAMPLES de la RAM et du +Drive), H93 (SYSEX).
- SETTINGS : SYSEX DUMP ; PORT CONFIG TURBO SPEED, OUT PORT FUNC, THRU PORT FUNC ; AUDIO ROUTING USB IN, USB OUT, INT
  TO MAIN, USB TO MAIN, PRE/POST FADER, et les entrees de TO MAIN et TO FX ; SYSTEM USB CONFIG, OS UPGRADE.
- STARTUP : TEST MODE, OS UPGRADE, EXIT.
- MIDI : EXTERNAL IN MIXER (CC 72 a 82 du canal FX), SysEx.
- Les termes RAM et +Drive disparaissent de l'interface (remplaces par "memoire du navigateur" ou rien).

---------------------------------------------------------------------------------------------------------------------

## 7. Questions ouvertes (pour la spec, ou pour Mika)

1. **Pistes MIDI externes** (machine MIDI, VAL/SEL, CHAN, accords) : elles demandent du materiel (ou un DAW via un port
   virtuel). Mika a dit "16 pistes libres, tout son sur toute piste" et "sans le cote sampler" ; la consigne retire ce
   qui demande du materiel. Proposition : pas de machine MIDI dans les 2 premiers blocs, a reconsiderer au bloc 3
   puisque `noteout.ts` sait deja envoyer des notes.
2. **La touche SAMPLING** : retirer la touche (la face DT2 a une place de moins) ou garder sa place pour SAMPLES
   (navigateur de la banque de Mika en premiere fonction) ? Le placement exact est dans l'inventaire de la face.
3. **Machines SLICE / GRID** : ce sont des lecteurs de sample (pas de l'enregistrement) ; leur sort decide H12, le
   TRIG MODE SLICES et le SLICE EDITOR.
4. **RANDOM du beat** (TRIG + YES aujourd'hui) : la DT2 n'a que "page au hasard" (touche de page + YES). Garder le beat
   au hasard comme extra Maudite Machine (sur quelle combinaison ?) ou le retirer.
5. **NRPN en double** de l'annexe B (5.7) : verifier sur une vraie DT2 (Mika en a-t-il une, ou un ami ?) ou figer notre
   propre numerotation documentee.
6. **Valeurs par defaut** de FX CONTROL CH et AUTO CHANNEL (le manuel ne les donne pas) : proposition en 5.1.
7. **Clavier d'ordinateur** : la proposition 2.7 deplace les chiffres de navigation du site et les fleches de
   changement de machine quand la nouvelle machine a le focus ; a valider.
8. **Projets d'usine** : combien (la DT2 en a un, le slot 1) ; nos 30 presets et patterns d'usine actuels y seraient
   regroupes.
