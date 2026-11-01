/**
 * Le menu TEMPO de la face DT2 (V.6.0, lane B5, 2026-11-01, cahier dt2 3.3 et 1.3, inv-dt-ui.md 4.2) : la touche TEMPO
 * (FUNC + TEMPO = TAP, lane B4). Ses potards comme une page : A BPM, B FINE, D SWING ; E METRO, F SIG., G PREROLL, H VOL
 * (le metronome, V.6.1). LEVEL/DATA regle le BPM comme A ; UP / DOWN aussi (FUNC : de 4 en 4, le "presser et tourner").
 * YES : le metronome (V.6.1, le message le dit). NO ferme.
 *
 * L'integration de la V.6.0 (la fusion de V.5.9 corrigee : audio/pattern.ts BPM_RANGE, SWING_MAX) : les bornes de la DT2,
 * BPM 30 a 300 au dixieme (A l'entier, B FINE le dixieme) et SWING 50 a 80 % (la loi de toujours : 0 = 50 %, 1 = 66,7 %,
 * 1,8 = 80 %). Ses reglages ont leurs fiches (z:bpm, z:bpmf, z:swing) : le potard TEMPO d'avant (rytm:enc:tempo, le Roto,
 * la face V.5.3) garde sa course de 100 a 150.
 */

import { BPM_RANGE, SWING_MAX, clampSwing, pattern } from '../../../audio/pattern';
import { resume } from '../../../audio/drums';
import { lcdMessage } from '../../../state/lcdMessage';
import type { PageSlot, SlotTarget } from '../../../rytm/pages';
import { registerDialSpec, registerScreenMenu } from './registry';
import { acting } from './frame';

const live = (label: string, target: SlotTarget, draw: PageSlot['draw']): PageSlot => ({ label, target, scope: 'all', draw });
const soon = (label: string): PageSlot => ({ label, target: null, scope: 'all', draw: 'bar' });
const EMPTY: PageSlot = { label: '', target: null, scope: 'all', draw: 'bar' };

/** Les huit potards du menu TEMPO (cahier 3.3, la DT2) ; le metronome a venir. */
export const TEMPO_SLOTS: readonly PageSlot[] = [live('BPM', 'z:bpm' as SlotTarget, 'bar'), live('FINE', 'z:bpmf' as SlotTarget, 'bar'), EMPTY, live('SWNG', 'z:swing' as SlotTarget, 'swing'), soon('METR'), soon('SIG.'), soon('PRRL'), soon('VOL')];

/** Le tempo au dixieme, dans les bornes de la DT2 (30 a 300) ; l'ecran le dit. */
function bpmSet(b: number): void {
  resume();
  pattern.setBpmFine(Math.round(Math.max(BPM_RANGE.min, Math.min(BPM_RANGE.max, b)) * 10) / 10);
  lcdMessage.show(`TEMPO ${pattern.get().bpm.toFixed(1)} BPM`, 1200, true);
}

/** Le tempo d'un cran (FUNC : 4 BPM, le "presser et tourner" de la DT2), dans sa course ; le dixieme reste. */
function bpmBy(n: number): void {
  bpmSet(pattern.get().bpm + n);
}

/** Le dixieme du tempo (0 a 9). */
const tenth = (b: number): number => Math.round((b - Math.floor(b + 1e-6)) * 10) % 10;
/** Le pourcentage de SWING d'une valeur de la loi (0 = 50 %, 1 = 66,7 %, 1,8 = 80 %). */
const swingPct = (v: number): number => Math.round(50 + (v * 50) / 3);

registerDialSpec('z:bpm', {
  value: () => Math.floor(pattern.get().bpm + 1e-6),
  set: (v) => bpmSet(Math.round(v) + tenth(pattern.get().bpm) / 10),
  range: () => [BPM_RANGE.min, BPM_RANGE.max],
  steps: () => BPM_RANGE.max - BPM_RANGE.min + 1,
  text: (v) => String(Math.round(v)),
  unit: () => `${pattern.get().bpm.toFixed(1)} BPM`,
  reset: () => 120,
});
registerDialSpec('z:bpmf', {
  value: () => tenth(pattern.get().bpm),
  set: (v) => bpmSet(Math.floor(pattern.get().bpm + 1e-6) + Math.max(0, Math.min(9, Math.round(v))) / 10),
  range: () => [0, 9],
  steps: () => 10,
  text: (v) => `.${Math.max(0, Math.min(9, Math.round(v)))}`,
  unit: () => `${pattern.get().bpm.toFixed(1)} BPM`,
  reset: () => 0,
});
registerDialSpec('z:swing', {
  value: () => pattern.fx.get().swing,
  set(v) {
    resume();
    // Au pourcent (50 a 80) : la loi de toujours, 3/50 par pourcent
    const pct = Math.max(50, Math.min(80, swingPct(Math.max(0, Math.min(SWING_MAX, v)))));
    pattern.fx.set({ swing: clampSwing(((pct - 50) * 3) / 50) });
    lcdMessage.show(`SWING ${pct} %`, 1200, true);
  },
  range: () => [0, SWING_MAX],
  steps: () => 31,
  text: (v) => `${swingPct(v)}%`,
  unit: () => 'SWING',
  reset: () => 0,
});

registerScreenMenu({
  id: 'tempo',
  owner: 'B5',
  title: () => 'TEMPO',
  slots: () => TEMPO_SLOTS,
  paint: () => 0,
  info: () => `BPM ${pattern.get().bpm.toFixed(1)} SWING ${swingPct(pattern.fx.get().swing)}%`,
  onInput(i) {
    if (!acting(i)) return true;
    switch (i.kind) {
      case 'data':
        bpmBy((i.delta ?? 0) * (i.func ? 4 : 1));
        return true;
      case 'up':
      case 'down':
        bpmBy((i.kind === 'up' ? 1 : -1) * (i.func ? 4 : 1));
        return true;
      case 'yes':
        lcdMessage.show('METRONOME: BIENTOT V.6.1', 1400);
        return true;
      case 'left':
      case 'right':
        return true;
      default:
        return false;
    }
  },
});
