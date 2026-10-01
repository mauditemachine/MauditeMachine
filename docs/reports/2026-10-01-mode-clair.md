# 2026-10-01 : mode clair (Dark / Light)

## 1. Ce qui a été fait

- Bouton Dark / Light : `src/v4/ui/AppearanceToggle.tsx` (nouveau), dans `ui/Header.tsx` (desktop) et en haut à droite de la machine sur mobile (`index.tsx`).
- État : `src/v4/state/appearance.ts` (nouveau, localStorage `mm.v4.appearance`, sombre par défaut).
- Machine claire : `theme.ts` (`applyAppearance`, palette LIGHT, INK, EXPOSURE, APPEARANCE, OPEN_TINT), `scene/renderer.ts` (courbe Neutral en clair, skipIntro), `scene/silk.ts` et `scene/backplate.ts` (encre selon l'apparence), `scene/sequencer3d.ts` (teintes des LED lues à la construction), `scene/pads.ts` (OPEN teinté orange).
- Page claire : `v4.css` (variables du press kit sous `data-v4-theme='light'`), logo `public/logo/mauditemachine-logo-ink.svg`.
- Spec : `docs/v4/spec.md` section 30.

## 2. Décisions prises et pourquoi

- La machine se reconstruit au changement d'apparence : chaque module lit ses teintes à la construction ; reconstruire est plus sûr que repeindre chaque maillage. L'intro ne rejoue pas, la musique et la vue ouverte restent.
- Courbe Neutral en clair : l'ACES grisait le blanc (#E5E2DD) ; lumières blanches neutres, sinon le blanc virait au crème (#E8DFCF).
- Le jaune des accents devient l'orange du press kit en clair : le jaune ne se lit pas sur le crème.
- Encodeurs noirs gardés : sur une machine blanche, ils donnent le contraste et le repère.

## 3. Ce qui reste à faire / points en suspens

- Mika : juger le blanc (#EFEDE9 mesuré) et le gris des pads ; tout se règle dans `theme.ts`, bloc LIGHT.
- La version sans WebGL (SVG de repli) suit seulement les teintes de base.

## 4. Commandes utiles ajoutées

- Aucune. Pour tester : `?debug=1`, puis le bouton Light (ou `localStorage.setItem('mm.v4.appearance', 'light')`).
