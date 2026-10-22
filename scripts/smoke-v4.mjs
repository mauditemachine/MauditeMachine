/**
 * `npm run smoke:v4` : test de fumee du MM-STUDIO (2026-10-21, l'audit), SANS SON.
 *
 * Charge chaque machine (MM-RYTM mm808, MM-ARP voy, MM-DECKS dj, MM-BASS bass
 * avec ?bass=1) en desktop (1440 x 900) et au telephone (390 x 844, DPR 3,
 * tactile, ?portrait=1), attend la fin de l'intro, laisse vivre la page et
 * echoue (code 1) sur :
 * - une erreur de page (exception non attrapee) ou une erreur de console ;
 * - une requete locale en echec ou en 4xx / 5xx (les coupures de video et
 *   d'audio en cours de lecture, ERR_ABORTED, ne comptent pas) ;
 * - pas de WebGL (le repli), ou la machine demandee qui n'est pas celle
 *   utilisee ;
 * - la racine .v4-root qui a defile (la page part au noir, l'audit RS-1).
 *
 * Jamais de son : Chromium tourne avec --mute-audio, chaque page avec
 * ?mute=1, et le script ne touche ni RUN ni un pad. Les requetes vers
 * l'exterieur (analytics, SoundCloud, polices) sont bloquees : rien n'est
 * envoye nulle part.
 *
 * Usage :
 *   npm run smoke:v4                       un serveur vite de dev est lance
 *                                          sur un port libre, puis arrete (son
 *                                          cache dans le dossier temporaire)
 *   node scripts/smoke-v4.mjs --url http://127.0.0.1:4173
 *                                          un serveur deja lance (vite preview
 *                                          apres npm run build : la prod)
 *   --machines mm808,voy                   seulement ces machines
 *   --only desktop | --only phone          une seule mise en page
 *   --settle 4000                          ms laissees a la page apres l'intro
 *   --timeout 300000                       ms max pour l'intro (rendu logiciel lent)
 *   --cache /un/dossier                    le cache de vite (sans --url ; par
 *                                          defaut dans le dossier temporaire)
 *
 * Playwright : le paquet du projet s'il est installe, sinon celui de
 * /opt/node22 (l'environnement de Claude Code) ; Chromium : PW_CHROMIUM, sinon
 * /opt/pw-browsers/chromium s'il existe, sinon celui de Playwright. Sans
 * Playwright : `npm i -D playwright && npx playwright install chromium`.
 * Sans GPU (une machine de CI), WebGL passe par SwiftShader : lent mais juste.
 */

import { existsSync } from 'node:fs';
import { createServer as netServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- options ---------- */

const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
};
const URL_ARG = opt('url', '');
const MACHINES = opt('machines', 'mm808,voy,dj,bass').split(',').map((s) => s.trim()).filter(Boolean);
const ONLY = opt('only', '');
const SETTLE_MS = Number(opt('settle', '4000'));
const TIMEOUT_MS = Number(opt('timeout', '300000'));
const CACHE_DIR = opt('cache', '');

/** Les erreurs de console qui ne disent rien de la page : les requetes externes bloquees par ce script. */
const IGNORED_CONSOLE = /ERR_BLOCKED_BY_CLIENT|blockedbyclient|net::ERR_FAILED .*(googletagmanager|facebook|soundcloud)/i;

/* ---------- Playwright ---------- */

async function loadPlaywright() {
  for (const spec of ['playwright', '/opt/node22/lib/node_modules/playwright/index.js']) {
    try {
      const m = await import(spec);
      return m.chromium ?? m.default?.chromium;
    } catch {
      /* suivant */
    }
  }
  return null;
}

/* ---------- serveur ---------- */

function freePort() {
  return new Promise((resolve, reject) => {
    const s = netServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function waitFor(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {
      /* pas encore */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Un serveur vite de dev sur un port libre, par son API (vite.config.ts du depot, sans ouvrir de navigateur) ; son
 * cache dans le dossier temporaire du systeme : node_modules/.vite, celui de npm run dev, n'est pas touche.
 */
async function startVite() {
  const port = await freePort();
  const { createServer } = await import('vite');
  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.ts'),
    cacheDir: CACHE_DIR || path.join(tmpdir(), 'mm-smoke-v4-vite'),
    logLevel: 'warn',
    server: { host: '127.0.0.1', port, strictPort: true, open: false, hmr: false },
  });
  await server.listen();
  const base = `http://127.0.0.1:${port}`;
  if (!(await waitFor(`${base}/`, 60000))) {
    await server.close();
    throw new Error("vite n'a pas demarre");
  }
  return { base, stop: () => server.close() };
}

/* ---------- une page ---------- */

async function check(browser, base, machine, phone) {
  const ctx = await browser.newContext(
    phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } }
  );
  const host = new URL(base).host;
  // Rien ne sort : analytics, SoundCloud, polices et CDN bloques
  await ctx.route(
    (u) => u.host !== host && !/^(data|blob):/.test(u.protocol),
    (r) => r.abort('blockedbyclient')
  );
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${String(e?.stack || e?.message || e).slice(0, 600)}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORED_CONSOLE.test(m.text())) problems.push(`console: ${m.text().slice(0, 400)}`);
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    const why = r.failure()?.errorText ?? '';
    if (!u.startsWith(base) || /ERR_ABORTED|blockedbyclient/i.test(why)) return;
    problems.push(`request failed: ${why} ${u}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(base)) problems.push(`http ${r.status()} ${r.url()}`);
  });
  const url = `${base}/?mute=1&debug=1&m=${machine}${machine === 'bass' ? '&bass=1' : ''}${phone ? '&portrait=1' : ''}`;
  const t0 = Date.now();
  let state = null;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    // La premiere image, puis l'intro : en prod (vite preview) elle se joue, et sous rendu logiciel elle avance a
    // l'image (des minutes) ; un geste sans effet (Maj) la termine, comme la premiere tape d'un visiteur
    await page.waitForFunction(() => (window.__v4?.stats?.frames ?? 0) > 0 || window.__v4?.state?.intro === 'done', null, { timeout: TIMEOUT_MS, polling: 250 });
    if ((await page.evaluate(() => window.__v4?.state?.intro)) !== 'done') await page.keyboard.press('Shift');
    await page.waitForFunction(() => window.__v4?.state?.intro === 'done', null, { timeout: TIMEOUT_MS, polling: 250 });
    await page.waitForTimeout(SETTLE_MS);
    state = await page.evaluate(() => {
      const root = document.querySelector('.v4-root');
      return {
        gl: window.__v4.state.gl,
        focus: window.__v4.voyager?.focus?.get?.() ?? null,
        scroll: root ? [root.scrollLeft, root.scrollTop] : null,
      };
    });
  } catch (e) {
    problems.push(`load: ${String(e?.message || e).split('\n')[0]}`);
  }
  if (state) {
    if (state.gl !== 'webgl') problems.push(`gl: ${state.gl} (le repli sans WebGL)`);
    if (state.focus !== machine) problems.push(`focus: ${state.focus}, attendu ${machine}`);
    if (!state.scroll || state.scroll[0] !== 0 || state.scroll[1] !== 0) problems.push(`.v4-root a defile : ${JSON.stringify(state.scroll)}`);
  }
  await ctx.close();
  return { machine, layout: phone ? 'phone' : 'desktop', ms: Date.now() - t0, problems };
}

/* ---------- main ---------- */

const chromium = await loadPlaywright();
if (!chromium) {
  console.error('Playwright introuvable : npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}
const exe = process.env.PW_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
// Le navigateur d'abord : s'il ne demarre pas, aucun serveur ne reste derriere
const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  args: ['--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
let server;
try {
  server = URL_ARG ? { base: URL_ARG.replace(/\/$/, ''), stop: async () => {} } : await startVite();
} catch (e) {
  await browser.close();
  throw e;
}
const layouts = ONLY === 'phone' ? [true] : ONLY === 'desktop' ? [false] : [false, true];
const results = [];
try {
  for (const m of MACHINES) {
    for (const phone of layouts) {
      const r = await check(browser, server.base, m, phone);
      results.push(r);
      const ok = r.problems.length === 0;
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${m.padEnd(6)} ${r.layout.padEnd(8)} ${Math.round(r.ms / 1000)} s`);
      for (const p of r.problems.slice(0, 8)) console.log(`       ${p}`);
    }
  }
} finally {
  await browser.close();
  await server.stop();
}
const failed = results.filter((r) => r.problems.length > 0);
console.log(failed.length ? `\n${failed.length} / ${results.length} pages en echec` : `\n${results.length} pages, aucune erreur`);
process.exit(failed.length ? 1 : 0);
