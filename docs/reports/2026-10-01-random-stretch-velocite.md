# 2026-10-01 : RANDOM, STRETCH facon Impulse, traits de velocite

## 1. Ce qui a ete fait

- STRETCH refait comme le Time d'Impulse : `src/v4/audio/time.ts` (nouveau), `src/v4/audio/drums.ts` (durees de chaque coup x4^v, bruit en boucle), `src/v4/audio/stretch.ts` supprime (worklet granulaire).
- STRETCH par voix aussi : `src/v4/audio/voicefx.ts`, `src/v4/theme.ts` (VOICE_ENCODERS, BIPOLAR, cran du centre), `src/v4/actions.ts`, `src/v4/ui/Hotspots.tsx`, `src/v4/scene/renderer.ts`.
- Traits de velocite au-dessus des pas : `src/v4/scene/sequencer3d.ts` (3 traits par pas, 48 instances), `src/v4/audio/pattern.ts` (VEL_BARS), dock mobile `src/v4/ui/Dock.tsx` et `src/v4/v4.css`.
- Bouton RANDOM : `src/v4/audio/house.ts` (grammaire house), `pattern.replace()`, `randomPattern()` dans `actions.ts`, touche 3D et jumeau, de dans le dock mobile, silhouette dans `src/v4/fallback/StaticMachine.tsx`.
- `src/v4/scene/encoders.ts` : la valeur d'un potard centre est gardee meme sans changement d'angle (debug).
- Spec : `docs/v4/spec.md` section 26.

## 2. Decisions prises et pourquoi

- STRETCH agit a la programmation de chaque coup (comme la hauteur de TONE) et non sur le bus : c'est ce que fait Impulse avec un echantillon, et nos voix sont synthetisees, donc on etire leurs enveloppes sans toucher aux frequences. Plus de hachage granulaire, rien ne tourne au repos.
- Plage x0.25 a x4 (produit pattern x voix borne de x0.15 a x6) : assez pour un BD tres sec ou une longue 808, sans queue sans fin.
- L'attaque de 2 ms du BD ne s'etire pas : le coup garde son claquement a +100.
- Couleur des pas : la cause etait le survol de la souris, prioritaire sur la couleur de velocite. Les traits comptent la velocite quel que soit l'etat ; le survol n'eclaire plus que la LED d'un pas vide.
- RANDOM tire tout le pattern (pas seulement la voix selectionnee), garde tempo et effets. Mobile : place a gauche des voix, la rangee transport debordait a 375 px.

## 3. Ce qui reste a faire / points en suspens

- Mika : ecouter STRETCH (tests mesures, jamais ecoutes) et dire si la plage x0.25 a x4 lui va.
- Mika : juger les motifs RANDOM a l'oreille ; les probabilites sont dans `audio/house.ts`.
- Reglages par voix (dont STRETCH) toujours en memoire seulement.
- Hebergement des morceaux pour passer les pistes dans les effets : toujours a decider.

## 4. Commandes utiles ajoutees

- Debug (`?debug=1`) : `__v4.audio.timeOf('BD')` (facteur de duree du prochain coup), `__v4.seq.bars` (traits par pas), `__v4.audio.renderOffline({ single: 'TOM', stretch: 1 })`, `__v4.pattern.replace(steps)`.
