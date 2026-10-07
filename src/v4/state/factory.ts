/**
 * Les presets d'usine (2026-10-07, Mika : "je voudrais qu'il y ait deja des
 * presets de styles de musique electro differents, et pas juste Disco").
 * Les memes dix styles sur le MM-RYTM, le MM-ARP et le MM-BASS (charger
 * DARK DISCO sur les trois donne un morceau qui tient), plus DEEP SUB pour
 * la basse : ACID, DARK DISCO, INDIE DANCE, MINIMAL, PSY PROG, TECHNO,
 * HOUSE, ELECTRO, EBM, ITALO. Ils suivent les presets de Mika dans le mode
 * presets de chaque ecran (state/presetMode.ts) ; on les charge, on ne les
 * renomme ni ne les efface (SAVE en fait un preset a soi).
 * - MM-RYTM : le motif et ses velocites, le tempo, SWING et les effets, le
 *   son du kit (909, 808, MM) ; le niveau de chaque voix a sa valeur de
 *   depart.
 * - MM-ARP : la vitesse, le mode et l'etendue de l'arpege, le filtre, les
 *   effets, la progression d'accords (le reste a sa valeur de depart).
 * - MM-BASS : le son, les reglages du generateur et une ligne dans ce
 *   style (tiree une fois pour toutes : la meme a chaque chargement).
 */

import { INSTRUMENTS, NEUTRAL_FX, type Fx, type Steps } from '../audio/pattern';
import { VOICE_FX_DEFAULT, type VoiceFx } from '../audio/voicefx';
import { KIT_FAMILIES, type KitFamily, type KitModel } from '../audio/kit';
import type { Inst } from '../theme';
import { VOY_KNOB_IDS, voyKnob, type VoyKnobId } from '../voyager/params';
import { BASS_KNOBS, BASS_STYLES, type BassKnobId, type BassStyle } from '../bass/params';
import { generate } from '../bass/gen';
import { SCALE_TONES, BASS_SCALES } from '../bass/params';
import type { BassStep } from '../bass/state';

/* ---------------- MM-RYTM ---------------- */

interface RytmGenre {
  name: string;
  bpm: number;
  fx: Partial<Fx>;
  sound: KitModel;
  steps: Partial<Steps>;
}

const RYTM: readonly RytmGenre[] = [
  {
    name: 'ACID',
    bpm: 128,
    fx: { swing: 0.2, drive: 0.15, reverb: 0.1, delay: 0.1 },
    sound: '909',
    steps: { BD: '9000900090009000', CP: '0000900000009000', CH: '6363636363636363', OH: '0090009000900090' },
  },
  {
    name: 'DARK DISCO',
    bpm: 118,
    fx: { swing: 0.35, drive: 0.1, reverb: 0.2, delay: 0.15 },
    sound: '808',
    steps: { BD: '9000900090009000', SD: '0000900000009000', CH: '6030603060306030', OH: '0090009000900090', CP: '0000000000009000', TOM: '0000000000000063' },
  },
  {
    name: 'INDIE DANCE',
    bpm: 122,
    fx: { swing: 0.25, drive: 0.2, reverb: 0.15, delay: 0.05 },
    sound: '909',
    steps: { BD: '9000900090009000', SD: '0000900000009003', CH: '6060606060606060', OH: '0090009000900090', CP: '0000900000009000', CY: '9000000000000000' },
  },
  {
    name: 'MINIMAL',
    bpm: 126,
    fx: { swing: 0.45, reverb: 0.25, delay: 0.25 },
    sound: '808',
    steps: { BD: '9000900090009000', CP: '0000600000006000', CH: '0030060000300600', OH: '0060006000600060', TOM: '0006000000600000', HT: '0000000300000003' },
  },
  {
    name: 'PSY PROG',
    bpm: 138,
    fx: { swing: 0, drive: 0.2, reverb: 0.2, delay: 0.2 },
    sound: '909',
    steps: { BD: '9000900090009000', CP: '0000900000009000', CH: '0360036003600360', OH: '0090009000900090' },
  },
  {
    name: 'TECHNO',
    bpm: 130,
    fx: { swing: 0.1, drive: 0.35, reverb: 0.2 },
    sound: '909',
    steps: { BD: '9000900090009000', CP: '0000900000009000', CH: '6363636363636363', OH: '0090009000900090', HT: '0000000300000030' },
  },
  {
    name: 'HOUSE',
    bpm: 124,
    fx: { swing: 0.5, reverb: 0.2, delay: 0.05 },
    sound: '909',
    steps: { BD: '9000900090009000', CP: '0000900000009000', CH: '6360636063606360', OH: '0090009000900090', SD: '0000000300000000' },
  },
  {
    name: 'ELECTRO',
    bpm: 125,
    fx: { swing: 0.15, delay: 0.2, reverb: 0.1 },
    sound: '808',
    steps: { BD: '9000009000900000', SD: '0000900000009000', CH: '6363636363636363', TOM: '0000000000000906' },
  },
  {
    name: 'EBM',
    bpm: 122,
    fx: { swing: 0, drive: 0.45, reverb: 0.3 },
    sound: 'mm',
    steps: { BD: '9000900090009000', SD: '0000900000009000', CP: '0000900000009000', CH: '6060606060606060' },
  },
  {
    name: 'ITALO',
    bpm: 120,
    fx: { swing: 0.2, chorus: 0.3, reverb: 0.3, delay: 0.2 },
    sound: '808',
    steps: { BD: '9000900090009000', SD: '0000900000009000', CH: '6363636363636363', CP: '0000900000009000', TOM: '0000000000000696' },
  },
];

export interface RytmFactory {
  steps: Steps;
  bpm: number;
  fx: Fx;
  stretch: number;
  voices: Record<Inst, VoiceFx>;
  kit: Record<string, number>;
  sounds: Partial<Record<KitFamily, string>>;
}

const blank = '0000000000000000';

export function rytmFactory(): { name: string; data: RytmFactory }[] {
  return RYTM.map((g) => ({
    name: g.name,
    data: {
      steps: Object.fromEntries(INSTRUMENTS.map((k) => [k, g.steps[k] ?? blank])) as Steps,
      bpm: g.bpm,
      fx: { ...NEUTRAL_FX, ...g.fx },
      stretch: 0,
      voices: Object.fromEntries(INSTRUMENTS.map((k) => [k, { ...VOICE_FX_DEFAULT }])) as Record<Inst, VoiceFx>,
      // Les potards du kit restent ; seuls les sons changent
      kit: {},
      sounds: Object.fromEntries(KIT_FAMILIES.filter((f) => f !== 'rs').map((f) => [f, g.sound])) as Partial<Record<KitFamily, string>>,
    },
  }));
}

/* ---------------- MM-ARP ---------------- */

interface ArpGenre {
  name: string;
  knobs: Partial<Record<VoyKnobId, number>>;
  prog: number[];
}

/** RATE : 1/4, 1/8, 1/16, 1/32 ; MODE : UP, DOWN, UP/DN, RAND ; RANGE : 1, 2, 3 octaves ; NOTES : ALL, 1 a 8. */
const RATE = { '1/8': 1 / 3, '1/16': 2 / 3 } as const;
const MODE = { UP: 0, DOWN: 1 / 3, UPDN: 2 / 3, RAND: 1 } as const;
const RANGE = { 1: 0, 2: 0.5, 3: 1 } as const;

/** Les accords (voyager/chords.ts) : 0 F#m, 1 D, 2 E, 3 C#m, 4 Bm, 5 A, 6 F#m7, 7 Dmaj7. */
const ARP: readonly ArpGenre[] = [
  { name: 'ACID', knobs: { rate: RATE['1/16'], mode: MODE.UP, range: RANGE[1], gate: 0.4, cutoff: 0.35, res: 0.7, envAmt: 0.7, fD: 0.25, delay: 0.2, reverb: 0.15, chorus: 0.1 }, prog: [0] },
  { name: 'DARK DISCO', knobs: { rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[2], gate: 0.5, cutoff: 0.45, res: 0.35, envAmt: 0.4, delay: 0.3, reverb: 0.3, chorus: 0.3 }, prog: [0, 1, 4, 2] },
  { name: 'INDIE DANCE', knobs: { rate: RATE['1/8'], mode: MODE.UP, range: RANGE[2], gate: 0.6, cutoff: 0.55, res: 0.3, envAmt: 0.4, delay: 0.35, reverb: 0.35, chorus: 0.4 }, prog: [0, 5, 1, 2] },
  { name: 'MINIMAL', knobs: { rate: RATE['1/16'], mode: MODE.RAND, range: RANGE[1], notes: 3 / 8, gate: 0.25, cutoff: 0.3, res: 0.5, envAmt: 0.5, fD: 0.15, delay: 0.45, reverb: 0.3, chorus: 0.1 }, prog: [0] },
  { name: 'PSY PROG', knobs: { rate: RATE['1/16'], mode: MODE.UP, range: RANGE[2], gate: 0.35, cutoff: 0.4, res: 0.55, envAmt: 0.6, fD: 0.2, delay: 0.4, reverb: 0.25 }, prog: [0, 1] },
  { name: 'TECHNO', knobs: { rate: RATE['1/16'], mode: MODE.DOWN, range: RANGE[1], notes: 4 / 8, gate: 0.3, cutoff: 0.3, res: 0.6, envAmt: 0.55, dist: 0.2, delay: 0.35, reverb: 0.35, chorus: 0.1 }, prog: [0] },
  { name: 'HOUSE', knobs: { rate: RATE['1/8'], mode: MODE.UPDN, range: RANGE[2], gate: 0.55, cutoff: 0.6, res: 0.25, envAmt: 0.3, chorus: 0.5, reverb: 0.4, delay: 0.3 }, prog: [6, 7, 4, 5] },
  { name: 'ELECTRO', knobs: { rate: RATE['1/16'], mode: MODE.UP, range: RANGE[3], gate: 0.3, cutoff: 0.5, res: 0.45, envAmt: 0.5, delay: 0.3, reverb: 0.2 }, prog: [0, 3] },
  { name: 'EBM', knobs: { rate: RATE['1/16'], mode: MODE.UP, range: RANGE[1], gate: 0.45, cutoff: 0.45, res: 0.4, envAmt: 0.6, dist: 0.35, reverb: 0.3, chorus: 0.1 }, prog: [0, 1] },
  { name: 'ITALO', knobs: { rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[2], gate: 0.5, cutoff: 0.6, res: 0.3, envAmt: 0.35, chorus: 0.6, delay: 0.35, reverb: 0.35 }, prog: [0, 1, 5, 2] },
];

export interface ArpFactory {
  knobs: Record<VoyKnobId, number>;
  seq: { edit: false; buf: number[]; len: number; has: false };
  prog: number[];
}

export function arpFactory(seqMax: number): { name: string; data: ArpFactory }[] {
  return ARP.map((g) => ({
    name: g.name,
    data: {
      knobs: Object.fromEntries(VOY_KNOB_IDS.map((id) => [id, g.knobs[id] ?? voyKnob(id).def])) as Record<VoyKnobId, number>,
      // AUTO : la suite que font les potards
      seq: { edit: false, buf: Array.from({ length: seqMax }, () => 0), len: 8, has: false },
      prog: [...g.prog],
    },
  }));
}

/* ---------------- MM-BASS ---------------- */

interface BassGenre {
  name: string;
  style: BassStyle;
  /** les potards du son et du generateur (0 a 1) ; OCTAVE : -2, -1, 0, +1 ; RANGE : 1, 2, 3 ; SCALE : son nom */
  p: Partial<Record<BassKnobId, number>>;
  octave: -2 | -1 | 0;
  range: 1 | 2 | 3;
  scale: (typeof BASS_SCALES)[number];
  seed: number;
}

const BASS: readonly BassGenre[] = [
  { name: 'ACID', style: 'ACID', p: { cutoff: 0.3, reso: 0.8, envmod: 0.65, decay: 0.4, accent: 0.75, wave: 0, sub: 0.2, drive: 0.35, glide: 0.35, density: 0.7, slides: 0.4, accents: 0.4 }, octave: 0, range: 2, scale: 'MINOR', seed: 303 },
  { name: 'DARK DISCO', style: 'DARK DISCO', p: { cutoff: 0.38, reso: 0.45, envmod: 0.4, decay: 0.35, accent: 0.5, wave: 0.15, sub: 0.5, drive: 0.3, glide: 0.25, density: 0.6, slides: 0.1, accents: 0.25 }, octave: 0, range: 2, scale: 'PHRYGIAN', seed: 118 },
  { name: 'INDIE DANCE', style: 'INDIE DANCE', p: { cutoff: 0.45, reso: 0.35, envmod: 0.45, decay: 0.3, accent: 0.55, wave: 0.6, sub: 0.45, drive: 0.4, glide: 0.3, density: 0.65, slides: 0.15, accents: 0.3 }, octave: 0, range: 2, scale: 'DORIAN', seed: 122 },
  { name: 'MINIMAL', style: 'MINIMAL', p: { cutoff: 0.28, reso: 0.5, envmod: 0.35, decay: 0.22, accent: 0.4, wave: 1, sub: 0.55, drive: 0.1, glide: 0.3, density: 0.35, slides: 0.05, accents: 0.2 }, octave: 0, range: 1, scale: 'MINOR', seed: 126 },
  { name: 'PSY PROG', style: 'PSY PROG', p: { cutoff: 0.35, reso: 0.4, envmod: 0.5, decay: 0.18, accent: 0.3, wave: 0, sub: 0.6, drive: 0.25, glide: 0.2, density: 0.85, slides: 0, accents: 0.15 }, octave: -1, range: 1, scale: 'PHRYGIAN', seed: 138 },
  { name: 'TECHNO', style: 'TECHNO', p: { cutoff: 0.25, reso: 0.55, envmod: 0.4, decay: 0.25, accent: 0.45, wave: 0.3, sub: 0.5, drive: 0.45, glide: 0.2, density: 0.5, slides: 0.05, accents: 0.3 }, octave: -1, range: 1, scale: 'MINOR', seed: 130 },
  { name: 'HOUSE', style: 'HOUSE', p: { cutoff: 0.42, reso: 0.3, envmod: 0.3, decay: 0.5, accent: 0.4, wave: 0.8, sub: 0.5, drive: 0.15, glide: 0.45, density: 0.55, slides: 0.3, accents: 0.2 }, octave: 0, range: 2, scale: 'DORIAN', seed: 124 },
  { name: 'ELECTRO', style: 'ELECTRO', p: { cutoff: 0.5, reso: 0.6, envmod: 0.55, decay: 0.3, accent: 0.6, wave: 1, sub: 0.35, drive: 0.5, glide: 0.25, density: 0.6, slides: 0.1, accents: 0.45 }, octave: 0, range: 3, scale: 'MINOR', seed: 125 },
  { name: 'EBM', style: 'EBM', p: { cutoff: 0.4, reso: 0.35, envmod: 0.5, decay: 0.2, accent: 0.5, wave: 0, sub: 0.4, drive: 0.6, glide: 0.2, density: 0.9, slides: 0, accents: 0.25 }, octave: 0, range: 1, scale: 'MINOR', seed: 242 },
  { name: 'ITALO', style: 'ITALO', p: { cutoff: 0.5, reso: 0.3, envmod: 0.35, decay: 0.3, accent: 0.4, wave: 0.5, sub: 0.3, drive: 0.2, glide: 0.25, density: 0.7, slides: 0.05, accents: 0.2 }, octave: 0, range: 2, scale: 'HARMONIC', seed: 120 },
  { name: 'DEEP SUB', style: 'SUB', p: { cutoff: 0.2, reso: 0.2, envmod: 0.15, decay: 0.7, accent: 0.2, wave: 1, sub: 0.9, drive: 0.05, glide: 0.5, density: 0.4, slides: 0.4, accents: 0.1 }, octave: -2, range: 1, scale: 'MINOR', seed: 23 },
];

/** Un hasard qui donne toujours la meme suite (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BassFactory {
  params: Record<BassKnobId, number>;
  steps: BassStep[];
}

export function bassFactory(): { name: string; data: BassFactory }[] {
  return BASS.map((g) => {
    const params = Object.fromEntries(BASS_KNOBS.map((k) => [k.id, g.p[k.id] ?? k.def])) as Record<BassKnobId, number>;
    params.style = BASS_STYLES.indexOf(g.style) / (BASS_STYLES.length - 1);
    params.octave = (g.octave + 2) / 3;
    params.range = (g.range - 1) / 2;
    params.scale = BASS_SCALES.indexOf(g.scale) / (BASS_SCALES.length - 1);
    // La tonique : F#, la tonalite du site (ROOT sur ARP reste un choix de chacun)
    params.root = 1 / 12;
    const steps = generate({ style: g.style, density: params.density, slides: params.slides, accents: params.accents, range: g.range, degrees: SCALE_TONES[g.scale].length, rnd: seeded(g.seed) });
    return { name: g.name, data: { params, steps } };
  });
}
