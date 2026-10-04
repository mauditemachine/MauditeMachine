# 2026-10-04 : kick 909 et TWEAKS du MM-RYTM, OVERDRIVE, oscilloscope, vue verrouillée en lecture, icône iPhone, potards en gros au téléphone

Mika, avec une capture du MM-ARP et une d'occularScope sur sa piste de kick :
« Le kick sonne flat.. met un kick de 909 s'il te plait et tweakable comme il
faut dans le OPEN de la machine ; sous le capot, à la place des liens, un
système de Tweaks, genre changement de samples pour les voices. Pour ARP ce
n'est pas DIST qu'on veut, c'est OVERDRIVE. Toutes les machines doivent
fonctionner correctement sur mobile, tous les boutons, beau, accessible, pas
tout petit. Proposer mauditemachine.com en icône sur iPhone par défaut. Dans
OPEN, un oscilloscope ultra précis pour voir si la phase bouge. Quand play
est lancé, la vue est verrouillée sur la vue la plus adaptée, sauf à cliquer
en dehors de la machine. »

## 1. Ce qui a été fait

- MM-ARP, OVERDRIVE (moog.worklet.js, voyager/params.ts) : DIST devient OVERDRIVE, montée comme une Tube Screamer. Le signal propre passe entier, et seule une copie sans les graves est saturée en douceur puis adoucie.
- MM-RYTM, kit et kick 909 :
  - audio/kit.ts (nouveau) : le kit retenu. Un son par famille (KICK, SNARE, HATS, CLAP, TOMS, RIM) parmi 909, 808 et MM, plus TUNE, ATTACK, DECAY, DRIVE et SNAPPY ;
  - audio/shotsdsp.ts : les sons 909 et 808 sont synthétisés (aucun sample d'une autre machine), le kick et la caisse MM prennent les mêmes réglages ;
  - audio/shots.ts, shots.worker.ts : la signature du kit entre dans la clé de chaque échantillon, et les sons se recalculent en fond quand on tourne un réglage ;
  - scene/tweakplate.ts (nouveau) : la plaque des TWEAKS devenue commune. voyager/tweaks.ts s'appuie dessus (la plaque du MM-ARP rend au pixel près comme avant) ;
  - scene/rytmTweaks.ts (nouveau) : la plaque du RYTM à la place des puces de pages (Pcb chips: false), 2 × 6 sur desktop et 4 × 3 au téléphone ;
  - scene/pcb.ts : une zone dégagée sous la plaque (les composants la traversaient) ; une liste de pièces vide ne plante plus ;
  - scene/hit.ts, actions.ts, ui/Hotspots.tsx : les cibles rk-<id>, le glisser, la molette, la tape et les jumeaux accessibles ;
  - state/presets.ts : les presets du RYTM gardent le kit ;
  - ui/Header.tsx : GOODIES, MERCH et STUDIO ouvrent leur page directement.
- Oscilloscope :
  - audio/scope.worklet.js et audio/scope.ts (nouveaux) : la prise de son à l'échantillon près, un tampon de 11 s, les sources, la grille des temps ;
  - ui/Scope.tsx (nouveau) : l'écran, monté capot ouvert ;
  - audio/drums.ts : scopeTaps, et routeMachines ne débranche plus que l'ancienne destination ;
  - voyager/arp.ts : arp.grid, la grille de l'arpège qui joue seul.
- Vue verrouillée : state/playLock.ts (nouveau), scene/orbit.ts (lock), scene/renderer.ts (une machine qui démarre passe devant).
- Icône sur l'écran d'accueil, travail de l'agent délégué puis intégré et relu : state/install.ts, ui/InstallPrompt.tsx, index.html, manifest.json, main.tsx.
- Téléphone : ui/KnobPanel.tsx (nouveau), une page KNOBS dans ui/Dock.tsx et ui/VoyDock.tsx, et actions.ts (dialRange, dialSteps, dialReadout, dialValueText, subscribeDials).
- docs/v4/spec.md : R14-97 à R14-102.

## 2. Décisions prises et pourquoi

- Le 909 est synthétisé, pas échantillonné : le RYTM calcule déjà tous ses sons (aucun fichier, aucune licence). TUNE, ATTACK, DECAY et DRIVE suivent la 909. Le 909 sort 1,5 dB plus bas que son crête et le 808 2 dB plus bas, parce qu'ils tiennent plus longtemps que le kick MM : sur 150 ms, le 909 frappe à -7,5 dB RMS contre -8,6 pour le MM.
- KICK est en 909 par défaut, comme demandé. Les autres voix restent en MM, le son actuel, et chacune passe en 909 ou en 808 d'une tape.
- Des TWEAKS plutôt qu'un sélecteur de kit unique : chaque famille a son commutateur, ce qui permet de mélanger un kick 909, une caisse MM et des charlestons 808.
- Les puces de pages ont quitté le RYTM, comme celles du MM-ARP avant elles : les pages sont dans le menu de l'en-tête.
- Oscilloscope : chaque fenêtre est comparée à la même place une mesure plus tôt, fantômes compris. Comparer deux temps qui se suivent n'a pas de sens dans un motif dont chaque temps est différent. La DÉRIVE ne s'affiche que si les deux fenêtres se ressemblent (corrélation d'au moins 0,6).
- L'oscilloscope est un panneau HTML et non un écran 3D, pour une précision au pixel. Il est déplaçable sur desktop, et replié en pastille au téléphone pour laisser la carte d'abord.
- Vue verrouillée : un geste parti du fond tourne toujours la vue (« à part de cliquer en dehors de la machine »). Les potards et pads de la machine qui joue répondent comme avant.
- Téléphone : zoomer la caméra n'agrandissait presque rien, car les rangées de potards occupent toute la largeur de la machine. D'où une page KNOBS en HTML, branchée sur les mêmes réglages : la machine 3D remonte au-dessus et on la voit tourner.
- L'invitation iPhone (agent) : texte d'INSTALL en encre sur l'orange pour le contraste, machine recadrée au-dessus de la carte au téléphone. Ce sont deux écarts que l'agent a signalés ; je les ai gardés.

## 3. Ce qui reste à faire / points en suspens

- Mise en ligne : tout est sur `claude/mauditemachine-dev-ipq3x5`, et le site ne se déploie que depuis `main`. Il faut fusionner (ou me dire de le faire).
- Mika, à l'écoute :
  - le kick 909 avec TUNE, ATTACK, DECAY et DRIVE ;
  - les sons 909 et 808 des autres voix (leurs niveaux sont réglés à la crête, pas encore à l'oreille) ;
  - l'OVERDRIVE du MM-ARP.
- Mika, sur un vrai iPhone :
  - l'invitation (emplacement de Partager dans Safari 26, pointe vers la barre du bas) ;
  - les pages KNOBS des deux Docks ;
  - la pastille SCOPE.
- Le MM-DECKS au téléphone est inchangé : ses touches font 19 à 24 px de haut à l'écran, avec une zone tactile de 48 px. À agrandir si Mika le trouve encore petit.
- Capot ouvert au téléphone, la plaque des TWEAKS reste petite à l'écran. Ses réglages sont tous dans KNOBS (KICK, VOICES, TWEAKS).
- Toujours en suspens : les secrets SoundCloud du worker Sonaa, le défilement de la playlist au doigt sur iPhone, l'équilibre RYTM / ARP, brave://flags/#file-system-access-api.

## 4. Commandes utiles ajoutées

- Aucune commande npm. Clés retenues dans le navigateur :
  - `mm.v4.kit.1` (le kit) ;
  - `mm.v4.scope.1` (l'oscilloscope) ;
  - `mm.v4.dock.page` et `mm.v4.vdock.page` (la page des Docks) ;
  - `mm.v4.knobtab.<machine>` (la section KNOBS) ;
  - `mm.v4.install` (le repos de 30 jours de l'invitation).
