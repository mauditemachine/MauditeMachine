# 2026-10-27 : MM-RYTM V.4.2, des presets plus simples et nommés (MM-RYTM, MM-ARP, MM-BASS)

Mika : « je voudrais que la gestion des presets soit plus simple ! et aussi qu'on puisse nommer ses presets ! un nom d'utilisateur 4 lettres et le nom du preset jusqu'à 10 lettres, en mobile et en desktop.. la gestion doit être plus simple ! » ; « appuie-toi pour Rytm de la Digitakt pour les boutons ».

La partie presets de V.4.2, dans le worktree `v42-presets` (branche `v42-presets`, partie de 8661349, la production). La branche contient aussi `v42-ui` jusqu'à son rapport 72ef1b4 (fusion a6e0be0, voir les décisions). Rien n'a été joué : Chromium `--mute-audio --use-gl=swiftshader`, `?mute=1`, `HTMLMediaElement.play` bloqué, jamais RUN, l'arpège et la basse jamais lancés. Pas de push, pas de déploiement. `src/v4/firmware.json` et `data/` ne sont pas touchés, aucun id MIDI n'a changé.

## 1. Ce qui a été fait

- **Les noms** (`state/presetName.ts`, pur et sans import) : un preset à toi s'écrit `USER/NAME` (MIKA/DEEP KICK). L'utilisateur fait exactement 4 caractères (ni le premier ni le dernier un espace), le nom de 1 à 10 ; A à Z, 0 à 9, l'espace et le tiret, en majuscules, accents retirés (ÉTÉ devient ETE), le reste refusé. Un preset d'usine garde son nom tel quel (jusqu'à 12 lettres, MONARK DRIVE). Le nom proposé au premier SAVE est un nom drôle et court (NEON TACO), AS NEW numérote (ACID 2, DEEP KICK2). `npm run presets:test` : 11 tests node sans dépendance (`scripts/presets-name.test.mjs`).
- **La migration** : les presets d'avant (un nom au hasard, « Hungry Pancake ») reçoivent à la lecture un nom aux règles : le leur s'il tient en 10, sinon coupé à 10 (HUNGRY PAN), sinon USER et un numéro (USER 1) quand le nom coupé est déjà pris. Le plus ancien choisit d'abord, l'ancien nom reste dans `was`, les ids et les données ne bougent pas : chaque preset se charge à l'identique. Elle s'écrit une fois, et un nom déjà aux règles ne change plus. Leur utilisateur reste absent : ils s'affichent sous celui du navigateur (USER tant qu'il n'est pas choisi).
- **Une gestion pour les trois machines** (`state/presetMode.ts`, le même code) :
  - une liste, tes presets puis ceux d'usine, et le curseur qui s'ouvre sur le preset chargé ;
  - parcourir ne charge plus : on regarde, puis on confirme, comme une Digitakt ;
  - cinq touches toujours à la même place : LOAD SAVE NAME DEL EXIT ; NAME et DEL restent vides sur un preset d'usine.
- **Les cinq actions** :
  - LOAD charge en un geste. C'est une étape d'UNDO, et le son gardé nulle part est mis de côté (YOUR SOUND).
  - SAVE demande le nom au premier coup. Sur un preset à toi chargé, il demande OVERWRITE (le même preset, sa place, son nom) ou AS NEW.
  - NAME ouvre le dialogue prérempli.
  - DEL demande DELETE? ; YES est à la place de DEL et ignoré 350 ms, un double clic n'efface rien.
  - EXIT ferme. Échap revient d'un cran.
  - Plus rien n'est mis de côté à l'ouverture : avant, NOT SAVED / YOUR SOUND s'affichait dès qu'on avait tourné un potard.
- **Le magasin** (`state/presets.ts`) :
  - `save(m, {user, name})`, `overwrite`, `rename(m, id, {user, name})` ;
  - l'utilisateur retenu par le navigateur (`mm.v4.presets.user.1`) ;
  - le preset chargé retenu (`cur`, avec les sons mis de côté) et `loaded(m)` : son libellé, et s'il a bougé (l'étoile) ;
  - `funnyName` et ses listes sont partis.
- **Le dialogue** (`ui/PresetNameDialog.tsx`, `ui/presetName.css`), le même pour les trois machines :
  - USER et NAME en majuscules à la frappe, le compte des lettres ;
  - Entrée garde, Échap annule, Tab tourne dans le dialogue, et le focus revient où il était à la fermeture ;
  - `role="dialog"`, `aria-modal`, les règles lues, `aria-invalid` ;
  - une lettre tapée hors du dialogue y revient, elle ne joue pas une voix ;
  - aux couleurs de la machine : un panneau sombre, ou crème sur la machine claire, et des champs noirs comme l'écran ;
  - au desktop en bas, sur les pas : l'écran et les potards restent visibles ; au téléphone en haut, au-dessus du clavier.
- **L'écran du MM-RYTM** (`scene/screen.ts`, `state/lcd.ts`) :
  - la liste autour du curseur (la ligne d'avant et d'après à peine), le curseur en grand entre ses chevrons ;
  - le titre LOADED, EDITED, FACTORY ou NOT SAVED, et le rang ;
  - les questions OVERWRITE / AS NEW et DELETE? ;
  - le nom en cours, avec les cases vides de l'utilisateur soulignées et le curseur sous sa lettre ;
  - les cinq pastilles : au desktop, juste au-dessus des touches VOICE FLTR ENV FX EDIT qu'elles nomment (`rytm/presetKeys.ts`, le centre des touches lu dans `RYTM_FACEPLATE`) ; au téléphone, en cinquièmes de 60 x 51 px ;
  - HOME nomme le preset chargé en tête (MIKA/DEEP KICK*), dans l'air libre ; il cède sa place avant le pattern, MASTER et TEMPO.
- **La face du desktop** (l'écran ne se touche plus, U3) :
  - EDIT pressée encore ouvre les presets (la grille des patterns d'abord, comme une touche de page allumée passe à son onglet suivant ; HOME dit EDIT 2X: PRESETS) ;
  - VOICE FLTR ENV FX EDIT sont les touches de l'écran ; EDIT reste EXIT (CANCEL, NO) ;
  - un potard fait défiler la liste : 14 px de glisser, un cran de molette, ou 1/24 de course en MIDI ;
  - pour nommer sans clavier, le potard A choisit la lettre et le potard B déplace le curseur : c'est le repli matériel, façon Elektron, pour le futur boîtier ;
  - au clavier : P ouvre et ferme, les quatre flèches déplacent le curseur, Entrée charge.
- **MM-ARP et MM-BASS** :
  - le même mode et le même dialogue ;
  - leurs zones et leur dessin passent de quatre à cinq touches ; les flèches ne se dessinent que sur la liste ;
  - leur en-tête lit le nouveau libellé : celui du MM-ARP garde son étoile, celui du MM-BASS nomme le preset ;
  - sur le MM-BASS, PRESET ferme à toute étape, et les flèches, Entrée et P vont aux presets, pas aux notes ;
  - rien d'autre ne change sur le MM-ARP.
- **SHARE et UNDO** : un beat partagé arrive comme avant, et l'écran ne nomme plus le preset d'avant. UNDO ne change pas : `capture` et `apply` sont intacts. Après un UNDO qui rend le son d'avant un LOAD, l'écran ne prétend plus que c'est le preset retouché.
- **Les cartes INFOS** des presets (MM-RYTM desktop et téléphone, MM-ARP, MM-BASS) décrivent la nouvelle gestion, et `lcd-load` mène à la carte. `__v4.presets` (debug) donne store, mode, key, turn et view.

### Le contrôle

- tsc : 13 erreurs, la liste de la production. Build d'une copie, puis `smoke-v4.mjs --machines mm808,voy,dj` : 6 pages, aucune erreur, avant chaque commit fini.
- Sondes muettes, toutes vertes. Elles ont été rejouées après la fusion :
  - le chemin complet au MM-RYTM : migration, LOAD (une étape d'UNDO), OVERWRITE, AS NEW, le dialogue (utilisateur refusé à 2 lettres, majuscules), NAME aux potards A et B, DEL et son double clic, l'usine, YOUR SOUND et UNDO ;
  - la face à la souris, l'écran intouchable : EDIT deux fois, un glisser du potard A, VOICE LOAD, FLTR SAVE, VOICE OK, ENV NAME, EDIT CANCEL, FX DEL, EDIT NO, P, les flèches, Entrée, Échap ;
  - le téléphone au doigt : les zones de 60 x 51 px, le dialogue en haut avec des touches de 44 px, « Été 2026 » gardé ETE 2026 ;
  - le MM-ARP et le MM-BASS : migration, LOAD, OVERWRITE, AS NEW, la touche PRESET ;
  - un lien SHARE et un ancien son mis de côté.
- Au pixel près contre la production 8661349 :
  - le téléphone au repos (sombre et clair) : identique ;
  - le MM-ARP au téléphone : identique ;
  - le MM-ARP au desktop : son écran est identique ; le reste ne diffère que par la respiration animée d'OPEN et par la voisine MM-RYTM (ses nouvelles touches).
- Captures dans `scratchpad/v42/presets/shots` : desktop et téléphone, sombre et clair, MM-ARP et MM-BASS au desktop.

## 2. Décisions prises et pourquoi

- **Parcourir ne charge plus** :
  - c'est « parcourir = charger » qui avait fait perdre son son à Mika le 2026-10-11 ;
  - une Digitakt fait regarder puis confirmer ;
  - LOAD reste un seul geste, et le filet (YOUR SOUND, UNDO) reste, mais seulement au LOAD.
- **Cinq touches à places fixes** plutôt que des touches qui apparaissent et disparaissent. Leurs noms sont courts (LOAD SAVE NAME DEL EXIT) ; les jumeaux disent la phrase entière (Load MIKA/DEEP KICK).
- **L'entrée au desktop, EDIT pressée deux fois** : c'est celle du builder de l'interface, déjà dite dans son rapport et sur HOME. Mon premier dessin, EDIT tenu, a été abandonné à la fusion pour n'avoir qu'une entrée.
- **Les touches confirment, les potards défilent**, comme le demandait la consigne et comme sur une Digitakt. Le builder de l'interface faisait faire les actions aux tapes des potards E F G H. Mais les potards du futur boîtier sont tactiles et motorisés, pas poussoirs : une vraie touche est plus sûre. Les tapes de potard ne font donc rien en mode presets.
- **La migration coupe le nom à 10 plutôt que USER et un numéro d'emblée** : HUNGRY PAN se reconnaît, USER 3 non. USER et un numéro ne servent que si le nom coupé est pris. Le nom entier reste dans `was`.
- **OVERWRITE sans seconde confirmation** : le mot est déjà le choix (SAVE, puis OVERWRITE). Le preset garde sa place, son nom et son id : la liste ne bouge pas.
- **La fusion de `v42-ui` dans `v42-presets`** : les deux branches touchaient les mêmes lignes (l'écran des presets, EDIT, les potards, `presetFaceKnob`). Résoudre ici, avec la connaissance des deux côtés, laisse une intégration sans conflit : `v42-ui`, puis `v42-presets`. L'état « presets seuls » est 30148e5.

## 3. Ce qui reste à faire / points en suspens

- **À valider par Mika** :
  - les règles des noms : 4 et 10, l'espace et le tiret, les accents retirés ;
  - EDIT deux fois pour ouvrir, et les cinq touches sous l'écran ;
  - un potard pour défiler, A et B pour nommer ;
  - le dialogue, en bas au desktop et en haut au téléphone ;
  - les noms migrés : HUNGRY PAN, USER 1.
- **Le boîtier** : une vraie touche PRESET sur la face, ou une autre entrée, se change dans `rytm/presetKeys.ts`. Les cibles MIDI des presets restent à ajouter (il n'y en a aucune aujourd'hui pour le MM-RYTM et le MM-ARP), sans renommer les ids d'avant.
- **L'intégration** :
  - merger `v42-ui`, puis `v42-presets` ;
  - le firmware (MM-RYTM, MM-ARP et MM-BASS touchés) est à monter par l'intégration, pas ici.
- **Limites connues** :
  - un DEL ne se défait pas : la liste des presets n'est pas dans UNDO, comme avant ;
  - un ancien onglet resté ouvert sur le code d'avant peut réécrire un nom au hasard, qui sera remigré à la lecture ;
  - il ne retient pas non plus le preset chargé (`cur`) : l'en-tête ne le nommera plus ;
  - le preset chargé est retenu par navigateur.
- **À l'oreille** : rien de neuf à écouter, aucun son n'a changé (capture et apply sont intacts). Mika peut vérifier qu'un de ses anciens presets sonne pareil après la migration.

## 4. Commandes utiles ajoutées

```
npm run presets:test                 les règles des noms, la migration, le nom proposé, l'édition au potard
/?mute=1&debug=1&m=mm808             __v4.presets : store, mode, key(m, k), turn(k, crans), view(m)
```

Les sondes de la session (`probe.cjs`, `p1-flow.js` à `p6-share.js`) et les captures sont dans le scratchpad de la session, `v42/presets`, hors du dépôt.
