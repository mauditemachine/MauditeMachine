/**
 * La ligne : un seul chemin analytique, evalue a l'identique ici (TS) et
 * dans le vertex shader du ruban (shaders.ts). Pas de texture de bruit :
 * trois sinus, pour que les perles, les portes, l'anneau et la camera
 * tombent exactement sur le ruban dessine par le GPU.
 *
 * Axes monde : +z = maintenant, le passe est en z negatif, +y en haut.
 */

import { Vector3 } from 'three';

export const TAU = Math.PI * 2;

/**
 * Periode exacte du tremblement : ses trois pulsations (0.15, 0.11, 0.07),
 * la respiration du ruban (3.77) et la rotation des perles (0.2) sont des
 * multiples de 0.01, donc tout se repete a l'identique toutes les 200 pi
 * secondes. Le temps envoye au GPU (float32) est replie sur cette periode :
 * aucune perte de precision sur une longue session, aucun saut au repli, et
 * les perles (CPU) restent exactement sur le ruban (GPU).
 */
export const WOB_PERIOD = TAU * 100;

/** La bobine s'efface entre CAM_NEAR et CAM_NEAR + CAM_SPAN unites de la camera. */
export const CAM_NEAR = 2.5;
export const CAM_SPAN = 3;

export interface PathKnobs {
  /** uTuning : nombre d'ondes de la ligne (0.25..1.75, 1.0 par defaut) */
  tuning: number;
  /** uResonance : rayon de la bobine (0..1 -> 0..0.9 unites) */
  resonance: number;
  /** uCutoff : amplitude du tremblement (0..1 -> 0..0.6 unites) */
  cutoff: number;
}

export interface Frame {
  T: Vector3;
  n1: Vector3;
  n2: Vector3;
}

export const makeFrame = (): Frame => ({ T: new Vector3(), n1: new Vector3(), n2: new Vector3() });

const UP = new Vector3(0, 1, 0);
const RIGHT = new Vector3(1, 0, 0);
const _a = new Vector3();
const _b = new Vector3();
const _f = makeFrame();

/** base(t) : la colonne vertebrale de la ligne, z de -70 (2012) a 0 (maintenant). */
export function basePos(t: number, tuning: number, out: Vector3): Vector3 {
  return out.set(
    4.2 * Math.sin(t * TAU * tuning + 0.7),
    2.6 * Math.cos(t * TAU * tuning * 0.5),
    -70 + 70 * t
  );
}

/** Le rail camera : meme forme, amplitudes reduites, sans bobine ni tremblement. */
export function smoothPos(s: number, tuning: number, out: Vector3): Vector3 {
  return out.set(
    2.1 * Math.sin(s * TAU * tuning + 0.7),
    1.3 * Math.cos(s * TAU * tuning * 0.5),
    -70 + 70 * s
  );
}

/** Repere local (tangente, deux normales) au parametre t. */
export function frameAt(t: number, tuning: number, out: Frame): Frame {
  basePos(t + 0.002, tuning, _a);
  basePos(t - 0.002, tuning, _b);
  out.T.subVectors(_a, _b).normalize();
  out.n1.crossVectors(out.T, UP);
  if (out.n1.lengthSq() < 0.0025) out.n1.crossVectors(out.T, RIGHT);
  out.n1.normalize();
  out.n2.crossVectors(out.n1, out.T);
  return out;
}

/** Tremblement : somme de trois sinus, k decale la phase par normale. */
export function wob(t: number, time: number, k: number): number {
  return (
    0.5 * Math.sin(t * 97.3 + time * 0.15 + k * 1.7) +
    0.3 * Math.sin(t * 211.7 - time * 0.11 + k * 0.9) +
    0.2 * Math.sin(t * 389.1 + time * 0.07 + k * 2.3)
  );
}

/**
 * full(t) : base + bobine (RESONANCE) + tremblement (CUT OFF). Avec `cam`,
 * la bobine s'efface pres de la camera (meme formule que le shader) : pas
 * de boucle geante au premier plan dans les plans Focus et pendant le dolly.
 */
export function fullPos(t: number, k: PathKnobs, time: number, out: Vector3, cam?: Vector3 | null): Vector3 {
  basePos(t, k.tuning, out);
  frameAt(t, k.tuning, _f);
  const c = t * TAU * 38.0;
  const taper = cam ? smooth01((out.distanceTo(cam) - CAM_NEAR) / CAM_SPAN) : 1;
  const r = k.resonance * 0.9 * taper;
  const w = k.cutoff * 0.6;
  out.addScaledVector(_f.n1, r * Math.cos(c) + w * wob(t, time, 0));
  out.addScaledVector(_f.n2, r * Math.sin(c) + w * wob(t, time, 1));
  return out;
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** smoothstep(0, 1, x) */
export const smooth01 = (x: number) => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};
/** Lissage exponentiel independant du framerate. */
export const damp = (cur: number, target: number, lambda: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-lambda * dt));
