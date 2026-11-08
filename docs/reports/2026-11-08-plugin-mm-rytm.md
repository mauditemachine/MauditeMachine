# 2026-11-08 - MM-RYTM en plugin VST3 / AU (usage perso)

## 1. Ce qui a ete fait

- `plugin/mm-rytm/dsp/Shots.{h,cpp}` (nouveau) : portage C++17 de `src/v4/audio/shotsdsp.ts`, `sampledsp.ts` et `stretch.ts` (9 moteurs, modeles 909 / 808 / MM, GATE et FDN, surechantillonnage x4 et RIF de Kaiser, calage de sonie K, couche SAMPLE, STRETCH, lecture WAV).
- `plugin/mm-rytm/dsp/Engine.{h,cpp}` (nouveau) : moteur temps reel sans JUCE (8 pistes, 4 voix par piste, kick mono 3 ms, choke CH/OH 8 ms, multi-out, sequenceur 8 x 16 cale sur le ppq de l'hote, swing 50 a 80 %, longueur 1 a 16).
- `plugin/mm-rytm/src/` (nouveau) : plugin JUCE 8.0.9, avec un processeur (environ 170 parametres automatisables, MIDI GM, transport de l'hote ou horloge interne RUN, 8 sorties stereo separees, motif sauve dans l'etat du projet), le calcul des sons dans un thread a part avec 40 ms de repos apres un potard, l'interface (grille 8 x 16, ecoute, mute, LED, panneau de la piste) et les 151 samples de `public/samples/rytm` embarques.
- `plugin/mm-rytm/tests/` (nouveau) : `render-ref.mjs` fait tourner le vrai `shotsdsp.ts` sous Node, `compare.cpp` compare le C++ a cette reference (29 cas), et `engine_test.cpp` verifie le moteur dans les buffers (8 cas).
- `plugin/mm-rytm/CMakeLists.txt`, `README.md`, `INSTALL.md`, `.gitignore` (nouveaux).
- `.github/workflows/plugin.yml` (nouveau) : un job Linux (tests du DSP et comparaison au site), puis un job macOS (macos-latest) qui construit le binaire universel (VST3, AU, Standalone), le signe ad hoc et le publie en artefact `MM-RYTM-macOS`.

## 2. Decisions prises et pourquoi

- **Le plugin vit dans ce repo** (`plugin/mm-rytm`) plutot que dans un repo a part : la session ne pouvait pas creer de repo GitHub. Ca a aussi un avantage, le test compare le C++ au `shotsdsp.ts` du site a chaque push. On pourra l'extraire plus tard avec `git subtree split`.
- **Le DSP est porte en C++ pur, sans JUCE**, ligne a ligne. Resultat : identique bit a bit au JS sur 29 cas (ecart nul), y compris la couche sample stereo, GATE et STRETCH.
- **Les sons sont calcules a l'avance**, comme sur le site, mais dans un thread du plugin et jamais dans le thread audio. Le thread audio ne fait que lire les buffers. Les anciens sons sont liberes 2 s apres, quand plus aucune voix ne les joue.
- **Le kit de depart est celui du site** : BD en 909, les autres en MM, et BD, SD et OH sur le premier sample de leur famille, la synthese a 0.
- **TUNE et DECAY par piste** : ceux du kick sur BD (`tune`, `decay`), ceux de la caisse claire (`sdTune`, `sdDecay`) sur les autres voix. Sur le site, ces potards sont globaux.
- **Une interface JUCE simple** plutot que la face React du site dans une WebView : c'est plus rapide pour une premiere version qui joue dans Ableton. La WebView reste possible plus tard.
- **JUCE n'a pas pu etre compile dans le conteneur** (la compilation de code externe est refusee ici). Toutes les sources du plugin passent quand meme une analyse syntaxique gcc et clang sans erreur ni warning, contre les en-tetes JUCE 8.0.9. Le vrai build se fait sur le runner macOS.
- **Aucune lecture audio pendant les tests** : tout est verifie dans les buffers (regle du projet).

## 3. Ce qui reste a faire / points en suspens

- **Build vert** (run 42454020453, 2026-11-08 06:24 UTC) : tests DSP OK, job macOS OK en 7 min 40 s, artefact `MM-RYTM-macOS` (https://github.com/mauditemachine/MauditeMachine/actions/runs/42454020453/artifacts/13606968023, garde 30 jours). Le premier run sur `macos-14` avait ete annule sans runner : le job tourne maintenant sur `macos-latest`.
- **Artefact lourd** : 404 Mo, bien plus que prevu (samples 7 Mo, binaires universels x 3 formats). A alleger : strip des binaires, ou arm64 seul si le Mac est Apple Silicon.
- **Mika** : telecharger l'artefact, installer (voir `plugin/mm-rytm/INSTALL.md`, avec le `xattr` de quarantaine), puis tester a l'oreille dans Ableton (le son, la sync, le swing, les sorties separees).
- **Pas encore porte** : les effets (DIST, TONE, CHORUS, REVERB, DELAY, le compresseur et le limiteur du site), les parameter locks, les LFO, les scenes, les presets, les 16 pistes, MM-BASS et la face du site.
- Le workflow n'est pas sur `main` : il tourne sur la branche `claude/intelligent-ride-56tyeo` tant qu'elle n'est pas fusionnee.

## 4. Commandes utiles ajoutees

- `cmake -S plugin/mm-rytm -B build-dsp -DMM_BUILD_PLUGIN=OFF && cmake --build build-dsp -j` : construit le DSP et ses tests, sans JUCE.
- `./build-dsp/mm_engine_test` : les tests du moteur.
- `node plugin/mm-rytm/tests/render-ref.mjs build-dsp/ref && ./build-dsp/mm_compare build-dsp/ref public/samples/rytm` : compare le C++ au site.
- `cmake -S plugin/mm-rytm -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release --target MM_RYTM_VST3 MM_RYTM_AU MM_RYTM_Standalone` : le plugin, sur un Mac.
- Workflow `.github/workflows/plugin.yml` : se lance a chaque push qui touche `plugin/`, les samples ou le DSP du site, ou a la main (workflow_dispatch).
