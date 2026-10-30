# MM-RYTM V.5.9 : le moteur à 16 pistes (invisible)

2026-10-30. Le cahier : `docs/v4/dt2/dt2-master-spec.md`, section 5.1 (lane B1 en entier, et de B2 la lecture et la double écriture), 4.6 (budget CPU) et 4.7 (portes de migration). Point de départ : le commit P0 (48397aa). Branche `v59/moteur-16`. Rien n'a été poussé et `main` n'a pas été touché. Rien ne change à l'oreille ni à l'œil : les pistes 9 à 16 existent dans le moteur et dans les données, mais aucune commande ne les montre.

## 1. Ce qui a été fait

- **Le store `tracks`** (`audio/tracks.ts`) : 16 pistes (son, machine, sample, réglages de voix, LFO, potards du kit, couches, TRK LEV, réservés V.6.1, comportement de voix), plus le mix.
  - `kit16FromLegacy(kit, voices)` construit le kit à 16 pistes à partir du kit et des 8 voix d'avant.
  - Il est stocké sous `mm.v4.rytm.tracks.1`, en diffs contre les valeurs par défaut, avec une empreinte `lg` des vieilles clés (`mm.v4.kit.1`, `mm.v4.rytm.voices.1`). Si V.5.3 les a modifiées entre-temps, le chargement le voit : origine `legacy`, `tracks` ou `mixed`.
  - Fonctions exposées : `get`, `of`, `param`, `set`, `setMany`, `machine`, `sample`, `voice`, `mix`, `replace`, `swap`, `subscribe`, `onChange` (le détail de chaque changement : sons, voix, kit, comportement, mix), `engine`, `family`, `tweak`, `sig`, `vfx`, `voiceOf`, `tlevGain`, `scSrc`, `choice`, `sounds`, `info`.
- **Les façades** : `audio/kit.ts` et `audio/voicefx.ts` gardent leur API, mais lisent et écrivent dans le store (`tracksLegacy`). Leur partie pure passe dans `audio/kitlaw.ts` et `audio/voicelaw.ts`, ré-exportés par `export *` : les noms exportés ne changent pas (exports-check est identique).
- **Le moteur sur 16 clés** :
  - `EngineId` (9 algorithmes) et `ShotId = EngineId`. Le moteur d'une piste vient de sa machine, ou de la catégorie de son sample en ONESHOT.
  - `TRACK_KEYS` (BD..CY puis T9..T16) est utilisé dans `pattern`, `locks` (128 pas), `trig`, `seq`, `seqhit`, `morph`, `sceneData`, `sceneParams` et `state/voices`. Les alias T1..T8 sont acceptés à la lecture (`normTrackKey`, `normSceneId`).
  - **Les tranches** (`drums.ts`) : les 8 d'avant sont construites au départ, celles de T9 à T16 seulement au premier coup (`chOf`).
  - La route du kick est dérivée du moteur de la piste (`routeOf`, `reroute`). `scSrc` donne la source du sidechain. `tlev` est un gain sur la tranche, exactement 1 au départ.
  - **Les portes** sont rangées par graphe (`GateState`) :
    - une piste mono se coupe en 3 ms ;
    - un coup gated se coupe en 8 ms par le suivant de son groupe de choke ;
    - l'OH (mono et gated) se coupe par son groupe seulement, comme avant.
  - **Le plafond de sources** : une piste poly d'héritage garde 4 sources au plus, le graphe 48 au desktop et 24 au téléphone. La plus vieille source se coupe en 8 ms. Une annulation rend ce qui avait été coupé.
  - Une source coupée par sa porte s'arrête 2 ms après la rampe.
  - **Les rendus hors ligne** acceptent les 16 pistes, `tlev`, et un compteur (`__v4.audio.tracks16.offline` : pic, coupes, tranches, temps de programmation et de rendu).
- **`shots` par piste** : la rotation des variantes, le son précédent et le dernier coup sont clés par piste. `onReady` donne les pistes concernées. La clé du cache ne change pas.
- **L'horloge** (`clock.ts`) :
  - un masque sur 16 bits, et un `Item` par coup programmé ;
  - `rescheduleTracks` : un geste sur une piste ne refait que cette piste, étendue à son groupe de choke ;
  - `hitKeyOf`, `soundKeyOf` et `kitLocked` par piste ;
  - un pas posé refait toute l'horloge, comme avant.
- **La persistance** (partie lecture et double écriture de B2) :
  - **Patterns** (`Steps` élargi) : les rangées 9 à 16 n'existent que si elles servent (`stepsOut`, `extraRows`). Les verrous sont lus jusqu'au pas 127. Les champs `pages`, `setup` et `kit` de pattern.3, ainsi que les clés inconnues des emplacements, sont recopiés tels quels.
  - **Presets** : un champ `tracks` est ajouté seulement si les 16 pistes diffèrent de ce que donnent le kit et les 8 voix.
  - **UNDO** suit le store.
  - **SHARE v1** n'a pas changé : il n'encode que les 8 voix.
  - **Double écriture** : l'écriture va à `mm.v4.rytm.tracks.1`, et aussi aux vieilles clés du domaine qui a changé, au format d'avant. Rien n'est écrit au chargement.
- **La sonde `scripts/rytm-16.mjs`** (nouveau script, muet) a 4 parties : offline, live, fixtures et rollback (`--v53 <url>`).
- **Le debug** : `__v4.tracks` (le store) et `__v4.tracks16` (clés, conversions, façades). Ses deux fonctions `ctx()` et `run(on)` refusent de s'exécuter hors `?mute=1&debug=1`.
- **Le firmware** : V.5.9 (voir les décisions).
- **Les fichiers** (25 fichiers, +3 543 / -1 321 lignes) :
  - **`audio/`** :
    - `tracks.ts` +790 −5 ;
    - `kitlaw.ts` +647 (nouveau) ;
    - `kit.ts` +87 −618 ;
    - `drums.ts` +435 −195 ;
    - `voicelaw.ts` +248 (nouveau) ;
    - `voicefx.ts` +28 −241 ;
    - `clock.ts` +225 −37 ;
    - `shots.ts` +164 −95 ;
    - `pattern.ts` +117 −26 ;
    - `locks.ts` +43 −22 ;
    - `morph.ts` +33 −28 ;
    - `seq.ts` +19 −17 ;
    - `trig.ts` +14 −7 ;
    - `shotsdsp.ts` +6 −2 ;
    - `seqhit.ts` +3 −3.
  - **`state/`** :
    - `presets.ts` +18 −1 ;
    - `patterns.ts` +16 −5 ;
    - `voices.ts` +11 −3 ;
    - `share.ts` +7 −1 ;
    - `undo.ts` +4 −2.
  - **`rytm/`** : `sceneData.ts` +12, `sceneParams.ts` +11 −8.
  - **Autres** :
    - `debug/audio.ts` +66 −2 ;
    - `firmware.json` +4 −3 ;
    - `scripts/rytm-16.mjs` +535 (nouveau).
  - Aucun fichier de B3 n'a été touché.
- **Les portes**, mesurées sur une copie propre (`git archive`) du HEAD, `dist` servi par `python3 -m http.server` :
  - `npx tsc --noEmit -p .` : 13 erreurs, les mêmes qu'avant.
  - `SEO_OFFLINE=1 npx vite build` : bon (19 s).
  - Smoke `mm808,voy,dj`, desktop et téléphone : 6 pages, aucune erreur.
  - `hw:test` : 17 et 11 tests bons. `presets:test` : 5 tests bons. `exports-check` : identique. `firmware.mjs check` : bon (V.5.9, V.2.3, V.3.0).
  - `npm run docs:midi` : 892 cibles, aucun diff.
  - **Identité audio** (`rytm-ident.mjs`) : 20 cas sur 20, avec les mêmes nombres de coups. L'écart des blocs va de 6,0e-8 à 4,5e-7 (cas scènes), pour une porte à 1e-6.
  - **Fixtures** :
    - le stockage est relu octet pour octet ;
    - la capture, les emplacements, les presets, chaque preset chargé et l'UNDO donnent le même JSON qu'en V.5.3 ;
    - les 3 liens SHARE v1 donnent le même code (98, 183 et 127 caractères).
  - **Sonde 16 pistes hors ligne** :
    - les pistes T9 à T16 ont un son (moteurs BD SD CH SD CP TOM CH CY) ;
    - **avec un son mais sans pas**, le rendu est celui des 8 voix (écart 1,2e-7) ;
    - **avec des pas**, ils s'entendent (écart 0,69) ;
    - **les coups attendus sont tous là** : T9 4, T10 4, T11 8, T12 4 notes et 12 répétitions de retrig, T13 2 lock trigs, T14 4, T15 16, T16 2. Aucun coup imprévu ;
    - **ressources** : les tranches sont construites au premier coup, au plus 9 sources simultanées, aucune coupée.
  - **Rapport temps réel**, sur ce VM (4 cœurs Xeon à 2,1 GHz) :
    - le motif dense à 16 pistes (verrous, retrigs 1/32, LFO, 4 mesures) donne **8,1** (972 ms pour 7,85 s, 468 coups, pic de 13 sources), pour un seuil à 8 ;
    - la référence dense à 8 voix donne 17,9.
  - **Sonde live** (un RUN muet, le temps du contexte figé) : un geste ne refait que sa piste, en une seule re-programmation de piste et sans refaire toute l'horloge :

    | Geste | Pistes refaites |
    |---|---|
    | cran du DRIVE du kick | BD |
    | DECAY de la caisse claire | SD |
    | DECAY de l'OH | OH et CH (son groupe de choke) |
    | DECAY de T9 | T9 |

    Un pas posé refait toute l'horloge, comme avant. Au repos, il y a 8 tranches. T9 a la sienne après son premier coup.
  - **Retour arrière** V.5.9, puis V.5.3 (build de `git archive 48397aa`), puis V.5.9 :
    - V.5.3 lit ses 8 voix, son kit et son motif. Elle liste et charge le preset écrit par V.5.9, avec le même son.
    - De retour en V.5.9, les pistes 9 à 16 sont intactes (origine `tracks`).
    - Après une édition dans V.5.3, l'origine est `mixed`, et c'est juste : les pistes 1 à 8 sont celles de V.5.3 et les pistes 9 à 16 celles de V.5.9.

## 2. Décisions prises et pourquoi

- **Une forme stockée en diffs, plus l'empreinte des vieilles clés.** Un kit qui n'a pas changé tient en quelques octets, et un retour par V.5.3 se détecte sans comparer tout le kit. Pour les pistes 1 à 8, les vieilles clés font foi quand l'empreinte ne correspond plus. Les pistes 9 à 16 sont gardées.
- **La double écriture se fait par domaine.** Un réglage de voix réécrit `mm.v4.rytm.voices.1` mais pas le kit. Le format d'avant est gardé, ce qui permet de revenir à V.5.3 sans perte.
- **Les potards globaux de la façade `kit`** (TUNE, DRIVE...) écrivent sur les 8 pistes d'héritage, et la vue lit T1 et T2. C'est la sémantique d'avant, où un potard était global et chaque famille avait son modèle.
- **`kitlaw.ts` et `voicelaw.ts`** : sans ce découpage, `tracks.ts` et `kit.ts` s'importaient l'un l'autre et le build tombait sur une zone morte (déjà vu en P0). Les modules purs n'importent rien du store.
- **Les rangées 9 à 16 n'existent que si elles servent.** Un JSON d'avant reste ainsi au même octet, et la porte des fixtures le vérifie.
- **Une porte sur chaque coup** (un gain à 1, sans effet sur le son au bit près) : c'est ce que le plafond ferme.
  - J'avais d'abord mesuré une régression CPU (486 ms contre 351 à 395 ms pour V.5.3).
  - En alternant les deux builds, le meilleur rendu sur 9 va de 364 à 427 ms pour V.5.3 et de 384 à 442 ms pour V.5.9. Les deux plages se recouvrent, l'écart reste dans le bruit du VM.
  - Je n'ai donc pas ajouté d'optimisation. Ne poser une porte que sur les coups longs aurait changé la règle du plafond (« le plus vieux ») pour un gain non mesurable.
- **Une source coupée s'arrête 2 ms après sa rampe**, au lieu de tourner à vide jusqu'au bout de son tampon. La porte est déjà à 0, donc le son est le même. Le motif dense mesurait entre 5,7 et 7,8 avant ce changement ; après, il mesure de 7,7 à 9,0, et 8,1 au dernier passage.
- **Les pistes neuves sont mono par défaut** (cahier 4.6). Le plafond de 4 ne vaut que pour les pistes poly d'héritage (SD, CH, CP, TOM, HT, CY).
- **La clé du mix de l'horloge part de sa valeur.** Vide au départ, elle faisait refaire toute l'horloge au premier réglage de voix. C'est une correction d'un défaut que la sonde live a trouvé.
- **Les paramètres réservés à la V.6.1 valent 0** et n'entrent dans aucun calcul.
- **La sonde live fige le temps du contexte** (`ctx.suspend()`). Dans ce Chromium headless sans sortie audio, le temps du contexte court environ 8 fois plus vite que l'horloge murale : tout était déjà joué avant le geste. Les gestes passent par les façades, parce qu'une cible MIDI relance le contexte. Le RUN est muet (`?mute=1`, `--mute-audio`, MASTER à 0), et rien n'est jamais écouté.
- **Le firmware** : `bump mm808 minor` donne 5.4, et le script n'a pas d'option de version exacte. J'ai posé à la main la version et sa ligne d'historique à 5.9 (« le moteur a 16 pistes (invisible) »). L'empreinte ne dépend pas de la version, et `check` est bon.
- **Écarts au cahier** (reportés à la V.6.0, ou hors de cette lane) :
  - mutes, solo et mutes du pattern restent sur 8 voix (`state/voices.ts` reste en `Inst`) ;
  - `rytmPage.vel` n'est pas passé à 16 (B2 complet) ;
  - SHARE v2 et l'usine par conversion ne sont pas faits (B2 complet) ;
  - `allBindings` des scènes reste sur 8 ;
  - `audioDebug.voices` reste à 8, `tracks16.channels` donne les 16 ;
  - `prepareScenes` n'est pas borné à une piste : il prépare les voix dont la hauteur se morphe, et un changement de scène n'est pas un geste de piste ;
  - le script `scripts/rytm-16.mjs` et les modules `kitlaw` et `voicelaw` sont en plus des tableaux du cahier (ce sont des fichiers de B1).

## 3. Ce qui reste à faire / points en suspens

- **Pour l'intégrateur** :
  - **Relecture** : faire relire B1 et B2 par un agent neuf avant la fusion (cahier, critique). Ce sont eux qui peuvent casser des sauvegardes.
  - **`firmware.json`** : la V.6.0 fera `bump major` depuis 5.9 et donnera 6.0. Si une autre branche a monté la version entre-temps, il y aura un conflit de texte à résoudre à la main.
  - **Les références à 8** : 35 fichiers lisent encore `INSTRUMENTS` (les 8 voix). Dans B1 et B2, c'est voulu : les 8 rangées d'avant sont toujours là, et les rangées 9 à 16 passent par `extraRows`. Ailleurs, il reste les actions, la face, l'écran, le MIDI et le téléphone, qui sont le travail de B3 à B6.
- **Le rapport temps réel est juste au seuil** (8,1 pour 8) sur ce VM lent. Il faut le remesurer sur une vraie machine de bureau : `node scripts/rytm-16.mjs --url ... --only offline`.
- **Côté Mika** : rien n'est visible, donc rien à faire dans l'interface. Comme aucun test n'a joué de son réel (règle du CLAUDE.md), une écoute d'un ou deux presets après la mise en ligne de V.5.9 serait la seule vérification à l'oreille. C'est à toi de la faire, quand tu veux.

## 4. Commandes utiles ajoutées

- `node scripts/rytm-16.mjs --url http://127.0.0.1:<port> [--v53 http://127.0.0.1:<port>] [--only offline,live,fixtures,rollback]` : la sonde 16 pistes, muette. Code de sortie 0 bon, 1 un écart, 2 une erreur. Le retour arrière demande un build V.5.3 servi (`git archive 48397aa`).
- Les sondes sous `?mute=1&debug=1` :
  - `__v4.tracks` (le store) ;
  - `__v4.tracks16` (`keys`, `legacyKeys`, `storageKey`, `kit16FromLegacy`, `toStored`, `fromStored`, `same`, `legacy`, `legacyVoices`, `kit`, `voiceFx`, plus `ctx()` et `run(on)`, muets) ;
  - `__v4.audio.tracks16` (les tranches vivantes, le compteur du dernier rendu hors ligne) ;
  - `__v4.clock.trackRescheduled`, `lastTracks`.
- Aucun script npm ajouté.
