/**
 * L'ecran du MM-RYTM : HOME (l'anneau des pas, des patterns et des banques, les cartes, la ligne du bas, le menu et la bande du haut). Methodes de Screen deplacees telles quelles de scene/screen.ts en P0 (2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), devenues des fonctions (this: Screen) posees sur Screen.prototype.
 */

import { clock } from '../../audio/clock';
import { mix } from '../../audio/drums';
import { INSTRUMENTS, STEP_COUNT, VEL_BARS, pattern, velocity } from '../../audio/pattern';
import { lockMask } from '../../audio/locks';
import { voiceFx } from '../../audio/voicefx';
import { type LcdState } from '../../state/lcd';
import { BANKS, BANK_SIZE, bankName, bankOf, patterns, slotName } from '../../state/patterns';
import { playhead } from '../../state/playhead';
import { voices } from '../../state/voices';
import { dtFace } from '../../state/dtFace';
import { DT_FACE, OLED_BAR, SCREEN_TOUCH, type Inst } from '../../theme';
import { HOME_MENU, HOME_MENU_LABEL } from '../../rytm/pages';
import { v127Text } from '../../rytm/values';
import { CONDS, RATE_DENS, rtrgGain } from '../../audio/trig';
import { LFO_WAVES, waveAt } from '../../audio/lfo';
import { fill } from '../../state/fill';
import { BLACK, CARD, clamp01, COL, DY, FAINT, FAINT_TEXT, fit, FRAME_DIM, HALF, INK, LINE, MENU_HIT_TOP, PAGE_HEAD, pmutesNow, PULSE_MS, type Rect, RING, soundOf, TEX_K, UH, UW, WAVE_MS } from './consts';
import { Screen } from './core';
import { defineMethods } from './proto';

declare module './core' {
  interface Screen {
    paintStepRing: typeof paintStepRing;
    maxVel: typeof maxVel;
    paintPatternRing: typeof paintPatternRing;
    paintBankRing: typeof paintBankRing;
    paintChain: typeof paintChain;
    paintCards: typeof paintCards;
    drawLevel: typeof drawLevel;
    drawTone: typeof drawTone;
    drawDecay: typeof drawDecay;
    drawSwing: typeof drawSwing;
    drawStretch: typeof drawStretch;
    drawCond: typeof drawCond;
    drawRate: typeof drawRate;
    drawVfad: typeof drawVfad;
    drawWave: typeof drawWave;
    drawNotch: typeof drawNotch;
    drawBar: typeof drawBar;
    drawStart: typeof drawStart;
    paintLine: typeof paintLine;
    paintHomeMenu: typeof paintHomeMenu;
    paintHomeHead: typeof paintHomeHead;
  }
}

/** L'anneau des pas de la voix choisie (sans voix : le motif entier en demi-teinte) ; la voix au centre. */
function paintStepRing(this: Screen, inst: Inst | null, steps: Record<Inst, string>, now: number): number {
  const head = clock.running ? playhead.get() : -1;
  const wave = this.waveFrom > 0 ? (now - this.waveFrom) / 1000 : -1;
  const k = inst ? INSTRUMENTS.indexOf(inst) : -1;
  const pulse = k >= 0 ? Math.max(0, 1 - (now - this.hitAt[k]) / PULSE_MS) : 0;
  // Le cercle du fond, a peine
  this.circle(RING.cx, RING.cy, RING.r, null, FAINT, 0.8);
  for (let i = 0; i < STEP_COUNT; i += 1) {
    let r = RING.r;
    if (wave >= 0) {
      const env = Math.min(1, wave / 1.2, (WAVE_MS / 1000 - wave) / 1.2);
      r += env * 2.4 * Math.sin(wave * 3.4 - i * 0.55);
    }
    const at = this.ringAt(i, r);
    const v = inst ? velocity(steps, inst, i) : this.maxVel(steps, i);
    const bars = VEL_BARS[v];
    if (bars > 0) {
      const rr = [0, 2.6, 3.6, 4.7][bars];
      const on = i === head && pulse > 0 ? rr + 2.2 * pulse : rr;
      this.circle(at.x, at.y, on, inst ? INK : HALF);
    } else this.circle(at.x, at.y, i % 4 === 0 ? 1.5 : 1, i % 4 === 0 ? HALF : FAINT);
    // Un pas qui a des verrous (2026-10-08) : un petit trait dehors
    if (inst && (lockMask(pattern.get().locks, inst) >> i) & 1) {
      // Plus long et plus epais (revue de R2 : 2 a 3 px), un point au bout
      const o0 = this.ringAt(i, r + 5.5);
      const o1 = this.ringAt(i, r + 10.5);
      this.line([o0.x, o0.y, o1.x, o1.y], bars > 0 ? INK : HALF, 1.8);
      this.circle(o1.x, o1.y, 1.3, bars > 0 ? INK : HALF);
    }
    if (i === head) {
      // La tete : un cercle autour du pas, un trait vers le centre
      this.circle(at.x, at.y, 7.2, null, INK, 1.2);
      const a0 = this.ringAt(i, RING.r - 12);
      const a1 = this.ringAt(i, RING.r - 18);
      this.line([a0.x, a0.y, a1.x, a1.y], INK, 1.6);
    }
  }
  // Le centre : la voix en grand, son son (ou MUTE, SOLO) ; sans voix, le pattern
  if (inst) {
    this.text(inst, RING.cx, RING.cy + 7, inst.length > 2 ? 21 : 25, INK, 300, 'center');
    const solo = voices.isSolo(inst);
    const muted = !voices.plays(inst, pmutesNow());
    if (solo || muted) {
      const word = solo ? 'SOLO' : 'MUTE';
      const w = this.textWidth(word, 7, 700, 0.8) + 8;
      this.pill(RING.cx - w / 2, RING.cy + 13, w, 10, INK);
      this.text(word, RING.cx, RING.cy + 20.5, 7, BLACK, 700, 'center', 0.8);
    } else this.text(fit(soundOf(inst), 10), RING.cx, RING.cy + 21, 8, HALF, 600, 'center', 0.6);
  } else {
    this.text('ALL', RING.cx, RING.cy + 6, 18, HALF, 300, 'center', 1);
    this.text('PICK A VOICE', RING.cx, RING.cy + 19, 6, FAINT_TEXT, 600, 'center', 0.5);
  }
  return 0;
}

/** Sans voix choisie : le plus fort des coups du pas. */
function maxVel(this: Screen, steps: Record<Inst, string>, i: number): number {
  let best = 0;
  for (const k of INSTRUMENTS) best = Math.max(best, velocity(steps, k, i));
  return best;
}

/**
 * EDIT : l'anneau des seize patterns de la banque montree (V.5.2 ; le courant plein, la chaine reliee, celui qui attend
 * clignote). La vue BANK (FUNC + PTN) : les huit banques sur les pas 1 a 8.
 */
function paintPatternRing(this: Screen, now: number): void {
  const p = patterns.get();
  const blinkOn = Math.floor(now / 160) % 2 === 0;
  this.circle(RING.cx, RING.cy, RING.r, null, FAINT, 0.8);
  if (DT_FACE && dtFace.bank()) {
    this.paintBankRing(blinkOn);
    return;
  }
  const b0 = patterns.shown() * BANK_SIZE;
  const local = (i: number): number => (i >= b0 && i < b0 + BANK_SIZE ? i - b0 : -1);
  // La chaine : un arc d'un pattern au suivant (les deux dans la banque montree)
  if (p.chain.length > 1) {
    const c = this.ctx;
    c.strokeStyle = HALF;
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    for (let k = 0; k + 1 < p.chain.length; k += 1) {
      const ia = local(p.chain[k]);
      const ib = local(p.chain[k + 1]);
      if (ia < 0 || ib < 0) continue;
      const a = this.ringAt(ia);
      const b = this.ringAt(ib);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.quadraticCurveTo(RING.cx, RING.cy, b.x, b.y);
      c.stroke();
    }
  }
  for (let i = 0; i < BANK_SIZE; i += 1) {
    const at = this.ringAt(i);
    const slot = b0 + i;
    const inChain = p.chain.length > 1 && p.chain.includes(slot);
    if (slot === p.cur) {
      this.circle(at.x, at.y, 5.4, INK);
      if (inChain && p.chain[p.pos] === slot) this.circle(at.x, at.y, 8.2, null, INK, 1);
    } else if (slot === p.next) this.circle(at.x, at.y, 4.6, blinkOn ? INK : null, INK, 1.2);
    else if (patterns.filled(slot)) this.circle(at.x, at.y, 3.6, inChain ? INK : HALF);
    else this.circle(at.x, at.y, 1.4, FAINT);
    // Le numero, dehors, sur les temps (1 5 9 13)
    if (i % 4 === 0) {
      const o = this.ringAt(i, RING.r - 11);
      this.text(String(i + 1), o.x, o.y + 2.6, 7, HALF, 600, 'center');
    }
  }
  this.text(slotName(p.cur), RING.cx, RING.cy + 6, 19, INK, 300, 'center', 0.5);
  // V.5.0 au desktop : la touche s'appelle PTN
  const word = DT_FACE ? 'PTN' : 'EDIT';
  const w = this.textWidth(word, 7, 700, 0.8) + 8;
  this.pill(RING.cx - w / 2, RING.cy + 12, w, 10, INK);
  this.text(word, RING.cx, RING.cy + 19.5, 7, BLACK, 700, 'center', 0.8);
}

/** La vue BANK (V.5.2) : les banques A a H sur les pas 1 a 8, celle qui joue pleine, l'affichee clignote, une vide a peine. */
function paintBankRing(this: Screen, blinkOn: boolean): void {
  const p = patterns.get();
  const playing = bankOf(p.cur);
  for (let b = 0; b < BANKS; b += 1) {
    const at = this.ringAt(b);
    if (b === playing) this.circle(at.x, at.y, 5.4, INK);
    else if (b === p.bank) this.circle(at.x, at.y, 4.6, blinkOn ? INK : null, INK, 1.2);
    else if (patterns.bankFilled(b)) this.circle(at.x, at.y, 3.6, HALF);
    else this.circle(at.x, at.y, 1.4, FAINT);
    const o = this.ringAt(b, RING.r - 11);
    this.text(bankName(b), o.x, o.y + 2.6, 7, b === p.bank ? INK : HALF, 700, 'center');
  }
  this.text(`BANK ${bankName(p.bank)}`, RING.cx, RING.cy + 6, 15, INK, 300, 'center', 0.5);
  const w = this.textWidth('BANK', 7, 700, 0.8) + 8;
  this.pill(RING.cx - w / 2, RING.cy + 12, w, 10, INK);
  this.text('BANK', RING.cx, RING.cy + 19.5, 7, BLACK, 700, 'center', 0.8);
}

/** EDIT, la colonne de droite : la chaine en grand, ce qui attend, l'aide. */
function paintChain(this: Screen): void {
  const p = patterns.get();
  const x = COL.x0;
  this.text('CHAIN', x, 42, 8, HALF, 700, 'left', 1);
  const chain = p.chain.length > 1 ? p.chain.map((k) => slotName(k)).join('  ') : slotName(p.cur);
  this.text(fit(chain, 22), x, 62, 13, INK, 400);
  if (p.next >= 0) this.text(`NEXT ${slotName(p.next)}`, x, 82, 9, INK, 600, 'left', 0.8);
}

/* ---------------- les trois reglages, facon OP-1 ---------------- */

/** Les trois reglages de la voix (VOLUME, TONE, DECAY) ou de la machine (SWING, STRETCH, MASTER). */
function paintCards(this: Screen, inst: Inst | null): void {
  // Les valeurs de 0 a 127 depuis le 2026-10-08 (Mika : "de 0 a 127"), celles des blocs de la vue PAGE et du MIDI
  const fx = inst ? voiceFx.of(inst) : null;
  const cards: { label: string; text: string; draw: (r: Rect) => void }[] = fx
    ? [
        { label: 'VOLUME', text: v127Text(fx.level), draw: (r) => this.drawLevel(r, fx.level) },
        { label: 'TONE', text: v127Text((fx.tone + 1) / 2, true), draw: (r) => this.drawTone(r, fx.tone) },
        { label: 'DECAY', text: v127Text(fx.decay), draw: (r) => this.drawDecay(r, fx.decay) },
      ]
    : [
        { label: 'SWING', text: v127Text(mix.swing), draw: (r) => this.drawSwing(r, mix.swing) },
        { label: 'STRETCH', text: v127Text((mix.stretch + 1) / 2, true), draw: (r) => this.drawStretch(r, mix.stretch) },
        { label: 'MASTER', text: v127Text(mix.level), draw: (r) => this.drawLevel(r, mix.level) },
      ];
  const w = (COL.x1 - COL.x0 - CARD.gap * (cards.length - 1)) / cards.length;
  cards.forEach((card, i) => {
    const x0 = COL.x0 + i * (w + CARD.gap);
    card.draw({ x0, y0: CARD.y0, x1: x0 + w, y1: CARD.y1 });
    this.text(card.label, x0, CARD.label, 7, HALF, 700, 'left', 0.9);
    this.text(card.text, x0, CARD.value, 13, INK, 400);
  });
}

/** VOLUME, MASTER : des barres qui montent, allumees jusqu'a la valeur. */
function drawLevel(this: Screen, r: Rect, v: number): void {
  const n = 7;
  const gap = 2.4 * Screen.cardK(r);
  const bw = (r.x1 - r.x0 - gap * (n - 1)) / n;
  const lit = Math.max(0, Math.min(1, v)) * n;
  const base = Math.min(6, 0.3 * (r.y1 - r.y0));
  for (let k = 0; k < n; k += 1) {
    const h = base + ((r.y1 - r.y0 - base) * (k + 1)) / n;
    const x = r.x0 + k * (bw + gap);
    const on = k + 1 <= lit + 1e-6 ? this.pal.ink : k < lit ? this.pal.half : this.pal.faint;
    this.ctx.fillStyle = on;
    this.ctx.fillRect(x, r.y1 - h, bw, h);
  }
}

/** TONE, STRETCH : une courbe de filtre qui bascule (a gauche plus sombre, a droite plus brillant). */
function drawTone(this: Screen, r: Rect, v: number): void {
  const { x0, x1 } = r;
  const mid = (r.y0 + r.y1) / 2;
  const amp = (r.y1 - r.y0) / 2 - 2;
  const pts: number[] = [];
  const n = 28;
  for (let k = 0; k <= n; k += 1) {
    const t = k / n;
    const s = 1 / (1 + Math.exp(-(t - 0.5) * 9));
    pts.push(x0 + (x1 - x0) * t, mid - v * amp * (2 * s - 1));
  }
  this.line([x0, mid, x1, mid], this.pal.faint, 0.8);
  this.line(pts, this.pal.ink, 2 * Math.max(0.7, Screen.cardK(r)));
}

/** DECAY : une enveloppe, l'attaque puis la queue, plus longue avec la valeur. */
function drawDecay(this: Screen, r: Rect, v: number): void {
  const { x0, x1 } = r;
  const base = r.y1;
  const top = r.y0 + 2;
  const ax = x0 + 3 * Math.max(0.5, Screen.cardK(r));
  const tau = 0.08 + 0.6 * Math.max(0, Math.min(1, v));
  const pts: number[] = [x0, base, ax, top];
  const n = 30;
  for (let k = 1; k <= n; k += 1) {
    const t = k / n;
    pts.push(ax + (x1 - ax) * t, base - (base - top) * Math.exp(-t / tau));
  }
  this.line([x0, base, x1, base], this.pal.faint, 0.8);
  this.line(pts, this.pal.ink, 2 * Math.max(0.7, Screen.cardK(r)));
}

/** SWING : quatre paires de points, la seconde de chaque paire decalee par le swing. */
function drawSwing(this: Screen, r: Rect, v: number): void {
  const { x0, x1 } = r;
  const n = 4;
  const cell = (x1 - x0) / n;
  const y = (r.y0 + r.y1) / 2;
  const ks = Screen.cardK(r);
  this.line([x0, y, x1, y], this.pal.faint, 0.8);
  for (let k = 0; k < n; k += 1) {
    const xa = x0 + k * cell + cell * 0.18;
    const xb = x0 + k * cell + cell * (0.5 + 0.32 * Math.max(0, Math.min(1, v)));
    this.circle(xa, y, 3.4 * ks, this.pal.ink);
    this.circle(xb, y, 2.6 * ks, this.pal.half);
  }
}

/** STRETCH : une onde dont la longueur s'etire ou se resserre. */
function drawStretch(this: Screen, r: Rect, v: number): void {
  const { x0, x1 } = r;
  const mid = (r.y0 + r.y1) / 2;
  const amp = (r.y1 - r.y0) / 2 - 3;
  const cycles = 3 * Math.pow(2, -Math.max(-1, Math.min(1, v)));
  const pts: number[] = [];
  const n = 48;
  for (let k = 0; k <= n; k += 1) {
    const t = k / n;
    pts.push(x0 + (x1 - x0) * t, mid - amp * Math.sin(t * cycles * Math.PI * 2) * Math.exp(-t * 1.6));
  }
  this.line([x0, mid, x1, mid], this.pal.faint, 0.8);
  this.line(pts, this.pal.ink, 2 * Math.max(0.7, Screen.cardK(r)));
}

/**
 * COND (V.5.1) : A:B, une case par passage du cycle, celle qui joue pleine (!A:B : les autres pleines) ; les autres
 * conditions, une ligne et un point (NONE : la ligne seule ; FILL, PRE, NEI, 1ST, LST : la valeur les dit en toutes lettres).
 */
function drawCond(this: Screen, r: Rect, i: number): void {
  const c = CONDS[Math.max(0, Math.min(CONDS.length - 1, i))];
  const y = (r.y0 + r.y1) / 2;
  if (c.kind !== 'ab') {
    this.line([r.x0, y, r.x1, y], this.pal.faint, 1.2);
    if (c.kind !== 'none') this.circle(r.x0 + (r.x1 - r.x0) / 2, y, 2.2, c.not ? this.pal.half : this.pal.ink);
    return;
  }
  const gap = 1.6;
  const w = Math.min(7, (r.x1 - r.x0 - gap * (c.b - 1)) / c.b);
  const h = Math.min(r.y1 - r.y0 - 2, w + 2);
  const x0 = r.x0 + (r.x1 - r.x0 - (w * c.b + gap * (c.b - 1))) / 2;
  for (let k = 0; k < c.b; k += 1) {
    const on = (k === c.a - 1) !== c.not;
    const x = x0 + k * (w + gap);
    if (on) this.roundRect(x, y - h / 2, w, h, 1, this.pal.ink);
    else this.roundRect(x + 0.4, y - h / 2 + 0.4, w - 0.8, h - 0.8, 1, null, this.pal.half, 0.8);
  }
}

/** RATE (V.5.1) : les repetitions d'un temps (quatre pas), un trait chacune, les pas reperes a peine. */
function drawRate(this: Screen, r: Rect, i: number): void {
  const den = RATE_DENS[Math.max(0, Math.min(RATE_DENS.length - 1, i))];
  const span = r.x1 - r.x0;
  const base = r.y1;
  const top = r.y0 + 2;
  this.line([r.x0, base, r.x1, base], this.pal.faint, 0.8);
  for (let k = 1; k < 4; k += 1) this.line([r.x0 + (span * k) / 4, base, r.x0 + (span * k) / 4, base - 2], this.pal.faint, 0.6);
  // Un temps = quatre pas : den / 4 repetitions (1/1 : une par mesure, un seul trait au debut)
  const n = Math.max(1, Math.min(24, Math.round(den / 4)));
  for (let k = 0; k < n; k += 1) {
    const x = r.x0 + (span * k) / n + 0.6;
    this.line([x, base, x, top], k === 0 ? this.pal.ink : this.pal.half, k === 0 ? 1.6 : 1.1);
  }
}

/** VFAD (V.5.1) : six repetitions, leur hauteur menee par VFAD (elle descend, monte, ou reste). */
function drawVfad(this: Screen, r: Rect, v: number): void {
  const n = 6;
  const gap = 2;
  const bw = (r.x1 - r.x0 - gap * (n - 1)) / n;
  for (let k = 0; k < n; k += 1) {
    const g = rtrgGain(1, v, k / (n - 1));
    const h = Math.max(1.2, (r.y1 - r.y0 - 1) * g);
    this.ctx.fillStyle = k === 0 ? this.pal.ink : this.pal.half;
    this.ctx.fillRect(r.x0 + k * (bw + gap), r.y1 - h, bw, h);
  }
}

/** WAVE (V.5.1) : la forme du LFO sur un cycle et demi, son zero a peine (EXP et RMP partent du bas : unipolaires). */
function drawWave(this: Screen, r: Rect, i: number): void {
  const w = LFO_WAVES[Math.max(0, Math.min(LFO_WAVES.length - 1, i))];
  const mid = (r.y0 + r.y1) / 2;
  const amp = (r.y1 - r.y0) / 2 - 1.5;
  const uni = w === 'EXP' || w === 'RMP';
  const pts: number[] = [];
  const n = 54;
  for (let k = 0; k <= n; k += 1) {
    const u = (k / n) * 1.5;
    const val = waveAt(w, Math.min(u, 1.4999), 7);
    pts.push(r.x0 + (r.x1 - r.x0) * (k / n), uni ? r.y1 - 1.5 - val * 2 * amp : mid - val * amp);
  }
  this.line([r.x0, uni ? r.y1 - 1.5 : mid, r.x1, uni ? r.y1 - 1.5 : mid], this.pal.faint, 0.8);
  this.line(pts, this.pal.ink, 1.6 * Math.max(0.7, Screen.cardK(r)));
}

/** Des crans (SOUND, GATE) : un point par cran, le choisi en grand ; plus de 12 : une barre. */
function drawNotch(this: Screen, r: Rect, n: number, course: number): void {
  if (n < 2 || n > 12) {
    this.drawBar(r, course, false);
    return;
  }
  const y = (r.y0 + r.y1) / 2;
  const cur = Math.round(clamp01(course) * (n - 1));
  const step = (r.x1 - r.x0) / (n - 1);
  for (let i = 0; i < n; i += 1) {
    const x = r.x0 + i * step;
    if (i === cur) this.circle(x, y, n > 6 ? 1.7 : 2.3, this.pal.ink);
    else this.circle(x, y, 0.8, this.pal.half);
  }
}

/** Une barre : le trait a peine, la valeur pleine et son point ; centre : depuis le milieu (son repere). */
function drawBar(this: Screen, r: Rect, course: number, centre: boolean): void {
  const y = (r.y0 + r.y1) / 2;
  const x = r.x0 + (r.x1 - r.x0) * clamp01(course);
  const from = centre ? (r.x0 + r.x1) / 2 : r.x0;
  this.line([r.x0, y, r.x1, y], this.pal.faint, 1.4);
  if (centre) this.line([from, y - 2.4, from, y + 2.4], this.pal.half, 0.8);
  this.line([from, y, x, y], this.pal.ink, 1.8);
  this.circle(x, y, 2, this.pal.ink);
}

/**
 * START (2026-10-08) : une onde qui s'eteint, le repere du debut ; ce qui
 * est avant lui (saute) a peine.
 */
function drawStart(this: Screen, r: Rect, course: number): void {
  const { x0, x1 } = r;
  const mid = (r.y0 + r.y1) / 2;
  const amp = (r.y1 - r.y0) / 2 - 1;
  const cut = x0 + (x1 - x0) * clamp01(course) * 0.9;
  const n = 40;
  const before: number[] = [];
  const after: number[] = [];
  for (let k = 0; k <= n; k += 1) {
    const t = k / n;
    const x = x0 + (x1 - x0) * t;
    const y = mid - amp * Math.sin(t * 5.5 * Math.PI * 2) * Math.exp(-t * 2.6);
    if (x <= cut) before.push(x, y);
    if (x >= cut - (x1 - x0) / n) after.push(x, y);
  }
  if (before.length >= 4) this.line(before, this.pal.faint, 1.2);
  if (after.length >= 4) this.line(after, this.pal.ink, 1.4 * Math.max(0.7, Screen.cardK(r)));
  this.line([cut, r.y0, cut, r.y1], this.pal.ink, 1.2);
}

/**
 * La ligne du bas a droite (HOME, EDIT) : le message du moment, ou la piste
 * et sa barre, sinon rien ; la page MIX n'y ecrit rien. La vue PAGE a son
 * pied (paintFoot).
 */
function paintLine(this: Screen, s: LcdState, rytmEdit: boolean): void {
  const x0 = COL.x0;
  const x1 = COL.x1;
  if (s.mix) return;
  if (s.bar !== null) {
    // La piste : son titre, la position et la duree, une barre fine et son point
    const title = s.l2.trim();
    this.text(fit(title, 26), x0, LINE.y - 9, 7, HALF, 600, 'left', 0.5);
    const lw = this.text(s.l3, x0, LINE.y + 4, 7, INK, 600);
    const rw = this.text(s.r3, x1, LINE.y + 4, 7, INK, 600, 'right');
    const a = x0 + lw + 5;
    const b = x1 - rw - 5;
    if (b - a > 10) {
      const y = LINE.y + 1.5;
      const v = Math.max(0, Math.min(1, s.bar));
      this.line([a, y, b, y], FAINT, 1.4);
      this.line([a, y, a + (b - a) * v, y], INK, 1.8);
      this.circle(a + (b - a) * v, y, 2.6, INK);
      this.bar = { x0: a * TEX_K, x1: b * TEX_K, y0: (LINE.y - 8) * TEX_K, y1: (LINE.y + 8) * TEX_K };
    }
    return;
  }
  if (s.l3) {
    // A la largeur de la colonne (le message garde 40 lettres depuis le 2026-10-08, state/lcd.ts)
    this.text(this.fitText(s.l3, x1 - x0, 9, 0.6, 600), x0, LINE.y, 9, INK, 600, 'left', 0.6);
    return;
  }
  // La vue BANK (V.5.2) : ce que font ses pas
  if (rytmEdit) this.text(DT_FACE && dtFace.bank() ? 'STEPS 1-8: BANKS A-H   PTN: BACK' : 'TAP: PLAY   TAP TAP: CHAIN', x0, LINE.y, 7, FAINT_TEXT, 700, 'left', 0.6);
  else if (this.paintMode(x0, x1)) return;
  // Les presets (V.4.2 : au desktop l'ecran ne se touche plus, EDIT pressee deux fois les ouvre)
  else if (s.tag) this.text(SCREEN_TOUCH ? 'TOUCH: PRESETS' : DT_FACE ? 'PTN 2X: KIT' : 'EDIT 2X: PRESETS', x1, LINE.y, 6.5, FAINT_TEXT, 700, 'right', 0.8);
}

/**
 * Le menu de la voix sous HOME (2026-10-18, HOME_MENU) : dans la bande que le dessin de 120 laisse en bas de l'ecran
 * haut (DY), cinq touches en contour, de bord a bord ; sans voix choisie, SOUND a peine. Leurs zones : menuRects.
 */
function paintHomeMenu(this: Screen, inst: Inst | null): void {
  if (DY < 12) return;
  const n = HOME_MENU.length;
  const x0 = 10;
  const x1 = UW - 10;
  const gap = 6;
  const h = Math.min(14, DY - 4);
  const y = UH - h - 2.5;
  const w = (x1 - x0 - gap * (n - 1)) / n;
  const size = this.mobile ? 7.5 : 7;
  // La barre de la piste, deja dessinee par paintLine (2026-10-22, revue RB3-1) : ses bords en unites, un peu d'air
  const bx = this.mobile && this.bar ? [this.bar.x0 / TEX_K - 4, this.bar.x1 / TEX_K + 4] : null;
  HOME_MENU.forEach((id, i) => {
    const x = x0 + i * (w + gap);
    const off = id === 'sound' && !inst;
    this.roundRect(x, y, w, h, 3.5, null, off ? FRAME_DIM : HALF, 1.1);
    this.text(HOME_MENU_LABEL[id], x + w / 2, y + h / 2 + size * 0.36, size, off ? FAINT : INK, 700, 'center', 0.8);
    // Au telephone, la zone monte au-dessus de la touche jusqu'au bas du verre (MENU_HIT_TOP, 2026-10-22). Revue RB3-1
    // (2026-10-22) : sous la barre de la piste (FLTR ENV FX), elle s'arrete au bas de sa bande (OLED_BAR.bandY1), une
    // tape ou un glisse sur la barre fait avancer la piste au lieu d'ouvrir la page ; SOUND et VOICE, loin de la barre,
    // gardent toute leur hauteur (la bande ramenerait la piste au debut)
    const overBar = bx !== null && x < bx[1] && x + w > bx[0];
    const top = !this.mobile ? y : overBar ? Math.max(DY + MENU_HIT_TOP, OLED_BAR.bandY1 / TEX_K) : DY + MENU_HIT_TOP;
    this.menuRects.push({ id: `lcd-menu-${id}`, ...this.spot({ x, y: top, w, h: this.mobile ? UH - top : h }) });
    this.info.menu.push(off ? `-${HOME_MENU_LABEL[id]}` : HOME_MENU_LABEL[id]);
  });
}

/**
 * La bande du haut de HOME (2026-10-19), au-dessus de son dessin de 120 : la
 * lecture a gauche, comme l'en-tete de la vue PAGE ; a droite le pattern,
 * MASTER et TEMPO, a la meme place que dans la vue PAGE. Au telephone, leurs
 * zones descendent dans l'air libre jusqu'au-dessus des cartes (CARD.y0, a
 * 4 pres) : 40 px de haut a 390 de large au lieu de 22, le doigt ne tombe pas
 * sur lcd-open (les presets) juste sous elles.
 */
function paintHomeHead(this: Screen, cur: number, now: number, preset: LcdState['preset'] = null): void {
  if (DY < 12) return;
  this.runIcon(PAGE_HEAD.iconX, PAGE_HEAD.y);
  const left = this.paintDials(PAGE_HEAD.y, PAGE_HEAD.iconX + 14, this.mobile ? DY + CARD.y0 - 4 : DY + 6, now, cur);
  // FILL tenu (V.5.1, tenir YES) : sa pastille pleine juste apres la lecture, le preset charge passe apres elle ; LIVE REC
  // (V.5.3) avant elle
  let fx0 = PAGE_HEAD.iconX + 14;
  if (DT_FACE && dtFace.live()) {
    const ts = this.bt.head.sound;
    const ph = this.bt.head.pillH;
    const w = this.textWidth('LIVE REC', ts, 800, 0.6) + 8;
    if (left - 8 - fx0 >= w) {
      const py = PAGE_HEAD.pillY;
      this.roundRect(fx0, py, w, ph, 2.2, INK);
      this.text('LIVE REC', fx0 + w / 2, py + ph / 2 + ts * 0.36, ts, BLACK, 800, 'center', 0.6);
      this.info.head = 'LIVE REC';
      fx0 += w + 6;
    }
  }
  if (DT_FACE && fill.on) {
    const ts = this.bt.head.sound;
    const ph = this.bt.head.pillH;
    const w = this.textWidth('FILL', ts, 800, 0.6) + 8;
    if (left - 8 - fx0 >= w) {
      const py = PAGE_HEAD.pillY;
      this.roundRect(fx0, py, w, ph, 2.2, INK);
      this.text('FILL', fx0 + w / 2, py + ph / 2 + ts * 0.36, ts, BLACK, 800, 'center', 0.6);
      this.info.head = this.info.head ? `${this.info.head}|FILL` : 'FILL';
      fx0 += w + 6;
    }
  }
  // Le preset charge (2026-10-27) : dans l'air entre la lecture et le pattern, une etoile s'il a bouge ; il cede sa
  // place (coupe d'un point, ou rien sous 30 unites), jamais le pattern, MASTER ni TEMPO
  if (preset) {
    const x0 = fx0;
    const room = left - 8 - x0;
    if (room >= 30) {
      const label = this.fitText(`${preset.label}${preset.edited ? '*' : ''}`, room, 8.5, 0.6, 600);
      this.text(label, x0, PAGE_HEAD.y - 0.5, 8.5, HALF, 600, 'left', 0.6);
      this.info.presetHead = label;
    }
  }
}

defineMethods(Screen, { paintStepRing, maxVel, paintPatternRing, paintBankRing, paintChain, paintCards, drawLevel, drawTone, drawDecay, drawSwing, drawStretch, drawCond, drawRate, drawVfad, drawWave, drawNotch, drawBar, drawStart, paintLine, paintHomeMenu, paintHomeHead });
