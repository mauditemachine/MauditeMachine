# MM-RYTM V.6.1 : ecran debloque sur les touches de page et SOUNDS, FX sur SEND FX par defaut, selecteur V.1.0 a V.6.0 dans OPEN

2026-11-02. Demandes de Mika :
- "quand j'appuis sur les boutons en dessous des knobs.. l'interface devrait changer mais ca reste bloque .. je voudrais que les fx ca soit les fx globaux directement au lieu des voices.. par defaut je veux dire"
- "je veux que l'interface soit optimisee parce que tout est compresse et je suis pas daccord.. je voudrais aussi un selecteur de machine parmis les derniere veresion quand on clic sur open la machine.. version 1.0 2.0 etc.. pour pouvoir voir les evolution et a chaque fois le site se rafraichi"

## 1. Ce qui a ete fait

- **Deblocage du rafraichissement de l'ecran** (`src/v4/scene/screen/core.ts`, `src/v4/scene/screen/dt2.ts`) :
  - Dans `Screen.request(delay = 0)` (`core.ts`), lorsqu'un minuteur long etait deja arme (par exemple les 60 000 ms de `FUNC: + A KEY` ou `TRK: PICK A TRACK`, ou les 1 400 ms d'expiration d'un message), `if (this.timer !== 0) return;` ignorait toute demande de redessin immediat (`request(0)`). La touche de page changeait bien l'etat et sa LED 3D passait au rouge, mais la texture 2D de l'ecran restait figee jusqu'a l'expiration du minuteur. `Screen` retient desormais `timerDue` et annule tout minuteur plus lointain lorsqu'un redessin plus proche ou immediat est demande.
  - Dans `dt2.ts`, le delai du prochain redessin prend le minimum positif entre le corps et l'en-tete (`Math.min(next, headMore)`), au lieu de `Math.max(next, headMore)` qui retardait une animation de 60 ms jusqu'a la fin d'un message de 60 s.
- **Deblocage du menu SOUNDS et des fleches UP / DOWN** (`src/v4/ui/Hotspots.tsx`, `src/v4/actions/browser.ts`, `src/v4/scene/screen/menus/sounds60.ts`, `src/v4/actions/internal/keys60.ts`) :
  - Sur la face DT2, l'appui (`pointerdown`) sur la touche `SOUNDS` ouvrait le menu `sounds` et `lcdSamples`, puis le relachement (`pointerup`) dans `Hotspots.tsx` appelait `soundBrowserClose()` parce que `d.kind` valait `'sounds'` (et non `'sbrowse'`), ce qui vidait la liste tout en laissant le menu `sounds` ouvert sur un ecran vide (`YES: SHOW THE SOUNDS`). Le relachement ne ferme plus `lcdSamples` quand le menu DT2 `sounds` est ouvert, et `sbView` ne monte plus le jumeau cache `lcd-sb-body` de la V.5.3 par-dessus l'ecran DT2.
  - Dans `browser.ts`, `watchBrowser` garde `lcdSamples` ouvert tant que `dtFace.menu() === 'sounds'` meme si `focus.set('mm808')` est emis au relachement du pointeur ou si la grille `PTN` est active.
  - Dans `keys60.ts`, `subPage` boucle avec `(cur + dir + tabs.length) % tabs.length` pour que les deux fleches `UP` et `DOWN` fassent defiler les sous-pages `1/2` et `2/2`.
- **FX sur les FX globaux par defaut et blocs VOICE FX non compresses** (`src/v4/rytm/pages.ts`, `src/v4/state/rytmPage.ts`) :
  - Sur desktop, `PAGE_TABS.fx` est ordonne `['fxg', 'fxv']` (au lieu de `['fxv', 'fxg']`) et l'onglet par defaut au chargement ouvre directement les 8 FX globaux (`SEND FX` / `fxg` : `DIST`, `CHORUS`, `DELAY`, `REVERB`, `STRETCH`, `SWING`, `BIT`, `COMP`).
  - Sur la sous-page `VOICE FX` (`fxv`), les 4 blocs utilisent la hauteur standard `1` sur la grille DT2 (`h: DT2_FACE ? 1 : 2`) au lieu de 4 colonnes etroites etirees sur 2 lignes a cote du fader `LEV`.
- **Selecteur de version V.1.0 a V.6.0 dans OPEN** (`src/v4/theme/base.ts`, `src/v4/theme/face.ts`, `src/v4/theme.ts`, `src/v4/firmware.ts`, `src/v4/scene/screen/consts.ts`, `src/v4/scene/machine.ts`, `src/v4/scene/renderer.ts`, `src/v4/ui/HoodClose.tsx`, `src/v4/v4.css`) :
  - Ajout de `RYTM_FACE_VER` (`'1.0' | '2.0' | '3.0' | '4.0' | '5.0' | '6.0'`), `RYTM_VERSIONS` et `PAD_FACE` (les faces desktop a 10 pads des versions 1.0 a 3.0, les faces a touches des versions 4.0 et 5.0, et la face DT2 de la version 6.0), pilotables par `?face=v1` a `?face=v6`.
  - Quand on clique sur `OPEN` sur la MM-RYTM, une barre `MM-RYTM VERSION` (`V.1.0` a `V.6.0`) s'affiche en bas de la machine ouverte et rafraichit le site sur la version choisie.
- **Firmware** : `npm run firmware:bump -- mm808 minor` (`6.0` -> `6.1`), puis `npm run firmware:stamp` et `npm run firmware:check`.

## 2. Portes de verification

- `npx tsc --noEmit -p .` : 0 erreur sur les fichiers modifies (uniquement les erreurs historiques connues hors scope).
- `node scripts/exports-check.mjs` : `exports-check : identique`.
- `npm run face:test` : 7 / 7 ok.
- `npm run hw:test` : 17 / 17 et 20 / 20 ok.
- `npm run presets:test` : 12 / 12 et 5 / 5 ok.
- `SEO_OFFLINE=1 npx vite build` : build de production sans erreur.
- Verification Playwright muette (`--mute-audio`, `?mute=1`) : `FX` ouvre `fxg` par defaut, `UP`/`DOWN` bouclent entre `fxg` et `fxv`, `TRIG`/`SRC`/`FLTR`/`AMP`/`MOD` rafraichissent l'ecran immediatement meme apres `FUNC`, `SOUNDS` affiche la liste des sons sans cadre jaune parasite, `OPEN` affiche le selecteur `V.1.0` a `V.6.0`.
