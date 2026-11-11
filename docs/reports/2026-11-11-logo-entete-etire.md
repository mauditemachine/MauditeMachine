# 2026-11-11 - Logo de l'en-tete etire de 5 px en hauteur

## 1. Ce qui a ete fait

- `src/v4/v4.css` : le logotype et le logo Maudite Machine de l'en-tete sont etires en hauteur seulement, 26 -> 31 px sur ordi, 23 -> 28 px au telephone (`transform: scaleY`).

## 2. Decisions prises et pourquoi

- Etirement par transformation : la largeur, la position et le centre vertical ne bougent pas (2.5 px de plus en haut et en bas). Un `<img>` SVG garde ses proportions si on change seulement sa hauteur, d'ou `scaleY`.
- Applique aussi au telephone, pour garder le meme dessin partout.
- Mesure dans le navigateur : memes x et largeurs qu'avant, centre a 26 px, hauteurs 31 et 28 px.

## 3. Ce qui reste a faire / points en suspens

- Mika : dire si 5 px suffisent. Les autres logos (menu, face des machines, /press) ne sont pas touches.

## 4. Commandes utiles ajoutees

- Aucune.
