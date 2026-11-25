#!/usr/bin/env node
/**
 * MM-ARP, la banque d'usine du VST3 (2026-11-10, Mika : "les presets pourraient etre meilleurs, c'est un peu toujours
 * pareil ! Je veux plus de presets a la Donna Summer, genre disco, ou alors des trucs hypnotiques"). Le VST3 seul : les
 * presets du site (src/v4/state/factory.ts) ne changent pas. Refaite le 2026-11-11 (40 presets, le sequenceur par pas),
 * revue le 2026-11-18 (v28 : BASS 16, ARP 12, PAD 6, DARK 6), refaite le 2026-11-20 (v43, Mika : "Tous les presets
 * doivent sonner absolument parfait ! sans filtre pas trop aigu ... que ca sonne vraiment bon synth analog ! evite les fx
 * sur tous les presets ! ou des filtres, si tu en utilises alors pas trop intense !" : un synthe analogique a sec),
 * refaite le 2026-11-24 (v52, Mika : "Les presets ne sont pas assez bons ! ca doit etre vraiment super super bons comme
 * ca et doit s'associer facilement a de la musique techno" : 40 presets techno, BPM 124 a 132, BASS / ACID / SEQ /
 * CHORD, BASS et ACID en MONO).
 *
 * Refaite le 2026-11-25 (v53, la banque DARK DISCO). Mika, sur la banque techno : "pas fan du tout des presets", pas son
 * style ; "analyse quelques tracks que j'aime beaucoup mais surtout quelque chose qui soit hypnotique... que je peux
 * deformer a ma guise.. pour le dark disco c'est souvent une note repetee .. ecoute les tracks de Damon Jee par exemple..
 * sinon des trucs qui peuvent se deriver comme du disco Donna Summer par exemple ou Pablo Bozzi, des trucs dans le genre
 * ..!" ; "oui effets doses, pas beaucoup pour pas trop denaturer le son.. faut que les presets soient des bons sons de
 * base que je peux tweaker pour arriver a ce que j'aime .. souvent c'est des notes style basslines" ; "mieux vaut avoir
 * plus de choix que pas assez". Lui : dark disco, indie dance, minimal hypnotique ; F# mineur, 123 BPM ; Dreadbox Typhon
 * et Artemis, Minilogue XD.
 *   - 80 presets, quatre familles (les quatre colonnes de LIBRARY) : BASS 42 (la note repetee hypnotique, le galop munichois
 *     croches + echo a la double croche, les octaves italo et hi-NRG, les basses qui rebondissent et glissent de l'Italo
 *     Body Music, l'EBM entre les kicks, la new beat lente), SEQ 20 (sequences et arpeges hypnotiques du medium), LEAD 10
 *     (lignes et stabs), PAD 8 (nappes et drones). Aucun nom d'artiste ni de morceau.
 *   - BPM 105 a 124, la plupart 115 a 123 (le dark disco et l'italo vers 115 a 125, la new beat 100 a 115 : les sources
 *     sont dans docs/reports/2026-11-25-mm-arp-banque-dark-disco.md).
 *   - Des sons de BASE a deformer : le filtre a mi-course (CUTOFF 0.3 a 0.5 le plus souvent), ENV AMT et RES moderes, des
 *     enveloppes du milieu de leur course : de la marge dans les deux sens pour les potards de Mika. Un geste par preset,
 *     une boucle qui tourne (un accord, ou deux qui bougent peu dans le grave).
 *   - Le grave (v52, garde) : BASS en VOICE MODE MONO (le SLIDE glisse dans la meme voix), WIDTH 0, BASS MONO 0.62 au moins
 *     (135 Hz) ; aucune reverbe sur une basse.
 *
 * LES REGLES (v43, v52, v53 ; verifiees ici a l'ecriture et par tests/presets-check.mjs ; les memes pour RANDOM de la face,
 * toutes dans src/v4/plugin/arp/analog.ts) :
 *   - v53 : EFFETS LEGERS BORNES (analog.ts ANALOG_FX ; la regle v43 "AUCUN effet" levee, a la demande de Mika) :
 *     OVERDRIVE 0.25 au plus (style MM de la DISTO : la saturation du moteur), GLUE 0.3, CHORUS I ou II (le Juno),
 *     WARMTH 0.3 ; DELAY (MIX) 0.3 au plus, cale au tempo (1/16, 1/8 ou 1/4, droit, pointe ou triolet), TAPE / ANALOG /
 *     DIGITAL, SINGLE / DUAL / PING-PONG, FEEDBACK 0.45, WOBBLE 0.35, LOW CUT et HIGH CUT pour couper seulement ; REVERB
 *     0.18 au plus, CLASSIC, courte (SIZE 0.4 : 1.8 s), sombre (TONE 0.5), jamais sur une basse. Beaucoup de presets
 *     restent secs : l'effet sert le son, il ne le cache pas.
 *   - toujours a l'arret : TAPE (OLD TAPE), SIDECHAIN, PHASER, FLANGER, PUMP, CRUSH, SHIMMER, HELL, RING, FOLD, HIGH PASS,
 *     COMB ; la DISTO (style MM), l'EQ 6 bandes, le MASTER (BASS, AIR, WIDTH), la matrice, BEND RANGE et AMP a leur neutre ;
 *     VOICE MODE POLY ou MONO (v52) ;
 *   - le filtre : un passe-bas (MOOG, LP12, MS-10), CUTOFF 0.25 a 0.6, RES 0.45 au plus, ENV AMT 0.5 au plus, jamais
 *     ouvert au-dela de 6 kHz par l'enveloppe, ACC FILTER 0.6 au plus, les LFO sur la coupure ou la resonance a 0.25 ;
 *   - pas trop aigu : OCTAVE 0 au plus, RANGE 4' au plus, FM 0.2, NOISE 0.12, vibrato 0.08 au plus.
 * Les cibles mesurees hors ligne (tests/presets_render.cpp, 8 mesures, CLASSIC HQ et PRO STD, aucun son joue ; le code de
 * sortie les verifie) : crete sous -3 dBFS ; sonie -23 LUFS a 0.7 LU pres (-24 pour la famille PAD) ; DC sous -60 dBFS ;
 * part au-dessus de 6 kHz sous 0.5 % ; centroide 150 a 500 Hz (BASS), 350 a 1000 Hz (SEQ, PAD), 300 a 1100 Hz (LEAD) ;
 * bas-medium (120-500 Hz) au moins 30 % ; BASS mono sous 120 Hz ; diversite D 2.4 et DS 1.6 au moins.
 *
 * Source unique de la banque : ce fichier ecrit
 *   - plugin/mm-arp/presets/factory.json        { v: 1, presets: [ { name, cat, desc, bpm, knobs, seq, prog, extra, steps } ] }
 *   - plugin/mm-arp/presets/factory/NN NOM.mmarp  le meme preset au format disque du plugin (src/v4/plugin/arp/disk.ts)
 *
 *   node plugin/mm-arp/presets/build.mjs           (ecrit)
 *   node plugin/mm-arp/presets/build.mjs --check   (verifie que les fichiers sont a jour, n'ecrit rien)
 *
 * Les 62 potards partent des valeurs de depart de src/v4/voyager/params.ts (lu tel quel : Node retire les types), puis
 * BASE (le neutre de la banque : OSC 2 coupe, tous les effets a l'arret), puis ceux du preset, puis ses effets (p.fx) ;
 * tout est arrondi comme voyParams.set (clean : un cran sur i / (n - 1), un continu au millieme). Les reglages du VST3
 * seul partent de plugin/mm-arp/extra-params.json, les pistes par pas des valeurs de depart de src/v4/plugin/arp/steps.ts.
 * Le rendu de verification : plugin/mm-arp/tests/presets-render.sh.
 *
 * VOLUME : cale par le rendu hors ligne (tests/presets_render.cpp --calibrate presets/volumes.json : la sonie ponderee
 * K de chaque preset sur 8 mesures, vers -23 LUFS). Recaler apres un changement de son :
 *   plugin/mm-arp/presets/calibrate.sh
 */


import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOY_KNOBS } from '../../../src/v4/voyager/params.ts';
import { analogFaults, ANALOG_DL_NEUTRAL, ANALOG_FX_OFF, ANALOG_FX_OFF_EXTRA, ANALOG_STEPS } from '../../../src/v4/plugin/arp/analog.ts';

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
 * Reperes : un degre est compte dans fa diese mineur depuis la racine de l'accord (0 racine, 1 seconde, 2 tierce, 3
 * quarte, 4 quinte, 6 septieme, 7 octave, -1 la septieme en dessous, -3 la quinte en dessous). La racine est posee vers fa
 * diese 3 (185 Hz) : OCTAVE -1 la descend vers fa diese 2 (92 Hz), le registre des basses, et le SUB a -1 vers fa diese 1
 * (46 Hz). Accords (indices du site) : 0 F#m, 1 D, 2 E, 3 C#m, 4 Bm, 5 A, 6 F#m7, 7 Dmaj7 ; une mesure par accord. La
 * tonalite est celle de l'instance (xKey, xScale : F# MINOR au depart) : les degres suivent.
 *
 * v53 : un geste par preset ; les basses restent sur un accord, ou deux qui montent peu (A : +3, Bm : +5) ; quelques
 * lignes disco et italo font le tour i - VI - VII (F#m, D, E). BASS en MONO (une voix, le SLIDE glisse), centrees (WIDTH
 * 0) et mono sous 135 Hz (BASS MONO 0.62).
 */

/** VOICE MODE (extra-params.json) : POLY, MONO ; LEGATO jamais (analog.ts). */
const VOICE = (n) => exStep('xVoiceMode', n);
const MONO = { xVoiceMode: VOICE('MONO') };
/** Le socle des basses : OCTAVE -1, au centre, mono sous 135 Hz, une phase de depart fixe. */
const LOW = { octave: OCT(-1), range1: FEET[8], width: 0, wide: 0, space: 0, stack: 0, monoLow: 0.62, phase: 0.3, drift: 0.22, keyTrack: 0.5 };
/** Le socle du medium (SEQ, LEAD, PAD) : OCTAVE 0, BASS MONO coupe (rien sous 120 Hz). */
const MID = { octave: OCT(0), range1: FEET[8], monoLow: 0, phase: 0, drift: 0.3 };
/** n fois la meme valeur (une piste, une suite). */
const rep = (n, x) => Array.from({ length: n }, () => x);
/** LFO 2 (le VST3 seul) : vitesse, forme, cible, profondeur. */
const LFO2 = (rate, shape, dest, depth) => ({ xLfo2Rate: L2RATE(rate), xLfo2Shape: L2SHAPE(shape), xLfo2Dest: L2DEST(dest), xLfo2Depth: depth });

const BANK = [
  /* ============ BASS (42) : la note repetee, le galop munichois, l'italo, le rebond, l'EBM, la new beat ============ */

  /* --- la note repetee (le dark disco : une note, la boucle qui hypnotise) --- */
  {
    name: 'REPEAT BASS',
    cat: 'BASS',
    desc: 'The dark disco staple: one note repeated in sixteenths, a saw over a sine sub in the ladder filter, the offbeat sixteenth pushed. Open the cutoff to make it bite.',
    bpm: 122,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.42, wave1: WAVE1.SAW, osc1: 0.92, sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.47, res: 0.22, envAmt: 0.32, fD: 0.44, fS: 0.05, fR: 0.15, aD: 0.45, aS: 0.35, aR: 0.14, accent: 0.4, accFlt: 0.45, load: 0.2 },
    seq: edit([0]),
    prog: [0],
    steps: steps({ acc: [1, 0, 2, 0] }),
    extra: { ...MONO },
  },
  {
    name: 'OFFBEAT REPEAT',
    cat: 'BASS',
    desc: 'Three sixteenths after every kick on one note, a hollow pulse wave through the Korg filter, short and dry, the first hit after the kick pushed.',
    bpm: 121,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.38, wave1: 0.78, osc1: 0.95, sub: 0.34, subWave: SUBW.SINE, fmode: FMODE.MS10, cutoff: 0.46, res: 0.3, envAmt: 0.34, fD: 0.36, fS: 0, fR: 0.14, aD: 0.42, aS: 0.2, aR: 0.13, accent: 0.4, accFlt: 0.5, load: 0.15 },
    seq: edit([R, 0, 0, 0]),
    prog: [0],
    steps: steps({ acc: [1, 2, 1, 0] }),
    extra: { ...MONO },
  },
  {
    name: 'EIGHTH PULSE',
    cat: 'BASS',
    desc: 'A round new wave pulse: straight eighths on one note, a saw in a resonant 12 dB filter that thumps, a Juno chorus and a touch of warmth on top.',
    bpm: 118,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.6, wave1: 0.4, osc1: 0.92, sub: 0.36, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.45, res: 0.4, envAmt: 0.26, fD: 0.5, fS: 0.2, fR: 0.2, aD: 0.55, aS: 0.55, aR: 0.18, accent: 0.3, accFlt: 0.35, load: 0.1, monoLow: 0.9 },
    seq: edit([0]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1] }),
    extra: { ...MONO },
    fx: { chorus: 1, warmth: 0.15 },
  },
  {
    name: 'LONG REPEAT',
    cat: 'BASS',
    desc: 'One note in sixteenths that never stops, long notes of a pulse and a square a few cents apart, the cutoff breathing slowly over eight bars: leave it running and ride the filter.',
    bpm: 120,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.78, wave1: 0.76, osc1: 0.88, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.45, fine1: cents(-5), fine2: cents(5), sub: 0.26, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.46, res: 0.28, envAmt: 0.26, fD: 0.5, fS: 0.3, fR: 0.15, aD: 0.55, aS: 0.65, aR: 0.14, accent: 0.3, accFlt: 0.4, load: 0.15 },
    seq: edit([0]),
    prog: [0],
    steps: steps({ acc: [2, 0, 1, 0] }),
    extra: { ...MONO, ...LFO2('8 BAR', 'SINE', 'CUTOFF', 0.22), xLfo2Depth: 0.25 },
  },
  {
    name: 'GHOST REPEAT',
    cat: 'BASS',
    desc: 'One note with ghosts: a loud sixteenth, a soft one, a rest and a pickup, some soft ones left to chance, a hollow pulse in a resonant Korg filter that the accents open.',
    bpm: 119,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.4, wave1: 0.7, osc1: 0.92, sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.MS10, cutoff: 0.42, res: 0.38, envAmt: 0.34, fD: 0.38, fS: 0.05, fR: 0.14, aD: 0.42, aS: 0.2, aR: 0.13, accent: 0.7, accFlt: 0.6, load: 0.1 },
    seq: edit([0, 0, R, 0]),
    prog: [0],
    steps: steps({ acc: [2, 0, 1, 0], gate: [1, 0, 1, 0], prob: [100, 75, 100, 50, 100, 100, 100, 75] }),
    extra: { ...MONO },
  },
  {
    name: 'OFFBEAT EIGHTHS',
    cat: 'BASS',
    desc: 'The disco offbeat: one note on every and, nothing on the kick, a narrow pulse over a deep sine sub in the ladder filter, a little overdrive for weight.',
    bpm: 122,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.6, wave1: 0.8, osc1: 0.9, sub: 0.42, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.44, res: 0.25, envAmt: 0.3, fD: 0.48, fS: 0.15, fR: 0.18, aD: 0.52, aS: 0.5, aR: 0.16, accent: 0.3, accFlt: 0.35, load: 0.3 },
    seq: edit([R, 0]),
    prog: [0],
    steps: steps({ acc: [1, 1, 1, 1, 1, 1, 1, 2] }),
    extra: { ...MONO },
    fx: { drive: 0.12 },
  },
  {
    name: 'CHUG BASS',
    cat: 'BASS',
    desc: 'A chugging single note: very short sixteenths, the Korg filter a little resonant and slapped by its envelope, the mixer and the overdrive pushed.',
    bpm: 115,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.28, wave1: WAVE1.SAW, osc1: 0.95, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.35, fine1: cents(-3), fine2: cents(3), sub: 0.32, subWave: SUBW.SINE, fmode: FMODE.MS10, cutoff: 0.42, res: 0.36, envAmt: 0.42, fD: 0.34, fS: 0, fR: 0.12, aD: 0.38, aS: 0, aR: 0.12, accent: 0.4, accFlt: 0.5, load: 0.3 },
    seq: edit([0]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1] }),
    extra: { ...MONO },
    fx: { drive: 0.18 },
  },
  {
    name: 'THREE REPEAT',
    cat: 'BASS',
    desc: 'Two notes and a breath, three steps turning against the bar, the accent wandering across the beat: two saws a few cents apart in a resonant 12 dB filter, a Juno chorus.',
    bpm: 119,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.44, wave1: WAVE1.SAW, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.6, fine1: cents(-6), fine2: cents(6), sub: 0.26, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.44, res: 0.34, envAmt: 0.32, fD: 0.4, fS: 0.05, fR: 0.15, aD: 0.45, aS: 0.3, aR: 0.14, accent: 0.6, accFlt: 0.55, load: 0.1, monoLow: 0.9 },
    seq: edit([0, 0, R]),
    prog: [0],
    steps: steps({ acc: [2, 0, 0], gate: [2, 0, 0] }),
    extra: { ...MONO },
    fx: { chorus: 1 },
  },
  {
    name: 'SWING REPEAT',
    cat: 'BASS',
    desc: 'A swung pluck on one note: three sixteenths and a breath on every beat, pushed late, a square with a saw an octave above snapping shut in the 12 dB filter, the cutoff swaying over two bars.',
    bpm: 116,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.46, wave1: WAVE1.SQUARE, osc1: 0.9, sub: 0.34, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.52, res: 0.2, envAmt: 0.3, fD: 0.42, fS: 0, fR: 0.15, aD: 0.42, aS: 0, aR: 0.15, accent: 0.4, accFlt: 0.4, load: 0.12, wave2: WAVE2.SAW, range2: FEET[4], osc2: 0.5, fine1: cents(-7), fine2: cents(7) },
    seq: edit([0, 0, 0, R]),
    prog: [0],
    steps: steps({ acc: [1, 0, 1, 2] }),
    extra: { ...MONO, xSwing: 0.5, xLfo2Rate: L2RATE('2 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.22 },
  },
  {
    name: 'FIFTH REPEAT',
    cat: 'BASS',
    desc: 'The root repeated three times and the fifth on the last sixteenth of every beat, a narrow pulse over a sine sub, a quiet dotted echo on the top.',
    bpm: 121,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.42, wave1: 0.76, osc1: 0.95, sub: 0.36, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.5, res: 0.25, envAmt: 0.36, fD: 0.4, fS: 0.05, fR: 0.14, aD: 0.44, aS: 0.3, aR: 0.13, accent: 0.4, accFlt: 0.45, load: 0.18 },
    seq: edit([0, 0, 0, 4]),
    prog: [0],
    steps: steps({ acc: [2, 0, 1, 1] }),
    extra: { ...MONO },
    fx: { echo: ['1/8', 'DOTTED', 0.26, 0.2, { style: 'ANALOG', mode: 'PING-PONG', high: 0.4, low: 0.6 }] },
  },
  {
    name: 'FALLING REPEAT',
    cat: 'BASS',
    desc: 'Eighths on the root for three beats, the fourth falling to the seventh below: a narrow pulse and a square swelling in softly through the 12 dB filter, warm and round.',
    bpm: 118,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.75, wave1: 0.72, osc1: 0.9, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.4, fine1: cents(-4), fine2: cents(4), sub: 0, fmode: FMODE.LP12, cutoff: 0.48, res: 0.2, envAmt: 0.32, fD: 0.42, fS: 0.08, fR: 0.15, aD: 0.46, aS: 0.5, aR: 0.14, accent: 0.35, accFlt: 0.45, load: 0.15, aA: 0.35, fA: 0.3 },
    seq: edit([0, 0, 0, 0, 0, 0, -1, -1]),
    prog: [0, 0, 0, 0],
    steps: steps({ acc: [2, 0, 1, 0] }),
    extra: { ...MONO },
    fx: { warmth: 0.2 },
  },
  {
    name: 'SUB HYPNO',
    cat: 'BASS',
    desc: 'Minimal and deep: a hollow wave between square and pulse over a big sine sub, three steps turning against the bar, the note and its octave.',
    bpm: 120,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.55, wave1: 0.66, osc1: 0.95, sub: 0.5, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.5, res: 0.2, envAmt: 0.22, fD: 0.45, fS: 0.3, fR: 0.2, aD: 0.5, aS: 0.55, aR: 0.18, accent: 0.3, accFlt: 0.3, load: 0.4, fm: 0, ratio: RATIO('2') },
    seq: edit([0, R, 7]),
    prog: [0],
    steps: steps({ acc: [2, 1, 0] }),
    extra: { ...MONO },
  },

  /* --- Munich : les croches doublees par un echo a la double croche, le galop --- */
  {
    name: 'MUNICH GALLOP',
    cat: 'BASS',
    desc: 'The 1977 Munich gallop written into the notes: every eighth doubled a sixteenth later and softer, root, octave, fifth and seventh, a saw and a square plucked shut.',
    bpm: 124,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SAW, osc1: 0.95, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.5, fine1: cents(-4), fine2: cents(4), sub: 0.22, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.36, res: 0.18, envAmt: 0.4, fD: 0.6, fS: 0, fR: 0.16, aD: 0.56, aS: 0, aR: 0.15, accent: 0.5, accFlt: 0.45, load: 0.1 },
    seq: edit([0, 0, 7, 7, 4, 4, 6, 6]),
    prog: [0, 0, 1, 2],
    steps: steps({ acc: [2, 0] }),
    extra: { ...MONO },
  },
  {
    name: 'MUNICH ECHO',
    cat: 'BASS',
    desc: 'Straight eighths and a real echo a sixteenth later that bounces left and right: the gallop comes from the delay. Turn DELAY up for the full effect, down for plain eighths.',
    bpm: 124,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.42, wave1: WAVE1.SAW, osc1: 0.92, wave2: WAVE2.PULSE, range2: FEET[16], osc2: 0.45, fine1: cents(-3), fine2: cents(3), sub: 0.2, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.38, res: 0.16, envAmt: 0.38, fD: 0.62, fS: 0, fR: 0.16, aD: 0.58, aS: 0, aR: 0.15, accent: 0.4, accFlt: 0.4, load: 0.12 },
    seq: edit([0, 7, 4, 6]),
    prog: [0, 0, 5, 5],
    steps: steps({ acc: [2, 1, 1, 1] }),
    extra: { ...MONO },
    fx: { echo: ['1/16', 'STRAIGHT', 0.3, 0.05, { style: 'DIGITAL', mode: 'PING-PONG', high: 0.5 }] },
  },
  {
    name: 'GALLOP BASS',
    cat: 'BASS',
    desc: 'The disco gallop on one note: one, and, a, the rest between, a saw thumping in a resonant ladder filter with a little warmth, an octave pair closing the bar, a quiet dotted echo.',
    bpm: 122,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.6, wave1: WAVE1.SAW, osc1: 0.9, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0, fine1: cents(-5), fine2: cents(5), sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.44, res: 0.38, envAmt: 0.34, fD: 0.42, fS: 0.05, fR: 0.15, aD: 0.46, aS: 0.5, aR: 0.14, accent: 0.45, accFlt: 0.45, load: 0.1 },
    seq: edit([0, R, 0, 0, 0, R, 0, 0, 0, R, 0, 0, 0, R, 7, 7]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 0] }),
    extra: { ...MONO, xSwing: 0.15 },
    fx: { warmth: 0.25, echo: ['1/8', 'DOTTED', 0.15, 0.2, { style: 'ANALOG', mode: 'PING-PONG', high: 0.4, low: 0.6 }] },
  },
  {
    name: 'HI-NRG OCTAVES',
    cat: 'BASS',
    desc: 'High energy octaves: root and octave in sixteenths without a gap, a short square in the ladder filter, F sharp minor then A.',
    bpm: 124,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.36, wave1: WAVE1.SQUARE, osc1: 0.95, sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.4, res: 0.2, envAmt: 0.36, fD: 0.36, fS: 0, fR: 0.13, aD: 0.4, aS: 0.2, aR: 0.12, accent: 0.4, accFlt: 0.45, load: 0.1 },
    seq: edit([0, 7]),
    prog: [0, 0, 5, 5],
    steps: steps({ acc: [2, 1, 1, 1] }),
    extra: { ...MONO },
  },
  {
    name: 'ROLLING TRIPLETS',
    cat: 'BASS',
    desc: 'Eighths with the offbeat split in three: a rolling gallop on one note, a saw over a sine sub in a resonant ladder filter, a Juno chorus, the octave in the last roll.',
    bpm: 121,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.95, sub: 0.34, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.46, res: 0.3, envAmt: 0.34, fD: 0.34, fS: 0.05, fR: 0.14, aD: 0.4, aS: 0.35, aR: 0.13, accent: 0.4, accFlt: 0.45, load: 0.15, monoLow: 0.9 },
    seq: edit([0, 0, 0, 0, 0, 0, 0, 7]),
    prog: [0],
    steps: steps({ rat: [1, 3], acc: [2, 1] }),
    extra: { ...MONO },
    fx: { chorus: 1 },
  },
  {
    name: 'DISCO OCTAVES',
    cat: 'BASS',
    desc: 'Disco octaves in eighths through F sharp minor, D and E: a square and a saw, a short slide up into the octave closing every second bar.',
    bpm: 119,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.55, wave1: WAVE1.SQUARE, osc1: 0.88, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.35, fine1: cents(-6), fine2: cents(6), sub: 0.36, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.42, res: 0.2, envAmt: 0.3, fD: 0.45, fS: 0.15, fR: 0.18, aD: 0.5, aS: 0.5, aR: 0.16, accent: 0.4, accFlt: 0.4, load: 0.1 },
    seq: edit([0, 7]),
    prog: [0, 1, 2, 0],
    steps: steps({ slide: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0], acc: [2, 1] }),
    extra: { ...MONO },
  },
  {
    name: 'SPACE DISCO',
    cat: 'BASS',
    desc: 'Space disco: a saw and a triangle bouncing root and octave, a Juno chorus and a quiet dotted echo making it float above the kick.',
    bpm: 117,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.45, wave1: WAVE1.SAW, osc1: 0.88, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.5, fine1: cents(-6), fine2: cents(6), sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.46, res: 0.2, envAmt: 0.33, fD: 0.45, fS: 0.05, fR: 0.18, aD: 0.48, aS: 0.3, aR: 0.16, accent: 0.4, accFlt: 0.4, load: 0.1, monoLow: 0.9 },
    seq: edit([0, R, 7, R, 0, 0, 7, R, 0, R, 7, R, 0, 4, 6, R]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1, 1, 0, 1, 1] }),
    extra: { ...MONO },
    fx: { chorus: 1, echo: ['1/8', 'DOTTED', 0.16, 0.25, { style: 'ANALOG', mode: 'PING-PONG', high: 0.4 }] },
  },
  {
    name: 'STRUT BASS',
    cat: 'BASS',
    desc: 'A slow disco strut: syncopated root and octave with a glide into the last notes, a round saw in the ladder filter, room between the notes.',
    bpm: 115,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.6, wave1: 0.36, osc1: 0.92, sub: 0.34, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.42, res: 0.18, envAmt: 0.3, fD: 0.5, fS: 0.15, fR: 0.18, aD: 0.55, aS: 0.5, aR: 0.16, accent: 0.4, accFlt: 0.4, load: 0.15 },
    seq: edit([0, R, R, 0, R, R, 7, R, 0, R, 4, R, 6, R, 7, R]),
    prog: [0, 0, 4, 4],
    steps: steps({ slide: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0], acc: [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1] }),
    extra: { ...MONO },
  },

  /* --- l'italo : la basse a l'octave, les croches pointees, le chorus --- */
  {
    name: 'ITALO OCTAVES',
    cat: 'BASS',
    desc: 'The italo octave bass: root, root, octave, root in sixteenths, a saw with a Juno chorus, through F sharp minor, D, E and back.',
    bpm: 120,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.42, wave1: WAVE1.SAW, osc1: 0.92, sub: 0.28, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.38, res: 0.2, envAmt: 0.36, fD: 0.4, fS: 0.05, fR: 0.15, aD: 0.44, aS: 0.3, aR: 0.14, accent: 0.4, accFlt: 0.45, load: 0.12, monoLow: 0.9 },
    seq: edit([0, 0, 7, 0]),
    prog: [0, 1, 2, 0],
    steps: steps({ acc: [2, 0, 1, 0] }),
    extra: { ...MONO },
    fx: { chorus: 1 },
  },
  {
    name: 'ITALO DOTTED',
    cat: 'BASS',
    desc: 'Dotted eighths in the italo way, three three two: a pulse wave jumping to the octave, F sharp minor to D, a small chorus.',
    bpm: 118,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.55, wave1: 0.72, osc1: 0.92, sub: 0.32, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.42, res: 0.22, envAmt: 0.32, fD: 0.46, fS: 0.1, fR: 0.16, aD: 0.5, aS: 0.4, aR: 0.15, accent: 0.4, accFlt: 0.4, load: 0.1, monoLow: 0.9 },
    seq: edit([0, R, R, 7, R, R, 0, R]),
    prog: [0, 0, 1, 1],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 1, 0] }),
    extra: { ...MONO },
    fx: { chorus: 1 },
  },
  {
    name: 'ITALO RUNNER',
    cat: 'BASS',
    desc: 'A running italo line: octave pairs in sixteenths, root root octave octave, a square and a pulse in the 12 dB filter with a Juno chorus.',
    bpm: 122,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.PULSE, range2: FEET[8], osc2: 0.45, fine1: cents(-5), fine2: cents(5), sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.4, res: 0.26, envAmt: 0.34, fD: 0.36, fS: 0.05, fR: 0.14, aD: 0.42, aS: 0.25, aR: 0.13, accent: 0.45, accFlt: 0.45, load: 0.1, monoLow: 0.9 },
    seq: edit([0, 0, 7, 7]),
    prog: [0, 0, 5, 4],
    steps: steps({ acc: [2, 0, 1, 0] }),
    extra: { ...MONO },
    fx: { chorus: 1 },
  },
  {
    name: 'COSMIC BASS',
    cat: 'BASS',
    desc: 'Cosmic disco eighths that glide: root and octave with a slow portamento, a soft saw in the 12 dB filter, chorus and warmth.',
    bpm: 116,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.7, glide: 0.18, wave1: 0.34, osc1: 0.9, sub: 0.34, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.43, res: 0.18, envAmt: 0.28, fD: 0.5, fS: 0.25, fR: 0.2, aD: 0.55, aS: 0.6, aR: 0.18, accent: 0.3, accFlt: 0.35, load: 0.12, monoLow: 0.9 },
    seq: edit([0, 7, 0, 7, 0, 7, 4, 6]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1] }),
    extra: { ...MONO },
    fx: { chorus: 1, warmth: 0.2 },
  },
  {
    name: 'MIDNIGHT BASS',
    cat: 'BASS',
    desc: 'Late night italo: sparse sixteenths around the root, the octave and the fifth, a square and a saw with a Juno chorus, a dark dotted tape echo behind.',
    bpm: 113,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.62, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.4, fine1: cents(-5), fine2: cents(5), sub: 0.34, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.4, res: 0.2, envAmt: 0.3, fD: 0.5, fS: 0.15, fR: 0.2, aD: 0.55, aS: 0.45, aR: 0.18, accent: 0.35, accFlt: 0.4, load: 0.12, monoLow: 0.9 },
    seq: edit([0, R, 0, R, R, 7, R, 0, R, 0, R, 4, R, R, 6, R]),
    prog: [0, 0, 1, 1],
    steps: steps({ acc: [2, 1, 1, 1, 1, 2, 1, 1] }),
    extra: { ...MONO },
    fx: { chorus: 1, echo: ['1/8', 'DOTTED', 0.18, 0.3, { style: 'TAPE', mode: 'PING-PONG', wobble: 0.15, high: 0.35 }] },
  },
  {
    name: 'BOWED FIFTHS',
    cat: 'BASS',
    desc: 'Root, fifth, octave, fifth in eighths with soft bowed attacks, a saw in the ladder filter swaying over four bars, slightly swung, F sharp minor to B minor.',
    bpm: 120,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.75, wave1: WAVE1.SAW, osc1: 0.95, sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.42, res: 0.22, envAmt: 0.38, fD: 0.38, fS: 0, fR: 0.14, aD: 0.5, aS: 0.5, aR: 0.13, accent: 0.4, accFlt: 0.45, load: 0.15, aA: 0.45, fA: 0.4 },
    seq: edit([0, 4, 7, 4, 0, 4, 6, 4]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [1, 1, 2, 0] }),
    extra: { ...MONO, xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('TRI'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.2, xSwing: 0.35 },
  },

  /* --- le rebond (Italo Body Music : l'octave qui saute et glisse, la peau de l'EBM) --- */
  {
    name: 'RUBBER BASS',
    cat: 'BASS',
    desc: 'A rubber bass that bounces and slides into its octaves, syncopated against the kick, a saw and a square in the 12 dB filter with a Juno chorus.',
    bpm: 122,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.9, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.45, fine1: cents(-4), fine2: cents(4), sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.41, res: 0.24, envAmt: 0.34, fD: 0.42, fS: 0.08, fR: 0.15, aD: 0.48, aS: 0.4, aR: 0.14, accent: 0.45, accFlt: 0.5, load: 0.12, monoLow: 0.9 },
    seq: edit([0, R, 7, R, R, 0, R, 7, 0, R, 7, 0, R, 4, R, 7]),
    prog: [0],
    steps: steps({ slide: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1], acc: [2, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 0, 1, 1, 1, 2] }),
    extra: { ...MONO },
    fx: { chorus: 1 },
  },
  {
    name: 'BOUNCE BASS',
    cat: 'BASS',
    desc: 'Body music bounce: short hard notes jumping between root and octave, a square snapping in a resonant 12 dB filter, three on the beat and one off it.',
    bpm: 123,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.34, wave1: WAVE1.SQUARE, osc1: 0.95, sub: 0.32, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.48, res: 0.3, envAmt: 0.4, fD: 0.32, fS: 0, fR: 0.12, aD: 0.4, aS: 0.15, aR: 0.12, accent: 0.38, accFlt: 0.5, load: 0.2 },
    seq: edit([0, R, 0, 7, R, 0, 7, R]),
    prog: [0, 0, 5, 5],
    steps: steps({ acc: [2, 1, 1, 2, 1, 1, 1, 1] }),
    extra: { ...MONO },
  },
  {
    name: 'BODY BOUNCE',
    cat: 'BASS',
    desc: 'Italo melody on an EBM body: sixteenths after the kick hopping root and octave, a saw and a square in the ladder filter, a little overdrive, a short echo bouncing on the top.',
    bpm: 124,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.36, wave1: WAVE1.SAW, osc1: 0.9, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.35, fine1: cents(-3), fine2: cents(3), sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.5, res: 0.36, envAmt: 0.42, fD: 0.34, fS: 0, fR: 0.12, aD: 0.4, aS: 0.2, aR: 0.12, accent: 0.4, accFlt: 0.5, load: 0.2 },
    seq: edit([0, R, 7, R, R, 0, 7, 0, 0, R, 7, R, R, 4, 6, 7]),
    prog: [0],
    steps: steps({ acc: [1, 2, 1, 0] }),
    extra: { ...MONO },
    fx: { drive: 0.2, echo: ['1/8', 'STRAIGHT', 0.2, 0.15, { style: 'DIGITAL', mode: 'PING-PONG', high: 0.4, low: 0.65 }] },
  },
  {
    name: 'ELASTIC BASS',
    cat: 'BASS',
    desc: 'Elastic eighths: every note glides into the next, root, octave, fifth, octave, a soft square over a sine sub in the ladder filter.',
    bpm: 118,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.75, glide: 0.25, wave1: 0.55, osc1: 0.92, sub: 0.36, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.42, res: 0.22, envAmt: 0.3, fD: 0.48, fS: 0.2, fR: 0.18, aD: 0.55, aS: 0.55, aR: 0.16, accent: 0.4, accFlt: 0.4, load: 0.12 },
    seq: edit([0, 7, 4, 7, 0, 7, 6, 7]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1, 2, 1, 1, 0] }),
    extra: { ...MONO },
  },
  {
    name: 'SLIDE OCTAVE',
    cat: 'BASS',
    desc: 'Dotted notes that slide up to the octave and back, three three two, a wave between saw and square in a resonant 12 dB filter, long and rubbery, a little warmth.',
    bpm: 121,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.8, wave1: 0.45, osc1: 0.92, sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.46, res: 0.42, envAmt: 0.38, fD: 0.45, fS: 0.1, fR: 0.16, aD: 0.5, aS: 0.7, aR: 0.15, accent: 0.4, accFlt: 0.45, load: 0.15, glide: 0.2 },
    seq: edit([0, R, R, 7, R, R, 0, R, R, 7, R, R, 0, R, 7, R]),
    prog: [0, 0, 4, 4],
    steps: steps({ slide: [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0], acc: [2, 1, 1, 1] }),
    extra: { ...MONO },
    fx: { warmth: 0.25 },
  },
  {
    name: 'PWM BOUNCE',
    cat: 'BASS',
    desc: 'A pulse wave whose width breathes over one bar, bouncing root and octave around the kick, the ladder filter half open.',
    bpm: 123,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.PULSE, osc1: 0.95, sub: 0.32, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.41, res: 0.2, envAmt: 0.34, fD: 0.38, fS: 0.05, fR: 0.14, aD: 0.42, aS: 0.3, aR: 0.13, accent: 0.4, accFlt: 0.45, load: 0.12, lfoRate: L1RATE['1/4'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.WAVE, lfoAmt: 0.45 },
    seq: edit([0, 0, 7, 0, R, 0, 7, R]),
    prog: [0],
    steps: steps({ acc: [2, 0, 1, 0, 1, 1, 2, 1] }),
    extra: { ...MONO },
  },

  /* --- l'EBM : les doubles croches entre les kicks, court et dur --- */
  {
    name: 'EBM SIXTEENTHS',
    cat: 'BASS',
    desc: 'Body music sixteenths between the kicks: a saw and a square through the Korg filter, short and hard, the first after the kick slapped.',
    bpm: 124,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.32, wave1: WAVE1.SAW, osc1: 0.92, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.45, fine1: cents(-3), fine2: cents(3), sub: 0.28, subWave: SUBW.SINE, fmode: FMODE.MS10, cutoff: 0.36, res: 0.4, envAmt: 0.42, fD: 0.32, fS: 0, fR: 0.12, aD: 0.38, aS: 0.15, aR: 0.12, accent: 0.45, accFlt: 0.5, load: 0.2 },
    seq: edit([R, 0, 0, 0, R, 0, 0, 0, R, 0, 0, 0, R, 0, 0, 7]),
    prog: [0],
    steps: steps({ acc: [0, 2, 1, 1] }),
    extra: { ...MONO },
    fx: { glue: 0.2, drive: 0.15 },
  },
  {
    name: 'BODY BASS',
    cat: 'BASS',
    desc: 'Straight eighths that never stop, a square and a saw short and hard in the Korg filter, an octave jump closing every bar, bus glue.',
    bpm: 122,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.3, wave1: WAVE1.SQUARE, osc1: 0.9, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.5, fine1: cents(-4), fine2: cents(4), sub: 0.28, subWave: SUBW.SINE, fmode: FMODE.MS10, cutoff: 0.43, res: 0.3, envAmt: 0.38, fD: 0.32, fS: 0.05, fR: 0.13, aD: 0.4, aS: 0.25, aR: 0.13, accent: 0.4, accFlt: 0.5, load: 0.25 },
    seq: edit([0, 0, 0, 0, 0, 0, 7, 0]),
    prog: [0, 0, 0, 4],
    steps: steps({ acc: [2, 1, 1, 1, 2, 1, 1, 0] }),
    extra: { ...MONO },
    fx: { glue: 0.25 },
  },
  {
    name: 'STEEL BASS',
    cat: 'BASS',
    desc: 'An early eighties body sequence: root, root, minor third, root, the fifth answering, a square wave in a brighter 12 dB filter.',
    bpm: 120,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SQUARE, osc1: 0.92, sub: 0.28, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.55, res: 0.28, envAmt: 0.38, fD: 0.36, fS: 0, fR: 0.13, aD: 0.45, aS: 0.35, aR: 0.13, accent: 0.4, accFlt: 0.5, load: 0.15 },
    seq: edit([0, 0, 2, 0, R, 4, 0, 2]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1, 1, 2, 1, 1] }),
    extra: { ...MONO },
    fx: { drive: 0.15 },
  },
  {
    name: 'COLD BASS',
    cat: 'BASS',
    desc: 'Cold wave: the bass played high like a lead, the octave above walking down the scale in eighths, a hollow square through the Korg filter with a Juno chorus and a short echo.',
    bpm: 112,
    knobs: { ...LOW, rate: RATE['1/8'], gate: 0.5, wave1: WAVE1.SQUARE, osc1: 0.92, sub: 0.34, subWave: SUBW.SINE, fmode: FMODE.MS10, cutoff: 0.48, res: 0.15, envAmt: 0.28, fD: 0.45, fS: 0.15, fR: 0.18, aD: 0.5, aS: 0.45, aR: 0.16, accent: 0.35, accFlt: 0.35, load: 0.1, monoLow: 1 },
    seq: edit([7, 7, 6, 4, 7, 7, 4, 2]),
    prog: [0, 0, 1, 1],
    steps: steps({ acc: [2, 1, 1, 1] }),
    extra: { ...MONO },
    fx: { chorus: 1, echo: ['1/8', 'STRAIGHT', 0.2, 0.15, { style: 'ANALOG', mode: 'PING-PONG', high: 0.4, low: 0.6 }] },
  },
  {
    name: 'KNOCK BASS',
    cat: 'BASS',
    desc: 'A wooden knock: a sine touched by FM with a triangle an octave above, very short, a broken figure around the kick for minimal grooves.',
    bpm: 122,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.3, wave1: 0.1, osc1: 1, fm: 0.18, ratio: RATIO('3'), wave2: WAVE2.TRI, range2: FEET[4], osc2: 0.8, sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.55, res: 0.12, envAmt: 0.34, fD: 0.24, fS: 0, fR: 0.12, aD: 0.4, aS: 0.05, aR: 0.13, accent: 0.45, accFlt: 0.4, load: 0.4 },
    seq: edit([R, R, 0, 0, R, R, 0, R, R, R, 0, 0, R, 0, R, 7]),
    prog: [0],
    steps: steps({ acc: [1, 1, 2, 0, 1, 1, 2, 1] }),
    extra: { ...MONO },
  },
  {
    name: 'SYNC BASS',
    cat: 'BASS',
    desc: 'A hard sync bass in sixteenth pairs around the kick: the second saw locked to the first a fifth up and swept over four bars, held dark by the ladder filter.',
    bpm: 120,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.45, wave1: WAVE1.SAW, osc1: 0.55, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(7), osc2: 0.85, sync: ON, sub: 0.36, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.5, res: 0.2, envAmt: 0.34, fD: 0.42, fS: 0.1, fR: 0.15, aD: 0.46, aS: 0.4, aR: 0.14, accent: 0.4, accFlt: 0.4, load: 0.12 },
    seq: edit([R, 0, 0, R, R, 0, 0, R, R, 0, 0, R, R, 0, 7, 0]),
    prog: [0],
    steps: steps({ acc: [1, 2, 1, 1] }),
    extra: { ...MONO, ...LFO2('4 BAR', 'TRI', 'OSC 2 PITCH', 0.3), xLfo2Depth: 0.5 },
  },
  {
    name: 'WALKING DISCO',
    cat: 'BASS',
    desc: 'A walking disco line: root and octave with a pickup, then up through the fifth and the sixth to the seventh, over F sharp minor, A, B minor and D, a round square with a Juno chorus, glue and warmth.',
    bpm: 117,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.55, wave1: 0.56, osc1: 0.92, sub: 0.3, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.46, res: 0.26, envAmt: 0.3, fD: 0.45, fS: 0.15, fR: 0.17, aD: 0.5, aS: 0.5, aR: 0.15, accent: 0.35, accFlt: 0.4, load: 0.15, monoLow: 1 },
    seq: edit([0, R, 7, R, 0, R, 7, 0, 4, R, 5, R, 6, R, 7, 6]),
    prog: [0, 5, 4, 1],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 1, 0, 2, 1, 1, 1, 1, 1, 1, 0] }),
    extra: { ...MONO },
    fx: { chorus: 1, glue: 0.2, warmth: 0.2 },
  },

  /* --- la new beat : lente, caoutchouc, sombre --- */
  {
    name: 'NEW BEAT BASS',
    cat: 'BASS',
    desc: 'Slow Belgian body music: rubbery offbeat eighths with a slide down to the fifth, a saw and a deep sub, the ladder filter a little resonant.',
    bpm: 108,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.6, wave1: WAVE1.SAW, osc1: 0.9, sub: 0.36, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.42, res: 0.34, envAmt: 0.38, fD: 0.5, fS: 0.05, fR: 0.18, aD: 0.55, aS: 0.45, aR: 0.16, accent: 0.4, accFlt: 0.5, load: 0.2 },
    seq: edit([R, R, 0, R, R, R, 0, R, R, R, 0, R, R, 0, R, -3]),
    prog: [0],
    steps: steps({ slide: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], acc: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 2] }),
    extra: { ...MONO },
  },
  {
    name: 'SLOW RUBBER',
    cat: 'BASS',
    desc: 'At 105: long notes that slide between the root and the fifth below, a square over a sine sub, the filter opening slowly on each note.',
    bpm: 105,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.85, wave1: 0.5, osc1: 0.9, sub: 0.36, subWave: SUBW.SINE, fmode: FMODE.MOOG, cutoff: 0.44, res: 0.38, envAmt: 0.3, fA: 0.35, fD: 0.55, fS: 0.3, fR: 0.25, aD: 0.6, aS: 0.7, aR: 0.2, accent: 0.3, accFlt: 0.35, load: 0.15, aA: 0.4 },
    seq: edit([0, R, R, 0, R, R, -3, R, R, 0, R, R, 4, R, 0, R]),
    prog: [0],
    steps: steps({ slide: [0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0], gate: [2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 2, 1] }),
    extra: { ...MONO },
  },
  {
    name: 'ACID NEW BEAT',
    cat: 'BASS',
    desc: 'Acid at new beat speed, an octave down on the low F sharp: a saw and a square, the resonance up, accents and slides into the octave, a dub tape echo behind.',
    bpm: 112,
    knobs: { ...LOW, rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.92, sub: 0, subWave: SUBW.SINE, fmode: FMODE.LP12, cutoff: 0.48, res: 0.42, envAmt: 0.44, keyTrack: 0.6, fD: 0.42, fS: 0, fR: 0.18, aD: 0.5, aS: 0.5, aR: 0.15, accent: 0.3, accFlt: 0.6, load: 0.2, octave: OCT(-2), wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.35 },
    seq: edit([0, R, 0, 7, R, 0, 2, R, 0, 0, R, 7, R, 6, 7, R]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 2, 0, 1, 1, 0, 1, 1, 0, 2, 1, 1, 2, 0], slide: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0] }),
    extra: { ...MONO, xLfo2Rate: L2RATE('4 BAR'), xLfo2Shape: L2SHAPE('SINE'), xLfo2Dest: L2DEST('CUTOFF'), xLfo2Depth: 0.2 },
    fx: { echo: ['1/8', 'DOTTED', 0.15, 0.3, { style: 'TAPE', mode: 'PING-PONG', wobble: 0.15, high: 0.4, low: 0.6 }] },
  },

  /* ======================= SEQ (20) : le medium hypnotique, sequences, arpeges, echos ======================= */
  {
    name: 'HYPNO SEQ',
    cat: 'SEQ',
    desc: 'Berlin school against the four on the floor: three notes turning over sixteen, a saw over a square an octave below, the cutoff drifting over four bars.',
    bpm: 121,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.45, wave1: WAVE1.SAW, osc1: 0.85, wave2: WAVE2.SQUARE, range2: FEET[16], osc2: 0.4, fine1: cents(-5), fine2: cents(5), fmode: FMODE.MOOG, cutoff: 0.45, res: 0.26, envAmt: 0.3, keyTrack: 0.6, fD: 0.36, fS: 0.1, fR: 0.25, aD: 0.45, aS: 0.3, aR: 0.25, accent: 0.4, accFlt: 0.45, width: 0.35 },
    seq: edit([0, 7, 4]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1] }),
    extra: { ...LFO2('4 BAR', 'SINE', 'CUTOFF', 0.22) },
  },
  {
    name: 'REPEAT SEQ',
    cat: 'SEQ',
    desc: 'The repeated note in the middle register: a pluck of two saws in sixteenths, the cutoff moving over two bars, a Juno chorus. Put it over a bass on the same note.',
    bpm: 122,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SAW, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.7, fine1: cents(-7), fine2: cents(7), fmode: FMODE.LP12, cutoff: 0.4, res: 0.2, envAmt: 0.34, keyTrack: 0.6, fD: 0.32, fS: 0, fR: 0.2, aD: 0.45, aS: 0.1, aR: 0.2, accent: 0.45, accFlt: 0.45, width: 0.3, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.15 },
    seq: edit([0]),
    prog: [0],
    steps: steps({ acc: [2, 0, 1, 0] }),
    extra: {},
    fx: { chorus: 1 },
  },
  {
    name: 'OCTAVE SEQ',
    cat: 'SEQ',
    desc: 'Octave sixteenths in the middle, a pulse wave plucked by the Korg filter, a dotted eighth echo low in the mix to blur the edges.',
    bpm: 120,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.38, wave1: 0.72, osc1: 0.9, fmode: FMODE.MS10, cutoff: 0.46, res: 0.24, envAmt: 0.32, keyTrack: 0.6, fD: 0.3, fS: 0, fR: 0.18, aD: 0.4, aS: 0.05, aR: 0.18, accent: 0.4, accFlt: 0.45, width: 0.25 },
    seq: edit([0, 7]),
    prog: [0, 0, 5, 5],
    steps: steps({ acc: [2, 1, 1, 1] }),
    extra: {},
    fx: { echo: ['1/8', 'DOTTED', 0.2, 0.3, { style: 'ANALOG', mode: 'PING-PONG', high: 0.4 }] },
  },
  {
    name: 'ITALO ARP',
    cat: 'SEQ',
    desc: 'An italo arpeggio climbing sevenths over two octaves in sixteenths, a pulse and a saw with a Juno chorus, through F sharp minor, D, E and C sharp minor.',
    bpm: 118,
    knobs: { ...MID, rate: RATE['1/16'], mode: MODE.UP, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.42, wave1: 0.72, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.4, fine1: cents(-6), fine2: cents(6), fmode: FMODE.LP12, cutoff: 0.42, res: 0.2, envAmt: 0.3, keyTrack: 0.5, fD: 0.32, fS: 0.1, fR: 0.2, aD: 0.42, aS: 0.3, aR: 0.2, accent: 0.45, accFlt: 0.4, width: 0.3 },
    seq: AUTO,
    prog: [0, 1, 2, 3],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 1, 0] }),
    extra: {},
    fx: { chorus: 1 },
  },
  {
    name: 'DARK ARP',
    cat: 'SEQ',
    desc: 'A dark three note arpeggio falling against the bar, a pulse wave in the Korg filter, its width jumping at random, F sharp minor to C sharp minor.',
    bpm: 116,
    knobs: { ...MID, rate: RATE['1/16'], mode: MODE.DOWN, range: RANGE[1], notes: NOTES(0), chord: CHORD.TRIAD, gate: 0.4, wave1: 0.75, osc1: 0.9, fmode: FMODE.MS10, cutoff: 0.44, res: 0.36, envAmt: 0.32, keyTrack: 0.5, fD: 0.32, fS: 0.15, fR: 0.2, aD: 0.32, aS: 0, aR: 0.16, accent: 0.45, accFlt: 0.45, width: 0.15 },
    seq: AUTO,
    prog: [0, 3],
    steps: steps({ acc: [2, 1, 1] }),
    extra: { ...LFO2('1/8', 'S&H', 'WAVE', 0.2) },
  },
  {
    name: 'PLUCK SEQ',
    cat: 'SEQ',
    desc: 'A swung pluck: two saws a few cents apart snapping shut in the 12 dB filter, chord tones on the offbeats, a dotted echo answering them.',
    bpm: 122,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SAW, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.7, fine1: cents(-8), fine2: cents(8), fmode: FMODE.LP12, cutoff: 0.42, res: 0.2, envAmt: 0.38, keyTrack: 0.6, fD: 0.3, fS: 0, fR: 0.2, aD: 0.5, aS: 0.15, aR: 0.24, accent: 0.45, accFlt: 0.45, width: 0.4 },
    seq: edit([R, 4, R, 7, 2, R, 6, R, R, 4, R, 7, R, 9, R, 6]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [1, 2, 1, 1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 0] }),
    extra: { xSwing: 0.3 },
    fx: { echo: ['1/8', 'DOTTED', 0.18, 0.3, { style: 'DIGITAL', mode: 'PING-PONG', high: 0.4 }] },
  },
  {
    name: 'BLEEP SEQ',
    cat: 'SEQ',
    desc: 'Clean bleeps: sine and triangle tones, short and dry, a sparse two octave figure that leaves room for the drums, one quiet echo a quarter late.',
    bpm: 123,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.35, wave1: 0.1, osc1: 1, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.6, fine1: cents(-3), fine2: cents(3), fmode: FMODE.LP12, cutoff: 0.5, res: 0.1, envAmt: 0.2, keyTrack: 0.6, fD: 0.3, fS: 0, fR: 0.2, aD: 0.4, aS: 0.05, aR: 0.22, accent: 0.4, accFlt: 0.3, width: 0.3 },
    seq: edit([7, R, 7, R, R, 7, R, 9, 7, R, R, 7, R, 4, R, 7]),
    prog: [0],
    steps: steps({ acc: [2, 1, 0, 1, 1, 1, 1, 2, 2, 1, 1, 0, 1, 1, 1, 2] }),
    extra: {},
    fx: { echo: ['1/4', 'STRAIGHT', 0.12, 0.2, { style: 'DIGITAL', mode: 'SINGLE', high: 0.45 }] },
  },
  {
    name: 'ECHO SEQ',
    cat: 'SEQ',
    desc: 'Four notes a bar and a dotted tape echo that writes the rest of the pattern: a saw and a triangle, soft and round. Change the delay time and the rhythm changes.',
    bpm: 119,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.95, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.7, fine1: cents(-5), fine2: cents(5), fmode: FMODE.MOOG, cutoff: 0.43, res: 0.2, envAmt: 0.3, keyTrack: 0.6, fD: 0.36, fS: 0.05, fR: 0.24, aD: 0.55, aS: 0.3, aR: 0.25, accent: 0.4, accFlt: 0.4, width: 0.3 },
    seq: edit([0, R, R, R, R, R, 4, R, R, R, 7, R, R, 4, R, R]),
    prog: [0, 0, 1, 1],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1] }),
    extra: {},
    fx: { echo: ['1/8', 'DOTTED', 0.26, 0.42, { style: 'TAPE', mode: 'PING-PONG', wobble: 0.2, high: 0.4 }] },
  },
  {
    name: 'TRIPLET SEQ',
    cat: 'SEQ',
    desc: 'Every eighth note played three times as fast triplets: root, octave, fifth, octave, a short square through the Korg filter with a Juno chorus, rolling across the beat.',
    bpm: 117,
    knobs: { ...MID, rate: RATE['1/8'], gate: 0.5, wave1: WAVE1.SQUARE, osc1: 0.9, fmode: FMODE.MS10, cutoff: 0.46, res: 0.22, envAmt: 0.3, keyTrack: 0.6, fD: 0.3, fS: 0.05, fR: 0.2, aD: 0.36, aS: 0, aR: 0.18, accent: 0.4, accFlt: 0.4, width: 0.3, wave2: WAVE2.SAW, range2: FEET[16], osc2: 0.35 },
    seq: edit([0, 7, 4, 7]),
    prog: [0],
    steps: steps({ rat: [3, 1, 3, 1, 1, 3, 1, 1], acc: [2, 1, 1, 1] }),
    extra: {},
    fx: { chorus: 1 },
  },
  {
    name: 'POLY SEQ',
    cat: 'SEQ',
    desc: 'Five steps against sixteen, three notes and two rests: a saw and a hollow square, the pattern landing somewhere new on every bar.',
    bpm: 121,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.45, wave1: WAVE1.SAW, osc1: 0.8, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.45, fine1: cents(-4), fine2: cents(4), fmode: FMODE.LP12, cutoff: 0.46, res: 0.24, envAmt: 0.3, keyTrack: 0.6, fD: 0.34, fS: 0.05, fR: 0.2, aD: 0.45, aS: 0.25, aR: 0.2, accent: 0.4, accFlt: 0.45, width: 0.35 },
    seq: edit([0, R, 4, 7, R]),
    prog: [0, 0, 5, 5],
    steps: steps({ acc: [2, 1, 1, 0, 1], prob: [100, 100, 100, 75, 100] }),
    extra: { ...LFO2('4 BAR', 'TRI', 'CUTOFF', 0.15) },
  },
  {
    name: 'RATCHET SEQ',
    cat: 'SEQ',
    desc: 'A sparse figure that stutters: a pulse wave plucked by the ladder filter, double, triple and quadruple hits inside single steps.',
    bpm: 123,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.4, wave1: 0.75, osc1: 0.9, wave2: WAVE2.SQUARE, range2: FEET[16], osc2: 0.35, fmode: FMODE.MOOG, cutoff: 0.42, res: 0.28, envAmt: 0.34, keyTrack: 0.5, fD: 0.28, fS: 0.05, fR: 0.18, aD: 0.38, aS: 0, aR: 0.16, accent: 0.45, accFlt: 0.45, width: 0.35 },
    seq: edit([0, R, R, 7, R, R, 0, R, 4, R, R, 7, R, 0, R, R]),
    prog: [0],
    steps: steps({ rat: [1, 1, 1, 2, 1, 1, 3, 1, 1, 1, 1, 1, 1, 4, 1, 1], acc: [2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1] }),
    extra: {},
  },
  {
    name: 'SYNC SEQ',
    cat: 'SEQ',
    desc: 'A hard sync figure that cuts without getting bright: the second saw locked to the first, its pitch swept over two bars, short syncopated notes.',
    bpm: 120,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.55, wave1: WAVE1.SAW, osc1: 0.6, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(5), osc2: 0.85, sync: ON, fmode: FMODE.MOOG, cutoff: 0.48, res: 0.2, envAmt: 0.3, keyTrack: 0.5, fD: 0.34, fS: 0.15, fR: 0.2, aD: 0.45, aS: 0.45, aR: 0.2, accent: 0.4, accFlt: 0.4, width: 0.4 },
    seq: edit([0, R, 0, R, R, 7, R, 0, R, 0, R, 6, R, R, 4, R]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1, 1, 2, 1, 0, 1, 1, 1, 2, 1, 1, 1, 1] }),
    extra: { ...LFO2('2 BAR', 'TRI', 'OSC 2 PITCH', 0.3) },
  },
  {
    name: 'WOOD SEQ',
    cat: 'SEQ',
    desc: 'Percussive wood for minimal grooves: a sine knocked by FM, very short, a broken figure with notes left to chance.',
    bpm: 122,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.35, wave1: 0.1, osc1: 0.95, fm: 0.2, ratio: RATIO('3'), wave2: WAVE2.SINE, range2: FEET[4], osc2: 0.75, fmode: FMODE.LP12, cutoff: 0.55, res: 0.15, envAmt: 0.3, keyTrack: 0.6, fD: 0.22, fS: 0, fR: 0.14, aD: 0.42, aS: 0, aR: 0.18, accent: 0.5, accFlt: 0.4, width: 0.4 },
    seq: edit([0, R, 4, 0, R, 7, 0, R, 0, 4, R, 7, 0, R, 2, R]),
    prog: [0],
    steps: steps({ prob: [100, 100, 75, 100, 100, 50, 100, 100, 100, 75, 100, 100, 100, 100, 50, 100], acc: [2, 1, 1, 0, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 0, 1] }),
    extra: {},
  },
  {
    name: 'GLASS SEQ',
    cat: 'SEQ',
    desc: 'Glassy plinks: a sine and a triangle an octave apart, a slow figure in eighths, a dotted quarter echo and a short dark room behind.',
    bpm: 118,
    knobs: { ...MID, rate: RATE['1/8'], gate: 0.4, wave1: 0.12, osc1: 0.95, wave2: WAVE2.TRI, range2: FEET[4], osc2: 0.55, fmode: FMODE.LP12, cutoff: 0.52, res: 0.12, envAmt: 0.22, keyTrack: 0.6, fD: 0.3, fS: 0, fR: 0.25, aD: 0.5, aS: 0, aR: 0.3, accent: 0.4, accFlt: 0.3, width: 0.4 },
    seq: edit([7, 4, R, 6, 4, R, 2, R]),
    prog: [0, 0, 1, 1],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 0, 1] }),
    extra: {},
    fx: { echo: ['1/4', 'DOTTED', 0.18, 0.32, { style: 'DIGITAL', mode: 'PING-PONG', high: 0.4 }], verb: [0.1, 1.2, 0.35, 15] },
  },
  {
    name: 'ACID SEQ',
    cat: 'SEQ',
    desc: 'An acid line in the middle register: one saw, the resonance singing, accents and slides into the octave, to sit over a plain bass.',
    bpm: 123,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SAW, osc1: 0.9, fmode: FMODE.MOOG, cutoff: 0.45, res: 0.42, envAmt: 0.42, keyTrack: 0.6, fD: 0.38, fS: 0, fR: 0.18, aD: 0.48, aS: 0.45, aR: 0.15, accent: 0.3, accFlt: 0.56, width: 0.1 },
    seq: edit([0, 0, R, 7, 0, R, 0, 2, R, 0, 7, R, 0, 6, R, 4]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1, 2, 1, 1, 0, 1, 2, 1, 1, 2, 1, 1, 0], slide: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0] }),
    extra: { ...MONO },
  },
  {
    name: 'DOTTED SEQ',
    cat: 'SEQ',
    desc: 'Dotted eighths written into the notes: a saw and a triangle every three sixteenths, nine steps turning against the bar.',
    bpm: 120,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.7, wave1: WAVE1.SAW, osc1: 0.8, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.5, fine1: cents(-6), fine2: cents(6), fmode: FMODE.MOOG, cutoff: 0.43, res: 0.24, envAmt: 0.3, keyTrack: 0.6, fD: 0.42, fS: 0.2, fR: 0.28, aD: 0.55, aS: 0.4, aR: 0.28, accent: 0.4, accFlt: 0.4, width: 0.4 },
    seq: edit([7, R, R, 4, R, R, 2, R, R]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 0, 1, 1] }),
    extra: {},
  },
  {
    name: 'MINOR ARP',
    cat: 'SEQ',
    desc: 'Minor ninths broken up and down in swung sixteenths, a square and a triangle with the wide Juno chorus and a quiet dotted quarter echo, F sharp minor seven to B minor.',
    bpm: 115,
    knobs: { ...MID, rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[1], notes: NOTES(0), chord: CHORD['9TH'], gate: 0.5, wave1: WAVE1.SQUARE, osc1: 0.85, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.5, fine1: cents(-5), fine2: cents(5), fmode: FMODE.MOOG, cutoff: 0.48, res: 0.2, envAmt: 0.26, keyTrack: 0.5, fD: 0.38, fS: 0.15, fR: 0.25, aD: 0.5, aS: 0.45, aR: 0.3, accent: 0.4, accFlt: 0.4, width: 0.5 },
    seq: AUTO,
    prog: [6, 4],
    steps: steps({ acc: [2, 1, 1, 0], prob: [100, 100, 100, 100, 100, 75, 100, 100, 100, 100, 100, 50] }),
    extra: { xSwing: 0.5 },
    fx: { chorus: 2, echo: ['1/4', 'DOTTED', 0.14, 0.3, { style: 'ANALOG', mode: 'PING-PONG', high: 0.4 }] },
  },
  {
    name: 'CASCADE SEQ',
    cat: 'SEQ',
    desc: 'A slow cascade falling from the octave to the root in sixteenths, a square and a triangle, a soft decay, a quarter note tape echo stretching it.',
    bpm: 112,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.5, wave1: WAVE1.SQUARE, osc1: 0.8, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.6, fine1: cents(-9), fine2: cents(9), fmode: FMODE.LP12, cutoff: 0.42, res: 0.18, envAmt: 0.28, keyTrack: 0.6, fD: 0.4, fS: 0.1, fR: 0.25, aD: 0.6, aS: 0.3, aR: 0.25, accent: 0.4, accFlt: 0.4, width: 0.45 },
    seq: edit([7, 6, 4, 2, 0, R, 4, R]),
    prog: [0, 0, 1, 2],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 1, 1] }),
    extra: {},
    fx: { echo: ['1/4', 'STRAIGHT', 0.16, 0.3, { style: 'TAPE', mode: 'PING-PONG', wobble: 0.2, high: 0.35 }] },
  },
  {
    name: 'PULSE SEQ',
    cat: 'SEQ',
    desc: 'A pulse wave repeating one note in sixteenths, its width swept over two bars by the LFO, the 12 dB filter half open.',
    bpm: 124,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.42, wave1: WAVE1.PULSE, osc1: 0.9, fmode: FMODE.LP12, cutoff: 0.46, res: 0.3, envAmt: 0.3, keyTrack: 0.6, fD: 0.3, fS: 0.05, fR: 0.18, aD: 0.4, aS: 0.15, aR: 0.18, accent: 0.45, accFlt: 0.45, width: 0.25, lfoRate: L1RATE['2 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.WAVE, lfoAmt: 0.35 },
    seq: edit([0, 0, 0, R]),
    prog: [0],
    steps: steps({ acc: [2, 1, 0, 1] }),
    extra: {},
  },
  {
    name: 'DRIFT SEQ',
    cat: 'SEQ',
    desc: 'A drifting slow sequence in eighths, the oscillators wandering, a cassette like tape echo, root fifth and seventh.',
    bpm: 110,
    knobs: { ...MID, rate: RATE['1/8'], gate: 0.55, wave1: WAVE1.SAW, osc1: 0.85, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.45, fine1: cents(-8), fine2: cents(8), fmode: FMODE.MOOG, cutoff: 0.46, res: 0.22, envAmt: 0.28, keyTrack: 0.6, fD: 0.4, fS: 0.15, fR: 0.25, aD: 0.5, aS: 0.35, aR: 0.25, accent: 0.4, accFlt: 0.4, width: 0.35, drift: 0.7 },
    seq: edit([0, 4, 6, 4, 0, 4, 7, 6]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 1, 0] }),
    extra: {},
    fx: { echo: ['1/4', 'TRIPLET', 0.15, 0.25, { style: 'TAPE', mode: 'PING-PONG', wobble: 0.3, high: 0.35 }] },
  },

  /* ======================= LEAD (10) : lignes et stabs ======================= */
  {
    name: 'DARK LEAD',
    cat: 'LEAD',
    desc: 'A dark mono lead: a saw and a square gliding between long notes, a Juno chorus and a dotted quarter echo, low enough to sit under a vocal.',
    bpm: 118,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.8, glide: 0.15, wave1: WAVE1.SAW, osc1: 0.85, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.5, fine1: cents(-6), fine2: cents(6), fmode: FMODE.MOOG, cutoff: 0.44, res: 0.2, envAmt: 0.26, keyTrack: 0.6, fA: 0.1, fD: 0.5, fS: 0.35, fR: 0.25, aA: 0.05, aD: 0.55, aS: 0.7, aR: 0.25, accent: 0.3, accFlt: 0.35, width: 0.3 },
    seq: edit([0, R, R, 2, R, R, 4, R, 3, R, R, 2, R, 0, R, R]),
    prog: [0],
    steps: steps({ gate: [3, 1, 1, 3, 1, 1, 2, 1, 3, 1, 1, 2, 1, 3, 1, 1], slide: [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0] }),
    extra: { ...MONO },
    fx: { chorus: 1, echo: ['1/4', 'DOTTED', 0.18, 0.32, { style: 'ANALOG', mode: 'PING-PONG', high: 0.4 }] },
  },
  {
    name: 'SYNC LEAD',
    cat: 'LEAD',
    desc: 'A mono sync lead with bite but no glare: the second saw locked and tuned up a fifth, a slow sweep of its pitch, a short riff on the octave.',
    bpm: 120,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.6, wave1: WAVE1.SAW, osc1: 0.6, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(7), osc2: 0.85, sync: ON, fmode: FMODE.MOOG, cutoff: 0.46, res: 0.18, envAmt: 0.28, keyTrack: 0.6, fD: 0.42, fS: 0.3, fR: 0.2, aD: 0.5, aS: 0.6, aR: 0.2, accent: 0.4, accFlt: 0.4, width: 0.2 },
    seq: edit([7, R, 7, 6, R, 4, R, R, 7, R, 7, 9, R, 7, R, R]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1, 1, 2, 1, 1] }),
    extra: { ...MONO, ...LFO2('4 BAR', 'SINE', 'OSC 2 PITCH', 0.25) },
    fx: { echo: ['1/8', 'DOTTED', 0.14, 0.25, { style: 'DIGITAL', mode: 'PING-PONG', high: 0.4 }] },
  },
  {
    name: 'ITALO LEAD',
    cat: 'LEAD',
    desc: 'An italo hook: a pulse wave with the wide Juno chorus and a dotted echo, a falling eight note melody over F sharp minor and D.',
    bpm: 122,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.55, wave1: 0.72, osc1: 0.9, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.3, fine1: cents(-5), fine2: cents(5), fmode: FMODE.LP12, cutoff: 0.46, res: 0.18, envAmt: 0.26, keyTrack: 0.6, fD: 0.4, fS: 0.3, fR: 0.22, aD: 0.5, aS: 0.55, aR: 0.22, accent: 0.4, accFlt: 0.35, width: 0.35 },
    seq: edit([7, R, 6, R, 4, R, 6, 7, R, 4, R, 2, R, 0, R, R]),
    prog: [0, 0, 1, 1],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1] }),
    extra: { ...MONO },
    fx: { chorus: 2, echo: ['1/8', 'DOTTED', 0.16, 0.3, { style: 'ANALOG', mode: 'PING-PONG', high: 0.4 }] },
  },
  {
    name: 'BRASS STAB',
    cat: 'LEAD',
    desc: 'A synth brass stab: two saws a few cents apart with a quick filter swell, on the and of two and a double hit before four, F sharp minor to A.',
    bpm: 121,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.8, wave1: WAVE1.SAW, osc1: 0.95, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.9, fine1: cents(-9), fine2: cents(9), fmode: FMODE.MOOG, cutoff: 0.4, res: 0.15, envAmt: 0.34, keyTrack: 0.5, fA: 0.2, fD: 0.45, fS: 0.2, fR: 0.25, aA: 0.05, aD: 0.55, aS: 0.65, aR: 0.25, accent: 0.4, accFlt: 0.35, width: 0.4 },
    seq: edit([R, R, R, R, R, R, 0, R, R, R, R, R, R, 0, 0, R]),
    prog: [0, 0, 5, 5],
    steps: steps({ acc: [1, 1, 1, 1, 1, 1, 2, 1] }),
    extra: {},
    fx: { chorus: 1 },
  },
  {
    name: 'MINOR STAB',
    cat: 'LEAD',
    desc: 'A minor stab: a saw on the root and a square on the minor third above, snapping shut, syncopated sixteenths over F sharp minor and B minor.',
    bpm: 123,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.35, wave1: WAVE1.SAW, osc1: 0.95, wave2: WAVE2.SQUARE, range2: FEET[8], semi2: SEMI(3), osc2: 0.65, fine1: cents(-4), fine2: cents(4), fmode: FMODE.MOOG, cutoff: 0.46, res: 0.2, envAmt: 0.36, keyTrack: 0.5, fD: 0.32, fS: 0.05, fR: 0.22, aD: 0.5, aS: 0.05, aR: 0.28, accent: 0.4, accFlt: 0.45, width: 0.3 },
    seq: edit([0, R, R, 0, R, R, 0, R, R, 0, R, 0, R, R, 0, R]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 0, 1, 1, 1] }),
    extra: {},
  },
  {
    name: 'ORGAN STAB',
    cat: 'LEAD',
    desc: 'A house organ: two squares an octave apart over a square sub, a fast organ envelope, a stab on the and of every beat with little pickups.',
    bpm: 122,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.35, wave1: WAVE1.SQUARE, osc1: 0.8, wave2: WAVE2.SQUARE, range2: FEET[4], osc2: 0.5, fine1: cents(-3), fine2: cents(3), sub: 0.2, subWave: SUBW.SQUARE, fmode: FMODE.LP12, cutoff: 0.48, res: 0.1, envAmt: 0.15, keyTrack: 0.5, fD: 0.4, fS: 0.4, fR: 0.2, aD: 0.5, aS: 0.7, aR: 0.2, accent: 0.35, accFlt: 0.3, width: 0.3 },
    seq: edit([R, R, 0, R, R, R, 0, 2, R, R, 0, R, R, 4, R, 2]),
    prog: [0, 0, 5, 5],
    steps: steps({ acc: [1, 1, 2, 1, 1, 1, 2, 0, 1, 1, 2, 1, 1, 1, 1, 0] }),
    extra: {},
  },
  {
    name: 'FIFTH STAB',
    cat: 'LEAD',
    desc: 'Two saws a fifth apart, stacked and spread, a soft decaying stab on every offbeat, a dotted eighth echo low behind it.',
    bpm: 119,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.4, wave1: WAVE1.SAW, osc1: 0.9, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(7), osc2: 0.8, fine1: cents(-6), fine2: cents(6), stack: 0.2, wide: 0.3, fmode: FMODE.LP12, cutoff: 0.4, res: 0.15, envAmt: 0.3, keyTrack: 0.5, fD: 0.55, fS: 0.1, fR: 0.45, aD: 0.66, aS: 0, aR: 0.5, accent: 0.3, accFlt: 0.35, width: 0.35 },
    seq: edit([R, R, 0, R, R, R, 0, R, R, R, 0, R, R, R, 0, R]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 0, 1, 1, 1, 2, 1] }),
    extra: { xSwing: 0.2 },
    fx: { echo: ['1/8', 'DOTTED', 0.14, 0.3, { style: 'ANALOG', mode: 'PING-PONG', high: 0.35 }] },
  },
  {
    name: 'SEVENTH STAB',
    cat: 'LEAD',
    desc: 'A deep minor seventh stab: a soft wave and a saw a seventh apart in a round 12 dB filter, two long chords a bar, F sharp minor to B minor.',
    bpm: 117,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.9, wave1: 0.3, osc1: 0.85, wave2: WAVE2.SAW, range2: FEET[4], semi2: SEMI(-2), osc2: 0.5, fine1: cents(-5), fine2: cents(5), fmode: FMODE.LP12, cutoff: 0.42, res: 0.18, envAmt: 0.28, keyTrack: 0.5, fD: 0.48, fS: 0.15, fR: 0.38, aD: 0.7, aS: 0.2, aR: 0.6, accent: 0.35, accFlt: 0.35, width: 0.4 },
    seq: edit([R, R, 0, R, R, R, R, R, R, 0, R, R, R, R, R, R]),
    prog: [0, 0, 4, 4],
    steps: steps({ acc: [1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }),
    extra: {},
    fx: { verb: [0.1, 1.4, 0.35, 20] },
  },
  {
    name: 'HOOK LEAD',
    cat: 'LEAD',
    desc: 'A simple two bar hook to build on: a soft saw and a triangle, the minor third and the fifth answering the root, a quiet dotted echo.',
    bpm: 116,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.6, wave1: 0.34, osc1: 0.9, wave2: WAVE2.TRI, range2: FEET[8], osc2: 0.5, fine1: cents(-4), fine2: cents(4), fmode: FMODE.MOOG, cutoff: 0.48, res: 0.16, envAmt: 0.26, keyTrack: 0.6, fD: 0.42, fS: 0.3, fR: 0.25, aD: 0.5, aS: 0.55, aR: 0.25, accent: 0.4, accFlt: 0.35, width: 0.3 },
    seq: edit([0, R, 2, R, 4, R, R, 2, R, 0, R, R, -1, R, 0, R]),
    prog: [0],
    steps: steps({ acc: [2, 1, 1, 1, 2, 1, 1, 1] }),
    extra: { ...MONO },
    fx: { echo: ['1/8', 'DOTTED', 0.15, 0.28, { style: 'TAPE', mode: 'PING-PONG', wobble: 0.15, high: 0.4 }] },
  },
  {
    name: 'WHISTLE LEAD',
    cat: 'LEAD',
    desc: 'A whistling triangle lead with a slight vibrato, long notes on the fifth and the octave, a short dark room around it.',
    bpm: 114,
    knobs: { ...MID, rate: RATE['1/16'], gate: 0.85, glide: 0.12, wave1: WAVE1.TRI, osc1: 0.95, wave2: WAVE2.SINE, range2: FEET[8], osc2: 0.4, fmode: FMODE.LP12, cutoff: 0.5, res: 0.1, envAmt: 0.2, keyTrack: 0.6, fA: 0.15, fD: 0.5, fS: 0.5, fR: 0.3, aA: 0.15, aD: 0.6, aS: 0.8, aR: 0.3, accent: 0.25, accFlt: 0.25, width: 0.25, lfoRate: L1RATE['1/4'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.PITCH, lfoAmt: 0.06 },
    seq: edit([4, R, R, R, 7, R, R, R, 6, R, R, R, 4, R, R, R]),
    prog: [0],
    steps: steps({ gate: [3, 1, 1, 2, 3, 1, 1, 2, 3, 1, 1, 2, 3, 1, 1, 2], slide: [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] }),
    extra: { ...MONO },
    fx: { verb: [0.12, 1.4, 0.35, 20] },
  },

  /* ======================= PAD (8) : nappes et drones ======================= */
  {
    name: 'STRING PAD',
    cat: 'PAD',
    desc: 'A string machine: two saws an octave apart with the wide Juno chorus, slow attacks, triads rising in quarter notes, F sharp minor to D.',
    bpm: 118,
    knobs: { ...MID, rate: RATE['1/4'], mode: MODE.UP, range: RANGE[1], notes: NOTES(0), chord: CHORD.TRIAD, gate: 0.95, wave1: WAVE1.SAW, osc1: 0.75, wave2: WAVE2.SAW, range2: FEET[4], osc2: 0.45, fine1: cents(-8), fine2: cents(8), stack: 0.2, wide: 0.3, fmode: FMODE.LP12, cutoff: 0.44, res: 0.1, envAmt: 0.15, keyTrack: 0.5, fA: 0.4, fD: 0.6, fS: 0.6, fR: 0.5, aA: 0.5, aD: 0.65, aS: 0.8, aR: 0.55, accent: 0.2, accFlt: 0.15, width: 0.55, drift: 0.45 },
    seq: AUTO,
    prog: [0, 0, 1, 1],
    steps: steps({ gate: [3, 2, 2, 3] }),
    extra: {},
    fx: { chorus: 2 },
  },
  {
    name: 'DARK PAD',
    cat: 'PAD',
    desc: 'A dark low pad: stacked saws in a closed ladder filter, sevenths melting in quarter notes, the cutoff moving slowly over four bars.',
    bpm: 115,
    knobs: { ...MID, rate: RATE['1/4'], mode: MODE.UP, range: RANGE[1], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.95, wave1: WAVE1.SAW, osc1: 0.75, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.7, fine1: cents(-9), fine2: cents(9), stack: 0.35, wide: 0.45, fmode: FMODE.MOOG, cutoff: 0.38, res: 0.15, envAmt: 0.2, keyTrack: 0.5, fA: 0.5, fD: 0.65, fS: 0.6, fR: 0.55, aA: 0.55, aD: 0.7, aS: 0.75, aR: 0.6, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.15, accent: 0.2, accFlt: 0.15, width: 0.6, drift: 0.5 },
    seq: AUTO,
    prog: [6, 7, 6, 4],
    steps: steps({ gate: [3, 2, 2, 3] }),
    extra: {},
  },
  {
    name: 'PULSE PAD',
    cat: 'PAD',
    desc: 'A pad that pulses: ninths arpeggiated up and down in sixteenths, two saws stacked and spread, soft attacks and tails that overlap.',
    bpm: 120,
    knobs: { ...MID, rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[2], notes: NOTES(0), chord: CHORD['9TH'], gate: 0.7, wave1: WAVE1.SAW, osc1: 0.75, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.6, fine1: cents(-8), fine2: cents(8), stack: 0.25, wide: 0.4, fmode: FMODE.LP12, cutoff: 0.44, res: 0.12, envAmt: 0.15, keyTrack: 0.5, fA: 0.2, fD: 0.6, fS: 0.5, fR: 0.45, aA: 0.25, aD: 0.6, aS: 0.6, aR: 0.5, accent: 0.25, accFlt: 0.2, width: 0.5, drift: 0.4 },
    seq: AUTO,
    prog: [0, 0, 1, 1],
    steps: steps({ acc: [1, 0, 1, 0] }),
    extra: {},
  },
  {
    name: 'BREAK PAD',
    cat: 'PAD',
    desc: 'For the breakdown: slow quarter notes of a seventh chord melting together, stacked saws spread wide, a short dark room.',
    bpm: 118,
    knobs: { ...MID, rate: RATE['1/4'], mode: MODE.UP, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.95, wave1: WAVE1.SAW, osc1: 0.75, wave2: WAVE2.SAW, range2: FEET[8], osc2: 0.7, fine1: cents(-9), fine2: cents(9), stack: 0.3, wide: 0.5, fmode: FMODE.LP12, cutoff: 0.44, res: 0.12, envAmt: 0.18, keyTrack: 0.5, fA: 0.45, fD: 0.65, fS: 0.6, fR: 0.55, aA: 0.5, aD: 0.7, aS: 0.75, aR: 0.6, accent: 0.2, accFlt: 0.15, width: 0.6, drift: 0.5 },
    seq: AUTO,
    prog: [0, 1, 5, 2],
    steps: steps({ gate: [3, 2, 2, 3] }),
    extra: {},
    fx: { verb: [0.14, 1.6, 0.35, 20] },
  },
  {
    name: 'FIFTH DRONE',
    cat: 'PAD',
    desc: 'A drone for the break: a low fifth held without a gap, the mixer pushed into the ladder filter, the level pulsing in eighths and the cutoff moving over four bars.',
    bpm: 120,
    knobs: { ...LOW, rate: RATE['1/4'], gate: 0.95, wave1: WAVE1.SAW, osc1: 0.8, wave2: WAVE2.SAW, range2: FEET[8], semi2: SEMI(7), osc2: 0.7, fine1: cents(-6), fine2: cents(6), fmode: FMODE.MOOG, cutoff: 0.53, res: 0.28, envAmt: 0.1, fA: 0.3, fD: 0.6, fS: 0.9, fR: 0.5, aA: 0.4, aD: 0.6, aS: 1, aR: 0.5, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.18, accent: 0, accFlt: 0, load: 0.35, drift: 0.4 },
    seq: edit([0]),
    prog: [0],
    steps: steps({ gate: [3] }),
    extra: { ...MONO, ...LFO2('1/8', 'SINE', 'AMP', 0.35) },
  },
  {
    name: 'CHOIR PAD',
    cat: 'PAD',
    desc: 'A soft choir: triangles stacked and spread, sevenths rising and falling in slow quarter notes, the cutoff breathing over four bars, a short room.',
    bpm: 112,
    knobs: { ...MID, rate: RATE['1/4'], mode: MODE.UPDN, range: RANGE[2], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.95, wave1: 0.26, osc1: 0.8, wave2: WAVE2.TRI, range2: FEET[4], osc2: 0.5, fine1: cents(-7), fine2: cents(7), stack: 0.3, wide: 0.4, fmode: FMODE.LP12, cutoff: 0.5, res: 0.1, envAmt: 0.12, keyTrack: 0.5, fA: 0.5, fD: 0.6, fS: 0.7, fR: 0.5, aA: 0.55, aD: 0.65, aS: 0.85, aR: 0.55, accent: 0.2, accFlt: 0.15, width: 0.6, drift: 0.45, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.12 },
    seq: AUTO,
    prog: [0, 0, 5, 5],
    steps: steps({ gate: [3, 2, 2, 3] }),
    extra: {},
    fx: { verb: [0.14, 1.6, 0.3, 25] },
  },
  {
    name: 'TAPE PAD',
    cat: 'PAD',
    desc: 'A worn pad: two saws and a square in eighths of a slow arpeggio, a wobbling tape echo, warmth on the master, a little drift.',
    bpm: 110,
    knobs: { ...MID, rate: RATE['1/8'], mode: MODE.UPDN, range: RANGE[1], notes: NOTES(0), chord: CHORD['7TH'], gate: 0.85, wave1: WAVE1.SAW, osc1: 0.7, wave2: WAVE2.SQUARE, range2: FEET[8], osc2: 0.5, fine1: cents(-9), fine2: cents(9), stack: 0.2, wide: 0.35, fmode: FMODE.LP12, cutoff: 0.42, res: 0.12, envAmt: 0.15, keyTrack: 0.5, fA: 0.3, fD: 0.6, fS: 0.5, fR: 0.45, aA: 0.35, aD: 0.6, aS: 0.65, aR: 0.5, accent: 0.2, accFlt: 0.15, width: 0.5, drift: 0.65 },
    seq: AUTO,
    prog: [6, 4],
    steps: steps({ acc: [1, 0, 1, 0] }),
    extra: {},
    fx: { warmth: 0.2, echo: ['1/4', 'DOTTED', 0.2, 0.35, { style: 'TAPE', mode: 'PING-PONG', wobble: 0.3, high: 0.35 }] },
  },
  {
    name: 'NIGHT DRONE',
    cat: 'PAD',
    desc: 'A dark drone with the root and the octave held, a hollow square and a saw, the cutoff and the resonance drifting over eight bars, a quiet echo.',
    bpm: 116,
    knobs: { ...MID, rate: RATE['1/4'], gate: 0.95, wave1: WAVE1.SQUARE, osc1: 0.75, wave2: WAVE2.SAW, range2: FEET[16], osc2: 0.6, fine1: cents(-7), fine2: cents(7), stack: 0.2, wide: 0.3, fmode: FMODE.MOOG, cutoff: 0.4, res: 0.3, envAmt: 0.12, keyTrack: 0.5, fA: 0.5, fD: 0.6, fS: 0.8, fR: 0.5, aA: 0.55, aD: 0.6, aS: 0.9, aR: 0.55, lfoRate: L1RATE['4 BAR'], lfoShape: L1SHAPE.TRI, lfoDest: L1DEST.CUTOFF, lfoAmt: 0.2, accent: 0, accFlt: 0, width: 0.45, drift: 0.55 },
    seq: edit([0, 7]),
    prog: [0],
    steps: steps({ gate: [3] }),
    extra: { ...LFO2('8 BAR', 'SINE', 'RES', 0.2) },
    fx: { echo: ['1/4', 'DOTTED', 0.12, 0.3, { style: 'ANALOG', mode: 'PING-PONG', high: 0.35 }] },
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
 * v53 (2026-11-25, Mika : "oui effets doses, pas beaucoup pour pas trop denaturer le son") : les effets d'un preset
 * (p.fx), doses sous les plafonds de analog.ts (ANALOG_FX, verifies par analogFaults) :
 *   drive   OVERDRIVE (le potard DISTO, la page DISTO sur MM : la saturation du moteur avant le filtre)
 *   glue    GLUE, le compresseur du moteur
 *   chorus  1 : CHORUS I, 2 : CHORUS II (le Juno du site ; la page CHORUS a son neutre)
 *   warmth  WARMTH du MASTER
 *   echo    [div, note, mix, feedback, { style, mode, wobble, high, low, duck }] : la page DELAY, calee au tempo (SYNC) ;
 *           sans echo, la page est l'ancien DELAY du preset converti (DELAY a 0 : muette), comme depuis la v27
 *   verb    [mix, taille en s, tone, pre-delai en ms] : la reverbe CLASSIC (la convolution du site), sa sortie au neutre
 *           sauf LOW CUT (60 Hz : le grave de la reverbe reste propre) ; jamais sur une basse
 */
const FX_KEYS = new Set(['drive', 'glue', 'chorus', 'warmth', 'echo', 'verb']);
/** Les reglages du VST3 seul que les effets d'un preset peuvent poser (en plus de la voix). */
const BANK_FX = new Set(['xWarmth', 'xRevSize', 'xRevTone', 'xRevPre', 'xSkyLoCut', 'xSkyHiCut']);
const DELAY_PAGE = EXTRA.filter((e) => e.section === 'delay');
// les crans que lit analog.ts (ANALOG_STEPS) sont ceux de extra-params.json
for (const [id, names] of Object.entries(ANALOG_STEPS))
  if (JSON.stringify(EXTRA.find((e) => e.id === id)?.steps) !== JSON.stringify(names)) throw new Error(`analog.ts ANALOG_STEPS.${id} differe de extra-params.json`);
function fxOf(p) {
  const fx = p.fx ?? {};
  for (const k of Object.keys(fx)) if (!FX_KEYS.has(k)) throw new Error(`${p.name} : effet inconnu ${k}`);
  const knobs = {};
  const extra = {};
  let page = false;
  if (fx.drive !== undefined) knobs.dist = fx.drive;
  if (fx.glue !== undefined) knobs.glue = fx.glue;
  if (fx.chorus !== undefined) {
    if (![1, 2].includes(fx.chorus)) throw new Error(`${p.name} : CHORUS I (1) ou II (2)`);
    knobs.chorus = CHORUS[fx.chorus === 1 ? 'I' : 'II'];
  }
  if (fx.warmth !== undefined) extra.xWarmth = fx.warmth;
  if (fx.echo) {
    const [div, note, mix, fbk, o = {}] = fx.echo;
    for (const k of Object.keys(o)) if (!['style', 'mode', 'wobble', 'high', 'low', 'duck'].includes(k)) throw new Error(`${p.name} : echo ${k} ?`);
    page = true;
    knobs.delay = mix;
    for (const e of DELAY_PAGE) extra[e.id] = e.def;
    Object.assign(extra, ANALOG_DL_NEUTRAL, {
      xDlStyle: exStep('xDlStyle', o.style ?? 'ANALOG'),
      xDlMode: exStep('xDlMode', o.mode ?? 'PING-PONG'),
      xDlSync: exStep('xDlSync', 'SYNC'),
      xDlDiv: exStep('xDlDiv', div),
      xDlNote: exStep('xDlNote', note),
      xDlFb: fbk,
      xDlWobble: o.wobble ?? 0,
      xDlHigh: o.high ?? 0.45,
      xDlLow: o.low ?? 0.55,
      xDlDuck: o.duck ?? 0,
    });
  }
  if (fx.verb) {
    if (p.cat === 'BASS') throw new Error(`${p.name} : aucune reverbe sur une basse (v53)`);
    const [mix, s, tone, ms] = fx.verb;
    knobs.reverb = mix;
    Object.assign(extra, { xRevSize: revS(s), xRevTone: tone, xRevPre: preMs(ms), xSkyLoCut: 0.24 });
  }
  return { knobs, extra, page };
}

/*
 * v43 : les reglages du VST3 seul qui restent a leur neutre dans toute la banque (en plus des effets de
 * ANALOG_FX_OFF_EXTRA) : HELL entier, le MASTER (sauf WARMTH, v53), l'ancien EQ et l'ancien mode du DELAY, la matrice,
 * les modes de voix, FEEDBACK, AMP MODE, la pedale masquee, le rack (ses reglages fins), FILTER + (COMB FB), la reverbe
 * (sauf ce que pose verb, v53 : SIZE, TONE, PRE DELAY, LOW CUT ; la BigSky reste sur CLASSIC). Comptent la voix, ses
 * LFO, le swing, le sequenceur, et depuis la v53 les effets doses de p.fx.
 */
// v50 : la matrice de l'encart LFO (section mod, xMx1..8) aussi : ses emplacements restent a OFF dans toute la banque
const NEUTRAL_SECTIONS = new Set(['reverb', 'master', 'phaser', 'flanger', 'pump', 'crush', 'old', 'space', 'matrix', 'voice', 'amp', 'dist', 'hell', 'sky', 'filter', 'mod']);
// v52 : sauf VOICE MODE (POLY ou MONO ; LEGATO jamais, analog.ts) : les basses de la banque en MONO
const BANK_VOICE = new Set(['xVoiceMode']);
const EXTRA_STEPS = Object.fromEntries(EXTRA.filter((e) => e.steps).map((e) => [e.id, e.steps]));

function full(p) {
  const fx = fxOf(p);
  for (const id of Object.keys(fx.knobs)) if (id in p.knobs) throw new Error(`${p.name} : ${id} vient de fx`);
  const raw = { ...SITE_DEF, ...BASE, ...p.knobs, ...fx.knobs, volume: VOLUME[p.name] ?? VOLUME_DEF };
  const knobs = {};
  for (const k of VOY_KNOBS) knobs[k.id] = clean(k.id, raw[k.id]);
  for (const id of Object.keys(p.knobs)) if (!KNOB[id]) throw new Error(`${p.name} : potard inconnu ${id}`);
  if ('volume' in p.knobs) throw new Error(`${p.name} : VOLUME vient de volumes.json`);
  for (const id of ['dist', 'chorus', 'delay', 'reverb', 'tape', 'glue', 'duck']) if (id in p.knobs) throw new Error(`${p.name} : ${id} est un effet (p.fx)`);
  for (const id of Object.keys(p.extra)) if (!EXTRA.some((e) => e.id === id)) throw new Error(`${p.name} : reglage inconnu ${id}`);
  // v43 : le preset ne pose que la voix (LFO, OSC +, swing) ; les effets passent par p.fx (v53), le reste est refuse
  for (const id of Object.keys(p.extra)) {
    const e = EXTRA.find((x) => x.id === id);
    if (BANK_VOICE.has(id)) continue;
    if (NEUTRAL_SECTIONS.has(e.section) || id in ANALOG_FX_OFF_EXTRA || e.section === 'delay' || e.section === 'eq' || e.section === 'chorus' || e.section === 'disto' || e.section === 'engine')
      throw new Error(`${p.name} : ${id} reste a son neutre dans la banque d'usine (v43), ou passe par p.fx (v53)`);
  }
  // QUALITY a HQ dans le fichier (la face ne l'applique pas : un preset d'usine garde la qualite et le moteur de
  // l'instance), la reverbe CLASSIC, les effets du VST3 seul a l'arret sauf ceux de p.fx
  const ex = { ...EXTRA_DEF, xQuality: 1, xSkyType: 0, ...ANALOG_FX_OFF_EXTRA, ...p.extra, ...fx.extra };
  // la page DELAY : celle de p.fx.echo (v53), sinon l'ancien DELAY du preset converti (DELAY a 0 : muette)
  if (!fx.page) Object.assign(ex, delayFrom(knobs, ex.xDlyMode));
  for (const e of V27) if (e.section !== 'delay' && !BANK_FX.has(e.id) && ex[e.id] !== e.def) throw new Error(`${p.name} : ${e.id} doit rester neutre (${e.def})`);
  const extra = {};
  // v52 : la tonalite (xKey, xScale, instance) n'est dans aucun preset : celle du morceau reste
  for (const e of EXTRA) if (!e.instance) extra[e.id] = cleanExtra(e.id, ex[e.id]);
  // Les regles du son analogique (analog.ts) : les effets sous leurs plafonds, le filtre modere, pas trop aigu
  const faults = analogFaults(knobs, extra, EXTRA_STEPS);
  if (faults.length) throw new Error(`${p.name} : ${faults.join(' ; ')}`);
  // et ce qui doit rester exactement au neutre (la reverbe BigSky sur CLASSIC, HELL entier, la DISTO, la pedale...)
  for (const e of EXTRA) {
    if (e.id === 'xSkyType' || e.id === 'xQuality' || BANK_VOICE.has(e.id) || BANK_FX.has(e.id)) continue;
    if ((NEUTRAL_SECTIONS.has(e.section) || e.section === 'disto' || e.section === 'eq' || e.section === 'chorus') && extra[e.id] !== cleanExtra(e.id, e.def))
      throw new Error(`${p.name} : ${e.id} = ${extra[e.id]}, son neutre est ${e.def}`);
  }
  if (extra.xSkyType !== 0) throw new Error(`${p.name} : la reverbe reste CLASSIC (xSkyType 0)`);
  if (p.cat === 'BASS' && knobs.reverb !== 0) throw new Error(`${p.name} : aucune reverbe sur une basse (v53)`);
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
