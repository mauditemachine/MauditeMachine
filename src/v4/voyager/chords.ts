/**
 * Les huit pads du MM-VOYAGER : huit accords de fa diese mineur, la
 * tonalite de Mika (sa reference de production : F# mineur, 123 BPM). Un
 * pad touche entre dans la progression (un accord par mesure, dans l'ordre
 * des tapes), retouche il en sort ; l'arpegiateur joue la progression.
 * Toutes les notes sont dans la gamme : rien ne sonne faux, quoi qu'on
 * touche.
 *
 * Le plugin MM-ARP a sa banque (v43, 2026-11-20, Mika : "les notes.. pourquoi
 * on a pas toutes les fondamentales finalement ? arrange ca !") : les sept
 * degres de fa diese mineur naturel dans l'ordre (i a VII : le ii manquait),
 * puis i7 ; le site garde les siens (SITE_CHORDS). CHORDS est l'une ou
 * l'autre, choisie a l'evaluation (PLUGIN_ARP, comme le reste de la face).
 *
 * v52 (2026-11-24, Mika : "pourquoi on a pas toutes les notes ?", choix 2A) :
 * la tonalite au choix dans le plugin (xKey : les 12 notes, xScale : MINOR,
 * MAJOR, DORIAN, PHRYGIAN ; plugin/arp/KeySelect.tsx). Les 8 pads suivent :
 * les 7 degres de la gamme dans l'ordre puis l'accord de tonique a 4 sons
 * (arpKey plus bas). Le site garde F# mineur (arpKey.set ne fait rien hors du
 * plugin) ; le C++ pose les memes notes (dsp/Params.cpp keyOf).
 */

import { PLUGIN_ARP } from '../theme/base';

/** Notes MIDI (60 = do 4) ; la racine de chaque accord est posee dans l'octave de fa diese 3. */
const FS3 = 54;

export interface Chord {
  /** serigraphie du pad */
  label: string;
  /** nom lu : "F sharp minor" */
  aria: string;
  /** intervalles depuis la racine */
  tones: readonly number[];
  /** racine, en demi-tons au-dessus de la tonique (fa diese ; v52, le plugin : celle de la tonalite choisie) */
  root: number;
  /** son degre en fa diese mineur (i, VI, iiø...) : l'ecran le montre sous le nom */
  roman: string;
  /** sa cle Camelot (le cercle des DJ) ; '' : aucune (un accord diminue n'en a pas) */
  camelot: string;
}

/** Les huit accords du site, inchanges (leurs degres et cles Camelot etaient dans voyager/screen.ts). */
export const SITE_CHORDS: readonly Chord[] = [
  { label: 'F#m', aria: 'F sharp minor', root: 0, tones: [0, 3, 7], roman: 'i', camelot: '11A' },
  { label: 'D', aria: 'D major', root: 8, tones: [0, 4, 7], roman: 'VI', camelot: '10B' },
  { label: 'E', aria: 'E major', root: 10, tones: [0, 4, 7], roman: 'VII', camelot: '12B' },
  { label: 'C#m', aria: 'C sharp minor', root: 7, tones: [0, 3, 7], roman: 'v', camelot: '12A' },
  { label: 'Bm', aria: 'B minor', root: 5, tones: [0, 3, 7], roman: 'iv', camelot: '10A' },
  { label: 'A', aria: 'A major', root: 3, tones: [0, 4, 7], roman: 'III', camelot: '11B' },
  { label: 'F#m7', aria: 'F sharp minor seven', root: 0, tones: [0, 3, 7, 10], roman: 'i7', camelot: '11A' },
  { label: 'Dmaj7', aria: 'D major seven', root: 8, tones: [0, 4, 7, 11], roman: 'VImaj7', camelot: '10B' },
];

/**
 * La banque du plugin MM-ARP (v43) : un pad par degre de fa diese mineur naturel (F# G# A B C# D E), dans l'ordre de la
 * gamme, puis F#m7. Le ii est G#ø (G#m7b5 : G# B D F#) plutot que G#dim (G# B D) : la triade diminuee seule sonne
 * tendue et scolaire (son triton a nu) ; la septieme ajoute F#, la tonique : l'accord devient Bm pose sur G# (les memes
 * B D F# que le iv), il garde la note de l'accord de depart et glisse vers iv, v ou i sans heurt, la couleur sombre et
 * suspendue de la dark disco et de l'italo. Ses quatre notes sont dans la gamme (CHORD 7TH les donnait deja a G#dim).
 * Dmaj7 quitte les pads : CHORD 7TH le rend sur D (la septieme de la gamme), comme Amaj7 sur A.
 *
 * v52 : la banque suit la tonalite choisie (arpKey.set) ; au depart, F# MINOR : F#m G#ø A Bm C#m D E F#m7, exactement les
 * accords de la v43 (tests/params-ref.mjs le verifie champ par champ).
 */

/* ---------------- v52 : la tonalite du plugin ---------------- */

/** Les 12 toniques (xKey, crans 0..11), en dieses : jamais de bemol. */
export const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
/** Les modes (xScale, crans 0..3). */
export const MODE_NAMES = ['MINOR', 'MAJOR', 'DORIAN', 'PHRYGIAN'] as const;
/** Leurs gammes, en demi-tons au-dessus de la tonique (MINOR : le mineur naturel, eolien). */
export const MODE_SCALES: readonly (readonly number[])[] = [
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 3, 5, 7, 9, 10],
  [0, 1, 3, 5, 7, 8, 10],
];
/** Le depart : F# MINOR (xKey 6, xScale 0), la tonalite d'avant. */
export const KEY_DEF = 6;
export const MODE_DEF = 0;
/**
 * La regle de hauteur : la tonique entre do 3 (48) et si 3 (59), soit au plus six demi-tons sous fa diese 3 et cinq
 * au-dessus (F# : 54, FS3 d'avant, au bit pres) ; les degres et les accords se posent au-dessus d'elle comme avant.
 */
export const tonicMidi = (key: number): number => 48 + key;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;
const spoken = (pc: number): string => KEY_NAMES[pc].replace('#', ' sharp');
/** Le numero Camelot d'une tonalite majeure (do : 8, sol : 9...) ; une mineure prend celui de son relatif majeur. */
const camelotNum = (pcMajor: number): number => ((((7 * pcMajor) % 12) + 7) % 12) + 1;

/**
 * Les 8 accords d'une tonalite : les triades des sept degres de la gamme (le degre diminue en demi-diminue a quatre sons,
 * comme G#ø), puis la tonique a quatre sons (m7, maj7 en MAJOR). Noms en dieses, ø pour demi-diminue.
 */
export function keyChords(key: number, mode: number): Chord[] {
  const sc = MODE_SCALES[mode] ?? MODE_SCALES[0];
  const up = (d: number, k: number): number => (sc[(d + k) % 7] - sc[d] + 12) % 12;
  const out: Chord[] = [];
  for (let i = 0; i < 8; i += 1) {
    const d = i % 7;
    const third = up(d, 2);
    const fifth = up(d, 4);
    const pc = (key + sc[d]) % 12;
    const dim = fifth === 6;
    const major = third === 4;
    const seventh = i === 7 || dim;
    const tones = seventh ? [0, third, fifth, up(d, 6)] : [0, third, fifth];
    const num = major ? ROMAN[d] : ROMAN[d].toLowerCase();
    const name = KEY_NAMES[pc];
    let label: string;
    let aria: string;
    let roman: string;
    if (dim) {
      label = `${name}ø`;
      aria = `${spoken(pc)} half diminished seven`;
      roman = `${num}ø`;
    } else if (i === 7) {
      label = major ? `${name}maj7` : `${name}m7`;
      aria = `${spoken(pc)} ${major ? 'major' : 'minor'} seven`;
      roman = major ? `${num}maj7` : `${num}7`;
    } else {
      label = major ? name : `${name}m`;
      aria = `${spoken(pc)} ${major ? 'major' : 'minor'}`;
      roman = num;
    }
    const camelot = dim ? '' : major ? `${camelotNum(pc)}B` : `${camelotNum((pc + 3) % 12)}A`;
    out.push({ label, aria, root: sc[d], tones, roman, camelot });
  }
  return out;
}

const ARP_BANK: Chord[] = keyChords(KEY_DEF, MODE_DEF);
export const ARP_CHORDS: readonly Chord[] = ARP_BANK;

/** Les accords des pads : ceux du plugin MM-ARP, ou ceux du site. */
export const CHORDS: readonly Chord[] = PLUGIN_ARP ? ARP_CHORDS : SITE_CHORDS;

/**
 * La marque de la banque du plugin dans ce qu'il garde (le programme envoye au C++, la progression de l'etat du projet,
 * un preset sur le disque, un preset de l'ecran, un son mis de cote) : chordBank 2. Sans elle, une progression est en
 * indices du site (SITE_CHORDS : un projet ou un preset d'avant la v43, la banque d'usine, un preset du site) et le
 * plugin la convertit au chargement (la meme table en C++ : plugin/mm-arp/dsp/Params.cpp kSiteToArp).
 */
export const ARP_CHORD_BANK = 2;

/**
 * Un accord du site dans la banque du plugin : le meme accord (F#m D E C#m Bm A F#m7 -> 0 5 6 4 3 2 7) ; Dmaj7, qui
 * n'a plus de pad, devient D (le meme accord sans sa septieme ; CHORD 7TH la rend).
 */
export const SITE_TO_ARP: readonly number[] = [0, 5, 6, 4, 3, 2, 7, 5];

/**
 * Une progression gardee, dans la banque du plugin : telle quelle si elle porte ARP_CHORD_BANK, sinon (des indices du
 * site) convertie par SITE_TO_ARP ; une entree illisible est laissee de cote. Pour le plugin seulement : le site garde
 * ses indices tels quels.
 */
export function arpProgOf(prog: unknown, bank: unknown): number[] {
  if (!Array.isArray(prog)) return [];
  const ok = prog.filter((k): k is number => typeof k === 'number' && Number.isInteger(k) && k >= 0 && k < SITE_TO_ARP.length);
  return bank === ARP_CHORD_BANK ? ok : ok.map((k) => SITE_TO_ARP[k]);
}

/** Une progression ecrite en indices du site, dans la banque du moment : convertie dans le plugin, telle quelle sur le site. */
export const fromSiteProg = (p: readonly number[]): readonly number[] => (PLUGIN_ARP ? p.map((k) => SITE_TO_ARP[k] ?? 0) : p);

/**
 * Progressions de RANDOM (indices de CHORDS) : des enchainements qui
 * marchent en indie dance et en dark disco. Ecrites en indices du site ; le
 * plugin les prend converties (fromSiteProg) : les memes accords, le meme
 * sens (F#m D A E reste F#m D A E ; Dmaj7 y devient D).
 */
export const PROGRESSIONS: readonly (readonly number[])[] = [
  [0, 1, 5, 2],
  [0, 2, 1, 3],
  [4, 0, 1, 2],
  [0, 5, 2, 4],
  [6, 7, 2, 3],
  [0, 0, 1, 2],
  [0, 3, 1, 2],
  [6, 4, 7, 2],
].map(fromSiteProg);

/**
 * La suite en degres (2026-10-04, la suite modifiable, voyager/seq.ts) :
 * une note est un degre de fa diese mineur naturel au-dessus de la racine
 * de l'accord (0 la racine, 2 la tierce, 4 la quinte, 6 la septieme, 7
 * l'octave). Les huit accords sont tous dans la gamme : leurs notes sont
 * les degres pairs, et la meme suite suit la progression sans sortir de la
 * tonalite. v52 (le plugin) : la gamme et la tonique de la tonalite choisie
 * (TONIC, SCALE : F# mineur au depart, et toujours sur le site).
 */
let TONIC = FS3;
let SCALE: readonly number[] = MODE_SCALES[MODE_DEF];
let keyNow: { key: number; mode: number } = { key: KEY_DEF, mode: MODE_DEF };
const keyListeners = new Set<() => void>();

/**
 * v52 : la tonalite du plugin (xKey, xScale ; plugin/arp/KeySelect.tsx la suit). set rebat la banque (ARP_CHORDS, les
 * memes objets que CHORDS dans le plugin), la tonique et la gamme, puis previent (la serigraphie, l'ecran, la page SEQ).
 * Hors du plugin, set ne fait rien : le site reste en F# mineur.
 */
export const arpKey = {
  get: (): { key: number; mode: number } => keyNow,
  set(key: number, mode: number): boolean {
    if (!PLUGIN_ARP) return false;
    const k = Math.max(0, Math.min(11, Math.round(key)));
    const m = Math.max(0, Math.min(MODE_SCALES.length - 1, Math.round(mode)));
    if (k === keyNow.key && m === keyNow.mode) return false;
    keyNow = { key: k, mode: m };
    TONIC = tonicMidi(k);
    SCALE = MODE_SCALES[m];
    keyChords(k, m).forEach((c, i) => (ARP_BANK[i] = c));
    keyListeners.forEach((fn) => fn());
    return true;
  },
  subscribe(fn: () => void): () => void {
    keyListeners.add(fn);
    return () => {
      keyListeners.delete(fn);
    };
  },
};

/** La tonalite en clair : "F# MINOR" (sans Camelot). */
export const keyName = (): string => `${KEY_NAMES[keyNow.key]} ${MODE_NAMES[keyNow.mode]}`;
/**
 * Sa cle Camelot (le cercle des DJ : celui des tonalites majeures et mineures) ; '' pour DORIAN et PHRYGIAN, qui n'y
 * sont pas.
 */
export function keyCamelot(): string {
  const { key, mode } = keyNow;
  if (mode === 0) return `${camelotNum((key + 3) % 12)}A`;
  if (mode === 1) return `${camelotNum(key)}B`;
  return '';
}
/** La ligne de l'ecran : "F# MINOR  11A" (le site, et le plugin au depart). */
export const keyLine = (): string => {
  const cam = keyCamelot();
  return cam ? `${keyName()}  ${cam}` : keyName();
};

/** La tonique en note MIDI (54 : fa diese 3, au depart et sur le site). */
export const keyTonic = (): number => TONIC;

/** La classe de hauteur (0 do .. 11 si) de la racine de l'accord i. */
export const chordRootPc = (i: number): number => (((TONIC + (CHORDS[i]?.root ?? 0)) % 12) + 12) % 12;

/** Notes de l'accord dans une octave : racine ramenee entre fa diese 3 et mi 4 (v52 : au-dessus de la tonique), tri montant. */
export function chordNotes(i: number): number[] {
  const c = CHORDS[i];
  if (!c) return [];
  const root = TONIC + c.root;
  return c.tones.map((t) => root + t).sort((a, b) => a - b);
}

export type ArpMode = 0 | 1 | 2 | 3;

/**
 * La suite de l'arpege pour un accord : ses notes sur `oct` octaves, puis
 * l'ordre du mode : montant, descendant, aller-retour (sans repeter les
 * bouts), ou au hasard (tire a chaque note par l'appelant : la suite
 * montante sert de reserve).
 */
export function arpSequence(i: number, oct: number, mode: ArpMode): number[] {
  const base = chordNotes(i);
  const up: number[] = [];
  for (let o = 0; o < oct; o += 1) for (const n of base) up.push(n + 12 * o);
  if (mode === 1) return up.slice().reverse();
  if (mode === 2) return up.length > 2 ? up.concat(up.slice(1, -1).reverse()) : up;
  return up;
}

/** Le degre de la gamme sur lequel tombe la racine de l'accord i (F#m : 0, D : 5). */
function rootDegree(i: number): number {
  const r = CHORDS[i]?.root ?? 0;
  return Math.max(0, SCALE.findIndex((x) => x === r));
}

/** La note MIDI du degre d au-dessus de la racine de l'accord i (celle de chordNotes pour ses degres pairs). */
export function degreeMidi(i: number, d: number): number {
  const k = rootDegree(i) + d;
  return TONIC + 12 * Math.floor(k / 7) + SCALE[((k % 7) + 7) % 7];
}

/** Le nom de cette note (sans octave) : F#, G#, A, B, C#, D, E (v52 : ceux de la gamme choisie, en dieses). */
export function degreeName(i: number, d: number): string {
  const k = rootDegree(i) + d;
  return KEY_NAMES[(TONIC + SCALE[((k % 7) + 7) % 7]) % 12];
}

/**
 * CHORD (2026-10-05, Mika : "je trouve les arpeges un peu grossiers, y a
 * pas plus de notes qu'on peut mettre ?"). L'arpege d'avant (BASIC, type 0)
 * part de la racine de chaque accord : D et E sautent d'une sixte au-dessus
 * de F#m, l'arpege monte et descend d'un accord a l'autre, toujours trois
 * notes. TRIAD, 7TH, 9TH, 11TH (types 1 a 4) posent chaque accord dans la
 * meme octave, de fa diese 3 a fa 4 : les notes communes restent, les
 * autres bougent d'un ton au plus (l'enchainement d'un clavieriste) ; 7TH
 * ajoute la septieme de la gamme (F#m7, Dmaj7, E7, C#m7, Bm7, Amaj7) ;
 * 9TH et 11TH ajoutent leurs notes au-dessus, une octave plus haut (une
 * grappe au grave sonnerait sale). Les notes qui frottent sont evitees :
 * la neuvieme mineure de C#m devient sa onzieme, la onzieme juste des
 * accords majeurs (A, E) leur treizieme. Les degres sont comptes depuis la
 * racine (degreeMidi) : ceux sous la racine sont negatifs.
 */
export const CHORD_TYPE = { basic: 0, triad: 1, seventh: 2, ninth: 3, eleventh: 4 } as const;

const mod7 = (k: number): number => ((k % 7) + 7) % 7;

/** L'ecart en demi-tons (0 a 11) entre la racine de l'accord i et son degre c. */
function interval(i: number, c: number): number {
  const r = rootDegree(i);
  return (SCALE[mod7(r + c)] - SCALE[r] + 12) % 12;
}

/** Les degres (0 a 6) de l'accord, extensions comprises, pour CHORD. */
function chordClasses(i: number, type: number): { base: number[]; ext: number[] } {
  const n = CHORDS[i]?.tones.length ?? 3;
  if (type <= CHORD_TYPE.basic) return { base: Array.from({ length: n }, (_, j) => 2 * j), ext: [] };
  const base = type === CHORD_TYPE.triad && n < 4 ? [0, 2, 4] : [0, 2, 4, 6];
  const ext: number[] = [];
  if (type >= CHORD_TYPE.ninth) {
    const major = (CHORDS[i]?.tones ?? []).includes(4);
    const nine = interval(i, 1) !== 1;
    // La onzieme juste d'un accord majeur frotte contre sa tierce : la treizieme a sa place
    const eleven = major && interval(i, 3) === 5 ? (interval(i, 5) !== 8 ? 5 : -1) : 3;
    if (nine) ext.push(1);
    if (type >= CHORD_TYPE.eleventh || !nine) {
      if (eleven >= 0) ext.push(eleven);
    }
  }
  return { base, ext };
}

/** Les degres (0 a 6) des notes de l'accord selon CHORD : les filets de la suite (ui/SeqLane.tsx). */
export const chordTones = (i: number, type: number): number[] => {
  const c = chordClasses(i, type);
  return c.base.concat(c.ext);
};

/** Le degre de la classe c dans l'octave o de la fenetre (o = 0 : fa diese 3 a fa 4). */
const inWindow = (i: number, c: number, o: number): number => {
  const r = rootDegree(i);
  return mod7(r + c) - r + 7 * o;
};

/**
 * Les notes de l'accord i, montantes, sur `oct` octaves, pour CHORD :
 * BASIC depuis la racine (l'arpege d'avant), sinon l'accord pose dans la
 * fenetre de fa diese 3, repete a chaque octave ; les extensions au sommet,
 * chacune juste au-dessus de la precedente (dans l'octave du haut, une
 * gamme de secondes sonnerait comme un exercice, pas comme un arpege).
 */
export function voicedDegrees(i: number, oct: number, type: number): number[] {
  const { base, ext } = chordClasses(i, type);
  const out: number[] = [];
  if (type <= CHORD_TYPE.basic) {
    for (let o = 0; o < oct; o += 1) for (const b of base) out.push(7 * o + b);
    return out;
  }
  const low = base.map((b) => inWindow(i, b, 0)).sort((a, b) => a - b);
  for (let o = 0; o < oct; o += 1) for (const d of low) out.push(d + 7 * o);
  let top = out[out.length - 1] ?? 0;
  for (const e of ext) {
    let d = inWindow(i, e, 0);
    while (d <= top) d += 7;
    out.push(d);
    top = d;
  }
  return out;
}

/** La suite de l'arpege en degres : les notes de CHORD dans l'ordre du mode (BASIC : arpSequence, note pour note). */
export function arpDegrees(i: number, oct: number, mode: ArpMode, type: number = CHORD_TYPE.basic): number[] {
  if (!CHORDS[i]) return [];
  const up = voicedDegrees(i, oct, type);
  if (mode === 1) return up.slice().reverse();
  if (mode === 2) return up.length > 2 ? up.concat(up.slice(1, -1).reverse()) : up;
  return up;
}

export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
