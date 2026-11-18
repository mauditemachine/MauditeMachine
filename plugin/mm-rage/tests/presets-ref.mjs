// MM-RAGE : la reference des 20 presets de la DISTO du MM-ARP (src/v4/plugin/arp/disto.ts DISTO_PRESETS), tiree du vrai
// fichier de la branche du MM-ARP, pour tests/presets_test.cpp (les 20 de THE CLASSICS doivent etre ceux-la, valeur par
// valeur). disto.ts tourne tel quel dans Node (>= 22.6, --experimental-strip-types : rien a installer) ; ses imports
// relatifs recoivent leur extension, le JSON son attribut ; seuls ses voisins qui touchent au navigateur (voyager/params,
// extra) sont remplaces par des bouchons, LFO_BEAT_NAMES est relu dans hell.ts.
//   node plugin/mm-rage/tests/presets-ref.mjs [ref git du MM-ARP]   -> ecrit plugin/mm-rage/tests/presets_ref.inc
//   node plugin/mm-rage/tests/presets-ref.mjs --check                -> echoue si le fichier n'est plus a jour
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const check = args.includes('--check');
const ref = args.find((a) => !a.startsWith('--')) ?? 'origin/claude/nifty-bohr-7ixmpf';
const out = join(here, 'presets_ref.inc');

const git = (path) => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
const work = mkdtempSync(join(tmpdir(), 'mmrage-ref-'));
const put = (rel, body) => {
  mkdirSync(dirname(join(work, rel)), { recursive: true });
  writeFileSync(join(work, rel), body);
};
put('plugin/mm-arp/extra-params.json', git('plugin/mm-arp/extra-params.json'));
// les imports a la mode de Node : extension .ts, attribut du JSON
const disto = git('src/v4/plugin/arp/disto.ts')
  .replace(/from '(\.\.?\/[^']*)';/g, (_, m) => (m.endsWith('.json') ? `from '${m}' with { type: 'json' };` : `from '${m}.ts';`));
put('src/v4/plugin/arp/disto.ts', disto);
// les bouchons : disto.ts n'en lit rien pour construire ses presets
put('src/v4/voyager/params.ts', 'export const voyParams = { of: () => 0, set: () => {} };\n');
put('src/v4/plugin/arp/extra.ts', 'export const arpExtra = { of: () => 0, set: () => {} };\n');
const hell = git('src/v4/plugin/arp/hell.ts');
const beats = /export const LFO_BEAT_NAMES = (\[[^\]]*\]) as const;/.exec(hell);
if (!beats) throw new Error('LFO_BEAT_NAMES introuvable dans hell.ts');
put('src/v4/plugin/arp/hell.ts', `export const LFO_BEAT_NAMES = ${beats[1]} as const;\n`);
put(
  'entry.ts',
  "import { DISTO_PRESETS } from './src/v4/plugin/arp/disto.ts';\nconsole.log(JSON.stringify(DISTO_PRESETS.map((p) => ({ name: p.name, v: p.v }))));\n",
);
const presets = JSON.parse(
  execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', join(work, 'entry.ts')], { encoding: 'utf8', cwd: work }),
);
const keys = Object.keys(presets[0].v).sort();
let s = `// GENERE par tests/presets-ref.mjs depuis ${ref}:src/v4/plugin/arp/disto.ts : ne pas editer.\n`;
s += `// Les ${presets.length} presets de la DISTO du MM-ARP, leurs reglages 0..1 (dist = DRIVE, xD* = extra-params.json).\n`;
s += `static const char* const kRefKeys[] = {${keys.map((k) => `"${k}"`).join(', ')}};\n`;
s += `static constexpr int kRefKeyCount = ${keys.length};\n`;
s += `static constexpr int kRefCount = ${presets.length};\n`;
s += 'static const char* const kRefNames[] = {\n' + presets.map((p) => `  "${p.name}",`).join('\n') + '\n};\n';
s += 'static const double kRefValues[][' + keys.length + '] = {\n';
for (const p of presets) s += '  {' + keys.map((k) => Number(p.v[k]).toPrecision(17)).join(', ') + '},\n';
s += '};\n';
if (check) {
  let cur = '';
  try {
    cur = readFileSync(out, 'utf8');
  } catch {
    /* absent */
  }
  if (cur !== s) {
    console.error('presets_ref.inc n\'est plus a jour : relancer node plugin/mm-rage/tests/presets-ref.mjs');
    process.exit(1);
  }
  console.log(`presets_ref.inc a jour (${presets.length} presets)`);
} else {
  writeFileSync(out, s);
  console.log(`ecrit ${out} (${presets.length} presets, ${keys.length} reglages)`);
}
