/**
 * SIDECHAIN du MM-ARP (2026-10-04, Mika : "un knob sidechain automatique
 * dans MM-ARP OPEN, un sidechain qui s'adapte parfaitement au kick et a sa
 * longueur dans MM-RYTM"). Pas de detecteur qui ecoute avec du retard :
 * le MM-RYTM sait quand chaque kick part et ce qu'il joue. A chaque kick
 * programme (audio/drums.ts trigger), son enveloppe est lue dans
 * l'echantillon meme (crete par fenetre de 20 ms, rendue decroissante : la
 * baisse tient tant que le kick tient), a sa vitesse de lecture, avec le
 * DECAY de sa voix et sa velocite. La baisse suit le niveau du kick, comme
 * un compresseur colle a lui : -24 dB x SIDECHAIN au coup, plus rien
 * quand le kick est 12 dB sous sa crete, la fin de son corps (le 909 de
 * depart revient en 0.44 s, juste avant le temps suivant a 130 BPM ; le
 * MM en 0.19 s ; le 808 long en 0.69 s ; DECAY les allonge ou les
 * raccourcit). Le retour s'accelere vers la fin (puissance 1.5 : la
 * respiration du pompage). Elle part 2 ms avant le coup
 * (on connait l'avenir : la frappe passe nette), touche le fond en 4 ms.
 * Le gain de la prise du MM-ARP (sec, delay et reverbe) porte la courbe ;
 * des kicks qui se chevauchent : la plus forte baisse des deux. Un STOP
 * retire les kicks pas encore partis.
 */

/** Pas de l'enveloppe lue dans l'echantillon (s), fenetre de crete (blocs). */
const ENV_BLOCK_S = 0.005;
const ENV_WIN = 4;

export const DUCK = {
  /** la baisse au coup a SIDECHAIN 10 (dB) */
  maxDb: 24,
  /** la longueur du kick : jusqu'a 12 dB sous sa crete ; la forme du retour */
  rangeDb: 12,
  shape: 1.5,
  /** depart avant le coup, descente (s) */
  pre: 0.002,
  attack: 0.004,
  /** pas des points de la courbe (s), duree au plus */
  step: 0.01,
  maxS: 2.5,
  /** retour a 1 quand SIDECHAIN passe a OFF (s) */
  release: 0.03,
} as const;

export interface KickEnv {
  /** pas d'un point (s, dans le temps de l'echantillon) */
  step: number;
  /** de 1 (la crete) a 0, decroissante */
  env: Float32Array;
}

const envCache = new WeakMap<AudioBuffer, KickEnv>();

/** L'enveloppe d'un echantillon de kick (gardee avec lui). */
export function kickEnvelope(buf: AudioBuffer): KickEnv {
  const hit = envCache.get(buf);
  if (hit) return hit;
  const B = Math.max(1, Math.round(ENV_BLOCK_S * buf.sampleRate));
  const nb = Math.max(1, Math.ceil(buf.length / B));
  const blk = new Float32Array(nb);
  for (let ch = 0; ch < buf.numberOfChannels; ch += 1) {
    const x = buf.getChannelData(ch);
    for (let i = 0; i < x.length; i += 1) {
      const a = Math.abs(x[i]);
      const b = (i / B) | 0;
      if (a > blk[b]) blk[b] = a;
    }
  }
  let peak = 0;
  for (let b = 0; b < nb; b += 1) if (blk[b] > peak) peak = blk[b];
  const env = new Float32Array(nb);
  if (peak > 0) {
    // Crete sur 20 ms (une periode du grave), puis decroissante depuis la fin
    for (let b = 0; b < nb; b += 1) {
      let m = 0;
      for (let k = b; k < Math.min(nb, b + ENV_WIN); k += 1) if (blk[k] > m) m = blk[k];
      env[b] = m / peak;
    }
    for (let b = nb - 2; b >= 0; b -= 1) if (env[b + 1] > env[b]) env[b] = env[b + 1];
  }
  const out = { step: B / buf.sampleRate, env };
  envCache.set(buf, out);
  return out;
}

/** Ce que le kick joue : son enveloppe, sa vitesse, le DECAY de sa voix (tau, null : sans), sa velocite. */
export interface KickPlay {
  env: KickEnv;
  rate: number;
  hold: number;
  tau: number | null;
  vel: number;
}

/** La baisse au coup (dB) pour SIDECHAIN de 0 a 1 (0 : rien). */
export const duckDb = (depth: number): number => Math.max(0, Math.min(1, depth)) * DUCK.maxDb;

/** Le niveau du kick a t s du coup (1 a la crete, velocite comprise). */
function levelAt(k: KickPlay, t: number): number {
  const x = (t * k.rate) / k.env.step;
  const e = k.env.env;
  if (x >= e.length - 1) return 0;
  const i = Math.max(0, Math.floor(x));
  const f = Math.max(0, x - i);
  let a = e[i] + (e[i + 1] - e[i]) * f;
  if (k.tau !== null && t > k.hold) a *= Math.exp(-(t - k.hold) / k.tau);
  return a * k.vel;
}

/**
 * La courbe d'un kick a `when` : des paires (t, gain), a 1 avant et apres.
 * Vide si SIDECHAIN est a 0.
 */
export function duckCurve(when: number, k: KickPlay, depth: number): Float64Array {
  const D = duckDb(depth);
  if (D <= 0) return new Float64Array(0);
  const R = DUCK.rangeDb;
  const gainAt = (t: number): number => {
    const a = levelAt(k, t);
    if (a <= 0) return 1;
    const l = (20 * Math.log10(a) + R) / R;
    const gr = D * Math.pow(Math.max(0, Math.min(1, l)), DUCK.shape);
    return Math.pow(10, -gr / 20);
  };
  const pts: number[] = [when - DUCK.pre, 1, when + DUCK.attack, gainAt(DUCK.attack)];
  for (let t = DUCK.attack + DUCK.step; t < DUCK.maxS; t += DUCK.step) {
    const g = gainAt(t);
    pts.push(when + t, g);
    if (g >= 0.9995) break;
  }
  pts[pts.length - 1] = 1;
  return Float64Array.from(pts);
}

/** Valeur d'une courbe (paires t, v) a t, 1 hors d'elle. */
function curveAt(c: Float64Array, t: number): number {
  const n = c.length;
  if (n < 4 || t <= c[0] || t >= c[n - 2]) return 1;
  for (let i = 2; i < n; i += 2) {
    if (t <= c[i]) {
      const t0 = c[i - 2];
      const v0 = c[i - 1];
      const t1 = c[i];
      const v1 = c[i + 1];
      return t1 > t0 ? v0 + ((v1 - v0) * (t - t0)) / (t1 - t0) : v1;
    }
  }
  return 1;
}

/**
 * Le gain qui baisse (celui de la prise du MM-ARP) : les kicks programmes,
 * et l'automation qui en decoule, reecrite a partir du premier instant
 * touche.
 */
export class Ducker {
  private kicks: { curve: Float64Array; end: number; tag: object }[] = [];
  /** courbes posees depuis le chargement (revue) */
  added = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly param: AudioParam
  ) {}

  /** Un kick a `when`, avec sa courbe ; tag : sa voix (pour l'annuler). */
  add(curve: Float64Array, tag: object): void {
    if (curve.length < 4) return;
    this.kicks.push({ curve, end: curve[curve.length - 2], tag });
    this.added += 1;
    this.rebuild(curve[0]);
  }

  /** Une voix annulee (STOP) : son kick ne baisse plus rien. */
  cancel(tag: object): void {
    const n = this.kicks.length;
    this.kicks = this.kicks.filter((k) => k.tag !== tag);
    if (this.kicks.length !== n) this.rebuild(this.ctx.currentTime);
  }

  /** SIDECHAIN a OFF : tout revient a 1, en douceur. */
  clear(): void {
    const now = this.ctx.currentTime;
    const v = this.at(now);
    this.kicks = [];
    const p = this.param;
    p.cancelScheduledValues(now);
    p.setValueAtTime(v, now);
    p.linearRampToValueAtTime(1, now + DUCK.release);
  }

  /** Le gain voulu a t (la plus forte baisse des kicks qui sonnent). */
  at(t: number): number {
    let v = 1;
    for (const k of this.kicks) {
      const g = curveAt(k.curve, t);
      if (g < v) v = g;
    }
    return v;
  }

  get size(): number {
    return this.kicks.length;
  }

  private rebuild(from: number): void {
    const now = this.ctx.currentTime;
    const t0 = Math.max(from, now);
    this.kicks = this.kicks.filter((k) => k.end > now - 0.05);
    const p = this.param;
    p.cancelScheduledValues(t0);
    // Les points restent serres (10 ms) : la rampe du dernier point garde au nouveau depart suit la courbe
    p.linearRampToValueAtTime(this.at(t0), t0);
    const times: number[] = [];
    for (const k of this.kicks) for (let i = 0; i < k.curve.length; i += 2) if (k.curve[i] > t0) times.push(k.curve[i]);
    times.sort((a, b) => a - b);
    let last = t0;
    for (const t of times) {
      if (t - last < 1e-4) continue;
      p.linearRampToValueAtTime(this.at(t), t);
      last = t;
    }
  }
}
