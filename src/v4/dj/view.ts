/**
 * Le bloc du MM-DECKS cadre au telephone (2026-10-04, Mika pour les Decks
 * de sonaa.ca : "un deck dans la fenetre, je swipe, je fais rentrer le
 * mixer, je swipe, je fais rentrer l'autre deck") : DECK A, MIXER ou
 * DECK B. Sur desktop les trois sont cadres ensemble et ce store ne sert
 * pas. Le Stage (scene/renderer.ts) anime le cadrage vers le bloc.
 */

import type { DjUnit } from './theme';

export const DJ_UNITS: readonly DjUnit[] = ['a', 'mix', 'b'];

let unit: DjUnit = 'a';
const listeners = new Set<() => void>();

export const djView = {
  get: (): DjUnit => unit,
  set(u: DjUnit): void {
    if (u === unit) return;
    unit = u;
    listeners.forEach((fn) => fn());
  },
  /** Le bloc voisin (+1 a droite, -1 a gauche), ou null au bord. */
  next(dir: 1 | -1): DjUnit | null {
    const i = DJ_UNITS.indexOf(unit) + dir;
    return i >= 0 && i < DJ_UNITS.length ? DJ_UNITS[i] : null;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
