# MM-RYTM, le moteur du navigateur (web-engine)

Le processeur du VST3 (`src/PluginProcessor.cpp`, `src/SampleBank.cpp`) sans JUCE, avec une API C, pour le compiler en
WebAssembly et le jouer dans un AudioWorklet du site, pilote par la face du plugin (`src/v4/plugin`, son pont
`bridge.ts`) : `/mm-rytm/play/`. Le but : le meme son que le VST3, pas une approximation. La logique du processeur est
recopiee telle quelle (`RytmEngine.cpp`), le DSP est celui du plugin (`dsp/`, la bibliotheque `mm_dsp`), sans une ligne
changee.

| Fichier | Role |
| --- | --- |
| `RytmEngine.h`, `RytmEngine.cpp` | `mmrytmweb::RytmEngine` (l'etat, `renderLoop`, `processBlock` du VST3 sans JUCE), `Var` / `parseJson` (le `juce::var` de `juce::JSON::parse`), `Bank` (la banque des samples), l'API C `mmrytm_*` |
| `wasm_compat.h` | des `std::mutex` / `std::lock_guard` vides pour la libc++ de WASI (sans fils) : `dsp/Engine.h` s'en sert |
| `wasm_rt.cpp` | `__cxa_allocate_exception` / `__cxa_throw` (le wasm est sans exceptions : un manque de memoire arrete le module) |
| `../tests/engine_web_test.cpp` | le banc natif (`mm_engine_web_test`, ctest `engine_web`) |
| `../tests/engine_web_programs.h` | des programmes de la face et des coups en direct tires au hasard (tout ce que le processeur lit) |
| `compare/` | la parite au bit pres avec le vrai `MMRytmProcessor` (JUCE, hors du build du depot), et le wasm contre le natif |

## Ce qui correspond a quoi

L'en-tete de `RytmEngine.h` donne, pour chaque fonction, les lignes de `src/PluginProcessor.cpp` qu'elle recopie
(`parseSound` 38-69, `parseHit` 71-131, `parseFx` 134-161, `parseProgram` 163-200, `soundFor` 218-234, `buildState`
236-256, `renderLoop` 258-307, `faceProgram` 330-340, `faceHit` 352-378, `prepareToPlay` 418-424, `processBlock`
426-471...). **Toute modification de `PluginProcessor.cpp` ou de `SampleBank.cpp` se reporte ici**, puis se verifie avec
`compare/` (plus bas).

Ce qui remplace JUCE, sans rien changer au son :

- `juce::JSON::parse` et `juce::var` : `parseJson` et `Var`, recopies de `juce_JSON.cpp` (un entier est un `int`, au-dela
  de 2^31 un `int64` ; un nombre a virgule passe par `readDoubleValue` : 18 chiffres significatifs, puis `strtod` ; chaines
  et `\u` en UTF-8 ; la virgule finale passe, un nom vide non). Le programme (`mm_program`) et le coup (`mm_hit`)
  arrivent donc en texte JSON, lus par le C++ comme le VST3 les lit : `num`, `flag`, les bornes, tout est le meme ;
- le fil du calcul (`Renderer`, `wake.wait(100)`) : `renderLoop(now)`, un passage, appele par le JS apres chaque message
  qui reveille le fil et toutes les 100 ms ;
- les mutex et les atomiques : un seul fil par instance (le worklet), des valeurs simples ;
- `master` (l'APVTS) : `master_`, la valeur brute en dB ; la face du VST3 n'y touche pas (0 dB) ;
- `getPlayHead` : aucun dans le navigateur (le tempo du programme, RUN sur l'horloge interne) ; `mmrytm_set_host_position`
  en donne un pour le bloc suivant seulement (les bancs) ;
- le `MidiBuffer` : une file (`mmrytm_midi`), triee par position (stable), lue au `mmrytm_process` suivant ;
- `ScopedNoDenormals` : le meme registre en natif (SSE FTZ + DAZ, arm64 FZ) ; rien en wasm (il n'y en a pas) ;
- `SampleBank` : `Bank`, la meme regle (le prefixe du nom de fichier dit la famille, `byKey` par la famille et le nom),
  remplie fichier par fichier (`mmrytm_bank_add`), decodee par `mm::decodeWav` ;
- `getStateInformation` / `setStateInformation` : non repris (la page garde l'etat de la face dans son propre espace du
  localStorage, `src/v4/plugin/arp/web/storage.ts`, espace `mm.web.rytm.ls:`).

### Le mode asynchrone (le navigateur)

Calculer un kit prend plusieurs centaines de millisecondes (un OH : ~70 ms, un CY : ~100 ms en natif ; plus en wasm) ;
le VST3 le fait sur son fil du calcul, l'ancien etat joue pendant ce temps. Dans le navigateur, le fil audio (le
worklet) ne doit jamais attendre : avec `mmrytm_set_async(e, 1)`, les deux calculs lourds du fil du calcul, des fonctions
pures du DSP, partent ailleurs :

- un son : `mm::renderLayers` pour chacune de ses variantes (`renderSound`, soit `soundFor` sans le cache) ;
- la reponse de la reverb : `mm::ReverbIR::make`.

Un passage de `renderLoop` qui en a besoin les demande (`mmrytm_job_take`, `mmrytm_job_desc`, `mmrytm_job_sample`) et
attend : le programme et les coups restent en attente, l'ancien etat joue, comme dans le VST3. Un Worker du site
(`src/v4/plugin/rytm/web/rytmRender.worker.js`), avec une seconde instance du meme module, fait le calcul
(`mmrytm_render_sound`, `mmrytm_render_reverb`) et renvoie les nombres (`mmrytm_job_sound_*`, `mmrytm_job_reverb`) ; le
passage suivant reprend la ou le VST3 en est, avec les memes sons. Le meme code, donc les memes nombres : le banc natif
le verifie au bit pres (mode asynchrone = mode synchrone), et `compare_vst` compare le mode synchrone au VST3.

Seule difference : si un programme neuf arrive pendant un calcul, le VST3 publie d'abord l'ancien puis le neuf, le
navigateur saute directement au neuf (l'etat final est le meme).

## L'API C

Toutes les fonctions prennent le moteur (`MMRytmEngine*`, un entier en wasm) en premier argument, sauf la banque et le
calcul du Worker.

| Fonction | Ce qu'elle fait (le VST3) |
| --- | --- |
| `mmrytm_create()`, `mmrytm_destroy(e)` | une instance |
| `mmrytm_prepare(e, sampleRate, maxBlock)` | `prepareToPlay` |
| `mmrytm_process(e, L, R, n)` | `processBlock` (la sortie est ecrite, pas melangee) |
| `mmrytm_idle(e, now)` | un passage du fil du calcul (`renderLoop` ; `now` en secondes, pour liberer les etats retires) ; rend 1 s'il reste du travail en attente |
| `mmrytm_pending(e)` | un programme ou des coups attendent leur passage |
| `mmrytm_program(e, json, len)` | `faceProgram` (le texte de `mm_program`) ; 1 si le programme est pris |
| `mmrytm_hit(e, json, len)` | `faceHit` (l'objet de `mm_hit`, en JSON) |
| `mmrytm_run(e, on)`, `mmrytm_fill(e, on)` | `faceRun`, `faceFill` |
| `mmrytm_midi(e, offset, status, d1, d2)` | une note du prochain bloc (GM vers les huit premieres pistes, All Notes Off) |
| `mmrytm_set_host_position(e, playing, ppq, bpm)` | une tete de lecture d'hote pour le bloc suivant |
| `mmrytm_set_master_db(e, db)` | le parametre `master` |
| `mmrytm_feedback(e)` | `feedback()` : playing, internal, step (-1 a l'arret, comme l'editeur l'envoie), seq, mask |
| `mmrytm_stats(e)` | 16 entiers : programmes, etats publies, coups en direct (tout de suite, apres calcul), sons calcules ici, livraisons du Worker, demandes, notes MIDI ; puis le dernier etat : bpm x 1000, pas, page, sons, coups, pistes jouees, reverb x 1000, swing x 1000 |
| `mmrytm_set_async(e, on)` et `mmrytm_job_*` | le mode asynchrone (plus haut) ; `mmrytm_job_fail` : le calcul se fait ici |
| `mmrytm_bank_add(file, len, data, size)`, `mmrytm_bank_count()`, `mmrytm_bank_has(key, len)` | la banque (commune a l'instance du module, comme `SampleBank::get()`) |
| `mmrytm_render_sound(desc, sample, len)`, `mmrytm_rendered_*` ; `mmrytm_render_reverb(...)`, `mmrytm_reverb_*` | le calcul du Worker |
| `mmrytm_alloc(n)`, `mmrytm_free(p)` | de la memoire du wasm pour passer textes et tableaux |

La description d'un son (`mmrytm_job_desc`, 23 doubles) : `id`, `sr`, `model`, `tune`, `attack`, `decay`, `drive`,
`snappy`, `gate`, `sweep`, `sdTune`, `sdDecay`, `sdTone`, `syn`, `smp.lev`, `smp.st`, `smp.start`, `smp.len`, `smp.rev`,
`ts`, `pf`, `variants` (`soundToDesc`) ; la cle du sample a part. Une reverb : `[-1, sr, sec, hi, pre]`.

## Construire et verifier

```bash
cmake -S plugin/mm-rytm -B build -DMM_BUILD_PLUGIN=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build build -j8
./build/mm_engine_web_test           # JSON, banque, RUN / STOP, asynchrone = synchrone au bit pres, coups, MIDI, hote, MASTER
(cd build && ctest)                  # engine (le DSP) et engine_web
```

### La parite avec le VST3 (`compare/`)

Le vrai `MMRytmProcessor` (`src/PluginProcessor.cpp` et `SampleBank.cpp` copies tels quels dans le dossier de build, une
fenetre vide a la place de la WebView, les samples embarques par `juce_add_binary_data` comme dans le plugin) et le
moteur, cote a cote, memes entrees : les programmes de la face donnes en argument (les presets d'usine, captures par
`bridge.compile()`), 24 programmes tires au hasard (samples de la banque et absents, LFO, COND, PROB, lock trigs,
verrous de tranche, RTRG, uTIME, FLTR, effets globaux, pages, SWING), des coups en direct (son du pad, son neuf), FILL,
un programme neuf en jouant, RUN / STOP, les notes MIDI et All Notes Off, un transport d'hote (ses sauts, son arret),
MASTER, des blocs de 128, de 441 et de 1 a 1024, a 44,1, 48 et 96 kHz. Le fil du calcul du VST3 est arrete : son
`renderLoop` est appele aux memes moments que `mmrytm_idle`. Sortie et tete comparees au bit pres a chaque bloc.

```bash
cmake -S plugin/mm-rytm/web-engine/compare -B build-compare -DCMAKE_BUILD_TYPE=Release   # JUCE 8.0.9 (FetchContent ou -DJUCE_DIR)
cmake --build build-compare -j --target mmrytm_compare_vst
./build-compare/mmrytm_compare_vst_artefacts/Release/mmrytm_compare_vst [programme.json ...]
```

Etat au 2026-11-25 (Linux x86-64, glibc) : 25 programmes de la face + 24 au hasard, 18 105 225 echantillons, **0
different**, la tete identique a chaque bloc. Un ecart de 1e-7 en relatif sur un seul reglage (CHORUS) donne des
centaines de milliers d'echantillons differents : le banc le voit.

### Le wasm contre le natif (`compare/wasm_parity.*`)

La meme fonction (`wasm_parity.cpp`) compilee en natif et en wasm, les memes programmes, en mode synchrone et
asynchrone ; les commandes sont en tete de `wasm_parity.mjs`. Les sons calcules (`renderLayers`) et l'impulsion de la
reverb sont identiques au bit pres. Le reste differe au dernier bit : les fonctions mathematiques de la libc. glibc et
celle de WASI (musl) ne rendent pas toujours le meme dernier bit (sur 200 000 appels : `sin` 3 %, `cos` 3 %, `tan` 4 %,
`tanh` 12 %, `log10` 21 %, `exp` et `pow` < 0,1 %), et le moteur en appelle a chaque echantillon (enveloppes, PAN, LFO,
DIST, GLUE, LIMITEUR, la FFT de la reverb). Mesure au 2026-11-25 (8 programmes au hasard + 4 de la face, 3 s chacun,
synchrone et asynchrone : 6 912 000 echantillons) : 17 % des echantillons au dernier bit pres, l'ecart RMS de -93 a -208
dB sous le signal selon le programme, l'ecart le plus grand 1,0e-3 (-60 dBFS) sur quelques dizaines d'echantillons, quand
un dernier bit deplace d'un echantillon la fin d'une voix (DECAY par `pow`) ou fait basculer un arrondi (un LFO
quantifie, un seuil). Inaudible ; c'est deja le cas entre le VST3 Mac (libm d'Apple, FMA sur arm64) et le VST3 Windows
(MSVC), qui ne sont pas non plus identiques au bit pres. Asynchrone = synchrone, au bit pres, dans le wasm aussi.

## Le WebAssembly du site (/mm-rytm/play/)

Le build du site : `npm run plugin:rytm:wasm` (`scripts/build-rytm-wasm.sh`), clang 18 en `--target=wasm32-wasi`
(`-mexec-model=reactor`, sans Emscripten), `-include wasm_compat.h`, vers `public/mm-rytm/mm-rytm-engine.wasm` (hors de
git ; la CI le refait : `.github/workflows/pages.yml`, etape "Moteur MM-RYTM", jamais bloquante). Trois imports
seulement : `wasi_snapshot_preview1.{fd_close, fd_seek, fd_write}` (les messages d'un abandon) ; le JS bouche tout autre
import. Memoire : 64 Mo au depart, jusqu'a 512 Mo ; apres chaque appel qui alloue, le JS refait ses vues si
`memory.buffer` a change.

Le reste du navigateur (`src/v4/plugin/rytm/web`) :

- `rytmEngine.worklet.js` : l'AudioWorklet, le processeur (le module recu du fil principal, les messages de la face en
  JSON UTF-8, un passage du fil du calcul apres chaque message et toutes les 100 ms, la tete vers l'editeur a chaque pas).
  RUN demande avant le premier etat publie (le premier geste etait PLAY) attend que le kit soit calcule, comme un VST3
  qu'on lance une fois charge ;
- `rytmRender.worker.js` : le fil du calcul (une seconde instance du module ; la banque, telechargee a la demande de
  `public/samples/rytm`, les memes octets que `BinaryData` ; avant le premier geste, les sons du programme calcules
  d'avance a la frequence attendue) ;
- `webBackend.ts` : `window.__JUCE__` sans JUCE (l'editeur : ses messages, son minuteur 30 Hz `mm_transport`), le
  contexte du site au premier geste, le Worker, le message quand le moteur n'est pas publie ;
- la page : `src/v4/plugin/WebRytmPlugin.tsx` (la coquille commune `WebPlugin.tsx` `WebPluginShell`).

## Les limites connues

- **Le bit pres entre machines** : voir plus haut (la libc) ; en natif sur la meme libc, 0 ecart avec le VST3.
- **FMA sur Apple Silicon** : le DSP et le processeur du VST3 sont compiles sans `-ffp-contract=off` ; sur arm64, clang
  peut fusionner des multiplications-additions. Ni le wasm ni le x86-64 n'ont de FMA : le VST3 Mac differe d'eux au
  dernier bit.
- **Les denormaux** : le VST3 met FTZ / DAZ, le wasm n'a pas ce mode : des queues sous 1e-38 restent non nulles
  (inaudible ; un peu de CPU sur x86 dans les longues queues). `-DMMRYTM_NO_FTZ` retire FTZ / DAZ du natif (les bancs).
- **Les samples perso** : comme le VST3, la banque ne connait que `public/samples/rytm` ; un sample de ce navigateur
  (IndexedDB) ou de la banque synthetisee joue sans sa couche SAMPLE.
- **Un echec du Worker** (un calcul qui s'arrete, la memoire) : le worklet fait le calcul lui-meme (`mmrytm_job_fail`),
  le fil audio attend, et sans la banque (elle vit dans le Worker) la couche SAMPLE de ce son se tait.
- Pas d'etat de projet (`mm_state` est ignore : le localStorage de l'instance le garde deja), pas d'hote (ni transport
  ni notes MIDI d'Ableton : `mmrytm_midi` et `mmrytm_set_host_position` servent aux bancs), pas de `master` sur la face.
