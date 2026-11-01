/**
 * Le menu QUANTIZE de la face DT2 (V.6.0, lane B5, 2026-11-01, cahier dt2 3.3 ; inv-dt-seq.md 15) : FUNC + TRIG. E TRACK
 * (la piste active), H PATTERN (toutes les pistes) : de 0 a 100 %, en temps reel, plus haut = les trigs plus pres de la
 * grille. Il agit sur les uTIME stockes (les verrous uTIME des pas et le uTIME par defaut de chaque piste, audio/trig.ts) :
 * a l'ouverture le menu note ceux d'avant, chaque cran les recalcule depuis eux (u x (1 - q), arrondi au 1/384), jamais
 * d'un cran a l'autre ; NO ferme et garde. LEVEL/DATA et UP / DOWN reglent TRACK.
 */

import { pattern } from '../../../audio/pattern';
import { TRACK_KEYS, type TrackKey } from '../../../audio/tracks';
import { TRIG_DEF } from '../../../audio/trig';
import { lcdMessage } from '../../../state/lcdMessage';
import { anyDial, dialRange } from '../../../actions';
import type { PageSlot } from '../../../rytm/pages';
import { registerDialSpec, registerScreenMenu } from './registry';
import { acting } from './frame';
import { menuChanged, screenTrack } from './open';

const EMPTY: PageSlot = { label: '', target: null, scope: 'all', draw: 'bar' };
export const QUANTIZE_SLOTS: readonly PageSlot[] = [
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  { label: 'TRACK', target: 'z:qtrk', scope: 'all', draw: 'level' },
  EMPTY,
  EMPTY,
  { label: 'PTN', target: 'z:qptn', scope: 'all', draw: 'level' },
];

/** Les uTIME d'avant l'ouverture : par piste, le defaut, et chaque pas verrouille (pas : valeur). */
let snap: Map<TrackKey, { def: number; steps: Map<number, number> }> | null = null;
let amt = { trk: 0, ptn: 0 };

function take(): void {
  const p = pattern.get();
  snap = new Map();
  for (const k of TRACK_KEYS) {
    const steps = new Map<number, number>();
    const row = p.locks[k];
    if (row) for (const [i, l] of Object.entries(row)) if (typeof l.utime === 'number' && l.utime !== 0) steps.set(Number(i), l.utime);
    const def = p.trigs[k]?.utime ?? TRIG_DEF.utime;
    if (steps.size || def !== 0) snap.set(k, { def, steps });
  }
  amt = { trk: 0, ptn: 0 };
}

/** Ramene les uTIME d'une piste a q de la grille, depuis ceux d'avant l'ouverture. */
function apply(k: TrackKey, q: number): void {
  const s = snap?.get(k);
  if (!s) return;
  const at = (u: number): number => Math.round(u * (1 - q));
  for (const [i, u] of s.steps) {
    const n = at(u);
    if (n === 0) pattern.clearLock(k, [i], 'utime');
    else pattern.setLock(k, [i], 'utime', n);
  }
  if (s.def !== 0) pattern.setTrig(k, 'utime', at(s.def));
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

registerDialSpec('z:qtrk', {
  value: () => amt.trk,
  set(v) {
    const t = screenTrack();
    amt.trk = Math.max(0, Math.min(1, v));
    if (t) apply(t, Math.max(amt.trk, amt.ptn));
    lcdMessage.show(`QUANTIZE ${t ?? 'TRACK'} ${pct(amt.trk)}`, 1200, true);
    menuChanged();
  },
  range: () => [0, 1],
  steps: () => 101,
  text: pct,
  unit: () => {
    const t = screenTrack();
    return t ? `TRACK ${t}` : 'PICK A TRACK';
  },
  reset: () => 0,
});
registerDialSpec('z:qptn', {
  value: () => amt.ptn,
  set(v) {
    amt.ptn = Math.max(0, Math.min(1, v));
    for (const k of TRACK_KEYS) apply(k, amt.ptn);
    lcdMessage.show(`QUANTIZE PATTERN ${pct(amt.ptn)}`, 1200, true);
    menuChanged();
  },
  range: () => [0, 1],
  steps: () => 101,
  text: pct,
  unit: () => 'ALL TRACKS',
  reset: () => 0,
});

registerScreenMenu({
  id: 'quantize',
  owner: 'B5',
  title: () => 'QUANTIZE',
  slots: () => QUANTIZE_SLOTS,
  paint: () => 0,
  onOpen: take,
  onClose() {
    snap = null;
  },
  info: () => `TRACK ${pct(amt.trk)} PTN ${pct(amt.ptn)} (${snap ? snap.size : 0} tracks with uTIME)`,
  onInput(i) {
    if (!acting(i)) return true;
    const step = (n: number): void => {
      const [lo, hi] = dialRange('z:qtrk');
      anyDial('z:qtrk', Math.max(lo, Math.min(hi, amt.trk + n / 100)));
    };
    if (i.kind === 'data') step(i.delta ?? 0);
    else if (i.kind === 'up' || i.kind === 'down') step((i.kind === 'up' ? 1 : -1) * (i.func ? 10 : 1));
    else return i.kind !== 'no';
    return true;
  },
});
