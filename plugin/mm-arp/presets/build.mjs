#!/usr/bin/env node
/**
 * MM-ARP, la banque d'usine du VST3 (2026-11-10, Mika : "les presets pourraient etre meilleurs, c'est un peu toujours
 * pareil ! Je veux plus de presets a la Donna Summer, genre disco, ou alors des trucs hypnotiques"). Le VST3 seul : les
 * presets du site (src/v4/state/factory.ts) ne changent pas.
 *
 * Source unique de la banque : ce fichier ecrit
 *   - plugin/mm-arp/presets/factory.json        { v: 1, presets: [ { name, cat, desc, bpm, knobs, seq, prog, extra } ] }
 *   - plugin/mm-arp/presets/factory/NN NOM.mmarp  le meme preset au format disque du plugin (src/v4/plugin/arp/disk.ts)
 *
 *   node plugin/mm-arp/presets/build.mjs           (ecrit)
 *   node plugin/mm-arp/presets/build.mjs --check   (verifie que les fichiers sont a jour, n'ecrit rien)
 *
 * Les 62 potards partent des valeurs de depart de src/v4/voyager/params.ts (lu tel quel : Node retire les types), puis
 * BASE (un point neutre de la banque : OSC 2 coupe, effets a zero), puis ceux du preset ; tout est arrondi comme
 * voyParams.set (clean : un cran sur i / (n - 1), un continu au millieme). Les 14 reglages SOUND+ partent de
 * plugin/mm-arp/extra-params.json. Le rendu de verification : plugin/mm-arp/tests/presets-render.sh.
 *
 * VOLUME : cale par le rendu hors ligne (tests/presets_render.cpp, la sonie RMS de chaque preset sur 8 mesures).
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

/* ---------------- la banque ---------------- */

/*
 * Reperes : un degre est compte dans fa diese mineur depuis la racine de l'accord (0 racine, 2 tierce, 4 quinte, 6
 * septieme, 7 octave, 9 la tierce au-dessus, 11 la quinte au-dessus). La racine est posee vers fa diese 3 (185 Hz) :
 * OCTAVE -1 la descend vers fa diese 2 (92 Hz), le registre des basses disco. Accords : 0 F#m, 1 D, 2 E, 3 C#m, 4 Bm,
 * 5 A, 6 F#m7, 7 Dmaj7 ; une mesure par accord.
 */
const BANK = [
  /* ======================= DISCO / EURO DISCO / ITALO ======================= */
  {
    name: 'MUNICH SEQUENCER',
    cat: 'DISCO',
    desc: 'La basse sequencee de 1977 : racine, octave, quinte, septieme en doubles croches, scie filtree courte, echo a la croche pointee, le filtre qui s ouvre sur 8 mesures.',
    bpm: 120,
    knobs: { rate: RATE['1/16'], gate: 0.42, wave1: WAVE1.SAW, osc1: 0.9, wave2: WAVE2.SQUARE, osc2: 0.5, fine1: cents(-4), fine2: cents(4), octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.38, res: 0.42, envAmt: 0.55, keyTrack: 0.7, fA: 0, fD: 0.33, fS: 0.05, fR: 0.25, aA: 0, aD: 0.4, aS: 0.35, aR: 0.2, dist: 0.05, load: 0.1, delay: 0.38, dlyTime: DLY['3/16'], tape: 0.15, reverb: 0.12, accent: 0.55, accFlt: 0.65, phase: 0.3, drift: 0.35, width: 0.3, monoLow: 0.3, glue: 0.4 },
    seq: edit([0, 7, 4, 6]),
    prog: [0, 0, 1, 2],
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.22, xRevSize: revS(1.4), xRevTone: 0.4, xWarmth: 0.25, xBass: shelf(0.6), xAir: shelf(0.6) },
  },
  {
    name: 'OCTAVE GALLOP',
    cat: 'DISCO',
    desc: 'La basse disco octaviee qui galope (une, deux-trois), une PWM qui respire sur la mesure et un SUB rond dessous.',
    bpm: 124,
    knobs: { rate: RATE['1/16'], gate: 0.55, wave1: 0.7, osc1: 0.88, sub: 0.45, subOct: SUBOCT['-1'], subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.LP12, cutoff: 0.42, res: 0.25, envAmt: 0.4, fD: 0.38, fS: 0.1, fR: 0.2, aD: 0.45, aS: 0.3, aR: 0.18, chorus: CHORUS.I, delay: 0.18, dlyTime: DLY['1/8'], reverb: 0.1, accent: 0.6, accFlt: 0.5, phase: 0.25, drift: 0.4, monoLow: 0.4 },
    seq: edit([0, R, 7, 7]),
    prog: [0, 4, 1, 2],
    extra: { xLfo2Rate: L2RATE('1 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('WAVE'), xLfo2Depth: 0.35, xRevSize: revS(1.0), xWarmth: 0.2 },
  },
  {
    name: 'GLITTER STRINGS',
    cat: 'DISCO',
    desc: 'L arpege brillant de cordes synthetiques : deux scies empilees, CHORUS II, des septiemes qui montent et descendent sur deux octaves.',
    bpm: 118,
    knobs: { rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.7, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-9), fine2: cents(9), osc1: 0.8, osc2: 0.8, stack: 0.35, wide: 0.5, fmode: FMODE.LP12, cutoff: 0.6, res: 0.15, envAmt: 0.25, fA: 0.1, fD: 0.5, fS: 0.5, fR: 0.5, aA: 0.25, aD: 0.6, aS: 0.7, aR: 0.6, chorus: CHORUS.II, delay: 0.22, dlyTime: DLY['1/8'], reverb: 0.4, monoLow: 0.35, glue: 0.3, accent: 0.35, accFlt: 0.3, width: 0.7 },
    seq: AUTO,
    prog: [7, 2, 3, 0],
    extra: { xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('STACK'), xLfo2Depth: 0.3, xRevSize: revS(3.2), xRevTone: 0.6, xRevPre: preMs(30), xAir: shelf(1.2), xWidth: 0.6 },
  },
  {
    name: 'NEON GLIDE',
    cat: 'DISCO',
    desc: 'Un lead italo en croches qui glisse de note en note, carre et scie, un vibrato cale sur la croche, echo pointe.',
    bpm: 120,
    knobs: { rate: RATE['1/8'], gate: 0.85, wave1: 0.65, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-6), fine2: cents(6), osc1: 0.84, osc2: 0.6, octave: OCT(0), glide: 0.3, fmode: FMODE.MOOG, cutoff: 0.55, res: 0.3, envAmt: 0.35, fA: 0.1, fD: 0.55, fS: 0.45, fR: 0.4, aA: 0.1, aD: 0.6, aS: 0.8, aR: 0.35, lfoRate: L1RATE['1/8'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.PITCH, lfoAmt: 0.06, chorus: CHORUS.I, delay: 0.35, dlyTime: DLY['3/16'], tape: 0.2, reverb: 0.3, wide: 0.2, accent: 0.4 },
    seq: edit([4, 7, R, 7, 9, 7, 6, 4]),
    prog: [0, 5, 2, 1],
    extra: { xRevSize: revS(2.4), xWarmth: 0.15 },
  },
  {
    name: 'RIMSHOT PLUCK',
    cat: 'DISCO',
    desc: 'Un pluck percussif comme un rimshot accorde : FM metallique et bruit dans un passe-bande, des contretemps syncopes.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.TRI, osc1: 1, fm: 0.45, ratio: RATIO('7/2'), wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.7, noise: 0.25, octave: OCT(0), fmode: FMODE.BP, cutoff: 0.52, res: 0.2, envAmt: 0.5, keyTrack: 0.8, fA: 0, fD: 0.25, fS: 0.1, fR: 0.15, aA: 0, aD: 0.45, aS: 0.2, aR: 0.2, delay: 0.2, dlyTime: DLY['1/8'], reverb: 0.15, accent: 0.7, accFlt: 0.8, phase: 0.05, drift: 0.3, glue: 0.8 },
    seq: edit([R, 7, R, 7, R, 4, 7, R, R, 7, R, 4, 0, R, 7, R]),
    prog: [0, 1],
    extra: { xLfo2Rate: L2RATE('1/16'), xLfo2Shape: L2SHAPE('S&H'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.08, xRevSize: revS(0.8), xRevTone: 0.6 },
  },
  {
    name: 'BOOGIE SLIDE',
    cat: 'DISCO',
    desc: 'La basse boogie en croches qui glisse sur ses octaves, carre et scie, un SUB, le melangeur qui pousse le filtre.',
    bpm: 112,
    knobs: { rate: RATE['1/8'], gate: 0.75, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[16], osc2: 0.45, sub: 0.35, subWave: SUBW.SINE, octave: OCT(-1), glide: 0.22, fmode: FMODE.MOOG, cutoff: 0.36, res: 0.35, envAmt: 0.5, fD: 0.5, fS: 0.25, fR: 0.3, aD: 0.55, aS: 0.6, aR: 0.25, accent: 0.6, accFlt: 0.5, load: 0.25, dist: 0.1, delay: 0.1, dlyTime: DLY['3/16'], reverb: 0.08, phase: 0.3, monoLow: 0.45 },
    seq: edit([0, 7, 0, 7, 4, 7, 2, 4]),
    prog: [4, 2, 0, 0],
    extra: { xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('ENV AMT'), xLfo2Depth: 0.15, xRevSize: revS(1.0), xWarmth: 0.35, xBass: shelf(1.2) },
  },
  {
    name: 'HI-NRG PUMP',
    cat: 'DISCO',
    desc: 'Hi-NRG a 130 : octaves en doubles croches, deux scies, et le LFO 2 en rampe sur le VCA qui pompe chaque temps.',
    bpm: 130,
    knobs: { rate: RATE['1/16'], gate: 0.55, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-10), fine2: cents(10), osc1: 0.8, osc2: 0.8, sub: 0.3, subWave: SUBW.SQUARE, octave: OCT(-1), stack: 0.15, fmode: FMODE.MOOG, cutoff: 0.4, res: 0.3, envAmt: 0.45, fD: 0.4, fS: 0.2, aD: 0.5, aS: 0.6, aR: 0.2, chorus: CHORUS.I, delay: 0.2, dlyTime: DLY['1/8'], reverb: 0.15, glue: 0.5, monoLow: 0.4 },
    seq: edit([0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 4, 7, 6, 7]),
    prog: [0, 1, 2, 2],
    extra: { xLfo2Rate: L2RATE('1/4'), xLfo2Shape: L2SHAPE('RAMP'), xLfo2Dest: L2DEST('AMP'), xLfo2Depth: 0.6, xRevSize: revS(1.2), xAir: shelf(1.2), xWarmth: 0.2 },
  },
  {
    name: 'SPACE DISCO BELLS',
    cat: 'DISCO',
    desc: 'Des cloches FM en triples croches sur deux octaves de neuviemes, la brillance qui tourne sur deux mesures, panoramique vivant.',
    bpm: 116,
    knobs: { rate: RATE['1/32'], mode: MODE.UP, range: RANGE[2], notes: NOTES(0), chord: CHORD['9TH'], gate: 0.4, wave1: WAVE1.SINE, osc1: 0.9, fm: 0.35, ratio: RATIO('4'), fmode: FMODE.LP12, cutoff: 0.7, res: 0.1, envAmt: 0.2, fD: 0.45, fS: 0.1, fR: 0.4, aD: 0.5, aS: 0.1, aR: 0.45, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.FM, lfoAmt: 0.3, chorus: CHORUS.I, delay: 0.35, dlyTime: DLY['3/16'], reverb: 0.4, width: 0.9, drift: 0.3, accent: 0.4 },
    seq: AUTO,
    prog: [6, 4, 7, 2],
    extra: { xLfo2Rate: L2RATE('1/2'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('PAN'), xLfo2Depth: 0.4, xRevSize: revS(4), xRevTone: 0.7, xAir: shelf(1.2) },
  },
  {
    name: 'CLAVI FUNK',
    cat: 'DISCO',
    desc: 'Un clavinet synthetique en doubles croches syncopees, pulse brillante, accents qui claquent, un wah sur la blanche.',
    bpm: 114,
    knobs: { rate: RATE['1/16'], gate: 0.35, wave1: WAVE1.PULSE, osc1: 0.9, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.5, res: 0.35, envAmt: 0.55, keyTrack: 0.8, fD: 0.3, fS: 0, fR: 0.15, aD: 0.42, aS: 0.3, aR: 0.12, lfoRate: L1RATE['1/2'], lfoShape: L1SHAPE.SAW, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.2, delay: 0.12, dlyTime: DLY['1/8'], reverb: 0.12, accent: 0.8, accFlt: 0.9, phase: 0.1, drift: 0.4 },
    seq: edit([0, R, 7, 0, R, 4, R, 7, R, 0, R, 4, 7, R, 6, R]),
    prog: [0, 4],
    extra: { xRevSize: revS(0.9), xAir: shelf(1.8) },
  },
  {
    name: 'LASER DISCO',
    cat: 'DISCO',
    desc: 'L arpege disco qui monte et redescend sur l accord, scie et carre a l octave, filtre resonant qui respire sur deux mesures.',
    bpm: 126,
    knobs: { rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[4], osc1: 0.85, osc2: 0.45, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.42, res: 0.55, envAmt: 0.45, fD: 0.35, fS: 0.1, aD: 0.4, aS: 0.4, aR: 0.25, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.3, chorus: CHORUS.I, delay: 0.3, dlyTime: DLY['3/16'], tape: 0.25, reverb: 0.25, glue: 0.4 },
    seq: edit([0, 2, 4, 7, 9, 7, 4, 2]),
    prog: [0, 5, 1, 2],
    extra: { xLfo2Rate: L2RATE('1 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('PAN'), xLfo2Depth: 0.3, xRevSize: revS(2.0) },
  },

  /* ======================= HYPNOTIQUES / MINIMAL ======================= */
  {
    name: 'THREE AGAINST FOUR',
    cat: 'HYPNOTIC',
    desc: 'Trois notes contre la mesure, carre et douzieme dans un MOOG, la coupure sur 4 mesures, la resonance et le panoramique qui derivent.',
    bpm: 124,
    knobs: { rate: RATE['1/16'], gate: 0.35, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.SQUARE, range2: FEET[4], semi2: SEMI(7), osc2: 0.4, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.42, res: 0.5, envAmt: 0.4, fD: 0.4, fS: 0, fR: 0.35, aD: 0.45, aS: 0, aR: 0.4, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.3, delay: 0.45, dlyTime: DLY['3/16'], tape: 0.45, reverb: 0.35, phase: 0.3, drift: 0.2 },
    seq: edit([0, 7, 4]),
    prog: [0],
    extra: { xLfo1Dest2: L1D2('RES'), xLfo1Depth2: 0.3, xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('PAN'), xLfo2Depth: 0.5, xRevSize: revS(5), xRevTone: 0.2 },
  },
  {
    name: 'FIVE STEP RITUAL',
    cat: 'HYPNOTIC',
    desc: 'Cinq pas avec deux silences dans le MS-10 tres resonant ; le hasard lisse sur la coupure, la resonance qui respire sur 8 mesures.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.35, wave1: WAVE1.SAW, osc1: 0.9, octave: OCT(0), fmode: FMODE.MS10, cutoff: 0.4, res: 0.78, envAmt: 0.5, fD: 0.38, fS: 0, fR: 0.3, aD: 0.45, aS: 0.05, aR: 0.35, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.25, delay: 0.4, dlyTime: DLY['1/4'], tape: 0.4, reverb: 0.3, phase: 0.3, drift: 0.25, accFlt: 0.6 },
    seq: edit([0, R, 4, 2, R]),
    prog: [0, 0, 0, 3],
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('RES'), xLfo2Depth: 0.5, xRevSize: revS(6), xRevTone: 0.25, xRevPre: preMs(40) },
  },
  {
    name: 'SEVEN MOON CYCLE',
    cat: 'HYPNOTIC',
    desc: 'Sept pas qui tournent contre seize, une PWM lente sur 4 mesures dans un passe-bande, la coupure sur 8 mesures, echo a la noire pointee.',
    bpm: 120,
    knobs: { rate: RATE['1/16'], gate: 0.4, wave1: 0.7, osc1: 0.9, octave: OCT(0), fmode: FMODE.BP, cutoff: 0.55, res: 0.4, envAmt: 0.3, fD: 0.45, fS: 0.1, fR: 0.35, aD: 0.5, aS: 0.1, aR: 0.4, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.WAVE, lfoAmt: 0.4, delay: 0.45, dlyTime: DLY['3/8'], tape: 0.5, reverb: 0.3, drift: 0.3 },
    seq: edit([0, 7, 4, R, 9, 4, R]),
    prog: [0],
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.3, xRevSize: revS(7), xRevTone: 0.3 },
  },
  {
    name: 'DUB ECHO CHAMBER',
    cat: 'HYPNOTIC',
    desc: 'Un accord de dub en croches, deux coups tous les cinq, noye dans une bande a la noire pointee et une reverbe sombre ; S&H sur la coupure.',
    bpm: 118,
    knobs: { rate: RATE['1/8'], gate: 0.45, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-7), fine2: cents(7), osc1: 0.84, osc2: 0.7, stack: 0.25, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.36, res: 0.3, envAmt: 0.45, fD: 0.5, fS: 0.1, fR: 0.45, aD: 0.6, aS: 0.35, aR: 0.5, chorus: CHORUS.I, delay: 0.55, dlyTime: DLY['3/8'], tape: 0.65, reverb: 0.4, monoLow: 0.35 },
    seq: edit([0, R, R, 4, R]),
    prog: [0, 0, 4, 4],
    extra: { xLfo2Rate: L2RATE('1/4'), xLfo2Shape: L2SHAPE('S&H'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.12, xRevSize: revS(6.5), xRevTone: 0.15, xRevPre: preMs(40) },
  },
  {
    name: 'RANDOM DROPLETS',
    cat: 'HYPNOTIC',
    desc: 'Des gouttes au hasard sur deux octaves de neuviemes, un S&H qui donne a chaque note sa brillance, le hasard lisse sur le panoramique.',
    bpm: 125,
    knobs: { rate: RATE['1/16'], mode: MODE.RAND, range: RANGE[2], notes: NOTES(0), chord: CHORD['9TH'], gate: 0.25, wave1: 0.1, osc1: 1, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.52, res: 0.6, envAmt: 0.3, keyTrack: 0.8, fD: 0.3, fS: 0, fR: 0.25, aD: 0.42, aS: 0.1, aR: 0.3, lfoRate: L1RATE['1/16'], lfoShape: L1SHAPE.SH, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.4, delay: 0.4, dlyTime: DLY['3/16'], tape: 0.3, reverb: 0.35, drift: 0.2 },
    seq: AUTO,
    prog: [0],
    extra: { xLfo2Rate: L2RATE('1 BAR'), xLfo2Shape: L2SHAPE('RND'), xLfo2Dest: L2DEST('PAN'), xLfo2Depth: 0.6, xRevSize: revS(5.5), xRevTone: 0.35 },
  },
  {
    name: 'PENDULUM',
    cat: 'HYPNOTIC',
    desc: 'Trois croches contre huit, les deux filtres du Voyager ecartes, forme et coupure sur 4 mesures, un balancier gauche droite a la blanche.',
    bpm: 118,
    knobs: { rate: RATE['1/8'], gate: 0.6, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[16], fine1: cents(-5), fine2: cents(5), osc1: 0.84, osc2: 0.6, octave: OCT(0), fmode: FMODE.MOOG, space: 0.5, cutoff: 0.45, res: 0.4, envAmt: 0.4, fD: 0.5, fS: 0.2, fR: 0.45, aA: 0.2, aD: 0.6, aS: 0.4, aR: 0.5, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.WCUT, lfoAmt: 0.25, delay: 0.35, dlyTime: DLY['3/16'], tape: 0.3, reverb: 0.35, monoLow: 0.3 },
    seq: edit([0, 7, 4]),
    prog: [0, 0, 1, 1],
    extra: { xLfo2Rate: L2RATE('1/2'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('PAN'), xLfo2Depth: 0.7, xRevSize: revS(5), xRevTone: 0.3 },
  },
  {
    name: 'SLOW ACID SPIRAL',
    cat: 'HYPNOTIC',
    desc: 'Une ligne acide de cinq pas avec glissements et accents au filtre ; la coupure sur 2 mesures, ENV AMT qui monte et redescend sur 8.',
    bpm: 128,
    knobs: { rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.9, octave: OCT(-1), glide: 0.15, fmode: FMODE.MOOG, cutoff: 0.28, res: 0.84, envAmt: 0.6, fD: 0.45, fS: 0, fR: 0.35, aD: 0.55, aS: 0.4, aR: 0.3, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.2, dist: 0.25, delay: 0.3, dlyTime: DLY['3/16'], reverb: 0.18, accent: 0.8, accFlt: 1, phase: 0.3, monoLow: 0.4, glue: 0.45 },
    seq: edit([0, 0, 7, R, 4]),
    prog: [0],
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('ENV AMT'), xLfo2Depth: 0.6, xRevSize: revS(3), xRevTone: 0.35 },
  },
  {
    name: 'WOODEN LOOP',
    cat: 'HYPNOTIC',
    desc: 'Un bois frappe en FM sur sept pas, chaque coup place au hasard dans l espace, la frappe qui s eclaircit sur 4 mesures.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.3, wave1: WAVE1.SINE, osc1: 0.9, fm: 0.5, ratio: RATIO('4'), octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.55, res: 0.2, envAmt: 0.5, fD: 0.25, fS: 0, fR: 0.2, aD: 0.45, aS: 0, aR: 0.3, lfoRate: L1RATE['1/16'], lfoShape: L1SHAPE.SH, lfoDest: L1DEST.CUTOFF, lfoAmt: 0, delay: 0.3, dlyTime: DLY['1/4'], reverb: 0.25, phase: 0.04, drift: 0.2, accent: 0.6 },
    seq: edit([0, R, 4, 0, R, 7, 2]),
    prog: [0],
    extra: { xLfo1Dest2: L1D2('PAN'), xLfo1Depth2: 0.4, xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('FM'), xLfo2Depth: 0.35, xRevSize: revS(1.5), xRevTone: 0.4 },
  },
  {
    name: 'GREY DAWN PULSE',
    cat: 'HYPNOTIC',
    desc: 'Trois noires longues contre quatre, des scies empilees dans le grave, la forme au hasard sur 4 mesures, la coupure sur 8.',
    bpm: 120,
    knobs: { rate: RATE['1/4'], gate: 0.7, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-6), fine2: cents(6), osc1: 0.84, osc2: 0.7, stack: 0.3, sub: 0.3, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.3, res: 0.35, envAmt: 0.35, fA: 0.3, fD: 0.65, fS: 0.3, fR: 0.55, aA: 0.35, aD: 0.7, aS: 0.6, aR: 0.55, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.WAVE, lfoAmt: 0.3, chorus: CHORUS.I, delay: 0.3, dlyTime: DLY['3/8'], tape: 0.3, reverb: 0.4, monoLow: 0.4 },
    seq: edit([0, 4, 7]),
    prog: [6, 6, 6, 6, 7, 7, 7, 7],
    extra: { xLfo1Dest2: L1D2('SUB'), xLfo1Depth2: 0.3, xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.35, xRevSize: revS(7), xRevTone: 0.2 },
  },
  {
    name: 'GLASS METRONOME',
    cat: 'HYPNOTIC',
    desc: 'Neuf pas de verre contre seize : un sinus et sa double octave dans un passe-haut, la balance des deux sur 8 mesures.',
    bpm: 126,
    knobs: { rate: RATE['1/16'], gate: 0.25, wave1: 0.1, osc1: 1, wave2: WAVE2.SINE, range2: FEET[2], osc2: 0.4, octave: OCT(1), fmode: FMODE.HP, cutoff: 0.35, res: 0.5, envAmt: 0.25, fD: 0.3, fS: 0, fR: 0.3, aD: 0.4, aS: 0, aR: 0.35, lfoRate: L1RATE['1 BAR'], lfoShape: L1SHAPE.SAW, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.2, delay: 0.45, dlyTime: DLY['3/16'], tape: 0.35, reverb: 0.35, phase: 0.04, drift: 0.15 },
    seq: edit([7, R, 7, R, 4, R, 7, 9, R]),
    prog: [0],
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('OSC MIX'), xLfo2Depth: 0.6, xRevSize: revS(8), xRevTone: 0.3 },
  },

  /* ======================= DARK DISCO / INDIE DANCE ======================= */
  {
    name: 'CURSED GALLOP',
    cat: 'DARK',
    desc: 'La basse dark disco qui galope dans le MS-10, LOAD et OVERDRIVE, l octave en fin de mesure ; la saturation respire sur 4 mesures.',
    bpm: 118,
    knobs: { rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.88, wave2: WAVE2.SAW, range2: FEET[16], fine1: cents(-7), fine2: cents(7), osc2: 0.5, octave: OCT(-1), fmode: FMODE.MS10, cutoff: 0.3, res: 0.55, envAmt: 0.5, fD: 0.38, fS: 0.1, fR: 0.25, aD: 0.45, aS: 0.4, aR: 0.2, load: 0.5, dist: 0.3, accent: 0.6, accFlt: 0.7, phase: 0.3, monoLow: 0.45, delay: 0.2, dlyTime: DLY['3/16'], reverb: 0.12, glue: 0.5 },
    seq: edit([0, R, 0, 0, 0, R, 0, 7]),
    prog: [0, 3, 1, 2],
    extra: { xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('DRIVE'), xLfo2Depth: 0.3, xRevSize: revS(1.2), xRevTone: 0.35, xWarmth: 0.3 },
  },
  {
    name: 'IRON BODY',
    cat: 'DARK',
    desc: 'Martele et martial : deux scies saturees, l octave sur la troisieme double croche, enveloppe seche, aucun chorus.',
    bpm: 124,
    knobs: { rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-12), fine2: cents(12), osc1: 0.85, osc2: 0.8, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.4, res: 0.3, envAmt: 0.6, fD: 0.28, fS: 0.05, fR: 0.15, aD: 0.4, aS: 0.25, aR: 0.12, dist: 0.55, accent: 0.5, delay: 0.1, dlyTime: DLY['1/8'], reverb: 0.18, glue: 0.55, monoLow: 0.4, drift: 0.2 },
    seq: edit([0, 0, 7, 0]),
    prog: [0, 0, 4, 1],
    extra: { xLfo2Rate: L2RATE('1/16'), xLfo2Shape: L2SHAPE('S&H'), xLfo2Dest: L2DEST('ENV AMT'), xLfo2Depth: 0.15, xRevSize: revS(1.0), xRevTone: 0.3, xWarmth: 0.4 },
  },
  {
    name: 'NIGHT CRAWLER',
    cat: 'DARK',
    desc: 'Un arpege sombre qui descend, contour du filtre a l envers (les notes s ouvrent en finissant), un peu de LOAD et d OVERDRIVE.',
    bpm: 120,
    knobs: { rate: RATE['1/16'], gate: 0.55, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[16], osc1: 0.84, osc2: 0.6, octave: OCT(-1), fmode: FMODE.MOOG, fpol: NEG, cutoff: 0.5, res: 0.45, envAmt: 0.3, fD: 0.5, fS: 0, fR: 0.4, aD: 0.55, aS: 0.4, aR: 0.3, dist: 0.2, load: 0.2, delay: 0.35, dlyTime: DLY['3/16'], tape: 0.3, reverb: 0.3 },
    seq: edit([7, 4, 2, R, 0, 2]),
    prog: [4, 0, 1, 3],
    extra: { xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.2, xRevSize: revS(3.5), xRevTone: 0.3 },
  },
  {
    name: 'SYNC SCREAMER',
    cat: 'DARK',
    desc: 'OSC 2 en hard sync qui crie quand le LFO 2 le fait monter sur 2 mesures, dans le MS-10, OVERDRIVE.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.45, wave1: WAVE1.SAW, osc1: 0.6, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(5), osc2: 0.85, sync: ON, octave: OCT(0), fmode: FMODE.MS10, cutoff: 0.45, res: 0.5, envAmt: 0.45, fD: 0.35, fS: 0.1, fR: 0.25, aD: 0.4, aS: 0.3, aR: 0.2, dist: 0.35, delay: 0.25, dlyTime: DLY['3/16'], reverb: 0.2, phase: 0.3, accFlt: 0.6 },
    seq: edit([0, R, 0, 7, R, 4]),
    prog: [0, 2],
    extra: { xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('OSC 2 PITCH'), xLfo2Depth: 0.45, xRevSize: revS(1.6), xRevTone: 0.35 },
  },
  {
    name: 'SUB GROWL',
    cat: 'DARK',
    desc: 'La basse indie dance qui roule entre les kicks, un gros SUB, le melangeur pousse a fond dans le MOOG, le hasard lisse sur la coupure.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.6, wave1: 0.5, osc1: 0.85, sub: 0.6, subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.28, res: 0.6, envAmt: 0.45, fD: 0.4, fS: 0.15, fR: 0.25, aD: 0.45, aS: 0.5, aR: 0.2, load: 0.7, dist: 0.2, phase: 0.3, monoLow: 0.5, glue: 0.5, delay: 0.08, dlyTime: DLY['1/8'], reverb: 0.06 },
    seq: edit([R, 0, 0, R, R, 0, 0, R, R, 0, 0, R, R, 0, 7, 0]),
    prog: [0, 5],
    extra: { xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('RND'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.25, xRevSize: revS(0.8), xWarmth: 0.35, xBass: shelf(0.6) },
  },
  {
    name: 'VELVET DREAD',
    cat: 'DARK',
    desc: 'Des neuviemes qui descendent en cinq notes, pulse et scie, CHORUS II, le STACK qui s ouvre et se referme : l indie dance de nuit.',
    bpm: 120,
    knobs: { rate: RATE['1/16'], mode: MODE.DOWN, range: RANGE[2], notes: NOTES(5), chord: CHORD['9TH'], gate: 0.45, wave1: WAVE1.PULSE, osc1: 0.84, wave2: WAVE2.SAW, range2: FEET[16], osc2: 0.5, stack: 0.2, octave: OCT(-1), fmode: FMODE.LP12, cutoff: 0.4, res: 0.5, envAmt: 0.5, fD: 0.45, fS: 0.1, fR: 0.35, aD: 0.5, aS: 0.3, aR: 0.3, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.WCUT, lfoAmt: 0.2, dist: 0.15, chorus: CHORUS.II, delay: 0.35, dlyTime: DLY['3/16'], reverb: 0.35, monoLow: 0.35 },
    seq: AUTO,
    prog: [6, 4, 7, 3],
    extra: { xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('STACK'), xLfo2Depth: 0.5, xRevSize: revS(4), xRevTone: 0.25 },
  },

  /* ======================= TEXTURES ET NAPPES ARPEGEES ======================= */
  {
    name: 'AURORA ARP',
    cat: 'TEXTURE',
    desc: 'Une nappe arpegee en croches sur trois octaves de neuviemes, scies empilees et larges, attaque et relachement longs, 8 s de reverbe.',
    bpm: 110,
    knobs: { rate: RATE['1/8'], mode: MODE.UP, range: RANGE[3], notes: NOTES(0), chord: CHORD['9TH'], gate: 0.9, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-10), fine2: cents(10), osc1: 0.8, osc2: 0.8, stack: 0.55, wide: 0.6, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.5, res: 0.2, envAmt: 0.3, fA: 0.6, fD: 0.7, fS: 0.5, fR: 0.7, aA: 0.62, aD: 0.7, aS: 0.7, aR: 0.82, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.2, chorus: CHORUS.II, delay: 0.3, dlyTime: DLY['3/8'], reverb: 0.55, glue: 0.25, monoLow: 0.35, width: 0.6, accent: 0.3 },
    seq: AUTO,
    prog: [7, 2, 6, 4],
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('PAN'), xLfo2Depth: 0.3, xRevSize: revS(8), xRevTone: 0.55, xRevPre: preMs(40), xWidth: 0.65 },
  },
  {
    name: 'FROZEN LAKE',
    cat: 'TEXTURE',
    desc: 'Des cloches FM tirees au hasard dans un accord de onzieme, tres larges, 9 s de reverbe claire ; la FM qui fond sur 8 mesures.',
    bpm: 100,
    knobs: { rate: RATE['1/16'], mode: MODE.RAND, range: RANGE[2], notes: NOTES(0), chord: CHORD['11TH'], gate: 0.5, wave1: WAVE1.SINE, osc1: 0.85, fm: 0.3, ratio: RATIO('7/2'), wave2: WAVE2.TRI, range2: FEET[4], osc2: 0.3, wide: 0.5, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.68, res: 0.1, envAmt: 0.25, fD: 0.5, fS: 0.1, fR: 0.6, aA: 0.2, aD: 0.65, aS: 0.2, aR: 0.85, chorus: CHORUS.I, delay: 0.4, dlyTime: DLY['3/8'], tape: 0.2, reverb: 0.6, width: 1, accent: 0.3 },
    seq: AUTO,
    prog: [6],
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('FM'), xLfo2Depth: 0.4, xRevSize: revS(9), xRevTone: 0.75, xRevPre: preMs(50), xWidth: 0.6 },
  },
  {
    name: 'VELVET HAZE',
    cat: 'TEXTURE',
    desc: 'Cinq noires qui se fondent : attaque et relachement tres longs, scies empilees dans le MOOG ferme, un souffle qui va et vient, reverbe sombre de 8 s.',
    bpm: 96,
    knobs: { rate: RATE['1/4'], gate: 0.95, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-8), fine2: cents(8), osc1: 0.8, osc2: 0.75, stack: 0.7, noise: 0.08, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.35, res: 0.25, envAmt: 0.25, fA: 0.75, fD: 0.8, fS: 0.5, fR: 0.8, aA: 0.8, aD: 0.8, aS: 0.8, aR: 0.85, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.25, chorus: CHORUS.I, delay: 0.2, dlyTime: DLY['3/8'], reverb: 0.6, monoLow: 0.35, accent: 0.2 },
    seq: edit([0, 4, 7, 9, 4]),
    prog: [0, 0, 5, 5],
    extra: { xLfo1Dest2: L1D2('NOISE'), xLfo1Depth2: 0.15, xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('OSC MIX'), xLfo2Depth: 0.5, xRevSize: revS(8.5), xRevTone: 0.25, xRevPre: preMs(30) },
  },
  {
    name: 'CATHEDRAL SHIMMER',
    cat: 'TEXTURE',
    desc: 'Un triangle et sa double octave dans un passe-haut, sept pas tout en haut, empiles et larges, 9 s de reverbe brillante.',
    bpm: 112,
    knobs: { rate: RATE['1/16'], gate: 0.6, wave1: WAVE1.TRI, osc1: 0.85, wave2: WAVE2.SINE, range2: FEET[2], osc2: 0.35, stack: 0.25, wide: 0.7, octave: OCT(0), fmode: FMODE.HP, cutoff: 0.45, res: 0.3, envAmt: 0.1, fD: 0.5, fS: 0.5, fR: 0.6, aA: 0.45, aD: 0.6, aS: 0.5, aR: 0.88, chorus: CHORUS.II, delay: 0.35, dlyTime: DLY['3/16'], reverb: 0.7, width: 0.8, accent: 0.3 },
    seq: edit([7, 9, 11, 14, 11, 9, R]),
    prog: [7, 0],
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.3, xRevSize: revS(9.4), xRevTone: 0.65, xRevPre: preMs(60), xAir: shelf(1.2) },
  },
  {
    name: 'TAPE MEMORY',
    cat: 'TEXTURE',
    desc: 'Un souvenir sur cassette : la bande a fond, la hauteur qui pleure au hasard, un peu de souffle, la chaleur du master, 7 s de reverbe.',
    bpm: 90,
    knobs: { rate: RATE['1/8'], gate: 0.7, wave1: 0.5, osc1: 0.84, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.5, noise: 0.06, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.42, res: 0.15, envAmt: 0.3, fA: 0.3, fD: 0.6, fS: 0.4, fR: 0.6, aA: 0.5, aD: 0.6, aS: 0.5, aR: 0.75, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.PITCH, lfoAmt: 0.08, chorus: CHORUS.I, delay: 0.45, dlyTime: DLY['1/4'], tape: 1, reverb: 0.5, drift: 0.9, accent: 0.3 },
    seq: edit([0, R, 4, 7, 2]),
    prog: [3, 1],
    extra: { xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.25, xRevSize: revS(7), xRevTone: 0.3, xWarmth: 0.5, xAir: shelf(-1.8) },
  },
  {
    name: 'SUNSET SWELL',
    cat: 'TEXTURE',
    desc: 'Des septiemes arpegees qui gonflent a chaque mesure (le LFO 2 sur le VCA), scies empilees et larges, CHORUS II, longue reverbe.',
    bpm: 104,
    knobs: { rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.7, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-8), fine2: cents(8), osc1: 0.8, osc2: 0.8, stack: 0.4, wide: 0.4, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.45, res: 0.3, envAmt: 0.3, fA: 0.5, fD: 0.7, fS: 0.4, fR: 0.6, aA: 0.55, aD: 0.65, aS: 0.6, aR: 0.75, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.25, chorus: CHORUS.II, delay: 0.25, dlyTime: DLY['3/16'], reverb: 0.55, monoLow: 0.35, accent: 0.3 },
    seq: AUTO,
    prog: [5, 1, 0, 2],
    extra: { xLfo2Rate: L2RATE('1 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('AMP'), xLfo2Depth: 0.45, xRevSize: revS(6.5), xRevTone: 0.45, xRevPre: preMs(30), xWidth: 0.6 },
  },
];

/*
 * VOLUME de chaque preset, cale par le rendu hors ligne (tests/presets-render.sh) : la sonie ponderee K de chaque preset
 * vers -23 LUFS (celle des presets d'usine du site, mediane -23.7), les nappes 2 dB plus douces ; la sonie RMS reste a
 * +/-4 dB de la mediane (le controle du rendu).
 */
const VOLUME = {
  'MUNICH SEQUENCER': 0.75,
  'OCTAVE GALLOP': 0.759,
  'GLITTER STRINGS': 0.528,
  'NEON GLIDE': 0.481,
  'RIMSHOT PLUCK': 0.871,
  'BOOGIE SLIDE': 0.543,
  'HI-NRG PUMP': 0.827,
  'SPACE DISCO BELLS': 0.684,
  'CLAVI FUNK': 0.876,
  'LASER DISCO': 0.763,
  'THREE AGAINST FOUR': 0.767,
  'FIVE STEP RITUAL': 0.881,
  'SEVEN MOON CYCLE': 0.876,
  'DUB ECHO CHAMBER': 0.955,
  'RANDOM DROPLETS': 0.933,
  'PENDULUM': 0.692,
  'SLOW ACID SPIRAL': 0.754,
  'WOODEN LOOP': 0.912,
  'GREY DAWN PULSE': 0.676,
  'GLASS METRONOME': 0.897,
  'CURSED GALLOP': 0.754,
  'IRON BODY': 0.837,
  'NIGHT CRAWLER': 0.75,
  'SYNC SCREAMER': 0.737,
  'SUB GROWL': 0.754,
  'VELVET DREAD': 0.634,
  'AURORA ARP': 0.427,
  'FROZEN LAKE': 0.507,
  'VELVET HAZE': 0.447,
  'CATHEDRAL SHIMMER': 0.479,
  'TAPE MEMORY': 0.501,
  'SUNSET SWELL': 0.481,
};

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
  if (!p) throw new Error(`reglage SOUND+ inconnu : ${id}`);
  if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error(`${id} hors de 0..1 : ${v}`);
  if (p.steps) {
    const n = p.steps.length - 1;
    return Math.max(0, Math.min(n, Math.round(v * n))) / n;
  }
  return r3(v);
}

function full(p) {
  const raw = { ...SITE_DEF, ...BASE, ...p.knobs, ...(VOLUME[p.name] !== undefined ? { volume: VOLUME[p.name] } : {}) };
  const knobs = {};
  for (const k of VOY_KNOBS) knobs[k.id] = clean(k.id, raw[k.id]);
  for (const id of Object.keys(p.knobs)) if (!KNOB[id]) throw new Error(`${p.name} : potard inconnu ${id}`);
  const ex = { ...EXTRA_DEF, xQuality: 1, ...p.extra };
  const extra = {};
  for (const e of EXTRA) extra[e.id] = cleanExtra(e.id, ex[e.id]);
  for (const id of Object.keys(p.extra)) if (!EXTRA.some((e) => e.id === id)) throw new Error(`${p.name} : reglage inconnu ${id}`);
  return { name: p.name, cat: p.cat, desc: p.desc, bpm: p.bpm, knobs, seq: p.seq, prog: [...p.prog], extra };
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
const disk = (p) => ({ format: 'mm-arp-preset', v: 1, name: p.name, cat: p.cat, desc: p.desc, bpm: p.bpm, knobs: p.knobs, seq: p.seq, prog: p.prog, extra: p.extra });

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
