/**
 * MASTER et TEMPO dans l'ecran du MM-RYTM (2026-10-19, Mika : "mets ces
 * boutons dans l'ecran en mobile et en desktop, je voudrais qu'ils soient
 * mieux faits") : les deux commandes dessinees en haut a droite de l'ecran
 * (scene/screen.ts, les zones lcd-master et lcd-tempo de scene/renderer.ts),
 * a cote du pattern. Ce store dit celle que la souris survole (un cadre a
 * peine, desktop) et celle qu'un doigt ou la souris tient (cerne plein tant
 * qu'on la glisse), comme les blocs de la vue PAGE (state/rytmPage.ts hover,
 * held). La valeur, elle, vit ou elle a toujours vecu : mix.level (MASTER) et
 * pattern.bpm (TEMPO).
 */

/** Une commande de l'ecran : MASTER (le volume principal, level) ou TEMPO. */
export type ScreenDialId = 'level' | 'tempo';

/** Les zones de saisie des deux commandes, dans l'ordre des jumeaux. */
export const SCREEN_DIAL_HOTSPOTS: Readonly<Record<ScreenDialId, string>> = { level: 'lcd-master', tempo: 'lcd-tempo' };

/** La commande d'une zone de saisie (lcd-master, lcd-tempo), null pour toute autre. */
export const screenDialOf = (hotspot: string | null | undefined): ScreenDialId | null =>
  hotspot === 'lcd-master' ? 'level' : hotspot === 'lcd-tempo' ? 'tempo' : null;

export interface ScreenDialsState {
  /** sous la souris (desktop) */
  readonly hover: ScreenDialId | null;
  /** tenue par un pointeur (le doigt, ou la souris qui glisse) */
  readonly held: ScreenDialId | null;
}

let state: ScreenDialsState = { hover: null, held: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<ScreenDialsState>): void => {
  const next = { ...state, ...patch };
  if (next.hover === state.hover && next.held === state.held) return;
  state = next;
  listeners.forEach((fn) => fn());
};

export const screenDials = {
  get: (): ScreenDialsState => state,
  hover(id: ScreenDialId | null): void {
    set({ hover: id });
  },
  hold(id: ScreenDialId): void {
    set({ held: id });
  },
  release(): void {
    set({ held: null });
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
