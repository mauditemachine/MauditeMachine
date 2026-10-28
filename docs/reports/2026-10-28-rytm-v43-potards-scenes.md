# 2026-10-28 : MM-RYTM V.4.3, les potards tournent toujours ce qu'on entend

Mika, capture de la page FX à l'appui : « je peux même plus tourner les knobs ».

## 1. Ce qui a été fait

### Le bug, reproduit en ligne (sonde muette, build de main d66a715)

Mika avait mis DIST, CHORUS, REVERB et COMP dans la scène A (SCENE A armée, potards tournés), puis désarmé A. Le crossfader était au repos à gauche, à x = 0 : la scène A joue en entier. Tourner un de ces potards n'écrivait que leur valeur de base. Elle ne s'entend pas, puisque la scène A la recouvre (LA formule : a + (b - a) x). L'anneau montre ce qui joue, donc il restait figé, et l'écran disait `DIST: SCENE A PLAYS, HOLD SCENE A`. Cette règle venait de la relecture B1 de la phase 2 : c'était un choix, et un mauvais.

### La correction (V.4.3)

- **`src/v4/actions.ts`** :
  - **Hors scène armée**, un réglage qu'une scène fait entendre suit la main, au x du moment (`sceneFollow`, `follow`, `heardOf`).
  - Chaque valeur qui y prend part se décale du même écart : la scène A si elle a le réglage et s'entend (x < 1), la B de même (x > 0), la base si elle s'entend encore. Le morphing garde sa forme.
  - Une valeur qui touche sa butée laisse le reste de l'écart aux autres, pour que la main aille au bout de sa course même au milieu du crossfader.
  - `dialEdit` part de ce qu'on entend : le glisser, la molette et le `get()` MIDI ne sautent pas.
  - `globalDial`, au téléphone, ouvre toujours la page du FX (`fxPopup`).
  - `subscribeDials` écoute les scènes et le crossfader.
- **`src/v4/midi/targets.ts`** : les cibles MIDI des voix (`rytm:voice:<inst>:<p>`) suivent de la même façon (`sceneFollowId`), et leur `get()` lit ce qu'on entend (`sceneHeard01`).
- **`src/v4/ui/KnobPanel.tsx`** : les potards du Dock du téléphone (page KNOBS) partent de ce qu'on entend (`dialEdit`).
- **`src/v4/scene/renderer.ts`** et **`src/v4/ui/Hotspots.tsx`** : les encodeurs 3D du téléphone, et leurs jumeaux, montrent ce qu'on entend et suivent les scènes.
- **`src/v4/rytm/infos.ts`** : la carte SCENE le dit.
- **`src/v4/firmware.json`** : MM-RYTM 4.2 → 4.3.

### Relecture contradictoire (workflow wf_07bcbeb3-5e5)

Trois angles de relecture : la logique, les chemins d'entrée, l'état et la persistance. Chaque constat moyen a été contre-vérifié par un agent chargé de le réfuter.

Constats retenus et corrigés :
- **Moyen, confirmé par 3 relecteurs** : les potards du Dock du téléphone partaient encore de la base. Avec la correction, le son aurait sauté et la valeur de la scène aurait été écrasée au premier pixel.
- **Moyen** : chaque valeur était bornée séparément. Au milieu du crossfader, la main n'arrivait pas au bout.
- **Bas** : les encodeurs 3D du téléphone dessinaient la base.
- **Bas** : au téléphone, la page du FX ne s'ouvrait plus.

### Vérification

- tsc : 13 erreurs, toutes déjà présentes avant.
- Build OK.
- smoke-v4 : 6 pages sans erreur.
- firmware check OK, `hw:test` OK, `presets:test` OK.
- **Sonde muette desktop**, sur le cas de Mika :
  - à x = 0, DIST passe de 0,8 à 0,5 et la scène A suit ;
  - à x = 0,5, le potard bouge 1 pour 1 (0,35 puis 0,55) : A et la base bougent ensemble ;
  - à x = 1 avec B vide, seule la base bouge ;
  - DELAY, hors scène, marche comme avant ;
  - poussé loin à x = 0,5, il atteint 1, puis revient sans saut.
- **Sonde muette du Dock du téléphone** : BD DIST tenu par A à 0,6, le potard affiche 76 et monte à 93, la scène A suit (0,733).
- Aucune erreur JS. Aucun son joué (`--mute-audio`, `?mute=1`).
- Le moteur audio n'est pas touché.

## 2. Décisions prises et pourquoi

- **« Le potard tourne ce qu'on entend »**, plutôt que la règle Octatrack, où un réglage tenu par la scène entendue est muet sous la main. Avec le crossfader au repos sur A, cette règle rendait figé tout réglage déjà enregistré dans A, et c'est ce que Mika a vécu.
- **Décaler toutes les valeurs qui jouent**, plutôt qu'écrire seulement la scène la plus proche. Le son suit la main à n'importe quelle position du crossfader, et l'écart entre A et B reste le même tant qu'aucune valeur n'atteint sa butée.
- **Les butées** : pousser au bout aplatit l'écart entre A et B. C'est inévitable si la main doit aller au bout, et UNDO le rattrape.
- **La scène armée et le P-LOCK sont inchangés** : un pas tenu ou le LOCK gagne toujours.

## 3. Ce qui reste à faire / points en suspens

- **Constat bas non corrigé** : au crossfader entre A et B, une tournée écrit deux ou trois valeurs, donc deux ou trois passages des écouteurs des scènes par mouvement, contre un seul quand la scène est armée. Sans effet visible à 60 Hz ; à regrouper si besoin.
- **Écoute réelle par Mika** : tourner DIST tenu par la scène A, puis balayer le crossfader.
- **Phase 3** (MMHW v2) : la session sur le Mac de Mika (`session_014DbX7KNriLW5RZ684ukxjB`) attend son feu vert pour chercher `mm-rytm-hw` et le pousser sur la branche `hardware-mm-rytm-hw`. La phase 3 passera en V.4.4.

## 4. Commandes utiles ajoutées

- Aucune nouvelle commande npm.
- Sondes muettes de la session, hors du repo (dossier de travail de la session, `knobbug/`) :
  - `probe3.cjs` : reproduit le bug ;
  - `probe4.cjs` et `probe5.cjs` : desktop et butées ;
  - `probe6.cjs` : Dock du téléphone.
