#!/usr/bin/env node
/**
 * Le chorus Juno du MM-ARP (src/v4/audio/chorus.worklet.js, 'mm-chorus' kind 'juno') dans Node, rien n'est joue
 * (2026-10-23, S20) : un sinus par le chemin mouille (les deux lectures des BBD), modes I et II. L'erreur de la table de
 * phases (contre le meme noyau aux coefficients exacts, calcules a la phase vraie) et l'erreur contre un retard vrai (un
 * noyau de 32 points aux coefficients exacts), en dB du mouille ; le niveau mouille (contre --against) ; le calcul par
 * bloc.
 *
 *   node scripts/arp-quality/chorus.mjs [--chorus <chorus.worklet.js>] [--against <chorus.worklet.js d'avant>]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, opt } from './lib.mjs';
import { db10 } from './ana.mjs';

const FILE = path.resolve(opt('--chorus', path.join(ROOT, 'src/v4/audio/chorus.worklet.js')));
const AGAINST = opt('--against', '');
const SR = 48000;
const JUNO = { rates: [0.513, 0.863], delay: { min: 0.00166, max: 0.00535 }, filterDelay: 0.000106, biquads: [[9688, 0.549], [10378, 1.291], [9688, 0.549], [10378, 1.291]], pole: 7234 };

/** Le meme noyau (16 points, Kaiser 8) ou un plus long (half, beta), aux coefficients exacts a la phase vraie. */
const exactRead = (half, beta) => `function readFrac(b, w, d) {
  const n = b.length;
  let pos = w - d;
  while (pos < 0) pos += n;
  const i = Math.floor(pos);
  const f = pos - i;
  const H = ${half};
  const taps = 2 * H;
  const i0b = besselI0(${beta});
  let y = 0;
  let s = 0;
  let j = i - (H - 1);
  if (j < 0) j += n;
  for (let k = 0; k < taps; k += 1) {
    const x = f + (H - 1) - k;
    const sinc = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const r = x / H;
    const c = sinc * (Math.abs(r) >= 1 ? 0 : besselI0(${beta} * Math.sqrt(1 - r * r)) / i0b);
    y += c * b[j];
    s += c;
    j += 1;
    if (j === n) j = 0;
  }
  return y / s;
}`;

function load(src) {
  const reg = {};
  globalThis.sampleRate = SR;
  const Base = class {
    constructor() {
      this.port = { postMessage() {}, onmessage: null };
    }
  };
  new Function('AudioWorkletProcessor', 'registerProcessor', src)(Base, (n, c) => {
    reg[n] = c;
  });
  return reg['mm-chorus'];
}
const patched = (src, body) => {
  const a = src.indexOf('function readFrac(b, w, d) {');
  const b = src.indexOf('\n}\n', a) + 3;
  return src.slice(0, a) + body + '\n' + src.slice(b);
};

function run(Proc, mode, f, seconds = 1.5, timing = false) {
  const proc = new Proc({ processorOptions: { kind: 'juno', dmin: JUNO.delay.min - JUNO.filterDelay, dmax: JUNO.delay.max - JUNO.filterDelay, biquads: JUNO.biquads, pole: JUNO.pole, rate: JUNO.rates[mode - 1] } });
  const n = Math.round((seconds * SR) / 128) * 128;
  const L = new Float64Array(n);
  const R = new Float64Array(n);
  const inp = new Float32Array(128);
  const oL = new Float32Array(128);
  const oR = new Float32Array(128);
  let us = Infinity;
  for (let b = 0; b < n; b += 128) {
    for (let i = 0; i < 128; i += 1) inp[i] = 0.5 * Math.sin((2 * Math.PI * f * (b + i)) / SR);
    const t0 = timing ? process.hrtime.bigint() : 0n;
    proc.process([[inp, inp]], [[oL, oR]]);
    if (timing && b > 48000) us = Math.min(us, Number(process.hrtime.bigint() - t0) / 1000);
    L.set(oL, b);
    R.set(oR, b);
  }
  return { L, R, us };
}

const src = readFileSync(FILE, 'utf8');
const Cur = load(src);
const Ex16 = load(patched(src, exactRead(8, 8)));
const Ex32 = load(patched(src, exactRead(16, 12)));
const Old = AGAINST ? load(readFileSync(path.resolve(AGAINST), 'utf8')) : null;
const st = Math.round(0.2 * SR);
const pw = (x) => {
  let s = 0;
  for (let i = st; i < x.length; i += 1) s += x[i] * x[i];
  return s / (x.length - st);
};
const errDb = (a, b) => {
  let e = 0;
  let s = 0;
  for (const ch of ['L', 'R']) {
    for (let i = st; i < a[ch].length; i += 1) {
      const d = a[ch][i] - b[ch][i];
      e += d * d;
      s += b[ch][i] * b[ch][i];
    }
  }
  return db10(e / s);
};
console.log(`${path.relative(ROOT, FILE)}${AGAINST ? ` contre ${AGAINST}` : ''}`);
for (const mode of [1, 2]) {
  for (const f of [440, 1000, 3000, 6000, 10000, 15000]) {
    const c = run(Cur, mode, f);
    const e16 = run(Ex16, mode, f);
    const e32 = run(Ex32, mode, f);
    const row = [`mode ${mode === 1 ? 'I ' : 'II'} ${String(f).padStart(5)} Hz`, `table ${errDb(c, e16).toFixed(1)} dB`, `vs true delay ${errDb(c, e32).toFixed(1)} dB`, `(kernel floor ${errDb(e16, e32).toFixed(1)} dB)`];
    if (Old) {
      const o = run(Old, mode, f);
      row.push(`wet level re before ${(db10(pw(c.L) + pw(c.R)) - db10(pw(o.L) + pw(o.R))).toFixed(3)} dB`, `before: table ${errDb(o, e16).toFixed(1)} / true ${errDb(o, e32).toFixed(1)} dB`);
    }
    console.log('  ' + row.join('   '));
  }
}
// Le calcul : le meilleur temps par bloc de 128 (sinus 1 kHz, mode I), apres chauffe
for (let r = 0; r < 2; r += 1) {
  const a = run(Cur, 1, 1000, 3, true).us;
  const b = Old ? run(Old, 1, 1000, 3, true).us : NaN;
  if (r === 1) console.log(`  cpu per block: ${a.toFixed(1)} us${Old ? `, before ${b.toFixed(1)} us` : ''}`);
}
