#!/usr/bin/env node
/**
 * MM-ARP v43 : lance tests/random-analog.ts (RANDOM de la face mis en banque, sans aucun son). esbuild l'assemble avec
 * le vrai hypno.ts ; les stores de la face qu'il touche en jouant (arp, seq, msg, extra) sont remplaces par des
 * bouchons : seules comptent les fonctions pures du tirage.
 *
 *   node plugin/mm-arp/tests/random-analog.mjs <sortie.json> [N] [graine]
 *   plugin/mm-arp/build-presets/presets_render <sortie.json> --os 4 --bars 4 --csv <mesures.csv>
 */
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUBS = {
  arp: 'export const arp = { set() {}, get: () => ({ prog: [0] }) };',
  seq: 'export const SEQ_MAX = 16; export const seq = { restore() {}, auto() {} };',
  msg: 'export const voyMsg = { show() {} };',
  extra: 'export const arpExtra = { set() {} };',
};
const stub = {
  name: 'stubs',
  setup(b) {
    b.onResolve({ filter: /\/voyager\/(arp|seq|msg)$|^\.\/extra$/ }, (a) => ({ path: a.path.split('/').pop(), namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: STUBS[a.path], loader: 'js' }));
  },
};
const res = await build({ entryPoints: [join(HERE, 'random-analog.ts')], bundle: true, platform: 'node', format: 'esm', write: false, plugins: [stub], logLevel: 'warning' });
const dir = mkdtempSync(join(tmpdir(), 'mmarp-random-'));
const js = join(dir, 'random-analog.mjs');
writeFileSync(js, res.outputFiles[0].text);
const r = spawnSync(process.execPath, [js, ...process.argv.slice(2)], { stdio: 'inherit' });
rmSync(dir, { recursive: true, force: true });
process.exit(r.status ?? 1);
