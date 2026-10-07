/**
 * MUTE et SOLO (2026-10-01) : les voix coupees et les voix en solo du
 * sequenceur. Seul le sequenceur est concerne. Pas de persistance : une
 * visite commence avec toutes les voix.
 *
 * Les modes (2026-10-07, Mika : "quand j'appuie sur MUTE je clique sur une
 * voix, ca la mute, mais une autre voix juste apres ne doit pas se muter ;
 * MUTE de nouveau demute la voix ; DEUX fois MUTE et je peux muter
 * plusieurs voix ; l'ecran affiche la difference et le tip du double MUTE ;
 * pareil pour SOLO") :
 * - un appui : le mode s'arme pour UNE voix ; la voix touchee se coupe (ou
 *   passe en solo) et le mode retombe (les pads jouent de nouveau) ; la
 *   voix reste coupee, le temoin allume ;
 * - deux appuis rapides : le mode a plusieurs voix (multi) ; chaque voix
 *   touchee se coupe ou revient (en solo ou en sort), autant qu'on veut ;
 * - un appui de plus (mode arme, multi, ou une voix encore coupee) : tout
 *   revient.
 * actions.ts (muteToggle, soloToggle) decide ; ce store garde l'etat. Le
 * solo passe avant les mutes.
 */

import type { Inst } from '../theme';

export interface VoicesState {
  muted: readonly Inst[];
  /** les voix en solo (plusieurs en SOLO multi) ; vide : pas de solo */
  solo: readonly Inst[];
  /** mode MUTE arme : le pad de voix touche se coupe au lieu de jouer */
  muteMode: boolean;
  /** MUTE multi (deux appuis) : il reste arme apres chaque voix */
  muteMulti: boolean;
  /** mode SOLO arme : le pad de voix touche passe en solo au lieu de jouer */
  soloMode: boolean;
  /** SOLO multi (deux appuis) */
  soloMulti: boolean;
}

export type VoiceModeKind = 'mute' | 'solo';

let state: VoicesState = { muted: [], solo: [], muteMode: false, muteMulti: false, soloMode: false, soloMulti: false };
const listeners = new Set<() => void>();

const commit = (next: VoicesState): void => {
  state = next;
  listeners.forEach((fn) => fn());
};

const toggled = (list: readonly Inst[], inst: Inst): Inst[] => (list.includes(inst) ? list.filter((k) => k !== inst) : [...list, inst]);

export const voices = {
  get: (): VoicesState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  isMuted: (inst: Inst): boolean => state.muted.includes(inst),
  isSolo: (inst: Inst): boolean => state.solo.includes(inst),
  /** Le sequenceur joue-t-il cette voix ? Le solo passe avant les mutes. */
  plays: (inst: Inst): boolean => (state.solo.length > 0 ? state.solo.includes(inst) : !state.muted.includes(inst)),
  /** Le temoin d'un mode : arme, ou une voix encore coupee (en solo). */
  lit: (k: VoiceModeKind): boolean => (k === 'mute' ? state.muteMode || state.muted.length > 0 : state.soloMode || state.solo.length > 0),
  toggleMute(inst: Inst): void {
    commit({ ...state, muted: toggled(state.muted, inst) });
  },
  toggleSolo(inst: Inst): void {
    commit({ ...state, solo: toggled(state.solo, inst) });
  },
  /** Arme un mode (multi : plusieurs voix) ; l'autre mode s'eteint, ses voix reviennent. */
  arm(k: VoiceModeKind, multi: boolean): void {
    commit(k === 'mute' ? { ...state, muteMode: true, muteMulti: multi, soloMode: false, soloMulti: false, solo: [] } : { ...state, soloMode: true, soloMulti: multi, muteMode: false, muteMulti: false, muted: [] });
  },
  /** Le mode a une voix a servi : il retombe, la voix reste coupee (en solo). */
  disarm(k: VoiceModeKind): void {
    commit(k === 'mute' ? { ...state, muteMode: false, muteMulti: false } : { ...state, soloMode: false, soloMulti: false });
  },
  /** Le mode s'eteint et toutes ses voix reviennent. */
  release(k: VoiceModeKind): void {
    commit(k === 'mute' ? { ...state, muteMode: false, muteMulti: false, muted: [] } : { ...state, soloMode: false, soloMulti: false, solo: [] });
  },
  clearMutes(): void {
    if (state.muted.length) commit({ ...state, muted: [] });
  },
  clearSolo(): void {
    if (state.solo.length) commit({ ...state, solo: [] });
  },
};
