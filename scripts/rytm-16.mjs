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
 *   review    les sondes de la relecture de V.5.9, chacune dans son navigateur, bornee dans le temps : R4 (des CY et OH
 *             rapides, puis T9 a T16 denses : la page repond, chaque boucle du plafond bornee), R5 (les queues longues
 *             des pistes 1 a 8 jamais coupees ; avec --v53, le rendu de V.5.3 au bit pres), R7 (une source coupee par
 *             le plafond ne se rouvre pas), R6 (un reglage de LFO atteint les coups programmes, RUN muet), R1 (deux
 *             onglets : le kit de l'un et la voix de l'autre gardes), R3 (les pages de V.6.1 partent avec leur motif)
 *
 * Usage : node scripts/rytm-16.mjs --url http://127.0.0.1:<port> [--v53 http://127.0.0.1:<port>] [--only offline,live,fixtures,rollback,review]
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
  // Avant chaque geste : la file du worker vide (un coup de remplacement qui arrive refait aussi sa piste, shots.onReady) ;
  // apres : la re-programmation groupee (12 ms), avant tout autre arrivee
  const quiet = async () => {
    for (let i = 0; i < 100 && (v4.audio.shots().queued > 0 || v4.audio.shots().waiting > 0); i += 1) await wait(50);
    await wait(150);
  };
  const turn = async (fn) => {
    await quiet();
    const a = snap();
    fn();
    await wait(60);
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

/* ---------------- review : les sondes de la relecture de V.5.9 (R1, R3, R4, R5, R6, R7) ---------------- */

const LAUNCH = () => ({ headless: true, executablePath: chromiumPath(), args: ['--mute-audio', '--autoplay-policy=user-gesture-required', ...(process.platform === 'linux' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : [])] });

/**
 * Une page dans son propre navigateur, son evaluation bornee a `ms` (R4 : une page gelee ne repond plus du tout) : rend
 * { r, errors }, r = { timeout: true } si elle n'a pas repondu ; le navigateur est ferme dans tous les cas.
 */
async function isolated(url, seed, fn, arg, ms) {
  const { chromium } = playwright();
  const browser = await chromium.launch(LAUNCH());
  let timer = null;
  try {
    const s = await open(browser, url, seed);
    const r = await Promise.race([s.page.evaluate(fn, arg), new Promise((res) => (timer = setTimeout(() => res({ timeout: true }), ms)))]);
    return { r, errors: s.errors };
  } finally {
    if (timer) clearTimeout(timer);
    await Promise.race([browser.close().catch(() => {}), new Promise((res) => setTimeout(res, 15000))]);
  }
}

/** Les rendus hors ligne des pistes 1 a 8 (R4, R5) : le temps, le plafond, et le signal (pour la comparaison a V.5.3). */
async function pageCap(arg) {
  const v4 = window.__v4;
  const zero = '0'.repeat(16);
  const out = {};
  for (const [name, c] of Object.entries(arg.cases)) {
    const steps = { BD: zero, SD: zero, CH: zero, OH: zero, CP: zero, TOM: zero, HT: zero, CY: zero, ...c.steps };
    const o = { seconds: c.seconds, sampleRate: 48000, channels: 2, channel: 0, bpm: c.bpm, steps, seed: 808, log: true, ...(c.trigs ? { trigs: c.trigs } : {}) };
    const t0 = performance.now();
    const buf = await v4.audio.renderOffline(o);
    const ms = performance.now() - t0;
    const cap = v4.audio.tracks16?.offline ? { ...v4.audio.tracks16.offline } : null;
    out[name] = { ms, hits: v4.audio.offlineHits.length, cap, ...(arg.buf ? { buf: Array.from(buf) } : {}) };
  }
  return out;
}

/** R4 et le plafond des pistes 9 a 16 : CY et OH rapides, et T9 a T16 en cymbales poly denses avec retrigs. */
async function pageCap16() {
  const v4 = window.__v4;
  const T = v4.tracks;
  for (const k of ['T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16']) {
    T.machine(k, 'cy', '909');
    T.voice(k, { vmode: 'poly' });
  }
  const full = '9'.repeat(16);
  const zero = '0'.repeat(16);
  const steps = { BD: zero, SD: zero, CH: full, OH: full, CP: zero, TOM: zero, HT: zero, CY: full, T9: full, T10: full, T11: full, T12: full, T13: full, T14: full, T15: full, T16: full };
  const trigs = { CY: { rtrg: 1, rate: 16 }, T9: { rtrg: 1, rate: 12 }, T12: { rtrg: 1, rate: 16 }, T15: { rtrg: 1, rate: 12 } };
  const t0 = performance.now();
  await v4.audio.renderOffline({ seconds: 4, sampleRate: 48000, channels: 2, channel: 0, bpm: 140, steps, trigs, seed: 808, log: true });
  return { ms: performance.now() - t0, hits: v4.audio.offlineHits.length, cap: v4.audio.tracks16?.offline ? { ...v4.audio.tracks16.offline } : null };
}

/**
 * R7 : le plafond global coupe le coup de T9 (mono, une cymbale, la plus vieille des pistes 9 a 16) ; le coup suivant
 * de T9 ne doit pas la rouvrir. Tout le reste est muet (CY a VOL 0, T10 a T16 a TRK LEV 0) mais compte dans le
 * plafond : la sortie avant le 2e coup de T9 est celle de T9 seule. Reference : le meme T9 sans les autres.
 */
async function pageR7() {
  const v4 = window.__v4;
  const T = v4.tracks;
  T.machine('T9', 'cy', '909');
  for (const k of ['T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16']) {
    T.machine(k, 'cy', '909');
    T.voice(k, { vmode: 'poly' });
  }
  const zero = '0'.repeat(16);
  const bpm = 120;
  const step = 60 / bpm / 4;
  const base = { BD: zero, SD: zero, CH: zero, OH: zero, CP: zero, TOM: zero, HT: zero, CY: zero, T9: '9000000090000000' };
  const fill = { ...base, CY: '0999999999999999', T10: '0999999999999999', T11: '0999999999999999', T12: '0999999999999999', T13: '0999999999999999', T14: '0999999999999999', T15: '0999999999999999', T16: '0999999999999999' };
  const o = (steps, extra = {}) => ({ seconds: 1.6, sampleRate: 48000, channels: 2, channel: 0, bpm, steps, seed: 808, log: true, ...extra });
  const quiet = { voice: { CY: { level: 0 } }, tlev: { T10: 0, T11: 0, T12: 0, T13: 0, T14: 0, T15: 0, T16: 0 }, trigs: { CY: { rtrg: 1, rate: 16 } } };
  const ref = await v4.audio.renderOffline(o(base, { voice: { CY: { level: 0 } } }));
  const buf = await v4.audio.renderOffline(o(fill, quiet));
  const cap = v4.audio.tracks16?.offline ? { ...v4.audio.tracks16.offline } : null;
  const t9 = v4.audio.offlineHits.filter((h) => h.inst === 'T9').map((h) => h.t);
  const w2 = t9.length > 1 ? t9[1] : 0.02 + 8 * step;
  const peak = (b) => {
    let m = 0;
    for (let i = Math.floor((w2 - 0.006) * 48000); i < Math.floor((w2 - 0.0005) * 48000); i += 1) m = Math.max(m, Math.abs(b[i]));
    return m;
  };
  return { w2, cap, peakRef: peak(ref), peakFill: peak(buf) };
}

/** R6 : un RUN muet, la caisse claire et son LFO1 ; un cran de L1 DEPTH a 0 doit atteindre les coups deja programmes. */
async function pageR6() {
  const v4 = window.__v4;
  const X = v4.tracks16;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  v4.tracks.setMany('SD', { l1dst: 1, l1dep: 30, l1spd: 24 });
  X.ctx();
  await wait(300);
  for (let i = 0; i < 16; i += 1) v4.pattern.set('SD', i, 6);
  X.run(true);
  await wait(700);
  await v4.audio.ctx.suspend();
  for (let i = 0; i < 100 && (v4.audio.shots().queued > 0 || v4.audio.shots().waiting > 0); i += 1) await wait(50);
  await wait(150);
  const plan = typeof v4.clock.planLfo === 'function' ? (t) => v4.clock.planLfo(t) : null;
  const before = plan ? plan('SD') : null;
  const full0 = v4.clock.rescheduled;
  v4.tracks.set('SD', 'l1dep', 0);
  await wait(80);
  const after = plan ? plan('SD') : null;
  const full = v4.clock.rescheduled - full0;
  X.run(false);
  await v4.audio.ctx.resume();
  return { full, planned: !!plan, before: before ? before.filter((h) => h.lfo.length > 0).length : null, n: after ? after.length : null, stale: after ? after.filter((h) => h.lfo.length > 0).length : null };
}

/** R1, l'onglet A : un cran de SNAPPY (le kit). L'onglet B, ouvert avant : un cran du DECAY du HT (une voix). */
async function pageR1(what) {
  const v4 = window.__v4;
  if (what === 'kit') v4.tracks16.kit.set('snappy', 0.3);
  if (what === 'voice') v4.tracks16.voiceFx.set('HT', 'decay', 0.33);
  if (what === 'read') return { from: v4.tracks.info().loadedFrom, snappy: v4.tracks16.legacy().knob.snappy, ht: v4.tracks16.legacyVoices().HT.decay };
  await new Promise((r) => setTimeout(r, 500));
  v4.tracks.flush();
  return true;
}

/** R3 : le motif courant a des pages, un setup et un kit (ecrits par V.6.1) ; un pas pose les garde, un preset charge les retire. */
async function pageR3() {
  const v4 = window.__v4;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const read = () => {
    const o = JSON.parse(window.localStorage.getItem('mm.v4.pattern.3') ?? '{}');
    return { pages: !!o.pages, setup: !!o.setup, kit: !!o.kit };
  };
  const loaded = !!v4.pattern.serialize().pages;
  v4.pattern.set('BD', 3, 9);
  await wait(400);
  v4.pattern.flush();
  const edited = read();
  const f = v4.presets.store.list('mm808').find((p) => p.factory);
  v4.presets.store.load('mm808', f.id);
  await wait(400);
  v4.pattern.flush();
  return { loaded, edited, after: read() };
}

async function review(browser) {
  console.log('--- review : les sondes de la relecture de V.5.9');
  // R4 : des CY et OH rapides sur les pistes 1 a 8, puis T9 a T16 denses (les deux plafonds coupent) : la page repond, la
  // programmation reste bornee
  const heavy = { ohcy: { bpm: 140, seconds: 4, steps: { CH: '9'.repeat(16), OH: '9'.repeat(16), CY: '9'.repeat(16) }, trigs: { CY: { rtrg: 1, rate: 16 } } } };
  const a = await isolated(URL_A, null, pageCap, { cases: heavy }, 60000);
  const h = a.r.timeout ? null : a.r.ohcy;
  check(!!h && h.cap && h.cap.schedMs < 2000, 'R4 : CY en retrig 1/80, OH et CH en doubles croches (pistes 1 a 8) : la page repond, programmation bornee', h ? `${h.hits} coups, programmation ${h.cap?.schedMs?.toFixed(0)} ms, rendu en ${h.ms.toFixed(0)} ms, pic ${h.cap?.peak}` : 'GEL : aucune reponse en 60 s');
  const b = await isolated(URL_A, null, pageCap16, null, 60000);
  const c16 = b.r.timeout ? null : b.r.cap;
  check(!!c16 && c16.schedMs < 2000 && c16.capped > 0 && c16.polyCapped > 0 && c16.trackPeak <= 4, 'R4 : T9 a T16 en cymbales poly denses (retrigs) : les deux plafonds coupent, chaque boucle bornee', c16 ? `${b.r.hits} coups, programmation ${c16.schedMs.toFixed(0)} ms, coupees ${c16.capped} (plafond) et ${c16.polyCapped} (poly), pic d'une piste 9 a 16 ${c16.trackPeak}` : 'GEL : aucune reponse en 60 s');
  // R5 : les queues longues superposees des pistes 1 a 8 ne sont jamais coupees ; avec --v53, le rendu au bit pres de V.5.3
  const cases = {
    cy8: { bpm: 120, seconds: 4, steps: { CY: '9090909090909090' } },
    cy16: { bpm: 128, seconds: 4, steps: { CY: '9'.repeat(16) } },
    tom16: { bpm: 140, seconds: 4, steps: { TOM: '9'.repeat(16) } },
    dense8: { bpm: 130, seconds: 4, steps: { BD: '9000900090009000', SD: '0000900000009000', CH: '9'.repeat(16), OH: '0090009000900090', CP: '0000900000009000', TOM: '9009009009009009', HT: '0909090909090909', CY: '9000000090000000' }, trigs: { CH: { rtrg: 1, rate: 12, rlen: 4 }, HT: { len: 2 } } },
  };
  const c = await isolated(URL_A, null, pageCap, { cases, buf: !!URL_53 }, 120000);
  const ref = URL_53 ? await isolated(URL_53, null, pageCap, { cases, buf: true }, 120000) : null;
  for (const name of Object.keys(cases)) {
    const x = c.r.timeout ? null : c.r[name];
    let diff = null;
    if (x && ref && !ref.r.timeout) {
      const y = ref.r[name];
      diff = x.buf.length === y.buf.length ? x.buf.reduce((m, v, i) => Math.max(m, Math.abs(v - y.buf[i])), 0) : Infinity;
    }
    const ok = !!x && x.cap && x.cap.capped === 0 && x.cap.polyCapped === 0 && (diff === null || diff <= 1e-6);
    check(ok, `R5 : ${name}, les pistes 1 a 8 sans plafond${URL_53 ? ', comme V.5.3' : ''}`, x ? `${x.hits} coups, coupees ${x.cap?.capped} + ${x.cap?.polyCapped}, pic ${x.cap?.peak}${diff !== null ? `, ecart a V.5.3 ${diff.toExponential(2)}` : ''}` : 'GEL : aucune reponse');
  }
  // R7 : une source coupee par le plafond global ne se rouvre pas au coup suivant de sa piste mono
  const d = await isolated(URL_A, null, pageR7, null, 60000);
  const r7 = d.r.timeout ? null : d.r;
  check(!!r7 && r7.cap && r7.cap.capped > 0 && r7.peakRef > 1e-4 && r7.peakFill <= r7.peakRef * 0.02, 'R7 : le coup de T9 coupe par le plafond reste ferme au coup suivant (aucun clic)', r7 ? `coupees ${r7.cap?.capped}, avant le 2e coup de T9 : crete ${r7.peakFill.toExponential(2)} (sans plafond ${r7.peakRef.toExponential(2)})` : 'GEL : aucune reponse en 60 s');
  // R6 : un reglage de LFO atteint les coups deja programmes
  const e = await isolated(URL_A, null, pageR6, null, 60000);
  const r6 = e.r.timeout ? null : e.r;
  check(!!r6 && r6.full >= 1 && r6.planned && r6.before > 0 && r6.n > 0 && r6.stale === 0, 'R6 : L1 DEPTH a 0 en RUN (muet) : les coups programmes de SD n\'ont plus de LFO', r6 ? `re-programmation complete ${r6.full}, coups programmes ${r6.n ?? '?'}, avec LFO avant ${r6.before ?? '?'}, apres ${r6.stale ?? '?'}` : 'aucune reponse');
  // R1 : deux onglets V.5.9 ; A edite le kit, B (ouvert avant) une voix : un troisieme garde les deux
  {
    const br = await (playwright().chromium).launch(LAUNCH());
    try {
      const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const origin = new URL(URL_A).origin;
      await ctx.route('**/*', (route) => {
        const u = route.request().url();
        return u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:') ? route.continue() : route.abort();
      });
      const tab = async () => {
        const p = await ctx.newPage();
        await p.goto(`${URL_A}/?mute=1&debug=1&m=mm808`, { waitUntil: 'domcontentloaded' });
        await p.waitForFunction(() => window.__v4?.state?.intro === 'done', null, { timeout: 300000, polling: 250 });
        return p;
      };
      const pa = await tab();
      const pb = await tab();
      await pa.evaluate(pageR1, 'kit');
      await pb.evaluate(pageR1, 'voice');
      const pc = await tab();
      const r1 = await pc.evaluate(pageR1, 'read');
      const snappy = Math.round(0.3 * 127) / 127;
      check(Math.abs(r1.snappy - snappy) < 1e-9 && Math.abs(r1.ht - 0.33) < 0.01, 'R1 : deux onglets, le kit de l\'un et la voix de l\'autre gardes', `origine ${r1.from}, SNAPPY ${r1.snappy.toFixed(3)} (attendu ${snappy.toFixed(3)}), HT DECAY ${r1.ht}`);
    } finally {
      await br.close();
    }
  }
  // R3 : les pages, le setup et le kit de V.6.1 partent avec leur motif
  {
    const s = await open(browser, URL_A);
    const cur = await s.page.evaluate(() => window.__v4.pattern.serialize());
    await s.context.close();
    const seeded = { ...cur, pages: { BD: '9'.repeat(48) }, setup: { len: 64 }, kit: 'k-v61' };
    const t = await open(browser, URL_A, { 'mm.v4.pattern.3': JSON.stringify(seeded) });
    const r3 = await t.page.evaluate(pageR3);
    await t.context.close();
    check(r3.loaded && r3.edited.pages && r3.edited.setup && r3.edited.kit && !r3.after.pages && !r3.after.setup && !r3.after.kit, 'R3 : un pas pose garde les pages de V.6.1, un preset charge les retire', `lues ${r3.loaded}, apres un pas ${JSON.stringify(r3.edited)}, apres le preset ${JSON.stringify(r3.after)}`);
  }
}

async function main() {
  const { chromium } = playwright();
  const browser = await chromium.launch(LAUNCH());
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
    if (want('review')) await review(browser);
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
