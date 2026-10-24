#!/usr/bin/env node
/**
 * Les ecoutes A/B pour Mika (2026-10-23, S22, Mika : "Pourrais-tu controler ARP pour que le son soit d'extreme bonne
 * qualite ?! entre Monark et un synth analog Moog Voyager et un Korg Ms10") : la chaine complete du site (moteur, chorus,
 * BASS MONO, DELAY et TAPE, REVERB : audio/synth.ts renderSynthOffline) dans un OfflineAudioContext de Chromium lance
 * avec --mute-audio, la page ouverte avec ?mute=1 : rien ne sort des enceintes. Les notes (8 mesures, la meme graine)
 * sont calculees ici, une fois, et envoyees telles quelles au site d'avant comme a celui d'aujourd'hui.
 *
 *   node scripts/arp-quality/ab.mjs --url http://127.0.0.1:5961 --tag after --out <dossier> --set factory
 *   --set factory | proposals | demos (plusieurs : factory,demos) ; --only "ACID,MS SCREAM" ; --os 4 (2 : le telephone,
 *   avec ses limites : 8 voix, STACK 2, WIDE 4 ; 2026-10-24)
 *
 * Chaque rendu : un WAV 24 bits 48 kHz stereo et ses mesures (sonie ponderee K, crete, centroide) dans
 * <dossier>/manifest-<tag>.json. Les propositions sont calees en sonie sur le preset d'aujourd'hui (l'ecoute juge le
 * grain, pas le niveau) ; le gain applique est note.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { flag, opt, siteModules, writeWav, mulberry32 } from './lib.mjs';
import { db, loudness, spectrum } from './ana.mjs';
import { FACTORY_LOAD, FACTORY_UPDATES, INIT_LOADS, NEW_PRESETS, proposedKnobs } from './proposals.mjs';

const URL = opt('--url', 'http://127.0.0.1:5961');
const TAG = opt('--tag', 'after');
const OUTDIR = path.resolve(opt('--out', 'scripts/output/arp-ab'));
const SETS = opt('--set', 'factory').split(',');
const ONLY = opt('--only', '').split(',').filter(Boolean);
const OS = Number(opt('--os', 4));
const BARS = Number(opt('--bars', 8));
const SEED = 808;
const SR = 48000;
mkdirSync(OUTDIR, { recursive: true });

/* ---------------- l'arpegiateur (le meme calcul que scripts/arp-bench.mjs arpNotes) ---------------- */

const ACCENT = [1, 0.8, 0.92, 1.12];
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
        notes.push([midi, when, gate, accent]);
        last = midi;
      }
    }
  }
  return { notes, beats, seconds: t0 + bars * 16 * stepDur + 3 };
}

/* ---------------- les rendus a faire ---------------- */

const M = await siteModules();
const DEF = Object.fromEntries(M.params.VOY_KNOBS.map((k) => [k.id, k.def]));
const factory = M.factory.arpFactory(16).map((f) => ({ name: f.name, knobs: { ...DEF, ...f.data.knobs }, prog: f.data.prog }));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const items = [];
const add = (it) => {
  if (ONLY.length && !ONLY.includes(it.name) && !ONLY.includes(it.file)) return;
  items.push(it);
};
const style = (name) => STYLE[name] ?? STYLE.INIT;
if (SETS.includes('factory')) {
  add({ file: `00-init-${TAG}`, name: 'INIT', knobs: DEF, prog: [0, 1, 2, 0], bpm: STYLE.INIT[0], swing: 0, kind: 'factory' });
  factory.forEach((f, i) => add({ file: `${String(i + 1).padStart(2, '0')}-${slug(f.name)}-${TAG}`, name: f.name, knobs: f.knobs, prog: f.prog, bpm: style(f.name)[0], swing: style(f.name)[1], kind: 'factory' }));
}
if (SETS.includes('proposals')) {
  for (const l of INIT_LOADS) add({ file: `P00-init-load-${String(Math.round(l * 100)).padStart(2, '0')}`, name: `INIT LOAD ${l}`, knobs: { ...DEF, load: l }, prog: [0, 1, 2, 0], bpm: STYLE.INIT[0], swing: 0, kind: 'proposal', match: `00-init-after` });
  factory.forEach((f, i) => add({ file: `P${String(i + 1).padStart(2, '0')}-${slug(f.name)}-proposed`, name: `${f.name} (proposed)`, knobs: proposedKnobs(f.name, f.knobs), prog: f.prog, bpm: style(f.name)[0], swing: style(f.name)[1], kind: 'proposal', match: `${String(i + 1).padStart(2, '0')}-${slug(f.name)}-after`, change: { load: FACTORY_LOAD[f.name] ?? 0.25, ...(FACTORY_UPDATES[f.name] ?? {}) } }));
  NEW_PRESETS.forEach((p, i) => add({ file: `N${i + 1}-${slug(p.name)}`, name: p.name, knobs: { ...DEF, volume: 0.75, ...p.knobs }, prog: p.prog, bpm: p.bpm, swing: p.swing, kind: 'new', style: p.style }));
}
if (SETS.includes('demos')) {
  const base = { ...DEF, delay: 0.25, reverb: 0.15 };
  const bass = { ...base, rate: 2 / 3, range: 0, notes: 4 / 8, gate: 0.4, wave1: 0.4, osc2: 0, cutoff: 0.32, res: 0.55, envAmt: 0.6, fD: 0.3, fS: 0.1, aD: 0.35, aS: 0.3, octave: 0.25, accFlt: 1, accent: 0.7 };
  // LE POIDS DU VOYAGER : une basse d'arpege MOOG, LOAD 0 puis 0.6 (2026-10-24 : a 0.35, l'ecart ne se mesurait pas a
  // sonie egale, QC-CH-3) ; puis SPACE (les deux filtres)
  add({ file: 'D1a-voyager-weight-load-0', name: 'D1a', knobs: { ...bass, load: 0 }, prog: [0, 4], bpm: 122, swing: 0.08, kind: 'demo' });
  add({ file: 'D1b-voyager-weight-load-60', name: 'D1b', knobs: { ...bass, load: 0.6 }, prog: [0, 4], bpm: 122, swing: 0.08, kind: 'demo', match: 'D1a-voyager-weight-load-0' });
  add({ file: 'D1c-voyager-space-50', name: 'D1c', knobs: { ...base, rate: 1 / 3, range: 0.5, gate: 0.55, wave1: 0.4, wave2: 0.75, osc2: 0.6, cutoff: 0.45, res: 0.55, envAmt: 0.35, aA: 0.05, aD: 0.55, aS: 0.6, aR: 0.45, space: 0.5, load: 0.15, chord: 0.5, chorus: 0 }, prog: [0, 5, 2, 1], bpm: 122, swing: 0.08, kind: 'demo' });
  // LOAD COMME SUR MONARK (2026-10-24 : pas de boucle FEEDBACK, retiree en S13) : MONARK DRIVE, LOAD 0 puis LOAD 0.62
  const md = NEW_PRESETS.find((p) => p.name === 'MONARK DRIVE');
  add({ file: 'D2a-monark-drive-load-0', name: 'D2a', knobs: { ...DEF, volume: 0.75, ...md.knobs, load: 0 }, prog: md.prog, bpm: md.bpm, swing: md.swing, kind: 'demo' });
  add({ file: 'D2b-monark-drive-load-62', name: 'D2b', knobs: { ...DEF, volume: 0.75, ...md.knobs }, prog: md.prog, bpm: md.bpm, swing: md.swing, kind: 'demo', match: 'D2a-monark-drive-load-0' });
  // LE CRI DU MS-10 : MS SCREAM en MOOG puis en MS-10
  const ms = NEW_PRESETS.find((p) => p.name === 'MS SCREAM');
  add({ file: 'D3a-scream-in-moog', name: 'D3a', knobs: { ...DEF, volume: 0.75, ...ms.knobs, fmode: 0 }, prog: ms.prog, bpm: ms.bpm, swing: ms.swing, kind: 'demo' });
  add({ file: 'D3b-scream-in-ms10', name: 'D3b', knobs: { ...DEF, volume: 0.75, ...ms.knobs }, prog: ms.prog, bpm: ms.bpm, swing: ms.swing, kind: 'demo', match: 'D3a-scream-in-moog' });
  // LES ENVELOPPES : les accents dans LOAD et le filtre (ACC FILTER 0 puis 1), puis le contour retourne (POLARITY NEG)
  const env = { ...bass, load: 0.5, res: 0.65, cutoff: 0.4, envAmt: 0.65, fD: 0.25, accent: 0.85 };
  add({ file: 'D4a-envelopes-accents-off', name: 'D4a', knobs: { ...env, accFlt: 0 }, prog: [0, 1], bpm: 124, swing: 0.1, kind: 'demo' });
  add({ file: 'D4b-envelopes-accents-on', name: 'D4b', knobs: { ...env, accFlt: 1 }, prog: [0, 1], bpm: 124, swing: 0.1, kind: 'demo', match: 'D4a-envelopes-accents-off' });
  add({ file: 'D4c-envelopes-polarity-neg', name: 'D4c', knobs: { ...env, accFlt: 1, fpol: 1, cutoff: 0.7, fA: 0.25, fD: 0.45 }, prog: [0, 1], bpm: 124, swing: 0.1, kind: 'demo', match: 'D4a-envelopes-accents-off' });
  // LA VIE DES OSCILLATEURS (avant / apres, les deux sites) : SYNC qui balaie, le triangle tout en haut, OVERDRIVE
  // SYNC : OSC 2 balaye de +12 a +30 demi-tons sur les 8 mesures (un message toutes les 5 ms, comme un potard)
  const sweep = (seconds) => Array.from({ length: Math.floor((seconds - 3) / 0.005) }, (_, i) => ({ at: 0.05 + i * 0.005, msg: { type: 'params', params: { tune2: 12 + (18 * i * 0.005) / (seconds - 3.05) } } }));
  add({ file: `D5a-osc-sync-sweep-${TAG}`, name: 'D5a', knobs: { ...base, sync: 1, wave1: 0.4, wave2: 0.5, osc2: 0.7, range2: 0.8, semi2: 0.5, cutoff: 0.85, res: 0.2, envAmt: 0.3, octave: 0.5 }, prog: [0, 1, 2, 0], bpm: 124, swing: 0, kind: 'demo', both: true, timeline: sweep });
  add({ file: `D5b-osc-triangle-high-${TAG}`, name: 'D5b', knobs: { ...base, wave1: 0.2, osc2: 0, octave: 1, range1: 1, cutoff: 1, envAmt: 0, res: 0, aD: 0.3, aS: 0.3 }, prog: [0, 1, 2, 0], bpm: 124, swing: 0, kind: 'demo', both: true });
  add({ file: `D5c-osc-overdrive-${TAG}`, name: 'D5c', knobs: { ...base, dist: 0.6, octave: 0.75, cutoff: 0.8, envAmt: 0.4, res: 0.3 }, prog: [0, 1, 2, 0], bpm: 124, swing: 0, kind: 'demo', both: true });
}
const todo = TAG === 'before' ? items.filter((it) => it.kind === 'factory' || it.both) : items;
console.log(`${todo.length} rendus (${TAG}, x${OS}) -> ${OUTDIR}`);

/* ---------------- le navigateur ---------------- */

const require = createRequire(import.meta.url);
let pw = null;
for (const id of [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(Boolean)) {
  try {
    pw = require(id);
    break;
  } catch {
    /* le suivant */
  }
}
if (!pw) throw new Error('Playwright absent (PLAYWRIGHT_MODULE)');
const browser = await pw.chromium.launch({ args: ['--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=user-gesture-required'] });
const manifestFile = path.join(OUTDIR, `manifest-${TAG}.json`);
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
const measure = (L, R) => {
  let pk = 0;
  for (let i = 0; i < L.length; i += 1) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  const M2 = new Float32Array(L.length);
  for (let i = 0; i < L.length; i += 1) M2[i] = 0.5 * (L[i] + R[i]);
  // Le centroide du milieu, spectres de 16384 points mis bout a bout
  let a = 0;
  let b = 0;
  for (let s = 0; s + 16384 <= M2.length; s += 8192) {
    const sp = spectrum(M2, 16384, s);
    for (let k = 1; k < sp.pow.length; k += 1) {
      if (sp.f[k] < 20 || sp.f[k] > 20000) continue;
      a += sp.f[k] * sp.pow[k];
      b += sp.pow[k];
    }
  }
  return { lufs: Math.round(loudness(L, R) * 100) / 100, peakDb: Math.round(db(pk) * 100) / 100, centroidHz: Math.round(a / Math.max(1e-30, b)) };
};
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  page :', String(e).slice(0, 160)));
  await page.goto(`${URL}/studio?mute=1&debug=1`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => !!(window.__v4 && window.__v4.voyager && window.__v4.voyager.synth && window.__v4.voyager.synth.renderOffline), null, { timeout: 180000 });
  const renderIt = async (it, knobs) => {
    const [bpm, swing] = [it.bpm, it.swing];
    const { notes, beats, seconds } = arpNotes(M, knobs, it.prog, BARS, bpm, swing, SEED);
    const timeline = it.timeline ? it.timeline(seconds) : [];
    const b64 = await page.evaluate(
      async ({ seconds, notes, beats, knobs, bpm, os, seed, timeline, phone }) => {
        // 2026-10-24 (controle qualite F4) : au telephone, ses limites aussi (8 voix, STACK 2, WIDE 4)
        const lim = phone ? { maxVoices: 8, maxStack: 2, wideVoices: 4 } : {};
        const [L, R] = await window.__v4.voyager.synth.renderOffline({ seconds, notes, beats, params: knobs, bpm, os, seed, timeline, ...lim });
        const f = new Float32Array(2 * L.length);
        f.set(L, 0);
        f.set(R, L.length);
        let s = '';
        const u8 = new Uint8Array(f.buffer);
        for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
        return btoa(s);
      },
      { seconds, notes, beats, knobs, bpm, os: OS, seed: SEED, timeline, phone: OS === 2 }
    );
    const buf = Buffer.from(b64, 'base64');
    const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const n = f.length / 2;
    return { L: f.slice(0, n), R: f.slice(n), notes: notes.length };
  };
  for (const it of todo) {
    const t0 = Date.now();
    let knobs = it.knobs;
    let r = await renderIt(it, knobs);
    let m = measure(r.L, r.R);
    let gain = 1;
    // Un preset nouveau : son VOLUME cale sur la sonie mediane des presets d'usine (manifest-after), une reprise
    if (it.kind === 'new') {
      const fac = Object.values(manifest).filter((x) => x.kind === 'factory').map((x) => x.lufs).sort((p, q) => p - q);
      if (fac.length) {
        const target = fac[Math.floor(fac.length / 2)];
        const v = Math.min(1, knobs.volume * Math.pow(10, (target - m.lufs) / 40));
        knobs = { ...knobs, volume: Math.round(v * 1000) / 1000 };
        r = await renderIt(it, knobs);
        m = measure(r.L, r.R);
      }
    }
    // Une proposition : calee en sonie sur sa reference (le gain note : la retouche de VOLUME qu'il faudrait)
    if (it.match && manifest[it.match]) {
      gain = Math.pow(10, (manifest[it.match].lufs - m.lufs) / 20);
      for (let i = 0; i < r.L.length; i += 1) {
        r.L[i] *= gain;
        r.R[i] *= gain;
      }
      m = measure(r.L, r.R);
    }
    writeWav(path.join(OUTDIR, `${it.file}.wav`), r.L, r.R, { bits: 24 });
    manifest[it.file] = { name: it.name, kind: it.kind, os: OS, ...m, notes: r.notes, bpm: it.bpm, seconds: Math.round((r.L.length / SR) * 10) / 10, ...(it.match ? { matchedTo: it.match, gainDb: Math.round(20 * Math.log10(gain) * 100) / 100 } : {}), ...(it.kind === 'new' ? { volume: knobs.volume, style: it.style } : {}), ...(it.change ? { change: it.change } : {}) };
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 1)}\n`);
    console.log(`  ${it.file.padEnd(36)} ${m.lufs} LUFS  crete ${m.peakDb} dBFS  centroide ${m.centroidHz} Hz  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
} finally {
  await browser.close();
}
