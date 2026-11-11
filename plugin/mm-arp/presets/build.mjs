#!/usr/bin/env node
/**
 * MM-ARP, la banque d'usine du VST3 (2026-11-10, Mika : "les presets pourraient etre meilleurs, c'est un peu toujours
 * pareil ! Je veux plus de presets a la Donna Summer, genre disco, ou alors des trucs hypnotiques"). Le VST3 seul : les
 * presets du site (src/v4/state/factory.ts) ne changent pas.
 *
 * Refaite le 2026-11-11 (Mika : "les presets sont encore un peu trop similaires entre eux, surement parce qu'il n'y a
 * pas assez de fonctions dans le plugin") : 40 presets (12 DISCO, 12 HYPNOTIC, 8 DARK, 8 TEXTURE) qui se servent des 37
 * reglages du VST3 seul (RING, FOLD, NOISE COLOR, UNISON, HIGH PASS, COMB, PHASER, FLANGER, PUMP, CRUSH, DELAY MODE,
 * SHIMMER, SWING) et du sequenceur par pas (steps : ACCENT, SLIDE, GATE, RATCHET, PROB). Les legendes (desc) sont en
 * anglais, comme la machine.
 *
 * Source unique de la banque : ce fichier ecrit
 *   - plugin/mm-arp/presets/factory.json        { v: 1, presets: [ { name, cat, desc, bpm, knobs, seq, prog, extra, steps } ] }
 *   - plugin/mm-arp/presets/factory/NN NOM.mmarp  le meme preset au format disque du plugin (src/v4/plugin/arp/disk.ts)
 *
 *   node plugin/mm-arp/presets/build.mjs           (ecrit)
 *   node plugin/mm-arp/presets/build.mjs --check   (verifie que les fichiers sont a jour, n'ecrit rien)
 *
 * Les 62 potards partent des valeurs de depart de src/v4/voyager/params.ts (lu tel quel : Node retire les types), puis
 * BASE (un point neutre de la banque : OSC 2 coupe, effets a zero), puis ceux du preset ; tout est arrondi comme
 * voyParams.set (clean : un cran sur i / (n - 1), un continu au millieme). Les 37 reglages du VST3 seul partent de
 * plugin/mm-arp/extra-params.json, les pistes par pas des valeurs de depart de src/v4/plugin/arp/steps.ts. Le rendu de
 * verification : plugin/mm-arp/tests/presets-render.sh.
 *
 * VOLUME : cale par le rendu hors ligne (tests/presets_render.cpp --calibrate presets/volumes.json : la sonie ponderee
 * K de chaque preset sur 8 mesures, vers -23 LUFS, les TEXTURE vers -25). Recaler apres un changement de son :
 *   plugin/mm-arp/presets/calibrate.sh
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOY_KNOBS } from '../../../src/v4/voyager/params.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXTRA = JSON.parse(readFileSync(join(HERE, '..', 'extra-params.json'), 'utf8')).params;

/* ---------------- les crans (i / (n - 1)) ---------------- */

const R = null; // un silence de la suite EDIT
const r3 = (v) => Math.round(v * 1000) / 1000;
const RATE = { '1/4': 0, '1/8': 1 / 3, '1/16': 2 / 3, '1/32': 1 };
const MODE = { UP: 0, DOWN: 1 / 3, UPDN: 2 / 3, RAND: 1 };
const RANGE = { 1: 0, 2: 0.5, 3: 1 };
const NOTES = (n) => n / 8;
const WAVE1 = { SINE: 0, TRI: 0.2, SAW: 0.4, SQUARE: 0.6, PULSE: 0.8, FM: 1 };
const WAVE2 = { SINE: 0, TRI: 0.25, SAW: 0.5, SQUARE: 0.75, PULSE: 1 };
const FEET = { LO: 0, 32: 0.2, 16: 0.4, 8: 0.6, 4: 0.8, 2: 1 };
const SEMI = (n) => (n + 7) / 14;
const cents = (c) => r3(0.5 + c / 100);
const SUBOCT = { '-1': 0, '-2': 1 };
const SUBW = { SINE: 0, TRI: 0.5, SQUARE: 1 };
const RATIO = (r) => ['1/2', '1', '3/2', '2', '3', '7/2', '4', '5', '7'].indexOf(r) / 8;
const OCT = (n) => (n + 2) / 4;
const FMODE = { MOOG: 0, LP12: 0.25, MS10: 0.5, BP: 0.75, HP: 1 };
const L1RATE = { '1/16': 0, '1/8': 1 / 6, '1/4': 2 / 6, '1/2': 3 / 6, '1 BAR': 4 / 6, '2 BAR': 5 / 6, '4 BAR': 1 };
const L1SHAPE = { TRI: 0, SAW: 0.25, RND: 0.5, SQR: 0.75, SH: 1 };
const L1DEST = { WAVE: 0, CUTOFF: 0.25, FM: 0.5, PITCH: 0.75, WCUT: 1 };
const CHORUS = { OFF: 0, I: 0.5, II: 1 };
const DLY = { '1/8': 0, '3/16': 0.25, '1/4': 0.5, '3/8': 0.75, '1/2': 1 };
const CHORD = { BASIC: 0, TRIAD: 0.25, '7TH': 0.5, '9TH': 0.75, '11TH': 1 };
const ON = 1;
const NEG = 1;

// SOUND+ (extra-params.json)
const exSteps = (id) => EXTRA.find((p) => p.id === id).steps;
const exStep = (id, name) => {
  const s = exSteps(id);
  const i = s.indexOf(name);
  if (i < 0) throw new Error(`${id} : cran inconnu ${name}`);
  return i / (s.length - 1);
};
const L1D2 = (n) => exStep('xLfo1Dest2', n);
const L2RATE = (n) => exStep('xLfo2Rate', n);
const L2SHAPE = (n) => exStep('xLfo2Shape', n);
const L2DEST = (n) => exStep('xLfo2Dest', n);
const UNI = (n) => exStep('xUnison', String(n));
const PUMP = (n) => exStep('xPumpRate', n);
const DMODE = (n) => exStep('xDlyMode', n);
/** HIGH PASS en Hz (20 x 100^v, 20 Hz a 2 kHz). */
const hpHz = (hz) => r3(Math.log(hz / 20) / Math.log(100));
/** PHASER RATE en Hz (0.05 x 160^v). */
const phHz = (hz) => r3(Math.log(hz / 0.05) / Math.log(160));
/** FLANGER RATE en Hz (0.03 x (5 / 0.03)^v). */
const flHz = (hz) => r3(Math.log(hz / 0.03) / Math.log(5 / 0.03));
/** Une reinjection signee -1..1 (COMB FB, FLANGER FB : 2 v - 1). */
const fb = (x) => r3((x + 1) / 2);
/** CRUSH en bits (16 - 12 v). */
const bits = (b) => r3((16 - b) / 12);
/** DOWNSAMPLE en Hz (48 kHz x (2 / 48)^v). */
const dsHz = (hz) => r3(Math.log(hz / 48000) / Math.log(2000 / 48000));
/** REVERB SIZE en secondes (2.4 x 4^(2v - 1), 0.6 a 9.6 s). */
const revS = (s) => r3((Math.log(s / 2.4) / Math.log(4) + 1) / 2);
/** REVERB PRE DELAY en ms (0 a 100). */
const preMs = (ms) => r3(ms / 100);
/** MASTER BASS / AIR en dB (-6 a +6). */
const shelf = (db) => r3(0.5 + db / 12);

/* ---------------- le point de depart ---------------- */

const SITE_DEF = Object.fromEntries(VOY_KNOBS.map((k) => [k.id, k.def]));
/** Neutre de la banque : un oscillateur, rien d'autre ; chaque preset pose son OSC 2, ses effets, son espace. */
const BASE = {
  osc2: 0,
  wave2: WAVE2.SAW,
  range2: FEET[8],
  fine1: 0.5,
  fine2: 0.5,
  chorus: CHORUS.OFF,
  delay: 0,
  reverb: 0,
  tape: 0,
  glue: 0.35,
  lfoAmt: 0,
  duck: 0,
};
const EXTRA_DEF = Object.fromEntries(EXTRA.map((p) => [p.id, p.def]));

/** Une suite EDIT : les len degres, repetes sur les 16 pas (l'allonger dans la face la continue). */
const edit = (steps) => ({ edit: true, buf: Array.from({ length: 16 }, (_, j) => steps[j % steps.length]), len: steps.length, has: true });
/** AUTO : la suite des potards (MODE, RANGE, NOTES, CHORD), comme les presets du site. */
const AUTO = { edit: false, buf: Array.from({ length: 16 }, () => 0), len: 8, has: false };

/**
 * Les pistes par pas (src/v4/plugin/arp/steps.ts) : chaque piste donnee est repetee sur les 16 pas (comme la suite
 * EDIT), les autres gardent leur valeur de depart. acc 0 doux / 1 / 2 appuye ; slide 0 / 1 ; gate 0 court / 1 / 2 long /
 * 3 lie ; rat 1..4 ; prob 100 / 75 / 50 / 25 / 0. Le pas d'une note : sa position dans la suite (modulo 16).
 */
const STEP_DEF = { acc: 1, slide: 0, gate: 1, rat: 1, prob: 100 };
const STEP_OK = { acc: [0, 1, 2], slide: [0, 1], gate: [0, 1, 2, 3], rat: [1, 2, 3, 4], prob: [100, 75, 50, 25, 0] };
const steps = (o = {}) => {
  const out = {};
  for (const id of Object.keys(STEP_DEF)) {
    const a = o[id];
    out[id] = Array.from({ length: 16 }, (_, j) => (a && a.length ? a[j % a.length] : STEP_DEF[id]));
    for (const v of out[id]) if (!STEP_OK[id].includes(v)) throw new Error(`piste ${id} : valeur ${v}`);
  }
  for (const id of Object.keys(o)) if (!(id in STEP_DEF)) throw new Error(`piste inconnue ${id}`);
  return out;
};

/* ---------------- la banque ---------------- */

/*
 * Reperes : un degre est compte dans fa diese mineur depuis la racine de l'accord (0 racine, 2 tierce, 4 quinte, 6
 * septieme, 7 octave, 9 la tierce au-dessus, 11 la quinte au-dessus). La racine est posee vers fa diese 3 (185 Hz) :
 * OCTAVE -1 la descend vers fa diese 2 (92 Hz), le registre des basses disco. Accords : 0 F#m, 1 D, 2 E, 3 C#m, 4 Bm,
 * 5 A, 6 F#m7, 7 Dmaj7 ; une mesure par accord.
 *
 * Chaque preset a UN caractere : une famille de son (onde, filtre, enveloppe), un geste rythmique (RATE, longueur de la
 * suite, pistes par pas) et un espace (effets), choisis pour ne ressembler a aucun autre ; le rendu hors ligne le
 * verifie (tests/presets-render.sh : la distance entre presets).
 */
const BANK = [
  /* ======================= DISCO / EURO DISCO / ITALO ======================= */
  {
    name: 'MUNICH SEQUENCER',
    cat: 'DISCO',
    desc: 'The 1977 sequenced bass: root, octave, fifth and seventh in sixteenths, accents on the beat, a quarter note pump like a kick sidechain and a dotted echo.',
    bpm: 120,
    knobs: { rate: RATE['1/16'], gate: 0.42, wave1: WAVE1.SAW, osc1: 0.9, wave2: WAVE2.SQUARE, osc2: 0.5, fine1: cents(-4), fine2: cents(4), octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.38, res: 0.42, envAmt: 0.55, keyTrack: 0.7, fA: 0, fD: 0.33, fS: 0.05, fR: 0.25, aA: 0, aD: 0.4, aS: 0.35, aR: 0.2, dist: 0.05, load: 0.1, delay: 0.38, dlyTime: DLY['3/16'], reverb: 0.1, accent: 0.55, accFlt: 0.65, phase: 0.3, drift: 0.35, width: 0.3, monoLow: 0.3, glue: 0.4 },
    seq: edit([0, 7, 4, 6, 0, 7, 4, 9]),
    prog: [0, 0, 1, 2],
    steps: steps({ acc: [2, 1, 0, 1, 2, 1, 0, 2], gate: [1, 0, 1, 0, 1, 0, 1, 2] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.22, xRevSize: revS(1.4), xRevTone: 0.4, xWarmth: 0.25, xBass: shelf(0.6), xAir: shelf(0.6), xPumpDepth: 0.4, xPumpRate: PUMP('1/4'), xPumpShape: 0.4, xDlyMode: DMODE('STEREO') },
  },
  {
    name: 'OCTAVE GALLOP',
    cat: 'DISCO',
    desc: 'The galloping octave disco bass: a breathing pulse wave over a round sub, long first note and short answers, a ratchet closing every other beat.',
    bpm: 124,
    knobs: { rate: RATE['1/16'], gate: 0.5, wave1: 0.7, osc1: 0.88, sub: 0.5, subOct: SUBOCT['-1'], subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.LP12, cutoff: 0.46, res: 0.2, envAmt: 0.35, fD: 0.38, fS: 0.15, fR: 0.2, aD: 0.45, aS: 0.4, aR: 0.15, chorus: CHORUS.I, accent: 0.6, accFlt: 0.5, phase: 0.25, drift: 0.4, monoLow: 0.45 },
    seq: edit([0, R, 7, 7, 0, R, 7, 0]),
    prog: [0, 4, 1, 2],
    steps: steps({ acc: [2, 1, 1, 0, 2, 1, 1, 1], gate: [2, 1, 0, 0, 2, 1, 0, 1], rat: [1, 1, 1, 1, 1, 1, 1, 2] }),
    extra: { xLfo2Rate: L2RATE('1 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('WAVE'), xLfo2Depth: 0.35, xWarmth: 0.3, xBass: shelf(1.2), xPumpDepth: 0.3, xPumpRate: PUMP('1/4'), xPumpShape: 0.3 },
  },
  {
    name: 'STRING MACHINE',
    cat: 'DISCO',
    desc: 'A string ensemble playing sevenths in eighths: five stacked saws per oscillator through a slow six stage phaser, the way the old string machines were recorded.',
    bpm: 116,
    knobs: { rate: RATE['1/8'], mode: MODE.UPDN, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.9, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[4], fine1: cents(-7), fine2: cents(7), osc1: 0.8, osc2: 0.6, stack: 0.45, wide: 0.6, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.66, res: 0.08, envAmt: 0.12, fA: 0.4, fD: 0.6, fS: 0.7, fR: 0.6, aA: 0.52, aD: 0.6, aS: 0.8, aR: 0.68, chorus: CHORUS.II, reverb: 0.32, monoLow: 0.3, glue: 0.3, accent: 0.2, accFlt: 0.2, width: 0.7, drift: 0.6 },
    seq: AUTO,
    prog: [7, 2, 3, 0],
    steps: steps({ gate: [2, 2, 3, 2], acc: [1, 0, 1, 0] }),
    extra: { xUnison: UNI(5), xHpf: hpHz(220), xPhMix: 0.7, xPhRate: phHz(0.12), xPhDepth: 0.75, xPhFb: 0.5, xRevSize: revS(3.2), xRevTone: 0.6, xRevPre: preMs(30), xAir: shelf(1.8), xWidth: 0.55 },
  },
  {
    name: 'NEON GLIDE',
    cat: 'DISCO',
    desc: 'An italo lead in eighths that slides into its high notes and ties them, square against saw, a gentle vibrato and a dotted ping pong echo.',
    bpm: 120,
    knobs: { rate: RATE['1/8'], gate: 0.7, wave1: 0.62, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-6), fine2: cents(6), osc1: 0.84, osc2: 0.55, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.6, res: 0.3, envAmt: 0.3, fA: 0.1, fD: 0.55, fS: 0.5, fR: 0.4, aA: 0.08, aD: 0.6, aS: 0.85, aR: 0.3, lfoRate: L1RATE['1/8'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.PITCH, lfoAmt: 0.07, delay: 0.36, dlyTime: DLY['3/16'], reverb: 0.26, accent: 0.4, keyTrack: 0.7 },
    seq: edit([4, 7, R, 7, 9, 7, 6, 4, 2, 4, R, 4, 6, 4, 2, 0]),
    prog: [0, 5, 2, 1],
    steps: steps({ slide: [0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1], gate: [1, 3, 1, 1, 3, 2, 1, 1, 1, 3, 1, 1, 3, 2, 1, 2], acc: [2, 1, 1, 1, 2, 1, 1, 0] }),
    extra: { xRevSize: revS(2.4), xWarmth: 0.15, xAir: shelf(1.2) },
  },
  {
    name: 'RIMSHOT PLUCK',
    cat: 'DISCO',
    desc: 'A percussive pluck like a tuned rimshot: metallic FM and bright noise through a band pass, swung offbeats, a double hit now and then.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.TRI, osc1: 1, fm: 0.45, ratio: RATIO('7/2'), wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.7, noise: 0.3, octave: OCT(0), fmode: FMODE.BP, cutoff: 0.55, res: 0.2, envAmt: 0.5, keyTrack: 0.8, fA: 0, fD: 0.25, fS: 0.1, fR: 0.15, aA: 0, aD: 0.45, aS: 0.2, aR: 0.2, delay: 0.15, dlyTime: DLY['1/8'], reverb: 0.15, accent: 0.7, accFlt: 0.8, phase: 0.05, drift: 0.3, glue: 0.8 },
    seq: edit([R, 7, R, 7, R, 4, 7, R, R, 7, R, 4, 0, R, 7, R]),
    prog: [0, 1],
    steps: steps({ rat: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1], prob: [100, 100, 100, 75, 100, 100, 100, 100, 100, 100, 100, 75, 100, 100, 50, 100], acc: [1, 2, 1, 1, 1, 2, 0, 1] }),
    extra: { xSwing: 0.45, xNoiseColor: 0.8, xLfo2Rate: L2RATE('1/16'), xLfo2Shape: L2SHAPE('S&H'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.08, xRevSize: revS(0.8), xRevTone: 0.6, xWarmth: 0.5 },
  },
  {
    name: 'BOOGIE SLIDE',
    cat: 'DISCO',
    desc: 'A swung boogie bass at 112: square and saw over a sub, slides up to the octave, soft ghost notes between the accents, a warm master.',
    bpm: 112,
    knobs: { rate: RATE['1/16'], gate: 0.6, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[16], osc2: 0.45, sub: 0.35, subWave: SUBW.TRI, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.4, res: 0.3, envAmt: 0.45, fD: 0.5, fS: 0.25, fR: 0.3, aD: 0.55, aS: 0.6, aR: 0.25, accent: 0.6, accFlt: 0.5, load: 0.3, dist: 0.1, reverb: 0.06, phase: 0.3, monoLow: 0.45 },
    seq: edit([0, R, 7, 0, R, 7, R, 4, 0, R, 7, 7, 4, R, 2, 4]),
    prog: [4, 2, 0, 0],
    steps: steps({ slide: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], acc: [2, 1, 1, 0, 1, 2, 1, 0, 2, 1, 1, 0, 2, 1, 0, 1], gate: [2, 1, 1, 0, 1, 2, 1, 0, 2, 1, 0, 2, 1, 1, 0, 1] }),
    extra: { xSwing: 0.6, xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('ENV AMT'), xLfo2Depth: 0.15, xRevSize: revS(1.0), xWarmth: 0.45, xBass: shelf(1.8), xAir: shelf(-1.2) },
  },
  {
    name: 'HI-NRG JET',
    cat: 'DISCO',
    desc: 'Hi-NRG at 130: octaves in sixteenths on two detuned saws, a jet flanger sweeping over eight bars and a deep pump on every beat.',
    bpm: 130,
    knobs: { rate: RATE['1/16'], gate: 0.55, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-10), fine2: cents(10), osc1: 0.8, osc2: 0.8, sub: 0.25, subWave: SUBW.SQUARE, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.56, res: 0.2, envAmt: 0.35, fD: 0.4, fS: 0.3, aD: 0.5, aS: 0.6, aR: 0.2, reverb: 0.12, glue: 0.5, monoLow: 0.35, accent: 0.45 },
    seq: edit([0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 4, 7, 6, 7]),
    prog: [0, 1, 2, 2],
    steps: steps({ acc: [2, 0, 1, 0] }),
    extra: { xFlMix: 0.6, xFlRate: flHz(0.068), xFlDepth: 0.85, xFlFb: fb(0.75), xPumpDepth: 0.75, xPumpRate: PUMP('1/4'), xPumpShape: 0.45, xRevSize: revS(1.2), xAir: shelf(1.8), xWarmth: 0.2 },
  },
  {
    name: 'SPACE DISCO BELLS',
    cat: 'DISCO',
    desc: 'FM bells in thirty-second notes over two octaves of ninths, some left to chance, a shimmer reverb above and a wide dotted echo.',
    bpm: 116,
    knobs: { rate: RATE['1/32'], mode: MODE.UP, range: RANGE[2], notes: NOTES(0), chord: CHORD['9TH'], gate: 0.4, wave1: WAVE1.SINE, osc1: 0.9, fm: 0.35, ratio: RATIO('4'), octave: OCT(1), fmode: FMODE.LP12, cutoff: 0.78, res: 0.1, envAmt: 0.2, fD: 0.45, fS: 0.1, fR: 0.4, aD: 0.48, aS: 0, aR: 0.45, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.FM, lfoAmt: 0.3, delay: 0.3, dlyTime: DLY['3/16'], reverb: 0.4, width: 0.9, drift: 0.3, accent: 0.4 },
    seq: AUTO,
    prog: [6, 4, 7, 2],
    steps: steps({ prob: [100, 100, 75, 100, 50, 100, 100, 75, 100, 50, 100], acc: [2, 1, 1, 0, 1] }),
    extra: { xHpf: hpHz(300), xShimmer: 0.4, xDlyMode: DMODE('WIDE'), xLfo2Rate: L2RATE('1/2'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('PAN'), xLfo2Depth: 0.4, xRevSize: revS(4), xRevTone: 0.7, xAir: shelf(1.2) },
  },
  {
    name: 'CLAVI FUNK',
    cat: 'DISCO',
    desc: 'A synthetic clavinet in swung, syncopated sixteenths: a bright pulse with snapping accents through a funky phaser.',
    bpm: 108,
    knobs: { rate: RATE['1/16'], gate: 0.42, wave1: WAVE1.PULSE, osc1: 0.9, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.5, res: 0.35, envAmt: 0.55, keyTrack: 0.8, fD: 0.3, fS: 0, fR: 0.15, aD: 0.45, aS: 0.35, aR: 0.12, reverb: 0.1, accent: 0.8, accFlt: 0.9, phase: 0.1, drift: 0.4, glue: 0.65 },
    seq: edit([0, R, 7, 0, R, 4, R, 7, R, 0, R, 4, 7, R, 6, R]),
    prog: [0, 4],
    steps: steps({ acc: [2, 1, 0, 2, 1, 1, 1, 0, 1, 2, 1, 0, 2, 1, 1, 1], gate: [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 2, 1, 0, 1] }),
    extra: { xSwing: 0.5, xPhMix: 0.55, xPhRate: phHz(0.9), xPhDepth: 0.5, xPhFb: 0.65, xRevSize: revS(0.9), xAir: shelf(1.8) },
  },
  {
    name: 'LASER RATCHET',
    cat: 'DISCO',
    desc: 'Disco lasers: a hard synced oscillator swept down on every eighth, ring modulation for the metal, triple and quadruple ratchets inside the arpeggio.',
    bpm: 126,
    knobs: { rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SAW, osc1: 0.35, wave2: WAVE2.SAW, range2: FEET[4], semi2: SEMI(5), osc2: 0.85, sync: ON, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.7, res: 0.3, envAmt: 0.25, fD: 0.35, fS: 0.2, aD: 0.38, aS: 0.15, aR: 0.2, delay: 0.25, dlyTime: DLY['1/8'], reverb: 0.2, glue: 0.4, accent: 0.5, phase: 0.2 },
    seq: edit([0, 2, 4, 7, 9, 7, 4, 2]),
    prog: [0, 5, 1, 2],
    steps: steps({ rat: [1, 1, 1, 3, 1, 1, 4, 1, 1, 2, 1, 1, 1, 1, 4, 1], acc: [2, 1, 1, 2, 1, 1, 2, 1], gate: [1, 1, 1, 0, 1, 1, 0, 1] }),
    extra: { xRing: 0.45, xLfo2Rate: L2RATE('1/8'), xLfo2Shape: L2SHAPE('SAW'), xLfo2Dest: L2DEST('OSC 2 PITCH'), xLfo2Depth: 0.6, xDlyMode: DMODE('STEREO'), xRevSize: revS(1.6), xHpf: hpHz(150) },
  },
  {
    name: 'OFFBEAT BELL',
    cat: 'DISCO',
    desc: 'The disco cowbell on the offbeats: two squares a fifth apart with ring modulation in a resonant band pass, a double hit ending the bar.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.3, wave1: WAVE1.SQUARE, osc1: 0.7, wave2: WAVE2.SQUARE, range2: FEET[4], semi2: SEMI(-5), osc2: 0.7, octave: OCT(1), fmode: FMODE.BP, cutoff: 0.6, res: 0.5, envAmt: 0.2, keyTrack: 0.3, fA: 0, fD: 0.3, fS: 0, fR: 0.2, aA: 0, aD: 0.36, aS: 0, aR: 0.25, reverb: 0.2, accent: 0.6, phase: 0.1, drift: 0.2, glue: 0.85, dist: 0.3 },
    seq: edit([R, R, 0, R, R, R, 0, R, R, R, 0, R, R, R, 0, 0]),
    prog: [0],
    steps: steps({ acc: [1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 0], rat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], prob: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 50] }),
    extra: { xRing: 0.5, xHpf: hpHz(400), xRevSize: revS(0.7), xRevTone: 0.55, xRevPre: preMs(10) },
  },
  {
    name: 'SYN TOM FALL',
    cat: 'DISCO',
    desc: 'The falling disco synth tom: a sine dropping an octave on every beat, a breath of noise for the skin, the last hit of the bar doubled.',
    bpm: 118,
    knobs: { rate: RATE['1/4'], gate: 0.5, osc1: 0, wave2: WAVE2.SINE, range2: FEET[8], osc2: 1, noise: 0.12, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.6, res: 0.1, envAmt: 0.4, fA: 0, fD: 0.3, fS: 0, fR: 0.3, aA: 0, aD: 0.56, aS: 0, aR: 0.45, delay: 0.3, dlyTime: DLY['3/16'], reverb: 0.25, accent: 0.4, phase: 0.1, drift: 0.2 },
    seq: edit([7, 7, 4, 0]),
    prog: [0, 0, 4, 4],
    steps: steps({ rat: [1, 1, 1, 2], acc: [2, 1, 1, 1], prob: [100, 75, 100, 100] }),
    extra: { xLfo2Rate: L2RATE('1/4'), xLfo2Shape: L2SHAPE('SAW'), xLfo2Dest: L2DEST('OSC 2 PITCH'), xLfo2Depth: 0.5, xNoiseColor: 0.3, xRevSize: revS(1.8), xRevTone: 0.45, xBass: shelf(1.2) },
  },

  /* ======================= HYPNOTIQUES / MINIMAL ======================= */
  {
    name: 'THREE AGAINST FOUR',
    cat: 'HYPNOTIC',
    desc: 'Three notes against the bar, a square and its twelfth in a ladder filter, the cutoff over four bars, a wide dotted echo filling the gaps.',
    bpm: 124,
    knobs: { rate: RATE['1/16'], gate: 0.35, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.SQUARE, range2: FEET[4], semi2: SEMI(7), osc2: 0.4, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.42, res: 0.5, envAmt: 0.4, fD: 0.4, fS: 0, fR: 0.35, aD: 0.45, aS: 0, aR: 0.4, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.3, delay: 0.45, dlyTime: DLY['3/16'], reverb: 0.3, phase: 0.3, drift: 0.2 },
    seq: edit([0, 7, 4]),
    prog: [0],
    steps: steps({ acc: [2, 1, 0] }),
    extra: { xDlyMode: DMODE('WIDE'), xLfo1Dest2: L1D2('RES'), xLfo1Depth2: 0.3, xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('PAN'), xLfo2Depth: 0.5, xRevSize: revS(5), xRevTone: 0.2 },
  },
  {
    name: 'FIVE STEP RITUAL',
    cat: 'HYPNOTIC',
    desc: 'Five steps in a screaming resonant filter: one note ratchets, two play only sometimes, the resonance breathing over eight bars.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.35, wave1: WAVE1.SAW, osc1: 0.9, octave: OCT(0), fmode: FMODE.MS10, cutoff: 0.4, res: 0.78, envAmt: 0.5, fD: 0.38, fS: 0, fR: 0.3, aD: 0.45, aS: 0.05, aR: 0.35, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.25, delay: 0.4, dlyTime: DLY['1/4'], tape: 0.4, reverb: 0.3, phase: 0.3, drift: 0.25, accFlt: 0.6 },
    seq: edit([0, R, 4, 2, 7]),
    prog: [0, 0, 0, 3],
    steps: steps({ rat: [1, 1, 2, 1, 1], prob: [100, 100, 100, 75, 50], acc: [2, 1, 1, 0, 1] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('RES'), xLfo2Depth: 0.5, xRevSize: revS(6), xRevTone: 0.25, xRevPre: preMs(40) },
  },
  {
    name: 'SEVEN MOON CYCLE',
    cat: 'HYPNOTIC',
    desc: 'Seven steps turning against sixteen, a slow pulse width in a band pass, a deep slow phaser and a dotted quarter tape echo.',
    bpm: 120,
    knobs: { rate: RATE['1/16'], gate: 0.4, wave1: 0.7, osc1: 0.9, octave: OCT(0), fmode: FMODE.BP, cutoff: 0.55, res: 0.4, envAmt: 0.3, fD: 0.45, fS: 0.1, fR: 0.35, aD: 0.5, aS: 0.1, aR: 0.4, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.WAVE, lfoAmt: 0.4, delay: 0.45, dlyTime: DLY['3/8'], tape: 0.5, reverb: 0.3, drift: 0.3 },
    seq: edit([0, 7, 4, R, 9, 4, R]),
    prog: [0],
    steps: steps({ gate: [1, 0, 1, 1, 2, 0, 1], acc: [2, 1, 1, 1, 2, 0, 1] }),
    extra: { xPhMix: 0.6, xPhRate: phHz(0.08), xPhDepth: 0.9, xPhFb: 0.7, xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.3, xRevSize: revS(7), xRevTone: 0.3 },
  },
  {
    name: 'DUB ECHO CHAMBER',
    cat: 'HYPNOTIC',
    desc: 'A dub chord stab in eighths, two hits out of five and the second one uncertain, drowned in a dotted quarter tape echo and a dark reverb.',
    bpm: 118,
    knobs: { rate: RATE['1/8'], gate: 0.55, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(3), fine1: cents(-7), fine2: cents(7), osc1: 0.84, osc2: 0.8, stack: 0.25, load: 0.35, glue: 0.7, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.4, res: 0.3, envAmt: 0.45, fD: 0.5, fS: 0.1, fR: 0.45, aD: 0.6, aS: 0.35, aR: 0.5, chorus: CHORUS.I, delay: 0.55, dlyTime: DLY['3/8'], tape: 0.65, reverb: 0.4, monoLow: 0.35 },
    seq: edit([0, R, R, 4, R]),
    prog: [0, 0, 4, 4],
    steps: steps({ prob: [100, 100, 100, 75, 100], acc: [2, 1, 1, 0, 1] }),
    extra: { xHpf: hpHz(120), xLfo2Rate: L2RATE('1/4'), xLfo2Shape: L2SHAPE('S&H'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.12, xRevSize: revS(6.5), xRevTone: 0.15, xRevPre: preMs(40) },
  },
  {
    name: 'SINGING COMB',
    cat: 'HYPNOTIC',
    desc: 'A burst of pink noise sets a tuned comb filter ringing: plucked strings that sing the note, nine steps against the bar.',
    bpm: 121,
    knobs: { rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.5, noise: 1, load: 0.6, glue: 0.9, dist: 0.2, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.52, res: 0.1, envAmt: 0.6, keyTrack: 0.8, fA: 0, fD: 0.3, fS: 0.1, fR: 0.3, aA: 0, aD: 0.72, aS: 0, aR: 0.6, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.2, delay: 0.2, dlyTime: DLY['3/16'], reverb: 0.28, accent: 0.6, accFlt: 0.8, drift: 0.3, width: 0.6 },
    seq: edit([0, R, 4, 7, R, 2, R, 9, 4]),
    prog: [0, 0, 5, 5],
    steps: steps({ prob: [100, 100, 100, 75, 100, 100, 100, 50, 100], acc: [2, 1, 1, 0, 1, 2, 1, 0, 1] }),
    extra: { xComb: 0.9, xCombFb: fb(0.93), xNoiseColor: 0.4, xHpf: hpHz(110), xWarmth: 0.6, xBass: shelf(1.2), xDlyMode: DMODE('STEREO'), xRevSize: revS(2.6), xRevTone: 0.55 },
  },
  {
    name: 'RANDOM DROPLETS',
    cat: 'HYPNOTIC',
    desc: 'Random droplets over two octaves of ninths, each with its own brightness and its own odds of falling, a touch of shimmer.',
    bpm: 125,
    knobs: { rate: RATE['1/16'], mode: MODE.RAND, range: RANGE[2], notes: NOTES(0), chord: CHORD['9TH'], gate: 0.35, wave1: 0.1, osc1: 1, load: 0.3, octave: OCT(1), fmode: FMODE.LP12, cutoff: 0.6, res: 0.65, envAmt: 0.3, keyTrack: 0.8, fD: 0.3, fS: 0, fR: 0.25, aD: 0.42, aS: 0.2, aR: 0.3, lfoRate: L1RATE['1/16'], lfoShape: L1SHAPE.SH, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.4, delay: 0.4, dlyTime: DLY['3/16'], tape: 0.3, reverb: 0.35, drift: 0.2, glue: 0.75 },
    seq: AUTO,
    prog: [0],
    steps: steps({ prob: [100, 75, 100, 50, 100, 75, 100, 25, 75, 100, 50] }),
    extra: { xShimmer: 0.25, xLfo2Rate: L2RATE('1 BAR'), xLfo2Shape: L2SHAPE('RND'), xLfo2Dest: L2DEST('PAN'), xLfo2Depth: 0.6, xRevSize: revS(5.5), xRevTone: 0.35 },
  },
  {
    name: 'GHOST RATCHETS',
    cat: 'HYPNOTIC',
    desc: 'Metal ticks for a minimal groove: ring modulated squares through a high pass, ratchets and probabilities on every step so the bar never comes back the same.',
    bpm: 127,
    knobs: { rate: RATE['1/16'], gate: 0.3, wave1: WAVE1.SQUARE, osc1: 0.25, wave2: WAVE2.SQUARE, range2: FEET[2], semi2: SEMI(6), osc2: 0.25, octave: OCT(1), fmode: FMODE.HP, cutoff: 0.62, res: 0.3, envAmt: 0.2, keyTrack: 0.2, fA: 0, fD: 0.25, fS: 0, fR: 0.15, aA: 0, aD: 0.28, aS: 0, aR: 0.15, delay: 0.22, dlyTime: DLY['1/8'], reverb: 0.2, accent: 0.7, phase: 0.05, drift: 0.3, width: 0.8 },
    seq: edit([7, R, 7, 7, R, 7, R, 7, 7, R, 7, R, 7, 7, R, 7]),
    prog: [0],
    steps: steps({ rat: [1, 1, 2, 1, 1, 3, 1, 1, 2, 1, 4, 1, 1, 2, 1, 3], prob: [100, 100, 50, 75, 100, 50, 100, 100, 75, 100, 25, 100, 100, 50, 100, 50], acc: [2, 1, 0, 1, 1, 0, 1, 2, 1, 1, 0, 1, 2, 0, 1, 0] }),
    extra: { xRing: 0.85, xHpf: hpHz(900), xDlyMode: DMODE('WIDE'), xLfo2Rate: L2RATE('1/16'), xLfo2Shape: L2SHAPE('S&H'), xLfo2Dest: L2DEST('PAN'), xLfo2Depth: 0.6, xRevSize: revS(0.8), xRevTone: 0.7, xRevPre: preMs(5) },
  },
  {
    name: 'PENDULUM',
    cat: 'HYPNOTIC',
    desc: 'Three eighths against eight, tied and sliding, the twin filters spread apart and a left to right swing every half note.',
    bpm: 118,
    knobs: { rate: RATE['1/8'], gate: 0.6, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[16], fine1: cents(-5), fine2: cents(5), osc1: 0.84, osc2: 0.6, octave: OCT(0), fmode: FMODE.MOOG, space: 0.5, cutoff: 0.45, res: 0.4, envAmt: 0.4, fD: 0.5, fS: 0.2, fR: 0.45, aA: 0.2, aD: 0.6, aS: 0.4, aR: 0.5, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.WCUT, lfoAmt: 0.25, delay: 0.3, dlyTime: DLY['3/16'], reverb: 0.3, monoLow: 0.3 },
    seq: edit([0, 7, 4]),
    prog: [0, 0, 1, 1],
    steps: steps({ gate: [3, 1, 2], slide: [0, 1, 0] }),
    extra: { xDlyMode: DMODE('STEREO'), xLfo2Rate: L2RATE('1/2'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('PAN'), xLfo2Depth: 0.7, xRevSize: revS(5), xRevTone: 0.3 },
  },
  {
    name: 'ELEVEN ORBIT',
    cat: 'HYPNOTIC',
    desc: 'A deep sine bass rolling over eleven steps, sliding between its notes, pumping on the beat: nothing above, everything below.',
    bpm: 123,
    knobs: { rate: RATE['1/16'], gate: 0.6, wave1: 0.08, osc1: 0.95, sub: 0.45, subOct: SUBOCT['-1'], subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.LP12, cutoff: 0.42, res: 0.15, envAmt: 0.3, keyTrack: 0.6, fA: 0, fD: 0.4, fS: 0.2, fR: 0.25, aA: 0.05, aD: 0.5, aS: 0.6, aR: 0.2, reverb: 0.05, accent: 0.5, accFlt: 0.4, phase: 0.3, drift: 0.2, monoLow: 0.5, load: 0.2 },
    seq: edit([0, 0, R, 4, 0, R, 7, 0, 2, R, 0]),
    prog: [0],
    steps: steps({ slide: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0], gate: [1, 0, 1, 2, 1, 1, 3, 1, 1, 1, 0], acc: [2, 1, 1, 1, 0, 1, 2, 1, 1, 1, 0], prob: [100, 75, 100, 100, 100, 100, 100, 75, 100, 100, 50] }),
    extra: { xPumpDepth: 0.55, xPumpRate: PUMP('1/4'), xPumpShape: 0.5, xWarmth: 0.4, xBass: shelf(1.8), xAir: shelf(-3), xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('WAVE'), xLfo2Depth: 0.25 },
  },
  {
    name: 'WOODEN LOOP',
    cat: 'HYPNOTIC',
    desc: 'A struck FM wood block over seven steps with a short tuned comb for its body, every hit somewhere else in the room, two of them left to chance.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.3, wave1: WAVE1.SINE, osc1: 0.9, fm: 0.5, ratio: RATIO('4'), octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.55, res: 0.2, envAmt: 0.5, fD: 0.25, fS: 0, fR: 0.2, aD: 0.45, aS: 0, aR: 0.3, glue: 0.75, lfoRate: L1RATE['1/16'], lfoShape: L1SHAPE.SH, lfoDest: L1DEST.CUTOFF, lfoAmt: 0, delay: 0.22, dlyTime: DLY['1/4'], reverb: 0.22, phase: 0.04, drift: 0.2, accent: 0.6 },
    seq: edit([0, R, 4, 0, R, 7, 2]),
    prog: [0],
    steps: steps({ prob: [100, 100, 75, 100, 100, 50, 75], rat: [1, 1, 1, 1, 1, 2, 1], acc: [2, 1, 1, 1, 1, 0, 1] }),
    extra: { xComb: 0.4, xCombFb: fb(0.6), xLfo1Dest2: L1D2('PAN'), xLfo1Depth2: 0.4, xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('FM'), xLfo2Depth: 0.35, xRevSize: revS(1.5), xRevTone: 0.4 },
  },
  {
    name: 'GREY DAWN PULSE',
    cat: 'HYPNOTIC',
    desc: 'Three long quarter notes against four, stacked saws down low, the wave shape drifting over four bars, a half note pump with a long release.',
    bpm: 120,
    knobs: { rate: RATE['1/4'], gate: 0.7, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-6), fine2: cents(6), osc1: 0.84, osc2: 0.7, stack: 0.3, sub: 0.3, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.3, res: 0.35, envAmt: 0.35, fA: 0.3, fD: 0.65, fS: 0.3, fR: 0.55, aA: 0.35, aD: 0.7, aS: 0.6, aR: 0.55, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.WAVE, lfoAmt: 0.3, chorus: CHORUS.I, delay: 0.3, dlyTime: DLY['3/8'], tape: 0.3, reverb: 0.4, monoLow: 0.4 },
    seq: edit([0, 4, 7]),
    prog: [6, 6, 6, 6, 7, 7, 7, 7],
    steps: steps({ gate: [3, 1, 2] }),
    extra: { xPumpDepth: 0.35, xPumpRate: PUMP('1/2'), xPumpShape: 0.85, xLfo1Dest2: L1D2('SUB'), xLfo1Depth2: 0.3, xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.35, xRevSize: revS(7), xRevTone: 0.2 },
  },
  {
    name: 'GLASS METRONOME',
    cat: 'HYPNOTIC',
    desc: 'Nine glass steps against sixteen: a sine and its double octave in a high pass, a shimmer rising in the reverb, a wide dotted echo.',
    bpm: 126,
    knobs: { rate: RATE['1/16'], gate: 0.25, wave1: 0.1, osc1: 1, wave2: WAVE2.SINE, range2: FEET[2], osc2: 0.4, octave: OCT(1), fmode: FMODE.HP, cutoff: 0.35, res: 0.5, envAmt: 0.25, fD: 0.3, fS: 0, fR: 0.3, aD: 0.4, aS: 0, aR: 0.35, lfoRate: L1RATE['1 BAR'], lfoShape: L1SHAPE.SAW, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.2, delay: 0.4, dlyTime: DLY['3/16'], reverb: 0.4, phase: 0.04, drift: 0.15 },
    seq: edit([7, R, 7, R, 4, R, 7, 9, R]),
    prog: [0],
    steps: steps({ rat: [1, 1, 1, 1, 2, 1, 1, 1, 1], prob: [100, 100, 75, 100, 100, 100, 100, 50, 100] }),
    extra: { xShimmer: 0.6, xDlyMode: DMODE('WIDE'), xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('OSC MIX'), xLfo2Depth: 0.6, xRevSize: revS(8), xRevTone: 0.45 },
  },

  /* ======================= DARK DISCO / INDIE DANCE ======================= */
  {
    name: 'ACID CONFESSION',
    cat: 'DARK',
    desc: 'A sixteen step acid line: a saw in a screaming resonant ladder, slides tied into the next note and accents that tear the filter open.',
    bpm: 126,
    knobs: { rate: RATE['1/16'], gate: 0.45, wave1: WAVE1.SAW, osc1: 0.9, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.36, res: 0.86, envAmt: 0.65, keyTrack: 0.5, fA: 0, fD: 0.4, fS: 0, fR: 0.3, aA: 0, aD: 0.5, aS: 0.5, aR: 0.18, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.2, dist: 0.3, delay: 0.25, dlyTime: DLY['3/16'], reverb: 0.12, accent: 0.85, accFlt: 1, phase: 0.3, monoLow: 0.35, glue: 0.45 },
    seq: edit([0, 0, 7, 0, R, 0, 6, 7, 0, 2, 0, 7, R, 4, 0, 9]),
    prog: [0],
    steps: steps({ slide: [0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1], acc: [1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2], gate: [1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('ENV AMT'), xLfo2Depth: 0.5, xRevSize: revS(1.6), xRevTone: 0.35 },
  },
  {
    name: 'SLOW ACID SPIRAL',
    cat: 'DARK',
    desc: 'A hollow square acid bass at 110, five steps that slide and fold on themselves, the wavefolder growling under the accents.',
    bpm: 110,
    knobs: { rate: RATE['1/16'], gate: 0.55, wave1: WAVE1.SQUARE, osc1: 0.9, sub: 0.3, subOct: SUBOCT['-1'], subWave: SUBW.SQUARE, octave: OCT(-1), fmode: FMODE.MS10, cutoff: 0.33, res: 0.66, envAmt: 0.5, fD: 0.45, fS: 0, fR: 0.35, aD: 0.55, aS: 0.45, aR: 0.25, dist: 0.15, reverb: 0.1, accent: 0.8, accFlt: 1, phase: 0.3, monoLow: 0.4, glue: 0.45 },
    seq: edit([0, 0, 7, R, 4]),
    prog: [0],
    steps: steps({ slide: [0, 0, 1, 0, 1], acc: [1, 2, 1, 1, 2], rat: [1, 1, 1, 1, 2], gate: [1, 0, 2, 1, 1] }),
    extra: { xFold: 0.42, xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('ENV AMT'), xLfo2Depth: 0.6, xRevSize: revS(2), xRevTone: 0.3, xWarmth: 0.3 },
  },
  {
    name: 'CURSED GALLOP',
    cat: 'DARK',
    desc: 'A dark disco bass galloping through an overloaded filter, long growling notes crushed to six bits and pumped hard on every beat.',
    bpm: 118,
    knobs: { rate: RATE['1/16'], gate: 0.75, wave1: WAVE1.PULSE, osc1: 0.88, wave2: WAVE2.SAW, range2: FEET[16], fine1: cents(-7), fine2: cents(7), osc2: 0.6, sub: 0.3, subWave: SUBW.SQUARE, octave: OCT(-1), fmode: FMODE.MS10, cutoff: 0.3, res: 0.5, envAmt: 0.4, fA: 0.2, fD: 0.5, fS: 0.3, fR: 0.25, aD: 0.5, aS: 0.7, aR: 0.2, load: 0.7, dist: 0.45, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.SAW, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.3, accent: 0.6, accFlt: 0.7, phase: 0.3, monoLow: 0.45, reverb: 0.1, glue: 0.5 },
    seq: edit([0, R, 0, 0, 0, R, 0, 7]),
    prog: [0, 3, 1, 2],
    steps: steps({ acc: [2, 1, 0, 1, 2, 1, 0, 2], gate: [1, 1, 0, 0, 1, 1, 0, 2] }),
    extra: { xCrushBits: bits(6), xCrushRate: dsHz(6000), xPumpDepth: 0.85, xPumpRate: PUMP('1/4'), xPumpShape: 0.3, xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('DRIVE'), xLfo2Depth: 0.3, xRevSize: revS(1.2), xRevTone: 0.35, xWarmth: 0.3 },
  },
  {
    name: 'IRON BODY',
    cat: 'DARK',
    desc: 'Hammered and martial: seven stacked saws per oscillator, folded and overdriven, a dry envelope, the fourth hit doubled.',
    bpm: 124,
    knobs: { rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-12), fine2: cents(12), osc1: 0.85, osc2: 0.8, stack: 0.4, wide: 0.5, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.5, res: 0.25, envAmt: 0.55, fD: 0.28, fS: 0.05, fR: 0.15, aD: 0.4, aS: 0.25, aR: 0.1, dist: 0.5, accent: 0.5, reverb: 0.15, glue: 0.55, monoLow: 0.4, drift: 0.2 },
    seq: edit([0, 0, 7, 0]),
    prog: [0, 0, 4, 1],
    steps: steps({ acc: [2, 1, 2, 0], rat: [1, 1, 1, 2] }),
    extra: { xUnison: UNI(7), xFold: 0.5, xLfo2Rate: L2RATE('1/16'), xLfo2Shape: L2SHAPE('S&H'), xLfo2Dest: L2DEST('ENV AMT'), xLfo2Depth: 0.15, xRevSize: revS(1.0), xRevTone: 0.3, xWarmth: 0.4, xWidth: 0.6 },
  },
  {
    name: 'NIGHT CRAWLER',
    cat: 'DARK',
    desc: 'A dark descending arpeggio with a reversed filter contour, the notes opening as they end, ring modulation for the grain and a restless phaser.',
    bpm: 120,
    knobs: { rate: RATE['1/16'], gate: 0.55, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[16], semi2: SEMI(7), osc1: 0.8, osc2: 0.5, octave: OCT(0), fmode: FMODE.MOOG, fpol: NEG, cutoff: 0.55, res: 0.45, envAmt: 0.35, fD: 0.5, fS: 0, fR: 0.4, aD: 0.55, aS: 0.4, aR: 0.3, dist: 0.2, load: 0.2, delay: 0.3, dlyTime: DLY['3/16'], tape: 0.3, reverb: 0.28 },
    seq: edit([7, 4, 2, R, 0, 2]),
    prog: [4, 0, 1, 3],
    steps: steps({ slide: [0, 1, 0, 0, 1, 0], gate: [1, 2, 1, 1, 2, 0] }),
    extra: { xRing: 0.6, xPhMix: 0.45, xPhRate: phHz(1.6), xPhDepth: 0.4, xPhFb: 0.75, xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.2, xRevSize: revS(3.5), xRevTone: 0.3 },
  },
  {
    name: 'SYNC SCREAMER',
    cat: 'DARK',
    desc: 'A thick hard sync lead, five copies per oscillator spread wide, screaming as the sync sweeps up over two bars, slides between its notes.',
    bpm: 122,
    knobs: { rate: RATE['1/8'], gate: 0.75, wave1: WAVE1.SAW, osc1: 0.5, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(5), osc2: 0.85, sync: ON, stack: 0.3, wide: 0.6, octave: OCT(0), fmode: FMODE.MS10, cutoff: 0.62, res: 0.35, envAmt: 0.3, fD: 0.45, fS: 0.4, fR: 0.3, aA: 0.05, aD: 0.5, aS: 0.7, aR: 0.3, dist: 0.35, delay: 0.3, dlyTime: DLY['1/4'], reverb: 0.25, phase: 0.3, accFlt: 0.6 },
    seq: edit([0, R, 7, 6, R, 4, 2, 4]),
    prog: [0, 2],
    steps: steps({ slide: [0, 0, 1, 1, 0, 0, 1, 0], gate: [2, 1, 3, 1, 1, 2, 3, 1], acc: [2, 1, 1, 1, 1, 2, 1, 1] }),
    extra: { xUnison: UNI(5), xDlyMode: DMODE('WIDE'), xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('OSC 2 PITCH'), xLfo2Depth: 0.45, xRevSize: revS(2.2), xRevTone: 0.4, xWidth: 0.6 },
  },
  {
    name: 'SUB GROWL',
    cat: 'DARK',
    desc: 'The indie dance bass rolling between the kicks: a big sub, the mixer pushed hard into the ladder, a touch of wavefolding and a pump.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.6, wave1: 0.72, osc1: 0.85, sub: 0.6, subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.33, res: 0.6, envAmt: 0.45, fD: 0.4, fS: 0.15, fR: 0.25, aD: 0.45, aS: 0.5, aR: 0.2, load: 0.7, dist: 0.4, phase: 0.3, monoLow: 0.5, glue: 0.5, reverb: 0.05 },
    seq: edit([R, 0, 0, R, R, 0, 0, R, R, 0, 0, R, R, 0, 7, 0]),
    prog: [0, 5],
    steps: steps({ acc: [1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 1, 0], slide: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1] }),
    extra: { xFold: 0.45, xPumpDepth: 0.5, xPumpRate: PUMP('1/4'), xPumpShape: 0.6, xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('RND'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.4, xRevSize: revS(0.8), xWarmth: 0.35, xBass: shelf(0.6), xAir: shelf(0) },
  },
  {
    name: 'BIT CRYPT',
    cat: 'DARK',
    desc: 'An eight bit descent into the crypt: a pulse arpeggio falling over two octaves, crushed to six bits and resampled at 7 kHz, a stereo echo.',
    bpm: 119,
    knobs: { rate: RATE['1/16'], mode: MODE.DOWN, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.45, wave1: 0.75, osc1: 0.9, octave: OCT(1), fmode: FMODE.LP12, cutoff: 0.75, res: 0.15, envAmt: 0.15, fD: 0.4, fS: 0.4, aA: 0, aD: 0.42, aS: 0.3, aR: 0.2, delay: 0.3, dlyTime: DLY['3/16'], reverb: 0.18, accent: 0.5, phase: 0.1, drift: 0.1 },
    seq: AUTO,
    prog: [0, 3, 1, 4],
    steps: steps({ rat: [1, 1, 1, 1, 1, 1, 1, 2], acc: [2, 1, 1, 1] }),
    extra: { xCrushBits: bits(6), xCrushRate: dsHz(7000), xDlyMode: DMODE('STEREO'), xLfo2Rate: L2RATE('1/8'), xLfo2Shape: L2SHAPE('S&H'), xLfo2Dest: L2DEST('WAVE'), xLfo2Depth: 0.3, xRevSize: revS(1.4), xRevTone: 0.4 },
  },

  /* ======================= TEXTURES ET NAPPES ARPEGEES ======================= */
  {
    name: 'AURORA ARP',
    cat: 'TEXTURE',
    desc: 'A slow arpeggiated pad over three octaves of ninths: seven stacked saws per oscillator, spread wide, long attack and release, eight seconds of reverb.',
    bpm: 110,
    knobs: { rate: RATE['1/4'], mode: MODE.UP, range: RANGE[3], notes: NOTES(0), chord: CHORD['9TH'], gate: 0.9, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-10), fine2: cents(10), osc1: 0.8, osc2: 0.8, stack: 0.55, wide: 0.7, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.55, res: 0.2, envAmt: 0.3, fA: 0.6, fD: 0.7, fS: 0.5, fR: 0.7, aA: 0.62, aD: 0.7, aS: 0.7, aR: 0.8, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.2, delay: 0.3, dlyTime: DLY['3/8'], reverb: 0.55, glue: 0.25, monoLow: 0.35, width: 0.6, accent: 0.3 },
    seq: AUTO,
    prog: [7, 2, 6, 4],
    steps: steps({ gate: [3, 2, 2, 3] }),
    extra: { xUnison: UNI(7), xDlyMode: DMODE('WIDE'), xHpf: hpHz(140), xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('PAN'), xLfo2Depth: 0.3, xRevSize: revS(8), xRevTone: 0.55, xRevPre: preMs(40), xWidth: 0.58 },
  },
  {
    name: 'FROZEN LAKE',
    cat: 'TEXTURE',
    desc: 'FM bells drawn at random from an eleventh chord, half of them left out, very wide, nine seconds of bright reverb with a strong shimmer.',
    bpm: 100,
    knobs: { rate: RATE['1/16'], mode: MODE.RAND, range: RANGE[2], notes: NOTES(0), chord: CHORD['11TH'], gate: 0.5, wave1: WAVE1.SINE, osc1: 0.85, fm: 0.3, ratio: RATIO('7/2'), wave2: WAVE2.TRI, range2: FEET[4], osc2: 0.3, wide: 0.5, octave: OCT(1), fmode: FMODE.LP12, cutoff: 0.74, res: 0.1, envAmt: 0.25, fD: 0.5, fS: 0.1, fR: 0.6, aA: 0.1, aD: 0.6, aS: 0.1, aR: 0.8, delay: 0.35, dlyTime: DLY['3/8'], reverb: 0.6, width: 1, accent: 0.3 },
    seq: AUTO,
    prog: [6],
    steps: steps({ prob: [100, 50, 25, 75, 50, 100, 25, 50, 75, 25, 50] }),
    extra: { xShimmer: 0.7, xDlyMode: DMODE('WIDE'), xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('FM'), xLfo2Depth: 0.4, xRevSize: revS(9), xRevTone: 0.75, xRevPre: preMs(50), xWidth: 0.6 },
  },
  {
    name: 'VELVET HAZE',
    cat: 'TEXTURE',
    desc: 'Five quarter notes melting together in a closed ladder filter, a breath of noise coming and going, a very slow wide phaser, dark reverb.',
    bpm: 96,
    knobs: { rate: RATE['1/4'], gate: 0.95, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-8), fine2: cents(8), osc1: 0.8, osc2: 0.75, stack: 0.7, noise: 0.08, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.38, res: 0.25, envAmt: 0.25, fA: 0.75, fD: 0.8, fS: 0.5, fR: 0.8, aA: 0.8, aD: 0.8, aS: 0.8, aR: 0.85, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.25, chorus: CHORUS.I, delay: 0.2, dlyTime: DLY['3/8'], reverb: 0.6, monoLow: 0.35, accent: 0.2 },
    seq: edit([0, 4, 7, 9, 4]),
    prog: [0, 0, 5, 5],
    steps: steps({ gate: [3, 3, 2, 3, 3] }),
    extra: { xPhMix: 0.7, xPhRate: phHz(0.06), xPhDepth: 0.95, xPhFb: 0.6, xNoiseColor: 0.25, xLfo1Dest2: L1D2('NOISE'), xLfo1Depth2: 0.15, xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('OSC MIX'), xLfo2Depth: 0.5, xRevSize: revS(8.5), xRevTone: 0.25, xRevPre: preMs(30) },
  },
  {
    name: 'CATHEDRAL SHIMMER',
    cat: 'TEXTURE',
    desc: 'A triangle and its double octave in a high pass, seven steps way up high, the shimmer climbing octave after octave in a nine second reverb.',
    bpm: 112,
    knobs: { rate: RATE['1/8'], gate: 0.6, wave1: WAVE1.TRI, osc1: 0.85, wave2: WAVE2.SINE, range2: FEET[2], osc2: 0.35, stack: 0.25, wide: 0.7, octave: OCT(0), fmode: FMODE.HP, cutoff: 0.45, res: 0.3, envAmt: 0.1, fD: 0.5, fS: 0.5, fR: 0.6, aA: 0.45, aD: 0.6, aS: 0.5, aR: 0.85, chorus: CHORUS.II, reverb: 0.7, width: 0.8, accent: 0.3 },
    seq: edit([7, 9, 11, 14, 11, 9, R]),
    prog: [7, 0],
    steps: steps({ prob: [100, 100, 75, 100, 100, 50, 100] }),
    extra: { xShimmer: 0.9, xHpf: hpHz(450), xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.3, xRevSize: revS(9.4), xRevTone: 0.65, xRevPre: preMs(60), xAir: shelf(1.2) },
  },
  {
    name: 'TAPE MEMORY',
    cat: 'TEXTURE',
    desc: 'A memory on a worn cassette: the tape echo all the way up, the pitch weeping at random, pink hiss, a gentle bit crush and a warm master.',
    bpm: 90,
    knobs: { rate: RATE['1/8'], gate: 0.7, wave1: 0.5, osc1: 0.84, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.5, noise: 0.1, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.42, res: 0.15, envAmt: 0.3, fA: 0.3, fD: 0.6, fS: 0.4, fR: 0.6, aA: 0.5, aD: 0.6, aS: 0.5, aR: 0.75, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.PITCH, lfoAmt: 0.08, chorus: CHORUS.I, delay: 0.45, dlyTime: DLY['1/4'], tape: 1, reverb: 0.45, drift: 0.9, accent: 0.3 },
    seq: edit([0, R, 4, 7, 2]),
    prog: [3, 1],
    steps: steps({ prob: [100, 100, 75, 100, 75], gate: [2, 1, 1, 3, 1] }),
    extra: { xCrushBits: bits(11), xCrushRate: dsHz(11000), xNoiseColor: 0.25, xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.25, xRevSize: revS(7), xRevTone: 0.3, xWarmth: 0.6, xAir: shelf(-2.4) },
  },
  {
    name: 'SUNSET SWELL',
    cat: 'TEXTURE',
    desc: 'Arpeggiated sevenths that swell twice a bar under a slow half note pump, five stacked saws per oscillator, a long warm reverb.',
    bpm: 104,
    knobs: { rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.7, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-8), fine2: cents(8), osc1: 0.8, osc2: 0.8, stack: 0.4, wide: 0.5, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.5, res: 0.3, envAmt: 0.3, fA: 0.3, fD: 0.6, fS: 0.4, fR: 0.5, aA: 0.35, aD: 0.6, aS: 0.6, aR: 0.6, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.25, chorus: CHORUS.II, delay: 0.25, dlyTime: DLY['3/16'], reverb: 0.5, monoLow: 0.35, accent: 0.3 },
    seq: AUTO,
    prog: [5, 1, 0, 2],
    steps: steps({ acc: [1, 0, 1, 0] }),
    extra: { xUnison: UNI(5), xPumpDepth: 0.8, xPumpRate: PUMP('1/2'), xPumpShape: 0.95, xRevSize: revS(6.5), xRevTone: 0.45, xRevPre: preMs(30), xWidth: 0.6, xWarmth: 0.3 },
  },
  {
    name: 'CRYSTAL MIST',
    cat: 'TEXTURE',
    desc: 'A mist of bright noise tuned by a resonant comb and a band pass, nothing below 600 Hz, slow random notes of an eleventh chord dissolving in shimmer.',
    bpm: 98,
    knobs: { rate: RATE['1/4'], mode: MODE.RAND, range: RANGE[2], notes: NOTES(0), chord: CHORD['11TH'], gate: 0.9, wave1: WAVE1.TRI, osc1: 0.6, noise: 0.5, octave: OCT(0), fmode: FMODE.BP, cutoff: 0.56, res: 0.5, envAmt: 0.1, keyTrack: 1, fA: 0.5, fD: 0.6, fS: 0.6, fR: 0.7, aA: 0.6, aD: 0.7, aS: 0.7, aR: 0.85, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.2, delay: 0.3, dlyTime: DLY['1/4'], reverb: 0.65, width: 1, wide: 0.6, accent: 0.2 },
    seq: AUTO,
    prog: [6, 7],
    steps: steps({ gate: [3, 2, 3, 3], prob: [100, 75, 100, 50, 100] }),
    extra: { xNoiseColor: 0.62, xComb: 0.8, xCombFb: fb(0.9), xAir: shelf(-4.8), xHpf: hpHz(600), xShimmer: 0.45, xDlyMode: DMODE('WIDE'), xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('NOISE'), xLfo2Depth: 0.3, xRevSize: revS(9), xRevTone: 0.7, xRevPre: preMs(40), xWidth: 0.75 },
  },
  {
    name: 'PHASE OCEAN',
    cat: 'TEXTURE',
    desc: 'A low tide of stacked saws and a square below, six slow notes under a full depth phaser and a through zero flanger, each turning at its own pace.',
    bpm: 92,
    knobs: { rate: RATE['1/4'], gate: 0.95, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[16], fine1: cents(-6), fine2: cents(6), osc1: 0.8, osc2: 0.6, stack: 0.5, wide: 0.6, sub: 0.25, octave: OCT(-1), fmode: FMODE.LP12, cutoff: 0.6, res: 0.15, envAmt: 0.2, fA: 0.6, fD: 0.7, fS: 0.6, fR: 0.7, aA: 0.7, aD: 0.7, aS: 0.8, aR: 0.82, reverb: 0.5, monoLow: 0.3, width: 0.8, accent: 0.2 },
    seq: edit([0, 4, 7, 4, 2, 6]),
    prog: [0, 0, 3, 3, 1, 1, 2, 2],
    steps: steps({ gate: [3, 3, 3, 2, 3, 3], slide: [0, 0, 1, 0, 0, 1] }),
    extra: { xUnison: UNI(5), xPhMix: 0.9, xPhRate: phHz(0.09), xPhDepth: 1, xPhFb: 0.85, xFlMix: 0.45, xFlRate: flHz(0.05), xFlDepth: 0.8, xFlFb: fb(-0.6), xRevSize: revS(7), xRevTone: 0.35, xRevPre: preMs(20), xWidth: 0.72 },
  },
];

/*
 * VOLUME de chaque preset : presets/volumes.json, ecrit par le rendu hors ligne (presets/calibrate.sh : la sonie
 * ponderee K de chaque preset vers -23 LUFS, les TEXTURE vers -25). Un preset absent du fichier part a 0.7.
 */
const VOLUME_FILE = join(HERE, 'volumes.json');
const VOLUME = existsSync(VOLUME_FILE) ? JSON.parse(readFileSync(VOLUME_FILE, 'utf8')) : {};
const VOLUME_DEF = 0.7;

/* ---------------- calcul, validation, ecriture ---------------- */

const KNOB = Object.fromEntries(VOY_KNOBS.map((k) => [k.id, k]));
function clean(id, v) {
  const k = KNOB[id];
  if (!k) throw new Error(`potard inconnu : ${id}`);
  if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error(`${id} hors de 0..1 : ${v}`);
  if (k.steps && !k.morph) {
    const n = k.steps.length - 1;
    return Math.max(0, Math.min(n, Math.round(v * n))) / n;
  }
  return r3(v);
}
function cleanExtra(id, v) {
  const p = EXTRA.find((e) => e.id === id);
  if (!p) throw new Error(`reglage du VST3 inconnu : ${id}`);
  if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error(`${id} hors de 0..1 : ${v}`);
  if (p.steps) {
    const n = p.steps.length - 1;
    return Math.max(0, Math.min(n, Math.round(v * n))) / n;
  }
  return r3(v);
}

function full(p) {
  const raw = { ...SITE_DEF, ...BASE, ...p.knobs, volume: VOLUME[p.name] ?? VOLUME_DEF };
  const knobs = {};
  for (const k of VOY_KNOBS) knobs[k.id] = clean(k.id, raw[k.id]);
  for (const id of Object.keys(p.knobs)) if (!KNOB[id]) throw new Error(`${p.name} : potard inconnu ${id}`);
  const ex = { ...EXTRA_DEF, xQuality: 1, ...p.extra };
  const extra = {};
  for (const e of EXTRA) extra[e.id] = cleanExtra(e.id, ex[e.id]);
  for (const id of Object.keys(p.extra)) if (!EXTRA.some((e) => e.id === id)) throw new Error(`${p.name} : reglage inconnu ${id}`);
  if ('volume' in p.knobs) throw new Error(`${p.name} : VOLUME vient de volumes.json`);
  return { name: p.name, cat: p.cat, desc: p.desc, bpm: p.bpm, knobs, seq: p.seq, prog: [...p.prog], extra, steps: p.steps ?? steps() };
}

const presets = BANK.map(full);
const names = new Set();
for (const p of presets) {
  if (!/^[A-Z0-9-][A-Z0-9 -]{0,23}$/.test(p.name)) throw new Error(`nom invalide : ${p.name}`);
  if (names.has(p.name)) throw new Error(`nom en double : ${p.name}`);
  names.add(p.name);
}

const bank = { v: 1, presets };
const json = (o) => `${JSON.stringify(o, null, 2)}\n`;
const fileName = (i, p) => `${String(i + 1).padStart(2, '0')} ${p.name.replace(/[^A-Z0-9 \-]/g, (c) => (c === '&' ? 'N' : '-'))}.mmarp`;
const disk = (p) => ({ format: 'mm-arp-preset', v: 1, name: p.name, cat: p.cat, desc: p.desc, bpm: p.bpm, knobs: p.knobs, seq: p.seq, prog: p.prog, extra: p.extra, steps: p.steps });

const OUT = join(HERE, 'factory.json');
const DIR = join(HERE, 'factory');
const want = new Map(presets.map((p, i) => [fileName(i, p), json(disk(p))]));

if (process.argv.includes('--check')) {
  let bad = 0;
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== json(bank)) {
    console.error('factory.json pas a jour');
    bad += 1;
  }
  const have = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.mmarp')) : [];
  for (const [f, text] of want) if (!have.includes(f) || readFileSync(join(DIR, f), 'utf8') !== text) (console.error(`${f} pas a jour`), (bad += 1));
  for (const f of have) if (!want.has(f)) (console.error(`${f} en trop`), (bad += 1));
  console.log(bad ? `${bad} fichier(s) a regenerer : node plugin/mm-arp/presets/build.mjs` : `banque a jour (${presets.length} presets)`);
  process.exit(bad ? 1 : 0);
}

writeFileSync(OUT, json(bank));
mkdirSync(DIR, { recursive: true });
for (const f of readdirSync(DIR)) if (f.endsWith('.mmarp') && !want.has(f)) rmSync(join(DIR, f));
for (const [f, text] of want) writeFileSync(join(DIR, f), text);
const byCat = presets.reduce((m, p) => ((m[p.cat] = (m[p.cat] ?? 0) + 1), m), {});
console.log(`${presets.length} presets -> ${OUT} et ${DIR}/ (${Object.entries(byCat).map(([c, n]) => `${c} ${n}`).join(', ')})`);
