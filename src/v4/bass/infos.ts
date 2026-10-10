/**
 * Le contenu des INFOS du MM-BASS (2026-10-08, Mika : "dans le OPEN, un
 * bouton INFOS : quand je survole chaque parametre du BASS, j'ai un
 * descriptif qui vient dessus, du texte et meme une image, pour expliquer a
 * quoi ca sert et comment ca fonctionne"). Une carte par commande, en
 * francais (tutoiement, typo quebecoise : espace insecable avant le
 * deux-points et entre un nombre et son unite, apostrophe typographique ;
 * jamais de tiret cadratin) : sa section du panneau, son nom tel qu'il est
 * serigraphie, deux a quatre phrases, une astuce. Les dessins sont a
 * bass/diagrams.ts, la carte a bass/InfosCard.tsx.
 * Les ids : chaque potard (BassKnobId), chaque touche (BassKeyKind ; la
 * touche ACCENT s'appelle accentkey, accent est deja le potard), plus les
 * pas, les LOCK, l'ecran, INFOS et CLOSE sous le capot.
 * La machine Elektron (2026-10-08, Mika : "je veux un petit bouton i dans
 * l'ecran a activer et de ce fait on peut voir les infos au survol") : un
 * encodeur montre la carte du reglage qu'il tient sur la page allumee (enc
 * pour une case vide), les touches de page la leur, la touche "i" (ikey) la
 * sienne ; la section d'un reglage d'une page dit ou le trouver (FILTER B).
 * Au telephone, plus d'encodeurs (2026-10-09, Mika : "on change dans l'ecran
 * directement") : les cartes qui parlaient d'encodeurs parlent des blocs de
 * l'ecran (PHONE, par-dessus RAW), sans les touches du clavier (keys : le
 * raccourci, ajoute au texte au desktop seulement ; la revue du meme jour :
 * "Touche A." se lisait au telephone comme le bloc A).
 * L'etape 2 (2026-10-09, Mika : "quand on selectionne un step on rentre en
 * parameters lock ; les encoders ne servent qu'a faire les modifs des FX
 * globaux ; dans EDIT pouvoir editer la hauteur des notes a la souris ; je
 * ne vois pas ce que STYLE et DENSITY font") : les cartes disent ce qui est
 * vraiment la (une tape sur un pas = P-LOCK, l'ecran se regle a la souris
 * comme au doigt, les encodeurs = les FX globaux, VOLUME dans VOICE, AMP ENV
 * et son grand dessin, le rouleau d'EDIT, STYLE et DENSITY qui reecrivent
 * les notes du generateur et gardent les tiennes) ; la pastille P-LOCK de
 * l'ecran a sa carte (plock).
 * Le moteur MONARK (2026-10-09, Mika : "je veux vraiment un son a la MONARK
 * de Native Instruments !") : les cartes des dix-huit reglages du Minimoog
 * (le vocabulaire du Moog explique en une proposition : LOAD, EMPHASIS, les
 * pieds, le contour), celles des onglets (posc, pmix, pcontour : la puce de
 * l'en-tete, et pcontour le grand dessin du contour sur CONTOUR G H) ; les
 * cartes dont le sens change avec le MODE le disent (DRIVE, RESO, DECAY,
 * GLIDE, ACCENT, ENV MOD, KEY TRK, SUB) ; la section dit chaque ecran ou se
 * trouve le reglage (DECAY : FILTER D / FILTER CONTOUR C).
 * La face simple (2026-10-09, le soir, Mika : "mets les boutons ACCENT SLIDE
 * NOTE- NOTE+ OCT- OCT+ dans l'ecran, rajoute un bouton PRESET ; MUTATE je
 * comprends pas vraiment, enleve ca") : les cartes des six touches du pas
 * disent qu'elles sont en bas de l'ecran, PRESET a la sienne, plus aucune
 * carte de la face ne parle de MUTATE (sa carte dit le bouton du Roto).
 */

import { PORTRAIT } from '../theme';
import { BASS_FX_KNOBS, BASS_SCREENS, BASS_SCREEN_SLOTS, ENC_LETTERS, PAGE_TABS, SCREEN_LABEL, SCREEN_PAGE, bassPage, bassPageDef, isBassScreen, type BassScreenId } from './pages';
import { BASS_KNOBS, type BassKnobId } from './params';
import type { BassKeyKind } from './theme';

export type BassInfoId =
  | BassKnobId
  | Exclude<BassKeyKind, 'accent'>
  | 'accentkey'
  | 'trig'
  | 'lock'
  | 'screen'
  | 'infos'
  | 'close'
  | 'enc'
  | 'ikey'
  | 'plock'
  // Les onglets du moteur MONARK (2026-10-09) : OSC et MIX de VOICE, CONTOUR de FILTER (et son grand dessin)
  | 'posc'
  | 'pmix'
  | 'pcontour';

export interface BassInfo {
  /** la section du panneau (OSC, FILTER...), en petites capitales sur la carte */
  section: string;
  /** le nom serigraphie */
  title: string;
  text: string;
  tip?: string;
}

/** Une carte a la source : son raccourci clavier a part (keys, la fin du texte au desktop ; aucun au telephone). */
type RawInfo = BassInfo & { keys?: string };

/** Les espaces insecables du francais (Quebec) et l'apostrophe typographique. */
const fr = (s: string): string =>
  s
    .replace(/([A-Za-zÀ-ÿ])'([A-Za-zÀ-ÿ])/g, '$1’$2')
    .replace(/ :/g, ' :')
    .replace(/(\d) (ms|s|Hz|kHz|dB|dBFS|%|cents|octaves?|pas|mesures?|BPM)(?![A-Za-zÀ-ÿ])/g, '$1 $2')
    // Le point-virgule ne commence jamais une ligne (2026-10-09, la revue de la carte MODE) : une espace fine insecable
    .replace(/ ;/g, '\u202F;');

const RAW: Record<BassInfoId, RawInfo> = {
  /* ---------- GENERATOR (a cote de l'ecran) ---------- */
  // Les prises et NOTES (2026-10-09, Mika : "Je trouve Style et Density complexe a utiliser")
  style: {
    section: 'GENERATOR',
    title: 'STYLE',
    text: "Le genre de la ligne : ACID, DARK DISCO, INDIE DANCE, MINIMAL, PSY PROG, TECHNO, HOUSE, ELECTRO, EBM, ITALO ou SUB. Chaque cran joue tout de suite la ligne typique du style (sa prise 01, avec son nombre de notes) ; l'écran montre son nom et ses 16 pas en grand. Tes notes à toi et tes P-locks restent. STYLE change les notes, pas le son : le son, ce sont les pages VOICE, FILTER, ENV et FX.",
    tip: "Chaque style garde la prise où tu l'as laissé : d'ACID 07 à DARK DISCO 03 et retour, ACID 07 revient tel quel. Deux tapes sur STYLE : la ligne typique, prise 01.",
  },
  density: {
    section: 'GENERATOR',
    title: 'NOTES',
    text: "Le nombre de notes dans la mesure, de 0 à 16 : un cran, une note de plus ou de moins, toujours dans le même ordre (d'abord celles qui font le style, en dernier les ornements). Revenir au même cran rend exactement la même ligne. Tes notes à toi restent : NOTES ne descend pas sous leur nombre. À l'écran, le compte en grand et les 16 pas : en plein les notes, un point sur les tiennes, en pointillé celle qui viendra au cran suivant.",
    tip: "Descends à 0 pour un break, remonte : la ligne revient telle quelle. Deux tapes sur NOTES : le nombre de notes de la prise.",
  },
  gen: {
    section: 'GENERATOR',
    title: 'GEN',
    text: "Une nouvelle prise du même style, avec le même nombre de notes : ACID 07, puis ACID 08. Tes notes et tes P-locks restent. Tiens GEN une demi-seconde : la prise d'avant revient. Les premières prises de chaque style sont les lignes de ses presets d'usine, les suivantes viennent du générateur. Si rien ne joue, la ligne part.", keys: "Touche G (Maj + G : la prise d'avant).",
    tip: "Appuie jusqu'à ce qu'une ligne t'accroche, puis garde-la dans un pattern avec EDIT.",
  },
  // Plus sur la face (2026-10-09, le soir) : le bouton MUTATE du Roto-Control seulement
  mutate: {
    section: 'ROTO',
    title: 'MUTATE',
    text: "Le bouton MUTATE du Roto-Control : change 2 ou 3 notes de la machine (une hauteur, une octave, un accent, un slide, ou une note qui avance ou recule d'un pas). Le nombre de notes ne bouge pas, tes notes à toi non plus ; la prise prend une étoile (ACID 07*). Tiens-le : la dernière mutation s'annule.",
  },


  /* ---------- OSC ---------- */
  octave: {
    section: 'OSC',
    title: 'OCTAVE',
    text: "Décale toute la ligne d'une ou deux octaves. À -2, la tonique descend vers 23 Hz (fa dièse 0) : du vrai sub, à écouter sur un bon système.",
    tip: "0 ou -1 pour la dark disco, -2 pour les longues lignes SUB.",
  },
  wave: {
    section: 'OSC',
    title: 'OSC 1 WAVE',
    text: "La forme de l'oscillateur 1 : dent de scie à gauche (brillante, toutes les harmoniques), carré à droite (creux et rond), et entre les deux un fondu de l'une vers l'autre. Les oscillateurs 2 et 3 ont leurs six formes à eux (onglet OSC) ; les trois se mélangent sur l'onglet MIX.",
    tip: "Dent de scie pour l'acid et la basse Moog, carré pour l'italo et l'electro, vers 25 % pour une dark disco qui garde du mordant.",
  },
  sub: {
    section: 'OSC',
    title: 'SUB',
    text: "Ajoute un sinus propre une octave sous la note (deux avec SUB OCT), mélangé après le filtre et DRIVE : il reste plein même filtre fermé ou emphase au maximum, et ne sature jamais. En MODE 303, l'oscillateur baisse quand il monte, pour garder le niveau. La manière Moog, c'est plutôt OSC 3 en 32' (onglet OSC) : un sub qui passe dans le filtre avec le reste.",
    tip: "30 à 50 % en dark disco et en house pour le poids ; 0 en acid pour laisser parler le filtre.",
  },

  /* ---------- FILTER ---------- */
  cutoff: {
    section: 'FILTER',
    title: 'CUTOFF',
    text: "La fréquence où le filtre commence à couper les aigus, de 60 Hz à 6 kHz : à gauche sombre, à droite ouvert et brillant. La pente suit le MODE (24 dB par octave en LP24, le filtre en échelle du Moog ; la courbe de la 303 en 303). C'est le geste principal de la machine : glisse son bloc pendant que ça joue.",
    tip: "Basse Moog : vers 140 Hz avec ENV MOD vers 2,5 octaves. En acid (MODE 303), pars bas avec beaucoup d'ENV MOD et ouvre lentement sur 16 mesures.",
  },
  reso: {
    section: 'FILTER',
    title: 'RESO',
    text: "L'emphase (EMPHASIS sur le Moog) : renforce les fréquences autour de CUTOFF, un pic qui chante. Sur l'échelle (LP24 à BP), les graves s'amincissent un peu quand elle monte, comme sur un Moog ; tout en haut, le filtre siffle tout seul, à la hauteur de CUTOFF. En MODE 303, le pic de la 303 : les graves sous 150 Hz restent.",
    tip: "20 à 40 % pour une basse Moog ronde ; 60 à 85 % en 303 pour l'acid ; sinon la basse prend trop de place.",
  },

  /* ---------- ENVELOPE ---------- */
  envmod: {
    section: 'ENVELOPE',
    title: 'ENV MOD',
    text: "L'amplitude du contour du filtre (CONTOUR AMOUNT sur le Moog), jusqu'à 5 octaves autour de CUTOFF : c'est le wah de chaque note. Sur l'échelle, sa forme est celle de F.ATTACK, DECAY et F.SUSTAIN, son sens celui de POLARITY (onglet CONTOUR : il ouvre, ou il ferme) ; le bloc dit son signe. Une note accentuée va encore plus loin (le pointillé).",
    tip: "Beaucoup d'ENV MOD avec un CUTOFF bas, c'est la recette acid ; peu d'ENV MOD pour une basse dark disco ronde et régulière.",
  },
  decay: {
    section: 'ENVELOPE',
    title: 'DECAY',
    text: "Le temps que met le contour du filtre à redescendre. Sur l'échelle (LP24 à BP), de 10 ms à 2,5 s, vers F.SUSTAIN (onglet CONTOUR) : court pour des notes qui claquent, long pour des notes qui respirent. En MODE 303, de 120 ms à 2,5 s jusqu'en bas, et une note accentuée garde sa décroissance courte (ACC DECAY), comme sur la 303, sauf si DECAY est verrouillé sur son pas.",
    tip: "Moins de 250 ms en EBM et en psy prog, plus long en house.",
  },

  /* ---------- ACCENT / SLIDE ---------- */
  accent: {
    section: 'ACCENT / SLIDE',
    title: 'ACCENT',
    text: "La force des pas accentués (touche ACCENT, pas orange vif). Sur l'échelle, c'est une vélocité : la note sort plus fort, son contour va plus loin, et les accents qui se suivent chargent le filtre (SWEEP). En MODE 303, le circuit de la 303 : plus de volume, un filtre qui s'ouvre plus haut et plus court, le fameux wow. Verrouillé sur un pas sans accent, il lui donne l'accent.",
    tip: "Place-les sur les contretemps en acid ; à 0, les accents ne font plus rien.",
  },
  glide: {
    section: 'ACCENT / SLIDE',
    title: 'GLIDE',
    text: "La durée du glissement quand un pas a SLIDE : la note ne se relâche pas et sa hauteur glisse vers la suivante sans relancer le contour. Sur l'échelle, c'est le temps d'une octave (le GLIDE du Moog, à vitesse constante : un grand saut glisse plus longtemps qu'un petit), de 12 à 350 ms ; en MODE 303, un temps fixe, comme sur la 303.",
    tip: "30 à 60 ms pour l'acid, plus long sur une ligne SUB pour des basses qui coulent.",
  },

  /* ---------- OUTPUT ---------- */
  drive: {
    section: 'OUTPUT',
    title: 'DRIVE',
    text: "Sur l'échelle (LP24 à BP), c'est le LOAD du Minimoog : le mélangeur entre plus ou moins fort dans le filtre, qui sature lui-même, étage par étage ; un grain chaud, des graves qui se tassent, le volume rattrapé en sortie. Tout à gauche (CLEAN), le filtre est propre, jamais muet. En MODE 303, c'est la saturation d'avant, après le filtre. Le SUB n'est jamais saturé : le grave reste propre.",
    tip: "LOAD vers +10 dB (le réglage d'usine) pour le son Moog ; tout en haut, une basse qui crache.",
  },
  volume: {
    section: 'OUTPUT',
    title: 'VOLUME',
    text: "Le niveau du MM-BASS vers le master (la voie 2 du MIXER), sur la page VOICE (H). En P-LOCK, le volume du pas choisi seulement : une note plus forte ou plus douce. Le réglage d'usine crête vers -11 dBFS, environ 2 dB sous le kick du MM-RYTM (vers -9 dBFS), qui sert de référence.",
    tip: "Règle d'abord le kick, puis monte la basse juste sous lui ; SIDECHAIN (page FX, E) la fait s'effacer sous chaque coup.",
  },

  /* ---------- TWEAKS, sous le capot : les regles du generateur ---------- */
  slides: {
    section: 'TWEAKS / GENERATOR',
    title: 'SLIDE PROB',
    text: "La chance qu'une note du générateur glisse vers la suivante ; les notes de la machine suivent le potard à chaque cran ; tes notes et les notes écrites d'un preset gardent les leurs. Le style la module : beaucoup en ACID et en SUB, presque jamais en EBM et en PSY PROG. GLIDE, page VOICE, règle la durée du glissement.",
    tip: "Vers 40 % pour une acid bavarde, 10 % pour une dark disco qui reste droite.",
  },
  accents: {
    section: 'TWEAKS / GENERATOR',
    title: 'ACC PROB',
    text: "La chance qu'une note du générateur soit accentuée ; les notes de la machine suivent le potard à chaque cran ; tes notes et les notes écrites d'un preset gardent les leurs. Ce n'est pas ACCENT (page FILTER), qui règle la force de l'accent.",
    tip: "30 à 45 % en acid, 20 % pour une house plus égale.",
  },
  range: {
    section: 'TWEAKS / GENERATOR',
    title: 'RANGE',
    text: "Jusqu'où les notes générées peuvent monter : 1 octave pour une ligne serrée et hypnotique, 3 pour des sauts plus fous. Les notes de la machine suivent le potard à chaque cran ; tes notes et les notes écrites d'un preset gardent les leurs.",
    tip: "1 pour le minimal et la psy prog, 2 pour la dark disco et l'acid.",
  },
  root: {
    section: 'TWEAKS / GENERATOR',
    title: 'ROOT',
    text: "La tonique de la ligne. Sur ARP, la basse suit la racine de l'accord que joue le MM-ARP, mesure par mesure. De F# à B la ligne monte, de C à F elle descend, pour rester dans le grave.",
    tip: "ARP quand le MM-ARP joue une progression, sinon F#, la tonalité du site.",
  },
  scale: {
    section: 'TWEAKS / GENERATOR',
    title: 'SCALE',
    text: "La gamme où GEN et NOTE - + choisissent leurs notes. MINOR pour la dark disco, PHRYGIAN pour un côté sombre (deuxième degré à un demi-ton), DORIAN plus lumineux, HARMONIC pour l'italo dramatique, PENTA pour ne jamais rater.",
    tip: "En indie dance, DORIAN ouvre la couleur sans quitter le mineur.",
  },

  /* ---------- TWEAKS, sous le capot : la voix ---------- */
  length: {
    section: 'TWEAKS / VOICE',
    title: 'LENGTH',
    text: "La longueur des notes, en part du pas. AUTO suit le style (32 % en MINIMAL, 92 % en SUB) ; court donne un groove sec et rebondissant, long des notes qui se touchent. Elle se verrouille aussi pas par pas (LOCK).",
    tip: "35 à 45 % pour une dark disco qui claque avec le charley.",
  },
  accdecay: {
    section: 'TWEAKS / VOICE',
    title: 'ACC DECAY',
    text: "La décroissance du filtre sur les notes accentuées, 200 ms sur la 303. Plus courte, l'accent claque ; plus longue, il miaule. Les notes normales gardent DECAY. Sur l'échelle (LP24 à BP), c'est la durée de la charge des accents (ce qui pousse le filtre quand ils se suivent, SWEEP) : le contour reste celui de DECAY.",
    tip: "Garde 200 ms pour une acid authentique.",
  },
  sweep: {
    section: 'TWEAKS / VOICE',
    title: 'SWEEP',
    text: "Le wow des accents qui se suivent : chaque accent charge le filtre un peu plus haut, jusqu'à ce plafond en octaves. Plus de RESO rend la charge plus lente, comme sur la vraie 303.",
    tip: "Monte-le avec trois ou quatre accents d'affilée pour une acid qui hurle en fin de mesure.",
  },
  release: {
    section: 'TWEAKS / VOICE',
    title: 'RELEASE',
    text: "Le temps que met une note à s'éteindre une fois relâchée : très court, la coupure sèche de la 303 ; plus long, une petite traîne.",
    tip: "14 ms par défaut, vers 80 ms pour une basse house plus douce.",
  },
  suboct: {
    section: 'TWEAKS / VOICE',
    title: 'SUB OCT',
    text: "L'octave du sinus de SUB : une octave sous la note, ou deux pour un grave énorme. À -2 sur une ligne déjà basse, le sub passe sous 30 Hz.",
    tip: "-2 seulement avec OCTAVE à 0 ou +1.",
  },
  tune: {
    section: 'TWEAKS / VOICE',
    title: 'TUNE',
    text: "Accorde finement la basse de -50 à +50 cents (un demi-ton fait 100 cents), pour la coller à un kick accordé ou à un disque des DECKS.",
    tip: "Les kicks d'usine sont accordés en F#, donc 0 est juste.",
  },

  /* ---------- la machine Elektron (2026-10-08) : les reglages des pages ---------- */
  pw: {
    section: 'VOICE',
    title: 'OSC 1 PW',
    text: "La largeur du carré de l'oscillateur 1 (OSC 1 WAVE), de 50 % (le carré rond et creux) à 95 % (une impulsion fine et nasillarde, façon SH-101). Sans effet sur la dent de scie : monte OSC 1 WAVE pour l'entendre (le bloc dit SAW: NO PW tant qu'il ne s'entend pas). Se verrouille pas par pas.",
    tip: "Un PW différent verrouillé sur deux ou trois pas : la ligne change de couleur sans changer de note.",
  },
  keytrack: {
    section: 'FILTER',
    title: 'KEY TRK',
    text: "Fait suivre la coupure à la note : à 0, toutes les notes passent par le même filtre (la 303) ; 1/3 et 2/3 sont les deux interrupteurs KEYBOARD CONTROL du Model D (le bloc dit 1/3 MOOG) ; à fond, le filtre monte d'une octave quand la note monte d'une octave, les notes hautes restent aussi brillantes que les graves.",
    tip: "1/3 (le réglage d'usine) pour une ligne qui saute d'octave sans que les notes hautes paraissent étouffées.",
  },
  attack: {
    section: 'ENV',
    title: 'ATTACK',
    text: "Le temps de montée du volume de chaque note, de 0,5 ms à 1 s. Réglage d'usine : 2,5 ms, le claquement net de la 303. Plus long, la note entre en douceur. Une note glissée (SLIDE) ne remonte pas.",
    tip: "Une ATTACK longue verrouillée sur la dernière note de la mesure : un effet aspiré.",
  },
  adecay: {
    section: 'ENV',
    title: 'AMP DECAY',
    text: "Après la montée, le volume descend vers SUSTAIN en ce temps-là, de 20 ms à 4 s. Avec SUSTAIN au maximum (réglage d'usine), il ne se passe rien : la note reste pleine tant qu'elle est tenue, et le bloc dit SUSTAIN FULL. Le grand dessin d'AMP ENV le montre : la note telle qu'elle joue, en pointillé la même note tenue.",
    tip: "SUSTAIN à 0 et AMP DECAY court : des notes pincées, très percussives, même avec une LENGTH longue.",
  },
  sustain: {
    section: 'ENV',
    title: 'SUSTAIN',
    text: "Le niveau où la note se tient après AMP DECAY, tant qu'elle n'est pas relâchée. Au maximum (réglage d'usine), comme la 303 : pleine jusqu'au relâchement.",
    tip: "Vers 40 % avec un AMP DECAY de 300 ms : une basse house qui respire.",
  },
  delay: {
    section: 'FX',
    title: 'DELAY',
    text: "Envoie la basse dans le DELAY : des répétitions gauche, droite, calées sur le tempo (DLY TIME), qui s'éteignent avec DLY FB. Le grave sous 140 Hz ne repasse pas dans les répétitions : le mix reste propre. Se verrouille pas par pas : un écho sur une seule note.",
    tip: "Le classique dub : DELAY verrouillé à fond sur le dernier pas de la mesure, DLY TIME sur 3/16.",
  },
  dtime: {
    section: 'FX',
    title: 'DLY TIME',
    text: "Le temps entre deux répétitions, en pas du tempo : de 1/16 (une double croche) à 1/2 (deux temps). 3/16, la croche pointée, fait rebondir la ligne entre ses notes. Global : le même pour tous les pas.",
    tip: "1/8 pour épaissir, 3/16 pour le groove, 1/2 pour un écho qu'on remarque.",
  },
  dfb: {
    section: 'FX',
    title: 'DLY FB',
    text: "Combien chaque répétition renvoie dans la suivante, de 0 à 90 % : peu, un ou deux échos ; beaucoup, une traîne qui dure des mesures. Global.",
    tip: "Au-dessus de 70 %, garde l'envoi DELAY pour quelques pas seulement.",
  },
  reverb: {
    section: 'FX',
    title: 'REVERB',
    text: "Envoie la basse dans la REVERB du MM-BASS. Une basse aime peu de réverbération : sur quelques notes verrouillées, elle ouvre l'espace sans noyer le grave.",
    tip: "Une REVERB verrouillée sur un pas accentué, et rien ailleurs : une note qui s'envole.",
  },
  rsize: {
    section: 'FX',
    title: 'REV SIZE',
    text: "La durée de la REVERB, de 0,3 s (une petite pièce) à 8 s (une cathédrale). Global.",
    tip: "Moins d'une seconde en techno, plus long pour les breaks.",
  },
  rtone: {
    section: 'FX',
    title: 'REV TONE',
    text: "La couleur de la REVERB : sombre à gauche (les aigus s'éteignent vite), claire à droite. Global.",
    tip: "Sombre pour une basse : elle reste derrière le kick.",
  },
  // SIDECHAIN (2026-10-10) : le meme que celui du MM-ARP, sur la prise du MM-BASS
  sidechain: {
    section: 'FX',
    title: 'SIDECHAIN',
    text: "La basse, effets compris, s'efface à chaque kick du MM-RYTM et revient avec lui : la baisse suit le kick joué (son, DECAY, vélocité), jusqu'à -24 dB au coup. À 0 (OFF), rien ne bouge. Global : le même pour tous les pas.",
    tip: "Vers 50 (environ -9 dB) : le kick passe devant, la basse respire avec lui.",
  },

  /* ---------- le moteur MONARK (2026-10-09) : les oscillateurs 2 et 3 (onglet OSC) ---------- */
  o2wave: {
    section: 'OSC',
    title: 'OSC 2 WAVE',
    text: "La forme de l'oscillateur 2, en six crans comme sur le Model D : TRI (le triangle, doux), SHARK (un triangle penché vers la dent de scie), SAW (la dent de scie, toutes les harmoniques), SQR (le carré, creux), WIDE (une impulsion à 30 %) et NARROW (une impulsion fine à 12 %, nasillarde). Tu l'entends si OSC 2 est monté (onglet MIX).",
    tip: "SAW sur OSC 1 et OSC 2, OSC 2 désaccordé de quelques cents : la basse Moog classique.",
  },
  o2range: {
    section: 'OSC',
    title: 'OSC 2 RANGE',
    text: "L'octave de l'oscillateur 2, en pieds comme les jeux d'un orgue (un tuyau deux fois plus long sonne une octave plus bas) : 32' une octave sous la note, 16' la note, 8' une octave au-dessus, 4' deux octaves au-dessus.",
    tip: "8' avec un peu de niveau : la note gagne de la présence sans changer de hauteur.",
  },
  o2semi: {
    section: 'OSC',
    title: 'OSC 2 SEMI',
    text: "L'intervalle de l'oscillateur 2 par rapport à la note, de -7 à +7 demi-tons : +7 (la quinte) et +5 (la quarte) font les basses en accord du Minimoog ; +3 ou +4 (une tierce) colorent la ligne en mineur ou en majeur. Le bloc dit le nom de l'intervalle.",
    tip: "+7 avec OSC 2 un peu sous OSC 1 : une quinte qui épaissit sans brouiller le grave.",
  },
  o2fine: {
    section: 'OSC',
    title: 'OSC 2 FINE',
    text: "Désaccorde finement l'oscillateur 2, de -50 à +50 cents (un demi-ton fait 100 cents) : quelques cents d'écart avec OSC 1 font battre les deux ondes, le son bouge et grossit. Au milieu, les deux sont justes.",
    tip: "+3 à +8 cents pour une basse qui vit ; plus loin, ça devient un chorus, puis faux.",
  },
  o3wave: {
    section: 'OSC',
    title: 'OSC 3 WAVE',
    text: "La forme de l'oscillateur 3, les six crans d'OSC 2 sauf le deuxième : REV SAW, la dent de scie à l'envers (elle monte au lieu de descendre), comme sur l'oscillateur 3 du Model D. Tu l'entends si OSC 3 est monté (onglet MIX).",
    tip: "TRI ou SQR à 32' : un sub à la manière Moog, qui passe dans le filtre avec le reste.",
  },
  o3range: {
    section: 'OSC',
    title: 'OSC 3 RANGE',
    text: "L'octave de l'oscillateur 3, en pieds comme les jeux d'un orgue : 32' une octave sous la note, 16' la note, 8' une octave au-dessus, 4' deux octaves au-dessus. Sous 16 Hz (32' avec OCTAVE à -2), il remonte d'une octave pour rester audible.",
    tip: "32' : le poids du grave ; avec SUB à 0, c'est le sub du Moog.",
  },
  o3semi: {
    section: 'OSC',
    title: 'OSC 3 SEMI',
    text: "L'intervalle de l'oscillateur 3 par rapport à la note, de -7 à +7 demi-tons, comme OSC 2 SEMI : la quinte (+7), la quarte (+5), les tierces. Le bloc dit le nom de l'intervalle.",
    tip: "OSC 2 SEMI à +7 et OSC 3 en 8' : la note, sa quinte et son octave, un accord de puissance pour les lignes italo.",
  },
  o3fine: {
    section: 'OSC',
    title: 'OSC 3 FINE',
    text: "Désaccorde finement l'oscillateur 3, de -50 à +50 cents : de l'autre côté d'OSC 2 FINE, les trois ondes battent entre elles, le son s'élargit.",
    tip: "OSC 2 à +5 et OSC 3 à -3 cents : le gras du patch de départ.",
  },

  /* ---------- le melangeur (onglet MIX) ---------- */
  o1lvl: {
    section: 'MIX',
    title: 'OSC 1',
    text: "Le niveau de l'oscillateur 1 dans le mélangeur (le MIXER du Minimoog, avant le filtre) ; sa forme est sur MAIN (OSC 1 WAVE, OSC 1 PW). À 0 (OFF), il se tait ; le bloc dit le niveau en dB. Plus le mélangeur est plein, plus il pousse le filtre (DRIVE) et plus le son grogne.",
    tip: "Les trois oscillateurs entre 60 et 90 % : le gras du Model D ; un seul pour une basse plus nette.",
  },
  o2lvl: {
    section: 'MIX',
    title: 'OSC 2',
    text: "Le niveau de l'oscillateur 2 dans le mélangeur, avant le filtre. À 0 (OFF), il se tait et ses blocs de l'onglet OSC disent OSC 2 OFF. Se verrouille pas par pas : un oscillateur qui n'entre que sur certaines notes.",
    tip: "Un peu sous OSC 1 : il épaissit sans prendre la place de la note.",
  },
  o3lvl: {
    section: 'MIX',
    title: 'OSC 3',
    text: "Le niveau de l'oscillateur 3 dans le mélangeur, avant le filtre. À 0 (OFF), il se tait et ses blocs de l'onglet OSC disent OSC 3 OFF.",
    tip: "Avec OSC 3 à 32', c'est le dosage du grave : monte-le jusqu'à ce que la basse pèse sans boucher le kick.",
  },
  noise: {
    section: 'MIX',
    title: 'NOISE',
    text: "Ajoute un bruit rose (un souffle, plus doux que le bruit blanc) au mélangeur, avant le filtre : il suit le filtre et l'enveloppe de chaque note. Un peu de bruit donne de l'attaque et de l'air à une basse ; beaucoup, un son de percussion ou de vent.",
    tip: "Un soupçon (le bloc vers -30 dB) avec beaucoup d'ENV MOD : chaque note claque.",
  },
  feedback: {
    section: 'MIX',
    title: 'FEEDBACK',
    text: "Renvoie la sortie dans l'entrée du filtre, le vieux truc du Minimoog (un câble de la sortie casque vers l'entrée externe du mélangeur) : jusqu'au milieu, le son se réchauffe et grossit (WARM) ; au-delà, il grogne et se salit (GRIT). À 0 (OFF), rien ne change.",
    tip: "20 à 30 % avec une emphase basse : plus de corps sans plus de grave.",
  },
  drift: {
    section: 'MIX',
    title: 'DRIFT',
    text: "La dérive analogique, pour toute la machine : les trois oscillateurs bougent de quelques cents chacun (vers 3 cents au plus), la coupure respire un peu, chaque note démarre sur une phase un peu différente. À 0 (STABLE), tout est exact, chaque note identique. Global : il ne se verrouille pas sur un pas (en P-LOCK, son bloc dit GLOBAL).",
    tip: "30 à 50 % : un vrai Model D bien chaud ; 0 pour une basse de machine parfaitement droite.",
  },

  /* ---------- le filtre (onglet CONTOUR) ---------- */
  fmode: {
    section: 'FILTER',
    title: 'MODE',
    text: "Le filtre, pour toute la machine : LP24, le passe-bas en échelle du Moog (24 dB par octave, rond et gras) ; LP12 et LP6, des pentes plus douces qui gardent plus d'aigus ; BP, un passe-bande (les graves et les aigus coupés, une basse nasale) ; 303, le filtre de la TB-303 d'avant, avec son enveloppe. Le passage d'un mode à l'autre se fait en douceur, même en pleine note. Global : un P-lock ne le change pas (en P-LOCK, son bloc dit GLOBAL).",
    tip: "LP24 pour la basse Moog, LP12 pour une basse plus brillante ; 303 pour l'acid (les presets ACID y sont).",
  },
  fattack: {
    section: 'FILTER',
    title: 'F.ATTACK',
    text: "Le temps que met le contour du filtre (l'enveloppe d'ENV MOD) à monter jusqu'au plein, de 0,5 ms à 1 s : court, chaque note claque ; long, le filtre s'ouvre en douceur, un wah lent. En MODE 303, le contour est celui de la 303, sans attaque : le bloc dit LADDER ONLY.",
    tip: "30 à 80 ms : la note se gonfle, la basse respire comme un cuivre.",
  },
  fsustain: {
    section: 'FILTER',
    title: 'F.SUSTAIN',
    text: "Le niveau où le contour du filtre se tient après DECAY, tant que la note est tenue : à 0, le filtre redescend jusqu'à CUTOFF ; plus haut, il reste un peu ouvert. Une note relâchée se referme en RELEASE. En MODE 303 : LADDER ONLY.",
    tip: "Vers 15 % (le réglage d'usine) : les notes longues gardent un peu de brillance.",
  },
  fpol: {
    section: 'FILTER',
    title: 'POLARITY',
    text: "Le sens du contour du filtre : POS, chaque note ouvre le filtre au-dessus de CUTOFF (le geste classique) ; NEG, chaque note le ferme sous CUTOFF, puis il remonte (un son aspiré, à l'envers). ENV MOD en garde l'amplitude, son bloc dit le signe. En MODE 303 : LADDER ONLY.",
    tip: "NEG avec un CUTOFF ouvert et une F.ATTACK courte : un effet de pompe sans compresseur.",
  },

  /* ---------- les pages et les encodeurs (2026-10-08) ---------- */
  pvoice: {
    section: 'PAGES',
    title: 'VOICE',
    text: "La voix, en trois onglets : MAIN (OSC 1 WAVE, OSC 1 PW, SUB, SUB OCT, OCTAVE, TUNE, GLIDE et VOLUME ; en P-LOCK, le volume du pas choisi), OSC (les oscillateurs 2 et 3) et MIX (le mélangeur). Appuie encore sur VOICE pour l'onglet suivant, ou clique une puce sur la ligne du titre (Maj+[ et Maj+] aussi). Glisse un bloc à la souris, vers le haut ou le bas. La LED dit la page allumée ; les touches [ et ] passent d'une page à l'autre.",
    tip: "En P-LOCK, une touche de page à demi allumée porte déjà des verrous sur ce pas, dans l'un de ses onglets.",
  },
  pfilter: {
    section: 'PAGES',
    title: 'FILTER',
    text: "Le filtre, en deux onglets : MAIN (CUTOFF, RESO, ENV MOD, DECAY, ACCENT, ACC DECAY, SWEEP et KEY TRK ; le titre dit le MODE, FILTER LP24) et CONTOUR (le MODE et le contour du filtre). Appuie encore sur FILTER pour passer de l'un à l'autre, ou clique une puce sur la ligne du titre. C'est la page de départ.",
  },
  posc: {
    section: 'PAGES',
    title: 'OSC',
    text: "L'onglet OSC de la page VOICE : les oscillateurs 2 (en haut) et 3 (dessous) du Model D, chacun sa forme (WAVE), son octave en pieds (RANGE), son intervalle (SEMI) et son désaccord (FINE). L'oscillateur 1 est sur MAIN ; les niveaux des trois, sur MIX. Un oscillateur à 0 sur MIX ne sonne pas : ses blocs disent OSC 2 OFF.",
    tip: "OSC 2 en SAW à +5 cents, OSC 3 en SQR à 32' (une octave sous la note) : le patch de départ, MM CLASSIC.",
  },
  pmix: {
    section: 'PAGES',
    title: 'MIX',
    text: "L'onglet MIX de la page VOICE : le mélangeur du Minimoog, avant le filtre. En haut les niveaux d'OSC 1, OSC 2, OSC 3 et NOISE ; dessous SUB (le sinus propre, après le filtre), DRIVE (la charge du mélangeur dans le filtre), FEEDBACK et DRIFT.",
    tip: "Plus le mélangeur est plein, plus il pousse le filtre : baisse un peu les oscillateurs pour un son plus net.",
  },
  pcontour: {
    section: 'PAGES',
    title: 'CONTOUR',
    text: "L'onglet CONTOUR de la page FILTER : MODE, F.ATTACK, DECAY, F.SUSTAIN, ENV MOD et POLARITY, le contour du filtre (son enveloppe) comme sur le Model D. En G H, le contour en grand, tel qu'il sonne : la montée, la décroissance vers F.SUSTAIN, le relâchement après NOTE OFF (le trait vertical), en octaves au-dessus de CUTOFF (dessous en NEG) ; le segment que tu règles en trait épais. En MODE 303, l'enveloppe de la 303 : pas d'attaque, pas de sustain.",
    tip: "Le dessin ne se règle pas : glisse les blocs A à F.",
  },
  penv: {
    section: 'PAGES',
    title: 'ENV',
    text: "AMP ENV : les blocs règlent l'enveloppe de l'ampli (ATTACK, AMP DECAY, SUSTAIN, RELEASE) et la longueur des notes (LENGTH). À droite, l'enveloppe en grand, telle qu'elle sonne : la note qui joue jusqu'à NOTE OFF, en pointillé la même note tenue, le segment que tu règles en trait épais. En P-LOCK, l'écran dit AMP ENV · P-LOCKS et montre l'enveloppe du pas.",
  },
  pfx: {
    section: 'PAGES',
    title: 'FX',
    text: "Les blocs de l'écran règlent les effets : DRIVE, l'envoi DELAY et l'envoi REVERB se verrouillent pas par pas ; DLY TIME, DLY FB, SIDECHAIN (la basse s'efface sous le kick du MM-RYTM), REV SIZE et REV TONE sont globaux (les mêmes pour tous les pas : en P-LOCK, leur bloc dit GLOBAL). Ils se règlent ici, sur l'écran ; les huit encodeurs de la face tiennent le filtre et son enveloppe. VOLUME est sur VOICE (H).",
  },
  enc: {
    section: 'SCREEN',
    title: 'VALUE',
    text: "Les huit blocs de l'écran règlent l'onglet allumé (VOICE MAIN, OSC, MIX, FILTER MAIN, CONTOUR, ENV, FX) : glisse-les à la souris, ou la molette (plus elle tourne vite, plus elle va loin ; Maj : fin). Les huit encodeurs de la face, eux, tiennent le filtre : CUTOFF, RESO, ENV MOD, DRIVE, puis F.ATTACK, DECAY, F.SUSTAIN et RELEASE, pour toute la ligne. Cette case est vide sur cet onglet.",
  },
  ikey: {
    section: 'SCREEN',
    title: 'INFOS',
    text: "Allume l'aide : survole n'importe quelle commande du MM-BASS (au téléphone, touche-la, sans la changer) pour lire ce qu'elle fait ; un bloc de l'écran montre le réglage qu'il tient sur la page allumée, un encodeur le réglage du filtre qu'il tient. Le i se remplit tant que c'est allumé ; touche-le encore, ou Échap, pour l'éteindre.",
  },
  plock: {
    section: 'SCREEN',
    title: 'P-LOCK',
    text: "Le pas choisi est en P-LOCK : tout ce que tu glisses sur l'écran ne change que lui, l'en-tête est en négatif et chaque bloc verrouillé porte un P. Touche cette pastille pour sortir : les blocs règlent de nouveau toute la ligne.",
    tip: "Échap sort aussi.",
  },

  /* ---------- les touches ---------- */
  run: {
    section: 'KEYS',
    title: 'RUN',
    text: "Lance ou arrête la ligne, calée sur le MM-RYTM s'il joue (sinon le MM-ARP, sinon le tempo).", keys: "Touche Espace.",
  },
  clear: {
    section: 'KEYS',
    title: 'CLEAR',
    text: "Efface toute la ligne, tes notes et leurs P-locks compris : NOTES tombe à 0. Les effets aussi passent à 0 (DRIVE, envoi DELAY, envoi REVERB, SIDECHAIN) : le son repart à sec ; VOLUME, la voix, le filtre, DLY TIME, DLY FB, REV SIZE et REV TONE restent. Remonte NOTES : les notes de la prise reviennent une à une, dans leur ordre. En P-LOCK, seulement les verrous du pas (toutes les pages).",
  },
  // Les touches du pas, en bas de l'ecran (la face simple, 2026-10-09, le soir)
  accentkey: {
    section: 'SCREEN KEYS',
    title: 'ACCENT',
    text: "En bas de l'écran : met ou enlève l'accent sur le pas choisi, celui que la bande nomme à gauche des touches (STEP 05 F#2). La touche passe en négatif quand le pas a l'accent. Le bloc ACCENT, page FILTER, règle sa force.", keys: "Touche A.",
  },
  slide: {
    section: 'SCREEN KEYS',
    title: 'SLIDE',
    text: "En bas de l'écran : fait glisser la note du pas choisi vers la suivante, sans la relâcher ; la touche passe en négatif quand le pas glisse. GLIDE, page VOICE, règle la durée.", keys: "Touche S.",
  },
  notedn: {
    section: 'SCREEN KEYS',
    title: 'NOTE -',
    text: "En bas de l'écran : un degré de la gamme plus bas sur le pas choisi ; tu peux aussi glisser sur le pas. Atténuée quand le pas n'a pas de note.", keys: "Flèche du bas.",
  },
  noteup: {
    section: 'SCREEN KEYS',
    title: 'NOTE +',
    text: "En bas de l'écran : un degré de la gamme plus haut sur le pas choisi ; tu peux aussi glisser sur le pas. Atténuée quand le pas n'a pas de note.", keys: "Flèche du haut.",
  },
  octdn: {
    section: 'SCREEN KEYS',
    title: 'OCT -',
    text: "En bas de l'écran : une octave plus bas sur le pas choisi (de -1 à +2).", keys: "Touche Z.",
  },
  octup: {
    section: 'SCREEN KEYS',
    title: 'OCT +',
    text: "En bas de l'écran : une octave plus haut sur le pas choisi (de -1 à +2).", keys: "Touche X.",
  },
  // La face simple (2026-10-09, le soir, Mika : "rajoute un bouton PRESET")
  preset: {
    section: 'KEYS',
    title: 'PRESET',
    text: "Ouvre les presets sur l'écran, comme un clic sur le pattern (A01) de l'en-tête. Clique la moitié gauche de l'écran pour le preset d'avant, la droite pour le suivant : il joue tout de suite, le son et la ligne. SAVE garde ce que tu entends comme un preset à toi, NAME le renomme, DEL l'efface. Réappuie sur PRESET, ou EXIT, pour fermer ; sa LED reste allumée tant que les presets sont ouverts.",
    tip: "Pars d'un preset du style que tu veux, puis GEN, NOTES et STYLE pour la ligne, les pages de l'écran pour le son.",
  },
  edit: {
    section: 'KEYS',
    title: 'EDIT',
    text: "Le panneau EDIT, comme celui du MM-RYTM : posé sur la machine à la place des pas (au téléphone, sous elle). En haut, PTN : touche un pattern pour le jouer à la mesure, plusieurs à la suite pour les enchaîner, tiens un vide pour y copier la ligne. Dessous, la grille : une rangée par note de la gamme (son nom à gauche, les toniques en couleur), une colonne par pas. Clique une case : la note de ce pas, à cette hauteur ; clique la note : le pas se vide ; glisse le long d'une rangée : la même note sur les pas traversés. OCT - et OCT + montrent l'octave d'en dessous ou d'au-dessus. Puis ACC, SLIDE et TIE, un interrupteur par pas (TIE : le pas prolonge la note d'avant), et LEN, la longueur de la ligne (1 à 16 pas, par exemple 4 pour une boucle de 4 pas ; les pas au-delà pâlissent et ne jouent pas). CLEAR vide la ligne, DONE ou EDIT referment.", keys: "Touche E.",
  },
  open: {
    section: 'KEYS',
    title: 'OPEN',
    text: "Soulève le capot : les règles du générateur, les réglages fins de la voix et INFOS.", keys: "Touche O.",
  },

  /* ---------- les pas ---------- */
  lock: {
    section: 'STEPS',
    title: 'LOCK',
    text: "P-LOCK sur ce pas, comme une tape sur le pas (sans changer sa note ; un pas vide reçoit une note) : sa LED clignote, l'en-tête de l'écran passe en négatif, P-LOCK STEP 05, chaque page dit ses verrous (AMP ENV · P-LOCKS, 3 P-LOCKS). Choisis la page, puis glisse un bloc de l'écran : ce réglage ne change plus que sur ce pas, son bloc passe en négatif avec un P. Double tape sur le bloc pour enlever ce verrou, CLEAR pour tous ceux du pas ; réappuie sur LOCK, Échap, ou touche la pastille P-LOCK pour sortir. EDIT ouvert : LOCK le ferme et met le P-LOCK, d'un geste.",
    tip: "Un CUTOFF plus ouvert sur le pas 16, c'est une relance acid instantanée.",
  },
  trig: {
    section: 'STEPS',
    title: 'STEPS',
    text: "Touche un pas : une note s'y pose (la tonique) ; touche-le encore : elle s'en va. Tiens-le : il passe en P-LOCK, l'écran règle alors ce pas seul (glisse un bloc), et le lâcher en sort. Glisse dessus pour changer sa note. Quand la lecture passe sur un pas verrouillé, la puce P-LOCK de l'écran s'allume et ses blocs passent en négatif. Une note que tu poses, que tu changes (hauteur, ACCENT, SLIDE, OCT : les touches en bas de l'écran) ou que tu verrouilles devient la tienne : STYLE, NOTES et GEN n'y touchent plus, et l'écran du générateur la marque d'un point. Pour la rendre à la machine, remets-la à vide.",
    tip: "Pour ajouter des notes vite : une tape par pas vide.",
  },
  screen: {
    section: 'SCREEN',
    title: 'SCREEN',
    text: "Les huit blocs sont les commandes : glisse un bloc vers le haut ou le bas (de 0 à 127, son unité dessous), ou la molette (plus elle tourne vite, plus elle va loin ; Maj : fin), deux clics pour sa valeur de départ. Hors P-LOCK ils règlent toute la ligne ; en P-LOCK seulement le pas choisi (un P sur ce qui est verrouillé, GLOBAL sur ce qui ne se verrouille pas). Un verrou qui ne s'entendrait pas le dit (SUSTAIN FULL, SAW: NO PW, OSC 2 OFF, LADDER ONLY, ACCENT STEPS, SLIDE STEPS, ROOT NOTE). Dessous, les 16 pas, puis la bande des touches du pas choisi (STEP 05 F#2 : ACCENT, SLIDE, NOTE - +, OCT - +). En haut, clique une page (VOICE, FILTER, ENV, FX), puis sur la ligne du titre un onglet (MAIN, OSC, MIX ; MAIN, CONTOUR) ; le preset et le pattern (A01), ou la touche PRESET, pour les presets, le petit i pour INFOS.",
  },

  /* ---------- sous le capot ---------- */
  infos: {
    section: 'TWEAKS',
    title: 'INFOS',
    text: "Allume l'aide : survole un potard, un encodeur, un bloc de l'écran ou une touche du MM-BASS ; au téléphone, touche-le, sans le changer. Le petit i dans le coin de l'écran fait la même chose. Réappuie, ou touche la pastille, pour l'éteindre.",
  },
  close: {
    section: 'TWEAKS',
    title: 'CLOSE',
    text: "Referme le capot. INFOS reste allumé : la pastille INFOS ON l'éteint.",
  },
};

/**
 * Au telephone (2026-10-09) : plus d'encodeurs, les huit blocs de l'ecran en tiennent lieu (on les glisse), les
 * touches de page sont sous l'ecran ; pas de clavier (ni [ ], ni Echap).
 */
const PHONE: Partial<Record<BassInfoId, Partial<BassInfo>>> = {
  // Le moteur MONARK (2026-10-09) : les onglets se choisissent par la touche de page (encore : l'onglet suivant), la
  // pastille de la page ou les puces de l'en-tete ; jamais d'encodeur ni de clavier
  pvoice: {
    text: "La voix, en trois onglets : MAIN (OSC 1 WAVE, OSC 1 PW, SUB, SUB OCT, OCTAVE, TUNE, GLIDE et VOLUME ; en P-LOCK, le volume du pas choisi), OSC (les oscillateurs 2 et 3) et MIX (le mélangeur). Touche encore VOICE, sous l'écran, ou la pastille de la page dans l'en-tête, pour l'onglet suivant ; ou touche sa puce dans l'en-tête. Glisse un bloc du doigt.",
  },
  pfilter: {
    text: "Le filtre, en deux onglets : MAIN (CUTOFF, RESO, ENV MOD, DECAY, ACCENT, ACC DECAY, SWEEP et KEY TRK ; le titre dit le MODE) et CONTOUR (le MODE et le contour du filtre). Touche encore FILTER, sous l'écran, ou une puce de l'en-tête, pour passer de l'un à l'autre. C'est la page de départ.",
  },
  penv: { text: "AMP ENV : les blocs règlent l'enveloppe de l'ampli (ATTACK, AMP DECAY, SUSTAIN, RELEASE) et la longueur des notes (LENGTH). À droite, l'enveloppe en grand, telle qu'elle sonne : la note qui joue jusqu'à NOTE OFF, en pointillé la même note tenue. En P-LOCK, l'écran dit AMP ENV · P-LOCKS et montre l'enveloppe du pas." },
  pfx: { text: "Les blocs de l'écran règlent les effets : DRIVE, l'envoi DELAY et l'envoi REVERB se verrouillent pas par pas ; DLY TIME, DLY FB, SIDECHAIN (la basse s'efface sous le kick du MM-RYTM), REV SIZE et REV TONE sont globaux, les FX de toute la machine : sors du P-LOCK pour les régler (en P-LOCK, leur bloc dit GLB). VOLUME est sur VOICE (H)." },
  // Au telephone, un reglage global dit GLB sur son bloc (2026-10-09)
  fmode: {
    text: "Le filtre, pour toute la machine : LP24, le passe-bas en échelle du Moog (24 dB par octave, rond et gras) ; LP12 et LP6, des pentes plus douces qui gardent plus d'aigus ; BP, un passe-bande (les graves et les aigus coupés, une basse nasale) ; 303, le filtre de la TB-303 d'avant, avec son enveloppe. Le passage d'un mode à l'autre se fait en douceur, même en pleine note. Global : un P-lock ne le change pas (en P-LOCK, son bloc dit GLB).",
  },
  drift: {
    text: "La dérive analogique, pour toute la machine : les trois oscillateurs bougent de quelques cents chacun (vers 3 cents au plus), la coupure respire un peu, chaque note démarre sur une phase un peu différente. À 0 (STABLE), tout est exact, chaque note identique. Global : il ne se verrouille pas sur un pas (en P-LOCK, son bloc dit GLB).",
  },
  accents: { text: "La chance qu'une note de la machine soit accentuée. Ce n'est pas le bloc ACCENT (page FILTER, E), qui règle la force de l'accent." },
  accentkey: { text: "En bas de l'écran : met ou enlève l'accent sur le pas choisi, celui que la bande nomme au-dessus des touches (STEP 05 F#2). La touche passe en négatif quand le pas a l'accent ; le bloc ACCENT de l'écran (page FILTER, E) règle sa force." },
  preset: {
    text: "Ouvre les presets sur l'écran, comme le pattern (A01) de l'en-tête. Touche la moitié gauche de l'écran pour le preset d'avant, la droite pour le suivant : il joue tout de suite, le son et la ligne. SAVE garde ce que tu entends comme un preset à toi. Touche encore PRESET, ou EXIT, pour fermer ; sa LED reste allumée tant que les presets sont ouverts.",
  },
  enc: {
    section: 'SCREEN',
    title: 'VALUE',
    text: "Les huit blocs de l'écran règlent l'onglet allumé (les touches de page sous l'écran ; touchée encore, une page passe à son onglet suivant) : glisse un bloc vers le haut ou le bas pour changer sa valeur, de 0 à 127 ; deux tapes la remettent à sa valeur de départ. Cette case est vide sur cet onglet.",
  },
  volume: {
    text: "Le niveau du MM-BASS vers le master (la voie 2 du MIXER), sur la page VOICE (H). En P-LOCK, le volume du pas choisi seulement : une note plus forte ou plus douce. Le réglage d'usine crête vers -11 dBFS, environ 2 dB sous le kick du MM-RYTM (vers -9 dBFS), qui sert de référence.",
    tip: "Règle d'abord le kick, puis monte la basse juste sous lui.",
  },
  edit: {
    text: "Le panneau EDIT, comme celui du MM-RYTM, sous la machine. En haut, PTN : touche un pattern pour le jouer à la mesure, plusieurs à la suite pour les enchaîner, tiens un vide pour y copier la ligne. Dessous, la grille : une rangée par note de la gamme, une colonne par pas. Touche une case : la note de ce pas à cette hauteur ; touche la note : le pas se vide ; glisse le long d'une rangée : la même note sur les pas traversés. OCT - et OCT + changent d'octave. Puis ACC, SLIDE, TIE (un interrupteur par pas) et LEN, la longueur de la ligne (1 à 16 pas). CLEAR vide la ligne, DONE ou EDIT referment.",
  },
  plock: {
    text: "Le pas choisi est en P-LOCK : tout ce que tu glisses sur l'écran ne change que lui, l'en-tête est en négatif et chaque bloc verrouillé porte un P. Touche cette pastille pour sortir : les blocs règlent de nouveau toute la ligne (le son de tous les pas, les FX globaux).",
    tip: "Touche le pas une autre fois pour le changer (NOTE, TIE, OFF).",
  },
  ikey: { text: "Allume l'aide : touche n'importe quelle commande du MM-BASS pour lire ce qu'elle fait, sans la changer ; un bloc de l'écran montre le réglage qu'il tient sur la page allumée. Le i se remplit tant que c'est allumé ; touche-le encore pour l'éteindre." },
  lock: {
    text: "P-LOCK sur ce pas, comme une tape sur le pas (sans changer sa note ; un pas vide reçoit une note) : sa LED clignote, l'en-tête de l'écran passe en négatif, P-LOCK 05, chaque page dit ses verrous (AMP ENV · P-LOCKS, 3 P-LOCKS). Choisis la page sous l'écran, puis glisse un bloc : ce réglage ne change plus que sur ce pas, son bloc passe en négatif avec un P. Deux tapes sur le bloc enlèvent ce verrou, CLEAR tous ceux du pas ; réappuie sur LOCK, ou touche la pastille P-LOCK, pour sortir.",
  },
  trig: {
    text: "Touche un pas : une note s'y pose (la tonique) ; touche-le encore : elle s'en va. Tiens-le : il passe en P-LOCK, les blocs de l'écran règlent alors ce pas seul, et le lâcher en sort. Glisse dessus pour changer sa note. Tu peux aussi tenir un pas d'un doigt et glisser un bloc d'un autre : le verrou se pose le temps du geste. Quand la lecture passe sur un pas verrouillé, la puce P-LOCK s'allume et ses blocs passent en négatif. Une note que tu poses, que tu changes (hauteur, ACCENT, SLIDE, OCT : les touches en bas de l'écran) ou que tu verrouilles devient la tienne : STYLE, NOTES et GEN n'y touchent plus, et l'écran du générateur la marque d'un point. Pour la rendre à la machine, remets-la à vide.",
    tip: "Pour régler toute la ligne, sors du P-LOCK : touche la pastille P-LOCK de l'écran.",
  },
  screen: {
    text: "Les huit blocs sont les commandes : glisse un bloc vers le haut pour monter sa valeur (de 0 à 127, son unité dessous), deux tapes pour sa valeur de départ ; le bloc que ton doigt tient est cerné. Hors P-LOCK ils règlent toute la ligne ; en P-LOCK seulement le pas choisi (un P sur ce qui est verrouillé, GLB sur ce qui ne se verrouille pas). Un verrou qui ne s'entendrait pas le dit (SUSTAIN FULL, SAW: NO PW, OSC 2 OFF…). Dessous, les 16 pas, puis les touches du pas choisi (ACCENT, SLIDE, NOTE - +, OCT - +, son numéro et sa note au-dessus). En haut, touche la pastille de la page pour son onglet suivant, ou une puce (MAIN, OSC, MIX…) pour y aller ; le pattern (A01) ou la touche PRESET pour les presets, le petit i pour INFOS.",
  },
  infos: { text: "Allume l'aide : touche un bloc de l'écran, un potard ou une touche du MM-BASS pour lire ce qu'il fait, sans le changer. Le petit i dans le coin de l'écran fait la même chose. Réappuie, ou touche la pastille, pour l'éteindre." },
};

const KNOBS: ReadonlySet<string> = new Set(BASS_KNOBS.map((k) => k.id));

/** Le nom d'un ecran dans une section : sa page, et son onglet s'il n'est pas le premier (VOICE, VOICE OSC, FILTER CONTOUR). */
const screenName = (s: BassScreenId): string => {
  const p = SCREEN_PAGE[s];
  return PAGE_TABS[p][0] === s ? bassPageDef(p).label : `${bassPageDef(p).label} ${SCREEN_LABEL[s]}`;
};

/**
 * La section d'un reglage d'un ecran : ou le trouver (FILTER B), et sous le capot s'il y est aussi (2026-10-08) ; le
 * moteur MONARK (2026-10-09) : chaque ecran qui le porte (DECAY : FILTER D / FILTER CONTOUR C), dans l'ordre des ecrans.
 */
function sectionOf(id: string, raw: string): string {
  if (!KNOBS.has(id)) return raw;
  const at = BASS_SCREENS.flatMap((s) => {
    const k = BASS_SCREEN_SLOTS[s].indexOf(id as BassKnobId);
    return k >= 0 ? [`${screenName(s)} ${ENC_LETTERS[k]}`] : [];
  });
  if (!at.length) return raw;
  const plate = BASS_KNOBS.find((k) => k.id === id)?.plate;
  return `${at.join(' / ')}${plate ? ' / TWEAKS' : ''}`;
}

export const BASS_INFOS: Record<BassInfoId, BassInfo> = Object.fromEntries(
  Object.entries(RAW).map(([id, raw]) => {
    const x: RawInfo = PORTRAIT ? { ...raw, ...PHONE[id as BassInfoId] } : raw;
    const text = !PORTRAIT && x.keys ? `${x.text} ${x.keys}` : x.text;
    return [id, { section: sectionOf(id, x.section), title: x.title, text: fr(text), ...(x.tip ? { tip: fr(x.tip) } : {}) }];
  })
) as Record<BassInfoId, BassInfo>;

/** Un potard ? (sa valeur se lit, son dessin la suit). */
export const isBassInfoKnob = (id: BassInfoId): id is BassKnobId => KNOBS.has(id);

/**
 * L'id INFOS d'un hotspot du MM-BASS : bass-knob-<id> et bass-tw-<id> (la
 * plaque) donnent le potard, bass-key-<kind> la touche (bass-key-accent :
 * accentkey), bass-trig-* les pas, bass-lock-* LOCK, bass-lcd-* l'ecran,
 * bass-tw-infos et bass-tw-close INFOS et CLOSE ; null sinon.
 */
export function bassInfoIdOf(hotspotId: string): BassInfoId | null {
  // Un encodeur de la face (2026-10-09) : le FX global qu'il tient pour de bon ; un bloc de l'ecran, le reglage de la page
  const enc = /^bass-(enc|blk)-(\d)$/.exec(hotspotId);
  if (enc) {
    if (enc[1] === 'enc') return BASS_FX_KNOBS[Number(enc[2]) - 1] ?? 'enc';
    const k = Number(enc[2]) - 1;
    // Les cases F G H d'ENV portent le grand dessin de l'enveloppe (la revue du 2026-10-09 : la carte disait la case vide) ;
    // G H de CONTOUR, celui du contour du filtre (le moteur MONARK, le meme jour)
    const scr = bassPage.screen();
    if (scr === 'env' && k >= 5 && !bassPage.slot(k)) return 'penv';
    if (scr === 'contour' && k >= 6 && !bassPage.slot(k)) return 'pcontour';
    return bassPage.slot(k) ?? 'enc';
  }
  // Une puce d'onglet (2026-10-09) : la carte de son onglet (MAIN : celle de la page)
  if (hotspotId.startsWith('bass-scr-')) {
    const s = hotspotId.slice(9);
    if (!isBassScreen(s)) return null;
    return s === 'osc' ? 'posc' : s === 'mix' ? 'pmix' : s === 'contour' ? 'pcontour' : (`p${SCREEN_PAGE[s]}` as BassInfoId);
  }
  if (hotspotId === 'bass-key-i') return 'ikey';
  // La pastille P-LOCK de l'ecran, le rouleau d'EDIT (2026-10-09)
  if (hotspotId === 'bass-lcd-plock') return 'plock';
  if (hotspotId === 'bass-roll') return 'edit';
  if (hotspotId.startsWith('bass-knob-')) {
    const id = hotspotId.slice(10);
    return KNOBS.has(id) ? (id as BassKnobId) : null;
  }
  if (hotspotId.startsWith('bass-tw-')) {
    const id = hotspotId.slice(8);
    if (id === 'infos' || id === 'close') return id;
    return KNOBS.has(id) ? (id as BassKnobId) : null;
  }
  if (hotspotId.startsWith('bass-key-')) {
    const kind = hotspotId.slice(9);
    if (kind === 'accent') return 'accentkey';
    return kind in RAW && !KNOBS.has(kind) ? (kind as BassInfoId) : null;
  }
  // Un onglet de l'en-tete (le telephone, 2026-10-09) : la carte de sa touche de page
  if (hotspotId.startsWith('bass-tab-')) {
    const kind = `p${hotspotId.slice(9)}`;
    return kind in RAW ? (kind as BassInfoId) : null;
  }
  if (hotspotId.startsWith('bass-trig-')) return 'trig';
  if (hotspotId.startsWith('bass-lock-')) return 'lock';
  if (hotspotId.startsWith('bass-lcd-')) return 'screen';
  return null;
}
