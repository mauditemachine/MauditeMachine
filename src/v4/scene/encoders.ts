/**
 * Les encodeurs noirs a repere blanc (spec 20.3.7) : depuis le 2026-10-08 (la
 * refonte facon Digitakt), les huit potards de page A a H sous l'ecran
 * (theme.ts FACE_KNOBS ; les rangees GLOBAL FX et VOICE FX sont parties sur
 * les pages). Un potard de page tourne a la course de ce qu'il regle sur la
 * page affichee : son repere suit la page (setValue depuis le Stage), le
 * nombre qui compte est a l'ecran. UN InstancedMesh, une geometrie fusionnee
 * a couleurs de sommets : corps legerement conique (le haut plus etroit : un
 * chanfrein), repere bone sur le dessus, du centre vers l'arriere. L'angle
 * tourne autour de la normale du panneau (y du repere panneau) : 270 deg de
 * course centres sur le repere a midi, sens horaire quand la valeur monte
 * (section 19). Les animations n'existent pas : l'angle suit la valeur.
 *
 * Jupe (2026-10-03, Mika : "ce genre de stroke dans la 808") : a la place
 * de la collerette sombre, l'anneau d'aluminium biseaute des potards du
 * MM-VOYAGER (meme teinte, meme matiere un peu metallique), un second
 * InstancedMesh immobile (la jupe ne tourne pas).
 *
 * MASTER et TEMPO ont ete des potards d'aluminium au-dessus des voix du
 * 2026-10-09 au 2026-10-19 ; ils sont dessines dans l'ecran depuis (Mika :
 * "mets ces boutons dans l'ecran en mobile et en desktop, je voudrais qu'ils
 * soient mieux faits" ; scene/screen.ts, les zones lcd-master et lcd-tempo).
 * Il ne reste ici que les huit encodeurs, au telephone aussi depuis le meme
 * jour (deux rangees de quatre, theme.ts FACE_KNOBS) : leur zone y couvre toute
 * leur colonne, 44 px de haut (PAGE_KNOBS.hitW, hitD), le doigt.
 *
 * L'anneau de valeur (2026-10-27, la face V.4.0 du desktop, Mika : "la machine
 * aura des potards motorises qui suivent la valeur") : 27 segments a plat autour
 * de chaque capuchon (theme.ts KNOB_RING), un seul InstancedMesh de 216 segments
 * non eclaires (un draw call), leur couleur par instance : la fente eteinte,
 * l'orange des pas mis allume, le dernier en partie. setValue l'ecrit avec
 * l'angle : l'anneau suit la valeur comme le potard motorise la suivra. Le
 * telephone n'en a pas (opts.rings).
 */

import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, DynamicDrawUsage, InstancedMesh, LatheGeometry, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, RingGeometry, Vector2, Vector3, BufferGeometry, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLOR, ENCODER, FACE_KNOBS, GLOBAL_ENCODERS, HOVER_LIGHT, KNOB_RING, LIT, MATERIAL, PAGE_KNOBS, PORTRAIT, TEMPO_UI, gainOf, isBipolar, pageKnobIndex, type FaceKnobId } from '../theme';
import type { HotspotDef } from './hit';
import { paintLinear, paintSolid } from './materials';

const DEG = Math.PI / 180;
const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
const tint = new Color();

/**
 * Angle d'un encodeur pour une course t de 0 a 1 : 270 deg centres sur le
 * repere a 0, +135 (sept heures et demie) au minimum, -135 (quatre heures
 * et demie) au maximum : sens horaire quand la valeur monte (section 19).
 */
export function potAngle(t: number): number {
  const c = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  return (TEMPO_UI.sweepDeg / 2 - TEMPO_UI.sweepDeg * c) * DEG;
}

/** Une geometrie non indexee, sans uv (les couleurs de sommets la peignent). */
function flat(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone();
  g.dispose();
  out.deleteAttribute('uv');
  return out;
}

/**
 * Le corps (2026-10-22) : le flanc cannele (un tour, ses creux en cos^2 comme le MM-ARP, voyager/knobs.ts), le chanfrein
 * du haut et le dessus plat, trois tours a part : chacun ses normales, les aretes restent nettes.
 */
function bodyParts(seg: number): BufferGeometry[] {
  const E = ENCODER;
  const c = E.chamfer;
  const wall = new LatheGeometry([new Vector2(E.r, 0), new Vector2(E.rTop, E.h - c)], seg);
  const p = wall.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const k = 1 - (E.fluteDepth / r) * Math.max(0, Math.cos(Math.atan2(z, x) * E.flutes)) ** 2;
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  wall.computeVertexNormals();
  const chamfer = new LatheGeometry([new Vector2(E.rTop, E.h - c), new Vector2(E.rTop - c, E.h)], seg);
  const top = new CircleGeometry(E.rTop - c, seg);
  top.rotateX(-Math.PI / 2);
  top.translate(0, E.h, 0);
  return [wall, chamfer, top];
}

function buildGeometry(mobile: boolean): BufferGeometry {
  const E = ENCODER;
  const seg = mobile ? E.segments.mobile : E.segments.desktop;
  const mark = new BoxGeometry(E.mark.w, E.mark.h, E.mark.d);
  // Du centre vers l'arriere (-z), pose sur le dessus
  mark.translate(0, E.h + E.mark.h / 2 - 0.002, -E.mark.d / 2);
  const parts = [...bodyParts(seg), mark].map(flat);
  paintSolid(parts[0], 'encoder');
  paintSolid(parts[1], 'encoder', gainOf('encoder') * E.chamferGain);
  paintSolid(parts[2], 'encoder');
  paintLinear(parts[3], LIT.mark);
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
  const out = flat(g);
  paintSolid(out, 'voySkirt');
  return out;
}

/** Un segment de l'anneau (2026-10-27) : un secteur a plat, son milieu vers l'arriere (-z, midi : le repere a mi-course). */
function ringSegment(): BufferGeometry {
  const R = KNOB_RING;
  const a = ((TEMPO_UI.sweepDeg / R.segments - R.airDeg) * Math.PI) / 180;
  const g = new RingGeometry(R.r0, R.r1, 4, 1, Math.PI / 2 - a / 2, a);
  // (cos t, sin t, 0) -> (cos t, 0, -sin t) : a plat, face vers le haut
  g.rotateX(-Math.PI / 2);
  g.translate(0, R.y, 0);
  g.deleteAttribute('uv');
  return g;
}

/**
 * La part allumee du segment j (0 a 26) pour une course t : de 0 a t ; a zero au centre, du milieu a t, le segment du
 * milieu toujours a KNOB_RING.center au moins.
 */
export function ringLit(j: number, t: number, bipolar: boolean): number {
  const n = KNOB_RING.segments;
  const v = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) * n : 0;
  const mid = n / 2;
  const lo = bipolar ? Math.min(mid, v) : 0;
  const hi = bipolar ? Math.max(mid, v) : v;
  const f = Math.min(1, Math.max(0, Math.min(hi, j + 1) - Math.max(lo, j)));
  return bipolar && j === Math.floor(mid) ? Math.max(f, KNOB_RING.center) : f;
}

export interface EncodersInfo {
  ids: FaceKnobId[];
  /** angles en degres */
  angleDeg: number[];
  /** course 0 a 1 */
  values: number[];
  /** l'anneau de valeur (2026-10-27) : la somme des parts allumees de ses 27 segments, par potard ; [] sans anneaux */
  ring: number[];
}

export class Encoders {
  /** les huit encodeurs (au telephone aussi depuis le 2026-10-19) */
  readonly mesh: InstancedMesh;
  /** leurs jupes d'aluminium (immobiles) */
  readonly skirts: InstancedMesh;
  private material: MeshStandardMaterial;
  private skirtMat: MeshStandardMaterial;
  private angle = new Float32Array(FACE_KNOBS.length);
  private value = new Float32Array(FACE_KNOBS.length);
  /** l'encodeur sous la souris (2026-10-22, HOVER_LIGHT), -1 aucun */
  private hover = -1;
  /** les anneaux de valeur (2026-10-27, la face V.4.0 du desktop) ; null au telephone */
  readonly rings: InstancedMesh | null = null;
  private ringMat: MeshBasicMaterial | null = null;
  /** la course que montre chaque anneau (NaN : pas encore peint) et la part allumee de chaque segment */
  private ringT = new Float32Array(FACE_KNOBS.length).fill(Number.NaN);
  private ringPart = new Float32Array(FACE_KNOBS.length * KNOB_RING.segments);
  private ringOff = new Color();
  private ringOn = new Color();

  constructor(opts: { mobile: boolean; castShadow: boolean; rings?: boolean }) {
    const n = FACE_KNOBS.length;
    this.material = new MeshStandardMaterial({ vertexColors: true, ...MATERIAL.encoder });
    this.material.name = 'encoder';
    this.mesh = new InstancedMesh(buildGeometry(opts.mobile), this.material, n);
    this.mesh.name = 'encoders';
    this.mesh.castShadow = opts.castShadow;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    // La jupe : la matiere de celle du MM-VOYAGER (voyager/knobs.ts)
    this.skirtMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.28 });
    this.skirtMat.name = 'encoderSkirt';
    this.skirts = new InstancedMesh(skirtGeometry(opts.mobile), this.skirtMat, n);
    this.skirts.name = 'encoderSkirts';
    this.skirts.receiveShadow = true;
    for (let i = 0; i < n; i += 1) {
      const p = FACE_KNOBS[i];
      this.skirts.setMatrixAt(i, m4.compose(pos.set(p.x, 0, p.z), quat.identity(), scl.setScalar(p.s)));
      this.place(i);
    }
    this.skirts.instanceMatrix.needsUpdate = true;
    // Une couleur par instance (le survol, 2026-10-22) : blanche, la teinte des sommets
    for (let i = 0; i < n; i += 1) {
      this.mesh.setColorAt(i, tint.setScalar(1));
      this.skirts.setColorAt(i, tint.setScalar(1));
    }
    this.mesh.instanceColor?.setUsage(DynamicDrawUsage);
    this.skirts.instanceColor?.setUsage(DynamicDrawUsage);
    if (opts.rings) {
      // Les anneaux (2026-10-27) : la fente eteinte (line), l'orange des pas mis (ledSet) ; non eclaires, comme les temoins
      const S = KNOB_RING.segments;
      this.ringOff.setHex(COLOR.line);
      this.ringOn.setHex(COLOR.ledSet);
      this.ringMat = new MeshBasicMaterial({ toneMapped: false });
      this.ringMat.name = 'knobRing';
      const rings = new InstancedMesh(ringSegment(), this.ringMat, n * S);
      rings.name = 'knobRings';
      rings.receiveShadow = false;
      for (let i = 0; i < n; i += 1) {
        const p = FACE_KNOBS[i];
        for (let j = 0; j < S; j += 1) {
          quat.setFromAxisAngle(AXIS_Y, potAngle((j + 0.5) / S));
          rings.setMatrixAt(i * S + j, m4.compose(pos.set(p.x, 0, p.z), quat, scl.setScalar(1)));
          rings.setColorAt(i * S + j, tint.copy(this.ringOff));
        }
      }
      rings.instanceMatrix.needsUpdate = true;
      rings.instanceColor?.setUsage(DynamicDrawUsage);
      this.rings = rings;
    }
  }

  /** L'anneau du potard i a la course t : ses 27 segments ; true s'il a change. */
  private paintRing(i: number, t: number): boolean {
    const r = this.rings;
    if (!r || this.ringT[i] === Math.fround(t)) return false;
    this.ringT[i] = t;
    const S = KNOB_RING.segments;
    const id = GLOBAL_ENCODERS[i];
    const bip = id !== undefined && isBipolar(id);
    let changed = false;
    for (let j = 0; j < S; j += 1) {
      const f = ringLit(j, t, bip);
      const k = i * S + j;
      if (Math.abs(this.ringPart[k] - f) < 1e-4) continue;
      this.ringPart[k] = f;
      r.setColorAt(k, tint.copy(this.ringOff).lerp(this.ringOn, f));
      changed = true;
    }
    if (changed && r.instanceColor) r.instanceColor.needsUpdate = true;
    return changed;
  }

  /** L'encodeur k sous la souris (-1 aucun) : un peu plus clair, sa jupe aussi ; true s'il faut une frame. */
  setHover(k: number): boolean {
    if (k === this.hover) return false;
    for (const i of [this.hover, k]) {
      if (i < 0 || i >= FACE_KNOBS.length) continue;
      const on = i === k;
      this.mesh.setColorAt(i, tint.setScalar(on ? HOVER_LIGHT.knob : 1));
      this.skirts.setColorAt(i, tint.setScalar(on ? HOVER_LIGHT.skirt : 1));
    }
    this.hover = k;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (this.skirts.instanceColor) this.skirts.instanceColor.needsUpdate = true;
    return true;
  }

  /** Les maillages a poser sur le plateau. */
  objects(): Object3D[] {
    return this.rings ? [this.mesh, this.skirts, this.rings] : [this.mesh, this.skirts];
  }

  private index(id: FaceKnobId): number {
    for (let i = 0; i < FACE_KNOBS.length; i += 1) if (FACE_KNOBS[i].id === id) return i;
    return -1;
  }

  private place(i: number): void {
    quat.setFromAxisAngle(AXIS_Y, this.angle[i]);
    const p = FACE_KNOBS[i];
    this.mesh.setMatrixAt(i, m4.compose(pos.set(p.x, 0, p.z), quat, scl.setScalar(p.s)));
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Course t (0 a 1) -> angle ; true s'il faut une frame. */
  setValue(id: FaceKnobId, t: number): boolean {
    const i = this.index(id);
    if (i < 0) return false;
    const a = potAngle(t);
    // La valeur d'abord : TONE et STRETCH au centre ont deja leur angle de depart
    this.value[i] = t;
    // L'anneau suit la valeur (2026-10-27), meme quand l'angle n'a pas bouge (le premier dessin)
    const ring = this.paintRing(i, t);
    if (this.angle[i] === Math.fround(a)) return ring;
    this.angle[i] = a;
    this.place(i);
    return true;
  }

  /**
   * L'encodeur pour le picking (penc-0 a penc-7, kind penc, son rang dans
   * index) : au desktop un cylindre de son rayon, a son echelle ; au telephone
   * (2026-10-19) une zone a plat sur toute sa colonne, 44 px de haut, du dessus
   * de son nom au bas de la rangee (PAGE_KNOBS.hitW, hitD, hitUp).
   */
  hotspot(id: FaceKnobId, layer: Object3D): HotspotDef {
    const i = this.index(id);
    if (i < 0) throw new Error(`encoders: unknown ${id}`);
    const p = FACE_KNOBS[i];
    const k = pageKnobIndex(id);
    if (PORTRAIT) {
      const K = PAGE_KNOBS;
      return { id: `penc-${k}`, kind: 'penc', layer, shape: 'box', x: p.x, z: p.z - K.hitUp + K.hitD / 2, hx: K.hitW / 2, hz: K.hitD / 2, y0: 0, y1: 0.02, enabled: true, index: k };
    }
    return { id: `penc-${k}`, kind: 'penc', layer, shape: 'disc', x: p.x, z: p.z, hx: ENCODER.r * p.s, hz: ENCODER.r * p.s, y0: 0, y1: ENCODER.h * p.s, enabled: true, index: k };
  }

  info(): EncodersInfo {
    return {
      ids: FACE_KNOBS.map((e) => e.id),
      angleDeg: Array.from(this.angle, (a) => +(a / DEG).toFixed(2)),
      values: Array.from(this.value, (v) => +v.toFixed(4)),
      ring: this.rings
        ? FACE_KNOBS.map((_, i) => {
            let sum = 0;
            for (let j = 0; j < KNOB_RING.segments; j += 1) sum += this.ringPart[i * KNOB_RING.segments + j];
            return Math.round(sum * 100) / 100;
          })
        : [],
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
    this.skirts.geometry.dispose();
    this.skirtMat.dispose();
    this.skirts.dispose();
    if (this.rings) {
      this.rings.geometry.dispose();
      this.rings.dispose();
    }
    this.ringMat?.dispose();
  }
}
