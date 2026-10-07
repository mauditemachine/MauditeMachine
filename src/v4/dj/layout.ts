/**
 * Les commandes du MM-DECKS (2026-10-04), en une liste : chaque potard,
 * fader et touche avec son id, sa place dans le repere top (x absolu :
 * le centre de son bloc compris), sa taille. La scene (dj/controls.ts), la
 * serigraphie (dj/silk.ts), le picking et les jumeaux HTML lisent tous
 * cette liste.
 *
 * Ids : "dj-" puis le bloc et la commande (jamais un id en v : le Stage
 * envoie ceux-la au MM-ARP). Les touches du sampler d'une platine
 * (2026-10-07) : dj-a-smpl-open, dj-a-smpl-recdeck, dj-a-smpl-recmix,
 * dj-a-smpl-play.
 */

import { PORTRAIT } from '../theme';
import { DECK, DJ_CHANNELS, DJ_DECKS, DJ_DECKS_MAX, DJ_EQ, DJ_FX, DJ_FX_LABEL, DJ_KNOB, DJ_TIMES, MIX, UNIT_X, djDecks, mixWidth, timeLabel, type DjChannel, type DjDeck, type DjEqId, type DjFxId } from './theme';

/**
 * fxto : FX TO, la voie qui recoit les effets (ou toutes), un selecteur a
 * crans ; vol : le volume d'une voie en potard (au telephone tenu droit, a
 * la place de son fader)
 */
export type DjKnobTarget = { kind: 'eq'; ch: DjChannel; eq: DjEqId } | { kind: 'vol'; ch: DjChannel } | { kind: 'fx'; fx: DjFxId } | { kind: 'fxto' } | { kind: 'master' };

export interface DjKnobSpec {
  id: string;
  label: string;
  x: number;
  z: number;
  s: number;
  /** zero au centre (GAIN, EQ, FILTER) */
  bipolar: boolean;
  target: DjKnobTarget;
  /** voie sans source : encre pale */
  idle: boolean;
}

/** Plus de crossfader (Mika, 2026-10-04 : "enleve le crossfader, ca ne sert a rien") : chaque voie a son fader. */
export type DjFaderTarget = { kind: 'channel'; ch: DjChannel } | { kind: 'pitch'; deck: DjDeck };

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

/**
 * Le sampler de la platine (2026-10-07, a la place des hot cues : Mika, "les
 * boutons de CUE que je n'ai pas besoin pour l'instant, transforme-les en
 * boutons pour le sampler") : SMPL (la page du sampler sur l'ecran), REC
 * DECK (les temps de la platine), REC MIX (ceux du MIXER), PLAY.
 */
export type DjSmplKey = 'open' | 'recdeck' | 'recmix' | 'play';
export const DJ_SMPL_KEYS: readonly { fn: DjSmplKey; label: string }[] = [
  { fn: 'open', label: 'SMPL' },
  { fn: 'recdeck', label: 'REC DECK' },
  { fn: 'recmix', label: 'REC MIX' },
  { fn: 'play', label: 'PLAY' },
];

export type DjKeyTarget =
  | { kind: 'smpl'; deck: DjDeck; fn: DjSmplKey }
  | { kind: 'bend'; deck: DjDeck; dir: -1 | 1 }
  | { kind: 'tempo'; deck: DjDeck; dir: -1 | 1 }
  | { kind: 'time'; d: number }
  | { kind: 'cue'; deck: DjDeck }
  | { kind: 'play'; deck: DjDeck }
  /** le centre du jog : le tempo se cale sur celui qu'on entend */
  | { kind: 'sync'; deck: DjDeck }
  /** LOOP : une boucle de n temps, au temps pres */
  | { kind: 'loop'; deck: DjDeck; beats: number }
  /** REMOVE, sur la derniere platine ajoutee (ajouter : ADD DECK, sur la table) */
  | { kind: 'removedeck'; deck: DjDeck }
  /** ADD DECK, dans l'en-tete de la table : une platine de plus (tant qu'il reste une place) */
  | { kind: 'adddeck' }
  /** PLAY/STOP du mixer : le MM-RYTM et le MM-ARP (voies 1 et 2) ensemble */
  | { kind: 'machines' };

export interface DjKeySpec {
  id: string;
  label: string;
  x: number;
  z: number;
  w: number;
  d: number;
  /** touche ronde (CUE, PLAY) : w = d = le diametre */
  round: boolean;
  /** pas de touche en caoutchouc : l'ecran rond du jog (SYNC) */
  screen?: boolean;
  target: DjKeyTarget;
}

/* ---------------- les listes, refaites a chaque nombre de platines ---------------- */

export let DJ_KNOBS: readonly DjKnobSpec[] = [];
export let DJ_FADERS: readonly DjFaderSpec[] = [];
export let DJ_KEYS: readonly DjKeySpec[] = [];
/** Les touches en caoutchouc : carrees, puis rondes (CUE, PLAY). */
export let DJ_RECT_KEYS: readonly DjKeySpec[] = [];
export let DJ_ROUND_KEYS: readonly DjKeySpec[] = [];
const knobMap = new Map<string, DjKnobSpec>();
const faderMap = new Map<string, DjFaderSpec>();
const keyMap = new Map<string, DjKeySpec>();
export const djKnob = (id: string): DjKnobSpec | undefined => knobMap.get(id);
export const djFader = (id: string): DjFaderSpec | undefined => faderMap.get(id);
export const djKey = (id: string): DjKeySpec | undefined => keyMap.get(id);

/** Le libelle d'un potard se pose au-dessus de sa jupe (tenu droit, un peu plus haut : la vue plonge moins, le capuchon le cachait). */
export const knobLabelZ = (k: DjKnobSpec): number => k.z - DJ_KNOB.skirt.r * k.s - (PORTRAIT ? 0.2 : 0.12);

/** La place du i-eme potard de la rangee des effets (FX TO le dernier) : une rangee, ou deux de quatre tenu droit. */
function fxAt(i: number): { x: number; z: number } {
  if (PORTRAIT) return { x: MIX.fxX0 + (i % 4) * MIX.fxPitch, z: MIX.fxZ + Math.floor(i / 4) * MIX.fxRowDz };
  return { x: MIX.fxX0 + i * MIX.fxPitch, z: MIX.fxZ };
}

function buildKnobs(): DjKnobSpec[] {
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
        idle: false,
      });
    });
    // Au telephone tenu droit, le volume de la voie en potard, sous FILTER ; l'id du fader (MIDI, Roto-Control)
    if (PORTRAIT) knobs.push({ id: `dj-ch${i + 1}-fader`, label: 'VOLUME', x: UNIT_X.mix + cx, z: MIX.vol.z, s: MIX.vol.s, bipolar: false, target: { kind: 'vol', ch }, idle: false });
  });
  DJ_FX.forEach((f, i) => {
    const at = fxAt(i);
    knobs.push({
      id: `dj-fx-${f}`,
      label: DJ_FX_LABEL[f],
      x: UNIT_X.mix + at.x,
      z: at.z,
      s: MIX.sFx,
      bipolar: false,
      target: { kind: 'fx', fx: f },
      idle: false,
    });
  });
  // FX TO (2026-10-04, Mika : "un knob qui selectionne la piste de destination, ou alors toutes les pistes")
  const to = fxAt(DJ_FX.length);
  knobs.push({ id: 'dj-fxto', label: 'FX TO', x: UNIT_X.mix + to.x, z: to.z, s: MIX.sFx, bipolar: false, target: { kind: 'fxto' }, idle: false });
  knobs.push({ id: 'dj-master', label: 'MASTER', x: UNIT_X.mix + MIX.masterX, z: MIX.master.z, s: MIX.master.s, bipolar: false, target: { kind: 'master' }, idle: false });
  return knobs;
}

function buildFaders(): DjFaderSpec[] {
  const faders: DjFaderSpec[] = [];
  // Tenu droit, les voies n'ont plus de fader (leur volume est un potard)
  if (!PORTRAIT) MIX.cols.forEach((cx, i) => {
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
  for (const d of DJ_DECKS) {
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
  return faders;
}

function buildKeys(): DjKeySpec[] {
  const keys: DjKeySpec[] = [];
  const last = DJ_DECKS[DJ_DECKS.length - 1];
  for (const d of DJ_DECKS) {
    const ux = UNIT_X[d];
    DECK.cues.xs.forEach((x, n) => {
      const k = DJ_SMPL_KEYS[n];
      keys.push({ id: `dj-${d}-smpl-${k.fn}`, label: k.label, x: ux + x, z: DECK.cues.z, w: DECK.cues.w, d: DECK.cues.d, round: false, target: { kind: 'smpl', deck: d, fn: k.fn } });
    });
    // LOAD n'est plus une touche (Mika, 2026-10-04) : toucher l'ecran ouvre la playlist
    DECK.loops.xs.forEach((x, n) => {
      const beats = DECK.loops.beats[n];
      keys.push({ id: `dj-${d}-loop${beats}`, label: String(beats), x: ux + x, z: DECK.loops.z, w: DECK.loops.w, d: DECK.loops.d, round: false, target: { kind: 'loop', deck: d, beats } });
    });
    DECK.bend.xs.forEach((x, k) => {
      const dir = k === 0 ? -1 : 1;
      keys.push({ id: `dj-${d}-bend${dir < 0 ? 'm' : 'p'}`, label: dir < 0 ? '-' : '+', x: ux + x, z: DECK.bend.z, w: DECK.bend.w, d: DECK.bend.d, round: false, target: { kind: 'bend', deck: d, dir } });
    });
    keys.push({ id: `dj-${d}-cue`, label: 'CUE', x: ux + DECK.cue.x, z: DECK.cue.z, w: 2 * DECK.cue.r, d: 2 * DECK.cue.r, round: true, target: { kind: 'cue', deck: d } });
    keys.push({ id: `dj-${d}-play`, label: 'PLAY', x: ux + DECK.play.x, z: DECK.play.z, w: 2 * DECK.play.r, d: 2 * DECK.play.r, round: true, target: { kind: 'play', deck: d } });
    DECK.tempo.xs.forEach((x, k) => {
      const dir = k === 0 ? -1 : 1;
      keys.push({ id: `dj-${d}-tempo${dir < 0 ? 'm' : 'p'}`, label: dir < 0 ? '-' : '+', x: ux + x, z: DECK.tempo.z, w: DECK.tempo.w, d: DECK.tempo.d, round: false, target: { kind: 'tempo', deck: d, dir } });
    });
    // SYNC : l'ecran rond du jog, pas une touche en caoutchouc
    const c = jogCenter(d);
    const r = DECK.jog.center;
    keys.push({ id: `dj-${d}-sync`, label: 'SYNC', x: c.x, z: c.z, w: 2 * r, d: 2 * r, round: true, screen: true, target: { kind: 'sync', deck: d } });
    // REMOVE : la derniere platine ajoutee seulement (C ou D)
    if (d === last && DJ_DECKS.length > 2) {
      const R = DECK.remove;
      keys.push({ id: `dj-${d}-remove`, label: 'REMOVE', x: ux + R.x, z: R.z, w: R.w, d: R.d, round: false, target: { kind: 'removedeck', deck: d } });
    }
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
  // PLAY/STOP des machines, sous le VU du master
  const P = MIX.play;
  keys.push({ id: 'dj-machines', label: 'PLAY', x: UNIT_X.mix + MIX.masterX, z: P.z, w: 2 * P.r, d: 2 * P.r, round: true, target: { kind: 'machines' } });
  // ADD DECK, dans l'en-tete de la table (tenu droit : la colonne du MASTER), tant qu'il reste une place
  const rightX = (dx: number): number => UNIT_X.mix + (MIX.keysInMaster ? MIX.masterX : mixWidth(DJ_CHANNELS) / 2 - dx);
  const A = MIX.add;
  if (DJ_DECKS.length < DJ_DECKS_MAX) keys.push({ id: 'dj-adddeck', label: 'ADD', x: rightX(A.dx), z: A.z, w: A.w, d: A.d, round: false, target: { kind: 'adddeck' } });
  // PLAYLIST est parti : la liste des morceaux est dans l'ecran de chaque platine
  return keys;
}

/** Refait toutes les listes pour les places du moment (dj/theme.ts). */
function build(): void {
  DJ_KNOBS = buildKnobs();
  DJ_FADERS = buildFaders();
  DJ_KEYS = buildKeys();
  DJ_RECT_KEYS = DJ_KEYS.filter((k) => !k.round);
  DJ_ROUND_KEYS = DJ_KEYS.filter((k) => k.round && !k.screen);
  knobMap.clear();
  faderMap.clear();
  keyMap.clear();
  for (const k of DJ_KNOBS) knobMap.set(k.id, k);
  for (const f of DJ_FADERS) faderMap.set(f.id, f);
  for (const k of DJ_KEYS) keyMap.set(k.id, k);
}

/**
 * Place du capuchon le long de la fente pour une valeur : voie 0 en bas
 * (vers soi) et 1 en haut ; pitch -1 en haut (plus lent, comme une CDJ)
 * et +1 en bas.
 */
export function faderPos(f: DjFaderSpec, v: number): number {
  if (f.target.kind === 'channel') return f.b + (f.a - f.b) * v;
  return f.a + ((f.b - f.a) * (v + 1)) / 2;
}

/* ---------------- jogs ---------------- */

export function jogCenter(d: DjDeck): { x: number; z: number } {
  return { x: UNIT_X[d] + DECK.jog.x, z: DECK.jog.z };
}

build();
djDecks.onRelayout(build);
