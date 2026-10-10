/**
 * Un echantillon de Mika joue par une voix du MM-RYTM (2026-10-05, Mika :
 * "je voudrais que tu mettes ces samples dans le selecteur de samples, pour
 * BD et SD"). Calcul pur (sans DOM : testable sous Node), comme
 * audio/shotsdsp.ts : le fichier decode (audio/samples.ts) est relu a la
 * frequence de rendu.
 *
 * La couche SAMPLE (2026-10-08, l'etape R3, Mika : "comme la ANALOG Rytm ou
 * on peut mettre des samples mais le kick peut etre parametre comme une
 * machine") : l'echantillon est une couche de la voix, sous la couche SYNTH
 * (audio/shotsdsp.ts renderLayers), avec ses reglages a elle (la page SMPL) :
 * - TUNE et FINE : sa hauteur, en demi-tons et en cents (le fichier relu plus
 *   vite ou plus lentement, interpolation Hermite : le calcul est fait une
 *   fois, jamais a la lecture) ;
 * - START : ou il commence dans le fichier (0 a 90 %) ;
 * - LEN : la part gardee apres START (12 % a 100 %), la fin en fondu
 *   (cosinus) sur la seconde moitie de cette part, comme DECAY d'avant ;
 * - REV : le fichier a l'envers (START et LEN comptent depuis sa fin).
 * Le caractere de la voix reste aux potards de la machine (SRC), sur les deux
 * couches : le KICK ATTACK (5 : la frappe du fichier ; plus haut elle claque,
 * jusqu'a +6 dB sur ses 4 premieres ms ; plus bas une montee jusqu'a 6 ms) et
 * DRIVE (a 2.5 et dessous, propre ; au-dessus une saturation douce, tanh) ;
 * la SNARE SNAPPY (5 : le fichier ; plus haut plus de claquant au-dessus de
 * 2 kHz, plus bas plus sourd). Les autres familles le jouent tel quel. Le
 * niveau est cale ensuite comme celui des sons calcules (renderSampleShot,
 * audio/shotsdsp.ts).
 * Avant R3, TUNE et DECAY du KICK reglaient l'echantillon (sampleTuneSt,
 * sampleDecayPart) : un kit ou un preset d'avant se traduit avec eux
 * (audio/kit.ts), au meme son.
 */

export interface SamplePcm {
  L: Float32Array;
  /** null : mono */
  R: Float32Array | null;
  /** la frequence du decodage */
  sr: number;
}

/** Ce qu'un echantillon sait de sa voix : sa famille (son caractere), les potards de la machine (0 a 1), et ses reglages de couche. */
export interface SampleTweak {
  family: string;
  attack: number;
  drive: number;
  snappy: number;
  /** sa hauteur en demi-tons (TUNE et FINE ensemble ; 0 : la hauteur du fichier) */
  st: number;
  /** START, 0 a 1 (fois START_MAX du fichier) */
  start: number;
  /** LEN, 0 a 1 : la part gardee, 12 % a 100 % (1 : tout) */
  len: number;
  /** REV : a l'envers */
  rev: boolean;
}

/** START au plus : 90 % du fichier (au-dela presque rien ne sonnerait). */
export const SAMPLE_START_MAX = 0.9;
/** La part gardee pour LEN (12 % a 100 %). */
export const sampleLenPart = (len: number): number => (len >= 1 ? 1 : 0.12 + 0.88 * Math.max(0, len));
/**
 * La fin de LEN (2026-10-10, Mika : "quand j'ajuste le BD LENGTH ce n'est
 * pas vraiment super precis") : un fondu court juste avant la coupe, 12 %
 * de la part gardee, de 6 a 25 ms (jamais plus de sa moitie). Avant, le
 * fondu prenait toute la seconde moitie de la part : le coup baissait des
 * son milieu et l'oreille ne trouvait pas ou il s'arretait ; il garde
 * maintenant son corps jusqu'a la duree affichee (rytm/values.ts layerUnit).
 */
export const SAMPLE_LEN_FADE = { part: 0.12, minS: 0.006, maxS: 0.025 } as const;
/** Le fondu de fin de LEN, en secondes, pour une part gardee de keptS secondes. */
export const sampleLenFadeS = (keptS: number): number =>
  Math.min(keptS * 0.5, Math.max(SAMPLE_LEN_FADE.minS, Math.min(SAMPLE_LEN_FADE.maxS, keptS * SAMPLE_LEN_FADE.part)));
/** LEN d'apres le DECAY d'un kit d'avant R3 (sampleDecayPart) : la meme part. */
export const lenOfDecay = (decay: number): number => (decay >= 0.45 ? 1 : Math.max(0, decay) / 0.45);

/** TUNE d'un echantillon : -12 a +12 demi-tons, 0 au milieu. */
export const sampleTuneSt = (v: number): number => Math.round((Math.min(1, Math.max(0, v)) - 0.5) * 24);
/** DECAY d'un echantillon : la part de sa duree qu'il garde (1 de 0.45 a 1). */
export const sampleDecayPart = (v: number): number => (v >= 0.45 ? 1 : 0.12 + 0.88 * (Math.max(0, v) / 0.45));

/** Lecture interpolee (Hermite, Catmull-Rom) d'un canal en x (fractionnaire). */
function hermite(x: Float32Array, pos: number): number {
  const i = Math.floor(pos);
  const f = pos - i;
  const n = x.length;
  const xm1 = i - 1 >= 0 && i - 1 < n ? x[i - 1] : 0;
  const x0 = i >= 0 && i < n ? x[i] : 0;
  const x1 = i + 1 < n ? x[i + 1] : 0;
  const x2 = i + 2 < n ? x[i + 2] : 0;
  const c1 = 0.5 * (x1 - xm1);
  const c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2;
  const c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
  return ((c3 * f + c2) * f + c1) * f + x0;
}

/** Le canal relu a srOut depuis off (START), hauteur et longueur comprises. */
function readChannel(x: Float32Array, srIn: number, srOut: number, ratio: number, nOut: number, off = 0): Float32Array {
  const out = new Float32Array(nOut);
  const step = (ratio * srIn) / srOut;
  if (off === 0) for (let i = 0; i < nOut; i += 1) out[i] = hermite(x, i * step);
  else for (let i = 0; i < nOut; i += 1) out[i] = hermite(x, off + i * step);
  return out;
}

/**
 * L'echantillon pret a jouer, a srOut (la frequence de rendu : celle du
 * contexte divisee par la hauteur de TONE, audio/shots.ts) ; L === R s'il
 * est mono. Aux reglages de depart (TUNE 0, START 0, LEN 1, endroit), le
 * calcul d'avant R3, au meme echantillon pres.
 */
export function playSample(p: SamplePcm, srOut: number, tw: SampleTweak): { L: Float32Array; R: Float32Array } {
  const kick = tw.family === 'bd';
  const snare = tw.family === 'sd';
  const ratio = tw.st === 0 ? 1 : Math.pow(2, tw.st / 12);
  // REV : le fichier a l'envers (une copie : le fichier decode sert aux autres coups)
  const srcs = p.R ? [p.L, p.R] : [p.L];
  const chans = tw.rev ? srcs.map((x) => Float32Array.from(x).reverse()) : srcs;
  // START : les premiers echantillons sautes (en echantillons du fichier)
  const off = tw.start > 0 ? Math.round(Math.min(1, tw.start) * SAMPLE_START_MAX * p.L.length) : 0;
  const durIn = (p.L.length - off) / p.sr;
  let nOut = Math.max(1, Math.ceil((durIn / ratio) * srOut));
  // LEN : la part gardee, puis un fondu court (cosinus) juste avant la coupe (SAMPLE_LEN_FADE)
  const part = sampleLenPart(tw.len);
  const end = Math.max(1, Math.round(nOut * part));
  nOut = Math.min(nOut, end + 1);
  const outs = chans.map((x) => readChannel(x, p.sr, srOut, ratio, nOut, off));
  const fade0 = part < 1 ? end - Math.max(1, Math.round(sampleLenFadeS(end / srOut) * srOut)) : nOut;
  // ATTACK : une frappe en plus (une bosse qui retombe en 4 ms) ou une montee douce
  const a = kick ? tw.attack - 0.5 : 0;
  const boost = a > 0 ? 2 * a : 0;
  const riseN = a < 0 ? Math.round(-a * 2 * 0.006 * srOut) : 0;
  const tauN = 0.004 * srOut;
  // DRIVE : tanh, au-dessus de 0.25
  const amt = kick ? Math.max(0, tw.drive - 0.25) / 0.75 : 0;
  const k = 1 + 8 * amt;
  const norm = amt > 0 ? 1 / Math.tanh(k) : 1;
  // SNAPPY : le dessus (au-dessus d'environ 2 kHz) en plus ou en moins
  const s = snare ? tw.snappy - 0.5 : 0;
  const tilt = s > 0 ? 2 * s : 1.6 * s;
  const lpA = Math.exp((-2 * Math.PI * 2000) / srOut);
  let peak = 0;
  for (const y of outs) for (let i = 0; i < y.length; i += 1) peak = Math.max(peak, Math.abs(y[i]));
  const inv = peak > 0 ? 1 / peak : 1;
  for (const y of outs) {
    let lp = 0;
    for (let i = 0; i < y.length; i += 1) {
      let v = y[i];
      if (tilt !== 0) {
        lp = lp * lpA + v * (1 - lpA);
        v += tilt * (v - lp);
      }
      if (boost > 0) v *= 1 + boost * Math.exp(-i / tauN);
      if (riseN > 0 && i < riseN) v *= i / riseN;
      if (amt > 0) v = (Math.tanh(k * v * inv) * norm) / inv;
      if (i >= fade0) {
        const t = Math.min(1, (i - fade0) / Math.max(1, end - fade0));
        v *= 0.5 + 0.5 * Math.cos(Math.PI * t);
      }
      y[i] = v;
    }
  }
  return { L: outs[0], R: outs[1] ?? outs[0] };
}
