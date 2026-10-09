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
 */

import { PORTRAIT } from '../theme';
import { ENC_LETTERS, bassPage, bassPageDef, bassSlotOf } from './pages';
import { BASS_KNOBS, type BassKnobId } from './params';
import type { BassKeyKind } from './theme';

export type BassInfoId = BassKnobId | Exclude<BassKeyKind, 'accent'> | 'accentkey' | 'trig' | 'lock' | 'screen' | 'infos' | 'close' | 'enc' | 'ikey';

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
    .replace(/(\d) (ms|s|Hz|kHz|dB|dBFS|%|cents|octaves?|pas|mesures?|BPM)(?![A-Za-zÀ-ÿ])/g, '$1 $2');

const RAW: Record<BassInfoId, RawInfo> = {
  /* ---------- GENERATOR (a cote de l'ecran) ---------- */
  style: {
    section: 'GENERATOR',
    title: 'STYLE',
    text: "Choisis la famille de basse que GEN va écrire : ACID, DARK DISCO, INDIE DANCE, MINIMAL, PSY PROG, TECHNO, HOUSE, ELECTRO, EBM, ITALO ou SUB. Le style règle aussi la longueur des notes qui jouent déjà (tant que LENGTH, sous le capot, est sur AUTO) : courtes en MINIMAL, tenues en SUB.",
    tip: "En DARK DISCO, l'octave saute sur le contretemps ; enchaîne avec MUTATE pour varier sans perdre le groove.",
  },
  density: {
    section: 'GENERATOR',
    title: 'DENSITY',
    text: "Combien de notes GEN écrit : à gauche une ligne aérée, à droite une ligne qui remplit la mesure. En SUB, c'est le nombre de changements de note par mesure, de 1 à 4. Le potard change la recette. Juste après un GEN, la ligne suit le potard en direct ; une fois la ligne retouchée à la main, il faut un nouveau GEN.",
    tip: "Vers 60 % pour l'indie dance, 80 % et plus pour une acid qui roule.",
  },
  gen: {
    section: 'GENERATOR',
    title: 'GEN',
    text: "Écrit une nouvelle ligne de 16 pas avec STYLE et DENSITY, dans la gamme de ROOT et SCALE (sous le capot, OPEN). Si rien ne joue, la ligne part tout de suite.", keys: "Touche G.",
    tip: "Appuie jusqu'à ce qu'une ligne t'accroche, puis garde-la dans un pattern avec EDIT.",
  },
  mutate: {
    section: 'GENERATOR',
    title: 'MUTATE',
    text: "Change 2 à 4 pas : une note, un accent, un slide, une octave, un pas qui apparaît ou disparaît ; le reste ne bouge pas.", keys: "Touche M.",
    tip: "Une mutation toutes les 8 mesures garde la ligne vivante en live.",
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
    title: 'WAVE',
    text: "La forme de l'oscillateur : dent de scie à gauche (brillante, la 303 classique), carré à droite (creux et rond), et entre les deux un fondu de l'une vers l'autre.",
    tip: "Dent de scie pour l'acid, carré pour l'italo et l'electro, vers 25 % pour une dark disco qui garde du mordant.",
  },
  sub: {
    section: 'OSC',
    title: 'SUB',
    text: "Ajoute un sinus une octave sous la note (deux avec SUB OCT), mélangé après le filtre et DRIVE : il reste plein même filtre fermé ou RESO au maximum. Plus tu le montes, plus l'oscillateur baisse pour garder le niveau.",
    tip: "30 à 50 % en dark disco et en house pour le poids ; 0 en acid pour laisser parler le filtre.",
  },

  /* ---------- FILTER ---------- */
  cutoff: {
    section: 'FILTER',
    title: 'CUTOFF',
    text: "La fréquence où le filtre de la 303 commence à couper les aigus, de 60 Hz à 6 kHz : à gauche sombre, à droite ouvert et brillant. C'est le geste principal de la machine, tourne-le pendant que ça joue.",
    tip: "En acid, pars bas (vers 200 Hz) avec beaucoup d'ENV MOD et ouvre lentement sur 16 mesures.",
  },
  reso: {
    section: 'FILTER',
    title: 'RESO',
    text: "Renforce les fréquences autour de CUTOFF : un pic qui chante, le son acid. Tout en haut, le filtre est au bord de siffler tout seul ; les graves sous 150 Hz restent, comme sur la 303.",
    tip: "60 à 85 % pour l'acid, 25 à 45 % pour l'indie dance et la dark disco, sinon la basse prend trop de place.",
  },

  /* ---------- ENVELOPE ---------- */
  envmod: {
    section: 'ENVELOPE',
    title: 'ENV MOD',
    text: "De combien le filtre s'ouvre à chaque note, jusqu'à 5 octaves au-dessus de CUTOFF, avant de se refermer avec DECAY : c'est le wah de chaque note. Une note accentuée s'ouvre encore plus haut (le pointillé).",
    tip: "Beaucoup d'ENV MOD avec un CUTOFF bas, c'est la recette acid ; peu d'ENV MOD pour une basse dark disco ronde et régulière.",
  },
  decay: {
    section: 'ENVELOPE',
    title: 'DECAY',
    text: "Le temps que met le filtre à se refermer après chaque note, de 120 ms à 2,5 s : court pour des notes sèches, long pour des notes qui respirent. Une note accentuée garde sa décroissance courte (ACC DECAY, l'encodeur voisin), comme sur la 303, sauf si DECAY est verrouillé sur son pas.",
    tip: "Moins de 250 ms en EBM et en psy prog, plus long en house.",
  },

  /* ---------- ACCENT / SLIDE ---------- */
  accent: {
    section: 'ACCENT / SLIDE',
    title: 'ACCENT',
    text: "La force des pas accentués (touche ACCENT, pas orange vif) : plus de volume, un filtre qui s'ouvre plus haut et plus court. Les accents qui se suivent s'additionnent et le filtre monte encore, le fameux wow de la 303 (SWEEP, deux encodeurs plus loin). Verrouillé sur un pas sans accent, il lui donne l'accent.",
    tip: "Place-les sur les contretemps en acid ; à 0, les accents ne font plus rien.",
  },
  glide: {
    section: 'ACCENT / SLIDE',
    title: 'GLIDE',
    text: "La durée du glissement quand un pas a SLIDE : la note ne se relâche pas et sa hauteur glisse vers la suivante sans relancer le filtre. Court, un petit portamento ; long, un vrai glissando.",
    tip: "30 à 60 ms pour l'acid, plus long sur une ligne SUB pour des basses qui coulent.",
  },

  /* ---------- OUTPUT ---------- */
  drive: {
    section: 'OUTPUT',
    title: 'DRIVE',
    text: "Sature le son après le filtre : plus de grain et d'harmoniques, la basse passe mieux sur de petits haut-parleurs. Le volume est compensé, et le SUB n'est pas saturé : le grave reste propre.",
    tip: "30 à 50 % en indie dance et en techno.",
  },
  volume: {
    section: 'OUTPUT',
    title: 'VOLUME',
    text: "Le niveau du MM-BASS vers le master (la voie 2 du MIXER). Le réglage d'usine crête vers -11 dBFS, environ 2 dB sous le kick du MM-RYTM (vers -9 dBFS), qui sert de référence.",
    tip: "Règle d'abord le kick, puis monte la basse juste sous lui.",
  },

  /* ---------- TWEAKS, sous le capot : les regles du generateur ---------- */
  slides: {
    section: 'TWEAKS / GENERATOR',
    title: 'SLIDE PROB',
    text: "La chance qu'une note glisse vers la suivante quand tu appuies sur GEN. Le style la module : beaucoup en ACID et en SUB, presque jamais en EBM et en PSY PROG. GLIDE, sur la face, règle la durée du glissement.",
    tip: "Vers 40 % pour une acid bavarde, 10 % pour une dark disco qui reste droite.",
  },
  accents: {
    section: 'TWEAKS / GENERATOR',
    title: 'ACC PROB',
    text: "La chance qu'une note soit accentuée quand tu appuies sur GEN. Ce n'est pas le potard ACCENT, qui règle la force de l'accent.",
    tip: "30 à 45 % en acid, 20 % pour une house plus égale.",
  },
  range: {
    section: 'TWEAKS / GENERATOR',
    title: 'RANGE',
    text: "Jusqu'où les notes générées peuvent monter : 1 octave pour une ligne serrée et hypnotique, 3 pour des sauts plus fous. Juste après un GEN, la ligne suit le potard en direct ; une fois la ligne retouchée à la main, il faut un nouveau GEN.",
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
    text: "La gamme où GEN, MUTATE et NOTE - + choisissent leurs notes. MINOR pour la dark disco, PHRYGIAN pour un côté sombre (deuxième degré à un demi-ton), DORIAN plus lumineux, HARMONIC pour l'italo dramatique, PENTA pour ne jamais rater.",
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
    text: "La décroissance du filtre sur les notes accentuées, 200 ms sur la 303. Plus courte, l'accent claque ; plus longue, il miaule. Les notes normales gardent DECAY.",
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
    title: 'PW',
    text: "La largeur du carré de WAVE, de 50 % (le carré rond et creux) à 95 % (une impulsion fine et nasillarde, façon SH-101). Sans effet sur la dent de scie : monte WAVE pour l'entendre. Se verrouille pas par pas.",
    tip: "Un PW différent verrouillé sur deux ou trois pas : la ligne change de couleur sans changer de note.",
  },
  keytrack: {
    section: 'FILTER',
    title: 'KEY TRK',
    text: "Fait suivre la coupure à la note : à 0, toutes les notes passent par le même filtre (la 303) ; à fond, le filtre monte d'une octave quand la note monte d'une octave, les notes hautes restent aussi brillantes que les graves.",
    tip: "Vers 50 % pour une ligne qui saute d'octave sans que les notes hautes paraissent étouffées.",
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
    text: "Après la montée, le volume descend vers SUSTAIN en ce temps-là, de 20 ms à 4 s. Avec SUSTAIN au maximum (réglage d'usine), il ne se passe rien : la note reste pleine tant qu'elle est tenue.",
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

  /* ---------- les pages et les encodeurs (2026-10-08) ---------- */
  pvoice: {
    section: 'PAGES',
    title: 'VOICE',
    text: "Les huit encodeurs règlent la voix : WAVE, PW, SUB, SUB OCT, OCTAVE, TUNE et GLIDE. La LED dit la page allumée ; les touches [ et ] passent d'une page à l'autre.",
    tip: "En LOCK, une touche de page à demi allumée porte déjà des verrous sur ce pas.",
  },
  pfilter: {
    section: 'PAGES',
    title: 'FILTER',
    text: "Les huit encodeurs règlent le filtre de la 303 : CUTOFF, RESO, ENV MOD, DECAY, ACCENT, ACC DECAY, SWEEP et KEY TRK. C'est la page de départ.",
  },
  penv: {
    section: 'PAGES',
    title: 'ENV',
    text: "Les huit encodeurs règlent l'enveloppe de l'ampli : ATTACK, AMP DECAY, SUSTAIN, RELEASE, la longueur des notes (LENGTH) et VOLUME.",
  },
  pfx: {
    section: 'PAGES',
    title: 'FX',
    text: "Les huit encodeurs règlent les effets : DRIVE, l'envoi DELAY avec son temps et son retour, l'envoi REVERB avec sa durée et sa couleur. Les envois se verrouillent pas par pas ; le temps, le retour, la durée et la couleur sont globaux.",
  },
  enc: {
    section: 'ENCODERS',
    title: 'ENCODER',
    text: "Les huit encodeurs A à H règlent la page allumée (VOICE, FILTER, ENV, FX) ; leur valeur est à l'écran, de 0 à 127, dans le bloc à leur place. Ils sont sans fin : rien ne saute quand tu changes de page. Cette case est vide sur cette page.",
  },
  ikey: {
    section: 'SCREEN',
    title: 'INFOS',
    text: "Allume l'aide : survole n'importe quelle commande du MM-BASS (au téléphone, touche-la, sans la changer) pour lire ce qu'elle fait ; un encodeur montre le réglage qu'il tient sur la page allumée. Le i se remplit tant que c'est allumé ; touche-le encore, ou Échap, pour l'éteindre.",
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
    text: "Efface la ligne ; en LOCK, seulement les verrous du pas (toutes les pages).",
  },
  accentkey: {
    section: 'KEYS',
    title: 'ACCENT',
    text: "Met ou enlève l'accent sur le pas choisi ; le potard ACCENT règle sa force.", keys: "Touche A.",
  },
  slide: {
    section: 'KEYS',
    title: 'SLIDE',
    text: "Fait glisser la note du pas choisi vers la suivante, sans la relâcher ; GLIDE règle la durée.", keys: "Touche S.",
  },
  notedn: {
    section: 'KEYS',
    title: 'NOTE -',
    text: "Un degré de la gamme plus bas sur le pas choisi ; tu peux aussi glisser sur le pas.", keys: "Flèche du bas.",
  },
  noteup: {
    section: 'KEYS',
    title: 'NOTE +',
    text: "Un degré de la gamme plus haut sur le pas choisi ; tu peux aussi glisser sur le pas.", keys: "Flèche du haut.",
  },
  octdn: {
    section: 'KEYS',
    title: 'OCT -',
    text: "Une octave plus bas sur le pas choisi (de -1 à +2).", keys: "Touche Z.",
  },
  octup: {
    section: 'KEYS',
    title: 'OCT +',
    text: "Une octave plus haut sur le pas choisi (de -1 à +2).", keys: "Touche X.",
  },
  edit: {
    section: 'KEYS',
    title: 'EDIT',
    text: "Les 16 pas deviennent 16 patterns : touche un pas pour jouer son pattern à la mesure, plusieurs à la suite pour les enchaîner, tiens un vide pour y copier la ligne. L'écran montre la ligne en rouleau et, dessous, les verrous de la page allumée, pas par pas (change de page pour voir les autres).", keys: "Touche E.",
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
    text: "Ce pas passe en LOCK : sa LED clignote, l'écran affiche en négatif LOCK suivi du numéro du pas. Choisis la partie à changer avec une touche de page (VOICE, FILTER, ENV, FX), puis tourne un encodeur : ce réglage ne change plus que sur ce pas, son bloc passe en négatif. Double tape sur l'encodeur pour enlever ce verrou, CLEAR pour tous ceux du pas ; réappuie sur LOCK, ou Échap, pour sortir.",
    tip: "Un CUTOFF plus ouvert sur le pas 16, c'est une relance acid instantanée.",
  },
  trig: {
    section: 'STEPS',
    title: 'STEPS',
    text: "Touche un pas : vide, note, liaison, vide ; glisse dessus pour changer sa note. Tiens-le et tourne un encodeur : ce réglage est verrouillé sur ce pas, comme sur une Elektron (un appui long seul garde le LOCK). Quand la lecture passe sur un pas verrouillé, ses blocs passent en négatif à l'écran.",
    tip: "Au téléphone, un doigt tient le pas, un autre tourne l'encodeur.",
  },
  screen: {
    section: 'SCREEN',
    title: 'SCREEN',
    text: "La page des huit encodeurs : chaque bloc est à la place de son encodeur (A en haut à gauche, H en bas à droite), avec sa valeur de 0 à 127 et son unité. En LOCK, les réglages verrouillés sur le pas sont en négatif ; en lecture, ceux du pas qui joue s'allument le temps du pas. Dessous, les 16 pas : un point sur chaque pas verrouillé (plein : sur cette page). Glisse sur un bloc : c'est son encodeur. Touche l'en-tête (le pattern, A01) pour les presets, le petit i pour INFOS.",
  },

  /* ---------- sous le capot ---------- */
  infos: {
    section: 'TWEAKS',
    title: 'INFOS',
    text: "Allume l'aide : survole un potard, un encodeur ou une touche du MM-BASS ; au téléphone, touche-le, sans le changer. Le petit i dans le coin de l'écran fait la même chose. Réappuie, ou touche la pastille, pour l'éteindre.",
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
  decay: {
    text: "Le temps que met le filtre à se refermer après chaque note, de 120 ms à 2,5 s : court pour des notes sèches, long pour des notes qui respirent. Une note accentuée garde sa décroissance courte (ACC DECAY, le bloc voisin), comme sur la 303, sauf si DECAY est verrouillé sur son pas.",
  },
  accent: {
    text: "La force des pas accentués (touche ACCENT, pas orange vif) : plus de volume, un filtre qui s'ouvre plus haut et plus court. Les accents qui se suivent s'additionnent et le filtre monte encore, le fameux wow de la 303 (SWEEP, deux blocs plus loin). Verrouillé sur un pas sans accent, il lui donne l'accent.",
  },
  pvoice: { text: "Les huit blocs de l'écran règlent la voix : WAVE, PW, SUB, SUB OCT, OCTAVE, TUNE et GLIDE. La LED dit la page allumée, l'onglet de l'écran aussi." },
  pfilter: { text: "Les huit blocs de l'écran règlent le filtre de la 303 : CUTOFF, RESO, ENV MOD, DECAY, ACCENT, ACC DECAY, SWEEP et KEY TRK. C'est la page de départ." },
  penv: { text: "Les huit blocs de l'écran règlent l'enveloppe de l'ampli : ATTACK, AMP DECAY, SUSTAIN, RELEASE, la longueur des notes (LENGTH) et VOLUME." },
  pfx: { text: "Les huit blocs de l'écran règlent les effets : DRIVE, l'envoi DELAY avec son temps et son retour, l'envoi REVERB avec sa durée et sa couleur. Les envois se verrouillent pas par pas ; le temps, le retour, la durée et la couleur sont globaux." },
  cutoff: {
    text: "La fréquence où le filtre de la 303 commence à couper les aigus, de 60 Hz à 6 kHz : à gauche sombre, à droite ouvert et brillant. C'est le geste principal de la machine, glisse son bloc pendant que ça joue.",
  },
  accents: { text: "La chance qu'une note soit accentuée quand tu appuies sur GEN. Ce n'est pas le bloc ACCENT (page FILTER, E), qui règle la force de l'accent." },
  accentkey: { text: "Met ou enlève l'accent sur le pas choisi ; le bloc ACCENT de l'écran (page FILTER, E) règle sa force." },
  enc: {
    section: 'SCREEN',
    title: 'VALUE',
    text: "Les huit blocs de l'écran règlent la page allumée (VOICE, FILTER, ENV, FX, les touches sous l'écran) : glisse un bloc vers le haut ou le bas pour changer sa valeur, de 0 à 127 ; deux tapes la remettent à sa valeur de départ. Cette case est vide sur cette page.",
  },
  ikey: { text: "Allume l'aide : touche n'importe quelle commande du MM-BASS pour lire ce qu'elle fait, sans la changer ; un bloc de l'écran montre le réglage qu'il tient sur la page allumée. Le i se remplit tant que c'est allumé ; touche-le encore pour l'éteindre." },
  lock: {
    text: "Ce pas passe en LOCK : sa LED clignote, l'écran affiche en négatif LOCK suivi du numéro du pas. Choisis la partie à changer avec une touche de page (VOICE, FILTER, ENV, FX, sous l'écran), puis glisse un bloc de l'écran : ce réglage ne change plus que sur ce pas, son bloc passe en négatif. Deux tapes sur le bloc enlèvent ce verrou, CLEAR tous ceux du pas ; réappuie sur LOCK pour sortir.",
  },
  trig: {
    text: "Touche un pas : vide, note, liaison, vide ; glisse dessus pour changer sa note. Tiens-le d'un doigt et glisse un bloc de l'écran d'un autre : ce réglage est verrouillé sur ce pas, comme sur une Elektron (un appui long seul garde le LOCK). Quand la lecture passe sur un pas verrouillé, ses blocs passent en négatif à l'écran.",
    tip: "Lâche le pas avant le bloc si tu veux : le verrou s'écrit jusqu'au lâcher du bloc.",
  },
  screen: {
    text: "Les huit blocs sont les commandes : glisse un bloc vers le haut pour monter sa valeur (de 0 à 127, son unité dessous), deux tapes pour sa valeur de départ ; le bloc que ton doigt tient est cerné. En LOCK, les réglages verrouillés sur le pas sont en négatif ; en lecture, ceux du pas qui joue s'allument le temps du pas. Dessous, les 16 pas : un point sur chaque pas verrouillé (plein : sur cette page). En haut, touche un onglet pour sa page, le pattern (A01) pour les presets, le petit i pour INFOS.",
  },
  infos: { text: "Allume l'aide : touche un bloc de l'écran, un potard ou une touche du MM-BASS pour lire ce qu'il fait, sans le changer. Le petit i dans le coin de l'écran fait la même chose. Réappuie, ou touche la pastille, pour l'éteindre." },
};

const KNOBS: ReadonlySet<string> = new Set(BASS_KNOBS.map((k) => k.id));

/** La section d'un reglage d'une page : ou le trouver (FILTER B), et sous le capot s'il y est aussi (2026-10-08). */
function sectionOf(id: string, raw: string): string {
  if (!KNOBS.has(id)) return raw;
  const at = bassSlotOf(id as BassKnobId);
  if (!at) return raw;
  const plate = BASS_KNOBS.find((k) => k.id === id)?.plate;
  return `${bassPageDef(at.page).label} ${ENC_LETTERS[at.k]}${plate ? ' / TWEAKS' : ''}`;
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
  // Un encodeur (2026-10-08) : le reglage qu'il tient sur la page allumee ; un bloc de l'ecran, celui de son encodeur
  const enc = /^bass-(enc|blk)-(\d)$/.exec(hotspotId);
  if (enc) return bassPage.slot(Number(enc[2]) - 1) ?? 'enc';
  if (hotspotId === 'bass-key-i') return 'ikey';
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
