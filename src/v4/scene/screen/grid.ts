/**
 * L'ecran du MM-RYTM : la grille des blocs de la vue PAGE (2 x 4, un bloc par case, les cases libres). Methodes de Screen deplacees telles quelles de scene/screen.ts en P0 (2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), devenues des fonctions (this: Screen) posees sur Screen.prototype.
 */

import { clock } from '../../audio/clock';
import { pattern, velocity } from '../../audio/pattern';
import { lockOf } from '../../audio/locks';
import { sceneCtl } from '../../state/sceneCtl';
import { type LcdState } from '../../state/lcd';
import { playhead } from '../../state/playhead';
import { type RytmPageState } from '../../state/rytmPage';
import { voices } from '../../state/voices';
import { type Inst } from '../../theme';
import { FACE_PAGES, freeCells, pageSlots, type PageSlot } from '../../rytm/pages';
import { pageBlocks, screenIn, type Block, type BlockMode } from '../../rytm/pageView';
import { fill } from '../../state/fill';
import { BLACK, BLOCK, cellRect, FACE_STRIP, FACE_TEXT_SIZES, FACE_UNIT_SHRINK, FLASH, FRAME, FRAME_DIM, HALF, HOVER_FILL, INK, MATRIX, METER_MS, PAL, PAL_NEG, type PanelArea, pmutesNow, type Rect, TALL, TALL_VALUE } from './consts';
import { Screen } from './core';
import { defineMethods } from './proto';

declare module './core' {
  interface Screen {
    paintPage: typeof paintPage;
    blockMode: typeof blockMode;
    paintGhosts: typeof paintGhosts;
    padlock: typeof padlock;
    paintMatrix: typeof paintMatrix;
    paintBlock: typeof paintBlock;
  }
}

/* ---------------- la vue PAGE (2026-10-08 ; l'etape 2, 2026-10-09) ---------------- */

/**
 * La vue PAGE : l'en-tete (la page, ses onglets, la voix ; en P-LOCK tout en
 * negatif), les blocs de l'ecran dans leurs cases (le navigateur des sons,
 * 2026-10-18, a son propre dessin : paintBrowser), le pied (les seize pas et la tete de lecture, le
 * message, la piste, MUTE et SOLO, l'aide) ; le popup d'un encodeur du
 * desktop par-dessus. Rend dans combien de ms il faut un autre dessin (la fin
 * de l'echo, du popup ; 0 : aucun ; paint() en arme le minuteur).
 */
function paintPage(this: Screen, s: LcdState, rp: RytmPageState, inst: Inst | null, cur: number, now: number, lockStep: number): number {
  let next = 0;
  this.meterLive = false;
  const mode = this.blockMode(inst, lockStep, now);
  const screen = screenIn(rp, inst);
  this.info.screen = screen;
  // L'en-tete dit ce que joue le pas montre (revue de R3)
  const shownLock = !inst || !mode ? null : mode.kind === 'lock' ? lockOf(pattern.get().locks, inst, mode.step) : mode.kind === 'flash' ? mode.lock : null;
  this.paintPageHead(rp, screen, inst, cur, now, lockStep, shownLock, mode);
  this.blockRects = [];
  {
    const blocks = pageBlocks(rp, inst, now, mode);
    this.paintMatrix(blocks, inst, mode);
    for (const b of blocks) if (b.state !== 'empty' && !b.graph) this.blockRects.push({ k: b.k, ...this.spot(cellRect(b.cell)) });
    // INFOS (R4) : le bloc dont la carte est montree, ses quatre coins
    const ik = this.infoKnob();
    if (ik >= 0 && blocks[ik] && blocks[ik].state !== 'empty') this.infoMarks(blocks[ik].cell, ik);
    // Les verrous du pas, toutes pages, dans la place que l'ecran laisse vide (revue de R2)
    const slots = pageSlots(screen, inst);
    const panel = mode && mode.kind !== 'scene' ? this.paintLockPanel(slots, mode.step, mode.kind === 'flash' ? mode.lock : undefined) : null;
    // Les cases libres : un cadre en pointilles (au telephone les blocs sont les potards ; au desktop aussi depuis le 2026-10-09)
    this.paintGhosts(slots, panel);
    this.info.blocks = blocks.map((b) => `${b.label}=${b.text}:${b.state}${b.lock !== 'none' ? `/${b.lock}` : ''}${b.flash ? '!' : ''}${b.quiet ? '~' : ''}${b.morph ? `@${b.morph}` : ''}`);
    // Un bloc morphe a l'ecran (P2-20) : le crossfader qui bouge le redessine (xTick)
    if (blocks.some((b) => b.morph)) this.xLive = true;
    this.info.flash = blocks.filter((b) => b.flash).map((b) => b.k);
    this.info.cells = blocks.map((b) => `${b.cell.c},${b.cell.r},${b.cell.w},${b.cell.h}`);
    const echo = blocks.find((b) => b.echo);
    if (echo) this.info.echo = echo.k;
    this.info.hover = rp.hover;
    // La fin de l'echo a son heure ; un bloc tenu reste cerne sans minuteur, son lacher redessine
    if (echo && rp.echo && rp.echo.page === screen && now < rp.echo.until) next = Math.max(1, rp.echo.until - now + 1);
  }
  this.paintStrip(inst, rp.sel, lockStep, mode && mode.kind === 'flash' ? mode.step : -1);
  const more = this.paintFoot(s, screen, lockStep, now, mode && mode.kind === 'flash' ? mode : null);
  if (more > 0) next = next > 0 ? Math.min(next, more) : more;
  // Le popup d'un encodeur du desktop (2026-10-09) : son FX global par-dessus, un instant
  const pop = rp.popup;
  this.info.popup = '';
  if (pop && now < pop.until) {
    this.paintPopup(pop.id);
    next = next > 0 ? Math.min(next, pop.until - now + 1) : pop.until - now + 1;
  }
  // L'aiguille du COMP (2026-10-18) : une image toutes les 50 ms tant qu'elle bouge
  if (this.meterLive) next = next > 0 ? Math.min(next, METER_MS) : METER_MS;
  return next;
}

/**
 * Les verrous a montrer (2026-10-08) : ceux du pas en P-LOCK ; sinon, en
 * lecture, ceux du pas qui joue s'il sonne (un coup, la voix pas coupee).
 * Depuis la revue de R2, le flash tient jusqu'au coup suivant de la voix,
 * au moins FLASH.min pour se lire, au plus FLASH.max.
 */
function blockMode(this: Screen, inst: Inst | null, lockStep: number, now: number): BlockMode | null {
  if (lockStep >= 0) {
    this.flash = null;
    return { kind: 'lock', step: lockStep };
  }
  // Une scene armee (2026-10-27, P2-19) : ses cles sur les blocs, son en-tete ; jamais avec un P-LOCK garde
  const arm = sceneCtl.get().armed;
  if (arm) {
    this.flash = null;
    return { kind: 'scene', which: arm };
  }
  if (!inst || !clock.running) {
    this.flash = null;
    this.flashHead = -1;
    return null;
  }
  const head = playhead.get();
  if (head !== this.flashHead) {
    this.flashHead = head;
    if (head >= 0 && velocity(pattern.get().steps, inst, head) > 0 && voices.plays(inst, pmutesNow())) {
      const lock = lockOf(pattern.get().locks, inst, head);
      const f = this.flash;
      if (lock) this.flash = { inst, step: head, lock, from: now, end: now + FLASH.max };
      else if (f) f.end = Math.min(f.end, Math.max(now, f.from + FLASH.min));
    }
  }
  const f = this.flash;
  if (f && (f.inst !== inst || now >= f.end)) this.flash = null;
  return this.flash ? { kind: 'flash', step: this.flash.step, lock: this.flash.lock } : null;
}

/**
 * Les cases libres d'un ecran (revue du 2026-10-09 : une page creuse, un
 * seul bloc sur un ecran noir, la grille disparaissait) : un cadre en
 * pointilles a peine marque, sauf la ou le panneau des verrous a pris la place.
 */
function paintGhosts(this: Screen, slots: readonly PageSlot[], panel: PanelArea | null): void {
  const M = MATRIX;
  const c = this.ctx;
  c.save();
  c.setLineDash([2.4, 2.2]);
  for (const f of freeCells(slots)) {
    if (panel && f.c >= panel.c0 && f.c < panel.c0 + panel.n && f.r >= panel.r0 && f.r < panel.r0 + panel.rows) continue;
    this.roundRect(M.x0 + M.pitch * f.c + 0.5, M.rows[f.r] + 0.5, M.w - 1, M.h - 1, M.r, null, FRAME_DIM, 0.7);
  }
  c.restore();
}

/** Un petit cadenas (x : son bord gauche, y : le bas de son corps), plein. */
function padlock(this: Screen, x: number, y: number, s: number, color: string): void {
  const c = this.ctx;
  const w = s;
  const h = s * 0.72;
  c.fillStyle = color;
  c.fillRect(x, y - h, w, h);
  c.beginPath();
  c.arc(x + w / 2, y - h, w * 0.32, Math.PI, 0);
  c.strokeStyle = color;
  c.lineWidth = Math.max(0.7, s * 0.17);
  c.stroke();
}

/** Les blocs de l'ecran dans leurs cases ; les dessins (l'enveloppe, le filtre) a leur place. */
function paintMatrix(this: Screen, blocks: readonly Block[], inst: Inst | null, mode: BlockMode | null): void {
  const c = this.ctx;
  for (const b of blocks) {
    if (b.state === 'empty') continue;
    if (b.graph) this.paintGraph(b, inst, mode);
    else this.paintBlock(b);
    this.pal = PAL;
    c.globalAlpha = 1;
  }
}

/**
 * Un bloc de la vue PAGE, dans sa case (une, deux de large, deux de haut).
 * En negatif (2026-10-08) : son verrou sur le pas en P-LOCK, ou celui du pas
 * qui joue, avec le coin P (2026-10-09) ; en retrait : la valeur de la voix
 * en P-LOCK (base), a peine : GLOBAL. La souris dessus (desktop, 2026-10-09) :
 * un cadre un peu plus marque ; tenu ou tourne : le contour plein (l'echo).
 */
function paintBlock(this: Screen, b: Block): void {
  const c = this.ctx;
  const M = MATRIX;
  const R = cellRect(b.cell);
  const bx = R.x;
  const by = R.y;
  const bw = R.w;
  const bh = R.h;
  const B = BLOCK;
  const alive = b.state === 'live';
  const neg = alive && (b.lock === 'locked' || b.flash);
  const alpha = b.lock === 'base' ? (b.quiet ? 0.4 : 0.6) : b.lock === 'global' || b.lock === 'nolock' ? 0.32 : b.quiet ? 0.42 : 1;
  if (neg) {
    this.roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, M.r, INK);
    if (b.echo) this.roundRect(bx - 1, by - 1, bw + 2, bh + 2, M.r + 1.2, null, INK, 0.9);
    // Le coin P (2026-10-09) : ce bloc porte un verrou sur ce pas
    const k = TALL ? 11 : 9;
    c.beginPath();
    c.moveTo(bx + bw - k - 0.5, by + 0.5);
    c.lineTo(bx + bw - 0.5 - M.r * 0.4, by + 0.5);
    c.quadraticCurveTo(bx + bw - 0.5, by + 0.5, bx + bw - 0.5, by + 0.5 + M.r * 0.4);
    c.lineTo(bx + bw - 0.5, by + k + 0.5);
    c.closePath();
    c.fillStyle = BLACK;
    c.fill();
    this.text(b.corner ?? 'P', bx + bw - 1.6, by + k * 0.52, k * 0.55, INK, 800, 'right');
  } else {
    c.globalAlpha = b.echo || b.hover ? 1 : alpha;
    if (b.hover && !b.echo) this.roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, M.r, HOVER_FILL, HALF, 0.8);
    else this.roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, M.r, null, b.echo ? INK : alive ? FRAME : FRAME_DIM, b.echo ? 1.2 : 0.7);
    // Un reglage qui se morphe (P2-20) : son coin A, B ou AB, en clair (la valeur est ce qui joue au crossfader)
    if (b.morph && alive) {
      const k = TALL ? 11 : 9;
      this.text(b.morph, bx + bw - 1.6, by + k * 0.52, k * 0.55, HALF, 800, 'right');
    }
  }
  this.pal = neg ? PAL_NEG : PAL;
  c.globalAlpha = neg ? 1 : alpha;
  const P = this.pal;
  const T = this.bt;
  const wide = b.cell.w > 1;
  const tall = b.cell.h > 1;
  // L'etiquette (BOTH, MACHINE, NO BD, ALL, la voix, STEP) : une seule place par ecran (revue du 2026-10-09 : elle sautait
  // de la ligne du nom a celle de l'unite d'un bloc a l'autre, et l'unite rognee pour elle se lisait 5. ou H.) : au desktop
  // a droite du nom ; au telephone au bout de la ligne d'unite (le nom y prend la largeur), sans celles que l'en-tete dit
  // deja (MACHINE : l'onglet SYNTH ; ALL : GLOBAL ; la voix : BD FX). Elle s'efface plutot que de couper l'unite. En
  // P-LOCK, un bloc qu'on ne verrouille pas dit GLOBAL ou NO LOCK a la place de son unite.
  const muted = b.lock === 'global' || b.lock === 'nolock';
  const onName = T.tagAt === 'name';
  const tag = muted || !b.tag || (!onName && b.tagHeader) ? '' : b.tag;
  const tagColor = b.noBd || b.all ? P.faintText : P.half;
  const tagSp = onName ? 0.5 : 0.2;
  const tagW = (t: string): number => this.textWidth(t, T.tagSize, 700, tagSp);
  const cornerW = neg || (b.morph && alive) ? (TALL ? 12 : 10) : 0;
  const nameRoom = bw - 2 * B.padX - cornerW;
  const nameW = this.textWidth(b.label, T.nameSize, 700, 0.7);
  const nameTag = tag && onName && nameW + tagW(tag) + 5 <= nameRoom ? tag : '';
  const ntw = nameTag ? tagW(nameTag) + 5 : 0;
  // Un nom qui ne tient pas (2026-10-10, FEEDBACK de la page DELAY au telephone : FEEDBA.) : un corps plus petit avant de le couper
  const nameSize = nameW <= nameRoom - ntw ? T.nameSize : ([0.9, 0.82].map((f) => T.nameSize * f).find((s) => this.textWidth(b.label, s, 700, 0.7) <= nameRoom - ntw) ?? T.nameSize);
  this.text(this.fitText(b.label, nameRoom - ntw, nameSize, 0.7, 700), bx + B.padX, by + T.nameDy, nameSize, alive ? P.half : P.faint, 700, 'left', 0.7);
  if (nameTag) this.text(nameTag, bx + bw - B.padX - cornerW, by + T.nameDy, T.tagSize, tagColor, 700, 'right', tagSp);
  if (!alive) {
    // Une voix a un seul son (CY) : son nom quand meme, a peine
    const t = b.text && b.text !== '--' ? b.text : '--';
    this.text(this.fitText(t, bw - 2 * B.padX, T.valueSizes[1], 0, 300), bx + B.padX, by + T.valueDy, T.valueSizes[1], P.faint, 300);
    // Sa forme courte quand l'unite ne tient pas (2026-10-22, revue INT-4 : PICK A VOI. dans PITCH et FINE)
    const offUnit = b.unit && b.unitShort && this.textWidth(b.unit, T.unitSize, 600, 0.4) > bw - 2 * B.padX ? b.unitShort : b.unit;
    if (offUnit) this.text(this.fitText(offUnit, bw - 2 * B.padX, T.unitSize), bx + B.padX, by + T.unitDy, T.unitSize, P.faint, 600, 'left', 0.4);
    this.info.tags.push(`${b.label}:${b.unit}|${nameTag ? `${nameTag}@name` : ''}`);
    return;
  }
  // La place de l'image : a droite pour un bloc simple ; un grand bloc (SOUND) garde la largeur au nom du son ; un bloc
  // haut l'a sous l'unite, sa valeur prend la largeur
  // Au desktop (2026-10-27, la face : le bloc k au-dessus du potard k) SOUND, MIX et COMP tiennent sur une seule case :
  // leur dessin passe en bande au pied du bloc, sous la ligne d'unite (strip) ; SOUND et MIX y prennent toute la largeur
  // pour leur valeur (faceText : le nom du son, le melange), COMP garde son potard a droite
  const strip = FACE_PAGES && !tall && !wide && (b.draw === 'sound' || b.draw === 'mix' || b.draw === 'gr');
  const faceText = strip && b.draw !== 'gr';
  const under = tall || faceText;
  const drawW = under ? 0 : wide ? Math.min(54, bw * 0.34) : bw - B.draw.dx0 + 1;
  // COND (V.5.1) aussi : sa valeur (1:2, !FILL, NONE) prend toute la largeur, son dessin le bout de la ligne d'unite
  const stepped = b.draw === 'notch' || b.draw === 'ftype' || b.draw === 'time' || b.draw === 'cond';
  const valueRoom = muted || stepped || under ? bw - 2 * B.padX : wide ? bw - 2 * B.padX - drawW - 4 : B.valueW;
  // Une seule case (la face, 2026-10-27) : le nom d'un son ou le melange se serre encore un peu avant d'etre coupe
  const v = this.fitValue(b.text, valueRoom, wide ? 1 : 0, tall ? TALL_VALUE : 1, faceText ? FACE_TEXT_SIZES : []);
  // Un bloc haut : la valeur plus grosse descend d'autant, l'unite la suit
  const drop = tall ? T.valueSizes[0] * (TALL_VALUE - 1) * 0.72 + 2 : 0;
  const valueY = by + T.valueDy + drop;
  if (v.text.includes('/')) this.slashText(v.text, bx + B.padX, valueY, v.size, P.ink, neg ? 400 : 300);
  else this.text(v.text, bx + B.padX, valueY, v.size, P.ink, neg ? 400 : 300);
  const unitY = by + T.unitDy + drop;
  // Au desktop, les crans d'un reglage a crans tiennent le bout de la ligne d'unite
  const notchW = T.notchRow && stepped && !wide && !muted ? 24 : 0;
  // Un grand carre (2 x 2, la quantite d'un FX) : son potard tient la droite du bloc, la ligne d'unite et son etiquette
  // s'arretent avant lui (2026-10-10, le telephone : NO BD se posait sur l'arc de DELAY)
  const arcX = tall && wide && (b.draw === 'bar' || b.draw === 'barc') ? Math.max(bx + bw * 0.44, bx + B.padX + this.textWidth('127', v.size, 300) + 6) : 0;
  const unitRight = arcX > 0 ? arcX - 4 : bx + bw - B.padX - notchW;
  const room = unitRight - (bx + B.padX);
  if (muted) {
    this.text(this.fitText(b.tag, room, T.unitSize, 0.5, 700), bx + B.padX, unitY, T.unitSize, P.half, 700, 'left', 0.5);
    this.info.tags.push(`${b.label}:${b.tag}|`);
    return;
  }
  const uw = (u: string): number => this.textWidth(u, T.unitSize, 600, 0.4);
  let tail = onName ? '' : tag;
  const tailW = tail ? tagW(tail) + 3 : 0;
  let unit = b.unit;
  // Une seule case (la face, 2026-10-27 : SAMPLE 3 / 13, SYN 0 SMP 127) : l'unite entiere un peu plus petite, avant sa forme courte
  const uFit = faceText && unit && uw(unit) > room - tailW ? FACE_UNIT_SHRINK.map((f) => T.unitSize * f).find((z) => this.textWidth(unit, z, 600, 0.4) <= room - tailW) : undefined;
  const unitSize = uFit ?? T.unitSize;
  if (unit && unitSize === T.unitSize && uw(unit) > room - tailW) {
    // La forme courte de l'unite (NEW STEPS HIGH : NEW: HIGH) ; sinon l'unite entiere d'abord, l'etiquette s'efface
    if (b.unitShort && uw(b.unitShort) <= room - tailW) unit = b.unitShort;
    else {
      tail = '';
      if (b.unitShort && uw(unit) > room) unit = b.unitShort;
    }
  }
  if (tail) this.text(tail, unitRight, unitY, T.tagSize, tagColor, 700, 'right', tagSp);
  const u = unit ? this.fitText(unit, room - (tail ? tailW : 0), unitSize) : '';
  if (u) this.text(u, bx + B.padX, unitY, unitSize, P.half, 600, 'left', 0.4);
  this.info.tags.push(`${b.label}:${u}|${nameTag ? `${nameTag}@name` : tail ? `${tail}@unit` : ''}`);
  // L'image : un grand bloc (deux de haut) sous l'unite, sur toute sa largeur ; sinon a droite de la valeur
  let r: Rect;
  if (tall) {
    const top = unitY + (TALL ? 8 : 6);
    r = { x0: bx + B.padX + 2, y0: top, x1: bx + bw - B.padX - 2, y1: by + bh - (TALL ? 7 : 5) };
  } else if (wide) r = { x0: bx + bw - B.padX - drawW, y0: by + B.draw.dy0, x1: bx + bw - B.padX, y1: by + B.draw.dy1 };
  else r = { x0: bx + B.draw.dx0, y0: by + B.draw.dy0, x1: bx + B.draw.dx1, y1: by + B.draw.dy1 };
  if (strip) {
    // La bande du pied (2026-10-27) : de la ligne d'unite au bas du bloc, cinq unites
    const sr: Rect = { x0: bx + B.padX, y0: by + bh - FACE_STRIP.up, x1: bx + bw - B.padX, y1: by + bh - FACE_STRIP.down };
    if (b.draw === 'sound') this.drawSoundStrip(sr, b.notches, b.value);
    else if (b.draw === 'mix') this.drawMixStrip(sr, b.course, !b.quiet);
    else {
      this.drawArc(r, b.course, b.bipolar);
      this.drawGrStrip(sr, b.course);
    }
    return;
  }
  if (stepped) {
    // Un reglage a crans : au desktop ses crans au bout de la ligne du nom de valeur ; au telephone rien (la valeur le dit)
    if (!T.notchRow && !wide) return;
    const nr: Rect = wide ? r : { x0: bx + bw - B.padX - 22, y0: unitY - 4, x1: bx + bw - B.padX - 1, y1: unitY };
    if (b.draw === 'ftype') this.drawFtype(wide ? r : { x0: bx + B.draw.dx0 - 2, y0: by + B.draw.dy0, x1: bx + B.draw.dx1, y1: by + B.draw.dy1 }, b.value);
    else if (b.draw === 'cond') this.drawCond(nr, Math.round(b.value));
    else if (b.notches === 2) this.drawSwitch({ x0: nr.x1 - 13, y0: nr.y0 - 1.5, x1: nr.x1, y1: nr.y1 + 0.5 }, b.course >= 0.5);
    else this.drawNotch(nr, b.notches, b.course);
    return;
  }
  switch (b.draw) {
    case 'level':
      this.drawLevel(r, b.course);
      break;
    case 'tone':
      this.drawTone(r, b.value);
      break;
    case 'decay':
      this.drawDecay(r, b.course);
      break;
    case 'swing':
      this.drawSwing(r, b.value);
      break;
    case 'stretch':
      this.drawStretch(r, b.value);
      break;
    case 'start':
      this.drawStart(r, b.course);
      break;
    case 'sound':
      this.drawSoundList(r, b.notches, b.value);
      break;
    case 'mix':
      this.drawMix(r, b.course, !b.quiet);
      break;
    case 'atk':
      this.drawAtk(r, b.course);
      break;
    case 'hold':
      this.drawHold(r, b.course);
      break;
    case 'cut':
      this.drawCut(r, b.course);
      break;
    case 'reso':
      this.drawReso(r, b.course);
      break;
    case 'gr':
      this.drawGr(r, b.course, T.tagSize);
      break;
    // V.5.1 (2026-10-29, TRIG et MOD) : la condition, la vitesse du retrig, la velocite des repetitions, la forme du LFO
    case 'rate':
      this.drawRate(r, Math.round(b.value));
      break;
    case 'vfad':
      this.drawVfad(r, b.value);
      break;
    case 'wave':
      this.drawWave(r, Math.round(b.value));
      break;
    default:
      // Un grand carre (2 x 2, la quantite d'un FX sur sa page, 2026-10-10) : le potard a droite de la valeur, sur toute la
      // hauteur du bloc (sous l'unite, il restait petit au milieu d'un grand vide) ; jamais sur la valeur la plus large (127)
      if (tall && wide) this.drawBigArc({ x0: arcX, y0: by + T.nameDy + 4, x1: bx + bw - B.padX - 2, y1: by + bh - (TALL ? 7 : 5) }, b.course, b.draw === 'barc' || b.bipolar);
      else if (tall) this.drawBigArc(r, b.course, b.draw === 'barc' || b.bipolar);
      else this.drawArc(r, b.course, b.draw === 'barc' || b.bipolar);
  }
}

defineMethods(Screen, { paintPage, blockMode, paintGhosts, padlock, paintMatrix, paintBlock });
