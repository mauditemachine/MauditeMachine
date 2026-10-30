# Inventaire DT2 : son, machines, pages de piste, FX, mixer (agent dt-sound)

Source : manuel Digitakt II (m2.txt / m2.pdf), chapitres 4, 5, 11, 12, plus les
annexes qu'ils renvoient (A machines, B MIDI CC, C destinations de modulation),
9.8 SETUP (reglages de piste et routage compresseur) et 14.6 AUDIO ROUTING.
Les dispositions des knobs (A B C D en haut, E F G H en bas) ont ete relevees
sur les captures d'ecran du PDF (pages 53 a 66 et 93 a 108), pas devinees.

Legende des colonnes :
- Knob : position sur la page (A B C D rangee du haut, E F G H rangee du bas,
  LEV = knob LEVEL/DATA).
- Plage : [M] = ecrit dans le manuel ; [E] = convention Elektron / DT1, NON
  ecrite dans le manuel DT2, a confirmer ; [?] = inconnu.
- Lock : OUI = p-lockable (tenir un trig + tourner) ; NON ; LOCK SEUL = n'existe
  que comme lock sur un trig (cadenas affiche hors trig tenu).
- MM : GARDER / ADAPTER / ECARTER-SAMPLING / ECARTER-MATERIEL (decision de
  perimetre selon la demande de Mika : pas de sampling, rien qui demande du
  materiel).

Regle generale de lock (10.8.1, 11) : tous les parametres des PARAMETER pages
(TRIG, SRC, FLTR, AMP, FX, MOD) sont p-lockables, sur pistes audio comme MIDI.
Exceptions ecrites : CHAN (MIDI) non lockable ; LEVEL de piste (LEVEL/DATA)
non lockable (le manuel le dit en opposition a AMP VOL qui l'est). Maximum 80
parametres differents lockes par pattern (un parametre compte 1 quel que soit
le nombre de trigs). Les pages SEND FX et MIXER ne sont pas des PARAMETER
pages : le manuel DT2 ne dit pas qu'elles sont lockables (voir 7.5).

---

## 1. Architecture du son (chap. 4)

16 voix audio stereo (une voix par piste, 16 pistes), 3 effets en send
(chorus, delay, reverb), 2 effets master (compresseur, master overdrive).

### 1.1 Chaine d'une voix audio (figure 4.1, relue sur la page 15 du PDF)

```
SRC MACHINE
  -> [BR (bit reduction) -> OVERDRIVE -> SRR]      (bloc "FX de piste")
  -> BASE-WIDTH FILTER (HP + LP en serie)
  -> FILTER MACHINE (module par FILTER ENVELOPE)
  -> AMP (module par AMP ENV)
  -> PAN
  -> AMP (TRK LEV = niveau de piste)
  -> TO MIXER
        + prise des sends CHO / DEL / REV APRES le TRK LEV (post-fader)
```

Routages variables dans cette chaine :
- ROUT (FX page) : SRR avant (PRE) ou apres (POST) la section filtre
  (fleche "SRR POST FILTER" de la figure).
- OD.RT (FX page) : overdrive avant (PRE) ou apres (POST) la filter machine.
- BW.RT (FLTR page 2) : base-width avant (Pre) ou apres (Post) la filter
  machine.
- Ordre par defaut lu sur la figure : BR, OVERDRIVE, SRR, puis BASE-WIDTH,
  puis FILTER MACHINE.

### 1.2 Effets (figure 4.2)

```
sends des pistes -> CHORUS -> TO MIXER
                    CHORUS -> DELAY SEND  -> DELAY
                    CHORUS -> REVERB SEND -> REVERB
sends des pistes -> DELAY  -> TO MIXER
                    DELAY  -> REVERB SEND -> REVERB
sends des pistes -> REVERB -> TO MIXER
```
Donc : chorus peut nourrir delay et reverb ; delay peut nourrir reverb ;
reverb ne renvoie rien.

### 1.3 Bus master

```
FROM AUDIO VOICES + CHORUS/DELAY/REVERB RETURNS (+ FROM INPUT L/R)
  -> MIXER
  -> PRE COMP : ce qui est route au compresseur -> COMPRESSOR
     POST COMP : ce qui n'est pas route au compresseur contourne le compresseur
  -> somme -> MASTER OVERDRIVE -> (+ FROM USB) -> OUTPUTS L/R
```
- ECARTER-SAMPLING : FROM INPUT L/R. ECARTER-MATERIEL : FROM USB.
- Le choix de ce qui passe par le compresseur se fait dans SETUP > KIT >
  COMPRESSOR ROUTING (voir 8.2).

---

## 2. Structure des donnees (chap. 5 et 9)

| Niveau | Contient | Note MM |
|---|---|---|
| +Drive | 128 projets, 1024 kits, 2048 presets (banques A-H x 256), banque de samples 20 Go | ADAPTER : la "+Drive" devient la banque de Mika + les sons synth existants + presets utilisateur |
| Projet | 128 patterns (8 banques A-H x 16), 16 songs, pool : 128 presets + 1016 slots samples (max 400 Mo), reglages generaux | GARDER la structure, sans limite memoire |
| Song | jusqu'a 99 lignes ; par ligne : pattern, repeat, longueur, tempo, mute | hors perimetre son (agent seq) |
| Pattern | 1 kit + donnees sequenceur (trigs, p-locks) des 16 pistes + reglages de la page TRIG + BPM, longueur, swing, signature | GARDER |
| Kit | 16 presets (un par piste) + LEVEL des pistes + VOL pattern + compresseur + master overdrive + routage compresseur + config Control All + reglages SEND FX | GARDER |
| Preset audio | 1 sample (lien) + pages SRC, FLTR, AMP, FX, MOD | GARDER (sample OU son synth) |
| Preset MIDI | pages SRC, FLTR, AMP, MOD (pas de FX) | ECARTER-MATERIEL avec la machine MIDI |
| Sample | 16 bits, 48 kHz, mono ou stereo ; 1016 slots = 8 banques A-H x 127 (slot 000 = OFF) | ADAPTER : liste des samples de Mika, affichage "A 1" |

Points importants :
- Les parametres de la page TRIG ne sont PAS dans le preset : ils sont dans
  le pattern (11 intro).
- Charger un preset ou un kit dans un pattern en fait une copie independante
  (plus de lien avec l'original).
- Preset lock (10.8.2) : changer de preset sur un pas ; seuls les presets du
  pool (128) sont lockables ; tenir un note trig + tourner LEVEL/DATA ouvre la
  liste du pool.
- Piste audio = toute piste dont la SRC machine n'est pas MIDI. Piste MIDI =
  SRC machine MIDI (FUNC + SRC > menu MACHINE > categorie SRC > MIDI).
- MIDI : plusieurs pistes peuvent partager un canal ; en cas de conflit, la
  piste de plus petit numero gagne.

---

## 3. Navigation des pages de piste (11.1, 3, 6)

| Touche | Pages piste audio | Pages piste MIDI | FUNC + touche |
|---|---|---|---|
| [TRIG PARAMETERS] | TRIG 1 (notes/conditions), TRIG 2 (retrig/portamento) | TRIG 1 (notes/accord), TRIG 2 (FILL/COND) | QUANTIZE |
| [SRC] | SRC 1 (params machine), SRC 2 (memes params + forme d'onde) | MIDI Source (1 page) | menu MACHINE (choix SRC / FLTR) |
| [FLTR] | FLTR 1 (filter machine), FLTR 2 (base-width, env delay) | CC Value 1-8, CC Select 1-8 | SETUP (KIT / TRACK) |
| [AMP] | AMP (1 page) | CC Value 9-16, CC Select 9-16 | SEQUENCER (euclidien, agent seq) |
| [FX] | FX (1 page) | aucune | SEND FX (Delay 1/3, Reverb 2/3, Chorus 3/3) |
| [MOD] | MOD 1, 2, 3 (LFO 1, 2, 3) | MOD 1, 2 (2 LFO) | MIXER (5 pages, 6 si DUAL) |

- Passer d'une sous-page a l'autre : [UP]/[DOWN] ou rappuyer sur la touche.
- Tenir une touche [PARAMETER] : affiche les valeurs de tous les parametres de
  la page.
- [PARAMETER] + [YES] : randomise la page (pistes audio), nouveau tirage a
  chaque appui. [PARAMETER] + [NO] : remet la page a son dernier etat sauve.
- [TRK] + [TRIG 1-16] + [NO] : recharge le preset de la piste a son dernier
  etat sauve.
- Knob presse + tourne : pas plus grands.
- Ecran (captures) : en-tete "A01" (pattern) + titre de page avec "(n/m)" ;
  colonne gauche = cartouche du type de piste ("SMP 1" audio, "MID 1" MIDI,
  "DEL"/"REV"/"CHO" inverses sur SEND FX, "CMP"/"MIX"/"FX"/"EXT MIX" sur les
  pages MIXER) + barre du knob LEVEL/DATA (LEV, ou VOL sur SEND FX/MIXER ;
  absente sur les pistes MIDI) ; points verticaux a droite = sous-page
  courante. Parametre vide = cadre pointille. Parametre lock-seul = cadenas.
  Parametre locke = graphisme inverse + valeur lockee affichee.
- MM : GARDER toute cette navigation.

---

## 4. Pages de piste audio (chap. 11)

### 4.1 TRIG page 1 (11.2) : "Trig Parameters (1/2)"

Disposition : A NOTE, B VEL, C LEN, D PROB / E LFO.T, F FLT.T, G FILL, H COND.
Parametres sauves avec le pattern (pas avec le preset). Ce sont les valeurs
par defaut des trigs ; chaque trig peut les locker.

| Knob | Param | Nom long | Plage / valeurs | Sens | Lock | MM |
|---|---|---|---|---|---|---|
| A | NOTE | Trig Note | note absolue, affichee "C 5 (60)" ; plage [E] notes MIDI 0-127 | hauteur du trig ; en LIVE REC + KEYBOARD, la touche jouee remplace la valeur ; presser + tourner = seulement les notes de la gamme KB SCALE (comportement reglable : PERSONALIZE > NOTE PARAM) | OUI | GARDER |
| B | VEL | Trig Velocity | [E] 1-127 (DT : defaut 100) | velocite des trigs | OUI | GARDER |
| C | LEN | Trig Length | [E] 0.125 a 128 pas, puis INF | duree du note trig (note off) ; en LIVE REC la duree d'appui remplace la valeur | OUI | GARDER |
| D | PROB | Trig Probability | [M] 0-100 %, defaut 100 % | probabilite que les trigs jouent, re-tiree a chaque passage | OUI (ecrit) | GARDER |
| E | LFO.T | LFO Trig | ON/OFF | le trig relance (ou pas) les LFO (selon leur MODE) | OUI | GARDER |
| F | FLT.T | Filter Trig | ON/OFF | le trig declenche (ou pas) l'enveloppe filtre | OUI | GARDER |
| G | FILL | Fill condition | [M] ON = joue quand FILL est actif ; OFF = joue quand FILL n'est pas actif ; (rien = sans condition) | condition FILL separee de COND | LOCK SEUL | GARDER |
| H | COND | Trig Condition | [M] PRE, !PRE, NEI, !NEI, 1ST, !1ST, LST, !LST, A:B, !A:B ; A:B [E] B 2-8, 1 <= A <= B | regle logique par trig (voir 4.1.1) | LOCK SEUL | GARDER |

4.1.1 Conditions (10.7.3), le "!" note la barre de negation du manuel :
- PRE : vrai si la derniere condition evaluee sur la meme piste etait vraie
  (PRE et !PRE eux-memes sont ignores dans cette evaluation).
- !PRE : l'inverse.
- NEI : vrai si la derniere condition evaluee sur la piste voisine (piste
  n-1 ; ex. la 3 pour la 4) etait vraie ; faux s'il n'y a aucun trig
  conditionnel sur la voisine. !NEI : l'inverse.
- 1ST : joue au premier passage du pattern ; !1ST : jamais au premier.
- LST : joue au dernier passage avant changement de pattern ; !LST : l'inverse.
- A:B : joue au A-ieme passage sur un cycle de B (1:2 = 1, 3, 5... ; 2:4 =
  2, 6, 10... ; 4:7 = 4, 11, 18...). Compte en passages de piste si la piste
  est plus courte que le pattern. !A:B : l'inverse.
- La probabilite (PROB) compte comme une condition evaluee pour PRE/NEI
  (exemples du manuel : "Trig 1, 50% = True > Trig 2, PRE...").
- FILL mode : [YES]+[PAGE] = un cycle ; tenir [PAGE] pendant la lecture =
  tant que tenu ; [PAGE]+[YES] relacher PAGE d'abord = verrouille.

### 4.2 TRIG page 2 (11.3) : retrigs et portamento

Disposition : A RTRG, B VFAD, C LEN, D RATE / E vide, F vide, G PTIM, H PORT.
En GRID REC, appuyer 2 fois sur [TRIG PARAMETERS] = page RETRIG ; tenir un ou
plusieurs trigs et regler = retrig locks. Retrig : pistes audio seulement.
Reglages stockes dans le pattern.

| Knob | Param | Plage / valeurs | Sens | Lock | MM |
|---|---|---|---|---|---|
| A | RTRG | ON/OFF | active le retrig | OUI (c'est le "retrig lock" par pas) | GARDER |
| B | VFAD | [M] -64 a 64 | courbe de velocite du retrig : -64 fondu complet vers 0 sur LEN, -32 vers la moitie, 0 plat, 32 monte vers la moitie, 64 monte jusqu'a pleine velocite ; depend aussi de VEL | OUI | GARDER |
| C | LEN | [M] 0.125 a INF (1/16 = un pas) | duree de l'enveloppe de velocite du retrig (bornes de la courbe) | OUI | GARDER |
| D | RATE | [M] 1/1, 1/2, 1/3, 1/4, 1/5, 1/6, 1/8, 1/10, 1/12, 1/16, 1/20, 1/24, 1/32, 1/40, 1/48, 1/64, 1/80 | vitesse du retrig ; 1/16 = un trig par pas, 1/32 = deux ; triolets = 1/12 ou 1/24 | OUI | GARDER |
| G | PTIM | [E] 0-127 | temps de portamento | OUI | GARDER |
| H | PORT | ON/OFF | portamento on/off (pistes audio seulement) ; reglages fins dans SETUP > TRACK > PORTAMENTO (8.3) | OUI | GARDER |

### 4.3 SRC page (11.4, annexe A.2)

Le choix de machine : [FUNC]+[SRC] > menu MACHINE > [LEFT]/[RIGHT] categorie
(SRC ou FLTR) > [UP]/[DOWN] machine > [YES]. Toute machine SRC sur toute
piste. SRC page 2 = memes parametres avec une vue graphique (forme d'onde,
reperes STRT/LEN/LOOP ou slices). Tenir [SRC] = nom du sample charge.

Constante sur toutes les machines SRC audio : A TUNE (sauf Repitch), B PLAY,
C TOUJOURS VIDE, D SAMP, H LEV ; E, F, G = specifiques a la machine (l'annexe
B les nomme "Data entry knob E/F/G (machine dependent)").

Parametres communs :

| Param | Plage / valeurs | Sens | Lock | MM |
|---|---|---|---|---|
| TUNE | [M] +/- 5 octaves (bipolaire, 0 = hauteur d'origine), resolution plus fine que le demi-ton | FUNC + tourner = saute par octaves ; presser + tourner = saute par demi-tons | OUI | GARDER |
| PLAY | [M] FORWARD, REVERSE, FORWARD LOOP, REVERSE LOOP | mode de lecture ; en LOOP, duree de boucle bornee par LEN de la page TRIG et par HOLD/DEC de l'AMP ; FWD LOOP part de STRT et boucle entre LOOP et STRT+LEN ; REV LOOP part de LEN, recule jusqu'a LOOP puis boucle | OUI | GARDER |
| SAMP | [M] OFF + jusqu'a 1016 samples du pool ; affiche banque + slot ("A 1") ; liste avec onglets A-H et "000 OFF" | choix du sample ; "sample lock" possible par pas ; tourner D ouvre la liste, [TRIG] de la piste = preecoute, [YES] choisit, [NO] sort | OUI (sample locks, ecrit) | ADAPTER : liste = banque Mika (+ sons synth si machine dediee) ; le sample doit etre dans le pool pour etre locke (sur DT2) |
| LEV | [E] 0-127 | niveau du sample (avant la chaine) | OUI | GARDER |

#### 4.3.1 ONESHOT (A.2.1) : machine par defaut

Disposition : A TUNE, B PLAY, C vide, D SAMP / E STRT, F LEN, G LOOP, H LEV.

| Knob | Param | Plage | Sens | Lock | MM |
|---|---|---|---|---|---|
| E | STRT | [?] (DT1 : 0-127 fractionnaire) | point de depart de lecture | OUI | GARDER |
| F | LEN | [?] | longueur lue ; STRT + LEN = point de fin | OUI | GARDER |
| G | LOOP | [?] | point de retour de boucle (FWD LOOP : boucle entre fin de LEN et LOOP ; REV LOOP : demarre a LEN, recule a LOOP, puis boucle) | OUI | GARDER |

#### 4.3.2 WERP (A.2.2) : time-stretch par segments (warp)

Disposition : A TUNE, B PLAY, C vide, D SAMP / E SEG, F MODE, G BARS, H LEV.
Le sample est coupe en petits segments joues a la suite, cales sur le tempo.

| Knob | Param | Plage | Sens | Lock | MM |
|---|---|---|---|---|---|
| E | SEG | [?] affiche en division de note (ex. "1/16") | taille des segments : plus grand = segments plus longs et moins nombreux | OUI | GARDER si boucles dans la banque, sinon ECARTER (pas de sampling requis) |
| F | MODE | [M] FORWARD, REVERSE, FORWARD LOOP, REVERSE LOOP | lecture de chaque segment (REV LOOP / FWD LOOP : boucle jusqu'au segment suivant) | OUI | idem |
| G | BARS | [?] nombre de mesures (ex. "4") | duree totale du sample en mesures, relative au BPM | OUI | idem |

#### 4.3.3 STRETCH (A.2.3) : time-stretch granulaire

Disposition : A TUNE, B PLAY, C vide, D SAMP / E STRT, F LEN, G BARS, H LEV.
Decoupe en grains minuscules avec fondus entre eux, cale sur le tempo.
E STRT, F LEN : comme Oneshot. G BARS : duree du sample en mesures (BPM).
Tout lockable. MM : GARDER si boucles.

#### 4.3.4 REPITCH (A.2.4) : calage tempo par changement de vitesse

Disposition : A VIDE (pas de TUNE), B PLAY, C vide, D SAMP / E STRT, F LEN,
G BARS, H LEV. La hauteur suit le rapport de tempo (repitch automatique).
Tout lockable. MM : GARDER si boucles.

#### 4.3.5 SLICE (A.2.5) : slices editables

Disposition : A TUNE, B PLAY, C vide, D SAMP / E SLICE, F LEN, G vide, H LEV.
En-tete "Y:Slice Menu" ([YES] sur la page SRC ouvre le SLICE menu).

| Knob | Param | Plage | Sens | Lock | MM |
|---|---|---|---|---|---|
| E | SLICE | [M] numero de slice ou NOTE | slice jouee ; NOTE = la note (TRIG en KEYBOARD ou MIDI in) choisit la slice, a partir de C1 en montant, avec bouclage apres la derniere | OUI | GARDER le parametre |
| F | LEN | [M] nombre de slices | nombre de slices jouees d'affilee (SLICE 2 + LEN 3 = du debut de la 2 a la fin de la 4) | OUI | GARDER |

SLICE menu :
- EDIT SLICE POINTS : editeur (start, loop, end par slice ; liens entre
  slices voisines via knob A ; E start, H end, D loop ; FUNC = zero crossing ;
  FUNC+G deplace start et end ; F zoom, G position ; FUNC+RIGHT coupe en 2,
  FUNC+LEFT supprime ; FUNC+YES preecoute). Points sauves dans le preset.
  MM : ECARTER-SAMPLING (edition de sample).
- CREATE SLICE GRID : grille reguliere, nombre via knob E (FUNC+E : 2, 4, 8,
  16, 32, 64), detection de transitoires via knob H. MM : ADAPTER (slices
  pre-calculees hors ligne pour la banque, ou remplacer par GRID).
- CREATE LINEAR LOCKS / CREATE RANDOM LOCKS : pose des locks SLICE sur les
  trigs existants (lineaire depuis 1, ou aleatoire). MM : GARDER (operation
  sequenceur).

#### 4.3.6 GRID (A.2.6) : slices regulieres automatiques

Disposition : A TUNE, B PLAY, C vide, D SAMP / E SLICE, F LEN, G GRID, H LEV.

| Knob | Param | Plage | Sens | Lock | MM |
|---|---|---|---|---|---|
| E | SLICE | [M] numero ou NOTE (icone clavier = NOTE) | slice jouee ; NOTE : a partir de C1, bouclage | OUI | GARDER |
| F | LEN | [M] nombre de slices | slices jouees d'affilee | OUI | GARDER |
| G | GRID | [?] nombre de slices | nombre de slices egales sur toute la longueur | OUI | GARDER |

[YES] sur la page SRC : menu ALLOCATE SLICE > CREATE LINEAR LOCKS / CREATE
RANDOM LOCKS (aleatoire re-tire a chaque [YES]). MM : GARDER.

#### 4.3.7 Machine MIDI : voir section 6. MM : ECARTER-MATERIEL.

#### 4.3.8 Note MM (hors manuel)

Les sons synth existants de la MM-RYTM n'existent pas sur le DT2. Pour les
placer "comme le DT2", le cadre naturel est une machine SRC supplementaire qui
respecte la constante DT2 (A TUNE, B PLAY ou mode, C vide, D choix du son,
H LEV, E F G specifiques). A trancher dans la spec.

### 4.4 FLTR page 1 (11.5, annexe A.3) : filter machines

Toutes les filter machines partagent la rangee du haut : A ATK, B DEC, C SUS,
D REL (enveloppe filtre ADSR, avec delai DEL en page 2), et E FREQ, H ENV.
F et G dependent de la machine (annexe B : "Data entry knob F/G (machine
dependent)"). Tout est lockable et modulable par LFO. MM : GARDER tout.
Raccourci : FUNC + tourner A sur FLTR 1 = reglage direct de DEL (env delay).

| Param commun | Plage | Sens |
|---|---|---|
| A ATK | [E] 0-127 | attaque de l'enveloppe filtre |
| B DEC | [E] 0-127 | decroissance |
| C SUS | [E] 0-127 | niveau de maintien |
| D REL | [E] 0-127 | relachement |
| E FREQ | [E] 0-127 | coupure (frequence centrale pour l'EQ) |
| H ENV | [M] bipolaire (+ et -) ; [E] -64 a +63 | profondeur de l'enveloppe sur la coupure |

| Machine | F | G | Description |
|---|---|---|---|
| MULTI-MODE (A.3.1) | RESO (resonance ; nom RESO/GAIN dans le texte) | TYPE : morphing continu LP -> BP -> HP | filtre multimode |
| LOWPASS 4 (A.3.2) | RESO | vide | passe-bas 4 poles, 24 dB/oct |
| EQ (A.3.3) | GAIN (boost/cut autour de FREQ) | Q (largeur de bande : Q haut = etroit) | EQ parametrique ; enveloppe appelee "EQ envelope" |
| COMB- (A.3.4) | FDBK (gain de feedback) | LPF (passe-bas dans la boucle de feedback) | peigne a feedback negatif, son creux, tube ; FREQ = frequences resonantes |
| COMB+ (A.3.5) | FDBK (attention, FDBK haut = tres fort) | LPF | peigne a feedback positif, son de corde |
| LEGACY (A.3.5 bis) | RESO | TYPE : LP ou HP, 2 poles 12 dB/oct | inspire du filtre du DT1 |

Enveloppe filtre (figure A.3.1) : Note On -> Env. Delay -> Attack -> Decay ->
Sustain (tant que la note tient) -> Release au Note Off.

### 4.5 FLTR page 2 (11.6) : "Filter (2/2)"

Disposition : A DEL, B vide, C vide, D KEY.T / E BASE, F WDTH, G BW.RT, H RSET.

| Knob | Param | Plage | Sens | Lock | MM |
|---|---|---|---|---|---|
| A | DEL | [E] 0-127 | delai avant l'attaque de l'enveloppe filtre | OUI | GARDER |
| D | KEY.T | affiche en % (ex. "15%") ; [?] bornes | suivi de clavier : plus haut = le filtre s'ouvre plus sur les notes aigues | OUI | GARDER |
| E | BASE | [E] 0-127 | frequence basse du filtre base-width (le HP) | OUI | GARDER |
| F | WDTH | [E] 0-127 | largeur au-dessus de BASE (le LP) ; BASE 0 = passe-bas regle par WIDTH ; WIDTH 127 = passe-haut regle par BASE ; BASE 0 + WIDTH 127 = neutre | OUI | GARDER |
| G | BW.RT | PRE FLTR / POST FLTR | base-width avant ou apres la filter machine | OUI | GARDER |
| H | RSET | ON (defaut) / OFF | ON : l'enveloppe filtre repart a chaque trig ; OFF : pas de remise a zero | OUI | GARDER |

### 4.6 AMP page (11.7) : "Amplitude"

Disposition (capture en mode ADSR) : A ATK, B DEC, C SUS, D REL / E RSET,
F MODE, G PAN, H VOL. En mode AHD, HOLD remplace SUS/REL (le manuel ne montre
pas la disposition AHD ; l'annexe B donne 5 CC distincts ATK, HOLD, DEC, SUS,
REL).

| Knob | Param | Plage | Sens | Lock | MM |
|---|---|---|---|---|---|
| A | ATK | [E] 0-127 | attaque | OUI | GARDER |
| (AHD) | HOLD | [M] 0-126 fixe, ou NOTE | 0-126 : duree de hold fixe, ignore les note off (LEN, relache de touche) ; NOTE : hold = entre note on et note off. Seulement en mode AHD | OUI | GARDER |
| B | DEC | [E] 0-127 (127 = infini, implicite dans le texte "si DEC < 127") | decroissance | OUI | GARDER |
| C | SUS | [E] 0-127 | sustain, seulement en ADSR | OUI | GARDER |
| D | REL | [E] 0-127 | release, seulement en ADSR | OUI | GARDER |
| E | RSET | ON (defaut) / OFF | remise a zero de l'enveloppe a chaque trig | OUI | GARDER |
| F | MODE | AHD / ADSR | type d'enveloppe | OUI | GARDER |
| G | PAN | [E] L64 a R63 (bipolaire) | position stereo | OUI | GARDER |
| H | VOL | [E] 0-127 | volume de l'ampli ; contrairement au LEVEL de piste, VOL est lockable | OUI (ecrit) | GARDER |

Figures 11.7 : AHD + HOLD fixe = la courbe ignore le note off ; AHD + HOLD
NOTE = hold jusqu'au note off puis decay ; si note off avant la fin de
l'attaque, decay direct.

### 4.7 FX page (11.8) : "FX"

Disposition : A BR, B OVER, C SRR, D ROUT / E DEL, F REV, G CHR, H OD.RT.
Pistes MIDI : page vide.

| Knob | Param | Plage | Sens | Lock | MM |
|---|---|---|---|---|---|
| A | BR | [M] 16 bits a 1 bit | reduction de resolution | OUI | GARDER |
| B | OVER | [E] 0-127 | gain d'entree de l'overdrive numerique | OUI | GARDER |
| C | SRR | [E] 0-127 | reduction de frequence d'echantillonnage | OUI | GARDER |
| D | ROUT | PRE FLTR / POST FLTR | SRR avant ou apres la section filtre | OUI | GARDER |
| E | DEL | [E] 0-127 | envoi vers le delay | OUI | GARDER |
| F | REV | [E] 0-127 | envoi vers la reverb | OUI | GARDER |
| G | CHR | [E] 0-127 | envoi vers le chorus | OUI | GARDER |
| H | OD.RT | PRE FLTR / POST FLTR | overdrive avant ou apres la filter machine | OUI | GARDER |

### 4.8 MOD pages 1, 2, 3 (11.9 a 11.11) : 3 LFO

Disposition identique pour LFO 1, 2, 3 : A SPD, B MULT, C FADE, D DEST /
E WAVE, F SPH, G MODE, H DEP. (Pistes MIDI : 2 LFO seulement.) Le LFO module
les parametres des pages SRC, FLTR, AMP (et FX selon l'annexe C).

| Knob | Param | Plage | Sens | Lock | MM |
|---|---|---|---|---|---|
| A | SPD | [M] bipolaire (negatif = cycle a l'envers) ; [E] -64.00 a +63.00, haute resolution (CC MSB+LSB) | vitesse ; 8, 16, 32 = cale sur des temps droits | OUI | GARDER |
| B | MULT | [M] multiplie SPD : soit par le tempo (BPM, affiche "BPM 2"), soit par un tempo fixe de 120 BPM ; facteurs du tableau : 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1K, 2K | multiplicateur | OUI | GARDER |
| C | FADE | [M] -64 a 63 ; positif = fade-out, negatif = fade-in, 0 = rien | fondu de la modulation | OUI | GARDER |
| D | DEST | [M] liste annexe C (section 4.9) ; surligner = previsualiser, [YES] = valider ; FUNC + tourner = saute de section en section | destination | OUI | GARDER |
| E | WAVE | [M] TRI, SINE, SQR, SAW, EXP, RAMP, RND ; TRI/SINE/SQR/SAW/RND bipolaires, EXP/RAMP unipolaires | forme d'onde | OUI | GARDER |
| F | SPH | [M] 0 = debut du cycle, 64 = milieu ; [E] 0-127 ; un petit carre indique un depart au passage par zero ; si WAVE = RND, SPH devient SLEW (lissage des transitions) | phase de depart au declenchement | OUI | GARDER |
| G | MODE | [M] FRE, TRG, HLD, ONE, HLF | FRE : libre, jamais relance (defaut) ; TRG : relance a chaque trig ; HLD : tourne en fond, la sortie est figee a chaque trig jusqu'au suivant ; ONE : part au trig, va jusqu'a la fin de l'onde et s'arrete (enveloppe) ; HLF : part au trig, s'arrete au milieu de l'onde | OUI | GARDER |
| H | DEP | [M] bipolaire, centre 0.00 = aucune modulation ; [E] -64.00 a +63.00 haute resolution | profondeur et polarite | OUI | GARDER |

Relation SPD x MULT (tableau 11, en pas de sequenceur par cycle, MULT en
mode BPM) : pas_par_cycle = 2048 / (SPD x MULT). Exemples : SPD 16 x MULT 8 =
16 pas ; SPD 32 x MULT 64 = 1 pas ; SPD 1 x MULT 1 = 2048 pas ; SPD 64 x MULT
2K = 1/64 de pas. Le declenchement par trig depend aussi de LFO.T (TRIG 1).

### 4.9 Destinations de modulation (annexe C)

Pistes audio :
- META : None
- LFO1 : Speed, Multiplier, Fade In/Out, Waveform, Start Phase, Trig Mode,
  Depth (seulement pour LFO2 et LFO3)
- LFO2 : memes 7 parametres (seulement pour LFO3)
- SRC : Tune, Play Mode, Sample Slot, Data entry knob E, F, G (selon la
  machine), Level
- FILTER : parametres de la filter machine (selon la machine), Envelope
  Depth, Env. Delay, Attack Time, Decay Time, Sustain Level, Release Time,
  Env. Reset, Base, Width, Key Tracking
- AMP : Attack Time, Hold Time, Decay Time, Sustain Level, Release Time, Pan,
  Volume
- FX : Delay Send, Reverb Send, Chorus Send, Bit Reduction, SRR, SRR
  Routing, Overdrive

Pistes MIDI (ECARTER-MATERIEL) : META None ; LFO1 (7 params, pour LFO2) ;
SRC : Pitch Bend, Aftertouch, Mod Wheel, Breath Controller ; CC : CC1-16
Values.

Pas dans la liste : parametres TRIG, LEVEL de piste, SEND FX, MIXER, OD.RT,
BW.RT, AMP MODE, AMP RSET (seul Env. Reset du filtre y est).

---

## 5. Effets en send (chap. 12.1 a 12.4) : [FUNC] + [FX]

Reglages au niveau du pattern (dans le kit) : tous les presets du pattern
partagent les memes effets, chacun avec ses propres niveaux d'envoi (FX page
de la piste : DEL, REV, CHR). Le knob LEVEL/DATA regle le VOL de l'effet.
Sous-pages via [UP]/[DOWN]. MM : GARDER les 3 effets.

### 5.1 DELAY : "Delay (1/3)"

Disposition : A TIME, B X, C WID, D FDBK / E HPF, F LPF, G vide, H REV ;
LEVEL/DATA = VOL.

| Knob | Param | Plage | Sens |
|---|---|---|---|
| A | TIME | [M] relatif au BPM, en 1/128 de note ; tableau ci-dessous | temps de delay |
| B | X | [M] OFF / ON | ping-pong : OFF = position fixe reglee par WID ; ON = alterne G/D, WID = ampleur |
| C | WID | [M] bipolaire ; [E] -64 a +63 | largeur / position stereo du delay |
| D | FDBK | [?] (DT1 : 0-198, au-dela de 127 = auto-oscillation) ; [M] "infini et/ou qui gonfle" aux valeurs hautes | reinjection |
| E | HPF | [E] 0-127 | passe-haut du delay |
| F | LPF | [E] 0-127 | passe-bas du delay |
| H | REV | [E] 0-127 | envoi de la sortie delay vers la reverb |
| LEV | VOL | [E] 0-127 | volume de sortie du delay |

TIME (valeur -> division) [M] : 1 = 1/128 ; 2 = 1/64 ; 2.67 = 1/48 (1/32T) ;
3 = 1/64. ; 4 = 1/32 ; 5.33 = 1/24 (1/16T) ; 6 = 1/32. ; 8 = 1/16 ; 10.67 =
1/12 (1/8T) ; 12 = 1/16. ; 16 = 1/8 ; 21.33 = 1/6 (1/4T) ; 24 = 1/8. ; 32 =
1/4 ; 42.67 = 1/3 (1/2T) ; 48 = 1/4. ; 64 = 1/2 ; 96 = 1/2. ; 128 = 1.
(Le point apres la fraction = note pointee, T = triolet.)

### 5.2 REVERB : "Reverb (2/3)"

Disposition : A PRE, B DEC, C FREQ, D GAIN / E HPF, F LPF, G vide, H vide ;
LEVEL/DATA = VOL.

| Knob | Param | Plage | Sens |
|---|---|---|---|
| A | PRE | [E] 0-127 | pre-delay |
| B | DEC | [E] 0-127 | duree de decroissance (taille de la piece) |
| C | FREQ | [E] 0-127 | frequence du filtre en plateau dans le feedback |
| D | GAIN | [E] 0-127 ; max = aigus conserves | amortissement au-dessus de FREQ (plus bas = plus sourd) |
| E | HPF | [E] 0-127 | passe-haut sur l'entree de la reverb |
| F | LPF | [E] 0-127 | passe-bas sur l'entree de la reverb |
| LEV | VOL | [E] 0-127 | volume de sortie de la reverb |

### 5.3 CHORUS : "Chorus (3/3)" (nouveau sur DT2)

Disposition : A DPTH, B SPD, C HPF, D WDTH / E vide, F vide, G DEL, H REV ;
LEVEL/DATA = VOL.

| Knob | Param | Plage | Sens |
|---|---|---|---|
| A | DPTH | [E] 0-127 | profondeur du LFO du chorus |
| B | SPD | [E] 0-127 | vitesse du LFO du chorus |
| C | HPF | [E] 0-127 | passe-haut sur l'entree |
| D | WDTH | [E] 0-127 | largeur stereo |
| G | DEL | [E] 0-127 | envoi du chorus (wet) vers le delay |
| H | REV | [E] 0-127 | envoi du chorus (wet) vers la reverb |
| LEV | VOL | [E] 0-127 | volume de sortie du chorus |

---

## 6. Pistes MIDI (annexe A.2.7) : ECARTER-MATERIEL

Les pistes MIDI ne produisent aucun son : elles pilotent du materiel externe
via MIDI OUT ou USB. Hors perimetre selon la demande (rien qui demande du
materiel). Option future possible via Web MIDI (le site sait deja parler MIDI
avec le Roto-Control) ; inventaire complet pour memoire :

- TRIG 1 "Trig Parameters (1/2)" : A NOTE, B VEL, C LEN, D PROB / E LFO.T,
  F NOT2, G NOT3, H NOT4. NOT2-NOT4 : notes ajoutees en decalage de la note
  racine (accord jusqu'a 4 notes, transpose avec la racine, 0 = supprime).
  Pas de FLT.T.
- TRIG 2 "Trig Parameters (2/2)" : A-F vides, G FILL, H COND (lock seul).
  Pas de retrig ni de portamento sur MIDI.
- SRC "MIDI Source" : A CHAN (OFF, 1-16 ; OFF coupe la piste ; NON
  lockable), B BANK (CC 0 MSB), C SBNK (CC 32 LSB), D PROG (program change) /
  E PB (pitch bend), F AT (aftertouch), G MW (mod wheel), H BC (breath).
  Tous OFF par defaut ; FUNC + presser le knob = activer/desactiver.
- FLTR 1 "CC Value 1-8 (1/2)" : VAL1-VAL8 (OFF par defaut, FUNC + knob =
  activer ; FUNC + tenir un knob = renommer le parametre).
- FLTR 2 "CC Select 1-8 (2/2)" : SEL1-SEL8 = numero de CC (CC standards ; MIDI
  LEARN : FUNC + tenir le knob puis envoyer un CC).
- AMP 1 : VAL9-VAL16 ; AMP 2 : SEL9-SEL16.
- FX : aucune page. MOD : 2 LFO (memes parametres).
- Pas de knob LEV (pas de niveau de piste) ; Control All et compresseur ne
  s'appliquent pas aux pistes MIDI.

---

## 7. MIXER (chap. 12.5 a 12.9) : [FUNC] + [MOD]

Pages 1 a 5 (6 si DUAL). Reglages stockes dans le kit (donc le pattern).
Le knob LEVEL/DATA regle partout VOL = Pattern Volume (meme parametre sur
chaque page : niveau global du kit, equivalent du MAIN VOLUME mais sauve avec
le kit, sert a equilibrer les patterns entre eux).

### 7.1 COMPRESSOR : "Compressor (1/5)" (master)

Disposition : A THR, B ATK, C REL, D MUP / E RAT, F SCS, G SCF, H MIX ;
LEVEL/DATA = VOL (pattern). Barre a gauche de l'ecran = reduction de gain.
Chaine (figure 12.5) : Sidechain Source -> Filter (HP/LP) -> Gain Computer
-> Dynamics (Atk/Rel) -> signal de controle ; Input (LR) -> Gain Reduction
-> Make up Gain -> Dry/Wet Mix -> Output.

| Knob | Param | Plage | Sens | MM |
|---|---|---|---|---|
| A | THR | [E] 0-127 | seuil (plus bas = plus de signal compresse) | GARDER |
| B | ATK | [?] valeurs discretes (DT1 : 0.03, 0.1, 0.3, 1, 3, 10, 30 ms, a confirmer) | attaque | GARDER |
| C | REL | [?] valeurs discretes (DT1 : 0.1, 0.2, 0.4, 0.6, 1, 2 s, A1, A2 auto, a confirmer) | release | GARDER |
| D | MUP | [M] en dB ; [?] bornes | gain de compensation | GARDER |
| E | RAT | [M] 1.50, 2.00, 3.00, 4.00, 6.00, 8.00, 16.00, 20.00 | ratio | GARDER |
| F | SCS | [M] COMP MIX (toutes les pistes routees au compresseur), NOT COMP (celles qui ne le sont pas), MAIN (sortie L/R), TRK1-TRK16, IN LR, IN L, IN R | source du sidechain (ex. TRK1 = kick qui fait pomper le mix) | GARDER sauf IN LR / IN L / IN R = ECARTER-SAMPLING |
| G | SCF | [M] bipolaire : negatif = passe-bas (reagit aux basses, pompage), positif = passe-haut (moins de pompage) ; [E] -64 a +63 | filtre du sidechain | GARDER |
| H | MIX | [M] 0 = non compresse, 127 = compresse seul, entre = compression parallele | dry/wet | GARDER |
| LEV | VOL | [E] 0-127 | Pattern Volume | GARDER |

### 7.2 INTERNAL MIXER 1 : "Internal Mixer (2/5)"

A-H = TRK1 a TRK8 (niveau de piste, le meme parametre que LEVEL/DATA sur les
pages de piste) ; LEVEL/DATA = VOL. Seulement pour les pistes audio.
Lock : NON. MM : GARDER.

### 7.3 INTERNAL MIXER 2 : "Internal Mixer (3/5)"

A-H = TRK9 a TRK16 ; LEVEL/DATA = VOL. Pistes non MIDI seulement.
Lock : NON. MM : GARDER.

### 7.4 FX MIXER : "FX Mixer (4/5)"

Disposition (capture) : A-D vides / E DEL, F REV, G CHR, H MOVD ;
LEVEL/DATA = VOL. (Le texte liste CHR, DEL, REV, MOVD ; l'ecran donne l'ordre
DEL, REV, CHR, MOVD sur E-H.)

| Knob | Param | Plage | Sens | MM |
|---|---|---|---|---|
| E | DEL | [E] 0-127 | volume master du delay | GARDER |
| F | REV | [E] 0-127 | volume master de la reverb | GARDER |
| G | CHR | [E] 0-127 | volume master du chorus | GARDER |
| H | MOVD | [E] 0-127 | Master Overdrive : saturation globale des pistes audio du kit (apres le compresseur) | GARDER |

Note : l'annexe B ne donne qu'un seul CC "Mix Volume" par effet (delay CC 28,
reverb CC 92, chorus CC 14) : le VOL des pages SEND FX et DEL/REV/CHR du FX
MIXER sont tres probablement le meme parametre vu a deux endroits.

### 7.5 EXTERNAL MIXER : "External Mixer (5/5)" : ECARTER-SAMPLING

Disposition : A IN LR, B DUAL, C BAL, D vide / E DEL, F REV, G CHR, H vide ;
LEVEL/DATA = VOL. IN LR niveau d'entree ; DUAL (ON = entrees L et R separees
en mono, ajoute la page 6/6 pour R, BAL devient PAN) ; BAL balance ; DEL /
REV / CHR envois des entrees vers les effets. Desactive si MON = DRY dans le
menu SAMPLING. Tout ce bloc depend des entrees audio : ECARTER.

### 7.6 Lock des pages SEND FX et MIXER

Le manuel DT2 ne dit pas que les pages SEND FX et MIXER sont lockables : le
chapitre 10.8.1 ne parle que des PARAMETER pages, et l'annexe C n'offre
aucune destination LFO dans les effets (seulement les envois de piste). A
trancher dans la spec (sur le DT1, la pratique connue est de locker les
reglages delay/reverb depuis une piste audio, ce qui modifie l'effet global
pendant le pas : NON verifie pour le DT2 dans ce manuel).

---

## 8. Reglages lies au son hors des pages (9.8 SETUP, 14.6 ROUTING)

### 8.1 SETUP > KIT ([FUNC] + [FLTR]) : stocke dans le kit

- CONTROL ALL CONFIG : choix des pistes affectees par Control All (TRK +
  tourner un knob). Pistes MIDI non selectionnables ; la piste active est
  toujours affectee. MM : GARDER (deja fait en V.5.2).
- COMPRESSOR ROUTING : 2 pages. Page 1 : TRIG 1-16 = pistes envoyees au
  compresseur. Page 2 : IN L, IN R (ECARTER-SAMPLING), FX (retours des send
  FX). Pistes MIDI non selectionnables. Les pistes non routees passent en
  POST COMP (figure 1.3). Determine aussi COMP MIX / NOT COMP du sidechain.
  MM : GARDER (sans IN L/R).
- TRACK SWAP : tenir 2 TRIG pour echanger deux pistes (reglages, presets,
  sequence). MM : GARDER.

### 8.2 SETUP > TRACK : reglages de la piste active (dans le preset)

| Reglage | Valeurs | Sens | MM |
|---|---|---|---|
| LEGATO | OFF / ON | ON : les enveloppes ne repartent pas si une note est encore tenue | GARDER |
| NOTE PRIORITY | LAST / LOW / HIGH | note jouee si plusieurs en meme temps (seulement si LEGATO ON) | GARDER |
| VELOCITY TO VOL | OFF / LOG / LIN / EXP / EXP 2 | courbe velocite -> volume quand on joue depuis un clavier MIDI | ADAPTER (utile pour le clavier a l'ecran et la VEL des trigs) |
| OCTAVE | [?] | octave de base du preset (aide les preset locks) | GARDER |
| PITCH BEND DEPTH | [?] | ampleur du pitch bend recu en MIDI | ECARTER-MATERIEL |
| PORTAMENTO > SLOPE | CONSTANT RATE / CONSTANT TIME | glissement a vitesse constante ou en temps constant | GARDER |
| PORTAMENTO > AMOUNT | [?] (100 = glissement complet) | glissement partiel : plus bas = part plus pres de la note cible | GARDER |
| PORTAMENTO > STYLE | GLIDE / GLISSANDO | continu ou quantifie au demi-ton | GARDER |
| PORTAMENTO > LEGATO ONLY | ON / OFF | ON : glisse seulement depuis une note encore tenue | GARDER |
| PORTAMENTO > GATING | OFF / ON | ON : le glissement s'arrete au relache | GARDER |
| KEY TRACKING | 4 slots : A-D destination (params SRC, FLTR, AMP, FX, MOD), E-H profondeur bipolaire (offset, affichage 2 decimales ex. 18.49 / -19.61) | la NOTE du trig (et les notes MIDI recues) module 4 parametres ; LEVEL/DATA = tester | GARDER |
| VELOCITY MOD | 4 slots, meme principe | la VEL du trig (et velocite MIDI) module 4 parametres | GARDER |
| AFTERTOUCH | 4 slots | aftertouch MIDI | ECARTER-MATERIEL |
| PITCH BEND | 4 slots | pitch bend MIDI | ECARTER-MATERIEL |
| MODULATION WHEEL | 4 slots | CC 1 | ECARTER-MATERIEL |
| BREATH CTRL | 4 slots | CC 2 | ECARTER-MATERIEL |
| RENAME | | renommer le preset de la piste | GARDER |

### 8.3 SETTINGS > AUDIO ROUTING (14.6) : global

- TO MAIN : quelles sources vont aux sorties MAIN (16 pistes, Delay, Reverb,
  Chorus, entrees) ; TRIG vert = envoye. MM : GARDER (sans entrees) ; ce sont
  les "mutes de routage" utiles pour une piste qui ne doit nourrir que le
  sidechain ou les effets.
- TO SEND FX : quelles sources peuvent envoyer aux effets (16 pistes, Delay,
  Chorus, entrees). MM : GARDER (sans entrees).
- USB IN, USB OUT, INT TO MAIN, USB TO MAIN [dB] (0 a +18 dB), PRE/POST
  FADER : Overbridge / audio USB. ECARTER-MATERIEL.

---

## 9. Tableau recapitulatif des dispositions (A B C D / E F G H / LEV)

| Page | A | B | C | D | E | F | G | H | LEV |
|---|---|---|---|---|---|---|---|---|---|
| TRIG 1 (audio) | NOTE | VEL | LEN | PROB | LFO.T | FLT.T | FILL* | COND* | LEV |
| TRIG 2 (audio) | RTRG | VFAD | LEN | RATE | - | - | PTIM | PORT | LEV |
| SRC Oneshot | TUNE | PLAY | - | SAMP | STRT | LEN | LOOP | LEV | LEV |
| SRC Werp | TUNE | PLAY | - | SAMP | SEG | MODE | BARS | LEV | LEV |
| SRC Stretch | TUNE | PLAY | - | SAMP | STRT | LEN | BARS | LEV | LEV |
| SRC Repitch | - | PLAY | - | SAMP | STRT | LEN | BARS | LEV | LEV |
| SRC Slice | TUNE | PLAY | - | SAMP | SLICE | LEN | - | LEV | LEV |
| SRC Grid | TUNE | PLAY | - | SAMP | SLICE | LEN | GRID | LEV | LEV |
| FLTR 1 Multi-mode | ATK | DEC | SUS | REL | FREQ | RESO | TYPE | ENV | LEV |
| FLTR 1 Lowpass 4 | ATK | DEC | SUS | REL | FREQ | RESO | - | ENV | LEV |
| FLTR 1 EQ | ATK | DEC | SUS | REL | FREQ | GAIN | Q | ENV | LEV |
| FLTR 1 Comb- / Comb+ | ATK | DEC | SUS | REL | FREQ | FDBK | LPF | ENV | LEV |
| FLTR 1 Legacy | ATK | DEC | SUS | REL | FREQ | RESO | TYPE | ENV | LEV |
| FLTR 2 | DEL | - | - | KEY.T | BASE | WDTH | BW.RT | RSET | LEV |
| AMP (ADSR) | ATK | DEC | SUS | REL | RSET | MODE | PAN | VOL | LEV |
| FX | BR | OVER | SRR | ROUT | DEL | REV | CHR | OD.RT | LEV |
| MOD 1/2/3 | SPD | MULT | FADE | DEST | WAVE | SPH | MODE | DEP | LEV |
| Delay (1/3) | TIME | X | WID | FDBK | HPF | LPF | - | REV | VOL |
| Reverb (2/3) | PRE | DEC | FREQ | GAIN | HPF | LPF | - | - | VOL |
| Chorus (3/3) | DPTH | SPD | HPF | WDTH | - | - | DEL | REV | VOL |
| Compressor (1/5) | THR | ATK | REL | MUP | RAT | SCS | SCF | MIX | VOL |
| Internal Mixer (2/5) | TRK1 | TRK2 | TRK3 | TRK4 | TRK5 | TRK6 | TRK7 | TRK8 | VOL |
| Internal Mixer (3/5) | TRK9 | TRK10 | TRK11 | TRK12 | TRK13 | TRK14 | TRK15 | TRK16 | VOL |
| FX Mixer (4/5) | - | - | - | - | DEL | REV | CHR | MOVD | VOL |
| External Mixer (5/5) ECARTER | IN LR | DUAL | BAL | - | DEL | REV | CHR | - | VOL |
| MIDI TRIG 1 ECARTER | NOTE | VEL | LEN | PROB | LFO.T | NOT2 | NOT3 | NOT4 | aucun |
| MIDI TRIG 2 ECARTER | - | - | - | - | - | - | FILL* | COND* | aucun |
| MIDI Source ECARTER | CHAN | BANK | SBNK | PROG | PB | AT | MW | BC | aucun |
| MIDI CC Value 1-8 / 9-16 ECARTER | VAL1/9 | VAL2/10 | VAL3/11 | VAL4/12 | VAL5/13 | VAL6/14 | VAL7/15 | VAL8/16 | aucun |
| MIDI CC Select 1-8 / 9-16 ECARTER | SEL1/9 | SEL2/10 | SEL3/11 | SEL4/12 | SEL5/13 | SEL6/14 | SEL7/15 | SEL8/16 | aucun |

\* lock seul (cadenas). "-" = case vide (cadre pointille a l'ecran).
Pages SRC 2 : memes parametres que SRC 1, la rangee basse remplacee par la
forme d'onde avec reperes (Oneshot : STRT, LEN, LOOP en bas, LEV en barre).

---

## 10. Annexe : numeros MIDI CC / NRPN (annexe B), utiles pour le mapping

Les CC entrants servent au pilotage par controleur (le Roto-Control de Mika
est deja gere en Web MIDI). NRPN note "MSB:LSB".

- Piste : Mute CC 94 (1:101), Track level CC 95 (1:100). Pattern Mute CC 110
  (1:104). Master Overdrive CC 17 (2:37).
- TRIG : Note 3 (3:0), Velocity 4 (3:1), Length 5 (3:2), Filter Trig 13,
  LFO Trig 14, Portamento Time 9 (3:7), Portamento On/Off 65 (3:8).
- SRC : Tune 16 (1:0), Play Mode 17 (1:1), Sample Bank 24 (1:9), Sample Slot
  19 (1:8), knob E 20 (1:4), knob F 21 (1:5), knob G 22 (1:6), Sample Level
  23 (1:7).
- FILTER : Frequency 74 (1:20), knob F 75 (1:21), knob G 76 (1:22), Env Depth
  77 (1:23), Attack 70 (1:16), Decay 71 (1:17), Sustain 72 (1:18), Release 73
  (1:19), Env Delay 91 (1:23 sic), Key Tracking 92 (1:69), Base 26 (1:51),
  Width 27 (1:52), Env Reset 111 (1:68).
- AMP : Attack 79 (1:30), Hold 80 (1:31), Decay 81 (1:32), Sustain 82
  (1:33), Release 83 (1:34), Env Reset 88 (1:41), Mode 87 (1:40), Pan 90
  (1:38), Volume 89 (1:39).
- FX piste : Bit Reduction 54, Overdrive 57, SRR 55, SRR Routing 56, Delay
  Send 84 (1:36), Reverb Send 85 (1:37), Chorus Send 12 (1:35). (Pas de CC
  pour OD.RT ni BW.RT.)
- LFO1 : Speed 102 + LSB 58 (1:42), Mult 103 (1:43), Fade 104 (1:44), Dest
  105 (1:45), Wave 106 (1:46), Start Phase 107 (1:47), Trig Mode 108 (1:48),
  Depth 109 + LSB 59 (1:49).
- LFO2 : Speed 112 + LSB 60 (1:50), Mult 113 (1:51), Fade 114 (1:52), Dest
  115 (1:53), Wave 116 (1:54), Start Phase 117 (1:55), Trig Mode 118 (1:56),
  Depth 119 + LSB 61 (1:57).
- LFO3 : Speed 78 + LSB 62 (1:58), Mult 52 (1:59), Fade 53 (1:60), Dest 28
  (1:61), Wave 29 (1:62), Start Phase 30 (1:70), Trig Mode 31 (1:71), Depth
  86 + LSB 63 (1:72).
- DELAY (canal FX) : Time 21 (2:0), Pingpong 22 (2:1), Width 23 (2:2),
  Feedback 24 (2:3), HPF 25 (2:4), LPF 26 (2:5), Reverb Send 27 (2:6), Mix
  Volume 28 (2:7).
- REVERB : Predelay 29 (2:8), Decay 30 (2:9), Shelving Freq 31 (2:10),
  Shelving Gain 89 (2:11), HPF 90 (2:12), LPF 91 (2:13), Mix Volume 92
  (2:15).
- CHORUS : Depth 16 (2:41), Speed 9 (2:42), HPF 70 (2:43), Width 71 (2:44),
  Delay Send 12 (2:45), Reverb Send 13 (2:46), Mix Volume 14 (2:47).
- COMPRESSOR : Threshold 111 (2:16), Attack 112 (2:17), Release 113 (2:18),
  Makeup 114 (2:19), Pattern Volume 119 (2:24), Ratio 115 (2:20), Sidechain
  Source 116 (2:21), Sidechain Filter 117 (2:22), Dry/Wet 118 (2:23).
- EXTERNAL IN MIXER (CC 72 a 82, NRPN 2:30 a 2:40) : ECARTER-SAMPLING.
- Euclidien (NRPN 3:8 a 3:14, page FUNC+AMP) : agent seq.
- Les CC des send FX et du mixer sont recus sur le canal "FX" ; ceux des
  pistes sur le canal de chaque piste (SETTINGS > MIDI CONFIG > CHANNELS).

---

## 11. Synthese du perimetre son pour la refonte

GARDER (coeur du DT2 sans sampling) :
- 16 pistes libres, chacune : SRC machine + FX de piste (BR, OVER, SRR et
  leurs routages) + base-width + filter machine (6 au choix) + enveloppe
  filtre ADSR avec delai + ampli AHD/ADSR + pan + VOL + niveau de piste +
  3 envois (DEL, REV, CHR) post-fader.
- 3 LFO par piste (7 formes, 5 modes, destinations annexe C, LFO2 -> LFO1,
  LFO3 -> LFO1/LFO2).
- TRIG 1 et 2 (note, velocite, longueur, probabilite, LFO.T, FLT.T, FILL,
  COND, retrigs, portamento).
- Machines SRC : Oneshot, Grid ; Werp, Stretch, Repitch si la banque contient
  des boucles ; Slice sans editeur de points.
- Send FX : Delay, Reverb, Chorus avec envois croises (chorus -> delay/reverb,
  delay -> reverb).
- Mixer : compresseur master avec sidechain (sans IN), 2 pages de niveaux,
  FX mixer + master overdrive, Pattern Volume sur LEVEL/DATA.
- SETUP : Control All, routage compresseur, track swap, legato, note
  priority, portamento detaille, key tracking et velocity mod (4 slots).
- Routage TO MAIN / TO SEND FX.
- Interactions : randomize page, reset page, reload preset, valeurs de la
  page en tenant la touche, snaps TUNE (octave / demi-ton), NOTE en gamme.

ECARTER-SAMPLING : chap. 13 entier (enregistrement, moniteur, sample
recorder), EXTERNAL MIXER, sources SCS IN LR / IN L / IN R, IN L / IN R du
routage compresseur et du TO MAIN / TO SEND FX, editeur de slices (points,
zero crossing), detection de transitoires sur sample (a pre-calculer hors
ligne si besoin), gestion +Drive / Transfer / limites du pool.

ECARTER-MATERIEL : machine MIDI et ses pages, USB IN/OUT, INT TO MAIN, USB TO
MAIN, PRE/POST FADER (Overbridge), PITCH BEND DEPTH, mod AFTERTOUCH /
PITCH BEND / MOD WHEEL / BREATH CTRL.

Plages a fixer dans la spec (le manuel DT2 ne les donne pas) : NOTE, VEL,
LEN, STRT/LEN/LOOP, SEG, BARS, GRID, KEY.T, ATK/DEC/SUS/REL, FREQ, RESO,
OVER, SRR, envois, SPD/DEP (haute resolution), SPH, delay FDBK, reverb et
chorus, compresseur ATK/REL/MUP/THR. Proposition : convention Elektron 0-127
(bipolaires -64 a +63) avec affichage entier, SPD et DEP en 2 decimales.
