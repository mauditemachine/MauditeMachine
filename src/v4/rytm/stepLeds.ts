/**
 * Les seize pas quand TRK est tenu ou garde (2026-10-27, la phase 2, Mika : "TRK tenu, les pas 1 a 8 s'allument a la
 * couleur de leur voix, la voix choisie a pleine intensite") : pur, lu par scene/sequencer3d.ts aujourd'hui et par les
 * LED RGB des pas du boitier demain. Les pas 9 a 16 sont reserves : eteints.
 */

import { RYTM_FACEPLATE } from './faceplate';
import type { Inst } from '../theme';

export interface TrkLed {
  /** la couleur sRGB d'affichage de la voix (rytm/faceplate.ts steps.voiceColor) ; '' : eteint */
  readonly color: string;
  /** l'intensite (0 eteint, 1 pleine) : la voix choisie, les autres, une voix coupee (theme.ts TRK_LIT) */
  readonly level: number;
  /** la barre du pas : MUTE (la voix coupee), SOLO (en solo) ; null aucune */
  readonly bar: 'mute' | 'solo' | null;
  /** la voix du pas (null : 9 a 16) */
  readonly inst: Inst | null;
}

/** Les niveaux (theme.ts TRK_LIT ou TRK_LIT_LIGHT). */
export interface TrkLevels {
  readonly cur: number;
  readonly other: number;
  readonly muted: number;
}

/** Les seize pas en vue TRK : cur la voix choisie, muted et solo les voix coupees et en solo. */
export function trkLeds(cur: Inst | null, muted: readonly Inst[], solo: readonly Inst[], lv: TrkLevels): TrkLed[] {
  const voices = RYTM_FACEPLATE.steps.voices as readonly Inst[];
  const out: TrkLed[] = [];
  for (let i = 0; i < 16; i += 1) {
    const inst = i < voices.length ? voices[i] : null;
    if (!inst) {
      out.push({ color: '', level: 0, bar: null, inst: null });
      continue;
    }
    const m = muted.includes(inst);
    const level = inst === cur ? lv.cur : m ? lv.muted : lv.other;
    out.push({ color: RYTM_FACEPLATE.steps.voiceColor[inst], level, bar: m ? 'mute' : solo.includes(inst) ? 'solo' : null, inst });
  }
  return out;
}
