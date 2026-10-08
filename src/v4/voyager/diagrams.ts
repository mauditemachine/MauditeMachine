/**
 * Les dessins du MM-ARP (2026-10-08, Mika : "je veux le meme type d'ecran
 * pour ARP aussi, plus gros, plus de detail" et "excellent pour le bouton
 * INFO ! je veux la meme chose") : une petite image vectorielle par
 * commande, calculee avec les vraies lois du synthe (params.ts, le worklet
 * audio/moog.worklet.js, les effets audio/synth.ts, l'arpegiateur arp.ts),
 * dans une boite de 240 x 120, le meme format que les dessins du MM-BASS
 * (bass/diagrams.ts) : la carte INFOS (voyager/InfosCard.tsx) en fait du
 * SVG, le grand ecran (voyager/screen.ts) les trace avec Path2D, os sur
 * noir, quand on tourne un potard (l'echo).
 * Fonctions pures, sans DOM. Les roles des traits :
 * - main : le trait principal ;
 * - hot : ce que la commande change (orange sur la carte, os plein a
 *   l'ecran) ;
 * - ghost : les reperes (la forme voisine, la courbe sans le reglage) ;
 * - grid : la grille ; dash : un repere en pointille.
 * Les textes : label (petit, gris), value (la valeur lue ; l'ecran l'ecrit
 * deja en grand et ne la reprend pas).
 */

import { ACCENT_DEPTHS, arpPreview } from './preview';
import { CHORDS, chordNotes, voicedDegrees, degreeMidi } from './chords';
import {
  CHORD_TYPES,
  FMODES,
  LFO_DESTS,
  OCTAVES,
  OSC_RANGES,
  SEMIS,
  WAVES1,
  WAVES2,
  attackS,
  chordType,
  cutoffHz,
  decayS,
  duckDepthDb,
  envOctaves,
  fineCents,
  fmRatio,
  gateFrac,
  glideS,
  monoLowHz,
  morphPos,
  phaseStart,
  releaseS,
  stepIndex,
  stepsPerNote,
  type VoyKnobId,
  type VoyValues,
} from './params';

export interface VoyDiagram {
  w: number;
  h: number;
  paths: { d: string; role: 'main' | 'ghost' | 'hot' | 'grid' | 'dash'; fill?: boolean }[];
  texts: { text: string; x: number; y: number; role: 'label' | 'value'; anchor?: 'start' | 'middle' | 'end' }[];
}

/** Les commandes qui ont leur carte : chaque potard (face et TWEAKS), les pads, les touches, l'ecran et sa touche i. */
export type VoyInfoId = VoyKnobId | 'pad' | 'run' | 'clear' | 'random' | 'edit' | 'open' | 'screen' | 'presets' | 'seq' | 'infos';

/** Ce que lit un dessin : la valeur de la commande (0 a 1), toutes les valeurs, le tempo, l'accord regarde. */
export interface VoyDiagramCtx {
  v: number;
  values: Readonly<VoyValues>;
  bpm: number;
  /** l'accord du pad (0 a 7), ou celui qui joue */
  chord?: number;
}

type Role = VoyDiagram['paths'][number]['role'];
type Anchor = 'start' | 'middle' | 'end';
type Pt = readonly [number, number];

const W = 240;
const H = 120;
const X0 = 12;
const X1 = 228;
const Y0 = 20;
const Y1 = 100;
const MID = (Y0 + Y1) / 2;
const TOP = 12;
const BOT = 114;

const n1 = (x: number): string => String(Math.round(x * 10) / 10);
const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** Le dessin en cours : des traits regroupes par role (un chemin par role et par remplissage). */
class Pic {
  private parts = new Map<string, string[]>();
  private order: string[] = [];
  readonly texts: VoyDiagram['texts'] = [];

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

  done(): VoyDiagram {
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
function tip(x0: number, y0: number, x1: number, y1: number, size = 5): string {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const l = (s: number): string => seg(x1, y1, x1 - size * Math.cos(a + s), y1 - size * Math.sin(a + s));
  return l(0.5) + l(-0.5);
}
const arrow = (x0: number, y0: number, x1: number, y1: number, size = 5): string => seg(x0, y0, x1, y1) + tip(x0, y0, x1, y1, size);
/** Une courbe echantillonnee : f(t) pour t de 0 a 1, posee de x0 a x1. */
function curve(f: (t: number) => number, x0 = X0, x1 = X1, n = 120): string {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    pts.push([x0 + (x1 - x0) * t, f(t)]);
  }
  return poly(pts);
}
/** La ligne de base horizontale (le zero). */
const axis = (y = MID): string => seg(X0, y, X1, y);

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

const msText = (s: number): string => (s >= 1 ? `${s.toFixed(s >= 10 ? 0 : 2)} S` : `${Math.round(s * 1000)} MS`);
export const hzText = (hz: number): string => (hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)} KHZ` : `${Math.round(hz)} HZ`);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const midiName = (m: number): string => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

/* ---------------- les oscillateurs (les formes du worklet, sans l'anti-repliement) ---------------- */

/** Une forme a la phase ph (0 a 1) : 0 sinus, 1 triangle, 2 dent de scie, 3 carre, 4 impulsion de 14 %, 5 FM. */
function shapeAt(w: number, ph: number): number {
  switch (w) {
    case 0:
      return Math.sin(2 * Math.PI * ph);
    case 1: {
      let q = ph + 0.25;
      if (q >= 1) q -= 1;
      return 1 - 4 * Math.abs(q - 0.5);
    }
    case 2:
      return 1 - 2 * ph;
    case 3:
      return ph < 0.5 ? 1 : -1;
    case 4:
      return (ph < 0.14 ? 1 : -1) + 0.72;
    default:
      // FM : la sinusoide d'OSC 1 dont OSC 2 (une octave dessous, son accord de depart) decale la phase
      return Math.sin(2 * Math.PI * (ph + 1.6 * 0.16 * Math.sin(2 * Math.PI * ph * 0.5)));
  }
}

/** Le morphing a la position pos (0 a n-1) : le fondu lineaire du worklet entre deux formes voisines. */
const morphAt = (pos: number, ph: number, last: number): number => {
  const i = Math.min(last - 1, Math.floor(pos));
  const f = pos - i;
  return (1 - f) * shapeAt(i, ph) + f * shapeAt(Math.min(last, i + 1), ph);
};

function waveDiagram(id: 'wave1' | 'wave2', v: number): VoyDiagram {
  const p = new Pic();
  const names = id === 'wave1' ? WAVES1 : WAVES2;
  const last = names.length - 1;
  const pos = morphPos(id, v);
  const amp = 30;
  const cyc = 2;
  p.p(axis(), 'grid');
  const a = Math.floor(Math.min(pos, last - 0.0001));
  // Les deux formes du fondu en fantome, le melange en plein
  for (const k of [a, Math.min(last, a + 1)]) p.p(curve((t) => MID - amp * 0.92 * shapeAt(k, (t * cyc) % 1)), 'ghost');
  p.p(curve((t) => MID - amp * clamp(morphAt(pos, (t * cyc) % 1, last), -1.5, 1.5), X0, X1, 240), 'hot');
  p.label(names[a], X0, BOT).label(names[Math.min(last, a + 1)], X1, BOT, 'end');
  return p.done();
}

/* ---------------- accords, hauteurs ---------------- */

/** Une rangee de crans (RANGE, SEMI...) : un repere par cran, le cran choisi en plein, un arc depuis le repere neutre. */
function detents(labels: readonly string[], idx: number, neutral: number, every = 1): VoyDiagram {
  const p = new Pic();
  const n = labels.length;
  const x = (i: number): number => X0 + 8 + ((X1 - X0 - 16) * i) / Math.max(1, n - 1);
  const yb = 84;
  p.p(seg(x(0), yb, x(n - 1), yb), 'grid');
  labels.forEach((l, i) => {
    const on = i === idx;
    const h = i === neutral ? 16 : 10;
    p.p(seg(x(i), yb, x(i), yb - h), on ? 'hot' : 'ghost');
    if (on) p.p(dot(x(i), yb - h - 6, 4), 'hot', true);
    if (i % every === 0 || on || i === neutral) p.label(l, x(i), BOT - 6, 'middle');
  });
  if (idx !== neutral) {
    const x0 = x(neutral);
    const x1 = x(idx);
    const top = 34;
    p.p(`M${n1(x0)} ${yb - 22}C${n1(x0)} ${top} ${n1(x1)} ${top} ${n1(x1)} ${yb - 22}`, 'dash');
  }
  return p.done();
}

/**
 * FINE : les deux oscillateurs desaccordes, sommes (ce qu'on entend) : le
 * battement, l'enveloppe en pointille, plus rapide quand l'ecart grandit.
 */
function fineDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const c = fineCents(v);
  const cyc = 12;
  const beat = Math.abs(c) < 1 ? 0 : 0.5 + (Math.abs(c) / 50) * 3;
  const env = (t: number): number => (beat === 0 ? 1 : Math.abs(Math.cos(Math.PI * t * beat)));
  p.p(axis(), 'grid');
  p.p(curve((t) => MID - 32 * env(t) * Math.sin(2 * Math.PI * t * cyc), X0, X1, 360), 'hot');
  if (beat > 0) {
    p.p(curve((t) => MID - 34 * env(t)), 'dash');
    p.p(curve((t) => MID + 34 * env(t)), 'dash');
  }
  p.label('-50', X0, BOT).label('0', (X0 + X1) / 2, BOT, 'middle').label('+50', X1, BOT, 'end');
  p.p(dot(X0 + ((c + 50) / 100) * (X1 - X0), BOT - 12, 3.5), 'hot', true);
  return p.done();
}

/** ON : la forme qui sonne, ou le trait plat. */
function onDiagram(on: boolean): VoyDiagram {
  const p = new Pic();
  p.p(axis(), 'grid');
  if (on) p.p(curve((t) => MID - 28 * shapeAt(2, (t * 3) % 1), X0, X1, 240), 'hot');
  else {
    p.p(curve((t) => MID - 28 * shapeAt(2, (t * 3) % 1), X0, X1, 240), 'ghost');
    p.p(axis(), 'hot');
  }
  p.label(on ? 'ON' : 'OFF', X1, BOT, 'end');
  return p.done();
}

/** Le melangeur : OSC 1, OSC 2, NOISE en faders ; celui qu'on touche en plein. */
function mixerDiagram(id: VoyKnobId, values: Readonly<VoyValues>): VoyDiagram {
  const p = new Pic();
  const ids: VoyKnobId[] = ['osc1', 'osc2', 'noise'];
  const names = ['OSC 1', 'OSC 2', 'NOISE'];
  const xs = [70, 120, 170];
  ids.forEach((k, i) => {
    const x = xs[i];
    const v = values[k];
    p.p(seg(x, Y0, x, Y1 - 4), 'grid');
    const y = Y1 - 4 - v * (Y1 - Y0 - 4);
    p.p(rbox(x - 4, y, 8, Y1 - 4 - y, 2), k === id ? 'hot' : 'ghost', true);
    p.p(rbox(x - 10, y - 3, 20, 6, 2), k === id ? 'hot' : 'main', true);
    p.label(names[i], x, BOT, 'middle');
  });
  return p.done();
}

/** Un niveau en dB (VOLUME, les gains) : la barre et sa graduation. */
function meterDiagram(v: number, db: number, ticks: readonly number[]): VoyDiagram {
  const p = new Pic();
  const y = 64;
  const toX = (d: number): number => X0 + ((clamp(d, -48, 0) + 48) / 48) * (X1 - X0);
  p.p(rbox(X0, y - 7, X1 - X0, 14, 3), 'grid');
  if (v > 0) p.p(rbox(X0, y - 7, toX(db) - X0, 14, 3), 'hot', true);
  for (const t of ticks) {
    p.p(seg(toX(t), y + 10, toX(t), y + 16), 'ghost');
    p.label(`${t}`, toX(t), BOT - 4, 'middle');
  }
  p.label('DB', X0, 40);
  return p.done();
}

/** NOISE : un bruit blanc, son niveau (au carre du potard) par-dessus la forme d'onde. */
function noiseDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const rnd = mulberry(7);
  p.p(axis(), 'grid');
  p.p(curve((t) => MID - 24 * shapeAt(2, (t * 3) % 1), X0, X1, 200), 'ghost');
  const amp = 34 * v * v;
  const pts: Pt[] = [];
  for (let i = 0; i <= 160; i += 1) pts.push([X0 + ((X1 - X0) * i) / 160, MID - 24 * shapeAt(2, ((i / 160) * 3) % 1) + (rnd() * 2 - 1) * amp]);
  p.p(poly(pts), 'hot');
  return p.done();
}

/** FM : la sinusoide modulee par l'operateur a son RATIO ; l'indice monte au carre du potard (FM_MAX 6). */
function fmDiagram(v: number, values: Readonly<VoyValues>): VoyDiagram {
  const p = new Pic();
  const ratio = fmRatio(values.ratio);
  const index = 6 * v * v;
  p.p(axis(), 'grid');
  p.p(curve((t) => MID - 28 * Math.sin(2 * Math.PI * t * 2), X0, X1, 200), 'ghost');
  p.p(curve((t) => MID - 28 * Math.sin(2 * Math.PI * t * 2 + index * Math.sin(2 * Math.PI * t * 2 * ratio)), X0, X1, 360), 'hot');
  p.label(`INDEX ${index.toFixed(1)}`, X0, BOT).label(`RATIO ${values.ratio !== undefined ? ratioText(values.ratio) : ''}`, X1, BOT, 'end');
  return p.done();
}
const ratioText = (v: number): string => ['1/2', '1', '3/2', '2', '3', '7/2', '4', '5', '7'][stepIndex('ratio', v)];

/** RATIO : l'operateur (en plein) contre OSC 1 (en fantome), sur deux cycles d'OSC 1. */
function ratioDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const r = fmRatio(v);
  p.p(axis(), 'grid');
  p.p(curve((t) => MID - 30 * Math.sin(2 * Math.PI * t * 2), X0, X1, 200), 'ghost');
  p.p(curve((t) => MID - 18 * Math.sin(2 * Math.PI * t * 2 * r), X0, X1, 360), 'hot');
  p.label('OSC 1', X0, BOT).label(`OPERATOR x ${ratioText(v)}`, X1, BOT, 'end');
  return p.done();
}

/** GLIDE : deux notes, la hauteur qui glisse de l'une a l'autre en glideS (deux pas a ce tempo). */
function glideDiagram(v: number, bpm: number): VoyDiagram {
  const p = new Pic();
  const step = 60 / Math.max(40, bpm || 120) / 4;
  const span = 2 * step;
  const g = glideS(v);
  const ya = 74;
  const yb = 38;
  const xm = (X0 + X1) / 2;
  p.p(seg(xm, Y0, xm, Y1), 'grid');
  p.p(seg(X0, ya, xm, ya) + seg(xm, ya, xm, yb) + seg(xm, yb, X1, yb), 'ghost');
  const frac = clamp(g / span, 0, 0.98);
  const xe = xm + frac * (X1 - xm);
  // La glissade du worklet : en hauteur logarithmique, une approche exponentielle
  p.p(seg(X0, ya, xm, ya) + (frac > 0 ? curve((t) => ya + (yb - ya) * (1 - Math.exp(-4 * t)) / (1 - Math.exp(-4)), xm, xe, 40) : seg(xm, ya, xm, yb)) + seg(xe, yb, X1, yb), 'hot');
  p.label(g > 0 ? msText(g) : 'OFF', X1, BOT, 'end').label('NOTE 1', X0, ya + 14).label('NOTE 2', X1, yb - 8, 'end');
  return p.done();
}

/* ---------------- le filtre (les sorties de l'echelle melangees, comme le worklet) ---------------- */

/** |H| du mode m a la frequence f (coupure fc, resonance res) : l'echelle a quatre etages et sa retroaction k = 4.1 res. */
function filterMag(m: number, f: number, fc: number, res: number): number {
  const k = res * 4.1;
  // s = j w : (1 + s)^n en complexe
  const w = f / fc;
  const mul = (a: [number, number], b: [number, number]): [number, number] => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a: [number, number], b: [number, number]): [number, number] => {
    const d = b[0] * b[0] + b[1] * b[1];
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  };
  const one: [number, number] = [1, w];
  const p2 = mul(one, one);
  const p4 = mul(p2, p2);
  // u = x / (1 + k / (1+s)^4) ; y1 = u / (1+s) ; y2 = u / (1+s)^2 ; y4 = u / (1+s)^4
  const kk = div([k, 0], p4);
  const u = div([1, 0], [1 + kk[0], kk[1]]);
  const y1 = div(u, one);
  const y2 = div(u, p2);
  const y4 = div(u, p4);
  let o: [number, number];
  // Les gains du worklet : la resonance de LP 12 ramenee, BP et HP au niveau du passe-bas
  if (m === 0) o = [y4[0] * (1 + k * 0.5), y4[1] * (1 + k * 0.5)];
  else if (m === 1) o = [y2[0] * (1 + k * 0.12), y2[1] * (1 + k * 0.12)];
  else if (m === 2) o = [2 * (y1[0] - y2[0]) * 1.25, 2 * (y1[1] - y2[1]) * 1.25];
  else o = [(u[0] - 2 * y1[0] + y2[0]) * 1.7 * 0.6, (u[1] - 2 * y1[1] + y2[1]) * 1.7 * 0.6];
  return Math.hypot(o[0], o[1]);
}

const F_LO = 30;
const F_HI = 19000;
const fx = (f: number): number => X0 + ((Math.log2(f) - Math.log2(F_LO)) / (Math.log2(F_HI) - Math.log2(F_LO))) * (X1 - X0);
const dbY = (db: number): number => Y0 + 26 - (clamp(db, -42, 18) / 60) * 74 * 1.0;

function filterCurve(m: number, fc: number, res: number): string {
  return curve((t) => {
    const f = F_LO * Math.pow(F_HI / F_LO, t);
    return clamp(dbY(20 * Math.log10(Math.max(1e-4, filterMag(m, f, fc, res)))), Y0 - 6, Y1 + 4);
  }, X0, X1, 140);
}

function filterDiagram(id: VoyKnobId, values: Readonly<VoyValues>): VoyDiagram {
  const p = new Pic();
  const m = stepIndex('fmode', values.fmode);
  const fc = cutoffHz(values.cutoff);
  for (const f of [100, 1000, 10000]) {
    p.p(seg(fx(f), Y0, fx(f), Y1), 'grid');
    p.label(f >= 1000 ? `${f / 1000}K` : `${f}`, fx(f), BOT, 'middle');
  }
  p.p(seg(X0, dbY(0), X1, dbY(0)), 'grid');
  if (id === 'envAmt') {
    // ENV AMT : la coupure montee par l'enveloppe (jusqu'a 6 octaves), la fleche entre les deux
    const peak = Math.min(F_HI, fc * Math.pow(2, envOctaves(values.envAmt)));
    p.p(filterCurve(m, fc, values.res), 'ghost');
    p.p(filterCurve(m, peak, values.res), 'hot');
    if (peak > fc * 1.05) p.p(arrow(fx(fc), 30, fx(peak), 30, 5), 'dash');
    p.label(`+${envOctaves(values.envAmt).toFixed(1)} OCT`, X1, TOP + 4, 'end');
  } else if (id === 'fmode') {
    FMODES.forEach((_, k) => {
      if (k !== m) p.p(filterCurve(k, fc, values.res), 'ghost');
    });
    p.p(filterCurve(m, fc, values.res), 'hot');
    p.label(['MOOG 24 DB', 'LOW PASS 12', 'BAND PASS', 'HIGH PASS'][m], X1, TOP + 4, 'end');
  } else {
    if (id === 'res') p.p(filterCurve(m, fc, 0), 'ghost');
    else p.p(filterCurve(m, cutoffHz(0.5), values.res), 'ghost');
    p.p(filterCurve(m, fc, values.res), 'hot');
    p.p(seg(fx(fc), Y1 - 6, fx(fc), Y1), 'hot');
    p.label(hzText(fc), clamp(fx(fc), X0 + 20, X1 - 20), TOP + 4, 'middle');
  }
  return p.done();
}

/* ---------------- les enveloppes ---------------- */

function adsrDiagram(id: VoyKnobId, values: Readonly<VoyValues>): VoyDiagram {
  const p = new Pic();
  const amp = id.startsWith('a');
  const pre = amp ? 'a' : 'f';
  const A = attackS(values[`${pre}A` as VoyKnobId]);
  const D = decayS(values[`${pre}D` as VoyKnobId]);
  const S = values[`${pre}S` as VoyKnobId];
  const R = releaseS(values[`${pre}R` as VoyKnobId]);
  // Le temps en racine carree : 1 ms et 2 s se voient sur la meme image
  const tq = (s: number): number => Math.sqrt(Math.max(0, s));
  const hold = 0.35;
  const total = tq(A) + tq(D) + tq(hold) + tq(R);
  const k = (X1 - X0) / Math.max(0.5, total);
  const x1 = X0 + tq(A) * k;
  const x2 = x1 + tq(D) * k;
  const x3 = x2 + tq(hold) * k;
  const x4 = x3 + tq(R) * k;
  const yTop = Y0 + 4;
  const yBot = Y1;
  const yS = yBot - S * (yBot - yTop);
  p.p(seg(X0, yBot, X1, yBot), 'grid');
  for (const x of [x1, x2, x3]) p.p(seg(x, Y0, x, yBot), 'grid');
  const attack = seg(X0, yBot, x1, yTop);
  const decay = curve((t) => yS - (yS - yTop) * Math.exp(-4 * t), x1, x2, 40);
  const sustain = seg(x2, yS, x3, yS);
  const release = curve((t) => yBot - (yBot - yS) * Math.exp(-4 * t), x3, x4, 40);
  const segs: [VoyKnobId, string][] = [
    [`${pre}A` as VoyKnobId, attack],
    [`${pre}D` as VoyKnobId, decay],
    [`${pre}S` as VoyKnobId, sustain],
    [`${pre}R` as VoyKnobId, release],
  ];
  for (const [k2, d] of segs) p.p(d, k2 === id ? 'hot' : 'main');
  p.label('A', (X0 + x1) / 2, BOT, 'middle').label('D', (x1 + x2) / 2, BOT, 'middle').label('S', (x2 + x3) / 2, BOT, 'middle').label('R', (x3 + x4) / 2, BOT, 'middle');
  p.label(amp ? 'LEVEL' : 'CUTOFF', X0, TOP);
  return p.done();
}

/* ---------------- MOD (le LFO cale sur le tempo) ---------------- */

function lfoDiagram(id: VoyKnobId, values: Readonly<VoyValues>): VoyDiagram {
  const p = new Pic();
  const beats = [0.25, 0.5, 1, 2, 4, 8, 16][stepIndex('lfoRate', values.lfoRate)];
  const shape = stepIndex('lfoShape', values.lfoShape);
  // La fenetre : une mesure, deux pour les cycles lents (au moins un cycle et demi visible)
  const window = beats > 4 ? Math.min(32, beats * 1.5) : 4;
  const cycles = window / beats;
  const amp = 34 * (id === 'lfoAmt' ? Math.max(0.04, values.lfoAmt) : Math.max(0.35, values.lfoAmt));
  for (let b = 0; b <= window; b += window > 8 ? 4 : 1) {
    const x = X0 + ((X1 - X0) * b) / window;
    p.p(seg(x, Y0, x, Y1), b % 4 === 0 ? 'ghost' : 'grid');
  }
  p.p(axis(), 'grid');
  const rnd = mulberry(11);
  const holds = Array.from({ length: Math.ceil(cycles) + 1 }, () => rnd() * 2 - 1);
  const f = (t: number): number => {
    const c = t * cycles;
    const ph = c - Math.floor(c);
    const raw = shape === 1 ? 1 - 2 * ph : shape === 2 ? (ph < 0.5 ? 1 : -1) : shape === 3 ? holds[Math.floor(c)] : 1 - 4 * Math.abs(ph - 0.5);
    return MID - amp * raw;
  };
  if (id === 'lfoAmt') p.p(curve((t) => MID - 34 * (f(t) - MID) / -amp * -1, X0, X1, 300), 'ghost');
  p.p(curve(f, X0, X1, 400), 'hot');
  p.label(window > 8 ? `${window / 4} BARS` : '1 BAR', X0, BOT).label(`> ${LFO_DESTS[stepIndex('lfoDest', values.lfoDest)]}`, X1, BOT, 'end');
  return p.done();
}

/* ---------------- effets ---------------- */

function driveDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const cx = (X0 + X1) / 2;
  const half = 40;
  p.p(seg(cx - 60, MID, cx + 60, MID) + seg(cx, MID - half, cx, MID + half), 'grid');
  p.p(seg(cx - half, MID + half, cx + half, MID - half), 'ghost');
  // La courbe de l'overdrive : tanh plus forte avec le potard (gain 1 + 2.5 v a l'entree du filtre, la sortie en 1 + 1.5 v)
  const g = 1 + 6 * v * v;
  p.p(curve((t) => {
    const x = t * 2 - 1;
    return MID - half * (Math.tanh(g * x + 0.18 * v) - Math.tanh(0.18 * v)) / Math.tanh(g);
  }, cx - half, cx + half, 80), 'hot');
  p.label('IN', cx + half + 8, MID + 4).label('OUT', cx + 4, Y0 - 2);
  return p.done();
}

function chorusDiagram(v: number): VoyDiagram {
  const p = new Pic();
  p.p(axis(), 'grid');
  p.p(curve((t) => MID - 26 * Math.sin(2 * Math.PI * t * 3), X0, X1, 240), 'ghost');
  // Facon Juno : deux copies retardees, leur retard qui ondule (la quantite suit le potard)
  p.p(curve((t) => MID - 26 * Math.sin(2 * Math.PI * (t * 3 - v * 0.18 * (1 + Math.sin(2 * Math.PI * t)))), X0, X1, 240), 'hot');
  p.p(curve((t) => MID - 26 * Math.sin(2 * Math.PI * (t * 3 + v * 0.18 * (1 + Math.sin(2 * Math.PI * t + Math.PI)))), X0, X1, 240), 'main');
  p.label('L', X0, BOT).label('R', X1, BOT, 'end');
  return p.done();
}

/** DELAY : le ping-pong en croche pointee (trois doubles croches), gauche puis droite, la reinjection 0.35 a 0.68. */
function delayDiagram(v: number, bpm: number): VoyDiagram {
  const p = new Pic();
  const fb = 0.35 + 0.33 * v;
  const steps = 16;
  const dx = (X1 - X0) / steps;
  p.p(axis(), 'grid');
  for (let i = 0; i <= steps; i += 4) p.p(seg(X0 + i * dx, Y0, X0 + i * dx, Y1), 'grid');
  p.p(seg(X0 + 2, MID, X0 + 2, MID - 38), 'main');
  // L'envoi (le potard) et la reinjection : la premiere repetition a 35 % de la note au moins, pour qu'on la voie
  let a = 0.35 + 0.65 * v;
  for (let k = 1; X0 + 2 + k * 3 * dx <= X1; k += 1) {
    const x = X0 + 2 + k * 3 * dx;
    const h = 38 * a;
    p.p(seg(x, MID, x, k % 2 ? MID - h : MID + h), 'hot');
    a *= fb;
  }
  p.label('L', X0, Y0 - 4).label('R', X0, Y1 + 10).label(`3/16 ${Math.round(60 / Math.max(40, bpm || 120) / 4 * 3 * 1000)} MS`, X1, BOT, 'end');
  return p.done();
}

function reverbDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const rnd = mulberry(5);
  const tail = 0.25 + 0.75 * v;
  p.p(seg(X0, Y1, X1, Y1), 'grid');
  p.p(seg(X0 + 2, Y1, X0 + 2, Y0), 'main');
  let d = '';
  for (let i = 0; i < 90; i += 1) {
    const t = (i + 1) / 90;
    const x = X0 + 6 + t * (X1 - X0 - 8);
    const env = Math.exp(-t / (0.18 * tail));
    const h = (Y1 - Y0 - 8) * v * env * (0.45 + 0.55 * rnd());
    d += seg(x, Y1, x, Y1 - h);
  }
  p.p(d, 'hot');
  p.p(curve((t) => Y1 - (Y1 - Y0 - 8) * Math.max(0.02, v) * Math.exp(-t / (0.18 * tail)), X0 + 6, X1, 60), 'dash');
  p.label('SEND', X1, TOP, 'end');
  return p.done();
}

/* ---------------- l'arpegiateur ---------------- */

/** RATE : une mesure, une note par division (1/4 a 1/32), les temps marques. */
function rateDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const spn = stepsPerNote(v);
  const per = 16 / spn;
  const dx = (X1 - X0) / per;
  for (let b = 0; b <= 4; b += 1) p.p(seg(X0 + (b * (X1 - X0)) / 4, Y0, X0 + (b * (X1 - X0)) / 4, Y1), 'grid');
  let d = '';
  for (let i = 0; i < per; i += 1) d += rbox(X0 + i * dx + 1, 48, Math.max(1.5, dx * 0.55), 24, 1.5);
  p.p(d, 'hot', true);
  p.label('1', X0 + 3, BOT).label('2', X0 + (X1 - X0) / 4 + 3, BOT).label('3', X0 + (X1 - X0) / 2 + 3, BOT).label('4', X0 + (3 * (X1 - X0)) / 4 + 3, BOT);
  p.label(`${per} NOTES / BAR`, X1, TOP, 'end');
  return p.done();
}

/** Le motif d'un accord, en points relies (MODE, RANGE, NOTES), depuis l'apercu de l'arpege (voyager/preview.ts). */
function contourDiagram(id: VoyKnobId, values: Readonly<VoyValues>, chord: number): VoyDiagram {
  const p = new Pic();
  const pv = arpPreview(chord, values);
  const notes = pv.notes.filter((n) => n.midi !== null) as { pos: number; midi: number }[];
  const lo = notes.length ? Math.min(...notes.map((n) => n.midi)) : 54;
  const hi = notes.length ? Math.max(...notes.map((n) => n.midi)) : 66;
  const n = Math.max(1, pv.notes.length);
  const x = (i: number): number => X0 + 6 + ((X1 - X0 - 12) * (i + 0.5)) / n;
  const y = (m: number): number => Y1 - 6 - ((m - lo) / Math.max(1, hi - lo)) * (Y1 - Y0 - 12);
  // Les octaves : un filet a chaque racine
  for (let m = lo; m <= hi; m += 1) if (((m - (54 + (CHORDS[chord]?.root ?? 0))) % 12 + 12) % 12 === 0) p.p(seg(X0, y(m), X1, y(m)), 'grid');
  const pts = pv.notes.map((nn, i) => (nn.midi === null ? null : ([x(i), y(nn.midi)] as Pt))).filter((q): q is Pt => q !== null);
  if (pts.length > 1 && !pv.random) p.p(poly(pts), id === 'mode' ? 'hot' : 'ghost');
  let dots = '';
  for (const q of pts) dots += dot(q[0], q[1], 3.2);
  p.p(dots, id === 'mode' ? 'main' : 'hot', true);
  if (pv.random) p.label('RANDOM EACH STEP', X0, TOP);
  p.label(`${pv.notes.length} NOTES`, X1, TOP, 'end').label(midiName(lo), X0, BOT).label(midiName(hi), X1, BOT, 'end');
  return p.done();
}

/** GATE : quatre notes, la duree de chacune en part de l'intervalle (8 % a 100 %). */
function gateDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const g = gateFrac(v);
  const n = 4;
  const dx = (X1 - X0) / n;
  for (let i = 0; i <= n; i += 1) p.p(seg(X0 + i * dx, Y0, X0 + i * dx, Y1), 'grid');
  let d = '';
  let gh = '';
  for (let i = 0; i < n; i += 1) {
    gh += rbox(X0 + i * dx + 2, 48, dx - 4, 24, 3);
    d += rbox(X0 + i * dx + 2, 48, Math.max(3, (dx - 4) * g), 24, 3);
  }
  p.p(gh, 'grid');
  p.p(d, 'hot', true);
  p.label(`${Math.round(g * 100)} % OF THE STEP`, X1, TOP, 'end');
  return p.done();
}

/** OCTAVE : cinq rangs (-2 a +2), l'accord pose sur celui qu'on a choisi. */
function octaveDiagram(v: number, chord: number): VoyDiagram {
  const p = new Pic();
  const idx = stepIndex('octave', v);
  const rows = OCTAVES.length;
  const y = (i: number): number => Y1 - 4 - ((Y1 - Y0 - 8) * i) / (rows - 1);
  OCTAVES.forEach((l, i) => {
    p.p(seg(X0 + 26, y(i), X1, y(i)), i === idx ? 'main' : 'grid');
    p.label(l, X0, y(i) + 3);
  });
  const base = chordNotes(chord);
  let d = '';
  base.forEach((_, k) => {
    d += rbox(X0 + 44 + k * 40, y(idx) - 5, 30, 10, 3);
  });
  p.p(d, 'hot', true);
  p.label(midiName((base[0] ?? 54) + 12 * (idx - 2)), X1, TOP, 'end');
  return p.done();
}

/* ---------------- TWEAKS (sous le capot) ---------------- */

function phaseDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const cx = 70;
  const cy = MID;
  const r = 34;
  p.p(dot(cx, cy, r), 'grid');
  const ph = phaseStart(v);
  if (ph < 0) {
    // FREE : chaque note part d'une phase au hasard
    const rnd = mulberry(3);
    let d = '';
    for (let i = 0; i < 9; i += 1) {
      const a = rnd() * Math.PI * 2;
      d += dot(cx + Math.cos(a) * r, cy - Math.sin(a) * r, 2.6);
    }
    p.p(d, 'ghost', true);
    p.label('FREE', 130, MID + 4);
  } else {
    const a = ph * Math.PI * 2;
    p.p(seg(cx, cy, cx + Math.cos(a) * r, cy - Math.sin(a) * r), 'hot');
    p.p(dot(cx + Math.cos(a) * r, cy - Math.sin(a) * r, 4), 'hot', true);
    p.p(curve((t) => MID - 26 * Math.sin(2 * Math.PI * (t * 1.5 + ph)), 120, X1, 80), 'hot');
    p.label(`${Math.round(ph * 360)} DEG`, X1, TOP, 'end');
  }
  return p.done();
}

function driftDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const rnd = mulberry(9);
  p.p(axis(), 'grid');
  const pts: Pt[] = [];
  let d = 0;
  let s = 0;
  for (let i = 0; i <= 120; i += 1) {
    // Une derive lente (bruit filtre deux fois), comme celle des oscillateurs du worklet
    d = d * 0.96 + (rnd() - 0.5) * 0.9;
    s += (d - s) * 0.25;
    pts.push([X0 + ((X1 - X0) * i) / 120, MID - s * 14 * v]);
  }
  p.p(poly(pts), 'hot');
  p.label('PITCH', X0, TOP).label(v < 0.02 ? 'STABLE' : 'ANALOG', X1, TOP, 'end');
  return p.done();
}

function widthDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const cx = (X0 + X1) / 2;
  p.p(seg(X0, MID, X1, MID) + seg(cx, Y0, cx, Y1), 'grid');
  const rnd = mulberry(4);
  let d = '';
  for (let i = 0; i < 12; i += 1) {
    const s = (rnd() * 2 - 1) * v;
    d += dot(cx + s * 96, Y0 + 10 + i * 6, 3);
  }
  p.p(d, 'hot', true);
  p.label('L', X0, BOT).label('R', X1, BOT, 'end');
  return p.done();
}

function monoDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const hz = monoLowHz(v);
  p.p(seg(X0, MID, X1, MID), 'grid');
  for (const f of [100, 1000, 10000]) p.label(f >= 1000 ? `${f / 1000}K` : `${f}`, fx(f), BOT, 'middle');
  if (hz <= 0) {
    p.p(rbox(X0, MID - 16, X1 - X0, 32, 4), 'ghost');
    p.label('ALL STEREO', (X0 + X1) / 2, MID + 4, 'middle');
  } else {
    const x = fx(hz);
    p.p(rbox(X0, MID - 6, x - X0, 12, 3), 'hot', true);
    p.p(rbox(x + 2, MID - 18, X1 - x - 2, 36, 4), 'main');
    p.label('MONO', X0, MID - 12).label('STEREO + FX', X1 - 4, MID + 4, 'end');
  }
  return p.done();
}

function keyTrackDiagram(v: number): VoyDiagram {
  const p = new Pic();
  p.p(seg(X0, Y1, X1, Y1) + seg(X0, Y0, X0, Y1), 'grid');
  p.p(seg(X0, MID, X1, MID), 'ghost');
  p.p(seg(X0, MID + 40 * v, X1, MID - 40 * v), 'hot');
  p.label('NOTE', X1, BOT, 'end').label('CUTOFF', X0 + 4, TOP);
  return p.done();
}

function accentDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const dx = (X1 - X0) / 16;
  let d = '';
  for (let i = 0; i < 16; i += 1) {
    const a = Math.max(0.3, 1 + (ACCENT_DEPTHS[i % 4] - 1) * 2 * v);
    const h = 44 * a;
    d += rbox(X0 + i * dx + 2, Y1 - h, dx - 4, h, 2);
  }
  p.p(d, 'hot', true);
  for (let b = 0; b <= 4; b += 1) p.p(seg(X0 + b * 4 * dx, Y0, X0 + b * 4 * dx, Y1), 'grid');
  p.label('1  E  &  A', X0, TOP);
  return p.done();
}

function syncDiagram(on: boolean, values: Readonly<VoyValues>): VoyDiagram {
  const p = new Pic();
  p.p(axis(), 'grid');
  const r = Math.max(1.2, Math.pow(2, (stepIndex('range2', values.range2) - stepIndex('range1', values.range1) + (stepIndex('semi2', values.semi2) - stepIndex('semi1', values.semi1)) / 12)));
  const cyc = 2;
  p.p(curve((t) => MID - 30 * shapeAt(2, (t * cyc) % 1), X0, X1, 200), 'ghost');
  p.p(curve((t) => {
    const ph = on ? ((t * cyc) % 1) * r % 1 : (t * cyc * r) % 1;
    return MID - 30 * shapeAt(2, ph);
  }, X0, X1, 400), 'hot');
  p.label(on ? 'OSC 2 RESETS ON OSC 1' : 'FREE RUNNING', X1, BOT, 'end');
  return p.done();
}

function duckDiagram(v: number): VoyDiagram {
  const p = new Pic();
  const db = duckDepthDb(v);
  const depth = db / 24;
  const yT = Y0 + 6;
  for (let b = 0; b < 4; b += 1) {
    const x = X0 + ((X1 - X0) * b) / 4;
    p.p(rbox(x, Y1 - 10, 6, 10, 1), 'main', true);
  }
  p.p(curve((t) => {
    const ph = (t * 4) % 1;
    const g = 1 - depth * Math.exp(-ph * 7);
    return Y1 - 14 - (Y1 - 14 - yT) * g;
  }, X0, X1, 240), 'hot');
  p.label('KICK', X0 + 10, BOT).label(db > 0 ? `-${Math.round(db)} DB` : 'OFF', X1, TOP, 'end');
  return p.done();
}

function chordDiagram(v: number, chord: number): VoyDiagram {
  const p = new Pic();
  const type = chordType(v);
  const x = (i: number): number => X0 + 20 + i * 44;
  const all = CHORD_TYPES.map((_, t) => voicedDegrees(chord, 1, t).map((d) => degreeMidi(chord, d)));
  const lo = Math.min(...all.flat());
  const hi = Math.max(...all.flat());
  const y = (m: number): number => Y1 - 4 - ((m - lo) / Math.max(1, hi - lo)) * (Y1 - Y0 - 8);
  all.forEach((ms, t) => {
    let d = '';
    for (const m of ms) d += rbox(x(t) - 12, y(m) - 3, 24, 6, 2);
    p.p(d, t === type ? 'hot' : 'ghost', true);
    p.label(CHORD_TYPES[t], x(t), BOT, 'middle');
  });
  return p.done();
}

/* ---------------- les touches ---------------- */

function padDiagram(chord: number, values: Readonly<VoyValues>): VoyDiagram {
  const p = new Pic();
  // Un clavier de deux octaves depuis fa diese 3, les notes de l'accord (selon CHORD) en plein
  const ms = voicedDegrees(chord, 1, chordType(values.chord)).map((d) => degreeMidi(chord, d));
  const start = 54;
  const whites: number[] = [];
  for (let m = start; m < start + 25; m += 1) if (![1, 3, 6, 8, 10].includes(m % 12)) whites.push(m);
  // Deux rangees, sans recouvrement (le noir de l'ecran ne sait pas peindre une touche noire) : les touches noires au-dessus, entre les blanches
  const ww = (X1 - X0) / whites.length;
  let wd = '';
  let hot = '';
  whites.forEach((m, i) => {
    const b = rbox(X0 + i * ww + 1.2, 52, ww - 2.4, 44, 2.5);
    if (ms.includes(m)) hot += b;
    else wd += b;
  });
  let bk = '';
  whites.forEach((m, i) => {
    const sharp = m + 1;
    if (![1, 3, 6, 8, 10].includes(sharp % 12) || sharp >= start + 25) return;
    const b = rbox(X0 + (i + 1) * ww - ww * 0.32, 26, ww * 0.64, 22, 2.5);
    if (ms.includes(sharp)) hot += b;
    else bk += b;
  });
  // La premiere touche est fa diese : une noire avant la premiere blanche
  if (ms.includes(start)) hot += rbox(X0 - ww * 0.32, 26, ww * 0.64, 22, 2.5);
  else bk += rbox(X0 - ww * 0.32, 26, ww * 0.64, 22, 2.5);
  p.p(wd, 'ghost');
  p.p(bk, 'ghost', true);
  p.p(hot, 'hot', true);
  p.label(ms.map(midiName).join(' '), X0, TOP);
  return p.done();
}

function runDiagram(values: Readonly<VoyValues>, chord: number): VoyDiagram {
  const p = new Pic();
  p.p(`M${X0} 40L${X0 + 26} 60L${X0} 80Z`, 'hot', true);
  const pv = arpPreview(chord, values);
  const n = Math.min(16, pv.notes.length);
  const dx = (X1 - X0 - 40) / 16;
  for (let i = 0; i < 16; i += 1) {
    const nn = pv.notes[i % Math.max(1, pv.notes.length)];
    const h = nn && nn.midi !== null ? 10 + ((nn.midi - 48) % 24) * 1.4 : 3;
    p.p(rbox(X0 + 40 + i * dx + 1, 80 - h, dx - 2, h, 1.5), i < n ? 'main' : 'ghost', true);
  }
  p.label('ON THE MM-RYTM GRID', X1, BOT, 'end');
  return p.done();
}

function editDiagram(): VoyDiagram {
  const p = new Pic();
  const rnd = mulberry(21);
  const dx = (X1 - X0) / 16;
  let d = '';
  for (let i = 0; i < 16; i += 1) {
    const h = 12 + Math.round(rnd() * 5) * 9;
    d += rbox(X0 + i * dx + 2, Y1 - h, dx - 4, 4, 1.5);
  }
  p.p(d, 'main', true);
  p.p(curve((t) => 70 - 30 * Math.sin(t * Math.PI), X0 + 4 * dx, X0 + 12 * dx, 40), 'hot');
  p.p(dot(X0 + 12 * dx, 70, 4), 'hot', true);
  p.label('DRAG TO DRAW', X1, TOP, 'end');
  return p.done();
}

/** CLEAR : la progression videe (les pads allumes barres). */
function clearDiagram(): VoyDiagram {
  const p = new Pic();
  const w = (X1 - X0 - 7 * 6) / 8;
  let on = '';
  let off = '';
  let x = '';
  for (let i = 0; i < 8; i += 1) {
    const bx = X0 + i * (w + 6);
    const b = rbox(bx, 46, w, 30, 4);
    if (i === 0 || i === 1 || i === 5) {
      on += b;
      x += seg(bx + 4, 50, bx + w - 4, 72) + seg(bx + w - 4, 50, bx + 4, 72);
    } else off += b;
  }
  p.p(off, 'grid');
  p.p(on, 'ghost');
  p.p(x, 'hot');
  p.label('NO CHORD, THE ARP STOPS', X0, BOT);
  return p.done();
}

/** RANDOM : un de, et les styles qu'il tire. */
function randomDiagram(): VoyDiagram {
  const p = new Pic();
  const cx = 56;
  p.p(rbox(cx - 30, MID - 30, 60, 60, 10), 'main');
  let d = '';
  for (const [dx, dy] of [
    [-15, -15],
    [15, -15],
    [0, 0],
    [-15, 15],
    [15, 15],
  ] as const)
    d += dot(cx + dx, MID + dy, 4.5);
  p.p(d, 'hot', true);
  ['BASSLINE', 'ACID', 'PLUCK', 'LEAD', 'DARK', 'ARP'].forEach((s, i) => p.label(s, 120 + (i % 2) * 58, 42 + Math.floor(i / 2) * 22));
  return p.done();
}

/** OPEN : le capot qui se souleve, la plaque des TWEAKS dessous. */
function openDiagram(): VoyDiagram {
  const p = new Pic();
  p.p(rbox(40, 82, 160, 16, 3), 'main');
  p.p(poly([[40, 44], [150, 44], [200, 26]]) + seg(40, 44, 40, 50) + seg(40, 50, 150, 50) + seg(150, 50, 200, 32), 'ghost');
  p.p(arrow(120, 74, 120, 56, 5), 'hot');
  let k = '';
  for (let i = 0; i < 5; i += 1) k += dot(62 + i * 28, 76, 3.2);
  p.p(k, 'hot', true);
  p.label('TWEAKS', X1, BOT, 'end');
  return p.done();
}

/** L'ecran : son plan (l'en-tete, l'accord, l'echelle, la bande des accords). */
function screenDiagram(): VoyDiagram {
  const p = new Pic();
  p.p(rbox(X0, Y0 - 8, X1 - X0, 96, 6), 'ghost');
  p.p(seg(X0 + 8, 26, X1 - 8, 26), 'grid');
  p.p(`M${X0 + 10} 18L${X0 + 16} 21L${X0 + 10} 24Z`, 'main', true);
  p.p(dot(X1 - 10, 20, 4), 'main');
  p.p(rbox(X0 + 10, 34, 26, 18, 3), 'main', true);
  let d = '';
  for (let i = 0; i < 10; i += 1) d += rbox(X0 + 52 + i * 15, 70 - (i % 5) * 7, 9, 3.5, 1.5);
  p.p(d, 'hot', true);
  let s = '';
  for (let i = 0; i < 8; i += 1) s += rbox(X0 + 10 + i * 25, 82, 21, 9, 2);
  p.p(s, 'grid');
  return p.done();
}

/** PRESETS : le nom entre ses fleches, les quatre touches. */
function presetsDiagram(): VoyDiagram {
  const p = new Pic();
  p.p(`M${X0 + 10} ${MID - 10}L${X0} ${MID - 4}L${X0 + 10} ${MID + 2}Z`, 'hot', true);
  p.p(`M${X1 - 10} ${MID - 10}L${X1} ${MID - 4}L${X1 - 10} ${MID + 2}Z`, 'hot', true);
  p.p(rbox(60, MID - 16, 120, 22, 4), 'main');
  ['SAVE', 'NAME', 'DEL', 'EXIT'].forEach((k, i) => {
    p.p(rbox(X0 + 8 + i * 54, 88, 42, 14, 7), i === 3 ? 'hot' : 'ghost', i === 3);
    p.label(k, X0 + 29 + i * 54, 98, 'middle');
  });
  return p.done();
}

/** INFOS : le i et une commande survolee. */
function infosDiagram(): VoyDiagram {
  const p = new Pic();
  p.p(dot(80, MID, 26), 'hot');
  p.p(dot(80, MID - 11, 3.6), 'hot', true);
  p.p(rbox(77, MID - 3, 6, 18, 2), 'hot', true);
  p.p(dot(170, MID, 18), 'main');
  p.p(seg(170, MID, 170, MID - 14), 'main');
  p.p(poly([[184, MID + 8], [184, MID + 30], [190, MID + 24], [196, MID + 34], [200, MID + 32], [194, MID + 22], [202, MID + 22], [184, MID + 8]]), 'ghost', true);
  p.label('HOVER OR TAP', X1, BOT, 'end');
  return p.done();
}

/* ---------------- le dessin d'une commande ---------------- */

export function voyDiagram(id: VoyInfoId, c: VoyDiagramCtx): VoyDiagram | null {
  const values = c.values;
  const chord = c.chord !== undefined && c.chord >= 0 ? c.chord : 0;
  switch (id) {
    case 'wave1':
    case 'wave2':
      return waveDiagram(id, c.v);
    case 'range1':
    case 'range2':
      return detents(OSC_RANGES, stepIndex(id, c.v), 3);
    case 'semi1':
    case 'semi2':
      return detents(SEMIS, stepIndex(id, c.v), 7, 7);
    case 'fine1':
    case 'fine2':
      return fineDiagram(c.v);
    case 'on1':
    case 'on2':
      return onDiagram(stepIndex(id, c.v) === 1);
    case 'osc1':
    case 'osc2':
      return mixerDiagram(id, values);
    case 'noise':
      return noiseDiagram(c.v);
    case 'fm':
      return fmDiagram(c.v, values);
    case 'ratio':
      return ratioDiagram(c.v);
    case 'glide':
      return glideDiagram(c.v, c.bpm);
    case 'cutoff':
    case 'res':
    case 'envAmt':
    case 'fmode':
      return filterDiagram(id, values);
    case 'fA':
    case 'fD':
    case 'fS':
    case 'fR':
    case 'aA':
    case 'aD':
    case 'aS':
    case 'aR':
      return adsrDiagram(id, values);
    case 'lfoRate':
    case 'lfoShape':
    case 'lfoDest':
    case 'lfoAmt':
      return lfoDiagram(id, values);
    case 'dist':
      return driveDiagram(c.v);
    case 'chorus':
      return chorusDiagram(c.v);
    case 'delay':
      return delayDiagram(c.v, c.bpm);
    case 'reverb':
      return reverbDiagram(c.v);
    case 'volume': {
      const db = c.v > 0 ? 20 * Math.log10(c.v * c.v) : -48;
      return meterDiagram(c.v, db, [-48, -36, -24, -12, -6, 0]);
    }
    case 'rate':
      return rateDiagram(c.v);
    case 'mode':
    case 'range':
    case 'notes':
      return contourDiagram(id, values, chord);
    case 'gate':
      return gateDiagram(c.v);
    case 'octave':
      return octaveDiagram(c.v, chord);
    case 'phase':
      return phaseDiagram(c.v);
    case 'drift':
      return driftDiagram(c.v);
    case 'width':
      return widthDiagram(c.v);
    case 'monoLow':
      return monoDiagram(c.v);
    case 'keyTrack':
      return keyTrackDiagram(c.v);
    case 'accent':
      return accentDiagram(c.v);
    case 'sync':
      return syncDiagram(stepIndex('sync', c.v) === 1, values);
    case 'duck':
      return duckDiagram(c.v);
    case 'chord':
      return chordDiagram(c.v, chord);
    case 'pad':
      return padDiagram(chord, values);
    case 'run':
      return runDiagram(values, chord);
    case 'edit':
    case 'seq':
      return editDiagram();
    case 'clear':
      return clearDiagram();
    case 'random':
      return randomDiagram();
    case 'open':
      return openDiagram();
    case 'screen':
      return screenDiagram();
    case 'presets':
      return presetsDiagram();
    case 'infos':
      return infosDiagram();
    default:
      return null;
  }
}

