#!/usr/bin/env node
/**
 * La sonde d'identite audio du MM-RYTM (2026-10-30, la preparation P0 de la refonte Digitakt II,
 * docs/v4/dt2/dt2-master-spec.md 4.7 et 5.0). Rien ne sort des enceintes : chaque son est un rendu hors ligne
 * (window.__v4.audio.renderOffline, un OfflineAudioContext) dans un Chromium headless lance avec --mute-audio, sur une
 * page ouverte avec ?mute=1&debug=1&m=mm808. Aucune lecture, aucun RUN, aucune pre-ecoute.
 *
 * Les cas (chacun rendu en stereo, canal gauche puis droit, 48 kHz, graine 808, apres un rendu de chauffe) :
 *   arrival      le pattern d'arrivee (un navigateur neuf : localStorage vide)
 *   locked       le meme, avec des P-LOCKS (TUNE, DECAY, VOLUME, TONE, PAN, deux lock trigs)
 *   triglfo      le meme, avec des reglages TRIG (PROB, RETRIG, LEN) et des LFO de voix
 *   scenes       le meme, avec des scenes A et B a mi-course du crossfader
 *   factory:<id> chaque preset d'usine du MM-RYTM, charge par le store (presets.load)
 *   fixture:full l'etat de la fixture scripts/fixtures/rytm-legacy-full.json (son localStorage pose avant le
 *                chargement de la page) ; fixture:full:<id> chacun de ses presets (dont un d'avant R3 et un d'avant
 *                le 2026-10-18), charge par le store : la porte de migration de la V.5.9
 * L'etat d'un cas est lu par le store des presets (un SAVE puis un REMOVE dans le navigateur de test : la forme de
 * state/presets.ts capture) puis rendu avec tout ce qu'il porte : pas, BPM, verrous, reglages de trig, reglages des
 * voix et leurs LFO, FX globaux, STRETCH, scenes. Les samples du kit sont charges avant le rendu.
 *
 * Deux rendus identiques ne sont pas identiques au bit pres dans Chromium (mesure du 2026-10-30 sur V.5.3 : jusqu'a
 * 5e-7 d'un passage a l'autre, le meme build) : la reference n'est donc pas une empreinte. Elle garde, par bloc de 256
 * echantillons, le maximum, le minimum, la moyenne et la valeur efficace. Chacune bouge au plus de l'ecart le plus grand
 * entre deux rendus (|max a - max b| <= max |a - b|, de meme pour les autres) : un ecart de bloc au-dessus de 1e-6
 * prouve un ecart d'echantillon au-dessus de 1e-6. La comparaison de deux builds servis (--against) mesure, elle, l'ecart
 * exact, echantillon par echantillon.
 *
 * Usage (un site servi : `SEO_OFFLINE=1 npx vite build` puis `python3 -m http.server 4321 -d dist`, ou vite preview) :
 *   node scripts/rytm-ident.mjs --url http://127.0.0.1:4321
 *        compare a scripts/rytm-ident.golden.json (calcule UNE fois sur le commit V.5.3, ecfb30a) : l'ecart des blocs,
 *        au plus 1e-6 (--tol)
 *   node scripts/rytm-ident.mjs --url http://127.0.0.1:4321 --against http://127.0.0.1:4322
 *        compare deux builds servis (le second : la reference, V.5.3) echantillon par echantillon : l'ecart le plus
 *        grand de chaque cas, au plus 1e-6
 *   --update     reecrit scripts/rytm-ident.golden.json (seulement sur le commit de reference, jamais dans une lane)
 *   --only arrival,locked    seulement ces cas (les presets d'usine : factory ; la fixture : fixture)
 *   --tol 1e-6   l'ecart permis
 *   --json <f>   le rapport complet dans un fichier
 *
 * Playwright : le paquet du projet, sinon PLAYWRIGHT_MODULE, sinon /opt/node22 (l'environnement de Claude Code) ;
 * Chromium : CHROMIUM_PATH ou PW_CHROMIUM, sinon /opt/pw-browsers/chromium s'il existe, sinon celui de Playwright.
 * Sans GPU, WebGL passe par SwiftShader. Le contexte demande le mouvement reduit (pas d'intro : 10 s par page au lieu de
 * 80). Code de sortie : 0 identique, 1 un ecart, 2 une erreur.
 *
 * Pour les lanes (V.5.9 et apres) : la capture lit la forme RytmData de V.5.3 (state/presets.ts capture) ; si la forme
 * change (16 pistes), adapter pageCase pour qu'elle rende la meme chose, jamais regenerer la reference.
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN = path.join(ROOT, 'scripts/rytm-ident.golden.json');
const BLOCK = 256;
const require = createRequire(import.meta.url);

const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
};
const flag = (name) => argv.includes(`--${name}`);
const URL_A = opt('url', '').replace(/\/$/, '');
const URL_B = opt('against', '').replace(/\/$/, '');
const UPDATE = flag('update');
const TOL = Number(opt('tol', '1e-6'));
const ONLY = opt('only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const JSON_OUT = opt('json', '');
const INTRO_MS = Number(opt('timeout', '300000'));

if (!URL_A) {
  console.error("rytm-ident : --url <site servi> est requis (voir l'en-tete du script)");
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

function chromiumPath() {
  const env = process.env.CHROMIUM_PATH || process.env.PW_CHROMIUM;
  if (env) return env;
  return existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
}

/* ---------------- dans la page ---------------- */

/**
 * Le rendu d'un cas, dans la page (window.__v4) : par canal, la longueur, le nombre de coups, la crete, les statistiques
 * de blocs (Float32 en base64 : max, min, moyenne, valeur efficace) et, avec samples, les echantillons en base64.
 * Ecrit pour tourner tel quel dans V.5.3 (l'API __v4 de ce commit), la reference.
 */
async function pageCase(arg) {
  const v4 = window.__v4;
  const { name, load, samples, block } = arg;
  const store = v4.presets.store;
  if (load) {
    const p = store.load('mm808', load);
    if (!p) throw new Error(`preset introuvable : ${load}`);
  }
  // L'etat du moment, par le store des presets (la forme que garde un preset)
  const saved = store.save('mm808', { user: 'IDENT', name: 'PROBE' });
  if (!saved.preset) throw new Error(`capture impossible (${saved.why})`);
  const d = JSON.parse(JSON.stringify(saved.preset.data));
  store.remove('mm808', saved.preset.id);
  // Les samples du kit : charges avant le rendu (un sample absent ne jouerait pas)
  const keys = new Set();
  for (const k of Object.values(d.samples ?? {})) if (typeof k === 'string' && k) keys.add(k);
  for (const k of Object.values(d.sounds ?? {})) if (typeof k === 'string' && k && v4.audio.samples.sampleByKey(k)) keys.add(k);
  for (const k of keys) await v4.audio.samples.loadSample(k);
  const fx = d.fx ?? {};
  const fxs = {};
  for (const k of ['dtone', 'rsize', 'rtone', 'rpre', 'xtone', 'crate', 'cdepth', 'brate', 'catk', 'crel', 'cthr', 'cratio', 'cknee', 'cmake', 'chpf']) if (typeof fx[k] === 'number') fxs[k] = fx[k];
  const voice = JSON.parse(JSON.stringify(d.voices ?? {}));
  let locks = d.locks ? JSON.parse(JSON.stringify(d.locks)) : {};
  let trigs = d.trigs ? JSON.parse(JSON.stringify(d.trigs)) : undefined;
  let scenes = d.scenes;
  let x;
  if (name === 'locked') {
    locks = {
      ...locks,
      BD: { ...(locks.BD ?? {}), 0: { tune: 0.7, decay: 0.3 }, 8: { level: 0.4 } },
      SD: { ...(locks.SD ?? {}), 4: { tone: 0.8, pan: 0.2 } },
      CH: { ...(locks.CH ?? {}), 2: { decay: 0.9 }, 6: { ltrg: 1, level: 0.2 } },
      CY: { ...(locks.CY ?? {}), 8: { ltrg: 1, level: 0.2 } },
    };
  }
  if (name === 'triglfo') {
    trigs = { ...(trigs ?? {}), BD: { ...(trigs?.BD ?? {}), prob: 50 }, SD: { ...(trigs?.SD ?? {}), rtrg: 1, rate: 3, vfad: -20 }, CH: { ...(trigs?.CH ?? {}), len: 4 } };
    voice.SD = { ...(voice.SD ?? {}), l1dst: 1, l1dep: 40 };
    voice.CH = { ...(voice.CH ?? {}), l2dst: 2, l2dep: -30, l2spd: 20 };
  }
  if (name === 'scenes') {
    scenes = { v: 1, a: { 'rytm:voice:SD:decay': 0.2, 'rytm:voice:BD:tune': 0.3, 'rytm:enc:delay': 0.4 }, b: { 'rytm:voice:SD:decay': 0.9, 'rytm:voice:CH:tone': 0.8, 'rytm:enc:reverb': 0.6 } };
    x = 0.5;
  }
  const bpm = d.bpm;
  // Une mesure et demie, plus la queue
  const seconds = Math.round(((60 / bpm / 4) * 24 + 1.2) * 100) / 100;
  const opts = {
    seconds,
    sampleRate: 48000,
    channels: 2,
    bpm,
    steps: d.steps,
    locks,
    ...(trigs ? { trigs } : {}),
    voice,
    drive: fx.drive ?? 0,
    reverb: fx.reverb ?? 0,
    delay: fx.delay ?? 0,
    chorus: fx.chorus ?? 0,
    ...(typeof fx.dtime === 'number' ? { dtime: fx.dtime } : {}),
    ...(typeof fx.dfb === 'number' ? { dfb: fx.dfb } : {}),
    bits: fx.bits ?? 0,
    comp: fx.comp ?? 0,
    fxs,
    stretch: d.stretch ?? 0,
    ...(scenes ? { scenes } : {}),
    ...(x !== undefined ? { x } : {}),
    seed: 808,
    log: true,
  };
  const b64 = (bytes) => {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  };
  // Un rendu de chauffe : chaque son du cas est dans le cache des coups avant les rendus mesures
  await v4.audio.renderOffline({ ...opts, channel: 0 });
  const out = { name, load: load ?? null, seconds, bpm, ch: [] };
  for (const channel of [0, 1]) {
    const buf = await v4.audio.renderOffline({ ...opts, channel });
    const nb = Math.ceil(buf.length / block);
    const st = new Float32Array(nb * 4);
    let peak = 0;
    for (let b = 0; b < nb; b += 1) {
      let mx = -Infinity;
      let mn = Infinity;
      let sum = 0;
      let sq = 0;
      const end = Math.min(buf.length, (b + 1) * block);
      for (let i = b * block; i < end; i += 1) {
        const v = buf[i];
        if (v > mx) mx = v;
        if (v < mn) mn = v;
        sum += v;
        sq += v * v;
      }
      const n = end - b * block;
      st[b * 4] = mx;
      st[b * 4 + 1] = mn;
      st[b * 4 + 2] = sum / n;
      st[b * 4 + 3] = Math.sqrt(sq / n);
      peak = Math.max(peak, Math.abs(mx), Math.abs(mn));
    }
    const ch = { n: buf.length, peak, hits: v4.audio.offlineHits.length, stats: b64(new Uint8Array(st.buffer)) };
    if (samples) ch.b64 = b64(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    out.ch.push(ch);
  }
  return out;
}

/* ---------------- le navigateur ---------------- */

async function openSite(browser, url, seed = null) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  // Une fixture : son localStorage pose avant le code du site, une fois (le contexte est neuf)
  if (seed) {
    await context.addInitScript((st) => {
      if (window.sessionStorage.getItem('rytm-ident-seeded')) return;
      window.sessionStorage.setItem('rytm-ident-seeded', '1');
      for (const [k, v] of Object.entries(st)) window.localStorage.setItem(k, v);
    }, seed);
  }
  // Rien vers l'exterieur (analytics, SoundCloud, polices) : seulement le site servi
  const origin = new URL(url).origin;
  await context.route('**/*', (route) => {
    const u = route.request().url();
    return u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:') ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${url}/?mute=1&debug=1&m=mm808`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__v4?.state?.intro === 'done', null, { timeout: INTRO_MS, polling: 250 });
  return { context, page, errors };
}

async function listFactory(page) {
  return page.evaluate(() =>
    window.__v4.presets.store
      .list('mm808')
      .filter((p) => p.factory)
      .map((p) => ({ id: p.id, name: p.name }))
  );
}

const wanted = (name) => ONLY.length === 0 || ONLY.includes(name) || (name.startsWith('factory:') && ONLY.includes('factory')) || (name.startsWith('fixture:') && ONLY.includes('fixture'));
const FIXTURE = path.join(ROOT, 'scripts/fixtures/rytm-legacy-full.json');

/** Les cas d'un site : chaque cas dans un contexte neuf (localStorage vide), pour que rien ne passe d'un cas a l'autre. */
async function runSite(browser, url, samples) {
  const first = await openSite(browser, url);
  const factory = await listFactory(first.page);
  await first.context.close();
  const fx = existsSync(FIXTURE) ? JSON.parse(await readFile(FIXTURE, 'utf8')) : null;
  const fixtureCases = fx
    ? [{ name: 'fixture:full', seed: fx.localStorage }, ...fx.expect.presets.filter((p) => !p.factory).map((p) => ({ name: `fixture:full:${p.id}`, load: p.id, seed: fx.localStorage, label: p.name }))]
    : [];
  const cases = [{ name: 'arrival' }, { name: 'locked' }, { name: 'triglfo' }, { name: 'scenes' }, ...factory.map((f) => ({ name: `factory:${f.id}`, load: f.id, label: f.name })), ...fixtureCases].filter((c) => wanted(c.name));
  const res = [];
  for (const c of cases) {
    const s = await openSite(browser, url, c.seed ?? null);
    try {
      const r = await s.page.evaluate(pageCase, { name: c.name, load: c.load, samples, block: BLOCK });
      if (s.errors.length) throw new Error(`erreur de page : ${s.errors[0]}`);
      res.push({ ...r, label: c.label ?? null });
      process.stdout.write(`  ${url} ${c.name} : ${r.ch.map((x) => `${x.n} ech., crete ${x.peak.toFixed(4)}`).join(' | ')}, ${r.ch[0].hits} coups\n`);
    } finally {
      await s.context.close();
    }
  }
  return res;
}

const f32 = (b64) => {
  const b = Buffer.from(b64, 'base64');
  const out = new Float32Array(b.byteLength / 4);
  for (let i = 0; i < out.length; i += 1) out[i] = b.readFloatLE(i * 4);
  return out;
};
const maxDiff = (x, y) => {
  if (x.length !== y.length) return Infinity;
  let m = 0;
  for (let i = 0; i < x.length; i += 1) m = Math.max(m, Math.abs(x[i] - y[i]));
  return m;
};
const fmt = (v) => (v === 0 ? '0' : Number.isFinite(v) ? v.toExponential(3) : 'longueurs differentes');

async function main() {
  const { chromium } = playwright();
  const linux = process.platform === 'linux';
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath(),
    args: ['--mute-audio', '--autoplay-policy=user-gesture-required', ...(linux ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : [])],
  });
  let fail = false;
  const report = { at: new Date().toISOString(), url: URL_A, against: URL_B || null, tol: TOL, cases: [] };
  try {
    const a = await runSite(browser, URL_A, !!URL_B);
    if (URL_B) {
      const b = await runSite(browser, URL_B, true);
      for (const ca of a) {
        const cb = b.find((x) => x.name === ca.name);
        if (!cb) {
          console.log(`ECART ${ca.name} : absent de la reference`);
          fail = true;
          continue;
        }
        const d = Math.max(maxDiff(f32(ca.ch[0].b64), f32(cb.ch[0].b64)), maxDiff(f32(ca.ch[1].b64), f32(cb.ch[1].b64)));
        const ok = d <= TOL && ca.ch[0].hits === cb.ch[0].hits;
        if (!ok) fail = true;
        report.cases.push({ name: ca.name, maxDiff: d, ok, peak: ca.ch.map((c) => c.peak), hits: [ca.ch[0].hits, cb.ch[0].hits] });
        console.log(`${ok ? 'OK   ' : 'ECART'} ${ca.name.padEnd(24)} ecart max ${fmt(d)}  coups ${ca.ch[0].hits} / ${cb.ch[0].hits}`);
      }
      for (const cb of b)
        if (!a.find((x) => x.name === cb.name)) {
          console.log(`ECART ${cb.name} : absent du build compare`);
          fail = true;
        }
    } else if (UPDATE) {
      const golden = {
        note: 'scripts/rytm-ident.mjs : la reference, rendue sur V.5.3 (ecfb30a). Par canal : statistiques de blocs de 256 echantillons (Float32 LE en base64 : max, min, moyenne, valeur efficace). Ne jamais regenerer dans une lane.',
        ref: opt('ref', 'ecfb30a'),
        block: BLOCK,
        at: report.at,
        cases: a.map((c) => ({ name: c.name, label: c.label, seconds: c.seconds, bpm: c.bpm, ch: c.ch.map(({ n, peak, hits, stats }) => ({ n, peak, hits, stats })) })),
      };
      await writeFile(GOLDEN, `${JSON.stringify(golden, null, 1)}\n`);
      console.log(`ecrit : ${path.relative(ROOT, GOLDEN)} (${golden.cases.length} cas)`);
    } else {
      const golden = JSON.parse(await readFile(GOLDEN, 'utf8'));
      for (const g of golden.cases) {
        if (!wanted(g.name)) continue;
        const c = a.find((x) => x.name === g.name);
        if (!c) {
          console.log(`ECART ${g.name} : absent du build`);
          fail = true;
          continue;
        }
        let d = 0;
        for (const k of [0, 1]) d = Math.max(d, c.ch[k].n === g.ch[k].n ? maxDiff(f32(c.ch[k].stats), f32(g.ch[k].stats)) : Infinity);
        const ok = d <= TOL && c.ch[0].hits === g.ch[0].hits;
        if (!ok) fail = true;
        report.cases.push({ name: g.name, blockDiff: d, ok, hits: [c.ch[0].hits, g.ch[0].hits] });
        console.log(`${ok ? 'OK   ' : 'ECART'} ${g.name.padEnd(24)} ecart des blocs ${fmt(d)}  coups ${c.ch[0].hits} / ${g.ch[0].hits}`);
      }
      for (const c of a) if (!golden.cases.find((g) => g.name === c.name)) console.log(`  ${c.name} : nouveau cas, sans reference`);
    }
  } catch (e) {
    console.error(`rytm-ident : ${e?.stack ?? e}`);
    await browser.close();
    process.exit(2);
  }
  await browser.close();
  if (JSON_OUT) await writeFile(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`);
  if (!UPDATE) console.log(fail ? 'rytm-ident : ECART' : `rytm-ident : identique (ecart <= ${TOL})`);
  process.exit(fail ? 1 : 0);
}

main();
