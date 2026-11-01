/**
 * Le menu plein ecran ouvert et la piste active, vus de l'ecran (V.6.0, lane B5, 2026-11-01, cahier dt2 2.5 et 5.1).
 *
 * Le menu ouvert : la verite est dtFace.menu (state/dtFace.ts, DtFaceStateDt2, lane B4) des que B4 l'y porte ; avant (et
 * pour les sondes), un etat local qui le remplace. setOpenMenu passe par dtFace.setMenu quand il existe. Chaque lecture
 * compare au menu vu la fois d'avant : un menu qui s'ouvre recoit onOpen, celui qui se ferme onClose (B4 peut poser
 * dtFace.menu sans passer par ici).
 *
 * La piste active : celle que porte le motif (pattern.instrument, BD..CY ; T9..T16 quand B4 l'elargit), lue en TrackKey.
 * Rien ici ne vit sans le drapeau DT2_FACE : sans lui, aucun menu n'est jamais ouvert.
 */

import { pattern } from '../../../audio/pattern';
import { normTrackKey, type TrackKey } from '../../../audio/tracks';
import { dtFace, type DtFaceStateDt2 } from '../../../state/dtFace';
import { DT2_FACE } from '../../../theme';
import { screenMenu, type ScreenMenu, type ScreenMenuId, type ScreenMenuInput } from './registry';

let local: ScreenMenuId | null = null;
let seen: ScreenMenuId | null = null;
const listeners = new Set<() => void>();

/** dtFace porte-t-il deja le champ menu (B4 fusionne) ? */
function b4(): { has: boolean; id: ScreenMenuId | null } {
  const s = dtFace.get() as Partial<DtFaceStateDt2>;
  return 'menu' in s ? { has: true, id: s.menu ?? null } : { has: false, id: null };
}

/** Le menu vu a cette lecture : onOpen et onClose quand il change. */
function sync(id: ScreenMenuId | null): ScreenMenuId | null {
  if (id === seen) return id;
  const was = seen;
  seen = id;
  if (was) screenMenu(was)?.onClose?.();
  if (id) screenMenu(id)?.onOpen?.();
  return id;
}

/** Le menu plein ecran ouvert (null : aucun ; toujours null sans ?face=dt2). */
export function openMenuId(): ScreenMenuId | null {
  if (!DT2_FACE) return null;
  const b = b4();
  return sync(b.has ? b.id : local);
}

/** Le menu ouvert et sa fiche du registre, s'il y est inscrit. */
export function openMenu(): ScreenMenu | null {
  const id = openMenuId();
  return id ? (screenMenu(id) ?? null) : null;
}

/** Ouvre un menu (null : ferme) : par dtFace.setMenu (B4) s'il existe, sinon l'etat local. */
export function setOpenMenu(id: ScreenMenuId | null): void {
  if (!DT2_FACE) return;
  const d = dtFace as unknown as { setMenu?: (m: ScreenMenuId | null) => void };
  if (typeof d.setMenu === 'function') d.setMenu(id);
  else local = id;
  openMenuId();
  listeners.forEach((fn) => fn());
}

/** Un menu ouvert de nouveau (sa touche pressee encore) : ses fiches repartent comme a l'ouverture. */
export function reopenMenu(id: ScreenMenuId): void {
  if (openMenuId() === id) screenMenu(id)?.onOpen?.();
  else setOpenMenu(id);
  listeners.forEach((fn) => fn());
}

/**
 * Une saisie de navigation pour le menu ouvert (le contrat de registry.ts, B4 -> B5) : true si le menu l'a prise. NO non
 * pris (au relacher) ferme le menu ici aussi (B4 le fait de son cote ; avant B4, les sondes passent par ici).
 */
export function menuInput(input: ScreenMenuInput): boolean {
  const m = openMenu();
  if (!m) return false;
  const took = m.onInput ? m.onInput(input) : false;
  if (!took && input.kind === 'no' && input.phase === 'up') setOpenMenu(null);
  listeners.forEach((fn) => fn());
  return took;
}

/** Ecoute le menu ouvert (l'etat local et dtFace). */
export function subscribeMenu(fn: () => void): () => void {
  listeners.add(fn);
  const off = dtFace.subscribe(fn);
  return () => {
    listeners.delete(fn);
    off();
  };
}

/** Un menu a change ce qu'il montre (son curseur, une sous-page) : l'ecran se redessine. */
export function menuChanged(): void {
  listeners.forEach((fn) => fn());
}

/** La piste active (BD..CY, T9..T16) ; null : aucune. */
export function screenTrack(): TrackKey | null {
  return normTrackKey(pattern.get().instrument as string | null);
}
