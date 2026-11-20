// Genere plugin/mm-arp/tests/hell2_presets.inc depuis le VRAI src/v4/plugin/arp/hell2.ts (v46) : HELL2_PRESETS, les
// valeurs 0..1 que la page HELL envoie au plugin (xHellV2, les reglages d'ECHO, les cercles II a VI), et l'entree de
// chaque cercle sur la course de MIX (CIRCLES), que tests/hell2_test.cpp compare a Hell2::kEntry.
// hell.ts et hell2.ts sont copies dans un dossier temporaire et lances avec --experimental-strip-types (comme
// hell-presets-gen.mjs) : l'import de ./extra (l'etat de la face) est remplace par un bouchon, aucune dependance npm.
// Usage : node plugin/mm-arp/tests/hell2-presets-gen.mjs            ecrit tests/hell2_presets.inc
//         node plugin/mm-arp/tests/hell2-presets-gen.mjs --check    n'ecrit rien ; code 1 si le fichier differe (le CI)
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const target = join(here, 'hell2_presets.inc');
const check = process.argv.includes('--check');

const swap = (code, from, to) => {
  if (!code.includes(from)) throw new Error(`import introuvable (${from})`);
  return code.replace(from, to);
};
const SPEC = "import spec from '../../../../plugin/mm-arp/extra-params.json';";
const SPEC_TMP = "import spec from './extra-params.json' with { type: 'json' };";
let h = readFileSync(join(repo, 'src/v4/plugin/arp/hell.ts'), 'utf8');
h = swap(h, SPEC, SPEC_TMP);
h = swap(h, "import { arpExtra } from './extra';", 'const arpExtra = { get: () => ({}), set: () => {}, of: () => 0, def: () => 0 };');
let h2 = readFileSync(join(repo, 'src/v4/plugin/arp/hell2.ts'), 'utf8');
h2 = swap(h2, SPEC, SPEC_TMP);
h2 = swap(h2, "from './hell';", "from './hell.ts';");

const tmp = mkdtempSync(join(tmpdir(), 'mmarp-hell2-gen-'));
let out;
try {
  writeFileSync(join(tmp, 'hell.ts'), h);
  writeFileSync(join(tmp, 'hell2.ts'), h2);
  copyFileSync(join(repo, 'plugin/mm-arp/extra-params.json'), join(tmp, 'extra-params.json'));
  writeFileSync(
    join(tmp, 'run.mjs'),
    `import { HELL2_PRESETS, CIRCLES } from './hell2.ts';
process.stdout.write(JSON.stringify({ circles: CIRCLES.map((c) => ({ id: c.id, entry: c.entry })), bank: HELL2_PRESETS.map((p) => ({ name: p.name, desc: p.desc, v: p.v })) }));
`,
  );
  out = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', join(tmp, 'run.mjs')], { encoding: 'utf8' }));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const { circles, bank } = out;
const keys = Object.keys(bank[0].v);
for (const p of bank) {
  if (Object.keys(p.v).join() !== keys.join()) throw new Error(`hell2.ts : ${p.name} n'a pas les memes reglages que ${bank[0].name}`);
  for (const k of keys) if (!Number.isFinite(p.v[k])) throw new Error(`hell2.ts : ${p.name}.${k} n'est pas un nombre`);
}
const q = (s) => JSON.stringify(String(s));
let s = '// GENERE par tests/hell2-presets-gen.mjs depuis src/v4/plugin/arp/hell2.ts (HELL2_PRESETS, CIRCLES) : ne pas editer.\n';
s += `static const int kHell2PresetKeys = ${keys.length};\n`;
s += `static const char* const kHell2PresetIds[${keys.length}] = {${keys.map(q).join(', ')}};\n`;
s += `struct Hell2PresetRef { const char* name; const char* desc; double v[${keys.length}]; };\n`;
s += `static const Hell2PresetRef kHell2Presets[${bank.length}] = {\n`;
for (const p of bank) s += `    {${q(p.name)}, ${q(p.desc)}, {${keys.map((k) => JSON.stringify(p.v[k])).join(', ')}}},\n`;
s += '};\n';
s += `static const double kHell2CircleEntry[${circles.length}] = {${circles.map((c) => JSON.stringify(c.entry)).join(', ')}}; // ${circles.map((c) => c.id).join(' ')}\n`;

if (check) {
  if (!existsSync(target) || readFileSync(target, 'utf8') !== s) {
    console.error("hell2-presets-gen : tests/hell2_presets.inc n'est pas a jour (node plugin/mm-arp/tests/hell2-presets-gen.mjs)");
    process.exit(1);
  }
  console.log(`hell2-presets-gen : a jour (${bank.length} presets)`);
} else {
  writeFileSync(target, s);
  console.log(`hell2-presets-gen : ${bank.length} presets ecrits`);
}
