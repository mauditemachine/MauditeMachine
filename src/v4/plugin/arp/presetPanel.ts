/**
 * Le navigateur de presets du plugin MM-ARP (v53, Mika : "pas fan du tout des presets ... et de la facon dont je peux les
 * selectionner" ; "je veux pouvoir scroller et choisir en cliquant un preset, mieux vaut avoir plus de choix que pas
 * assez" ; l'option C de la maquette : en grand sur la face, les familles en colonnes qui defilent, un clic charge).
 * Son etat seulement (ouvert ou non, l'onglet FACTORY / USER), sans dependance lourde : le pont (bridge.ts) le lit pour le
 * clavier (mm_keys), la vue est PresetBrowser.tsx.
 *
 * La touche PRESET de la face, l'ecran touche au repos et leur touche jumelle passent par presetKey (actions/presets.ts) :
 * le crochet du plugin (voyager/presetHook.ts), pose ici, les prend toutes. 'open' ouvre ou ferme le navigateur (un second
 * appui ferme), 'close' et 'exit' le ferment ; la liste des presets du site sur le grand ecran (state/presetMode.ts) ne
 * s'ouvre plus dans le plugin.
 */

import { voyPresetHook } from '../../voyager/presetHook';

export type PresetTab = 'factory' | 'user';

export interface PresetPanelState {
  open: boolean;
  tab: PresetTab;
}

let state: PresetPanelState = { open: false, tab: 'factory' };
const listeners = new Set<() => void>();

function set(next: Partial<PresetPanelState>): void {
  const s = { ...state, ...next };
  if (s.open === state.open && s.tab === state.tab) return;
  state = s;
  listeners.forEach((fn) => fn());
}

export const presetPanel = {
  get: (): PresetPanelState => state,
  isOpen: (): boolean => state.open,
  open(): void {
    set({ open: true });
  },
  close(): void {
    set({ open: false });
  },
  toggle(): void {
    set({ open: !state.open });
  },
  setTab(tab: PresetTab): void {
    set({ tab });
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

voyPresetHook.set((k) => {
  if (k === 'open') presetPanel.toggle();
  else if (k === 'close' || k === 'exit') presetPanel.close();
  // Les autres touches du mode presets du site (PREV, NEXT, LOAD...) n'existent que liste ouverte : jamais dans le plugin
  return true;
});

// ?probe (les essais sans son, Chromium) : l'etat du panneau et le crochet, a la main
if (typeof location !== 'undefined' && location.search.includes('probe'))
  (window as unknown as { __mmPresetPanel?: unknown }).__mmPresetPanel = { panel: presetPanel, key: (k: Parameters<typeof voyPresetHook.key>[0]) => voyPresetHook.key(k) };
