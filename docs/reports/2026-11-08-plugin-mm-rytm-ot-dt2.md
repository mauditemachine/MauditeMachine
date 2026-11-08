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

## 2. Decisions prises et pourquoi

- **9 positions plutot que les deux bouts** : les lois du site ne sont pas lineaires (LEVEL au carre, coupure exponentielle, crans des potards, hauteur sur sa grille) ; 9 positions calculees par le site lui-meme, puis une interpolation (en logarithme pour les grandeurs exponentielles) restent au plus pres du site sans recopier ses lois en C++.
- **Le son et la hauteur : la position la plus proche** : un son se calcule hors du thread audio ; 9 hauteurs par coup mene par une scene, c'est le « calcul le plus proche » du site (lazy).
- **La REVERB change de forme quand x se pose** : une nouvelle reponse remet le convolueur a zero ; la changer a chaque bloc d'un geste couperait la queue en continu.
- **Le moteur decide du pattern joue** (comme du transport) : c'est le seul a connaitre la fin du pattern a l'echantillon pres, et il doit jouer fenetre fermee. La face lui dit ce qu'elle veut (le suivant, la chaine) et suit ce qu'il joue.
- **Program change plutot que des notes** : c'est ce qu'une Elektron recoit, et Ableton l'envoie de chaque clip (case Pgm) ; le changement tombe a la fin du pattern, comme une Digitakt.
- **Pistes typees : une regle dans le store** plutot que des interdits dans chaque menu : un preset, SOUNDS ou MACHINE qui poserait une synthese ou un autre type est ramene a la regle au meme endroit. Les pistes 9 a 16 reprennent les 8 types (deux BD, deux SD...) : 8 dossiers de samples, 16 pistes.
- **TLEN sans repartir avec le pattern** : une piste de 7 pas qui repartirait tous les 16 pas ferait 7 + 7 + 2 ; la polymetrie voulue (minimale hypnotique) demande qu'elle tourne en continu. Le pattern garde sa longueur pour changer de pattern.
- **TLEN hors des verrous** : la liste des verrous (et la liste du MIDI) est construite sur l'ordre des reglages de trig, et cet ordre entre dans les liens SHARE ; y glisser TLEN aurait decale les LFO.
- **Les autres patterns : 16 pas** : un emplacement ne garde que sa premiere page (les pages et la longueur suivent le pattern courant, au site aussi) ; le plugin joue ce que le site poserait.
- **Le crossfader de la face ne recompile plus rien** : avant, chaque mouvement recalculait tout le programme (50 ms de retard, des sons recalcules) ; maintenant il envoie sa position, et Ableton peut l'automatiser.

## 3. Ce qui reste a faire / points en suspens

- Cote Mika : `update.sh` quand le build est vert ; dans Ableton, mapper le parametre **Crossfader** a l'APC mini ou au Roto, et l'automatiser.
- A l'oreille : un geste rapide du crossfader sur DIST ou CHORUS de piste (les reglages changent par bloc de 512 echantillons au plus).
- A l'oreille et dans Ableton : un clip par pattern (case Pgm), en session et en arrangement.
- A l'oreille : TLEN sur des hats (12) et une perc (7) ; les samples de chaque type.
- Plus tard si Mika le veut : la vitesse par piste (DT2 PER TRACK SPEED) ; LOOP des samples ; ses propres samples (glisser un fichier dans le plugin) ; le multi-out.
- Ses retours sur la face apres usage (placements, gestes).

## 4. Commandes utiles ajoutees

Aucune nouvelle commande ; la mise a jour du plugin reste :

```bash
curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-rytm-latest/update.sh | bash
```
