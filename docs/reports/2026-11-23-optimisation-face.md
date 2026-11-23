# 2026-11-23 - MM-ARP v49 : la face optimisee (CPU, messages, images)

Demande de Mika : « Je voudrais que tu optimises à fond ! je veux soulager au max le CPU et éviter à tout prix la
latence sur Ableton, le moins de ms possible. » Cette session traite la FACE (WebView : `src/v4/plugin/arp`, la scene
three.js partagee `src/v4/scene/renderer.ts` et `src/v4/voyager/rig.ts` sous `PLUGIN_ARP`) et le C++ qui lui parle
(`plugin/mm-arp/src/PluginEditor.{h,cpp}`). Le moteur audio (`dsp/`, `PluginProcessor.*`) est optimise par une autre
session : il n'est pas touche ici.

## 1. Ce qui a ete fait

- Mesure d'abord (outils dans le scratchpad v49 : `measure.js`, `sim.js`, `trace.js`, `paint.js`, `wkexp.js`) : le C++
  est simule dans la page avec la meme logique que `PluginEditor::timerCallback` (avant et apres), a 30 Hz ; 16 cas
  (face, EDIT, six pages d'OPEN ; au repos et en lecture : 8 pas par seconde, LFO sur CUTOFF et RES, VU de HELL et de
  DISTO, CPU, analyseur). Chromium muet (temps du fil principal, CDP) et WebKit (WPE, le moteur de WKWebView : temps CPU
  total du processus de la page). Le rendu WebGL est saute pendant les mesures (`setSkipDraw`, `?debug=1`) : on compte
  les images que la face DEMANDE, pas le cout du rendu logiciel.
- Ce que la mesure a trouve (avant) :
  - l'ecran de la 808 (cache, le MM-ARP est seul dans le plugin) se redessinait 5 fois par seconde au repos (sa vague de
    repos, ses minuteurs) et demandait chaque fois une image 3D : la face n'etait jamais au repos ;
  - OPEN ouvert, la scene 3D cachee sous la carte opaque rendait encore 15 a 20 images par seconde (la touche OPEN qui
    respire) ;
  - en lecture, la boucle de la scene relisait la tete 30 fois par seconde pour 8 pas ;
  - le C++ envoyait jusqu'a 5 evenements separes par tick (mm_cpu 10/s, mm_mod 30/s, mm_transport, mm_knobs, mm_spec),
    48 a 64 appels a la WebView par seconde en lecture, 11 a 26 au repos, et meme fenetre cachee ;
  - le VU de la DISTO tournait a 60 images par seconde meme au repos (un rendu React complet du cadran a chaque image) ;
  - la tete du DELAY et les anneaux de HELL demandaient une image a chaque rafraichissement de l'ecran et repeignaient
    leurs lueurs (drop-shadow) 30 fois par seconde ; l'analyseur de SOUND refaisait tout l'ecran de l'EQ 15 fois par
    seconde ; l'analyseur restait branche sur le thread audio apres la fermeture de la fenetre sur la page SOUND.
- `PluginEditor.{h,cpp}` :
  - un seul evenement `mm_tick {k?, m?, t?, c?, s?}` par tick (un seul appel a la WebView), seulement ce qui a change ;
    k : les potards bouges par l'hote (valeurs exactes) ; m : les arcs, arrondis au 1 / 10 000 (0,03 degre de course) et
    envoyes seulement s'ils bougent ; t : la tete (comme avant : a chaque pas, a chaque depart ou arret, une fois par
    seconde) ; c : le CPU au dixieme (ce que la face affiche), 5 fois par seconde au plus et seulement s'il change ; s :
    l'analyseur, seulement si une bande bouge. Au repos : un seul appel par seconde (la tete et le CPU ensemble) ;
  - la face cachee (`mm_vis` de la page, ou fenetre plus montree `isShowing()`) : plus rien ne part, l'analyseur
    s'arrete, le minuteur passe a 4 Hz ; revenue, tout ce qui a change part d'un coup ;
  - la fenetre fermee : l'analyseur ne recoit plus rien du thread audio (`setSpecOn(false)` dans le destructeur).
- `bridge.ts` : `mm_tick` reparti vers les memes fonctions qu'avant (potards sans echo, arcs, CPU, analyseur, tete en
  dernier) ; `mm_vis` a chaque `visibilitychange`. Les anciens evenements restent ecoutes.
- `scene/renderer.ts` (sous `PLUGIN_ARP`) : `setCovered` (la carte d'OPEN posee : la scene ne rend plus, repart a la
  fermeture) ; l'ecran de la 808 ne s'abonne plus a rien dans le MM-ARP. `voyager/rig.ts` (sous `PLUGIN_ARP`) : plus de
  relecture de la tete entre deux pas (le mm_transport reveille la boucle).
- `HoodBoard.tsx` : la carte posee couvre la scene (`setCovered`, CARD_MS apres l'arrivee) ; l'analyseur dans sa propre
  couche (`EqAnalyzer`) entre la grille et la courbe (le meme ordre de dessin).
- `modview.ts` : la boucle des arcs s'arrete quand tout est pose (valeur, plage, traine) et ne repart que si une cible
  bouge. `cpu.ts` : les memes chiffres ne redessinent rien.
- `DistoPage.tsx` : l'aiguille du VU deplacee seule (deux attributs, plus de rendu React a chaque image), au meme pas
  d'image, et seulement tant qu'elle bouge.
- `loop30.ts` (nouveau) : une boucle a 30 images par seconde sans requestAnimationFrame a vide ; `DelayPage2.tsx` : la
  tete et sa lueur dans leur couche, deplacee par le compositeur ; `HellPage2.tsx` + `hell2.css` : chaque anneau qui
  tourne dans sa couche, tournee par le compositeur (le puits et les pistes dessous, les numeros dessus).

## 2. Decisions prises et pourquoi

- Rien de visible ne change : memes pages, memes knobs PNG (non touches), meme serigraphie, meme pixel ratio (DPR 2
  plafond, comme avant : la nettete d'abord), meme anticrenelage. Les animations gardent leur cadence (30 images par
  seconde pour la tete du DELAY et HELL, 60 pour l'aiguille du VU) ; elles ne coutent plus que le deplacement d'une
  couche.
- Un seul ecart de comportement : le compteur CPU se met a jour 5 fois par seconde au lieu de 10 (sa valeur est deja
  lissee sur 250 ms par le moteur ; chaque chiffre qui change redessinait l'en-tete d'OPEN).
- Les messages des potards de la face vers le C++ (mm_param, au plus 60 par seconde et par potard) ne changent pas : un
  potard tourne repond tout de suite (essai : premier mm_param au premier mouvement).
- Le minuteur du C++ reste a 30 Hz face visible (la tete et l'automation arrivent toujours en 33 ms au plus) ; il ne
  fait plus rien quand rien ne change.
- Le format mm_tick ne casse rien : la face et le binaire sont toujours livres ensemble (la face est dans le zip du
  VST3) ; les anciens evenements restent ecoutes par la face.

## 3. Mesures (avant -> apres)

Machine de test sans GPU (rendu logiciel) : ce sont les rapports qui comptent. « CPU face WebKit » : temps CPU total du
processus WebKit de la page (JS, style, mise en page, peinture, composition logicielle), en ms par seconde (1000 = un
coeur plein). « Fil principal Chromium » : JS + style + mise en page + peinture du fil principal. « Images 3D/s » : images
WebGL demandees. Messages : appels C++ -> face par seconde (octets JSON par seconde).

| Cas | CPU face WebKit (ms/s) | Fil principal Chromium (ms/s) | Images 3D/s | Reveils rAF/s | Rendus React/s | Messages C++ -> face /s (octets/s) |
|---|---|---|---|---|---|---|
| Face fermee, repos | 142 -> **15** | 21.1 -> **4.2** | 4.9 -> **0.0** | 6 -> **1** | 11 -> **1** | 11.1 (1659) -> **1.0 (279)** |
| Face fermee, lecture | 572 -> **406** | 77.4 -> **75.3** | 11.7 -> **8.0** | 60 -> **46** | 41 -> **36** | 48.5 (8308) -> **30.2 (5628)** |
| EDIT ouvert, repos | 66 -> **10** | 17.4 -> **3.6** | 0.0 -> **0.0** | 1 -> **1** | 11 -> **1** | 11.1 (1659) -> **1.0 (279)** |
| EDIT ouvert, lecture | 563 -> **430** | 73.3 -> **70.7** | 11.7 -> **8.1** | 60 -> **46** | 41 -> **36** | 48.6 (8332) -> **30.3 (5678)** |
| OPEN SOUND, repos | 753 -> **9** | 41.5 -> **3.7** | 16.0 -> **0.0** | 30 -> **0** | 21 -> **1** | 26.4 (9798) -> **1.0 (279)** |
| OPEN SOUND, lecture | 1902 -> **1834** | 74.4 -> **47.8** | 20.5 -> **0.0** | 60 -> **30** | 51 -> **46** | 63.7 (14972) -> **30.3 (11600)** |
| OPEN DISTO, repos | 1043 -> **8** | 50.2 -> **2.8** | 17.1 -> **0.0** | 90 -> **0** | 16 -> **1** | 11.1 (1659) -> **1.0 (279)** |
| OPEN DISTO, lecture | 1966 -> **1947** | 120.0 -> **117.9** | 20.5 -> **0.0** | 120 -> **90** | 101 -> **36** | 48.5 (8308) -> **30.3 (5655)** |
| OPEN DELAY, repos | 2122 -> **2099** | 83.0 -> **47.3** | 17.2 -> **0.0** | 90 -> **30** | 11 -> **1** | 11.1 (1659) -> **1.0 (279)** |
| OPEN DELAY, lecture | 2109 -> **2082** | 98.4 -> **63.2** | 20.7 -> **0.0** | 120 -> **60** | 41 -> **36** | 48.5 (8312) -> **30.3 (5675)** |
| OPEN HELL, repos | 2136 -> **2240** | 92.1 -> **46.4** | 17.0 -> **0.0** | 88 -> **27** | 11 -> **1** | 11.1 (1659) -> **1.0 (279)** |
| OPEN HELL, lecture | 2109 -> **2236** | 105.9 -> **56.9** | 20.6 -> **0.0** | 116 -> **54** | 40 -> **33** | 48.5 (8296) -> **30.3 (5656)** |
| OPEN REVERB, repos | 1133 -> **9** | 34.5 -> **3.3** | 16.4 -> **0.0** | 30 -> **0** | 11 -> **1** | 11.1 (1659) -> **1.0 (279)** |
| OPEN REVERB, lecture | 1735 -> **744** | 48.9 -> **27.1** | 20.7 -> **0.0** | 60 -> **30** | 41 -> **36** | 48.5 (8303) -> **30.4 (5656)** |
| OPEN SEQ, repos | 614 -> **8** | 34.9 -> **3.5** | 18.1 -> **0.0** | 30 -> **0** | 11 -> **1** | 11.1 (1660) -> **1.0 (279)** |
| OPEN SEQ, lecture | 1722 -> **1704** | 74.2 -> **51.7** | 20.6 -> **0.0** | 60 -> **30** | 46 -> **43** | 48.2 (8257) -> **30.3 (5657)** |

Somme des 16 cas : WebKit 20 687 -> 15 778 ms/s (-24 %) ; Chromium 1 047 -> 625 ms/s (-40 %).

- Peinture (Chromium, rasterisation par seconde) : analyseur de SOUND 246 -> 12 ms/s ; HELL au repos 319 -> 0 ;
  DELAY au repos 57 -> 1,6.
- Fenetre cachee : 0 message (avant : 11 a 64 par seconde), l'analyseur arrete.
- Lecture : la simulation module 4 reglages en continu (le pire cas) ; sans LFO, les arcs ne partent plus du tout.
- Ce qui reste cher dans WebKit en lecture et sur DELAY / HELL : la composition logicielle de WPE (ici sans GPU, chaque
  image recompose toute la carte et ses lueurs : environ 70 a 100 ms par image). Sur le Mac, la composition passe par le
  GPU (Core Animation) : ces images ne coutent presque plus rien au processeur une fois les repeints supprimes.
- Face -> C++ : un potard tourne envoie ses mm_param (au plus 60 par seconde), l'etat du projet (mm_state, 12,5 Ko) part
  une fois 900 ms apres le geste : inchange.

## 4. Essais (sans son)

- `npx tsc --noEmit -p .` : 105 erreurs (comme avant, aucune dans les fichiers touches) ; `npm run plugin:arp:web` passe.
- `PluginEditor.cpp` compile contre les en-tetes de JUCE 8.0.9 (g++ et clang, `-fsyntax-only`, WebData.h factice : le
  plugin complet ne se construit pas sous Linux sans webkit2gtk) ; banc `mmarp_host_test` construit et passe (73 ok).
- Chromium muet, `?mute=1&probe`, par le DOM (`func.js`, 34/34) : mm_ready ; face au repos sans aucun message ; CUTOFF
  tourne -> mm_param tout de suite, geste ouvert et ferme, derniere valeur exacte ; mm_tick k sans echo ; arcs affiches
  puis effaces, boucle arretee une fois posee ; compteur CPU ; tete -> data-v4-running et une image par pas, plus aucune
  entre deux pas ; mm_vis caché / revenu ; OPEN : plus d'image 3D, les six pages s'ouvrent, la tete de la SEQ avance
  (2, 3, 4), le VU bouge puis se pose, l'analyseur dessine (mm_view spec), la tete du DELAY et les six anneaux de HELL
  bougent ; CLOSE : la scene rend de nouveau ; EDIT : l'encart s'ouvre.
- Captures avant / apres (1496 x 957, DPR 2, animations figees au meme point) : face fermee et EDIT identiques au pixel ;
  SEQ identique ; DISTO 4 pixels (l'aiguille au repos) ; SOUND, DELAY et HELL : l'anticrenelage de la couche (ecart moyen
  0,003 a 0,03 / 255), identiques a l'oeil, meme nettete (gros plans x2 compares).

## 5. Ce qui reste a faire / points en suspens

- A juger sur le Mac de Mika (WKWebView, GPU) : le compteur CPU d'Ableton et le detail CPU de la face (FACE IDLE au
  repos), la fluidite de la tete du DELAY et des anneaux de HELL (couches du compositeur : une rotation d'image au lieu
  d'un dessin vectoriel, identique ici), la reprise apres une fenetre cachee (Live au second plan puis au premier plan).
- `document.visibilityState` dans WKWebView sous Ableton (fenetre recouverte, reduite) : si WebKit ne le signale pas,
  la face continue d'envoyer comme avant (aucune perte), seul le gain fenetre cachee manque.
- Pistes non prises (elles changeraient l'image) : aiguille du VU a 30 images par seconde ; DPR plafonne sous 2 ; arcs de
  modulation sans lueur. Les lueurs et le dessin des arcs restent le gros du cout restant en lecture avec LFO.

## 6. Commandes utiles ajoutees

- Aucune commande npm. Outils de mesure (scratchpad v49, hors depot) : `node measure.js <port> <avant|apres> <cas,...>`
  (SKIP=1 pour sauter le rendu WebGL, ENGINE=webkit pour WebKit, PARTS=tmcs pour choisir ce que le faux C++ envoie),
  `node func.js <port>` (les essais sans son), `node cap.js <port> <prefixe> <cas,...>` (les captures).
