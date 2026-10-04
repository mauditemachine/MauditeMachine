/**
 * La suite de l'arpege, modifiable note par note (2026-10-04, Mika :
 * "j'aimerais bien pouvoir modifier les notes qui sont generees"). Deux
 * etats :
 * - AUTO : la suite que fabriquent MODE, RANGE et NOTES, comme avant (en
 *   RAND, l'arpegiateur tire chaque note) ;
 * - EDIT : la suite de Mika, 1 a 16 pas. Toucher une note de la suite AUTO
 *   la copie en EDIT, puis la change. AUTO y revient ; la suite EDIT reste
 *   en memoire et EDIT la rappelle. RANDOM, MODE, RANGE et NOTES (les
 *   potards qui fabriquent la suite) repassent en AUTO.
 * Une note est un degre de fa diese mineur au-dessus de la racine de
 * l'accord qui joue (chords.ts degreeMidi : 0 la racine, 2 la tierce, 4 la
 * quinte, 7 l'octave, jusqu'a SEQ_TOP, trois octaves), ou un silence
 * (null) : la meme suite suit les accords de la progression et reste dans
 * la tonalite. Gardee dans le navigateur, comme les potards.
 */

import { arpDegrees, type ArpMode } from './chords';
import { notesCount, octaves, stepIndex, voyParams, type VoyValues } from './params';

/** Pas d'une suite EDIT : une mesure de doubles croches. */
export const SEQ_MAX = 16;
/** Degre le plus haut : trois octaves au-dessus de la racine (et la septieme). */
export const SEQ_TOP = 20;

export type SeqStep = number | null;

export interface SeqState {
  /** EDIT (la suite de Mika) ou AUTO (celle des potards) */
  edit: boolean;
  /** les SEQ_MAX pas de la suite EDIT ; les len premiers jouent, les autres attendent qu'on l'allonge */
  buf: readonly SeqStep[];
  len: number;
  /** une suite EDIT existe (EDIT la rappelle au lieu de copier AUTO) */
  has: boolean;
}

const KEY = 'mm.v4.voyager.seq.1';
const EMPTY: SeqState = { edit: false, buf: Array.from({ length: SEQ_MAX }, () => 0), len: 8, has: false };

const okStep = (x: unknown): x is SeqStep => x === null || (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= SEQ_TOP);

function load(): SeqState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<SeqState> | null;
    if (!raw || !Array.isArray(raw.buf) || raw.buf.length !== SEQ_MAX || !raw.buf.every(okStep)) return EMPTY;
    const len = Number(raw.len);
    if (!Number.isInteger(len) || len < 1 || len > SEQ_MAX) return EMPTY;
    return { edit: raw.edit === true, buf: raw.buf, len, has: raw.has === true };
  } catch {
    return EMPTY;
  }
}

let state: SeqState = typeof window === 'undefined' ? EMPTY : load();
const listeners = new Set<() => void>();

function setState(next: SeqState): void {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* stockage plein ou bloque : la visite garde sa suite */
  }
  listeners.forEach((fn) => fn());
}

/** Les notes de l'arpege AUTO dans l'ordre du mode ; NOTES : les N premieres, en boucle. */
export function poolSteps(chord: number, p: Readonly<VoyValues>, mode: ArpMode): number[] {
  const full = arpDegrees(chord, octaves(p.range), mode);
  const k = notesCount(p.notes);
  return k > 0 && full.length > 0 ? Array.from({ length: k }, (_, j) => full[j % full.length]) : full;
}

/** RAND : la derniere note tiree a chaque position (la suite montree), sans redessin a chaque note. */
const live: SeqStep[] = [];

const isRand = (p: Readonly<VoyValues>): boolean => stepIndex('mode', p.mode) === 3;

/** La suite AUTO montree pour un accord : celle des potards ; en RAND, les dernieres notes tirees. */
function autoShown(chord: number): SeqStep[] {
  const p = voyParams.get();
  if (!isRand(p)) return poolSteps(chord, p, stepIndex('mode', p.mode) as ArpMode);
  const pool = poolSteps(chord, p, 0);
  return pool.map((d, j) => (live[j] === undefined ? d : live[j]));
}

/** La suite AUTO copiee en EDIT (repetee sur les 16 pas : l'allonger la continue). */
function fromAuto(chord: number): SeqState {
  const s = autoShown(chord);
  const buf = Array.from({ length: SEQ_MAX }, (_, j) => (s.length > 0 ? s[j % s.length] : 0));
  return { edit: true, buf, len: Math.max(1, Math.min(SEQ_MAX, s.length || 8)), has: true };
}

export const seq = {
  get: (): SeqState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Les pas qui jouent sur cet accord ; null : RAND en AUTO (l'arpegiateur tire chaque note). */
  steps(chord: number): readonly SeqStep[] | null {
    if (state.edit) return state.buf.slice(0, state.len);
    const p = voyParams.get();
    return isRand(p) ? null : poolSteps(chord, p, stepIndex('mode', p.mode) as ArpMode);
  },
  /** La suite montree sur cet accord (EDIT, ou AUTO telle qu'elle joue). */
  shown(chord: number): SeqStep[] {
    return state.edit ? state.buf.slice(0, state.len) : autoShown(chord);
  },
  /** AUTO tire au hasard (RAND) : la note jouee a cette position. */
  noteLive(pos: number, d: number): void {
    live[pos] = d;
  },
  /** EDIT : la suite gardee, sinon une copie de la suite AUTO de cet accord. */
  edit(chord: number): void {
    if (state.edit) return;
    setState(state.has ? { ...state, edit: true } : fromAuto(chord));
  },
  /** AUTO : la suite des potards (la suite EDIT reste en memoire). */
  auto(): void {
    if (state.edit) setState({ ...state, edit: false });
  },
  /** Un pas : un degre (0 a SEQ_TOP) ou un silence ; en AUTO, la suite est d'abord copiee en EDIT. */
  setStep(chord: number, i: number, d: SeqStep): void {
    const base = state.edit ? state : fromAuto(chord);
    if (i < 0 || i >= base.len) return;
    const v = d === null ? null : Math.max(0, Math.min(SEQ_TOP, Math.round(d)));
    if (state.edit && base.buf[i] === v) return;
    const buf = base.buf.slice();
    buf[i] = v;
    setState({ ...base, buf });
  },
  /** Le nombre de pas (1 a 16) ; en AUTO, la suite est d'abord copiee en EDIT. */
  setLen(chord: number, n: number): void {
    const base = state.edit ? state : fromAuto(chord);
    const len = Math.max(1, Math.min(SEQ_MAX, Math.round(n)));
    if (state.edit && len === base.len) return;
    setState({ ...base, len });
  },
  /** Tests : la suite de depart. */
  reset(): void {
    live.length = 0;
    setState(EMPTY);
  },
};
