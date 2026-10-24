// T15: the Juno chorus of the chain (src/v4/audio/chorus.worklet.js 'mm-chorus', kind 'juno'), in Node: a sine through
// the wet path (both BBD readings), mode I and II; the noise floor the 512-phase sinc table (phase rounded) adds.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { OUT, ROOT, writeNpy, writeJson } from './lib.mjs';
const file = process.env.CHORUS_WORKLET || path.join(ROOT, 'src/v4/audio/chorus.worklet.js');
const src = readFileSync(file, 'utf8');
const reg = {};
globalThis.sampleRate = 48000;
const Base = class { constructor() { this.port = { postMessage() {}, onmessage: null }; } };
new Function('AudioWorkletProcessor', 'registerProcessor', src)(Base, (n, c) => { reg[n] = c; });
const JUNO = { rates: [0.513, 0.863], delay: { min: 0.00166, max: 0.00535 }, filterDelay: 0.000106, biquads: [[9688, 0.549], [10378, 1.291], [9688, 0.549], [10378, 1.291]], pole: 7234 };
const man = { cases: [] };
for (const mode of [1, 2]) {
  for (const f of [440, 1000, 3000, 6000, 10000, 15000]) {
    const proc = new reg['mm-chorus']({ processorOptions: { kind: 'juno', dmin: JUNO.delay.min - JUNO.filterDelay, dmax: JUNO.delay.max - JUNO.filterDelay, biquads: JUNO.biquads, pole: JUNO.pole, rate: JUNO.rates[mode - 1] } });
    const n = 48000 * 4;
    const L = new Float32Array(n), R = new Float32Array(n), X = new Float32Array(n);
    const inp = new Float32Array(128), oL = new Float32Array(128), oR = new Float32Array(128);
    for (let b = 0; b < n; b += 128) {
      for (let i = 0; i < 128; i += 1) inp[i] = 0.5 * Math.sin((2 * Math.PI * f * (b + i)) / 48000);
      proc.process([[inp, inp]], [[oL, oR]]);
      L.set(oL, b); R.set(oR, b); X.set(inp, b);
    }
    const name = `juno_m${mode}_${f}.npy`;
    writeNpy(path.join(OUT, 'chorus', name), [L, R]);
    man.cases.push({ file: `chorus/${name}`, mode, f });
  }
}
writeJson(path.join(OUT, 'chorus', 'manifest.json'), man);
