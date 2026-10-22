/**
 * Le glisser d'une machine a l'autre au telephone (2026-10-03) : un doigt,
 * horizontal (1.4 fois plus que vertical), plus de 56 px, en moins de
 * 700 ms (ui/Hotspots.tsx le juge au relachement).
 *
 * Sa garde sur les commandes (2026-10-21, audit : un glisser parti d'un
 * potard le tournait a la place ; sur le MIXER, MASTER tombait a 0 et tout le
 * site se taisait, sur le MM-ARP osc1, CUTOFF ou DELAY partaient a 0) : tant
 * qu'un doigt pose sur un potard, un pas ou un bloc va de cote dans le temps
 * d'un glisser, la commande ne bouge pas, il est peut-etre ce glisser ; lache
 * ainsi (assez loin), la machine change. Sinon (le temps passe, le doigt
 * reparti a la verticale, un deuxieme doigt), la commande reprend le geste
 * depuis la valeur du moment : rien ne saute. La souris et la mise en page
 * desktop (une tablette, le telephone en paysage) n'ont pas ce glisser : les
 * commandes y prennent l'axe dominant tout de suite, comme avant.
 */

import { VOYAGER } from '../state/focus';
import { MOBILE_QUERY } from '../theme';

export const SWIPE = { px: 56, ratio: 1.4, ms: 700 } as const;

/** Le glisser d'une machine a l'autre existe-t-il pour ce pointeur (un doigt ou un stylet, la mise en page du telephone) ? */
export function swipeable(touch: boolean): boolean {
  return touch && VOYAGER && typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
}

/**
 * L'instant d'un evenement (e.timeStamp), celui du geste : la duree d'un glisser se mesure d'un evenement a l'autre,
 * jamais a l'heure ou on les traite (une image longue au telephone, un shader compile : un glisser de 160 ms traite
 * 900 ms plus tard n'en serait plus un). Les deux bouts se lisent ainsi, sur la meme horloge.
 */
export const eventTime = (e: { timeStamp: number }): number => (e.timeStamp > 0 ? e.timeStamp : performance.now());

/** Un doigt deplace de dx, dy, ms apres son appui : est-il encore, peut-etre, ce glisser ? */
export function mayBeSwipe(dx: number, dy: number, ms: number): boolean {
  return Math.abs(dx) > SWIPE.ratio * Math.abs(dy) && ms < SWIPE.ms;
}

/** Lache a dx, dy de son appui, ms apres lui : est-ce le glisser ? */
export function isSwipe(dx: number, dy: number, ms: number): boolean {
  return Math.abs(dx) > SWIPE.px && mayBeSwipe(dx, dy, ms);
}

/** Ce qu'une commande du MM-DECKS ou du MM-BASS rend au lacher d'un doigt reste de cote : son appui (px du canvas, eventTime). */
export interface SwipeHandBack {
  x0: number;
  y0: number;
  t0: number;
}
