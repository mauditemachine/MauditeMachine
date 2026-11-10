// Genere plugin/mm-arp/src/ExtraTable.inc depuis plugin/mm-arp/extra-params.json (les reglages du VST3 seul).
//   node plugin/mm-arp/tests/extra-gen.mjs            ecrit le fichier
//   node plugin/mm-arp/tests/extra-gen.mjs --check    code 1 s'il n'est pas a jour (CI)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const { params } = JSON.parse(readFileSync(join(here, '../extra-params.json'), 'utf8'));
const out = join(here, '../src/ExtraTable.inc');
const q = (s) => JSON.stringify(String(s));
let s = '// GENERE par tests/extra-gen.mjs depuis extra-params.json : ne pas editer.\n';
s += `enum ExtraId { ${params.map((p) => `ex_${p.id}`).join(', ')}, ex_COUNT };\n`;
for (const p of params) {
  if (p.steps) s += `static const char* const kExSteps_${p.id}[] = { ${p.steps.map(q).join(', ')} };\n`;
  if (p.beats) s += `static const double kExBeats_${p.id}[] = { ${p.beats.join(', ')} };\n`;
}
s += 'static const ExtraDef kExtraDefs[ex_COUNT] = {\n';
for (const p of params) s += `  { ${q(p.id)}, ${q(p.label)}, ${q(p.section)}, ${p.def}, ${p.steps ? p.steps.length : 0}, ${p.steps ? `kExSteps_${p.id}` : 'nullptr'} },\n`;
s += '};\n';
if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== s) { console.error('extra-gen : src/ExtraTable.inc n\'est pas a jour'); process.exit(1); }
  console.log(`extra-gen : a jour (${params.length} reglages)`);
} else { writeFileSync(out, s); console.log(`extra-gen : ${params.length} reglages ecrits`); }
