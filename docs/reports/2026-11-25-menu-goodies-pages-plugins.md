# 2026-11-25 : menu, GOODIES, pages des plugins et MM-RYTM dans le navigateur

Mika : "Goodies est trop petit dans le menu on le voit pas" ; "laisse MM-RYTM et MM-ARP dans le menu mais cette fois pour les telechargements et les presentations" ; "DECK et MIX aussi dans Goodies" ; "pourquoi tu mettrais pas les plugins en version web aussi ... le plugin en entier, et uniquement en desktop" ; "des dernieres versions des VST".

## Fait

- **Menu** (`Header.tsx` `PAGE_LINKS`, `MenuSheet.tsx`) : huit grands titres, GOODIES avec un badge FREE jaune ; MM-RYTM et MM-ARP ouvrent la page de leur plugin ; la pastille GOODIES de "Under the hood" est retiree. Titres desktop un peu plus petits pour tenir dans 1440 x 900.
- **En-tete** : `GoodiesButton`, jaune (cadeau, GOODIES, FREE) avant MENU sur desktop, cadeau seul de 1024 a 1279 px sans le mot, pastille jaune au telephone.
- **Pages `/mm-rytm/` et `/mm-arp/`** (`PluginPage.tsx`, `src/data/vstPages.json`) : image, systemes (vst.json), texte, "Play the full plugin" (RYTM, desktop), "Play it on the site", ce que fait le plugin, formulaire courriel (`VstDownload only`). Prerendu (`prerender-seo.mjs`) avec un `SoftwareApplication` (offre a 0), dans `sitemap.xml` et `llms.txt` ; titres et descriptions dans `seo-meta.json`.
- **GOODIES** : Play online (MM-RYTM, MM-ARP, MM-DECKS), cartes des deux plugins (vers leurs pages), formulaire pour les deux, puis fonds d'ecran et pochettes.
- **`/mm-rytm/play/`** (`WebPlugin.tsx`, `theme/base.ts` `PLUGIN_WEB`) : `PluginFace` (la face du VST3) sans `bridge.start()`, donc le son du site (identique au plugin, `plugin/mm-rytm/tests/compare.cpp`). Bande en haut : "Get the VST3, free" et retour au site. Telephone et ecrans tactiles : un message "Desktop only". noindex.
- **MM-ARP v53** (`9744576`) publie dans `mm-arp-public`.
- Effet de bord du build : `prerender-seo.mjs` trouve de nouveau le chunk de la machine dans le manifeste de vite et pose ses 12 `modulepreload` sur les pages de la machine (il en posait 0 : la detection ne trouvait plus le chunk) ; c'est le comportement prevu par ce script.

## Verifie (Chromium headless muet)

- Menu desktop : 8 titres, le dernier finit a 863 px sur 900 ; pastilles : MERCH seul.
- MM-RYTM depuis le menu : `/mm-rytm/`, la page, ses deux boutons et le formulaire ; le bouton GOODIES de l'en-tete ouvre `/goodies/` (3 machines, 2 cartes).
- `/mm-rytm/play/` : la face du plugin, `data-v4-muted=0`, un `AudioContext` cree au premier clic, aucune erreur ; au telephone : "Desktop only".
- `npm run build`, `firmware:check`.

## Reste

- MM-ARP en version web : apres la fusion de `claude/nifty-bohr-7ixmpf` (face v53 ; DISTO, LFO 3-4 et matrice seulement en C++).

## Les installeurs (meme jour)

Mika : "je voudrais vraiment que tu fasses un systeme d'installation comme tous les bons plugins qui se respectent comme ca je me prends pas la tete ! et evite les design trop ia".

- `plugin/installer/` : `mac/` (distribution.xml, welcome.html, conclusion.html, preinstall, postinstall, le logo en bas a gauche en clair et en sombre, 1x et 2x), `windows/installer.iss` (Inno Setup 6, panneau noir avec le A en or, icone), `license.txt`. Textes courts a la voix de Mika, aucun degrade ni effet.
- `.github/workflows/plugin-public.yml` : trois jobs. `mac` : pkgbuild (bundle non relocalisable) + productbuild (hostArchitectures arm64 et x86_64, macOS 11), puis `sudo installer` sur le runner et `codesign --verify` du plugin installe. `windows` : Inno Setup (choco), installation silencieuse, verification du .vst3, desinstallation silencieuse, verification qu'il est parti. `publish` : le .pkg, le .exe et le zip qui les reunit dans `mm-<plugin>-public`.
- `/download/` : boutons Mac et Windows, celui du visiteur en plein et lance tout seul ; plus de ligne de Terminal.
- Non signes : un clic de plus a la premiere ouverture (Mac : Open Anyway ; Windows : Run anyway).

## MM-ARP dans le navigateur (meme jour)

Mika : "je veux les memes plugins dans mon site.. exactement les memes !!! commence par ARP ... en desktop".

- `plugin/mm-arp/web-engine/ArpEngine.{h,cpp}` : `PluginProcessor.cpp` sans JUCE, API C (36 fonctions). Banc `compare/compare_vst.cpp` contre le vrai processeur JUCE 8.0.9 : 91/91, 0 echantillon different (80 presets, automation QUALITY/ENGINE/LATENCY, DISTO, HELL, matrice, MIDI, blocs de 1 a 1024).
- WebAssembly : clang 18 `wasm32-wasi` (paquets Ubuntu `wasi-libc`, `libc++-18-dev-wasm32`...), `scripts/build-arp-wasm.sh`, 750 Ko, 5 fonctions systeme. Par rapport au natif x86 : 145 rendus sur 160 identiques au bit, les autres different seulement sur des valeurs quasi nulles (le wasm ne vide pas les sous-normaux), au plus 7e-15.
- `/mm-arp/play/` : la worklet (`src/v4/plugin/arp/web/arpEngine.worklet.js`), le faux backend JUCE (`webBackend.ts` : messages de la face, minuterie de l'editeur portee ligne a ligne, presets, MIDI), la page (`WebArpPlugin.tsx`, `WebPluginShell` partage avec RYTM). 35 essais headless muets au vert.
