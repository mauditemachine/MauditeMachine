/**
 * Knobs (spec 5.3) : trois InstancedMesh partages par tous les knobs du
 * plateau (huit : TEMPO, les cinq knobs de navigation, TONE, LEVEL). Corps :
 * cylindre de 0.42 x 0.5 et son repere bone fusionnes (couleurs de
 * sommets), echelle par instance. Capuchons : petit cylindre metal et sa
 * fente. Liseres : tores a plat, non eclaires (le jeton exact : jaune pour
 * la navigation, yellowHi au survol, line pour les potards). Le capuchon et
 * le lisere suivent le corps (angle, soulevement). Les animations (quart de
 * tour, soulevement) sont des tweens du Stage qui appellent setAngle et
 * setRise ; cette classe ne fait que poser les matrices.
 * Angles autour de +y : positif = sens anti-horaire vu du dessus.
 */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BPM } from '../audio/pattern';
import { COLOR, KNOB, LIT, RING_Y, SEGMENTS, TEMPO_UI, type Tone } from '../theme';
import type { NavId } from '../theme';
import type { HotspotDef, HotspotKind } from './hit';
import { paintLinear } from './materials';

export interface KnobSpec {
  id: string;
  x: number;
  z: number;
  /** echelle du corps (r, h, r) ; le lisere prend r, le capuchon ne change pas */
  scale: readonly number[];
  /** hauteur du capuchon (le dessus du corps) */
  capY: number;
  ring: Tone;
}

const DEG = Math.PI / 180;
const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
const col = new Color();

/** Repere du corps : sur le dessus, vers l'arriere (-z) a l'angle 0. */
const MARK = { w: 0.05, h: 0.02, d: 0.26, y: 0.505, z: -0.22 } as const;
const SLOT = { w: 0.02, h: 0.012, d: 0.2 } as const;

/**
 * Angle d'un potard pour une course t de 0 a 1 : 270 deg centres sur le
 * repere a 0, +135 (sept heures et demie) au minimum, -135 (quatre heures
 * et demie) au maximum : sens horaire quand la valeur monte (section 19).
 */
export function potAngle(t: number): number {
  const c = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  return (TEMPO_UI.sweepDeg / 2 - TEMPO_UI.sweepDeg * c) * DEG;
}

/** TEMPO : 100 BPM a +135, 150 BPM a -135. */
export function tempoAngle(bpm: number): number {
  return potAngle((bpm - BPM.min) / (BPM.max - BPM.min));
}

function merged(parts: BufferGeometry[], what: string): BufferGeometry {
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error(`knobs: ${what} merge failed`);
  return g;
}

function bodyGeometry(segments: number): BufferGeometry {
  const body = new CylinderGeometry(KNOB.r, KNOB.r, KNOB.h, segments);
  body.translate(0, KNOB.h / 2, 0);
  const mark = new BoxGeometry(MARK.w, MARK.h, MARK.d);
  mark.translate(0, MARK.y, MARK.z);
  for (const g of [body, mark]) g.deleteAttribute('uv');
  paintLinear(body, LIT.knob);
  paintLinear(mark, LIT.mark);
  return merged([body, mark], 'body');
}

function capGeometry(): BufferGeometry {
  const cap = new CylinderGeometry(KNOB.capR, KNOB.capR, KNOB.capH, SEGMENTS.cap);
  cap.translate(0, KNOB.capH / 2, 0);
  // Fente a moitie enfoncee dans le dessus du capuchon
  const slot = new BoxGeometry(SLOT.w, SLOT.h, SLOT.d);
  slot.translate(0, KNOB.capH, 0);
  for (const g of [cap, slot]) g.deleteAttribute('uv');
  paintLinear(cap, LIT.cap);
  paintLinear(slot, LIT.slot);
  return merged([cap, slot], 'cap');
}

function ringGeometry(segments: number): BufferGeometry {
  const g = new TorusGeometry(KNOB.r, KNOB.ringTube, 6, segments);
  // Tore couche sur le plateau
  g.rotateX(Math.PI / 2);
  g.deleteAttribute('uv');
  return g;
}

export interface KnobsInfo {
  ids: string[];
  /** angles en degres */
  angleDeg: number[];
  rise: number[];
  ring: Tone[];
}

export class Knobs {
  readonly bodies: InstancedMesh;
  readonly caps: InstancedMesh;
  readonly rings: InstancedMesh;
  private bodyMat: MeshStandardMaterial;
  private capMat: MeshStandardMaterial;
  private ringMat: MeshBasicMaterial;
  private angle: Float32Array;
  private rise: Float32Array;
  private ringTone: Tone[];

  constructor(
    private specs: readonly KnobSpec[],
    opts: { mobile: boolean; castShadow: boolean }
  ) {
    const count = specs.length;
    this.angle = new Float32Array(count);
    this.rise = new Float32Array(count);
    this.ringTone = specs.map((s) => s.ring);

    this.bodyMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0 });
    this.bodyMat.name = 'knob';
    this.bodies = new InstancedMesh(bodyGeometry(opts.mobile ? SEGMENTS.knob.mobile : SEGMENTS.knob.desktop), this.bodyMat, count);
    this.bodies.name = 'knobs';
    this.bodies.castShadow = opts.castShadow;
    this.bodies.receiveShadow = true;

    // Brief : roughness 0.55 a 0.8 partout, metalness 0.7 pour les axes (revue)
    this.capMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.7 });
    this.capMat.name = 'metal';
    this.caps = new InstancedMesh(capGeometry(), this.capMat, count);
    this.caps.name = 'caps';

    this.ringMat = new MeshBasicMaterial({ toneMapped: false });
    this.ringMat.name = 'ring';
    this.rings = new InstancedMesh(ringGeometry(opts.mobile ? SEGMENTS.ring.mobile : SEGMENTS.ring.desktop), this.ringMat, count);
    this.rings.name = 'rings';

    for (const mesh of [this.bodies, this.caps, this.rings]) mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    specs.forEach((s, i) => {
      this.place(i);
      this.rings.setColorAt(i, col.setHex(COLOR[s.ring]));
    });
    if (this.rings.instanceColor) this.rings.instanceColor.setUsage(DynamicDrawUsage);
  }

  private index(id: string): number {
    for (let i = 0; i < this.specs.length; i += 1) if (this.specs[i].id === id) return i;
    return -1;
  }

  /** Angle courant (radians), 0 pour un id inconnu. */
  angleOf(id: string): number {
    const i = this.index(id);
    return i < 0 ? 0 : this.angle[i];
  }

  /** Soulevement courant (unites). */
  riseOf(id: string): number {
    const i = this.index(id);
    return i < 0 ? 0 : this.rise[i];
  }

  /** Matrices du corps, du capuchon et du lisere de l'instance i. */
  private place(i: number): void {
    const s = this.specs[i];
    const y = this.rise[i];
    quat.setFromAxisAngle(AXIS_Y, this.angle[i]);
    this.bodies.setMatrixAt(i, m4.compose(pos.set(s.x, y, s.z), quat, scl.set(s.scale[0], s.scale[1], s.scale[2])));
    this.caps.setMatrixAt(i, m4.compose(pos.set(s.x, s.capY + y, s.z), quat, scl.set(1, 1, 1)));
    quat.identity();
    this.rings.setMatrixAt(i, m4.compose(pos.set(s.x, RING_Y + y, s.z), quat, scl.set(s.scale[0], 1, s.scale[2])));
    this.bodies.instanceMatrix.needsUpdate = true;
    this.caps.instanceMatrix.needsUpdate = true;
    this.rings.instanceMatrix.needsUpdate = true;
  }

  /** Angle autour de +y, en radians ; true s'il faut une frame. */
  setAngle(id: string, rad: number): boolean {
    const i = this.index(id);
    if (i < 0 || this.angle[i] === Math.fround(rad)) return false;
    this.angle[i] = rad;
    this.place(i);
    return true;
  }

  /** Soulevement (survol), en unites. */
  setRise(id: string, y: number): boolean {
    const i = this.index(id);
    if (i < 0 || this.rise[i] === Math.fround(y)) return false;
    this.rise[i] = y;
    this.place(i);
    return true;
  }

  setRing(id: string, tone: Tone): boolean {
    const i = this.index(id);
    if (i < 0 || this.ringTone[i] === tone) return false;
    this.ringTone[i] = tone;
    this.rings.setColorAt(i, col.setHex(COLOR[tone]));
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    return true;
  }

  /**
   * Le knob pour le picking : un cylindre de son rayon, capuchon compris.
   * hid : id du hotspot (knob-tracks...), section : la section qu'il ouvre.
   */
  hotspot(id: string, kind: HotspotKind, layer: Object3D, hid: string = id, section?: NavId): HotspotDef {
    const s = this.specs[this.index(id)];
    if (!s) throw new Error(`knobs: unknown ${id}`);
    const r = KNOB.r * s.scale[0];
    return {
      id: hid,
      kind,
      layer,
      shape: 'disc',
      x: s.x,
      z: s.z,
      hx: r,
      hz: r,
      y0: 0,
      y1: s.capY + KNOB.capH,
      enabled: true,
      ...(section ? { section } : {}),
    };
  }

  info(): KnobsInfo {
    return {
      ids: this.specs.map((s) => s.id),
      angleDeg: Array.from(this.angle, (a) => +(a / DEG).toFixed(2)),
      rise: Array.from(this.rise, (v) => +v.toFixed(4)),
      ring: [...this.ringTone],
    };
  }

  dispose(): void {
    for (const mesh of [this.bodies, this.caps, this.rings]) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.bodyMat.dispose();
    this.capMat.dispose();
    this.ringMat.dispose();
  }
}
