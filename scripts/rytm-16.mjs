#!/usr/bin/env node
/**
 * La sonde des 16 pistes du MM-RYTM (2026-10-30, la V.5.9 : le moteur a 16 pistes, invisible ; docs/v4/dt2/
 * dt2-master-spec.md 4.6, 4.7 et 5.1). Rien ne sort des enceintes : Chromium headless --mute-audio, pages ouvertes avec
 * ?mute=1&debug=1&m=mm808 (MASTER a 0 pour toute la page), rendus hors ligne (window.__v4.audio.renderOffline) ; la
 * seule lecture est un RUN de l'horloge sous ?mute=1 (partie live), pour compter ses re-programmations, jamais ecoute.
 *
 * Les parties (toutes par defaut, ou --only a,b) :
 *   offline   T9 a T16 avec des sons (KICK 808, ONESHOT, les syntheses), des pas, des verrous (TUNE, sample lock,
 *             VOL, DECAY, FREQ), un lock trig, un retrig (1/32 sur 2 pas), un LEN, des LFO : le nombre de coups de
 *             chaque piste contre celui que les pas disent (calcule ici, hors du moteur), les tranches construites, le
 *             plafond de sources, le rapport temps reel / temps de calcul (porte : >= 8) ; les pistes 9 a 16 avec un son
 *             mais sans pas : le rendu des 8 voix au bit pres (ecart <= 1e-6)
 *   live      le graphe vivant : au repos les 8 tranches d'avant ; un RUN muet, puis un potard du kick, un reglage de
 *             la caisse claire, de l'OH (son groupe de choke), de T9 : chaque fois les seules pistes refaites
 *   fixtures  scripts/fixtures/rytm-legacy-full.json relue par ce build : le stockage reste octet pour octet celui de
 *             V.5.3 au chargement, et ce que V.5.3 en lisait (capture, emplacements, presets, chaque preset charge,
 *             l'UNDO) est lu a l'identique ; les 3 liens SHARE v1 (rytm-legacy-share.json) : meme code, meme beat
 *   rollback  (avec --v53 <url d'un build V.5.3>) une sauvegarde ecrite par ce build (pistes 9 a 16, voix et kit
 *             edites, un preset) relue par V.5.3 : ses 8 voix, son preset, sans erreur ; puis relue ici : les pistes 9
 *             a 16 intactes ; et apres une edition dans V.5.3 : les pistes 1 a 8 de V.5.3, les 9 a 16 d'ici
 *
 * Usage : node scripts/rytm-16.mjs --url http://127.0.0.1:<port> [--v53 http://127.0.0.1:<port>] [--only offline,live]
 * Code de sortie : 0 bon, 1 un ecart, 2 une erreur.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
};
const URL_A = opt('url', '').replace(/\/$/, '');
const URL_53 = opt('v53', '').replace(/\/$/, '');
const ONLY = opt('only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const want = (p) => (ONLY.length === 0 ? p !== 'rollback' || !!URL_53 : ONLY.includes(p));
if (!URL_A) {
  console.error('rytm-16 : --url <site servi> est requis');
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
  console.error('Playwright est requis');
  process.exit(2);
}
const chromiumPath = () => process.env.CHROMIUM_PATH || process.env.PW_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

let fails = 0;
const check = (ok, what, detail = '') => {
  if (!ok) fails += 1;
  console.log(`${ok ? 'OK   ' : 'ECART'} ${what}${detail ? `  ${detail}` : ''}`);
};

async function open(browser, url, seed = null) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  if (seed) {
    await context.addInitScript((st) => {
      if (window.sessionStorage.getItem('rytm16-seeded')) return;
      window.sessionStorage.setItem('rytm16-seeded', '1');
      window.localStorage.clear();
      for (const [k, v] of Object.entries(st)) window.localStorage.setItem(k, v);
    }, seed);
  }
  const origin = new URL(url).origin;
  await context.route('**/*', (route) => {
    const u = route.request().url();
    return u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:') ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${url}/?mute=1&debug=1&m=mm808`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__v4?.state?.intro === 'done', null, { timeout: 300000, polling: 250 });
  return { context, page, errors };
}

/* ---------------- offline : T9 a T16 ---------------- */

/** Le motif des pistes 9 a 16 (2 mesures rendues) : leurs pas, verrous et reglages de trig. */
const ROWS = {
  T9: '9000000090000000',
  T10: '0000900000009000',
  T11: '0090009000900090',
  T12: '9000000090000000',
  T13: '0000000000000000',
  T14: '0000060000000600',
  T15: '0909090909090909',
  T16: '6000000000000000',
};

async function pageOffline(rows) {
  const v4 = window.__v4;
  const T = v4.tracks;
  const S = v4.audio.samples;
  const firstOf = (f) => S.samplesOf(f).filter((s) => !s.user)[0]?.key ?? '';
  const out = {};
  const bpm = 130;
  const step = 60 / bpm / 4;
  // 32 pas rendus (2 mesures) : t = 0.02 + n x pas < seconds - 0.5 pour n = 0..31
  const seconds = Math.round((0.52 + 31.5 * step) * 10000) / 10000;
  const steps8 = JSON.parse(JSON.stringify(v4.pattern.get().steps));
  const opts = (steps, extra = {}) => ({ seconds, sampleRate: 48000, channels: 2, channel: 0, bpm, steps, seed: 808, log: true, ...extra });
  const maxDiff = (a, b) => {
    if (a.length !== b.length) return Infinity;
    let m = 0;
    for (let i = 0; i < a.length; i += 1) m = Math.max(m, Math.abs(a[i] - b[i]));
    return m;
  };
  // 1. Le rendu des 8 voix, pistes 9 a 16 vides
  await v4.audio.renderOffline(opts(steps8));
  const base = await v4.audio.renderOffline(opts(steps8));
  out.emptyBefore = T.info().sounding;
  // 2. Des sons sur T9 a T16
  T.machine('T9', 'bd', '808');
  T.setMany('T9', { syn: 1 });
  T.sample('T10', firstOf('sd'));
  T.machine('T11', 'ch', '909');
  T.machine('T12', 'sd', 'mm');
  T.machine('T13', 'cp', 'mm');
  T.machine('T14', 'tom', '808');
  T.sample('T15', firstOf('ch'));
  T.machine('T16', 'cy', '909');
  T.sample('T16', firstOf('cy'));
  T.setMany('T16', { syn: 1, slev: 0.6 });
  // Des LFO de piste (T11 : PITCH ; T14 : PAN)
  T.setMany('T11', { l1dst: 1, l1dep: 30, l1spd: 24 });
  T.setMany('T14', { l2dst: 5, l2dep: -40, l2spd: 16 });
  out.sounding = T.info().sounding;
  out.engines = v4.tracks16.keys.map((k) => T.engine(k));
  for (const k of [firstOf('sd'), firstOf('ch'), firstOf('cy'), firstOf('bd')]) if (k) await S.loadSample(k);
  // 3. Les memes 8 voix, les pistes 9 a 16 sonnent mais n'ont aucun pas : le rendu d'avant
  await v4.audio.renderOffline(opts(steps8));
  const same = await v4.audio.renderOffline(opts(steps8));
  out.silentDiff = maxDiff(base, same);
  // 4. Les 16 pistes : pas, verrous, lock trig, retrig, LEN
  const steps = { ...steps8, ...rows };
  const locks = {
    v: 3,
    T9: { 0: { tune: 0.25 } },
    T10: { 4: { snd: `ch:${firstOf('ch')}` } },
    T11: { 2: { level: 0.5 } },
    T13: { 6: { ltrg: 1, level: 0.3 } },
    T14: { 5: { decay: 0.4 } },
    T16: { 0: { ftype: 0.5, fcut: 0.3 } },
  };
  // T12 : RETRIG 1/32 sur 2 pas (3 repetitions par trig) ; T15 : LEN 1/4 de pas
  const trigs = { T12: { rtrg: 1, rate: 12, rlen: 6 }, T15: { len: 2 } };
  await v4.audio.renderOffline(opts(steps, { locks, trigs }));
  const t0 = performance.now();
  const full = await v4.audio.renderOffline(opts(steps, { locks, trigs }));
  const ms = performance.now() - t0;
  out.ms = ms;
  out.seconds = seconds;
  out.ratio = seconds / (ms / 1000);
  out.fullDiff = maxDiff(base, full);
  const hits = v4.audio.offlineHits;
  const count = {};
  for (const h of hits) {
    const k = `${h.inst}:${h.kind}`;
    count[k] = (count[k] ?? 0) + 1;
  }
  out.count = count;
  out.cap = v4.audio.tracks16?.offline ?? null;
  // 5. Un pattern dense de 16 pistes, 4 mesures (verrous, retrigs 1/32, LFO) : le rapport temps reel
  const dense = { ...steps8, T9: '9090909090909090', T10: '0909090909090909', T11: '9999999999999999', T12: '9000900090009000', T13: '0090009000900090', T14: '9009009009009009', T15: '9999999999999999', T16: '9000000090000000' };
  const dsec = Math.round((0.52 + 63.5 * step) * 10000) / 10000;
  const dtrigs = { T12: { rtrg: 1, rate: 12, rlen: 6 }, T15: { len: 2 }, T11: { rtrg: 1, rate: 12, rlen: 4 } };
  // Le meilleur de 3 rendus (apres un de chauffe) : une machine partagee a des a-coups (le ramasse-miettes, les autres taches)
  const best = async (o) => {
    await v4.audio.renderOffline(o);
    let ms = Infinity;
    let cap = null;
    for (let i = 0; i < 3; i += 1) {
      const t = performance.now();
      await v4.audio.renderOffline(o);
      const d = performance.now() - t;
      if (d < ms) {
        ms = d;
        cap = v4.audio.tracks16?.offline ? { ...v4.audio.tracks16.offline } : null;
      }
    }
    return { ms, cap };
  };
  const bd = await best({ ...opts(dense, { locks, trigs: dtrigs }), seconds: dsec });
  out.dense = { seconds: dsec, ms: bd.ms, ratio: dsec / (bd.ms / 1000), hits: v4.audio.offlineHits.length, cap: bd.cap };
  // 6. La reference : le meme motif dense sur les 8 voix seules (toutes leurs rangees aussi denses), meme duree
  const dense8 = { BD: '9000900090009000', SD: '0000900000009000', CH: '9999999999999999', OH: '0090009000900090', CP: '0000900000009000', TOM: '9009009009009009', HT: '0909090909090909', CY: '9000000090000000' };
  const d8trigs = { CH: { rtrg: 1, rate: 12, rlen: 4 }, HT: { len: 2 } };
  const b8 = await best({ ...opts(dense8, { trigs: d8trigs }), seconds: dsec });
  out.dense8 = { seconds: dsec, ms: b8.ms, ratio: dsec / (b8.ms / 1000), hits: v4.audio.offlineHits.length, cap: b8.cap };
  return out;
}

/** Les coups attendus d'apres les pas seuls (hors du moteur) : notes, repetitions du retrig, lock trigs, sur 32 pas. */
function expected() {
  const N = 32;
  const exp = {};
  for (const [k, row] of Object.entries(ROWS)) {
    let notes = 0;
    for (let n = 0; n < N; n += 1) if (row[n % 16] !== '0') notes += 1;
    if (notes) exp[`${k}:note`] = notes;
  }
  // T12 : RETRIG 1/32 (tous les demi-pas) sur RLEN 2 pas : 3 repetitions par trig (la 4e tomberait a la fin de RLEN)
  exp['T12:rep'] = exp['T12:note'] * 3;
  // T13 : le lock trig du pas 7 (une fois par mesure)
  exp['T13:lock'] = 2;
  return exp;
}

/* ---------------- live : le graphe vivant, la re-programmation par piste ---------------- */

async function pageLive() {
  const v4 = window.__v4;
  const X = v4.tracks16;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  // Un son sur T9 (sans pas : rien a construire)
  v4.tracks.machine('T9', 'bd', '808');
  v4.tracks.setMany('T9', { syn: 1 });
  out.ctx = X.ctx();
  await wait(300);
  out.restChannels = v4.audio.tracks16?.channels ?? null;
  // Un motif dense (chaque piste refaite a des coups dans la fenetre programmee, 300 ms) : BD, SD, CH, OH, T9
  for (let i = 0; i < 16; i += 1) {
    v4.pattern.set('BD', i, 9);
    v4.pattern.set('SD', i, 6);
    v4.pattern.set('T9', i, 7);
    v4.pattern.set(i % 2 ? 'OH' : 'CH', i, 6);
  }
  out.ran = X.run(true);
  await wait(700);
  // Le temps du contexte fige (dans ce Chromium sans sortie audio, il court plus vite que l'horloge murale) : les pas
  // programmes restent a venir, chaque geste a des coups a refaire ; les gestes passent par les facades et le store
  // (une cible MIDI relancerait le contexte)
  await v4.audio.ctx.suspend();
  const snap = () => ({ full: v4.clock.rescheduled, trk: v4.clock.trackRescheduled, last: [...v4.clock.lastTracks], redone: v4.clock.redone, pending: v4.clock.pending });
  const turn = async (fn) => {
    const a = snap();
    fn();
    await wait(250);
    const b = snap();
    return { full: b.full - a.full, trk: b.trk - a.trk, last: b.last, redone: b.redone - a.redone, pending: b.pending };
  };
  // DRIVE du kick : le sample du BD d'arrivee le prend (son caractere), sa signature change ; TUNE ne regle que la synthese
  out.kickTune = await turn(() => X.kit.set('drive', 0.6));
  out.sdDecay = await turn(() => X.voiceFx.set('SD', 'decay', 0.4));
  out.ohDecay = await turn(() => X.voiceFx.set('OH', 'decay', 0.6));
  out.t9Decay = await turn(() => v4.tracks.set('T9', 'decay', 0.5));
  out.steps = await turn(() => v4.pattern.set('HT', 2, 6));
  out.liveChannels = v4.audio.tracks16?.channels ?? null;
  out.sources = v4.audio.tracks16 ? { peak: v4.audio.tracks16.peak, cap: v4.audio.tracks16.cap, capped: v4.audio.tracks16.capped } : null;
  X.run(false);
  await v4.audio.ctx.resume();
  return out;
}

/* ---------------- fixtures : relues a l'identique ---------------- */

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

/** Le JSON aux cles triees (deux etats egaux, quel que soit l'ordre de leurs cles). */
function sorted(x) {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? 'null';
  if (Array.isArray(x)) return `[${x.map(sorted).join(',')}]`;
  return `{${Object.keys(x)
    .filter((k) => x[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${sorted(x[k])}`)
    .join(',')}}`;
}

/* ---------------- retour arriere : V.5.9 -> V.5.3 -> V.5.9 ---------------- */

async function pageWrite59() {
  const v4 = window.__v4;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const target = (id, v) => v4.hw.resolve(id).set(v);
  const S = v4.audio.samples;
  const firstOf = (f) => S.samplesOf(f).filter((s) => !s.user)[0]?.key ?? '';
  // Les 8 voix : par les cibles MIDI (les facades) ; les pistes 9 a 16 : par le store
  target('rytm:kit:tune', 0.61);
  target('rytm:voice:SD:decay', 0.42);
  target('rytm:voice:CY:tune', 0.7);
  v4.tracks.machine('T9', 'bd', '808');
  v4.tracks.setMany('T9', { syn: 1, decay: 0.6 });
  v4.tracks.sample('T10', firstOf('sd'));
  v4.tracks.voice('T10', { vmode: 'poly' });
  v4.tracks.mix({ tlev: v4.tracks16.keys.map((k) => (k === 'T10' ? 0.7 : 0.8)) });
  v4.pattern.set('T9', 0, 9);
  v4.pattern.set('T10', 4, 6);
  v4.pattern.setLock('T9', [0], 'tune', 0.3);
  const kept = v4.presets.store.save('mm808', { user: 'V59', name: 'ROLLBACK' });
  await wait(600);
  v4.tracks.flush();
  v4.pattern.flush();
  await wait(600);
  const capture = (() => {
    const s = v4.presets.store.save('mm808', { user: 'IDENT', name: 'PROBE' });
    const d = JSON.parse(JSON.stringify(s.preset.data));
    v4.presets.store.remove('mm808', s.preset.id);
    return d;
  })();
  return { kept: kept.preset?.id ?? null, capture, tracks: v4.tracks.info() };
}

async function pageRead53(presetId) {
  const v4 = window.__v4;
  const store = v4.presets.store;
  const s = store.save('mm808', { user: 'IDENT', name: 'PROBE' });
  const capture = JSON.parse(JSON.stringify(s.preset.data));
  store.remove('mm808', s.preset.id);
  const p = store.of('mm808').find((x) => x.id === presetId);
  const loaded = p ? store.load('mm808', presetId) : null;
  const s2 = store.save('mm808', { user: 'IDENT', name: 'PROBE' });
  const afterLoad = JSON.parse(JSON.stringify(s2.preset.data));
  store.remove('mm808', s2.preset.id);
  return { capture, hasPreset: !!p, loaded: !!loaded, afterLoad, steps: v4.pattern.get().steps };
}

async function pageEdit53() {
  const v4 = window.__v4;
  v4.hw.resolve('rytm:kit:snappy').set(0.3);
  v4.hw.resolve('rytm:voice:HT:decay').set(0.33);
  await new Promise((r) => setTimeout(r, 900));
  return true;
}

async function pageRead59() {
  const v4 = window.__v4;
  const T = v4.tracks;
  return {
    info: T.info(),
    t9: { mach: T.of('T9').mach, model: T.of('T9').model, decay: T.param('T9', 'decay') },
    t10: { snd: T.of('T10').snd, vmode: T.voiceOf('T10').vmode, tlev: T.param('T10', 'tlev') },
    knobs: v4.tracks16.legacy().knob,
    voices: JSON.parse(JSON.stringify(v4.tracks16.legacyVoices())),
    steps: v4.pattern.get().steps,
  };
}

async function main() {
  const { chromium } = playwright();
  const browser = await chromium.launch({ headless: true, executablePath: chromiumPath(), args: ['--mute-audio', '--autoplay-policy=user-gesture-required', ...(process.platform === 'linux' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : [])] });
  try {
    if (want('offline')) {
      console.log('--- offline : les 16 pistes');
      const s = await open(browser, URL_A);
      const r = await s.page.evaluate(pageOffline, ROWS);
      check(s.errors.length === 0, 'aucune erreur de page', s.errors[0] ?? '');
      check(JSON.stringify(r.emptyBefore) === JSON.stringify(['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY']), 'au depart, seules les pistes 1 a 8 ont un son', r.emptyBefore.join(' '));
      check(r.sounding.length === 16, 'T9 a T16 ont un son', r.sounding.join(' '));
      console.log(`      moteurs : ${r.engines.join(' ')}`);
      check(r.silentDiff <= 1e-6, 'T9 a T16 avec un son, sans pas : le rendu des 8 voix', `ecart ${r.silentDiff.toExponential(2)}`);
      check(r.fullDiff > 1e-3, 'T9 a T16 avec des pas : ils s\'entendent', `ecart ${r.fullDiff.toFixed(4)}`);
      const exp = expected();
      for (const [k, n] of Object.entries(exp)) check(r.count[k] === n, `coups ${k}`, `${r.count[k] ?? 0} / ${n} attendus`);
      const t16 = (k) => /^T\d+:/.test(k);
      const legacyNotes = Object.entries(r.count).filter(([k]) => !t16(k)).reduce((a, [, n]) => a + n, 0);
      console.log(`      coups des 8 voix : ${legacyNotes} ; ceux des pistes 9 a 16 : ${Object.entries(r.count).filter(([k]) => t16(k)).map(([k, n]) => `${k} ${n}`).join(', ')}`);
      const extra = Object.keys(r.count).filter((k) => t16(k) && !(k in exp));
      check(extra.length === 0, 'aucun coup imprevu sur T9 a T16', extra.join(' '));
      check(!!r.cap && ['T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16'].every((k) => r.cap.channels.includes(k)), 'les tranches de T9 a T16 construites a leur premier coup', r.cap ? r.cap.channels.join(' ') : 'aucune');
      check(!!r.cap && r.cap.peak <= 48, 'sources simultanees <= 48', r.cap ? `pic ${r.cap.peak}, coupees ${r.cap.capped} (plafond), ${r.cap.polyCapped} (poly)` : '');
      console.log(`      rendu de ${r.seconds} s en ${r.ms.toFixed(0)} ms : rapport temps reel ${r.ratio.toFixed(1)}`);
      const det = (d) => `${d.seconds} s en ${d.ms.toFixed(0)} ms (programmation ${d.cap?.schedMs?.toFixed(0)} ms, rendu ${d.cap?.renderMs?.toFixed(0)} ms) : ${d.ratio.toFixed(1)} ; ${d.hits} coups, ${d.cap?.voices} voix ; pic ${d.cap?.peak} sources`;
      console.log(`      reference, 8 voix denses : ${det(r.dense8)}`);
      check(r.dense.ratio >= 8, 'pattern dense de 16 pistes, 4 mesures (verrous, retrigs 1/32, LFO) : rapport temps reel >= 8', det(r.dense));
      await s.context.close();
    }
    if (want('live')) {
      console.log('--- live : le graphe vivant (RUN muet)');
      const s = await open(browser, URL_A);
      const r = await s.page.evaluate(pageLive);
      check(s.errors.length === 0, 'aucune erreur de page', s.errors[0] ?? '');
      check(JSON.stringify(r.restChannels) === JSON.stringify(['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY']), 'au repos, les 8 tranches d\'avant (T9 a un son, aucun coup)', JSON.stringify(r.restChannels));
      check(r.ran === true, 'RUN (muet)');
      const one = (x, tracksWant, what) => check(x.full === 0 && x.trk >= 1 && JSON.stringify([...x.last].sort()) === JSON.stringify([...tracksWant].sort()), what, `pistes refaites ${x.last.join(' ')}, ${x.redone} coups, ${x.trk} re-programmation(s) de piste, ${x.full} de toute l'horloge`);
      one(r.kickTune, ['BD'], 'un cran du DRIVE du kick : seule T1 refaite');
      one(r.sdDecay, ['SD'], 'un cran du DECAY de la caisse claire : seule T2 refaite');
      one(r.ohDecay, ['CH', 'OH'], 'un cran du DECAY de l\'OH : son groupe de choke (T3, T4)');
      one(r.t9Decay, ['T9'], 'un cran du DECAY de T9 : seule T9 refaite');
      check(r.steps.full >= 1, 'un pas pose : toute l\'horloge refaite (comme avant)', `${r.steps.full}`);
      check(Array.isArray(r.liveChannels) && r.liveChannels.includes('T9') && r.liveChannels.length === 9, 'T9 a joue : sa tranche construite, pas les autres', JSON.stringify(r.liveChannels));
      check(!!r.sources && r.sources.peak <= r.sources.cap, 'sources simultanees sous le plafond', r.sources ? `pic ${r.sources.peak} / ${r.sources.cap}` : '');
      await s.context.close();
    }
    if (want('fixtures')) {
      console.log('--- fixtures : relues a l\'identique');
      const fx = JSON.parse(await readFile(path.join(ROOT, 'scripts/fixtures/rytm-legacy-full.json'), 'utf8'));
      // Le stockage au chargement : rien n'est ecrit (comme V.5.3)
      const s0 = await open(browser, URL_A, fx.localStorage);
      await s0.page.waitForTimeout(1500);
      const st = await s0.page.evaluate(dumpStorage);
      const diffKeys = [...new Set([...Object.keys(st), ...Object.keys(fx.localStorage)])].filter((k) => st[k] !== fx.localStorage[k]);
      check(diffKeys.length === 0, 'stockage relu octet pour octet (rien d\'ecrit au chargement)', diffKeys.join(' '));
      check(s0.errors.length === 0, 'aucune erreur de page', s0.errors[0] ?? '');
      await s0.context.close();
      const s = await open(browser, URL_A, fx.localStorage);
      const e = await s.page.evaluate(pageExpect);
      for (const k of ['capture', 'patterns', 'presets', 'loaded', 'undo']) {
        const exact = JSON.stringify(e[k]) === JSON.stringify(fx.expect[k]);
        const same = sorted(e[k]) === sorted(fx.expect[k]);
        check(same, `fixture ${k}`, exact ? 'identique (meme JSON)' : same ? 'identique (cles dans un autre ordre)' : 'DIFFERENT');
      }
      await s.context.close();
      const sh = JSON.parse(await readFile(path.join(ROOT, 'scripts/fixtures/rytm-legacy-share.json'), 'utf8'));
      for (const l of sh.links) {
        const c = await open(browser, URL_A, l.kind === 'edited' ? fx.localStorage : null);
        const r = await c.page.evaluate(pageShare, l.kind);
        check(r.code === l.code && sorted(r.beat) === sorted(l.beat) && sorted(r.data) === sorted(l.data), `lien SHARE v1 ${l.kind}`, r.code === l.code ? `meme code (${r.code.length} car.)` : `code ${r.code} au lieu de ${l.code}`);
        await c.context.close();
      }
    }
    if (want('rollback')) {
      if (!URL_53) throw new Error('rollback : --v53 <url d\'un build V.5.3> est requis');
      console.log('--- retour arriere : V.5.9 -> V.5.3 -> V.5.9');
      const fx = JSON.parse(await readFile(path.join(ROOT, 'scripts/fixtures/rytm-legacy-full.json'), 'utf8'));
      const a = await open(browser, URL_A, fx.localStorage);
      const w = await a.page.evaluate(pageWrite59);
      const st59 = await a.page.evaluate(dumpStorage);
      check(a.errors.length === 0, 'V.5.9 : aucune erreur de page', a.errors[0] ?? '');
      check(!!st59['mm.v4.rytm.tracks.1'] && !!w.kept, 'V.5.9 : les 16 pistes et un preset ecrits', `tracks.1 ${st59['mm.v4.rytm.tracks.1']?.length ?? 0} car.`);
      await a.context.close();
      // V.5.3 relit ce que V.5.9 a ecrit
      const b = await open(browser, URL_53, st59);
      const r53 = await b.page.evaluate(pageRead53, w.kept);
      check(b.errors.length === 0, 'V.5.3 : aucune erreur de page', b.errors[0] ?? '');
      const strip = (d) => {
        const o = JSON.parse(JSON.stringify(d));
        delete o.tracks;
        o.steps = Object.fromEntries(Object.entries(o.steps).filter(([k]) => !/^T\d+$/.test(k)));
        if (o.locks) for (const k of Object.keys(o.locks)) if (/^T\d+$/.test(k)) delete o.locks[k];
        return o;
      };
      check(sorted(r53.capture) === sorted(strip(w.capture)), 'V.5.3 : ses 8 voix, son kit, son motif = ceux de V.5.9 (sans les pistes 9 a 16)');
      check(r53.hasPreset && r53.loaded, 'V.5.3 : le preset de V.5.9 se liste et se charge');
      check(sorted(strip(r53.afterLoad)) === sorted(strip(w.capture)), 'V.5.3 : le preset charge donne le meme son');
      await b.context.close();
      // Retour en V.5.9 sans edition dans V.5.3 : les pistes 9 a 16 intactes
      const c = await open(browser, URL_A, st59);
      const r59 = await c.page.evaluate(pageRead59);
      check(c.errors.length === 0, 'V.5.9 : aucune erreur de page', c.errors[0] ?? '');
      check(r59.info.loadedFrom === 'tracks' && r59.t9.mach === 'bd' && r59.t9.model === '808' && r59.t10.vmode === 'poly' && Math.abs(r59.t10.tlev - 0.7) < 1e-9 && r59.steps.T9 === '9000000000000000', 'V.5.9 relu : les pistes 9 a 16 intactes', `origine ${r59.info.loadedFrom}, T9 ${r59.t9.mach} ${r59.t9.model}, T10 ${r59.t10.vmode} tlev ${r59.t10.tlev}, pas T9 ${r59.steps.T9}`);
      await c.context.close();
      // V.5.3 edite le kit et une voix, puis retour en V.5.9 : ses 8 voix de V.5.3, les 9 a 16 de V.5.9
      const d = await open(browser, URL_53, st59);
      await d.page.evaluate(pageEdit53);
      const st53 = await d.page.evaluate(dumpStorage);
      await d.context.close();
      const e = await open(browser, URL_A, st53);
      const r = await e.page.evaluate(pageRead59);
      check(e.errors.length === 0, 'V.5.9 : aucune erreur de page', e.errors[0] ?? '');
      const snappy = Math.round(0.3 * 127) / 127;
      check(r.info.loadedFrom === 'mixed' && Math.abs(r.knobs.snappy - snappy) < 1e-9 && Math.abs(r.voices.HT.decay - 0.33) < 0.01 && r.t9.mach === 'bd' && r.t10.vmode === 'poly', 'apres une edition dans V.5.3 : ses 8 voix, et les pistes 9 a 16 de V.5.9', `origine ${r.info.loadedFrom}, SNAPPY ${r.knobs.snappy.toFixed(3)}, HT DECAY ${r.voices.HT.decay}, T9 ${r.t9.mach}`);
      await e.context.close();
    }
  } catch (err) {
    console.error(`rytm-16 : ${err?.stack ?? err}`);
    await browser.close();
    process.exit(2);
  }
  await browser.close();
  console.log(fails ? `rytm-16 : ${fails} ECART(S)` : 'rytm-16 : bon');
  process.exit(fails ? 1 : 0);
}

main();
