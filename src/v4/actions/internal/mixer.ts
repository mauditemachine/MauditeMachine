/**
 * Les actions du MM-RYTM, mixer : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { resume, setVoiceFx } from '../../audio/drums';
import { lfoOf, voiceFx } from '../../audio/voicefx';
import { TRIG_DEF, isTrigParam, trigValue, type TrigParam } from '../../audio/trig';
import { lfoDefault, lfoParts } from '../../audio/lfo';
import { INSTRUMENTS, pattern } from '../../audio/pattern';
import { lcdMessage } from '../../state/lcdMessage';
import { type SlotTarget } from '../../rytm/pages';
import { encText, encUnit } from '../../rytm/values';
import { LCD_NO_VOICE, POT_UI, type Inst } from '../../theme';
import { touchPage } from './dials';
import { LFO_KEY_NAMES } from './locks';
import { sceneFollowId, sceneTakeId } from '../scenes';
import type { DialId } from '../kit';
import { type SeqDial, seqRange, seqText, seqUnit } from '../mixer';

/* ---------- le MIXER (FUNC + MOD) : le VOL de chaque voix ---------- */

export const mixerInst = (id: DialId | SlotTarget | string): Inst | null => (typeof id === 'string' && id.startsWith('m:') && (INSTRUMENTS as readonly string[]).includes(id.slice(2)) ? (id.slice(2) as Inst) : null);
/** Le VOL d'une voix du MIXER (0 a 1) : une scene armee le prend, une scene qui le fait entendre suit la main. */
export function mixerSet(inst: Inst, v: number): void {
  const id = `rytm:voice:${inst}:level`;
  const x = Math.max(0, Math.min(1, v));
  if (sceneTakeId(id, x)) return;
  if (!sceneFollowId(id, x, voiceFx.of(inst).level, (w) => setVoiceFx(inst, 'level', w))) setVoiceFx(inst, 'level', x);
}
/** Le potard d'un bloc du MIXER, apres les scenes (anyDial les a deja servies) : le VOL de la voix, et l'ecran le dit. */
export function mixerDial(inst: Inst, v: number): void {
  resume();
  setVoiceFx(inst, 'level', Math.max(0, Math.min(1, v)));
  lcdMessage.show(`${inst} VOL ${encText('vol', voiceFx.of(inst).level, voiceFx.of(inst).level, false)}  ${encUnit('vol', voiceFx.of(inst).level)}`, POT_UI.readoutMs, true);
}
const SEQ_NAME: Readonly<Record<TrigParam, string>> = { len: 'LEN', prob: 'PROB', cond: 'COND', utime: 'μTIME', lfot: 'LFO.T', rtrg: 'RTRG', rate: 'RATE', vfad: 'VFAD', rlen: 'RLEN' };
/** Son nom a l'ecran : LEN, LFO1 DEP. */
export function seqName(p: SeqDial): string {
  if (isTrigParam(p)) return SEQ_NAME[p];
  const { n, key } = lfoParts(p);
  return `LFO${n} ${LFO_KEY_NAMES.find(([k]) => k === key)?.[1] ?? key.toUpperCase()}`;
}
export const seqDefault = (p: SeqDial): number => (isTrigParam(p) ? TRIG_DEF[p] : lfoDefault(p));
/** Sa valeur pour la voix choisie : le defaut de la voix dans le pattern (TRIG), son reglage de voix (MOD). */
export function seqValue(p: SeqDial): number {
  const inst = pattern.get().instrument;
  if (!inst) return seqDefault(p);
  return isTrigParam(p) ? trigValue(pattern.get().trigs, inst, p) : lfoOf(voiceFx.of(inst), p);
}
/** Le potard tourne (hors P-LOCK) : le defaut de la voix dans le pattern (TRIG), son LFO (MOD) ; l'ecran le dit. */
export function seqDial(p: SeqDial, v: number): void {
  resume();
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const [lo, hi] = seqRange(p);
  const x = Math.max(lo, Math.min(hi, Math.round(v)));
  if (isTrigParam(p)) pattern.setTrig(inst, p, x);
  else voiceFx.setLfo(inst, p, x);
  const now = seqValue(p);
  lcdMessage.show(`${inst} ${seqName(p)} ${seqText(p, now)}  ${seqUnit(p, now)}`, POT_UI.readoutMs, true);
  touchPage(`q:${p}` as SlotTarget, inst);
}
