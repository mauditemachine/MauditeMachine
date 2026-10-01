# 2026-10-01 : press kit révision 2 (six pages) et visionneuse /presskit

## 1. Ce qui a été fait

- Press kit six pages : `docs/presskit-2027/build.mjs` (gabarit), `presskit.css`, `prep_images.py` (recadrages sur point d'intérêt), `photos/` (originaux retenus), `img/` (images à 300 ppp) ; PDF `public/Presskit_Maudite_Machine_2027.pdf` (Boom) et `_generic.pdf`, copie `Presskit_Maudite_Machine_2026-27.pdf` gardée en ligne.
- Pages en WebP pour le site : `public/press/pages/presskit-2027-01.webp` à `-06` ; l'ancien `public/press/kit-2027/` supprimé.
- Visionneuse : `src/v4/ui/PresskitViewer.tsx` et `presskit-viewer.css` (chunk à part), `src/v4/data/presskit.ts` (généré), `src/v4/state/presskit.ts` (origine, ligne d'après fermeture), `src/v4/index.tsx` (chargement à la demande, ouverture sur /presskit, cadence de la machine), `scene/renderer.ts` (setFrameCap), `actions.ts` (PRESS rouvre), `ui/Header.tsx` et `ui/Dock.tsx` (data-press-button).
- Route : `src/App.tsx` (/presskit), `scripts/prerender-seo.mjs` (dist/presskit/index.html), `scripts/generate-sitemap.mjs`, `src/data/seo-meta.json`.
- Spec : `docs/v4/spec.md` section 29 ; README du press kit (classement des photos).

## 2. Décisions prises et pourquoi

- Route `/presskit/` statique plutôt que `/?pk=1` : elle répond 200, elle est indexable et a son propre aperçu de partage, comme /techrider.
- Images de pages à 1200 px et qualité 78 : 1400 px en qualité 80 dépassait 900 Ko, 1200 px en qualité 80 aussi (913 Ko) ; la largeur a baissé avant la qualité, comme demandé.
- PRESS rouvre la visionneuse seulement après une arrivée par /presskit (sur la section PRESS) : l'accueil normal garde son comportement.
- Mobile : la visionneuse couvre la zone de la machine (environ la moitié de l'écran), le Dock reste dessous, comme le brief le demande.
- Une photo de plus en page 2 (cabine, traînées de lumière) : sans elle la page restait à moitié vide.
- Aucune photo ne le montre au milieu du public : la couverture (salle pleine) et la cabine à l'anneau de LED sont les deux où la foule se voit.

## 3. Ce qui reste à faire / points en suspens

- Mika : pousser (commit local seulement), puis mettre `https://mauditemachine.com/presskit/` dans les brouillons de courriels.
- Mika : une vraie photo de lui au milieu du public manque au fonds.
- `booth-green` (ancienne couverture) est en réserve, non utilisée.

## 4. Commandes utiles ajoutées

- `python docs/presskit-2027/prep_images.py` (pillow) puis `node docs/presskit-2027/build.mjs` : PDF, pages WebP et `src/v4/data/presskit.ts`.
