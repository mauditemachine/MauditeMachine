/**
 * L'ecran du MM-RYTM : le mixeur (LEVELS). Methodes de Screen deplacees telles quelles de scene/screen.ts en P0 (2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), devenues des fonctions (this: Screen) posees sur Screen.prototype.
 */

import { type LcdState } from '../../../state/lcd';
import { COL, FAINT, FAINT_TEXT, HALF, INK } from '../consts';
import { Screen } from '../core';
import { defineMethods } from '../proto';

declare module '../core' {
  interface Screen {
    paintMix: typeof paintMix;
  }
}

/* ---------------- les pages ---------------- */

/** Page MIX : les volumes de la rangee en faders (la voix reglee pleine). */
function paintMix(this: Screen, m: NonNullable<LcdState['mix']>): void {
  const n = m.insts.length;
  const w = (COL.x1 - COL.x0) / n;
  const y0 = 30;
  const y1 = 82;
  m.insts.forEach((inst, k) => {
    const cx = COL.x0 + w * (k + 0.5);
    const v = Math.max(0, Math.min(1, m.levels[k] ?? 0));
    const sel = inst === m.sel;
    this.line([cx, y0, cx, y1], FAINT, 1.4);
    const y = y1 - (y1 - y0) * v;
    this.line([cx, y1, cx, y], sel ? INK : HALF, 2.4);
    this.circle(cx, y, sel ? 4.6 : 3.4, sel ? INK : HALF);
    this.text(inst, cx, 96, 8, sel ? INK : HALF, 700, 'center', 0.6);
    this.text(String(Math.round(v * 100)), cx, 26, 7, sel ? INK : FAINT_TEXT, 600, 'center');
  });
}

defineMethods(Screen, { paintMix });
