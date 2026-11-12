/**
 * MOD simplifie (le plugin, 2026-11-12, Mika : "MOD est vraiment trop complexe") : la vitesse d'un LFO en un seul potard,
 * RATE, en valeurs musicales (8 BARS ... 1/4 ... 1/32, et les triolets). Un cycle dure 128 / (SPD x MULT) pas
 * (audio/lfo.ts lfoCycle) : chaque valeur pose SPD et MULT qui le donnent exactement. Les reglages fins (MULT, FADE, PHAS,
 * MODE) gardent ce qu'ils avaient ; seuls DEST, RATE, DEPTH et WAVE se voient.
 */

import { LFO_MULTS, lfoCycle, type LfoParam } from '../audio/lfo';
import { lfoOf, voiceFx } from '../audio/voicefx';
import { pattern } from '../audio/pattern';
import { resume } from '../audio/drums';
import { tracks, TRACK_NAMES, trackIndex } from '../audio/tracks';
import { lcdMessage } from '../state/lcdMessage';
import { activeTrack } from '../state/trk';
import { DT2_FACE, LCD_NO_VOICE, POT_UI } from '../theme';
import { registerDialSpec } from '../scene/screen/menus/registry';

/** Les vitesses, de la plus lente a la plus rapide : le nom, SPD, MULT (son rang dans LFO_MULTS). */
export const LFO_RATES: readonly { label: string; spd: number; mul: number }[] = [
  { label: '8 BARS', spd: 1, mul: 0 },
  { label: '4 BARS', spd: 2, mul: 0 },
  { label: '2 BARS', spd: 4, mul: 0 },
  { label: '1 BAR', spd: 8, mul: 0 },
  { label: '1/2', spd: 16, mul: 0 },
  { label: '1/4', spd: 32, mul: 0 },
  { label: '1/4T', spd: 48, mul: 0 },
  { label: '1/8', spd: 32, mul: 1 },
  { label: '1/8T', spd: 48, mul: 1 },
  { label: '1/16', spd: 32, mul: 2 },
  { label: '1/16T', spd: 48, mul: 2 },
  { label: '1/32', spd: 32, mul: 3 },
];
/** Le depart : 1/4 (SPD 32, MULT 1, celui des LFO d'avant). */
const RATE_DEF = 5;

/** La piste dont on regle le LFO : la voix choisie (1 a 8) ou la piste active ; null : aucune. */
function where(): { inst: ReturnType<typeof pattern.get>['instrument']; tk: ReturnType<typeof activeTrack.get> } | null {
  const inst = pattern.get().instrument;
  const tk = inst ?? (DT2_FACE ? activeTrack.get() : null);
  return tk ? { inst, tk } : null;
}

const lfoNow = (p: LfoParam): number => {
  const w = where();
  if (!w) return p.endsWith('spd') ? 32 : 0;
  return w.inst ? lfoOf(voiceFx.of(w.inst), p) : tracks.param(w.tk as NonNullable<typeof w.tk>, p);
};

/** La vitesse la plus proche du cycle d'aujourd'hui (en octaves). */
function rateIndex(n: 1 | 2): number {
  const spd = Math.abs(lfoNow(`l${n}spd` as LfoParam));
  const mul = LFO_MULTS[Math.max(0, Math.min(LFO_MULTS.length - 1, lfoNow(`l${n}mul` as LfoParam)))];
  if (spd === 0) return 0;
  const c = lfoCycle({ spd, mult: mul });
  let best = RATE_DEF;
  let d = Infinity;
  LFO_RATES.forEach((r, i) => {
    const e = Math.abs(Math.log2(lfoCycle({ spd: r.spd, mult: LFO_MULTS[r.mul] }) / c));
    if (e < d - 1e-9) {
      d = e;
      best = i;
    }
  });
  return best;
}

function rateSet(n: 1 | 2, v: number): void {
  resume();
  const w = where();
  if (!w) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const r = LFO_RATES[Math.max(0, Math.min(LFO_RATES.length - 1, Math.round(v)))];
  const spd = `l${n}spd` as LfoParam;
  const mul = `l${n}mul` as LfoParam;
  if (w.inst) {
    voiceFx.setLfo(w.inst, spd, r.spd);
    voiceFx.setLfo(w.inst, mul, r.mul);
  } else if (w.tk) tracks.setMany(w.tk, { [spd]: r.spd, [mul]: r.mul });
  const name = w.tk ? (TRACK_NAMES[trackIndex(w.tk)] ?? w.tk) : '';
  lcdMessage.show(`${name} LFO${n} RATE ${r.label}`, POT_UI.readoutMs, true);
}

for (const n of [1, 2] as const) {
  registerDialSpec(`z:l${n}rate`, {
    value: () => rateIndex(n),
    set: (v) => rateSet(n, v),
    range: () => [0, LFO_RATES.length - 1],
    steps: () => LFO_RATES.length,
    text: (v) => LFO_RATES[Math.max(0, Math.min(LFO_RATES.length - 1, Math.round(v)))].label,
    unit: (v) => (Math.round(v) <= 3 ? 'SLOW' : Math.round(v) >= 9 ? 'FAST' : 'PER CYCLE'),
    reset: () => RATE_DEF,
    live: () => where() !== null,
  });
}
