# MM-RYTM V.6.2 : bouton OPEN visible, + SAMPLE, PAGE, KEYBOARD, SOUNDS fiabilise, menu deploye a l'arrivee avec STUDIO

2026-11-02. Demandes de Mika :
- "page ne fonctionne pas.. c'est rempli de bogues ! controle toute la machine ! et je vois plus le bouton OPEN"
- "Sound ne fait rien.."
- "Keyboard non plus.. je veux pouvoir rajouter des samples aussi .. c'est ou ?"
- "PAge aussi ne fait rien quandon touche dessus.. des fois on change de page ca fait rien / image KB .. a quoi ca sert d'ecrire un truc ici nous avon spas la place et in comprend rien"
- "Quand on arrive sur le site je veux qu'on arrive avec le menu deploye et la nous pouvons cliquer ensuite dans STUDIO apres mixtapes"

## 1. Ce qui a ete fait

- **Bouton OPEN, + SAMPLE et selecteur VERSION toujours accessibles sous la MM-RYTM** (`src/v4/ui/HoodClose.tsx`, `src/v4/v4.css`, `src/v4/theme/face.ts`) :
  - La barre de controle `.v4-ver-bar` est desormais affichee en permanence sous la MM-RYTM sur desktop (fermee comme ouverte), avec un bouton `OPEN` / `CLOSE` (LED orange), un bouton `+ SAMPLE` (qui ouvre directement le selecteur de fichier audio pour la piste active) et les boutons `VERSION` (`V.1.0` a `V.6.0`).
  - La serigraphie orange `OPEN` est egalement ajoutee sous le logo `M` sur la face 3D (`DT2_SILK_TEXTS`).
- **Suppression de la legende `KB OCT` a droite de la fleche UP** (`src/v4/theme/face.ts`) :
  - Le texte `kbOct` (`KB OCT` avec double fleche a droite de `^`) est retire de `DT2_SILK_TEXTS`.
- **Fiabilite a 100 % des touches de page (`TRIG`, `SRC`, `FLTR`, `AMP`, `FX`, `MOD`) et des touches de transport** (`src/v4/ui/Hotspots.tsx`, `src/v4/actions/internal/face.ts`, `src/v4/actions/internal/keys60.ts`) :
  - Cause racine de "des fois on change de page ca fait rien" : sur la face DT2, les touches `DT2_KEY_KINDS` (`sounds`, `preset`, `tempo`, fleches...) reclamaient le pointeur des `pointerdown` (`stage.orbit.claim`), mais pas `pkey` (`TRIG`, `SRC`, `FLTR`, `AMP`, `FX`, `MOD`). Un clic avec un leger glissement de souris (`>= 6 px`) lancait la rotation d'orbite 3D et ignorait le clic au relachement.
  - Les touches `pkey`, `edit`, `run`, `stop`, `rec`, `no`, `yes`, `open` reclament maintenant le pointeur des `pointerdown`, bloquent l'orbite dans `stage.orbit.gate` et declenchent leur action au relachement tant que le pointeur est relache sur la meme touche (`btnSame`).
  - `FUNC + FLTR` et `FUNC + AMP` ouvrent `fltr` et `env` au lieu d'afficher `SOON IN V.6.1`.
  - Sur les pages a une seule sous-page (`FLTR`, `AMP`), `UP` / `DOWN` / `LEFT` / `RIGHT` et `PAGE` passent a la page principale voisine au lieu de ne rien faire.
- **Touche `PAGE` fonctionnelle au tap court** (`src/v4/actions/face.ts`, `src/v4/actions/internal/keys60.ts`) :
  - Un appui court sur `PAGE` (`ptnpage`) appelle `ptnPageTap()`, avance la page (`1/4` a `4/4` sur les LED rouges de page) et fait defiler la sous-page ou page courante a l'ecran.
- **Touche `KEYBOARD` fonctionnelle** (`src/v4/actions/internal/keys60.ts`, `src/v4/actions/chords/chords60.ts`, `src/v4/scene/screen/dt2.ts`, `src/v4/actions/face.ts`) :
  - `KEYBOARD` (`kbd`) active/desactive `dtFace.keyboard()`, allume la LED de la touche `KEYBOARD`, affiche le badge `KBD` dans l'en-tete de l'ecran et permet de jouer la piste active en chromatique sur `TRIG 1 a 16` (`trigPlay`), avec changement d'octave par les fleches (`kbdOctStep`).
- **Menu `SOUNDS` inconditionnel et import de sample** (`src/v4/actions/browser.ts`, `src/v4/scene/screen/menus/sounds60.ts`, `src/v4/scene/screen/core.ts`) :
  - Ajout de `browserVoice()` dans `browser.ts` avec repli sur `activeTrack` puis `'BD'` quand `pattern.get().instrument` vaut `null`, ce qui empechait `soundBrowserOpen()` d'ouvrir la liste et laissait l'ecran sur `YES: SHOW THE SOUNDS`.
  - Dans `core.ts`, un menu DT2 ouvert (`dtFace.menu() !== null`) s'affiche meme si `PTN` (`rytmEdit`) est actif.
  - `FUNC + SOUNDS` (`SAMPLES`), la derniere ligne `+ LOAD A FILE...` dans `SOUNDS`, et le bouton `+ SAMPLE` sous la machine ouvrent le selecteur de fichier sample.
- **Menu deploye a l'arrivee sur le site et entree `03 STUDIO` apres `MIXTAPES`** (`src/v4/ui/Header.tsx`, `src/v4/ui/MobileHeader.tsx`, `src/v4/ui/MenuSheet.tsx`, `src/v4/ui/menu.css`, `src/v4/v4.css`) :
  - A l'arrivee sur `/` (hors route de section et hors lien profond machine/debug), `initialMenuOpen()` ouvre le menu par defaut sur desktop et mobile, sans forcer le cadre jaune de focus sur `01 TRACKS`.
  - Ajout de `03 STUDIO` juste apres `02 MIXTAPES` dans `PAGE_LINKS` (`01 TRACKS`, `02 MIXTAPES`, `03 STUDIO`, `04 SHOWS`, `05 PRESS`, `06 CONTACT`) : cliquer sur `STUDIO` ferme le menu et amene dans le studio 3D.
- **Firmware** : `npm run firmware:bump -- mm808 minor` (`6.1` -> `6.2`) et `npm run firmware:check`.

## 2. Portes de verification

- `npx tsc --noEmit -p .` : 0 erreur sur les fichiers modifies.
- `node scripts/exports-check.mjs` : `exports-check : identique`.
- `npm run face:test` : 7 / 7 ok.
- `npm run hw:test` : 17 / 17 et 20 / 20 ok.
- `npm run presets:test` : 12 / 12 et 5 / 5 ok.
- `npx vite build` : build de production sans erreur.
- Verification Playwright muette (`--mute-audio`, `?mute=1`) : menu deploye a l'arrivee avec `03 STUDIO` apres `02 MIXTAPES`, clic sur `03 STUDIO` ferme le menu vers MM-STUDIO, `OPEN` et `+ SAMPLE` visibles et actifs, `SOUNDS`, `PAGE`, `KEYBOARD` et les 6 touches de page verifies avec captures.
