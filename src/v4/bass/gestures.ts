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
 * La machine Elektron (2026-10-08, Mika : "quand on clique sur un step on
 * selectionne la partie qu'on veut modifier, et ensuite on tourne un
 * encodeur sur ce step") :
 * - les huit encodeurs (bass-enc-1 a 8) : les gestes d'un potard, relatifs
 *   (le reglage repart de sa valeur a chaque appui : rien ne saute quand la
 *   page change), sur le reglage de la page allumee ; la molette, un cran =
 *   1/127 (un cran entier pour un reglage a crans) ;
 * - un doigt tient un pas, un autre tourne un encodeur : le pas passe en
 *   LOCK tout de suite (sans attendre les 350 ms), comme sur une Elektron ;
 * - les touches de page ; la touche "i" de l'ecran (bass-key-i) allume ou
 *   eteint INFOS, meme au doigt en INFOS.
 * Au telephone, plus d'encodeurs (2026-10-09, Mika : "on change dans l'ecran
 * directement") : les blocs de l'ecran sont les commandes, les memes gestes
 * (un doigt qui glisse : relatif, 150 px la course ; deux tapes : la valeur
 * de depart, en LOCK le verrou s'en va ; INFOS : la carte, un glisser tourne
 * encore). Le bloc tenu est cerne a l'ecran (le rig, holdBlock), desktop
 * aussi pour l'encodeur tenu. Deux doigts : le doigt du pas leve avant celui
 * du bloc, le LOCK attend le lacher du bloc (sinon la fin du geste aurait
 * regle le son de tous les pas).
 */

import type { HotspotView } from '../scene/hit';
import type { Stage } from '../scene/renderer';
import { openToggle, presetKey } from '../actions';
import { bassInfos } from '../state/bassInfos';
import { bassAccent, bassClear, bassDial, bassDialReset, bassEditToggle, bassEditing, bassEncParam, bassGenerate, bassKnobValue, bassLockEnter, bassLockOff, bassLockTap, bassLockTurns, bassMutate, bassNote, bassOct, bassPageSet, bassPatternHold, bassRun, bassSlide, bassStepDeg, bassStepTap } from './actions';
import { bassPage, type BassPageId } from './pages';
import { bassKnob, type BassKnobId } from './params';
import { bassState } from './state';
import type { BassKeyKind } from './theme';

/** La molette : un cran (2026-10-08, 1/127 sur un encodeur), les pixels d'un cran (les petits pas d'un pave tactile s'additionnent). */
const NOTCH = 1 / 127;
const WHEEL_PX = 50;
/** La molette d'un potard dedie (STYLE, DENSITY, la plaque) : la loi d'avant les encodeurs (2 %, plus vite aux grands pas ; Maj : 0.2 %). */
const POT_WHEEL = { step: 0.02, fine: 0.002, px: 40, max: 4 } as const;
/**
 * Un encodeur : ceux de la face (bass-enc-1 a 8) et les blocs de l'ecran qui leur repondent (bass-blk-1 a 8, 2026-10-08,
 * la revue : un bloc touche reglait les presets) ; son rang, 0 a 7 ; -1 sinon.
 */
const encOf = (h: HotspotView): number => {
  const m = /^bass-(enc|blk)-(\d)$/.exec(h.id);
  return m ? Number(m[2]) - 1 : -1;
};

const KNOB_PX = 150;
const FINE = 0.1;
const AXIS_PX = 4;
const TAP_MS = 320;
/** Un pas : les pixels par degre en glissant (souris, doigt), et le seuil du glisser */
const DEG_PX = { mouse: 14, touch: 18 } as const;
const STEP_DRAG_PX = 6;
/** EDIT : tenir un pattern vide autant pour y copier la ligne. */
const HOLD_MS = 500;
/** Hors EDIT (2026-10-08) : tenir un pas autant le verrouille (LOCK, facon Elektron). */
const LOCK_HOLD_MS = 350;

/** Le potard d'une cible : sur la face (bass-knob-<id>) ou sur la plaque (bass-tw-<id>), son id dans h.bass. */
const knobOf = (h: HotspotView): BassKnobId => (h.bass ?? h.id.replace(/^bass-(knob|tw)-/, '')) as BassKnobId;

interface Grip {
  kind: 'knob' | 'key' | 'trig';
  id: string;
  x0: number;
  y0: number;
  moved: boolean;
  knob: BassKnobId | null;
  v0: number;
  a: number;
  axis: 'x' | 'y' | null;
  fine: boolean;
  /** un pas : son rang, son degre au depart, les pixels par degre, glisse */
  step: number;
  deg0: number;
  px: number;
  dragged: boolean;
  /** EDIT : le minuteur de l'appui tenu, et s'il a fini */
  hold: number;
  held: boolean;
  /** un pas tenu qui a mis le LOCK (2026-10-08) */
  lockHold: boolean;
  /** INFOS au doigt : la carte seulement, l'appui ne fait rien d'autre */
  infoOnly: boolean;
  /** un potard : le pas en LOCK quand sa valeur de depart a ete prise (-1 : le son global) */
  lock: number;
  /** un encodeur : son rang (-1 : un potard dedie) et la page ou il a pris son reglage */
  enc: number;
  page: BassPageId;
  /** un bloc (ou un encodeur) cerne a l'ecran tant qu'il est tenu (2026-10-09) */
  ring: boolean;
}

export class BassGestures {
  private grips = new Map<number, Grip>();
  private lastTap = new Map<string, number>();
  private wheelAcc = new Map<string, number>();
  /**
   * Deux doigts (2026-10-09) : le pas tenu leve alors qu'un bloc tourne encore ; son LOCK momentane ne sort qu'au
   * lacher du dernier bloc (-1 : rien en attente).
   */
  private lockOffAfter = -1;

  constructor(private stage: Stage) {}

  holds(pointerId: number): boolean {
    return this.grips.has(pointerId);
  }

  private press(id: string, down: boolean): void {
    this.stage.bass?.pressKey(id, down);
  }

  down(pointerId: number, h: HotspotView, x: number, y: number, touch = false): void {
    const g: Grip = { kind: 'key', id: h.id, x0: x, y0: y, moved: false, knob: null, v0: 0, a: 0, axis: null, fine: false, step: -1, deg0: 0, px: touch ? DEG_PX.touch : DEG_PX.mouse, dragged: false, hold: 0, held: false, lockHold: false, infoOnly: false, lock: -1, enc: -1, page: bassPage.get(), ring: false };
    // La touche "i" de l'ecran : INFOS, toujours (au doigt en INFOS aussi : c'est elle qui l'eteint)
    if (h.id === 'bass-key-i') {
      bassInfos.toggle();
      this.grips.set(pointerId, g);
      return;
    }
    // INFOS au doigt : la carte de la commande ; un potard peut encore tourner (la carte le suit), le reste attend
    if (touch && bassInfos.isOn()) {
      bassInfos.show(h.id);
      if (h.kind !== 'bassknob') {
        g.infoOnly = true;
        this.grips.set(pointerId, g);
        return;
      }
    }
    if (h.kind === 'basslcd') {
      // L'ecran : une touche des presets
      if (h.lcd) presetKey('bass', h.lcd);
      return;
    }
    if (h.kind === 'bassknob') {
      g.kind = 'knob';
      const enc = encOf(h);
      g.enc = enc;
      // Un encodeur : le reglage de la page allumee (une case vide : l'ecran le dit, rien ne tourne)
      g.knob = enc >= 0 ? bassEncParam(enc) : knobOf(h);
      if (!g.knob) {
        bassState.say(`${'ABCDEFGH'[enc] ?? ''}: EMPTY ON THIS PAGE`, 1200);
        this.grips.set(pointerId, g);
        return;
      }
      // Deux doigts (2026-10-08) : un pas tenu (pas encore en LOCK) et un encodeur qu'on prend : LOCK tout de suite
      if (!bassEditing()) {
        for (const o of this.grips.values()) {
          if (o.kind !== 'trig' || o.dragged || o.held) continue;
          window.clearTimeout(o.hold);
          o.held = true;
          o.lockHold = true;
          bassLockEnter(o.step);
          break;
        }
      }
      g.v0 = bassKnobValue(g.knob);
      g.lock = bassState.get().lock;
      // Le bloc tenu se cerne a l'ecran (2026-10-09) : on voit ce que le doigt regle avant que la valeur bouge
      if (enc >= 0) {
        g.ring = true;
        this.stage.bass?.holdBlock(enc, true);
      }
      // Deux tapes : la valeur de depart (en LOCK : le verrou s'en va) ; pas en INFOS au doigt (on lit)
      const now = performance.now();
      if (touch && bassInfos.isOn()) this.lastTap.delete(h.id);
      else if (now - (this.lastTap.get(h.id) ?? -Infinity) < TAP_MS) {
        bassDialReset(g.knob);
        g.v0 = bassKnobValue(g.knob);
        this.lastTap.delete(h.id);
      } else this.lastTap.set(h.id, now);
    } else if (h.kind === 'basstrig') {
      g.kind = 'trig';
      g.step = Number(h.id.slice('bass-trig-'.length)) - 1;
      g.deg0 = bassState.get().steps[g.step]?.deg ?? 0;
      this.press(h.id, true);
      if (bassEditing()) {
        g.hold = window.setTimeout(() => {
          g.held = true;
          bassPatternHold(g.step);
        }, HOLD_MS);
      } else {
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
    } else {
      g.kind = 'key';
      this.press(h.id, true);
      bassKeyAction(h.id.slice('bass-key-'.length) as BassKeyKind);
    }
    this.grips.set(pointerId, g);
  }

  move(pointerId: number, x: number, y: number, shift: boolean): void {
    const g = this.grips.get(pointerId);
    if (!g || g.infoOnly) return;
    const dx = x - g.x0;
    const dy = y - g.y0;
    if (Math.hypot(dx, dy) > AXIS_PX) g.moved = true;
    if (g.kind === 'knob' && g.enc >= 0 && bassPage.get() !== g.page) {
      // La page a change pendant qu'un encodeur tourne (2026-10-08, la revue : [ ], le MIDI, une touche de page d'un
      // autre doigt) : comme sur une Elektron, il regle desormais la page allumee, depuis la valeur qu'il y trouve
      g.page = bassPage.get();
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
      // Le LOCK a change pendant que le potard tourne (2026-10-08 : deux doigts, le pas tenu lache avant le
      // potard, ou un pas tenu qui entre en LOCK) : le potard repart de la valeur qu'il regle maintenant,
      // sans faire sauter le son global ni le verrou d'un autre pas
      const lock = bassState.get().lock;
      if (shift !== g.fine || lock !== g.lock) {
        g.v0 = bassKnobValue(g.knob);
        g.a = travel;
        g.fine = shift;
        g.lock = lock;
      }
      bassDial(g.knob, g.v0 + ((travel - g.a) / KNOB_PX) * (shift ? FINE : 1));
    } else if (g.kind === 'trig') {
      // EDIT : un pattern ne glisse pas
      if (bassEditing()) return;
      if (!g.dragged && Math.abs(dy) < STEP_DRAG_PX) return;
      // Deja verrouille par l'appui tenu : le pas ne glisse plus
      if (g.lockHold) return;
      g.dragged = true;
      window.clearTimeout(g.hold);
      bassStepDeg(g.step, g.deg0 + Math.round(-dy / g.px));
    }
  }

  up(pointerId: number, overId: string | null): void {
    const g = this.grips.get(pointerId);
    if (!g) return;
    this.grips.delete(pointerId);
    if (g.infoOnly) return;
    if (g.kind === 'trig') {
      this.press(g.id, false);
      window.clearTimeout(g.hold);
      // Un pas tenu pour LOCK, un potard tourne pendant l'appui : le lacher sort (LOCK momentane) ; un bloc encore tenu
      // d'un autre doigt (2026-10-09) : il continue d'ecrire sur ce pas, le LOCK sort a son lacher
      if (g.lockHold && bassLockTurns() > 0) {
        if (this.knobHeld()) this.lockOffAfter = g.step;
        else bassLockOff();
      }
      if (!g.dragged && !g.held && overId === g.id) bassStepTap(g.step);
    } else if (g.kind === 'key') this.press(g.id, false);
    else if (g.kind === 'knob') {
      if (g.ring) this.stage.bass?.holdBlock(g.enc, false);
      this.flushLockOff();
    }
  }

  /** Un potard, un encodeur ou un bloc tenu (un doigt, la souris) ? */
  private knobHeld(): boolean {
    for (const o of this.grips.values()) if (o.kind === 'knob' && !o.infoOnly) return true;
    return false;
  }

  /** Le dernier bloc lache : le LOCK momentane en attente sort, s'il est encore celui du pas leve. */
  private flushLockOff(): void {
    if (this.lockOffAfter < 0 || this.knobHeld()) return;
    const step = this.lockOffAfter;
    this.lockOffAfter = -1;
    if (bassState.get().lock === step) bassLockOff();
  }

  /**
   * La molette au-dessus d'un potard ou d'un encodeur (2026-10-08, la machine
   * Elektron) : sur un encodeur, un cran = 1/127, le nombre de l'ecran bouge
   * de 1 (les petits pas d'un pave tactile s'additionnent ; Maj sans effet,
   * c'est deja le plus fin) ; un potard dedie (STYLE, DENSITY, la plaque)
   * garde sa loi (2 % par cran, plus vite aux grands pas, Maj : 0.2 %) ; un
   * cran entier sur un reglage a crans ; true si elle est prise.
   */
  wheel(h: HotspotView, delta: number, shift: boolean): boolean {
    if (h.kind === 'basstrig') {
      if (bassEditing()) return true;
      const i = Number(h.id.slice('bass-trig-'.length)) - 1;
      const s = bassState.get().steps[i];
      if (s) bassStepDeg(i, s.deg - Math.sign(delta));
      return true;
    }
    if (h.kind !== 'bassknob') return false;
    const enc = encOf(h);
    const id = enc >= 0 ? bassEncParam(enc) : knobOf(h);
    if (!id) return true;
    if (enc < 0) {
      const n = bassKnob(id).steps;
      if (n && n > 1) bassDial(id, bassKnobValue(id) - Math.sign(delta) / (n - 1));
      else bassDial(id, bassKnobValue(id) - Math.sign(delta) * (shift ? POT_WHEEL.fine : POT_WHEEL.step) * Math.min(POT_WHEEL.max, Math.abs(delta) / POT_WHEEL.px || 1));
      return true;
    }
    // Une molette de souris : un evenement, un cran ; un pave tactile : ses petits pas s'additionnent
    let notches: number;
    if (Math.abs(delta) >= WHEEL_PX) {
      notches = -Math.sign(delta);
      this.wheelAcc.set(h.id, 0);
    } else {
      const acc = (this.wheelAcc.get(h.id) ?? 0) - delta;
      notches = Math.trunc(acc / WHEEL_PX);
      this.wheelAcc.set(h.id, acc - notches * WHEEL_PX);
    }
    if (!notches) return true;
    const n = bassKnob(id).steps;
    if (n && n > 1) bassDial(id, bassKnobValue(id) + Math.sign(notches) / (n - 1));
    else bassDial(id, Math.round((bassKnobValue(id) + notches * NOTCH) * 127) / 127);
    return true;
  }

  release(): void {
    for (const g of this.grips.values()) {
      window.clearTimeout(g.hold);
      if (g.kind !== 'knob') this.press(g.id, false);
      else if (g.ring) this.stage.bass?.holdBlock(g.enc, false);
    }
    this.grips.clear();
    this.lockOffAfter = -1;
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
  else if (k === 'pvoice') bassPageSet('voice');
  else if (k === 'pfilter') bassPageSet('filter');
  else if (k === 'penv') bassPageSet('env');
  else if (k === 'pfx') bassPageSet('fx');
}
