/**
 * Les actions du MM-RYTM, telephone et pistes 9 a 16 (V.6.0, lane B6, cahier dt2 1.3 et 5.1) : les aides que
 * actions/phone.ts utilise. Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { pattern, type Steps } from '../../audio/pattern';
import { TRACK_KEYS, TRACK_NAMES, isLegacyTrack, trackIndex, tracks, type TrackKey } from '../../audio/tracks';
import type { Inst } from '../../theme';

/** Les pistes 9 a 16 (la rangee du haut de la bascule du telephone), dans l'ordre des pads : pad i = piste 9 + i. */
export const HI_TRACKS: readonly TrackKey[] = TRACK_KEYS.slice(8);

/** Le nom d'une piste a l'ecran et dans les libelles (T1 a T16, cahier 4.1). */
export const trackName = (k: TrackKey): string => TRACK_NAMES[trackIndex(k)] ?? k;

/** Une rangee de pas a au moins un coup ? */
const rowHas = (steps: Readonly<Steps>, k: TrackKey): boolean => {
  const r = (steps as Readonly<Partial<Record<TrackKey, string>>>)[k];
  return typeof r === 'string' && /[1-9]/.test(r);
};

/**
 * Le pattern ou le kit se servent-ils d'une piste 9 a 16 (la regle de la bascule du telephone) : une rangee 9 a 16 qui a
 * un coup, ou une piste 9 a 16 qui a un son (une piste vide est muette, cahier 4.2 : ONESHOT, son OFF).
 */
export function uses916(): boolean {
  const steps = pattern.get().steps;
  for (const k of HI_TRACKS) if (rowHas(steps, k) || tracks.sounds(k)) return true;
  return false;
}

/** La piste d'un pad du telephone (0 a 7) selon la rangee affichee. */
export const padTrack = (i: number, hi: boolean): TrackKey | null => (i < 0 || i > 7 ? null : hi ? HI_TRACKS[i] : TRACK_KEYS[i]);

export { isLegacyTrack };
