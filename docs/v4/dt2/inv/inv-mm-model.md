# Inventaire mm-model : du MM-RYTM a 8 voix typees vers 16 pistes libres facon Digitakt II

2026-10-30. Partie "modele de donnees et moteur" de l'inventaire de la refonte Digitakt II (demande de Mika : "refais la
Digitakt mais avec mon design ... tous les boutons, le placement des choses et toutes les fonctionnalites c'est base sur
la Digitakt sans le cote sampler"). Decisions deja prises par Mika : modele Digitakt II, 16 pistes libres (n'importe quel
son sur n'importe quelle piste, sa banque de samples et les voix de synthese existantes), mise en ligne en 2 ou 3 gros
morceaux. Hors portee : SAMPLING (enregistrer, entrees, edition et enregistrement de samples), USB, audio in, Overbridge,
transfert, tout ce qui demande du materiel (donc aussi les pistes MIDI de la DT2).

Lecture seule : rien n'a ete modifie dans le depot. Sources lues : `src/v4/**` (291 fichiers, 118 918 lignes),
`docs/v4/digitakt-*.md`, `docs/reports/2026-10-29-rytm-v5*.md`, `2026-10-30-rytm-v52*.md`, le manuel Digitakt II OS 1.17
(`scratchpad/dt2/m2/m2.txt`, cite [M2 ligne]). Une mesure hors ligne (aucun son) a ete faite sur `audio/shotsdsp.ts`
(section 5.1).

Conventions : [ACT] = l'existant verifie dans le code ; [CIB] = la proposition ; [DEC] = a trancher par Mika ; [M2 n] =
ligne du texte du manuel DT2.

---

## 0. Resume en 10 lignes

1. Aujourd'hui une "voix" (type `Inst` = BD SD CH OH CP TOM HT CY) est a la fois : la cle de stockage, la piste du
   sequenceur, la tranche audio, l'algorithme de synthese (`ShotId`), la famille du kit (`KitFamily`), la categorie des
   samples et l'id MIDI. Le type `Inst` est lu par 42 fichiers ; la liste des 8 voix est recopiee 13 fois.
2. Le son d'une voix vit dans DEUX stores globaux : `kit` (par famille : machine 909/808/MM, sample, couches, et 10
   potards GLOBAUX partages) et `voiceFx` (par voix : 19 reglages + 16 LFO). Rien de ca n'est dans les patterns.
3. Le moteur est deja presque "par piste" : chaque coup est un AudioBuffer pre-calcule dans un worker (aucun
   oscillateur en temps reel) ; seuls cinq comportements dependent de l'identite de la voix (voie du kick, kick
   monophonique, choke des charleys, charley ouvert au pad tenu, source du SIDECHAIN).
4. [CIB] On garde les cles BD..CY comme cles canoniques des pistes 1 a 8 et on ajoute T9..T16 : les pas, verrous,
   reglages de trig, mutes, ids MIDI, cles de scene et liens SHARE d'avant restent valides SANS conversion.
5. [CIB] On remplace `kit` + `voiceFx` par un seul store `tracks` (16 `TrackSound`) dont les reglages vivent dans l'espace
   des verrous (`LockId`) : le meme nom partout (son, P-LOCK, MIDI, scene, CONTROL ALL, lien SHARE).
6. [CIB] Le son d'une piste = une machine SRC (ONESHOT, ou l'une des 8 syntheses KICK SNARE CL HAT OP HAT CLAP LO TOM
   HI TOM CYMBAL, chacune en 909/808/MM avec sa couche SAMPLE) ; le calcul reste celui de `shotsdsp.ts`, indexe par
   moteur et non plus par voix.
7. Seule vraie migration : `mm.v4.kit.1` + `mm.v4.rytm.voices.1` -> `mm.v4.rytm.tracks.1`, et la forme `RytmData` des
   presets, brouillons, UNDO et liens (lus en ancien format, convertis par UNE fonction).
8. CPU : le risque n'est pas l'audio des 16 voix (lecture de tampons) mais (a) la polyphonie des pistes "poly",
   (b) 16 CHORUS en worklet, (c) les re-programmations de toute l'horloge a chaque potard, (d) la file du worker quand
   un pattern change de kit. Remedes : pistes mono (comme la DT2), CHORUS en envoi, re-programmation par piste, kit du
   pattern suivant pre-calcule.
9. Decoupage sur : E0 moteur 16 pistes invisible (identite audio), E1 = V.6.0 (16 pistes visibles), E2 = V.6.1 (les
   pages DT2 completes), E3 = V.6.2 (le kit dans le pattern, presets de piste et preset locks).
10. Taille : environ 6 000 lignes touchees pour E0+E1, 3 500 pour E2, 3 000 pour E3 (section 6).

---

## 1. Ce que dit la Digitakt II sur les donnees (ce qu'on copie)

- **Structure** [M2 729-800] : projet = 128 patterns (8 banques x 16) + 16 songs + un pool (128 presets, 1016 samples).
  "A pattern contains up to 16 presets (one for each audio track), a kit, and sequencer data like trigs and parameter
  locks for the 16 tracks. It also contains the settings on the TRIG page and BPM, length, swing and time signature".
- **Kit** [M2 1477-1481] : 16 presets de piste + "LEVEL settings for the audio tracks and the pattern", compresseur et
  master distortion, "Compressor routing and Control all settings", "Send FX settings".
- **Preset** [M2 1482-1484] : un sample + les pages SRC, FLTR, AMP, FX et MOD. Importe dans un pattern, il devient une
  copie (plus de lien avec l'original) [M2 1457].
- **Pattern** [M2 2029-2036] : reglages par defaut de la page TRIG, pages SRC FLTR AMP FX MOD, pages DELAY REVERB CHORUS
  MIXER, quantize, note trigs et lock trigs, parameter/sample/preset locks, longueur et signature par piste.
- **Pistes** [M2 820-830] : 16 pistes, chacune une machine SRC (ONESHOT, WERP, STRETCH, REPITCH, SLICE, GRID, MIDI) et
  une machine FLTR (MULTI-MODE, LOWPASS 4, EQ, COMB-, COMB+, LEGACY) [M2 366-382]. "You can assign any SRC machine to
  any track." Choix : FUNC + SRC (menu MACHINE) [M2 4867].
- **Voix** [M2 657] : "16 stereo audio voices" : une voix par piste, donc une piste est monophonique.
- **Chaine d'une voix** [M2 660-700] : SRC -> BR -> SRR -> BASE-WIDTH -> FILTRE (machine, enveloppe) -> OVERDRIVE (pre
  ou post filtre) -> AMP (enveloppe, PAN, VOL) -> TRK LEV -> mixer ; envois CHO, DEL, REV.
- **Pages par piste** [M2 2929-3215] : SRC (selon la machine), FLTR 1 (ATK DEC SUS REL FREQ RESO TYPE ENV), FLTR 2
  (DEL KEY.T BASE WIDTH BW.RT RSET), AMP (ATK HOLD DEC SUS REL RSET MODE PAN VOL), FX (BR OVER SRR ROUT DEL REV CHR
  OD.RT), MOD 1 a 3 (trois LFO : SPD MULT FADE DEST WAVE SPH MODE DEP).
- **Niveaux** : TRK LEV (le potard LEVEL/DATA, non verrouillable, dans le kit) et AMP VOL (verrouillable) sont deux
  reglages distincts [M2 3066 "Unlike the track LEVEL, this parameter can be parameter locked"].
- **CONTROL ALL** [M2 945-953, 1867-1880] : TRK tenue + potard = toutes les pistes ; le menu KIT choisit quelles pistes
  (CONTROL ALL CONFIG), la piste active toujours comprise. Meme menu : COMPRESSOR ROUTING, TRACK SWAP (deux pistes
  echangent tout : reglages, presets, donnees du sequenceur).
- **Pool et preset lock** [M2 1491-1502, 2499] : un pas peut jouer un autre preset du pool (preset lock) ; un sample lock
  change le sample du pas.
- **Destinations des LFO** [M2 6018-6075] : SRC (TUNE, PLAY, SAMPLE SLOT, E F G de la machine, LEVEL), FILTER (selon la
  machine, ENV DEPTH, DEL, ATK DEC SUS REL, RSET, BASE, WIDTH, KEY.T), AMP (ATK HOLD DEC SUS REL PAN VOL), FX (DEL REV
  CHR sends, BR, SRR, SRR ROUT, OVER), et les LFO 1 et 2 eux-memes (pour LFO 2 et 3).

Ce qu'on ne copie pas : SAMPLING, entrees, USB, Overbridge, Transfer, +Drive (on n'a pas de "projet" : l'etat du
navigateur en tient lieu), machines MIDI (materiel), WERP/STRETCH/REPITCH/SLICE/GRID (moteurs de sampler : a discuter
avec la partie "pages", hors de ce modele en E1).

---

## 2. Le modele actuel, inventaire precis [ACT]

### 2.1 Le type `Inst` et ses copies

- Definition : `src/v4/theme.ts:1062` `export type Inst = 'BD' | 'SD' | 'TOM' | 'CH' | 'OH' | 'CP' | 'HT' | 'CY';`
- La liste ordonnee (l'ordre des pads, de la grille, des ids MIDI) : `src/v4/audio/pattern.ts:44`
  `INSTRUMENTS = ['BD','SD','CH','OH','CP','TOM','HT','CY']`.
- Recopies locales (pour eviter les imports circulaires), toutes dans le meme ordre :
  `audio/trig.ts:85 INSTS`, `audio/voicefx.ts:199 INSTS`, `audio/locks.ts:138 INSTS`, `audio/morph.ts:54 VOICES`,
  `rytm/sceneParams.ts:52 VOICES`, `rytm/infoIds.ts:45 RYTM_INFO_VOICES`, `rytm/pages.ts:572 MIXER_VOICES`,
  `rytm/faceplate.ts:223 steps.voices` (les legendes BD..CY imprimees sous les pas 1 a 8), `midi/roto.ts:128 VOICES8`,
  `state/rytmPage.ts:69 INSTS`, `audio/beatcode.ts:40 INSTS_V1` (FIGEE : format du lien), `scripts/mm-studio-patterns.mjs:54`.
- Les familles (une par voix depuis le 2026-10-18), meme ordre : `audio/kit.ts:103 KIT_FAMILIES`,
  `audio/samples.ts:39 FAMILY_DIRS` (= les dossiers `public/samples/rytm/<f>`), `audio/usersamples.ts:50`,
  `rytm/sceneParams.ts:53 FAMS`, `audio/beatcode.ts:42 FAMS_V1` (figee), `scripts/rytm-samples-lib.mjs:40`,
  `scripts/admin-samples-api.mjs:40`.
- Tables `Record<Inst, ...>` exhaustives (le compilateur les signalera) : `theme.ts` `VOICE_KEYS` (A S D F Z X C V),
  `INST_NAMES`, `PAD_ARIA`, `PADS` (telephone) ; `audio/pattern.ts DEFAULT_STEPS` ; `shotsdsp.ts SHOT_LOUD`, `SHOT_BELOW`,
  `VARIANTS` (par ShotId) ; `beats.ts rows`.
- Le moteur de synthese : `audio/shotsdsp.ts:33` `export type ShotId = Inst | 'CHopen'` (le type de la voix SERT
  d'identifiant d'algorithme). `kit.ts:292 familyOf(ShotId)`, `kit.ts:305 shotsOf(f)`.

Comptage des references au type ou aux noms de voix par fichier (grep `\bInst\b|INSTRUMENTS|'BD'..|BD:|INSTS|VOICES8|.instrument`) :

| Fichier | refs | lignes |
|---|---|---|
| actions.ts | 155 | 5372 |
| state/factory.ts | 80 | 1017 |
| audio/drums.ts | 66 | 2960 |
| audio/pattern.ts | 47 | 754 |
| audio/shotsdsp.ts | 41 | 1393 |
| midi/rotoKeys.ts | 40 | 624 |
| scene/screen.ts | 32 | 3958 |
| theme.ts | 30 | 3055 |
| audio/locks.ts | 20 | 424 |
| scene/sequencer3d.ts | 18 | 1080 |
| audio/morph.ts | 18 | 429 |
| audio/seq.ts | 17 | 301 |
| ui/BeatEditor.tsx | 16 | 572 |
| audio/beats.ts | 16 | 506 |
| state/rytmPage.ts, rytm/infoIds.ts | 15 chacun | |
| audio/voicefx.ts | 15 | 291 |
| rytm/infos.ts | 14 | 1463 |
| audio/beatcode.ts | 12 | 375 |
| state/patterns.ts, scene/renderer.ts | 11 chacun | |
| audio/kit.ts, audio/clock.ts | 10 chacun | |
| ui/Hotspots.tsx, state/voices.ts, midi/seqlink.ts, audio/trig.ts | 9 chacun | |
| rytm/pages.ts, rytm/pageView.ts | 8 chacun | |
| ui/Dock.tsx, state/share.ts, state/presets.ts, state/lcd.ts, rytm/sceneParams.ts, midi/roto.ts | 7 chacun | |
| ui/KnobPanel.tsx, scene/pads.ts, rytm/stepLeds.ts, rytm/diagrams.ts, midi/targets.ts, hw/snapshot.ts | 6 chacun | |
| rytm/InfosCard.tsx, debug.ts | 5 chacun | |
| fallback/StaticMachine.tsx | 4 | |
| state/lcdSamples.ts, state/lcdMix.ts, scene/hit.ts, hooks/useKeys.ts, audio/seqhit.ts | 3 chacun | |
| state/undo.ts, rytm/trigMarks.ts, rytm/faceplate.ts | 2 chacun | |
| audio/shots.ts | 1 (mais tout son etat est par ShotId, voir 2.7) | |

`INSTRUMENTS` seul : 123 references dans 21 fichiers (actions 16, drums 12, BeatEditor 10, sequencer3d 10, screen 7,
pattern 7, renderer 6, share 5, patterns 5, seq 5, targets 4, StaticMachine 4, clock 4, Dock 3, lcd 3, factory 3, useKeys 3,
KnobPanel 2, undo 2, presets 2, seqlink 2). `pattern.get().instrument` (la voix choisie) : 103 references (actions 89).
`voiceFx.` : 62 refs dans 13 fichiers. `kit.(get|tweak|sig|value|sound|choice|replace|set...)` : 125 refs dans 16
fichiers. `KIT_FAMILIES` : 40 refs, 8 fichiers. `familyOf(` : 30 refs, 7 fichiers. `soundFamily(` : 33 refs (actions,
targets).

**Piege majeur** : iterer `INSTRUMENTS` (8) la ou il faudrait 16 compile sans erreur. Chacune de ces 123 references doit
etre revue a la main (liste ci-dessus), le compilateur ne trouvera que les `Record<Inst, ...>`.

### 2.2 Le motif courant (`audio/pattern.ts`, cle `mm.v4.pattern.3`)

- `Steps = Record<Inst, string>` : 16 caracteres '0' a '9' par voix (`STEP_COUNT = 16`, `STEPS_RE /^[0-9]{16}$/`).
  0 vide, 9 le plus fort ; gains `VEL_GAIN`.
- `StoredPattern { v: 1, bpm, steps, fx: Fx, locks?, scenes?, pmutes?: Inst[], trigs?: TrigSet }` ; les champs
  facultatifs sont absents a leur depart ("le JSON d'avant, octet pour octet" : regle tenue a chaque etape D1 a D3a).
- `PatternState = Pattern & { instrument: Inst | null, locks, pmutes, trigs }`. `instrument` : la voix choisie
  (BD au chargement, jamais retenue ; null = "les potards reglent tout le pattern").
- `Fx` : 24 reglages GLOBAUX de la machine (swing, drive, reverb, delay, chorus, dtime, dfb, bits, comp, dtone, rsize,
  rtone, rpre, xtone, crate, cdepth, brate, catk, crel, cthr, cratio, cknee, cmake, chpf) ; sous-store `pattern.fx`.
  Retenus avec le motif courant, mais PAS par emplacement (voir 2.3) : donc globaux en pratique.
- Sous-store `pattern.scenes` (SceneSet A et B), retenu avec le motif et par emplacement.
- Lecture de l'ancienne cle `mm.v4.pattern.2` (velocites 1 2 3) : `fromLevels3`.

### 2.3 Les emplacements (`state/patterns.ts`, cle `mm.v4.patterns.1`)

- 128 emplacements (8 banques x 16, V.5.2), tableaux paralleles : `slots: (Steps|null)[]`, `locks`, `scenes`, `pmutes`,
  `trigs` ; `cur`, `chain` (64 max), `pos`, `next`, `bank` (jamais retenu).
- `validSteps` complete les voix absentes par des zeros (c'est ce qui rend l'ajout de cles T9..T16 sans risque).
- NE contient PAS : le son (kit, voiceFx), le tempo, le swing, les FX globaux. Changer de pattern ne change pas de son.

### 2.4 Le son : deux stores globaux

**`audio/kit.ts` (cle `mm.v4.kit.1`, `KIT_V = 4`)** : par FAMILLE.
```ts
interface Kit {
  model: Record<KitFamily, KitModel>;          // '909' | '808' | 'mm' : la MACHINE de la couche SYNTH
  knob: Record<KitKnob, number>;               // 10 potards GLOBAUX : tune attack decay drive sweep (le kick),
                                               // snappy sdtune sddecay sdtone (la caisse claire), gate (SD ET CP)
  sample: Partial<Record<KitFamily, string>>;  // la cle du sample de la couche SAMPLE ('bd/01 AT BluePrint...wav', 'bd/u:id')
  layer: Record<KitFamily, Layer>;             // syn lev tune fine start len rev
}
```
- Defaut : BD, SD, OH jouent le premier sample de leur dossier, synthese a 0 (`SAMPLE_FIRST`) ; BD en 909, le reste MM.
- Le son d'un coup = `kit.tweak(ShotId)` -> `ShotTweak` (modele, potards, couche, sample), sa signature `kit.sig(ShotId)`
  entre dans la cle du cache des one-shots.
- Les potards sont globaux : `familiesOf('gate') = ['sd','cp']` (un seul GATE pour la caisse claire et le clap).
- Traductions d'heritage deja en place : familles hh/tom/rs d'avant le 2026-10-18 (`foldFamilies`), kits d'avant R3,
  OH par defaut (`oldOh`).

**`audio/voicefx.ts` (cle `mm.v4.rytm.voices.1`)** : par VOIX.
- `VoiceParam` (19) : tone decay level dist reverb delay chorus tune pan start atk hold fine ftype fcut freso fenv fatk fdec.
- Plus les LFO (V.5.1) : `l1spd l1mul l1fad l1dst l1wav l1phs l1mod l1dep` et `l2*` (16 entiers, absents a leur depart).
- `VOICE_FX_DEFAULT` : level 0.8 (gain 1, loi `voiceGain = (level/0.8)^2`), decay 1 (INF), fcut 1, fdec 0.5, le reste 0.
- Stocke seulement ce qui quitte le depart.

**`audio/samples.ts` + `audio/usersamples.ts`** : la banque.
- Le site : `public/samples/rytm/<famille>/` (34 fichiers : bd 12, sd 11, ch 3, cy 3, ht 2, cp 1, oh 1, tom 1 ; environ
  5 Mo), liste du build `virtual:rytm-samples`, cle `<famille>/<fichier>`.
- Ce navigateur : IndexedDB `mm-v4-rytm-user`, index `mm.v4.rytm.user.1`, cle `<famille>/u:<id>`, 60 par famille,
  10 Mo et 12 s au plus. La famille vient de la voix sur laquelle on depose.
- Budget PCM decode : 160 Mo (desktop), 48 Mo (pointeur grossier).

### 2.5 Les verrous (`audio/locks.ts`, forme `LOCKS_V = 3`)

- `Locks = Partial<Record<Inst, Record<'0'..'15', StepLock>>> & { v?: number }`, `STEPS = 16` en dur.
- `StepLock = Partial<Record<LockId, number>> & { snd?: string; mach?: string }`.
- `LockId` est deja l'espace de TOUS les reglages d'une piste :
  - voix : level decay tune pan start + `VOICE_LOCK_IDS` (atk hold fine ftype fcut freso fenv fatk fdec tone dist chorus)
    + delay reverb ;
  - machine (potards du kit) : `KIT_LOCK_IDS` ktune kattack kdecay kdrive snappy gate ksweep sdtune sddecay sdtone
    (`KNOB_OF` : ktune -> tune...) ;
  - couches : `LAYER_LOCK_IDS` syn slev stune sfine sstart slen srev (`LAYER_OF` : slev -> lev...) ;
  - sequenceur : `TRIG_PARAMS` (len prob cond utime lfot rtrg rate vfad rlen), `LFO_PARAMS`, `ltrg` (lock trig).
  - chaines : `snd` ('<famille>:<cle>' ou '<famille>:off', le sample lock), `mach` ('909' '808' 'mm').
- `fromR2` traduit les verrous de R2 ; `sndNow` traduit hh:/tom: (2026-10-18).

### 2.6 Le sequenceur des trigs

- `audio/trig.ts` : `TrigSet = Partial<Record<Inst, TrigRow>>`, rangee PAR PATTERN (`pattern.trigs`, et par emplacement).
  `TRIG_DEF`, `CONDS` (NONE FILL PRE NEI 1ST LST A:B et negations).
- `audio/lfo.ts` : 2 LFO par voix, `LfoParam = l${1|2}${LfoKey}`, `LFO_DESTS` (11 : OFF PITCH FREQ RESO VOL PAN DIST DELAY
  REVERB TONE DECAY), `LFO_WAVES` 7, `LFO_MODES` 5. La DT2 en a 3 par piste et beaucoup plus de destinations.
- `audio/seq.ts` : `SeqState.v: Record<Inst, SeqVoice>` (pre, anchor, retrig, dernier coup) ; NEI = la voix d'avant dans
  l'ordre des pads (BD n'en a pas) ; pur, partage par l'horloge et le rendu hors ligne.
- `audio/seqhit.ts` : LFO pris au coup ou en courbe, `liveNeeds` par voix.

### 2.7 Le moteur

**`audio/drums.ts`** (2960 lignes) :
- Graphe : un `AudioContext` ; par voix une **tranche** `Channel` (chIn gain -> TONE (2 biquads, bypass reel) -> DIST
  (WaveShaper, bypass reel) -> CHORUS (worklet sinc 16 points, construit seulement s'il est engage) -> chOut -> tap ->
  envois REVERB et DELAY (debranches a 0)) ; `ch: Record<Inst, Channel>` (8, construites au demarrage, l.536-570).
- Bus : la tranche du BD va a `kickBus` (TONE et DIST globaux seulement, jamais CHORUS, REVERB, DELAY globaux), les
  autres a `bus` (DIST -> TONE -> CHORUS globaux, envois globaux `padsSend`). Puis LEVEL -> glue (BIT + COMP worklet) ->
  `rytmOut` (RYTM_TRIM) -> analyseur -> limiteur worklet -> master.
- Un coup (`trigger` l.1518, `voice` l.1331) : BufferSource + au besoin gain (velocite, VOL verrouille), gain des lock
  trigs, gain du LFO VOL, gain de LEN, gain de coupe du retrig, StereoPanner (hors centre), enveloppe AHD (gain), filtre
  (1 biquad), porte (OH, BD) ; tout se debranche a `onended`.
- `hitParams(inst, ...)` l.1266 : `base: ShotId = inst === 'CH' && open ? 'CHopen' : inst` ; `kick: inst === 'BD'`.
- Comportements par identite de voix (TOUS a rendre "par piste") :

| Comportement | Ou | Regle aujourd'hui |
|---|---|---|
| Voie du kick (hors CHORUS/REVERB/DELAY globaux) | drums.ts:542 `inst === 'BD' ? kickBus : bus` | BD |
| Kick monophonique (le suivant coupe la queue en 3 ms avant de frapper) | drums.ts:984 `chokeBD`, `bdGate`, `BD_CHOKE_S` | BD |
| Choke des charleys (CH ou OH ferme l'OH qui sonne, 8 ms) | drums.ts:993 `chokeOH`, `ohGate`, `CHOKE_S` ; l.1338, 1453 | CH coupe, OH coupe et se fait couper |
| Charley ouvert au pad tenu | drums.ts:1267 `CHopen` | CH |
| Source du SIDECHAIN ARP et BASS (enveloppe du kick) | drums.ts:1275, 1296 `kit.kickWith`, 1493 ; audio/duck.ts | BD (et un son de la famille bd) |
| VOL du kick fige dans la cle de re-programmation | clock.ts:593 `inst === 'BD' \|\| levelBaked` | BD |
| GATE partage | kit.ts `familiesOf('gate')` | SD et CP |
| Potards de machine | kit.ts KNOB global, `sigOf` | bd : 5 potards, sd : 5, cp : gate |
| Calibrage de sonie | shotsdsp.ts `SHOT_LOUD`, `SHOT_BELOW`, `layerCap` | par ShotId |
| Variantes alternees | shotsdsp.ts `VARIANTS` (BD 1, SD 3, CH 4, CHopen 2, OH 3, CP 3, TOM 1, HT 1, CY 2) | par ShotId |
| Kick en mono | shotsdsp.ts `sampleBody` (cal BD) | moteur bd |
| Roles du RANDOM | beats.ts:408-419 | BD kick, SD/CP backbeat, CH/OH, TOM/HT percs, CY |
| Motif d'arrivee, presets d'usine | pattern.ts DEFAULT_STEPS, factory.ts | par voix |

**`audio/shots.ts`** (cache des one-shots, worker `shots.worker.ts`) :
- Cle `${ShotId}|${stretch}|${variante}|${sr}|${hauteur}|${sig}` ; LRU 240 entrees, 96 Mo (40 Mo au pointeur grossier).
- ETAT PAR ShotId, donc par voix : `lastVar` (rotation des variantes), `lastPlayed` (le son precedent de la voix, joue
  pendant qu'un nouveau se calcule), `lastReq`, `substituted` (re-programmer quand le bon arrive), `choiceAt`,
  `choiceTimer` (par famille). Prechauffage `IDS` (9 sons) au premier contexte.
- Avec deux pistes du meme moteur (deux kicks), ces etats se melangeraient : a passer par piste.

**`audio/shotsdsp.ts`** : `renderShot(id, ...)` (bd909, bd808, bd MM, sd..., hats, cp, tom, ht, cy), `renderSampleShot`
(le sample cale sur sa famille, `sampleCal` : un sample d'une autre famille garde le caractere et le niveau de la sienne),
`renderLayers` (SYNTH + SAMPLE). Le moteur est deja pret pour des pistes libres : il ne connait que le moteur et le
`ShotTweak`, jamais la piste.

**`audio/clock.ts`** : horloge par anticipation (300 ms, 450 au telephone). `StepEvent.mask` : bit k = `INSTRUMENTS[k]`.
Re-programmation de TOUTE l'horloge a chaque changement (`ask` -> `askReschedule(me)`) : pas, verrous, mutes, kit,
`hitKey()` (chaine de tous les reglages de coup de toutes les voix), swing.

**`audio/morph.ts`** (scenes) : `VOICES` local, `effVoice`/`effHit` par voix, `pitchVoices`, `InsertNeeds` par voix.

**`engine.ts`** : le pont SoundCloud (sans rapport avec la boite a rythmes).

### 2.8 Les scenes (`rytm/sceneData.ts`, `rytm/sceneParams.ts`)

- Une scene = `Record<id MIDI absolu, 0..1>`, 64 cles max ; `ID_RE /^rytm:[a-z0-9]+(?::[A-Za-z0-9]+){1,3}$/` (accepte
  `rytm:voice:T9:decay`).
- Aujourd'hui seulement `rytm:enc:*` et `rytm:voice:<V>:<VoiceParam>` sont enregistrables (`HEAVY_RECORDABLE = false` :
  kit et couches hors scene ; trigs et LFO hors scene).
- `cleanScenes(raw, rename?)` a deja un crochet de renommage (inutilise) : parfait pour normaliser des alias.

### 2.9 Presets et KIT (`state/presets.ts` cle `mm.v4.presets.1`, `state/factory.ts`, `state/presetMode.ts`)

- `RytmData` (l.114) = l'etat ENTIER de la machine : `steps, bpm, fx, stretch, voices: Record<Inst, VoiceFx>,
  kit (crans), sounds, locks?, machines, samples, layers, knobs, scenes?, pmutes?, trigs?`. 99 presets max, noms USER/NAME.
- `capture('mm808')` l.452 et `apply` l.497, `applyKit` l.573 (toutes les traductions d'heritage d'avant R3 et du
  2026-10-18). `rytmNow` l.696 normalise les vieux etats avant de calculer une empreinte (sinon etoile ou "YOUR SOUND"
  fantome).
- Brouillons YOUR SOUND (`mm.v4.presets.drafts.1`), empreintes `Mark` (canon).
- `factory.ts` : 10 styles ecrits a la main en forme ancienne (`steps: Partial<Steps>`, `voices: Partial<Record<Inst,
  Partial<VoiceFx>>>`, samples KICK/SNARE par nom) ; `rytmFactory()` l.386 complete aux 8 voix. Lu COMME DU TEXTE par
  `scripts/mm-studio-patterns.mjs` (pages SEO de motifs) : ne pas changer sa forme sans changer le script.

### 2.10 UNDO (`state/undo.ts`, cle `mm.v4.undo.1`, 1,5 Mo max, 20 etapes retenues)

- Une etape = `capture()` (la forme `RytmData`) + l'emplacement. La signature des stores lit `voiceFx.get()`,
  `kit.get()` (l.161) ; `safeWatch('mm808', [pattern, pattern.fx, mix, voiceFx, kit, patterns, pattern.scenes])` (l.568).
- Les etapes retenues avant la mise a jour sont en forme ancienne : `apply` doit les lire.

### 2.11 SHARE (`state/share.ts`, `audio/beatcode.ts`, version 1)

- `?m=rytm&b=<base64url>` ; listes FIGEES `INSTS_V1`, `FAMS_V1`, `MODELS_V1`, `LAYER_V1`, `KNOBS_V1`, `VOICE_V1`,
  `FX_V1` et leurs departs ; masque de voix sur 8 bits ; pas de verrous, scenes, trigs ni LFO ; CRC-8 ; lecture stricte.
- `dataOfBeat` produit un `RytmData` en forme ancienne (voices + kit par famille) : il peut rester tel quel si `apply`
  convertit.
- `scripts/mm-studio-patterns.mjs` compile `beatcode.ts` avec esbuild pour fabriquer les liens des pages SEO.

### 2.12 MIDI (`midi/targets.ts`, `midi/midi.ts` cle `mm.v4.midi.1`, `midi/rotoKeys.ts`, `midi/roto.ts`, `midi/seqlink.ts`)

- 891 cibles en tout (`docs/midi/MIDI-targets.csv`, regenere par `npm run docs:midi` = `scripts/midi-reference.mjs`),
  dont 656 du MM-RYTM.
- Par voix : 48 ids (`rytm:voice:<V>:<p>` x 45 : 19 VoiceParam, mute, 9 trig, 16 LFO ; plus `rytm:pad:<V>`,
  `rytm:seq:voice:<V>`, `rytm:voice:select:<V>`) : 384 ids lies aux 8 voix.
- Par famille : `rytm:kit:<famille>` (choix du son), `rytm:kit:<potard>` (10, globaux), `rytm:layer:<famille>:<p>` (9 x 8).
- Regle de toutes les etapes D : aucun id ne disparait ni ne change d'ordre ; les nouveaux a la fin.
- `midi.ts:245 targetNow()` : renommage a la lecture des assignations apprises (precedent : `rytm:kit:hh` ->
  `rytm:kit:ch`) ; `RETIRED_TARGETS`.
- `rotoKeys.ts` : adresses du Roto GELEES (setup, canal, CC, cible) ; on n'ajoute qu'a la fin. Les pages RYTM, MIXER et
  LIVE citent `rytm:voice:<V>:level`, `:mute`, `rytm:pad:<V>`, `rytm:kit:*` des 8 voix.
- `seqlink.ts` (le Roto en sequenceur) : fenetres 1-8 / 9-16, `seqVoice(inst)`.

### 2.13 Le boitier (`hw/snapshot.ts`, `hw/rowLeds.ts`, `docs/hardware/mmhw-v2-app-side.md`)

- `HwSnapshot.voice: Inst | null` ; `leds.steps` : les pas 1 a 8 en vue TRK (`HwStepLed.inst`) ; vues 'pattern' 'trk'
  'mute' 'pmute' 'ptn' 'bank'. Le pont externe (protocol.js) lit ces champs : ajouter, ne rien renommer.

### 2.14 L'interface qui depend des 8 voix

- Desktop : `actions.ts` (padHit, voiceSelect, trkStep `INSTRUMENTS[i]` pour i < 8, trkMute, muteModeKey, soundFamily,
  voiceSounds, kitDial, kitLayerDial, CONTROL ALL `ctlAllApply`, copy/paste de ligne, random, sound browser,
  soundFilesAdd par famille), `scene/screen.ts` (noms de voix, vue MIXER par 4), `scene/renderer.ts` (flash par bit du
  masque), `scene/sequencer3d.ts` (`TRK_STEP_OF`, legendes `stepv-<V>`), `ui/Hotspots.tsx`, `rytm/pages.ts`
  (`pageSlots(screen, inst)` : SRC depend de la voix, MIXER_VOICES), `rytm/pageView.ts` (`noBd`), `rytm/infos.ts`,
  `rytm/infoIds.ts` (une carte par famille), `rytm/diagrams.ts` (clap, "THE MIX REFERENCE" pour BD),
  `rytm/stepLeds.ts` (trkLeds, muteLeds : 8 pas, 9 a 16 eteints), `rytm/trigMarks.ts`, `rytm/faceKnobs.ts`,
  `scene/rytmTweaks.ts` (la plaque TWEAKS sous le capot : potards globaux du kit), `state/lcd.ts` (`composeMix` par
  banques de 4), `state/lcdMix.ts`, `state/lcdSamples.ts` (depot de fichier sur une voix), `state/rytmPage.ts`
  (`vel: Record<Inst, number>` : la velocite des nouveaux pas, retenue sous `mm.v4.rytm.page.3`), `hooks/useKeys.ts`
  (A S D F Z X C V), `debug.ts`.
- Telephone (PORTRAIT, gele depuis D1) : `theme.ts PADS` (8 pads + EDIT + OPEN), `scene/pads.ts`, `ui/Dock.tsx`
  (8 voix), `ui/BeatEditor.tsx` (8 rangees), `ui/KnobPanel.tsx`.
- Repli sans WebGL : `fallback/StaticMachine.tsx` (DEFAULT_STEPS, 8 voix).

### 2.15 Toutes les cles de stockage du MM-RYTM

| Cle | Contenu | Touchee par la refonte |
|---|---|---|
| `mm.v4.pattern.3` (+ `.2` lue une fois) | motif courant, FX globaux, verrous, scenes, pmutes, trigs | rangees 9-16 en plus, sinon inchangee |
| `mm.v4.patterns.1` | 128 emplacements | idem ; kit par pattern en E3 |
| `mm.v4.kit.1` | kit par famille | lue une fois -> `mm.v4.rytm.tracks.1` |
| `mm.v4.rytm.voices.1` | reglages des voix | idem |
| `mm.v4.rytm.stretch.1` | STRETCH | inchangee |
| `mm.v4.rytm.page.3` (+ `.2`) | page, onglets, velocite des nouveaux pas par voix | 16 velocites |
| `mm.v4.presets.1`, `.drafts.1`, `.user.1` | presets, YOUR SOUND, utilisateur | forme RytmData v2 |
| `mm.v4.undo.1` | historique | forme v2, lit l'ancienne |
| `mm.v4.midi.1` | assignations MIDI | ids inchanges, alias T1..T8 |
| `mm.v4.rytm.user.1` + IndexedDB `mm-v4-rytm-user` | samples deposes | inchanges (categorie = famille) |

---

## 3. Le modele cible [CIB]

### 3.1 Principe : la piste est un index, sa cle reste BD..CY pour 1 a 8

- En memoire, une piste est un index 0 a 15. Sa CLE (stockage, MIDI, scenes, liens) :
  `TRACK_KEYS = ['BD','SD','CH','OH','CP','TOM','HT','CY','T9','T10','T11','T12','T13','T14','T15','T16']`.
- Les cles BD..CY deviennent des NOMS DE PISTE (1 a 8), plus des sons : la piste 1 garde la cle `BD` meme si on y met une
  caisse claire. C'est ce qui rend toutes les donnees d'avant lisibles telles quelles et garde tous les ids MIDI.
- Alias acceptes a la lecture partout (MIDI appris, scenes, verrous, liens v2) : `T1`..`T8` -> `BD`..`CY`
  (`normTrackKey`). Jamais ecrits.
- A l'ecran et dans les noms MIDI : "T1" a "T16" et le nom du son ("T1 BLUEPRINT", "T9 PSY 12") ; les libelles MIDI des
  ids d'avant deviennent "T1 VOL" (le nom n'est pas l'id).
- `ShotId` cesse d'etre `Inst` : `EngineId = 'BD'|'SD'|'CH'|'CHopen'|'OH'|'CP'|'TOM'|'HT'|'CY'` (les 9 algorithmes de
  `shotsdsp.ts`, inchanges) ; `KitFamily` reste la famille du moteur ET la categorie du pool de samples.

### 3.2 Les types

```ts
// audio/tracks.ts (nouveau) : pur en tete, le store ensuite

export const TRACK_COUNT = 16;
export const TRACK_KEYS = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16'] as const;
export type TrackKey = (typeof TRACK_KEYS)[number];
/** l'ancien Inst : les 8 premieres pistes (vieilles donnees, telephone tant qu'il reste a 8) */
export const LEGACY_KEYS = TRACK_KEYS.slice(0, 8) as readonly TrackKey[];
export const trackIndex = (k: TrackKey): number => TRACK_KEYS.indexOf(k);
/** une cle lue (BD..CY, T1..T16, casse libre) ; null si inconnue */
export function normTrackKey(k: unknown): TrackKey | null;

/** La machine SRC (le menu MACHINE, FUNC + SRC). Ordre FIGE (son rang va dans le lien SHARE v2). */
export const SRC_MACHINES = ['oneshot', 'bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'] as const;
export type SrcMachine = (typeof SRC_MACHINES)[number];   // 'oneshot' | KitFamily
export const MACHINE_LABEL: Record<SrcMachine, string> = {
  oneshot: 'ONESHOT', bd: 'KICK', sd: 'SNARE', ch: 'CL HAT', oh: 'OP HAT', cp: 'CLAP', tom: 'LO TOM', ht: 'HI TOM', cy: 'CYMBAL',
};
/** La machine FLTR (E2). 'legacy' = le filtre d'aujourd'hui (LP HP BP par biquad). */
export type FltrMachine = 'legacy' | 'multi' | 'lp4' | 'eq';

/** Tous les reglages numeriques d'une piste, dans l'espace des verrous (audio/locks.ts LockId, hors reglages de trig). */
export type TrackParamId =
  | VoiceParam                 // tone decay level dist reverb delay chorus tune pan start atk hold fine ftype fcut freso fenv fatk fdec
  | KitLockId                  // ktune kattack kdecay kdrive ksweep snappy gate sdtune sddecay sdtone
  | LayerLockId                // syn slev stune sfine sstart slen srev
  | LfoParam                   // l1* l2* (E2 : l3*)
  | NewParamId;                // E2, voir 3.4

export interface TrackSound {
  /** SRC */
  mach: SrcMachine;
  model: KitModel;             // '909' | '808' | 'mm' (une synthese ; garde, sans effet, en ONESHOT)
  snd: string;                 // cle du sample ('' : OFF) ; sa categorie = son dossier
  /** FLTR (E2) */
  fmach?: FltrMachine;         // absent : 'legacy'
  /** les reglages : complets en memoire, seulement ce qui quitte TRACK_P_DEFAULT au stockage */
  p: Readonly<Record<TrackParamId, number>>;
  /** E3 : le nom de ce son quand il vient d'un preset de piste */
  name?: string;
}

/** Le comportement de voix d'une piste (dans le kit, pas dans le preset de son). */
export interface TrackVoice {
  vmode: 'mono' | 'poly';      // DT2 : mono ; heritage : BD et OH mono, les autres poly
  choke: 0 | 1 | 2 | 3 | 4;    // groupe de choke ; 0 aucun ; heritage CH et OH : 1
  gated: boolean;              // un coup du groupe coupe cette piste (heritage : OH oui, CH non)
}

/** Ce que la DT2 range dans le kit en plus des 16 sons (MIXER, menu KIT). */
export interface KitMix {
  tlev: readonly number[];     // 16, TRK LEV, meme loi que level (0.8 = 0 dB) ; E2
  ctlAll: number;              // CONTROL ALL CONFIG, masque 16 bits (0xFFFF)
  compRoute: number;           // COMPRESSOR ROUTING, masque (E2 ; 0xFFFF = tout passe, comme aujourd'hui)
  scSrc: number;               // la piste source du SIDECHAIN ARP/BASS (0 = T1, comme aujourd'hui)
}

export interface Kit16 {
  v: 1;
  tracks: readonly TrackSound[];   // 16
  voice: readonly TrackVoice[];    // 16
  mix: KitMix;
}

/** Forme stockee : diffs seulement ; les pistes vides absentes. */
export interface StoredKit16 {
  v: 1;
  t?: Partial<Record<TrackKey, { m?: SrcMachine; mo?: KitModel; s?: string; f?: FltrMachine; p?: Partial<Record<TrackParamId, number>>; vm?: 'mono' | 'poly'; ch?: number; g?: 1 }>>;
  mix?: Partial<{ tlev: Partial<Record<TrackKey, number>>; ctlAll: number; compRoute: number; scSrc: number }>;
}
```

Le motif (inchange dans sa forme, elargi) :
```ts
export type Steps = Record<TrackKey, string>;          // 16 rangees EN MEMOIRE (vides = '0' x len)
// serialize : rangees 1 a 8 toujours ecrites (octet pour octet comme avant), 9 a 16 seulement si non vides
export interface StoredPattern {
  v: 1; bpm: number; steps: Partial<Steps>; fx: Fx;
  locks?: Locks;               // Partial<Record<TrackKey, Record<'0'..'127', StepLock>>>
  scenes?: StoredScenes;
  pmutes?: TrackKey[];
  trigs?: TrigSet;             // Partial<Record<TrackKey, TrigRow>>
  setup?: PatternSetup;        // V.5.4 / E3 : longueur et vitesse
  kit?: string;                // E3 : l'id du kit de ce pattern dans le pool (voir 3.6)
}
export interface PatternSetup {
  len: number;                 // 1 a 128 (16 aujourd'hui)
  mode?: 'ptn' | 'trk';        // PER PATTERN / PER TRACK
  speed?: number;              // 1/8X ... 2X
  trk?: Partial<Record<TrackKey, { len: number; speed: number }>>;
}
```
`PatternState.instrument: TrackKey | null` (meme champ, elargi ; la DT2 a toujours une piste active : on garde null pour
la compatibilite mais il ne vaut jamais null au desktop). `voices.muted / solo: TrackKey[]`. `rytmPage.vel:
Record<TrackKey, number>`. `SeqState.v: Record<TrackKey, SeqVoice>`, NEI = piste n-1. `StepEvent.mask` sur 16 bits.

### 3.3 Les machines SRC et la banque

| Machine | Moteur (`EngineId`) | Calcul | Reglages SRC propres |
|---|---|---|---|
| ONESHOT | la categorie du sample (`familyShot(sampleFamily(snd))`), BD par defaut | `renderLayers` avec `syn = 0` : le sample seul, cale sur sa categorie (exactement le chemin d'un sample lock d'aujourd'hui) | snd, stune, sfine, sstart, slen, srev, slev (E2 : splay, sloop) |
| KICK (bd) | BD | 909 / 808 / MM + couche SAMPLE | model, ktune, kattack, ksweep, kdecay, kdrive, syn/slev (MIX) + couche |
| SNARE (sd) | SD | idem | model, sdtune, snappy, sdtone, sddecay, gate, MIX + couche |
| CL HAT (ch) | CH (CHopen au pad tenu) | idem | model, MIX + couche |
| OP HAT (oh) | OH | idem | model, MIX + couche |
| CLAP (cp) | CP | idem | model, gate, MIX + couche |
| LO TOM (tom), HI TOM (ht), CYMBAL (cy) | TOM, HT, CY | idem | model, MIX + couche |

- La banque ("le pool") : les samples du site par categorie (les 8 dossiers) + ceux de ce navigateur. Un sample se choisit
  depuis n'importe quelle categorie, sur n'importe quelle piste (sous une synthese, il garde le caractere et le niveau de
  sa categorie : la regle `from` de `viewOf`/`sampleCal`, deja codee pour les sample locks).
- La liste SOUND d'aujourd'hui (OFF, 909, 808, MM, les samples de la famille) devient un raccourci : un modele ->
  `mach = <famille de la piste ou choisie>`, `model`, `syn = 1` ; un sample -> `mach = 'oneshot'`, `snd`.
- Les pistes 9 a 16 partent en `ONESHOT`, `snd = ''` (OFF) : muettes. C'est ce qui garantit l'identite audio.

### 3.4 L'espace des reglages = l'espace des verrous

Un reglage a UN id, le meme pour le son de la piste, le P-LOCK, la cible MIDI `rytm:voice:<K>:<id>`, la cle de scene,
CONTROL ALL, le lien SHARE v2. Le code fait deja `lock?.x ?? fx.x` partout (`hitParams`) : il suffit que la base vienne
de `tracks` au lieu de `voiceFx` + `kit`.

| id | Page DT2 | Domaine, depart | Aujourd'hui | Etape |
|---|---|---|---|---|
| tune, fine | SRC TUNE (et TRIG NOTE) | -1..1, 0 | voiceFx | E1 |
| tone | FLTR (MM, hauteur + filtre) | -1..1, 0 | voiceFx | E1 |
| start | SRC STRT (tout le tampon) | 0..1, 0 | voiceFx | E1 |
| level | AMP VOL (verrouillable) | 0..1, 0.8 | voiceFx | E1 |
| decay, atk, hold, pan | AMP DEC ATK HOLD PAN | | voiceFx | E1 |
| ftype fcut freso fenv fatk fdec | FLTR 1 | | voiceFx | E1 |
| dist | FX OVER | 0..1, 0 | voiceFx | E1 |
| reverb, delay | FX REV DEL (envois) | 0 | voiceFx | E1 |
| chorus | CHORUS en insert (MM) | 0 | voiceFx | E1 (E2 : voir chr) |
| ktune kattack kdecay kdrive ksweep | SRC (KICK) | 0..1 | kit.knob GLOBAL | E1 (par piste) |
| snappy sdtune sddecay sdtone | SRC (SNARE) | 0..1 | kit.knob GLOBAL | E1 |
| gate | SRC (SNARE, CLAP) | 0/1 | kit.knob GLOBAL (SD+CP) | E1 |
| syn slev | SRC MIX / LEV | 0..1, 1 | kit.layer | E1 |
| stune sfine sstart slen srev | SRC (couche SAMPLE) | | kit.layer | E1 |
| l1* l2* | MOD 1, 2 | entiers | voiceFx | E1 |
| l3* | MOD 3 | entiers | nouveau | E2 |
| sus, rel, amode, arst | AMP SUS REL MODE RSET | | nouveau | E2 |
| fsus, frel, fdel, fkey, frst | FLTR 1 et 2 | | nouveau | E2 |
| fbase, fwid, bwrt | FLTR 2 BASE WIDTH BW.RT | 0, 1, pre | nouveau | E2 |
| br, srr, srrt, odrt | FX BR SRR ROUT OD.RT | | nouveau | E2 |
| chr | FX CHR (envoi chorus) | 0 | nouveau | E2 |
| splay, sloop | SRC PLAY, LOOP (ONESHOT) | | nouveau | E2 |
| tlev | TRK LEV (non verrouillable, kit) | 0.8 | nouveau | E2 |

Reglages de trig (par pattern, pas dans le son) : `TRIG_PARAMS` d'aujourd'hui + E2 `fltt` (FLT.T), `ptim`, `port`
(portamento), et la velocite par defaut (`rytmPage.vel` aujourd'hui, a ranger dans `trigs` avec le kit en E3).
Chaines du verrou : `snd` (sample lock, inchange), `mach` (modele, inchange), E3 `prs` (preset lock : rang dans le pool).
Les listes `LFO_PARAMS`, `LFO_DESTS`, `TRIG_PARAMS` s'allongent PAR LA FIN (les indices stockes restent justes).

### 3.5 Le comportement de voix d'une piste (ce qui remplace les `inst === 'BD'`)

| Aujourd'hui | Cible |
|---|---|
| `inst === 'BD' ? kickBus : bus` | `routeOf(t)` DERIVE : moteur de la piste = bd -> voie du kick, sinon le bus (une piste KICK neuve a le meme traitement que le kick d'aujourd'hui) [DEC 7] |
| `chokeBD` / `bdGate` | `vmode = 'mono'` : une porte par piste, le coup suivant de la piste coupe le precedent (3 ms avant de frapper, la loi du BD) |
| `chokeOH` / `ohGate` | `choke` groupe + `gated` : un coup de n'importe quelle piste du groupe ferme les portes `gated` du groupe (8 ms) |
| `CHopen` | moteur ch : le pad tenu joue `CHopen` |
| `hp.kick = inst === 'BD' && kit.kickWith(ko)` | `t === mix.scSrc && kickWith(...)` (un son d'une autre famille sur cette piste n'est pas un kick, comme aujourd'hui) |
| `clock.hitKey` BD | piste `scSrc` |
| GATE partage SD+CP | `p.gate` par piste |

Migration du comportement (identite) : BD `{mono, 0}`, SD `{poly, 0}`, CH `{poly, choke 1, gated false}`, OH `{mono,
choke 1, gated true}`, CP TOM HT CY `{poly, 0}` ; T9..T16 `{mono, 0}` (la DT2). [DEC 2] : passer aussi 2 a 8 en mono.

### 3.6 Ou vit le kit

- E0 a E2 : un kit GLOBAL (comme aujourd'hui `kit` + `voiceFx`), store `tracks`, cle `mm.v4.rytm.tracks.1`.
- E3 (la structure DT2) [DEC 1] : chaque pattern a son kit. Stockage par POOL dedoublonne pour tenir dans le
  localStorage : `kits: Record<hash, StoredKit16>` + `slotKit: (hash | null)[128]` dans `mm.v4.patterns.2` (ou IndexedDB).
  Copier un pattern ne copie que le hash. Migration : chaque emplacement non vide recoit le hash du kit global du moment
  (rien ne change a l'oreille au chargement). Les FX globaux (`pattern.fx` : DELAY REVERB CHORUS COMP...) et TRK LEV
  entrent dans le kit, comme la DT2 [M2 1477] ; BPM et swing deviennent ceux du pattern (option, [DEC 10]).
- Le changement de pattern a la mesure (`onBar`) pose le kit du pattern suivant a l'heure de la mesure (comme
  `scenes.replace(next, at)`), les reglages de tranche par automation programmee (aujourd'hui `applyVoice` glisse tout
  de suite : a refaire avec une heure).

### 3.7 Les stores et leurs API

- `tracks` (nouveau, `audio/tracks.ts`) : `get()`, `of(t)`, `param(t, id)`, `set(t, id, v)`, `setMany(t, patch)`,
  `machine(t, mach, model?)`, `sample(t, key)`, `voice(t, patch)`, `mix(patch)`, `replace(kit16, at?)`, `swap(a, b)` (E2
  TRACK SWAP), `subscribe(fn(changed: TrackKey[]))` (comme `kit.subscribe(changed)` aujourd'hui), `tweak(t, ov?)`,
  `sig(t, ov?)`, `engine(t)` (l'EngineId).
- Facades pendant la transition (E0, E1) : `voiceFx.of(inst)` = `tracks.voiceView(t)` et `kit.tweak(id)` = par piste,
  pour ne pas toucher 125 + 62 appels d'un coup ; a retirer en E2.
- `audio/kit.ts` garde le PUR (loi des couches, mixOf, KIT_MODELS, labels, `foldFamilies`, `resolveSample`, la lecture
  de `mm.v4.kit.1` pour la migration) ; son store devient une vue de `tracks`.

### 3.8 Le moteur cible

- `drums.ts` : 16 tranches ; celles de 9 a 16 construites a la premiere utilisation (une piste qui a un son) : au repos
  le graphe est celui d'aujourd'hui. Portes par piste (mono, choke) au lieu de `bdGate`/`ohGate`. `hitParams(t, ...)`
  prend le moteur de la piste. Les rendus hors ligne (`OfflineOpts.steps`, `voice`, `single`, `dcInto`...) prennent des
  `TrackKey`.
- `shots.ts` : la cle du cache reste `${EngineId}|...|${sig}` (deux pistes au meme son partagent le calcul) ; tout
  l'etat par voix (`lastVar`, `lastPlayed`, `lastReq`, `substituted`, `choiceAt`, `choiceTimer`) passe PAR PISTE
  (`TrackKey`). `shots.get(t, engine, ...)`. Prechauffage : les sons distincts des 16 pistes, dans l'ordre du motif.
- `clock.ts` : `hitKey` par piste et re-programmation de la seule piste qui change (voir 5.3).
- `seq.ts`, `morph.ts`, `seqhit.ts`, `lockfx.ts` : iteration sur 16.

---

## 4. Migration [CIB]

### 4.1 Regle generale

- Une seule fonction pure `kit16FromLegacy(kit: Kit, voices: Record<Inst, VoiceFx>): Kit16` (avec les traductions
  d'heritage deja en place en amont : `foldFamilies`, `KIT_V`, `oldOh`, `fromR2`, `compLegacy`), appelee par : le
  chargement du store, `presets.apply`, `rytmNow` (empreintes), `undo` (etapes anciennes), `share.dataOfBeat`, les presets
  d'usine.
- Les vieilles cles ne sont jamais effacees en V.6.0 et V.6.1 ; on y RE-ECRIT au mieux (pistes 1 a 8) pour qu'un retour
  arriere du deploiement retrouve un son proche [DEC] ; arret de cette double ecriture en V.6.2.

### 4.2 `kit16FromLegacy`, l'algorithme exact

Pour i = 0..7, f = `KIT_FAMILIES[i]` (bd sd ch oh cp tom ht cy, meme ordre que `INSTRUMENTS`), K = `TRACK_KEYS[i]` :
1. `mach = f` (TOUJOURS la synthese de la famille, meme si syn = 0 : on garde le modele et les potards "prets" que les
   presets d'usine accordent sur F#) ; `model = kit.model[f]` ; `snd = kit.sample[f] ?? ''`.
2. `p` = `voices[K]` (19 reglages + LFO presents) ; + les 10 potards GLOBAUX copies tels quels sur CHAQUE piste
   (`ktune = knob.tune`, `kattack = knob.attack`, `kdecay = knob.decay`, `kdrive = knob.drive`, `ksweep = knob.sweep`,
   `snappy`, `gate`, `sdtune`, `sddecay`, `sdtone`) : seuls ceux du moteur de la piste comptent (`sigOf`), et le GATE
   commun de SD et CP arrive sur les deux ; + la couche : `syn = layer.syn`, `slev = layer.lev`, `stune = layer.tune`,
   `sfine = layer.fine`, `sstart = layer.start`, `slen = layer.len`, `srev = layer.rev`.
3. `voice` selon 3.5 ; `mix = { tlev: 0.8 x 16, ctlAll: 0xFFFF, compRoute: 0xFFFF, scSrc: 0 }`.
Pour i = 8..15 : `TRACK_EMPTY` (ONESHOT, OFF, `TRACK_P_DEFAULT`, mono).

Pourquoi c'est exact : le moteur, le `ShotTweak` et la signature d'une piste migree sont ceux de la voix d'avant
(memes cles de cache, memes AudioBuffer), la tranche est la meme, la route du kick aussi. Seule difference de
comportement voulue : apres migration, regler le SNAPPY de T2 ne change plus un sample de caisse claire verrouille sur T1
(il garde la copie de T1) ; a ecrire dans le rapport.

### 4.3 Table par donnee

| Donnee | Ancien format | Regle | Verification |
|---|---|---|---|
| Motif courant `mm.v4.pattern.3` | Steps 8 cles | lu tel quel, rangees 9-16 a zero ; ecrit 1-8 toujours, 9-16 si non vides : JSON octet pour octet sans piste 9-16 | JSON relu = JSON ecrit (fixture V.5.2) |
| Emplacements `mm.v4.patterns.1` | 16 ou 128 slots, 8 cles | idem (`validSteps` sur 16) | fixtures 16 slots (V.5.1) et 128 (V.5.2) |
| Verrous | cles BD..CY, pas '0'..'15', LOCKS_V 3 | `cleanLocks` sur `TRACK_KEYS` + `normTrackKey` ; pas jusqu'a 127 quand les longueurs arrivent | `sameLocks` ancien/nouveau |
| Trigs, pmutes | cles BD..CY | `cleanTrigs`/`cleanPmutes` sur 16 | idem |
| Kit + voix | `mm.v4.kit.1` (KIT_V 2 a 4), `mm.v4.rytm.voices.1` | `kit16FromLegacy`, ecrit `mm.v4.rytm.tracks.1` | identite audio (4.4) |
| Presets `mm.v4.presets.1` | RytmData v1 (et d'avant R3, d'avant 2026-10-18) | `apply` : `tracks` present -> le prendre ; sinon `applyKit` actuel vers un Kit puis `kit16FromLegacy` ; `capture` ecrit `tracks` (plus voices/kit/sounds/machines/samples/layers/knobs) | chaque preset d'usine et 3 presets anciens : rendu identique |
| Empreintes (Mark) et brouillons | idem | `rytmNow` convertit avant `canon` (sinon etoile ou YOUR SOUND fantome au premier chargement) | presets charges : pas d'etoile |
| Presets d'usine `factory.ts` | forme ancienne, lue en texte par `mm-studio-patterns.mjs` | NE PAS la changer en E1 : conversion au chargement | `npm run build` : pages SEO identiques |
| UNDO `mm.v4.undo.1` | RytmData v1 | `apply` lit les deux | UNDO apres mise a jour rend l'etat d'avant |
| SHARE v1 | 8 voix, figee | decodeur inchange -> `dataOfBeat` (ancien) -> `apply` convertit. Encodeur : v1 si le beat s'y represente (pistes 9-16 vides, `mach` = famille de la piste, GATE egal sur T2 et T5, potards de kick de T1 et de caisse claire de T2), sinon v2 : les liens d'un beat a 8 voix restent les memes | liens des pages SEO identiques ; aller-retour v2 |
| SHARE v2 (nouveau) | | version 2 : masque de pas 16 bits, par piste machine (rang `SRC_MACHINES`), modele, sample (categorie, rang, empreinte), masque de reglages sur une liste FIGEE `TRACK_P_V2`, comportement, mix ; puis enfin les verrous, trigs, LFO (promis depuis la v1) ; `BEAT_MAX_CHARS` 1200 -> environ 4000 | aller-retour exact, lecture stricte |
| MIDI appris `mm.v4.midi.1` | ids `rytm:voice:<V>:<p>` etc. | AUCUNE conversion : memes ids, meme sens (la piste) ; `targetNow` accepte `T1..T8` -> BD..CY | CSV : aucun id d'avant retire ni deplace |
| `rytm:kit:<famille>`, `rytm:kit:<potard>`, `rytm:layer:<f>:<p>` | globaux / par famille | gardes, libelles LEGACY, pointent sur la piste FIXE de la famille (bd -> T1 ... cy -> T8) ; `rytm:kit:gate` ecrit T2 ET T5 (son sens d'avant) | Roto RYTM et LIVE pilotent comme avant |
| Scenes | `rytm:enc:*`, `rytm:voice:<V>:<p>` | aucune conversion ; `cleanScenes(raw, normScene)` pour T1..T8 | scenes rejouees identiques |
| Roto `rotoKeys.ts` | lignes gelees | aucune ligne changee ; nouvelles pages (T9-T16 VOL, MUTE) ajoutees a la fin | `npm run docs:midi` diff |
| Boitier | `voice: Inst`, steps 1-8 | `voice: TrackKey` garde + `track: number` + `trackName` ; `leds.steps` 16 en vue TRK et MUTE ; documenter dans `mmhw-v2-app-side.md` | `npm run hw:test` |
| `mm.v4.rytm.page.3` | `vel` 8 cles | complete a 16 (HIGH) | |
| Samples deposes | `<famille>/u:<id>` | inchanges ; deposer sur une piste ONESHOT range le fichier dans la categorie du sample de la piste, sinon dans celle de son moteur [DEC 11] | |

### 4.4 Les portes de migration (a ajouter aux portes D : tsc a 13, build, smoke, hw:test, presets:test, firmware check)

- **Fixtures** : capturer AVANT de commencer, depuis la V.5.2/V.5.3 en ligne, un `localStorage` complet du MM-RYTM
  (motif, 128 emplacements, kit KIT_V 4, voix avec LFO, 5 presets dont un d'avant R3 et un d'avant le 2026-10-18,
  UNDO, MIDI avec `rytm:kit:hh`) et 3 liens SHARE ; les ranger dans `scripts/fixtures/rytm-legacy-*.json` (pas de son,
  pas de donnees privees).
- **Identite audio** (la sonde `ident.cjs`/`cmp.cjs` de D2, rendus hors ligne, jamais une ecoute) : pattern d'arrivee,
  pattern verrouille, chaque preset d'usine, un pattern a scenes : ecart <= 1e-6 contre la V.5.x, pistes 9 a 16 vides.
- **Idempotence** : charger, sauver, recharger donne le meme JSON ; un preset charge n'a pas d'etoile.
- **MIDI** : diff du CSV regenere : seulement des lignes ajoutees a la fin.
- **Telephone** (`?portrait=1`) : identique au pixel pres tant qu'il reste a 8 pistes.

---

## 5. Budget CPU et memoire (Web Audio)

### 5.1 Mesure du calcul des one-shots (hors ligne, Node, 48 kHz, aucun son)

`renderLayers` de `shotsdsp.ts` compile par esbuild, moyenne de 3 rendus (`scratchpad/dt2/bench/bench.cjs`) :

| Moteur | 909 ms / Ko | 808 ms / Ko | MM ms / Ko | variantes |
|---|---|---|---|---|
| BD | 80 / 252 | 120 / 430 | 14 / 73 | 1 |
| SD | 17 / 68 | 13 / 56 | 21 / 56 | 3 |
| CH | 9 / 37 | 8 / 46 | 5 / 17 | 4 |
| CHopen | 22 / 119 | 17 / 177 | 10 / 60 | 2 |
| OH | 50 / 281 | 57 / 338 | 46 / 206 | 3 |
| CP | 18 / 106 | 25 / 175 | 36 / 124 (stereo) | 3 |
| TOM | 35 / 206 | 51 / 328 | 19 / 84 | 1 |
| HT | 27 / 159 | 36 / 234 | 11 / 65 | 1 |
| CY | 111 / 600 | 100 / 600 | 91 / 600 (stereo) | 2 |

Lecture : un son coute 5 a 120 ms de worker (un telephone : compter x3 a x5) et 17 a 600 Ko. Les 9 moteurs en MM : 253 ms
pour une variante de chacun, 2,7 Mo avec toutes leurs variantes. 16 pistes aux sons tous differents : de
l'ordre de 16 x 2,5 variantes x 40 ms = 1,6 s de worker au desktop (5 a 8 s au telephone) et 10 a 20 Mo de cache,
dans les budgets d'aujourd'hui (96 Mo / 40 Mo, 240 entrees). Les samples du site sont du PCM decode (budget 160 / 48 Mo).

### 5.2 Ce qui coute pendant la lecture

| Poste | Aujourd'hui (8 voix) | 16 pistes, sans precaution | Remede [CIB] |
|---|---|---|---|
| Tranches au repos | 8 x (4 gains, inserts en bypass reel) | 16 x : negligeable | tranches 9-16 paresseuses |
| CHORUS par piste (worklet sinc 16 points, 2 lignes) | 0 a 8 worklets | jusqu'a 16 worklets : le poste le plus lourd du thread audio | E2 : CHR en ENVOI vers UN chorus (la DT2 [M2 3141]) ; l'insert `chorus` reste pour les pistes migrees qui l'utilisent [DEC 3] |
| DIST par piste (WaveShaper, sans surechantillonnage) | 0 a 8 | 0 a 16 : leger | rien |
| REVERB (convolueur, jusqu'a 8 s stereo), DELAY | 1 + 1 partages (+ la reverbe de l'ARP) | inchange | rien |
| Glue (BIT + COMP) et limiteur | 2 worklets | inchange | rien |
| Noeuds par coup | 1 source + 0 a 8 (gains, pan, biquad, porte) | x2 de pistes ; un retrig 1/80 sur plusieurs pistes : des centaines de coups par seconde | plafond de repetitions par pas, le coup precedent coupe (deja fait par piste) |
| Queues qui se recouvrent | BD et OH mono, les autres poly | 16 pistes poly : jusqu'a 100+ sources (CY 1,6 s, OH 1,1 s) | pistes mono (DT2 : 16 voix) ; une piste poly d'heritage plafonnee a 4 sources (la plus vieille coupee en 8 ms) ; plafond global 48 sources desktop, 24 telephone |
| Nouveaux filtres DT2 (E2) | | base-width : 2 biquads par coup, LP4 : 2 biquads, EQ : 1 biquad, seulement hors neutre | rien |
| BR et SRR (E2) | BIT global seulement (glue) | un worklet par piste si temps reel | les calculer DANS le worker au rendu du coup (dans la signature) : zero cout audio ; un P-LOCK se prepare a l'avance comme TUNE (`prepareLocks`), un LFO dessus se prend au coup ; ROUT = PRE (avant le filtre du coup) d'office [DEC 12] |
| COMB- / COMB+ (E2) | | un DelayNode dans une boucle a un minimum de 128 echantillons : aucun peigne au-dessus de 375 Hz | hors portee (ou un worklet par piste, a mesurer) |
| 3 LFO en courbe (`lfoCurves`) | 2 x 8 | 3 x 16, des courbes calculees sur le fil principal a chaque coup | resolution des courbes bornee ; rien pour un LFO a DEP 0 (deja) |

### 5.3 Ce qui coute sur le fil principal (le vrai risque : "le son se coupe", 2026-10-05 et #71)

- **Re-programmation** : chaque changement d'un reglage de coup re-programme TOUTE l'horloge (annule et refait 300 ms,
  450 au telephone, de coups : avec 16 pistes denses, 40 a 70 voix a chaque cran de potard). Remede : `hitKey` par piste
  et `askReschedule(piste)` : seuls les coups de la piste tournee sont refaits (division par 16 au pire).
- **Preparations** : `prepareLocks` et `prepareScenes` bouclent sur les voix et les pas ; avec 16 pistes et 128 pas,
  borner par piste changee.
- **File du worker** : un seul calcul a la fois. Un changement de pattern qui change de kit (E3) demande jusqu'a 16 sons
  neufs avant la mesure suivante (1,6 a 2,4 s a 100-150 BPM) : precalculer le kit du pattern qui attend (`next`) et de
  toute la chaine des qu'ils sont connus ; au desktop, un second worker si `hardwareConcurrency >= 4`.
- **Construction des cibles MIDI** : de 656 a environ 1 700 cibles RYTM (16 x 48 + reglages de machine par piste
  16 x 17 + E2 environ 25 x 16) : la liste est construite une fois, a garder paresseuse dans le panneau MIDI.

### 5.4 Stockage (localStorage, environ 5 Mo pour TOUT le site)

| Poste | Aujourd'hui | Cible |
|---|---|---|
| Preset MM-RYTM | environ 4 Ko | 5 a 8 Ko (diffs seulement) ; 99 presets : 0,5 a 0,8 Mo |
| UNDO | <= 1,5 Mo (20 etapes x 2 piles) | inchange (le plafond le tient) |
| 128 emplacements | <= 128 x 8 x 16 car. | 16 pistes x 128 pas : jusqu'a 260 Ko de pas + verrous |
| Kits par pattern (E3) | 0 | sans dedoublonnage jusqu'a 128 x 6 Ko = 0,8 Mo : POOL par hash obligatoire ; IndexedDB conseillee pour patterns et presets en E3 |

---

## 6. Liste des fichiers et estimation

Tailles en lignes touchees (ajoutees ou modifiees), a 30 % pres. E0 et E1 sont souvent dans les memes fichiers : la
colonne dit l'etape principale.

### 6.1 Modele et moteur

| Fichier | Lignes | Ce qui change | Etape | Taille |
|---|---|---|---|---|
| audio/tracks.ts (NOUVEAU) | 0 | types, TRACK_KEYS, defauts, `kit16FromLegacy`, store, stockage, facades | E0 | 700 |
| theme.ts | 3055 | `Inst` -> alias de `TrackKey` ; `INST_NAMES`, `PAD_ARIA`, `VOICE_KEYS` a 16 (ou partiels), PADS du telephone sur LEGACY | E0/E1 | 80 |
| audio/pattern.ts | 754 | Steps 16, serialize 1-8 + 9-16 non vides, cleanPmutes, noteLocks sur 16, DEFAULT_STEPS partiel | E0 | 80 |
| audio/locks.ts | 424 | INSTS -> TRACK_KEYS, normTrackKey, STEPS variable | E0 | 50 |
| audio/trig.ts | 304 | INSTS -> 16 ; E2 fltt ptim port | E0/E2 | 20 / 80 |
| audio/lfo.ts | 207 | E2 : LFO 3, nouvelles DEST (a la fin) | E2 | 120 |
| audio/voicefx.ts | 291 | devient le PUR (lois, clamps) + facade de lecture sur `tracks` ; le store disparait en E2 | E0 | 120 |
| audio/kit.ts | 910 | le store devient une vue par piste ; `tweakOf`/`sigOf` par piste ; lecture de `mm.v4.kit.1` pour la migration | E0 | 250 |
| audio/shotsdsp.ts | 1393 | `ShotId` -> `EngineId` (type seul) ; E2 BR/SRR au rendu, PLAY/LOOP | E0/E2 | 20 / 200 |
| audio/shots.ts | 812 | etat par piste, `get(t, engine, ...)`, prechauffage des 16, `keepSample`, abonnement par piste | E0 | 180 |
| audio/drums.ts | 2960 | 16 tranches paresseuses, portes par piste (mono, choke), route derivee, scSrc, hitParams par moteur, OfflineOpts 16 ; E2 ADSR, base-width, LP4/EQ, CHR envoi ; E3 applyVoice a l'heure | E0/E2/E3 | 350 / 300 / 80 |
| audio/sends.ts | 776 | E2 : le bus CHORUS en envoi | E2 | 150 |
| audio/seq.ts, seqhit.ts, lockfx.ts | 602 | 16 pistes, NEI n-1 ; E2 3 LFO | E0/E2 | 40 / 80 |
| audio/clock.ts | 1094 | masque 16 bits, hitKey par piste, re-programmation par piste, scSrc ; E3 kit a la mesure | E0/E3 | 150 / 80 |
| audio/morph.ts, morphApplier.ts | 429+ | VOICES -> 16 | E0 | 60 |
| audio/beats.ts | 506 | roles par moteur de piste, pistes 9-16 [DEC 8] | E1 | 120 |
| audio/beatcode.ts | 375 | version 2 (16 pistes, verrous, trigs, LFO), v1 inchangee | E1 | 400 |
| audio/duck.ts | 223 | rien (la source vient de drums) | | 0 |
| audio/samples.ts, usersamples.ts | 1053 | categorie au lieu de famille de voix (noms), depot sur une piste | E1 | 60 |
| state/voices.ts | 123 | TrackKey (type) | E0 | 10 |
| state/patterns.ts | 412 | 16 cles ; E3 kit par emplacement (pool), setup | E0/E3 | 30 / 300 |
| state/presets.ts | 1129 | RytmData v2 (`tracks`), apply/capture, rytmNow, applyKit -> conversion | E1 | 250 |
| state/factory.ts | 1017 | `rytmFactory` passe par la conversion (forme d'ecriture inchangee) | E1 | 40 |
| state/share.ts | 277 | beatNow v1 ou v2, dataOfBeat v2 | E1 | 150 |
| state/undo.ts | 665 | signature `tracks`, safeWatch, lecture v1 ; E3 kit par emplacement | E1/E3 | 40 / 100 |
| state/rytmPage.ts | 331 | vel 16 | E1 | 20 |
| state/lcd.ts, lcdMix.ts, lcdSamples.ts | 548 | MIXER par 4 sur 16, depot par piste | E1 | 60 |
| state/trk.ts, dtFace.ts, ctl.ts | | TRK + 16 pas, CONTROL ALL sur 16 et masque ctlAll (E2) | E1/E2 | 60 |
| rytm/sceneData.ts, sceneParams.ts | 376 | VOICES 16, normalisation T1..T8 | E0 | 40 |
| debug.ts | 574 | `__v4.tracks`, 16 | E0 | 40 |
| scripts/mm-studio-patterns.mjs | | INSTS, rien d'autre tant que factory garde sa forme | E1 | 10 |
| scripts/smoke-v4.mjs, hw-leds.test.mjs, presets tests, fixtures | | portes de migration | E0/E1 | 400 |

### 6.2 MIDI, Roto, boitier

| Fichier | Lignes | Ce qui change | Etape | Taille |
|---|---|---|---|---|
| midi/targets.ts | 679 | T9..T16 a la fin (48 ids chacun), reglages de machine par piste `rytm:voice:<K>:<lockId>`, libelles "T1 VOL", legacy kit/layer -> pistes fixes ; E2 nouveaux reglages | E1/E2 | 200 / 150 |
| midi/midi.ts | 1363 | `targetNow` : T1..T8 | E1 | 20 |
| midi/rotoKeys.ts, roto.ts | 1624 | pages T9-T16 (VOL, MUTE, PAD) ajoutees a la fin, VOICES8 garde | E1 | 120 |
| midi/seqlink.ts | 1013 | `seqVoice` sur 16 | E1 | 30 |
| hw/snapshot.ts, rowLeds.ts, docs/hardware | 363 | `track`, 16 LED en TRK et MUTE | E1 | 80 |
| docs/midi/* | | regeneres | E1/E2 | auto |

### 6.3 Interface (pour l'estimation ; le detail des pages est dans les autres inventaires)

| Fichier | Lignes | Ce qui change | Etape | Taille |
|---|---|---|---|---|
| actions.ts | 5372 | 155 refs : pistes 1-16 partout, soundFamily -> moteur de la piste, menu MACHINE, banque par categorie, mute/solo 16, copy/paste de piste, CONTROL ALL 16 | E1 | 600 |
| scene/screen.ts | 3958 | noms de piste + son, vues 16, MIXER 16, menu MACHINE, liste du pool | E1/E2 | 400 / 400 |
| scene/renderer.ts, sequencer3d.ts, keyLabels.ts | 5122 | LED TRK et MUTE sur 16, flash par bit, legendes `stepv-*` [DEC 4] | E1 | 200 |
| ui/Hotspots.tsx, scene/hit.ts | 4181 | jumeaux des 16 pistes, depot | E1 | 120 |
| rytm/pages.ts, pageView.ts, values.ts, faceKnobs.ts | 1972 | `pageSlots(screen, machine)`, MIXER 2 pages de niveaux ; E2 toutes les pages DT2 | E1/E2 | 200 / 500 |
| rytm/infos.ts, infoIds.ts, InfosCard.tsx, diagrams.ts | 4212 | cartes par machine et non par voix ; E2 les nouvelles | E1/E2 | 200 / 400 |
| rytm/stepLeds.ts, trigMarks.ts, faceplate.ts | 472 | 16 | E1 | 60 |
| scene/rytmTweaks.ts | 206 | la plaque TWEAKS : la piste choisie | E1 | 40 |
| hooks/useKeys.ts | 349 | A..V = pistes 1-8 (Maj : 9-16 ?) | E1 | 20 |
| Telephone : ui/BeatEditor.tsx, Dock.tsx, KnobPanel.tsx, scene/pads.ts | 2138 | 8 pistes affichees + bascule 1-8 / 9-16 [DEC 5] | E1 | 200 |
| fallback/StaticMachine.tsx | 601 | rien (8 voix du motif d'arrivee) | | 0 |

### 6.4 Totaux

- E0 + E1 (V.5.9 interne puis V.6.0) : environ 6 000 lignes touchees, dont 1 100 nouvelles (tracks.ts, beatcode v2),
  400 de tests et fixtures.
- E2 (V.6.1) : environ 3 500 lignes (dont 1 300 d'ecrans, pages et INFOS).
- E3 (V.6.2) : environ 3 000 lignes (patterns, pool, presets de piste, preset locks, IndexedDB, UNDO par emplacement).

---

## 7. Decoupage en etapes sures

Chaque etape a ses portes : celles de D1 a D3a (tsc a 13, build, smoke 6 pages, hw:test, presets:test, firmware check,
aucune lecture audio, sondes au DOM et hors ligne) + celles de 4.4.

**E0 : le moteur a 16 pistes, invisible (a mettre en ligne seul, V.5.9, ou en tete de V.6.0)**
- `audio/tracks.ts`, `TrackKey`, `EngineId` ; migration `kit16FromLegacy` ; facades `voiceFx`/`kit`.
- 16 cles dans pattern, patterns, locks, trigs, pmutes, seq, morph, voices ; serialize octet pour octet.
- Moteur par piste : shots par piste, portes mono/choke, route derivee, scSrc, tranches paresseuses, re-programmation par
  piste. Les pistes 9 a 16 existent, muettes, sans interface (accessibles par `__v4` pour les sondes).
- Porte decisive : identite audio <= 1e-6 sur tous les rendus de reference ; fixtures relues ; telephone identique ;
  sonde "16 pistes" hors ligne (T9 a T16 avec des sons, verrous, retrig) qui compte les coups et mesure le temps de
  rendu hors ligne (rapport temps reel / temps de calcul) comme indicateur CPU.
- Pourquoi seul : c'est la seule etape qui peut casser des sauvegardes ; elle se verifie sans rien regarder.

**E1 = V.6.0 (gros morceau 1) : 16 pistes libres visibles**
- TRK + TRIG 1-16, pas 1-16 hors REC jouent les pistes 1-16 (TRK SELECT NORMAL de la DT2), mute global et du pattern
  sur 16, FUNC + TRIG = mute rapide sur 16 (a reconcilier avec "PAGES 1-4" de D1 et la vue BANK : partie panneau).
- Menu MACHINE (FUNC + SRC) : ONESHOT et les 8 syntheses ; SRC selon la machine ; la banque par categorie.
- MIXER : niveaux sur deux pages (1-8, 9-16).
- MIDI T9..T16, Roto, boitier ; presets/UNDO/SHARE en v2 (lecture v1) ; RANDOM par roles de machine.
- Telephone : 8 pistes affichees + bascule [DEC 5], tout le reste gele.

**E2 = V.6.1 (gros morceau 2) : les pages DT2 completes**
- AMP ADSR (SUS REL MODE RSET), FLTR 1 et 2 (DEL KEY.T BASE WIDTH BW.RT RSET), machines FLTR (MULTI, LP4, EQ ;
  LEGACY = l'actuel), FX (BR SRR ROUT OD.RT, CHR en envoi + le bus CHORUS), MOD 1 a 3 et les destinations, TRIG FLT.T et
  portamento, TRK LEV distinct de AMP VOL [DEC 6], menu KIT : CONTROL ALL CONFIG, COMPRESSOR ROUTING (avec `compRoute`),
  SIDECHAIN SOURCE (`scSrc`), TRACK SWAP.
- Porte : identite audio aux reglages neufs a leur depart ; sondes par reglage (une mesure hors ligne chacun).
- Les facades `voiceFx`/`kit` disparaissent.

**E3 = V.6.2 (gros morceau 3) : la structure de donnees DT2**
- Kit dans le pattern (pool par hash) [DEC 1], kit du pattern suivant precalcule, reglages de tranche a l'heure de la
  mesure ; presets de PISTE (un `TrackSound` nomme), PRESET POOL (128) et preset locks (`prs`) ; KIT save/load ;
  longueur et vitesse par piste jusqu'a 128 pas (si la V.5.4 ne l'a pas deja fait) ; BPM et swing par pattern [DEC 10] ;
  IndexedDB pour patterns et presets ; fin de la double ecriture des vieilles cles.
- Porte : migration des 128 emplacements (chacun recoit le kit global), changement de pattern a la mesure sans son
  remplacant (compteur `shots.info().previous` et `fallback` a 0 sur une chaine A01 > A02 de kits differents),
  stockage < 2 Mo avec 128 patterns pleins.

Ordre avec les etapes D en cours : D3b (V.5.3, enregistrement en direct) peut sortir avant E0 sans conflit de donnees.
V.5.4 (64 pas, SETUP) touche les memes structures (pas, cles de verrous) : soit la faire avant E0, soit la fondre dans
E3 ; dans tous les cas E0 rend deja `STEPS` variable dans `locks.ts` pour ne migrer qu'une fois.

---

## 8. Points a trancher par Mika

1. **Le kit dans le pattern** (la DT2 : changer de pattern change les sons) ou des sons globaux (aujourd'hui) ?
   Conseil : la DT2, en E3, chaque pattern existant recevant une copie des sons du moment.
2. **Pistes monophoniques** (la DT2 : 16 voix, une par piste) pour toutes, ou garder l'ancien comportement sur 2 a 8
   (les queues de SD, CP, CY se recouvrent) ? Conseil : neuves mono, anciennes gardees, un reglage VOICE par piste.
3. **CHORUS** : insert par piste (aujourd'hui, lourd x16) ou envoi CHR vers un chorus commun (la DT2, leger) ? Conseil :
   l'envoi ; l'insert reste lisible pour les sons d'avant.
4. **Les legendes BD..CY sous les pas 1 a 8** : la DT2 n'en a pas ; avec des pistes libres elles mentent. Les retirer
   ou mettre 1 a 16.
5. **Le telephone** : 8 pads avec une bascule 1-8 / 9-16, ou 16 petits pads ?
6. **Le potard VOL des pages MIXER** : TRK LEV (la DT2, non verrouillable) ou AMP VOL (aujourd'hui `level`) ?
7. **La voie du kick** (hors CHORUS, REVERB, DELAY globaux) suit la machine KICK automatiquement, quelle que soit la
   piste ?
8. **RANDOM** : seulement les pistes 1 a 8 par roles, ou toutes celles qui ont un son, role tire de leur machine ?
9. **Les pistes MIDI** de la DT2 : hors portee (materiel) ; confirme.
10. **BPM et swing par pattern** (la DT2) ou globaux ?
11. **Un sample depose sur une piste ONESHOT** : range dans quelle categorie (celle du sample de la piste, ou on demande) ?
12. **BR et SRR** calcules dans le son (zero CPU, SRR toujours avant le filtre) ou en temps reel (ROUT pre/post, plus
    lourd) ?

---

## 9. Pieges releves

- `INSTRUMENTS` a 8 qui itere ou il faut 16 : le compilateur ne le voit pas ; revoir les 123 references (2.1).
- Les tables `Record<Inst, ...>` : `PAD_ARIA`, `INST_NAMES`, `VOICE_KEYS`, `DEFAULT_STEPS`, `SHOT_LOUD`... : elargir
  `Inst` les signale toutes ; ne pas les "remplir" mecaniquement (le telephone et le clavier restent a 8).
- `ShotId = Inst | 'CHopen'` : separer le type AVANT d'elargir `Inst`, sinon `SHOT_LOUD`, `VARIANTS`, `renderShot`
  exigent 16 algorithmes.
- "Le JSON d'avant, octet pour octet" : `serialize` ecrit aujourd'hui `{ ...p.steps }` ; avec 16 rangees en memoire il
  faut filtrer 9-16 vides, sinon chaque pattern, preset et empreinte change.
- Les empreintes de presets (`rytmNow`, `canon`) : sans conversion, chaque preset charge prend une etoile et le premier
  chargement met un faux YOUR SOUND de cote.
- `scripts/mm-studio-patterns.mjs` lit `factory.ts` comme du texte et compile `beatcode.ts` : garder les deux formes.
- `beatcode.ts` v1 : listes et departs figes ; ne jamais les reordonner ; v2 a cote.
- `rotoKeys.ts` : on n'edite jamais une ligne ; un Roto charge d'un vieux setup pilote encore les memes cibles.
- `rytm:kit:gate` ecrit deux pistes (T2 et T5) pour garder son sens ; `rytm:kit:<potard>` ne suit pas "le kick du
  moment" mais la piste T1 (ou T2), sinon un Roto changerait de cible quand on change une machine.
- `pattern.instrument === null` voulait dire "les potards reglent tout le pattern" : au desktop DT2 il y a toujours une
  piste active ; garder la branche pour le telephone.
- Le masque `StepEvent.mask` et `flashLv` sont dimensionnes par `INSTRUMENTS.length`.
- `shots.ts lastPlayed` sert de son de remplacement : par moteur, deux kicks se joueraient l'un l'autre pendant un calcul.
- `applyVoice` glisse tout de suite : un kit par pattern (E3) a besoin d'une version programmee a l'heure de la mesure.
- CLAUDE.md : aucune lecture audio pendant les tests (Chromium `--mute-audio`, `?mute=1`, rendus hors ligne), aucun tiret
  cadratin ni demi-cadratin, rapport de session.
- localStorage partage par tout le site (MM-DECKS, MM-BASS, presets...) : un kit par pattern sans dedoublonnage le
  remplirait ; UNDO cede deja sa place aux presets quand c'est plein.
