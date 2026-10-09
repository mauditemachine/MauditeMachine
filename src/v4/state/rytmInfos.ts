/**
 * INFOS du MM-RYTM (2026-10-08, l'etape R4, Mika : "excellent pour le bouton
 * INFO ! je veux un petit bouton i dans l'ecran a activer et de ce fait on
 * peut voir les infos au survol.. et je veux la meme chose pour RYTM aussi
 * !") : le meme contrat que ceux du MM-BASS (state/bassInfos.ts) et du MM-ARP
 * (state/voyInfos.ts), recopie plutot que generalise (comme le MM-ARP : le
 * MM-BASS retouche le sien en parallele). Le mode s'allume par le i dessine
 * dans le coin de l'ecran (zone lcd-i), la touche I, le MIDI (rytm:infos) ou
 * la touche INFOS du Dock, et reste allume jusqu'a ce qu'on l'eteigne (le i
 * encore, la pastille, I, Echap). Allume : survoler une commande du MM-RYTM
 * (souris) montre sa carte ; au doigt, la toucher la montre sans la jouer
 * (un glisser tourne toujours un potard, la carte suit). La carte :
 * rytm/InfosCard.tsx ; le contenu : rytm/infos.ts et rytm/diagrams.ts ; les
 * zones qui ont une carte : rytm/infoIds.ts (rytmInfoHit).
 */

import { isRytmInfoHotspot } from '../rytm/infoIds';

export interface RytmInfosState {
  on: boolean;
  /** l'id de la zone montree (penc-3, pad-SD, step-5, lcd-open, rk-tune...), null : aucune */
  id: string | null;
  /** montree par un toucher (elle reste jusqu'au prochain), pas par un survol */
  pinned: boolean;
  /** touchee dans le Dock du telephone (pas sur la face) : la carte se pose en haut, loin du Dock */
  dock: boolean;
}

let state: RytmInfosState = { on: false, id: null, pinned: false, dock: false };
const listeners = new Set<() => void>();

const commit = (next: RytmInfosState): void => {
  if (next.on === state.on && next.id === state.id && next.pinned === state.pinned && next.dock === state.dock) return;
  state = next;
  listeners.forEach((fn) => fn());
};

export const rytmInfos = {
  get: (): RytmInfosState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  isOn: (): boolean => state.on,
  /** Allume ou eteint ; renvoie le nouvel etat. */
  toggle(): boolean {
    commit({ on: !state.on, id: null, pinned: false, dock: false });
    return state.on;
  },
  set(on: boolean): void {
    commit(on ? { ...state, on } : { on: false, id: null, pinned: false, dock: false });
  },
  /** Le survol (souris) : la commande du MM-RYTM sous le pointeur (une autre, ou rien : null) ; un toucher epingle passe avant. */
  hover(id: string | null): void {
    if (!state.on) return;
    const rid = isRytmInfoHotspot(id) ? id : null;
    if (state.pinned && rid === null) return;
    commit({ ...state, id: rid, pinned: false, dock: false });
  },
  /** Un toucher (doigt) : la carte de cette commande, epinglee ; dock : touchee dans le Dock. */
  show(id: string, dock = false): void {
    if (!state.on || !isRytmInfoHotspot(id)) return;
    commit({ ...state, id, pinned: true, dock });
  },
  hide(): void {
    commit({ ...state, id: null, pinned: false, dock: false });
  },
  /**
   * Une commande du Dock touchee (le telephone) : INFOS allume, sa carte (celle
   * de sa jumelle sur la face : step-5, penc-2, pad-SD, run...) et true, la
   * commande n'agit pas ; eteint, false (elle agit).
   */
  dock(id: string): boolean {
    if (!state.on) return false;
    if (isRytmInfoHotspot(id)) commit({ ...state, id, pinned: true, dock: true });
    return true;
  },
};
