/**
 * Les actions du MM-RYTM : le mixeur et les reglages de trig de la page MIXER (mixer, seqDial). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/mixer.ts.
 */

import { lfoOf, voiceFx } from '../audio/voicefx';
import { type StepLock } from '../audio/locks';
import { TRIG_RANGE, isTrigParam, trigText, trigUnit, type TrigParam } from '../audio/trig';
import { LFO_MULTS, isLfoParam, lfoDefault, lfoParts, lfoRange, lfoText, lfoUnit, type LfoParam } from '../audio/lfo';
import { pattern } from '../audio/pattern';
import { type SlotTarget } from '../rytm/pages';
import type { DialId } from './kit';

/* ---------- TRIG et MOD (V.5.1, 2026-10-29, l'etape D2) : q:<reglage>, la voix choisie ---------- */

/** Un reglage de trig (audio/trig.ts) ou d'un LFO (audio/lfo.ts) de la voix choisie. */
export type SeqDial = TrigParam | LfoParam;
export const seqDialOf = (id: DialId | SlotTarget | string | null): SeqDial | null => {
  if (typeof id !== 'string' || !id.startsWith('q:')) return null;
  const p = id.slice(2);
  return isTrigParam(p) || isLfoParam(p) ? p : null;
};
export const seqRange = (p: SeqDial): [number, number] => {
  const r = isTrigParam(p) ? TRIG_RANGE[p] : lfoRange(p);
  return [r[0], r[1]];
};
export function seqText(p: SeqDial, v: number): string {
  return isTrigParam(p) ? trigText(p, v) : lfoText(p, v);
}
/** Sa ligne d'unite ; lock : les verrous du pas montre (la duree d'un cycle de LFO lit SPD et MULT du pas s'ils y sont). */
export function seqUnit(p: SeqDial, v: number, lock?: Readonly<StepLock> | null): string {
  const stepMs = (60 / pattern.get().bpm / 4) * 1000;
  if (isTrigParam(p)) return trigUnit(p, v, stepMs);
  const inst = pattern.get().instrument;
  const { n } = lfoParts(p);
  const fx = inst ? voiceFx.of(inst) : null;
  const pick = (k: 'spd' | 'mul'): number => {
    const id = `l${n}${k}` as LfoParam;
    const lv = lock?.[id];
    return typeof lv === 'number' ? lv : fx ? lfoOf(fx, id) : lfoDefault(id);
  };
  return lfoUnit(p, v, { spd: pick('spd'), mul: Math.max(0, Math.min(LFO_MULTS.length - 1, pick('mul'))) }, stepMs);
}
