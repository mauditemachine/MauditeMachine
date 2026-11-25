/**
 * L'arrivee sur le site (2026-11-11, Mika : "Quand on arrive sur le site je veux mon logo qui arrive en 3d MAUDITE MACHINE
 * puis se transforme en 2d, ca doit venir en animation de gros a centre, on continue a scroll et on arrive dans le menu et
 * ensuite quand on continue a scroller ya RYTM qui arrive de super zoome a directement la fenetre, que ce soit en mobile
 * ou en desktop") : trois tableaux, menes par le defilement (la molette, le doigt, les fleches) :
 *
 *   logo     le logo en relief arrive enorme, se pose au centre et devient plat (seul, sans geste) ;
 *   menu     le logo file dans l'en-tete, le menu se deploie ;
 *   machine  le menu s'efface, le MM-RYTM arrive de tres pres jusqu'a son cadrage ;
 *   done     la machine est la, le site se joue comme avant.
 *
 * Ce store ne tient que le tableau (les en-tetes ouvrent et ferment le menu avec lui, ui/Header.tsx et
 * ui/MobileHeader.tsx) ; l'animation est dans arrival/Arrival.tsx, la camera dans scene/renderer.ts (arrivalCamera).
 * off : pas d'arrivee (une adresse profonde, une machine demandee, la reduction des animations, le plugin).
 */

import { sectionFromPath } from './sectionRoute';
import { PLUGIN, PRESSKIT_ROUTE } from '../theme';

export type ArrivalPhase = 'off' | 'logo' | 'menu' | 'machine' | 'done';

/**
 * L'arrivee se joue-t-elle ? Sur l'accueil seul, sans section ni parametre de machine ou de debug (les memes que le menu
 * ouvert a l'arrivee, ui/Header.tsx initialMenuOpen), jamais sous la reduction des animations ni dans le plugin.
 * ?arrival=1 la force (les sondes, avec ?debug=1), ?arrival=0 l'ecarte.
 */
function wanted(): boolean {
  if (typeof window === 'undefined' || PLUGIN) return false;
  try {
    const q = new URLSearchParams(window.location.search);
    const force = q.get('arrival');
    if (force === '0') return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (force === '1') return true;
    if (sectionFromPath(window.location.pathname) !== null) return false;
    if (PRESSKIT_ROUTE.re.test(window.location.pathname)) return false;
    if (window.location.pathname !== '/' && window.location.pathname !== '') return false;
    for (const k of ['m', 'face', 'rytmv', 'b', 'beat', 'open', 's', 'debug', 'portrait', 'plugin']) if (q.has(k)) return false;
    return true;
  } catch {
    return false;
  }
}

let phase: ArrivalPhase = wanted() ? 'logo' : 'off';
const listeners = new Set<() => void>();

export const arrival = {
  get: (): ArrivalPhase => phase,
  /** L'arrivee est en cours (le logo, le menu ou la machine) : le site attend. */
  active: (): boolean => phase === 'logo' || phase === 'menu' || phase === 'machine',
  /** Elle se joue (ou s'est jouee) a cette visite. */
  played: (): boolean => phase !== 'off',
  set(p: ArrivalPhase): void {
    if (p === phase || phase === 'off' || phase === 'done') return;
    phase = p;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
