/**
 * TWEAKS du MM-ARP (2026-10-04, Mika : "un bouton pour qu'on n'ait pas de
 * probleme de phase dans les low ; dans OPEN, d'autres boutons comme le
 * Mini V ; enleve les liens du site et mets des tweaks a la place ; je veux
 * un super synth"). Sous le capot, la ou etaient les puces des pages : une
 * plaque a la couleur du capot, vissee sur quatre entretoises d'aluminium
 * au-dessus de la carte, et ses sept potards (les memes que ceux de la
 * face) : PHASE, DRIFT, WIDTH, BASS MONO, KEY TRACK, ACCENT et le
 * commutateur SYNC (voyager/params.ts dit ce qu'ils font).
 *
 * La plaque est un enfant des composants de la carte (pcb.parts) : elle
 * pousse avec eux a l'ouverture. Elle se lit droite : en portrait, elle
 * tourne a l'inverse de la carte. Repere de `top` : le dessus de la plaque,
 * x a droite, z vers soi ; les potards, la serigraphie et les cibles du
 * picking (vk-<id>, comme ceux de la face) y vivent. Les cibles ne
 * repondent que capot ouvert (rig.ts, comme les puces avant elles).
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
import type { HotspotDef } from '../scene/hit';
import { potAngle } from '../scene/encoders';
import { paintFaces, paintSolid } from '../scene/materials';
import { drawTracked, makeCanvasTexture, trackedWidth } from '../scene/silk';
import { APPEARANCE, HEX, PCB_TURN, SILK, TEMPO_UI, silkA } from '../theme';
import { buildKnobGeometry } from './knobs';
import { VOY_COPY, VOY_KNOB, VOY_SWITCH, VOY_TWEAK_CELLS, VOY_TWEAK_ENDS, VOY_TWEAK_PLATE, switchThrowDeg, voyTweakPlace } from './theme';
import { VOY_TWEAKS, type VoyKnobId } from './params';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

const P = VOY_TWEAK_PLATE;
const COUNT = VOY_TWEAKS.length;
/** Pixels de texture par unite de la plaque. */
const PPU = 200;
const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();

/** Graduations 0 a 10 : 270 deg, de sept heures et demie a quatre heures et demie (comme les gros potards de la face). */
const tickDeg = (t: number): number => 225 - 27 * t;
/** Positions d'un commutateur a deux crans : OFF a gauche, ON a droite (90 deg, centres en haut). */
const switchDeg = (i: number): number => 90 + switchThrowDeg(2) / 2 - switchThrowDeg(2) * i;

/** Rayons d'un potard de la plaque : jupe, graduations, libelles. */
function radii(s: number): { skirt: number; r0: number; r1: number; label: number; end: number } {
  const skirt = VOY_KNOB.skirt.r * s;
  const r0 = skirt + 0.05;
  const r1 = r0 + 0.07;
  return { skirt, r0, r1, label: r1 + 0.03 + 0.13, end: r1 + 0.17 };
}

/** La plaque : un rectangle aux coins arrondis, chanfreine, le dessus a y 0. */
function plateGeometry(): BufferGeometry {
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
function hardwareGeometry(mobile: boolean): BufferGeometry {
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
  if (!g) throw new Error('voyager: tweak hardware merge failed');
  return g;
}

export class VoyTweaks {
  /** dans pcb.parts : place sur la carte, tournee pour se lire droite */
  readonly group = new Group();
  /** le dessus de la plaque : potards, serigraphie, cibles */
  readonly top = new Group();
  readonly knobs: InstancedMesh;
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
  private angle = new Float32Array(COUNT);
  draws = 0;

  constructor(opts: { mobile: boolean; anisotropy: number }) {
    this.group.name = 'voyTweaks';
    this.group.position.set(P.cx, 0, P.cz);
    this.group.rotation.y = -PCB_TURN;
    // pcb.parts est deja au-dessus de la carte (y PCB.h) : la plaque a P.y + P.t au-dessus d'elle
    this.top.position.y = P.y + P.t;
    this.group.add(this.top);

    const light = APPEARANCE.current === 'light';
    this.plateMat = new MeshStandardMaterial({ vertexColors: true, roughness: light ? 0.55 : 0.68, metalness: light ? 0 : 0.18 });
    this.plateMat.name = 'voyTweakPlate';
    this.plate = new Mesh(plateGeometry(), this.plateMat);
    this.plate.name = 'voyTweakPlate';
    this.plate.receiveShadow = true;
    this.metalMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.7 });
    this.metalMat.name = 'voyTweakMetal';
    this.hardware = new Mesh(hardwareGeometry(opts.mobile), this.metalMat);
    this.hardware.name = 'voyTweakHardware';

    this.knobMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.28 });
    this.knobMat.name = 'voyTweakKnob';
    this.knobs = new InstancedMesh(buildKnobGeometry(opts.mobile), this.knobMat, COUNT);
    this.knobs.name = 'voyTweakKnobs';
    this.knobs.receiveShadow = true;
    this.knobs.instanceMatrix.setUsage(DynamicDrawUsage);
    for (let i = 0; i < COUNT; i += 1) this.place(i);

    this.W = Math.round(P.w * PPU);
    this.H = Math.round(P.d * PPU);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('voyager: no 2d context');
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
    mat.name = 'voyTweakSilk';
    this.silk = new Mesh(geo, mat);
    this.silk.name = 'voyTweakSilk';
    this.silk.position.y = 0.003;
    this.silk.receiveShadow = true;

    this.top.add(this.plate, this.hardware, this.silk, this.knobs);
    this.draw();
  }

  private index(id: VoyKnobId): number {
    for (let i = 0; i < COUNT; i += 1) if (VOY_TWEAKS[i].id === id) return i;
    return -1;
  }

  private place(i: number): void {
    const pl = voyTweakPlace(VOY_TWEAKS[i].id);
    if (!pl) return;
    quat.setFromAxisAngle(AXIS_Y, this.angle[i]);
    m4.compose(pos.set(pl.x, 0, pl.z), quat, scl.setScalar(pl.s));
    this.knobs.setMatrixAt(i, m4);
    this.knobs.instanceMatrix.needsUpdate = true;
  }

  /** Valeur 0 a 1 -> angle ; true s'il faut une frame. */
  setValue(id: VoyKnobId, v: number): boolean {
    const i = this.index(id);
    if (i < 0) return false;
    const pl = voyTweakPlace(id);
    const a = Math.fround(potAngle(v) * (pl?.sw ? switchThrowDeg(2) / TEMPO_UI.sweepDeg : 1));
    if (this.angle[i] === a) return false;
    this.angle[i] = a;
    this.place(i);
    return true;
  }

  /** Les cibles du picking : un cylindre par potard (un commutateur deborde sur ses reperes), coupees capot ferme. */
  hotspots(): HotspotDef[] {
    return VOY_TWEAKS.map((k) => {
      const pl = voyTweakPlace(k.id) ?? { x: 0, z: 0, s: 1, sw: false };
      const r = VOY_KNOB.skirt.r * pl.s + (pl.sw ? VOY_SWITCH.markR * 0.6 : 0.04);
      return {
        id: `vk-${k.id}`,
        kind: 'vknob' as const,
        layer: this.top,
        shape: 'disc' as const,
        x: pl.x,
        z: pl.z,
        hx: r,
        hz: r,
        y0: 0,
        y1: (VOY_KNOB.skirt.h + VOY_KNOB.h) * pl.s,
        enabled: false,
        vknob: k.id,
      };
    });
  }

  private px(x: number): number {
    return (x + P.w / 2) * PPU;
  }

  private py(z: number): number {
    return (z + P.d / 2) * PPU;
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

  private line(x0: number, z0: number, x1: number, z1: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(this.px(x0), this.py(z0));
    ctx.lineTo(this.px(x1), this.py(z1));
    ctx.stroke();
  }

  /** La serigraphie : filet du bord, noms, graduations, bouts de course, positions de SYNC, le titre. */
  draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.textBaseline = 'alphabetic';
    ctx.lineCap = 'butt';
    // Un filet a l'interieur du bord, interrompu nulle part (le cadre d'un panneau)
    ctx.strokeStyle = silkA(SILK.lineAlpha);
    ctx.lineWidth = Math.max(1, SILK.lineWidth * PPU);
    const inset = P.screwIn + 0.14;
    ctx.strokeRect(this.px(-P.w / 2 + inset), this.py(-P.d / 2 + inset), (P.w - 2 * inset) * PPU, (P.d - 2 * inset) * PPU);
    // La largeur d'une case : quatre colonnes a plat (desktop), deux debout (portrait)
    const cellW = (P.w > P.d ? P.w / 4 : P.w / 2) - 0.12;
    for (const k of VOY_TWEAKS) {
      const pl = voyTweakPlace(k.id);
      if (!pl) continue;
      const R = radii(pl.s);
      // Le nom au-dessus, comme sur le Mini V
      this.text(k.label, pl.x, pl.z - R.label, P.label, { weight: 600, alpha: 1, maxW: cellW * 0.9 });
      if (pl.sw) {
        // Commutateur : un repere par position, OFF et ON au bout
        ctx.strokeStyle = silkA(0.75);
        ctx.lineWidth = Math.max(1, 0.016 * PPU);
        const steps = k.steps ?? ['OFF', 'ON'];
        steps.forEach((step, i) => {
          const a = (switchDeg(i) * Math.PI) / 180;
          const r0 = R.skirt + VOY_SWITCH.tick.r0;
          const r1 = r0 + VOY_SWITCH.tick.len;
          this.line(pl.x + Math.cos(a) * r0, pl.z - Math.sin(a) * r0, pl.x + Math.cos(a) * r1, pl.z - Math.sin(a) * r1);
          const rt = R.skirt + VOY_SWITCH.markR + 0.04;
          this.text(step, pl.x + Math.cos(a) * rt, pl.z - Math.sin(a) * rt, P.end, { weight: 600, orange: i === 1, alpha: 0.85 });
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
        this.line(pl.x + Math.cos(a) * R.r0, pl.z - Math.sin(a) * R.r0, pl.x + Math.cos(a) * r1, pl.z - Math.sin(a) * r1);
      }
      // Les bouts de course, sous les graduations 0 et 10
      const ends = VOY_TWEAK_ENDS[k.id];
      if (ends) {
        const a0 = (tickDeg(0) * Math.PI) / 180;
        const a1 = (tickDeg(10) * Math.PI) / 180;
        // PHASE : FREE en orange (le reglage d'origine, la phase libre)
        this.text(ends[0], pl.x + Math.cos(a0) * R.end, pl.z - Math.sin(a0) * R.end + 0.04, P.end, { align: 'right', weight: 600, alpha: 0.7, orange: k.id === 'phase' });
        this.text(ends[1], pl.x + Math.cos(a1) * R.end, pl.z - Math.sin(a1) * R.end + 0.04, P.end, { align: 'left', weight: 600, alpha: 0.7 });
      }
    }
    // Le titre : TWEAKS, un filet, la machine
    const title = VOY_TWEAK_CELLS.find((c) => c.id === 'title');
    if (title) {
      this.text('TWEAKS', title.x, title.z - 0.2, P.title, { weight: 700, alpha: 1, maxW: cellW * 0.9 });
      ctx.strokeStyle = HEX.orange;
      ctx.lineWidth = Math.max(1, 0.02 * PPU);
      const half = Math.min(cellW * 0.45, 0.7);
      this.line(title.x - half, title.z + 0.04, title.x + half, title.z + 0.04);
      this.text('ANALOG CONTROL', title.x, title.z + 0.24, P.end, { weight: 600, alpha: 0.7, maxW: cellW * 0.9 });
      this.text(`${VOY_COPY.model} R1.0`, title.x, title.z + 0.44, P.end, { alpha: 0.45, maxW: cellW * 0.9 });
    }
    this.draws += 1;
    this.texture.needsUpdate = true;
  }

  info(): { ids: VoyKnobId[]; angleDeg: number[]; draws: number } {
    return { ids: VOY_TWEAKS.map((k) => k.id), angleDeg: Array.from(this.angle, (a) => +((a * 180) / Math.PI).toFixed(2)), draws: this.draws };
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
