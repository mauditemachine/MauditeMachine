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
import { voyRandomHook, type VoyRandom } from '../../voyager/random';
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

/** Les progressions : un accord (le plus souvent) ou deux qui alternent (indices de CHORDS, la tonalite de F# mineur). */
const PROGS: readonly (readonly number[])[] = [[0], [0], [0, 5], [0, 4], [0, 1], [0, 0, 0, 5]];

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

/** RANDOM de la face, dans le plugin : le son tire par le site, la suite et les pistes hypnotiques du style choisi. */
voyRandomHook.fn = (r: VoyRandom): VoyRandom => {
  const style = hypnoStyle.get();
  const h = hypnoSeq(style, Math.random);
  const a = hypnoArp(style, Math.random);
  arpSteps.load(h.steps);
  return {
    ...r,
    patch: { ...r.patch, rate: a.rate, range: a.range, gate: Math.round(a.gate * 1000) / 1000 },
    seq: h.seq,
    prog: h.prog,
    label: `${r.style} · ${style}`,
  };
};
