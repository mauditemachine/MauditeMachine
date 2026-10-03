/**
 * Deux machines (2026-10-03, demande de Mika) : la MM-808 et le
 * MM-VOYAGER, cote a cote sur la meme table. focus dit laquelle on
 * utilise : 'all' (vue d'ensemble, desktop : un clic sur une machine zoome
 * dessus), 'mm808' ou 'voy'. Au telephone, une machine a la fois : on
 * glisse pour passer de l'une a l'autre. Le Stage anime le cadrage vers la
 * cible (settled passe a true a l'arrivee) ; les jumeaux, la couche de
 * saisie, l'en-tete et le Dock le lisent.
 *
 * Sans le MM-VOYAGER (?voyager=0, ou tant qu'il n'est pas active par
 * defaut), la 808 seule : focus reste 'mm808'.
 */

export type MachineId = 'mm808' | 'voy';
export type Focus = 'all' | MachineId;

/**
 * Le MM-VOYAGER est-il sur la table ? ?voyager=1 l'active, ?voyager=0 le
 * retire (retenu pour l'onglet).
 */
export const VOYAGER: boolean = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('voyager');
    if (q === '1' || q === '0') window.sessionStorage.setItem('mm.v4.voyager', q);
    return window.sessionStorage.getItem('mm.v4.voyager') === '1';
  } catch {
    return false;
  }
})();

let current: Focus = 'mm808';
/** le cadrage est arrive (false pendant le zoom d'une machine a l'autre) */
let settled = true;
let changes = 0;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

export const focus = {
  get: (): Focus => current,
  settled: (): boolean => settled,
  /** Nouvelle cible ; sans le MM-VOYAGER, toujours la 808. */
  set(f: Focus): void {
    const next: Focus = VOYAGER ? f : 'mm808';
    if (next === current) return;
    current = next;
    settled = false;
    changes += 1;
    emit();
  },
  /** Le Stage : le cadrage est arrive. */
  settle(): void {
    if (settled) return;
    settled = true;
    emit();
  },
  /** La machine utilisee (vue d'ensemble : aucune). */
  machine: (): MachineId | null => (current === 'all' ? null : current),
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  get changes(): number {
    return changes;
  },
};
