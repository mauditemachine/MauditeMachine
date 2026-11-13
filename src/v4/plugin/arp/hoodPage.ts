/**
 * La page du capot du MM-ARP (2026-11-13, Mika : "trop de menus dans OPEN, fusionne les 7 onglets en beaucoup moins de
 * pages") : trois pages, SOUND (les TWEAKS de la face, OSC +, FILTER +, AMP, VOICE, EQ, MASTER, DISTORTION, ENGINE), FX
 * (le rack, et HELL sur sa sous-page) et SEQ (le sequenceur par pas, RANDOM, les LFO, la matrice). LIBRARY (+ DISK) et
 * MIDI (DRAG MIDI, MIDI LEARN) ne sont plus des onglets : deux touches du bandeau ouvrent leur volet par-dessus la page.
 * OPEN rouvre la page qu'on a quittee (SOUND au chargement). focus : le cadre a faire clignoter (le double clic d'un
 * potard de la face, plugin/arp/hellKnob.tsx). Rien n'est garde entre deux fenetres.
 */

export type HoodTab = 'sound' | 'fx' | 'seq';
export type HoodFx = 'rack' | 'hell';
export type HoodOverlay = 'library' | 'midi' | null;

export const HOOD_TABS: readonly { id: HoodTab; label: string }[] = [
  { id: 'sound', label: 'SOUND' },
  { id: 'fx', label: 'FX' },
  { id: 'seq', label: 'SEQ' },
];

export interface HoodPageState {
  tab: HoodTab;
  fx: HoodFx;
  overlay: HoodOverlay;
  /** le titre du cadre montre (double clic sur la face), et son numero (chaque demande rejoue le clignotement) */
  focus: string | null;
  focusN: number;
}

let state: HoodPageState = { tab: 'sound', fx: 'rack', overlay: null, focus: null, focusN: 0 };
const listeners = new Set<() => void>();

export const hoodPage = {
  get: (): HoodPageState => state,
  set(next: Partial<HoodPageState>): void {
    const s = { ...state, ...next };
    if (s.tab === state.tab && s.fx === state.fx && s.overlay === state.overlay && s.focus === state.focus && s.focusN === state.focusN) return;
    state = s;
    listeners.forEach((fn) => fn());
  },
  /** Une page, sa sous-page, un cadre a montrer (le volet par-dessus se ferme). */
  show(tab: HoodTab, fx: HoodFx | null, focus: string | null): void {
    hoodPage.set({ tab, fx: fx ?? state.fx, overlay: null, focus, focusN: state.focusN + 1 });
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
