# MM-RYTM façon Digitakt, étape D3b : l'enregistrement en direct (FIRMWARE V.5.3)

2026-10-30. Le cahier : `docs/v4/digitakt-d3b-spec.md` (53251ad). Point de départ : V.5.2 (a0b6c27). Branche `worktree-agent-a3f84c671ac17ce70`, rien de poussé.

## 1. Ce qui a été fait

- **LIVE REC** (`actions.ts`, `state/dtFace.ts` : `live`) :
  - entrer :
    - ● tenue + ▶ (deux doigts, ou W tenue + Espace) ;
    - ● deux fois vite (dans `PAD_DOUBLE_TAP_MS`, la souris) ;
    - MIDI `rytm:liverec`, ajoutée à la fin ;
    - à l'arrêt, LIVE REC s'arme, et ▶ lance la lecture ;
  - sortir :
    - ▶ en lecture (la lecture continue) ;
    - ● (retour au grid rec) ;
    - ■ (tout s'arrête).
- **Les frappes** (`padHit`, `stepPlay`, `stepToggle`) : les pas 1 à 8, les touches A S D F Z X C V et les pads MIDI jouent leur voix tout de suite et s'écrivent au pas le plus proche de l'heure entendue (`currentTime` moins `outputLatency` + `baseLatency`). La vélocité est celle de la note MIDI (`state/ctl.ts pressVel`, posée par `midi/midi.ts`), sinon HIGH.
- **Pas de double coup** (`audio/clock.ts`) :
  - `nearestAt(t)` trouve le pas programmé le plus proche ;
  - `skipHit(voix, abs)` empêche ce pas de rejouer la voix à ce passage ;
  - `StepEvent.abs` donne la position du pas.
- **Les potards** : en lecture, un potard d'une page de voix règle la voix comme avant et écrit un P-LOCK sur le pas entendu, puis sur chaque pas que la tête traverse tant qu'on tourne (220 ms) ou qu'on tient le potard. Un pas vide reçoit un lock trig. TRK tenue (CONTROL ALL) gagne : rien ne s'écrit.
- **L'effacement** : NO tenue (Échap tenue au clavier, ou un doigt sur NO) + un pad efface la voix au fil de la tête, tant qu'on tient. NO n'agit alors qu'au lâcher, et seulement s'il n'a rien effacé.
- **L'UNDO** : une prise entière, de l'entrée à la sortie, fait une seule étape. `undo.hold` est devenu un compte, pour que CONTROL ALL et une prise puissent se tenir ensemble.
- **L'écran et les LED** : la pastille `LIVE REC` dans l'en-tête (vue PAGE et HOME). La LED de ● clignote, sur la face (`scene/rytmFaceKeys.ts`) et sur le boîtier (`hw/rowLeds.ts` `live`, `hw/snapshot.ts`), avec un test dans `scripts/hw-leds.test.mjs`.
- **INFOS** : la carte LIVE REC (au survol de ● pendant LIVE REC), et une phrase dans la carte ●.
- **Le reste** : `docs/midi` régénéré (892 cibles) ; `__v4.rytm.live` (`hit`, `on`) pour les sondes ; FIRMWARE V.5.3.

## 2. Décisions prises et pourquoi

- **Ce que dit le manuel** ([M1], OS 1.54, 10.2.3 LIVE RECORDING MODE, p. 33, et 10.9.1 PARAMETER LOCKS, p. 38) :
  - entrer : « Press and hold [RECORD], then press [PLAY] to enter LIVE RECORDING mode […] The sequencer starts to play, and the [RECORD] key starts to flash red. » ;
  - [PLAY] deux fois en tenant [RECORD] active ou coupe la quantification automatique ;
  - sortir : « Press [PLAY] to exit LIVE RECORDING mode while keeping the sequencer playing. If LIVE RECORDING mode is active and [RECORD] is pressed, GRID RECORDING mode will be activated. » ;
  - STOP : « Press [STOP] to stop both recording and playback of the sequencer. » ;
  - les potards : « Any changes to PARAMETER page settings […] will be recorded as parameter locks and add lock trigs where needed. » 10.9.1 précise : « it also places lock trigs that contains the parameter locks on the sequencer steps that do not already have any trigs » ;
  - effacer : « Press [NO] + one (or several) of the [TRIG] keys to erase a sequence of recorded trigs […] in time with the sequencer ».
- **Fait comme le manuel, écarts au cahier** :
  - ● en LIVE REC repasse en grid rec, au lieu de tout éteindre ;
  - ■ arrête l'enregistrement et la lecture, au lieu de garder LIVE REC armé ;
  - ▶ en lecture sort de LIVE REC et la lecture continue ;
  - les potards posent des lock trigs sur les pas vides.
- **Ce que fait la Digitakt pour le placement** : la quantification automatique est un choix (RECORD + PLAY deux fois). Non quantifiée, une frappe garde son décalage, en μTIME, et le menu QUANTIZE (FUNC + TRIG) peut la ranger plus tard. Ici, comme le cahier le demande, tout est quantifié au pas le plus proche, sans μTIME.
- **● deux fois à la souris** : un ajout du cahier, que le manuel ne connaît pas (la souris ne tient pas deux touches). La première tape fait son effet de toujours (REC allumé ou éteint), la seconde entre en LIVE REC.
- **Le potard règle aussi la voix**, en plus du P-LOCK : on l'entend tout de suite entre deux pas, et la molette, les flèches et le MIDI relatif continuent de partir de la valeur du moment.
- **Une frappe choisit aussi la voix**, comme un pas hors REC depuis D1. Le potard verrouille ensuite la dernière voix frappée.
- **Le double coup** : la frappe arrondie vers l'avant est retenue pour ce pas et ce passage (`skipHit`). Le pas reprogrammé ne rejoue pas la voix ; au passage suivant, elle joue.
- **L'effacement au MIDI n'est pas fait** (écart) : `rytm:no` est un appui, pas une tenue, et changer son genre changerait les mappings existants. Au clavier (Échap tenue) et au toucher, oui ; à la souris, hors portée comme le dit le cahier.

## 3. Ce qui reste à faire / points en suspens

- **Mika** : essayer ● tenue + ▶ (ou ● deux fois), taper le kick pendant que ça tourne, tourner FREQ, puis Échap tenue + A.
- **La quantification facultative** (frappes en μTIME, comme la Digitakt) : pour une étape d'après, si tu la veux.
- **NO tenue au MIDI** : une cible tenue à part (par exemple `rytm:no:hold`), si le contrôleur en a besoin.
- **La latence** vient de `outputLatency` + `baseLatency` du navigateur ; certains navigateurs en donnent une estimation grossière.

## 4. Commandes utiles ajoutées

- MIDI : `rytm:liverec` (appui : entre ou sort).
- Debug : `__v4.rytm.live.hit(voix, vélocité, heureEntendue)`, `__v4.rytm.live.on()`, `__v4.rytm.dtFace.live()`, `__v4.clock.scheduled[i].abs`.
- La sonde, hors du dépôt : `scratchpad/d3/t/lr.cjs`.

## Vérification (copie propre, `git archive`)

Aucun son : Chromium `--mute-audio`, `?mute=1`. La lecture est muette ; la sonde lit le journal de l'horloge, l'état et le boîtier.

- tsc : 13 erreurs, les mêmes qu'avant. Build OK. Smoke : `6 pages, aucune erreur`. hw:test : 17 + 11 tests, tous bons. presets:test : 12 + 5, tous bons. Firmware check : MM-RYTM V.5.3 (211 fichiers), MM-ARP V.2.3, MM-BASS V.3.0.
- **L'identité audio** : le pattern d'arrivée (une mesure et quatre) contre la V.5.2 donne un écart de 1,2e-7, autant que la V.5.2 contre elle-même.
- **La sonde `lr.cjs`** : 9 sur 9, aucune erreur de page.
  - Sans LIVE REC, une frappe ne s'écrit pas (SD reste vide).
  - W tenue + Espace : LIVE REC, la lecture part, la LED de ● est à `1 blink`, l'en-tête dit `LIVE REC`. STOP éteint LIVE REC, REC et la lecture.
  - ● deux fois à la souris : LIVE REC armé (LED `1 blink`, à l'arrêt), puis PLAY lance la lecture et LIVE REC reste.
  - SD juste après le pas 5 s'écrit au pas 5, et juste avant le pas 9 au pas 9 (`0000900090000000`). Le pas 9 de ce passage n'a pas SD au journal, celui du passage suivant l'a.
  - FREQ tourné pendant 16 x 40 ms : des P-LOCKs sur 7 pas (8 à 14), un sur un trig, des lock trigs sur les 6 pas vides.
  - Échap tenue + A pendant 900 ms : 7 BD effacés au fil de la lecture (`6666666666666666` devient `0000006666666660`), LIVE REC et la lecture continuent.
  - Une prise : une étape d'UNDO (1 vers 2), qui rend BD et SD vides et aucun verrou.
- **Le téléphone** (`?portrait=1`, au repos) : identique à la V.5.2, sauf le texte FIRMWARE V.5.3.
