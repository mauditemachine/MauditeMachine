/**
 * L'ecran du MM-RYTM : MUTE et SOLO (le mode et ses voix). Methodes de Screen deplacees telles quelles de scene/screen.ts en P0 (2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), devenues des fonctions (this: Screen) posees sur Screen.prototype.
 */

import { HALF, INK, LINE, modeLines, PAGE_FOOT, TALL } from '../consts';
import { Screen } from '../core';
import { defineMethods } from '../proto';

declare module '../core' {
  interface Screen {
    paintMode: typeof paintMode;
    paintMode2: typeof paintMode2;
  }
}

/**
 * MUTE et SOLO (2026-10-07, Mika : "l'ecran affiche la difference et le
 * tip du double MUTE") : le mode du moment a gauche, son tip a droite ;
 * false sans mode ni voix coupee.
 */
function paintMode(this: Screen, x0: number, x1: number, y: number = LINE.y, big = 9, small = 6.5): boolean {
  const m = modeLines();
  if (!m) return false;
  // Les voix d'abord : l'aide courte si la longue ne laisse pas la liste entiere
  const lw = this.textWidth(m.left, big, 600, 0.6);
  const tip = lw + 8 + this.textWidth(m.tip, small, 700, 0.8) <= x1 - x0 ? m.tip : m.short;
  const tw = this.text(tip, x1, y, small, HALF, 700, 'right', 0.8);
  const left = this.fitText(m.left, Math.max(20, x1 - x0 - tw - 8), big, 0.6);
  this.text(left, x0, y, big, INK, 600, 'left', 0.6);
  this.info.footText = `${left} / ${tip}`;
  return true;
}

/**
 * MUTE et SOLO sur deux lignes (l'ecran haut du telephone, 2026-10-09 ; le
 * desktop aussi depuis la revue du meme jour) : le mode et ses voix, puis le
 * geste ; aux corps du pied du P-LOCK.
 */
function paintMode2(this: Screen, x0: number, x1: number): boolean {
  const m = modeLines();
  if (!m) return false;
  const F = PAGE_FOOT;
  const fs = this.bt.foot;
  const s1 = TALL ? fs : this.mobile ? 10 : fs - 1;
  const s2 = TALL ? fs - 0.5 : this.mobile ? 8.6 : 6;
  const y1 = TALL || !this.mobile ? F.y1 : 108.7;
  const y2 = TALL || !this.mobile ? F.y2 : 118;
  const a = this.fitText(m.left, x1 - x0, s1, 0.5, 700);
  const b = this.fitText(m.tip, x1 - x0, s2, 0.6, 700);
  this.text(a, x0, y1, s1, INK, 700, 'left', 0.5);
  this.text(b, x0, y2, s2, HALF, 700, 'left', 0.6);
  this.info.footText = `${a} / ${b}`;
  return true;
}

defineMethods(Screen, { paintMode, paintMode2 });
