/**
 * L'editeur ouvert (2026-10-04, Mika : "cette partie cachee, qui s'ouvre en
 * cliquant sur un bouton EDIT sur la machine, en desktop et en mobile ; la
 * meme chose pour RYTM, avec des editions de pattern rythmique, avec
 * velocite"). Une machine a la fois : 'voy' (la suite de l'arpege,
 * ui/SeqLane.tsx), 'mm808' (le motif et ses velocites, ui/BeatEditor.tsx)
 * ou 'bass' (les seize patterns du MM-BASS sur ses pas, 2026-10-07).
 * Le bouton EDIT de la machine l'ouvre ou le ferme (touche E aussi) ; passer
 * a une autre machine le ferme.
 */

import { focus } from './focus';

export type EditorId = 'voy' | 'mm808' | 'bass';

let current: EditorId | null = null;
/**
 * V.6.0 (2026-11-01, la face DT2 derriere ?face=dt2, cahier dt2 1.3) : PTN choisit sur les TRIG (l'editeur 'mm808' ouvert,
 * les pas 3D montrent les patterns) et la grille HTML posee sur les pas (ui/BeatEditor.tsx) devient un extra, EDIT GRID
 * (SETTINGS > PATTERN > EDIT GRID, Maj + E) : grid dit si elle se montre. Sans le drapeau, personne ne le lit.
 */
let grid = false;
const listeners = new Set<() => void>();

function set(next: EditorId | null): void {
  if (next === current) return;
  current = next;
  if (next !== 'mm808') grid = false;
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
  /** La face DT2 : la grille HTML (EDIT GRID) se montre-t-elle sur l'editeur du MM-RYTM ? */
  grid: (): boolean => grid && current === 'mm808',
  /** EDIT GRID (la face DT2) : l'editeur du MM-RYTM s'ouvre avec sa grille, ou la grille se ferme (l'editeur aussi). */
  setGrid(on: boolean): void {
    if (on === (grid && current === 'mm808')) return;
    grid = on;
    if (on) current = 'mm808';
    else if (current === 'mm808') current = null;
    listeners.forEach((fn) => fn());
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
