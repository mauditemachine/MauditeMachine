/**
 * Section ouverte (spec 7.1 et 20.6.1) : null, l'une des sept pages (pads
 * TRACKS a SONAA), LIVE ou STUDIO (puces de la vue eclatee). Les pads (page
 * active en yellowHi), le panneau desktop, la feuille mobile, la trace, le
 * cadrage de la camera et l'ecran la lisent. Une seule a la fois : ouvrir
 * une section remplace la precedente ; retaper le pad actif (ou la puce
 * LIVE) ferme.
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
  /** Pad de page, puce LIVE : la section, ou la fermeture si c'est deja elle. */
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
