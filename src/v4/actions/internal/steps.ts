/**
 * Les actions du MM-RYTM, steps : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { lcdMessage } from '../../state/lcdMessage';
import { st } from '../state';

/** La tenue d'un pas hors REC au desktop : pas de P-LOCK (il demande REC, comme la Digitakt) ; l'ecran le dit une fois. */
export function recHoldHint(force = false): void {
  if (st.recHinted && !force) return;
  st.recHinted = true;
  lcdMessage.show('P-LOCK NEEDS ● REC: TURN REC ON, THEN HOLD A STEP', 2200);
}
