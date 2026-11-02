# Rapport de session : TRACKS et MIXTAPES directement dans le MIXER avec les platines (MM-DECKS)

Date : 2026-11-02

## Demande de Mika
- « tracks et mixtape devrait jouer directement dans mixer avec des decks :) fait ca »

## Cause racine et architecture mise en place
1. **Routage direct vers `MM-DECKS` (`src/v4/actions/nav.ts`, `src/v4/actions/browser.ts`, `src/v4/dj/actions.ts`)** :
   - Cliquer sur `01 TRACKS` ou `02 MIXTAPES` dans le menu (ou cliquer sur un morceau / une mixtape dans `Tracks.tsx` ou `Mixtapes.tsx`) ferme le panneau lateral (`section.set(null)`), amene la camera sur `MM-DECKS` (`focus.set('dj')`), charge et lance immediatement la piste ou la mixtape sur le `DECK A`, et ouvre le navigateur du `DECK B` sur l'onglet correspondant (`TRACKS` ou `MIXTAPES`).
2. **Catalogue local toujours disponible dans les platines (`src/v4/dj/soundcloud.ts`, `src/v4/dj/browser.ts`, `src/v4/dj/TrackBrowser.tsx`)** :
   - Ajout de `CATALOG_TRACKS` (les pistes jouables de Maudite Machine) et `CATALOG_MIXTAPES` (les 5 mixtapes de Maudite Machine) construits depuis `src/v4/data.ts`.
   - Ajout des deux onglets permanents `TRACKS` et `MIXTAPES` en tete du navigateur CDJ de chaque platine, disponibles instantanement sans dependre du Worker `sonaa-sets`.
3. **Moteur de flux par platine et forme d'onde 3 bandes (`src/v4/dj/scDeck.ts`, `src/v4/dj/engine.ts`, `src/v4/dj/waveform.ts`)** :
   - Creation de `src/v4/dj/scDeck.ts` : controleur SoundCloud Widget par platine (`deckScController(deck)`) + generateur d'enveloppes rythmiques 3 bandes (`buildStreamPeaks`) calees sur la grille de battements (`overview`, `detail`, `bands`).
   - Adaptation du shader GLSL `detailBar` (`src/v4/dj/waveform.ts`) pour boucler proprement la texture de detail sur les mixtapes longues (jusqu'a 2 heures) sans saturer la memoire GPU.
   - Pontage complet dans `DjChannel`, `DjMixer` et `DjPlayer` (`src/v4/dj/engine.ts`) : lecture/pause, seek, boucles `1/2/4/8`, hot cues `1..4`, jog, et controle en temps reel du volume et des VU-metres LED (voie et `MASTER`) par les faders, le `GAIN`, l'isolateur 3 bandes (`LOW`/`MID`/`HI`), le `FILTER` et le `MASTER`.

## Fichiers modifies
- `src/v4/dj/scDeck.ts` (nouveau)
- `src/v4/dj/waveform.ts`
- `src/v4/dj/engine.ts`
- `src/v4/dj/soundcloud.ts`
- `src/v4/dj/browser.ts`
- `src/v4/dj/TrackBrowser.tsx`
- `src/v4/dj/dj.css`
- `src/v4/dj/actions.ts`
- `src/v4/actions/nav.ts`
- `src/v4/actions/browser.ts`
- `src/v4/ui/MenuSheet.tsx`

## Verifications effectuees
- `exports-check.mjs` : OK (identique)
- `npm run face:test` : 7 / 7 OK
- `npm run hw:test` : 37 / 37 OK
- `npm run presets:test` : 12 / 12 OK
- `vite build` : OK (`dist/` genere sans erreur)
- Verification Playwright (`?mute=1`, `--mute-audio`) : clic sur `01 TRACKS` puis `02 MIXTAPES` depuis le menu d'arrivee, verification de la lecture active sur `DECK A`, des VU-metres LED sur `MIXER`, et des listes `TRACKS` et `MIXTAPES` sur `DECK B`.
