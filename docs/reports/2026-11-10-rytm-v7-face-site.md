# 2026-11-10 - MM-RYTM V.7.0 : la face du site (knobs a droite, ecran cliquable) et le telephone

## 1. Ce qui a ete fait

- `src/v4/theme/base.ts` : nouvelle face `7.0`, celle du site sans `?face=` (`SIDE_FACE`). Positions : huit voix, EDIT et OPEN en une rangee, potards a droite de l'ecran (`SIDE_KNOBS_AT`, `SIDE_PADS`).
- `src/v4/theme/face.ts` : grands potards de la V.4 avec anneau de valeur (A a H), transport sur la ligne des touches de page, 16 pas sous les voix.
- `src/v4/theme.ts` : `FACE_FOLLOWS_PAGE` (les potards reglent la page affichee) et `SCREEN_TOUCH` (l'ecran se clique et se tire a la souris) vrais pour la V.7.0 ; filets de la face.
- `src/v4/scene/renderer.ts` : anneaux des potards pour la V.7.0 ; cadrage telephone sous la barre de Safari 26.
- `src/v4/rytm/pages.ts`, `src/v4/rytm/infos/words.ts` : l'ecran dit VOICE, ENV et GLOBAL FX comme les touches (il disait SRC, AMP, SEND FX).
- `src/v4/scene/screen/consts.ts`, `menus/presets.ts`, `home.ts` : presets cliquables a l'ecran (LOAD, SAVE, EXIT ; ils etaient coupes en bas), "CLICK: PRESETS".
- `src/v4/ui/Dock.tsx`, `VoyDock.tsx`, `v4.css` : au telephone, la languette du bas s'appelle TOUCH CONTROLS (une fleche seule avant).
- `src/v4/state/iosBar.ts` (nouveau) : detection de la barre flottante de Safari 26, partagee entre la page et la scene.
- `src/v4/firmware.json`, `firmware.ts`, `ui/HoodClose.tsx` : firmware MM-RYTM 6.9 -> 7.0, la V.7.0 est la version par defaut.

## 2. Decisions prises et pourquoi

- Choix de Mika : au desktop "voix et pas separes", au telephone "machine en pleine largeur".
- Les touches de page restent sous l'ecran (comme la V.3 et le telephone) et le transport passe sous les potards : une seule ligne de touches, les potards prennent toute la hauteur de l'ecran. Ecart avec l'apercu propose (pages sous les potards).
- Nouvelle version V.7.0 plutot que modifier la V.3.0 : les anciennes faces restent accessibles (`?face=v1` a `v6`).
- Telephone : la face avait deja la disposition choisie. La machine "minuscule" venait de la carte "Add to Home Screen", qui la retrecit tant qu'elle est affichee (choix d'origine, non modifie).
- Telephone, Safari 26 : la machine est 9 % plus petite au repos pour que rien ne soit cache (premiere ligne de l'ecran sous le selecteur, pas 12 et 13 sous la languette).
- Aucun id MIDI nouveau : les potards de la V.7.0 utilisent `rytm:knob:1` a `8`, comme les V.4 a V.6.

## 3. Ce qui reste a faire / points en suspens

- Mika : tester au son (aucune lecture audio pendant les tests) et sur son iPhone reel.
- Carte "Add to Home Screen" au telephone : elle retrecit la machine a chaque visite jusqu'a sa fermeture. A decider : la laisser, la rendre plus petite, ou ne plus retrecir la machine.
- Press kit et page /mm-studio/ : textes et captures a aligner sur la V.7.0.
- `scripts/smoke-v4.mjs` attend encore la face DT2 par defaut au desktop (deja faux depuis le 2026-11-08), a mettre a jour.
- V.1.0 : ses presets a l'ecran restent coupes (ecran de 120), non touche.

## 4. Commandes utiles ajoutees

- Aucune. Adresses : `/?m=mm-rytm` (V.7.0), `/?m=mm-rytm&face=v3` (ancienne face), `&face=v6` (Digitakt II).
