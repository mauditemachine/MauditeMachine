// T11: silence, denormals, noise floor. Every factory preset (and INIT with STACK/WIDE/GLUE at max, a RES 1.0 patch,
// a long release) plays one bar of notes then 6 s of nothing; each block: output values, the engine's internal numbers
// (every numeric field and typed array reachable from the processor) scanned for subnormals / NaN / Infinity, block
// time. Plus the noise floor of a held sine.
import path from 'node:path';
import { render, LAB, DEF, PRESETS, OUT, writeNpy, writeJson, hzMidi } from './lib.mjs';

const dir = path.join(OUT, 'silence');
const DBL_MIN = 2.2250738585072014e-308;
const FLT_MIN = 1.1754944e-38;
function scan(obj, acc, seen = new Set(), depth = 0) {
  if (obj === null || typeof obj !== 'object' || seen.has(obj) || depth > 5) return;
  seen.add(obj);
  if (ArrayBuffer.isView(obj)) {
    const f32 = obj instanceof Float32Array;
    for (let i = 0; i < obj.length; i += 1) {
      const x = obj[i];
      if (!Number.isFinite(x)) acc.nonFinite += 1;
      else if (x !== 0 && Math.abs(x) < (f32 ? FLT_MIN : DBL_MIN)) acc.sub += 1;
      else if (x !== 0 && Math.abs(x) < 1e-30) acc.tiny += 1;
    }
    return;
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) {
        if (!(k === 'q1' || k === 'q2')) acc.nonFinite += 1; // q1/q2 are NaN on purpose (the FM step guard)
      } else if (v !== 0 && Math.abs(v) < DBL_MIN) acc.sub += 1;
      else if (v !== 0 && Math.abs(v) < 1e-30) {
        acc.tiny += 1;
        if (acc.where.length < 12 && !acc.where.includes(k)) acc.where.push(k);
      }
    } else if (typeof v === 'object') scan(v, acc, seen, depth + 1);
  }
}
const step = 60 / 130 / 4;
const bar = (gate = 0.5) => Array.from({ length: 16 }, (_, k) => ({ midi: 54 + ((k * 7) % 12), time: 0.05 + k * step, gate: gate * step, accent: [1, 0.8, 0.92, 1.12][k % 4], from: null }));
const patches = [
  ...PRESETS.map((p) => ({ name: p.name, params: { ...p.engine, outLevel: 0.25 } })),
  { name: 'INIT', params: { ...DEF, outLevel: 0.25 } },
  { name: 'X STACK WIDE GLUE', params: { ...DEF, stack: 30, wide: 1, glue: 1, outLevel: 0.25 } },
  { name: 'X RES1 LONG REL', params: { ...DEF, res: 1, aR: 3, fR: 3, outLevel: 0.25 } },
  { name: 'X OD1 SYNC FM', params: { ...DEF, drive: 1, sync: 1, tune2: 7, fm: 0.6, outLevel: 0.25 } },
];
const res = [];
for (const os of [4, 2]) {
  for (const pt of patches) {
    const acc = { nonFinite: 0, sub: 0, tiny: 0, where: [] };
    let outSub = 0;
    let outNF = 0;
    let lastNonZero = 0;
    let lastActive = 0;
    const tailUs = [];
    const idleUs = [];
    const r = render({
      os,
      maxVoices: os === 4 ? 12 : 8,
      maxStack: os === 4 ? 3 : 2,
      wideVoices: os === 4 ? 8 : 4,
      params: pt.params,
      notes: bar(),
      seconds: 0.05 + 16 * step + 6,
      timing: true,
      onBlock: (f, proc) => {
        if (f % 1280 === 0) scan(proc, acc);
        if (proc.voices.some((v) => v.on)) lastActive = f;
      },
    });
    for (let i = 0; i < r.L.length; i += 1) {
      const x = r.L[i];
      const y = r.R[i];
      if (!Number.isFinite(x) || !Number.isFinite(y)) outNF += 1;
      if ((x !== 0 && Math.abs(x) < FLT_MIN) || (y !== 0 && Math.abs(y) < FLT_MIN)) outSub += 1;
      if (x !== 0 || y !== 0) lastNonZero = i;
    }
    const tEnd = 0.05 + 16 * step;
    for (let b = 0; b < r.blockUs.length; b += 1) {
      const t = (b * 128) / 48000;
      if (t > tEnd && b * 128 <= lastNonZero) tailUs.push(r.blockUs[b]);
      if (b * 128 > lastNonZero + 128) idleUs.push(r.blockUs[b]);
    }
    const med = (a) => (a.length ? [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)] : null);
    res.push({ os, name: pt.name, internalNonFinite: acc.nonFinite, internalSubnormal: acc.sub, internalTiny: acc.tiny, tinyFields: acc.where, outNonFinite: outNF, outSubnormal: outSub, lastVoiceOn_s: lastActive / 48000 - tEnd, lastNonZero_s: lastNonZero / 48000 - tEnd, tailBlockUs_median: med(tailUs), idleBlockUs_median: med(idleUs) });
    console.log(JSON.stringify(res[res.length - 1]));
  }
}
// noise floor of a held sine (1 kHz, -6 dBFS out), and of a held default saw note
const a = render({ params: { ...LAB, osc1: 0.4, wave1: 0, cutoff: 21600 }, notes: [{ midi: hzMidi(1000), time: 0, gate: 10, accent: 1, from: null }], seconds: 3 });
writeNpy(path.join(dir, 'floor_sine.npy'), a.L);
writeJson(path.join(dir, 'results.json'), res);
