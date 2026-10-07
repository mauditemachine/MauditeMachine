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
 * - l'ecran : les presets (state/presetMode.ts), a l'appui.
 */

import type { HotspotView } from '../scene/hit';
import type { Stage } from '../scene/renderer';
import { presetKey } from '../actions';
import { bassAccent, bassClear, bassDial, bassDialReset, bassEditToggle, bassEditing, bassGenerate, bassKnobValue, bassLockTap, bassMutate, bassNote, bassOct, bassPatternHold, bassRun, bassSlide, bassStepDeg, bassStepTap } from './actions';
import { bassKnob, type BassKnobId } from './params';
import { bassState } from './state';
import type { BassKeyKind } from './theme';

const KNOB_PX = 150;
const FINE = 0.1;
const AXIS_PX = 4;
const TAP_MS = 320;
/** Un pas : les pixels par degre en glissant (souris, doigt), et le seuil du glisser */
const DEG_PX = { mouse: 14, touch: 18 } as const;
const STEP_DRAG_PX = 6;
/** EDIT : tenir un pattern vide autant pour y copier la ligne. */
const HOLD_MS = 500;

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
}

export class BassGestures {
  private grips = new Map<number, Grip>();
  private lastTap = new Map<string, number>();

  constructor(private stage: Stage) {}

  holds(pointerId: number): boolean {
    return this.grips.has(pointerId);
  }

  private press(id: string, down: boolean): void {
    this.stage.bass?.pressKey(id, down);
  }

  down(pointerId: number, h: HotspotView, x: number, y: number, touch = false): void {
    const g: Grip = { kind: 'key', id: h.id, x0: x, y0: y, moved: false, knob: null, v0: 0, a: 0, axis: null, fine: false, step: -1, deg0: 0, px: touch ? DEG_PX.touch : DEG_PX.mouse, dragged: false, hold: 0, held: false };
    if (h.kind === 'basslcd') {
      // L'ecran : une touche des presets
      if (h.lcd) presetKey('bass', h.lcd);
      return;
    }
    if (h.kind === 'bassknob') {
      g.kind = 'knob';
      g.knob = h.id.slice('bass-knob-'.length) as BassKnobId;
      g.v0 = bassKnobValue(g.knob);
      // Deux tapes : la valeur de depart (en LOCK : le verrou s'en va)
      const now = performance.now();
      if (now - (this.lastTap.get(h.id) ?? -Infinity) < TAP_MS) {
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
    if (!g) return;
    const dx = x - g.x0;
    const dy = y - g.y0;
    if (Math.hypot(dx, dy) > AXIS_PX) g.moved = true;
    if (g.kind === 'knob' && g.knob) {
      if (!g.axis) {
        if (Math.hypot(dx, dy) < AXIS_PX) return;
        g.axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
      }
      const travel = g.axis === 'y' ? -dy : dx;
      if (shift !== g.fine) {
        g.v0 = bassKnobValue(g.knob);
        g.a = travel;
        g.fine = shift;
      }
      bassDial(g.knob, g.v0 + ((travel - g.a) / KNOB_PX) * (shift ? FINE : 1));
    } else if (g.kind === 'trig') {
      // EDIT : un pattern ne glisse pas
      if (bassEditing()) return;
      if (!g.dragged && Math.abs(dy) < STEP_DRAG_PX) return;
      g.dragged = true;
      bassStepDeg(g.step, g.deg0 + Math.round(-dy / g.px));
    }
  }

  up(pointerId: number, overId: string | null): void {
    const g = this.grips.get(pointerId);
    if (!g) return;
    this.grips.delete(pointerId);
    if (g.kind === 'trig') {
      this.press(g.id, false);
      window.clearTimeout(g.hold);
      if (!g.dragged && !g.held && overId === g.id) bassStepTap(g.step);
    } else if (g.kind === 'key') this.press(g.id, false);
  }

  /** La molette au-dessus d'un potard : 2 % par cran (Maj : 0.2 %), un cran entier sur les selecteurs ; true si elle est prise. */
  wheel(h: HotspotView, delta: number, shift: boolean): boolean {
    if (h.kind === 'basstrig') {
      if (bassEditing()) return true;
      const i = Number(h.id.slice('bass-trig-'.length)) - 1;
      const s = bassState.get().steps[i];
      if (s) bassStepDeg(i, s.deg - Math.sign(delta));
      return true;
    }
    if (h.kind !== 'bassknob') return false;
    const id = h.id.slice('bass-knob-'.length) as BassKnobId;
    const n = bassKnob(id).steps;
    if (n && n > 1) bassDial(id, bassKnobValue(id) - Math.sign(delta) / (n - 1));
    else bassDial(id, bassKnobValue(id) - Math.sign(delta) * (shift ? 0.002 : 0.02) * Math.min(4, Math.abs(delta) / 40 || 1));
    return true;
  }

  release(): void {
    for (const g of this.grips.values()) {
      window.clearTimeout(g.hold);
      if (g.kind !== 'knob') this.press(g.id, false);
    }
    this.grips.clear();
  }
}

/** Ce que fait une touche (pointeur, jumeau, clavier, MIDI). */
export function bassKeyAction(k: BassKeyKind): void {
  if (k === 'run') bassRun();
  else if (k === 'edit') bassEditToggle();
  else if (k === 'gen') bassGenerate();
  else if (k === 'mutate') bassMutate();
  else if (k === 'clear') bassClear();
  else if (k === 'accent') bassAccent();
  else if (k === 'slide') bassSlide();
  else if (k === 'notedn') bassNote(-1);
  else if (k === 'noteup') bassNote(1);
  else if (k === 'octdn') bassOct(-1);
  else if (k === 'octup') bassOct(1);
}
