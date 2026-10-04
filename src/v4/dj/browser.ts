/**
 * La playlist du MM-DECKS (2026-10-04) : cachee par defaut, comme les
 * editeurs EDIT du MM-RYTM et du MM-ARP (Mika : "il faut cliquer sur un
 * bouton PLAYLIST sur le MIXER pour voir la playlist s'afficher en bas").
 * La touche PLAYLIST l'ouvre et la ferme ; LOAD sur une platine l'ouvre en
 * visant cette platine ; Echap ou DONE la ferment. Agrandie (big), elle
 * passe par-dessus la machine. Un store fait main (get, subscribe), lu par
 * dj/TrackBrowser.tsx et par le rig (la touche s'allume).
 */

import type { DjDeck } from './theme';

export interface DjBrowserState {
  open: boolean;
  /** agrandie par-dessus la machine */
  big: boolean;
  /** la platine visee par LOAD */
  deck: DjDeck;
}

let state: DjBrowserState = { open: false, big: false, deck: 'a' };
const listeners = new Set<() => void>();
const set = (next: DjBrowserState): void => {
  if (next.open === state.open && next.big === state.big && next.deck === state.deck) return;
  state = next;
  listeners.forEach((fn) => fn());
};

export const djBrowser = {
  get: (): DjBrowserState => state,
  /** Ouvre, en visant une platine (LOAD) ; big : agrandie. */
  open(deck: DjDeck = state.deck, big = state.big): void {
    set({ open: true, big, deck });
  },
  close(): void {
    set({ ...state, open: false, big: false });
  },
  /** La touche PLAYLIST du MIXER. */
  toggle(): void {
    if (state.open) this.close();
    else this.open();
  },
  /** Agrandie ou repliee (la playlist reste ouverte). */
  grow(big: boolean): void {
    set({ ...state, open: true, big });
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
