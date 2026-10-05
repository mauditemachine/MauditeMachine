/**
 * Les gestes sur le MM-SMPL (2026-10-04), au pointeur (souris, doigt) :
 * - un potard : glisser vers le haut ou la droite (150 px la course
 *   entiere ; Maj, dix fois plus fin), la molette, deux tapes : sa valeur
 *   de depart ;
 * - un pad : il sonne a l'appui, se tait au lacher sur RELEASE (2026-10-05 :
 *   une slice simple aussi, plus seulement GRAIN et LOOP) ; en EDIT
 *   (2026-10-05) c'est un pas de la sequence : le taper le pose ou l'enleve,
 *   glisser vers le haut ou le bas change sa slice (12 px par slice a la
 *   souris, 16 au doigt, comme la velocite d'un step du MM-RYTM) ;
 * - une touche : a l'appui (FILE et SAVE au lacher : le navigateur exige
 *   un geste fini pour ouvrir un fichier) ;
 * - l'ecran : pres d'une borne de la region (START, END), on la deplace ;
 *   ailleurs, glisser choisit une nouvelle region (de la ou on a pose le
 *   doigt a la ou il est) ; toucher sans glisser joue la slice touchee (en
 *   GRAIN : POSITION va la et suit le doigt, et un nuage y joue tant que le
 *   doigt reste, 2026-10-05).
 * Le meme contrat que les gestes du MM-DECKS (ui/Hotspots.tsx les appelle).
 */

import type { HotspotView } from '../scene/hit';
import type { Stage } from '../scene/renderer';
import { quadToUnit } from '../scene/quad';
import { DJ_BEZEL } from '../dj/theme';
import { smplClear, smplDial, smplEditToggle, smplLoopToggle, smplModeToggle, smplPad, smplPickFile, smplPlayToggle, smplRandom, smplRec, smplReverse, smplSave, smplSlicingNext, smplStepSlice, smplStepTap, smplStopAll, smplTouch } from './actions';
import { smplParams, type SmplKnobId } from './params';
import { smplKeyId, smplPadId } from './rig';
import { smplSeq } from './seq';
import { padCount, smplState } from './state';
import { SMPL, type SmplKeyKind } from './theme';

const KNOB_PX = 150;
const FINE = 0.1;
const AXIS_PX = 4;
const TAP_MS = 320;
/** Une borne de la region se prend a moins de EDGE (part de la largeur de l'ecran) */
const EDGE = 0.03;
/** EDIT : les pixels par slice en glissant sur un pas (souris, doigt), et le seuil du glisser */
const SLICE_PX = { mouse: 12, touch: 16 } as const;
const STEP_DRAG_PX = 6;

interface Grip {
  kind: 'knob' | 'key' | 'pad' | 'step' | 'screen';
  id: string;
  x0: number;
  y0: number;
  moved: boolean;
  /** potard */
  knob: SmplKnobId | null;
  v0: number;
  a: number;
  axis: 'x' | 'y' | null;
  fine: boolean;
  /** touche, pad */
  key: SmplKeyKind | null;
  pad: number;
  /** ecran : le quadrilatere projete, ce qu'on tient, u au depart */
  quad: number[];
  hold: 'start' | 'end' | 'select' | 'position' | null;
  u0: number;
  /** ecran, toucher : le pad joue */
  tapPad: number;
  /** EDIT, un pas : sa slice au depart (null : vide), les pixels par slice, glisse */
  slice0: number | null;
  px: number;
  dragged: boolean;
}

export class SmplGestures {
  private grips = new Map<number, Grip>();
  private lastTap = new Map<string, number>();
  private out = { x: 0, y: 0 };

  constructor(private stage: Stage) {}

  holds(pointerId: number): boolean {
    return this.grips.has(pointerId);
  }

  private press(id: string, down: boolean): void {
    this.stage.smpl?.pressKey(id, down);
  }

  down(pointerId: number, h: HotspotView, x: number, y: number, touch = false): void {
    const g: Grip = { kind: 'key', id: h.id, x0: x, y0: y, moved: false, knob: null, v0: 0, a: 0, axis: null, fine: false, key: null, pad: -1, quad: [], hold: null, u0: 0, tapPad: -1, slice0: null, px: touch ? SLICE_PX.touch : SLICE_PX.mouse, dragged: false };
    if (h.kind === 'smplknob') {
      g.kind = 'knob';
      g.knob = h.id.slice('smpl-knob-'.length) as SmplKnobId;
      g.v0 = smplParams.of(g.knob);
      // Deux tapes : la valeur de depart
      const now = performance.now();
      if (now - (this.lastTap.get(h.id) ?? -Infinity) < TAP_MS) {
        smplDial(g.knob, smplParams.def(g.knob));
        this.lastTap.delete(h.id);
      } else this.lastTap.set(h.id, now);
    } else if (h.kind === 'smplpad' && smplSeq.get().edit) {
      // EDIT : un pas ; taper (au lacher) le pose ou l'enleve, glisser change sa slice
      g.kind = 'step';
      g.pad = Number(h.id.slice('smpl-pad-'.length)) - 1;
      g.slice0 = smplSeq.get().steps[g.pad] ?? null;
      this.press(h.id, true);
    } else if (h.kind === 'smplpad') {
      g.kind = 'pad';
      g.pad = Number(h.id.slice('smpl-pad-'.length)) - 1;
      this.press(h.id, true);
      smplPad(g.pad, true);
    } else if (h.kind === 'smplscreen') {
      g.kind = 'screen';
      if (!this.screenDown(g, x, y)) return;
    } else {
      g.kind = 'key';
      g.key = h.id.slice('smpl-key-'.length) as SmplKeyKind;
      this.press(h.id, true);
      if (g.key !== 'file' && g.key !== 'save') keyAction(g.key);
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
        g.v0 = smplParams.of(g.knob);
        g.a = travel;
        g.fine = shift;
      }
      smplDial(g.knob, g.v0 + ((travel - g.a) / KNOB_PX) * (shift ? FINE : 1));
    } else if (g.kind === 'step') {
      if (!g.dragged && Math.abs(dy) < STEP_DRAG_PX) return;
      g.dragged = true;
      // Vers le haut : la slice suivante ; un pas vide part de la slice de son rang
      const n = padCount();
      const base = g.slice0 ?? (n > 0 ? g.pad % n : g.pad);
      smplStepSlice(g.pad, base + Math.round(-dy / g.px));
    } else if (g.kind === 'screen') this.screenMove(g, x, y);
  }

  up(pointerId: number, overId: string | null): void {
    const g = this.grips.get(pointerId);
    if (!g) return;
    this.grips.delete(pointerId);
    const tap = overId === g.id && !g.moved;
    if (g.kind === 'pad') {
      this.press(g.id, false);
      smplPad(g.pad, false);
    } else if (g.kind === 'step') {
      this.press(g.id, false);
      if (!g.dragged && overId === g.id) smplStepTap(g.pad);
    } else if (g.kind === 'key' && g.key) {
      this.press(g.id, false);
      if ((g.key === 'file' || g.key === 'save') && tap) keyAction(g.key);
    } else if (g.kind === 'screen') {
      if (g.tapPad >= 0) smplPad(g.tapPad, false);
      if (g.hold === 'position') smplTouch(false);
    }
  }

  /** La molette au-dessus d'un potard : 2 % par cran (Maj : 0.2 %) ; true si elle est prise. */
  wheel(h: HotspotView, delta: number, shift: boolean): boolean {
    if (h.kind !== 'smplknob') return false;
    const id = h.id.slice('smpl-knob-'.length) as SmplKnobId;
    smplDial(id, smplParams.of(id) - Math.sign(delta) * (shift ? 0.002 : 0.02) * Math.min(4, Math.abs(delta) / 40 || 1));
    return true;
  }

  release(): void {
    for (const g of this.grips.values()) {
      if (g.kind === 'pad') smplPad(g.pad, false);
      if (g.kind === 'screen' && g.tapPad >= 0) smplPad(g.tapPad, false);
      if (g.kind === 'screen' && g.hold === 'position') smplTouch(false);
      if (g.kind !== 'knob' && g.kind !== 'screen') this.press(g.id, false);
    }
    this.grips.clear();
  }

  /* ---------- l'ecran ---------- */

  private screenQuad(): number[] {
    const layer = this.stage.smpl?.top;
    if (!layer) return [];
    const S = SMPL.screen;
    const x0 = S.x - S.w / 2;
    const x1 = x0 + S.w;
    const z0 = S.z - S.d / 2;
    const z1 = S.z + S.d / 2;
    const out: number[] = [];
    for (const [px, pz] of [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ]) {
      const p = this.stage.hit.project(layer, px, DJ_BEZEL.h, pz, this.out);
      out.push(p.x, p.y);
    }
    return out;
  }

  private screenDown(g: Grip, x: number, y: number): boolean {
    g.quad = this.screenQuad();
    const uv = g.quad.length === 8 ? quadToUnit(g.quad, x, y) : null;
    const s = smplState.get();
    const rig = this.stage.smpl;
    if (!uv || !s.sample || !rig) return false;
    g.u0 = uv.u;
    const v = smplParams.get();
    const W = SMPL.screen.wave;
    // La bande du haut : rien (le nom du sample) ; la bande des pas non plus (les trigs les reglent)
    if (uv.v < W.v0 - 0.02) return false;
    const q = smplSeq.get();
    if ((q.edit || smplSeq.any()) && uv.v > SMPL.steps.wave1 + 0.02) return false;
    const ua = W.u0 + (W.u1 - W.u0) * v.start;
    const ub = W.u0 + (W.u1 - W.u0) * v.end;
    if (Math.abs(uv.u - ua) < EDGE && Math.abs(uv.u - ua) <= Math.abs(uv.u - ub)) g.hold = 'start';
    else if (Math.abs(uv.u - ub) < EDGE) g.hold = 'end';
    else if (s.mode === 'grain') {
      // GRAIN : le doigt pose POSITION et y fait naitre un nuage, tenu tant qu'il reste (2026-10-05)
      g.hold = 'position';
      this.setPosition(uv.u);
      smplTouch(true);
    } else {
      g.hold = 'select';
      // Toucher sans glisser : la slice sous le doigt sonne (comme son pad)
      const t = rig.timeAt(uv.u);
      const sl = s.slices;
      for (let i = 0; i + 1 < sl.length; i += 1) {
        if (t >= sl[i] && t < sl[i + 1]) {
          g.tapPad = i;
          smplPad(i, true);
          break;
        }
      }
    }
    return true;
  }

  private screenMove(g: Grip, x: number, y: number): void {
    const uv = g.quad.length === 8 ? quadToUnit(g.quad, x, y) : null;
    if (!uv) return;
    const W = SMPL.screen.wave;
    const k = (u: number): number => Math.min(1, Math.max(0, (u - W.u0) / (W.u1 - W.u0)));
    if (g.hold === 'start') smplDial('start', k(uv.u));
    else if (g.hold === 'end') smplDial('end', k(uv.u));
    else if (g.hold === 'position') this.setPosition(uv.u);
    else if (g.hold === 'select' && g.moved) {
      // Glisser : une nouvelle region, du point de depart au doigt (la slice touchee se tait)
      if (g.tapPad >= 0) {
        smplPad(g.tapPad, false);
        g.tapPad = -1;
      }
      const a = Math.min(k(g.u0), k(uv.u));
      const b = Math.max(k(g.u0), k(uv.u));
      if (b - a < 0.004) return;
      // END d'abord quand la region grandit vers la droite (START ne depasse jamais END)
      if (a < smplParams.of('start')) {
        smplDial('start', a);
        smplDial('end', b);
      } else {
        smplDial('end', b);
        smplDial('start', a);
      }
    }
  }

  /** GRAIN : POSITION a u (dans la region). */
  private setPosition(u: number): void {
    const W = SMPL.screen.wave;
    const v = smplParams.get();
    const k = Math.min(1, Math.max(0, (u - W.u0) / (W.u1 - W.u0)));
    const span = Math.max(1e-6, v.end - v.start);
    smplDial('position', (k - v.start) / span);
  }
}

/** Ce que fait une touche de la rangee. */
export function keyAction(k: SmplKeyKind): void {
  if (k === 'play') smplPlayToggle();
  else if (k === 'stop') smplStopAll();
  else if (k === 'random') smplRandom();
  else if (k === 'clear') smplClear();
  else if (k === 'edit') smplEditToggle();
  else if (k === 'file') smplPickFile();
  else if (k === 'rec') smplRec();
  else if (k === 'slices') smplSlicingNext();
  else if (k === 'mode') smplModeToggle();
  else if (k === 'rev') smplReverse();
  else if (k === 'loop') smplLoopToggle();
  else if (k === 'save') smplSave();
}

export { smplKeyId, smplPadId };
