# Press kit 2027

Quatre pages A4, en anglais seulement, tout en SF Pro Display, fond clair, texte `#434343`. Aucun QR code : chaque lien est une vraie balise `<a href>`, que Chrome garde cliquable dans le PDF. Le site l'ouvre en popup devant la machine (bouton PRESS, document « Press kit 2027 »).

## Régénérer

```bash
node docs/presskit-2027/build.mjs
```

Produit :

- `public/Presskit_Maudite_Machine_2027.pdf` : avec le bandeau « Boom Festival 2027 · Alchemy Circle » et la phrase Alchemy Circle de la page 3 ;
- `public/Presskit_Maudite_Machine_2027_generic.pdf` : les mêmes quatre pages sans le bandeau, la version du site ;
- `public/press/kit-2027/01.webp` à `04.webp` : les pages en image pour le popup ;
- une copie de la version neutre à l'ancienne adresse déjà envoyée : `Presskit_Maudite_Machine_2026-27.pdf`.

Outils : Google Chrome (variable `CHROME` s'il est ailleurs), `pdftoppm` (poppler) et `cwebp` (webp), via Homebrew. Aucune dépendance npm.

## Fichiers

- `content.mjs` : tout le texte et toutes les adresses des liens.
- `build.mjs` : le gabarit des quatre pages (HTML généré depuis `content.mjs`), les deux variantes, le rendu PDF et les images de pages. Si le nombre de pages change, mettre à jour `PAGES` ici et `PRESSKIT.pages` dans `src/v4/data.ts`.
- `presskit.css` : la mise en page. Marges 14 mm, corps 9 pt, interligne 1.35 (1.28 en page 4), titres de section 11 pt en 700, capitales, 0.16 em, chiffres clés 34 pt. Palette : texte `#434343`, texte clair `#6E6E6E`, filets `#D8D4CC`, papier `#F6F1E7`, orange `#FF6A13` pour les chiffres clés et les filets de titre seulement.
- `prep_images.py` : les trois images (pillow), JPEG 82, 300 ppp à leur taille d'affichage au plus, depuis `public/press/`.

## Vérifier

- Quatre pages, moins de 5 Mo : `pdfinfo public/Presskit_Maudite_Machine_2027.pdf`.
- Une seule famille de polices : `pdffonts public/Presskit_Maudite_Machine_2027.pdf` (le double prime ″ n'existe pas dans SF Pro Display : écrire 12" en guillemet droit).
- Les liens : extraire les annotations du PDF (pypdf) et les comparer aux adresses de `content.mjs`.
- Aucun tiret cadratin ni demi-cadratin :

```bash
perl -CSD -ne 'print "$ARGV:$.: $_" if /\x{2014}|\x{2013}/; close ARGV if eof' docs/presskit-2027/*.mjs docs/presskit-2027/*.css docs/presskit-2027/*.md
```

La commande doit rester muette.
