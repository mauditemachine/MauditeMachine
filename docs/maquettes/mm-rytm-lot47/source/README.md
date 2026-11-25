# Maquettes du lot 47 (face avant amelioree, 1600 x 975)

1. `render.cjs` : rend la vraie face du plugin (build `npm run plugin:web`) a 1600 x 975, DSF 2 -> `face.png` (sans son, Chromium muet).
2. `mock.html` : la face rendue en fond, l'interieur du cadre des pas repeint, la rangee des pistes et les 16 pas de la v3 (image 1 de Mika) par-dessus. `#v=A` (sobre), `#v=B` (bandeau OPEN + barre MIDI), `#v=detail` (les etats), `#v=size` (avant / apres, `old.png` = la face 1400 x 853, `mA.png` = m-A.png).
3. `shot.cjs` : les captures. Les polices viennent de `plugin/mm-rytm/web/fonts` (copier dans `fonts/`).
