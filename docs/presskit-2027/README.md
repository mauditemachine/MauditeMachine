# Press kit 2027

Dix pages A4 en anglais, français et espagnol, tout en SF Pro Display, photos encadrées (aucune pleine page). Le site l'ouvre en popup devant la machine (bouton PRESS, document « Press kit 2027 »).

## Régénérer

```bash
node docs/presskit-2027/build.mjs
```

Produit :

- `public/Presskit_Maudite_Machine_2027_EN.pdf`, `_FR.pdf`, `_ES.pdf` : les trois langues ;
- `public/Presskit_Maudite_Machine_2027.pdf` : l'anglais avec le bandeau « Boom Festival 2027 · Alchemy Circle » et la phrase Alchemy Circle de la page 4 ;
- `public/press/kit-2027/{en,fr,es}/01.webp` à `10.webp` : les pages en image pour le popup ;
- deux copies de l'anglais aux anciennes adresses déjà envoyées : `Presskit_Maudite_Machine_2027_generic.pdf` et `Presskit_Maudite_Machine_2026-27.pdf`.

Outils : Google Chrome (variable `CHROME` s'il est ailleurs), `pdftoppm` (poppler) et `cwebp` (webp), via Homebrew. Aucune dépendance npm.

## Fichiers

- `content.mjs` : tout le texte, par langue (`T.en`, `T.fr`, `T.es`), et ce qui ne se traduit pas (`SHARED` : noms, liens, catalogue, liste d'écoute).
- `build.mjs` : le gabarit des dix pages (HTML généré depuis `content.mjs`), les variantes, le rendu PDF et les images de pages. Si le nombre de pages change, mettre à jour `PAGES` ici et `PRESSKIT.pages` dans `src/v4/data.ts`.
- `presskit.css` : la mise en page, polices de `public/fonts/`.
- `prep_images.py` : recadrages des photos et pochettes (pillow), 300 ppp, sRGB, JPEG 85, depuis `public/press/`.
- `make_qr.py` : les QR codes SVG, chacun décodé avant d'être écrit (segno, zxing-cpp, pillow).

## Règles du contenu

- Aucun fait inventé : sources, le press kit 2026-27, le brief Boom Festival 2027, les consignes de Mika.
- Genre : deep techno et indie dance. Base : Canada, France, Espagne. Mots bannis : raw, hypnotic.
- Aucun tiret cadratin ni demi-cadratin :

```bash
perl -CSD -ne 'print "$ARGV:$.: $_" if /\x{2014}|\x{2013}/; close ARGV if eof' docs/presskit-2027/*.mjs docs/presskit-2027/*.css docs/presskit-2027/*.md
```

La commande doit rester muette.
