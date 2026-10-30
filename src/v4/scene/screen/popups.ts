/**
 * L'ecran du MM-RYTM : les pop-ups (le panneau des verrous, le popup d'un encodeur). Methodes de Screen deplacees telles quelles de scene/screen.ts en P0 (2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), devenues des fonctions (this: Screen) posees sur Screen.prototype.
 */

import { type StepLock } from '../../audio/locks';
import { lockList, type LockLine } from '../../actions';
import { GLOBAL_ENCODERS, GLOBAL_ENC_LABELS, type EncId } from '../../theme';
import { freeCells, type PageSlot } from '../../rytm/pages';
import { BLACK, clamp01, FAINT, FAINT_TEXT, FRAME, globalValueOf, HALF, INK, MATRIX, type PanelArea, TALL, TURN, two, UW } from './consts';
import { Screen } from './core';
import { defineMethods } from './proto';

declare module './core' {
  interface Screen {
    paintLockPanel: typeof paintLockPanel;
    paintPopup: typeof paintPopup;
  }
}

/**
 * Le panneau des verrous (revue de R2) : les verrous du pas en P-LOCK, ou du
 * pas qui joue, toutes pages, dans la plus grande place que l'ecran laisse
 * libre (deux colonnes au moins sur une rangee, ou une colonne sur deux) ;
 * rien si l'ecran est plein (l'en-tete en dit le compte, le pied la liste).
 */
function paintLockPanel(this: Screen, slots: readonly PageSlot[], step: number, lockArg?: Readonly<StepLock> | null): PanelArea | null {
  const M = MATRIX;
  const free = freeCells(slots);
  const isFree = (c: number, r: number): boolean => free.some((x) => x.c === c && x.r === r);
  let best: PanelArea | null = null;
  const consider = (c0: number, n: number, r0: number, rows: number): void => {
    if (n < 1 || (rows === 1 && n < 2)) return;
    if (!best || n * rows > best.n * best.rows || (n * rows === best.n * best.rows && n > best.n)) best = { c0, n, r0, rows };
  };
  for (const rows of [2, 1]) {
    for (let r0 = 0; r0 + rows <= 2; r0 += 1) {
      let c0 = -1;
      for (let c = 0; c <= 4; c += 1) {
        const ok = c < 4 && isFree(c, r0) && (rows === 1 || isFree(c, r0 + 1));
        if (ok && c0 < 0) c0 = c;
        if (!ok && c0 >= 0) {
          consider(c0, c - c0, r0, rows);
          c0 = -1;
        }
      }
    }
  }
  const b = best as PanelArea | null;
  if (!b) return null;
  const lines: LockLine[] = lockList(step, lockArg);
  const x0 = M.x0 + M.pitch * b.c0;
  const x1 = x0 + M.pitch * (b.n - 1) + M.w;
  const y0 = M.rows[b.r0];
  const y1 = M.rows[b.r0 + b.rows - 1] + M.h;
  const T = this.bt;
  const pad = 5;
  this.roundRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1, M.r, null, FRAME, 0.7);
  const title = `STEP ${two(step + 1)} ${lockArg !== undefined ? 'PLAYS' : 'P-LOCKS'}`;
  this.text(this.fitText(title, x1 - x0 - 2 * pad, T.nameSize, 0.7, 700), x0 + pad, y0 + T.nameDy, T.nameSize, HALF, 700, 'left', 0.7);
  const size = T.panelSize;
  const lh = T.panelLh;
  let y = y0 + T.nameDy + lh + 0.6;
  const bottom = y1 - 3;
  const out: string[] = [];
  if (lines.length === 0) {
    this.text(this.fitText(`NONE YET: ${TURN}`, x1 - x0 - 2 * pad, size, 0.5, 600), x0 + pad, y, size, FAINT_TEXT, 600, 'left', 0.5);
    this.info.panel = ['NONE'];
    return b;
  }
  for (let i = 0; i < lines.length; i += 1) {
    const last = y + lh > bottom;
    if (last && i < lines.length - 1) {
      const more = `+${lines.length - i} MORE`;
      this.text(more, x0 + pad, y, size, HALF, 700, 'left', 0.5);
      out.push(more);
      break;
    }
    const l = lines[i];
    const pw = b.n > 1 ? this.text(l.page, x1 - pad, y, size * 0.82, FAINT_TEXT, 700, 'right', 0.5) + 4 : 0;
    const nw = this.text(l.name, x0 + pad, y, size, HALF, 700, 'left', 0.5);
    const room = x1 - pad - pw - (x0 + pad + nw + 3);
    this.text(this.fitText(l.text, Math.max(6, room), size, 0.3, 600), x0 + pad + nw + 3, y, size, INK, 600, 'left', 0.3);
    out.push(`${l.page} ${l.name} ${l.text}`);
    y += lh;
    if (y > bottom + 0.01) break;
  }
  this.info.panel = out;
  return b;
}

/**
 * Le popup d'un encodeur du desktop (2026-10-09, Mika : "en desktop ils ne
 * servent qu'a faire les modifs des FX globaux de la machine") : GLOBAL et
 * son nom, sa valeur de 0 a 127 en grand, son unite, sa course ; au-dessus
 * des blocs, la page ne change pas.
 */
function paintPopup(this: Screen, id: EncId): void {
  const M = MATRIX;
  const k = GLOBAL_ENCODERS.indexOf(id);
  const name = k >= 0 ? GLOBAL_ENC_LABELS[k] : id.toUpperCase();
  const v = globalValueOf(id);
  const w = 168;
  const h = M.h + (TALL ? 10 : 6);
  const x = (UW - w) / 2;
  const y = (M.rows[0] + M.rows[1] + M.h - h) / 2;
  // Un vrai calque (2026-10-22, audit SB-12) : les blocs dessous s'assombrissent, plus de +63 ni de RIVE qui depassent
  this.ctx.fillStyle = 'rgba(5, 5, 6, 0.84)';
  this.ctx.fillRect(0, M.rows[0] - 2, UW, M.rows[1] + M.h + 4 - M.rows[0]);
  this.roundRect(x - 2, y - 2, w + 4, h + 4, M.r + 2, BLACK);
  this.roundRect(x, y, w, h, M.r + 1, BLACK, INK, 1.4);
  const T = this.bt;
  const pad = 9;
  this.text('GLOBAL', x + pad, y + T.nameDy + 1, T.nameSize * 0.9, HALF, 700, 'left', 0.9);
  const gw = this.textWidth('GLOBAL', T.nameSize * 0.9, 700, 0.9);
  this.text(name, x + pad + gw + 5, y + T.nameDy + 1, T.nameSize, INK, 800, 'left', 0.8);
  const big = T.valueSizes[0] * 1.15;
  const vy = y + h * 0.66;
  const vw = this.text(v.text, x + pad, vy, big, INK, 300);
  this.text(this.fitText(v.unit, w - 2 * pad - vw - 8, T.unitSize * 1.05, 0.4, 600), x + pad + vw + 6, vy, T.unitSize * 1.05, HALF, 600, 'left', 0.4);
  // La course, en bas : la barre de la valeur
  const by = y + h - (TALL ? 7 : 5.5);
  this.line([x + pad, by, x + w - pad, by], FAINT, 1.6);
  this.line([x + pad, by, x + pad + (w - 2 * pad) * clamp01(v.course), by], INK, 2.2);
  this.info.popup = `GLOBAL ${name} ${v.text} ${v.unit}`;
}

defineMethods(Screen, { paintLockPanel, paintPopup });
