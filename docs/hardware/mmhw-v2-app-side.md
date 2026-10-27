# MMHW v2 : le côté site (crochets du pont MM-RYTM)

2026-10-27, MM-RYTM V.4.2, phase 3.

Ce document décrit ce que le site offre au futur pont du boîtier MM-RYTM (MMHW v2). Le dossier `hardware/mm-rytm-hw/` (`protocol.js`, `rytm-bridge.js`, `install.example.js`, `web/test`) n'est pas encore dans le dépôt. Rien ici ne fixe le format du fil : c'est le contrat que la mise à jour de `protocol.js` et de `rytm-bridge.js` implémentera quand Mika aura poussé le dossier.

## 1. Les numéros MMHW v2 donnés par Mika

| Contrôle du boîtier | Message | Côté site |
|---|---|---|
| TRK | note 60 (enfoncée, lâchée) | cible `rytm:trk` (tenue) |
| SCENE A | note 79 | cible `rytm:scene:a` (tenue) |
| SCENE B | note 80 | cible `rytm:scene:b` (tenue) |
| Crossfader | CC 28, 0 à 127 | cible `rytm:xfade` (0 = A, 127 = B) |
| Potards motorisés A à H | CC 20 à 27 en sortie, à la position cible | `hw.subscribe` (le moteur), `hw.pot` (la main) |
| Toucher des potards A à H | CC 30 à 37, 127 touché, 0 lâché | `hw.touch(k, on)` |
| LED de TRK, des scènes, des pas 1 à 8 | l'orange de la machine tant que TRK est tenue (une seule couleur depuis V.4.2) | `hw.getSnapshot().leds` |
| Pads | notes 60 à 67 **retirées** (la face V.4.0 n'a plus de pads) | la note 60 est désormais TRK |

Le sens des CC 20 à 27 en entrée (la main qui tourne) reste à confirmer avec `protocol.js`. Le site n'en dépend pas : le pont appelle `hw.pot(k, valeur)`, quel que soit le message.

## 2. Le port USB du boîtier

`src/v4/hw/port.ts` : `HW_PORT = /MM-RYTM HW/i`, `isHwPort(nom)`.

La couche MIDI générique (`src/v4/midi/midi.ts`, `src/v4/midi/noteout.ts`) ignore tout port dont le nom correspond :
- ses entrées ne sont ni ouvertes ni listées : MIDI LEARN, les assignations apprises, la carte du Roto et les notes vers le MM-ARP ne voient rien de lui ;
- son arrivée ou son départ ne relâche ni ne renvoie rien ;
- le retour des potards motorisés (Roto, appareils appris) et MIDI OUT du MM-ARP n'y envoient jamais rien, ni par défaut ni dans la liste à choisir.

Le pont est donc seul à parler à ce port. Il doit ouvrir son propre accès Web MIDI (ou son propre transport) et appeler les crochets ci-dessous.

## 3. Les crochets (`src/v4/hw/index.ts`)

Rien dans le site n'appelle ces crochets. Seul le debug les expose, sur `window.__v4.hw` avec `?debug=1`. Rien ne démarre à l'import : le premier `subscribe`, `pot` ou `touch` branche le retour sur les potards de la face (`src/v4/rytm/faceKnobs.ts`).

### `resolve(id): MidiTarget | undefined`

C'est la fonction du registre MIDI qu'utilise la couche MIDI (`targetOf` de `src/v4/midi/targets.ts`). Une cible a :
- `kind` : `value` (`get()` et `set(v)`, de 0 à 1), `press` (`down()`) ou `hold` (`down()` puis `up()`) ;
- `steps` : ses crans (0 = continu) ;
- `label` : le nom montré dans MIDI LEARN.

Les cibles de la phase 3, ajoutées sans renommer aucun id existant (les 817 ids de 8661349 sont identiques) :

| Id | Type | Effet |
|---|---|---|
| `rytm:trk` | hold | `down()` enfonce TRK, `up()` la lâche, comme la touche de la face (source `midi` : tenir = momentané, taper = gardé). Au MIDI, une valeur > 0 enfonce et 0 lâche (`gate: 'nonzero'`). |
| `rytm:scene:a`, `rytm:scene:b` | hold | Pareil pour SCENE A et SCENE B. La dernière enfoncée gagne. |
| `rytm:xfade` | value | `set(v)` place le crossfader (passe par `xfadeSet`, source `midi`). Le geste s'ouvre à la première valeur et se ferme 150 ms après la dernière. `get()` lit x. |
| `rytm:voice:select:BD` à `rytm:voice:select:CY` | press | Choisit la voix comme TRK + un pas, sans un son. |

TRK tenue, `resolve('rytm:step:i').down()` pour i de 0 à 7 choisit la voix du pas (BD SD CH OH CP TOM HT CY). C'est le chemin de TRK + pas de la face.

### `getSnapshot(): HwSnapshot`

L'état d'un coup, lu dans les stores à chaque appel. Un objet neuf, sérialisable en JSON :
- `page` : `{ page, tab, screen, view }` (la touche de page, l'onglet retenu, l'écran affiché, `home` ou `page`) ;
- `voice` : la voix choisie (`null` : aucune) ;
- `pattern` : `{ slot, name, next }` (0 à 15, A01 à A16, le pattern qui attend la fin de la mesure ou -1) ;
- `tempo` (BPM) et `running` (RUN) ;
- `sync` et `tempoLabel` : `sync` vaut `true` quand le SYNC du MIXER (MM-DECKS) fait suivre au MM-RYTM la platine MASTER ; `tempo` est alors le sien, au centième (124.37), et le potard B de la page MASTER y revient si on le tourne. `tempoLabel` est le TEMPO tel que l'écran le dit : `124 BPM`, ou `124.4 SYNC` en suivant. Le boîtier peut afficher `tempoLabel` tel quel : il dit la même chose que l'écran, SYNC compris ;
- `knobs` : les 8 potards de la face, chacun avec `k`, `letter`, `label`, `value` (0 à 1, la position du moteur), `bipolar`, `steps`, `state` (`live`, `off`, `picture`, `empty`), `cause` (la dernière : `pot`, `page`, `voice`, `lock`, `scene`, `xfade`, `value`) et `by` (pour `pot`, la source du tour : `hw` pour le potard du boîtier) ;
- `trk` : `{ mode, holders }` (`off`, `held`, `latched`, `closing`) ;
- `scenes` : `{ armed, how, count: { a, b }, x, moving }` ;
- `leds` :
  - `trk` : `{ on, blink, level }` (allumée tant que TRK est engagée, clignote gardée) ;
  - `sceneA`, `sceneB` : `{ on, blink, level }` (la touche allumée quand sa scène est armée, clignote gardée ; le témoin vaut 0 pour une scène vide, sinon 0.15 + 0.85 x ce qu'on en entend) ;
  - `steps` : tant que TRK est engagée, les pas 1 à 8 avec `{ inst, color, level, bar }` (couleur `#RRGGBB`, la même pour les huit depuis V.4.2 : `rytm/faceplate.ts steps.trkColor`, l'orange de la machine ; niveaux de `theme.ts TRK_LIT` : 1 la voix choisie, 0.22 les autres, 0.07 une voix coupée ; barre `mute` ou `solo`) ; `null` quand TRK est éteinte (les pas montrent le motif).
- `presets` : `{ stage, name, keys, face }` tant que les presets du MM-RYTM sont ouverts (V.4.2), `null` sinon. `stage` : `browse` (la liste), `choice` (OVERWRITE ou AS NEW), `confirm` (DELETE?), `name` (le nom) ; `name` : la ligne du curseur (`MIKA/DEEP KICK`) ou le nom en cours ; `keys` : le nom des cinq touches de l'écran sur VOICE, FLTR, ENV, FX et EDIT, dans cet ordre (`LOAD`, `SAVE`, `NAME`, `DEL`, `EXIT`, puis `OVERWRITE`, `YES`, `OK`... ; `''` une touche vide) ; `face` : vrai quand la face les mène (l'écran ne se touche pas) : un potard fait défiler la liste, A choisit la lettre et B déplace le curseur pour nommer, et `hw.pot` le fait aussi. Pendant ce temps, `knobs` garde le `label` et la `value` de la page cachée, mais les moteurs restent sous la main : ni parcourir la liste, ni la fin de la garde d'écho, ni LOAD ne les bougent (le site prend la position rapportée par `hw.pot` comme celle du moteur). À la sortie des presets (EXIT, Échap, l'attente, une autre machine), chaque moteur repart à la valeur de sa page, celle du preset chargé s'il y en a eu un. Un contrôleur MIDI appris sur `rytm:knob:k` avec retour fait de même : pendant les presets, son retour rend la dernière valeur reçue (2026-10-27, la revue : le moteur repartait à la page cachée et le geste suivant faisait sauter la liste).

Le pont lit le snapshot à la connexion, puis à son rythme pour les LEDs. Aucun événement de LED n'existe encore : il pourra s'ajouter quand le format de `protocol.js` sera connu.

### `subscribe((k, value01) => void): () => void`

Le retour vers les moteurs (`src/v4/hw/motor.ts`, pur, horloge injectable). Le potard k (0 à 7, CC 20 + k) doit aller à `value01`. La fonction rendue désabonne. Les règles :
- l'appel part quand la valeur du potard k change pour toute autre cause que ce potard lui-même : un preset, UNDO, une scène, le crossfader, une autre page, une autre voix, le P-LOCK, le MIDI d'un autre appareil (Roto, MIDI LEARN), la souris ;
- au plus 30 appels par seconde et par potard, et la dernière valeur part toujours (un envoi différé la porte) ;
- une case vide ou un dessin : le moteur reste où il est.

### `pot(k, value01)`

Le pont rapporte que la main a tourné le potard k. Le site le prend comme `rytm:knob:k+1` (la page s'affiche, le bloc se règle), avec la source `hw`. Une garde d'écho s'ouvre pour k : pendant 150 ms (refaites à chaque mouvement), rien ne part vers ce moteur. À la fin de la garde, la valeur du site part seulement si elle n'est pas celle du potard, à un demi-cran de 127 près. C'est le cas quand un cran a happé la valeur, ou quand un autre appareil l'a changée pendant la garde.

### `touch(k, on)`

Le potard k est touché (`true`, CC 30 + k à 127) ou lâché (`false`, à 0). Tant qu'il est touché, le site ne le pousse pas : rien ne part vers ce moteur, et son capuchon 3D ne bouge pas non plus (`faceTouch.down(k, 'hw')`). Au lâcher, la dernière valeur part une fois.

### `motorState(k)` (debug)

L'état du retour d'un potard : `latest`, `at` (où le site croit le moteur), `touched`, `guarded`, `pending`, `sends`. `null` tant que rien n'est branché.

## 4. Ce que le pont fera (une fois le dossier poussé)

1. Ouvrir le port `MM-RYTM HW`. La couche générique ne l'ouvre jamais.
2. Entrées :
   - note 60 → `resolve('rytm:trk').down()` / `up()` ;
   - notes 79 et 80 → `rytm:scene:a` et `rytm:scene:b` ;
   - CC 28 → `resolve('rytm:xfade').set(v / 127)` ;
   - les potards → `hw.pot(k, v / 127)` ;
   - CC 30 à 37 → `hw.touch(k, v >= 64)` ;
   - les pas sous TRK → `resolve('rytm:step:i').down()`, ou directement `rytm:voice:select:<voix>`.
3. Sorties :
   - `hw.subscribe((k, v) => CC 20 + k, round(v x 127))` ;
   - les LEDs d'après `hw.getSnapshot().leds`, dans le format de `protocol.js` (couleurs des pas comprises).
4. À la connexion, poser moteurs et LEDs depuis `getSnapshot()`.
5. Tester avec `web/test` en plus de `npm run hw:test`.

## 5. Tester sans boîtier

- `npm run hw:test` : les 16 tests du retour des moteurs (node 22.6 ou plus, sans dépendance ; l'horloge est fausse).
- Dans la page (`?mute=1&debug=1&m=mm808`), sans jamais lancer RUN :

```js
const H = window.__v4.hw;
const off = H.subscribe((k, v) => console.log('moteur', k, v));
H.resolve('rytm:page:fltr').down();   // les moteurs vont aux valeurs de FLTR
H.pot(0, 0.8);                        // la main : aucun écho vers A
H.touch(2, true); H.touch(2, false);  // C : rien pendant le toucher, une fois au lâcher
H.resolve('rytm:trk').down(); H.getSnapshot().leds.steps; H.resolve('rytm:trk').up();
off();
```
