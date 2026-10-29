/**
 * Ce que le sequenceur des trigs (V.5.1, audio/seq.ts) change a un coup, en calcul pur (audio/drums.ts pose les noeuds) :
 * - LEN : un relachement de 8 ms a la fin de LEN (LEN_REL_S) ; les queues des envois continuent ;
 * - les LFO pris au moment du coup (DIST, DELAY, REVERB, TONE, DECAY : un verrou de plus pour ce coup, lfoHitLock) et
 *   ceux appliques en continu sur le coup qui sonne (PITCH, FREQ, RESO, VOL, PAN : des rampes d'AudioParam sur sa duree,
 *   lfoPoints) ;
 * - les lock trigs : les noeuds en direct qu'il faut aux coups d'une voix pour que ses lock trigs les changent (liveNeeds :
 *   VOL, PAN, le filtre), seulement si le motif en a.
 * Rien de tout cela au depart (LEN INF, aucun LFO, aucun lock trig) : le coup d'avant.
 */

import type { Inst } from '../theme';
import { LFO_DESTS, lfoCycle, lfoValue, type Lfo, type LfoDest } from './lfo';
import type { HitLfo } from './seq';
import type { Locks, StepLock } from './locks';
import type { VoiceFx } from './voicefx';
import { snapTone } from './tone';

/** Le relachement de LEN (s). */
export const LEN_REL_S = 0.008;
/** PITCH : +/-12 demi-tons a DEP +/-64 ; FREQ : +/-5 octaves de coupure. */
export const LFO_PITCH_CENTS = 1200;
export const LFO_FREQ_CENTS = 6000;
/** Les destinations prises au moment du coup ; celles appliquees en continu. */
export const LFO_HIT_DESTS: readonly LfoDest[] = ['DIST', 'DELAY', 'REVERB', 'TONE', 'DECAY'];
export const LFO_LIVE_DESTS: readonly LfoDest[] = ['PITCH', 'FREQ', 'RESO', 'VOL', 'PAN'];
/** Les points d'une courbe de LFO sur un coup : au plus 256 rampes, de 4 a 40 ms, sur au plus 8 s. */
const SEG_MIN_S = 0.004;
const SEG_MAX_S = 0.04;
const SEG_COUNT = 256;
export const LFO_SPAN_S = 8;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp11 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);

/** La somme des LFO d'une destination a la position pos (en pas). */
export function lfoSum(list: readonly Lfo[], dest: LfoDest, pos: number, anchor: number): number {
  let s = 0;
  for (const l of list) if (l.dest === dest) s += lfoValue(l, pos, anchor);
  return s;
}

/** Les destinations continues d'un coup (celles qui demandent un noeud) ; vide sans LFO. */
export function liveDests(l: HitLfo | null): Set<LfoDest> {
  const out = new Set<LfoDest>();
  if (!l) return out;
  for (const x of l.list) if (LFO_LIVE_DESTS.includes(x.dest)) out.add(x.dest);
  return out;
}

/**
 * Les LFO pris au moment du coup : un verrou de plus pour ce coup (la valeur de la voix ou de son verrou, plus le LFO) ;
 * tone : un TONE mene par un LFO (le coup joue le calcul le plus proche plutot que d'attendre). Sans LFO de ces
 * destinations : le verrou tel quel.
 */
export function lfoHitLock(l: HitLfo | null, fx: Readonly<VoiceFx>, lock: Readonly<StepLock> | null): { lock: Readonly<StepLock> | null; tone: boolean } {
  if (!l) return { lock, tone: false };
  let out: StepLock | null = null;
  let tone = false;
  for (const d of LFO_HIT_DESTS) {
    if (!l.list.some((x) => x.dest === d)) continue;
    const v = lfoSum(l.list, d, l.pos, l.anchor);
    out = out ?? { ...(lock ?? {}) };
    if (d === 'DIST') out.dist = clamp01((lock?.dist ?? fx.dist) + v);
    else if (d === 'DELAY') out.delay = clamp01((lock?.delay ?? fx.delay) + v);
    else if (d === 'REVERB') out.reverb = clamp01((lock?.reverb ?? fx.reverb) + v);
    else if (d === 'DECAY') out.decay = clamp01((lock?.decay ?? fx.decay) + v);
    else {
      // TONE au 1/32 : au plus 65 calculs du coup, pas un par coup
      out.tone = snapTone(Math.round(clamp11((lock?.tone ?? fx.tone) + v) * 32) / 32);
      tone = true;
    }
  }
  return { lock: out ?? lock, tone };
}

/**
 * Les points d'une courbe (valeurs du LFO, avant la loi de la destination) de t0 a t1 (temps du contexte) pour un coup a
 * when ; le premier a t0. Un LFO immobile (HLD, SPD 0, sans FADE) : un seul point.
 */
export function lfoPoints(l: HitLfo, dest: LfoDest, when: number, t0: number, t1: number, anchor: number): { t: number; v: number }[] {
  const ls = l.list.filter((x) => x.dest === dest);
  const at = (t: number): number => lfoSum(ls, dest, l.pos + (t - when) / l.dur, anchor);
  const pts = [{ t: t0, v: at(t0) }];
  const still = ls.every((x) => (x.mode === 'HLD' || !Number.isFinite(lfoCycle(x))) && x.fade === 0);
  if (still || !(t1 > t0)) return pts;
  let cyc = Infinity;
  for (const x of ls) cyc = Math.min(cyc, lfoCycle(x) * l.dur);
  let seg = Math.max(SEG_MIN_S, Math.min(SEG_MAX_S, Number.isFinite(cyc) ? cyc / 24 : SEG_MAX_S));
  const n = Math.min(SEG_COUNT, Math.max(1, Math.ceil((t1 - t0) / seg)));
  seg = (t1 - t0) / n;
  for (let i = 1; i <= n; i += 1) {
    const t = t0 + i * seg;
    pts.push({ t, v: at(t) });
  }
  return pts;
}

/** Les noeuds en direct qu'il faut aux coups d'une voix pour ses lock trigs (VOL, PAN, le filtre) ; null : aucun. */
export interface LiveNeeds {
  gain: boolean;
  pan: boolean;
  filter: boolean;
}
const needsCache = new WeakMap<object, Partial<Record<Inst, LiveNeeds | null>>>();
export function liveNeeds(locks: Readonly<Locks> | null | undefined, inst: Inst): LiveNeeds | null {
  if (!locks) return null;
  let c = needsCache.get(locks);
  if (!c) {
    c = {};
    needsCache.set(locks, c);
  }
  const hit = c[inst];
  if (hit !== undefined) return hit;
  let out: LiveNeeds | null = null;
  const row = locks[inst];
  if (row) {
    for (const l of Object.values(row)) {
      if (l.ltrg !== 1) continue;
      out = out ?? { gain: false, pan: false, filter: false };
      if (l.level !== undefined) out.gain = true;
      if (l.pan !== undefined) out.pan = true;
      if (l.fcut !== undefined || l.freso !== undefined) out.filter = true;
    }
  }
  c[inst] = out;
  return out;
}

const DIST_DEST = LFO_DESTS.indexOf('DIST');
/** Un LFO de la voix (ou d'un de ses pas) va-t-il a DIST : l'insert de sa tranche reste tenu engage, comme pour un verrou. */
export function lfoDistOf(fx: Readonly<Partial<Record<string, number>>> | null | undefined, row: Readonly<Record<string, Readonly<StepLock>>> | null | undefined): boolean {
  if (fx && (fx.l1dst === DIST_DEST || fx.l2dst === DIST_DEST)) return true;
  if (row) for (const l of Object.values(row)) if (l.l1dst === DIST_DEST || l.l2dst === DIST_DEST) return true;
  return false;
}
