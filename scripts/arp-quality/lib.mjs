/**
 * Le harnais du controle qualite du MM-ARP (2026-10-23) : le moteur (src/v4/audio/moog.worklet.js, ou un autre
 * fichier : --worklet, ou ARP_WORKLET) charge tel quel dans Node, rendu bloc par bloc avec sa graine ; aucun
 * AudioContext, aucun son. Les reglages du site (voyager/params.ts, state/factory.ts) lus par Vite.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const OUT = path.join(ROOT, 'scripts/output/arp-quality');
export const SR = 48000;
export const BLOCK = 128;

const argv = process.argv.slice(2);
export const flag = (f) => argv.includes(f);
export const opt = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d;
};
export const WORKLET = path.resolve(opt('--worklet', process.env.ARP_WORKLET || path.join(ROOT, 'src/v4/audio/moog.worklet.js')));

/** mulberry32, celui du moteur. */
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

const cache = new Map();
/** La classe du processeur d'un fichier (une fois par fichier). */
export function engine(file = WORKLET) {
  const key = path.resolve(file);
  if (cache.has(key)) return cache.get(key);
  const src = readFileSync(key, 'utf8');
  const reg = {};
  globalThis.sampleRate = SR;
  globalThis.currentFrame = 0;
  globalThis.currentTime = 0;
  const Base = class {
    constructor() {
      this.port = { postMessage() {}, onmessage: null };
    }
  };
  new Function('AudioWorkletProcessor', 'registerProcessor', `${src}\n//# sourceURL=${key}`)(Base, (n, c) => {
    reg[n] = c;
  });
  if (!reg['mm-voyager']) throw new Error(`${key} : pas de processeur mm-voyager`);
  cache.set(key, reg['mm-voyager']);
  return reg['mm-voyager'];
}

/**
 * Un rendu. o : { file, params, notes, beats, timeline, seconds, os (4), phone (x2, 8 voix, STACK 2, WIDE 4), seed,
 * onBlock(frame, proc), timing }. Rend { L, R, proc, blockUs, cpuUsPerBlock }.
 */
export function render(o) {
  const Proc = engine(o.file ?? WORKLET);
  const phone = o.phone === true || o.os === 2;
  globalThis.sampleRate = SR;
  globalThis.currentFrame = 0;
  globalThis.currentTime = 0;
  const seed = o.seed ?? 1234;
  const real = Math.random;
  Math.random = mulberry32(seed);
  try {
    const proc = new Proc({
      processorOptions: {
        params: o.params,
        notes: o.notes ?? [],
        beats: o.beats ?? [],
        timeline: o.timeline ?? [],
        os: o.os ?? (phone ? 2 : 4),
        maxVoices: o.maxVoices ?? (phone ? 8 : 12),
        maxStack: o.maxStack ?? (phone ? 2 : 3),
        wideVoices: o.wideVoices ?? (phone ? 4 : 8),
        seed,
      },
    });
    const n = Math.ceil(((o.seconds ?? 1) * SR) / BLOCK) * BLOCK;
    const L = new Float32Array(n);
    const R = new Float32Array(n);
    const bl = new Float32Array(BLOCK);
    const br = new Float32Array(BLOCK);
    // Les tableaux d'entree et de sortie gardes d'un bloc a l'autre (comme le navigateur) : le harnais n'alloue rien
    const ins = [];
    const outs = [[bl, br]];
    const blockUs = o.timing ? new Float64Array(n / BLOCK) : null;
    const c0 = process.cpuUsage();
    for (let f = 0, b = 0; f < n; f += BLOCK, b += 1) {
      globalThis.currentFrame = f;
      globalThis.currentTime = f / SR;
      if (o.onBlock) o.onBlock(f, proc);
      if (blockUs) {
        const t0 = process.hrtime.bigint();
        proc.process(ins, outs);
        blockUs[b] = Number(process.hrtime.bigint() - t0) / 1000;
      } else proc.process(ins, outs);
      L.set(bl, f);
      R.set(br, f);
    }
    const cu = process.cpuUsage(c0);
    return { L, R, proc, blockUs, cpuUsPerBlock: (cu.user + cu.system) / (n / BLOCK) };
  } finally {
    Math.random = real;
  }
}

/** Une note tenue (gate s). */
export const held = (midi, gate = 10, time = 0, accent = 1) => ({ midi, time, gate, accent, from: null });
export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const hzMidi = (f) => 69 + 12 * Math.log2(f / 440);

let site = null;
/** Les modules du site (params, factory), lus par Vite une fois. */
export async function siteModules() {
  if (site) return site;
  const { createServer } = await import('vite');
  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.ts'),
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const params = await server.ssrLoadModule('/src/v4/voyager/params.ts');
    const factory = await server.ssrLoadModule('/src/v4/state/factory.ts');
    site = { params, factory };
    return site;
  } finally {
    await server.close();
  }
}

/** Les reglages du moteur du son de depart (INIT) et le patch de labo (measure/lib.mjs LAB). */
export async function patches() {
  const M = await siteModules();
  const knobs = Object.fromEntries(M.params.VOY_KNOBS.map((k) => [k.id, k.def]));
  const DEF = M.params.engineParams(knobs);
  const LAB = {
    ...DEF,
    wave1: 0, wave2: 0, osc1: 0, osc2: 0, sub: 0, fm: 0, noise: 0, fine1: 0, fine2: 0, tune1: 0, tune2: 0,
    envOct: 0, fA: 0.001, fD: 1, fS: 1, fR: 0.05, aA: 0.001, aD: 1, aS: 1, aR: 0.05,
    drift: 0, width: 0, keyTrack: 0, drive: 0, lfoAmt: 0, glue: 0, wide: 0, stack: 0, accFlt: 0, phase: 0,
    outLevel: 0, res: 0, cutoff: 21600, fmode: 0, sync: 0,
  };
  const presets = M.factory.arpFactory(16).map((f) => ({ name: f.name, knobs: f.data.knobs, engine: M.params.engineParams(f.data.knobs) }));
  return { M, knobs, DEF, LAB, presets };
}

export function writeJson(file, obj) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(obj, null, 1)}\n`);
}

/** WAV stereo 32 bits flottants (ou 24 bits entiers, bits = 24), jamais joue ici. */
export function writeWav(file, L, R, { bits = 32, sr = SR } = {}) {
  const n = L.length;
  const bps = bits / 8;
  const buf = Buffer.alloc(44 + n * 2 * bps);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2 * bps, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(bits === 32 ? 3 : 1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2 * bps, 28);
  buf.writeUInt16LE(2 * bps, 32);
  buf.writeUInt16LE(bits, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2 * bps, 40);
  let p = 44;
  for (let i = 0; i < n; i += 1) {
    for (const v of [L[i], R ? R[i] : L[i]]) {
      if (bits === 32) buf.writeFloatLE(v, p);
      else {
        const s = Math.max(-8388608, Math.min(8388607, Math.round(v * 8388607)));
        buf.writeIntLE(s, p, 3);
      }
      p += bps;
    }
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, buf);
}
