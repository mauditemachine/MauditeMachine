/**
 * Un echantillon de Mika joue par une voix du MM-RYTM (2026-10-05, Mika :
 * "je voudrais que tu mettes ces samples dans le selecteur de samples, pour
 * BD et SD"). Calcul pur (sans DOM : testable sous Node), comme
 * audio/shotsdsp.ts : le fichier decode (audio/samples.ts) est relu a la
 * frequence de rendu, avec les TWEAKS de sa famille :
 * - KICK : TUNE (-12 a +12 demi-tons, un cran par demi-ton, 0 au milieu :
 *   le fichier a sa hauteur), ATTACK (5 : la frappe du fichier ; plus haut
 *   elle claque, jusqu'a +6 dB sur ses 4 premieres ms ; plus bas elle
 *   s'adoucit, une montee jusqu'a 6 ms), DECAY (a 4.5 et au-dessus la
 *   longueur du fichier ; dessous, une fin en fondu de plus en plus tot,
 *   jusqu'a 12 % de sa duree), DRIVE (a 2.5 et dessous, propre ; au-dessus
 *   une saturation douce, tanh, de plus en plus forte) ;
 * - SNARE : SNAPPY (5 : le fichier ; plus haut plus de claquant au-dessus
 *   de 2 kHz, plus bas plus sourd).
 * Les autres familles le jouent tel quel. Le niveau est cale ensuite comme
 * celui des sons calcules (renderSampleShot, audio/shotsdsp.ts).
 */

export interface SamplePcm {
  L: Float32Array;
  /** null : mono */
  R: Float32Array | null;
  /** la frequence du decodage */
  sr: number;
}

/** Ce qu'un echantillon sait du kit : sa famille et les reglages de 0 a 1. */
export interface SampleTweak {
  family: string;
  tune: number;
  attack: number;
  decay: number;
  drive: number;
  snappy: number;
}

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

/** Le canal relu a srOut, hauteur et longueur du kick comprises. */
function readChannel(x: Float32Array, srIn: number, srOut: number, ratio: number, nOut: number): Float32Array {
  const out = new Float32Array(nOut);
  const step = (ratio * srIn) / srOut;
  for (let i = 0; i < nOut; i += 1) out[i] = hermite(x, i * step);
  return out;
}

/**
 * L'echantillon pret a jouer, a srOut (la frequence de rendu : celle du
 * contexte divisee par la hauteur de TONE, audio/shots.ts) ; L === R s'il
 * est mono.
 */
export function playSample(p: SamplePcm, srOut: number, tw: SampleTweak): { L: Float32Array; R: Float32Array } {
  const kick = tw.family === 'bd';
  const snare = tw.family === 'sd';
  const ratio = kick ? Math.pow(2, sampleTuneSt(tw.tune) / 12) : 1;
  const durIn = p.L.length / p.sr;
  let nOut = Math.max(1, Math.ceil((durIn / ratio) * srOut));
  // DECAY : une fin en fondu (cosinus) sur la seconde moitie de la part gardee
  const part = kick ? sampleDecayPart(tw.decay) : 1;
  const end = Math.max(1, Math.round(nOut * part));
  nOut = Math.min(nOut, end + 1);
  const chans = p.R ? [p.L, p.R] : [p.L];
  const outs = chans.map((x) => readChannel(x, p.sr, srOut, ratio, nOut));
  const fade0 = part < 1 ? Math.round(end * 0.5) : nOut;
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
