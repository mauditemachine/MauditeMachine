# 2026-10-01 : potards GLOBAL et VOICE

## 1. Ce qui a été fait

- src/v4/theme.ts : ids des potards de voix (vstretch, vdist, vchorus, vdelay, vreverb, plus vol et tone), VOICE_PARAM, deux rangées (encPlaces), ENCODER.voiceScale 0.85, filets de groupe GLOBAL et VOICE (ENC_GROUPS), centre marqué sur les deux STRETCH, transport remonté de 0.06.
- src/v4/actions.ts : VOICE règle la voix sélectionnée (sinon TAP A PAD FIRST), GLOBAL règle le pattern ; lecture écran « SD STRETCH +10% » ou « REVERB 2% ».
- src/v4/scene/encoders.ts, renderer.ts : échelle par potard, synchro des 15 valeurs.
- src/v4/ui/Hotspots.tsx : 15 jumeaux, noms Global ou Voice.
- src/v4/fallback/StaticMachine.tsx : potards de voix à l'échelle dans le repli SVG.
- docs/v4/spec.md : R14-7.

## 2. Décisions prises et pourquoi

- GLOBAL : SWING, STRETCH, DIST, CHORUS, DELAY, REVERB, la liste de Mika, dans l'ordre du signal ; même taille et même couleur (Mika s'est repris : pas d'autre couleur).
- VOICE : VOLUME, TONE et les mêmes effets, SWING retiré ; sans pad sélectionné, les potards demandent d'en toucher un, comme VOLUME avant.
- TONE reste côté voix seulement (pas dans la liste globale de Mika).
- Taille : 0.85, mesuré 6 px de moins à 1440 x 900.
- Identification : un filet sous chaque rangée coupé par son nom, comme une sérigraphie de groupe.
- Espacement : transport remonté de 0.06, rangées descendues de 0.04 ; TEMPO garde 0.1 au-dessus de SOLO.

## 3. Ce qui reste à faire / points en suspens

- Rien. Vérifié dans le navigateur sans lecture audio (jumeaux clavier, écran, valeurs des potards).

## 4. Commandes utiles ajoutées

- Aucune.
