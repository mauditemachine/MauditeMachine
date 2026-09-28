/**
 * L'anneau sequenceur : la seule machine de la piece. 16 segments de laque
 * noire (rotor), 16 LEDs + halos, une rainure de progression, une tete de
 * lecture fixe a 12 h, une lampe. Il vit sur la ligne, voyage jusqu'a la
 * perle choisie, s'y clampe, tourne sous la tete pendant la lecture.
 * Un update par frame, zero allocation.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  ShaderMaterial,
  Shape,
  TorusGeometry,
  Vector3,
  type Material,
} from 'three';
import { TAU, clamp01, damp, frameAt, fullPos, makeFrame, type PathKnobs } from './path';
import { easeInOutCubic } from './tween';
import { GROOVE_FRAG, GROOVE_VERT } from './shaders';

export type SeqMode = 'boot' | 'idle' | 'loading' | 'playing' | 'paused';

export interface SeqInput {
  mode: SeqMode;
  progress: number;
  /** pas du metronome (0..15) ou -1 */
  step: number;
  reduced: boolean;
  /** secondes depuis le boot (self-test) */
  bootT: number;
  /** focus injouable : LEDs eteintes, pas de veille */
  ledsOff: boolean;
}

const UP = new Vector3(0, 1, 0);
const CREAM = new Color(0.965, 0.945, 0.906);
const RED = new Color(1.0, 0.23, 0.12);
const _pos = new Vector3();
const _x = new Vector3();
const _y = new Vector3();
const _z = new Vector3();
const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);
const _frame = makeFrame();

const segAngle = (k: number) => Math.PI / 2 - (k + 0.5) * (TAU / 16);

function radialTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export class Sequencer {
  readonly group = new Group();
  readonly rotor = new Group();
  readonly segments: InstancedMesh;
  readonly leds: InstancedMesh;
  readonly halos: InstancedMesh;
  readonly groove: Mesh;
  readonly playhead: Mesh;
  readonly lamp: PointLight;
  /** Parametre de dock sur la ligne. */
  t: number;
  private travel: { from: number; to: number; start: number; dur: number } | null = null;
  private off = new Float32Array(16);
  private springStart = new Float64Array(16);
  private popUntil = new Float64Array(16);
  private intensity = new Float32Array(16).fill(0.06);
  private ledBase = new Float32Array(16 * 3);
  private ledColors: Float32Array;
  private haloColors: Float32Array;
  private rotorAngle = 0;
  private lastStep = -1;
  private heldStep = -1;
  private grooveMat: ShaderMaterial;
  private disposables: (Material | { dispose: () => void })[] = [];
  private lacquer: MeshPhysicalMaterial | MeshStandardMaterial;

  constructor(idleT: number, mobile: boolean, withHalos: boolean) {
    this.t = idleT;
    // Segments : un secteur extrude, 16 instances tournees et poussees radialement
    const span = TAU / 16 - 0.05;
    const a0 = -span / 2;
    const a1 = span / 2;
    const shape = new Shape();
    shape.absarc(0, 0, 0.8, a0, a1, false);
    shape.lineTo(0.66 * Math.cos(a1), 0.66 * Math.sin(a1));
    shape.absarc(0, 0, 0.66, a1, a0, true);
    shape.closePath();
    const segGeom = new ExtrudeGeometry(shape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSize: 0.01,
      bevelThickness: 0.01,
      bevelSegments: 2,
      curveSegments: 6,
    });
    segGeom.translate(0, 0, -0.07);
    this.lacquer = mobile
      ? new MeshStandardMaterial({ color: 0x262626, roughness: 0.32, metalness: 0.3, envMapIntensity: 0.8 })
      : new MeshPhysicalMaterial({
          color: 0x232323,
          roughness: 0.4,
          metalness: 0.15,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
          envMapIntensity: 0.8,
        });
    this.segments = new InstancedMesh(segGeom, this.lacquer, 16);
    this.segments.frustumCulled = false;
    this.rotor.add(this.segments);
    this.disposables.push(segGeom, this.lacquer);

    // LEDs : disques plats, couleur par instance (cream, rouge aux accents 1, 5, 9, 13)
    const ledGeom = new CylinderGeometry(0.035, 0.035, 0.03, 16);
    ledGeom.rotateX(Math.PI / 2);
    const ledMat = new MeshBasicMaterial({ toneMapped: false });
    this.leds = new InstancedMesh(ledGeom, ledMat, 16);
    this.leds.frustumCulled = false;
    this.ledColors = new Float32Array(16 * 3);
    this.leds.instanceColor = new InstancedBufferAttribute(this.ledColors, 3);
    this.rotor.add(this.leds);
    this.disposables.push(ledGeom, ledMat);

    const haloGeom = new PlaneGeometry(0.14, 0.14);
    const tex = radialTexture();
    const haloMat = new MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.halos = new InstancedMesh(haloGeom, haloMat, 16);
    this.halos.frustumCulled = false;
    this.halos.renderOrder = 5;
    this.haloColors = new Float32Array(16 * 3);
    this.halos.instanceColor = new InstancedBufferAttribute(this.haloColors, 3);
    this.halos.visible = withHalos;
    this.rotor.add(this.halos);
    this.disposables.push(haloGeom, haloMat, tex);

    for (let k = 0; k < 16; k += 1) {
      const c = k % 4 === 0 ? RED : CREAM;
      this.ledBase[k * 3] = c.r;
      this.ledBase[k * 3 + 1] = c.g;
      this.ledBase[k * 3 + 2] = c.b;
      const a = segAngle(k);
      _pos.set(0.73 * Math.cos(a), 0.73 * Math.sin(a), 0.085);
      _q.identity();
      _m.compose(_pos, _q, _s);
      this.leds.setMatrixAt(k, _m);
      _pos.z = 0.1;
      _m.compose(_pos, _q, _s);
      this.halos.setMatrixAt(k, _m);
    }
    this.leds.instanceMatrix.needsUpdate = true;
    this.halos.instanceMatrix.needsUpdate = true;

    // Rainure de progression (statique) et tete de lecture a 12 h
    const grooveGeom = new TorusGeometry(0.83, 0.02, 8, 128);
    this.grooveMat = new ShaderMaterial({
      vertexShader: GROOVE_VERT,
      fragmentShader: GROOVE_FRAG,
      uniforms: { uProgress: { value: 0 } },
      toneMapped: false,
    });
    this.groove = new Mesh(grooveGeom, this.grooveMat);
    this.groove.frustumCulled = false;
    this.disposables.push(grooveGeom, this.grooveMat);

    const phGeom = new BoxGeometry(0.05, 0.1, 0.05);
    const phMat = new MeshBasicMaterial({ color: CREAM, toneMapped: false });
    this.playhead = new Mesh(phGeom, phMat);
    this.playhead.position.set(0, 0.93, 0.02);
    this.playhead.frustumCulled = false;
    this.disposables.push(phGeom, phMat);

    // La lampe de la perle : legerement devant le plan de l'anneau, cote
    // camera, pour eclairer la face avant de la perle et l'interieur de l'anneau
    this.lamp = new PointLight(0xf6f1e7, 8, 10, 2);
    this.lamp.position.set(0, 0.25, 0.9);

    this.group.add(this.rotor, this.groove, this.playhead, this.lamp);
    this.writeSegments();
  }

  setHalosVisible(v: boolean): void {
    this.halos.visible = v;
  }

  /** Voyage vers un parametre t (900 ms) ; coupe nette en reduced motion. */
  travelTo(target: number, nowS: number, reduced: boolean, dur = 0.9): void {
    if (Math.abs(target - this.t) < 1e-5) return;
    if (reduced) {
      this.t = target;
      this.travel = null;
      return;
    }
    this.travel = { from: this.t, to: target, start: nowS, dur };
  }

  /** Saute a la fin du voyage en cours (intro sautee). */
  finish(): void {
    if (this.travel) {
      this.t = this.travel.to;
      this.travel = null;
    }
  }

  private clamp(nowS: number): void {
    for (let k = 0; k < 16; k += 1) {
      this.off[k] = 0.5;
      this.springStart[k] = nowS + k * 0.02;
    }
  }

  private writeSegments(): void {
    for (let k = 0; k < 16; k += 1) {
      const a = segAngle(k);
      _pos.set(Math.cos(a) * this.off[k], Math.sin(a) * this.off[k], 0);
      _q.setFromAxisAngle(_z.set(0, 0, 1), a);
      _m.compose(_pos, _q, _s);
      this.segments.setMatrixAt(k, _m);
    }
    this.segments.instanceMatrix.needsUpdate = true;
  }

  private computeIntensity(inp: SeqInput, nowS: number, out: Float32Array): void {
    out.fill(0.06);
    if (inp.ledsOff) return;
    if (inp.mode === 'boot' && !inp.reduced) {
      const p = (inp.bootT - 0.2) / 0.04;
      if (p < 0) return;
      if (p < 16) {
        for (let k = 0; k < 16; k += 1) if (k <= p && p - k < 3) out[k] = 1 - (p - k) / 3;
      } else if (p < 32) {
        const head = 31 - p;
        for (let k = 0; k < 16; k += 1) if (k >= head && k - head < 3) out[k] = 1 - (k - head) / 3;
      }
      return;
    }
    if (inp.reduced) {
      // Chemin calme : remplissage de progression, aucune chasse
      if (inp.mode === 'playing' || inp.mode === 'paused') {
        const lit = inp.mode === 'playing' ? 1 : 0.4;
        for (let k = 0; k < 16; k += 1) if (inp.progress > k / 16) out[k] = lit;
      } else if (inp.mode === 'loading') {
        out.fill(0.25);
      }
      return;
    }
    switch (inp.mode) {
      case 'loading': {
        const head = Math.floor(nowS / 0.3) % 16;
        out[head] = 0.6;
        out[(head + 15) % 16] = 0.3;
        return;
      }
      case 'playing': {
        const s = inp.step;
        if (s < 0) return;
        out[s] = 1;
        out[(s + 15) % 16] = 0.45;
        out[(s + 14) % 16] = 0.2;
        return;
      }
      case 'paused': {
        const s = this.heldStep;
        if (s < 0) return;
        out[s] = 0.4;
        out[(s + 15) % 16] = 0.4;
        out[(s + 14) % 16] = 0.4;
        return;
      }
      default: {
        // Veille : pulsation lente du pas 1, toutes les 4 s
        const ph = nowS % 4;
        if (ph < 0.4) out[0] = 0.06 + 0.34 * (ph / 0.4);
        else if (ph < 1.6) out[0] = 0.4 - 0.34 * ((ph - 0.4) / 1.2);
      }
    }
  }

  private static target = new Float32Array(16);

  update(dt: number, time: number, nowS: number, knobs: PathKnobs, inp: SeqInput): void {
    // Voyage le long de la ligne, puis clamp a l'arrivee
    if (this.travel) {
      const x = clamp01((nowS - this.travel.start) / this.travel.dur);
      this.t = this.travel.from + (this.travel.to - this.travel.from) * easeInOutCubic(x);
      if (x >= 1) {
        this.travel = null;
        if (!inp.reduced) this.clamp(nowS);
      }
    }
    fullPos(this.t, knobs, time, _pos);
    frameAt(this.t, knobs.tuning, _frame);
    _z.copy(_frame.T);
    _y.copy(UP).addScaledVector(_z, -UP.dot(_z));
    if (_y.lengthSq() < 1e-4) _y.copy(_frame.n2);
    _y.normalize();
    _x.crossVectors(_y, _z);
    _m.makeBasis(_x, _y, _z);
    this.group.quaternion.setFromRotationMatrix(_m);
    this.group.position.copy(_pos);

    // Pas du metronome : le segment actif saute radialement 80 ms
    if (inp.mode === 'playing' && inp.step >= 0 && inp.step !== this.lastStep) {
      if (!inp.reduced) this.popUntil[inp.step] = nowS + 0.08;
      this.lastStep = inp.step;
      this.heldStep = inp.step;
    }
    if (inp.mode !== 'playing' && inp.mode !== 'paused') {
      this.lastStep = -1;
      this.heldStep = -1;
    }

    // Ressorts des segments (clamp du dock, pop du pas)
    let segDirty = false;
    for (let k = 0; k < 16; k += 1) {
      if (nowS < this.springStart[k]) continue;
      const popping = nowS < this.popUntil[k];
      const target = popping ? 0.06 : 0;
      const next = inp.reduced ? target : damp(this.off[k], target, popping ? 30 : 12, dt);
      if (Math.abs(next - this.off[k]) > 1e-5) {
        this.off[k] = Math.abs(next - target) < 1e-4 ? target : next;
        segDirty = true;
      }
    }
    if (segDirty) this.writeSegments();

    // Rotor et rainure : tournent avec la progression (lissage lambda 6)
    const rotTarget = -inp.progress * TAU;
    this.rotorAngle = inp.reduced ? rotTarget : damp(this.rotorAngle, rotTarget, 6, dt);
    this.rotor.rotation.z = this.rotorAngle;
    this.grooveMat.uniforms.uProgress.value = clamp01(-this.rotorAngle / TAU);

    // LEDs
    const tgt = Sequencer.target;
    this.computeIntensity(inp, nowS, tgt);
    let ledDirty = false;
    for (let k = 0; k < 16; k += 1) {
      const cur = this.intensity[k];
      const next = inp.reduced || tgt[k] > cur ? tgt[k] : damp(cur, tgt[k], 40, dt);
      if (Math.abs(next - cur) > 1e-4) {
        this.intensity[k] = next;
        ledDirty = true;
      }
    }
    if (ledDirty) {
      for (let k = 0; k < 16; k += 1) {
        const i = this.intensity[k];
        const o = k * 3;
        this.ledColors[o] = this.ledBase[o] * i;
        this.ledColors[o + 1] = this.ledBase[o + 1] * i;
        this.ledColors[o + 2] = this.ledBase[o + 2] * i;
        this.haloColors[o] = this.ledColors[o] * 0.8;
        this.haloColors[o + 1] = this.ledColors[o + 1] * 0.8;
        this.haloColors[o + 2] = this.ledColors[o + 2] * 0.8;
      }
      if (this.leds.instanceColor) this.leds.instanceColor.needsUpdate = true;
      if (this.halos.instanceColor) this.halos.instanceColor.needsUpdate = true;
    }
  }

  /** Position monde courante de l'anneau. */
  worldPosition(out: Vector3): Vector3 {
    return out.copy(this.group.position);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.segments.dispose();
    this.leds.dispose();
    this.halos.dispose();
  }
}
