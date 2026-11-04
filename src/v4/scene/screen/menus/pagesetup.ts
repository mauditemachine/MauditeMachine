/**
 * Le menu PAGE SETUP du sequenceur (2026-11-02, Mika : "le bouton Page sert pour le sequenceur... ca sert pour avoir
 * 16 / 32 ou plus de steps dans le sequenceur et a choisir ce qui joue") :
 * - Potard A (STEPS) : 1 a 64 STEPS (n'importe quelle longueur arbitraire, 3 pas, 16 pas, 32 pas...)
 * - Potard B (EDIT)  : P1 (1-16) / P2 (17-32) / P3 (33-48) / P4 (49-64) : quelle page on edite sur les 16 boutons TRIG
 * - Potard C (PLAY)  : ALL (joue 1..N), LOOP P1..P4, ou SINGLE (casser la chaine de patterns si une chaine joue)
 * - Potard D (COPY)  : copie la page editee vers la page cible (YES pour copier)
 * - En bas de l'ecran : apercu en direct des 4 pages (P1 a P4) avec les pas actifs et tronques a la longueur.
 */

import { clock } from '../../../audio/clock';
import { pattern, velocity } from '../../../audio/pattern';
import { resume } from '../../../audio/drums';
import { dtFace } from '../../../state/dtFace';
import { lcdMessage } from '../../../state/lcdMessage';
import { patterns } from '../../../state/patterns';
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

function setStepLength(n: number): void {
  resume();
  const s = Math.max(1, Math.min(64, Math.round(n)));
  pattern.setStepCount(s);
  dtFace.setPtnPage(pattern.editPage());
  const pg = pattern.pageCount();
  lcdMessage.show(`LENGTH: ${s} STEPS (${pg} ${pg > 1 ? 'PAGES' : 'PAGE'})`, 1400, true);
  menuChanged();
}

function setEditPage(p: number): void {
  resume();
  const idx = Math.max(0, Math.min(3, Math.round(p))) as 0 | 1 | 2 | 3;
  pattern.setEditPage(idx);
  dtFace.setPtnPage(idx);
  const total = pattern.stepCount();
  const start = idx * 16 + 1;
  const end = Math.min(total, (idx + 1) * 16);
  lcdMessage.show(`EDIT PAGE ${idx + 1}/${pattern.pageCount()} (STEPS ${start}-${end})`, 1400, true);
  menuChanged();
}

function setPlayMode(v: number): void {
  resume();
  const chaining = patterns.get().chain.length > 1;
  const rnd = Math.round(v);
  if (chaining && rnd === -1) {
    patterns.unchain();
    pattern.setLoopPage(-1);
    lcdMessage.show('SINGLE PATTERN MODE (CHAIN CLEARED)', 1400, true);
    menuChanged();
    return;
  }
  const lp = Math.max(-1, Math.min(pattern.pageCount() - 1, rnd)) as -1 | 0 | 1 | 2 | 3;
  pattern.setLoopPage(lp);
  lcdMessage.show(lp < 0 ? `PLAY ALL STEPS (1-${pattern.stepCount()})` : `LOOP PAGE ${lp + 1} ONLY`, 1400, true);
  menuChanged();
}

registerDialSpec('z:pg:len', {
  value: () => pattern.stepCount(),
  set: (v) => setStepLength(v),
  range: () => [1, 64],
  steps: () => 64,
  text: (v) => `${Math.max(1, Math.min(64, Math.round(v)))}`,
  unit: (v) => {
    const s = Math.max(1, Math.min(64, Math.round(v)));
    const pg = Math.ceil(s / 16);
    return s % 16 === 0 ? `${pg} PG` : `${s % 16}/16`;
  },
  reset: () => 16,
});

registerDialSpec('z:pg:edit', {
  value: () => pattern.editPage(),
  set: (v) => setEditPage(v),
  range: () => [0, 3],
  steps: () => 4,
  text: (v) => `P${Math.max(0, Math.min(3, Math.round(v))) + 1}`,
  unit: (v) => {
    const idx = Math.max(0, Math.min(3, Math.round(v)));
    const total = pattern.stepCount();
    const start = idx * 16 + 1;
    const end = Math.min(Math.max(start, total), (idx + 1) * 16);
    return `${start}-${end}`;
  },
  reset: () => 0,
});

registerDialSpec('z:pg:play', {
  value: () => {
    const chaining = patterns.get().chain.length > 1;
    return chaining ? -2 : pattern.loopPage();
  },
  set: (v) => setPlayMode(v),
  range: () => (patterns.get().chain.length > 1 ? [-2, 3] : [-1, 3]),
  steps: () => (patterns.get().chain.length > 1 ? 6 : 5),
  text: (v) => {
    const r = Math.round(v);
    if (r <= -2) return 'CHAIN';
    if (r === -1) return patterns.get().chain.length > 1 ? 'SINGLE' : 'ALL';
    return `P${r + 1}`;
  },
  unit: (v) => {
    const r = Math.round(v);
    if (r <= -2) return `${patterns.get().chain.length} PTNS`;
    if (r === -1) return `1-${pattern.stepCount()}`;
    return 'LOOP';
  },
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
  title: () => `SEQ PAGES · ${pattern.stepCount()} STEPS`,
  slots: () => PAGESETUP_SLOTS,
  paint(screen) {
    const total = pattern.stepCount();
    const cnt = pattern.pageCount();
    const edit = pattern.editPage();
    const loop = pattern.loopPage();
    const playing = clock.running ? clock.playingPage() : -1;
    const tk = activeTrack.get() ?? 'BD';
    const chaining = patterns.get().chain.length > 1;

    const x0 = 48;
    const y0 = 108;
    const gap = 4;
    const cardW = (254 - gap * 3) / 4;
    const cardH = 66;

    for (let p = 0; p < 4; p += 1) {
      const cx = x0 + p * (cardW + gap);
      const startStep = p * 16;
      const endStep = Math.min(total, (p + 1) * 16);
      const active = startStep < total;
      const isEdit = p === edit;
      const isPlay = p === playing || (loop === p && !clock.running);
      screen.roundRect(cx, y0, cardW, cardH, 3, isEdit ? INK : null, active ? INK : FRAME, isEdit ? 1.2 : 0.8);
      const fg = isEdit ? BLACK : active ? INK : DIM_TEXT;
      const sub = isEdit ? BLACK : active ? HALF : FAINT;

      screen.text(`P${p + 1}`, cx + 5, y0 + 11, 8.5, fg, 700, 'left', 0.3);
      const rangeLabel = active ? `${startStep + 1}-${endStep}` : `${startStep + 1}-${(p + 1) * 16}`;
      screen.text(rangeLabel, cx + cardW - 4, y0 + 10.5, 6.2, sub, 600, 'right', 0.2);

      const badge = !active ? 'OFF' : loop === p ? 'LOOP' : isPlay ? 'PLAY' : isEdit ? 'EDIT' : 'ON';
      screen.text(badge, cx + 5, y0 + 22, 6.2, sub, 700, 'left', 0.4);

      const pSteps = pattern.stepsOfPage(p);
      for (let s = 0; s < 16; s += 1) {
        const stepNum = startStep + s;
        const inPattern = stepNum < total;
        const row = Math.floor(s / 8);
        const col = s % 8;
        const sx = cx + 5 + col * 6.4;
        const sy = y0 + 30 + row * 13;
        const vel = inPattern ? velocity(pSteps, tk, s) : 0;
        if (!inPattern) {
          screen.roundRect(sx, sy, 4.8, 8.5, 1, null, FAINT, 0.3);
        } else if (vel > 0) {
          screen.roundRect(sx, sy, 4.8, 8.5, 1, fg);
        } else {
          screen.roundRect(sx, sy, 4.8, 8.5, 1, null, sub, 0.6);
        }
      }
    }

    if (chaining) {
      screen.text('CHAIN ACTIVE · YES: SINGLE PTN (UNCHAIN) · DATA: STEPS 1-64', 175, 186, 6.2, DIM_TEXT, 700, 'center', 0.3);
    } else {
      screen.text('PAGE: EDIT P1-P4 · DATA: STEPS 1-64 · UP/DOWN: +/-16 · YES: COPY', 175, 186, 6.2, DIM_TEXT, 700, 'center', 0.3);
    }
    return clock.running ? 120 : 0;
  },
  info: () => `LEN ${pattern.stepCount()} EDIT P${pattern.editPage() + 1} PLAY ${pattern.loopPage() < 0 ? 'ALL' : `P${pattern.loopPage() + 1}`}`,
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
        const dir = i.kind === 'up' ? 16 : -16;
        setStepLength(pattern.stepCount() + dir);
        return true;
      }
      case 'data': {
        setStepLength(pattern.stepCount() + (i.delta ?? 0));
        return true;
      }
      case 'yes': {
        if (patterns.get().chain.length > 1) {
          patterns.unchain();
          pattern.setLoopPage(-1);
          lcdMessage.show('SINGLE PATTERN MODE (CHAIN CLEARED)', 1400, true);
          menuChanged();
          return true;
        }
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
