/**
 * Les captures du mode d'emploi du MM-SMPL (2026-10-05) : le site en
 * developpement (Vite), un Chromium sans tete pilote par Playwright, la
 * boucle de loop.mjs posee dans la machine. Rien ne joue jamais (aucun pad,
 * aucun PLAY, le son coupe) : seuls l'etat et l'image comptent.
 * Chaque capture rend son fichier JPEG, sa taille et ses reperes (les
 * commandes de la machine, en parts de l'image) pour les pastilles
 * numerotees du document.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { makeLoopWav } from './loop.mjs';

const DESK = { width: 1440, height: 900, dpr: 2 };
const PHONE = { width: 390, height: 844, dpr: 3 };
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const SAMPLE_NAME = 'MAUDITE LOOP 120';

/** Une sequence fixe (les captures ne bougent pas d'une fois a l'autre). */
const STEPS = [0, null, 2, 3, 4, null, 6, 1, 8, null, 10, 11, 0, 13, null, 15];

/** Tout le DOM par-dessus la scene s'efface (l'en-tete, les boutons), sauf ce qu'on garde. */
const hideOverlay = (keep = []) => `
  .v4-root *:not(canvas) { visibility: hidden !important; }
  .v4-root canvas { visibility: visible !important; }
  ${keep.map((k) => `.v4-root ${k}, .v4-root ${k} * { visibility: visible !important; }`).join('\n')}
`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function captureShots({ chromium, launchOptions, url, dir, log = () => {} }) {
  const browser = await chromium.launch(launchOptions);
  logTo = log;
  const out = {};
  const loop = makeLoopWav().toString('base64');
  try {
    /* ---------------- desktop ---------------- */
    const desk = await browser.newContext({ viewport: { width: DESK.width, height: DESK.height }, deviceScaleFactor: DESK.dpr, colorScheme: 'dark' });
    await desk.addInitScript(() => {
      try {
        sessionStorage.setItem('mm.v4.install', '1');
      } catch {
        /* rien */
      }
    });
    const page = await desk.newPage();
    page.on('pageerror', (e) => log(`page error: ${e.message}`));
    await open(page, `${url}/?m=smpl&mute=1&debug=1`, log);
    await loadLoop(page, loop);
    await setup(page, { slicing: 16 });

    // La couverture : de biais, sans rien par-dessus
    let style = await page.addStyleTag({ content: hideOverlay() });
    await view(page, -16, 46, 1.02);
    out.cover = await shot(page, dir, 'cover', DESK, await machineBox(page, 26), 1800);

    // Le tour de la machine : la vue de face, avec INFO
    await style.evaluate((n) => n.remove());
    style = await page.addStyleTag({ content: hideOverlay(['.v4-info-key']) });
    await view(page, 0, 69, 1);
    out.overview = await shot(page, dir, 'overview', DESK, await machineBox(page, 18), 1800, true);

    // De pres, a la meme vue (ses reperes sont justes ; un zoom les decalait) : l'ecran, les touches, les potards
    const screenBox = async () => grow(await rectOf(page, 'smpl-screen'), 0.02);
    out.screenSlice = await shot(page, dir, 'screen-slice', DESK, await screenBox(), 1500, true);

    await say(page, 'FILTER LP 2.4 KHZ');
    out.screenMessage = await shot(page, dir, 'screen-message', DESK, await screenBox(), 1100);
    await say(page, null);

    await setup(page, { slicing: 'auto' });
    out.screenAuto = await shot(page, dir, 'screen-auto', DESK, await screenBox(), 1500, true);

    await setup(page, { slicing: 8 });
    out.screenEight = await shot(page, dir, 'screen-eight', DESK, await screenBox(), 1100);

    await setup(page, { slicing: 16, region: [0.25, 0.75] });
    out.screenRegion = await shot(page, dir, 'screen-region', DESK, await screenBox(), 1100);

    await setup(page, { slicing: 16, region: [0, 1], mode: 'grain', position: 0.34 });
    out.screenGrain = await shot(page, dir, 'screen-grain', DESK, await screenBox(), 1500, true);

    out.knobs = await shot(page, dir, 'knobs', DESK, await unionOf(page, /^smpl-knob-(start|end|attack|release|filter|position|scan|size|density|spray)$/, 0.06, 0.16), 1500, true);
    out.perf = await shot(page, dir, 'perf', DESK, await unionOf(page, /^smpl-knob-(level|pitch)$/, 0.2, 0.2), 600, true);
    out.keys = await shot(page, dir, 'keys', DESK, await unionOf(page, /^smpl-key-/, 0.02, 0.9), 1700, true);

    await setup(page, { mode: 'slice', steps: STEPS, edit: true });
    out.edit = await shot(page, dir, 'edit', DESK, await machineBox(page, 18), 1800, true);
    out.screenEdit = await shot(page, dir, 'screen-edit', DESK, await screenBox(), 1500, true);
    await setup(page, { edit: false, steps: Array(16).fill(null) });

    // Le mixer du MM-DECKS : LOOP > SMPL
    await page.goto(`${url}/?m=dj&mute=1&debug=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__v4?.stage && window.__v4.stage.hit.ids().includes('dj-export'), null, { timeout: 120000 });
    await wait(6000);
    await page.addStyleTag({ content: hideOverlay() });
    // La vue de la table telle qu'elle arrive (un zoom sortirait l'en-tete du cadre) : MIXER, ADD DECK, LOOP > SMPL
    await settle(page, 'dj-export');
    const ex = await rectOf(page, 'dj-export');
    const add = await rectOf(page, 'dj-adddeck');
    const x0 = add.x - add.w * 5.6;
    const x1 = ex.x + ex.w * 2.7;
    out.mixer = await shot(page, dir, 'mixer', DESK, { x: x0, y: ex.y - ex.h * 0.9, w: x1 - x0, h: ex.h * 3.4 }, 1000, true);
    await desk.close();

    /* ---------------- telephone ---------------- */
    const phone = await browser.newContext({
      userAgent: IPHONE_UA,
      viewport: { width: PHONE.width, height: PHONE.height },
      deviceScaleFactor: PHONE.dpr,
      isMobile: true,
      hasTouch: true,
      colorScheme: 'dark',
    });
    await phone.addInitScript(() => {
      try {
        sessionStorage.setItem('mm.v4.install', '1');
        localStorage.setItem('mm.v4.sdock', 'closed');
      } catch {
        /* rien */
      }
    });
    const ph = await phone.newPage();
    ph.on('pageerror', (e) => log(`phone page error: ${e.message}`));
    await open(ph, `${url}/?m=smpl&mute=1&debug=1`, log);
    await loadLoop(ph, loop);
    await setup(ph, { slicing: 16 });
    await wait(1500);
    out.phoneMachine = await shot(ph, dir, 'phone-machine', PHONE, full(PHONE), 760);
    // Le Dock : sa languette, puis ses pages
    await ph.locator('[aria-controls="v4-sdock"]').tap();
    await wait(1800);
    for (const [name, tab] of [
      ['phonePads', 'PADS'],
      ['phoneSample', 'SAMPLE'],
      ['phoneGrain', 'GRAIN'],
    ]) {
      await ph.locator('#v4-sdock [role=tab]', { hasText: tab }).tap();
      await wait(1500);
      out[name] = await shot(ph, dir, `phone-${tab.toLowerCase()}`, PHONE, full(PHONE), 760);
    }
    await phone.close();
  } finally {
    await browser.close();
  }
  return out;
}

/* ---------------- la page ---------------- */

async function open(page, href, log) {
  const t0 = Date.now();
  await page.goto(href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__v4?.smpl?.state && window.__v4?.stage?.smpl, null, { timeout: 180000 });
  await page.evaluate(async () => {
    const [A, S, Q, P] = await Promise.all([
      import('/src/v4/smpl/actions.ts'),
      import('/src/v4/smpl/state.ts'),
      import('/src/v4/smpl/seq.ts'),
      import('/src/v4/smpl/params.ts'),
    ]);
    window.__manual = { A, S, Q, P };
  });
  // L'arrivee de la camera, les polices, les textures
  await wait(7000);
  log(`  ${href.replace(/^https?:\/\/[^/]+/, '')} pret en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

async function loadLoop(page, b64) {
  await page.evaluate(
    async ({ b64, name }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await window.__manual.A.smplLoadFile(new File([bytes], `${name}.wav`, { type: 'audio/wav' }));
      window.__manual.S.smplState.say(null);
    },
    { b64, name: SAMPLE_NAME }
  );
  await wait(1200);
}

/** L'etat de la machine, sans rien jouer. */
async function setup(page, o) {
  await page.evaluate((o) => {
    const { A, S, Q, P } = window.__manual;
    if (o.region) {
      P.smplParams.set('start', o.region[0]);
      P.smplParams.set('end', o.region[1]);
    }
    if (o.position !== undefined) P.smplParams.set('position', o.position);
    if (o.slicing !== undefined) S.smplState.set({ slicing: o.slicing });
    if (o.mode !== undefined) S.smplState.set({ mode: o.mode });
    A.reslice();
    if (o.steps) Q.smplSeq.setAll(o.steps);
    if (o.edit !== undefined) Q.smplSeq.setEdit(o.edit);
    S.smplState.say(null);
  }, o);
  await wait(1600);
}

/** Une ligne de message a l'ecran (celle d'un potard qu'on tourne), le temps de la capture. */
async function say(page, text) {
  await page.evaluate((t) => window.__manual.S.smplState.say(t, 600000), text);
  await wait(1200);
}

async function view(page, az, el, zoom) {
  await page.evaluate(
    ({ az, el, zoom }) => {
      const st = window.__v4.stage;
      st.orbit.set(az, el, zoom, true);
      st.invalidate?.();
      window.__v4.invalidate?.();
    },
    { az, el, zoom }
  );
  await settle(page);
}

/** La vue posee : le cadrage fini (les reperes ne bougent plus d'une image a l'autre), puis une image de plus. */
async function settle(page, id = null) {
  const probe = () =>
    page.evaluate((id) => {
      const st = window.__v4.stage;
      st.invalidate?.();
      const ids = st.hit.ids();
      const i = id ? ids.indexOf(id) : ids.findIndex((x) => x.startsWith('smpl-') || x === 'dj-export');
      if (i < 0) return '';
      const b = st.hit.rects();
      return [b[i * 4], b[i * 4 + 1], b[i * 4 + 2], b[i * 4 + 3]].map((v) => Math.round(v)).join(',');
    }, id);
  let last = await probe();
  for (let n = 0; n < 30; n += 1) {
    await wait(900);
    const now = await probe();
    if (now === last && now !== '') break;
    last = now;
  }
  await wait(1200);
}

/** Le rectangle d'une commande (px CSS de la page). */
async function rectOf(page, id) {
  const r = await page.evaluate((id) => {
    const st = window.__v4.stage;
    const i = st.hit.ids().indexOf(id);
    if (i < 0) return null;
    const b = st.hit.rects();
    const c = st.renderer.domElement.getBoundingClientRect();
    return { x: c.left + b[i * 4], y: c.top + b[i * 4 + 1], w: b[i * 4 + 2], h: b[i * 4 + 3] };
  }, id);
  if (!r) throw new Error(`pas de commande ${id}`);
  return r;
}

/** Les rectangles des commandes du MM-SMPL, et la touche INFO (le DOM). */
async function marksOf(page) {
  return page.evaluate(() => {
    const st = window.__v4.stage;
    const ids = st.hit.ids();
    const b = st.hit.rects();
    const c = st.renderer.domElement.getBoundingClientRect();
    const m = {};
    ids.forEach((id, i) => {
      if (id.startsWith('smpl-') || id === 'dj-export') m[id] = { x: c.left + b[i * 4], y: c.top + b[i * 4 + 1], w: b[i * 4 + 2], h: b[i * 4 + 3] };
    });
    const k = document.querySelector('.v4-info-key');
    if (k && k.style.visibility === 'visible') {
      const r = k.getBoundingClientRect();
      m.info = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return m;
  });
}

/** L'emprise de commandes (une expression sur leurs ids), elargie (parts de sa largeur, de sa hauteur). */
async function unionOf(page, re, mx, my) {
  const m = await marksOf(page);
  const boxes = Object.entries(m)
    .filter(([id]) => re.test(id))
    .map(([, r]) => r);
  if (boxes.length === 0) throw new Error(`rien pour ${re}`);
  const x0 = Math.min(...boxes.map((r) => r.x));
  const y0 = Math.min(...boxes.map((r) => r.y));
  const x1 = Math.max(...boxes.map((r) => r.x + r.w));
  const y1 = Math.max(...boxes.map((r) => r.y + r.h));
  const w = x1 - x0;
  const h = y1 - y0;
  return { x: x0 - w * mx, y: y0 - h * my, w: w * (1 + 2 * mx), h: h * (1 + 2 * my) };
}

/** Toute la machine : ses commandes, plus une marge (px CSS) pour le corps. */
async function machineBox(page, pad) {
  const b = await unionOf(page, /^smpl-/, 0, 0);
  return { x: b.x - pad * 2.2, y: b.y - pad * 4.4, w: b.w + pad * 4.4, h: b.h + pad * 7.2 };
}

const grow = (r, k) => ({ x: r.x - r.w * k, y: r.y - r.h * k * 2, w: r.w * (1 + 2 * k), h: r.h * (1 + 4 * k) });
const full = (v) => ({ x: 0, y: 0, w: v.width, h: v.height });

let logTo = () => {};

/** Une capture : decoupee, a sa largeur, en JPEG ; ses reperes en parts de l'image. */
async function shot(page, dir, name, vp, clip, width, withMarks = false) {
  const t0 = Date.now();
  const png = await page.screenshot({ type: 'png', timeout: 180000 });
  logTo(`  ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const W = vp.width * vp.dpr;
  const H = vp.height * vp.dpr;
  const left = Math.max(0, Math.round(clip.x * vp.dpr));
  const top = Math.max(0, Math.round(clip.y * vp.dpr));
  const ext = { left, top, width: Math.min(W - left, Math.round(clip.w * vp.dpr)), height: Math.min(H - top, Math.round(clip.h * vp.dpr)) };
  // Jamais agrandie (le PDF garde les pixels de la capture)
  width = Math.min(width, ext.width);
  const height = Math.round((width * ext.height) / ext.width);
  const file = path.join(dir, `${name}.jpg`);
  const jpg = await sharp(png).extract(ext).resize({ width, height }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  await writeFile(file, jpg);
  const box = { x: ext.left / vp.dpr, y: ext.top / vp.dpr, w: ext.width / vp.dpr, h: ext.height / vp.dpr };
  const marks = {};
  if (withMarks) {
    for (const [id, r] of Object.entries(await marksOf(page))) {
      marks[id] = { x: (r.x - box.x) / box.w, y: (r.y - box.y) / box.h, w: r.w / box.w, h: r.h / box.h };
    }
  }
  return { file, w: width, h: height, bytes: jpg.length, marks };
}
