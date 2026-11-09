# MM-ARP, le plugin

Le synthe arpegiateur du site (`src/v4`, le MM-ARP) en VST3 pour macOS, avec la vraie face du site. Usage perso. Meme
architecture que `plugin/mm-rytm`.

## Architecture (2026-11-09)

- **La face** : la machine du site elle-meme (scene three.js, potards, pads d'accords, ecran, suite EDIT), seule, vue de
  dessus, dans une WebView JUCE. Mode `PLUGIN_ARP` (`window.__MM_PLUGIN__ = 'arp'`, `src/v4/theme/base.ts`), entree
  `src/v4/plugin/arp/`, page `plugin/mm-arp/web/index.html`, build `npm run plugin:arp:web` vers `plugin/mm-arp/build-web`
  (zip embarque dans le VST3). OPEN ouvre un tiroir avec tous les potards (TWEAKS compris) au lieu du capot.
- **Le son** : en C++ (`dsp/`), jamais dans la WebView. Le plugin joue fenetre fermee et pendant un export d'Ableton.
  - `dsp/Voyager.{h,cpp}` : le port ligne a ligne de `src/v4/audio/moog.worklet.js` (12 voix, x4, tous les filtres,
    STACK, WIDE, GLUE...). **Identique au bit pres au site** sur 85 cas (`tests/voyager-ref.mjs` + `voyager_compare.cpp`) :
    les fonctions mathematiques sont celles de V8 (`dsp/Voyager.fdlibm.inc`), jamais de FMA ni de `-ffast-math`. Le
    plugin le fait tourner par blocs de 128 exactement, comme l'AudioWorklet (128 echantillons de retard declares).
  - `dsp/ArpFx.{h,cpp}` : la chaine de `audio/synth.ts` : BASS MONO, CHORUS Juno-106, DELAY ping-pong et TAPE, la
    REVERB de l'ARP (IR_DEFAULT de `fx.ts`), VOLUME. Les worklets identiques au bit pres ; la chaine complete sous -60 dB
    face a Chromium hors ligne (`tests/fx-ref.mjs` + `fx_test.cpp`). Le SIDECHAIN (vers le kick du RYTM) n'est pas porte.
  - `dsp/Arp.{h,cpp}` : la mise en temps de `voyager/arp.ts`, sur la position d'Ableton (`tests/arp_test.cpp`).
- **Le pont** (`src/v4/plugin/arp/bridge.ts`) : la face compile un *programme* avec les fonctions du site : les reglages
  du moteur (`engineParams`), des effets, et les notes de chaque accord deja resolues (suite EDIT ou AUTO, ou le
  reservoir de RAND). Le C++ ne fait que la mise en temps.
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
| Parametres de l'hote : Master (dB), Arpeggiator (on / off) | joue |
| SIDECHAIN, sortie MIDI des notes de l'arpege, automation des potards de la face | plus tard |

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
