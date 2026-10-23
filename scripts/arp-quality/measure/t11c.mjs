import { render, LAB } from './lib.mjs';
const seen = [];
render({ params: LAB, notes: [{ midi: 54, time: 0.01, gate: 0.05, accent: 1, from: null }], seconds: 0.2, onBlock: (f, proc) => { if (f < 1000) seen.push([f, proc.rIdx]); } });
console.log(JSON.stringify(seen));
