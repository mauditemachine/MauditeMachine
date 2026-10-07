/**
 * Les potards de la face du MM-VOYAGER (2026-10-03 ; les TWEAKS, sous le capot : tweaks.ts), facon Moog : jupe
 * d'aluminium large et fine a la base, capuchon noir cannele (24
 * cannelures, le haut un peu plus etroit), repere blanc du centre vers
 * l'arriere. UN InstancedMesh, une geometrie a couleurs de sommets. Meme
 * course que les encodeurs de la 808 : 270 deg centres sur le repere,
 * sens horaire quand la valeur monte ; un potard a crans tombe sur ses
 * crans (la valeur du store est deja ronde). Un commutateur (MODE du
 * filtre, 2026-10-04) : un petit potard, 150 deg pour ses quatre positions
 * (switchThrowDeg).
 *
 * Le mesh est sur le capot (lid) : les potards du panneau y passent par la
 * pose fixe du panneau (VOY_PANEL), ceux du plateau (portrait :
 * l'arpegiateur, VOLUME) s'y posent directement.
 *
 * Les rangees d'oscillateurs facon Mini V (2026-10-04) : RANGE tourne sur
 * 180 deg (ses six crans), les commutateurs sur leur course
 * (knobThrowDeg). SEMI et FINE ont perdu leur capuchon chrome le meme
 * jour (Mika : "les boutons sont d'une autre couleur, j'aimerais que ce
 * soit la meme chose que les autres").
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
import { LIT, TEMPO_UI } from '../theme';
import { VOY_FACE_KNOBS, type VoyKnobId } from './params';
import { VOY_KNOB, VOY_PANEL, VOY_SWITCH, isSwitch, knobThrowDeg, voyKnobPlace } from './theme';

const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
/** Le panneau dans le repere du capot (rig.ts le pose pareil). */
const PANEL_M = new Matrix4().compose(new Vector3(0, VOY_PANEL.cy, VOY_PANEL.cz), new Quaternion().setFromEuler(new Euler(VOY_PANEL.angle, 0, 0)), new Vector3(1, 1, 1));

export function buildKnobGeometry(mobile: boolean): BufferGeometry {
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
  private angle = new Map<VoyKnobId, number>();

  constructor(opts: { mobile: boolean; castShadow: boolean }) {
    // Un peu de metal : la jupe d'aluminium accroche la lumiere, le capuchon reste mat
    this.material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.28 });
    this.material.name = 'voyKnob';
    this.mesh = new InstancedMesh(buildKnobGeometry(opts.mobile), this.material, VOY_FACE_KNOBS.length);
    this.mesh.name = 'voyKnobs';
    this.mesh.castShadow = opts.castShadow;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    for (const k of VOY_FACE_KNOBS) this.place(k.id);
  }

  private place(id: VoyKnobId): void {
    const i = VOY_FACE_KNOBS.findIndex((k) => k.id === id);
    if (i < 0) return;
    const pl = voyKnobPlace(id);
    quat.setFromAxisAngle(AXIS_Y, this.angle.get(id) ?? 0);
    m4.compose(pos.set(pl.x, 0, pl.z), quat, scl.setScalar(pl.s));
    if (pl.where === 'panel') m4.premultiply(PANEL_M);
    this.mesh.setMatrixAt(i, m4);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Valeur 0 a 1 -> angle ; true s'il faut une frame. */
  setValue(id: VoyKnobId, v: number): boolean {
    const k = VOY_FACE_KNOBS.find((x) => x.id === id);
    if (!k) return false;
    const n = k.steps?.length ?? 2;
    const a = Math.fround(potAngle(v) * (knobThrowDeg(id, n) / TEMPO_UI.sweepDeg));
    if (this.angle.get(id) === a) return false;
    this.angle.set(id, a);
    this.place(id);
    return true;
  }

  /** Les potards pour le picking : un cylindre de la jupe, jusqu'au haut du capuchon ; repere de leur plan. */
  hotspots(panel: Object3D, deck: Object3D): HotspotDef[] {
    return VOY_FACE_KNOBS.map((k) => {
      const pl = voyKnobPlace(k.id);
      // Un commutateur se prend aussi par ses reperes (12, 24) : sa cible deborde
      // Au telephone, au moins la demi-colonne (2026-10-07) : un doigt l'attrape sans viser la jupe
      const r = Math.max(VOY_KNOB.touchR, VOY_KNOB.skirt.r * pl.s + (isSwitch(k.id) ? VOY_SWITCH.markR * 0.6 : 0));
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
    return {
      ids: VOY_FACE_KNOBS.map((k) => k.id),
      angleDeg: VOY_FACE_KNOBS.map((k) => +(((this.angle.get(k.id) ?? 0) * 180) / Math.PI).toFixed(2)),
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.material.dispose();
  }
}
