/**
 * Vue de l'orbite (revision 2, spec 20.2.9) : moved = la camera a quitte
 * la vue par defaut (azimut 45, elevation 38, zoom 1, a 0.5 deg et 1 %
 * pres). Ecrit par scene/orbit.ts seulement quand il bascule ; le bouton
 * RESET VIEW, data-v4-view et window.__v4.state.view le lisent.
 */

let moved = false;
/** bascules depuis le chargement (revue) */
let flips = 0;
const listeners = new Set<() => void>();

export const view = {
  get: (): boolean => moved,
  set(m: boolean): void {
    if (m === moved) return;
    moved = m;
    flips += 1;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  get flips(): number {
    return flips;
  },
};
