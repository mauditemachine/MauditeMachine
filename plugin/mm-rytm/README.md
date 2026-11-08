# MM-RYTM, le plugin

La boite a rythmes du site (`src/v4`, le MM-RYTM) en VST3 pour macOS, avec la vraie face du site. Usage perso.

## Architecture (2026-11-08)

- **La face** : la machine du site elle-meme (scene three.js, touches, potards, ecran), seule, vue de dessus, dans une WebView JUCE. Entree `src/v4/plugin/` (mode `PLUGIN` de `src/v4/theme/base.ts`), page `plugin/mm-rytm/web/index.html`, build `npm run plugin:web` vers `plugin/mm-rytm/build-web` (zip embarque dans le VST3).
- **Le son** : en C++ (`dsp/`), jamais dans la WebView. Le plugin joue fenetre fermee et pendant un export d'Ableton.
- **Le pont** (`src/v4/plugin/bridge.ts`) : la face compile un *programme* avec les fonctions du site (`resolveHit` de `audio/drums.ts`, `tracks.tweakWith`) : les sons de chaque piste, chaque coup de chaque pas avec sa hauteur, son DECAY, son gain, son PAN, son START. Le C++ le joue sans rien interpreter (`dsp/Program.h`, `dsp/Engine.cpp`).
- **L'etat** : les cles `mm.v4.*` du localStorage du site (motif, pistes, banques, presets...) sont gardees dans le projet Ableton avec le programme ; a l'ouverture de la fenetre, la face les reprend avant de se charger (`src/v4/plugin/restore.ts`).
- **Le transport** : celui d'Ableton ; PLAY de la face lance l'horloge interne quand Ableton est arrete. La tete de lecture de la face suit le C++ (`src/v4/plugin/head.ts`).

## Ce qui joue (phases 1 et 2)

| | Etat |
| --- | --- |
| Sons : 9 moteurs, 909 / 808 / MM, GATE, couche SAMPLE (tes samples), STRETCH | identique bit a bit au site (`tests/compare.cpp`, 29 cas) |
| 16 pistes, pas 1 a 64, pages, page bouclee, swing, velocites | joue |
| Verrous de pas (hauteur, DECAY, VOL, PAN, START, son d'un autre kit) | joue (resolus par la face) |
| ENV : ATK, HOLD, DECAY ; PAN ; kick mono ; choke CH / OH ; 4 voix par piste | joue (`tests/engine_test.cpp`) |
| MUTE, SOLO, mute du pattern | joue |
| Pads, touches, notes MIDI GM d'Ableton | joue |
| Conditions (FILL, PRE, NEI, 1ST, A:B, NOT), PROB, uTIME (en avance aussi), LEN, RTRG (RATE, VFAD, RLEN), lock trigs (VOL, PAN) | joue (phase 2, port de `audio/seq.ts`, `tests/engine_test.cpp`) |
| Crossfader A / B (scenes) | joue sur ce que le coup lit (hauteur, DECAY, VOL, PAN, sons) ; les effets suivront |
| LFO | phase 3 (avec les filtres et effets qu'ils modulent) |
| FLTR, effets de piste (TONE, DIST, CHORUS), envois (DELAY, REVERB), compresseur, limiteur | phase 3 |
| Chaines de patterns, SONG, samples perso du navigateur, multi-out | phase 4 |

## La face dans le plugin (plus simple qu'au site)

- L'ecran se clique : les listes (presets, SETTINGS, SOUNDS...) a la souris, un clic choisit, un second clic (ou un double clic) valide, la molette defile, un clic droit revient (NO). Les valeurs de l'ecran se tirent a la souris.
- Clic droit sur une touche = FUNC + la touche (sa fonction orange), sans tenir FUNCTION.
- SETTINGS ne garde que PATTERN, PERSONALIZE et ABOUT.
- Le site, lui, revient a la V.1.0 par defaut (la V.6.0 reste au selecteur de versions) ; le plugin est toujours en V.6.0.

## Commandes

Tests du DSP (Linux ou Mac, sans JUCE) :

```bash
cmake -S plugin/mm-rytm -B build-dsp -DMM_BUILD_PLUGIN=OFF && cmake --build build-dsp -j
```

```bash
./build-dsp/mm_engine_test && node plugin/mm-rytm/tests/render-ref.mjs build-dsp/ref && ./build-dsp/mm_compare build-dsp/ref public/samples/rytm
```

La face, puis le plugin sur un Mac (Xcode et CMake installes ; JUCE est telecharge par CMake) :

```bash
npm ci && npm run plugin:web
```

```bash
cmake -S plugin/mm-rytm -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release -j --target MM_RYTM_VST3
```

Sinon, GitHub Actions le construit a chaque push qui touche `plugin/`, `src/v4/` ou les samples (workflow `plugin.yml`) : voir `INSTALL.md`.

## Regles

- Un changement de son sur le site (`shotsdsp.ts`, `sampledsp.ts`, `stretch.ts`) relance le workflow : la comparaison echoue tant que `dsp/Shots.cpp` n'a pas suivi.
- Le mode plugin du site ne s'active qu'avec `window.__MM_PLUGIN__` (la page du plugin) ou `?plugin=1` : le site ne change pas.
