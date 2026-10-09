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
 * MASTER et TEMPO (2026-10-09, Mika : "j'aimerais que Master et Tempo soient
 * des knobs differents au dessus des voices pour me separer des 8
 * encoders") : une autre famille, au-dessus des voix (theme.ts MASTER_POTS,
 * POT) : un capuchon d'aluminium tourne, plus petit, son flanc cannele (une
 * cannelure sur deux un peu plus sombre), un chanfrein brillant, le dessus aux
 * cercles concentriques de l'aluminium tourne, un trait noir grave du centre
 * vers le bord, une rondelle noire a la base ; l'echelle est imprimee autour
 * (theme.ts SILK_MARKS). Un troisieme InstancedMesh, deux instances. Au
 * telephone (2026-10-09) il n'y a plus de potards de page sur la face : leur
 * maillage reste vide et cache, les blocs de l'ecran les remplacent.
 */

import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
  BufferGeometry,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ENCODER, FACE_KNOBS, LIT, MASTER_POTS, MATERIAL, POT, TEMPO_UI, isPageKnob, pageKnobIndex, type FaceKnobId } from '../theme';
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

/** Une geometrie non indexee, sans uv (les couleurs de sommets la peignent). */
function flat(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone();
  g.dispose();
  out.deleteAttribute('uv');
  return out;
}

function buildGeometry(mobile: boolean): BufferGeometry {
  const E = ENCODER;
  const seg = mobile ? E.segments.mobile : E.segments.desktop;
  const body = new CylinderGeometry(E.rTop, E.r, E.h, seg);
  body.translate(0, E.h / 2, 0);
  const mark = new BoxGeometry(E.mark.w, E.mark.h, E.mark.d);
  // Du centre vers l'arriere (-z), pose sur le dessus
  mark.translate(0, E.h + E.mark.h / 2 - 0.002, -E.mark.d / 2);
  const parts = [body, mark].map(flat);
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
  const out = flat(g);
  paintSolid(out, 'voySkirt');
  return out;
}

/**
 * L'aluminium des capuchons de MASTER et TEMPO (2026-10-09), en albedo
 * lineaire : le flanc (et ses cannelures plus sombres), le chanfrein qui
 * accroche la lumiere, les cercles du dessus, le trait grave (presque noir).
 * Cales a l'oeil sur les deux machines (la noire et la claire) : un argent
 * franc, jamais blanc.
 */
const ALU = {
  flank: [0.56, 0.58, 0.61],
  flute: [0.41, 0.425, 0.45],
  chamfer: [0.86, 0.88, 0.9],
  ringA: [0.58, 0.6, 0.63],
  ringB: [0.52, 0.54, 0.57],
  groove: [0.012, 0.012, 0.014],
} as const;

/** Peint une geometrie non indexee triangle par triangle (pick : le rang du triangle -> sa couleur). */
function paintTris(g: BufferGeometry, pick: (tri: number) => readonly number[]): void {
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let v = 0; v < n; v += 1) {
    const c = pick(Math.floor(v / 3));
    col[v * 3] = c[0];
    col[v * 3 + 1] = c[1];
    col[v * 3 + 2] = c[2];
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
}

/**
 * Le potard de MASTER et TEMPO, a l'echelle 1, pose a y 0 : la rondelle
 * noire, le flanc cannele, le chanfrein, le dessus en cercles concentriques
 * (un anneau sur deux un peu plus sombre : l'aluminium tourne) et le trait
 * grave vers l'arriere (-z), comme le repere des encodeurs.
 */
function potGeometry(mobile: boolean): BufferGeometry {
  const P = POT;
  const seg = mobile ? P.flutes.mobile : P.flutes.desktop;
  const y0 = P.base.h;
  const y1 = y0 + P.h;
  const y2 = y1 + P.chamferH;
  const base = new CylinderGeometry(P.base.r, P.base.r, P.base.h, seg);
  base.translate(0, P.base.h / 2, 0);
  const flank = new CylinderGeometry(P.rTop, P.r, P.h, seg, 1, true);
  flank.translate(0, y0 + P.h / 2, 0);
  const chamfer = new CylinderGeometry(P.topR, P.rTop, P.chamferH, seg, 1, true);
  chamfer.translate(0, y1 + P.chamferH / 2, 0);
  const tops: BufferGeometry[] = [];
  for (let i = 0; i < P.rings; i += 1) {
    const a = (P.topR * i) / P.rings;
    const b = (P.topR * (i + 1)) / P.rings;
    const g = i === 0 ? new CircleGeometry(b, seg) : new RingGeometry(a, b, seg, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, y2, 0);
    tops.push(g);
  }
  const markD = P.mark.r1 - P.mark.r0;
  const mark = new BoxGeometry(P.mark.w, 0.006, markD);
  mark.translate(0, y2 + 0.002, -(P.mark.r0 + markD / 2));
  const [b, f, c, m] = [base, flank, chamfer, mark].map(flat);
  paintSolid(b, 'encoder');
  // Une cannelure sur deux plus sombre : deux triangles par cannelure (le flanc n'a qu'une rangee)
  paintTris(f, (t) => (Math.floor(t / 2) % 2 === 0 ? ALU.flank : ALU.flute));
  paintLinear(c, ALU.chamfer);
  paintLinear(m, ALU.groove);
  const rings = tops.map(flat);
  rings.forEach((r, i) => paintLinear(r, i % 2 === 0 ? ALU.ringA : ALU.ringB));
  const parts = [b, f, c, ...rings, m];
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error('encoders: pot merge failed');
  return g;
}

/** Hauteur d'un potard MASTER ou TEMPO a l'echelle 1 (le picking). */
const POT_TOP = POT.base.h + POT.h + POT.chamferH;

export interface EncodersInfo {
  ids: FaceKnobId[];
  /** angles en degres */
  angleDeg: number[];
  /** course 0 a 1 */
  values: number[];
  /** les potards d'aluminium (MASTER, TEMPO, 2026-10-09) */
  pots: FaceKnobId[];
}

/** Ou vit un potard de FACE_KNOBS : le maillage (encodeurs noirs ou potards d'aluminium) et son rang. */
interface Slot {
  pot: boolean;
  i: number;
}

export class Encoders {
  /** les potards de page (desktop) ; au telephone vide et cache (2026-10-09) */
  readonly mesh: InstancedMesh;
  /** leurs jupes d'aluminium (immobiles) */
  readonly skirts: InstancedMesh;
  /** MASTER et TEMPO, les potards d'aluminium (2026-10-09) */
  readonly pots: InstancedMesh;
  private material: MeshStandardMaterial;
  private skirtMat: MeshStandardMaterial;
  private potMat: MeshStandardMaterial;
  private angle = new Float32Array(FACE_KNOBS.length);
  private value = new Float32Array(FACE_KNOBS.length);
  private slots: Slot[];

  constructor(opts: { mobile: boolean; castShadow: boolean }) {
    let nk = 0;
    let np = 0;
    this.slots = FACE_KNOBS.map((k) => (isPageKnob(k.id) ? { pot: false, i: nk++ } : { pot: true, i: np++ }));
    this.material = new MeshStandardMaterial({ vertexColors: true, ...MATERIAL.encoder });
    this.material.name = 'encoder';
    // Au moins une instance (un tampon vide n'est pas sur partout) ; count dit combien sont dessinees. Sans potard de page
    // (le telephone, 2026-10-09) ni le capuchon ni la jupe ne sont construits : une geometrie vide, jamais posee
    this.mesh = new InstancedMesh(nk > 0 ? buildGeometry(opts.mobile) : new BufferGeometry(), this.material, Math.max(1, nk));
    this.mesh.count = nk;
    this.mesh.visible = nk > 0;
    this.mesh.name = 'encoders';
    this.mesh.castShadow = opts.castShadow;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    // La jupe : la matiere de celle du MM-VOYAGER (voyager/knobs.ts)
    this.skirtMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.28 });
    this.skirtMat.name = 'encoderSkirt';
    this.skirts = new InstancedMesh(nk > 0 ? skirtGeometry(opts.mobile) : new BufferGeometry(), this.skirtMat, Math.max(1, nk));
    this.skirts.count = nk;
    this.skirts.visible = nk > 0;
    this.skirts.name = 'encoderSkirts';
    this.skirts.receiveShadow = true;
    // L'aluminium : un peu metallique, plus lisse que la jupe (le chanfrein et le dessus prennent la cle)
    this.potMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.32 });
    this.potMat.name = 'masterPot';
    this.pots = new InstancedMesh(potGeometry(opts.mobile), this.potMat, Math.max(1, np));
    this.pots.count = np;
    this.pots.name = 'masterPots';
    this.pots.castShadow = opts.castShadow;
    this.pots.receiveShadow = true;
    this.pots.instanceMatrix.setUsage(DynamicDrawUsage);
    for (let i = 0; i < FACE_KNOBS.length; i += 1) {
      const p = FACE_KNOBS[i];
      const s = this.slots[i];
      if (!s.pot) this.skirts.setMatrixAt(s.i, m4.compose(pos.set(p.x, 0, p.z), quat.identity(), scl.setScalar(p.s)));
      this.place(i);
    }
    this.skirts.instanceMatrix.needsUpdate = true;
  }

  /** Les maillages a poser sur le plateau (au telephone, sans les potards de page). */
  objects(): Object3D[] {
    return this.mesh.count > 0 ? [this.mesh, this.skirts, this.pots] : [this.pots];
  }

  private index(id: FaceKnobId): number {
    for (let i = 0; i < FACE_KNOBS.length; i += 1) if (FACE_KNOBS[i].id === id) return i;
    return -1;
  }

  private place(i: number): void {
    quat.setFromAxisAngle(AXIS_Y, this.angle[i]);
    const p = FACE_KNOBS[i];
    const s = this.slots[i];
    const mesh = s.pot ? this.pots : this.mesh;
    // A son echelle (les potards du telephone sont plus gros)
    mesh.setMatrixAt(s.i, m4.compose(pos.set(p.x, 0, p.z), quat, scl.setScalar(p.s)));
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** Course t (0 a 1) -> angle ; true s'il faut une frame. Un potard absent (au telephone, un potard de page) : false. */
  setValue(id: FaceKnobId, t: number): boolean {
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

  /**
   * L'encodeur pour le picking : un cylindre de son rayon, a son echelle.
   * MASTER et TEMPO : enc-level, enc-tempo (kind encoder), le capuchon
   * d'aluminium ; un potard de page : penc-0 a penc-7 (kind penc, son rang
   * dans index).
   */
  hotspot(id: FaceKnobId, layer: Object3D): HotspotDef {
    const i = this.index(id);
    if (i < 0) throw new Error(`encoders: unknown ${id}`);
    const p = FACE_KNOBS[i];
    if (isPageKnob(id)) {
      const k = pageKnobIndex(id);
      return { id: `penc-${k}`, kind: 'penc', layer, shape: 'disc', x: p.x, z: p.z, hx: ENCODER.r * p.s, hz: ENCODER.r * p.s, y0: 0, y1: ENCODER.h * p.s, enabled: true, index: k };
    }
    return {
      id: `enc-${id}`,
      kind: 'encoder',
      layer,
      shape: 'disc',
      x: p.x,
      z: p.z,
      // La rondelle comprise : la cible de la souris un rien plus large que le capuchon ; au telephone 44 px (revue du
      // 2026-10-09 : 26 px, le capuchon et sa rondelle), son echelle et son nom compris (theme.ts MASTER_POTS)
      hx: MASTER_POTS.hitR,
      hz: MASTER_POTS.hitR,
      y0: 0,
      y1: MASTER_POTS.flatHit ? 0.02 : POT_TOP * p.s,
      enabled: true,
      param: id,
    };
  }

  info(): EncodersInfo {
    return {
      ids: FACE_KNOBS.map((e) => e.id),
      angleDeg: Array.from(this.angle, (a) => +(a / DEG).toFixed(2)),
      values: Array.from(this.value, (v) => +v.toFixed(4)),
      pots: FACE_KNOBS.filter((_, i) => this.slots[i].pot).map((e) => e.id),
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
    this.skirts.geometry.dispose();
    this.skirtMat.dispose();
    this.skirts.dispose();
    this.pots.geometry.dispose();
    this.potMat.dispose();
    this.pots.dispose();
  }
}
