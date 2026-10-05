#!/usr/bin/env node
/**
 * Le mode d'emploi du MM-SMPL en PDF (2026-10-05, Mika : "un tout petit
 * bouton INFO ; pour savoir comment utiliser SMPL on tombe sur un PDF quand
 * meme complet, avec des captures d'ecran aussi, et en FR").
 *
 *   npm run manual:smpl
 *
 * 1. le site en developpement (Vite, sur un port libre ; ou SITE_URL=...
 *    pour un serveur deja lance) ;
 * 2. les captures (shots.mjs) : Chromium sans tete, son coupe, rien ne joue ;
 * 3. la page A4 (content.mjs), imprimee en PDF dans
 *    public/docs/MM-SMPL-mode-emploi.pdf (la touche INFO de la machine
 *    ouverte y mene : OPEN, puis INFO sur la plaque de la carte).
 *
 * Playwright n'est pas une dependance du site : npm i --no-save playwright,
 * puis npx playwright install chromium (ou PLAYWRIGHT_MODULE et
 * CHROMIUM_PATH vers une installation existante). Les captures restent
 * dans le dossier temporaire du systeme (mm-smpl-manual).
 */

import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderManual } from './content.mjs';
import { captureShots } from './shots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'public/docs/MM-SMPL-mode-emploi.pdf');
const WORK = path.join(os.tmpdir(), 'mm-smpl-manual');
const require = createRequire(import.meta.url);

function playwright() {
  for (const id of [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(Boolean)) {
    try {
      return require(id);
    } catch {
      /* le suivant */
    }
  }
  console.error('Playwright est requis : npm i --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

async function site() {
  if (process.env.SITE_URL) return { url: process.env.SITE_URL.replace(/\/$/, ''), close: async () => undefined };
  const { createServer } = await import('vite');
  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.ts'),
    logLevel: 'error',
    server: { port: 5199, strictPort: false, open: false, hmr: false },
  });
  await server.listen();
  const url = (server.resolvedUrls?.local?.[0] ?? 'http://localhost:5199/').replace(/\/$/, '');
  return { url, close: () => server.close() };
}

const today = () => new Date().toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });

async function main() {
  const t0 = Date.now();
  const { chromium } = playwright();
  const linux = process.platform === 'linux';
  const launchOptions = {
    executablePath: process.env.CHROMIUM_PATH || undefined,
    // Le son coupe : aucune capture ne joue, et rien ne sortirait des enceintes
    args: ['--mute-audio', ...(linux ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])],
  };
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });
  const srv = await site();
  console.log(`site : ${srv.url}`);
  let shots;
  try {
    shots = await captureShots({ chromium, launchOptions, url: srv.url, dir: WORK, log: (s) => console.log(s) });
  } finally {
    await srv.close();
  }
  const img = {};
  for (const [name, s] of Object.entries(shots)) {
    img[name] = { ...s, src: `data:image/jpeg;base64,${(await readFile(s.file)).toString('base64')}` };
  }
  const html = await renderManual({ root: ROOT, img, date: today() });
  const htmlFile = path.join(WORK, 'manual.html');
  await writeFile(htmlFile, html);
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await mkdir(path.dirname(OUT), { recursive: true });
    await page.pdf({ path: OUT, format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
  const { size } = await stat(OUT);
  console.log(`${path.relative(ROOT, OUT)} : ${(size / 1024 / 1024).toFixed(2)} Mo, ${Object.keys(shots).length} captures, ${Math.round((Date.now() - t0) / 1000)} s`);
  console.log(`apercu : ${htmlFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
