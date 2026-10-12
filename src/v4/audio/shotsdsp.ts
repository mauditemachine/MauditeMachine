/**
 * Le calcul des one-shots du MM-RYTM (audio/shots.ts les garde et les sert ;
 * ce module, sans DOM ni Web Audio, tourne aussi dans le worker
 * audio/shots.worker.ts). Les one-shots du MM-RYTM (2026-10-03, Mika : "je veux juste les
 * meilleurs samples oneshot du monde dans cette groovebox ... un kick de
 * balle de tennis qui frappe fort, un snare qui eblouit avec une petite
 * gate reverb pas trop intense"). La boite joue des echantillons, comme
 * un sampler (TONE : la vitesse de lecture, STRETCH : la longueur), mais
 * ces echantillons sont calcules ici, au chargement, en JavaScript pur :
 * aucun fichier, aucune licence, et une chaine qu'un graphe Web Audio ne
 * permet pas :
 * - tout est calcule a 4 x la frequence du contexte (balayages, carres
 *   metalliques, saturations sans repliement), puis ramene par un filtre
 *   RIF de 127 coefficients (fenetre de Kaiser, plus de 80 dB de rejet) ;
 * - chaque son est fait de couches (corps, frappe, bruit), sature en
 *   douceur, puis cale sur sa sonie (SHOT_LOUD, 2026-10-05 ; sa crete
 *   avant) ; depuis le 2026-10-12, etalonne ensuite sur la sonie de sa voix
 *   (SHOT_TARGET), quels que soient son modele ou son echantillon ;
 * - la caisse claire a sa reverbe a porte (un FDN a 8 lignes, stereo,
 *   coupee net apres 130 ms) ; le clap une petite piece ;
 * - les sons bruites ont plusieurs variantes (VARIANTS), jouees en
 *   alternance : deux coups ne sont jamais le meme echantillon.
 * Un echantillon depend de son STRETCH (2026-10-04 : un etirement en grains
 * facon Impulse, audio/stretch.ts ; avant, la duree des enveloppes) :
 * arrondi au huitieme de facteur 4 (shotKey), calcule a la demande et
 * garde (cache, LRU). shots.warm() prepare ceux de STRETCH 0, dans un
 * worker, des que le contexte existe.
 */

import type { Inst } from '../theme';
import { playSample, type SamplePcm } from './sampledsp';
import { timeStretch } from './stretch';

export type ShotId = Inst | 'CHopen';

/** Le son d'une famille de voix (audio/kit.ts) : a la facon d'une 909, d'une 808, ou celui du MM-RYTM d'avant. */
export type KitModel = '909' | '808' | 'mm';

/**
 * Ce que le calcul d'un son sait du kit (audio/kit.ts, passe au worker) :
 * son modele, et les reglages de 0 a 1 (TUNE, ATTACK, DECAY, DRIVE : le
 * kick ; SNAPPY : la caisse claire). Sans lui : MM et les reglages de
 * depart, le son d'avant.
 *
 * Les deux couches (2026-10-08, l'etape R3, Mika : "comme la ANALOG Rytm ou
 * on peut mettre des samples mais le kick peut etre parametre comme une
 * machine") : la couche SYNTH (le modele et ses potards, a son niveau syn)
 * et la couche SAMPLE (sample, l'echantillon, et ses reglages smp), qui
 * jouent ensemble (renderLayers). Absents : SYNTH seule a 1, pas de SAMPLE.
 */
export interface ShotTweak {
  model: KitModel;
  tune: number;
  attack: number;
  decay: number;
  drive: number;
  snappy: number;
  /** GATE (2026-10-04) : la reverbe a porte de la caisse claire MM, la piece des claps MM et 909 */
  gate?: boolean;
  /** SWEEP du kick (2026-10-08, R3) : la profondeur de sa descente de hauteur, 0.5 celle d'avant */
  sweep?: number;
  /** la caisse claire de synthese (R3) : TUNE (sa peau), DECAY (sa longueur), TONE (la couleur du timbre), 0.5 : celle d'avant */
  sdTune?: number;
  sdDecay?: number;
  sdTone?: number;
  /** le niveau de la couche SYNTH, 0 a 1 (gain au carre ; absent : 1) */
  syn?: number;
  /** la couche SAMPLE : la cle de son echantillon (audio/samples.ts) ; absente : OFF */
  sample?: string;
  /** ses reglages (la page SMPL) ; absents : ceux de depart */
  smp?: SampleLayer;
}

/** Les reglages de la couche SAMPLE (R3, la page SMPL de la voix). */
export interface SampleLayer {
  /** LEVEL, 0 a 1 (gain au carre) */
  lev: number;
  /** TUNE et FINE ensemble, en demi-tons */
  st: number;
  /** START, LEN : 0 a 1 ; REV : a l'envers */
  start: number;
  len: number;
  rev: boolean;
  /** la famille de l'echantillon quand ce n'est pas celle de la voix (un sample lock, cale comme elle) */
  from?: string;
}

export const SAMPLE_LAYER_DEFAULT: Readonly<SampleLayer> = { lev: 1, st: 0, start: 0, len: 1, rev: false };

const TWEAK_MM: ShotTweak = { model: 'mm', tune: 0.5, attack: 0.5, decay: 0.45, drive: 0.25, snappy: 0.5 };

/** SWEEP : la profondeur de la descente du kick, x0 a x2 (x1 a 0.5, le kick d'avant). */
export const sweepDepth = (v: number | undefined): number => (v === undefined ? 1 : 2 * Math.max(0, Math.min(1, v)));
/** La caisse claire de synthese : sa peau +/-12 demi-tons, sa longueur x0.42 a x2.4, sa couleur +/-1 octave (x1 a 0.5). */
export const sdTuneFactor = (v: number | undefined): number => (v === undefined || v === 0.5 ? 1 : Math.pow(2, (v - 0.5) * 2));
export const sdDecayFactor = (v: number | undefined): number => (v === undefined || v === 0.5 ? 1 : Math.pow(2, (v - 0.5) * 2.5));
export const sdToneFactor = (v: number | undefined): number => (v === undefined || v === 0.5 ? 1 : Math.pow(2, (v - 0.5) * 2));
/** La note de la peau de chaque caisse claire de synthese (Hz), et sa tenue (s, le timbre) : l'unite de SD TUNE et SD DECAY. */
export const SD_BODY_HZ: Readonly<Record<KitModel, number>> = { '909': 175, '808': 238, mm: 185 };
export const SD_DECAY_S: Readonly<Record<KitModel, number>> = { '909': 0.11, '808': 0.1, mm: 0.05 };
/** Le passe-haut du timbre de chaque caisse claire (Hz) : l'unite de SD TONE. */
export const SD_TONE_HZ: Readonly<Record<KitModel, number>> = { '909': 600, '808': 1800, mm: 1200 };
/** La descente du kick de chaque modele (le depart, en fois la note, moins 1) : l'unite de SWEEP. */
// 2026-10-12 : le 909 part de 5.8 fois sa note (3.85 avant), le 808 de 2.28 fois (sa frappe et son soupir ; 0.3 avant)
export const KICK_SWEEP: Readonly<Record<KitModel, number>> = { '909': 5.8, '808': 1.28, mm: 147 / 52 };

/**
 * La hauteur du kick (Hz, le bas du balayage) pour TUNE : une octave de
 * course, centree sur la note de chaque machine (909 et MM : 52 Hz, 808 :
 * 49 Hz).
 */
export function kickHz(m: KitModel, tune: number): number {
  const base = m === '808' ? 49 : 52;
  return base * Math.pow(2, tune - 0.5);
}

/**
 * La constante de temps de la queue du kick (s) pour DECAY : la 808 tient bien plus longtemps que la 909. Depuis
 * le 2026-10-12 (les deux refaits, bd909 et bd808) : le 909 de 35 a 245 ms (84 ms au depart, son VCA tient le
 * corps plein au debut : un 909 d'origine s'eteint en 0.3 a 0.5 s), le 808 de 55 a 660 ms (168 ms au depart, une
 * queue de plusieurs secondes a fond) ; avant, 90 a 630 ms et 160 ms a 1.3 s (un 909 qui durait une seconde).
 */
export function kickDecayS(m: KitModel, decay: number): number {
  if (m === '808') return 0.055 * Math.pow(12, decay);
  if (m === '909') return 0.035 * Math.pow(7, decay);
  return 0.06 * Math.pow(4, decay);
}

/** Surechantillonnage du calcul. */
const OS = 4;
const TAU = Math.PI * 2;

/**
 * La sonie de chaque voix (2026-10-05, Mika : "il y a des voix vraiment plus
 * fortes que d'autres alors que le knob VOLUME est pareil"). Caler les cretes
 * (SHOT_PEAK, jusqu'au 2026-10-05) laissait 11 dB d'ecart entre les voix : les toms et le perc
 * sortaient 6 a 7 dB au-dessus du kick, le clap 5 dB dessous. Chaque coup est
 * cale sur sa sonie : la crete de l'energie ponderee K (celle des
 * LUFS, ITU-R BS.1770 : le grave compte moins, l'oreille aussi) sur 100 ms.
 *
 * Le kick devient la reference (2026-10-07, Mika : "quand je fais du son,
 * le kick est la reference ; tout ce qu'il y a apres ne doit pas etre aussi
 * fort que lui : mon sub a -14, mon snare a -13 ou -14 quand le kick est a
 * -12 ; la, le snare et le clap sonnent vraiment trop fort") : a sonie
 * egale, la caisse claire, le clap et les charleys cretaient 2 a 6 dB
 * au-dessus du kick. Desormais :
 * - le kick est cale sur sa crete (SHOT_KICK_PEAK), comme un echantillon
 *   normalise sur la tranche d'une console : 909, 808, MM ou un sample, la
 *   meme marge ;
 * - chaque autre voix garde sa sonie cible (SHOT_LOUD, plus bas qu'avant),
 *   sous un plafond de crete : `below` dB sous celle du kick (SHOT_BELOW,
 *   la caisse claire 1.5 dB, le clap 3.5, les charleys 6...). Le plus bas
 *   des deux gagne : rien ne crete jamais au niveau du kick. Mesure a la
 *   sortie (le compresseur de la boite compris, un coup a la fois) : la
 *   caisse claire 2 a 3 dB sous le kick, le clap 2.5 a 6, les toms 5 a 6,
 *   les charleys 6 a 7, la cymbale 9 ; les kicks (909, 808, MM, les six
 *   samples) a 1.4 dB les uns des autres.
 */
/*
 * 2026-10-10 (Mika : "il y a des erreurs de niveau par defaut des voix, on entend trop le kick et rien pour le reste") :
 * mesure hors ligne du motif de depart, l'energie de chaque voix sous celle du kick : la caisse claire -10 dB, les
 * toms -12, l'open hat -19, le charley -24 (un coup court bute sur son plafond de crete et n'a presque pas d'energie).
 * Le kick reste la reference (sa crete ne bouge pas) ; les autres montent de 2.5 a 4 dB, leurs plafonds se resserrent
 * (rien ne crete encore au niveau du kick : 0.5 dB dessous au plus pres).
 * Depuis le 2026-10-12, c'est la regle de chaque rendu (ruleShot) : l'etalonnage (SHOT_TARGET, plus bas) pose
 * ensuite chaque modele et chaque echantillon sur la sonie de sa voix.
 */
export const SHOT_KICK_PEAK = -2.5;
export const SHOT_LOUD: Readonly<Record<ShotId, number>> = {
  BD: -7.5,
  SD: -7,
  TOM: -8.5,
  HT: -9,
  CH: -10.5,
  CHopen: -10.5,
  OH: -11,
  CP: -7.5,
  CY: -12,
};
// BD 1.5 (2026-10-10, Mika : "le kick est un peu trop fort par rapport aux autres voix, reduis un peu") : le kick
// passe 1.5 dB sous la reference, les autres voix gardent la leur (leur plafond reste compte depuis SHOT_KICK_PEAK)
export const SHOT_BELOW: Readonly<Record<ShotId, number>> = {
  BD: 1.5,
  SD: 0.5,
  TOM: 1.5,
  HT: 2,
  CH: 2.5,
  CHopen: 2.5,
  OH: 2.5,
  CP: 1.5,
  CY: 3.5,
};
const LOUD_WIN_S = 0.1;

/*
 * L'etalonnage des voix (2026-10-12, Mika : "controle aussi pour les volumes de chaque voices ya des choses plus
 * forte que d'autre.. dependant du sample biensur mais quand meme"). Mesure hors ligne de chaque voix, chaque
 * machine et chaque sample, reglages de depart, par le chemin reel de la boite (VOL, LEVEL, RYTM_TRIM), en sonie
 * momentanee (BS.1770 : ponderee K, la plus forte fenetre de 400 ms, LUFS) : la regle d'avant (le kick cale sur
 * sa crete, les autres sur leur sonie de 100 ms sous un plafond de crete) laissait 3.5 dB d'ecart entre les kicks
 * (ENGELHARDT sous BLUEPRINT), 5.2 dB entre les caisses claires (PSY 12 et 707 sous PSY 02 : ils butaient sur le
 * plafond), 4.5 dB entre les claps, 3.8 dB entre les charleys (et jusqu'a 2.9 dB d'une variante a l'autre), et
 * les toms sortaient au-dessus du kick (+0.4 a +1.9 dB), le charley ouvert 909 a 1 dB de lui, la cymbale au-dessus
 * du charley ouvert. Desormais chaque son garde sa regle d'avant (ses potards font ce qu'ils faisaient), puis un gain
 * fixe le pose sur la sonie cible de sa voix (SHOT_TARGET) : celui de son modele (synthCal, mesure une fois par voix,
 * modele et variante, a ses reglages de depart, a la frequence de rendu) ou de son echantillon (sampleCalGain, mesure
 * une fois par fichier, au repos). Apres : chaque voix a sa cible a 0.1 dB pres, a 44.1 et a 48 kHz, quel que soit
 * son son ; LEVEL, VOL, la velocite et les niveaux des couches gardent leur sens.
 * Les cibles, en LU sous le kick (le kick de depart, BLUEPRINT, ne bouge pas : SHOT_REF_LUFS), d'apres l'usage
 * d'un mix de batterie et les reglages que Mika a valides (le motif de depart) : la caisse claire juste dessous
 * (Mika : "mon snare a -13 ou -14 quand le kick est a -12"), le clap un peu plus bas, les toms sous la caisse
 * claire, les charleys nettement dessous (le ferme, court, plus bas que l'ouvert), la cymbale sous le charley ouvert.
 */
export const SHOT_TARGET: Readonly<Record<ShotId, number>> = {
  BD: 0,
  SD: -1,
  CP: -3,
  TOM: -3,
  HT: -3.5,
  OH: -5,
  CHopen: -7.5,
  CH: -11.5,
  CY: -7,
};
/** La sonie du kick de reference au niveau du coup (LUFS momentane) : BLUEPRINT au repos, -22.3 LUFS a la prise du MM-RYTM. */
export const SHOT_REF_LUFS = -12.97;
/** La fenetre de la sonie momentanee (s, BS.1770). */
const MOMENT_S = 0.4;
/**
 * La crete d'un coup etalonne ne depasse jamais +3 dBFS (a la prise, LEVEL et VOL de depart : -6.4 dBFS ; les deux a
 * fond : +1.4, le limiteur de sortie la tient). Les sons de la boite restent dessous : PSY 12 a +1.7, ENGELHARDT a -0.5.
 */
const SHOT_MAX_PEAK = Math.pow(10, 3 / 20);
/** L'etalonnage reste dans +/-12 dB (un fichier presque muet ne monte pas sans fin). */
const CAL_MAX_DB = 12;

/** Un biquad applique en place (forme directe I). */
function biquad(x: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i += 1) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** La ponderation K (BS.1770) a sr : le plateau haut (+4 dB au-dessus de 1.7 kHz), puis le passe-haut RLB (38 Hz). */
function kWeight(x: Float32Array, sr: number): Float32Array {
  let K = Math.tan((Math.PI * 1681.974450955533) / sr);
  const Q = 0.7071752369554196;
  const Vh = Math.pow(10, 3.999843853973347 / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const pre = biquad(x, (Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0);
  K = Math.tan((Math.PI * 38.13547087602444) / sr);
  const Q2 = 0.5003270373238773;
  a0 = 1 + K / Q2 + K * K;
  return biquad(pre, 1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q2 + K * K) / a0);
}

/** La sonie d'un coup (dB, ponderee K, la plus forte fenetre de 100 ms). */
export function shotLoudness(s: Shot, sr: number): number {
  const kl = kWeight(s.L, sr);
  const kr = s.R === s.L ? kl : kWeight(s.R, sr);
  const n = kl.length;
  const w = Math.max(1, Math.round(LOUD_WIN_S * sr));
  let acc = 0;
  let best = 0;
  for (let i = 0; i < n + w; i += 1) {
    if (i < n) acc += (kl[i] * kl[i] + kr[i] * kr[i]) / 2;
    if (i >= w && i - w < n) acc -= (kl[i - w] * kl[i - w] + kr[i - w] * kr[i - w]) / 2;
    if (acc / w > best) best = acc / w;
  }
  return 10 * Math.log10(best + 1e-12) + 2.32;
}

/**
 * La sonie momentanee d'un coup (2026-10-12, LUFS, BS.1770 : ponderee K, la somme des deux canaux, la plus forte
 * fenetre de 400 ms ; un coup plus court compte sur 400 ms, comme l'oreille qui l'entend dans le motif) : la mesure
 * de l'etalonnage des voix (SHOT_TARGET).
 */
export function shotMomentary(s: Shot, sr: number): number {
  const kl = kWeight(s.L, sr);
  const kr = s.R === s.L ? kl : kWeight(s.R, sr);
  const n = Math.min(kl.length, kr.length);
  const w = Math.max(1, Math.round(MOMENT_S * sr));
  let acc = 0;
  let best = 0;
  for (let i = 0; i < n; i += 1) {
    acc += kl[i] * kl[i] + kr[i] * kr[i];
    if (i >= w) acc -= kl[i - w] * kl[i - w] + kr[i - w] * kr[i - w];
    if (acc > best) best = acc;
  }
  return -0.691 + 10 * Math.log10(best / w + 1e-12);
}

/** Le gain qui pose un coup de sonie `lufs` sur la cible de la voix id (dans +/-CAL_MAX_DB). */
function calGain(id: ShotId, lufs: number): number {
  const db = SHOT_REF_LUFS + SHOT_TARGET[id] - lufs;
  return Number.isFinite(db) ? Math.pow(10, Math.max(-CAL_MAX_DB, Math.min(CAL_MAX_DB, db)) / 20) : 1;
}

/** Un coup etalonne : son gain d'etalonnage, sous la crete SHOT_MAX_PEAK. */
function calibrate(s: Shot, k: number): void {
  const p = peakOf(s.L === s.R ? [s.L] : [s.L, s.R]);
  applyGain(s, p > 0 ? Math.min(k, SHOT_MAX_PEAK / p) : k);
}

/** Le gain qui met un coup a son niveau (2026-10-07) : le kick a sa crete, les autres a leur sonie sous leur plafond (SHOT_BELOW). */
function loudGain(id: ShotId, s: Shot, sr: number): number {
  // Un kick stereo (le haut d'un sample, monoLows, 2026-10-12) se cale sur la crete de son milieu : le meme gain que sa somme mono d'avant
  const p = id === 'BD' && s.L !== s.R ? midPeak(s) : peakOf(s.L === s.R ? [s.L] : [s.L, s.R]);
  const cap = Math.pow(10, (SHOT_KICK_PEAK - SHOT_BELOW[id]) / 20) / p;
  return id === 'BD' ? cap : Math.min(cap, Math.pow(10, (SHOT_LOUD[id] - shotLoudness(s, sr)) / 20));
}

/** Un gain applique en place (rien s'il n'est pas un nombre positif). */
function applyGain(s: Shot, k: number): void {
  if (!Number.isFinite(k) || k <= 0) return;
  for (let i = 0; i < s.L.length; i += 1) s.L[i] *= k;
  if (s.R !== s.L) for (let i = 0; i < s.R.length; i += 1) s.R[i] *= k;
}

/** Le coup a son niveau (2026-10-07) : le kick a sa crete, les autres a leur sonie sous leur plafond (SHOT_BELOW). */
function setLoudness(id: ShotId, s: Shot, sr: number): void {
  applyGain(s, loudGain(id, s, sr));
}

/** Variantes jouees en alternance (sons bruites). */
export const VARIANTS: Readonly<Record<ShotId, number>> = {
  BD: 1,
  SD: 3,
  TOM: 1,
  CH: 4,
  CHopen: 2,
  OH: 3,
  CP: 3,
  HT: 1,
  CY: 2,
};

/* ---------------- outils ---------------- */

/** Graine -> generateur (mulberry32), dans [0, 1). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type BqType = 'lp' | 'hp' | 'bp' | 'peak' | 'hshelf' | 'lshelf';

/** Biquad (formules RBJ), forme directe transposee. */
class Bq {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private z1 = 0;
  private z2 = 0;

  constructor(type: BqType, f: number, q: number, fs: number, db = 0) {
    const w = (TAU * Math.min(f, fs * 0.49)) / fs;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const al = sw / (2 * q);
    const A = Math.pow(10, db / 40);
    let b0: number;
    let b1: number;
    let b2: number;
    let a0: number;
    let a1: number;
    let a2: number;
    if (type === 'lp') {
      b0 = (1 - cw) / 2;
      b1 = 1 - cw;
      b2 = b0;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else if (type === 'hp') {
      b0 = (1 + cw) / 2;
      b1 = -(1 + cw);
      b2 = b0;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else if (type === 'bp') {
      b0 = al;
      b1 = 0;
      b2 = -al;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else if (type === 'peak') {
      b0 = 1 + al * A;
      b1 = -2 * cw;
      b2 = 1 - al * A;
      a0 = 1 + al / A;
      a1 = -2 * cw;
      a2 = 1 - al / A;
    } else {
      const s = 2 * Math.sqrt(A) * al;
      const hi = type === 'hshelf';
      const sg = hi ? 1 : -1;
      b0 = A * (A + 1 + sg * (A - 1) * cw + s);
      b1 = -2 * sg * A * (A - 1 + sg * (A + 1) * cw);
      b2 = A * (A + 1 + sg * (A - 1) * cw - s);
      a0 = A + 1 - sg * (A - 1) * cw + s;
      a1 = 2 * sg * (A - 1 - sg * (A + 1) * cw);
      a2 = A + 1 - sg * (A - 1) * cw - s;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }

  run(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

/** Bessel I0 (fenetre de Kaiser). */
function i0(x: number): number {
  let s = 1;
  let t = 1;
  for (let k = 1; k < 32; k += 1) {
    t *= (x / (2 * k)) * (x / (2 * k));
    s += t;
    if (t < 1e-12 * s) break;
  }
  return s;
}

/** Le filtre de decimation x4 : sinc coupe a la moitie de la bande finale, Kaiser beta 8, 127 points. */
const DEC: Float64Array = (() => {
  const N = 127;
  const M = (N - 1) / 2;
  const fc = 0.5 / OS;
  const beta = 8;
  const h = new Float64Array(N);
  let sum = 0;
  for (let n = 0; n < N; n += 1) {
    const k = n - M;
    const sinc = k === 0 ? 2 * fc : Math.sin(TAU * fc * k) / (Math.PI * k);
    const r = k / M;
    const w = i0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / i0(beta);
    h[n] = sinc * w;
    sum += h[n];
  }
  for (let n = 0; n < N; n += 1) h[n] /= sum;
  return h;
})();

/** Ramene un signal calcule a OS x vers la frequence du contexte (retard du filtre compense). */
function decimate(x: Float64Array): Float32Array {
  const N = DEC.length;
  const M = (N - 1) / 2;
  const n = Math.floor(x.length / OS);
  const y = new Float32Array(n);
  for (let j = 0; j < n; j += 1) {
    const c = j * OS + M;
    let acc = 0;
    const k0 = Math.max(0, c - (x.length - 1));
    const k1 = Math.min(N - 1, c);
    for (let k = k0; k <= k1; k += 1) acc += DEC[k] * x[c - k];
    y[j] = acc;
  }
  return y;
}

/** Fondu de sortie (cosinus) sur les `sec` dernieres secondes. */
function fadeOut(x: Float32Array | Float64Array, fs: number, sec: number): void {
  const n = Math.min(x.length, Math.round(sec * fs));
  for (let i = 0; i < n; i += 1) {
    const k = x.length - n + i;
    x[k] *= 0.5 + 0.5 * Math.cos((Math.PI * (i + 1)) / n);
  }
}

/** Passe-haut d'un pole (continu et infra-graves), en place. */
function dcBlock(x: Float32Array, fs: number, hz: number): void {
  const R = Math.exp((-TAU * hz) / fs);
  let px = 0;
  let py = 0;
  for (let i = 0; i < x.length; i += 1) {
    const y = x[i] - px + R * py;
    px = x[i];
    py = y;
    x[i] = y;
  }
}

/** Saturation douce normalisee (gain unite en petit signal). */
const sat = (x: number, k: number): number => Math.tanh(k * x) / k;

/** Carre naif (calcule a 4 x, filtre ensuite) : signe du sinus de la phase. */
const sq = (ph: number): number => (ph - Math.floor(ph) < 0.5 ? 1 : -1);

/** Triangle de phase ph. */
const tri = (ph: number): number => {
  const p = ph - Math.floor(ph);
  return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
};

/**
 * Reverbe FDN (8 lignes, matrice de Hadamard, amortissement par ligne,
 * deux passe-tout de diffusion en tete), a la frequence du contexte.
 * Renvoie [gauche, droite] decorrelees, de la longueur demandee.
 */
function fdn(input: Float32Array, fs: number, len: number, rt60: number, dampHz: number, preMs: number, size: number): [Float32Array, Float32Array] {
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  const base = [29.7, 37.1, 41.1, 43.7, 53.5, 59.9, 67.3, 73.1];
  const lines = base.map((ms) => Math.max(8, Math.round((ms * size * fs) / 1000)));
  const bufs = lines.map((n) => new Float32Array(n));
  const idx = new Int32Array(8);
  const g = lines.map((n) => Math.pow(10, (-3 * n) / (rt60 * fs)));
  const dk = Math.exp((-TAU * dampHz) / fs);
  const lp = new Float64Array(8);
  // Diffusion : deux passe-tout (5.3 et 7.9 ms)
  const apN = [Math.round(0.0053 * fs), Math.round(0.0079 * fs)];
  const ap = apN.map((n) => new Float32Array(n));
  const apI = [0, 0];
  const pre = Math.round((preMs / 1000) * fs);
  const v = new Float64Array(8);
  for (let i = 0; i < len; i += 1) {
    let x = i - pre >= 0 && i - pre < input.length ? input[i - pre] : 0;
    for (let a = 0; a < 2; a += 1) {
      const b = ap[a];
      const d = b[apI[a]];
      const y = -0.6 * x + d;
      b[apI[a]] = x + 0.6 * y;
      apI[a] = (apI[a] + 1) % b.length;
      x = y;
    }
    for (let k = 0; k < 8; k += 1) v[k] = bufs[k][idx[k]];
    // Hadamard 8 (normalisee)
    const a0 = v[0] + v[1];
    const a1 = v[0] - v[1];
    const a2 = v[2] + v[3];
    const a3 = v[2] - v[3];
    const a4 = v[4] + v[5];
    const a5 = v[4] - v[5];
    const a6 = v[6] + v[7];
    const a7 = v[6] - v[7];
    const b0 = a0 + a2;
    const b1 = a1 + a3;
    const b2 = a0 - a2;
    const b3 = a1 - a3;
    const b4 = a4 + a6;
    const b5 = a5 + a7;
    const b6 = a4 - a6;
    const b7 = a5 - a7;
    const s = 1 / Math.sqrt(8);
    const m = [(b0 + b4) * s, (b1 + b5) * s, (b2 + b6) * s, (b3 + b7) * s, (b0 - b4) * s, (b1 - b5) * s, (b2 - b6) * s, (b3 - b7) * s];
    let l = 0;
    let r = 0;
    for (let k = 0; k < 8; k += 1) {
      lp[k] = m[k] * (1 - dk) + lp[k] * dk;
      bufs[k][idx[k]] = x + lp[k] * g[k];
      idx[k] = (idx[k] + 1) % lines[k];
      if (k % 2 === 0) l += v[k];
      else r += v[k];
    }
    L[i] = l * 0.35;
    R[i] = r * 0.35;
  }
  return [L, R];
}

/** Crete absolue de plusieurs canaux. */
function peakOf(chs: readonly Float32Array[]): number {
  let p = 0;
  for (const c of chs) for (let i = 0; i < c.length; i += 1) p = Math.max(p, Math.abs(c[i]));
  return p;
}

/** Crete du milieu (L + R) / 2 d'un coup stereo. */
function midPeak(s: Shot): number {
  let p = 0;
  const n = Math.min(s.L.length, s.R.length);
  for (let i = 0; i < n; i += 1) p = Math.max(p, Math.abs(0.5 * (s.L[i] + s.R[i])));
  return p;
}

export interface Shot {
  L: Float32Array;
  R: Float32Array;
}

/* ---------------- les sons ---------------- */

/**
 * BD, le kick d'indie dance (2026-10-04, Mika : "pour le kick, quelque
 * chose de moins intense, un kick d'indie dance") : rond et chaud plutot
 * que claquant. Un sinus qui descend de 200 a 52 Hz (balayage court, 9 ms,
 * puis un reste lent de 45 ms), une saturation douce (tanh 1.5, normalisee),
 * une bosse d'attaque discrete, et un petit clic feutre (bruit en bande vers
 * 1.6 kHz, 2 ms) ; queue de 120 ms. Avant : la balle de tennis (attaque a
 * 380 Hz, saturation 3.2, "pok" a 1.15 kHz et souffle a 2.2 kHz).
 */
function bd(sr: number, ts: number, r: () => number, tw: ShotTweak = TWEAK_MM): Shot {
  const fs = sr * OS;
  // Le kit (2026-10-04) : TUNE deplace tout le balayage, DECAY la queue, ATTACK le clic, DRIVE la saturation (1.5 au depart)
  const kf = kickHz('mm', tw.tune) / 52;
  const tauA = kickDecayS('mm', tw.decay) * ts;
  const len = Math.round(fs * Math.max(0.16, Math.min(2, 3.5 * tauA)));
  const x = new Float64Array(len);
  const bp = new Bq('bp', 1600, 0.8, fs);
  const k = 1.5 * (0.4 + 2.4 * tw.drive);
  const drive = Math.tanh(k);
  const clickAmt = 0.36 * tw.attack;
  // SWEEP (2026-10-08, R3) : la profondeur de la descente, x1 au depart (le kick d'avant)
  const sw = sweepDepth(tw.sweep);
  let ph = 0;
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    const f = (52 + 125 * sw * Math.exp(-t / 0.009) + 22 * sw * Math.exp(-t / 0.045)) * kf;
    ph += f / fs;
    const amp = (1 - Math.exp(-t / 0.0008)) * Math.exp(-t / tauA) * (1 + 0.2 * Math.exp(-t / 0.02));
    const b = Math.sin(TAU * ph) * amp;
    const body = Math.tanh(k * b) / drive;
    const click = clickAmt * bp.run(r() * 2 - 1) * Math.exp(-t / 0.002);
    x[i] = body + click;
  }
  fadeOut(x, fs, Math.min(0.04, len / fs / 4));
  const y = decimate(x);
  dcBlock(y, sr, 20);
  return { L: y, R: y };
}

/**
 * SD, la caisse qui eblouit : la peau (185 Hz qui se pose, son second mode
 * a 330 Hz, le fut a 540 Hz), le timbre (bruit passe-haut 1.2 kHz, une
 * bosse a 4.5 kHz, un peu d'air a 10 kHz, adouci au-dessus de 15 kHz : la
 * brillance sans le sifflement), le claquement (bruit vers 2.5 kHz, 2 ms),
 * le tout sature en douceur. Puis la petite reverbe a
 * porte : une piece claire (RT60 1.1 s, en stereo) a -10 dB, ouverte 130 ms
 * et fermee en 40 ms ; seulement GATE ON (2026-10-04), sec sinon.
 */
function sd(sr: number, ts: number, r: () => number, tw: ShotTweak = TWEAK_MM): Shot {
  const fs = sr * OS;
  // SNAPPY (2026-10-04) : le timbre, 1 au depart (0.5), de rien a deux fois plus
  const wiresK = 2 * tw.snappy;
  // La caisse claire de synthese de R3 (2026-10-08) : sa peau (TUNE), sa longueur (DECAY), sa couleur (TONE) ; x1 au depart
  const ft = sdTuneFactor(tw.sdTune);
  const fd = sdDecayFactor(tw.sdDecay);
  const fc = sdToneFactor(tw.sdTone);
  const td = ts * fd;
  const dryS = Math.max(0.12, 0.3 * td);
  const len = Math.round(fs * dryS);
  const x = new Float64Array(len);
  const hp1 = new Bq('hp', 1200 * fc, 0.7, fs);
  const pkF = new Bq('peak', 4500 * fc, 0.9, fs, 4);
  const air = new Bq('hshelf', 10000, 0.7, fs, 1.5);
  const top = new Bq('lp', 15000, 0.7, fs);
  const crackBp = new Bq('bp', 2500, 1, fs);
  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    p1 += ((185 + 30 * Math.exp(-t / 0.01)) * ft) / fs;
    p2 += (330 * ft) / fs;
    p3 += (540 * ft) / fs;
    const body = Math.sin(TAU * p1) * Math.exp(-t / (0.045 * td)) + 0.45 * Math.sin(TAU * p2) * Math.exp(-t / (0.025 * fd)) + 0.35 * Math.sin(TAU * p3) * Math.exp(-t / (0.012 * fd));
    const n = r() * 2 - 1;
    const wiresEnv = (1 - Math.exp(-t / 0.0005)) * (0.85 * Math.exp(-t / (0.05 * td)) + 0.15 * Math.exp(-t / (0.13 * td)));
    const wires = top.run(air.run(pkF.run(hp1.run(n)))) * wiresEnv;
    const crack = crackBp.run(r() * 2 - 1) * Math.exp(-t / 0.002);
    x[i] = sat(0.8 * body + 1.5 * wiresK * wires + 2 * crack, 1.3);
  }
  fadeOut(x, fs, 0.03);
  const dry = decimate(x);
  dcBlock(dry, sr, 60);
  if (!tw.gate) return { L: dry, R: dry };
  return gatedVerb(dry, dry, sr, ts);
}

/**
 * La reverbe a porte de la caisse claire (2026-10-04, GATE) : ouverte `hold`,
 * fermee en 40 ms, a 0.32 sous le coup sec. Depuis la revue de R3
 * (2026-10-08) elle passe aussi sur la couche SAMPLE de la caisse claire
 * (renderSampleShot) : le kit de depart joue le sample de Mika, GATE (la
 * plaque, SRC F) ne doit pas s'y taire. Un coup stereo entre en mono dans le
 * FDN, la queue s'ajoute a chaque cote ; un coup mono : le calcul d'avant.
 */
function gatedVerb(dl: Float32Array, dr: Float32Array, sr: number, ts: number): Shot {
  const hold = 0.13 * Math.min(1.6, Math.max(0.7, ts));
  const close = 0.04;
  const n = dl.length;
  const total = Math.max(n, Math.round((hold + close + 0.01) * sr));
  let input = dl;
  if (dr !== dl) {
    input = new Float32Array(n);
    for (let i = 0; i < n; i += 1) input[i] = 0.5 * (dl[i] + dr[i]);
  }
  const [wl, wr] = fdn(input, sr, total, 1.1, 7500, 6, 0.8);
  const L = new Float32Array(total);
  const R = new Float32Array(total);
  const wet = 0.32;
  for (let i = 0; i < total; i += 1) {
    const t = i / sr;
    const gate = t < hold ? 1 : t < hold + close ? 0.5 + 0.5 * Math.cos((Math.PI * (t - hold)) / close) : 0;
    L[i] = (i < n ? dl[i] : 0) + wet * gate * wl[i];
    R[i] = (i < n ? dr[i] : 0) + wet * gate * wr[i];
  }
  return { L, R };
}

/**
 * CP : quatre mains qui ne tombent pas ensemble (0, 9.5, 19, 31 ms, a
 * 1.5 ms pres d'une variante a l'autre, un rien decalees entre gauche et
 * droite), du bruit en bande vers 1.25 kHz, une bosse douce a 2.6 kHz ; la
 * derniere tient 75 ms. Une petite piece (RT60 0.45 s) a -16 dB. Adouci le
 * 2026-10-04 (moins sature, moins de bosse, moins de piece, 5.5 dB plus bas).
 * La piece seulement GATE ON (2026-10-04), les mains seules sinon.
 */
function cp(sr: number, ts: number, r: () => number, gate = false): Shot {
  const fs = sr * OS;
  const offs = [0, 0.0095, 0.019, 0.031].map((o, k) => (k === 0 ? 0 : o + (r() - 0.5) * 0.003));
  const lastT = offs[3];
  const len = Math.round(fs * (lastT + Math.max(0.1, 0.3 * ts)));
  const mk = (): { bp: Bq; hp: Bq; pkF: Bq } => ({ bp: new Bq('bp', 1250, 1.6, fs), hp: new Bq('hp', 600, 0.7, fs), pkF: new Bq('peak', 2600, 1, fs, 1.5) });
  const fl = mk();
  const fr = mk();
  const xl = new Float64Array(len);
  const xr = new Float64Array(len);
  const skew = 0.0003;
  const env = (t: number): number => {
    let e = 0;
    for (let k = 0; k < 4; k += 1) {
      const u = t - offs[k];
      if (u < 0) continue;
      const a = 1 - Math.exp(-u / 0.0003);
      e += k < 3 ? a * Math.exp(-u / 0.0045) : a * Math.exp(-u / (0.075 * ts));
    }
    return e;
  };
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    const nl = fl.pkF.run(fl.hp.run(fl.bp.run(r() * 2 - 1)));
    const nr = fr.pkF.run(fr.hp.run(fr.bp.run(r() * 2 - 1)));
    xl[i] = sat(nl * env(t) * 2, 1.2);
    xr[i] = sat(nr * env(t - skew) * 2, 1.2);
  }
  fadeOut(xl, fs, 0.03);
  fadeOut(xr, fs, 0.03);
  const dl = decimate(xl);
  const dr = decimate(xr);
  if (!gate) return { L: dl, R: dr };
  const mono = new Float32Array(dl.length);
  for (let i = 0; i < mono.length; i += 1) mono[i] = 0.5 * (dl[i] + dr[i]);
  const total = dl.length + Math.round(0.12 * sr);
  const [wl, wr] = fdn(mono, sr, total, 0.45, 6000, 4, 0.55);
  const L = new Float32Array(total);
  const R = new Float32Array(total);
  for (let i = 0; i < total; i += 1) {
    const fade = i > total - 0.08 * sr ? 0.5 + 0.5 * Math.cos((Math.PI * (i - (total - 0.08 * sr))) / (0.08 * sr)) : 1;
    L[i] = (i < dl.length ? dl[i] : 0) + 0.16 * wl[i] * fade;
    R[i] = (i < dr.length ? dr[i] : 0) + 0.16 * wr[i] * fade;
  }
  return { L, R };
}

/** Les six frequences metalliques de la 808 (Hz) : la matiere des charleys et de la cymbale. */
const METAL_HZ = [205.3, 304.4, 369.6, 522.7, 540, 800] as const;

/**
 * Charleys : les six carres metalliques (phases au hasard par variante),
 * filtres en bande vers 9.5 kHz et passe-haut 7 kHz, un voile de bruit
 * au-dessus de 8 kHz, un peu d'air a 12 kHz (le cristal), adoucis
 * au-dessus de 16 kHz. decay : la tenue
 * principale (s), tail : la queue (part, s).
 */
function hat(sr: number, ts: number, r: () => number, decay: number, tail: [number, number], lenS: number, bpHz: number): Shot {
  const fs = sr * OS;
  const len = Math.round(fs * Math.max(0.05, lenS * ts));
  const x = new Float64Array(len);
  const ph = METAL_HZ.map(() => r());
  const bp1 = new Bq('bp', bpHz, 1, fs);
  const bp2 = new Bq('bp', bpHz * 1.18, 1.2, fs);
  const hp1 = new Bq('hp', 7000, 0.7, fs);
  const hp2 = new Bq('hp', 7000, 0.7, fs);
  const nhp = new Bq('hp', 8000, 0.7, fs);
  const air = new Bq('hshelf', 12000, 0.7, fs, 1.5);
  const top = new Bq('lp', 16000, 0.7, fs);
  const d = decay * ts * (0.95 + 0.1 * r());
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    let m = 0;
    for (let k = 0; k < 6; k += 1) m += sq(ph[k] + (METAL_HZ[k] * t));
    m /= 6;
    const metal = hp2.run(hp1.run(0.6 * bp1.run(m) + 0.5 * bp2.run(m)));
    const noise = nhp.run(r() * 2 - 1);
    const env = (1 - Math.exp(-t / 0.0002)) * ((1 - tail[0]) * Math.exp(-t / d) + tail[0] * Math.exp(-t / (tail[1] * ts)));
    x[i] = top.run(air.run(1.6 * metal + 0.3 * noise)) * env;
  }
  fadeOut(x, fs, Math.min(0.03, len / fs / 3));
  const y = decimate(x);
  return { L: y, R: y };
}

/**
 * CY : douze carres (les metalliques x2 et x2.73), filtres vers 6.5 kHz
 * et au-dessus de 4.2 kHz, du bruit ; une attaque qui retombe vite (50 ms)
 * puis la nappe (550 ms). Gauche et droite ont leurs propres phases : la
 * cymbale est large.
 */
function cy(sr: number, ts: number, r: () => number): Shot {
  const fs = sr * OS;
  const lenS = Math.min(6, Math.max(0.3, 1.6 * ts));
  const len = Math.round(fs * lenS);
  const freqs = [...METAL_HZ.map((f) => f * 2), ...METAL_HZ.map((f) => f * 2.73)];
  const side = (): Float64Array => {
    const x = new Float64Array(len);
    const ph = freqs.map(() => r());
    const bp = new Bq('bp', 6500, 0.7, fs);
    const hp1 = new Bq('hp', 4200, 0.7, fs);
    const hp2 = new Bq('hp', 4200, 0.7, fs);
    const nhp = new Bq('hp', 6000, 0.7, fs);
    const air = new Bq('hshelf', 11000, 0.7, fs, 3);
    for (let i = 0; i < len; i += 1) {
      const t = i / fs;
      let m = 0;
      for (let k = 0; k < freqs.length; k += 1) m += sq(ph[k] + freqs[k] * t);
      m /= freqs.length;
      const env = (1 - Math.exp(-t / 0.001)) * (0.55 * Math.exp(-t / 0.05) + 0.45 * Math.exp(-t / (0.55 * ts)));
      x[i] = air.run(hp2.run(hp1.run(bp.run(m))) * 2 + 0.35 * nhp.run(r() * 2 - 1)) * env;
    }
    fadeOut(x, fs, Math.min(0.15, lenS / 4));
    return x;
  };
  return { L: decimate(side()), R: decimate(side()) };
}

/**
 * Toms : un sinus qui se pose (from -> to Hz), son second mode (x1.59,
 * bref), la frappe de la baguette (bruit vers 1.1 kHz, 4 ms), sature.
 */
function tom(sr: number, ts: number, r: () => number, to: number, from: number, tau: number): Shot {
  const fs = sr * OS;
  const len = Math.round(fs * Math.max(0.12, 0.45 * ts * (tau / 0.17)));
  const x = new Float64Array(len);
  const bp = new Bq('bp', 1100, 1, fs);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    const f = to + (from - to) * Math.exp(-t / 0.035);
    p1 += f / fs;
    p2 += (f * 1.59) / fs;
    const a = (1 - Math.exp(-t / 0.0004)) * Math.exp(-t / (tau * ts));
    const v = Math.sin(TAU * p1) * a + 0.2 * Math.sin(TAU * p2) * Math.exp(-t / 0.03) + 0.3 * bp.run(r() * 2 - 1) * Math.exp(-t / 0.004);
    x[i] = sat(v, 1.5);
  }
  fadeOut(x, fs, 0.03);
  const y = decimate(x);
  dcBlock(y, sr, 30);
  return { L: y, R: y };
}

/* ---------------- les sons a la facon de la 909 et de la 808 (2026-10-04, audio/kit.ts) ---------------- */

/*
 * Le 909 et le 808 refaits (2026-10-12, Mika : "les 808 et 909 pour moi sonnent mal"). Mesure hors ligne de ceux
 * d'avant : le 909 tombait a 87 Hz des 10 ms (un vrai 909 : 230 Hz a 5 ms, 160 Hz a 10 ms), sa queue tenait
 * -20 dB a 610 ms et -40 dB a 1.1 s (un 909 s'eteint en 300 a 500 ms) et sa saturation (tanh 2.2) l'ecrasait a
 * 5 dB de facteur de crete : un sinus plat, long, sans claque. Le 808 n'avait ni la frappe de son pont en T (plus
 * d'une octave au-dessus de sa note pendant 5 a 6 ms) ni son soupir (de 56 a 49.5 Hz sur 150 ms), et sa queue
 * (-20 dB a 1 s, sature par un tanh 1.35) sonnait comme un sinus de synthe. Les sources :
 * - 808 : K. J. Werner, J. Abel, J. O. Smith, "A Physically-Informed, Circuit-Bendable, Digital Model of the
 *   Roland TR-808 Bass Drum Circuit", DAFx-14 : impulsion de 1 ms, pont en T vers 49.5 Hz, sa frequence
 *   relevee de plus d'une octave pendant environ 6 ms (la frappe "punchier, crisper"), le soupir par fuite
 *   (leur figure 11 : 57 Hz vers 10 ms, 49.5 Hz a 300 ms), TONE un passe-bas sur la sortie ;
 * - 909 : R. Whittle, "TR-909 sound mods" (firstpr.com.au) : un triangle arrondi en sinus par deux diodes tete
 *   beche, TUNE la duree d'une enveloppe qui part haut et redescend a la note ; G. Reid, Synth Secrets
 *   "Practical Bass Drum Synthesis" (SOS 2002) : ATTACK, une impulsion et du bruit passe-bas sous une enveloppe
 *   breve ; normalsounds.com : la note vers 55 Hz ; mesures d'enregistrements de 909 (tacowars/windsor, issues
 *   243 et 329) : 230 Hz a 5 ms, 160 Hz a 10 ms, la note (49 a 50 Hz) vers 80 ms, le corps a plein niveau
 *   50 a 80 ms, le clic au-dessus de 1 kHz vers -12 dB sous la crete, les alternances negatives 1.35 fois les
 *   positives pendant la frappe.
 * Chaque son est calcule en deux temps : la frappe (le balayage, le clic) a 4 x puis ramenee par le RIF, la queue
 * (la note posee) directement a sr, la meme formule et la meme phase (exacte, integree) : 3 a 10 fois moins de
 * calcul qu'avant (un 808 : 130 a 210 ms avant, 8 a 25 ms). Un DRIVE fort garde tout a 4 x (ses harmoniques ne se replient pas).
 */

/** La descente du 909 (SWEEP a x1), en fois la note moins 1 : deux segments, 5.8 fois la note au depart (354 Hz pour 52 Hz). */
const BD909_SWEEP = { a1: 4.56, t1: 0.00815, a2: 1.24, t2: 0.0193 } as const;
/** Le 808 : son pont en T releve (en fois la note moins 1) pendant `hold`, redescendu en `fall` ; son soupir. */
const BD808_PITCH = { shift: 1.1, hold: 0.0045, fall: 0.002, sigh: 0.18, sighT: 0.055 } as const;
/** Le corps du 808 apres son impulsion (s). */
const BD808_LAG = 0.001;

/**
 * La hauteur du kick de synthese a l'instant t (Hz), f0 sa note (kickHz) et sw la profondeur de SWEEP
 * (sweepDepth) : celle que le calcul joue et que les schemas de l'ecran dessinent (rytm/diagrams.ts).
 */
export function kickPitchHz(m: KitModel, f0: number, t: number, sw: number): number {
  if (m === '909') return f0 * (1 + sw * (BD909_SWEEP.a1 * Math.exp(-t / BD909_SWEEP.t1) + BD909_SWEEP.a2 * Math.exp(-t / BD909_SWEEP.t2)));
  if (m === '808') {
    const P = BD808_PITCH;
    const u = t - P.hold;
    const w = u <= 0 ? 1 : u >= P.fall ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * u) / P.fall);
    return f0 * (1 + sw * (P.shift * w + P.sigh * Math.exp(-t / P.sighT)));
  }
  return (52 + 125 * sw * Math.exp(-t / 0.009) + 22 * sw * Math.exp(-t / 0.045)) * (f0 / 52);
}

/** Sa phase en tours : l'integrale exacte de kickPitchHz (909, 808), la meme a 4 x et a sr. */
function kickPhase(m: KitModel, f0: number, t: number, sw: number): number {
  if (m === '909') {
    const S = BD909_SWEEP;
    return f0 * (t + sw * (S.a1 * S.t1 * (1 - Math.exp(-t / S.t1)) + S.a2 * S.t2 * (1 - Math.exp(-t / S.t2))));
  }
  const P = BD808_PITCH;
  const u = t - P.hold;
  const w = u <= 0 ? t : u >= P.fall ? P.hold + P.fall / 2 : P.hold + u / 2 + (P.fall / (2 * Math.PI)) * Math.sin((Math.PI * u) / P.fall);
  return f0 * (t + sw * (P.shift * w + P.sigh * P.sighT * (1 - Math.exp(-t / P.sighT))));
}

/** Le VCA du 909 : son enveloppe le sature au depart (le corps a plein niveau), puis il se ferme plus vite qu'une exponentielle sous -40 dB. */
const BD909_VCA = { sat: 2.5, close: 0.01 } as const;
/** Le niveau du corps du kick de synthese a l'instant t (0 a 1), tau la constante de DECAY (kickDecayS). */
export function kickAmp(m: KitModel, tau: number, t: number): number {
  if (m === '909') {
    const g = Math.tanh(BD909_VCA.sat * Math.exp(-t / tau)) / Math.tanh(BD909_VCA.sat);
    return (g * g) / (g + BD909_VCA.close);
  }
  return Math.exp(-t / tau);
}

/** Le facteur de DRIVE du 909 : les diodes de son triangle attaquees x0.6 (0) a x6 (127), x1 au depart (32, la machine d'origine). */
export const bd909Drive = (d: number): number => (d >= 0.25 ? Math.pow(6, (d - 0.25) / 0.75) : Math.pow(0.6, (0.25 - d) / 0.25));
/** La saturation de sortie du 808 (tanh k x / k) : presque rien au depart (k 0.4), franche a fond (k 4.5). */
export const bd808DriveK = (d: number): number => 0.1 + 4.4 * d * d;
/** La force du clic de chaque kick de synthese pour ATTACK (le 909 : impulsion et bruit ; le 808 : son impulsion de 1 ms ; MM : son clic feutre). */
export const kickClickAmt = (m: KitModel, a: number): number => (m === '909' ? 1.5 * a : m === '808' ? 1.3 * a : 0.36 * a);
/** Le passe-bas de l'impulsion du 808 (son TONE) pour ATTACK : 600 Hz a 7.2 kHz, 2.1 kHz au depart. */
export const bd808ToneHz = (a: number): number => 600 * Math.pow(12, a);

/** Les diodes du 909 : tanh(a x + b), b l'asymetrie (les alternances negatives plus amples pendant la frappe). */
const BD909_BIAS = 0.25;
/** La moyenne de tanh(a x + b) sur le triangle (x uniforme sur [-1, 1]) : retiree, le corps reste centre. */
function diodeMean(a: number): number {
  const lc = (v: number): number => Math.log(Math.cosh(v));
  return (lc(a + BD909_BIAS) - lc(-a + BD909_BIAS)) / (2 * a);
}

/** Le passage de la frappe a 4 x a la queue a sr : assez loin du bord du RIF (16 echantillons de sr de chaque cote). */
const HEAD_PAD = 24;

/**
 * Un kick en deux temps : `head` secondes a 4 x (tete(t) : la frappe entiere, ses filtres compris), ramenees par le
 * RIF, puis la queue a sr (queue(t) : la meme formule sans le clic, eteint) ; full : tout a 4 x.
 */
function twoRate(sr: number, lenS: number, headS: number, full: boolean, tete: (t: number) => number, queue: (t: number) => number): Float32Array {
  const fs = sr * OS;
  const n = Math.round(lenS * sr);
  if (full || headS >= lenS) {
    const x = new Float64Array(n * OS);
    for (let i = 0; i < x.length; i += 1) x[i] = tete(i / fs);
    fadeOut(x, fs, Math.min(0.05, lenS / 4));
    return decimate(x);
  }
  const J = Math.min(n, Math.round(headS * sr));
  const x = new Float64Array((J + HEAD_PAD) * OS);
  for (let i = 0; i < x.length; i += 1) x[i] = tete(i / fs);
  const h = decimate(x);
  const y = new Float32Array(n);
  y.set(h.subarray(0, J));
  for (let j = J; j < n; j += 1) y[j] = queue(j / sr);
  fadeOut(y, sr, Math.min(0.05, lenS / 4));
  return y;
}

/**
 * KICK 909 (2026-10-04, Mika : "le kick sonne flat.. met un kick de 909" ; refait le 2026-10-12, voir plus haut).
 * Le triangle (sa phase exacte) arrondi par les deux diodes, un rien asymetrique ; sa hauteur part de 5.8 fois
 * la note et redescend en deux segments (230 Hz a 5 ms, 160 Hz a 10 ms, 95 Hz a 20 ms, la note vers 80 ms pour
 * 52 Hz ; SWEEP x0 a x2) ; le VCA sature au depart (le corps plein pendant la frappe, -1 dB jusqu'a 50 ms au
 * depart) puis se ferme ; DECAY : sa constante, 35 ms a 245 ms (84 ms au depart : -20 dB vers 255 ms, -40 dB
 * vers 410 ms). ATTACK : une impulsion de 0.8 ms et du bruit sous 5 kHz, eteints en 2 ms (au depart, le haut
 * au-dessus de 1 kHz vers -12 dB sous la crete) ; DRIVE : l'attaque des diodes (bd909Drive, le triangle vers le
 * carre), puis une saturation douce de l'ensemble.
 */
function bd909(sr: number, ts: number, r: () => number, tw: ShotTweak): Shot {
  const fs = sr * OS;
  const f0 = kickHz('909', tw.tune);
  const tau = kickDecayS('909', tw.decay) * ts;
  const sw = sweepDepth(tw.sweep);
  const g = bd909Drive(tw.drive);
  const k = 1.6 * g;
  const c = diodeMean(k);
  const norm = 1 / Math.tanh(k + BD909_BIAS);
  const amt = kickClickAmt('909', tw.attack);
  const outK = 0.8;
  // Le clic : l'impulsion (passe-haut 250 Hz, puis passe-bas 7 kHz) et le bruit (passe-bas 5 kHz), sous leur enveloppe breve
  const pHp = new Bq('hp', 250, 0.6, fs);
  const pLp = new Bq('lp', 7000, 0.7, fs);
  const nLp = new Bq('lp', 5000, 0.7, fs);
  const body = (t: number): number => {
    const ph = kickPhase('909', f0, t, sw);
    const x = tri(ph + 0.25);
    return (Math.tanh(k * x + BD909_BIAS) - c) * norm * kickAmp('909', tau, t) * (1 - Math.exp(-t / 0.0003));
  };
  const tete = (t: number): number => {
    const pulse = pLp.run(pHp.run(t < 0.0008 ? 1 : 0));
    const noise = nLp.run(r() * 2 - 1) * Math.exp(-t / 0.002);
    return sat(body(t) + amt * (0.55 * pulse + 0.35 * noise), outK);
  };
  const queue = (t: number): number => sat(body(t), outK);
  // La longueur : jusqu'a -60 dB environ (le VCA ferme), au plus 2.5 s
  const lenS = Math.max(0.2, Math.min(2.5, 6.5 * tau + 0.03));
  const y = twoRate(sr, lenS, 0.1, g > 2, tete, queue);
  dcBlock(y, sr, 18);
  return { L: y, R: y };
}

/**
 * KICK 808 (refait le 2026-10-12, voir plus haut) : le pont en T qui sonne une sinusoide presque pure, sa
 * frappe (la note x2.1 pendant 4.5 ms, redescendue en 2 ms : la premiere alternance courte et forte) et son
 * soupir (+18 % qui retombent en 55 ms : 57 Hz a 10 ms, 52.5 Hz a 50 ms, 49 Hz ensuite pour 49 Hz) ; SWEEP les
 * deux, x0 a x2. L'impulsion de 1 ms qui le declenche passe aussi a la sortie (le petit tic), par le passe-bas
 * de TONE : ATTACK sa force et son passe-bas (bd808ToneHz). DECAY : la queue exponentielle, 55 ms a 660 ms
 * (168 ms au depart : -20 dB vers 370 ms, -40 dB vers 750 ms) ; DRIVE : presque propre au depart, sature a fond (bd808DriveK).
 */
function bd808(sr: number, ts: number, tw: ShotTweak): Shot {
  const fs = sr * OS;
  const f0 = kickHz('808', tw.tune);
  const tau = kickDecayS('808', tw.decay) * ts;
  const sw = sweepDepth(tw.sweep);
  const k = bd808DriveK(tw.drive);
  const amt = kickClickAmt('808', tw.attack);
  // L'impulsion par le "pulse shaper" (un passe-haut doux) puis le passe-bas de TONE
  const pHp = new Bq('hp', 90, 0.6, fs);
  const pLp = new Bq('lp', bd808ToneHz(tw.attack), 0.6, fs);
  // Le pont en T sonne des fronts de l'impulsion : son corps part 1 ms apres elle (la figure 10 de Werner et al. : +0.6
  // pendant l'impulsion, puis l'alternance negative la plus ample vers 3.5 ms)
  const body = (t: number): number => (t <= BD808_LAG ? 0 : -Math.sin(TAU * kickPhase('808', f0, t - BD808_LAG, sw)) * kickAmp('808', tau, t - BD808_LAG));
  const tete = (t: number): number => sat(body(t) + amt * pLp.run(pHp.run(t < 0.001 ? 1 : 0)), k);
  const queue = (t: number): number => sat(body(t), k);
  const lenS = Math.max(0.25, Math.min(3, 6.2 * tau + 0.03));
  const y = twoRate(sr, lenS, 0.03, k > 1.5, tete, queue);
  dcBlock(y, sr, 16);
  return { L: y, R: y };
}

/**
 * SNARE 909 : deux oscillateurs (175 et 330 Hz, qui se posent en 6 a 8 ms)
 * sous un bruit large (sous 7 kHz, au-dessus de 600 Hz, 110 ms) ; SNAPPY :
 * la part du bruit (0.3 a 2.1). Sec, sans piece : la 909.
 */
function sd909(sr: number, ts: number, r: () => number, tw: ShotTweak): Shot {
  const fs = sr * OS;
  // TUNE, DECAY, TONE de la caisse claire (2026-10-08, R3) : x1 au depart
  const ft = sdTuneFactor(tw.sdTune);
  const fc = sdToneFactor(tw.sdTone);
  const td = ts * sdDecayFactor(tw.sdDecay);
  const len = Math.round(fs * Math.max(0.15, 0.36 * td));
  const x = new Float64Array(len);
  const lp = new Bq('lp', 7000 * fc, 0.7, fs);
  const hp = new Bq('hp', 600 * fc, 0.7, fs);
  const snap = 0.3 + 3.6 * tw.snappy * 0.5;
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    p1 += (175 * ft * (1 + 0.6 * Math.exp(-t / 0.008))) / fs;
    p2 += (330 * ft * (1 + 0.3 * Math.exp(-t / 0.006))) / fs;
    const tone = Math.sin(TAU * p1) * Math.exp(-t / (0.06 * td)) + 0.6 * Math.sin(TAU * p2) * Math.exp(-t / (0.04 * td));
    const nEnv = (1 - Math.exp(-t / 0.0004)) * Math.exp(-t / (0.11 * td));
    x[i] = sat(0.9 * tone + snap * hp.run(lp.run(r() * 2 - 1)) * nEnv, 1.4);
  }
  fadeOut(x, fs, 0.03);
  const y = decimate(x);
  dcBlock(y, sr, 50);
  return { L: y, R: y };
}

/**
 * SNARE 808 : deux resonateurs (238 et 476 Hz, brefs) et le timbre, du
 * bruit au-dessus de 1.8 kHz (100 ms) ; SNAPPY : sa part (0.2 a 1.6).
 */
function sd808(sr: number, ts: number, r: () => number, tw: ShotTweak): Shot {
  const fs = sr * OS;
  const ft = sdTuneFactor(tw.sdTune);
  const fc = sdToneFactor(tw.sdTone);
  const td = ts * sdDecayFactor(tw.sdDecay);
  const len = Math.round(fs * Math.max(0.12, 0.3 * td));
  const x = new Float64Array(len);
  const hp = new Bq('hp', 1800 * fc, 0.7, fs);
  const snap = 0.2 + 2.8 * tw.snappy * 0.5;
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    p1 += (238 * ft * (1 + 0.08 * Math.exp(-t / 0.004))) / fs;
    p2 += (476 * ft) / fs;
    const tone = Math.sin(TAU * p1) * Math.exp(-t / (0.05 * td)) + 0.65 * Math.sin(TAU * p2) * Math.exp(-t / (0.035 * td));
    const nEnv = (1 - Math.exp(-t / 0.0005)) * Math.exp(-t / (0.1 * td));
    x[i] = sat(0.85 * tone + snap * hp.run(r() * 2 - 1) * nEnv, 1.2);
  }
  fadeOut(x, fs, 0.03);
  const y = decimate(x);
  dcBlock(y, sr, 60);
  return { L: y, R: y };
}

/** Les tenues des charleys : ferme, ferme tenu (pad CH tenu), ouvert. */
const HAT_KIND = { CH: 0, CHopen: 1, OH: 2 } as const;

/**
 * HATS 909 : plus de souffle que de metal (la 909 jouait des echantillons
 * de vraies cymbales, en 6 bits) : six carres plus aigus que ceux de la 808
 * (x1.47) en bande vers 11 kHz, autant de bruit au-dessus de 9 kHz, et le
 * grain des 6 bits (le signal arrondi au soixante-quatrieme) adouci
 * au-dessus de 15 kHz. Tenues : 35 ms, 120 ms, 320 ms.
 */
function hat909(sr: number, ts: number, r: () => number, id: 'CH' | 'CHopen' | 'OH'): Shot {
  const fs = sr * OS;
  const kind = HAT_KIND[id];
  const d = [0.035, 0.12, 0.32][kind] * ts * (0.95 + 0.1 * r());
  const len = Math.round(fs * Math.max(0.05, Math.min(1.5, 5 * d + 0.02)));
  const x = new Float64Array(len);
  const ph = METAL_HZ.map(() => r());
  const bp = new Bq('bp', 11000, 0.8, fs);
  const hp1 = new Bq('hp', 8000, 0.7, fs);
  const hp2 = new Bq('hp', 8000, 0.7, fs);
  const nhp = new Bq('hp', 9000, 0.7, fs);
  const top = new Bq('lp', 15000, 0.7, fs);
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    let m = 0;
    for (let k = 0; k < 6; k += 1) m += sq(ph[k] + METAL_HZ[k] * 1.47 * t);
    m /= 6;
    const env = (1 - Math.exp(-t / 0.0002)) * Math.exp(-t / d);
    const v = (0.8 * hp2.run(hp1.run(bp.run(m))) + 0.7 * nhp.run(r() * 2 - 1)) * env;
    x[i] = top.run(Math.round(v * 64) / 64);
  }
  fadeOut(x, fs, Math.min(0.03, len / fs / 3));
  const y = decimate(x);
  return { L: y, R: y };
}

/**
 * HATS 808 : le metal seul, les six carres de la 808 en deux bandes
 * etroites (3.44 et 7.1 kHz) puis au-dessus de 6.6 kHz, un soupcon de
 * bruit. Tenues : 45 ms, 180 ms, 400 ms.
 */
function hat808(sr: number, ts: number, r: () => number, id: 'CH' | 'CHopen' | 'OH'): Shot {
  const fs = sr * OS;
  const kind = HAT_KIND[id];
  const d = [0.045, 0.18, 0.4][kind] * ts * (0.95 + 0.1 * r());
  const len = Math.round(fs * Math.max(0.05, Math.min(1.8, 5 * d + 0.02)));
  const x = new Float64Array(len);
  const ph = METAL_HZ.map(() => r());
  const bp1 = new Bq('bp', 3440, 3, fs);
  const bp2 = new Bq('bp', 7100, 3, fs);
  const hp1 = new Bq('hp', 6600, 0.7, fs);
  const hp2 = new Bq('hp', 6600, 0.7, fs);
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    let m = 0;
    for (let k = 0; k < 6; k += 1) m += sq(ph[k] + METAL_HZ[k] * t);
    m /= 6;
    const env = (1 - Math.exp(-t / 0.0002)) * Math.exp(-t / d);
    x[i] = hp2.run(hp1.run(bp1.run(m) + 1.2 * bp2.run(m) + 0.05 * (r() * 2 - 1))) * env * 2.2;
  }
  fadeOut(x, fs, Math.min(0.03, len / fs / 3));
  const y = decimate(x);
  return { L: y, R: y };
}

/**
 * CLAP 909 et 808 : des rafales de bruit en bande (909 : trois, 8 ms
 * d'ecart, vers 1.15 kHz, une queue de 110 ms et une petite piece ; 808 :
 * quatre, 11 ms d'ecart, vers 1 kHz, une queue de 180 ms qui fait la piece).
 * La piece de la 909 seulement GATE ON (2026-10-04).
 */
function cpModel(sr: number, ts: number, r: () => number, m: '909' | '808', gate = false): Shot {
  const fs = sr * OS;
  const is909 = m === '909';
  const n = is909 ? 3 : 4;
  const gap = is909 ? 0.008 : 0.011;
  const offs = Array.from({ length: n }, (_, k) => (k === 0 ? 0 : k * gap + (r() - 0.5) * 0.0015));
  const tailT = offs[n - 1];
  const tailTau = (is909 ? 0.11 : 0.18) * ts;
  const len = Math.round(fs * (tailT + Math.max(0.12, 5 * tailTau)));
  const bp = new Bq('bp', is909 ? 1150 : 1000, is909 ? 2.2 : 1.8, fs);
  const hp = new Bq('hp', is909 ? 700 : 500, 0.7, fs);
  const x = new Float64Array(len);
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    let e = 0;
    for (let k = 0; k < n; k += 1) {
      const u = t - offs[k];
      if (u < 0) continue;
      const a = 1 - Math.exp(-u / 0.0003);
      e += k < n - 1 ? a * Math.exp(-u / 0.004) : a * Math.exp(-u / tailTau);
    }
    x[i] = sat(hp.run(bp.run(r() * 2 - 1)) * e * 2.2, 1.3);
  }
  fadeOut(x, fs, 0.03);
  const dry = decimate(x);
  if (!is909 || !gate) return { L: dry, R: dry };
  const total = dry.length + Math.round(0.1 * sr);
  const [wl, wr] = fdn(dry, sr, total, 0.35, 6500, 3, 0.5);
  const L = new Float32Array(total);
  const R = new Float32Array(total);
  for (let i = 0; i < total; i += 1) {
    const fade = i > total - 0.06 * sr ? 0.5 + 0.5 * Math.cos((Math.PI * (i - (total - 0.06 * sr))) / (0.06 * sr)) : 1;
    const d = i < dry.length ? dry[i] : 0;
    L[i] = d + 0.12 * wl[i] * fade;
    R[i] = d + 0.12 * wr[i] * fade;
  }
  return { L, R };
}

/**
 * TOMS 909 et 808 (TOM le grave, HT l'aigu) : la 909, un sinus un peu
 * pince qui se pose (de 1.5 fois la note, 50 ms) et du bruit a l'attaque ;
 * la 808, un sinus pur, a peine glisse, plus long.
 */
function tomModel(sr: number, ts: number, r: () => number, m: '909' | '808', high: boolean): Shot {
  const fs = sr * OS;
  const is909 = m === '909';
  const to = is909 ? (high ? 175 : 105) : high ? 160 : 90;
  const from = to * (is909 ? 1.5 : 1.2);
  const tau = (is909 ? (high ? 0.17 : 0.22) : high ? 0.25 : 0.35) * ts;
  const len = Math.round(fs * Math.max(0.12, Math.min(2, 5 * tau)));
  const x = new Float64Array(len);
  const bp = new Bq('bp', 1500, 0.9, fs);
  let ph = 0;
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    ph += (to + (from - to) * Math.exp(-t / (is909 ? 0.05 : 0.02))) / fs;
    const osc = is909 ? 0.85 * Math.sin(TAU * ph) + 0.15 * tri(ph + 0.25) : Math.sin(TAU * ph);
    const a = (1 - Math.exp(-t / 0.0004)) * Math.exp(-t / tau);
    const noise = (is909 ? 0.35 : 0.08) * bp.run(r() * 2 - 1) * Math.exp(-t / (is909 ? 0.02 : 0.004));
    x[i] = sat(osc * a + noise, is909 ? 1.6 : 1.1);
  }
  fadeOut(x, fs, 0.03);
  const y = decimate(x);
  dcBlock(y, sr, 30);
  return { L: y, R: y };
}

/** Calcule un son, cale par la regle d'avant (le kick sur sa crete, les autres sur SHOT_LOUD sous leur plafond). Deterministe : (son, variante, STRETCH, frequence). */
function ruleShot(id: ShotId, sr: number, stretch: number, variant: number, tw: ShotTweak): Shot {
  // STRETCH (2026-10-04) : le son a sa duree naturelle, puis etire en grains facon Impulse (audio/stretch.ts)
  const ts = 1;
  const seed = 0x9e3779b1 ^ (id.charCodeAt(0) * 7919 + id.charCodeAt(1) * 104729 + id.length * 131 + variant * 2654435761);
  const r = rng(seed);
  // Le kit (audio/kit.ts) : le son de la famille, a la facon d'une 909 ou d'une 808 ; MM : ceux d'avant
  const m = tw.model;
  let s: Shot;
  switch (id) {
    case 'BD':
      s = m === '909' ? bd909(sr, ts, r, tw) : m === '808' ? bd808(sr, ts, tw) : bd(sr, ts, r, tw);
      break;
    case 'SD':
      s = m === '909' ? sd909(sr, ts, r, tw) : m === '808' ? sd808(sr, ts, r, tw) : sd(sr, ts, r, tw);
      break;
    case 'TOM':
      s = m === 'mm' ? tom(sr, ts, r, 98, 168, 0.17) : tomModel(sr, ts, r, m, false);
      break;
    case 'HT':
      s = m === 'mm' ? tom(sr, ts, r, 165, 260, 0.13) : tomModel(sr, ts, r, m, true);
      break;
    case 'CH':
      s = m === '909' ? hat909(sr, ts, r, id) : m === '808' ? hat808(sr, ts, r, id) : hat(sr, ts, r, 0.016, [0.08, 0.05], 0.09, 9500);
      break;
    case 'CHopen':
      s = m === '909' ? hat909(sr, ts, r, id) : m === '808' ? hat808(sr, ts, r, id) : hat(sr, ts, r, 0.06, [0.25, 0.16], 0.32, 9200);
      break;
    case 'OH':
      s = m === '909' ? hat909(sr, ts, r, id) : m === '808' ? hat808(sr, ts, r, id) : hat(sr, ts, r, 0.09, [0.3, 0.28], 0.6, 8500);
      break;
    case 'CP':
      s = m === 'mm' ? cp(sr, ts, r, !!tw.gate) : cpModel(sr, ts, r, m, !!tw.gate);
      break;
    default:
      // CY (2026-10-05 : plus de RS ni de PC, huit voix)
      s = cy(sr, ts, r);
  }
  if (Math.abs(stretch - 1) > 1e-3) {
    if (s.L === s.R) {
      const one = timeStretch(s.L, stretch, sr);
      s = { L: one, R: one };
    } else s = { L: timeStretch(s.L, stretch, sr), R: timeStretch(s.R, stretch, sr) };
  }
  // Le niveau de la voix (2026-10-07) : le kick a sa crete, les autres a leur sonie sous leur plafond
  setLoudness(id, s, sr);
  return s;
}

/**
 * L'etalonnage d'un modele (2026-10-12) : ses reglages de depart (TUNE, ATTACK, DECAY, DRIVE, SWEEP, SNAPPY et ceux
 * de la caisse claire a leur milieu, GATE OFF), STRETCH 0, a la frequence de rendu (celle du contexte, divisee par la
 * hauteur de TONE) : les sons bruites tirent leur bruit echantillon par echantillon, la regle d'avant (une crete)
 * donnait a 44.1 kHz jusqu'a 2.9 dB d'ecart a ce qu'elle donnait a 48 kHz. Une fois par frequence, voix, modele et
 * variante (chaque variante a son gain : deux coups bruites sonnent pareil), garde ; un son a ses reglages de depart
 * se mesure lui-meme (rien de plus a calculer : les charleys, les toms, la cymbale, le kit de depart), un autre
 * calcule une fois celui de depart, en fond comme lui (jamais pendant la lecture).
 */
const TWEAK_DEF: Readonly<ShotTweak> = { model: 'mm', tune: 0.5, attack: 0.5, decay: 0.45, drive: 0.25, snappy: 0.5 };
const SYNTH_CAL = new Map<string, number>();
/** Les gains gardes au plus (frequences de rendu, voix, modeles, variantes) : bien plus que ce qu'une session demande. */
const CAL_KEEP = 256;
/** Le modele qui joue vraiment (la cymbale n'en a qu'un). */
const calModel = (id: ShotId, m: KitModel): KitModel => (id === 'CY' ? 'mm' : m);
/** Les reglages de tw sont-ils ceux de depart pour ce son ? (le son calcule est alors celui de l'etalonnage) */
function atDefault(id: ShotId, tw: ShotTweak): boolean {
  if (id === 'BD') return tw.tune === 0.5 && tw.attack === 0.5 && tw.decay === 0.45 && tw.drive === 0.25 && sweepDepth(tw.sweep) === 1;
  if (id === 'SD') return tw.snappy === 0.5 && !tw.gate && sdTuneFactor(tw.sdTune) === 1 && sdDecayFactor(tw.sdDecay) === 1 && sdToneFactor(tw.sdTone) === 1;
  if (id === 'CP') return !tw.gate;
  return true;
}
function synthCal(id: ShotId, m: KitModel, variant: number, sr: number, s?: Shot): number {
  const key = `${sr}|${id}|${calModel(id, m)}|${variant}`;
  let k = SYNTH_CAL.get(key);
  if (k === undefined) {
    k = calGain(id, shotMomentary(s ?? ruleShot(id, sr, 1, variant, { ...TWEAK_DEF, model: m }), sr));
    if (SYNTH_CAL.size >= CAL_KEEP) SYNTH_CAL.clear();
    SYNTH_CAL.set(key, k);
  }
  return k;
}

/**
 * Calcule un son a son niveau (2026-10-12) : la regle d'avant (ruleShot), puis le gain d'etalonnage de son modele
 * (synthCal) : a ses reglages de depart, chaque modele de chaque voix sort a la sonie de sa voix (SHOT_TARGET) ;
 * ses potards, STRETCH et TONE changent son niveau comme avant.
 */
export function renderShot(id: ShotId, sr: number, stretch: number, variant: number, tw: ShotTweak = TWEAK_MM): Shot {
  const s = ruleShot(id, sr, stretch, variant, tw);
  const self = Math.abs(stretch - 1) <= 1e-3 && atDefault(id, tw);
  calibrate(s, synthCal(id, tw.model, variant, sr, self ? s : undefined));
  return s;
}

/** Le son principal d'une famille (un echantillon d'une autre famille se cale comme lui, un sample lock). */
const FAMILY_SHOT: Readonly<Record<string, ShotId>> = { bd: 'BD', sd: 'SD', cp: 'CP', hh: 'CH', tom: 'TOM' };
const familyOfShot = (id: ShotId): string => (id === 'BD' ? 'bd' : id === 'SD' ? 'sd' : id === 'CP' ? 'cp' : id === 'TOM' || id === 'HT' ? 'tom' : 'hh');

/**
 * Un coup joue par un echantillon de Mika (2026-10-05, audio/sampledsp.ts) :
 * relu a sr avec les reglages de sa couche (TUNE, FINE, START, LEN, REV :
 * la page SMPL, 2026-10-08) et le caractere de sa famille (ATTACK, DRIVE du
 * kick ; SNAPPY de la caisse claire), etire par STRETCH comme les autres, et
 * sa crete calee comme celle du son calcule de sa voix (le kick comme le
 * 909, 1.5 dB sous BD) : changer de son ne change pas le niveau. Un
 * echantillon d'une autre famille (un sample lock, smp.from) garde le
 * caractere et le niveau de la sienne (une caisse claire sur la voie du kick
 * reste une caisse claire).
 */
export function renderSampleShot(id: ShotId, sr: number, stretch: number, pcm: SamplePcm, tw: ShotTweak): Shot {
  const l = tw.smp ?? SAMPLE_LAYER_DEFAULT;
  const { family, cal } = sampleCal(id, l);
  const s = sampleBody(pcm, sr, stretch, family, cal, tw, l);
  // Les reglages de depart (le fichier entier, a l'endroit, a sa hauteur) : cale sur lui-meme, le calcul d'avant ;
  // puis l'etalonnage du fichier (2026-10-12, sampleCalGain), qui le pose sur la sonie de sa voix
  if (atRest(l)) {
    setLoudness(cal, s, sr);
    calibrate(s, sampleCalGain(pcm, sr, family, cal, Math.abs(stretch - 1) <= 1e-3 && neutralChar(family, tw) ? s : undefined));
    return s;
  }
  const c = sampleCalGain(pcm, sr, family, cal);
  // Sinon le gain du fichier entier (revue de R3, 2026-10-08) : caler la part gardee sur elle-meme remontait la queue
  // a pleine voix (START a 50 % sur la caisse claire : +23 dB, un coup fort au lieu d'une fin douce) ; une
  // Elektron joue ce qui reste du fichier a son niveau. Jamais au-dessus du plafond de la voix.
  const p = cal === 'BD' && s.L !== s.R ? midPeak(s) : peakOf(s.L === s.R ? [s.L] : [s.L, s.R]);
  const k = refGain(pcm, sr, stretch, family, cal, tw);
  applyGain(s, p > 0 ? Math.min(k, shotCeiling(cal) / p) : k);
  calibrate(s, c);
  return s;
}

/**
 * L'etalonnage d'un echantillon (2026-10-12) : mesure une fois par fichier decode (ceux du site comme tout autre
 * SamplePcm, garde avec lui), par frequence de rendu et par voix ou il se cale, au repos (le fichier entier, a
 * l'endroit, a sa hauteur), ATTACK, DRIVE et SNAPPY a leur depart, GATE OFF : le gain qui pose sa regle d'avant sur
 * la sonie de sa voix. A la frequence de rendu (le fichier y est deja relu pour jouer, rien de plus a relire) : la
 * regle d'avant voit la crete du fichier relu, un peu plus haute entre ses echantillons (PSY 02 : 0.4 dB de moins a
 * 48 kHz qu'a 44.1 kHz). Ses reglages (SMPL, ATTACK, DRIVE...) changent ensuite son niveau comme avant ; LEVEL, VOL
 * et les niveaux des couches gardent leur sens. s : le coup au repos deja calcule a ces reglages (il se mesure lui-meme).
 */
const SAMPLE_CAL = new WeakMap<SamplePcm, Map<string, number>>();
/** Le caractere de la voix a son depart sur un echantillon de la famille (ATTACK et DRIVE du kick ; SNAPPY et GATE de la caisse claire). */
const neutralChar = (family: string, tw: ShotTweak): boolean =>
  family === 'bd' ? tw.attack === 0.5 && tw.drive === 0.25 : family === 'sd' ? tw.snappy === 0.5 && !tw.gate : true;
function sampleCalGain(pcm: SamplePcm, sr: number, family: string, cal: ShotId, s?: Shot): number {
  let m = SAMPLE_CAL.get(pcm);
  if (!m) {
    m = new Map();
    SAMPLE_CAL.set(pcm, m);
  }
  const key = `${sr}|${family}|${cal}`;
  let k = m.get(key);
  if (k === undefined) {
    let x = s;
    if (!x) {
      x = sampleBody(pcm, sr, 1, family, cal, TWEAK_DEF, SAMPLE_LAYER_DEFAULT);
      setLoudness(cal, x, sr);
    }
    k = calGain(cal, shotMomentary(x, sr));
    if (m.size >= 32) m.clear();
    m.set(key, k);
  }
  return k;
}

/** La famille dont un echantillon garde le caractere, et la voix sur laquelle il se cale (un sample lock : la sienne). */
function sampleCal(id: ShotId, l: Readonly<SampleLayer>): { family: string; cal: ShotId } {
  const family = l.from && FAMILY_SHOT[l.from] ? l.from : familyOfShot(id);
  const cal: ShotId = l.from && FAMILY_SHOT[l.from] && l.from !== familyOfShot(id) ? FAMILY_SHOT[l.from] : id;
  return { family, cal };
}

/** La couche SAMPLE a ses reglages de depart : TUNE et FINE a 0, START 0, LEN plein, a l'endroit. */
const atRest = (l: Readonly<SampleLayer>): boolean => l.st === 0 && l.start <= 0 && l.len >= 1 && !l.rev;

/**
 * L'echantillon relu (playSample), la porte de la caisse claire (GATE, revue
 * de R3), le kick en mono, etire par STRETCH ; pas encore a son niveau.
 */
function sampleBody(pcm: SamplePcm, sr: number, stretch: number, family: string, cal: ShotId, tw: ShotTweak, l: Readonly<SampleLayer>): Shot {
  let s: Shot = playSample(pcm, sr, { family, attack: tw.attack, drive: tw.drive, snappy: tw.snappy, st: l.st, start: l.start, len: l.len, rev: l.rev });
  if (family === 'sd' && tw.gate) s = gatedVerb(s.L, s.R, sr, 1);
  // Le kick en mono (2026-10-08, "un bon kick") : les fichiers ont un leger cote stereo (-28 a -44 dB, un decalage
  // L/R de quelques echantillons sur certains) ; le grave d'un kick se tient au centre
  if (cal === 'BD' && s.L !== s.R) s = monoLows(s.L, s.R, sr);
  if (Math.abs(stretch - 1) > 1e-3) {
    if (s.L === s.R) {
      const one = timeStretch(s.L, stretch, sr);
      s = { L: one, R: one };
    } else s = { L: timeStretch(s.L, stretch, sr), R: timeStretch(s.R, stretch, sr) };
  }
  return s;
}

/**
 * Le grave du kick au centre, le haut tel que le fichier (2026-10-12, Mika : "des problemes pour le son des BD,
 * surtout des samples que j'ai choisis"). La somme mono de 2026-10-08 tenait bien le grave, mais elle mangeait le
 * cote stereo de la frappe : AFFKT perdait 4 a 6 dB au-dessus de 6 kHz sur chaque canal, Stein 0.6 dB au-dessus de
 * 12 kHz, leur clic sonnait plus terne que le fichier. Le milieu reste la somme d'avant, au bit pres ; le cote passe
 * par un passe-haut (Butterworth, 150 Hz, 12 dB par octave) : sous 150 Hz le kick est mono comme avant, au-dessus il
 * a sa largeur. Un cote (au-dessus de 150 Hz) sous -40 dB du milieu (BLUEPRINT, VNTM, ENGELHARDT, CARASSI) : la
 * somme mono d'avant, rien de plus.
 */
const KICK_MONO_HZ = 150;
function monoLows(L: Float32Array, R: Float32Array, sr: number): Shot {
  const n = Math.min(L.length, R.length);
  const m = new Float32Array(n);
  const side = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    m[i] = 0.5 * (L[i] + R[i]);
    side[i] = 0.5 * (L[i] - R[i]);
  }
  const w = Math.tan((Math.PI * KICK_MONO_HZ) / sr);
  const q = Math.SQRT2;
  const a0 = 1 + q * w + w * w;
  const hs = biquad(side, 1 / a0, -2 / a0, 1 / a0, (2 * (w * w - 1)) / a0, (1 - q * w + w * w) / a0);
  let em = 0;
  let es = 0;
  for (let i = 0; i < n; i += 1) {
    em += m[i] * m[i];
    es += hs[i] * hs[i];
  }
  if (es <= 1e-4 * em) return { L: m, R: m };
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    l[i] = m[i] + hs[i];
    r[i] = m[i] - hs[i];
  }
  return { L: l, R: r };
}

/** Le gain du fichier entier, par echantillon decode et par reglage de caractere (un calcul par cle, garde). */
const REF_GAIN = new WeakMap<SamplePcm, Map<string, number>>();
function refGain(pcm: SamplePcm, sr: number, stretch: number, family: string, cal: ShotId, tw: ShotTweak): number {
  let m = REF_GAIN.get(pcm);
  if (!m) {
    m = new Map();
    REF_GAIN.set(pcm, m);
  }
  const key = `${sr}|${stretch}|${family}|${cal}|${tw.attack}|${tw.drive}|${tw.snappy}|${family === 'sd' && tw.gate ? 1 : 0}`;
  let k = m.get(key);
  if (k === undefined) {
    k = loudGain(cal, sampleBody(pcm, sr, stretch, family, cal, tw, SAMPLE_LAYER_DEFAULT), sr);
    if (m.size > 64) m.clear();
    m.set(key, k);
  }
  return k;
}

/** La crete au-dessus de laquelle une voix ne monte jamais (celle du kick, moins SHOT_BELOW de la voix). */
export const shotCeiling = (id: ShotId): number => Math.pow(10, (SHOT_KICK_PEAK - SHOT_BELOW[id]) / 20);

/** Le gain d'une couche a son niveau (LEVEL 0 a 1, au carre : 1 la couche telle que calee, 0 muette). */
export const layerGain = (v: number): number => {
  const c = Math.max(0, Math.min(1, v));
  return c * c;
};

/** La marge de crete d'un coup a deux couches (dB) : leurs attaques s'additionnent, la somme peut monter un peu au-dessus de la voix seule. */
const LAYER_HEADROOM_DB = 2;

/**
 * Le coup complet d'une voix, ses deux couches ensemble (2026-10-08, l'etape
 * R3, Mika : "une machine pour la configuration a la main du Voice pour avoir
 * des samples et aussi une configuration digitale du BD ou SD.. comme la
 * ANALOG Rytm") : la couche SYNTH (renderShot, son modele et ses potards) a
 * son niveau, plus la couche SAMPLE (renderSampleShot) au sien, chacune deja
 * calee sur le niveau de sa voix (le kick a sa crete). Une seule couche (l'autre
 * a 0 ou OFF) : exactement ce coup-la a son niveau, le son d'avant R3 a 127.
 * Les deux : leur somme prend la sonie de la plus forte des deux (a son
 * niveau), comme deux pistes calees sur une console : monter la synthese sous
 * un sample change son grain sans faire sauter la voix (mesure sur les six
 * kicks de Mika et le 909 a 127 : en calant la somme sur la crete, elle
 * perdait 1 a 4 dB de sonie, leurs attaques s'additionnant) ; sa crete au plus
 * LAYER_HEADROOM_DB au-dessus de la plus haute des deux couches (2026-10-12 :
 * chacune etalonnee sur la sonie de sa voix ; avant, au-dessus du plafond de la
 * voix, et une autre voix jamais a moins de 0.5 dB sous la crete du kick). Les deux
 * a 0 : un coup muet. pcm : l'echantillon decode de la couche SAMPLE
 * (audio/samples.ts) ; sans lui, la couche SAMPLE ne joue pas.
 */
export function renderLayers(id: ShotId, sr: number, stretch: number, variant: number, tw: ShotTweak, pcm?: SamplePcm): Shot {
  const syn = tw.syn ?? 1;
  const lev = tw.smp?.lev ?? 1;
  const withSample = !!tw.sample && !!pcm && lev > 0;
  if (!withSample) {
    if (syn <= 0) return silent();
    const a = renderShot(id, sr, stretch, variant, tw);
    return syn >= 1 ? a : scaled(a, layerGain(syn));
  }
  const b = renderSampleShot(id, sr, stretch, pcm as SamplePcm, tw);
  if (syn <= 0) return lev >= 1 ? b : scaled(b, layerGain(lev));
  const a = renderShot(id, sr, stretch, variant, tw);
  const ga = layerGain(syn);
  const gb = layerGain(lev);
  const n = Math.max(a.L.length, b.L.length);
  const mono = a.L === a.R && b.L === b.R;
  const mix = (x: Float32Array, y: Float32Array): Float32Array => {
    const out = new Float32Array(n);
    for (let i = 0; i < x.length; i += 1) out[i] = ga * x[i];
    for (let i = 0; i < y.length; i += 1) out[i] += gb * y[i];
    return out;
  };
  const L = mix(a.L, b.L);
  const R = mono ? L : mix(a.R, b.R);
  const sum: Shot = { L, R };
  // La sonie de la plus forte des deux couches a son niveau, sous le plafond de crete ; un sample emprunte a une
  // autre famille (un sample lock, SYN LEVEL verrouille avec lui) garde au moins le plafond de la sienne (revue de R3 :
  // un kick sur la voie des charleys jouait 5 dB sous son niveau). Depuis le 2026-10-12, la sonie momentanee de
  // l'etalonnage (shotMomentary), et le plafond : LAYER_HEADROOM_DB au-dessus de la plus haute crete des deux couches
  // (chacune deja etalonnee sur sa voix, un sample lock sur la sienne), jamais au-dessus de SHOT_MAX_PEAK
  const target = Math.max(shotMomentary(a, sr) + 20 * Math.log10(ga), shotMomentary(b, sr) + 20 * Math.log10(gb));
  const p = peakOf(mono ? [L] : [L, R]);
  let k = Math.pow(10, (target - shotMomentary(sum, sr)) / 20);
  const top = Math.max(ga * peakOf(a.L === a.R ? [a.L] : [a.L, a.R]), gb * peakOf(b.L === b.R ? [b.L] : [b.L, b.R]));
  const cap = Math.min(SHOT_MAX_PEAK, top * Math.pow(10, LAYER_HEADROOM_DB / 20));
  if (p > 0) k = Math.min(k, cap / p);
  if (Number.isFinite(k) && k > 0 && k !== 1) {
    for (let i = 0; i < n; i += 1) L[i] *= k;
    if (R !== L) for (let i = 0; i < n; i += 1) R[i] *= k;
  }
  return sum;
}

/** Un coup muet (les deux couches a 0) : 10 ms de silence. */
function silent(): Shot {
  const z = new Float32Array(480);
  return { L: z, R: z };
}

/** Une couche a son niveau (une copie : le coup cale reste le meme). */
function scaled(s: Shot, g: number): Shot {
  const L = Float32Array.from(s.L, (v) => v * g);
  return { L, R: s.R === s.L ? L : Float32Array.from(s.R, (v) => v * g) };
}
