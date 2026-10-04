/**
 * Les gestes du MM-DECKS sur la scene (2026-10-04). La couche de saisie
 * (ui/Hotspots.tsx) lui confie tout pointeur pose sur une de ses commandes,
 * des le pointerdown : il ne fait jamais tourner la vue (l'orbite ne le voit
 * pas), et deux doigts sur deux commandes travaillent ensemble (un fader et
 * un jog), comme deux mains sur une table.
 *
 * - Potard : glisser vertical ou horizontal (l'axe dominant apres 4 px),
 *   toute la course en 150 px, Maj dix fois plus fin, double tape : sa
 *   valeur neutre ; molette.
 * - Fader : le capuchon suit le pointeur le long de sa fente projetee a
 *   l'ecran (relatif : il ne saute pas sous le doigt) ; molette.
 * - Jog : l'angle du pointeur autour du centre projete du plateau.
 * - Touches : CUE et BEND agissent tant qu'on les tient ; PLAY, les hot
 *   cues et TIME a l'appui ; LOAD au relachement ; un hot cue tenu 0.6 s
 *   s'efface.
 */

import type { HotspotView } from '../scene/hit';
import type { Stage } from '../scene/renderer';
import { djBrowser } from './browser';
import { djBend, djCue, djHotcue, djHotcueClear, djJog, djJogRelease, djKeepPreview, djPlay, djSetEq, djSetFader, djSetFx, djSetMaster, djSetPitch, djSetTime, djSetXfader } from './actions';
import { DJ_FADERS, DJ_KEYS, DJ_KNOBS, type DjFaderSpec, type DjKeySpec, type DjKnobSpec } from './layout';
import { djState } from './state';
import { DJ_FADER, type DjDeck } from './theme';

const KNOB_PX = 150;
const FINE = 0.1;
const AXIS_PX = 4;
const DOUBLE_TAP_MS = 350;
const HOLD_CLEAR_MS = 600;

const knobById = new Map(DJ_KNOBS.map((k) => [k.id, k]));
const faderById = new Map(DJ_FADERS.map((f) => [f.id, f]));
const keyById = new Map(DJ_KEYS.map((k) => [k.id, k]));

/* ---------------- valeurs ---------------- */

export function knobValue(k: DjKnobSpec): number {
  const s = djState.get();
  const t = k.target;
  return t.kind === 'eq' ? s.ch[t.ch][t.eq] : t.kind === 'fx' ? s.fx[t.fx] : s.master;
}

export function setKnob(k: DjKnobSpec, v: number): void {
  const t = k.target;
  if (t.kind === 'eq') djSetEq(t.ch, t.eq, v);
  else if (t.kind === 'fx') djSetFx(t.fx, v);
  else djSetMaster(v);
}

export const knobNeutral = (k: DjKnobSpec): number => (k.bipolar ? 0 : k.target.kind === 'master' ? 0.88 : 0);
export const knobMin = (k: DjKnobSpec): number => (k.bipolar ? -1 : 0);

export function faderValue(f: DjFaderSpec): number {
  const s = djState.get();
  const t = f.target;
  return t.kind === 'channel' ? s.ch[t.ch].fader : t.kind === 'pitch' ? s.deck[t.deck].pitch : s.xfader;
}

export function setFader(f: DjFaderSpec, v: number): void {
  const t = f.target;
  if (t.kind === 'channel') djSetFader(t.ch, v);
  else if (t.kind === 'pitch') djSetPitch(t.deck, v);
  else djSetXfader(v);
}

export const faderMin = (f: DjFaderSpec): number => (f.target.kind === 'channel' ? 0 : -1);
export const faderNeutral = (f: DjFaderSpec): number => (f.target.kind === 'channel' ? 0.8 : 0);

/* ---------------- touches ---------------- */

const holdTimers = new Map<string, number>();

/** Une touche enfoncee (pointeur, jumeau, clavier). */
export function keyDown(k: DjKeySpec, stage: Stage | null): void {
  stage?.dj?.pressKey(k.id, true);
  const t = k.target;
  if (t.kind === 'cue') djCue(t.deck, true);
  else if (t.kind === 'play') {
    if (cueHeld(t.deck)) djKeepPreview(t.deck);
    else djPlay(t.deck);
  } else if (t.kind === 'hotcue') {
    djHotcue(t.deck, t.n);
    holdTimers.set(
      k.id,
      window.setTimeout(() => {
        holdTimers.delete(k.id);
        djHotcueClear(t.deck, t.n);
      }, HOLD_CLEAR_MS)
    );
  } else if (t.kind === 'bend') djBend(t.deck, t.dir);
  else if (t.kind === 'time') djSetTime(t.d);
}

/** La touche relachee ; tap : relachee sur elle (LOAD ouvre la liste). */
export function keyUp(k: DjKeySpec, stage: Stage | null, tap: boolean): void {
  stage?.dj?.pressKey(k.id, false);
  const t = k.target;
  const timer = holdTimers.get(k.id);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    holdTimers.delete(k.id);
  }
  if (t.kind === 'cue') djCue(t.deck, false);
  else if (t.kind === 'bend') djBend(t.deck, 0);
  else if (t.kind === 'load' && tap) djBrowser.open(t.deck);
}

const cueDown: Record<DjDeck, boolean> = { a: false, b: false };
const cueHeld = (d: DjDeck): boolean => cueDown[d];

/* ---------------- pointeurs ---------------- */

interface Grip {
  id: string;
  kind: 'knob' | 'fader' | 'key' | 'jog';
  x0: number;
  y0: number;
  v0: number;
  axis: 'x' | 'y' | null;
  fine: boolean;
  a: number;
  /** fader : la fente projetee (px du canvas), de a vers b */
  ax: number;
  ay: number;
  /** jog : centre projete, dernier angle, dernier instant */
  cx: number;
  cy: number;
  ang: number;
  t: number;
  moved: boolean;
}

export class DjGestures {
  private grips = new Map<number, Grip>();
  private lastTap = new Map<string, number>();
  private out = { x: 0, y: 0 };
  private out2 = { x: 0, y: 0 };

  constructor(private stage: Stage) {}

  /** Le pointeur est-il tenu par une commande du MM-DECKS ? */
  holds(pointerId: number): boolean {
    return this.grips.has(pointerId);
  }

  /** Pointerdown sur une commande (x, y : px du canvas). */
  down(pointerId: number, h: HotspotView, x: number, y: number): void {
    const id = h.id;
    const g: Grip = { id, kind: 'key', x0: x, y0: y, v0: 0, axis: null, fine: false, a: 0, ax: 0, ay: 0, cx: h.cx, cy: h.cy, ang: 0, t: performance.now(), moved: false };
    if (h.kind === 'djknob') {
      const k = knobById.get(id);
      if (!k) return;
      g.kind = 'knob';
      g.v0 = knobValue(k);
    } else if (h.kind === 'djfader') {
      const f = faderById.get(id);
      if (!f) return;
      g.kind = 'fader';
      g.v0 = faderValue(f);
      const layer = this.stage.dj?.top;
      if (!layer) return;
      const y3 = DJ_FADER.cap.h;
      const [a, b] = f.across ? [this.stage.hit.project(layer, f.a, y3, f.z, this.out), this.stage.hit.project(layer, f.b, y3, f.z, this.out2)] : [this.stage.hit.project(layer, f.x, y3, f.a, this.out), this.stage.hit.project(layer, f.x, y3, f.b, this.out2)];
      g.ax = b.x - a.x;
      g.ay = b.y - a.y;
    } else if (h.kind === 'djjog') {
      g.kind = 'jog';
      g.ang = Math.atan2(y - h.cy, x - h.cx);
    } else {
      const k = keyById.get(id);
      if (!k) return;
      if (k.target.kind === 'cue') cueDown[k.target.deck] = true;
      keyDown(k, this.stage);
    }
    this.grips.set(pointerId, g);
  }

  move(pointerId: number, x: number, y: number, shift: boolean): void {
    const g = this.grips.get(pointerId);
    if (!g) return;
    const dx = x - g.x0;
    const dy = y - g.y0;
    if (Math.hypot(dx, dy) > AXIS_PX) g.moved = true;
    if (g.kind === 'knob') {
      const k = knobById.get(g.id);
      if (!k) return;
      if (!g.axis) {
        if (Math.hypot(dx, dy) < AXIS_PX) return;
        g.axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
      }
      const travel = g.axis === 'y' ? -dy : dx;
      if (shift !== g.fine) {
        g.v0 = knobValue(k);
        g.a = travel;
        g.fine = shift;
      }
      const range = 1 - knobMin(k);
      setKnob(k, Math.max(knobMin(k), Math.min(1, g.v0 + ((travel - g.a) / KNOB_PX) * range * (shift ? FINE : 1))));
    } else if (g.kind === 'fader') {
      const f = faderById.get(g.id);
      const L2 = g.ax * g.ax + g.ay * g.ay;
      if (!f || L2 < 1) return;
      // Avancement le long de la fente (0 en a, 1 en b), puis la valeur
      let dt = (dx * g.ax + dy * g.ay) / L2;
      if (shift) dt *= FINE;
      const dv = f.target.kind === 'channel' ? -dt : 2 * dt;
      setFader(f, Math.max(faderMin(f), Math.min(1, g.v0 + dv)));
    } else if (g.kind === 'jog') {
      const d = g.id === 'dj-a-jog' ? 'a' : 'b';
      const ang = Math.atan2(y - g.cy, x - g.cx);
      let da = ang - g.ang;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      const now = performance.now();
      const dt = Math.max(0.001, (now - g.t) / 1000);
      g.ang = ang;
      g.t = now;
      djJog(d, da, dt);
    }
  }

  /** Relachement au-dessus de overId (tap : relache sur la meme commande, sans avoir glisse). */
  up(pointerId: number, overId: string | null): void {
    const g = this.grips.get(pointerId);
    if (!g) return;
    this.grips.delete(pointerId);
    const tap = overId === g.id && !g.moved;
    if (g.kind === 'key') {
      const k = keyById.get(g.id);
      if (!k) return;
      if (k.target.kind === 'cue') cueDown[k.target.deck] = false;
      keyUp(k, this.stage, tap);
    } else if (g.kind === 'jog') {
      djJogRelease(g.id === 'dj-a-jog' ? 'a' : 'b');
    } else if (tap) {
      // Double tape : la valeur neutre
      const t = performance.now();
      if (t - (this.lastTap.get(g.id) ?? -Infinity) <= DOUBLE_TAP_MS) {
        this.lastTap.delete(g.id);
        const k = knobById.get(g.id);
        const f = faderById.get(g.id);
        if (k) setKnob(k, knobNeutral(k));
        else if (f) setFader(f, faderNeutral(f));
      } else this.lastTap.set(g.id, t);
    }
  }

  /** Molette au-dessus d'un potard ou d'un fader ; true si elle est prise. */
  wheel(h: HotspotView, deltaY: number, shift: boolean): boolean {
    const k = knobById.get(h.id);
    const f = faderById.get(h.id);
    if (!k && !f) return false;
    const step = (shift ? 0.01 : 0.02) * Math.sign(-deltaY) * Math.max(1, Math.round(Math.abs(deltaY) / 100));
    if (k) setKnob(k, Math.max(knobMin(k), Math.min(1, knobValue(k) + step * (1 - knobMin(k)))));
    else if (f) setFader(f, Math.max(faderMin(f), Math.min(1, faderValue(f) + step * (1 - faderMin(f)))));
    return true;
  }

  /** Tous les pointeurs lachent (demontage, perte). */
  release(): void {
    for (const id of [...this.grips.keys()]) this.up(id, null);
  }
}
