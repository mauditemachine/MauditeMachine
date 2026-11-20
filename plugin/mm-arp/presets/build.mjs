#!/usr/bin/env node
/**
 * MM-ARP, la banque d'usine du VST3 (2026-11-10, Mika : "les presets pourraient etre meilleurs, c'est un peu toujours
 * pareil ! Je veux plus de presets a la Donna Summer, genre disco, ou alors des trucs hypnotiques"). Le VST3 seul : les
 * presets du site (src/v4/state/factory.ts) ne changent pas. Refaite le 2026-11-11 (40 presets, le sequenceur par pas),
 * revue le 2026-11-18 (v28 : quatre familles BASS 16, ARP 12, PAD 6, DARK 6, des noms qui disent ce que c'est).
 *
 * Refaite le 2026-11-20 (v43, Mika : "Tous les presets doivent sonner absolument parfait ! sans filtre pas trop aigu et
 * que ca sonne putain ! que ca sonne vraiment bon synth analog ! evite les fx sur tous les presets ! ou des filtres, si
 * tu en utilises alors pas trop intense !" ; avant : des sons "fats et cristallins", des basslines, rien de trop aigu) :
 * un synthe analogique a sec. Le son de chaque preset, c'est la voix : deux oscillateurs desaccordes, le SUB, LOAD (le
 * melangeur qui pousse le filtre), un passe-bas a mi-course, des enveloppes qui claquent, la derive analogique. Les
 * memes familles et la meme repartition (BASS 16, ARP 12, PAD 6, DARK 6), 34 noms gardes, 6 renommes (leur son tenait
 * a un effet) : PLUCK ARP (RIMSHOT ARP), BRASS ARP (TOM ARP), DISCO KEYS ARP (DISCO BELL ARP), HOLLOW ARP (NOISE ARP),
 * DRIFT DRONE (TAPE DRONE), CRYPT ARP (BIT CRYPT).
 *
 * LES REGLES (v43, verifiees ici a l'ecriture et par tests/presets-check.mjs ; les memes pour RANDOM de la face, toutes
 * dans src/v4/plugin/arp/analog.ts) :
 *   - AUCUN effet : OVERDRIVE / DISTO, CHORUS, DELAY, REVERB, TAPE, GLUE, SIDECHAIN a l'arret ; WARMTH, PHASER,
 *     FLANGER, PUMP, CRUSH, SHIMMER, HELL, RING, FOLD, HIGH PASS, COMB a 0 ; la DISTO, la page DELAY, la reverbe (BigSky
 *     a CLASSIC), l'EQ 6 bandes, l'ancien EQ, le MASTER (BASS, AIR, WIDTH), la matrice, les modes de voix et AMP a
 *     leur neutre ;
 *   - le filtre : un passe-bas (MOOG, LP12, MS-10), CUTOFF 0.25 a 0.6, RES 0.45 au plus, ENV AMT 0.5 au plus, jamais
 *     ouvert au-dela de 6 kHz par l'enveloppe, ACC FILTER 0.6 au plus, les LFO sur la coupure ou la resonance a 0.25 ;
 *   - pas trop aigu : OCTAVE 0 au plus, RANGE 4' au plus, FM 0.2, NOISE 0.12, vibrato 0.08 au plus.
 * (Avant la v43 : HELL MIX 0.10 au plus, reverbe CLASSIC, DISTO neutre ; elles restent vraies, en plus strict.)
 * Les cibles mesurees hors ligne (tests/presets_render.cpp --bars 4, CLASSIC HQ et PRO STD, aucun son joue) : crete
 * sous -3 dBFS ; sonie -23 LUFS (PAD -24) a 1 LU pres, RMS a 3 dB de la mediane ; DC sous -60 dBFS ; part au-dessus de
 * 6 kHz sous 0.5 % ; centroide 150 a 500 Hz (BASS), 150 a 700 Hz (DARK), 350 a 1000 Hz (ARP, PAD) ; bas-medium
 * (120-500 Hz) au moins 30 % de l'energie. Mesure v43 (CLASSIC HQ) : les 40 dans les cibles (15 hors cibles avant) ;
 * centroide median 398 Hz (782 au plus, 2064 avant), au-dessus de 6 kHz 0.34 % au plus (4.95 avant), crete -4.0 dBFS au
 * plus, RMS a 1.4 dB de la mediane, DC -92 dBFS au plus, bas-medium 35 % au moins (0 avant).
 *
 * Source unique de la banque : ce fichier ecrit
 *   - plugin/mm-arp/presets/factory.json        { v: 1, presets: [ { name, cat, desc, bpm, knobs, seq, prog, extra, steps } ] }
 *   - plugin/mm-arp/presets/factory/NN NOM.mmarp  le meme preset au format disque du plugin (src/v4/plugin/arp/disk.ts)
 *
 *   node plugin/mm-arp/presets/build.mjs           (ecrit)
 *   node plugin/mm-arp/presets/build.mjs --check   (verifie que les fichiers sont a jour, n'ecrit rien)
 *
 * Les 62 potards partent des valeurs de depart de src/v4/voyager/params.ts (lu tel quel : Node retire les types), puis
 * BASE (le neutre de la banque : OSC 2 coupe, tous les effets a l'arret), puis ceux du preset ; tout est arrondi comme
 * voyParams.set (clean : un cran sur i / (n - 1), un continu au millieme). Les reglages du VST3 seul partent de
 * plugin/mm-arp/extra-params.json, les pistes par pas des valeurs de depart de src/v4/plugin/arp/steps.ts. Le rendu de
 * verification : plugin/mm-arp/tests/presets-render.sh.
 *
 * VOLUME : cale par le rendu hors ligne (tests/presets_render.cpp --calibrate presets/volumes.json : la sonie ponderee
 * K de chaque preset sur 8 mesures, vers -23 LUFS, les PAD vers -24). Recaler apres un changement de son :
 *   plugin/mm-arp/presets/calibrate.sh
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOY_KNOBS } from '../../../src/v4/voyager/params.ts';
import { analogFaults, ANALOG_FX_OFF, ANALOG_FX_OFF_EXTRA } from '../../../src/v4/plugin/arp/analog.ts';

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
/** PHASER RATE en Hz (0.05 x 160^v). */
const phHz = (hz) => r3(Math.log(hz / 0.05) / Math.log(160));
/** FLANGER RATE en Hz (0.03 x (5 / 0.03)^v). */
const flHz = (hz) => r3(Math.log(hz / 0.03) / Math.log(5 / 0.03));
/** Une reinjection signee -1..1 (FLANGER FB : 2 v - 1). */
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
/**
 * Le neutre de la banque (v43) : un oscillateur, tous les effets a l'arret (analog.ts ANALOG_FX_OFF : OVERDRIVE,
 * CHORUS, DELAY, REVERB, TAPE, GLUE, SIDECHAIN), rien qui colore hors de la voix (FM, NOISE, SYNC, STACK, WIDE,
 * LOAD, SPACE a 0) ; chaque preset pose son OSC 2, son SUB, son filtre, ses enveloppes.
 */
const BASE = {
  ...ANALOG_FX_OFF,
  osc2: 0,
  wave2: WAVE2.SAW,
  range2: FEET[8],
  fine1: 0.5,
  fine2: 0.5,
  glide: 0,
  fm: 0,
  noise: 0,
  sync: 0,
  stack: 0,
  wide: 0,
  load: 0,
  space: 0,
  fpol: 0,
  lfoAmt: 0,
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
 * septieme, 7 octave, 9 la tierce au-dessus). La racine est posee vers fa diese 3 (185 Hz) : OCTAVE -1 la descend vers
 * fa diese 2 (92 Hz), le registre des basses disco. Accords : 0 F#m, 1 D, 2 E, 3 C#m, 4 Bm, 5 A, 6 F#m7, 7 Dmaj7 ; une
 * mesure par accord.
 *
 * v43 : chaque preset a UN caractere tenu par la voix seule (forme d'onde, desaccord, SUB, filtre, enveloppes) et un
 * geste rythmique (RATE, longueur de la suite, pistes par pas) ; plus aucun espace (effets). Les LFO restent doux : la
 * largeur d'impulsion qui respire, la coupure qui bouge de moins d'une octave, un vibrato de quelques cents.
 */
const BANK = [
  /* ======================= BASS (16) : octave basse, passe-bas a mi-course, enveloppes qui claquent ======================= */
  {
    name: 'MUNICH BASS',
    cat: 'BASS',
    desc: 'The 1977 sequenced bass: root, octave, fifth and seventh in sixteenths, a saw and a square through the ladder filter, a tight pluck, the twin filters opening the stereo a little.',
    bpm: 120,
    knobs: { rate: RATE['1/16'], gate: 0.55, wave1: WAVE1.SAW, osc1: 0.9, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.5, fine1: cents(-4), fine2: cents(4), octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.5, res: 0.28, envAmt: 0.4, keyTrack: 0.6, fA: 0, fD: 0.3, fS: 0.1, fR: 0.22, aA: 0, aD: 0.38, aS: 0.5, aR: 0.18, accent: 0.55, accFlt: 0.45, phase: 0.3, drift: 0.3, width: 0.4, monoLow: 0.45, load: 0.15, space: 0.45 },
    seq: edit([0, 7, 4, 6, 0, 7, 4, 7]),
    prog: [0, 0, 1, 2],
    steps: steps({ acc: [2, 1, 0, 1, 2, 1, 0, 2], gate: [1, 0, 1, 0, 1, 0, 1, 2] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.15 },
  },
  {
    name: 'GALLOP BASS',
    cat: 'BASS',
    desc: 'The galloping octave disco bass: a breathing pulse wave over a round sine sub, long first note and short answers, a ratchet closing every other beat.',
    bpm: 124,
    knobs: { rate: RATE['1/16'], gate: 0.55, wave1: 0.7, osc1: 0.88, sub: 0.5, subOct: SUBOCT['-1'], subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.LP12, cutoff: 0.6, res: 0.2, envAmt: 0.3, keyTrack: 0.5, fD: 0.3, fS: 0.15, fR: 0.2, aD: 0.5, aS: 0.55, aR: 0.15, accent: 0.6, accFlt: 0.45, phase: 0.25, drift: 0.35, width: 0.2, monoLow: 0.45, load: 0.1 },
    seq: edit([0, R, 7, 7, 0, R, 7, 0]),
    prog: [0, 4, 1, 2],
    steps: steps({ acc: [2, 1, 1, 0, 2, 1, 1, 1], gate: [2, 1, 0, 0, 2, 1, 0, 1], rat: [1, 1, 1, 1, 1, 1, 1, 2] }),
    extra: { xLfo2Rate: L2RATE('1 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('WAVE'), xLfo2Depth: 0.3 },
  },
  {
    name: 'BOOGIE BASS',
    cat: 'BASS',
    desc: 'A swung boogie bass at 112: a square and a saw an octave below over a triangle sub, slides up to the octave, soft ghost notes between the accents.',
    bpm: 112,
    knobs: { rate: RATE['1/16'], gate: 0.75, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[16], osc2: 0.35, fine1: cents(-3), fine2: cents(3), sub: 0.25, subWave: SUBW.TRI, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.5, res: 0.25, envAmt: 0.38, keyTrack: 0.5, fD: 0.45, fS: 0.25, fR: 0.28, aD: 0.55, aS: 0.75, aR: 0.3, accent: 0.6, accFlt: 0.45, load: 0.25, phase: 0.3, drift: 0.35, width: 0.2, monoLow: 0.45 },
    seq: edit([0, R, 7, 0, R, 7, R, 4, 0, R, 7, 7, 4, R, 2, 4]),
    prog: [4, 2, 0, 0],
    steps: steps({ slide: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], acc: [2, 1, 1, 0, 1, 2, 1, 0, 2, 1, 1, 0, 2, 1, 0, 1], gate: [2, 1, 1, 0, 1, 2, 1, 0, 2, 1, 0, 2, 1, 1, 0, 1] }),
    extra: { xSwing: 0.6, xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('ENV AMT'), xLfo2Depth: 0.15 },
  },
  {
    name: 'HI-NRG BASS',
    cat: 'BASS',
    desc: 'Hi-NRG at 130: octaves in sixteenths on two saws pulled apart by a few cents, stacked and spread wide, a sine sub keeping the low end centred.',
    bpm: 130,
    knobs: { rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-9), fine2: cents(9), osc1: 0.8, osc2: 0.8, sub: 0.35, subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.52, res: 0.22, envAmt: 0.32, keyTrack: 0.5, fD: 0.36, fS: 0.35, fR: 0.2, aD: 0.5, aS: 0.65, aR: 0.18, accent: 0.5, accFlt: 0.4, phase: 0.2, drift: 0.3, width: 0.55, monoLow: 0.4, load: 0.1, stack: 0.35},
    seq: edit([0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 4, 7, 6, 7]),
    prog: [0, 1, 2, 2],
    steps: steps({ acc: [2, 0, 1, 0] }),
    extra: {},
  },
  {
    name: 'FUNK BASS',
    cat: 'BASS',
    desc: 'A rubbery funk bass in swung, syncopated sixteenths: a fat pulse with a triangle sub, the filter following the keys and snapping on the accents.',
    bpm: 108,
    knobs: { rate: RATE['1/16'], gate: 0.42, wave1: 0.7, osc1: 0.95, sub: 0.45, subWave: SUBW.TRI, octave: OCT(-1), fmode: FMODE.LP12, cutoff: 0.6, res: 0.2, envAmt: 0.26, keyTrack: 0.9, fD: 0.2, fS: 0, fR: 0.15, aD: 0.4, aS: 0.4, aR: 0.1, accent: 0.6, accFlt: 0.55, phase: 0.1, drift: 0.35, width: 0.2, monoLow: 0.4 },
    seq: edit([0, R, 7, 0, R, 4, R, 7, R, 0, R, 4, 7, R, 6, R]),
    prog: [0, 4],
    steps: steps({ acc: [2, 1, 0, 2, 1, 1, 1, 0, 1, 2, 1, 0, 2, 1, 1, 1], gate: [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 2, 1, 0, 1] }),
    extra: { xSwing: 0.5 },
  },
  {
    name: 'ORBIT ROLL',
    cat: 'BASS',
    desc: 'A round bass rolling over eleven steps and sliding between its notes: a soft triangle over a sine sub, the twin filters turning it slightly in the stereo.',
    bpm: 123,
    knobs: { rate: RATE['1/16'], gate: 0.6, wave1: 0.35, osc1: 0.95, osc2: 0, sub: 0.25, subOct: SUBOCT['-1'], subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.LP12, cutoff: 0.54, res: 0.15, envAmt: 0.3, keyTrack: 0.6, fA: 0, fD: 0.4, fS: 0.25, fR: 0.25, aA: 0.05, aD: 0.5, aS: 0.65, aR: 0.2, accent: 0.5, accFlt: 0.35, phase: 0.3, drift: 0.2, width: 0.35, monoLow: 0.5, load: 0.15, space: 0.5 },
    seq: edit([0, 0, R, 4, 0, R, 7, 0, 2, R, 0]),
    prog: [0],
    steps: steps({ slide: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0], gate: [1, 0, 1, 2, 1, 1, 3, 1, 1, 1, 0], acc: [2, 1, 1, 1, 0, 1, 2, 1, 1, 1, 0], prob: [100, 75, 100, 100, 100, 100, 100, 75, 100, 100, 50] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('WAVE'), xLfo2Depth: 0.2 },
  },
  {
    name: 'ACID BASS',
    cat: 'BASS',
    desc: 'A soft acid line: one saw in the ladder filter, the resonance kept warm, slides tied into the next note and accents that open the filter a little.',
    bpm: 126,
    knobs: { rate: RATE['1/16'], gate: 0.45, wave1: WAVE1.SAW, osc1: 0.9, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.52, res: 0.45, envAmt: 0.4, keyTrack: 0.5, fA: 0, fD: 0.38, fS: 0.15, fR: 0.25, aA: 0, aD: 0.5, aS: 0.55, aR: 0.16, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.15, accent: 0.8, accFlt: 0.6, phase: 0.3, drift: 0.25, width: 0.2, monoLow: 0.4, load: 0.2 },
    seq: edit([0, 0, 7, 0, R, 0, 6, 7, 0, 2, 0, 7, R, 4, 0, 7]),
    prog: [0],
    steps: steps({ slide: [0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1], acc: [1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2], gate: [1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('ENV AMT'), xLfo2Depth: 0.25 },
  },
  {
    name: 'ACID ROLL',
    cat: 'BASS',
    desc: 'A hollow square acid bass at 110 in the Korg filter: five steps that slide and fold on themselves, warm resonance, a double hit at the end.',
    bpm: 110,
    knobs: { rate: RATE['1/16'], gate: 0.55, wave1: WAVE1.SQUARE, osc1: 0.9, sub: 0, octave: OCT(-1), fmode: FMODE.MS10, cutoff: 0.5, res: 0.38, envAmt: 0.42, keyTrack: 0.5, fD: 0.42, fS: 0, fR: 0.3, aD: 0.55, aS: 0.5, aR: 0.22, accent: 0.75, accFlt: 0.55, phase: 0.3, drift: 0.25, width: 0.2, monoLow: 0.4, load: 0.15 },
    seq: edit([0, 0, 7, R, 4]),
    prog: [0],
    steps: steps({ slide: [0, 0, 1, 0, 1], acc: [1, 2, 1, 1, 2], rat: [1, 1, 1, 1, 2], gate: [1, 0, 2, 1, 1] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('ENV AMT'), xLfo2Depth: 0.25 },
  },
  {
    name: 'CURSED BASS',
    cat: 'BASS',
    desc: 'A dark disco bass in eighths through the Korg filter: two saws an octave apart and a sine sub, the mixer pushed into the filter for growl, slow swelling notes.',
    bpm: 118,
    knobs: { rate: RATE["1/8"], gate: 0.85, wave1: WAVE1.SAW, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[16], fine1: cents(-12), fine2: cents(12), osc2: 0.6, sub: 0.35, subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.MS10, cutoff: 0.32, res: 0.3, envAmt: 0.32, fA: 0.4, fD: 0.5, fS: 0.3, fR: 0.25, aD: 0.5, aS: 0.72, aR: 0.2, load: 0.6, lfoRate: L1RATE["2 BAR"], lfoShape: L1SHAPE.SAW, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.25, accent: 0.6, accFlt: 0.45, phase: 0.3, drift: 0.35, width: 0.2, monoLow: 0.45, aA: 0.45},
    seq: edit([0, 0, R, 0, 7, 0, R, 4]),
    prog: [0, 3, 1, 2],
    steps: steps({ acc: [2, 1, 0, 1, 2, 1, 0, 2], gate: [1, 1, 0, 0, 1, 1, 0, 2] }),
    extra: {},
  },
  {
    name: 'IRON ROLL',
    cat: 'BASS',
    desc: 'Hammered and martial: a hard sync bass, the second saw locked a fifth above the first, a dry snapping envelope, the last hit doubled.',
    bpm: 124,
    knobs: { rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-4), fine2: cents(4), osc1: 0.55, osc2: 0.85, stack: 0, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.5, res: 0.2, envAmt: 0.35, keyTrack: 0.5, fD: 0.28, fS: 0.15, fR: 0.15, aD: 0.44, aS: 0.35, aR: 0.1, accent: 0.55, accFlt: 0.45, phase: 0.2, drift: 0.2, width: 0.1, monoLow: 0.45, load: 0.2, semi2: SEMI(7), sync: ON },
    seq: edit([0, 0, R, 0, 0, 7, R, 0]),
    prog: [0, 0, 4, 1],
    steps: steps({ acc: [2, 1, 1, 2, 1, 2, 1, 0], rat: [1, 1, 1, 1, 1, 1, 1, 2] }),
    extra: {},
  },
  {
    name: 'SUB BASS',
    cat: 'BASS',
    desc: 'The indie dance bass rolling between the kicks: a big sine sub, a pulse on top, the mixer pushed into the ladder filter for warmth.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.6, wave1: 0.68, osc1: 0.7, sub: 0.55, subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.38, res: 0.32, envAmt: 0.35, keyTrack: 0.5, fD: 0.4, fS: 0.15, fR: 0.25, aD: 0.45, aS: 0.55, aR: 0.2, load: 0.4, accent: 0.5, accFlt: 0.4, phase: 0.3, drift: 0.2, width: 0.15, monoLow: 0.55 },
    seq: edit([R, 0, 0, R, R, 0, 0, R, R, 0, 0, R, R, 0, 7, 0]),
    prog: [0, 5],
    steps: steps({ acc: [1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 1, 0], slide: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1] }),
    extra: { xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('RND'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.2 },
  },
  {
    name: 'DUB BASS',
    cat: 'BASS',
    desc: 'A round dub bass in eighths: a soft triangle with a deep sine sub, the filter just open, long notes that breathe between the hits.',
    bpm: 118,
    knobs: { rate: RATE['1/8'], gate: 0.7, wave1: 0.35, osc1: 0.9, sub: 0.4, subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.LP12, cutoff: 0.42, res: 0.12, envAmt: 0.2, keyTrack: 0.5, fD: 0.5, fS: 0.4, fR: 0.35, aA: 0.3, aD: 0.6, aS: 0.7, aR: 0.3, accent: 0.45, accFlt: 0.3, phase: 0.3, drift: 0.3, width: 0.15, monoLow: 0.55, fA: 0.2 },
    seq: edit([0, R, 0, 4, R, 7, 4, R]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [2, 1, 1, 0, 1, 2, 1, 1], gate: [2, 1, 1, 2, 1, 1, 2, 1] }),
    extra: {},
  },
  {
    name: 'PENDULUM BASS',
    cat: 'BASS',
    desc: 'Three eighths against eight, tied and sliding: a saw and a square, slow attacks, the twin filters of the Voyager wide apart.',
    bpm: 118,
    knobs: { rate: RATE['1/8'], gate: 0.6, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[8], fine1: cents(-5), fine2: cents(5), osc1: 0.84, osc2: 0.5, octave: OCT(-1), fmode: FMODE.MOOG, space: 0.8, cutoff: 0.56, res: 0.3, envAmt: 0.3, fD: 0.5, fS: 0.25, fR: 0.4, aA: 0.4, aD: 0.6, aS: 0.6, aR: 0.35, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.WCUT, lfoAmt: 0.18, phase: 0.2, drift: 0.35, width: 0.6, monoLow: 0.4, load: 0.15 },
    seq: edit([0, 7, 4]),
    prog: [0, 0, 1, 1],
    steps: steps({ gate: [3, 1, 2], slide: [0, 1, 0] }),
    extra: {},
  },
  {
    name: 'CRAWLER BASS',
    cat: 'BASS',
    desc: 'A dark descending bass with a reversed filter contour, the notes opening as they end, a square a fifth below for weight.',
    bpm: 120,
    knobs: { rate: RATE['1/16'], gate: 0.55, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[16], semi2: SEMI(7), osc1: 0.82, osc2: 0.45, octave: OCT(-1), fmode: FMODE.MOOG, fpol: NEG, cutoff: 0.52, res: 0.28, envAmt: 0.3, keyTrack: 0.5, fD: 0.5, fS: 0, fR: 0.35, aD: 0.55, aS: 0.45, aR: 0.25, accent: 0.5, accFlt: 0.3, load: 0.2, phase: 0.2, drift: 0.35, width: 0.5, monoLow: 0.4, space: 0.4 },
    seq: edit([7, 4, 2, R, 0, 2]),
    prog: [4, 0, 1, 3],
    steps: steps({ slide: [0, 1, 0, 0, 1, 0], gate: [1, 2, 1, 1, 2, 0] }),
    extra: { xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.15 },
  },
  {
    name: 'RITUAL BASS',
    cat: 'BASS',
    desc: 'Five steps in the Korg filter: one note ratchets, two play only sometimes, a square an octave below, the resonance breathing over eight bars.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.38, wave1: WAVE1.SAW, osc1: 0.9, wave2: WAVE2.SQUARE, range2: FEET[16], osc2: 0.3, octave: OCT(-1), fmode: FMODE.MS10, cutoff: 0.36, res: 0.4, envAmt: 0.4, keyTrack: 0.5, fD: 0.38, fS: 0, fR: 0.28, aD: 0.5, aS: 0.3, aR: 0.3, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.15, accent: 0.6, accFlt: 0.5, phase: 0.3, drift: 0.3, width: 0.2, monoLow: 0.4, load: 0.1 },
    seq: edit([0, R, 4, 2, 7]),
    prog: [0, 0, 0, 3],
    steps: steps({ rat: [1, 1, 2, 1, 1], prob: [100, 100, 100, 75, 50], acc: [2, 1, 1, 0, 1] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('RES'), xLfo2Depth: 0.2 },
  },
  {
    name: 'TRIPLET BASS',
    cat: 'BASS',
    desc: 'Three short notes against the bar: a square and its fifth in a 12 dB filter, the third note doubled and sometimes left out, the cutoff slowly breathing.',
    bpm: 124,
    knobs: { rate: RATE['1/16'], gate: 0.38, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.SQUARE, range2: FEET[8], semi2: SEMI(7), osc2: 0.3, sub: 0, octave: OCT(-1), fmode: FMODE.LP12, cutoff: 0.34, res: 0.32, envAmt: 0.4, keyTrack: 0.5, fD: 0.3, fS: 0, fR: 0.28, aD: 0.34, aS: 0.05, aR: 0.28, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.12, accent: 0.55, accFlt: 0.45, phase: 0.3, drift: 0.25, width: 0.2, monoLow: 0.45 },
    seq: edit([0, 7, 4]),
    prog: [0],
    steps: steps({ acc: [2, 1, 0], rat: [1, 1, 2], prob: [100, 100, 75] }),
    extra: { xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.12 },
  },
  /* ======================= ARP (12) : arpeges, leads et claviers, dans le medium ======================= */
  {
    name: 'NEON ARP',
    cat: 'ARP',
    desc: 'An italo lead in eighths that slides into its high notes and ties them, a square against a saw, a slow filter swell and a gentle vibrato.',
    bpm: 120,
    knobs: { rate: RATE['1/8'], gate: 0.7, wave1: 0.62, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-6), fine2: cents(6), osc1: 0.84, osc2: 0.55, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.56, res: 0.22, envAmt: 0.25, keyTrack: 0.6, fA: 0.1, fD: 0.55, fS: 0.5, fR: 0.35, aA: 0.08, aD: 0.6, aS: 0.85, aR: 0.3, lfoRate: L1RATE['1/8'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.PITCH, lfoAmt: 0.06, accent: 0.4, accFlt: 0.3, drift: 0.4, width: 0.35 },
    seq: edit([4, 7, R, 7, 7, 7, 6, 4, 2, 4, R, 4, 6, 4, 2, 0]),
    prog: [0, 5, 2, 1],
    steps: steps({ slide: [0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1], gate: [1, 3, 1, 1, 3, 2, 1, 1, 1, 3, 1, 1, 3, 2, 1, 2], acc: [2, 1, 1, 1, 2, 1, 1, 0] }),
    extra: {},
  },
  {
    name: 'PLUCK ARP',
    cat: 'ARP',
    desc: 'A classic poly pluck: two saws a few cents apart through a 12 dB low pass that snaps shut, swung offbeats and a double hit now and then.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-8), fine2: cents(8), osc1: 0.85, osc2: 0.7, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.52, res: 0.2, envAmt: 0.4, keyTrack: 0.6, fA: 0, fD: 0.32, fS: 0.05, fR: 0.2, aA: 0, aD: 0.5, aS: 0.25, aR: 0.25, accent: 0.6, accFlt: 0.45, drift: 0.4, width: 0.4 },
    seq: edit([R, 7, R, 7, R, 4, 7, R, R, 7, R, 4, 0, R, 7, R]),
    prog: [0, 1],
    steps: steps({ rat: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1], prob: [100, 100, 100, 75, 100, 100, 100, 100, 100, 100, 100, 75, 100, 100, 50, 100], acc: [1, 2, 1, 1, 1, 2, 0, 1] }),
    extra: { xSwing: 0.45 },
  },
  {
    name: 'RATCHET ARP',
    cat: 'ARP',
    desc: 'A disco arpeggio with triple and quadruple ratchets inside it: a saw over a square an octave below, the ladder filter plucked on every note.',
    bpm: 126,
    knobs: { rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SAW, osc1: 0.85, wave2: WAVE2.SQUARE, range2: FEET[16], osc2: 0.4, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.56, res: 0.3, envAmt: 0.36, keyTrack: 0.6, fD: 0.3, fS: 0.1, fR: 0.2, aD: 0.38, aS: 0.2, aR: 0.18, accent: 0.55, accFlt: 0.45, phase: 0.1, drift: 0.3, width: 0.35 },
    seq: edit([0, 2, 4, 7, 6, 7, 4, 2]),
    prog: [0, 5, 1, 2],
    steps: steps({ rat: [1, 1, 1, 3, 1, 1, 4, 1, 1, 2, 1, 1, 1, 1, 4, 1], acc: [2, 1, 1, 2, 1, 1, 2, 1], gate: [1, 1, 1, 0, 1, 1, 0, 1] }),
    extra: {},
  },
  {
    name: 'OFFBEAT ARP',
    cat: 'ARP',
    desc: 'Offbeat organ stabs: two squares a fifth apart, short and round in a 12 dB filter, a double hit closing the bar.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.4, wave1: 0.5, osc1: 0.95, wave2: WAVE2.SQUARE, range2: FEET[8], semi2: SEMI(7), osc2: 0.75, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.58, res: 0.2, envAmt: 0.32, keyTrack: 0.4, fA: 0, fD: 0.32, fS: 0, fR: 0.2, aA: 0, aD: 0.42, aS: 0.3, aR: 0.22, accent: 0.6, accFlt: 0.4, drift: 0.3, width: 0.3 },
    seq: edit([R, R, 0, R, R, R, 0, R, R, R, 0, R, R, R, 0, 0]),
    prog: [0],
    steps: steps({ acc: [1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 0], rat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], prob: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 50] }),
    extra: {},
  },
  {
    name: 'BRASS ARP',
    cat: 'ARP',
    desc: 'Analog brass in eighths: two detuned saws, stacked thick, the filter swelling open on each note like a horn section.',
    bpm: 118,
    knobs: { rate: RATE['1/8'], gate: 0.62, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-7), fine2: cents(7), osc1: 0.84, osc2: 0.75, stack: 0.3, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.5, res: 0.15, envAmt: 0.4, keyTrack: 0.6, fA: 0.3, fD: 0.55, fS: 0.5, fR: 0.35, aA: 0.05, aD: 0.6, aS: 0.8, aR: 0.25, accent: 0.45, accFlt: 0.4, drift: 0.45, width: 0.35 },
    seq: edit([0, R, 0, 4, R, 7, 6, 4]),
    prog: [0, 5, 4, 2],
    steps: steps({ acc: [2, 1, 1, 1, 1, 2, 1, 0], gate: [1, 1, 0, 2, 1, 1, 1, 2] }),
    extra: {},
  },
  {
    name: 'DISCO KEYS ARP',
    cat: 'ARP',
    desc: 'Disco keys in sixteenths over two octaves of sevenths: a soft triangle edging to a saw and a hollow square, a round 12 dB filter, spread wide, a few notes left to chance.',
    bpm: 116,
    knobs: { rate: RATE['1/16'], mode: MODE.UP, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.55, wave1: 0.35, osc1: 0.9, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.35, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.52, res: 0.15, envAmt: 0.3, keyTrack: 0.6, fD: 0.4, fS: 0.15, fR: 0.3, aD: 0.45, aS: 0.45, aR: 0.3, accent: 0.45, accFlt: 0.35, drift: 0.3, width: 0.75},
    seq: AUTO,
    prog: [6, 4, 7, 2],
    steps: steps({ prob: [100, 100, 75, 100, 100, 100, 100, 75, 100, 100, 100], acc: [2, 1, 1, 0, 1] }),
    extra: {},
  },
  {
    name: 'MOON ARP',
    cat: 'ARP',
    desc: 'Seven steps turning against sixteen: a pulse wave whose width breathes over four bars, a sine sub, the 12 dB filter drifting slowly.',
    bpm: 120,
    knobs: { rate: RATE['1/16'], gate: 0.42, wave1: 0.7, osc1: 0.9, sub: 0.2, subWave: SUBW.SINE, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.54, res: 0.3, envAmt: 0.25, keyTrack: 0.5, fD: 0.45, fS: 0.1, fR: 0.3, aD: 0.55, aS: 0.3, aR: 0.35, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.WAVE, lfoAmt: 0.35, drift: 0.35, width: 0.35 },
    seq: edit([0, 7, 4, R, 6, 4, R]),
    prog: [0],
    steps: steps({ gate: [1, 0, 1, 1, 2, 0, 1], acc: [2, 1, 1, 1, 2, 0, 1] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.2 },
  },
  {
    name: 'HOLLOW ARP',
    cat: 'ARP',
    desc: 'Nine steps against the bar: two squares an octave apart, hollow and woody, a breath of noise and the ladder filter slowly moving.',
    bpm: 121,
    knobs: { rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.SQUARE, range2: FEET[16], osc2: 0.4, fine1: cents(-4), fine2: cents(4), noise: 0.04, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.52, res: 0.35, envAmt: 0.3, keyTrack: 0.6, fD: 0.32, fS: 0.1, fR: 0.3, aD: 0.65, aS: 0.3, aR: 0.35, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.12, accent: 0.55, accFlt: 0.45, drift: 0.35, width: 0.4 },
    seq: edit([0, R, 4, 7, R, 2, R, 7, 4]),
    prog: [0, 0, 5, 5],
    steps: steps({ prob: [100, 100, 100, 75, 100, 100, 100, 50, 100], acc: [2, 1, 1, 0, 1, 2, 1, 0, 1] }),
    extra: { xNoiseColor: 0.4 },
  },
  {
    name: 'DROPLET ARP',
    cat: 'ARP',
    desc: 'Random droplets over two octaves of ninths: a triangle plucked through a 12 dB filter, each note with its own brightness and its own odds of falling.',
    bpm: 125,
    knobs: { rate: RATE['1/16'], mode: MODE.RAND, range: RANGE[2], notes: NOTES(0), chord: CHORD['9TH'], gate: 0.3, wave1: 0.22, osc1: 1, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.5, res: 0.28, envAmt: 0.28, keyTrack: 0.7, fD: 0.3, fS: 0, fR: 0.25, aD: 0.42, aS: 0.15, aR: 0.3, lfoRate: L1RATE['1/16'], lfoShape: L1SHAPE.SH, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.15, drift: 0.25, width: 0.5 },
    seq: AUTO,
    prog: [0],
    steps: steps({ prob: [100, 75, 100, 50, 100, 75, 100, 25, 75, 100, 50] }),
    extra: {},
  },
  {
    name: 'GHOST ARP',
    cat: 'ARP',
    desc: 'Ghost notes for a minimal groove: a short square and saw blip on the octave, ratchets and odds on every step so the bar never comes back the same.',
    bpm: 127,
    knobs: { rate: RATE['1/16'], gate: 0.3, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-5), fine2: cents(5), osc2: 0.4, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.46, res: 0.25, envAmt: 0.38, keyTrack: 0.5, fA: 0, fD: 0.25, fS: 0, fR: 0.15, aA: 0, aD: 0.38, aS: 0.15, aR: 0.15, accent: 0.55, accFlt: 0.5, phase: 0.05, drift: 0.3, width: 0.45 },
    seq: edit([7, R, 7, 7, R, 7, R, 7, 7, R, 7, R, 7, 7, R, 7]),
    prog: [0],
    steps: steps({ rat: [1, 1, 2, 1, 1, 3, 1, 1, 2, 1, 4, 1, 1, 2, 1, 3], prob: [100, 100, 50, 75, 100, 50, 100, 100, 75, 100, 25, 100, 100, 50, 100, 50], acc: [2, 1, 0, 1, 1, 0, 1, 2, 1, 1, 0, 1, 2, 0, 1, 0] }),
    extra: {},
  },
  {
    name: 'WOOD ARP',
    cat: 'ARP',
    desc: 'A struck wooden key over seven steps: a sine and its octave with a touch of FM for the knock, a very short envelope, two notes left to chance.',
    bpm: 122,
    knobs: { rate: RATE['1/16'], gate: 0.3, wave1: 0.35, osc1: 0.9, fm: 0.2, ratio: RATIO('3'), octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.6, res: 0.18, envAmt: 0.3, keyTrack: 0.7, fD: 0.22, fS: 0, fR: 0.18, aD: 0.42, aS: 0, aR: 0.25, accent: 0.6, accFlt: 0.4, phase: 0.04, drift: 0.2, width: 0.4, wave2: WAVE2.SINE, range2: FEET[4], osc2: 0.6},
    seq: edit([0, R, 4, 0, R, 7, 2]),
    prog: [0],
    steps: steps({ prob: [100, 100, 75, 100, 100, 50, 75], rat: [1, 1, 1, 1, 1, 2, 1], acc: [2, 1, 1, 1, 1, 0, 1] }),
    extra: { xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('FM'), xLfo2Depth: 0.15 },
  },
  {
    name: 'GLASS ARP',
    cat: 'ARP',
    desc: 'Nine glass steps against sixteen: a soft triangle with a hollow square an octave above, clear and round, the two blending over eight bars.',
    bpm: 126,
    knobs: { rate: RATE['1/16'], gate: 0.3, wave1: 0.3, osc1: 1, wave2: WAVE2.SQUARE, range2: FEET[4], osc2: 0.55, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.6, res: 0.12, envAmt: 0.25, keyTrack: 0.5, fD: 0.3, fS: 0, fR: 0.3, aD: 0.55, aS: 0.1, aR: 0.45, drift: 0.15, width: 0.45 },
    seq: edit([7, R, 7, R, 4, R, 7, 4, R]),
    prog: [0],
    steps: steps({ rat: [1, 1, 1, 1, 2, 1, 1, 1, 1], prob: [100, 100, 75, 100, 100, 100, 100, 50, 100] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('OSC MIX'), xLfo2Depth: 0.3 },
  },
  /* ======================= PAD (6) : nappes courtes, attaques douces ======================= */
  {
    name: 'STRING PAD',
    cat: 'PAD',
    desc: 'A string machine playing sevenths in eighths: two saws stacked and spread over the twin filters, soft attack, a short warm release.',
    bpm: 116,
    knobs: { rate: RATE['1/8'], mode: MODE.UPDN, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.9, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-7), fine2: cents(7), osc1: 0.8, osc2: 0.65, stack: 0.3, wide: 0.3, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.54, res: 0.08, envAmt: 0.12, fA: 0.4, fD: 0.6, fS: 0.7, fR: 0.5, aA: 0.45, aD: 0.6, aS: 0.8, aR: 0.5, accent: 0.2, accFlt: 0.15, drift: 0.5, width: 0.55, monoLow: 0.3 },
    seq: AUTO,
    prog: [7, 2, 3, 0],
    steps: steps({ gate: [2, 2, 3, 2], acc: [1, 0, 1, 0] }),
    extra: {},
  },
  {
    name: 'AURORA PAD',
    cat: 'PAD',
    desc: 'A slow arpeggiated pad over two octaves of ninths: a square and a saw stacked and spread, long attack, the filter breathing over four bars.',
    bpm: 110,
    knobs: { rate: RATE['1/4'], mode: MODE.UP, range: RANGE[2], notes: NOTES(0), chord: CHORD['9TH'], gate: 0.9, wave1: WAVE1.SQUARE, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-9), fine2: cents(9), osc1: 0.78, osc2: 0.78, stack: 0.3, wide: 0.5, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.54, res: 0.2, envAmt: 0.25, fA: 0.5, fD: 0.65, fS: 0.5, fR: 0.55, aA: 0.55, aD: 0.7, aS: 0.7, aR: 0.55, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.15, accent: 0.3, drift: 0.5, width: 0.7, monoLow: 0.35 },
    seq: AUTO,
    prog: [7, 2, 6, 4],
    steps: steps({ gate: [3, 2, 2, 3] }),
    extra: {},
  },
  {
    name: 'FROZEN PAD',
    cat: 'PAD',
    desc: 'Cold random notes of an eleventh chord: a sine and a triangle a few cents apart, soft attacks and short tails, half of them left out, spread wide.',
    bpm: 100,
    knobs: { rate: RATE['1/16'], mode: MODE.RAND, range: RANGE[2], notes: NOTES(0), chord: CHORD['11TH'], gate: 0.55, wave1: 0.15, osc1: 0.85, wave2: WAVE2.TRI, range2: FEET[8], fine1: cents(-5), fine2: cents(5), osc2: 0.4, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.52, res: 0.15, envAmt: 0.2, fD: 0.5, fS: 0.2, fR: 0.45, aA: 0.15, aD: 0.6, aS: 0.25, aR: 0.5, accent: 0.3, drift: 0.35, width: 0.7 },
    seq: AUTO,
    prog: [6],
    steps: steps({ prob: [100, 50, 25, 75, 50, 100, 25, 50, 75, 25, 50] }),
    extra: {},
  },
  {
    name: 'VELVET PAD',
    cat: 'PAD',
    desc: 'Five quarter notes melting together in a closed ladder filter: two saws stacked thick, slow attack and release, the mix of the two drifting.',
    bpm: 96,
    knobs: { rate: RATE['1/4'], gate: 0.92, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-8), fine2: cents(8), osc1: 0.8, osc2: 0.75, stack: 0.45, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.45, res: 0.2, envAmt: 0.22, fA: 0.6, fD: 0.75, fS: 0.5, fR: 0.6, aA: 0.6, aD: 0.75, aS: 0.8, aR: 0.6, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.15, accent: 0.2, drift: 0.5, width: 0.5, monoLow: 0.35 },
    seq: edit([0, 4, 7, 7, 4]),
    prog: [0, 0, 5, 5],
    steps: steps({ gate: [3, 3, 2, 3, 3] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('OSC MIX'), xLfo2Depth: 0.3 },
  },
  {
    name: 'SUNSET PAD',
    cat: 'PAD',
    desc: 'Arpeggiated sevenths up and down in sixteenths, an octave low: two triangles stacked and spread, soft attacks, the filter swaying over two bars.',
    bpm: 104,
    knobs: { rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.7, wave1: 0.3, wave2: WAVE2.TRI, range2: FEET[8], fine1: cents(-8), fine2: cents(8), osc1: 0.82, osc2: 0.82, stack: 0.25, wide: 0.35, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.5, res: 0.2, envAmt: 0.25, fA: 0.3, fD: 0.6, fS: 0.45, fR: 0.45, aA: 0.3, aD: 0.6, aS: 0.6, aR: 0.45, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.15, accent: 0.3, drift: 0.45, width: 0.5, monoLow: 0.35 },
    seq: AUTO,
    prog: [5, 1, 0, 2],
    steps: steps({ acc: [1, 0, 1, 0] }),
    extra: {},
  },
  {
    name: 'MIST PAD',
    cat: 'PAD',
    desc: 'A soft pad of slow random notes from an eleventh chord: a triangle and a quiet saw, a breath of filtered noise coming and going.',
    bpm: 98,
    knobs: { rate: RATE['1/4'], mode: MODE.RAND, range: RANGE[2], notes: NOTES(0), chord: CHORD['11TH'], gate: 0.9, wave1: WAVE1.TRI, osc1: 0.75, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-6), fine2: cents(6), osc2: 0.3, noise: 0.06, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.44, res: 0.15, envAmt: 0.12, keyTrack: 0.6, fA: 0.5, fD: 0.6, fS: 0.6, fR: 0.55, aA: 0.55, aD: 0.7, aS: 0.7, aR: 0.6, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.12, accent: 0.2, drift: 0.5, width: 0.7, wide: 0.4 },
    seq: AUTO,
    prog: [6, 7],
    steps: steps({ gate: [3, 2, 3, 3], prob: [100, 75, 100, 50, 100] }),
    extra: { xNoiseColor: 0.3, xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('NOISE'), xLfo2Depth: 0.3 },
  },
  /* ======================= DARK (6) : drones, orgue, lead et arpege sombres ======================= */
  {
    name: 'GREY DRONE',
    cat: 'DARK',
    desc: 'Three long quarter notes against four, stacked saws down low over a sine sub, the wave shape drifting over four bars and the filter over eight.',
    bpm: 120,
    knobs: { rate: RATE['1/4'], gate: 0.72, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-6), fine2: cents(6), osc1: 0.84, osc2: 0.7, stack: 0.4, sub: 0.1, subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.MOOG, cutoff: 0.34, res: 0.3, envAmt: 0.3, fA: 0.45, fD: 0.65, fS: 0.3, fR: 0.5, aA: 0.5, aD: 0.7, aS: 0.65, aR: 0.5, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.WAVE, lfoAmt: 0.25, drift: 0.5, width: 0.7, monoLow: 0.4, load: 0.2, wide: 0.55},
    seq: edit([0, 4, 7]),
    prog: [6, 6, 6, 6, 7, 7, 7, 7],
    steps: steps({ gate: [3, 1, 2] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.2 },
  },
  {
    name: 'CATHEDRAL DRONE',
    cat: 'DARK',
    desc: 'A dark organ: two squares an octave apart over a sine sub, the filter half open, seven held notes turning slowly against the bar.',
    bpm: 112,
    knobs: { rate: RATE['1/8'], gate: 0.85, wave1: WAVE1.SQUARE, osc1: 0.8, wave2: WAVE2.SQUARE, range2: FEET[16], osc2: 0.6, sub: 0.25, subWave: SUBW.SINE, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.5, res: 0.1, envAmt: 0.1, fA: 0.2, fD: 0.6, fS: 0.8, fR: 0.5, aA: 0.25, aD: 0.6, aS: 0.9, aR: 0.5, accent: 0.3, accFlt: 0.2, drift: 0.3, width: 0.4, monoLow: 0.35 },
    seq: edit([7, 2, 4, 7, 4, 2, R]),
    prog: [7, 0],
    steps: steps({ prob: [100, 100, 75, 100, 100, 50, 100] }),
    extra: {},
  },
  {
    name: 'DRIFT DRONE',
    cat: 'DARK',
    desc: 'A memory on a worn machine: a saw half way to a square and a triangle, the pitch wandering at random, the oscillators drifting far apart, a breath of hiss.',
    bpm: 90,
    knobs: { rate: RATE['1/8'], gate: 0.72, wave1: 0.5, osc1: 0.84, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.5, noise: 0.04, octave: OCT(0), fmode: FMODE.LP12, cutoff: 0.4, res: 0.15, envAmt: 0.25, fA: 0.3, fD: 0.6, fS: 0.4, fR: 0.5, aA: 0.45, aD: 0.6, aS: 0.55, aR: 0.55, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.RND, lfoDest: L1DEST.PITCH, lfoAmt: 0.05, accent: 0.3, drift: 0.9, width: 0.4 },
    seq: edit([0, R, 4, 7, 2]),
    prog: [3, 1],
    steps: steps({ prob: [100, 100, 75, 100, 75], gate: [2, 1, 1, 3, 1] }),
    extra: { xNoiseColor: 0.25, xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.2 },
  },
  {
    name: 'OCEAN DRONE',
    cat: 'DARK',
    desc: 'A low tide of stacked saws and a square below, six slow notes spread across the twin filters, the cutoff rising and falling like a swell over eight bars.',
    bpm: 92,
    knobs: { rate: RATE['1/4'], gate: 0.95, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[16], fine1: cents(-6), fine2: cents(6), osc1: 0.8, osc2: 0.55, stack: 0.35, wide: 0.4, sub: 0.15, subWave: SUBW.SINE, octave: OCT(-1), fmode: FMODE.LP12, cutoff: 0.5, res: 0.15, envAmt: 0.2, fA: 0.6, fD: 0.7, fS: 0.6, fR: 0.6, aA: 0.65, aD: 0.7, aS: 0.8, aR: 0.65, accent: 0.2, drift: 0.5, width: 0.55, monoLow: 0.35 },
    seq: edit([0, 4, 7, 4, 2, 6]),
    prog: [0, 0, 3, 3, 1, 1, 2, 2],
    steps: steps({ gate: [3, 3, 3, 2, 3, 3], slide: [0, 0, 1, 0, 0, 1] }),
    extra: { xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.25 },
  },
  {
    name: 'CRYPT ARP',
    cat: 'DARK',
    desc: 'A descent into the crypt: a pulse arpeggio falling over two octaves of sevenths in the Korg filter, a square sub, the pulse width jumping at random.',
    bpm: 119,
    knobs: { rate: RATE['1/16'], mode: MODE.DOWN, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.6, wave1: 0.75, osc1: 0.9, sub: 0.25, subWave: SUBW.SQUARE, octave: OCT(0), fmode: FMODE.MS10, cutoff: 0.34, res: 0.32, envAmt: 0.32, keyTrack: 0.5, fD: 0.35, fS: 0.3, fR: 0.25, aD: 0.42, aS: 0.5, aR: 0.2, accent: 0.5, accFlt: 0.4, phase: 0.1, drift: 0.3, width: 0.2},
    seq: AUTO,
    prog: [0, 3, 1, 4],
    steps: steps({ rat: [1, 1, 1, 1, 1, 1, 1, 2], acc: [2, 1, 1, 1] }),
    extra: { xLfo2Rate: L2RATE('1/8'), xLfo2Shape: L2SHAPE('S&H'), xLfo2Dest: L2DEST('WAVE'), xLfo2Depth: 0.25 },
  },
  {
    name: 'SYNC GRIND',
    cat: 'DARK',
    desc: 'A dark hard sync lead in eighths: the second saw locked to the first and swept slowly over two bars, lightly stacked, the ladder filter keeping it warm.',
    bpm: 122,
    knobs: { rate: RATE['1/8'], gate: 0.72, wave1: WAVE1.SAW, osc1: 0.5, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(5), osc2: 0.8, sync: ON, stack: 0.2, octave: OCT(0), fmode: FMODE.MOOG, cutoff: 0.44, res: 0.25, envAmt: 0.3, fD: 0.45, fS: 0.4, fR: 0.3, aA: 0.04, aD: 0.5, aS: 0.7, aR: 0.3, accent: 0.45, accFlt: 0.35, phase: 0.3, drift: 0.35, width: 0.35 },
    seq: edit([0, R, 7, 6, R, 4, 2, 4]),
    prog: [0, 2],
    steps: steps({ slide: [0, 0, 1, 1, 0, 0, 1, 0], gate: [2, 1, 3, 1, 1, 2, 3, 1], acc: [2, 1, 1, 1, 1, 2, 1, 1] }),
    extra: { xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('OSC 2 PITCH'), xLfo2Depth: 0.3 },
  },
];

/*
 * VOLUME de chaque preset : presets/volumes.json, ecrit par le rendu hors ligne (presets/calibrate.sh : la sonie
 * ponderee K de chaque preset vers -23 LUFS, les PAD vers -24). Un preset absent du fichier part a 0.7.
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
  // v27 : FEEDBACK de la page DELAY garde sa valeur exacte (celle que le site tirait de DELAY : 0.35 + 0.33 x DELAY)
  if (id === 'xDlFb') return v;
  return r3(v);
}

/*
 * v27 (2026-11-17) : l'ancien DELAY (DLY TIME, TAPE, DELAY MODE, masques) passe a la page DELAY par la regle de
 * PluginProcessor::convertDelay (et de la face, plugin/arp/delay.ts delayFromOld), au bit pres : TAPE au-dessus de
 * 0.02 -> STYLE TAPE, WOBBLE = TAPE, PING-PONG ; sinon DIGITAL, WOBBLE 0, PING PONG / STEREO -> DUAL / WIDE ; DLY TIME ->
 * SYNC, 1/8 1/8. 1/4 1/4. 1/2 ; FEEDBACK = 0.35 + 0.33 x DELAY. Le reste de la page a son depart.
 */
const DL_DIV = [2, 2, 3, 3, 4];
const DL_NOTE = [0, 1, 0, 1, 0];
function delayFrom(knobs, dlyMode) {
  const out = {};
  for (const e of EXTRA) if (e.section === 'delay') out[e.id] = e.def;
  const dm = Math.round(dlyMode * 2);
  if (knobs.tape >= 0.02) {
    out.xDlStyle = exStep('xDlStyle', 'TAPE');
    out.xDlWobble = knobs.tape;
    out.xDlMode = exStep('xDlMode', 'PING-PONG');
  } else {
    out.xDlStyle = exStep('xDlStyle', 'DIGITAL');
    out.xDlWobble = 0;
    out.xDlMode = exStep('xDlMode', dm === 1 ? 'DUAL' : dm === 2 ? 'WIDE' : 'PING-PONG');
  }
  const dt = Math.max(0, Math.min(4, Math.round(knobs.dlyTime * 4)));
  out.xDlSync = 1;
  out.xDlDiv = DL_DIV[dt] / 6;
  out.xDlNote = DL_NOTE[dt] / 2;
  out.xDlFb = 0.35 + (0.68 - 0.35) * knobs.delay;
  return out;
}
const V27_FROM = EXTRA.findIndex((e) => e.id === 'xDlStyle');
const V27 = EXTRA.slice(V27_FROM);

/*
 * v43 : les reglages du VST3 seul qui restent a leur neutre dans toute la banque (en plus des effets de
 * ANALOG_FX_OFF_EXTRA) : la reverbe (taille, ton, pre-delai, la BigSky sur CLASSIC), HELL entier, le MASTER, l'ancien
 * EQ et l'ancien mode du DELAY, la matrice, les modes de voix, FEEDBACK, AMP MODE, la pedale masquee, le rack (ses
 * reglages fins), FILTER + (COMB FB). Seuls comptent la voix, ses LFO, le swing et le sequenceur.
 */
const NEUTRAL_SECTIONS = new Set(['reverb', 'master', 'phaser', 'flanger', 'pump', 'crush', 'old', 'space', 'matrix', 'voice', 'amp', 'dist', 'hell', 'sky', 'filter']);
const EXTRA_STEPS = Object.fromEntries(EXTRA.filter((e) => e.steps).map((e) => [e.id, e.steps]));

function full(p) {
  const raw = { ...SITE_DEF, ...BASE, ...p.knobs, volume: VOLUME[p.name] ?? VOLUME_DEF };
  const knobs = {};
  for (const k of VOY_KNOBS) knobs[k.id] = clean(k.id, raw[k.id]);
  for (const id of Object.keys(p.knobs)) if (!KNOB[id]) throw new Error(`${p.name} : potard inconnu ${id}`);
  if ('volume' in p.knobs) throw new Error(`${p.name} : VOLUME vient de volumes.json`);
  for (const id of Object.keys(p.extra)) if (!EXTRA.some((e) => e.id === id)) throw new Error(`${p.name} : reglage inconnu ${id}`);
  // v43 : le preset ne pose que la voix (LFO, OSC +, swing) ; tout ce qui est effet ou neutre de banque est refuse
  for (const id of Object.keys(p.extra)) {
    const e = EXTRA.find((x) => x.id === id);
    if (NEUTRAL_SECTIONS.has(e.section) || id in ANALOG_FX_OFF_EXTRA || e.section === 'delay' || e.section === 'eq' || e.section === 'chorus' || e.section === 'disto' || e.section === 'engine')
      throw new Error(`${p.name} : ${id} reste a son neutre dans la banque d'usine (v43 : aucun effet)`);
  }
  // QUALITY a HQ dans le fichier (la face ne l'applique pas : un preset d'usine garde la qualite et le moteur de
  // l'instance), la reverbe d'avant (CLASSIC), les effets a l'arret
  const ex = { ...EXTRA_DEF, xQuality: 1, xSkyType: 0, ...ANALOG_FX_OFF_EXTRA, ...p.extra };
  // la page DELAY recoit l'ancien DELAY du preset, converti (DELAY a 0 : MIX a 0, coupee) ; l'EQ et le rack enrichi a
  // leur neutre
  Object.assign(ex, delayFrom(knobs, ex.xDlyMode));
  for (const e of V27) if (e.section !== 'delay' && ex[e.id] !== e.def) throw new Error(`${p.name} : ${e.id} doit rester neutre (${e.def})`);
  const extra = {};
  for (const e of EXTRA) extra[e.id] = cleanExtra(e.id, ex[e.id]);
  // Les regles du son analogique (analog.ts) : aucun effet, le filtre modere, pas trop aigu
  const faults = analogFaults(knobs, extra, EXTRA_STEPS);
  if (faults.length) throw new Error(`${p.name} : ${faults.join(' ; ')}`);
  // et ce qui doit rester exactement au neutre (la reverbe BigSky sur CLASSIC, HELL entier, la DISTO, la pedale...)
  for (const e of EXTRA) {
    if (e.id === 'xSkyType' || e.id === 'xQuality') continue;
    if ((NEUTRAL_SECTIONS.has(e.section) || e.section === 'disto' || e.section === 'eq' || e.section === 'chorus') && extra[e.id] !== cleanExtra(e.id, e.def))
      throw new Error(`${p.name} : ${e.id} = ${extra[e.id]}, son neutre est ${e.def}`);
  }
  if (extra.xSkyType !== 0) throw new Error(`${p.name} : la reverbe reste CLASSIC (xSkyType 0)`);
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
