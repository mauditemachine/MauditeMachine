/**
 * OPEN : l'etat de la vue eclatee (spec 7.1 et 7.2), closed, opening, open
 * ou closing. OPEN (bouton, touche O, jumeau) demande opening ou closing,
 * seulement depuis un etat pose (closed ou open) : une animation en cours
 * n'est jamais retournee. Le Stage anime la demande et pose open ou closed
 * a la fin (settle). Sans Stage branche (repli sans WebGL, scene pas encore
 * creee) OPEN ne fait rien. La scene, les jumeaux, l'attribut
 * data-v4-exploded et le debug lisent ce store.
 */

export type ExplodeState = 'closed' | 'opening' | 'open' | 'closing';

/** Les puces repondent pendant l'ouverture et vue ouverte (spec 7.2). */
export const chipsLive = (s: ExplodeState): boolean => s === 'opening' || s === 'open';

export interface ExplodeStore {
  get(): ExplodeState;
  subscribe(fn: () => void): () => void;
  /** OPEN_TOGGLE : true si la demande est prise. */
  toggle(): boolean;
  /** Fin d'animation, posee par le Stage. */
  settle(open: boolean): void;
  /** Le Stage se declare ; renvoie son retrait. */
  attach(): () => void;
  /** Demontage de /v4 : un retour repart ferme. */
  reset(): void;
  readonly toggles: number;
}

/** Un capot : la 808 (explode) et le MM-VOYAGER (voyExplode, 2026-10-03) ont chacun le sien. */
function makeExplode(): ExplodeStore {
  let current: ExplodeState = 'closed';
  /** Stages branches (StrictMode monte deux fois en DEV) */
  let drivers = 0;
  /** demandes acceptees depuis le chargement (revue) */
  let toggles = 0;
  const listeners = new Set<() => void>();
  const set = (s: ExplodeState): void => {
    if (s === current) return;
    current = s;
    listeners.forEach((fn) => fn());
  };
  return {
    get: () => current,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    toggle() {
      if (drivers === 0) return false;
      if (current === 'closed') {
        toggles += 1;
        set('opening');
        return true;
      }
      if (current === 'open') {
        toggles += 1;
        set('closing');
        return true;
      }
      return false;
    },
    settle(open) {
      set(open ? 'open' : 'closed');
    },
    attach() {
      drivers += 1;
      let on = true;
      return () => {
        if (!on) return;
        on = false;
        drivers = Math.max(0, drivers - 1);
      };
    },
    reset() {
      set('closed');
    },
    get toggles() {
      return toggles;
    },
  };
}

export const explode = makeExplode();
export const voyExplode = makeExplode();
/** Le MM-BASS a son capot depuis le 2026-10-08 (Mika : "un bouton OPEN"). */
export const bassExplode = makeExplode();
