/**
 * L'ecran du MM-RYTM : le navigateur des sons et le fichier glisse (DROP ON A PAD). Methodes de Screen deplacees telles quelles de scene/screen.ts en P0 (2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), devenues des fonctions (this: Screen) posees sur Screen.prototype.
 */

import { pattern } from '../../../audio/pattern';
import { type SoundBrowserView } from '../../../actions';
import { lcdMessage } from '../../../state/lcdMessage';
import { lcdSamples } from '../../../state/lcdSamples';
import { type RytmPageState } from '../../../state/rytmPage';
import { PORTRAIT, SCREEN_TOUCH, type Inst } from '../../../theme';
import { fill } from '../../../state/fill';
import { BLACK, FAINT, FAINT_TEXT, HALF, INK, MATRIX, PAGE_FOOT, PAGE_HEAD, SB, SB_HOVER, SB_PITCH, TALL, two, UH, UW } from '../consts';
import { Screen } from '../core';
import { defineMethods } from '../proto';

declare module '../core' {
  interface Screen {
    paintBrowser: typeof paintBrowser;
    paintDrop: typeof paintDrop;
  }
}

/* ---------------- le navigateur des sons (2026-10-18) ---------------- */

/**
 * Le navigateur des sons, sur tout l'ecran : l'en-tete (la voix et SOUND ; en
 * P-LOCK, l'en-tete en negatif et le pas que la liste verrouille), le rang
 * (7 / 24), PREV et NEXT en deux fleches ; les lignes montrees (un numero, le
 * nom ; a droite SYNTH pour une machine, USER pour un sample de ce
 * navigateur et, au desktop, son x) : le son du moment en pastille pleine,
 * la ligne du clavier cernee, une ligne armee (REMOVE ?) en contour ; la
 * barre de defilement ; le pied (les seize pas, le message ou l'aide). Les
 * zones (browserRects) suivent ce qui est dessine.
 */
function paintBrowser(this: Screen, v: SoundBrowserView, rp: RytmPageState, lockStep: number, now: number): void {
  const H = PAGE_HEAD;
  const neg = v.lock >= 0;
  const ink = neg ? BLACK : INK;
  const half = neg ? 'rgba(0, 0, 0, 0.62)' : HALF;
  const faint = neg ? 'rgba(0, 0, 0, 0.32)' : FAINT;
  const rects = this.browserRects;
  const push = (id: string, x: number, y: number, w: number, h: number): void => {
    rects.push({ id, ...this.spot({ x, y, w, h }) });
  };
  // L'en-tete : le titre a gauche (en P-LOCK, le cadenas et le pas devant), le rang, PREV et NEXT a gauche de la touche i
  if (neg) {
    this.ctx.fillStyle = INK;
    this.ctx.fillRect(0, 0, UW, H.rule + 0.6);
  }
  let x = 10;
  if (neg) {
    const gs = SB.head * 0.62;
    this.padlock(x - 1, H.y, gs, BLACK);
    x += gs + 3;
    x += this.text(`STEP ${two(v.lock + 1)}`, x, H.y, SB.head * 0.78, BLACK, 800, 'left', 0.7) + 7;
  }
  const [prev, next] = SB.arrows;
  const rankW = this.text(v.rank, prev[0] - 6, H.y, SB.rank, ink, 600, 'right', 0.4);
  const title = this.fitText(v.title, Math.max(20, prev[0] - 6 - rankW - 8 - x), SB.head, 0.6, 700);
  this.text(title, x, H.y, SB.head, ink, 700, 'left', 0.6);
  push('lcd-sb-head', 0, 0, prev[0] - 1, H.rule);
  const arrow = (box: readonly [number, number], up: boolean, on: boolean): void => {
    const w = box[1] - box[0];
    const cx = box[0] + w / 2;
    const cy = H.rule / 2 + 0.5;
    this.roundRect(box[0] + 0.5, 2.5, w - 1, H.rule - 4.5, 3, null, on ? half : faint, 0.9);
    const a = SB.arrow;
    const c = this.ctx;
    c.beginPath();
    c.moveTo(cx - a, up ? cy + a * 0.55 : cy - a * 0.55);
    c.lineTo(cx + a, up ? cy + a * 0.55 : cy - a * 0.55);
    c.lineTo(cx, up ? cy - a * 0.65 : cy + a * 0.65);
    c.closePath();
    c.fillStyle = on ? ink : faint;
    c.fill();
  };
  arrow(prev, true, v.cur > 0);
  arrow(next, false, v.cur < v.n - 1);
  // Au telephone, au-dessus du verre aussi (HEAD_HIT_UP, 2026-10-22, audit RS-11), et jusqu'au milieu de l'air entre elles
  const up = this.headUp;
  const gap = (next[0] - prev[1]) / 2;
  push('lcd-sb-prev', prev[0], -up, prev[1] - prev[0] + gap, H.rule + up);
  push('lcd-sb-next', next[0] - gap, -up, next[1] - next[0] + gap, H.rule + up);
  if (!neg) this.line([MATRIX.x0, H.rule, UW - MATRIX.x0, H.rule], FAINT, 0.6);
  // Les lignes
  const [y0, y1] = SB.rows;
  push('lcd-sb-body', 0, y0, UW, y1 - y0);
  const scroll = v.rows.length > v.visible;
  const x0 = SB.x0;
  const x1 = SB.x1 - (scroll ? 3 : 0);
  const pad = TALL ? 2.2 : 0.9;
  const rr = TALL ? 4 : 2.6;
  const numW = this.textWidth('88', SB.num, 600, 0.3);
  const keyed = lcdSamples.get().cursor >= 0;
  const hover = lcdSamples.get().hover;
  const drawn: string[] = [];
  for (let k = 0; k < v.visible; k += 1) {
    const i = v.top + k;
    const r = v.rows[i];
    if (!r) break;
    const y = y0 + k * SB_PITCH;
    const cy = y + SB_PITCH / 2;
    const cur = i === v.cur && r.kind !== 'load';
    const armed = i === v.arm;
    const cursor = keyed && i === v.cursor;
    const full = cur && !armed;
    // Sous la souris (desktop) : un fond a peine plus clair, comme un bloc survole
    if (k === hover && !full && !armed) this.roundRect(x0, y + pad, x1 - x0, SB_PITCH - 2 * pad, rr, SB_HOVER);
    if (full) this.roundRect(x0, y + pad, x1 - x0, SB_PITCH - 2 * pad, rr, INK);
    if (armed) this.roundRect(x0 + 0.5, y + pad + 0.5, x1 - x0 - 1, SB_PITCH - 2 * pad - 1, rr, null, INK, TALL ? 1.6 : 1.2);
    // La ligne du clavier : un cadre a la place de la pastille (sur la pastille du son du moment, en noir, juste dedans)
    if (cursor && !armed) {
      const ins = full ? (TALL ? 2.2 : 1.3) : 0.5;
      this.roundRect(x0 + ins, y + pad + ins, x1 - x0 - 2 * ins, SB_PITCH - 2 * pad - 2 * ins, Math.max(1, rr - ins), null, full ? BLACK : INK, TALL ? 1.4 : 0.9);
    }
    const fg = full ? BLACK : r.kind === 'load' ? HALF : INK;
    const sub = full ? 'rgba(0, 0, 0, 0.55)' : HALF;
    const by = (size: number): number => cy + size * 0.36;
    let lx = x0 + 5;
    if (r.kind !== 'load') this.text(two(i + 1), lx, by(SB.num), SB.num, full ? sub : FAINT_TEXT, 600, 'left', 0.3);
    lx += numW + (TALL ? 7 : 5);
    let rx = x1 - (TALL ? 7 : 4);
    if (armed) {
      // REMOVE ? : la ligne attend son second geste (une tape, un clic, Suppr)
      const again = this.mobile ? 'TAP AGAIN' : 'AGAIN';
      rx -= this.text(again, rx, by(SB.tag), SB.tag, INK, 700, 'right', 0.6) + 6;
      this.text(this.fitText(`REMOVE ${r.label}?`, rx - lx, SB.label, 0.4, 700), lx, by(SB.label), SB.label, INK, 700, 'left', 0.4);
    } else {
      // Le x d'un sample de ce navigateur (desktop) : sa zone, au bout de la ligne
      if (r.user && SB.del > 0) {
        const dx = x1 - SB.del / 2;
        const a = SB.label * 0.26;
        const col = full ? BLACK : HALF;
        this.line([dx - a, cy - a, dx + a, cy + a], col, 1.1);
        this.line([dx - a, cy + a, dx + a, cy - a], col, 1.1);
        push(`lcd-sb-del-${k}`, x1 - SB.del, y, SB.del, SB_PITCH);
        rx = x1 - SB.del - 2;
      }
      if (r.tag) rx -= this.text(r.tag, rx, by(SB.tag), SB.tag, sub, 700, 'right', 0.7) + 6;
      const name = this.fitText(r.label, Math.max(10, rx - lx), SB.label, 0.4, full ? 700 : 500);
      this.text(name, lx, by(SB.label), SB.label, fg, full ? 700 : 500, 'left', 0.4);
    }
    push(`lcd-sb-row-${k}`, 2, y, (r.user && SB.del > 0 && !armed ? x1 - SB.del : SB.x1 + 2) - 2, SB_PITCH);
    drawn.push(`${r.label}${cur ? '*' : ''}${cursor ? '>' : ''}${armed ? '!' : ''}${r.user ? 'u' : ''}`);
  }
  // La barre de defilement : la part montree de la liste, a sa place
  if (scroll) {
    const h = y1 - y0 - 2;
    const len = v.rows.length;
    const t0 = y0 + 1 + (h * v.top) / len;
    const t1 = t0 + Math.max(4, (h * v.visible) / len);
    this.line([SB.bar, y0 + 1, SB.bar, y1 - 1], FAINT, 1);
    this.line([SB.bar, t0, SB.bar, Math.min(y1 - 1, t1)], INK, TALL ? 2.6 : 1.8);
  }
  // Le pied : les seize pas (le pas du P-LOCK cerne), le message du moment ou l'aide
  this.paintStrip(v.inst, rp.sel, lockStep);
  const F = PAGE_FOOT;
  const msg = lcdMessage.get(now);
  // L'ecran intouchable du desktop (V.4.2) : le potard de SOUND choisit (la liste le suit), Suppr retire un son a soi
  const help = !SCREEN_TOUCH
    ? [neg ? 'TURN SOUND: P-LOCK THIS STEP' : 'TURN SOUND: CHOOSE · DEL: REMOVE', 'DROP A FILE ON THE MACHINE · ESC']
    : this.mobile
      ? ['TAP: CHOOSE · DRAG: SCROLL', neg ? 'TAP: P-LOCK THIS STEP' : 'HOLD YOURS: REMOVE']
      : ['CLICK: CHOOSE · WHEEL: SCROLL', neg ? 'CLICK: P-LOCK THIS STEP · ESC' : PORTRAIT ? 'DROP A FILE ON A PAD · ESC' : 'DROP A FILE HERE · ESC'];
  const l1 = msg ? msg.text : help[0];
  const l2 = msg ? help[0] : help[1];
  const t1 = this.fitText(l1, F.x1 - F.x0, SB.hint[0], 0.5, 600);
  const t2 = this.fitText(l2, F.x1 - F.x0, SB.hint[1], 0.6, 700);
  this.text(t1, F.x0, F.y1, SB.hint[0], msg ? INK : HALF, 600, 'left', 0.5);
  this.text(t2, F.x0, F.y2, SB.hint[1], HALF, 700, 'left', 0.6);
  this.info.footText = `${t1} / ${t2}`;
  this.info.browser = { title: v.title, rank: v.rank, top: v.top, cur: v.cur, cursor: v.cursor, rows: drawn };
}

/** Un fichier glisse au-dessus de la machine (2026-10-18) : ou il ira, en grand, dans un cadre en pointilles. */
function paintDrop(this: Screen, target: Inst | 'pad'): void {
  const c = this.ctx;
  c.fillStyle = BLACK;
  c.fillRect(0, 0, UW, UH);
  c.save();
  c.setLineDash([5, 3.5]);
  this.roundRect(6, 6, UW - 12, UH - 12, 6, null, INK, TALL ? 1.6 : 1.3);
  c.restore();
  const inst = pattern.get().instrument;
  // La face V.4.0 du desktop (2026-10-27) : plus de pads, le fichier lache n'importe ou sur la machine va a la voix
  // choisie (DROP FOR BD), sans voix il attend qu'on en choisisse une (au clavier, A S D F et Z X C V)
  const desk = !PORTRAIT && target === 'pad';
  const big = desk ? (inst ? `DROP FOR ${inst}` : 'PICK A VOICE FIRST') : target === 'pad' ? 'DROP ON A PAD' : `DROP ON ${target}`;
  const sub = desk
    ? inst
      ? 'WAV AIFF MP3 FLAC M4A · 10 MB'
      : 'KEYS A S D F · Z X C V'
    : target === 'pad'
      ? inst
        ? `OR HERE: ${inst} SOUND`
        : 'ITS VOICE TAKES THE FILE'
      : 'WAV AIFF MP3 FLAC M4A · 10 MB';
  const mid = UH / 2;
  this.text(big, UW / 2, mid + (TALL ? 2 : 1), TALL ? 27 : 21, INK, 300, 'center', 0.5);
  this.text(sub, UW / 2, mid + (TALL ? 24 : 17), TALL ? 10 : 7, HALF, 700, 'center', 0.8);
  this.info.drop = big;
}

defineMethods(Screen, { paintBrowser, paintDrop });
