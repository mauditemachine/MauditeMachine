/**
 * Reduced motion : la preference systeme (observee en direct) OU le toggle
 * "Calm mode" du drawer Info (localStorage mm_v3_calm) OU ?motion=reduce
 * (revue sans changer les reglages de l'OS).
 */

import { useSyncExternalStore } from 'react';

const CALM_KEY = 'mm_v3_calm';

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let mql: MediaQueryList | null = null;
let calm = false;
let query = false;

if (typeof window !== 'undefined') {
  mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  mql.addEventListener('change', emit);
  try {
    calm = localStorage.getItem(CALM_KEY) === '1';
  } catch {
    calm = false;
  }
  query = new URLSearchParams(window.location.search).get('motion') === 'reduce';
}

export const motion = {
  /** true = chemin calme : aucune animation continue, rendu a la demande */
  get: (): boolean => !!(mql?.matches || calm || query),
  getCalm: (): boolean => calm,
  setCalm(v: boolean): void {
    calm = v;
    try {
      if (v) localStorage.setItem(CALM_KEY, '1');
      else localStorage.removeItem(CALM_KEY);
    } catch {
      /* sans persistance */
    }
    emit();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const useReducedMotion = (): boolean => useSyncExternalStore(motion.subscribe, motion.get, motion.get);
export const useCalm = (): boolean => useSyncExternalStore(motion.subscribe, motion.getCalm, motion.getCalm);
