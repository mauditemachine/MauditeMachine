/**
 * Intro (spec 7.4) : 'pending' pendant la montee de la machine et le test
 * des LED, 'done' ensuite, et d'emblee sous reduced motion ou sans WebGL.
 * Le Stage l'ecrit ; data-v4-intro et window.__v4.state.intro le lisent.
 */

export type IntroState = 'pending' | 'done';

let current: IntroState = 'done';
const listeners = new Set<() => void>();

export const intro = {
  get: (): IntroState => current,
  set(s: IntroState): void {
    if (s === current) return;
    current = s;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
