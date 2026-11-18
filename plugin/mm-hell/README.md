# MM-HELL

Un plugin Maudite Machine, dans la famille de MM-RYTM et MM-ARP : un delay infernal façon Echobode (un décaleur de fréquence de Bode dans la boucle d'un delay), en effet audio VST3, avec une interface native. Dans Ableton : **Plug-Ins > Maudite Machine > MM-HELL**. Son moteur est celui du module HELL du MM-ARP (2026-11-13). Usage perso. Installation : [INSTALL.md](INSTALL.md).

## Ce qu'il y a dedans

| Dossier | Contenu |
| --- | --- |
| `dsp/Hell.{h,cpp}` | Le DSP, **copie conforme** de `plugin/mm-arp/dsp/Hell.{h,cpp}` (MM-ARP v31, branche `claude/nifty-bohr-7ixmpf`), compilé avec les mêmes options (`-ffp-contract=off`, SSE4.1) : le même son au bit près. |
| `dsp/HellPatch.{h,cpp}` | Les réglages dans les unités des paramètres, `settingsOf` (patch + tempo + note MIDI vers le DSP), la banque d'usine (port de `src/v4/plugin/arp/hell.ts`), les textes. Sans JUCE. |
| `src/PluginProcessor.*` | 22 paramètres pour l'hôte, 24 programmes, tempo de l'hôte, dernière note MIDI, état du projet (réglages, taille de fenêtre, programme). Entrée mono ou stéréo, sortie stéréo. |
| `src/PluginEditor.*`, `HellLook.*`, `HellControls.*`, `HellViews.*` | La fenêtre, en JUCE natif (pas de WebView) : les images de la face du MM-ARP (`assets/`), potards, leviers, touches à LED, échelle du décaleur, VU, ECHO MAP, banque, bande d'info. |
| `assets/` | Les images `retro/` de la face du MM-ARP (png, jpg), SF Pro Display (converties des `.woff2` du site en `.otf`), Robot Radicals. |
| `tests/` | `hell_test` (copie de celui du MM-ARP), `presets_test` (banque = MM-ARP, sens des décalages, stabilité, textes ; référence `presets_ref.inc` tirée de `hell.ts`), `host_test` (le processeur), `ui_test` (la fenêtre, gestes de la souris), `snapshot` (captures PNG). |

## Écarts avec le module HELL du MM-ARP

- **Cinq presets corrigés** : BARBER DOWN, ABYSS, DEEP STAIRS, SULFUR RAIN, HELLFIRE SWELL avaient un décalage négatif ET la bande DOWN ; les deux signes s'annulent et ils montaient. Ici SIDEBAND est sur UP : ils descendent (`presets_test` le mesure).
- **SYNC et la note du DELAY, SYNC et la note du LFO** sont des paramètres séparés (dans le MM-ARP, un seul réglage à crans) : l'automation est plus lisible. Les valeurs et les lois sont les mêmes.
- **Les anciens réglages** du MM-ARP (TONE, LFO DEPTH, gardés là-bas pour les vieux projets) ne sont pas exposés (neutres).
- **MIX à 35 %** à l'ouverture (dans le MM-ARP, HELL est coupé par défaut).

## Construire et tester

```bash
cmake -S plugin/mm-hell -B build-dsp -DMM_BUILD_PLUGIN=OFF && cmake --build build-dsp -j && ./build-dsp/mmhell_hell_test && ./build-dsp/mmhell_presets_test
```

```bash
cmake -S plugin/mm-hell -B build-host -DMM_HOST_TEST=ON && cmake --build build-host -j --target mmhell_host_test mmhell_ui_test mmhell_snapshot
```

```bash
xvfb-run -a ./build-host/mmhell_ui_test_artefacts/Release/mmhell_ui_test && xvfb-run -a ./build-host/mmhell_snapshot_artefacts/Release/mmhell_snapshot snapshots
```

Le VST3 (Mac) : `cmake -S plugin/mm-hell -B build -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" && cmake --build build --config Release --target MM_HELL_VST3`. Le CI (`.github/workflows/plugin-hell.yml`) fait tout ça et publie la release `mm-hell-latest`.

Aucun test ne joue de son (règle du projet) : tout se vérifie sur des buffers et des captures.
