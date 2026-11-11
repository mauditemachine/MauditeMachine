# MM-ARP, le plugin

Le synthe arpegiateur du site (`src/v4`, le MM-ARP) en VST3 pour macOS, avec la vraie face du site et SOUND+. Usage perso. Meme
architecture que `plugin/mm-rytm`.

## Architecture (2026-11-09)

- **La face** : la machine du site elle-meme (scene three.js, potards, pads d'accords, ecran, suite EDIT), seule, vue de
  dessus, dans une WebView JUCE. Mode `PLUGIN_ARP` (`window.__MM_PLUGIN__ = 'arp'`, `src/v4/theme/base.ts`), entree
  `src/v4/plugin/arp/`, page `plugin/mm-arp/web/index.html`, build `npm run plugin:arp:web` vers `plugin/mm-arp/build-web`
  (zip embarque dans le VST3). OPEN ouvre le capot 3D (la carte, noire dans le plugin, et ses TWEAKS jouables), avec en bande au-dessus le panneau d'extension (SOUND+, LIBRARY, TOOLS, LEARN, CLOSE). La fenetre se redimensionne : la scene se recadre, les couches HTML suivent a l'echelle largeur / 1100 (`src/v4/plugin/arp/scale.ts`). Le module avant (2026-11-11, `src/v4/plugin/arp/FrontModule.tsx`) : la fenetre fait 1100 x 880 par defaut (proportion 5 / 4 ; la face 3D garde le haut, 1100 x 704), et sous la face un module d'extension toujours visible, dessine comme elle entre les joues de noyer : STEP SEQUENCER (16 pas ; ACCENT, SLIDE, GATE, RATCHET, PROB ; `steps.ts`, envoye dans `mm_program` sous `steps`), OSC / FILTER + et FX RACK (les 23 reglages `seq`, `osc`, `filter`, `phaser`, `flanger`, `pump`, `crush`, `space` de `extra-params.json`). La version du build (« VST3 · BUILD 11 NOV 14:32 · a1b2c3d », date UTC et commit) est serigraphiee en haut a droite de la face et ecrite dans `build-web/version.txt`.
- **Le son** : en C++ (`dsp/`), jamais dans la WebView. Le plugin joue fenetre fermee et pendant un export d'Ableton.
  - `dsp/Voyager.{h,cpp}` : le port ligne a ligne de `src/v4/audio/moog.worklet.js` (12 voix, x4, tous les filtres,
    STACK, WIDE, GLUE...). **Identique au bit pres au site** sur 85 cas (`tests/voyager-ref.mjs` + `voyager_compare.cpp`) :
    les fonctions mathematiques sont celles de V8 (`dsp/Voyager.fdlibm.inc`), jamais de FMA ni de `-ffast-math`. Le
    plugin le fait tourner par blocs de 128 exactement, comme l'AudioWorklet (128 echantillons de retard declares).
  - `dsp/ArpFx.{h,cpp}` : la chaine de `audio/synth.ts` : BASS MONO, CHORUS Juno-106, DELAY ping-pong et TAPE, la
    REVERB de l'ARP (IR_DEFAULT de `fx.ts`), VOLUME. Les worklets identiques au bit pres ; la chaine complete sous -60 dB
    face a Chromium hors ligne (`tests/fx-ref.mjs` + `fx_test.cpp`). Le SIDECHAIN (vers le kick du RYTM) n'est pas porte.
  - `dsp/Arp.{h,cpp}` : la mise en temps de `voyager/arp.ts`, sur la position d'Ableton (`tests/arp_test.cpp`).
- **Les potards** sont des parametres de l'hote ; le C++ en tire le moteur, les effets et les notes (`dsp/Params.cpp`,
  table generee `dsp/ParamTable.inc` par `tests/params-gen.mjs`). La face envoie `mm_param` / `mm_gesture` quand on
  tourne un potard, recoit `mm_knobs` quand Ableton les change.
- **Le pont** (`src/v4/plugin/arp/bridge.ts`) : le programme v2 (la suite EDIT, la progression, le tempo et le swing
  de la face), l'etat, RUN, et les presets du disque (`mm_preset_save`, `mm_preset_open`, `mm_preset_list`,
  `mm_preset_load` ; `mm_preset`, `mm_presets`, `mm_saved`).
- **L'etat** : les cles `mm.v4.*` du localStorage du site, la progression et le programme, dans le projet Ableton, avec
  la graine du hasard.

## Ce qui joue

| | Etat |
| --- | --- |
| Moteur : OSC 1 / 2, SUB, FM, SYNC, bruit, filtres MOOG / LP12 / MS-10 / BP / HP, LOAD, SPACE, enveloppes, GLIDE, DRIFT, STACK, WIDE, GLUE, OVERDRIVE, LFO MOD cale sur la mesure | identique au bit pres au site |
| CHORUS I / II, DELAY ping-pong, TAPE, REVERB, BASS MONO, VOLUME | comme au site (-60 a -100 dB d'ecart, la precision des biquads du navigateur) |
| Arpege : progression (une mesure par accord, calee sur les mesures du morceau), RATE, GATE, OCTAVE, MODE, RANGE, NOTES, CHORD, suite EDIT, silences, ACCENT, DRIFT, SWING | joue |
| Transport d'Ableton ; RUN de la face (horloge interne) quand Ableton est arrete | joue |
| Notes MIDI d'Ableton : le synthe joue directement (velocite 100 = accent 1) | joue |
| Parametres de l'hote : Arpeggiator, Master, et les 62 potards du site (face + TWEAKS, `dsp/Params.cpp` : les lois de params.ts / chords.ts / seq.ts, 0 ecart sur 3000 cas) : automation, MIDI Map, le triangle d'Ableton, fenetre fermee comprise | joue |
| Presets sur le disque (`~/Music/Maudite Machine/MM-ARP Presets/*.mmarp`) : SAVE TO DISK / OPEN FROM DISK et la liste, dans le capot (OPEN) | joue |
| DRAG MIDI : l'arpege en clip MIDI a glisser sur une piste (x1, x2, x4 la progression), SAVE .MID ; `~/Music/Maudite Machine/MM-ARP Clips` | joue (`src/PluginEditor.cpp`, `MMArpProcessor::arpMidi` : le meme arpegiateur et la meme graine que la lecture) |
| SOUND+ (le VST3 seul, jamais le site ; `extra-params.json`, 14 parametres) : QUALITY HQ (x8), LFO 1 TARGET 2 / DEPTH 2, LFO 2 (SPEED, SHAPE, TARGET, DEPTH ; 15 destinations), REVERB SIZE / TONE / PRE DELAY (convolution non uniforme sans latence), MASTER WARMTH / BASS / AIR / WIDTH | joue ; chaque reglage au neutre rend le son du site (85 cas au bit pres, `tests/hq_test.cpp` 87 controles) |
| SIDECHAIN, sortie MIDI des notes de l'arpege | plus tard |

Ecarts connus avec le site : la progression est calee sur les mesures d'Ableton (au site : depuis RUN), et la suite
repart de sa premiere note au debut de chaque suite de mesures du meme accord, quel que soit le point de lecture : une
boucle ou un export rejouent toujours les memes notes. RAND et DRIFT tirent leur hasard d'une graine par position.

## Commandes

Tests du DSP (Linux ou Mac, sans JUCE) :

```bash
cmake -S plugin/mm-arp -B build-dsp -DMM_BUILD_PLUGIN=OFF && cmake --build build-dsp -j && ./build-dsp/mmarp_arp_test
```

```bash
node plugin/mm-arp/tests/voyager-ref.mjs build-dsp/ref-voy && ./build-dsp/mmarp_voyager_compare build-dsp/ref-voy
```

```bash
node plugin/mm-arp/tests/params-gen.mjs --check && node plugin/mm-arp/tests/params-ref.mjs build-dsp/ref-params && ./build-dsp/mmarp_params_test build-dsp/ref-params
```

```bash
node plugin/mm-arp/tests/fx-ref.mjs build-dsp/ref-fx && ./build-dsp/mmarp_fx_test build-dsp/ref-fx
```

(`fx-ref.mjs` rend aussi la chaine dans Chromium, `--mute-audio` ; `fx-ref.mjs <dossier> worklet` : les worklets seuls.)

Le processeur complet sans fenetre (JUCE, joue comme sous Ableton, sans son) :

```bash
cmake -S plugin/mm-arp -B build-host -DMM_HOST_TEST=ON && cmake --build build-host -j --target mmarp_host_test && ./build-host/mmarp_host_test_artefacts/Release/mmarp_host_test
```

La face, puis le plugin sur un Mac :

```bash
npm ci && npm run plugin:arp:web
```

```bash
cmake -S plugin/mm-arp -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release -j --target MM_ARP_VST3
```

Essai de la face dans un navigateur : `npm run dev`, puis `/plugin/mm-arp/web/index.html?mute=1` (sans plugin, aucun son).

Installer ou mettre a jour sur le Mac (le dernier build vert, voir `INSTALL.md`) :

```bash
curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-arp-latest/update.sh | bash
```

## Regles

- Un changement de son sur le site (`moog.worklet.js`, `chorus.worklet.js`) relance le workflow `plugin-arp.yml` : la
  comparaison echoue tant que `dsp/Voyager.cpp` ou `dsp/ArpFx.cpp` n'a pas suivi.
- Le mode plugin ARP du site ne s'active qu'avec `window.__MM_PLUGIN__ = 'arp'` ou `?plugin=arp` : le site ne change pas.
