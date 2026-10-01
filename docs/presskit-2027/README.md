# Press kit 2027

Six pages A4 (révision 2, 2026-10-01), en anglais seulement, tout en SF Pro Display, fond clair, texte `#434343`. Une photo au moins par page, une grande sur les pages 1, 3 et 5. Aucun QR code : chaque lien est une vraie balise `<a href>`, que Chrome garde cliquable dans le PDF. Le site l'ouvre dans sa visionneuse devant la machine : `https://mauditemachine.com/presskit/` (page statique générée au build, 200), ou le bouton PRESS.

Pages : 1 couverture (la salle pleine), 2 Background (portrait couleur, bio, chiffres clés), 3 The sound (la cabine en grand, les deux formats), 4 Selected shows (la foule vue de la cabine), 5 Listen (mix, titres, pochettes), 6 Technical and contact (portrait noir et blanc en vignette).

## Régénérer

```bash
node docs/presskit-2027/build.mjs
```

Produit :

- `public/Presskit_Maudite_Machine_2027.pdf` : avec le bandeau « Boom Festival 2027 · Alchemy Circle » et la phrase Alchemy Circle de la page 3 ;
- `public/Presskit_Maudite_Machine_2027_generic.pdf` : les mêmes quatre pages sans le bandeau, la version du site ;
- `public/press/pages/presskit-2027-01.webp` à `-06.webp` : les pages en image pour la visionneuse (WebP qualité 80 à 1400 px ; au-delà de 900 Ko pour les six, 1200 px, puis la qualité par pas de 2) ;
- `src/v4/data/presskit.ts` (généré) : les pages, leur section (alt) et les liens du PDF pour la visionneuse, vérifiés identiques à ceux du PDF ;
- une copie de la version neutre à l'ancienne adresse déjà envoyée : `Presskit_Maudite_Machine_2026-27.pdf` ;
- la fiche technique, 2 pages, mêmes données et même style (plan de scène dessiné) : `public/Tech_Rider_Maudite_Machine_2026-27.pdf` (adresse gardée).

Outils : Google Chrome (variable `CHROME` s'il est ailleurs), `pdftoppm` (poppler) et `cwebp` (webp), via Homebrew. Aucune dépendance npm.

## Fichiers

- `content.mjs` : tout le texte et toutes les adresses des liens.
- `build.mjs` : le gabarit des quatre pages (HTML généré depuis `content.mjs`), les deux variantes, le rendu PDF et les images de pages. Si le nombre de pages change, mettre à jour `PAGES` ici et `PRESSKIT.pages` dans `src/v4/data.ts`.
- `presskit.css` : la mise en page. Marges 14 mm, corps 9 pt, interligne 1.35 (1.28 en page 4), titres de section 11 pt en 700, capitales, 0.16 em, chiffres clés 34 pt. Palette : texte `#434343`, texte clair `#6E6E6E`, filets `#D8D4CC`, papier `#F6F1E7`, orange `#FF6A13` pour les chiffres clés et les filets de titre seulement.
- `prep_images.py` : les photos et les pochettes (pillow), JPEG 82, 300 ppp à leur taille d'affichage au plus, recadrées sur un point d'intérêt, sans filtre. Sources : `photos/` (originaux retenus, réduits à 3000 px, du dossier Drive « Maudite Machine PressKit & Techrider / Photos » et de `public/press/`) et `public/press/covers/`. À lancer avant `build.mjs` quand une photo change.

## Vérifier

- Six pages, moins de 8 Mo : `pdfinfo public/Presskit_Maudite_Machine_2027.pdf`.
- Une seule famille de polices : `pdffonts public/Presskit_Maudite_Machine_2027.pdf` (le double prime ″ n'existe pas dans SF Pro Display : écrire 12" en guillemet droit).
- Les liens : extraire les annotations du PDF (pypdf) et les comparer aux adresses de `content.mjs`.
- Aucun tiret cadratin ni demi-cadratin :

```bash
perl -CSD -ne 'print "$ARGV:$.: $_" if /\x{2014}|\x{2013}/; close ARGV if eof' docs/presskit-2027/*.mjs docs/presskit-2027/*.css docs/presskit-2027/*.md
```

La commande doit rester muette.

## Photos : classement (2026-10-01)

1. Public et lumière de scène : `stage-crowd` (la salle pleine face à la scène, couverture), `booth-crowd-ring` (la foule vue de la cabine à travers l'anneau de LED, page 4), `live-ledwall` (live devant un mur de LED, têtes au premier plan ; 776 px seulement, donc en petit, page 3).
2. Cabine, lumière de club : `booth-blue-fist` (page 3), `booth-blue-beam` (page 5), `booth-orange` (page 3), `booth-trails` (page 2), `booth-flare` et `booth-daylight` (page 4), `booth-green` (ancienne couverture, en réserve).
3. Portraits : `portrait-pink` (Background), `portrait-bw` (vignette de la page 6).
4. Écartées : Maudite Machine 9 (sous-exposée, visage perdu), 6 (rouge, visage caché), 1 (1050 px, filigrane), 2 (doublon de press-03), les versions noir et blanc des photos couleur (doublons), les affiches et l'og-image (pas des photos).

Aucune photo ne le montre au milieu du public : les deux où la foule se voit sont la couverture (depuis la salle) et la cabine à l'anneau de LED.
