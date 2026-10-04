/**
 * L'editeur ouvert (2026-10-04, Mika : "cette partie cachee, qui s'ouvre en
 * cliquant sur un bouton EDIT sur la machine, en desktop et en mobile ; la
 * meme chose pour RYTM, avec des editions de pattern rythmique, avec
 * velocite"). Une machine a la fois : 'voy' (la suite de l'arpege,
 * ui/SeqLane.tsx) ou 'mm808' (le motif et ses velocites, ui/BeatEditor.tsx).
 * Le bouton EDIT de la machine l'ouvre ou le ferme (touche E aussi) ; passer
 * a une autre machine le ferme.
 */

import { focus } from './focus';

export type EditorId = 'voy' | 'mm808';

let current: EditorId | null = null;
const listeners = new Set<() => void>();

function set(next: EditorId | null): void {
  if (next === current) return;
  current = next;
  listeners.forEach((fn) => fn());
}

export const editor = {
  get: (): EditorId | null => current,
  /** EDIT : ouvre l'editeur de cette machine, ou le ferme s'il l'etait. */
  toggle(id: EditorId): void {
    set(current === id ? null : id);
  },
  close(): void {
    set(null);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

// Une autre machine (ou la vue d'ensemble) : l'editeur se ferme
focus.subscribe(() => {
  if (current && focus.get() !== current) set(null);
});
