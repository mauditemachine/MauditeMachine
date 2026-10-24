// T03: pitch accuracy and level across the keyboard; T04: key tracking (the cutoff each voice computes).
import path from 'node:path';
import { render, LAB, DEF, OUT, writeNpy, writeJson, midiHz } from './lib.mjs';

const dir = path.join(OUT, 'pitch');
const man = { notes: [], def: [], track: [] };
// A) every note C0..G9 (+ a few beyond with RANGE 2' and SEMI +7), sine and saw, filter open, x4 and x2
for (const os of [4, 2]) {
  for (const [wname, wave] of [['sine', 0], ['saw', 2]]) {
    for (let m = 12; m <= 127; m += 1) {
      const r = render({ os, params: { ...LAB, wave1: wave, osc1: 0.05 }, notes: [{ midi: m, time: 0, gate: 10, accent: 1, from: null }], seconds: 0.8 });
      const name = `n_${wname}_m${m}_os${os}.npy`;
      writeNpy(path.join(dir, name), r.L);
      man.notes.push({ file: `pitch/${name}`, wave: wname, midi: m, os, f: midiHz(m) });
    }
    // RANGE 2' + SEMI +7 above C8: fundamentals beyond 24 kHz must vanish, not fold
    for (const m of [100, 104, 108, 112, 116, 120]) {
      const r = render({ os, params: { ...LAB, wave1: wave, osc1: 0.05, tune1: 31 }, notes: [{ midi: m, time: 0, gate: 10, accent: 1, from: null }], seconds: 0.8 });
      const name = `hi_${wname}_m${m}_os${os}.npy`;
      writeNpy(path.join(dir, name), r.L);
      man.notes.push({ file: `pitch/${name}`, wave: wname, midi: m + 31, os, f: midiHz(m + 31), beyond: true });
    }
  }
}
// B) the default patch (INIT), one note at a time across the keyboard: peak and RMS of a 1/16 note at 130 BPM
for (let m = 24; m <= 108; m += 2) {
  const r = render({ os: 4, params: { ...DEF, outLevel: 0 }, notes: [{ midi: m, time: 0.01, gate: 0.0577, accent: 1, from: null }], seconds: 0.6, seed: 7 });
  const name = `def_m${m}.npy`;
  writeNpy(path.join(dir, name), r.L);
  man.def.push({ file: `pitch/${name}`, midi: m });
}
// C) key tracking: the cutoff the engine computes for each note (v.g = tan(pi fc / sr2)), drift 0 then drift 1
for (const drift of [0, 1]) {
  for (const kt of [0, 0.25, 0.5, 0.75, 1]) {
    const row = { drift, kt, notes: [], fc: [] };
    for (let m = 12; m <= 120; m += 4) {
      let fc = null;
      render({
        os: 4,
        params: { ...LAB, keyTrack: kt, cutoff: 1000, drift, osc1: 0.01 },
        notes: [{ midi: m, time: 0, gate: 10, accent: 1, from: null }],
        seconds: 0.03,
        seed: 100 + m,
        onBlock: (f, proc) => {
          const v = proc.voices.find((x) => x.on);
          if (v && f >= 1024) fc = (Math.atan(v.g) * proc.sr2) / Math.PI;
        },
      });
      row.notes.push(m);
      row.fc.push(fc);
    }
    man.track.push(row);
  }
}
writeJson(path.join(dir, 'manifest.json'), man);
console.log(man.notes.length, man.def.length, man.track.length);
