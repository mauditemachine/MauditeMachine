/** Les cartes INFOS du MM-RYTM : TRK, SCENE A et B, les touches de la face V.5.0 (deplacees telles quelles de la table RAW de rytm/infos.ts en P0, 2026-10-30). */

import { type RytmInfoId } from '../diagrams';
import type { Raw } from './types';
import { PHONE } from './words';

export const RAW_FACE = {
  /* ---------- TRK, la touche des voix (2026-10-27, la phase 2, Mika : "comme la DIGITAKT") ---------- */
  trk: {
    section: 'KEYS',
    title: 'TRK',
    text: "La touche des voix, comme sur une Digitakt, la deuxième de la rangée (après FUNC). Tiens TRK et touche un pas de 1 à 8 : il choisit sa voix, BD SD CH OH CP TOM HT CY (le nom imprimé sur le pas), sans un son ; l'écran et les huit potards passent à elle. Une tape sur TRK la garde allumée jusqu'au choix d'une voix (une seule main suffit, à la souris) ; une autre tape, NO, Échap ou une touche A à V l'éteint. Les pas 9 à 16 ne font rien avec TRK. TRK passe avant PTN, REC et le P-LOCK. Deux tapes rapides sur le même pas (ou un clic droit) coupent sa voix ou la rendent. La vue TRK : la voix choisie en rouge plein, les autres en rouge faible, une voix coupée à peine ; un flash blanc à chaque coup. FUNC + TRK : MUTE, le mode mute global (les pas 1 à 8 sont les voix : vert, elle joue ; éteint, coupée ; une tape bascule ; tenue 400 ms, SOLO en blanc) ; FUNC + TRK encore : le mute du pattern (magenta), gardé avec le pattern ; encore : la sortie (NO ou Échap aussi), les mutes restent. Une voix est coupée si l'un des deux jeux la coupe.",
    phone: { text: "La touche des voix, comme sur une Digitakt : la première de la rangée, TRK écrit dessus. Tiens TRK et touche un pas de 1 à 8 : il choisit sa voix, BD SD CH OH CP TOM HT CY (le nom imprimé sur le pas), sans un son, même à l'arrêt ; l'écran et les huit potards passent à elle. Une tape sur TRK la garde allumée jusqu'au choix d'une voix (une seule main suffit, à la souris) ; une autre tape, Échap ou une touche A à V l'éteint. Les pas 9 à 16 ne font rien avec TRK (réservés). TRK passe avant EDIT et le P-LOCK : EDIT ouvert, un pas choisit quand même sa voix et EDIT reste ouvert. Deux tapes rapides sur le même pas (ou un clic droit) coupent sa voix ou la rendent, sans la choisir ; une voix coupée reste à peine allumée avec une barre rouge, une voix en solo a une barre bleue. Les huit carrés sont de la même couleur, la voix choisie plus forte ; pendant la lecture, chacun flashe à l'instant où sa voix frappe (une voix coupée ne flashe pas). En mode SOLO ou MUTE, le pas met sa voix en solo ou la coupe. Au clavier : Tab jusqu'à TRK, Espace ou Entrée la garde, puis Entrée sur un pas. Au Roto-Control (RSEQ), TRK allumée, les huit boutons choisissent les huit voix." },
    tip: "Une tape sur TRK, puis le pas 2 : SD est choisie, les potards règlent la caisse claire ; une tape encore, puis le pas 3 : le charley, sans quitter la page.",
  },

  /* ---------- SCENE A et B (2026-10-27, la phase 2) ; le crossfader, visible et inerte jusqu'a P2-20 ---------- */
  scene: {
    section: 'SCENES',
    title: 'SCENE A / B',
    text: "Deux scènes de réglages par pattern, comme sur un Octatrack. Tiens SCENE A (ou B) et tourne un potard (ou un potard MIDI) : la valeur va dans la scène, jamais dans le son de base ; lâche, c'est fini. Une tape garde la scène armée (sa touche allumée en bleu, son cadre clignote) jusqu'à une autre tape, NO, Échap ou FUNC + ▶ (CLEAR). Pendant ce temps les anneaux montrent la scène : clair, un réglage déjà dans la scène ; à moitié, un réglage qui s'y mettra au premier cran ; à peine, ce qui n'entre pas dans une scène (SOUND, les choix de son, les TWEAKS pour l'instant). TEMPO, MASTER, les mutes et PLAY restent ceux de toujours. Un pas tenu (● REC allumé) gagne : le potard pose son P-LOCK. Deux clics ou Suppr sur un potard retirent sa valeur de la scène ; une scène armée, FUNC + ▶ (CLEAR) la vide, l'autre reste ; sans scène armée et REC éteint, FUNC + ▶ vide les deux avec le pattern. Une scène garde 64 réglages au plus ; elle vit avec son pattern (A01 a les siennes, A02 les siennes). Son témoin bleu s'allume quand elle a des valeurs. Sans scène armée, un potard tourne toujours ce qu'on entend : sur un réglage que la scène qui joue a gardé (la scène A, crossfader au repos à gauche), il règle cette scène ; crossfader entre les deux, A, B et le son de base bougent ensemble.",
    phone: { text: "Deux scènes de réglages par pattern, comme sur un Octatrack. Tiens SCENE A (ou B) et tourne un potard, un bloc de l'écran ou un potard MIDI : la valeur va dans la scène, jamais dans le son de base ; lâche, c'est fini. Une tape garde la scène armée (sa touche allumée, son cadre clignote) jusqu'à une autre tape, Échap ou CLEAR. Pendant ce temps les anneaux montrent la scène : clair, un réglage déjà dans la scène ; à moitié, un réglage qui s'y mettra au premier cran ; à peine, ce qui n'entre pas dans une scène (SOUND, les choix de son, les TWEAKS pour l'instant). TEMPO, MASTER, les mutes et RUN restent ceux de toujours. Un pas tenu gagne : le potard pose son P-LOCK. Deux tapes ou Suppr sur un potard retirent sa valeur de la scène ; SCENE + CLEAR vide la scène armée, l'autre reste ; CLEAR seul vide les deux avec le pattern. Une scène garde 64 réglages au plus ; elle vit avec son pattern (A01 a les siennes, A02 les siennes). Son témoin s'allume quand elle a des valeurs. Sans scène armée, un potard tourne toujours ce qu'on entend : sur un réglage que la scène qui joue a gardé (la scène A, crossfader au repos à gauche), il règle cette scène ; crossfader entre les deux, A, B et le son de base bougent ensemble." },
    tip: PHONE ? "Page GLOBAL FX : tiens SCENE B, monte DELAY et REVERB, lâche. La scène B a deux réglages ; le crossfader les fera entendre." : "Page SEND FX (FUNC + FX) : tiens SCENE B, monte DELAY et REVERB, lâche. La scène B a deux réglages ; le crossfader les fera entendre.",
  },
  xfade: {
    section: 'SCENES',
    title: 'CROSSFADER',
    text: "De la scène A (à gauche) à la scène B (à droite), comme sur un Octatrack : glisse le capuchon (il part d'où il est, rien ne saute ; Maj, dix fois plus fin) ou tourne la molette au-dessus de la fente (un cran, 1 sur 127). Chaque réglage d'une scène va en douceur de sa valeur A à sa valeur B ; un réglage dans une seule scène part de sa valeur de base. Les anneaux montrent ce qu'on entend et, en lueur, la bande entre A et B ; les blocs de l'écran portent un coin A, B ou AB ; le pied dit A [---|---] B. Les témoins de SCENE A et B disent combien on entend de chacune. Rien ne s'enregistre : le crossfader revient à A à chaque visite, il ne touche ni le pattern, ni UNDO. Au clavier : Tab jusqu'au crossfader, puis les flèches, Page haut et bas, Début et Fin.",
    tip: "Scène A vide, scène B avec DELAY et REVERB montés : pousse le crossfader pendant que ça joue, l'écho et l'espace arrivent ; reviens à gauche, le son sec revient.",
  },

  /* ---------- V.5.0 (2026-10-29) : les touches de la face facon Digitakt du desktop ---------- */
  func: {
    section: 'KEYS',
    title: 'FUNC',
    text: "La touche des fonctions secondaires, comme sur une Digitakt : son capuchon orange, et sous chaque touche de la rangée, sa fonction imprimée en orange. Une tape sur FUNC la garde pour la touche suivante (sa LED blanche clignote), puis elle se relâche ; tiens-la, elle reste tant que tu la tiens ; deux tapes rapides la gardent jusqu'à une nouvelle tape (NO ou Échap la relâchent aussi). FUNC + TRK : MUTE ; + PTN : BANK ; + ● : COPY ; + ▶ : CLEAR ; + ■ : PASTE ; + TRIG : TEMPO ; + SRC : SOUNDS ; + FLTR : SETUP ; + AMP : EUCLID ; + FX : SEND FX ; + MOD : MIXER ; + YES : SAVE ; + NO : RELOAD. REC éteint, FUNC + un pas de 1 à 8 coupe sa voix ou la rend ; ● REC allumé, FUNC + un pas pose ou enlève un lock trig.",
    key: 'Alt (Option) tenu',
    tip: 'FUNC + YES avant de tout casser, FUNC + NO pour tout retrouver.',
  },
  rec: {
    section: 'KEYS',
    title: '● REC',
    text: "Le mode écriture des pas, sa LED rouge. REC allumé : une tape sur un pas le pose (à la vélocité des nouveaux pas, HIGH au départ) ou le retire ; tiens un pas et glisse : sa vélocité ; tiens-le sans bouger : P-LOCK. REC éteint : un pas de 1 à 8 joue sa voix et la choisit, rien ne s'écrit (les pas montrent toujours le motif de la voix choisie et la tête de lecture) ; 9 à 16 ne jouent rien. REC n'est pas gardé : il est éteint à chaque visite. ● tenue + ▶, ou ● deux fois vite : LIVE REC, l'enregistrement en direct (sa LED clignote). TRK, PTN et le mode MUTE passent avant lui. FUNC + REC : COPY (REC éteint, le pattern entier, ses verrous, ses scènes et son mute ; REC allumé, la ligne de la voix choisie).",
    key: 'W',
    tip: 'REC éteint, les pas 1 à 8 sont huit pads : trouve le son ; REC allumé, écris-le.',
  },
  stop: {
    section: 'KEYS',
    title: '■ STOP',
    text: "Arrête la lecture et revient au pas 1 (une pause est oubliée). Deux fois en moins de 600 ms : l'arrêt, et les queues de la REVERB et du DELAY s'effacent en un fondu court. FUNC + STOP : PASTE, ce que FUNC + ● a copié (un pattern remplace le pattern courant, une ligne celle de la voix choisie ; une étape d'UNDO ; rien de copié : NOTHING TO PASTE).",
    key: 'Maj + Espace',
  },
  yes: {
    section: 'KEYS',
    title: 'YES',
    text: "Valider, comme sur une Digitakt. Dans KIT (les presets) : LOAD, OVERWRITE, YES ou OK, selon l'écran. Après une touche de page (dans les 1,5 s) : cette page au hasard, dans des bornes musicales (SRC : le son, le niveau et la hauteur de la voix choisie ; FLTR, AMP et FX : leurs réglages ; SEND FX, TEMPO, MIXER) ; TRIG puis YES : un beat au hasard, sons compris (l'ancien RANDOM). Sur la page TEMPO : chaque tape est un TAP, le tempo suit après 4 tapes. Tenu plus d'un quart de seconde (hors KIT et TEMPO) : FILL tant que tu le tiens, jamais le hasard. FUNC + YES : SAVE, un point de sauvegarde en mémoire (pas, verrous, scènes, mute du pattern, FX, voix, kit) ; l'écran dit SAVED A01.",
    key: 'Entrée',
    tip: 'TRIG puis YES jusqu’à ce qu’un groove accroche, puis FUNC + YES pour le garder sous la main.',
  },
  no: {
    section: 'KEYS',
    title: 'NO',
    text: "Retour, comme Échap : ferme ce qui est ouvert (une FUNC gardée, KIT, la liste des sons, TRK, une scène, le P-LOCK, le mode MUTE, la grille PTN, la page d'un FX), puis le capot, puis la voix choisie. Après une touche de page (dans les 1,5 s) : cette page revient au point de sauvegarde (FUNC + YES). FUNC + NO : RELOAD, tout revient au point de sauvegarde, une étape d'UNDO ; sans point, l'écran dit NOTHING SAVED.",
    key: 'Échap',
  },
  ptrig: {
    section: 'PAGES',
    title: 'TRIG',
    text: "La page des coups de la voix choisie, en deux onglets (TRIG rappuyé passe de l'un à l'autre). TRIG 1/2 : A NOTE (sa hauteur au demi-ton, de -24 à +24), B VEL (la vélocité des nouveaux pas ; en P-LOCK, celle du pas), C LEN (la durée du coup), D PROB (sa probabilité), E COND (sa condition : 1:2, FILL, PRE...), F μTIME (un coup un peu avant ou après la grille), G LFO.T (le coup relance les LFO de la voix). TRIG 2/2 : le retrig (RTRG, RATE, VFAD, RLEN). Sans pas tenu, ces réglages valent pour tous les coups de la voix dans ce pattern (A01 a les siens, A02 les siens) ; un pas tenu, ● REC allumé : son P-LOCK, ce pas seulement. TRIG puis YES (dans les 1,5 s) : un beat au hasard pour toutes les voix, sons compris. FUNC + TRIG : la page TEMPO (A BPM, B SWING ; YES y tape le tempo).",
    tip: 'PROB à 70 % sur les charleys et 1:2 sur un clap de fin de mesure : le groove respire sans que tu touches à rien.',
  },
  ptrig2: {
    section: 'PAGES',
    title: 'TRIG 2/2',
    text: "Le retrig de la voix choisie, comme sur une Digitakt : A RTRG (OFF ou ON), B RATE (la vitesse des répétitions, de 1/1 à 1/80 de mesure : 1/16 fait un coup par pas, 1/32 deux), C VFAD (la vélocité des répétitions descend ou monte jusqu'au bout), D RLEN (la durée du retrig, de 1/16 de pas à 16 pas, ou INF : jusqu'au prochain coup de la voix). Chaque répétition est un coup de la même voix, avec les mêmes verrous ; elle coupe la précédente, une voix à la fois. Les répétitions s'arrêtent au prochain coup de la voix, à la fin de RLEN ou si tu coupes la voix.",
    tip: 'Une caisse claire en fin de mesure, RTRG ON, RATE 1/32, RLEN 4, VFAD +40 : le roulement qui monte vers le temps 1.',
  },
  pmod: {
    section: 'PAGES',
    title: 'MOD',
    text: "Les deux LFO de la voix choisie : MOD 1/2 le LFO 1, MOD 2/2 le LFO 2 (MOD rappuyé passe de l'un à l'autre). Chacun : A SPD (sa vitesse, négative à l'envers), B MULT (x1 à x128), C FADE (sa profondeur qui monte ou descend depuis le coup), D DEST (ce qu'il module : PITCH, FREQ, RESO, VOL, PAN, DIST, DELAY, REVERB, TONE, DECAY), E WAVE (sa forme), F PHAS (où il démarre), G MODE (FRE libre, TRG relancé à chaque coup, HLD tenu au coup, ONE un seul cycle, HLF un demi), H DEP (sa profondeur ; à 0, rien). Il suit le tempo et la position, comme la Digitakt. PITCH, FREQ, RESO, VOL et PAN bougent pendant que le coup sonne ; DIST, DELAY, REVERB, TONE et DECAY sont pris au moment du coup. Ce sont des réglages de la voix : gardés avec les presets et l'UNDO, verrouillables pas par pas, pas encore dans les scènes. MOD puis YES : le LFO affiché au hasard. FUNC + MOD : le MIXER, 1/2 LEVELS (A à H : le volume de BD SD CH OH CP TOM HT CY) puis 2/2 MASTER (A MASTER, B TEMPO) ; FUNC + MOD encore, ou MOD sur le MIXER, passe à l'onglet suivant. MIXER puis YES : les niveaux au hasard.",
    tip: 'LFO 1 sur FREQ, WAVE TRI, SPD 8, DEP +30 sur les charleys : le filtre respire sur une mesure.',
  },
  locktrig: {
    section: 'STEPS',
    title: 'LOCK TRIG',
    steps: [
      '● REC allumé, FUNC + un pas : un lock trig, le pas s\'allume en jaune, sans note.',
      'Tiens-le et tourne un potard (VOL, PAN, FREQ, RESO, les envois) : le verrou se pose sur ce pas.',
      'Le coup de la voix qui sonne encore à ce moment prend ces valeurs.',
    ],
    text: "Un trig qui ne joue pas, comme sur une Digitakt : ses verrous changent le coup de la voix qui sonne encore quand le séquenceur passe dessus. Ce que le moteur change en direct : VOL, PAN, la fréquence et la résonance du filtre (FREQ, RESO), les envois DELAY et REVERB, DIST et CHORUS de la voix. Avec LFO.T ON (son départ), il relance aussi les LFO de la voix. FUNC + un lock trig l'enlève, avec ses verrous ; FUNC + un pas qui joue le transforme en lock trig (ses verrous restent) ; une tape l'enlève aussi. Hors REC, FUNC + un pas garde le mute rapide de sa voix.",
    tip: 'Une cymbale longue sur 1, un lock trig sur 9 avec VOL bas : elle s\'éteint au milieu de la mesure, sans nouveau coup.',
  },
  liverec: {
    section: 'KEYS',
    title: 'LIVE REC',
    steps: [
      '● tenue puis ▶ (ou ● deux fois vite à la souris) : LIVE REC, la LED de ● clignote ; à l\'arrêt il s\'arme, ▶ lance la lecture.',
      'Tape les pas 1 à 8 (ou les touches A S D F, Z X C V, les pads MIDI) pendant que ça tourne : chaque frappe joue sa voix, la choisit et s\'écrit au pas le plus proche, dans le pattern que tu entends.',
      "Tourne un potard d'une page de voix : tant que tu le tournes, il s'enregistre en P-LOCK de la voix choisie sur les pas que traverse la tête de lecture (un pas vide reçoit un lock trig).",
    ],
    text: "L'enregistrement en direct, comme sur une Digitakt. Les frappes se rangent sur le pas le plus proche de ce que tu entends (pas de μTIME). Une frappe juste avant son pas ne le rejoue pas tout de suite : tu l'entends au passage suivant ; sur un pas qui joue déjà la voix, elle ne la double pas. Une voix coupée s'enregistre quand même. Un pas 1 à 8 y est un pad : pas de P-LOCK ni de vélocité au glisser. NO tenue (Échap au clavier) + un pad : sa voix s'efface au fil de la tête de lecture, tant que tu tiens. ▶ sort de LIVE REC sans arrêter la lecture, ● repasse en grid rec, ■ arrête tout. Une prise, de l'entrée à la sortie, se défait d'un UNDO par pattern touché, et la chaîne continue. TRK tenue (CONTROL ALL) gagne : rien ne s'écrit ; TRK + un pad choisit sa voix sans l'écrire.",
    key: 'W tenue + Espace',
    tip: 'Tape le kick sur les temps pendant que ça tourne, puis le clap sur 5 et 13 : le beat s\'écrit tout seul.',
  },
  bank: {
    section: 'KEYS',
    title: 'BANK',
    steps: [
      'FUNC + PTN : les pas 1 à 8 deviennent les banques A à H.',
      'Touche une banque : la grille PTN montre ses 16 patterns.',
      'Touche un pas : son pattern joue (en lecture, à la mesure).',
    ],
    text: "Les huit banques de patterns, comme sur une Digitakt : A à H, 16 patterns chacune, 128 en tout (A01 à H16). La banque du pattern qui joue est en rouge plein, une banque qui a des patterns en blanc faible, une vide éteinte ; celle que tu regardes clignote si ce n'est pas celle qui joue. Une chaîne peut mêler les banques (A02 > C05). PTN, NO ou Échap referment la vue BANK.",
    tip: 'Range un morceau par banque : A pour le set de vendredi, B pour les essais.',
  },
  ctlall: {
    section: 'KEYS',
    title: 'CONTROL ALL',
    steps: [
      'Tiens TRK (ou une tape pour la garder).',
      "Tourne un potard d'une page de voix (TRIG, SRC, FLTR, AMP, FX, MOD) : les huit voix prennent la même valeur.",
      'NO avant de lâcher TRK : chaque voix retrouve sa valeur d\'avant.',
    ],
    text: "Comme sur une Digitakt : TRK tenue et un potard tourné, le réglage change sur les huit voix, l'en-tête dit CONTROL ALL. Elles prennent toutes la valeur de la voix choisie. NO avant de lâcher TRK annule tout le geste ; un UNDO défait un CONTROL ALL entier en une fois. Un pas tenu (P-LOCK) gagne, comme d'habitude. Le son lui-même et les réglages de la machine de synthèse (différents d'une voix à l'autre) restent sur la voix choisie. Les potards de MASTER, TEMPO, SEND FX, MIXER et KIT ne sont pas concernés. Une tape sur TRK la garde : elle le reste après le geste, jusqu'à une autre tape sur TRK, le choix d'une voix ou Échap (qui annule, comme NO).",
    tip: 'TRK et FLTR FREQ vers le bas : tout le kit se ferme d\'un coup avant le drop, NO si tu changes d\'avis.',
  },
  fill: {
    section: 'KEYS',
    title: 'FILL',
    text: "Le mode FILL, comme sur une Digitakt : tiens YES plus d'un quart de seconde, sans menu ouvert (ni KIT, ni la page TEMPO) : FILL tant que tu le tiens, l'en-tête de l'écran le dit. Les coups à condition FILL ne jouent qu'en FILL, ceux à !FILL se taisent en FILL. Une tape courte sur YES garde son effet de toujours (une page au hasard après une touche de page) ; une tenue n'en déclenche jamais. Au clavier : Entrée tenue. Au MIDI : rytm:fill, une note tenue.",
    key: 'Entrée tenue',
    tip: 'Un roulement de toms en FILL sur la dernière mesure : tiens YES juste avant le changement de section.',
  },
  'q:len': {
    section: 'TRIG',
    title: 'LEN',
    text: "La durée du coup : 1/16, 1/8, 1/4 ou 1/2 pas, puis 1, 1,5, 2, 3, 4, 6, 8 ou 16 pas, ou INF. À INF (le départ) rien ne change, le coup sonne jusqu'au bout de son son ; sinon il est coupé à LEN par un relâchement court (8 ms). Les queues déjà envoyées à la REVERB et au DELAY continuent.",
    lock: 'yes',
    tip: 'Un charley ouvert à LEN 1 : il s\'arrête net sur le pas suivant, sans fermer le charley.',
  },
  'q:prob': {
    section: 'TRIG',
    title: 'PROB',
    text: "La probabilité que le coup joue, de 0 à 100 % (100 : toujours, le départ ; 0 : jamais). Chaque passage tire au sort à nouveau. Une COND autre que NONE passe avant : PROB ne compte que quand COND est NONE. Un pas à PROB porte un petit point jaune au coin.",
    lock: 'yes',
    tip: 'Des charleys à 60 % : un minimal qui ne se répète jamais tout à fait.',
  },
  'q:cond': {
    section: 'TRIG',
    title: 'COND',
    text: "La condition du coup. NONE : toujours (le départ). FILL : seulement en tenant YES ; !FILL : seulement hors FILL. PRE : si la dernière condition de cette voix était vraie ; !PRE, si elle était fausse. NEI : si celle de la voix d'avant (BD pour SD, SD pour CH...) était vraie ; BD n'a pas de voisine. 1ST : au premier passage du pattern depuis son lancement ; LST : au dernier passage avant un changement de pattern prévu. A:B : au passage A d'un cycle de B, par exemple 1:2 un passage sur deux, 4:4 le quatrième d'un cycle de quatre ; !A:B, les autres. Le compteur de passages repart à 1 au lancement et à chaque changement de pattern ; la pause le garde, STOP le remet à 1. Une COND passe avant PROB ; une PROB tirée compte aussi comme résultat pour PRE et NEI. Un pas à COND porte un petit point jaune au coin.",
    lock: 'yes',
    tip: 'Un crash à 1:4 sur le pas 1 : une fois toutes les quatre mesures, sans faire quatre patterns.',
  },
  'q:utime': {
    section: 'TRIG',
    title: 'μTIME',
    text: "Le coup un peu avant ou après la grille, de -23/384 à +23/384 de mesure (1/24 de pas chacun), comme la Digitakt ; 0 : sur la grille. À l'écran le compte (-12, +6) ; l'unité dit /384 et le décalage en ms au tempo du moment. Un coup en avance sur le pas 1 tombe à la fin de la mesure d'avant.",
    lock: 'yes',
    tip: 'La caisse claire à +6/384 : elle traîne, la dark disco.',
  },
  'q:lfot': {
    section: 'TRIG',
    title: 'LFO.T',
    text: "LFO TRIG : ON (le départ), le coup relance les LFO de la voix dont le MODE est TRG, ONE ou HLF (HLD prend sa valeur) ; OFF, ils continuent sans repartir. Un lock trig relance aussi les LFO quand son LFO.T est ON.",
    lock: 'yes',
  },
  'q:rtrg': {
    section: 'TRIG',
    title: 'RTRG',
    text: "Le retrig : ON, le coup se répète à RATE pendant RLEN, la vélocité menée par VFAD ; OFF (le départ), un seul coup. Chaque répétition est un coup de la même voix, avec les mêmes verrous ; elle coupe la précédente. Elles s'arrêtent au prochain coup de la voix, à la fin de RLEN, ou si tu coupes la voix.",
    lock: 'yes',
    tip: 'Un seul pas de caisse claire avec RTRG : le roulement sans dix coups à poser.',
  },
  'q:rate': {
    section: 'TRIG',
    title: 'RATE',
    text: "La vitesse des répétitions du retrig, en fraction de mesure : 1/1, 1/2, 1/3, 1/4, 1/5, 1/6, 1/8, 1/10, 1/12, 1/16 (un coup par pas, le départ), 1/20, 1/24, 1/32 (deux par pas), 1/40, 1/48, 1/64, 1/80. Les triolets (1/12, 1/24, 1/48) roulent hors de la grille.",
    lock: 'yes',
  },
  'q:vfad': {
    section: 'TRIG',
    title: 'VFAD',
    text: "La vélocité des répétitions, de -64 à +63 : négative, elles s'éteignent jusqu'à la fin de RLEN (-64 : jusqu'au silence) ; positive, elles montent jusqu'à la vélocité du coup ; 0 (le départ) : toutes pareilles.",
    lock: 'yes',
  },
  'q:rlen': {
    section: 'TRIG',
    title: 'RLEN',
    text: "La durée du retrig : de 1/16 de pas à 16 pas, ou INF (jusqu'au prochain coup de la voix). Le départ : 1 pas. VFAD se mesure sur RLEN (une mesure à INF).",
    lock: 'yes',
  },
  'lfo:spd': {
    section: 'MOD',
    title: 'SPD',
    text: "La vitesse du LFO, de -64 à +63 : avec MULT, un cycle dure 128 / (SPD x MULT) pas ; SPD 8 et MULT x1 : une mesure ; 32 et x1 : un temps (le départ). Négative, la forme passe à l'envers ; 0 : immobile, à sa phase.",
    lock: 'yes',
  },
  'lfo:mul': {
    section: 'MOD',
    title: 'MULT',
    text: "Le multiplicateur de la vitesse : x1, x2, x4, x8, x16, x32, x64, x128. L'unité dit la durée d'un cycle au tempo du moment.",
    lock: 'yes',
  },
  'lfo:fad': {
    section: 'MOD',
    title: 'FADE',
    text: "La profondeur menée depuis le coup (en FRE, depuis PLAY) : négative, elle monte de 0 à DEP ; positive, elle descend de DEP à 0 ; -64 ou +63 en un pas, -1 ou +1 en 64 pas ; 0 (le départ) : pas de fondu.",
    lock: 'yes',
  },
  'lfo:dst': {
    section: 'MOD',
    title: 'DEST',
    text: "Ce que module le LFO : OFF (le départ, rien), PITCH (la hauteur, +/-12 demi-tons à fond), FREQ (la coupure du filtre, +/-5 octaves), RESO, VOL, PAN : en continu sur le coup qui sonne ; DIST, DELAY, REVERB, TONE, DECAY : pris au moment de chaque coup. FREQ et RESO posent le filtre de la voix s'il était ouvert.",
    lock: 'yes',
  },
  'lfo:wav': {
    section: 'MOD',
    title: 'WAVE',
    text: "La forme : TRI (triangle, le départ), SINE, SQR (carré), SAW (dent de scie), EXP (une montée exponentielle), RMP (une rampe qui descend), RND (une valeur au hasard par quart de cycle, une autre à chaque cycle ; relancé par un trig, il rejoue la même suite). Le bloc la dessine.",
    lock: 'yes',
  },
  'lfo:phs': {
    section: 'MOD',
    title: 'PHAS',
    text: "Où la forme démarre, de 0 à 127 (64 : la moitié du cycle). En TRG, ONE et HLF, chaque coup la relance à cette phase.",
    lock: 'yes',
  },
  'lfo:mod': {
    section: 'MOD',
    title: 'MODE',
    text: "FRE : libre depuis PLAY (le départ) ; TRG : relancé à chaque coup dont LFO.T est ON ; HLD : prend sa valeur au coup et la garde ; ONE : un seul cycle par coup, puis il reste ; HLF : un demi-cycle.",
    lock: 'yes',
  },
  'lfo:dep': {
    section: 'MOD',
    title: 'DEP',
    text: "La profondeur du LFO, de -64 à +63 ; négative, la forme est inversée ; 0 (le départ) : le LFO ne fait rien, aucun calcul, le son d'avant.",
    lock: 'yes',
    tip: 'Commence petit (DEP 10 à 20) : un LFO sur PITCH se sent avant de s\'entendre.',
  },
  mixvol: {
    section: 'MIXER',
    title: 'VOL',
    text: "Le volume d'une voix sur le MIXER (FUNC + MOD) : A BD, B SD, C CH, D OH, E CP, F TOM, G HT, H CY, chacun à la place de son potard ; le même réglage que VOL sur SRC (rytm:voice:<voix>:level au MIDI), sans choisir la voix. Une scène armée le prend ; il ne se verrouille pas sur un pas (pour un pas plus doux, VOL sur SRC, en P-LOCK).",
    tip: 'Le kick d’abord, la référence ; puis monte chaque voix juste sous lui, sans quitter la page.',
  },
} satisfies Partial<Record<RytmInfoId, Raw>>;
