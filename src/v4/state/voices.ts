/**
 * MUTE et SOLO (2026-10-01) : les voix coupees et la voix en solo du
 * sequenceur. SOLO ne laisse jouer que la voix selectionnee (un seul solo
 * a la fois). Seul le sequenceur est concerne. Pas de persistance : une
 * visite commence avec toutes les voix.
 *
 * Mode MUTE (2026-10-03, Mika) : MUTE s'allume et reste allume ; chaque
 * pad de voix touche se coupe ou revient (plusieurs a la fois) ; MUTE
 * touche de nouveau : le mode s'eteint et toutes les voix reviennent.
 */

import type { Inst } from '../theme';

export interface VoicesState {
  muted: readonly Inst[];
  solo: Inst | null;
  /** mode MUTE : les pads de voix coupent au lieu de jouer */
  muteMode: boolean;
}

let state: VoicesState = { muted: [], solo: null, muteMode: false };
const listeners = new Set<() => void>();

const commit = (next: VoicesState): void => {
  state = next;
  listeners.forEach((fn) => fn());
};

export const voices = {
  get: (): VoicesState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  isMuted: (inst: Inst): boolean => state.muted.includes(inst),
  /** Le sequenceur joue-t-il cette voix ? Le solo passe avant les mutes. */
  plays: (inst: Inst): boolean => (state.solo ? inst === state.solo : !state.muted.includes(inst)),
  toggleMute(inst: Inst): void {
    const muted = state.muted.includes(inst) ? state.muted.filter((k) => k !== inst) : [...state.muted, inst];
    commit({ ...state, muted });
  },
  toggleSolo(inst: Inst): void {
    commit({ ...state, solo: state.solo === inst ? null : inst });
  },
  clearMutes(): void {
    if (state.muted.length) commit({ ...state, muted: [] });
  },
  /** Mode MUTE : il s'allume ; eteint, toutes les voix reviennent. */
  setMuteMode(on: boolean): void {
    if (on === state.muteMode && (on || state.muted.length === 0)) return;
    commit({ ...state, muteMode: on, muted: on ? state.muted : [] });
  },
  clearSolo(): void {
    if (state.solo) commit({ ...state, solo: null });
  },
};
