# 2026-10-29 : MM-RYTM V.5.0, la face façon Digitakt (étape D1)

Mika : « Je veux une machine qui ressemble à la Digitakt dans ses fonctions mais je veux garder mon design de machine ! par contre change les couleurs et les boutons de RYTM ». Proposition validée : « ok pour tout, fonce sur l'étape 1 ». Le cahier : `docs/v4/digitakt-d1-spec.md` ; la référence : `docs/v4/digitakt-reference.md`.

Le desktop seulement. Le téléphone ne change pas : sa capture `?portrait=1` est identique au pixel près à celle de la V.4.3, sauf le texte FIRMWARE V.5.0.

## 1. Ce qui a été fait

### La face (`rytm/faceplate.ts`, `theme.ts`, `scene/rytmFaceKeys.ts`, `scene/keyLabels.ts`, `scene/silk.ts`)

- **La rangée** : 14 touches de 10,4 × 12 mm au pas de 12 mm depuis x = 8, en y = 84. Dans l'ordre : FUNC, TRK, PTN, ● REC, ▶ PLAY, ■ STOP, TRIG, SRC, FLTR, AMP, FX, MOD, YES, NO. Elles gardent le même relief. Les hotspots gardés : `trk`, `pad-edit` (PTN), `run` (PLAY), `pkey-voice`, `pkey-fltr`, `pkey-env`, `pkey-fx`. Les nouveaux : `func`, `rec`, `stop`, `pkey-trig`, `pkey-mod`, `yes`, `no`.
- **Les légendes secondaires** : imprimées en orange sous chaque touche (MUTE, BANK, COPY, CLEAR, PASTE, TEMPO, SOUNDS, SETUP, EUCLID, SEND FX, MIXER, SAVE, RELOAD), à y = 98,6, avec un orange plus sombre sur la machine crème.
- **Le logo M** : CLEAR, RANDOM, MUTE, SOLO et OPEN quittent la face. `pad-open` se pose sur le logo M : un clic ouvre le capot, lueur au survol, pas de LED.
- **La ligne d'aide** : `● REC: WRITE STEPS · WITHOUT REC: STEPS 1-8 PLAY THE VOICES · HOLD A STEP + KNOB: P-LOCK · FUNC + STEP 1-8: MUTE`. Elle tient sur la face.
- **Les couleurs de la Digitakt**, toutes dans `theme.ts` (`DT_HEX` et sa version crème dans `applyAppearance`) :
  - FUNC : capuchon orange, légende noire, témoin blanc (plein tenue, clignotant gardée) ;
  - touches de page rouges, rouge faible en HOME ; REC rouge ; PLAY vert (clignotant en pause) ; STOP, YES et NO : éclair blanc à l'appui ; TRK et PTN rouges ;
  - SCENE A et B et leur cadre en bleu ;
  - les pas : coups en rouge avec la rampe de vélocité, tête de lecture blanche, pas en LOCK jaune ;
  - la vue PTN : qui joue rouge, suivant et chaîne rouges clignotants, plein blanc faible ;
  - la vue TRK : rouge 1, 0,22 et 0,07, flash blanc ; barre verte sur une voix qui joue quand d'autres sont coupées, blanche en solo ;
  - les anneaux des potards : base blanc, lock jaune, 45 %, 30 %, scène bleue, 15 % ; la bande du crossfader en bleu (`scene/encoders.ts`).
- **La face de repli** sans WebGL (`fallback/StaticMachine.tsx`) : FUNC orange, le rond de REC, les légendes orange, les pas rouges.

### Les états (`state/func.ts`, `state/dtFace.ts`, `audio/clock.ts`, `audio/pattern.ts`, `state/patterns.ts`, `state/presets.ts`, `state/undo.ts`)

- **FUNC** : tenue = momentanée ; une tape la garde pour la touche suivante ; deux tapes rapides (400 ms) la gardent jusqu'à une nouvelle tape. Plusieurs sources : le pointeur, Alt au clavier, le MIDI.
- **REC et le mode MUTE** (`dtFace`) : REC n'est pas sauvegardé, il est éteint à chaque visite.
- **La pause de PLAY** : `clock.pause()` et `clock.resume()` reprennent au pas qui suit celui qu'on vient d'entendre. STOP oublie la pause.
- **Le mute du pattern** (`pmutes`) : gardé avec son emplacement (patterns), les presets et l'UNDO. Une voix est coupée si le jeu global ou celui du pattern la coupe ; le solo passe avant. Un pattern, un preset ou une sauvegarde d'avant n'en ont pas et se relisent tels quels.
- **STOP deux fois** : les queues de la REVERB et du DELAY s'effacent en un fondu court de 80 ms (`cutTails`, `sends.ts cut()`). Les envois restent.

### Les gestes et les pages (`actions.ts`, `rytm/pages.ts`, `state/rytmPage.ts`, `rytm/pageView.ts`, `scene/screen.ts`)

- **Chaque touche avec et sans FUNC**, comme dans la table du cahier :
  - FUNC + TRK : MUTE (global, puis du pattern, puis sortie) ; + PTN : BANK ; + ● : COPY ; + ▶ : CLEAR ; + ■ : PASTE ;
  - + TRIG : TEMPO ; + SRC : SOUNDS ; + FLTR : SETUP ; + AMP : EUCLID ; + FX : SEND FX ; + MOD : MIXER ; + YES : SAVE ; + NO : RELOAD ;
  - FUNC + pas 1 à 8 : mute rapide (`BD MUTED`, `BD BACK`) ; FUNC + 13 à 16 : `PAGES 1-4: V.5.2`.
- **Les pas hors REC** : 1 à 8 jouent leur voix à HIGH et la choisissent, sans écrire. 9 à 16 disent `● REC TO WRITE STEPS`, au plus une fois toutes les 2 s. Sans REC, pas de P-LOCK ni de vélocité ; l'écran le dit une fois. REC allumé, une tape pose ou retire le pas.
- **Une touche de page puis YES ou NO** dans les 1,5 s, ou en la tenant vraiment :
  - YES : la page au hasard ; TRIG puis YES : RANDOM ;
  - NO : la page rechargée du point de sauvegarde.
- **YES** : valide dans KIT ; sur TEMPO, c'est un TAP (la moyenne après 4 tapes, de 100 à 150 BPM).
- **NO** : la chaîne d'Échap.
- **Les pages** :
  - TRIG : A NOTE (verrouillable), B VEL ;
  - MOD : vide, `MOD: 2 LFO IN V.5.1` ;
  - TEMPO : A BPM, B SWING ;
  - SEND FX : l'ancien GLOBAL FX, ses pages de FX comprises ;
  - MIXER : 1/2 LEVELS, les huit VOL `m:<voix>` sur `rytm:voice:<voix>:level` ; 2/2 MASTER, A MASTER et B TEMPO ;
  - SRC et AMP : les noms de VOICE et ENV ; FX ne montre plus que VOICE FX.
- **L'écran** : pastilles, titres, menu HOME, `GLOBAL MUTE` et `PATTERN MUTE` au pied, `PTN 2X: KIT`, PTN dans l'anneau des patterns.

### Le branchement (`ui/Hotspots.tsx`, `hooks/useKeys.ts`, `midi/targets.ts`, `debug.ts`)

- **La souris et le doigt** : FUNC se tient comme TRK. Dans le mode MUTE, une tenue de 400 ms sur un pas met la voix en SOLO.
- **Les jumeaux HTML** sont dans l'ordre de la rangée, avec `data-hotspot`, rôle et aria-label (`TWIN_ARIA`).
- **Le clavier** : Alt = FUNC, W = REC, Espace = PLAY, Maj + Espace = STOP, Entrée = YES, Échap = NO.
- **Les cibles MIDI**, ajoutées à la fin de leur groupe :
  - `rytm:func` (tenue), `rytm:rec`, `rytm:play`, `rytm:stop`, `rytm:yes`, `rytm:no` ;
  - `rytm:page:mod`, `rytm:mutemode`, `rytm:save`, `rytm:reload`, `rytm:copy`, `rytm:paste` ;
  - `rytm:screen:trig`, `rytm:screen:mod`, `rytm:screen:tempo`, `rytm:screen:mixer`.
- **`__v4.rytm.func`, `__v4.rytm.dtFace` et `__v4.rytm.transport`** pour les tests.

### L'aide, le boîtier, la doc

- **Les cartes INFOS** (`rytm/infos.ts`, `rytm/infoIds.ts`, `rytm/diagrams.ts`) :
  - nouvelles : FUNC, ● REC, ■ STOP, YES, NO, TRIG, MOD, le VOL du MIXER ;
  - mises à jour : TRK, PTN, ▶ PLAY, SRC, FLTR, AMP, FX, SEND FX, les pas, le P-LOCK, KIT, MASTER, TEMPO, l'écran, HOME, le logo M.
  - Le téléphone garde ses textes.
- **L'aide de la vue d'ensemble** (`ui/OverviewHelp.tsx`).
- **Le boîtier** (`hw/rowLeds.ts`, pur, et `hw/snapshot.ts`) :
  - `leds.keys` : les 14 touches, leur couleur et leur éclat ;
  - `leds.view` et `leds.grid` : le mode MUTE et la vue PTN ;
  - les pas sous TRK en rouge.
- **`docs/hardware/mmhw-v2-app-side.md`** : les notes 61 à 73, proposées et à confirmer avec `protocol.js`.
- **`docs/midi/`** régénéré par `npm run docs:midi`.
- **`src/v4/firmware.json`** : MM-RYTM 4.3 → 5.0.

### Les commits de la branche `worktree-agent-a3f84c671ac17ce70`

`295586a`, `b7887cb`, `72fafe7`, `2c0ddab`, `f527b45`, `e96e836`, `a8a8bbd`, `45bba20`, `00bd989`, `b4a8127`, et ce rapport.

## 2. Décisions prises et pourquoi

- **REC au clavier = W.** R est RESET VIEW depuis toujours, et le cahier permet une autre touche libre.
- **Les touches de l'écran de KIT** : TRK LOAD, PTN SAVE, ● NAME, TRIG DEL, SRC EXIT ; YES valide, NO revient.
  - PLAY et STOP restent le transport.
  - LOAD et OVERWRITE restent loin de CANCEL et EXIT : leurs pastilles larges ne se touchent pas.
- **FUNC gardée par deux tapes + NO** : la relâche, sans RELOAD (le cahier dit que NO relâche une FUNC gardée). FUNC tenue ou gardée pour une touche + NO : RELOAD.
- **Échap au clavier** fait NO, mais garde le bout de la chaîne d'Échap (le retour à la vue d'ensemble). La touche NO de la machine ne quitte pas la machine.
- **PASTE colle ce qui a été copié**, pattern ou ligne, quel que soit l'état de REC. Le cahier lie la sorte de collage à REC ; avec un presse-papiers qui ne garde qu'une chose, c'est plus simple et rien ne se perd. Écart à confirmer.
- **REC allumé, une tape pose le pas à la vélocité des nouveaux pas** : HIGH au départ, ou celle que règle VEL sur TRIG (la cible `step:vel`). Le cahier dit HIGH ; c'est HIGH tant que VEL n'a pas bougé.
- **Hors REC, un pas 1 à 8 joue sa voix même pendant la lecture.** C'est la Digitakt, et le cahier dit « la voix joue ». Avant, un pad en lecture ne faisait que choisir sa voix. Dans les modes MUTE et SOLO d'avant (M, Maj + M), le pas bascule sa voix comme un pad.
- **FX = VOICE FX seul, SEND FX = l'ancien GLOBAL FX.** Les pages de DIST, CHORUS, DELAY et REVERB s'ouvrent toujours d'une tape sur le potard : sous FX pour la voix, sous SEND FX pour la machine.
- **MIXER 2/2 MASTER réutilise l'écran `fxm`** de la V.4.2. `rytm:screen:fxm` ouvre donc maintenant MIXER MASTER au desktop : c'est la cible « mixermaster » du cahier, sous le nom cohérent qui existait déjà.
- **Les pages de FUNC n'allument aucune touche** (TEMPO, SEND FX, MIXER), comme sur la Digitakt.
- **`rytm:page:trig` ouvre maintenant la vraie page TRIG** au desktop. C'était un alias de VOICE. Le téléphone garde l'alias.
- **La page au hasard (une page puis YES)** tire les réglages de la voix choisie dans des bornes musicales (`RANDOM_SPAN`). SRC tire aussi le son de la voix. SEND FX, TEMPO et MIXER tirent les leurs.
- **La page rechargée (une page puis NO)** reprend les réglages de la voix de cette page au point de sauvegarde (SEND FX : les FX et STRETCH ; TEMPO : le BPM et le SWING ; MIXER : les niveaux). Le son de SRC et les potards de machine de SRC SYNTH ne reviennent qu'avec FUNC + NO (tout le point).
- **La vue TRK au desktop** : la barre verte marque une voix qui joue quand d'autres sont coupées ou en solo, la blanche une voix en solo. C'est ma lecture de « vert pour MUTE (la voix joue) ».
- **Le boîtier** reçoit les couleurs de la machine noire (il n'a pas de crème). L'éclair de STOP, YES et NO n'est pas dans l'instantané : le boîtier le fait lui-même.
- **La référence MIDI** n'avait pas été régénérée depuis le 23 octobre. La régénération ajoute donc aussi les cibles de la V.4.2 qui lui manquaient : `rytm:screen:fxm`, `rytm:trk`, les scènes, le crossfader, `rytm:voice:select`, `dj:dj-machsync`. Sur 649 ids d'avant, aucun ne disparaît ni ne change d'ordre (vérifié) ; il y en a 679 en tout.
- **Le pied de l'écran sur le TRIG**, hors REC, dit encore `HOLD STEP: P-LOCK`. La ligne d'aide de la face et la carte INFOS disent que le P-LOCK demande REC.

## 3. Ce qui reste à faire / points en suspens

- **Mika** :
  - confirmer les notes 61 à 73 avec `protocol.js` quand le dossier `hardware/mm-rytm-hw/` sera poussé ;
  - écouter le fondu de STOP deux fois (80 ms), que les tests ne font jamais entendre.
- **Mika, à valider** : PASTE indépendant de REC ; un pas hors REC qui joue sa voix pendant la lecture.
- **Pas fait en D1** :
  - le coin A, B ou AB des blocs de scène en bleu à l'écran (le cahier le laisse facultatif ; l'écran reste noir et os) ;
  - la mesure du « vraiment tenir » une touche de page au clavier (pas de raccourci de page).
- **Un mute de pattern sauvé au desktop puis chargé au téléphone** coupe la voix sans que le téléphone le montre : il n'a pas le mode MUTE.
- **Grille PTN** : la grille HTML de l'éditeur couvre les pas pendant la vue PTN, comme EDIT avant. Les couleurs de la vue PTN se voient quand l'éditeur est fermé, ou sur le boîtier.
- **Les étapes suivantes du cahier** : V.5.1 (TRIG C à H, deux LFO), V.5.2 (BANK, SETUP, les pages de pas), V.5.3 (EUCLID).

## 4. Commandes utiles ajoutées

- `npm run hw:test` lance aussi `scripts/hw-leds.test.mjs` (les LEDs de la rangée, du mode MUTE et de la vue PTN) : 17 + 8 tests.
- Debug : `window.__v4.rytm.func` (`get().mode`), `window.__v4.rytm.dtFace` (`rec()`, `mute()`), `window.__v4.rytm.transport` (`running`, `paused`, `resumeStep`).
- MIDI : `rytm:func`, `rytm:rec`, `rytm:play`, `rytm:stop`, `rytm:yes`, `rytm:no`, `rytm:page:mod`, `rytm:mutemode`, `rytm:save`, `rytm:reload`, `rytm:copy`, `rytm:paste`, `rytm:screen:trig`, `rytm:screen:mod`, `rytm:screen:tempo`, `rytm:screen:mixer`.

## Vérification (sur une copie propre de `b4a8127`, `git archive`)

- `npx tsc --noEmit -p .` : 13 erreurs, toutes déjà présentes avant.
- `SEO_OFFLINE=1 npm run build` : OK.
- `node scripts/smoke-v4.mjs --url http://127.0.0.1:8741 --machines mm808,voy,dj` : 6 pages, aucune erreur.
- `npm run hw:test` : 25 tests sur 25. `npm run presets:test` : 12 et 5, tous bons. `node scripts/firmware.mjs check` : OK, MM-RYTM V.5.0.
- **Sonde Playwright muette** (`--mute-audio`, `?mute=1&debug=1&m=mm808`, `setSkipDraw(true)`) : 40 vérifications sur 40, sans erreur de page. Elle couvre :
  - les 14 hotspots et leurs jumeaux ;
  - le logo M ;
  - REC éteint : un pas joue (le compteur de coups, la voix BD) sans s'écrire ;
  - REC allumé : un pas s'écrit puis se retire ;
  - FUNC + ▶ = CLEAR ; FUNC + ● puis FUNC + ■ = COPY et PASTE ;
  - FUNC + TRK : vert puis magenta, une voix coupée ;
  - PTN deux fois = KIT ; TRIG puis YES = RANDOM ;
  - FUNC + YES puis FUNC + NO = SAVE et RELOAD ;
  - les pages TEMPO, SEND FX, MIXER et MASTER ;
  - FUNC gardée puis relâchée par NO ;
  - le capot.
- **Le téléphone** (`?portrait=1`, 390 × 844 DPR 3) : identique au pixel près à la V.4.3 avant la montée de version. Après elle, seuls 72 pixels changent : le texte FIRMWARE V.5.0.
