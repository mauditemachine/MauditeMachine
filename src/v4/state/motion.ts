/**
 * Reduced motion (spec 7.3) : la preference systeme, observee en direct,
 * OU ?motion=reduce (revue sans toucher aux reglages de l'OS).
 */

import { useSyncExternalStore } from 'react';
import { FLAGS } from './flags';

const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());

let mql: MediaQueryList | null = null;
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  mql.addEventListener('change', emit);
}

export const motion = {
  /** true = chemin calme : pas de parallaxe, pas d'intro, fins d'animation directes */
  reduced: (): boolean => FLAGS.motionReduce || !!mql?.matches,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const useReducedMotion = (): boolean => useSyncExternalStore(motion.subscribe, motion.reduced, motion.reduced);
