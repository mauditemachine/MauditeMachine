# MM-RYTM façon Digitakt, étape D3a : banques A à H et Control All (FIRMWARE V.5.2)

2026-10-30. Mika : « go D3 ». Il trouve les étapes trop longues : D3 est coupé en trois mises en ligne courtes.
- **V.5.2 (ce cahier)** : banques A à H (128 patterns) et Control All.
- V.5.3 : l'enregistrement en direct (● + ▶), potards compris.
- V.5.4 : 64 pas (4 pages), longueur et vitesse par piste (SETUP), copier-coller de pas et de pages.

Références : `docs/v4/digitakt-reference.md` (section 3), `digitakt-d1-spec.md` (section 0, les règles), `digitakt-d2-spec.md`.

**Portée : petite.** Pas de refonte. Le téléphone ne gagne aucune touche.

## 0. Règles

- Section 0 de `digitakt-d1-spec.md` : ids MIDI intacts, sauvegardes d'avant relues, aucun son pendant les tests, aucun tiret cadratin.
- **Identité audio** : rien ne change au son. Pas besoin de sonde d'identité lourde : un rendu hors ligne du pattern d'arrivée, identique à la V.5.1.
- La sauvegarde `mm.v4.patterns.1` d'avant (16 emplacements) se relit : elle devient la banque A, B à H vides. Même clé, tableaux de 128.
- Pour finir : `node scripts/firmware.mjs bump mm808 minor "..."` (V.5.2) et le rapport `docs/reports/2026-10-30-rytm-v52-digitakt-d3a.md`.

## 1. Les banques A à H

- `PATTERN_SLOTS` passe à 128 : 8 banques × 16. `slotName` donne A01 à H16. Le reste de `state/patterns.ts` ne change presque pas (le courant, la chaîne, les verrous, les scènes, les mutes, les trigs par emplacement).
- La chaîne : 64 patterns au plus, ils peuvent venir de banques différentes.
- **La banque affichée** : un état `bank` (0 à 7), par défaut celle du pattern courant. Il n'est pas sauvegardé à part : au chargement, c'est la banque du pattern courant.
- **PTN** (la grille) montre les 16 patterns de la banque affichée. Une tape sur le pas k choisit le pattern `bank × 16 + k`, avec les règles d'aujourd'hui (à la mesure en lecture, chaîne dans les 2 s, tenir un vide copie).
- **BANK = FUNC + PTN** (remplace `BANKS A-H: V.5.2`) :
  - la grille passe en vue BANK : les pas 1 à 8 sont les banques A à H, comme la Digitakt ;
  - couleurs : la banque du pattern qui joue en rouge 1, une banque qui a des patterns en blanc faible, une vide éteinte, la banque affichée qui clignote si ce n'est pas celle qui joue ;
  - une tape sur une banque l'affiche et ouvre la grille PTN de cette banque (on choisit ensuite le pattern) ;
  - écran : `BANK B` puis la grille ;
  - PTN ou NO ferme la vue BANK.
- **L'écran** : le nom du pattern partout passe en A01 à H16 (ça marche déjà par `slotName`). La vue PTN de l'écran montre la banque affichée, `BANK B` dans l'en-tête.
- **MIDI**, ajoutés à la fin :
  - `rytm:bank:0` à `rytm:bank:7` (appuis) : afficher la banque A à H ;
  - `rytm:ptn:0` à `rytm:ptn:15` gardent leur id et deviennent « le pattern k de la banque affichée », comme les touches de trig de la Digitakt en mode PTN ; banque A par défaut, donc rien ne change pour qui ne touche pas aux banques ;
  - le CSV régénéré.
- **Le boîtier** (`hw/snapshot.ts`, `hw/rowLeds.ts`) : le nom A01 à H16, les LED de la vue BANK. `npm run hw:test` à jour.
- **Le téléphone** : sa grille montre les 16 patterns de la banque du pattern courant. Rien d'autre.
- UNDO, SAVE/RELOAD, COPY/PASTE de pattern : ils marchent déjà par indice ; vérifie-les sur un pattern de banque B ou plus.

## 2. Control All (TRK + potard)

- **Le geste** : TRK tenue, ou gardée par une tape (`state/trk.ts`, la règle de la souris), et on tourne un potard d'une page de voix (TRIG, SRC, FLTR, AMP, FX, MOD) : le réglage change **sur les 8 voix**.
- **La valeur** : lis le manuel [M1] (Digitakt OS 1.54, chercher « CONTROL ALL ») pour savoir si les voix prennent toutes la même valeur ou si elles bougent du même écart. Fais comme la Digitakt, et écris dans le rapport ce que dit le manuel. Si le manuel ne le dit pas clairement : toutes prennent la valeur de la voix choisie.
- **NO** pendant que TRK est encore tenue ou gardée : annule tout le Control All de cette tenue (chaque voix retrouve sa valeur d'avant).
- **UNDO** : un Control All entier = une seule étape.
- **L'écran** : l'en-tête dit `CONTROL ALL` pendant le geste, et le bloc du potard montre la valeur.
- Avec un pas tenu (P-LOCK), Control All ne s'applique pas : le P-LOCK gagne, comme aujourd'hui.
- Les potards hors des pages de voix (MASTER, TEMPO, SEND FX, MIXER, KIT) ne sont pas concernés.
- Tourner un potard avec TRK gardée compte comme un usage de TRK : elle se referme comme après le choix d'une voix, mais seulement au relâcher du potard, pas pendant.
- MIDI : rien de neuf ; le `rytm:trk` tenu (note 60) + un potard MIDI de page fait aussi Control All.
- Une carte INFOS « CONTROL ALL » et une carte « BANK », en français, tutoiement, sans tiret cadratin.

## 3. Vérification

- Les portes de D1/D2 : tsc à 13, build, smoke 6 pages, hw:test, presets:test, firmware check.
- Une sonde muette (DOM et état, jamais de son) qui prouve :
  - FUNC + PTN, banque C, pas 5 : le pattern courant est C05, l'écran le dit ;
  - une sauvegarde de 16 emplacements se relit en banque A ;
  - une chaîne A02 > C05 tourne à la mesure (compteur de mesures, `patterns.get()`) ;
  - Control All sur FLTR FREQ : les 8 voix changent ; NO les remet ; UNDO défait en une étape ;
  - `rytm:bank:2` puis `rytm:ptn:4` donne C05 ;
  - le téléphone (`?portrait=1`) identique à la V.5.1 avec un pattern en banque A.
