/**
 * STRETCH, l'etirement facon Impulse (2026-10-04, Mika : "laisse Stretch
 * dans les globales mais fais en sorte qu'il agisse comme un Timestretch,
 * rappelle-toi Impulse de Ableton Live"). Le one-shot garde sa hauteur et
 * change de duree : il est decoupe en grains (40 ms, fenetre de Hann) relus
 * plus lentement (plus long) ou plus vite (plus court) et recolles avec un
 * recouvrement de 75 % ; normalise par la somme des fenetres, sans creux
 * aux bords. Les premieres millisecondes (l'attaque) restent l'original,
 * fondues dans l'etire : le coup claque toujours, et au-dela de x2 les
 * grains s'entendent, comme dans Impulse.
 * Fait une fois par echantillon, au calcul (audio/shotsdsp.ts renderShot,
 * dans le worker) : rien ne tourne pendant la lecture.
 */

/** Taille d'un grain (s) et recouvrement (un grain tous les quarts). */
const GRAIN_S = 0.04;
/** L'attaque gardee telle quelle (s), puis le fondu vers l'etire (s). */
const KEEP_S = 0.006;
const FADE_S = 0.006;

const hannCache = new Map<number, Float32Array>();
function hann(n: number): Float32Array {
  let w = hannCache.get(n);
  if (!w) {
    w = new Float32Array(n);
    for (let i = 0; i < n; i += 1) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / n);
    hannCache.set(n, w);
  }
  return w;
}

/** x etire d'un facteur f (2 : deux fois plus long), a la meme hauteur. */
export function timeStretch(x: Float32Array, f: number, sr: number): Float32Array {
  if (!(f > 0) || Math.abs(f - 1) < 1e-3 || x.length === 0) return x;
  const n = Math.max(64, Math.round(GRAIN_S * sr));
  const hs = n >> 2;
  const ha = hs / f;
  const outLen = Math.max(1, Math.round(x.length * f));
  const y = new Float32Array(outLen);
  const ws = new Float32Array(outLen);
  const w = hann(n);
  // Des grains commencent avant 0 : le debut est couvert comme le reste
  for (let k = -3; ; k += 1) {
    const os = k * hs;
    if (os >= outLen) break;
    const is = Math.round(k * ha);
    for (let i = 0; i < n; i += 1) {
      const o = os + i;
      if (o < 0) continue;
      if (o >= outLen) break;
      const j = is + i;
      if (j < 0 || j >= x.length) continue;
      y[o] += w[i] * x[j];
      ws[o] += w[i];
    }
  }
  for (let i = 0; i < outLen; i += 1) if (ws[i] > 1e-3) y[i] /= ws[i];
  // L'attaque : l'original, puis un fondu lineaire vers l'etire
  const keep = Math.min(outLen, x.length, Math.round(KEEP_S * sr));
  const fade = Math.min(outLen - keep, x.length - keep, Math.round(FADE_S * sr));
  for (let i = 0; i < keep; i += 1) y[i] = x[i];
  for (let i = 0; i < fade; i += 1) {
    const a = (i + 1) / (fade + 1);
    y[keep + i] = x[keep + i] * (1 - a) + y[keep + i] * a;
  }
  // La fin : 2 ms de fondu (le dernier grain ne s'arrete pas net)
  const tail = Math.min(outLen, Math.round(0.002 * sr));
  for (let i = 0; i < tail; i += 1) y[outLen - 1 - i] *= i / tail;
  return y;
}
