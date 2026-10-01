/**
 * RANDOM (2026-10-01) : un motif house tire au hasard, qui tient debout.
 * Une grammaire, pas du bruit : la grosse caisse reste four to the floor,
 * le clap sur 2 et 4, le charley ouvert sur les contretemps (sinon le
 * ferme les prend), le charley ferme roule en doubles croches avec ses
 * accents, le tom joue une figure syncopee. Le hasard choisit les
 * variantes et les velocites : une grosse caisse en levee, un clap
 * fantome, un charley qui saute, un coup de tom en plus ou en moins.
 * Tempo, effets et voix restent ceux du moment.
 *
 * Velocites du motif : 0 vide, 1 fort, 2 moyen, 3 doux.
 */

import type { Inst } from '../theme';
import { STEP_COUNT, type Steps } from './pattern';

export type Rand = () => number;
type Row = number[];

const BEATS = [0, 4, 8, 12] as const;
const OFFBEATS = [2, 6, 10, 14] as const;

const empty = (): Row => new Array<number>(STEP_COUNT).fill(0);
const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(r() * xs.length))];
const fromString = (s: string): Row => [...s].map((c) => Number(c));

/** Grosse caisse : les quatre temps, forts ; parfois une levee douce. */
function kick(r: Rand): Row {
  const k = empty();
  for (const b of BEATS) k[b] = 1;
  const x = r();
  if (x < 0.16) k[15] = 3;
  else if (x < 0.26) k[7] = 3;
  else if (x < 0.32) k[10] = 3;
  else if (x < 0.36) k[13] = 2;
  return k;
}

/** Clap : 2 et 4, forts ; parfois un fantome ou une levee. */
function clap(r: Rand): Row {
  const c = empty();
  c[4] = 1;
  c[12] = 1;
  const x = r();
  if (x < 0.16) c[15] = 3;
  else if (x < 0.28) c[7] = 3;
  else if (x < 0.36) c[13] = 3;
  else if (x < 0.42) {
    c[11] = 3;
    c[14] = 3;
  }
  return c;
}

/** Charley ouvert : les contretemps (le "tss" house), ou rien (le ferme les prend). */
function openHat(r: Rand): Row {
  const o = empty();
  const x = r();
  if (x < 0.55) for (const s of OFFBEATS) o[s] = 1;
  else if (x < 0.75) OFFBEATS.forEach((s, i) => (o[s] = i % 2 ? 2 : 1));
  else if (x < 0.87) {
    for (const s of OFFBEATS) o[s] = 1;
    o[15] = 3;
  }
  return o;
}

/**
 * Charley ferme, par temps (positions 0 a 3 du temps). Avec le charley
 * ouvert, le contretemps (2) lui revient : le ferme joue autour. Sans lui,
 * le ferme prend le contretemps, fort.
 */
const CH_WITH_OH: readonly (readonly number[])[] = [
  [2, 3, 0, 1],
  [3, 3, 0, 2],
  [2, 0, 0, 3],
  [1, 0, 0, 3],
  [0, 3, 0, 3],
];
const CH_ALONE: readonly (readonly number[])[] = [
  [3, 3, 1, 3],
  [0, 0, 1, 0],
  [2, 3, 1, 3],
  [0, 3, 1, 2],
  [3, 0, 1, 0],
];

function closedHat(r: Rand, oh: Row): Row {
  const withOh = OFFBEATS.some((s) => oh[s] > 0);
  const beat = pick(r, withOh ? CH_WITH_OH : CH_ALONE);
  const c = empty();
  for (let i = 0; i < STEP_COUNT; i += 1) {
    let v = beat[i % 4];
    // Un charley doux saute de temps en temps, un autre se durcit
    if (v === 3 && r() < 0.15) v = 0;
    else if (v === 3 && r() < 0.1) v = 2;
    c[i] = oh[i] > 0 ? 0 : v;
  }
  return c;
}

/** Figures de tom syncopees ; la premiere est celle du motif d'arrivee. */
const TOM_FIGURES: readonly string[] = [
  '0000003000020010',
  '0003000000030020',
  '0000000300200010',
  '0000020000000302',
  '0003000300030002',
  '0000002000003001',
];
/** Places d'un coup de tom ajoute : les doubles croches syncopees. */
const TOM_EXTRA = [3, 5, 7, 9, 11, 13, 15] as const;

function tom(r: Rand): Row {
  if (r() < 0.2) return empty();
  const t = fromString(pick(r, TOM_FIGURES));
  for (let i = 0; i < STEP_COUNT; i += 1) {
    if (t[i] === 0) continue;
    const x = r();
    if (x < 0.1) t[i] = 0;
    else if (x < 0.35) t[i] = 1 + Math.floor(r() * 3);
  }
  if (r() < 0.3) {
    const s = pick(r, TOM_EXTRA);
    if (t[s] === 0) t[s] = 3;
  }
  return t;
}

const join = (row: Row): string => row.join('');

/** Un motif house complet. */
export function houseSteps(r: Rand = Math.random): Steps {
  const oh = openHat(r);
  const rows: Record<Inst, Row> = { BD: kick(r), SD: clap(r), TOM: tom(r), CH: closedHat(r, oh), OH: oh };
  return { BD: join(rows.BD), SD: join(rows.SD), TOM: join(rows.TOM), CH: join(rows.CH), OH: join(rows.OH) };
}

const same = (a: Steps, b: Steps): boolean => (Object.keys(a) as Inst[]).every((k) => a[k] === b[k]);

/** Un motif house different de `current` (huit tirages au plus). */
export function randomHouse(current: Steps, r: Rand = Math.random): Steps {
  let next = houseSteps(r);
  for (let i = 0; i < 8 && same(next, current); i += 1) next = houseSteps(r);
  return next;
}
