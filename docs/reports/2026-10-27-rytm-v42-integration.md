# 2026-10-27 : MM-RYTM V.4.2, l'intégration (v42-ui, v42-hw, v42-presets)

Mika : « je voudrais que la gestion des presets soit plus simple ! et aussi qu'on puisse nommer ses presets ! un nom d'utilisateur 4 lettres et le nom du preset jusqu'à 10 lettres en mobile et en desktop.. la gestion doit être plus simple ! » ; « appuie-toi pour Rytm de la Digitakt pour les boutons parce que les icônes des fois c'est difficile à deviner c'est quoi ».

Les trois branches de V.4.2, toutes parties de 8661349 (la production), réunies dans le worktree `v42-ui` (branche `v42-ui`). Rien n'a été joué : Chromium `--mute-audio --use-gl=swiftshader`, `?mute=1`, `HTMLMediaElement.play` bloqué, jamais RUN, chaque départ de source audio compté (0 partout). Pas de push, pas de déploiement. `data/` n'est pas touché.

Les rapports de chaque partie : `2026-10-27-rytm-v42-ui.md` (les légendes façon Digitakt, TRK d'une couleur et ses éclairs, les touches en relief, l'écran intouchable du desktop) et `2026-10-27-rytm-v42-presets.md` (les presets nommés et plus simples). La partie matériel (v42-hw) n'a pas de rapport à elle : son contrat est `docs/hardware/mmhw-v2-app-side.md`.

## 1. Ce qui a été fait

- **Fusion de v42-hw** (55faed8) : aucun conflit de texte. Une couture : V.4.2 donne une seule couleur aux pas en vue TRK (`steps.trkColor`, l'orange de la machine), `hw/snapshot.ts` et `docs/hardware/mmhw-v2-app-side.md` parlaient encore de la couleur de chaque voix (`steps.voiceColor`, parti). `trkLeds` garde sa forme, le snapshot rend `#FF6A13` pour les huit pas.
- **Fusion de v42-presets** (1343982) : v42-presets contenait déjà v42-ui jusqu'à 72ef1b4 (sa fusion a6e0be0). Deux conflits, gardés des deux côtés : `package.json` (`hw:test` et `firmware:*` de v42-hw, `presets:test` de v42-presets) et `src/v4/debug.ts` (`__v4.hw` et `__v4.presets`).
- **FIRMWARE V.4.2 / 2026** sur la face et le capot du MM-RYTM (fd14362, `npm run firmware:bump -- mm808 minor`), puis les empreintes reposées après les coutures (6dd8df9, `npm run firmware:stamp`) : `npm run firmware:check` est OK pour les trois machines.
- **Le pont du boîtier voit les presets** (dd7264f) : `getSnapshot().presets` vaut `null` quand ils sont fermés, sinon `{ stage, name, keys, face }` (l'étape, la ligne du curseur ou le nom en cours, le nom des cinq touches de l'écran sur VOICE FLTR ENV FX EDIT, et si la face les mène). Les potards gardent le label et la valeur de la page cachée : parcourir la liste ne bouge aucun moteur, LOAD les pose sur le preset chargé.
- **Un commentaire** de `ui/Hotspots.tsx` décrivait encore la loi miroir de v42-ui pour la tape d'un potard (A B PREV, C D NEXT, E F G H SAVE NAME DEL EXIT), remplacée à la fusion par les touches de v42-presets (5ee6e49).

### Le contrôle (HEAD, sans un son)

- `npx tsc --noEmit -p .` : les 13 erreurs connues, rien de plus.
- Build d'une copie de HEAD (`SEO_OFFLINE=1 npm run build`), servie, puis `smoke-v4.mjs --machines mm808,voy,dj` : 6 pages, aucune erreur.
- `npm run hw:test` : 16 tests bons. `npm run presets:test` : 11 tests bons. `npm run firmware:check` : OK pour les trois.
- Les ids MIDI, lus dans les pages de dev de 8661349 et de HEAD : 817 avant, 830 après, aucun retiré ni changé (nom, type, crans, scène), le même ordre. Les 13 nouveaux : `rytm:screen:fxm` (la page MASTER de v42-ui), `rytm:trk`, `rytm:scene:a`, `rytm:scene:b`, `rytm:xfade` et `rytm:voice:select:BD` à `CY` (v42-hw).
- Les sondes des trois builders, relancées sur l'arbre fusionné : presets (le parcours, la face à la souris, le téléphone au doigt, le MM-ARP, le MM-BASS, SHARE), MIDI (LEARN, TRK, scènes, crossfader, voice:select, le port du boîtier exclu), le pont (`__v4.hw`, en dev et sur le build), l'écran intouchable, la page MASTER, les éclairs de TRK : toutes vertes.
- Une sonde de l'intégration, les presets du desktop par toutes les entrées :
  - EDIT deux fois (souris ou `rytm:edit`) les ouvre, une troisième les ferme, EDIT reste allumée ;
  - les 59 zones de l'écran ne réagissent pas à la souris, le curseur reste normal ;
  - la molette sur un potard, `rytm:knob:3` en MIDI et `hw.pot` font défiler la liste sans rien charger ;
  - `rytm:page:voice` charge (LOAD) sans changer la page cachée ; FLTR (SAVE) ouvre le nom ;
  - `rytm:knob:2` déplace le curseur du nom et `rytm:knob:1` change la lettre ; VOICE (OK) garde `INTG/MERGE A` ;
  - `rytm:page:fx` (DEL) demande, EDIT dit NO ; TRK et `voice:select` changent la voix sans fermer les presets ;
  - après EXIT, le potard du boîtier règle de nouveau son bloc.
- Au pixel près contre 8661349 : le téléphone du MM-RYTM au repos (sombre et clair) ne diffère que par la ligne FIRMWARE V.4.2 ; le MM-ARP au téléphone (sombre et clair) est identique ; au desktop, le MM-ARP ne diffère que par la respiration de sa touche OPEN et par le MM-RYTM voisin.

## 2. Décisions prises et pourquoi

- **MM-ARP et MM-BASS gardent FIRMWARE V.2.3 et V.3.0.** Leurs sources ont changé avec v42-presets (cinq touches, le dialogue du nom, le nom dans l'en-tête). La règle de Mika voudrait 2.4 et 3.1, mais la consigne de l'intégration garde le MM-ARP identique au pixel, son FIRMWARE compris. Les empreintes sont reposées sans monter la version, et la décision revient à Mika.
- **Le snapshot du pont dit les presets** : sans ce champ, le pont aurait lu les labels de la page cachée pendant que les potards font défiler la liste. C'est un ajout seul : rien ne change pour les champs d'avant.
- **La molette suit le sens d'un potard** sur les presets : vers le haut, le potard tourne à droite et la liste avance. C'est l'inverse de la liste des sons, où la molette vers soi descend. C'est le choix de v42-presets, gardé tel quel.

## 3. Ce qui reste à faire / points en suspens

- **À trancher par Mika** :
  - MM-ARP en 2.4 et MM-BASS en 3.1 : `npm run firmware:bump -- voy minor "presets nommes et plus simples"`, puis la même chose pour `bass` ;
  - la gestion des presets du MM-ARP et du MM-BASS a changé avec v42-presets, alors que la consigne de V.4.2 ne touchait pas au comportement du MM-ARP. C'est conforme à la demande (« la gestion des presets », « en mobile et en desktop »). Pour garder l'ancienne gestion du MM-ARP, il faudrait reprendre `voyager/` et `ui/VoyTwins.tsx` à 8661349.
- Les points à valider des deux rapports : les légendes et la course des touches, la page MASTER, EDIT deux fois pour les presets, les cinq touches sous l'écran, les règles des noms.
- **À l'oreille, par Mika seulement** : un ancien preset chargé doit sonner pareil ; les éclairs de TRK pendant une vraie lecture.
- **Le boîtier** : les éclairs de TRK ne sont pas dans `getSnapshot().leds` (les niveaux de repos seulement) ; le format des LEDs attend `protocol.js`. Il n'y a pas de cible MIDI pour les presets.
- `CLAUDE.md` : la règle du firmware proposée par v42-hw (son rapport, « remaining ») attend l'accord de Mika.
- `npm run docs:midi` n'a pas été lancé : la référence MIDI ne liste pas encore les 13 nouvelles cibles.

## 4. Commandes utiles ajoutées

- `npm run hw:test` (v42-hw) : les 16 tests du retour des moteurs.
- `npm run presets:test` (v42-presets) : les 11 tests des noms.
- `npm run firmware:check | firmware:bump | firmware:stamp` (v42-hw) : les firmwares suivent leurs sources ; la CI (`pages.yml`) avertit sans bloquer.
