# Press kit 2027

Sources du PDF six pages (A4), orienté Boom Festival 2027, avec une version neutre.

## Régénérer

```bash
node docs/presskit-2027/build.mjs
```

Produit `public/Presskit_Maudite_Machine_2027.pdf` (bandeau « Boom Festival 2027 · Alchemy Circle ») et `public/Presskit_Maudite_Machine_2027_generic.pdf` (sans bandeau, sans la phrase Alchemy Circle de la page 3). Rendu par Google Chrome sans tête, aucune dépendance npm. Autre emplacement de Chrome : variable `CHROME`.

## Fichiers

- `presskit.html` : le gabarit. `{{BANNER}}` reçoit le bandeau de couverture ; les blocs `<!--BOOM-->...<!--/BOOM-->` disparaissent de la version neutre.
- `presskit.css` : mise en page, polices de `public/fonts/`.
- `build.mjs` : les deux variantes et leur bandeau. Pour une autre candidature, ajouter une ligne dans `VARIANTS`.
- `img/` : photos recadrées à la taille d'impression, 300 ppp, sRGB, JPEG 85.
- `qr/` : QR codes SVG. `make_qr.py` les régénère et décode chacun avant d'écrire (Python avec `segno`, `zxing-cpp`, `pillow`).

## Vérifier avant de livrer

```bash
pdfinfo public/Presskit_Maudite_Machine_2027.pdf
```

```bash
pdftotext -layout public/Presskit_Maudite_Machine_2027.pdf -
```

```bash
perl -ne 'print "$ARGV:$.: $_" if /\x{2014}|\x{2013}/; close ARGV if eof' -CSD docs/presskit-2027/*.html docs/presskit-2027/*.css docs/presskit-2027/*.mjs
```

La dernière commande doit rester muette.
