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
 * - Ecran d'une platine (2026-10-04) : glisser sur la forme d'onde fine la
 *   fait defiler (en pause on entend un grain : poser un cue a l'oreille ;
 *   en lecture, la piste saute au lacher) ; toucher la piste entiere y
 *   va ; - et + changent le zoom, comme la molette et le pincement a deux
 *   doigts ; toucher le texte ouvre la liste des morceaux.
 */

import type { HotspotView } from '../scene/hit';
import type { Stage } from '../scene/renderer';
import { djBrowser } from './browser';
import { djBend, djCue, djPosition, djScrub, djSeek, djTempoStep, djZoom, djZoomStep, djHotcue, djHotcueClear, djJog, djJogRelease, djKeepPreview, djPlay, djSetEq, djSetFader, djSetFx, djSetMaster, djSetPitch, djSetTime, djSetXfader } from './actions';
import { DJ_FADERS, DJ_KEYS, DJ_KNOBS, type DjFaderSpec, type DjKeySpec, type DjKnobSpec } from './layout';
import { djState } from './state';
import { DECK, DECK_SCREEN, DJ_BEZEL, DJ_FADER, UNIT_X, type DjDeck } from './theme';

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

/** Les touches TEMPO tenues : un dixieme, puis en continu apres 0.4 s. */
const repeats = new Map<string, number>();
const REPEAT = { delay: 400, every: 90 } as const;

/** Une touche enfoncee (pointeur, jumeau, clavier) ; coarse : Maj tenue (TEMPO au BPM entier). */
export function keyDown(k: DjKeySpec, stage: Stage | null, coarse = false): void {
  stage?.dj?.pressKey(k.id, true);
  const t = k.target;
  if (t.kind === 'cue') {
    cueDown[t.deck] = true;
    djCue(t.deck, true);
  }
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
  else if (t.kind === 'tempo') {
    const step = coarse ? 1 : 0.1;
    djTempoStep(t.deck, t.dir, step);
    window.clearTimeout(repeats.get(k.id));
    repeats.set(
      k.id,
      window.setTimeout(function again() {
        djTempoStep(t.deck, t.dir, step);
        repeats.set(k.id, window.setTimeout(again, REPEAT.every));
      }, REPEAT.delay)
    );
  }
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
  const again = repeats.get(k.id);
  if (again !== undefined) {
    window.clearTimeout(again);
    repeats.delete(k.id);
  }
  if (t.kind === 'cue') {
    cueDown[t.deck] = false;
    djCue(t.deck, false);
  } else if (t.kind === 'bend') djBend(t.deck, 0);
  else if (t.kind === 'load' && tap) djBrowser.open(t.deck);
  else if (t.kind === 'playlist' && tap) djBrowser.toggle();
}

const cueDown: Record<DjDeck, boolean> = { a: false, b: false };
const cueHeld = (d: DjDeck): boolean => cueDown[d];

/* ---------------- pointeurs ---------------- */

/**
 * Homographie du carre unite vers le quadrilatere projete d'un ecran
 * (p0 haut gauche, p1 haut droite, p2 bas droite, p3 bas gauche), et son
 * inverse : un point de l'ecran du canvas -> (u, v) dans l'ecran 3D, exact
 * en perspective (l'ecran est plan).
 */
function quadToUnit(q: readonly number[], x: number, y: number): { u: number; v: number } | null {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-9) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const c = x0;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const f = y0;
  // Inverse de [[a b c] [d e f] [g h 1]]
  const A = e - f * h;
  const B = c * h - b;
  const C = b * f - c * e;
  const D = f * g - d;
  const E = a - c * g;
  const F = c * d - a * f;
  const G = d * h - e * g;
  const H = b * g - a * h;
  const I = a * e - b * d;
  const w = G * x + H * y + I;
  if (Math.abs(w) < 1e-12) return null;
  return { u: (A * x + B * y + C) / w, v: (D * x + E * y + F) / w };
}

type ScreenZone = 'text' | 'detail' | 'whole' | 'zoom';

function zoneOf(u: number, v: number): ScreenZone {
  const S = DECK_SCREEN;
  if (v < S.detail.v0 - 0.01) return 'text';
  if (v <= S.detail.v1 + 0.02) return 'detail';
  if (u >= S.zoom.u0 - 0.01) return 'zoom';
  return 'whole';
}

interface Grip {
  id: string;
  kind: 'knob' | 'fader' | 'key' | 'jog' | 'screen';
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
  /** ecran : la platine, la zone touchee, le quadrilatere projete, u au depart, la position visee */
  deck: DjDeck;
  zone: ScreenZone;
  quad: number[];
  u0: number;
  target: number;
  /** pincement : l'ecart des deux doigts et le zoom au depart */
  pinch: number;
  zoom0: number;
  x: number;
  y: number;
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
    const g: Grip = {
      id,
      kind: 'key',
      x0: x,
      y0: y,
      v0: 0,
      axis: null,
      fine: false,
      a: 0,
      ax: 0,
      ay: 0,
      cx: h.cx,
      cy: h.cy,
      ang: 0,
      t: performance.now(),
      moved: false,
      deck: 'a',
      zone: 'text',
      quad: [],
      u0: 0,
      target: 0,
      pinch: 0,
      zoom0: 0,
      x,
      y,
    };
    if (h.kind === 'djscreen') {
      if (!this.screenDown(g, x, y)) return;
    } else if (h.kind === 'djknob') {
      const k = knobById.get(id);
      if (!k) return;
      g.kind = 'knob';
      g.v0 = knobValue(k);
    } else if (h.kind === 'djfader') {
      const f = faderById.get(id);
      if (!f) return;
      g.kind = 'fader';
      g.v0 = faderValue(f);
      // Le pitch suit le mouvement depuis le point precedent (move)
      g.cx = x;
      g.cy = y;
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
    g.x = x;
    g.y = y;
    if (g.kind === 'screen') {
      this.screenMove(g);
      return;
    }
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
      if (f.target.kind === 'pitch') {
        /*
         * Le pitch (2026-10-04, Mika : "ca saute toujours") : il suit le
         * mouvement depuis le point precedent, et un glisser lent est cinq
         * fois plus fin qu'un glisser vif (Maj : dix fois) ; on arrive au
         * dixieme de BPM sans les touches TEMPO.
         */
        const now = performance.now();
        const ddx = x - g.cx;
        const ddy = y - g.cy;
        const speed = Math.hypot(ddx, ddy) / Math.max(1, now - g.t);
        const k = shift ? FINE : Math.max(0.2, Math.min(1, speed / 0.8));
        g.v0 = Math.max(-1, Math.min(1, g.v0 + ((2 * (ddx * g.ax + ddy * g.ay)) / L2) * k));
        g.cx = x;
        g.cy = y;
        g.t = now;
        setFader(f, g.v0);
        return;
      }
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
    if (g.kind === 'screen') {
      // En lecture, la forme d'onde glissee : la piste saute au lacher
      if (g.zone === 'detail' && g.moved && g.pinch === 0) djSeek(g.deck, g.target);
      if (g.zone === 'text' && tap) djBrowser.open(g.deck);
      this.stage.repaint();
      return;
    }
    if (g.kind === 'key') {
      const k = keyById.get(g.id);
      if (!k) return;
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
    if (h.kind === 'djscreen') {
      const d: DjDeck = h.id === 'dj-b-screen' ? 'b' : 'a';
      // Molette vers le haut : plus pres (moins de secondes a l'ecran)
      djZoom(d, djState.get().deck[d].zoom * Math.exp(deltaY * (shift ? 0.0005 : 0.002)));
      return true;
    }
    const k = knobById.get(h.id);
    const f = faderById.get(h.id);
    if (!k && !f) return false;
    // Le pitch a la molette : un dixieme de BPM par cran (vers le haut : plus vite)
    if (f && f.target.kind === 'pitch') {
      djTempoStep(f.target.deck, deltaY < 0 ? 1 : -1, shift ? 1 : 0.1);
      return true;
    }
    const step = (shift ? 0.01 : 0.02) * Math.sign(-deltaY) * Math.max(1, Math.round(Math.abs(deltaY) / 100));
    if (k) setKnob(k, Math.max(knobMin(k), Math.min(1, knobValue(k) + step * (1 - knobMin(k)))));
    else if (f) setFader(f, Math.max(faderMin(f), Math.min(1, faderValue(f) + step * (1 - faderMin(f)))));
    return true;
  }

  /** Le quadrilatere projete de l'ecran d'une platine (px du canvas). */
  private screenQuad(d: DjDeck): number[] {
    const layer = this.stage.dj?.top;
    if (!layer) return [];
    const S = DECK.screen;
    const x0 = UNIT_X[d] + S.x - S.w / 2;
    const x1 = x0 + S.w;
    const z0 = S.z - S.d / 2;
    const z1 = S.z + S.d / 2;
    const y = DJ_BEZEL.h;
    const out: number[] = [];
    for (const [px, pz] of [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ]) {
      const p = this.stage.hit.project(layer, px, y, pz, this.out);
      out.push(p.x, p.y);
    }
    return out;
  }

  /** Un doigt pose sur l'ecran ; false s'il ne tombe sur rien. */
  private screenDown(g: Grip, x: number, y: number): boolean {
    g.kind = 'screen';
    g.deck = g.id === 'dj-b-screen' ? 'b' : 'a';
    g.quad = this.screenQuad(g.deck);
    const uv = g.quad.length === 8 ? quadToUnit(g.quad, x, y) : null;
    if (!uv) return false;
    // Un deuxieme doigt sur le meme ecran : les deux pincent (le zoom)
    for (const o of this.grips.values()) {
      if (o.kind !== 'screen' || o.deck !== g.deck) continue;
      const dist = Math.hypot(o.x - x, o.y - y);
      if (dist < 8) continue;
      o.pinch = dist;
      g.pinch = dist;
      o.zoom0 = g.zoom0 = djState.get().deck[g.deck].zoom;
      g.zone = o.zone = 'detail';
      return true;
    }
    g.zone = zoneOf(uv.u, uv.v);
    g.u0 = uv.u;
    g.target = djPosition(g.deck);
    g.v0 = g.target;
    if (g.zone === 'zoom') {
      const Z = DECK_SCREEN.zoom;
      const k = (uv.u - Z.u0) / (Z.u1 - Z.u0);
      if (k < 0.4) djZoomStep(g.deck, 1);
      else if (k > 0.6) djZoomStep(g.deck, -1);
      else djZoom(g.deck, 8);
    } else if (g.zone === 'whole') this.seekWhole(g, uv.u);
    return true;
  }

  private seekWhole(g: Grip, u: number): void {
    const p = this.stage.dj ? djState.get().deck[g.deck] : null;
    const dur = p?.track?.duration ?? 0;
    if (dur <= 0) return;
    const O = DECK_SCREEN.overview;
    djSeek(g.deck, Math.max(0, Math.min(1, (u - O.u0) / (O.u1 - O.u0))) * dur);
    this.stage.repaint();
  }

  private screenMove(g: Grip): void {
    // Pincement : l'ecart des deux doigts change la fenetre
    if (g.pinch > 0) {
      for (const o of this.grips.values()) {
        if (o === g || o.kind !== 'screen' || o.deck !== g.deck || o.pinch === 0) continue;
        const dist = Math.hypot(o.x - g.x, o.y - g.y);
        if (dist > 4) djZoom(g.deck, g.zoom0 * (g.pinch / dist));
      }
      return;
    }
    const uv = quadToUnit(g.quad, g.x, g.y);
    if (!uv) return;
    if (g.zone === 'whole') {
      this.seekWhole(g, uv.u);
      return;
    }
    if (g.zone !== 'detail') return;
    // La forme d'onde suit le doigt : vers la gauche, la piste avance
    const D = DECK_SCREEN.detail;
    const win = djState.get().deck[g.deck].zoom;
    const dur = djState.get().deck[g.deck].track?.duration ?? 0;
    g.target = Math.max(0, Math.min(dur, g.v0 - ((uv.u - g.u0) / (D.u1 - D.u0)) * win));
    djScrub(g.deck, g.target);
    this.stage.repaint();
  }

  /** Tous les pointeurs lachent (demontage, perte). */
  release(): void {
    for (const id of [...this.grips.keys()]) this.up(id, null);
  }
}
