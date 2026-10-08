# 2026-10-08 - MM-BASS façon Monark et Elektron, OPEN et INFOS, un kick propre, les niveaux mesurés en sortie, le MIXER

Suite des sessions du 2026-10-07 (rapport précédent : `2026-10-07-mixer-5-voies-sync-decks.md`). Mika a demandé :
- le bouton du mixer (RYTM + ARP) doit aussi arrêter la BASS ;
- un bon kick : en n'utilisant que le MM-RYTM, le kick sonne chorusé, doublé ; et tous les niveaux comme demandé (le kick en référence) ;
- MM-BASS : les parameter locks ne font rien ; un bouton OPEN avec des paramètres plus particuliers et un bouton INFOS (au survol de chaque paramètre, un texte et une image) ; une machine moins complexe, qui ressemble à un Monark, intuitive comme une Elektron ; un bouton EDIT visible ;
- puis, dans un second message : le GAIN du MIXER à ±12 dB, les vumètres vert / jaune / rouge, le Roto-Control qui marche une fois sur deux, un MM-RYTM façon Digitakt (8 potards et des pages), le Roto en séquenceur, et sur les DECKS la platine de droite qui ne démarre pas.

## Ce qui a été fait

- **Bouton MACHINES** : vérifié au vrai clic sur le code en ligne (déploiement 654) : il lance et arrête RYTM, BASS et ARP ensemble, et arrête aussi la BASS lancée seule. La capture de Mika montrait l'ancien libellé RYTM + ARP, d'avant ce déploiement.
- **MM-BASS, la face** (`bass/theme.ts`, `bass/rig.ts`) :
  - sections dans l'ordre du signal, comme un Minimoog : OSC (OCTAVE, WAVE, SUB) | FILTER (CUTOFF, RESO) | ENVELOPE (ENV MOD, DECAY) | ACCENT / SLIDE (ACCENT, GLIDE) | OUTPUT (DRIVE, VOLUME) ;
  - le GENERATOR à côté de l'écran : STYLE, DENSITY, GEN, MUTATE ;
  - EDIT et OPEN en haut à droite, plus grands, orange, toujours un peu allumés ;
  - au téléphone, quatre rangées de potards plus gros ;
  - en-tête MONO BASS SYNTH, FIRMWARE V.2.0.
- **MM-BASS, OPEN** : le dessus est un capot. Il se soulève, et la carte sort avec une plaque TWEAKS (`bass/tweaks.ts`) :
  - GENERATOR : SLIDE PROB, ACC PROB, RANGE, ROOT, SCALE ;
  - VOICE : LENGTH, ACC DECAY, SWEEP, RELEASE, SUB OCT, TUNE, six constantes du son devenues des potards (`bass.worklet.js`, `engine.ts`, `seq.ts`) ;
  - les touches INFOS et CLOSE ;
  - raccourcis O et I, cibles MIDI, et les potards 19 à 23 du Roto (LENGTH, ACC DECAY, SWEEP, RELEASE, TUNE).
- **MM-BASS, LOCK** (`bass/actions.ts`, `bass/gestures.ts`) :
  - à l'arrêt, le pas s'entend quand on le verrouille et après chaque réglage ;
  - un pas vide qu'on verrouille reçoit une note ;
  - en LOCK, toucher un autre pas y déplace le verrou ;
  - tenir un pas 350 ms le verrouille, comme une Elektron ;
  - le pas réglé clignote, une LED orange s'allume à côté de chaque potard verrouillé, et l'écran montre la grille des verrous.
- **MM-BASS, le générateur** : tant que la ligne de GEN n'est pas retouchée, tourner STYLE, DENSITY, SLIDE PROB, ACC PROB ou RANGE la réécrit avec le même tirage (on entend le potard). Une ligne retouchée affiche PRESS GEN.
- **MM-BASS, INFOS** :
  - fichiers : `state/bassInfos.ts`, `bass/infos.ts`, `bass/diagrams.ts`, `bass/InfosCard.tsx` ;
  - 41 cartes en français : à quoi sert la commande, comment l'utiliser, une astuce ;
  - chaque carte a un dessin qui suit la valeur en direct, calculé avec les vraies formules du son ;
  - au survol à la souris, au toucher sur téléphone ; une pastille INFOS ON pour l'éteindre ;
  - l'écran du MM-BASS montre en grand le potard qu'on vient de tourner, pendant 1,2 s.
- **Un kick propre** (`audio/drums.ts`, `audio/shotsdsp.ts`) :
  - le kick a sa propre voie : seulement le TONE du pattern, plus de CHORUS, DIST, REVERB ni DELAY GLOBAL ;
  - il est monophonique : chaque kick coupe le précédent en 3 ms ;
  - les samples de kick sont sommés en mono.
- **Niveaux** (`drums.ts`, `bass.worklet.js`, `synth.ts`, `limiter.worklet.js`) : plus de compresseur sur le bus du RYTM, les trois machines rattrapées de -3 dB, le plafond du limiteur à -0,3 dBFS.
- **MIXER** (`dj/math.ts`, `dj/engine.ts`, `dj/gestures.ts`, `dj/theme.ts`, `dj/controls.ts`) : GAIN de -12 à +12 dB ; vumètres vert, jaune à partir de -6 dBFS, rouge à -1.
- **DECKS, la platine qui ne démarre pas** (`dj/actions.ts`, `dj/rig.ts`, `dj/gestures.ts`, `dj/keys.ts`, `dj/state.ts`, `audio/soundcloud.ts`) :
  - PLAY pressé pendant le chargement arme la platine : PLAY s'allume en orange, l'écran dit PLAY ARMED, elle part toute seule dès qu'elle est prête ; un second appui désarme ; SYNC pressé pendant le chargement se fait aussi ;
  - l'ancien morceau s'éjecte dès qu'on en choisit un autre : il ne peut plus repartir puis rester figé, lampe allumée, sans son ;
  - l'écran dit l'étape du chargement : READING, DECODING, ANALYSING ;
  - un cue retenu à la toute fin d'un morceau ne gare plus la platine là ; PLAY au bout du morceau repart du cue ;
  - un CUE dont le relâchement s'est perdu (bouton MIDI en mode bascule) ne bloque plus PLAY ;
  - Espace lance la dernière platine touchée, à la souris comme au clavier ;
  - le pont avec le lecteur SoundCloud du site ne relance plus la piste du site (qui coupait les platines) quand on lance A puis B très vite.
- **Relecture critique** (trois relecteurs, chaque constat contre-vérifié), tout corrigé avant le déploiement :
  - MM-BASS : un potard tourné à deux doigts pendant qu'on lâche le pas tenu n'écrase plus le son global ; promener LOCK sur des pas vides ne remplit plus la ligne de notes ; l'accent posé par un verrou d'ACCENT part avec lui ; l'écoute à l'arrêt respecte LENGTH ; Échap ne bute plus sur INFOS quand on est sur une autre machine ; toucher la carte INFOS la range (au téléphone, elle couvrait CLOSE) ; LOCK ne fait plus tourner le rendu en continu ; le logo referme aussi le capot du MM-BASS ;
  - kick : après STOP, le kick suivant coupe bien la queue de celui qui sonne encore.
- **Roto-Control, la fiabilité** (`midi/midi.ts`, `midi/roto.ts`, `midi/targets.ts`, `midi/leader.ts`, `midi/rotoKeys.ts`, `ui/MidiPanel.tsx`, `audio/clock.ts`) : 14 façons de rater reproduites avec un faux Roto, toutes corrigées :
  - les boutons en mode TOGGLE marchent du premier coup, même après un changement fait sur la page ;
  - PREV / NEXT / MM-STUDIO finissent sur la bonne machine (FOLLOW ne réagit plus au relâchement) ;
  - le Roto n'écoute que les ports nommés Roto ; un réglage appris ne répond qu'à son appareil ; les doublons sont filtrés ;
  - un réglage appris sur la même adresse que le Roto est signalé dans le panneau MIDI, avec un bouton pour le retirer ;
  - plus de RUN muet : tant que la page n'a pas été cliquée, l'écran dit CLICK THE PAGE ONCE FOR SOUND et la machine part au premier clic ;
  - un seul onglet pilote le Roto (les autres l'indiquent) ;
  - un changement de setup sur le Roto ne fait plus sauter un potard ;
  - plus de rafales de 214 messages à chaque changement de machine ;
  - le panneau MIDI dit ce que chaque message a fait (CC 17 CH 12 -> PLAY A) et se ferme quand on clique ailleurs ;
  - les adresses sont gelées : déplacer une commande ne change plus jamais ce que fait un bouton du Roto ; les setups portent une version (RYTM 1008...).
- **MM-RYTM façon Digitakt, étape 1** (`rytm/pages.ts`, `rytm/pageView.ts`, `state/rytmPage.ts`, `scene/screen.ts`) : l'écran gagne une vue PAGE dans le même style, les 8 blocs d'une page en 2x4 (TRIG, SRC, FLTR, AMP, FX, LFO). L'écran d'aujourd'hui reste celui par défaut. Toucher un potard du MM-RYTM montre sa page 4 s, avec son bloc encadré. Au clavier, H garde la vue PAGE, [ et ] changent de page. Rien ne change au son ni à la face.
- `docs/midi` régénéré (437 cibles, mêmes adresses, setups versionnés) ; `docs/v4/spec.md` : R14-210 à R14-221.

## Décisions prises et pourquoi

- **"TS-1"** : c'est le Torso T-1, le modèle de l'ancienne rangée GENERATOR. Sept potards de règles, dont quatre qu'on n'entendait pas avant GEN, et des noms qui se confondaient (ACCENT, ACCENTS, SLIDE, SLIDES, GLIDE). Ces règles passent sous le capot ; sur la face ne restent que STYLE et DENSITY, qui s'entendent tout de suite.
- **Le moteur de la basse ne change pas de nature** : c'est l'organisation de la face qui suit le Monark, pas un second oscillateur. Les nouveaux réglages ont pour défaut les anciennes constantes. Le son par défaut est identique, vérifié échantillon par échantillon.
- **Les LOCK marchaient** (vérifié de bout en bout) ; ce qui manquait, c'était le retour : on n'entendait rien à l'arrêt, et la machine ne montrait rien. Les boutons LOCK restent pour la souris, et l'appui tenu sur un pas est ajouté pour le doigt et les habitués d'Elektron.
- **Le kick, causes mesurées** :
  - le CHORUS GLOBAL est un insert sur tout le bus. Il posait une copie du kick 7 à 28 ms plus tard, différente à chaque coup et entre L et R ; les presets DARK DISCO et ITALO l'allument ;
  - la queue d'un kick 909 sonnait encore à -13 dB sous le suivant, et les deux battaient dans le grave.
- **Les niveaux, causes mesurées en sortie réelle** :
  - le compresseur de Chrome ajoute d'office +3,7 dB sous -14 dBFS, et il écrasait le kick : la snare sortait à 0,75 dB sous lui au lieu de 1,5 ;
  - les trois machines ensemble dépassaient le plafond, et le limiteur mangeait 2 à 3 dB sur les kicks.
- **Les niveaux, après** (kit par défaut, les trois machines qui jouent) :
  - kick à -9,35 dBFS, snare 1,5 dB dessous, clap 3,5 ;
  - basse environ 1,7 dB sous le kick, ARP environ 6 dB dessous ;
  - le mix complet crête à -1,56 dBFS : le limiteur ne touche plus au kick.
  - Contrepartie : le site sonne environ 4,5 LU moins fort. Les morceaux masterisés des platines paraîtront plus forts que les machines : on rattrape au MIXER, comme dans ta façon de faire.
- **GAIN ±12 dB pour le GAIN seulement** : les EQ gardent leur loi (KILL à gauche, +6 dB à droite).
- **DECKS, ce qui se passait** : avec un vrai fichier (MP3 de 7 min, WAV 24 bits), la platine met 2 à 10 s à lire, décoder et analyser le morceau. Un PLAY pressé pendant ce temps ne faisait rien, sans rien montrer ; et si la platine tenait déjà un morceau, il relançait l'ancien, que le décodage coupait ensuite en laissant la platine allumée et muette. Une platine chargée, elle, démarre à chaque fois (12 tailles d'écran, 7 angles de vue, au doigt aussi). Cinq autres causes donnent le même symptôme ; quatre sont corrigées, la dernière demande de réimporter les setups du Roto (voir plus bas).
- **Le panneau MIDI** couvrait l'écran de la platine B, et à certaines tailles ses touches CUE, SYNC et PLAY ; il se ferme maintenant quand on clique ailleurs (sauf en MIDI LEARN).

## Ce qui reste à faire / points en suspens

- **DECKS, à confirmer par Mika** : quand ça a raté, PLAY B était-il pressé juste après le choix du morceau, avant que la forme d'onde apparaisse ? Ou au bouton PLAY B du Roto ? Si ça recommence, noter ce que dit l'écran de la platine (READING, DECODING, PLAY ARMED).
- **Roto, setups d'avant le 2026-10-07** : sur les setups MIXER et LIVE de cette époque, le bouton PLAY B du Roto lance la platine A, et CUE A lance B. Réimporter MIXER (14) et LIVE (16) depuis `docs/midi/roto/`.
- **SoundCloud en production** : le Worker répond 503 « soundcloud non configure » pour MAUDITE, la recherche et le flux. Sur le site en ligne, les platines ne lisent donc que tes fichiers. Il manque la clé SoundCloud dans les secrets du Worker, à poser de ton côté (je n'y touche pas sans ton accord).
- **Roto-Control, côté Mika** : réimporter les 6 setups de `docs/midi/roto/` (ils portent maintenant la version 1008 ; BASS a cinq potards de plus). Puis les tests sur l'appareil : RUN du Roto après un RUN cliqué (doit arrêter au premier appui), PREV / NEXT, changer de setup puis toucher un potard (pas de saut), deux onglets ouverts (seul le dernier réagit), et dans MIDI Monitor : le Roto renvoie-t-il des CC pendant que ses moteurs bougent ?
- **Roto en séquenceur** : faisable (16 pas vus 8 par 8 avec défilement, LED des pas et de la tête de lecture, un pas tenu pour LOCK). À faire après l'étape des P-locks du MM-RYTM.
- **MM-RYTM façon Digitakt, la suite** : étape 2, les touches de page et les 8 potards sous l'écran ; puis les P-locks (tenir un pas + tourner), puis les sample locks. Questions à trancher par Mika avant l'étape 2 (voir le rapport Claude Desktop).
- **À écouter, côté Mika** : le kick seul et en preset, l'équilibre des trois machines, les réglages fins de la basse.
- Toujours en attente : le compteur de visiteurs du MENU.

## Commandes utiles ajoutées

- Aucune nouvelle commande npm. `npm run docs:midi` régénère la doc MIDI après un changement de cibles.
- Clavier du MM-BASS : O ouvre le capot, I allume ou éteint INFOS, Échap éteint INFOS.
- Clavier du MM-RYTM : H garde ou lâche la vue PAGE, [ et ] changent de page.
- `npm run docs:midi` lit maintenant les adresses dans le registre gelé (`src/v4/midi/rotoKeys.ts`) ; la variable `MIDI_OUT` écrit la doc ailleurs que dans `docs/midi`.
- Console (`?debug=1`) : `__v4.rytm.page` et `__v4.rytm.store` pour la vue PAGE.
