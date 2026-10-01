/**
 * Apparence du site (2026-10-01) : sombre (la machine noire d'origine) ou
 * claire (la machine blanche et les couleurs du press kit). Gardee dans le
 * localStorage, sous try/catch (navigation privee, stockage bloque) ; par
 * defaut, sombre.
 */

import type { Appearance } from '../theme';

const KEY = 'mm.v4.appearance';

function read(): Appearance {
  try {
    return window.localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

let current: Appearance = typeof window === 'undefined' ? 'dark' : read();
const listeners = new Set<() => void>();

export const appearance = {
  get: (): Appearance => current,
  set(a: Appearance): void {
    if (a === current) return;
    current = a;
    try {
      window.localStorage.setItem(KEY, a);
    } catch {
      /* stockage indisponible : l'apparence vaut pour la visite */
    }
    listeners.forEach((l) => l());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
