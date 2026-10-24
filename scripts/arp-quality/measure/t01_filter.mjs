// T01: filter magnitude responses, MOOG / LP12 / BP / HP, cutoff 100 Hz, 1 kHz, 5 kHz, RES 0..1.
// A) impulse at the filter input (inject variant: the ladder, MODE mix, VCA, voice tanh, DC blocker and decimators
//    are the real code), amplitude 1e-4 (linear regime), x4 and x2.
// B) stepped sines through the unmodified engine: 48 log-spaced frequencies, 12 voices per render (one sine each,
//    each voice its own filter), OSC 1 sine at 0.01, then a joint least-squares fit per tone (ana_filter.py).
import path from 'node:path';
import { render, LAB, OUT, writeNpy, writeJson, hzMidi } from './lib.mjs';

const dir = path.join(OUT, 'filter');
const MODES = [0, 1, 2, 3];
const CUTS = [100, 1000, 5000];
const RES = [0, 0.3, 0.6, 0.8, 0.9, 1.0];
const manifest = { imp: [], tones: [] };

// A) impulses
const IMP_AT = 14400; // context sample of the impulse (0.3 s: after the attack AND after the 15 ms MODE fade from the constructor's MOOG)
for (const os of [4, 2]) {
  for (const fmode of MODES) {
    for (const cutoff of CUTS) {
      for (const res of RES) {
        let frame = 0;
        const at = IMP_AT * os;
        globalThis.__inj = (v, i2) => (frame * os + i2 === at ? 1e-4 * os : 0);
        const r = render({
          variant: 'inject',
          os,
          params: { ...LAB, fmode, cutoff, res },
          notes: [{ midi: 54, time: 0, gate: 10, accent: 1, from: null }],
          seconds: 2.3,
          onBlock: (f) => {
            frame = f;
          },
        });
        globalThis.__inj = null;
        const name = `imp_m${fmode}_f${cutoff}_r${res}_os${os}.npy`;
        writeNpy(path.join(dir, name), r.L);
        manifest.imp.push({ file: `filter/${name}`, fmode, cutoff, res, os, at: IMP_AT, amp: 1e-4 });
      }
    }
  }
}

// B) stepped sines (plain engine), x4 (and x2 for 5 kHz)
if (!process.argv.includes('--imp-only')) {
const NF = 48;
const freqs = Array.from({ length: NF }, (_, i) => 20 * Math.pow(1000, i / (NF - 1)));
for (const os of [4, 2]) {
  for (const fmode of MODES) {
    for (const cutoff of CUTS) {
      if (os === 2 && cutoff !== 5000) continue;
      for (const res of RES) {
        for (let g = 0; g < NF / 12; g += 1) {
          // interleave so a render holds frequencies spread over the range
          const fs = freqs.filter((_, i) => i % (NF / 12) === g);
          const r = render({
            os,
            params: { ...LAB, osc1: 0.01, fmode, cutoff, res },
            notes: fs.map((f) => ({ midi: hzMidi(f), time: 0, gate: 10, accent: 1, from: null })),
            seconds: 1.2,
          });
          const name = `tones_m${fmode}_f${cutoff}_r${res}_os${os}_g${g}.npy`;
          writeNpy(path.join(dir, name), r.L);
          manifest.tones.push({ file: `filter/${name}`, fmode, cutoff, res, os, freqs: fs, amp: 0.01 });
        }
      }
    }
  }
}
}
if (process.argv.includes('--imp-only')) {
  const old = JSON.parse((await import('node:fs')).readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  manifest.tones = old.tones;
}
writeJson(path.join(dir, 'manifest.json'), manifest);
console.log(`impulses ${manifest.imp.length}, tone renders ${manifest.tones.length}`);
