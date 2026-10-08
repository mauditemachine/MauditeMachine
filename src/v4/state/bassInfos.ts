/**
 * INFOS du MM-BASS (2026-10-08, Mika : "dans le OPEN, un bouton INFOS :
 * quand je clique dessus et que je survole chaque parametre du BASS, j'ai
 * un descriptif qui vient dessus, du texte et meme une image, pour
 * expliquer a quoi ca sert et comment ca fonctionne"). Le mode s'allume
 * sous le capot (la touche INFOS de la plaque, ou I) et reste allume apres
 * CLOSE, jusqu'a ce qu'on l'eteigne (la touche, la pastille INFOS ON, I,
 * Echap). Allume : survoler une commande du MM-BASS (souris) montre sa
 * carte ; au doigt, la toucher la montre sans la changer (un glisser la
 * tourne toujours, la carte suit). Le store garde l'etat ; la carte
 * (bass/InfosCard.tsx) et le contenu (bass/infos.ts) le lisent.
 */

export interface BassInfosState {
  on: boolean;
  /** l'id de la commande montree (hotspot : bass-knob-cutoff, bass-key-run, bass-tw-length...), null : aucune */
  id: string | null;
  /** montree par un toucher (elle reste jusqu'au prochain), pas par un survol */
  pinned: boolean;
}

let state: BassInfosState = { on: false, id: null, pinned: false };
const listeners = new Set<() => void>();

const commit = (next: BassInfosState): void => {
  if (next.on === state.on && next.id === state.id && next.pinned === state.pinned) return;
  state = next;
  listeners.forEach((fn) => fn());
};

export const bassInfos = {
  get: (): BassInfosState => state,
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
