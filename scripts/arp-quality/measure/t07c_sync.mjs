// T07c: hard sync, more ratios: square at non-special ratios, OSC 2 below OSC 1 (16', the default), default FINE.
import path from 'node:path';
import { render, LAB, OUT, writeNpy, writeJson, midiHz } from './lib.mjs';
const dir = path.join(OUT, 'alias_sync2');
const man = { cases: [] };
const one = (tag, os, p) => {
  const r = render({ os, params: { ...LAB, fmode: 3, cutoff: 20, osc1: 0, osc2: 0.1, wave1: 2, sync: 1, ...p }, notes: [{ midi: 96, time: 0, gate: 10, accent: 1, from: null }], seconds: 1.6 });
  const name = `${tag}_os${os}.npy`;
  writeNpy(path.join(dir, name), r.L);
  man.cases.push({ file: `alias_sync2/${name}`, tag, os, bases: [midiHz(96 + (p.fine1 || 0) / 100)] });
};
for (const os of [4, 2]) {
  for (const s of [4, 9, 16]) one(`sqr_${s}`, os, { wave2: 3, tune2: s });
  for (const s of [4, 9, 16]) one(`pulse_${s}`, os, { wave2: 4, tune2: s });
  for (const s of [-12, -24, -5]) one(`saw_${s}`, os, { wave2: 2, tune2: s });
  for (const s of [0, 12, 24]) one(`saw_${s}_fine8`, os, { wave2: 2, tune2: s, fine1: -8, fine2: 8 });
}
writeJson(path.join(dir, 'manifest.json'), man);
