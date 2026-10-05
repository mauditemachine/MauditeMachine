# 2026-10-05 - MM-SMPL : OPEN, et INFO à l'intérieur

Demande de Mika : « Le bouton Info doit être à l'intérieur OPEN de la machine SMPL ».
Le MM-SMPL n'avait pas de capot : il en a un maintenant, et INFO est dedans.

## Ce qui a été fait

- `src/v4/dj/body.ts` : `wedge()` accepte une descente du dessus (`drop`) et une teinte pour ce dessus ; nouveau `lidSlab()`, la dalle du capot, aux arêtes arrondies comme le coin.
- `src/v4/smpl/theme.ts` : les cotes du capot (`SMPL_LID`), de l'ouverture (`SMPL_EXPLODE`), de la carte (`SMPL_PCB_Y`) et de la plaque (`SMPL_PLATE`, `SMPL_PLATE_TITLE`), les places des touches OPEN, INFO et CLOSE, le cadrage ouvert (`SMPL_OPEN_FRAME`).
- `src/v4/smpl/rig.ts` : le dessus devient un capot. La dalle, le cadre de l'écran, les vis et toutes les commandes sont dans `top` ; le bac (`inner`) porte la carte du MM-RYTM (« MM-SMPL R1.0 ») et une plaque MM-SMPL. L'ouverture est celle du MM-ARP (`scene/explode.ts`), les volumes pleins sont séparés entre le bac et le capot.
- `src/v4/scene/tweakplate.ts` : le titre d'une plaque peut porter autre chose que TWEAKS ; une plaque sans réglage est acceptée.
- `src/v4/state/explode.ts` : `smplExplode`.
- `src/v4/actions.ts` : `hoodOf('smpl')`, `openToggle` prend le MM-SMPL (le MM-DECKS reste sans capot).
- `src/v4/scene/renderer.ts` : le cadrage de l'intérieur (téléphone compris), l'animateur du capot, la vue qui repart de la vue par défaut à OPEN et à CLOSE.
- `src/v4/ui/SmplInfo.tsx` : la touche du bandeau devient OPEN (orange, comme le pad OPEN du MM-RYTM) ; machine ouverte, INFO sur la plaque.
- `src/v4/ui/HoodClose.tsx`, `PcbClose.tsx`, `Header.tsx`, `MachineDrawer.tsx`, `index.tsx`, `hooks/useKeys.ts` : CLOSE sur la plaque (desktop) ou en bas de l'écran (téléphone), le logo referme, les vignettes suivent, la touche O ouvre.
- `src/v4/smpl/midi.ts` : la cible `smpl:open` ; `src/v4/smpl/keys.ts` : O dans la légende du clavier.
- `src/v4/v4.css` : le style de la touche OPEN.
- `src/v4/theme.ts` : les noms des pads TOM, CH et OH donnent leurs touches à huit voix (X, D, F).
- `scripts/smpl-manual/*` et `public/docs/MM-SMPL-mode-emploi.pdf` : la touche 9 du tour de la machine est OPEN (page 3), O dans le tableau du clavier, « où retrouver ce mode d'emploi » dans le dépannage avec une capture de la machine ouverte (page 14) ; les captures attendent que les touches du DOM soient posées.
- `docs/midi/*` régénérés (une cible de plus).
- `docs/v4/spec.md` : R14-185, R14-186.

## Décisions prises et pourquoi

- **Un vrai capot plutôt qu'une fenêtre** : le OPEN des autres machines soulève le dessus et montre la carte. Le MM-SMPL fait pareil, pour que INFO soit vraiment « à l'intérieur ». Le coin descend de l'épaisseur du capot : fermé, le bloc a la même allure qu'avant, avec un joint le long des côtés.
- **La carte du MM-RYTM, sans les puces** : même taille que celle du bac, même famille que le MM-ARP. Elle est dégagée sous la plaque.
- **La plaque en bas de la carte (desktop)** : au centre, elle cachait la sérigraphie MAUDITE MACHINE.
- **OPEN à la place d'INFO** : le bandeau du haut avait déjà sa touche ; OPEN prend l'orange du pad OPEN du MM-RYTM, encre sombre (6.4:1). Au téléphone, elle est plus grande (le doigt).
- **Le cadrage de l'intérieur aussi au téléphone** : contrairement au MM-RYTM et au MM-ARP, rien à toucher sur le capot levé ; la plaque remplit la largeur, CLOSE reste en bas.
- **Le Roto ne change pas** : OPEN s'assigne au MIDI, mais les setups du Roto restent tels quels (pas de réimport).
- **Correction en passant** : les noms d'accessibilité des pads TOM, CH et OH annonçaient encore les touches de la disposition à dix voix.
- **Vérifié (son coupé)** : OPEN depuis la touche, la touche O et la cible MIDI ; CLOSE sur la plaque (desktop) et en bas de l'écran (téléphone), Échap ; vue de face, de trois-quarts, en Light ; le OPEN du MM-RYTM reste le sien ; smoke test desktop et téléphone sans erreur, tsc à 15 (comme avant), build OK.

## Ce qui reste à faire / points en suspens

- Mika : ouvrir le MM-SMPL (OPEN ou O), vérifier INFO (le PDF s'ouvre dans un onglet) et CLOSE, au desktop et au téléphone.
- Toujours en attente : le compteur de visiteurs du MENU (Supabase, quand Mika dit go).
- Les connecteurs Asana, Atlassian, Figma, Intercom, Linear, Notion et Slack demandent une autorisation dans les réglages des connecteurs de claude.ai.

## Commandes utiles ajoutées

- Aucune nouvelle. Le PDF se refait avec `npm run manual:smpl` (ou `SITE_URL=http://localhost:5173 PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... node scripts/smpl-manual/make.mjs` sur un serveur déjà lancé) ; la référence MIDI avec `npm run docs:midi`.
