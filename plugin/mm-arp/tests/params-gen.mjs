// Genere plugin/mm-arp/dsp/ParamTable.inc depuis le VRAI src/v4/voyager/params.ts (2026-11-09) : les potards du MM-ARP
// (VOY_KNOBS, dans l'ordre : id, label, section, def, legacy, crans, morph) et les tables de valeurs des crans que
// dsp/Params.cpp traduit (OSC_RANGE_SEMI, RATIO_X, LFO_BEATS...), pour que le C++ suive le site sans recopie a la main.
// params.ts est copie dans un dossier temporaire et lance avec --experimental-strip-types (comme tests/voyager-ref.mjs) :
// aucune dependance npm.
// Usage : node plugin/mm-arp/tests/params-gen.mjs            ecrit dsp/ParamTable.inc
//         node plugin/mm-arp/tests/params-gen.mjs --check    n'ecrit rien ; code 1 si le fichier differe (le CI)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const target = join(repo, 'plugin/mm-arp/dsp/ParamTable.inc');
const check = process.argv.includes('--check');

const paramsSrc = readFileSync(join(repo, 'src/v4/voyager/params.ts'), 'utf8');

/* ---- les potards, par le vrai module ---- */
const tmp = mkdtempSync(join(tmpdir(), 'mmarp-params-gen-'));
let knobs;
let consts;
try {
  writeFileSync(join(tmp, 'params.ts'), paramsSrc);
  writeFileSync(
    join(tmp, 'run.mjs'),
    `import * as P from './params.ts';
const knobs = P.VOY_KNOBS.map((k) => ({ id: k.id, label: k.label, section: k.section, def: k.def, legacy: k.legacy ?? null, steps: k.steps ? [...k.steps] : null, morph: k.morph === true }));
const consts = { FMODE_CODE: [...P.FMODE_CODE], LFO_BEATS: [...P.LFO_BEATS], PHASE_FREE: P.PHASE_FREE, DUCK_OFF: P.DUCK_OFF, STACK_MIN: P.STACK_MIN, FX_OFF: P.FX_OFF };
process.stdout.write(JSON.stringify({ knobs, consts }));
`,
  );
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', join(tmp, 'run.mjs')], { encoding: 'utf8' });
  ({ knobs, consts } = JSON.parse(out));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

/* ---- les tables privees du module (non exportees) : lues dans la source ---- */
function constArray(name) {
  const m = paramsSrc.match(new RegExp(`const ${name} = \\[([^\\]]*)\\] as const;`));
  if (!m) throw new Error(`params.ts : la table ${name} est introuvable`);
  return m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const v = Number(s);
    if (!Number.isFinite(v)) throw new Error(`params.ts : ${name} n'est pas numerique (${s})`);
    return v;
  });
}
function inlineArray(fn) {
  // export const stepsPerNote = (v: number): number => [4, 2, 1, 0.5][stepIndex('rate', v)];
  const m = paramsSrc.match(new RegExp(`export const ${fn} = \\(v: number\\): number => \\[([^\\]]*)\\]\\[stepIndex\\('(\\w+)', v\\)\\];`));
  if (!m) throw new Error(`params.ts : la table de ${fn} est introuvable`);
  return { knob: m[2], values: m[1].split(',').map((s) => Number(s.trim())) };
}

const steps = (id) => {
  const k = knobs.find((x) => x.id === id);
  if (!k || !k.steps) throw new Error(`params.ts : le potard a crans ${id} est introuvable`);
  return k.steps.length;
};
const spn = inlineArray('stepsPerNote');
const tables = [
  // [nom C++, valeurs, potard dont le cran indexe la table]
  ['kOscRangeSemi', constArray('OSC_RANGE_SEMI'), 'range1'],
  ['kRatioX', constArray('RATIO_X'), 'ratio'],
  ['kSubShape', constArray('SUB_SHAPE'), 'subWave'],
  ['kLfoShapeCode', constArray('LFO_SHAPE_CODE'), 'lfoShape'],
  ['kDlySixteenths', constArray('DLY_SIXTEENTHS'), 'dlyTime'],
  ['kFmodeCode', consts.FMODE_CODE, 'fmode'],
  ['kLfoBeats', consts.LFO_BEATS, 'lfoRate'],
  ['kStepsPerNote', spn.values, spn.knob],
];
for (const [name, vals, id] of tables) if (vals.length !== steps(id)) throw new Error(`params.ts : ${name} a ${vals.length} valeurs, ${id} ${steps(id)} crans`);
// range2 partage la table de range1 (oscSemis lit stepIndex('range1', ...)) : memes crans
if (steps('range1') !== steps('range2') || steps('semi1') !== steps('semi2')) throw new Error('params.ts : les rangees d\'oscillateurs n\'ont plus les memes crans');

/* ---- le fichier ---- */
const num = (v) => {
  // le plus court qui relit le meme double (String de JS), toujours avec un point : un litteral double en C++
  const s = String(v);
  if (!Number.isFinite(v)) throw new Error(`valeur non finie : ${v}`);
  return /[.e]/.test(s) ? s : `${s}.0`;
};
const str = (s) => {
  if (!/^[\x20-\x7e]*$/.test(s)) throw new Error(`texte non ASCII : ${s}`);
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
};
const ident = (id) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) throw new Error(`id inutilisable en C++ : ${id}`);
  return id;
};

const L = [];
L.push('// GENERE par plugin/mm-arp/tests/params-gen.mjs depuis src/v4/voyager/params.ts : NE PAS EDITER A LA MAIN.');
L.push('// Regenerer : node plugin/mm-arp/tests/params-gen.mjs (le CI : --check). Inclus par dsp/Params.h (MMARP_PARAMTABLE_IDS)');
L.push('// et par dsp/Params.cpp (MMARP_PARAMTABLE_DEFS).');
L.push('');
L.push('#if defined(MMARP_PARAMTABLE_IDS)');
L.push('// Les potards dans l\'ordre de VOY_KNOBS (l\'index d\'un potard dans kKnobDefs et dans les tableaux de valeurs)');
L.push('enum KnobId : int {');
knobs.forEach((k, i) => L.push(`  kn_${ident(k.id)} = ${i},`));
L.push(`  kn_COUNT = ${knobs.length}`);
L.push('};');
L.push('#endif');
L.push('');
L.push('#if defined(MMARP_PARAMTABLE_DEFS)');
L.push('// Les crans nommes');
for (const k of knobs) if (k.steps) L.push(`const char* const kSteps_${k.id}[] = {${k.steps.map(str).join(', ')}};`);
L.push('');
L.push('// { id, label, section, def, legacy (kNaN : sans), nSteps, steps, morph }');
L.push('const KnobDef kKnobDefs[kKnobs] = {');
for (const k of knobs) {
  const st = k.steps ? `${k.steps.length}, kSteps_${k.id}` : '0, nullptr';
  L.push(`    {${str(k.id)}, ${str(k.label)}, ${str(k.section)}, ${num(k.def)}, ${k.legacy === null ? 'kNaN' : num(k.legacy)}, ${st}, ${k.morph}},`);
}
L.push('};');
L.push('');
L.push('// Les valeurs des crans (params.ts), indexees par stepIndex du potard indique');
for (const [name, vals, id] of tables) L.push(`const double ${name}[${vals.length}] = {${vals.map(num).join(', ')}}; // ${id}`);
L.push('');
L.push('// Les seuils (params.ts)');
L.push(`constexpr double kPhaseFree = ${num(consts.PHASE_FREE)};`);
L.push(`constexpr double kDuckOff = ${num(consts.DUCK_OFF)};`);
L.push(`constexpr double kStackMin = ${num(consts.STACK_MIN)};`);
L.push(`constexpr double kFxOff = ${num(consts.FX_OFF)};`);
L.push('#endif');
L.push('');
const text = L.join('\n');

if (check) {
  const cur = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (cur !== text) {
    console.error(`params-gen : ${target} n'est plus a jour avec src/v4/voyager/params.ts ; lancer node plugin/mm-arp/tests/params-gen.mjs`);
    process.exit(1);
  }
  console.log(`params-gen : a jour (${knobs.length} potards)`);
} else {
  writeFileSync(target, text);
  console.log(`params-gen : ${target} ecrit (${knobs.length} potards)`);
}
