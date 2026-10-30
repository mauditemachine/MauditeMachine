/**
 * L'ecran du MM-RYTM : les primitives de dessin (texte, cercle, pastille, rectangle arrondi, trait, place sur l'anneau, negatif, coins, textes ajustes, icone de lecture). Methodes de Screen deplacees telles quelles de scene/screen.ts en P0 (2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), devenues des fonctions (this: Screen) posees sur Screen.prototype.
 */

import { clock } from '../../audio/clock';
import { STEP_COUNT } from '../../audio/pattern';
import { type LockLine } from '../../actions';
import { DT_FACE } from '../../theme';
import { fill } from '../../state/fill';
import { BLACK, fit, font, INK, PAGE_HEAD, RING, two, UH, UW } from './consts';
import { Screen } from './core';
import { defineMethods } from './proto';

declare module './core' {
  interface Screen {
    text: typeof text;
    slashText: typeof slashText;
    textWidth: typeof textWidth;
    circle: typeof circle;
    pill: typeof pill;
    roundRect: typeof roundRect;
    line: typeof line;
    ringAt: typeof ringAt;
    runIcon: typeof runIcon;
    spot: typeof spot;
    negFill: typeof negFill;
    cornerMarks: typeof cornerMarks;
    flashLine: typeof flashLine;
    fitText: typeof fitText;
    fitValue: typeof fitValue;
  }
}

/* ---------------- le dessin ---------------- */

/** Un texte (unites) ; rend sa largeur. spacing : l'air entre les lettres (unites). */
function text(this: Screen, s: string, x: number, y: number, size: number, color = INK, weight = 500, align: 'left' | 'right' | 'center' = 'left', spacing = 0): number {
  const c = this.ctx;
  c.font = font(weight, size);
  c.fillStyle = color;
  c.textBaseline = 'alphabetic';
  if (spacing <= 0) {
    const w = c.measureText(s).width;
    const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    c.textAlign = 'left';
    c.fillText(s, x0, y);
    return w;
  }
  const widths = [...s].map((ch) => c.measureText(ch).width);
  const w = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, s.length - 1);
  let cx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  c.textAlign = 'left';
  [...s].forEach((ch, i) => {
    c.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
  return w;
}

/**
 * Une grande valeur a barre (1/8D, 1/16), alignee a gauche (2026-10-22, audit
 * : la barre de 1/8D descendait sur 346 MS dans le bloc TIME du DELAY) : la
 * barre au corps 0.8, posee sur la ligne de base comme une barre de fraction ;
 * jamais plus large que le texte entier (fitValue l'a mesure). Rend sa largeur.
 */
function slashText(this: Screen, s: string, x: number, y: number, size: number, color: string, weight: number): number {
  const c = this.ctx;
  const parts = s.split('/');
  const ss = size * 0.8;
  c.font = font(weight, ss);
  const lift = Math.max(0, c.measureText('/').actualBoundingBoxDescent || 0);
  let cx = x;
  parts.forEach((part, i) => {
    if (i > 0) cx += this.text('/', cx, y - lift, ss, color, weight);
    if (part) cx += this.text(part, cx, y, size, color, weight);
  });
  return cx - x;
}

function textWidth(this: Screen, s: string, size: number, weight = 500, spacing = 0): number {
  this.ctx.font = font(weight, size);
  return this.ctx.measureText(s).width + spacing * Math.max(0, s.length - 1);
}

function circle(this: Screen, x: number, y: number, r: number, fill: string | null, stroke: string | null = null, lw = 1.2): void {
  const c = this.ctx;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}

function pill(this: Screen, x: number, y: number, w: number, h: number, fill: string | null, stroke: string | null = null, lw = 1.2): void {
  const c = this.ctx;
  const r = h / 2;
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  c.lineTo(x + r, y + h);
  c.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2);
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}

/** Un rectangle aux coins arrondis (le contour du bloc tourne). */
function roundRect(this: Screen, x: number, y: number, w: number, h: number, r: number, fill: string | null, stroke: string | null = null, lw = 1): void {
  const c = this.ctx;
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}

function line(this: Screen, pts: readonly number[], color: string, lw = 1.4): void {
  const c = this.ctx;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}

/** La place du pas i sur l'anneau (le 1 en haut, dans le sens des aiguilles). */
function ringAt(this: Screen, i: number, r: number = RING.r): { x: number; y: number; a: number } {
  const a = -Math.PI / 2 + (i / STEP_COUNT) * Math.PI * 2;
  return { x: RING.cx + Math.cos(a) * r, y: RING.cy + Math.sin(a) * r, a };
}

/** La lecture : un triangle ; a l'arret, un carre (x : son bord gauche, y : la ligne de base). */
function runIcon(this: Screen, x: number, y: number): void {
  const c = this.ctx;
  c.fillStyle = INK;
  if (clock.running) {
    c.beginPath();
    c.moveTo(x, y - 9);
    c.lineTo(x + 8, y - 4.5);
    c.lineTo(x, y);
    c.closePath();
    c.fill();
  } else c.fillRect(x, y - 8.5, 8, 8);
}

/** Une zone de dessin (unites) en part du verre (u, v de 0 a 1) : les zones de saisie des blocs et des onglets. */
function spot(this: Screen, r: { x: number; y: number; w: number; h: number }): { u0: number; u1: number; v0: number; v1: number } {
  return { u0: r.x / UW, u1: (r.x + r.w) / UW, v0: r.y / UH, v1: (r.y + r.h) / UH };
}

/** La pastille FILL sur une bande en negatif (P-LOCK, une scene armee), a gauche de rightX ; rend le nouveau bord. */
function negFill(this: Screen, rightX: number): number {
  if (!DT_FACE || !fill.on) return rightX;
  const H = PAGE_HEAD;
  const T = this.bt.head;
  const w = this.textWidth('FILL', T.sound, 800, 0.6) + 8;
  const x = rightX - w;
  this.roundRect(x, H.pillY, w, T.pillH, 2.2, BLACK);
  this.text('FILL', x + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, INK, 800, 'center', 0.6);
  return x - 5;
}

/** Quatre coins autour d'un rectangle (INFOS) : la carte parle de ce qu'il entoure. */
function cornerMarks(this: Screen, x0: number, y0: number, x1: number, y1: number): void {
  const a = 4;
  const lw = this.mobile ? 1.4 : 1.1;
  this.line([x0, y0 + a, x0, y0, x0 + a, y0], INK, lw);
  this.line([x1 - a, y0, x1, y0, x1, y0 + a], INK, lw);
  this.line([x1, y1 - a, x1, y1, x1 - a, y1], INK, lw);
  this.line([x0 + a, y1, x0, y1, x0, y1 - a], INK, lw);
}

/** Les verrous du pas qui joue sur une ligne : autant qu'il en tient, puis combien il en reste (+2). */
function flashLine(this: Screen, step: number, fl: readonly LockLine[], maxW: number, size: number): string {
  let t = `P-LOCK ${two(step + 1)}`;
  for (let i = 0; i < fl.length; i += 1) {
    const next = `${t}  ${fl[i].name} ${fl[i].text}`;
    const rest = i < fl.length - 1 ? `  +${fl.length - i - 1}` : '';
    if (this.textWidth(next + rest, size, 600, 0.4) > maxW) return `${t}  +${fl.length - i}`;
    t = next;
  }
  return t;
}

/** Coupe un texte a la largeur (unites) ; un point final quand ca deborde. */
function fitText(this: Screen, s: string, maxW: number, size: number, spacing = 0.4, weight = 600): string {
  if (this.textWidth(s, size, weight, spacing) <= maxW) return s;
  let n = s.length - 1;
  while (n > 1 && this.textWidth(fit(s, n), size, weight, spacing) > maxW) n -= 1;
  return fit(s, n);
}

/** La valeur d'un bloc dans sa largeur : 16, sinon 13, 11 puis 9 et coupee ; up : un cran plus gros (le grand bloc SOUND). */
function fitValue(this: Screen, s: string, maxW: number, up = 0, scale = 1, more: readonly number[] = []): { text: string; size: number } {
  const sizes = [...(up ? [this.bt.valueSizes[0] * 1.12, ...this.bt.valueSizes] : this.bt.valueSizes).map((x) => x * scale), ...more];
  for (const size of sizes) if (this.textWidth(s, size, 300) <= maxW) return { text: s, size };
  const size = sizes[sizes.length - 1];
  let n = s.length - 1;
  while (n > 1 && this.textWidth(fit(s, n), size, 300) > maxW) n -= 1;
  return { text: fit(s, n), size };
}

defineMethods(Screen, { text, slashText, textWidth, circle, pill, roundRect, line, ringAt, runIcon, spot, negFill, cornerMarks, flashLine, fitText, fitValue });
