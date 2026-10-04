/**
 * Le bloc du MM-DECKS cadre au telephone (2026-10-04, Mika pour les Decks
 * de sonaa.ca : "un deck dans la fenetre, je swipe, je fais rentrer le
 * mixer, je swipe, je fais rentrer l'autre deck") : DECK A, MIXER, DECK B,
 * puis les platines ajoutees et ADD DECK (dj/theme.ts DJ_UNITS_ON). Sur
 * desktop l'ensemble est cadre et ce store ne sert pas. Le Stage
 * (scene/renderer.ts) anime le cadrage vers le bloc.
 */

import { DJ_UNITS_ON, djDecks, type DjUnit } from './theme';

let unit: DjUnit = 'a';
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

/*
 * Une platine ajoutee ou retiree : on cadre la nouvelle (ajout), ou la
 * voisine de gauche si le bloc cadre n'existe plus (retrait).
 */
let count = djDecks.get();
djDecks.subscribe(() => {
  const n = djDecks.get();
  const added = n > count;
  count = n;
  if (added) unit = DJ_UNITS_ON[DJ_UNITS_ON.length - (DJ_UNITS_ON.includes('add') ? 2 : 1)];
  else if (!DJ_UNITS_ON.includes(unit)) unit = DJ_UNITS_ON[DJ_UNITS_ON.length - (DJ_UNITS_ON.includes('add') ? 2 : 1)];
  emit();
});

export const djView = {
  get: (): DjUnit => unit,
  set(u: DjUnit): void {
    if (u === unit || !DJ_UNITS_ON.includes(u)) return;
    unit = u;
    emit();
  },
  /** Le bloc voisin (+1 a droite, -1 a gauche), ou null au bord. */
  next(dir: 1 | -1): DjUnit | null {
    const i = DJ_UNITS_ON.indexOf(unit) + dir;
    return i >= 0 && i < DJ_UNITS_ON.length ? DJ_UNITS_ON[i] : null;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
