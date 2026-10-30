# Inventaire séquenceur Digitakt II (agent dt-seq)

2026-10-30. Source : manuel Digitakt II OS 1.17 [M2], chapitre 10 lu en entier, chapitre 17 (combinaisons), plus les sections qui touchent le séquenceur ailleurs (3.1 panneau, 5 données, 6.2 Control All, 6.4 copier, 7.3 tempo, 8.4 à 8.5 modes, 9.8 SETUP, 11.2 et 11.3 pages TRIG, 14.2, 14.3, 14.7, annexes B et D). Les figures d'écran ont été lues sur les pages rendues (p.22, 26, 27, 37, 44, 45, 46, 48, 50, 51, 52, 53, 54).

Conventions :
- `[p.N]` = page du manuel (la page PDF a le même numéro).
- `[NC]` = valeur ou détail absent du manuel, tiré de la connaissance des machines Elektron ou déduit : à confirmer, ou à décider dans le cahier.
- `[HORS]` = hors portée de la refonte (sampling, entrées audio, USB, Overbridge, matériel, MIDI externe). `[OPTION]` = possible sur le site (WebMIDI existe déjà) mais pas indispensable.
- `[INCOH]` = le manuel se contredit ; voir la section 32.
- Les conditions négatives sont écrites avec un point d'exclamation (`!PRE`) ; le manuel les écrit avec une barre au-dessus [p.48].
- Les touches sont entre crochets comme dans le manuel : [FUNC], [TRIG 1-16], etc. « A + B » = tenir A et presser B.

---

## 1. Structure des données

- **Projet** : 128 patterns (8 banques A à H x 16), 16 songs, un pool de 128 presets, réglages globaux [p.16, p.40].
- **Pattern** [p.16, p.29, p.40] contient :
  - un kit (16 presets, un par piste) ;
  - les trigs (note et lock) des 16 pistes, les parameter locks, sample locks et preset locks ;
  - les réglages généraux de la page TRIG de chaque piste (NOTE, VEL, LEN, etc. par défaut) : ils sont rangés **avec le pattern**, pas avec le preset [p.53] ;
  - les réglages des pages SRC, FLTR, AMP, FX, MOD ; DELAY, REVERB, CHORUS, MIXER ;
  - les réglages de quantification (menu QUANTIZE) ;
  - longueur et signature (vitesse) de chaque piste, BPM (si mode tempo PATTERN), swing ;
  - les mutes de PATTERN MUTE [p.27] ;
  - les réglages du KEYBOARD SETUP (gamme, fondamentale, fold) [p.26] ;
  - le micro timing et les retrigs [p.45, p.54].
- **Kit** [p.29] : 16 presets, niveaux (LEVEL) des pistes et du pattern, compresseur et master overdrive, routage du compresseur, réglages Control All, réglages des send FX.
- **Preset** : sample + pages SRC, FLTR, AMP, FX, MOD (pour la refonte : un son de la banque de Mika ou un son de synthèse existant, avec ses réglages).
- **Pistes** : 16, chacune peut porter n'importe quel son (« any preset can be assigned to any of the 16 tracks ») [p.29]. Les pistes MIDI [HORS] (sauf choix contraire).
- **Mutes GLOBAL** : rangés avec le projet [p.27].
- **Songs** : 16 par projet, 99 lignes max chacune, sauvegardées automatiquement dans le projet en cours (il faut sauver le projet pour les garder en changeant de projet) [p.50, p.52].
- **Chaîne** : une seule, 64 patterns max, jamais sauvegardée [p.41].
- **Presse-papiers** : un seul objet à la fois (copier un trig efface le pattern copié, etc.) [p.19].
- **Limite de P-locks** : 80 paramètres différents verrouillés par pattern ; un paramètre compte pour 1 quel que soit le nombre de trigs qui le verrouillent [p.47].

---

## 2. Les touches du séquenceur et leurs fonctions secondaires

Fonction secondaire = [FUNC] tenue + appui court sur la touche [p.19], légende orange sous la touche [p.13].

| Touche | Primaire | Secondaire (FUNC +) | Autres rôles |
|---|---|---|---|
| [RECORD] | GRID REC on/off | COPY | [RECORD]+[PLAY] = LIVE REC ; [RECORD]+[STOP] = STEP REC |
| [PLAY] | lecture ; 2e appui = pause | CLEAR | |
| [STOP] | arrêt | PASTE | [STOP]+[STOP] rapide = arrêt avec fondu court des send FX |
| [PAGE] | page suivante (en GRID REC) ; FILL momentané (hors GRID REC, en lecture) | PAGE SETUP | voir sections 12 et 16 |
| [PTN] | choix de banque et pattern | BANK (choix de banque par TRIG 9-16) | |
| [SONG] | choix de song (1-16) | SONG EDIT | 2 appuis en SONG mode = SONG EDIT ; [SONG]+[LEFT] boucle la ligne ; [SONG]+[UP]/[DOWN] ligne suivante |
| [TRK] | [TRK]+[TRIG] choisit la piste | MUTE mode (GLOBAL ; double appui = PATTERN) | tenue + potard = CONTROL ALL |
| [KEYBOARD] | KEYBOARD mode on/off | KEYBOARD SETUP | [KEYBOARD]+[UP]/[DOWN] = octave |
| [TRIG 1-16] | pose/retire des trigs, joue/choisit les pistes, clavier | QUICK MUTE (hors GRID REC) ; LOCK TRIG (en GRID REC) | sélecteur de pattern, banque, song, page |
| [YES] | valider | SAVE temporaire du pattern | [YES]+[PAGE] = FILL un cycle |
| [NO] | annuler / retour | RELOAD temporaire du pattern | [NO]+[TRIG] en LIVE REC = effacer ; potard+[NO] = valeur par défaut |
| [TEMPO] | menu TEMPO (BPM, swing, métronome) | TAP TEMPO | [TEMPO]+[YES] = métronome on/off |
| [UP]/[DOWN] | navigation, pages de paramètres, octave (KB OCT) | TRIG MODE (écran principal) ; défilement par page (menus) ; insérer/supprimer une ligne (SONG EDIT) ; longueur musicale (PAGE SETUP) | |
| [LEFT]/[RIGHT] | navigation ; banque (PTN) ; nudge tempo +/-10 % tenu (lecture) | décaler tous les trigs d'un pas (GRID REC) ; supprimer le dernier pattern (créateur de chaîne) | [TRIG]+[LEFT]/[RIGHT] = MICRO TIMING ; [PAGE]+[LEFT]/[RIGHT] = page |
| [TRIG PARAMETERS] | page TRIG (1/2, rappuyer = 2/2) | QUANTIZE | |
| [SRC] | page SRC | MACHINE | |
| [FLTR] | page FLTR | SETUP (Control All config, track swap, réglages de piste) | |
| [AMP] | page AMP | SEQUENCER (euclidien) | |
| [FX] | page FX | SEND FX | |
| [MOD] | page MOD (3 LFO) | MIXER | |
| [PRESET/KIT] | menu PRESET/KIT | PERFORM KIT mode | [TRIG]+[PRESET/KIT] = sauver le son du trig en preset |
| LEVEL/DATA | niveau de piste, défilement | navigateur de presets (FUNC + tourner) | trig tenu + tourner = PRESET LOCK |
| DATA ENTRY A-H | paramètres | (FUNC en tournant = saut de valeur) | presser en tournant = grands pas ; trig tenu + presser = retire le lock |
| 8 LED <PATTERN PAGE> | nombre de pages, page éditée (fixe), page jouée (clignote) | | |

---

## 3. Transport [p.40]

- [PLAY] : démarre la lecture du pattern (ou de la chaîne, ou du song en SONG mode).
- [PLAY] pendant la lecture : **pause**. [PLAY] encore : reprise.
- [STOP] : arrête toutes les pistes, le son est coupé, les effets (delay, etc.) finissent leurs queues.
- Séquenceur arrêté, [STOP] + [STOP] rapide : coupe aussi, avec un fondu court des send FX.
- En SONG mode : [STOP] puis [PLAY] reprend à la position de la tête ; [STOP] deux fois ramène la tête au début du song [p.51].
- La tête de lecture : une lumière court sur les 16 [TRIG] à travers toutes les pages (jusqu'à 8) au tempo, en lecture ou en LIVE REC [p.13].

---

## 4. Patterns et banques [p.40]

**Choisir** (trois manières) :
1. [PTN], puis [LEFT]/[RIGHT] pour la banque (si autre que l'actuelle), puis [TRIG 1-16] pour le pattern.
2. Méthode « ancienne » : [FUNC] + [PTN], puis [TRIG 9-16] = banques A à H, puis [TRIG 1-16] = pattern de cette banque.
3. Dans la banque courante : [PTN] + [TRIG 1-16] (tenir PTN).
- [PTN] ou [NO] sort de la sélection.

**LED en sélection** : [TRIG] blanc = emplacement avec des données ; rouge = pattern actif ; éteint = vide.

**Changement en lecture** : le nouveau pattern s'affiche **en clignotant en haut à gauche de l'écran** ; il démarre quand le dernier pas du pattern en cours a joué (ou selon CHANGE, section 16), puis le clignotement cesse.
- Les patterns se changent pendant la lecture.
- [OPTION] Changement et file d'attente par program change MIDI (PC 0-127 = A01 à H16) [p.25].

**Copier, coller, effacer sans quitter le pattern actif** [p.40, p.49] :
- [PTN], puis [TRIG] + [RECORD] : choisit et copie ce pattern ;
- [TRIG] + [STOP] : colle sur ce pattern (répétable sur plusieurs emplacements) ;
- [TRIG] + [PLAY] : efface ce pattern (non actif ; plusieurs possibles).

**Contenu affiché** (écran principal) : banque/pattern « A01 », nom du pattern, icône du TRIG MODE, tempo avec icône métronome [p.18].

---

## 5. Chaînes [p.40, p.41]

- Une seule chaîne, jusqu'à **64 patterns**, de n'importe quelle banque A à H. Elle boucle après le dernier pattern.
- **Créateur de chaîne** :
  1. [PTN], puis [FUNC] + [YES] : ouvre l'écran CHAIN ;
  2. [LEFT]/[RIGHT] = banque, [TRIG 1-16] = ajoute un pattern ; répéter ;
  3. [FUNC] + [LEFT] : retire le dernier pattern de la chaîne ;
  4. [YES] valide et ferme ; [NO] annule et ferme ;
  5. [PLAY] joue la chaîne.
- **Méthode ancienne** : tenir [PTN] et presser le [TRIG] du premier pattern ; relâcher [PTN] ; presser les [TRIG] suivants dans l'ordre **en gardant le précédent enfoncé** ; le même [TRIG] peut être répété ; [LEFT]/[RIGHT] change de banque en cours de route ; [PLAY] joue.
- Sortir de la chaîne : choisir un pattern ou un song de la manière normale.
- La chaîne est perdue quand on en crée une autre, qu'on choisit un pattern ou un song, ou à l'extinction. Elle se crée aussi pendant la lecture.
- Un song peut être créé depuis une chaîne (CREATE ROWS FROM CHAIN, section 20).
- Le passage au pattern suivant : en fin de pattern, ou selon CHANGE / RESET (PAGE SETUP en PER TRACK).

---

## 6. Types de trigs [p.41]

| Type | Effet | LED |
|---|---|---|
| NOTE TRIG | joue le son de la piste (ou note MIDI) | rouge |
| LOCK TRIG (trigless) | applique ses parameter locks sans jouer de note | jaune |
| Trig avec P-lock | | clignote rouge (note) ou jaune (lock) |
| Pas vide | | éteint |
| Trig euclidien généré | | bleu (section 17) |

- Pose d'un lock trig : [FUNC] + [TRIG] en GRID REC.
- Un trig peut aussi porter : micro timing, retrig, condition, FILL, preset lock, sample lock.

---

## 7. Les trois modes d'enregistrement

### 7.1 GRID RECORDING [p.42]

- **Entrer/sortir** : [RECORD] ; LED [RECORD] **rouge fixe**.
- **Piste** : tenir [TRK] et presser [TRIG 1-16] ; le [TRIG] rouge = piste active.
- **Poser** : [TRIG] = note trig ; [FUNC] + [TRIG] = lock trig.
- **Retirer** : appui **court** sur un trig posé = le retire. Appui **un peu plus long** = prépare le trig pour l'édition (le garde, ouvre ses verrous).
- **Plusieurs trigs tenus** : tenir plusieurs [TRIG] pour régler ensemble micro timing, retrig, verrous ; copier plusieurs trigs (section 18).
- **Micro timing** : [TRIG] tenu + [LEFT]/[RIGHT] (section 13).
- **Retrig** : [TRIG PARAMETERS] deux fois (page RETRIG = TRIG 2), tenir le(s) trig(s), régler (section 14).
- **Pages** (si plus de 16 pas) :
  - [PAGE] passe à la page suivante ; la LED <PATTERN PAGE> pleine = page éditée ;
  - [PAGE] tenue + un des [TRIG 1-8] allumés = aller à cette page ; [PAGE] tenue + [LEFT]/[RIGHT] = page précédente/suivante.
- **Boucler des pages choisies** : [PAGE] tenue + [TRIG 9-16] (= pages 1 à 8) choisit les pages qui jouent et bouclent ; [TRIG] verts = pages choisies. Exemple : pattern de 8 pages, boucler 1, 2, 5 et 7 = [PAGE] + [TRIG 9, 10, 13, 15]. Pendant ce temps, rangée du haut [TRIG 1-8] : le [TRIG] qui clignote = position maîtresse ; rangée du bas [TRIG 9-16] : celui qui clignote = la page qui joue. [PAGE] + [NO] = retour à la lecture de toutes les pages.
- **Préécoute d'un trig** : [TRIG] + [YES] joue le trig avec ses verrous (aussi en STEP REC) [p.42, p.90].
- **Son d'un trig en preset** : [TRIG] + [PRESET/KIT] sauve le son du trig comme preset, verrous compris.
- **Décaler toute la piste** : [FUNC] + [LEFT]/[RIGHT] décale tous les trigs de la piste d'un pas entier. Bouclage en bout de piste [NC].
- **Verrous visibles** : trig tenu qui a des verrous = les touches [PARAMETER] des pages concernées s'allument en rouge [p.47].
- [OPTION] Clavier MIDI externe : tenir un [TRIG] et jouer une note = NOTE et VEL du trig (accords de 4 notes sur pistes MIDI) [HORS pour les accords].
- Les copier/coller de piste, page, trig, page de paramètres se font en GRID REC (section 18).

### 7.2 LIVE RECORDING [p.42, p.43]

- **Entrer** : tenir [RECORD], presser [PLAY]. La lecture démarre, LED [RECORD] **rouge clignotante**.
- **Quantification automatique** : tenir [RECORD] et presser [PLAY] **deux fois** = active/désactive la quantification de l'enregistrement en direct (chap. 17 : « [RECORD] + double [PLAY] = QUANTIZE LIVE RECORDING »). Sans quantification, les trigs sont posés hors grille (micro timing) et se quantifient après par le menu QUANTIZE (section 15).
- **Écrire** :
  - les [TRIG] joués en temps réel écrivent des trigs (en TRIG MODE TRACKS : chaque [TRIG] = sa piste) ;
  - en KEYBOARD mode : la hauteur jouée s'écrit dans la NOTE du trig de la piste active ;
  - la durée d'appui sur le [TRIG] écrit la LEN du trig [p.53] ;
  - tout ce que font les TRIG MODES s'enregistre (vélocités, retrigs, presets du pool) [p.27] ;
  - tourner un potard d'une page de paramètres écrit des parameter locks et **pose des lock trigs là où il faut** (sur les pas sans trig) ; réglable par PARAM LIVE REC (section 27).
- **Effacer en direct** : [NO] + un (ou plusieurs) [TRIG] = efface les trigs de cette (ces) piste(s) au fil de la tête de lecture, tant que les touches sont tenues.
- **Retirer un verrou en direct** : tenir [NO], puis tenir le potard du paramètre = efface les verrous de ce paramètre sur la piste au fil de la lecture.
- **Sortir** :
  - [PLAY] = sort de LIVE REC, la lecture continue ;
  - [RECORD] = passe en **GRID REC** (pas un arrêt de l'enregistrement) ;
  - [STOP] = arrête l'enregistrement **et** la lecture.
- **Métronome** : PREROLL = nombre de mesures de décompte avant le départ, seulement en LIVE REC (section 24).
- LIVE REC OVERDUB (section 27) : ajouter aux trigs existants au lieu de les remplacer.
- [HORS] Clavier MIDI externe (NOTE, VEL, LEN, accords de 4 notes).

### 7.3 STEP RECORDING [p.43, p.44]

- **Entrer** : [RECORD] + [STOP]. LED [RECORD] **rouge, double clignotement**.
- **Deux sous-modes** : tenir [RECORD] et presser [STOP] **deux fois** = bascule STANDARD / JUMP.
- **STANDARD** :
  1. un [TRIG] choisit le **pas actif** de départ ; il s'affiche en **vert, double clignotement** (sur un trig déjà posé, il garde la lumière de ce trig) ; [LEFT]/[RIGHT] déplacent le pas actif ou sautent des pas ;
  2. [FUNC] + [TRIG 1-16] : pose un note trig **de la piste correspondante** au pas actif, puis le pas actif avance d'un pas ;
  3. [TRK] + [TRIG 1-16] : choisit la piste active (rouge) ;
  4. [KEYBOARD] : bascule le clavier chromatique ; tenir [KEYBOARD] et presser un [TRIG] allumé = pose un note trig de cette note sur la piste active, puis avance ; [UP]/[DOWN] = octave ;
  5. [NO] sur le pas actif : retire le trig ou pose un silence, puis avance ;
  6. tenir un [TRIG] + tourner un potard = parameter lock (graphisme inversé, valeur affichée, [TRIG] clignote rouge ou jaune) ;
  7. [RECORD] sort.
- **JUMP** : la LEN de la page TRIG fixe la longueur de la note posée **et** le saut du pas actif : 1/16 = 1 pas, 1/8 = 2 pas, 1/4 = 4 pas, etc. La LEN est verrouillée sur chaque trig posé.
- **Détails** :
  - [PLAY] écoute pendant la saisie ; [STOP] arrête et reste en STEP REC ;
  - en TRIG MODE SLICES ou PRESET POOL, il faut [FUNC] + [TRIG] pour poser ;
  - tenir [YES] pendant qu'on pose un trig = la LEN du trig est verrouillée sur la durée d'appui ;
  - poser un note trig sur un trig existant garde ses verrous ;
  - en STEP REC, [FUNC] + [NO] ne recharge pas et [FUNC] + [YES] ne sauve pas le pattern (protection) ;
  - [HORS] clavier MIDI externe : VEL verrouillée sur la vélocité reçue ; [FUNC] tenue = vélocité fixe (VEL de la page).

---

## 8. Les pages TRIG (réglages de trig) [p.53, p.54]

Réglages **par piste**, rangés **dans le pattern**. Sans trig tenu : valeur par défaut de la piste. Trig tenu : verrou de ce trig. Disposition des potards lue sur les écrans (rangée haute A-D, rangée basse E-H, LEV à gauche).

**TRIG 1/2** (écran p.53)

| Potard | Nom | Rôle | Valeurs |
|---|---|---|---|
| A | NOTE | hauteur du trig | affichée « C 5 (60) » ; défaut C5 = 60 [p.53] ; plage du clavier C0 à G10 [p.25] ; presser + tourner = notes de la gamme KB SCALE seulement (inversable par NOTE PARAM) ; FUNC = saut d'octave [p.19] |
| B | VEL | vélocité | 1 à 127, défaut 100 [NC] |
| C | LEN | longueur de note | manuel muet ; Elektron : 0.125 à 128 pas et INF [NC] ; en LIVE REC la durée d'appui l'écrase |
| D | PROB | probabilité que les trigs de la piste jouent, réévaluée à chaque trig | 0 à 100 %, défaut 100 % [p.53] ; verrouillable par trig |
| E | LFO.T | le trig relance (ou non) les LFO | ON/OFF (interrupteur) |
| F | FLT.T | le trig relance (ou non) l'enveloppe de filtre | ON/OFF |
| G | FILL | condition de FILL séparée | ON = joue seulement en FILL ; OFF = joue seulement hors FILL [p.54]. Icône cadenas à l'écran sans trig tenu : réglable seulement en verrou de trig [NC, lecture de la figure] |
| H | COND | condition de trig (conditional lock) | liste en section 11 ; icône cadenas sans trig tenu, comme FILL |

**TRIG 2/2** (« RETRIG PARAMETERS », [TRIG PARAMETERS] deux fois) (écran p.54)

| Potard | Nom | Rôle | Valeurs |
|---|---|---|---|
| A | RTRG | retrig on/off | ON/OFF |
| B | VFAD | fondu de vélocité des retrigs sur la durée LEN | -64 à 64 : -64 = fondu complet vers 0, -32 = vers la moitié, 0 = plat, 32 = monte vers la moitié, 64 = monte jusqu'au plein [p.54] ; dépend aussi de VEL |
| C | LEN | durée de la courbe du retrig | 0,125 à INF, en pas (1/16 = un pas) ; affiché « 1/16 » |
| D | RATE | vitesse du retrig | 1/1, 1/2, 1/3, 1/4, 1/5, 1/6, 1/8, 1/10, 1/12, 1/16, 1/20, 1/24, 1/32, 1/40, 1/48, 1/64, 1/80 ; 1/16 = un coup par pas, 1/32 = deux ; triolets = 1/12 ou 1/24 ; affiché « 1/32 » |
| E | (vide) | | |
| F | (vide) | | |
| G | PTIM | temps de portamento | 0 à 127 [NC] |
| H | PORT | portamento on/off | ON/OFF (pistes audio) ; réglages avancés dans SETUP > TRACK > PORTAMENTO |

- Navigation : [TRIG PARAMETERS] rappuyé ou [UP]/[DOWN] passe de 1/2 à 2/2 [p.53].
- Les retrigs ne s'appliquent pas aux pistes MIDI.
- [HORS] Pistes MIDI : TRIG 1 = NOTE, VEL, LEN, PROB, LFO.T, NOT2, NOT3, NOT4 (accords) ; TRIG 2 = FILL, COND [p.101].

---

## 9. Parameter locks [p.47]

- **Ce qui se verrouille** : tous les paramètres des pages de paramètres (TRIG, SRC, FLTR, AMP, FX, MOD), sur tous les types de pistes. Le verrou du paramètre SAMP (choix du sample) s'appelle **sample lock** [p.101] (pour la refonte : changer de son de la banque par pas).
- **En GRID REC** : poser un note trig ([TRIG]) ou un lock trig ([FUNC] + [TRIG]), **tenir** le [TRIG], tourner le potard. Le paramètre verrouillé s'affiche **en graphisme inversé** avec sa valeur ; le [TRIG] **clignote** rouge (note) ou jaune (lock).
- **En LIVE REC** : tourner un potard (ou jouer en KEYBOARD) écrit des verrous sur la piste active ; note trigs verrouillés, et lock trigs posés sur les pas sans trig.
- **En STEP REC** : tenir un [TRIG] et tourner.
- **Retirer un verrou** : tenir le [TRIG] + **presser** le potard du paramètre.
- **Retirer tous les verrous d'un trig** : retirer le note trig et le reposer.
- **Retirer en direct** (LIVE REC) : [NO] tenue + potard tenu (section 7.2).
- **Toute la page d'un coup** : tenir [TRIG] + [PAGE] (ou [TRK]) puis tourner un potard = verrou ajouté à **tous les trigs existants de la page** [p.47, p.89] [INCOH : formulation ambiguë].
- **Voir où sont les verrous** : en GRID REC, tenir un trig verrouillé allume en rouge les touches [PARAMETER] des pages qui portent des verrous.
- **Limite** : 80 paramètres différents par pattern.
- Plusieurs trigs tenus : le verrou s'applique à tous.

---

## 10. Preset locks [p.48]

- Changer le preset (le son) de la piste sur un pas.
- Tenir un **note trig** et tourner **LEVEL/DATA** : la liste du **pool** s'ouvre ; LEVEL/DATA fait défiler ; relâcher le [TRIG] attribue le preset sélectionné.
- Tenir le [TRIG] d'un note trig : affiche le preset attribué.
- Seuls les presets du **pool** du projet (128 max) sont verrouillables [p.29] ; ajout au pool par PRESET MANAGER > ADD TO PRESET POOL. Les presets MIDI ne vont pas dans le pool.
- Pour la refonte : le « pool » = un choix de sons (banque de Mika + synthèse) attachés au projet.

---

## 11. Conditions de trig (conditional locks) [p.48, p.49]

**Pose** : en GRID REC ou STEP REC, poser un note trig ou un lock trig, le tenir, régler COND (potard H de TRIG 1). Si la condition est vraie, le trig joue ; fausse, il ne joue pas.

**Liste (ordre du manuel)** :

| Condition | Vrai quand |
|---|---|
| (aucune) | défaut, affiché cadenas |
| PRE | la dernière condition évaluée **sur la même piste** était vraie ; les PRE et !PRE ne sont pas évalués (ignorés) pour ce calcul |
| !PRE | la dernière condition évaluée sur la même piste était fausse |
| NEI | la dernière condition évaluée **sur la piste voisine** (la piste n-1 : la 3 pour la 4) était vraie ; PRE et !PRE de la voisine ignorés ; **faux s'il n'y a aucun trig conditionnel sur la voisine** |
| !NEI | la dernière condition évaluée sur la voisine était fausse |
| 1ST | le premier passage du pattern (en boucle) |
| !1ST | tous les passages sauf le premier |
| LST | le dernier passage avant de changer de pattern |
| !LST | tous sauf le dernier passage avant changement |
| A:B | au passage A d'un cycle de B passages ; le compteur se remet à zéro après B et recommence jusqu'à l'arrêt |
| !A:B | le contraire de A:B |

- A:B compte les passages **du pattern**, ou **de la piste** si la piste est plus courte que le pattern.
- Exemples du manuel : 1:2 = passages 1, 3, 5 ; 2:2 = 2, 4, 6 ; 2:4 = 2, 6, 10 ; 4:7 = 4, 11, 18 ; !2:4 = joue partout sauf 2, 6, 10.
- Exemples PRE : `Trig 1, 50 % = vrai > Trig 2, !PRE = faux > Trig 3, !PRE = faux > Trig 4, PRE = vrai` ; `Trig 1, 50 % = faux > Trig 2, !PRE = vrai > Trig 3, !PRE = vrai > Trig 4, PRE = faux`. Donc une **probabilité évaluée compte comme une condition** pour PRE/NEI.
- Plage de A:B : B de 2 à 8, A de 1 à B (1:2 ... 8:8) [NC].
- FILL n'est **pas** dans COND sur la DT2 : c'est le paramètre FILL séparé (G). PROB n'est pas dans COND non plus : c'est le paramètre PROB (D). Interaction COND + PROB + FILL sur un même trig : non décrite [NC] (proposition : le trig joue si FILL est satisfait ET COND est vraie ET le tirage PROB passe).
- Usages cités : grilles de trigs mutuellement exclusifs entre pistes, deux séquences sur une piste dont l'une seulement en FILL.

---

## 12. FILL mode [p.49, p.90]

- **Un cycle** : [YES] + [PAGE] = FILL actif pour un cycle du pattern ; il commence **quand le pattern boucle** et reste actif jusqu'au bouclage suivant. Chap. 17 : presser [PAGE] à nouveau le désactive.
- **Momentané** : tenir [PAGE] pendant la lecture (**pas en GRID REC**, où PAGE change de page) = FILL tant que la touche est tenue, à tout moment.
- **Verrouillé (latch)** : tenir [PAGE] + [YES], relâcher [PAGE] **avant** [YES] = FILL verrouillé ; [PAGE] à nouveau = déverrouille.
- Effet : les trigs FILL = ON jouent, les trigs FILL = OFF ne jouent pas ; les autres jouent normalement.
- Indication à l'écran ou LED : non décrite [NC].

---

## 13. Micro timing [p.45]

- Sur tous les pas, pistes audio et MIDI.
- En GRID REC : tenir un ou plusieurs [TRIG], presser [LEFT]/[RIGHT] : une fenêtre **MICRO TIMING** s'ouvre (règle graduée, valeur, ex. « +1/384 ») ; [LEFT]/[RIGHT] règlent le décalage ; relâcher le(s) [TRIG] ferme la fenêtre.
- Tous les trigs de la piste : tenir [TRIG] + [FUNC] puis [LEFT]/[RIGHT].
- Plage : pas de 1/384, de -23/384 à +23/384 [NC] (1/384 de ronde, un pas = 24/384).
- Rangé dans le pattern actif.
- La fenêtre s'affiche par-dessus la page TRIG 1 (figure p.45).

---

## 14. Retrigs [p.45, p.54]

- Pistes audio seulement.
- Par trig : TRIG 2/2 (section 8) avec un ou plusieurs trigs tenus ; la page montre les réglages des pas tenus de la piste active. Rangé dans le pattern.
- Comme défaut de piste : TRIG 2/2 sans trig tenu.
- Jeu en direct : TRIG MODE RETRIGS (section 23), enregistrable en LIVE REC.

---

## 15. Quantification [p.42, p.45]

- **Live** : quantification automatique de LIVE REC ([RECORD] + double [PLAY]).
- **Menu QUANTIZE** : [FUNC] + [TRIG PARAMETERS]. Agit sur tous les trigs micro-timés et hors grille.
  - **TRACK** (potard E) : pourcentage sur tous les trigs de la piste active, en temps réel ; [TRIG 1-16] choisit la piste ; écran « TRACK 1 ».
  - **PATTERN** (potard H) : pourcentage sur toutes les pistes du pattern, en temps réel.
  - Plus la valeur est haute, plus les trigs sont ramenés sur la grille. 0 % à 100 % [NC sur le maximum] ; écran « 0% (E) » et « 0% (H) » avec un dessin de note sur grille.
  - [NO] ferme.
- Le réglage est rangé dans le pattern [p.40].

---

## 16. Pages, longueurs, vitesses : PAGE SETUP [p.45, p.46, p.47]

- **Jusqu'à 128 pas** = 8 pages de 16.
- **Ouvrir** : [FUNC] + [PAGE] (écran « SEQUENCER PAGE SETUP »). [FUNC] + [YES] bascule **PER PATTERN / PER TRACK** (pied d'écran : « Fn+Y: PER TRACK » ou « Fn+Y: PER PATTERN »).

**PER PATTERN** (toutes les pistes ont la même longueur et signature) :

| Potard | Nom | Valeurs |
|---|---|---|
| E | LENGTH | nombre de pas ; affiché « 16/16 » : le chiffre de gauche = pas choisis (le chiffre de droite = pas des pages utilisées [NC]) |
| F | SPEED | 1/8X, 1/4X, 1/2X, 3/4X, 1X, 3/2X, 2X ; affiché « 1x » |

**PER TRACK** (chaque piste sa longueur et sa vitesse) : deux colonnes.

| Potard | Colonne | Nom | Valeurs |
|---|---|---|---|
| E | TRK.n (piste active) | LENGTH | pas de la piste |
| F | TRK.n | SPEED | 1/8X à 2X (7 valeurs) |
| G | PATTERN | CHANGE | durée (en pas) avant de passer au pattern en attente ou chaîné ; OFF = en fin de pattern (défaut) ; plage numérique [NC : 2 à 1024 comme ROW LENGTH] |
| H | PATTERN | RESET | nombre de pas avant que toutes les pistes repartent du pas 1 de la page 1 ; INF = jamais (polymétrie infinie) ; affiché « 16 » ; plage [NC] |

- RESET compte aussi pour la durée avant le passage au pattern chaîné ; **CHANGE l'emporte s'il est plus petit que RESET**. Avec RESET = INF et CHANGE = OFF, le pattern en attente ne joue jamais : régler CHANGE.
- **Raccourcis dans le menu** :
  - [PAGE] répété = change vite la longueur totale (nombre de pages) ;
  - [TRIG 1-16] = change vite le nombre de pas (dans la page) ;
  - [FUNC] + [UP]/[DOWN] = longueur de piste par incréments musicaux, de 2/16 à 128/128 (p.47) ou 2/16 à 64/64 (p.89) [INCOH].
- **Recopie à l'allongement** : allonger un pattern recopie ses pages (2 pages passées à 4 = les pages 3 et 4 copient 1 et 2), si PAGE AUTOCOPY est ON (section 27).
- Usages : 2X = résolution en triples croches ; 3/4X = triolets à côté d'autres machines au même BPM.
- **LED <PATTERN PAGE>** (8) : combien de pages compte le pattern, laquelle est éditée (pleine), laquelle joue (clignote).
- Navigation des pages et boucle de pages choisies : section 7.1.
- Minimum de LENGTH : non dit ; 2 d'après « 2/16 » [NC] (le champ ROW LENGTH des songs commence aussi à 2).

---

## 17. Séquenceur euclidien (menu SEQUENCER) [p.44, p.45, p.110]

- **Ouvrir** : [FUNC] + [AMP]. Par piste.
- **Écran** : rangée haute PL1, PL2, LEN, EUC ; rangée basse R01, R02, TRO, OP (exemple : PL1 5, PL2 5, LEN 16, EUC on, OP OR).

| Potard | Nom | Rôle | Valeurs |
|---|---|---|---|
| A | PL1 | nombre d'impulsions du générateur 1 | 0 à LEN [NC] |
| B | PL2 | impulsions du générateur 2 | 0 à LEN [NC] |
| C | LEN | longueur de la piste (seulement en PER TRACK) | 1 ou 2 à 128 [NC] |
| D | EUC | mode euclidien on/off | ON/OFF |
| E | R01 | rotation du générateur 1 | -LEN à +LEN ou 0 à LEN-1 [NC] |
| F | R02 | rotation du générateur 2 | idem [NC] |
| G | TRO | rotation de toute la piste (les deux générateurs) | idem [NC] |
| H | OP | opérateur booléen | OR (tous les trigs des deux), XOR (les deux sauf les pas communs), AND (seulement les pas communs), SUB (ceux de 1 sauf là où 2 en a un) |

- Les impulsions sont réparties le plus régulièrement possible.
- EUC ON : la LED [RECORD] devient **bleue** ; les [TRIG] des trigs générés sont **bleus**.
- Les trigs posés avant sont **cachés et inactifs**, ils reviennent quand on coupe EUC.
- **Convertir** en trigs normaux : tenir [FUNC] en coupant EUC ; les trigs d'avant sont alors supprimés.
- En mode euclidien, impossible de poser des note trigs à la main ; on peut verrouiller (P-lock) les trigs générés.
- Un trig généré qu'on presse (pour le verrouiller) reste un trig normal quand on coupe EUC.
- Note p.45 : « des trigs posés en mode normal sont redistribués selon les réglages en passant en euclidien » [INCOH avec « cachés »].
- [OPTION] NRPN 3:8 à 3:14 pour ces 7 paramètres.

---

## 18. Copier, coller, effacer [p.19, p.49, p.88]

Règle générale : [FUNC] + [RECORD] = copier, [FUNC] + [STOP] = coller, [FUNC] + [PLAY] = effacer. **Coller et effacer s'annulent en refaisant la même combinaison.** Le presse-papiers ne tient qu'un objet.

| Objet | Condition | Copier | Coller | Effacer |
|---|---|---|---|---|
| Pattern actif | GRID REC **éteint** | [FUNC]+[RECORD] | choisir un autre pattern, [FUNC]+[STOP] | [FUNC]+[PLAY] (tous les trigs du pattern) |
| Pattern non actif | écran [PTN] | [TRIG]+[RECORD] | [TRIG]+[STOP] (plusieurs cibles) | [TRIG]+[PLAY] (plusieurs) |
| Piste (séquence de la piste active) | GRID REC **allumé** | [FUNC]+[RECORD] | [FUNC]+[STOP] sur la piste active | [FUNC]+[PLAY] |
| Page de piste | [PAGE] choisit la page (GRID REC selon p.88) | [PAGE]+[RECORD] | autre page, [PAGE]+[STOP] | [PAGE]+[PLAY] |
| Page de paramètres | touche [PARAMETER] | [PARAMETER]+[RECORD] | autre piste, même [PARAMETER]+[STOP] | [PARAMETER]+[PLAY] (= valeurs par défaut) |
| Trig(s) avec verrous | GRID REC | tenir le(s) trig(s) + [RECORD] | tenir le trig de destination + [STOP] (garde l'écart entre trigs ; la destination = point de départ) | tenir le(s) trig(s) + [PLAY] [INCOH : efface les verrous ou le trig] |
| Preset de piste | | [TRK]+[RECORD] (ou [TRK]+[TRIG]+[RECORD]) | [TRK]+[STOP] (ou [TRK]+[TRIG]+[STOP]) | [TRK]+[PLAY] |
| Ligne de song | écran SONG EDIT | [FUNC]+[RECORD] | [FUNC]+[STOP] | [FUNC]+[PLAY] = remise aux valeurs du pattern |

Autres effacements : SETTINGS > PATTERN > CLEAR (WHOLE PATTERN, KIT DATA, SEQUENCE DATA), section 19 ; SETTINGS > SONG > CLEAR.

---

## 19. Sauvegarde temporaire, menu PATTERN, PERFORM KIT

**Temporaire** [p.49, p.50] :
- [FUNC] + [YES] : TEMPORARY SAVE PATTERN, un point de restauration en mémoire (pas sur disque).
- [FUNC] + [NO] : TEMPORARY RELOAD PATTERN, revient au dernier point ; sans point, revient à l'état sauvegardé pour de bon.
- Perdu si on charge un autre projet. Inactif en STEP REC. Marche aussi en PERFORM KIT.

**Menu PATTERN** (SETTINGS > PATTERN) [p.76, p.77] :
- RENAME (écran de nom) ;
- CLEAR : WHOLE PATTERN (séquence + kit), KIT DATA (kit seul), SEQUENCE DATA (séquence seule) ; demande YES/NO ; rien n'est perdu tant que le pattern n'est pas sauvé sur son emplacement ;
- SAVE TO PROJ : WHOLE PATTERN, KIT DATA, SEQUENCE DATA (le projet doit avoir été sauvé une fois) ;
- RELOAD FROM PROJ : WHOLE PATTERN, KIT DATA, SEQUENCE DATA.
- [FUNC] + [SETTINGS] : sauve le projet.

**PERFORM KIT mode** [p.52] :
- [FUNC] + [PRESET/KIT] : on/off. Écran : **« P » clignotant** à côté du nom du pattern ; touche [PRESET/KIT] **orange**.
- Les changements de sons ne se sauvent pas automatiquement et le kit **n'est pas rechargé** au changement de pattern : on garde le kit retouché d'un pattern à l'autre.
- [PRESET/KIT] + [NO] : recharge tout de suite le kit du pattern en cours.
- [PRESET/KIT] + [YES] : sauve le kit modifié (menu SAVE KIT).
- Rien ne survit à l'extinction sans sauvegarde du pattern.

---

## 20. SONG mode [p.50, p.51, p.52, p.76]

**Structure** : 16 songs par projet ; un song = jusqu'à **99 lignes** + une ligne **END** toujours présente. Chaque ligne : pattern, répétitions, longueur, tempo, mutes.

**Entrer** : [SONG] puis [TRIG 1-16] = choisit le song et entre en SONG mode (le song proposé = le dernier joué ou édité). **Sortir** : choisir un pattern ([PTN] + [TRIG 1-16]).

**SONG EDIT** : [FUNC] + [SONG] (ou [SONG] deux fois en SONG mode). [NO] ou [FUNC] + [SONG] ferme. [ARROW] navigue lignes et colonnes ; LEVEL/DATA ou n'importe quel potard règle la case.

Écran SONG EDIT (figure p.50) :

| N° | Élément | Détail |
|---|---|---|
| 1 | SONG ROW (`#`) | 01 à 99 |
| 2 | LABEL | mot-clé de structure (INTRO, VERSE, BRIDGE, CHORUS vus sur la figure ; FILL cité) ou le nom du pattern ; liste complète [NC] |
| 3 | PTN | pattern de la ligne (ex. A03, B12) ; [FUNC] en tournant = change vite de banque |
| 4 | ROW PLAY COUNT (icône boucle) | nombre de passages avant la ligne suivante ; plage [NC] |
| 5 | ROW LENGTH (icône flèche-barre) | pas joués du pattern ; défaut = longueur du pattern ; 2 à 1024, les 25 dernières valeurs écrites K00 à K24 (1000 à 1024) ; affiché « 016 », « 064 » |
| 6 | ROW TEMPO (icône métronome) | BPM de la ligne (ex. 120.0, 110.0) ; défaut = BPM et swing du pattern ; [TEMPO] ouvre le menu TEMPO du pattern de la ligne (swing compris) ; [YES] sur le BPM aussi ; choisir le **tempo de song** sur une ligne remplace tous les tempos de lignes et de patterns ; le **swing est toujours par ligne** |
| 7 | SONG POINTER | temps et position de la tête dans le song (« 0001:1 » en haut à droite) |
| 8 | ROW MUTE (icône haut-parleur barré) | [YES] sur la case pour éditer, [TRIG] = muter/démuter les pistes ; une icône de mute s'affiche sur les lignes avec des pistes mutées ; au choix du pattern, l'état initial reprend les mutes du pattern |
| 9 | END | dernière ligne : LOOP (défaut, rejoue du début) ou STOP |
| 10 | ligne choisie | entre deux lignes pointillées ; [UP]/[DOWN] |
| 11 | PLAYHEAD | flèche sur la ligne qui joue (ou qui jouera à l'arrêt) |
| 12 | SONG SLOT et SONG NAME | « 01:SAD SONG » |

**Créer** :
- Song vide : écran de choix INSERT ROW ([FUNC] + [DOWN] insère la première ligne) ou CREATE ROWS FROM CHAIN ([YES], puis une chaîne déjà faite ou une nouvelle avec [TRIG 1-16], [LEFT]/[RIGHT] = banque, [YES] crée le song et ouvre SONG EDIT).
- [FUNC] + [DOWN] : nouvelle ligne **sous** la ligne choisie, copie de celle-ci.
- [FUNC] + [UP] : supprime la ligne choisie.
- [FUNC] + [RECORD] copie la ligne ; [FUNC] + [STOP] la colle sur la ligne choisie ; [FUNC] + [PLAY] remet la ligne aux BPM, longueur et mutes par défaut du pattern.
- Choisir un numéro de ligne puis [YES] = y amène la tête de lecture.
- [TRIG 1-16] dans SONG EDIT = préécoute des sons des pistes du pattern de la ligne de la tête.
- Renommer : SETTINGS > SONG > RENAME.

**Jouer** :
- [PLAY] ; en haut de l'écran : numéro de song, ligne en cours / total, LABEL, banque/pattern, ex. « S01 02/04:VERSE A01 » ; cette zone sert de **barre de progression** de la ligne.
- [STOP] puis [PLAY] = reprend à la tête ; [STOP] deux fois = tête au début.
- [SONG] + [LEFT] (en SONG mode) : boucle la ligne en cours ; encore = reprend le song.
- [SONG] + [UP]/[DOWN] : choisit la ligne où sauter ensuite (p.51) ; monte/descend la tête d'une ligne (p.90) [INCOH mineure].

**Menu SETTINGS > SONG** : RENAME, CLEAR (song actif), LOAD (choisir et charger un song), SAVE TO PROJ.

**Sauvegarde** : automatique pendant la création et l'édition ; sauver le projet pour les garder avant de changer de projet.

---

## 21. Mutes [p.22, p.26, p.27, p.89]

- **MUTE mode** : les [TRIG] deviennent les 16 pistes, quelle que soit la piste active. [TRIG] = mute/démute. **Allumé = joue, éteint = muté.**
- **GLOBAL MUTE** : muet dans **tous** les patterns ; rangé avec le projet. [FUNC] + [TRK] entre et sort. Touches **vertes** ; une piste mutée qui a des trigs **clignote vert** quand le pattern joue.
- **PATTERN MUTE** : muet dans le **pattern actif** seulement ; rangé avec le pattern. [FUNC] + **double appui** [TRK] entre ; [FUNC] + [TRK] sort. Touches **magenta** ; une piste mutée avec trigs clignote magenta.
- Piste mutée dans les deux : clignote magenta dans les deux modes.
- **Préparer** : en MUTE mode, tenir [FUNC] et presser des [TRIG] : l'action se fait **au relâcher de [FUNC]**. Écran, en haut, vue des 16 pistes : **carré = joue, trait horizontal = muté, + = préparé pour démuter, X = préparé pour muter**.
- **QUICK MUTE** : [FUNC] + [TRIG] (hors MUTE mode et hors GRID REC [NC, déduit : en GRID REC FUNC + TRIG pose un lock trig]) mute/démute une ou plusieurs pistes.
- La machine se souvient du dernier type de mute (global ou pattern) : [FUNC] + [TRK] ouvre celui-là d'abord ; QUICK MUTE agit sur ce type aussi.
- Song : ROW MUTE par ligne (section 20).
- [OPTION] CC 94 = mute de piste ; CC 110 = pattern mute [p.109, p.113].

---

## 22. KEYBOARD mode et KEYBOARD SETUP [p.22, p.25, p.26, p.115]

- [KEYBOARD] : on/off. Joue le son de la piste active en hauteurs sur les [TRIG] ; [TRK] + [TRIG] change de piste.
- **CHROMATIC, FOLD OFF** : les [TRIG] allumés dessinent une octave de piano ; seules les touches allumées jouent ; [TRIG 9] à [TRIG 16] = une octave (touches blanches en bas, noires en haut ; dans le standard Elektron TRIG 2, 3, 5, 6, 7 = noires, 1, 4, 8 éteintes [NC]).
- **Étendue** : C0 à G10 (un peu plus de 10 octaves) ; transposition 4 octaves en haut, 5 en bas depuis l'octave du milieu.
- **Octave** : [KEYBOARD] + [UP]/[DOWN] ; avec U/D KEY MODE = KB OCT, [UP]/[DOWN] seuls en KEYBOARD mode.
- L'état visible (portion du clavier) n'est pas rangé par pattern, il reste comme laissé.
- Enregistrable en LIVE REC (NOTE écrite) et en STEP REC (section 7.3).
- **KEYBOARD SETUP** : [FUNC] + [KEYBOARD]. Écran : « T1 » (piste), « flèches : OCTAVE +/- », dessin des touches jouées. [UP]/[DOWN] = octave. [NO] ferme. Réglages **rangés dans le pattern actif**, par piste (« sets the track's scale »).

| Potard | Nom | Valeurs |
|---|---|---|
| E | KB SCALE | 36 gammes (liste ci-dessous) ; affiché abrégé, ex. « WHTN » |
| F | ROOT NOTE | fondamentale de la gamme (12 notes) |
| G | (vide) | |
| H | KB FOLD | ON/OFF |

- **KB FOLD ON** : toutes les [TRIG] jouent une note de la gamme. [TRIG 9] = la plus grave (octave, fondamentale et gamme choisies), on monte dans la gamme jusqu'à [TRIG 16], puis on continue sur [TRIG 1-8]. Si la gamme a **moins de 8 notes par octave**, les touches « en trop » de la rangée du bas jouent les mêmes notes que les premières de la rangée du haut, qui commence une octave plus haut. Exemple gamme par tons (6 notes) : [TRIG 15-16] = [TRIG 1-2] ; [TRIG 1] et [TRIG 15] = une octave au-dessus de [TRIG 9] ; [TRIG 7] = deux octaves au-dessus. **Touches bleues** = notes à une ou plusieurs octaves les unes des autres (figure : 1, 7, 9, 15 en bleu).
- **Gammes (annexe D, 36)** : CHROMATIC, IONIAN (MAJOR), DORIAN, PHRYGIAN, LYDIAN, MIXOLYDIAN, AEOLIAN (MINOR), LOCRIAN, PENTATONIC MINOR, PENTATONIC MAJOR, MELODIC MINOR, HARMONIC MINOR, WHOLE TONE, BLUES, COMBO MINOR, PERSIAN, IWATO, IN-SEN, HIRAJOSHI, PELOG, PHRYGIAN DOMINANT, WHOLE-HALF DIMINISHED, HALF-WHOLE DIMINISHED, SPANISH, MAJOR LOCRIAN, SUPER LOCRIAN, DORIAN b2, LYDIAN AUGMENTED, LYDIAN DOMINANT, DOUBLE HARMONIC MAJOR, LYDIAN #2 #6, ULTRAPHRYGIAN, HUNGARIAN MINOR, ORIENTAL, IONIAN #2 #5, LOCRIAN bb3 bb7. (Les intervalles de chaque gamme ne sont pas dans le manuel [NC].)
- **NOTE PARAM** (section 27) : potard A de TRIG 1 en chromatique ou en gamme.
- [OPTION] Clavier MIDI externe : jouer le son de la piste active en hauteurs même hors KEYBOARD mode (canal AUTO) ; notes MIDI 0-15 = pistes 1-16, 16-84 = hauteurs de la piste active [p.25].

---

## 23. TRIG MODES [p.27, p.28]

- [FUNC] + [UP]/[DOWN] (écran principal) : fenêtre « TRIG MODE » avec 5 lignes et icônes ; le mode vaut pour **toutes les pistes** ; l'icône du mode est dans l'en-tête de l'écran [p.18]. Tout ce qui est joué ainsi s'enregistre en LIVE REC.

| Mode | [TRIG 1-16] font |
|---|---|
| TRACKS (défaut) | jouent les pistes 1 à 16 |
| VELOCITIES | jouent la piste active à 16 vélocités : TRIG n = 8 x n (8, 16, 24 ... 120), TRIG 16 = 127 |
| RETRIGS | jouent la piste active avec 16 vitesses de retrig : 1/1, 1/2, 1/3, 1/4, 1/5, 1/6, 1/8, 1/12, 1/16, 1/20, 1/24, 1/32, 1/40, 1/48, 1/64, 1/80 (pas de 1/10 ici, contrairement à RATE) |
| SLICES | jouent les tranches des machines GRID et SLICE ; [TRIG] bleu = une tranche ; [PAGE] = groupe de 16 suivant ; autre machine : [TRIG 1] joue tout le sample [HORS probable : découpe de sample] |
| PRESET POOL | jouent 16 emplacements du pool ; page 1 = 1-16 ; [PAGE] + [RIGHT] = 17-32, etc. ; [PAGE] + [LEFT]/[RIGHT] choisit le groupe |

- RETRIGS, SLICES, PRESET POOL : pistes audio seulement.
- En STEP REC, en SLICES ou PRESET POOL, poser = [FUNC] + [TRIG].

---

## 24. Tempo, swing, nudge, tap, métronome [p.22, p.23, p.89]

**Menu TEMPO** ([TEMPO]) ; écran « TEMPO | SWING » :

| Potard | Nom | Valeurs |
|---|---|---|
| A | BPM | entier ; LEVEL/DATA aussi ; presser + tourner = 4 BPM d'un coup ; plage 30 à 300 [NC] ; affiché « (PRJ) 147.0 » |
| B | FINE | décimales du BPM (0,1) |
| C | (« --- ») | rien d'affiché [NC] |
| D | SWING | 50 % (défaut, égal) puis 51 à 80 % ; rangé dans le pattern, par ligne dans un song |
| E | METRO | métronome on/off (aussi [TEMPO] + [YES]) |
| F | SIG. | signature du métronome (note et mesure), ex. « 4/4 » ; valeurs [NC] |
| G | PREROLL | mesures de décompte avant le départ, seulement en LIVE REC ; « OFF » ; valeurs [NC] |
| H | VOL | volume du clic, ex. 64 (0 à 127 [NC]) |

- **PROJECT ou PATTERN tempo** : un tempo pour tout le projet ou un par pattern ; tenir [FUNC] et tourner le potard E pour basculer [p.22] (« (PRJ) » à l'écran).
- **Tempo préparé** : en mode PROJECT, tenir [FUNC] en tournant A ne change le tempo qu'au relâcher de [FUNC] ; « PREP. » clignote en bas à gauche.
- **Nudge** : sur l'écran principal, en lecture, tenir [LEFT] ou [RIGHT] = tempo -10 % ou +10 % le temps de l'appui ; relâcher = tempo d'origine. Pas besoin d'être dans le menu TEMPO.
- **Tap tempo** : [FUNC] tenue + [TEMPO] tapé en rythme ; la moyenne se calcule après **4 tapes** et continue de se mettre à jour. [HORS] note C0 sur le canal FX CONTROL.
- [HORS] Horloge MIDI, transport MIDI, DIN sync.

---

## 25. CONTROL ALL, SETUP KIT [p.19, p.37]

- **Geste** : tenir [TRK] et changer un paramètre = le changement s'applique à ce paramètre **sur toutes les pistes audio du pattern** (celles choisies dans la config).
- **Annuler** : [NO] **avant** de relâcher [TRK] = annule les changements.
- Le manuel ne dit pas si les pistes prennent la même valeur ou bougent du même écart [NC].
- **CONTROL ALL CONFIG** : [FUNC] + [FLTR] (SETUP) > KIT > CONTROL ALL CONFIG ; écran « SELECT AFFECTED TRACKS: » avec 16 cases (pleines = choisies) ; [TRIG] = choisir. La piste active est **toujours** affectée. Pas de pistes MIDI. Rangé dans le kit.
- **TRACK SWAP** (SETUP > KIT) : tenir les [TRIG] de deux pistes jusqu'à « TRACKS X AND X SWAPPED » : échange réglages, presets et **séquences**. Écran « HOLD 2 TRACKS TO SWAP THEM », noms des deux pistes, barre de progression.
- (COMPRESSOR ROUTING dans le même menu : hors séquenceur.)
- Le Control All s'annule aussi par TEMPORARY RELOAD [p.50].

---

## 26. Édition des paramètres (général) [p.18, p.19, p.53]

- Presser un potard en tournant = grands pas.
- Potard + [NO] = valeur par défaut du paramètre.
- [PARAMETER] + [PLAY] = toute la page aux valeurs par défaut.
- Tenir [PARAMETER] = voir les valeurs de toute la page.
- [PARAMETER] + [YES] = page au hasard (nouveau tirage à chaque fois), pistes audio.
- [PARAMETER] + [NO] = page à son dernier état sauvé.
- [TRK] + [TRIG 1-16] + [NO] = recharger le preset de la piste.
- [FUNC] en tournant = saut de valeur (NOTE par octave, delay par divisions du BPM).
- [PARAMETER] rappuyé ou [UP]/[DOWN] = sous-pages ; REMEMBER SUBPAGE garde la dernière sous-page.
- Touches [PARAMETER] : la page affichée en rouge/orange, les autres éteintes ; groupe radio (une seule).
- Les [TRIG] de choix de piste : groupe radio (une seule piste active).

---

## 27. PERSONALIZE (réglages qui touchent le séquenceur) [p.82]

| Réglage | Valeurs | Effet |
|---|---|---|
| REMEMBER SUBPAGE | ON/OFF | rouvre la dernière sous-page d'une touche [PARAMETER] |
| U/D KEY MODE | KB OCT / NAV | KB OCT : [UP]/[DOWN] changent d'octave en KEYBOARD mode, sinon pages ; NAV : toujours pages |
| PAGE AUTOCOPY | ON/OFF | recopie les trigs en allongeant le pattern |
| NOTE PARAM | CHRO / SCALE | CHRO : potard A chromatique, pressé = gamme ; SCALE : l'inverse |
| LIVE REC OVERDUB | coché/non | en LIVE REC, ajouter notes et verrous aux trigs existants au lieu de les remplacer |
| PARAM LIVE REC | tous les pas / pas avec trig | où s'écrivent les verrous enregistrés en LIVE REC |
| TRK SELECT | NORMAL / SILENT / MANUAL / INVERTED | ce que fait un [TRIG] hors enregistrement : NORMAL = choisit et joue ; SILENT = choisit sans jouer ; MANUAL = joue sans choisir ; INVERTED = choisit sans jouer, et [TRK] + [TRIG] joue sans choisir. En NORMAL, SILENT, MANUAL : [TRK] + [TRIG] choisit sans jouer |

---

## 28. Écran : ce qui s'affiche pour le séquenceur

- **Écran principal** [p.18] : banque/pattern (« A01 »), nom du pattern, icône TRIG MODE, tempo (icône + « 147.0 »), 8 paramètres en 2 x 4 (dessins + nom), indicateur de sous-page (points à droite), niveau de la piste (LEV, barre), numéro de piste, type (SMP / MID).
- **Pattern en attente** : sa position clignote en haut à gauche jusqu'au départ.
- **SONG mode** : en-tête « S01 02/04:VERSE A01 », barre de progression de la ligne.
- **PERFORM KIT** : « P » clignotant après le nom.
- **P-lock** : paramètre verrouillé en **graphisme inversé** avec sa valeur.
- **Fenêtres** : MICRO TIMING (règle + valeur « +1/384 »), TRIG MODE (liste à icônes), QUANTIZE (TRACK n / PATTERN, % et lettres de potards), SEQUENCER PAGE SETUP (colonnes PATTERN ou TRK.n + PATTERN, « Fn+Y: ... »), SEQUENCER euclidien (8 blocs), KEYBOARD SETUP (dessin du clavier), CONTROL ALL CONFIG (16 cases), TRACK SWAP, SONG EDIT (tableau 7 colonnes), CHAIN (créateur), TEMPO (BPM, FINE, SWING, METRO, SIG., PREROLL, VOL), MUTE (vue des 16 pistes : carré, trait, +, X).
- Les noms de potards indiquent parfois la lettre du potard entre parenthèses, ex. « (E) » [p.18].
- Écran OLED 128 x 64 [p.91].

---

## 29. Récapitulatif des couleurs LED

| Où | État | Couleur |
|---|---|---|
| [TRIG] | note trig | rouge |
| [TRIG] | lock trig | jaune |
| [TRIG] | trig avec verrou | clignote rouge ou jaune |
| [TRIG] | pas vide | éteint |
| [TRIG] | tête de lecture | lumière qui court sur les 16 pas |
| [TRIG] | piste active ([TRK] tenue) | rouge |
| [TRIG] | sélection de pattern : avec données / actif / vide | blanc / rouge / éteint |
| [TRIG] | sélection de pages (PAGE tenue) | [TRIG 1-8] allumés = pages existantes |
| [TRIG] | boucle de pages | [TRIG 9-16] verts = pages bouclées ; en haut clignote = position maîtresse ; en bas clignote = page qui joue |
| [TRIG] | STEP REC, pas actif | vert double clignotement (ou la lumière du trig s'il y en a un) |
| [TRIG] | euclidien, trigs générés | bleu |
| [TRIG] | GLOBAL MUTE : joue / muté / muté avec trigs | vert / éteint / clignote vert |
| [TRIG] | PATTERN MUTE : joue / muté / muté avec trigs | magenta / éteint / clignote magenta |
| [TRIG] | KEYBOARD : jouables / octaves (FOLD) | allumés en motif de piano / bleus |
| [TRIG] | TRIG MODE SLICES | bleu = tranche |
| [TRIG] | CONTROL ALL CONFIG | [NC] (cases pleines à l'écran) |
| [RECORD] | GRID REC / LIVE REC / STEP REC / euclidien actif | rouge fixe / rouge clignotant / rouge double clignotement / bleu |
| [PARAMETER] | page affichée / autres | rouge ou orange / éteint |
| [PARAMETER] | trig tenu : pages avec verrous | rouge |
| [PRESET/KIT] | PERFORM KIT | orange |
| <PATTERN PAGE> | pages du pattern / page éditée / page jouée | allumées / pleine / clignote |
| [PLAY], [STOP] | pendant la lecture | non dit par le manuel [NC : vert pour PLAY] |

---

## 30. Chapitre 17, combinaisons séquenceur (relevé complet, normalisé) [p.88 à p.90]

- **Copier/coller/effacer** : piste en GRID REC = [FUNC] + [RECORD]/[STOP]/[PLAY] ; trig en GRID REC = [TRIG] + [RECORD]/[STOP]/[PLAY] ; pattern = [FUNC] + [RECORD]/[STOP]/[PLAY] ; preset = [TRK] + [RECORD]/[STOP]/[PLAY] ; page en GRID REC = [PAGE] + [RECORD]/[STOP]/[PLAY].
- **Choix** : [TRK] + [TRIG 1-16] = piste ; [PTN] puis [LEFT]/[RIGHT] puis [TRIG 1-16] = banque/pattern.
- **Sauver/recharger** : [FUNC] + [NO] = recharger le pattern ; [FUNC] + [YES] = sauvegarde temporaire ; [FUNC] + [SETTINGS] = sauver le projet ; [TRIG] + [PRESET/KIT] (GRID REC) = son du trig en preset ; [TRIG] + [YES] = préécoute du trig ; [PARAMETER] + [NO] = recharger la page ; [PARAMETER] + [YES] = page au hasard ; [TRK] + [TRIG] + [NO] = recharger le preset.
- **Menus** : [FUNC] + [SONG] = SONG EDIT ; [FUNC] + [TRIG PARAMETERS] = QUANTIZE ; [FUNC] + [SRC] = MACHINE ; [FUNC] + [FLTR] = SETUP ; [FUNC] + [AMP] = SEQUENCER (euclidien) ; [FUNC] + [FX] = SEND FX ; [FUNC] + [MOD] = MIXER ; [FUNC] + [PAGE] = PAGE SETUP ; [FUNC] + [KEYBOARD] = KEYBOARD SETUP.
- **Réglages séquenceur** : [FUNC] + [TEMPO] = tap ; [LEFT]/[RIGHT] = nudge (lecture) ; [FUNC] + [LEFT]/[RIGHT] = décale tous les trigs d'un pas (GRID REC) ; [TRIG] tenu + [LEFT]/[RIGHT] = MICRO TIMING (GRID REC) ; [FUNC] + [UP]/[DOWN] dans PAGE SETUP = TRACK LENGTH par incréments musicaux ; [TEMPO] + [YES] = métronome.
- **Enregistrement et édition** : [RECORD] + [PLAY] = LIVE REC ; [RECORD] + [STOP] = STEP REC ; [RECORD] + double [PLAY] = quantification du LIVE REC on/off ; [PAGE] tenue + [LEFT]/[RIGHT] ou + [TRIG] allumé = page (GRID REC) ; [TRIG] + [PAGE] ou [TRK] puis potard = verrou sur tous les trigs de la page.
- **Mutes** : [FUNC] + [TRIG] = mute/démute une ou plusieurs pistes ; en MUTE mode, [FUNC] tenue + [TRIG] = préparer, action au relâcher.
- **Modes** : [FUNC] + [TRK] = GLOBAL MUTE ; [FUNC] + double [TRK] = PATTERN MUTE ; [KEYBOARD] = KEYBOARD mode ; [YES] + [PAGE] = FILL un cycle ([PAGE] à nouveau = arrêt) ; [PAGE] tenue hors GRID REC = FILL momentané ; [PAGE] + [YES] en relâchant [PAGE] d'abord = FILL verrouillé, [PAGE] = déverrouille.
- **Remise à zéro** : potard + [NO] = défaut ; [PARAMETER] + [PLAY] = page par défaut.
- **Préécoute** : [TRIG] + [YES] en GRID et STEP REC.
- **SONG** : [SONG] + [TRIG 1-16] ; [FUNC] + [SONG] ; [SONG] + [LEFT] = boucle de ligne ; [SONG] + [UP]/[DOWN] = tête une ligne plus haut/bas ; [SONG] deux fois = SONG EDIT ; dans SONG EDIT : [FUNC] + [RECORD] copie, [FUNC] + [STOP] colle, [FUNC] + [PLAY] remet la ligne, [FUNC] + [DOWN] ajoute, [FUNC] + [UP] supprime.

---

## 31. Hors portée (à retirer) et options

- [HORS] SAMPLING (menu, enregistrement, entrées IN L/R, USB audio), SAMPLES menu, édition et découpe de samples (SLICE EDITOR, création de tranches, LINEAR/RANDOM LOCKS de tranches), donc vraisemblablement le TRIG MODE SLICES et les machines GRID/SLICE.
- [HORS] Overbridge, USB CONFIG, transfert, sauvegardes +Drive, SYSEX.
- [HORS] Horloge MIDI, transport MIDI, DIN sync, Turbo MIDI.
- [HORS] Pistes MIDI (NOT2-4, CC) sauf décision contraire.
- [OPTION] WebMIDI (le site l'a déjà pour le Roto-Control) : program change = patterns, notes 0-15 = pistes, notes 16-84 = clavier, CC de mute, tap par note.
- À garder : tout le reste de ce document (séquenceur complet, songs, chaînes, mutes, clavier et gammes, euclidien, conditions, verrous, PERFORM KIT, tempo, métronome, Control All, track swap).

---

## 32. Incohérences et zones floues du manuel

1. **Numérotation** : la section des conditions est numérotée 10.7.3 au lieu de 10.8.3 [p.48].
2. **QUANTIZE** : 10.2.3 dit [FUNC] + [TRIG] ; 10.6 et le chap. 17 disent [FUNC] + [TRIG PARAMETERS] (retenir le second).
3. **Longueur par incréments musicaux** : 2/16 à 128/128 [p.47] contre 2/16 à 64/64 [p.89] (retenir 128, max de la DT2).
4. **Song, flèches** : « [SONG MODE] + [UP]/[DOWN] choisit la ligne où sauter ensuite » [p.51] contre « [SONG] + [UP]/[DOWN] monte/descend la tête d'une ligne » [p.90].
5. **Effacer un trig** : « tenir des trigs + [PLAY] efface leurs verrous » [p.49] contre « [TRIG] + [PLAY] efface le trig » [p.88].
6. **Copie de page** : GRID REC requis selon p.88, non dit en 10.8.5.
7. **Retrig en GRID REC** : « tenir le [TRIG] en allant sur TRIG PAGE 2 » [p.42] contre « [TRIG PARAMETERS] deux fois puis tenir les trigs » [p.45] (les deux mènent au même endroit).
8. **Euclidien** : trigs d'avant « cachés et inactifs » [p.44] contre « redistribués selon les réglages » [p.45].
9. **Verrou de page** : « [TRIG] + [PAGE] ou [TRK] » sans dire si on tient un trig ou non [p.47, p.89].
10. **Panneau, point 12** : texte de [PAGE] mélangé avec celui du copier de patterns [p.13].
11. **PAGE AUTOCOPY** : 10.7.1 présente la recopie comme automatique, 14.7.5 comme une option ON/OFF.
12. **Tempo** : « FUNC + potard E bascule PROJECT/PATTERN » alors que E est METRO sur l'écran du menu TEMPO [p.22].
13. **STEP REC STANDARD** : [TRIG] choisit le pas actif, et c'est [FUNC] + [TRIG n] qui pose un trig **sur la piste n** (geste peu intuitif mais écrit tel quel) [p.43].
14. **LIVE REC, STOP** : « arrête l'enregistrement et la lecture » (donc sort du LIVE REC) [p.43].

---

## 33. Écarts avec ce que la MM-RYTM a déjà (specs D2, D3a, D3b)

À trancher dans le cahier de refonte, puisque Mika demande « tout basé sur la Digitakt » :

| Sujet | MM-RYTM (spec) | Digitakt II [M2] |
|---|---|---|
| Disposition TRIG 1 | A NOTE, B VEL, C LEN, D PROB, E COND, F μTIME, G LFO.T, H vide (D2) | A NOTE, B VEL, C LEN, D PROB, E LFO.T, F FLT.T, G FILL, H COND ; μTIME = fenêtre [TRIG] + [LEFT]/[RIGHT] |
| Disposition TRIG 2 | A RTRG, B RATE, C VFAD, D RLEN (D2) | A RTRG, B VFAD, C LEN, D RATE, G PTIM, H PORT |
| VFAD | -64 à +63 (D2) | -64 à 64 |
| FILL dans COND | FILL, !FILL dans la liste COND (D2) | paramètre FILL séparé ON/OFF ; pas dans COND |
| Geste FILL | tenir YES plus de 250 ms (D2) | tenir PAGE (hors GRID REC) ; YES + PAGE = un cycle ; latch PAGE + YES |
| Banques | FUNC + PTN, pas 1 à 8 = banques A-H (D3a) | FUNC + PTN, [TRIG 9-16] = banques ; ou PTN puis LEFT/RIGHT |
| LIVE REC, entrer | ● tenue + ▶, ou ● deux fois à la souris (D3b) | [RECORD] tenue + [PLAY] ; [RECORD] + double [PLAY] = quantification on/off |
| LIVE REC, sortir | ● une fois = tout s'éteint ; STOP garde LIVE REC (D3b) | [PLAY] = sort en gardant la lecture ; [RECORD] = passe en GRID REC ; [STOP] = arrête tout |
| LIVE REC, placement | toujours quantifié, sans μTIME (D3b) | quantification au choix ; sinon micro timing écrit, quantifiable après (menu QUANTIZE) |
| Pistes | 8 voix fixes (BD, SD, ...) | 16 pistes libres, n'importe quel son |
| Longueur | 16 pas (64 prévus en V.5.4) | 128 pas, 8 pages, par piste avec vitesse |
| NEI sur la piste 1 | faux (D2, correct) | faux s'il n'y a pas de trig conditionnel sur la voisine |
| PRE et PROB | une PROB évaluée compte comme résultat (D2, correct) | idem (exemple « 50 % = vrai » p.48) |
| COND gagne sur PROB | « PROB ne compte que si COND = NONE » (D2) | non dit : PROB et COND sont deux paramètres distincts sur la DT2 [NC] |
| Control All | toutes prennent la valeur de la voix choisie si le manuel ne dit rien (D3a) | manuel muet sur valeur commune ou écart ; config des pistes concernées (SETUP > KIT) |

---

## 34. Valeurs que le manuel ne donne pas (à fixer dans le cahier)

- VEL : 1 à 127, défaut 100 [NC].
- LEN (trig) : liste des valeurs entre 0.125 et 128 pas + INF [NC] ; défaut [NC] (1/16 probable).
- NOTE : plage de la DT2 (affichage absolu « C 5 (60) ») ; transposition relative ou absolue au verrou [NC].
- PTIM : 0 à 127 [NC].
- Micro timing : -23/384 à +23/384 [NC].
- Euclidien : plages de PL1, PL2, LEN, R01, R02, TRO [NC].
- PAGE SETUP : minimum de LENGTH (1 ou 2), plages de CHANGE et RESET (jusqu'à 1024 ?) [NC].
- QUANTIZE : 0 à 100 % [NC].
- Song : plage de ROW PLAY COUNT, liste des LABEL, forme du « tempo de song » [NC].
- Métronome : valeurs de SIG. et PREROLL [NC].
- BPM : 30 à 300 [NC].
- A:B : B de 2 à 8 [NC].
- Ordre exact de la liste COND au potard [NC] (le manuel liste PRE, !PRE, NEI, !NEI, 1ST, !1ST, LST, !LST, A:B, !A:B).
- Indication visuelle du FILL actif [NC].
- Couleurs de [PLAY] et [STOP] [NC].
