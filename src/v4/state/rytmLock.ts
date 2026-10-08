/**
 * Le LOCK du MM-RYTM (2026-10-08, l'etape R2 des parameter locks, Mika :
 * "quand on clic sur un step on selectionne la partie qu'on veut modifier,
 * ensuite on tourne un encoder sur ce step et donc ce step a une valeur
 * differente ... MEME CHOSE DANS RYTM") : le pas dont les potards de page
 * reglent les verrous (audio/locks.ts), comme le trig tenu d'une Elektron.
 * - step : le pas en LOCK (0 a 15), -1 aucun ; latched : il reste quand on
 *   le lache (une tenue de 350 ms lachee sans rien tourner, une tape en
 *   LOCK, L, le MIDI), sinon il est tenu (le lacher apres avoir tourne un
 *   potard en sort : un LOCK momentane, comme sur le MM-BASS) ;
 * - held : les pas tenus en ce moment (la souris, un ou plusieurs doigts) :
 *   un potard tourne pendant qu'ils sont tenus les verrouille tous ;
 * - writes : les verrous poses depuis le chargement (un pas tenu sait ainsi
 *   si un potard a tourne pendant sa tenue : son lacher ne le change pas).
 * On en sort par le meme pas, Echap, EDIT, une autre machine, L. Rien n'est
 * retenu : une visite commence hors LOCK.
 */

import { editor } from './editor';
import { focus } from './focus';

export interface RytmLockState {
  readonly step: number;
  readonly latched: boolean;
  readonly held: readonly number[];
  readonly writes: number;
  /** writes a l'entree du LOCK : un LOCK tenu qui a deja recu un verrou en sortira au lacher */
  readonly since: number;
}

let state: RytmLockState = { step: -1, latched: false, held: [], writes: 0, since: 0 };
const listeners = new Set<() => void>();

function set(next: Partial<RytmLockState>): void {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}

const valid = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < 16;

export const rytmLock = {
  get: (): RytmLockState => state,
  /** Le LOCK sur le pas i ; latched : il reste au lacher. */
  enter(i: number, latched: boolean): void {
    // Jamais dans EDIT (revue de R2) : ses pas y sont les seize patterns
    if (!valid(i) || editor.get() === 'mm808') return;
    if (state.step === i && state.latched === latched) return;
    set({ step: i, latched, since: state.writes });
  },
  /** Le LOCK fixe (le pas tenu lache sans rien tourner). */
  latch(): void {
    if (state.step >= 0 && !state.latched) set({ latched: true });
  },
  /** Hors LOCK ; rend true s'il y en avait un. */
  leave(): boolean {
    if (state.step < 0) return false;
    set({ step: -1, latched: false });
    return true;
  },
  /** Un pas tenu (pointerdown). */
  hold(i: number): void {
    if (!valid(i) || state.held.includes(i)) return;
    set({ held: [...state.held, i] });
  },
  /** Un pas lache. */
  release(i: number): void {
    if (!state.held.includes(i)) return;
    set({ held: state.held.filter((x) => x !== i) });
  },
  /** Plus aucun pas tenu (la couche de saisie demontee, un pointeur perdu). */
  releaseAll(): void {
    if (state.held.length > 0) set({ held: [] });
  },
  /** Un verrou pose ou retire : le compteur des tenues avance. */
  wrote(): void {
    set({ writes: state.writes + 1 });
  },
  /** Les pas qu'un potard verrouille en LOCK : les pas tenus, sinon le pas en LOCK ; [] hors LOCK. */
  targets(): readonly number[] {
    if (state.step < 0) return [];
    return state.held.length > 0 ? state.held : [state.step];
  },
  /**
   * Un potard de page regle-t-il des verrous en ce moment (un pas en LOCK) ?
   * Un pas seulement tenu ne suffit pas (une tape ne fait pas tourner les
   * potards vers ses verrous) : le premier potard tourne pendant la tenue
   * met le LOCK sur lui (actions.ts pageDial).
   */
  active(): boolean {
    return state.step >= 0;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

// EDIT (les pas y sont les patterns) et une autre machine : hors LOCK
if (typeof window !== 'undefined') {
  editor.subscribe(() => {
    if (editor.get() === 'mm808') {
      rytmLock.leave();
      rytmLock.releaseAll();
    }
  });
  focus.subscribe(() => {
    const f = focus.get();
    if (f !== 'mm808') rytmLock.leave();
  });
}
