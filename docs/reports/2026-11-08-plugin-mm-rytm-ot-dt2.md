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

## 3. Ce qui reste a faire / points en suspens

- Cote Mika : `update.sh` quand le build est vert ; dans Ableton, mapper le parametre **Crossfader** a l'APC mini ou au Roto, et l'automatiser.
- A l'oreille : un geste rapide du crossfader sur DIST ou CHORUS de piste (les reglages changent par bloc de 512 echantillons au plus).
- A l'oreille et dans Ableton : un clip par pattern (case Pgm), en session et en arrangement.
- A l'oreille : TLEN sur des hats (12) et une perc (7) ; les samples de chaque type.
- Cote Mika : mettre ses samples dans `~/Music/MM-RYTM Samples/<type>/` ou + LOAD A FILE... ; dire si le choix de fichiers s'ouvre bien dans Ableton.
- Plus tard si Mika le veut : la vitesse par piste (DT2 PER TRACK SPEED) ; LOOP des samples ; glisser un fichier sur la face ; la banque synthetisee du site dans le plugin ; le multi-out.
- Ses retours sur la face apres usage (placements, gestes).
- Cote Mika (lot 6) : `update.sh`, puis dire si la face facon DT2 lui va (icones, fonctions imprimees, crossfader a la place des fleches), si OPEN contient ce qu'il attend, et si OPEN FOLDER ouvre bien le Finder depuis Ableton.

## 4. Commandes utiles ajoutees

Aucune nouvelle commande ; la mise a jour du plugin reste :

```bash
curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-rytm-latest/update.sh | bash
```
