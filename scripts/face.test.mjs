#!/usr/bin/env node
/**
 * `npm run face:test` (V.6.0, 2026-10-30, la face Digitakt II, docs/v4/dt2/dt2-master-spec.md 2.2, 2.3 et 5.6) : le seul
 * garde-fou automatique de la grille de la face. src/v4/rytm/faceplate.ts (des donnees seules) est compile par esbuild
 * (installe avec vite) et evalue sur place, comme scripts/mm-studio-patterns.mjs le fait de beatcode.ts : aucun fichier
 * ecrit. Il verifie :
 * - la face de la V.5.3 (RYTM_FACEPLATE, celle qui est en ligne) : faceplateCheck() vide ;
 * - la face DT2 (DT2_FACEPLATE, ?face=dt2) : dt2FaceplateCheck() vide (aucune piece hors de la face, aucun chevauchement,
 *   les legendes comprises : les fonctions orange, MAIN VOLUME, LEVEL/DATA et PRESET POOL, les lettres des potards, KB OCT,
 *   TRACK/MUTE, le decalque du cadre de l'ecran ; le jeu entre cadres >= 0.8 mm) ;
 * - la grille de la section 2.2, recopiee ici de la table du cahier (une source a part : un chiffre change dans le code
 *   sans le cahier se voit), contre les centres et les tailles de la face DT2 ;
 * - les ids de zones gardes (2.6) et l'ordre des touches (celui de rytm/dtFaceIds.ts DT2_BUTTONS).
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');

const out = buildSync({ entryPoints: [path.join(ROOT, 'src/v4/rytm/faceplate.ts')], bundle: true, format: 'cjs', write: false, platform: 'neutral', logLevel: 'silent' });
const mod = { exports: {} };
new Function('module', 'exports', out.outputFiles[0].text)(mod, mod.exports);
const F = mod.exports;

let n = 0;
let failed = 0;
const test = (name, fn) => {
  n += 1;
  try {
    fn();
    console.log(`ok ${n} ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`not ok ${n} ${name}`);
    console.log(String(e && e.message ? e.message : e).split('\n').map((l) => `  ${l}`).join('\n'));
  }
};

test('la face de la V.5.3 (en ligne) : aucune piece hors de la face, aucun chevauchement', () => {
  assert.deepEqual(F.faceplateCheck(), []);
});

test('la face DT2 : aucune piece ni legende hors de la face, aucun chevauchement, cadres a 0.8 mm au moins', () => {
  assert.deepEqual(F.dt2FaceplateCheck(), []);
});

/** La table 2.2 du cahier : centre (mm) et classe (P 12 x 11, L 22 x 11, G 26 x 11) de chaque touche. */
const GRID = {
  func: [19, 83.5, 'L'],
  kbd: [19, 99.5, 'P'],
  trk: [19, 115, 'L'],
  ptn: [19, 129.7, 'L'],
  song: [19, 144.4, 'L'],
  preset: [52, 83.5, 'P'],
  settings: [75.5, 83.5, 'P'],
  sounds: [99, 83.5, 'P'],
  tempo: [122.5, 83.5, 'P'],
  rec: [56.5, 99.5, 'L'],
  play: [87, 99.5, 'L'],
  stop: [117.5, 99.5, 'L'],
  trig: [150, 66.5, 'P'],
  src: [168.4, 66.5, 'P'],
  fltr: [186.8, 66.5, 'P'],
  amp: [205.2, 66.5, 'P'],
  fx: [223.6, 66.5, 'P'],
  mod: [242, 66.5, 'P'],
  yes: [150, 83.5, 'P'],
  up: [186.8, 83.5, 'P'],
  no: [150, 99.5, 'P'],
  left: [168.4, 99.5, 'P'],
  down: [186.8, 99.5, 'P'],
  right: [205.2, 99.5, 'P'],
  ptnpage: [235, 99.5, 'G'],
};
const SIZE = { P: [12, 11], L: [22, 11], G: [26, 11] };
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} au lieu de ${b}`);

test('les 25 touches a leur place et a leur taille (table 2.2)', () => {
  const keys = F.DT2_FACEPLATE.buttons.keys;
  assert.equal(keys.length, 25);
  for (const k of keys) {
    const g = GRID[k.id];
    assert.ok(g, `${k.id}: absente de la table 2.2`);
    const [w, h] = SIZE[g[2]];
    assert.equal(k.cls, g[2], `${k.id}: classe`);
    near(k.rect.x + k.rect.w / 2, g[0], 0.01, `${k.id} cx`);
    near(k.rect.y + k.rect.h / 2, g[1], 0.01, `${k.id} cy`);
    near(k.rect.w, w, 1e-9, `${k.id} w`);
    near(k.rect.h, h, 1e-9, `${k.id} h`);
  }
});

test('les potards, l ecran, le logo M, les LED de page et les TRIG (table 2.2)', () => {
  const D = F.DT2_FACEPLATE;
  const kx = [156, 182.67, 209.33, 236];
  for (let k = 0; k < 8; k += 1) {
    const c = F.dt2KnobCircle(k);
    near(c.cx, kx[k % 4], 0.01, `potard ${k} cx`);
    near(c.cy, [20, 46][k >> 2], 1e-9, `potard ${k} cy`);
    assert.equal(c.d, 24);
  }
  const side = Object.fromEntries(D.side.knobs.map((s) => [s.id, s]));
  assert.deepEqual([side.mvol.cx, side.mvol.cy, side.mvol.d], [19, 19, 20]);
  assert.deepEqual([side.data.cx, side.data.cy, side.data.d], [19, 45, 22]);
  assert.ok(side.mvol.ring.outer <= side.mvol.d && side.data.ring.outer <= side.data.d, 'anneau dans l emprise');
  assert.deepEqual(D.screen.rect, { x: 34, y: 8, w: 106, h: 67 });
  const o = D.open.rect;
  near(o.x + o.w / 2, 19, 1e-9, 'logo cx');
  near(o.y + o.h / 2, 67, 1e-9, 'logo cy');
  assert.deepEqual(D.pageLeds.window, { x: 222, y: 79, w: 26, h: 10 });
  assert.deepEqual([...D.pageLeds.cx], [226, 232, 238, 244]);
  assert.deepEqual([...D.pageLeds.cy], [81.5, 86.5]);
  assert.equal(D.pageLeds.d, 3.4);
  for (let i = 0; i < 16; i += 1) {
    const r = F.dt2StepRect(i);
    near(r.x + r.w / 2, 47 + 27.143 * (i % 8), 0.01, `TRIG ${i + 1} cx`);
    near(r.y + r.h / 2, i < 8 ? 120.5 : 142.5, 1e-9, `TRIG ${i + 1} cy`);
    assert.deepEqual([r.w, r.h], [22, 19]);
  }
  assert.equal(D.steps.voices.length, 0, 'les pas ne portent que leur numero');
});

test('les cadres de la section 2.3', () => {
  const fr = Object.fromEntries(F.DT2_FACEPLATE.frames.map((f) => [f.id, f.rect]));
  assert.deepEqual(fr.knobs, { x: 142, y: 6, w: 108, h: 53 });
  assert.deepEqual(fr.pages, { x: 142, y: 60, w: 108, h: 15.5 });
  assert.deepEqual(fr.arrows, { x: 160, y: 76.5, w: 53, h: 32 });
  assert.deepEqual(fr.trigs, { x: 34, y: 109.5, w: 216, h: 44.5 });
});

test('les ids de zones gardes (2.6) et les nouveaux', () => {
  const by = Object.fromEntries(F.DT2_FACEPLATE.buttons.keys.map((k) => [k.id, k.hotspot]));
  const kept = { func: 'func', trk: 'trk', ptn: 'pad-edit', rec: 'rec', play: 'run', stop: 'stop', trig: 'pkey-trig', src: 'pkey-voice', fltr: 'pkey-fltr', amp: 'pkey-env', fx: 'pkey-fx', mod: 'pkey-mod', yes: 'yes', no: 'no' };
  for (const [id, h] of Object.entries(kept)) assert.equal(by[id], h, id);
  for (const id of ['kbd', 'song', 'preset', 'settings', 'sounds', 'tempo', 'up', 'down', 'left', 'right', 'ptnpage']) assert.equal(by[id], id, id);
  assert.equal(new Set(Object.values(by)).size, 25, 'un id de zone par touche');
  assert.equal(F.DT2_FACEPLATE.open.hotspot, 'pad-open');
});

test('la fonction orange de chaque touche (table 2.2) et KB OCT dans le cadre des fleches', () => {
  const alt = Object.fromEntries(F.DT2_FACEPLATE.buttons.keys.map((k) => [k.id, k.alt ?? '']));
  assert.deepEqual(alt, {
    func: '', kbd: 'KB SETUP', trk: 'MUTE MODE', ptn: 'BANK', song: 'SONG EDIT', preset: 'PERFORM', settings: 'SAVE PROJ', sounds: 'SAMPLES', tempo: 'TAP TEMPO',
    rec: 'COPY', play: 'CLEAR', stop: 'PASTE', trig: 'QUANTIZE', src: 'MACHINE', fltr: 'SETUP', amp: 'SEQUENCER', fx: 'SEND FX', mod: 'MIXER',
    yes: 'SAVE', up: 'TRIG MODE', no: 'RELOAD', left: 'uTIME-', down: 'TRIG MODE', right: 'uTIME+', ptnpage: 'FILL/SETUP',
  });
  const kb = F.dt2FaceplateLegends().find((l) => l.id === 'kboct');
  assert.ok(kb.rect.x >= 194 - 1e-9 && kb.rect.x + kb.rect.w <= 210 + 1e-9, `KB OCT de ${kb.rect.x} a ${kb.rect.x + kb.rect.w}`);
});

console.log(`\n${n - failed} / ${n} ok`);
if (failed) process.exit(1);
