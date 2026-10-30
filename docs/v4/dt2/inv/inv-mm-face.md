# Inventaire mm-face : la face 3D du MM-RYTM (desktop) et ce qu'il faut pour la replacer facon Digitakt II

2026-10-30. Lecture seule du depot `/home/user/MauditeMachine` (branche courante, V.5.2 en ligne, cahier D3b ecrit mais pas construit). Ecrit sans accents. Aucun tiret cadratin ni demi-cadratin.

Pieces jointes (scratchpad) :
- `/tmp/claude-0/-home-user-MauditeMachine/3e52142d-b436-522a-95d4-63ef836eaea8/scratchpad/dt2/inv/gridA.png` : le dessin de la grille proposee (option A, section 8).
- `/tmp/claude-0/-home-user-MauditeMachine/3e52142d-b436-522a-95d4-63ef836eaea8/scratchpad/dt2/tools/gridA2.py` : la grille A en donnees et son controle (hors face, chevauchements, legendes orange comprises) : "OK".
- `/tmp/claude-0/-home-user-MauditeMachine/3e52142d-b436-522a-95d4-63ef836eaea8/scratchpad/dt2/fig/panel.png` : le panneau DT2 du manuel (page 12, 300 dpi, recadre), source des mesures de la section 7.

---

## 0. Resume

1. **Une seule source en mm** : `src/v4/rytm/faceplate.ts` (`RYTM_FACEPLATE`, 256 x 156 mm, 20 mm l'unite). `theme.ts` en derive toutes les constantes en unites de scene (FACE_KEY, FACE_KEYS, KEYS, PAGE_KNOBS, FACE_KNOBS, ENCODER, KNOB_RING, OLED, XFADE, KEY_LABELS, SILK_TEXTS, HEAD). Les modules 3D ne lisent que `theme.ts`.
2. **Le verrou principal** : la rangee de 14 touches est une rangee unique (un seul `y`, un seul pas `x0 + 12 i`). `rytmFaceKeys.ts`, `presetKeys.ts`, `theme.ts` (FACE_KEY.z, faceKeyX, alt labels a `cy` fixe) et `hw/rowLeds.ts` le supposent. Replacer facon DT2 = passer a **une piece par touche** (x, y, w, h propres) et a **plusieurs classes de taille** (petite 12 x 11, large 22 x 11, large PAGE 26 x 11), plus des pieces nouvelles (2 potards a gauche, 8 LED de page, cadres serigraphies).
3. **Ce qui ne bouge que par les chiffres** : les 16 pas (`steps`), les 8 potards A a H (`knobs`), l'ecran (`screen.rect`), le logo M (`open`), la serigraphie d'en-tete (`silk`). Changer `faceplate.ts` suffit pour eux (plus deux petites corrections : `stepLabels` et l'ombre).
4. **Le telephone** (`?portrait=1`, `PORTRAIT`) a sa propre face (pads, touches de page, transport, pas d'anneaux, ecran tactile) dans les branches `PORTRAIT ?` de `theme.ts` et des modules : la refonte de la face peut le laisser intact au pixel pres si tout passe par `!PORTRAIT` / `DT_FACE`. Mais le modele "16 pistes libres" touchera le telephone fonctionnellement (8 pads, le Dock), voir 5.
5. **Estimation face seule (option A)** : environ 3000 lignes touchees, 8 a 11 jours d'agent (construction, relecture, verification), en 2 mises en ligne de face (V.6.0 : toute la face dessinee et branchee aux fonctions existantes, les nouvelles touches inertes "BIENTOT" ; V.6.1/V.6.2 : leurs fonctions). L'option B (face aux proportions DT2, 256 x 196) ajoute 2 jours et des risques de cadrage.

---

## 1. Fichiers lus

`src/v4/rytm/faceplate.ts` (338 l.), `src/v4/theme.ts` (3056 l., les sections face), `src/v4/scene/rytmFaceKeys.ts` (743), `rytmPageKeys.ts` (248), `sequencer3d.ts` (1080, en partie), `machine.ts` (448), `encoders.ts` (420, en partie), `keyCap.ts`, `keyLabels.ts` (en partie), `silk.ts` (en partie), `screen.ts` (en-tete et dimensions), `hit.ts` (types, HitMap), `renderer.ts` (assemblage 740 a 910, face 3136 a 3260), `src/v4/rytm/faceKnobs.ts` (en-tete), `presetKeys.ts`, `stepLeds.ts` (usages), `infoIds.ts` (usages), `src/v4/ui/Hotspots.tsx` (activation 1000 a 1090, appuis 1350 a 1430, jumeaux 2990 a 3200), `src/v4/hooks/useKeys.ts` (raccourcis), `src/v4/state/func.ts`, `dtFace.ts`, `appearance.ts`, `src/v4/midi/targets.ts` (cibles RYTM, `targetIdOfHotspot`), `src/v4/midi/rotoKeys.ts` (en-tete), `src/v4/hw/rowLeds.ts`, `hw/snapshot.ts` (usages), `scripts/hw-leds.test.mjs`, `scripts/smoke-v4.mjs`, `src/v4/fallback/StaticMachine.tsx` (usages), `docs/v4/digitakt-reference.md`, `digitakt-d1-spec.md`, `digitakt-d3b-spec.md`, `docs/hardware/mmhw-v2-app-side.md`, le manuel DT2 (`m2.txt` 486 a 612, 2565 a 2595, figure page 12).

---

## 2. La face d'aujourd'hui (V.5.2, desktop), piece par piece

Repere `faceplate.ts` : coin en haut a gauche de la face, x vers la droite, y vers l'utilisateur, en mm. Un rectangle par (x, y, w, h), un cercle par (cx, cy, d). Conversion (theme.ts via `fpX`, `fpZ`, `fpU`) : `X = (x - 128) / 20`, `Z = (y - 78) / 20`, `U = mm / 20` dans le repere du plateau (origine au centre du dessus du panneau, z qui descend la pente).

| Piece | Valeurs (mm) | Defini dans |
|---|---|---|
| Face | 256 x 156, chanfrein 2, coins 6 | `RYTM_FACEPLATE.size`, `.edge` |
| Ecran (verre noir, cadre fusionne au panneau) | rect 8, 8, 106 x 67 ; zone active 5:3 93.6 x 56.16 centree (800 x 480 px, 4.3") | `.screen.rect`, `.active`, `.px` |
| Potards A a H | cx 134 166 198 230, cy 24 et 56 ; emprise 28 ; capuchon 17 (bas) 16 (haut) 8 (h) ; jupe 18.6 x 0.8 ; anneau 23.2 a 27.2, 27 segments, 270 deg, 3 deg d'air ; lettre a 6 h, r 12.6, capitale 1.8 | `.knobs` |
| Rangee de 14 touches | 10.4 x 12, pas 12 depuis x 8 (8 a 174.4), y 84 a 96 ; hauteur 3.2, coins 0.8, chanfrein 0.6, course 1.4 ; temoin 5.4 x 0.8 a 1.5 du bord arriere ; legende capitale 1.35 ; signes (REC PLAY STOP) h 2.4 | `.buttons` (w, h, x0, pitch, y, capHeight, corner, bevel, travel, led, legend, marks) |
| Ordre de la rangee (x gauche) | FUNC 8, TRK 20, PTN 32, REC 44, PLAY 56, STOP 68, TRIG 80, SRC 92, FLTR 104, AMP 116, FX 128, MOD 140, YES 152, NO 164 | `.buttons.keys` |
| Legende orange (FUNC + touche) | centree sous chaque touche, cy 98.6, capitale 1.25, largeur 11.4 ; MUTE BANK COPY CLEAR PASTE TEMPO SOUNDS SETUP EUCLID SEND FX MIXER SAVE RELOAD | `.buttons.alt`, `keys[].alt` |
| SCENE A, SCENE B | 12 x 12 en 180, 84 et 236, 84 ; lettre capitale 3.2 | `.scenes.a`, `.b`, `.legend` |
| Crossfader | fente x 196 a 232 sur y 90, 2.4 de large ; capuchon 8 x 12 x 7 | `.scenes.xfade` |
| Logo M (OPEN, sans temoin) | zone 237.4, 72.5, 10.6 x 9 | `.open` |
| 16 pas | 27.6 x 20, pas 30.4 depuis x 8, rangees y 104 et 128 ; hauteur 3.2, coins 1.2, chanfrein 0.8, course 1.4 ; cadre des temps (1 5 9 13) marge 1.6 trait 0.5 ; marque des verrous 8 x 0.9 a 2.6 ; numero en haut a gauche (cap 1.2), voix des pas 1 a 8 (BD SD CH OH CP TOM HT CY, cap 1.5, dy 15) | `.steps` |
| Serigraphie d'en-tete | wordmark x 8 cy 79.5 w 56 ; MM-RYTM cale a droite en x 114 cy 79.5 cap 2.4 ; FIRMWARE cale a droite en x 235 cy 79.5 cap 1.3 ; logo M cale a droite en x 248 cy 77 h 9 | `.silk` |
| Ligne d'aide | cx 128.2 cy 152 cap 1.36 (texte REC / P-LOCK / MUTE) | `theme.ts SILK_TEXTS` (z = KEYS.bracketZ + 0.25) |

Aides pures de `faceplate.ts` : `buttonRect(i)` (la touche i de la rangee, **suppose une rangee**), `stepRect(i)`, `knobCircle(k)`, `buttonIndex(id)`, `rectCenter(r)`, `xfadeRect()`, `faceplateParts()` (toutes les pieces : ecran, 8 potards, 14 touches, scenes, fente, 16 pas ; lue par la jupe d'ombre), `faceplateNotes()`, `faceplateCheck()` (hors face, chevauchements ; **n'est appele par aucun test** aujourd'hui).

---

## 3. Ou chaque commande est definie, et par qui elle est lue

### 3.1 `rytm/faceplate.ts`
- Types : `FpButtonId` (14 ids), `FpMark` (`play` `stop` `rec`), `FpButton` (id, legend, marks, alt, name, title, hotspot, phase 1/2), `FpScene`.
- `phase: 2` = touche dessinee et inerte : seuls `FACE_TITLE` (infobulle "coming soon") et le curseur (`FACE_INERT`, vide, lu par Hotspots.tsx l. 870) le savent ; **l'activation n'est pas bloquee** : a brancher pour livrer des touches "BIENTOT".
- Lu par : `theme.ts`, `rytm/presetKeys.ts` (pastilles de l'ecran en mode presets, `buttons.x0 + pitch * i`), `rytm/stepLeds.ts` (`steps.voices`, `steps.trkColor`), `scene/rytmFaceKeys.ts` (`faceplateParts`, `open`), `scene/sequencer3d.ts` (`steps.voices`), `hw/rowLeds.ts` (en commentaire : son `ROW_KEYS` recopie l'ordre).

### 3.2 `theme.ts` (constantes derivees, toutes `PORTRAIT ? telephone : desktop`)
- `BODY` (desktop : w 12.8, d tel que d / cos TILT = 7.8), `TILT` 6.63 deg, `PANEL`, `PANEL_D`, `SILK_PLANE` (tex 2048 x 1248, retina 2560 x 1560 des DPR 1.75), `MACHINE_H` 10.61 (mesure), `RYTM_V3_BODY` 12.6 x 8 (la place des voisines et des PCB : ne suit pas la face).
- `OLED` : centre, taille active, cadre (bezel) depuis `screen.rect` / `active` ; `OLED_UH` 192 (dessin 320 x 192 unites, 5:3) ; `OLED_BAR`, `OLED_PAGE_ZONES` (zones de l'ecran en px de texture).
- `FACE_KEY` (w, d, h, radius, bevel, travel, **z unique**, led) ; `SCENE_KEY` ; `faceKeyX(i)` ; `FACE_KEYS` (id, **x seul**, hotspot ; 14 touches + scene-a + scene-b) ; `DT_PAGE_KEYS` (page de chaque touche : trig, voice/src, fltr, env/amp, fx, mod) ; `XFADE` et `xfadeCapX`.
- `TRANSPORT`, `PAGE_KEYS`, `pageKeyX`, `RYTM_PAGE_KEYS`, `BTN_LED` : le telephone (au desktop ils pointent sur la rangee, plus lus en 3D).
- `KEYS` (les pas : x0, pitch, z, rowDz, w, d, h, radius, bevel, frame, lockMark ; numberZ et bracketZ ne servent plus au desktop sauf la ligne d'aide), `keyX(i)`, `keyDz(i)`.
- `PAGE_KNOBS` (rowZ, pitch, cap, nameDz, hitR), `pageKnobX(k)`, `FACE_KNOBS` (8 : id p0 a p7, x, z, labelZ, s), `ENCODER` (capuchon, jupe, repere, cannelures, depuis `knobs.cap/skirt`), `KNOB_RING` (r0, r1, segments, airDeg, y 0.006, center, band), `ringLit()`, `RING_TONE`, `RING_BAND`.
- `KEY_LABEL`, `KEY_MARK`, `marksW`, `REC_MARK_D`, `KEY_LABELS` (desktop : une entree par touche de la rangee a `faceKeyX(i)`, `FACE_KEY.z` ; scenes ; `stepn-1..16` ; `stepv-BD..CY`).
- `FACE_TITLE` (infobulles par id de zone), `TWIN_ARIA` (aria des jumeaux), `SCREEN_TOUCH` (faux au desktop), `FACE_INERT`.
- Couleurs : `DT_FACE`, `DT_HEX` (+ `_DARK`, `_LIGHT`), `KEY_LIT` (glow par teinte, `dred dgreen dwhite dmagenta dblue dorange dyellow`), `KEY_LIT_LIGHT`, `STEP_LIT`, `STEP_TONE`, `TRK_FLASH`, `TRK_LIT(_LIGHT)`, `STEP_PRESS`, `DT_PRESS`, `KEY_RELIEF`, `HOVER_LIGHT`.
- Gestes : `FACE_HOLD_MS` 350, `DT_GESTURE` (funcDoubleMs 400, pageArmMs 1500, stopDoubleMs 600, muteHoldMs 400, tapTaps 4, tapResetMs 2000, hintMs 2000), `REC_KEY` W.
- Serigraphie : `HEAD` (wordmark, model, firmware, mark depuis `silk`), `SILK_LOGOS`, `SILK_TEXTS` (repli du wordmark, MM-RYTM, firmware, lettres A a H depuis `FACE_KNOBS`, ligne d'aide, **legendes orange a `faceKeyX(i)` et `fpZ(alt.cy)` fixe**), `SILK_LINES` (aucune au desktop), `OPEN_SILK_INDEX`.
- `applyAppearance(a)` : voir section 6.

### 3.3 `scene/rytmFaceKeys.ts` (classe `RytmFaceKeys`, desktop seulement)
- Maillages : `keys` (InstancedMesh, 16 instances, la geometrie `keyCapGeometry(FACE_KEY.w, ...)`, SCENE A et B a l'echelle 0), `sceneKeys` (2 instances, 12 x 12 : la revue D1 R9 a montre qu'etirer une instance deforme chanfrein, coins et temoin), `leds` (16 temoins, **`LED_Z` unique**), `labels` (KeyLabels depuis KEY_LABELS), `cap` (capuchon du crossfader), `armRing` (cadre de la scene armee), `skirt` (l'ombre au pied de toutes les touches et des pas, depuis `faceplateParts()`), `logo` (lueur du logo M au survol).
- Placement : `keys.setMatrixAt(i, keyMatrix(i, k.x, 0, FACE_KEY.z))` (**z unique**), `leds ... (k.x, LED_Y, LED_Z)`, `setPress` ecrit y (index 13 de la matrice) des touches, des temoins et des noms.
- Etat montre : `look(i)` (FUNC orange permanent et temoin blanc tenu/clignotant ; TRK rouge ; PTN rouge si grille ou KIT ; REC rouge ; PLAY vert, vert clignotant en pause ; STOP YES NO eclair blanc ; touche de page rouge sur la page affichee, `HOME_LEVEL` 0.32 en HOME ; scenes bleues) ; setters `setFunc setEditing setRec setPlay setPage setFlash setTrk setScene setSceneLeds setXfade setHover setPress`, `blink()`, `indexOf(hotspot)`.
- Zones : `hotspots(layer)` : une boite par touche a (k.x, FACE_KEY.z), kind depuis `KIND` (func trk edit rec run stop yes no) ou `pkey` + `rpage`, `scene` + `scene`, `xfade` entre A et B, `pad-open` (kind open) sur le logo.
- `info()` : l'etat pour les sondes (`__v4.stage.faceKeys.info()` via debug.ts).

### 3.4 `scene/sequencer3d.ts` (classe `Sequencer3D`)
- Les 16 pas : `keys` a `keyX(i), KEYS.z + keyDz(i)` ; `frames` (1 5 9 13) ; `lockMarks` et `condDots` (`markZ(i)`) ; `stepLabels` (numeros + voix) ; au telephone seulement (`transport: PORTRAIT`) : `buttons` RUN CLEAR MUTE SOLO RANDOM, `btnLeds`, `labels`.
- **Piege** : `this.stepLabels = stepSpecs.length === STEP_COUNT + INSTRUMENTS.length ? new KeyLabels(...) : null` : retirer les voix BD a CY des pas (16 pistes facon DT2, les touches ne portent que 1 a 16) met **tous** les numeros a null. A corriger.
- `TRK_STEP_OF` (voix -> pas via `steps.voices`), `trkView` (vue TRK : pas 1 a 8), `patView` (vue PTN), couleurs `STEP_TONE`, `DT_HEX`.
- Zones : `hotspots(layer)` : `step-1` a `step-16` (kind step, index), et au telephone run clear mute solo random.

### 3.5 `scene/encoders.ts` (classe `Encoders`) et `rytm/faceKnobs.ts`
- 8 potards a `FACE_KNOBS[i]` : `mesh` (capuchon tournant), `skirts`, `rings` (8 x 27 segments, un draw call), `setRing`, `setCap`, `setValue`, `hotspot(id, layer)` : desktop un disque de rayon `PAGE_KNOBS.hitR` (kind `penc`, index k, id `penc-k`).
- `faceKnobs.ts` (logique, pas de mise en page) : N = 8 fige, le bloc de la page sous chaque potard, la teinte d'anneau, `rytm:knob:k+1`.
- Le chiffre 8 est fige partout (faceKnobs N, renderer `for k < 8`, motorPlan, faceTouch, debug `encoders.info()`). **Ajouter MAIN VOLUME et LEVEL/DATA dans FACE_KNOBS casserait ces 8** : prevoir une petite classe a part (deux potards, memes geometries exportees d'encoders.ts).

### 3.6 `scene/keyCap.ts`, `scene/keyLabels.ts`
- `keyCapGeometry(w, h, d, radius, bevel, seg, shade)` : une geometrie par taille (pas d'etirement possible sans deformer). `keySkirtGeometry(keys, ...)` : l'ombre de toutes les touches en un maillage.
- `KeyLabelAtlas` (une texture pour tous les noms, deux variantes encre/noir ; etageres de 2048) et `KeyLabels` (un quad par touche a `spec.x, spec.z + dz`, `setDy`, `setLit`). Signes dessines : `play`, `stop`, `rec` seulement (`drawMarks`). Des fleches (chevrons) et, si choisis, les pictogrammes DT2 (liste, engrenage, onde, metronome, clavier) sont a ajouter ici, dans `FpMark`, `marksW` et dans `fallback/StaticMachine.tsx` (`faceLabel`, chemins SVG).

### 3.7 `scene/silk.ts` (`PanelSilk`)
- Une texture canvas pour tout le panneau, plan a y 0.004 : `SILK_LINES`, `SILK_LOGOS`, `SILK_TEXTS` (encres : silk, orange, `alt` = `DT_HEX.orange`). Redessinee a l'arrivee des polices et des logos.
- **Piege** : le cadre de l'ecran est a y 0.02, au-dessus du plan de serigraphie : rien de serigraphie ne se voit sur le cadre. Imprimer MAUDITE MACHINE / MM-RYTM dans la bande du cadre, comme "Digitakt II", demande un petit decalque a part (un quad au-dessus du cadre) ou un cadre plus bas.

### 3.8 `scene/screen.ts` (`Screen`) et `rytm/presetKeys.ts`
- Le plan de l'ecran `PlaneGeometry(OLED.w, OLED.d)` a `OLED.x, OLED.y, OLED.z` ; toile 1600 x 960 au desktop (dessin 320 x 192 unites). **Deplacer l'ecran en gardant 5:3 ne change rien au dessin** ; changer de proportions toucherait `OLED_UH`, `OLED_DY` et toutes les mises en page de screen.ts (3958 l.).
- Zones de l'ecran (lcd-*, lcd-i, lcd-tab-*, rblock, rmenu, rdial lcd-master et lcd-tempo, sbrowse) : `screen: true`, traversees par le pointeur au desktop (`SCREEN_TOUCH` faux), gardees pour les jumeaux.
- `presetKeys.ts` : en mode presets (KIT), 5 touches de la rangee servent de touches d'ecran (`PRESET_SOFT_KEYS` : src LOAD, fltr SAVE, amp NAME, fx DEL, ptn EXIT) ; `realU()` calcule leur place sous l'ecran depuis `buttons.x0 + pitch * buttonIndex` (**une rangee**) ; `screen.ts` dessine les pastilles (`softKeyU`, `softKeyPitchU`, `softKeyName`). La DT2 n'a pas de touches d'ecran : PRESET/KIT + fleches + LEVEL/DATA + YES/NO. A refaire.
- MASTER et TEMPO sont dessines dans l'ecran (rdial `lcd-master`, `lcd-tempo`) ; avec un vrai MAIN VOLUME et une touche TEMPO, ils peuvent partir de l'ecran (garder les cibles MIDI).

### 3.9 `scene/machine.ts` (`Machine`)
- Le corps (coin, bac, pieds, connectique arriere) depuis `BODY`, `TILT`, `BACK` ; le panneau (`buildPanel`) fusionne la dalle, **le cadre de l'ecran** (`OLED.bezel` a `OLED.x, OLED.z`) et **la fente du crossfader** (`slotParts`, desktop). Option A : rien a changer sauf retirer la fente si les scenes quittent la face. Option B : tout le corps suit `BODY`.

### 3.10 `scene/renderer.ts` (`Stage`)
- Construction (l. 760 a 845) : `faceKeys = PORTRAIT ? null : new RytmFaceKeys(...)`, `seq = new Sequencer3D({ transport: PORTRAIT })`, `encoders = new Encoders({ rings: !PORTRAIT })`, `pageKeys = PORTRAIT ? new RytmPageKeys(...) : null` ; tout est ajoute au `plateau` (le capot qui s'ouvre l'emporte).
- **Ordre des zones = ordre de tabulation des jumeaux** : pads (telephone), puces du PCB, TWEAKS, potards `penc-0..7` (+ touches de page du telephone), `faceDefs` (la rangee, scenes, xfade, pad-open), transport du telephone, `step-1..16`, `seek`, `lcd-*`, `lcd-i`.
- Animations et etats : `pressFaceKey(hotspot)`, `flashFaceKey(hotspot)` (STOP YES NO), `pressPageKey(id)` (desktop -> `pressFaceKey('pkey-' + id)`), `pressRytmPad('edit')` -> `pad-edit`, `syncPageKeys`, `setPlay`, `xfadeAxis()` (projection de la fente), `knobsMoved`, `motorDone`, `thumbnail()` (vignettes du volet des machines, rendues en direct : suivent la face).

### 3.11 `fallback/StaticMachine.tsx` (repli SVG sans WebGL)
- Desktop : dessine les touches depuis `KEY_LABELS` (x, z, w, d) et `FACE_KEY.h`, les potards et anneaux depuis `FACE_KNOBS` / `KNOB_RING`, la fente depuis `XFADE`, l'ecran depuis `OLED`, les pas depuis `keyX`, `KEYS`. Suit la nouvelle grille si `KEY_LABELS` porte la place de chaque touche ; les 2 potards de gauche, les LED de page, les cadres et les nouveaux signes sont a ajouter.

---

## 4. La saisie : du pointeur, du clavier et du MIDI a l'action

### 4.1 Picking (`scene/hit.ts`)
- `HotspotDef` : id, kind, layer, shape (`box` / `disc`), x, z, hx, hz, y0, y1, enabled, + champs (index, rpage, scene, param, screen...). `HitMap` projette chaque silhouette quand la camera bouge, `pick(x, y, coarse)` rend la plus proche, `rects()` donne les rectangles des jumeaux HTML.
- Kinds de la face desktop : `func trk edit rec run stop yes no pkey penc step scene xfade open`, et pour l'ecran `lcd rinfo rblock sbrowse rmenu rdial seek`. **Le kind `page` est deja pris** (pads de navigation du site) : une touche PAGE facon DT2 doit prendre un autre kind (`pagekey` par exemple). Kinds nouveaux a creer : `kbd song preset settings sounds tempo arrow pagekey data` (et `encoder` avec `param: 'level'` sert deja pour MAIN VOLUME : `targetIdOfHotspot` rend `rytm:enc:level`).

### 4.2 Les zones de la face desktop aujourd'hui

| Zone (id) | kind | Appui (pointerdown) | Tape / lacher | MIDI appris (`targetIdOfHotspot`) | Jumeau |
|---|---|---|---|---|---|
| `func` | func | `funcDown` (state/func.ts : tenue, une tape = une touche, deux tapes = gardee) | `funcUp` | `rytm:func` | HoldTwin |
| `trk` | trk | `trkDown` (holdLatch) | `trkUp` ; FUNC + TRK = MUTE MODE | `rytm:trk` | HoldTwin |
| `pad-edit` (PTN) | edit | | `editToggle('mm808')` (grille ; 2 fois = KIT ; FUNC = BANK) | `rytm:edit` | editTwin |
| `rec` | rec | | `recKey` (FUNC = COPY) | `rytm:rec` | keyTwin |
| `run` (PLAY) | run | | `playKey` (pause/reprise ; FUNC = CLEAR) | `rytm:play` | runTwin |
| `stop` | stop | | `stopKey` (2 fois = coupe les queues ; FUNC = PASTE) | `rytm:stop` | keyTwin |
| `pkey-trig/voice/fltr/env/fx/mod` | pkey + rpage | `pageKeyHold(rpage, true)` (fenetre `pageArmMs` pour YES/NO) | `rytmPageKey(rpage)` ; lacher `pageKeyHold(false)` | `rytm:page:<id>` ou `rytm:screen:<id>` | dtPkeyTwins |
| `yes` | yes | `yesDown` (tenue > 250 ms = FILL) | `yesKey` ou `yesUp` | `rytm:yes` | keyTwin |
| `no` | no | | `noKey` (la chaine d'Echap ; FUNC = RELOAD) | `rytm:no` | keyTwin |
| `scene-a`, `scene-b` | scene | `sceneDown` | `sceneUp` | `rytm:scene:a/b` | HoldTwin |
| `xfade` | xfade | glisser sur l'axe projete (`xfadeAxis`) | | `rytm:xfade` | XfadeTwin (curseur natif) |
| `pad-open` (logo M) | open | | `openToggle('mm808')` | `rytm:open` | openTwin |
| `penc-0..7` | penc | glisser (`faceKnob(k, v, 'ptr')`), orbite reclamee | `tapDial` ou `presetFaceKnob` | `rytm:knob:k+1` | knobTwins |
| `step-1..16` | step | velocite au glisser, tenue = P-LOCK (REC), SOLO en mode mute | `stepToggle` (ou jouer la voix hors REC, pas 1 a 8) | `rytm:step:<i>` | stepTwins |

Code : `ui/Hotspots.tsx` `activate(d)` l. 1000 a 1090 (la tape), le pointerdown l. 1350 a 1430 (tenues : trk, pkey, func, yes, scene, xfade), le lacher l. 1650 et 1769 (`pageKeyHold(false)`). Les handlers sont dans `actions.ts` (l. 4531 `funcDown` ... 4943 `noKey`, `pageArm` l. 4581, `fillHold` 4935, `rytmPageKey` 3164, `editToggle` 1982).

### 4.3 Jumeaux HTML (`ui/Hotspots.tsx` l. 3141 a 3198)
- Desktop, dans l'ordre : presets, i, dials, blocs, liste des sons, menu, potards, FUNC, TRK, PTN, REC, PLAY, STOP, 6 touches de page, YES, NO, SCENE A, crossfader, SCENE B, logo M, puces, TWEAKS, 16 pas. Places par `data-hotspot` depuis `HitMap.rects()`. Libelles : `TWIN_ARIA`, `FACE_TITLE`.
- Toute nouvelle zone = un jumeau (bouton, `aria-pressed` si etat), dans l'ordre de lecture de la nouvelle face (colonne gauche, ecran et touches dessous, potards, touches de droite, pas).

### 4.4 Clavier (`hooks/useKeys.ts`)
- Echap (NO), Alt tenu (FUNC), Entree (YES ; presets), Espace (PLAY), Maj + Espace (STOP), W (REC), E (PTN), O (capot), M / Maj + M (mute / solo), H (HOME), [ et ] (page precedente / suivante), L (LOCK), I (INFOS), P (presets), R (RESET VIEW), chiffres (pages du site), A S D F Z X C V (voix).
- **Conflit** : les fleches gauche/droite changent de machine (`stepMachine`, demande de Mika, tache 45), haut/bas defilent la liste des sons, gauche/droite/haut/bas font prev/next en mode presets. Les fleches de la face DT2 (UP DOWN LEFT RIGHT) n'ont donc pas de raccourci libre : a trancher (Maj + fleches, ou fleches seulement quand un menu de la machine est ouvert).

### 4.5 Etats de la face (pas sauvegardes)
- `state/func.ts` : off / held / once / locked, plusieurs sources (`ptr:<id>`, key, midi, hw), `use()`, `cancel()`.
- `state/dtFace.ts` : `rec` (grid rec), `mute` (off / global / pattern), `bank` (vue BANK). A etendre : `keyboard`, `song`, la page du pattern, un menu ouvert (TEMPO, SETTINGS, PRESET/KIT, SOUNDS).
- `state/holdLatch.ts` (TRK, scenes) et `pageArm` dans actions.ts (une touche tapee reste tenue 1.5 s pour YES/NO) : la regle "une souris ne tient pas deux touches". La DT2 vit de combinaisons (TRIG + fleches = uTIME, PTN + fleches = banque, KEYBOARD + haut/bas = octave, TEMPO + YES = metronome, PAGE + YES = FILL, PAGE + REC/PLAY/STOP = copier/effacer/coller la page, PARAMETER + REC/STOP/PLAY...). **Il faut generaliser `pageArm` en une fenetre "touche tenue" pour toute touche modificatrice.**

### 4.6 MIDI (`midi/targets.ts`)
- Cibles face existantes : `rytm:func` (faceHold, anime `func`), `rytm:trk`, `rytm:scene:a/b`, `rytm:xfade`, `rytm:rec`, `rytm:play`, `rytm:run`, `rytm:stop`, `rytm:yes`, `rytm:no`, `rytm:edit`, `rytm:open`, `rytm:page:<voice|fltr|env|fx|trig|mod>`, `rytm:screen:*` (dont `tempo`, `mixer`, `sendfx`, `trig2`, `mod1`, `mod2`), `rytm:mutemode`, `rytm:save`, `rytm:reload`, `rytm:copy`, `rytm:paste`, `rytm:fill` (faceHold, **anime `yes`**), `rytm:knob:1..8`, `rytm:enc:level`, `rytm:enc:tempo`, `rytm:step:<i>`, `rytm:lock:<i>`, `rytm:ptn:<i>`, `rytm:bank:<b>`, `rytm:home`, `rytm:infos`, `rytm:clear`, `rytm:random`, `rytm:mute`, `rytm:solo`.
- **`rytm:page` existe deja** (une valeur : la page VOICE a FX) : la touche PAGE facon DT2 doit prendre un autre id (`rytm:ptnpage` ou `rytm:pagekey`).
- `faceHold(id, label, hotspot, down, up)` enfonce la touche 3D par son id de zone : a mettre a jour si une zone change de nom (ne pas en changer).
- `targetIdOfHotspot(h)` (l. 598) : un `case` par kind ; chaque kind nouveau y entre, sinon MIDI LEARN rend null.
- Regle (D1 section 0) : aucun id ne disparait ni ne change d'ordre, les nouveaux a la fin de leur groupe ; `docs/midi/MIDI-targets.csv` par `npm run docs:midi`. `midi/rotoKeys.ts` est gele (une ligne par adresse, on ajoute a la fin) ; les cibles par voix (`rytm:voice:BD:level`...) iront vers des pistes avec le modele 16 pistes (hors face).

### 4.7 Boitier (`hw/rowLeds.ts`, `hw/snapshot.ts`, `docs/hardware/mmhw-v2-app-side.md`)
- `ROW_KEYS` (14 ids dans l'ordre de la rangee), `rowLeds(state, palette)`, `ptnLeds`, `bankLeds`, `trigLeds` ; `snapshot.ts` les appelle au desktop.
- `scripts/hw-leds.test.mjs` (dans `npm run hw:test`) verifie "quatorze touches, dans l'ordre de la rangee" et les couleurs : **casse des qu'une touche s'ajoute** ; a reecrire avec la nouvelle liste.
- Notes proposees (non confirmees, `protocol.js` absent) : TRK 60, FUNC 61, PTN 62, REC 63, PLAY 64, STOP 65, TRIG 66, SRC 67, FLTR 68, AMP 69, FX 70, MOD 71, YES 72, NO 73, SCENE A 79, SCENE B 80 ; CC 20 a 27 potards motorises, CC 28 crossfader, CC 30 a 37 toucher. Les touches nouvelles prendront des notes libres (proposition : 74 KEYBOARD, 75 SONG, 76 PRESET/KIT, 77 SETTINGS, 78 SOUNDS, 81 TEMPO, 82 UP, 83 DOWN, 84 LEFT, 85 RIGHT, 86 PAGE ; MAIN VOLUME et LEVEL/DATA sur des CC libres, par exemple 29 et 38), "a confirmer avec protocol.js". Les 8 LED de page du pattern s'ajoutent au snapshot.

### 4.8 Aide
- `rytm/infoIds.ts` (zone -> carte : `DT_KEYS` func rec stop yes no, `TRANSPORT`, scenes, xfade...) et `rytm/infos.ts` (les textes) : une carte par touche nouvelle, les cartes changees (TRIG perd TEMPO, SRC perd SOUNDS, PTN perd KIT).
- `ui/OverviewHelp.tsx`, `TWIN_ARIA`, `FACE_TITLE`, la ligne d'aide de la face (pas de place dans la grille DT2, voir 8).

---

## 5. Le telephone (`?portrait=1`)

- `PORTRAIT` (theme.ts) : vrai sous 768 px au chargement, force par `?portrait=1|0` (retenu en sessionStorage). `DT_FACE = FACE_FOLLOWS_PAGE = KEY_RELIEF.on = !PORTRAIT`, `SCREEN_TOUCH = BLOCKS_ARE_KNOBS = PORTRAIT`.
- Sa face : corps 8.2 x 14.4, ecran 7.28 de large en haut (OLED_UH 158, tactile, MASTER et TEMPO dedans), 4 touches de page VOICE FLTR ENV FX (`RytmPageKeys`), 8 potards FX globaux fixes en 2 x 4 sans anneaux (`GLOBAL_ENCODERS`), 8 pads de voix + EDIT + OPEN (`Pads`, `PADS`), transport RUN CLEAR RANDOM MUTE SOLO (`Sequencer3D` transport), 16 pas 2 x 8, numeros serigraphies, crochets ; HTML : le Dock, MobileHeader, KnobPanel. Aucun FUNC, REC, YES, NO, scenes ni crossfader.
- D1 a D3 l'ont garde au pixel pres (toutes les nouveautes derriere `!PORTRAIT`, `DT_FACE`, `FACE_FOLLOWS_PAGE`). La refonte de la face desktop peut faire de meme : tout ce qui est en section 10 reste dans les branches desktop.
- **Ce qui ne pourra pas rester intact** : le modele "16 pistes libres" (decision de Mika) change ce que sont les voix. Le telephone a 8 pads et un Dock de 8 voix ; il faudra soit une rangee de 8 pistes avec un selecteur 1-8 / 9-16, soit garder 8 pistes visibles au telephone. A decider dans le cahier (inventaire des pistes), pas dans celui de la face.
- Le smoke (`scripts/smoke-v4.mjs`) charge 3 machines x 2 dispositions (1440 x 900 et 390 x 844 portrait) et ne verifie que l'absence d'erreur, WebGL, le focus et le defilement : une capture du telephone avant/apres reste a faire a la main.

---

## 6. L'apparence (machine noire / machine creme)

- `state/appearance.ts` : `dark` par defaut, `light` gardee en localStorage (try/catch). `index.tsx` appelle `applyAppearance(look)` puis **reconstruit le Stage** : chaque module lit ses teintes a la construction.
- `applyAppearance` modifie en place : `HEX`/`COLOR` (panneau creme `#FAF8F4`, corps `#E6E2DA`, touches `#E8E5DF`, encodeurs charbon), `GAIN`, `LIT`, `MATERIAL`, `PAD_GLOW`, `STEP_PRESS.glow` (desktop : sans eclat, `DT_PRESS.light`), `PRESS_TINT`, `FLOOR`, lumieres, `INK.silk` (os -> gris `#434343`), `EXPOSURE` 1.3, `KEY_LIT_LIGHT` (teinte du dessus allume), `BACKDROP.transparent`, `DT_HEX` (`DT_HEX_LIGHT` : rouge `#D81E1E`, jaune `#E09A10`, blanc -> encre `#191919`, vert `#1F9E3A`, magenta `#B23AAB`, bleu `#2F78D6`, orange `#A84300`), `RING_TONE`, `RING_BAND`.
- Regle D1 : aucune couleur en dur hors de `theme.ts` ; les modules lisent `DT_HEX`, `KEY_LIT`, `KEY_LIT_LIGHT`. Les touches nouvelles, les LED de page, les cadres serigraphies et les signes doivent suivre ces tables (ajouter les teintes manquantes la, avec leur variante creme).
- Pieges deja vus (revue D1) : sur la creme, le temoin d'une touche allumee prend une lentille sombre (`LED_LIT_KEY_LIGHT`) ; le blanc DT2 devient l'encre sombre (tete de lecture, anneaux) ; l'orange des legendes `#A84300` (lisibilite sous l'eclairage).

---

## 7. Le panneau Digitakt II mesure (manuel OS 1.17, page 12)

Panneau 215 x 176 mm (la figure fait 1462 x 1196 px a 300 dpi : 6.80 px/mm dans les deux sens, coherent avec les dimensions Elektron 215 x 176). Repere : coin en haut a gauche, mm. Mesures des composantes claires de la figure (a 0.2 mm pres).

| Commande | Centre (cx, cy) | Taille | Legende orange (FUNC +) |
|---|---|---|---|
| Logo Elektron | (198, 15) | 13 x 9 | |
| MAIN VOLUME (potentiometre) | (17.4, 32.4) | d 12.8 | |
| LEVEL/DATA (encodeur) | (17.4, 57.4) | d 12.8 | Preset Pool |
| Ecran (cadre noir, nom "Digitakt II" dans sa bande basse 61.7 a 72.6) | cadre x 31.3 a 104.5, y 22 a 72.6 | 73 x 51 | |
| Potards A B C D | (118.4 / 144.8 / 171.1 / 197.4, 32.4) | d 12.8, pas 26.3 | |
| Potards E F G H | (memes x, 57.4) | pas vertical 25 | |
| TRIG SRC FLTR AMP FX MOD | (117.9 / 134.0 / 150.0 / 165.9 / 181.9 / 198.0, 79.4) | 11.2 x 11.2, pas 16 | Quantize, Machine, Setup, Sequencer, Send FX, Mixer |
| FUNC | (20.0, 89.9) | 17.6 x 11.3 | |
| PRESET/KIT, SETTINGS, SAMPLING, TEMPO (pictogrammes) | (43.8 / 60.0 / 76.2 / 92.4, 89.9) | 11.2 x 11.2, pas 16.2 | Perform, Save Proj, Samples, Tap Tempo |
| YES | (117.9, 97.9) | 11.2 | Save |
| UP | (150.0, 97.9) | 11.2 | Trig Mode ; "KB Octave" imprime a sa droite |
| LED de page du pattern (2 x 4) | cadre x 183.8 a 206.1, y 93.3 a 103.9 ; LED a x 186.7 192.6 198.5 204.4, y 95.9 et 102.1 | | |
| KEYBOARD (pictogramme piano) | (20.0, 105.9) | 11.2 | KB Setup |
| RECORD, PLAY, STOP (rond, triangle, carre) | (47.0 / 68.1 / 89.2, 105.9) | 17.5 x 11.3, pas 21.1 | Copy, Clear, Paste |
| NO | (117.9, 113.9) | 11.2 | Reload |
| LEFT, DOWN, RIGHT | (134.0 / 150.0 / 165.9, 113.9) | 11.2 | uTime-, Trig Mode, uTime+ |
| PAGE | (194.9, 113.9) | 17.5 x 11.2 | Fill/Setup |
| TRK, PTN, SONG | (20.0, 123.9 / 140.9 / 157.8) | 17.6 x 11.2 | Mute Mode, Bank, Song Edit |
| TRIG 1 a 8 | (47.0 + 21.13 i, 135.3) | 17.6 x 17.6 | bande "1 .... Track/Mute .... 8" entre les rangees |
| TRIG 9 a 16 | (memes x, 157.8) | pas vertical 22.5 | cadre interieur 11.2 sur 1, 5, 9, 13 |

Ce que la figure dit de la topologie :
- trois colonnes : la colonne gauche (potards puis FUNC, KEYBOARD, TRK, PTN, SONG), le centre (ecran, puis une rangee de 4 petites touches, puis le transport), la droite (potards 2 x 4, la rangee des 6 touches de page alignee sur les potards, YES/NO a gauche, la croix des fleches sous FLTR, les LED et PAGE a droite) ;
- les 16 pas commencent a droite de la colonne gauche (sous l'ecran) et finissent au bord droit des potards ;
- la rangee des touches de page est plus haute que la rangee FUNC/pictogrammes (79.4 contre 89.9) ; YES/UP (97.9) et NO/fleches/PAGE (113.9) s'intercalent avec KEYBOARD/transport (105.9) : deux grilles verticales decalees, gauche/centre et droite.
- Rien dans cette disposition pour des scenes A/B ni un crossfader.

---

## 8. Proposition de placement

Les tailles du MM-RYTM sont plus grosses que celles de la DT2 relativement a la face (potards a anneau de 28 contre des capuchons de 12.8, pas de 27.6 x 20 contre 17.6) et la face est plus large mais moins profonde (256 x 156 contre 215 x 176). Deux options.

### Option A (recommandee) : la face 256 x 156 ne change pas de taille, la topologie DT2 a l'identique

Corps, camera, cadrage, voisines, PCB, capot : inchanges. L'ecran 4.3" (106 x 67) garde sa taille (il se deplace). Les potards A a H passent de 28 a 24 d'emprise, les touches a 11 de haut, les pas a 22 x 19. Verifiee par `gridA2.py` (aucune piece hors de la face a 2 mm du bord, aucun chevauchement, legendes orange de 1.25 comprises a 1.3 sous chaque touche). Dessin : `inv/gridA.png`.

| Piece | x | y | w | h | Note |
|---|---|---|---|---|---|
| MAIN VOLUME | cx 19 | cy 19 | d 20 | | potard simple, sans anneau (ou anneau fin), cible `rytm:enc:level` |
| LEVEL/DATA | cx 19 | cy 45 | d 22 | | encodeur a anneau (le niveau de la piste) ; FUNC + = PRESET POOL |
| Logo M (OPEN) | 13.7 | 60 | 10.6 | 9 | avec MM-RYTM ou le firmware dessous si la place le permet |
| FUNC | 8 | 78 | 22 | 11 | large |
| KEYBOARD | 13 | 94 | 12 | 11 | KB SETUP |
| TRK | 8 | 109.5 | 22 | 11 | MUTE MODE |
| PTN | 8 | 124.2 | 22 | 11 | BANK |
| SONG | 8 | 138.9 | 22 | 11 | SONG EDIT (legende a 151.2 a 152.8) |
| Ecran (cadre) | 34 | 8 | 106 | 67 | zone active 93.6 x 56.16 centree, inchangee |
| PRESET/KIT, SETTINGS, SAMPLING (reaffectee), TEMPO | cx 52 / 75.5 / 99 / 122.5 | 78 | 12 | 11 | PERFORM, SAVE PROJ, SAMPLES, TAP TEMPO |
| REC, PLAY, STOP | cx 56.5 / 87 / 117.5 | 94 | 22 | 11 | COPY, CLEAR, PASTE |
| Potards A B C D | cx 156 / 182.67 / 209.33 / 236 | cy 20 | d 24 | | pas 26.67 |
| Potards E F G H | memes cx | cy 46 | d 24 | | pas vertical 26 |
| TRIG SRC FLTR AMP FX MOD | 144 / 162.4 / 180.8 / 199.2 / 217.6 / 236 | 61 | 12 | 11 | pas 18.4 ; QUANTIZE MACHINE SETUP SEQUENCER SEND FX MIXER |
| YES | 144 | 78 | 12 | 11 | SAVE |
| UP | 180.8 | 78 | 12 | 11 | TRIG MODE |
| LED de page (2 x 4) | 216.6 | 79 | 31 | 10 | 8 LED, cadre serigraphie |
| NO, LEFT, DOWN, RIGHT | 144 / 162.4 / 180.8 / 199.2 | 94 | 12 | 11 | RELOAD, uTIME-, TRIG MODE, uTIME+ |
| PAGE | 222 | 94 | 26 | 11 | FILL/SETUP |
| Pas 1 a 8 | 36 + 27.143 i | 111 | 22 | 19 | cadre des temps 1 5 9 13 |
| Pas 9 a 16 | memes x | 133 | 22 | 19 | bord droit 248 |

Ce qui change de taille dans l'option A (dans `faceplate.ts`) :
- `knobs` : d 24, pitch x 26.67, pitch y 26 ; capuchon propose 14.5 (bas) 13.6 (haut) 7 (h), jupe 15.8, anneau 19.8 a 23.2, lettre r 10.6. Controle de silhouette a l'arrivee (69 deg) : 6.8 + 7 / tan 69 = 9.5 mm < 9.9 (bord interieur de l'anneau), l'anneau reste visible.
- `buttons` : deux classes (12 x 11 et 22 x 11) et PAGE 26 x 11 ; meme relief (3.2 de haut, chanfrein 0.6, course 1.4), meme temoin (5.4 x 0.8 ; 12 x 0.8 sur les larges ?), meme corps de legende 1.35.
- `steps` : 22 x 19, pas 27.143, x0 36, rangees 111 et 133 ; legendes : le numero seul (plus de voix BD a CY, 16 pistes libres).
- Ce qui n'a plus de place : la ligne d'aide (y 152), SCENE A/B et le crossfader, le texte FIRMWARE et le wordmark a leur place d'aujourd'hui (la bande y 72 a 82 est prise). Propositions : wordmark MAUDITE MACHINE (56 x 3.3) dans la bande basse du cadre de l'ecran (5.4 mm de haut sous la zone active, comme "Digitakt II" ; demande un decalque au-dessus du cadre, 3.7) ; MM-RYTM et le firmware sous le logo M dans la colonne gauche, ou dans la bande du cadre a droite.

### Option B : les proportions de la DT2 (face 256 x 196)

Toutes les cotes DT2 x 1.2435 (`x' = 8 + (x - 11) x 1.2435`, `y' = 8 + (y - 22) x 1.2435`) : pas de 21.9 au carre au pas de 26.3 x 28, petites touches 13.9, larges 21.9 x 13.9, potards au pas de 32.7 x 31.1 (les anneaux de 27.2 d'aujourd'hui tiennent), cadre d'ecran 91 x 63 (zone active 5:3 de 82 x 49, un ecran de 3.8" au lieu de 4.3"). Fidele a l'oeil, mais :
- `BODY.d` passe de 7.75 a 9.76 unites, `TILT` de 6.63 a environ 5.3 deg : `MACHINE_H` a remesurer, `ORBIT` et l'intro a revoir, `SILK_PLANE.tex` (2048 x 1568, retina 2560 x 1960 : environ 7 Mo de plus), le sol (`FLOOR.contact`), le capot ouvert (`EXPLODE`, `OPEN_VIEW`), la face arriere (`BACK`) ;
- les voisines gardent leur x (`RYTM_V3_BODY`) mais la machine depasse de 40 mm vers l'avant ;
- l'ecran plus petit va contre la demande "plus gros ecran" (2026-10-08, 2026-10-18) et contre "ecran 4.3 pouces 800 x 480" de la face V.4.0.

---

## 9. Correspondance commande par commande (DT2 sans le sampler -> MM-RYTM)

| DT2 | Fonction DT2 | FUNC + | Aujourd'hui dans le MM-RYTM | Proposition (zone, kind, MIDI) | Statut |
|---|---|---|---|---|---|
| MAIN VOLUME | volume general | | MASTER dessine dans l'ecran (`lcd-master`, rdial) ; MIDI `rytm:enc:level` | `mvol`, kind `encoder` param `level` -> `rytm:enc:level` (existe) | nouveau sur la face |
| LEVEL/DATA | niveau de la piste, saisie, defilement | PRESET POOL | aucun ; le niveau est VOL de la page AMP ; le defilement passe par les potards en presets (`presetFaceKnob`) | `data`, kind `data` ; MIDI `rytm:data` (a ajouter) | nouveau |
| FUNC | fonctions orange | | `func` | garde (`func`) | deplacee |
| KEYBOARD | clavier chromatique sur les pas | KB SETUP | aucun (NOTE sur la page TRIG) | `kbd` -> `rytm:keyboard` | nouveau (fonction plus tard) |
| TRK | TRK + pas = piste | MUTE MODE | `trk` (pas 1 a 8) | garde ; pas 1 a 16 avec 16 pistes | deplacee |
| PTN | PTN + pas = pattern | BANK | `pad-edit` (2 fois = KIT) | garde l'id ; KIT part sur PRESET/KIT | deplacee |
| SONG | chanson 1 a 16 | SONG EDIT | la chaine PTN + pas | `song` -> `rytm:song` | nouveau |
| PRESET/KIT | menu presets et kits | PERFORM (kit) | KIT = PTN deux fois (`presetMode`) | `preset` -> `rytm:preset` (a ajouter ; `rytm:edit` x2 garde son effet) | nouveau ; PERFORM a decider (voir 13) |
| SETTINGS | projets, MIDI, systeme | SAVE PROJ | MidiPanel (HTML), apparence, rien sur la face | `settings` -> `rytm:settings` | nouveau (contenu a decider) |
| SAMPLING | echantillonnage | SAMPLES | **abandonne** (enregistrement audio) ; la liste des sons existe (`lcdSamples`, FUNC + SRC = SOUNDS) | reaffectee : `sounds` (le navigateur des sons de la piste) ; FUNC + = la banque de samples (import WAV deja la) | reaffectee |
| TEMPO | menu tempo, swing, metronome | TAP TEMPO | FUNC + TRIG = page TEMPO, YES dessus = TAP | `tempo` -> `rytm:screen:tempo` (existe) ; TAP : `rytm:tap` (a ajouter) | nouveau sur la face |
| RECORD | grid rec ; + PLAY live ; + STOP step | COPY | `rec` | garde | deplacee |
| PLAY | lecture, pause | CLEAR | `run` | garde l'id | deplacee |
| STOP | arret | PASTE | `stop` | garde | deplacee |
| TRIG | page TRIG | QUANTIZE | `pkey-trig` (FUNC = TEMPO) | garde ; FUNC devient QUANTIZE | deplacee, secondaire changee |
| SRC | page SOURCE | MACHINE | `pkey-voice` (FUNC = SOUNDS) | garde ; FUNC = MACHINE (SAMPLE / SYNTH de la voix, deja la) | deplacee, secondaire changee |
| FLTR | page FILTRE | SETUP | `pkey-fltr` (SETUP : V.5.4) | garde | deplacee |
| AMP | page AMP | SEQUENCER (euclidien) | `pkey-env` (EUCLID) | garde | deplacee |
| FX | page FX | SEND FX | `pkey-fx` | garde | deplacee |
| MOD | page LFO | MIXER | `pkey-mod` | garde | deplacee |
| YES | valider | SAVE | `yes` (tenue = FILL) | garde ; FILL passe a PAGE (YES + PAGE, PAGE tenue) | deplacee |
| NO | retour | RELOAD | `no` | garde | deplacee |
| UP / DOWN | navigation ; KB OCTAVE | TRIG MODE | aucun (clavier : fleches prises, 4.4) | `up`, `down`, kind `arrow` -> `rytm:up`, `rytm:down` | nouveau |
| LEFT / RIGHT | navigation ; TRIG + = uTIME ; tenue = nudge | uTIME- / uTIME+ | aucun | `left`, `right` -> `rytm:left`, `rytm:right` | nouveau |
| LED de page | pages du pattern (jusqu'a 8) | | aucun (16 pas seulement ; 64 pas prevus V.5.4) | maillage de 8 LED, sans zone ; snapshot du boitier | nouveau |
| PAGE | page du pattern ; FILL | PAGE SETUP | aucun ; FILL = YES tenue ; `rytm:fill` | `ptnpage`, kind `pagekey` -> `rytm:ptnpage` (a ajouter ; `rytm:page` est pris) ; `rytm:fill` anime PAGE | nouveau |
| TRIG 1 a 16 | pas, choix de piste, clavier | QUICK MUTE | `step-1..16` ; FUNC + pas 1 a 8 = mute | garde les ids ; 16 pistes | replacees |
| Logo Elektron | | | logo M = OPEN (`pad-open`) | garde (`pad-open`) a sa nouvelle place | deplace |
| (rien) | | | SCENE A/B, crossfader (`scene-a`, `xfade`, `scene-b`) | a decider (13) ; MIDI gardes quoi qu'il arrive | sans place DT2 |
| (rien) | | | ligne d'aide de la face | retiree ou dans l'ecran | sans place |
| USB, entrees audio, Overbridge, transferts | | | rien | abandonnes (hors portee) | |

---

## 10. Ce qu'il faut changer (fichiers et fonctions)

Toutes les modifications ci-dessous sont dans les branches desktop (`!PORTRAIT`, `DT_FACE`) ; le telephone ne bouge pas.

### 10.1 Donnees (une seule source)
1. `src/v4/rytm/faceplate.ts`
   - `FpButtonId` : + `kbd song preset settings sounds tempo up down left right page` (et retirer `scene-a/b` de la face si decide) ; `FpMark` : + `up down left right` (chevrons), et si choisi `list gear wave metro piano`.
   - `FpButton` : + `rect` (x, y, w, h) ou `cx, cy` + `size: 'small' | 'wide' | 'page'` ; `alt` reste ; `phase` 2 pour les touches dont la fonction arrive plus tard.
   - `buttons` : `sizes` (small 12 x 11, wide 22 x 11, page 26 x 11), relief et temoin communs, `alt.dy` (1.3 sous la touche) au lieu de `alt.cy` fixe ; `keys` avec leur place.
   - `knobs` : d 24, `cx`, `cy` (option A) ; `cap`, `skirt`, `ring`, `label` a l'echelle ; + `side` (MAIN VOLUME, LEVEL/DATA : centre, d, anneau oui/non).
   - `pageLeds` : cadre et 8 LED (cx, cy, d) ; `steps` : nouvelles cotes, `voices` retire ou garde pour le telephone seulement ; `open` (logo M) a sa place ; `silk` (wordmark, model, firmware, mark) ; + `frames` serigraphies (cadre des fleches, cadre des LED, la bande "TRACK/MUTE").
   - `buttonRect(i)` lit la place propre de la touche ; `faceplateParts()` (+ potards de gauche, LED, logo) ; **brancher `faceplateCheck()` dans un test** (`npm run hw:test` ou un `face:test`) : c'est le seul garde-fou automatique de la grille.
2. `src/v4/theme.ts`
   - `FACE_KEY` : par classe de taille (w, d) ; `FACE_KEYS` : `{ id, x, z, w, d, size, hotspot }` par touche ; `faceKeyX(i)` -> `faceKeyAt(i)`.
   - `DT_PAGE_KEYS` inchange ; `KEY_LABELS` desktop : x, z, w, d de chaque touche (plus `faceKeyX(i)` / `FACE_KEY.z`) ; signes des fleches ; `stepv-*` retires au desktop (et corriger `sequencer3d.ts`, 3.4).
   - `SILK_TEXTS` : legendes orange a la place de chaque touche (`alt.dy`), lettres A a H (suivent `FACE_KNOBS`), MAIN VOLUME / LEVEL/DATA (legendes), KB OCTAVE, TRACK/MUTE, `HEAD` (nouvelles places), ligne d'aide retiree ou deplacee ; `SILK_LINES` desktop : cadres des fleches et des LED.
   - `PAGE_KNOBS`, `ENCODER`, `KNOB_RING` (option A : nouvelles tailles ; verifier `labelW`, `nameDz`, `hitR`).
   - `KEYS` suit `steps` ; `numberZ`/`bracketZ` (ligne d'aide).
   - Teintes nouvelles dans `KEY_LIT`/`DT_HEX` si besoin (KEYBOARD allume, SONG, LED de page : rouge = page affichee, clignotant = page qui joue), variantes creme dans `LIGHT.keyLit`.
   - `FACE_TITLE`, `TWIN_ARIA` : les touches nouvelles et les secondaires changees (TRIG, SRC, PTN, YES).
   - `REC_KEY`, `DT_GESTURE` (+ fenetre generique de touche tenue, nudge, double appui).
   - Option B seulement : `BODY`, `SILK_PLANE`, `MACHINE_H`, `ORBIT`, `INTRO`, `EXPLODE`, `OPEN_VIEW`, `FLOOR`.

### 10.2 La scene 3D
3. `src/v4/scene/rytmFaceKeys.ts` (le gros morceau, a reecrire en partie)
   - un InstancedMesh par classe de taille (`keyCapGeometry` par taille ; la lecon R9) au lieu de `keys` + `sceneKeys` ; `keyMatrix`, `setPress`, `leds` et `labels` a la place propre de chaque touche (z par touche, `LED_Z` par touche) ;
   - `look(i)` pour KEYBOARD (allumee en mode clavier), SONG (mode song), PRESET/KIT (menu ouvert, remplace PTN pour KIT), SETTINGS, SOUNDS (liste ouverte), TEMPO (page TEMPO ; clignote au TAP ?), fleches et PAGE (eclair blanc a l'appui comme STOP YES NO ; PAGE allumee en FILL) ;
   - un maillage des 8 LED de page (`setPatternPages(count, shown, playing, blink)`) ;
   - `hotspots()` : une boite par touche a sa place (kinds nouveaux), le logo M a sa place, scenes et xfade selon la decision ;
   - `skirtGeometry()` suit `faceplateParts()` ; `info()` etendu (sondes).
4. Nouveau `src/v4/scene/sideKnobs.ts` (ou une option d'`Encoders`) : MAIN VOLUME et LEVEL/DATA, leurs anneaux (`RING_TONE`), `hotspots()` (`mvol` kind encoder, `data` kind data), `setValue`, survol ; `encoders.ts` exporte ses geometries (capuchon, jupe, segment d'anneau).
5. `src/v4/scene/encoders.ts` : rien de plus qu'en tailles (lit `FACE_KNOBS`, `ENCODER`, `KNOB_RING`) ; verifier le repere et les cannelures a 24 mm.
6. `src/v4/scene/sequencer3d.ts` : `stepLabels` sans les voix (la condition `STEP_COUNT + INSTRUMENTS.length`) ; `TRK_STEP_OF` et la vue TRK sur 16 pistes (avec le cahier des pistes) ; le reste suit `KEYS`.
7. `src/v4/scene/keyLabels.ts` : `drawMarks` pour les chevrons (et les pictogrammes si choisis) ; `labelQuad` (largeur des signes).
8. `src/v4/scene/silk.ts` : rien sauf les nouvelles encres ; + le decalque du cadre de l'ecran si le wordmark y va (nouveau petit maillage, ou dans `screen.ts` autour du verre).
9. `src/v4/scene/machine.ts` : la fente du crossfader (`slotParts`) retiree si les scenes quittent la face ; le cadre de l'ecran suit `OLED`.
10. `src/v4/scene/renderer.ts` : construire `SideKnobs` et l'ajouter au plateau ; l'ordre des zones (`encDefs`, `faceDefs`, pas) = l'ordre de lecture de la nouvelle face ; `pressFaceKey`/`flashFaceKey` pour les touches nouvelles ; `syncPageKeys` ; les LED de page abonnees au pattern ; `xfadeAxis()` si le crossfader part ; `pressRytmPad('edit')` inchange.
11. `src/v4/scene/screen.ts` + `src/v4/rytm/presetKeys.ts` : la navigation des presets facon DT2 (PRESET/KIT, fleches, LEVEL/DATA, YES/NO) au lieu des pastilles au-dessus des touches (`softKeyU`, `realU` supposent une rangee) ; retirer ou garder `lcd-master` et `lcd-tempo` (rdial) maintenant que MAIN VOLUME et TEMPO sont sur la face.
12. `src/v4/fallback/StaticMachine.tsx` : suit `KEY_LABELS` ; ajouter les potards de gauche, les LED de page, les cadres, les chevrons ; retirer la fente si besoin.

### 10.3 La saisie et les actions
13. `src/v4/scene/hit.ts` : `HotspotKind` + `kbd song preset settings sounds tempo arrow pagekey data` ; `HotspotDef` + `dir?: 'up' | 'down' | 'left' | 'right'`.
14. `src/v4/ui/Hotspots.tsx` : `activate(d)` (les tapes), le pointerdown/up (tenues : PAGE pour FILL, fleches pour le nudge et les repetitions, TRIG/PTN/KEYBOARD/TEMPO comme modificateurs via la fenetre generique) ; le glisser de `mvol` et `data` (comme `penc`, `stage.orbit.claim`) ; les jumeaux desktop dans le nouvel ordre ; `FACE_INERT` + blocage de l'activation pour les touches `phase: 2`.
15. `src/v4/actions.ts` : `kbdKey`, `songKey`, `presetKey` (la touche, a ne pas confondre avec `presetKey(machine, slot)` existant : choisir un autre nom), `settingsKey`, `soundsKey`, `tempoKey` (+ TAP sous FUNC), `arrowKey(dir)` (navigation des menus, uTIME, TRIG MODE, nudge, banque avec PTN), `pageKey` (page du pattern, FILL avec YES, PAGE SETUP sous FUNC), `dataTurn(delta)` ; generaliser `pageArm` ; FUNC + TRIG ne fait plus TEMPO (QUANTIZE), FUNC + SRC ne fait plus SOUNDS (MACHINE) ; PTN deux fois ne fait plus KIT (ou les deux pendant une version).
16. `src/v4/state/dtFace.ts` : `keyboard`, `song`, `menu` (tempo / settings / preset / sounds / null), `ptnPage`.
17. `src/v4/hooks/useKeys.ts` : raccourcis des touches nouvelles sans casser les existants (fleches : a trancher, 4.4 ; P est deja presets ; T, K, G libres a verifier).
18. `src/v4/midi/targets.ts` : a la fin du groupe RYTM : `rytm:keyboard`, `rytm:song`, `rytm:preset`, `rytm:settings`, `rytm:sounds`, `rytm:tap`, `rytm:up`, `rytm:down`, `rytm:left`, `rytm:right`, `rytm:ptnpage`, `rytm:data` (valeur relative) ; `rytm:fill` anime `ptnpage` ; `targetIdOfHotspot` pour chaque kind nouveau ; `npm run docs:midi`.
19. `src/v4/hw/rowLeds.ts`, `hw/snapshot.ts`, `scripts/hw-leds.test.mjs`, `docs/hardware/mmhw-v2-app-side.md` : `ROW_KEYS` devient la liste de la face (ou un `FACE_KEYS_HW` a part pour ne pas casser l'ordre du test), LED des touches nouvelles, 8 LED de page, notes et CC proposes.
20. `src/v4/rytm/infoIds.ts`, `rytm/infos.ts`, `ui/OverviewHelp.tsx` : cartes et aide.
21. `src/v4/debug.ts` : exposer `sideKnobs.info()` et l'etat des LED de page pour les sondes.
22. Pour finir : `node scripts/firmware.mjs bump mm808 major "..."` (V.6.0) et le rapport de session (CLAUDE.md).

---

## 11. Risques

1. **Ids MIDI** : aucun ne disparait ni ne change d'ordre (D1 section 0). Collision : `rytm:page` existe (valeur) ; la touche PAGE prend un autre id. `rytm:fill` enfonce aujourd'hui `yes` (faceHold) : le changer vers la nouvelle zone. `rytm:run`, `rytm:clear`, `rytm:random`, `rytm:mute`, `rytm:solo`, `rytm:edit`, `rytm:open`, `rytm:scene:a/b`, `rytm:xfade` gardent leur effet meme sans touche. Les assignations Roto (`rotoKeys.ts`, gele) ne bougent pas.
2. **Ids de zones** : garder `func trk pad-edit rec run stop pkey-* yes no pad-open penc-0..7 step-1..16` (MIDI LEARN, INFOS, sondes des rapports precedents, `faceHold`). Les nouvelles zones ont des ids nouveaux ; les scenes gardent les leurs si elles restent.
3. **Le boitier** : `npm run hw:test` casse ("quatorze touches") ; les LED du snapshot (rangee, PTN, BANK, pas) a refaire pour la nouvelle face ; les notes 74 et plus ne sont que proposees (`protocol.js` absent du depot).
4. **Le modele "une rangee"** a des echos caches : `presetKeys.ts realU()`, `theme.ts` (FACE_KEY.z, faceKeyX, alt.cy), `rytmFaceKeys.ts` (`LED_Z`, `keyMatrix`, `armRing`), `hw/rowLeds.ts` (ordre). Un oubli ne casse pas le build : il pose une touche ou un temoin au mauvais endroit. D'ou le test `faceplateCheck()` et une sonde qui compare la place projetee de chaque zone a la grille.
5. **`stepLabels` null** si les voix quittent les pas (3.4) : les numeros disparaissent sans erreur.
6. **Le chiffre 8 des potards** (faceKnobs, renderer, motor, debug) : ne pas mettre MAIN VOLUME et LEVEL/DATA dans `FACE_KNOBS`.
7. **Le telephone** : tout derriere `!PORTRAIT` ; une capture avant/apres a 390 x 844 (`?portrait=1`) ; le smoke ne voit que les erreurs. Le modele 16 pistes, lui, touchera le telephone (5).
8. **Clavier** : les fleches changent de machine (tache 45) ; ne pas les voler sans decision.
9. **La souris et les combinaisons DT2** : une fenetre "touche tenue" generalisee (TRIG + fleches, PTN + fleches, PAGE + YES, KEYBOARD + haut/bas, TEMPO + YES, PAGE + REC/PLAY/STOP...) ; risque de gestes accidentels (une touche tapee "tenue" 1.5 s change le sens de la suivante). Garder le hint a l'ecran (`FUNC: + A KEY`, `TRIG: + LEFT/RIGHT = uTIME`).
10. **L'ecran** : le deplacer (x 8 -> 34) ne touche pas son dessin ; changer sa taille ou ses proportions (option B) touche `OLED_UH` et screen.ts ; les pastilles des presets (soft keys) deviennent fausses des que les touches bougent.
11. **La serigraphie sur le cadre de l'ecran** est cachee (y 0.004 sous 0.02) : un decalque a part.
12. **Apparence** : toute couleur nouvelle dans `theme.ts` avec sa variante creme ; verifier la lisibilite des legendes orange (`#A84300`) et des chevrons sur la creme ; le Stage se reconstruit a chaque bascule (pas de fuite : `dispose()` des maillages nouveaux).
13. **Le repli sans WebGL** (`StaticMachine.tsx`) : il suit `KEY_LABELS` mais pas les pieces nouvelles.
14. **Les zones 3D petites** : touches de 12 x 11 mm a 1440 x 900 font environ 30 px ; `HIT.minFine` 32 px pour les jumeaux ; verifier le picking des fleches serrees (pas de 18.4 mm).
15. **Cadrage** : option A inchange (le corps ne bouge pas, `MACHINE_H` mesure le corps et les potards : capuchons plus bas, a remesurer pour etre sur) ; option B a remesurer entierement.
16. **Performances** : 2 a 4 draw calls de plus (classes de touches, LED de page, potards de gauche) : negligeable ; l'atlas des noms grandit un peu (etageres de 2048).
17. **Portes** : `npx tsc --noEmit -p .` (13 erreurs deja presentes), `SEO_OFFLINE=1 npm run build`, `node scripts/smoke-v4.mjs` (6 pages), `npm run hw:test`, `npm run presets:test`, `node scripts/firmware.mjs check` ; sonde Playwright muette (`?mute=1&debug=1&m=mm808`, `--mute-audio`, jamais de son, CLAUDE.md).
18. **Image OG et captures du press kit** (`public/press/mm-studio/og-mm-studio-card.jpg`) montrent l'ancienne face : a refaire si Mika le veut (les vignettes du volet sont rendues en direct, elles suivent).

---

## 12. Estimation et decoupage (face seulement, option A)

| Lot | Contenu | Effort agent |
|---|---|---|
| Donnees | `faceplate.ts` (pieces par touche, tailles, LED, potards de gauche, cadres) + test `faceplateCheck` | 0.5 j |
| Derivees | `theme.ts` (FACE_KEYS, KEY_LABELS, SILK_TEXTS, HEAD, PAGE_KNOBS, ENCODER, KNOB_RING, KEYS, FACE_TITLE, TWIN_ARIA, teintes) | 1 j |
| Touches 3D | `rytmFaceKeys.ts` (classes de taille, z par touche, looks, LED de page, zones) | 1.5 j |
| Potards de gauche | `sideKnobs.ts` + glisser + MIDI | 0.75 j |
| Signes, serigraphie, decalque | `keyLabels.ts`, `silk.ts`, cadre de l'ecran, repli SVG | 0.75 j |
| Saisie | `hit.ts`, `Hotspots.tsx` (tapes, tenues, jumeaux, inertes), `useKeys.ts` | 1 j |
| Actions de face | branchement des touches aux fonctions existantes (TEMPO, KIT, SOUNDS, FILL, MASTER), stubs "BIENTOT" pour KEYBOARD, SONG, SETTINGS, fleches hors menus | 1 j |
| Presets facon DT2 | `presetKeys.ts`, `screen.ts` (navigation PRESET/KIT + fleches + DATA + YES/NO) | 0.75 j |
| MIDI, boitier, aide | `targets.ts`, `docs:midi`, `rowLeds.ts`, snapshot, `hw-leds.test.mjs`, doc hardware, INFOS | 1 j |
| Verification | portes, sonde muette, captures noir/creme desktop et telephone | 1 j |
| Relecture + corrections | revue independante, corrections, reverification | 1 j |
| **Total** | environ 3000 lignes touchees | **9 a 11 jours** |

Option B : + 2 jours (corps, cadrage, intro, capot, remesures) et plus de risques visuels.

Decoupage propose pour la face (a caler avec les autres inventaires, les pistes et les pages) :
- **V.6.0 "la face DT2"** : toute la face replacee (option choisie), les touches existantes a leur nouvelle place avec leurs fonctions, MAIN VOLUME, TEMPO, PRESET/KIT, SOUNDS (ex-SAMPLING), PAGE (FILL), YES/NO, fleches dans les menus ; KEYBOARD, SONG, SETTINGS dessinees en `phase: 2` (inertes, BIENTOT) ; telephone intact.
- **V.6.1** : KEYBOARD (clavier sur les pas, KB SETUP), fleches completes (uTIME, TRIG MODE, nudge, banques), LEVEL/DATA (niveau de piste, PRESET POOL), LED de page avec les patterns de 64 pas (V.5.4 prevu).
- **V.6.2** : SONG (et SONG EDIT), SETTINGS (projet, MIDI), PERFORM.

---

## 13. Decisions a faire trancher par Mika (pour le cahier)

1. **Taille de la face** : A (256 x 156, ecran 4.3" garde, potards a 24 mm) ou B (256 x 196 aux proportions DT2, ecran 3.8", corps plus profond).
2. **SCENE A, SCENE B et le crossfader** (pas dans la DT2) : (a) quittent la face, moteur et MIDI gardes, accessibles par un menu (par exemple FUNC + PRESET/KIT = PERFORM : les scenes y vivent) ; (b) restent sur la face dans une petite zone (il n'y en a pas dans la grille A sans serrer) ; (c) partent sous le capot.
3. **SAMPLING** : reaffectee en SOUNDS (le navigateur des sons de ta banque, FUNC + = l'import de samples) ou retiree (la place reste vide comme une touche aveugle).
4. **Pictogrammes ou mots** sur PRESET/KIT, SETTINGS, SOUNDS, TEMPO, KEYBOARD : la DT2 a des pictogrammes, Mika a demande des mots en V.4.2 ("les icones des fois c'est difficile a deviner"). Proposition : des mots (PRESET, SETUP, SOUNDS, TEMPO, KEYS), chevrons pour les fleches, rond/triangle/carre pour le transport.
5. **Le wordmark, MM-RYTM, le firmware** : dans la bande du cadre de l'ecran (comme "Digitakt II") ou dans la colonne gauche sous le logo M.
6. **La ligne d'aide** de la face : retiree (l'aide passe par INFOS et l'ecran) ou gardee en petit dans la bande TRACK/MUTE.
7. **MAIN VOLUME** : potard simple (comme la DT2) ou avec anneau comme les autres.
8. **Raccourcis des fleches** au clavier (aujourd'hui : changer de machine).
9. **Le telephone** : intact pour la face (recommande) ; le modele 16 pistes demandera tout de meme une solution pour les pistes 9 a 16 au doigt.
