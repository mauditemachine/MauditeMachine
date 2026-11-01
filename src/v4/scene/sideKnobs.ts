/**
 * Les deux potards de la colonne gauche de la face DT2 (V.6.0, 2026-10-30, ?face=dt2, docs/v4/dt2/dt2-master-spec.md 2.2,
 * la lane B3) : MAIN VOLUME (19, 19, d 20 : un potentiometre absolu, son repere, un anneau fin) et LEVEL/DATA (19, 45,
 * d 22 : un encodeur sans fin, sans repere, l'anneau des autres). Une petite classe a part (inv-mm-face 3.5 : le chiffre 8
 * des potards A a H est fige partout, faceKnobs, motorPlan, encoders.info()), les memes geometries que les potards A a H
 * (scene/encoders.ts encoderGeometry, encoderSkirtGeometry, ringSegmentGeometry) a leurs cotes (theme.ts SIDE_KNOBS).
 *
 * Deux maillages par potard (un capuchon, une jupe : leurs cotes different), un maillage d'anneau par potard (27
 * segments, une couleur par instance, non eclaires, comme les anneaux A a H). Le Stage pose MAIN VOLUME sur le niveau
 * general (le dial level, sa zone mvol est un encoder param level : le glisser d'aujourd'hui le tourne deja) ; LEVEL/DATA
 * attend la lane B5 (le niveau de la piste, TRK LEV) : setRing / setCap. Aucune zone ici : elles sont au registre
 * scene/zones/face60.ts (mvol, data). Rien sur la face de la V.5.3 (SIDE_KNOBS vide) ni au telephone.
 */

import { Color, DynamicDrawUsage, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3, type Object3D } from 'three';
import { COLOR, DT_HEX, ENCODER, HOVER_LIGHT, KNOB_RING, MATERIAL, RING_TONE, ringLit, SIDE_KNOBS, type KnobTone, type SideKnobSpec } from '../theme';
import { encoderGeometry, encoderSkirtGeometry, potAngle, ringSegmentGeometry, type EncoderDims } from './encoders';

const DEG = Math.PI / 180;
const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3(1, 1, 1);
const tint = new Color();

export type SideKnobId = SideKnobSpec['id'];

export interface SideKnobsInfo {
  ids: SideKnobId[];
  /** la course montree (0 a 1) et l'angle du capuchon (degres) */
  values: number[];
  angleDeg: number[];
  /** l'anneau : la somme des parts allumees de ses segments, sa teinte */
  ring: number[];
  tones: (KnobTone | null)[];
  hover: SideKnobId | null;
}

/** Les cotes d'un capuchon de la colonne gauche : celles des potards A a H (ENCODER), a sa taille. */
const dimsOf = (s: SideKnobSpec): EncoderDims => ({
  r: s.cap.r,
  rTop: s.cap.rTop,
  h: s.cap.h,
  chamfer: ENCODER.chamfer * (s.cap.r / ENCODER.r),
  chamferGain: ENCODER.chamferGain,
  flutes: ENCODER.flutes,
  fluteDepth: ENCODER.fluteDepth,
  segments: ENCODER.segments,
  mark: s.mark ? { w: ENCODER.mark.w, h: ENCODER.mark.h, d: s.cap.rTop * 0.78 } : null,
  skirt: s.skirt,
});

export class SideKnobs {
  readonly caps: Mesh[];
  readonly skirts: Mesh[];
  readonly rings: InstancedMesh[];
  private capMat: MeshStandardMaterial;
  private skirtMat: MeshStandardMaterial;
  private ringMat: MeshBasicMaterial;
  private value: Float32Array;
  private angle: Float32Array;
  private ringT: Float32Array;
  private ringPart: Float32Array[];
  private ringTone: (KnobTone | null)[];
  private hover = -1;
  private ringOff = new Color();
  private toneColor = new Map<string, Color>();

  constructor(opts: { mobile: boolean; castShadow: boolean }) {
    const n = SIDE_KNOBS.length;
    this.value = new Float32Array(n);
    this.angle = new Float32Array(n);
    this.ringT = new Float32Array(n).fill(Number.NaN);
    this.ringTone = new Array<KnobTone | null>(n).fill(null);
    this.ringPart = SIDE_KNOBS.map((s) => new Float32Array(s.ring.segments));
    this.capMat = new MeshStandardMaterial({ vertexColors: true, ...MATERIAL.encoder });
    this.capMat.name = 'sideKnob';
    this.skirtMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.28 });
    this.skirtMat.name = 'sideKnobSkirt';
    this.ringMat = new MeshBasicMaterial({ toneMapped: false });
    this.ringMat.name = 'sideKnobRing';
    this.ringOff.setHex(COLOR.line);
    this.caps = [];
    this.skirts = [];
    this.rings = [];
    SIDE_KNOBS.forEach((s, i) => {
      const E = dimsOf(s);
      // Un materiau par capuchon et par jupe : le survol les eclaire un a un (comme setColorAt des potards A a H)
      const cap = new Mesh(encoderGeometry(opts.mobile, E), i === 0 ? this.capMat : this.capMat.clone());
      cap.name = `sideKnob-${s.id}`;
      cap.position.set(s.x, 0, s.z);
      cap.castShadow = opts.castShadow;
      cap.receiveShadow = true;
      this.caps.push(cap);
      const skirt = new Mesh(encoderSkirtGeometry(opts.mobile, E), i === 0 ? this.skirtMat : this.skirtMat.clone());
      skirt.name = `sideKnobSkirt-${s.id}`;
      skirt.position.set(s.x, 0, s.z);
      skirt.receiveShadow = true;
      this.skirts.push(skirt);
      const S = s.ring.segments;
      const ring = new InstancedMesh(ringSegmentGeometry({ ...s.ring, y: KNOB_RING.y }), this.ringMat, S);
      ring.name = `sideKnobRing-${s.id}`;
      for (let j = 0; j < S; j += 1) {
        quat.setFromAxisAngle(AXIS_Y, potAngle((j + 0.5) / S));
        ring.setMatrixAt(j, m4.compose(pos.set(s.x, 0, s.z), quat, scl));
        ring.setColorAt(j, tint.copy(this.ringOff));
      }
      ring.instanceMatrix.needsUpdate = true;
      ring.instanceColor?.setUsage(DynamicDrawUsage);
      this.rings.push(ring);
      this.place(i);
    });
  }

  /** Les maillages a poser sur le plateau. */
  objects(): Object3D[] {
    return [...this.caps, ...this.skirts, ...this.rings];
  }

  index(id: SideKnobId): number {
    return SIDE_KNOBS.findIndex((s) => s.id === id);
  }

  private place(i: number): void {
    const c = this.caps[i];
    if (c) c.quaternion.setFromAxisAngle(AXIS_Y, this.angle[i]);
  }

  private hexColor(hex: string): Color {
    let c = this.toneColor.get(hex);
    if (!c) {
      c = new Color(hex);
      this.toneColor.set(hex, c);
    }
    return c;
  }

  /** L'anneau du potard i a la course t, de la teinte tone (theme.ts RING_TONE ; base : le blanc de la Digitakt) ; true s'il a change. */
  private paintRing(i: number, t: number, tone: KnobTone): boolean {
    const r = this.rings[i];
    if (!r || (this.ringT[i] === Math.fround(t) && this.ringTone[i] === tone)) return false;
    this.ringT[i] = t;
    this.ringTone[i] = tone;
    const on = tone === 'base' ? this.hexColor(DT_HEX.white) : this.hexColor(RING_TONE[tone].on);
    const level = RING_TONE[tone].k;
    const S = r.count;
    for (let j = 0; j < S; j += 1) {
      // Les 27 segments des potards A a H (rytm/faceplate.ts DT2 side : ring.segments), la meme loi (theme.ts ringLit)
      const f = (S === KNOB_RING.segments ? ringLit(j, t, false) : Math.min(1, Math.max(0, t * S - j))) * level;
      this.ringPart[i][j] = f;
      r.setColorAt(j, tint.copy(this.ringOff).lerp(on, f));
    }
    if (r.instanceColor) r.instanceColor.needsUpdate = true;
    return true;
  }

  /** Le capuchon du potard id a la course t (un potentiometre : MAIN VOLUME ; LEVEL/DATA tourne sans butee) ; true s'il faut une frame. */
  setCap(id: SideKnobId, t: number): boolean {
    const i = this.index(id);
    if (i < 0) return false;
    const a = potAngle(t);
    this.value[i] = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
    if (this.angle[i] === Math.fround(a)) return false;
    this.angle[i] = a;
    this.place(i);
    return true;
  }

  /** L'anneau du potard id (la course t, sa teinte) ; true s'il faut une frame. */
  setRing(id: SideKnobId, o: { t: number; tone?: KnobTone }): boolean {
    const i = this.index(id);
    if (i < 0) return false;
    return this.paintRing(i, Math.min(1, Math.max(0, Number.isFinite(o.t) ? o.t : 0)), o.tone ?? 'base');
  }

  /** La valeur d'un potentiometre (MAIN VOLUME) : le capuchon et l'anneau ensemble ; true s'il faut une frame. */
  setValue(id: SideKnobId, t: number): boolean {
    const a = this.setRing(id, { t });
    const b = this.setCap(id, t);
    return a || b;
  }

  /** Le potard sous la souris (l'id de sa zone : mvol, data ; null aucun) : un peu plus clair, sa jupe aussi ; true s'il faut une frame. */
  setHover(zone: string | null): boolean {
    const k = zone === null ? -1 : SIDE_KNOBS.findIndex((s) => s.id === zone);
    if (k === this.hover) return false;
    const was = this.hover;
    this.hover = k;
    for (const i of [was, k]) {
      if (i < 0) continue;
      const on = i === k;
      (this.caps[i].material as MeshStandardMaterial).color.setScalar(on ? HOVER_LIGHT.knob : 1);
      (this.skirts[i].material as MeshStandardMaterial).color.setScalar(on ? HOVER_LIGHT.skirt : 1);
    }
    return true;
  }

  info(): SideKnobsInfo {
    return {
      ids: SIDE_KNOBS.map((s) => s.id),
      values: Array.from(this.value, (v) => +v.toFixed(4)),
      angleDeg: Array.from(this.angle, (a) => +(a / DEG).toFixed(2)),
      ring: this.ringPart.map((p) => Math.round(p.reduce((s, v) => s + v, 0) * 100) / 100),
      tones: [...this.ringTone],
      hover: this.hover >= 0 ? SIDE_KNOBS[this.hover].id : null,
    };
  }

  dispose(): void {
    for (const c of this.caps) {
      c.geometry.dispose();
      (c.material as MeshStandardMaterial).dispose();
    }
    for (const s of this.skirts) {
      s.geometry.dispose();
      (s.material as MeshStandardMaterial).dispose();
    }
    for (const r of this.rings) {
      r.geometry.dispose();
      r.dispose();
    }
    this.ringMat.dispose();
  }
}
