# 2026-10-05 : sélecteur des machines, voyage rapide, MM-SMPL à droite du MM-ARP, CHORD du MM-ARP, MM-SMPL plus design

Mika :
« J'aimerais voir les machines en haut à droite pour les sélectionner
rapidement, et le voyage vers les machines doit être rapide. J'aimerais que
MM-SMPL soit placé à droite de MM-ARP. Je voudrais vraiment que ARP sonne
mieux, je trouve les arpèges un peu grossiers : y a pas plus de notes qu'on
peut mettre, ce sont les arpèges normaux ? MM-SMPL, je voudrais que ce soit
plus design, sûrement des knobs plus gros que d'autres ! »

## 1. Ce qui a été fait

- Ordre des machines RYTM, ARP, SMPL, DECKS :
  - state/focus.ts : MACHINES dans ce nouvel ordre ;
  - smpl/theme.ts : le MM-SMPL juste à droite du MM-ARP ; dj/theme.ts : le MM-DECKS à droite du MM-SMPL ;
  - scene/renderer.ts : cadrages, bord droit de la vue d'ensemble, machines voisines qui dépassent, visibilité (générique sur l'ordre) ;
  - ui/MachineDrawer.tsx : la liste suit ; smpl/rig.ts : sa place.
- Sélecteur des machines en haut à droite (desktop) :
  - ui/Header.tsx : ALL, RYTM, ARP, SMPL, DECKS à gauche de MENU, la machine en cours allumée ;
  - v4.css : la pastille (thème sombre et clair).
- Voyage plus rapide : scene/renderer.ts, 900 ms devenu 450 ms, une courbe qui part vite et se pose.
- CHORD du MM-ARP (sous le capot, plaque TWEAKS) :
  - voyager/params.ts : le sélecteur BASIC, TRIAD, 7TH, 9TH, 11TH (7TH au départ) ;
  - voyager/chords.ts : les accords enchaînés au plus près dans la même octave, la septième, les neuvièmes et onzièmes au sommet, les notes qui frottent évitées ;
  - voyager/seq.ts, ui/SeqLane.tsx : la suite descend une octave sous la racine et monte jusqu'à la onzième au sommet des trois octaves ;
  - voyager/arp.ts : avec DRIFT, chaque note un peu plus ou moins appuyée ;
  - voyager/theme.ts, voyager/tweaks.ts : CHORD à côté de SIDECHAIN, le titre sur une case ;
  - state/presets.ts : un preset d'avant garde BASIC ;
  - ui/KnobPanel.tsx : CHORD dans l'onglet TWEAKS du téléphone.
- MM-SMPL plus design :
  - smpl/theme.ts : trois colonnes SAMPLE, SHAPE, GRAIN sous un crochet orange ; en tête de chacune un gros potard (PITCH et POSITION en aluminium, FILTER orange comme les FILTER du mixer), gradué de 0 à 10 ; dessous trois petits potards noirs ;
  - smpl/rig.ts : un mesh par capuchon, chaque potard à sa taille, les noms placés pour ne pas être cachés ;
  - dj/silk.ts : crochets tournés vers le bas et nom en orange ; dj/controls.ts : la couleur du repère d'un potard.
- docs/v4/spec.md : R14-134 à R14-138.

## 2. Décisions prises et pourquoi

- Les arpèges « grossiers » : chaque accord était une triade jouée depuis sa propre racine, D et E sautaient d'une sixte au-dessus de F#m, trois notes par octave. Le nouvel arpège pose chaque accord dans la même octave (fa dièse 3 à fa 4) : les notes communes restent, les autres bougent d'un ton au plus, comme un claviériste. C'est ce qui donne un arpège « pro ».
- « Plus de notes » : la septième par défaut (4 notes par octave), 9TH et 11TH en ajoutent une ou deux au sommet. Mises au sommet plutôt que mélangées dans l'octave du haut : sinon l'octave du haut devient une gamme, plus un arpège.
- Les notes qui frottent sont remplacées : la neuvième mineure de C#m devient sa onzième, la onzième juste de A et E devient leur treizième. Tout reste en fa dièse mineur.
- BASIC garde l'arpège d'avant, note pour note. Un preset sauvegardé avant aujourd'hui revient en BASIC (il sonne comme quand il a été fait). L'état en cours du navigateur passe en 7TH pour que Mika entende le changement tout de suite.
- La suite EDIT accepte maintenant des notes sous la racine (jusqu'à une octave) : sans ça, copier un arpège enchaîné en EDIT l'aurait remonté d'une octave.
- MM-SMPL : la hiérarchie suit l'usage. Le potard le plus tourné de chaque page est gros, les réglages secondaires petits. FILTER en orange reprend le code couleur du mixer, l'aluminium de PITCH et POSITION celui du PLAY des platines.
- Le sélecteur en haut à droite est sur desktop seulement : le téléphone a déjà sa barre de machines en haut.

## 3. Ce qui reste à faire / points en suspens

- Mika, à l'écoute (rien n'a été écouté ici, son coupé) :
  - CHORD de BASIC à 11TH sur une progression, avec RANGE 1, 2 et 3 OCT ;
  - MODE UP/DN et RAND avec 9TH et 11TH ;
  - si un enchaînement sonne trop bas : la fenêtre des accords (fa dièse 3) est dans voyager/chords.ts (inWindow).
- MM-SMPL : dire si les gros potards doivent être encore plus gros, ou d'une autre couleur (or, crème).
- Connecteurs design (Figma, Notion, Slack, Linear, Asana, Atlassian, Intercom) : à autoriser dans les réglages des connecteurs de claude.ai si on veut s'en servir.
- Toujours en suspens : les secrets SoundCloud du worker Sonaa, le défilement de la playlist au doigt sur iPhone, l'équilibre RYTM / ARP, la voie du MM-SMPL au mixer.

## 4. Commandes utiles ajoutées

- Aucune commande npm.
- Clés retenues :
  - `mm.v4.voyager.1` gagne `chord` (0 BASIC, 0.25 TRIAD, 0.5 7TH, 0.75 9TH, 1 11TH) ;
  - `mm.v4.voyager.seq.1` : les pas vont de -7 à 24.
