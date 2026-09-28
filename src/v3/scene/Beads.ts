/**
 * Les perles (37 pistes + 5 hubs de mixtapes, un InstancedMesh) et les
 * portes (5 tores, un InstancedMesh). Positions recalculees chaque frame
 * depuis path.ts, couleurs d'etat lissees, tweens d'echelle (pop de
 * l'intro, survol, pulsation en lecture, flash rouge du notice).
 */

import {
  Color,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  TorusGeometry,
  Vector3,
} from 'three';
import { BEADS, BEAD_COUNT, GROUPS, TRACK_COUNT, beadInGroup, type Bead, type GroupId } from '../data/beads';
import { damp, frameAt, fullPos, makeFrame, smooth01, type PathKnobs } from './path';
import { easeOutBack } from './tween';

const SILVER = new Color(0.93, 0.91, 0.87);
const IDLE = SILVER.clone();
const DIMMED = SILVER.clone().multiplyScalar(0.45);
const HOVER = SILVER.clone().multiplyScalar(1.6);
const SELECTED = new Color(0.93 * 1.2, 0.91 * 1.12, 0.87).multiplyScalar(1.15);
const CURRENT = new Color(1.0, 0.22, 0.12).multiplyScalar(1.6);
const UNPLAYABLE = new Color(0.3, 0.3, 0.3);
const FLASH = new Color(2.0, 0.2, 0.1);

const _pos = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _mat = new Matrix4();
const _axis = new Vector3();
const _frame = makeFrame();
const Z = new Vector3(0, 0, 1);
const popEase = easeOutBack(1.4);

/** mulberry32 : aleatoire seede, les axes de rotation ne changent pas d'une visite a l'autre. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export interface BeadsInput {
  hoverId: string | null;
  selectedId: string | null;
  currentId: string | null;
  playing: boolean;
  group: GroupId;
  noticeAt: number; // ms
  noticeId: string | null;
  reveal: number;
  reduced: boolean;
  /** position camera : une porte trop proche s'efface, la bobine aussi (path.ts) */
  camPos: Vector3;
}

export class Beads {
  readonly mesh: InstancedMesh;
  readonly gates: InstancedMesh;
  readonly material: MeshStandardMaterial;
  readonly gateMaterial: MeshStandardMaterial;
  /** Positions monde des 42 centres (x, y, z), lues par le picking et la camera. */
  readonly positions = new Float32Array(BEAD_COUNT * 3);
  private colors: Float32Array;
  private axes: Float32Array;
  private hoverAmt = new Float32Array(BEAD_COUNT);
  private gateVis = new Float32Array(8).fill(1);
  private popStart = new Float64Array(BEAD_COUNT).fill(-1);
  private geom: IcosahedronGeometry;
  private gateGeom: TorusGeometry;
  private hubs: Bead[];

  constructor(metal: MeshStandardMaterial, detail: number) {
    this.material = metal;
    this.gateMaterial = metal.clone();
    this.geom = new IcosahedronGeometry(1, detail);
    this.mesh = new InstancedMesh(this.geom, this.material, BEAD_COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    this.colors = new Float32Array(BEAD_COUNT * 3);
    for (let i = 0; i < BEAD_COUNT; i += 1) {
      this.colors[i * 3] = IDLE.r;
      this.colors[i * 3 + 1] = IDLE.g;
      this.colors[i * 3 + 2] = IDLE.b;
    }
    this.mesh.instanceColor = new InstancedBufferAttribute(this.colors, 3);
    const rnd = seeded(20120515);
    this.axes = new Float32Array(BEAD_COUNT * 3);
    for (let i = 0; i < BEAD_COUNT; i += 1) {
      _axis.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      this.axes[i * 3] = _axis.x;
      this.axes[i * 3 + 1] = _axis.y;
      this.axes[i * 3 + 2] = _axis.z;
    }
    this.hubs = GROUPS[4];
    this.gateGeom = new TorusGeometry(1, 0.03, 12, 64);
    this.gates = new InstancedMesh(this.gateGeom, this.gateMaterial, this.hubs.length);
    this.gates.frustumCulled = false;
    this.gates.renderOrder = 0;
    // Premiere pose : tout a l'echelle 0 avant l'intro (pop a la revelation)
    for (let i = 0; i < BEAD_COUNT; i += 1) {
      _mat.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, _mat);
    }
  }

  /** Reduced motion ou intro sautee : toutes les perles a leur taille finale. */
  popAll(): void {
    for (let i = 0; i < BEAD_COUNT; i += 1) this.popStart[i] = -1e9;
  }

  private targetColor(b: Bead, inp: BeadsInput, nowMs: number, out: Color): Color {
    if (!b.playable) return out.copy(UNPLAYABLE);
    if (inp.noticeId === b.id && nowMs - inp.noticeAt < 800) {
      const on = Math.floor((nowMs - inp.noticeAt) / 200) % 2 === 0;
      if (on) return out.copy(FLASH);
    }
    if (inp.currentId === b.id) return out.copy(CURRENT);
    if (inp.hoverId === b.id) return out.copy(HOVER);
    if (inp.selectedId === b.id) return out.copy(SELECTED);
    if (!beadInGroup(b, inp.group)) return out.copy(DIMMED);
    return out.copy(IDLE);
  }

  private static tmpColor = new Color();

  update(dt: number, time: number, nowMs: number, knobs: PathKnobs, inp: BeadsInput): void {
    const c = Beads.tmpColor;
    const nowS = nowMs / 1000;
    let colorDirty = false;
    for (let i = 0; i < BEAD_COUNT; i += 1) {
      const b = BEADS[i];
      fullPos(b.t, knobs, time, _pos, inp.camPos);
      this.positions[i * 3] = _pos.x;
      this.positions[i * 3 + 1] = _pos.y;
      this.positions[i * 3 + 2] = _pos.z;

      // Pop a la revelation : demarre quand la ligne atteint la perle
      let pop = 1;
      if (this.popStart[i] < 0) {
        if (inp.reveal >= b.t || inp.reduced) this.popStart[i] = inp.reduced ? -1e9 : nowS;
        else pop = 0;
      }
      if (this.popStart[i] >= 0) {
        const x = Math.min(1, (nowS - this.popStart[i]) / 0.32);
        pop = x >= 1 ? 1 : Math.max(0, popEase(x));
      }

      // Survol : 1.0 -> 1.08 en 150 ms, retour en 250 ms ; coupe nette en
      // reduced motion (la boucle s'arrete des que rien ne bouge, un lissage
      // resterait a mi-chemin)
      const hoverTarget = inp.hoverId === b.id ? 1 : 0;
      this.hoverAmt[i] = inp.reduced ? hoverTarget : damp(this.hoverAmt[i], hoverTarget, hoverTarget ? 20 : 12, dt);
      let s = b.radius * pop * (1 + 0.08 * this.hoverAmt[i]);
      if (inp.currentId === b.id && inp.playing && !inp.reduced) s *= 1 + 0.03 + 0.03 * Math.sin(nowS * Math.PI * 2);
      _scale.set(s, s, s);

      if (inp.reduced) _quat.identity();
      else {
        _axis.set(this.axes[i * 3], this.axes[i * 3 + 1], this.axes[i * 3 + 2]);
        _quat.setFromAxisAngle(_axis, time * 0.2 + i);
      }
      _mat.compose(_pos, _quat, _scale);
      this.mesh.setMatrixAt(i, _mat);

      this.targetColor(b, inp, nowMs, c);
      const o = i * 3;
      let r = c.r;
      let g = c.g;
      let bb = c.b;
      if (!inp.reduced) {
        const up = c.r + c.g + c.b > this.colors[o] + this.colors[o + 1] + this.colors[o + 2];
        const lambda = up ? 20 : 8;
        r = damp(this.colors[o], c.r, lambda, dt);
        g = damp(this.colors[o + 1], c.g, lambda, dt);
        bb = damp(this.colors[o + 2], c.b, lambda, dt);
      }
      if (Math.abs(r - this.colors[o]) + Math.abs(g - this.colors[o + 1]) + Math.abs(bb - this.colors[o + 2]) > 1e-4) {
        this.colors[o] = r;
        this.colors[o + 1] = g;
        this.colors[o + 2] = bb;
        colorDirty = true;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (colorDirty && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    // Les portes : sur la ligne, axe = tangente, rayon selon la duree du set
    for (let k = 0; k < this.hubs.length; k += 1) {
      const h = this.hubs[k];
      const i = h.index;
      _pos.set(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
      frameAt(h.t, knobs.tuning, _frame);
      _quat.setFromUnitVectors(Z, _frame.T);
      const minutes = h.mixtape ? h.mixtape.durationMinutes : 90;
      const near = smooth01((inp.camPos.distanceTo(_pos) - 3.2) / 3.0);
      this.gateVis[k] = inp.reduced ? near : damp(this.gateVis[k], near, 8, dt);
      const r = (0.85 + 0.5 * Math.min(1, minutes / 121)) * this.gateVis[k] * (inp.reveal >= h.t || inp.reduced ? 1 : 0);
      _scale.set(r, r, r);
      _mat.compose(_pos, _quat, _scale);
      this.gates.setMatrixAt(k, _mat);
    }
    this.gates.instanceMatrix.needsUpdate = true;
  }

  /** Position monde d'une perle (apres update). */
  positionOf(index: number, out: Vector3): Vector3 {
    return out.set(this.positions[index * 3], this.positions[index * 3 + 1], this.positions[index * 3 + 2]);
  }

  get trackCount(): number {
    return TRACK_COUNT;
  }

  dispose(): void {
    this.geom.dispose();
    this.gateGeom.dispose();
    this.material.dispose();
    this.gateMaterial.dispose();
    this.mesh.dispose();
    this.gates.dispose();
  }
}
