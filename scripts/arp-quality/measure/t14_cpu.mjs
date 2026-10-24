// T14: CPU. Held notes (gate 100 s), per-block wall time (hrtime) after a JIT warm-up, desktop path (x4, 12 voices,
// STACK 3, WIDE 8) and phone path (x2, 8 voices, STACK 2, WIDE 4). Budget at 48 kHz: 2667 us per 128-sample block.
import path from 'node:path';
import os from 'node:os';
import { render, DEF, OUT, writeJson } from './lib.mjs';

const CFG = {
  INIT: {},
  'GLUE 0': { glue: 0 },
  'SYNC+FM': { sync: 1, tune2: 7, fm: 0.5 },
  'OD 0.5': { drive: 0.5 },
  'STACK 16ct': { stack: 16.5 },
  'WIDE 0.6': { wide: 0.6 },
  'GLUE 1': { glue: 1 },
  'ALL': { stack: 30, wide: 1, glue: 1, sync: 1, tune2: 7, fm: 0.5, drive: 0.5, sub: 0.3, noise: 0.1 },
};
const PATHS = { desktop: { os: 4, maxVoices: 12, maxStack: 3, wideVoices: 8 }, phone: { os: 2, maxVoices: 8, maxStack: 2, wideVoices: 4 } };
const q = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const run = (pth, cfg, nv) => {
  const P = PATHS[pth];
  const notes = Array.from({ length: nv }, (_, i) => ({ midi: 42 + i * 3, time: 0, gate: 100, accent: 1, from: null }));
  const r = render({ ...P, params: { ...DEF, ...CFG[cfg], aS: 1, outLevel: 0.3 }, notes, seconds: 1.5, timing: true });
  const b = Array.from(r.blockUs).slice(40);
  return { median: q(b, 0.5), p99: q(b, 0.99), max: Math.max(...b) };
};
// warm-up
for (let k = 0; k < 3; k += 1) run('desktop', 'ALL', 12), run('phone', 'ALL', 8);
const res = { machine: { cpus: os.cpus()[0].model, n: os.cpus().length, node: process.version }, rows: [] };
for (const pth of Object.keys(PATHS)) {
  for (const cfg of Object.keys(CFG)) {
    for (const nv of [1, 4, 8, 12]) {
      if (nv > PATHS[pth].maxVoices) continue;
      // best of 3 (the machine is shared)
      let best = null;
      for (let k = 0; k < 3; k += 1) {
        const m = run(pth, cfg, nv);
        if (!best || m.median < best.median) best = m;
      }
      res.rows.push({ path: pth, cfg, voices: nv, ...best, pct_budget_median: (100 * best.median) / 2666.7 });
      console.log(pth.padEnd(8), cfg.padEnd(11), String(nv).padStart(2), 'voices  median', best.median.toFixed(0).padStart(5), 'us  p99', best.p99.toFixed(0).padStart(5), '  max', best.max.toFixed(0).padStart(5), `  ${((100 * best.median) / 2666.7).toFixed(1)} %`);
    }
  }
}
writeJson(path.join(OUT, 'cpu', 'results.json'), res);
