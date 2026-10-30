#!/usr/bin/env node
/**
 * La liste des exports des modules decoupes en P0 (2026-10-30, la preparation de la refonte Digitakt II,
 * docs/v4/dt2/dt2-master-spec.md 5.0, porte 5) : chaque baril (actions.ts, scene/screen.ts, rytm/infos.ts,
 * midi/targets.ts, debug.ts, theme.ts) doit exporter les memes noms qu'avant son decoupage, ni plus ni moins, avec le
 * meme genre (valeur, type ou les deux). Lu par le compilateur TypeScript (les `export *` resolus), rien n'est execute.
 *
 *   node scripts/exports-check.mjs            compare a scripts/exports.golden.json (V.5.3, ecfb30a) ; 0 identique, 1 un ecart
 *   node scripts/exports-check.mjs --update   reecrit la reference (seulement sur le commit de reference, jamais dans une lane)
 *   --root <dossier>                          un autre depot (une copie propre)
 *
 * TypeScript : le paquet du projet, sinon TYPESCRIPT_MODULE, sinon /opt/node22 (l'environnement de Claude Code).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
};
const ROOT = path.resolve(opt('root', path.join(HERE, '..')));
const GOLDEN = path.join(HERE, 'exports.golden.json');
const UPDATE = argv.includes('--update');
const MODULES = ['src/v4/actions.ts', 'src/v4/scene/screen.ts', 'src/v4/rytm/infos.ts', 'src/v4/midi/targets.ts', 'src/v4/debug.ts', 'src/v4/theme.ts'];

const require = createRequire(import.meta.url);
function typescript() {
  for (const id of ['typescript', process.env.TYPESCRIPT_MODULE, '/opt/node22/lib/node_modules/typescript'].filter(Boolean)) {
    try {
      return require(id);
    } catch {
      /* le suivant */
    }
  }
  console.error('exports-check : TypeScript est requis (npm i --no-save typescript)');
  process.exit(2);
}
const ts = typescript();

const cfgPath = path.join(ROOT, 'tsconfig.json');
const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(cfgPath, ts.sys.readFile).config, ts.sys, ROOT);
// Seulement les barils et ce qu'ils atteignent (plus rapide que tout src)
const roots = MODULES.map((m) => path.join(ROOT, m)).map((f) => (existsSync(f) ? f : f.replace(/\.ts$/, '/index.ts')));
const program = ts.createProgram(roots, { ...cfg.options, noEmit: true });
const checker = program.getTypeChecker();

const list = {};
for (const [k, f] of MODULES.map((m, i) => [m, roots[i]])) {
  const sf = program.getSourceFile(f);
  if (!sf) {
    list[k] = null;
    continue;
  }
  const sym = checker.getSymbolAtLocation(sf);
  const out = [];
  for (const e of checker.getExportsOfModule(sym)) {
    const s = e.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(e) : e;
    const value = !!(s.flags & ts.SymbolFlags.Value);
    const type = !!(s.flags & ts.SymbolFlags.Type);
    out.push(`${e.name} ${value ? 'v' : ''}${type ? 't' : ''}`);
  }
  list[k] = out.sort();
}

if (UPDATE) {
  writeFileSync(GOLDEN, `${JSON.stringify({ note: 'scripts/exports-check.mjs : les exports des barils decoupes en P0, lus sur V.5.3 (ecfb30a). Ne jamais regenerer dans une lane.', ref: opt('ref', 'ecfb30a'), modules: list }, null, 1)}\n`);
  console.log(`ecrit : ${path.relative(process.cwd(), GOLDEN)} (${Object.values(list).reduce((n, l) => n + (l?.length ?? 0), 0)} exports)`);
  process.exit(0);
}

const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
let fail = false;
for (const m of MODULES) {
  const a = new Set(list[m] ?? []);
  const b = new Set(golden.modules[m] ?? []);
  const plus = [...a].filter((x) => !b.has(x));
  const minus = [...b].filter((x) => !a.has(x));
  if (plus.length || minus.length) fail = true;
  console.log(`${plus.length || minus.length ? 'ECART' : 'OK   '} ${m.padEnd(26)} ${a.size} exports${plus.length ? `  en plus : ${plus.join(', ')}` : ''}${minus.length ? `  en moins : ${minus.join(', ')}` : ''}`);
}
console.log(fail ? 'exports-check : ECART' : 'exports-check : identique');
process.exit(fail ? 1 : 0);
