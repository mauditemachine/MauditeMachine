/**
 * L'ecran du plugin (2026-11-09, Mika : "l'ecran doit etre imperativement de meilleure qualite ! on doit pouvoir voir des
 * graphismes super cool en noir et blanc ! j'aime beaucoup l'effet Swing par exemple").
 *
 * - pluginGraph : le dessin du pied d'un bloc, par son reglage, a la place du petit potard generique : la vraie forme
 *   d'onde du sample de la piste (STRT, LEN), une onde saturee (DIST), deux ondes (CHORUS), des echos (DELAY), une queue
 *   (REVERB), un escalier (BIT), la courbe du COMP, la hauteur (TUNE), les cents (FINE), le PAN, les LFO (SPD, DEP, FADE,
 *   PHAS), le micro-decalage (uTIME), la relance (LFO.T), la longueur (TLEN), la note, le tempo, MASTER ;
 * - pluginPanel : les cases libres d'un ecran deviennent un grand dessin : le sample en grand (SRC 2/2), la chaine des
 *   effets de la piste (VOICE FX), ses 16 pas et sa longueur (TRIG 2/2), le swing sur une mesure (TEMPO).
 * Plugin seulement (le site garde ses ecrans). Rien n'est retenu ici que les cretes des samples (un calcul par sample).
 */

import { anyDial, dialRange, dialShown, type DialId } from '../../actions';
import { SAMPLE_START_MAX, sampleLenPart } from '../../audio/sampledsp';
import { pattern, velocity } from '../../audio/pattern';
import { requestSample, sampleByKey, samplePcm } from '../../audio/samples';
import { TRACK_NAMES, trackIndex, tracks, type TrackKey } from '../../audio/tracks';
import { clock } from '../../audio/clock';
import { freeCells, type PageSlot, type RytmScreenId } from '../../rytm/pages';
import type { Block } from '../../rytm/pageView';
import { playhead } from '../../state/playhead';
import { activeTrack } from '../../state/trk';
import { cellRect, clamp01, MATRIX, type Rect } from './consts';
import { Screen } from './core';
import { defineMethods } from './proto';

declare module './core' {
  interface Screen {
    pluginGraph: typeof pluginGraph;
    pluginPanel: typeof pluginPanel;
    waveIn: typeof waveIn;
  }
}

/* ---------------- les cretes des samples ---------------- */

const PEAK_BINS = 512;
const peaksCache = new Map<string, Float32Array>();

/** Les cretes d'un sample (512 cases, 0 a 1, normalisees), null tant qu'il n'est pas decode (sa demande part). */
function peaksOf(key: string): Float32Array | null {
  if (!key) return null;
  const hit = peaksCache.get(key);
  if (hit) return hit;
  const pcm = samplePcm(key);
  if (!pcm) {
    void requestSample(key);
    return null;
  }
  const n = pcm.L.length;
  const out = new Float32Array(PEAK_BINS);
  let max = 1e-6;
  for (let b = 0; b < PEAK_BINS; b += 1) {
    const i0 = Math.floor((b * n) / PEAK_BINS);
    const i1 = Math.max(i0 + 1, Math.floor(((b + 1) * n) / PEAK_BINS));
    let m = 0;
    for (let i = i0; i < i1 && i < n; i += 1) {
      const a = Math.abs(pcm.L[i]);
      const c = pcm.R ? Math.abs(pcm.R[i]) : 0;
      if (a > m) m = a;
      if (c > m) m = c;
    }
    out[b] = m;
    if (m > max) max = m;
  }
  for (let b = 0; b < PEAK_BINS; b += 1) out[b] = Math.sqrt(out[b] / max);
  peaksCache.set(key, out);
  return out;
}

/** La duree d'un sample decode, en ms (0 : pas encore la). */
function lengthMs(key: string): number {
  const pcm = key ? samplePcm(key) : undefined;
  return pcm ? (pcm.L.length / pcm.sr) * 1000 : 0;
}

const trackNow = (): TrackKey => activeTrack.get() ?? 'BD';
const sampleKeyNow = (): string => tracks.of(trackNow()).snd;

/** La course (0 a 1) d'un reglage par sa cible (ce que l'ecran montre). */
function courseOf(id: string): number {
  const [lo, hi] = dialRange(id as DialId);
  return hi > lo ? clamp01((dialShown(id as DialId) - lo) / (hi - lo)) : 0;
}

/**
 * La forme d'onde de f0 a f1 (0 a 1 du sample) dans r : des traits verticaux symetriques ; hors de [a, b] (la partie qui
 * ne joue pas), a peine ; rev : a l'envers.
 */
function waveIn(this: Screen, r: Rect, peaks: Float32Array, a = 0, b = 1, rev = false, lwK = 1): void {
  const w = r.x1 - r.x0;
  const mid = (r.y0 + r.y1) / 2;
  const amp = (r.y1 - r.y0) / 2;
  const step = Math.max(0.7, Math.min(1.4, w / 140));
  const lw = Math.max(0.5, step * 0.62) * lwK;
  for (let x = 0; x <= w; x += step) {
    const u = x / w;
    const t = rev ? 1 - u : u;
    const i0 = Math.floor(t * (PEAK_BINS - 1));
    const p = Math.max(peaks[i0] ?? 0, 0.02);
    const on = u >= a - 1e-6 && u <= b + 1e-6;
    this.line([r.x0 + x, mid - p * amp, r.x0 + x, mid + p * amp], on ? this.pal.ink : this.pal.faint, lw);
  }
}

/* ---------------- les dessins des blocs ---------------- */

const sine = (cycles: number, t: number, ph = 0): number => Math.sin((t * cycles + ph) * Math.PI * 2);

/** Une courbe y(t) (t de 0 a 1, y de -1 a 1) dans r. */
function curve(s: Screen, r: Rect, f: (t: number) => number, color: string, lw = 1.4, n = 64, amp = 0.9): void {
  const mid = (r.y0 + r.y1) / 2;
  const a = ((r.y1 - r.y0) / 2) * amp;
  const pts: number[] = [];
  for (let k = 0; k <= n; k += 1) {
    const t = k / n;
    pts.push(r.x0 + (r.x1 - r.x0) * t, mid - Math.max(-1, Math.min(1, f(t))) * a);
  }
  s.line(pts, color, lw);
}

/** Le dessin du pied d'un bloc du plugin ; false : celui de toujours. */
function pluginGraph(this: Screen, r: Rect, b: Block): boolean {
  const c = b.course;
  const bi = (c - 0.5) * 2;
  const P = this.pal;
  const lw = 1.5 * Math.max(0.7, Screen.cardK(r));
  const mid = (r.y0 + r.y1) / 2;
  const base = (): void => this.line([r.x0, mid, r.x1, mid], P.faint, 0.7);
  switch (b.target) {
    // La vraie forme d'onde du sample de la piste : STRT (ce qui est saute, a peine) et LEN (ce qui ne joue plus)
    case 't:sstart':
    case 't:slen': {
      const pk = peaksOf(sampleKeyNow());
      if (!pk) return false;
      const st = courseOf('t:sstart');
      const ln = courseOf('t:slen');
      const rev = dialShown('t:srev' as DialId) >= 0.5;
      const a = st * 0.98;
      this.waveIn(r, pk, a, Math.min(1, a + (1 - a) * Math.max(0.02, ln)), rev);
      const x = r.x0 + (r.x1 - r.x0) * (b.target === 't:sstart' ? a : Math.min(1, a + (1 - a) * Math.max(0.02, ln)));
      this.line([x, r.y0 - 1, x, r.y1 + 1], P.ink, 1.1);
      return true;
    }
    default:
      break;
  }
  switch (b.label) {
    case 'DIST': {
      base();
      const k = 1 + c * 9;
      curve(this, r, (t) => Math.tanh(sine(2, t) * k) / Math.tanh(k), P.ink, lw);
      return true;
    }
    case 'CHORUS': {
      base();
      curve(this, r, (t) => sine(2.5, t), P.half, lw * 0.8);
      curve(this, r, (t) => sine(2.5 * (1 + c * 0.18), t, c * 0.15), P.ink, lw);
      return true;
    }
    case 'DELAY': {
      this.line([r.x0, r.y1, r.x1, r.y1], P.faint, 0.7);
      const n = 6;
      const fb = 0.35 + c * 0.6;
      for (let k = 0; k < n; k += 1) {
        const x = r.x0 + 1 + ((r.x1 - r.x0 - 2) * k) / (n - 1);
        const h = (r.y1 - r.y0) * (k === 0 ? 1 : c <= 0 ? 0 : Math.pow(fb, k));
        if (h > 0.4) this.line([x, r.y1, x, r.y1 - h], k === 0 ? P.ink : P.half, k === 0 ? 1.6 : 1.3);
      }
      return true;
    }
    case 'REVERB': {
      this.line([r.x0, r.y1, r.x1, r.y1], P.faint, 0.7);
      const len = 0.25 + c * 0.75;
      const step = 0.9;
      let seed = 7;
      for (let x = r.x0; x <= r.x1; x += step) {
        seed = (seed * 9301 + 49297) % 233280;
        const t = (x - r.x0) / (r.x1 - r.x0);
        const env = c <= 0 ? (t < 0.05 ? 1 : 0) : Math.exp(-t / (len * 0.45));
        const h = (r.y1 - r.y0) * env * (0.35 + 0.65 * (seed / 233280));
        if (h > 0.3) this.line([x, r.y1, x, r.y1 - h], t < 0.06 ? P.ink : P.half, 0.6);
      }
      return true;
    }
    case 'BIT': {
      base();
      const steps = Math.max(2, Math.round(16 - c * 13));
      curve(this, r, (t) => Math.round(sine(1.5, t) * (steps / 2)) / (steps / 2), P.ink, lw, 120);
      return true;
    }
    case 'COMP':
    case 'THRESH':
    case 'RATIO': {
      const S = Math.min(r.x1 - r.x0, r.y1 - r.y0);
      const x0 = r.x0 + (r.x1 - r.x0 - S) / 2;
      const q: Rect = { x0, y0: r.y0, x1: x0 + S, y1: r.y0 + S };
      this.line([q.x0, q.y1, q.x1, q.y0], P.faint, 0.7);
      const th = 0.7 - c * 0.45;
      const ratio = 1 + c * 7;
      const pts: number[] = [];
      for (let k = 0; k <= 32; k += 1) {
        const i = k / 32;
        const o = i < th ? i : th + (i - th) / ratio;
        pts.push(q.x0 + S * i, q.y1 - S * o);
      }
      this.line(pts, P.ink, lw);
      return true;
    }
    case 'TUNE':
    case 'PTCH':
    case 'PITCH': {
      base();
      curve(this, r, (t) => sine(3 * Math.pow(2, bi * 1.5), t) * Math.exp(-t * 1.2), P.ink, lw, 96);
      return true;
    }
    case 'FINE': {
      // Une regle de cents : les traits tous les 10 cents, le repere de la valeur
      const n = 21;
      for (let k = 0; k < n; k += 1) {
        const x = r.x0 + ((r.x1 - r.x0) * k) / (n - 1);
        const h = k === 10 ? (r.y1 - r.y0) * 0.9 : k % 5 === 0 ? (r.y1 - r.y0) * 0.55 : (r.y1 - r.y0) * 0.3;
        this.line([x, r.y1, x, r.y1 - h], k === 10 ? P.half : P.faint, 0.7);
      }
      const x = r.x0 + (r.x1 - r.x0) * c;
      this.line([x, r.y1 + 0.5, x, r.y0], P.ink, 1.6);
      this.circle(x, r.y0 + 1, 1.6, P.ink);
      return true;
    }
    case 'PAN': {
      // L'image stereo : un arc de L a R, le point de la voix
      const cx = (r.x0 + r.x1) / 2;
      const rad = Math.min((r.x1 - r.x0) / 2 - 2, (r.y1 - r.y0) - 1);
      const cy = r.y1;
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, Math.PI, 0);
      ctx.strokeStyle = P.faint;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      const ang = Math.PI + c * Math.PI;
      this.line([cx, cy, cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad], P.half, 0.9);
      this.circle(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, 2.2, P.ink);
      this.text('L', r.x0, r.y1, 4.2, P.half, 700, 'left');
      this.text('R', r.x1, r.y1, 4.2, P.half, 700, 'right');
      return true;
    }
    case 'SPD': {
      base();
      const cyc = 0.5 + Math.abs(bi) * 4.5;
      curve(this, r, (t) => sine(cyc, bi < 0 ? 1 - t : t), Math.abs(bi) < 0.01 ? P.faint : P.ink, lw, 96);
      return true;
    }
    case 'DEP':
    case 'DEPTH': {
      base();
      curve(this, r, (t) => sine(2, t) * 0.25, P.faint, 0.8);
      curve(this, r, (t) => sine(2, t) * bi, P.ink, lw);
      return true;
    }
    case 'FADE': {
      base();
      curve(this, r, (t) => sine(4, t) * (bi >= 0 ? Math.min(1, t / Math.max(0.05, bi)) : Math.max(0, 1 - t / Math.max(0.05, -bi))), P.ink, lw, 96);
      return true;
    }
    case 'PHAS': {
      base();
      curve(this, r, (t) => sine(1, t), P.half, lw * 0.8);
      const x = r.x0 + (r.x1 - r.x0) * c;
      this.line([x, r.y0, x, r.y1], P.ink, 1.1);
      this.circle(x, mid - sine(1, c) * ((r.y1 - r.y0) / 2) * 0.9, 2, P.ink);
      return true;
    }
    case 'µTIME':
    case 'UTIME': {
      // La grille (trois pas), le coup decale
      for (let k = 0; k < 3; k += 1) {
        const x = r.x0 + ((r.x1 - r.x0) * (k + 0.5)) / 3;
        this.line([x, r.y1, x, r.y0 + 2], P.faint, 0.8);
      }
      const x = r.x0 + ((r.x1 - r.x0) * (1.5 + bi * 0.45)) / 3;
      this.line([x, r.y1, x, r.y0], P.ink, 1.8);
      this.circle(x, r.y0 + 0.5, 1.8, P.ink);
      return true;
    }
    case 'LFO.T': {
      base();
      const on = c >= 0.5;
      const pts: number[] = [];
      for (let k = 0; k <= 80; k += 1) {
        const t = k / 80;
        const u = on ? (t * 2) % 1 : t * 2.3;
        pts.push(r.x0 + (r.x1 - r.x0) * t, mid - Math.sin(u * Math.PI * 2) * ((r.y1 - r.y0) / 2) * 0.85);
      }
      this.line(pts, P.ink, lw);
      if (on) this.line([(r.x0 + r.x1) / 2, r.y0, (r.x0 + r.x1) / 2, r.y1], P.half, 0.8);
      return true;
    }
    case 'TLEN': {
      const n = 16;
      const len = Math.round(dialShown('q:tlen' as DialId)) || n;
      const gap = 0.9;
      const d = (r.x1 - r.x0 - gap * (n - 1)) / n;
      for (let k = 0; k < n; k += 1) {
        const x = r.x0 + k * (d + gap);
        if (k < len) this.roundRect(x, mid - d / 2, d, d, 0.6, P.ink);
        else this.roundRect(x + 0.3, mid - d / 2 + 0.3, d - 0.6, d - 0.6, 0.6, null, P.faint, 0.6);
      }
      return true;
    }
    case 'NOTE': {
      // Une octave de clavier, la note eclairee
      const semi = Math.round(bi * 24);
      const pc = ((semi % 12) + 12) % 12;
      const whites = [0, 2, 4, 5, 7, 9, 11];
      const blacks: [number, number][] = [
        [1, 0.7],
        [3, 1.7],
        [6, 3.7],
        [8, 4.7],
        [10, 5.7],
      ];
      const ww = (r.x1 - r.x0) / 7;
      whites.forEach((p, k) => this.roundRect(r.x0 + k * ww + 0.2, r.y0, ww - 0.4, r.y1 - r.y0, 0.6, p === pc ? P.ink : null, P.half, 0.6));
      for (const [p, at] of blacks) this.roundRect(r.x0 + at * ww + ww * 0.15, r.y0, ww * 0.6, (r.y1 - r.y0) * 0.58, 0.4, p === pc ? P.ink : P.bg, P.half, 0.6);
      return true;
    }
    case 'BPM': {
      // Les noires d'une mesure, plus serrees quand le tempo monte
      const n = Math.max(2, Math.min(8, Math.round(2 + c * 6)));
      this.line([r.x0, mid, r.x1, mid], P.faint, 0.7);
      for (let k = 0; k < n; k += 1) this.circle(r.x0 + 2 + ((r.x1 - r.x0 - 4) * k) / (n - 1), mid, k % 4 === 0 ? 2.2 : 1.5, k % 4 === 0 ? P.ink : P.half);
      return true;
    }
    case 'MASTER':
      this.drawLevel(r, c);
      return true;
    case 'ENV': {
      base();
      const pts = [r.x0, mid, r.x0 + (r.x1 - r.x0) * 0.15, mid - bi * ((r.y1 - r.y0) / 2) * 0.9];
      for (let k = 1; k <= 30; k += 1) {
        const t = k / 30;
        pts.push(r.x0 + (r.x1 - r.x0) * (0.15 + 0.85 * t), mid - bi * ((r.y1 - r.y0) / 2) * 0.9 * Math.exp(-t * 3));
      }
      this.line(pts, P.ink, lw);
      return true;
    }
    default:
      return false;
  }
}

/* ---------------- les grands dessins des cases libres ---------------- */

/** Le rectangle qui couvre des cases (colonnes c0 a c1, rangees r0 a r1), en unites de l'ecran. */
function cellsRect(c0: number, c1: number, r0: number, r1: number): Rect {
  const a = cellRect({ c: c0, r: r0, w: 1, h: 1 });
  const b = cellRect({ c: c1, r: r1, w: 1, h: 1 });
  return { x0: a.x + 0.5, y0: a.y + 0.5, x1: b.x + b.w - 0.5, y1: b.y + b.h - 0.5 };
}

const freeSet = (slots: readonly PageSlot[]): Set<string> => new Set(freeCells(slots).map((f) => `${f.c},${f.r}`));
const allFree = (free: Set<string>, c0: number, c1: number, r0: number, r1: number): boolean => {
  for (let r = r0; r <= r1; r += 1) for (let c = c0; c <= c1; c += 1) if (!free.has(`${c},${r}`)) return false;
  return true;
};

/**
 * Le sample en grand de SRC 2/2 (2026-11-10, Mika : "je ne sais pas comment modifier le start ou le end") : la zone de la
 * forme d'onde (unites de l'ecran), et ce que joue la piste en part du fichier, par les lois du moteur (START au plus a 90 %
 * du fichier, la fin par LEN : 12 % a 100 % de ce qui reste). La souris y tire S et E (plugin/ScreenMouse.tsx).
 */
export function srcWave(): { rect: Rect; s: number; e: number } {
  const R = cellsRect(1, 3, 0, 1);
  const s = Math.min(1, courseOf('t:sstart')) * SAMPLE_START_MAX;
  const e = Math.min(1, s + (1 - s) * sampleLenPart(courseOf('t:slen')));
  return { rect: { x0: R.x0 + 5, y0: R.y0 + 16, x1: R.x1 - 5, y1: R.y1 - 14 }, s, e };
}
/** S ou E tire a la part f du fichier (0 a 1) : START, ou la fin (LEN) depuis START. */
export function srcWaveDrag(which: 'start' | 'end', f: number): void {
  const x = Math.max(0, Math.min(1, f));
  const set = (id: string, c: number): void => {
    const [lo, hi] = dialRange(id as DialId);
    anyDial(id as DialId, Math.round((lo + Math.max(0, Math.min(1, c)) * (hi - lo)) * 10000) / 10000);
  };
  if (which === 'start') {
    set('t:sstart', x / SAMPLE_START_MAX);
    return;
  }
  const s = Math.min(1, courseOf('t:sstart')) * SAMPLE_START_MAX;
  const part = (x - s) / Math.max(1e-6, 1 - s);
  set('t:slen', part >= 0.999 ? 1 : (part - 0.12) / 0.88);
}

/**
 * Les cases libres d'un ecran du plugin : un grand dessin, son cadre plein. Rend les cases qu'il a prises (leurs pointilles
 * ne se dessinent pas) ; un ecran sans rien a montrer : aucune.
 */
function pluginPanel(this: Screen, screen: RytmScreenId, slots: readonly PageSlot[], blocks: readonly Block[]): Set<string> {
  const free = freeSet(slots);
  const took = new Set<string>();
  const take = (c0: number, c1: number, r0: number, r1: number): Rect | null => {
    if (!allFree(free, c0, c1, r0, r1)) return null;
    for (let r = r0; r <= r1; r += 1) for (let c = c0; c <= c1; c += 1) took.add(`${c},${r}`);
    const R = cellsRect(c0, c1, r0, r1);
    this.roundRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0, MATRIX.r, null, this.pal.faint, 0.7);
    return R;
  };
  const P = this.pal;
  const title = (R: Rect, t: string, right = ''): void => {
    this.text(t, R.x0 + 4, R.y0 + 9, 6.2, P.half, 700, 'left', 0.7);
    if (right) this.text(right, R.x1 - 4, R.y0 + 9, 6.2, P.half, 700, 'right', 0.5);
  };
  const course = (label: string): number => blocks.find((b) => b.label === label)?.course ?? 0;

  if (screen === 'synth') {
    // SRC 2/2 : le sample en grand, ce qui joue en plein, START et la fin, sa duree
    const R = take(1, 3, 0, 1) ?? take(0, 3, 1, 1);
    if (!R) return took;
    const key = sampleKeyNow();
    const smp = key ? sampleByKey(key) : undefined;
    const name = smp ? (key.includes('/~') ? smp.file.replace(/^~/, '').replace(/\.[a-z0-9]+$/i, '').toUpperCase() : `${smp.family.toUpperCase()} ${smp.label}`) : 'OFF';
    const ms = lengthMs(key);
    title(R, `${TRACK_NAMES[trackIndex(trackNow())]} · ${name}`, ms > 0 ? `${Math.round(ms)} MS` : '');
    const sw = srcWave();
    const W: Rect = sw.rect;
    const pk = peaksOf(key);
    if (!pk) {
      this.text(key ? 'LOADING…' : 'NO SAMPLE', (W.x0 + W.x1) / 2, (W.y0 + W.y1) / 2 + 3, 7, P.half, 700, 'center', 0.6);
      return took;
    }
    const st = sw.s;
    const end = sw.e;
    const rev = dialShown('t:srev' as DialId) >= 0.5;
    this.line([W.x0, (W.y0 + W.y1) / 2, W.x1, (W.y0 + W.y1) / 2], P.faint, 0.6);
    this.waveIn(W, pk, st, end, rev, 1.1);
    const xs = W.x0 + (W.x1 - W.x0) * st;
    const xe = W.x0 + (W.x1 - W.x0) * end;
    this.line([xs, W.y0 - 2, xs, W.y1 + 2], P.ink, 1.2);
    this.line([xe, W.y0 - 2, xe, W.y1 + 2], P.ink, 1.2);
    this.text('S', xs + 1.5, W.y0 + 2, 5, P.ink, 800, 'left');
    this.text('E', xe - 1.5, W.y0 + 2, 5, P.ink, 800, 'right');
    const foot = `START ${Math.round(st * 100)}%   END ${Math.round(end * 100)}%${rev ? '   REVERSE' : ''}`;
    this.text(foot, R.x0 + 4, R.y1 - 4, 5.6, P.half, 700, 'left', 0.5);
    this.text('DRAG S AND E', R.x1 - 4, R.y1 - 4, 5.6, P.faint, 700, 'right', 0.5);
    return took;
  }

  if (screen === 'fxv') {
    // VOICE FX : la chaine de la piste, chaque effet plus ou moins ouvert
    const R = take(0, 3, 1, 1);
    if (!R) return took;
    title(R, 'SIGNAL', TRACK_NAMES[trackIndex(trackNow())]);
    const y = (R.y0 + R.y1) / 2 + 5;
    const nodes = [
      { t: TRACK_NAMES[trackIndex(trackNow())], v: 1 },
      { t: 'DIST', v: course('DIST') },
      { t: 'CHORUS', v: course('CHORUS') },
      { t: 'DELAY', v: course('DELAY') },
      { t: 'REVERB', v: course('REVERB') },
      { t: 'OUT', v: 1 },
    ];
    const n = nodes.length;
    const bw = (R.x1 - R.x0 - 16) / n - 5;
    nodes.forEach((nd, k) => {
      const x = R.x0 + 8 + k * (bw + 5);
      const h = 22;
      this.roundRect(x, y - h / 2, bw, h, 2.5, null, nd.v > 0.001 ? P.ink : P.faint, 0.9);
      const fillH = (h - 3) * clamp01(nd.v);
      if (k > 0 && k < n - 1 && fillH > 0.5) this.roundRect(x + 1.5, y + h / 2 - 1.5 - fillH, bw - 3, fillH, 1.5, P.half);
      this.text(nd.t, x + bw / 2, y + h / 2 + 9, 5.2, nd.v > 0.001 ? P.ink : P.half, 700, 'center', 0.4);
      if (k < n - 1) this.line([x + bw + 0.5, y, x + bw + 4.5, y], P.half, 0.9);
    });
    return took;
  }

  if (screen === 'trig2') {
    // TRIG 2/2 : les 16 pas de la piste, sa longueur (TLEN) et la tete de lecture
    const R = take(1, 3, 1, 1);
    if (!R) return took;
    const t = trackNow();
    const len = Math.round(dialShown('q:tlen' as DialId)) || 16;
    title(R, 'TRACK STEPS', len >= 16 ? 'PTN' : `${len} STEPS`);
    const steps = pattern.get().steps;
    const n = 16;
    const gap = 1.6;
    const d = (R.x1 - R.x0 - 10 - gap * (n - 1)) / n;
    const y = (R.y0 + R.y1) / 2 + 3;
    const head = clock.running ? playhead.get() : -1;
    for (let k = 0; k < n; k += 1) {
      const x = R.x0 + 5 + k * (d + gap);
      const on = velocity(steps, t, k) > 0;
      const inLen = k < len;
      if (on) this.roundRect(x, y - d / 2, d, d, 1, inLen ? P.ink : P.half);
      else this.roundRect(x + 0.4, y - d / 2 + 0.4, d - 0.8, d - 0.8, 1, null, inLen ? P.half : P.faint, 0.7);
      if (k === head) this.line([x, y + d / 2 + 3, x + d, y + d / 2 + 3], P.ink, 1.4);
    }
    if (len < 16) {
      const xe = R.x0 + 5 + len * (d + gap) - gap / 2;
      this.line([R.x0 + 5, y - d / 2 - 3, xe, y - d / 2 - 3], P.ink, 0.9);
      this.line([xe, y - d / 2 - 5, xe, y + d / 2 + 1], P.ink, 0.9);
    }
    return took;
  }

  if (screen === 'tempo') {
    // TEMPO : le swing sur une mesure, les doubles-croches paires reculees
    const R = take(0, 3, 1, 1);
    if (!R) return took;
    const sw = pattern.fx.get().swing;
    const pct = Math.round(50 + (sw * 50) / 3);
    title(R, 'SWING', `${pct}%`);
    const n = 16;
    const y = (R.y0 + R.y1) / 2 + 4;
    const x0 = R.x0 + 8;
    const span = R.x1 - R.x0 - 16;
    const cell = span / n;
    this.line([x0, y, x0 + span, y], P.faint, 0.6);
    for (let k = 0; k < n; k += 1) {
      const gx = x0 + k * cell;
      this.line([gx, y - (k % 4 === 0 ? 9 : 5), gx, y + (k % 4 === 0 ? 9 : 5)], P.faint, 0.6);
      if (k % 4 === 0) this.text(String(k / 4 + 1), gx, y - 12, 5.5, P.half, 700, 'center');
      const off = k % 2 === 1 ? ((pct - 50) / 50) * cell : 0;
      const x = gx + off;
      this.circle(x, y, k % 4 === 0 ? 3.2 : k % 2 === 0 ? 2.5 : 2.1, k % 2 === 1 ? P.half : P.ink);
      if (off > 0.3) this.line([gx, y + 6.5, x, y + 6.5], P.half, 0.7);
    }
    return took;
  }
  return took;
}

defineMethods(Screen, { pluginGraph, pluginPanel, waveIn });
