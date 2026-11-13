/**
 * L'onglet du capot du MM-ARP (2026-11-13, Mika : "je voudrais le contenu de la page 1 dans la page 2 et je veux avoir
 * qu'une seule page") : une seule carte, la noire (HoodBoard.tsx), et ses onglets. OPEN rouvre l'onglet qu'on a quitte
 * (TWEAKS au chargement). Rien n'est garde entre deux fenetres.
 */

export type HoodTab = 'tweaks' | 'sound' | 'fx' | 'mod' | 'steps' | 'library' | 'midi';

export const HOOD_TABS: readonly { id: HoodTab; label: string }[] = [
  { id: 'tweaks', label: 'TWEAKS' },
  { id: 'sound', label: 'SOUND' },
  { id: 'fx', label: 'FX' },
  { id: 'mod', label: 'MOD' },
  { id: 'steps', label: 'STEPS' },
  { id: 'library', label: 'LIBRARY' },
  { id: 'midi', label: 'MIDI' },
];

interface HoodPageState {
  tab: HoodTab;
}

let state: HoodPageState = { tab: 'tweaks' };
const listeners = new Set<() => void>();

export const hoodPage = {
  get: (): HoodPageState => state,
  set(next: Partial<HoodPageState>): void {
    const s = { ...state, ...next };
    if (s.tab === state.tab) return;
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
