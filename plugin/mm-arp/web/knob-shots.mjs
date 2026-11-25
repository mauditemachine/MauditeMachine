/**
 * v39 (2026-11-19) : les images des potards d'OPEN en 1024 px (retro/knob-base.png, knob-grip.png, knob-cap.png), rendues
 * par three.js dans Chromium (Playwright) depuis knob-shots.ts : les geometries et les peintures du potard de la face.
 * npm run plugin:arp:knobs [-- <dossier de sortie>] (par defaut src/v4/plugin/arp/retro). Sans aucun son : la page ne
 * joue rien, Chromium est lance muet.
 */
import { build } from 'esbuild';
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const OUT = resolve(process.argv[2] ?? resolve(REPO, 'src/v4/plugin/arp/retro'));
const SIZE = 1024;
const LAYERS = (process.env.KNOB_LAYERS ?? 'base,grip,cap').split(',');
// calage (outil) : KNOB_EXPOSURE=1.3 force l'exposition de toutes les couches rendues
const FORCE = process.env.KNOB_EXPOSURE ? Number(process.env.KNOB_EXPOSURE) : undefined;

/* ---- un PNG RGBA 8 bits, filtre choisi ligne par ligne (zlib seul) ---- */
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i += 1) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
function png(rgba, w, h) {
  const bpp = 4;
  const stride = w * bpp;
  const raw = Buffer.alloc((stride + 1) * h);
  const prev = Buffer.alloc(stride);
  const cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < h; y += 1) {
    const row = rgba.subarray(y * stride, (y + 1) * stride);
    const up = y > 0 ? rgba.subarray((y - 1) * stride, y * stride) : prev;
    let best = 0;
    let bestSum = Infinity;
    for (let f = 0; f < 5; f += 1) {
      const o = cand[f];
      let sum = 0;
      for (let i = 0; i < stride; i += 1) {
        const a = i >= bpp ? row[i - bpp] : 0;
        const b = up[i];
        const c = i >= bpp ? up[i - bpp] : 0;
        let p;
        if (f === 0) p = 0;
        else if (f === 1) p = a;
        else if (f === 2) p = b;
        else if (f === 3) p = (a + b) >> 1;
        else {
          const q = a + b - c;
          const pa = Math.abs(q - a);
          const pb = Math.abs(q - b);
          const pc = Math.abs(q - c);
          p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        const v = (row[i] - p) & 0xff;
        o[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = f;
      }
    }
    raw[y * (stride + 1)] = best;
    cand[best].copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Les pixels presque transparents a zero (couleur comprise) : rien d'invisible ne pese dans le PNG. */
function clean(px) {
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] === 0) px[i] = px[i + 1] = px[i + 2] = 0;
  return px;
}

const bundle = await build({
  entryPoints: [resolve(HERE, 'knob-shots.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  logLevel: 'warning',
  define: { 'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"production","BASE_URL":"/"}' },
});
const js = bundle.outputFiles[0].text;

const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page :', e.message));
  await page.setContent('<!doctype html><html><head><script>window.__MM_PLUGIN__ = "arp";</script></head><body></body></html>');
  await page.addScriptTag({ content: js });
  mkdirSync(OUT, { recursive: true });
  for (const layer of LAYERS) {
    const b64 = await page.evaluate(([l, s, e]) => window.__knobShot(l, s, e ?? undefined), [layer, SIZE, FORCE ?? null]);
    const px = clean(Buffer.from(b64, 'base64'));
    const file = resolve(OUT, `knob-${layer}.png`);
    const data = png(px, SIZE, SIZE);
    writeFileSync(file, data);
    console.log(`${file} : ${SIZE} px, ${(data.length / 1024).toFixed(0)} Ko`);
  }
} finally {
  await browser.close();
}
