/**
 * Les reglages de trig du MM-RYTM (V.5.1, 2026-10-29, l'etape D2 de la face facon Digitakt, docs/v4/digitakt-d2-spec.md) :
 * la page TRIG (1/2 : LEN, PROB, COND, uTIME, LFO.T ; 2/2 : RTRG, RATE, VFAD, RLEN). Chaque voix a ses reglages de trig par
 * defaut, ranges avec le pattern (audio/pattern.ts trigs, state/patterns.ts : A01 a les siens) ; chaque pas peut les
 * verrouiller (audio/locks.ts, les memes cles). Les valeurs sont des entiers, le rang du cran (LEN : 0 a 12, INF au bout ;
 * PROB : 0 a 100 ; COND : 0 a 80 ; uTIME : -23 a +23 ; LFO.T et RTRG : 0 ou 1 ; RATE : 0 a 16 ; VFAD : -64 a +63 ; RLEN :
 * 0 a 12). A leur depart (TRIG_DEF) rien ne change : ni noeud, ni tirage au sort, ni decalage (l'identite audio de la
 * section 0 du cahier). Pur : aucun store, aucun moteur.
 */

import type { Inst } from '../theme';

export type TrigParam = 'len' | 'prob' | 'cond' | 'utime' | 'lfot' | 'rtrg' | 'rate' | 'vfad' | 'rlen';
export const TRIG_PARAMS: readonly TrigParam[] = ['len', 'prob', 'cond', 'utime', 'lfot', 'rtrg', 'rate', 'vfad', 'rlen'];
export const isTrigParam = (v: unknown): v is TrigParam => typeof v === 'string' && (TRIG_PARAMS as readonly string[]).includes(v);

/** Les longueurs de LEN et RLEN, en pas (une double croche) ; le dernier cran : INF (rien ne coupe). */
export const LEN_STEPS: readonly (number | null)[] = [0.0625, 0.125, 0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 16, null];
export const LEN_LABELS: readonly string[] = ['1/16', '1/8', '1/4', '1/2', '1', '1.5', '2', '3', '4', '6', '8', '16', 'INF'];
/** RATE : la frequence des repetitions, en fraction de mesure (1/16 : un coup par pas). */
export const RATE_DENS: readonly number[] = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80];
export const RATE_LABELS: readonly string[] = RATE_DENS.map((d) => `1/${d}`);
/** uTIME : de -23 a +23 en 1/384 de mesure (1/24 de pas), comme la Digitakt. */
export const UTIME_MAX = 23;
/** VFAD : de -64 a +63. */
export const VFAD_MIN = -64;
export const VFAD_MAX = 63;

/**
 * La liste de COND, dans l'ordre du potard : NONE ; FILL, !FILL ; PRE, !PRE ; NEI, !NEI ; 1ST, !1ST ; LST, !LST ; puis
 * A:B pour B de 2 a 8 et A de 1 a B ; puis les memes avec !.
 */
export type CondKind = 'none' | 'fill' | 'pre' | 'nei' | 'first' | 'last' | 'ab';
export interface Cond {
  kind: CondKind;
  not: boolean;
  a: number;
  b: number;
  label: string;
}
function buildConds(): readonly Cond[] {
  const out: Cond[] = [{ kind: 'none', not: false, a: 0, b: 0, label: 'NONE' }];
  const pair = (kind: CondKind, name: string): void => {
    out.push({ kind, not: false, a: 0, b: 0, label: name });
    out.push({ kind, not: true, a: 0, b: 0, label: `!${name}` });
  };
  pair('fill', 'FILL');
  pair('pre', 'PRE');
  pair('nei', 'NEI');
  pair('first', '1ST');
  pair('last', 'LST');
  for (const not of [false, true]) for (let b = 2; b <= 8; b += 1) for (let a = 1; a <= b; a += 1) out.push({ kind: 'ab', not, a, b, label: `${not ? '!' : ''}${a}:${b}` });
  return out;
}
export const CONDS: readonly Cond[] = buildConds();
export const COND_MAX = CONDS.length - 1;

/** Le depart de chaque reglage : LEN INF, PROB 100 %, COND NONE, uTIME 0, LFO.T ON, RTRG OFF, RATE 1/16, VFAD 0, RLEN 1 pas. */
export const TRIG_DEF: Readonly<Record<TrigParam, number>> = { len: 12, prob: 100, cond: 0, utime: 0, lfot: 1, rtrg: 0, rate: 9, vfad: 0, rlen: 4 };
/** La course de chaque reglage (son plus petit et son plus grand cran). */
export const TRIG_RANGE: Readonly<Record<TrigParam, readonly [number, number]>> = {
  len: [0, LEN_STEPS.length - 1],
  prob: [0, 100],
  cond: [0, COND_MAX],
  utime: [-UTIME_MAX, UTIME_MAX],
  lfot: [0, 1],
  rtrg: [0, 1],
  rate: [0, RATE_DENS.length - 1],
  vfad: [VFAD_MIN, VFAD_MAX],
  rlen: [0, LEN_STEPS.length - 1],
};

/** Une valeur posee sur son cran et bornee ; NaN : le depart. */
export function clampTrig(p: TrigParam, v: number): number {
  if (!Number.isFinite(v)) return TRIG_DEF[p];
  const [lo, hi] = TRIG_RANGE[p];
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** Les reglages de trig d'une voix (seulement ce qui quitte le depart) ; ceux d'un pattern, par voix (absent : le depart). */
export type TrigRow = Partial<Record<TrigParam, number>>;
export type TrigSet = Partial<Record<Inst, Readonly<TrigRow>>>;
export const NO_TRIGS: Readonly<TrigSet> = Object.freeze({});

const INSTS: readonly Inst[] = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'];

/** Un jeu lu (stockage, preset, pattern, UNDO) : les voix et reglages inconnus partent, les valeurs au depart aussi ; null : rien. */
export function cleanTrigs(raw: unknown): TrigSet | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  const out: Record<string, TrigRow> = {};
  let any = false;
  for (const inst of INSTS) {
    const row = x[inst];
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const o: TrigRow = {};
    let n = 0;
    for (const p of TRIG_PARAMS) {
      const v = r[p];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const c = clampTrig(p, v);
      if (c === TRIG_DEF[p]) continue;
      o[p] = c;
      n += 1;
    }
    if (n > 0) {
      out[inst] = o;
      any = true;
    }
  }
  return any ? (out as TrigSet) : null;
}

/** Un reglage pose sur une voix (mise a jour immuable ; le depart le retire). */
export function withTrig(t: Readonly<TrigSet>, inst: Inst, p: TrigParam, v: number): TrigSet {
  const c = clampTrig(p, v);
  const row: TrigRow = { ...(t[inst] ?? {}) };
  if (c === TRIG_DEF[p]) delete row[p];
  else row[p] = c;
  const out: TrigSet = { ...t };
  if (Object.keys(row).length === 0) delete out[inst];
  else out[inst] = row;
  return out;
}

/** Deux jeux egaux (le miroir des patterns n'ecrit pas pour rien). */
export function sameTrigs(a: Readonly<TrigSet> | null | undefined, b: Readonly<TrigSet> | null | undefined): boolean {
  const body = (x: Readonly<TrigSet> | null | undefined): string => JSON.stringify(INSTS.map((i) => (x?.[i] ? TRIG_PARAMS.map((p) => x[i]?.[p] ?? null) : null)));
  return body(a) === body(b);
}
export const anyTrigs = (t: Readonly<TrigSet> | null | undefined): boolean => !!t && INSTS.some((i) => !!t[i] && Object.keys(t[i] as object).length > 0);

/** La valeur d'un reglage pour la voix (le defaut du pattern) et le pas (son verrou, s'il en a un). */
export function trigValue(t: Readonly<TrigSet> | null | undefined, inst: Inst, p: TrigParam, lock?: Readonly<Partial<Record<string, number | string>>> | null): number {
  const l = lock?.[p];
  if (typeof l === 'number' && Number.isFinite(l)) return clampTrig(p, l);
  const d = t?.[inst]?.[p];
  return typeof d === 'number' ? d : TRIG_DEF[p];
}

/** Ce qu'un trig fait, lu une fois : les valeurs du defaut de la voix et des verrous du pas. */
export interface TrigNow {
  /** LEN en pas ; null : INF */
  len: number | null;
  prob: number;
  cond: number;
  /** uTIME en pas (n / 24) */
  shift: number;
  lfot: boolean;
  rtrg: boolean;
  /** RATE : l'ecart des repetitions, en pas */
  every: number;
  vfad: number;
  /** RLEN en pas ; null : INF, jusqu'au trig suivant de la voix */
  rlen: number | null;
}

export function trigNow(t: Readonly<TrigSet> | null | undefined, inst: Inst, lock?: Readonly<Partial<Record<string, number | string>>> | null): TrigNow {
  const v = (p: TrigParam): number => trigValue(t, inst, p, lock);
  return {
    len: LEN_STEPS[v('len')] ?? null,
    prob: v('prob'),
    cond: v('cond'),
    shift: v('utime') / 24,
    lfot: v('lfot') === 1,
    rtrg: v('rtrg') === 1,
    every: 16 / RATE_DENS[v('rate')],
    vfad: v('vfad'),
    rlen: LEN_STEPS[v('rlen')] ?? null,
  };
}

/** Le contexte d'une condition : le compteur de passages (1 au lancement), FILL, un changement de pattern prevu. */
export interface CondCtx {
  pass: number;
  fill: boolean;
  last: boolean;
}

/**
 * Une condition evaluee (sans PROB) : pre, le dernier resultat de la voix ; nei, celui de la voix d'avant (null : aucun,
 * faux). NONE : vrai.
 */
export function condTrue(c: Cond, ctx: CondCtx, pre: boolean | null, nei: boolean | null): boolean {
  let r: boolean;
  switch (c.kind) {
    case 'none':
      return true;
    case 'fill':
      r = ctx.fill;
      break;
    case 'pre':
      r = pre === true;
      break;
    case 'nei':
      r = nei === true;
      break;
    case 'first':
      r = ctx.pass === 1;
      break;
    case 'last':
      r = ctx.last;
      break;
    default:
      r = (ctx.pass - 1) % c.b === c.a - 1;
  }
  return c.not ? !r : r;
}

/** Les textes de l'ecran (la valeur en grand) et leur unite. */
export function trigText(p: TrigParam, v: number): string {
  const c = clampTrig(p, v);
  switch (p) {
    case 'len':
    case 'rlen':
      return LEN_LABELS[c];
    case 'prob':
      return `${c}%`;
    case 'cond':
      return CONDS[c].label;
    case 'utime':
      return c === 0 ? '0' : `${c > 0 ? '+' : ''}${c}/384`;
    case 'lfot':
    case 'rtrg':
      return c ? 'ON' : 'OFF';
    case 'rate':
      return RATE_LABELS[c];
    default:
      return c > 0 ? `+${c}` : String(c);
  }
}

/** La ligne d'unite ; ms : la duree d'un pas en ms (le tempo du moment). */
export function trigUnit(p: TrigParam, v: number, stepMs: number): string {
  const c = clampTrig(p, v);
  switch (p) {
    case 'len':
    case 'rlen': {
      const s = LEN_STEPS[c];
      if (s === null) return p === 'len' ? 'NO CUT' : 'TO NEXT TRIG';
      return `${s === 1 ? '1 STEP' : `${LEN_LABELS[c]} STEPS`} ${Math.round(s * stepMs)} MS`;
    }
    case 'prob':
      return c >= 100 ? 'ALWAYS' : c <= 0 ? 'NEVER' : 'OF THE TRIGS';
    case 'cond': {
      const k = CONDS[c];
      if (k.kind === 'none') return 'PROB DECIDES';
      if (k.kind === 'ab') return `${k.not ? 'NOT ' : ''}PASS ${k.a} OF ${k.b}`;
      return { fill: 'HOLD YES', pre: 'LAST RESULT', nei: 'VOICE BEFORE', first: 'FIRST PASS', last: 'LAST PASS', none: '' }[k.kind];
    }
    case 'utime':
      return c === 0 ? 'ON THE GRID' : `${c > 0 ? 'LATE' : 'EARLY'} ${(Math.abs(c) * stepMs / 24).toFixed(1)} MS`;
    case 'lfot':
      return c ? 'TRIG RESTARTS LFO' : 'LFO RUNS ON';
    case 'rtrg':
      return c ? 'REPEATS' : 'ONE HIT';
    case 'rate': {
      const every = 16 / RATE_DENS[c];
      return `${Math.round(every * stepMs)} MS`;
    }
    default:
      return c === 0 ? 'FLAT' : c < 0 ? 'FADES OUT' : 'FADES IN';
  }
}

/**
 * La velocite d'une repetition du retrig (en gain, celui du trig : vel) : VFAD menee sur RLEN (INF : une mesure). frac : 0
 * au trig, 1 a la fin de RLEN. VFAD negatif : elle descend jusqu'a vel x (1 + vfad / 64) ; positif : elle monte de vel x
 * (1 - vfad / 64) jusqu'a vel.
 */
export function rtrgGain(vel: number, vfad: number, frac: number): number {
  const f = Math.max(0, Math.min(1, frac));
  const d = Math.max(-1, Math.min(1, vfad / 64));
  if (d === 0) return vel;
  return d < 0 ? vel * (1 + d * f) : vel * (1 - d * (1 - f));
}

/** Un generateur pseudo-aleatoire a part (PROB) : jamais Math.random, deux rendus d'une meme graine donnent les memes coups. */
export interface Rng {
  next(): number;
  state: number;
}
export function makeRng(seed: number): Rng {
  const r: Rng = {
    state: seed >>> 0,
    next(): number {
      r.state = (r.state + 0x6d2b79f5) >>> 0;
      let t = r.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
  return r;
}
