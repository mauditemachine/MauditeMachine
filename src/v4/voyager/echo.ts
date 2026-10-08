/**
 * L'echo d'un potard sur le grand ecran du MM-ARP (2026-10-08, l'habitude
 * des Elektron, comme l'echo du MM-BASS) : le potard qu'on vient de toucher
 * (la souris, le doigt, la molette, le clavier, le MIDI, le Dock) prend
 * l'ecran, son nom, sa valeur de 0 a 127 en grand, son unite, son dessin ;
 * ECHO_MS apres le dernier geste, la vue de l'arpege revient. Tant qu'un
 * doigt ou la souris le tient (hold), il reste.
 *
 * Les prises sont comptees par pointeur (revue du 2026-10-08 : une seule
 * place avant, deux doigts sur deux potards, lacher l'un effacait l'echo
 * que l'autre tenait encore) : l'echo ne s'efface qu'une fois tous les
 * pointeurs laches ; release() d'un pointeur inconnu ne fait rien, et
 * releaseAll() rend tout (la couche de saisie demontee en plein geste).
 */

import type { VoyKnobId } from './params';

export const ECHO_MS = 1500;

let id: VoyKnobId | null = null;
/** les pointeurs qui tiennent un potard (pointerId, le potard) */
const held = new Map<number, VoyKnobId>();
let timer = 0;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

function arm(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = 0;
    if (held.size > 0) return;
    id = null;
    emit();
  }, ECHO_MS);
}

export const voyEcho = {
  /** Le potard montre (null : la vue de l'arpege). */
  get: (): VoyKnobId | null => id,
  /** Combien de pointeurs tiennent un potard (les tests). */
  get holds(): number {
    return held.size;
  },
  /** Un potard vient de bouger (ou d'etre touche). */
  touch(k: VoyKnobId): void {
    const changed = id !== k;
    id = k;
    arm();
    // La valeur, elle, arrive par voyParams : l'ecran ne se redessine que si le potard change
    if (changed) emit();
  },
  /** Un pointeur prend ce potard : tant qu'il le tient, l'echo ne s'efface pas. */
  hold(pointer: number, k: VoyKnobId): void {
    held.set(pointer, k);
    voyEcho.touch(k);
  },
  /** Ce pointeur lache son potard ; le dernier lache, l'echo s'efface ECHO_MS plus tard. */
  release(pointer: number): void {
    if (!held.delete(pointer)) return;
    if (held.size === 0) arm();
  },
  /** Plus aucun pointeur ne tient rien (la couche de saisie s'en va). */
  releaseAll(): void {
    if (held.size === 0) return;
    held.clear();
    arm();
  },
  /** Plus d'echo tout de suite (une autre page de l'ecran, les tests). */
  clear(): void {
    window.clearTimeout(timer);
    timer = 0;
    held.clear();
    if (id === null) return;
    id = null;
    emit();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
