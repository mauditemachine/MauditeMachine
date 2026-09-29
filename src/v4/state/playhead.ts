/**
 * Tete de lecture AFFICHEE : le pas que la scene vient d'allumer, a
 * l'instant audio (clock.entryAt(ctx.currentTime)), -1 a l'arret. Ecrite
 * par la boucle de rendu, lue par le Dock et le debug : les LED 3D et le
 * Dock changent de pas sur la meme frame.
 */

let step = -1;
const listeners = new Set<() => void>();

export const playhead = {
  get: (): number => step,
  set(s: number): void {
    if (s === step) return;
    step = s;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
