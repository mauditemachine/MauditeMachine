# 2026-10-27 : MM-RYTM V.4.0, phase 2, intégration et mise en ligne

Mika : « ok fonce, dis-moi quand c'est en ligne », puis « ok fonce, dis-moi quand les scènes sont en ligne ».

Ce rapport complète `2026-10-27-rytm-v4-phase2.md`, écrit par l'agent de construction sur la branche `rytm-v4-p2`. Il couvre l'intégration de cette branche dans la branche de dev, qui portait aussi les corrections de la relecture de la phase 1, les mises en ligne par étapes, et la relecture indépendante des scènes avant leur mise en ligne.

## 1. Ce qui a été fait

### Mises en ligne

| Contenu | Commit sur main |
|---|---|
| Dernières corrections de la phase 1 : écran 5:3, OPEN qui respire en orange, rapport | ce63a0b |
| Les potards suivent la page (P2-01, P2-02) | a591c7f |
| Capuchons moteurs (P2-03), lettres A à H (P2-04) | f9a18db |
| GLOBAL FX d'abord, KNEE sur H (P2-05), points de page (P2-06) | 8151add |
| Fondations de TRK (P2-08), choisir une voix ne reprogramme plus les coups (P2-09) | 56ae1b2 |
| TRK tenu + pas 1 à 8 (P2-10) | e59b41f |
| Couleurs des voix (P2-11), TRK + double tape coupe une voix (P2-12), teintes P-LOCK (P2-13), via la fusion a878e04 | 8211b1f |
| Scènes A/B et crossfader (P2-14 à P2-20), textes et rapport de la phase 2, corrections de la relecture des scènes | 82822c6 |

### Relecture indépendante des scènes (workflow wf_9d823404-1e5)

Elle a été faite sur le code fusionné c584aea, sous trois angles :
- l'audio et les performances ;
- les sauvegardes, la compatibilité et l'intégrité des fusions ;
- le comportement sur desktop et sur téléphone.

Chaque constat moyen ou grave a ensuite été contre-vérifié par un agent chargé de le réfuter. Les corrections ont été faites dans le worktree `scenes-fix`. Le correcteur a aussi traité les constats des relectures comportement et audio du workflow de la phase 2, qui avait été coupé par un redémarrage du conteneur.

Constats corrigés, en 6 commits, de 0cfd863 à 192c28e :

- **Curseur natif du navigateur visible sur le crossfader 3D.** C'était une régression de fusion : la règle CSS `input.v4-twin` avait été retirée par la relecture de la phase 1 quand le jumeau était devenu un div, et le jumeau actif de la phase 2 est revenu en `input`. La règle est remise ; le contour jaune du focus clavier reste visible.
- **TRK gardé, déjà en ligne depuis 8211b1f.** Juste après le choix d'une voix, une tape sur un autre pas dans les 400 ms rechoisissait une voix au lieu de jouer le pas. Désormais, seule une deuxième tape sur le même pas reste à TRK : c'est la double tape qui coupe la voix.
- **P-LOCK sous une scène.** Un P-LOCK sur VOL, DIST, CHORUS, DELAY, REVERB ou TONE était perdu quand ce réglage était dans une scène. Il joue maintenant, avec sa valeur morphée à partir du verrou.
- **STRETCH dans une scène** ne déclenche plus de reprogrammations en rafale. TONE est exact aux deux bouts du crossfader.
- **Variantes d'un son.** Leur alternance revient quand TUNE, FINE, TONE ou STRETCH sont dans une scène.
- **Valeur de coup écrite dans la scène entendue.** Elle reprogramme les coups tout de suite, au lieu d'attendre 300 à 450 ms.
- **Potard tenu par la scène entendue.** Il le dit (SCENE A PLAYS, HOLD SCENE A), et les lecteurs d'écran annoncent la valeur qui joue. Une scène tenue et un P-LOCK gardé ne coexistent plus.

### Vérification finale avant la mise en ligne (82822c6)

- tsc : 13 erreurs, toutes déjà présentes avant.
- Build OK.
- smoke-v4 : 6 pages sans erreur (mm808, voy, dj, desktop et téléphone).
- **Audio sans scène, rendus hors ligne contre la version en ligne 8211b1f.** 13 cas : pattern d'arrivée, pattern d'arrivée avec P-LOCK et FX, un SD verrouillé seul, les 10 presets d'usine. Écart maximal 3,7e-7, environ -128 dB, c'est-à-dire du bruit de calcul.
- **Sonde muette des scènes et du crossfader :**
  - une tape sur SCENE A l'arme ;
  - le potard D écrit REVERB dans la scène A, pas dans la base ;
  - Échap affiche SCENE OFF ;
  - le crossfader suit la formule de Mika (0.158 à A, 0.1505 à 4,7 %, 0 à B) ;
  - Espace sur le crossfader ne lance pas RUN ;
  - les scènes survivent au rechargement.
- **Sonde du correctif TRK :** TRK gardé, la voix CH choisie, puis une tape sur le pas 1 dans les 250 ms : le pas 1 de CH change et TRK se ferme.
- Aucune erreur JS.
- Aucun son joué : Chromium avec `--mute-audio`, `?mute=1`, rendus hors ligne seulement.

## 2. Décisions prises et pourquoi

- **Mise en ligne par étapes** pour les potards et pour TRK, comme Mika l'a demandé. **Scènes retenues** jusqu'à la fin de la relecture : elles touchent la programmation des coups (drums.ts, clock.ts) et le format de sauvegarde des patterns, et rien ne peut s'écouter pendant les tests.
- **MUTE au desktop : les deux comportements sont gardés.** La relecture de la phase 1 avait rendu à MUTE son mode armé (une tape, puis une voix au clavier ou par TRK + pas). La phase 2, écrite avant, ajoute TRK + double tape ou clic droit sur un pas, en dehors des modes SOLO et MUTE. Les textes d'aide, TWIN_ARIA et INFOS, décrivent les deux.
- **Le workflow de la phase 2 n'a pas été repris après le redémarrage.** Ses constats sont passés au correcteur des scènes pour ne pas avoir deux correcteurs sur le même code.
- **Les sondes coupent le dessin 3D** (`setSkipDraw`). Sous le rendu logiciel du conteneur, une image prend environ 0,6 s, et une tape au clavier arrivait comme une tenue. Ce n'est pas un défaut du site.

## 3. Ce qui reste à faire / points en suspens

- **Constats bas non corrigés :**
  - AP-2 et AP-4 : au changement de pattern à la mesure, l'arrivée peut avoir jusqu'à 45 ms de retard, ce qui est dans la spec ; une refonte de l'applicateur est à prévoir ;
  - données de scène corrompues au-delà de 64 clés ;
  - TRK avec EDIT ouvert à la souris : l'éditeur couvre les pas ;
  - cause par potard pour les potards motorisés (phase 3) ;
  - `aria-valuenow` des potards lit encore la base.
- **Téléphone :** pas de touche SCENE ni de crossfader. Prévu en phase 5.
- **À valider par Mika :**
  - les couleurs provisoires des voix ;
  - le comportement de MUTE ;
  - GLOBAL FX en premier sur la touche FX ;
  - le diamètre de 28 mm des potards : est-ce le potard avec son anneau, ou le capuchon seul ?
  - les marges des pas (8 mm à gauche, 7,6 mm à droite).
- **Écoute réelle par Mika :** enregistrer une scène A et une scène B, puis balayer le crossfader en lecture. Ce test n'a jamais été fait à l'oreille.
- **Phase 3** (cibles MIDI rytm:trk, rytm:scene:a/b, rytm:xfade, MMHW v2) : il faut que Mika pousse `hardware/mm-rytm-hw/`. J'attends son OK pour la commencer.
- **Écart à la règle :** un relecteur a utilisé une fois `pkill -f` sur le nom unique de son propre script de test, alors que la règle l'interdit. Les serveurs, eux, ont été arrêtés par leur pid.

## 4. Commandes utiles ajoutées

- Aucune nouvelle commande npm.
- Les sondes muettes de cette session sont dans le dossier de travail de la session, hors du repo :
  - rendu hors ligne `ident.cjs` et comparaison `cmp.cjs` ;
  - sonde des scènes `scn.cjs` ;
  - sonde de TRK.
- Pour une sonde sous rendu logiciel : `window.__v4.stage.setSkipDraw(true)` (avec `?debug=1` seulement), pour que les durées de tape et de tenue soient réalistes.
