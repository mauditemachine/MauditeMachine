/**
 * Les blocs d'un ecran du MM-RYTM tels que l'ecran les dessine (2026-10-08,
 * Mika : "l'ecran divise en 8 blocs ; les valeurs de knobs sont a l'ecran,
 * pas sur les encodeurs, de 0 a 127") : le nom, la valeur en grand (0 a 127,
 * -64 a +63 a zero au centre, le nom du cran pour un reglage a crans : 909,
 * BLUEPRINT, ON), la ligne d'unite dessous (216 MS, -3.2 DB, rytm/values.ts),
 * la course (0 a 1) pour le dessin, les crans, l'etat du bloc :
 * - live : le reglage existe, sa valeur ;
 * - soon : il viendra (son nom a peine, --) ;
 * - off : un reglage de voix sans voix choisie, ou rien a lire (--) ;
 * - empty : rien de dessine.
 * echo : le bloc qu'on vient de tourner (ou qu'on tient), cerne ; hover : le
 * bloc sous la souris (2026-10-09, l'ecran est l'editeur au desktop aussi).
 * Le Dock du telephone (ui/KnobPanel.tsx) lit les memes blocs.
 *
 * Les verrous (2026-10-08, l'etape R2, Mika : "on voit a l'ecran que quand le
 * sequenceur passe sur ce step alors le changement est fait") :
 * - en P-LOCK (un pas tenu ou fixe, state/rytmLock.ts), lock dit ce que le
 *   bloc est pour ce pas : locked (son verrou, dessine en negatif, le coin P),
 *   base (la valeur de la voix, en retrait : il se verrouille si on le
 *   tourne), global (toute la machine, jamais verrouille : GLOBAL) ;
 * - en lecture hors P-LOCK, flash : le pas qui joue a un verrou pour ce bloc,
 *   le bloc montre sa valeur verrouillee en negatif le temps du pas.
 *
 * Les deux couches (R3) : un bloc d'une couche qui ne joue pas est en retrait
 * (quiet), sauf ceux qui la rallument (SOUND, MIX) ; ceux qui reglent les deux
 * portent BOTH. L'etape 2 (2026-10-09, rytm/pages.ts) : chaque bloc a sa case
 * (cell : colonne, rangee, largeur, hauteur) ; SOUND dit ce que joue la voix
 * (BLUEPRINT + 909), MIX la part de ses deux couches, VEL la velocite des
 * nouveaux pas hors P-LOCK (celle du pas en P-LOCK ; plus sur aucun ecran
 * depuis le 2026-10-10, VOL l'a absorbe) ; les dessins (graph :
 * l'enveloppe de ENV, la courbe de FLTR) n'ont ni valeur ni zone.
 */

import { anyDialValue, dialRange, dialSteps, dialUnit, dialValueText, kitIdOf, layerIdOf, mixText, mixUnit, mixValueOf, pageLockView, stepPlays, voiceSoundText, voiceSoundUnit, voiceSounds, type DialId } from '../actions';
import { lockOf, type StepLock } from '../audio/locks';
import { familyOf, isFamily, kit, kitSoundIndex, kitSteps, type KitFamily } from '../audio/kit';
import { pattern } from '../audio/pattern';
import type { ShotId } from '../audio/shotsdsp';
import { rytmPage, screenOfState, type RytmPageState } from '../state/rytmPage';
import type { EncId, Inst } from '../theme';
import { pageSlots, slotCells, type PageSlot, type RytmScreenId, type SlotCell, type SlotDraw, type SlotGraph } from './pages';
import { encText, encUnit, kitUnit, v127Text, velTo127, velWord } from './values';

export type BlockState = 'live' | 'soon' | 'off' | 'empty';
/**
 * Le bloc pour le pas en P-LOCK (2026-10-08) : none hors P-LOCK. step
 * (revue du 2026-10-09) : VEL, la velocite du pas lui-meme, pas un verrou (ni
 * negatif ni coin P : les marques suivent le compte des P-LOCKS).
 */
export type BlockLock = 'none' | 'locked' | 'base' | 'global' | 'nolock' | 'step';

/** Les verrous a montrer : le pas en P-LOCK, ou le pas qui joue et ses verrous (flash). */
export type BlockMode = { kind: 'lock'; step: number } | { kind: 'flash'; step: number; lock: Readonly<StepLock> | null };

export interface Block {
  k: number;
  label: string;
  /** la valeur en grand : 0 a 127, ou le nom du cran */
  text: string;
  /** la ligne d'unite (216 MS, -3.2 DB, STEP 05) */
  unit: string;
  /** sa forme courte, quand la ligne ne tient pas (le telephone, 2026-10-09 : NEW STEPS HIGH se coupait) */
  unitShort?: string;
  state: BlockState;
  /** toute la machine (etiquette ALL) */
  all: boolean;
  /** effet global que le kick ne recoit pas, BD choisi (etiquette NO BD) */
  noBd: boolean;
  /** l'etiquette au bout de la ligne d'unite : NO BD, ALL, la voix (VOICE FX), BOTH, MACHINE ; '' */
  tag: string;
  /**
   * l'en-tete de l'ecran la dit deja (revue du 2026-10-09) : MACHINE (l'onglet
   * SYNTH), ALL (GLOBAL), la voix (BD FX) ; le telephone ne la repete pas
   * dans le bloc, la place va a l'unite entiere
   */
  tagHeader: boolean;
  /** la valeur du reglage (son domaine : -1 a 1 pour TONE et STRETCH) */
  value: number;
  /** sa place sur la course, 0 a 1 */
  course: number;
  bipolar: boolean;
  /** ses crans (0 : continu) */
  notches: number;
  draw: SlotDraw;
  echo: boolean;
  /** la souris est dessus (desktop, 2026-10-09) */
  hover: boolean;
  /** en P-LOCK : verrouille, la valeur de la voix, global */
  lock: BlockLock;
  /** en lecture : la valeur verrouillee du pas qui joue */
  flash: boolean;
  /** sa couche ne joue pas (R3) : en retrait */
  quiet: boolean;
  /** sa case dans la grille de 4 x 2 (2026-10-09) */
  cell: SlotCell;
  /** un dessin, pas un reglage (2026-10-09) */
  graph: SlotGraph | null;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const NO_CELL: SlotCell = { c: 0, r: 0, w: 1, h: 1 };

/** Le bloc d'un emplacement (k : son rang), pour la voix choisie. */
export function slotBlock(slot: PageSlot, k: number, inst: Inst | null, echo = false, mode: BlockMode | null = null, cell: SlotCell = NO_CELL, hover = false): Block {
  const b = baseBlock(slot, k, inst, echo, cell, hover);
  if (b.state === 'live' && inst) {
    if (slot.both) b.quiet = layerQuiet('synth', inst, mode) && layerQuiet('sample', inst, mode);
    else if (slot.layer && !slot.level) b.quiet = layerQuiet(slot.layer, inst, mode);
  }
  // Le reglage partage par la famille (CH+OH) ne vaut, en P-LOCK, que pour le pas de cette voix
  if (mode?.kind === 'lock' && b.tag && b.tag === SHARED_TAG[inst ? (familyOf(inst as ShotId) ?? '') : '']) b.tag = '';
  if (!mode || b.state === 'empty' || b.state === 'soon' || b.graph) return b;
  // SOUND d'une voix sans choix de son a elle (CY) : un sample d'une autre famille se verrouille (le sample lock)
  if (b.state === 'off' && inst && slot.target === 'voice:sound' && (mode.kind === 'lock' || !!mode.lock?.snd)) {
    b.state = 'live';
    b.text = inst;
    b.unit = 'P-LOCK: ANY SAMPLE';
  }
  if (mode.kind === 'lock') {
    if (b.state === 'off') return b;
    if (slot.scope === 'all') {
      b.lock = 'global';
      b.tag = 'GLOBAL';
      b.tagHeader = false;
      return b;
    }
    if (!slot.lock) {
      b.lock = 'nolock';
      b.tag = 'NO LOCK';
      b.tagHeader = false;
      return b;
    }
    const lv = pageLockView(k, mode.step);
    // VEL : le pas lui-meme (sa velocite, OFF pour un pas vide : le tourner y pose un coup), en clair avec STEP
    if (slot.lock === 'vel') {
      b.lock = 'step';
      b.tag = 'STEP';
      b.tagHeader = false;
      b.text = lv ? lv.text : 'OFF';
      b.unit = lv ? lv.unit : 'EMPTY STEP';
      b.unitShort = undefined;
      b.course = lv ? lv.course : 0;
      b.value = lv ? lv.value : 0;
      return b;
    }
    if (!lv) {
      b.lock = 'base';
      return b;
    }
    b.lock = 'locked';
    b.text = lv.text;
    b.unit = lv.unit;
    b.course = lv.course;
    b.value = lv.value;
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
  return b;
}

/**
 * Une couche muette (R3) : la couche SYNTH a 0, la couche SAMPLE sur OFF ou
 * a 0 ; le pas montre (P-LOCK, flash) compte avec ses verrous.
 */
function layerQuiet(layer: 'synth' | 'sample', inst: Inst, mode: BlockMode | null): boolean {
  const lk = mode ? (mode.kind === 'lock' ? lockOf(pattern.get().locks, inst, mode.step) : mode.lock) : null;
  const p = stepPlays(inst, lk);
  return layer === 'synth' ? !p.synth : !p.smp;
}

/** L'etiquette des reglages de couche partages par deux voix (les couches sont celles de la famille, audio/kit.ts). */
const SHARED_TAG: Readonly<Record<string, string>> = { hh: 'CH+OH', tom: 'TOM+HT' };

/** Le bloc d'un emplacement, valeurs de la voix (hors verrous). */
function baseBlock(slot: PageSlot, k: number, inst: Inst | null, echo: boolean, cell: SlotCell, hover: boolean): Block {
  const b: Block = {
    k,
    label: slot.label,
    text: '--',
    unit: '',
    state: 'soon',
    all: slot.scope === 'all',
    noBd: !!slot.noBd && inst === 'BD',
    tag: '',
    tagHeader: false,
    value: 0,
    course: 0,
    bipolar: false,
    notches: 0,
    draw: slot.draw,
    echo,
    hover,
    lock: 'none',
    flash: false,
    quiet: false,
    cell,
    graph: slot.graph ?? null,
  };
  if (!slot.label) {
    b.state = 'empty';
    b.text = '';
    return b;
  }
  // Un dessin (l'enveloppe, le filtre) : vivant des qu'une voix est choisie, sans valeur a lui
  if (slot.graph) {
    b.state = inst ? 'live' : 'off';
    b.text = '';
    return b;
  }
  const fam: KitFamily | null = inst ? familyOf(inst as ShotId) : null;
  // BOTH : les deux couches ; CH+OH, TOM+HT : la couche de deux voix ; MACHINE : un potard de la machine de synthese
  const shared = slot.layer && fam ? (SHARED_TAG[fam] ?? '') : '';
  b.tag = b.noBd ? 'NO BD' : b.all ? 'ALL' : slot.voiceTag && inst ? inst : slot.both && fam ? 'BOTH' : shared;
  // ALL des reglages de la machine sur la page d'un FX sous la voix (2026-10-10) : l'onglet allume est la voix, le bloc le dit
  b.tagHeader = !slot.tagAlways && !b.noBd && (b.all || (!!slot.voiceTag && !!inst));
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
    // VEL hors P-LOCK (2026-10-09) : la velocite des nouveaux pas de la voix (et de son pad) ; sans bloc depuis le 2026-10-10
    const v = inst ? rytmPage.tapVel(inst) : 9;
    b.state = 'live';
    b.text = String(velTo127(v));
    b.unit = `NEW STEPS ${velWord(v)}`;
    b.unitShort = `NEW: ${velWord(v)}`;
    b.value = v;
    b.course = v / 9;
    b.notches = 9;
    return b;
  }
  if (t === 'voice:sound' && inst) {
    // SOUND (2026-10-09) : ce que joue la voix, en grand ; CY (sans famille) : son propre son, rien a choisir hors P-LOCK
    const p = stepPlays(inst, null);
    const list = voiceSounds(inst);
    b.state = fam ? 'live' : 'off';
    b.text = voiceSoundText(inst, p);
    b.unit = voiceSoundUnit(inst, p);
    const i = fam ? Math.max(0, kit.voiceIndex(fam)) : 0;
    b.value = i;
    b.course = list.length > 1 ? i / (list.length - 1) : 0;
    b.notches = list.length;
    if (!fam) b.text = inst;
    return b;
  }
  if (t === 'voice:mix' && inst) {
    // MIX (2026-10-09) : la part des deux couches, de SYN a SMP
    const p = stepPlays(inst, null);
    const m = mixValueOf(p);
    b.state = fam ? 'live' : 'off';
    b.text = mixText(p);
    b.unit = mixUnit(p);
    b.value = m;
    b.course = m;
    b.bipolar = true;
    // La voix muette (SOUND sur OFF) : en retrait, sans curseur
    b.quiet = !p.synth && !p.smp;
    return b;
  }
  if (t === 'smpl:sample' || t === 'voice:sound' || t === 'voice:mix') return b;
  const id: DialId = t;
  const text = dialValueText(id);
  if (text === '--') {
    b.state = 'off';
    b.unit = !inst ? 'PICK A VOICE' : layerIdOf(id) && layerIdOf(id) !== 'mach' ? '' : 'ONE SOUND';
    return b;
  }
  // Un reglage de couche (R3) : son nombre et son unite tels que actions.ts les ecrit (909, +5, 216 MS)
  if (layerIdOf(id)) {
    const [lo, hi] = dialRange(id);
    const v = anyDialValue(id);
    b.state = 'live';
    b.text = text;
    b.unit = dialUnit(id);
    b.value = v;
    b.course = hi > lo ? clamp01((v - lo) / (hi - lo)) : 0;
    b.bipolar = lo < 0;
    b.notches = dialSteps(id);
    if (slot.machine && !b.tag) {
      b.tag = 'MACHINE';
      b.tagHeader = true;
    }
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
    const f = r && isFamily(r) ? r : inst ? familyOf(inst as ShotId) : null;
    const n = f ? kitSteps(f) : 0;
    const i = f ? kitSoundIndex(f) : 0;
    b.text = text;
    b.unit = n > 0 ? `${i < 3 ? 'SYNTH' : 'SAMPLE'} ${i + 1}/${n}` : '';
  } else if (r) {
    // Un potard de la machine : GATE a crans (OFF, ON), les autres en 0 a 127
    if (r === 'gate') {
      b.text = text;
      b.unit = 'SD + CP';
    } else {
      b.text = v127Text(b.course);
      b.unit = kitUnit(r);
    }
    if (slot.machine && !b.tag) {
      b.tag = 'MACHINE';
      b.tagHeader = true;
    }
  } else {
    const e = id as Exclude<EncId, 'tempo' | 'vsound'>;
    b.text = encText(e, v, b.course, b.bipolar);
    b.unit = e === 'dtime' ? dialUnit(e) : encUnit(e, v);
  }
  return b;
}

/** L'ecran affiche d'un etat de page, pour cette voix (sur GLOBAL FX, la page du FX ouverte, 2026-10-10). */
export const screenIn = (s: RytmPageState, inst: Inst | null): RytmScreenId => screenOfState(s, inst);

/** Les blocs de l'ecran affiche pour la voix choisie (null : aucune). */
export function pageBlocks(s: RytmPageState, inst: Inst | null, now: number, mode: BlockMode | null = null): Block[] {
  const screen = screenIn(s, inst);
  const echoK = s.echo && s.echo.page === screen && now < s.echo.until ? s.echo.k : -1;
  const slots = pageSlots(screen, inst);
  const cells = slotCells(slots);
  // Un bloc tenu (le doigt, la souris, 2026-10-09) reste cerne tant qu'on le tient
  return slots.map((slot, k) => slotBlock(slot, k, inst, k === echoK || k === s.held, mode, cells[k], k === s.hover));
}

/** La voix des blocs : celle du pattern (BD par defaut). */
export const blockVoice = (): Inst | null => pattern.get().instrument;
