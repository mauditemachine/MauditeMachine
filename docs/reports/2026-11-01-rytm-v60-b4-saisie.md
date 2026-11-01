# MM-RYTM V.6.0, lane B4 : la saisie et les touches de la face Digitakt II (FIRMWARE V.5.9, inchange)

2026-11-01. Le cahier : `docs/v4/dt2/dt2-master-spec.md` (1.4, 2.6, 2.7, 3.1, 3.3, 3.4, 5.1, 5.5, 5.6, la critique). Point de depart : `rel/v6.0` (2c2e22a : P0, V.5.9, B3, le contrat `onInput`). Branche `v60/b4-input`, rien de pousse, `main` pas touche.

Tout le comportement nouveau vit derriere le drapeau `DT2_FACE` (`?face=dt2`, au desktop). Sans lui, la face, le clavier, le MIDI et le telephone restent ceux de la V.5.3 et de la V.5.9 (verifie : sonde sans drapeau, identite audio, smoke).

## 1. Ce qui a ete fait

- **`state/gesture.ts`** : le contrat P0 implemente. Tenue, gardee (1,5 s apres une tape), verrouillee (FUNC, deux tapes) ; un TRIG ne se garde qu'apres 350 ms, SETTINGS apres 1 s ; l'ordre d'engagement (`before`) ; `use`, `cancel`, `releaseAll`. FUNC et TRK gardent leurs stores (`state/func.ts`, `state/trk.ts`) : la couche les lit et leur passe les gestes (la face 3D, le boitier et les sondes n'ont rien a changer). Sans le drapeau, la couche n'ecoute rien.
- **`state/dtFace.ts`** : la forme etendue du contrat (`menu`, `keyboard`, `song`, `ptnPage`) et ses setters ; a cote, le dernier mode de MUTE (`lastMute`) et `personal()` (LED INTENSITY, LED BACKLIGHT, TRK SELECT).
- **`state/fill.ts`** : FILL a trois gestes (tenu, un cycle arme puis joue une mesure, verrouille) et `mode` pour la LED de PAGE.
- **`state/trk.ts`** : `activeTrack`, la piste active sur 16 (1 a 8 : la voix du motif ; 9 a 16 : a cote, le motif sans voix choisie).
- **`state/editor.ts`** : `grid()` et `setGrid()` (EDIT GRID).
- **La table des accords** (`actions/chords/chords60.ts`, 238 entrees) et le repartiteur (`actions/internal/keys60.ts`, nouveau) : le premier accord dont les modificateurs sont engages dans l'ordre et le contexte vrai gagne ; chaque entree a ses chemins souris, toucher, clavier et son id INFOS. Une FUNC gardee pour une touche s'en va avec l'accord suivant (la regle G2 de la V.5.0).
- **Les touches** (`actions/face.ts`, `steps.ts`, `tracks.ts`, `live.ts`, `nav.ts`, `internal/face.ts`) : une entree pour les 25 touches (`faceKeyDown`, `faceKeyUp`, `faceKeyTap`), `dataTurn`, `mainVolumeTurn`, `editGridToggle`, `trackSelect`, `trackMute`, `dt2FaceSync`. Les fonctions d'avant (`playKey`, `stopKey`, `recKey`, `yesKey`, `yesDown`, `noKey`, `noDown`, `stepToggle`, `trkDown`, `copyKey`, `pasteKey`) passent par la table en DT2 ; leurs corps d'avant sont exportes (`playBody`, `stopBody`, `recBody`, `noBody`, `yesTap`, `clearKey`).
  - FUNC + TRK : le mode MUTE, le dernier retenu ; FUNC + TRIG 1-16 : le QUICK MUTE (16 pistes) ; en GRID REC, le lock trig.
  - TRK + TRIG 1-16 : la piste active ; TRK + REC / STOP / PLAY : copier, coller, effacer le son de la piste.
  - PTN sur les TRIG (la grille HTML seulement en EDIT GRID), PTN + LEFT / RIGHT : la banque ; FUNC + PTN : la vue BANK sur TRIG 9-16 ; un pattern tenu + REC / STOP / PLAY : copier, coller, effacer ce pattern.
  - GRID REC et LIVE REC sur 16 pistes ; hors REC, TRIG n joue la piste n et la choisit (TRK SELECT auto).
  - PAGE : FILL tenu, YES puis PAGE (un cycle), PAGE puis YES (verrou), PAGE encore (fin).
  - Les fleches : le menu ouvert, TRIG tenu + LEFT / RIGHT (uTIME), PTN + LEFT / RIGHT, UP / DOWN (sous-page).
  - TEMPO (menu), FUNC + TEMPO (TAP) ; PRESET/KIT ; SOUNDS, FUNC + SOUNDS (SAMPLES) ; SETTINGS (tape : menu ; tenue 1 s + TRIG 1-3 : LED, TRIG 9 : retroeclairage) ; FUNC + TRIG : QUANTIZE ; FUNC + SRC : MACHINE.
  - Inertes, avec BIENTOT : V.6.1 ou V.6.2 : KEYBOARD, SONG, FUNC + KEYBOARD, FUNC + SONG, FUNC + FLTR, FUNC + AMP, FUNC + PAGE, FUNC + UP / DOWN hors menu, FUNC + PRESET/KIT, FUNC + SETTINGS, FUNC + LEVEL/DATA.
  - LEVEL/DATA : le menu ouvert, sinon TRK LEV de la piste active ; son capuchon tourne avec ses crans.
  - Les indices de 1.4 : `KIT: PRESET KEY`, `TEMPO: TEMPO KEY`, `SOUNDS: SOUNDS KEY`, `FILL: HOLD PAGE`, `BANKS: TRIG 9-16`, `RANDOM BEAT: PRESET KEY`.
  - Le presse-papiers unique (`state/clipboard.ts`) pour COPY / PASTE en DT2, le son d'une piste et les patterns de la vue PTN.
- **Les menus** : ouvrir un menu = `dtFace.menu` ; les fleches, YES, NO (appui et lacher) et LEVEL/DATA vont a `screenMenu(id)?.onInput(...)` avec `func` ; NO non pris ferme le menu ; Echap aussi ; une touche de page le ferme.
- **Le pointeur** (`ui/Hotspots.tsx`) : les kinds nouveaux tenus de l'appui au lacher, LEVEL/DATA glisse (Maj fin, Ctrl ou Cmd gros pas) et a la molette, MAIN VOLUME par l'encodeur `level` d'avant, PTN et les touches de page par la table, LIVE REC et l'effacement sur 16, les LED de la saisie (`stage.faceKeys.setMenu`, `setFill`, `setBank`, `setKeyboard`, `setSong`).
- **Les jumeaux** (`ui/twins/input60.ts`, poses par `Hotspots.tsx`) : dans l'ordre de lecture de la face DT2 (l'ecran, les potards A a H, MAIN VOLUME, LEVEL/DATA, le logo M, puis `DT2_BUTTONS`, puis les 16 TRIG) ; Espace ou Entree tiennent une touche ; plus de SCENE A, crossfader, SCENE B, ni MASTER et TEMPO de l'ecran.
- **Le clavier** (`hooks/useKeys.ts`, 2.7) : A S D F Z X C V = TRIG 1-8, Maj = 9-16 ; T G N K Y U et la virgule tenues comme sur la machine ; E = PTN, Maj + E = EDIT GRID ; P = PRESET/KIT ; H = la page TRIG ; Alt + ces lettres = FUNC + la touche ; les fleches : celles de la DT2 quand un menu est ouvert, un modificateur tenu, ou avec Maj.
- **`scene/hit.ts`** : `HotspotKind` elargi aux `Dt2ZoneKind`, `dir` sur `HotspotDef` et `HotspotView`. **`rytm/faceplate.ts`** : les champs `phase` (tout en 1, sauf KEYBOARD et SONG).
- **`debug/input.ts`** : `__v4.input` (la couche, la table, `chordFor`, les journaux des accords, des menus et des indices, les entrees de la face).
- **Hors lane, le plus petit possible** (voir 3) : `state/voices.ts`, `rytm/stepLeds.ts`, `scene/renderer.ts`, `scene/sequencer3d.ts`, `ui/BeatEditor.tsx`, `state/patterns.ts`.
- `scripts/exports.golden.json` : les 17 exports nouveaux du baril `actions.ts`, ajoutes a la main (des ajouts seuls).

## 2. Decisions prises et pourquoi

- **La piste active a cote du motif** : elargir `pattern.instrument` a 16 casse environ 120 lignes de 30 fichiers des autres lanes (des tables a 8). `activeTrack` garde 1 a 8 dans le motif et vit pour 9 a 16 ; le motif n'a alors plus de voix choisie, donc aucun reglage ne part sur une voix 1 a 8 par erreur.
- **Les mutes sur 16 sans toucher au type d'avant** : `voices` garde `muted` et `solo` a 8 (le telephone, le boitier, les ecrans les lisent) et ajoute `hiMuted`, `hiSolo` ; `isMuted`, `plays`, `lit`, `led` lisent les deux.
- **Le mute du pattern reste sur 1 a 8 en 6.0** : elargir `pmutes` casse 15 lignes de B2, B3, B5, B6 (stockage, emplacements, presets). Le mode PATTERN MUTE le dit pour 9 a 16 ; le QUICK MUTE en mode PATTERN y passe au global.
- **FUNC et TRK gardent leurs stores** (la couche les enveloppe) : leurs LED, MIDI, boitier et sondes ne bougent pas.
- **Les touches de page gardent le `pageArm` de la V.5.0** pour page + YES et page + NO (le MIDI `rytm:page:*` le pose aussi) ; elles sont en plus des modificateurs de la couche.
- **Une tape de YES arme YES 1,5 s** : avec une souris, c'est le seul chemin vers YES + PAGE ; apres un menu, YES n'est pas gardee.
- **Le contexte d'un accord est lu a l'appel** : une reference directe a une fonction `const` importee faisait une zone morte au chargement du build (vue par la sonde, pas par tsc).
- **Les messages** : `BIENTOT : V.6.1` et `BIENTOT : V.6.2` a l'ecran (lcdMessage), comme le cahier 5.1 les nomme.

## 3. Ce qui reste a faire / points en suspens

- **B5** (ecran, menus) :
  - `onInput` de chaque menu : la face envoie `up down left right yes no data`, appui et lacher, avec `func` ; NO non pris ferme le menu.
  - Les menus ouverts par la face : `tempo`, `preset`, `sounds`, `samples`, `settings`, `quantize`, `machine` (FUNC + MOD garde la page MIXER d'avant).
  - Lire la piste active par `activeTrack.get()` (`state/trk.ts`) pour les pages, les potards et l'ecran sur 16 ; `pattern.instrument` est null quand T9 a T16 est active.
  - L'anneau de LEVEL/DATA (`stage.sideKnobs.setRing('data', ...)`), `setPageLocks` (trig tenu : les touches de page qui portent des verrous), les cartes INFOS des ids de la table (`kbd song preset settings sounds tempo up down left right ptnpage data mvol`).
  - SETTINGS > PATTERN > EDIT GRID : `editGridToggle()` ; PERSONALIZE : `dtFace.setPersonal({ led, backlight, trkSelect })`.
- **B6** (MIDI, boitier, telephone) : brancher les cibles nouvelles sur `faceKeyDown(id, 'midi')` / `faceKeyUp(id, 'midi')` (ou `faceKeyTap`), `dataTurn(delta, 'midi')`, `mainVolumeTurn` ; `rytm:edit` en DT2 : `faceKeyTap('ptn')` ; la bascule 9-16 : `trackSelect(k)`, `trackMute(k)` ; les mutes 9 a 16 sont dans `voices.get().hiMuted` (ou `voices.mutedAll()`) ; `rytm:fill` allume deja la LED de PAGE.
- **Hors lane, a relire a l'integration** : `state/voices.ts` (B1), `rytm/stepLeds.ts`, `scene/renderer.ts`, `scene/sequencer3d.ts` (B3), `ui/BeatEditor.tsx` (B6), `state/patterns.ts` (B2) : quelques lignes chacun, toutes derriere le drapeau ou sans effet sans lui.
- **Pas fait** : les multiplicateurs de lueur de LED INTENSITY et BACKLIGHT (l'etat est pose, la face 3D ne le lit pas : une API de B3 manque) ; le P-LOCK et uTIME sur les pistes 9 a 16 (le P-LOCK suit la voix du motif) ; PATTERN MUTE 9 a 16.
- **Cote Mika** : rien a faire. A essayer quand le drapeau sera bascule : FILL par PAGE et les touches nouvelles.

## 4. Commandes utiles ajoutees

- `?face=dt2&debug=1` : `__v4.input` (la couche `gesture`, `chords60`, `chordFor(key, geste)`, `chordLog`, `chordCount`, `menuLog`, `hintLog`, `activeTrack`, `fill`, `keyDown`, `keyUp`, `keyTap`, `dataTurn`, `mainVolumeTurn`, `editGrid`).
- Aucun script npm ajoute.

## Ecarts au cahier

- PATTERN MUTE reste sur les pistes 1 a 8 (le type `pmutes` des autres lanes) ; en mode PATTERN, TRIG 9 a 16 le disent a l'ecran.
- Le P-LOCK et uTIME suivent la voix du motif : sur T9 a T16, rien a verrouiller encore.
- LED INTENSITY et BACKLIGHT : l'etat est pose (`dtFace.personal()`), la lueur de la face 3D ne le lit pas encore.
- KEYBOARD et SONG gardent la phase 2 de `DT2_FACEPLATE` (le curseur inerte de B3) : leur tape dit `BIENTOT`.
- Le contraste (la regle du 2026-11-01) : aucun texte HTML visible ajoute. Les jumeaux restent invisibles (`.v4-twin`), les indices et les `BIENTOT` passent par l'ecran LCD (sa toile), les infobulles sont celles du navigateur.

## Portes

- `npx tsc --noEmit -p .` : 13 erreurs, les memes qu'a 2c2e22a.
- `SEO_OFFLINE=1 npx vite build` : bon (copie propre du HEAD).
- `npm run -s hw:test` : 17 / 17 et 11 / 11 ; `presets:test` : 5 / 5 ; `face:test` : 7 / 7.
- `node scripts/exports-check.mjs` : identique (actions 217 : les 17 ajouts notes plus haut).
- `node scripts/rytm-ident.mjs` : identique, 20 cas, l'ecart de bloc le plus grand 4,8e-7 (au plus 1e-6).
- `npm run docs:midi` : 892 cibles, 6 setups ; les CSV identiques, seule la ligne de date bouge (rien de committe).
- Le smoke `--machines mm808,voy,dj` : 6 pages, aucune erreur ; avec `?face=dt2` (une copie du script hors depot, l'URL seule change) : 6 pages, aucune erreur.
- Les sondes muettes (Chromium `--mute-audio`, `?mute=1`, aucune lecture ; un TRIG hors REC est lu par `chordFor`, jamais tape) : avec `?face=dt2`, 111 / 111 (la table : 238 accords, ids uniques, chemins et cartes INFOS ; chaque geste de 1.4 et 3.1 contexte par contexte ; TRK + TRIG 9-16 ; les mutes sur 16 et le QUICK MUTE ; FILL par PAGE, ses trois gestes ; le clavier ; les jumeaux ; les inertes sans erreur) ; sans le drapeau, 5 / 5 (rien ne bouge, SCENE A, crossfader, SCENE B gardent leurs jumeaux).
- `node scripts/firmware.mjs stamp` puis `check` : V.5.9, V.2.3, V.3.0 inchangees, seule l'empreinte du MM-RYTM bouge.
- Les sondes elles-memes, sous la charge des autres lanes : une minuterie de 250 ms (FILL) ou une tape de SETTINGS peuvent etre vues tard par la page ; elles attendent l'etat ou lisent l'ecart appui-lacher dans la page. Au bord gauche, la souris ouvre le volet des machines, qui prend Echap avant tout (comportement d'avant, garde).
