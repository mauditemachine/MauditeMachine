/**
 * La page du capot du MM-ARP (2026-11-13, Mika : "trop de menus dans OPEN, fusionne les 7 onglets en beaucoup moins de
 * pages") : trois pages, SOUND (les TWEAKS de la face, OSC +, FILTER +, AMP, VOICE, EQ, MASTER, DISTORTION, ENGINE), FX
 * (le rack, et HELL sur sa sous-page) et SEQ (le sequenceur par pas, RANDOM, les LFO, la matrice). LIBRARY (+ DISK) et
 * MIDI (DRAG MIDI, MIDI LEARN) ne sont plus des onglets : deux touches du bandeau ouvrent leur volet par-dessus la page.
 * OPEN rouvre la page qu'on a quittee (SOUND au chargement). focus : le cadre a faire clignoter (le clic d'un
 * potard de la face, plugin/arp/hellKnob.tsx). Rien n'est garde entre deux fenetres.
 */

export type HoodTab = 'sound' | 'fx' | 'seq';
export type HoodFx = 'hell' | 'reverb' | 'disto' | 'delay';
export type HoodOverlay = 'library' | 'midi' | null;

export const HOOD_TABS: readonly { id: HoodTab; label: string }[] = [
  { id: 'sound', label: 'SOUND' },
  { id: 'fx', label: 'FX' },
  { id: 'seq', label: 'SEQ' },
];

/**
 * Les pages a plat, les touches de l'en-tete (2026-11-17, Mika : "le moins de pages possible") : SOUND (le son et le rack
 * d'effets), DISTO, DELAY (v27), HELL, REVERB, SEQ.
 */
export const HOOD_PAGES: readonly { id: string; label: string; tab: HoodTab; fx: HoodFx | null }[] = [
  { id: 'sound', label: 'SOUND', tab: 'sound', fx: null },
  // la DISTO facon Decapitator (2026-11-17) : juste apres le moteur, avant les effets
  { id: 'disto', label: 'DISTO', tab: 'fx', fx: 'disto' },
  // v27 : la page DELAY (facon EchoBoy / H-Delay) ; le clic du potard DELAY de la face y mene
  { id: 'delay', label: 'DELAY', tab: 'fx', fx: 'delay' },
  { id: 'hell', label: 'HELL', tab: 'fx', fx: 'hell' },
  // la reverbe facon BigSky (2026-11-16, Mika) : le clic du potard REVERB de la face y mene
  { id: 'reverb', label: 'REVERB', tab: 'fx', fx: 'reverb' },
  { id: 'seq', label: 'SEQ', tab: 'seq', fx: null },
];

export interface HoodPageState {
  tab: HoodTab;
  fx: HoodFx;
  overlay: HoodOverlay;
  /** le titre du cadre montre (clic sur un potard de la face), et son numero (chaque demande rejoue le clignotement) */
  focus: string | null;
  focusN: number;
}

let state: HoodPageState = { tab: 'sound', fx: 'hell', overlay: null, focus: null, focusN: 0 };
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

/** Le rang de la page montree dans HOOD_PAGES. */
export function hoodPageIndex(s: HoodPageState): number {
  return HOOD_PAGES.findIndex((p) => p.tab === s.tab && (p.fx === null || p.fx === s.fx));
}

/** La page d'avant ou la suivante (wrap : en boucle, pour les fleches du clavier) ; le volet par-dessus se ferme. */
export function hoodPageStep(d: number, wrap: boolean): void {
  const n = HOOD_PAGES.length;
  const s = hoodPage.get();
  const i0 = hoodPageIndex(s);
  const i = wrap ? (((i0 + d) % n) + n) % n : Math.max(0, Math.min(n - 1, i0 + d));
  const p = HOOD_PAGES[i];
  hoodPage.set({ tab: p.tab, fx: p.fx ?? s.fx, overlay: null });
}
