/**
 * RANDOM du MM-RYTM, tous les 4x4 qui tiennent la route (2026-10-04, Mika :
 * "je veux pas que de la house, je veux tout ce qui tient la route en
 * 4x4"). Un style tire au hasard, puis sa grammaire : la grosse caisse
 * reste sur les quatre temps (parfois une levee), le reste suit les codes
 * du style, avec un peu de hasard dans les variantes et les velocites.
 * - HOUSE : la grammaire d'audio/house.ts.
 * - TECH HOUSE : clap 2 et 4, charley ouvert en contretemps, doubles
 *   croches douces, rim en 3-3-2, conga syncopee.
 * - TECHNO : doubles croches accentuees en contretemps, rim en polyrythme
 *   de trois, ride, tom hypnotique ; souvent sans clap.
 * - MINIMAL : le rim tient le contretemps, des clics de percussion, peu de
 *   charleys.
 * - INDIE DANCE : caisse claire sur 2 et 4 (le clap la double parfois),
 *   charley ferme en croches fort / fantome, ouvert en contretemps, toms de
 *   fin de mesure.
 * - PROG : roulement de charleys, ouvert en contretemps, clap doux, rim qui
 *   roule en seconde moitie, ride.
 * - ELECTRO : caisse claire forte sur 2 et 4, croches droites, tom en
 *   levee, crash sur le 1.
 * Et la couleur de chaque voix (Mika : "le tone, le volume") : TONE et
 * VOLUME tires dans des plages sures, par voix ; les autres effets restent
 * ceux de l'utilisateur.
 *
 * Velocites du motif : 0 vide, 1 fort, 2 moyen, 3 doux.
 */

import type { Inst } from '../theme';
import { houseSteps, type Rand } from './house';
import { STEP_COUNT, fromLevels3, type Steps } from './pattern';

export type BeatStyle = 'HOUSE' | 'TECH HOUSE' | 'TECHNO' | 'MINIMAL' | 'INDIE DANCE' | 'PROG' | 'ELECTRO';

type Row = number[];

const BEATS = [0, 4, 8, 12] as const;
const OFFBEATS = [2, 6, 10, 14] as const;

const empty = (): Row => new Array<number>(STEP_COUNT).fill(0);
const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(r() * xs.length))];
const fromString = (s: string): Row => [...s].map((c) => Number(c));
/** Les crans 1 2 3 (fort, moyen, doux) en niveaux du motif : 9 6 3 (audio/pattern.ts). */
const join = (row: Row): string => fromLevels3(row.join(''));

/** Grosse caisse : les quatre temps ; une levee douce une fois sur `up`. */
function kick(r: Rand, up: number, spots: readonly number[]): Row {
  const k = empty();
  for (const b of BEATS) k[b] = 1;
  if (r() < up) k[pick(r, spots)] = 3;
  return k;
}

/** Une figure (chaine de 16), un pas doux qui saute parfois. */
function figure(r: Rand, figs: readonly string[], drop = 0.12): Row {
  const f = fromString(pick(r, figs));
  for (let i = 0; i < STEP_COUNT; i += 1) if (f[i] === 3 && r() < drop) f[i] = 0;
  return f;
}

/** Le charley ferme ne joue pas la ou le charley ouvert joue (le choke les couperait). */
function underOpen(ch: Row, oh: Row): Row {
  return ch.map((v, i) => (oh[i] > 0 ? 0 : v));
}

function techHouse(r: Rand): Record<Inst, Row> {
  const oh = empty();
  for (const s of OFFBEATS) oh[s] = r() < 0.2 ? 2 : 1;
  const cp = empty();
  cp[4] = 1;
  cp[12] = 1;
  if (r() < 0.35) cp[pick(r, [7, 15, 13])] = 3;
  const ch = underOpen(figure(r, ['3030303030303030', '0303030303030303', '3330333033303330', '0033003300330033']), oh);
  return {
    BD: kick(r, 0.3, [15, 7, 10]),
    SD: r() < 0.7 ? empty() : figure(r, ['0000000300000003', '0000000000000303']),
    TOM: r() < 0.6 ? empty() : figure(r, ['0000003000000020', '0000000000030020']),
    CH: ch,
    OH: oh,
    CP: cp,
    HT: empty(),
    CY: r() < 0.7 ? empty() : figure(r, ['0030003000300030']),
  };
}

function techno(r: Rand): Record<Inst, Row> {
  const oh = empty();
  if (r() < 0.7) for (const s of OFFBEATS) oh[s] = 1;
  const ch = underOpen(figure(r, ['3313331333133313', '3030303030303030', '3313331333133313', '0313031303130313'], 0.08), oh);
  const cp = empty();
  if (r() < 0.45) {
    cp[4] = 2;
    cp[12] = 2;
  }
  // Rim en polyrythme de trois (un coup tous les trois pas), decale au hasard
  const rs = empty();
  if (r() < 0.65) {
    const off = Math.floor(r() * 3);
    for (let i = off; i < STEP_COUNT; i += 3) rs[i] = i % 4 === 0 ? 0 : 3;
  }
  return {
    BD: kick(r, 0.35, [14, 15, 11]),
    SD: r() < 0.8 ? empty() : figure(r, ['0000000000000333']),
    TOM: r() < 0.45 ? empty() : figure(r, ['0000001000000100', '0010000000100000', '0000002000020000'].map((s) => s.replace(/1/g, '2'))),
    CH: ch,
    OH: oh,
    CP: cp,
    HT: r() < 0.8 ? empty() : figure(r, ['0000000000000033']),
    CY: r() < 0.5 ? empty() : figure(r, ['0030003000300030', '3030303030303030'], 0.05),
  };
}

function minimal(r: Rand): Record<Inst, Row> {
  const rs = empty();
  rs[4] = 2;
  rs[12] = 2;
  if (r() < 0.5) rs[pick(r, [7, 10, 15])] = 3;
  const oh = r() < 0.6 ? empty() : fromString('0000000000000020');
  const ch = underOpen(figure(r, ['0020002000200020', '0030002000300020', '0000002000000020']), oh);
  return {
    BD: kick(r, 0.25, [10, 15, 3]),
    SD: empty(),
    TOM: r() < 0.6 ? empty() : figure(r, ['0000000300000000', '0003000000000300']),
    CH: ch,
    OH: oh,
    CP: r() < 0.6 ? empty() : fromString('0000000000003000'),
    HT: empty(),
    CY: empty(),
  };
}

function indieDance(r: Rand): Record<Inst, Row> {
  const oh = empty();
  for (const s of OFFBEATS) oh[s] = r() < 0.25 ? 2 : 1;
  // Charley ferme en croches, fort sur le temps, fantome en contretemps (la ou l'ouvert ne joue pas)
  const ch = underOpen(fromString('1030103010301030'), oh);
  if (r() < 0.4) for (const i of [1, 5, 9, 13]) ch[i] = 3;
  const sd = empty();
  sd[4] = 1;
  sd[12] = 1;
  if (r() < 0.3) sd[15] = 3;
  const cp = empty();
  if (r() < 0.5) {
    cp[4] = 2;
    cp[12] = 2;
  }
  return {
    BD: kick(r, 0.2, [15, 10]),
    SD: sd,
    TOM: r() < 0.5 ? empty() : figure(r, ['0000000000000231', '0000000000002300', '0000000000003210'], 0),
    CH: ch,
    OH: oh,
    CP: cp,
    HT: r() < 0.7 ? empty() : figure(r, ['0000000000000033']),
    CY: r() < 0.6 ? empty() : fromString('2000000000000000'),
  };
}

function prog(r: Rand): Record<Inst, Row> {
  const oh = empty();
  for (const s of OFFBEATS) oh[s] = 1;
  const ch = underOpen(figure(r, ['3313331333133313', '3333333333333333', '0313031303130313'], 0.1), oh);
  const cp = empty();
  if (r() < 0.55) {
    cp[4] = 2;
    cp[12] = 2;
  }
  return {
    BD: kick(r, 0.15, [15]),
    SD: empty(),
    TOM: r() < 0.7 ? empty() : figure(r, ['0000000000000302']),
    CH: ch,
    OH: oh,
    CP: cp,
    HT: empty(),
    CY: r() < 0.5 ? empty() : figure(r, ['0030003000300030']),
  };
}

function electro(r: Rand): Record<Inst, Row> {
  const sd = empty();
  sd[4] = 1;
  sd[12] = 1;
  if (r() < 0.35) sd[pick(r, [14, 15, 7])] = 3;
  const oh = r() < 0.7 ? empty() : fromString('0000000000000020');
  return {
    BD: kick(r, 0.4, [10, 14, 6]),
    SD: sd,
    TOM: r() < 0.5 ? empty() : figure(r, ['0000000000000033', '0000000000000302'], 0),
    CH: underOpen(figure(r, ['1010101010101010', '2020202020202020', '1030103010301030'], 0), oh),
    OH: oh,
    CP: r() < 0.6 ? empty() : fromString('0000200000002000'),
    HT: r() < 0.7 ? empty() : figure(r, ['0000000000003300']),
    CY: r() < 0.5 ? empty() : fromString('2000000000000000'),
  };
}

const STYLES: readonly { style: BeatStyle; weight: number; make: (r: Rand) => Steps }[] = [
  { style: 'HOUSE', weight: 1, make: (r) => houseSteps(r) },
  { style: 'TECH HOUSE', weight: 1, make: (r) => toSteps(techHouse(r)) },
  { style: 'TECHNO', weight: 1, make: (r) => toSteps(techno(r)) },
  { style: 'MINIMAL', weight: 0.8, make: (r) => toSteps(minimal(r)) },
  { style: 'INDIE DANCE', weight: 1.1, make: (r) => toSteps(indieDance(r)) },
  { style: 'PROG', weight: 0.9, make: (r) => toSteps(prog(r)) },
  { style: 'ELECTRO', weight: 0.8, make: (r) => toSteps(electro(r)) },
];

function toSteps(rows: Record<Inst, Row>): Steps {
  return Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, join(v)])) as Steps;
}

const same = (a: Steps, b: Steps): boolean => (Object.keys(a) as Inst[]).every((k) => a[k] === b[k]);

/** Un style au hasard (jamais le meme deux fois de suite, quand on le donne), son motif different de `current`. */
export function randomBeat(current: Steps, last: BeatStyle | null = null, r: Rand = Math.random): { style: BeatStyle; steps: Steps } {
  const pool = STYLES.filter((s) => s.style !== last);
  const total = pool.reduce((a, s) => a + s.weight, 0);
  let x = r() * total;
  let st = pool[pool.length - 1];
  for (const s of pool) {
    x -= s.weight;
    if (x <= 0) {
      st = s;
      break;
    }
  }
  let steps = st.make(r);
  for (let i = 0; i < 8 && same(steps, current); i += 1) steps = st.make(r);
  return { style: st.style, steps };
}

/**
 * TONE et VOLUME de chaque voix (VOICE FX tone, level) : des plages sures,
 * par voix. La grosse caisse bouge a peine (elle tient le morceau), les
 * charleys ne s'assombrissent presque pas, les toms, le rim et la conga
 * chantent plus librement. VOLUME 0.8 = le niveau d'origine.
 */
const COLOR: Readonly<Record<Inst, { tone: [number, number]; level: [number, number] }>> = {
  BD: { tone: [-0.15, 0.12], level: [0.76, 0.86] },
  SD: { tone: [-0.3, 0.3], level: [0.66, 0.84] },
  TOM: { tone: [-0.45, 0.45], level: [0.62, 0.82] },
  CH: { tone: [-0.1, 0.35], level: [0.6, 0.82] },
  OH: { tone: [-0.1, 0.3], level: [0.6, 0.8] },
  CP: { tone: [-0.25, 0.25], level: [0.6, 0.78] },
  HT: { tone: [-0.45, 0.45], level: [0.62, 0.82] },
  CY: { tone: [-0.2, 0.2], level: [0.55, 0.76] },
};

export function randomColors(r: Rand = Math.random): Record<Inst, { tone: number; level: number }> {
  const between = ([lo, hi]: [number, number]): number => Math.round((lo + r() * (hi - lo)) * 100) / 100;
  return Object.fromEntries(
    (Object.keys(COLOR) as Inst[]).map((k) => {
      // Une voix sur trois garde son TONE au centre : le kit ne se desaccorde pas tout entier
      const tone = r() < 0.33 ? 0 : between(COLOR[k].tone);
      return [k, { tone, level: between(COLOR[k].level) }];
    })
  ) as Record<Inst, { tone: number; level: number }>;
}
