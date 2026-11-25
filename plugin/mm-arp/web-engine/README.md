# MM-ARP, le moteur du navigateur (web-engine)

Le processeur du VST3 (`src/PluginProcessor.cpp`) sans JUCE, avec une API C, pour le compiler en WebAssembly et le
jouer dans un AudioWorklet du site, pilote par la face du plugin (`src/v4/plugin/arp`). Le but : le meme son que le
VST3, pas une approximation. La logique du processeur est recopiee telle quelle (`ArpEngine.cpp`), le DSP est celui du
plugin (`dsp/`, la bibliotheque `mmarp_dsp`), compile avec les memes options (`-ffp-contract=off`, jamais de
`-ffast-math`).

| Fichier | Role |
| --- | --- |
| `ArpEngine.h`, `ArpEngine.cpp` | la classe `mmarpweb::ArpEngine` (l'etat et `processBlock` du VST3 sans JUCE) et l'API C `mmarp_*` |
| `../tests/engine_web_test.cpp` | le banc natif (`mmarp_engine_test`, ctest `engine_web`) |
| `../tests/engine_web_preset.h` | un preset de `presets/factory.json` pose comme la face (lecteur JSON minimal) |
| `compare/` | la parite au bit pres avec le vrai `MMArpProcessor` (JUCE, hors du build du depot) |

## Ce qui correspond a quoi

L'en-tete de `ArpEngine.h` donne, pour chaque fonction, les lignes de `src/PluginProcessor.cpp` qu'elle recopie (le
constructeur 160-224, `faceProgram` 249-263, `arpMidi` 297-365, `timerCallback` 457-495, la chaine 894-1116, la matrice
1120-1378, DISTO / HELL / EQ 1381-1517, `prepareToPlay` 1519-1588, `processBlock` 1623-1977...). **Toute modification
de `PluginProcessor.cpp` se reporte ici**, puis se verifie avec `compare/` (voir plus bas).

Ce qui remplace JUCE, sans rien changer au son :

- les parametres de l'hote : 359 `float` (les 62 potards `mmarp::kKnobDefs`, puis les 297 reglages `mmx::kExtraDefs`,
  indice `mmx::allIndex`), plus `master` (dB, sur sa grille de 0.1), `arp` et `prio`. `setValueNotifyingHost` garde
  le detail de l'APVTS (une valeur a peu pres egale, a un `FLT_EPSILON` relatif pres, n'est pas recopiee, sauf la
  premiere fois) ;
- pas de tete de lecture d'hote : le tempo vient du programme, RUN tourne sur l'horloge interne (`internalPpq_`),
  exactement comme `processBlock` quand Ableton est arrete. `mmarp_set_host_position` en donne une pour le bloc
  suivant seulement (optionnel, pour une synchro future avec le MM-RYTM du site) ;
- le `MidiBuffer` : une file (`mmarp_midi`), triee par position (stable), lue en entier au `mmarp_process` suivant ;
- le timer de l'instance (15 Hz) : `mmarp_idle`, synchrone (la latence, les reponses de reverb liberees, la nouvelle
  reponse calculee quand SIZE / TONE / PRE DELAY bruts ou la frequence changent ; le VST3 le fait sur un fil a part) ;
- le compteur CPU : `steady_clock` en natif ; sous `__EMSCRIPTEN__` un bouchon (tout a 0) sauf `-DMMARP_WEB_CPU=1` ;
- `ScopedNoDenormals` : le meme registre en natif (SSE FTZ + DAZ, arm64 FZ) ; rien en wasm (il n'y en a pas) ;
- `isNonRealtime` : `mmarp_set_offline` (faux par defaut : EXPORT HQ ne joue que hors ligne).

Un seul fil : tous les appels depuis le meme fil (le worklet). Ni verrou ni atomique.

## L'API C

Toutes les fonctions prennent le moteur (`MMArpEngine*`, un entier en wasm) en premier argument, sauf les tables.

| Fonction | Ce qu'elle fait (le VST3) |
| --- | --- |
| `MMArpEngine* mmarp_create(uint32_t seed)` | une instance ; la graine du hasard (RAND, DRIFT, PROB, LFO 4), gardee avec l'etat |
| `void mmarp_destroy(e)` | |
| `void mmarp_prepare(e, double sampleRate, int maxBlock)` | `prepareToPlay` (alloue ; le moteur, la reverb des reglages en cours) |
| `void mmarp_process(e, float* L, float* R, int n)` | `processBlock` (la sortie est ecrite, pas melangee) |
| `void mmarp_idle(e)` | `timerCallback` (a appeler ~15 fois par seconde, hors du rendu si possible) |
| `int mmarp_param_count(void)` | 359 |
| `const char* mmarp_param_id(int i)` / `int mmarp_param_index(const char* id)` | `mmx::allId` / `mmx::allIndex` (-1 : inconnu) |
| `double mmarp_param_default(int i)` | le depart |
| `float* mmarp_params(e)` | les 359 valeurs (`getValue`, ce que l'editeur envoie a la face), en lecture seule |
| `void mmarp_set_param(e, int i, double v)` | `faceParam` (borne a 0..1, potards connus) |
| `int mmarp_knobs_known(e)` / `void mmarp_set_knobs_known(e, int)` | `knobsKnown` (un etat recharge : 1) |
| `void mmarp_set_master_db(e, double)`, `mmarp_set_arp_enabled(e, int)`, `mmarp_set_clip_priority(e, int)` | les parametres `master`, `arp`, `prio` |
| `void mmarp_set_program(e, bpm, swing, seqEdit, seqLen, const int32_t seqBuf16[16], const int32_t* prog, int nProg, const uint8_t lanes80[80], const float knobs62[62], const float extras297[297], int hasKnobs)` | `faceProgram` (voir plus bas) |
| `void mmarp_run(e, int on)` | `faceRun` (RUN remet ARP RUN a 1) |
| `void mmarp_midi(e, int offset, int status, int d1, int d2)` | un evenement du prochain bloc (`offset` dans le bloc ; NOTE ON / OFF, CC, PITCH BEND, CHANNEL PRESSURE) |
| `const double* mmarp_telemetry(e)` / `int mmarp_telemetry_size(void)` | tout ce que lit le timer de l'editeur (72 doubles, voir plus bas) |
| `void mmarp_set_spec_on(e, int)` / `int mmarp_spec_frame(e, float out96[96])` | `setSpecOn` / `specFrame` (l'analyseur de la page SOUND ; 1 : une trame neuve) |
| `void mmarp_learn(e, int index)` | `learn` (-1 : annule) |
| `void mmarp_unmap(e, int ch0, int cc)`, `void mmarp_unmap_all(e)` | `unmap` (canal 0..15), `unmapAll` |
| `void mmarp_map_set(e, int ch0, int cc, int index)` | une assignation rechargee (`setStateInformation`) |
| `int mmarp_take_map_changed(e)` / `int32_t* mmarp_ccmap(e)` | `takeMapChanged` ; la table canal x 128 + CC -> indice (-1 : rien), 2048 entiers |
| `int mmarp_render_clip(e, int cycles, float* out, int maxNotes, int* bars)` | `arpMidi` : rend le nombre de notes ; `out` recoit `{onTick, offTick, vel, midi}` par note (960 par noire) |
| `uint32_t mmarp_seed(e)` / `void mmarp_set_seed(e, uint32_t)` | la graine (avant `mmarp_prepare` : le moteur la prend a la preparation) |
| `void mmarp_set_offline(e, int)` | `isNonRealtime` (EXPORT HQ) |
| `void mmarp_set_host_position(e, int playing, double ppq, double bpm)` | une tete de lecture pour le bloc suivant (optionnel) |
| `void* mmarp_alloc(int)` / `void mmarp_free(void*)` | de la memoire du wasm pour passer textes et tableaux |

### Le programme (`mmarp_set_program`)

Le JS lit lui-meme le programme de `bridge.ts compile()` et passe les valeurs ; le C++ y repose les bornes de
`parseProgram` :

- `bpm` 20..400, `swing` 0..0.5 (la part de pas, SWING x 1/3) ;
- `seqEdit`, `seqLen` 1..16, `seqBuf16` : 16 degres (-7..24), un silence (`null` du JSON) = **-10000** ;
- `prog` / `nProg` : les indices **du plugin** (`chordBank: 2`) ; un preset sans `chordBank` (la banque d'usine, un
  preset d'avant la v43) a des indices du site : le JS les convertit avant (`chords.ts arpProgOf`, `kSiteToArp` =
  `[0, 5, 6, 4, 3, 2, 7, 5]`) ; hors 0..7 : ignores ; 8 au plus ;
- `lanes80` : les pistes `steps.ts` a la suite, 16 pas chacune : acc (0..2), slide (0..1), gate (0..3), rat (1..4),
  prob (0..100) ; `NULL` : leurs departs ;
- `knobs62`, `extras297` : `voyParams` et `arpExtra` dans l'ordre des indices (`NULL` ou NaN : le depart) ;
  `hasKnobs = 1` : **une instance dont les potards sont inconnus les prend** (et les reglages), une seule fois, comme
  `faceProgram` ; ensuite les potards passent par `mmarp_set_param`.

Comme dans le VST3, le programme est pris au debut du `mmarp_process` suivant ; `mmarp_render_clip` lit le dernier
publie.

### La telemetrie (`mmarp_telemetry`, un `Float64Array` de 72)

| Indice | Champ | L'editeur (`mm_tick`) |
| --- | --- | --- |
| 0..11 | playing, internal, seq, slot, pos, len, chord, midi, skip, dur, ppq, bpm | `t` (la face envoie `slot`, `chord`, `midi` a -1 et `skip` faux quand `playing` est faux ; `ppq` -1 : rien ne joue) |
| 12..23 | les arcs de `kModIds` : wave1, wave2, fm, cutoff, res, noise, sub, envAmt, stack, xRing, xFold, xComb (NaN : rien) | `m` |
| 24..31, 32..39 | la matrice : l'indice du reglage vise par chaque emplacement (-1 : rien), sa valeur effective | `m` (id par `mmarp_param_id`, une fois par reglage) |
| 40, 41 | hellLfo (-1..1, NaN : coupe ; la face recoit 0.5 + 0.5 v), distoVu (0..1, NaN) | `m` |
| 42..47, 48 | les enveloppes (eg[0] NaN : aucune voix), et ce silence en clair | `e` |
| 49..56, 57 | le CPU par etage (ENGINE, DISTO, DELAY, REVERB, HELL, EQ/RACK, REST, TOTAL ; % du temps reel), le pic | `c.s`, `c.pk` |
| 58..62 | os, voices, pro, sr, block | `c` |
| 63, 64 | la latence du moteur, la derniere vue par `mmarp_idle` | (l'hote) |
| 65..71 | clipActive, knobsKnown, learn (-1 : rien d'arme), mapChanged, specOn, hostPlaying, frame | |

`k` (les potards changes par l'hote : MIDI LEARN, RUN qui remet ARP RUN, la reprise par `hasKnobs`) : le JS compare
`mmarp_params` a sa copie, comme `sent_` dans l'editeur. A `mm_ready`, si `mmarp_knobs_known` est faux, c'est la face qui
donne les siens.

### L'etat a garder (le projet du VST3)

La graine, les 359 valeurs de `mmarp_params`, `master` / `arp` / `prio`, la table MIDI LEARN (`mmarp_ccmap`) et le
dernier programme. Recharge : `mmarp_create(graine)`, `mmarp_set_param` pour chaque valeur (potards connus),
`mmarp_map_set`, `mmarp_set_program`, puis `mmarp_prepare`. Les conversions des vieux projets (`migrateHell`,
`convertPedal`, `convertDelay`) ne sont pas reprises : le site n'a pas de vieux projets, la face convertit les presets.

### Le clip MIDI

`mmarp_render_clip` donne les notes de `arpMidi` (la progression `cycles` fois, a 120 BPM interne, 960 ticks par
noire) ; le JS ecrit le fichier comme JUCE : une piste, `MM-ARP` (texte, type 3), le tempo `60000000 / max(20, bpm)`,
4/4, puis chaque note dans l'ordre rendu (NOTE ON a `onTick`, NOTE OFF a `offTick`, canal 1), triees par tick en gardant
l'ordre d'arrivee a tick egal.

## Construire et verifier

```bash
cmake -S plugin/mm-arp -B build -DMM_BUILD_PLUGIN=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build build -j8
./build/mmarp_engine_test            # le preset REPEAT BASS, 4 mesures, CLASSIC / PRO, ECO / HQ, MIDI, LEARN, clip, reverb
(cd build && ctest)                  # tous les bancs du DSP, et celui-ci (engine_web)
```

### La parite avec le VST3 (`compare/`)

Le vrai `MMArpProcessor` (sans fenetre) et le moteur, cote a cote, memes entrees : les 80 presets d'usine (2 mesures
chacun), l'automation (CUTOFF, QUALITY, ENGINE, LATENCY, DISTO, HELL v2 -> ancien, la matrice par tranches de 32 avec
LFO 1 / 3 / 4, RUN / STOP, un programme neuf, SWING), le MIDI (notes, CC appris, bend, aftertouch, molette, MIDI IN
ARP + HOLD, LAYER), des blocs de 1 a 1024 et de 441, un transport d'hote, la reverb recalculee (le timer du VST3 contre
`mmarp_idle`), le clip MIDI. Sortie, telemetrie, parametres et valeurs de travail compares **au bit pres** a chaque
bloc. Etat au 2026-11-25 : tout identique (0 echantillon different).

```bash
cmake -S plugin/mm-arp/web-engine/compare -B build-compare -DCMAKE_BUILD_TYPE=Release   # JUCE 8.0.9 (FetchContent ou -DJUCE_DIR)
cmake --build build-compare -j --target mmarp_compare_vst
./build-compare/mmarp_compare_vst_artefacts/Release/mmarp_compare_vst
```

## Le WebAssembly du site (/mm-arp/play/)

Le build du site : `npm run plugin:arp:wasm` (`scripts/build-arp-wasm.sh`), clang 18 en `--target=wasm32-wasi`
(`-mexec-model=reactor`, sans Emscripten, `web-engine/wasm_rt.cpp` pour les exceptions), memes options
(`-ffp-contract=off`), vers `public/mm-arp/mm-arp-engine.wasm` (hors de git ; la CI le refait :
`.github/workflows/pages.yml`). Cinq imports seulement : `wasi_snapshot_preview1.{clock_time_get, fd_close, fd_seek,
fd_write, random_get}`. Sans `__EMSCRIPTEN__`, `nowS` lit `steady_clock` (donc `clock_time_get`) : le compteur CPU vit ;
le worklet lui donne `performance.now()` s'il l'a, sinon `Date.now()` (Chrome : a la milliseconde, la face recoit alors
le total lisse comme pic).

Le reste du navigateur (`src/v4/plugin/arp/web`) : `arpEngine.worklet.js` (l'AudioWorklet : le module recu du fil
principal, `parseProgram` recopie, `mmarp_idle` a 15 Hz, la telemetrie, les parametres, la table MIDI LEARN et
l'analyseur vers le fil principal), `webBackend.ts` (`window.__JUCE__` sans JUCE : l'editeur, son minuteur et ses
messages, les presets, le clip MIDI), `midiFile.ts` (le .mid de JUCE, octet pour octet), `storage.ts` (l'etat de
l'instance a part de celui du site) ; la page : `src/v4/plugin/WebArpPlugin.tsx`.

## Le WebAssembly (Emscripten, une autre voie)

Choix : **`STANDALONE_WASM` sans glu JS** (`--no-entry`, un module "reactor" : `_initialize` puis les `mmarp_*`).
L'AudioWorkletGlobalScope n'a ni `fetch`, ni `importScripts`, ni (selon le navigateur) `performance` ou `TextDecoder`,
dont la glu de `MODULARIZE` a besoin ; et le mode Wasm Audio Worklets d'Emscripten (`-sAUDIO_WORKLET`) exige
`SharedArrayBuffer`, donc les en-tetes COOP / COEP, que GitHub Pages ne sait pas servir. Ici : le fil principal compile
le module (`WebAssembly.compileStreaming(fetch(...))`), le passe au worklet (`processorOptions`, un `WebAssembly.Module`
se clone), le worklet l'instancie avec un petit objet d'imports et appelle les exports directement. Rien d'asynchrone
dans le worklet, rien de cache.

```bash
emcc -O3 -std=c++17 -ffp-contract=off -fno-exceptions -fno-rtti \
  -I plugin/mm-arp/dsp -I plugin/mm-arp/src -I plugin/mm-arp/web-engine \
  plugin/mm-arp/web-engine/ArpEngine.cpp \
  plugin/mm-arp/dsp/Voyager.cpp plugin/mm-arp/dsp/ArpFx.cpp plugin/mm-arp/dsp/Arp.cpp plugin/mm-arp/dsp/Params.cpp \
  plugin/mm-arp/dsp/Hell.cpp plugin/mm-arp/dsp/Hell2.cpp plugin/mm-arp/dsp/Sky.cpp plugin/mm-arp/dsp/Decap.cpp \
  plugin/mm-arp/dsp/Echo.cpp plugin/mm-arp/dsp/ParamEq.cpp \
  -s WASM=1 -s STANDALONE_WASM=1 --no-entry -s SINGLE_FILE=0 \
  -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=67108864 -s MAXIMUM_MEMORY=268435456 -s STACK_SIZE=1048576 \
  -s FILESYSTEM=0 -s ASSERTIONS=0 \
  -s EXPORTED_FUNCTIONS=_mmarp_create,_mmarp_destroy,_mmarp_prepare,_mmarp_process,_mmarp_idle,_mmarp_param_count,_mmarp_param_id,_mmarp_param_index,_mmarp_param_default,_mmarp_params,_mmarp_set_param,_mmarp_knobs_known,_mmarp_set_knobs_known,_mmarp_set_master_db,_mmarp_set_arp_enabled,_mmarp_set_clip_priority,_mmarp_set_program,_mmarp_run,_mmarp_midi,_mmarp_telemetry,_mmarp_telemetry_size,_mmarp_set_spec_on,_mmarp_spec_frame,_mmarp_learn,_mmarp_unmap,_mmarp_unmap_all,_mmarp_map_set,_mmarp_take_map_changed,_mmarp_ccmap,_mmarp_render_clip,_mmarp_seed,_mmarp_set_seed,_mmarp_set_offline,_mmarp_set_host_position,_mmarp_alloc,_mmarp_free \
  -o public/mm-arp/mm-arp-engine.wasm
```

- `-ffp-contract=off` sur toutes les sources (le wasm n'a pas de FMA de base, mais la regle reste celle du DSP) ; ni
  `-ffast-math` ni `-msimd128` (inutile : le son doit rester celui du code scalaire) ;
- la memoire, mesuree en natif : ~38 Mo en regime a 48 kHz, ~49 Mo au pic d'un recalcul de reverb (SIZE au maximum) ;
  ~72 / 94 Mo a 96 kHz. 64 Mo au depart, la croissance jusqu'a 256 Mo (elle n'arrive que dans `mmarp_prepare` ou
  `mmarp_idle`, jamais dans `mmarp_process` avec des blocs de 128) : apres chaque appel qui alloue, le JS refait ses vues
  si `memory.buffer` a change ;
- `ENVIRONMENT` ne sert pas en `STANDALONE_WASM` (pas de glu).

Les imports a fournir (le plus simple : les lister avec `WebAssembly.Module.imports(module)` et boucher ce qui manque) :

| Import | Contenu |
| --- | --- |
| `wasi_snapshot_preview1.clock_time_get(id, precision, ptr)` | appele par la chaine (`ArpFx`, son chrono interne) a chaque morceau de 128 : ecrire un u64 en ns a `ptr` et rendre 0 ; sans `MMARP_WEB_CPU` le compteur l'ignore, `0n` suffit |
| `wasi_snapshot_preview1.random_get(buf, len)` | lie par `std::random_device` (jamais appele : le moteur est toujours seede) : rendre 0 |
| `wasi_snapshot_preview1.fd_write`, `fd_close`, `fd_seek`, `proc_exit` | les messages d'abandon : rendre 0, `proc_exit` lance une erreur |
| `env.emscripten_notify_memory_growth(i)` | la memoire a grandi : refaire les vues |

Esquisse du worklet :

```js
const x = new WebAssembly.Instance(module, imports).exports; // module : processorOptions
x._initialize();
const e = x.mmarp_create(seed >>> 0); x.mmarp_prepare(e, sampleRate, 128);
const L = x.mmarp_alloc(512), R = x.mmarp_alloc(512);
// process() : pour chaque evenement MIDI x.mmarp_midi(e, offset, s, d1, d2) ; puis
x.mmarp_process(e, L, R, 128);
out[0].set(new Float32Array(x.memory.buffer, L, 128)); out[1].set(new Float32Array(x.memory.buffer, R, 128));
// tous les ~25 quanta : x.mmarp_idle(e) ; ~30 fois par seconde : new Float64Array(x.memory.buffer, x.mmarp_telemetry(e), 72)
```

Une autre voie, si une glu est voulue : `-s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORT_NAME=createMMArp
-s ENVIRONMENT=shell -s INCOMING_MODULE_JS_API=wasmBinary -s TEXTDECODER=0 -s FILESYSTEM=0`, le `.wasm` passe en
`wasmBinary` depuis le fil principal, et `globalThis.performance ??= { now: () => Date.now() }` avant l'import (la glu
lit `performance.now()` pour `clock_gettime`).

## Les limites connues

- **Le bit pres entre machines** : le moteur (`Voyager`) prend ses fonctions mathematiques dans `Voyager.fdlibm.inc`
  (celles de V8) : identique partout, wasm compris. Les effets (`ArpFx`, `Decap`, `Echo`, `Hell`, `Hell2`, `Sky`,
  `ParamEq`, `ModLfo`, `Halfband`) et quelques lois du processeur appellent la libm du systeme (`std::sin`, `exp`,
  `pow`, `tanh`...) : Apple, MSVC et musl (Emscripten) peuvent differer d'un dernier bit, comme deja le VST3 Mac et le
  VST3 Windows entre eux. Ecart de l'ordre de -150 dB, inaudible. En natif sur la meme libm : 0 ecart (`compare/`).
- **Les denormaux** : le VST3 met FTZ / DAZ (`ScopedNoDenormals`), le wasm n'a pas ce mode : des queues sous 1e-38
  restent non nulles (aucun effet audible) mais peuvent couter cher au CPU sur x86 dans les longues queues de reverb.
  A surveiller avec la mesure CPU du navigateur.
- **FMA sur Apple Silicon** : `PluginProcessor.cpp` est compile sans `-ffp-contract=off` ; sur arm64, clang peut y
  fusionner quelques multiplications-additions (`internalPpq_ += n * pps` avec un bloc qui n'est pas une puissance de 2,
  `ppq + i * pps` dans les tranches de 32, le glissement de HELL). Avec des quanta de 128 le premier est exact ; le
  reste reste au dernier bit pres.
- **La reverb dans le worklet** : `makeReverb` prend 6 a 40 ms ; appele par `mmarp_idle` dans le fil audio, il peut faire
  sauter un quantum pendant qu'on tourne SIZE, TONE ou PRE DELAY (le VST3 le fait sur un fil a part). Le limiter a
  ~15 Hz (comme le timer du VST3) ; une suite possible : un second module wasm dans un Worker qui calcule la reponse.
- Pas de `getStateInformation` / `setStateInformation` (le JS garde l'etat, voir plus haut), pas de `latencySamples`
  declaree a un hote (la telemetrie la donne), pas de gestes d'automation (`mm_gesture`).
