# MM-RYTM façon Digitakt, étape D1 : la face (FIRMWARE V.5.0)

2026-10-29.
- **Demande de Mika** : « Je veux une machine qui ressemble à la Digitakt dans ses fonctions mais je veux garder mon design de machine ! par contre change les couleurs et les boutons de RYTM ».
- **Proposition validée** : « ok pour tout, fonce sur l'étape 1 », sur la page https://claude.ai/artifact/5cR8BzWxCuUX8i8dgE6ep3.
- **Référence** : `docs/v4/digitakt-reference.md`.

**Portée.** Le desktop seulement. **Le téléphone (PORTRAIT, le Dock, la face portrait) ne change pas** : il garde son comportement actuel, au pixel près. Toute nouveauté se branche derrière `!PORTRAIT` ou `FACE_FOLLOWS_PAGE`.

## 0. Règles qui ne se discutent pas

- **Aucun id MIDI existant ne disparaît ni ne change d'ordre** : `src/v4/midi/targets.ts`, `docs/midi/MIDI-targets.csv`, `src/v4/midi/rotoKeys.ts`.
  - Les nouvelles cibles s'ajoutent à la fin de leur groupe.
  - `rytm:clear`, `rytm:random`, `rytm:mute`, `rytm:solo`, `rytm:open`, `rytm:edit` et `rytm:run` gardent leur effet actuel, même si leur touche quitte la face.
- **Les ids de hotspots gardés** :
  - `trk` ;
  - `pad-edit` (devient PTN) ;
  - `run` (devient ▶ PLAY) ;
  - `pkey-voice` (devient SRC), `pkey-fltr`, `pkey-env` (devient AMP), `pkey-fx` ;
  - `scene-a`, `xfade`, `scene-b` ;
  - `step-1` à `step-16`, `penc-0` à `penc-7` ;
  - `pad-open` (déplacé sur le logo M).
- **Les sauvegardes existantes se relisent** : patterns, presets, UNDO, pages, mutes.
- **Aucune lecture audio réelle pendant les tests.** Chromium `--mute-audio`, `?mute=1`, rendus hors ligne seulement (CLAUDE.md).
- **Jamais de tiret cadratin ni demi-cadratin**, nulle part : code, commentaires, textes, commits.
- **Pour finir** : `node scripts/firmware.mjs bump mm808 major "..."` (V.5.0), puis un rapport `docs/reports/2026-10-29-rytm-v50-digitakt-d1.md`.

## 1. La rangée de touches (`src/v4/rytm/faceplate.ts`, source unique en mm)

**Géométrie de la rangée.**
- 14 touches de 10,4 × 12 mm, au pas de 12 mm, à partir de x = 8 (la dernière finit à 174,4) ; y = 84 comme aujourd'hui.
- SCENE A (x 180), le crossfader (fente 196 à 232) et SCENE B (x 236) ne bougent pas.
- Même relief qu'en V.4.2 (`keyCap.ts`, `KEY_RELIEF`), même bande LED, mêmes légendes imprimées sur le capuchon : hauteur de capitale environ 1,35 mm, à ajuster pour que FUNC, TRIG et RELOAD tiennent dans 9 mm.

**Légende secondaire.** Imprimée en orange sur la face, sous chaque touche, centrée, capitale 1,2 à 1,3 mm, à environ y = 98,6 (entre la touche, qui finit à 96, et les pas, qui commencent à 104). Orange #FF6A13 sur la machine noire, un orange plus sombre et lisible sur la machine crème.

| # | Légende | Hotspot | Secondaire (FUNC +) | Remplace |
|---|---|---|---|---|
| 0 | FUNC | `func` (nouveau) | - | - |
| 1 | TRK | `trk` | MUTE | TRK |
| 2 | PTN | `pad-edit` | BANK | EDIT |
| 3 | ● (REC) | `rec` (nouveau) | COPY | - |
| 4 | ▶ (PLAY) | `run` | CLEAR | RUN/STOP, CLEAR |
| 5 | ■ (STOP) | `stop` (nouveau) | PASTE | - |
| 6 | TRIG | `pkey-trig` (nouveau) | TEMPO | RANDOM (TRIG + YES) |
| 7 | SRC | `pkey-voice` | SOUNDS | VOICE |
| 8 | FLTR | `pkey-fltr` | SETUP | FLTR |
| 9 | AMP | `pkey-env` | EUCLID | ENV |
| 10 | FX | `pkey-fx` | SEND FX | FX |
| 11 | MOD | `pkey-mod` (nouveau) | MIXER | - |
| 12 | YES | `yes` (nouveau) | SAVE | - |
| 13 | NO | `no` (nouveau) | RELOAD | Échap à la souris |

**Quittent la face :** CLEAR (`clear`), RANDOM (`random`), MUTE (`mute`), SOLO (`solo`) et OPEN.
- Leurs fonctions passent par les combinaisons de la section 3.
- Le hotspot `pad-open` se pose sur le logo M, à droite de la bande du logo (environ x 239 à 248, y 72 à 82). Clic = ouvrir ou fermer le capot. Curseur main, lueur au survol. Pas de LED.

**Le reste de la bande du logo.** Le texte FIRMWARE et la ligne d'aide restent. La ligne d'aide, en bas, devient :
`● REC: WRITE STEPS · WITHOUT REC: STEPS 1-8 PLAY THE VOICES · HOLD A STEP + KNOB: P-LOCK · FUNC + STEP 1-8: MUTE`.
Ajuste-la si elle déborde.

**Le reste de la face.** Les potards A à H, l'écran, les 16 pas et leurs cadres 1, 5, 9 et 13 ne bougent pas.

## 2. Les couleurs : le langage de la Digitakt

Les valeurs vivent dans `theme.ts` : `HEX`, `KEY_LIT`, `STEP_LIT`, `TRK_LIT`, `TRK_FLASH`, `RING_TONE`, la palette claire de `applyAppearance`. Il y a aussi des couleurs dans `sequencer3d.ts`, `rytmFaceKeys.ts` et `rytmPageKeys.ts`. Aucune couleur nouvelle en dur hors de `theme.ts`.

Couleurs de la machine noire :

| Couleur | Valeur | Sert à |
|---|---|---|
| Rouge | #FF2B2B | coups, REC, page affichée, voix choisie, pattern qui joue |
| Jaune | #FFD75E (existe) | locks |
| Blanc | #F4F1EA | tête de lecture, anneaux, flashs |
| Vert | #3DDC5A | PLAY, mode MUTE global |
| Magenta | #E04DD8 | mute du pattern |
| Bleu | #4DA3FF | scènes |
| Orange | #FF6A13 | FUNC et secondaires **seulement** |

Sur la machine crème, prends les mêmes teintes, plus sombres et lisibles (par exemple rouge #D81E1E, vert #1F9E3A, bleu #2F78D6, magenta #B23AAB, orange #D9560A ; le blanc devient l'encre sombre #191919 pour les anneaux et la tête de lecture).

**Les touches.**
- **FUNC** : capuchon orange en permanence, légende noire. LED blanche tenue, qui clignote quand FUNC est gardée.
- **Touches de page** (TRIG SRC FLTR AMP FX MOD) : LED et lueur rouges sur la page affichée, éteintes ailleurs. Le niveau HOME actuel (0,32) devient un rouge faible.
- **● REC** : rouge fixe en mode écriture, éteint sinon.
- **▶ PLAY** : vert pendant la lecture ; vert clignotant en pause.
- **■ STOP** : flash blanc à l'appui.
- **TRK** : LED rouge tenue ou gardée ; clignote gardée, comme aujourd'hui.
- **PTN** : LED rouge quand la grille des patterns ou KIT est ouverte.
- **YES et NO** : flash blanc à l'appui.
- **SCENE A et B** : touche armée et cadre en bleu au lieu de l'orange et de l'os ; le témoin suit ce qu'on entend, en bleu.

**Les pas.**
- Note trig : rouge, avec la rampe de vélocité actuelle de `STEP_LIT` en rouge.
- Tête de lecture : blanc pur (au lieu du blanc chaud).
- Marque de lock : jaune, comme aujourd'hui.
- Pas en LOCK : clignote en jaune au lieu de l'orange.
- Vue EDIT (devenue PTN), comme sur la Digitakt : pattern qui joue rouge 1 ; pattern suivant ou chaîne rouge clignotant ; pattern plein blanc faible ; vide éteint.
- Vue TRK : voix choisie rouge 1 ; autres voix rouge 0,22 ; voix coupée 0,07 ; flash blanc sur un coup, comme le flash actuel.
- Barre MUTE ou SOLO de la vue TRK : vert pour MUTE (la voix joue) ; la voix SOLO en blanc.

**Les anneaux des potards** (`RING_TONE`) :

| Ton | Couleur |
|---|---|
| base | blanc |
| lock | jaune |
| unlocked | blanc à 45 % |
| global | blanc à 30 % |
| scene | bleu |
| dim | blanc à 15 % |

La bande du crossfader passe en bleu.

**L'écran.** Il reste noir et os. Une valeur verrouillée garde son style actuel ; un bloc de scène porte son coin A, B ou AB en bleu si c'est simple, sinon on n'y touche pas.

## 3. Les gestes

### Combinaisons et souris

Avec une souris, on ne tient pas deux touches à la fois. TRK et SCENE ont déjà la règle « une tape garde, tenir = momentané » (`state/holdLatch.ts`), et la même règle vaut pour les nouveaux modificateurs.

**FUNC.**
- Une tape garde FUNC pour **la touche suivante**, puis FUNC se relâche.
- Tenir = momentané.
- Deux tapes rapides gardent FUNC jusqu'à une nouvelle tape.
- Échap ou NO relâche une FUNC gardée.
- Au clavier, `Alt` (Option) tenu = FUNC.

**Touche de page + YES / NO.** Une touche de page tapée reste « tenue » pour YES ou NO pendant 1,5 s : TRIG, puis YES dans les 1,5 s = TRIG + YES. Au toucher et au clavier, tenir vraiment marche aussi. PLAY n'est **jamais** pris dans cette fenêtre.

### Les touches

| Touche | Seule | FUNC + |
|---|---|---|
| **FUNC** | Rien seule. L'écran dit `FUNC: + A KEY` | - |
| **TRK** | Comme aujourd'hui : gardée ou tenue + pas 1 à 8 = choisir la voix, double tape = mute (gardé pour la compatibilité) | **MUTE** : mode mute global. Les pas 1 à 8 sont les voix : vert = joue, éteint = coupée ; une tape bascule ; tenir une voix (plus de 400 ms) = SOLO de cette voix (blanc), tenir encore = fin du SOLO. Encore FUNC + TRK, ou NO, ou Échap : sortie, les mutes restent. FUNC + TRK deux fois (ou FUNC + TRK en mode global) = **mute du pattern** (magenta) : un jeu de mutes sauvé avec le pattern (patterns, presets, UNDO). Une voix est coupée si l'un des deux jeux la coupe. L'écran le dit : `GLOBAL MUTE` ou `PATTERN MUTE`. Le pied de l'écran montre l'état comme le MUTE d'aujourd'hui |
| **PTN** | Comme EDIT aujourd'hui : la grille des patterns ; une tape sur un pas change de pattern (à la mesure en lecture) ; plusieurs tapes font une chaîne ; tenir un emplacement vide copie. **Deux fois rapides = KIT**, tes presets, comme EDIT deux fois aujourd'hui | **BANK** : les banques A à H arrivent en D3. L'écran dit `BANKS A-H: V.5.2` |
| **● REC** | Bascule le mode écriture des pas (LED rouge). Gardé seulement pendant la session (pas sauvegardé) ; éteint au chargement. **REC allumé** : les pas se posent et se retirent ; tenir et glisser = vélocité ; tenir immobile = P-LOCK. Une tape = on / off, comme la Digitakt, à la vélocité HIGH, au lieu du cycle actuel OFF, HIGH, MID, LOW. **REC éteint** : voir « Les pas hors REC » plus bas | **COPY** : hors REC, le pattern (pas, locks, scènes, mutes du pattern) ; REC allumé, la ligne de la voix choisie (pas et locks). L'écran dit `PATTERN A03 COPIED` ou `BD COPIED`. Le presse-papiers ne garde qu'une chose |
| **▶ PLAY** | Lecture ; à l'arrêt, repart du pas 1. Pendant la lecture : **pause**, la LED clignote vert ; PLAY reprend au pas de la pause. Garde le comportement actuel de `runToggle` sur SoundCloud (pause de la piste). MIDI : `rytm:run` garde son effet actuel ; `rytm:play` s'ajoute | **CLEAR** : hors REC, efface le pattern (l'actuel `clearPattern`, une étape d'UNDO) ; REC allumé, efface la ligne de la voix choisie (pas et locks, une étape d'UNDO). SCENE armée + FUNC + ▶ = vider la scène (la règle actuelle de SCENE + CLEAR) |
| **■ STOP** | Arrêt, retour au pas 1. Deux fois en moins de 600 ms = arrêt + coupe des queues (réverbe, delay) avec un fondu court, si c'est simple à faire dans `engine.ts` ; sinon seulement l'arrêt, noté dans le rapport | **PASTE** : colle ce qui a été copié. Hors REC : un pattern copié remplace le pattern courant ; REC allumé : une ligne copiée remplace la ligne de la voix choisie. Une étape d'UNDO. Rien à coller : `NOTHING TO PASTE` |
| **TRIG** | Ouvre la page TRIG : A NOTE (le TUNE de la voix, verrouillable), B VEL (la vélocité, la cible `step:vel` actuelle). C à H sont vides en D1 : LEN, PROB, COND, μTIME, RTRG et RATE arrivent en V.5.1. TRIG + YES (ou TRIG puis YES dans les 1,5 s) = **RANDOM** : un beat au hasard, sons compris, l'actuel `randomPattern` | **TEMPO** : page TEMPO, A BPM (`rytm:enc:tempo`, et SYNC du MIXER comme aujourd'hui), B SWING. Sur cette page, chaque tape sur YES est un TAP : moyenne après 4 tapes, arrondie au BPM, bornée 100 à 150 comme aujourd'hui |
| **SRC** | La page VOICE d'aujourd'hui (onglets MAIN puis SYNTH), renommée SRC sur la touche et à l'écran | **SOUNDS** : ouvre la liste des sons de la voix, le navigateur actuel |
| **FLTR** | Inchangée | **SETUP** : arrive en D3. `SETUP (TRACK LENGTH): V.5.2` |
| **AMP** | La page ENV d'aujourd'hui, renommée AMP | **EUCLID** : arrive en D4. `EUCLID: V.5.3` |
| **FX** | Les FX de la voix seulement (VOICE FX). Les pages DIST, CHORUS, DELAY et REVERB s'ouvrent toujours d'une tape sur le potard | **SEND FX** : la page GLOBAL FX d'aujourd'hui |
| **MOD** | La page MOD est vide en D1 : `MOD: 2 LFO IN V.5.1` | **MIXER** : 1/2 LEVELS, A à H = VOL de BD SD CH OH CP TOM HT CY (`rytm:voice:<V>:level`) ; 2/2 MASTER, A = MASTER (avec ce que la page MASTER fait déjà, SYNC compris), B = TEMPO pour qu'il ne disparaisse pas. FUNC + MOD encore, ou MOD rappuyé sur MIXER : l'onglet suivant |
| **YES** | Dans KIT (presets) et les menus : valider (LOAD, OK, OVERWRITE...). Sur une page, après une touche de page dans les 1,5 s : la page au hasard ; sur TRIG, le RANDOM du beat. Sinon : `YES: TAP A PAGE KEY FIRST TO RANDOMIZE IT` | **SAVE** : point de sauvegarde en mémoire (pas, locks, scènes, mutes du pattern, FX, voix, kit : ce que `undo.ts` capture déjà). L'écran dit `SAVED A03` |
| **NO** | Retour : la même chaîne qu'Échap (`actions.ts`, la chaîne d'Échap). Après une touche de page dans les 1,5 s : recharge cette page depuis le point de sauvegarde, s'il y en a un | **RELOAD** : revient au point de sauvegarde, une étape d'UNDO. Pas de point : `NOTHING SAVED: FUNC + YES FIRST` |

### FUNC + un pas

- FUNC + pas 1 à 8 = mute rapide de la voix (le jeu global), partout, même hors mode mute. L'écran dit `BD MUTED` ou `BD BACK`.
- FUNC + pas 9 à 16 en D1 : `PAGES 1-4: V.5.2` (pas 13 à 16) ; rien de plus sur 9 à 12.

### Les pas hors REC (desktop)

- **Tape sur un pas 1 à 8** : la voix joue (le chemin d'un pad : `padHit` ou `trigger`, à la vélocité HIGH) et devient la voix choisie, comme la Digitakt II (TRK SELECT NORMAL). Le pas ne s'écrit pas.
- **Les LEDs** continuent de montrer le motif de la voix choisie et la tête de lecture, pour qu'on voie toujours ce qui joue.
- **Pas 9 à 16** : rien ne se joue. L'écran dit `● REC TO WRITE STEPS`, au plus une fois toutes les 2 s.
- **Tenir un pas hors REC** : pas de P-LOCK. Le P-LOCK demande REC, comme la Digitakt ; l'écran le dit une fois.
- **TRK + pas, PTN + pas, mode mute + pas, KIT** : pas de changement, ces vues gagnent sur REC.

### Ce qui garde son clavier

Espace = ▶ PLAY. Les autres raccourcis actuels marchent encore : E = PTN, O = capot, M = MUTE, Maj+M = SOLO, Cmd+Z = UNDO. Ajouts :
- `Alt` tenu = FUNC ;
- `R`, s'il est libre, sinon une autre touche libre = ● REC ;
- Maj+Espace = ■ STOP ;
- Entrée = YES (déjà Entrée dans KIT) ;
- Échap = NO.

Mets-les à jour dans l'aide, sans en casser aucun.

## 4. L'écran

- Les pilules de page disent TRIG, SRC, FLTR, AMP, FX, MOD, et TEMPO ou MIXER ou SEND FX quand c'est leur page.
- Le menu HOME (`HOME_MENU`) suit les nouveaux noms.
- Les titres des pages (`SCREEN_TITLE`), les messages et les cartes INFOS suivent aussi.

## 5. MIDI, boîtier, aide

**Cibles ajoutées** (à la fin, sans toucher aux autres) :
- `rytm:func` (hold) ;
- `rytm:rec` (press, bascule) ;
- `rytm:play` (press) ;
- `rytm:stop` (press) ;
- `rytm:yes` et `rytm:no` (press) ;
- `rytm:page:mod` et `rytm:screen:trig`, `rytm:screen:mod`, `rytm:screen:tempo`, `rytm:screen:mixer`, `rytm:screen:mixermaster` (ou des noms cohérents avec les autres `rytm:screen:*`) ;
- `rytm:mutemode` (press), `rytm:save` et `rytm:reload` (press), `rytm:copy` et `rytm:paste` (press).

`rytm:page:trig` existe comme alias de VOICE : il ouvre maintenant la vraie page TRIG. Note-le dans le rapport. `docs/midi/MIDI-targets.csv` se régénère avec l'outil du repo, s'il existe ; sinon complète-le à la main dans le même format.

**Le boîtier** (`docs/hardware/mmhw-v2-app-side.md`, `src/v4/hw/snapshot.ts`) :
- **Notes des nouvelles touches.** Les notes 61 à 67 sont libres depuis le retrait des pads. Propose FUNC 61, PTN 62, ● 63, ▶ 64, ■ 65, TRIG 66, SRC 67, FLTR 68, AMP 69, FX 70, MOD 71, YES 72, NO 73, sans toucher à TRK 60, SCENE 79 et 80, CC 28, CC 20 à 27 et CC 30 à 37. Écris-les dans la doc, marquées « proposées, à confirmer avec protocol.js ».
- **LEDs du snapshot.** Une LED par touche de la rangée avec sa couleur et son niveau. La couleur des pas sous TRK suit le rouge. Ajoute les vues mute (vert ou magenta) et PTN si c'est simple. `npm run hw:test` doit passer, à mettre à jour pour les nouvelles couleurs.

**L'aide** :
- `rytm/infos.ts` et `rytm/infoIds.ts` : une carte INFOS par nouvelle touche, mises à jour pour les touches changées. Français, tutoiement, sans tiret cadratin.
- `TWIN_ARIA` : les jumeaux HTML de chaque nouvelle touche, avec `data-hotspot`, rôle et aria-label.
- `OverviewHelp`.

## 6. Vérification attendue

- `npx tsc --noEmit -p .` : 13 erreurs, toutes déjà présentes avant.
- `SEO_OFFLINE=1 npm run build` OK.
- `node scripts/smoke-v4.mjs --url ... --machines mm808,voy,dj` : 6 pages sans erreur.
- `npm run hw:test` et `npm run presets:test` OK ; `node scripts/firmware.mjs check` OK.
- Une sonde muette Playwright (`?mute=1&debug=1&m=mm808`, `--mute-audio`, `window.__v4.stage.setSkipDraw(true)`) qui vérifie au DOM et dans les stores :
  - les 14 hotspots ;
  - REC éteint : un pas joue sans s'écrire ;
  - REC allumé : un pas s'écrit ;
  - FUNC + ▶ = CLEAR ;
  - FUNC + ● puis FUNC + ■ = COPY et PASTE ;
  - FUNC + TRK = mode mute, avec ses couleurs ;
  - PTN deux fois = KIT ;
  - TRIG puis YES = RANDOM ;
  - FUNC + YES puis FUNC + NO = SAVE et RELOAD ;
  - le logo M ouvre le capot.
- Le téléphone (`?portrait=1`) : la même face et les mêmes gestes qu'avant. Le smoke le couvre ; un coup d'œil à une capture suffit.
