# MM-RYTM, refonte Digitakt II : la préparation P0 (FIRMWARE V.5.3, inchangé)

2026-10-30. Le cahier : `docs/v4/dt2/dt2-master-spec.md` (sections 4, 5.0, 5.5, 5.6, critique C3 et C4). Point de départ : V.5.3 en ligne (ecfb30a). Branche `worktree-agent-aeacc1bc04ed05c4c`, rien de poussé, `main` pas touché. Rien ne change à l'oreille ni à l'œil : seulement des déplacements, des contrats et des registres vides.

## 1. Ce qui a été fait

- **Fixtures et sonde d'identité** (laissées par le builder coupé, relues, complètes, commitées telles quelles) :
  - `scripts/fixtures/make-rytm-legacy.mjs` fabrique en headless sur V.5.3 `rytm-legacy-full.json` (11 clés `mm.v4.*` : 128 emplacements, kit KIT_V 4, voix avec LFO, 5 presets dont un d'avant R3 et un d'avant le 2026-10-18, UNDO à 6 étapes, MIDI appris avec `rytm:kit:hh`, relu à l'identique) et `rytm-legacy-share.json` (3 liens SHARE v1) ;
  - `scripts/rytm-ident.mjs` rend hors ligne (`renderOffline`, `--mute-audio`, `?mute=1`) 20 cas : arrivée, verrouillé, TRIG/LFO, scènes, les 10 presets d'usine, la fixture et ses 5 presets ; référence figée sur ecfb30a (`rytm-ident.golden.json`), `--against` compare deux builds échantillon par échantillon.
- **Découpage pur** (un commit par fichier, dans l'ordre conseillé) :
  - `midi/targets.ts` → `midi/targets/` : le corps de `coreTargets` tel quel dans `rytm.ts`, `voy.ts`, `nav.ts` ; `index.ts` assemble les groupes dans un ordre figé, puis `face60 tracks60 phone60 pages61 seq61 face61 kit62 song62 settings62 face62`, vides ;
  - `debug.ts` → `debug/index.ts` + un fichier par lane (`audio`, `face`, `input`, `screen`), vides, copiés sur `window.__v4` ;
  - `theme.ts` → `theme/face.ts` (FACE_KEY, FACE_KEYS, KEYS, TRANSPORT, ENCODER, KNOB_RING, PAGE_KNOBS, FACE_KNOBS, PAGE_KEYS, KEY_LABELS, FACE_TITLE, SILK_TEXTS, TWIN_ARIA) et `theme/base.ts` (ce que la face lit à l'évaluation) ; `theme.ts` les ré-exporte ;
  - `rytm/infos.ts` → `rytm/infos/` : les cartes par domaine (`pages voice sound fx tweaks face soon layers controls`), `words.ts`, `types.ts`, `index.ts`, et `v60 v61 v62` réservés ;
  - `scene/screen.ts` → `scene/screen/` : `core.ts` (la classe), `consts.ts`, `draw home head dials grid glyphs foot popups`, `menus/{presets,sounds,mixer,mutes}` et `menus/registry.ts` (le registre des menus, vide) ;
  - `actions.ts` (5751 l.) → `actions/` : 17 modules publics, `internal/` (14), `ctlall`, `shared`, `state`, `wire` ; `actions.ts` devient le baril (`export *`) ;
  - `dj/actions.ts` : le SYNC prend `SYNC_BPM` (100-150) au lieu de `BPM`.
- **Contrats** (types et tables, sans comportement, importés par personne) : `audio/tracks.ts`, `rytm/dtFaceIds.ts`, `state/dtFace.ts` (`DtFaceStateDt2`), `state/gesture.ts`, `state/clipboard.ts`, `actions/chords/` (un fichier par lane), `midi/targets/reserved.ts`.
- **Registres** : `scene/zones/` et `ui/twins/` (un fichier par lane, vides), branchés par 4 lignes dans `scene/renderer.ts` et 10 dans `ui/Hotspots.tsx`.
- **Firmware** : `stamp` (empreinte reposée), version inchangée V.5.3.
- **Les modules créés** (lignes) :
  - `actions/` : face 536, browser 528, locks 415, anyDial 414, scenes 348, dials 317, nav 300, kit 281, steps 271, tracks 209, patterns 177, pages 149, phone 149, presets 135, ctlall 115, transport 113, wire 113, live 91, mixer 43, state 37, shared 28 ; `internal/` : locks 294, kit 280, pages 221, live 202, scenes 143, face 122, dials 119, patterns 72, mixer 66, tracks 41, browser 35, transport 32, presets 24, steps 14 ; le baril 29 ;
  - `scene/screen/` : core 601, consts 587, home 551, head 437, grid 388, glyphs 368, dials 285, foot 248, draw 232, popups 128, proto 7, `menus/` sounds 205, presets 84, registry 69, mutes 57, mixer 38 ; le baril 171 (son en-tête d'avant) ;
  - `rytm/infos/` : face 250, controls 231, voice 192, fx 191, sound 131, index 106, layers 99, words 81, types 65, tweaks 64, pages 60, soon 46, v60/v61/v62 9 ; le baril 53 ;
  - `midi/targets/` : rytm 252, index 188, helpers 151, voy 54, reserved 41, types 39, nav 16, stage 10, 10 fichiers de lane à 11 ; le baril 62 ;
  - `debug/` : index 591, 4 fichiers de lane à 13 ; `theme/` : face 473, base 452 (theme.ts : 2152) ;
  - contrats : `audio/tracks.ts` 246, `rytm/dtFaceIds.ts` 92, `state/gesture.ts` 68, `state/clipboard.ts` 61, `actions/chords/` 8 fichiers (types 51, index 24, 6 lanes à 5) ; registres : `scene/zones/` 8 fichiers, `ui/twins/` 8 fichiers (index 28 et 19).
- **Les portes** (sur la branche, copie propre `git archive HEAD`) :
  - `npx tsc --noEmit -p .` : 13 erreurs, exactement les mêmes que V.5.3 ;
  - `SEO_OFFLINE=1 npx vite build` : bon ;
  - smoke `mm808,voy,dj` × desktop et téléphone : 6 pages, aucune erreur ;
  - `hw:test` bon, `presets:test` 5 tests bons, `firmware.mjs check` bon après `stamp` (V.5.3, V.2.3, V.3.0) ;
  - `npm run docs:midi` : 892 cibles, aucun diff ;
  - identité audio, 20 cas sur 20, mêmes nombres de coups : contre la référence, écart des blocs au plus 5,1e-7 ; contre le build V.5.3 servi, échantillon par échantillon (`--against`), écart au plus 8,6e-7 (factory-rytm-3), 1,2e-7 à 4,2e-7 ailleurs. Deux rendus du même build diffèrent déjà de cet ordre dans Chromium. Porte : 1e-6 ;
  - `scripts/exports-check.mjs` : les 6 barils exportent les mêmes noms qu'avant (actions 200, theme 217, targets 11, infos 10, screen 7, debug 7) ;
  - sondes muettes de plus (rien ne joue) : en dev, les 150 cartes INFOS (sans voix, par voix, les blocs), toutes les valeurs de `theme.ts`, les clés du baril et de `__v4` identiques à V.5.3 ; la toile de l'écran sur 103 états (24 écrans × 4 voix, P-LOCK, INFOS, HOME), desktop et téléphone : mêmes pixels, sauf les messages passagers et les indices qui tournent à l'heure (`Math.floor(now / TIP_MS)`), qui varient aussi entre deux passages de V.5.3.

## 2. Décisions prises et pourquoi

- **`export *` et la liste des exports identique** : un module étoilé exporterait aussi ses aides utilisées par les autres modules. Elles vont dans `actions/internal/<module>.ts`, que le baril n'exporte pas ; `shared.ts` aussi (le baril exporte `gesture` par son nom). `ctlall.ts` n'a rien de public : il n'est pas étoilé. Une lane qui possède `actions/x.ts` possède aussi `actions/internal/x.ts`. Modules en plus du cahier : `anyDial` (`dials` dépassait 700 lignes) et `live` (LIVE REC, arrivé en V.5.3 après le cahier).
- **`state.ts`** : les 11 `let` lus ou écrits par plusieurs modules deviennent les propriétés d'un objet `st` (même nom, même départ, même type). C'est plus mécanique que des getters et setters : `x = 1` devient `st.x = 1`. Les autres `let` suivent leur seul utilisateur (`recHintAt` passe de face à steps). Les bannières de section restent dans leur module.
- **La zone morte du build** : le premier smoke du build est tombé sur « Cannot access before initialization ». `LOCK_NAMES` lisait `LFO_KEY_NAMES` dans un `flatMap` au chargement, et le cycle `locks` / `internal/locks` évaluait le mauvais d'abord. Corrigé, et l'outil compte maintenant comme exécutée au chargement toute fonction passée à un appel (map, IIFE). Aucune autre lecture croisée. Le cahier avait raison : seuls le smoke et l'identité le voient, pas tsc.
- **`theme/base.ts`, ajouté au cahier** : la face lit à son évaluation `PORTRAIT`, `PADS`, `OLED`, `HEAD`... et le reste de `theme.ts` lit la face (`TRANSPORT`, `PAGE_KEYS`). Un simple `theme/face.ts` aurait fait un cycle avec des const en zone morte des deux côtés. `base.ts` porte ce que la face lit (43 déclarations, ni `theme.ts` ni `face.ts`). `HEAD` y va aussi : la face et le reste du thème le lisent, et sans ça il aurait été exporté par `theme.ts`.
- **`scene/screen/` garde une seule classe** : les méthodes déplacées deviennent des fonctions `function x(this: Screen, ...)` au corps inchangé. Elles sont posées non énumérables sur `Screen.prototype` (`proto.ts`, comme une méthode de classe) et déclarées par augmentation de module. Les `private` de la classe perdent ce mot (seul tsc les lisait) ; ceux du constructeur deviennent `public`, sinon ce ne seraient plus des propriétés. À importer par `scene/screen.ts`, qui charge tous les fichiers.
- **`rytm/infos/`** : la table `RAW` est coupée entre ses bannières en objets `satisfies Partial<Record<RytmInfoId, Raw>>`, assemblés dans l'ordre d'avant (`allRytmInfos` le garde, le type vérifie chaque id une fois).
- **`midi/targets/`** : la boucle des scènes (`sceneTag`) passe après tous les groupes. Même résultat (seules les cibles mm808 de type value sont touchées), et les cibles RYTM des lanes en profitent.
- **`debug/`** : `installDebug` copie les champs des lanes (accesseurs compris) sur l'objet du cœur ; vides, rien ne change.
- **Contrats sans effet** : `FpButtonId` (faceplate) et `HotspotKind` (hit) ne sont pas élargis. Ils l'auraient été avec des tables à 14 et des `switch` vivants. `Dt2ButtonId` et `Dt2ZoneKind` vivent à côté, avec une vérification de type que `FpButtonId` y est inclus. De même `MidiTargetKindDt2` (le kind `relative`) et `DtFaceStateDt2` (le store ne porte pas encore ces champs). `normTrackKey`, le store du presse-papiers et les registres ont un corps trivial, que personne n'appelle. `kit16FromLegacy` lève une erreur tant que B1 ne l'a pas écrit. Noms proposés hors du cahier : `rytm:tempo:bpm` et `rytm:tempo:swing` (les deux cibles neuves de TEMPO, 1.3), et `pages` (les pas 17 à 128 de `StoredPatternMore`).
- **`ui/Hotspots.tsx` et `scene/renderer.ts`** : pas découpés, ç'aurait été réécrire leurs corps (le rendu des jumeaux vit dans un seul composant à hooks, les zones dans le constructeur). Il y a des registres à la place, sur quatre places fixes de l'ordre de tabulation du desktop (après l'écran, les potards, les touches, les pas), plus l'infobulle des zones des lanes. Les libellés (`TWIN_ARIA`, `FACE_TITLE`) restent dans `theme/face.ts` (B3) : une lane met les siens dans son entrée de registre.
- **Les outils du découpage** (dans le scratchpad, pas commités) : un découpeur par AST TypeScript (affectation, imports recalculés, aides internes, `st.`, lectures au chargement) et un déplaceur de méthodes de classe. Les fichiers produits ont été relus.

## 3. Ce qui reste à faire / points en suspens

- **Pour l'intégrateur** :
  - les fichiers figés après P0 : `actions/shared.ts`, `actions/state.ts`, et les barils et index d'ordre (`actions.ts`, `midi/targets/index.ts`, `rytm/infos/index.ts`, `scene/screen.ts`, `actions/chords/index.ts`, `scene/zones/index.ts`, `ui/twins/index.ts`) ;
  - à ajouter aux tableaux des lanes de 5.1 : `actions/internal/*` (avec son module), `actions/anyDial.ts` et `actions/live.ts` (B5 et B4), `theme/base.ts` (B3), `scene/zones/*` et `ui/twins/*` (un fichier par lane) ;
  - `scripts/exports-check.mjs` est une porte de plus : une lane qui ajoute un export public verra « en plus », c'est attendu, à relire à l'intégration.
- **Pour les lanes** :
  - la sonde `rytm-ident.mjs` lit la forme `RytmData` de V.5.3 : si la capture change (16 pistes), adapter `pageCase`, jamais régénérer la référence ;
  - `kit16FromLegacy` et le store `tracks` : à écrire par B1 ;
  - `npm run docs:midi` a écrit les mêmes fichiers : une cible neuve ne va que dans le fichier réservé de sa lane.
- **Côté Mika** : rien à faire pour P0. La critique C3.12 propose une fixture de plus, tirée de son vrai `localStorage` MM-RYTM (un export de son navigateur, sans `data/`) ; les fixtures d'ici sont fabriquées.

## 4. Commandes utiles ajoutées

- `node scripts/rytm-ident.mjs --url http://127.0.0.1:<port>` : l'identité audio contre la référence V.5.3 ; `--against <url V.5.3>` échantillon par échantillon ; `--only arrival,factory` ; jamais `--update` dans une lane.
- `node scripts/fixtures/make-rytm-legacy.mjs --url <V.5.3 servi>` : refabrique les fixtures (seulement sur V.5.3).
- `node scripts/exports-check.mjs` : les exports des 6 barils contre V.5.3 (`--root <copie>`, `--update` seulement sur le commit de référence).
