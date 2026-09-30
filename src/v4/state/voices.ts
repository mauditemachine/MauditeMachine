/**
 * MUTE et SOLO (2026-10-01) : les voix coupees et la voix en solo du
 * sequenceur. MUTE coupe la voix selectionnee (le dernier pad frappe),
 * SOLO ne laisse jouer qu'elle (un seul solo a la fois). Seul le
 * sequenceur est concerne : un pad frappe sonne toujours. Pas de
 * persistance : une visite commence avec toutes les voix.
 */

import type { Inst } from '../theme';

export interface VoicesState {
  muted: readonly Inst[];
  solo: Inst | null;
}

let state: VoicesState = { muted: [], solo: null };
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
  clearSolo(): void {
    if (state.solo) commit({ ...state, solo: null });
  },
};
