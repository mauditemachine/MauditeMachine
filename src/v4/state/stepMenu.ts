/**
 * Le menu du clic droit sur un pas (le plugin, 2026-11-19, Mika : "quand je fais un clic droit sur un pas je voudrais aussi
 * avoir la possibilite de changer pour que ce pas joue 1x sur 2, 1x sur 4, random, comme Elektron") : le pas en P-LOCK
 * (actions/locks.ts stepLockRight, comme avant) et, a cote, ses conditions (plugin/StepMenu.tsx). Ici : quel pas, ou.
 */

export interface StepMenuState {
  /** le pas (0 a 15) ; -1 : ferme */
  step: number;
  /** la position du clic (px de la fenetre) */
  x: number;
  y: number;
}

let state: StepMenuState = { step: -1, x: 0, y: 0 };
const listeners = new Set<() => void>();
const set = (s: StepMenuState): void => {
  state = s;
  listeners.forEach((fn) => fn());
};

export const stepMenu = {
  get: (): StepMenuState => state,
  open(step: number, x: number, y: number): void {
    set({ step, x, y });
  },
  close(): void {
    if (state.step >= 0) set({ ...state, step: -1 });
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
