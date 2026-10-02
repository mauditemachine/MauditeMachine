# 2026-10-02 : effets plus marqués

## 1. Ce qui a été fait

- src/v4/audio/sends.ts : REVERB envoyée à 1.0 (0.3), DELAY à 0.9 (0.55), réinjection 0.58 (0.42), passe-bas 4.5 kHz.
- src/v4/audio/fx.ts : salle de REVERB de 2.4 s (1.2), pré-délai 20 ms ; DIST plus saturée (1 + 12 d) et plus mélangée (0.85 d).
- src/v4/audio/chorus.ts : CHORUS deux fois plus profond (±7 ms), mélange sec 1 - 0.5 v, chorus 1.0 v.
- src/v4/audio/drums.ts : écrêteur doux en bout de chaîne (sécurité, transparent sous 0.9).
- docs/v4/spec.md : R14-19.

## 2. Décisions prises et pourquoi

- Mesuré hors ligne (OfflineAudioContext), jamais joué sur les enceintes : sur un coup de SD à 100 %, queue de REVERB -61 → -42 dB, DELAY -40 → -34 dB, DIST change le son de +10 dB au lieu de +2.
- Tout à fond, la sortie montait à +8 dB au-dessus de 0 dBFS : écrêteur doux plutôt qu'un compresseur-limiteur (celui-ci laissait passer les attaques et remontait le sec de son gain de compensation automatique).
- Les effets par voix suivent les mêmes lois (mêmes constantes).

## 3. Ce qui reste à faire / points en suspens

- Écoute par Mika : régler à l'oreille si un effet est maintenant trop fort.

## 4. Commandes utiles ajoutées

- Aucune. Mesure : `window.__v4.audio.renderOffline({ seconds: 3, single: 'SD', reverb: 1 })` avec `?debug=1`.
