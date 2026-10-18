/**
 * Le bloc du MM-DECKS cadre au telephone (2026-10-04, Mika pour les Decks
 * de sonaa.ca : "un deck dans la fenetre, je swipe, je fais rentrer le
 * mixer, je swipe, je fais rentrer l'autre deck") : DECK A, MIXER, DECK B,
 * puis les platines ajoutees et le + (dj/theme.ts DJ_VIEW_UNITS). Sur
 * desktop l'ensemble est cadre et ce store ne sert pas. Le Stage
 * (scene/renderer.ts) anime le cadrage vers le bloc.
 *
 * Tenu droit (2026-10-18, Mika : "En mobile je veux juste Mixer et pas de
 * deck ; en desktop oui") : un seul bloc, la table ('mix') ; next() rend null
 * des deux cotes, les fleches et le glisser passent droit aux machines
 * voisines.
 */

import { DJ_VIEW_UNITS, djDecks, type DjUnit } from './theme';

/** Le premier bloc : DECK A, ou la table quand elle est seule (telephone tenu droit). */
let unit: DjUnit = DJ_VIEW_UNITS.includes('a') ? 'a' : (DJ_VIEW_UNITS[0] ?? 'mix');
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
  const lastDeck = DJ_VIEW_UNITS[DJ_VIEW_UNITS.length - (DJ_VIEW_UNITS.includes('add') ? 2 : 1)];
  if (added || !DJ_VIEW_UNITS.includes(unit)) unit = lastDeck;
  emit();
});

export const djView = {
  get: (): DjUnit => unit,
  set(u: DjUnit): void {
    if (u === unit || !DJ_VIEW_UNITS.includes(u)) return;
    unit = u;
    emit();
  },
  /** Le bloc voisin (+1 a droite, -1 a gauche), ou null au bord. */
  next(dir: 1 | -1): DjUnit | null {
    const i = DJ_VIEW_UNITS.indexOf(unit) + dir;
    return i >= 0 && i < DJ_VIEW_UNITS.length ? DJ_VIEW_UNITS[i] : null;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
