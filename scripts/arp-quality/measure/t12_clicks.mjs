// T12: clicks. A sine patch (OSC 1 sine A3 220 Hz at 0.3, no drift) where any discontinuity shows as broadband energy
// above 5 kHz (ana_clicks.py: zero-phase 4th-order high-pass at 5 kHz, peak around the event, in dB re the note).
import path from 'node:path';
import { render, LAB, OUT, writeNpy, writeJson } from './lib.mjs';

const dir = path.join(OUT, 'clicks');
const man = { cases: [] };
const A3 = 57;
const base = { ...LAB, osc1: 0.3, wave1: 0, cutoff: 21600, aA: 0.001, aS: 1, aD: 0.1, aR: 0.005, phase: -1 };
const n = (midi, time, gate, extra = {}) => ({ midi, time, gate, accent: 1, from: null, ...extra });
function run(name, te, opt) {
  const r = render({ seconds: opt.seconds ?? 0.6, seed: opt.seed ?? 21, ...opt });
  writeNpy(path.join(dir, `${name}.npy`), r.L);
  man.cases.push({ name, file: `clicks/${name}.npy`, te, ref: opt.ref ?? null, note: opt.note ?? '' });
}
const at = (t, params) => (f, proc) => {
  if (f === Math.round((t * 48000) / 128) * 128) proc.onMsg({ type: 'params', params: { ...proc.p, ...params } });
};
// note on / off
run('on_attack1ms_freephase', 0.1, { params: base, notes: [n(A3, 0.1, 0.3)] });
run('on_attack1ms_phase0', 0.1, { params: { ...base, phase: 0 }, notes: [n(A3, 0.1, 0.3)] });
run('on_attack1ms_phase90', 0.1, { params: { ...base, phase: 0.25 }, notes: [n(A3, 0.1, 0.3)] });
run('on_attack7ms', 0.1, { params: { ...base, aA: 0.0067 }, notes: [n(A3, 0.1, 0.3)] });
run('on_saw_default_attack', 0.1, { params: { ...base, wave1: 2, cutoff: 2000, res: 0.35 }, notes: [n(A3, 0.1, 0.3)], note: 'saw through a 2 kHz filter' });
run('off_release5ms', 0.3, { params: base, notes: [n(A3, 0.1, 0.2)] });
run('off_release25ms', 0.3, { params: { ...base, aR: 0.0247 }, notes: [n(A3, 0.1, 0.2)] });
// steals and retriggers
run('steal_1voice', 0.3, { maxVoices: 1, params: base, notes: [n(A3, 0.1, 1), n(A3 + 7, 0.3, 0.2)] });
run('steal_1voice_samepitch', 0.3, { maxVoices: 1, params: base, notes: [n(A3, 0.1, 1), n(A3, 0.3, 0.2)] });
run('steal_12th', 0.3, { params: { ...base, osc1: 0.05 }, notes: [...Array.from({ length: 12 }, (_, k) => n(A3 + k, 0.1, 1)), n(A3 + 12, 0.3, 0.2)] });
run('steal_released_tail', 0.3, { maxVoices: 2, params: { ...base, aR: 0.3 }, notes: [n(A3, 0.05, 0.1), n(A3 + 3, 0.1, 1), n(A3 + 7, 0.3, 0.2)], note: 'steals the voice whose release is quieter' });
run('retrigger_samepitch', 0.3, { params: base, notes: [n(A3, 0.1, 0.25), n(A3, 0.3, 0.2)] });
run('stop_message', 0.3, { params: base, notes: [n(A3, 0.1, 1)], timeline: [{ at: 0.3, msg: { type: 'stop', time: 0.3 } }] });
run('noteoff_message', 0.3, { params: base, notes: [n(A3, 0.1, Infinity)], timeline: [{ at: 0.299, msg: { type: 'noteOff', midi: A3, time: 0.3 } }] });
run('glide_100ms', 0.3, { params: { ...base, glide: 0.1 }, notes: [n(A3, 0.1, 0.21), n(A3 + 7, 0.3, 0.2, { from: A3 })] });
// the end of a long resonant release (voice cut at -66 dB): the event time is found from the voice state
let tCut = null;
run('voice_cut_res095', -1, { seconds: 3.5, params: { ...base, wave1: 2, osc1: 0.6, cutoff: 500, res: 0.95, aR: 1.5 }, notes: [n(A3, 0.05, 0.2)], onBlock: (f, proc) => { if (tCut === null && f > 4800 && !proc.voices.some((v) => v.on)) tCut = f / 48000; } });
man.cases[man.cases.length - 1].te = tCut;
// mid-note switches (params messages, like the knobs)
const held = (name, from, to, note) => run(name, 0.3, { params: { ...base, ...from }, notes: [n(A3, 0.05, 1)], onBlock: at(0.3, to), note });
held('switch_fmode_moog_to_hp_res08', { cutoff: 1500, res: 0.8, fmode: 0 }, { fmode: 3 });
held('switch_wide_on_res08', { cutoff: 1500, res: 0.8, osc2: 0.3, wave2: 0, tune2: 7 }, { wide: 1 });
held('switch_wide_off_res08', { cutoff: 1500, res: 0.8, osc2: 0.3, wave2: 0, tune2: 7, wide: 1 }, { wide: 0 });
held('switch_sub_on', {}, { sub: 0.5 });
held('switch_sync_on_saw7', { osc1: 0, osc2: 0.3, wave2: 2, tune2: 7, cutoff: 2000 }, { sync: 1 });
held('switch_sync_off_saw7', { osc1: 0, osc2: 0.3, wave2: 2, tune2: 7, sync: 1, cutoff: 2000 }, { sync: 0 });
held('switch_range2_up', { osc2: 0.3, wave2: 0, tune2: 0 }, { tune2: 12 });
held('switch_fm_ratio', { fm: 0.5, ratio: 1 }, { ratio: 3.5 });
held('switch_drive_0_to_05', {}, { drive: 0.5 });
held('switch_glue_0_to_05', {}, { glue: 0.5 });
held('switch_stack_0_to_16ct', { wave1: 2, cutoff: 2000 }, { stack: 16 }, 'no effect until the next note (STACK is fixed at note on)');
held('switch_noise_on', {}, { noise: 0.3 });
held('switch_wave_sine_to_saw', { cutoff: 2000 }, { wave1: 2 });
held('switch_cutoff_jump_res08', { cutoff: 300, res: 0.8 }, { cutoff: 3000 });
held('switch_res_jump', { cutoff: 1000, res: 0 }, { res: 0.85 });
held('switch_keytrack_jump', { cutoff: 1000, res: 0.6, keyTrack: 0 }, { keyTrack: 1 }, 'KEY TRACK is not smoothed');
held('switch_volume_clip', { outLevel: 0.3 }, { outLevel: 1.2 }, 'outLevel moves the output clipper');
// LFO square on the cutoff, resonant (MOD with SQR shape: 2 ms smoothing)
run('lfo_square_cutoff_res08', 0.3, { params: { ...base, cutoff: 800, res: 0.8, lfoDest: 1, lfoShape: 2, lfoAmt: 0.5, lfoBeats: 0.5, bpm: 120 }, notes: [n(A3, 0.05, 1)], note: 'cycle 1/8 at 120 BPM: an edge every 125 ms' });
run('lfo_sh_cutoff_res08', 0.3, { params: { ...base, cutoff: 800, res: 0.8, lfoDest: 1, lfoShape: 3, lfoAmt: 0.5, lfoBeats: 0.5, bpm: 120 }, notes: [n(A3, 0.05, 1)] });
run('lfo_square_pitch', 0.3, { params: { ...base, lfoDest: 3, lfoShape: 2, lfoAmt: 1, lfoBeats: 0.5, bpm: 120 }, notes: [n(A3, 0.05, 1)] });
writeJson(path.join(dir, 'manifest.json'), man);
console.log(man.cases.length, 'voice cut at', tCut);
