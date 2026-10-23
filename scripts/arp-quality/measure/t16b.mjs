import path from 'node:path';
import { render, LAB, DEF, OUT, writeNpy, writeJson } from './lib.mjs';
const man = { cases: [] };
for (const os of [4, 2]) {
  for (const res of [0.84, 0.86, 0.88, 0.89, 0.9]) for (const cutoff of [12000, 16000, 21600]) {
    const r = render({ os, params: { ...LAB, osc1: 0.3, wave1: 2, res, cutoff }, notes: [{ midi: 45, time: 0, gate: 10, accent: 1, from: null }], seconds: 1.0 });
    const name = `thr_os${os}_r${res}_f${cutoff}.npy`;
    writeNpy(path.join(OUT, 'hires', name), r.L);
    man.cases.push({ file: `hires/${name}`, os, res, cutoff, kind: 'thr' });
  }
  // realistic: INIT patch, RES 0.92 and 1.0, a C6 1/16 arp note (the envelope opens the filter 3 octaves, key track 0.5)
  for (const res of [0.8, 0.92, 1.0]) for (const midi of [72, 84]) {
    const step = 60 / 130 / 4;
    const notes = Array.from({ length: 8 }, (_, k) => ({ midi, time: 0.02 + k * step, gate: 0.5 * step, accent: 1, from: null }));
    const r = render({ os, maxVoices: os === 4 ? 12 : 8, params: { ...DEF, res, outLevel: 0.3 }, notes, seconds: 0.02 + 8 * step + 0.2 });
    const name = `real_os${os}_r${res}_m${midi}.npy`;
    writeNpy(path.join(OUT, 'hires', name), r.L);
    man.cases.push({ file: `hires/${name}`, os, res, midi, kind: 'real' });
  }
}
writeJson(path.join(OUT, 'hires', 'manifest2.json'), man);
