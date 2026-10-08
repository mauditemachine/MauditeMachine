/**
 * Les huit blocs d'une page du MM-RYTM tels que l'ecran les dessine
 * (2026-10-08, Mika : "l'ecran divise en 8 blocs ; les valeurs de knobs sont
 * a l'ecran, pas sur les encodeurs, de 0 a 127") : le nom, la valeur en
 * grand (0 a 127, -64 a +63 a zero au centre, le nom du cran pour un
 * reglage a crans : 909, BLUEPRINT, ON), la ligne d'unite dessous (216 MS,
 * -3.2 DB, rytm/values.ts), la course (0 a 1) pour le dessin, les crans,
 * l'etat du bloc :
 * - live : le reglage existe, sa valeur ;
 * - soon : il viendra (son nom a peine, --) ;
 * - off : un reglage de voix sans voix choisie, SOUND sans famille (CY), ou
 *   rien a lire (--) ;
 * - empty : rien de dessine.
 * echo : le bloc qu'on vient de tourner, cerne POT_UI.readoutMs.
 * Le Dock du telephone (ui/KnobPanel.tsx) lit les memes blocs.
 */

import { anyDialValue, dialRange, dialSteps, dialUnit, dialValueText, kitIdOf, stepVelocityOf, type DialId } from '../actions';
import { familyOf, isFamily, kitSoundIndex, kitSteps } from '../audio/kit';
import { VEL_NAMES, pattern } from '../audio/pattern';
import type { ShotId } from '../audio/shotsdsp';
import type { RytmPageState } from '../state/rytmPage';
import type { EncId, Inst } from '../theme';
import { pageSlots, type PageSlot, type SlotDraw } from './pages';
import { encUnit, kitUnit, v127Text, velTo127 } from './values';

export type BlockState = 'live' | 'soon' | 'off' | 'empty';

export interface Block {
  k: number;
  label: string;
  /** la valeur en grand : 0 a 127, ou le nom du cran */
  text: string;
  /** la ligne d'unite (216 MS, -3.2 DB, STEP 05) */
  unit: string;
  state: BlockState;
  /** toute la machine (etiquette ALL) */
  all: boolean;
  /** effet global que le kick ne recoit pas, BD choisi (etiquette NO BD) */
  noBd: boolean;
  /**
   * l'etiquette au bout de la ligne d'unite : NO BD, ALL (toute la machine),
   * la voix (les effets de la voix sur FX, au-dessus de ceux de ALL) ; ''
   */
  tag: string;
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

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Le bloc d'un emplacement (k : son rang), pour la voix choisie et le pas choisi. */
export function slotBlock(slot: PageSlot, k: number, inst: Inst | null, sel: number, echo = false): Block {
  const b: Block = {
    k,
    label: slot.label,
    text: '--',
    unit: '',
    state: 'soon',
    all: slot.scope === 'all',
    noBd: !!slot.noBd && inst === 'BD',
    tag: '',
    value: 0,
    course: 0,
    bipolar: false,
    notches: 0,
    draw: slot.draw,
    echo,
  };
  if (!slot.label) {
    b.state = 'empty';
    b.text = '';
    return b;
  }
  b.tag = b.noBd ? 'NO BD' : b.all ? 'ALL' : slot.voiceTag && inst ? inst : '';
  const t = slot.target;
  if (t === null) {
    b.unit = 'SOON';
    return b;
  }
  // Un reglage de voix sans voix : rien a lire
  if (slot.scope === 'track' && !inst) {
    b.state = 'off';
    b.unit = 'PICK A VOICE';
    return b;
  }
  if (t === 'step:vel') {
    // TRIG : la velocite du dernier pas touche
    if (sel < 0) {
      // Tenir un pas le choisit sans le changer (une tape le change)
      b.state = 'off';
      b.unit = 'HOLD A STEP';
      return b;
    }
    const v = stepVelocityOf(sel);
    b.state = 'live';
    b.text = v > 0 ? String(velTo127(v)) : 'OFF';
    b.unit = `STEP ${two(sel + 1)}${v > 0 ? ` ${VEL_NAMES[v]}` : ''}`;
    b.value = v;
    b.course = v / 9;
    b.notches = 10;
    return b;
  }
  if (t === 'smpl:sample') {
    // SMPL : OFF (le son de synthese joue), ou l'echantillon de la voix et son rang
    const pk = `p:${k}` as DialId;
    const text = dialValueText(pk);
    b.unit = dialUnit(pk);
    if (text === '--') {
      b.state = 'off';
      return b;
    }
    const [lo, hi] = dialRange(pk);
    const v = anyDialValue(pk);
    b.state = 'live';
    b.text = text;
    b.value = v;
    b.course = hi > lo ? clamp01((v - lo) / (hi - lo)) : 0;
    b.notches = dialSteps(pk);
    return b;
  }
  const id: DialId = t;
  const text = dialValueText(id);
  if (text === '--') {
    b.state = 'off';
    b.unit = inst ? `${inst} HAS ONE SOUND` : 'PICK A VOICE';
    return b;
  }
  const [lo, hi] = dialRange(id);
  const v = anyDialValue(id);
  b.state = 'live';
  b.value = v;
  b.course = hi > lo ? clamp01((v - lo) / (hi - lo)) : 0;
  b.bipolar = lo < 0;
  b.notches = dialSteps(id);
  const r = kitIdOf(id);
  if (id === 'vsound' || (r && isFamily(r))) {
    // Un choix de son : son nom, et d'ou il vient (SYNTH 909 / 808 / MM, ou un echantillon), son rang
    const f = r && isFamily(r) ? r : inst ? familyOf(inst as ShotId) : null;
    const n = f ? kitSteps(f) : 0;
    const i = f ? kitSoundIndex(f) : 0;
    b.text = text;
    b.unit = n > 0 ? `${i < 3 ? 'SYNTH' : 'SAMPLE'} ${i + 1}/${n}` : '';
  } else if (r) {
    // Un TWEAK du kit : GATE a crans (OFF, ON), les autres en 0 a 127
    if (r === 'gate') {
      b.text = text;
      b.unit = 'SD + CP';
    } else {
      b.text = v127Text(b.course);
      b.unit = kitUnit(r);
    }
  } else {
    b.text = v127Text(b.course, b.bipolar);
    b.unit = encUnit(id as Exclude<EncId, 'tempo' | 'vsound'>, v);
  }
  return b;
}

/** Les blocs de la page courante pour la voix choisie (null : aucune). */
export function pageBlocks(s: RytmPageState, inst: Inst | null, now: number): Block[] {
  const echoK = s.echo && s.echo.page === s.page && now < s.echo.until ? s.echo.k : -1;
  return pageSlots(s.page, inst).map((slot, k) => slotBlock(slot, k, inst, s.sel, k === echoK));
}

/** La voix des blocs : celle du pattern (BD par defaut). */
export const blockVoice = (): Inst | null => pattern.get().instrument;
