/**
 * Les commandes du MM-DECKS (2026-10-04), en une liste : chaque potard,
 * fader et touche avec son id, sa place dans le repere top (x absolu :
 * le centre de son bloc compris), sa taille. La scene (dj/controls.ts), la
 * serigraphie (dj/silk.ts), le picking et les jumeaux HTML lisent tous
 * cette liste.
 *
 * Ids : "dj-" puis le bloc et la commande (jamais un id en v : le Stage
 * envoie ceux-la au MM-ARP).
 */

import { DECK, DJ_EQ, DJ_FX, DJ_FX_LABEL, DJ_KNOB, DJ_TIMES, MIX, UNIT_X, timeLabel, type DjChannel, type DjDeck, type DjEqId, type DjFxId } from './theme';

export type DjKnobTarget = { kind: 'eq'; ch: DjChannel; eq: DjEqId } | { kind: 'fx'; fx: DjFxId } | { kind: 'master' };

export interface DjKnobSpec {
  id: string;
  label: string;
  x: number;
  z: number;
  s: number;
  /** zero au centre (GAIN, EQ, FILTER) */
  bipolar: boolean;
  target: DjKnobTarget;
  /** voie 3 ou 4 : pas de platine dessus, encre pale */
  idle: boolean;
}

export type DjFaderTarget = { kind: 'channel'; ch: DjChannel } | { kind: 'pitch'; deck: DjDeck } | { kind: 'xfader' };

export interface DjFaderSpec {
  id: string;
  label: string;
  /** centre de la fente */
  x: number;
  z: number;
  /** course : de a a b le long de z (ou de x, couche) */
  a: number;
  b: number;
  across: boolean;
  target: DjFaderTarget;
}

export type DjKeyTarget =
  | { kind: 'hotcue'; deck: DjDeck; n: number }
  | { kind: 'load'; deck: DjDeck }
  | { kind: 'bend'; deck: DjDeck; dir: -1 | 1 }
  | { kind: 'time'; d: number }
  | { kind: 'cue'; deck: DjDeck }
  | { kind: 'play'; deck: DjDeck };

export interface DjKeySpec {
  id: string;
  label: string;
  x: number;
  z: number;
  w: number;
  d: number;
  /** touche ronde (CUE, PLAY) : w = d = le diametre */
  round: boolean;
  target: DjKeyTarget;
}

const DECKS: readonly DjDeck[] = ['a', 'b'];

/* ---------------- potards ---------------- */

const knobs: DjKnobSpec[] = [];
MIX.cols.forEach((cx, i) => {
  const ch = i as DjChannel;
  DJ_EQ.forEach((e, r) => {
    const big = e.id === 'hi' || e.id === 'mid' || e.id === 'low';
    knobs.push({
      id: `dj-ch${i + 1}-${e.id}`,
      label: e.label,
      x: UNIT_X.mix + cx,
      z: MIX.rows[r],
      s: big ? MIX.sEq : MIX.sGain,
      bipolar: true,
      target: { kind: 'eq', ch, eq: e.id },
      idle: i > 1,
    });
  });
});
DJ_FX.forEach((f, i) => {
  knobs.push({
    id: `dj-fx-${f}`,
    label: DJ_FX_LABEL[f],
    x: UNIT_X.mix + MIX.fxX0 + i * MIX.fxPitch,
    z: MIX.fxZ,
    s: MIX.sFx,
    bipolar: false,
    target: { kind: 'fx', fx: f },
    idle: false,
  });
});
knobs.push({ id: 'dj-master', label: 'MASTER', x: UNIT_X.mix + MIX.masterX, z: MIX.master.z, s: MIX.master.s, bipolar: false, target: { kind: 'master' }, idle: false });
export const DJ_KNOBS: readonly DjKnobSpec[] = knobs;

/** Le libelle d'un potard se pose au-dessus de sa jupe. */
export const knobLabelZ = (k: DjKnobSpec): number => k.z - DJ_KNOB.skirt.r * k.s - 0.13;

/* ---------------- faders ---------------- */

const faders: DjFaderSpec[] = [];
MIX.cols.forEach((cx, i) => {
  faders.push({
    id: `dj-ch${i + 1}-fader`,
    label: `CH ${i + 1}`,
    x: UNIT_X.mix + cx,
    z: (MIX.fader.z0 + MIX.fader.z1) / 2,
    a: MIX.fader.z0,
    b: MIX.fader.z1,
    across: false,
    target: { kind: 'channel', ch: i as DjChannel },
  });
});
for (const d of DECKS) {
  faders.push({
    id: `dj-${d}-pitch`,
    label: 'TEMPO',
    x: UNIT_X[d] + DECK.pitch.x,
    z: (DECK.pitch.z0 + DECK.pitch.z1) / 2,
    a: DECK.pitch.z0,
    b: DECK.pitch.z1,
    across: false,
    target: { kind: 'pitch', deck: d },
  });
}
faders.push({
  id: 'dj-xfader',
  label: 'CROSSFADER',
  x: UNIT_X.mix + (MIX.xfader.x0 + MIX.xfader.x1) / 2,
  z: MIX.xfader.z,
  a: UNIT_X.mix + MIX.xfader.x0,
  b: UNIT_X.mix + MIX.xfader.x1,
  across: true,
  target: { kind: 'xfader' },
});
export const DJ_FADERS: readonly DjFaderSpec[] = faders;

/**
 * Place du capuchon le long de la fente pour une valeur : voie 0 en bas
 * (vers soi) et 1 en haut ; pitch -1 en haut (plus lent, comme une CDJ)
 * et +1 en bas ; crossfader -1 a gauche (A).
 */
export function faderPos(f: DjFaderSpec, v: number): number {
  if (f.target.kind === 'channel') return f.b + (f.a - f.b) * v;
  return f.a + ((f.b - f.a) * (v + 1)) / 2;
}

/* ---------------- touches ---------------- */

const keys: DjKeySpec[] = [];
for (const d of DECKS) {
  const ux = UNIT_X[d];
  DECK.cues.xs.forEach((x, n) => {
    keys.push({ id: `dj-${d}-hotcue${n + 1}`, label: String(n + 1), x: ux + x, z: DECK.cues.z, w: DECK.cues.w, d: DECK.cues.d, round: false, target: { kind: 'hotcue', deck: d, n } });
  });
  keys.push({ id: `dj-${d}-load`, label: 'LOAD', x: ux + DECK.load.x, z: DECK.load.z, w: DECK.load.w, d: DECK.load.d, round: false, target: { kind: 'load', deck: d } });
  DECK.bend.xs.forEach((x, k) => {
    const dir = k === 0 ? -1 : 1;
    keys.push({ id: `dj-${d}-bend${dir < 0 ? 'm' : 'p'}`, label: dir < 0 ? '-' : '+', x: ux + x, z: DECK.bend.z, w: DECK.bend.w, d: DECK.bend.d, round: false, target: { kind: 'bend', deck: d, dir } });
  });
  keys.push({ id: `dj-${d}-cue`, label: 'CUE', x: ux + DECK.cue.x, z: DECK.cue.z, w: 2 * DECK.cue.r, d: 2 * DECK.cue.r, round: true, target: { kind: 'cue', deck: d } });
  keys.push({ id: `dj-${d}-play`, label: 'PLAY', x: ux + DECK.play.x, z: DECK.play.z, w: 2 * DECK.play.r, d: 2 * DECK.play.r, round: true, target: { kind: 'play', deck: d } });
}
DJ_TIMES.forEach((t, i) => {
  keys.push({
    id: `dj-time${i + 1}`,
    label: timeLabel(t),
    x: UNIT_X.mix + MIX.times.x0 + i * MIX.times.pitch,
    z: MIX.times.z,
    w: MIX.times.w,
    d: MIX.times.d,
    round: false,
    target: { kind: 'time', d: t },
  });
});
export const DJ_KEYS: readonly DjKeySpec[] = keys;
export const DJ_RECT_KEYS: readonly DjKeySpec[] = keys.filter((k) => !k.round);
export const DJ_ROUND_KEYS: readonly DjKeySpec[] = keys.filter((k) => k.round);

/* ---------------- jogs ---------------- */

export const jogCenter = (d: DjDeck): { x: number; z: number } => ({ x: UNIT_X[d] + DECK.jog.x, z: DECK.jog.z });
