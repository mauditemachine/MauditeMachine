// T13: zipper. Knob automation as the site sends it (a params message each change):
//  - smooth: a new value every block (2.7 ms), the ideal;
//  - ui60: continuous values at 60 Hz (a pointer drag);
//  - cc7_fast / cc7_slow: 7-bit MIDI CC steps (1/127 of the knob), a step every ~13 ms (fast turn) or ~40 ms (slow turn).
// A) CUTOFF sweep 1 -> 4 kHz on a self-oscillating filter (RES 1.0): the oscillation's pitch shows the cutoff path.
// B) CUTOFF sweep on a resonant saw (RES 0.8), C) OSC 1 level, D) RES, E) OVERDRIVE, F) WAVE 1 morph SAW -> SQUARE:
//    on a sine or saw note, the sidebands that the steps add (ana_zipper.py).
import path from 'node:path';
import { render, LAB, OUT, writeNpy, writeJson, hzMidi } from './lib.mjs';

const dir = path.join(OUT, 'zipper');
const man = { cases: [] };
const cutoffHz = (v) => 30 * Math.pow(2, v * 9.3);
const knobOfHz = (hz) => Math.log2(hz / 30) / 9.3;
const SR = 48000;
// automation: from knob a to b over [t0, t1]; returns a function f(frame) -> knob value or null (no message)
function auto(kind, a, b, t0, t1) {
  let last = null;
  let lastSent = -1e9;
  return (frame) => {
    const t = frame / SR;
    if (t < t0) return null;
    const u = Math.min(1, (t - t0) / (t1 - t0));
    let v = a + (b - a) * u;
    if (kind === 'smooth') return v;
    if (kind === 'ui60') {
      if (t - lastSent < 1 / 60 && u < 1) return null;
      lastSent = t;
      return v;
    }
    // 7-bit: quantized, and a controller sends at most every 13 ms (fast) or 40 ms (slow turn)
    const per = kind === 'cc7_fast' ? 0.013 : 0.04;
    v = Math.round(v * 127) / 127;
    if (v === last || (t - lastSent < per && u < 1)) return null;
    last = v;
    lastSent = t;
    return v;
  };
}
const KINDS = ['smooth', 'ui60', 'cc7_fast', 'cc7_slow'];
function run(name, params, note, seconds, param, map, a, b, t0, t1, extra = {}) {
  for (const kind of KINDS) {
    const f = auto(kind, a, b, t0, t1);
    const r = render({
      params,
      notes: [note],
      seconds,
      onBlock: (frame, proc) => {
        const v = f(frame);
        if (v !== null) proc.onMsg({ type: 'params', params: { ...proc.p, [param]: map(v) } });
      },
      ...extra,
    });
    const fn = `${name}_${kind}.npy`;
    writeNpy(path.join(dir, fn), r.L);
    man.cases.push({ name, kind, file: `zipper/${fn}`, t0, t1 });
  }
}
const held = (midi) => ({ midi, time: 0, gate: 30, accent: 1, from: null });
// A) self-oscillating cutoff sweep 1 -> 4 kHz (noise seed), after 0.6 s of build-up
run('A_selfosc_cutoff', { ...LAB, noise: 0.003, res: 1, cutoff: 1000 }, held(54), 2.4, 'cutoff', cutoffHz, knobOfHz(1000), knobOfHz(4000), 0.8, 2.0);
// B) resonant saw, cutoff 300 Hz -> 3 kHz
run('B_saw_cutoff_res08', { ...LAB, osc1: 0.3, wave1: 2, res: 0.8, cutoff: 300 }, held(45), 2.2, 'cutoff', cutoffHz, knobOfHz(300), knobOfHz(3000), 0.5, 1.7);
// C) OSC 1 level (engine gain = 0.88 knob^2) on a sine 1 kHz
run('C_sine_osc1_level', { ...LAB, osc1: 0.88 * 0.2 * 0.2, wave1: 0 }, held(hzMidi(1000)), 2.2, 'osc1', (v) => 0.88 * v * v, 0.2, 0.8, 0.5, 1.7);
// D) RES on a saw through 800 Hz
run('D_saw_res', { ...LAB, osc1: 0.3, wave1: 2, res: 0.1, cutoff: 800 }, held(45), 2.2, 'res', (v) => v, 0.1, 0.85, 0.5, 1.7);
// E) OVERDRIVE on a sine 220 Hz
run('E_sine_drive', { ...LAB, osc1: 0.4, wave1: 0, drive: 0 }, held(57), 2.2, 'drive', (v) => v, 0, 0.8, 0.5, 1.7);
// F) WAVE 1 morph SAW -> SQUARE on A2 (the knob: wave1 = 5 x knob)
run('F_wave_morph', { ...LAB, osc1: 0.3, wave1: 2, cutoff: 4000 }, held(45), 2.2, 'wave1', (v) => 5 * v, 0.4, 0.6, 0.5, 1.7);
writeJson(path.join(dir, 'manifest.json'), man);
console.log(man.cases.length);
