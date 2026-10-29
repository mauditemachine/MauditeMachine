/**
 * Les marques des trigs d'une voix sur les seize pas (V.5.1, 2026-10-29, l'etape D2 facon Digitakt) : ses lock trigs (un
 * pas sans velocite dont le verrou ltrg vaut 1 : allume en jaune) et ses pas a condition (un trig, note ou lock, dont la
 * COND n'est pas NONE ou dont la PROB est sous 100 % : un petit point jaune au coin), en masques de 16 bits (bit i : le pas
 * i). Pur : lu par scene/renderer.ts (les touches) et hw/snapshot.ts (le boitier).
 */

import type { Inst } from '../theme';
import { lockOf, type Locks } from '../audio/locks';
import { trigValue, type TrigSet } from '../audio/trig';

export interface TrigMarks {
  ltrg: number;
  cond: number;
}

export const NO_MARKS: TrigMarks = { ltrg: 0, cond: 0 };

/** row : les seize velocites de la voix ('0' a '9'), comme le motif les garde. */
export function trigMarks(row: string | undefined, locks: Readonly<Locks> | null | undefined, trigs: Readonly<TrigSet> | null | undefined, inst: Inst | null): TrigMarks {
  if (!inst || !row) return NO_MARKS;
  let ltrg = 0;
  let cond = 0;
  for (let i = 0; i < 16; i += 1) {
    const vel = row.charCodeAt(i) - 48;
    const l = lockOf(locks, inst, i);
    const lt = vel <= 0 && l?.ltrg === 1;
    if (lt) ltrg |= 1 << i;
    if (vel > 0 || lt) {
      if (trigValue(trigs, inst, 'cond', l) !== 0 || trigValue(trigs, inst, 'prob', l) < 100) cond |= 1 << i;
    }
  }
  return { ltrg, cond };
}
