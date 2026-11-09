// Reference des potards du MM-ARP (2026-11-09) : fait tourner le VRAI JS du site (src/v4/voyager/params.ts, chords.ts,
// seq.ts, et volGain de src/v4/audio/synth.ts, extrait de la source : synth.ts importe le Web Audio) sur des jeux de
// potards tires au hasard (graine fixe : extremes 0 et 1, crans pile, frontieres de crans, seuils OFF, moities de
// Math.round), des progressions et des suites EDIT au hasard, et ecrit <out>/params-cases.txt pour
// tests/params_test.cpp. Copie les modules dans <out>/src, lances avec --experimental-strip-types : aucune dependance
// npm, aucun son (aucun AudioContext).
//   node plugin/mm-arp/tests/params-ref.mjs <dossier-de-sortie> [nombre de cas, 3000 par defaut]
// L'arpege suit plugin/arp/bridge.ts compile() : seq.steps (la logique recopiee pour des potards bruts ; sur un cas sur
// cinq, aux potards arrondis comme le site, le vrai seq.steps du module, et la recopie lui est comparee ici meme).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const out = resolve(process.argv[2] ?? join(here, '.params-ref'));
const count = Number(process.argv[3] ?? 3000);
const src = join(out, 'src');
mkdirSync(src, { recursive: true });

const fix = (code) => code.replace(/from '\.\/(params|chords|seq)'/g, "from './$1.ts'");
for (const f of ['params', 'chords', 'seq']) writeFileSync(join(src, `${f}.ts`), fix(readFileSync(join(repo, 'src/v4/voyager', `${f}.ts`), 'utf8')));
// volGain de audio/synth.ts, tel quel, avec ses deux constantes
{
  const syn = readFileSync(join(repo, 'src/v4/audio/synth.ts'), 'utf8');
  const pick = (re, what) => {
    const m = syn.match(re);
    if (!m) throw new Error(`audio/synth.ts : ${what} introuvable`);
    return m[0];
  };
  const parts = [
    "import type { VoyValues } from './params.ts';",
    pick(/^const VOLUME_K = [^;]+;$/m, 'VOLUME_K'),
    pick(/^const MAKEUP = [^;]+;$/m, 'MAKEUP'),
    pick(/^export const volGain = [^\n]+;$/m, 'volGain'),
  ];
  writeFileSync(join(src, 'synthlaws.ts'), parts.join('\n') + '\n');
}

const runner = String.raw`
import { writeFileSync } from 'node:fs';
// Le store du site sans navigateur : un localStorage vide, des minuteries muettes
globalThis.window = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 },
  setTimeout: () => 0,
  clearTimeout() {},
};
const P = await import('./params.ts');
const C = await import('./chords.ts');
const Q = await import('./seq.ts');
const S = await import('./synthlaws.ts');
const [outPath, countArg] = process.argv.slice(2);
const N = Number(countArg);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261109);
const ri = (n) => Math.floor(rnd() * n);
const K = P.VOY_KNOBS;
const below = (x) => x - x * Number.EPSILON;
const SPECIAL = [0.04, 0.02, below(0.04), below(0.02), 0.075, below(0.075), 0.6, 0.05, 0.5, 0.995, 0.005];

function pickValue(k) {
  const r = rnd();
  const n = k.steps ? k.steps.length : 0;
  if (r < 0.1) return 0;
  if (r < 0.2) return 1;
  if (n > 1 && r < 0.34) return ri(n) / (n - 1);
  if (n > 1 && r < 0.48) {
    // la frontiere entre deux crans (Math.round a la moitie), ou les bords du repere d'un morphing (0.04)
    const j = ri(n - 1);
    const f = k.morph ? [0.5, 0.04, 0.96, below(0.04)][ri(4)] : 0.5;
    return (j + f) / (n - 1);
  }
  if (r < 0.56) return SPECIAL[ri(SPECIAL.length)];
  if (r < 0.66) return ri(201) / 200;
  if (r < 0.78) return ri(1001) / 1000;
  return rnd();
}

function knobsOf(i) {
  const v = {};
  for (const k of K) {
    if (i === 0) v[k.id] = k.def;
    else if (i === 1) v[k.id] = 0;
    else if (i === 2) v[k.id] = 1;
    else if (i === 3) v[k.id] = k.legacy ?? k.def;
    else v[k.id] = pickValue(k);
  }
  return v;
}

// voyParams.set : la valeur telle que le site la garde (clean)
function cleanOf(v) {
  const o = {};
  for (const k of K) {
    P.voyParams.set(k.id, v[k.id]);
    o[k.id] = P.voyParams.of(k.id);
  }
  return o;
}

// seq.steps(c), la logique du module pour des potards quelconques
function stepsOf(st, c, p) {
  if (st.edit) return st.buf.slice(0, st.len);
  return P.stepIndex('mode', p.mode) === 3 ? null : Q.poolSteps(c, p, P.stepIndex('mode', p.mode));
}

const L = [];
L.push('H ' + K.length);
for (const k of K) L.push(['D', k.id, k.label, k.section, String(k.def), k.legacy === undefined ? 'null' : String(k.legacy), k.morph ? '1' : '0', k.steps ? k.steps.join('|') : ''].join('\t'));
L.push('N ' + N);
let checked = 0;
for (let i = 0; i < N; i += 1) {
  let v = knobsOf(i);
  const clean = cleanOf(v);
  const real = i % 5 === 4;
  if (real) v = clean;
  const st = {
    edit: i > 3 && rnd() < 0.5,
    len: 1 + ri(16),
    buf: Array.from({ length: 16 }, () => (rnd() < 0.15 ? null : -7 + ri(32))),
  };
  const nProg = i < 4 ? 8 : 1 + ri(8);
  const prog = i < 4 ? [0, 1, 2, 3, 4, 5, 6, 7] : Array.from({ length: nProg }, () => ri(8));

  // bridge.ts compile, partie arp
  const shift = 12 * P.octaveShift(v.octave);
  const chords = [];
  if (real) {
    // le vrai store : les potards (deja propres) et la suite
    for (const k of K) P.voyParams.set(k.id, v[k.id]);
    Q.seq.restore({ edit: st.edit, buf: st.buf, len: st.len, has: true });
  }
  for (const c of prog) {
    if (chords.some((x) => x.c === c)) continue;
    const steps = stepsOf(st, c, v);
    if (real) {
      const want = Q.seq.steps(c);
      if (JSON.stringify(want) !== JSON.stringify(steps)) throw new Error('cas ' + i + ' : la recopie de seq.steps differe du module (' + JSON.stringify(want) + ' / ' + JSON.stringify(steps) + ')');
      checked += 1;
    }
    if (steps) chords.push({ c, rand: 0, midi: steps.map((d) => (d === null ? null : C.degreeMidi(c, d) + shift)) });
    else chords.push({ c, rand: 1, midi: Q.poolSteps(c, v, 0).map((d) => C.degreeMidi(c, d) + shift) });
  }

  L.push('K ' + K.map((k) => String(v[k.id])).join(' '));
  L.push('Q ' + K.map((k) => String(clean[k.id])).join(' '));
  L.push('S ' + (st.edit ? 1 : 0) + ' ' + st.len + ' ' + st.buf.map((d) => (d === null ? 'R' : String(d))).join(' '));
  L.push('P ' + prog.length + ' ' + prog.join(' '));
  const eng = { ...P.engineParams(v), outLevel: S.volGain(v) };
  const ek = Object.keys(eng);
  L.push('E ' + ek.length + ' ' + ek.map((key) => key + ' ' + String(eng[key])).join(' '));
  L.push('F ' + [P.chorusMode(v.chorus), v.delay, v.reverb, P.fxAmount(v.tape), P.monoLowHz(v.monoLow), v.volume, P.delaySixteenths(v.dlyTime)].map(String).join(' '));
  L.push('A ' + [P.stepsPerNote(v.rate), P.gateFrac(v.gate), v.accent, v.drift, chords.length].map(String).join(' '));
  for (const ch of chords) L.push('C ' + ch.c + ' ' + ch.rand + ' ' + ch.midi.length + (ch.midi.length ? ' ' + ch.midi.map((m) => (m === null ? 'R' : String(m))).join(' ') : ''));
  for (const k of K) L.push('X\t' + P.voyValueText(k.id, v[k.id]) + '\t' + P.voyReadout(k.id, v[k.id]));
}
writeFileSync(outPath, L.join('\n') + '\n');
process.stdout.write('params-ref : ' + N + ' cas, ' + K.length + ' potards, seq.steps du module compare a la recopie sur ' + checked + ' accords\n');
`;
writeFileSync(join(src, 'run.mjs'), runner);
const res = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', join(src, 'run.mjs'), join(out, 'params-cases.txt'), String(count)], { encoding: 'utf8' });
process.stdout.write(res);
process.stdout.write(`params-ref : ${join(out, 'params-cases.txt')}\n`);
