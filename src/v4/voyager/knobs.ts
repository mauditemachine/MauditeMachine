/**
 * Les 23 potards du MM-VOYAGER (2026-10-03), facon Moog : jupe
 * d'aluminium large et fine a la base, capuchon noir cannele (24
 * cannelures, le haut un peu plus etroit), repere blanc du centre vers
 * l'arriere. UN InstancedMesh, une geometrie a couleurs de sommets. Meme
 * course que les encodeurs de la 808 : 270 deg centres sur le repere,
 * sens horaire quand la valeur monte ; un potard a crans tombe sur ses
 * crans (la valeur du store est deja ronde).
 *
 * Le mesh est sur le capot (lid) : les potards du panneau y passent par la
 * pose fixe du panneau (VOY_PANEL), ceux du plateau (portrait :
 * l'arpegiateur, VOLUME) s'y posent directement.
 */

import {
  BoxGeometry,
  Euler,
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
import type { HotspotDef } from '../scene/hit';
import { potAngle } from '../scene/encoders';
import { paintLinear, paintSolid } from '../scene/materials';
import { LIT } from '../theme';
import { VOY_KNOBS, type VoyKnobId } from './params';
import { VOY_KNOB, VOY_PANEL, voyKnobPlace } from './theme';

const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
const COUNT = VOY_KNOBS.length;
/** Le panneau dans le repere du capot (rig.ts le pose pareil). */
const PANEL_M = new Matrix4().compose(new Vector3(0, VOY_PANEL.cy, VOY_PANEL.cz), new Quaternion().setFromEuler(new Euler(VOY_PANEL.angle, 0, 0)), new Vector3(1, 1, 1));

function buildGeometry(mobile: boolean): BufferGeometry {
  const K = VOY_KNOB;
  const seg = mobile ? K.segments.mobile : K.segments.desktop;
  // Jupe : un disque fin, son bord biseaute (rTop < r)
  const skirt = new CylinderGeometry(K.skirt.rTop, K.skirt.r, K.skirt.h, seg);
  skirt.translate(0, K.skirt.h / 2, 0);
  // Capuchon cannele : le rayon module par les cannelures (un creux par cannelure)
  const cap = new CylinderGeometry(K.rTop, K.r, K.h, seg, 1);
  const p = cap.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const a = Math.atan2(z, x);
    const k = 1 - (K.fluteDepth / r) * Math.max(0, Math.cos(a * K.flutes)) ** 2;
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  cap.computeVertexNormals();
  cap.translate(0, K.skirt.h + K.h / 2, 0);
  const mark = new BoxGeometry(K.mark.w, K.mark.h, K.mark.d);
  mark.translate(0, K.skirt.h + K.h + K.mark.h / 2 - 0.002, -K.mark.d / 2 - 0.02);
  const parts = [skirt, cap, mark].map((g) => {
    const out = g.toNonIndexed();
    g.dispose();
    out.deleteAttribute('uv');
    return out;
  });
  paintSolid(parts[0], 'voySkirt');
  paintSolid(parts[1], 'voyKnob');
  paintLinear(parts[2], LIT.mark);
  const g = mergeGeometries(parts, false);
  for (const q of parts) q.dispose();
  if (!g) throw new Error('voyager: knobs merge failed');
  return g;
}

export class VoyKnobs {
  readonly mesh: InstancedMesh;
  private material: MeshStandardMaterial;
  private angle = new Float32Array(COUNT);

  constructor(opts: { mobile: boolean; castShadow: boolean }) {
    // Un peu de metal : la jupe d'aluminium accroche la lumiere, le capuchon reste mat
    this.material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.28 });
    this.material.name = 'voyKnob';
    this.mesh = new InstancedMesh(buildGeometry(opts.mobile), this.material, COUNT);
    this.mesh.name = 'voyKnobs';
    this.mesh.castShadow = opts.castShadow;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    for (let i = 0; i < COUNT; i += 1) this.place(i);
  }

  private index(id: VoyKnobId): number {
    for (let i = 0; i < COUNT; i += 1) if (VOY_KNOBS[i].id === id) return i;
    return -1;
  }

  private place(i: number): void {
    const pl = voyKnobPlace(VOY_KNOBS[i].id);
    quat.setFromAxisAngle(AXIS_Y, this.angle[i]);
    m4.compose(pos.set(pl.x, 0, pl.z), quat, scl.setScalar(pl.s));
    if (pl.where === 'panel') m4.premultiply(PANEL_M);
    this.mesh.setMatrixAt(i, m4);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Valeur 0 a 1 -> angle ; true s'il faut une frame. */
  setValue(id: VoyKnobId, v: number): boolean {
    const i = this.index(id);
    if (i < 0) return false;
    const a = Math.fround(potAngle(v));
    if (this.angle[i] === a) return false;
    this.angle[i] = a;
    this.place(i);
    return true;
  }

  /** Les potards pour le picking : un cylindre de la jupe, jusqu'au haut du capuchon ; repere de leur plan. */
  hotspots(panel: Object3D, deck: Object3D): HotspotDef[] {
    return VOY_KNOBS.map((k) => {
      const pl = voyKnobPlace(k.id);
      const r = VOY_KNOB.skirt.r * pl.s;
      return {
        id: `vk-${k.id}`,
        kind: 'vknob' as const,
        layer: pl.where === 'panel' ? panel : deck,
        shape: 'disc' as const,
        x: pl.x,
        z: pl.z,
        hx: r,
        hz: r,
        y0: 0,
        y1: (VOY_KNOB.skirt.h + VOY_KNOB.h) * pl.s,
        enabled: true,
        vknob: k.id,
      };
    });
  }

  info(): { ids: VoyKnobId[]; angleDeg: number[] } {
    return { ids: VOY_KNOBS.map((k) => k.id), angleDeg: Array.from(this.angle, (a) => +((a * 180) / Math.PI).toFixed(2)) };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
