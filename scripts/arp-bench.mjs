#!/usr/bin/env node
/**
 * Le banc de reference du MM-ARP (2026-10-22, audit VST3, Mika : "le MM-ARP en
 * VST3 pour Ableton", la base des tests du futur plugin). Fait tourner le
 * moteur du site (src/v4/audio/moog.worklet.js, tel quel, sans navigateur ni
 * son) sur des patchs fixes et une graine : les presets d'usine, le son de
 * depart (INIT), des cas extremes (STACK, WIDE, GLUE, 12 voix tenues). Chaque
 * rendu donne un WAV (32 bits flottants, 48 kHz, stereo) et ses mesures
 * (crete, valeur efficace, centroide, largeur, continu, empreinte SHA-256 des
 * echantillons, calcul par bloc), dans scripts/output/arp-bench/ (hors git).
 *
 *   node scripts/arp-bench.mjs                 tous les patchs, ordinateur (x4, 12 voix, STACK 3, WIDE 8 voix)
 *   node scripts/arp-bench.mjs --phone         le chemin du telephone (x2, 8 voix, STACK 2, WIDE 4 voix)
 *   node scripts/arp-bench.mjs --only ACID,INIT
 *   node scripts/arp-bench.mjs --check         compare a scripts/arp-bench.golden.json (non-regression)
 *   node scripts/arp-bench.mjs --update        reecrit scripts/arp-bench.golden.json
 *   node scripts/arp-bench.mjs --against <moog.worklet.js d'une autre version>
 *        les patchs "legacy" (les reglages ajoutes depuis a leur valeur d'heritage) rendus par les deux moteurs, avec
 *        le meme hasard : identiques au bit pres, ou l'ecart le plus grand
 *   node scripts/arp-bench.mjs --browser       le meme rendu dans un OfflineAudioContext de Chromium (Playwright,
 *        PLAYWRIGHT_MODULE et CHROMIUM_PATH comme scripts/midi-reference.mjs) : la parite Node / navigateur
 *   node scripts/arp-bench.mjs --cpu           le calcul par bloc de 1 a 12 voix tenues (temps CPU, JIT chaud)
 *
 * Le hasard du moteur suit processorOptions.seed (mulberry32) ; un moteur qui ne
 * la connait pas (--against une version d'avant le 2026-10-22) recoit la meme
 * suite par Math.random. Les potards, les presets et l'arpegiateur sont ceux du
 * vrai code (voyager/params.ts, state/factory.ts, voyager/seq.ts et chords.ts,
 * lus par Vite) ; les notes suivent voyager/arp.ts (suite AUTO, accents, swing
 * du style MM-RYTM du meme nom, DRIFT sur la force des notes). Rien ne sort des
 * enceintes : aucun AudioContext n'est ouvert hors de --browser, et celui-la
 * est un OfflineAudioContext dans un Chromium lance avec --mute-audio.
 */

import { createHash } from 'node:crypto';
import { createServer as httpServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scripts/output/arp-bench');
const GOLDEN = path.join(ROOT, 'scripts/arp-bench.golden.json');
const WORKLET = path.join(ROOT, 'src/v4/audio/moog.worklet.js');
const SR = 48000;
const BLOCK = 128;

/* ---------------- les options ---------------- */

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d;
};
const PHONE = flag('--phone');
const OS = Number(opt('--os', PHONE ? 2 : 4));
const VOICES = Number(opt('--voices', PHONE ? 8 : 12));
const STACK_MAX = Number(opt('--stack', PHONE ? 2 : 3));
const WIDE_VOICES = Number(opt('--wide-voices', PHONE ? 4 : 8));
const SEED = Number(opt('--seed', 808));
const BARS = Number(opt('--bars', 4));
const ONLY = opt('--only', '')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const AGAINST = opt('--against', '');
const NO_WAV = flag('--no-wav');

/* ---------------- le hasard ---------------- */

/** mulberry32, le meme que celui du moteur (audio/moog.worklet.js) */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- le vrai code du site (Vite le lit, TypeScript compris) ---------------- */

async function siteModules() {
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
    const chords = await server.ssrLoadModule('/src/v4/voyager/chords.ts');
    const seq = await server.ssrLoadModule('/src/v4/voyager/seq.ts');
    return { params, factory, chords, seq };
  } finally {
    await server.close();
  }
}

/* ---------------- le moteur, hors navigateur ---------------- */

/**
 * Le moteur d'un fichier (le worklet tel quel) : sampleRate, currentFrame et registerProcessor fournis, le port de
 * messages muet. Le meme objet global que le moteur lit : currentFrame avance bloc par bloc.
 */
async function engineOf(file) {
  const src = await readFile(file, 'utf8');
  const reg = {};
  globalThis.sampleRate = SR;
  globalThis.currentFrame = 0;
  globalThis.currentTime = 0;
  const Base = class {
    constructor() {
      this.port = { postMessage() {}, onmessage: null };
    }
  };
  new Function('AudioWorkletProcessor', 'registerProcessor', `${src}\n//# sourceURL=${file}`)(Base, (n, c) => {
    reg[n] = c;
  });
  if (!reg['mm-voyager']) throw new Error(`${file} : pas de processeur mm-voyager`);
  return reg['mm-voyager'];
}

/** Un rendu bloc par bloc ; Math.random suit la meme graine (un moteur qui ne connait pas processorOptions.seed). */
function render(Proc, opts, seconds, onBlock) {
  const real = Math.random;
  Math.random = mulberry32(opts.seed);
  try {
    globalThis.currentFrame = 0;
    const proc = new Proc({ processorOptions: opts });
    const n = Math.ceil((seconds * SR) / BLOCK) * BLOCK;
    const L = new Float32Array(n);
    const R = new Float32Array(n);
    const bl = new Float32Array(BLOCK);
    const br = new Float32Array(BLOCK);
    let maxVoices = 0;
    const c0 = process.cpuUsage();
    for (let f = 0; f < n; f += BLOCK) {
      globalThis.currentFrame = f;
      globalThis.currentTime = f / SR;
      proc.process([], [[bl, br]]);
      L.set(bl, f);
      R.set(br, f);
      let a = 0;
      for (const v of proc.voices) if (v.on) a += 1;
      if (a > maxVoices) maxVoices = a;
      if (onBlock) onBlock(f, proc);
    }
    const cu = process.cpuUsage(c0);
    return { L, R, maxVoices, cpuUsPerBlock: (cu.user + cu.system) / (n / BLOCK) };
  } finally {
    Math.random = real;
  }
}

/* ---------------- l'arpegiateur (voyager/arp.ts, sans horloge) ---------------- */

const ACCENT = [1, 0.8, 0.92, 1.12];
/** Le tempo et le swing du style MM-RYTM du meme nom (state/factory.ts) ; INIT : le tempo de depart. */
const STYLE = {
  INIT: [130, 0],
  ACID: [130, 0.12],
  'DARK DISCO': [118, 0.18],
  'INDIE DANCE': [122, 0.08],
  MINIMAL: [125, 0.45],
  ROLLING: [138, 0],
  TECHNO: [132, 0.06],
  HOUSE: [124, 0.5],
  ELECTRO: [128, 0.1],
  EBM: [124, 0],
  ITALO: [120, 0],
  'NIGHT DRIVE': [118, 0.18],
  'HYPNO LOOP': [124, 0.3],
  'INDIE PULSE': [122, 0.08],
  'ACID NIGHT': [128, 0.12],
};

function arpNotes(M, knobs, prog, bars, bpm, swingV, seed) {
  const { params: P, chords: C, seq: Q } = M;
  const rnd = mulberry32(seed ^ 0x5eed);
  const t0 = 0.05;
  const stepDur = 60 / bpm / 4;
  const spn = P.stepsPerNote(knobs.rate);
  const interval = spn * stepDur;
  const per = spn < 1 ? 2 : 1;
  const shift = 12 * P.octaveShift(knobs.octave);
  const mode = P.stepIndex('mode', knobs.mode);
  const notes = [];
  const beats = [];
  let chord = null;
  let noteIdx = 0;
  let last = null;
  for (let bar = 0; bar < bars; bar += 1) {
    const c = prog[bar % prog.length];
    if (c !== chord) noteIdx = 0;
    chord = c;
    const pool = Q.poolSteps(chord, knobs, mode === 3 ? 0 : mode);
    for (let step = 0; step < 16; step += 1) {
      const time = t0 + (bar * 16 + step) * stepDur;
      beats.push({ time, beat: (bar * 16 + step) / 4, bpm, run: bar === 0 && step === 0 });
      if (spn > 1 && step % spn !== 0) continue;
      if (pool.length === 0) continue;
      const swing = (step & 1) === 1 ? swingV * (1 / 3) * stepDur : 0;
      for (let k = 0; k < per; k += 1) {
        const when = time + swing + k * interval;
        const pos = noteIdx % pool.length;
        noteIdx += 1;
        let d = pool[pos];
        if (mode === 3) {
          let pick = Math.floor(rnd() * pool.length);
          if (pool.length > 1 && C.degreeMidi(chord, pool[pick]) + shift === last) pick = (pick + 1) % pool.length;
          d = pool[pick];
        }
        const midi = C.degreeMidi(chord, d) + shift;
        const human = 1 + (rnd() - 0.5) * 0.16 * knobs.drift;
        const accent = Math.max(0.3, (1 + (ACCENT[step % 4] * (k === 1 ? 0.85 : 1) - 1) * 2 * knobs.accent) * human);
        const gate = Math.max(0.005, P.gateFrac(knobs.gate) * interval);
        notes.push({ midi, time: when, gate, accent, from: last });
        last = midi;
      }
    }
  }
  return { notes, beats, seconds: t0 + (bars * 16 * stepDur) + 1.5 };
}

/* ---------------- les patchs ---------------- */

/** Les reglages ajoutes depuis le debut du banc (2026-10-22) ramenes a leur valeur d'heritage : le son d'un patch garde avant eux. */
function legacyOf(M, knobs) {
  const out = { ...knobs };
  for (const k of M.params.VOY_KNOBS) if (k.legacy !== undefined) out[k.id] = k.legacy;
  return out;
}

function patches(M) {
  const P = M.params;
  const defaults = Object.fromEntries(P.VOY_KNOBS.map((k) => [k.id, k.def]));
  const list = [{ name: 'INIT', knobs: defaults, prog: [0, 1, 2, 0] }];
  for (const f of M.factory.arpFactory(16)) list.push({ name: f.name, knobs: f.data.knobs, prog: f.data.prog });
  const has = (id) => P.VOY_KNOB_IDS.includes(id);
  // Les cas extremes des reglages du 2026-10-22 (absents d'un moteur d'avant : ils n'y entrent pas)
  if (has('stack')) list.push({ name: 'X STACK FULL', knobs: { ...defaults, stack: 1, wide: 0, glue: 0 }, prog: [0, 1, 2, 0] });
  if (has('wide')) list.push({ name: 'X WIDE FULL', knobs: { ...defaults, stack: 0, wide: 1, glue: 0 }, prog: [0, 1, 2, 0] });
  if (has('stack') && has('wide') && has('glue')) list.push({ name: 'X ALL FULL', knobs: { ...defaults, stack: 1, wide: 1, glue: 1, sync: 1, fm: 0.4 }, prog: [0, 1, 2, 0] });
  // Le vrai relachement (message noteOff, 2026-10-22) : un accord tenu sans fin, relache note a note (a une heure dite,
  // tout de suite), et une note dont le relachement arrive avant son depart
  if (has('stack')) list.push({ name: 'X HELD NOTE OFF', knobs: { ...defaults }, prog: [0], held: true });
  // Les memes patchs avec les reglages ajoutes a leur valeur d'heritage : le son d'avant (--against)
  const legacy = list.filter((p) => !p.name.startsWith('X ')).map((p) => ({ name: `LEGACY ${p.name}`, knobs: legacyOf(M, p.knobs), prog: p.prog, legacy: true }));
  return [...list, ...legacy];
}

/* ---------------- les mesures ---------------- */

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const a = i + k;
        const b = a + len / 2;
        const br = re[b] * cr - im[b] * ci;
        const bi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - br;
        im[b] = im[a] - bi;
        re[a] += br;
        im[a] += bi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

const db = (x) => 20 * Math.log10(Math.max(1e-12, x));
const r2 = (x) => Math.round(x * 100) / 100;

function metrics(L, R) {
  const n = L.length;
  const a = Math.round(0.05 * SR);
  let peak = 0;
  let sm = 0;
  let ss = 0;
  let mean = 0;
  let bad = 0;
  for (let i = 0; i < n; i += 1) {
    const l = L[i];
    const r = R[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) bad += 1;
    const al = Math.abs(l);
    const ar = Math.abs(r);
    if (al > peak) peak = al;
    if (ar > peak) peak = ar;
    if (i < a) continue;
    const m = 0.5 * (l + r);
    const s = 0.5 * (l - r);
    sm += m * m;
    ss += s * s;
    mean += m;
  }
  const cnt = Math.max(1, n - a);
  // Le centroide du milieu : spectres de 32768 points mis bout a bout (fenetre de Hann)
  const N = 32768;
  const acc = new Float64Array(N / 2);
  for (let s = a; s + N <= n; s += N / 2) {
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let i = 0; i < N; i += 1) re[i] = 0.5 * (L[s + i] + R[s + i]) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    fft(re, im);
    for (let i = 0; i < N / 2; i += 1) acc[i] += re[i] * re[i] + im[i] * im[i];
  }
  let tot = 0;
  let cen = 0;
  for (let i = 1; i < N / 2; i += 1) {
    const f = (i * SR) / N;
    if (f < 20 || f > 20000) continue;
    tot += acc[i];
    cen += acc[i] * f;
  }
  const rms = Math.sqrt(sm / cnt);
  const hash = createHash('sha256');
  hash.update(Buffer.from(L.buffer, L.byteOffset, L.byteLength));
  hash.update(Buffer.from(R.buffer, R.byteOffset, R.byteLength));
  return {
    peakDb: r2(db(peak)),
    rmsDb: r2(db(rms)),
    crestDb: r2(db(peak) - db(rms)),
    centroidHz: tot > 0 ? Math.round(cen / tot) : 0,
    sideDb: r2(db(Math.sqrt(ss / cnt)) - db(rms)),
    dc: Number((mean / cnt).toExponential(2)),
    nonFinite: bad,
    sha256: hash.digest('hex').slice(0, 32),
  };
}

async function writeWav(file, L, R) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 8);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 8, 28);
  buf.writeUInt16LE(8, 32);
  buf.writeUInt16LE(32, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i += 1) {
    buf.writeFloatLE(L[i], 44 + i * 8);
    buf.writeFloatLE(R[i], 48 + i * 8);
  }
  await writeFile(file, buf);
}

const fileName = (name) => name.replace(/[^A-Z0-9]+/gi, '_').replace(/^_|_$/g, '');

/** Les options du moteur pour un patch : ses reglages en unites physiques (voyager/params.ts engineParams), le tempo, les notes. */
/** X HELD NOTE OFF : les notes sans fin et leurs relachements (des messages a leur instant, comme ceux du port). */
function heldNotes() {
  const n = (midi, time) => ({ midi, time, gate: Infinity, accent: 1, from: null });
  const off = (at, midi, time) => ({ at, msg: time === undefined ? { type: 'noteOff', midi } : { type: 'noteOff', midi, time } });
  return {
    notes: [n(54, 0.05), n(57, 0.05), n(61, 0.05), n(66, 1.6)],
    timeline: [off(0.6, 54, 0.62), off(0.9, 57), off(1.0, 66, 2.0), off(1.2, 61, 1.25)],
    beats: [],
    seconds: 3.5,
  };
}

function engineOpts(M, p, extra = {}) {
  const [bpm, swing] = STYLE[p.name.replace(/^LEGACY /, '')] ?? STYLE.INIT;
  const held = p.held ? heldNotes() : null;
  const { notes, beats, seconds } = held ?? arpNotes(M, p.knobs, p.prog, BARS, bpm, swing, SEED);
  // outLevel : le gain de VOLUME apres le moteur, pour son ecreteur de sortie (audio/synth.ts volGain : VOLUME au carre x
  // 0.66, DELAY et REVERB repris)
  const k = p.knobs;
  const outLevel = (k.volume * k.volume * 0.66) / (1 + 0.35 * k.delay + 0.5 * k.reverb);
  const params = { ...M.params.engineParams(p.knobs), bpm, outLevel };
  return { opts: { params, notes, beats, ...(held ? { timeline: held.timeline } : {}), os: OS, maxVoices: VOICES, maxStack: STACK_MAX, wideVoices: WIDE_VOICES, seed: SEED, ...extra }, seconds };
}

/* ---------------- la parite avec le navigateur (--browser) ---------------- */

function playwright() {
  const require = createRequire(import.meta.url);
  for (const id of [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(Boolean)) {
    try {
      return require(id);
    } catch {
      /* le suivant */
    }
  }
  return null;
}

async function browserRender(page, src, opts, seconds) {
  const b64 = await page.evaluate(
    async ({ src, opts, seconds, sr }) => {
      const oc = new OfflineAudioContext(2, Math.ceil((seconds * sr) / 128) * 128, sr);
      const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
      await oc.audioWorklet.addModule(url);
      const node = new AudioWorkletNode(oc, 'mm-voyager', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: opts });
      node.connect(oc.destination);
      const buf = await oc.startRendering();
      const n = buf.length;
      const f = new Float32Array(2 * n);
      f.set(buf.getChannelData(0), 0);
      f.set(buf.getChannelData(1), n);
      const u8 = new Uint8Array(f.buffer);
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    },
    { src, opts, seconds, sr: SR }
  );
  const buf = Buffer.from(b64, 'base64');
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const n = f.length / 2;
  return { L: f.slice(0, n), R: f.slice(n) };
}

/** L'ecart entre deux rendus : la part d'echantillons identiques, le plus grand ecart (et en dB). */
function diff(a, b) {
  const n = Math.min(a.L.length, b.L.length);
  let same = 0;
  let max = 0;
  for (let i = 0; i < n; i += 1) {
    for (const [x, y] of [
      [a.L[i], b.L[i]],
      [a.R[i], b.R[i]],
    ]) {
      const d = Math.abs(x - y);
      if (d === 0) same += 1;
      if (d > max) max = d;
    }
  }
  return { identicalPct: Math.round((1e6 * same) / (2 * n)) / 1e4, maxAbsDiff: max, maxDiffDb: max > 0 ? r2(db(max)) : null };
}

/* ---------------- le calcul (--cpu) ---------------- */

function cpuTable(M, Proc) {
  const D = Object.fromEntries(M.params.VOY_KNOBS.map((k) => [k.id, k.def]));
  const cases = [
    ['plain', {}],
    ['STACK', { stack: 0.5 }],
    ['WIDE', { wide: 0.6 }],
    ['GLUE', { glue: 0.5 }],
    ['STACK+WIDE+GLUE', { stack: 0.5, wide: 0.6, glue: 0.5 }],
  ].filter(([, x]) => Object.keys(x).every((id) => M.params.VOY_KNOB_IDS.includes(id)));
  const run = (knobs, nv) => {
    const params = { ...M.params.engineParams(knobs), bpm: 130, aS: 1 };
    const notes = Array.from({ length: nv }, (_, i) => ({ midi: 54 + i * 3, time: 0, gate: 100, accent: 1, from: null }));
    let best = Infinity;
    for (let k = 0; k < 3; k += 1) best = Math.min(best, render(Proc, { params, notes, os: OS, maxVoices: VOICES, maxStack: STACK_MAX, wideVoices: WIDE_VOICES, seed: SEED }, 1.5).cpuUsPerBlock);
    return best;
  };
  run(D, 4);
  console.log(`calcul par bloc de 128 (us, temps CPU, le meilleur de 3), x${OS}, ${VOICES} voix, STACK ${STACK_MAX}, WIDE ${WIDE_VOICES} voix ; le temps reel : ${Math.round((BLOCK / SR) * 1e6)} us`);
  for (const [name, x] of cases) {
    const row = [1, 4, 8, 12].filter((nv) => nv <= VOICES).map((nv) => `${nv}v ${run({ ...D, ...x }, nv).toFixed(0)}`);
    console.log(`  ${name.padEnd(16)} ${row.join(' | ')}`);
  }
}

/* ---------------- le banc ---------------- */

async function main() {
  const M = await siteModules();
  const Proc = await engineOf(WORKLET);
  if (flag('--cpu')) {
    cpuTable(M, Proc);
    return;
  }
  const Other = AGAINST ? await engineOf(path.resolve(AGAINST)) : null;
  const tag = PHONE ? 'phone' : `os${OS}`;
  const dir = path.join(OUT, tag);
  await mkdir(dir, { recursive: true });
  let list = patches(M);
  if (ONLY.length) list = list.filter((p) => ONLY.includes(p.name) || ONLY.includes(p.name.replace(/^LEGACY /, '')));
  if (Other) list = list.filter((p) => p.legacy);
  const res = {};
  let pw = null;
  let browser = null;
  let page = null;
  let blank = null;
  if (flag('--browser')) {
    pw = playwright();
    if (!pw) console.log('--browser : Playwright absent (npm i --no-save playwright), la parite est sautee');
    else {
      const linux = process.platform === 'linux';
      browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--mute-audio', ...(linux ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : [])] });
      // Une page servie par 127.0.0.1 (un contexte sur : l'AudioWorklet n'existe pas sur about:blank)
      blank = httpServer((_q, r) => {
        r.setHeader('content-type', 'text/html');
        r.end('<!doctype html><title>arp-bench</title>');
      });
      await new Promise((ok) => blank.listen(0, '127.0.0.1', ok));
      page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${blank.address().port}/`);
    }
  }
  const src = page ? await readFile(WORKLET, 'utf8') : '';
  try {
    for (const p of list) {
      const { opts, seconds } = engineOpts(M, p);
      const r = render(Proc, opts, seconds);
      const m = { ...metrics(r.L, r.R), maxVoices: r.maxVoices, cpuUsPerBlock: Math.round(r.cpuUsPerBlock) };
      if (Other) m.against = diff(r, render(Other, opts, seconds));
      if (page) m.browser = diff(r, await browserRender(page, src, opts, seconds));
      res[p.name] = m;
      if (!NO_WAV) await writeWav(path.join(dir, `${fileName(p.name)}.wav`), r.L, r.R);
      const extra = [m.against ? `against ${m.against.identicalPct}% identiques, ecart max ${m.against.maxAbsDiff}` : '', m.browser ? `navigateur ${m.browser.identicalPct}% identiques, ecart max ${m.browser.maxAbsDiff}${m.browser.maxDiffDb !== null ? ` (${m.browser.maxDiffDb} dB)` : ''}` : ''].filter(Boolean).join(' ; ');
      console.log(`${p.name.padEnd(22)} crete ${String(m.peakDb).padStart(6)} dB  efficace ${String(m.rmsDb).padStart(6)} dB  centroide ${String(m.centroidHz).padStart(5)} Hz  cote ${String(m.sideDb).padStart(6)} dB  ${m.cpuUsPerBlock} us${extra ? '  ' + extra : ''}`);
    }
  } finally {
    if (browser) await browser.close();
    if (blank) blank.close();
  }
  const meta = { date: new Date().toISOString(), seed: SEED, bars: BARS, os: OS, voices: VOICES, maxStack: STACK_MAX, wideVoices: WIDE_VOICES, node: process.version };
  await writeFile(path.join(dir, 'metrics.json'), `${JSON.stringify({ meta, res }, null, 1)}\n`);
  console.log(`\n${list.length} rendus dans ${path.relative(ROOT, dir)}/`);
  // Non-regression : les empreintes et les mesures gardees
  if (flag('--update')) {
    let golden = {};
    try {
      golden = JSON.parse(await readFile(GOLDEN, 'utf8'));
    } catch {
      /* un premier fichier */
    }
    golden[tag] = { meta: { seed: SEED, bars: BARS, os: OS, voices: VOICES, maxStack: STACK_MAX, wideVoices: WIDE_VOICES }, res: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { sha256: v.sha256, peakDb: v.peakDb, rmsDb: v.rmsDb, centroidHz: v.centroidHz, sideDb: v.sideDb }])) };
    await writeFile(GOLDEN, `${JSON.stringify(golden, null, 1)}\n`);
    console.log(`${path.relative(ROOT, GOLDEN)} mis a jour (${tag})`);
  }
  if (flag('--check')) {
    const golden = JSON.parse(await readFile(GOLDEN, 'utf8'))[tag];
    if (!golden) throw new Error(`pas de reference ${tag} dans ${GOLDEN} (--update)`);
    let changed = 0;
    for (const [name, m] of Object.entries(res)) {
      const g = golden.res[name];
      if (!g) {
        console.log(`  ${name} : nouveau (pas de reference)`);
        continue;
      }
      if (g.sha256 === m.sha256) continue;
      // Une empreinte qui differe : un autre Node arrondit peut-etre autrement ; les mesures disent si le son a bouge
      const moved = Math.abs(g.peakDb - m.peakDb) > 0.05 || Math.abs(g.rmsDb - m.rmsDb) > 0.05 || Math.abs(g.centroidHz - m.centroidHz) > 5 || Math.abs(g.sideDb - m.sideDb) > 0.1;
      if (moved) changed += 1;
      console.log(`  ${name} : ${moved ? 'LE SON A CHANGE' : 'empreinte differente, mesures identiques (arrondi)'} (crete ${g.peakDb} -> ${m.peakDb}, efficace ${g.rmsDb} -> ${m.rmsDb}, centroide ${g.centroidHz} -> ${m.centroidHz})`);
    }
    console.log(changed ? `\n${changed} patch(s) sonnent autrement que la reference` : '\naucun changement de son');
    if (changed) process.exitCode = 1;
  }
  if (Other) {
    const off = Object.entries(res).filter(([, m]) => m.against.maxAbsDiff !== 0);
    console.log(off.length ? `\n${off.length} patch(s) different de ${AGAINST}` : `\nidentiques au bit pres a ${AGAINST}`);
    if (off.length) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
