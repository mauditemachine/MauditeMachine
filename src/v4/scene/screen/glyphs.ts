/**
 * L'ecran du MM-RYTM : les dessins des blocs (enveloppes, filtre, arcs, listes de sons, bandes, interrupteurs). Methodes de Screen deplacees telles quelles de scene/screen.ts en P0 (2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), devenues des fonctions (this: Screen) posees sur Screen.prototype.
 */

import { clock } from '../../audio/clock';
import { compGr } from '../../audio/drums';
import { pattern } from '../../audio/pattern';
import { lockOf } from '../../audio/locks';
import { FENV_OCT, atkS, cutHz, decayTau, holdS, voiceFx } from '../../audio/voicefx';
import { type Inst } from '../../theme';
import { type Block, type BlockMode } from '../../rytm/pageView';
import { fill } from '../../state/fill';
import { BLOCK, cellRect, clamp01, FAINT, FAINT_TEXT, FRAME_DIM, HALF, hzShort, INK, MATRIX, type Rect, TALL } from './consts';
import { Screen } from './core';
import { defineMethods } from './proto';

declare module './core' {
  interface Screen {
    drawGr: typeof drawGr;
    drawSoundList: typeof drawSoundList;
    drawSoundStrip: typeof drawSoundStrip;
    drawMixStrip: typeof drawMixStrip;
    drawGrStrip: typeof drawGrStrip;
    drawMix: typeof drawMix;
    drawAtk: typeof drawAtk;
    drawHold: typeof drawHold;
    drawCut: typeof drawCut;
    drawReso: typeof drawReso;
    drawFtype: typeof drawFtype;
    drawBigArc: typeof drawBigArc;
    paintGraph: typeof paintGraph;
    drawAhd: typeof drawAhd;
    drawFilterGraph: typeof drawFilterGraph;
    layersGlyph: typeof layersGlyph;
    drawSwitch: typeof drawSwitch;
    drawArc: typeof drawArc;
  }
}

/**
 * COMP sur sa page (2026-10-18) : son potard (le MIX) en haut, l'aiguille de sa reduction dessous, une barre qui part
 * de la droite (0 dB) vers la gauche (24 dB), en racine (3 dB se voient), reperes a 3, 6 et 12 dB ; la reduction lue
 * par le port du worklet (audio/drums.ts compGr), la plus forte des 50 dernieres ms. COMP a 0 : la barre reste vide.
 */
function drawGr(this: Screen, r: Rect, course: number, ts: number): void {
  const gr = course > 0 ? compGr() : 0;
  const barH = TALL ? 5 : 4;
  const rowH = ts + 3;
  const y1 = r.y1;
  const y0 = y1 - barH;
  if (r.y1 - r.y0 > barH + rowH + 12) this.drawBigArc({ x0: r.x0, y0: r.y0, x1: r.x1, y1: y0 - rowH - 2 }, course, false);
  const w = r.x1 - r.x0;
  const at = (db: number): number => r.x1 - w * Math.sqrt(Math.min(1, Math.max(0, db) / 24));
  this.roundRect(r.x0, y0, w, barH, 1.2, null, this.pal.faint, 0.7);
  if (gr > 0.05) this.roundRect(at(gr), y0, r.x1 - at(gr), barH, 1.2, this.pal.ink);
  for (const t of [3, 6, 12]) this.line([at(t), y0 - 1.5, at(t), y0], this.pal.half, 0.6);
  const ty = y0 - 2.5;
  this.text('GR', r.x0, ty, ts, this.pal.half, 700, 'left', 0.5);
  const word = gr > 0.05 ? `-${gr < 10 ? gr.toFixed(1) : Math.round(gr)} DB` : '0 DB';
  this.text(word, r.x1, ty, ts, gr > 0.05 ? this.pal.ink : this.pal.half, 700, 'right', 0.3);
  this.info.graph = `GR ${gr.toFixed(1)}`;
  // L'aiguille vit : une autre image dans 50 ms tant que le COMP joue (ou que sa reduction retombe)
  if ((course > 0 && clock.running) || gr > 0.05) this.meterLive = true;
}

/** SOUND (2026-10-09) : la liste en points, le son du moment plein ; trop de sons : une barre et son rang. */
function drawSoundList(this: Screen, r: Rect, n: number, cur: number): void {
  if (n < 2) return;
  const y = (r.y0 + r.y1) / 2;
  if (n > 14) {
    this.drawBar(r, cur / (n - 1), false);
    return;
  }
  const step = (r.x1 - r.x0) / (n - 1);
  for (let i = 0; i < n; i += 1) {
    const x = r.x0 + i * step;
    // OFF, les machines, les samples : trois familles de points (un trait entre elles)
    if (i === Math.round(cur)) this.circle(x, y, TALL ? 2.6 : 2.2, this.pal.ink);
    else this.circle(x, y, i === 0 ? 0.7 : 1, i === 0 ? this.pal.faint : this.pal.half);
    if (i === 1 || i === 4) this.line([x - step / 2, y - 3.2, x - step / 2, y + 3.2], this.pal.faint, 0.6);
  }
}

/** SOUND sur une seule case du desktop (2026-10-27) : la rangee de points de la liste en bande, ou sa barre au-dela de 14 sons. */
function drawSoundStrip(this: Screen, r: Rect, n: number, cur: number): void {
  if (n < 2) return;
  if (n > 14) {
    this.drawBar(r, cur / (n - 1), false);
    return;
  }
  const y = (r.y0 + r.y1) / 2;
  const step = (r.x1 - r.x0) / (n - 1);
  for (let i = 0; i < n; i += 1) {
    const x = r.x0 + i * step;
    if (i === Math.round(cur)) this.circle(x, y, 2, this.pal.ink);
    else this.circle(x, y, i === 0 ? 0.7 : 0.95, i === 0 ? this.pal.faint : this.pal.half);
    if (i === 1 || i === 4) this.line([x - step / 2, y - 2.2, x - step / 2, y + 2.2], this.pal.faint, 0.6);
  }
}

/** MIX sur une seule case du desktop (2026-10-27) : le rail en bande, son milieu, le curseur ; l'unite dit SYN et SMP. */
function drawMixStrip(this: Screen, r: Rect, m: number, cursor = true): void {
  const y = (r.y0 + r.y1) / 2;
  const x = r.x0 + (r.x1 - r.x0) * clamp01(m);
  this.line([r.x0, y, r.x1, y], this.pal.faint, 1.4);
  this.line([(r.x0 + r.x1) / 2, y - 2.2, (r.x0 + r.x1) / 2, y + 2.2], this.pal.half, 0.7);
  if (cursor) this.roundRect(x - 1.6, r.y0, 3.2, r.y1 - r.y0, 0.8, this.pal.ink);
}

/** La reduction du COMP sur une seule case du desktop (2026-10-27) : la barre de drawGr en bande, de la droite (0 dB). */
function drawGrStrip(this: Screen, r: Rect, course: number): void {
  const gr = course > 0 ? compGr() : 0;
  const w = r.x1 - r.x0;
  const at = (db: number): number => r.x1 - w * Math.sqrt(Math.min(1, Math.max(0, db) / 24));
  const h = r.y1 - r.y0 - 1;
  this.roundRect(r.x0, r.y0 + 0.5, w, h, 1, null, this.pal.faint, 0.7);
  if (gr > 0.05) this.roundRect(at(gr), r.y0 + 0.5, r.x1 - at(gr), h, 1, this.pal.ink);
  for (const t of [3, 6, 12]) this.line([at(t), r.y0 - 1, at(t), r.y0 + 0.5], this.pal.half, 0.6);
  this.info.graph = `GR ${gr.toFixed(1)}`;
  if ((course > 0 && clock.running) || gr > 0.05) this.meterLive = true;
}

/**
 * MIX (2026-10-09) : un crossfader, SYN a gauche, SMP a droite, le curseur ou
 * la part tombe ; la voix muette : pas de curseur. Les deux mots seulement
 * s'ils tiennent separes (revue : SYSMP).
 */
function drawMix(this: Screen, r: Rect, m: number, cursor = true): void {
  const w = TALL ? 4.4 : 3.6;
  const h = TALL ? 9 : 7.5;
  // Le rail au bas de la place, les mots au-dessus : le curseur a un bout ne touche pas SMP
  const y = r.y1 - h / 2;
  const x = r.x0 + (r.x1 - r.x0) * clamp01(m);
  this.line([r.x0, y, r.x1, y], this.pal.faint, 1.4);
  this.line([(r.x0 + r.x1) / 2, y - 2.6, (r.x0 + r.x1) / 2, y + 2.6], this.pal.half, 0.7);
  if (cursor) this.roundRect(x - w / 2, y - h / 2, w, h, 1, this.pal.ink);
  // Au telephone a 9.8 (9 px a l'ecran, 69-common2 point 6)
  const ts = TALL ? 9.8 : 5.5;
  if (2 * this.textWidth('SYN', ts, 700, 0.3) + 6 > r.x1 - r.x0) return;
  this.text('SYN', r.x0, r.y0 + ts * 0.7, ts, this.pal.half, 700, 'left', 0.3);
  this.text('SMP', r.x1, r.y0 + ts * 0.7, ts, this.pal.half, 700, 'right', 0.3);
}

/** ATK (2026-10-09) : la rampe d'attaque, plus couchee avec la valeur, puis le plateau. */
function drawAtk(this: Screen, r: Rect, course: number): void {
  const ax = r.x0 + (r.x1 - r.x0) * (0.06 + 0.78 * clamp01(course));
  this.line([r.x0, r.y1, r.x1, r.y1], this.pal.faint, 0.8);
  this.line([r.x0, r.y1, ax, r.y0 + 1.5, r.x1, r.y0 + 1.5], this.pal.ink, 1.6 * Math.max(0.7, Screen.cardK(r)));
}

/** HOLD (2026-10-09) : la frappe, le plateau qui s'allonge, la chute. */
function drawHold(this: Screen, r: Rect, course: number): void {
  const a = r.x0 + 2;
  const h = a + (r.x1 - r.x0 - 8) * (0.08 + 0.85 * clamp01(course));
  this.line([r.x0, r.y1, r.x1, r.y1], this.pal.faint, 0.8);
  this.line([r.x0, r.y1, a, r.y0 + 1.5, h, r.y0 + 1.5, Math.min(r.x1, h + 5), r.y1], this.pal.ink, 1.6 * Math.max(0.7, Screen.cardK(r)));
}

/** FREQ (2026-10-09) : un passe-bas dont la coupure glisse avec la valeur. */
function drawCut(this: Screen, r: Rect, course: number): void {
  const fc = r.x0 + (r.x1 - r.x0) * (0.1 + 0.8 * clamp01(course));
  const top = r.y0 + 3;
  const pts: number[] = [r.x0, top];
  const n = 24;
  for (let k = 0; k <= n; k += 1) {
    const x = r.x0 + ((r.x1 - r.x0) * k) / n;
    const d = Math.max(0, x - fc) / (r.x1 - r.x0);
    pts.push(x, Math.min(r.y1, top + d * d * 220 + (Math.abs(x - fc) < 2 ? -1.2 : 0)));
  }
  this.line([r.x0, r.y1, r.x1, r.y1], this.pal.faint, 0.8);
  this.line(pts, this.pal.ink, 1.6 * Math.max(0.7, Screen.cardK(r)));
}

/** RESO (2026-10-09) : la bosse du filtre a sa coupure, plus haute avec la valeur. */
function drawReso(this: Screen, r: Rect, course: number): void {
  const mid = r.x0 + (r.x1 - r.x0) * 0.62;
  const base = r.y1 - (r.y1 - r.y0) * 0.35;
  const peak = (r.y1 - r.y0 - 2) * (0.1 + 0.9 * clamp01(course));
  const pts: number[] = [];
  const n = 28;
  for (let k = 0; k <= n; k += 1) {
    const x = r.x0 + ((r.x1 - r.x0) * k) / n;
    const t = (x - mid) / ((r.x1 - r.x0) * 0.16);
    const fall = x > mid ? Math.min(r.y1 - base, ((x - mid) / (r.x1 - r.x0)) * 60) : 0;
    pts.push(x, Math.min(r.y1, base - peak * Math.exp(-t * t) + fall));
  }
  this.line([r.x0, r.y1, r.x1, r.y1], this.pal.faint, 0.8);
  this.line(pts, this.pal.ink, 1.6 * Math.max(0.7, Screen.cardK(r)));
}

/** TYPE (2026-10-09) : les trois formes LP, HP, BP en petit, celle du moment pleine. */
function drawFtype(this: Screen, r: Rect, v: number): void {
  const i = Math.max(0, Math.min(2, Math.round(v * 2)));
  const cw = (r.x1 - r.x0) / 3;
  for (let k = 0; k < 3; k += 1) {
    const x0 = r.x0 + k * cw + 1;
    const x1 = x0 + cw - 2.5;
    const y0 = r.y0 + 3;
    const y1 = r.y1 - 1;
    const col = k === i ? this.pal.ink : this.pal.faint;
    const lw = k === i ? 1.5 : 1;
    const mx = (x0 + x1) / 2;
    if (k === 0) this.line([x0, y0, mx, y0, x1, y1], col, lw);
    else if (k === 1) this.line([x0, y1, mx, y0, x1, y0], col, lw);
    else this.line([x0, y1, mx, y0, x1, y1], col, lw);
  }
}

/** Un grand potard dessine (les FX de la voix, sur deux rangees, 2026-10-09) : le meme que drawArc, plus grand, la piste plus marquee. */
function drawBigArc(this: Screen, r: Rect, course: number, centre: boolean): void {
  const side = Math.min(r.x1 - r.x0, r.y1 - r.y0);
  const cx = (r.x0 + r.x1) / 2;
  const cy = (r.y0 + r.y1) / 2;
  this.drawArc({ x0: cx - side / 2, y0: cy - side / 2, x1: cx + side / 2, y1: cy + side / 2 }, course, centre, TALL ? 2.6 : 2.2);
}

/**
 * Les dessins d'un ecran (2026-10-09) : ENV (AMP ENV) l'enveloppe AHD du
 * coup, FLTR la courbe du filtre ; ceux de la voix, ou ceux du pas montre
 * (P-LOCK, le pas qui joue) avec ses verrous. Ni valeur ni zone : ils suivent
 * les blocs qu'on tourne, en direct.
 */
function paintGraph(this: Screen, b: Block, inst: Inst | null, mode: BlockMode | null): void {
  const R = cellRect(b.cell);
  const M = MATRIX;
  const T = this.bt;
  const lk = inst && mode ? (mode.kind === 'lock' ? lockOf(pattern.get().locks, inst, mode.step) : mode.kind === 'flash' ? mode.lock : null) : null;
  const fx = inst ? voiceFx.of(inst) : null;
  const val = (k: 'atk' | 'hold' | 'decay' | 'ftype' | 'fcut' | 'freso' | 'fenv' | 'fatk' | 'fdec' | 'start'): number => (lk?.[k] ?? (fx ? fx[k] : 0)) as number;
  const locked = (keys: readonly string[]): boolean => !!lk && keys.some((k) => k in lk);
  this.roundRect(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, M.r, null, FRAME_DIM, 0.6);
  const pad = BLOCK.padX;
  const isAhd = b.graph === 'ahd';
  const hot = isAhd ? locked(['atk', 'hold', 'decay', 'start']) : locked(['ftype', 'fcut', 'freso', 'fenv', 'fatk', 'fdec']);
  const title = `${b.label}${hot ? (mode?.kind === 'lock' ? ' · P-LOCK' : ' · STEP') : ''}`;
  this.text(this.fitText(title, R.w - 2 * pad, T.nameSize, 0.7, 700), R.x + pad, R.y + T.nameDy, T.nameSize, hot ? INK : HALF, 700, 'left', 0.7);
  if (!fx) {
    this.text('PICK A VOICE', R.x + pad, R.y + T.valueDy, T.unitSize, FAINT_TEXT, 600);
    return;
  }
  const area: Rect = { x0: R.x + pad, y0: R.y + T.nameDy + (TALL ? 5 : 3.5), x1: R.x + R.w - pad, y1: R.y + R.h - (TALL ? 12 : 9) };
  if (isAhd) this.drawAhd(area, val('atk'), val('hold'), val('decay'), R.y + R.h - (TALL ? 3.6 : 2.6));
  else this.drawFilterGraph(area, val('ftype'), val('fcut'), val('freso'), val('fenv'), R.y + R.h - (TALL ? 3.6 : 2.6));
  this.info.graph = isAhd ? `AHD ${val('atk').toFixed(2)} ${val('hold').toFixed(2)} ${val('decay').toFixed(2)}` : `FILTER ${val('ftype')} ${val('fcut').toFixed(2)}`;
}

/** L'enveloppe AHD : l'attaque, la tenue, la descente (FULL : la queue entiere), ses trois temps dessous. */
function drawAhd(this: Screen, r: Rect, atk: number, hold: number, decay: number, labelY: number): void {
  const a = atkS(atk);
  const h = holdS(hold);
  const tau = decayTau(decay);
  const d = tau === null ? Infinity : tau * Math.log(1000);
  // L'axe du temps : de quoi lire les trois parties (au moins 0.3 s), une queue entiere comptee 1.5 s
  const total = Math.max(0.3, a + h + (Number.isFinite(d) ? d : 1.5)) * 1.05;
  const X = (t: number): number => r.x0 + ((r.x1 - r.x0) * Math.min(total, t)) / total;
  const top = r.y0 + 2;
  const base = r.y1;
  this.line([r.x0, base, r.x1, base], FAINT, 0.7);
  const pts: number[] = [r.x0, base, X(a), top, X(a + h), top];
  const n = 36;
  for (let k = 1; k <= n; k += 1) {
    const t = (total - a - h) * (k / n);
    const y = tau === null ? top : base - (base - top) * Math.exp(-t / tau);
    pts.push(X(a + h + t), y);
  }
  // Le dessous de la courbe, a peine (le son), puis la courbe
  const c = this.ctx;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.lineTo(r.x1, base);
  c.closePath();
  c.fillStyle = 'rgba(246, 241, 231, 0.08)';
  c.fill();
  this.line(pts, INK, TALL ? 2 : 1.7);
  // Les reperes : la fin de l'attaque, de la tenue
  for (const t of [a, a + h]) this.line([X(t), base, X(t), base - 2.4], HALF, 0.8);
  const ls = TALL ? this.bt.unitSize : this.bt.unitSize * 0.92;
  const ms = (s: number): string => (s >= 1 ? `${s.toFixed(1)}S` : `${Math.round(s * 1000)}MS`);
  const parts = [`A ${a <= 0 ? 'SNAP' : ms(a)}`, `H ${ms(h)}`, `D ${Number.isFinite(d) ? ms(d) : 'FULL'}`];
  const cw = (r.x1 - r.x0) / 3;
  parts.forEach((p, i) => this.text(this.fitText(p, cw - 2, ls, 0.4, 700), r.x0 + i * cw, labelY, ls, HALF, 700, 'left', 0.4));
}

/** La courbe du filtre : son type a sa coupure, la bosse de la resonance, l'enveloppe en fantome (ou elle l'emmene). */
function drawFilterGraph(this: Screen, r: Rect, type: number, cut: number, reso: number, env: number, labelY: number): void {
  const t = Math.max(0, Math.min(2, Math.round(type * 2)));
  const curve = (cc: number): number[] => {
    const fc = r.x0 + (r.x1 - r.x0) * clamp01(cc);
    const pk = (r.y1 - r.y0) * 0.5 * clamp01(reso);
    const mid = r.y0 + (r.y1 - r.y0) * 0.42;
    const pts: number[] = [];
    const n = 40;
    for (let k = 0; k <= n; k += 1) {
      const x = r.x0 + ((r.x1 - r.x0) * k) / n;
      const u = (x - fc) / (r.x1 - r.x0);
      const bump = pk * Math.exp(-(u * u) / 0.004);
      let y: number;
      if (t === 0) y = mid + (u > 0 ? u * u * 900 : 0) - bump;
      else if (t === 1) y = mid + (u < 0 ? u * u * 900 : 0) - bump;
      else y = mid + u * u * 700 - bump;
      pts.push(x, Math.max(r.y0, Math.min(r.y1, y)));
    }
    return pts;
  };
  this.line([r.x0, r.y1, r.x1, r.y1], FAINT, 0.7);
  if (env !== 0) {
    // Ou l'enveloppe l'emmene (FENV_OCT octaves au sommet, sur les dix octaves de l'axe)
    const to = clamp01(cut + (env * FENV_OCT) / 10);
    this.ctx.save();
    this.ctx.setLineDash([2, 2]);
    this.line(curve(to), HALF, 1);
    this.ctx.restore();
  }
  this.line(curve(cut), INK, TALL ? 2 : 1.7);
  const ls = TALL ? this.bt.unitSize : this.bt.unitSize * 0.92;
  const type3 = ['LP', 'HP', 'BP'][t];
  this.text(`${type3} ${hzShort(cutHz(cut))}`, r.x0, labelY, ls, HALF, 700, 'left', 0.4);
}

/** Deux couches (R3) : deux petites plaques decalees, l'une pleine ; x : le bord droit, y : la ligne du nom. */
function layersGlyph(this: Screen, x: number, y: number, color: string): void {
  const w = 6.2;
  const h = 4.4;
  this.roundRect(x - w - 2.4, y - h - 3.6, w, h, 1, null, color, 0.9);
  this.roundRect(x - w, y - h - 1.2, w, h, 1, color);
}

/** Un interrupteur (un reglage a deux crans, GATE, REV) : une pastille, son bouton a gauche (OFF) ou plein a droite (ON). */
function drawSwitch(this: Screen, r: Rect, on: boolean): void {
  const h = r.y1 - r.y0;
  const w = r.x1 - r.x0;
  this.pill(r.x0, r.y0, w, h, on ? this.pal.ink : null, on ? null : this.pal.half, 0.8);
  this.circle(on ? r.x1 - h / 2 : r.x0 + h / 2, r.y0 + h / 2, h / 2 - 1.2, on ? this.pal.bg : this.pal.half);
}

/**
 * Un petit potard dessine (les reglages sans image a eux) : la piste de
 * 270 deg a peine, l'arc de la valeur plein (depuis midi pour un reglage a
 * zero au centre), l'aiguille.
 */
function drawArc(this: Screen, r: Rect, course: number, centre: boolean, lw = 1.8): void {
  const c = this.ctx;
  const cx = (r.x0 + r.x1) / 2;
  const cy = (r.y0 + r.y1) / 2 + 0.5;
  const rad = Math.min(r.x1 - r.x0, r.y1 - r.y0) / 2 - 0.5;
  const a0 = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  const at = a0 + sweep * clamp01(course);
  const from = centre ? a0 + sweep / 2 : a0;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(cx, cy, rad, a0, a0 + sweep);
  c.strokeStyle = this.pal.faint;
  c.lineWidth = lw * 0.78;
  c.stroke();
  if (Math.abs(at - from) > 0.01) {
    c.beginPath();
    c.arc(cx, cy, rad, Math.min(from, at), Math.max(from, at));
    c.strokeStyle = this.pal.ink;
    c.lineWidth = lw;
    c.stroke();
  }
  this.line([cx + Math.cos(at) * rad * 0.25, cy + Math.sin(at) * rad * 0.25, cx + Math.cos(at) * rad * 0.85, cy + Math.sin(at) * rad * 0.85], this.pal.ink, lw * 0.72);
}

defineMethods(Screen, { drawGr, drawSoundList, drawSoundStrip, drawMixStrip, drawGrStrip, drawMix, drawAtk, drawHold, drawCut, drawReso, drawFtype, drawBigArc, paintGraph, drawAhd, drawFilterGraph, layersGlyph, drawSwitch, drawArc });
