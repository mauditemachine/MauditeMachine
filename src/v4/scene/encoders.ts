/**
 * Les encodeurs noirs a repere blanc (spec 20.3.7) : MASTER, TEMPO et les
 * rangees GLOBAL et VOICE (celle-ci a l'echelle ENCODER.voiceScale). UN
 * InstancedMesh, une geometrie fusionnee a couleurs de sommets : corps legerement conique
 * (le haut plus etroit : un chanfrein), repere bone sur le dessus, du
 * centre vers l'arriere, collerette a la base. L'angle tourne autour de la
 * normale du panneau (y du repere panneau) : 270 deg de course centres sur
 * le repere a midi, sens horaire quand la valeur monte (section 19). Les
 * animations n'existent pas : l'angle suit la valeur.
 *
 * Jupe (2026-10-03, Mika : "ce genre de stroke dans la 808") : a la place
 * de la collerette sombre, l'anneau d'aluminium biseaute des potards du
 * MM-VOYAGER (meme teinte, meme matiere un peu metallique), un second
 * InstancedMesh immobile (la jupe ne tourne pas).
 */

import {
  BoxGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ENCODER, ENCODERS, LIT, MATERIAL, TEMPO_UI, encPos, type EncId } from '../theme';
import type { HotspotDef } from './hit';
import { paintLinear, paintSolid } from './materials';

const DEG = Math.PI / 180;
const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();

/**
 * Angle d'un encodeur pour une course t de 0 a 1 : 270 deg centres sur le
 * repere a 0, +135 (sept heures et demie) au minimum, -135 (quatre heures
 * et demie) au maximum : sens horaire quand la valeur monte (section 19).
 */
export function potAngle(t: number): number {
  const c = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  return (TEMPO_UI.sweepDeg / 2 - TEMPO_UI.sweepDeg * c) * DEG;
}

function buildGeometry(mobile: boolean): BufferGeometry {
  const E = ENCODER;
  const seg = mobile ? E.segments.mobile : E.segments.desktop;
  const body = new CylinderGeometry(E.rTop, E.r, E.h, seg);
  body.translate(0, E.h / 2, 0);
  const mark = new BoxGeometry(E.mark.w, E.mark.h, E.mark.d);
  // Du centre vers l'arriere (-z), pose sur le dessus
  mark.translate(0, E.h + E.mark.h / 2 - 0.002, -E.mark.d / 2);
  const parts = [body, mark].map((g) => {
    const out = g.toNonIndexed();
    g.dispose();
    out.deleteAttribute('uv');
    return out;
  });
  paintSolid(parts[0], 'encoder');
  paintLinear(parts[1], LIT.mark);
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error('encoders: merge failed');
  return g;
}

/** La jupe d'aluminium : un disque biseaute a la base de l'encodeur. */
function skirtGeometry(mobile: boolean): BufferGeometry {
  const C = ENCODER.skirt;
  const g = new CylinderGeometry(C.rTop, C.r, C.h, mobile ? ENCODER.segments.mobile + 12 : ENCODER.segments.desktop + 16);
  g.translate(0, C.h / 2, 0);
  const out = g.toNonIndexed();
  g.dispose();
  out.deleteAttribute('uv');
  paintSolid(out, 'voySkirt');
  return out;
}

export interface EncodersInfo {
  ids: EncId[];
  /** angles en degres */
  angleDeg: number[];
  /** course 0 a 1 */
  values: number[];
}

export class Encoders {
  readonly mesh: InstancedMesh;
  /** les jupes d'aluminium (immobiles) */
  readonly skirts: InstancedMesh;
  private material: MeshStandardMaterial;
  private skirtMat: MeshStandardMaterial;
  private angle = new Float32Array(ENCODERS.length);
  private value = new Float32Array(ENCODERS.length);

  constructor(opts: { mobile: boolean; castShadow: boolean }) {
    this.material = new MeshStandardMaterial({ vertexColors: true, ...MATERIAL.encoder });
    this.material.name = 'encoder';
    this.mesh = new InstancedMesh(buildGeometry(opts.mobile), this.material, ENCODERS.length);
    this.mesh.name = 'encoders';
    this.mesh.castShadow = opts.castShadow;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    // La jupe : la matiere de celle du MM-VOYAGER (voyager/knobs.ts)
    this.skirtMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.28 });
    this.skirtMat.name = 'encoderSkirt';
    this.skirts = new InstancedMesh(skirtGeometry(opts.mobile), this.skirtMat, ENCODERS.length);
    this.skirts.name = 'encoderSkirts';
    this.skirts.receiveShadow = true;
    for (let i = 0; i < ENCODERS.length; i += 1) {
      const p = encPos(i);
      this.skirts.setMatrixAt(i, m4.compose(pos.set(p.x, 0, p.z), quat.identity(), scl.setScalar(p.s)));
      this.place(i);
    }
    this.skirts.instanceMatrix.needsUpdate = true;
  }

  private index(id: EncId): number {
    for (let i = 0; i < ENCODERS.length; i += 1) if (ENCODERS[i].id === id) return i;
    return -1;
  }

  private place(i: number): void {
    quat.setFromAxisAngle(AXIS_Y, this.angle[i]);
    const p = encPos(i);
    // La rangee VOICE, plus petite (ENCODER.voiceScale)
    this.mesh.setMatrixAt(i, m4.compose(pos.set(p.x, 0, p.z), quat, scl.setScalar(p.s)));
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Course t (0 a 1) -> angle ; true s'il faut une frame. */
  setValue(id: EncId, t: number): boolean {
    const i = this.index(id);
    if (i < 0) return false;
    const a = potAngle(t);
    // La valeur d'abord : TONE et STRETCH au centre ont deja leur angle de depart
    this.value[i] = t;
    if (this.angle[i] === Math.fround(a)) return false;
    this.angle[i] = a;
    this.place(i);
    return true;
  }

  /** L'encodeur pour le picking : un cylindre de son rayon, 0 a 0.42 (a son echelle). */
  hotspot(id: EncId, layer: Object3D): HotspotDef {
    const i = this.index(id);
    if (i < 0) throw new Error(`encoders: unknown ${id}`);
    const p = encPos(i);
    return {
      id: `enc-${id}`,
      kind: 'encoder',
      layer,
      shape: 'disc',
      x: p.x,
      z: p.z,
      hx: ENCODER.r * p.s,
      hz: ENCODER.r * p.s,
      y0: 0,
      y1: ENCODER.h * p.s,
      enabled: true,
      param: id,
    };
  }

  info(): EncodersInfo {
    return {
      ids: ENCODERS.map((e) => e.id),
      angleDeg: Array.from(this.angle, (a) => +(a / DEG).toFixed(2)),
      values: Array.from(this.value, (v) => +v.toFixed(4)),
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
    this.skirts.geometry.dispose();
    this.skirtMat.dispose();
    this.skirts.dispose();
  }
}
