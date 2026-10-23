// Allocation sampling (garbage included) during a held INIT note, via the inspector protocol.
import { Session } from 'node:inspector/promises';
import { render, DEF, LAB } from './lib.mjs';
const glue = Number(process.argv[2] ?? 0.35);
const session = new Session();
session.connect();
// warm-up (JIT)
render({ params: { ...DEF, glue, outLevel: 0.3 }, notes: [{ midi: 54, time: 0.05, gate: 100, accent: 1, from: null }], seconds: 5 });
await session.post('HeapProfiler.enable');
await session.post('HeapProfiler.startSampling', { samplingInterval: 1024, includeObjectsCollectedByMinorGC: true, includeObjectsCollectedByMajorGC: true });
const seconds = 10;
render({ params: { ...DEF, glue, outLevel: 0.3 }, notes: [{ midi: 54, time: 0.05, gate: 100, accent: 1, from: null }], seconds });
const { profile } = await session.post('HeapProfiler.stopSampling');
const agg = {};
let tot = 0;
(function walk(n) {
  const name = `${n.callFrame.functionName || '(anon)'} ${(n.callFrame.url || '').split('/').pop()}:${n.callFrame.lineNumber + 1}`;
  agg[name] = (agg[name] || 0) + n.selfSize;
  tot += n.selfSize;
  for (const c of n.children || []) walk(c);
})(profile.head);
const blocks = (seconds * 48000) / 128;
console.log(`GLUE ${glue}: ~${(tot / blocks / 1024).toFixed(1)} KB allocated per block (sampled)`);
for (const [k, v] of Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(String((v / blocks).toFixed(0)).padStart(8), 'B/block', k);
