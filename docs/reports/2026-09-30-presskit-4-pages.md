# 2026-09-30 : press kit 2027, version 4 pages en anglais

## 1. Ce qui a été fait

- `docs/presskit-2027/` : contenu en anglais seul (`content.mjs`), gabarit 4 pages (`build.mjs`), styles (`presskit.css`), trois images (`prep_images.py`). QR codes et versions FR et ES supprimés.
- `public/Presskit_Maudite_Machine_2027.pdf` (bandeau Boom) et `_generic.pdf` : 4 pages, 0,69 Mo, 36 liens cliquables (27 adresses).
- `public/Presskit_Maudite_Machine_2026-27.pdf` : copie de la version neutre (ancienne adresse gardée en ligne).
- Popup PRESS : un seul PDF, plus de sélecteur ni de détection de langue, boutons « Open PDF » (liens cliquables) et « Download » (`src/v4/ui/PresskitViewer.tsx`, `src/v4/state/presskit.ts`, `src/v4/data.ts`, `src/v4/v4.css`).
- `public/press/index.html` et le zip : le PDF unique.

## 2. Décisions prises et pourquoi

- Rien n'a été coupé. Resserré : interligne 1,28 et espacements en page 4 (le corps reste à 9 pt), fiche technique et accueil en colonnes équilibrées, plateaux partagés en ligne au lieu d'une liste.
- Mis en forme autrement : le plan de scène devient un paragraphe ; les 70+ élèves passent des gros chiffres à la fiche (quatre chiffres clés demandés) ; les pochettes du catalogue disparaissent, le catalogue reste complet en texte.
- Images : bandeau de couverture 210 x 90 mm et portrait 55 x 72 mm à 300 ppp ; bandeau du public 182 x 55 mm à 286 ppp (définition de la source).
- Trois adresses de domaine écrites avec la barre finale (mauditemachine.com/, vrstlrecords.com/, mauditemachine.bandcamp.com/) : Chrome les normalise ainsi, la comparaison avec le PDF devient exacte.
- Le double prime (12″) remplacé par le guillemet droit : SF Pro Display n'a pas ce glyphe, Chrome glissait une Helvetica.

## 3. Ce qui reste à faire / points en suspens

- Mika : relire les quatre pages, pousser (`git push`).
- Le titre et les métadonnées du site disent encore « Hypnotic Techno ».

## 4. Commandes utiles ajoutées

- `node docs/presskit-2027/build.mjs` : les deux PDF, la copie, les 4 pages en image.
