/**
 * Le menu TEMPO de la face DT2 (V.6.0, lane B5, 2026-11-01, cahier dt2 3.3 et 1.3, inv-dt-ui.md 4.2) : la touche TEMPO
 * (FUNC + TEMPO = TAP, lane B4). Ses potards comme une page : A BPM, B FINE, D SWING ; E METRO, F SIG., G PREROLL, H VOL
 * (le metronome, V.6.1). LEVEL/DATA regle le BPM comme A ; UP / DOWN aussi (FUNC : de 4 en 4, le "presser et tourner").
 * YES : le metronome (V.6.1, le message le dit). NO ferme.
 *
 * Le moteur garde en V.6.0 son tempo entier de 100 a 150 (audio/pattern.ts BPM, lane B1) : FINE (le dixieme) et la
 * course 30 a 300 arriveront avec lui ; le bloc FINE le dit (SOON).
 */

import { pattern } from '../../../audio/pattern';
import { anyDial, dialRange } from '../../../actions';
import { lcdMessage } from '../../../state/lcdMessage';
import type { PageSlot, SlotTarget } from '../../../rytm/pages';
import { registerScreenMenu } from './registry';
import { acting } from './frame';

const live = (label: string, target: SlotTarget, draw: PageSlot['draw']): PageSlot => ({ label, target, scope: 'all', draw });
const soon = (label: string): PageSlot => ({ label, target: null, scope: 'all', draw: 'bar' });
const EMPTY: PageSlot = { label: '', target: null, scope: 'all', draw: 'bar' };

/** Les huit potards du menu TEMPO (cahier 3.3, la DT2) ; le metronome et FINE a venir. */
export const TEMPO_SLOTS: readonly PageSlot[] = [live('BPM', 'tempo', 'bar'), soon('FINE'), EMPTY, live('SWNG', 'swing', 'swing'), soon('METR'), soon('SIG.'), soon('PRRL'), soon('VOL')];

/** Le tempo d'un cran (FUNC : 4 BPM, le "presser et tourner" de la DT2), dans sa course. */
function bpmBy(n: number): void {
  const [lo, hi] = dialRange('tempo');
  anyDial('tempo', Math.max(lo, Math.min(hi, Math.round(pattern.get().bpm) + n)));
}

registerScreenMenu({
  id: 'tempo',
  owner: 'B5',
  title: () => 'TEMPO',
  slots: () => TEMPO_SLOTS,
  paint: () => 0,
  info: () => `BPM ${pattern.get().bpm}`,
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
