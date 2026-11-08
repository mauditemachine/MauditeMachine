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

## 2. Decisions prises et pourquoi

- **9 positions plutot que les deux bouts** : les lois du site ne sont pas lineaires (LEVEL au carre, coupure exponentielle, crans des potards, hauteur sur sa grille) ; 9 positions calculees par le site lui-meme, puis une interpolation (en logarithme pour les grandeurs exponentielles) restent au plus pres du site sans recopier ses lois en C++.
- **Le son et la hauteur : la position la plus proche** : un son se calcule hors du thread audio ; 9 hauteurs par coup mene par une scene, c'est le « calcul le plus proche » du site (lazy).
- **La REVERB change de forme quand x se pose** : une nouvelle reponse remet le convolueur a zero ; la changer a chaque bloc d'un geste couperait la queue en continu.
- **Le crossfader de la face ne recompile plus rien** : avant, chaque mouvement recalculait tout le programme (50 ms de retard, des sons recalcules) ; maintenant il envoie sa position, et Ableton peut l'automatiser.

## 3. Ce qui reste a faire / points en suspens

- Cote Mika : `update.sh` quand le build est vert ; dans Ableton, mapper le parametre **Crossfader** a l'APC mini ou au Roto, et l'automatiser.
- A l'oreille : un geste rapide du crossfader sur DIST ou CHORUS de piste (les reglages changent par bloc de 512 echantillons au plus).
- Lot 2 et lot 3 (plan ci-dessus).

## 4. Commandes utiles ajoutees

Aucune nouvelle commande ; la mise a jour du plugin reste :

```bash
curl -fsSL https://github.com/mauditemachine/MauditeMachine/releases/download/mm-rytm-latest/update.sh | bash
```
