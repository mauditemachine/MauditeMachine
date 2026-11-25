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
