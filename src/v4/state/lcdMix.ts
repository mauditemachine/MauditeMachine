/**
 * Page MIX de l'ecran (2026-10-01, facon Elektron) : quand on tourne le
 * VOLUME d'une voix (un pad selectionne), l'ecran montre un instant les
 * cinq volumes, un potard dessine par voix, la voix reglee en surbrillance.
 * Les actions l'ouvrent ; le compositeur (state/lcd.ts) la place au-dessus
 * des trois lignes de texte tant qu'elle dure.
 */

import type { Inst } from '../theme';

export interface MixPage {
  /** la voix reglee */
  sel: Inst;
  /** performance.now() de fin d'affichage */
  until: number;
}

/** Duree d'affichage apres le dernier reglage. */
export const LCD_MIX_MS = 1500;

let current: MixPage | null = null;
const listeners = new Set<() => void>();

export const lcdMix = {
  get(now: number = performance.now()): MixPage | null {
    return current && now < current.until ? current : null;
  },
  show(sel: Inst, ms: number = LCD_MIX_MS): void {
    current = { sel, until: performance.now() + ms };
    listeners.forEach((fn) => fn());
  },
  /** Fermee tout de suite (un autre message prend l'ecran). */
  hide(): void {
    if (!current) return;
    current = null;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
