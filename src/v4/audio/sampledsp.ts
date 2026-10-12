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
 *   vite ou plus lentement, par un sinc fenetre depuis le 2026-10-12, l'Hermite
 *   avant : le calcul est fait une fois, jamais a la lecture) ;
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

/*
 * La relecture (2026-10-12, Mika : "des problemes pour le son des BD, surtout des samples que j'ai choisis") :
 * mesure hors ligne, le fichier passait par deux reechantillonnages quand le contexte tournait a 44.1 kHz
 * (le decodage a 48 kHz du navigateur, puis l'Hermite de 48 a 44.1 kHz : -0.7 a -0.9 dB au-dessus de 12 kHz,
 * un residu a -54 dB sur AFFKT), et l'Hermite ternissait les aigus de tout echantillon transpose. Le fichier
 * est maintenant decode a sa propre frequence (audio/samples.ts) : a la meme frequence et a sa hauteur, il est
 * recopie tel quel, echantillon pour echantillon ; sinon relu par un sinc fenetre (Kaiser, 32 passages par
 * zero de chaque cote, coupe a la Nyquist la plus basse : rien ne se replie quand on le relit plus vite).
 */
const SINC_HALF = 32;
const SINC_PHASES = 256;
const SINC_LEN = SINC_HALF * SINC_PHASES;

/** Bessel I0 (la fenetre de Kaiser). */
function besselI0(x: number): number {
  let s = 1;
  let t = 1;
  for (let k = 1; k < 40; k += 1) {
    t *= (x / (2 * k)) * (x / (2 * k));
    s += t;
    if (t < 1e-12 * s) break;
  }
  return s;
}

/** Le noyau tabule une fois (256 phases par passage par zero, interpole lineairement entre elles). */
const SINC_TAB: Float32Array = (() => {
  const t = new Float32Array(SINC_LEN + 2);
  const beta = 8;
  const i0b = besselI0(beta);
  for (let k = 0; k <= SINC_LEN; k += 1) {
    const u = k / SINC_PHASES;
    const s = k === 0 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u);
    const r = u / SINC_HALF;
    t[k] = r >= 1 ? 0 : (s * besselI0(beta * Math.sqrt(1 - r * r))) / i0b;
  }
  return t;
})();

/** Le canal relu a srOut, a sa hauteur, sur nOut echantillons. */
function readChannel(x: Float32Array, srIn: number, srOut: number, ratio: number, nOut: number): Float32Array {
  const out = new Float32Array(nOut);
  const step = (ratio * srIn) / srOut;
  const n = x.length;
  // La frequence du fichier, a sa hauteur : le fichier lui-meme
  if (step === 1) {
    out.set(x.subarray(0, Math.min(n, nOut)));
    return out;
  }
  // Relu plus vite (plus aigu, ou vers une frequence plus basse) : la coupure suit la Nyquist de la sortie
  const c = step > 1 ? 1 / step : 1;
  const reach = SINC_HALF / c;
  const scale = c * SINC_PHASES;
  const T = SINC_TAB;
  for (let i = 0; i < nOut; i += 1) {
    const pos = i * step;
    const mid = Math.floor(pos);
    const j0 = Math.max(0, Math.ceil(pos - reach));
    const j1 = Math.min(n - 1, Math.floor(pos + reach));
    let acc = 0;
    // A gauche de pos (la distance baisse d'un pas a chaque echantillon), puis a droite (elle monte)
    let u = (pos - j0) * scale;
    for (let j = j0; j <= mid && j <= j1; j += 1, u -= scale) {
      const k = u | 0;
      if (k < SINC_LEN) acc += x[j] * (T[k] + (u - k) * (T[k + 1] - T[k]));
    }
    u = (mid + 1 - pos) * scale;
    for (let j = Math.max(j0, mid + 1); j <= j1; j += 1, u += scale) {
      const k = u | 0;
      if (k >= SINC_LEN) break;
      acc += x[j] * (T[k] + (u - k) * (T[k + 1] - T[k]));
    }
    out[i] = acc * c;
  }
  return out;
}

/**
 * Le fichier relu a srOut, a sa hauteur, a l'endroit ou a l'envers (2026-10-12) : le sinc coute quelques dizaines
 * de ms par fichier, il est fait une fois par frequence et par hauteur (quatre gardees par fichier) ; ATTACK, DRIVE,
 * START, LEN qui tournent ne relisent plus rien.
 */
const RELU = new WeakMap<SamplePcm, Map<string, Float32Array[]>>();
function relu(p: SamplePcm, srOut: number, ratio: number, rev: boolean): Float32Array[] {
  let m = RELU.get(p);
  if (!m) {
    m = new Map();
    RELU.set(p, m);
  }
  const key = `${srOut}|${ratio}|${rev ? 1 : 0}`;
  const hit = m.get(key);
  if (hit) {
    m.delete(key);
    m.set(key, hit);
    return hit;
  }
  const srcs = p.R ? [p.L, p.R] : [p.L];
  // REV : une copie a l'envers (le fichier decode sert aux autres coups)
  const chans = rev ? srcs.map((x) => Float32Array.from(x).reverse()) : srcs;
  const n = Math.max(1, Math.ceil((p.L.length / p.sr / ratio) * srOut));
  const out = chans.map((x) => readChannel(x, p.sr, srOut, ratio, n));
  m.set(key, out);
  while (m.size > 4) {
    const first = m.keys().next().value;
    if (first === undefined) break;
    m.delete(first);
  }
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
  // START : les premiers echantillons sautes (en echantillons du fichier)
  const off = tw.start > 0 ? Math.round(Math.min(1, tw.start) * SAMPLE_START_MAX * p.L.length) : 0;
  const durIn = (p.L.length - off) / p.sr;
  let nOut = Math.max(1, Math.ceil((durIn / ratio) * srOut));
  // LEN : la part gardee, puis un fondu court (cosinus) juste avant la coupe (SAMPLE_LEN_FADE)
  const part = sampleLenPart(tw.len);
  const end = Math.max(1, Math.round(nOut * part));
  nOut = Math.min(nOut, end + 1);
  // Le fichier entier relu a srOut (REV : a l'envers), garde ; START en prend la suite (au plus pres de son echantillon)
  const full = relu(p, srOut, ratio, tw.rev);
  const at = off > 0 ? Math.round((off * srOut) / (ratio * p.sr)) : 0;
  const outs = full.map((x) => {
    const y = new Float32Array(nOut);
    y.set(x.subarray(Math.min(x.length, at), Math.min(x.length, at + nOut)));
    return y;
  });
  const fade0 = part < 1 ? end - Math.max(1, Math.round(sampleLenFadeS(end / srOut) * srOut)) : nOut;
  // ATTACK : une frappe en plus (une bosse qui retombe en 4 ms) ou une montee douce
  const a = kick ? tw.attack - 0.5 : 0;
  const boost = a > 0 ? 2 * a : 0;
  const riseN = a < 0 ? Math.round(-a * 2 * 0.006 * srOut) : 0;
  const tauN = 0.004 * srOut;
  // DRIVE : tanh, au-dessus de 0.25. Sans saut depuis le 2026-10-12 : tanh(k x) / tanh(k) part de la droite (k pres de 0) ;
  // avant, k partait de 1 et le premier cran au-dessus de 0.25 ecrasait deja le fichier (+1.7 dB a mi-hauteur, +3 dB
  // a DRIVE 0.30, la valeur des presets d'usine sur les kicks de Mika). A fond, la meme saturation qu'avant (k 9)
  const amt = kick ? Math.max(0, tw.drive - 0.25) / 0.75 : 0;
  const k = 9 * amt;
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
