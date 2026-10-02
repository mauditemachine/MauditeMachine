# 2026-10-02 : mobile, CLOSE sur la carte, potards plus gros, feuille sans onglets

## 1. Ce qui a été fait

- src/v4/ui/PcbClose.tsx (nouveau), index.tsx, v4.css : machine ouverte au téléphone, un bouton CLOSE orange en bas de l'écran, sur l'avant de la carte.
- src/v4/theme.ts : potards du portrait plus gros (MASTER et TEMPO x1.35, GLOBAL x1.25, VOICE x1.15), rangée VOICE remontée de 0.1.
- src/v4/ui/Panel.tsx, sections/common.tsx, v4.css : la feuille des sections perd sa rangée d'onglets (code et styles retirés).
- docs/v4/spec.md : R14-18.

## 2. Décisions prises et pourquoi

- CLOSE en HTML posé sur l'avant de la carte plutôt qu'une pièce 3D : à portée de pouce quelle que soit la hauteur de l'écran, au-dessus de la languette du Dock et de la barre de Safari.
- Potards : le pas de 0.86 entre colonnes borne la taille ; à x1.25 les collerettes gardent encore un jour entre elles.
- Feuille : Mika ne veut que la section ouverte, le menu hamburger porte déjà les autres pages.

## 3. Ce qui reste à faire / points en suspens

- À vérifier sur l'iPhone de Mika.

## 4. Commandes utiles ajoutées

- Aucune.
