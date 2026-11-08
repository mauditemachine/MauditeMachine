# 2026-11-08 - MM-RYTM VST3 phase 3 : les effets du site en C++, le site en V.3.0

## 1. Ce qui a ete fait

- `src/v4/theme/base.ts`, `src/v4/firmware.ts`, `src/v4/ui/HoodClose.tsx` : le site s'ouvre sur la V.3.0, la machine d'avant le crossfader. Les autres versions sont au selecteur (?face=v4, v5, v6 ou dt2). Le plugin reste en V.6.0.
- `plugin/mm-rytm/dsp/Fx.{h,cpp}` (nouveau) : le graphe du site apres la voix :
  - la tranche de chaque piste : TONE, DIST et CHORUS (port du worklet, table sinc fenetree de Kaiser), puis les envois DELAY (x 1.2) et REVERB (x 1.0) ;
  - le bus des pads : DIST, TONE et CHORUS globaux, et les envois globaux ;
  - le bus du kick : DIST et TONE, sans chorus ni envoi ;
  - LEVEL au carre sur le bus et sur les prises des envois ;
  - le DELAY : boucle LP dtone et HP 180 Hz, temps en double-croches du tempo ;
  - la REVERB : la reponse de `fx.ts makeImpulse`, identique bit a bit (verifie contre le site sous Node, 48 et 44,1 kHz), en convolution FFT par blocs de 256 ;
  - le master : GLUE (BIT, COMP, AUTO), garniture 0.84, LIMITEUR (-0.3 dBFS, 3 ms d'avance, 120 ms de relachement).
- `plugin/mm-rytm/dsp/Engine.{h,cpp}` :
  - les voix ecrivent dans la tranche de leur piste, puis la chaine d'effets les mixe ;
  - le bloc est traite par morceaux de 512 echantillons ;
  - le filtre FLTR de chaque coup ;
  - la tranche suit les verrous de pas (TONE, DIST, CHORUS, DELAY, REVERB) jusqu'au coup suivant de la voix.
- `plugin/mm-rytm/dsp/Program.h`, `src/PluginProcessor.{h,cpp}` : les effets globaux et la tranche dans le programme. La reponse de la reverb est calculee hors du thread audio, seulement quand sa forme change.
- `src/v4/audio/drums.ts` : `resolveHit` rend aussi la voix et ses verrous.
- `src/v4/plugin/bridge.ts` : le programme porte les effets globaux (`morph.fx()` : les scenes comprises, TONE et LEVEL du mix), la tranche de chaque voix, la voie du kick et les verrous de tranche. Il suit le mix.
- `plugin/mm-rytm/tests/engine_test.cpp` : 26 tests :
  - FLTR ;
  - le niveau du site ;
  - la reverb (et pas sur la voie du kick) ;
  - l'echo du delay ;
  - DIST et chorus stereo ;
  - le plafond du limiteur.

## 2. Decisions prises et pourquoi

- **Le site en V.3.0.** D'abord V.1.0, puis V.4, ce qui ne respectait pas les versions. Le selecteur rend la V.4 avec la rangee de touches facon Digitakt, ajoutee plus tard dans le code. Mika : "met la version avant le crossfad qui etait trop complexe".
- **Le graphe suit le rapport d'exploration de `audio/drums.ts`** (build, mkCh, voice) et les lois de `pattern.ts` / `fx.ts` / `sends.ts`, valeurs de depart comprises (les constantes d'avant gardees).
- **La reverb en convolution par blocs** : le ConvolverNode n'a pas de latence, le plugin en a 256 echantillons (5 ms a 48 kHz) sur le seul retour de reverb. Le son sec n'en a aucune. La convolution directe d'une reponse de 2,4 s serait trop lourde.
- **Le limiteur ajoute 3 ms de retard au master**, comme sur le site. Le plugin ne le declare pas encore comme latence a Ableton (a faire si le calage le demande).
- **Ce qui n'est pas porte, et pourquoi** :
  - le fondu de 60 ms quand la reponse de reverb change (ici une coupe) ;
  - les rampes de 3 ms des verrous de tranche (ici, au debut du bloc de 512 echantillons au plus) ;
  - les envois du chorus et de la reverb qui suivent les LFO ;
  - les LFO eux-memes, qui touchent la hauteur, la coupure, la resonance, le volume, le pan et les effets.
- **Verifications faites sans lecture audio** :
  - les 26 tests du moteur dans ses buffers ;
  - la reponse de reverb identique au site ;
  - les sons identiques au site (29/29) ;
  - l'analyse gcc et clang des sources ;
  - le programme lu dans Chromium ;
  - le nombre d'erreurs TypeScript du depot n'a pas bouge (105).

## 3. Ce qui reste a faire / points en suspens

- Verifier le run du workflow (phase 3).
- **Mika** : installer le nouveau VST3 et ecouter les effets (DIST, CHORUS, DELAY, REVERB, COMP, BIT), le niveau general, et la voie du kick sans reverb globale. Le plugin sonne maintenant au niveau du site : LEVEL 0.8 au carre et la garniture 0.84, donc environ 5,4 dB plus bas qu'avant.
- **Phase 3 bis** : les LFO (deux par voix, ondes, vitesse au tempo, FADE, les destinations au coup et pendant le coup).
- **Phase 4** :
  - les chaines de patterns, LST, SONG ;
  - le multi-out ;
  - l'automation Ableton des potards ;
  - la latence du limiteur declaree a l'hote.

## 4. Commandes utiles ajoutees

- Aucune nouvelle commande.
- Pour comparer la reponse de la reverb au site : `node --experimental-transform-types` sur une copie de `src/v4/audio/fx.ts` (`makeImpulse` avec un faux contexte), puis `mm::ReverbIR::impulse`. Ecart nul.
