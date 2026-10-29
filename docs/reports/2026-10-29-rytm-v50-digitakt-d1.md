# 2026-10-29 : MM-RYTM V.5.0, la face façon Digitakt (étape D1)

Mika : « Je veux une machine qui ressemble à la Digitakt dans ses fonctions mais je veux garder mon design de machine ! par contre change les couleurs et les boutons de RYTM ». Proposition validée : « ok pour tout, fonce sur l'étape 1 ». Le cahier : `docs/v4/digitakt-d1-spec.md` ; la référence : `docs/v4/digitakt-reference.md`.

Le desktop seulement. Le téléphone ne change pas : sa capture `?portrait=1` est identique au pixel près à celle de la V.4.3, sauf le texte FIRMWARE V.5.0.

## 1. Ce qui a été fait

### La face (`rytm/faceplate.ts`, `theme.ts`, `scene/rytmFaceKeys.ts`, `scene/keyLabels.ts`, `scene/silk.ts`)

- **La rangée** : 14 touches de 10,4 × 12 mm au pas de 12 mm depuis x = 8, en y = 84. Dans l'ordre : FUNC, TRK, PTN, ● REC, ▶ PLAY, ■ STOP, TRIG, SRC, FLTR, AMP, FX, MOD, YES, NO. Elles gardent le même relief. Les hotspots gardés : `trk`, `pad-edit` (PTN), `run` (PLAY), `pkey-voice`, `pkey-fltr`, `pkey-env`, `pkey-fx`. Les nouveaux : `func`, `rec`, `stop`, `pkey-trig`, `pkey-mod`, `yes`, `no`.
- **Les légendes secondaires** : imprimées en orange sous chaque touche (MUTE, BANK, COPY, CLEAR, PASTE, TEMPO, SOUNDS, SETUP, EUCLID, SEND FX, MIXER, SAVE, RELOAD), à y = 98,6 ; sur la machine crème, l'encre `#A84300` (revue : le `#D9560A` d'avant lisait à 2,4:1 une fois éclairé).
- **Le logo M** : CLEAR, RANDOM, MUTE, SOLO et OPEN quittent la face. `pad-open` se pose sur le logo M : un clic ouvre le capot, lueur au survol, pas de LED.
- **La ligne d'aide** : `● REC: WRITE STEPS · WITHOUT REC: STEPS 1-8 PLAY THE VOICES · HOLD A STEP + KNOB: P-LOCK · FUNC + STEP 1-8: MUTE`. Elle tient sur la face.
- **Les couleurs de la Digitakt**, toutes dans `theme.ts` (`DT_HEX` et sa version crème dans `applyAppearance`) :
  - FUNC : capuchon orange (`[0.95, 0.16, 0]`, assez loin du rouge des touches allumées), légende noire, témoin éteint au repos (une lentille sombre sur le capuchon), blanc plein tenue, blanc clignotant gardée, sur les deux machines ;
  - touches de page rouges, rouge faible en HOME ; REC rouge ; PLAY vert (clignotant en pause) ; STOP, YES et NO : éclair blanc à l'appui ; TRK et PTN rouges ;
  - SCENE A et B et leur cadre en bleu ;
  - les pas : coups en rouge avec la rampe de vélocité, tête de lecture blanche (elle remplace le rouge d'un pas allumé ; en pause, elle reste sur le dernier pas entendu), pas en LOCK jaune, les marques des verrous en jaune ;
  - l'appui d'une touche ou d'un pas : neutre (un éclat blanc faible sur la noire, un gris qui fonce sur la crème) ; l'orange n'est qu'à FUNC et aux légendes secondaires ;
  - la vue PTN des pas (3D) : qui joue rouge, suivant et chaîne rouges clignotants, plein blanc faible. La grille HTML de l'éditeur, posée par-dessus pendant PTN, a les mêmes couleurs depuis la revue (voir plus bas) ;
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
- **Le clavier** : Alt = FUNC, W = REC, Espace = PLAY, Maj + Espace = STOP, Entrée = YES, Échap = NO. Alt tenu avec Espace, Maj + Espace, Entrée, W ou E fait FUNC + la touche (revue, G5).
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
- **`docs/hardware/mmhw-v2-app-side.md`** : les notes 61 à 73, proposées et à confirmer avec `protocol.js` ; les LED des scènes en bleu ; les touches de l'écran de KIT ; `rytm:step` qui suit REC.
- **`docs/midi/`** régénéré par `npm run docs:midi`.
- **`src/v4/firmware.json`** : MM-RYTM 4.3 → 5.0.

### Les commits de la branche `worktree-agent-a3f84c671ac17ce70`

`295586a`, `b7887cb`, `72fafe7`, `2c0ddab`, `f527b45`, `e96e836`, `a8a8bbd`, `45bba20`, `00bd989`, `b4a8127`, le rapport `8e1a95f`, puis la revue : `5aaa514`, `6f77a94`, `d1af4be`, `ef9967d`, `ba102f4`, `5e78774`, `cba1a6b`, `c657dd6`, l'empreinte du firmware et ce rapport mis à jour.

### La revue de D1 (deux revues indépendantes, corrigées le même jour)

- **Les gestes** (`actions.ts`, `audio/clock.ts`, `state/patterns.ts`, `ui/Hotspots.tsx`, `ui/Dock.tsx`, `midi/seqlink.ts`, `midi/targets.ts`, `hooks/useKeys.ts`) :
  - G1 : le point de sauvegarde appartient à son pattern ; FUNC + NO ou une page puis NO sur un autre emplacement disent `SAVED ON A01` et ne posent rien ;
  - G2 : une FUNC gardée pour une touche s'en va après toute entrée qui ne s'en sert pas (une touche de KIT, SCENE A ou B, le logo M, un potard tourné au MIDI, au boîtier, à la souris, au doigt ou à la molette, une voix au clavier, une cible MIDI) ; un pas, lui, s'en sert (FUNC + pas = le mute rapide) ; elle ne traîne plus jusqu'à un PLAY qui ferait CLEAR ;
  - G3 : une pause dans les ~300 ms avant le pas 1 d'une mesure annoncée ramène la chaîne (`clock.onUnbar`, `patterns.unbar`) : plus de pattern sauté ;
  - G4 : une page puis NO ne recharge qu'avec la touche NO ou `rytm:no`, un point de sauvegarde posé et rien d'ouvert ; Échap au clavier suit toujours la chaîne d'Échap ;
  - G5 : Alt + Espace, Maj + Espace, Entrée, W, E ;
  - G6 : SEND FX et MIXER s'arment pour YES (au hasard) et NO (rechargés) ; TEMPO garde YES = TAP, sans hasard ;
  - G7 : rien ne s'arme sous KIT ;
  - G8 : le Dock (une fenêtre de desktop sous 768 px) écrit toujours ses pas comme avant ;
  - G9 : le mute du pattern coupe aussi une voix tapée au clavier ou au MIDI ;
  - G10 : REC éteint ferme le P-LOCK ; Suppr sur un pas, L et l'entrée en P-LOCK demandent REC au desktop ;
  - G11 : hors REC, un pas 1 à 8 ne ferme plus la liste des sons, elle suit la voix.
- **KIT et le MIDI** : K1 (les touches de l'écran de la V.4.2), K2 (`rytm:page:trig` passe par la touche TRIG), K3 (`rytm:step:N` suit REC), K4 (le lien SHARE garde le mute du pattern, drapeau 32, un lien sans mute est le même octet pour octet), K5 (le mute du pattern ne joue qu'au desktop).
- **Les couleurs** (`theme.ts`, `scene/rytmFaceKeys.ts`, `scene/sequencer3d.ts`, `scene/renderer.ts`, `ui/BeatEditor.tsx`, `v4.css`, `hw/snapshot.ts`) : R1 le témoin de FUNC (éteint au repos ; sur la crème, une touche allumée a une lentille sombre éteinte et du vrai blanc allumé, l'encre grisait) ; R2 l'appui neutre ; R3 l'encre orange de la crème ; R4 la grille PTN de l'éditeur ; R5 TRK ferme le mode MUTE ; R6 la tête de lecture ; R7 l'orange de FUNC ; R8 la lueur du logo M neutre, les marques des verrous en jaune ; R9 SCENE A et B ont leur propre touche de 12 × 12 (avant : la touche de 10,4 étirée, chanfrein, coins et témoin compris) ; R10 le boîtier lit la palette de `theme.ts` (`DT_HEX_DARK`).
- **Les textes** : T1 les cartes INFOS du desktop disent SRC, SRC SYNTH, AMP, SEND FX, PTN, FUNC + ▶ (CLEAR) et le potard A (`rytm/infos.ts deskWords`, plus des textes propres pour SYNTH, VOICE FX, le potard vide et les scènes) ; T2 le pied de l'écran dit `● REC + HOLD STEP: P-LOCK` hors REC ; T3 `CLOSE PTN TO P-LOCK A STEP` ; T4 la doc du boîtier.

## 2. Décisions prises et pourquoi

- **REC au clavier = W.** R est RESET VIEW depuis toujours, et le cahier permet une autre touche libre.
- **Les touches de l'écran de KIT** (décision de la revue, K1) : celles de la V.4.2, sur les mêmes hotspots, pour que le MIDI appris et la touche E gardent leur effet : SRC (`pkey-voice`) LOAD, FLTR SAVE, AMP (`pkey-env`) NAME, FX DEL, PTN (`pad-edit`) EXIT. YES valide en plus (LOAD dans la liste, OK et OVERWRITE dans les dialogues), NO revient en arrière. La première version de D1 les avait mises sur TRK, PTN, ●, TRIG et SRC : `rytm:edit` devenait SAVE, `rytm:page:voice` EXIT et E SAVE ; c'est corrigé.
  - FLTR, AMP et FX sont sous les potards, à droite de l'écran : leurs pastilles se rangent dans l'ordre des touches sur la moitié droite de l'écran, le nom de la touche écrit au-dessus de chaque pastille ; PTN garde la sienne au-dessus de sa touche.
- **FUNC gardée par deux tapes + NO** : la relâche, sans RELOAD (le cahier dit que NO relâche une FUNC gardée). FUNC tenue ou gardée pour une touche + NO : RELOAD.
- **Échap au clavier** fait NO, mais garde le bout de la chaîne d'Échap (le retour à la vue d'ensemble). La touche NO de la machine ne quitte pas la machine.
- **PASTE colle ce qui a été copié**, pattern ou ligne, quel que soit l'état de REC. Le cahier lie la sorte de collage à REC ; avec un presse-papiers qui ne garde qu'une chose, c'est plus simple et rien ne se perd. Écart à confirmer.
- **REC allumé, une tape pose le pas à la vélocité des nouveaux pas** : HIGH au départ, ou celle que règle VEL sur TRIG (la cible `step:vel`). Le cahier dit HIGH ; c'est HIGH tant que VEL n'a pas bougé.
- **Hors REC, un pas 1 à 8 joue sa voix même pendant la lecture.** C'est la Digitakt, et le cahier dit « la voix joue ». Avant, un pad en lecture ne faisait que choisir sa voix. Dans les modes MUTE et SOLO d'avant (M, Maj + M), le pas bascule sa voix comme un pad.
- **FX = VOICE FX seul, SEND FX = l'ancien GLOBAL FX.** Les pages de DIST, CHORUS, DELAY et REVERB s'ouvrent toujours d'une tape sur le potard : sous FX pour la voix, sous SEND FX pour la machine.
- **MIXER 2/2 MASTER réutilise l'écran `fxm`** de la V.4.2. `rytm:screen:fxm` ouvre donc maintenant MIXER MASTER au desktop : c'est la cible « mixermaster » du cahier, sous le nom cohérent qui existait déjà.
- **Les pages de FUNC n'allument aucune touche** (TEMPO, SEND FX, MIXER), comme sur la Digitakt.
- **`rytm:page:trig` est la touche TRIG** au desktop (revue, K2) : FUNC + TRIG = TEMPO, TRIG puis YES = RANDOM, TRIG encore = HOME, par le MIDI appris et la note 66 du boîtier aussi. C'était un alias de VOICE ; le téléphone garde l'alias.
- **`rytm:step:N` suit REC** (décision de la revue, K3) : c'est la touche de pas de la face, et le boîtier passe par elle ; REC éteint, un pas 1 à 8 joue sa voix et rien ne s'écrit. Les cibles `rytm:seq:*` (le Roto-Control) écrivent toujours.
- **Le point de sauvegarde appartient à son pattern** (décision de la revue, G1) : sur un autre emplacement, FUNC + NO et une page puis NO disent `SAVED ON A01`, rien ne change.
- **Une FUNC gardée pour une touche** est consommée par toute touche, scène, le logo M, un pas ou un potard (décision de la revue, G2) ; quand FUNC n'y a pas de sens, l'entrée fait son action normale et FUNC s'en va. Une FUNC gardée par deux tapes reste.
- **Une page puis NO** (décision de la revue, G4) : rechargée seulement par la touche NO ou `rytm:no`, avec un point de sauvegarde et rien d'ouvert par-dessus (KIT, PTN, la liste des sons, TRK gardée, une scène gardée, le P-LOCK, un mode MUTE ou SOLO, les INFOS, la page d'un FX, le capot) ; Échap au clavier ne recharge jamais.
- **SEND FX et MIXER** s'arment pour YES et NO comme une touche de page (décision de la revue, G6) ; TEMPO garde YES = TAP et n'a pas de hasard.
- **Le mute du pattern ne joue qu'au desktop** (décision de la revue, K5) : il reste gardé avec le pattern, le preset, l'UNDO et le lien SHARE, mais le téléphone, qui ne peut ni le montrer ni l'enlever, joue comme avant.
- **La page au hasard (une page puis YES)** tire les réglages de la voix choisie dans des bornes musicales (`RANDOM_SPAN`). SRC tire aussi le son de la voix. SEND FX, TEMPO et MIXER tirent les leurs.
- **La page rechargée (une page puis NO)** reprend les réglages de la voix de cette page au point de sauvegarde (SEND FX : les FX et STRETCH ; TEMPO : le BPM et le SWING ; MIXER : les niveaux). Le son de SRC et les potards de machine de SRC SYNTH ne reviennent qu'avec FUNC + NO (tout le point).
- **La vue TRK au desktop** : la barre verte marque une voix qui joue quand d'autres sont coupées ou en solo, la blanche une voix en solo. C'est ma lecture de « vert pour MUTE (la voix joue) ».
- **Le boîtier** reçoit les couleurs de la machine noire (il n'a pas de crème). L'éclair de STOP, YES et NO n'est pas dans l'instantané : le boîtier le fait lui-même.
- **La référence MIDI** n'avait pas été régénérée depuis le 23 octobre. La régénération ajoute donc aussi les cibles de la V.4.2 qui lui manquaient : `rytm:screen:fxm`, `rytm:trk`, les scènes, le crossfader, `rytm:voice:select`, `dj:dj-machsync`. Sur 649 ids d'avant, aucun ne disparaît ni ne change d'ordre (vérifié) ; il y en a 679 en tout.
- **Le pied de l'écran**, hors REC, dit `● REC + HOLD STEP: P-LOCK` depuis la revue (T2).
- **La tête de lecture en pause** reste sur le dernier pas entendu, sur la face seulement : l'écran et le Dock lisent encore -1 hors lecture (rien n'y change pour eux).
- **TRK gagne sur le mode MUTE** (R5) : TRK enfoncée ferme le mode MUTE ; la face, l'instantané du boîtier et le geste montrent TRK.
- **La lueur du logo M** est le blanc de la machine noire, l'encre sur la crème (neutre sur les deux).

## 3. Ce qui reste à faire / points en suspens

- **Mika** :
  - confirmer les notes 61 à 73 avec `protocol.js` quand le dossier `hardware/mm-rytm-hw/` sera poussé ;
  - écouter le fondu de STOP deux fois (80 ms), que les tests ne font jamais entendre.
- **Mika, à valider** : PASTE indépendant de REC ; un pas hors REC qui joue sa voix pendant la lecture ; depuis la revue, les pastilles de KIT de FLTR, AMP et FX rangées sur la moitié droite de l'écran (leur touche est sous les potards) ; la lentille sombre du témoin de FUNC sur la crème ; la tête de lecture qui reste sur le pas de la pause.
- **Pas fait en D1** :
  - le coin A, B ou AB des blocs de scène en bleu à l'écran (le cahier le laisse facultatif ; l'écran reste noir et os) ;
  - la mesure du « vraiment tenir » une touche de page au clavier (pas de raccourci de page).
- **Grille PTN** : la grille HTML de l'éditeur couvre les pas 3D pendant la vue PTN, comme EDIT avant. Ce qu'en disait la première version de ce rapport était faux (les couleurs de la vue PTN ne se voient pas éditeur fermé : la vue PTN, c'est l'éditeur ouvert). Depuis la revue, la grille HTML a les couleurs de la Digitakt au desktop : coups, voix choisie et son nom rouges, tête de lecture blanche (l'encre sur la crème), pattern qui joue rouge plein, suivant et chaîne rouges clignotants, plein blanc faible, verrous jaunes ; le téléphone garde les siennes.
- **Les étapes suivantes du cahier** : V.5.1 (TRIG C à H, deux LFO), V.5.2 (BANK, SETUP, les pages de pas), V.5.3 (EUCLID).

## 4. Commandes utiles ajoutées

- `npm run hw:test` lance aussi `scripts/hw-leds.test.mjs` (les LEDs de la rangée, du mode MUTE et de la vue PTN) : 17 + 8 tests.
- Debug : `window.__v4.rytm.func` (`get().mode`), `window.__v4.rytm.dtFace` (`rec()`, `mute()`), `window.__v4.rytm.transport` (`running`, `paused`, `resumeStep`).
- MIDI : `rytm:func`, `rytm:rec`, `rytm:play`, `rytm:stop`, `rytm:yes`, `rytm:no`, `rytm:page:mod`, `rytm:mutemode`, `rytm:save`, `rytm:reload`, `rytm:copy`, `rytm:paste`, `rytm:screen:trig`, `rytm:screen:mod`, `rytm:screen:tempo`, `rytm:screen:mixer`.

## Vérification après la revue (sur une copie propre de `dd01bab`, `git archive`)

- `npx tsc --noEmit -p .` : 13 erreurs, les mêmes 13 qu'avant (Admin, EventsDisplay, MainApp, NewsMessages, AppContext, adminApi, sanityClient, RadarPage ×2, drums, fx ×2, dj/engine), aucune dans ce qui a changé.
- `SEO_OFFLINE=1 npm run build` : OK (built in 17,6 s).
- `node scripts/smoke-v4.mjs --url http://127.0.0.1:8841 --machines mm808,voy,dj` : `6 pages, aucune erreur`.
- `npm run hw:test` : 17 + 8 tests, tous bons. `npm run presets:test` : `12 tests, tous bons`, `5 tests, tous bons`. `node scripts/firmware.mjs check` : OK, MM-RYTM V.5.0 (205 fichiers), MM-ARP V.2.3, MM-BASS V.3.0.
- **Sonde Playwright muette de la revue** (`--mute-audio`, `?mute=1&debug=1&m=mm808` ; `setSkipDraw(true)` sauf pour les pixels ; la lecture tourne sans aucun son ; `probe_d1r.cjs`, hors du dépôt) : 44 vérifications sur 44 en un passage, sans erreur de page, puis la section G3 relancée seule avec sa vérification de la pause rendue (2 sur 2) :
  - G1 : FUNC + NO et FLTR puis NO sur A02 disent `SAVED ON A01`, A02 intact ;
  - G2 : FUNC tapée puis SCENE A, le logo M, un potard (`hw.pot`), un pas, une voix au clavier, `rytm:pad:SD` : FUNC s'en va ; dans KIT, FUNC tapée puis SRC (LOAD), puis PLAY joue sans CLEAR ;
  - G3 : la chaîne A01 > A02 mise en pause juste avant le pas 1 de A02 revient sur A01, puis A02 joue une mesure entière (1 843 ms pour une mesure de 1 846 ms) ; la même sonde sur la D1 d'avant la revue échoue (A02 sauté) ;
  - G4 : Échap juste après FLTR suit la chaîne d'Échap (plus de `NOTHING SAVED`), ne recharge jamais ; FLTR puis la touche NO recharge (`FLTR RELOADED FROM A01`) ; les INFOS ouvertes, `rytm:no` ne recharge pas ;
  - K1 : LOAD SAVE NAME DEL EXIT sur SRC, FLTR, AMP, FX, PTN (le nom puis YES = OK, NO revient), `rytm:edit` et E = EXIT, `rytm:page:voice` = LOAD, `rytm:page:fltr` = SAVE ;
  - K2 : FUNC + `rytm:page:trig` = TEMPO ; `rytm:page:trig` puis `rytm:yes` = RANDOM ; sur sa page, HOME puis la page ;
  - R6 : en pause la tête reste sur le dernier pas entendu, STOP l'enlève ;
  - les pixels, machine noire puis crème : R1 le témoin de FUNC (noire : éteint 46,48,54, tenu 250,249,246, gardé entre 250,249,246 et 121,120,120 ; crème : éteint sombre, tenu blanc, gardé entre les deux) ; R2 l'appui neutre (noire 35,34,38 → 83,82,83 ; crème 231,229,223 → 150,150,148, saturation 0,01) ; R6 la tête sur un pas allumé (noire 209,207,205 ; crème 46,46,45, saturation 0,02) ; R7 l'orange de FUNC à 21° (crème 25°) contre le rouge d'une touche allumée à 1° ; R3 l'encre orange de la crème à 4,7:1 sur le panneau (noire 7,5:1) ;
  - le téléphone (`?portrait=1`, 390 × 844), noire et crème, au repos et un pas enfoncé : identique au pixel près à la D1 d'avant la revue ; contre main (V.4.3), 13 à 15 pixels changent, dans le texte FIRMWARE V.5.0.
- **La grille PTN de l'éditeur** (capture) : coups, voix choisie, nom de la voix et pattern qui joue en rouge (`rgb(255, 43, 43)`, crème `rgb(216, 30, 30)`), la chaîne bordée de rouge ; plus d'orange ni de jaune.

## Vérification de la première version de D1 (sur une copie propre de `b4a8127`, `git archive`)

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
