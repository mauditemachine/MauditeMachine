# 2026-10-03 : le bout de l'autre machine qui dépasse (desktop)

## 1. Ce qui a été fait

- src/v4/scene/renderer.ts : sur ordinateur, quand on utilise une machine, l'autre reste au bord de l'écran (36 px qui dépassent, quelle que soit la largeur de la fenêtre), glisse avec le zoom, sort de 40 px au survol, se cache quand la vue est tournée.
- src/v4/scene/floor.ts : les ombres de contact suivent la position des machines.
- src/v4/ui/Hotspots.tsx : survol du bout (curseur main, il sort un peu), un clic zoome dessus.
- src/v4/v4.css, ui/MachineDrawer.tsx : le bouton MACHINES passe en bas à gauche (il chevauchait le bout de la 808).
- docs/v4/spec.md : R14-33.

## 2. Décisions prises et pourquoi

- La machine voisine est placée par le calcul, pas à une distance fixe : avec un écart fixe, elle dépassait de 180 px sur un écran large et de presque rien sur un 4/3.
- Elle se cache dès qu'on tourne la vue : en orbite elle passerait devant la machine utilisée.
- Téléphone inchangé : une machine à la fois, le glisser du doigt, comme demandé.
- Vérifié : bout à droite (808 utilisée) et à gauche (Voyager utilisé), survol, clic, vue tournée puis RESET VIEW, section ouverte (le bout passe sous le panneau), téléphone.

## 3. Ce qui reste à faire / points en suspens

- Aucun.

## 4. Commandes utiles ajoutées

- Aucune.
