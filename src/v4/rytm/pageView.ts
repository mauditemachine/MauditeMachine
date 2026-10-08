/**
 * Les huit blocs d'une page du MM-RYTM tels que l'ecran les dessine
 * (2026-10-08, etape 1, Mika : "l'ecran divise en 8 blocs ; je veux le meme
 * ecran mais plus utilise") : le nom, la valeur lisible (celle du telephone,
 * actions.ts dialValueText), la course (0 a 1) pour le dessin, les crans,
 * l'etat du bloc :
 * - live : le reglage existe, sa valeur ;
 * - soon : il viendra (son nom a peine, --) ;
 * - off : un reglage de voix sans voix choisie, SOUND sans famille (CY), ou
 *   rien a lire (--) ;
 * - empty : rien de dessine.
 * echo : le bloc qu'on vient de tourner, cerne POT_UI.readoutMs.
 */

import { anyDialValue, dialRange, dialSteps, dialValueText, stepVelocityOf, type DialId } from '../actions';
import { VEL_MAX } from '../audio/pattern';
import type { RytmPageState } from '../state/rytmPage';
import type { Inst } from '../theme';
import { pageSlots, type SlotDraw } from './pages';

export type BlockState = 'live' | 'soon' | 'off' | 'empty';

export interface Block {
  k: number;
  label: string;
  text: string;
  state: BlockState;
  /** toute la machine (etiquette ALL) */
  all: boolean;
  /** effet global que le kick ne recoit pas, BD choisi (etiquette NO BD) */
  noBd: boolean;
  /** la valeur du reglage (son domaine : -1 a 1 pour TONE et STRETCH) */
  value: number;
  /** sa place sur la course, 0 a 1 */
  course: number;
  bipolar: boolean;
  /** ses crans (0 : continu) */
  notches: number;
  draw: SlotDraw;
  echo: boolean;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Les blocs de la page courante pour la voix choisie (null : aucune). */
export function pageBlocks(s: RytmPageState, inst: Inst | null, now: number): Block[] {
  const echoK = s.echo && s.echo.page === s.page && now < s.echo.until ? s.echo.k : -1;
  return pageSlots(s.page, inst).map((slot, k) => {
    const b: Block = {
      k,
      label: slot.label,
      text: '--',
      state: 'soon',
      all: slot.scope === 'all',
      noBd: !!slot.noBd && inst === 'BD',
      value: 0,
      course: 0,
      bipolar: false,
      notches: 0,
      draw: slot.draw,
      echo: k === echoK,
    };
    if (!slot.label) {
      b.state = 'empty';
      b.text = '';
      return b;
    }
    const t = slot.target;
    if (t === null) return b;
    // Un reglage de voix sans voix : rien a lire
    if (slot.scope === 'track' && !inst) {
      b.state = 'off';
      return b;
    }
    if (t === 'step:vel') {
      // TRIG : la velocite du dernier pas touche
      if (s.sel < 0) {
        b.state = 'off';
        return b;
      }
      const v = stepVelocityOf(s.sel);
      b.state = 'live';
      b.text = String(v);
      b.value = v;
      b.course = v / VEL_MAX;
      return b;
    }
    const id: DialId = t;
    const text = dialValueText(id);
    if (text === '--') {
      b.state = 'off';
      return b;
    }
    const [lo, hi] = dialRange(id);
    const v = anyDialValue(id);
    b.state = 'live';
    b.text = text;
    b.value = v;
    b.course = hi > lo ? clamp01((v - lo) / (hi - lo)) : 0;
    b.bipolar = lo < 0;
    b.notches = dialSteps(id);
    return b;
  });
}
