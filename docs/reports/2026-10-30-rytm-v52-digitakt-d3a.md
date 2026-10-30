# MM-RYTM façon Digitakt, étape D3a : banques A à H et Control All (FIRMWARE V.5.2)

2026-10-30. Le cahier : `docs/v4/digitakt-d3a-spec.md` (720ae43). Point de départ : V.5.1 (8e83f96). Branche `worktree-agent-a3f84c671ac17ce70`, rien de poussé.

## 1. Ce qui a été fait

- **Les banques** (`state/patterns.ts`) : 128 emplacements, 8 banques de 16, `slotName` donne A01 à H16, une chaîne de 64 au plus. La banque affichée (`bank`) n'est jamais retenue : au chargement, c'est celle du pattern courant. Une sauvegarde `mm.v4.patterns.1` de 16 emplacements se relit en banque A ; la même clé garde ensuite des tableaux de 128.
- **FUNC + PTN** (`actions.ts`, `state/dtFace.ts`) : la vue BANK, les pas 1 à 8 sont les banques A à H. Une tape affiche la banque et ouvre sa grille PTN ; PTN, NO ou Échap referment la vue BANK.
- **La grille** suit la banque :
  - les pas (`scene/renderer.ts`), les jumeaux (`ui/Hotspots.tsx`), l'anneau de l'écran et `BANK B` dans l'en-tête (`scene/screen.ts`) ;
  - le boîtier (`hw/snapshot.ts` : la vue `bank`, `pattern.bank` ; `hw/rowLeds.ts bankLeds`) ;
  - le téléphone (`ui/BeatEditor.tsx`), qui montre la banque du pattern courant.
- **MIDI** (`midi/targets.ts`) : `rytm:bank:0` à `rytm:bank:7` sont ajoutés à la fin. `rytm:ptn:0` à `15` gardent leur id et choisissent le pattern k de la banque affichée. `docs/midi` est régénéré (891 cibles, aucun id d'avant ne bouge).
- **CONTROL ALL** (`actions.ts`, `state/trk.ts`, `state/ctl.ts`, `state/undo.ts`) :
  - TRK tenue ou gardée, plus un potard d'une page de voix : les huit voix prennent la valeur de la voix choisie ;
  - NO avant de lâcher TRK : chaque voix retrouve sa valeur d'avant ;
  - une seule étape d'UNDO (`undo.hold`) ;
  - `CONTROL ALL` dans l'en-tête.
- **INFOS** (`rytm/infoIds.ts`, `rytm/infos.ts`) : les cartes BANK (au survol d'un pas en vue BANK) et CONTROL ALL (au survol d'un potard, TRK allumée). La carte PTN est mise à jour.
- **Le reste** : `__v4.rytm.patterns` dans le debug ; un test de `bankLeds` dans `scripts/hw-leds.test.mjs` ; FIRMWARE V.5.2.

## 2. Décisions prises et pourquoi

- **Ce que dit le manuel** ([M1], OS 1.54, 6.2.2 CONTROL ALL, p. 19) : « If you press and hold [TRK] and change a parameter setting, this change will affect this parameter in all the audio tracks in the pattern. Press [NO] before you release [TRK] to revert the parameter changes. » Il ne dit pas si les pistes prennent la même valeur ou bougent du même écart. Comme le cahier le demande dans ce cas, toutes prennent **la valeur de la voix choisie**.
- **Ce que CONTROL ALL règle** :
  - les réglages de voix (VOL, PITCH, FINE, FLTR, AMP, les FX de la voix), les réglages de trig par défaut et les LFO ;
  - restent sur la voix choisie : le choix du son, MIX et les réglages de la machine de synthèse (le kick n'a pas ceux de la caisse claire), ainsi que VEL ;
  - une scène armée prend la valeur comme avant, sans CONTROL ALL ; un pas tenu (P-LOCK) gagne.
- **TRK gardée** (la souris) le reste après un CONTROL ALL, jusqu'à une autre tape sur TRK, le choix d'une voix ou Échap (la relecture, R4) ; il n'y a plus de fermeture à 400 ms.
- **Juste après le choix d'une voix** (TRK qui se referme), un potard reste sur cette voix : CONTROL ALL ne démarre qu'avec TRK tenue ou gardée.
- **L'UNDO** : la rafale reste ouverte pendant tout le CONTROL ALL, même au-delà de 2 s, et se ferme à sa fin (TRK éteinte, une voix choisie, un autre pattern). Après NO ou Échap, la rafale revient à son départ et ne laisse aucune étape.
- **La relecture de D3a** (14 points, dont 4 doublons), une ligne par point :
  - R1 (= R8) : le Roto en RSEQ travaille en indices de la grille de la banque affichée, la fenêtre est bornée à 1-8 et 9-16, et la vue BANK est sur les boutons 1 à 8 avec ses LED (`pinWin`).
  - R2 (= R10) : FUNC + PTN ferme le mode MUTE, comme PTN.
  - R3 (= R7) : un changement de pattern pendant un CONTROL ALL le termine. Les changements restent, l'étape d'UNDO se ferme, NO n'a plus rien à annuler : aucune réécriture croisée.
  - R4 : après un CONTROL ALL, TRK gardée le reste. NO l'annule tant que TRK est allumée, Échap aussi (puis éteint TRK). L'en-tête dit `CONTROL ALL · NO: UNDO`.
  - R5 : TRK ne s'éteint jamais sous un potard tenu : sa fermeture attend le lâcher (`faceTouch.anyHeld`).
  - R6 : il n'y a plus de suivi par indice de bloc (la fermeture au lâcher n'existe plus) : les potards E à H se comportent comme A à D.
  - R8 : voir R1.
  - R9 (≈ R14) : voir R14.
  - R10 : voir R2.
  - R11 : la vue BANK clignote aussi à l'arrêt (l'écran se redessine tant que la banque affichée n'est pas celle qui joue).
  - R12 : la carte CONTROL ALL ne cite plus de touche de clavier, nomme MASTER parmi les pages non concernées, et ne sort que sur un potard qui fait CONTROL ALL.
  - R13 : les boutons du Roto disent `PTN 01` à `PTN 08`, sans A (ids et CC inchangés, `docs/midi` régénéré).
  - R14 : au desktop, le panneau de la grille se cache pendant la vue BANK (`inert`, `data-shown` à 0). Les pas 3D, leurs LED de banque et leurs clics reviennent dessus.
- **La vue BANK** est un mode de la grille PTN : elle l'ouvre s'il le faut, et la refermer ramène où l'on était. Ses LED reprennent celles de PTN : la banque qui joue en rouge, l'affichée en rouge clignotant, une pleine en blanc faible.
- **La banque affichée** suit une tape et l'UNDO, pas la chaîne qui avance.
- **`rytm:bank:<b>`** : dans la vue BANK, il fait comme une tape ; sinon il change la banque sans ouvrir la grille.
- **La ligne de la chaîne** garde `01>03` en banque A, et prend les noms entiers (`A02>C05`) dès qu'elle en sort.

## 3. Ce qui reste à faire / points en suspens

- **Mika** :
  - essayer FUNC + PTN, puis TRK + un potard, puis NO ;
  - si la Digitakt bouge les pistes du même écart (le manuel ne le dit pas), le changement tient en une ligne (`ctlAllApply`).
- **Le boîtier** : la vue `bank` de l'instantané est prête ; le pont doit la montrer.
- **Remarque** : au desktop, l'éditeur du motif couvre les pas 3D quand la grille PTN est ouverte, par choix depuis 2026-10-05 (sa rangée PTN fait les mêmes gestes). Pendant la vue BANK, il se cache (R14).
- **La suite** : V.5.3 (l'enregistrement en direct), puis V.5.4 (64 pas, SETUP).

## 4. Commandes utiles ajoutées

- MIDI : `rytm:bank:0` à `rytm:bank:7`.
- Debug : `__v4.rytm.patterns` (`get`, `tap`, `select`, `setBank`, `slotAt`, `bankFilled`), `__v4.hw.getSnapshot().pattern.bank`, `leds.view === 'bank'`.
- `undo.hold(machine, on)` : un geste, une seule étape d'UNDO.
- Les sondes, hors du dépôt (`scratchpad/d3/t/`) : `d3.cjs` (la sonde de la section 3), `id1.cjs` (le rendu du pattern d'arrivée), `shot.cjs` (les captures), `rv.cjs` (la relecture rejouée : R4 à la souris et à Échap, R5, R6, R3/R7, R2, R14, R1/R8).

## Vérification (copie propre de 4e7dbd2, après la relecture, `git archive`)

Aucun son : Chromium `--mute-audio`, `?mute=1`. La chaîne est lue par `patterns.get()`, jamais écoutée.

- tsc : 13 erreurs, les mêmes qu'avant. Build OK. Smoke : `6 pages, aucune erreur`. hw:test : 17 + 10 tests, tous bons. presets:test : 12 + 5 tests, tous bons. Firmware check : MM-RYTM V.5.2 (211 fichiers), MM-ARP V.2.3, MM-BASS V.3.0.
- **L'identité audio** : le rendu hors ligne du pattern d'arrivée (une mesure et quatre) contre la V.5.1 donne un écart de 1,2e-7, autant que V.5.1 contre elle-même.
- **La sonde muette** : 10 sur 10, aucune erreur de page.
  - FUNC + PTN : la vue BANK (en-tête `BANKS|BANK A|A01`, boîtier `bank`), puis la banque C, puis le pas 5 : le pattern courant est C05, l'en-tête dit `BANK C|C05`, l'écran `PATTERN C05 EMPTY`.
  - PTN puis NO referment la vue BANK.
  - `rytm:bank:2` puis `rytm:ptn:4` : C05.
  - La chaîne A02 > C05 à 150 BPM : A02 C05 A02 C05, un changement toutes les 1605 à 1606 ms (une mesure : 1600 ms).
  - Sur B03 : UNDO, SAVE puis RELOAD (`RELOADED B03`), COPY puis PASTE (`PATTERN B03 PASTED ON C07`) marchent.
  - CONTROL ALL sur FLTR FREQ :
    - les 8 voix (de 0,3 à 0,65) passent toutes à la même valeur, l'en-tête dit `CONTROL ALL · NO: UNDO` ;
    - NO les remet exactement ;
    - un geste de 2,6 s : TRK reste gardée pendant et après, une tape sur TRK le termine ; une seule étape d'UNDO, qui rend les 8 valeurs.
  - Au MIDI, `rytm:trk` tenu + `rytm:knob` : les 8 voix à 0,9.
  - Un pas tenu (P-LOCK) gagne : les voix ne bougent pas, le verrou `fcut` va au pas.
  - Une sauvegarde de 16 emplacements se relit : 128 emplacements, A06 intact, B01 à H16 vides, retenue en 128.
- **La relecture rejouée** (`rv.cjs`) : 10 sur 10, aucune erreur de page.
  - R4, à la souris : NO cliqué 1,5 s après le lâcher, TRK encore gardée, et les 8 voix reviennent de 0,0333 à leurs valeurs (0,3 à 0,65).
  - R4, Échap : il annule, puis éteint TRK. Une tape sur TRK garde le CONTROL ALL, en une étape d'UNDO (1 vers 2) qui le défait.
  - R5 : potard repris et tenu immobile 900 ms, TRK reste gardée, les 8 voix suivent (0,5).
  - R6 : potard E (DIST) de la page FX tenu 1 s, TRK reste gardée, les 8 voix suivent (0,7).
  - R3/R7 : LEN à 11 sur A01, puis A02. NO laisse A02 à `{"BD":{"len":3},"SD":{"len":5}}`, et A01 garde ses valeurs.
  - R2/R10 : MUTE `global` puis FUNC + PTN, et le MUTE est `off`, vue BANK, boîtier `bank`.
  - R14 : panneau caché (`data-shown` 0, `inert`), sous la souris `v4-hit`. Un clic sur le pas 3D 3 donne la banque C, puis le panneau revient, et le pattern n'a pas bougé.
  - R1/R8, au Roto en RSEQ : dans la grille C, le bouton 3 donne C03 ; STEPS 9-16 puis le bouton 2 donnent C10 ; dans la vue BANK, le bouton 5 donne la banque E.
- **L'identité audio**, refaite : 1,2e-7 contre la V.5.1, autant que son bruit.
- **Le téléphone** (`?portrait=1`, au repos, banque A) : identique au pixel près à la V.5.1, sauf le texte FIRMWARE V.5.2.
