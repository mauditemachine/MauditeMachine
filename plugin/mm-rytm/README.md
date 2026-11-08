# MM-RYTM, le plugin

La boite a rythmes du site (`src/v4`, le MM-RYTM) portee en C++ avec JUCE 8 : VST3, AU et Standalone pour macOS. Usage perso.

## Ce qui est porte

| Site (TypeScript) | Plugin (C++) | Etat |
| --- | --- | --- |
| `audio/shotsdsp.ts` : les 9 moteurs (BD SD CH CHopen OH CP TOM HT CY), modeles 909 / 808 / MM, GATE, sonie | `dsp/Shots.cpp` | identique bit a bit (29 cas testes) |
| `audio/sampledsp.ts` : la couche SAMPLE (TUNE, START, LEN, REV, ATTACK, DRIVE, SNAPPY) | `dsp/Shots.cpp` | identique bit a bit |
| `audio/stretch.ts` : STRETCH facon Impulse | `dsp/Shots.cpp` | identique bit a bit |
| les voix (kick mono, choke CH/OH, polyphonie) | `dsp/Engine.cpp` | porte, teste |
| le sequenceur 16 pas, swing | `dsp/Engine.h` | cale sur l'hote (ppq), teste |
| les effets (DIST, TONE, CHORUS, REVERB, DELAY), les locks, les scenes, les presets, la face du site | - | pas encore |

## Structure

- `dsp/` : le DSP, C++17 pur, sans JUCE (testable seul).
- `src/` : le plugin JUCE (parametres, MIDI, transport, interface, samples embarques).
- `tests/render-ref.mjs` : fait tourner le vrai `shotsdsp.ts` du site (Node, `--experimental-strip-types`) sur `tests/cases.json`.
- `tests/compare.cpp` : compare le C++ a cette reference (tolerance -80 dBFS ; aujourd'hui l'ecart est nul).
- `tests/engine_test.cpp` : le moteur, verifie dans les buffers (aucune lecture audio).

## Commandes

Tests du DSP (Linux ou Mac, sans JUCE) :

```bash
cmake -S plugin/mm-rytm -B build-dsp -DMM_BUILD_PLUGIN=OFF && cmake --build build-dsp -j
```

```bash
./build-dsp/mm_engine_test && node plugin/mm-rytm/tests/render-ref.mjs build-dsp/ref && ./build-dsp/mm_compare build-dsp/ref public/samples/rytm
```

Le plugin sur un Mac (Xcode et CMake installes ; JUCE est telecharge par CMake) :

```bash
cmake -S plugin/mm-rytm -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release -j --target MM_RYTM_VST3 MM_RYTM_AU MM_RYTM_Standalone
```

Sinon, GitHub Actions le construit a chaque push qui touche `plugin/` (workflow `plugin.yml`) : voir `INSTALL.md`.

## Regle

Un changement de son sur le site (`shotsdsp.ts`, `sampledsp.ts`, `stretch.ts`) relance le workflow : la comparaison echoue tant que `dsp/Shots.cpp` n'a pas suivi.
