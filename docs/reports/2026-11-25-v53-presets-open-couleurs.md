# 2026-11-25 : MM-ARP v53, banque dark disco, navigateur de presets, OPEN sans diode, vivacite des couleurs

Retour de Mika sur la v52 : "le design est vraiment abouti je suis super content !", mais plus de couleur, des
selecteurs de forme d'onde trop fins, pas fan des diodes dans OPEN, et "pas fan du tout des presets ... et de la
facon dont je peux les selectionner". Quatre questions posees (son, effets, selection, diodes), puis maquettes A / B /
C : presets C, OPEN A ; couleurs A / B / C en attente.

## 1. Ce qui a ete fait

- Banque d'usine dark disco (80 presets) et regles d'effets legers : voir docs/reports/2026-11-25-mm-arp-banque-dark-disco.md
  (presets/build.mjs, factory.json, factory/*.mmarp, volumes.json, analog.ts, hypno.ts, library.ts, hood.css,
  tests presets_render.cpp, presets-check.mjs, random-analog.ts, host_test.cpp, cpu_bench.cpp).
- Navigateur de presets (choix C) : src/v4/plugin/arp/PresetBrowser.tsx, presetPanel.ts, presetBrowser.css (nouveaux),
  src/v4/voyager/presetHook.ts (nouveau), actions/presets.ts, ArpFace.tsx, bridge.ts, voyager/patch.ts.
- OPEN sans diode (choix A) : src/v4/plugin/arp/noled.css (nouveau), HoodBoard.tsx (import).
- Vivacite des couleurs (niveaux A / B / C, 'off' par defaut) : src/v4/voyager/vivid.ts (nouveau), silk.ts, pads.ts,
  egScreen.ts, EgColumn.tsx, keySelect.css, FaceModArcs.tsx, encart50.ts.
- docs/reports/2026-11-09-plugin-mm-arp.md (section v53), CLAUDE.md (etat v53).

## 2. Decisions prises et pourquoi

- PRESET ouvre la banque du plugin : jusqu'ici la face montrait les 19 presets du site, ce qui expliquait une bonne
  part du "pas fan de la facon de selectionner". Les presets du site restent au site (gate PLUGIN_ARP).
- Effets : Mika a accepte des effets "doses, pas beaucoup" ; plafonds bas, jamais de reverbe sur une basse, 32 presets
  restent secs. La recherche (Damon Jee, I Feel Love, Pablo Bozzi, EBM, new beat, italo) est lue, pas ecoutee :
  sources dans le rapport de la banque.
- OPEN : les diodes disparaissent, l'information reste par le mot allume (titres, leviers, crans) ; :has() suppose
  WebKit de macOS 12.3 ou plus.
- Vivacite fusionnee au niveau 'off' : rien ne change a l'ecran tant que Mika n'a pas choisi ; le choix = une constante.

## 3. Ce qui reste a faire / points en suspens

- Mika : choisir le niveau de couleur A, B ou C ; ecouter la banque dark disco (MP3 envoyes) et dire lesquels garder
  ou refaire ; essayer le navigateur dans Ableton (molette du trackpad, liste des fichiers du disque).
- Non verifie ici : Ableton reel (navigateur, mm_presets du disque), cpu_bench avec la nouvelle banque, aucune ecoute.
- PREV / NEXT de LIBRARY ne font pas defiler la colonne jusqu'au preset charge.

## 4. Commandes utiles ajoutees

- Essai du navigateur (scratchpad) : node funcpb.js <port> plugin/mm-arp/presets/factory.json.
- Niveau de couleur pour un essai : ?vivid=A|B|C|off dans l'URL de la face.
- Installation : curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-arp-latest/update.sh | bash
