/**
 * Le menu PAGE SETUP du sequenceur (2026-11-02, Mika : "le bouton Page sert pour le sequenceur... ca sert pour avoir
 * 16 / 32 ou plus de steps dans le sequenceur et a choisir ce qui joue") :
 * - Potard A (LEN)  : 16 / 32 / 48 / 64 STEPS (1 a 4 pages de 16 pas)
 * - Potard B (EDIT) : P1 (1-16) / P2 (17-32) / P3 (33-48) / P4 (49-64) : quelle page on edite sur les 16 boutons TRIG
 * - Potard C (PLAY) : ALL PAGES (joue 1..N) ou LOOP P1..P4 (boucle uniquement la page choisie)
 * - Potard D (COPY) : copie la page editee vers la page suivante (YES pour copier)
 * - En bas de l'ecran : apercu en direct des 4 pages (P1 a P4) avec les 16 pas de la piste active, la page editee et la
 *   page en lecture.
 */

import { clock } from '../../../audio/clock';
import { pattern, velocity } from '../../../audio/pattern';
import { resume } from '../../../audio/drums';
import { dtFace } from '../../../state/dtFace';
import { lcdMessage } from '../../../state/lcdMessage';
import { activeTrack } from '../../../state/trk';
import type { PageSlot, SlotTarget } from '../../../rytm/pages';
import { BLACK, FAINT, FRAME, HALF, INK } from '../consts';
import { acting, DIM_TEXT } from './frame';
import { menuChanged } from './open';
import { registerDialSpec, registerScreenMenu } from './registry';

const live = (label: string, target: SlotTarget, draw: PageSlot['draw']): PageSlot => ({ label, target, scope: 'all', draw });
const EMPTY: PageSlot = { label: '', target: null, scope: 'all', draw: 'bar' };

export const PAGESETUP_SLOTS: readonly PageSlot[] = [
  live('STEPS', 'z:pg:len' as SlotTarget, 'bar'),
  live('EDIT', 'z:pg:edit' as SlotTarget, 'bar'),
  live('PLAY', 'z:pg:play' as SlotTarget, 'bar'),
  live('COPY', 'z:pg:copy' as SlotTarget, 'bar'),
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
];

let copyTarget: 0 | 1 | 2 | 3 = 1;

function setLenPages(n: number): void {
  resume();
  const c = Math.max(1, Math.min(4, Math.round(n))) as 1 | 2 | 3 | 4;
  pattern.setPageCount(c);
  dtFace.setPtnPage(pattern.editPage());
  lcdMessage.show(`SEQUENCER LENGTH: ${c * 16} STEPS (${c} ${c > 1 ? 'PAGES' : 'PAGE'})`, 1400, true);
  menuChanged();
}

function setEditPage(p: number): void {
  resume();
  const idx = Math.max(0, Math.min(3, Math.round(p))) as 0 | 1 | 2 | 3;
  pattern.setEditPage(idx);
  dtFace.setPtnPage(idx);
  lcdMessage.show(`EDIT PAGE ${idx + 1}/${pattern.pageCount()} (STEPS ${idx * 16 + 1}-${(idx + 1) * 16})`, 1400, true);
  menuChanged();
}

function setPlayLoop(v: number): void {
  resume();
  const lp = Math.max(-1, Math.min(pattern.pageCount() - 1, Math.round(v))) as -1 | 0 | 1 | 2 | 3;
  pattern.setLoopPage(lp);
  lcdMessage.show(lp < 0 ? `PLAY ALL PAGES (1-${pattern.pageCount() * 16} STEPS)` : `LOOP PAGE ${lp + 1} ONLY (STEPS ${lp * 16 + 1}-${(lp + 1) * 16})`, 1400, true);
  menuChanged();
}

registerDialSpec('z:pg:len', {
  value: () => pattern.pageCount(),
  set: (v) => setLenPages(v),
  range: () => [1, 4],
  steps: () => 4,
  text: (v) => `${Math.max(1, Math.min(4, Math.round(v))) * 16}`,
  unit: (v) => `${Math.max(1, Math.min(4, Math.round(v)))} PG`,
  reset: () => 1,
});

registerDialSpec('z:pg:edit', {
  value: () => pattern.editPage(),
  set: (v) => setEditPage(v),
  range: () => [0, 3],
  steps: () => 4,
  text: (v) => `P${Math.max(0, Math.min(3, Math.round(v))) + 1}`,
  unit: (v) => `${Math.max(0, Math.min(3, Math.round(v))) * 16 + 1}-${(Math.max(0, Math.min(3, Math.round(v))) + 1) * 16}`,
  reset: () => 0,
});

registerDialSpec('z:pg:play', {
  value: () => pattern.loopPage(),
  set: (v) => setPlayLoop(v),
  range: () => [-1, 3],
  steps: () => 5,
  text: (v) => (Math.round(v) < 0 ? 'ALL' : `P${Math.round(v) + 1}`),
  unit: (v) => (Math.round(v) < 0 ? `1-${pattern.pageCount() * 16}` : 'LOOP'),
  reset: () => -1,
});

registerDialSpec('z:pg:copy', {
  value: () => copyTarget,
  set(v) {
    copyTarget = Math.max(0, Math.min(3, Math.round(v))) as 0 | 1 | 2 | 3;
    menuChanged();
  },
  range: () => [0, 3],
  steps: () => 4,
  text: (v) => `->P${Math.max(0, Math.min(3, Math.round(v))) + 1}`,
  unit: () => 'YES: COPY',
  reset: () => 1,
});

registerScreenMenu({
  id: 'pagesetup',
  owner: 'B5',
  title: () => `SEQ PAGES · ${pattern.pageCount() * 16} STEPS`,
  slots: () => PAGESETUP_SLOTS,
  paint(screen) {
    const cnt = pattern.pageCount();
    const edit = pattern.editPage();
    const loop = pattern.loopPage();
    const playing = clock.running ? clock.playingPage() : -1;
    const tk = activeTrack.get() ?? 'BD';

    const x0 = 48;
    const y0 = 108;
    const gap = 4;
    const cardW = (254 - gap * 3) / 4;
    const cardH = 66;

    for (let p = 0; p < 4; p += 1) {
      const cx = x0 + p * (cardW + gap);
      const active = p < cnt;
      const isEdit = p === edit;
      const isPlay = p === playing || (loop === p && !clock.running);
      screen.roundRect(cx, y0, cardW, cardH, 3, isEdit ? INK : null, active ? INK : FRAME, isEdit ? 1.2 : 0.8);
      const fg = isEdit ? BLACK : active ? INK : DIM_TEXT;
      const sub = isEdit ? BLACK : active ? HALF : FAINT;

      screen.text(`P${p + 1}`, cx + 5, y0 + 11, 8.5, fg, 700, 'left', 0.3);
      screen.text(`${p * 16 + 1}-${(p + 1) * 16}`, cx + cardW - 4, y0 + 10.5, 6.2, sub, 600, 'right', 0.2);

      const badge = !active ? 'OFF' : loop === p ? 'LOOP' : isPlay ? 'PLAY' : isEdit ? 'EDIT' : 'ON';
      screen.text(badge, cx + 5, y0 + 22, 6.2, sub, 700, 'left', 0.4);

      const pSteps = pattern.stepsOfPage(p);
      for (let s = 0; s < 16; s += 1) {
        const row = Math.floor(s / 8);
        const col = s % 8;
        const sx = cx + 5 + col * 6.4;
        const sy = y0 + 30 + row * 13;
        const vel = velocity(pSteps, tk, s);
        if (vel > 0) {
          screen.roundRect(sx, sy, 4.8, 8.5, 1, fg);
        } else {
          screen.roundRect(sx, sy, 4.8, 8.5, 1, null, sub, 0.6);
        }
      }
    }

    screen.text('PAGE: CYCLE P1-P4 · LEFT/RIGHT: EDIT PAGE · UP/DOWN: 16/32/48/64 STEPS', 175, 186, 6.2, DIM_TEXT, 700, 'center', 0.3);
    return clock.running ? 120 : 0;
  },
  info: () => `LEN ${pattern.pageCount() * 16} EDIT P${pattern.editPage() + 1} PLAY ${pattern.loopPage() < 0 ? 'ALL' : `P${pattern.loopPage() + 1}`}`,
  onInput(i) {
    if (!acting(i)) return true;
    switch (i.kind) {
      case 'left':
      case 'right': {
        const dir = i.kind === 'left' ? -1 : 1;
        setEditPage((pattern.editPage() + dir + 4) % 4);
        return true;
      }
      case 'up':
      case 'down': {
        const dir = i.kind === 'up' ? 1 : -1;
        setLenPages(pattern.pageCount() + dir);
        return true;
      }
      case 'data': {
        setLenPages(pattern.pageCount() + (i.delta ?? 0));
        return true;
      }
      case 'yes': {
        const from = pattern.editPage();
        const to = copyTarget === from ? ((from + 1) % 4) as 0 | 1 | 2 | 3 : copyTarget;
        if (to >= pattern.pageCount()) pattern.setPageCount((to + 1) as 1 | 2 | 3 | 4);
        pattern.copyPageTo(from, to);
        lcdMessage.show(`COPIED P${from + 1} -> P${to + 1}`, 1400, true);
        menuChanged();
        return true;
      }
      default:
        return false;
    }
  },
});
