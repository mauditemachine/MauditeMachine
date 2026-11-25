/**
 * La face v3 du plugin (2026-11-25) : ce qu'elle montre. La face, ou une page d'OPEN (toute la fenetre, comme le MM-ARP :
 * Mika, "les open de page doivent se faire de la meme maniere que ARP") ; les onglets d'OPEN sont aussi sur la face (le
 * choix C) : un clic ouvre directement sa page. Le capot du site (state/explode.ts) reste la source d'OPEN : la touche O,
 * Echap et OPEN du MIDI passent par lui ; la face v3 s'y declare et le pose ouvert ou ferme tout de suite (pas d'animation).
 */

import { explode } from '../../state/explode';

export const TABS = ['SAMPLE', 'SEQ', 'LFO', 'DISTO', 'CHORUS', 'DELAY', 'REVERB', 'HELL', 'MASTER'] as const;
/** Les pages de la bande du bas (LIBRARY, MIDI) : des pages d'OPEN sans onglet. */
export type Page = (typeof TABS)[number] | 'LIBRARY' | 'MIDI';

const KEY = 'mm.v4.plugin.v3.page';
const isPage = (v: unknown): v is Page => typeof v === 'string' && ((TABS as readonly string[]).includes(v) || v === 'LIBRARY' || v === 'MIDI');

interface ViewState {
  /** la page d'OPEN ouverte ; null : la face */
  page: Page | null;
  /** la derniere page vue (la touche O la rouvre) */
  last: Page;
  /** le menu (le hamburger) */
  menu: boolean;
  /** l'aide de la souris et du clavier (dans le menu) */
  help: boolean;
  /** MIDI LEARN arme (la bande du bas) */
  learn: boolean;
}

function lastOf(): Page {
  try {
    const v = window.localStorage.getItem(KEY);
    if (isPage(v)) return v;
  } catch {
    /* rien de garde */
  }
  return 'SAMPLE';
}

let state: ViewState = { page: null, last: typeof window === 'undefined' ? 'SAMPLE' : lastOf(), menu: false, help: false, learn: false };
const listeners = new Set<() => void>();
const set = (p: Partial<ViewState>): void => {
  state = { ...state, ...p };
  listeners.forEach((fn) => fn());
};

export const view = {
  get: (): ViewState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Une page d'OPEN (un onglet de la face ou de l'OPEN, LIBRARY, MIDI). */
  open(p: Page): void {
    try {
      window.localStorage.setItem(KEY, p);
    } catch {
      /* pas de stockage : la page vit pour la session */
    }
    set({ page: p, last: p, menu: false });
    if (explode.get() === 'closed') explode.toggle();
  },
  /** Retour a la face (CLOSE, ×, Echap). */
  close(): void {
    set({ page: null, menu: false });
    if (explode.get() === 'open') explode.toggle();
  },
  menu(on?: boolean): void {
    set({ menu: on ?? !state.menu, help: false });
  },
  help(on: boolean): void {
    set({ help: on });
  },
  learn(on?: boolean): void {
    set({ learn: on ?? !state.learn });
  },
};

/**
 * Le capot du site, branche sur la face v3 : O, Echap, OPEN du MIDI l'ouvrent ou le ferment ; la face le pose aussitot
 * (aucune animation) et montre la page. Rend de quoi se debrancher.
 */
export function attachHood(): () => void {
  const detach = explode.attach();
  const off = explode.subscribe(() => {
    const s = explode.get();
    if (s === 'opening') {
      if (!state.page) set({ page: state.last, menu: false });
      explode.settle(true);
    } else if (s === 'closing') {
      if (state.page) set({ page: null, menu: false });
      explode.settle(false);
    }
  });
  // Une face rechargee capot ouvert : la page revient
  if (explode.get() === 'open' && !state.page) set({ page: state.last });
  return () => {
    off();
    detach();
  };
}
