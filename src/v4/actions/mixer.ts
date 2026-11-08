/**
 * Les actions du MM-RYTM : le mixeur et les reglages de trig de la page MIXER (mixer, seqDial). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/mixer.ts.
 */

import { lfoOf, voiceFx } from '../audio/voicefx';
import { type StepLock } from '../audio/locks';
import { TRIG_RANGE, isTrigParam, trigText, trigUnit, type TrigParam } from '../audio/trig';
import { LFO_MULTS, isLfoParam, lfoDefault, lfoParts, lfoRange, lfoText, lfoUnit, type LfoParam } from '../audio/lfo';
import { pattern } from '../audio/pattern';
import { tracks } from '../audio/tracks';
import { type SlotTarget } from '../rytm/pages';
import { lcdMessage } from '../state/lcdMessage';
import { DT2_FACE } from '../theme';
import { menuInput, openMenu, screenTrack } from '../scene/screen/menus/open';
import { dialSpecOf } from '../scene/screen/menus/registry';
import type { DialId } from './kit';

/* ---------- LEVEL/DATA (V.6.0, lane B5, 2026-11-01, la face DT2, cahier dt2 3.1 et 4.1) ---------- */

/**
 * LEVEL/DATA tourne de delta crans (vers la droite : positif ; B4 l'appelle depuis le glisser de la zone data, le clavier,
 * le MIDI rytm:data) : un menu ouvert le prend (sa liste, sa valeur, onInput data) ; sinon le TRK LEV de la piste active
 * (tlev, 0.8 = 0 dB, non verrouillable), un cent-vingt-septieme par cran (FUNC : huit). true s'il a servi.
 */
export function levelDataTurn(delta: number, func = false): boolean {
  if (!DT2_FACE || !Number.isFinite(delta) || delta === 0) return false;
  if (openMenu()) return menuInput({ kind: 'data', delta, func, phase: 'down' });
  const t = screenTrack();
  if (!t) {
    lcdMessage.show('PICK A TRACK: TRK + TRIG', 1200);
    return false;
  }
  const sp = dialSpecOf(`k:${t}`);
  if (!sp) return false;
  sp.set(Math.max(0, Math.min(1, sp.value() + (delta * (func ? 8 : 1)) / 127)));
  return true;
}

/**
 * Ce que montre l'anneau de LEVEL/DATA (la face DT2, scene/sideKnobs.ts setRing('data')) : le TRK LEV de la piste active,
 * de 0 a 1 ; sans piste, eteint. Un menu ouvert ne change pas l'anneau (le potard y fait defiler).
 */
export function levelDataView(): { t: number; live: boolean } {
  if (!DT2_FACE) return { t: 0, live: false };
  const t = screenTrack();
  return t ? { t: tracks.param(t, 'tlev'), live: true } : { t: 0, live: false };
}

/* ---------- TRIG et MOD (V.5.1, 2026-10-29, l'etape D2) : q:<reglage>, la voix choisie ---------- */

/** Un reglage de trig (audio/trig.ts) ou d'un LFO (audio/lfo.ts) de la voix choisie. */
export type SeqDial = TrigParam | LfoParam;
export const seqDialOf = (id: DialId | SlotTarget | string | null): SeqDial | null => {
  if (typeof id !== 'string' || !id.startsWith('q:')) return null;
  const p = id.slice(2);
  return isTrigParam(p) || isLfoParam(p) ? p : null;
};
export const seqRange = (p: SeqDial): [number, number] => {
  // TLEN (le plugin) : au plus la longueur du pattern (une piste plus longue jouerait des pas qu'il n'a pas)
  if (p === 'tlen') return [0, Math.max(1, pattern.stepCount())];
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
