// T07b: hard-sync aliasing against the slave ratio (OSC 2 saw synced to OSC 1, OSC 1 muted), C7, x4 and x2, level 0.1
// (linear) through the near-transparent HP 20 Hz, plus a fine sweep around +19 and +24 semitones (ratios near 3 and 4).
import path from 'node:path';
import { render, LAB, OUT, writeNpy, writeJson, midiHz } from './lib.mjs';

const dir = path.join(OUT, 'alias_sync');
const man = { cases: [] };
const one = (os, semi, fine, wave2) => {
  const p = { ...LAB, fmode: 3, cutoff: 20, osc1: 0, osc2: 0.1, wave1: 2, wave2, tune2: semi, fine2: fine, sync: 1 };
  const r = render({ os, params: p, notes: [{ midi: 96, time: 0, gate: 10, accent: 1, from: null }], seconds: 1.6 });
  const name = `s_${wave2}_${semi}_${fine}_os${os}.npy`;
  writeNpy(path.join(dir, name), r.L);
  man.cases.push({ file: `alias_sync/${name}`, os, semi, fine, wave2, bases: [midiHz(96)], ratio: Math.pow(2, (semi + fine / 100) / 12) });
};
for (const os of [4, 2]) {
  for (let s = 0; s <= 31; s += 1) one(os, s, 0, 2);
  for (let f = -50; f <= 50; f += 5) {
    one(os, 19, f, 2);
    one(os, 24, f, 2);
  }
  for (const s of [7, 12, 19, 24]) one(os, s, 0, 3);
}
writeJson(path.join(dir, 'manifest.json'), man);
console.log(man.cases.length);
