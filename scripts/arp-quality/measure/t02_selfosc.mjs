// T02: self-oscillation.
// A) threshold: a 1e-6 impulse at the ladder input (inject variant) at 0.3 s, then the envelope's growth rate in the
//    linear regime, RES 0.85 .. 0.95, cutoff 100 / 1000 / 5000 / 10000, x4 and x2 (MOOG mode).
// B) steady state, unmodified engine: no oscillator, a tiny NOISE seed (knob 0.003, like analog noise), RES 0.9 ..
//    1.0, cutoff 55 Hz .. 16 kHz: its frequency, level, harmonics, build-up time (ana_selfosc.py), MOOG and LP12.
import path from 'node:path';
import { render, LAB, OUT, writeNpy, writeJson } from './lib.mjs';

const dir = path.join(OUT, 'selfosc');
const man = { thr: [], ss: [] };
const RESA = [];
for (let r = 0.85; r <= 0.9501; r += 0.005) RESA.push(Math.round(r * 1000) / 1000);
for (const os of [4, 2]) {
  for (const cutoff of [100, 1000, 5000, 10000]) {
    for (const res of RESA) {
      let frame = 0;
      const at = 14400 * os;
      globalThis.__inj = (v, i2) => (frame * os + i2 === at ? 1e-6 * os : 0);
      const r = render({ variant: 'inject', os, params: { ...LAB, cutoff, res }, notes: [{ midi: 54, time: 0, gate: 10, accent: 1, from: null }], seconds: 1.3, onBlock: (f) => { frame = f; } });
      globalThis.__inj = null;
      const name = `thr_f${cutoff}_r${res}_os${os}.npy`;
      writeNpy(path.join(dir, name), r.L);
      man.thr.push({ file: `selfosc/${name}`, cutoff, res, os, at: 14400 });
    }
  }
}
const CUTS = [55, 110, 250, 500, 1000, 2000, 4000, 8000, 12000, 16000];
for (const os of [4, 2]) {
  for (const fmode of [0, 1]) {
    for (const res of [0.9, 0.92, 0.95, 0.97, 1.0]) {
      for (const cutoff of CUTS) {
        if (fmode === 1 && os === 2) continue;
        const r = render({ os, params: { ...LAB, noise: 0.003, cutoff, res, fmode }, notes: [{ midi: 54, time: 0, gate: 10, accent: 1, from: null }], seconds: 2.5 });
        const name = `ss_m${fmode}_f${cutoff}_r${res}_os${os}.npy`;
        writeNpy(path.join(dir, name), r.L);
        man.ss.push({ file: `selfosc/${name}`, cutoff, res, os, fmode });
      }
    }
  }
}
writeJson(path.join(dir, 'manifest.json'), man);
console.log(man.thr.length, man.ss.length);
