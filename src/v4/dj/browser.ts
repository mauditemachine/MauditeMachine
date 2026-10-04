/**
 * L'ecran de chaque platine montre le morceau ou la liste des morceaux
 * (2026-10-04, Mika : "pouvoir voir la playlist a l'interieur de chaque
 * deck ; pas besoin d'assigner a A ou B, on a directement les tracks a
 * l'interieur des decks, et on les load sur le deck qu'on veut, comme un
 * CDJ"). Une platine vide montre la liste ; choisir un morceau le pose sur
 * elle et l'ecran revient au morceau ; toucher l'ecran (ou E et I au
 * clavier) rouvre la liste ; DONE la ferme. Un store fait main (get,
 * subscribe), lu par dj/TrackBrowser.tsx et par le geste de l'ecran.
 */

import type { DjDeck } from './theme';

/** true : l'ecran de la platine montre la liste ; absente : la liste si elle est vide. */
type Browse = Partial<Record<DjDeck, boolean>>;

let state: Browse = {};
const listeners = new Set<() => void>();
const set = (d: DjDeck, on: boolean): void => {
  if (state[d] === on) return;
  state = { ...state, [d]: on };
  listeners.forEach((fn) => fn());
};

export const djBrowser = {
  get: (): Browse => state,
  /** La liste dans l'ecran de cette platine. */
  open(d: DjDeck): void {
    set(d, true);
  },
  /** L'ecran revient au morceau. */
  close(d: DjDeck): void {
    set(d, false);
  },
  toggle(d: DjDeck): void {
    set(d, !state[d]);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
