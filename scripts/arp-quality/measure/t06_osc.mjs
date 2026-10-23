// T06: oscillators as they enter the filter (the inject hook records the oscillator sum `o` of the voice at the
// oversampled rate and passes it on unchanged): shapes, DC, spectrum vs ideal, morph, PWM, SYNC, FM, SUB, NOISE.
import path from 'node:path';
import { render, LAB, OUT, writeNpy, writeJson } from './lib.mjs';

const dir = path.join(OUT, 'osc');
const man = { cases: [] };
const OS = 4;
function rec(name, params, midi, seconds = 0.6, os = OS) {
  const n = Math.ceil((seconds * 48000) / 128) * 128 * os;
  const buf = new Float32Array(n);
  let frame = 0;
  globalThis.__inj = (v, i2, o) => {
    buf[frame * os + i2] = o;
    return o;
  };
  render({ variant: 'inject', os, params: { ...LAB, ...params }, notes: [{ midi, time: 0, gate: 10, accent: 1, from: null }], seconds, onBlock: (f) => { frame = f; } });
  globalThis.__inj = null;
  writeNpy(path.join(dir, `${name}.npy`), buf);
  man.cases.push({ name, file: `osc/${name}.npy`, midi, os, params });
}
const A2 = 45;
const A5 = 81;
// the shapes and the morph between them (OSC 1 alone, level 1 so `o` is the raw shape)
const W = { 'SINE': 0, 'SINE>TRI': 0.5, 'TRI': 1, 'TRI>SAW': 1.5, 'SAW': 2, 'SAW>SQR': 2.5, 'SQUARE': 3, 'PWM 25%': 3.25, 'PWM 50%': 3.5, 'PWM 75%': 3.75, 'PULSE': 4, 'PULSE>FM': 4.5, 'FM': 5 };
for (const [label, w] of Object.entries(W)) {
  rec(`w1_${label.replace(/[^A-Z0-9]+/gi, '_')}_A2`, { osc1: 1, wave1: w }, A2);
  rec(`w1_${label.replace(/[^A-Z0-9]+/gi, '_')}_A5`, { osc1: 1, wave1: w }, A5);
}
// OSC 2 shapes (its own morph: up to PULSE)
for (const [label, w] of Object.entries({ 'SAW': 2, 'SQUARE': 3, 'PULSE': 4 })) rec(`w2_${label}_A2`, { osc2: 1, wave2: w }, A2);
// SYNC: OSC 2 saw / square synced to OSC 1, OSC 1 muted
for (const semi of [7, 12, 19]) {
  rec(`sync_saw_${semi}_A2`, { osc2: 1, wave2: 2, tune2: semi, sync: 1 }, A2);
  rec(`sync_sqr_${semi}_A2`, { osc2: 1, wave2: 3, tune2: semi, sync: 1 }, A2);
}
// FM knob on a sine OSC 1, ratio 1 and 2 (index follows the filter envelope: sustain 1 here, so the full index)
for (const fm of [0.3, 0.6, 1]) for (const ratio of [1, 2, 3.5]) rec(`fm_${fm}_r${ratio}_A2`, { osc1: 1, wave1: 0, fm, ratio }, A2);
// SUB: alone (OSC 1 muted), sine, triangle, square, -1 and -2 octaves
for (const [lab, sw] of [['SINE', 0], ['TRI', 1], ['SQR', 3]]) for (const so of [1, 2]) rec(`sub_${lab}_${so}_A2`, { sub: 1, subWave: sw, subOct: so }, A2);
// NOISE alone
rec('noise', { noise: 1 }, A2, 2.0);
rec('noise_os2', { noise: 1 }, A2, 2.0, 2);
// the default oscillator pair (SAW + SAW 16', FINE -8 / +8 cents), drift 0
rec('default_pair_A2', { osc1: 0.62, osc2: 0.62, wave1: 2, wave2: 2, tune2: -12, fine1: -8, fine2: 8 }, A2, 1.0);
writeJson(path.join(dir, 'manifest.json'), man);
console.log(man.cases.length);
