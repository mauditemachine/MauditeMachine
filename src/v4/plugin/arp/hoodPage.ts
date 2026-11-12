/**
 * La page du capot du MM-ARP (2026-11-12, Mika : "fais une seconde page quand on clic sur Open et qui rajoute toutes les
 * fonctions qu'on voulait") : page 1, la carte verte et ses TWEAKS (HoodPanel.tsx, inchangee) ; page 2, la carte noire
 * (Page2.tsx) et ses onglets. OPEN rouvre la page qu'on a quittee (page 1 au chargement). Rien n'est garde entre deux
 * fenetres : la page 1 revient a chaque ouverture du plugin.
 */

export type HoodPageNo = 1 | 2;
export type HoodTab = 'sound' | 'fx' | 'mod' | 'steps' | 'library';

export const HOOD_TABS: readonly { id: HoodTab; label: string }[] = [
  { id: 'sound', label: 'SOUND' },
  { id: 'fx', label: 'FX' },
  { id: 'mod', label: 'MOD' },
  { id: 'steps', label: 'STEPS' },
  { id: 'library', label: 'LIBRARY' },
];

interface HoodPageState {
  page: HoodPageNo;
  tab: HoodTab;
}

let state: HoodPageState = { page: 1, tab: 'sound' };
const listeners = new Set<() => void>();

export const hoodPage = {
  get: (): HoodPageState => state,
  set(next: Partial<HoodPageState>): void {
    const s = { ...state, ...next };
    if (s.page === state.page && s.tab === state.tab) return;
    state = s;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
