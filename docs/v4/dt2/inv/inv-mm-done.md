# Inventaire : ce que la MM-RYTM fait deja de la Digitakt (etat au 2026-10-30)

Source pour le cahier de la refonte "Digitakt II avec mon design" (16 pistes libres, sans le sampling, 2 ou 3 grosses mises en ligne).
Lu : `docs/v4/digitakt-reference.md`, `digitakt-d1-spec.md`, `digitakt-d2-spec.md`, `digitakt-d3a-spec.md`, `digitakt-d3b-spec.md`, les rapports `2026-10-29-rytm-v50-digitakt-d1.md`, `2026-10-29-rytm-v51-digitakt-d2.md`, `2026-10-30-rytm-v52-digitakt-d3a.md`, le rapport D3b de la branche du builder, et le code de `src/v4` (fichiers cites a chaque section). Comparaisons au manuel Digitakt II OS 1.17 (`m2.txt`) quand c'est utile. Lecture seule, rien n'a ete modifie dans le depot.

Conventions : DT2 = Digitakt II. "Ecart DT2" = ce qui differe de la Digitakt II aujourd'hui. Les ids de fichiers sont relatifs a `src/v4/`.

---

## 0. Les versions

| Version | Date | Contenu | Etat |
|---|---|---|---|
| V.5.0 (D1) | 2026-10-29 | la face : 14 touches, FUNC et fonctions orange, couleurs DT, REC, PLAY/pause, STOP, mode MUTE global et pattern, pages TRIG (NOTE, VEL) MOD (vide) TEMPO SEND FX MIXER, SAVE/RELOAD, COPY/PASTE/CLEAR, logo M = OPEN | en ligne |
| V.5.1 (D2) | 2026-10-29 | TRIG 1/2 et 2/2 complets, 81 conditions, PROB, μTIME, LEN, RTRG, lock trigs, FILL (YES tenu), 2 LFO par voix (MOD 1/2, 2/2), compteur de passages | en ligne |
| V.5.2 (D3a) | 2026-10-30 | banques A a H (128 patterns), FUNC + PTN = BANK, chaines de 64, CONTROL ALL (TRK + potard), `rytm:bank:0-7` | en ligne (origin/main a0b6c27, firmware.json mm808 5.2) |
| V.5.3 (D3b) | 2026-10-30 | LIVE REC | **construit, pas revu, pas pousse** : branche `worktree-agent-a3f84c671ac17ce70`, commits 7f7d1f8, 5ef991c, d03246c, 8ecf09d (worktree `.claude/worktrees/agent-a3f84c671ac17ce70`), rapport `docs/reports/2026-10-30-rytm-v53-digitakt-d3b.md` sur cette branche. Voir section 9 |
| V.5.4 (prevu D3c) | - | 64 pas (4 pages), longueur et vitesse par piste (SETUP), copier-coller de pas et de pages | **pas commence** |
| V.5.3 EUCLID (prevu D1) | - | FUNC + AMP = euclidien | **pas commence** (message de place seulement) |

Regles tenues a chaque etape (a decider pour la refonte : les garder ou les lever) :
- le telephone (`PORTRAIT`) ne change pas, au pixel pres : il garde la face V.4.x (voir section 8) ;
- aucun id MIDI ne disparait ni ne change d'ordre (`midi/targets.ts`, `docs/midi/MIDI-targets.csv`, 892 cibles en V.5.3, 656 `rytm:*`) ;
- les sauvegardes d'avant se relisent (patterns, presets, UNDO, lien SHARE) ;
- identite audio : a reglages de depart, le rendu hors ligne ne change pas (ecart ~1e-7) ;
- aucun son pendant les tests (`--mute-audio`, `?mute=1`, rendus hors ligne).

---

## 1. La face du desktop (source unique `rytm/faceplate.ts`, en mm)

### 1.1 Geometrie

- Face 256 x 156 mm (`RYTM_FACEPLATE.size`), chanfrein 2, coins 6. 1 unite 3D = 20 mm (`MM_PER_UNIT`). Pensee pour une vraie machine physique (le boitier MMHW v2 de Mika).
- Ecran : verre 106 x 67 en (8, 8), zone active 93,6 x 56,16, 800 x 480 px, 4,3 pouces. OLED noir et os (monochrome, langue OP-1), non tactile au desktop (`SCREEN_TOUCH = PORTRAIT`) sauf le petit `i` (zone `lcd-i`).
- 8 potards A a H en 2 x 4, centres x 134 166 198 230, y 24 et 56, emprise 28, capuchon 17, anneau de valeur 270 deg en 27 segments (potards motorises prevus sur le boitier). Serigraphie : la lettre seule, l'ecran dit la fonction (le bloc k est pose au-dessus du potard k, loi "mirror", `rytm/pages.ts FACE_LAW`).
- Rangee de 14 touches de 10,4 x 12 au pas de 12 depuis x 8, en y 84 ; legende imprimee sur le capuchon (cap 1,35 mm), fonction secondaire imprimee en orange sous la touche (y 98,6, cap 1,25). Relief 3,2 mm, chanfrein 0,6, course 1,4, temoin LED 5,4 x 0,8.
- SCENE A (180, 84, 12 x 12), fente du crossfader x 196 a 232 sur y 90 (capuchon 8 x 12), SCENE B (236, 84).
- 16 pas de 27,6 x 20 en deux rangees de 8 au pas de 30,4 depuis x 8, en y 104 et 128 ; cadres des temps sur 1, 5, 9, 13 ; numero en haut a gauche ; **les pas 1 a 8 portent un nom de voix imprime (BD SD CH OH CP TOM HT CY)** ; marque de verrou (8 x 0,9).
- Bande du logo (y ~79,5) : mot-symbole Maudite Machine a gauche, `MM-RYTM` (x 114), `FIRMWARE V.5.x / 2026` (x 235), le logo M (x 248) qui est la zone `pad-open` (OPEN du capot). Ligne d'aide en bas (y 152) : `● REC: WRITE STEPS · WITHOUT REC: STEPS 1-8 PLAY THE VOICES · HOLD A STEP + KNOB: P-LOCK · FUNC + STEP 1-8: MUTE (REC: LOCK TRIG)`.
- `faceplateParts()`, `faceplateCheck()` (rien ne se touche), `faceplateNotes()` : l'export de decoupe.

### 1.2 Les 14 touches de la rangee

| # | Legende | Hotspot | Secondaire imprimee (FUNC +) | Cle MIDI | Clavier |
|---|---|---|---|---|---|
| 0 | FUNC (capuchon orange) | `func` | - | `rytm:func` (tenue) | Alt tenu |
| 1 | TRK | `trk` | MUTE | `rytm:trk` (tenue, note 60 du boitier) | - |
| 2 | PTN | `pad-edit` | BANK | `rytm:edit` | E |
| 3 | ● (REC) | `rec` | COPY | `rytm:rec` | W |
| 4 | ▶ (PLAY) | `run` | CLEAR | `rytm:play` (et `rytm:run` garde l'ancien RUN/STOP) | Espace |
| 5 | ■ (STOP) | `stop` | PASTE | `rytm:stop` | Maj + Espace |
| 6 | TRIG | `pkey-trig` | TEMPO | `rytm:page:trig` | - |
| 7 | SRC | `pkey-voice` | SOUNDS | `rytm:page:voice` (alias `src`, `smpl`) | - |
| 8 | FLTR | `pkey-fltr` | SETUP | `rytm:page:fltr` | - |
| 9 | AMP | `pkey-env` | EUCLID | `rytm:page:env` (alias `amp`) | - |
| 10 | FX | `pkey-fx` | SEND FX | `rytm:page:fx` | - |
| 11 | MOD | `pkey-mod` | MIXER | `rytm:page:mod` | - |
| 12 | YES | `yes` | SAVE | `rytm:yes` (tape), `rytm:fill` (tenue) | Entree (tape ; tenue = FILL) |
| 13 | NO | `no` | RELOAD | `rytm:no` | Echap |

Autres cibles MIDI de la face : `rytm:mutemode`, `rytm:save`, `rytm:reload`, `rytm:copy`, `rytm:paste`, `rytm:bank:0..7`, `rytm:ptn:0..15`, `rytm:screen:<ecran>` (24), `rytm:step:N`, `rytm:lock:N`, `rytm:knob:1-8`, `rytm:pad:<voix>`, `rytm:scene:a|b`, `rytm:xfade`, `rytm:home`, `rytm:infos`, `rytm:open`, et les anciennes `rytm:clear`, `rytm:random`, `rytm:mute`, `rytm:solo` (gardees, leur touche a quitte la face). V.5.3 ajoute `rytm:liverec`.

Notes proposees du boitier MMHW v2 (`docs/hardware/mmhw-v2-app-side.md`, "a confirmer avec protocol.js") : TRK 60, FUNC 61, PTN 62, ● 63, ▶ 64, ■ 65, TRIG 66, SRC 67, FLTR 68, AMP 69, FX 70, MOD 71, YES 72, NO 73, SCENE A 79, SCENE B 80 ; CC 28 crossfader ; CC 20 a 27 moteurs des potards ; CC 30 a 37 toucher des potards.

### 1.3 Ecarts DT2 du panneau (ce que la face n'a pas)

Absents aujourd'hui (le panneau DT2 en a) : touche **PAGE** et ses **8 LED de page** (FILL momentane sur DT2, FUNC + PAGE = PAGE SETUP) ; les 4 **fleches** (UP DOWN LEFT RIGHT : μTIME d'un trig, nudge tempo, banque en PTN, navigation des menus, decalage de tous les trigs) ; **LEVEL/DATA** (niveau de la piste, listes, FUNC = PRESET MANAGER, preset lock) ; **MAIN VOLUME** ; **PRESET/KIT** (FUNC = PERFORM KIT) ; **SETTINGS** (FUNC = SAVE PROJECT) ; **TEMPO** (touche a part, FUNC + TEMPO = TAP) ; **KEYBOARD** (FUNC = KEYBOARD SETUP) ; **SONG** (FUNC = SONG EDIT) ; SAMPLING (a laisser tomber, consigne de Mika).
Fonctions secondaires qui different : DT2 FUNC + TRIG = QUANTIZE (MM : TEMPO) ; FUNC + SRC = MACHINE (MM : SOUNDS, la liste des sons) ; FUNC + FLTR = SETUP et FUNC + AMP = SEQUENCER euclidien (MM : messages de place seulement, voir 2.2). Les autres (TRK MUTE, PTN BANK, REC COPY, PLAY CLEAR, STOP PASTE, FX SEND FX, MOD MIXER, YES SAVE, NO RELOAD) sont celles de la DT2.
En plus de la DT2 sur la face MM : SCENE A, crossfader, SCENE B (Octatrack, pas Digitakt), le logo M (OPEN), le `i` de l'ecran.

### 1.4 Couleurs (langue Digitakt, toutes dans `theme.ts` : `DT_HEX`, `DT_HEX_DARK`, palette creme de `applyAppearance`)

- Machine noire : rouge #FF2B2B (coups, REC, page affichee, voix choisie, pattern qui joue), jaune #FFD75E (locks, lock trigs, point de condition), blanc #F4F1EA (tete de lecture, anneaux, flashs), vert #3DDC5A (PLAY, mute global), magenta #E04DD8 (mute du pattern), bleu #4DA3FF (scenes), orange #FF6A13 (FUNC et legendes secondaires seulement).
- Machine creme : memes teintes plus sombres (rouge #D81E1E, vert #1F9E3A, bleu #2F78D6, magenta #B23AAB), encre orange #A84300, le blanc devient l'encre #191919.
- FUNC : capuchon orange, legende noire, temoin eteint au repos, blanc plein tenue, blanc clignotant gardee. Touches de page : rouge sur la page affichee, rouge faible en HOME, eteintes ailleurs ; les pages de FUNC (TEMPO, SEND FX, MIXER) n'allument aucune touche. REC rouge fixe (V.5.3 : clignotant en LIVE REC). PLAY vert, vert clignotant en pause. STOP, YES, NO : eclair blanc a l'appui. TRK et PTN rouges. SCENE A/B et cadre bleus. Appui neutre (eclat blanc faible, gris sur creme).
- Pas : coup rouge avec rampe de velocite (`STEP_LIT`), tete de lecture blanc pur (reste sur le dernier pas entendu en pause), pas en P-LOCK jaune clignotant, marque de verrou jaune, lock trig jaune (#FFD75E, ton `dyellow`), petit point jaune au coin arriere gauche d'un pas a COND ou PROB. Vue PTN : pattern qui joue rouge, suivant et chaine rouges clignotants, plein blanc faible, vide eteint. Vue BANK : banque qui joue rouge, affichee rouge clignotant, pleine blanc faible. Vue TRK : voix choisie rouge 1, autres 0,22, coupee 0,07, flash blanc au coup ; barre verte (joue quand d'autres sont coupees) ou blanche (solo). Mode MUTE : vert (global) ou magenta (pattern) = joue, eteint = coupee, blanc = solo.
- Anneaux : base blanc, lock jaune, unlocked blanc 45 %, global 30 %, scene bleu, dim 15 % ; bande du crossfader bleue.
- Repli sans WebGL (`fallback/StaticMachine.tsx`) : FUNC orange, rond de REC, legendes orange, pas rouges.

---

## 2. Les gestes (desktop) : `actions.ts`, `ui/Hotspots.tsx`, `hooks/useKeys.ts`, `state/func.ts`, `state/holdLatch.ts`, `state/trk.ts`, `state/dtFace.ts`

### 2.1 Regles des modificateurs (la souris ne tient pas deux touches)

- **FUNC** (`state/func.ts`) : tenue = momentanee ; une tape = gardee pour LA touche suivante ; deux tapes en 400 ms (`DT_GESTURE.funcDoubleMs`) = gardee (`locked`, l'ecran dit `FUNC LOCKED: + KEYS · NO: OFF`) jusqu'a une nouvelle tape ; Echap ou NO la relachent ; Alt tenu au clavier = FUNC (jamais gardee) ; plusieurs sources (pointeur, Alt, MIDI, boitier). Une FUNC gardee pour une touche est consommee par toute entree (touche de KIT, SCENE, logo M, potard, pas, voix au clavier, cible MIDI) : `funcDrop`. Ecran : `FUNC: + A KEY`.
- **TRK** (`state/trk.ts`, `holdLatch`) : tenue = momentanee ; une tape la garde jusqu'au choix d'une voix, puis fermeture 400 ms (`PAD_DOUBLE_TAP_MS`, la place d'une deuxieme tape) ; apres un CONTROL ALL elle reste gardee jusqu'a une autre tape, un choix de voix ou Echap ; jamais eteinte sous un potard tenu.
- **Touche de page puis YES/NO** : une touche de page tapee reste "tenue" 1,5 s (`DT_GESTURE.pageArmMs`) ; une vraie tenue marche aussi (`pageKeyHold`). PLAY n'est jamais pris. Rien ne s'arme sous KIT. SEND FX et MIXER s'arment aussi (pas TEMPO).
- **YES** : tape (lachee avant 250 ms, `FILL_HOLD_MS`, et sur la touche) = la tape ; tenue > 250 ms sans menu ouvert = FILL tant qu'on tient (jamais le hasard). Avec un menu ouvert (KIT, page TEMPO, PTN, liste des sons) ou FUNC : agit tout de suite (au lacher au pointeur, a l'appui au clavier).
- **SCENE A/B** (`state/sceneCtl.ts`) : tenue = armee tant qu'on tient ; tape = gardee (autre tape, Echap, CLEAR de la scene ou autre machine la rendent).

### 2.2 Chaque touche, seule et avec FUNC (V.5.2 en ligne)

| Touche | Seule | FUNC + |
|---|---|---|
| FUNC | rien, l'ecran dit `FUNC: + A KEY` | - |
| TRK | tenue ou gardee + pas 1 a 8 = choisir la voix (sans un son) ; pas 9 a 16 pris, rien ; double tape sur un pas = mute de la voix ; clic droit sur un pas = mute ; tenue + potard de page = CONTROL ALL ; TRK ferme le mode MUTE | MUTE : mode mute global (vert) ; encore = mute du pattern (magenta) ; encore = sortie (les mutes restent) ; NO ou Echap sortent |
| PTN | ouvre/ferme la grille des patterns (la banque affichee) ; deux fois en 1,6 s (`EDIT_AGAIN_MS`) = **KIT** (les presets) ; dans KIT, PTN = EXIT ; dans la vue BANK, la ferme | BANK : vue BANK (pas 1 a 8 = banques A a H) ; encore = fermee |
| ● REC | bascule le mode ecriture des pas (grid rec), jamais retenu (eteint a chaque visite) ; eteint = sortie du P-LOCK | COPY : hors REC le pattern (pas, verrous, scenes, mute du pattern, reglages de trig) ; REC allume la ligne de la voix choisie (pas, verrous, reglages de trig). Presse-papiers d'une seule chose |
| ▶ PLAY | a l'arret : lecture depuis le pas 1 ; en lecture : pause (LED verte clignotante) ; en pause : reprise au pas suivant celui entendu ; met une piste SoundCloud en pause | CLEAR : hors REC tout le pattern (`clearPattern`, voir 5.9) ; REC allume la ligne de la voix ; une scene armee = la scene videe ; en P-LOCK = les verrous du pas. Une etape d'UNDO |
| ■ STOP | arret, retour au pas 1, la pause oubliee ; deux fois en 600 ms = arret + queues REVERB et DELAY coupees en fondu de 80 ms (`cutTails`) | PASTE : colle le presse-papiers (pattern sur le pattern courant, ligne sur la voix choisie), quel que soit REC ; `NOTHING TO PASTE` ; une etape d'UNDO |
| TRIG | page TRIG ; rappuyee = onglet suivant (1/2, 2/2) ; puis YES = **RANDOM** du beat entier ; puis NO = TRIG rechargee du point de sauvegarde | TEMPO : page TEMPO (BPM, SWING) ; YES y est TAP |
| SRC | page SRC (MAIN, puis SYNTH si la famille a des samples) ; puis YES = SRC au hasard (reglages + son) ; puis NO = rechargee | SOUNDS : la liste des sons de la voix (navigateur) |
| FLTR | page FLTR ; rappuyee = HOME ; puis YES/NO = hasard/recharge | SETUP : **pas fait**, message `SETUP (TRACK LENGTH): V.5.2` (texte perime, prevu V.5.4) |
| AMP | page AMP ; rappuyee = HOME ; puis YES/NO | EUCLID : **pas fait**, message `EUCLID: V.5.3` (texte perime) |
| FX | page FX (VOICE FX de la voix) ; rappuyee = HOME ; puis YES/NO | SEND FX : la page GLOBAL FX d'avant |
| MOD | page MOD (1/2 LFO 1, 2/2 LFO 2) ; puis YES = le LFO affiche au hasard ; puis NO = recharge | MIXER : 1/2 LEVELS ; MOD rappuye sur le MIXER = 2/2 MASTER |
| YES | dans KIT : valider (LOAD, OK, OVERWRITE, YES) ; page TEMPO : TAP ; apres une touche de page : la page au hasard ; tenu : FILL ; sinon `YES: TAP A PAGE KEY FIRST TO RANDOMIZE IT` | SAVE : point de sauvegarde en memoire (l'etat que l'UNDO capture), lie a son pattern, pas retenu d'une visite a l'autre. `SAVED A03` |
| NO | retour : la chaine d'Echap ; annule un CONTROL ALL tant que TRK est allumee ; ferme la vue BANK ; apres une touche de page (touche NO ou `rytm:no` seulement, point de sauvegarde pose, rien d'ouvert) : la page rechargee ; relache une FUNC gardee | RELOAD : retour au point de sauvegarde (une etape d'UNDO) ; sur un autre pattern `SAVED ON A01`, rien ; sans point `NOTHING SAVED: FUNC + YES FIRST` |

Logo M (`pad-open`) : ouvre/ferme le capot (OPEN, voir 6.4). `i` de l'ecran : INFOS au survol (voir 6.5).

### 2.3 Les pas (desktop)

Ordre de priorite (`stepToggle`) : FUNC + pas, puis TRK, puis grille PTN, puis mode MUTE, puis hors REC, puis REC.
- **FUNC + pas** : hors REC, pas 1 a 8 = mute rapide de la voix (jeu global, `BD MUTED` / `BD BACK`), pas 13 a 16 = message perime `PAGES 1-4: V.5.2`, 9 a 12 rien ; REC allume = **lock trig** de la voix choisie (pas vide : lock trig ; lock trig : enleve avec ses verrous ; note : devient lock trig).
- **TRK + pas** : 1 a 8 choisissent la voix (sans un son), double tape = mute, 9 a 16 rien.
- **Grille PTN ouverte** : le pas k = pattern k de la banque affichee (a l'arret tout de suite, en lecture a la fin de la mesure `NEXT A05: AT THE BAR`) ; d'autres pas en 2 s = une chaine ; tenir un emplacement vide = y copier le pattern courant ; vue BANK : pas 1 a 8 = banques.
- **Mode MUTE** : pas 1 a 8 basculent la voix (jeu global ou du pattern) ; tenue 400 ms (`muteHoldMs`) = SOLO de la voix (blanc), tenue encore = fin du solo (le solo n'est pas Digitakt).
- **Hors REC** (TRK SELECT NORMAL de la DT2) : pas 1 a 8 = la voix joue a HIGH (meme en lecture) et devient la voix choisie, rien ne s'ecrit ; pas 9 a 16 = rien, `● REC TO WRITE STEPS` au plus toutes les 2 s ; tenir un pas = pas de P-LOCK (`P-LOCK NEEDS ● REC` une fois) ; glisser = rien ; Suppr = rien.
- **REC allume** (grid rec) : une tape pose le pas (a la velocite des nouveaux pas de la voix : HIGH, ou VEL de TRIG) ou le retire (on/off, plus le cycle HIGH MID LOW d'avant) ; une tape sur un lock trig l'enleve ; tenir 350 ms immobile = **P-LOCK** (lache sans tourner : P-LOCK garde, `latched` ; lache apres avoir tourne : momentane) ; plusieurs pas tenus = verrous sur tous ; tenir puis glisser = velocite 1 a 9 ; Suppr = vide le pas (et ses verrous si lock trig) ; L = P-LOCK sur le pas choisi ; tape sur le pas en P-LOCK = sortie, sur un autre = deplace le P-LOCK.
- Le Dock (fenetre de desktop etroite) ecrit toujours, sans FUNC ni REC.

### 2.4 Les potards

- Glisser (souris, doigt), Maj = fin, molette (acceleree), fleches sur le jumeau HTML, MIDI absolu ou relatif, boitier (`hw.pot`, `hw.touch`, moteurs `hw/motor.ts`).
- Double tape (ou double clic) = valeur de depart ; en P-LOCK = enleve le verrou du pas (`UNLOCKED`) ; scene armee = la cle quitte la scene.
- Tape sur le bloc DIST/CHORUS/DELAY/REVERB/BIT/COMP de SEND FX (ou de VOICE FX) = la page de ce FX (voir 3.6). Un dessin (enveloppe, filtre) n'est pas tournable (`IS A PICTURE`).
- Pendant KIT : un potard fait defiler la liste ; A tourne la lettre, B deplace le curseur du nom.
- Priorites : pas tenu (P-LOCK) gagne sur tout ; puis scene armee (la valeur va dans la scene) ; puis TRK tenue (CONTROL ALL, pages de voix seulement) ; sinon la voix choisie ou la machine.

### 2.5 Le clavier (desktop, devant la MM-RYTM)

- Espace = PLAY ; Maj + Espace = STOP ; W = REC (R reste RESET VIEW) ; Entree = YES (tenue = FILL) ; Echap = NO (puis le bout de la chaine d'Echap, la vue d'ensemble) ; Alt tenu = FUNC ; Alt + Espace, Alt + Maj + Espace, Alt + Entree, Alt + W, Alt + E = FUNC + la touche (codes physiques).
- A S D F Z X C V = les 8 voix (BD SD CH OH CP TOM HT CY) : padHit (a l'arret la voix sonne et est choisie ; en lecture choisie sans son ; V.5.3 : ecrite en LIVE REC).
- E = PTN (EDIT) ; P = KIT (presets) ouvert/ferme ; fleches dans KIT = curseur, Entree = LOAD/OK ; O ou 6 = OPEN ; 1 a 5 = pages du site (TRACKS MIXTAPES SHOWS PRESS CONTACT) ; I = INFOS ; H = HOME/PAGE ; [ et ] = page precedente/suivante (le tour des 6 touches de page) ; L = P-LOCK du pas choisi ; M = ancien MUTE (machine a trois etats ONE/MULTI/OFF), Maj + M = SOLO, tenus 600 ms = toutes les voix reviennent ; Cmd+Z / Maj+Cmd+Z / Ctrl+Y = UNDO / REDO ; fleches gauche/droite = machine d'a cote (conflit avec les fleches de la DT2) ; liste des sons ouverte : haut/bas = son precedent/suivant, Suppr = retirer un son a soi.

---

## 3. Les pages et leurs parametres (desktop) : `rytm/pages.ts`, `state/rytmPage.ts`, `rytm/pageView.ts`, `scene/screen.ts`

Principe : 8 blocs en 2 x 4 a l'ecran, le bloc k au-dessus du potard k ; valeur en grand de 0 a 127 (ou -64 a +63, ou le nom du cran), ligne d'unite courte (216 MS, -3.2 DB...), petit dessin anime. Un ecran = une page ou un de ses onglets ; une touche de page rappuyee = onglet suivant, ou HOME pour une page sans onglet. En P-LOCK : en-tete en negatif (`P-LOCK STEP 05`), blocs verrouilles en negatif avec un P, les non verrouilles en retrait, GLOBAL et NO LOCK a peine ; en lecture, les blocs d'un pas qui a des verrous passent en negatif au passage. Les pastilles d'en-tete : page, onglets, FILL, CONTROL ALL, BANK, P-LOCK, GLOBAL/PATTERN MUTE (pied), V.5.3 LIVE REC.

### 3.1 TRIG (2 onglets ; `audio/trig.ts`)

TRIG 1/2 :

| Potard | Parametre | Valeurs | Depart |
|---|---|---|---|
| A | NOTE | TUNE de la voix au demi-ton (-24 a +24), verrouillable (`tune`) | 0 |
| B | VEL | velocite des nouveaux pas (en P-LOCK celle du pas), 9 niveaux montres 0 a 127 | HIGH (9) |
| C | LEN | 1/16, 1/8, 1/4, 1/2, 1, 1.5, 2, 3, 4, 6, 8, 16 pas, INF ; coupe le coup en 8 ms, les queues d'envoi continuent | INF |
| D | PROB | 0 a 100 % (generateur a part, jamais `Math.random`) | 100 % |
| E | COND | 81 conditions (3.1.1) | NONE |
| F | μTIME | -23 a +23 en 1/384 de mesure (1/24 de pas), affiche le compte, unite `/384 58MS` | 0 |
| G | LFO.T | OFF / ON : le trig relance les LFO en mode TRG, ONE, HLF | ON |
| H | vide | - | - |

TRIG 2/2 : A RTRG (OFF/ON, depart OFF) ; B RATE (1/1, 1/2, 1/3, 1/4, 1/5, 1/6, 1/8, 1/10, 1/12, 1/16, 1/20, 1/24, 1/32, 1/40, 1/48, 1/64, 1/80 de mesure ; depart 1/16) ; C VFAD (-64 a +63, depart 0) ; D RLEN (1/16 a 16 pas ou INF = jusqu'au trig suivant ; depart 1 pas) ; E a H vides.

Sans pas tenu, un potard regle le **defaut de la voix dans le pattern** (chaque pattern a les siens, comme la DT) ; avec un pas tenu (REC), c'est un P-LOCK (cles `len prob cond utime lfot rtrg rate vfad rlen`). Dessins : COND en cases A:B, RATE en repetitions, VFAD six repetitions, LEN et RLEN en enveloppe, PROB en barres, crans pour RTRG et LFO.T.

#### 3.1.1 COND (ordre du potard)
NONE ; FILL, !FILL ; PRE, !PRE ; NEI, !NEI ; 1ST, !1ST ; LST, !LST ; A:B pour B de 2 a 8 et A de 1 a B (1:2, 2:2, 1:3 ... 8:8) ; puis les memes avec ! (!1:2 ... !8:8). Regles : une COND autre que NONE gagne sur PROB ; PRE et NEI lisent le dernier resultat evalue (une PROB tiree compte) ; NEI = la voix precedente dans l'ordre des pads (BD n'a pas de voisine) ; les conditions s'evaluent meme sur une voix coupee ; 1ST = premier passage depuis le lancement ; LST = dernier passage avant un changement de pattern prevu (fige a la premiere programmation du pas) ; A:B = passage A d'un cycle de B, compteur de passages partant de 1.

Ecart DT2 : la DT2 range TRIG 1 en NOTE VEL LEN PROB LFO.T **FLT.T** **FILL** COND (FILL est un parametre a part, COND un verrou de condition) et TRIG 2 en RTRG VFAD LEN RATE - - **PTIM PORT** (portamento). MM n'a ni FLT.T, ni le portamento, ni un FILL a part ; μTIME est un potard (sur la DT2 : TRIG tenu + LEFT/RIGHT) ; l'ordre de TRIG 2 differe (MM : RTRG RATE VFAD RLEN).

### 3.2 SRC (`voice`, onglets MAIN et SYNTH)

La voix a deux couches qui jouent ensemble (`audio/kit.ts`) : SYNTH (une MACHINE 909, 808 ou MM, synthese `audio/shotsdsp.ts`) et SAMPLE (un sample de sa famille, ou OFF).
- **MAIN** d'une famille qui a des samples : SOUND (la liste unique OFF, 909, 808, MM, puis les samples ; verrouillable `snd`, "sample lock"), VOL (2 cases, volume de la voix, en P-LOCK celui du pas ; VEL et VOL fusionnes en 2026-10-10), PITCH (-24 a +24 demi-tons, `tune`), FINE (+/-64 cents, `fine`), LEN (longueur du sample, `slen`), REV (sample a l'envers, `srev`).
- MAIN du clap : SOUND, VOL, PITCH, FINE, GATE (reverbe a porte OFF/ON). Les autres : SOUND, VOL, PITCH, FINE.
- **SYNTH** : BD = MACHINE, MIX (synthese sous le sample, 2 cases), TUNE, ATTACK, SWEEP, DECAY, DRIVE ; SD = MACHINE, MIX, TUNE, SNAPPY, TONE, DECAY, GATE ; CP = MACHINE, MIX, GATE ; les autres = MACHINE, MIX. Les potards de machine verrouillables (`ktune kattack ksweep kdecay kdrive sdtune snappy sdtone sddecay gate mach syn slev`).
- Couches par famille au MIDI : `rytm:layer:<famille>:<reglage>` (72 cibles : syn, lev, tune, fine, start, len, rev...).

Ecart DT2 : la DT2 a des SRC machines (ONESHOT, WERP, REPITCH, GRID...) sur des samples, page SRC 2 avec la forme d'onde, et FUNC + SRC = MACHINE. Ici le choix "machine" est 909/808/MM par famille, plus les samples de la famille.

### 3.3 FLTR (une page)

A FREQ (20 Hz a 20 kHz exponentiel, `fcut`), B RESO (Q 0,707 a ~12, `freso`), C TYPE (LP, HP, BP, `ftype`), D TONE (bascule de la voix -1 a 1, `tone`), E ATK (attaque de l'enveloppe du filtre, `fatk`), F DEC (10 ms a 1,6 s, `fdec`), G ENV (profondeur +/-5 octaves, `fenv`), H dessin FILTER (la courbe). Un filtre par coup (BiquadFilterNode), absent a son depart.
Ecart DT2 : FLTR DT2 = machines de filtre (multimode, lowpass 4, legacy LP/HP, comb, EQ...), enveloppe ADSR + DEL, KEY.T, page 2 base-width (BASE, WIDTH, BW.RT, RSET). MM : un multimode LP/HP/BP simple, enveloppe AD.

### 3.4 AMP (`env`, une page)

A ATK (0 ou 1 ms a 0,5 s), B HOLD (4 ms a ~1 s), C DEC (`decay`, constante 12 ms a ~0,7 s, 1 = la queue entiere), D START (debut du coup dans son tampon, 0 a 90 %), E PAN (-1 a 1), F G H dessin AMP ENV (AHD sur 3 cases). VOL est sur SRC.
Ecart DT2 : AMP DT2 = ATK HOLD DEC SUS REL RSET MODE (AHD/ADSR) PAN VOL. MM n'a ni SUS, ni REL, ni MODE, ni RSET ; VOL est sur SRC ; START est ici (sur la DT2, STRT est sur SRC).

### 3.5 FX (VOICE FX, une page)

4 grands blocs hauts, verrouillables, la voix en etiquette : DIST (insert de la tranche), CHORUS (insert), DELAY (envoi), REVERB (envoi). Les verrous DIST/CHORUS/DELAY/REVERB valent jusqu'au coup suivant de la voix. Une tape sur un bloc ouvre la page de ce FX sous la voix (`fxvdist fxvchorus fxvdelay fxvreverb`) : l'envoi de la voix en grand, les reglages de la machine a cote (ALL), deux onglets GLOBAL / voix.
Ecart DT2 : FX DT2 = BR (bit reduction), OVER (overdrive), SRR, ROUT (SRR avant/apres filtre), DEL, REV, CHR (envois), OD.RT. MM : pas de BR, SRR ni ROUT par voix ; un chorus en insert au lieu d'un envoi.

### 3.6 SEND FX (FUNC + FX ; l'ancien GLOBAL FX, `fxg`)

A DIST (toute la sortie, kick compris), B CHORUS, C DELAY, D REVERB (sans le kick : NO BD), E STRETCH (time-stretch facon Impulse, durees x 4^v), F SWING, G BIT, H COMP. Jamais verrouilles. Une tape (ou le MIDI `rytm:screen:fx...`) ouvre la page du FX :
- DIST : DIST (2x2) + TONE (passe-bas) ;
- CHORUS : CHORUS + RATE + DEPTH ;
- DELAY : DELAY + TIME (divisions, croche pointee au depart) + FEEDBACK + TONE ;
- REVERB : REVERB + SIZE + TONE + PRE (pre-delay) ;
- BIT : BIT + RATE ;
- COMP : COMP (MIX, aiguille de reduction) + THRESH + RATIO + ATTACK + RELEASE (AUTO) + MAKEUP (AUTO) + HPF de la chaine laterale (OFF, 60, 120) + KNEE (desktop, case H).
Ecart DT2 : SEND FX DT2 = DELAY (TIME, X ping-pong, WID, FDBK, HPF, LPF, REV, VOL), REVERB (PRE, DEC, FREQ, GAIN, HPF, LPF, VOL), CHORUS (DEP, SPD, HPF, WID, DEL, REV, VOL) ; le compresseur est sur le MIXER. Ici SWING, STRETCH, BIT, COMP et DIST master sont dans SEND FX.

### 3.7 MOD (2 onglets, `audio/lfo.ts`)

MOD 1/2 = LFO 1, MOD 2/2 = LFO 2 : A SPD (-64 a 63, depart 32), B MULT (1, 2, 4, 8, 16, 32, 64, 128), C FADE (-64 a 63), D DEST (OFF, PITCH, FREQ, RESO, VOL, PAN, DIST, DELAY, REVERB, TONE, DECAY), E WAVE (TRI, SINE, SQR, SAW, EXP, RMP, RND), F PHAS (0 a 127), G MODE (FRE, TRG, HLD, ONE, HLF), H DEP (-64 a 63, 0 = rien, depart 0).
Un cycle = 128 / (|SPD| x MULT) pas, en temps musical depuis PLAY. En continu sur le coup qui sonne (rampes d'AudioParam, 24 points par cycle, 512 au plus, 8 s au plus) pour PITCH (+/-12 demi-tons a DEP 64), FREQ (+/-5 octaves), RESO, VOL, PAN ; pris au moment du coup pour DIST, DELAY, REVERB, TONE, DECAY. Reglages de la voix (presets, UNDO), verrouillables (`l1spd ... l2dep`), **hors des scenes** (`noscene`). Dessin de la forme d'onde.
Ecart DT2 : 3 LFO (MOD 1, 2, 3) sur la DT2, PHAS s'appelle SPH ; les destinations DT2 couvrent tous les parametres des pages.

### 3.8 TEMPO (FUNC + TRIG)

A BPM (100 a 150, entier ; SYNC du MIXER avec les platines), B SWING (50 % a ~67 %, triolet). YES sur cette page = TAP (moyenne apres 4 tapes, remise a zero apres 2 s, bornee 100 a 150).
Ecart DT2 : BPM 30 a 300 au 1/10, global ou par pattern, SWING 50 a 80 %, metronome (TEMPO + YES), nudge par LEFT/RIGHT, FUNC + TEMPO = TAP. MM : tempo global seulement, pas de metronome, pas de nudge.

### 3.9 MIXER (FUNC + MOD)

1/2 LEVELS : A a H = VOL de BD SD CH OH CP TOM HT CY (`m:<voix>` sur `rytm:voice:<voix>:level`). 2/2 MASTER (l'ecran `fxm`) : A MASTER (sortie de la machine), B TEMPO. MOD rappuye = onglet suivant. Le MIXER s'arme pour YES (niveaux au hasard) et NO (recharges).
Ecart DT2 : MIXER DT2 = 1 compresseur, 2 et 3 niveaux des 16 pistes, 4 FX MIXER (DEL, REV, CHR, MOVD), 5 entrees externes (a laisser tomber).

### 3.10 HOME et l'ecran sans page

La touche de page allumee rappuyee (ou H) : HOME, l'ecran OP-1 d'origine (l'anneau des 16 pas de la voix, la voix et son son en grand, lecture, pattern, tempo, trois reglages dessines). Menu de la voix sous HOME : SOUND, SRC, FLTR, AMP, FX. Pas Digitakt (la DT2 n'a pas de HOME).

### 3.11 SOUNDS (FUNC + SRC) : la liste des sons

Liste plein ecran des sons de la voix (OFF, 909, 808, MM, samples du site, samples a soi), curseur au potard ou haut/bas, pre-ecoute a l'arret, `+ LOAD A FILE...`, glisser-deposer d'un fichier (wav, aif, mp3, flac, m4a, 10 Mo, 60 par famille, gardes dans le navigateur : IndexedDB `mm-v4-rytm-user`), retrait d'un son a soi (Suppr deux fois). Pas un enregistrement : c'est le chargement d'un fichier, a garder sauf avis contraire de Mika.

### 3.12 KIT (PTN deux fois, ou P) : les presets de la machine

- Liste : 10 presets d'usine (ACID, DARK DISCO, INDIE DANCE, MINIMAL, ROLLING, TECHNO, HOUSE, ELECTRO, EBM, ITALO, `state/factory.ts`), puis ceux de Mika (99 au plus, localStorage, noms tires au hasard facon Reddit), et YOUR SOUND (3 brouillons au plus, le son du moment mis de cote avant d'etre remplace).
- Touches de l'ecran : SRC = LOAD, FLTR = SAVE, AMP = NAME, FX = DEL, PTN = EXIT ; YES valide (LOAD, OK, OVERWRITE, YES) ; NO revient en arriere ; un potard fait defiler ; A lettre, B curseur du nom. Une etape d'UNDO par chargement (une seule pour une suite de PREV/NEXT).
- Contenu d'un preset MM-RYTM : le pattern courant (pas, velocites, verrous, scenes, mute du pattern, reglages de trig), le BPM, les FX globaux, STRETCH, les reglages de chaque voix (avec les LFO), le kit (sons, machines, samples, couches, potards de machine). MASTER n'y est pas.
Ecart DT2 : sur la DT2 un **preset** = le son d'UNE piste (sample + SRC FLTR AMP FX MOD), un **kit** = 16 presets + niveaux + compresseur + send FX, et le pattern contient son kit. Ici "KIT" = toute la machine plus le pattern courant ; il n'y a ni preset de piste, ni preset lock (seul le `snd` "sample lock" existe), ni PRESET POOL.

---

## 4. Le moteur son (ce que sont les "pistes" aujourd'hui)

- **8 voix fixes** (`theme.ts Inst = 'BD' | 'SD' | 'TOM' | 'CH' | 'OH' | 'CP' | 'HT' | 'CY'`, ordre des pads BD SD CH OH CP TOM HT CY, `audio/pattern.ts INSTRUMENTS`). Une famille de sons par voix (bd, sd, ch, oh, cp, tom, ht, cy). La liste `['BD','SD','CH','OH','CP','TOM','HT','CY']` est en dur dans 12 fichiers (sceneParams, infoIds, pages, faceplate, roto, trig, beatcode, pattern, voicefx, locks, morph, rytmPage) ; `STEP_COUNT` 16 dans 13 fichiers.
- **Sons** : par famille, 3 synthese (909, 808, MM ; `audio/shotsdsp.ts`, calcul des coups en worker `shots.worker.ts`) et les samples du site `public/samples/rytm/<famille>/` (34 en tout : bd 12, sd 11, ch 3, cy 3, ht 2, oh 1, cp 1, tom 1 ; liste par le plugin vite `virtual:rytm-samples`), plus les samples a soi. Depart : BD, SD et OH sur leur premier sample (synthese a 0), les autres sur leur synthese. Une voix ne choisit que dans **sa famille** ; seul un verrou `snd` par pas peut emprunter le son d'une autre famille (il joue seul sur ce pas). C'est le principal frein aux "16 pistes libres".
- **Reglages de voix** (`audio/voicefx.ts`) : tone, decay, level, dist, reverb, delay, chorus, tune, pan, start, atk, hold, fine, ftype, fcut, freso, fenv, fatk, fdec + les 16 des LFO ; gardes dans le navigateur.
- **Kit** (`audio/kit.ts`) : par famille le modele, le sample, la couche (syn, lev, tune, fine, start, len, rev) ; potards de machine globaux (tune attack decay drive snappy gate sweep sdtune sddecay sdtone, ceux de la plaque TWEAKS). KIT_V 4.
- **Graphe** (`audio/drums.ts`) : voix -> tranche (LEVEL, TONE, DIST, CHORUS, envois REVERB et DELAY, `audio/sends.ts`) -> bus -> DIST global -> TONE -> CHORUS -> LEVEL -> compresseur COMP (`glue.worklet.js`) -> BIT -> limiteur -> master. Le **BD a son bus a part** (`kickBus` : pas de CHORUS, DELAY, REVERB globaux), **kick monophonique**, **choke** CH/OH (8 ms, facon 808). Le kick pilote le **sidechain** du MM-ARP (`audio/duck.ts`). L'analyseur est avant le master (`?mute=1` mesurable sans son).
- **Velocite** : 10 crans 0 (vide) a 9 (`VEL_GAIN` 0, 0.16 ... 1), noms OFF, VEL 1..8, LOW (3), MID (6), HIGH (9), montree en 0 a 127 (`velTo127`). Ecart DT2 : 1 a 127.
- **Horloge** (`audio/clock.ts`) : lookahead 300 ms (450 au telephone), `seqStep` commun au direct et a `renderOffline`, pause/resume au pas, `onBar` pour les chaines, `onUnbar` (pause juste avant une mesure annoncee), compteur de passages, `cutTails`. L'horloge du MM-RYTM sert de grille au MM-ARP, au MM-BASS et au SYNC des platines (MM-DECKS).
- Pas de MIDI OUT ni de pistes MIDI sur la MM-RYTM (seul le MM-ARP envoie notes et horloge, `midi/noteout.ts`). MIDI IN : tout parametre apprenable (panneau MIDI, Roto-Control).

---

## 5. Le sequenceur

### 5.1 Structure
- 16 pas par voix (`STEP_COUNT`), une mesure. **Pas de longueur de pattern, pas de pages 1 a 4/8, pas de longueur ni de vitesse par piste** (SETUP prevu V.5.4, pas fait). Ecart DT2 : jusqu'a 128 pas (8 pages), longueur et echelle par pattern ou par piste, signature.
- Pattern courant (`audio/pattern.ts`, cle `mm.v4.pattern.3`) : `steps` (chaine de 16 chiffres par voix), `locks`, `scenes`, `pmutes`, `trigs`, `bpm`, `fx`.
- **128 emplacements** (`state/patterns.ts`, cle `mm.v4.patterns.1`, `PATTERN_SLOTS` 128 = 8 banques x 16, `slotName` A01 a H16). Chaque emplacement garde : pas, verrous, scenes A/B, mute du pattern, reglages de trig par defaut. **Il ne garde ni les sons, ni les reglages de voix, ni les FX, ni le tempo** : ceux-la sont globaux a la machine (ecart majeur DT2 : le pattern DT2 contient son kit, son BPM, sa longueur, son swing).
- Banque affichee (`bank`, jamais retenue) ; une sauvegarde de 16 emplacements se relit en banque A.

### 5.2 Ecriture
- Grid rec (REC) : section 2.3. LIVE REC : V.5.3 sur la branche, section 9. **Step rec (REC + STOP) : pas fait.**
- Lock trig (trigless) : `ltrg = 1` sur un pas sans velocite ; ne joue pas ; ses verrous vont au coup de la voix qui sonne encore pour VOL, PAN, FREQ, RESO, DELAY, REVERB, DIST, CHORUS (`setTargetAtTime` 1 ms, repli sans `cancelAndHoldAtTime` pour Firefox) ; relance les LFO si LFO.T ON ; une velocite le transforme en note.
- Velocite : glisser sur un pas tenu (REC), VEL de TRIG, potard VEL en P-LOCK.

### 5.3 P-LOCKS (`audio/locks.ts`, `state/rytmLock.ts`)
- Cles : level, decay, tune, pan, start ; machine ktune kattack kdecay kdrive snappy gate ksweep sdtune sddecay sdtone ; couches syn slev stune sfine sstart slen srev ; delay reverb ; voix atk hold fine ftype fcut freso fenv fatk fdec tone dist chorus ; sequenceur len prob cond utime lfot rtrg rate vfad rlen + l1spd..l2dep + ltrg ; `snd` (son, "sample lock" de n'importe quelle famille, ou `<famille>:off`) ; `mach` (909/808/mm). Forme `LOCKS_V 3`, par voix, par pas '0' a '15'.
- Un pas vide garde ses verrous ; CLEAR les efface. Panneau des verrous a l'ecran (toutes pages), point sur les onglets des pages qui en portent, trait sous les pas verrouilles.
- Ecart DT2 : preset lock (LEVEL/DATA) et "TRIG + PAGE/TRK + potard = verrou sur tous les trigs d'une page" absents ; "TRIG + YES = pre-ecoute du trig" absent.

### 5.4 Le moteur des trigs (`audio/seq.ts`, `audio/seqhit.ts`)
COND avant PROB ; μTIME n/24 de pas (un negatif sur le pas 1 tombe a la fin de la mesure d'avant ; le tout premier pas apres PLAY part tout de suite) ; LEN (8 ms) ; RTRG mono (une repetition coupe la precedente en 8 ms, s'arrete au trig suivant qui joue, a la fin de RLEN ou au mute ; limite connue : ne s'arrete pas au trig suivant a μTIME negatif) ; ordre des coups d'un pas par le temps puis les pads ; chokes et kick mono gardes ; erreurs de programmation rattrapees (`clockDebug.seqErrors`).

### 5.5 FILL
YES tenu > 250 ms (souris, doigt, Entree), `rytm:fill` (tenue), boitier a confirmer (note 72). Re-programme les pas a venir. Pastille FILL dans l'en-tete (PAGE, HOME, P-LOCK, scene armee). Ecart DT2 : FILL est sur la touche PAGE (tenue = momentane, YES + PAGE = un cycle).

### 5.6 Patterns, banques, chaines
- Choix : grille PTN, `rytm:ptn:0-15` (pattern k de la banque affichee), `rytm:bank:0-7` ; a l'arret tout de suite, en lecture a la fin de la mesure.
- Chaine : patterns tapes en 2 s (`CHAIN_MS`), 64 au plus, banques melangees, une mesure chacun, en boucle ; ligne d'ecran `CHAIN 01>03` (banque A) ou `CHAIN A02>C05`.
- Copie : tenir un emplacement vide de la grille = copie du pattern courant ; FUNC + REC / FUNC + STOP (section 2.2).
- La grille PTN du desktop est un **editeur HTML pose sur les pas** (`ui/BeatEditor.tsx`) : rangee des 16 patterns en tete, puis les 8 voix x 16 pas (taper pose/enleve, glisser pose une rangee, tenir + glisser = velocite, rangee VELOCITY, CLEAR de la voix, DONE), points des verrous, couleurs DT. Cache pendant la vue BANK. Pas Digitakt (la DT2 n'a que les touches de trig).
- Ecart DT2 : pas de SONG mode (16 songs), pas de PTN + LEFT/RIGHT, pas de copie/collage/effacement de pattern depuis le mode PTN (TRIG + REC/STOP/PLAY), pas de changement de pattern "direct start/jump/temp".

### 5.7 CONTROL ALL (V.5.2)
TRK tenue ou gardee + potard d'une page de voix (TRIG, SRC, FLTR, AMP, FX, MOD) : les 8 voix prennent **la valeur de la voix choisie** (le manuel DT1 ne dit pas si c'est un ecart ou une valeur ; changement en une ligne : `ctlAllApply`). Concerne les reglages de voix, les defauts de trig et les LFO ; pas le choix du son, MIX, les potards de machine, VEL. NO (ou Echap) tant que TRK est allumee = tout annule. Une seule etape d'UNDO (`undo.hold`). En-tete `CONTROL ALL · NO: UNDO`. Un pas tenu gagne ; une scene armee prend la valeur comme avant ; un changement de pattern le termine. MIDI : `rytm:trk` tenu + potard.

### 5.8 Mutes
- **Global** (`state/voices.ts`, jamais retenu) : FUNC + TRK (vert), FUNC + pas 1 a 8 (mute rapide, partout hors REC), TRK + double tape ou clic droit, `rytm:pad`, Roto (bouton a bascule par voix).
- **Du pattern** (`pmutes`, retenu avec l'emplacement, les presets, l'UNDO, le lien SHARE drapeau 32) : FUNC + TRK deux fois (magenta). Une voix est coupee si l'un des deux jeux la coupe ; le solo passe avant. Desktop seulement (le telephone joue comme si rien).
- **SOLO** (pas Digitakt) : tenue 400 ms d'un pas en mode MUTE ; aussi l'ancien SOLO (Maj + M, `rytm:solo`).
- **Ancien MUTE** (pas Digitakt) : M au clavier, `rytm:mute` : machine a trois etats ONE / MULTI / OFF, tenu 600 ms = toutes les voix reviennent.
- Ecart DT2 : en mode MUTE, FUNC tenu + trigs "prepare" les mutes, relacher FUNC les applique ; pas de solo sur la DT2.

### 5.9 CLEAR, RANDOM, UNDO, SAVE/RELOAD
- **CLEAR du pattern** (FUNC + PLAY hors REC, `rytm:clear`) : tous les pas, les scenes A/B, les FX globaux remis a 0 (DIST CHORUS DELAY REVERB SWING BIT COMP, STRETCH au centre), chaque voix remise au neutre (`voiceFx.reset`), les potards de machine au depart, une voix muette retrouve un son ; le son choisi reste ; les reglages de trig au depart. Plus que la DT2 (qui n'efface que les trigs du pattern).
- **RANDOM du beat** (TRIG puis YES, `rytm:random`) : un style (HOUSE, DEEP HOUSE, TECH HOUSE, TECHNO, MINIMAL, INDIE DANCE, DARK DISCO, ITALO, PROG, ELECTRO ; `audio/beats.ts`) et son motif sur toutes les voix, le SWING du style, TONE/LEVEL/DECAY/PAN de chaque voix, le son de chaque voix (samples 75 %, kick 85 %) ; remet les reglages de trig au depart, garde les verrous. **Pas Digitakt.**
- **Page au hasard** (touche de page puis YES) : les reglages de la voix choisie de la page dans des bornes musicales (`RANDOM_SPAN`) ; SRC tire aussi le son ; MOD le LFO affiche ; SEND FX, TEMPO, MIXER les leurs. **Digitakt** ([PARAMETER] + [YES]).
- **Page rechargee** (touche de page puis NO) : depuis le point de sauvegarde. **Digitakt** ([PARAMETER] + [NO]). Ecart : la DT2 recharge "le dernier etat sauve", ici le point FUNC + YES du meme pattern.
- **SAVE/RELOAD** (FUNC + YES / FUNC + NO) : **Digitakt** (sauvegarde et rechargement temporaires du pattern) ; ici le point est en memoire, lie a son emplacement, contient tout l'etat de la machine (comme l'UNDO).
- **UNDO / REDO** (`state/undo.ts`) : Cmd+Z, Maj+Cmd+Z, Ctrl+Y, bouton de l'en-tete ; une histoire pour MM-RYTM, MM-ARP, MM-BASS ; rafales (600 ms sans geste, 2 s au plus) ; RANDOM, CLEAR, PASTE, RELOAD, un preset charge font chacun leur etape ; 50 etapes en memoire, 20 retenues (`mm.v4.undo.1`, 1,5 Mo). **Pas Digitakt** (la DT2 n'annule que copier/coller/effacer en repetant la combinaison, et l'enregistrement en direct).
- **Pas fait** : "PARAMETER + PLAY = page aux valeurs par defaut" (reference DT), copier/coller/effacer de page de sequence, de trigs, de page de parametres (DT2 : PAGE / TRIG / PARAMETER + REC/STOP/PLAY), decalage de tous les trigs (FUNC + LEFT/RIGHT).

### 5.10 SHARE (pas Digitakt, a garder : c'est la diffusion du site)
Lien `?m=rytm&b=<code>` (`audio/beatcode.ts` v1, `state/share.ts`) : pas et velocites des 8 voix, tempo, FX globaux, STRETCH, son de chaque voix, potards du kit, reglages des voix, mute du pattern. **Ne porte pas** : P-LOCKS, reglages de trig, LFO, scenes, samples a soi (beatcode v2 reportee). Bouton SHARE dans l'en-tete ; navigator.share au telephone.

---

## 6. Ce qui n'est pas Digitakt : a retirer ou a garder (a trancher avec Mika)

1. **SCENE A, SCENE B et le crossfader** (V.4.1, Octatrack) : une scene = jeu creux de 64 valeurs au plus (`rytm/sceneData.ts`, ids MIDI absolus), morph lineaire `a + (b - a) x`, armee en tenant ou tapant SCENE puis en tournant ; gardees par emplacement, presets, UNDO ; hors scenes : le choix des sons, les TWEAKS et couches, les LFO et reglages de trig, TEMPO, MASTER, les mutes. 3 hotspots (`scene-a`, `xfade`, `scene-b`), CC 28 et notes 79/80 du boitier, `rytm:scene:a|b`, `rytm:xfade`. **La DT2 n'a pas de scenes** : soit les retirer (gagne la place des fleches, de PAGE, de LEVEL/DATA), soit les garder comme ajout MM (Mika a valide le boitier physique avec elles).
2. **RANDOM du beat entier** (TRIG puis YES) : non Digitakt (la DT2 ferait "TRIG page au hasard"). La page au hasard (les autres pages + YES) est Digitakt. A decider : garder RANDOM ailleurs (une combinaison libre) ou le retirer.
3. **UNDO / REDO** (Cmd+Z, bouton) : non Digitakt, mais demande de Mika ("j'ai tout perdu"). A garder hors de la face (raccourci et en-tete).
4. **OPEN (le logo M)** : le capot s'ouvre sur le PCB (vue eclatee `state/explode.ts`) : la plaque TWEAKS (KICK TUNE ATTACK DECAY DRIVE, SNARE SNAPPY GATE ; `scene/rytmTweaks.ts`, `scene/tweakplate.ts`) et les puces de navigation du site (TRACKS, MIXTAPES, SHOWS, PRESS, CONTACT, GOODIES, MERCH, STUDIO). Identite du site : a garder. Les TWEAKS font double emploi avec SRC SYNTH (potards de machine).
5. **INFOS et le `i` de l'ecran** (`state/rytmInfos.ts`, `rytm/infos.ts`, `rytm/infoIds.ts`, `rytm/diagrams.ts`, `rytm/InfosCard.tsx`) : aide au survol, une carte par touche, pas, potard, parametre (TRIG, COND, RTRG, lock trig, FILL, LFO, BANK, CONTROL ALL, LIVE REC...), en francais, tutoiement ; I au clavier, `rytm:infos`. A garder (c'est le mode d'emploi), a refaire pour 16 pistes.
6. **HOME** (l'ecran OP-1, le menu de la voix) : pas Digitakt ; la DT2 montre toujours la page.
7. **KIT par PTN deux fois** : la DT2 a une touche PRESET/KIT. Le "KIT" MM = preset de toute la machine (section 3.12).
8. **La grille PTN en HTML** (BeatEditor) posee sur les pas : editeur de motif complet, pas Digitakt.
9. **SOLO** et l'ancien MUTE a trois etats (M, Maj + M, `rytm:mute`, `rytm:solo`), la double tape/clic droit de mute sur TRK : pas Digitakt.
10. **SWING, STRETCH, BIT, COMP, DIST master dans SEND FX** et **MASTER + TEMPO sur MIXER 2/2** : rangement MM, pas DT2.
11. **NOTE = TUNE en demi-tons de la voix** (pas de mode KEYBOARD/chromatique), **VEL a 9 niveaux**, **BPM 100 a 150** (bornes MM, `BPM` de `audio/pattern.ts`), **SWING jusqu'a ~67 %** : choix MM a revoir pour la DT2 (30 a 300 BPM, 1 a 127, 50 a 80 %).
12. **Les pas 1 a 8 nommes BD..CY** (serigraphie) et les voix fixes : incompatibles avec 16 pistes libres.
13. **Le telephone** : une autre machine (section 8).
14. **Les messages de place perimes** : `SETUP (TRACK LENGTH): V.5.2`, `EUCLID: V.5.3`, `PAGES 1-4: V.5.2` (FUNC + FLTR, FUNC + AMP, FUNC + pas 13 a 16).

---

## 7. MIDI, Roto-Control, boitier

- **MIDI IN** (`midi/midi.ts`, `midi/targets.ts`) : 892 cibles en V.5.3, dont 656 `rytm:*` : `rytm:voice` 368 (par voix : level, decay, tone, dist, reverb, delay, chorus, tune, pan, start, atk, hold, fine, f*, les 9 reglages de trig, les 16 des LFO, select...), `rytm:layer` 72, `rytm:enc` 47 (MASTER, TEMPO, SWING, STRETCH, FX globaux et leurs reglages, la rangee de la voix choisie), `rytm:screen` 24, `rytm:seq` 18 (RSEQ), `rytm:kit` 18 (TWEAKS et familles), `rytm:lock` 17, `rytm:step` 16, `rytm:ptn` 16, `rytm:page` 10, `rytm:pad` 8, `rytm:knob` 8, `rytm:bank` 8, plus les touches. Reference generee par `npm run docs:midi` (`docs/midi/MIDI-targets.csv`, `MIDI-roto-reference.md`, `MIDI-roto-setups.csv`). Le champ scene de chaque cible (sceneable, resolved, passthrough, noscene).
- **Roto-Control** (`midi/roto.ts`, `midi/rotoKeys.ts`, `midi/seqlink.ts`) : setups automatiques (couleurs, noms, 0-127) ; RSEQ = 8 boutons de pas sur une fenetre 1-8 / 9-16 (STEPS 9-16, STEP FOLLOW), tenir + tourner = P-LOCK, voix BD..CY (8 boutons), vue PTN (`PTN 01` a `PTN 08`) et BANK. Ecrit toujours (pas soumis a REC).
- **Boitier MMHW v2** (`hw/index.ts`, `hw/snapshot.ts`, `hw/rowLeds.ts`, `hw/motor.ts`, `docs/hardware/mmhw-v2-app-side.md`) : le controleur physique de Mika (pas du materiel Digitakt) ; instantane des LED (14 touches, mode MUTE, PTN, BANK, lock trigs, FILL, LIVE REC), potards motorises qui suivent la valeur, toucher des potards ; notes a confirmer avec `protocol.js` (dossier `hardware/mm-rytm-hw/` pas encore pousse). `npm run hw:test` (17 + 11 tests en V.5.3). A garder : c'est le projet de machine reelle de Mika ; la refonte 16 pistes change ses LED de pas et ses notes.

---

## 8. Le telephone (`PORTRAIT`, inchange depuis V.4.x)

- Face portrait sans potards, ecran plus grand et **tactile** (glisser une valeur, deux tapes = depart, P-LOCK a deux doigts), 4 touches de page sous l'ecran : **VOICE, FLTR, ENV, FX** (`RYTM_PAGE_KEYS`, `scene/rytmPageKeys.ts`) ; FX a deux onglets VOICE FX puis GLOBAL FX ; pas de TRIG, MOD, TEMPO, SEND FX, MIXER, FUNC, REC, BANK, CONTROL ALL, mute du pattern.
- Dock sous la machine (`ui/Dock.tsx`) : voix (RANDOM, voix), 16 pas en 2 x 8 (une tape cycle vide/fort/moyen/doux, appui long = P-LOCK), transport RUN/STOP, CLEAR, MUTE, SOLO, tempo - / + ; page KNOBS (`ui/KnobPanel.tsx`) ; INFOS ; grille des 16 patterns de la banque du pattern courant (`BeatEditor`).
- Il **joue** tout ce que contient un pattern (conditions, retrig, LFO, lock trigs), sauf le mute du pattern.

---

## 9. Travail en cours : LIVE REC (V.5.3, branche `worktree-agent-a3f84c671ac17ce70`, pas revu, pas pousse)

D'apres le rapport du builder (`docs/reports/2026-10-30-rytm-v53-digitakt-d3b.md` sur la branche) et `git diff --stat` (22 fichiers, +559 / -38 : `actions.ts` +253, `audio/clock.ts`, `hooks/useKeys.ts`, `ui/Hotspots.tsx`, `scene/screen.ts`, `scene/rytmFaceKeys.ts`, `state/dtFace.ts` `live`, `state/undo.ts`, `state/ctl.ts`, `midi/midi.ts`, `midi/targets.ts`, `hw/rowLeds.ts`, `hw/snapshot.ts`, `rytm/infos.ts`, `rytm/infoIds.ts`, `debug.ts`, `firmware.json`, `scripts/hw-leds.test.mjs`) :
- Entrer : ● tenue + ▶ (W tenue + Espace), ● deux fois vite a la souris (`PAD_DOUBLE_TAP_MS`), `rytm:liverec` ; a l'arret LIVE REC s'arme, ▶ lance. Sortir (comme le manuel DT1, ecarts au cahier) : ▶ en lecture (la lecture continue), ● (retour au grid rec), ■ (tout s'arrete).
- Frappes : pas 1 a 8, A S D F Z X C V, pads MIDI : la voix joue et s'ecrit au pas le plus proche de l'heure entendue (`currentTime - outputLatency - baseLatency`), velocite MIDI (`state/ctl.ts pressVel`) ou HIGH ; **toujours quantifie, sans μTIME** ; pas de double coup (`clock.nearestAt`, `skipHit`, `StepEvent.abs`).
- Potards d'une page de voix en lecture : reglent la voix et ecrivent des P-LOCKS sur le pas entendu puis chaque pas traverse (220 ms apres le dernier mouvement, ou tant qu'on tient) ; un pas vide recoit un lock trig (comme le manuel) ; TRK tenue (CONTROL ALL) gagne.
- Effacer : NO tenue (Echap tenue, un doigt sur NO) + pad = efface la voix au fil de la tete ; pas au MIDI (`rytm:no` est un appui), pas a la souris.
- UNDO : une prise = une etape (`undo.hold` devient un compte). LED ● clignotante (face et boitier), pastille LIVE REC, carte INFOS. Firmware V.5.3, `docs/midi` 892 cibles. Verification du builder : tsc 13 erreurs connues, build, smoke 6 pages, hw:test 17 + 11, presets:test, identite audio 1,2e-7, sonde `lr.cjs` 9 sur 9, telephone identique.
- Restent ouverts (rapport) : quantification facultative (frappes en μTIME, RECORD + PLAY deux fois sur la DT), NO tenue au MIDI, la latence estimee par le navigateur. A decider : revoir/pousser V.5.3 avant la refonte, ou en reprendre le code dans la refonte.

---

## 10. Recapitulatif rapide pour le cahier de refonte

Deja fait et conforme a la DT2 (a reprendre tel quel, en l'etendant a 16 pistes) : FUNC et ses regles a la souris ; TRK + pas ; PTN + pas, BANK (FUNC + PTN), 8 banques x 16, chaines ; grid rec, lock trigs (FUNC + pas en REC), P-LOCK (pas tenu + potard), double tape = retrait du verrou ; PLAY/pause, STOP (deux fois coupe les queues) ; COPY/PASTE/CLEAR du pattern et de la piste ; FUNC + YES/NO (temporaire) ; page + YES/NO (hasard, recharge) ; TRIG 1/2 et 2/2 (moins FLT.T, FILL a part, portamento) ; 81 conditions, PROB, μTIME, LEN, RTRG/RATE/VFAD/RLEN ; FILL ; 2 LFO complets ; SEND FX ; MIXER ; TEMPO + TAP ; mutes global, pattern, rapide ; CONTROL ALL avec NO ; quick mute ; couleurs DT ; LIVE REC (branche).

Fait mais different de la DT2 (a remettre au format DT2) : TEMPO sur FUNC + TRIG (DT2 : touche TEMPO, FUNC + TRIG = QUANTIZE) ; SOUNDS sur FUNC + SRC (DT2 : MACHINE) ; FILL sur YES tenu (DT2 : PAGE) ; μTIME en potard (DT2 : TRIG + LEFT/RIGHT) ; KIT par PTN 2X ; AMP sans SUS/REL/MODE ; FLTR multimode simple ; FX voix sans BR/SRR/OVER ; VOL sur SRC ; preset = toute la machine ; sons, FX et tempo globaux (pas dans le pattern) ; 8 voix fixes a famille ; 16 pas ; velocite 9 niveaux ; BPM 100-150 ; swing 50-67 %.

Pas fait du tout (DT2 hors sampling) : 16 pistes, PAGE + LED de page, longueur de pattern 2 a 128 pas et par piste, vitesse (scale), fleches (μTIME, nudge, decalage des trigs, navigation), LEVEL/DATA, preset de piste, PRESET POOL, preset lock, PRESET/KIT et PERFORM KIT, SETTINGS (projets), SONG mode, KEYBOARD (chromatique, gammes), QUANTIZE, step rec, euclidien (SEQUENCER), SETUP/PAGE SETUP, 3e LFO, FLT.T, portamento, copier/coller de trigs, de page, de page de parametres, PARAMETER + PLAY (defaut), metronome, tempo par pattern, MIDI tracks/out (a confirmer : la consigne exclut le materiel).
