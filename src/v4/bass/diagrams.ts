/**
 * Les dessins des INFOS du MM-BASS (2026-10-08, Mika : "un descriptif qui
 * vient dessus, du texte et meme une image, pour expliquer a quoi ca sert
 * et comment ca fonctionne") : une petite image vectorielle par commande,
 * calculee avec les vraies lois (params.ts, le worklet bass.worklet.js, le
 * sequenceur seq.ts, le generateur gen.ts), dans une boite de 240 x 120.
 * Fonctions pures, sans DOM : la carte INFOS (bass/InfosCard.tsx) en fait
 * du SVG, l'ecran (bass/screen.ts) les trace avec Path2D, os sur noir.
 * Les roles des traits :
 * - main : le trait principal (os) ;
 * - hot : ce que la commande change (orange sur la carte, os plein a
 *   l'ecran) ;
 * - ghost : les reperes (les formes extremes, la courbe sans le reglage) ;
 * - grid : la grille ; dash : un repere en pointille (l'accent, la consigne).
 * Les textes : label (petit, gris), value (la valeur lue ; l'ecran l'ecrit
 * deja en grand et ne la reprend pas).
 * Le filtre : la courbe de l'ecran (screen.ts drawFilter : un passe-bas
 * resonant, q = 0.6 + 7 RESO^2), sur la coupure reelle de CUTOFF ; la page
 * de la ligne et l'echo dessinent le meme filtre.
 */

import { bassFactory } from '../state/factory';
import { generate, mutate, type GenOpts } from './gen';
import type { BassInfoId } from './infos';
import { BASS_ROOTS, BASS_SCALES, BASS_STYLES, BASS_KNOBS, DTIME_STEPS, SCALE_TONES, accDecayMs, adecayMs, attackMs, bassKnob, bassValueText, dfbPct, lengthPct, pwPct, releaseMs, rsizeS, rtoneHz, stepOf, sweepOct, tuneCents, type BassKnobId, type BassStyle, type BassValues } from './params';
import { BASS_PAGE_SLOTS, type BassPageId } from './pages';
import { BASS_STEPS, type BassStep } from './state';

export interface BassDiagram {
  w: number;
  h: number;
  paths: { d: string; role: 'main' | 'ghost' | 'hot' | 'grid' | 'dash'; fill?: boolean }[];
  texts: { text: string; x: number; y: number; role: 'label' | 'value'; anchor?: 'start' | 'middle' | 'end' }[];
}

/** Ce que lit un dessin : la valeur de la commande (0 a 1, celle du verrou en LOCK), toutes les valeurs, le tempo, la suite. */
export interface BassDiagramCtx {
  v: number;
  values: BassValues;
  bpm: number;
  steps?: readonly BassStep[];
  /** le pas de la commande montree (un bouton LOCK, un pas : 0 a 15), sinon le premier verrouille */
  step?: number;
  /** ROOT sur ARP : les toniques des accords du MM-ARP (F#, D, E...), dans l'ordre de la progression */
  arpRoots?: readonly string[];
}

type Role = BassDiagram['paths'][number]['role'];
type Anchor = 'start' | 'middle' | 'end';
type Pt = readonly [number, number];

const W = 240;
const H = 120;
/** La zone du trace ; les etiquettes au-dessus (y 12) et dessous (y 114). */
const X0 = 12;
const X1 = 228;
const Y0 = 20;
const Y1 = 100;
const TOP = 12;
const BOT = 114;

const n1 = (x: number): string => String(Math.round(x * 10) / 10);

/** Le dessin en cours : des traits regroupes par role (un seul chemin par role et par remplissage). */
class Pic {
  private parts = new Map<string, string[]>();
  private order: string[] = [];
  readonly texts: BassDiagram['texts'] = [];

  p(d: string, role: Role, fill = false): this {
    if (!d) return this;
    const k = `${role}${fill ? '+' : ''}`;
    let list = this.parts.get(k);
    if (!list) {
      list = [];
      this.parts.set(k, list);
      this.order.push(k);
    }
    list.push(d);
    return this;
  }

  label(text: string, x: number, y: number, anchor: Anchor = 'start'): this {
    this.texts.push({ text, x: Math.round(x), y: Math.round(y), role: 'label', anchor });
    return this;
  }

  value(text: string, x = X1, y = TOP, anchor: Anchor = 'end'): this {
    this.texts.push({ text, x, y, role: 'value', anchor });
    return this;
  }

  done(): BassDiagram {
    // L'ordre de pose : la grille et les fantomes dessous, le principal, puis ce qui change par-dessus
    const rank: Record<Role, number> = { grid: 0, ghost: 1, dash: 2, main: 3, hot: 4 };
    const keys = [...this.order].sort((a, b) => rank[a.replace('+', '') as Role] - rank[b.replace('+', '') as Role]);
    const paths = keys.map((k) => {
      const fill = k.endsWith('+');
      const role = k.replace('+', '') as Role;
      const d = (this.parts.get(k) ?? []).join('');
      return fill ? { d, role, fill } : { d, role };
    });
    return { w: W, h: H, paths, texts: this.texts };
  }
}

/* ---------------- les formes ---------------- */

const poly = (pts: readonly Pt[]): string => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n1(x)} ${n1(y)}`).join('');
const seg = (x0: number, y0: number, x1: number, y1: number): string => `M${n1(x0)} ${n1(y0)}L${n1(x1)} ${n1(y1)}`;
function rbox(x: number, y: number, w: number, h: number, r = 0): string {
  if (w <= 0 || h <= 0) return '';
  const k = Math.min(r, w / 2, h / 2);
  if (k <= 0) return `M${n1(x)} ${n1(y)}h${n1(w)}v${n1(h)}h${n1(-w)}Z`;
  return `M${n1(x + k)} ${n1(y)}H${n1(x + w - k)}A${n1(k)} ${n1(k)} 0 0 1 ${n1(x + w)} ${n1(y + k)}V${n1(y + h - k)}A${n1(k)} ${n1(k)} 0 0 1 ${n1(x + w - k)} ${n1(y + h)}H${n1(x + k)}A${n1(k)} ${n1(k)} 0 0 1 ${n1(x)} ${n1(y + h - k)}V${n1(y + k)}A${n1(k)} ${n1(k)} 0 0 1 ${n1(x + k)} ${n1(y)}Z`;
}
const dot = (cx: number, cy: number, r: number): string => `M${n1(cx - r)} ${n1(cy)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(2 * r)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2 * r)} 0Z`;
/** La pointe d'une fleche qui arrive en (x1, y1) depuis (x0, y0). */
function tip(x0: number, y0: number, x1: number, y1: number, size = 5): string {
  if (size <= 0) return '';
  const a = Math.atan2(y1 - y0, x1 - x0);
  const l = (s: number): string => seg(x1, y1, x1 - size * Math.cos(a + s), y1 - size * Math.sin(a + s));
  return l(0.5) + l(-0.5);
}
/** Une fleche : le trait et sa pointe. */
const arrow = (x0: number, y0: number, x1: number, y1: number, size = 5): string => seg(x0, y0, x1, y1) + tip(x0, y0, x1, y1, size);

/* ---------------- les lois (celles du worklet et de params.ts) ---------------- */

const cutHz = (v: number): number => 60 * Math.pow(100, v);
const decayS = (v: number): number => 0.12 * Math.pow(2.5 / 0.12, v);
const glideS = (v: number): number => 0.012 * Math.pow(0.35 / 0.012, v);
const driveGain = (v: number): number => 1 + 14 * v * v;
function fastTanh(x: number): number {
  if (x > 3) return 1;
  if (x < -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}
/** La duree d'un pas (une double croche). */
const stepS = (bpm: number): number => 60 / Math.max(40, Math.min(240, bpm || 120)) / 4;

/** La duree d'une note selon le style (la table GATE de seq.ts, recopiee : seq.ts ne l'exporte pas). */
const GATE: Readonly<Record<BassStyle, number>> = {
  ACID: 0.52,
  'DARK DISCO': 0.45,
  'INDIE DANCE': 0.45,
  MINIMAL: 0.32,
  'PSY PROG': 0.38,
  TECHNO: 0.42,
  HOUSE: 0.62,
  ELECTRO: 0.42,
  EBM: 0.36,
  ITALO: 0.4,
  SUB: 0.92,
};

const styleOf = (values: BassValues): BassStyle => BASS_STYLES[stepOf('style', values.style)];
/** La longueur jouee (en part du pas) : LENGTH, ou celle du style en AUTO. */
const gateOf = (values: BassValues): number => {
  const l = lengthPct(values.length);
  return l === null ? GATE[styleOf(values)] : l / 100;
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const pcName = (pc: number): string => NOTE_NAMES[((pc % 12) + 12) % 12];
const noteName = (m: number): string => `${pcName(m)}${Math.floor(m / 12) - 1}`;
const hzOf = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const hzText = (hz: number): string => (hz >= 1000 ? `${(hz / 1000).toFixed(1)} KHZ` : hz >= 100 ? `${Math.round(hz)} HZ` : `${hz.toFixed(1)} HZ`);

/** La tonique jouee (MIDI) : fa diese 2 decale par ROOT (F# a B montent, C a F descendent) et OCTAVE, comme seq.ts. ARP : F#. */
function tonicMidi(values: BassValues): number {
  const root = stepOf('root', values.root);
  const semis = root === 0 ? 0 : root - 1;
  const shift = semis > 5 ? semis - 12 : semis;
  return 42 + shift + 12 * (stepOf('octave', values.octave) - 2);
}

/* ---------------- le generateur, rejoue (des hasards fixes : le dessin ne tremble pas) ---------------- */

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const genOf = (values: BassValues, rnd: () => number): GenOpts => ({
  style: styleOf(values),
  density: values.density,
  slides: values.slides,
  accents: values.accents,
  range: stepOf('range', values.range) + 1,
  degrees: SCALE_TONES[BASS_SCALES[stepOf('scale', values.scale)]].length,
  rnd,
});

const SEEDS = 24;
/** GEN rejoue SEEDS fois : la moyenne d'une mesure, et la ligne la plus proche de la moyenne. */
function typical(values: BassValues, metric: (s: readonly BassStep[]) => number): { line: BassStep[]; mean: number } {
  const lines: BassStep[][] = [];
  const ms: number[] = [];
  for (let k = 0; k < SEEDS; k += 1) {
    const l = generate(genOf(values, mulberry(1 + k * 7919)));
    lines.push(l);
    ms.push(metric(l));
  }
  const mean = ms.reduce((a, b) => a + b, 0) / SEEDS;
  let best = 0;
  for (let k = 1; k < SEEDS; k += 1) if (Math.abs(ms[k] - mean) < Math.abs(ms[best] - mean)) best = k;
  return { line: lines[best], mean };
}
const countNotes = (s: readonly BassStep[]): number => s.filter((x) => x.kind === 'note').length;
const countSlides = (s: readonly BassStep[]): number => s.filter((x, i) => x.kind !== 'off' && x.slide && i < BASS_STEPS - 1 && s[i + 1].kind === 'note').length;
const countAccents = (s: readonly BassStep[]): number => s.filter((x) => x.kind === 'note' && x.acc).length;
const about = (n: number): string => (n < 9.95 ? n.toFixed(1) : String(Math.round(n)));

/** La ligne d'usine de chaque style (state/factory.ts, lue une fois). */
let styleLines: Map<BassStyle, BassStep[]> | null = null;
function styleLine(style: BassStyle): readonly BassStep[] {
  if (!styleLines) {
    styleLines = new Map();
    for (const f of bassFactory()) {
      const st = BASS_STYLES[stepOf('style', f.data.params.style)];
      if (!styleLines.has(st)) styleLines.set(st, f.data.steps);
    }
  }
  return styleLines.get(style) ?? [];
}

/* ---------------- les morceaux communs ---------------- */

const PITCH = (X1 - X0) / BASS_STEPS;

/** Seize cases : plein une note (hot ou main selon hot()), a demi une liaison, cerne un vide. */
function cells(p: Pic, steps: readonly BassStep[], y: number, h: number, hot: (s: BassStep, i: number) => boolean, x0 = X0, x1 = X1): void {
  const pitch = (x1 - x0) / BASS_STEPS;
  for (let i = 0; i < BASS_STEPS; i += 1) {
    const s = steps[i];
    const x = x0 + i * pitch + 1;
    const w = pitch - 2;
    if (!s || s.kind === 'off') p.p(rbox(x, y, w, h, 2), 'grid');
    else if (s.kind === 'tie') p.p(rbox(x, y + h * 0.3, w, h * 0.4, 1.5), 'ghost', true);
    else p.p(rbox(x, y, w, h, 2), hot(s, i) ? 'hot' : 'main', true);
  }
}

/** Les SLIDE : un trait oblique d'une case a la suivante. */
function slideMarks(p: Pic, steps: readonly BassStep[], y: number, h: number, role: Role): void {
  for (let i = 0; i < BASS_STEPS - 1; i += 1) {
    const s = steps[i];
    if (!s || s.kind === 'off' || !s.slide || steps[i + 1]?.kind !== 'note') continue;
    const x = X0 + (i + 1) * PITCH;
    p.p(seg(x - PITCH * 0.45, y + h + 4, x + PITCH * 0.45, y - 4), role);
  }
}

/** Les temps : un trait tous les quatre pas. */
function beats(p: Pic, y0 = Y0, y1 = Y1): void {
  for (let i = 4; i < BASS_STEPS; i += 4) p.p(seg(X0 + i * PITCH, y0, X0 + i * PITCH, y1), 'grid');
}

/** Le demi-ton de chaque pas dans la gamme (une liaison : la note d'avant ; un vide : null). */
function semisOf(steps: readonly BassStep[], tones: readonly number[]): (number | null)[] {
  const L = tones.length;
  let last: number | null = null;
  return steps.map((s) => {
    if (s.kind === 'off') {
      last = null;
      return null;
    }
    if (s.kind === 'note') last = tones[((s.deg % L) + L) % L] + 12 * (Math.floor(s.deg / L) + s.oct);
    return last;
  });
}

/** Le rouleau de l'ecran : une barre par note a sa hauteur, longue de gate (liaison, SLIDE : jusqu'a la suivante). */
function roll(p: Pic, steps: readonly BassStep[], tones: readonly number[], gate: number, y0: number, y1: number): void {
  const semis = semisOf(steps, tones);
  const ns = semis.filter((m): m is number => m !== null);
  let lo = ns.length ? Math.min(...ns) : 0;
  let hi = ns.length ? Math.max(...ns) : 12;
  if (hi - lo < 12) {
    const mid = (hi + lo) / 2;
    lo = mid - 6;
    hi = mid + 6;
  }
  const yOf = (m: number): number => y1 - 4 - ((m - lo) / Math.max(1, hi - lo)) * (y1 - y0 - 8);
  for (let i = 0; i < BASS_STEPS; i += 1) {
    const s = steps[i];
    const m = semis[i];
    if (!s || m === null) continue;
    const x = X0 + i * PITCH;
    const nx = steps[(i + 1) % BASS_STEPS];
    const held = (i < BASS_STEPS - 1 && nx.kind === 'tie') || (s.slide && nx.kind === 'note');
    const xa = s.kind === 'tie' ? x : x + 1;
    const xb = held || s.kind === 'tie' ? x + PITCH : x + 1 + Math.max(2, (PITCH - 1) * gate);
    let acc = s.kind === 'note' && s.acc;
    if (s.kind === 'tie') for (let k = i - 1; k >= 0; k -= 1) if (steps[k].kind === 'note') {
      acc = steps[k].acc;
      break;
    }
    p.p(rbox(xa, yOf(m) - 3.5, xb - xa, 7, 2), acc ? 'hot' : 'main', true);
    const m2 = semis[i + 1];
    if (s.slide && nx.kind === 'note' && i < BASS_STEPS - 1 && m2 !== null && m2 !== undefined) p.p(seg(xb - 1, yOf(m), x + PITCH + 2, yOf(m2)), 'ghost');
  }
}

/** Un clavier d'une octave (do a si) ; hot : la classe de hauteur allumee. */
function keyboard(p: Pic, x: number, y: number, w: number, h: number, hot: number | null, whiteRole: Role = 'grid'): void {
  const ww = w / 7;
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  const BLACK: readonly [number, number][] = [
    [1, 1],
    [3, 2],
    [6, 4],
    [8, 5],
    [10, 6],
  ];
  WHITE.forEach((pc, i) => p.p(rbox(x + i * ww + 0.5, y, ww - 1, h, 1.5), pc === hot ? 'hot' : whiteRole, pc === hot));
  const bw = ww * 0.6;
  for (const [pc, after] of BLACK) p.p(rbox(x + after * ww - bw / 2, y, bw, h * 0.6, 1), pc === hot ? 'hot' : 'ghost', true);
}

/** Une forme d'onde : dent de scie vers carre (WAVE), droite par morceaux, periodes entieres. */
const waveAt = (t: number, w: number): number => {
  const saw = 2 * t - 1;
  const sq = t < 0.5 ? 1 : -1;
  return saw + (sq - saw) * w;
};
function wavePts(w: number, x0: number, x1: number, yc: number, amp: number, periods: number): Pt[] {
  const pts: Pt[] = [];
  const per = (x1 - x0) / periods;
  for (let k = 0; k < periods; k += 1) {
    for (const t of [0, 0.49999, 0.5, 0.99999]) pts.push([x0 + (k + t) * per, yc - amp * waveAt(t, w)]);
  }
  return pts;
}
function sinePts(x0: number, x1: number, yc: number, amp: number, periods: number, f: (x: number) => number = (x) => x): Pt[] {
  const pts: Pt[] = [];
  const n = Math.max(24, Math.round(periods * 32));
  for (let k = 0; k <= n; k += 1) pts.push([x0 + ((x1 - x0) * k) / n, yc - amp * f(Math.sin((2 * Math.PI * periods * k) / n))]);
  return pts;
}

/** Une decroissance e^(-t/tau) sur la duree span, de y haut (1) a y bas (0). */
function decayPts(tau: number, span: number, x0: number, x1: number, yTop: number, yBot: number, depth = 1): Pt[] {
  const pts: Pt[] = [[x0, yBot]];
  for (let k = 0; k <= 64; k += 1) {
    const t = (span * k) / 64;
    pts.push([x0 + ((x1 - x0) * k) / 64, yBot - (yBot - yTop) * depth * Math.exp(-t / tau)]);
  }
  return pts;
}

/** La grille des doubles croches sur span (le tempo du moment). */
function sixteenths(p: Pic, sd: number, span: number, y0 = Y0, y1 = Y1): void {
  for (let t = sd; t < span - 1e-6; t += sd) {
    const x = X0 + ((X1 - X0) * t) / span;
    p.p(seg(x, y0, x, y1), 'grid');
  }
}

/* ---------------- le filtre ---------------- */

const F_LO = 30;
const F_HI = 16000;
const fxOf = (f: number): number => X0 + ((Math.log(f) - Math.log(F_LO)) / (Math.log(F_HI) - Math.log(F_LO))) * (X1 - X0);
const DB_TOP = 24;
const DB_BOT = -48;
const dbY = (db: number): number => Y0 + ((DB_TOP - Math.max(DB_BOT, Math.min(DB_TOP, db))) / (DB_TOP - DB_BOT)) * (Y1 - Y0);

/** Le gain (dB) du filtre a f : la formule de l'ecran (screen.ts drawFilter), q = 0.6 + 7 RESO^2. */
function filterDb(f: number, fc: number, reso: number): number {
  const q = 0.6 + 7 * reso * reso;
  const r = f / fc;
  const two = 1 / Math.sqrt((1 - r * r) ** 2 + (r / q) ** 2);
  return 20 * Math.log10(two);
}

function filterCurve(fc: number, reso: number, f0 = F_LO, f1 = F_HI, n = 72): Pt[] {
  const pts: Pt[] = [];
  for (let k = 0; k <= n; k += 1) {
    const f = f0 * Math.pow(f1 / f0, k / n);
    pts.push([fxOf(f), dbY(filterDb(f, fc, reso))]);
  }
  return pts;
}

function filterGrid(p: Pic): void {
  for (const f of [100, 1000, 10000]) p.p(seg(fxOf(f), Y0, fxOf(f), Y1), 'grid');
  p.p(seg(X0, dbY(0), X1, dbY(0)), 'grid');
  p.label('100', fxOf(100), BOT, 'middle').label('1K', fxOf(1000), BOT, 'middle').label('10K', fxOf(10000), BOT, 'middle');
  p.label('0 DB', X0, dbY(0) - 3);
}

/** Le sommet de la courbe (sa frequence, son gain). */
function filterPeak(fc: number, reso: number): { f: number; db: number } {
  let best = { f: fc, db: -Infinity };
  for (let k = 0; k <= 96; k += 1) {
    const f = Math.max(F_LO, Math.min(F_HI, (fc / 4) * Math.pow(16, k / 96)));
    const db = filterDb(f, fc, reso);
    if (db > best.db) best = { f, db };
  }
  return best;
}

/* ---------------- les accents : le circuit du worklet, rejoue ---------------- */

/**
 * Une suite de pas (true : accentue) au tempo, pas de 1 ms : la coupure en
 * octaves au-dessus de CUTOFF (l'enveloppe, plus la charge des accents) et
 * le gain du VCA, comme MMBass.process (ACC DECAY et SWEEP, 2026-10-08).
 */
function accentRun(values: BassValues, bpm: number, accs: readonly boolean[]): { oct: number[]; sweep: number[]; gain: number[]; per: number } {
  const sd = stepS(bpm);
  const dt = 0.001;
  const per = Math.max(1, Math.round(sd / dt));
  const a = values.accent;
  const envOct = 5 * values.envmod;
  const dS = decayS(values.decay);
  const accDec = accDecayMs(values.accdecay) / 1000;
  const sw = sweepOct(values.sweep);
  const kS = 1 - Math.exp(-dt / (0.03 + 0.12 * values.reso));
  const kA = Math.exp(-dt / accDec);
  let env = 0;
  let accEnv = 0;
  let accSweep = 0;
  const oct: number[] = [];
  const sweep: number[] = [];
  const gain: number[] = [];
  for (const on of accs) {
    env = 1;
    const acc = on ? a : 0;
    if (on) accEnv = 1;
    const kE = Math.exp(-dt / (on ? accDec : dS));
    for (let j = 0; j < per; j += 1) {
      env *= kE;
      accEnv *= kA;
      accSweep += (accEnv * acc - accSweep) * kS;
      oct.push(envOct * (1 + 0.6 * acc) * env + sw * accSweep);
      sweep.push(sw * accSweep);
      gain.push(1 + 0.9 * acc * Math.max(env, 0.35));
    }
  }
  return { oct, sweep, gain, per };
}

/** Une courbe echantillonnee (une valeur par ms) en points, de i0 a i1, sur l'echelle donnee. */
function seriesPts(ys: readonly number[], i0: number, i1: number, xOf: (i: number) => number, yOf: (v: number) => number): Pt[] {
  const pts: Pt[] = [];
  const stride = Math.max(1, Math.round((i1 - i0) / 48));
  for (let i = i0; i < i1; i += stride) pts.push([xOf(i), yOf(ys[i])]);
  pts.push([xOf(i1 - 1), yOf(ys[i1 - 1])]);
  return pts;
}

/* ---------------- les dessins, un par commande ---------------- */

type Draw = (values: BassValues, c: BassDiagramCtx) => BassDiagram;
const valueOf = (p: Pic, id: BassKnobId, values: BassValues): Pic => p.value(bassValueText(id, values[id]));

/** ENVELOPE, ACC DECAY : deux decroissances sur la grille des doubles croches. */
function decays(values: BassValues, bpm: number, hot: 'normal' | 'accent'): Pic {
  const p = new Pic();
  const sd = stepS(bpm);
  const span = 8 * sd;
  sixteenths(p, sd, span);
  p.p(seg(X0, Y1, X1, Y1), 'grid');
  const tau = decayS(values.decay);
  const accTau = accDecayMs(values.accdecay) / 1000;
  p.p(poly(decayPts(tau, span, X0, X1, Y0, Y1)), hot === 'normal' ? 'hot' : 'main');
  p.p(poly(decayPts(accTau, span, X0, X1, Y0, Y1)), hot === 'accent' ? 'hot' : 'dash');
  // Les noms au bout de chaque courbe (a mi-chemin du trace)
  const yAt = (t: number): number => Y1 - (Y1 - Y0) * Math.exp((-span * 0.5) / t);
  const ya = yAt(accTau);
  const yn = yAt(tau);
  const apart = Math.abs(ya - yn) > 11;
  p.label('ACC', X0 + (X1 - X0) * 0.5 + 3, Math.max(Y0 + 9, ya - 4));
  if (apart) p.label('NOTE', X0 + (X1 - X0) * 0.5 + 3, Math.max(Y0 + 9, yn - 4));
  p.label(`1/16 = ${Math.round(sd * 1000)} MS`, X0, BOT);
  return p;
}

const DRAW: Partial<Record<BassInfoId, Draw>> = {
  /* ----- FILTER ----- */
  cutoff(values) {
    const p = new Pic();
    filterGrid(p);
    const fc = cutHz(values.cutoff);
    p.p(poly(filterCurve(fc, values.reso)), 'main');
    p.p(seg(fxOf(fc), Y0 - 4, fxOf(fc), Y1), 'hot');
    p.p(dot(fxOf(fc), Y0 - 4, 2.2), 'hot', true);
    p.label('LOW PASS', X0, TOP);
    return valueOf(p, 'cutoff', values).done();
  },
  reso(values) {
    const p = new Pic();
    filterGrid(p);
    const fc = cutHz(values.cutoff);
    p.p(poly(filterCurve(fc, 0)), 'ghost');
    p.p(poly(filterCurve(fc, values.reso)), 'main');
    const pk = filterPeak(fc, values.reso);
    p.p(poly(filterCurve(fc, values.reso, Math.max(F_LO, pk.f / 1.6), Math.min(F_HI, pk.f * 1.6), 16)), 'hot');
    p.p(dot(fxOf(pk.f), dbY(pk.db), 2.4), 'hot', true);
    const db = Math.round(pk.db);
    p.label(`PEAK ${db > 0 ? '+' : ''}${db} DB`, X0, TOP);
    return valueOf(p, 'reso', values).done();
  },

  /* ----- ENVELOPE ----- */
  envmod(values, c) {
    const p = new Pic();
    const sd = stepS(c.bpm);
    const span = 8 * sd;
    sixteenths(p, sd, span);
    // Six octaves de haut (ENV MOD va jusqu'a 5 ; un accent, plus haut, deborde)
    const OCT = 6;
    const oy = (o: number): number => Y1 - (Math.min(OCT, o) / OCT) * (Y1 - Y0);
    for (let o = 1; o < OCT; o += 1) p.p(seg(X0, oy(o), X0 + 4, oy(o)), 'grid');
    p.p(seg(X0, Y1, X1, Y1), 'dash');
    const depth = 5 * values.envmod;
    const tau = decayS(values.decay);
    const accDepth = depth * (1 + 0.6 * values.accent);
    const accTau = accDecayMs(values.accdecay) / 1000;
    const curve = (d: number, t: number): Pt[] => {
      const pts: Pt[] = [];
      for (let k = 0; k <= 64; k += 1) {
        const tt = (span * k) / 64;
        pts.push([X0 + ((X1 - X0) * k) / 64, oy(d * Math.exp(-tt / t))]);
      }
      return pts;
    };
    if (accDepth > 0.05) p.p(poly(curve(accDepth, accTau)), 'dash');
    p.p(poly(curve(depth, tau)), 'main');
    p.p(arrow(X0 + 3, Y1, X0 + 3, oy(depth), depth > 0.6 ? 4 : 0), 'hot');
    const fc = cutHz(values.cutoff);
    p.label(`+${depth.toFixed(1)} OCT  ${hzText(Math.min(20000, fc * Math.pow(2, depth)))}`, X0 + 10, TOP);
    if (accDepth > 0.05) p.label('ACC', X0 + 10, Math.max(Y0 + 9, oy(accDepth) + 3));
    p.label(`CUTOFF ${hzText(fc)}`, X1, Y1 - 4, 'end');
    p.label(`1/16 = ${Math.round(sd * 1000)} MS`, X0, BOT);
    return valueOf(p, 'envmod', values).done();
  },
  decay(values, c) {
    return valueOf(decays(values, c.bpm, 'normal'), 'decay', values).done();
  },

  /* ----- ACCENT / SLIDE ----- */
  accent(values, c) {
    const p = new Pic();
    const accs = [false, true, true];
    const run = accentRun(values, c.bpm, accs);
    const n = run.oct.length;
    const xOf = (i: number): number => X0 + ((X1 - X0) * i) / n;
    const top = Math.max(2, ...run.oct);
    const oy = (o: number): number => 72 - (o / top) * (72 - Y0);
    for (let k = 1; k < accs.length; k += 1) p.p(seg(xOf(k * run.per), Y0, xOf(k * run.per), Y1 + 4), 'grid');
    p.p(seg(X0, 72, X1, 72), 'grid');
    accs.forEach((on, k) => {
      p.p(poly(seriesPts(run.oct, k * run.per, (k + 1) * run.per, xOf, oy)), on ? 'hot' : 'main');
      // Le volume au debut du pas : x(1 + 0.9 ACCENT)
      const g = run.gain[k * run.per];
      const bh = (24 * g) / 1.9;
      p.p(rbox(xOf(k * run.per) + 6, 102 - bh, xOf(run.per) - X0 - 12, bh, 2), on ? 'hot' : 'main', true);
      p.label(on ? 'ACC' : 'NOTE', xOf((k + 0.5) * run.per), BOT + 2, 'middle');
    });
    const db = 20 * Math.log10(1 + 0.9 * values.accent);
    p.label(`FILTER  +${db.toFixed(1)} DB`, X0, TOP);
    return valueOf(p, 'accent', values).done();
  },
  glide(values, c) {
    const p = new Pic();
    const sd = stepS(c.bpm);
    const span = 3 * sd;
    const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
    const yA = 84;
    const yB = 36;
    p.p(seg(tx(sd), Y0, tx(sd), Y1), 'grid').p(seg(tx(2 * sd), Y0, tx(2 * sd), Y1), 'grid');
    p.p(poly([
      [tx(sd), yA],
      [tx(sd), yB],
      [X1, yB],
    ]), 'dash');
    p.p(seg(X0, yA, tx(sd), yA), 'main');
    const tau = glideS(values.glide);
    const pts: Pt[] = [];
    for (let k = 0; k <= 48; k += 1) {
      const t = (2 * sd * k) / 48;
      pts.push([tx(sd + t), yB + (yA - yB) * Math.exp(-t / tau)]);
    }
    p.p(poly(pts), 'hot');
    p.label('SLIDE', tx(sd / 2), yA - 8, 'middle');
    p.label('NOTE', tx(2 * sd), yB - 6, 'middle');
    p.label(`1/16 = ${Math.round(sd * 1000)} MS`, X0, BOT);
    return valueOf(p, 'glide', values).done();
  },

  /* ----- OSC ----- */
  wave(values) {
    const p = new Pic();
    p.p(seg(X0, 60, X1, 60), 'grid');
    p.p(poly(wavePts(0, X0, X1, 60, 34, 2)), 'ghost');
    p.p(poly(wavePts(1, X0, X1, 60, 34, 2)), 'ghost');
    p.p(poly(wavePts(values.wave, X0, X1, 60, 34, 2)), 'hot');
    p.label('SAW', X0, TOP).label('SQUARE', X0 + 34, TOP);
    return valueOf(p, 'wave', values).done();
  },
  sub(values) {
    const p = new Pic();
    const v = values.sub;
    const div = stepOf('suboct', values.suboct) === 0 ? 2 : 4;
    p.p(seg(X0, 38, X1, 38), 'grid').p(seg(X0, 86, X1, 86), 'grid');
    if (v > 0.01) p.p(poly(wavePts(values.wave, X0, X1, 38, 15, 4)), 'ghost');
    p.p(poly(wavePts(values.wave, X0, X1, 38, 15 * (1 - 0.5 * v), 4)), 'main');
    p.p(poly(sinePts(X0, X1, 86, 15 * v, 4 / div)), 'hot');
    p.label('OSC > FILTER > DRIVE', X0, TOP);
    p.label(`SUB ${div === 2 ? '-1' : '-2'} OCT, POST FILTER`, X0, 66);
    return valueOf(p, 'sub', values).done();
  },
  octave(values) {
    // L'axe des frequences (log, 15 a 400 Hz) : la tonique de chaque cran, celle qui joue en haut ; le sub sous 40 Hz
    const p = new Pic();
    const sel = stepOf('octave', values.octave);
    const t0 = tonicMidi({ ...values, octave: 0 });
    const ax = (f: number): number => X0 + ((Math.log(f) - Math.log(15)) / (Math.log(400) - Math.log(15))) * (X1 - X0);
    const base = 86;
    p.p(rbox(X0, 26, ax(40) - X0, base - 26, 3), 'ghost', true);
    p.label('SUB', X0 + 4, 38);
    p.p(seg(X0, base, X1, base), 'grid');
    for (const f of [20, 50, 100, 200]) {
      p.p(seg(ax(f), base, ax(f), base + 4), 'grid');
      p.label(String(f), ax(f), base + 14, 'middle');
    }
    p.label('HZ', X1, base + 14, 'end');
    for (let i = 0; i < 4; i += 1) {
      const m = t0 + 12 * i;
      const x = ax(hzOf(m));
      const on = i === sel;
      p.p(seg(x, base, x, on ? 30 : 58), on ? 'hot' : 'ghost');
      if (on) p.p(dot(x, 30, 3), 'hot', true);
      p.label(['-2', '-1', '0', '+1'][i], x + 4, on ? 34 : 62);
    }
    const m = tonicMidi(values);
    p.label(`${noteName(m)}  ${hzText(hzOf(m))}`, X0, TOP);
    return valueOf(p, 'octave', values).done();
  },

  /* ----- OUTPUT ----- */
  drive(values) {
    const p = new Pic();
    const g = driveGain(values.drive);
    const tf = (x: number): number => (g > 1.001 ? fastTanh(x * g) * Math.pow(g, -0.45) : x);
    const cx = 58;
    const cy = 62;
    const R = 40;
    p.p(rbox(cx - R, cy - R, 2 * R, 2 * R, 3), 'grid');
    p.p(seg(cx - R, cy, cx + R, cy), 'grid').p(seg(cx, cy - R, cx, cy + R), 'grid');
    p.p(seg(cx - R, cy + R, cx + R, cy - R), 'dash');
    const pts: Pt[] = [];
    for (let k = 0; k <= 48; k += 1) {
      const x = -1 + (2 * k) / 48;
      pts.push([cx + x * R, cy - tf(x) * R]);
    }
    p.p(poly(pts), 'hot');
    // A droite : un sinus qui entre, l'onde qui sort
    p.p(seg(116, cy, X1, cy), 'grid');
    p.p(poly(sinePts(116, X1, cy, 0.9 * 34, 2)), 'ghost');
    p.p(poly(sinePts(116, X1, cy, 34, 2, (s) => tf(0.9 * s))), 'hot');
    p.label(`GAIN x${g.toFixed(1)}`, X0, TOP);
    p.label('IN', 116, BOT).label('OUT', 140, BOT);
    return valueOf(p, 'drive', values).done();
  },
  volume(values) {
    const p = new Pic();
    const v = values.volume;
    // Le reglage d'usine (0.78) crete vers -6 dBFS ; le gain suit v^2 x 1.82
    const db = v <= 0.001 ? -Infinity : -6 + 40 * Math.log10(v / 0.78);
    const MX0 = 16;
    const MX1 = 224;
    const dx = (d: number): number => MX0 + ((Math.max(-24, Math.min(0, d)) + 24) / 24) * (MX1 - MX0);
    p.p(rbox(MX0, 50, MX1 - MX0, 18, 4), 'ghost');
    if (db > -24) p.p(rbox(MX0, 50, dx(db) - MX0, 18, 4), 'hot', true);
    for (const d of [-24, -18, -12, -6, 0]) {
      p.p(seg(dx(d), 72, dx(d), 77), 'grid');
      p.label(String(d), dx(d), 90, 'middle');
    }
    p.p(seg(dx(-4), 42, dx(-4), 76), 'main');
    p.label('KICK', dx(-4), 37, 'middle');
    p.label('BASS', MX0, 44);
    p.label(`${Number.isFinite(db) ? `${db > 0 ? '+' : ''}${db.toFixed(1)}` : '-INF'} DBFS`, X0, TOP);
    p.label('DBFS', MX1, 104, 'end');
    return valueOf(p, 'volume', values).done();
  },

  /* ----- GENERATOR ----- */
  style(values) {
    const p = new Pic();
    const st = styleOf(values);
    beats(p);
    roll(p, styleLine(st), SCALE_TONES.MINOR, GATE[st], Y0, Y1);
    p.label(`GATE ${Math.round(GATE[st] * 100)} %`, X0, TOP);
    p.label('FACTORY LINE', X0, BOT);
    return valueOf(p, 'style', values).done();
  },
  density(values) {
    const p = new Pic();
    const t = typical(values, countNotes);
    cells(p, t.line, 42, 34, () => true);
    p.label(styleOf(values) === 'SUB' ? `${about(t.mean)} CHANGES / BAR` : `${about(t.mean)} NOTES / BAR`, X0, TOP);
    p.label('A TYPICAL GEN LINE', X0, BOT);
    return valueOf(p, 'density', values).done();
  },
  slides(values) {
    const p = new Pic();
    const t = typical(values, countSlides);
    cells(p, t.line, 44, 30, () => false);
    slideMarks(p, t.line, 44, 30, 'hot');
    p.label(`${about(t.mean)} SLIDES / BAR, ${styleOf(values)}`, X0, TOP);
    p.label('A TYPICAL GEN LINE', X0, BOT);
    return valueOf(p, 'slides', values).done();
  },
  accents(values) {
    const p = new Pic();
    const t = typical(values, countAccents);
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const s = t.line[i];
      const x = X0 + i * PITCH + 1;
      if (s.kind === 'off') p.p(rbox(x, 42, PITCH - 2, 34, 2), 'grid');
      else if (s.kind === 'tie') p.p(rbox(x, 52, PITCH - 2, 14, 1.5), 'ghost', true);
      else p.p(rbox(x, 42, PITCH - 2, 34, 2), s.acc ? 'hot' : 'ghost', true);
    }
    p.label(`${about(t.mean)} ACCENTS / BAR`, X0, TOP);
    p.label('A TYPICAL GEN LINE', X0, BOT);
    return valueOf(p, 'accents', values).done();
  },
  range(values) {
    const p = new Pic();
    const range = stepOf('range', values.range) + 1;
    const top = 39;
    const sy = (s: number): number => Y1 - (Math.max(0, Math.min(top, s)) / top) * (Y1 - Y0);
    p.p(rbox(X0, sy(12 * range), X1 - X0, sy(0) - sy(12 * range), 2), 'ghost', true);
    for (let o = 1; o <= 3; o += 1) {
      p.p(seg(X0, sy(12 * o), X1, sy(12 * o)), o === range ? 'hot' : 'grid');
      p.label(`${o} OCT`, X1, sy(12 * o) - 3, 'end');
    }
    const line = generate(genOf(values, mulberry(11)));
    const semis = semisOf(line, SCALE_TONES[BASS_SCALES[stepOf('scale', values.scale)]]);
    semis.forEach((m, i) => {
      if (m === null || line[i].kind !== 'note') return;
      p.p(rbox(X0 + i * PITCH + 1, sy(m) - 2.5, PITCH - 2, 5, 1.5), 'main', true);
    });
    p.label('A TYPICAL GEN LINE', X0, BOT);
    return valueOf(p, 'range', values).done();
  },
  root(values, c) {
    const p = new Pic();
    const r = stepOf('root', values.root);
    const pc = r === 0 ? 6 : (6 + r - 1) % 12;
    keyboard(p, X0, 44, X1 - X0, 56, pc, 'main');
    const kx = (q: number): number => {
      const WHITE = [0, 2, 4, 5, 7, 9, 11];
      const ww = (X1 - X0) / 7;
      const wi = WHITE.indexOf(q);
      if (wi >= 0) return X0 + (wi + 0.5) * ww;
      return X0 + WHITE.filter((w) => w < q).length * ww;
    };
    if (r === 0) {
      const roots = (c.arpRoots && c.arpRoots.length ? c.arpRoots : ['F#']).slice(0, 8);
      const bw = Math.min(40, (X1 - X0 - 60) / roots.length - 4);
      p.label('MM-ARP', X0, 34);
      roots.forEach((name, i) => {
        const x = X0 + 56 + i * (bw + 4);
        p.p(rbox(x, 22, bw, 16, 3), i === 0 ? 'hot' : 'ghost');
        p.label(name, x + bw / 2, 34, 'middle');
      });
    } else {
      const semis = r - 1;
      const up = semis <= 5;
      const x = kx(pc);
      p.p(up ? arrow(x, 38, x, 18, 5) : arrow(x, 18, x, 38, 5), 'hot');
      p.label(up ? 'UP FROM F#' : 'DOWN FROM F#', x + (x > 150 ? -8 : 8), 30, x > 150 ? 'end' : 'start');
    }
    return valueOf(p, 'root', values).done();
  },
  scale(values) {
    const p = new Pic();
    const sc = BASS_SCALES[stepOf('scale', values.scale)];
    const tones = SCALE_TONES[sc];
    const r = stepOf('root', values.root);
    const base = r === 0 ? 6 : (6 + r - 1) % 12;
    const cw = (X1 - X0) / 13;
    for (let i = 0; i <= 12; i += 1) {
      const deg = tones.indexOf(i % 12);
      const on = deg >= 0;
      const black = [1, 3, 6, 8, 10].includes((base + i) % 12);
      const x = X0 + i * cw + 1;
      const y = black ? 40 : 46;
      p.p(rbox(x, y, cw - 2, black ? 30 : 36, 2), on ? 'hot' : 'grid', on);
      if (on) {
        p.label(String(i === 12 ? 1 : deg + 1), x + (cw - 2) / 2, 96, 'middle');
        p.label(pcName(base + i), x + (cw - 2) / 2, 34, 'middle');
      }
    }
    p.label(`${r === 0 ? 'F# (ARP)' : BASS_ROOTS[r]}`, X0, TOP);
    p.label('DEGREES', X0, BOT);
    return valueOf(p, 'scale', values).done();
  },

  /* ----- TWEAKS / VOICE ----- */
  length(values) {
    const p = new Pic();
    const st = styleOf(values);
    const l = lengthPct(values.length);
    const frac = gateOf(values);
    const cw = (X1 - X0) / 4;
    for (let i = 0; i <= 4; i += 1) p.p(seg(X0 + i * cw, 34, X0 + i * cw, 86), 'grid');
    for (let i = 0; i < 4; i += 1) {
      const x = X0 + i * cw;
      p.p(rbox(x + 2, 46, Math.max(2, (cw - 4) * frac), 28, 3), 'hot', true);
      if (l !== null) p.p(seg(x + 2 + (cw - 4) * GATE[st], 40, x + 2 + (cw - 4) * GATE[st], 80), 'dash');
    }
    p.label(l === null ? `AUTO: ${st} ${Math.round(GATE[st] * 100)} %` : `${st} AUTO ${Math.round(GATE[st] * 100)} %`, X0, TOP);
    p.label('1 STEP', X0 + cw / 2, BOT - 12, 'middle');
    return valueOf(p, 'length', values).done();
  },
  accdecay(values, c) {
    return valueOf(decays(values, c.bpm, 'accent'), 'accdecay', values).done();
  },
  sweep(values, c) {
    const p = new Pic();
    const accs = [true, true, true, true, false, false];
    const run = accentRun({ ...values, accent: Math.max(values.accent, 0.001) }, c.bpm, accs);
    const n = run.sweep.length;
    const xOf = (i: number): number => X0 + ((X1 - X0) * i) / n;
    const oy = (o: number): number => 92 - (o / 4) * (92 - Y0);
    for (let k = 1; k < accs.length; k += 1) p.p(seg(xOf(k * run.per), Y0, xOf(k * run.per), 92), 'grid');
    p.p(seg(X0, 92, X1, 92), 'grid');
    const sw = sweepOct(values.sweep);
    p.p(seg(X0, oy(sw), X1, oy(sw)), 'dash');
    p.label(`MAX ${sw.toFixed(1)} OCT`, X1, oy(sw) - 3, 'end');
    p.p(poly(seriesPts(run.sweep, 0, n, xOf, oy)), 'hot');
    accs.forEach((on, k) => {
      if (on) p.p(rbox(xOf(k * run.per) + 3, 96, xOf(run.per) - X0 - 6, 6, 2), 'main', true);
    });
    p.label('4 ACCENTS IN A ROW', X0, BOT);
    p.label(`RESO ${Math.round(values.reso * 100)}: ${Math.round((0.03 + 0.12 * values.reso) * 1000)} MS CHARGE`, X0, TOP);
    return valueOf(p, 'sweep', values).done();
  },
  release(values, c) {
    const p = new Pic();
    const sd = stepS(c.bpm);
    const gate = gateOf(values) * sd;
    const rel = releaseMs(values.release) / 1000;
    const span = Math.min(8 * sd, Math.max(2 * sd, gate + 3.2 * rel));
    const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
    const ay = (a: number): number => 92 - a * (92 - 28);
    sixteenths(p, sd, span, 28, 92);
    p.p(seg(X0, 92, X1, 92), 'grid');
    const att = (t: number): number => 1 - Math.exp(-t / 0.0025);
    const hold: Pt[] = [];
    for (let k = 0; k <= 24; k += 1) {
      const t = (gate * k) / 24;
      hold.push([tx(t), ay(att(t))]);
    }
    p.p(poly([[X0, 92], ...hold]), 'main');
    const g = att(gate);
    const tail: Pt[] = [];
    for (let k = 0; k <= 48; k += 1) {
      const t = ((span - gate) * k) / 48;
      tail.push([tx(gate + t), ay(g * Math.exp(-t / rel))]);
    }
    p.p(poly(tail), 'hot');
    p.p(seg(tx(gate), 22, tx(gate), 96), 'dash');
    p.label(`GATE ${Math.round(gateOf(values) * 100)} %`, Math.min(tx(gate) + 4, X1 - 60), 22);
    p.label(`1/16 = ${Math.round(sd * 1000)} MS`, X0, BOT);
    return valueOf(p, 'release', values).done();
  },
  suboct(values) {
    const p = new Pic();
    const div = stepOf('suboct', values.suboct) === 0 ? 2 : 4;
    p.p(seg(X0, 38, X1, 38), 'grid').p(seg(X0, 86, X1, 86), 'grid');
    p.p(poly(wavePts(values.wave, X0, X1, 38, 15, 4)), 'main');
    p.p(poly(sinePts(X0, X1, 86, 15, 4 / div)), 'hot');
    const m = tonicMidi(values);
    p.label(`NOTE ${noteName(m)}  ${hzText(hzOf(m))}`, X0, TOP);
    p.label(`SUB  ${hzText(hzOf(m) / div)}`, X0, 66);
    return valueOf(p, 'suboct', values).done();
  },
  tune(values) {
    const p = new Pic();
    const cx = 120;
    const cy = 106;
    const R = 80;
    const at = (cents: number, r: number): Pt => {
      const a = ((Math.max(-50, Math.min(50, cents)) / 50) * 55 * Math.PI) / 180;
      return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    };
    const [ax, ay] = at(-50, R);
    const [bx, by] = at(50, R);
    p.p(`M${n1(ax)} ${n1(ay)}A${R} ${R} 0 0 1 ${n1(bx)} ${n1(by)}`, 'ghost');
    for (let k = -50; k <= 50; k += 10) {
      const big = k % 50 === 0;
      const [x0, y0] = at(k, R - (big ? 9 : 5));
      const [x1, y1] = at(k, R);
      p.p(seg(x0, y0, x1, y1), big ? 'main' : 'grid');
    }
    for (const k of [-50, 0, 50]) {
      const [x, y] = at(k, R + 9);
      p.label(k > 0 ? `+${k}` : String(k), x, y + 3, 'middle');
    }
    const c = tuneCents(values.tune);
    const [nx, ny] = at(c, R - 4);
    p.p(seg(cx, cy, nx, ny), 'hot');
    p.p(dot(cx, cy, 3), 'main', true);
    const m = tonicMidi(values);
    p.label(`${noteName(m)}  ${(hzOf(m) * Math.pow(2, c / 1200)).toFixed(2)} HZ`, X0, TOP);
    return valueOf(p, 'tune', values).done();
  },

  /* ----- les touches ----- */
  run(_values, c) {
    const p = new Pic();
    const steps = c.steps ?? [];
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const x = X0 + i * PITCH + 1;
      if (i % 4 === 0) p.p(rbox(x, 24, PITCH - 2, 14, 2), 'ghost', true);
      else p.p(dot(x + (PITCH - 2) / 2, 31, 1), 'grid', true);
    }
    cells(p, steps, 60, 30, () => false);
    // La tete de lecture sur le premier pas, le triangle de RUN en haut a gauche
    p.p(rbox(X0 - 1, 20, PITCH, 74, 3), 'hot');
    p.p(`M${X0} 3L${X0 + 8} 7.5L${X0} 12Z`, 'hot', true);
    p.label('RYTM', X0 + PITCH + 2, 52).label('BASS', X0 + PITCH + 2, BOT - 10);
    p.label('IN TIME', X0 + 14, TOP);
    return p.value(`${Math.round(c.bpm)} BPM`).done();
  },
  gen(values, c) {
    const p = new Pic();
    p.p(rbox(X0, 38, 44, 44, 8), 'main');
    for (const [dx, dy] of [
      [11, 11],
      [33, 11],
      [22, 22],
      [11, 33],
      [33, 33],
    ] as const)
      p.p(dot(X0 + dx, 38 + dy, 3), 'main', true);
    p.p(arrow(64, 60, 92, 60, 6), 'main');
    const steps = c.steps ?? [];
    const pitch = (X1 - 100) / 8;
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const s = steps[i];
      const x = 100 + (i % 8) * pitch + 1;
      const y = i < 8 ? 38 : 64;
      if (!s || s.kind === 'off') p.p(rbox(x, y, pitch - 2, 18, 2), 'grid');
      else if (s.kind === 'tie') p.p(rbox(x, y + 5, pitch - 2, 8, 1.5), 'ghost', true);
      else p.p(rbox(x, y, pitch - 2, 18, 2), 'hot', true);
    }
    p.label(`${styleOf(values)}, DENSITY ${Math.round(values.density * 100)}`, X0, TOP);
    p.label('16 NEW STEPS', 100, BOT - 8);
    return p.done();
  },
  mutate(values, c) {
    const p = new Pic();
    const steps = c.steps ?? [];
    const next = steps.length === BASS_STEPS ? mutate(steps, genOf(values, mulberry(29))) : [];
    cells(p, steps, 42, 32, () => false);
    let n = 0;
    next.forEach((s, i) => {
      const o = steps[i];
      if (!o || (s.kind === o.kind && s.deg === o.deg && s.oct === o.oct && s.acc === o.acc && s.slide === o.slide)) return;
      n += 1;
      p.p(rbox(X0 + i * PITCH - 1, 38, PITCH + 2, 40, 3), 'hot');
    });
    p.label(n ? `${n} STEPS CHANGE` : '2 TO 4 STEPS CHANGE', X0, TOP);
    return p.done();
  },
  accentkey(values, c) {
    const p = new Pic();
    const steps = c.steps ?? [];
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const s = steps[i];
      const x = X0 + i * PITCH + 1;
      if (!s || s.kind === 'off') p.p(rbox(x, 42, PITCH - 2, 34, 2), 'grid');
      else if (s.kind === 'tie') p.p(rbox(x, 52, PITCH - 2, 14, 1.5), 'ghost', true);
      else p.p(rbox(x, 42, PITCH - 2, 34, 2), s.acc ? 'hot' : 'ghost', true);
    }
    p.label(`${countAccents(steps)} ACCENTS, FORCE ${Math.round(values.accent * 100)}`, X0, TOP);
    return p.done();
  },
  slide(values, c) {
    const p = new Pic();
    const steps = c.steps ?? [];
    cells(p, steps, 44, 30, () => false);
    slideMarks(p, steps, 44, 30, 'hot');
    p.label(`${countSlides(steps)} SLIDES, GLIDE ${bassValueText('glide', values.glide)}`, X0, TOP);
    return p.done();
  },
  edit() {
    const p = new Pic();
    const pitch = (X1 - X0) / 8;
    for (let i = 0; i < 16; i += 1) {
      const x = X0 + (i % 8) * pitch + 2;
      const y = i < 8 ? 26 : 64;
      if (i === 0) p.p(rbox(x, y, pitch - 4, 30, 3), 'hot', true);
      else p.p(rbox(x, y, pitch - 4, 30, 3), i < 3 ? 'main' : 'grid');
    }
    p.p(arrow(X0 + pitch - 4, 41, X0 + pitch + 4, 41, 3), 'hot').p(arrow(X0 + 2 * pitch - 4, 41, X0 + 2 * pitch + 4, 41, 3), 'hot');
    p.label('A01 > A02 > A03', X0, TOP);
    p.label('16 PATTERNS', X0, BOT);
    return p.done();
  },
  open() {
    const p = new Pic();
    p.p(rbox(30, 74, 180, 26, 4), 'main');
    const a = (20 * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = -Math.sin(a);
    const L = 170;
    const t = 7;
    const p0: Pt = [30, 72];
    const p1: Pt = [p0[0] + L * dx, p0[1] + L * dy];
    p.p(poly([p0, p1, [p1[0] - t * dy, p1[1] + t * dx], [p0[0] - t * dy, p0[1] + t * dx], p0]), 'main');
    p.p(rbox(66, 60, 108, 12, 3), 'hot');
    for (let i = 0; i < 6; i += 1) p.p(dot(78 + i * 17, 66, 2.6), 'hot', true);
    p.label('TWEAKS', 120, 54, 'middle');
    p.label('LID', 112, 24, 'middle');
    return p.done();
  },
  lock(_values, c) {
    const p = new Pic();
    const steps = c.steps ?? [];
    const lit = c.step !== undefined && c.step >= 0 && c.step < BASS_STEPS ? c.step : Math.max(0, steps.findIndex((s) => !!s.locks));
    const here = Object.keys(steps[lit]?.locks ?? {}).length;
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const x = X0 + i * PITCH + 1;
      const s = steps[i];
      p.p(rbox(x + 1.5, 66, PITCH - 5, 6, 2), i === lit ? 'hot' : s?.locks ? 'main' : 'grid', i === lit || !!s?.locks);
      p.p(rbox(x, 78, PITCH - 2, 20, 2), i === lit ? 'hot' : !s || s.kind === 'off' ? 'grid' : 'ghost', !!s && s.kind !== 'off' && i !== lit);
    }
    // Le potard qu'on tourne : sa valeur part dans le pas
    p.p(dot(40, 36, 14), 'main');
    p.p(seg(40, 36, 40 + 11 * Math.cos(-0.9), 36 + 11 * Math.sin(-0.9)), 'main');
    const tx = X0 + lit * PITCH + PITCH / 2;
    p.p(arrow(56, 40, tx, 62, 5), 'hot');
    p.label(here ? `${here} LOCK${here > 1 ? 'S' : ''} ON THIS STEP` : 'NO LOCK YET', X1, TOP, 'end');
    p.label(`STEP ${String(lit + 1).padStart(2, '0')}`, X0, TOP);
    return p.done();
  },
  trig() {
    const p = new Pic();
    p.p(rbox(20, 30, 44, 36, 4), 'grid');
    p.p(rbox(98, 30, 44, 36, 4), 'hot', true);
    p.p(rbox(176, 41, 44, 14, 3), 'ghost', true);
    p.p(arrow(68, 48, 94, 48, 5), 'main').p(arrow(146, 48, 172, 48, 5), 'main');
    p.p('M198 90Q120 112 42 90', 'main').p(tip(50, 94, 42, 90, 5), 'main');
    p.label('OFF', 42, 82, 'middle').label('NOTE', 120, 82, 'middle').label('TIE', 198, 82, 'middle');
    p.label('TAP', X0, TOP);
    p.label('HOLD + TURN A KNOB: LOCK', X1, TOP, 'end');
    return p.done();
  },
  clear(_values, c) {
    const p = new Pic();
    const steps = c.steps ?? [];
    const pitch = 96 / 8;
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const s = steps[i];
      const x = X0 + (i % 8) * pitch + 1;
      const y = i < 8 ? 40 : 62;
      p.p(rbox(x, y, pitch - 2, 16, 2), !s || s.kind === 'off' ? 'grid' : 'main', !!s && s.kind !== 'off');
      p.p(rbox(132 + (i % 8) * pitch + 1, y, pitch - 2, 16, 2), 'grid');
    }
    p.p(arrow(112, 58, 128, 58, 4), 'hot');
    p.label('IN LOCK: ONLY THE STEP LOCKS', X0, BOT);
    return p.done();
  },
  notedn: (values) => degreeMove(values, -1),
  noteup: (values) => degreeMove(values, 1),
  octdn: () => octaveMove(-1),
  octup: () => octaveMove(1),

  /* ----- la machine Elektron (2026-10-08) ----- */
  pw(values) {
    const p = new Pic();
    const duty = pwPct(values.pw) / 100;
    const sq = (d: number): Pt[] => {
      const pts: Pt[] = [];
      const per = (X1 - X0) / 2;
      for (let k = 0; k < 2; k += 1) {
        const x = X0 + k * per;
        pts.push([x, 34], [x + per * d, 34], [x + per * d, 86], [x + per, 86]);
      }
      pts.push([X1, 34]);
      return pts;
    };
    p.p(seg(X0, 60, X1, 60), 'grid');
    p.p(poly(sq(0.5)), 'ghost');
    p.p(poly(sq(duty)), 'hot');
    p.label(values.wave < 0.03 ? 'WAVE AT SAW: TURN WAVE UP TO HEAR PW' : `SQUARE ${Math.round(values.wave * 100)} % OF THE MIX`, X0, TOP);
    p.label('50 %', X0, BOT);
    return valueOf(p, 'pw', values).done();
  },
  keytrack(values) {
    // La coupure (log) selon la note jouee, sur trois octaves autour de la tonique
    const p = new Pic();
    const kt = values.keytrack;
    const fc = cutHz(values.cutoff);
    const yOf = (f: number): number => Y1 - ((Math.log2(f) - Math.log2(30)) / (Math.log2(16000) - Math.log2(30))) * (Y1 - Y0);
    const xOf = (oct: number): number => X0 + ((oct + 1) / 3) * (X1 - X0);
    for (const o of [-1, 0, 1, 2]) p.p(seg(xOf(o), Y0, xOf(o), Y1), 'grid');
    p.p(seg(X0, yOf(fc), X1, yOf(fc)), 'ghost');
    p.p(seg(xOf(-1), yOf(fc * Math.pow(2, -kt)), xOf(2), yOf(fc * Math.pow(2, 2 * kt))), 'hot');
    p.p(dot(xOf(0), yOf(fc), 2.4), 'hot', true);
    p.label('F#1', xOf(-1), BOT, 'middle').label('F#2', xOf(0), BOT, 'middle').label('F#3', xOf(1), BOT, 'middle').label('F#4', xOf(2), BOT, 'end');
    p.label(`CUTOFF ${hzText(fc)} AT F#2`, X0, TOP);
    return valueOf(p, 'keytrack', values).done();
  },
  attack: (values, c) => ampEnv(values, c, 'attack'),
  adecay: (values, c) => ampEnv(values, c, 'adecay'),
  sustain: (values, c) => ampEnv(values, c, 'sustain'),
  delay: (values, c) => echoes(values, c, 'delay'),
  dtime: (values, c) => echoes(values, c, 'dtime'),
  dfb: (values, c) => echoes(values, c, 'dfb'),
  reverb: (values) => tail(values, 'reverb'),
  rsize: (values) => tail(values, 'rsize'),
  rtone: (values) => tail(values, 'rtone'),
  pvoice: () => pageGrid('voice'),
  pfilter: () => pageGrid('filter'),
  penv: () => pageGrid('env'),
  pfx: () => pageGrid('fx'),
};

/**
 * L'ampli (2026-10-08) : une note tenue six pas, la loi du worklet (la montee
 * vers 1 en ATTACK, AMP DECAY vers SUSTAIN une fois a 99 %, RELEASE au
 * relachement) ; le segment du reglage en trait plein.
 */
function ampEnv(values: BassValues, c: BassDiagramCtx, hot: 'attack' | 'adecay' | 'sustain'): BassDiagram {
  const p = new Pic();
  const sd = stepS(c.bpm);
  const gate = 6 * sd;
  const att = attackMs(values.attack) / 1000;
  const dec = adecayMs(values.adecay) / 1000;
  const rel = releaseMs(values.release) / 1000;
  const sus = values.sustain;
  const span = gate + Math.max(2 * sd, Math.min(6 * sd, 4 * rel));
  const N = 220;
  const dt = span / N;
  const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
  const ay = (a: number): number => 96 - a * (96 - 26);
  sixteenths(p, sd, span, 26, 96);
  p.p(seg(X0, 96, X1, 96), 'grid');
  const segs: Record<'attack' | 'adecay' | 'sustain' | 'release', Pt[]> = { attack: [], adecay: [], sustain: [], release: [] };
  let vca = 0;
  let lvl = 1;
  let decaying = false;
  let phase: 'attack' | 'adecay' | 'sustain' | 'release' = 'attack';
  for (let k = 0; k <= N; k += 1) {
    const t = k * dt;
    if (t < gate) {
      vca += ((decaying ? lvl : 1) - vca) * (1 - Math.exp(-dt / att));
      if (!decaying && vca >= 0.99) decaying = true;
      if (decaying) lvl = sus + (lvl - sus) * Math.exp(-dt / dec);
      phase = !decaying ? 'attack' : Math.abs(lvl - sus) > 0.02 ? 'adecay' : 'sustain';
    } else {
      vca += (0 - vca) * (1 - Math.exp(-dt / rel));
      phase = 'release';
    }
    const pt: Pt = [tx(t), ay(vca)];
    const prev = segs[phase];
    // Les segments se touchent : chacun commence ou finit le precedent
    if (prev.length === 0 && k > 0) {
      const all = [...segs.attack, ...segs.adecay, ...segs.sustain, ...segs.release];
      const last = all[all.length - 1];
      if (last) prev.push(last);
    }
    prev.push(pt);
  }
  for (const key of ['attack', 'adecay', 'sustain', 'release'] as const) if (segs[key].length > 1) p.p(poly(segs[key]), key === hot ? 'hot' : 'main');
  p.p(seg(X0, ay(sus), tx(gate), ay(sus)), 'dash');
  p.p(seg(tx(gate), 20, tx(gate), 98), 'dash');
  p.label('NOTE HELD 6/16', Math.min(tx(gate) + 4, X1 - 70), 22);
  p.label(`A ${bassValueText('attack', values.attack)}  D ${bassValueText('adecay', values.adecay)}  S ${bassValueText('sustain', values.sustain)}  R ${bassValueText('release', values.release)}`, X0, BOT);
  return valueOf(p, hot, values).done();
}

/** Le DELAY : les repetitions gauche (au-dessus), droite (dessous), espacees de DLY TIME, attenuees de DLY FB. */
function echoes(values: BassValues, c: BassDiagramCtx, hot: 'delay' | 'dtime' | 'dfb'): BassDiagram {
  const p = new Pic();
  const sd = stepS(c.bpm);
  const steps = DTIME_STEPS[stepOf('dtime', values.dtime)];
  const time = steps * sd;
  const fb = dfbPct(values.dfb) / 100;
  const send = hot === 'delay' ? Math.max(values.delay, 0.02) : 1;
  const span = 16 * sd;
  const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
  const mid = 60;
  sixteenths(p, sd * 4, span, 22, 98);
  p.p(seg(X0, mid, X1, mid), 'grid');
  // La note seche, puis ses echos
  p.p(seg(tx(0), mid, tx(0), 24), 'main');
  let a = send;
  let n = 0;
  for (let t = time; t < span && n < 24; t += time, n += 1) {
    const up = n % 2 === 0;
    const h = 34 * a;
    p.p(seg(tx(t), mid, tx(t), up ? mid - h : mid + h), hot === 'dtime' && n === 0 ? 'hot' : hot === 'dfb' && n > 0 ? 'hot' : hot === 'delay' ? 'hot' : 'main');
    a *= fb;
    if (a < 0.02) break;
  }
  if (hot === 'dtime') p.p(arrow(tx(0), 100, tx(time), 100, 4), 'hot');
  p.label('L', X1, mid - 26, 'end').label('R', X1, mid + 32, 'end');
  p.label(`${BASS_DTIME_NAME(values)} = ${Math.round(time * 1000)} MS  FEEDBACK ${Math.round(fb * 100)} %`, X0, TOP);
  p.label('ONE BAR', X0, BOT);
  return valueOf(p, hot, values).done();
}
const BASS_DTIME_NAME = (values: BassValues): string => bassKnob('dtime').names?.[stepOf('dtime', values.dtime)] ?? '';

/** La REVERB : la queue (son enveloppe sur REV SIZE), ses aigus qui s'eteignent plus vite (REV TONE). */
function tail(values: BassValues, hot: 'reverb' | 'rsize' | 'rtone'): BassDiagram {
  const p = new Pic();
  const rt = rsizeS(values.rsize);
  const tone = rtoneHz(values.rtone);
  const span = Math.max(1, Math.min(8, rt * 1.25));
  const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
  const base = 96;
  const ay = (a: number): number => base - a * (base - 28);
  p.p(seg(X0, base, X1, base), 'grid');
  // Le corps : des reflexions de plus en plus denses sous l'enveloppe (-60 dB a REV SIZE)
  const env = (t: number): number => Math.pow(10, (-3 * t) / rt);
  const rnd = mulberry(7);
  let lines = '';
  for (let k = 0; k < 90; k += 1) {
    const t = 0.012 + (span - 0.012) * Math.pow(k / 90, 1.3);
    const a = env(t) * (0.35 + 0.65 * rnd()) * (hot === 'reverb' ? 0.3 + 0.7 * values.reverb : 1);
    lines += seg(tx(t), base, tx(t), ay(a));
  }
  p.p(lines, hot === 'rtone' ? 'ghost' : 'main');
  const pts: Pt[] = [];
  const hi: Pt[] = [];
  // Les aigus durent moins quand REV TONE est sombre
  const hiRt = rt * Math.min(1, tone / 12000) * 0.9 + 0.05;
  for (let k = 0; k <= 48; k += 1) {
    const t = (span * k) / 48;
    pts.push([tx(t), ay(env(t))]);
    hi.push([tx(t), ay(Math.pow(10, (-3 * t) / hiRt))]);
  }
  p.p(poly(pts), hot === 'rsize' || hot === 'reverb' ? 'hot' : 'dash');
  if (hot === 'rtone') p.p(poly(hi), 'hot');
  p.p(seg(tx(rt), 24, tx(rt), base), 'dash');
  p.label(`-60 DB AT ${rt.toFixed(1)} S`, Math.min(tx(rt) + 4, X1 - 70), 22);
  p.label(hot === 'rtone' ? `TREBLE ABOVE ${hzText(tone)} DIES FIRST` : `${span.toFixed(1)} S`, X0, BOT);
  return valueOf(p, hot, values).done();
}

/** Une touche de page : ses huit blocs, dans l'ordre des encodeurs. */
function pageGrid(page: BassPageId): BassDiagram {
  const p = new Pic();
  const ids = BASS_PAGE_SLOTS[page];
  const bw = (X1 - X0 - 18) / 4;
  const bh = 34;
  ids.forEach((id, k) => {
    const x = X0 + (k % 4) * (bw + 6);
    const y = 24 + (k < 4 ? 0 : bh + 8);
    p.p(rbox(x, y, bw, bh, 3), id ? 'main' : 'grid');
    p.label('ABCDEFGH'[k], x + bw - 4, y + 11, 'end');
    if (!id) return;
    // Un nom de deux mots sur deux lignes (2026-10-08, la revue : AMP DECAY debordait sur SUSTAIN)
    const words = bassKnob(id).label.split(' ');
    if (words.length > 1) {
      p.label(words[0], x + 4, y + bh - 17);
      p.label(words.slice(1).join(' '), x + 4, y + bh - 6);
    } else p.label(words[0], x + 4, y + bh - 7);
  });
  p.label('ENCODERS A TO H', X0, TOP);
  return p.done();
}

/** NOTE - + : un degre de la gamme, sur l'echelle de SCALE. */
function degreeMove(values: BassValues, dir: -1 | 1): BassDiagram {
  const p = new Pic();
  const sc = BASS_SCALES[stepOf('scale', values.scale)];
  const L = SCALE_TONES[sc].length;
  const ry = (d: number): number => Y1 - (d / L) * (Y1 - Y0);
  for (let d = 0; d <= L; d += 1) {
    p.p(seg(96, ry(d), 168, ry(d)), d === 0 || d === L ? 'main' : 'grid');
    p.label(String(d === L ? 1 : d + 1), 88, ry(d) + 3, 'end');
  }
  const from = Math.floor(L / 2);
  const to = from + dir;
  p.p(rbox(108, ry(from) - 3, 48, 6, 2), 'ghost', true);
  p.p(rbox(108, ry(to) - 3, 48, 6, 2), 'hot', true);
  p.p(arrow(180, ry(from), 180, ry(to) + (dir > 0 ? 3 : -3), 4), 'hot');
  p.label(sc, X0, TOP);
  p.label('DEGREES', X0, BOT);
  return p.done();
}

/** OCT - + : la meme note, une octave plus bas ou plus haut. */
function octaveMove(dir: -1 | 1): BassDiagram {
  const p = new Pic();
  const yLo = 84;
  const yHi = 36;
  p.p(seg(X0, yLo, X1, yLo), 'grid').p(seg(X0, yHi, X1, yHi), 'grid');
  p.p(rbox(70, (dir > 0 ? yLo : yHi) - 4, 50, 8, 3), 'ghost', true);
  p.p(rbox(130, (dir > 0 ? yHi : yLo) - 4, 50, 8, 3), 'hot', true);
  p.p(arrow(124, dir > 0 ? yLo - 6 : yHi + 6, 124, dir > 0 ? yHi + 8 : yLo - 8, 4), 'hot');
  p.label('+12', X1, yHi - 4, 'end');
  p.label('0', X1, yLo - 4, 'end');
  p.label('-1 TO +2 OCT', X0, TOP);
  return p.done();
}

const KNOB_IDS: ReadonlySet<string> = new Set(BASS_KNOBS.map((k) => k.id));

/**
 * Le dessin d'une commande (null : elle n'en a pas, l'ecran, INFOS, CLOSE).
 * Pour un potard, c.v (sa valeur, celle du verrou en LOCK) passe avant
 * c.values.
 */
export function bassDiagram(id: BassInfoId, c: BassDiagramCtx): BassDiagram | null {
  const fn = DRAW[id];
  if (!fn) return null;
  const values = KNOB_IDS.has(id) ? { ...c.values, [id]: Math.min(1, Math.max(0, c.v)) } : c.values;
  try {
    return fn(values, c);
  } catch {
    // Un dessin ne casse jamais la carte ni l'ecran
    return null;
  }
}
