/**
 * Les gestes sur le MM-BASS (2026-10-07), au pointeur (souris, doigt), le
 * meme contrat que ceux du MM-DECKS (ui/Hotspots.tsx les appelle) :
 * - un potard : glisser vers le haut ou la droite (150 px la course
 *   entiere ; Maj, dix fois plus fin), la molette, deux tapes : sa valeur
 *   de depart ;
 * - une touche : a l'appui ;
 * - un pas : le taper (au lacher) le choisit, puis le fait passer de vide a
 *   note, a liaison, a vide (bass/actions.ts) ; glisser vers le haut ou le
 *   bas change sa note dans la gamme (14 px par degre a la souris, 18 au
 *   doigt, comme la slice d'un pas du sampler) : un pas vide devient une
 *   note ; en EDIT (2026-10-07), un pas est un pattern : le taper le choisit
 *   (ou le chaine), le tenir 0.5 s sur un vide y copie la ligne ;
 * - un bouton LOCK (2026-10-07) : a l'appui, son pas recoit les potards du
 *   son ; deux tapes sur un potard en LOCK : son verrou s'en va ;
 * - l'ecran : les presets (state/presetMode.ts), a l'appui ; depuis le
 *   2026-10-08 (la revue) son en-tete seulement, ses huit blocs sont des
 *   encodeurs (bass-blk-1 a 8 : glisser, deux tapes, la molette).
 * 2026-10-08 :
 * - tenir un pas 350 ms sans glisser (hors EDIT) : LOCK sur ce pas, comme
 *   une Elektron ; un potard tourne pendant l'appui et le lacher sort, sinon
 *   le LOCK reste (bass/actions.ts) ;
 * - les potards de la plaque sous le capot (bass-tw-<id>) : les memes gestes
 *   que ceux de la face ;
 * - INFOS allume, au doigt : toucher une commande montre sa carte sans rien
 *   changer (un potard qu'on glisse tourne toujours, la carte le suit).
 * La machine Elektron (2026-10-08) : les huit encodeurs (bass-enc-1 a 8),
 * relatifs (le reglage repart de sa valeur a chaque appui) ; un doigt tient
 * un pas, un autre prend un bloc : le pas passe en LOCK tout de suite (sans
 * attendre les 350 ms), comme sur une Elektron ; les touches de page ; la
 * touche "i" de l'ecran (bass-key-i) allume ou eteint INFOS, meme au doigt.
 * Au telephone, plus d'encodeurs (2026-10-09, Mika : "on change dans l'ecran
 * directement") : les blocs de l'ecran sont les commandes. Le bloc tenu est
 * cerne a l'ecran (le rig, holdBlock). Deux doigts : le doigt du pas leve
 * avant celui du bloc, le LOCK attend le lacher du bloc. Les onglets de
 * l'en-tete du telephone (bass-tab-voice a fx) : la touche de page qu'ils
 * portent (h.bass).
 *
 * L'etape 2 (2026-10-09, l'enquete sur "les parameters lock ne fonctionnent
 * pas", Mika : "j'aimerais autant en mobile qu'en desktop pouvoir modifier
 * les choses directement sur l'ecran ; en desktop les encoders ne servent
 * qu'a faire les modifs des FX globaux") :
 * - les encodeurs de la face (desktop) : les FX globaux (bassFxDial), jamais
 *   un verrou ; les blocs de l'ecran : la page, le P-LOCK du pas en P-LOCK
 *   (bassDial), a la souris comme au doigt ;
 * - une tape, c'est un appui lache sans bouger en moins de 320 ms ; deux
 *   tapes : la seconde commence moins de 320 ms apres le lacher de la
 *   premiere ; un appui qui a bouge ou dure n'en est jamais une (deux petits
 *   glisser de suite ne retirent plus un verrou, ne remettent plus une
 *   valeur de depart) ;
 * - un doigt sur un pas : 15 px de jeu avant de glisser (6 a la souris), et
 *   le glisser ne compte qu'une fois la note vraiment changee ; un second
 *   doigt sur un bloc tant que la note n'a pas change : le glisser s'annule,
 *   le pas passe en P-LOCK ; le pas tenu lache, le P-LOCK fixe d'avant
 *   revient (celui qu'une tape avait choisi) ;
 * - INFOS au doigt : les touches LOCK, les touches et onglets de page, la
 *   pastille P-LOCK font leur geste et montrent leur carte ; un pas tenu
 *   reste tenu (sa tape montre sa carte), un bloc d'un autre doigt le
 *   verrouille ;
 * - la molette acceleree comme un encodeur d'Elektron : un cran lent = 1 sur
 *   127, des crans rapides (moins de 40 ms) jusqu'a 8 ; Maj : 1 ;
 * - la pastille P-LOCK 05 de l'en-tete (bass-lcd-plock) : sort du P-LOCK ;
 * - EDIT : le rouleau de l'ecran (bass-roll) : glisser une note la monte ou
 *   la descend (la note sous le pointeur, dans la gamme, son nom a l'ecran),
 *   cliquer un pas vide y pose une note a cette hauteur, cliquer une note la
 *   fait passer a liaison ou a vide.
 * La revue du meme jour :
 * - le rouleau : un vide recoit sa note au lacher (une tape) ou au premier
 *   glisser, plus a l'appui (au doigt, une colonne de 15 px : un doigt a cote
 *   posait une note) ; au doigt, un glisser qui part a moins d'une
 *   demi-colonne d'une note la prend ; la molette agit sur la colonne sous la
 *   souris, un degre de la gamme par cran (l'octave suit) ;
 * - un potard dedie tenu (STYLE, DENSITY...) garde son echo a l'ecran
 *   (holdPot), comme la bulle d'un encodeur.
 * Le generateur (2026-10-09, Mika : "Je trouve Style et Density complexe a
 * utiliser") : NOTES (l'ancien DENSITY) compte les notes, un cran de molette
 * = une note, un glisser de 12 px a la souris (16 au doigt) = une note, depuis
 * le compte au debut de l'appui (un pattern qui change sous le doigt : le
 * compte repart de la nouvelle ligne) ; STYLE garde ses 150 px pour ses onze
 * crans. GEN et MUTATE agissent au lacher (avant 500 ms) ; tenus 500 ms, la
 * prise d'avant et l'annulation tombent a 500 ms, sans attendre le lacher.
 * Les onglets (2026-10-09, le moteur MONARK) : une touche de page pressee
 * sur la page allumee passe a son onglet suivant (bassPagePress) ; une puce
 * de l'en-tete (bass-scr-<ecran>, h.bass = screen:<ecran>) va a son onglet ;
 * un bloc qu'on tient suit l'ecran qui change (comme une page).
 * La face simple (2026-10-09, le soir) : les six touches du pas sont des
 * zones de l'ecran (bass-key-accent..., les gestes d'une touche, a l'appui) ;
 * PRESET ouvre et ferme les presets ; MUTATE n'est plus sur la face (le MIDI
 * bass:key:mutate passe encore par bassKeyAction).
 */

import type { HotspotView } from '../scene/hit';
import type { Stage } from '../scene/renderer';
import { quadToUnit } from '../scene/quad';
import { openToggle, presetKey } from '../actions';
import { bassInfos } from '../state/bassInfos';
import { PORTRAIT } from '../theme';
import { bassAccent, bassClear, bassDegStep, bassDial, bassDialReset, bassEditCycle, bassEditNote, bassEditToggle, bassEditing, bassEmptySay, bassEncParam, bassFxDial, bassFxParam, bassFxReset, bassGenBack, bassGenerate, bassKnobValue, bassLockEnter, bassLockGen, bassLockOff, bassLockRestore, bassLockTap, bassLockTurns, bassMutate, bassNote, bassNoteName, bassNotesTo, bassOct, bassPagePress, bassPatternHold, bassPitchAt, bassPresetKey, bassRun, bassScreenSet, bassSlide, bassStepDeg, bassStepTap } from './actions';
import { bassLine } from './line';
import { bassPage, isBassGlobal, isBassScreen, type BassScreenId } from './pages';
import { bassKnob, bassParams, type BassKnobId } from './params';
import { BASS_PLOCK_ID, BASS_ROLL_ID } from './rig';
import { midiOf } from './seq';
import { BASS_STEPS, bassState } from './state';
import type { BassKeyKind } from './theme';

/** La molette : un cran (1/127 sur un encodeur ou un bloc), les pixels d'un cran (les petits pas d'un pave tactile s'additionnent). */
const NOTCH = 1 / 127;
const WHEEL_PX = 50;
/** La molette d'un potard dedie (STYLE, DENSITY, la plaque) : la loi d'avant les encodeurs (2 %, plus vite aux grands pas ; Maj : 0.2 %). */
const POT_WHEEL = { step: 0.02, fine: 0.002, px: 40, max: 4 } as const;
/**
 * L'acceleration de la molette (2026-10-09, l'enquete : 5 crans = 5 sur 127, inaudible sur un pas) : les unites par cran
 * selon le temps depuis le cran d'avant, comme un encodeur d'Elektron ; un pave tactile (ses petits pas) n'accelere qu'a 2.
 */
const WHEEL_ACCEL: readonly (readonly [number, number])[] = [
  [25, 8],
  [40, 6],
  [60, 4],
  [100, 2],
];
/**
 * Un bloc de l'ecran (bass-blk-1 a 8, la page a l'ecran) ou un encodeur de la face (bass-enc-1 a 8, les FX globaux
 * depuis le 2026-10-09) : son rang, 0 a 7, et lequel ; null sinon.
 */
const slotOf = (h: HotspotView): { k: number; enc: boolean } | null => {
  const m = /^bass-(enc|blk)-(\d)$/.exec(h.id);
  return m ? { k: Number(m[2]) - 1, enc: m[1] === 'enc' } : null;
};

const KNOB_PX = 150;
const FINE = 0.1;
const AXIS_PX = 4;
/** Une tape : un appui lache sans bouger avant ce delai ; deux tapes : la seconde commence avant ce delai apres le lacher de la premiere. */
const TAP_MS = 320;
/** Un pas : les pixels par degre en glissant (souris, doigt), et le jeu avant le glisser (2026-10-09 : 15 px au doigt). */
const DEG_PX = { mouse: 14, touch: 18 } as const;
const STEP_DRAG_PX = { mouse: 6, touch: 15 } as const;
/** EDIT : tenir un pattern vide autant pour y copier la ligne. */
const HOLD_MS = 500;
/** Hors EDIT (2026-10-08) : tenir un pas autant le verrouille (LOCK, facon Elektron). */
const LOCK_HOLD_MS = 350;
/** GEN et MUTATE tenus (2026-10-09) : la prise d'avant, l'annulation, a ce moment-la. */
export const GEN_HOLD_MS = 500;
/** NOTES (2026-10-09) : les pixels d'une note en glissant (souris, doigt). */
const NOTE_PX = { mouse: 12, touch: 16 } as const;

/** Le potard d'une cible : sur la face (bass-knob-<id>) ou sur la plaque (bass-tw-<id>), son id dans h.bass. */
const knobOf = (h: HotspotView): BassKnobId => (h.bass ?? h.id.replace(/^bass-(knob|tw)-/, '')) as BassKnobId;

interface Grip {
  kind: 'knob' | 'key' | 'trig' | 'roll';
  id: string;
  x0: number;
  y0: number;
  moved: boolean;
  knob: BassKnobId | null;
  v0: number;
  a: number;
  axis: 'x' | 'y' | null;
  fine: boolean;
  /** un pas : son rang, son degre au depart, les pixels par degre, le jeu, glisse */
  step: number;
  deg0: number;
  px: number;
  slop: number;
  dragged: boolean;
  /** EDIT : le minuteur de l'appui tenu, et s'il a fini */
  hold: number;
  held: boolean;
  /** un pas tenu qui a mis le LOCK (2026-10-08) ; le P-LOCK fixe d'avant l'appui (2026-10-09 : il revient au lacher) */
  lockHold: boolean;
  prevLock: number;
  /** INFOS au doigt : la carte seulement, l'appui ne fait rien d'autre */
  infoOnly: boolean;
  /** INFOS au doigt sur un pas (2026-10-09) : il reste tenu (un bloc d'un autre doigt le verrouille), sa tape montre sa carte */
  info: boolean;
  /** un potard : le pas en LOCK quand sa valeur de depart a ete prise (-1 : le son global) */
  lock: number;
  /** un bloc ou un encodeur : son rang (-1 : un potard dedie) ; fx : un encodeur de la face (les FX globaux) ; l'ecran */
  enc: number;
  fx: boolean;
  page: BassScreenId;
  /** un bloc (ou un encodeur) cerne a l'ecran tant qu'il est tenu (2026-10-09) */
  ring: boolean;
  /** l'instant de l'appui, et s'il suit de pres une tape sur la meme commande (la seconde d'une double tape) */
  t0: number;
  dbl: boolean;
  /** un potard : l'appui compte pour une double tape (pas au doigt en INFOS : on lit) */
  taps: boolean;
  /** le rouleau d'EDIT : l'echelle des hauteurs au depart (elle ne bouge pas pendant le glisser), l'octave du pas */
  lo: number;
  hi: number;
  oct0: number;
  /**
   * le rouleau, un appui sur une colonne vide (2026-10-09, la revue : au doigt, une colonne de 15 px, un doigt a cote
   * posait une note) : la note s'y pose au lacher (une tape) ou au premier glisser ; au doigt, la colonne voisine a
   * moins d'une demi-colonne qui porte une note (near : son pas, -1 aucun) : un glisser prend cette note
   */
  empty: boolean;
  near: number;
  touch: boolean;
  /** un potard dedie (STYLE, DENSITY..., la plaque) tenu : son echo reste a l'ecran (le rig, holdPot) */
  pot: boolean;
  /** NOTES (2026-10-09) : le compte au debut du glisser, et la ligne d'alors (bassLine.version : un pattern qui change) */
  notes0: number;
  ver: number;
}

export class BassGestures {
  private grips = new Map<number, Grip>();
  /** le lacher de la derniere tape de chaque commande (performance.now) : la prochaine tape tout pres fait une double tape */
  private lastTap = new Map<string, number>();
  private wheelAcc = new Map<string, number>();
  private wheelAt = new Map<string, number>();
  /** la colonne du rouleau d'EDIT sous la souris (-1 : aucune) : la molette y agit (la revue du 2026-10-09) */
  private rollHoverStep = -1;
  /** la molette du rouleau : le nom de la note reste un instant apres le dernier cran */
  private wheelShow = 0;
  /**
   * Deux doigts (2026-10-09) : le pas tenu leve alors qu'un bloc tourne encore ; son LOCK momentane ne sort qu'au
   * lacher du dernier bloc, s'il n'a pas ete repris entre-temps (la revue : le meme pas tenu de nouveau, sa touche
   * LOCK, le MIDI ; gen : bassLockGen au moment du lever) ; prev : le P-LOCK fixe d'avant, qui revient ; null : rien.
   */
  private lockOffAfter: { step: number; gen: number; prev: number } | null = null;

  constructor(private stage: Stage) {}

  holds(pointerId: number): boolean {
    return this.grips.has(pointerId);
  }

  private press(id: string, down: boolean): void {
    this.stage.bass?.pressKey(id, down);
  }

  private grip(h: HotspotView, x: number, y: number, touch: boolean): Grip {
    return { kind: 'key', id: h.id, x0: x, y0: y, moved: false, knob: null, v0: 0, a: 0, axis: null, fine: false, step: -1, deg0: 0, px: touch ? DEG_PX.touch : DEG_PX.mouse, slop: touch ? STEP_DRAG_PX.touch : STEP_DRAG_PX.mouse, dragged: false, hold: 0, held: false, lockHold: false, prevLock: -1, infoOnly: false, info: false, lock: -1, enc: -1, fx: false, page: bassPage.screen(), ring: false, t0: performance.now(), dbl: false, taps: false, lo: 0, hi: 0, oct0: 0, empty: false, near: -1, touch, pot: false, notes0: 0, ver: 0 };
  }

  down(pointerId: number, h: HotspotView, x: number, y: number, touch = false): void {
    const g = this.grip(h, x, y, touch);
    // La touche "i" de l'ecran : INFOS, toujours (au doigt en INFOS aussi : c'est elle qui l'eteint)
    if (h.id === 'bass-key-i') {
      bassInfos.toggle();
      this.grips.set(pointerId, g);
      return;
    }
    const infos = touch && bassInfos.isOn();
    // INFOS au doigt : la carte de la commande ; un bloc peut encore tourner (la carte le suit), un pas reste tenu, les
    // touches LOCK, les touches de page et la pastille P-LOCK font aussi leur geste (2026-10-09, comme le MM-RYTM R4)
    if (infos) {
      bassInfos.show(h.id);
      const acts = h.kind === 'bassknob' || h.kind === 'basstrig' || h.kind === 'basslock' || h.id === BASS_PLOCK_ID || /^bass-(key-p|tab-|scr-)/.test(h.id);
      if (!acts) {
        g.infoOnly = true;
        this.grips.set(pointerId, g);
        return;
      }
    }
    if (h.id === BASS_PLOCK_ID) {
      // La pastille P-LOCK 05 de l'en-tete (2026-10-09) : on sort du P-LOCK
      bassLockOff();
      this.grips.set(pointerId, g);
      return;
    }
    if (h.id === BASS_ROLL_ID) {
      this.rollDown(g, x, y);
      this.grips.set(pointerId, g);
      return;
    }
    if (h.kind === 'basslcd') {
      // L'ecran : une touche des presets
      if (h.lcd) presetKey('bass', h.lcd);
      return;
    }
    if (h.kind === 'bassknob') {
      g.kind = 'knob';
      const slot = slotOf(h);
      g.enc = slot ? slot.k : -1;
      g.fx = !!slot?.enc;
      // Un encodeur de la face : son FX global ; un bloc de l'ecran : le reglage de la page (une case vide : l'ecran le
      // dit, rien ne tourne) ; un potard dedie : le sien
      g.knob = !slot ? knobOf(h) : slot.enc ? bassFxParam(slot.k) : bassEncParam(slot.k);
      if (!g.knob) {
        bassEmptySay(g.enc);
        this.grips.set(pointerId, g);
        return;
      }
      // Un potard dedie (STYLE, DENSITY, la plaque) : son echo reste tant qu'il est tenu (2026-10-09, la revue)
      if (!slot) {
        g.pot = true;
        this.stage.bass?.holdPot(g.knob, true);
      }
      // Deux doigts (2026-10-08) : un pas tenu (pas encore en LOCK, sa note pas changee) et un bloc qu'on prend : LOCK
      // tout de suite (un encodeur de la face, les FX globaux, n'en pose jamais)
      if (!g.fx && !bassEditing()) {
        for (const o of this.grips.values()) {
          if (o.kind !== 'trig' || o.dragged || o.held) continue;
          window.clearTimeout(o.hold);
          o.held = true;
          o.lockHold = true;
          bassLockEnter(o.step);
          break;
        }
      }
      g.v0 = g.fx ? bassParams.of(g.knob) : bassKnobValue(g.knob);
      g.notes0 = bassLine.count();
      g.ver = bassLine.version();
      g.lock = bassState.get().lock;
      // Le bloc tenu se cerne a l'ecran (2026-10-09) : on voit ce que le doigt regle avant que la valeur bouge
      // (un encodeur de la face : sa bulle reste a l'ecran tant qu'il est tenu)
      if (g.enc >= 0) {
        g.ring = true;
        this.stage.bass?.holdBlock(g.enc, true, g.fx);
      }
      // Deux tapes : la valeur de depart (en LOCK : le verrou s'en va) ; pas en INFOS au doigt (on lit)
      g.taps = !infos;
      if (!g.taps) this.lastTap.delete(h.id);
      else g.dbl = g.t0 - (this.lastTap.get(h.id) ?? -Infinity) < TAP_MS;
    } else if (h.kind === 'basstrig') {
      g.kind = 'trig';
      g.step = Number(h.id.slice('bass-trig-'.length)) - 1;
      g.deg0 = bassState.get().steps[g.step]?.deg ?? 0;
      g.prevLock = bassState.get().lock;
      g.info = infos;
      this.press(h.id, true);
      if (bassEditing()) {
        if (!infos) {
          g.hold = window.setTimeout(() => {
            g.held = true;
            bassPatternHold(g.step);
          }, HOLD_MS);
        }
      } else if (!infos) {
        // Tenir le pas sans glisser : LOCK sur lui
        g.hold = window.setTimeout(() => {
          if (g.dragged) return;
          g.held = true;
          g.lockHold = true;
          bassLockEnter(g.step);
        }, LOCK_HOLD_MS);
      }
    } else if (h.kind === 'basslock') {
      g.kind = 'key';
      this.press(h.id, true);
      bassLockTap(Number(h.id.slice('bass-lock-'.length)) - 1);
    } else if (h.bass?.startsWith('screen:')) {
      // Une puce de l'en-tete (bass-scr-<ecran>, 2026-10-09) : son onglet
      g.kind = 'key';
      const s = h.bass.slice('screen:'.length);
      if (isBassScreen(s)) bassScreenSet(s);
    } else {
      g.kind = 'key';
      this.press(h.id, true);
      // La touche dans h.bass (les onglets de l'ecran du telephone, bass-tab-*, 2026-10-09 : ceux des touches de page)
      const kind = (h.bass ?? h.id.slice('bass-key-'.length)) as BassKeyKind;
      // GEN (2026-10-09) : au lacher avant 500 ms ; tenu 500 ms, la prise d'avant, tout de suite
      if (kind === 'gen' && !infos) {
        g.step = 1;
        g.hold = window.setTimeout(() => {
          g.held = true;
          bassGenBack();
        }, GEN_HOLD_MS);
      } else bassKeyAction(kind);
    }
    this.grips.set(pointerId, g);
  }

  move(pointerId: number, x: number, y: number, shift: boolean): void {
    const g = this.grips.get(pointerId);
    if (!g || g.infoOnly) return;
    const dx = x - g.x0;
    const dy = y - g.y0;
    if (Math.hypot(dx, dy) > AXIS_PX) g.moved = true;
    if (g.kind === 'roll') {
      this.rollMove(g, x, y);
      return;
    }
    if (g.kind === 'knob' && g.enc >= 0 && !g.fx && bassPage.screen() !== g.page) {
      // La page (ou l'onglet) a change pendant qu'un bloc tourne (2026-10-08, la revue : [ ], le MIDI, une touche de page
      // d'un autre doigt) : comme sur une Elektron, il regle desormais l'ecran allume, depuis la valeur qu'il y trouve
      g.page = bassPage.screen();
      g.knob = bassEncParam(g.enc);
      if (g.knob) {
        g.v0 = bassKnobValue(g.knob);
        g.a = g.axis === 'y' ? -dy : g.axis === 'x' ? dx : 0;
        g.lock = bassState.get().lock;
      }
    }
    if (g.kind === 'knob' && g.knob) {
      if (!g.axis) {
        if (Math.hypot(dx, dy) < AXIS_PX) return;
        g.axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
      }
      const travel = g.axis === 'y' ? -dy : dx;
      if (g.fx) {
        // Un encodeur de la face : le FX global, le P-LOCK n'y change rien
        if (shift !== g.fine) {
          g.v0 = bassParams.of(g.knob);
          g.a = travel;
          g.fine = shift;
        }
        bassFxDial(g.enc, g.v0 + ((travel - g.a) / KNOB_PX) * (shift ? FINE : 1));
        return;
      }
      // Le LOCK a change pendant que le bloc tourne (2026-10-08 : deux doigts, le pas tenu lache avant le bloc, ou un
      // pas tenu qui entre en LOCK) : le bloc repart de la valeur qu'il regle maintenant, sans faire sauter le son
      // global ni le verrou d'un autre pas
      const lock = bassState.get().lock;
      if (shift !== g.fine || lock !== g.lock) {
        g.v0 = bassKnobValue(g.knob);
        g.a = travel;
        g.fine = shift;
        g.lock = lock;
      }
      if (g.knob === 'density' && g.enc < 0) {
        // NOTES : une note tous les 12 px (16 au doigt), depuis le compte du debut ; une autre ligne posee sous le doigt
        // (un pattern de la chaine) : le compte repart d'elle
        if (bassLine.version() !== g.ver) {
          g.ver = bassLine.version();
          g.notes0 = bassLine.count();
          g.a = travel;
        }
        bassNotesTo(g.notes0 + Math.round((travel - g.a) / (g.touch ? NOTE_PX.touch : NOTE_PX.mouse)));
        return;
      }
      bassDial(g.knob, g.v0 + ((travel - g.a) / KNOB_PX) * (shift ? FINE : 1));
    } else if (g.kind === 'trig') {
      // EDIT : un pattern ne glisse pas ; INFOS au doigt : on lit, la note ne bouge pas
      if (bassEditing() || g.info) return;
      // Deja verrouille par l'appui tenu (ou un second doigt) : le pas ne glisse plus
      if (g.lockHold) return;
      const d = Math.round(-dy / g.px);
      // Le glisser ne compte qu'apres le jeu, et une fois la note vraiment changee (2026-10-09 : un doigt qui tremble
      // de 7 px annulait le LOCK a deux doigts)
      if (!g.dragged && (Math.abs(dy) < g.slop || d === 0)) return;
      g.dragged = true;
      window.clearTimeout(g.hold);
      bassStepDeg(g.step, g.deg0 + d);
    }
  }

  up(pointerId: number, overId: string | null): void {
    const g = this.grips.get(pointerId);
    if (!g) return;
    this.grips.delete(pointerId);
    if (g.infoOnly) return;
    const quick = performance.now() - g.t0 < TAP_MS;
    if (g.kind === 'roll') {
      this.rollUp(g, quick);
      return;
    }
    if (g.kind === 'trig') {
      this.press(g.id, false);
      window.clearTimeout(g.hold);
      // Un pas tenu pour LOCK, un bloc tourne pendant l'appui : le lacher sort (LOCK momentane), le P-LOCK fixe d'avant
      // revient ; un bloc encore tenu d'un autre doigt (2026-10-09) : il continue d'ecrire sur ce pas, la sortie attend
      // son lacher
      if (g.lockHold && bassLockTurns() > 0) {
        if (this.knobHeld()) this.lockOffAfter = { step: g.step, gen: bassLockGen(), prev: g.prevLock };
        else bassLockRestore(g.prevLock);
      }
      // INFOS au doigt : la tape montre la carte (deja montree a l'appui), le pas ne change pas
      if (!g.dragged && !g.held && !g.info && overId === g.id) bassStepTap(g.step);
    } else if (g.kind === 'key') {
      this.press(g.id, false);
      // GEN : une tape (lache avant 500 ms)
      if (g.step === 1) {
        window.clearTimeout(g.hold);
        if (!g.held) bassGenerate();
      }
    } else if (g.kind === 'knob') {
      if (g.ring) this.stage.bass?.holdBlock(g.enc, false, g.fx);
      if (g.pot && g.knob) this.stage.bass?.holdPot(g.knob, false);
      if (g.taps) this.tapUp(g, quick);
      this.flushLockOff();
    }
  }

  /**
   * Un potard lache (2026-10-09) : lache sans bouger et vite, c'est une tape ; la seconde d'une double tape remet la
   * valeur de depart (en LOCK : le verrou s'en va ; un encodeur de la face : la valeur globale). Au telephone, une tape
   * seule sur un bloc dit le geste (la revue : rien ne disait qu'un bloc se glisse).
   */
  private tapUp(g: Grip, quick: boolean): void {
    const id = g.knob;
    if (!id) return;
    if (g.moved || !quick) {
      this.lastTap.delete(g.id);
      return;
    }
    const label = bassKnob(id).label;
    const locking = bassState.get().lock >= 0;
    if (g.dbl) {
      this.lastTap.delete(g.id);
      if (g.fx) {
        bassFxReset(g.enc);
        return;
      }
      const was = bassKnobValue(id);
      bassDialReset(id);
      // Deja a sa valeur de depart : l'ecran le dit quand meme (sinon le conseil de la premiere tape restait affiche)
      if (PORTRAIT && g.enc >= 0 && !locking && bassKnobValue(id) === was) bassState.say(`${label}: DEFAULT`, 1200);
      return;
    }
    this.lastTap.set(g.id, performance.now());
    if (!PORTRAIT || g.enc < 0) return;
    bassState.say(locking && isBassGlobal(id) ? `${label} IS GLOBAL  EXIT P-LOCK TO SET IT` : `${label}: DRAG UP OR DOWN  2X: ${locking ? 'UNLOCK' : 'RESET'}`, 1600);
  }

  /** Un potard, un encodeur ou un bloc tenu (un doigt, la souris) ? */
  private knobHeld(): boolean {
    for (const o of this.grips.values()) if (o.kind === 'knob' && !o.infoOnly) return true;
    return false;
  }

  /**
   * Le dernier bloc lache : le LOCK momentane en attente sort (le P-LOCK fixe d'avant revient), s'il est encore celui
   * du pas leve, sans avoir ete repris depuis (bassLockGen) et si aucun doigt n'est revenu sur ce pas.
   */
  private flushLockOff(): void {
    const w = this.lockOffAfter;
    if (!w || this.knobHeld()) return;
    this.lockOffAfter = null;
    if (bassState.get().lock !== w.step || bassLockGen() !== w.gen) return;
    for (const o of this.grips.values()) if (o.kind === 'trig' && o.step === w.step) return;
    bassLockRestore(w.prev);
  }

  /* ---------------- EDIT : le rouleau (2026-10-09) ---------------- */

  /** Le point du pointeur sur le verre de l'ecran, en unites de l'ecran ; null si l'ecran n'est pas la. */
  private screenAt(x: number, y: number): { x: number; y: number } | null {
    const rig = this.stage.bass;
    const g = rig?.screen.editRoll();
    if (!rig || !g) return null;
    const out = { x: 0, y: 0 };
    const quad: number[] = [];
    for (const [px, py, pz] of rig.screenCorners()) {
      const p = this.stage.hit.project(rig.top, px, py, pz, out);
      quad.push(p.x, p.y);
    }
    const uv = quadToUnit(quad, x, y);
    return uv ? { x: uv.u * g.UW, y: uv.v * g.UH } : null;
  }

  /** La colonne du rouleau sous un point (unites de l'ecran), -1 hors du rouleau. */
  private rollStep(px: number): number {
    const g = this.stage.bass?.screen.editRoll();
    if (!g) return -1;
    const i = Math.floor((px - g.x0) / g.cw);
    return i >= 0 && i < BASS_STEPS ? i : Math.max(0, Math.min(BASS_STEPS - 1, i));
  }

  /** La hauteur MIDI sous une ordonnee du rouleau (unites de l'ecran), sur l'echelle lo..hi du depart du geste. */
  private rollMidi(g: Grip, py: number): number {
    const r = this.stage.bass?.screen.editRoll();
    if (!r) return 0;
    const t = (r.y1 - 3 - py) / Math.max(1, r.y1 - r.y0 - 6);
    return g.lo + Math.max(0, Math.min(1, t)) * (g.hi - g.lo);
  }

  /** La hauteur de la note que joue le pas i (une liaison : celle de la note qu'elle continue), -1 : un vide ; son octave. */
  private noteAt(i: number): { midi: number; oct: number } | null {
    const steps = bassState.get().steps;
    const s = steps[i];
    if (!s || s.kind === 'off') return null;
    for (let k = 0; k < BASS_STEPS; k += 1) {
      const q = steps[(i - k + BASS_STEPS) % BASS_STEPS];
      if (q.kind === 'note') return k === 0 || s.kind === 'tie' ? { midi: midiOf(q), oct: q.oct } : null;
      if (q.kind === 'off') return null;
    }
    return null;
  }

  /**
   * Un appui sur le rouleau : la note du pas sous le pointeur. Le glisser deplace la note d'autant que le pointeur
   * (v0 : sa hauteur a l'appui, a : celle de la note) : on la prend n'importe ou dans sa colonne, elle ne saute pas sous
   * le doigt. Un pas vide (la revue du 2026-10-09) : rien a l'appui ; la note se pose au lacher (une tape) ou au premier
   * glisser, a la hauteur de l'appui ; au doigt, un glisser qui part a moins d'une demi-colonne d'une note la prend.
   */
  private rollDown(g: Grip, x: number, y: number): void {
    g.kind = 'roll';
    window.clearTimeout(this.wheelShow);
    const r = this.stage.bass?.screen.editRoll();
    const at = this.screenAt(x, y);
    if (!r || !at) return;
    g.lo = r.lo;
    g.hi = r.hi;
    g.step = this.rollStep(at.x);
    const s = bassState.get().steps[g.step];
    if (!s) return;
    g.v0 = this.rollMidi(g, at.y);
    g.a = -1;
    if (s.kind === 'off') {
      g.empty = true;
      if (g.touch) {
        // La colonne voisine la plus proche du doigt, a moins d'une demi-colonne de son bord
        const fx = (at.x - r.x0) / r.cw;
        let best = Infinity;
        for (const j of [g.step - 1, g.step + 1]) {
          if (j < 0 || j >= BASS_STEPS || !this.noteAt(j)) continue;
          const dist = Math.abs(fx - (j + 0.5));
          if (dist <= 1 && dist < best) {
            best = dist;
            g.near = j;
          }
        }
      }
      return;
    }
    const n = this.noteAt(g.step);
    if (n) {
      g.a = n.midi;
      g.oct0 = n.oct;
    }
    this.showDrag(g);
  }

  /** Un pas vide du rouleau recoit sa note, a la hauteur de l'appui (le glisser continue de la deplacer). */
  private rollPlace(g: Grip): void {
    const p = bassPitchAt(g.v0, 0);
    bassEditNote(g.step, p.deg, p.oct);
    g.oct0 = p.oct;
    g.a = midiOf(bassState.get().steps[g.step]);
    g.empty = false;
  }

  /** Le glisser sur le rouleau : la note du pas monte ou descend d'autant que le pointeur (une liaison devient une note). */
  private rollMove(g: Grip, x: number, y: number): void {
    if (g.step < 0) return;
    const dy = y - g.y0;
    if (!g.dragged && Math.abs(dy) < AXIS_PX) return;
    const at = this.screenAt(x, y);
    if (!at) return;
    if (g.empty) {
      // Le premier glisser depuis un vide : la note voisine (au doigt), sinon une note posee ici
      if (g.near >= 0) {
        const n = this.noteAt(g.near);
        g.step = g.near;
        g.empty = false;
        if (!n) return;
        g.a = n.midi;
        g.oct0 = n.oct;
      } else this.rollPlace(g);
    }
    if (g.a < 0) return;
    const target = Math.max(g.lo, Math.min(g.hi, g.a + (this.rollMidi(g, at.y) - g.v0)));
    const p = bassPitchAt(target, g.oct0);
    g.dragged = true;
    bassEditNote(g.step, p.deg, p.oct);
    this.showDrag(g);
  }

  private rollUp(g: Grip, quick: boolean): void {
    if (g.step < 0) {
      this.stage.bass?.rollDragging(null);
      return;
    }
    // Une tape sur un vide : sa note, a la hauteur de la tape (elle reste nommee un instant)
    if (g.empty) {
      if (!g.dragged) {
        this.rollPlace(g);
        this.showDrag(g);
        this.unnameLater();
        return;
      }
    }
    this.stage.bass?.rollDragging(null);
    // Une tape sur une note (ou une liaison) : liaison, vide, comme la touche du pas
    if (!g.dragged && !g.moved && quick) bassEditCycle(g.step);
  }

  /** Le nom d'une note posee d'une tape ou tournee a la molette s'efface un instant apres. */
  private unnameLater(): void {
    window.clearTimeout(this.wheelShow);
    this.wheelShow = window.setTimeout(() => this.stage.bass?.rollDragging(null), 700);
  }

  /** L'ecran nomme la note qu'on glisse (le rig la cerne). */
  private showDrag(g: Grip): void {
    const s = bassState.get().steps[g.step];
    if (!s || s.kind !== 'note') {
      this.stage.bass?.rollDragging(null);
      return;
    }
    this.stage.bass?.rollDragging({ step: g.step, name: bassNoteName(s.deg, s.oct), lo: g.lo, hi: g.hi });
  }

  /** La souris au-dessus du rouleau (sans bouton) : sa colonne s'eclaire (le rig, rollHover). */
  hover(h: HotspotView | null, x: number, y: number): void {
    if (!h || h.id !== BASS_ROLL_ID) {
      this.rollHoverStep = -1;
      this.stage.bass?.rollHover(-1);
      return;
    }
    const at = this.screenAt(x, y);
    this.rollHoverStep = at ? this.rollStep(at.x) : -1;
    this.stage.bass?.rollHover(this.rollHoverStep);
  }

  /**
   * La molette au-dessus d'un potard, d'un encodeur ou d'un bloc (2026-10-08, la machine Elektron) : sur un encodeur ou
   * un bloc, un cran lent = 1/127, des crans rapides jusqu'a 8 (2026-10-09, l'acceleration ; Maj : 1 ; un pave
   * tactile : ses petits pas s'additionnent, 2 au plus) ; un potard dedie (STYLE, DENSITY, la plaque) garde sa loi (2 %
   * par cran, plus vite aux grands pas, Maj : 0.2 %) ; un cran entier sur un reglage a crans ; true si elle est prise.
   */
  wheel(h: HotspotView, delta: number, shift: boolean): boolean {
    if (h.kind === 'basstrig') {
      if (bassEditing()) return true;
      const i = Number(h.id.slice('bass-trig-'.length)) - 1;
      const s = bassState.get().steps[i];
      if (s) bassStepDeg(i, s.deg - Math.sign(delta));
      return true;
    }
    if (h.id === BASS_ROLL_ID) {
      // Le rouleau : la note du pas sous la souris (la colonne eclairee ; sinon le pas choisi), un degre de la gamme par
      // cran, l'octave qui suit (la revue du 2026-10-09 : la molette changeait le pas choisi, pas celui sous la souris, et
      // la hauteur la plus proche restait coincee) ; un pave tactile : ses petits pas s'additionnent
      const i = this.rollHoverStep >= 0 ? this.rollHoverStep : bassState.get().sel;
      const s = bassState.get().steps[i];
      if (!s || s.kind !== 'note') return true;
      let notches: number;
      if (Math.abs(delta) >= WHEEL_PX) notches = -Math.sign(delta);
      else {
        const acc = (this.wheelAcc.get(h.id) ?? 0) - delta;
        notches = Math.trunc(acc / WHEEL_PX);
        this.wheelAcc.set(h.id, acc - notches * WHEEL_PX);
      }
      if (!notches) return true;
      const p = bassDegStep(s.deg, s.oct, notches > 0 ? 1 : -1);
      if (p) bassEditNote(i, p.deg, p.oct);
      // Son nom un instant (l'echelle du rouleau suit la ligne : pas de glisser en cours)
      const now = bassState.get().steps[i];
      if (now.kind === 'note') this.stage.bass?.rollDragging({ step: i, name: bassNoteName(now.deg, now.oct) });
      this.unnameLater();
      return true;
    }
    if (h.kind !== 'bassknob') return false;
    const slot = slotOf(h);
    const id = !slot ? knobOf(h) : slot.enc ? bassFxParam(slot.k) : bassEncParam(slot.k);
    if (!id) return true;
    if (!slot) {
      const n = bassKnob(id).steps;
      if (n && n > 1) bassDial(id, bassKnobValue(id) - Math.sign(delta) / (n - 1));
      else bassDial(id, bassKnobValue(id) - Math.sign(delta) * (shift ? POT_WHEEL.fine : POT_WHEEL.step) * Math.min(POT_WHEEL.max, Math.abs(delta) / POT_WHEEL.px || 1));
      return true;
    }
    // Une molette de souris : un evenement, un cran ; un pave tactile : ses petits pas s'additionnent
    let notches: number;
    const pad = Math.abs(delta) < WHEEL_PX;
    if (!pad) {
      notches = -Math.sign(delta);
      this.wheelAcc.set(h.id, 0);
    } else {
      const acc = (this.wheelAcc.get(h.id) ?? 0) - delta;
      notches = Math.trunc(acc / WHEEL_PX);
      this.wheelAcc.set(h.id, acc - notches * WHEEL_PX);
    }
    if (!notches) return true;
    // L'acceleration : le temps depuis le cran d'avant sur la meme commande
    const now = performance.now();
    const dt = now - (this.wheelAt.get(h.id) ?? -Infinity);
    this.wheelAt.set(h.id, now);
    let k = 1;
    if (!shift) for (const [ms, units] of WHEEL_ACCEL) if (dt < ms) {
      k = pad ? Math.min(2, units) : units;
      break;
    }
    const n = bassKnob(id).steps;
    const cur = slot.enc ? bassParams.of(id) : bassKnobValue(id);
    const next = n && n > 1 ? cur + Math.sign(notches) / (n - 1) : Math.round((cur + notches * k * NOTCH) * 127) / 127;
    if (slot.enc) bassFxDial(slot.k, next);
    else bassDial(id, next);
    return true;
  }

  release(): void {
    for (const g of this.grips.values()) {
      window.clearTimeout(g.hold);
      if (g.kind === 'roll') this.stage.bass?.rollDragging(null);
      else if (g.kind !== 'knob') this.press(g.id, false);
      else {
        if (g.ring) this.stage.bass?.holdBlock(g.enc, false, g.fx);
        if (g.pot && g.knob) this.stage.bass?.holdPot(g.knob, false);
      }
    }
    this.grips.clear();
    this.lockOffAfter = null;
  }
}

/** Ce que fait une touche (pointeur, jumeau, clavier, MIDI). */
export function bassKeyAction(k: BassKeyKind): void {
  if (k === 'run') bassRun();
  else if (k === 'edit') bassEditToggle();
  else if (k === 'open') openToggle(null, 'bass');
  else if (k === 'gen') bassGenerate();
  else if (k === 'mutate') bassMutate();
  else if (k === 'clear') bassClear();
  else if (k === 'accent') bassAccent();
  else if (k === 'slide') bassSlide();
  else if (k === 'notedn') bassNote(-1);
  else if (k === 'noteup') bassNote(1);
  else if (k === 'octdn') bassOct(-1);
  else if (k === 'octup') bassOct(1);
  // Une touche de page pressee (2026-10-09) : la page allumee passe a son onglet suivant
  else if (k === 'pvoice') bassPagePress('voice');
  else if (k === 'pfilter') bassPagePress('filter');
  else if (k === 'penv') bassPagePress('env');
  else if (k === 'pfx') bassPagePress('fx');
  // PRESET (2026-10-09, le soir) : les presets a l'ecran, encore : fermes
  else if (k === 'preset') bassPresetKey();
}
