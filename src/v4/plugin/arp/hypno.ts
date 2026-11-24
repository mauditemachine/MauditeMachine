/**
 * Les hasards du plugin MM-ARP (2026-11-13, Mika : "les randomisations doivent donner des resultats plus hypnotiques :
 * minimal, repetitif, peu de notes, motifs courts qui bouclent avec petites variations, gamme / accord respectes,
 * gate / accents coherents, pas de chaos"). Le site garde son RANDOM (voyager/random.ts) ; dans le plugin, RANDOM de la
 * face (actions/phone.ts voyRandom, garde par PLUGIN_ARP) et la touche NEW SEQ de la page SEQ passent par ici.
 *
 * Une suite est faite d'une CELLULE de 2 a 4 pas tiree dans tres peu de degres (la racine surtout, la quinte, l'octave,
 * parfois la tierce : chords.ts degreeMidi, un degre de la gamme au-dessus de la racine de l'accord qui joue : la suite
 * reste dans l'accord et la tonalite), repetee jusqu'a 8 ou 16 pas ; la DERNIERE cellule seule varie un peu (une note
 * qui monte a l'octave ou a la quinte, un silence). Les pistes par pas (steps.ts) suivent la meme cellule : l'accent sur
 * sa premiere note, des gates reguliers, au plus un glisse et un ratchet dans la variation, une seule note a 75 %.
 * La progression : un accord, ou deux qui alternent.
 *
 * Trois styles :
 * - HYPNOTIC : cellule de 3 ou 4 notes, legato, la racine qui insiste, une octave qui revient (facon Berlin School) ;
 * - PULSE : la racine repetee, des silences reguliers, gates courts (une pulsation, facon minimal techno) ;
 * - ROLLING : doubles croches roulantes racine - racine - octave - racine, accent sur le temps (facon basse roulante).
 *
 * Tout est deterministe pour un tirage donne (rnd) ; le C++ ne genere rien (il joue la suite et les pistes recues ; ses
 * seuls tirages sont RAND et PROB, a la lecture) : rien a garder coherent de son cote.
 */


import { voyParams } from '../../voyager/params';
import { arp } from '../../voyager/arp';
import { seq, SEQ_MAX } from '../../voyager/seq';
import { voyMsg } from '../../voyager/msg';
import { randomVoyOf, voyRandomHook, type VoyRandom, type VoyStyle } from '../../voyager/random';
import type { VoyKnobId } from '../../voyager/params';
import { arpExtra } from './extra';
import { analogRandom, analogTame, analogVoice, ANALOG_FX_OFF_EXTRA, type AnalogFamily } from './analog';
import { arpSteps, STEPS_N } from './steps';

export type HypnoStyle = 'HYPNOTIC' | 'PULSE' | 'ROLLING';
export const HYPNO_STYLES: readonly HypnoStyle[] = ['HYPNOTIC', 'PULSE', 'ROLLING'];

type Rnd = () => number;
type Step = number | null;
const o: Step = null;

const pick = <T>(rnd: Rnd, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rnd() * xs.length))];
const chance = (rnd: Rnd, p: number): boolean => rnd() < p;

export interface HypnoSeq {
  style: HypnoStyle;
  /** la suite EDIT (degres, null : silence) */
  seq: Step[];
  /** les pistes par pas (16 pas) */
  steps: { acc: number[]; slide: number[]; gate: number[]; rat: number[]; prob: number[] };
  /** les indices de la progression (chords.ts CHORDS) : un accord ou deux */
  prog: number[];
}

/** Les cellules de chaque style (degres au-dessus de la racine : 0 racine, 2 tierce, 4 quinte, 7 octave). */
const CELLS: Record<HypnoStyle, readonly (readonly Step[])[]> = {
  HYPNOTIC: [
    [0, 7, 4],
    [0, 4, 7, 4],
    [0, 0, 7, 0],
    [0, 2, 4],
    [0, 7, 0, 4],
    [0, 4, 0, 7],
  ],
  PULSE: [
    [0, o, 0, o],
    [0, 0, o, 0],
    [0, o, o, 0],
    [0, o, 0, 0],
    [0, o],
  ],
  ROLLING: [
    [0, 0, 7, 0],
    [0, 7, 0, 0],
    [0, 0, 4, 7],
    [o, 0, 7, 0],
  ],
};

/** La petite variation de la derniere cellule : une note change (vers l'octave, la quinte ou un silence). */
function vary(rnd: Rnd, cell: readonly Step[], style: HypnoStyle): Step[] {
  const out = [...cell];
  const notes = out.map((x, i) => (x !== null && i > 0 ? i : -1)).filter((i) => i >= 0);
  const at = notes.length ? pick(rnd, notes) : out.length - 1;
  const cur = out[at];
  const pool: readonly Step[] = style === 'PULSE' ? [7, 4, o] : style === 'ROLLING' ? [7, 4, 9] : [7, 4, 9, o];
  const choices = pool.filter((x) => x !== cur);
  out[at] = pick(rnd, choices);
  return out;
}

/**
 * Les progressions : un accord (le plus souvent) ou deux qui alternent (indices de CHORDS, la tonalite de F# mineur) ;
 * v43 : dans la banque du plugin (chords.ts ARP_CHORDS : 0 F#m, 1 G#ø, 2 A, 3 Bm, 4 C#m, 5 D, 6 E, 7 F#m7), les memes
 * accords qu'avant : F#m, F#m A, F#m Bm, F#m D, F#m F#m F#m A.
 */
const PROGS: readonly (readonly number[])[] = [[0], [0], [0, 2], [0, 3], [0, 5], [0, 0, 0, 2]];

export function hypnoSeq(style: HypnoStyle, rnd: Rnd = Math.random): HypnoSeq {
  const cell = pick(rnd, CELLS[style]);
  const total = style === 'ROLLING' || (style === 'PULSE' && cell.length === 2) ? 16 : chance(rnd, 0.5) ? 8 : 16;
  const reps = Math.max(1, Math.floor(total / cell.length));
  const seq: Step[] = [];
  for (let r = 0; r < reps; r += 1) seq.push(...(r === reps - 1 && reps > 1 ? vary(rnd, cell, style) : cell));
  const len = seq.length;
  // Les pistes : suivent la cellule (son premier pas accentue), coherentes avec le style ; tout le reste au neutre
  const acc: number[] = [];
  const gate: number[] = [];
  const slide: number[] = new Array<number>(STEPS_N).fill(0);
  const rat: number[] = new Array<number>(STEPS_N).fill(1);
  const prob: number[] = new Array<number>(STEPS_N).fill(100);
  for (let i = 0; i < STEPS_N; i += 1) {
    const k = i % cell.length;
    acc.push(k === 0 ? 2 : style === 'PULSE' ? 1 : k === cell.length - 1 && style === 'ROLLING' ? 0 : 1);
    gate.push(style === 'PULSE' ? 0 : style === 'HYPNOTIC' ? (k === 0 ? 2 : 1) : 1);
  }
  // La variation (la derniere cellule) : au plus un glisse (HYPNOTIC), un ratchet (ROLLING), une note a 75 %
  const v0 = len - cell.length;
  if (reps > 1) {
    if (style === 'HYPNOTIC' && chance(rnd, 0.6)) slide[(v0 + 1) % STEPS_N] = 1;
    if (style === 'ROLLING' && chance(rnd, 0.5)) rat[(len - 1) % STEPS_N] = 2;
    if (chance(rnd, 0.5)) prob[(v0 + cell.length - 1) % STEPS_N] = 75;
  }
  return { style, seq, steps: { acc, slide, gate, rat, prob }, prog: [...pick(rnd, PROGS)] };
}

/** Les reglages de l'arpegiateur qui vont avec : 1/16, la suite EDIT, une octave, NOTES ALL, GATE selon le style. */
export function hypnoArp(style: HypnoStyle, rnd: Rnd = Math.random): { rate: number; range: number; gate: number; octave?: number } {
  return {
    rate: 2 / 3,
    range: 0,
    gate: style === 'PULSE' ? 0.28 + rnd() * 0.12 : style === 'ROLLING' ? 0.42 + rnd() * 0.1 : 0.62 + rnd() * 0.16,
  };
}

let last: HypnoStyle = 'HYPNOTIC';
const styleListeners = new Set<() => void>();
/** Le style choisi sur la page SEQ (RANDOM de la face s'en sert aussi). */
export const hypnoStyle = {
  get: (): HypnoStyle => last,
  set(s: HypnoStyle): void {
    if (s === last) return;
    last = s;
    styleListeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    styleListeners.add(fn);
    return () => {
      styleListeners.delete(fn);
    };
  },
};

/* ---------------- poser un tirage ---------------- */


/** Les pistes par pas et la suite EDIT d'un tirage (les potards de l'arpege d'abord : ils repasseraient la suite en AUTO). */
function put(h: HypnoSeq, rnd: Rnd): void {
  const a = hypnoArp(h.style, rnd);
  voyParams.set('rate', a.rate);
  voyParams.set('range', a.range);
  voyParams.set('gate', Math.round(a.gate * 1000) / 1000);
  const buf = Array.from({ length: SEQ_MAX }, (_, i) => h.seq[i % h.seq.length] ?? null);
  seq.restore({ edit: true, buf, len: Math.min(SEQ_MAX, h.seq.length), has: true });
  arpSteps.load(h.steps);
}

/** NEW SEQ (la page SEQ) : une suite, ses pistes et sa progression dans le style choisi ; le son ne bouge pas. */
export function hypnoNew(style: HypnoStyle = hypnoStyle.get(), rnd: Rnd = Math.random): HypnoSeq {
  const h = hypnoSeq(style, rnd);
  put(h, rnd);
  arp.set([...h.prog]);
  voyMsg.show(`NEW SEQ ${style} · ${h.seq.length} STEPS`);
  return h;
}

/* ---------------- RANDOM de la face (v28, refait en v43) ---------------- */

/**
 * v28 (2026-11-18, Mika : "je trouve les random et preset trop aigu, ca doit etre des sonorites differentes, mais souvent
 * des basslines aussi") : RANDOM tire d'abord une FAMILLE (BASS 4 fois sur 10, ARP, PAD, DARK), puis son son.
 *
 * v43 (2026-11-20, Mika : "que ca sonne vraiment bon synth analog ! evite les fx sur tous les presets ! ou des
 * filtres, si tu en utilises alors pas trop intense !") : les memes garde-fous que la banque d'usine (analog.ts). Le son
 * de la famille est tire en entier dans les plages de la banque (analogRandom : oscillateurs, SUB, passe-bas a
 * mi-course, enveloppes, MOD lent, derive), puis borne par analogTame (aucun effet, filtre modere, pas trop aigu) ; les
 * effets du VST3 seul passent a l'arret (ANALOG_FX_OFF_EXTRA : HELL, PHASER, FLANGER, PUMP, CRUSH, SHIMMER, WARMTH,
 * RING, FOLD, HIGH PASS, COMB ; plus de touche de HELL). Le tirage du site (voyager/random.ts randomVoyOf) ne donne plus
 * que le jeu de l'arpege (MODE, NOTES...) ; la suite et les pistes : les cellules hypnotiques du style choisi sur la page
 * SEQ, dans le registre de la famille. Restent a la main de Mika : VOLUME, l'EQ 6 bandes, le MASTER, les LFO du VST3 seul.
 */
export type RandomFamily = AnalogFamily;
/**
 * Les poids du tirage ; avec la regle "pas deux fois la meme famille, sauf BASS" (family), la suite de RANDOM se pose a
 * BASS 40 %, ARP 29 %, PAD 17 %, DARK 14 % (loi stationnaire de la chaine ; 0.4 / 0.32 donnaient 47 % de basses).
 */
const FAMILIES: readonly { f: RandomFamily; w: number }[] = [
  { f: 'BASS', w: 0.33 },
  { f: 'ARP', w: 0.37 },
  { f: 'PAD', w: 0.17 },
  { f: 'DARK', w: 0.13 },
];

export function family(rnd: Rnd, last: RandomFamily | null): RandomFamily {
  // jamais deux fois la meme famille de suite, sauf BASS (elle reste la plus frequente)
  const pool = FAMILIES.filter((x) => x.f === 'BASS' || x.f !== last);
  const total = pool.reduce((a, x) => a + x.w, 0);
  let r = rnd() * total;
  for (const x of pool) {
    r -= x.w;
    if (r <= 0) return x.f;
  }
  return pool[pool.length - 1].f;
}

/** La suite dans le registre de la famille : BASS et ARP sans degre au-dessus de l'octave. */
export function tameSeq(fam: RandomFamily, seq: Step[]): Step[] {
  return seq.map((d) => (d === null ? null : fam === 'PAD' ? d : d > 7 ? d - 7 : d));
}

/** Le style du site d'ou part chaque famille (v43 : le jeu de l'arpege seulement, le son vient de analogRandom). */
export const SITE_OF: Record<RandomFamily, readonly VoyStyle[]> = {
  BASS: ['BASSLINE', 'BASSLINE', 'ACID'],
  ARP: ['PLUCK', 'ARP', 'PLUCK', 'DARK'],
  PAD: ['ARP', 'PLUCK'],
  DARK: ['DARK'],
};

let lastFamily: RandomFamily | null = null;

/**
 * Le patch de RANDOM (sans la suite) : le jeu de l'arpege du site et de la page SEQ, puis le son analogique de la
 * famille, borne par les regles. Pur (rnd seul) : plugin/mm-arp/tests/random-analog.mjs le rend hors ligne.
 */
export function randomPatch(fam: RandomFamily, site: Partial<Record<VoyKnobId, number>>, arpPart: { rate: number; range: number; gate: number }, rnd: Rnd): Partial<Record<VoyKnobId, number>> {
  return analogTame({ ...site, ...arpPart, ...analogRandom(fam, rnd) }) as Partial<Record<VoyKnobId, number>>;
}

/**
 * Les effets du VST3 seul a l'arret (v43 : RANDOM donne toujours un son sec) ; v52 (2026-11-24) : VOICE MODE de la
 * famille, comme la banque d'usine (MONO pour les basses, POLY ailleurs : analog.ts analogVoice), sinon une nappe tiree
 * apres une basse MONO jouerait en MONO.
 */
function fxOff(fam: RandomFamily): void {
  for (const [k, v] of Object.entries(ANALOG_FX_OFF_EXTRA)) arpExtra.set(k, v);
  arpExtra.set('xVoiceMode', analogVoice(fam));
}

/** RANDOM de la face, dans le plugin : une famille, son son analogique, la suite et les pistes hypnotiques du style choisi. */
voyRandomHook.fn = (_r: VoyRandom): VoyRandom => {
  const rnd: Rnd = Math.random;
  const fam = family(rnd, lastFamily);
  lastFamily = fam;
  const r = randomVoyOf(pick(rnd, SITE_OF[fam]), rnd);
  // la suite : le style de la page SEQ ; une nappe tient ses notes (HYPNOTIC)
  const style = fam === 'PAD' ? 'HYPNOTIC' : hypnoStyle.get();
  const h = hypnoSeq(style, rnd);
  const a = hypnoArp(style, rnd);
  arpSteps.load(h.steps);
  const patch = randomPatch(fam, r.patch, { rate: a.rate, range: a.range, gate: Math.round(a.gate * 1000) / 1000 }, rnd);
  fxOff(fam);
  return {
    ...r,
    patch,
    seq: tameSeq(fam, h.seq),
    prog: h.prog,
    label: `${fam} · ${style}`,
  };
};
