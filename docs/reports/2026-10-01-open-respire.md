# 2026-10-01 : le pad OPEN respire

## 1. Ce qui a été fait

- src/v4/theme.ts : jeton OPEN_BREATHE (3,2 s, lumière 45 à 100 %, teinte 50 à 100 %, 20 images par seconde).
- src/v4/scene/pads.ts : breathe(), stopBreath(), breathing ; la lumière, le halo et la teinte d'OPEN suivent la respiration.
- src/v4/scene/renderer.ts : animateur stepBreathe, une image toutes les 50 ms sans passe d'ombre.
- src/v4/v4.css : la lueur rectangulaire posée sur le jumeau d'OPEN est retirée.
- docs/v4/spec.md : R14-8.

## 2. Décisions prises et pourquoi

- Le carré qui clignotait était une lueur CSS sur le jumeau HTML, un rectangle d'écran par-dessus le pad : remplacé par la lumière du pad lui-même, dans la 3D.
- Coût : la boucle ne dort plus machine fermée, mais elle ne rend que 20 images par seconde, sans ombre. Machine ouverte, mouvement réduit ou palier mobile : la respiration s'arrête et la boucle se repose.
- Mobile : le Dock a déjà son bouton OPEN qui respire, le pad 3D ne respire pas (batterie).
- Machine claire : l'orange plein sature, la lumière seule ne se voyait pas ; la teinte respire aussi.

## 3. Ce qui reste à faire / points en suspens

- Rien. Mesuré dans le navigateur en clair et en sombre, arrêt vérifié machine ouverte.

## 4. Commandes utiles ajoutées

- Aucune.
