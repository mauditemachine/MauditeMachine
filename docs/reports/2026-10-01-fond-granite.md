# 2026-10-01 : fond granite de sonaa.ca en mode sombre

## 1. Ce qui a été fait

- src/v4/v4.css : en sombre, fond #0c0b09 (celui de sonaa.ca) et le granite SVG de Sonaa (tuile de 800 px, en ligne, 12 %) sur un pseudo-élément fixe de .v4-root ; html, body, dégradé de l'en-tête et bulle du press kit passent au même fond.
- src/v4/theme.ts : jeton BACKDROP (canevas transparent en sombre, couleur de page), posé par applyAppearance.
- src/v4/scene/floor.ts : en sombre, le sol n'écrit plus que son ombre en alpha ; la page porte le granite sous et autour de la machine.
- src/v4/scene/renderer.ts : couleur de clear à alpha 0 en sombre (création et retour de contexte).
- src/v4/index.tsx : theme-color #0C0B09 en sombre.
- docs/v4/spec.md : R14-6.

## 2. Décisions prises et pourquoi

- Granite en CSS sous un canevas transparent, plutôt que peint dans la scène : c'est exactement la recette de sonaa.ca (même SVG, même tuile, même opacité), aucune requête, et il continue sous le Dock sur mobile.
- Valeurs relevées sur sonaa.ca en ligne (fond oklch(0.15 0.004 70), granite 0.12) et identiques au dépôt Sonaa : rien n'a été modifié dans Sonaa.
- Pas de halo en sombre : un éclaircissement additif n'était gardé par Chrome que là où l'ombre existe, il dessinait un rectangle clair autour de la machine. L'ombre seule suffit sur le granite.
- Le mode clair ne change pas.

## 3. Ce qui reste à faire / points en suspens

- Rien. Vérifié dans le navigateur en sombre (desktop et mobile) et en clair.

## 4. Commandes utiles ajoutées

- Aucune.
