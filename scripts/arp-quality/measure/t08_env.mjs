// T08: envelopes. Sine 1 kHz at 0.05 (linear), filter open, drift 0 (no per-note scatter): the amp envelope from the
// output; the filter envelope read from the voice state (fV) every block; the knob -> seconds mapping of params.ts.
import path from 'node:path';
import { render, LAB, OUT, writeNpy, writeJson, hzMidi, PRESETS } from './lib.mjs';

const dir = path.join(OUT, 'env');
const man = { attack: [], decay: [], release: [], fenv: [], retrig: [] };
const attackS = (v) => 0.001 * Math.pow(2000, v);
const decayS = (v) => 0.005 * Math.pow(400, v);
const releaseS = (v) => 0.005 * Math.pow(600, v);
const KN = [0, 0.1, 0.25, 0.5, 0.75, 1];
const note = (gate) => ({ midi: hzMidi(1000), time: 0.01, gate, accent: 1, from: null });
const base = { ...LAB, osc1: 0.05, wave1: 0 };
for (const v of KN) {
  const aA = attackS(v);
  let r = render({ params: { ...base, aA, aS: 1, aD: 1 }, notes: [note(aA + 0.5)], seconds: 0.01 + aA * 1.6 + 0.3 });
  writeNpy(path.join(dir, `att_${v}.npy`), r.L);
  man.attack.push({ file: `env/att_${v}.npy`, knob: v, label_s: aA, t0: 0.01 });
  const aD = decayS(v);
  r = render({ params: { ...base, aA: 0.001, aS: 0, aD }, notes: [note(aD * 2 + 0.2)], seconds: 0.01 + aD * 1.8 + 0.1 });
  writeNpy(path.join(dir, `dec_${v}.npy`), r.L);
  man.decay.push({ file: `env/dec_${v}.npy`, knob: v, label_s: aD, t0: 0.01 });
  const aR = releaseS(v);
  r = render({ params: { ...base, aA: 0.001, aS: 1, aD: 0.05, aR }, notes: [note(0.2)], seconds: 0.21 + aR * 1.8 + 0.1 });
  writeNpy(path.join(dir, `rel_${v}.npy`), r.L);
  man.release.push({ file: `env/rel_${v}.npy`, knob: v, label_s: aR, t_off: 0.21 });
  // the filter envelope: fV every block (same code as the amp one, plus ACCENT's decay factor), attack then decay to 0.2
  const fA = attackS(v);
  const fD = decayS(v);
  const fv = [];
  render({ params: { ...base, fA, fD, fS: 0.2, envOct: 3 }, notes: [note(10)], seconds: 0.01 + fA + fD * 1.5 + 0.05, onBlock: (f, proc) => { const vv = proc.voices.find((x) => x.on); fv.push(vv ? vv.fV : 0); } });
  man.fenv.push({ knob: v, fA, fD, fS: 0.2, fV: fv, t0: 0.01 });
}
// retrigger in the middle of a release (same voice? the engine takes a free voice first): one voice only
for (const mv of [1, 12]) {
  const r = render({ maxVoices: mv, params: { ...base, aA: 0.001, aS: 1, aR: releaseS(0.6) }, notes: [note(0.1), { ...note(0.1), time: 0.16 }], seconds: 0.6 });
  writeNpy(path.join(dir, `retrig_${mv}.npy`), r.L);
  man.retrig.push({ file: `env/retrig_${mv}.npy`, maxVoices: mv });
}
// what the factory presets use (amp and filter envelope, seconds)
man.presets = PRESETS.map((p) => ({ name: p.name, aA: p.engine.aA, aD: p.engine.aD, aS: p.engine.aS, aR: p.engine.aR, fA: p.engine.fA, fD: p.engine.fD, fS: p.engine.fS, fR: p.engine.fR }));
writeJson(path.join(dir, 'manifest.json'), man);
console.log('ok');
