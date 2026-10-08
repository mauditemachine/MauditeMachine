/**
 * L'echo d'un potard sur le grand ecran du MM-ARP (2026-10-08, l'habitude
 * des Elektron, comme l'echo du MM-BASS) : le potard qu'on vient de toucher
 * (la souris, le doigt, la molette, le clavier, le MIDI, le Dock) prend
 * l'ecran, son nom, sa valeur de 0 a 127 en grand, son unite, son dessin ;
 * ECHO_MS apres le dernier geste, la vue de l'arpege revient. Tant qu'un
 * doigt ou la souris le tient (hold), il reste.
 */

import type { VoyKnobId } from './params';

export const ECHO_MS = 1500;

let id: VoyKnobId | null = null;
let held: VoyKnobId | null = null;
let timer = 0;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

function arm(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = 0;
    if (held) return;
    id = null;
    emit();
  }, ECHO_MS);
}

export const voyEcho = {
  /** Le potard montre (null : la vue de l'arpege). */
  get: (): VoyKnobId | null => id,
  /** Un potard vient de bouger (ou d'etre touche). */
  touch(k: VoyKnobId): void {
    const changed = id !== k;
    id = k;
    arm();
    // La valeur, elle, arrive par voyParams : l'ecran ne se redessine que si le potard change
    if (changed) emit();
  },
  /** Un pointeur le tient (k) ou le lache (null) : tenu, l'echo ne s'efface pas. */
  hold(k: VoyKnobId | null): void {
    if (k) {
      held = k;
      voyEcho.touch(k);
      return;
    }
    if (!held) return;
    held = null;
    arm();
  },
  /** Plus d'echo tout de suite (une autre page de l'ecran, les tests). */
  clear(): void {
    window.clearTimeout(timer);
    timer = 0;
    held = null;
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
