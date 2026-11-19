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
 *
 * SUB OCT n'est plus un potard depuis le 2026-10-11 : un bouton poussoir
 * (voyager/pads.ts VoyKeys, theme.ts isPush) ; DIALS, les potards de la face
 * sans lui.
 */

import {
  BoxGeometry,
  Euler,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshPhysicalMaterial,
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
import { LIT, MATERIAL, PLUGIN_ARP, PORTRAIT, TEMPO_UI } from '../theme';
import { rytmKnobGeometry, rytmKnobTexture, rytmKnobTopGeometry, studioEnv } from './rytmKnob';
import { VOY_FACE_KNOBS, type VoyKnobId } from './params';
import { VOY_KNOB, VOY_PANEL, VOY_SWITCH, isPush, isSwitch, knobThrowDeg, voyKnobPlace } from './theme';

const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
/** Le panneau dans le repere du capot (rig.ts le pose pareil). */
const PANEL_M = new Matrix4().compose(new Vector3(0, VOY_PANEL.cy, VOY_PANEL.cz), new Quaternion().setFromEuler(new Euler(VOY_PANEL.angle, 0, 0)), new Vector3(1, 1, 1));
/** Les potards de la face, sans les boutons poussoirs (SUB OCT, 2026-10-11). */
const DIALS = VOY_FACE_KNOBS.filter((k) => !isPush(k.id));
/** v27 (le plugin) : les potards rendus en petits knobs canneles 3D (plugin/arp/faceExtras.tsx) : caches ici, leurs zones de prise restent. */
export const FLUTED_DIALS: ReadonlySet<VoyKnobId> = new Set<VoyKnobId>(PLUGIN_ARP ? ['fm', 'ratio', 'osc1', 'osc2', 'noise', 'sub', 'subWave'] : []);

/**
 * La moitie de l'ecart au plus proche voisin de la meme rangee (meme plan, z a 0.3 pres ; les poussoirs compris), en
 * unites : la demi-colonne d'un potard (2026-10-22, ses zones au telephone).
 */
function rowHalfGap(id: VoyKnobId): number {
  const me = voyKnobPlace(id);
  let gap = Infinity;
  for (const k of VOY_FACE_KNOBS) {
    if (k.id === id) continue;
    const o = voyKnobPlace(k.id);
    if (o.where !== me.where || Math.abs(o.z - me.z) > 0.3) continue;
    gap = Math.min(gap, Math.abs(o.x - me.x));
  }
  return Number.isFinite(gap) ? gap / 2 : 0;
}

export function buildKnobGeometry(mobile: boolean, withMark = true): BufferGeometry {
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
  // Sans son repere (2026-11-16, le plugin MM-ARP : l'image du potard pour les pages d'OPEN, plugin/arp/hellKnob.tsx)
  const parts = (withMark ? [skirt, cap, mark] : [skirt, cap]).map((g) => {
    const out = g.toNonIndexed();
    g.dispose();
    out.deleteAttribute('uv');
    return out;
  });
  paintSolid(parts[0], 'voySkirt');
  paintSolid(parts[1], 'voyKnob');
  if (withMark) paintLinear(parts[2], LIT.mark);
  else mark.dispose();
  const g = mergeGeometries(parts, false);
  for (const q of parts) q.dispose();
  if (!g) throw new Error('voyager: knobs merge failed');
  return g;
}

export class VoyKnobs {
  readonly mesh: InstancedMesh;
  private material: MeshStandardMaterial | MeshPhysicalMaterial;
  /**
   * Le plugin MM-ARP (2026-11-16, Mika : "le design des knobs de MM-RYTM") : le potard du MM-RYTM (voyager/rytmKnob.ts),
   * mesh tourne (la prise, le repere), top ne tourne pas (la base et le dessus du capuchon, leurs reflets fixes). Au site :
   * null, le potard de toujours.
   */
  readonly top: InstancedMesh | null = null;
  private topMat: MeshStandardMaterial | null = null;
  private angle = new Map<VoyKnobId, number>();

  constructor(opts: { mobile: boolean; castShadow: boolean }) {
    if (PLUGIN_ARP) {
      // v33 (maquette, Mika : "des beaux knobs moog avec des reflets") : la jupe noire brillante (un vernis, clearcoat) et
      // le capuchon d'aluminium refletent un studio a softboxes (studioEnv) : les cannelures accrochent la lumiere en
      // tournant ; l'eclairage de la face ne change pas (la carte ne sert qu'a ces materiaux)
      const env = studioEnv();
      // v36 (Mika : "ya un reflet sur le top du knob, un coin argente") : le studio 4 fois moins fort sur la jupe (1.8 -> 0.45) :
      // la softbox ne fait plus une tache argentee sur la crete des lobes, la jupe reste noire et vernie
      this.material = new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.2, envMap: env, envMapIntensity: 0.45 });
      this.material.name = 'voyKnobRytm';
      this.mesh = new InstancedMesh(rytmKnobGeometry(opts.mobile), this.material, DIALS.length);
      // la prise ne recoit pas l'ombre du capuchon (comme au MM-RYTM : un gris egal)
      this.mesh.receiveShadow = false;
      this.topMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.5, map: rytmKnobTexture(), envMap: env, envMapIntensity: 1.4 });
      this.topMat.name = 'voyKnobRytmTop';
      const top = new InstancedMesh(rytmKnobTopGeometry(opts.mobile), this.topMat, DIALS.length);
      top.name = 'voyKnobTops';
      top.receiveShadow = false;
      top.castShadow = opts.castShadow;
      this.top = top;
      this.mesh.add(top);
    } else {
      // Un peu de metal : la jupe d'aluminium accroche la lumiere, le capuchon reste mat
      this.material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.28 });
      this.material.name = 'voyKnob';
      this.mesh = new InstancedMesh(buildKnobGeometry(opts.mobile), this.material, DIALS.length);
      this.mesh.receiveShadow = true;
    }
    this.mesh.name = 'voyKnobs';
    this.mesh.castShadow = opts.castShadow;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    for (const k of DIALS) this.place(k.id);
    if (this.top) {
      for (const k of DIALS) {
        const i = DIALS.findIndex((x) => x.id === k.id);
        const pl = voyKnobPlace(k.id);
        m4.compose(pos.set(pl.x, 0, pl.z), quat.identity(), scl.setScalar(FLUTED_DIALS.has(k.id) ? 0 : pl.s));
        if (pl.where === 'panel') m4.premultiply(PANEL_M);
        this.top.setMatrixAt(i, m4);
      }
      this.top.instanceMatrix.needsUpdate = true;
    }
  }

  private place(id: VoyKnobId): void {
    const i = DIALS.findIndex((k) => k.id === id);
    if (i < 0) return;
    const pl = voyKnobPlace(id);
    quat.setFromAxisAngle(AXIS_Y, this.angle.get(id) ?? 0);
    m4.compose(pos.set(pl.x, 0, pl.z), quat, scl.setScalar(FLUTED_DIALS.has(id) ? 0 : pl.s));
    if (pl.where === 'panel') m4.premultiply(PANEL_M);
    this.mesh.setMatrixAt(i, m4);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Valeur 0 a 1 -> angle ; true s'il faut une frame. */
  setValue(id: VoyKnobId, v: number): boolean {
    const k = DIALS.find((x) => x.id === id);
    if (!k) return false;
    const n = k.steps?.length ?? 2;
    const a = Math.fround(potAngle(v) * (knobThrowDeg(id, n) / TEMPO_UI.sweepDeg));
    if (PLUGIN_ARP) {
      // v33 : l'angle glisse vers sa cible (step : ~35 ms), les images a 60 par seconde pendant ce temps
      if (this.target.get(id) === a) return false;
      this.target.set(id, a);
      if (!this.angle.has(id)) {
        this.angle.set(id, a);
        this.place(id);
      }
      return true;
    }
    if (this.angle.get(id) === a) return false;
    this.angle.set(id, a);
    this.place(id);
    return true;
  }

  /** v33 (le plugin) : les angles vers leur cible ; true tant qu'un potard bouge (la boucle de rendu continue). */
  private target = new Map<VoyKnobId, number>();
  private stepAt = -1;
  step(now: number): boolean {
    const dt = this.stepAt < 0 ? 16 : Math.min(50, now - this.stepAt);
    this.stepAt = now;
    const k = 1 - Math.exp(-dt / 35);
    let moving = false;
    for (const [id, t] of this.target) {
      const a = this.angle.get(id) ?? t;
      if (a === t) continue;
      const n = Math.abs(t - a) < 1e-4 ? t : a + (t - a) * k;
      this.angle.set(id, n);
      this.place(id);
      if (n !== t) moving = true;
    }
    if (!moving) this.stepAt = -1;
    return moving || this.pending();
  }
  private pending(): boolean {
    for (const [id, t] of this.target) if (this.angle.get(id) !== t) return true;
    return false;
  }

  /** Les potards pour le picking : un cylindre de la jupe, jusqu'au haut du capuchon ; repere de leur plan. */
  hotspots(panel: Object3D, deck: Object3D): HotspotDef[] {
    return DIALS.map((k) => {
      const pl = voyKnobPlace(k.id);
      // Un commutateur se prend aussi par ses reperes (12, 24) : sa cible deborde
      // Au telephone, au moins la demi-colonne (2026-10-07) : un doigt l'attrape sans viser la jupe
      const r = Math.max(VOY_KNOB.touchR, VOY_KNOB.skirt.r * pl.s + (isSwitch(k.id) ? VOY_SWITCH.markR * 0.6 : 0));
      // Au telephone (2026-10-22, audit SB-03 : 33 x 35 px au pas de 29) : la zone descend jusque sous son nom, une boite
      // de la largeur du disque ; la voisine reste departagee par le centre le plus proche (hit.ts)
      const bottom = PORTRAIT ? Math.max(pl.z + r, pl.labelZ + 0.1) : pl.z + r;
      const box = bottom > pl.z + r + 1e-3;
      // et en largeur jusqu'au milieu de l'air avec ses voisins de rangee (la colonne entiere ; 0.02 de jour)
      const hx = box ? Math.max(r, rowHalfGap(k.id) - 0.02) : r;
      return {
        id: `vk-${k.id}`,
        kind: 'vknob' as const,
        layer: pl.where === 'panel' ? panel : deck,
        shape: box ? ('box' as const) : ('disc' as const),
        x: pl.x,
        z: box ? (pl.z - r + bottom) / 2 : pl.z,
        hx,
        hz: box ? (bottom - (pl.z - r)) / 2 : r,
        y0: 0,
        y1: (VOY_KNOB.skirt.h + VOY_KNOB.h) * pl.s,
        enabled: true,
        vknob: k.id,
      };
    });
  }

  info(): { ids: VoyKnobId[]; angleDeg: number[] } {
    return {
      ids: DIALS.map((k) => k.id),
      angleDeg: DIALS.map((k) => +(((this.angle.get(k.id) ?? 0) * 180) / Math.PI).toFixed(2)),
    };
  }

  dispose(): void {
    this.top?.geometry.dispose();
    this.top?.dispose();
    this.topMat?.dispose();
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.material.dispose();
  }
}
