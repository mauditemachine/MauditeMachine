/**
 * La camera : un rail le long de la ligne (parametre s, dolly avec
 * inertie), des plans nommes (Focus sur une perle, Coda vers les portes,
 * Hold apres CLEAR), des tweens de pose vers des cibles mobiles, et un
 * balancement + une parallaxe pointeur hors tactile et hors reduced motion.
 */

import { PerspectiveCamera, Vector3 } from 'three';
import { MONOLITH_CENTER } from './Monolith';
import { TAU, basePos, clamp, damp, smoothPos } from './path';
import { easeInOutCubic, easeOutCubic, easeOutQuint, type Ease } from './tween';

export type CamMode = 'free' | 'focus' | 'coda' | 'hold';

const CAM_OFFSET = new Vector3(5.5, 2.2, 0);
// Portrait : moins de decalage lateral (la ligne reste centree) et le plan
// de repos recule (sMax plus grand) pour que les cinq portes ne remplissent
// pas l'ecran
const CAM_OFFSET_PORTRAIT = new Vector3(3.2, 2.6, 0);
const FOCUS_OFFSET = new Vector3(4.5, 1.8, 6.0);
const FOCUS_OFFSET_PORTRAIT = new Vector3(3.6, 1.6, 7.4);
const _dir = new Vector3();
const _look = new Vector3();
const _name = new Vector3();

const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export class CameraRig {
  readonly camera: PerspectiveCamera;
  s = 1.14;
  v = 0;
  sMin = 0.24;
  sMax = 1.14;
  mode: CamMode = 'free';
  portrait = false;
  touch = false;
  reduced = false;
  dragging = false;
  /** Recul de 3 unites quand le drawer INFO est ouvert (0..1, tweene par AcidLine). */
  pull = 0;
  readonly pos = new Vector3();
  readonly look = new Vector3();
  private goalPos = new Vector3();
  private goalLook = new Vector3();
  private fromPos = new Vector3();
  private fromLook = new Vector3();
  private holdPos = new Vector3();
  private holdLook = new Vector3();
  readonly focusPos = new Vector3();
  readonly codaLook = new Vector3();
  private poseTween: { start: number; dur: number; ease: Ease } | null = null;
  private sTween: { from: number; to: number; start: number; dur: number; ease: Ease } | null = null;
  private px = 0;
  private py = 0;
  private pxT = 0;
  private pyT = 0;

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(38, aspect, 0.1, 200);
    this.setViewport(aspect);
    this.solveGoal(1);
    this.pos.copy(this.goalPos);
    this.look.copy(this.goalLook);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  setViewport(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.portrait = aspect < 1;
    this.sMin = this.portrait ? 0.36 : 0.24;
    this.sMax = this.portrait ? 1.24 : 1.14;
    if (this.mode === 'free' && this.s > this.sMax && !this.sTween) this.s = this.sMax;
  }

  private get camOffset(): Vector3 {
    return this.portrait ? CAM_OFFSET_PORTRAIT : CAM_OFFSET;
  }

  /** Distance (en s) du point vise devant la camera : plus loin en portrait,
   * ou les objets sont eux-memes plus loin, sinon tout monte en haut du cadre. */
  get lookAhead(): number {
    return this.portrait ? 0.25 : 0.114;
  }

  get bias(): number {
    return this.portrait ? -1.0 : -0.35;
  }

  private startPose(now: number, dur: number, ease: Ease): void {
    if (this.reduced) {
      this.poseTween = null;
      return;
    }
    this.fromPos.copy(this.pos);
    this.fromLook.copy(this.look);
    this.poseTween = { start: now, dur, ease };
  }

  /** Plan d'ouverture : C(1.18) -> C(1.14) en 2.2 s easeOutQuint. */
  intro(now: number): void {
    this.mode = 'free';
    if (this.reduced) {
      this.s = this.sMax;
      this.sTween = null;
      return;
    }
    this.s = this.sMax + 0.04;
    this.sTween = { from: this.s, to: this.sMax, start: now, dur: 2.2, ease: easeOutQuint };
  }

  focusOn(now: number): void {
    this.mode = 'focus';
    this.sTween = null;
    this.v = 0;
    this.startPose(now, 0.9, easeInOutCubic);
  }

  coda(now: number): void {
    this.mode = 'coda';
    this.sTween = null;
    this.v = 0;
    this.s = this.sMax;
    this.startPose(now, 1.1, easeInOutCubic);
  }

  /** CLEAR : la camera reste ou elle est. */
  hold(): void {
    if (this.mode === 'free') return;
    this.holdPos.copy(this.pos);
    this.holdLook.copy(this.look);
    this.mode = 'hold';
    this.poseTween = null;
  }

  /** Retour au rail depuis un plan nomme : s deduit du z courant, 600 ms. */
  leaveToFree(now: number): void {
    if (this.mode === 'free') return;
    this.s = clamp((this.pos.z + 70) / 70, this.sMin, this.sMax);
    this.mode = 'free';
    this.v = 0;
    this.startPose(now, 0.6, easeOutCubic);
  }

  dolly(ds: number, now: number): void {
    this.leaveToFree(now);
    this.sTween = null;
    this.s = clamp(this.s + ds, this.sMin, this.sMax);
  }

  fling(v: number): void {
    this.v = v;
  }

  /** Ruler : dolly vers s en 1.1 s. */
  jumpTo(sTarget: number, now: number): void {
    this.leaveToFree(now);
    this.v = 0;
    const to = clamp(sTarget, this.sMin, this.sMax);
    if (this.reduced) {
      this.s = to;
      this.sTween = null;
      return;
    }
    this.sTween = { from: this.s, to, start: now, dur: 1.1, ease: easeInOutCubic };
  }

  /** Intro sautee : tout a sa fin. */
  finishAll(): void {
    if (this.sTween) {
      this.s = this.sTween.to;
      this.sTween = null;
    }
    this.poseTween = null;
  }

  get busy(): boolean {
    return !!(this.sTween || this.poseTween) || Math.abs(this.v) > 1e-4;
  }

  /** Parallaxe pointeur : nx, ny dans -1..1. */
  setPointer(nx: number, ny: number): void {
    this.pxT = nx * 0.3;
    this.pyT = -ny * 0.15;
  }

  private solveGoal(tuning: number): void {
    switch (this.mode) {
      case 'focus':
        this.goalPos.copy(this.focusPos).add(this.portrait ? FOCUS_OFFSET_PORTRAIT : FOCUS_OFFSET);
        this.goalLook.copy(this.focusPos);
        this.goalLook.y += this.bias;
        break;
      case 'coda':
        smoothPos(this.sMax, tuning, this.goalPos).add(this.camOffset);
        this.goalLook.copy(this.codaLook);
        break;
      case 'hold':
        this.goalPos.copy(this.holdPos);
        this.goalLook.copy(this.holdLook);
        break;
      default: {
        smoothPos(this.s, tuning, this.goalPos).add(this.camOffset);
        // Le regard vise la vraie ligne en x (amplitude 4.2), 8 unites plus
        // loin, mais garde la hauteur du rail : la ligne monte vers le passe
        // et doit rester dans le cadre au-dessus du panneau
        basePos(this.s - this.lookAhead, tuning, this.goalLook);
        smoothPos(this.s - this.lookAhead, tuning, _name);
        // Paysage : un rien a droite et au-dessus, pour que le nom au bout du
        // tunnel s'asseye sous la barre haute, a gauche du ruler
        this.goalLook.x += this.portrait ? 0 : 1.5;
        this.goalLook.y = _name.y + (this.portrait ? -1.0 : 0.55);
        // Le Nom : en fin de dolly vers le passe, le regard se pose sur le mur,
        // un peu sous son centre pour que le nom reste au-dessus du panneau
        const w = 1 - smoothstep(this.sMin, this.sMin + 0.08, this.s);
        if (w > 0) {
          _name.copy(MONOLITH_CENTER);
          _name.y += this.bias * 2.2;
          this.goalLook.lerp(_name, w);
        }
      }
    }
    if (this.pull > 0) {
      _dir.subVectors(this.goalPos, this.goalLook).normalize();
      this.goalPos.addScaledVector(_dir, 3 * this.pull);
    }
  }

  update(dt: number, now: number, time: number, tuning: number): void {
    if (this.sTween) {
      const x = clamp((now - this.sTween.start) / this.sTween.dur, 0, 1);
      this.s = this.sTween.from + (this.sTween.to - this.sTween.from) * this.sTween.ease(x);
      if (x >= 1) this.sTween = null;
    } else if (this.mode === 'free') {
      if (!this.dragging && Math.abs(this.v) > 1e-4) {
        this.s += this.v * dt;
        this.v *= Math.exp(-dt * 5);
      }
      this.s = clamp(this.s, this.sMin, this.sMax);
    }
    this.solveGoal(tuning);
    if (this.poseTween && !this.reduced) {
      const x = clamp((now - this.poseTween.start) / this.poseTween.dur, 0, 1);
      const k = this.poseTween.ease(x);
      this.pos.lerpVectors(this.fromPos, this.goalPos, k);
      this.look.lerpVectors(this.fromLook, this.goalLook, k);
      if (x >= 1) this.poseTween = null;
    } else {
      this.pos.copy(this.goalPos);
      this.look.copy(this.goalLook);
    }
    _look.copy(this.look);
    if (!this.touch && !this.reduced) {
      this.px = damp(this.px, this.pxT, 4, dt);
      this.py = damp(this.py, this.pyT, 4, dt);
      _look.x += 0.08 * Math.sin((time * TAU) / 11) + this.px;
      _look.y += this.py;
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(_look);
  }
}
