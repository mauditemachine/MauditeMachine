# MM-RAGE

Un plugin Maudite Machine, dans la famille de MM-RYTM, MM-ARP et MM-HELL : la **DISTO du MM-ARP** (façon Decapitator : douze styles de saturation, MORPH, multibande, dynamique, feedback, filtres avant et après, caisse, enveloppe et LFO) en effet audio VST3 seul, avec une interface native en pages. Dans Ableton : **Plug-Ins > Maudite Machine > MM-RAGE**. Usage perso. Installation : [INSTALL.md](INSTALL.md).

## Ce qu'il y a dedans

| Dossier | Contenu |
| --- | --- |
| `dsp/Decap.{h,cpp}` | Le DSP, **copie conforme** de `plugin/mm-arp/dsp/Decap.{h,cpp}` (MM-ARP v32, branche `claude/nifty-bohr-7ixmpf`), compilé avec les mêmes options (`-ffp-contract=off`, SSE4.1) : le même son au bit près. |
| `dsp/RagePatch.{h,cpp}` | Les réglages dans les unités des paramètres, `settingsOf` (patch + tempo vers le DSP), ce qui est grisé, la banque d'usine (INIT, les 20 de `src/v4/plugin/arp/disto.ts`, puis 64 propres au MM-RAGE en huit familles), les textes. Sans JUCE. |
| `src/PluginProcessor.*` | 54 paramètres pour l'hôte (une table : paramètre <-> patch), 85 programmes, tempo de l'hôte, ATTITUDE, état du projet (réglages, taille de fenêtre, programme, page). Entrée mono ou stéréo, sortie stéréo, 32 échantillons de latence déclarés. |
| `src/PluginEditor.*`, `RageLook.*`, `RageControls.*`, `RageViews.*` | La fenêtre, en JUCE natif (pas de WebView), le plan de MM-HELL (1000 x 620) : quatre pages (RAGE, SHAPE, BANDS, MOVE) derrière des onglets, une colonne toujours là (VU ATTITUDE, DRIVE, PUNISH, AUTO, MIX, OUTPUT), les potards façon Moog dessinés en vectoriel, le cuir relevé, la banque en familles, la bande d'info, le menu (SETTINGS, WINDOW SIZE). |
| `assets/` | Les images `retro/` de la face du MM-ARP (touches, leviers, cuir, bois), SF Pro Display, Robot Radicals. Les potards n'ont pas d'image : ils sont dessinés. |
| `tests/` | `decap_test` (copie de celui du MM-ARP), `presets_test` (banque = MM-ARP valeur par valeur, niveaux, diversité, stabilité, textes ; référence `presets_ref.inc` tirée du vrai `disto.ts` par `presets-ref.mjs`), `host_test` (le processeur), `ui_test` (la fenêtre, gestes de la souris), `snapshot` (captures PNG). |

## Les pages

- **RAGE** : STYLE en deux rangées de touches (CLASSIC : A, E, N, T, P ; EXTENDED : TAPE, FUZZ, DIODE, AMP, RECT, FOLD, CRUSH), l'écran **TRANSFER** (la courbe du DSP au DRIVE du moment, la cible du MORPH en gris, la lecture STYLE / MORPH / DRIVE / LEVEL / MIX), MORPH et MORPH TO, LOW CUT et THUMP, TONE, HIGH CUT et STEEP.
- **SHAPE** : PRE FILTER, BOX, POST FILTER (modes en touches, fréquence, résonance, taille, dose), DYNAMICS, FEEDBACK et FB FREQ, l'écran **RESPONSE** (la réponse des filtres et de la caisse).
- **BANDS** : 1, 2 ou 3 bandes, les coupures (potards, ou à tirer sur la carte), la matrice LOW / MID / HIGH : STYLE, DRIVE, MIX, LEVEL, SOLO, BYP.
- **MOVE** : ENVELOPE -> DRIVE (AMOUNT, SPEED), le LFO (SHAPE, RATE en Hz ou en notes avec SYNC, AMOUNT, TARGET) et sa forme sur une mesure.
- Toujours à droite : le VU **ATTITUDE** (ce qui entre dans la saturation), le **DRIVE** (le plus gros potard, son échelle en dB, qui passe à 20..56 avec PUNISH), PUNISH, AUTO, MIX, OUTPUT.
- Ce qui ne fait rien tel que c'est réglé est grisé (les filtres sur OFF, les bandes au-delà de BANDS, le LFO à AMOUNT 0...).

## Écarts avec la DISTO du MM-ARP

- **Pas de style MM** (l'OVERDRIVE du moteur du synthé n'existe pas ici). INIT met le style A.
- **DRIVE 0 reste en circuit** (0 dB, la saturation au repos) : dans le MM-ARP, DRIVE 0 contourne la DISTO. Ici, le retard de 32 échantillons ne change jamais : l'hôte le compense une fois pour toutes, aucun décalage quand on passe par 0. Pour un vrai contournement : le bouton d'activation de l'hôte, ou MIX à 0 (le sec retardé, au bit près).
- **Le niveau de la prise** : la DISTO du MM-ARP sature le synthé multiplié par son VOLUME (0.371 au départ). MM-RAGE prend la même référence : une piste qui crête à -6 dBFS entre dans les courbes comme le synthé du MM-ARP.
- **LFO SYNC et la note du LFO** sont des paramètres séparés (dans le MM-ARP, un seul réglage sert aux deux) : l'automation est plus lisible. Mêmes lois.

## Construire et tester

```bash
cmake -S plugin/mm-rage -B build-dsp -DMM_BUILD_PLUGIN=OFF && cmake --build build-dsp -j && ./build-dsp/mmrage_decap_test && ./build-dsp/mmrage_presets_test
```

```bash
node plugin/mm-rage/tests/presets-ref.mjs --check
```

```bash
cmake -S plugin/mm-rage -B build-host -DMM_HOST_TEST=ON && cmake --build build-host -j --target mmrage_host_test mmrage_ui_test mmrage_snapshot
```

```bash
./build-host/mmrage_host_test_artefacts/Release/mmrage_host_test && xvfb-run -a ./build-host/mmrage_ui_test_artefacts/Release/mmrage_ui_test && xvfb-run -a ./build-host/mmrage_snapshot_artefacts/Release/mmrage_snapshot snapshots
```

Le VST3 (Mac) : `cmake -S plugin/mm-rage -B build -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" && cmake --build build --config Release --target MM_RAGE_VST3`. Le CI (`.github/workflows/plugin-rage.yml`) fait tout ça et publie la release `mm-rage-latest`.

`presets-ref.mjs` (sans `--check`) régénère `tests/presets_ref.inc` depuis la branche du MM-ARP (`git show`, Node 22, rien à installer) si la banque de la DISTO y change.

Aucun test ne joue de son (règle du projet) : tout se vérifie sur des buffers et des captures.
