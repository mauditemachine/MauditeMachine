# 2026-11-08 - MM-RYTM VST3 : vers l'Octatrack et la Digitakt II (lot 1, le crossfader dans le moteur)

Demande de Mika : « ameliore le plugin vst3 au maximum de ce que tu penses [...] Octatrack et Digitakt 2 en meme temps ! meme au pire change les placements des knobs ». Le plan, par ordre d'impact :

1. **Lot 1, le crossfader facon Octatrack dans le moteur** (ce rapport) : temps reel, fenetre fermee, automatisable et mappable dans Ableton, latence declaree.
2. **Lot 2, les patterns depuis Ableton** : changement de pattern par MIDI (clip, program change), chaines et SONG, longueur par piste (polymetrie DT2 / OT).
3. **Lot 3, la face** : une passe d'ergonomie (piste choisie a l'ecran, scenes A/B facon OT, placements), gardee au plugin.

## 1. Ce qui a ete fait

- `src/v4/audio/morph.ts` : `morph.active()` (les scenes du motif menent-elles quelque chose) et `morph.withX(x, fn)` (un calcul a un autre x, sans ecouteur ni store). Rien ne change pour le site : seul le plugin les appelle.
- `src/v4/plugin/bridge.ts` :
  - avec des scenes, le programme porte `xk`, ses valeurs aux 9 positions du crossfader (x = 0, 1/8 ... 1) : effets globaux, tranches, coup du pad, coups ; les sons ont une table partagee (les hauteurs menees par une scene donnent leur echelle de sons) ;
  - le crossfader de la face envoie `mm_xf {x}` au lieu de recompiler le programme ;
  - le transport du C++ porte `xf` : quand Ableton bouge le crossfader, celui de la face suit, sans renvoi (ni pendant un geste de la face, ni 400 ms apres).
- `plugin/mm-rytm/dsp/Program.{h,cpp}` : `ProgX`, `Program::xk`, `xkAt`, et les melanges `blendHit`, `blendSlice`, `blendFx` (lineaire ; logarithmique pour la coupure, le Q et les constantes de temps ; le plus proche pour le son, le type de filtre et le trig).
- `plugin/mm-rytm/dsp/Engine.{h,cpp}` :
  - `setX` (atomique) ; chaque coup, lock trig, repetition et note MIDI prend ses reglages a la position du moment ;
  - la tranche de chaque piste (envois, inserts, TONE) et les effets globaux suivent x a chaque bloc, l'ecart d'un LFO pris au coup compris ;
  - le niveau de tranche (LEVEL, TRK LEV) des coups qui sonnent suit x, en rampe sur le bloc ;
  - la forme de la REVERB : la reponse de la position la plus proche, quand x est pose depuis 150 ms (une nouvelle reponse coupe la queue).
- `plugin/mm-rytm/dsp/Fx.h` : `latency()` (l'avance du LIMITEUR, Lw - 1 echantillons), `reverbIR()`.
- `plugin/mm-rytm/src/PluginProcessor.{h,cpp}`, `PluginEditor.{h,cpp}` :
  - un parametre **Crossfader** (`xfade`, 0 a 1), garde avec le projet ; `mm_xf` le pose avec un geste (Ableton l'enregistre en automation) ;
  - le parseur lit `xk` (ignore si les coups ne sont pas les memes que ceux du programme) ;
  - une reponse de REVERB par forme, partagee entre les positions ;
  - `setLatencySamples` : la latence du LIMITEUR declaree a Ableton ;
  - la face recoit le crossfader de l'hote meme a l'arret.
- `plugin/mm-rytm/tests/engine_test.cpp` : 35 tests (3 de plus) : un coup a A, au milieu et a B ; le niveau de la piste qui suit x pendant que le coup sonne ; sans scene, x ne change rien.
- Verifie dans Chromium (la face du plugin, un faux `__JUCE__`) :
  - une scene B sur TUNE donne `xk` a 9 positions et 9 hauteurs du kick ;
  - le crossfader de la face envoie 10 `mm_xf` et aucun programme ;
  - un x venu de l'hote (0.25) deplace le crossfader de la face, sans renvoi.
- `plugin/mm-rytm/README.md`, `INSTALL.md` : le crossfader dans le moteur, le parametre d'Ableton, la latence.

- **Build vert du lot 1** (run 42512742239, 19:07 UTC), dans la release `mm-rytm-latest`.

### Lot 2a, les patterns joues par le moteur

- **Bug trouve** : dans le plugin, un pattern choisi en lecture (PTN puis TRIG, une chaine) ne changeait jamais. L'horloge de la face ne tourne pas dans le plugin (le transport est celui du C++), donc la « fin de mesure » qui pose le pattern suivant (`clock.onBar`) n'arrivait pas.
- `src/v4/plugin/bridge.ts` :
  - le programme porte `slot` (l'emplacement du pattern courant) et `pats`, chaque autre emplacement rempli (ses 16 pas, ses verrous, ses trigs, son mute, ses scenes, compiles comme le courant) ;
  - `mm_ptn {next, chain}` envoie au moteur le suivant et la chaine choisis sur la face ;
  - le transport porte `pat` et `patSeq` : quand le moteur change de pattern, la face le suit (`patterns.follow`), a l'ouverture de la fenetre aussi.
- `src/v4/audio/morph.ts` : `morph.withScenes(s, fn)` (les scenes d'un autre pattern le temps d'un calcul). `src/v4/state/patterns.ts` : `patterns.follow(i)` (la face suit le pattern du moteur, comme au debut d'une mesure). Rien ne change pour le site.
- `plugin/mm-rytm/dsp/Program.h` : `slot`, `pats` (des programmes entiers : le kit d'ici, leurs coups).
- `plugin/mm-rytm/dsp/Engine.{h,cpp}` :
  - `PatPlay` par pattern (son index pas -> coup, ses reponses de REVERB) et un pattern vide (le kit sans coup) ;
  - le pattern joue `slot_`, son debut `patStart_` : a la fin du pattern, le suivant choisi, sinon le pattern suivant de la chaine ; ses passages repartent de 1 (1ST, A:B) ;
  - un program change : a la fin du pattern en lecture, tout de suite a l'arret ; au depart de la lecture, le pattern qui attendait ou le debut de la chaine ; un saut d'Ableton (sa boucle) garde le pattern ;
  - la face qui pose un autre pattern courant : tout de suite a l'arret, a la fin du pattern en lecture.
- `plugin/mm-rytm/src/` : le parseur lit `slot` et `pats` ; les reponses de REVERB de chaque pattern ; `mm_ptn` ; le program change MIDI ; `pat` et `patSeq` vers la face.
- Tests : 38 (3 de plus) : un program change au pas 5 joue A02 au pas 16 ; la chaine A01, A02 alterne ; a l'arret, un program change change le pattern tout de suite.
- Verifie dans Chromium : la face suit le moteur (A02), A01 est dans `pats` (25 coups) ; en lecture, A01 tape affiche « NEXT A01: AT THE BAR » et envoie `mm_ptn {next: 0}`.
- **Build vert du lot 2a** (run 42513712126, 19:16 UTC), dans la release `mm-rytm-latest`.

### Lot 2b, les pistes typees et la longueur par piste

Demande de Mika : « lance la longueur par piste ; fais juste adapter les tracks pour que ce soit un type de track, genre bd c'est bd ! on peut pas mettre autre chose dans les tracks que ca et pas de machine de synthese, juste des samples ; ne fais pas trop de complexites ; je parle du plugin ».

- `src/v4/audio/tracks.ts` (mode plugin seulement, `TYPED_TRACKS`) :
  - chaque piste a le type de son rang (`typedFamily` : 1 a 8 BD SD CH OH CP TOM HT CY, 9 a 16 les memes) ;
  - une seule regle, au chargement et a chaque changement du store (`typedKit` dans `commit`) : machine ONESHOT, un sample de son type (le premier de la famille si elle jouait une synthese ou un sample d'ailleurs ; une piste jamais reglee recoit le premier sample de son type), le niveau du sample remis si la synthese le cachait. Presets, SOUNDS et MACHINE passent par elle ;
  - `TRACK_NAMES` : BD, SD ... CY, BD2 ... CY2 a l'ecran du plugin (T1 a T16 au site).
- `src/v4/actions/internal/kit.ts` : SAMP ne propose que les samples du type de la piste. `src/v4/rytm/pages.ts` : la case MACH de SRC est vide dans le plugin. `src/v4/scene/screen/menus/machine.ts` : le menu MACHINE dit « ONESHOT BD SAMPLES » et ne change rien.
- `src/v4/audio/trig.ts` : `tlen`, la longueur de la piste (0 = PTN), gardee avec les reglages de trig du pattern (`TRIG_ROW_PARAMS`), hors de `TRIG_PARAMS` : ni verrou, ni cible MIDI, aucun indice stocke ne bouge. `src/v4/rytm/pages.ts` : TRIG 2/2, potard E **TLEN** (plugin seulement) ; `actions/mixer.ts` : sa course va de PTN a la longueur du pattern.
- `src/v4/plugin/bridge.ts` : `tlen` de chaque piste (pattern courant et `pats`) quand il est plus court que le pattern.
- `plugin/mm-rytm/dsp/` : `ProgTrack::tlen` ; le sequenceur prend le pas `(G - debut du pattern) % tlen` de la piste : elle boucle sur sa longueur sans repartir avec le pattern ; le changement de pattern tombe toujours a la fin du pattern.
- Tests : 39 (1 de plus) : un CH de TLEN 3 joue aux pas 0, 3, 6 ... 15, 18, 21 a travers un pattern de 16.
- **Build vert du lot 2b** (run 42522236477, 21:02 UTC) ; la release `mm-rytm-latest` porte le commit cb3839e.
- Verifie dans Chromium : les 16 pistes jouent un sample de leur type (synthese a 0), BD a BD2 ; SRC sans MACH, SAMP « BD 1/44 » ; le menu MACHINE ; TLEN sur TRIG 2/2, recu dans le programme. Le site, construit a part : la page RYTM toujours en V.3.0, rien ne change.

### Lot 3, la passe sur la face (plugin seulement)

Demande de Mika : « lance la passe sur la face ». Un tour de la face page par page (Chromium, captures), puis ce qui genait :

- **Les pas portent le type de leur piste** : BD ... CY, BD2 ... CY2 sous le numero (`theme/face.ts` legendes `stept-<n>` en mode plugin ; `scene/sequencer3d.ts` : les legendes sous les numeros vont jusqu'a 16, elles descendent et s'allument avec leur pas).
- **La piste choisie a l'ecran** : la case en haut a gauche dit T1, BD en grand, et le sample (BD 1) ; avant, SMP et le numero (`scene/screen/dt2.ts`).
- **SOUNDS sans synthese** : les 16 pistes ont la liste de SAMP (OFF puis les samples de leur type), sans 909, 808, MM ni + LOAD A FILE (le moteur ne lit pas les fichiers de ce navigateur) ; `actions/browser.ts`, `menus/sounds60.ts` (le compte des sons sans la ligne + LOAD).
- **Les samples nommes par leur fichier** (BD 12, HT 4) dans SOUNDS et SAMP, plutot que leur numero seul (`actions/internal/kit.ts`).
- **SRC sans LOOP** : la case annoncait SOON ; elle est vide dans le plugin, comme MACH.
- Garde : KEYBOARD (il joue la piste choisie en chromatique sur les pas ; le « NO VOICE » vu pendant le tour venait de la sequence du test, TRK puis NO) ; les placements des potards et des touches (la grille DT2 a 8 potards colle a l'ecran 2 x 4, rien n'y gene).
- Verifie : le site construit a part, la page RYTM en V.3.0 identique au pixel pres a la capture d'avant ; la face V.6 du site garde ses machines et ses numeros seuls.
- **Build vert du lot 3** (run 42535187785, 23:33 UTC), dans la release `mm-rytm-latest` (commit c60f4b2).

### Lot 4, les samples perso dans le plugin

Demande de Mika : « lance les samples perso dans le plugin ».

- `plugin/mm-rytm/src/SampleBank.{h,cpp}` : `UserLibrary`, le dossier `~/Music/MM-RYTM Samples/<famille>/` (cree au premier lancement) :
  - `rescan()` liste WAV, AIFF, FLAC, MP3 par famille (ordre naturel des noms) ;
  - `byKey()` decode a la demande avec JUCE (30 s au plus, mono ou stereo) et garde les octets du fichier pour la face ;
  - `import()` copie des fichiers dans le dossier d'une famille (le meme fichier : rien ; un autre du meme nom : un nom libre) et rend la cle du premier.
- Cle d'un sample perso : `<famille>/~<fichier>`. `PluginProcessor.cpp` : le calcul d'un son prend le sample perso ou celui de la banque. `PluginEditor.cpp` :
  - la liste du dossier dans `initialisationData` (`mmUser`, la face la connait avant de lire son kit), puis `mm_user` a chaque `mm_ready` et apres un import ;
  - `mm_import {family, track}` ouvre le choix de fichiers du Mac (plusieurs a la fois) ; apres la copie, `mm_imported {track, key}` ;
  - `/samples/rytm/<famille>/~<fichier>` sert le fichier a la face (son dessin, sa duree).
- `src/v4/audio/samples.ts` (plugin seulement) : les samples perso apres ceux du site (`setPluginSamples`), servis par le plugin comme ceux du site ; la banque synthetisee du site (JS, 43 sons) n'est pas listee dans le plugin (son moteur ne la joue pas : elle y sonnait muette) ; ni les samples IndexedDB du navigateur.
- `src/v4/actions/browser.ts` : `fileImport.plugin`, + LOAD A FILE... de SOUNDS passe par le plugin ; `menus/sounds60.ts` : USER a droite d'un sample perso ; les noms sans le `~`.
- `src/v4/plugin/bridge.ts` : `mm_import`, `mm_user`, `mm_imported` (le premier fichier importe devient le sample de la piste).
- Verifie dans Chromium (faux `__JUCE__` avec un sample perso « My Kick ») : SOUNDS BD = OFF, les 38 BD du site, MY KICK (USER), + LOAD A FILE... ; plus de sons synthetises ; YES sur + LOAD envoie `mm_import {family: 0, track: 0}` ; la reponse du plugin pose NEW KICK sur la piste, le programme porte `bd/~New Kick.wav`, la face recoit le fichier (200). C++ : verifie a la compilation (en-tetes de JUCE) ; le dossier, le choix de fichiers et le decodage se verifient sur le Mac.
- **Build vert du lot 4** (run 42545264897, 01:26 UTC le 2026-11-09), dans la release `mm-rytm-latest` (commit a4b75ce).

### Lot 5, le mixer et les niveaux au crossfader (2026-11-09)

Demande de Mika (capture d'une version d'avant : pas de BD sur les pas) : « je peux diriger le level de chaque track ; je voudrais voir le mixer comme sur n'importe quelle Digitakt pour voir le level de tout, et pouvoir le moduler avec le crossfade ; si je peux deja, explique-moi ; ca doit etre intuitif ».

- Deja la : le MIXER (FUNC + MOD, pistes 1-8, 9-16, SCENES) ; FUNC tape une fois montre les fonctions orange (MIXER sous MOD).
- Ce qui manquait : son niveau etait TRK LEV, que les scenes ne gardent pas. Dans le plugin, le niveau d'une piste devient son VOL (`m:<piste>`, `rytm:voice:<piste>:level`, une cible de scene qui existait) :
  - `actions/internal/mixer.ts` : `mixerInst` accepte les 16 pistes dans le plugin ; `mixerLevel`, `mixerBaseSet` (les pistes 9 a 16 par le store) ; `anyDial.ts` les utilise ;
  - `menus/mixer16.ts` : les potards du MIXER reglent `m:<piste>` dans le plugin (TRK LEV au site) ;
  - `internal/keys60.ts` : LEVEL/DATA regle le meme niveau par `anyDial` (une scene armee l'enregistre) ; `actions/mixer.ts` : son anneau ; `screen/dt2.ts` : la case de l'ecran le montre tel qu'on l'entend (`morph.voice`) ;
  - `audio/tracks.ts` : un TRK LEV d'avant passe dans le VOL au chargement, au meme gain (VOL x TRK LEV / 0.8), TRK LEV revient a 0 dB ;
  - le moteur n'a pas change : le niveau entre dans la tranche des 9 positions du crossfader (lot 1).
- Verifie dans Chromium : MIXER 1-8 (BD a CY), le potard A baisse le BD (tranche 1 -> 0.444), une scene B tapee + potard A vers le haut donne au BD 9 positions de 0.444 a 1.361 ; LEVEL/DATA baisse le BD hors du MIXER (la scene B garde sa valeur) ; FUNC montre MIXER sous MOD. Le site ne change pas (TRK LEV, `k:` ; `m:` limite aux 8 voix).
- **Build vert du lot 5** (run 42549267733, 02:13 UTC le 2026-11-09), dans la release `mm-rytm-latest` (commit ae22cbf).

### Lot 6, la face facon Digitakt II, les fleches, OPEN, les samples (2026-11-09)

Demande de Mika (avec la face avant de la Digitakt II) : « j'aimerais avoir le meme design ! mais en MM-RYTM ! fait un gros travail de graphisme ! et je veux que ca fonctionne absolument parfaitement ! a la place des fleches je veux le crossfade A et B comme Octatrack et je veux mes samples et la possibilite d'en rajouter et je veux pouvoir toucher l'ecran avec la souris pour voir l'utilisation des fleches parce que c'est un plugin ! Je veux garder le bouton OPEN (et je veux pouvoir fermer aussi pour avoir la facade avant). Dans OPEN je veux tous les settings et les choses plus pointues, le fine tuning ».

- Le graphisme (plugin seulement) :
  - `src/v4/pluginMode.ts` (nouveau) : la detection du plugin, partagee (`theme/base.ts` PLUGIN, `rytm/faceplate.ts`, `audio/samples.ts`) ;
  - `rytm/faceplate.ts` : le crossfader et ses scenes A / B la ou la DT2 a ses fleches, dans leur cadre ; les 8 LED au-dessus de PAGE, a droite, comme la DT2 ; le cadre des touches de page agrandi pour leurs fonctions ; KEYBOARD n'est plus « coming soon » (il joue) ; `FpIcon`, les pictogrammes ;
  - `theme/face.ts` : la fonction FUNC de chaque touche imprimee dessous, en orange et en minuscules comme la DT2 (Quantize, Machine, Perform, Save Proj, Samples, Tap Tempo, + Sample, Copy, Clear, Paste, Save, Reload, Fill/Setup, KB Setup, Ptn Mute, Bank, Unmute, Unsolo) ; Scene A, Crossfade, Scene B ; Main Volume, Level/Data, Track/Mute ; les touches a icones (liste PRESET, de RANDOM, engrenage SETTINGS, onde SOUNDS, metronome TEMPO, clavier KEYBOARD ; le transport en contour) ; les pas : le numero grand, centre, souligne, le type dessous ;
  - `scene/keyLabels.ts`, `theme.ts` : le dessin des pictogrammes et du soulignement (`drawIcon`, `MARK_ICON`, `marksH`) ; le logo M au-dessus du crossfader.
- Les fleches a la souris : `plugin/ScreenMouse.tsx`, quatre touches dans la bande du cadre sous l'ecran (a gauche), les memes gestes que les fleches du clavier du Mac (`faceKeyTap` : la sous-page, une ligne d'une liste, l'octave de KEYBOARD, la banque en PTN), repetees quand on les tient.
- OPEN :
  - `state/pluginPanel.ts` (nouveau) ; `actions/nav.ts` : dans le plugin, OPEN (touche, clavier) ouvre et ferme le panneau au lieu du capot du site ;
  - `plugin/OpenPanel.tsx` (nouveau) : TRACK (les 16 pistes ; SRC, FLTR, AMP, FX, TRIG, LFO 1, LFO 2 en potards sur les cibles des pages de la face ; VOICE : MONO / POLY, CHOKE, GATED, MUTE ; SAMPLE : son nom, IMPORT, son dossier), GLOBAL (les 16 niveaux, SEND FX, DIST, CHORUS, DELAY, REVERB, BIT, COMP, MASTER, PATTERN), SAMPLES (tous les samples par type, un clic les pose ; IMPORT, FOLDER, OPEN FOLDER, RESCAN), HELP ; CLOSE, Echap ou OPEN le ferment ;
  - `ui/KnobPanel.tsx` : Maj + glisser = le reglage fin (au dixieme) sur les potards.
- Les samples :
  - FUNC + OPEN (+ Sample) passe par le choix de fichiers du plugin (`actions/browser.ts` soundFilesPick) ;
  - FUNC + SOUNDS (Samples) dans le plugin (`menus/sounds60.ts`) : IMPORT FILES, OPEN FOLDER IN FINDER, RESCAN FOLDER, puis tes samples ; YES en pose un sur la piste (de son type) ;
  - `audio/samples.ts` pluginSamples ; `plugin/bridge.ts` mm_reveal, mm_rescan ; `src/PluginEditor.{h,cpp}` : revealSamples (le dossier, ou celui d'un type, ouvert dans le Finder, cree s'il manque), relecture du dossier.
- Verifie dans Chromium (faux `__JUCE__`) :
  - les zones suivent la geometrie : survol de Scene A, Scene B, crossfader, PAGE, OPEN ; le crossfader tire de A vers B envoie x de 0.93 puis 1 ;
  - FUNC montre les fonctions sur les touches a icones ;
  - fleche DOWN puis UP : SRC 2/2 puis 1/2 ; en mode KEYBOARD, TRIG 5 envoie un coup a -3 demi-tons (pf 0.8409) ;
  - FUNC + SOUNDS, trois fleches DOWN, YES : MY KICK sur le BD (le programme porte `bd/~My Kick.wav`) ; OPEN FOLDER envoie mm_reveal ; FUNC + OPEN envoie mm_import {family 0, track 0} sans ouvrir le panneau ;
  - OPEN : FINE du BD a +34 (pf 1.0198 dans le programme), CHOKE 2 (choke 2 dans le programme), le sample perso pose depuis SAMPLES, OPEN FOLDER et RESCAN envoyes ; CLOSE, OPEN, Echap ;
  - le site ne change pas : V.3.0 par defaut et V.6.0 (?face=dt2) identiques au pixel avant et apres (1440 x 900) ; `npx tsc` : 105 erreurs, celles d'avant ;
  - C++ : `PluginEditor.cpp` compile avec les en-tetes de JUCE (`-fsyntax-only`) ; le Finder se verifie sur le Mac.
- **Build vert du lot 6** (run 42552384707, 02:48 UTC le 2026-11-09), dans la release `mm-rytm-latest` (commit 4b15a9d).

### Lot 7, les retours de Mika sur le lot 6 (2026-11-09)

Mika (apres l'installation) : « le bouton OPEN c'est vraiment pas ce que je souhaitais, je voulais tous les parametres super intenses en sampling ou alors les settings ; je ne sais pas comment faire un parameter lock ; je ne comprends pas le bouton PAGE, une page = 16 steps c'est tout ; l'ecran doit etre imperativement de meilleure qualite, des graphismes super cool en noir et blanc (j'aime l'effet SWING) ; la 3D doit fonctionner a merveille, presque du realisme, un peu plus de hauteur ; le clic droit pour un parameter lock ? ; KEYBOARD : supprime tout ». Ses choix : le relief 3D (pas la fenetre), OPEN = un editeur de sample + SETTINGS, rien a la place de PAGE.

7a. KEYBOARD, PAGE, le P-LOCK au clic droit :
- `rytm/faceplate.ts` PLUGIN_GONE : ni KEYBOARD ni PAGE (ni ses 8 LED, `theme/face.ts` PAGE_LEDS) ; la colonne gauche FUNC TRK PTN MUTE SOLO calee sur les rangees de la face ; le crossfader et ses scenes prennent toute la place (A a gauche, B a droite, 59 mm de course), le logo M au-dessus ; `ui/Hotspots.tsx` sans leurs jumeaux ;
- `audio/pattern.ts` MAX_STEPS, MAX_PAGES : 16 pas et une page dans le plugin (un pattern plus long d'avant se lit sur ses 16 premiers pas) ; `menus/pagesetup.ts` : STEPS de 1 a 16 ;
- `actions/internal/keys60.ts` : KEYBOARD ne fait rien dans le plugin ; les infobulles des fleches ne le citent plus ;
- `actions/locks.ts` stepLockRight, `ui/Hotspots.tsx` : un clic droit sur un pas (hors TRK) le met en P-LOCK garde, sans REC ; les potards y ecrivent leurs verrous ; clic droit encore, Echap : sortie ;
- verifie dans Chromium : clic droit sur le pas 5, potard A : le coup du BD du pas 5 prend son propre son (TUNE +15, snd 1 dans le programme), le pas 5 jaune, LOCK a l'ecran, le bloc TUNE en negatif avec son P ; clic droit encore : P-LOCK OFF ; sur un pas vide, tourner un potard y pose le coup avec son verrou.

7b. L'ecran (plugin seulement) :
- `scene/screen/pluginGfx.ts` (nouveau) : un dessin noir et blanc par reglage a la place du petit potard generique :
  - la vraie forme d'onde du sample de la piste dans STRT et LEN (les cretes du PCM decode, ce qui ne joue pas a peine) ;
  - DIST (une onde qui sature), CHORUS (deux ondes), DELAY (les echos), REVERB (la queue), BIT (l'escalier), COMP (la courbe) ;
  - TUNE (l'onde plus ou moins serree), FINE (une regle de cents), PAN (l'arc L-R), NOTE (une octave de clavier), BPM, MASTER, ENV ;
  - les LFO (SPD, DEP, FADE, PHAS, LFO.T), uTIME (le coup decale sur la grille), TLEN (les pas joues) ;
- les cases libres d'un ecran en grand dessin : le sample en grand avec START, la fin, sa duree (SRC 2/2), la chaine des effets de la piste (FX 2/2), les 16 pas de la piste et sa longueur (TRIG 2/2), le swing sur une mesure (TEMPO, la rangee METR SIG. PRRL VOL a venir retiree dans le plugin) ;
- `screen/dt2.ts` paintGrid, `screen/grid.ts` paintBlock : les branchements ; `rytm/pageView.ts` : le bloc porte sa cible ;
- verifie dans Chromium sur les 12 ecrans (captures).

7c. La 3D (plugin seulement) :
- `theme.ts` PLUGIN_VIEW : la camera penchee de 16 deg vers soi, un champ de 20 deg (10 avant : la face restait plate), un rien d'air (fit 1.04) et le pivot avance vers le bord avant (la perspective grandit l'avant) ; `scene/renderer.ts` updateCamera ;
- `rytm/faceplate.ts` RELIEF : touches et pas 1.55 fois plus hauts, potards 1.35 fois : leurs flancs se voient, la caisse aussi ;
- `scene/renderer.ts` screenUV, `plugin/ScreenMouse.tsx` toScreen : l'ecran vu de biais est un trapeze, un clic y passe par le rayon de la camera (la ligne sous la souris, verifie : la 3e ligne de SOUNDS cliquee = BD 4) ;
- verifie dans Chromium : pages, P-LOCK au clic droit, SOUNDS a la souris, scene A, crossfader (x = 1), OPEN, fleches.

7d. OPEN = l'editeur de sample et les SETTINGS (`plugin/OpenPanel.tsx` reecrit) :
- SAMPLE : la forme d'onde du sample de la piste choisie (min et max par colonne, a l'envers en REVERSE), START et END a tirer (Maj : au dixieme ; ecrits dans t:sstart et t:slen avec les lois du moteur, SAMPLE_START_MAX et sampleLenPart), la molette zoome, un glisser deplace la vue, un double clic la remet ; ce qui ne joue pas en retrait, le fondu de LEN (sampleLenFadeS), l'enveloppe AMP (resolveHit, decayTau) a l'echelle du temps du coup (TUNE et FINE compris) ; la regle des ms ; ◀ ▶ le sample du type d'avant ou d'apres, LISTEN (le moteur joue la piste : trigger, liveHook), REVERSE, RESET, IMPORT, FOLDER ; les potards SAMPLE (STRT LEN TUNE FINE LEV PLAY), AMP (ATK HOLD DEC PAN), FILTER (FREQ RESO TYPE ENV) ;
- SETTINGS : STEPS, BPM, SWING, MASTER ; PERSONALIZE (TRK SELECT, LED, BACKLIGHT, SUBPAGE : state/personal.ts, garde) ; le dossier des samples ; la souris et les touches ; la version ;
- verifie dans Chromium : S tire a droite : start 0.118 dans le programme ; E tire a gauche : len 0.559 ; REVERSE : rev true ; ▶ : bd/Bd 4.wav ; RESET : start 0, len 1 ; TRK SELECT SILENT garde dans le stockage ; le zoom (captures).
- Le site : V.3.0 par defaut et V.6.0 (?face=dt2) identiques au pixel avant et apres le lot 7 ; `npx tsc` : 105 erreurs, celles d'avant.
- **Builds verts du lot 7** : 7a run 42556440981, 7b run 42557403048, 7c run 42557907899, 7d run 42558551923 (03:53 UTC) ; la release `mm-rytm-latest` porte le commit 5d54827.

7e. La release protegee : d'autres sessions poussent sur main et sur leurs branches (le menu du site, le MM-ARP) ; ce workflow y tourne aussi et publiait leur build, avec un MM-RYTM plus ancien (vu : main a 03:41 UTC, puis une autre branche a 03:43, avant que les builds du lot 7 reprennent la release). `.github/workflows/plugin.yml` : l'historique sans les fichiers (fetch-depth 0, blob:none) ; la release ne prend un build que si son plugin est au moins aussi recent (la date du dernier commit qui touche plugin/mm-rytm ou src/v4/plugin, ecrite dans ses notes : plugin-time). Limite : les branches qui n'ont pas encore ce workflow (main compris) publient toujours sans garde, jusqu'a ce que main le recoive.

### Lot 8, la pattern en clip MIDI (DRAG MIDI, 2026-11-09)

Demande de Mika : « je voudrais un bouton pour tout transferer directement la pattern qui joue encore dans Rytm dans un clip MIDI, avec les bonnes velocites etc., comme un Drum Rack par exemple ».

- `plugin/mm-rytm/dsp/MidiExport.{h,cpp}` (nouveau, sans JUCE) :
  - exportPattern rejoue les trigs comme `Engine::evalStep` : velocite du coup (le gain du pas, x 127 : un clip rejoue le MM-RYTM au meme niveau), swing, uTIME (une avance du premier pas tombe a la fin du clip), LEN (INF : un pas), RTRG (RATE, VFAD, RLEN), TLEN, conditions (A:B, PRE, NEI) et PROB (le tirage du moteur, une realisation), mute, lock trigs sans note ; FILL ne joue pas ;
  - le clip fait un cycle entier, en mesures de 4/4 : A:B (le PPCM des B), TLEN (le PPCM des longueurs), 64 mesures au plus ; le deuxieme de trois cycles simules (les retrigs et les PRE d'avant lui compris) ;
  - deux notes de meme hauteur ne se chevauchent pas ; writeSmf : format 0, 960 ticks, nom, 4/4, tempo, canal 10, la fin au bout du clip ;
  - kTrackNote : les 16 pistes sur les 16 pads d'un Drum Rack (C1 36 a D#2 51), chacun une fois, les huit premieres en GM (BD 36, SD 38, CH 42, OH 46, CP 39, TOM 45, HT 50, CY 49), puis BD2 37, SD2 40, CH2 44, OH2 47, CP2 43, TOM2 41, HT2 48, CY2 51 ; trackOfMidiNote, la table inverse (plus 35 BD et 52, 55, 57 CY).
- `src/PluginProcessor.{h,cpp}` : exportMidi (le programme en JSON relu, le pattern que joue le moteur : fbPat, celui de la face ou l'un des autres), programVersion ; l'entree MIDI lit la meme table (16 pistes au lieu de 8 : un clip exporte, pose sur la piste du MM-RYTM, le rejoue).
- `src/PluginEditor.{h,cpp}` MidiBar : une barre native de 34 px sous la face (la fenetre passe a 1200 x 765) : DRAG MIDI (glisser : le fichier dans le dossier temporaire, `performExternalDragDropOfFiles` ; un clic : SAVE), ce qui part (A01, 1 BAR, 23 NOTES), SAVE .MID (~/Music/MM-RYTM MIDI, montre dans le Finder).
- `tests/engine_test.cpp` : 9 tests (les notes et velocites, swing et uTIME, TLEN 3 dans 16 = 3 mesures, A:B 1:2 et 2:2, RTRG et VFAD, mute, lock trig, LEN, la table des 16 pads relue par l'entree, le fichier relu, les noms A01 a H16) : 48 tests, tout est OK sur Linux.
- C++ de la fenetre : compile avec les en-tetes de JUCE (`-fsyntax-only`) ; le glisser vers Ableton se verifie sur le Mac.
- **Build vert du lot 8** (run 42564463325, 05:01 UTC) ; 4 minutes plus tard, le workflow d'une autre branche (le MM-ARP, sans le garde-fou du lot 7e) a remis un MM-RYTM ancien dans `mm-rytm-latest` ; relance a la main (workflow_dispatch) : la release porte de nouveau 0e309b3 (05:15 UTC).

### Lot 9, NEW et CLEAR, la release reservee (2026-11-09)

Mika : « je veux un bouton CLEAR ou NEW preset vierge » ; puis « il est ou le nouveau design ?! » (il avait installe pendant que la release etait ecrasee par la branche du MM-ARP : le bon zip n'avait jamais ete telecharge).

- `actions/patterns.ts` pluginNew (pattern vide, scenes vides, FX globaux a zero, STRETCH au centre, le kit de depart des 16 pistes : `kit16FromLegacy(defaultKit())`, aucun mute ni solo) et pluginClear (le pattern vide, les sons restent) ; une etape d'UNDO chacun ; `plugin/bridge.ts` : `mm_cmd`.
- `src/PluginEditor.{h,cpp}` MidiBar : NEW et CLEAR, une boite de confirmation du plugin (AlertWindow, NEW / CLEAR = 1, CANCEL = 0), puis `mm_cmd` vers la face.
- Verifie dans Chromium : un autre sample sur le BD, CLEAR : 0 coup, le sample reste ; Cmd+Z : les 25 coups reviennent ; NEW : 0 coup, BD 1, swing 0 ; Cmd+Z : tout revient (BD 5, swing, coups). C++ : compile avec les en-tetes de JUCE.
- `.github/workflows/plugin.yml` : la release **mm-rytm**, que seule cette version du workflow ecrit (avec la garde plugin-time) ; mm-rytm-latest suit encore, au mieux. `update.sh` telecharge mm-rytm ; INSTALL et README donnent la nouvelle commande.
- **Build vert du lot 9**, la release **mm-rytm** creee (05:46 UTC, commit 6ee6721) ; verifie depuis le conteneur sans compte GitHub : son `update.sh` telecharge mm-rytm, son zip porte `BUILD.txt` = commit 6ee6721, branche claude/intelligent-ride-56tyeo.

### Lot 10, un stockage par instance (2026-11-10)

Mika : « J'ai des erreurs quand je load le plugin ca part dans tout les sens ! corrige ca rapidement ».

- Cause : toutes les WebViews d'Ableton ont la meme origine (`juce://juce.backend`), donc le meme localStorage. Deux MM-RYTM, ou un MM-RYTM et le MM-ARP (meme `restore.ts`), dans un projet : chacun effacait les cles mm.v4.* des autres en se restaurant, lisait l'etat de l'autre au chargement de ses modules, gardait dans le projet les cles de l'autre et recevait ses evenements `storage` (la liste des presets se rechargeait).
- Le build installe etait bien le bon (release mm-rytm, 6ee6721 ; le zip de mm-rytm-latest, de la branche MM-ARP, n'a jamais ete telecharge).
- `src/v4/plugin/restore.ts` : dans la page du plugin, `window.localStorage` devient un stockage en memoire, a l'instance seule, rempli par l'etat du projet. Le vrai stockage ne garde que la bibliotheque commune (presets, nom d'utilisateur, PERSONALIZE, apparence) et les cles hors mm.v4.* ; une instance neuve part de la machine de depart (plus de l'etat de la derniere instance). Les evenements `storage` des autres pages s'arretent, sauf une nouvelle valeur de la bibliotheque (un preset garde dans un autre projet apparait). Plafond de 5 M caracteres comme un navigateur (presets.ts sait ceder). Si la page refusait un autre localStorage : l'ancienne facon.
- Verifie dans Chromium (meme contexte = meme stockage, comme la WebView) : avant, une instance B (pattern videe) chargee avec A ouvrait avec la pattern de A (11,2,12,4,0,3) ; apres, A garde 11,2,12,4,0,3, B garde 0, une instance ajoutee ensuite a la pattern de depart, un faux MM-ARP qui efface et ecrit en boucle ne change rien ; un preset garde par A arrive chez B et dans le vrai stockage, la pattern de A n'y va jamais ; un ancien projet (lot 6) avec le transport d'Ableton : aucune erreur ; NEW, CLEAR et Cmd+Z identiques ; tsc a 105 (la base).
- **Build vert du lot 10** (run 42726280274), la release **mm-rytm** republiee ; verifie : son zip porte `BUILD.txt` = commit 952fe37, branche claude/intelligent-ride-56tyeo, 2026-11-10 00:17 UTC.

### Lot 11, le meilleur ami : look, mini ecran, VU, fenetre, OPEN en blanc (2026-11-10)

Mika : « vas-y la met-y du stock je veux que MM-RYTM soit mon meilleur ami » ; ses choix : le mini ecran a la place du logo, les VU-metres, la fenetre agrandissable ; « fais un melange des deux mais je prefere mes couleurs ! le rouge et du jaune orange pour la 2e couleur et gris blanc pour les boutons ; quand on clique sur OPEN je veux passer en white mode totale » ; puis « j'aime pas trop en dessous DRAG MIDI etc., la barre, je prefere que ce soit dans OPEN ».

- **Look** (plugin seulement, `theme.ts` applyAppearance) : la machine noire, les touches et les pads gris blanc de la machine claire (KEYS_LIGHT, PLUGIN_KEYS : teinte, matiere, lueurs, encre des legendes, temoins) ; le rouge des pas et de la page ; le jaune orange (PLUGIN_AMBER) pour FUNC, PLAY, MUTE, OPEN, les fonctions imprimees, le pointille Track/Mute et la tete de lecture (`scene/rytmFaceKeys.ts` GO_TONE, `scene/keyLabels.ts`).
- **Mini ecran** (`scene/miniScreen.ts`, `rytm/faceplate.ts` PLUGIN_MINI, le logo M retire du plugin) : le pattern qui joue, PLAY ou STOP, le suivant, les 16 pas et la tete, le niveau de chaque piste avec un pic tenu, les scenes A et B (EMPTY ou le nombre de reglages) et le crossfader, la sortie L et R, CLIP. Repeint seulement quand il change, 30 fois par seconde au plus.
- **VU-metres reels** : `dsp/Fx.cpp` la crete de chaque tranche (apres TONE, DIST, CHORUS, a LEVEL), `Engine::fbPeak` ; `PluginProcessor::takeMeters` (et la sortie apres MAIN VOLUME) ; `mm_meter` a 30 Hz tant que ca sonne, puis un zero ; `src/v4/plugin/meters.ts` : la montee tout de suite, la descente a 20 dB/s, le pic tenu 1 s, l'echelle de -48 a 0 dB.
- **Fenetre agrandissable** : `setResizable`, proportions fixes, de 840 a 2400 px de large ; la largeur gardee dans l'etat du projet (`uiW`).
- **La barre native retiree** : DRAG MIDI, SAVE .MID, NEW et CLEAR passent dans OPEN (onglet PATTERN · MIDI, la poignee DRAG MIDI aussi dans l'en-tete de chaque onglet) ; le glisser part de la face (`mm_drag_midi` : `performExternalDragDropOfFiles` avec l'evenement souris courant, la voie du MM-ARP) ; l'etat du clip (`mm_midi_info`) et les messages (`mm_midi_status`) ; NEW et CLEAR confirmes dans le panneau ; un clic sur la poignee garde le .mid.
- **OPEN en blanc total** : tout le panneau (et toute la fenetre, plus de bord) en clair : fond blanc casse, encre #191919, le rouge des choix, le jaune orange des titres, de la poignee et de l'enveloppe ; la forme d'onde en noir sur blanc, S et E en rouge.
- **START, END, PLAYS** (l'ecart vu sur la capture de Mika : LEN 123 ms, PLAYS 130,4 ms) : START et END sont des places dans le fichier, PLAYS la part jouee du fichier (comme LEN) ; avec TUNE ou FINE, HEARD AT THIS TUNE donne la duree entendue (PLAYS et la duree entendue divisaient tout par la hauteur, et LEN ne la compte pas).
- Verifie dans Chromium : la face (captures), le mini ecran avec des niveaux simules, OPEN SAMPLE et PATTERN en blanc, le glisser (un `mm_drag_midi` par geste), un clic (`mm_save_midi`), NEW confirme (32 coups, puis 0), Echap ferme ; la fenetre a 1680 px ; un ancien projet avec le transport : aucune erreur ; NEW, CLEAR, Cmd+Z ; au repos la boucle de rendu dort (0 dessin en 4 s), elle se rendort apres le son. Le site : identique au pixel (V.3.0 par defaut, ?face=dt2 noire et claire). C++ : compile avec les en-tetes de JUCE ; tests du moteur 50 OK (2 nouveaux : la crete du SD monte, celle du BD reste a 0, la lecture la remet a 0). tsc a 105 (la base).

- **Build vert du lot 11** (run 42745537872), la release **mm-rytm** republiee ; verifie : son zip porte `BUILD.txt` = commit e2f4bba, branche claude/intelligent-ride-56tyeo, 2026-11-10 02:54 UTC.
### Lot 12, retour aux couleurs, le logo, des touches plates (2026-11-10)

Mika, sur le lot 11 installe : « ca devrait etre plat et j'aimais bien les couleurs d'avant, je n'aime pas [le mini ecran], je veux mon gros logotype en face avant » ; « plat » : les touches (sa reponse).

- Les couleurs d'avant (touches noires, FUNC orange, PLAY vert, la tete de lecture d'avant) : `theme.ts`, `scene/keyLabels.ts`, `scene/rytmFaceKeys.ts` remis tels qu'au lot 10.
- Le mini ecran retire (`scene/miniScreen.ts` supprime, `rytm/faceplate.ts` PLUGIN_MINI, `scene/renderer.ts`) ; le logo M revient au-dessus du crossfader, comme avant.
- Les touches et les pas plus plats : `RELIEF.key` 0.8 dans le plugin (1.55 depuis le lot 7 ; le site : 1) ; les potards gardent leur hauteur.
- Les VU-metres du moteur restent, dans OPEN (onglet PATTERN · MIDI, LEVELS : 16 pistes avec leur nom, L et R, un pic tenu, CLIP) ; leurs envois ne reveillent plus le rendu 3D.
- Restent du lot 11 : la fenetre agrandissable, OPEN en blanc, DRAG MIDI, SAVE .MID, NEW et CLEAR dans OPEN, la barre du bas retiree.
- Verifie dans Chromium : la face (les couleurs et le logo d'avant, les touches plus basses), OPEN (les niveaux animes, le glisser, SAVE, NEW confirme), aucune erreur ; au repos 0 dessin. Le site : les seules differences avec le lot 10 sont dans le plugin (RELIEF du plugin, OPEN, le pont, deux modules du plugin). tsc a 105.

- **Build vert du lot 12** (run 42875630076), la release **mm-rytm** republiee ; verifie : son zip porte `BUILD.txt` = commit a404a62, branche claude/intelligent-ride-56tyeo, 2026-11-10 18:37 UTC.
### Lot 13, la vue de dessus, LEV au crossfader (2026-11-10)

Mika, sur le lot 12 (capture : scene B armee, page SRC, le bloc LEV dit NO SCENE) : « Je voudrais que ce soit vu du dessus, la machine parait un peu inclinee ; je voudrais pouvoir changer le level de la piste avec le crossfader, la ce n'est pas assignable ».

- **La vue de dessus** : `theme.ts` PLUGIN_VIEW { leanDeg 0, fovDeg 10, fit 1, dz 0 } : la camera perpendiculaire au panneau, de loin (le cadrage du lot 6), bord a bord ; plus de vue penchee (lot 7).
- **LEV de la page SRC = le niveau de la piste** (plugin seulement) : ce bloc reglait le niveau du sample (slev), un reglage « lourd » que les scenes ne gardent pas (NO SCENE). Il regle maintenant le VOL de la piste active (`t:vol`), le meme niveau que LEVEL/DATA et le MIXER (lot 5), deja une cible de scene que le moteur mene en temps reel :
  - `rytm/pages.ts` SRC_VOL a la place de SRC_SLEV quand les pistes sont typees ; `actions/internal/kit.ts` : le reglage de piste `vol` (lit et ecrit `level`, les textes de VOL) ; `actions/scenes.ts` trackSceneId : `rytm:voice:<piste>:level` sur les 16 pistes ; `actions/ctlall.ts` (CONTROL ALL comme avant) ; `rytm/infoIds.ts` (la carte de VOL) ;
  - `audio/tracks.ts` typedKit : le niveau du sample d'avant passe dans le VOL au meme gain (slev^2 x (VOL / 0.8)^2 : VOL x slev), slev revient a 0 dB ; ce qui s'entend ne change pas ;
  - OPEN (SAMPLE, LEV) suit : c'est le meme bloc.
- Verifie dans Chromium : un projet d'avant (BD sample a 86, SD VOL 0.6 et sample a 0.5) : les memes gains (tranche du BD 0.459, du SD 0.141, comme attendu), le sample a 0 dB ; scene B armee + LEV vers le bas : la scene garde `rytm:voice:BD:level`, le programme a ses 9 positions (tranche du BD de 0.459 a 0.032), le SD ne bouge pas, le bloc LEV se montre en negatif avec son B ; le crossfader envoie sa position ; clic droit sur le pas 3 + LEV : le verrou `level` du pas (gain du coup 0.149, les autres a 1) ; piste 9 (BD2) + scene A : ses 9 positions (0.25 a 1) ; OPEN montre LEV 102, 0.0 dB ; la vue de dessus (capture), toutes les zones de souris repondent. Ancien projet + transport : aucune erreur ; NEW, CLEAR, Cmd+Z. Le site : identique au pixel (V.3.0, ?face=dt2 noire et claire). tsc a 105.

- **Build vert du lot 13** (run 42881909772), la release **mm-rytm** republiee ; verifie : son zip porte `BUILD.txt` = commit 34a4def, branche claude/intelligent-ride-56tyeo, 2026-11-10 19:16 UTC.
### Lot 14, le plantage de Live, START et END sur SRC 2/2 (2026-11-10)

Mika, sur le lot 13 : « j'etais en train de tester pattern et ca a fait planter Live ! c'est tres grave » ; « je suis sur la page 2 de SRC, je ne sais pas comment modifier le start ou le end » ; « je teste le BD, le level doit etre par defaut comme tous les autres ».

- **Le plantage** (non reproduit ici : pas de Mac, pas d'Ableton ; le rapport de plantage est demande a Mika). Le suspect : DRAG MIDI depuis OPEN (lot 11). `performExternalDragDropOfFiles` de JUCE lance le glisser avec `[[view window] currentEvent]`, l'evenement en cours de l'application ; appele depuis un message de la WebView (et plus depuis un mouseDrag de JUCE, comme la barre des lots 8 a 10), cet evenement n'est pas toujours un evenement souris : AppKit leve alors une exception que rien n'attrape dans un plugin, et l'hote tombe. Le reste du code natif du lot 11 a ete relu (les cretes, la fenetre agrandissable, l'etat du MIDI, l'export) sans autre chemin de plantage trouve.
  - `src/MacFileDrag.{h,mm}` (Objective-C++, nouveau) : le bouton gauche doit etre enfonce ; l'evenement du glisser est fabrique a la position de la souris dans la fenetre (la methode d'Electron pour startDrag) ; toute exception d'AppKit est attrapee et devient un message (« The drag did not start ... SAVE .MID ») ; `PluginEditor.cpp` dragMidi ne passe plus par JUCE ; `CMakeLists.txt` : le fichier .mm sur macOS.
  - `plugin/OpenPanel.tsx` : la poignee nettoie ses ecoutes meme si le relacher n'arrive jamais (le glisser du Mac l'avale).
- **SRC 2/2 = SRC SAMPLE** (plugin) : A STRT et E END a gauche du sample en grand (`rytm/pages.ts`) ; S et E se tirent a la souris dans l'ecran (`plugin/ScreenMouse.tsx` WaveDrag : le repere le plus proche, Maj fin, un clic loin des deux l'amene, double clic le sample entier ; seulement sur cette page, sans menu ni P-LOCK) ; le dessin suit les lois du moteur (START jusqu'a 90 % du fichier, la fin par LEN ; avant : une approximation) ; FINE passe en C de la 1/2.
- **Le niveau du BD** : verifie, une instance neuve et NEW donnent le meme niveau aux 16 pistes (tranche 1, LEV 102, 0 dB). Sur le projet de Mika le BD est plus bas parce que son niveau de sample avait ete baisse (86) : le lot 13 l'a reporte dans le niveau de la piste, au meme volume. Double clic sur le potard LEV : 102.
- Verifie dans Chromium : SRC 1/2 (A TUNE, B PLAY, C FINE, D SAMP, E STRT, F LEN, H LEV), SRC SAMPLE (A STRT, E END) ; le potard A et le potard E changent START et LEN ; S tire a 30 % et E a 70 % a la souris (START 0.323, LEN 0.535, attendus aux 2 px de la prise pres) ; double clic : le sample entier ; la zone part dans un menu et sur une autre page ; double clic sur LEV : 0 dB ; LEV en scene, en P-LOCK, la piste 9 (lot 13) ; OPEN (un `mm_drag_midi` par geste, SAVE, NEW) ; ancien projet + transport : aucune erreur. Le site : identique au pixel (V.3.0, ?face=dt2). tsc a 105. Le code Objective-C++ ne se compile que sur le Mac du CI.

- **Build vert du lot 14** (run 42892592585 : le fichier Objective-C++ compile sur le Mac du CI), la release **mm-rytm** republiee ; verifie : son zip porte `BUILD.txt` = commit 936dd16, branche claude/intelligent-ride-56tyeo, 2026-11-10 20:19 UTC, et le binaire contient le lanceur (la classe MMRytmFileDragSource, ses messages).
### Lot 15, OPEN dans la carte noire, la touche des presets, TRK, les legendes, l'ombre (2026-11-11)

Mika, sur le lot 14 : « je n'aime pas le OPEN [blanc]. Je veux que ca se retrouve quand meme dans un PCB, eventuellement encore avec un ecran a l'interieur ; au lieu du PCB vert je veux PCB noir avec quelques composants ca et la mais plus visible » ; « le bouton Save Project ne sert a rien, je veux plutot que ce soit le meme bouton mais pour preset au lieu de settings » ; « quand je bouge le crossfader l'ombre ne suit pas directement » ; « quand j'appuie sur le bouton TRK ca disparait trop rapidement, j'ai pas le temps de selectionner la track » ; « les ecritures sous les boutons doivent etre plus discretes et autre police eventuellement, regarde la Digitakt » ; « j'aime l'effet aluminium brosse noir pour la texture du boitier » (rien a changer).

- **OPEN rouvre le capot** (plugin) : `actions/nav.ts` ne passe plus par un panneau a part, le capot 3D du site s'ouvre. `theme.ts` : EXPLODE du plugin (le capot se souleve de 1.2, part a plat de 12.5 vers le haut, hors du cadre), OPEN_VIEW (la carte remplit la fenetre, bord a bord), PLUGIN_PCB_SCREEN (la zone de l'ecran : 8.58 x 4.54 unites, a la place des TWEAKS du site, que le plugin n'a pas). `scene/renderer.ts` : la carte creee avec cette zone degagee (aucun composant ni piste dedans), les TWEAKS caches et sans cibles, le cadrage ouvert du plugin, `pcbScreenRect()`.
- **La carte noire** : `scene/pcb.ts`, dans le plugin : vernis noir (#0a0b0f), pistes a peine plus claires dessous (#1e1e23), taches grises ; l'or des pastilles et des vis, le blanc de la serigraphie et les composants (condensateurs, bornier bleu, puces, radiateur, LED PWR) ressortent. Le site garde sa carte verte.
- **L'ecran sur la carte** : `plugin/OpenPanel.tsx` refait : un module d'ecran (cadre, quatre vis, « LCD1 ») pose sur la zone degagee, par-dessus la vue 3D (sa place vient de la projection de la zone) ; tout en em (1 em = sa largeur / 88) : il suit la fenetre agrandie. Noir, l'encre de l'ecran de la machine, le rouge des choix, l'orange des titres. SAMPLE : les 16 pistes, le sample, la forme d'onde (elle prend la hauteur libre), les 14 reglages sur une rangee. PATTERN · MIDI : DRAG MIDI, SAVE .MID, NEW, CLEAR sur une rangee, les niveaux dessous. SETTINGS : trois cartes, l'aide sur deux colonnes, sans defilement. CLOSE et Echap referment le capot. Les fleches et les couches de souris de l'ecran de la face partent capot ouvert (`plugin/ScreenMouse.tsx`).
- **La touche des presets** (l'ancienne SETTINGS, que SAVE PROJ rendait inutile : « SOON ») : une disquette ; sa tape ouvre la liste des presets, sa fonction (clic droit) SAVE PRESET (la liste s'ouvre, puis SAVE : OVERWRITE ou AS NEW, le nom) ; imprime « Save Preset ». `actions/chords/chords60.ts`, `rytm/faceplate.ts` PLUGIN_KEY_WORDS, `theme/face.ts`, `scene/keyLabels.ts` (l'icone `disk`), `scene/rytmFaceKeys.ts` (allumee avec la liste). Les reglages restent dans OPEN.
- **TRK** : deux causes. Un clic de plus de 350 ms etait une tenue (TRK s'eteignait au relacher) : `theme.ts` FACE_HOLD_MS infini dans le plugin (TRK, les scenes, FUNC : tout clic garde). Et la garde de la face DT2 ne durait que 1,5 s : `state/trk.ts` LATCH_MS 8 s dans le plugin (TRK ne modifie REC, PLAY, STOP que ses 1,5 premieres secondes, comme avant).
- **Les legendes sous les touches** : plus petites (1.16 au lieu de 1.3), fines (400 au lieu de 600), serrees (0.04 em au lieu de 0.2), l'orange attenue (82 %) ; Track/Mute et les noms des potards de meme. `theme/face.ts`, `scene/silk.ts` (interlettrage et alpha par texte).
- **L'ombre du crossfader** : elle n'etait refaite qu'a la fin du geste ; dans le plugin, a chaque pas (`scene/renderer.ts` syncScene).
- Verifie dans Chromium : OPEN (le capot, l'ecran a 866 x 448 px sur la carte, rien ne deborde), la piste 9, PATTERN (l'etat du clip, un `mm_drag_midi` par geste, SAVE, les niveaux, NEW confirme : 32 coups puis 0, Cmd+Z : 32), SETTINGS sans defilement, CLOSE (la face et ses fleches reviennent), Echap ; la touche des presets (la liste ; clic droit : SAVE AS et le nom) ; TRK apres un clic de 600 ms et 3 s : allumee, « TRK: PICK A TRACK » ; l'ombre : l'image tenue = l'image relachee ; les lots 13 et 14 (LEV en scene, P-LOCK, SRC SAMPLE) ; ancien projet + transport : aucune erreur ; au repos 0 dessin. Le site : identique au pixel (V.3.0, ?face=dt2, et son capot ouvert : la carte verte). tsc a 105.

- **Build vert du lot 15** (run 42944359127), la release **mm-rytm** republiee ; verifie : son zip porte `BUILD.txt` = commit 1fa6da8, branche claude/intelligent-ride-56tyeo, 2026-11-11 02:21 UTC.
### Lot 16, OPEN en grand, le capot, PERFORM, LIVE REC, les presets en variations (2026-11-11)

Mika, sur le lot 15 : « image 1 bien ! mais doit prendre vraiment plus de place dans l'ecran open » ; « Close doit etre plus voyant sinon personne va comprendre, ou alors j'aimerais que le dessus soit visible pour que les gens pensent qu'ils peuvent rabaisser le capot (mais a peine visible pour pas gener) » ; « les knobs devraient etre en 3D aussi ici » ; « des variations de presets dans la liste, genre D&B 1 2 3, Indie Dance 1 2 3 [...] c'est super important que ce soit super efficace » ; « a quoi sert le bouton PERFORM ? [...] mets par defaut PERFORM, pour pouvoir faire des choses en live » ; « sauvegarde de preset qui n'est pas a l'ecran ? je veux pas de User quelque chose, je veux juste le nom du preset et pouvoir ecrire » ; « enleve le bouton Bank » ; « en cliquant deux fois dans REC je veux pouvoir faire des enregistrements d'automations en live [...] je sais que c'est quelque chose de gros mais je veux le faire ».

- **OPEN en grand** : `theme.ts` PLUGIN_PCB_SCREEN passe de 8.58 x 4.54 a 10 x 5.61 unites : l'ecran fait 1022 x 568 px a la taille de depart (866 x 448 avant), 66 % de la fenetre. Les composants de la carte ont leurs places du plugin (PLUGIN_PCB_PARTS) : une bande en haut (regulateur et son radiateur, deux condensateurs, TL072, NE555, le connecteur, le bornier bleu, la LED PWR allumee, des CMS) et des CMS le long des deux bords ; les quatre vis restent. `plugin/OpenPanel.tsx` : 1 em = la largeur / 98, la forme d'onde prend la place gagnee.
- **Le capot visible, CLOSE voyant** : EXPLODE.slideZ du plugin -7.18 (hors du cadre avant, -12.5) : le bord avant du capot, avec le bas de ses touches de pas, reste en haut de la fenetre (26 px a la taille de depart). `scene/renderer.ts` lidEdgeY le mesure ; OpenPanel y pose une bande cliquable, « ▼ CLOSE THE LID », qui s'allume au survol. Le bouton CLOSE est rouge plein, avec ESC ecrit dessus.
- **Les potards en relief** : `ui/KnobPanel.tsx` KnobView accepte `relief` (le site ne le demande pas, son dessin ne bouge pas) : une ombre portee, une jupe, un capuchon bombe et son reflet (trois degrades), un index blanc, et un anneau de 27 segments (ceux de la valeur allumes) comme les potards de la face vus de dessus ; 56 px (33 avant).
- **PERFORM par defaut** : la premiere touche (trois curseurs, l'icone `perf`) ouvre PERFORM a la tape, la liste des presets au clic droit (« Presets » imprime dessous) ; `actions/chords/chords60.ts`, `rytm/faceplate.ts`, `theme/face.ts`, `scene/keyLabels.ts`, `theme.ts` MARK_ICON. La page (`scene/screen/menus/mixer16.ts` PERFORM_SLOTS, plugin seulement) : A a H = DIST, BIT, CHORUS, DELAY, REVERB, COMP, MASTER, XFADE ; LEVEL/DATA = le crossfader, gauche / droite arment SCENE A / B. Une scene armee garde ces effets : le crossfader les mene (le moteur les interpole deja, lot 1). La touche a la disquette seule s'allume avec la liste (`actions/internal/keys60.ts` faceMenuOf).
- **Save Preset** : `plugin/NameDialog.tsx` remplace le dialogue du site dans le plugin : un seul champ, le nom, pose sur l'ecran de la machine (Stage.screenRect), Entree garde, Echap annule. Plus d'utilisateur : `state/presetName.ts` NAMES_PLUGIN (le libelle est le nom seul, 16 lettres au lieu de 10), `state/presetMode.ts` (l'utilisateur fixe, jamais demande ; l'ecran montre le nom seul, le curseur ne va plus sur USER).
- **Plus de banque** : la legende Bank sous PTN retiree, FUNC + PTN (le clic droit) fait comme PTN, les fleches ne changent plus de banque en vue PTN ; les libelles et l'aide suivent. Un clip Pgm d'Ableton atteint toujours les 128 patterns.
- **LIVE REC dans le plugin** : il existait au site (V.5.3) mais lisait le journal de l'horloge du navigateur, vide quand le moteur C++ joue : rien ne s'ecrivait. `actions/internal/live.ts` heardEntry : dans le plugin, le pas entendu est celui de la tete du moteur (`plugin/head.ts`, `mm_transport`), dans le pattern qu'il joue ; liveStepOf : une piste a sa longueur (TLEN) ecrit sur son pas a elle. Pour ca le moteur envoie `rel` (les pas depuis le debut du pattern : `dsp/Engine.h` fbRel et forEachStepRel, `PluginProcessor` Feedback, `PluginEditor` mm_transport). Double clic sur REC : 600 ms dans le plugin, que REC soit allume ou non au premier clic (`actions/face.ts`). Un potard d'une page de piste tourne ou tenu ecrit son P-LOCK sur chaque pas traverse (un lock trig sur un pas vide) ; une touche de pas ecrit un coup la ou est la lecture ; un reglage de toute la machine dit « IS GLOBAL: NOT RECORDED ».
- **Les presets d'usine du plugin** : `state/pluginFactory.ts`, 12 styles x 3 variations (DARK DISCO, INDIE DANCE, MINIMAL, ITALO, EBM, ELECTRO, HOUSE, TECHNO, ACID, ROLLING, BREAKBEAT, D&B ; 1 la base, 2 le groove, 3 la version pleine ou cassee). Chaque preset pose ses 16 pistes sur des samples de la banque (les presets du site perdaient leur kit dans le plugin : tout tombait sur le premier sample), les niveaux par role corriges du RMS mesure de chaque fichier, les panoramiques, les envois, CH et OH qui se coupent. `state/presets.ts` : la liste du plugin, et asLoaded (l'empreinte du son juste apres le chargement : un preset d'usine ne se dit plus EDITED a peine charge).
- Verifie dans Chromium : OPEN (1022 x 568, 14 potards en relief, un potard tourne, les trois onglets sans debordement, la bande du capot referme ; a 1800 x 1097 aussi) ; PERFORM (la tape, DIST change le programme ; le clic droit : la liste) ; Save Preset (le champ sur l'ecran, un seul, « INDIE DANCE 2 XX » garde et affiche sans USER/) ; PTN sans banque ; LIVE REC (la tete simulee a 100 ms par pas, double clic sur REC, un potard tourne puis tenu : des P-LOCK de TUNE sur les 16 pas, des lock trigs sur les pas vides) ; les 36 presets charges un par un : le bon sample sur chacune des 16 pistes, le tempo, aucun fichier manquant, aucun « edited », aucune erreur. Moteur : 52 tests (2 de plus : rel compte sans repartir, -1 a l'arret). Site : les 4 vues (V.3.0, face DT2, DT2 claire, OPEN) identiques au pixel pres ; ses tests de noms, de face et de BPM passent. tsc : 105, comme avant.
- Jamais de lecture audio pendant les tests : les presets sont juges sur leur programme, pas a l'oreille.

- **Build vert du lot 16** (run 42956463058 : le moteur et le plugin macOS), la release **mm-rytm** republiee ; verifie : son zip porte `BUILD.txt` = commit e1fe45c, branche claude/intelligent-ride-56tyeo, 2026-11-11 04:08 UTC, et l'INSTALL.md du lot 16.

### Lot 17, les potards d'apres la photo de Mika, en chrome fonce (2026-11-11)

Mika, avec la photo d'un potard : « pourrais-tu mettre ce type de knob, mais le dessus, au lieu de chrome, mets chrome fonce, plus noir quoi ; mets ca sur tous les knobs que tu vois et adapte pour les petits knobs dans OPEN ». Puis, devant un premier essai (commit 4e5cf4c) : « ca ne va pas du tout, pourquoi tu peux pas faire comme ce que je t'ai envoye ? ».

- **Le premier essai etait faux** : j'avais lu la photo trop vite (une jupe a quatorze petites cannelures, un petit capuchon terne, un repere fin). La photo agrandie et mesuree montre autre chose : une base ronde et lisse, une prise noire a six lobes larges, un grand capuchon de metal brosse a deux reflets francs, un repere blanc epais.
- **Les potards de la face** (A a H, MAIN VOLUME, LEVEL/DATA), plugin seulement : `scene/encoders.ts` (MOOG, moogGeometry, moogTopGeometry, derriere IN_PLUGIN ; `scene/sideKnobs.ts` passe par les memes fonctions). Les cotes de la photo, en part du rayon de la base : la prise 0.85 aux lobes et 0.74 aux encoches, le capuchon 0.63, le repere du bord du capuchon a 0.95, large de 0.13. Ce qui tourne : la prise a six lobes (un lobe sous le repere), son chanfrein, le repere. Ce qui ne tourne pas (le maillage immobile de l'ancienne collerette) : la base, plus claire en haut a gauche comme sur la photo, et le dessus du capuchon : le reflet reste face a la lumiere quand on tourne. Le capuchon est en chrome fonce : les memes reflets que la photo (10 h 30, large ; 4 h 30, etroit ; le plus sombre a 7 h 30), des stries fines, sur un fond de 24 a 68 sur 255 au lieu de 90 a 170. Le maillage immobile ne recoit plus l'ombre (celle de la prise noircissait toute la base) : l'ombre de la prise est peinte, la base fait la sienne sur le panneau. LEVEL/DATA, un encodeur sans fin, reste sans repere. Les anneaux de valeur ne changent pas.
- **Les petits potards d'OPEN** : `ui/KnobPanel.tsx` (le dessin `relief`) : le meme potard en SVG, aux memes cotes : la base ronde, la prise a six lobes et son repere epais qui tournent, le dessus en 120 secteurs de gris (le meme reflet, immobile), son filet ; `plugin/OpenPanel.tsx` (les matieres). L'anneau de 27 segments reste.
- Verifie dans Chromium : une planche cote a cote avec la photo (la face, la colonne gauche, OPEN), un potard tourne (le repere et les lobes suivent, le reflet reste), OPEN (14 potards, TUNE 0 puis +10, rien ne deborde). Site : les 4 vues identiques au pixel pres, ses 7 tests de face passent. tsc : 105.

- **Build vert du lot 17** (run 42963128891), la release **mm-rytm** republiee ; verifie : son zip porte `BUILD.txt` = commit 0b9df1e, branche claude/intelligent-ride-56tyeo, 2026-11-11 05:10 UTC.

### Lot 18, les potards en chrome, exactement comme la photo (2026-11-11)

Mika, devant le chrome fonce du lot 17 : « fais-les chrome alors, les boutons exactement comme sur l'image ».

- **Les gris de la photo, mesures** : `src/v4/rytm/knobLook.ts` (nouveau, sans import, partage par la face 3D et OPEN). Le capuchon releve tous les 10 degres autour de son centre : le fond 104 +/- 14, deux reflets satures (10 h 20, large ; 4 h 40, etroit), deux bandes sombres en travers (90), deux filets faibles ; la base presque noire (26) avec un large reflet en haut a gauche (jusqu'a 124) ; la prise a 38 ; le repere a 215. Les cotes : prise 0.85 / 0.74, capuchon 0.62, repere jusqu'a 0.95, large de 0.13.
- **La face** (`scene/encoders.ts`, `scene/sideKnobs.ts`, plugin seulement) : le dessus immobile du potard (la base et le capuchon) est maintenant une image peinte pixel par pixel (moogTexture, 512 px, une pour tous les potards) posee sur deux faces a plat, a la place des couleurs de sommets : celles-ci laissaient une ligne pointillee au flanc des reflets (la diagonale des triangles) et pas de stries fines. La prise et le repere restent en geometrie et tournent. La prise ne recoit plus l'ombre du capuchon (elle la noircissait d'un cote : sur la photo elle est d'un gris egal).
- **OPEN** (`ui/KnobPanel.tsx`, `plugin/OpenPanel.tsx`) : les petits potards lisent le meme module : le capuchon chrome en 144 secteurs, la base et son reflet en 72 secteurs.
- Verifie dans Chromium, chiffres a l'appui : le capuchon rendu contre la photo, tous les 30 degres : 95 137 229 117 85 86 106 231 245 125 92 94 pour 106 152 228 119 114 91 112 195 255 121 119 99 ; la base : 94 et 125 au reflet pour 95 et 124, 18 a 36 ailleurs pour 23 a 28. Une planche cote a cote avec la photo. OPEN : 14 potards, un potard tourne. Site : les 4 vues identiques au pixel pres, 7 tests de face sur 7. tsc : 105.

## 2. Decisions prises et pourquoi

- **9 positions plutot que les deux bouts** : les lois du site ne sont pas lineaires (LEVEL au carre, coupure exponentielle, crans des potards, hauteur sur sa grille) ; 9 positions calculees par le site lui-meme, puis une interpolation (en logarithme pour les grandeurs exponentielles) restent au plus pres du site sans recopier ses lois en C++.
- **Le son et la hauteur : la position la plus proche** : un son se calcule hors du thread audio ; 9 hauteurs par coup mene par une scene, c'est le « calcul le plus proche » du site (lazy).
- **La REVERB change de forme quand x se pose** : une nouvelle reponse remet le convolueur a zero ; la changer a chaque bloc d'un geste couperait la queue en continu.
- **Le moteur decide du pattern joue** (comme du transport) : c'est le seul a connaitre la fin du pattern a l'echantillon pres, et il doit jouer fenetre fermee. La face lui dit ce qu'elle veut (le suivant, la chaine) et suit ce qu'il joue.
- **Program change plutot que des notes** : c'est ce qu'une Elektron recoit, et Ableton l'envoie de chaque clip (case Pgm) ; le changement tombe a la fin du pattern, comme une Digitakt.
- **Pistes typees : une regle dans le store** plutot que des interdits dans chaque menu : un preset, SOUNDS ou MACHINE qui poserait une synthese ou un autre type est ramene a la regle au meme endroit. Les pistes 9 a 16 reprennent les 8 types (deux BD, deux SD...) : 8 dossiers de samples, 16 pistes.
- **TLEN sans repartir avec le pattern** : une piste de 7 pas qui repartirait tous les 16 pas ferait 7 + 7 + 2 ; la polymetrie voulue (minimale hypnotique) demande qu'elle tourne en continu. Le pattern garde sa longueur pour changer de pattern.
- **TLEN hors des verrous** : la liste des verrous (et la liste du MIDI) est construite sur l'ordre des reglages de trig, et cet ordre entre dans les liens SHARE ; y glisser TLEN aurait decale les LFO.
- **Les samples perso : un dossier du Mac plutot que le projet ou le navigateur** : le moteur les lit fenetre fermee ; ils servent a tous les projets ; Mika les range au Finder. Les mettre dans le projet Ableton l'aurait alourdi a chaque sauvegarde ; le stockage du navigateur de la WebView n'est pas lisible par le moteur.
- **La banque synthetisee masquee dans le plugin** : 43 sons calcules en JS par le site, que le moteur C++ ne sait pas calculer ; ils sonnaient muets. A reprendre si Mika les veut (la face les calculerait et les donnerait au moteur).
- **Le niveau d'une piste = son VOL dans le plugin** : c'est deja une cible de scene (morph, programme aux 9 positions, moteur) ; rendre TRK LEV morphable aurait demande une nouvelle sorte de cible dans le morph du site. Un seul niveau par piste, partout (MIXER, LEVEL/DATA, ecran, scenes) ; le TRK LEV d'avant y passe sans changer le son.
- **Les autres patterns : 16 pas** : un emplacement ne garde que sa premiere page (les pages et la longueur suivent le pattern courant, au site aussi) ; le plugin joue ce que le site poserait.
- **Le crossfader de la face ne recompile plus rien** : avant, chaque mouvement recalculait tout le programme (50 ms de retard, des sons recalcules) ; maintenant il envoie sa position, et Ableton peut l'automatiser.

- **Le crossfader dans le cadre des fleches, les LED au-dessus de PAGE** : c'est la place des fleches sur la DT2 (Mika : « a la place des fleches ») ; le logo M, qui y etait, passe au-dessus du crossfader, dans le cadre. La geometrie change seulement dans le plugin (`pluginMode.ts`, sans cycle d'imports) : le site garde sa V.6.0 telle quelle.
- **Les fleches sous l'ecran, pas dedans** : dans l'ecran, elles cacheraient des cases ; la bande du cadre sous l'ecran est vide a gauche (la place du nom de la DT2). Elles font exactement ce que font les fleches du clavier (le meme chemin, `faceKeyTap`).
- **Les fonctions FUNC imprimees, et toujours sur la touche avec FUNC** : la DT2 les imprime ; la touche qui change de mot quand FUNC est engagee reste la confirmation du mode.
- **OPEN : les memes cibles que la face** : chaque potard du panneau est le reglage d'un bloc des pages (anyDial) : la meme loi, les memes scenes, le meme programme vers le moteur ; rien de nouveau a porter en C++. Le reglage fin est Maj + glisser (au dixieme) ; FINE donne le cent.
- **SAMPLES du plugin : pas de suppression** : retirer un fichier du disque depuis la face serait risque ; OPEN FOLDER ouvre le dossier dans le Finder pour ranger et effacer, RESCAN le relit.

- **Le P-LOCK au clic droit, garde** : une souris ne tient pas un pas en tournant un potard ; le clic droit le met en P-LOCK et l'y laisse (comme L au clavier), sans REC. Le clic droit sur une touche reste FUNC + la touche. Sur un pas vide, le verrou pose aussi le coup (la regle de la face).
- **16 pas, une page** : la demande de Mika ; les pages restent au site. Un pattern plus long d'avant se lit sur ses 16 premiers pas, sans perte tant qu'il n'est pas resauve.
- **L'ecran : des dessins plutot que plus de pixels** : la texture de l'ecran fait deja 1600 px pour environ 900 px affiches ; ce qui manquait, c'etait de quoi regarder (l'effet SWING que Mika aime). Chaque reglage a son dessin, et la vraie forme d'onde du sample apparait des la page SRC.
- **La 3D : penchee de 16 deg, pas une orbite** : assez pour voir les flancs et la caisse, sans que les potards du haut se cachent ; la souris garde sa justesse (zones par rayon, l'ecran par screenUV).
- **OPEN : sur les memes reglages que la face** : START et END de l'editeur sont t:sstart et t:slen, ecrits avec les lois du moteur ; rien a porter en C++, et ce qu'on regle dans OPEN se voit sur la face et s'enregistre dans une scene armee.

- **DRAG MIDI : une barre native, pas un bouton de la face** : un glisser de fichier vers Ableton part d'un evenement souris natif (JUCE performExternalDragDropOfFiles, sur macOS) ; depuis la WebView, il n'est pas sur de partir. Un plugin ne peut pas creer un clip lui-meme : le glisser-deposer est la voie (comme les plugins de patterns du commerce). Un clic garde le fichier, au cas ou.
- **Les notes : les 16 pads d'un Drum Rack, GM pour les huit premieres** : un clip exporte joue un kit d'Ableton a sa place (kick, snare, clap, hats, toms, cymbale en GM) et les 16 pistes tiennent les 16 pads visibles ; la meme table en entree : le clip rejoue le MM-RYTM. Ecart : 40, 41, 43, 44, 47, 48 et 51 menaient avant a SD, TOM, CH, HT et CY ; ils menent maintenant a leurs pistes 9 a 16 (SD2, TOM2, CP2, CH2, OH2, HT2, CY2).
- **La velocite : le gain du pas x 127** : c'est ce que l'entree MIDI relit (velocite / 127 = le gain) ; HIGH donne 127, MID 89, LOW 51.
- **PROB et les conditions : une realisation** : un clip MIDI d'un fichier ne porte pas de probabilite ; le cycle exporte est un tirage, le meme a chaque export (la graine du moteur).

- **Une release reservee plutot que la PR vers main** : la PR protegerait les branches futures, pas les copies deja ecrites du workflow (le MM-ARP a ecrase mm-rytm-latest deux fois dans la nuit). mm-rytm n'est ecrite que par ce workflow ; c'est la meme publication que celle que Mika a acceptee (« vas-y pour la release »), a une autre adresse.
- **NEW et CLEAR dans la barre native, avec une confirmation** : ce sont des gestes qui effacent ; la barre est toujours visible, la boite evite un clic de trop, et Cmd+Z reste la (une etape d'UNDO).

- **Un stockage par instance plutot qu'un prefixe par instance** : un prefixe demanderait de changer chaque store du site ; remplacer `window.localStorage` avant le premier module ne touche a rien d'autre, et le projet Ableton reste la seule memoire de l'etat d'une instance (ce qu'il etait deja). La bibliotheque (presets, personnalisation) reste commune, comme au site.

- **Les touches claires sur la machine noire, par l'apparence claire du site** : la machine claire du site sait deja peindre des touches gris blanc (teintes, matieres, encre, lueurs, temoins) ; le plugin les prend sans le chassis, la lumiere ni l'exposition de la creme. Le site garde ses deux apparences telles quelles.
- **PLAY au jaune orange, pas au vert** : Mika veut deux couleurs (le rouge, le jaune orange) ; le vert de la DT2 reste au site.
- **Le mini ecran en noir et blanc** : le meme langage que l'ecran principal (Mika aime ses graphismes noir et blanc) ; le rouge seulement pour le 0 dB.
- **Les VU apres les effets de tranche, a MAIN VOLUME** : ce qu'on entend de chaque piste, a l'echelle de la sortie ; le bus (DIST, TONE globaux) et les retours ne sont pas dans les pistes, ils sont dans L et R.
- **DRAG MIDI depuis la face** : Mika ne veut plus de barre ; une barre native ne peut pas se poser sur la WebView (elle passe dessous). Le glisser part donc de la face, comme sur le MM-ARP ; si le Mac refuse, le message le dit et SAVE .MID (ou un clic sur la poignee) garde le fichier, a glisser depuis le Finder.

- **Lot 12 : les VU dans OPEN plutot que supprimes** : Mika ne veut plus du mini ecran sur la face, mais il a choisi les VU-metres et veut ce genre d'information dans OPEN ; le moteur les envoie deja.

- **LEV = le VOL de la piste plutot que le niveau du sample rendu « assignable »** : sur une piste de samples seuls, les deux font le meme gain ; le VOL est deja mene en temps reel par le crossfader (la tranche, lot 1) et verrouillable par pas, alors que le niveau du sample demande de recalculer le son. Un seul niveau par piste, partout (la decision du lot 5). Limites : un P-LOCK d'avant sur le niveau du sample (slev) reste dans le pattern et s'entend encore, sans bloc pour le montrer (CLEAR en P-LOCK l'enleve) ; une scene d'avant qui tenait deja le VOL d'une piste dont le sample etait baisse ne compte plus cette baisse a sa position.

- **Lot 14 : un lanceur de glisser a soi plutot que retirer DRAG MIDI** : la demande de Mika (le clip en un geste) reste ; le chemin de JUCE n'est pas fait pour etre appele hors d'un evenement souris de JUCE. Le lanceur verifie tout ce qu'AppKit exige et attrape ses exceptions : au pire le glisser ne part pas et le dit. Tant que le rapport de plantage n'a pas confirme la cause, c'est le suspect, pas une certitude.
- **START et END a gauche du grand sample, et a la souris** : Mika voit S et E et veut les bouger la ou il les voit ; les potards A et E sont en face de leurs blocs. FINE rejoint TUNE sur la premiere page (la case de MACH, vide dans le plugin).

- **Lot 15 : le vrai capot plutot qu'un decor** : Mika parle du PCB du site (« au lieu du PCB vert ») ; la carte 3D, ses composants et sa lumiere existent, il suffisait de les repeindre et de degager la place de l'ecran. L'editeur reste en HTML (potards, forme d'onde, glisser), pose sur la carte par projection : la vue de dessus en fait un rectangle exact.
- **L'ecran sur la moitie basse, les composants autour** : la carte du site a ses composants en haut et a droite ; les garder la (« quelques composants ca et la ») laisse 866 x 448 px a l'ecran a la taille de depart, assez pour tout l'editeur sur une rangee de reglages.
- **La touche des presets : la liste a la tape, SAVE au clic droit** : la demande se lit de deux facons (ouvrir les presets, ou garder un preset) ; les deux sont sur la touche. La premiere touche (la liste, « Perform ») ouvre encore les presets elle aussi : a trancher avec Mika.
- **TRK 8 s plutot que sans fin** : gardee sans fin, TRK prend le premier potard tourne (CONTROL ALL sur les 16 pistes) ; 8 s laissent le temps d'aller au pas a la souris.

- **Lot 16 : l'ecran presque partout, les composants autour** : Mika veut « vraiment plus de place » mais a aime la carte et ses composants ; ils sont replaces en bande et sur les bords plutot que supprimes.
- **Le capot et CLOSE, les deux** : Mika propose l'un ou l'autre ; le bord du capot dit d'ou vient la vue et se clique, le bouton rouge reste la ou l'oeil le cherche.
- **Des potards dessines en relief, pas des potards 3D dans la scene** : ils gardent les gestes de l'editeur (Maj pour le fin, double clic, le clavier) et suivent l'ecran HTML ; leur dessin reprend celui des potards de la face vus de dessus.
- **PERFORM = les effets de toute la machine et le crossfader** : c'est ce qu'on tourne en jouant, et ce que les scenes menent ; l'ancienne page (armer A / B, compter les cles) faisait doublon avec les touches A et B de la face.
- **LIVE REC : les reglages de piste, pas ceux de la machine** : les P-LOCK sont compiles par la face en coups que le moteur joue, donc tout reglage de piste s'enregistre sans toucher au moteur. Les effets globaux par pas demanderaient un nouveau chemin dans le moteur C++ (des valeurs globales par pas), que je ne peux pas ecouter d'ici : a faire dans un lot a part si Mika le veut. D'ici la, une scene et le crossfader (automatisable dans Ableton) les couvrent.
- **Une frappe en LIVE REC va au pas qui joue, pas au plus proche** : sans l'heure exacte du moteur cote face, arrondir au pas suivant ferait rejouer le coup par le moteur.
- **Des presets d'usine propres au plugin** : ceux du site reposent sur la synthese, que le plugin n'a pas. Douze styles (ceux de Mika d'abord), trois variations qui gardent le kit du style et changent le kick, la caisse et le clap pour un cousin. Les samples sont choisis par mesure (duree, decroissance, centre spectral, fondamentale, RMS), pas a l'oreille : a valider par Mika.
- **Le nom jusqu'a 16 lettres dans le plugin** : sans USER/ devant, la place est la, et « INDIE DANCE 2 » ne tient pas en 10.

- **Lot 17 : mesurer la photo avant de dessiner** : le premier essai venait d'une lecture a l'oeil de la vignette (198 px) ; le second part de la photo agrandie huit fois et de ses rayons mesures. A refaire pour toute reference visuelle.
- **Le dessus du capuchon et la base ne tournent pas** : sur un metal brosse le reflet reste face a la lumiere, et la base est eclairee d'en haut a gauche ; seuls la prise et son repere tournent. Les anneaux de valeur restent a la place des graduations 0 a 10 de la photo : ils disent la valeur, la bande des scenes et la teinte de la page.
- **Le chrome fonce peint par sommet, pas une matiere metallique** : sans carte d'environnement un metal de three sort noir ; le reflet est dessine sur des faces a plat (la lumiere de la scene les multiplie toutes pareil), il est donc le meme sur toutes les machines et dans le rendu logiciel des tests.

- **Lot 18 : une image plutot que des couleurs de sommets pour le metal** : une image se filtre proprement a toute taille de fenetre, porte de vraies stries, et n'a pas de couture ; les gris voulus a l'ecran passent par la courbe mesuree du rendu (36.7 x f^0.394).
- **Les anneaux de valeur gardes** : la photo a des graduations 0 a 10 autour du potard ; ici les anneaux de segments tiennent cette place (la valeur, la bande des scenes, la teinte de la page). A changer si Mika veut les graduations.

## 3. Ce qui reste a faire / points en suspens

- **Cote Mika (lot 18)** : dire si les potards chrome sont ceux de la photo ; s'il veut aussi les graduations 0 a 10 autour, a la place ou en plus des anneaux de segments.
- **Cote Mika (lot 16)** : la commande mm-rytm, quitter et rouvrir Ableton. A l'oreille : les 36 presets (les samples sont choisis par mesure : dire lesquels remplacer, quels niveaux bouger) ; LIVE REC (double clic sur REC pendant la lecture, tourner CUTOFF ou TUNE, reecouter) ; PERFORM avec une scene et le crossfader. A l'oeil : la taille de l'ecran d'OPEN, le bord du capot, les potards en relief ; le champ du nom dans l'ecran (le clavier d'Ableton y ecrit-il bien ?).
- LIVE REC, la suite possible : les effets de toute la machine par pas (un chemin a ajouter dans le moteur C++), une frappe au pas le plus proche (il faut l'heure du moteur cote face), un geste pour effacer une automation seule (aujourd'hui : NO tenue + la touche de pas pendant la lecture, ou CLEAR).
- `Ch 14.wav` et `Ch 16.wav` de la banque sont vides, plusieurs kicks sont en double (Bd 11 = 27, 16 = 28, 24 = 29...) : a nettoyer un jour.

- Cote Mika : `update.sh` quand le build est vert ; dans Ableton, mapper le parametre **Crossfader** a l'APC mini ou au Roto, et l'automatiser.
- A l'oreille : un geste rapide du crossfader sur DIST ou CHORUS de piste (les reglages changent par bloc de 512 echantillons au plus).
- A l'oreille et dans Ableton : un clip par pattern (case Pgm), en session et en arrangement.
- A l'oreille : TLEN sur des hats (12) et une perc (7) ; les samples de chaque type.
- Cote Mika : mettre ses samples dans `~/Music/MM-RYTM Samples/<type>/` ou + LOAD A FILE... ; dire si le choix de fichiers s'ouvre bien dans Ableton.
- Plus tard si Mika le veut : la vitesse par piste (DT2 PER TRACK SPEED) ; LOOP des samples ; glisser un fichier sur la face ; la banque synthetisee du site dans le plugin ; le multi-out.
- Ses retours sur la face apres usage (placements, gestes).
- Cote Mika (lot 15) : la commande mm-rytm ; dire si la carte noire et l'ecran lui vont (taille de l'ecran, composants) ; la touche des presets (liste / clic droit Save Preset) et quoi faire de la premiere touche, qui ouvre aussi les presets ; TRK ; les legendes.
- **Cote Mika (lot 14), important** : le rapport du plantage de Live (bouton Report... de la fenetre, ou Console > Rapports de plantage > Live : les 60 premieres lignes, jusqu'a « Thread 0 Crashed » et ce qui suit) ; dire ce qu'il faisait au moment du plantage (DRAG MIDI dans OPEN ? changer de pattern ?). Puis la commande mm-rytm ; DRAG MIDI depuis OPEN ; SRC SAMPLE (A, E, la souris).
- Cote Mika (lot 13) : la commande mm-rytm ; la vue de dessus ; page SRC, Scene B, tourner LEV, relacher Scene B, bouger le crossfader (le niveau de la piste suit, a l'oreille et dans OPEN LEVELS).
- Cote Mika (lot 12) : la commande mm-rytm ; dire si les touches a 0.8 sont assez plates (0.6 plus plat, 1 comme le site) ; les niveaux dans OPEN pendant la lecture ; DRAG MIDI depuis OPEN.
- Cote Mika (lot 11) : la commande mm-rytm, rouvrir Ableton ; dire si le gris blanc, le rouge et le jaune orange lui vont ; le mini ecran pendant la lecture (les VU bougent avec le son) ; tirer le coin de la fenetre ; OPEN en blanc ; **DRAG MIDI depuis OPEN** : glisser la poignee jaune sur une piste MIDI (si le glisser ne part pas, le message le dit et SAVE .MID garde le fichier).
- Cote Mika (lot 10) : la commande mm-rytm, quitter Ableton, le rouvrir, recharger le projet qui partait dans tous les sens ; si une erreur reste, une capture de l'ecran (le message rouge MM-RYTM ou la fenetre d'Ableton).
- Branche du MM-ARP : sa face appelle le meme `restore.ts` ; tant qu'elle n'a pas ce correctif, son build efface encore les cles du vrai stockage a son chargement (sans toucher aux instances du MM-RYTM, qui n'y lisent plus que la bibliotheque).
- Cote Mika (lot 9) : la nouvelle commande (release mm-rytm), quitter Ableton, le rouvrir ; verifier la ligne Build ; essayer NEW et CLEAR.
- Cote Mika (lot 8) : `update.sh`, puis glisser DRAG MIDI sur une piste MIDI (avec un Drum Rack, ou la piste du MM-RYTM en coupant son pattern) ; dire si la fenetre plus haute de 34 px lui va.
- **La release et main** : tant que main n'a pas ce workflow, un push sur main ou sur une autre branche peut remettre un MM-RYTM ancien dans `mm-rytm-latest` ; `update.sh` affiche le build (commit, branche) : il doit dire claude/intelligent-ride-56tyeo. Le remede : fusionner cette branche dans main (une PR, a la demande de Mika).
- Cote Mika (lot 7) : `update.sh`, puis : le P-LOCK au clic droit, l'ecran (SRC 2/2, FX 2/2, TRIG 2/2, TEMPO), la vue 3D penchee (dire si 16 deg est juste), l'editeur de sample d'OPEN (LISTEN joue la piste par le plugin).
- Cote Mika (lot 6) : `update.sh`, puis dire si la face facon DT2 lui va (icones, fonctions imprimees, crossfader a la place des fleches), si OPEN contient ce qu'il attend, et si OPEN FOLDER ouvre bien le Finder depuis Ableton.

## 4. Commandes utiles ajoutees

Aucune nouvelle commande ; la mise a jour du plugin (release mm-rytm depuis le lot 9) :

```bash
curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-rytm/update.sh | bash
```
