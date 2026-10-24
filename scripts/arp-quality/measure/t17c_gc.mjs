import { render, DEF, LAB } from './lib.mjs';
const over = JSON.parse(process.argv[2]);
const base = process.argv[3] === 'lab' ? { ...LAB, osc1: 0.3, wave1: 2 } : { ...DEF, outLevel: 0.3 };
render({ params: { ...base, ...over }, notes: [{ midi: 54, time: 0.05, gate: 100, accent: 1, from: null }], seconds: 30 });
