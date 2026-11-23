/**
 * v50 : MAQUETTE (2026-11-23, Mika : "je voudrais que tous les LFO tu les mettes dans la partie du bas EDIT, fais un
 * classement et du rangement, je veux que les LFO puissent etre assignables partout dans le plugin avec un target" ;
 * "SQ c'est le sequenceur ... la meme chose que dans la page sequenceur mais en plus simple et plus petit").
 *
 * Derriere le drapeau ?mq50 (theme/base.ts MQ50), le plugin seul : sans lui, rien de ce fichier ne s'affiche et la face
 * reste celle de la v49. Ce sont des images pour choisir, pas la livraison : aucune piece ne prend de geste (sauf la
 * bascule des pages), aucun reglage hote nouveau, le C++ ne sait rien.
 *
 * Le classement (commun aux trois options) :
 * - LFO 1 a LFO 4, generiques : LFO 1 = l'ancien MOD de la face, LFO 2 = LFO 2, LFO 3 = l'ancien DISTO LFO, LFO 4 = nouveau ;
 *   chacun SPEED, SHAPE, un levier FREE / SYNC, une petite vue de sa forme ;
 * - FX MOD garde PHASER, FLANGER, CHORUS, PUMP et y gagne HELL WARP / SPIN (faceExtras.tsx) ;
 * - la section MOD quitte la face (voyager/params.ts, voyager/theme.ts) ;
 * - les cibles : tout reglage continu, choisi au viseur (le clic sur le viseur allume les potards de la face, l'ecran dit
 *   CLICK A KNOB > LFO 1) ; les sources de la matrice : LFO 1-4, MOD WHEEL, VELOCITY, RANDOM.
 * Les options : A (?mq50=A) pages separees LFO | MOD ; B (?mq50=B) chaque LFO et ses deux cibles ; C (?mq50=C) les LFO et
 * la matrice sur une page ; SQ (?mq50=SQ) la page SQ (commune) ; aim (?mq50=aim) C pendant une assignation.
 */

import React, { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  ExtrudeGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  Shape,
  Vector3,
  type Group,
} from 'three';
import type { Stage } from '../../scene/renderer';
import { voyExplode } from '../../state/explode';
import { FONT_DISPLAY, MQ50 } from '../../theme';
import { PLUGIN_ACCENT } from '../../theme/base';
import { arpExternal } from '../../voyager/arp';
import { degreeMidi, degreeName } from '../../voyager/chords';
import { FLUTED_DIALS } from '../../voyager/knobs';
import { voyMsg } from '../../voyager/msg';
import { VOY_FACE_KNOBS, voyKnob, voyParams, voyValueText, type VoyKnobId } from '../../voyager/params';
import { seq, SEQ_MAX } from '../../voyager/seq';
import { VOY_SEQ } from '../../voyager/seqscreen';
import { isPush, VOY_DS_PLACE, VOY_HELL_PLACE, VOY_KNOB, voyKnobPlace } from '../../voyager/theme';
import { arpExtra, extraParam, isExtra } from './extra';
import { arpSteps, stepName, STEPS_N, type StepTrack } from './steps';

/** L'option montree : A, B ou C (SQ et aim : la bascule de C). */
export const MQ_OPT: 'A' | 'B' | 'C' | null = MQ50 === null ? null : MQ50 === 'A' ? 'A' : MQ50 === 'B' ? 'B' : 'C';
export type MqTab = { id: string; name: string };
/** La bascule de l'encart : A a une page MOD (la matrice) ; B et C non. */
export const MQ_TABS: readonly MqTab[] =
  MQ_OPT === 'A'
    ? [
        { id: 'synth', name: 'SYNTH' },
        { id: 'lfo', name: 'LFO' },
        { id: 'mod', name: 'MOD' },
        { id: 'sq', name: 'SQ' },
        { id: 'fxmod', name: 'FX MOD' },
      ]
    : [
        { id: 'synth', name: 'SYNTH' },
        { id: 'lfo', name: 'LFO' },
        { id: 'sq', name: 'SQ' },
        { id: 'fxmod', name: 'FX MOD' },
      ];
/** La page montree a l'ouverture d'EDIT. */
export const MQ_FIRST: string = MQ50 === 'SQ' ? 'sq' : 'lfo';

/* ---------------- la geometrie de l'encart ---------------- */

const GW = VOY_SEQ.w - 2 * VOY_SEQ.bezel;
const GD = VOY_SEQ.d - 2 * VOY_SEQ.bezel;
const X0 = VOY_SEQ.x - GW / 2;
const Z0 = VOY_SEQ.z - GD / 2;
/** La bascule : sa colonne (unites depuis le bord gauche du verre), ses touches, le trait qui la separe de la page. */
const TAB = { u: 0.43, w: 0.62, d: 0.2, sep: 0.86 } as const;
/** Les touches de la bascule et le trait (repere du plateau), pour faceExtras.tsx. */
export function mqTabs(): { x: number; z: number[]; sep: number; w: number; d: number } {
  const n = MQ_TABS.length;
  const pitch = n >= 5 ? 0.3 : 0.36;
  const v0 = (GD - pitch * (n - 1)) / 2;
  return { x: X0 + TAB.u, z: MQ_TABS.map((_, i) => Z0 + v0 + i * pitch), sep: X0 + TAB.sep, w: TAB.w, d: TAB.d };
}
const CL = TAB.sep + 0.08;
const CR = GW - 0.06;

/* ---------------- les couleurs (celles de l'encart, de la barre C, des fenetres des pages d'OPEN) ---------------- */

const INK = 'rgba(238, 234, 226, 0.92)';
const DIM = 'rgba(238, 234, 226, 0.55)';
const FAINT = 'rgba(238, 234, 226, 0.32)';
const RULE = 'rgba(255, 250, 240, 0.14)';
export const mqAccent = (): string => {
  if (typeof document === 'undefined') return PLUGIN_ACCENT;
  const a = getComputedStyle(document.documentElement).getPropertyValue('--mm-accent').trim();
  return /^#[0-9a-f]{6}$/i.test(a) ? a : PLUGIN_ACCENT;
};
const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/* ---------------- le panneau et ses aides de dessin (unites : u depuis le bord gauche du verre, v depuis le haut) ---------------- */

interface Pen {
  g: CanvasRenderingContext2D;
  c: HTMLCanvasElement;
  U: number;
  px: (u: number) => number;
  py: (v: number) => number;
  text: (s: string, u: number, v: number, cap: number, weight: number, col: string, spacing?: number, align?: CanvasTextAlign) => void;
  vline: (u: number, va: number, vb: number, a?: number) => void;
  win: (u: number, v: number, w: number, h: number, label: string, o?: { off?: boolean; arrows?: boolean; lit?: boolean; cap?: number; col?: string }) => void;
  cross: (u: number, v: number, r: number, lit?: boolean) => void;
  badge: (u: number, v: number, s: string) => void;
  led: (u: number, v: number, r: number, on: boolean) => void;
  box: (u: number, v: number, w: number, h: number, fill: string | null, stroke: string, lw?: number) => void;
  frame: (u0: number, v0: number, w: number, h: number, a?: number) => void;
  wave: (u0: number, v0: number, w: number, h: number, shape: string, o?: { tl?: string; tr?: string; bl?: string; phase?: number }) => void;
  finish: () => CanvasTexture;
}

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

/** Les formes des LFO : une valeur -1..1 pour une phase 0..1. */
const SH = [0.62, -0.34, 0.9, -0.72, 0.18, -0.9, 0.5, -0.12];
function waveAt(shape: string, p: number): number {
  const f = p - Math.floor(p);
  switch (shape) {
    case 'SINE':
    case 'WOBBLE':
      return Math.sin(2 * Math.PI * f);
    case 'TRI':
    case 'BEND':
      return 1 - 4 * Math.abs(f - 0.5);
    case 'SAW':
      return 1 - 2 * f;
    case 'RAMP':
      return 2 * f - 1;
    case 'SQR':
    case 'SQUARE':
      return f < 0.5 ? 0.85 : -0.85;
    case 'S&H':
      return SH[Math.floor(p * 4) % SH.length];
    default: {
      // RND, RANDOM : un hasard lisse
      const k = p * 3;
      const i = Math.floor(k);
      const t = k - i;
      const a = SH[i % SH.length];
      const b = SH[(i + 1) % SH.length];
      return a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * t));
    }
  }
}

function pen(): Pen {
  const W = 4096;
  const H = Math.round((W * GD) / GW);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const U = W / GW;
  const px = (u: number): number => u * U;
  const py = (v: number): number => (v / GD) * H;
  // le panneau de l'encart (faceExtras.tsx encPanel) : un noir anodise, un rien plus clair en haut, son grain, son lisere
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
  const text: Pen['text'] = (s, u, v, cap, weight, col, spacing = 0.18, align = 'center') => {
    g.font = `${weight} ${Math.round(cap * U * 1.38)}px ${FONT_DISPLAY}`;
    (g as unknown as { letterSpacing: string }).letterSpacing = `${(cap * U * spacing).toFixed(1)}px`;
    g.fillStyle = col;
    g.textAlign = align;
    g.textBaseline = 'middle';
    // l'espacement s'ajoute apres la derniere lettre : un texte centre se recale d'une demi-espace
    const dx = align === 'center' ? (cap * U * spacing) / 2 : align === 'right' ? cap * U * spacing : 0;
    g.fillText(s, px(u) + dx, py(v));
  };
  const vline: Pen['vline'] = (u, va, vb, a = 0.14) => {
    g.fillStyle = `rgba(255, 250, 240, ${a})`;
    g.fillRect(px(u) - 2, py(va), 4, py(vb) - py(va));
  };
  const box: Pen['box'] = (u, v, w, h, fill, stroke, lw = 3) => {
    rr(g, px(u - w / 2), py(v - h / 2), w * U, py(h) - py(0), Math.min(10, w * U * 0.08));
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  };
  const frame: Pen['frame'] = (u0, v0, w, h, a = 0.09) => {
    rr(g, px(u0), py(v0), w * U, py(h) - py(0), 12);
    g.strokeStyle = `rgba(255, 250, 240, ${a})`;
    g.lineWidth = 3;
    g.stroke();
  };
  /** Une fenetre de verre noir (pcbui.tsx PcbSelect, hood.css .mm-p2-win) : sa valeur, les fleches du menu a droite. */
  const win: Pen['win'] = (u, v, w, h, label, o = {}) => {
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
    // l'ombre interieure du haut
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
    g.strokeStyle = o.lit ? mqAccent() : '#2c2e31';
    g.lineWidth = o.lit ? 4 : 3;
    g.stroke();
    const arrows = o.arrows !== false;
    const cap = o.cap ?? 0.06;
    const aw = arrows ? 0.13 : 0;
    text(label, u - aw / 2, v + 0.004, cap, 600, o.col ?? (o.off ? 'rgba(236, 232, 224, 0.4)' : '#f3efe7'), 0.06);
    if (arrows) {
      const ax = px(u + w / 2 - 0.075);
      const ay = py(v);
      const s = 0.024 * U;
      g.fillStyle = 'rgba(236, 232, 224, 0.55)';
      g.beginPath();
      g.moveTo(ax - s, ay - s * 0.35);
      g.lineTo(ax + s, ay - s * 0.35);
      g.lineTo(ax, ay - s * 1.45);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(ax - s, ay + s * 0.35);
      g.lineTo(ax + s, ay + s * 0.35);
      g.lineTo(ax, ay + s * 1.45);
      g.closePath();
      g.fill();
    }
  };
  /** Le viseur : un cercle, quatre traits qui en sortent, un point au centre ; allume a l'accent pendant l'assignation. */
  const cross: Pen['cross'] = (u, v, r, lit = false) => {
    const x = px(u);
    const y = py(v);
    const R = r * U;
    const col = lit ? mqAccent() : 'rgba(238, 234, 226, 0.78)';
    if (lit) {
      const glow = g.createRadialGradient(x, y, 0, x, y, R * 2.4);
      glow.addColorStop(0, rgba(mqAccent(), 0.45));
      glow.addColorStop(1, rgba(mqAccent(), 0));
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
  /** Le numero d'un emplacement (#1) : une etiquette claire, le chiffre en noir. */
  const badge: Pen['badge'] = (u, v, s) => {
    const w = 0.12 + s.length * 0.052;
    rr(g, px(u - w / 2), py(v - 0.068), w * U, py(0.136) - py(0), 8);
    g.fillStyle = 'rgba(214, 210, 202, 0.82)';
    g.fill();
    text(s, u, v + 0.003, 0.052, 800, '#121212', 0.04);
  };
  const led: Pen['led'] = (u, v, r, on) => {
    const x = px(u);
    const y = py(v);
    const R = r * U;
    if (on) {
      const a = mqAccent();
      const glow = g.createRadialGradient(x, y, 0, x, y, R * 3.6);
      glow.addColorStop(0, rgba(a, 0.55));
      glow.addColorStop(1, rgba(a, 0));
      g.fillStyle = glow;
      g.fillRect(x - R * 3.6, y - R * 3.6, R * 7.2, R * 7.2);
      const c0 = g.createRadialGradient(x - R * 0.3, y - R * 0.35, 0, x, y, R);
      c0.addColorStop(0, '#ffffff');
      c0.addColorStop(0.3, rgba(a, 0.9));
      c0.addColorStop(1, a);
      g.fillStyle = c0;
    } else {
      const c0 = g.createRadialGradient(x - R * 0.3, y - R * 0.35, 0, x, y, R);
      c0.addColorStop(0, 'rgba(255, 210, 200, 0.25)');
      c0.addColorStop(0.35, '#4a1712');
      c0.addColorStop(1, '#2a0b08');
      g.fillStyle = c0;
    }
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#070505';
    g.lineWidth = 2;
    g.stroke();
  };
  /** La petite vue d'un LFO : une fenetre de verre, sa forme sur deux cycles, la forme et la vitesse en petit. */
  const wave: Pen['wave'] = (u0, v0, w, h, shape, o = {}) => {
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
    const top = o.tl || o.tr ? 0.11 : 0;
    const bot = o.bl ? 0.1 : 0;
    const my = py(v0 + top + (h - top - bot) / 2);
    const amp = (py(h - top - bot) - py(0)) * 0.36;
    // le zero, en pointille
    g.strokeStyle = 'rgba(238, 234, 226, 0.1)';
    g.lineWidth = 2;
    g.setLineDash([8, 8]);
    g.beginPath();
    g.moveTo(x + 10, my);
    g.lineTo(x + ww - 10, my);
    g.stroke();
    g.setLineDash([]);
    const x0 = x + 0.06 * U;
    const x1 = x + ww - 0.06 * U;
    const N = 240;
    const pts: [number, number][] = [];
    for (let i = 0; i <= N; i += 1) {
      const p = (2 * i) / N;
      pts.push([x0 + ((x1 - x0) * i) / N, my - amp * waveAt(shape, p)]);
    }
    g.strokeStyle = 'rgba(238, 234, 226, 0.86)';
    g.lineWidth = 4;
    g.lineJoin = 'round';
    g.beginPath();
    pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b)));
    g.stroke();
    // ou en est le LFO : un point a l'accent
    if (o.phase !== undefined) {
      const i = Math.round(o.phase * N);
      const [a, b] = pts[Math.max(0, Math.min(N, i))];
      const ac = mqAccent();
      const glow = g.createRadialGradient(a, b, 0, a, b, 26);
      glow.addColorStop(0, rgba(ac, 0.7));
      glow.addColorStop(1, rgba(ac, 0));
      g.fillStyle = glow;
      g.fillRect(a - 26, b - 26, 52, 52);
      g.fillStyle = ac;
      g.beginPath();
      g.arc(a, b, 7, 0, Math.PI * 2);
      g.fill();
    }
    if (o.tl) text(o.tl, u0 + 0.07, v0 + 0.085, 0.04, 700, DIM, 0.12, 'left');
    if (o.tr) text(o.tr, u0 + w - 0.07, v0 + 0.085, 0.04, 700, INK, 0.08, 'right');
    if (o.bl) text(o.bl, u0 + 0.07, v0 + h - 0.075, 0.036, 700, FAINT, 0.12, 'left');
  };
  // le trait de la bascule
  vline(TAB.sep, 0.12, GD - 0.12);
  const finish = (): CanvasTexture => {
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  };
  return { g, c, U, px, py, text, vline, win, cross, badge, led, box, frame, wave, finish };
}

/* ---------------- les donnees de la maquette ---------------- */

const valOf = (id: string): number => (isExtra(id) ? arpExtra.of(id) : voyParams.of(id as VoyKnobId));
const textOf = (id: string): string => (isExtra(id) ? arpExtra.text(id, arpExtra.of(id)) : voyValueText(id as VoyKnobId, voyParams.of(id as VoyKnobId)));
const stepText = (id: string): string => {
  const steps = isExtra(id) ? extraParam(id)?.steps : voyKnob(id as VoyKnobId).steps;
  if (!steps || steps.length === 0) return textOf(id);
  const i = Math.max(0, Math.min(steps.length - 1, Math.round(valOf(id) * (steps.length - 1))));
  return steps[i];
};

/** Un LFO generique : ses reglages d'aujourd'hui quand il en a (LFO 1 : MOD, LFO 2, LFO 3 : DISTO LFO), une valeur de maquette sinon (LFO 4). */
interface Lfo {
  n: number;
  speed: () => number;
  shape: () => number;
  shapeName: () => string;
  rateText: () => string;
  sync: () => boolean;
  phase: number;
}
const LFOS: readonly Lfo[] = [
  // LFO 1 : l'ancien MOD de la face (toujours cale au tempo : SYNC)
  { n: 1, speed: () => valOf('lfoRate'), shape: () => valOf('lfoShape'), shapeName: () => stepText('lfoShape'), rateText: () => stepText('lfoRate'), sync: () => true, phase: 0.31 },
  // LFO 2 : LFO 2 (cale au tempo)
  { n: 2, speed: () => valOf('xLfo2Rate'), shape: () => valOf('xLfo2Shape'), shapeName: () => stepText('xLfo2Shape'), rateText: () => stepText('xLfo2Rate'), sync: () => true, phase: 0.6 },
  // LFO 3 : l'ancien DISTO LFO (FREE ou SYNC)
  { n: 3, speed: () => valOf('xDLfoRate'), shape: () => valOf('xDLfoShape'), shapeName: () => stepText('xDLfoShape'), rateText: () => textOf('xDLfoRate'), sync: () => valOf('xDLfoSync') >= 0.5, phase: 0.68 },
  // LFO 4 : nouveau (la maquette : S&H, libre, 2.4 Hz)
  { n: 4, speed: () => 0.58, shape: () => 0.83, shapeName: () => 'S&H', rateText: () => '2.4 Hz', sync: () => false, phase: 0.45 },
];

/** Les emplacements de la matrice (A, C) : une source, une cible (le nom du potard, comme sur la face), une quantite (0.5 : rien). */
interface Slot {
  src: string;
  dst: string | null;
  amt: number;
  aim?: boolean;
}
const SLOTS: readonly Slot[] = [
  { src: 'LFO 1', dst: 'CUTOFF', amt: 0.74 },
  { src: 'LFO 2', dst: 'RES', amt: 0.66 },
  { src: 'LFO 3', dst: 'DISTO', amt: 0.3 },
  { src: 'LFO 4', dst: 'HELL', amt: 0.8 },
  MQ50 === 'aim' ? { src: 'LFO 1', dst: null, amt: 0.5, aim: true } : { src: 'VELOCITY', dst: 'ENV AMT', amt: 0.84 },
  { src: 'MOD WHEEL', dst: 'FM', amt: 0.62 },
  { src: 'OFF', dst: null, amt: 0.5 },
  { src: 'OFF', dst: null, amt: 0.5 },
];
/** B : les deux cibles de chaque LFO. */
const TARGETS: readonly (readonly [Slot, Slot])[] = [
  [
    { src: 'LFO 1', dst: 'CUTOFF', amt: 0.74 },
    { src: 'LFO 1', dst: 'FM', amt: 0.6 },
  ],
  [
    { src: 'LFO 2', dst: 'RES', amt: 0.66 },
    { src: 'LFO 2', dst: null, amt: 0.5 },
  ],
  [
    { src: 'LFO 3', dst: 'DISTO', amt: 0.3 },
    { src: 'LFO 3', dst: 'DELAY', amt: 0.7 },
  ],
  [
    { src: 'LFO 4', dst: 'HELL', amt: 0.8 },
    { src: 'LFO 4', dst: null, amt: 0.5 },
  ],
];

/* ---------------- les pieces posees (repere du plateau) ---------------- */

export type MqPlace =
  | { k: 'k1' | 'k3'; x: number; z: number; R: number; v: () => number }
  | { k: 'lever'; x: number; z: number; s: number; right: () => boolean }
  | { k: 'key'; x: number; z: number; w: number; d: number; label: string; on: () => boolean; cap?: number };
export interface MqPage {
  tex: CanvasTexture;
  place: MqPlace[];
  /** redessine la toile (la tete du sequenceur) ; true si elle a change */
  redraw?: () => boolean;
}
/** Une page dessinee : sa toile, ses pieces. */
type Built = { c: HTMLCanvasElement; place: MqPlace[] };
const at = (u: number, v: number): { x: number; z: number } => ({ x: X0 + u, z: Z0 + v });

/* ---------------- A : la page LFO (les quatre LFO), la page MOD (huit emplacements) ---------------- */

function lfoPageA(): Built {
  const P = pen();
  const place: MqPlace[] = [];
  const cw = (CR - CL) / 4;
  LFOS.forEach((l, i) => {
    const u0 = CL + i * cw;
    P.text(`LFO ${l.n}`, u0 + cw / 2, 0.16, 0.072, 700, INK, 0.24);
    const R = 0.265;
    const v = 0.62;
    const us = u0 + 0.44;
    const uh = u0 + 1.1;
    place.push({ k: 'k1', ...at(us, v), R, v: l.speed }, { k: 'k1', ...at(uh, v), R, v: l.shape });
    P.text('SPEED', us, v + R + 0.095, 0.058, 600, INK, 0.16);
    P.text('SHAPE', uh, v + R + 0.095, 0.058, 600, INK, 0.16);
    // FREE / SYNC sous les deux potards
    const ul = (us + uh) / 2;
    place.push({ k: 'lever', ...at(ul, 1.31), s: 0.8, right: l.sync });
    P.text('FREE', ul - 0.37, 1.31, 0.044, 700, l.sync() ? DIM : INK, 0.1);
    P.text('SYNC', ul + 0.37, 1.31, 0.044, 700, l.sync() ? INK : DIM, 0.1);
    // la vue de la forme
    P.wave(u0 + 1.56, 0.36, cw - 1.7, 1.06, l.shapeName(), { tl: l.shapeName(), tr: l.rateText(), phase: l.phase });
    if (i < 3) P.vline(u0 + cw, 0.12, GD - 0.12);
  });
  return { c: P.c, place };
}

/** Un emplacement de matrice facon image 84 (A) : SOURCE, #n, AMT, DESTINATION, le viseur. */
function slotTall(P: Pen, place: MqPlace[], u0: number, sw: number, n: number, s: Slot): void {
  const mw = sw - 0.16;
  const uc = u0 + sw / 2;
  const off = s.src === 'OFF';
  P.win(uc, 0.27, mw, 0.21, s.src, { off });
  P.text('SOURCE', u0 + 0.09, 0.47, 0.042, 700, DIM, 0.14, 'left');
  P.badge(u0 + 0.21, 0.69, `#${n}`);
  P.text('AMT', u0 + sw - 0.4, 0.69, 0.042, 700, DIM, 0.14, 'right');
  place.push({ k: 'k3', ...at(u0 + sw - 0.2, 0.66), R: 0.15, v: () => s.amt });
  P.win(uc, 1.03, mw, 0.21, s.dst ?? (s.aim ? 'CLICK A KNOB' : '- - -'), { off: !s.dst && !s.aim, lit: s.aim, col: s.aim ? mqAccent() : undefined });
  P.text('DESTINATION', u0 + 0.09, 1.23, 0.042, 700, DIM, 0.14, 'left');
  P.cross(u0 + sw - 0.17, 1.24, 0.072, s.aim);
}

function modPageA(): Built {
  const P = pen();
  const place: MqPlace[] = [];
  const sw = (CR - CL) / 8;
  SLOTS.forEach((s, i) => {
    const u0 = CL + i * sw;
    slotTall(P, place, u0, sw, i + 1, s);
    if (i < 7) P.vline(u0 + sw, 0.12, GD - 0.12);
  });
  return { c: P.c, place };
}

/* ---------------- B : chaque LFO et ses deux cibles ---------------- */

function lfoPageB(): Built {
  const P = pen();
  const place: MqPlace[] = [];
  const cw = (CR - CL) / 4;
  LFOS.forEach((l, i) => {
    const u0 = CL + i * cw;
    P.text(`LFO ${l.n}`, u0 + cw / 2, 0.15, 0.072, 700, INK, 0.24);
    const R = 0.23;
    const v = 0.51;
    const us = u0 + 0.36;
    const uh = u0 + 0.93;
    place.push({ k: 'k1', ...at(us, v), R, v: l.speed }, { k: 'k1', ...at(uh, v), R, v: l.shape });
    P.text('SPEED', us, v + R + 0.085, 0.052, 600, INK, 0.14);
    P.text('SHAPE', uh, v + R + 0.085, 0.052, 600, INK, 0.14);
    const ul = u0 + 1.5;
    place.push({ k: 'lever', ...at(ul, 0.49), s: 0.75, right: l.sync });
    P.text('FREE', ul - 0.14, 0.66, 0.04, 700, l.sync() ? DIM : INK, 0.08);
    P.text('SYNC', ul + 0.14, 0.66, 0.04, 700, l.sync() ? INK : DIM, 0.08);
    P.wave(u0 + 1.88, 0.3, cw - 1.98, 0.5, l.shapeName(), { tl: l.shapeName(), tr: l.rateText(), phase: l.phase });
    // les deux cibles : la fenetre (le nom du potard vise), le viseur, la quantite
    P.text('TARGET', u0 + 0.12, 0.99, 0.04, 700, DIM, 0.14, 'left');
    P.text('AMT', u0 + cw - 0.2, 0.99, 0.04, 700, DIM, 0.14);
    TARGETS[i].forEach((t, j) => {
      const v2 = 1.18 + j * 0.27;
      P.text(String(j + 1), u0 + 0.14, v2, 0.046, 700, DIM, 0.04);
      const m0 = u0 + 0.27;
      const m1 = u0 + cw - 0.68;
      P.win((m0 + m1) / 2, v2, m1 - m0, 0.21, t.dst ?? '- - -', { off: !t.dst });
      P.cross(u0 + cw - 0.5, v2, 0.066);
      place.push({ k: 'k3', ...at(u0 + cw - 0.2, v2), R: 0.115, v: () => t.amt });
    });
    if (i < 3) P.vline(u0 + cw, 0.12, GD - 0.12);
  });
  return { c: P.c, place };
}

/* ---------------- C : les LFO compacts a gauche, la matrice (2 x 4) a droite ---------------- */

function lfoPageC(): Built {
  const P = pen();
  const place: MqPlace[] = [];
  const split = CL + 4.36;
  const cw = (split - CL) / 4;
  LFOS.forEach((l, i) => {
    const u0 = CL + i * cw;
    const uc = u0 + cw / 2;
    P.text(`LFO ${l.n}`, uc, 0.15, 0.062, 700, INK, 0.22);
    P.wave(u0 + 0.08, 0.27, cw - 0.16, 0.31, l.shapeName(), { phase: l.phase });
    const R = 0.19;
    const v = 0.85;
    place.push({ k: 'k1', ...at(uc - 0.26, v), R, v: l.speed }, { k: 'k1', ...at(uc + 0.26, v), R, v: l.shape });
    P.text('SPEED', uc - 0.26, v + R + 0.075, 0.044, 600, INK, 0.1);
    P.text('SHAPE', uc + 0.26, v + R + 0.075, 0.044, 600, INK, 0.1);
    place.push({ k: 'lever', ...at(uc, 1.39), s: 0.66, right: l.sync });
    P.text('FREE', uc - 0.24, 1.39, 0.036, 700, l.sync() ? DIM : INK, 0.06, 'right');
    P.text('SYNC', uc + 0.24, 1.39, 0.036, 700, l.sync() ? INK : DIM, 0.06, 'left');
    if (i < 3) P.vline(u0 + cw, 0.22, GD - 0.12, 0.09);
  });
  P.vline(split + 0.04, 0.12, GD - 0.12);
  // la matrice : huit emplacements, deux rangees de quatre, chacun dans son cadre
  const m0 = split + 0.14;
  const sw = (CR - m0) / 4;
  P.text('MOD MATRIX', (m0 + CR) / 2, 0.15, 0.062, 700, INK, 0.22);
  SLOTS.forEach((s, i) => {
    const u0 = m0 + (i % 4) * sw;
    const v0 = i < 4 ? 0.28 : 0.93;
    P.frame(u0 + 0.04, v0, sw - 0.08, 0.6, s.aim ? 0.0 : 0.09);
    if (s.aim) {
      const a = mqAccent();
      rr(P.g, P.px(u0 + 0.04), P.py(v0), (sw - 0.08) * P.U, P.py(0.6) - P.py(0), 12);
      P.g.strokeStyle = rgba(a, 0.85);
      P.g.lineWidth = 4;
      P.g.stroke();
    }
    P.badge(u0 + 0.21, v0 + 0.16, `#${i + 1}`);
    const a0 = u0 + 0.37;
    const a1 = u0 + sw - 0.44;
    const off = s.src === 'OFF';
    P.win((a0 + a1) / 2, v0 + 0.16, a1 - a0, 0.2, s.src, { off, cap: 0.056 });
    // la fleche de la source a la cible
    P.g.strokeStyle = 'rgba(238, 234, 226, 0.4)';
    P.g.lineWidth = 3;
    P.g.beginPath();
    P.g.moveTo(P.px(u0 + 0.2), P.py(v0 + 0.28));
    P.g.lineTo(P.px(u0 + 0.2), P.py(v0 + 0.44));
    P.g.lineTo(P.px(u0 + 0.3), P.py(v0 + 0.44));
    P.g.stroke();
    P.g.beginPath();
    P.g.moveTo(P.px(u0 + 0.3), P.py(v0 + 0.405));
    P.g.lineTo(P.px(u0 + 0.335), P.py(v0 + 0.44));
    P.g.lineTo(P.px(u0 + 0.3), P.py(v0 + 0.475));
    P.g.stroke();
    P.win((a0 + a1) / 2, v0 + 0.44, a1 - a0, 0.2, s.dst ?? (s.aim ? 'CLICK A KNOB' : '- - -'), { off: !s.dst && !s.aim, lit: s.aim, cap: 0.056, col: s.aim ? mqAccent() : undefined });
    place.push({ k: 'k3', ...at(u0 + sw - 0.23, v0 + 0.17), R: 0.125, v: () => s.amt });
    P.cross(u0 + sw - 0.23, v0 + 0.45, 0.064, s.aim);
  });
  return { c: P.c, place };
}

/* ---------------- SQ : le sequenceur de la page SEQ, en petit ---------------- */

/** La rangee de valeurs : GATE, RATCHET ou CHANCE (trois touches) ; la maquette montre GATE. */
let sqRow: Extract<StepTrack, 'gate' | 'rat' | 'prob'> = 'gate';
const SQ_KEYS: readonly { id: 'gate' | 'rat' | 'prob'; name: string }[] = [
  { id: 'gate', name: 'GATE' },
  { id: 'rat', name: 'RATCHET' },
  { id: 'prob', name: 'CHANCE' },
];
const noteName = (chord: number, d: number): string => `${degreeName(chord, d)}${Math.floor(degreeMidi(chord, d) / 12) - 1}`;
const DEF: Record<StepTrack, number> = { acc: 1, slide: 0, gate: 1, rat: 1, prob: 100 };

function sqPage(): Built {
  const place: MqPlace[] = [];
  // la colonne de gauche : STEPS (END), RATE, SWING ; RANDOM, CLEAR
  const LB = { u0: CL, u1: CL + 2.36 };
  const lc = (LB.u0 + LB.u1) / 2;
  place.push({ k: 'k3', ...at(lc + 0.74, 0.56), R: 0.17, v: () => valOf('xSwing') });
  place.push({ k: 'key', ...at(lc - 0.45, 1.3), w: 0.74, d: 0.22, label: 'RANDOM', on: () => false });
  place.push({ k: 'key', ...at(lc + 0.45, 1.3), w: 0.74, d: 0.22, label: 'CLEAR', on: () => false });
  // la grille
  const G = { lab: LB.u1 + 0.16, c0: LB.u1 + 1.72, c1: CR - 0.06 };
  const gap = 0.12;
  const pitch = (G.c1 - G.c0 - 3 * gap) / STEPS_N;
  const cx = (i: number): number => G.c0 + i * pitch + Math.floor(i / 4) * gap + pitch / 2;
  const cwid = pitch - 0.05;
  const ROW = { num: 0.12, led: 0.255, note: 0.47, acc: 0.71, slide: 0.95, val: 1.2, foot: 1.44 } as const;
  SQ_KEYS.forEach((k, i) => place.push({ k: 'key', ...at(G.lab + 0.27 + i * 0.5, ROW.val), w: 0.47, d: 0.19, label: k.name, on: () => sqRow === k.id, cap: 0.036 }));
  const draw = (): HTMLCanvasElement => {
    const P = pen();
    const st = arpSteps.get();
    const sq = seq.get();
    const h = arpExternal.headState;
    const chord = h.chord >= 0 ? h.chord : 0;
    const len = sq.edit ? sq.len : Math.min(SEQ_MAX, seq.shown(chord).length || 8);
    const notes = seq.shown(chord);
    const head = h.playing && h.pos >= 0 ? h.pos % Math.max(1, len) : -1;
    // la colonne de gauche
    P.text('STEP SEQUENCER', lc, 0.15, 0.062, 700, INK, 0.22);
    P.win(lc - 0.74, 0.56, 0.5, 0.24, String(len), { arrows: true, cap: 0.075 });
    P.text('STEPS', lc - 0.74, 0.82, 0.048, 600, INK, 0.14);
    P.text('END', lc - 0.74, 0.95, 0.034, 700, mqAccent(), 0.14);
    P.win(lc, 0.56, 0.62, 0.24, voyValueText('rate', voyParams.of('rate')), { arrows: true, cap: 0.07 });
    P.text('RATE', lc, 0.82, 0.048, 600, INK, 0.14);
    P.text('SWING', lc + 0.74, 0.82, 0.048, 600, INK, 0.14);
    P.vline(LB.u1 + 0.06, 0.12, GD - 0.12);
    // les noms des rangees
    const lr = G.c0 - 0.14;
    P.text('STEP', lr, ROW.led, 0.04, 700, DIM, 0.14, 'right');
    P.text('NOTE', lr, ROW.note, 0.046, 700, INK, 0.14, 'right');
    P.text('ACCENT', lr, ROW.acc, 0.046, 700, INK, 0.14, 'right');
    P.text('SLIDE', lr, ROW.slide, 0.046, 700, INK, 0.14, 'right');
    const row = sqRow;
    const legend = row === 'gate' ? 'SHORT · NORMAL · LONG · TIE' : row === 'rat' ? 'x1 · x2 · x3 · x4 HITS PER STEP' : '100 · 75 · 50 · 25 · 0 %';
    P.text(legend, G.lab + 0.02, ROW.foot, 0.034, 700, FAINT, 0.12, 'left');
    const ac = mqAccent();
    for (let i = 0; i < STEPS_N; i += 1) {
      const u = cx(i);
      const live = i < len;
      const playing = i === head;
      // la colonne qui joue : un voile clair sous ses cases
      if (playing) {
        rr(P.g, P.px(u - pitch / 2 + 0.01), P.py(ROW.note - 0.14), (pitch - 0.02) * P.U, P.py(ROW.val + 0.14) - P.py(ROW.note - 0.14), 10);
        P.g.fillStyle = rgba(ac, 0.13);
        P.g.fill();
      }
      P.text(String(i + 1), u, ROW.num, 0.034, 700, playing ? INK : live ? DIM : 'rgba(238, 234, 226, 0.22)', 0.04);
      P.led(u, ROW.led, 0.032, playing);
      const a = live ? 1 : 0.3;
      P.g.globalAlpha = a;
      // NOTE : le nom de la note (REST : un silence)
      const d = sq.edit ? sq.buf[i] : notes.length ? notes[i % notes.length] : 0;
      P.win(u, ROW.note, cwid, 0.19, d === null ? 'REST' : noteName(chord, d), { arrows: false, cap: 0.044, lit: playing });
      // ACCENT : pleine (ACCENT), vide (NORMAL), un trait (SOFT)
      const acc = st.acc[i] ?? DEF.acc;
      P.box(u, ROW.acc, cwid * 0.62, 0.15, acc === 2 ? rgba(ac, 0.92) : 'rgba(0,0,0,0.35)', acc === 2 ? ac : 'rgba(238, 234, 226, 0.32)');
      if (acc === 0) P.text('SOFT', u, ROW.acc + 0.003, 0.026, 700, DIM, 0.06);
      // SLIDE : pleine (ON), vide (OFF)
      const sl = st.slide[i] ?? DEF.slide;
      P.box(u, ROW.slide, cwid * 0.62, 0.15, sl ? 'rgba(238, 234, 226, 0.85)' : 'rgba(0,0,0,0.35)', sl ? 'rgba(238, 234, 226, 0.9)' : 'rgba(238, 234, 226, 0.32)');
      // la rangee de valeurs : son nom (NORMAL, x1, 100 % en gris : la valeur de depart)
      const val = st[row][i] ?? DEF[row];
      const name = stepName(row, val).replace(' %', '%');
      P.win(u, ROW.val, cwid, 0.19, name, { arrows: false, cap: name.length > 5 ? 0.034 : 0.04, col: val === DEF[row] ? 'rgba(236, 232, 224, 0.4)' : '#f3efe7' });
      P.g.globalAlpha = 1;
    }
    // END : un trait a l'accent apres le dernier pas joue
    if (len < STEPS_N) {
      const ue = cx(len - 1) + pitch / 2 + (len % 4 === 0 ? gap / 2 : 0);
      P.g.fillStyle = ac;
      P.g.fillRect(P.px(ue) - 3, P.py(ROW.led - 0.04), 6, P.py(ROW.val + 0.12) - P.py(ROW.led - 0.04));
      P.text('END', ue + 0.03, ROW.num, 0.034, 800, ac, 0.12, 'left');
    }
    return P.c;
  };
  return { c: draw(), place };
}

/** La page de la maquette (null : une page d'avant, SYNTH ou FX MOD, que faceExtras.tsx dessine). */
export function mqBuildPage(id: string): MqPage | null {
  const build = id === 'sq' ? sqPage : id === 'mod' ? modPageA : id !== 'lfo' ? null : MQ_OPT === 'A' ? lfoPageA : MQ_OPT === 'B' ? lfoPageB : lfoPageC;
  if (!build) return null;
  const b = build();
  const tex = new CanvasTexture(b.c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  let last = stateKey();
  // la toile suit ce qu'elle montre (les formes et vitesses des LFO, les pistes, la tete, la rangee de valeurs)
  const redraw = (): boolean => {
    const k = stateKey();
    if (k === last) return false;
    last = k;
    tex.image = build().c;
    tex.needsUpdate = true;
    return true;
  };
  return { tex, place: b.place, redraw };
}
const stateKey = (): string => {
  const h = arpExternal.headState;
  const sq = seq.get();
  return JSON.stringify([
    LFOS.map((l) => [l.speed(), l.shape(), l.sync(), l.rateText()]),
    arpSteps.get(),
    sq.len,
    sq.edit,
    h.playing,
    h.pos,
    h.chord,
    sqRow,
    voyParams.of('rate'),
    valOf('xSwing'),
  ]);
};

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

/** Le dessus d'une touche : le caoutchouc mat, la LED a gauche (a l'accent quand la page est montree), le nom grave. */
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
  // un lisere clair en haut (la tranche qui accroche la lumiere)
  g.fillStyle = 'rgba(255, 250, 240, 0.06)';
  g.fillRect(0, 0, c.width, 3);
  const lx = 0.085 * S;
  const ly = c.height / 2;
  const R = 0.024 * S;
  if (on) {
    const a = mqAccent();
    const glow = g.createRadialGradient(lx, ly, 0, lx, ly, R * 3.4);
    glow.addColorStop(0, rgba(a, 0.6));
    glow.addColorStop(1, rgba(a, 0));
    g.fillStyle = glow;
    g.fillRect(lx - R * 3.4, ly - R * 3.4, R * 6.8, R * 6.8);
    const l = g.createRadialGradient(lx - R * 0.3, ly - R * 0.35, 0, lx, ly, R);
    l.addColorStop(0, '#ffffff');
    l.addColorStop(0.32, rgba(a, 0.75));
    l.addColorStop(1, a);
    g.fillStyle = l;
  } else {
    const l = g.createRadialGradient(lx - R * 0.3, ly - R * 0.35, 0, lx, ly, R);
    l.addColorStop(0, 'rgba(255, 210, 200, 0.3)');
    l.addColorStop(0.3, '#4a1712');
    l.addColorStop(1, '#2a0b08');
    g.fillStyle = l;
  }
  g.beginPath();
  g.arc(lx, ly, R, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#070505';
  g.lineWidth = 3;
  g.stroke();
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

export interface MqKey {
  mesh: Mesh;
  set: (on: boolean) => void;
  dispose: () => void;
}
const sideMat = new MeshStandardMaterial({ color: '#151413', roughness: 0.6, metalness: 0.05 });
/** Une touche de la bascule ou de la page SQ (repere de son parent ; y : le dessus du plan). */
export function mqKey(w: number, d: number, label: string, cap = 0.046): MqKey {
  const geo = new ExtrudeGeometry(keyShape(w, d, Math.min(0.08, d * 0.42)), { depth: 0.055, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 16 });
  geo.rotateX(-Math.PI / 2);
  const tOn = keyTop(w, d, label, true, cap);
  const tOff = keyTop(w, d, label, false, cap);
  const mOn = new MeshBasicMaterial({ map: tOn, toneMapped: false });
  const mOff = new MeshBasicMaterial({ map: tOff, toneMapped: false });
  const mesh = new Mesh(geo, [mOff, sideMat]);
  mesh.castShadow = true;
  return {
    mesh,
    set: (on) => {
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

/* ---------------- le viseur : les potards assignables de la face s'allument ---------------- */

let aim = false;
const aimL = new Set<() => void>();
export const mqAim = {
  get: (): boolean => aim,
  set(on: boolean): void {
    if (on === aim) return;
    aim = on;
    mqAim.say();
    aimL.forEach((fn) => fn());
  },
  /** L'ecran le dit (apres le message de la touche EDIT, qui part dans le meme geste). */
  say(): void {
    window.setTimeout(() => (aim ? voyMsg.show('CLICK A KNOB > LFO 1', 3_600_000) : voyMsg.show('', 1)), 80);
  },
  subscribe(fn: () => void): () => void {
    aimL.add(fn);
    return () => {
      aimL.delete(fn);
    };
  },
};

/** Les potards de la face qu'un LFO peut viser : tout reglage continu (pas les crans, pas les touches). */
const AIM_IDS: readonly VoyKnobId[] = VOY_FACE_KNOBS.filter((k) => !isPush(k.id) && (!k.steps || k.morph)).map((k) => k.id);
const FLUTED_R = 0.24 * 0.9;

function ringPoints(stage: Stage, layer: Group, x: number, z: number, R: number): string {
  layer.updateWorldMatrix(true, false);
  const rect = stage.renderer.domElement.getBoundingClientRect();
  const p = new Vector3();
  const out: string[] = [];
  for (let i = 0; i <= 72; i += 1) {
    const th = (i / 72) * Math.PI * 2;
    p.set(x + Math.cos(th) * R, 0.004, z + Math.sin(th) * R);
    layer.localToWorld(p);
    p.project(stage.camera);
    out.push(`${(rect.left + ((p.x + 1) / 2) * rect.width).toFixed(1)},${(rect.top + ((1 - p.y) / 2) * rect.height).toFixed(1)}`);
  }
  return out.join(' ');
}

/** L'anneau a l'accent autour de chaque potard assignable, tant qu'une assignation est en cours (une couche SVG, aucun clic). */
export const MqAimRings: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const on = useSyncExternalStore(mqAim.subscribe, mqAim.get, mqAim.get);
  const hood = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const f = (): void => setSize(window.innerWidth * 10000 + window.innerHeight);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const rig = stage?.voy;
  if (!MQ50 || !on || !stage || !rig || hood !== 'closed') return null;
  void size;
  const rings: { id: string; pts: string }[] = [];
  for (const id of AIM_IDS) {
    const pl = voyKnobPlace(id);
    const layer = pl.where === 'panel' ? rig.panel : rig.lid;
    const R = FLUTED_DIALS.has(id) ? FLUTED_R * 1.22 : VOY_KNOB.skirt.r * pl.s * 1.2;
    rings.push({ id, pts: ringPoints(stage, layer, pl.x, pl.z, R) });
  }
  rings.push({ id: 'hell', pts: ringPoints(stage, rig.panel, VOY_HELL_PLACE.x, VOY_HELL_PLACE.z, VOY_KNOB.skirt.r * VOY_HELL_PLACE.s * 1.2) });
  for (const [id, pl] of [
    ['stack', VOY_DS_PLACE.detune],
    ['wide', VOY_DS_PLACE.spread],
  ] as const)
    rings.push({ id, pts: ringPoints(stage, rig.panel, pl.x, pl.z, 0.24 * pl.s * 1.24) });
  const k = window.innerWidth / 1100;
  const a = mqAccent();
  return (
    <svg className="mm-mq50-aim" style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} aria-hidden="true">
      <defs>
        <filter id="mm-mq50-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2.6 * k} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {rings.map((r) => (
        <polyline key={r.id} points={r.pts} fill="none" style={{ stroke: a }} strokeOpacity={0.95} strokeWidth={2.2 * k} filter="url(#mm-mq50-glow)" />
      ))}
    </svg>
  );
};
