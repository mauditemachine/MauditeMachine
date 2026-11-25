# 2026-11-23 : MM-ARP v50, LFO 1 a 4, MOD MATRIX au viseur et SQ dans l'encart EDIT

Demande de Mika (images 83 a 86) : tous les LFO dans la partie EDIT du bas, rangés ; des LFO assignables partout dans
le plugin avec une cible (viseur) ; une page SQ, le sequenceur en plus simple et plus petit. Maquettes A / B / C + SQ +
VISEUR envoyees ; choix : "C et SQ ok, go".

## 1. Ce qui a ete fait

- Contrat commun moteur / face (31 parametres en fin de liste, encodage des cibles, semantique, arcs) puis deux
  chantiers en parallele, fusionnes sans conflit sur claude/nifty-bohr-7ixmpf.
- plugin/mm-arp/extra-params.json, tests/extra-gen.mjs : 264 -> 295 reglages (xLfo1Sync / Hz, xLfo2Sync / Hz,
  xLfo4Rate / Shape / Sync, xMx1..8 Src / Dst / Amt), champ "nsteps", table des cibles generee
  (src/v4/plugin/arp/modTable.ts, plugin/mm-arp/src/ModTable.inc, 205 cibles).
- plugin/mm-arp/dsp et src : LFO 1 / 2 FREE, LFO 3 (DISTO) et LFO 4 globaux, matrice xMx (chemin par voix pour les
  cibles synthe, chemin generique par tranches de 32 echantillons pour les cibles 32 + k), arcs dans mm_tick.m.
- plugin/mm-arp/tests/mod_test.cpp (nouveau, dans le workflow), host_test, cpu_bench ; banque d'usine regeneree (seche,
  emplacements a OFF).
- src/v4/plugin/arp : encart50.ts / .css, Encart50Overlay.tsx, modRoutes.ts, modMenu.ts, seqEdit.ts (nouveaux), extra.ts,
  bridge.ts, pcbui, page SEQ sans matrice ; voyager/params.ts et voyager/theme.ts : section MOD hors de la face du
  plugin seulement (le site ne change pas).
- src/v4/voyager/params.ts (a la fusion) : lecture locale de PLUGIN_ARP sans importer theme/base, sinon
  presets/build.mjs et fx-ref.mjs cassent sous Node.
- docs/reports/2026-11-09-plugin-mm-arp.md (section v50), CLAUDE.md (etat v50), rapports detailles
  2026-11-23-mod-matrix-dsp.md et 2026-11-23-mod-matrix-face.md.

## 2. Decisions prises et pourquoi

- Aucune conversion des anciennes routes (LFO 1 TARGET / DEPTH, LFO 1 DEST 2, LFO 2, DISTO LFO, xM1..6) : elles
  restent actives et la face les montre comme "lignes liees". Garantit le son au bit pres des anciens projets et de la
  banque (800 / 800 empreintes identiques a v49, voyager_compare 85/85).
- Cibles en un seul reglage a 1024 crans (32 + indice hote) : une liste figee, extensible sans casser les projets.
- Exclus des cibles : crans, leviers, reglages caches OLD, SIDECHAIN, taille / ton / pre-delai de la reverbe (calcul
  hors du thread audio, 6 a 40 ms).
- KEY bipolaire (le moteur la donne autour du do central) alors que le contrat la disait unipolaire.
- L'encart s'ouvre sur LFO (la nouveaute) ; la vitesse de chaque LFO est ecrite a cote de son titre (ecart a la
  maquette C, sinon FREE / SYNC ne se voit pas).
- Viseur sur un emplacement vide : source LFO 1 et quantite +50 % pour que l'assignation s'entende tout de suite.

## 3. Ce qui reste a faire / points en suspens

- Mika : installer v50 et ecouter HELL MIX et MASTER VOLUME modules vite, le LFO 3 quand la DISTO s'engage ; verifier
  le clic des fenetres de la matrice, Echap pendant une assignation, la taille du menu DESTINATION, le point des LFO
  cale sur la mesure, la sensibilite de NOTE dans SQ, le CPU d'Ableton avec 8 emplacements.
- Page SEQ : une bande vide reste sous ARP / LFO 1 + / LFO 2 ; a retirer si Mika veut tous les LFO seulement dans EDIT.
- Toujours en attente de v49 : LATENCY a 0 dans Live, CPU d'Ableton sur DELAY / HELL, PRO ECO a l'ecoute.

## 4. Commandes utiles ajoutees

- node plugin/mm-arp/tests/extra-gen.mjs [--check] : genere aussi modTable.ts et ModTable.inc.
- mod_test (plugin/mm-arp/tests/mod_test.cpp) : lance par plugin-arp.yml avec la suite DSP.
- Installation : curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-arp-latest/update.sh | bash
