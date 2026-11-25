/**
 * v50 (2026-11-23, Mika : "C et SQ ok, go" ; la maquette ?mq50 devenue la face par defaut, sans drapeau) : les pages LFO et
 * SQ de l'encart d'EDIT, la bascule SYNTH | LFO | SQ | FX MOD (touches mates a LED de la barre C). faceExtras.tsx pose les
 * pieces (les potards k1 / k3 de Mika, les leviers, les touches) et les zones de prise ; ce fichier dessine les toiles,
 * dit ou vont les pieces, et ce que fait chaque geste.
 *
 * - LFO (option C) : a gauche les quatre LFO (LFO 1 = l'ancien MOD de la face, LFO 2, LFO 3 = l'ancien DISTO LFO, LFO 4) :
 *   la vue de la forme (le point qui la parcourt : Encart50Overlay.tsx, seulement page montree), SPEED, SHAPE, le levier
 *   FREE / SYNC ; a droite la MOD MATRIX, 2 x 4 : #n, SOURCE (menu), AMT (k3), DESTINATION (menu groupe), le viseur. Les
 *   lignes liees d'abord (les anciennes routes non neutres, modRoutes.ts), puis les emplacements xMx ; au-dela de huit
 *   lignes, une pagination (< 1 / 2 >) a droite du titre.
 * - SQ : le sequenceur de la page SEQ en petit (les memes donnees : voyager/seq.ts, steps.ts) : STEPS (END), RATE (celui
 *   de l'arpege), SWING (xSwing), RANDOM, CLEAR ; NOTE (glisser vertical : la note ; clic : note / silence), ACCENT et
 *   SLIDE (clic, glisser), la rangee GATE / RATCHET / CHANCE (trois touches). La tete : deux pieces posees sur la toile
 *   (un voile sur la colonne, la LED), deplacees a chaque pas, la toile ne se redessine pas pour elle.
 *
 * Regles CPU v49 : une toile ne se redessine que si ce qu'elle montre a change, et seulement la page montree (les autres
 * attendent d'etre montrees) ; rien ne tourne au repos.
 */

import {
  CanvasTexture,
  ClampToEdgeWrapping,
  ExtrudeGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Shape,
  type Object3D,
} from 'three';
import { registerDialSpec } from '../../scene/screen/menus/registry';
import { FONT_DISPLAY } from '../../theme';
import { PLUGIN_ACCENT } from '../../theme/base';
import { arp, arpExternal } from '../../voyager/arp';
import { voyMsg } from '../../voyager/msg';
import { RATES, voyParams, type VoyKnobId } from '../../voyager/params';
import { paintLed } from '../../voyager/ledLens';
import { VIVID } from '../../voyager/vivid';
import { seq, SEQ_MIN, SEQ_TOP, type SeqStep } from '../../voyager/seq';
import { VOY_SEQ } from '../../voyager/seqscreen';
import { keyName } from '../../voyager/chords';
import { arpExtra, isExtra } from './extra';
import { modMenu } from './modMenu';
import {
  aimSourceName,
  amtIdOf,
  amtText,
  destName,
  dstOf,
  LFOS,
  modAim,
  modRows,
  modView,
  routeSay,
  setAmt,
  setDest,
  setSource,
  setVal,
  srcName,
  srcOf,
  stepAt,
  stepsOf,
  textOf,
  valOf,
  type Route,
} from './modRoutes';
import { MOD_SOURCES } from './modTable';
import { chordShown, knobNote, lastOn, LEVELS, noteName, notesViewStore, randomNotes, SOFT_RANDOM } from './seqEdit';
import { arpSteps, stepName, STEPS_N, type StepTrack } from './steps';

/** Le DialId d'une piece de l'encart (faceExtras.tsx ED). */
const ED = 'z:ed:';

/* ---------------- la geometrie de l'encart ---------------- */

export const GW = VOY_SEQ.w - 2 * VOY_SEQ.bezel;
export const GD = VOY_SEQ.d - 2 * VOY_SEQ.bezel;
export const X0 = VOY_SEQ.x - GW / 2;
export const Z0 = VOY_SEQ.z - GD / 2;
/** La bascule : sa colonne (unites depuis le bord gauche du verre), ses touches, le trait qui la separe de la page. */
const TAB = { u: 0.43, w: 0.62, d: 0.2, sep: 0.86 } as const;
export type Page50Id = 'synth' | 'lfo' | 'sq' | 'fxmod';
export const TABS50: readonly { id: Page50Id; name: string }[] = [
  { id: 'synth', name: 'SYNTH' },
  { id: 'lfo', name: 'LFO' },
  { id: 'sq', name: 'SQ' },
  { id: 'fxmod', name: 'FX MOD' },
];
/** Les touches de la bascule et le trait (repere du plateau). */
export function tabs50(): { x: number; z: number[]; sep: number; w: number; d: number } {
  const n = TABS50.length;
  const pitch = 0.36;
  const v0 = (GD - pitch * (n - 1)) / 2;
  return { x: X0 + TAB.u, z: TABS50.map((_, i) => Z0 + v0 + i * pitch), sep: X0 + TAB.sep, w: TAB.w, d: TAB.d };
}
const CL = TAB.sep + 0.08;
const CR = GW - 0.06;
const at = (u: number, v: number): { x: number; z: number } => ({ x: X0 + u, z: Z0 + v });

/* ---------------- les couleurs (celles de l'encart, de la barre C, des fenetres des pages d'OPEN) ---------------- */

const INK = 'rgba(238, 234, 226, 0.92)';
const DIM = 'rgba(238, 234, 226, 0.55)';
const FAINT = 'rgba(238, 234, 226, 0.32)';
export const accent50 = (): string => {
  if (typeof document === 'undefined') return PLUGIN_ACCENT;
  const a = getComputedStyle(document.documentElement).getPropertyValue('--mm-accent').trim();
  return /^#[0-9a-f]{6}$/i.test(a) ? a : PLUGIN_ACCENT;
};
const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
/** Le halo d'une LED allumee de l'encart (les touches de la bascule, la tete de SQ) : celui d'avant, a l'accent. */
// v53 (voyager/vivid.ts) : plus opaque selon la vivacite de la face (0.6 : la v52) ; sa portee reste (les toiles des LED en dependent)
export const LED_HALO_50 = { r0: 0, r1: 3.4, stops: [[0, Math.min(1, 0.6 * VIVID.led.halo)], [1, 0]] } as const;

/* ---------------- le panneau et ses aides de dessin (unites : u depuis le bord gauche du verre, v depuis le haut) ---------------- */

const W = 4096;
const H = Math.round((W * GD) / GW);
const U = W / GW;
const px = (u: number): number => u * U;
const py = (v: number): number => (v / GD) * H;

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + h - r);
  g.arcTo(x + w, y + h, x + w - r, y + h, r);
  g.lineTo(x + r, y + h);
  g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, y + r);
  g.arcTo(x, y, x + r, y, r);
  g.closePath();
}

/** Le fond (le noir anodise de l'encart, son grain, son lisere, le trait de la bascule) : dessine une fois. */
let baseCanvas: HTMLCanvasElement | null = null;
function base(): HTMLCanvasElement {
  if (baseCanvas) return baseCanvas;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a1a1b');
  bg.addColorStop(1, '#0f0f10');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i += 1) {
    g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.025).toFixed(3)})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  g.strokeStyle = 'rgba(255, 250, 240, 0.12)';
  g.lineWidth = 3;
  g.strokeRect(6, 6, W - 12, H - 12);
  g.fillStyle = 'rgba(255, 250, 240, 0.14)';
  g.fillRect(px(TAB.sep) - 2, py(0.12), 4, py(GD - 0.12) - py(0.12));
  baseCanvas = c;
  return c;
}

/** Les formes des LFO : une valeur -1..1 pour une phase (un cycle par unite). */
const SH = [0.62, -0.34, 0.9, -0.72, 0.18, -0.9, 0.5, -0.12];
export function waveAt(shape: string, p: number): number {
  const f = p - Math.floor(p);
  switch (shape) {
    case 'SINE':
      return Math.sin(2 * Math.PI * f);
    case 'TRI':
      return 1 - 4 * Math.abs(f - 0.5);
    case 'SAW':
      return 1 - 2 * f;
    case 'RAMP':
      return 2 * f - 1;
    case 'SQR':
    case 'SQUARE':
      return f < 0.5 ? 0.85 : -0.85;
    case 'S&H':
      return SH[((Math.floor(p * 4) % SH.length) + SH.length) % SH.length];
    default: {
      // RND, RANDOM : un hasard lisse
      const k = p * 3;
      const i = Math.floor(k);
      const t = k - i;
      const a = SH[((i % SH.length) + SH.length) % SH.length];
      const b = SH[(((i + 1) % SH.length) + SH.length) % SH.length];
      return a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * t));
    }
  }
}

/** Les aides de dessin sur une toile (le fond deja pose). */
function pen(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  g.drawImage(base(), 0, 0);
  const font = (cap: number, weight: number, spacing: number): void => {
    g.font = `${weight} ${Math.round(cap * U * 1.38)}px ${FONT_DISPLAY}`;
    (g as unknown as { letterSpacing: string }).letterSpacing = `${(cap * U * spacing).toFixed(1)}px`;
  };
  const text = (s: string, u: number, v: number, cap: number, weight: number, col: string, spacing = 0.18, align: CanvasTextAlign = 'center'): void => {
    font(cap, weight, spacing);
    g.fillStyle = col;
    g.textAlign = align;
    g.textBaseline = 'middle';
    // l'espacement s'ajoute apres la derniere lettre : un texte centre se recale d'une demi-espace
    const dx = align === 'center' ? (cap * U * spacing) / 2 : align === 'right' ? cap * U * spacing : 0;
    g.fillText(s, px(u) + dx, py(v));
  };
  /** Un texte qui tient dans sa largeur (w, unites) : plus petit jusqu'aux deux tiers, puis coupe. */
  const fit = (s: string, u: number, v: number, w: number, cap: number, weight: number, col: string, spacing = 0.06): void => {
    let c2 = cap;
    let t = s;
    font(c2, weight, spacing);
    while (g.measureText(t).width > w * U && c2 > cap * 0.68) {
      c2 *= 0.94;
      font(c2, weight, spacing);
    }
    while (t.length > 3 && g.measureText(t).width > w * U) t = `${t.slice(0, -2)}…`;
    text(t, u, v, c2, weight, col, spacing);
  };
  const vline = (u: number, va: number, vb: number, a = 0.14): void => {
    g.fillStyle = `rgba(255, 250, 240, ${a})`;
    g.fillRect(px(u) - 2, py(va), 4, py(vb) - py(va));
  };
  const box = (u: number, v: number, w: number, h: number, fill: string | null, stroke: string, lw = 3): void => {
    rr(g, px(u - w / 2), py(v - h / 2), w * U, py(h) - py(0), Math.min(10, w * U * 0.08));
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  };
  const frame = (u0: number, v0: number, w: number, h: number, a = 0.09, col?: string): void => {
    rr(g, px(u0), py(v0), w * U, py(h) - py(0), 12);
    g.strokeStyle = col ?? `rgba(255, 250, 240, ${a})`;
    g.lineWidth = col ? 4 : 3;
    g.stroke();
  };
  /** Une fenetre de verre noir (pcbui.tsx PcbSelect, hood.css .mm-p2-win) : sa valeur, les fleches du menu a droite. */
  const win = (u: number, v: number, w: number, h: number, label: string, o: { off?: boolean; arrows?: boolean; lit?: boolean; cap?: number; col?: string } = {}): void => {
    const x = px(u - w / 2);
    const y = py(v - h / 2);
    const ww = w * U;
    const hh = py(h) - py(0);
    const gr = g.createLinearGradient(0, y, 0, y + hh);
    gr.addColorStop(0, '#030303');
    gr.addColorStop(1, '#0b0b0c');
    rr(g, x, y, ww, hh, 6);
    g.fillStyle = gr;
    g.fill();
    g.save();
    rr(g, x, y, ww, hh, 6);
    g.clip();
    const sh = g.createLinearGradient(0, y, 0, y + hh * 0.35);
    sh.addColorStop(0, 'rgba(0,0,0,0.9)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.fillRect(x, y, ww, hh * 0.35);
    g.restore();
    rr(g, x, y, ww, hh, 6);
    g.strokeStyle = o.lit ? accent50() : '#2c2e31';
    g.lineWidth = o.lit ? 4 : 3;
    g.stroke();
    const arrows = o.arrows !== false;
    const cap = o.cap ?? 0.06;
    const aw = arrows ? 0.13 : 0;
    fit(label, u - aw / 2, v + 0.004, w - aw - 0.06, cap, 600, o.col ?? (o.off ? 'rgba(236, 232, 224, 0.4)' : '#f3efe7'));
    if (arrows) {
      const ax = px(u + w / 2 - 0.075);
      const ay = py(v);
      const s = 0.024 * U;
      g.fillStyle = 'rgba(236, 232, 224, 0.55)';
      for (const dir of [-1, 1]) {
        g.beginPath();
        g.moveTo(ax - s, ay + dir * s * 0.35);
        g.lineTo(ax + s, ay + dir * s * 0.35);
        g.lineTo(ax, ay + dir * s * 1.45);
        g.closePath();
        g.fill();
      }
    }
  };
  /** Le viseur : un cercle, quatre traits qui en sortent, un point au centre ; allume a l'accent pendant l'assignation. */
  const cross = (u: number, v: number, r: number, lit = false): void => {
    const x = px(u);
    const y = py(v);
    const R = r * U;
    const col = lit ? accent50() : 'rgba(238, 234, 226, 0.78)';
    if (lit) {
      const glow = g.createRadialGradient(x, y, 0, x, y, R * 2.4);
      glow.addColorStop(0, rgba(accent50(), 0.45));
      glow.addColorStop(1, rgba(accent50(), 0));
      g.fillStyle = glow;
      g.fillRect(x - R * 2.4, y - R * 2.4, R * 4.8, R * 4.8);
    }
    g.strokeStyle = col;
    g.lineWidth = lit ? 5 : 4;
    g.beginPath();
    g.arc(x, y, R * 0.72, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      g.moveTo(x + dx * R * 0.42, y + dy * R * 0.42);
      g.lineTo(x + dx * R * 1.22, y + dy * R * 1.22);
    }
    g.stroke();
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, y, R * 0.13, 0, Math.PI * 2);
    g.fill();
  };
  /** Le numero d'une ligne (#1) : une etiquette claire, le chiffre en noir. */
  const badge = (u: number, v: number, s: string): void => {
    const w = 0.12 + s.length * 0.052;
    rr(g, px(u - w / 2), py(v - 0.068), w * U, py(0.136) - py(0), 8);
    g.fillStyle = 'rgba(214, 210, 202, 0.82)';
    g.fill();
    text(s, u, v + 0.003, 0.052, 800, '#121212', 0.04);
  };
  /** Une LED eteinte (2026-11-24 : le verre clair et neutre des LED du plugin, voyager/ledLens.ts ; plus de rouge). */
  const led = (u: number, v: number, r: number): void => paintLed(g, px(u), py(v), r * U, null, { ring: 1.16 });
  /** La petite vue d'un LFO : une fenetre de verre, sa forme sur deux cycles (le point : Encart50Overlay.tsx). */
  const wave = (u0: number, v0: number, w: number, h: number, shape: string): void => {
    const x = px(u0);
    const y = py(v0);
    const ww = w * U;
    const hh = py(h) - py(0);
    const gr = g.createLinearGradient(0, y, 0, y + hh);
    gr.addColorStop(0, '#030303');
    gr.addColorStop(1, '#0a0a0b');
    rr(g, x, y, ww, hh, 8);
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = '#2c2e31';
    g.lineWidth = 3;
    g.stroke();
    const my = py(v0 + h / 2);
    const amp = hh * WAVE_AMP;
    g.strokeStyle = 'rgba(238, 234, 226, 0.1)';
    g.lineWidth = 2;
    g.setLineDash([8, 8]);
    g.beginPath();
    g.moveTo(x + 10, my);
    g.lineTo(x + ww - 10, my);
    g.stroke();
    g.setLineDash([]);
    const x0 = x + WAVE_IN * U;
    const x1 = x + ww - WAVE_IN * U;
    const N = 240;
    g.strokeStyle = 'rgba(238, 234, 226, 0.86)';
    g.lineWidth = 4;
    g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i <= N; i += 1) {
      const a = x0 + ((x1 - x0) * i) / N;
      const b = my - amp * waveAt(shape, (2 * i) / N);
      if (i) g.lineTo(a, b);
      else g.moveTo(a, b);
    }
    g.stroke();
  };
  return { g, text, fit, vline, box, frame, win, cross, badge, led, wave };
}
const WAVE_AMP = 0.36;
const WAVE_IN = 0.06;

/* ---------------- les pieces et les zones d'une page ---------------- */

export type Place50 =
  | { k: 'k1' | 'k3'; x: number; z: number; R: number; v: () => number; show?: () => boolean; arcs?: readonly { id: string; live: () => boolean }[] }
  | { k: 'lever'; x: number; z: number; s: number; right: () => boolean }
  | { k: 'key'; x: number; z: number; w: number; d: number; label: string; on: () => boolean; cap?: number };
/** Une zone de prise (repere du plateau) ; live : prise seulement si vrai (une ligne de matrice vide, un pas hors de la suite). */
export interface Hit50 {
  id: string;
  dial: string;
  shape: 'box' | 'disc';
  x: number;
  z: number;
  hx: number;
  hz: number;
  live?: () => boolean;
}
export interface Page50 {
  tex: CanvasTexture;
  place: Place50[];
  hits: Hit50[];
  /** redessine la toile si ce qu'elle montre a change ; true si elle a change */
  redraw: () => boolean;
  /** la tete (SQ) : ses pieces, et leur mise a jour (true : elles ont bouge) */
  head?: { meshes: Object3D[]; update: () => boolean; dispose: () => void };
}

function pageOf(draw: (c: HTMLCanvasElement) => void, key: () => string): { tex: CanvasTexture; redraw: () => boolean } {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  let last = key();
  draw(c);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return {
    tex,
    redraw: () => {
      const k = key();
      if (k === last) return false;
      last = k;
      draw(c);
      tex.needsUpdate = true;
      return true;
    },
  };
}

/* ---------------- LFO : les quatre LFO a gauche, la matrice (2 x 4) a droite ---------------- */

const SPLIT = CL + 4.36;
const LCW = (SPLIT - CL) / 4;
const M0 = SPLIT + 0.14;
const SW = (CR - M0) / 4;
const LFO_KNOB = { v: 0.85, R: 0.19, dx: 0.26 } as const;
const WAVE_BOX = { v: 0.27, h: 0.31, inset: 0.08 } as const;
const slotAt = (p: number): { u0: number; v0: number } => ({ u0: M0 + (p % 4) * SW, v0: p < 4 ? 0.28 : 0.93 });
const PAGER = { prev: CR - 0.62, next: CR - 0.1, text: CR - 0.36, v: 0.15 } as const;

/** La vue de la forme du LFO i (repere du plateau) : ses bords, son milieu, son amplitude ; pour le point anime. */
export function lfoWave(i: number): { x0: number; x1: number; z: number; amp: number } {
  const u0 = CL + i * LCW + WAVE_BOX.inset;
  const w = LCW - 2 * WAVE_BOX.inset;
  return { x0: X0 + u0 + WAVE_IN, x1: X0 + u0 + w - WAVE_IN, z: Z0 + WAVE_BOX.v + WAVE_BOX.h / 2, amp: WAVE_BOX.h * WAVE_AMP };
}

function drawLfo(c: HTMLCanvasElement): void {
  const P = pen(c);
  LFOS.forEach((l, i) => {
    const u0 = CL + i * LCW;
    const uc = u0 + LCW / 2;
    P.text(`LFO ${l.n}`, uc, 0.15, 0.062, 700, INK, 0.22);
    // la vitesse du moment, en petit a droite du titre (FREE : des Hz ; SYNC : la division)
    P.text(l.rateText(), u0 + LCW - 0.07, 0.152, 0.036, 700, DIM, 0.06, 'right');
    P.wave(u0 + WAVE_BOX.inset, WAVE_BOX.v, LCW - 2 * WAVE_BOX.inset, WAVE_BOX.h, l.shapeName());
    const lv = LFO_KNOB.v + LFO_KNOB.R + 0.075;
    P.text('SPEED', uc - LFO_KNOB.dx, lv, 0.044, 600, INK, 0.1);
    P.text('SHAPE', uc + LFO_KNOB.dx, lv, 0.044, 600, INK, 0.1);
    const s = l.sync();
    P.text('FREE', uc - 0.24, 1.39, 0.036, 700, s ? DIM : INK, 0.06, 'right');
    P.text('SYNC', uc + 0.24, 1.39, 0.036, 700, s ? INK : DIM, 0.06, 'left');
    if (i < 3) P.vline(u0 + LCW, 0.22, GD - 0.12, 0.09);
  });
  P.vline(SPLIT + 0.04, 0.12, GD - 0.12);
  P.text('MOD MATRIX', (M0 + CR) / 2, 0.15, 0.062, 700, INK, 0.22);
  // plus de huit lignes : la pagination, a droite du titre
  const pages = modView.pages();
  if (pages > 1) {
    const pg = modView.page();
    P.text(`${pg + 1} / ${pages}`, PAGER.text, PAGER.v, 0.044, 700, INK, 0.08);
    const tri = (u: number, dir: number, on: boolean): void => {
      const x = px(u);
      const y = py(PAGER.v);
      const s = 0.03 * U;
      P.g.fillStyle = on ? 'rgba(238, 234, 226, 0.85)' : 'rgba(238, 234, 226, 0.22)';
      P.g.beginPath();
      P.g.moveTo(x + dir * s, y);
      P.g.lineTo(x - dir * s * 0.7, y - s);
      P.g.lineTo(x - dir * s * 0.7, y + s);
      P.g.closePath();
      P.g.fill();
    };
    tri(PAGER.prev, -1, pg > 0);
    tri(PAGER.next, 1, pg < pages - 1);
  }
  const aim = modAim.key();
  for (let p = 0; p < 8; p += 1) {
    const { u0, v0 } = slotAt(p);
    const r = modView.rowAt(p);
    if (!r) {
      P.frame(u0 + 0.04, v0, SW - 0.08, 0.6, 0.04);
      continue;
    }
    const lit = aim === r.key;
    P.frame(u0 + 0.04, v0, SW - 0.08, 0.6, 0.09, lit ? rgba(accent50(), 0.85) : undefined);
    P.badge(u0 + 0.21, v0 + 0.16, `#${modView.numberAt(p)}`);
    const a0 = u0 + 0.37;
    const a1 = u0 + SW - 0.44;
    const src = srcOf(r);
    // pendant l'assignation, un emplacement vide montre la source qu'il prendra (LFO 1)
    const srcLabel = lit ? aimSourceName(r) : (MOD_SOURCES[src] ?? 'OFF');
    P.win((a0 + a1) / 2, v0 + 0.16, a1 - a0, 0.2, srcLabel, { off: src === 0 && !lit, cap: 0.056 });
    // la fleche de la source a la cible
    P.g.strokeStyle = 'rgba(238, 234, 226, 0.4)';
    P.g.lineWidth = 3;
    P.g.beginPath();
    P.g.moveTo(px(u0 + 0.2), py(v0 + 0.28));
    P.g.lineTo(px(u0 + 0.2), py(v0 + 0.44));
    P.g.lineTo(px(u0 + 0.3), py(v0 + 0.44));
    P.g.stroke();
    P.g.beginPath();
    P.g.moveTo(px(u0 + 0.3), py(v0 + 0.405));
    P.g.lineTo(px(u0 + 0.335), py(v0 + 0.44));
    P.g.lineTo(px(u0 + 0.3), py(v0 + 0.475));
    P.g.stroke();
    const d = dstOf(r);
    const off = d.code === 0;
    P.win((a0 + a1) / 2, v0 + 0.44, a1 - a0, 0.2, lit ? 'CLICK A KNOB' : off ? '- - -' : d.name, { off, lit, cap: 0.056, col: lit ? accent50() : undefined });
    P.cross(u0 + SW - 0.23, v0 + 0.45, 0.064, lit);
  }
}

const lfoKey = (): string =>
  JSON.stringify([
    LFOS.map((l) => [l.shapeName(), l.sync(), l.rateText()]),
    modView.page(),
    modView.pages(),
    modAim.key(),
    Array.from({ length: 8 }, (_, p) => {
      const r = modView.rowAt(p);
      return r ? [r.key, srcOf(r), dstOf(r).name, dstOf(r).code] : null;
    }),
    accent50(),
  ]);

export function lfoPage50(): Page50 {
  const { tex, redraw } = pageOf(drawLfo, lfoKey);
  const place: Place50[] = [];
  const hits: Hit50[] = [];
  LFOS.forEach((l, i) => {
    const uc = CL + i * LCW + LCW / 2;
    const sp = at(uc - LFO_KNOB.dx, LFO_KNOB.v);
    const sh = at(uc + LFO_KNOB.dx, LFO_KNOB.v);
    // les arcs : la vitesse continue (FREE de LFO 1 et 2 ; LFO 3 et 4 toujours) ; la forme a crans n'en a pas
    const arcs = l.n === 1 ? [{ id: 'xLfo1Hz', live: () => !l.sync() }] : l.n === 2 ? [{ id: 'xLfo2Hz', live: () => !l.sync() }] : [{ id: l.speedId(), live: () => true }];
    place.push({ k: 'k1', ...sp, R: LFO_KNOB.R, v: () => valOf(l.speedId()), arcs });
    place.push({ k: 'k1', ...sh, R: LFO_KNOB.R, v: () => valOf(l.shapeId) });
    place.push({ k: 'lever', ...at(uc, 1.39), s: 0.66, right: l.sync });
    const r = LFO_KNOB.R * 1.15;
    hits.push({ id: `ved-lfo${l.n}-speed`, dial: `${ED}lfo:${l.n}:speed`, shape: 'disc', ...sp, hx: r, hz: r });
    hits.push({ id: `ved-lfo${l.n}-shape`, dial: `${ED}lfo:${l.n}:shape`, shape: 'disc', ...sh, hx: r, hz: r });
    hits.push({ id: `ved-lfo${l.n}-sync`, dial: `${ED}lfo:${l.n}:sync`, shape: 'box', ...at(uc, 1.39), hx: 0.36, hz: 0.12 });
  });
  for (let p = 0; p < 8; p += 1) {
    const { u0, v0 } = slotAt(p);
    const live = (): boolean => modView.rowAt(p) !== null;
    const a0 = u0 + 0.37;
    const a1 = u0 + SW - 0.44;
    const amt = at(u0 + SW - 0.23, v0 + 0.17);
    place.push({
      k: 'k3',
      ...amt,
      R: 0.125,
      v: () => {
        const r = modView.rowAt(p);
        return r ? valOf(amtIdOf(r)) : 0.5;
      },
      show: live,
    });
    hits.push({ id: `ved-mx-src-${p}`, dial: `${ED}mx:src:${p}`, shape: 'box', ...at((a0 + a1) / 2, v0 + 0.16), hx: (a1 - a0) / 2, hz: 0.11, live });
    hits.push({ id: `ved-mx-dst-${p}`, dial: `${ED}mx:dst:${p}`, shape: 'box', ...at((a0 + a1) / 2, v0 + 0.44), hx: (a1 - a0) / 2, hz: 0.11, live });
    hits.push({ id: `ved-mx-amt-${p}`, dial: `${ED}mx:amt:${p}`, shape: 'disc', ...amt, hx: 0.15, hz: 0.15, live });
    hits.push({ id: `ved-mx-aim-${p}`, dial: `${ED}mx:aim:${p}`, shape: 'disc', ...at(u0 + SW - 0.23, v0 + 0.45), hx: 0.12, hz: 0.12, live });
  }
  const paged = (): boolean => modView.pages() > 1;
  hits.push({ id: 'ved-mx-prev', dial: `${ED}mx:prev`, shape: 'box', ...at(PAGER.prev, PAGER.v), hx: 0.1, hz: 0.09, live: paged });
  hits.push({ id: 'ved-mx-next', dial: `${ED}mx:next`, shape: 'box', ...at(PAGER.next, PAGER.v), hx: 0.1, hz: 0.09, live: paged });
  return { tex, place, hits, redraw };
}

/* ---------------- les gestes de la page LFO ---------------- */

const noop = (): void => undefined;
const defOf = (id: string): number => (isExtra(id) ? arpExtra.def(id) : voyParams.def(id as VoyKnobId));
/** Une valeur posee sur un reglage (a crans : le cran le plus proche). */
const setSnap = (id: string, v: number): void => {
  const n = stepsOf(id);
  const x = Math.min(1, Math.max(0, v));
  setVal(id, n > 1 ? Math.round(x * (n - 1)) / (n - 1) : x);
};
function spec(id: string, o: { value: () => number; set: (v: number) => void; text?: (v: number) => string; reset?: () => number; say?: (v: number) => string }): void {
  registerDialSpec(id, {
    value: o.value,
    set: o.set,
    range: () => [0, 1] as const,
    steps: () => 0,
    text: o.text ?? ((v) => `${Math.round(v * 100)} %`),
    unit: () => '',
    reset: o.reset ?? o.value,
    say: o.say ?? ((v) => (o.text ?? ((x) => `${Math.round(x * 100)} %`))(v)),
  });
}

for (const l of LFOS) {
  spec(`${ED}lfo:${l.n}:speed`, {
    value: () => valOf(l.speedId()),
    set: (v) => {
      setSnap(l.speedId(), v);
      voyMsg.show(`LFO ${l.n} SPEED ${l.rateText()}`, 1800);
    },
    text: (v) => textOf(l.speedId(), v),
    reset: () => defOf(l.speedId()),
    say: (v) => `LFO ${l.n} SPEED ${textOf(l.speedId(), v)}`,
  });
  spec(`${ED}lfo:${l.n}:shape`, {
    value: () => valOf(l.shapeId),
    set: (v) => {
      setSnap(l.shapeId, v);
      voyMsg.show(`LFO ${l.n} SHAPE ${l.shapeName()}`, 1800);
    },
    text: (v) => textOf(l.shapeId, v),
    reset: () => defOf(l.shapeId),
    say: (v) => `LFO ${l.n} SHAPE ${textOf(l.shapeId, v)}`,
  });
  spec(`${ED}lfo:${l.n}:sync`, { value: () => (l.sync() ? 1 : 0), set: noop, text: () => (l.sync() ? 'SYNC' : 'FREE') });
}

const rowSay = (p: number): void => {
  const r = modView.rowAt(p);
  if (r) voyMsg.show(routeSay(r, modView.numberAt(p)), 2000);
};
for (let p = 0; p < 8; p += 1) {
  const row = (): Route | null => modView.rowAt(p);
  spec(`${ED}mx:amt:${p}`, {
    value: () => {
      const r = row();
      return r ? valOf(amtIdOf(r)) : 0.5;
    },
    set: (v) => {
      const r = row();
      if (!r) return;
      setAmt(r, v);
      rowSay(p);
    },
    text: (v) => {
      const r = row();
      return r ? amtText(r, v) : '';
    },
    reset: () => (row()?.kind === 'lfo1' ? 0 : 0.5),
    say: (v) => {
      const r = row();
      return r ? `#${modView.numberAt(p)} AMOUNT ${amtText(r, v)}` : '';
    },
  });
  // SOURCE : un glisser passe d'une source a la suivante (un emplacement seulement : une ligne liee ne se deplace qu'au menu)
  const NS = MOD_SOURCES.length - 1;
  spec(`${ED}mx:src:${p}`, {
    value: () => {
      const r = row();
      return r ? srcOf(r) / NS : 0;
    },
    set: (v) => {
      const r = row();
      if (!r || r.kind !== 'mx') return;
      const s = Math.round(Math.min(1, Math.max(0, v)) * NS);
      if (s === srcOf(r)) return;
      setSource(r, s);
      rowSay(p);
    },
    text: (v) => MOD_SOURCES[Math.round(v * NS)] ?? '',
  });
  spec(`${ED}mx:dst:${p}`, { value: () => 0, set: noop, text: () => (row() ? dstOf(row()!).name : '') });
  spec(`${ED}mx:aim:${p}`, { value: () => 0, set: noop, text: () => 'TARGET' });
}
spec(`${ED}mx:prev`, { value: () => 0, set: noop, text: () => 'PREVIOUS' });
spec(`${ED}mx:next`, { value: () => 0, set: noop, text: () => 'NEXT' });

function openSource(p: number): void {
  const r = modView.rowAt(p);
  if (!r) return;
  const cur = srcOf(r);
  modMenu.open({
    kind: 'list',
    anchor: `ved-mx-src-${p}`,
    title: `#${modView.numberAt(p)} SOURCE`,
    cols: 2,
    items: MOD_SOURCES.map((s, i) => ({
      label: s,
      on: i === cur,
      pick: () => {
        setSource(r, i);
        const rows = modRows();
        const k = rows.findIndex((x) => x.key === r.key);
        if (k >= 0 && isLinkedOrSlot(r)) voyMsg.show(routeSay(r, k + 1), 2000);
        else voyMsg.show(`SOURCE ${s}`, 1600);
      },
    })),
  });
}
const isLinkedOrSlot = (r: Route): boolean => r.kind === 'mx' || modRows().some((x) => x.key === r.key);

function openDest(p: number): void {
  const r = modView.rowAt(p);
  if (!r) return;
  const d = dstOf(r);
  modMenu.open({
    kind: 'dest',
    anchor: `ved-mx-dst-${p}`,
    title: `#${modView.numberAt(p)} ${srcName(r)} > DESTINATION`,
    current: d.code ?? -1,
    pick: (code) => {
      setDest(r, code);
      if (isLinkedOrSlot(r)) {
        const k = modRows().findIndex((x) => x.key === r.key);
        voyMsg.show(k >= 0 ? routeSay(r, k + 1) : `DESTINATION ${destName(code)}`, 2000);
      } else voyMsg.show(`DESTINATION ${destName(code)}`, 1600);
    },
  });
}

/* ---------------- SQ : le sequenceur de la page SEQ, en petit ---------------- */

/** La rangee de valeurs montree : GATE, RATCHET ou CHANCE (gardee entre deux ouvertures). */
let sqRow: Extract<StepTrack, 'gate' | 'rat' | 'prob'> = 'gate';
const SQ_KEYS: readonly { id: 'gate' | 'rat' | 'prob'; name: string }[] = [
  { id: 'gate', name: 'GATE' },
  { id: 'rat', name: 'RATCHET' },
  { id: 'prob', name: 'CHANCE' },
];
const DEF: Record<StepTrack, number> = { acc: 1, slide: 0, gate: 1, rat: 1, prob: 100 };
const LB = { u0: CL, u1: CL + 2.36 } as const;
const LC = (LB.u0 + LB.u1) / 2;
const G = { lab: LB.u1 + 0.16, c0: LB.u1 + 1.72, c1: CR - 0.06 } as const;
const GAP = 0.12;
const PITCH = (G.c1 - G.c0 - 3 * GAP) / STEPS_N;
const cx = (i: number): number => G.c0 + i * PITCH + Math.floor(i / 4) * GAP + PITCH / 2;
const CWID = PITCH - 0.05;
const ROW = { num: 0.12, led: 0.255, note: 0.47, acc: 0.71, slide: 0.95, val: 1.2, foot: 1.44 } as const;
const SQ_LEFT = { steps: LC - 0.74, rate: LC, swing: LC + 0.74, v: 0.56, keys: 1.3 } as const;
/**
 * NOTE : toute la tessiture sur la course d'un potard (150 px), soit un degre tous les 5 px environ (la page SEQ : un
 * tous les 2.4 px, Mika la trouvait sensible).
 */
const NOTE_SPAN = SEQ_TOP - SEQ_MIN;
const NOTE_MID = (SEQ_MIN + SEQ_TOP) / 2;

function drawSq(c: HTMLCanvasElement): void {
  const P = pen(c);
  const st = arpSteps.get();
  const { chord, notes, len } = chordShown();
  const sq = seq.get();
  const ac = accent50();
  P.text('STEP SEQUENCER', LC, 0.15, 0.062, 700, INK, 0.22);
  P.win(SQ_LEFT.steps, SQ_LEFT.v, 0.5, 0.24, String(len), { cap: 0.075 });
  P.text('STEPS', SQ_LEFT.steps, 0.82, 0.048, 600, INK, 0.14);
  P.text('END', SQ_LEFT.steps, 0.95, 0.034, 700, ac, 0.14);
  P.win(SQ_LEFT.rate, SQ_LEFT.v, 0.62, 0.24, textOf('rate'), { cap: 0.07 });
  P.text('RATE', SQ_LEFT.rate, 0.82, 0.048, 600, INK, 0.14);
  P.text('SWING', SQ_LEFT.swing, 0.82, 0.048, 600, INK, 0.14);
  P.text(sq.edit ? 'YOUR NOTES' : 'FROM THE KNOBS', LC, 0.95 + 0.0, 0.032, 700, FAINT, 0.12);
  P.vline(LB.u1 + 0.06, 0.12, GD - 0.12);
  const lr = G.c0 - 0.14;
  P.text('STEP', lr, ROW.led, 0.04, 700, DIM, 0.14, 'right');
  P.text('NOTE', lr, ROW.note, 0.046, 700, INK, 0.14, 'right');
  P.text('ACCENT', lr, ROW.acc, 0.046, 700, INK, 0.14, 'right');
  P.text('SLIDE', lr, ROW.slide, 0.046, 700, INK, 0.14, 'right');
  const row = sqRow;
  const legend = row === 'gate' ? 'SHORT · NORMAL · LONG · TIE' : row === 'rat' ? 'x1 · x2 · x3 · x4 HITS PER STEP' : '100 · 75 · 50 · 25 · 0 %';
  P.text(legend, G.lab + 0.02, ROW.foot, 0.034, 700, FAINT, 0.12, 'left');
  P.text('CLICK: ON / OFF · DRAG UP / DOWN: VALUE', G.c1, ROW.foot, 0.03, 700, FAINT, 0.12, 'right');
  for (let i = 0; i < STEPS_N; i += 1) {
    const u = cx(i);
    const live = i < len;
    P.text(String(i + 1), u, ROW.num, 0.034, 700, live ? DIM : 'rgba(238, 234, 226, 0.22)', 0.04);
    P.led(u, ROW.led, 0.032);
    P.g.globalAlpha = live ? 1 : 0.3;
    const d: SeqStep = i < notes.length ? (notes[i] ?? null) : sq.edit ? (sq.buf[i] ?? null) : notes.length ? (notes[i % notes.length] ?? null) : 0;
    P.win(u, ROW.note, CWID, 0.19, d === null ? 'REST' : noteName(chord, d), { arrows: false, cap: 0.044, off: d === null });
    const acc = st.acc[i] ?? DEF.acc;
    P.box(u, ROW.acc, CWID * 0.62, 0.15, acc === 2 ? rgba(ac, 0.92) : 'rgba(0,0,0,0.35)', acc === 2 ? ac : 'rgba(238, 234, 226, 0.32)');
    if (acc === 0) P.text('SOFT', u, ROW.acc + 0.003, 0.026, 700, DIM, 0.06);
    const sl = st.slide[i] ?? DEF.slide;
    P.box(u, ROW.slide, CWID * 0.62, 0.15, sl ? 'rgba(238, 234, 226, 0.85)' : 'rgba(0,0,0,0.35)', sl ? 'rgba(238, 234, 226, 0.9)' : 'rgba(238, 234, 226, 0.32)');
    const val = st[row][i] ?? DEF[row];
    const name = stepName(row, val).replace(' %', '%');
    P.win(u, ROW.val, CWID, 0.19, name, { arrows: false, cap: name.length > 5 ? 0.034 : 0.04, col: val === DEF[row] ? 'rgba(236, 232, 224, 0.4)' : '#f3efe7' });
    P.g.globalAlpha = 1;
  }
  // END : un trait a l'accent apres le dernier pas joue
  if (len < STEPS_N) {
    const ue = cx(len - 1) + PITCH / 2 + (len % 4 === 0 ? GAP / 2 : 0);
    P.g.fillStyle = ac;
    P.g.fillRect(px(ue) - 3, py(ROW.led - 0.04), 6, py(ROW.val + 0.12) - py(ROW.led - 0.04));
    P.text('END', ue + 0.03, ROW.num, 0.034, 800, ac, 0.12, 'left');
  }
}

const sqKey = (): string => {
  const { chord, notes, len } = chordShown();
  // v52 : la tonalite (les noms des notes en dependent)
  return JSON.stringify([arpSteps.get(), notes, len, chord, seq.get().edit, sqRow, textOf('rate'), accent50(), keyName()]);
};

/** La tete de la page SQ : le voile de la colonne qui joue (et le cadre de sa NOTE), la LED allumee. */
function sqHead(y: number): Page50['head'] {
  const vh = ROW.val + 0.14 - (ROW.note - 0.14);
  const vw = PITCH - 0.02;
  const mk = (w: number, h: number, draw: (g: CanvasRenderingContext2D, cw: number, ch: number) => void): { mesh: Mesh; redraw: () => void; dispose: () => void } => {
    const c = document.createElement('canvas');
    c.width = Math.round(w * 600);
    c.height = Math.round(h * 600);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
    const geo = new PlaneGeometry(w, h);
    geo.rotateX(-Math.PI / 2);
    const mesh = new Mesh(geo, mat);
    mesh.renderOrder = 6;
    mesh.visible = false;
    const redraw = (): void => {
      const g = c.getContext('2d')!;
      g.clearRect(0, 0, c.width, c.height);
      draw(g, c.width, c.height);
      tex.needsUpdate = true;
    };
    redraw();
    return { mesh, redraw, dispose: () => (geo.dispose(), mat.dispose(), tex.dispose()) };
  };
  const veil = mk(vw, vh, (g, w, h) => {
    const a = accent50();
    rr(g, 4, 4, w - 8, h - 8, 18);
    g.fillStyle = rgba(a, 0.14);
    g.fill();
    // le cadre de la NOTE qui joue
    const k = w / vw;
    const nw = CWID * k;
    rr(g, (w - nw) / 2, (0.14 - 0.095) * k, nw, 0.19 * k, 8);
    g.strokeStyle = a;
    g.lineWidth = 5;
    g.stroke();
  });
  // la LED allumee (la lentille des LED du plugin, voyager/ledLens.ts), a l'accent, son halo d'avant
  const led = mk(0.2, 0.2, (g, w, h) => paintLed(g, w / 2, h / 2, 0.032 * (w / 0.2), accent50(), { ring: 1.16, halo: LED_HALO_50 }));
  let lastAt = -2;
  let lastAccent = accent50();
  return {
    meshes: [veil.mesh, led.mesh],
    update: () => {
      const h = arpExternal.headState;
      const { len } = chordShown();
      const pos = h.playing && h.pos >= 0 ? h.pos % STEPS_N : -1;
      const a = accent50();
      if (a !== lastAccent) {
        lastAccent = a;
        veil.redraw();
        led.redraw();
      }
      const shown = pos >= 0 && pos < len ? pos : -1;
      if (shown === lastAt) return false;
      lastAt = shown;
      veil.mesh.visible = led.mesh.visible = shown >= 0;
      if (shown >= 0) {
        const p = at(cx(shown), (ROW.note - 0.14 + ROW.val + 0.14) / 2);
        veil.mesh.position.set(p.x, y + 0.002, p.z);
        const q = at(cx(shown), ROW.led);
        led.mesh.position.set(q.x, y + 0.003, q.z);
      }
      return true;
    },
    dispose: () => {
      veil.dispose();
      led.dispose();
    },
  };
}

export function sqPage50(y: number): Page50 {
  const { tex, redraw } = pageOf(drawSq, sqKey);
  const place: Place50[] = [];
  const hits: Hit50[] = [];
  const sw = at(SQ_LEFT.swing, SQ_LEFT.v);
  place.push({ k: 'k3', ...sw, R: 0.17, v: () => valOf('xSwing'), arcs: [{ id: 'xSwing', live: () => true }] });
  hits.push({ id: 'ved-sq-swing', dial: `${ED}xSwing`, shape: 'disc', ...sw, hx: 0.2, hz: 0.2 });
  hits.push({ id: 'ved-sq-len', dial: `${ED}sq:len`, shape: 'box', ...at(SQ_LEFT.steps, SQ_LEFT.v), hx: 0.26, hz: 0.13 });
  hits.push({ id: 'ved-sq-rate', dial: `${ED}sq:rate`, shape: 'box', ...at(SQ_LEFT.rate, SQ_LEFT.v), hx: 0.32, hz: 0.13 });
  for (const [k, label, du] of [
    ['rnd', 'RANDOM', -0.45],
    ['clr', 'CLEAR', 0.45],
  ] as const) {
    const p = at(LC + du, SQ_LEFT.keys);
    place.push({ k: 'key', ...p, w: 0.74, d: 0.22, label, on: () => false });
    hits.push({ id: `ved-sq-${k}`, dial: `${ED}sq:${k}`, shape: 'box', ...p, hx: 0.39, hz: 0.13 });
  }
  SQ_KEYS.forEach((k, i) => {
    const p = at(G.lab + 0.27 + i * 0.5, ROW.val);
    place.push({ k: 'key', ...p, w: 0.47, d: 0.19, label: k.name, on: () => sqRow === k.id, cap: 0.036 });
    hits.push({ id: `ved-sq-row-${k.id}`, dial: `${ED}sq:row:${k.id}`, shape: 'box', ...p, hx: 0.25, hz: 0.11 });
  });
  for (let i = 0; i < STEPS_N; i += 1) {
    const live = (): boolean => i < chordShown().len;
    for (const [lane, v] of [
      ['note', ROW.note],
      ['acc', ROW.acc],
      ['slide', ROW.slide],
      ['val', ROW.val],
    ] as const)
      hits.push({ id: `ved-sq-${lane}-${i}`, dial: `${ED}sq:${lane}:${i}`, shape: 'box', ...at(cx(i), v), hx: CWID / 2, hz: 0.11, live });
  }
  return { tex, place, hits, redraw, head: sqHead(y) };
}

/* ---------------- les gestes de la page SQ ---------------- */

/** Le silence d'un pas : la note d'avant, rendue au clic suivant. */
const restMem: (number | null)[] = [];
const noteOf = (i: number): SeqStep => {
  const { notes } = chordShown();
  return i < notes.length ? (notes[i] ?? null) : null;
};
const noteV = (d: number): number => 0.5 + (d - NOTE_MID) / NOTE_SPAN;
const sayNote = (i: number): void => {
  const { chord } = chordShown();
  const d = noteOf(i);
  voyMsg.show(`STEP ${i + 1} ${d === null ? 'REST' : noteName(chord, d)}`, 1600);
};
const levelOf = (t: StepTrack, i: number): number => {
  const lv = LEVELS[t];
  return Math.max(0, lv.indexOf(arpSteps.get()[t][i] ?? DEF[t])) / Math.max(1, lv.length - 1);
};
const putLevel = (t: StepTrack, i: number, v: number): void => {
  const lv = LEVELS[t];
  const x = lv[Math.round(Math.min(1, Math.max(0, v)) * (lv.length - 1))];
  if (arpSteps.set(t, i, x) && x !== DEF[t]) lastOn[t] = x;
  voyMsg.show(`STEP ${i + 1} ${STEP_LABEL[t]} ${stepName(t, x)}`, 1600);
};
const STEP_LABEL: Record<StepTrack, string> = { acc: 'ACCENT', slide: 'SLIDE', gate: 'GATE', rat: 'RATCHET', prob: 'CHANCE' };
const toggleTrack = (t: StepTrack, i: number): void => {
  const v = arpSteps.get()[t][i] ?? DEF[t];
  const x = v === DEF[t] ? lastOn[t] : DEF[t];
  arpSteps.set(t, i, x);
  voyMsg.show(`STEP ${i + 1} ${STEP_LABEL[t]} ${stepName(t, x)}`, 1600);
};

spec(`${ED}xSwing`, {
  value: () => valOf('xSwing'),
  set: (v) => {
    setVal('xSwing', Math.min(1, Math.max(0, v)));
    voyMsg.show(`SWING ${textOf('xSwing')}`, 1800);
  },
  text: (v) => textOf('xSwing', v),
  reset: () => arpExtra.def('xSwing'),
  say: (v) => `SWING ${textOf('xSwing', v)}`,
});
spec(`${ED}sq:len`, {
  value: () => (chordShown().len - 1) / (STEPS_N - 1),
  set: (v) => {
    const n = 1 + Math.round(Math.min(1, Math.max(0, v)) * (STEPS_N - 1));
    seq.setLen(chordShown().chord, n);
    voyMsg.show(`STEPS ${n}`, 1400);
  },
  text: () => String(chordShown().len),
});
spec(`${ED}sq:rate`, {
  value: () => voyParams.of('rate'),
  set: (v) => {
    setSnap('rate', v);
    voyMsg.show(`RATE ${textOf('rate')}`, 1400);
  },
  text: (v) => textOf('rate', v),
});
for (const k of ['rnd', 'clr'] as const) spec(`${ED}sq:${k}`, { value: () => 0, set: noop, text: () => (k === 'rnd' ? 'RANDOM' : 'CLEAR') });
for (const k of SQ_KEYS) spec(`${ED}sq:row:${k.id}`, { value: () => (sqRow === k.id ? 1 : 0), set: noop, text: () => k.name });
for (let i = 0; i < STEPS_N; i += 1) {
  spec(`${ED}sq:note:${i}`, {
    value: () => {
      const d = noteOf(i);
      return noteV(d ?? restMem[i] ?? knobNote(chordShown().chord, i));
    },
    set: (v) => {
      const d = Math.max(SEQ_MIN, Math.min(SEQ_TOP, Math.round(NOTE_MID + (v - 0.5) * NOTE_SPAN)));
      seq.setStep(chordShown().chord, i, d);
      sayNote(i);
    },
    text: () => {
      const d = noteOf(i);
      return d === null ? 'REST' : noteName(chordShown().chord, d);
    },
  });
  for (const t of ['acc', 'slide'] as const)
    spec(`${ED}sq:${t}:${i}`, {
      value: () => levelOf(t, i),
      set: (v) => putLevel(t, i, v),
      text: () => stepName(t, arpSteps.get()[t][i] ?? DEF[t]),
    });
  spec(`${ED}sq:val:${i}`, {
    value: () => levelOf(sqRow, i),
    set: (v) => putLevel(sqRow, i, v),
    text: () => stepName(sqRow, arpSteps.get()[sqRow][i] ?? DEF[sqRow]),
  });
}

/** RANDOM de SQ : un hasard doux sur ce que la page montre (les notes, ACCENT, SLIDE, la rangee de valeurs). */
function sqRandom(): void {
  const { chord, len } = chordShown();
  randomNotes(chord);
  const st = arpSteps.plain();
  for (const t of ['acc', 'slide', sqRow] as const) st[t] = st[t].map((v, j) => (j < len ? SOFT_RANDOM[t](Math.random()) : v));
  arpSteps.load(st);
  voyMsg.show('SQ RANDOM', 1400);
}
/** CLEAR de SQ : les notes reviennent aux potards, toutes les pistes au neutre. */
function sqClear(): void {
  seq.auto();
  arpSteps.reset();
  voyMsg.show('SQ CLEAR', 1400);
}

/* ---------------- le clic (hellKnob.tsx faceDbl, par faceExtras.tsx encartTap) ---------------- */

/** Le clic d'une piece des pages LFO et SQ ; false : pas une des leurs. */
export function tap50(dial: string): boolean {
  if (!dial.startsWith(ED)) return false;
  const d = dial.slice(ED.length);
  let m = /^lfo:(\d):(speed|shape|sync)$/.exec(d);
  if (m) {
    const l = LFOS[Number(m[1]) - 1];
    if (!l) return false;
    if (m[2] === 'sync') {
      setVal(l.syncId, l.sync() ? 0 : 1);
      voyMsg.show(`LFO ${l.n} ${l.sync() ? 'SYNC' : 'FREE'} · SPEED ${l.rateText()}`, 2000);
    }
    return true;
  }
  m = /^mx:(src|dst|amt|aim):(\d)$/.exec(d);
  if (m) {
    const p = Number(m[2]);
    const r = modView.rowAt(p);
    if (!r) return true;
    if (m[1] === 'src') openSource(p);
    else if (m[1] === 'dst') openDest(p);
    else if (m[1] === 'aim') modAim.toggle(r);
    return true;
  }
  if (d === 'mx:prev' || d === 'mx:next') {
    modView.setPage(modView.page() + (d === 'mx:next' ? 1 : -1));
    return true;
  }
  m = /^sq:(note|acc|slide|val):(\d+)$/.exec(d);
  if (m) {
    const i = Number(m[2]);
    if (i >= chordShown().len) return true;
    if (m[1] === 'note') {
      const { chord } = chordShown();
      const cur = noteOf(i);
      if (cur === null) seq.setStep(chord, i, restMem[i] ?? knobNote(chord, i));
      else {
        restMem[i] = cur;
        seq.setStep(chord, i, null);
      }
      sayNote(i);
    } else toggleTrack(m[1] === 'val' ? sqRow : (m[1] as 'acc' | 'slide'), i);
    return true;
  }
  m = /^sq:row:(gate|rat|prob)$/.exec(d);
  if (m) {
    sqRow = m[1] as typeof sqRow;
    modView.touch();
    voyMsg.show(`SQ ${SQ_KEYS.find((k) => k.id === sqRow)?.name ?? ''}`, 1200);
    return true;
  }
  if (d === 'sq:rnd') {
    sqRandom();
    return true;
  }
  if (d === 'sq:clr') {
    sqClear();
    return true;
  }
  if (d === 'sq:len') {
    const { chord, len } = chordShown();
    modMenu.open({ kind: 'list', anchor: 'ved-sq-len', title: 'STEPS', cols: 4, items: Array.from({ length: STEPS_N }, (_, k) => ({ label: String(k + 1), on: k + 1 === len, pick: () => (seq.setLen(chord, k + 1), voyMsg.show(`STEPS ${k + 1}`, 1400)) })) });
    return true;
  }
  if (d === 'sq:rate') {
    const cur = stepAt('rate');
    modMenu.open({ kind: 'list', anchor: 'ved-sq-rate', title: 'RATE', cols: 1, items: RATES.map((s, k) => ({ label: s, on: k === cur, pick: () => (setVal('rate', k / (RATES.length - 1)), voyMsg.show(`RATE ${s}`, 1400)) })) });
    return true;
  }
  if (d === 'xSwing') return true;
  return false;
}

/** Les reglages que vise une piece de l'encart (le viseur) : la vitesse d'un LFO ; null : aucun. */
export function aimParamOf50(dial: string): string | null {
  const m = /^z:ed:lfo:(\d):(speed|shape)$/.exec(dial);
  if (!m) return dial === `${ED}xSwing` ? 'xSwing' : null;
  const l = LFOS[Number(m[1]) - 1];
  return l ? (m[2] === 'speed' ? l.speedId() : l.shapeId) : null;
}

/** Les toiles suivent aussi le choix de CHORD de la page SEQ (seqEdit.ts) et la progression. */
export const sqSources = [notesViewStore.subscribe, arp.subscribe, seq.subscribe, arpSteps.subscribe] as const;

/* ---------------- les touches mates a LED de la barre C (pages2.css .mm-nv-key), en 3D ---------------- */

function keyShape(w: number, d: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r);
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d);
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Le dessus d'une touche : le caoutchouc mat, la LED a gauche (a l'accent quand elle est allumee), le nom grave. */
function keyTop(w: number, d: number, label: string, on: boolean, cap: number): CanvasTexture {
  const S = 1100;
  const c = document.createElement('canvas');
  c.width = Math.round(w * S);
  c.height = Math.round(d * S);
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, c.height);
  gr.addColorStop(0, on ? '#2a2826' : '#22201f');
  gr.addColorStop(1, on ? '#1e1c1b' : '#181716');
  g.fillStyle = gr;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(255, 250, 240, 0.06)';
  g.fillRect(0, 0, c.width, 3);
  const lx = 0.085 * S;
  const ly = c.height / 2;
  const R = 0.024 * S;
  // 2026-11-24 (Mika) : eteinte, le verre clair et neutre ; allumee, l'accent et son halo d'avant (voyager/ledLens.ts)
  paintLed(g, lx, ly, R, on ? accent50() : null, { ring: 1.16, halo: LED_HALO_50 });
  g.font = `700 ${Math.round(cap * S * 1.38)}px ${FONT_DISPLAY}`;
  (g as unknown as { letterSpacing: string }).letterSpacing = `${(cap * S * 0.14).toFixed(1)}px`;
  g.fillStyle = on ? '#fff8ee' : 'rgba(240, 234, 224, 0.6)';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(label, lx + R + 0.04 * S, ly + 1);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  // les uv du dessus d'une ExtrudeGeometry : les coordonnees de la forme (-w/2..w/2, -d/2..d/2)
  t.repeat.set(1 / w, 1 / d);
  t.offset.set(0.5, 0.5);
  return t;
}

export interface Key50 {
  mesh: Mesh;
  set: (on: boolean) => void;
  dispose: () => void;
}
let sideMat: MeshStandardMaterial | null = null;
/** Une touche de la bascule ou de la page SQ (repere de son parent ; y : le dessus du plan). */
export function key50(w: number, d: number, label: string, cap = 0.046): Key50 {
  sideMat ??= new MeshStandardMaterial({ color: '#151413', roughness: 0.6, metalness: 0.05 });
  const geo = new ExtrudeGeometry(keyShape(w, d, Math.min(0.08, d * 0.42)), { depth: 0.055, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 16 });
  geo.rotateX(-Math.PI / 2);
  let acc = accent50();
  let tOn = keyTop(w, d, label, true, cap);
  const tOff = keyTop(w, d, label, false, cap);
  const mOn = new MeshBasicMaterial({ map: tOn, toneMapped: false });
  const mOff = new MeshBasicMaterial({ map: tOff, toneMapped: false });
  const mesh = new Mesh(geo, [mOff, sideMat]);
  mesh.castShadow = true;
  return {
    mesh,
    set: (on) => {
      // la couleur d'accent a change (SETTINGS) : la LED allumee se redessine
      if (on && accent50() !== acc) {
        acc = accent50();
        tOn.dispose();
        tOn = keyTop(w, d, label, true, cap);
        mOn.map = tOn;
        mOn.needsUpdate = true;
      }
      (mesh.material as [MeshBasicMaterial, MeshStandardMaterial])[0] = on ? mOn : mOff;
    },
    dispose: () => {
      geo.dispose();
      tOn.dispose();
      tOff.dispose();
      mOn.dispose();
      mOff.dispose();
    },
  };
}
