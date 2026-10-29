/**
 * Les deux LFO de chaque voix du MM-RYTM (V.5.1, 2026-10-29, la page MOD facon Digitakt, docs/v4/digitakt-d2-spec.md
 * section 3) : SPD, MULT, FADE, DEST, WAVE, PHAS, MODE, DEP. Ce sont des reglages de la voix (le son, audio/voicefx.ts :
 * l1spd... l2dep, des entiers), gardes avec les presets et l'UNDO, verrouillables pas par pas (audio/locks.ts, les memes
 * cles), hors des scenes en D2 (rytm/sceneParams.ts : noscene). A DEP 0 (le depart) un LFO ne fait rien : aucun noeud,
 * aucun calcul (l'identite audio).
 *
 * Le temps est musical : la position en pas depuis PLAY (une double croche), au tempo. Un cycle dure 128 / (|SPD| x MULT)
 * pas (SPD 8 et MULT 1 : une mesure ; SPD negatif : a l'envers ; SPD 0 : la phase seule). MODE : FRE tourne librement
 * depuis PLAY ; TRG repart a chaque trig dont LFO.T est ON ; HLD prend sa valeur au trig et la garde ; ONE fait un seul
 * cycle par trig, HLF un demi. FADE : negatif, la profondeur monte depuis le trig (FRE : depuis PLAY) ; positif, elle
 * descend ; |FADE| = 64 en un pas, 1 en 64 pas. Pur : aucun store, aucun moteur.
 */

export const LFO_KEYS = ['spd', 'mul', 'fad', 'dst', 'wav', 'phs', 'mod', 'dep'] as const;
export type LfoKey = (typeof LFO_KEYS)[number];
export type LfoParam = `l${1 | 2}${LfoKey}`;
export const LFO_PARAMS: readonly LfoParam[] = [1, 2].flatMap((n) => LFO_KEYS.map((k) => `l${n}${k}` as LfoParam));
export const isLfoParam = (v: unknown): v is LfoParam => typeof v === 'string' && (LFO_PARAMS as readonly string[]).includes(v);
/** Le LFO (1 ou 2) et le reglage d'une cle. */
export const lfoParts = (p: LfoParam): { n: 1 | 2; key: LfoKey } => ({ n: (p[1] === '2' ? 2 : 1) as 1 | 2, key: p.slice(2) as LfoKey });

export const LFO_MULTS: readonly number[] = [1, 2, 4, 8, 16, 32, 64, 128];
export const LFO_DESTS = ['OFF', 'PITCH', 'FREQ', 'RESO', 'VOL', 'PAN', 'DIST', 'DELAY', 'REVERB', 'TONE', 'DECAY'] as const;
export type LfoDest = (typeof LFO_DESTS)[number];
export const LFO_WAVES = ['TRI', 'SINE', 'SQR', 'SAW', 'EXP', 'RMP', 'RND'] as const;
export type LfoWave = (typeof LFO_WAVES)[number];
export const LFO_MODES = ['FRE', 'TRG', 'HLD', 'ONE', 'HLF'] as const;
export type LfoMode = (typeof LFO_MODES)[number];

/** Le depart : SPD 32 (un cycle par temps a MULT 1), MULT 1, FADE 0, DEST OFF, WAVE TRI, PHAS 0, MODE FRE, DEP 0. */
export const LFO_DEF: Readonly<Record<LfoKey, number>> = { spd: 32, mul: 0, fad: 0, dst: 0, wav: 0, phs: 0, mod: 0, dep: 0 };
export const LFO_RANGE: Readonly<Record<LfoKey, readonly [number, number]>> = {
  spd: [-64, 63],
  mul: [0, LFO_MULTS.length - 1],
  fad: [-64, 63],
  dst: [0, LFO_DESTS.length - 1],
  wav: [0, LFO_WAVES.length - 1],
  phs: [0, 127],
  mod: [0, LFO_MODES.length - 1],
  dep: [-64, 63],
};
export const lfoDefault = (p: LfoParam): number => LFO_DEF[lfoParts(p).key];
export const lfoRange = (p: LfoParam): readonly [number, number] => LFO_RANGE[lfoParts(p).key];
export function clampLfo(p: LfoParam, v: number): number {
  const [lo, hi] = lfoRange(p);
  if (!Number.isFinite(v)) return lfoDefault(p);
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** Un LFO lu (la voix et les verrous du pas). */
export interface Lfo {
  n: 1 | 2;
  spd: number;
  mult: number;
  fade: number;
  dest: LfoDest;
  wave: LfoWave;
  phase: number;
  mode: LfoMode;
  /** -1 a 63/64 */
  depth: number;
}

type Src = Readonly<Partial<Record<string, number | string>>> | null | undefined;
const num = (fx: Src, lock: Src, p: LfoParam): number => {
  const l = lock?.[p];
  if (typeof l === 'number' && Number.isFinite(l)) return clampLfo(p, l);
  const v = fx?.[p];
  return typeof v === 'number' && Number.isFinite(v) ? clampLfo(p, v) : lfoDefault(p);
};

/** Les LFO qui font quelque chose (DEP et DEST) : la voix fx, les verrous du pas lock ; [] au depart. */
export function activeLfos(fx: Src, lock: Src): Lfo[] {
  const out: Lfo[] = [];
  for (const n of [1, 2] as const) {
    const dep = num(fx, lock, `l${n}dep`);
    const dst = num(fx, lock, `l${n}dst`);
    if (dep === 0 || dst === 0) continue;
    out.push({
      n,
      spd: num(fx, lock, `l${n}spd`),
      mult: LFO_MULTS[num(fx, lock, `l${n}mul`)],
      fade: num(fx, lock, `l${n}fad`),
      dest: LFO_DESTS[dst],
      wave: LFO_WAVES[num(fx, lock, `l${n}wav`)],
      phase: num(fx, lock, `l${n}phs`) / 128,
      mode: LFO_MODES[num(fx, lock, `l${n}mod`)],
      depth: dep / 64,
    });
  }
  return out;
}

/** La duree d'un cycle, en pas ; Infinity a SPD 0. */
export const lfoCycle = (l: Pick<Lfo, 'spd' | 'mult'>): number => (l.spd === 0 ? Infinity : 128 / (Math.abs(l.spd) * l.mult));

/** Un nombre de 0 a 1 tire d'un entier (RND : le meme pour le meme quart de cycle, un autre au cycle suivant). */
function hash01(i: number, salt: number): number {
  let h = (Math.imul(i | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** La forme a la phase u (un nombre de cycles, pas reduit) : -1 a 1 ; EXP et RMP de 0 a 1 (unipolaires). */
export function waveAt(w: LfoWave, u: number, salt = 0): number {
  const f = u - Math.floor(u);
  switch (w) {
    case 'TRI':
      return f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4;
    case 'SINE':
      return Math.sin(2 * Math.PI * f);
    case 'SQR':
      return f < 0.5 ? 1 : -1;
    case 'SAW':
      return 2 * f - 1;
    case 'EXP':
      return (Math.exp(4 * f) - 1) / (Math.exp(4) - 1);
    case 'RMP':
      return 1 - f;
    default:
      // RND : une valeur par quart de cycle
      return hash01(Math.floor(u * 4), salt) * 2 - 1;
  }
}

/**
 * La valeur d'un LFO (sa forme x DEP x FADE, -1 a 1) a la position pos (en pas depuis PLAY) ; anchor : la position du
 * dernier trig qui l'a relance (0 : PLAY).
 */
export function lfoValue(l: Lfo, pos: number, anchor: number): number {
  const cyc = lfoCycle(l);
  const dir = l.spd < 0 ? -1 : 1;
  const since = Math.max(0, pos - anchor);
  let el: number;
  switch (l.mode) {
    case 'FRE':
      el = pos;
      break;
    case 'TRG':
      el = since;
      break;
    case 'HLD':
      el = anchor;
      break;
    case 'ONE':
      el = Math.min(since, cyc * 0.999999);
      break;
    default:
      el = Math.min(since, cyc * 0.499999);
  }
  const u = l.phase + (Number.isFinite(cyc) ? (dir * el) / cyc : 0);
  let v = waveAt(l.wave, u, l.n);
  // FADE : la profondeur menee depuis le trig (FRE : depuis PLAY)
  if (l.fade !== 0) {
    const e = l.mode === 'FRE' ? pos : since;
    const t = 64 / Math.abs(l.fade);
    const k = Math.min(1, e / t);
    v *= l.fade < 0 ? k : 1 - k;
  }
  return v * l.depth;
}

/** Les textes de l'ecran : la valeur en grand. */
export function lfoText(p: LfoParam, v: number): string {
  const c = clampLfo(p, v);
  const { key } = lfoParts(p);
  switch (key) {
    case 'mul':
      return `x${LFO_MULTS[c]}`;
    case 'dst':
      return LFO_DESTS[c];
    case 'wav':
      return LFO_WAVES[c];
    case 'mod':
      return LFO_MODES[c];
    case 'phs':
      return String(c);
    default:
      return c > 0 ? `+${c}` : String(c);
  }
}

/**
 * La ligne d'unite, courte (une case de l'ecran) ; spd, mul : ceux du LFO (la duree d'un cycle) ; stepMs : un pas en ms
 * (sous un pas, la duree en ms).
 */
export function lfoUnit(p: LfoParam, v: number, l: { spd: number; mul: number }, stepMs: number): string {
  const c = clampLfo(p, v);
  const { key } = lfoParts(p);
  if (key === 'spd' || key === 'mul') {
    const cyc = lfoCycle({ spd: key === 'spd' ? c : l.spd, mult: LFO_MULTS[key === 'mul' ? c : l.mul] });
    if (!Number.isFinite(cyc)) return 'STILL';
    const bars = cyc / 16;
    if (bars >= 1) return `${+bars.toFixed(2)} BAR${bars === 1 ? '' : 'S'}`;
    if (cyc >= 1) return `${+cyc.toFixed(2)} STEP${cyc === 1 ? '' : 'S'}`;
    return `${Math.round(cyc * stepMs)} MS`;
  }
  if (key === 'fad') return c === 0 ? 'NO FADE' : `${c < 0 ? 'IN' : 'OUT'} ${+(64 / Math.abs(c)).toFixed(1)} ST`;
  // DEST : en continu sur le coup qui sonne (LIVE) ou pris au coup (AT HIT)
  if (key === 'dst') return c === 0 ? 'NO TARGET' : c <= 5 ? 'LIVE' : 'AT HIT';
  if (key === 'wav') return ['TRIANGLE', 'SINE', 'SQUARE', 'SAW', 'EXPO', 'RAMP DOWN', 'RANDOM'][c];
  if (key === 'phs') return `${Math.round((c / 128) * 360)} DEG`;
  if (key === 'mod') return ['FREE', 'RESTARTS', 'HOLD', 'ONE CYCLE', 'HALF'][c];
  return c === 0 ? 'OFF' : c < 0 ? 'INVERTED' : 'DEPTH';
}
