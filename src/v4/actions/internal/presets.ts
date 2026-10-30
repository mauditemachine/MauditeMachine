/**
 * Les actions du MM-RYTM, presets : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { softSlotOf } from '../../rytm/presetKeys';
import type { FpButtonId } from '../../rytm/faceplate';
import { funcDrop } from '../face';
import { presetKey, presetTurns } from '../presets';

/**
 * Une touche de la face sous l'ecran pendant le mode presets du desktop : la touche de l'ecran au-dessus d'elle (LOAD,
 * SAVE, NAME, DEL, EXIT ; OVERWRITE, YES, OK...) ; true si elle l'a ete (sa page, son EDIT, ne partent pas).
 */
export function presetSoftKey(id: FpButtonId, press: () => void): boolean {
  if (!presetTurns()) return false;
  const slot = softSlotOf(id);
  if (!slot) return false;
  // FUNC n'a pas de sens sur une touche de l'ecran (la revue de D1, G2) : la touche fait la sienne, FUNC s'en va
  funcDrop();
  press();
  presetKey('mm808', slot);
  return true;
}
