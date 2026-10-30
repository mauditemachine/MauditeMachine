# MM-RYTM façon Digitakt, étape D3b : l'enregistrement en direct (FIRMWARE V.5.3)

2026-10-30. Le cahier : `docs/v4/digitakt-d3b-spec.md` (53251ad). Point de départ : V.5.2 (a0b6c27). Branche `worktree-agent-a3f84c671ac17ce70`, rien de poussé. La relecture de 8ecf09d (16 points, 11 sans les doublons) est corrigée dans la même version, V.5.3 (empreinte reposée).

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
- **Les frappes** (`padHit`, `stepPlay`, `stepToggle`) : les pas 1 à 8, les touches A S D F Z X C V et les pads MIDI jouent leur voix tout de suite, la choisissent et s'écrivent au pas le plus proche de l'heure entendue (`currentTime` moins `outputLatency` + `baseLatency`), dans le pattern qu'on entend. La vélocité est celle de la note MIDI (`state/ctl.ts pressVel`, posée par `midi/midi.ts`), sinon HIGH. À la souris et au toucher, un pas part à l'appui (`ui/Hotspots.tsx`), à l'heure de l'événement.
- **Pas de double coup** (`audio/clock.ts`) :
  - `nearestAt(t)` trouve le pas programmé le plus proche ;
  - `skipHit(voix, abs)` empêche ce pas de rejouer la voix à ce passage ;
  - `StepEvent.abs` donne la position du pas, `StepEvent.slot` le pattern qui l'a joué (`clock.slotOf`, posé par `state/patterns.ts`).
- **Les potards** : en lecture, un potard d'une page de voix règle la voix comme avant et écrit un P-LOCK sur le pas entendu, puis sur chaque pas que la tête traverse tant qu'on le tourne (220 ms) ou qu'on le tient. Seulement lui, sur sa page et sa voix. Un pas vide reçoit un lock trig. TRK tenue (CONTROL ALL) gagne : rien ne s'écrit.
- **L'effacement** : NO tenue (Échap tenue au clavier, ou un doigt sur NO) + un pad efface la voix au fil de la tête, tant qu'on tient les deux. NO n'agit alors qu'au lâcher, et seulement s'il n'a rien effacé.
- **L'UNDO** (`state/undo.ts`) : une prise fait une étape par pattern touché, au plus. Défaire celle d'un autre pattern de la chaîne le rend sans le choisir (`patterns.restoreSlot`), la chaîne continue. `undo.hold` est devenu un compte, pour que CONTROL ALL et une prise puissent se tenir ensemble.
- **MIDI** : `rytm:rec` devient une cible tenue (même id) : tenue + `rytm:play`, LIVE REC.
- **L'écran et les LED** : la pastille `LIVE REC` dans l'en-tête (vue PAGE et HOME). La LED de ● clignote, sur la face (`scene/rytmFaceKeys.ts`) et sur le boîtier (`hw/rowLeds.ts` `live`, `hw/snapshot.ts`), avec un test dans `scripts/hw-leds.test.mjs`.
- **INFOS** : la carte LIVE REC (au survol de ● pendant LIVE REC), et une phrase dans la carte ●. Elle dit maintenant : la frappe choisit sa voix et va dans le pattern entendu, pas de doublon sur un pas qui a la voix, un UNDO par pattern touché, TRK + un pad choisit sans écrire.
- **Le reste** : `docs/midi` régénéré (892 cibles, `rytm:rec` tenue) ; `__v4.rytm.live` (`hit`, `on`) pour les sondes ; FIRMWARE V.5.3.

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
- **La relecture de 8ecf09d**, un point par ligne (les doublons ensemble) :
  - **R1 R14** : en LIVE REC, un pas 1 à 8 est un pad : il part à l'appui, sans minuterie de P-LOCK, sans glisser de vélocité ni tape au lâcher. `rytmLockEnter` refuse en LIVE REC (sauf le Dock et le RSEQ du Roto), `stepVelocity` aussi, et `pageDial` ignore un pas tenu.
  - **R2 R11** : le potard retient son numéro sur la face, sa page et sa voix. Il écrit tant qu'on le tourne (220 ms) ou qu'on le tient, lui et pas un autre, sur sa page et sa voix, jamais sous CONTROL ALL. Tout autre chemin de `pageDial` (une scène armée, P-LOCK, CONTROL ALL, un bloc qui ne se verrouille pas) l'efface.
  - **R3 R13** : la frappe part au pointerdown ; son heure est celle de l'événement (`e.timeStamp`, 250 ms d'âge au plus retirés de l'heure entendue).
  - **R4 R16** : la frappe choisit sa voix sans dire KNOBS > (l'écran garde LIVE REC SD STEP 06) ; TRK engagée + un pad (clavier, MIDI) choisit la voix et n'écrit rien. Le rapport le disait déjà, le code le fait maintenant.
  - **R5** : le double appui ne vaut qu'à la souris, et seulement si la première tape a allumé REC depuis REC éteint. Sortir de LIVE REC le désarme. W, le jumeau et le MIDI ne le font jamais.
  - **R6** : `rytm:rec` devient une cible tenue, même id : un mapping existant fait toujours REC à l'appui, et tenue + `rytm:play` entre en LIVE REC.
  - **R7** : ● et NO prennent leur pointeur à l'orbite, comme FUNC, TRK et YES.
  - **R8 R15** : l'effacement s'arrête quand la fenêtre perd le clavier (`liveEraseAll` dans `onBlur`) et dès que plus aucune NO n'est tenue (`noUp`, et `livePoll` le vérifie à chaque pas).
  - **R9** : chaque pas programmé retient son pattern (`StepEvent.slot`) ; la frappe, le P-LOCK et l'effacement vont dans celui du pas entendu, au besoin dans un emplacement qui n'est pas le courant (`patterns.writeSlot`). Arrondie au pas 1 d'un autre pattern (une chaîne, un pattern qui attend), la frappe reste sur le dernier pas entendu du pattern qu'on entend, le pas 16 d'ordinaire : c'est le plus simple, et rien ne s'écrit dans un pattern pas encore entendu. Un pattern seul qui boucle garde l'arrondi au pas 1.
  - **R10** : un pas qui joue déjà la voix à ce passage (son masque au journal, programmé ou déjà parti) la joue seul : la frappe ne sonne pas en plus, elle s'écrit quand même (sa vélocité aussi). Avant le pas, on l'entend donc au plus un demi-pas plus tard, à l'heure de la grille. Annuler le coup programmé n'est pas retenu : une voix annulée hors de l'ordre casse les étouffements du kick et des charleys, et un coup à moins d'un quantum ne s'annule plus.
  - **R12** : pendant une prise, `undo` garde l'étape de chaque emplacement touché ; y revenir reprend la même (`undo.slotEdit` pour un emplacement qui n'est pas le courant). UNDO d'un autre pattern de la chaîne le rend sur place, la chaîne continue (l'écran dit `UNDO A01`).

## 3. Ce qui reste à faire / points en suspens

- **Mika** : essayer ● tenue + ▶ (ou ● deux fois), taper le kick pendant que ça tourne, tourner FREQ, puis Échap tenue + A.
- **La quantification facultative** (frappes en μTIME, comme la Digitakt) : pour une étape d'après, si tu la veux.
- **NO tenue au MIDI** : une cible tenue à part (par exemple `rytm:no:hold`), si le contrôleur en a besoin.
- **Le RSEQ du Roto en LIVE REC** : ses pas écrivent toujours la grille comme en grid rec (le chemin du Dock), ce ne sont pas des pads.
- **Un potard tenu sans bouger** écrit encore sa valeur sur les pas traversés, comme la relecture le propose ; si tu préfères « seulement quand il bouge », on retire la tenue.
- **La latence** vient de `outputLatency` + `baseLatency` du navigateur ; certains navigateurs en donnent une estimation grossière.

## 4. Commandes utiles ajoutées

- MIDI : `rytm:liverec` (appui : entre ou sort) ; `rytm:rec` est tenue (tenue + `rytm:play` : LIVE REC).
- Debug : `__v4.rytm.live.hit(voix, vélocité, heureEntendue)` (rend `play`, `quiet` ou `null`), `__v4.rytm.live.on()`, `__v4.rytm.dtFace.live()`, `__v4.clock.scheduled[i].abs` et `.slot`.
- Les sondes, hors du dépôt : `scratchpad/d3/t/lr.cjs` (D3b), `scratchpad/d3/t/rv3.cjs` (la relecture, 18 vérifications).

## Vérification (copie propre)

Aucun son : Chromium `--mute-audio`, `?mute=1`. La lecture est muette ; les sondes lisent le journal de l'horloge, l'état, le boîtier, et comptent les départs immédiats des sources (`AudioBufferSourceNode.start`), jamais une écoute.

- tsc : 13 erreurs, les mêmes qu'avant. Build OK. Smoke : `6 pages, aucune erreur`. hw:test : 17 + 11 tests, tous bons. presets:test : 12 + 5, tous bons. Firmware : `stamp` puis `check`, MM-RYTM V.5.3 (211 fichiers), MM-ARP V.2.3, MM-BASS V.3.0.
- **L'identité audio** : le pattern d'arrivée (une mesure et quatre) contre la V.5.2 : écart 0.
- **La relecture, `rv3.cjs`** : 18 sur 18 après les corrections, 3 sur 18 sur 8ecf09d (la sonde voit donc les défauts). Les 3 qui passent sur 8ecf09d : R2, faussé là par le P-LOCK que la tenue de R1 y laisse (seul, sur un état propre, `r2.cjs` y échoue : 10 verrous, puis 24 sous RESO tenu ; ici 1 sur 1), la voix absente de R10 (le témoin) et le deuxième de R12 (rien n'y était écrit).
  - R1 R14 : 550 ms tenues sur le pas 2 : P-LOCK -1, BD vide, SD au pas de l'appui (5 ; le lâcher était au pas 10). Un appui glissé de 12 px sur le pas 4 : OH une fois, aucune autre rangée.
  - R3 R13 : un clic de 110 ms : CH au pas de l'appui (12), pas à celui du lâcher (13).
  - R4 R16 : la frappe choisit SD ; TRK tenue + CP au MIDI, puis X au clavier : CP puis TOM choisis, le motif inchangé.
  - R2 R11 : FREQ tourné : 8 verrous ; RESO tenu 1,2 s, CONTROL ALL 600 ms, RESO tenu encore 1 s : toujours 8.
  - R8 R15 : Échap + A, la fenêtre perd le clavier : 5 BD effacés, 5 encore 800 ms après ; NO lâchée, A tenue : 5, puis 5.
  - R10 : BD sur toute la rangée, la frappe 20 à 30 ms avant le pas (4 fois) et 10 à 25 ms après (2 fois) : 0 départ immédiat, le pas programmé la joue (6 sur 6). SD, absente du pas : 1 départ immédiat, le pas ne la rejoue pas.
  - R9 : A01 > A02, la frappe entendue au pas 15 de A01 quand A02 est déjà le courant : A01 SD `0000000000000090`, A02 vide. Arrondie au pas 1 de A02 : au pas 16 de A01 (`0000000000000009`), A02 vide.
  - R12 : trois frappes sur trois mesures (A01, A02, A01) : 2 étapes d'UNDO ; deux UNDO en lecture : A01 et A02 vides, la chaîne reste `0,1`, la lecture continue.
  - R5 : à la souris, deux clics depuis REC éteint : LIVE REC ; deux clics en LIVE REC : grid rec, puis tout éteint. W deux fois vite, `rytm:rec` deux fois vite : REC puis rien, jamais LIVE REC.
  - R6 : `rytm:rec` (cible `hold`) tenue + `rytm:play` : LIVE REC, la lecture part.
  - R7 : au toucher (deux doigts, `Input.dispatchTouchEvent`), ● tenue + ▶ depuis l'arrêt : LIVE REC, la lecture part.
- **La sonde `lr.cjs`** (rejouée sur la version corrigée) : 9 sur 9, aucune erreur de page.
  - Sans LIVE REC, une frappe ne s'écrit pas (SD reste vide).
  - W tenue + Espace : LIVE REC, la lecture part, la LED de ● est à `1 blink`, l'en-tête dit `LIVE REC`. STOP éteint LIVE REC, REC et la lecture.
  - ● deux fois à la souris : LIVE REC armé (LED `1 blink`, à l'arrêt), puis PLAY lance la lecture et LIVE REC reste.
  - SD juste après le pas 5 s'écrit au pas 5, et juste avant le pas 9 au pas 9 (`0000900090000000`). Le pas 9 de ce passage n'a pas SD au journal, celui du passage suivant l'a.
  - FREQ tourné pendant 16 x 40 ms : des P-LOCKs sur 6 pas (8 à 13), un sur un trig, des lock trigs sur les 5 pas vides (d'autres passages : 7 pas).
  - Échap tenue + A pendant 900 ms : 7 BD effacés au fil de la lecture (`6666666666666666` devient `0000006666666660`), LIVE REC et la lecture continuent.
  - Une prise : une étape d'UNDO (1 vers 2), qui rend BD et SD vides et aucun verrou.
- **Le téléphone** (`?portrait=1`, au repos) : identique à la V.5.2, sauf le texte FIRMWARE V.5.3 (528 et 615 pixels, dans 102 x 9).
