/**
 * Section ouverte (spec 7.1 et 7.2) : null, ou l'une des six. Les knobs de
 * navigation (angle, LED), le panneau desktop, la feuille mobile, la trace,
 * le cadrage de la camera et l'ecran la lisent. Un seul knob actif : ouvrir
 * une section remplace la precedente ; recliquer le knob actif ferme.
 */

import type { SectionId } from '../theme';

let current: SectionId | null = null;
/** changements depuis le chargement (revue) */
let changes = 0;
const listeners = new Set<() => void>();

export const section = {
  get: (): SectionId | null => current,
  set(s: SectionId | null): void {
    if (s === current) return;
    current = s;
    changes += 1;
    listeners.forEach((fn) => fn());
  },
  /** Knob : la section, ou la fermeture si c'est deja elle. */
  toggle(s: SectionId): void {
    section.set(current === s ? null : s);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  get changes(): number {
    return changes;
  },
};
