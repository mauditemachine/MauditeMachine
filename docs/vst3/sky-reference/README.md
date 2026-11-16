# Reverb facon BigSky : moteur de reference pour le VST MM-ARP

2026-11-16. Mika : « quand on clic sur le knob Reverb on tombe sur une page de configuration pour la reverb avec tous les
parametres AINSI QUE la qualite de Strymon BigSky mais au design de MM-ARP » (pour le VST, `plugin/mm-arp`).

Ces fichiers ne sont branches nulle part : ils ont ete ecrits pour le site puis abandonnes (Mika voulait le VST). Ils
servent de reference a porter en C++ dans `plugin/mm-arp/dsp` (session « ARP VST3 », branche `claude/nifty-bohr-7ixmpf`).

- `sky.worklet.js` : le moteur (AudioWorklet `mm-sky`) : 12 machines (ROOM, HALL, PLATE, SPRING, SWELL, BLOOM, CLOUD,
  CHORALE, SHIMMER, MAGNETO, NONLINEAR, REFLECTIONS), FDN 8 lignes, Tr60 exact, sources images, etc.
- `sky.ts` : le modele (machines, reglages nommes comme dans le manuel du BigSky, defauts, lois, `SKY_GAIN`, `skyEngine`).
- `sky-test.mjs` : le banc Node (sans son). Il attendait `src/v4/audio/sky.worklet.js` et `src/v4/voyager/sky.ts` :
  adapter les chemins avant de le lancer.

Mesures du banc : Tr60 a 2-6 % du DECAY demande, 12/12 machines bornees tout au max, energie ~1 par canal au reglage de
depart (celle de l'ancienne IR_DEFAULT), 2 a 8 % du temps reel par machine en JS.

Le BigSky.vst3 de Mika n'a pas ete lu (il est sur son Mac) : la liste des machines et des parametres vient du manuel
officiel (manualslib.com/manual/963033), les algorithmes sont ecrits ici.
