#!/usr/bin/env node
/**
 * MM-ARP, la banque d'usine du VST3 (2026-11-10, Mika : "les presets pourraient etre meilleurs, c'est un peu toujours
 * pareil ! Je veux plus de presets a la Donna Summer, genre disco, ou alors des trucs hypnotiques"). Le VST3 seul : les
 * presets du site (src/v4/state/factory.ts) ne changent pas. Refaite le 2026-11-11 (40 presets, le sequenceur par pas),
 * revue le 2026-11-18 (v28 : BASS 16, ARP 12, PAD 6, DARK 6), refaite le 2026-11-20 (v43, Mika : "Tous les presets
 * doivent sonner absolument parfait ! sans filtre pas trop aigu ... que ca sonne vraiment bon synth analog ! evite les fx
 * sur tous les presets ! ou des filtres, si tu en utilises alors pas trop intense !" : un synthe analogique a sec).
 *
 * Refaite le 2026-11-24 (v52, Mika : "Les presets ne sont pas assez bons ! ca doit etre vraiment super super bons comme
 * ca et doit s'associer facilement a de la musique techno") : une banque qui tourne tout de suite sous un kick 4/4.
 *   - BPM 124 a 132. Quatre familles, les quatre colonnes de LIBRARY : BASS 12 (le grave sous le kick), ACID 8 (accent et
 *     slide, la resonance tenue : cinq dans le grave, trois lignes du dessus), SEQ 12 (le medium hypnotique : sequences,
 *     plucks, arpeges), CHORD 8 (stabs, nappes qui pulsent, un drone pour les breaks) ; la couleur dark disco gardee
 *     (MUNICH BASS, OCTAVE DISCO, DISCO OCTAVES, ITALO ARP, EBM BASS).
 *   - Un geste rythmique par preset, pense pour le kick : les basses roulantes frappent apres lui (e, et, a), l'offbeat
 *     sur le et ; SUR KICK (tests/presets_render.cpp, la part du sub dans le premier quart du temps) : 5 % en mediane
 *     (32 % en v45). Le groove par le sequenceur : RATE 1/16 surtout, 1/8, des triolets par RATCHET x3 sur des croches,
 *     SWING leger, accents par pas (ACC FILTER : l'accent ouvre le filtre, l'acid sans resonance excessive), SLIDE,
 *     CHANCE et RATCHET pour faire varier une boucle hypnotique ; la progression : un accord, ou deux qui montent peu.
 *   - Le grave : BASS et ACID en VOICE MODE MONO (une voix : aucune queue sous la note suivante, le SLIDE glisse dans la
 *     meme voix), WIDTH 0, BASS MONO 0.62 (135 Hz). Mesure (CLASSIC HQ, les 17 du registre grave) : sub sous 100 Hz 34 %
 *     en mediane (19 % en v45), 200-400 Hz 16 % (22 %, 38 % au plus avant), cote sous 120 Hz 4.8 % au plus (16 %).
 *   - Les regles v43 restent toutes (aucun effet, passe-bas modere, pas trop aigu, les cibles ci-dessous) ; un seul ajout :
 *     VOICE MODE POLY ou MONO, jamais LEGATO (analog.ts, presets-check.mjs, RANDOM qui pose MONO sur ses basses).
 *   - Diversite (presets_render) : D 2.40 et DS 1.66 au moins (seuils 2.4 et 1.6) en CLASSIC x4 et x8 et en PRO STD.
 *
 * LES REGLES (v43, verifiees ici a l'ecriture et par tests/presets-check.mjs ; les memes pour RANDOM de la face, toutes
 * dans src/v4/plugin/arp/analog.ts) :
 *   - AUCUN effet : OVERDRIVE / DISTO, CHORUS, DELAY, REVERB, TAPE, GLUE, SIDECHAIN a l'arret ; WARMTH, PHASER,
 *     FLANGER, PUMP, CRUSH, SHIMMER, HELL, RING, FOLD, HIGH PASS, COMB a 0 ; la DISTO, la page DELAY, la reverbe (BigSky
 *     a CLASSIC), l'EQ 6 bandes, l'ancien EQ, le MASTER (BASS, AIR, WIDTH), la matrice, BEND RANGE et AMP a leur
 *     neutre ; VOICE MODE POLY ou MONO (v52) ;
 *   - le filtre : un passe-bas (MOOG, LP12, MS-10), CUTOFF 0.25 a 0.6, RES 0.45 au plus, ENV AMT 0.5 au plus, jamais
 *     ouvert au-dela de 6 kHz par l'enveloppe, ACC FILTER 0.6 au plus, les LFO sur la coupure ou la resonance a 0.25 ;
 *   - pas trop aigu : OCTAVE 0 au plus, RANGE 4' au plus, FM 0.2, NOISE 0.12, vibrato 0.08 au plus.
 * (Avant la v43 : HELL MIX 0.10 au plus, reverbe CLASSIC, DISTO neutre ; elles restent vraies, en plus strict.)
 * Les cibles mesurees hors ligne (tests/presets_render.cpp, 8 mesures, CLASSIC HQ et PRO STD, aucun son joue ; le code de
 * sortie les verifie depuis la v52) : crete sous -3 dBFS ; sonie -23 LUFS a 0.7 LU pres (-24 pour la famille PAD de
 * RANDOM) ; DC sous -60 dBFS ; part au-dessus de 6 kHz sous 0.5 % ; centroide 150 a 500 Hz (BASS), 150 a 700 Hz (ACID),
 * 350 a 1000 Hz (SEQ), 200 a 1000 Hz (CHORD) ; bas-medium (120-500 Hz) au moins 30 % ; BASS et ACID mono sous 120 Hz.
 * Mesure v52 (CLASSIC HQ) : les 40 dans les cibles ; crete -3.3 dBFS au plus, au-dessus de 6 kHz 0.07 % au plus (0.34 en
 * v45), centroide median 278 Hz (398), bas-medium 30.9 % au moins.
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
 * K de chaque preset sur 8 mesures, vers -23 LUFS). Recaler apres un changement de son :
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
 * Reperes : un degre est compte dans fa diese mineur depuis la racine de l'accord (0 racine, 2 tierce, 3 quarte, 4
 * quinte, 6 septieme, 7 octave, -3 la quinte en dessous). La racine est posee vers fa diese 3 (185 Hz) : OCTAVE -1 la
 * descend vers fa diese 2 (92 Hz), le registre des basses techno, et le SUB a -1 vers fa diese 1 (46 Hz). Accords (indices
 * du site) : 0 F#m, 1 D, 2 E, 3 C#m, 4 Bm, 5 A, 6 F#m7, 7 Dmaj7 ; une mesure par accord. Les basses restent sur un accord,
 * ou deux qui montent peu (A : +3, Bm : +5), pour que le grave ne quitte pas le kick.
 *
 * v52 : chaque preset a UN geste rythmique pense pour un kick 4/4 (la ou il frappe, la ou il laisse la place) et UNE
 * voix ; BASS et ACID en MONO (une seule voix : aucune queue de note sous la suivante, le glisse d'une vraie ligne),
 * centrees (WIDTH 0) et mono sous 135 Hz (BASS MONO 0.62).
 */

/** VOICE MODE (extra-params.json) : POLY, MONO ; LEGATO jamais (analog.ts). */
const VOICE = (n) => exStep('xVoiceMode', n);
const MONO = { xVoiceMode: VOICE('MONO') };
/** Le socle des basses et des lignes acides : OCTAVE -1, au centre, mono sous 135 Hz, une phase de depart fixe. */
const LOW = { octave: OCT(-1), range1: FEET[8], width: 0, wide: 0, space: 0, stack: 0, monoLow: 0.62, phase: 0.3, drift: 0.22, keyTrack: 0.5 };
/** Le socle du medium (SEQ, CHORD) : OCTAVE 0, un peu de largeur, BASS MONO coupe (rien sous 120 Hz). */
const MID = { octave: OCT(0), range1: FEET[8], monoLow: 0, phase: 0, drift: 0.3 };

const BANK = [
  /* ======================= BASS (12) : le grave sous le kick, mono, un geste par preset ======================= */
  {
    name: 'ROLLING BASS',
    cat: 'BASS',
    desc: 'The techno rolling bass: three sixteenths after every kick, a saw over a sine sub, the mixer pushing the ladder filter, the middle note pushed, an octave turning the bar.',
    bpm: 126,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.95, sub: 0.3, subOct: SUBOCT['-1'], subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.48, res: 0.15, envAmt: 0.36, fA: 0, fD: 0.28, fS: 0.03, fR: 0.15, aA: 0, aD: 0.38, aS: 0.2, aR: 0.15, accent: 0.35, accFlt: 0.45, load: 0.35 },
    seq: edit([R, 0, 0, 0, R, 0, 0, 0, R, 0, 0, 0, R, 0, 7, 0]),
    prog: [0],
    steps: steps({ acc: [1, 0, 2, 1] }),
    extra: { ...MONO, xSwing: 0.2 },
  },
  {
    name: 'OFFBEAT BASS',
    cat: 'BASS',
    desc: 'The offbeat bass between the kicks: one round eighth on every and, a saw and a softer square over a sine sub, a fifth closing the second bar, F sharp minor to A.',
    bpm: 124,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.62, wave1: WAVE1.SQUARE, osc1: 0.45, wave2: WAVE2.SAW, range2: FEET[8], osc2: 1, fine1: cents(-4), fine2: cents(4), sub: 0.22, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.5, res: 0.18, envAmt: 0.32, fD: 0.42, fS: 0.25, fR: 0.2, aD: 0.55, aS: 0.6, aR: 0.22, accent: 0.3, accFlt: 0.4, load: 0.12 },
    seq: edit([R, 0, R, 0, R, 0, R, 0, R, 0, R, 0, R, 0, R, 4]),
    prog: [0, 0, 5, 5],
    steps: steps({ acc: [1, 1, 1, 2] }),
    extra: { ...MONO },
  },
  {
    name: 'SUB PULSE',
    cat: 'BASS',
    desc: 'A deep pulse on the off sixteenths: a saw over a big sine sub in a soft 12 dB filter, the mixer pushed for body, nothing on the kick.',
    bpm: 128,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.6, wave1: WAVE1.SAW, osc1: 0.85, sub: 0.4, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.45, res: 0.12, envAmt: 0.28, fD: 0.4, fS: 0.3, fR: 0.2, aA: 0.04, aD: 0.5, aS: 0.65, aR: 0.2, accent: 0.25, accFlt: 0.3, load: 0.3 },
    seq: edit([R, 0, R, 0]),
    prog: [0],
    steps: steps({ acc: [1, 0, 1, 2] }),
    extra: { ...MONO },
  },
  {
    name: 'MUNICH BASS',
    cat: 'BASS',
    desc: 'The 1977 disco bass for dark disco: root and octave bouncing in sixteenths, a saw and a square plucked by the ladder filter, the fifth and seventh closing the bar.',
    bpm: 124,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.45, wave1: WAVE1.SAW, osc1: 0.88, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.4, fine1: cents(-5), fine2: cents(5), sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.43, res: 0.26, envAmt: 0.38, fD: 0.3, fS: 0.08, fR: 0.16, aD: 0.4, aS: 0.4, aR: 0.15, accent: 0.45, accFlt: 0.45, load: 0.12 },
    seq: edit([0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 4, 7, 6, 7]),
    prog: [0, 0, 1, 2],
    steps: steps({ acc: [2, 0, 1, 0], gate: [1, 0, 1, 0] }),
    extra: { ...MONO },
  },
  {
    name: 'GALLOP BASS',
    cat: 'BASS',
    desc: 'A galloping bass that answers the kick: root on the and, octave on the last sixteenth, a pulse wave breathing over two bars above a sine sub, its top a little apart.',
    bpm: 124,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.42, wave1: 0.66, osc1: 0.9, sub: 0.5, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.36, res: 0.22, envAmt: 0.34, fD: 0.3, fS: 0.1, fR: 0.15, aD: 0.4, aS: 0.4, aR: 0.14, accent: 0.4, accFlt: 0.5, load: 0.1, space: 0.4, monoLow: 0.75 },
    seq: edit([R, R, 0, 7, R, R, 0, 7, R, R, 0, 7, R, 0, 0, 7]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [1, 1, 1, 2] }),
    extra: { ...MONO, xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('WAVE'), xLfo2Depth: 0.4 },
  },
  {
    name: 'EBM BASS',
    cat: 'BASS',
    desc: 'Body music: straight eighths that never stop, a saw and a square through the Korg filter, short and hard, an octave jump closing the bar.',
    bpm: 125,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.3, wave1: WAVE1.SAW, osc1: 0.9, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.45, fine1: cents(-3), fine2: cents(3), sub: 0.25, subWave: SUBW.SINE, fmode: FMODE.MS10, cutoff: 0.44, res: 0.32, envAmt: 0.4, fD: 0.3, fS: 0.05, fR: 0.14, aD: 0.4, aS: 0.25, aR: 0.14, accent: 0.4, accFlt: 0.5, load: 0.25 },
    seq: edit([0, 0, 0, 0, 0, 0, 7, 0]),
    prog: [0, 0, 0, 4],
    steps: steps({ acc: [2, 1, 1, 1, 2, 1, 1, 0] }),
    extra: { ...MONO },
  },
  {
    name: 'TRIPLET ROLL',
    cat: 'BASS',
    desc: 'Sixteenth triplets rolling off every kick: an eighth on the and split in three, a hollow square over a sine sub in the ladder filter, the first of each three pushed.',
    bpm: 127,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.55, wave1: WAVE1.SQUARE, osc1: 0.95, sub: 0.35, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.43, res: 0.28, envAmt: 0.35, fD: 0.28, fS: 0.05, fR: 0.14, aD: 0.36, aS: 0.4, aR: 0.13, accent: 0.3, accFlt: 0.45, load: 0.15 },
    seq: edit([R, 0, R, 0, R, 0, R, 7]),
    prog: [0],
    steps: steps({ rat: [1, 3], acc: [1, 2] }),
    extra: { ...MONO },
  },
  {
    name: 'DUB BASS',
    cat: 'BASS',
    desc: 'Dub techno weight: a round saw over a deep sine sub on the offbeats, long swelling notes in a soft 12 dB filter moving over eight bars, the last one sliding down to the fifth.',
    bpm: 124,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.85, wave1: 0.4, osc1: 0.88, sub: 0.38, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.46, res: 0.1, envAmt: 0.22, fA: 0.1, fD: 0.5, fS: 0.4, fR: 0.3, aA: 0.3, aD: 0.6, aS: 0.75, aR: 0.32, accent: 0.2, accFlt: 0.3, load: 0.35 },
    seq: edit([R, 0, R, R, R, 0, R, -3]),
    prog: [0, 0, 4, 4],
    steps: steps({ slide: [0, 0, 0, 0, 0, 0, 0, 1], gate: [1, 2, 1, 1, 1, 2, 1, 3] }),
    extra: { ...MONO, xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.25 },
  },
  {
    name: 'FIFTH BASS',
    cat: 'BASS',
    desc: 'A stab bass in fifths: two saws a fifth apart over a sine sub, short syncopated hits that leave the kick alone.',
    bpm: 126,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.95, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(7), osc2: 0.7, fine1: cents(-4), fine2: cents(4), sub: 0.35, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.4, res: 0.2, envAmt: 0.38, fD: 0.32, fS: 0.05, fR: 0.15, aD: 0.5, aS: 0.4, aR: 0.16, accent: 0.35, accFlt: 0.45, load: 0.15 },
    seq: edit([R, R, 0, R, R, 0, R, 0, R, R, 0, R, R, 0, R, 0]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [1, 1, 2, 1, 1, 1, 1, 0, 1, 1, 2, 1, 1, 1, 1, 0] }),
    extra: { ...MONO },
  },
  {
    name: 'KNOCK BASS',
    cat: 'BASS',
    desc: 'A minimal knock: a sine touched by FM and a triangle an octave above for the wooden attack, a sine sub, very short notes in a broken sixteenth pattern.',
    bpm: 128,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.35, wave1: 0.12, osc1: 1, fm: 0.2, ratio: RATIO('3'), sub: 0.28, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.56, res: 0.15, envAmt: 0.38, fD: 0.24, fS: 0, fR: 0.12, aD: 0.42, aS: 0.05, aR: 0.14, accent: 0.4, accFlt: 0.4, load: 0.4, wave2: WAVE2.TRI, range2: FEET[4], osc2: 1 },
    seq: edit([R, R, 0, 0, R, R, 0, R, R, R, 0, 0, R, 0, R, 7]),
    prog: [0],
    steps: steps({ acc: [1, 1, 2, 0, 1, 1, 2, 1, 1, 1, 2, 0, 1, 1, 1, 1] }),
    extra: { ...MONO },
  },
  {
    name: 'OCTAVE DISCO',
    cat: 'BASS',
    desc: 'Disco octaves in eighths: a square and a saw bouncing root to octave, a short slide up now and then, over F sharp minor, A, D and E.',
    bpm: 125,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.55, wave1: WAVE1.SQUARE, osc1: 0.9, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.35, fine1: cents(-6), fine2: cents(6), sub: 0.38, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.42, res: 0.22, envAmt: 0.32, fD: 0.38, fS: 0.15, fR: 0.2, aD: 0.5, aS: 0.5, aR: 0.18, accent: 0.45, accFlt: 0.4, load: 0.1 },
    seq: edit([0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 0, 7, 4, 7, 6, 7]),
    prog: [0, 5, 1, 2],
    steps: steps({ slide: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], acc: [2, 1] }),
    extra: { ...MONO },
  },
  {
    name: 'PEAK ROLL',
    cat: 'BASS',
    desc: 'Peak time at 130: a growling saw with a second saw an octave above through the Korg filter, the mixer pushed hard, two hits after every kick and a doubled octave closing the bar.',
    bpm: 130,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.55, wave1: WAVE1.SAW, osc1: 0.75, wave2: WAVE2.SAW, range2: FEET[4], osc2: 0.65, fine1: cents(-7), fine2: cents(7), sub: 0.22, subWave: SUBW.SINE, fmode: FMODE.MS10, cutoff: 0.5, res: 0.32, envAmt: 0.4, fD: 0.3, fS: 0.05, fR: 0.14, aD: 0.4, aS: 0.45, aR: 0.14, accent: 0.45, accFlt: 0.55, load: 0.45 },
    seq: edit([R, 0, 0, R, R, 0, 0, R, R, 0, 0, R, R, 0, 7, R]),
    prog: [0],
    steps: steps({ acc: [1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 1, 1], rat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1] }),
    extra: { ...MONO, xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.18 },
  },

  /* ======================= ACID (8) : accent + slide, la resonance tenue (0.45 au plus), mono ======================= */
  {
    name: 'ACID LINE',
    cat: 'ACID',
    desc: 'A classic acid line: one saw in the ladder filter, warm resonance, accents that open it and slides that tie into the octave and back.',
    bpm: 128,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.9, sub: 0.2, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.37, res: 0.45, envAmt: 0.47, keyTrack: 0.6, fD: 0.4, fS: 0, fR: 0.2, aD: 0.5, aS: 0.55, aR: 0.16, accent: 0.25, accFlt: 0.6, load: 0.2 },
    seq: edit([0, R, 0, 7, 0, R, 2, 0, 0, 0, 7, 0, R, 6, 7, 0]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 2, 0, 1, 1, 0, 1, 1, 2, 1, 1, 1, 2, 0], slide: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0], gate: [1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0] }),
    extra: { ...MONO },
  },
  {
    name: 'SOFT ACID',
    cat: 'ACID',
    desc: 'Deep house acid: a soft wave between triangle and saw in the 12 dB filter, rounder resonance breathing over four bars, a sparse swung line sliding up to the octave.',
    bpm: 124,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.6, wave1: 0.32, osc1: 0.9, sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.36, res: 0.32, envAmt: 0.32, fD: 0.48, fS: 0.15, fR: 0.2, aD: 0.55, aS: 0.7, aR: 0.22, accent: 0.25, accFlt: 0.5, load: 0.1, space: 0.6, monoLow: 0.7 },
    seq: edit([0, R, R, 7, R, 0, 3, R]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [2, 1, 1, 2, 1, 1, 1, 0], slide: [0, 0, 0, 1, 0, 0, 0, 0] }),
    extra: { ...MONO, xSwing: 0.3, xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('ENV AMT'), xLfo2Depth: 0.35 },
  },
  {
    name: 'ACID ROLL',
    cat: 'ACID',
    desc: 'An acid top line at 130, an octave above the bass: a hollow pulse wave in the Korg filter, a three three two rhythm, slides into the octave, the two filters a little apart.',
    bpm: 130,
    knobs: { ...LOW, octave: OCT(0), rate: RATE['1/16'], gate: 0.5, wave1: 0.7, osc1: 1, sub: 0, fmode: FMODE.MS10, cutoff: 0.36, res: 0.42, envAmt: 0.4, fD: 0.34, fS: 0, fR: 0.18, aD: 0.45, aS: 0.5, aR: 0.15, accent: 0.3, accFlt: 0.55, load: 0.25, space: 0.3 },
    seq: edit([0, 0, R, 7, 0, R, 0, 2, R, 0, 7, R, 0, 6, R, 4]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1, 2, 1, 1, 0, 1, 2, 1, 1, 2, 1, 1, 0], slide: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0] }),
    extra: { ...MONO },
  },
  {
    name: 'ACID HYPNO',
    cat: 'ACID',
    desc: 'Three acid steps turning against the bar at 132, in the middle register: root, root, a slide to the octave, the cutoff rising and falling over eight bars.',
    bpm: 132,
    knobs: { ...LOW, octave: OCT(0), rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.9, sub: 0, fmode: FMODE.MOOG, cutoff: 0.38, res: 0.44, envAmt: 0.4, fD: 0.38, fS: 0.05, fR: 0.2, aD: 0.5, aS: 0.5, aR: 0.15, accent: 0.2, accFlt: 0.55, load: 0.2, space: 0.25 },
    seq: edit([0, 0, 7]),
    prog: [0],
    steps: steps({ acc: [2, 0, 1], slide: [0, 0, 1] }),
    extra: { ...MONO, xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.22 },
  },
  {
    name: 'SQUARE ACID',
    cat: 'ACID',
    desc: 'A square wave acid bass, hollow and woody in the 12 dB filter, the two filters a little apart, a sparse syncopated line with two slides per bar.',
    bpm: 126,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SQUARE, osc1: 0.9, sub: 0.25, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.42, res: 0.38, envAmt: 0.4, fD: 0.48, fS: 0.05, fR: 0.18, aD: 0.45, aS: 0.5, aR: 0.16, accent: 0.25, accFlt: 0.55, load: 0.15, space: 0.3, monoLow: 0.7 },
    seq: edit([0, R, R, 0, R, R, 7, R, 0, R, R, 3, R, 0, R, 4]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 0, 1, 1, 2, 1, 1, 1, 1, 2, 1, 0, 1, 1], slide: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0] }),
    extra: { ...MONO },
  },
  {
    name: 'GHOST ACID',
    cat: 'ACID',
    desc: 'Minimal acid: a few saw notes left to chance, soft ghost notes between the accents, one ratchet, the resonance breathing slowly.',
    bpm: 125,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.95, sub: 0.25, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.36, res: 0.4, envAmt: 0.42, fD: 0.32, fS: 0, fR: 0.16, aD: 0.42, aS: 0.5, aR: 0.15, accent: 0.25, accFlt: 0.55, load: 0.15 },
    seq: edit([0, R, R, 0, R, 0, R, R, 0, R, 7, R, R, 0, R, 2]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 0, 1, 0, 1, 1, 2, 1, 1, 1, 1, 0, 1, 1], prob: [100, 100, 100, 75, 100, 50, 100, 100, 100, 100, 75, 100, 100, 75, 100, 50], rat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1], slide: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] }),
    extra: { ...MONO, xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('RES'), xLfo2Depth: 0.2 },
  },
  {
    name: 'SWING ACID',
    cat: 'ACID',
    desc: 'A swung acid top line an octave above the bass: a saw through the Korg filter, sixteenths pushed late, doubled hits, octave slides and a minor seventh answer, the two filters apart.',
    bpm: 124,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.42, wave1: WAVE1.SAW, osc1: 0.9, sub: 0, fmode: FMODE.MS10, cutoff: 0.42, res: 0.38, envAmt: 0.42, fD: 0.36, fS: 0.05, fR: 0.18, aD: 0.45, aS: 0.35, aR: 0.16, accent: 0.3, accFlt: 0.55, load: 0.2, space: 0.6, monoLow: 0.7, octave: OCT(0) },
    seq: edit([0, 0, R, 0, 7, R, 0, 0, R, 0, 6, 0, 7, R, 0, 4]),
    prog: [0, 0, 5, 5],
    steps: steps({ acc: [2, 0, 1, 1, 2, 1, 1, 0, 1, 1, 2, 0, 2, 1, 1, 1], slide: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0], rat: [1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2] }),
    extra: { ...MONO, xSwing: 0.55 },
  },
  {
    name: 'DEEP ACID',
    cat: 'ACID',
    desc: 'Deep acid an octave down, in eighths: a saw and a square on the low F sharp, the resonance singing through the harmonics, long slides falling to the fifth below.',
    bpm: 126,
    knobs: { ...LOW, octave: OCT(-2), rate: RATE['1/8'], gate: 0.62, wave1: WAVE1.SAW, osc1: 0.88, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.35, fine1: cents(-5), fine2: cents(5), sub: 0, fmode: FMODE.LP12, cutoff: 0.48, res: 0.4, envAmt: 0.42, fD: 0.45, fS: 0.1, fR: 0.25, aD: 0.55, aS: 0.6, aR: 0.2, accent: 0.25, accFlt: 0.5, load: 0.2 },
    seq: edit([0, R, 0, 7, 0, R, 3, -3]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 2, 1, 1, 1, 0], slide: [0, 0, 0, 1, 1, 0, 0, 1] }),
    extra: { ...MONO, xLfo2Rate: L2RATE('8 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.18 },
  },

  /* ======================= SEQ (12) : le medium hypnotique, sequences, plucks, arpeges ======================= */
  {
    name: 'HYPNO SEQ',
    cat: 'SEQ',
    desc: 'Berlin school against the four on the floor: three notes and a breath, seven steps turning over sixteen, a saw over a square an octave below, the cutoff drifting over four bars.',
    bpm: 126,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.45, wave1: WAVE1.SAW, osc1: 0.85, wave2: WAVE2.SQUARE, range2: FEET[16], osc2: 0.4, fine1: cents(-5), fine2: cents(5), fmode: FMODE.MOOG, cutoff: 0.45, res: 0.28, envAmt: 0.3, keyTrack: 0.6, fD: 0.35, fS: 0.1, fR: 0.25, aD: 0.45, aS: 0.3, aR: 0.25, accent: 0.4, accFlt: 0.45, width: 0.35 },
    seq: edit([0, 7, 4, 0, 7, 4, R]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1, 1, 0, 1] }),
    extra: { xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.25 },
  },
  {
    name: 'BLEEP SEQ',
    cat: 'SEQ',
    desc: 'Bleep techno: clean sine and triangle tones, short and dry, a sparse two octave figure that leaves room for the drums.',
    bpm: 130,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.35, wave1: 0.1, osc1: 1, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.6, fine1: cents(-3), fine2: cents(3), fmode: FMODE.LP12, cutoff: 0.5, res: 0.1, envAmt: 0.2, keyTrack: 0.6, fD: 0.3, fS: 0, fR: 0.2, aD: 0.4, aS: 0.05, aR: 0.22, accent: 0.4, accFlt: 0.3, width: 0.3 },
    seq: edit([7, R, 7, R, R, 7, R, 9, 7, R, R, 7, R, 4, R, 7]),
    prog: [0],
    steps: steps({ acc: [2, 1, 0, 1, 1, 1, 1, 2, 2, 1, 1, 0, 1, 1, 1, 2] }),
    extra: {},
  },
  {
    name: 'PLUCK SEQ',
    cat: 'SEQ',
    desc: 'A swung techno pluck: two saws a few cents apart snapping shut in the 12 dB filter, chord tones on the offbeats.',
    bpm: 125,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SAW, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.7, fine1: cents(-8), fine2: cents(8), fmode: FMODE.LP12, cutoff: 0.44, res: 0.2, envAmt: 0.4, keyTrack: 0.6, fD: 0.3, fS: 0, fR: 0.2, aD: 0.5, aS: 0.2, aR: 0.24, accent: 0.45, accFlt: 0.45, width: 0.4 },
    seq: edit([R, 4, R, 7, 2, R, 6, R, R, 4, R, 7, R, 9, R, 6]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [1, 2, 1, 1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 0] }),
    extra: { xSwing: 0.35 },
  },
  {
    name: 'DISCO OCTAVES',
    cat: 'SEQ',
    desc: 'Galloping disco octaves in the middle: a square and a saw jumping an octave, long first note and two short answers, over the Munich progression.',
    bpm: 125,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.45, fine1: cents(-6), fine2: cents(6), fmode: FMODE.MOOG, cutoff: 0.44, res: 0.24, envAmt: 0.32, keyTrack: 0.5, fD: 0.32, fS: 0.1, fR: 0.2, aD: 0.42, aS: 0.35, aR: 0.18, accent: 0.45, accFlt: 0.45, width: 0.05 },
    seq: edit([0, R, 7, 7, 0, R, 7, 7, 0, R, 7, 7, 4, R, 7, 6]),
    prog: [0, 0, 1, 2],
    steps: steps({ acc: [2, 1, 1, 0], gate: [2, 1, 0, 0] }),
    extra: {},
  },
  {
    name: 'ITALO ARP',
    cat: 'SEQ',
    desc: 'An italo arpeggio climbing sevenths over two octaves in sixteenths, a pulse and a saw, through F sharp minor, D, A and E.',
    bpm: 124,
    knobs: { ...MID, rate: RATE['1/16'], mode: MODE.UP, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.42, wave1: 0.72, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.4, fine1: cents(-6), fine2: cents(6), fmode: FMODE.LP12, cutoff: 0.44, res: 0.22, envAmt: 0.3, keyTrack: 0.5, fD: 0.32, fS: 0.1, fR: 0.2, aD: 0.42, aS: 0.3, aR: 0.2, accent: 0.45, accFlt: 0.4, width: 0.4 },
    seq: AUTO,
    prog: [0, 1, 5, 2],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 1, 0] }),
    extra: {},
  },
  {
    name: 'DETROIT ARP',
    cat: 'SEQ',
    desc: 'Warm Detroit chords broken into swung sixteenths: ninths up and down, a square and a triangle, the ladder filter half open.',
    bpm: 127,
    knobs: { ...MID, rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[1], notes: NOTES(0), chord: CHORD['9TH'], gate: 0.5, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.5, fine1: cents(-5), fine2: cents(5), fmode: FMODE.MOOG, cutoff: 0.52, res: 0.22, envAmt: 0.28, keyTrack: 0.5, fD: 0.38, fS: 0.15, fR: 0.25, aD: 0.5, aS: 0.5, aR: 0.35, accent: 0.4, accFlt: 0.4, width: 0.7, wide: 0.35 },
    seq: AUTO,
    prog: [6, 4],
    steps: steps({ acc: [2, 1, 1, 0], prob: [100, 100, 100, 100, 100, 75, 100, 100, 100, 100, 100, 50] }),
    extra: { xSwing: 0.4 },
  },
  {
    name: 'RATCHET SEQ',
    cat: 'SEQ',
    desc: 'A sparse figure that stutters: a pulse wave plucked by the ladder filter, double, triple and quadruple hits inside single steps.',
    bpm: 129,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.4, wave1: 0.75, osc1: 0.9, fmode: FMODE.LP12, cutoff: 0.42, res: 0.3, envAmt: 0.36, keyTrack: 0.5, fD: 0.28, fS: 0.05, fR: 0.18, aD: 0.38, aS: 0, aR: 0.16, accent: 0.45, accFlt: 0.45, width: 0.35, wave2: WAVE2.SQUARE, range2: FEET[16], osc2: 0.35 },
    seq: edit([0, R, R, 7, R, R, 0, R, 4, R, R, 7, R, 0, R, R]),
    prog: [0],
    steps: steps({ rat: [1, 1, 1, 2, 1, 1, 3, 1, 1, 1, 1, 1, 1, 4, 1, 1], acc: [2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1] }),
    extra: {},
  },
  {
    name: 'POLYMETER SEQ',
    cat: 'SEQ',
    desc: 'Five steps against sixteen, three notes and two rests: a saw and a hollow square, the pattern landing somewhere new on every bar, one note left to chance.',
    bpm: 126,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.45, wave1: WAVE1.SAW, osc1: 0.8, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.45, fine1: cents(-4), fine2: cents(4), fmode: FMODE.LP12, cutoff: 0.48, res: 0.26, envAmt: 0.32, keyTrack: 0.6, fD: 0.34, fS: 0.05, fR: 0.2, aD: 0.45, aS: 0.25, aR: 0.2, accent: 0.4, accFlt: 0.45, width: 0.35 },
    seq: edit([0, R, 4, 7, R]),
    prog: [0, 0, 5, 5],
    steps: steps({ acc: [2, 1, 1, 0, 1], prob: [100, 100, 100, 75, 100] }),
    extra: { xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.15 },
  },
  {
    name: 'DOTTED SEQ',
    cat: 'SEQ',
    desc: 'Dotted eighths written into the notes, the echo without a delay: a saw and a triangle every three sixteenths, nine steps turning against the bar.',
    bpm: 124,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.7, wave1: WAVE1.SAW, osc1: 0.8, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.5, fine1: cents(-6), fine2: cents(6), fmode: FMODE.MOOG, cutoff: 0.43, res: 0.25, envAmt: 0.32, keyTrack: 0.6, fD: 0.42, fS: 0.2, fR: 0.28, aD: 0.55, aS: 0.4, aR: 0.28, accent: 0.4, accFlt: 0.4, width: 0.4 },
    seq: edit([7, R, R, 4, R, R, 2, R, R]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 0, 1, 1] }),
    extra: {},
  },
  {
    name: 'SYNC SEQ',
    cat: 'SEQ',
    desc: 'A hard sync lead that cuts without getting bright: the second saw locked to the first, its pitch swept over two bars, short syncopated notes.',
    bpm: 128,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.6, wave1: WAVE1.SAW, osc1: 0.6, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(5), osc2: 0.85, sync: ON, fmode: FMODE.MOOG, cutoff: 0.5, res: 0.22, envAmt: 0.3, keyTrack: 0.5, fD: 0.34, fS: 0.15, fR: 0.2, aD: 0.45, aS: 0.5, aR: 0.2, accent: 0.4, accFlt: 0.4, width: 0.45 },
    seq: edit([0, R, 0, R, R, 7, R, 0, R, 0, R, 6, R, R, 4, R]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1, 1, 2, 1, 0, 1, 1, 1, 2, 1, 1, 1, 1] }),
    extra: { xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('OSC 2 PITCH'), xLfo2Depth: 0.3 },
  },
  {
    name: 'WOOD SEQ',
    cat: 'SEQ',
    desc: 'Percussive wood for minimal grooves: a sine knocked by FM, very short, a broken figure with notes left to chance.',
    bpm: 128,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.35, wave1: 0.1, osc1: 0.95, fm: 0.2, ratio: RATIO('3'), wave2: WAVE2.SINE, range2: FEET[4], osc2: 0.75, fmode: FMODE.LP12, cutoff: 0.56, res: 0.15, envAmt: 0.3, keyTrack: 0.6, fD: 0.22, fS: 0, fR: 0.14, aD: 0.42, aS: 0, aR: 0.18, accent: 0.5, accFlt: 0.4, width: 0.4 },
    seq: edit([0, R, 4, 0, R, 7, 0, R, 0, 4, R, 7, 0, R, 2, R]),
    prog: [0],
    steps: steps({ prob: [100, 100, 75, 100, 100, 50, 100, 100, 100, 75, 100, 100, 100, 100, 50, 100], acc: [2, 1, 1, 0, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 0, 1] }),
    extra: {},
  },
  {
    name: 'DARK ARP',
    cat: 'SEQ',
    desc: 'A dark three note arpeggio falling against the bar, a pulse wave in the Korg filter, its width jumping at random, F sharp minor to C sharp minor.',
    bpm: 128,
    knobs: { ...MID, rate: RATE['1/16'], mode: MODE.DOWN, range: RANGE[1], notes: NOTES(0), chord: CHORD.TRIAD, gate: 0.4, wave1: 0.75, osc1: 0.9, fmode: FMODE.MS10, cutoff: 0.46, res: 0.4, envAmt: 0.32, keyTrack: 0.5, fD: 0.32, fS: 0.15, fR: 0.2, aD: 0.32, aS: 0, aR: 0.16, accent: 0.45, accFlt: 0.45, width: 0.15 },
    seq: AUTO,
    prog: [0, 3],
    steps: steps({ acc: [2, 1, 1] }),
    extra: { xLfo2Rate: L2RATE('1/8'), xLfo2Shape: L2SHAPE('S&H'), xLfo2Dest: L2DEST('WAVE'), xLfo2Depth: 0.2 },
  },

  /* ======================= CHORD (8) : stabs, nappes qui pulsent, drone pour les breaks ======================= */
  {
    name: 'DUB STAB',
    cat: 'CHORD',
    desc: 'The dub techno stab: two saws a fifth apart, stacked and spread, a soft decaying chord on every offbeat, the second and fourth pushed.',
    bpm: 125,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SAW, osc1: 0.9, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(7), osc2: 0.8, fine1: cents(-6), fine2: cents(6), stack: 0.2, wide: 0.3, fmode: FMODE.LP12, cutoff: 0.42, res: 0.15, envAmt: 0.3, keyTrack: 0.5, fD: 0.55, fS: 0.1, fR: 0.45, aD: 0.66, aS: 0, aR: 0.5, accent: 0.3, accFlt: 0.35, width: 0.35 },
    seq: edit([R, R, 0, R, R, R, 0, R, R, R, 0, R, R, R, 0, R]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 0, 1, 1, 1, 2, 1] }),
    extra: { xSwing: 0.25 },
  },
  {
    name: 'MINOR STAB',
    cat: 'CHORD',
    desc: 'A minor Detroit stab: a saw on the root and a square on the minor tenth, snapping shut, syncopated sixteenths over F sharp minor, B minor and C sharp minor.',
    bpm: 126,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.35, wave1: WAVE1.SAW, osc1: 0.95, wave2: WAVE2.SQUARE, range2: FEET[4], semi2: SEMI(3), osc2: 0.65, fine1: cents(-4), fine2: cents(4), fmode: FMODE.MOOG, cutoff: 0.44, res: 0.2, envAmt: 0.4, keyTrack: 0.5, fD: 0.32, fS: 0.05, fR: 0.22, aD: 0.5, aS: 0.05, aR: 0.28, accent: 0.4, accFlt: 0.45, width: 0.3 },
    seq: edit([0, R, R, 0, R, R, 0, R, R, 0, R, 0, R, R, 0, R]),
    prog: [0, 0, 4, 3],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 0, 1, 1, 1] }),
    extra: {},
  },
  {
    name: 'SEVENTH STAB',
    cat: 'CHORD',
    desc: 'A deep seventh, two long chords a bar: a soft wave and a saw a minor seventh apart in a round 12 dB filter, on the and of one and just after three, F sharp minor to B minor.',
    bpm: 124,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.9, wave1: 0.3, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[4], semi2: SEMI(-2), osc2: 0.5, fine1: cents(-5), fine2: cents(5), fmode: FMODE.LP12, cutoff: 0.42, res: 0.18, envAmt: 0.3, keyTrack: 0.5, fD: 0.48, fS: 0.15, fR: 0.38, aD: 0.7, aS: 0.2, aR: 0.6, accent: 0.35, accFlt: 0.35, width: 0.4 },
    seq: edit([R, R, 0, R, R, R, R, R, R, 0, R, R, R, R, R, R]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }),
    extra: {},
  },
  {
    name: 'ORGAN STAB',
    cat: 'CHORD',
    desc: 'A nineties house organ: two squares an octave apart over a square sub, a fast organ envelope, a stab on the and of every beat with little pickups.',
    bpm: 126,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.35, wave1: WAVE1.SQUARE, osc1: 0.8, wave2: WAVE2.SQUARE, range2: FEET[4], osc2: 0.5, fine1: cents(-3), fine2: cents(3), sub: 0.2, subWave: SUBW.SQUARE, fmode: FMODE.LP12, cutoff: 0.5, res: 0.1, envAmt: 0.15, keyTrack: 0.5, fD: 0.4, fS: 0.4, fR: 0.2, aD: 0.5, aS: 0.7, aR: 0.2, accent: 0.35, accFlt: 0.3, width: 0.3 },
    seq: edit([R, R, 0, R, R, R, 0, 2, R, R, 0, R, R, 4, R, 2]),
    prog: [0, 0, 5, 5],
    steps: steps({ acc: [1, 1, 2, 1, 1, 1, 2, 0, 1, 1, 2, 1, 1, 1, 1, 0] }),
    extra: {},
  },
  {
    name: 'GATED CHORD',
    cat: 'CHORD',
    desc: 'A held fifth chopped into a rhythm: twelve hits a bar, the gate and accent lanes carving short and long ones, a few left to chance, stacked and spread.',
    bpm: 128,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.8, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(7), osc2: 0.6, fine1: cents(-7), fine2: cents(7), stack: 0.2, fmode: FMODE.MOOG, cutoff: 0.4, res: 0.18, envAmt: 0.25, keyTrack: 0.5, fA: 0.05, fD: 0.4, fS: 0.3, fR: 0.2, aA: 0.05, aD: 0.5, aS: 0.6, aR: 0.15, accent: 0.4, accFlt: 0.35, width: 0.35, wide: 0.3 },
    seq: edit([0, 0, 0, R, 0, 0, R, 0, 0, 0, 0, R, 0, R, 0, 0]),
    prog: [0, 0, 4, 4],
    steps: steps({ gate: [2, 0, 1, 0, 2, 0, 0, 1, 2, 0, 1, 0, 3, 1, 0, 0], acc: [2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 1, 0, 1], prob: [100, 75, 100, 50, 100, 75, 100, 100, 100, 75, 100, 50, 100, 100, 75, 50] }),
    extra: {},
  },
  {
    name: 'PULSE PAD',
    cat: 'CHORD',
    desc: 'A pad that pulses: ninths arpeggiated up and down in sixteenths, two saws stacked and spread, soft attacks and tails that overlap into a moving chord.',
    bpm: 124,
    knobs: { ...MID, rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[2], notes: NOTES(0), chord: CHORD['9TH'], gate: 0.7, wave1: WAVE1.SAW, osc1: 0.75, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.6, fine1: cents(-8), fine2: cents(8), stack: 0.25, wide: 0.4, fmode: FMODE.LP12, cutoff: 0.44, res: 0.12, envAmt: 0.15, keyTrack: 0.5, fA: 0.2, fD: 0.6, fS: 0.5, fR: 0.45, aA: 0.25, aD: 0.6, aS: 0.6, aR: 0.5, accent: 0.25, accFlt: 0.2, width: 0.5, drift: 0.4 },
    seq: AUTO,
    prog: [0, 0, 1, 1],
    steps: steps({ acc: [1, 0, 1, 0] }),
    extra: {},
  },
  {
    name: 'BREAK PAD',
    cat: 'CHORD',
    desc: 'For the breakdown: slow quarter notes of a seventh chord melting together, stacked saws spread wide, the filter breathing over four bars.',
    bpm: 124,
    knobs: { ...MID, rate: RATE['1/4'], mode: MODE.UP, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.95, wave1: WAVE1.SAW, osc1: 0.75, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.7, fine1: cents(-9), fine2: cents(9), stack: 0.35, wide: 0.5, fmode: FMODE.MOOG, cutoff: 0.42, res: 0.15, envAmt: 0.2, keyTrack: 0.5, fA: 0.5, fD: 0.65, fS: 0.6, fR: 0.55, aA: 0.55, aD: 0.7, aS: 0.75, aR: 0.6, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.15, accent: 0.2, accFlt: 0.15, width: 0.6, drift: 0.5 },
    seq: AUTO,
    prog: [6, 7, 6, 4],
    steps: steps({ gate: [3, 2, 2, 3] }),
    extra: {},
  },
  {
    name: 'PULSE DRONE',
    cat: 'CHORD',
    desc: 'A drone for the break: a low fifth held without a gap, the mixer pushed into the ladder filter, the level pulsing in eighths and the cutoff moving over four bars.',
    bpm: 126,
    knobs: { ...LOW, rate: RATE['1/4'], gate: 0.95, wave1: WAVE1.SAW, osc1: 0.8, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(7), osc2: 0.7, fine1: cents(-6), fine2: cents(6), fmode: FMODE.MOOG, cutoff: 0.53, res: 0.3, envAmt: 0.1, fA: 0.3, fD: 0.6, fS: 0.9, fR: 0.5, aA: 0.4, aD: 0.6, aS: 1, aR: 0.5, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.18, accent: 0, accFlt: 0, load: 0.35, drift: 0.4 },
    seq: edit([0]),
    prog: [0],
    steps: steps({ gate: [3] }),
    extra: { ...MONO, xLfo2Rate: L2RATE('1/8'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('AMP'), xLfo2Depth: 0.35 },
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
// v50 : la matrice de l'encart LFO (section mod, xMx1..8) aussi : ses emplacements restent a OFF dans toute la banque
const NEUTRAL_SECTIONS = new Set(['reverb', 'master', 'phaser', 'flanger', 'pump', 'crush', 'old', 'space', 'matrix', 'voice', 'amp', 'dist', 'hell', 'sky', 'filter', 'mod']);
// v52 : sauf VOICE MODE (POLY ou MONO ; LEGATO jamais, analog.ts) : les basses et les lignes acides de la banque en MONO
const BANK_VOICE = new Set(['xVoiceMode']);
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
    if (BANK_VOICE.has(id)) continue;
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
  // v52 : la tonalite (xKey, xScale, instance) n'est dans aucun preset : celle du morceau reste
  for (const e of EXTRA) if (!e.instance) extra[e.id] = cleanExtra(e.id, ex[e.id]);
  // Les regles du son analogique (analog.ts) : aucun effet, le filtre modere, pas trop aigu
  const faults = analogFaults(knobs, extra, EXTRA_STEPS);
  if (faults.length) throw new Error(`${p.name} : ${faults.join(' ; ')}`);
  // et ce qui doit rester exactement au neutre (la reverbe BigSky sur CLASSIC, HELL entier, la DISTO, la pedale...)
  for (const e of EXTRA) {
    if (e.id === 'xSkyType' || e.id === 'xQuality' || BANK_VOICE.has(e.id)) continue;
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
