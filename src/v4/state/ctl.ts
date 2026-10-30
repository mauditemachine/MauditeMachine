/**
 * Le toucher des potards de la face (2026-10-27, la phase 2 du MM-RYTM V.4.0) : une feuille sans import, lue par
 * actions.ts et rytm/faceKnobs.ts. CtlSrc dit d'ou vient un geste (la souris, un jumeau, le clavier, la molette, le MIDI,
 * le futur controleur USB du boitier) ; faceTouch garde, par potard, s'il est tenu (le doigt, la souris ; en phase 3 le
 * potard sensible au toucher) et quand il a tourne : un potard tourne a la main ne se fait pas deplacer par son moteur.
 */

export type CtlSrc = 'ui' | 'ptr' | 'twin' | 'key' | 'wheel' | 'midi' | 'hw' | 'restore';

const KNOBS = 8;
const holders: number[] = new Array(KNOBS).fill(0);
const turnedAt: number[] = new Array(KNOBS).fill(-Infinity);
const turnedBy: (CtlSrc | null)[] = new Array(KNOBS).fill(null);
/** Le lacher d'un potard (V.5.2 : CONTROL ALL referme TRK gardee au lacher, pas pendant le geste). */
const upListeners = new Set<(k: number) => void>();

export const faceTouch = {
  /** un pointeur (ou le toucher du materiel) prend le potard k */
  down(k: number, _src: CtlSrc = 'ptr'): void {
    if (k >= 0 && k < KNOBS) holders[k] += 1;
  },
  /** il le lache */
  up(k: number): void {
    if (k < 0 || k >= KNOBS) return;
    holders[k] = Math.max(0, holders[k] - 1);
    if (holders[k] === 0) upListeners.forEach((fn) => fn(k));
  },
  /** ecoute le lacher des potards */
  onUp(fn: (k: number) => void): () => void {
    upListeners.add(fn);
    return () => {
      upListeners.delete(fn);
    };
  },
  /** le potard k a tourne (t : performance.now()) */
  turn(k: number, src: CtlSrc, t = performance.now()): void {
    if (k < 0 || k >= KNOBS) return;
    turnedAt[k] = t;
    turnedBy[k] = src;
  },
  /** tenu en ce moment */
  held(k: number): boolean {
    return k >= 0 && k < KNOBS && holders[k] > 0;
  },
  /** tourne il y a moins de ms */
  recent(k: number, ms: number, now = performance.now()): boolean {
    return k >= 0 && k < KNOBS && now - turnedAt[k] < ms;
  },
  /** d'ou est venu son dernier tour (null : jamais) */
  lastSrc(k: number): CtlSrc | null {
    return k >= 0 && k < KNOBS ? turnedBy[k] : null;
  },
  /** tout lache (la fenetre perd le focus) */
  releaseAll(): void {
    holders.fill(0);
  },
};
