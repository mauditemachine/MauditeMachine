# MM-RYTM V.6.0 : l'integration des lanes B3 a B6, la face DT2 par defaut (FIRMWARE V.6.0)

2026-11-01. Le cahier : `docs/v4/dt2/dt2-master-spec.md` (1.3, 1.4, 2.6, 2.7, 3.1 a 3.4, 3.7, 3.11, 5.1, 5.5, 5.6). Depart : `rel/v6.0` a 881a16a (P0, V.5.9, B3, B4, B5, B6 fusionnees, chacune derriere `?face=dt2`). Worktree `rel-v60`, rien de pousse, `main` pas touche. En cours de route, la branche `v59/moteur-16` (0257d03, les corrections de V.5.9) a ete fusionnee a la demande du coordinateur.

## 1. Ce qui a ete fait

- **MIDI de la face DT2** (`midi/targets/face60.ts`, `tracks60.ts`, `rytm.ts`) : `ACTION60` passe par la saisie de B4 (`faceKeyTap(id, 'midi')` pour PRESET/KIT, SETTINGS, SOUNDS, KEYBOARD, SONG et les quatre fleches ; `faceKeyDown` / `faceKeyUp` pour PAGE tenue ; `dataTurn` pour LEVEL/DATA) ; la face V.5.3 garde les actions d'avant. SOON retire de SETTINGS (KEYBOARD et SONG restent inertes, donc SOON). `rytm:voice:select:T9..T16` appelle `trackSelect`. `rytm:edit` est la touche PTN sur la face DT2. Les libelles suivent la face (le CSV est lu sur la face par defaut).
- **TEMPO 30-300 et SWING 80 %** (apres la fusion de V.5.9) : `rytm:tempo:bpm` et `rytm:tempo:swing` vont sur toute leur course (`setBpmFine`, `clampSwing`) ; le menu TEMPO de B5 a ses fiches `z:bpm` (A, l'entier), `z:bpmf` (B FINE, le dixieme) et `z:swing` (D, 50 a 80 %), et leurs cartes INFOS ; TAP au dixieme sur la face DT2. `rytm:enc:tempo`, le Roto et la face V.5.3 gardent 100-150.
- **Les mutes des 16 pistes unifies** : un seul store (`state/voices.ts`, `hiMuted` et `hiSolo` de B4) ; le detour `asVoiceKey` du telephone (B6) retire ; `soloVoice` et `muteVoice` sur 16 ; l'apercu MUTE de l'ecran DT2 et les lignes MUTE/SOLO du pied lisent les 16 (`scene/screen/dt2.ts`, `consts.ts`).
- **La piste active de B4 partout dans l'ecran** : `screenTrack()` lit `activeTrack.get()` et l'ecoute (`menus/open.ts`) ; la page SRC et la signature des potards de la face suivent la piste active et sa machine (`rytm/pages.ts machineOf`, `rytm/faceKnobs.ts`).
- **Les menus** : la saisie ouvre et ferme par `setOpenMenu` (`onOpen` et `onClose` de B5 tout de suite) ; NO ferme quand son lacher n'est pas pris (le contrat de B5 : YES et NO agissent au lacher ; avant, l'appui pris gardait le menu ouvert, Echap aussi) ; FUNC + MOD ouvre le MIXER de B5, FUNC + MOD encore sa sous-page suivante (INTERNAL 1-8, 9-16, SCENES).
- **LEVEL/DATA, potards** : hors menu, `levelDataTurn` de B5 (la fiche `k:` de la piste active) ; l'anneau dit le TRK LEV (B5), le capuchon tourne avec ses crans (B4 : la ligne `setCap` de `renderer.ts` retiree) ; un potard clique sans glisser appelle `screenKnobPress` (SCENES : A et B arment leur scene). Plus de jumeaux MASTER et TEMPO de l'ecran sur la face DT2 (`ui/Hotspots.tsx`).
- **Les LED de la face** (`actions/face.ts dt2FaceSync`) : les 8 LED de page (`setPatternPages`, une page de 16 pas en 6.0), PERFORM (`setPerform`, eteinte en 6.0), et un trig tenu en GRID REC, les touches de page qui portent ses verrous (`setPageLocks`) ; `setMenu`, FILL, BANK, KEYBOARD et SONG l'etaient deja.
- **SETTINGS** : PATTERN > EDIT GRID appelle `editGridToggle()` ; PERSONALIZE pose `dtFace.setPersonal({ led, backlight, trkSelect })` au chargement et a chaque changement, et SETTINGS tenu + TRIG (B4) revient dans le menu et se garde ; TRK SELECT a les quatre modes du manuel dans la saisie (normal, silent, manual, inverted : TRK + TRIG joue sans choisir).
- **Le P-LOCK et le uTIME sur T9 a T16** (sans toucher `audio/**`) : la piste du P-LOCK est la piste active (`lockTrack`) ; une piste 9 a 16 verrouille VEL, SAMP (le sample lock de toute la banque), MODL et les reglages de piste de sa page SRC (`t:`), l'ecran et les touches de page les montrent ; TRIG tenu + LEFT / RIGHT ecrit le uTIME de la piste active. Les voix 1 a 8 gardent tous leurs chemins.
- **La bascule** (`theme/base.ts`) : `DT2_FACE` vrai par defaut au desktop ; `?face=v5` rend la face V.5.3 ; `?face=dt2` reste la DT2 ; le telephone garde sa face (toujours faux). Le mode d'emploi au survol du MM-RYTM (`ui/OverviewHelp.tsx`) decrit la face DT2, en anglais, en trois paragraphes courts (la face V.5.3 garde son texte).
- **`scripts/smoke-v4.mjs`** : le desktop une fois par face (DT2 par defaut, V.5.3 par `?face=v5`, option `--faces`), et la face lue doit etre celle demandee (jamais la DT2 au telephone).
- **`debug/input.ts`** : `__v4.input.infoHit` et `infoTitle` (la carte INFOS d'une zone, pour les sondes).
- **Corrections trouvees par les sondes** : un verrou d'un reglage de piste (`t:`) prend la course de sa fiche (`actions/internal/locks.ts slotDomain` : TUNE se bornait a 0..1, sur les 16 pistes) ; en creme, le sous-titre des machines de la vue d'ensemble passe de 4,4:1 a 6,4:1 (`v4.css`, un bloc a la fin).
- **La fusion de `v59/moteur-16`** (0257d03, demande du coordinateur) : sans conflit de code (les deux lignes `keepMore` de `actions/face.ts` sont passees seules), `firmware.json` resolu puis `stamp` ; `keepMore` ajoute aux rangees collees ou videes de la saisie DT2 (`keys60.ts`).
- **`docs/midi`** regeneres sur la face par defaut (des libelles seulement, voir les portes).
- **Firmware** : `bump mm808 major` (V.6.0), puis `check`.

## 2. Decisions prises et pourquoi

- **La face V.5.3 garde ses actions MIDI** (`?face=v5`) : chaque cible de `face60.ts` choisit sa branche par `DT2_FACE`, ses libelles aussi. Revenir en arriere ne casse rien.
- **NO ferme sur son lacher seulement** : les menus de B5 prennent l'appui de YES et NO sans agir (`frame.ts acting`) ; garder la regle de B4 (l'appui pris retient le menu) laissait TEMPO ouvert pour toujours. La sonde de B4 le montrait (107 sur 111 avant, 111 sur 111 apres).
- **Le capuchon de LEVEL/DATA est celui de B4** : un encodeur sans butee tourne avec ses crans ; son anneau (B5) dit la valeur. Les deux lanes posaient le capuchon, la derniere ecriture gagnait.
- **FUNC + MOD encore = une saisie DOWN au MIXER** plutot qu'un import de `mixer16.ts` dans `actions/` (un cycle de plus au chargement, le piege des zones mortes de P0).
- **PERSONALIZE : le store garde de B5 fait foi**, `dtFace.personal()` en est la vue que lit la saisie ; le type de TRK SELECT de B4 (auto, manual) prend les quatre modes de B5 (le manuel 14.7.9).
- **Le P-LOCK de T9 a T16 limite aux reglages de piste** : les pages FLTR, AMP, FX, MOD et TRIG sont encore celles des voix 1 a 8 (V.6.1) ; une piste 9 a 16 les dit NOT LOCKABLE au lieu d'ecrire une cle que son moteur n'a pas.
- **Les fiches `z:bpm`, `z:bpmf`, `z:swing`** plutot que d'elargir le potard `tempo` : il est lu par `rytm:enc:tempo` et le Roto, qui gardent leur course 100-150 (cahier 1.3).
- **Les sondes a la souris** envoient les evenements de pointeur (type mouse) a l'element sous la zone projetee, dans la page : sous SwiftShader une image prend une seconde, et l'heure des evenements de CDP faisait d'une tape de FUNC une tenue (FUNC n'etait plus gardee). Les gestionnaires et le picking sont ceux de la souris.

## 3. Ce qui reste a faire / points en suspens

- **LED INTENSITY et BACKLIGHT** : l'etat est pose et garde, la lueur de la face 3D ne le lit pas encore (une API de `scene/rytmFaceKeys.ts` manque).
- **PATTERN MUTE** reste sur 1 a 8 (le type `pmutes`) ; en mode PATTERN, TRIG 9 a 16 le disent.
- **Le P-LOCK de T9 a T16** : seulement VEL et la page SRC ; FLTR, AMP, FX, MOD et TRIG viendront avec leurs pages DT2 (V.6.1). Le telephone et le Roto n'ont pas de P-LOCK sur 9 a 16.
- **Le telephone et le Roto gardent leur piste 9 a 16 a eux** (`phoneBank.track`, `seqHi`) : la face DT2 n'est jamais au telephone ; les rapprocher de `activeTrack` attend que `pattern.select` et `padHit` prennent une `TrackKey`.
- **Les scenes** ne prennent pas les reglages `t:` et `k:` (NO SCENE en 6.0, B5).
- **Notes pour l'audio** (rien n'a touche `audio/**`, `state/presetBpm.ts` ni `state/tempoSync.ts`) :
  - le P-LOCK de T9 a T16 ecrit des verrous `tune`, `fine`, `srev`, `sstart`, `slen`, `slev`, `syn`, `snd`, `mach` et `utime` sur une piste 9 a 16 (`pattern.setLock`) ; la sonde le voit dans le motif et a l'ecran, aucun rendu hors ligne ne l'a encore entendu : une partie de `scripts/rytm-16.mjs` qui rend T9 avec et sans verrou (l'ecart doit etre non nul) le prouverait sans ecoute ;
  - un verrou `tune` d'un reglage de piste suit la course de sa fiche (`t:tune`, de `potMin('vtune')` a 1, comme la TUNE des voix) : le moteur doit lire la meme loi sur les pistes 9 a 16 ;
  - TEMPO : le menu TEMPO, TAP et `rytm:tempo:bpm` passent par `pattern.setBpmFine` (30 a 300 au dixieme) ; `rytm:enc:tempo`, `dialRange('tempo')` et la face V.5.3 restent sur `BPM` (100 a 150) ; SWING passe par `pattern.fx.set` jusqu'a `SWING_MAX`.
- **Relecture contradictoire** de la branche integree par un agent neuf (cahier 5.5), puis le controle en ligne au DOM apres le push.
- **Cote Mika** : a essayer sur le site une fois pousse : la face DT2 par defaut, FILL par PAGE (tenir PAGE, YES puis PAGE, PAGE puis YES), FUNC + MOD (le MIXER et SCENES), TEMPO sous 100 BPM et SWING a 80 %, `?face=v5` pour comparer. Confirmer les notes du boitier avec `protocol.js` (B6). Une ecoute de T9 a T16 avec un P-LOCK, aucune n'a ete faite ici.

## 4. Commandes utiles ajoutees

- `/?face=v5` : la face V.5.3 au desktop (la DT2 est la face par defaut).
- `node scripts/smoke-v4.mjs --url <url> --machines mm808,voy,dj [--faces dt2,v5]` : 3 pages par machine (DT2, V.5.3, telephone).
- `?debug=1` : `__v4.input.infoHit(zone)`, `__v4.input.infoTitle(id)`.
- Aucun script npm ajoute.

## Les portes

Copie propre du HEAD (`git archive`, node_modules en lien), `dist` servi par `python3 -m http.server`, arrete par son pid :

- `npx tsc --noEmit -p .` : 13 erreurs, les memes (une ligne de `audio/drums.ts` decalee par la fusion de V.5.9) ;
- `SEO_OFFLINE=1 npx vite build` : bon ;
- smoke `--machines mm808,voy,dj` : 9 pages (desktop DT2, desktop V.5.3, telephone), aucune erreur, la face lue est celle demandee ;
- `hw:test` 17 et 20 bons, `presets:test` 5 bons, `face:test` 7 sur 7 ;
- `exports-check` : identique (aucun export nouveau des barils) ;
- `rytm-ident` : 20 cas sur 20, memes nombres de coups, ecart des blocs de 6,0e-8 a 5,4e-7 (porte 1e-6), sur la face DT2 par defaut ;
- `docs:midi` : 1306 cibles avant et apres, 0 ajoutee, 0 retiree, 0 deplacee (compare par script), 19 libelles changes (la face par defaut) ; les setups du Roto : memes lignes, seuls les libelles de MAIN VOLUME, PTN et TRACK T9 a T16 changent ; les JSON du Roto identiques ;
- firmware : `bump mm808 major` (5.9 -> 6.0), `stamp` apres le dernier changement de `v4.css`, `check` bon (V.6.0, V.2.3, V.3.0).

Sondes muettes (Chromium `--mute-audio`, `?mute=1`, aucun TRIG tape hors d'un mode, sur la face par defaut sans parametre) :

- la sonde de l'integration (`probe.cjs`, hors depot) : 102 sur 102, aucune erreur de page. A la souris (le pointeur sur les 51 zones projetees de la face 3D) : TRK + TRIG 9, 12, 16 et 2 (l'ecran lit la piste), la page SRC qui suit la machine de T12 et T13, PTN et ses banques (LEFT / RIGHT, FUNC + PTN, TRIG 11), REC et GRID REC sur T9, un TRIG tenu (le P-LOCK de T9, le uTIME a +2 par Maj + fleche, un verrou TUNE, la touche SRC rouge, le potard qui montre le verrou), PLAY, STOP, FILL par PAGE (tenue, YES puis PAGE, PAGE puis YES, PAGE encore), TEMPO (DOWN, la molette de LEVEL/DATA, FINE, 45,7 BPM, SWING 80 %, NO), FUNC + TEMPO = TAP, PRESET/KIT, SOUNDS, FUNC + SOUNDS, SETTINGS, MACHINE et QUANTIZE (avec leurs indices), SETTINGS > EDIT GRID, PERSONALIZE > TRK SELECT, SETTINGS tenu + TRIG 2 et 3, le MIXER et ses trois sous-pages, SCENES (le potard A presse), LEVEL/DATA et MAIN VOLUME glisses, les mutes sur 16 et le QUICK MUTE, les touches de page, KEYBOARD et SONG inertes ; au clavier : T + Maj + D, Y, virgule, U, P, K, N, G tenue, E, Maj + E, Alt + T, H, Echap ; par le faux MIDIAccess : `rytm:preset`, `down`, `no`, `settings`, `sounds`, `data` (relatif, dans un menu puis TRK LEV +3 -1), `voice:select:T12`, `voice:T12:mute`, `ptnpage` tenue, `edit`, `right`, `keyboard`, `tap` ; INFOS : les 42 zones de la table menent a une carte ;
- la sonde de B4 (`?face=dt2`, 111 cas) : 111 sur 111 apres les branchements (107 avant : NO et Echap ne fermaient plus les menus de B5) ;
- le contraste du texte HTML (le fond reel compose) : en creme, 0 texte sous 4,5:1 au desktop, dans la vue d'ensemble (le mode d'emploi au survol compris, apres la correction du sous-titre des machines) et au telephone ; en noir aussi ;
- le telephone (390 x 844) contre V.5.9 (91e57cd) : en noir 99 pixels, en creme 125 pixels, tous dans le numero du firmware (V.5.9 -> V.6.0) ; rien d'autre ne bouge.

Captures (hors depot) dans `/tmp/claude-0/-home-user-MauditeMachine/3e52142d-b436-522a-95d4-63ef836eaea8/scratchpad/int60/` : `v60-desktop-noir.png`, `v60-desktop-creme.png`, leurs `-mixer` (T12 active, FUNC + MOD), `v60-desktop-v5-noir.png` (la face V.5.3), `v60-overview-noir.png`, `v60-overview-creme.png` (le mode d'emploi au survol), `v60-phone-noir.png`, `v60-phone-creme.png` et leurs references `v59-phone-*.png`.

## Relecture : écran et menus

Branche `v60/fix-screen` (depuis 2a2a705). Chaque point a sa sonde muette (Chromium `--mute-audio`, `?mute=1`, aucune lecture), qui echoue sur 2a2a705 et passe apres ; les sondes vivent hors depot (`scratchpad/fx-screen/probes/`).

- **P-LOCK sur T9 a T16** : la page SRC d'une piste 9 a 16 se lit (les blocs `t:` ne demandent plus une voix du motif, `rytm/pageView.ts`), en P-LOCK ses blocs montrent le verrou ou la base du pas, la valeur lue (`dialValueText`, `dialUnit`) passe par la piste du P-LOCK (`lockTrack`), et le flash des verrous en lecture suit la piste active (`scene/screen/dt2.ts`, `grid.ts blockMode`). Sonde p1 : 10 sur 10 (5 sur 10 avant).
- **Potard SRC pilote par une scene (moteur, pistes 1 a 8)** : TUNE et FINE de la page SRC reprennent la cle de scene de leur voix (`rytm:voice:<voix>:tune` et `:fine`, `actions/scenes.ts trackSceneId`) : une scene qui les tient suit la main, une scene armee les enregistre, comme en V.5.3 ; les blocs, la ligne d'unite et la lecture des fiches `t:` montrent ce qui joue (`dialShown`). Les reglages lourds (potards de la machine, couches), T9 a T16 et TRK LEV restent hors des scenes (NO SCENE). Sonde p2 : 9 sur 9 (5 sur 9 avant).
- **Une scene armee n'avale plus les potards des menus** : dans `sceneTake`, les fiches des menus (`z:` : TEMPO, QUANTIZE, SCENES et son crossfader ; `k:` : le TRK LEV du MIXER) passent toujours, comme TEMPO et MASTER (`actions/scenes.ts`) ; le Roto (`rytm:knob`) prend le meme chemin. Sonde p3 : 10 sur 10 (5 sur 10 avant).
- **Les potards A a H ne touchent plus la page SRC cachee** : sous un menu plein ecran sans potards (SETTINGS, MACHINE, SOUNDS, SAMPLES, PRESET/KIT hors de la liste des kits), `knobDial` et `faceKnobReset` prennent le geste sans rien regler et l'ecran dit `<MENU>: TURN LEVEL/DATA` (`actions/dials.ts menuCoversKnobs`) ; la face, la molette, le Roto et le boitier passent tous par la. La liste des kits garde ses potards (`presetTurns`). Sonde p4 : 18 sur 18 (6 sur 18 avant).
- **SOUNDS et SAMPLES > IMPORT FILES sur T9 a T16** : une piste 9 a 16 a sa liste SOUNDS, celle de son potard D SAMP (OFF puis toute la banque, puis + LOAD A FILE..., `actions/browser.ts trackSoundList`, `trackSoundPick`) : UP, DOWN, LEVEL/DATA, YES, LEFT et RIGHT comme la liste d'avant, la TRIG de la piste reste la pre-ecoute (rien ne joue au choix) ; IMPORT FILES (et + LOAD A FILE...) prend la piste active (`soundFilesPick` accepte une `TrackKey`) : les fichiers vont dans la categorie de son sample (sinon de sa machine) et le premier devient son sample. Les cartes INFOS `key:sounds` et `menu:sounds` le disent. Les pistes 1 a 8 gardent le navigateur d'avant (ses machines, la liste de leur famille d'avant, meme apres MACHINE : un ecart qui reste).
- **SOUNDS ne reste plus sur NO SOUNDS** : le menu ouvert suspend la fermeture au repos de la liste (`lcdSamples.hold` a l'ouverture, rendu a la fermeture, `menus/sounds60.ts`) ; une liste fermee quand meme sous le menu (le P-LOCK qui change, une autre piste) se rouvre a la premiere saisie (fleches, LEVEL/DATA, YES), et l'ecran le dit (`YES: SHOW THE SOUNDS`) ; revenir sur une piste 1 a 8 sous le menu rouvre sa liste. Sonde p5 (avec le point d'avant) : 12 sur 12 (2 sur 11 avant ; 13,5 s sans geste, puis DOWN ; T9 : liste, DOWN, YES, RIGHT ; IMPORT par le choix de fichiers de Chromium et un WAV de 80 ms).
- **CONTROL ALL sur 9-16 (moteur)** : la piste source est la piste active (`actions/ctlall.ts ctlSource`, `activeTrack`) ; une piste 9 a 16 recopie ses reglages de piste (`t:`, la page SRC) sur les pistes cochees, comme son P-LOCK ; sur ses pages encore a 8 voix (FLTR, AMP, FX, MOD, TRIG), rien ne se recopie (le potard n'y ecrit rien). Sonde p6 : 5 sur 5 (4 sur 5 avant).
- **Cartes INFOS de TEMPO** (`rytm/infos/v60.ts`) : `key:tempo` et `menu:tempo` donnent les courses (BPM de 30 a 300, B FINE le dixieme, SWING de 50 a 80 %) et ne promettent plus FINE pour V.6.1 (seul le metronome, E a H, y reste) ; `trklev` place 0 dB aux quatre cinquiemes (102). Sonde p7 (les cartes montrees dans le DOM) : 13 sur 13 (5 sur 13 avant).
- **QUANTIZE** (`menus/quantize.ts`) : TRACK se garde par piste et chaque piste prend la plus forte de TRACK et PTN (PTN n'ecrase plus TRACK, le bloc E dit ce qui s'entend) ; le menu ouvert fait une seule etape d'UNDO (`undo.boundary` puis `undo.hold` a l'ouverture, rendu a la fermeture) : un Ctrl+Z rend les uTIME d'avant le menu. Sonde p8 (crans espaces de 900 ms, au-dela de la rafale d'UNDO) : 8 sur 8 (6 sur 8 avant).
