/**
 * Les actions du MM-RYTM : les let de haut de fichier que plusieurs modules lisent ou ecrivent (P0, 2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0). Un objet, une propriete par let d'avant (meme nom, meme valeur de depart, meme
 * type) : st.<nom> la ou actions.ts disait <nom>. Fige apres P0 : un ajout = un message a l'integrateur.
 */

import { capture } from '../state/presets';
import { type RytmPageId } from '../rytm/pages';
import type { LiveKnob } from './internal/live';

export const st = {
  /** Le message de TRK a eteindre avec elle ('' : aucun) : l'aide, ou TRK SD tant qu'elle reste tenue. */
  trkLcd: '',
  /** Le dernier pas choisi par TRK et son heure : la deuxieme tape d'une double tape. */
  trkLast: null as { i: number; t: number } | null,
  /** La grille PTN etait-elle ouverte sous la vue BANK (la fermer y revient ; sinon tout se ferme). */
  bankOverGrid: false,
  /** Le pattern du CONTROL ALL en cours (la revue de D3a, R3 et R7) : un autre pattern le termine, jamais de reecriture croisee. */
  ctlAllSlot: -1,
  /** Le message de FUNC tant qu'elle est engagee ('' : aucun). */
  funcLcd: '',
  /**
   * Une touche de page tapee reste "tenue" pour YES et NO pendant DT_GESTURE.pageArmMs (une souris ne tient pas deux touches) :
   * TRIG puis YES = TRIG + YES (RANDOM), SRC puis YES = la page SRC au hasard, une page puis NO = la page rechargee du point
   * de sauvegarde. PLAY n'y est jamais pris.
   */
  pageArm: null as { page: RytmPageId; until: number } | null,
  /** L'aide "le P-LOCK demande REC" dite une fois (jusqu'au prochain REC). */
  recHinted: false,
  /** La derniere tape de ● a la souris qui a allume REC (une deuxieme en PAD_DOUBLE_TAP_MS : LIVE REC). */
  recTapAt: -Infinity,
  liveKnob: null as LiveKnob | null,
  /** Le potard de la face que knobDial fait tourner en ce moment (-1 : aucun). */
  liveFace: -1,
  /** Le point de sauvegarde (FUNC + YES) : l'etat du MM-RYTM tel que l'UNDO le capture, et son pattern. */
  savePoint: null as { data: ReturnType<typeof capture>; slot: number } | null,
};
