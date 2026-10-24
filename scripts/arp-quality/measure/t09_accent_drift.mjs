// T09: accent (the arp's note force, 0.3 .. ~1.35) with ACC FILTER 0 / 0.5 / 1, GLUE 0 / 0.35, INIT patch.
// T10: DRIFT, a 20 s held note of OSC 1 alone and OSC 2 alone (sine, filter open), drift 1 (knob 0.5) and 2 (max);
// and 200 short notes for the per-note pitch scatter.
import path from 'node:path';
import { render, LAB, DEF, OUT, writeNpy, writeJson, hzMidi } from './lib.mjs';

const dir = path.join(OUT, 'accent');
const man = { acc: [], drift: [], scatter: [] };
const ACC = [0.4, 0.6, 0.8, 0.92, 1.0, 1.12, 1.24, 1.35];
const step = 60 / 130 / 4;
for (const accFlt of [0, 0.5, 1]) {
  for (const glue of [0, 0.35]) {
    // 4 rounds of the 8 accents, A3, 1/16 notes, gate 50 %
    const notes = [];
    for (let k = 0; k < 32; k += 1) notes.push({ midi: 57, time: 0.05 + k * step, gate: 0.5 * step, accent: ACC[k % 8], from: null });
    const r = render({ params: { ...DEF, accFlt, glue, drift: 0, width: 0, outLevel: 0, phase: 0 }, notes, seconds: 0.05 + 32 * step + 0.3, seed: 3 });
    const name = `acc_f${accFlt}_g${glue}.npy`;
    writeNpy(path.join(dir, name), r.L);
    man.acc.push({ file: `accent/${name}`, accFlt, glue, notes });
  }
}
// DRIFT: one long note; OSC 1 and OSC 2 rendered separately (same seed: the same voice calibration)
for (const drift of [1, 2]) {
  for (const which of [1, 2]) {
    const p = { ...LAB, drift, wave1: 0, wave2: 0, tune2: 0, osc1: which === 1 ? 0.05 : 0, osc2: which === 2 ? 0.05 : 0 };
    const r = render({ params: p, notes: [{ midi: 69, time: 0, gate: 30, accent: 1, from: null }], seconds: 20, seed: 11 });
    const name = `drift_d${drift}_osc${which}.npy`;
    writeNpy(path.join(dir, name), r.L);
    man.drift.push({ file: `accent/${name}`, drift, osc: which });
  }
}
// per-note scatter: 200 notes of 0.25 s, OSC 1 sine A4, drift 1, 12 voices (each voice its calibration)
const notes = [];
for (let k = 0; k < 200; k += 1) notes.push({ midi: 69, time: 0.05 + k * 0.3, gate: 0.25, accent: 1, from: null });
const r = render({ params: { ...LAB, drift: 1, wave1: 0, osc1: 0.05, aR: 0.005 }, notes, seconds: 0.05 + 200 * 0.3 + 0.2, seed: 5 });
writeNpy(path.join(dir, 'scatter.npy'), r.L);
man.scatter.push({ file: 'accent/scatter.npy', notes });
writeJson(path.join(dir, 'manifest.json'), man);
console.log('ok');
