# 2026-10-03 : MM-VOYAGER activé pour tout le monde

## 1. Ce qui a été fait

- src/v4/state/focus.ts : VOYAGER vrai par défaut ; ?voyager=0 retire la seconde machine pour l'onglet, ?voyager=1 la remet.
- docs/v4/spec.md : R14-32.

## 2. Décisions prises et pourquoi

- Demande de Mika après son test. Le paramètre ?voyager=0 reste comme interrupteur de secours (revue, comparaison avec la 808 seule).
- Vérifié en local sans paramètre : deux machines, vue d'ensemble, volet des machines présent.

## 3. Ce qui reste à faire / points en suspens

- Aucun côté code. Mika : vérifier sur son téléphone que l'adresse simple (mauditemachine.com) montre les deux machines.

## 4. Commandes utiles ajoutées

- `?voyager=0` : la 808 seule (pour l'onglet).
