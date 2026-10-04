# MM-DECKS : platines en plus, jog plus petit et SYNC (2026-10-04)

Mika : « le jog n'est pas super utile, trouve-lui une utilité, diminue sa
taille et donc réduis le DECK en largeur ; j'aimerais pouvoir en rajouter à
droite, ce qui crée directement une piste dans MIXER ».

## Ce qui change

- La platine passe de 9 à 7 de large ; le jog de 2.55 à 1.7 de rayon.
- Le centre du jog devient la touche SYNC : le tempo se cale sur la platine
  qu'on entend le plus, sinon sur le MM-RYTM et le MM-ARP s'ils tournent,
  au double ou à la moitié si c'est plus près ; la plage du pitch s'ouvre à
  16 % au besoin. L'écran rond affiche SYNC, pâle (rien à suivre), en os
  (calable) ou sur un disque orange (calé). Clavier : D pour A, J pour B.
  La bague garde le nudge en lecture et le scrub en pause.
- Un bloc ADD DECK à droite ajoute DECK C, puis DECK D (quatre au plus) ;
  chacune a sa voie au MIXER (5, puis 6), qui s'élargit d'une colonne. C et
  D passent à côté du crossfader (« C D THRU »). REMOVE, dans l'en-tête de la
  dernière platine ajoutée, la retire : elle s'arrête et se vide. Le nombre
  est retenu (mm.v4.dj.decks).
- Le moteur a toujours ses six voies et quatre lecteurs : ajouter ou retirer
  une platine ne touche pas au son en cours. Les places (dj/theme.ts) se
  recalculent, les listes (dj/layout.ts) se refont, et index.tsx reconstruit
  le Stage, comme au changement Dark / Light.
- Playlist : une touche par platine posée sur chaque ligne (A à D).
- Téléphone : les blocs se suivent A, MIXER, B, C, D, ADD DECK ; après un
  ajout, la nouvelle platine est cadrée.

## Vérifié (son coupé, master à 0)

- Dix cycles ajout et retrait : 36 géométries et 27 textures à chaque fois,
  un seul canvas, aucun avertissement WebGL.
- Un morceau en lecture sur A pendant une reconstruction : 1.5 s jouée en
  1.5 s, la lecture continue.
- SYNC : un morceau à 128 BPM sur B se cale à 123.0 sur A (pitch -3.9 %).
- EDIT ouvert sur le MM-ARP pendant un ajout : focus et éditeur gardés,
  marge du cadrage présente, PRESETS visible.
- Vue d'ensemble à quatre platines : les trois machines tiennent.
- Téléphone : tape réel sur ADD DECK puis sur REMOVE ; les touches A B C
  tiennent dans la playlist sans défilement horizontal.
- 87 jumeaux HTML posés et dimensionnés (SYNC, ADD DECK, REMOVE compris).
- tsc (dj sans erreur nouvelle) et vite build.
