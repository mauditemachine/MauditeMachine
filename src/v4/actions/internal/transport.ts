/**
 * Les actions du MM-RYTM, transport : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { BPM, BPM_RANGE, pattern } from '../../audio/pattern';
import { lcdMessage } from '../../state/lcdMessage';
import { DT2_FACE, DT_GESTURE } from '../../theme';
import { eventAt } from '../shared';
import { anyDial } from '../anyDial';

/** Un ecran tactile (le doigt plutot que la souris) : l'aide de MUTE parle de double tape. */
export const coarsePointer = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

/* ---------- TAP TEMPO (YES sur la page TEMPO) ---------- */

let taps: number[] = [];
/**
 * Un TAP : la moyenne des intervalles apres DT_GESTURE.tapTaps tapes, arrondie au BPM, bornee a BPM (100 a 150). La face DT2
 * (l'integration de la V.6.0, FUNC + TEMPO, rytm:tap) : au dixieme, de 30 a 300 (audio/pattern.ts BPM_RANGE, V.5.9).
 */
export function tapTempo(): void {
  const t = eventAt();
  if (taps.length > 0 && t - taps[taps.length - 1] > DT_GESTURE.tapResetMs) taps = [];
  taps.push(t);
  if (taps.length > 8) taps.shift();
  if (taps.length < DT_GESTURE.tapTaps) {
    lcdMessage.show(`TAP ${taps.length}/${DT_GESTURE.tapTaps}`, 1200);
    return;
  }
  const ms = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
  if (DT2_FACE) {
    pattern.setBpmFine(Math.max(BPM_RANGE.min, Math.min(BPM_RANGE.max, Math.round(600000 / ms) / 10)));
    lcdMessage.show(`TAP TEMPO ${pattern.get().bpm.toFixed(1)} BPM`, 1400);
    return;
  }
  const bpm = Math.max(BPM.min, Math.min(BPM.max, Math.round(60000 / ms)));
  anyDial('tempo', bpm);
  lcdMessage.show(`TAP TEMPO ${Math.round(pattern.get().bpm)} BPM`, 1400);
}
