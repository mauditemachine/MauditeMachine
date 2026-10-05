/**
 * Une plaque de TWEAKS sous un capot (2026-10-04) : celle du MM-ARP
 * (voyager/tweaks.ts, Mika : "enleve les liens du site et mets des tweaks a
 * la place"), puis celle du MM-RYTM (scene/rytmTweaks.ts, "un systeme de
 * Tweaks.. genre changement de samples pour les voices"). Une plaque a la
 * couleur du capot, vissee sur quatre entretoises d'aluminium au-dessus de
 * la carte, ses potards (les memes que ceux de la face du MM-ARP) et ses
 * commutateurs, leur serigraphie : nom au-dessus, graduations 0 a 10 et
 * bouts de course, ou les positions d'un commutateur a leurs reperes ;
 * et un bloc de titre.
 *
 * La plaque est un enfant des composants de la carte (pcb.parts) : elle
 * pousse avec eux a l'ouverture. Elle se lit droite : en portrait, elle
 * tourne a l'inverse de la carte. Repere de `top` : le dessus de la plaque,
 * x a droite, z vers soi ; les potards, la serigraphie et les cibles du
 * picking y vivent. Les cibles ne repondent que capot ouvert (le rig de la
 * machine les allume).
 */

import {
  CylinderGeometry,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Shape,
  Vector3,
  type BufferGeometry,
  type CanvasTexture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { potAngle } from './encoders';
import { paintFaces, paintSolid } from './materials';
import { drawTracked, makeCanvasTexture, trackedWidth } from './silk';
import { APPEARANCE, HEX, PCB_TURN, SILK, TEMPO_UI, silkA } from '../theme';
import { buildKnobGeometry } from '../voyager/knobs';
import { VOY_KNOB, VOY_SWITCH, switchThrowDeg } from '../voyager/theme';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/** Les dimensions d'une plaque (repere de la carte pour cx, cz ; unites de la scene). */
export interface TweakPlateDims {
  cx: number;
  cz: number;
  w: number;
  d: number;
  /** hauteur des entretoises (au-dessus de la carte), epaisseur, rayon des coins */
  y: number;
  t: number;
  r: number;
  screwIn: number;
  /** filet du bord, en retrait */
  frame: number;
  /** corps : noms, bouts de course, titre (hauteur des capitales) */
  label: number;
  end: number;
  title: number;
}

/** Un potard ou un commutateur de la plaque. */
export interface TweakItem {
  /** l'id de sa cible (hotspot) */
  hotspot: string;
  label: string;
  x: number;
  z: number;
  /** echelle du potard */
  s: number;
  /** commutateur : ses positions, ecrites a ses reperes (2 ou 3) ; sinon un potard 0 a 10 */
  steps?: readonly string[];
  /** la position d'un commutateur ecrite en orange */
  stepOrange?: number;
  /** les bouts de course d'un potard (0, 10) */
  ends?: readonly [string, string];
  /** le bout de gauche en orange (le reglage d'origine) */
  endOrange?: boolean;
}

export interface TweakPlateSpec {
  name: string;
  dims: TweakPlateDims;
  items: readonly TweakItem[];
  /** le bloc de titre : TWEAKS (ou head), un filet orange, deux lignes ; w : sa largeur (une case sinon) */
  title: { x: number; z: number; w?: number; head?: string; sub: string; model: string } | null;
  /** la largeur d'une case (les noms s'y tiennent) */
  cellW: number;
}

/** Pixels de texture par unite de la plaque. */
const PPU = 200;
const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();

/** Graduations 0 a 10 : 270 deg, de sept heures et demie a quatre heures et demie (comme les gros potards de la face). */
const tickDeg = (t: number): number => 225 - 27 * t;
/** Positions d'un commutateur a n crans (90 deg pour deux, 150 au-dela), centrees en haut. */
const switchDeg = (i: number, n: number): number => 90 + switchThrowDeg(n) / 2 - (switchThrowDeg(n) * i) / Math.max(1, n - 1);

/** Rayons d'un potard de la plaque : jupe, graduations, libelles. */
function radii(s: number): { skirt: number; r0: number; r1: number; label: number; end: number } {
  const skirt = VOY_KNOB.skirt.r * s;
  const r0 = skirt + 0.05;
  const r1 = r0 + 0.07;
  return { skirt, r0, r1, label: r1 + 0.03 + 0.13, end: r1 + 0.14 };
}

/** La plaque : un rectangle aux coins arrondis, chanfreine, le dessus a y 0. */
function plateGeometry(P: TweakPlateDims): BufferGeometry {
  const hw = P.w / 2;
  const hd = P.d / 2;
  const r = P.r;
  const s = new Shape();
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + r);
  s.lineTo(hw, hd - r);
  s.quadraticCurveTo(hw, hd, hw - r, hd);
  s.lineTo(-hw + r, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - r);
  s.lineTo(-hw, -hd + r);
  s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  const bevel = 0.012;
  const g0 = new ExtrudeGeometry(s, { depth: P.t - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g0.rotateX(-Math.PI / 2);
  g0.computeBoundingBox();
  const top = g0.boundingBox?.max.y ?? P.t;
  g0.translate(0, -top, 0);
  const g = g0.index ? g0.toNonIndexed() : g0;
  if (g !== g0) g0.dispose();
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  paintFaces(g, (_nx, ny) => (ny > 0.9 ? 'voyPanel' : ny > 0.2 ? 'voyPanelEdge' : 'voyBody'));
  return g;
}

/** Quatre entretoises (de la carte au dessous de la plaque) et quatre vis sur le dessus. */
function hardwareGeometry(P: TweakPlateDims, mobile: boolean): BufferGeometry {
  const seg = mobile ? 10 : 16;
  const parts: BufferGeometry[] = [];
  const hx = P.w / 2 - P.screwIn;
  const hz = P.d / 2 - P.screwIn;
  for (const [x, z] of [
    [-hx, -hz],
    [hx, -hz],
    [-hx, hz],
    [hx, hz],
  ]) {
    // Entretoise hexagonale : du dessus de la carte (-(y + t)) au dessous de la plaque (-t)
    const st = new CylinderGeometry(0.07, 0.07, P.y, 6);
    st.translate(x, -P.t - P.y / 2, z);
    // Vis a tete bombee
    const head = new CylinderGeometry(0.052, 0.07, 0.03, seg);
    head.translate(x, 0.015, z);
    for (const g of [st, head]) {
      const out = g.toNonIndexed();
      g.dispose();
      out.deleteAttribute('uv');
      paintSolid(out, 'voySkirt');
      parts.push(out);
    }
  }
  const g = mergeGeometries(parts, false);
  for (const q of parts) q.dispose();
  if (!g) throw new Error('tweaks: hardware merge failed');
  return g;
}

export class TweakPlate {
  /** dans pcb.parts : place sur la carte, tournee pour se lire droite */
  readonly group = new Group();
  /** le dessus de la plaque : potards, serigraphie, cibles */
  readonly top = new Group();
  readonly knobs: InstancedMesh;
  protected readonly spec: TweakPlateSpec;
  private plate: Mesh;
  private hardware: Mesh;
  private silk: Mesh;
  private texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private W: number;
  private H: number;
  private plateMat: MeshStandardMaterial;
  private metalMat: MeshStandardMaterial;
  private knobMat: MeshStandardMaterial;
  private angle: Float32Array;
  draws = 0;

  constructor(spec: TweakPlateSpec, opts: { mobile: boolean; anisotropy: number }) {
    this.spec = spec;
    const P = spec.dims;
    this.group.name = spec.name;
    this.group.position.set(P.cx, 0, P.cz);
    this.group.rotation.y = -PCB_TURN;
    // pcb.parts est deja au-dessus de la carte (y PCB.h) : la plaque a P.y + P.t au-dessus d'elle
    this.top.position.y = P.y + P.t;
    this.group.add(this.top);
    this.angle = new Float32Array(spec.items.length);

    const light = APPEARANCE.current === 'light';
    this.plateMat = new MeshStandardMaterial({ vertexColors: true, roughness: light ? 0.55 : 0.68, metalness: light ? 0 : 0.18 });
    this.plateMat.name = `${spec.name}Plate`;
    this.plate = new Mesh(plateGeometry(P), this.plateMat);
    this.plate.name = `${spec.name}Plate`;
    this.plate.receiveShadow = true;
    this.metalMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.7 });
    this.metalMat.name = `${spec.name}Metal`;
    this.hardware = new Mesh(hardwareGeometry(P, opts.mobile), this.metalMat);
    this.hardware.name = `${spec.name}Hardware`;

    this.knobMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.28 });
    this.knobMat.name = `${spec.name}Knob`;
    // Une plaque sans reglage (celle du MM-SMPL, 2026-10-05) : un tampon d'une instance, aucune dessinee
    this.knobs = new InstancedMesh(buildKnobGeometry(opts.mobile), this.knobMat, Math.max(1, spec.items.length));
    this.knobs.count = spec.items.length;
    this.knobs.name = `${spec.name}Knobs`;
    this.knobs.receiveShadow = true;
    this.knobs.instanceMatrix.setUsage(DynamicDrawUsage);
    for (let i = 0; i < spec.items.length; i += 1) this.place(i);

    this.W = Math.round(P.w * PPU);
    this.H = Math.round(P.d * PPU);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('tweaks: no 2d context');
    this.ctx = ctx as Ctx;
    this.texture = makeCanvasTexture(this.canvas, opts.anisotropy);
    const geo = new PlaneGeometry(P.w, P.d);
    geo.rotateX(-Math.PI / 2);
    const mat = new MeshStandardMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      roughness: 0.7,
      metalness: 0,
    });
    mat.name = `${spec.name}Silk`;
    this.silk = new Mesh(geo, mat);
    this.silk.name = `${spec.name}Silk`;
    this.silk.position.y = 0.003;
    this.silk.receiveShadow = true;

    this.top.add(this.plate, this.hardware, this.silk, this.knobs);
    this.draw();
  }

  private place(i: number): void {
    const it = this.spec.items[i];
    quat.setFromAxisAngle(AXIS_Y, this.angle[i]);
    m4.compose(pos.set(it.x, 0, it.z), quat, scl.setScalar(it.s));
    this.knobs.setMatrixAt(i, m4);
    this.knobs.instanceMatrix.needsUpdate = true;
  }

  /** Valeur 0 a 1 du i-eme reglage -> angle (un commutateur sur sa course) ; true s'il faut une frame. */
  protected setAt(i: number, v: number): boolean {
    const it = this.spec.items[i];
    if (!it) return false;
    const a = Math.fround(potAngle(v) * (it.steps ? switchThrowDeg(it.steps.length) / TEMPO_UI.sweepDeg : 1));
    if (this.angle[i] === a) return false;
    this.angle[i] = a;
    this.place(i);
    return true;
  }

  /** Le rayon de la cible d'un reglage (un commutateur deborde sur ses reperes). */
  protected hitR(it: TweakItem): number {
    return VOY_KNOB.skirt.r * it.s + (it.steps ? VOY_SWITCH.markR * 0.6 : 0.04);
  }

  /** La hauteur de la cible d'un reglage. */
  protected hitY(it: TweakItem): number {
    return (VOY_KNOB.skirt.h + VOY_KNOB.h) * it.s;
  }

  private px(x: number): number {
    return (x + this.spec.dims.w / 2) * PPU;
  }

  private py(z: number): number {
    return (z + this.spec.dims.d / 2) * PPU;
  }

  /** Un texte centre (ou aligne) sur (x, z) ; cap : hauteur des capitales (unites). */
  private text(t: string, x: number, z: number, cap: number, o: { align?: 'left' | 'center' | 'right'; weight?: number; alpha?: number; orange?: boolean; maxW?: number } = {}): void {
    const ctx = this.ctx;
    const weight = o.weight ?? SILK.weight;
    let fontPx = (cap / SILK.capRatio) * PPU;
    let w = trackedWidth(ctx, t, fontPx, weight);
    if (o.maxW && w > o.maxW * PPU) {
      fontPx *= (o.maxW * PPU) / w;
      w = trackedWidth(ctx, t, fontPx, weight);
    }
    const capPx = fontPx * SILK.capRatio;
    const cx = this.px(x);
    const x0 = o.align === 'right' ? cx - w : o.align === 'left' ? cx : cx - w / 2;
    ctx.fillStyle = o.orange ? HEX.orange : silkA(o.alpha ?? SILK.alpha);
    drawTracked(ctx, t, x0, this.py(z) + capPx / 2, fontPx, weight);
  }

  /**
   * Un nom qui part du cran dans le sens du rayon (2026-10-05, Mika : "les
   * noms de mes samples dans le knob") : a droite il se lit du cran vers
   * l'exterieur, a gauche il finit sur le cran (jamais a l'envers). len : la
   * place (unites) ; le corps rapetisse pour y tenir. Rend sa longueur.
   */
  private radialText(t: string, x: number, z: number, cap: number, a: number, len: number, alpha: number, draw = true): number {
    const ctx = this.ctx;
    const weight = 600;
    let fontPx = (cap / SILK.capRatio) * PPU;
    let w = trackedWidth(ctx, t, fontPx, weight);
    if (w > len * PPU) {
      fontPx *= (len * PPU) / w;
      w = trackedWidth(ctx, t, fontPx, weight);
    }
    if (!draw) return w / PPU;
    const flip = Math.cos(a) < -1e-6;
    ctx.save();
    ctx.translate(this.px(x), this.py(z));
    ctx.rotate(flip ? Math.PI - a : -a);
    ctx.fillStyle = silkA(alpha);
    drawTracked(ctx, t, flip ? -w : 0, (fontPx * SILK.capRatio) / 2, fontPx, weight);
    ctx.restore();
    return w / PPU;
  }

  private line(x0: number, z0: number, x1: number, z1: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(this.px(x0), this.py(z0));
    ctx.lineTo(this.px(x1), this.py(z1));
    ctx.stroke();
  }

  /** La serigraphie : filet du bord, crochets, noms, graduations, bouts de course, positions des commutateurs, le titre. */
  draw(): void {
    const ctx = this.ctx;
    const P = this.spec.dims;
    const cellW = this.spec.cellW;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.textBaseline = 'alphabetic';
    ctx.lineCap = 'butt';
    // Un filet a l'interieur du bord, interrompu nulle part (le cadre d'un panneau)
    ctx.strokeStyle = silkA(SILK.lineAlpha);
    ctx.lineWidth = Math.max(1, SILK.lineWidth * PPU);
    const inset = P.frame;
    ctx.strokeRect(this.px(-P.w / 2 + inset), this.py(-P.d / 2 + inset), (P.w - 2 * inset) * PPU, (P.d - 2 * inset) * PPU);
    for (const it of this.spec.items) {
      const R = radii(it.s);
      // Le nom au-dessus, comme sur le Mini V ; un commutateur a trois crans ecrit le cran du milieu en haut : son nom monte au-dessus
      let up = it.steps && it.steps.length > 2 ? R.skirt + VOY_SWITCH.markR + 0.08 + P.end + 0.12 : R.label;
      // Un choix aux noms longs (les echantillons) : ils partent des crans dans le sens du rayon, le nom monte au-dessus d'eux
      const radial = !!it.steps && it.steps.length > 5 && it.steps.some((x) => x.length > 3);
      const names: { a: number; len: number }[] = [];
      if (radial && it.steps) {
        const n = it.steps.length;
        const r0t = R.skirt + VOY_SWITCH.tick.r0 + VOY_SWITCH.tick.len + 0.05;
        const hLim = cellW / 2 + 0.09;
        const vLim = cellW * 0.75;
        let top = 0;
        it.steps.forEach((step, i) => {
          const a = (switchDeg(i, n) * Math.PI) / 180;
          const c = Math.abs(Math.cos(a));
          const sn = Math.abs(Math.sin(a));
          const len = Math.max(0.12, Math.min(0.95, c > 0.05 ? hLim / c - r0t : 9, sn > 0.05 ? vLim / sn - r0t : 9));
          names.push({ a, len });
          const w = this.radialText(step, 0, 0, P.end, a, len, 0.85, false);
          if (Math.sin(a) > 0.3) top = Math.max(top, (r0t + w) * Math.sin(a));
        });
        up = Math.max(up, top + 0.06 + P.label / 2);
      }
      this.text(it.label, it.x, it.z - up, P.label, { weight: 600, alpha: 1, maxW: cellW * 0.9 });
      if (it.steps) {
        // Commutateur : un repere par position, son nom au bout (le cran d'origine en orange)
        ctx.strokeStyle = silkA(0.75);
        ctx.lineWidth = Math.max(1, 0.016 * PPU);
        const n = it.steps.length;
        it.steps.forEach((step, i) => {
          const a = (switchDeg(i, n) * Math.PI) / 180;
          const r0 = R.skirt + VOY_SWITCH.tick.r0;
          const r1 = r0 + VOY_SWITCH.tick.len;
          this.line(it.x + Math.cos(a) * r0, it.z - Math.sin(a) * r0, it.x + Math.cos(a) * r1, it.z - Math.sin(a) * r1);
          if (radial) {
            const rt = R.skirt + VOY_SWITCH.tick.r0 + VOY_SWITCH.tick.len + 0.05;
            this.radialText(step, it.x + Math.cos(a) * rt, it.z - Math.sin(a) * rt, P.end, a, names[i].len, 0.85);
            return;
          }
          const rt = R.skirt + VOY_SWITCH.markR + 0.04 + (n > 2 ? 0.04 : 0);
          this.text(step, it.x + Math.cos(a) * rt, it.z - Math.sin(a) * rt, P.end, { weight: 600, orange: i === it.stepOrange, alpha: 0.85 });
        });
        continue;
      }
      // Graduations 0 a 10, les 0, 5 et 10 plus longs et plus gras
      ctx.strokeStyle = silkA(0.6);
      for (let t = 0; t <= 10; t += 1) {
        const a = (tickDeg(t) * Math.PI) / 180;
        const major = t % 5 === 0;
        const r1 = major ? R.r1 + 0.03 : R.r1;
        ctx.lineWidth = Math.max(1, (major ? 0.022 : 0.012) * PPU);
        this.line(it.x + Math.cos(a) * R.r0, it.z - Math.sin(a) * R.r0, it.x + Math.cos(a) * r1, it.z - Math.sin(a) * r1);
      }
      // Les bouts de course, centres sous les graduations 0 et 10 (ils debordent moins vers les voisins)
      if (it.ends) {
        const a0 = (tickDeg(0) * Math.PI) / 180;
        const a1 = (tickDeg(10) * Math.PI) / 180;
        const dz = P.end * 0.9;
        this.text(it.ends[0], it.x + Math.cos(a0) * R.end, it.z - Math.sin(a0) * R.end + dz, P.end, { weight: 600, alpha: 0.75, orange: it.endOrange });
        this.text(it.ends[1], it.x + Math.cos(a1) * R.end, it.z - Math.sin(a1) * R.end + dz, P.end, { weight: 600, alpha: 0.75 });
      }
    }
    // Le titre : TWEAKS, un filet orange, deux lignes
    const title = this.spec.title;
    if (title) {
      const tw = title.w ?? cellW;
      this.text(title.head ?? 'TWEAKS', title.x, title.z - 0.2, P.title, { weight: 700, alpha: 1, maxW: tw * 0.9 });
      ctx.strokeStyle = HEX.orange;
      ctx.lineWidth = Math.max(1, 0.02 * PPU);
      const half = Math.min(tw * 0.45, 0.7);
      this.line(title.x - half, title.z + 0.04, title.x + half, title.z + 0.04);
      this.text(title.sub, title.x, title.z + 0.24, P.end, { weight: 600, alpha: 0.7, maxW: tw * 0.9 });
      this.text(title.model, title.x, title.z + 0.44, P.end, { alpha: 0.45, maxW: tw * 0.9 });
    }
    this.draws += 1;
    this.texture.needsUpdate = true;
  }

  protected angles(): number[] {
    return Array.from(this.angle, (a) => +((a * 180) / Math.PI).toFixed(2));
  }

  dispose(): void {
    this.plate.geometry.dispose();
    this.hardware.geometry.dispose();
    this.knobs.geometry.dispose();
    this.silk.geometry.dispose();
    for (const m of [this.plateMat, this.metalMat, this.knobMat, this.silk.material as MeshStandardMaterial]) m.dispose();
    this.knobs.dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
