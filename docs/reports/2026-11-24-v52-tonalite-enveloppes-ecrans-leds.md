# 2026-11-24 : MM-ARP v52, tonalite au choix, colonne des enveloppes, ecrans a points, LED en verre, banque techno

Retours de Mika (images 87 a 91) sur la v51 : la barre des pages dure a attraper, des presets "pas assez bons" qui
doivent "s'associer facilement a de la musique techno", "pourquoi on a pas toutes les notes ?", trop d'espace sous
FILTER EG / AMP EG, la police des ecrans "intense et trop basique", les LED rouges eteintes. Maquettes A / B / C pour
les points 2, 3 et 4 (une image par option, lettre en grand) ; choix de Mika : 2A, 3C, 4A.

## 1. Ce qui a ete fait

- Barre des pages : hell2.css (le vortex HELL ne prend plus la souris), pages2.css (.mm-nv au-dessus des pages).
- LED : face.css, hood.css, pages2.css, disto2.css, src/v4/voyager/ledLens.ts (nouveau), silk.ts, encart50.ts,
  faceExtras.tsx, accent.ts (commentaire) : eteintes en verre clair, allumees a l'accent, en direct.
- Ecrans a points (4A) : plugin/mm-arp/web/fonts/Doto-700/800/900.woff2 + Doto-OFL.txt, web/index.html (@font-face
  'MM Dots' sans le point), web/vite.config.ts (copie au build), src/v4/plugin/arp/dots.css (REVERB, DELAY, HELL, ecran
  du bas), src/v4/voyager/screen.ts et src/v4/theme.ts (ecran LCD de la face, plugin seul).
- Tonalite au choix (2A) : extra-params.json (xKey, xScale, "instance"), ExtraTable.inc, dsp/Params.cpp / .h (48
  tonalites), PluginProcessor.cpp, chords.ts, KeySelect.tsx / keySelect.css / key.ts (nouveaux), bridge.ts, extra.ts,
  pages2.tsx, encart50.ts, rig.ts, screen.ts, theme.ts, silk.ts, diagrams.ts, infos.ts, VoyTwins.tsx, build.mjs et
  presets-check.mjs (reglages d'instance), params-ref.mjs / params_test.cpp / host_test.cpp (essais), README.md.
- Colonne des enveloppes (3C) : dsp/Voyager.h / .cpp (egView), PluginProcessor.h / .cpp (publishEg), PluginEditor.h /
  .cpp (mm_tick.e), tests/modview_test.cpp, src/v4/plugin/arp/egScreen.ts et EgColumn.tsx (nouveaux), hellKnob.tsx,
  bridge.ts, voyager/infoIds.ts, voyager/theme.ts (VOY_EG_COL), ArpFace.tsx.
- Banque d'usine techno : presets/build.mjs, factory.json, factory/*.mmarp, volumes.json, tests/presets_render.cpp,
  presets-check.mjs, random-analog.ts, cpu_bench.cpp, analog.ts, hypno.ts, library.ts ; rapport detaille
  docs/reports/2026-11-24-mm-arp-banque-techno.md.
- docs/reports/2026-11-09-plugin-mm-arp.md (section v52), CLAUDE.md (etat v52).

## 2. Decisions prises et pourquoi

- La tonalite est un reglage de l'instance (comme LATENCY) : la tonalite est celle du morceau, un preset ne doit pas la
  changer ; un ancien projet s'ouvre en F# MINOR, au bit pres. Tonique entre C3 et B3 pour rester dans la hauteur
  d'avant (F# retombe sur 54).
- Banque : la regle seche de Mika (v43 / v45) est gardee ; la techno passe par le groove (sequenceur, accents, slides,
  ratchets, BPM 124-132) et le grave (sub, mono). MONO autorise pour BASS et ACID (choix technique, pas une regle de
  Mika) ; LEGATO non (la liaison dependrait d'un arrondi d'echantillon).
- Doto sans son point : le point de Doto est une croix de points qu'on lit "+" ("1/8." pointee) ; le point SF Pro, rond,
  sert de point decimal comme sur un vrai afficheur.
- 3C : remise a la valeur de depart par Alt / Cmd / Ctrl + clic (la regle de toute la face), pas de double clic.
- LED d'alerte (OLD EQ ON, CPU en surcharge, VU, erreur) laissees rouges : ce sont des alertes, pas des selections.

## 3. Ce qui reste a faire / points en suspens

- Mika : installer v52 et ecouter la banque (fichiers MP3 envoyes), essayer la tonalite (menu sous les pads), la colonne
  des enveloppes (le point pendant une note), les ecrans a points, les LED avec son accent cyan.
- A decider par Mika : une nouvelle instance reprend la tonalite de la derniere (stockage partage de la WebView) ;
  la remettre toujours en F# MINOR si besoin. LED d'alerte a l'accent aussi ou non.
- Non verifie ici : build Mac et Ableton reel (noms d'automation KEY / KEY SCALE, envoi mm_tick.e vers la WebView),
  aucune ecoute (regle).
- Toujours en attente : retours v50 (HELL MIX / MASTER VOLUME modules vite, LFO 3 et DISTO, viseur, CPU 8 emplacements)
  et v49 (LATENCY 0 dans Live, PRO ECO).

## 4. Commandes utiles ajoutees

- Aucune commande npm nouvelle. Essais de la face (scratchpad) : funckey.js (tonalite, 24 controles), egtest.js
  (colonne des enveloppes, 43 controles).
- Installation : curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-arp-latest/update.sh | bash
