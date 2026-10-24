// T16: resonance at high cutoffs, x4 vs x2 (the phone): steady self-oscillation (NOISE seed) and a resonant saw,
// cutoff 8 kHz .. 21.6 kHz (the clamp), RES 0.8 .. 1.0
import path from 'node:path';
import { render, LAB, OUT, writeNpy, writeJson } from './lib.mjs';
const man = { cases: [] };
for (const os of [4, 2]) for (const res of [0.8, 0.9, 0.95, 1]) for (const cutoff of [8000, 10000, 12000, 14000, 16000, 18000, 21600]) {
  for (const src of ['seed', 'saw']) {
    const p = src === 'seed' ? { ...LAB, noise: 0.003, res, cutoff } : { ...LAB, osc1: 0.3, wave1: 2, res, cutoff };
    const r = render({ os, params: p, notes: [{ midi: 45, time: 0, gate: 10, accent: 1, from: null }], seconds: 1.2 });
    const name = `${src}_os${os}_r${res}_f${cutoff}.npy`;
    writeNpy(path.join(OUT, 'hires', name), r.L);
    man.cases.push({ file: `hires/${name}`, os, res, cutoff, src });
  }
}
writeJson(path.join(OUT, 'hires', 'manifest.json'), man);
