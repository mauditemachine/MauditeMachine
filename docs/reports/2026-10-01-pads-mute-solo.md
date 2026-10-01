# 2026-10-01 : pads de voix rose (MUTE) et bleu (SOLO)

## 1. Ce qui a été fait

- src/v4/theme.ts : VOICE_TINT (rose poudré et bleu), une paire pour la machine noire, une pour la claire (applyAppearance).
- src/v4/scene/pads.ts : setVoiceState, la teinte du caoutchouc par pad (multiplicateur calculé depuis la couleur visée) ; info().tint.
- src/v4/scene/renderer.ts : syncVoices teinte les pads à chaque MUTE ou SOLO.
- src/v4/v4.css : les boutons de voix du Dock mobile prennent les mêmes couleurs.
- docs/v4/spec.md : R14-9.

## 2. Décisions prises et pourquoi

- Même matière caoutchouc : seule la teinte change, la rugosité, le dôme et le rétroéclairage restent.
- Rose poudré, pas bonbon : #E3B1A9 en clair ; en sombre #7A5662, le premier essai (#7E4E50) tirait vers la brique sous l'ACES.
- Le solo passe avant le mute, comme le séquenceur (state/voices.ts).
- Couleurs vérifiées par lecture de pixels, à quelques niveaux près de la cible.

## 3. Ce qui reste à faire / points en suspens

- Rien.

## 4. Commandes utiles ajoutées

- Aucune. État des teintes : `window.__v4.stage.pads.info().tint` avec `?debug=1`.
