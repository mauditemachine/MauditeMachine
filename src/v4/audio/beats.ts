/**
 * RANDOM du MM-RYTM, tous les 4x4 qui tiennent la route (2026-10-04, Mika :
 * "je veux pas que de la house, je veux tout ce qui tient la route en
 * 4x4").
 *
 * Refait le 2026-10-14 (Mika : "le random ne fais pas assez de random !
 * c'est toujours presque pareil ! ca doit vraiment changer"). Avant : deux a
 * quatre figures figees par voix, les percussions absentes trois fois sur
 * quatre, trois velocites : a chaque tirage le meme squelette (kick, clap 2
 * et 4, charley ouvert en contretemps). Maintenant chaque tirage compose :
 * - un STYLE parmi dix (HOUSE, DEEP HOUSE, TECH HOUSE, TECHNO, MINIMAL,
 *   INDIE DANCE, DARK DISCO, ITALO, PROG, ELECTRO), jamais le meme deux fois
 *   de suite ; chaque style est une recette de poids, pas une figure ;
 * - une ENERGIE (0 a 1) : la densite des charleys, le nombre de percussions
 *   (0 a 3), les fantomes ;
 * - la grosse caisse reste sur les quatre temps (le 4x4, et le sidechain du
 *   MM-ARP s'y cale), avec 0 a 2 coups en plus aux places du style ;
 * - le backbeat : clap, caisse claire, les deux, rien, ou le seul 4e temps
 *   (demi-temps), avec ses fantomes et ses flas ;
 * - le charley ferme : croches, doubles croches (accents sur le temps, le
 *   contretemps, le "a" ou toutes les trois doubles croches), galop par
 *   cellules, ou euclidien ; une fin de mesure qui varie ;
 * - le charley ouvert : contretemps, une partie d'entre eux, le "a",
 *   euclidien, un seul en fin de mesure, ou rien ;
 * - les percussions (TOM, HT, et la caisse claire quand le backbeat ne la
 *   prend pas) : euclidiennes tournees au hasard (2 a 7 coups sur 16),
 *   cellules repetees, appel-reponse sur une demi-mesure, roulements de fin ;
 * - la cymbale : crash sur le 1, ride sur les temps, les contretemps, ou une
 *   cloche euclidienne ;
 * - les velocites sur les neuf niveaux (fort 8-9, moyen 5-7, doux 2-4), avec
 *   un peu de jeu humain ;
 * - le SWING du style (HOUSE et DEEP balancent, TECHNO et ELECTRO droits) ;
 * - le motif tire s'eloigne du motif courant d'au moins 14 cases (sur 128).
 * Et la couleur de chaque voix (randomColors) : TONE, VOLUME, DECAY et PAN
 * tires dans des plages sures, par voix ; la grosse caisse garde son son
 * (c'est elle que Mika choisit et regle).
 *
 * Velocites du motif : 0 vide, 1 a 9 (audio/pattern.ts).
 */

import type { Inst } from '../theme';
import { STEP_COUNT, type Steps } from './pattern';

/** Le hasard : Math.random, ou un tirage graine (les essais). */
export type Rand = () => number;

export type BeatStyle = 'HOUSE' | 'DEEP HOUSE' | 'TECH HOUSE' | 'TECHNO' | 'MINIMAL' | 'INDIE DANCE' | 'DARK DISCO' | 'ITALO' | 'PROG' | 'ELECTRO';

type Row = number[];
type Weights<T extends string> = Partial<Record<T, number>>;

const BEATS = [0, 4, 8, 12] as const;
const OFFBEATS = [2, 6, 10, 14] as const;

const empty = (): Row => new Array<number>(STEP_COUNT).fill(0);
const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(r() * xs.length))];
const between = (r: Rand, lo: number, hi: number): number => lo + r() * (hi - lo);
const int = (r: Rand, lo: number, hi: number): number => lo + Math.min(hi - lo, Math.floor(r() * (hi - lo + 1)));

/** Un tirage pondere ; les poids nuls ou absents ne sortent jamais. */
function choose<T extends string>(r: Rand, w: Weights<T>): T {
  const es = (Object.entries(w) as [T, number | undefined][]).filter((e): e is [T, number] => (e[1] ?? 0) > 0);
  let x = r() * es.reduce((a, e) => a + e[1], 0);
  for (const [k, v] of es) {
    x -= v;
    if (x <= 0) return k;
  }
  return es[es.length - 1][0];
}

/** Melange de Fisher-Yates (une copie). */
function shuffle<T>(r: Rand, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------- velocites ---------------- */

type Band = 'hi' | 'mid' | 'lo';
const BAND: Readonly<Record<Band, readonly [number, number]>> = { hi: [8, 9], mid: [5, 7], lo: [2, 4] };
const lvl = (r: Rand, b: Band): number => int(r, BAND[b][0], BAND[b][1]);

/** Le jeu humain : un coup sur trois bouge d'un niveau (jamais sous 2, l'inaudible, jamais au-dela de 9). */
function humanize(r: Rand, row: Row, amount = 0.33): Row {
  return row.map((v) => (v > 0 && r() < amount ? Math.max(2, Math.min(9, v + (r() < 0.5 ? -1 : 1))) : v));
}

/* ---------------- rythmes euclidiens ---------------- */

/** k coups repartis au mieux sur 16 pas (Bjorklund, par la droite de Bresenham), tournes de rot pas. */
function euclid(k: number, rot: number): boolean[] {
  const out = new Array<boolean>(STEP_COUNT).fill(false);
  for (let i = 0; i < STEP_COUNT; i += 1) if ((i * k) % STEP_COUNT < k) out[(i + rot) % STEP_COUNT] = true;
  return out;
}

/* ---------------- les voix ---------------- */

/** Grosse caisse : les quatre temps, forts ; 0 a `max` coups en plus aux places du style. */
function kick(r: Rand, spots: readonly number[], p: number, max: number): Row {
  const k = empty();
  for (const b of BEATS) k[b] = 9;
  if (r() < p) {
    const n = max > 1 && r() < 0.3 ? 2 : 1;
    for (const s of shuffle(r, spots).slice(0, n)) k[s] = lvl(r, r() < 0.7 ? 'lo' : 'mid');
  }
  return k;
}

type BackMode = 'clap' | 'snare' | 'both' | 'none' | 'half';

/** Le backbeat (CP, SD) : 2 et 4, le seul 4 (demi-temps), ou rien ; fantomes et flas. */
function backbeat(r: Rand, mode: BackMode, ghosts: number): { cp: Row; sd: Row } {
  const cp = empty();
  const sd = empty();
  const beats = mode === 'half' ? [12] : [4, 12];
  if (mode === 'clap' || mode === 'both' || mode === 'half') for (const b of beats) cp[b] = lvl(r, 'hi');
  if (mode === 'snare') for (const b of beats) sd[b] = lvl(r, 'hi');
  if (mode === 'both') for (const b of beats) sd[b] = lvl(r, 'mid');
  if (mode === 'none') return { cp, sd };
  // Fantomes : sur la voix qui tient le backbeat, aux doubles croches syncopees
  const row = mode === 'snare' ? sd : cp;
  const n = int(r, 0, ghosts);
  for (const s of shuffle(r, [3, 6, 7, 10, 11, 13, 14, 15]).slice(0, n)) if (row[s] === 0) row[s] = lvl(r, 'lo');
  // Un fla juste avant le 4 (une fois sur cinq)
  if (r() < 0.2 && row[11] === 0) row[11] = lvl(r, 'lo');
  return { cp, sd };
}

type ChMode = 'eighths' | 'off8' | 'sixteen' | 'gallop' | 'euclid' | 'none';
type Accent = 'on' | 'off' | 'push' | 'three';

/** Les cellules d'un temps du galop (1 coup, 0 vide), repetees sur la mesure. */
const GALLOP: readonly string[] = ['0011', '1011', '0111', '1101', '0110', '1001', '0010', '1010'];

function closedHat(r: Rand, mode: ChMode, energy: number): Row {
  const c = empty();
  if (mode === 'none') return c;
  if (mode === 'eighths') {
    for (let i = 0; i < STEP_COUNT; i += 2) c[i] = i % 4 === 2 ? lvl(r, 'hi') : lvl(r, r() < 0.5 ? 'lo' : 'mid');
  } else if (mode === 'off8') {
    for (const s of OFFBEATS) c[s] = lvl(r, 'hi');
    if (r() < 0.5) c[pick(r, [7, 15, 11, 3])] = lvl(r, 'lo');
  } else if (mode === 'sixteen') {
    const accent: Accent = pick(r, ['on', 'off', 'off', 'push', 'three'] as const);
    const skip = between(r, 0.02, 0.32) * (1.3 - energy);
    for (let i = 0; i < STEP_COUNT; i += 1) {
      const strong = accent === 'on' ? i % 4 === 0 : accent === 'off' ? i % 4 === 2 : accent === 'push' ? i % 4 === 3 : i % 3 === 0;
      c[i] = strong ? lvl(r, r() < 0.7 ? 'hi' : 'mid') : r() < skip ? 0 : lvl(r, 'lo');
    }
  } else if (mode === 'gallop') {
    const cell = pick(r, GALLOP);
    for (let i = 0; i < STEP_COUNT; i += 1) if (cell[i % 4] === '1') c[i] = i % 4 === 2 ? lvl(r, 'hi') : lvl(r, r() < 0.6 ? 'lo' : 'mid');
  } else {
    const hits = euclid(int(r, 5, 11), int(r, 0, 15));
    for (let i = 0; i < STEP_COUNT; i += 1) if (hits[i]) c[i] = lvl(r, i % 4 === 2 ? 'hi' : r() < 0.6 ? 'lo' : 'mid');
  }
  // La fin de mesure varie (une fois sur trois) : un roulement, ou un trou
  if (r() < 0.35) {
    if (r() < 0.55) for (const s of [13, 14, 15]) c[s] = Math.max(c[s], lvl(r, 'lo'));
    else for (const s of [13, 15]) c[s] = 0;
  }
  return c;
}

type OhMode = 'off' | 'offsome' | 'late' | 'euclid' | 'end' | 'none';

function openHat(r: Rand, mode: OhMode): Row {
  const o = empty();
  if (mode === 'off') {
    const alt = r() < 0.35;
    OFFBEATS.forEach((s, i) => (o[s] = alt && i % 2 ? lvl(r, 'mid') : lvl(r, 'hi')));
  } else if (mode === 'offsome') {
    for (const s of pick(r, [[6, 14], [2, 10], [2, 6, 10], [6, 10, 14], [14]] as const)) o[s] = lvl(r, 'hi');
  } else if (mode === 'late') {
    for (const s of pick(r, [[3, 11], [7, 15], [3, 7, 11, 15], [11]] as const)) o[s] = lvl(r, r() < 0.6 ? 'mid' : 'hi');
  } else if (mode === 'euclid') {
    const hits = euclid(pick(r, [3, 3, 5]), int(r, 1, 15));
    for (let i = 0; i < STEP_COUNT; i += 1) if (hits[i] && i % 4 !== 0) o[i] = lvl(r, 'mid');
  } else if (mode === 'end') {
    o[pick(r, [14, 15, 10])] = lvl(r, 'mid');
  }
  return o;
}

/** Le charley ferme ne joue pas la ou le charley ouvert joue (le choke les couperait). */
function underOpen(ch: Row, oh: Row): Row {
  return ch.map((v, i) => (oh[i] > 0 ? 0 : v));
}

type PercMode = 'euclid' | 'cell' | 'call' | 'fill';

/** Les cellules d'un temps des percussions, repetees (un coup peut sauter). */
const PERC_CELLS: readonly string[] = ['0100', '0010', '0001', '0110', '0101', '0011', '1001', '0100'];

function perc(r: Rand, mode: PercMode): Row {
  const p = empty();
  if (mode === 'euclid') {
    const hits = euclid(int(r, 2, 7), int(r, 0, 15));
    const accent = int(r, 0, 15);
    for (let i = 0; i < STEP_COUNT; i += 1) if (hits[i]) p[i] = i === accent || r() < 0.25 ? lvl(r, 'hi') : lvl(r, r() < 0.5 ? 'mid' : 'lo');
  } else if (mode === 'cell') {
    const cell = pick(r, PERC_CELLS);
    const drop = between(r, 0, 0.4);
    for (let i = 0; i < STEP_COUNT; i += 1) if (cell[i % 4] === '1' && r() >= drop) p[i] = lvl(r, r() < 0.4 ? 'mid' : 'lo');
  } else if (mode === 'call') {
    // Appel-reponse : une figure dans une moitie de mesure seulement
    const half = r() < 0.65 ? 8 : 0;
    for (const s of shuffle(r, [1, 2, 3, 5, 6, 7]).slice(0, int(r, 2, 4))) p[half + s] = lvl(r, r() < 0.5 ? 'hi' : 'mid');
  } else {
    // Roulement de fin de mesure, qui monte ou qui descend
    const spots = pick(r, [[12, 14, 15], [13, 14, 15], [11, 13, 15], [14, 15], [10, 12, 13, 15]] as const);
    const up = r() < 0.5;
    spots.forEach((s, i) => (p[s] = Math.max(2, Math.min(9, up ? 4 + i * 2 : 9 - i * 2))));
  }
  return p;
}

type CyMode = 'none' | 'crash' | 'ride4' | 'ride8' | 'bell';

function cymbal(r: Rand, mode: CyMode): Row {
  const c = empty();
  if (mode === 'crash') c[0] = lvl(r, 'mid');
  else if (mode === 'ride4') for (const b of BEATS) c[b] = lvl(r, 'lo');
  else if (mode === 'ride8') for (let i = 0; i < STEP_COUNT; i += 2) c[i] = i % 4 === 2 ? lvl(r, 'mid') : lvl(r, 'lo');
  else if (mode === 'bell') {
    const hits = euclid(int(r, 3, 5), int(r, 0, 15));
    for (let i = 0; i < STEP_COUNT; i += 1) if (hits[i]) c[i] = lvl(r, 'lo');
  }
  return c;
}

/* ---------------- les styles ---------------- */

interface Recipe {
  style: BeatStyle;
  weight: number;
  /** grosse caisse : les places des coups en plus, la chance d'en avoir, au plus combien */
  kick: { spots: readonly number[]; p: number; max: number };
  back: Weights<BackMode>;
  /** fantomes du backbeat, au plus */
  ghosts: number;
  ch: Weights<ChMode>;
  oh: Weights<OhMode>;
  /** nombre de percussions (TOM, HT, SD libre), de min a max selon l'energie */
  percs: readonly [number, number];
  perc: Weights<PercMode>;
  cy: Weights<CyMode>;
  /** SWING : la plage du style (pattern.fx.swing) */
  swing: readonly [number, number];
}

const RECIPES: readonly Recipe[] = [
  {
    style: 'HOUSE',
    weight: 1,
    kick: { spots: [15, 7, 10, 13, 3], p: 0.4, max: 1 },
    back: { clap: 5, both: 2, snare: 1 },
    ghosts: 2,
    ch: { sixteen: 3, eighths: 2, gallop: 2, euclid: 1, off8: 1 },
    oh: { off: 6, offsome: 1, late: 1, none: 1 },
    percs: [0, 2],
    perc: { euclid: 2, cell: 2, call: 2, fill: 1 },
    cy: { none: 4, crash: 2, ride4: 1, ride8: 1 },
    swing: [0.25, 0.55],
  },
  {
    style: 'DEEP HOUSE',
    weight: 0.8,
    kick: { spots: [15, 10, 7, 3], p: 0.35, max: 1 },
    back: { clap: 3, snare: 2, both: 1, half: 1 },
    ghosts: 3,
    ch: { gallop: 3, sixteen: 2, euclid: 2, eighths: 1 },
    oh: { off: 4, late: 2, offsome: 2, none: 1 },
    percs: [1, 2],
    perc: { cell: 3, euclid: 2, call: 2 },
    cy: { none: 3, ride8: 2, ride4: 1 },
    swing: [0.4, 0.65],
  },
  {
    style: 'TECH HOUSE',
    weight: 1,
    kick: { spots: [15, 7, 10, 14], p: 0.4, max: 2 },
    back: { clap: 6, both: 1, none: 1 },
    ghosts: 2,
    ch: { sixteen: 4, gallop: 2, euclid: 2 },
    oh: { off: 6, euclid: 1, offsome: 1 },
    percs: [1, 3],
    perc: { euclid: 3, cell: 2, call: 1 },
    cy: { none: 4, ride8: 1, crash: 1, bell: 1 },
    swing: [0.15, 0.45],
  },
  {
    style: 'TECHNO',
    weight: 1,
    kick: { spots: [14, 15, 11, 3, 6], p: 0.4, max: 2 },
    back: { none: 4, clap: 3, half: 1 },
    ghosts: 1,
    ch: { sixteen: 4, euclid: 3, off8: 1, eighths: 1 },
    oh: { off: 5, euclid: 2, none: 2, late: 1 },
    percs: [1, 3],
    perc: { euclid: 4, cell: 1, call: 1 },
    cy: { ride8: 2, ride4: 1, none: 2, bell: 2 },
    swing: [0, 0.2],
  },
  {
    style: 'MINIMAL',
    weight: 0.9,
    kick: { spots: [10, 15, 3, 6], p: 0.35, max: 1 },
    back: { clap: 2, snare: 2, none: 3, half: 2 },
    ghosts: 2,
    ch: { euclid: 3, off8: 2, gallop: 1, eighths: 1, none: 1 },
    oh: { none: 3, end: 2, late: 2, off: 1 },
    percs: [1, 3],
    perc: { euclid: 4, cell: 2, call: 2 },
    cy: { none: 4, bell: 1, crash: 1 },
    swing: [0.2, 0.5],
  },
  {
    style: 'INDIE DANCE',
    weight: 1.1,
    kick: { spots: [15, 10, 7], p: 0.3, max: 1 },
    back: { snare: 4, both: 3, clap: 2 },
    ghosts: 2,
    ch: { eighths: 4, sixteen: 2, gallop: 1 },
    oh: { off: 5, offsome: 2, none: 1 },
    percs: [0, 2],
    perc: { fill: 3, call: 2, cell: 1 },
    cy: { crash: 3, none: 2, ride8: 1 },
    swing: [0, 0.25],
  },
  {
    style: 'DARK DISCO',
    weight: 1.1,
    kick: { spots: [15, 7, 10], p: 0.3, max: 1 },
    back: { clap: 3, both: 3, snare: 2 },
    ghosts: 2,
    ch: { sixteen: 4, eighths: 2, gallop: 1 },
    oh: { off: 6, late: 1, offsome: 1 },
    percs: [1, 2],
    perc: { cell: 2, fill: 2, euclid: 1, call: 1 },
    cy: { crash: 2, ride8: 2, none: 2 },
    swing: [0.05, 0.3],
  },
  {
    style: 'ITALO',
    weight: 0.8,
    kick: { spots: [15, 14], p: 0.2, max: 1 },
    back: { clap: 3, both: 2, snare: 2 },
    ghosts: 1,
    ch: { sixteen: 5, eighths: 2 },
    oh: { off: 6, offsome: 1 },
    percs: [0, 2],
    perc: { fill: 3, call: 1, cell: 1 },
    cy: { crash: 3, none: 2 },
    swing: [0, 0.15],
  },
  {
    style: 'PROG',
    weight: 0.9,
    kick: { spots: [15, 14, 11], p: 0.25, max: 1 },
    back: { clap: 4, none: 2, half: 1 },
    ghosts: 1,
    ch: { sixteen: 5, euclid: 1, gallop: 1 },
    oh: { off: 6, offsome: 1 },
    percs: [0, 2],
    perc: { euclid: 2, cell: 2, fill: 1 },
    cy: { ride8: 2, none: 3, ride4: 1 },
    swing: [0, 0.2],
  },
  {
    style: 'ELECTRO',
    weight: 0.8,
    kick: { spots: [10, 14, 6, 3], p: 0.5, max: 2 },
    back: { snare: 5, both: 2 },
    ghosts: 2,
    ch: { eighths: 3, sixteen: 2, off8: 1 },
    oh: { none: 3, end: 2, off: 1 },
    percs: [0, 2],
    perc: { call: 3, fill: 2, euclid: 1 },
    cy: { crash: 3, none: 3 },
    swing: [0, 0.15],
  },
];

/** Les styles du RANDOM, dans l'ordre de la recette (rytm/infos.ts les nomme). */
export const BEAT_STYLES: readonly BeatStyle[] = RECIPES.map((x) => x.style);

/** Un motif complet d'une recette, et son SWING. */
function compose(r: Rand, rc: Recipe): { steps: Steps; swing: number } {
  const energy = r();
  const back = choose(r, rc.back);
  const { cp, sd } = backbeat(r, back, Math.round(rc.ghosts * (0.4 + energy)));
  const oh = openHat(r, choose(r, rc.oh));
  // L'energie pousse vers les doubles croches, son absence vers les charleys clairsemes
  const chW: Weights<ChMode> = { ...rc.ch };
  if (chW.sixteen) chW.sixteen *= 0.5 + energy;
  for (const k of ['euclid', 'off8', 'none'] as const) if (chW[k]) chW[k] = (chW[k] ?? 0) * (1.5 - energy);
  let ch = underOpen(closedHat(r, choose(r, chW), energy), oh);
  // Rien d'autre ne tient le temps : le charley ferme prend les contretemps
  if (ch.every((v) => v === 0) && oh.every((v) => v === 0)) ch = closedHat(r, 'off8', energy);
  // Les percussions : TOM, HT, et la caisse claire si le backbeat la laisse libre
  const free: Inst[] = ['TOM', 'HT'];
  if (sd.every((v) => v === 0)) free.push('SD');
  const n = Math.max(0, Math.min(free.length, Math.round(rc.percs[0] + energy * (rc.percs[1] - rc.percs[0]))));
  const rows: Record<Inst, Row> = { BD: kick(r, rc.kick.spots, rc.kick.p, rc.kick.max), SD: sd, CH: ch, OH: oh, CP: cp, TOM: empty(), HT: empty(), CY: cymbal(r, choose(r, rc.cy)) };
  for (const inst of shuffle(r, free).slice(0, n)) {
    const row = perc(r, choose(r, rc.perc));
    // Une percussion ne double pas la grosse caisse fort : sur un temps, elle reste douce
    for (const b of BEATS) if (row[b] > 4) row[b] = lvl(r, 'lo');
    // La caisse claire en percussion reste en retrait (elle n'est pas le backbeat)
    rows[inst] = inst === 'SD' ? row.map((v) => Math.min(v, 6)) : row;
  }
  const steps = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, (k === 'BD' ? v : humanize(r, v)).join('')])) as Steps;
  const swing = Math.round(between(r, rc.swing[0], rc.swing[1]) * 100) / 100;
  return { steps, swing };
}

/** Combien de cases (voix x pas) changent entre deux motifs, joue ou non. */
export function beatDistance(a: Steps, b: Steps): number {
  let d = 0;
  for (const k of Object.keys(a) as Inst[]) {
    const x = a[k] ?? '';
    const y = b[k] ?? '';
    for (let i = 0; i < STEP_COUNT; i += 1) if (((x[i] ?? '0') === '0') !== ((y[i] ?? '0') === '0')) d += 1;
  }
  return d;
}

/** L'ecart minimal entre le motif courant et le tirage (sur 128 cases). */
export const MIN_DISTANCE = 14;

/**
 * Un style au hasard (jamais le meme deux fois de suite, quand on le donne),
 * son motif loin de `current` (douze tirages au plus) et son SWING.
 */
export function randomBeat(current: Steps, last: BeatStyle | null = null, r: Rand = Math.random): { style: BeatStyle; steps: Steps; swing: number } {
  const pool = RECIPES.filter((s) => s.style !== last);
  const total = pool.reduce((a, s) => a + s.weight, 0);
  let x = r() * total;
  let rc = pool[pool.length - 1];
  for (const s of pool) {
    x -= s.weight;
    if (x <= 0) {
      rc = s;
      break;
    }
  }
  let best = compose(r, rc);
  let bestD = beatDistance(best.steps, current);
  for (let i = 0; i < 12 && bestD < MIN_DISTANCE; i += 1) {
    const next = compose(r, rc);
    const d = beatDistance(next.steps, current);
    if (d > bestD) {
      best = next;
      bestD = d;
    }
  }
  return { style: rc.style, ...best };
}

/**
 * La couleur de chaque voix (VOICE FX tone, level, decay, pan) : des plages
 * sures, par voix. La grosse caisse n'y est pas : elle garde son son. Les
 * charleys ne s'assombrissent presque pas, les toms et la cymbale chantent
 * plus librement ; le PAN ecarte les charleys et les percussions, jamais la
 * caisse claire ni le clap. VOLUME 0.8 = le niveau d'origine ; DECAY 1 = la
 * queue entiere.
 */
type Color = { tone: number; level: number; decay: number; pan: number };
export type ColorVoice = Exclude<Inst, 'BD'>;

const COLOR: Readonly<Record<ColorVoice, { tone: [number, number]; level: [number, number]; decay: [number, number]; pan: number }>> = {
  SD: { tone: [-0.35, 0.35], level: [0.64, 0.84], decay: [0.5, 1], pan: 0 },
  CH: { tone: [-0.15, 0.45], level: [0.58, 0.82], decay: [0.3, 1], pan: 0.35 },
  OH: { tone: [-0.15, 0.4], level: [0.58, 0.8], decay: [0.4, 1], pan: 0.35 },
  CP: { tone: [-0.35, 0.35], level: [0.6, 0.8], decay: [0.55, 1], pan: 0 },
  TOM: { tone: [-0.6, 0.6], level: [0.6, 0.84], decay: [0.25, 1], pan: 0.5 },
  HT: { tone: [-0.6, 0.6], level: [0.6, 0.84], decay: [0.25, 1], pan: 0.5 },
  CY: { tone: [-0.3, 0.3], level: [0.52, 0.76], decay: [0.35, 1], pan: 0.4 },
};

export const COLOR_VOICES = Object.keys(COLOR) as ColorVoice[];

export function randomColors(r: Rand = Math.random): Record<ColorVoice, Color> {
  const span = ([lo, hi]: [number, number]): number => Math.round(between(r, lo, hi) * 100) / 100;
  // Les charleys d'un cote, les percussions de l'autre (ou l'inverse)
  const side = r() < 0.5 ? -1 : 1;
  return Object.fromEntries(
    COLOR_VOICES.map((k) => {
      const c = COLOR[k];
      // Une voix sur quatre garde son TONE au centre : le kit ne se desaccorde pas tout entier
      const tone = r() < 0.25 ? 0 : span(c.tone);
      // DECAY : la moitie des voix gardent leur queue entiere
      const decay = r() < 0.5 ? 1 : span(c.decay);
      const hat = k === 'CH' || k === 'OH';
      const pan = c.pan === 0 || r() < 0.3 ? 0 : Math.round((hat ? side : -side) * between(r, 0.1, c.pan) * 100) / 100;
      return [k, { tone, level: span(c.level), decay, pan }];
    })
  ) as Record<ColorVoice, Color>;
}
