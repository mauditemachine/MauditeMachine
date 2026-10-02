# 2026-10-02 : VOICE FX sous les pads de pages (desktop)

## 1. Ce qui a été fait

- src/v4/theme.ts (encPlaces) : la rangée VOICE FX va de TRACKS (VOLUME) à CONTACT (REVERB), sept potards répartis au pas de 0.667.
- docs/v4/spec.md : R14-21.

## 2. Décisions prises et pourquoi

- Alignée sur les pads au-dessus plutôt que sur la grille des pas dessous : c'est ce que Mika regarde (REVERB passait sous OPEN). La rangée GLOBAL garde la grille des pas.
- Libellés vérifiés : ils restent séparés au pas de 0.667.
- Téléphone (portrait) inchangé.

## 3. Ce qui reste à faire / points en suspens

- FX sur les tracks SoundCloud : en attente de la réponse de Mika sur l'abonnement Artist Pro (nécessaire pour créer l'app API).

## 4. Commandes utiles ajoutées

- Aucune.
