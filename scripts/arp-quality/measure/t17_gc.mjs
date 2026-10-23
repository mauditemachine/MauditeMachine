// T17: does the engine allocate while it plays? 60 s of the INIT patch arpeggiating 1/16 notes (4 rounds of 16 per bar),
// heap used before/after and the GC events (node --trace-gc), only the render loop (the notes are queued at start).
import { render, DEF } from './lib.mjs';
const step = 60 / 130 / 4;
const notes = [];
for (let k = 0; k < Math.floor(60 / step); k += 1) notes.push({ midi: 54 + ((k * 5) % 12), time: 0.05 + k * step, gate: 0.5 * step, accent: [1, 0.8, 0.92, 1.12][k % 4], from: null });
globalThis.gc && globalThis.gc();
const h0 = process.memoryUsage().heapUsed;
const r = render({ params: { ...DEF, outLevel: 0.3 }, notes, seconds: 60, timing: true });
const h1 = process.memoryUsage().heapUsed;
const b = Array.from(r.blockUs).slice(100).sort((x, y) => x - y);
console.log('heap delta MB', ((h1 - h0) / 1e6).toFixed(1), 'blocks', b.length, 'median us', b[b.length >> 1].toFixed(0), 'p99.9', b[Math.floor(b.length * 0.999)].toFixed(0), 'max', b[b.length - 1].toFixed(0));
