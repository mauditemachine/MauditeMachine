/**
 * Le calcul du MM-SMPL qui ne touche ni au son en direct ni a l'ecran
 * (2026-10-04) : les slices (parts egales, ou les attaques trouvees dans le
 * son), les cretes de la forme d'onde, et le fichier WAV d'une region.
 * Fonctions pures : elles se testent hors du navigateur.
 */

/** Les decoupes possibles : en parts egales, ou AUTO (les attaques). */
export const SMPL_SLICINGS = [4, 8, 16, 'auto'] as const;
export type SmplSlicing = (typeof SMPL_SLICINGS)[number];
/** Au plus seize slices : un pad chacune. */
export const SMPL_PADS = 16;

/** n parts egales de [a, b] (secondes) : les debuts, puis b. */
export function equalSlices(a: number, b: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i += 1) out.push(a + ((b - a) * i) / n);
  return out;
}

/**
 * Les attaques de [a, b] (secondes) d'un son mono : l'energie sur des
 * fenetres de 5 ms, une attaque la ou elle monte franchement au-dessus de
 * sa moyenne recente (flux positif du logarithme), au moins 70 ms entre
 * deux ; les seize plus fortes, dans l'ordre. Toujours a partir de a ; rien
 * trouve : des parts egales (8).
 */
export function onsetSlices(mono: Float32Array, rate: number, a: number, b: number, max = SMPL_PADS): number[] {
  const i0 = Math.max(0, Math.floor(a * rate));
  const i1 = Math.min(mono.length, Math.floor(b * rate));
  const hop = Math.max(16, Math.round(rate * 0.005));
  const frames = Math.floor((i1 - i0) / hop);
  if (frames < 8) return equalSlices(a, b, Math.min(8, max));
  const e = new Float32Array(frames);
  for (let f = 0; f < frames; f += 1) {
    let s = 0;
    const o = i0 + f * hop;
    for (let k = 0; k < hop; k += 1) {
      const v = mono[o + k];
      s += v * v;
    }
    e[f] = Math.log10(1e-9 + s / hop);
  }
  // Le flux : la montee par rapport au plus haut des 4 fenetres d'avant (pas de double attaque dans une meme montee)
  const flux = new Float32Array(frames);
  for (let f = 4; f < frames; f += 1) {
    let prev = -Infinity;
    for (let k = 1; k <= 4; k += 1) prev = Math.max(prev, e[f - k]);
    flux[f] = Math.max(0, e[f] - prev);
  }
  // Le seuil : au-dessus de la moyenne du flux, et une montee d'au moins 6 dB (0.6 en log10 de puissance)
  let mean = 0;
  for (let f = 0; f < frames; f += 1) mean += flux[f];
  mean /= frames;
  const th = Math.max(0.6, mean * 3);
  const gap = Math.max(1, Math.round(0.07 / (hop / rate)));
  const peaks: { f: number; v: number }[] = [];
  for (let f = 1; f < frames - 1; f += 1) {
    if (flux[f] < th || flux[f] < flux[f - 1] || flux[f] < flux[f + 1]) continue;
    const last = peaks[peaks.length - 1];
    if (last && f - last.f < gap) {
      if (flux[f] > last.v) peaks[peaks.length - 1] = { f, v: flux[f] };
      continue;
    }
    peaks.push({ f, v: flux[f] });
  }
  // Une attaque au tout debut ne fait pas une slice de plus : a est deja un debut
  const starts = peaks
    .filter((p) => p.f * hop > rate * 0.02)
    .sort((x, y) => y.v - x.v)
    .slice(0, max - 1)
    .map((p) => a + ((p.f - 1) * hop) / rate)
    .sort((x, y) => x - y);
  if (starts.length === 0) return equalSlices(a, b, Math.min(8, max));
  return [a, ...starts, b];
}

/** Les deux canaux ramenes en un (la moyenne). */
export function monoOf(ch: readonly Float32Array[]): Float32Array {
  if (ch.length === 1) return ch[0];
  const n = ch[0].length;
  const out = new Float32Array(n);
  const l = ch[0];
  const r = ch[1];
  for (let i = 0; i < n; i += 1) out[i] = 0.5 * (l[i] + r[i]);
  return out;
}

/** Les cretes (min, max) de n colonnes sur [i0, i1) d'un son mono, pour l'ecran. */
export function peaksOf(mono: Float32Array, i0: number, i1: number, n: number): Float32Array {
  const out = new Float32Array(n * 2);
  const span = Math.max(1, i1 - i0);
  for (let c = 0; c < n; c += 1) {
    const a = i0 + Math.floor((span * c) / n);
    const b = Math.max(a + 1, i0 + Math.floor((span * (c + 1)) / n));
    let lo = 0;
    let hi = 0;
    // Au plus 256 points par colonne : une longue piste reste rapide
    const step = Math.max(1, Math.floor((b - a) / 256));
    for (let i = a; i < b && i < mono.length; i += step) {
      const v = mono[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    out[c * 2] = lo;
    out[c * 2 + 1] = hi;
  }
  return out;
}

/** Un WAV PCM 16 bits des canaux donnes (stereo ou mono). */
export function wavOf(ch: readonly Float32Array[], rate: number): ArrayBuffer {
  const nc = ch.length;
  const n = ch[0]?.length ?? 0;
  const buf = new ArrayBuffer(44 + n * nc * 2);
  const v = new DataView(buf);
  const tag = (o: number, s: string): void => {
    for (let k = 0; k < 4; k += 1) v.setUint8(o + k, s.charCodeAt(k));
  };
  tag(0, 'RIFF');
  v.setUint32(4, 36 + n * nc * 2, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, nc, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * nc * 2, true);
  v.setUint16(32, nc * 2, true);
  v.setUint16(34, 16, true);
  tag(36, 'data');
  v.setUint32(40, n * nc * 2, true);
  let o = 44;
  for (let i = 0; i < n; i += 1) {
    for (let c = 0; c < nc; c += 1) {
      const s = Math.max(-1, Math.min(1, ch[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return buf;
}
