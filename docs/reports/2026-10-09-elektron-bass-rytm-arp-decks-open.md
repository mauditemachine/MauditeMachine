# 2026-10-09 - Machines Elektron (MM-BASS, MM-RYTM), grand écran du MM-ARP, SYNC des DECKS, OPEN plus fin

Session du 2026-10-08 au 2026-10-09. Le message de Mika : SYNC qui retarde le PLAY d'une demi-seconde et un bouton retour vers les morceaux ; des P-locks « comme une Elektron » sur le MM-BASS et le MM-RYTM (choisir la page, tourner un encodeur sur un pas, valeurs 0-127 à l'écran, voir le changement quand le séquenceur passe) ; « je ne vois AUCUN changement » sur le MM-RYTM ; ses samples BD et SD et des voix sample + synthé façon Analog Rytm ; un OPEN plus fin ; le bouton « i » dans l'écran ; le même écran pour l'ARP ; tout utilisable au téléphone.

Méthode : un cahier des charges commun (le « contrat Elektron », partagé par le BASS et le RYTM), puis un chantier par machine dans son propre worktree, chacun construit, relu par deux relecteurs (bugs et régressions ; respect de la demande, ordi et téléphone) puis corrigé ; fusion, contrôle de types, build de prod et test d'ensemble avant chaque mise en ligne. Aucun son n'a été joué pendant les tests (Chromium muet, `?mute=1`, rendus hors ligne).

## Ce qui a été fait

- **DECKS** (src/v4/dj/*, déployé)
  - **PLAY immédiat avec SYNC** : la cause était `syncedStart()`, qui faisait attendre le prochain temps de la référence, de 81 à 466 ms. PLAY part maintenant en 5,8 ms. La tête de lecture se place d'au plus un demi-temps, et les départs et sauts sont fondus sur 3 ms.
  - **Analyse des morceaux** réécrite dans un worker (`dj/grid.ts`, `dj/grid.worker.ts`) :
    - le BPM au millième et le premier temps à moins de 2 ms (36 morceaux de test sur 36, contre 20 avant) ;
    - le BPM des tags est gardé quand le son le confirme ;
    - la caisse ne remplace plus un tag.
  - **Verrou de phase** en lecture : un petit coup de vitesse de 0,3 % au plus, jamais de saut. Un repère de phase est affiché dans le jog.
  - **Bouton < TRACKS** sur l'écran de la platine : la liste s'ouvre sans couper le morceau, et une ligne « en lecture » ramène à la platine. Charger un morceau sur une platine qui joue demande un second appui.
- **MM-BASS** (src/v4/bass/*, déployé)
  - **Face** : un écran deux fois plus grand, 8 encodeurs A-H en 2x4, et des touches VOICE / FILTER / ENV / FX.
  - **Écran** : vue PAGE permanente, avec les valeurs de 0 à 127, l'unité et un dessin par bloc.
  - **P-lock** :
    - on maintient un pas, ou on clique son LOCK ; au téléphone, deux doigts suffisent ;
    - le bloc verrouillé s'inverse ;
    - en lecture, les blocs du pas joué s'allument avec la valeur verrouillée.
  - **EDIT** : la ligne de notes, les couloirs de verrous avec leurs valeurs, et les 16 patterns.
  - **Son** : PW, KEY TRK, une vraie enveloppe ADSR, un DELAY ping-pong et une REVERB propres au BASS. Au réglage par défaut, le son est identique à l'échantillon près.
  - **Bouton « i »** dans l'écran.
  - **MIDI** : `bass:knob:1..8`, `bass:page:*`, `bass:key:i`.
- **MM-ARP** (src/v4/voyager/*, déployé)
  - **Grand écran** dans la même famille que les autres (`voyager/screen.ts`, `preview.ts`, `echo.ts`), avec la face réorganisée pour lui faire de la place.
  - **Contenu** : l'accord, l'échelle des notes de l'arpège qui défile, la bande des 8 accords, et le potard touché en 0-127 avec son dessin.
  - **Bouton « i »** et fiches en français (`state/voyInfos.ts`, `voyager/InfosCard.tsx`, `infos.ts`, `diagrams.ts`).
  - **Téléphone** : l'écran prend presque toute la largeur.
- **MM-RYTM** (déployé en deux fois)
  - **Face Digitakt** :
    - 8 encodeurs sous l'écran, 6 touches TRIG / SRC / SMPL / FLTR / AMP / FX (`scene/rytmPageKeys.ts`) ;
    - la vue PAGE est l'écran permanent, en 0-127 ;
    - les rangées GLOBAL FX et VOICE FX sont passées dans les pages, le transport sous les pads ;
    - un onglet PAGES dans le Dock.
  - **P-locks** (`audio/locks.ts`, `state/rytmLock.ts`) :
    - on maintient un pas 350 ms, ou on utilise deux doigts ;
    - verrouillables : VEL, SOUND/SAMPLE, TUNE, START, DEC, PAN, VOL, les réglages du kit et les envois FX ;
    - en lecture, les blocs du pas joué s'allument ; les pas verrouillés luisent et le pas en LOCK clignote.
  - **Couches SYNTH + SAMPLE façon Analog Rytm** :
    - SRC règle la couche synthé (MACHINE 909/808/MM, ses réglages, LEVEL) ;
    - SMPL règle la couche sample (TUNE, FINE, REV, SAMPLE, START, LEN, LEVEL) ;
    - les deux couches sont rendues ensemble, avec un niveau maîtrisé ;
    - nouveaux réglages : SWEEP sur BD ; TUNE, DECAY et TONE sur SD ;
    - par défaut, BD et SD jouent les samples de Mika (01 BluePrint, 01 Psy 02), et les anciens kits sont migrés.
  - **Bouton « i » et fiches** : 88 fiches en français (`state/rytmInfos.ts`, `rytm/InfosCard.tsx`, `rytm/infos.ts`, `rytm/diagrams.ts`).
- **OPEN** (src/v4/scene/tweakplate.ts, tweaklayout.ts, pcb.ts, rytmTweaks.ts, bass/tweaks.ts, voyager/tweaks.ts, déployé)
  - Plus de plaque noire : petits potards de précision, glissières et sélecteurs posés sur le PCB, avec une sérigraphie fine (graduations, repères RV/SW, cadres de groupe, cartouche).
  - Cadrage moins zoomé : toute la carte est visible, sans passer sous l'en-tête.
  - Touches CLOSE, INFOS et SCOPE plus fines ; une touche INFOS dans l'OPEN de l'ARP.
- **Samples** : `scripts/import-rytm-samples.mjs` devient générique. Il prend tous les fichiers du dossier, reconnaît la famille par dossier ou par nom, et accepte `--replace`, `--dry` et `--families`.
- **Docs** : docs/v4/spec.md R14-222 à R14-230, docs/midi régénéré (556 cibles).

## Décisions prises et pourquoi

- **SYNC réparé plutôt que coupé** : PLAY part tout de suite et c'est la position qui se cale, comme sur une CDJ avec Beat Sync. Partir d'un cue posé sur un temps peut donc commencer jusqu'à un demi-temps à côté du cue ; c'est le prix d'un départ instantané.
- **Le même contrat pour le BASS et le RYTM**, pour que les deux machines aient l'air de venir de la même marque : pages et 8 encodeurs, 0-127 à l'écran, maintien d'un pas = LOCK, double-clic = enlever le verrou, CLEAR = tout le pas, les réglages globaux refusés avec un message.
- **MM-BASS**
  - La rangée LOCK au-dessus des pas est gardée, puisque Mika l'avait demandée le 2026-10-07.
  - Le delay et la reverb sont internes au BASS (voie 2 du MIXER), avec des envois à 0 par défaut, donc le son par défaut ne change pas.
- **MM-RYTM**
  - SMPL remplace LFO dans l'ordre Analog Rytm.
  - DIST, CHORUS et TONE de la voix ne sont pas encore verrouillables : ils agissent sur toute la voie et demandent une automation planifiée.
  - Les couches sont par famille (CH et OH partagent la leur, de même que TOM et HT), comme le choix de son avant.
  - Un kit sauvegardé encore sur l'ancien défaut intact (BD 909, SD MM) passe aux samples de Mika, à cause de « change les tout de suite ».
- **OPEN** : les mises en page sont devenues des données, pour que la refonte du RYTM change les commandes sans toucher au dessin. La plaque du BASS garde sa rangée VOICE, en double avec les pages, en attendant l'avis de Mika.
- **Roto-Control** : les setups ne changent pas cette fois (aucun réimport nécessaire). Les nouvelles cibles s'apprennent par MIDI LEARN. Le séquenceur sur le Roto est la prochaine étape, validée en principe par Mika.

## Ce qui reste à faire / points en suspens

- **À faire par Mika**
  - Lancer `npm run samples:import -- "/Users/mauditemachine/Desktop/Samples" --replace` sur son Mac, puis `git add public/samples/rytm && git commit && git push`. Claude n'a pas accès à son Mac. `--dry` montre le plan avant d'écrire.
  - Écouter, puisqu'aucun son n'est joué pendant les tests :
    - le delay et la reverb du BASS à fond ;
    - les couches synthé + sample du kick ;
    - le clignotement du LOCK et l'éclair en lecture, en vrai.
- **Ses questions en attente**
  - BASS : une 5e page TRIG ? Les réglages globaux en LOCK : refusés, ou changer la valeur globale ?
  - RYTM : 350 ms pour entrer en LOCK ; un pas vide verrouillé qui reçoit un coup VEL 9 ; PAN à +3 dB au bord ; le sélecteur de son de la plaque qui ne garde qu'une couche.
  - ARP : la place de RUN/STOP dans le bloc de droite.
  - OPEN : faut-il encore moins de zoom ?
  - DECKS : un repère de phase plus visible ?
- **Prochaine étape** : le séquenceur sur le Roto-Control (8 boutons = 8 pas avec une lumière qui défile, tenir + tourner = P-lock), à faire avec un test des voyants sur l'appareil de Mika.
- **Plus tard pour le RYTM** :
  - verrous de DIST, CHORUS et TONE ;
  - page LFO, LOOP et BR dans SMPL ;
  - PROB, MICRO, COND et RTRG dans TRIG ;
  - des couches par voix et non par famille.
- **Toujours en attente** : #72 (visiteurs connectés dans le MENU) ; la clé SoundCloud du Worker sonaa-sets (il répond 503).

## Commandes utiles ajoutées

- `npm run samples:import -- "<dossier>" [--replace] [--dry] [--families bd,sd]` : importe tous les samples d'un dossier dans public/samples/rytm/<famille>/.
- `npm run docs:midi` : régénère docs/midi (556 cibles, dont `rytm:knob:1..8`, `rytm:page:*`, `rytm:lock*`, `rytm:infos`, `bass:knob:1..8`, `bass:page:*`, `voy:infos`).
- Clavier :
  - RYTM : H (vue HOME), [ et ] (pages), L (LOCK), I (INFOS) ;
  - BASS : [ et ] (pages) ;
  - ARP : I (INFOS) ;
  - DECKS : Retour arrière (liste des morceaux de la dernière platine touchée).
- Débogage : `window.__v4.dj.phaseErrMs` (écart de phase des platines).
