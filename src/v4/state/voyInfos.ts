/**
 * INFOS du MM-ARP (2026-10-08, Mika : "excellent pour le bouton INFO ! je
 * veux un petit bouton i dans l'ecran a activer et de ce fait on peut voir
 * les infos au survol") : le meme contrat que celui du MM-BASS
 * (state/bassInfos.ts, recopie plutot que generalise : le MM-BASS le
 * retouche en parallele). Le mode s'allume par le i dessine dans le coin du
 * grand ecran (zone vinfo), la touche I ou le MIDI, et reste allume jusqu'a
 * ce qu'on l'eteigne (le i encore, la pastille, I, Echap). Allume :
 * survoler une commande du MM-ARP (souris) montre sa carte ; au doigt, la
 * toucher la montre sans la jouer (un glisser tourne toujours un potard, la
 * carte suit). La carte : voyager/InfosCard.tsx ; le contenu :
 * voyager/infos.ts.
 */

export interface VoyInfosState {
  on: boolean;
  /** l'id de la zone montree (vk-cutoff, vpad-3, vbtn-run, vlcd-open...), null : aucune */
  id: string | null;
  /** montree par un toucher (elle reste jusqu'au prochain), pas par un survol */
  pinned: boolean;
}

let state: VoyInfosState = { on: false, id: null, pinned: false };
const listeners = new Set<() => void>();

const commit = (next: VoyInfosState): void => {
  if (next.on === state.on && next.id === state.id && next.pinned === state.pinned) return;
  state = next;
  listeners.forEach((fn) => fn());
};

export const voyInfos = {
  get: (): VoyInfosState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  isOn: (): boolean => state.on,
  /** Allume ou eteint ; renvoie le nouvel etat. */
  toggle(): boolean {
    commit({ on: !state.on, id: null, pinned: false });
    return state.on;
  },
  set(on: boolean): void {
    commit({ on, id: on ? state.id : null, pinned: on ? state.pinned : false });
  },
  /** Le survol (souris) : la commande sous le pointeur, null en sortant ; un toucher epingle passe avant. */
  hover(id: string | null): void {
    if (!state.on) return;
    if (state.pinned && id === null) return;
    commit({ ...state, id, pinned: false });
  },
  /** Un toucher (doigt) : la carte de cette commande, epinglee. */
  show(id: string): void {
    if (!state.on) return;
    commit({ ...state, id, pinned: true });
  },
  hide(): void {
    commit({ ...state, id: null, pinned: false });
  },
};
