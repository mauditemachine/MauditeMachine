// Rendu de reference du moteur MM-ARP : fait tourner le VRAI src/v4/audio/moog.worklet.js (celui du site, charge tel
// quel comme scripts/arp-bench.mjs : sampleRate, currentFrame, registerProcessor et le port fournis) sur
// tests/voyager_cases.json, et ecrit pour chaque cas son rendu en float32 brut (L puis R) dans <out>/<n>.f32, plus :
//   <out>/manifest.json  les cas resolus (lisible)
//   <out>/cases.txt      les memes, pour tests/voyager_compare.cpp (reglages moteur complets, notes, ancres, messages)
//   <out>/tables.f64     les tables du module JS (LNC, K35_T, K35_S, demi-bandes) pour verifier la libm du C++
//   <out>/mathprobe.f64  Math.sin/cos/tan/exp/log/pow/tanh sur des entrees du moteur (diagnostic libm)
// Usage : node plugin/mm-arp/tests/voyager-ref.mjs <dossier-de-sortie> [--only NOM,NOM]
// Les potards, presets d'usine et l'arpegiateur sont ceux du site (voyager/params.ts, chords.ts, seq.ts, et la
// partie MM-ARP de state/factory.ts), copies dans le dossier de sortie et lances avec --experimental-strip-types :
// aucune dependance npm. Rien ne sort des enceintes : aucun AudioContext, des tableaux seulement.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const out = resolve(process.argv[2] ?? join(here, '.voyager-ref'));
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > 0 ? process.argv[onlyArg + 1] : '';
const src = join(out, 'src');
mkdirSync(src, { recursive: true });

const fix = (code) => code.replace(/from '\.\/(params|chords|seq)'/g, "from './$1.ts'");
for (const f of ['params', 'chords', 'seq']) writeFileSync(join(src, `${f}.ts`), fix(readFileSync(join(repo, 'src/v4/voyager', `${f}.ts`), 'utf8')));
// La partie MM-ARP de state/factory.ts (ses crans, ARP, arpFactory) : elle ne depend que de voyager/params.ts
{
  const fac = readFileSync(join(repo, 'src/v4/state/factory.ts'), 'utf8');
  const a = fac.indexOf('/* ---------------- MM-ARP ---------------- */');
  const b = fac.indexOf('/* ---------------- MM-BASS ---------------- */');
  if (a < 0 || b < a) throw new Error('state/factory.ts : la partie MM-ARP est introuvable');
  writeFileSync(join(src, 'factory_arp.ts'), `import { VOY_KNOB_IDS, voyKnob, type VoyKnobId } from './params.ts';\n${fac.slice(a, b)}\n`);
}

const runner = String.raw`
import { readFileSync, writeFileSync } from 'node:fs';
import * as P from './params.ts';
import * as C from './chords.ts';
import * as Q from './seq.ts';
import { arpFactory } from './factory_arp.ts';
const [casesPath, workletPath, outDir, only] = process.argv.slice(2);
const SR = 48000;
const BLOCK = 128;
const spec = JSON.parse(readFileSync(casesPath, 'utf8'));
const D = spec.defaults;

/* ---- le moteur, tel quel, et ses tables ---- */
const wsrc = readFileSync(workletPath, 'utf8');
const reg = {};
globalThis.sampleRate = SR;
globalThis.currentFrame = 0;
globalThis.currentTime = 0;
class Base { constructor() { this.port = { postMessage() {}, onmessage: null }; } }
const T = new Function('AudioWorkletProcessor', 'registerProcessor', wsrc + '\nreturn { LNC, K35_T, K35_S, h31: halfband(31, 9).h, h63: halfband(63, 8).h, MS_SO, OD_TANH_BIAS };\n//# sourceURL=' + workletPath)(Base, (n, c) => { reg[n] = c; });
const Proc = reg['mm-voyager'];
if (!Proc) throw new Error('pas de processeur mm-voyager');
{
  const parts = [T.LNC, T.K35_T, T.K35_S, T.h31, T.h63, Float64Array.of(T.MS_SO, T.OD_TANH_BIAS)];
  const n = parts.reduce((s, p) => s + p.length, 0);
  const all = new Float64Array(n);
  let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  writeFileSync(outDir + '/tables.f64', Buffer.from(all.buffer));
}
/* ---- la libm de V8, sur des entrees du moteur (diagnostic) ---- */
{
  let s = 12345;
  const r = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
  const rows = [];
  const NP = 20000;
  for (let i = 0; i < NP; i += 1) { const x = r() * 6.3 - 0.1; rows.push(0, x, 0, Math.sin(x)); }
  for (let i = 0; i < NP; i += 1) { const x = r() * 4; rows.push(1, x, 0, Math.cos(x)); }
  for (let i = 0; i < NP; i += 1) { const x = r() * 1.5; rows.push(2, x, 0, Math.tan(x)); }
  for (let i = 0; i < NP; i += 1) { const x = r() * 20 - 15; rows.push(3, x, 0, Math.exp(x)); }
  for (let i = 0; i < NP; i += 1) { const x = r() * 1e4 + 1e-9; rows.push(4, x, 0, Math.log(x)); }
  for (let i = 0; i < NP; i += 1) { const y = r() * 16 - 8; rows.push(5, 2, y, Math.pow(2, y)); }
  for (let i = 0; i < NP; i += 1) { const x = r() * 3; const y = r() * 2 - 1; rows.push(5, x, y, Math.pow(x, y)); }
  for (let i = 0; i < NP; i += 1) { const x = r() * 8 - 4; rows.push(6, x, 0, Math.tanh(x)); }
  writeFileSync(outDir + '/mathprobe.f64', Buffer.from(Float64Array.from(rows).buffer));
}

/* ---- le hasard des notes et l'arpegiateur (scripts/arp-bench.mjs, copie) ---- */
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
const ACCENT = [1, 0.8, 0.92, 1.12];
const STYLE = {
  INIT: [130, 0], ACID: [130, 0.12], 'DARK DISCO': [118, 0.18], 'INDIE DANCE': [122, 0.08], MINIMAL: [125, 0.45],
  ROLLING: [138, 0], TECHNO: [132, 0.06], HOUSE: [124, 0.5], ELECTRO: [128, 0.1], EBM: [124, 0], ITALO: [120, 0],
  'NIGHT DRIVE': [118, 0.18], 'HYPNO LOOP': [124, 0.3], 'INDIE PULSE': [122, 0.08], 'ACID NIGHT': [128, 0.12],
  'MS SCREAM': [120, 0.1], 'MONARK DRIVE': [118, 0.18], 'SPACE INDIE': [122, 0.08], 'MS HYPNO': [125, 0.3], 'RES PING': [125, 0.45],
};
function arpNotes(knobs, prog, bars, bpm, swingV, seed) {
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

/* ---- les cas ---- */
const num = (v) => (v === 'inf' ? Infinity : v === '-inf' ? -Infinity : v === 'NaN' ? NaN : v);
const numObj = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, num(v)]));
const defaults = Object.fromEntries(P.VOY_KNOBS.map((k) => [k.id, k.def]));
const factory = arpFactory(16);
let list = [];
for (const c of spec.cases) {
  if (c.expand === 'factory') for (const f of factory) list.push({ name: f.name, preset: f.name });
  else list.push(c);
}
if (only) { const set = only.split(',').map((s) => s.trim().toUpperCase()); list = list.filter((c) => set.includes(c.name.toUpperCase())); }

const outLevelOf = (k) => (k.volume * k.volume * 0.66) / (1 + 0.35 * k.delay + 0.5 * k.reverb);
const manifest = [];
const txt = [];
const fmt = (x) => String(x);
list.forEach((c, n) => {
  const f = c.preset ? factory.find((x) => x.name === c.preset) : null;
  if (c.preset && !f) throw new Error('preset inconnu : ' + c.preset);
  const knobs = { ...defaults, ...(f ? f.data.knobs : {}), ...(c.knobs ?? {}) };
  const prog = c.prog ?? (f ? f.data.prog : [0, 1, 2, 0]);
  const [sbpm, sswing] = STYLE[c.preset ?? 'INIT'] ?? STYLE.INIT;
  const bpm = c.bpm ?? sbpm;
  const swing = c.swing ?? sswing;
  const os = c.os ?? D.os;
  const voices = c.voices ?? D.voices;
  const stack = c.stack ?? D.stack;
  const wideVoices = c.wideVoices ?? D.wideVoices;
  const seed = c.seed ?? D.seed;
  let notes;
  let beats;
  let seconds;
  if (Array.isArray(c.notes)) {
    notes = c.notes.map((x) => ({ midi: x.midi, time: x.time, gate: num(x.gate), accent: x.accent ?? 1, from: x.from ?? null }));
    beats = [];
    seconds = c.seconds;
  } else {
    ({ notes, beats, seconds } = arpNotes(knobs, prog, c.bars ?? D.bars, bpm, swing, seed));
    if (c.seconds) seconds = c.seconds;
  }
  const params = { ...P.engineParams(knobs), bpm, outLevel: outLevelOf(knobs), ...numObj(c.engine) };
  // La timeline : les potards s'accumulent d'un message a l'autre (un message 'params' complet, comme le site)
  const timeline = [];
  let cur = { ...knobs };
  for (const m of c.timeline ?? []) {
    if (m.type === 'sweep') {
      for (let t = m.t0, i = 0; t <= m.t1 + 1e-12; i += 1, t = m.t0 + i * m.dt) {
        const u = (t - m.t0) / (m.t1 - m.t0);
        timeline.push({ at: t, msg: { type: 'params', params: { [m.key]: m.from + (m.to - m.from) * u } } });
      }
      continue;
    }
    let msg;
    if (m.type === 'params') {
      if (m.knobs) { cur = { ...cur, ...m.knobs }; msg = { type: 'params', params: { ...P.engineParams(cur), ...numObj(m.engine) } }; }
      else msg = { type: 'params', params: numObj(m.engine) };
    } else if (m.type === 'note') msg = { type: 'note', midi: m.midi, time: m.time, gate: num(m.gate), accent: m.accent ?? 1, from: m.from ?? null };
    else if (m.type === 'beat') msg = { type: 'beat', time: m.time, beat: m.beat, bpm: m.bpm, run: m.run === true };
    else if (m.type === 'noteOff') msg = m.time === undefined ? { type: 'noteOff', midi: m.midi } : { type: 'noteOff', midi: m.midi, time: m.time };
    else if (m.type === 'stop' || m.type === 'cancel') msg = { type: m.type, time: m.time };
    else throw new Error('message inconnu : ' + m.type);
    timeline.push({ at: m.at, msg });
  }
  // Le meme tri que le worklet (stable), pour ecrire cases.txt dans l'ordre ou il les applique
  const tlSorted = timeline.filter((x) => x && x.msg && Number.isFinite(x.at)).sort((a, b) => a.at - b.at);
  const opts = { params, notes, beats, timeline, os, maxVoices: voices, maxStack: stack, wideVoices, seed };
  const frames = Math.ceil((seconds * SR) / BLOCK) * BLOCK;
  // Le rendu, bloc par bloc (currentFrame avance comme dans un AudioWorklet)
  globalThis.currentFrame = 0;
  const proc = new Proc({ processorOptions: opts });
  const L = new Float32Array(frames);
  const R = new Float32Array(frames);
  const bl = new Float32Array(BLOCK);
  const br = new Float32Array(BLOCK);
  let maxV = 0;
  for (let fr = 0; fr < frames; fr += BLOCK) {
    globalThis.currentFrame = fr;
    globalThis.currentTime = fr / SR;
    proc.process([], [[bl, br]]);
    L.set(bl, fr);
    R.set(br, fr);
    let a = 0;
    for (const v of proc.voices) if (v.on) a += 1;
    if (a > maxV) maxV = a;
  }
  const buf = new Float32Array(2 * frames);
  buf.set(L, 0);
  buf.set(R, frames);
  writeFileSync(outDir + '/' + n + '.f32', Buffer.from(buf.buffer));
  let peak = 0;
  for (let i = 0; i < frames; i += 1) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  manifest.push({ n, name: c.name, frames, os, voices, stack, wideVoices, seed, maxVoices: maxV, heals: proc.heals, peak, params, notes: notes.length, beats: beats.length, timeline: tlSorted });
  // cases.txt : une ligne par element, les nombres en String() (le plus court qui relit le meme double)
  txt.push('case ' + n + ' ' + c.name.replace(/\s+/g, '_'));
  txt.push(['opt', os, voices, stack, wideVoices, seed, frames].join(' '));
  for (const [k, v] of Object.entries(params)) txt.push('param ' + k + ' ' + fmt(v));
  for (const x of notes) txt.push(['note', x.time, x.midi, x.gate, x.accent, x.from === null || x.from === undefined ? NaN : x.from].map(fmt).join(' '));
  for (const b of beats) txt.push(['beat', b.time, b.beat, b.bpm, b.run ? 1 : 0].map(fmt).join(' '));
  for (const { at, msg } of tlSorted) {
    const m = msg;
    if (m.type === 'params') txt.push('msg ' + fmt(at) + ' params ' + Object.keys(m.params).length + ' ' + Object.entries(m.params).map(([k, v]) => k + ' ' + fmt(typeof v === 'number' ? v : NaN)).join(' '));
    else if (m.type === 'note') txt.push('msg ' + fmt(at) + ' note ' + [m.time, m.midi, m.gate, m.accent, m.from === null ? NaN : m.from].map(fmt).join(' '));
    else if (m.type === 'beat') txt.push('msg ' + fmt(at) + ' beat ' + [m.time, m.beat, m.bpm, m.run ? 1 : 0].map(fmt).join(' '));
    else if (m.type === 'noteOff') txt.push('msg ' + fmt(at) + ' noteOff ' + fmt(m.midi) + ' ' + fmt(m.time === undefined ? NaN : m.time));
    else txt.push('msg ' + fmt(at) + ' ' + m.type + ' ' + fmt(m.time === undefined ? NaN : m.time));
  }
  txt.push('end');
  console.log(String(n).padStart(3) + '  ' + c.name.padEnd(20) + ' ' + String(frames).padStart(7) + ' frames  crete ' + (20 * Math.log10(Math.max(peak, 1e-12))).toFixed(2) + ' dBFS  voix ' + maxV + '  heals ' + proc.heals);
});
writeFileSync(outDir + '/manifest.json', JSON.stringify(manifest, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v), 1));
writeFileSync(outDir + '/cases.txt', txt.join('\n') + '\n');
console.log('reference : ' + manifest.length + ' cas dans ' + outDir);
`;
writeFileSync(join(src, 'runner.ts'), runner);

execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', join(src, 'runner.ts'), join(here, 'voyager_cases.json'), join(repo, 'src/v4/audio/moog.worklet.js'), out, only], { stdio: 'inherit' });
