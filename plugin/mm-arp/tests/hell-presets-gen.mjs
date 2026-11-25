// Genere plugin/mm-arp/tests/hell_presets.inc depuis le VRAI src/v4/plugin/arp/hell.ts (2026-11-18) : HELL_PRESETS, les
// valeurs 0..1 des reglages xHell* que la face envoie au plugin. tests/hell_test.cpp les passe dans le DSP (Hell.cpp) et
// verifie le sens : un decalage negatif descend, un positif monte (BARBER DOWN, ABYSS, DEEP STAIRS, SULFUR RAIN et
// HELLFIRE SWELL montaient avec la bande DOWN), et ANTI REFL agit sur ceux qui descendent.
// hell.ts est copie dans un dossier temporaire et lance avec --experimental-strip-types (comme params-gen.mjs) : son
// import de ./extra (l'etat de la face) est remplace par un bouchon, aucune dependance npm, aucun son.
// Usage : node plugin/mm-arp/tests/hell-presets-gen.mjs            ecrit tests/hell_presets.inc
//         node plugin/mm-arp/tests/hell-presets-gen.mjs --check    n'ecrit rien ; code 1 si le fichier differe (le CI)
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const target = join(here, 'hell_presets.inc');
const check = process.argv.includes('--check');

const swap = (code, from, to) => {
  if (!code.includes(from)) throw new Error(`hell.ts : import introuvable (${from})`);
  return code.replace(from, to);
};
let src = readFileSync(join(repo, 'src/v4/plugin/arp/hell.ts'), 'utf8');
src = swap(src, "import spec from '../../../../plugin/mm-arp/extra-params.json';", "import spec from './extra-params.json' with { type: 'json' };");
src = swap(src, "import { arpExtra } from './extra';", 'const arpExtra = { get: () => ({}), set: () => {}, of: () => 0, def: () => 0 };');

const tmp = mkdtempSync(join(tmpdir(), 'mmarp-hell-gen-'));
let bank;
try {
  writeFileSync(join(tmp, 'hell.ts'), src);
  copyFileSync(join(repo, 'plugin/mm-arp/extra-params.json'), join(tmp, 'extra-params.json'));
  writeFileSync(
    join(tmp, 'run.mjs'),
    `import { HELL_PRESETS } from './hell.ts';
process.stdout.write(JSON.stringify(HELL_PRESETS.map((p) => ({ name: p.name, desc: p.desc, v: p.v }))));
`,
  );
  bank = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', join(tmp, 'run.mjs')], { encoding: 'utf8' }));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const keys = Object.keys(bank[0].v);
for (const p of bank) {
  if (Object.keys(p.v).join() !== keys.join()) throw new Error(`hell.ts : ${p.name} n'a pas les memes reglages que ${bank[0].name}`);
  for (const k of keys) if (!Number.isFinite(p.v[k])) throw new Error(`hell.ts : ${p.name}.${k} n'est pas un nombre`);
}
const q = (s) => JSON.stringify(String(s));
let s = '// GENERE par tests/hell-presets-gen.mjs depuis src/v4/plugin/arp/hell.ts (HELL_PRESETS) : ne pas editer.\n';
s += `enum HellPresetKey { ${keys.map((k) => `hp_${k}`).join(', ')}, hp_COUNT };\n`;
s += 'struct HellPresetRef { const char* name; const char* desc; double v[hp_COUNT]; };\n';
s += `static const HellPresetRef kHellPresets[${bank.length}] = {\n`;
for (const p of bank) s += `    {${q(p.name)}, ${q(p.desc)}, {${keys.map((k) => JSON.stringify(p.v[k])).join(', ')}}},\n`;
s += '};\n';

if (check) {
  if (!existsSync(target) || readFileSync(target, 'utf8') !== s) {
    console.error("hell-presets-gen : tests/hell_presets.inc n'est pas a jour (node plugin/mm-arp/tests/hell-presets-gen.mjs)");
    process.exit(1);
  }
  console.log(`hell-presets-gen : a jour (${bank.length} presets)`);
} else {
  writeFileSync(target, s);
  console.log(`hell-presets-gen : ${bank.length} presets ecrits`);
}
