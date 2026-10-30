/** Les cartes INFOS du MM-RYTM : les pads, les pas et le P-LOCK, le transport, EDIT OPEN CLOSE, MASTER et TEMPO, l'ecran (deplacees telles quelles de la table RAW de rytm/infos.ts en P0, 2026-10-30). */

import { type RytmInfoId } from '../diagrams';
import type { Raw } from './types';
import { PHONE } from './words';

export const RAW_CONTROLS = {
  /* ---------- les pads des voix ---------- */
  'pad:BD': {
    section: 'VOICES',
    title: 'BD',
    text: "Le kick, la référence du mix : il sort le plus fort, les autres voix sont calées sous sa crête. Il a sa propre voie (les FX globaux ne le touchent pas, il a les siens dans VOICE FX) et il est monophonique : un nouveau coup coupe la queue du précédent en 3 ms. Le pad le choisit : les pas et l'écran le règlent ; à l'arrêt, il le joue aussi, à la vélocité des nouveaux pas (HIGH au départ). Le dessin montre ce qu'il joue et ses 16 pas.",
    key: 'A',
    tip: 'Choisis la voix avant de toucher les pas : ils montrent et changent sa rangée.',
  },
  'pad:SD': {
    section: 'VOICES',
    title: 'SD',
    text: "La caisse claire : sa crête reste au moins 1,5 dB sous celle du kick. Le pad la choisit : les pas et l'écran la règlent ; à l'arrêt, il la joue aussi.",
    key: 'S',
    tip: 'Sur 5 et 13 pour l’indie dance ; une ghost note plus douce (VOL verrouillé) sur le 15 fait rouler la mesure.',
  },
  'pad:CH': {
    section: 'VOICES',
    title: 'CH',
    text: "Le charley fermé : il coupe le charley ouvert qui sonne encore, en 8 ms, comme une 808. Le pad le choisit ; à l'arrêt, il le joue aussi.",
    key: 'D',
    tip: 'Des doubles croches à 85 et un 127 sur chaque temps : le moteur de l’indie dance.',
  },
  'pad:OH': {
    section: 'VOICES',
    title: 'OH',
    text: "Le charley ouvert ; le prochain charley, fermé ou ouvert, le coupe en 8 ms. Le pad le choisit ; à l'arrêt, il le joue aussi.",
    key: 'F',
    tip: 'OH sur les contretemps et CH partout ailleurs : le charley ouvert se ferme tout seul, la house classique.',
  },
  'pad:CP': {
    section: 'VOICES',
    title: 'CP',
    text: "Le clap : sa crête reste au moins 3,5 dB sous celle du kick. Le pad le choisit ; à l'arrêt, il le joue aussi.",
    key: 'Z',
    tip: 'Avec la caisse claire sur 5 et 13 : la dark disco ; seul et plus bas, il suffit à un minimal.',
  },
  'pad:TOM': {
    section: 'VOICES',
    title: 'TOM',
    text: "Le tom grave ; TOM et HT partagent leur son (TOMS). Le pad le choisit ; à l'arrêt, il le joue aussi.",
    key: 'X',
    tip: 'Deux ou trois coups accordés en P-LOCK (PITCH) : une ligne de percussions pour le minimal.',
  },
  'pad:HT': {
    section: 'VOICES',
    title: 'HT',
    text: "Le tom aigu ; TOM et HT partagent leur son (TOMS). Le pad le choisit ; à l'arrêt, il le joue aussi.",
    key: 'C',
    tip: 'HT sur le dernier temps, en réponse au TOM : le petit roulement de la dark disco.',
  },
  'pad:CY': {
    section: 'VOICES',
    title: 'CY',
    text: "La cymbale, en stéréo large (sa gauche et sa droite ont leurs propres phases), la plus discrète du kit (sa crête est la plus basse) ; un seul son. Le pad la choisit ; à l'arrêt, il la joue aussi.",
    key: 'V',
    tip: 'Une CY au début de chaque phrase seulement : l’indie dance garde son souffle.',
  },

  /* ---------- les pas et le P-LOCK ---------- */
  step: {
    section: 'STEPS',
    title: 'STEPS',
    text: "Les 16 pas de la voix choisie. Un coup s'allume en rouge, plein à la vélocité la plus forte (127, HIGH), de plus en plus sombre jusqu'à la plus douce (14) ; la tête de lecture passe en blanc. ● REC allumé : une tape pose le pas (à la vélocité des nouveaux pas, HIGH au départ, ou celle de VEL sur TRIG) ou le retire ; tiens-le et glisse : sa vélocité ; tiens-le 350 ms sans bouger (ou L) : P-LOCK ; tiens un pas et tourne un potard : le verrou se pose tout de suite. REC éteint : un pas de 1 à 8 joue sa voix et la choisit, rien ne s'écrit ; 9 à 16 ne jouent rien ; pas de P-LOCK sans REC. REC éteint, FUNC + un pas de 1 à 8 coupe sa voix ou la rend ; ● REC allumé, FUNC + un pas pose ou enlève un lock trig (en mode MUTE, toujours le mute). Un pas qui porte des verrous a un trait sur sa touche et un point dessous à l'écran ; un lock trig (● REC, FUNC + le pas) s'allume en jaune ; un pas à COND ou PROB a un petit point jaune au coin. PTN ouvert, les 16 pas sont les 16 patterns ; TRK tenue ou gardée, un pas de 1 à 8 choisit sa voix ; en mode MUTE (FUNC + TRK), ils sont les voix.",
    tip: 'Le kick sur 1, 5, 9 et 13 (les pas encadrés), le clap ou la caisse claire sur 5 et 13 : la base du four on the floor.',
    phone: {
      text: "Les 16 pas de la voix choisie. Un pas mis s'allume en entier, plein à la vélocité la plus forte (127, HIGH), de plus en plus sombre jusqu'à la plus douce (14) ; un pas vide reste éteint. Touche un pas vide : il prend la vélocité des nouveaux pas (HIGH au départ) ; touche-le encore : MID, LOW, vide. Tiens-le et glisse vers le haut ou le bas : sa vélocité, en neuf niveaux, la touche suit. Tiens-le 350 ms sans bouger : P-LOCK. Ou tiens un pas d'un doigt et glisse une valeur de l'écran d'un autre : le verrou se pose tout de suite. Un pas qui porte des verrous a un trait sur sa touche, près du bord arrière, et un point dessous à l'écran. Dans EDIT, les 16 pas sont les 16 patterns.",
    },
    voice: {
      none: {
        text: PHONE
          ? "Les 16 pas de la voix choisie : touche d'abord un pad (l'écran dit TAP A PAD FIRST). Ensuite, une touche sur un pas vide le pose à la vélocité des nouveaux pas (HIGH au départ) ; tenu 350 ms : P-LOCK."
          : "Les 16 pas de la voix choisie : choisis d'abord une voix au clavier, A S D F et Z X C V (l'écran dit PICK A VOICE FIRST). Ensuite, une touche sur un pas vide le pose à la vélocité des nouveaux pas (HIGH au départ) ; tenu 350 ms : P-LOCK.",
      },
    },
  },
  lock: {
    section: 'STEPS',
    title: 'P-LOCK',
    steps: [
      "● REC allumé (le P-LOCK le demande, comme sur la Digitakt), tiens un pas 350 ms (ou L) : il passe en P-LOCK, l'en-tête de l'écran devient P-LOCK STEP 05.",
      "Choisis la page, tourne le potard d'une valeur (ou sa molette) : ce réglage ne change que sur ce pas, son bloc passe en négatif, un P dans son coin.",
      'Retape le pas (ou Échap) pour sortir.',
    ],
    text: "Le parameter lock d'une Elektron : un pas garde sa propre valeur d'un réglage, et l'écran la montre quand le pas joue (la pastille P-LOCK clignote pendant la lecture). Chaque page compte ses verrous ; deux clics sur le potard d'une valeur enlèvent son verrou, CLEAR tous ceux du pas. Les huit potards à droite de l'écran tournent les valeurs de la page à leur place : un pas tenu (ou en P-LOCK), ils posent son verrou, sur la page montrée ; leurs anneaux passent au jaune du LOCK. Un pas tenu gagne sur une scène armée ; garder le P-LOCK (un pas lâché sans tourner) désarme une scène gardée, armer une scène quitte le P-LOCK. Dans le Dock, un appui long sur le pas, puis KNOBS.",
    tip: 'Un sample lock : en P-LOCK sur le pas 16 de BD, glisse SOUND (VOICE) jusqu’à une caisse claire de Mika ; la mesure finit sur elle, calée à son niveau.',
    phone: {
      steps: [
        "Tiens un pas 350 ms : il passe en P-LOCK, l'en-tête de l'écran devient P-LOCK STEP 05.",
        "Choisis la page, glisse une valeur de l'écran de haut en bas : ce réglage ne change que sur ce pas, son bloc passe en négatif, un P dans son coin.",
        'Retape le pas pour sortir.',
      ],
      text: "Le parameter lock d'une Elektron : un pas garde sa propre valeur d'un réglage, et l'écran la montre quand le pas joue (la pastille P-LOCK clignote pendant la lecture). Chaque page compte ses verrous ; deux tapes sur une valeur enlèvent son verrou, CLEAR tous ceux du pas. À deux doigts, plus vite : un sur le pas, l'autre glisse la valeur ; dans le Dock, un appui long sur le pas, puis KNOBS. Les huit encodeurs sous l'écran restent les FX globaux : ils ne verrouillent jamais.",
    },
  },

  /* ---------- le transport ---------- */
  run: {
    section: 'TRANSPORT',
    title: PHONE ? 'RUN/STOP' : '▶ PLAY',
    text: "Lance la lecture du MM-RYTM, du pas 1 ; une piste SoundCloud qui joue passe en pause. Pendant la lecture, PLAY met en pause (sa LED verte clignote) ; PLAY encore reprend au pas de la pause ; ■ STOP revient au pas 1. Le MM-BASS et le MM-ARP se calent sur sa grille quand ils jouent. FUNC + PLAY : CLEAR (REC éteint, tout le pattern, ses verrous et ses scènes, tous les FX à zéro, chaque voix sur un son de base ; REC allumé, la ligne de la voix choisie ; une scène armée, la scène ; en P-LOCK, les verrous du pas). UNDO revient à avant. Au MIDI, rytm:play fait la pause, rytm:run reste RUN/STOP.",
    phone: {
      text: "Lance ou arrête le séquenceur du MM-RYTM ; une piste SoundCloud qui joue passe en pause. Le MM-BASS et le MM-ARP se calent sur sa grille quand ils jouent. En lecture, toucher un pad choisit sa voix sans la jouer.",
    },
    key: 'Espace',
  },
  clear: {
    section: 'TRANSPORT',
    title: 'CLEAR',
    text: "Vide les 16 pas de toutes les voix, et leurs verrous ; la lecture continue. Tous les effets passent à zéro (GLOBAL FX et ceux de chaque voix) et chaque voix repart d'un son de base : VOICE, FLTR et ENV au neutre (attaque nette, toute la queue, filtre ouvert), les réglages de la machine (OPEN) à leur départ ; le son choisi (SOUND) reste. UNDO revient à avant. En P-LOCK, n'efface que les verrous du pas, ses coups restent.",
  },
  random: {
    section: 'TRANSPORT',
    title: 'RANDOM',
    text: "Compose un motif 4x4 neuf pour toutes les voix dans un style (HOUSE, DEEP HOUSE, TECH HOUSE, TECHNO, MINIMAL, INDIE DANCE, DARK DISCO, ITALO, PROG ou ELECTRO), jamais deux fois le même style de suite : le kick reste sur les quatre temps, le reste change à chaque appui (backbeat, charleys en croches, doubles croches, galop ou euclidiens, percussions euclidiennes, roulements, ride ou crash, vélocités sur neuf niveaux) et le motif s'éloigne toujours du précédent. Le SWING suit le style ; chaque voix, le kick compris, prend aussi un autre son de sa liste SOUND (le plus souvent un sample, sinon 909, 808 ou MM) ; TONE, VOL, DECAY et PAN sont tirés pour chaque voix sauf le kick. Le tempo, les autres effets, les autres réglages des voix et les verrous restent ; UNDO revient au motif et aux sons d'avant. Pour choisir un son toi-même, touche le nom du son (SOUND, page VOICE), toute la liste de la voix s'ouvre ; au desktop, un WAV glissé sur la machine y entre aussi.",
    tip: 'Appuie jusqu’à ce qu’un groove t’accroche, puis garde-le dans un pattern avec EDIT.',
  },
  mute: {
    section: 'TRANSPORT',
    title: 'MUTE',
    text: "Une tape sur MUTE, puis une voix, au clavier (A S D F, Z X C V) ou TRK et son pas (1 à 8) : elle se coupe, ou revient ; deux tapes sur MUTE, plusieurs voix ; une tape de plus, le mode se range et les voix coupées le restent. Des voix coupées, le mode rangé : une tape sur MUTE les rend toutes ; tenu 600 ms, toutes les voix reviennent. Sans armer MUTE : TRK (tenue ou gardée d'une tape), puis deux tapes rapides sur le pas de la voix, ou TRK et un clic droit sur le pas. Au MIDI, rytm:pad:BD fait comme la touche A, et rytm:voice:BD:mute coupe la voix d'un coup (de même pour les autres). TRK montre une voix coupée à peine allumée, avec une barre rouge. Une voix coupée ne joue ni ses pas ni ses verrous ; choisie, elle se règle sans s'entendre, et tu entends le changement quand tu la rends. Les mutes n'entrent jamais dans une scène : une scène armée, MUTE et le mute d'une voix restent ceux de toujours.",
    phone: {
      text: "Un clic droit sur un pad (au doigt : deux tapes rapides) coupe sa voix, ou la rend ; autant de voix que tu veux. Une tape sur MUTE : toutes les voix reviennent. Une voix coupée a son pad rouge, ses pas et ses verrous ne jouent pas ; une tape sur son pad la choisit sans la rendre ni la jouer : tu la règles sans l'entendre, et tu entends le changement quand tu la rends.",
    },
    key: 'M',
    tip: PHONE
      ? 'En live : coupe le kick et les charleys d’un clic droit, prépare-les en silence, puis MUTE : tout revient d’un coup.'
      : 'En live, au Roto-Control : coupe le kick et les charleys, prépare-les en silence, puis MUTE : tout revient d’un coup.',
  },
  solo: {
    section: 'TRANSPORT',
    title: 'SOLO',
    text: "Une tape sur SOLO, puis une voix au clavier (A S D F, Z X C V) : elle joue seule ; deux tapes sur SOLO, plusieurs voix ; une tape de plus, le mode se range et le solo reste ; tenu 600 ms, toutes les voix reviennent. Le solo et les mutes sont deux listes à part : sortir du solo rend les mutes d'avant.",
    phone: {
      text: "Comme MUTE, mais la voix touchée joue seule (son pad passe en bleu) : une tape, une voix ; deux tapes, plusieurs ; une tape de plus, le mode se range et le solo reste ; tenu 600 ms, toutes les voix reviennent. Le solo et les mutes sont deux listes à part : sortir du solo rend les mutes d'avant.",
    },
    key: 'Maj + M',
  },

  /* ---------- EDIT, OPEN, CLOSE ---------- */
  edit: {
    section: 'KEYS',
    title: PHONE ? 'EDIT' : 'PTN',
    text: "La grille des patterns (l'ancien EDIT, la touche PTN) : les 16 pas deviennent les 16 patterns (A01 à A16) : le pattern qui joue en rouge plein, le suivant et la chaîne en rouge clignotant, un pattern plein en blanc faible, un vide éteint. Touche un pas pour jouer son pattern (en lecture, à la fin de la mesure), plusieurs dans les 2 s pour les enchaîner, tiens un vide pour y copier le pattern courant, verrous et mute du pattern compris. PTN deux fois de suite : KIT, tes presets. FUNC + PTN : BANK, les banques A à H (128 patterns, A01 à H16) ; la grille montre les 16 patterns de la banque affichée. Une touche de page, PTN, E, NO ou Échap la referment.",
    phone: { text: "Les 16 pas deviennent les 16 patterns (A01 à A16) : touche un pas pour jouer son pattern (en lecture, à la fin de la mesure), plusieurs dans les 2 s pour les enchaîner, tiens un vide pour y copier le pattern courant, verrous compris. L'éditeur du motif s'ouvre : les huit voix sur 16 pas, la vélocité en tenant une case. Une touche de page, EDIT, E ou Échap le referment." },
    tip: 'Quatre patterns enchaînés (A01 > A02 > A01 > A03) : une phrase de quatre mesures qui évolue toute seule.',
  },
  open: {
    section: 'KEYS',
    title: 'OPEN',
    text: "Le logo M, en haut à droite de la face : un clic soulève le capot (il luit au survol). La plaque TWEAKS règle la machine (le KICK : SYN TUNE, ATTACK, SYN DECAY et DRIVE ; la caisse claire : SNAPPY et GATE). Le son de chaque voix se choisit à l'écran (SOUND, page SRC, ou FUNC + SRC) ou au MIDI (rytm:kit:<voix>). La musique continue. Capot ouvert, l'écran part avec le panneau : la pastille INFOS, en haut à gauche, allume l'aide pour lire la plaque.",
    phone: { text: "Soulève le capot : la plaque TWEAKS règle la machine (le KICK : SYN TUNE, ATTACK, SYN DECAY et DRIVE ; la caisse claire : SNAPPY et GATE). Le son de chaque voix se choisit à l'écran (SOUND, sous HOME ou page VOICE) ou au MIDI (rytm:kit:<voix>). La musique continue. Capot ouvert, l'écran part avec le panneau : la pastille INFOS, en haut à gauche, allume l'aide pour lire la plaque." },
    key: 'O',
  },
  close: {
    section: 'TWEAKS',
    title: 'CLOSE',
    text: 'Referme le capot du MM-RYTM.',
    key: 'O ou Échap',
  },

  /* ---------- MASTER et TEMPO ---------- */
  level: {
    section: 'MASTER',
    title: 'MASTER',
    text: "Le volume de tout le MM-RYTM, voix et effets compris (les envois REVERB et DELAY suivent) : un gain au carré, -3,9 dB au réglage d'usine (102), 0 dB tout en haut. Il est dans l'écran, en haut à droite, à gauche du tempo (sur HOME et dans la vue PAGE) : sept barres qui montent avec lui. Il se règle au potard A du MIXER, onglet 2/2 MASTER (FUNC + MOD, puis MOD encore) : glisse-le de haut en bas (Maj : plus fin), ou sa molette ; deux clics le remettent à -3,9 dB. Il ne touche ni le MM-BASS, ni le MM-ARP, ni le volume du site.",
    tip: 'Règle MASTER une fois, puis équilibre les machines au MIXER du MM-DECKS (voie 1).',
    phone: {
      text: "Le volume de tout le MM-RYTM, voix et effets compris (les envois REVERB et DELAY suivent) : un gain au carré, -3,9 dB au réglage d'usine (102), 0 dB tout en haut. Il est dans l'écran, en haut à droite, à gauche du tempo (sur HOME et dans la vue PAGE) : sept barres qui montent avec lui, son niveau en dB à côté quand la place le permet. Glisse-le de haut en bas, il se cerne tant que tu le tiens ; deux tapes le remettent à -3,9 dB ; le pied de l'écran dit sa valeur. Il ne touche ni le MM-BASS, ni le MM-ARP, ni le volume du site.",
    },
  },
  tempo: {
    section: 'TEMPO',
    title: 'TEMPO',
    text: "Le tempo de tout le studio, de 100 à 150 BPM : le MM-BASS et le MM-ARP le suivent. Il est dans l'écran, en haut à droite, à côté du i. Il se règle au potard A de la page TEMPO (FUNC + TRIG ; B y est le SWING), ou au potard B du MIXER MASTER (FUNC + MOD, puis MOD) : glisse-le vers le haut pour accélérer (Maj : plus fin), sa molette va de 1 BPM, deux clics le remettent à 130. Sur la page TEMPO, chaque tape sur YES est un TAP : après 4 tapes, le tempo suit leur moyenne, arrondie au BPM. Pendant le SYNC du MIXER (MM-DECKS), il suit le tempo de la platine MASTER (124.4 SYNC à l'écran). Le DELAY suit ce tempo.",
    phone: {
      text: "Le tempo de tout le studio, de 100 à 150 BPM : le MM-BASS et le MM-ARP le suivent. Il est dans l'écran, en haut à droite, à côté du i (sur HOME et dans la vue PAGE) : son nombre et sa course dessous. Glisse-le vers le haut pour accélérer (100 px = 50 BPM), il se cerne tant que tu le tiens ; deux tapes le remettent à 130 ; le pied de l'écran dit TEMPO 128 BPM. Pendant le SYNC du MIXER (MM-DECKS), il suit le tempo de la platine MASTER : l'écran le dit au dixième (124.4 SYNC), et le TEMPO glissé revient à celui des platines tant que le SYNC le mène. Le DELAY suit ce tempo (TIME, sur sa page de GLOBAL FX).",
    },
    tip: '118 à 124 BPM pour l’indie dance et la dark disco, 124 à 128 pour le minimal et la house, 130 et plus pour la techno.',
  },

  /* ---------- l'ecran ---------- */
  screen: {
    section: 'SCREEN',
    title: 'SCREEN',
    text: "La vue PAGE, l'éditeur ; il ne se touche pas, il montre ce que font les potards et les touches. En haut, la page en pastille (TRIG, SRC, FLTR, AMP, FX, MOD, et TEMPO, SEND FX ou MIXER quand c'est la leur) et ses onglets, la voix, le pattern, MASTER et TEMPO et le i des INFOS (I au clavier) ; en P-LOCK, l'en-tête passe en négatif (P-LOCK STEP 05) et compte les verrous. Puis les blocs : chacun avec sa valeur de 0 à 127, son unité et son petit dessin, à la place de son potard à droite de l'écran ; deux clics sur le potard le remettent à son départ, une tape ouvre ce qu'ouvrait le bloc (la page d'un FX, la liste des sons sur SOUND). Dessous, les 16 pas de la voix et la tête de lecture. PTN deux fois de suite ouvre KIT, les presets ; la touche de page allumée passe à son onglet suivant, ou montre HOME (H).",
    phone: {
      text: "La vue PAGE, l'éditeur. En haut, la page en pastille et ses onglets, la voix, le pattern, MASTER et TEMPO (à glisser) et le i des INFOS ; en P-LOCK, l'en-tête passe en négatif (P-LOCK STEP 05) et compte les verrous. Puis les blocs (SOUND en grand, l'enveloppe dessinée sur trois cases), chacun avec sa valeur de 0 à 127 (de -64 à +63 pour un réglage centré, le nom du cran pour un choix), son unité et son petit dessin. Glisse un bloc de haut en bas pour le régler (environ 150 px pour toute la course, il se cerne tant que tu le tiens), deux tapes le remettent à son départ. Dessous, les 16 pas de la voix et la tête de lecture. Les huit encodeurs sous l'écran règlent les FX globaux. Le reste de l'en-tête ouvre les presets ; la touche de page allumée passe à son onglet suivant, ou montre HOME.",
    },
  },
  presets: {
    section: 'SCREEN',
    title: 'PRESETS',
    text: "KIT, les presets du MM-RYTM : PTN deux fois de suite (les patterns, puis KIT ; PTN plus tard referme les patterns), ou P au clavier. Une liste, tes presets (MIKA/DEEP KICK) puis ceux d'usine : un potard la fait défiler (les flèches aussi), rien ne se charge avant LOAD. Cinq touches de la face font ce que l'écran écrit, le nom de la touche au-dessus de chaque case : SRC LOAD, FLTR SAVE (la première fois ton nom de 4 lettres et celui du preset, jusqu'à 10 ; sur un preset à toi chargé, OVERWRITE ou AS NEW), AMP NAME, FX DEL (puis YES), PTN EXIT. YES valide (LOAD, OVERWRITE, YES, OK), NO revient en arrière. Pour nommer, tape au clavier, ou le potard A choisit la lettre et B déplace le curseur. Une étoile : le preset chargé a bougé.",
    phone: {
      text: "Les presets du MM-RYTM : une liste, tes presets (MIKA/DEEP KICK) puis ceux d'usine. La moitié gauche ou droite du haut de l'écran passe au précédent ou au suivant, rien ne se charge avant LOAD. En bas : LOAD, SAVE (la première fois ton nom de 4 lettres et celui du preset, jusqu'à 10 ; sur un preset à toi chargé, OVERWRITE ou AS NEW), NAME, DEL (puis YES) et EXIT. Une étoile : le preset chargé a bougé.",
    },
  },
  seek: {
    section: 'SCREEN',
    title: 'TRACK',
    text: "La piste SoundCloud en cours, dans le pied de l'écran : touche la barre à l'endroit où tu veux reprendre la piste.",
  },
  ikey: {
    section: 'SCREEN',
    title: 'INFOS',
    text: "Allume l'aide : survole n'importe quelle commande du MM-RYTM (au doigt, touche-la : sa carte s'affiche, la commande n'agit pas) pour lire ce qu'elle fait ; un potard montre le réglage qu'il tient sur la page, pour la voix choisie. I au clavier l'allume et l'éteint (l'écran ne se touche pas : son i dit seulement que c'est allumé, il se remplit), la croix de la pastille INFOS ou Échap l'éteignent. Au téléphone, le i du Dock fait de même.",
    phone: {
      text: "Allume l'aide : touche n'importe quelle commande du MM-RYTM, sa carte s'affiche et la commande n'agit pas ; un glisser règle toujours une valeur de l'écran. Un bloc de l'écran montre le réglage qu'il tient, pour la voix choisie. Le i se remplit tant que c'est allumé ; touche-le encore ou la croix de la pastille INFOS pour l'éteindre. Le i du Dock fait de même.",
    },
  },
  home: {
    section: 'SCREEN',
    title: 'HOME',
    text: "L'écran de départ : en haut, le pattern, MASTER et TEMPO ; l'anneau des pas de la voix et ses cartes (VOLUME, TONE, DECAY) ; en bas, son menu, celui des touches : SRC, FLTR, AMP et FX ouvrent leur page en vue PAGE, SOUND est le potard A de SRC (une tape ouvre la liste des sons, une voix choisie d'abord ; FUNC + SRC aussi). La touche allumée d'une page sans onglet (ou H) y revient, une touche de page ramène la vue PAGE ; sa LED reste rouge faible.",
    phone: {
      text: "L'écran de départ : en haut, le pattern, MASTER et TEMPO (à glisser, comme dans la vue PAGE) ; l'anneau des pas de la voix et ses cartes (VOLUME, TONE, DECAY) ; en bas, son menu : SOUND ouvre la liste des sons de la voix (une voix choisie d'abord), VOICE, FLTR, ENV et FX ouvrent leur page et ses valeurs à glisser. La touche allumée d'une page sans onglet y revient ; sa LED reste à peine allumée.",
    },
  },
  enc: {
    section: 'SCREEN',
    title: 'EMPTY',
    text: "Une case vide de cet écran : rien à régler ici pour cette voix. Les blocs se règlent en les glissant de haut en bas, ou à la molette ; deux clics les remettent à leur départ (en P-LOCK, le verrou s'en va). Au MIDI, rytm:knob:1 à 8 sont les blocs A à H de l'écran affiché.",
  },
} satisfies Partial<Record<RytmInfoId, Raw>>;
