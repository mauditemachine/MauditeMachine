# MM-RYTM façon Digitakt, étape D2 : le séquenceur (FIRMWARE V.5.1)

2026-10-29. Le cahier : `docs/v4/digitakt-d2-spec.md` (4d169d1), Mika : « ok fonce sur l'étape 2 ». Point de départ : V.5.0 (D1), en ligne à fd92700. Branche `worktree-agent-a3f84c671ac17ce70`, rien de poussé.

## 1. Ce qui a été fait

### Le modèle (`audio/trig.ts`, `audio/lfo.ts`, `audio/voicefx.ts`, `audio/locks.ts`, `audio/pattern.ts`, `state/patterns.ts`, `state/presets.ts`, `state/undo.ts`, `actions.ts`)

- `audio/trig.ts` (nouveau, pur) : les réglages de trig `len prob cond utime lfot rtrg rate vfad rlen`, des entiers (le rang du cran). La liste des 81 conditions dans l'ordre du potard (NONE ; FILL, !FILL ; PRE, !PRE ; NEI, !NEI ; 1ST, !1ST ; LST, !LST ; A:B pour B de 2 à 8 ; puis les !A:B), leur évaluation, les textes de l'écran, la vélocité des répétitions (VFAD), un générateur à part pour PROB.
- `audio/lfo.ts` (nouveau, pur) : les deux LFO de chaque voix, `l1spd` à `l2dep` (SPD, MULT, FADE, DEST, WAVE, PHAS, MODE, DEP), leur valeur en temps musical (un cycle dure 128 / (|SPD| x MULT) pas), les modes FRE TRG HLD ONE HLF, FADE.
- Les réglages de trig par défaut de chaque voix sont rangés avec le pattern (`pattern.trigs`, et par emplacement dans `state/patterns.ts` : A01 a les siens). Les LFO sont des réglages de voix facultatifs (`voicefx`). Chacun est absent à sa valeur de départ : stockage, presets, UNDO et empreintes d'avant inchangés.
- Les verrous acceptent les nouvelles clés, et `ltrg` (le lock trig). `hitLock` les retire du coup : un pas qui n'a que des verrous de séquenceur joue exactement le coup d'avant.
- Ils voyagent avec les presets (capture, apply, `rytmNow`), l'UNDO (la part de l'emplacement), COPY et PASTE (le pattern, la ligne d'une voix), CLEAR du pattern et de la ligne (remis au départ), le point de sauvegarde (TRIG puis NO, MOD puis NO).

### Le moteur (`audio/seq.ts`, `audio/seqhit.ts`, `audio/drums.ts`, `audio/clock.ts`, `state/fill.ts`)

- `audio/seq.ts` (nouveau, pur) : un pas, voix par voix dans l'ordre des pads, le **même** calcul pour l'horloge et pour `renderOffline`. Au départ, il rend exactement la boucle d'avant : un coup par pas à vélocité, à l'heure du pas, avec ses verrous.
- COND passe avant PROB. PRE et NEI lisent le dernier résultat évalué, une PROB tirée comprise ; BD n'a pas de voisine. PROB tire dans son propre générateur : jamais `Math.random`, que le rendu hors ligne fixe pour la rotation des variantes.
- μTIME décale l'heure du coup de n/24 de pas.
- RTRG : les répétitions à RATE pendant RLEN, une fenêtre de pas à la fois. Chaque répétition est un coup de la même voix, avec les mêmes verrous et la vélocité menée par VFAD. Elle coupe la précédente en 8 ms : une voix, un coup à la fois. Elles s'arrêtent au trig suivant qui joue, à la fin de RLEN ou au mute de la voix. Les chokes OH/CH et le kick mono restent.
- LEN : un relâchement de 8 ms à la fin de LEN, la source s'arrête juste après ; les queues des envois continuent.
- Lock trig : un pas sans vélocité dont `ltrg` vaut 1. Il ne joue pas ; ses verrous vont au coup de la voix qui sonne encore. Avec LFO.T ON, il relance aussi ses LFO.
- LFO.T : le trig, note ou lock, relance les LFO de la voix.
- L'horloge copie l'état du séquenceur à chaque pas programmé : une re-programmation repart de celui de son premier pas, la pause reprend celui du pas de la reprise.
- Le compteur de passages : 1 à PLAY depuis l'arrêt et à chaque changement de pattern, +1 à chaque début de mesure. La pause le garde, STOP le remet à 1, et une pause juste avant une mesure déjà annoncée le rend (unbar).
- FILL est lu au moment de programmer, et un changement de FILL re-programme les pas à venir. LST (un changement de pattern prévu) aussi.
- Un μTIME négatif allonge l'horizon d'autant.
- `state/fill.ts` (nouveau) : le mode FILL, tenu tant qu'une main le tient (la souris, le clavier, le MIDI).

### La face (`rytm/pages.ts`, `actions.ts`, `rytm/pageView.ts`, `scene/screen.ts`, `scene/sequencer3d.ts`, `scene/renderer.ts`, `rytm/trigMarks.ts`, `ui/Hotspots.tsx`, `hooks/useKeys.ts`, `theme.ts`)

- **TRIG** :
  - 1/2 : A NOTE, B VEL, C LEN, D PROB, E COND, F μTIME, G LFO.T, H vide ;
  - 2/2 : A RTRG, B RATE, C VFAD, D RLEN ;
  - TRIG rappuyé passe à l'onglet suivant ;
  - la famille de potards `q:<réglage>` : sans pas tenu, le défaut de la voix dans le pattern ; un pas tenu (● REC), son P-LOCK, comme les autres pages.
- **MOD** : 1/2 le LFO 1, 2/2 le LFO 2 (SPD MULT FADE DEST WAVE PHAS MODE DEP). MOD puis YES tire le LFO affiché au hasard ; MOD puis NO le recharge. Plus aucun message « V.5.1 ».
- **Les dessins des blocs** :
  - COND : A:B en cases, au bout de la ligne d'unité ;
  - RATE : les répétitions d'un temps ;
  - VFAD : six répétitions ;
  - WAVE : la forme du LFO ;
  - LEN, RLEN : l'enveloppe ;
  - PROB : les barres ;
  - les crans pour MULT, DEST, MODE, RTRG et LFO.T.
  - Les lignes d'unité sont courtes : 115 MS, USE PROB, 1 OF 2, LIVE ou AT HIT, FREE...
- **Les pas** (desktop seulement, le téléphone n'en montre rien) :
  - un lock trig s'allume en jaune (le ton `dyellow`, `#FFD75E`) ;
  - un pas à COND ou PROB porte un petit point jaune au coin arrière gauche.
- **Lock trig à la souris** : ● REC allumé, FUNC tapée (gardée pour la touche suivante) puis un pas.
  - Sur un pas vide : un lock trig. Sur un lock trig : il s'en va avec ses verrous. Sur une note : elle devient un lock trig.
  - Une tape sur un lock trig l'enlève aussi.
  - Verrouiller un lock trig ne lui donne pas de vélocité.
  - REC éteint, FUNC + pas garde le mute rapide de D1.
- **FILL** : YES enfoncé (la souris, le doigt, Entrée) sans menu ouvert (ni KIT, ni la page TEMPO, ni PTN, ni la liste des sons) et sans FUNC attend.
  - Lâché avant 250 ms : la tape de D1 (la page armée au hasard).
  - Tenu plus longtemps : FILL tant qu'on le tient, jamais le hasard (l'armement de la page s'en va).
  - L'en-tête de l'écran affiche une pastille FILL, en vue PAGE comme en vue HOME.
- **INFOS** : la page TRIG (1/2 et 2/2) et chacun de ses réglages, les conditions avec des exemples (1:2 un passage sur deux, FILL seulement en tenant YES, 1:4 un crash toutes les quatre mesures), le retrig, le lock trig (sa carte au survol d'un lock trig), FILL, les huit réglages des LFO, la page MOD. Les cartes YES, FUNC et STEPS le disent aussi.
- La ligne d'aide sous les pas : `FUNC + STEP 1-8: MUTE (REC: LOCK TRIG)`.

### Le MIDI, le boîtier (`midi/targets.ts`, `rytm/sceneParams.ts`, `hw/snapshot.ts`, `hw/rowLeds.ts`, docs)

- Ajoutées **à la fin** de la liste, aucun id d'avant ne change ni ne bouge :
  - `rytm:voice:<voix>:<réglage>` pour les 9 réglages de trig et les 16 des LFO, sans choisir la voix ;
  - `rytm:fill` (tenu) ;
  - `rytm:screen:trig2`, `rytm:screen:mod1` (le même écran que `rytm:screen:mod`), `rytm:screen:mod2`.
- Les nouveaux réglages ont le rôle `noscene` : hors des scènes en D2.
- `docs/midi` régénéré (`npm run docs:midi` : 883 cibles). Le diff n'enlève rien ; seuls les noms montrés de `rytm:screen:trig` et `rytm:screen:mod` deviennent SCREEN TRIG 1/2 et SCREEN MOD 1/2.
- L'instantané du boîtier : `leds.trigs` (les lock trigs et les pas à condition de la voix choisie, en jaune) et `fill`. `hw/rowLeds.ts trigLeds` est testé dans `npm run hw:test`.
- `docs/hardware/mmhw-v2-app-side.md` : la section V.5.1 (`rytm:fill`, une proposition pour la note de YES, les LED des lock trigs).

### La revue de D2 (les corrections)

La revue adverse (workflow wf_a3fc0c8b-648) a trouvé quinze points. Tous sont corrigés, sauf SHARE (reporté d'un commun accord) et une limite notée en section 3.

- **Le moteur** :
  - E1 (haute) : `cancelAndHoldAtTime` n'existe pas dans Firefox. Un lock trig levait une erreur au milieu de `schedule()`, l'horloge rejouait le même pas à chaque réveil (le kick en mitraillette). `holdAt()` se replie sur `cancelScheduledValues` puis `setValueAtTime`, et `schedule()` rattrape l'erreur d'un coup ou d'un lock trig (console une fois, `clockDebug.seqErrors`) : le pas suivant part toujours.
  - E2 : la répétition d'un retrig arrête la source du coup qu'elle coupe, 2 ms après sa rampe de 8 ms, et y tient ses LFO. Une répétition annulée rend au coup d'avant sa fin, sa source et ses courbes.
  - E3 : le pas programmé garde LST tel qu'à sa première programmation. Un pas rejoué d'une mesure déjà annoncée ne le relit plus.
  - E4 : le premier pas à refaire est cherché par la fin. Avec le SWING et un μTIME négatif, aucun coup déjà parti ou dans la garde de 30 ms n'est annulé ni rejoué.
  - E5 : un lock trig pendant un retrig touche la répétition qui sonne à son heure ; les répétitions d'après gardent ses verrous en direct (VOL, PAN, FREQ, RESO, DELAY, REVERB, DIST, CHORUS) et sa relance de LFO.
  - E6 : PLAY après la pause repart à la position du pas de reprise. Le retrig continue, les LFO reprennent leur phase.
  - E7 :
    - les coups d'un pas sont joués dans l'ordre du temps (à égalité, l'ordre des pads) : la coupe du charley ouvert et le kick mono suivent μTIME ;
    - un lock trig prend les valeurs que jouent les scènes (le VOL morphé, comme un coup) ;
    - la courbe d'un LFO suit sa vitesse : 24 points par cycle, de 2 à 40 ms, 512 rampes au plus ;
    - le retrig qui ne s'arrête pas au trig suivant à μTIME négatif reste une limite (section 3).
- **La face** :
  - U1 : la tape de YES ne part qu'au lâcher **sur** YES, comme en D1 : glisser hors de la touche annule le hasard. YES d'un menu ou avec FUNC agit aussi au lâcher, au pointeur ; au clavier, Entrée agit toujours à l'appui.
  - U2 : le lock trig est jaune aussi sur la machine crème.
  - U3 : un lock trig qui reçoit une vélocité (la tape, le glisser, la flèche, VEL au P-LOCK, RANDOM) perd `ltrg`, au même endroit pour tous les gestes (`pattern.ts`). Effacé ensuite, le pas est vide.
  - U4 : Suppr sur un lock trig l'enlève avec ses verrous (l'écran disait OFF et le laissait).
  - U5 : μTIME affiche le compte seul (`-12`) ; la ligne d'unité dit `/384` et les ms (`/384 58MS`). `-12/384` ne tenait pas dans son bloc (`-12/3.`).
  - U6 : la pastille FILL est aussi dans les bandes P-LOCK et scène armée.
  - U7 : les cartes STEPS et FUNC disent le lock trig en REC ; RND change à chaque cycle (et rejoue la même suite après une relance).
- **Les données** :
  - D1 : RANDOM remet les réglages de trig du pattern au départ, comme CLEAR. Les verrous des pas restent, comme avant.
  - D2 (reporté) : SHARE ne porte toujours ni les réglages de trig ni les LFO.

### Les commits

| Commit | Ce qu'il apporte |
|---|---|
| 001343a | le modèle |
| 7eb2a9a | le moteur |
| 5f93731 | la face, FILL, les lock trigs, les INFOS |
| 3b8f914 | le MIDI et les docs |
| 668f426 | correction : les nœuds en direct posent leur valeur à l'heure du coup |
| 763fdfe | correction : le glissement d'un lock trig, la relance d'un LFO |
| b8e03d4 | relecture de l'écran en capture |
| af184fa | FIRMWARE V.5.1 |
| efea666 | la ligne d'aide et le message du lock trig, l'empreinte reposée |
| c81741f | le rapport |
| b3abcb4 | revue E1 : le repli sans `cancelAndHoldAtTime`, l'horloge jamais bloquée |
| cc7df72 | revue E2 : la répétition arrête la source du coup qu'elle coupe |
| 52de517 | revue E3, E4, E6 : LST figé, aucun coup parti rejoué, la reprise garde sa position |
| b5a6cf7 | revue E5, E7 : le lock trig pendant un retrig, l'ordre du temps, les scènes, les LFO rapides |
| 3cd8fa9 | revue U1, U3, U4, D1 : YES lâché hors de la touche, `ltrg` retiré, Suppr, RANDOM |
| f5d36a4 | revue U2, U5, U6, U7 : le jaune crème, μTIME, FILL en P-LOCK, les INFOS |
| bc80d69 | l'empreinte du firmware |
| ce rapport mis à jour | |

## 2. Décisions prises et pourquoi

- **L'identité d'abord.** Un seul calcul, `seqStep`, sert l'horloge et le rendu hors ligne. Au départ, il fait exactement les mêmes appels que la boucle d'avant : mêmes voix, même ordre, mêmes heures, même objet de verrou (`hitLock` le rend tel quel sans clé du séquenceur). Aucun nœud de plus.
- **Rien de plus à la valeur de départ.** Les nœuds en direct (VOL et PAN des lock trigs, filtre, LFO) ne sont créés que quand le motif ou la voix en ont besoin.
- **Le lock trig, ce qu'il change en direct** (liste exacte) :
  - VOL : un gain en direct, rapporté au VOL du coup ;
  - PAN : le panoramique du coup, posé même au centre pour la voix qui a des lock trigs PAN, au même niveau ;
  - la fréquence et la résonance du filtre : un filtre ouvert est posé à sa coupure de départ pour la voix qui en a besoin ;
  - les envois DELAY et REVERB, et les inserts DIST et CHORUS de la tranche, comme le verrou d'un coup, jusqu'au coup suivant ;
  - la relance des LFO, avec LFO.T ON.
  - Le reste de ses verrous (hauteur, enveloppe, son) ne peut pas changer un coup déjà lancé.
  - Un réglage qu'il ne verrouille pas reste ce qu'il était, pour ne pas couper l'enveloppe du filtre d'un coup en cours.
  - Le glissement : `setTargetAtTime` de 1 ms depuis la valeur du moment. `cancelAndHoldAtTime` sans événement après lui ne pose rien : la rampe partait du début du coup, et la sonde l'a montré, d'où 668f426 et 763fdfe.
  - Sans `cancelAndHoldAtTime` (Firefox) : l'annulation simple, puis la valeur tenue. Le glissement part de ce que valent les événements d'avant ; seul un lock trig FREQ tombé pendant l'attaque de l'enveloppe du filtre perd la fin de cette rampe.
- **Les LFO, en continu ou au coup** (liste exacte) :
  - en continu sur le coup qui sonne, en rampes d'AudioParam sur sa durée (au plus 8 s ; 24 points par cycle du plus rapide, de 2 à 40 ms, 512 segments au plus, la courbe s'arrête plus tôt plutôt que de s'espacer) : PITCH (`detune` de la source, +/-12 demi-tons à DEP 64), FREQ (`detune` du filtre, +/-5 octaves), RESO (Q), VOL (un gain), PAN (le panoramique) ;
  - pris au moment du coup : DIST, DELAY, REVERB, TONE (au 1/32, le calcul le plus proche joue en attendant, au plus 65 calculs) et DECAY ;
  - un LFO FREQ ou RESO pose le filtre de la voix s'il était ouvert ;
  - DEP 0 : aucun calcul ;
  - le temps est musical : la position en pas depuis PLAY ;
  - DEP va de -64 à +63 comme la Digitakt : à fond, 63/64.
- **Les LFO hors des scènes** en D2 (rôle `noscene`, comme le cahier le demande). Ils sont gardés avec les presets et l'UNDO, et verrouillables.
- **Le retrig mono.** Une répétition coupe la précédente en 8 ms, comme une piste de Digitakt, et arrête sa source juste après. Sinon, un retrig rapide sur une cymbale empilait vingt queues, et des centaines de sources tournaient à vide (la revue, E2).
- **Les répétitions et les conditions.** Une répétition appartient à la fenêtre de pas où elle tombe. Le trig suivant qui *joue* arrête le retrig ; un trig dont la condition échoue, ou un lock trig, non. Un lock trig pendant le retrig : ses verrous en direct passent aux répétitions d'après lui (pas les autres, une hauteur ou un son verrouillé ne s'y ajoutent pas, comme sur un coup qui sonne).
- **L'ordre des coups d'un pas** : celui du temps (μTIME, les répétitions), à égalité celui des pads. Au départ, rien ne change : tous les coups d'un pas ont la même heure.
- **Le mute et les conditions.** Les conditions sont évaluées même sur une voix coupée, pour que PRE et NEI ne dépendent pas des mutes.
- **μTIME négatif.** De 100 à 150 BPM, -23/384 vaut au plus 144 ms. L'avance de 300 ms (450 au téléphone) suffit ; l'horizon s'allonge quand même du plus grand μTIME négatif du motif, et rien n'est borné en lecture : le coup du pas 1 tombe à la fin de la mesure d'avant, à l'heure exacte (sonde en direct).
  - **Borné, à noter :** le tout premier pas 1 après PLAY n'a pas de mesure d'avant ; il part tout de suite. De même, hors ligne, un coup avant 0 s part à 0.
- **Le conflit de YES** (le cahier le laissait à arbitrer) :
  - la tape attend le lâcher, sous 250 ms, et sur la touche (la revue, U1 : comme le clic de D1, glisser hors d'elle annule) ; la page armée est lue à l'appui, une tape rapide ne perd donc pas l'armement ;
  - KIT, TEMPO, PTN, la liste des sons et FUNC n'ont pas de FILL : YES y agit tout de suite au lâcher sur la touche (au pointeur, comme en D1), à l'appui au clavier ;
  - Entrée tenue fait comme la souris pour FILL ;
  - `rytm:yes` reste la tape de D1, `rytm:fill` tient FILL.
- **La tape sur un lock trig l'enlève**, comme une touche de trig de Digitakt ; Suppr aussi. Un lock trig qui reçoit une vélocité par un autre geste perd `ltrg` : effacé, il ne revient jamais lock trig.
- **CLEAR remet les réglages de trig au départ** (le pattern, ou la ligne de la voix avec REC). Sinon une PROB à 0 restée après CLEAR rendrait les nouveaux pas muets. **RANDOM aussi** (la revue, D1) ; il garde les verrous des pas, comme avant.
- **Le lien SHARE** (beatcode v1) ne porte ni les P-LOCKS ni les réglages de trig ni les LFO. C'était déjà le cas pour les verrous ; une v2 les ajoutera. Les liens d'avant se relisent tels quels. La revue l'a relevé (D2) et l'a laissé reporté.
- **μTIME à l'écran** : le compte seul (`-12`), `/384` et les ms sur la ligne d'unité (le cahier écrivait `-23/384`, qui ne tient pas dans un bloc).
- **Le rendu hors ligne** gagne `trigs`, `fill`, `fillAt`, `last` et `log` (le journal de chaque coup et de chaque lock trig : gain, `kind`, LEN, valeur des LFO). Le chemin `bars` (les tests des scènes) reste sans séquenceur.
- **Debug** : `__v4.clock.pass`, `__v4.audio.lockTrigs`, `__v4.seq.ltrgMask` et `condDots`, `hw.getSnapshot().fill` et `leds.trigs`.

## 3. Ce qui reste à faire / points en suspens

- **Mika** :
  - écouter (rien n'a sonné ici) :
    - un retrig 1/32 sur une caisse claire ;
    - un LFO PITCH sur un tom ;
    - un lock trig VOL sur une cymbale ;
    - FILL en tenant YES ;
  - dire si DEP 64 = +/-12 demi-tons (PITCH) et +/-5 octaves (FREQ) sont les bonnes profondeurs.
- **Le boîtier** : confirmer avec `protocol.js` comment YES (note 72) porte FILL. Soit le pont mesure la tenue, soit une autre note.
- **D3 possible** :
  - les LFO dans les scènes ;
  - les réglages de trig et les P-LOCKS dans le lien SHARE (beatcode v2) ;
  - une longueur de pattern (le compteur de passages compte des mesures de 16 pas) ;
  - TRIG et MOD au téléphone, si Mika le veut.
- Le premier pas 1 après PLAY avec un μTIME négatif part tout de suite (voir la section 2).
- **Les limites laissées par la revue** :
  - un retrig ne s'arrête pas au trig suivant de la voix quand celui-ci a un μTIME négatif : les répétitions déjà émises entre l'heure avancée du trig et son pas sonnent (sonde : `rep@3.50` après `note@3.25`). Le corriger demande de lire le pas suivant à l'avance (sa condition, sa PROB) ;
  - un LFO rapide sur un son long se fige après 1 s au pire (512 rampes de 2 ms) ;
  - hors ligne, le retrig extrême (1/80 sur les 8 voix) se rend encore en 2,6 s pour 4,5 s : le rendu garde ses nœuds branchés jusqu'au bout. En direct, les sources s'arrêtent (29 au plus en même temps) ;
  - RANDOM garde les verrous des pas, donc une PROB ou une COND verrouillée sur un pas reste.
- **D2 de la revue, reporté** : SHARE (beatcode v2) avec les réglages de trig et les LFO.

## 4. Commandes utiles ajoutées

- `npm run hw:test` : 17 + 9 tests, dont `trigLeds` (les LED des lock trigs).
- Rendu hors ligne :
  ```
  window.__v4.audio.renderOffline({ ..., trigs: { BD: { prob: 50 } }, locks: { CY: { 8: { ltrg: 1, level: 0.2 } } }, voice: { SD: { l1dst: 1, l1dep: 40 } }, fillAt: [[2.0, true], [4.0, false]], log: true })
  ```
  puis `__v4.audio.offlineHits`.
- MIDI : `rytm:fill`, `rytm:screen:trig2`, `rytm:screen:mod1`, `rytm:screen:mod2`, `rytm:voice:<voix>:len` ... `rlen`, `rytm:voice:<voix>:l1spd` ... `l2dep`.
- Debug : `__v4.clock.seqErrors` (les erreurs de programmation rattrapées) et `__v4.clock.abs` (la position du prochain pas).
- Les sondes de la session, hors du dépôt (`scratchpad/d2/t/`) :
  - `ident.cjs` et `cmp.cjs` : l'identité ;
  - `seq.cjs` : le séquenceur hors ligne ;
  - `ui.cjs` : la face, une souris ;
  - `utime.cjs` : le μTIME en direct ;
  - `shots.cjs` : les captures ;
  - `ffb.cjs` : le repli sans `cancelAndHoldAtTime` (nouvelle) ;
  - `rtlive.cjs` : les sources qui jouent pendant un retrig, en direct muet (nouvelle) ;
  - `uix.cjs` : U1 (TEMPO), U3, U4, U5, D1, E7 (nouvelle) ;
  - `scratchpad/d2/rv/` : les sondes de la revue, rejouées.

## Vérification (sur une copie propre de `bc80d69`, `git archive`, après la revue)

Aucune lecture réelle : Chromium `--mute-audio`, `?mute=1` ; des compteurs, le journal de l'horloge, l'état des pas et des rendus hors ligne (des nombres).

- `npx tsc --noEmit -p .` : 13 erreurs, les mêmes 13 qu'avant (Admin, EventsDisplay, MainApp, NewsMessages, AppContext, adminApi, sanityClient, RadarPage x2, drums, fx x2, dj/engine) ; aucune nouvelle.
- `SEO_OFFLINE=1 npx vite build` : OK (built in 17,35 s).
- `node scripts/smoke-v4.mjs --url http://127.0.0.1:8852 --machines mm808,voy,dj` : `6 pages, aucune erreur`.
- `npm run hw:test` : 17 + 9 tests, tous bons. `npm run presets:test` : `12 tests, tous bons`, `5 tests, tous bons`.
- `node scripts/firmware.mjs check` : OK, MM-RYTM V.5.1 (211 fichiers), MM-ARP V.2.3, MM-BASS V.3.0.

**L'identité audio** (V.5.0 à fd92700, reconstruite, contre bc80d69 ; mêmes rendus hors ligne, 15 cas) :
- les cas : le pattern d'arrivée (une mesure et quatre), un pattern verrouillé (envois, inserts, TONE, PAN, VOL), le même avec tous les nouveaux réglages écrits à leur départ, un coup seul verrouillé, et les 10 presets d'usine ;
- l'écart maximal est de **5,0e-7**, et 0 sur le coup seul ;
- le bruit de V.5.0 contre elle-même est de 6,0e-7.

**La sonde muette du séquenceur** : 16 sur 16, les mêmes nombres qu'avant la revue.
- PROB 0 : 0 coup (PROB 100 : 64 sur 64 ; crête 0) ; PROB 50 : 34 sur 64 ; 1:2 : 4, 0, 4, 0.
- FILL tenu sur la mesure 2 : SD (FILL) 0, 2, 0 ; CP (!FILL) 2, 0, 2.
- μTIME +12 et -12 à 120 BPM : +62,500 et -62,500 ms au journal comme dans le son.
- RTRG 1/32 : 2 coups par pas, à 62,5 ms d'écart. LEN 1 pas : RMS après LEN 0.
- Lock trig VOL 0,2 : 1 coup, 1 lock trig ; gain 1,0000 avant, 0,0625 après. LFO.T : 2,3e-10 avant, 2,8e-2 après.
- LFO PITCH, FREQ, DECAY : 9 valeurs sur 16 coups. Les réglages au départ écrits : écart 0.

**La face, une seule souris** : 22 sur 22, aucune erreur de page (TRIG 1/2 et 2/2, P-LOCK PROB et son point jaune, les lock trigs, le mute rapide hors REC, MOD, FILL tenu, le compteur de passages, TRIG puis YES tenu ou tapé, le MIDI).

**μTIME en direct** (-23 sur le pas 1) : 143,75 ms avant la mesure à 100 BPM, 95,833 ms à 150 BPM ; le premier pas 1 après PLAY part tout de suite.

**Le repli sans `cancelAndHoldAtTime`** (`ffb.cjs`, la fonction retirée avant le chargement) : 6 sur 6.
- Hors ligne, 3 mesures : 3 coups, 3 lock trigs, crête 0,223, aucune erreur.
- En direct 4,5 s (CY, un LFO VOL, un lock trig VOL au pas 9) : 0 erreur de page, 0 erreur rattrapée, 39 pas programmés tous distincts, un lock trig par passage (2 pour 2 pas 9 ; une re-programmation au départ).
- La même sonde avec la fonction : 6 sur 6.
- La sonde de la revue (`ff.cjs`) : 0 erreur de page, le compteur de lock trigs passe de 1 à 3 (avant : 31 erreurs en 2,4 s, de 1 à 32, le journal bloqué au pas 9).

**Les sondes de la revue, rejouées** (avant : c81741f reconstruit ; après : bc80d69) :
- E2, `rtlive.cjs` (RTRG 1/80 RLEN INF sur les 8 voix, 150 BPM, en direct muet) : les sources qui jouent en même temps, au plus 204 avant, **29** après (moyenne 189,6 puis 20,9) ; avec 2 LFO par voix, 223 puis 29 ; sans retrig, 13 et 13. Hors ligne (`cpu.cjs`) : 29 au plus (la revue : 203).
- E3, `lst2.cjs` (SD en LST et CP en !LST au pas 16, A02 tapé) : avant, SD 0 et CP 1 au dernier passage dans deux modes sur trois ; après, SD 1 et CP 0 dans les trois (rien, une re-programmation, la tape tardive).
- E4, `swing.cjs` (SWING à fond, kick à -23 au pas 3, 24 re-programmations autour du pas 2) : avant, 19 kicks recréés dans la garde de 30 ms, dont 9 à 0 ms ; après, **un seul départ sur 24**, 274 à 296 ms en avance.
- E5, `rt.cjs` (CY en retrig 1/16, lock trig VOL 0,1 au pas 9) : le rapport du RMS des pas 10 à 13 vaut **0,0156** (avant 1,0000), comme le témoin sans retrig (0,0156).
- E6, `pause.cjs` : après la reprise, le retrig de CY continue à chaque pas (avant : 17 pas sans lui).
- E7, `choke.cjs` : les deux écritures équivalentes donnent les mêmes coups (OH@4.00, CH@4.50) et le même RMS (5,472e-4).
- U1, `p1.cjs` : YES lâché sur la touche, RANDOM ; lâché hors d'elle, rien (avant : RANDOM).
- U2, `lt.cjs` (machine crème) : le lock trig vaut [0.759, 0.379, 0.083] (avant [0.84, 0.82, 0.78], la couleur d'un pas vide) ; capture : le pas 2 jaune.
- U3, `p2.cjs` : après la tape qui efface, le pas est vide, sans verrou (avant : `{ltrg: 1}`, jaune).
- U6, `p10.cjs` : en-têtes `P-LOCK STEP 01 | SRC|FILL` et `SCENE A · 0 PARAMS · A01|FILL`.
- `uix.cjs` : 6 sur 6 (0 sur 6 sur c81741f) :
  - U4 : Suppr, `STEP 03 BD LOCK TRIG OFF`, le verrou parti ;
  - U3 par le store : pas vide, `{level: 0.5}` gardé ;
  - U5 : le bloc dit `-12`, l'unité `/384 58MS` à 130 BPM (capture vérifiée, rien de coupé) ;
  - U1 sur la page TEMPO : rien à l'appui, rien lâché dehors, `TAP 1/4` lâché dessus (avant : `TAP 1/4` dès l'appui, puis `TAP 2/4` lâché dehors) ;
  - D1 : `{"BD":{"utime":-12},"SD":{"prob":0},"CH":{"cond":11}}` devient `{}` après RANDOM ;
  - E7 : le VOL d'un lock trig sous la scène B à fond (VOL 1) donne un RMS de 3,6e-3, contre 1,4e-4 sans scène (avant : identiques).
- Limite, `rt.cjs` F : le retrig ne s'arrête pas au trig à μTIME négatif (`rep@3.50` après `note@3.25`), voir la section 3.

**Le téléphone** (`?portrait=1`, 390 x 844 DPR 3, au repos) : identique au pixel près à la V.5.0, sauf le texte FIRMWARE V.5.0 devenu V.5.1. Machine noire : 706 pixels dans 102 x 9 ; crème : 804 pixels dans 103 x 10.
