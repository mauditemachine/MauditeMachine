/**
 * Les propositions pour Mika (2026-10-23, S22, Mika : "entre Monark et un synth analog Moog Voyager et un Korg Ms10") :
 * ce que S23 changerait apres son ecoute, rien n'est applique au site. Les valeurs en unites des potards (0 a 1), avec
 * les crans de state/factory.ts. Le VOLUME des nouveaux presets est cale a la mesure (scripts/arp-quality/ab.mjs : la
 * sonie mediane des presets d'usine).
 *
 * - les presets d'usine d'aujourd'hui, et chacun avec LOAD (0.25 pour la plupart, 0.15 pour ELECTRO et HOUSE, 0.2 pour
 *   ITALO), ACID NIGHT et NIGHT DRIVE revus (LOAD 0.45, moins d'OVERDRIVE ; NIGHT DRIVE avec SPACE) ;
 * - INIT a LOAD 0, 0.15, 0.25 et 0.35 (le depart que Mika choisira) ;
 * - cinq presets nouveaux : MS SCREAM, MONARK DRIVE, SPACE INDIE, MS HYPNO, RES PING.
 */

const RATE = { '1/8': 1 / 3, '1/16': 2 / 3 };
const MODE = { UP: 0, DOWN: 1 / 3, UPDN: 2 / 3, RAND: 1 };
const RANGE = { 1: 0, 2: 0.5, 3: 1 };
const NOTES = (n) => n / 8;
const WAVE1 = { SINE: 0, TRI: 0.2, SAW: 0.4, SQUARE: 0.6, PULSE: 0.8, FM: 1 };
const WAVE2 = { SINE: 0, TRI: 0.25, SAW: 0.5, SQUARE: 0.75, PULSE: 1 };
const FEET = { 32: 0.2, 16: 0.4, 8: 0.6, 4: 0.8, 2: 1 };
const FMODE = { MOOG: 0, LP12: 0.25, MS10: 0.5, BP: 0.75, HP: 1 };
const LFO_RATE = { '1 BAR': 4 / 6, '2 BAR': 5 / 6, '4 BAR': 1 };
const LFO_TO = { WAVE: 0, CUTOFF: 0.25, 'W+CUT': 1 };
const LFO_SHAPE = { TRI: 0, RND: 0.5 };
const SUB_WAVE = { SINE: 0, TRI: 0.5, SQUARE: 1 };
const CHORD = { BASIC: 0, TRIAD: 0.25, '7TH': 0.5, '9TH': 0.75 };
const CHORUS = { OFF: 0, I: 0.5, II: 1 };
const DLY = { '1/8': 0, '3/16': 0.25, '1/4': 0.5, '3/8': 0.75, '1/2': 1 };
const cents = (c) => Math.round((0.5 + c / 100) * 1000) / 1000;

/** Le LOAD propose pour chaque preset d'usine (design-music 7) ; ACID NIGHT et NIGHT DRIVE revus en plus. */
export const FACTORY_LOAD = { ELECTRO: 0.15, HOUSE: 0.15, ITALO: 0.2 };
export const FACTORY_UPDATES = {
  'ACID NIGHT': { load: 0.45, dist: 0.12, drift: 0.25 },
  'NIGHT DRIVE': { load: 0.45, dist: 0.1, space: 0.25 },
};
export const proposedKnobs = (name, knobs) => ({ ...knobs, load: FACTORY_LOAD[name] ?? 0.25, ...(FACTORY_UPDATES[name] ?? {}) });

/** Les cinq presets nouveaux : leurs potards (sans VOLUME, cale a la mesure), leur suite d'accords, leur tempo. */
export const NEW_PRESETS = [
  {
    name: 'MS SCREAM',
    style: 'dark disco / EBM',
    bpm: 120,
    swing: 0.1,
    prog: [0, 1],
    knobs: { rate: RATE['1/16'], mode: MODE.UP, range: RANGE[1], notes: NOTES(4), gate: 0.35, wave1: WAVE1.SAW, osc1: 0.9, osc2: 0, sub: 0.25, subWave: SUB_WAVE.SQUARE, subOct: 0, fmode: FMODE.MS10, cutoff: 0.26, res: 0.87, envAmt: 0.72, fA: 0, fD: 0.42, fS: 0.05, fR: 0.25, aA: 0, aD: 0.45, aS: 0.4, aR: 0.22, glide: 0.1, load: 0.55, dist: 0, accent: 0.75, accFlt: 1, drift: 0.2, phase: 0.3, monoLow: 0.4, chorus: CHORUS.OFF, delay: 0.25, dlyTime: DLY['3/16'], tape: 0.25, reverb: 0.15, glue: 0.45, duck: 0.3, chord: CHORD.BASIC },
  },
  {
    name: 'MONARK DRIVE',
    style: 'dark disco lead',
    bpm: 118,
    swing: 0.18,
    prog: [0, 1, 2, 0],
    knobs: { rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[2], gate: 0.5, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[16], fine1: cents(-7), fine2: cents(7), osc1: 0.84, osc2: 0.8, fmode: FMODE.MOOG, cutoff: 0.36, res: 0.55, envAmt: 0.55, fD: 0.45, fS: 0.15, fR: 0.4, aD: 0.6, aS: 0.55, aR: 0.4, glide: 0.18, load: 0.62, dist: 0.05, drift: 0.6, chorus: CHORUS.OFF, delay: 0.3, tape: 0.35, reverb: 0.25, glue: 0.45, duck: 0.35, chord: CHORD.TRIAD },
  },
  {
    name: 'SPACE INDIE',
    style: 'indie dance',
    bpm: 122,
    swing: 0.08,
    prog: [0, 5, 2, 1],
    knobs: { rate: RATE['1/8'], mode: MODE.UP, range: RANGE[2], gate: 0.55, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[8], fine1: cents(-5), fine2: cents(5), osc2: 0.6, fmode: FMODE.MOOG, cutoff: 0.5, res: 0.35, envAmt: 0.35, fD: 0.45, fS: 0.3, aA: 0.05, aD: 0.55, aS: 0.6, aR: 0.45, lfoRate: LFO_RATE['2 BAR'], lfoShape: LFO_SHAPE.TRI, lfoDest: LFO_TO['W+CUT'], lfoAmt: 0.22, load: 0.15, space: 0.55, wide: 0, stack: 0, monoLow: 0.35, drift: 0.3, chorus: CHORUS.OFF, delay: 0.35, reverb: 0.4, duck: 0.35, chord: CHORD['7TH'] },
  },
  {
    name: 'MS HYPNO',
    style: 'hypnotic minimal',
    bpm: 125,
    swing: 0.3,
    prog: [0],
    knobs: { rate: RATE['1/16'], mode: MODE.UP, range: RANGE[1], notes: NOTES(3), gate: 0.3, wave1: 0.3, osc1: 0.9, osc2: 0, fm: 0.12, ratio: 2 / 8, fmode: FMODE.MS10, cutoff: 0.5, res: 0.68, envAmt: 0.5, fD: 0.38, fS: 0, fR: 0.4, aD: 0.45, aS: 0, aR: 0.42, lfoRate: LFO_RATE['2 BAR'], lfoShape: LFO_SHAPE.RND, lfoDest: LFO_TO.CUTOFF, lfoAmt: 0.2, load: 0.15, phase: 0.3, drift: 0.2, accFlt: 0.5, chorus: CHORUS.OFF, delay: 0.5, tape: 0.5, reverb: 0.3, duck: 0.25, chord: CHORD.BASIC },
  },
  {
    name: 'RES PING',
    style: 'minimal',
    bpm: 125,
    swing: 0.45,
    prog: [0],
    knobs: { rate: RATE['1/16'], mode: MODE.UP, range: RANGE[1], notes: NOTES(3), gate: 0.3, wave1: WAVE1.SINE, osc1: 0.85, osc2: 0, fmode: FMODE.MOOG, cutoff: 0.282, res: 0.93, keyTrack: 1, envAmt: 0.08, fD: 0.14, fS: 0, fR: 0.14, aD: 0.22, aS: 0, aR: 0.2, drift: 0, phase: 0.3, load: 0.1, chorus: CHORUS.OFF, delay: 0.5, tape: 0.5, reverb: 0.3, duck: 0.25, chord: CHORD.BASIC },
  },
];

/** INIT aux LOAD proposes pour le depart. */
export const INIT_LOADS = [0, 0.15, 0.25, 0.35];
