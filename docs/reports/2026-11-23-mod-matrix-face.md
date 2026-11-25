# 2026-11-23 - MM-ARP v50 : la face de la matrice de modulation (LFO 1-4, MOD MATRIX, viseur, SQ)

Choix de Mika sur les maquettes v50 : « C et SQ ok, go ». Cette session code la FACE (WebView : `src/v4/plugin/arp`,
les deux fichiers partages `src/v4/voyager/params.ts` et `src/v4/voyager/theme.ts` sous `PLUGIN_ARP`). Le moteur C++
(`plugin/mm-arp`, `extra-params.json`, la table des cibles generee) est fait par une autre session sur le meme contrat
(scratchpad `v50/CONTRAT-v50.md`) ; sa branche (commit b3eddac1) est fusionnee ici, son `modTable.ts` et son
`extra-params.json` sont gardes tels quels. Aucune ligne de C++, de `dsp/` ni d'`extra-params.json` n'est touchee ici.

## 1. Ce qui a ete fait

- La maquette `?mq50` devient la face PAR DEFAUT, sans drapeau : `mq50.tsx` supprime, `MQ50` retire de
  `theme/base.ts` et `theme.ts` (revenus au bit pres a la v49) ; `voyager/params.ts` et `voyager/theme.ts` testent
  `PLUGIN_ARP` (la section MOD quitte la face du plugin, AMP EG descend ; le site garde sa section MOD, verifie sur le
  build de prod).
- `encart50.ts` (nouveau) : les pages LFO et SQ de l'encart d'EDIT, la bascule SYNTH | LFO | SQ | FX MOD (touches mates
  a LED de la barre C, en 3D). Les toiles ne se redessinent que si ce qu'elles montrent a change, et seulement la page
  montree ; le fond (grain, lisere) est dessine une fois.
  - LFO : LFO 1 (SPEED = `lfoRate` en SYNC, `xLfo1Hz` en FREE ; SHAPE `lfoShape` ; levier `xLfo1Sync`), LFO 2
    (`xLfo2Rate` / `xLfo2Hz`, `xLfo2Shape`, `xLfo2Sync`), LFO 3 (`xDLfoRate`, `xDLfoShape`, `xDLfoSync`), LFO 4
    (`xLfo4Rate`, `xLfo4Shape`, `xLfo4Sync`) ; potards k1 de Mika ; la vitesse du moment en petit a droite du titre.
  - MOD MATRIX 2 x 4 : #n, SOURCE (menu), AMT (k3 de Mika), DESTINATION (menu groupe par famille), viseur. Pagination
    (< 1 / 2 >) a droite du titre au-dela de huit lignes.
  - SQ : STEPS (glisser ou menu 1..16, END), RATE (le RATE de l'arpege, glisser ou menu), SWING (`xSwing`, k3),
    RANDOM, CLEAR ; NOTE (glisser vertical : la note ; clic : note / silence), ACCENT et SLIDE (clic : on / off ; glisser
    : le niveau), rangee GATE / RATCHET / CHANCE (trois touches ; clic / glisser comme la page SEQ). La tete (mm_tick.t)
    est un voile et une LED poses sur la toile, deplaces a chaque pas (la toile ne se redessine pas pour elle).
- `modRoutes.ts` (nouveau) : le modele. Les quatre LFO ; les lignes liees (contrat section 1 : `lfoAmt > 0`,
  `xLfo1Depth2`, `xLfo2Depth`, `xDLfoAmt`, `xM1..6` non neutres) puis les emplacements `xMx1..8` ; source, cible et
  quantite de chaque ligne ; une modification hors de l'ancienne liste deplace la route vers un emplacement libre (W+CUT :
  deux emplacements, WAVE et CUTOFF) et neutralise l'ancienne ; le viseur (`modAim`) ; les noms et le menu des cibles.
- `modMenu.ts`, `Encart50Overlay.tsx`, `encart50.css` (nouveaux) : en HTML / SVG au-dessus de la scene, sans rendu 3D de
  plus : le point qui parcourt chaque forme (loop30, page LFO montree seulement), les anneaux du viseur, le menu des
  fenetres de verre noir (SOURCE : 14 sources sur deux colonnes ; DESTINATION : les familles a gauche avec leur nombre,
  la famille de la cible du moment marquee d'un point a l'accent, ses cibles a droite sur trois colonnes, OFF en bas).
- `faceExtras.tsx` : quatre pages ; FX MOD = PHASER, FLANGER, CHORUS, PUMP + HELL WARP / SPIN (`xHellV2` ON) ou HELL LFO
  (ancien HELL), deux mises en page qui suivent `xHellV2` ; les anciennes pages LFO (`lfo`, `lfo2`) supprimees. Toutes
  les zones de prise des pages v50 (`ved-lfo*`, `ved-mx-*`, `ved-sq-*`), actives seulement sur leur page (et vivantes :
  une ligne vide, un pas hors de la suite ne prennent rien). `aimTap` : pendant une assignation, un clic sur un potard
  (face, encart) en fait la cible. `faceArcPlaces` accepte plusieurs places par reglage (FX MOD a deux mises en page).
- Arcs lumineux (ids de `mm_tick.m`) : potards de la face (comme avant), HELL, DETUNE, SPREAD, tous les potards continus
  des pages SYNTH et FX MOD, SPEED des LFO (FREE de LFO 1 / 2 ; LFO 3 et 4 toujours), SWING de SQ ; pages d'OPEN : tous
  les `PcbKnob` (deja la). Pas d'arc : les dessins des pages d'OPEN qui ne sont pas des potards (les points de l'EQ de
  SOUND, la cascade de REVERB, les cercles et ecrans de HELL et DELAY) ; leur potard, quand la page en a un, a son arc.
- Viseur : `hellKnob.tsx` (le clic de la face passe d'abord par `aimTap`), `pcbui.tsx` (`PcbKnob` : `data-aim`
  allume l'anneau, un clic assigne sans bouger le potard). Echap ou second clic sur le viseur annulent ; un potard a
  crans affiche NOT A TARGET et l'assignation attend ; EDIT baisse : elle s'arrete. `bridge.ts` : `mm_keys {on}` tant
  qu'une assignation attend ou qu'un menu est ouvert (Echap arrive a la face meme si l'hote avait le clavier).
- `extra.ts` : champ `nsteps` (`xMx{n}Dst` : valeur = index / 1023, la division exacte, jamais au millieme ; une valeur
  de l'hote hors cran est ramenee au cran) ; textes de `xMx{n}Dst` (le nom de la cible), `xMx{n}Amt` (+/- %), `xLfo1Hz`,
  `xLfo2Hz` (Hz), `xLfo4Rate` (division en SYNC, Hz en FREE) ; sections `lfo` et `mod`.
- `seqEdit.ts` (nouveau) : ce que partagent la page SEQ et SQ (l'accord lu et son choix CHORD, la note des potards,
  l'ecriture des notes, RANDOM doux, LEVELS, le dernier niveau dessine) ; `pages2.tsx` et `HoodBoard.tsx` s'en servent.
- La matrice `xM1..6` quitte la page SEQ (`HoodBoard.tsx Matrix` supprimee) : ses routes sont des lignes liees.
- Presets : rien de special a faire, `applyExtra` applique les `xMx` comme les autres reglages (un preset sans eux les
  remet a OFF), sauf QUALITY / ENGINE / LATENCY comme avant. RANDOM ne touche pas aux `xMx` (verifie).
- Rapport et captures : `docs/reports/2026-11-23-mod-matrix-face.md` ; captures DPR 2 dans le scratchpad `v50final/`.

## 2. Decisions prises et pourquoi

- La premiere page de l'encart a l'ouverture d'EDIT : LFO (avant : SYNTH). C'est la nouveaute validee, Mika la voit
  tout de suite ; la page reste gardee entre deux ouvertures.
- Lignes de la matrice : les lignes liees, puis les emplacements qui servent, puis assez d'emplacements vides pour
  remplir huit places (un au moins). Une instance neuve montre donc les huit emplacements, comme la maquette ; un preset
  ou RANDOM qui pose une ancienne route ne fait pas passer a deux pages pour un emplacement vide. Pagination seulement
  au-dela de huit routes. Une ligne liee ramenee au neutre pendant un glisser d'AMT reste jusqu'au relachement (le
  potard ne saute pas sur la ligne suivante).
- Viseur sur un emplacement vide : la source devient LFO 1 et la quantite +50 % si elle etait a 0 (l'assignation
  s'entend tout de suite, et la fenetre SOURCE montre LFO 1 pendant l'attente, comme la maquette VISEUR). Une ligne liee
  garde sa source et sa quantite.
- Ligne liee et potard equivalent : CUTOFF de la face pour une route d'avant vers CUTOFF reste dans l'ancien reglage
  (meme chemin par voix, au bit pres) ; idem RES, ENV AMT, FM, NOISE, SUB, RING, FOLD, COMB, STACK, LFO 1/2 DEPTH. Le menu
  ne montre pas deux fois ces cibles (la destination synthe 1..19 qui a son potard est cachee au profit du potard).
- Menu SOURCE d'une ligne liee : les 14 sources ; un choix hors de son ancienne liste deplace la route. Le glisser sur
  SOURCE ne fait defiler que les emplacements (jamais un deplacement par accident) ; DESTINATION : menu seulement.
- SQ : RANDOM = hasard doux sur ce que la page montre (notes, ACCENT, SLIDE, la rangee de valeurs) ; CLEAR = notes aux
  potards et toutes les pistes au neutre. NOTE : un degre tous les 5 px environ (deux fois moins sensible que la page
  SEQ). END n'est pas une poignee dans SQ : la longueur passe par STEPS (glisser ou menu).
- Les cadres LFO 1 + et LFO 2 de la page SEQ restent (le contrat ne retire que la matrice) : ils reglent les anciennes
  routes, qui apparaissent comme lignes liees. A trancher par Mika (voir 3).
- La vitesse de chaque LFO est ecrite en petit a droite de son titre (1 BAR, 1/4, 0.24 Hz) : la maquette C n'en avait pas,
  sans elle FREE / SYNC ne se voit pas a l'ecran.

## 3. Ce qui reste a faire / points en suspens

- A verifier sur le Mac (Ableton) : le clic des fenetres et du viseur (moins de 250 ms, comme les touches de la
  bascule), Echap pendant une assignation (mm_keys), le menu DESTINATION a la taille de la fenetre du plugin, le point
  des LFO cale sur la mesure d'Ableton (hostClock), la sensibilite de NOTE dans SQ, l'arc des cibles 32 + k (le C++ doit
  envoyer leurs ids dans mm_tick.m), le CPU de la page LFO (30 images SVG par seconde, rien sinon).
- Page SEQ : sans la matrice, une bande vide sous ARP / LFO 1 + / LFO 2 ; Mika peut vouloir retirer aussi ces cadres
  (tous les LFO dans EDIT) ou y mettre autre chose.
- Publication : fusion avec la branche moteur, workflow `plugin-arp.yml`, journal `2026-11-09-plugin-mm-arp.md` et etat
  du CLAUDE.md (v50) : par la session qui publie.

## 4. Commandes utiles ajoutees

- Aucune commande npm nouvelle (`npm run plugin:arp:web` construit la face).
- Essais (scratchpad `v50final/`, Chromium MUET, aucune lecture audio) : `node func.js 8750` (menus, AMT, viseur,
  lignes liees, deplacements, FREE / SYNC, point anime, SQ et page SEQ synchronisees, viseur sur OPEN : 32 controles),
  `node func2.js 8750` (valeurs de l'hote, presets, RANDOM, HELL v2 / ancien HELL, viseur depuis FX MOD : 11
  controles), `node cpu.js` (images par seconde au repos), `node cap50.js 8750` (captures DPR 2), `node site.js 8751
  <png>` (la face du site sur le build de prod).
- Sonde `?probe` : `__mmProbe.e50` (`rows()`, `page(n)`, `aim()`, `codeOf(id)`, `redraw()`), `msgLog()`, `text(id)`.
