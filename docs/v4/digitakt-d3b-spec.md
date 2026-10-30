# MM-RYTM façon Digitakt, étape D3b : l'enregistrement en direct (FIRMWARE V.5.3)

2026-10-30. Deuxième des trois mises en ligne de D3 (voir `digitakt-d3a-spec.md`). V.5.2 (banques et Control All) est en ligne.

Références : `docs/v4/digitakt-reference.md` (section 3, « Live rec ») et le manuel [M1] (Digitakt OS 1.54, chercher « LIVE RECORDING »). Règles : section 0 de `digitakt-d1-spec.md`.

**Portée : petite.** Le téléphone ne change pas. Pas de refonte de l'horloge.

## 0. Règles

- Ids MIDI intacts, sauvegardes relues, aucun son pendant les tests, aucun tiret cadratin.
- **Identité audio** : sans enregistrement en direct, rien ne change au son (un rendu hors ligne du pattern d'arrivée contre la V.5.2).
- Pour finir : `node scripts/firmware.mjs bump mm808 minor "..."` (V.5.3) et le rapport court `docs/reports/2026-10-30-rytm-v53-digitakt-d3b.md`.

## 1. Entrer et sortir

- **LIVE REC** :
  - au clavier, au MIDI ou au toucher : ● tenue + ▶ ;
  - à la souris, qui ne tient pas deux touches : ● tapée deux fois vite (dans `PAD_DOUBLE_TAP_MS`).
  - Si le manuel [M1] dit autre chose (une double pression sur RECORD, par exemple), suis le manuel et note-le.
- À l'arrêt, LIVE REC s'arme ; la lecture part avec ▶. En lecture, il commence tout de suite.
- **La LED ●** : rouge fixe = grid rec (comme aujourd'hui) ; **rouge clignotant = LIVE REC**, comme la Digitakt.
- L'en-tête de l'écran dit `LIVE REC`.
- **Sortir** :
  - ● tapée une fois : tout l'enregistrement s'éteint ;
  - ■ STOP : fais comme le manuel ; s'il ne dit rien, STOP garde LIVE REC armé.
- MIDI, ajouté à la fin : `rytm:liverec` (appui : entre ou sort).

## 2. Ce qui s'écrit

- **Les pads** :
  - les pas 1 à 8, qui jouent les voix hors REC (D1), et leurs jumeaux au clavier et au MIDI ;
  - en LIVE REC et en lecture, chaque frappe joue la voix tout de suite, comme aujourd'hui, et écrit un trig de cette voix ;
  - la vélocité est celle de la frappe : MIDI, ou HIGH à la souris.
- **Le placement** :
  - au pas le plus proche (quantifié), sur l'heure entendue, c'est-à-dire l'heure du geste moins `outputLatency` + `baseLatency` du contexte audio ;
  - pas de μTIME en D3b : c'est plus simple et plus net. Note dans le rapport ce que fait la Digitakt.
- **Pas de double coup** : si la frappe tombe juste avant son pas (arrondi vers l'avant), ce pas ne rejoue pas la voix à ce passage-ci. On l'entend au passage suivant.
- **Les potards** :
  - tourner un potard d'une page de voix en LIVE REC et en lecture écrit un P-LOCK de la voix choisie sur chaque pas que la tête de lecture traverse pendant qu'on tourne ;
  - fais comme le manuel : sur les pas qui ont un trig de la voix, ou aussi des lock trigs sur les pas vides. Note ce que dit le manuel.
- **Effacer en direct** : NO tenue + un pad efface les trigs de cette voix au fil de la tête de lecture, tant qu'on tient. Au clavier, au MIDI et au toucher seulement ; à la souris, c'est hors portée en D3b.
- **UNDO** : une prise entière, de l'entrée en LIVE REC à la sortie, = une étape d'UNDO.
- Une voix coupée (MUTE) s'enregistre quand même.
- Le Control All de V.5.2 ne s'enregistre pas en direct : TRK tenue gagne, rien ne s'écrit.

## 3. Écran, INFOS, boîtier

- Une carte INFOS « LIVE REC » : en français, tutoiement, sans tiret cadratin, avec un exemple (« tape le kick sur les temps pendant que ça tourne »).
- Le boîtier (`hw/rowLeds.ts`, `hw/snapshot.ts`) : la LED ● clignote en LIVE REC. `npm run hw:test` à jour.
- Les docs MIDI regénérées.

## 4. Vérification

- Les portes : tsc à 13, build, smoke 6 pages, hw:test, presets:test, firmware check.
- **Une sonde muette** (DOM, état, rendu hors ligne ; jamais de son) qui prouve :
  - ● tenue + ▶ au clavier : LIVE REC, la lecture part, la LED clignote ;
  - ● deux fois à la souris : LIVE REC ;
  - une frappe simulée de SD juste après le pas 5 s'écrit au pas 5 ; juste avant le pas 9, au pas 9, sans double coup à ce passage (le compteur de coups de l'horloge) ;
  - un potard FLTR FREQ tourné pendant 4 pas écrit des P-LOCKs sur ces pas ;
  - NO tenue + pad BD efface les BD au fil de la lecture ;
  - une prise = une étape d'UNDO ;
  - sans LIVE REC, rien ne s'écrit et rien ne change au son.
