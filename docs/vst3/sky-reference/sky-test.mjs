#!/usr/bin/env node
/**
 * Le banc de la reverbe MM-SKY du MM-ARP (2026-11-16, audio/sky.worklet.js, voyager/sky.ts), sans navigateur ni son :
 * le processeur tourne dans Node (AudioWorkletProcessor et registerProcessor simules), les reglages viennent du vrai
 * voyager/sky.ts (compile par esbuild). Pour chacune des douze machines :
 * - sa reponse a une impulsion (les deux canaux) a son reglage de depart : l'energie par canal (la reverbe d'avant
 *   valait 1, audio/fx.ts makeImpulse), la crete, le Tr60 mesure (integration de Schroeder, pente de -5 a -35 dB)
 *   contre le DECAY demande ;
 * - le pire des reglages (tout au max : DECAY, MOD, LOW END, FEEDBACK, AMOUNT en REGEN...) sous 6 s de bruit puis 6 s
 *   de silence : jamais de NaN, une crete bornee, la queue qui redescend ;
 * - le temps de calcul (secondes de calcul par seconde de son, bruit en entree).
 *
 *   node scripts/sky-test.mjs            le tableau, sortie 1 si une machine echoue
 *   node scripts/sky-test.mjs --gains    propose les gains SKY_GAIN (energie 1 au depart)
 */

import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SR = 48000;
const BLOCK = 128;

globalThis.sampleRate = SR;
globalThis.AudioWorkletProcessor = class {
  constructor() {
    this.port = { onmessage: null, postMessage() {} };
  }
};
let Proc = null;
globalThis.registerProcessor = (_name, cls) => {
  Proc = cls;
};
await import(pathToFileURL(path.join(ROOT, 'src/v4/audio/sky.worklet.js')).href);

const tmp = await mkdtemp(path.join(os.tmpdir(), 'sky-'));
const out = path.join(tmp, 'sky.mjs');
await build({ entryPoints: [path.join(ROOT, 'src/v4/voyager/sky.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const sky = await import(pathToFileURL(out).href);

const make = (p) => new Proc({ processorOptions: { params: p } });

/** Rend `seconds` de son ; input(i) donne l'echantillon d'entree (les deux canaux). */
function render(proc, seconds, input) {
  const n = Math.ceil((seconds * SR) / BLOCK) * BLOCK;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const iL = new Float32Array(BLOCK);
  const iR = new Float32Array(BLOCK);
  const oL = new Float32Array(BLOCK);
  const oR = new Float32Array(BLOCK);
  for (let b = 0; b < n; b += BLOCK) {
    for (let i = 0; i < BLOCK; i += 1) {
      const x = input(b + i);
      iL[i] = x;
      iR[i] = x;
    }
    proc.process([[iL, iR]], [[oL, oR]]);
    L.set(oL, b);
    R.set(oR, b);
  }
  return [L, R];
}

/** Tr60 par l'integration de Schroeder (pente de -5 a -35 dB, extrapolee a 60). */
function t60Of(x) {
  const e = new Float64Array(x.length);
  let acc = 0;
  for (let i = x.length - 1; i >= 0; i -= 1) {
    acc += x[i] * x[i];
    e[i] = acc;
  }
  const tot = e[0];
  if (!(tot > 0)) return NaN;
  let i5 = -1;
  let i35 = -1;
  for (let i = 0; i < e.length; i += 1) {
    const db = 10 * Math.log10(e[i] / tot);
    if (i5 < 0 && db <= -5) i5 = i;
    if (db <= -35) {
      i35 = i;
      break;
    }
  }
  if (i5 < 0 || i35 < 0) return NaN;
  return ((i35 - i5) / SR) * 2;
}

const energy = (x) => x.reduce((a, v) => a + v * v, 0);
const peak = (x) => x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
const noise = (() => {
  let s = 12345;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  };
})();

const rows = [];
let fail = 0;
for (const m of sky.SKY_MACHINES) {
  sky.skyState.reset();
  sky.skyState.setMachine(m.id);
  const p = sky.skyEngine();
  const want = m.id === 'nonlinear' || m.id === 'reflections' ? p.t60 : p.t60;
  const dur = Math.min(40, Math.max(3, want * 1.6 + (p.pre ?? 0) + 1.5));
  // SWELL avale une impulsion (il monte apres l'attaque) : une salve de bruit de 1 s, comparee a HALL sur la meme salve
  const burst = (i) => (i < SR ? noise() * 0.1 : 0);
  const [L, R] = render(make(p), dur, m.id === 'swell' ? burst : (i) => (i === 0 ? 1 : 0));
  let ref = 1;
  if (m.id === 'swell') {
    sky.skyState.setMachine('hall');
    const ph = sky.skyEngine();
    const [hL, hR] = render(make(ph), dur, burst);
    const [iL2, iR2] = render(make(ph), dur, (i) => (i === 0 ? 1 : 0));
    // l'energie de HALL a l'impulsion, rapportee a la salve
    ref = (energy(iL2) + energy(iR2)) / (energy(hL) + energy(hR));
    sky.skyState.setMachine('swell');
  }
  const eL = energy(L) * ref;
  const eR = energy(R) * ref;
  const t60 = t60Of(Float32Array.from(L, (v, i) => 0.5 * (v + R[i])));
  // le pire : tout au max
  for (const id of sky.skyParamIds(m.id)) {
    const o = sky.skyParam(m.id, id).options;
    if (!o) sky.skyState.set(id, 1);
  }
  if (m.id === 'shimmer') {
    sky.skyState.set('shimMode', 1);
    sky.skyState.set('shift2', 1);
  }
  const pw = sky.skyEngine();
  const pr = make(pw);
  const [wL] = render(pr, 6, () => noise() * 0.5);
  const [sL] = render(pr, 6, () => 0);
  const pkW = peak(wL);
  const tailEnd = peak(sL.subarray(sL.length - SR / 2));
  const nan = wL.some((v) => !Number.isFinite(v)) || sL.some((v) => !Number.isFinite(v));
  // le temps de calcul, au reglage de depart
  sky.skyState.resetMachine(m.id);
  const pc = make(sky.skyEngine());
  const t0 = performance.now();
  render(pc, 4, () => noise() * 0.3);
  const cpu = (performance.now() - t0) / 1000 / 4;
  const ok = !nan && pkW < 30 && tailEnd < pkW && Number.isFinite(eL) && eL > 1e-4;
  if (!ok) fail += 1;
  rows.push({
    machine: m.name,
    t60want: m.id === 'reflections' ? '-' : (m.id === 'nonlinear' ? p.t60 : p.t60).toFixed(2),
    t60: Number.isFinite(t60) ? t60.toFixed(2) : '-',
    energyL: eL.toFixed(3),
    energyR: eR.toFixed(3),
    peak: Math.max(peak(L), peak(R)).toFixed(3),
    worstPeak: pkW.toFixed(2),
    tail6s: tailEnd.toExponential(1),
    cpu: `${(cpu * 100).toFixed(1)} %`,
    gain: (1 / Math.sqrt(Math.max(1e-9, 0.5 * (eL + eR))) * (p.gain || 1)).toFixed(3),
    ok: ok ? 'ok' : 'FAIL',
  });
}
console.table(rows);
if (process.argv.includes('--gains')) {
  console.log('SKY_GAIN propose (energie 1 par canal au reglage de depart) :');
  for (const r of rows) console.log(`  ${r.machine.toLowerCase()}: ${r.gain},`);
}
process.exit(fail > 0 ? 1 : 0);
