/**
 * Les actions du MM-RYTM, mixer : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { resume, setVoiceFx } from '../../audio/drums';
import { lfoOf, voiceFx } from '../../audio/voicefx';
import { TRACK_KEYS, TRACK_NAMES, TYPED_TRACKS, isLegacyTrack, trackIndex, tracks, type TrackKey } from '../../audio/tracks';
import { TRIG_DEF, isTrigParam, trigValue, type TrigParam } from '../../audio/trig';
import { lfoDefault, lfoParts } from '../../audio/lfo';
import { INSTRUMENTS, pattern } from '../../audio/pattern';
import { lcdMessage } from '../../state/lcdMessage';
import { activeTrack } from '../../state/trk';
import { type SlotTarget } from '../../rytm/pages';
import { encText, encUnit } from '../../rytm/values';
import { DT2_FACE, LCD_NO_VOICE, POT_UI, type Inst } from '../../theme';
import { touchPage } from './dials';
import { LFO_KEY_NAMES } from './locks';
import { sceneFollowId, sceneTakeId } from '../scenes';
import type { DialId } from '../kit';
import { type SeqDial, seqRange, seqText, seqUnit } from '../mixer';

/* ---------- le MIXER (FUNC + MOD) : le VOL de chaque voix ---------- */

/**
 * m:<voix> : le VOL d'une voix du MIXER ; le plugin (2026-11-08, Mika : "voir le level de tout [...] et le moduler avec le
 * crossfade") : les 16 pistes (m:T9 ... m:T16), le niveau de LEVEL/DATA et du MIXER, gardable dans les scenes A et B.
 */
export const mixerInst = (id: DialId | SlotTarget | string): TrackKey | null => {
  if (typeof id !== 'string' || !id.startsWith('m:')) return null;
  const k = id.slice(2);
  if ((INSTRUMENTS as readonly string[]).includes(k)) return k as Inst;
  return TYPED_TRACKS && (TRACK_KEYS as readonly string[]).includes(k) ? (k as TrackKey) : null;
};
/** Le VOL d'une piste (0 a 1, 0.8 = 0 dB). */
export const mixerLevel = (t: TrackKey): number => (isLegacyTrack(t) ? voiceFx.of(t as Inst).level : tracks.vfx(t).level);
/** Pose le VOL d'une piste (hors scenes) : les voix 1 a 8 par voiceFx (le moteur du site), les pistes 9 a 16 par le store. */
export function mixerBaseSet(t: TrackKey, v: number): void {
  const x = Math.max(0, Math.min(1, v));
  if (isLegacyTrack(t)) setVoiceFx(t as Inst, 'level', x);
  else tracks.set(t, 'level', x);
}
/** Le VOL d'une voix du MIXER (0 a 1) : une scene armee le prend, une scene qui le fait entendre suit la main. */
export function mixerSet(inst: TrackKey, v: number): void {
  const id = `rytm:voice:${inst}:level`;
  const x = Math.max(0, Math.min(1, v));
  if (sceneTakeId(id, x)) return;
  if (!sceneFollowId(id, x, mixerLevel(inst), (w) => mixerBaseSet(inst, w))) mixerBaseSet(inst, x);
}
/** Le potard d'un bloc du MIXER, apres les scenes (anyDial les a deja servies) : le VOL de la voix, et l'ecran le dit. */
export function mixerDial(inst: TrackKey, v: number): void {
  resume();
  mixerBaseSet(inst, v);
  const l = mixerLevel(inst);
  lcdMessage.show(`${TRACK_NAMES[trackIndex(inst)] ?? inst} VOL ${encText('vol', l, l, false)}  ${encUnit('vol', l)}`, POT_UI.readoutMs, true);
}
const SEQ_NAME: Readonly<Record<TrigParam, string>> = { len: 'LEN', prob: 'PROB', cond: 'COND', utime: 'μTIME', lfot: 'LFO.T', rtrg: 'RTRG', rate: 'RATE', vfad: 'VFAD', rlen: 'RLEN', tlen: 'TLEN', vtun: 'VAR TUNE', vflt: 'VAR FREQ', vlev: 'VAR LEV', vpan: 'VAR PAN', vdec: 'VAR DEC', vsta: 'VAR START', vchn: 'VAR CHANCE', vsed: 'VAR SEED' };
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
  if (inst) return isTrigParam(p) ? trigValue(pattern.get().trigs, inst, p) : lfoOf(voiceFx.of(inst), p);
  const tk = DT2_FACE ? activeTrack.get() : null;
  if (!tk) return seqDefault(p);
  return isTrigParam(p) ? trigValue(pattern.get().trigs, tk, p) : tracks.param(tk, p);
}
/** Le potard tourne (hors P-LOCK) : le defaut de la voix dans le pattern (TRIG), son LFO (MOD) ; l'ecran le dit. */
export function seqDial(p: SeqDial, v: number): void {
  resume();
  const inst = pattern.get().instrument;
  const tk = inst ?? (DT2_FACE ? activeTrack.get() : null);
  if (!tk) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const [lo, hi] = seqRange(p);
  const x = Math.max(lo, Math.min(hi, Math.round(v)));
  if (isTrigParam(p)) pattern.setTrig(tk, p, x);
  else if (inst) voiceFx.setLfo(inst, p, x);
  else tracks.set(tk, p, x);
  const now = seqValue(p);
  lcdMessage.show(`${tk} ${seqName(p)} ${seqText(p, now)}  ${seqUnit(p, now)}`, POT_UI.readoutMs, true);
  touchPage(`q:${p}` as SlotTarget, inst);
}
