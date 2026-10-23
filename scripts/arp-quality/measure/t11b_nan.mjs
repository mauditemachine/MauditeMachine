import { render, DEF, PRESETS } from './lib.mjs';
function find(obj, path, out, seen = new Set(), depth = 0) {
  if (obj === null || typeof obj !== 'object' || seen.has(obj) || depth > 5) return;
  seen.add(obj);
  if (ArrayBuffer.isView(obj)) return;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'number' && !Number.isFinite(v) && k !== 'q1' && k !== 'q2') out.add(`${path}.${k}=${v}`);
    else if (typeof v === 'object') find(v, `${path}.${k}`, out, seen, depth + 1);
  }
}
const out = new Set();
let firstSub = null;
const ed = PRESETS.find((p) => p.name === 'EBM').engine;
render({ params: { ...ed, outLevel: 0.25 }, notes: [{ midi: 54, time: 0.01, gate: 0.05, accent: 1, from: null }], seconds: 1.5, onBlock: (f, proc) => {
  find(proc, 'proc', out);
  const od = proc.od;
  if (firstSub === null && Object.values(od).some((x) => x !== 0 && Math.abs(x) < 2.2250738585072014e-308)) firstSub = { t: f / 48000, od: { ...od }, voicesOn: proc.voices.filter((v) => v.on).length, dc: [...proc.dc] };
} });
console.log([...out]);
console.log('first subnormal in the OVERDRIVE states:', JSON.stringify(firstSub));
