import { render, DEF, LAB } from './lib.mjs';
const mode = process.argv[2];
const step = 60 / 130 / 4;
let notes = [];
let params = { ...DEF, outLevel: 0.3 };
if (mode === 'held') notes = [{ midi: 54, time: 0.05, gate: 100, accent: 1, from: null }];
if (mode === 'held_lab') { notes = [{ midi: 54, time: 0.05, gate: 100, accent: 1, from: null }]; params = { ...LAB, osc1: 0.3, wave1: 2 }; }
if (mode === 'arp') for (let k = 0; k < Math.floor(30 / step); k += 1) notes.push({ midi: 54 + ((k * 5) % 12), time: 0.05 + k * step, gate: 0.5 * step, accent: 1, from: null });
const h0 = process.memoryUsage();
render({ params, notes, seconds: 30 });
console.log(mode, 'done');
