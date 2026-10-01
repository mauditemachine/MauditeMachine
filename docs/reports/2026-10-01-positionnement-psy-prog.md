# 2026-10-01 : positionnement « Indie dance and psy prog »

## 1. Ce qui a été fait

- Positionnement remplacé partout : src/translations.ts (EN, FR, ES : bios, genres, radar, catalogue, titres SEO), src/data/seo-meta.json, index.html (titre, description, mots-clés, JSON-LD, Open Graph, Twitter), public/manifest.json, v2 (Hero, Intro, EPK, titre), v3 (Info), v1 (Admin, AdminEvents), titre de la page v4 (theme.ts), commentaire du motif (pattern.ts).
- Press kit : docs/presskit-2027/content.mjs (positionnement, bio, fiche Genre, The sound), PDF régénérés (Boom, generic, copie 2026-27, tech rider), pages WebP 1 à 3 de la visionneuse.
- docs/v4/spec.md : R14-11.

## 2. Décisions prises et pourquoi

- FR « Indie dance et psy prog », ES « Indie dance y psy prog », comme demandé ; en titre, « Indie Dance · Psy Prog ».
- Listes de genres (JSON-LD, mots-clés) : plus aucune étiquette techno, « Techno » seul compris ; les mots-clés « DJ techno ... » deviennent « DJ indie dance ... » et « DJ psy prog ... ».
- Le mot techno reste dans les phrases descriptives (Techno Parade, « boucle techno a 130 BPM »).
- Commit local seulement, rien poussé (consigne).

## 3. Ce qui reste à faire / points en suspens

- Pousser quand Mika valide. Le contenu Sanity (s'il en reste) n'a pas été vérifié.

## 4. Commandes utiles ajoutées

- Aucune. Contrôle : `grep -ri "deep techno\|hypnotic techno\|hard techno" src public` (vide).
