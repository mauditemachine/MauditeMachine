# 2026-09-30 : MM-808 révision 5, press kit 2027 en trois langues

## 1. Ce qui a été fait

- OPEN respire : bouton du dock (luminosité 88 à 100 %, lueur de 0 à 6 px, cycle de 3,2 s) et pad 3D par une lueur CSS sur son jumeau (`src/v4/v4.css`).
- PCB réaliste : `src/v4/scene/pcb.ts` réécrit (carte chanfreinée, cuivre métallique, carte ORM, environnement procédural, paires différentielles, serpentins, plan de masse, vias, composants variés, LED allumée, ombres de contact), constantes dans `src/v4/theme.ts`.
- TONE de -100 à +100 (hauteur ±7 demi-tons et filtre, bypass réel) : `src/v4/audio/tone.ts`, `src/v4/audio/insert.ts`, `src/v4/audio/drums.ts`.
- STRETCH, étirement granulaire par AudioWorklet : `src/v4/audio/stretch.ts` ; septième encodeur (thème, `Hotspots.tsx`, `actions.ts`, `renderer.ts`).
- Rendu hors ligne de test du graphe audio (`renderOffline`, debug seulement).
- Press kit 2027 refait : 10 pages, SF Pro Display, aucune photo pleine page, EN, FR et ES, version Boom ; `docs/presskit-2027/` (content.mjs, build.mjs, presskit.css, prep_images.py, make_qr.py).
- Popup du press kit devant la machine : `src/v4/ui/PresskitViewer.tsx`, `src/v4/state/presskit.ts`, lien dans `src/v4/ui/sections/Press.tsx`.
- `public/press/index.html` et le zip pointent vers les trois langues.
- Le mot banni par Mika retiré du site (v1, v2, v3, admin) ; slogan devenu « Deep. Hypnotic. Underground. ».

## 2. Décisions prises et pourquoi

- Pad OPEN 3D : animer son émissif obligerait la boucle de rendu à tourner en continu ; la lueur passe par le jumeau HTML (opacité seule), 0 frame WebGL au repos.
- PCB : une géométrie fusionnée par matériau au lieu d'un InstancedMesh par famille (le plafond de +3 draw calls ne le permet pas). Textures générées à la première apparition du PCB : l'intro le montre éclaté, donc au chargement sauf en mouvement réduit.
- TONE : filtres jamais à 0 Hz ni à Nyquist en service (le navigateur bascule sur une identité et un ancien état sautait : clic mesuré puis corrigé).
- STRETCH : pas de repli par délai, la granulation tient (aucun clic mesuré) ; à mi-course, léger phasing sur les sons tenus, inhérent au mélange sec et étiré.
- Pas de basse : l'OH l'a remplacée le 2026-10-01, TONE transpose les cinq voix.
- Press kit : faits repris du kit 2026-27 et du brief, booking international à Diane (brief du jour). Langue du popup : celle du navigateur si FR ou ES, sinon l'anglais.
- Les anciennes adresses `_2026-27.pdf` et `_generic.pdf` reçoivent l'anglais neutre : plus du mot banni ni de Montpellier, et les liens déjà envoyés marchent.

## 3. Ce qui reste à faire / points en suspens

- Mika : écouter TONE et STRETCH (les tests ont mesuré le signal, sans écoute), relire les trois langues du press kit, pousser (`git push`).
- Le titre et les métadonnées du site disent encore « Hypnotic Techno » : à remplacer par Deep techno · Indie dance si voulu.
- La fiche technique PDF séparée (2026-27) indique encore Montpellier comme ville de départ.

## 4. Commandes utiles ajoutées

- `node docs/presskit-2027/build.mjs` : les quatre PDF et les 30 pages en image.
- `python docs/presskit-2027/prep_images.py` : recadrages et pochettes.
- `window.__v4.audio.renderOffline({ seconds, tone, stretch, single, sines, toneAt, stretchAt })` (avec `?debug=1`) : rendu hors ligne du vrai graphe pour les tests.
