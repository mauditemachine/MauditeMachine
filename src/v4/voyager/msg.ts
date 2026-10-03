/**
 * Message passager de l'ecran du MM-VOYAGER (ligne 3) : le potard qu'on
 * tourne (CUTOFF 64%), CLEARED, RANDOM F#m D A E... 1.4 s par defaut ; un
 * nouveau message remplace le precedent.
 */

let text: string | null = null;
let timer = 0;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

export const voyMsg = {
  get: (): string | null => text,
  show(t: string, ms = 1400): void {
    window.clearTimeout(timer);
    text = t;
    emit();
    timer = window.setTimeout(() => {
      timer = 0;
      text = null;
      emit();
    }, ms);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
