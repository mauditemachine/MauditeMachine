# 2026-10-01 : mise à jour du contenu, press kit révision 3

## 1. Ce qui a été fait

- Contenu (Partie 0) : `src/translations.ts` (EN, FR, ES), `src/data/seo-meta.json`, `index.html` (meta, JSON-LD), `public/manifest.json`, `src/v2/components/EPK.tsx`, `src/v2/data/techrider.ts`, `src/v2/pages/TechRiderPage.tsx`, `src/v4/data.ts` (PRESS, STUDIO), `src/v3/ui/Info.tsx`, archive v1 (`src/components/Presskit.tsx`, `MainApp.tsx`, `Admin.tsx`, `AdminEvents.tsx`, `src/pages/TechRiderPage.tsx`), commentaires sans le lien mort.
- Dates : `public/past-events.json` (7 dates retirées : Portail Festival, Weekend With Dimensions, St-Jean Basstiste).
- Fichier : `public/medias/images/Merch_Hoodie F.webp` renommé `Merch_Hoodie_F.webp`.
- Press kit : `docs/presskit-2027/content.mjs`, `build.mjs` (plateaux en page 4, plan de scène avec Roto-Control), `presskit.css`, `prep_images.py` ; PDF, tech rider et pages WebP régénérés.
- Spec : `docs/v4/spec.md` section 31.

## 2. Décisions prises et pourquoi

- Base gardée « Canada · France · Espagne » : Mika l'a confirmé (le brief remettait Montpellier).
- La phrase de disponibilité du brief est appliquée telle quelle (« available ... and still playing Canada »).
- « carl craig » reste dans le programme d'une date passée de `past-events.json` : c'est le programme réel de la soirée, pas une liste de plateaux.
- « Teaches Ableton Live production » reste : c'est l'enseignement, pas le matériel.
- Les parties 1 et 2 (six pages, visionneuse /presskit) étaient déjà faites (révision 2) : seul le contenu change, plus les plateaux en page 4.

## 3. Ce qui reste à faire / points en suspens

- Mika : pousser (commit local seulement).
- Si Sanity sert aussi les dates passées, y retirer les mêmes événements.
- `store.json` ne référençait pas le fichier hoodie renommé : rien à corriger.

## 4. Commandes utiles ajoutées

- Aucune nouvelle. Contrôle : `grep -ri "hypnotic techno\|carl craig\|portail\|hypeddit\|apc40" src public`.
