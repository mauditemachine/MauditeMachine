// T05: saturation. A) harmonic profile of a sine through the voice (ladder stages + voice tanh) vs input level,
// filter open and resonant; B) OVERDRIVE 0..1 (sine and saw); C) intermodulation, twin tones in one voice (ladder) and
// in two voices (only the OVERDRIVE branch mixes voices).
import path from 'node:path';
import { render, LAB, OUT, writeNpy, writeJson, hzMidi } from './lib.mjs';

const dir = path.join(OUT, 'drive');
const man = { level: [], od: [], imd: [] };
const A2 = 45; // 110 Hz
const note = (midi, gate = 10) => ({ midi, time: 0, gate, accent: 1, from: null });

// A) level sweep
for (const [fname, cutoff, res] of [['open', 21600, 0], ['res', 2000, 0.8], ['res_low', 400, 0.6]]) {
  for (const lvl of [0.01, 0.03, 0.1, 0.2, 0.4, 0.62, 0.88, 1.76]) {
    const both = lvl > 0.88;
    const params = { ...LAB, cutoff, res, osc1: both ? 0.88 : lvl, osc2: both ? 0.88 : 0, wave1: 0, wave2: 0, tune2: 0 };
    const r = render({ params, notes: [note(A2)], seconds: 1.2 });
    const name = `lvl_${fname}_${lvl}.npy`;
    writeNpy(path.join(dir, name), r.L);
    man.level.push({ file: `drive/${name}`, filter: fname, cutoff, res, level: lvl, f0: 110 });
  }
}
// B) OVERDRIVE sweep
for (const [wname, wave] of [['sine', 0], ['saw', 2]]) {
  for (const lvl of [0.1, 0.62, 0.88]) {
    for (const drive of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      if (lvl !== 0.62 && ![0, 0.5, 1].includes(drive)) continue;
      const params = { ...LAB, cutoff: 21600, res: 0, osc1: lvl, wave1: wave, drive };
      const r = render({ params, notes: [note(A2)], seconds: 1.2 });
      const name = `od_${wname}_${lvl}_${drive}.npy`;
      writeNpy(path.join(dir, name), r.L);
      man.od.push({ file: `drive/${name}`, wave: wname, level: lvl, drive, f0: 110 });
    }
  }
}
// C) twin tones (CCIF style): 1000 Hz and 1059.46 Hz (OSC 2 SEMI +1), sines
const f1 = 1000;
const f2 = 1000 * Math.pow(2, 1 / 12);
for (const lvl of [0.1, 0.31, 0.62]) {
  for (const drive of [0, 0.5, 1]) {
    // in one voice: OSC 1 and OSC 2
    let r = render({ params: { ...LAB, cutoff: 21600, osc1: lvl, osc2: lvl, wave1: 0, wave2: 0, tune2: 1, drive }, notes: [note(hzMidi(f1))], seconds: 1.2 });
    let name = `imd_voice_${lvl}_${drive}.npy`;
    writeNpy(path.join(dir, name), r.L);
    man.imd.push({ file: `drive/${name}`, kind: 'voice', level: lvl, drive, f1, f2 });
    // in two voices: OSC 1 only, two notes
    r = render({ params: { ...LAB, cutoff: 21600, osc1: lvl, wave1: 0, drive }, notes: [note(hzMidi(f1)), note(hzMidi(f2))], seconds: 1.2 });
    name = `imd_two_${lvl}_${drive}.npy`;
    writeNpy(path.join(dir, name), r.L);
    man.imd.push({ file: `drive/${name}`, kind: 'two', level: lvl, drive, f1, f2 });
  }
}
writeJson(path.join(dir, 'manifest.json'), man);
console.log(man.level.length, man.od.length, man.imd.length);
