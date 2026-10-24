// MM-ARP measurement harness (2026-10-23). Runs the REAL engine file of this repo (or ARP_WORKLET)
// (src/v4/audio/moog.worklet.js, read-only, loaded as text) block by block in Node: no AudioContext, no sound.
// Variants:
//   - plain: the file as is;
//   - expose: the same file + one appended line that exports its private helpers (shape, pulse, Decimator...) for
//     direct checks (behaviour unchanged);
//   - inject: the oscillator sum `o` at the filter input replaced by globalThis.__inj(voice, i2, o) when that hook is
//     set (impulse / noise responses of the real ladder + output path); every other line unchanged.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
// 2026-10-23 : copie dans le depot (scripts/arp-quality/measure) ; le moteur mesure : ARP_WORKLET, sinon celui du depot ;
// les sorties hors git (scripts/output/arp-quality/measure)
export const ROOT = path.resolve(HERE, '../../..');
export const WORKLET = process.env.ARP_WORKLET ? path.resolve(process.env.ARP_WORKLET) : path.join(ROOT, 'src/v4/audio/moog.worklet.js');
export const OUT = path.join(ROOT, 'scripts/output/arp-quality/measure');
export const SR = 48000;
export const BLOCK = 128;

const PARAMS = JSON.parse(readFileSync(path.join(OUT, 'params.json'), 'utf8'));
/** The engine params of the site's default patch (INIT), as params.ts engineParams gives them. */
export const DEF = PARAMS.engine;
export const PRESETS = PARAMS.presets;

/**
 * A neutral lab patch: one sine oscillator path available but muted, no envelope modulation of the filter, amp
 * sustain 1, no drift, no stereo spread, no GLUE, no clipper (outLevel 0), fixed start phase.
 */
export const LAB = {
  ...DEF,
  wave1: 0, wave2: 0, osc1: 0, osc2: 0, sub: 0, fm: 0, noise: 0, fine1: 0, fine2: 0, tune1: 0, tune2: 0,
  envOct: 0, fA: 0.001, fD: 1, fS: 1, fR: 0.05, aA: 0.001, aD: 1, aS: 1, aR: 0.05,
  drift: 0, width: 0, keyTrack: 0, drive: 0, lfoAmt: 0, glue: 0, wide: 0, stack: 0, accFlt: 0, phase: 0,
  outLevel: 0, res: 0, cutoff: 21600, fmode: 0, sync: 0,
};

/** mulberry32, the engine's own seeded generator */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = {};
/** The processor class of a variant ('plain', 'expose', 'inject'), built once per sample rate. */
export function engine(variant = 'plain', sr = SR, file = WORKLET) {
  const key = `${variant}:${sr}:${file}`;
  if (cache[key]) return cache[key];
  let src = readFileSync(file, 'utf8');
  if (variant === 'inject') {
    const a = 'const u = (o * driveIn - k * S) / (1 + k * Ga * Gb * Gc * Gd);';
    if (src.split(a).length !== 2) throw new Error('inject: anchor not found exactly once');
    src = src.replace(a, 'const u = ((globalThis.__inj ? globalThis.__inj(v, i2, o) : o) * driveIn - k * S) / (1 + k * Ga * Gb * Gc * Gd);');
  }
  if (variant === 'expose' || variant === 'inject') {
    src += '\n;globalThis.__mmx = { shape, shape1, pulse, polyblep, rawShape, resK, Decimator, halfband, odCurve, odComp, glueClip, glueGr, NL_K, NL_A, BASS_KEEP, OUT_GAIN, BP_GAIN, BP_RES, HP_GAIN, HP_RES, SLOPE12_RES, VOICE_OFF, CLIP_KNEE, CLIP_CEIL, OD_GAIN, OD_MIX, PULSE_W, FM_MAX, FM_INDEX, DRIFT_WALKS, DRIFT_CAL };';
  }
  const reg = {};
  globalThis.sampleRate = sr;
  globalThis.currentFrame = 0;
  globalThis.currentTime = 0;
  const Base = class {
    constructor() {
      this.port = { postMessage() {}, onmessage: null };
    }
  };
  new Function('AudioWorkletProcessor', 'registerProcessor', `${src}\n//# sourceURL=${file}?${variant}`)(Base, (n, c) => {
    reg[n] = c;
  });
  cache[key] = reg['mm-voyager'];
  return cache[key];
}

/**
 * Renders the engine.
 * o: { params, notes:[{midi,time,gate,accent,from}], seconds, os, maxVoices, maxStack, wideVoices, seed, timeline,
 *      variant, sr, onBlock(frame, proc, sr), timing }
 * returns { L, R, proc, blockUs (per block wall time, if timing), cpuUsPerBlock }
 */
export function render(o) {
  const sr = o.sr ?? SR;
  const Proc = engine(o.variant ?? 'plain', sr, o.file ?? WORKLET);
  globalThis.sampleRate = sr;
  globalThis.currentFrame = 0;
  globalThis.currentTime = 0;
  const seed = o.seed ?? 1234;
  const realRandom = Math.random;
  Math.random = mulberry32(seed ^ 0xa5a5);
  try {
    const proc = new Proc({
      processorOptions: {
        params: o.params ?? LAB,
        notes: o.notes ?? [],
        beats: o.beats ?? [],
        timeline: o.timeline ?? [],
        os: o.os ?? 4,
        maxVoices: o.maxVoices ?? 12,
        maxStack: o.maxStack ?? 3,
        wideVoices: o.wideVoices ?? 8,
        seed,
      },
    });
    const n = Math.ceil(((o.seconds ?? 1) * sr) / BLOCK) * BLOCK;
    const L = new Float32Array(n);
    const R = new Float32Array(n);
    const bl = new Float32Array(BLOCK);
    const br = new Float32Array(BLOCK);
    const timing = o.timing === true;
    const blockUs = timing ? new Float64Array(n / BLOCK) : null;
    const c0 = process.cpuUsage();
    for (let f = 0, b = 0; f < n; f += BLOCK, b += 1) {
      globalThis.currentFrame = f;
      globalThis.currentTime = f / sr;
      if (o.onBlock) o.onBlock(f, proc, sr);
      if (timing) {
        const t0 = process.hrtime.bigint();
        proc.process([], [[bl, br]]);
        blockUs[b] = Number(process.hrtime.bigint() - t0) / 1000;
      } else proc.process([], [[bl, br]]);
      L.set(bl, f);
      R.set(br, f);
    }
    const cu = process.cpuUsage(c0);
    return { L, R, proc, blockUs, cpuUsPerBlock: (cu.user + cu.system) / (n / BLOCK) };
  } finally {
    Math.random = realRandom;
  }
}

/** A params message at a given time (like the port), for onBlock-driven automation. */
export const msgParams = (proc, params) => proc.onMsg({ type: 'params', params });

/** Writes a float32 .npy (shape [channels, n] or [n]). */
export function writeNpy(file, chans) {
  const arrs = Array.isArray(chans) ? chans : [chans];
  const n = arrs[0].length;
  const shape = arrs.length === 1 && !Array.isArray(chans) ? `(${n},)` : `(${arrs.length}, ${n})`;
  let header = `{'descr': '<f4', 'fortran_order': False, 'shape': ${shape}, }`;
  const total = 10 + header.length + 1;
  header += ' '.repeat((64 - (total % 64)) % 64) + '\n';
  const hb = Buffer.from(header, 'latin1');
  const pre = Buffer.alloc(10);
  pre.writeUInt8(0x93, 0);
  pre.write('NUMPY', 1, 'latin1');
  pre.writeUInt8(1, 6);
  pre.writeUInt8(0, 7);
  pre.writeUInt16LE(hb.length, 8);
  const data = Buffer.alloc(arrs.length * n * 4);
  let p = 0;
  for (const a of arrs) for (let i = 0; i < n; i += 1, p += 4) data.writeFloatLE(a[i], p);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, Buffer.concat([pre, hb, data]));
}

/** 32-bit float stereo WAV (for listening later, never played here). */
export function writeWav(file, L, R, sr = SR) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 8);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 8, 28);
  buf.writeUInt16LE(8, 32);
  buf.writeUInt16LE(32, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i += 1) {
    buf.writeFloatLE(L[i], 44 + i * 8);
    buf.writeFloatLE(R ? R[i] : L[i], 48 + i * 8);
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, buf);
}

export const writeJson = (file, obj) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(obj, null, 1)}\n`);
};

/** Count of non-finite and subnormal (float32) samples. */
export function badCount(a) {
  let nf = 0;
  let sub = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    if (!Number.isFinite(x)) nf += 1;
    else if (x !== 0 && Math.abs(x) < 1.1754944e-38) sub += 1;
  }
  return { nonFinite: nf, subnormal: sub };
}

export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const hzMidi = (f) => 69 + 12 * Math.log2(f / 440);
export const db = (x) => 20 * Math.log10(Math.max(1e-30, Math.abs(x)));
