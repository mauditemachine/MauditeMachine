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
 *
 * Les verrous (2026-10-08, l'etape R2, Mika : "on voit a l'ecran que quand le
 * sequenceur passe sur ce step alors le changement est fait") :
 * - en LOCK (un pas tenu ou fixe, state/rytmLock.ts), lock dit ce que le bloc
 *   est pour ce pas : locked (son verrou, dessine en negatif), base (la
 *   valeur de la voix, en retrait : il se verrouille si on le tourne),
 *   global (toute la machine, jamais verrouille : GLOBAL), nolock (pas encore
 *   verrouillable : NO LOCK) ;
 * - en lecture hors LOCK, flash : le pas qui joue a un verrou pour ce bloc,
 *   le bloc montre sa valeur verrouillee en negatif le temps du pas.
 */

import { anyDialValue, dialRange, dialSteps, dialUnit, dialValueText, kitIdOf, pageLockView, stepVelocityOf, type DialId } from '../actions';
import type { StepLock } from '../audio/locks';
import { familyOf, isFamily, kitSoundIndex, kitSteps } from '../audio/kit';
import { pattern } from '../audio/pattern';
import type { ShotId } from '../audio/shotsdsp';
import type { RytmPageState } from '../state/rytmPage';
import type { EncId, Inst } from '../theme';
import { pageSlots, type PageSlot, type SlotDraw } from './pages';
import { encText, encUnit, kitUnit, v127Text, velTo127, velWord } from './values';

export type BlockState = 'live' | 'soon' | 'off' | 'empty';
/** Le bloc pour le pas en LOCK (2026-10-08) : none hors LOCK. */
export type BlockLock = 'none' | 'locked' | 'base' | 'global' | 'nolock';

/** Les verrous a montrer : le pas en LOCK, ou le pas qui joue et ses verrous (flash). */
export type BlockMode = { kind: 'lock'; step: number } | { kind: 'flash'; step: number; lock: Readonly<StepLock> | null };

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
  /** en LOCK : verrouille, la valeur de la voix, global, pas verrouillable */
  lock: BlockLock;
  /** en lecture : la valeur verrouillee du pas qui joue */
  flash: boolean;
}

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Le bloc d'un emplacement (k : son rang), pour la voix choisie et le pas choisi. */
export function slotBlock(slot: PageSlot, k: number, inst: Inst | null, sel: number, echo = false, mode: BlockMode | null = null): Block {
  const b = baseBlock(slot, k, inst, sel, echo);
  if (!mode || b.state === 'empty' || b.state === 'soon') return b;
  // SOUND d'une voix a un seul son (CY) : sans choix de son a elle, mais un son d'une autre famille se verrouille
  if (b.state === 'off' && inst && slot.lock === 'snd' && slot.target === 'vsound' && (mode.kind === 'lock' || !!mode.lock?.snd)) {
    b.state = 'live';
    b.text = inst;
    b.unit = 'OWN';
    b.notches = 0;
  }
  if (mode.kind === 'lock') {
    if (b.state === 'off') return b;
    if (slot.scope === 'all') {
      b.lock = 'global';
      b.tag = 'GLOBAL';
      return b;
    }
    if (!slot.lock) {
      b.lock = 'nolock';
      b.tag = 'NO LOCK';
      return b;
    }
    const lv = pageLockView(k, mode.step);
    if (!lv) {
      b.lock = 'base';
      return b;
    }
    b.lock = 'locked';
    b.text = lv.text;
    b.unit = lv.unit;
    b.course = lv.course;
    b.value = lv.value;
    // SOUND verrouille : la liste de toutes les familles (trop de crans pour des points : une barre)
    if (slot.lock === 'snd' && slot.target === 'vsound') b.notches = 0;
    return b;
  }
  // La lecture : seulement les vrais verrous (VEL est le pas lui-meme, il ne clignote pas)
  if (!slot.lock || slot.lock === 'vel' || slot.scope !== 'track' || b.state !== 'live') return b;
  const lv = pageLockView(k, mode.step, mode.lock);
  if (!lv) return b;
  b.flash = true;
  b.text = lv.text;
  b.unit = lv.unit;
  b.course = lv.course;
  b.value = lv.value;
  if (slot.lock === 'snd' && slot.target === 'vsound') b.notches = 0;
  return b;
}

/** Le bloc d'un emplacement, valeurs de la voix (hors verrous). */
function baseBlock(slot: PageSlot, k: number, inst: Inst | null, sel: number, echo: boolean): Block {
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
    lock: 'none',
    flash: false,
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
    b.unit = `STEP ${two(sel + 1)}${v > 0 ? ` ${velWord(v)}` : ''}`;
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
    const e = id as Exclude<EncId, 'tempo' | 'vsound'>;
    b.text = encText(e, v, b.course, b.bipolar);
    b.unit = encUnit(e, v);
  }
  return b;
}

/** Les blocs de la page courante pour la voix choisie (null : aucune). */
export function pageBlocks(s: RytmPageState, inst: Inst | null, now: number, mode: BlockMode | null = null): Block[] {
  const echoK = s.echo && s.echo.page === s.page && now < s.echo.until ? s.echo.k : -1;
  return pageSlots(s.page, inst).map((slot, k) => slotBlock(slot, k, inst, s.sel, k === echoK, mode));
}

/** La voix des blocs : celle du pattern (BD par defaut). */
export const blockVoice = (): Inst | null => pattern.get().instrument;
