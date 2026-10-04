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
 *   douceur, puis normalise a sa crete (SHOT_PEAK) ;
 * - la caisse claire a sa reverbe a porte (un FDN a 8 lignes, stereo,
 *   coupee net apres 130 ms) ; le clap une petite piece ;
 * - les sons bruites ont plusieurs variantes (VARIANTS), jouees en
 *   alternance : deux coups ne sont jamais le meme echantillon.
 * Un echantillon depend de son STRETCH (la duree des enveloppes) :
 * arrondi au huitieme de facteur 4 (shotKey), calcule a la demande et
 * garde (cache, LRU). shots.warm() prepare ceux de STRETCH 0, dans un
 * worker, des que le contexte existe.
 */

import type { Inst } from '../theme';

export type ShotId = Inst | 'CHopen';

/** Surechantillonnage du calcul. */
const OS = 4;
const TAU = Math.PI * 2;

/**
 * Crete de chaque son apres normalisation (dB, au-dessus de 0 permis : le
 * signal reste en flottant jusqu'au limiteur). L'equilibre du kit et son
 * niveau face au MM-ARP (2026-10-03, Mika : "le MM-RYTM sonne moins fort") :
 * dans les mediums (au-dessus de 500 Hz), apres le compresseur commun, la
 * batterie etait 6 dB sous l'arpege ; ces cretes la ramenent a sa hauteur.
 */
export const SHOT_PEAK: Readonly<Record<ShotId, number>> = {
  BD: -0.5,
  SD: 3,
  TOM: 1.5,
  CH: -2,
  CHopen: -3,
  OH: -3,
  // CP : 3.5 jusqu'au 2026-10-04 (Mika : "le clap est vraiment trop intense"), 5.5 dB plus bas
  CP: -2,
  RS: -0.5,
  HT: 1,
  CY: -5,
  PC: 0.5,
};

/** Variantes jouees en alternance (sons bruites). */
export const VARIANTS: Readonly<Record<ShotId, number>> = {
  BD: 1,
  SD: 3,
  TOM: 1,
  CH: 4,
  CHopen: 2,
  OH: 3,
  CP: 3,
  RS: 2,
  HT: 1,
  CY: 2,
  PC: 2,
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

export interface Shot {
  L: Float32Array;
  R: Float32Array;
}

/* ---------------- les sons ---------------- */

/**
 * BD, la balle de tennis : un sinus qui tombe de 380 a 50 Hz (deux
 * vitesses : 11 ms puis 55 ms), sature (tanh, un soupcon de pair pour la
 * chaleur) : ses harmoniques le font entendre meme sur un telephone ; et le
 * "pok" de la balle, un sinus a 1.15 kHz de 7 ms et un souffle en bande vers
 * 2.2 kHz de 3 ms. Corps court (130 ms) : il frappe, il ne traine pas.
 */
function bd(sr: number, ts: number, r: () => number): Shot {
  const fs = sr * OS;
  const len = Math.round(fs * Math.max(0.16, 0.46 * ts));
  const x = new Float64Array(len);
  const bp = new Bq('bp', 2200, 0.9, fs);
  const tauA = 0.13 * ts;
  let ph = 0;
  let pk = 0;
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    const f = 50 + 290 * Math.exp(-t / 0.011) + 40 * Math.exp(-t / 0.055);
    ph += f / fs;
    const amp = (1 - Math.exp(-t / 0.0004)) * Math.exp(-t / tauA) * (1 + 0.55 * Math.exp(-t / 0.016));
    const b = Math.sin(TAU * ph) * amp;
    const body = Math.tanh(3.2 * b + 0.15 * b * b);
    pk += 1150 / fs;
    const knock = 0.35 * Math.sin(TAU * pk) * Math.exp(-t / 0.007) + 0.7 * bp.run(r() * 2 - 1) * Math.exp(-t / 0.003);
    x[i] = body + knock;
  }
  fadeOut(x, fs, Math.min(0.04, len / fs / 4));
  const y = decimate(x);
  dcBlock(y, sr, 24);
  return { L: y, R: y };
}

/**
 * SD, la caisse qui eblouit : la peau (185 Hz qui se pose, son second mode
 * a 330 Hz, le fut a 540 Hz), le timbre (bruit passe-haut 1.2 kHz, une
 * bosse a 4.5 kHz, un peu d'air a 10 kHz, adouci au-dessus de 15 kHz : la
 * brillance sans le sifflement), le claquement (bruit vers 2.5 kHz, 2 ms),
 * le tout sature en douceur. Puis la petite reverbe a
 * porte : une piece claire (RT60 1.1 s, en stereo) a -10 dB, ouverte 130 ms
 * et fermee en 40 ms.
 */
function sd(sr: number, ts: number, r: () => number): Shot {
  const fs = sr * OS;
  const dryS = Math.max(0.12, 0.3 * ts);
  const len = Math.round(fs * dryS);
  const x = new Float64Array(len);
  const hp1 = new Bq('hp', 1200, 0.7, fs);
  const pkF = new Bq('peak', 4500, 0.9, fs, 4);
  const air = new Bq('hshelf', 10000, 0.7, fs, 1.5);
  const top = new Bq('lp', 15000, 0.7, fs);
  const crackBp = new Bq('bp', 2500, 1, fs);
  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    p1 += (185 + 30 * Math.exp(-t / 0.01)) / fs;
    p2 += 330 / fs;
    p3 += 540 / fs;
    const body = Math.sin(TAU * p1) * Math.exp(-t / (0.045 * ts)) + 0.45 * Math.sin(TAU * p2) * Math.exp(-t / 0.025) + 0.35 * Math.sin(TAU * p3) * Math.exp(-t / 0.012);
    const n = r() * 2 - 1;
    const wiresEnv = (1 - Math.exp(-t / 0.0005)) * (0.85 * Math.exp(-t / (0.05 * ts)) + 0.15 * Math.exp(-t / (0.13 * ts)));
    const wires = top.run(air.run(pkF.run(hp1.run(n)))) * wiresEnv;
    const crack = crackBp.run(r() * 2 - 1) * Math.exp(-t / 0.002);
    x[i] = sat(0.8 * body + 1.5 * wires + 2 * crack, 1.3);
  }
  fadeOut(x, fs, 0.03);
  const dry = decimate(x);
  dcBlock(dry, sr, 60);
  // La reverbe a porte : ouverte `hold`, fermee en 40 ms
  const hold = 0.13 * Math.min(1.6, Math.max(0.7, ts));
  const close = 0.04;
  const total = Math.max(dry.length, Math.round((hold + close + 0.01) * sr));
  const [wl, wr] = fdn(dry, sr, total, 1.1, 7500, 6, 0.8);
  const L = new Float32Array(total);
  const R = new Float32Array(total);
  const wet = 0.32;
  for (let i = 0; i < total; i += 1) {
    const t = i / sr;
    const gate = t < hold ? 1 : t < hold + close ? 0.5 + 0.5 * Math.cos((Math.PI * (t - hold)) / close) : 0;
    const d = i < dry.length ? dry[i] : 0;
    L[i] = d + wet * gate * wl[i];
    R[i] = d + wet * gate * wr[i];
  }
  return { L, R };
}

/**
 * CP : quatre mains qui ne tombent pas ensemble (0, 9.5, 19, 31 ms, a
 * 1.5 ms pres d'une variante a l'autre, un rien decalees entre gauche et
 * droite), du bruit en bande vers 1.25 kHz, une bosse douce a 2.6 kHz ; la
 * derniere tient 75 ms. Une petite piece (RT60 0.45 s) a -16 dB. Adouci le
 * 2026-10-04 (moins sature, moins de bosse, moins de piece, 5.5 dB plus bas).
 */
function cp(sr: number, ts: number, r: () => number): Shot {
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

/** RS : le bois du cercle (triangles a 980 et 290 Hz, plus bas que la 808, voulu par Mika), un claquement vers 3.5 kHz. */
function rs(sr: number, ts: number, r: () => number): Shot {
  const fs = sr * OS;
  const len = Math.round(fs * Math.max(0.06, 0.12 * ts));
  const x = new Float64Array(len);
  const bp = new Bq('bp', 3500, 1.2, fs);
  const hp = new Bq('hp', 180, 0.7, fs);
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    const a = (1 - Math.exp(-t / 0.0002)) * Math.exp(-t / (0.022 * ts));
    const v = (tri(980 * t) + 0.8 * tri(290 * t)) * a + 0.9 * bp.run(r() * 2 - 1) * Math.exp(-t / 0.0012);
    x[i] = sat(hp.run(v), 1.6);
  }
  fadeOut(x, fs, 0.02);
  const y = decimate(x);
  return { L: y, R: y };
}

/** PC : la conga grave (200 Hz, voulue par Mika) : la peau qui se pose, son mode x1.5, la claque vers 1.6 kHz. */
function pc(sr: number, ts: number, r: () => number): Shot {
  const fs = sr * OS;
  const len = Math.round(fs * Math.max(0.1, 0.32 * ts));
  const x = new Float64Array(len);
  const bp = new Bq('bp', 1600, 1.1, fs);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < len; i += 1) {
    const t = i / fs;
    const f = 200 + 50 * Math.exp(-t / 0.008);
    p1 += f / fs;
    p2 += (f * 1.5) / fs;
    const a = (1 - Math.exp(-t / 0.0004)) * Math.exp(-t / (0.075 * ts));
    const v = Math.sin(TAU * p1) * a + 0.3 * Math.sin(TAU * p2) * Math.exp(-t / 0.02) + 0.55 * bp.run(r() * 2 - 1) * Math.exp(-t / 0.005);
    x[i] = sat(v, 1.4);
  }
  fadeOut(x, fs, 0.03);
  const y = decimate(x);
  dcBlock(y, sr, 40);
  return { L: y, R: y };
}

/** Calcule un son, normalise a sa crete (SHOT_PEAK). Deterministe : (son, variante, STRETCH, frequence). */
export function renderShot(id: ShotId, sr: number, ts: number, variant: number): Shot {
  const seed = 0x9e3779b1 ^ (id.charCodeAt(0) * 7919 + id.charCodeAt(1) * 104729 + id.length * 131 + variant * 2654435761);
  const r = rng(seed);
  let s: Shot;
  switch (id) {
    case 'BD':
      s = bd(sr, ts, r);
      break;
    case 'SD':
      s = sd(sr, ts, r);
      break;
    case 'TOM':
      s = tom(sr, ts, r, 98, 168, 0.17);
      break;
    case 'HT':
      s = tom(sr, ts, r, 165, 260, 0.13);
      break;
    case 'CH':
      s = hat(sr, ts, r, 0.016, [0.08, 0.05], 0.09, 9500);
      break;
    case 'CHopen':
      s = hat(sr, ts, r, 0.06, [0.25, 0.16], 0.32, 9200);
      break;
    case 'OH':
      s = hat(sr, ts, r, 0.09, [0.3, 0.28], 0.6, 8500);
      break;
    case 'CP':
      s = cp(sr, ts, r);
      break;
    case 'RS':
      s = rs(sr, ts, r);
      break;
    case 'CY':
      s = cy(sr, ts, r);
      break;
    default:
      s = pc(sr, ts, r);
  }
  const p = peakOf(s.L === s.R ? [s.L] : [s.L, s.R]);
  const k = p > 0 ? Math.pow(10, SHOT_PEAK[id] / 20) / p : 1;
  for (let i = 0; i < s.L.length; i += 1) s.L[i] *= k;
  if (s.R !== s.L) for (let i = 0; i < s.R.length; i += 1) s.R[i] *= k;
  return s;
}

