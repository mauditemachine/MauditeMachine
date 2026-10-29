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
| ce rapport | |

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
- **Les LFO, en continu ou au coup** (liste exacte) :
  - en continu sur le coup qui sonne, en rampes d'AudioParam sur sa durée (au plus 8 s, au plus 256 segments de 4 à 40 ms) : PITCH (`detune` de la source, +/-12 demi-tons à DEP 64), FREQ (`detune` du filtre, +/-5 octaves), RESO (Q), VOL (un gain), PAN (le panoramique) ;
  - pris au moment du coup : DIST, DELAY, REVERB, TONE (au 1/32, le calcul le plus proche joue en attendant, au plus 65 calculs) et DECAY ;
  - un LFO FREQ ou RESO pose le filtre de la voix s'il était ouvert ;
  - DEP 0 : aucun calcul ;
  - le temps est musical : la position en pas depuis PLAY ;
  - DEP va de -64 à +63 comme la Digitakt : à fond, 63/64.
- **Les LFO hors des scènes** en D2 (rôle `noscene`, comme le cahier le demande). Ils sont gardés avec les presets et l'UNDO, et verrouillables.
- **Le retrig mono.** Une répétition coupe la précédente en 8 ms, comme une piste de Digitakt. Sinon, un retrig rapide sur une cymbale empilait vingt queues.
- **Les répétitions et les conditions.** Une répétition appartient à la fenêtre de pas où elle tombe. Le trig suivant qui *joue* arrête le retrig ; un trig dont la condition échoue, ou un lock trig, non.
- **Le mute et les conditions.** Les conditions sont évaluées même sur une voix coupée, pour que PRE et NEI ne dépendent pas des mutes.
- **μTIME négatif.** De 100 à 150 BPM, -23/384 vaut au plus 144 ms. L'avance de 300 ms (450 au téléphone) suffit ; l'horizon s'allonge quand même du plus grand μTIME négatif du motif, et rien n'est borné en lecture : le coup du pas 1 tombe à la fin de la mesure d'avant, à l'heure exacte (sonde en direct).
  - **Borné, à noter :** le tout premier pas 1 après PLAY n'a pas de mesure d'avant ; il part tout de suite. De même, hors ligne, un coup avant 0 s part à 0.
- **Le conflit de YES** (le cahier le laissait à arbitrer) :
  - la tape attend le lâcher, sous 250 ms ; la page armée est lue à l'appui, une tape rapide ne perd donc pas l'armement ;
  - KIT, TEMPO (le TAP doit être immédiat), PTN, la liste des sons et FUNC gardent YES à l'appui ;
  - Entrée tenue fait pareil ;
  - `rytm:yes` reste la tape de D1, `rytm:fill` tient FILL.
- **La tape sur un lock trig l'enlève**, comme une touche de trig de Digitakt. Sinon il devenait une note qui reviendrait lock trig une fois effacée.
- **CLEAR remet les réglages de trig au départ** (le pattern, ou la ligne de la voix avec REC). Sinon une PROB à 0 restée après CLEAR rendrait les nouveaux pas muets.
- **Le lien SHARE** (beatcode v1) ne porte ni les P-LOCKS ni les réglages de trig ni les LFO. C'était déjà le cas pour les verrous ; une v2 les ajoutera. Les liens d'avant se relisent tels quels.
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

## 4. Commandes utiles ajoutées

- `npm run hw:test` : 17 + 9 tests, dont `trigLeds` (les LED des lock trigs).
- Rendu hors ligne :
  ```
  window.__v4.audio.renderOffline({ ..., trigs: { BD: { prob: 50 } }, locks: { CY: { 8: { ltrg: 1, level: 0.2 } } }, voice: { SD: { l1dst: 1, l1dep: 40 } }, fillAt: [[2.0, true], [4.0, false]], log: true })
  ```
  puis `__v4.audio.offlineHits`.
- MIDI : `rytm:fill`, `rytm:screen:trig2`, `rytm:screen:mod1`, `rytm:screen:mod2`, `rytm:voice:<voix>:len` ... `rlen`, `rytm:voice:<voix>:l1spd` ... `l2dep`.
- Les sondes de la session, hors du dépôt (`scratchpad/d2/t/`) :
  - `ident.cjs` et `cmp.cjs` : l'identité ;
  - `seq.cjs` : le séquenceur hors ligne ;
  - `ui.cjs` : la face, une souris ;
  - `utime.cjs` : le μTIME en direct ;
  - `shots.cjs` : les captures.

## Vérification (sur une copie propre de `efea666`, `git archive`)

- `npx tsc --noEmit -p .` : 13 erreurs, les mêmes 13 qu'avant (Admin, EventsDisplay, MainApp, NewsMessages, AppContext, adminApi, sanityClient, RadarPage x2, drums, fx x2, dj/engine) ; aucune nouvelle.
- `SEO_OFFLINE=1 npx vite build` : OK (built in 15,1 s).
- `node scripts/smoke-v4.mjs --url http://127.0.0.1:8852 --machines mm808,voy,dj` : `6 pages, aucune erreur`.
- `npm run hw:test` : 17 + 9 tests, tous bons. `npm run presets:test` : `12 tests, tous bons`, `5 tests, tous bons`.
- `node scripts/firmware.mjs check` : OK, MM-RYTM V.5.1 (211 fichiers), MM-ARP V.2.3, MM-BASS V.3.0.

**L'identité audio** (V.5.0 à fd92700 contre D2, mêmes rendus hors ligne, 15 cas) :
- les cas : le pattern d'arrivée (une mesure et quatre), un pattern verrouillé (envois, inserts, TONE, PAN, VOL), le même avec tous les nouveaux réglages écrits à leur départ (verrous et défauts du pattern), un coup seul verrouillé, et les 10 presets d'usine ;
- l'écart maximal est de **3,3e-7**, et 0 sur trois cas ;
- le bruit de V.5.0 contre elle-même est de 3,6e-7.

**La sonde muette du séquenceur** (rendus hors ligne et compteurs de coups, jamais une écoute) : 16 sur 16.
- PROB 0 : 0 coup (PROB 100 : 64 sur 64 pas ; le rendu est muet, crête 0) ; PROB 50 : 34 sur 64.
- 1:2 : 4, 0, 4, 0 coups par mesure.
- FILL tenu sur la mesure 2 : SD (FILL) 0, 2, 0 ; CP (!FILL) 2, 0, 2.
- μTIME +12/384 et -12/384 à 120 BPM : +62,500 et -62,500 ms au journal comme au début du coup dans le son.
- RTRG 1/32 : 2 coups par pas, à 62,5 ms d'écart, sur les seize pas (un trig, RLEN INF ; et un trig par pas, RLEN 1).
- LEN 1 pas sur un charley ouvert : RMS après LEN 0 (INF : 1,1e-3) ; avant LEN, identique.
- Lock trig VOL 0,2 sur une cymbale :
  - 1 coup, 1 lock trig, aucun coup de plus ;
  - avant lui, le gain est identique (1,0000) ; après, 0,0625, soit -24,1 dB comme attendu.
- Lock trig LFO.T sur un LFO VOL : écart 2,3e-10 avant lui, 2,8e-2 après (le LFO repart).
- LFO PITCH SINE d'une mesure : la valeur de chaque coup suit 63/64 x sin(2 pi s / 16), soit 9 valeurs sur 16 coups, et le son change. LFO FREQ : 9 valeurs. LFO DECAY, pris au coup : 9 valeurs.
- Les réglages au départ écrits : rendu identique, écart 0.

**La face, une seule souris** (lecture muette, `--mute-audio`, `?mute=1`) : 22 sur 22, aucune erreur de page.
- TRK puis le pas 1 choisit BD.
- TRIG 1/2 (NOTE VEL LEN PROB COND μTIME LFO.T), TRIG rappuyé : 2/2 (RTRG RATE VFAD RLEN), puis 1/2.
- Le potard C sans pas tenu règle LEN de BD dans le pattern.
- REC, le pas 5 tenu, puis le potard D : le P-LOCK `prob: 60` sur le pas seul, avec son point jaune (et `leds.trigs.cond` du boîtier).
- Lock trig :
  - FUNC tapée puis un pas vide : un lock trig jaune (`dyellow`), sans note ;
  - un verrou VOL posé dessus : il reste sans note ;
  - FUNC + le lock trig : il s'en va ;
  - FUNC + une note : elle devient un lock trig ;
  - une tape l'enlève, la suivante pose une note.
- REC éteint, FUNC + pas 2 : le mute rapide de SD.
- MOD 1/2 et 2/2 ; MOD puis YES : LFO 2 au hasard, sans message V.5.1.
- FILL :
  - YES tenu à la souris : `fill` vrai, la pastille FILL dans l'en-tête ;
  - la caisse claire à COND FILL : 0 coup avant, 9 pas sur 9 pendant la tenue, 0 après.
- Le compteur de passages avance (3 puis 4) ; STOP le remet à 1.
- TRIG puis YES tenu : FILL, le motif ne change pas ; TRIG puis YES tapé : le hasard de D1.
- MIDI : `rytm:fill`, `rytm:screen:mod2`, `rytm:screen:mod1` et `rytm:screen:trig2`.

**μTIME en direct** (-23/384 sur le pas 1) :
- 100 BPM : le coup tombe 143,75 ms avant la mesure ;
- 150 BPM : 95,833 ms avant la mesure ;
- les deux sont à l'heure exacte, programmés 274 à 777 ms en avance ;
- le premier pas 1 après PLAY part tout de suite.

**Le téléphone** (`?portrait=1`, 390 x 844 DPR 3, au repos) : identique au pixel près à la V.5.0, sauf le texte FIRMWARE V.5.0 devenu V.5.1. Machine noire : 706 pixels ; crème : 804 pixels ; dans la même boîte, 102 x 9 pixels.
