#!/usr/bin/env node
/**
 * Les fixtures de migration du MM-RYTM (2026-10-30, la preparation P0 de la refonte Digitakt II,
 * docs/v4/dt2/dt2-master-spec.md 4.7) : des etats localStorage FABRIQUES dans un Chromium headless sur un build de
 * V.5.3 (ecfb30a), par les vraies API du site (window.__v4, ?debug=1), pour les portes de migration de la V.5.9 (les
 * 16 pistes) et d'apres. Aucune donnee privee : tout est invente ici, rien ne vient du navigateur de Mika. Aucun son :
 * --mute-audio, ?mute=1, aucune lecture ni pre-ecoute (les reglages passent par les cibles MIDI et les stores).
 *
 * Ecrit dans scripts/fixtures/ :
 *   rytm-legacy-full.json   le localStorage complet (cles mm.v4.*) apres : un motif edite (pas, P-LOCKS, reglages de
 *                           trig, LFO des voix, scenes, mute du pattern, BPM, FX), les 128 emplacements remplis (des
 *                           verrous, des scenes, des reglages de trig dans certains), le kit KIT_V 4 (couches, potards,
 *                           samples), 5 presets du MM-RYTM (3 gardes par SAVE, 1 d'avant R3 : kit et sounds seuls, 1
 *                           d'avant le 2026-10-18 : les familles hh et rs), un historique UNDO, des assignations MIDI
 *                           (dont rytm:kit:hh et rytm:layer:hh:lev, renommees a la lecture) ; et ce que V.5.3 en lit
 *                           (expect : la capture du motif, les emplacements, les presets, l'UNDO)
 *   rytm-legacy-share.json  3 liens SHARE v1 (le motif d'arrivee, le motif edite, un preset d'usine) : leur code ?b=,
 *                           le beat decode et l'etat que la machine en prend (dataOfBeat), lus par V.5.3
 *
 * Usage : un build de V.5.3 servi (SEO_OFFLINE=1 npx vite build ; python3 -m http.server 4401 -d dist), puis
 *   node scripts/fixtures/make-rytm-legacy.mjs --url http://127.0.0.1:4401
 * Les fixtures sont commitees : ne pas les refaire dans une lane (elles disent ce que V.5.3 ecrivait).
 */

import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
};
const URL_A = opt('url', '').replace(/\/$/, '');
const REF = opt('ref', 'ecfb30a');
if (!URL_A) {
  console.error('make-rytm-legacy : --url <V.5.3 servi> est requis');
  process.exit(2);
}

function playwright() {
  for (const id of ['playwright', process.env.PLAYWRIGHT_MODULE, '/opt/node22/lib/node_modules/playwright'].filter(Boolean)) {
    try {
      return require(id);
    } catch {
      /* le suivant */
    }
  }
  console.error('Playwright est requis : npm i --no-save playwright && npx playwright install chromium');
  process.exit(2);
}
const chromiumPath = () => process.env.CHROMIUM_PATH || process.env.PW_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

async function open(context) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${URL_A}/?mute=1&debug=1&m=mm808`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__v4?.state?.intro === 'done', null, { timeout: 300000, polling: 250 });
  return { page, errors };
}

async function newContext(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const origin = new URL(URL_A).origin;
  await context.route('**/*', (route) => {
    const u = route.request().url();
    return u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:') ? route.continue() : route.abort();
  });
  return context;
}

/* ---------------- dans la page (l'API __v4 de V.5.3) ---------------- */

/** L'etat edite : tout passe par les stores et les cibles MIDI du site, comme un geste. */
async function pageBuild() {
  const v4 = window.__v4;
  const P = v4.pattern;
  const S = v4.rytm.patterns;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const target = (id, v) => {
    const t = v4.hw.resolve(id);
    if (!t || typeof t.set !== 'function') throw new Error(`cible absente : ${id}`);
    t.set(v);
  };
  // Un hasard fixe (mulberry32) : les memes fixtures a chaque fois
  const rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const INST = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'];
  const DENS = { BD: 0.3, SD: 0.2, CH: 0.55, OH: 0.12, CP: 0.12, TOM: 0.1, HT: 0.08, CY: 0.06 };
  const stepsOf = (seed) => {
    const r = rng(seed);
    const out = {};
    for (const i of INST) {
      let s = '';
      for (let k = 0; k < 16; k += 1) s += r() < DENS[i] ? String(1 + Math.floor(r() * 9)) : '0';
      out[i] = s;
    }
    return out;
  };
  // 1. Les 128 emplacements : chacun ses pas ; un sur quatre des verrous ; quelques-uns des scenes, un mute, des trigs
  for (let i = 0; i < 128; i += 1) {
    const steps = stepsOf(1000 + i);
    const locks = {};
    if (i % 4 === 1) locks.BD = { 0: { tune: Math.round(rng(i)() * 1000) / 1000, decay: 0.4 } };
    if (i % 8 === 3) locks.CH = { 2: { ltrg: 1, level: 0.3 }, 10: { tone: 0.7 } };
    // restoreSlot pose toute la part d'un emplacement (ses pas compris) ; A01, le courant, garde le motif d'arrivee
    if (i % 16 === 5) S.restoreSlot(i, { steps, locks, scenes: { v: 1, a: { 'rytm:voice:SD:decay': 0.25 }, b: { 'rytm:voice:SD:decay': 0.85 } } });
    else if (i % 16 === 7) S.restoreSlot(i, { steps, locks, pmutes: ['OH', 'CY'] });
    else if (i % 16 === 9) S.restoreSlot(i, { steps, locks, trigs: { BD: { prob: 75 }, SD: { rtrg: 1, rate: 2 } } });
    else S.writeSlot(i, steps, locks);
  }
  await wait(50);
  // 2. Le pattern courant : A10 (banque A), puis un motif edite par les gestes du store
  S.select(9);
  await wait(50);
  v4.undo.boundary('mm808');
  P.set('BD', 0, 9);
  P.set('BD', 4, 7);
  P.set('SD', 4, 8);
  P.set('CH', 2, 5);
  P.set('OH', 14, 6);
  P.set('CP', 12, 4);
  await wait(30);
  v4.undo.boundary('mm808');
  P.setLock('BD', [0], 'tune', 0.62);
  P.setLock('SD', [4], 'decay', 0.35);
  P.setLock('CH', [2, 6], 'level', 0.5);
  P.setTrig('BD', 'prob', 80);
  P.setTrig('SD', 'cond', 3);
  P.setTrig('CH', 'rtrg', 1);
  P.setTrig('CH', 'rate', 4);
  await wait(30);
  v4.undo.boundary('mm808');
  P.setBpm(128);
  P.fx.set({ swing: 0.3, reverb: 0.15, delay: 0.1, drive: 0.05 });
  P.setPmutes(['TOM']);
  v4.rytm.scenes.write('a', 'rytm:voice:BD:tune', 0.4);
  v4.rytm.scenes.write('b', 'rytm:voice:BD:tune', 0.7);
  v4.rytm.scenes.write('b', 'rytm:enc:reverb', 0.5);
  await wait(30);
  v4.undo.boundary('mm808');
  // 3. Les voix (leurs reglages et leurs LFO) et le kit (couches, potards, samples) : par les cibles MIDI
  target('rytm:voice:SD:tune', 0.6);
  target('rytm:voice:SD:pan', 0.35);
  target('rytm:voice:CH:decay', 0.3);
  target('rytm:voice:BD:level', 0.85);
  target('rytm:voice:SD:l1dst', 0.1);
  target('rytm:voice:SD:l1dep', 0.7);
  target('rytm:voice:CH:l2dst', 0.2);
  target('rytm:voice:CH:l2dep', 0.3);
  target('rytm:voice:CH:l2spd', 0.6);
  target('rytm:kit:tune', 0.55);
  target('rytm:kit:snappy', 0.6);
  target('rytm:layer:bd:lev', 0.8);
  target('rytm:layer:sd:syn', 0.5);
  target('rytm:layer:ch:mach', 0.5);
  target('rytm:layer:cp:sample', 0.25);
  await wait(30);
  v4.undo.boundary('mm808');
  // 4. Trois presets gardes par SAVE, a trois moments
  const kept = [];
  kept.push(v4.presets.store.save('mm808', { user: 'MIKA', name: 'FIXTURE A' }));
  P.set('HT', 8, 6);
  target('rytm:voice:HT:tune', 0.7);
  await wait(30);
  kept.push(v4.presets.store.save('mm808', { user: 'MIKA', name: 'FIXTURE B' }));
  P.set('CY', 0, 5);
  P.setLock('CY', [0], 'level', 0.6);
  await wait(30);
  kept.push(v4.presets.store.save('mm808', { user: 'MIKA', name: 'FIXTURE C' }));
  // Un dernier geste apres le dernier SAVE : le son du moment n'est aucun preset (l'etoile)
  P.set('BD', 12, 8);
  await wait(30);
  v4.undo.boundary('mm808');
  P.flush();
  v4.undo.save?.();
  await wait(200);
  return { kept: kept.map((k) => ({ id: k.preset?.id ?? null, kept: k.kept })), undo: v4.undo.get() };
}

/** Deux presets d'avant, ecrits tels que les versions d'alors les gardaient (state/presets.ts apply les traduit). */
function pageLegacyPresets() {
  const KEY = 'mm.v4.presets.1';
  const all = JSON.parse(window.localStorage.getItem(KEY) || '{"voy":[],"mm808":[],"bass":[]}');
  const steps = { BD: '9000700090007000', SD: '0000900000009000', CH: '0505050505050505', OH: '0000000000000090', CP: '0000000000000000', TOM: '0000000000000000', HT: '0000000000000000', CY: '0000000000000000' };
  const voiceOld = { level: 0.8, tone: 0, decay: 0.5, dist: 0, chorus: 0, delay: 0, reverb: 0 };
  const voices = Object.fromEntries(Object.keys(steps).map((k) => [k, { ...voiceOld }]));
  const fxOld = { swing: 0.2, drive: 0.1, reverb: 0.2, delay: 0.1, chorus: 0 };
  // D'avant R3 (avant le 2026-10-08) : les TWEAKS du kit et le son de chaque famille ancienne (909, 808, MM ou un sample)
  const preR3 = {
    id: 'legacy-pre-r3',
    name: 'OLD KIT',
    user: 'MIKA',
    at: 1759500000000,
    data: { steps, bpm: 124, fx: fxOld, stretch: 0, voices, kit: { bd: 1, tune: 0.5, attack: 0.4, decay: 0.6, drive: 0.2, sd: 0, snappy: 0.5, cp: 2, gate: 0.4, hh: 1, tom: 0 }, sounds: { bd: '808', sd: '909', cp: 'mm', hh: '808', tom: '909', rs: '909' } },
  };
  // D'avant le 2026-10-18 (une famille par voix) : les couches de R3 sur les familles hh (les deux charleys), tom, rs
  const layer = (syn, lev) => ({ syn, lev, tune: 0, fine: 0, start: 0, len: 1, rev: 0 });
  const pre1018 = {
    id: 'legacy-pre-1018',
    name: 'OLD FAMILIES',
    user: 'MIKA',
    at: 1760500000000,
    data: {
      steps: { ...steps, OH: '0000000900000009', TOM: '0000000000600000' },
      bpm: 132,
      fx: { ...fxOld, dtime: 0.5, dfb: 0.58 },
      stretch: 0.1,
      voices: Object.fromEntries(Object.keys(steps).map((k) => [k, { ...voiceOld, tune: 0, pan: 0, start: 0 }])),
      kit: { bd: 0, tune: 0.5, attack: 0.4, decay: 0.6, drive: 0.2, sd: 1, snappy: 0.5, cp: 0, gate: 0.4, hh: 0, tom: 1 },
      machines: { bd: '909', sd: '808', cp: 'mm', hh: '808', tom: '909', rs: '909' },
      samples: { bd: 'bd/01 BluePrint.wav', sd: '', cp: '', hh: 'hh/01 Hat.wav', tom: '', rs: '' },
      layers: { bd: layer(0, 1), sd: layer(1, 0.8), cp: layer(1, 0.8), hh: layer(0.5, 0.8), tom: layer(1, 0.8), rs: layer(1, 0.8) },
      knobs: { tune: 0.5, attack: 0.4, decay: 0.6, drive: 0.2, snappy: 0.5, gate: 0.4, sweep: 0.3, sdtune: 0.5, sddecay: 0.5, sdtone: 0.5 },
      locks: { BD: { 0: { tune: 0.6 } } },
    },
  };
  all.mm808 = [...(all.mm808 || []).filter((p) => !p.id.startsWith('legacy-')), preR3, pre1018];
  window.localStorage.setItem(KEY, JSON.stringify(all));
  // Les assignations MIDI apprises, dont deux cibles renommees le 2026-10-18 (rytm:kit:hh, rytm:layer:hh:lev)
  window.localStorage.setItem(
    'mm.v4.midi.1',
    JSON.stringify({
      on: false,
      maps: {
        mm808: { 'cc:1:21': 'rytm:kit:hh', 'cc:1:22': 'rytm:layer:hh:lev', 'cc:1:23': 'rytm:voice:BD:level', 'cc:1:24': 'rytm:enc:tempo', 'cc:1:25': 'rytm:knob:1', 'note:10:36': 'rytm:pad:BD', 'note:10:38': 'rytm:pad:SD', 'cc:1:28': 'rytm:xfade', 'note:1:60': 'rytm:trk' },
        voy: { 'cc:2:21': 'voy:knob:cutoff' },
        global: { 'cc:16:1': 'nav:next' },
      },
      devices: [],
      from: {},
      feedback: true,
      roto: true,
      follow: true,
      seqToggle: false,
    })
  );
  return true;
}

/** Ce que V.5.3 lit de l'etat (apres rechargement) : la capture, les emplacements, les presets, l'UNDO. */
async function pageExpect() {
  const v4 = window.__v4;
  const store = v4.presets.store;
  const saved = store.save('mm808', { user: 'IDENT', name: 'PROBE' });
  const capture = JSON.parse(JSON.stringify(saved.preset.data));
  store.remove('mm808', saved.preset.id);
  const ps = v4.rytm.patterns.get();
  const filled = [];
  for (let i = 0; i < 128; i += 1) if (v4.rytm.patterns.filled(i)) filled.push(i);
  const presetsRead = store.list('mm808').map((p) => ({ id: p.id, name: p.name, user: p.user ?? null, factory: !!p.factory }));
  // Chaque preset garde se charge (les deux d'avant par leur traduction) : sa capture une fois charge
  const loaded = {};
  for (const p of store.of('mm808')) {
    store.load('mm808', p.id);
    const s = store.save('mm808', { user: 'IDENT', name: 'PROBE' });
    loaded[p.id] = JSON.parse(JSON.stringify(s.preset.data));
    store.remove('mm808', s.preset.id);
  }
  return {
    capture,
    patterns: { cur: ps.cur, bank: ps.bank ?? null, filled: filled.length, slot0: v4.rytm.patterns.stepsOf(0), slot9: v4.rytm.patterns.stepsOf(9), slot127: v4.rytm.patterns.stepsOf(127), locks1: v4.rytm.patterns.locksOf(1) },
    presets: presetsRead,
    loaded,
    undo: v4.undo.get(),
  };
}

const dumpStorage = () => {
  const out = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith('mm.v4.')) out[k] = window.localStorage.getItem(k);
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
};

async function pageShare(kind) {
  const v4 = window.__v4;
  if (kind === 'factory') {
    const f = v4.presets.store.list('mm808').find((p) => p.factory);
    v4.presets.store.load('mm808', f.id);
  }
  const code = v4.share.code();
  const beat = v4.share.decode(code);
  return { kind, code, beat, data: v4.share.data(beat) };
}

async function main() {
  const { chromium } = playwright();
  const browser = await chromium.launch({ headless: true, executablePath: chromiumPath(), args: ['--mute-audio', '--autoplay-policy=user-gesture-required', ...(process.platform === 'linux' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : [])] });
  try {
    // L'etat complet
    const ctx = await newContext(browser);
    let s = await open(ctx);
    const built = await s.page.evaluate(pageBuild);
    await s.page.evaluate(pageLegacyPresets);
    await s.page.close();
    // Relu par V.5.3 (un rechargement : les migrations a la lecture s'ecrivent, comme chez un visiteur)
    s = await open(ctx);
    const expect = await s.page.evaluate(pageExpect);
    const storage = await s.page.evaluate(dumpStorage);
    if (s.errors.length) throw new Error(`erreur de page : ${s.errors.join(' | ')}`);
    await ctx.close();
    // Les presets charges pendant expect ont touche l'etat : la fixture garde le localStorage d'avant ces chargements
    const ctx2 = await newContext(browser);
    await ctx2.addInitScript((st) => {
      if (window.sessionStorage.getItem('fixture-seeded')) return;
      window.sessionStorage.setItem('fixture-seeded', '1');
      for (const [k, v] of Object.entries(st)) window.localStorage.setItem(k, v);
    }, storage);
    const s2 = await open(ctx2);
    const again = await s2.page.evaluate(dumpStorage);
    await ctx2.close();
    const full = {
      note: 'Fixture fabriquee en headless sur V.5.3 par scripts/fixtures/make-rytm-legacy.mjs : localStorage (cles mm.v4.*) et ce que V.5.3 en lit (expect). Aucune donnee privee. Ne pas regenerer dans une lane.',
      ref: REF,
      made: built,
      localStorage: storage,
      stableOnReload: JSON.stringify(again) === JSON.stringify(storage),
      expect,
    };
    await writeFile(path.join(HERE, 'rytm-legacy-full.json'), `${JSON.stringify(full, null, 1)}\n`);
    console.log(`rytm-legacy-full.json : ${Object.keys(storage).length} cles, ${expect.patterns.filled} emplacements, ${expect.presets.filter((p) => !p.factory).length} presets, UNDO ${JSON.stringify(expect.undo)}, relu a l'identique : ${full.stableOnReload}`);
    // Les liens SHARE v1
    const links = [];
    for (const kind of ['arrival', 'edited', 'factory']) {
      const c = await newContext(browser);
      if (kind === 'edited') {
        await c.addInitScript((st) => {
          if (window.sessionStorage.getItem('fixture-seeded')) return;
          window.sessionStorage.setItem('fixture-seeded', '1');
          for (const [k, v] of Object.entries(st)) window.localStorage.setItem(k, v);
        }, storage);
      }
      const p = await open(c);
      links.push(await p.page.evaluate(pageShare, kind));
      await c.close();
    }
    await writeFile(path.join(HERE, 'rytm-legacy-share.json'), `${JSON.stringify({ note: 'Trois liens SHARE v1 (?b=) fabriques sur V.5.3 et ce que V.5.3 en lit. Ne pas regenerer dans une lane.', ref: REF, links }, null, 1)}\n`);
    console.log(`rytm-legacy-share.json : ${links.map((l) => `${l.kind} ${l.code.length} car.`).join(', ')}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`make-rytm-legacy : ${e?.stack ?? e}`);
  process.exit(2);
});
