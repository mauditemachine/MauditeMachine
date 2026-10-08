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
 */

import { BASS_KNOBS, type BassKnobId } from './params';
import type { BassKeyKind } from './theme';

export type BassInfoId = BassKnobId | Exclude<BassKeyKind, 'accent'> | 'accentkey' | 'trig' | 'lock' | 'screen' | 'infos' | 'close';

export interface BassInfo {
  /** la section du panneau (OSC, FILTER...), en petites capitales sur la carte */
  section: string;
  /** le nom serigraphie */
  title: string;
  text: string;
  tip?: string;
}

/** Les espaces insecables du francais (Quebec) et l'apostrophe typographique. */
const fr = (s: string): string =>
  s
    .replace(/([A-Za-zÀ-ÿ])'([A-Za-zÀ-ÿ])/g, '$1’$2')
    .replace(/ :/g, ' :')
    .replace(/(\d) (ms|s|Hz|kHz|dB|dBFS|%|cents|octaves?|pas|mesures?|BPM)(?![A-Za-zÀ-ÿ])/g, '$1 $2');

const RAW: Record<BassInfoId, BassInfo> = {
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
    text: "Combien de notes GEN écrit : à gauche une ligne aérée, à droite une ligne qui remplit la mesure. En SUB, c'est le nombre de changements de note par mesure, de 1 à 4. Le potard change la recette : tu l'entends au prochain GEN.",
    tip: "Vers 60 % pour l'indie dance, 80 % et plus pour une acid qui roule.",
  },
  gen: {
    section: 'GENERATOR',
    title: 'GEN',
    text: "Écrit une nouvelle ligne de 16 pas avec STYLE et DENSITY, dans la gamme de ROOT et SCALE (sous le capot, OPEN). Si rien ne joue, la ligne part tout de suite. Touche G.",
    tip: "Appuie jusqu'à ce qu'une ligne t'accroche, puis garde-la dans un pattern avec EDIT.",
  },
  mutate: {
    section: 'GENERATOR',
    title: 'MUTATE',
    text: "Change 2 à 4 pas : une note, un accent, un slide, une octave, un pas qui apparaît ou disparaît ; le reste ne bouge pas. Touche M.",
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
    text: "Le temps que met le filtre à se refermer après chaque note, de 120 ms à 2,5 s : court pour des notes sèches, long pour des notes qui respirent. Une note accentuée garde sa décroissance courte (ACC DECAY, sous le capot), comme sur la 303.",
    tip: "Moins de 250 ms en EBM et en psy prog, plus long en house.",
  },

  /* ---------- ACCENT / SLIDE ---------- */
  accent: {
    section: 'ACCENT / SLIDE',
    title: 'ACCENT',
    text: "La force des pas accentués (touche ACCENT, pas orange vif) : plus de volume, un filtre qui s'ouvre plus haut et plus court. Les accents qui se suivent s'additionnent et le filtre monte encore, le fameux wow de la 303 (SWEEP, sous le capot).",
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
    text: "Le niveau du MM-BASS vers le master (la voie 2 du MIXER). Le réglage d'usine crête vers -6 dBFS, 2 dB sous le kick du MM-RYTM, qui sert de référence.",
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
    text: "Jusqu'où les notes générées peuvent monter : 1 octave pour une ligne serrée et hypnotique, 3 pour des sauts plus fous. Tu l'entends au prochain GEN.",
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

  /* ---------- les touches ---------- */
  run: {
    section: 'KEYS',
    title: 'RUN',
    text: "Lance ou arrête la ligne, calée sur le MM-RYTM s'il joue (sinon le MM-ARP, sinon le tempo). Touche Espace.",
  },
  clear: {
    section: 'KEYS',
    title: 'CLEAR',
    text: "Efface la ligne ; en LOCK, seulement les verrous du pas.",
  },
  accentkey: {
    section: 'KEYS',
    title: 'ACCENT',
    text: "Met ou enlève l'accent sur le pas choisi ; le potard ACCENT règle sa force. Touche A.",
  },
  slide: {
    section: 'KEYS',
    title: 'SLIDE',
    text: "Fait glisser la note du pas choisi vers la suivante, sans la relâcher ; GLIDE règle la durée. Touche S.",
  },
  notedn: {
    section: 'KEYS',
    title: 'NOTE -',
    text: "Un degré de la gamme plus bas sur le pas choisi ; tu peux aussi glisser sur le pas. Flèche du bas.",
  },
  noteup: {
    section: 'KEYS',
    title: 'NOTE +',
    text: "Un degré de la gamme plus haut sur le pas choisi ; tu peux aussi glisser sur le pas. Flèche du haut.",
  },
  octdn: {
    section: 'KEYS',
    title: 'OCT -',
    text: "Une octave plus bas sur le pas choisi (de -1 à +2). Touche Z.",
  },
  octup: {
    section: 'KEYS',
    title: 'OCT +',
    text: "Une octave plus haut sur le pas choisi (de -1 à +2). Touche X.",
  },
  edit: {
    section: 'KEYS',
    title: 'EDIT',
    text: "Les 16 pas deviennent 16 patterns : touche un pas pour jouer son pattern à la mesure, plusieurs à la suite pour les enchaîner, tiens un vide pour y copier la ligne. Touche E.",
  },
  open: {
    section: 'KEYS',
    title: 'OPEN',
    text: "Soulève le capot : les règles du générateur, les réglages fins de la voix et INFOS. Touche O.",
  },

  /* ---------- les pas ---------- */
  lock: {
    section: 'STEPS',
    title: 'LOCK',
    text: "Ce pas prend les potards du son : chaque potard que tu tournes ne change plus que lui. Double tape sur un potard pour enlever son verrou, réappuie sur LOCK pour sortir.",
    tip: "Un CUTOFF plus ouvert sur le pas 16, c'est une relance acid instantanée.",
  },
  trig: {
    section: 'STEPS',
    title: 'STEPS',
    text: "Touche un pas : vide, note, liaison, vide ; glisse dessus pour changer sa note. Tiens-le et tourne un potard pour le verrouiller sur ce pas, comme sur une Elektron.",
    tip: "Au téléphone, un doigt tient le pas, un autre tourne le potard.",
  },
  screen: {
    section: 'SCREEN',
    title: 'SCREEN',
    text: "La ligne en rouleau, le filtre en direct, le dernier potard tourné ; en LOCK, la grille des verrous du pas. Touche-le pour les presets.",
  },

  /* ---------- sous le capot ---------- */
  infos: {
    section: 'TWEAKS',
    title: 'INFOS',
    text: "Allume l'aide : survole un potard ou une touche du MM-BASS ; au téléphone, touche-le, sans le changer. Réappuie, ou touche la pastille INFOS ON, pour l'éteindre.",
  },
  close: {
    section: 'TWEAKS',
    title: 'CLOSE',
    text: "Referme le capot. INFOS reste allumé : la pastille INFOS ON l'éteint.",
  },
};

export const BASS_INFOS: Record<BassInfoId, BassInfo> = Object.fromEntries(
  Object.entries(RAW).map(([id, x]) => [id, { section: x.section, title: x.title, text: fr(x.text), ...(x.tip ? { tip: fr(x.tip) } : {}) }])
) as Record<BassInfoId, BassInfo>;

const KNOBS: ReadonlySet<string> = new Set(BASS_KNOBS.map((k) => k.id));

/** Un potard ? (sa valeur se lit, son dessin la suit). */
export const isBassInfoKnob = (id: BassInfoId): id is BassKnobId => KNOBS.has(id);

/**
 * L'id INFOS d'un hotspot du MM-BASS : bass-knob-<id> et bass-tw-<id> (la
 * plaque) donnent le potard, bass-key-<kind> la touche (bass-key-accent :
 * accentkey), bass-trig-* les pas, bass-lock-* LOCK, bass-lcd-* l'ecran,
 * bass-tw-infos et bass-tw-close INFOS et CLOSE ; null sinon.
 */
export function bassInfoIdOf(hotspotId: string): BassInfoId | null {
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
  if (hotspotId.startsWith('bass-trig-')) return 'trig';
  if (hotspotId.startsWith('bass-lock-')) return 'lock';
  if (hotspotId.startsWith('bass-lcd-')) return 'screen';
  return null;
}
