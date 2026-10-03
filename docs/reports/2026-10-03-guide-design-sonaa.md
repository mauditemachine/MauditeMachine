# 2026-10-03 : guide du design des machines pour Sonaa

## 1. Ce qui a été fait

- docs/design/MACHINES-DESIGN-SYSTEM.md (nouveau) : le langage des deux machines, de quoi le reprendre sur sonaa.ca pour des platines façon CDJ et une table façon DJM-1000. Il couvre l'idée, les couleurs des deux thèmes et leurs gains, la typographie, les matières, la lumière et le rendu, la caméra et le mouvement, les gestes et l'accessibilité, le son, la traduction en platine et en table, et les fichiers à lire.

## 2. Décisions prises et pourquoi

- Le guide renvoie au code vivant (theme.ts, renderer.ts...) plutôt que de recopier des blocs : les valeurs ne divergent pas.
- Sonaa a ses propres jetons (granite, accent vert #00FF62, Inter) : le guide traduit les couleurs par rôle et laisse le choix final aux règles de Sonaa (DESIGN.md, ADR).
- Point technique signalé d'emblée : des platines ne peuvent pas traiter le son d'une iframe SoundCloud ou YouTube ; il faut des fichiers servis par Sonaa (ou avec CORS).
- Le dépôt Sonaa a seulement été lu (package.json, DESIGN.md, ADR-096, tokens.css), jamais modifié.

## 3. Ce qui reste à faire / points en suspens

- Mika : coller le prompt fourni dans la session Claude Code de Sonaa.

## 4. Commandes utiles ajoutées

- Aucune.
