/**
 * MM-ARP v43 : RANDOM de la face (src/v4/plugin/arp/hypno.ts) mis en banque, pour le rendre hors ligne et le mesurer
 * comme la banque d'usine (tests/presets_render.cpp : crete, sonie, centroide, part au-dessus de 6 kHz, bas-medium, DC),
 * sans aucun son. N tirages a graine fixe (la meme suite de familles que la face : family, randomPatch, hypnoSeq),
 * chacun depuis les valeurs de depart des potards, au VOLUME de depart (RANDOM ne touche jamais au VOLUME : l'ecart de
 * sonie entre tirages est celui qu'entend Mika). Les regles du son (analog.ts analogFaults) sont verifiees sur chaque
 * tirage : le script sort en erreur si l'une manque.
 *
 *   node plugin/mm-arp/tests/random-analog.mjs <sortie.json> [N] [graine]   (esbuild l assemble avec des bouchons)
 *   plugin/mm-arp/build-presets/presets_render <sortie.json> --os 4 --bars 4 --csv <mesures.csv>
 */
import { writeFileSync } from 'node:fs';
import { VOY_KNOBS } from '../../../src/v4/voyager/params';
import { randomVoyOf } from '../../../src/v4/voyager/random';
import { family, hypnoArp, hypnoSeq, randomPatch, SITE_OF, tameSeq, type HypnoStyle, type RandomFamily } from '../../../src/v4/plugin/arp/hypno';
import { analogFaults, ANALOG_FX_OFF_EXTRA } from '../../../src/v4/plugin/arp/analog';

const out = process.argv[2] ?? 'random-analog.json';
const n = Number(process.argv[3] ?? 48);
let seed = Number(process.argv[4] ?? 20261120) >>> 0;
/** mulberry32 : un hasard reproductible */
const rnd = (): number => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rnd() * xs.length))];
const STYLES: readonly HypnoStyle[] = ['HYPNOTIC', 'PULSE', 'ROLLING'];

const presets = [];
let last: RandomFamily | null = null;
let bad = 0;
for (let i = 0; i < n; i += 1) {
  const fam = family(rnd, last);
  last = fam;
  const site = randomVoyOf(pick(SITE_OF[fam]), rnd);
  const style: HypnoStyle = fam === 'PAD' ? 'HYPNOTIC' : pick(STYLES);
  const h = hypnoSeq(style, rnd);
  const a = hypnoArp(style, rnd);
  const patch = randomPatch(fam, site.patch, { rate: a.rate, range: a.range, gate: Math.round(a.gate * 1000) / 1000 }, rnd);
  const knobs: Record<string, number> = {};
  for (const k of VOY_KNOBS) knobs[k.id] = patch[k.id] ?? k.def;
  const faults = analogFaults(knobs);
  if (faults.length) {
    bad += 1;
    console.error(`RANDOM ${i + 1} (${fam}) : ${faults.join(' ; ')}`);
  }
  const seq = tameSeq(fam, h.seq);
  presets.push({
    name: `RANDOM ${String(i + 1).padStart(2, '0')} ${fam}`,
    cat: fam,
    bpm: 122,
    knobs,
    seq: { edit: true, buf: Array.from({ length: 16 }, (_, j) => seq[j % seq.length] ?? null), len: Math.min(16, seq.length), has: true },
    prog: h.prog,
    extra: { xQuality: 1, ...ANALOG_FX_OFF_EXTRA },
    steps: h.steps,
  });
}
writeFileSync(out, `${JSON.stringify({ v: 1, presets }, null, 1)}\n`);
console.log(`${presets.length} tirages de RANDOM -> ${out}${bad ? ` ; ${bad} hors des regles` : ' ; tous dans les regles (analog.ts)'}`);
process.exit(bad ? 1 : 0);
