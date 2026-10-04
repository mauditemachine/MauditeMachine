/**
 * La liste des morceaux du MM-DECKS (2026-10-04) : ouverte par LOAD sur une
 * platine, elle dit pour laquelle ; un choix pose le morceau sur A ou B.
 * Un store fait main (get, subscribe), lu par dj/TrackBrowser.tsx.
 */

import type { DjDeck } from './theme';

export interface DjBrowserState {
  open: boolean;
  deck: DjDeck;
}

let state: DjBrowserState = { open: false, deck: 'a' };
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

export const djBrowser = {
  get: (): DjBrowserState => state,
  open(deck: DjDeck): void {
    state = { open: true, deck };
    emit();
  },
  close(): void {
    if (!state.open) return;
    state = { ...state, open: false };
    emit();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
