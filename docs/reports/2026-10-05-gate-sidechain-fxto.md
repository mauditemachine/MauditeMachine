# 2026-10-05 : GATE du snare et du clap, SIDECHAIN du MM-ARP, FX TO au mixer, MUTE, voies 1 et 2, vignettes, logotype vectoriel

Mika, avec son Logotype.svg :
« Trop de gate reverb sur le snare et le clap, je veux pouvoir l'activer ou
pas dans OPEN. MUTE : on clique sur une voix, ensuite sur MUTE, ça mute la
voix, mais quand on reclique sur une autre voix ça ne la mute pas. Un knob
SIDECHAIN automatique dans MM-ARP OPEN, qui s'adapte parfaitement au kick et
à sa longueur dans MM-RYTM. Quand on joue sur les machines et qu'on arrive
sur le mixer, on ne voit pas les pistes jouer sur 1 et 2. MIXER : assigner
avec un knob les FX vers une piste, ou toutes. J'ai ouvert puis fermé une
machine, la colonne de gauche l'affiche encore ouverte. »

## 1. Ce qui a été fait

- Vignettes du volet MACHINES (ui/MachineDrawer.tsx) : refaites quand un capot a changé, à son état posé.
- MUTE du MM-RYTM (actions.ts, ui/KnobPanel.tsx) :
  - une voix touchée juste avant MUTE (1,5 s) se coupe avec lui, le mode reste allumé pour les suivantes ;
  - MUTE puis une voix marche toujours ;
  - MUTE et SOLO ne sont plus allumés ensemble (SOLO prenait les voix tapées après MUTE) ;
  - au téléphone, la rangée VOICES des KNOBS choisit la voix sans la couper.
- Voies 1 et 2 du MM-DECKS (dj/actions.ts djWake, dj/rig.ts) : le moteur de la table se crée dès qu'elle est en vue et que le son existe ; le MM-RYTM et le MM-ARP passent par 1 et 2, leurs VU bougent.
- Logotype vectoriel (public/logo/mauditemachine-logotype.svg) :
  - dans l'en-tête (v4.css) ;
  - sur les plaques des quatre machines (theme.ts) ;
  - l'ancien PNG recadré retiré.
- GATE sous le capot du MM-RYTM :
  - audio/kit.ts, audio/shotsdsp.ts : un commutateur OFF / ON, OFF par défaut ; OFF, la caisse claire MM sans sa réverbe à porte, les claps MM et 909 sans leur pièce ;
  - scene/rytmTweaks.ts, scene/tweakplate.ts : la plaque en sept colonnes (desktop) avec GATE entre CLAP et HATS, le titre en tête au téléphone ;
  - jumeaux, KNOBS du téléphone.
- SIDECHAIN du MM-ARP :
  - audio/duck.ts (nouveau) : la courbe de chaque kick, lue dans son échantillon ;
  - audio/drums.ts : chaque kick programmé baisse la prise du MM-ARP (sec, delay, réverbe) ;
  - audio/synth.ts : le potard règle la profondeur ;
  - voyager/params.ts : le potard SIDECHAIN, de OFF à -24 dB ;
  - voyager/theme.ts, voyager/tweaks.ts : la plaque TWEAKS en cinq colonnes ;
  - KNOBS du téléphone, onglet TWEAKS.
- FX TO au mixer :
  - dj/state.ts, dj/engine.ts : chaque voie va aux effets ou tout droit au master ;
  - dj/actions.ts, dj/layout.ts, dj/theme.ts : un huitième potard au bout de la rangée des effets ;
  - dj/gestures.ts, dj/rig.ts, dj/silk.ts : ses gestes, l'écran (FX TO 2 ARP), le numéro de la voie visée en orange ;
  - dj/Twins.tsx, dj/MixDock.tsx : jumeau, onglet FX du téléphone.
- docs/v4/spec.md : R14-118 à R14-124.

## 2. Décisions prises et pourquoi

- MUTE : impossible de reproduire un MUTE qui ne prend qu'une voix (souris, doigt, capot ouvert, séquence en route : chaque voix tapée en mode se coupe). Mika décrit l'ordre « une voix, puis MUTE » : il marche maintenant, sans casser « MUTE, puis des voix ». La fenêtre de 1,5 s évite le piège du SOLO d'avant (une voix touchée longtemps avant ne se coupe pas). Le seul vrai bogue trouvé : MUTE allumé par-dessus SOLO, les voix partaient en solo.
- GATE OFF par défaut : Mika trouvait la réverbe de trop. ON redonne exactement le son d'avant (même quantité). Un seul commutateur pour le snare et le clap, comme il l'a demandé.
- SIDECHAIN sans détecteur : le MM-RYTM sait quand chaque kick part et quel échantillon il joue. La baisse suit le niveau mesuré du kick (son, TUNE, DECAY, STRETCH, vélocité, VOLUME), part 2 ms avant le coup et finit quand le kick est 12 dB sous sa crête. À -30 dB (premier essai), le MM-ARP restait baissé d'un kick à l'autre.
- Le SIDECHAIN agit sur la prise du MM-ARP, après ses effets : la réverbe et le delay pompent aussi, l'oscilloscope (ARP, KICK+ARP) et la voie 2 le montrent.
- FX TO : un sélecteur à crans dans la rangée des effets, plutôt qu'un bouton à part. Les queues de delay et de réverbe finissent de sonner quand on change de voie. Une voie retirée (REMOVE DECK) renvoie les effets sur toutes.
- Voies 1 et 2 : le moteur de la table se crée dès qu'elle est en vue, sans attendre un geste sur elle. Les machines passent alors par la table (son inchangé : faders 1 et 2 en haut, EQ à plat).

## 3. Ce qui reste à faire / points en suspens

- Mika, à l'écoute (rien n'a été écouté ici, son coupé) :
  - GATE ON / OFF sur le snare et le clap ;
  - SIDECHAIN de 3 à 10, avec le 909, le 808 et le MM, et différents DECAY ;
  - FX TO sur une voie pendant un DELAY ou une REVERB.
- Si le SIDECHAIN est trop long ou trop court à son goût : la fin du corps du kick (12 dB) et la forme du retour (1.5) sont dans audio/duck.ts (DUCK).
- MUTE : si le problème revient, noter où il clique (pad 3D, Dock, clavier) et si SOLO était allumé.
- Toujours en suspens : les secrets SoundCloud du worker Sonaa, le défilement de la playlist au doigt sur iPhone, l'équilibre RYTM / ARP, la voie du MM-SMPL au mixer.

## 4. Commandes utiles ajoutées

- Aucune commande npm.
- Debug : `__v4.audio.duck()` donne :
  - la profondeur du SIDECHAIN ;
  - les kicks suivis ;
  - le gain de la prise du MM-ARP à l'instant.
- Clés retenues :
  - `mm.v4.kit.1` gagne `gate` ;
  - `mm.v4.voyager.1` gagne `duck` ;
  - `mm.v4.dj.2` gagne `fxTo`.
