/**
 * Les TWEAKS sous le capot (2026-10-04 : le MM-ARP, voyager/tweaks.ts, puis
 * le MM-RYTM, scene/rytmTweaks.ts, et le MM-BASS, bass/tweaks.ts).
 *
 * 2026-10-08 (Mika : "pour les OPEN des machines : j'aimerais que tu fasses
 * du plus fin.. deja c'est super zoome mais en plus de ca c'est moche des
 * grosses cases par dessus un PCB.. je pense qu'on peut mieux faire quand
 * meme ! avoir de la finesse design ici quand meme !") : plus de grosse
 * plaque noire vissee au-dessus de la carte. Les reglages sont soudes sur
 * le PCB lui-meme, comme la section de calibration d'un synthe haut de
 * gamme :
 * - des potards de precision, bien plus petits que ceux de la face : un
 *   capuchon noir moletee et son trait blanc, sur une rondelle d'aluminium ;
 * - des commutateurs a glissiere (deux ou trois positions) sur leur cadre
 *   de metal, leurs positions ecrites au-dessus ;
 * - des selecteurs rotatifs : leurs crans numerotes autour du capuchon et,
 *   quand les noms sont longs ou nombreux (les echantillons de Mika), une
 *   legende a cote, le cran choisi allume ;
 * - et la serigraphie blanche de la carte : nom en petites capitales
 *   espacees, arc fin et ses graduations, bouts de course minuscules,
 *   designateur (VR1, SW2...), cadres fins des groupes (KICK, SNARE,
 *   GENERATOR...) et un petit cartouche de titre dans un coin (la machine,
 *   TWEAKS, la revision).
 * Une ombre de contact douce, cuite dans la serigraphie, pose chaque piece
 * sur le vernis (la carte ne recoit pas d'ombre, scene/pcb.ts).
 *
 * Le contenu est une donnee (TweakPlateSpec : les reglages, leurs places,
 * leurs crans, les groupes, le cartouche) : la lane suivante du MM-RYTM
 * (R3, les couches SYNTH et SAMPLE de KICK et SNARE) change ses reglages
 * sans toucher a ce dessin. Le genre d'un reglage se deduit de ses crans :
 * pas de crans, un potard ; deux ou trois, une glissiere ; plus, un
 * selecteur (legende si les noms sont longs ou plus de cinq).
 *
 * Le groupe est un enfant des composants de la carte (pcb.parts) : tout
 * pousse avec eux a l'ouverture (parts.scale.y). Il se lit droit : en
 * portrait, il tourne a l'inverse de la carte. Repere de `top` : le dessus
 * de la carte, x a droite, z vers soi ; les pieces, la serigraphie et les
 * cibles du picking y vivent. Les cibles ne repondent que capot ouvert (le
 * rig de la machine les allume) ; elles debordent la piece (au doigt, 44 px
 * au moins au telephone).
 */

import {
  BoxGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type CanvasTexture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { potAngle } from './encoders';
import { paintLinear } from './materials';
import { drawTracked, makeCanvasTexture, trackedWidth } from './silk';
import { HEX, PCB_TURN, PORTRAIT, SILK, TEMPO_UI, boneA } from '../theme';
import { tweakKind, type TweakGroup, type TweakKind, type TweakPlateSpec, type TweakTitle } from './tweaklayout';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/* ---------------- les cotes ---------------- */

/**
 * Les tailles communes aux trois machines (unites de la scene), desktop puis
 * portrait. Desktop : la carte tient 70 % de la largeur (theme.ts
 * OPEN_VIEW), environ 90 px par unite a 1440 ; telephone : 49 px par unite,
 * les pieces et les textes un peu plus grands, les cibles a 0.6 (59 px).
 */
const U = PORTRAIT ? 1.5 : 1;
export const TWEAK = {
  /** potard de precision : capuchon moletee, chanfrein du dessus, rondelle d'aluminium, son trait */
  knob: { r: 0.175 * U, h: 0.125 * U, lift: 0.03 * U, ridges: 36, ridgeDepth: 0.006 * U, collarR: 0.232 * U, collarH: 0.022 * U, mark: { w: 0.02 * U, len: 0.12 * U } },
  /** l'echelle autour : arc, graduations, numeros des crans */
  arc: { r: 0.258 * U, tick: 0.032 * U, major: 0.052 * U, num: 0.072 * U },
  /** glissiere : pas entre deux positions (deux crans, trois crans : leurs noms tiennent), boitier, levier, cadre */
  slide: { pitch: { two: 0.21 * U, three: 0.26 * U }, d: 0.15 * U, h: 0.06 * U, lever: { w: 0.08 * U, d: 0.11 * U, h: 0.05 * U }, frame: 0.028 * U },
  /** hauteurs de capitales : nom, petits textes (bouts de course, positions), designateurs, titres des groupes */
  type: PORTRAIT ? { name: 0.124, small: 0.082, ref: 0.064, group: 0.09, num: 0.064 } : { name: 0.084, small: 0.054, ref: 0.042, group: 0.064, num: 0.042 },
  /** le nom au-dessus du centre d'un reglage, le designateur dessous */
  nameDz: PORTRAIT ? 0.675 : 0.45,
  refDz: PORTRAIT ? 0.575 : 0.4,
  /** filets (cadres, arcs) */
  hair: PORTRAIT ? 0.017 : 0.011,
  /** rayon de la cible d'un potard ; demi-cote mini d'une cible (telephone : 44 px et plus) */
  hit: PORTRAIT ? 0.6 : 0.4,
  hitMin: PORTRAIT ? 0.46 : 0.2,
  /** pixels de texture par unite (la serigraphie reste nette a cette distance, mipmaps et anisotropie) */
  ppu: PORTRAIT ? 190 : 256,
  /** encre : la serigraphie de la carte (bone sur vert, dans les deux apparences) */
  ink: { name: 0.94, small: 0.72, ref: 0.5, line: 0.6, faint: 0.34 },
} as const;

/* ---------------- les donnees ---------------- */

export { tweakClearOf, tweakKind } from './tweaklayout';
export type { TweakGroup, TweakItem, TweakKind, TweakPlateDims, TweakPlateSpec, TweakTitle } from './tweaklayout';

/** Le pas d'une glissiere de n positions. */
const slidePitch = (n: number): number => (n <= 2 ? TWEAK.slide.pitch.two : TWEAK.slide.pitch.three);
/** La longueur du boitier d'une glissiere de n positions. */
const slideLen = (n: number): number => slidePitch(n) * (n - 1) + TWEAK.slide.lever.w + 0.08 * U;

/** Les cotes d'une legende (selecteur aux noms longs) : trois rangees, des colonnes. */
const LEGEND = { rows: 3, pitch: 0.118 * U, gap: 0.2 * U, colGap: 0.13 * U, numW: 0.085 * U } as const;

/* ---------------- geometries ---------------- */

const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3(1, 1, 1);
const ZERO = new Matrix4().makeScale(0, 0, 0);

/** Couleurs lineaires (couleurs de sommets) : plastique noir satine, trait blanc, aluminium, fente. */
const RGB = {
  cap: [0.018, 0.018, 0.02],
  capTop: [0.03, 0.03, 0.033],
  mark: [0.86, 0.84, 0.8],
  alu: [0.5, 0.51, 0.53],
  housing: [0.02, 0.02, 0.022],
  slot: [0.004, 0.004, 0.005],
  lever: [0.7, 0.71, 0.73],
} as const;

const flat = (g: BufferGeometry, rgb: readonly number[]): BufferGeometry => {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  out.deleteAttribute('uv');
  paintLinear(out, rgb);
  return out;
};

const merge = (parts: BufferGeometry[], what: string): BufferGeometry => {
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error(`tweaks: ${what} merge failed`);
  return g;
};

/** Le capuchon d'un potard : moletee, un chanfrein, son trait blanc (vers -z a 0). */
function knobGeometry(mobile: boolean): BufferGeometry {
  const K = TWEAK.knob;
  const seg = mobile ? 48 : 72;
  const body = new CylinderGeometry(K.r * 0.97, K.r, K.h, seg, 1);
  const p = body.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const a = Math.atan2(z, x);
    // Moletage : des stries fines et serrees (un capuchon de precision)
    const k = 1 - (K.ridgeDepth / r) * (0.5 + 0.5 * Math.cos(a * K.ridges));
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  body.computeVertexNormals();
  body.translate(0, K.lift + K.h / 2, 0);
  // Le chanfrein du dessus, puis le dessus (un disque un peu plus clair)
  const bevel = new CylinderGeometry(K.r * 0.82, K.r * 0.95, 0.02 * U, seg, 1, true);
  bevel.translate(0, K.lift + K.h + 0.01 * U, 0);
  const top = new CylinderGeometry(K.r * 0.82, K.r * 0.82, 0.002, seg, 1);
  top.translate(0, K.lift + K.h + 0.02 * U, 0);
  const mark = new BoxGeometry(K.mark.w, 0.004, K.mark.len);
  mark.translate(0, K.lift + K.h + 0.02 * U + 0.002, -K.r * 0.82 + K.mark.len / 2 + 0.008);
  return merge([flat(body, RGB.cap), flat(bevel, RGB.capTop), flat(top, RGB.capTop), flat(mark, RGB.mark)], 'knob');
}

/** La rondelle d'aluminium sous un capuchon (ronde : elle peut tourner avec lui). */
function collarGeometry(mobile: boolean): BufferGeometry {
  const K = TWEAK.knob;
  const seg = mobile ? 32 : 48;
  const ring = new CylinderGeometry(K.collarR * 0.94, K.collarR, K.collarH, seg, 1);
  ring.translate(0, K.collarH / 2, 0);
  const shaft = new CylinderGeometry(K.r * 0.55, K.r * 0.55, K.lift, seg / 2, 1, true);
  shaft.translate(0, K.lift / 2 + K.collarH * 0.5, 0);
  return merge([flat(ring, RGB.alu), flat(shaft, RGB.alu)], 'collar');
}

/** Le boitier d'une glissiere a n positions, son cadre de metal et sa fente (centre a l'origine). */
function slideBodyGeometry(n: number): BufferGeometry {
  const S = TWEAK.slide;
  const L = slideLen(n);
  const frame = new BoxGeometry(L + 2 * S.frame, 0.01, S.d + 2 * S.frame);
  frame.translate(0, 0.005, 0);
  // Les deux pattes du cadre, repliees aux bouts
  const tabs = [-1, 1].map((sd) => {
    const t = new BoxGeometry(0.03 * U, 0.03 * U, S.d * 0.5);
    t.translate(sd * (L / 2 + S.frame - 0.015 * U), 0.015 * U, 0);
    return flat(t, RGB.alu);
  });
  const box = new BoxGeometry(L, S.h, S.d);
  box.translate(0, 0.01 + S.h / 2, 0);
  const slot = new BoxGeometry(slidePitch(n) * (n - 1) + S.lever.w * 0.55, 0.003, S.d * 0.34);
  slot.translate(0, 0.01 + S.h + 0.0015, 0);
  return merge([flat(frame, RGB.alu), ...tabs, flat(box, RGB.housing), flat(slot, RGB.slot)], 'slide');
}

/** Le levier d'une glissiere : un petit bloc d'aluminium strie. */
function leverGeometry(): BufferGeometry {
  const S = TWEAK.slide;
  const y0 = 0.01 + S.h;
  const b = new BoxGeometry(S.lever.w, S.lever.h, S.lever.d);
  b.translate(0, y0 + S.lever.h / 2, 0);
  const ribs = [-1, 0, 1].map((k) => {
    const r = new BoxGeometry(S.lever.w * 1.02, 0.008 * U, 0.012 * U);
    r.translate(0, y0 + S.lever.h + 0.002, k * S.lever.d * 0.28);
    return flat(r, RGB.housing);
  });
  return merge([flat(b, RGB.lever), ...ribs], 'lever');
}

/* ---------------- la plaque ---------------- */

/** Course d'un selecteur de n crans (deg), celle des commutateurs de la face (voyager/theme.ts switchThrowDeg). */
const switchThrowDeg = (n: number): number => (n <= 2 ? 90 : n <= 4 ? 150 : 240);

/** Un angle de cran (deg, 90 = midi) : n crans sur la course du selecteur, centres en haut. */
const stepDeg = (i: number, n: number): number => 90 + switchThrowDeg(n) / 2 - (switchThrowDeg(n) * i) / Math.max(1, n - 1);
/** Graduations d'un potard, 0 a 10 : 270 deg, de sept heures et demie a quatre heures et demie. */
const tickDeg = (t: number): number => 225 - 27 * t;

export class TweakPlate {
  /** dans pcb.parts : place sur la carte, tourne pour se lire droit */
  readonly group = new Group();
  /** le dessus de la carte : pieces, serigraphie, cibles */
  readonly top = new Group();
  /** les capuchons (potards et selecteurs) */
  readonly knobs: InstancedMesh;
  protected readonly spec: TweakPlateSpec;
  private collars: InstancedMesh;
  private slides: Mesh;
  private levers: InstancedMesh;
  private silk: Mesh;
  private texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private W: number;
  private H: number;
  private knobMat: MeshStandardMaterial;
  private metalMat: MeshStandardMaterial;
  private slideMat: MeshStandardMaterial;
  /** le genre de chaque reglage (il change si ses crans changent : RytmTweaks.sync) */
  private kinds: TweakKind[];
  private angle: Float32Array;
  private value: Float32Array;
  /** le cran allume de chaque legende (-1 : aucun) */
  private lit: Int16Array;
  draws = 0;

  constructor(spec: TweakPlateSpec, opts: { mobile: boolean; anisotropy: number }) {
    this.spec = spec;
    const P = spec.dims;
    const n = spec.items.length;
    this.group.name = spec.name;
    this.group.position.set(P.cx, 0, P.cz);
    this.group.rotation.y = -PCB_TURN;
    // pcb.parts est deja au dessus de la carte (y PCB.h) : les pieces sont soudees a y 0
    this.group.add(this.top);
    this.kinds = spec.items.map((it) => tweakKind(it));
    this.angle = new Float32Array(n);
    this.value = new Float32Array(n).fill(-1);
    this.lit = new Int16Array(n).fill(-1);

    // Plastique satine (les capuchons), aluminium (rondelles, cadres, leviers)
    this.knobMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0.12 });
    this.knobMat.name = `${spec.name}Knob`;
    this.metalMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.62 });
    this.metalMat.name = `${spec.name}Metal`;
    this.slideMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 });
    this.slideMat.name = `${spec.name}Slide`;
    // Une plaque sans reglage : des tampons d'une instance, aucune dessinee
    const cap = Math.max(1, n);
    this.knobs = new InstancedMesh(knobGeometry(opts.mobile), this.knobMat, cap);
    this.knobs.name = `${spec.name}Knobs`;
    this.collars = new InstancedMesh(collarGeometry(opts.mobile), this.metalMat, cap);
    this.collars.name = `${spec.name}Collars`;
    this.levers = new InstancedMesh(leverGeometry(), this.slideMat, cap);
    this.levers.name = `${spec.name}Levers`;
    for (const im of [this.knobs, this.collars, this.levers]) {
      im.count = n;
      im.instanceMatrix.setUsage(DynamicDrawUsage);
    }
    this.slides = new Mesh(this.slidesGeometry(), this.slideMat);
    this.slides.name = `${spec.name}Slides`;
    for (let i = 0; i < n; i += 1) this.place(i);

    const ppu = TWEAK.ppu;
    this.W = Math.round(P.w * ppu);
    this.H = Math.round(P.d * ppu);
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
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      roughness: 0.62,
      metalness: 0,
    });
    mat.name = `${spec.name}Silk`;
    this.silk = new Mesh(geo, mat);
    this.silk.name = `${spec.name}Silk`;
    this.silk.position.y = 0.002;
    this.silk.renderOrder = 1;

    this.top.add(this.silk, this.slides, this.collars, this.knobs, this.levers);
    this.draw();
  }

  /** Les boitiers des glissieres, fusionnes a leur place (refaits si un genre change). */
  private slidesGeometry(): BufferGeometry {
    const parts: BufferGeometry[] = [];
    this.spec.items.forEach((it, i) => {
      if (this.kinds[i] !== 'slide') return;
      const g = slideBodyGeometry(it.steps?.length ?? 2);
      g.translate(it.x, 0, it.z);
      parts.push(g);
    });
    if (parts.length === 0) {
      // Rien a montrer : un triangle nul (la geometrie existe, rien n'est dessine)
      const g = new BoxGeometry(0, 0, 0);
      return flat(g, RGB.housing);
    }
    return merge(parts, 'slides');
  }

  /** Les crans d'un reglage ont change (RytmTweaks.sync : les echantillons arrivent) : genres, pieces, serigraphie. */
  protected restep(): void {
    const kinds = this.spec.items.map((it) => tweakKind(it));
    const moved = kinds.some((k, i) => k !== this.kinds[i]);
    this.kinds = kinds;
    if (moved) {
      this.slides.geometry.dispose();
      this.slides.geometry = this.slidesGeometry();
    }
    for (let i = 0; i < this.spec.items.length; i += 1) {
      const v = this.value[i];
      this.value[i] = -1;
      this.lit[i] = -1;
      this.setAt(i, v < 0 ? 0 : v);
      this.place(i);
    }
  }

  protected kindAt(i: number): TweakKind {
    return this.kinds[i] ?? 'pot';
  }

  private place(i: number): void {
    const it = this.spec.items[i];
    const kind = this.kinds[i];
    if (kind === 'slide') {
      this.knobs.setMatrixAt(i, ZERO);
      this.collars.setMatrixAt(i, ZERO);
      const n = it.steps?.length ?? 2;
      const step = Math.round(Math.max(0, this.value[i]) * (n - 1));
      m4.makeTranslation(it.x + (step - (n - 1) / 2) * slidePitch(n), 0, it.z);
      this.levers.setMatrixAt(i, m4);
    } else {
      quat.setFromAxisAngle(AXIS_Y, this.angle[i]);
      m4.compose(pos.set(it.x, 0, it.z), quat, scl);
      this.knobs.setMatrixAt(i, m4);
      this.collars.setMatrixAt(i, m4);
      this.levers.setMatrixAt(i, ZERO);
    }
    this.knobs.instanceMatrix.needsUpdate = true;
    this.collars.instanceMatrix.needsUpdate = true;
    this.levers.instanceMatrix.needsUpdate = true;
  }

  /** Valeur 0 a 1 du i-eme reglage -> angle ou position ; true s'il faut une frame. */
  protected setAt(i: number, v: number): boolean {
    const it = this.spec.items[i];
    if (!it) return false;
    const c = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
    const kind = this.kinds[i];
    const n = it.steps?.length ?? 0;
    if (kind === 'slide') {
      const before = Math.round(Math.max(0, this.value[i]) * (n - 1));
      const fresh = this.value[i] < 0;
      this.value[i] = c;
      const after = Math.round(c * (n - 1));
      if (!fresh && before === after) return false;
      this.place(i);
      return true;
    }
    this.value[i] = c;
    const a = Math.fround(potAngle(c) * (n > 0 ? switchThrowDeg(n) / TEMPO_UI.sweepDeg : 1));
    let changed = false;
    // Une legende : le cran choisi s'allume (la serigraphie se redessine, a chaque cran seulement)
    if (kind === 'legend') {
      const step = Math.round(c * (n - 1));
      if (step !== this.lit[i]) {
        this.lit[i] = step;
        this.draw();
        changed = true;
      }
    }
    if (this.angle[i] === a) return changed;
    this.angle[i] = a;
    this.place(i);
    return true;
  }

  /** La cible d'un reglage (repere de top) : la piece et sa serigraphie, au doigt 44 px au moins au telephone. */
  protected hitOf(i: number): { shape: 'disc' | 'box'; x: number; z: number; hx: number; hz: number; y1: number } {
    const it = this.spec.items[i];
    const kind = this.kinds[i];
    const y1 = TWEAK.knob.lift + TWEAK.knob.h + 0.03;
    const half = this.spec.cellW / 2;
    if (kind === 'slide') {
      const n = it.steps?.length ?? 2;
      const hx = Math.max(TWEAK.hitMin, Math.min(half, (slidePitch(n) * (n - 1)) / 2 + 0.22 * U));
      return { shape: 'box', x: it.x, z: it.z - 0.08 * U, hx, hz: Math.max(TWEAK.hitMin, 0.3 * U), y1 };
    }
    if (kind === 'legend') {
      const w = this.legendWidth(i);
      const x0 = it.x - TWEAK.arc.r - 0.08 * U;
      const x1 = it.x + TWEAK.arc.r + LEGEND.gap + w;
      return { shape: 'box', x: (x0 + x1) / 2, z: it.z, hx: (x1 - x0) / 2, hz: Math.max(TWEAK.hitMin, 0.36 * U), y1 };
    }
    return { shape: 'disc', x: it.x, z: it.z, hx: Math.min(TWEAK.hit, half), hz: Math.min(TWEAK.hit, half), y1 };
  }

  /* ---------- la serigraphie ---------- */

  private X(x: number): number {
    return (x + this.spec.dims.w / 2) * TWEAK.ppu;
  }

  private Y(z: number): number {
    return (z + this.spec.dims.d / 2) * TWEAK.ppu;
  }

  /** Un texte centre (ou aligne) sur (x, z), z au milieu des capitales ; cap : leur hauteur (unites). Rend sa largeur (unites). */
  private text(
    t: string,
    x: number,
    z: number,
    cap: number,
    o: { align?: 'left' | 'center' | 'right'; weight?: number; alpha?: number; orange?: boolean; maxW?: number; tracking?: number; measure?: boolean } = {}
  ): number {
    if (!t) return 0;
    const ctx = this.ctx;
    const weight = o.weight ?? 600;
    const tracking = o.tracking ?? 0.22;
    let fontPx = (cap / SILK.capRatio) * TWEAK.ppu;
    let w = trackedWidth(ctx, t, fontPx, weight, tracking);
    if (o.maxW && w > o.maxW * TWEAK.ppu) {
      fontPx *= (o.maxW * TWEAK.ppu) / w;
      w = trackedWidth(ctx, t, fontPx, weight, tracking);
    }
    if (o.measure) return w / TWEAK.ppu;
    const capPx = fontPx * SILK.capRatio;
    const cx = this.X(x);
    const x0 = o.align === 'right' ? cx - w : o.align === 'left' ? cx : cx - w / 2;
    ctx.fillStyle = o.orange ? HEX.orange : boneA(o.alpha ?? TWEAK.ink.name);
    drawTracked(ctx, t, x0, this.Y(z) + capPx / 2, fontPx, weight, tracking);
    return w / TWEAK.ppu;
  }

  private stroke(alpha: number, width: number = TWEAK.hair): void {
    this.ctx.strokeStyle = boneA(alpha);
    this.ctx.lineWidth = Math.max(1, width * TWEAK.ppu);
  }

  private line(x0: number, z0: number, x1: number, z1: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(this.X(x0), this.Y(z0));
    ctx.lineTo(this.X(x1), this.Y(z1));
    ctx.stroke();
  }

  /** Un trait radial, de r0 a r1, a l'angle a (deg, 90 = midi). */
  private ray(x: number, z: number, a: number, r0: number, r1: number): void {
    const c = Math.cos((a * Math.PI) / 180);
    const s = Math.sin((a * Math.PI) / 180);
    this.line(x + c * r0, z - s * r0, x + c * r1, z - s * r1);
  }

  /** L'ombre de contact d'une piece : une tache sombre et floue sur le vernis. */
  private shade(x: number, z: number, rx: number, rz: number, a: number): void {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(this.X(x), this.Y(z), 0, this.X(x), this.Y(z), Math.max(rx, rz) * TWEAK.ppu);
    g.addColorStop(0, `rgba(0, 0, 0, ${a})`);
    g.addColorStop(0.62, `rgba(0, 0, 0, ${a * 0.55})`);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.translate(this.X(x), this.Y(z));
    ctx.scale(1, rz / Math.max(rx, rz));
    ctx.translate(-this.X(x), -this.Y(z));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.X(x), this.Y(z), Math.max(rx, rz) * TWEAK.ppu, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Un rectangle aux coins arrondis (unites). */
  private roundRect(x0: number, z0: number, x1: number, z1: number, r: number): void {
    const ctx = this.ctx;
    const a = { x: this.X(x0), y: this.Y(z0) };
    const b = { x: this.X(x1), y: this.Y(z1) };
    const rr = r * TWEAK.ppu;
    ctx.beginPath();
    ctx.moveTo(a.x + rr, a.y);
    ctx.arcTo(b.x, a.y, b.x, b.y, rr);
    ctx.arcTo(b.x, b.y, a.x, b.y, rr);
    ctx.arcTo(a.x, b.y, a.x, a.y, rr);
    ctx.arcTo(a.x, a.y, b.x, a.y, rr);
    ctx.closePath();
  }

  /** La largeur d'une legende (unites) : ses colonnes. */
  private legendWidth(i: number): number {
    const it = this.spec.items[i];
    const steps = it.steps ?? [];
    const T = TWEAK.type;
    let w = 0;
    for (let c = 0; c * LEGEND.rows < steps.length; c += 1) {
      let cw = 0;
      for (let r = 0; r < LEGEND.rows; r += 1) {
        const k = c * LEGEND.rows + r;
        if (k >= steps.length) break;
        cw = Math.max(cw, LEGEND.numW + this.text(steps[k] || String(k + 1), 0, 0, T.small, { measure: true }));
      }
      w += cw + (c > 0 ? LEGEND.colGap : 0);
    }
    return w;
  }

  /** Les designateurs : VR1, VR2... pour les potards, SW1... pour les commutateurs, dans l'ordre. */
  private refs(): string[] {
    let vr = 0;
    let sw = 0;
    return this.spec.items.map((it, i) => it.ref ?? (this.kinds[i] === 'pot' ? `VR${(vr += 1)}` : `SW${(sw += 1)}`));
  }

  private drawGroup(g: TweakGroup): void {
    const T = TWEAK.type;
    const r = 0.07 * U;
    // Le titre coupe le filet du haut, pres du coin gauche, comme une section serigraphiee
    const tx = g.x0 + 0.16 * U;
    const tw = this.text(g.title, 0, 0, T.group, { weight: 700, tracking: 0.28, measure: true });
    const ctx = this.ctx;
    this.stroke(TWEAK.ink.line);
    ctx.save();
    // Le filet entier, puis l'encoche du titre effacee (destination-out)
    this.roundRect(g.x0, g.z0, g.x1, g.z1, r);
    ctx.stroke();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    const pad = 0.05 * U;
    ctx.fillRect(this.X(tx - pad), this.Y(g.z0 - T.group), (tw + 2 * pad) * TWEAK.ppu, T.group * 2 * TWEAK.ppu);
    ctx.restore();
    this.text(g.title, tx, g.z0, T.group, { align: 'left', weight: 700, tracking: 0.28, alpha: g.accent ? 1 : TWEAK.ink.name, orange: g.accent });
  }

  private drawTitle(t: TweakTitle): void {
    const T = TWEAK.type;
    const ctx = this.ctx;
    const pad = 0.12 * U;
    this.stroke(TWEAK.ink.line);
    this.roundRect(t.x0, t.z0, t.x1, t.z1, 0.05 * U);
    ctx.stroke();
    const w = t.x1 - t.x0 - 2 * pad;
    const h = t.z1 - t.z0;
    // La machine, en grand ; TWEAKS a droite, en orange ; un filet ; la ligne et la revision
    const nameCap = Math.min(0.11 * U, h * 0.2);
    const zName = t.z0 + pad + nameCap / 2;
    this.text(t.name, t.x0 + pad, zName, nameCap, { align: 'left', weight: 700, tracking: 0.16, alpha: 1, maxW: w * 0.6 });
    this.text('TWEAKS', t.x1 - pad, zName, T.small, { align: 'right', weight: 700, tracking: 0.34, orange: true });
    const zRule = zName + nameCap / 2 + 0.09 * U;
    this.stroke(TWEAK.ink.line);
    this.line(t.x0 + pad, zRule, t.x1 - pad, zRule);
    const zSub = zRule + 0.07 * U + T.small / 2;
    this.text(t.sub, t.x0 + pad, zSub, T.small, { align: 'left', alpha: 0.82, maxW: w * 0.66 });
    this.text(t.rev, t.x1 - pad, zSub, T.small * 0.86, { align: 'right', alpha: TWEAK.ink.small });
  }

  private drawPot(i: number, ref: string): void {
    const it = this.spec.items[i];
    const T = TWEAK.type;
    const A = TWEAK.arc;
    const ctx = this.ctx;
    this.text(it.label, it.x, it.z - TWEAK.nameDz, T.name, { weight: 600, alpha: TWEAK.ink.name, maxW: this.spec.cellW * 0.94 });
    // L'arc fin, de sept heures et demie a quatre heures et demie, et ses onze graduations
    this.stroke(TWEAK.ink.faint);
    ctx.beginPath();
    ctx.arc(this.X(it.x), this.Y(it.z), A.r * TWEAK.ppu, (-225 * Math.PI) / 180, (45 * Math.PI) / 180);
    ctx.stroke();
    for (let t = 0; t <= 10; t += 1) {
      const major = t % 5 === 0;
      this.stroke(major ? TWEAK.ink.name : TWEAK.ink.line, major ? TWEAK.hair * 1.5 : TWEAK.hair);
      this.ray(it.x, it.z, tickDeg(t), A.r, A.r + (major ? A.major : A.tick));
    }
    // Un cran central (TUNE) : un petit triangle plein au-dessus de midi
    if (it.center) {
      const zc = it.z - A.r - A.major - 0.035 * U;
      const s = 0.026 * U;
      ctx.fillStyle = boneA(TWEAK.ink.name);
      ctx.beginPath();
      ctx.moveTo(this.X(it.x - s), this.Y(zc - s));
      ctx.lineTo(this.X(it.x + s), this.Y(zc - s));
      ctx.lineTo(this.X(it.x), this.Y(zc + s * 0.6));
      ctx.closePath();
      ctx.fill();
    }
    // Les bouts de course, sous les graduations 0 et 10
    if (it.ends) {
      const ex = (A.r + A.major) * Math.SQRT1_2 + 0.02 * U;
      const ez = it.z + (A.r + A.major) * Math.SQRT1_2 + 0.07 * U;
      this.text(it.ends[0], it.x - ex, ez, T.small, { align: 'center', alpha: TWEAK.ink.small, orange: it.endOrange, maxW: this.spec.cellW * 0.4 });
      this.text(it.ends[1], it.x + ex, ez, T.small, { align: 'center', alpha: TWEAK.ink.small, maxW: this.spec.cellW * 0.4 });
    }
    this.text(ref, it.x, it.z + TWEAK.refDz, T.ref, { alpha: TWEAK.ink.ref });
  }

  /** Les crans d'un selecteur : un trait par position et son numero (legende) ou son nom (court). */
  private drawSelect(i: number, ref: string, legend: boolean): void {
    const it = this.spec.items[i];
    const steps = it.steps ?? [];
    const n = steps.length;
    const T = TWEAK.type;
    const A = TWEAK.arc;
    this.text(it.label, it.x, it.z - TWEAK.nameDz, T.name, { weight: 600, alpha: TWEAK.ink.name, maxW: this.spec.cellW * (legend ? 0.6 : 0.94) });
    for (let k = 0; k < n; k += 1) {
      const a = stepDeg(k, n);
      const on = legend && k === this.lit[i];
      this.stroke(on ? 1 : TWEAK.ink.line, TWEAK.hair * (on ? 1.8 : 1.3));
      this.ray(it.x, it.z, a, A.r - 0.02 * U, A.r + A.tick);
      const c = Math.cos((a * Math.PI) / 180);
      const s = Math.sin((a * Math.PI) / 180);
      if (legend) {
        const r = A.r + A.num;
        this.text(String(k + 1), it.x + c * r, it.z - s * r, T.num, { weight: on ? 700 : 600, alpha: on ? 1 : TWEAK.ink.small, tracking: 0 });
        continue;
      }
      // Un nom court a son cran : a droite, a gauche ou au-dessus selon l'angle
      const r = A.r + A.tick + 0.05 * U;
      const align = c > 0.3 ? 'left' : c < -0.3 ? 'right' : 'center';
      const dz = s < -0.3 ? T.small * 0.6 : s > 0.3 ? -T.small * 0.4 : 0;
      this.text(steps[k], it.x + c * r, it.z - s * r + dz, T.small, { align, alpha: TWEAK.ink.small, orange: k === it.stepOrange, tracking: 0.12 });
    }
    if (legend) {
      // La legende a droite : trois rangees, des colonnes ; le cran choisi en blanc plein, un point devant
      const x0 = it.x + A.r + LEGEND.gap;
      const z0 = it.z - LEGEND.pitch;
      let cx = x0;
      for (let c = 0; c * LEGEND.rows < n; c += 1) {
        let cw = 0;
        for (let r = 0; r < LEGEND.rows; r += 1) {
          const k = c * LEGEND.rows + r;
          if (k >= n) break;
          const on = k === this.lit[i];
          const z = z0 + r * LEGEND.pitch;
          this.text(String(k + 1), cx, z, T.num, { align: 'left', alpha: on ? 1 : TWEAK.ink.ref, tracking: 0, weight: on ? 700 : 600 });
          const w = this.text(steps[k] || '-', cx + LEGEND.numW, z, T.small, { align: 'left', alpha: on ? 1 : 0.8, weight: on ? 700 : 600, orange: on && k === it.stepOrange });
          if (on) {
            const ctx = this.ctx;
            ctx.fillStyle = HEX.orange;
            const d = 0.028 * U;
            ctx.beginPath();
            ctx.arc(this.X(cx + LEGEND.numW + w + 0.05 * U), this.Y(z), d * TWEAK.ppu * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
          cw = Math.max(cw, LEGEND.numW + w + 0.06 * U);
        }
        cx += cw + LEGEND.colGap;
      }
    }
    this.text(ref, it.x, it.z + TWEAK.refDz, T.ref, { alpha: TWEAK.ink.ref });
  }

  /** Une glissiere : le contour du boitier, un repere et le nom de chaque position au-dessus. */
  private drawSlide(i: number, ref: string): void {
    const it = this.spec.items[i];
    const steps = it.steps ?? [];
    const n = Math.max(2, steps.length);
    const S = TWEAK.slide;
    const T = TWEAK.type;
    const L = slideLen(n);
    const pitch = slidePitch(n);
    const ctx = this.ctx;
    this.text(it.label, it.x, it.z - TWEAK.nameDz, T.name, { weight: 600, alpha: TWEAK.ink.name, maxW: this.spec.cellW * 0.94 });
    // Le contour du composant, un peu plus grand que son cadre (comme toute empreinte de la carte)
    const m = S.frame + 0.03 * U;
    this.stroke(TWEAK.ink.line);
    ctx.strokeRect(this.X(it.x - L / 2 - m), this.Y(it.z - S.d / 2 - m), (L + 2 * m) * TWEAK.ppu, (S.d + 2 * m) * TWEAK.ppu);
    const zt = it.z - S.d / 2 - m;
    for (let k = 0; k < n; k += 1) {
      const x = it.x + (k - (n - 1) / 2) * pitch;
      this.stroke(TWEAK.ink.name, TWEAK.hair * 1.3);
      this.line(x, zt - 0.012 * U, x, zt - 0.05 * U);
      this.text(steps[k] ?? '', x, zt - 0.05 * U - 0.035 * U - T.small / 2, T.small, { alpha: TWEAK.ink.small, orange: k === it.stepOrange, tracking: 0.12, maxW: pitch * 0.92 });
    }
    this.text(ref, it.x, it.z + TWEAK.refDz, T.ref, { alpha: TWEAK.ink.ref });
  }

  /** La serigraphie : ombres de contact, cadres des groupes, cartouche, chaque reglage. */
  draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.textBaseline = 'alphabetic';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    const K = TWEAK.knob;
    const S = TWEAK.slide;
    // Les ombres d'abord (sous l'encre)
    this.spec.items.forEach((it, i) => {
      if (this.kinds[i] === 'slide') {
        const L = slideLen(it.steps?.length ?? 2);
        this.shade(it.x, it.z + 0.02 * U, L / 2 + 0.07 * U, S.d / 2 + 0.07 * U, 0.4);
      } else this.shade(it.x, it.z + 0.025 * U, K.collarR * 1.35, K.collarR * 1.3, 0.5);
    });
    for (const g of this.spec.groups) this.drawGroup(g);
    if (this.spec.title) this.drawTitle(this.spec.title);
    const refs = this.refs();
    this.spec.items.forEach((_, i) => {
      const k = this.kinds[i];
      if (k === 'pot') this.drawPot(i, refs[i]);
      else if (k === 'slide') this.drawSlide(i, refs[i]);
      else this.drawSelect(i, refs[i], k === 'legend');
    });
    this.draws += 1;
    this.texture.needsUpdate = true;
  }

  /** Les angles des capuchons (deg) ; une glissiere : sa position (0, 1, 2). */
  protected angles(): number[] {
    return this.spec.items.map((it, i) =>
      this.kinds[i] === 'slide' ? Math.round(Math.max(0, this.value[i]) * ((it.steps?.length ?? 2) - 1)) : +((this.angle[i] * 180) / Math.PI).toFixed(2)
    );
  }

  dispose(): void {
    this.knobs.geometry.dispose();
    this.collars.geometry.dispose();
    this.levers.geometry.dispose();
    this.slides.geometry.dispose();
    this.silk.geometry.dispose();
    for (const m of [this.knobMat, this.metalMat, this.slideMat, this.silk.material as MeshStandardMaterial]) m.dispose();
    this.knobs.dispose();
    this.collars.dispose();
    this.levers.dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
