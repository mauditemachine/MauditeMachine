// T07: aliasing through the full engine output (48 kHz), notes C6, C7, C8, every wave and the hard cases, x4 and x2.
// Drift 0 so every partial is known. Two filters: MOOG at its clamp (21.6 kHz, the brightest a patch gets) and a
// near-transparent HP at 20 Hz (the oscillators almost raw). Level 0.62 (the default OSC level: the voice tanh works)
// and 0.1 (almost linear).
import path from 'node:path';
import { render, LAB, OUT, writeNpy, writeJson, midiHz } from './lib.mjs';

const dir = path.join(OUT, 'alias');
const man = { cases: [] };
const CASES = {
  SINE: { wave1: 0 },
  TRI: { wave1: 1 },
  SAW: { wave1: 2 },
  SQUARE: { wave1: 3 },
  PULSE: { wave1: 4 },
  PWM50: { wave1: 3.5 },
  'SAW>SQR': { wave1: 2.5 },
  FMWAVE: { wave1: 5, tune2: 0 },
  SYNC7: { wave1: 2, osc2: 'L', wave2: 2, tune2: 7, sync: 1 },
  SYNC19: { wave1: 2, osc2: 'L', wave2: 2, tune2: 19, sync: 1 },
  FM06R2: { wave1: 2, fm: 0.6, ratio: 2 },
  FM1R35: { wave1: 0, fm: 1, ratio: 3.5 },
  STACK: { wave1: 2, stack: 16.5 },
  OD06: { wave1: 2, drive: 0.6 },
  RES08: { wave1: 2, res: 0.8, cutoff: 5000 },
  GLUE1: { wave1: 2, glue: 1 },
  SUBSQR: { wave1: 2, sub: 0.5, subWave: 3, subOct: 1 },
};
for (const os of [4, 2]) {
  for (const [filter, fp] of [['moog', { fmode: 0, cutoff: 21600 }], ['raw', { fmode: 3, cutoff: 20 }]]) {
    for (const lvl of [0.62, 0.1]) {
      if (filter === 'raw' && lvl === 0.62) continue;
      for (const [cname, cp] of Object.entries(CASES)) {
        if (lvl === 0.1 && ['OD06', 'GLUE1', 'RES08'].includes(cname)) continue;
        for (const midi of [84, 96, 108]) {
          const p = { ...LAB, ...fp, osc1: lvl, ...cp };
          if (p.osc2 === 'L') p.osc2 = lvl;
          if (cname === 'RES08') Object.assign(p, { fmode: 0, cutoff: 5000 });
          const r = render({ os, params: p, notes: [{ midi, time: 0, gate: 10, accent: 1, from: null }], seconds: 1.6, maxStack: os === 4 ? 3 : 2 });
          const name = `${filter}_${lvl}_${cname}_${midi}_os${os}.npy`;
          writeNpy(path.join(dir, name), r.L);
          const f0 = midiHz(midi);
          let bases = [f0];
          if (cname === 'FM1R35') bases = [f0 / 2];
          if (cname === 'SUBSQR') bases = [f0 / 2];
          if (cname === 'STACK') {
            const st = 16.5;
            bases = (os === 4 ? [-1, 0, 1] : [-0.7, 0.7]).map((o) => f0 * Math.pow(2, (o * st) / 1200));
          }
          man.cases.push({ file: `alias/${name}`, filter, level: lvl, case: cname, midi, os, bases });
        }
      }
    }
  }
}
writeJson(path.join(dir, 'manifest.json'), man);
console.log(man.cases.length);
