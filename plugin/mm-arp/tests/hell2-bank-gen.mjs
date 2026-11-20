// MAQUETTE v44 : extrait HELL2_PRESETS (src/v4/plugin/arp/hell2.ts) et les lois des cercles vers bank.txt pour hell2_proto.cpp.
// hell.ts et hell2.ts sont copies dans un dossier temporaire, leurs imports de la face remplaces par des bouchons.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repo = process.argv[2];
const out = process.argv[3];
const tmp = mkdtempSync(join(tmpdir(), 'hell2-gen-'));
try {
  let h = readFileSync(join(repo, 'src/v4/plugin/arp/hell.ts'), 'utf8');
  h = h.replace("import spec from '../../../../plugin/mm-arp/extra-params.json';", "import spec from './extra-params.json' with { type: 'json' };");
  h = h.replace("import { arpExtra } from './extra';", 'const arpExtra = { get: () => ({}), set: () => {}, of: () => 0, def: () => 0 };');
  writeFileSync(join(tmp, 'hell.ts'), h);
  let h2 = readFileSync(join(repo, 'src/v4/plugin/arp/hell2.ts'), 'utf8');
  h2 = h2.replace("from './hell';", "from './hell.ts';");
  writeFileSync(join(tmp, 'hell2.ts'), h2);
  copyFileSync(join(repo, 'plugin/mm-arp/extra-params.json'), join(tmp, 'extra-params.json'));
  writeFileSync(
    join(tmp, 'run.mjs'),
    `import { HELL2_PRESETS, CIRCLES } from './hell2.ts';
import { HELL_PRESETS } from './hell.ts';
const lines = [];
for (const c of CIRCLES) lines.push('circle ' + c.id + ' ' + c.entry);
for (const p of HELL2_PRESETS) { lines.push('preset ' + p.name); for (const [k, v] of Object.entries(p.v)) lines.push(k + ' ' + v); lines.push('end'); }
for (const p of HELL_PRESETS) { lines.push('old ' + p.name); for (const [k, v] of Object.entries(p.v)) lines.push(k + ' ' + v); lines.push('end'); }
process.stdout.write(lines.join('\\n') + '\\n');
`,
  );
  const txt = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', join(tmp, 'run.mjs')], { encoding: 'utf8' });
  writeFileSync(out, txt);
  console.log(`ecrit ${out} (${txt.split('\n').length} lignes)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
