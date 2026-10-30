/**
 * L'ecran du MM-RYTM : MASTER et TEMPO dans l'en-tete, leur plan de place, et la touche i (INFOS). Methodes de Screen deplacees telles quelles de scene/screen.ts en P0 (2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), devenues des fonctions (this: Screen) posees sur Screen.prototype.
 */

import { mix } from '../../audio/drums';
import { INSTRUMENTS, pattern } from '../../audio/pattern';
import { tempoSync } from '../../state/tempoSync';
import { slotName } from '../../state/patterns';
import { rytmInfos } from '../../state/rytmInfos';
import { rytmInfoHit } from '../../rytm/infoIds';
import { FACE_PAGES, RYTM_SCREENS, isRytmPage, SCREEN_PAGE, fxScopeTabs, type SlotCell } from '../../rytm/pages';
import { encUnit } from '../../rytm/values';
import { screenDials, type ScreenDialId } from '../../state/screenDials';
import { BLACK, cellRect, clamp01, DIAL_GAP, DIAL_REF, DIAL_TIERS, type DialGeom, type DialTier, FAINT, fit, HALF, HEAD_COL, HEAD_FIT, HEAD_FIT_MAX, HEAD_FIT_PHONE, type HeadPlan, HOVER_FILL, INFO_KEY, INK, PAGE_HEAD, UW } from './consts';
import { Screen } from './core';
import { defineMethods } from './proto';

declare module './core' {
  interface Screen {
    headPlan: typeof headPlan;
    dialRight: typeof dialRight;
    dialGeom: typeof dialGeom;
    paintDials: typeof paintDials;
    infoDial: typeof infoDial;
    paintInfoKey: typeof paintInfoKey;
    infoKnob: typeof infoKnob;
    infoMarks: typeof infoMarks;
  }
}

/**
 * Les places fixes de l'en-tete de la vue PAGE (2026-10-22, audit SB-13) : le
 * premier palier des cadrans (A01 et le dB, A01 seul, ni l'un ni l'autre) ou
 * les 16 ecrans de chacune des 8 voix tiennent leurs onglets, serres au plus
 * au palier HEAD_FIT_MAX, a gauche de la colonne de la voix ; la colonne a la
 * largeur de la plus large des voix (TOM), juste a gauche du pattern, la
 * lettre M ou S d'un mode arme entre les deux. Le meme sur toutes les pages
 * et pour toutes les voix (sans voix, VOICE FX plus long se serre plus : au
 * dernier palier de HEAD_FIT, 80 %, au desktop) ;
 * mesure : la voix a x 148.5 et A01 au desktop, 159 sans A01 au telephone
 * (172.3 colle aux cadrans, voir HEAD_FIT_PHONE). Garde jusqu'a l'arrivee des
 * polices (onFonts).
 */
function headPlan(this: Screen, badge: boolean): HeadPlan {
  const key = badge ? 'badge' : 'plain';
  const hit = this.headPlans.get(key);
  if (hit) return hit;
  const T = this.bt.head;
  const g = this.dialGeom(0, true);
  const right = this.dialRight(true);
  const colW = Math.max(...[...INSTRUMENTS, 'ALL'].map((n) => this.textWidth(n, T.voice, 600)));
  const badgeW = badge ? T.pillH + HEAD_COL.badgeAir : 0;
  let plan: HeadPlan | null = null;
  // M ou S arme (2026-10-22, relecture) : la voix garde sa place de tous les jours si la lettre tient entre elle et les
  // cadrans d'un palier plus court (le desktop : A01 cede le temps du mode) ; sinon (le telephone) la colonne recule
  if (badge) {
    const plain = this.headPlan(false);
    for (const tier of DIAL_TIERS) {
      const groupLeft = right - g.width(tier);
      if (groupLeft - HEAD_COL.gap - badgeW - colW < plain.voiceX - 0.01) continue;
      plan = { tier, voiceX: plain.voiceX, colW, groupLeft };
      break;
    }
    if (plan) {
      this.headPlans.set(key, plan);
      return plan;
    }
  }
  // Le bord gauche le plus a gauche ou la voix peut se poser, les onglets serres au palier fit (le plus large des 16
  // ecrans des 8 voix ; sans voix, VOICE FX se serre plus)
  // Seulement les ecrans des pages de cet appareil (V.5.0 : TRIG, MOD, TEMPO et le MIXER sont au desktop ; le telephone
  // garde sa mesure d'avant, au pixel pres)
  const need = (fit: number): number =>
    Math.max(...INSTRUMENTS.flatMap((inst) => RYTM_SCREENS.filter((s) => isRytmPage(SCREEN_PAGE[s])).map((s) => this.headLeft(SCREEN_PAGE[s], s, inst, HEAD_FIT[fit], false).end + (fxScopeTabs(s) ? HEAD_COL.tabAir : HEAD_COL.air))));
  const fitMax = need(HEAD_FIT_MAX);
  for (const tier of DIAL_TIERS) {
    const groupLeft = right - g.width(tier);
    const voiceX = groupLeft - HEAD_COL.gap - badgeW - colW;
    plan = { tier, voiceX, colW, groupLeft };
    if (fitMax <= voiceX) break;
  }
  // Au telephone, sans A01 (relecture du 2026-10-22 : la voix collee aux cadrans, a 172.3, laissait a la zone de MASTER
  // 39 px sur VOICE et 28 sous DIST CHORUS DELAY REVERB, 48 avant les places fixes) : la colonne recule tant que les
  // onglets gardent leur corps (HEAD_FIT_PHONE, 159), l'air gagne revient a la zone de MASTER (zoneLeft) : 50 px et 37
  const p0 = plan as HeadPlan;
  if (this.mobile && !badge && !p0.tier.a01) {
    const left = Math.ceil(need(HEAD_FIT_PHONE) * 2) / 2;
    if (left < p0.voiceX) plan = { ...p0, voiceX: left };
  }
  const out = plan as HeadPlan;
  this.headPlans.set(key, out);
  return out;
}

/**
 * Le bord droit de MASTER et TEMPO (2026-10-19) : a gauche de la touche i ; au
 * telephone, avant sa zone (26 unites autour d'elle, au coin du verre quand
 * les blocs ont la leur, la vue PAGE) : rien de dessine n'y tombe.
 */
function dialRight(this: Screen, paged: boolean): number {
  if (!this.mobile) return PAGE_HEAD.right;
  return (paged ? INFO_KEY.blocks.x : INFO_KEY.x) - INFO_KEY.hit.phone - 4;
}

/**
 * Les mesures de MASTER, TEMPO et du pattern (2026-10-19) ; fixed (la vue
 * PAGE, 2026-10-22, audit SB-13) : le tempo, le pattern et le nombre de MASTER
 * comptes a leur plus large (DIAL_REF), le groupe ne bouge plus quand le
 * tempo ou le niveau changent. width : la largeur du groupe a un palier.
 */
function dialGeom(this: Screen, cur: number, fixed: boolean): DialGeom {
  const T = this.bt.head;
  const M = Screen.METER;
  const level = clamp01(mix.level);
  const db = encUnit('level', level);
  const sp = db.lastIndexOf(' ');
  const mNum = sp > 0 ? db.slice(0, sp) : db;
  const mUnit = sp > 0 ? db.slice(sp + 1) : '';
  const bpmV = Math.round(pattern.get().bpm);
  // Le TEMPO qui suit les platines (2026-10-27) : 124.0 SYNC
  const bpm = tempoSync.text(pattern.get().bpm);
  const tnw = Math.max(this.textWidth(bpm, T.num, 400), ...(fixed ? DIAL_REF.bpm.map((t) => this.textWidth(t, T.num, 400)) : []));
  const tuw = this.textWidth(tempoSync.unit(), T.bpm, 600, 0.8);
  const tw = tnw + 3 + tuw;
  const meterW = M.n * M.bw + (M.n - 1) * M.gap;
  const mnw = this.textWidth(mNum, T.num, 400);
  const muw = this.textWidth(mUnit, T.bpm, 600, 0.8);
  const mFull = meterW + 4 + Math.max(mnw, fixed ? this.textWidth(DIAL_REF.db, T.num, 400) : 0) + 3 + muw;
  const slot = slotName(cur);
  const aw = Math.max(this.textWidth(slot, T.num, 600, 0.6), fixed ? this.textWidth(DIAL_REF.slot, T.num, 600, 0.6) : 0);
  const width = (t: DialTier): number => tw + DIAL_GAP.gd + (t.full ? mFull : meterW) + (t.a01 ? DIAL_GAP.g + aw : 0);
  return { level, db, mNum, mUnit, bpmV, bpm, tw, tuw, meterW, mnw, muw, mFull, slot, aw, width };
}

/**
 * MASTER et TEMPO dans l'ecran (2026-10-19), sur la ligne de base y, alignes
 * a droite (dialRight), et le pattern a leur gauche : TEMPO, le nombre et BPM,
 * sa course de 100 a 150 sur un fin trait dessous ; MASTER, un vumetre de
 * sept barres (allumees jusqu'au niveau, la derniere a moitie) et son niveau
 * en dB ; cernes a peine sous la souris, en plein tant qu'on les tient. Le
 * groupe cede ce qu'il faut pour laisser need a sa gauche : d'abord le nombre
 * de MASTER, puis le pattern ; si meme le dernier palier ne le laisse pas,
 * bare (le moins qu'il faut, sans voix ALL sans PICK A VOICE). Leurs zones
 * (dialRects) : de haut en bas jusqu'a zoneY1, chacune jusqu'au milieu de
 * l'air qui les separe. Rend le bord gauche du groupe. fixed (la vue PAGE,
 * 2026-10-22, audit SB-13) : le palier de headPlan, le meme sur toutes les
 * pages ; readout : MASTER tenu dit son niveau en dB a la place du pattern ;
 * zoneLeft : au telephone sans A01, la zone de MASTER s'etend jusque-la.
 */
function paintDials(this: Screen, y: number, need: number, zoneY1: number, now: number, cur: number, bare = need, fixed: { tier: DialTier; zoneLeft: number; readout: boolean } | null = null): number {
  const T = this.bt.head;
  const M = Screen.METER;
  const paged = zoneY1 === PAGE_HEAD.rule;
  const right = this.dialRight(paged);
  const g = this.dialGeom(cur, !!fixed);
  const { level, db, mNum, mUnit, bpmV, bpm, tw, tuw, meterW, mnw, muw, mFull, slot, aw } = g;
  const G = DIAL_GAP.g;
  const GD = DIAL_GAP.gd;
  const fit = (n: number): DialTier | undefined => DIAL_TIERS.find((t) => right - g.width(t) >= n + 5);
  // La place laissee a gauche : need, sinon bare (relecture du 2026-10-19 : sans voix sur la page d'un FX, A01 cedait
  // pour un PICK A VOICE qui ne tenait de toute facon pas)
  const room = fit(need) || bare >= need ? need : bare;
  const tier = fixed ? fixed.tier : (fit(room) ?? DIAL_TIERS[DIAL_TIERS.length - 1]);
  const ds = screenDials.get();
  const ring = (id: ScreenDialId, x0: number, x1: number): void => {
    const held = ds.held === id;
    if (!held && ds.hover !== id) return;
    this.roundRect(x0 - 3.5, y - 13.8, x1 - x0 + 7, 19.6, 3, held ? 'rgba(246, 241, 231, 0.07)' : HOVER_FILL, held ? INK : HALF, held ? 1.3 : 0.9);
  };
  // TEMPO : le nombre, BPM, sa course dessous
  const tx1 = right;
  const tx0 = right - tw;
  ring('tempo', tx0, tx1);
  this.text(tempoSync.unit(), tx1, y, T.bpm, HALF, 600, 'right', 0.8);
  this.text(bpm, tx1 - tuw - 3, y, T.num, INK, 400, 'right');
  const gy = y + 3.4;
  const course = clamp01((bpmV - 100) / 50);
  this.line([tx0, gy, tx1, gy], FAINT, 1.1);
  this.line([tx0, gy, tx0 + (tx1 - tx0) * course, gy], INK, 1.6);
  this.circle(tx0 + (tx1 - tx0) * course, gy, 1.35, INK);
  // MASTER : le vumetre, et son niveau quand la place le permet
  const mx1 = tx0 - GD;
  const mx0 = mx1 - (tier.full ? mFull : meterW);
  ring('level', mx0, mx1);
  const lit = level * M.n;
  for (let k = 0; k < M.n; k += 1) {
    const h = M.h0 + ((M.h1 - M.h0) * k) / (M.n - 1);
    this.ctx.fillStyle = k + 1 <= lit + 1e-6 ? INK : k < lit ? HALF : FAINT;
    this.ctx.fillRect(mx0 + k * (M.bw + M.gap), y - h, M.bw, h);
  }
  if (tier.full) {
    this.text(mUnit, mx1, y, T.bpm, HALF, 600, 'right', 0.8);
    this.text(mNum, mx1 - muw - 3, y, T.num, INK, 400, 'right');
  }
  let left = mx0;
  const readout = !!fixed && fixed.readout && !tier.full;
  if (readout) {
    // MASTER tenu (2026-10-22) : son niveau en dB devant le vumetre, a la place du pattern et de la voix, le temps du geste
    this.text(mUnit, mx0 - G, y, T.bpm, HALF, 600, 'right', 0.8);
    this.text(mNum, mx0 - G - muw - 3, y, T.num, INK, 400, 'right');
    left = mx0 - G - muw - 3 - mnw;
  } else if (tier.a01) {
    // Le pattern (il clignote quand il change)
    const blinkOff = this.blinkUntil > now && Math.floor((this.blinkUntil - now) / 100) % 2 === 1;
    this.text(slot, mx0 - G, y, T.num, blinkOff ? FAINT : INK, 600, 'right', 0.6);
    left = mx0 - G - aw;
  }
  // Les zones : jusqu'au milieu de l'air qui les separe, toute la hauteur de l'en-tete
  const mid = (mx1 + tx0) / 2;
  const lim = this.mobile ? right + 3 : UW;
  // Au telephone, dans la vue PAGE, sans A01 ni dB (VOICE, SYNTH, les pages d'un FX ; relecture du 2026-10-19 : 26 x 19 px
  // a 375 de large) : la zone de MASTER prend l'air libre a sa gauche, jusqu'a room + 5 (lcd-open n'y ouvre plus les
  // presets) ; Math.min garde l'ancien bord quand meme le dernier palier ne tient pas. HOME garde la sienne. Depuis le
  // 2026-10-22 (places fixes) : jusqu'a zoneLeft, apres la voix.
  const mz0 = this.mobile && paged && !tier.a01 ? Math.min(mx0 - 3, fixed ? fixed.zoneLeft : room + 5) : mx0 - 3;
  const up = this.headUp;
  this.dialRects.push({ id: 'lcd-master', ...this.spot({ x: mz0, y: -up, w: mid - mz0, h: zoneY1 + up }) });
  this.dialRects.push({ id: 'lcd-tempo', ...this.spot({ x: mid, y: -up, w: Math.min(tx1 + 4, lim) - mid, h: zoneY1 + up }) });
  // INFOS : la commande dont la carte est montree, ses quatre coins
  const di = this.infoDial();
  if (di) this.cornerMarks(di === 'level' ? mx0 - 3.5 : tx0 - 3.5, y - 15.5, di === 'level' ? mx1 + 3.5 : tx1 + 3.5, y + 7.4);
  const mark = (id: ScreenDialId): string => (ds.held === id ? '*' : ds.hover === id ? '~' : '');
  this.info.dials = `MASTER ${tier.full || readout ? db : `${Math.min(M.n, Math.floor(lit + 1e-6))}/${M.n}`}${mark('level')} | TEMPO ${bpm} BPM${mark('tempo')}`;
  this.info.dialSlot = tier.a01 && !readout ? slot : '';
  return left;
}

/** La commande de l'ecran dont la carte INFOS est montree (lcd-master, lcd-tempo), null aucune. */
function infoDial(this: Screen): ScreenDialId | null {
  const s = rytmInfos.get();
  if (!s.on || !s.id) return null;
  return s.id === 'lcd-master' ? 'level' : s.id === 'lcd-tempo' ? 'tempo' : null;
}

/**
 * La touche i (R4) : un cercle, le i dedans ; INFOS allume, le disque plein
 * et le i en noir ; sur l'en-tete negatif du P-LOCK, en noir sur l'os.
 */
function paintInfoKey(this: Screen, on: boolean, neg = false): void {
  const c = this.ctx;
  const { x, y } = INFO_KEY;
  const r = this.mobile ? INFO_KEY.r.phone : INFO_KEY.r.desk;
  const fg = neg ? BLACK : INK;
  const bg = neg ? INK : BLACK;
  this.circle(x, y, r, on ? fg : bg, on ? null : fg, 0.95);
  const ink = on ? bg : fg;
  this.circle(x, y - r * 0.46, r * 0.15, ink);
  c.fillStyle = ink;
  const w = r * 0.26;
  c.fillRect(x - w / 2, y - r * 0.16, w, r * 0.68);
  this.info.infos = on;
}

/** Le bloc dont la carte INFOS est montree (penc-<k>, ou son bloc lcd-blk-<k>), -1 aucun. */
function infoKnob(this: Screen): number {
  const s = rytmInfos.get();
  if (!s.on || !s.id) return -1;
  const m = /^lcd-blk-([0-9]+)$/.exec(s.id);
  if (m) return Number(m[1]);
  // Un potard de la face du desktop (2026-10-27) : le bloc qu'il tourne
  if (FACE_PAGES && s.id.startsWith('penc-')) {
    const p = /^p:([0-7])$/.exec(rytmInfoHit(s.id)?.id ?? '');
    return p ? Number(p[1]) : -1;
  }
  return -1;
}

/** Quatre coins autour d'un bloc (INFOS, R4) : la carte parle de lui ; dehors, sans toucher au bloc ni a son echo. */
function infoMarks(this: Screen, cell: SlotCell, k: number): void {
  const R = cellRect(cell);
  const x0 = R.x - 1.8;
  const y0 = R.y - 1.8;
  const x1 = R.x + R.w + 1.8;
  const y1 = R.y + R.h + 1.8;
  const a = 5;
  const lw = this.mobile ? 1.4 : 1.1;
  this.line([x0, y0 + a, x0, y0, x0 + a, y0], INK, lw);
  this.line([x1 - a, y0, x1, y0, x1, y0 + a], INK, lw);
  this.line([x1, y1 - a, x1, y1, x1 - a, y1], INK, lw);
  this.line([x0 + a, y1, x0, y1, x0, y1 - a], INK, lw);
  this.info.infoBlock = k;
}

defineMethods(Screen, { headPlan, dialRight, dialGeom, paintDials, infoDial, paintInfoKey, infoKnob, infoMarks });
