/**
 * Le PCB de la vue eclatee (spec 5.6, 5.7 et 20.3.11), incline comme le
 * panneau dans le chassis en coin ; il en sort de 0.9 quand la machine
 * s'ouvre. La carte : vert sombre mat
 * (#12301F), pistes de cuivre (#B8763A) dessinees au runtime dans une
 * CanvasTexture par un generateur a graine (mulberry32, 808) qui marche
 * sur une grille de 0.4 en lignes droites et virages a 45 ou 90 deg, sans
 * jamais traverser un composant ni une autre piste, pastilles rondes aux
 * deux bouts et sur 20 vias ; contours des composants et serigraphie en
 * blanc casse, bone a 90 % (MAUDITE MACHINE, MM-808, versions,
 * designateurs ; aucun lieu, regle du site), cadre jaune autour des trois
 * puces cliquables LABEL, LIVE, STUDIO. LABEL sort du site (spec 20.5) :
 * au survol, et au focus clavier de son jumeau, le dessus de la puce passe
 * au jaune, sa serigraphie aussi, suivie du chevron sortant ; seul le
 * rectangle de ce texte est redessine (depuis une copie de la carte), le
 * routage lui garde sa place une fois pour toutes.
 * Les composants en volume : trois grosses puces a pattes, quatre petites,
 * six condensateurs cylindriques, une pile bouton, dix resistances, deux
 * quartz. Chaque famille est un gabarit place par une liste de
 * transformations (l'idee de l'InstancedMesh), instancie sur le CPU puis
 * fusionne en UNE geometrie a couleurs de sommets : six InstancedMesh
 * couteraient six draw calls et le budget mobile (16) ne les tient pas
 * (section 19). Deux draw calls en tout : la carte, les composants.
 * parts.scale.y (0.001 a 1) fait sortir les composants de la carte.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Mesh,
  MeshStandardMaterial,
  type BufferAttribute,
  type BufferGeometry,
  type CanvasTexture,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHIP, CHIPS, EXTERNAL_MARK, PCB, PCB_PARTS, PCB_SILK, PCB_TYPE, SILK, boneA, type ChipId } from '../theme';
import type { HotspotDef } from './hit';
import { albedoRgb, litCss, paintLinear } from './materials';
import { drawTracked, fontsReady, makeCanvasTexture, mulberry32, trackedWidth } from './silk';

/* ---------------- teintes ---------------- */

/**
 * Peintes dans la texture de la carte (eclairee), calees par lecture de
 * pixels a 1440 x 900 comme les couleurs de sommets du corps : la carte
 * par canal (la lumiere chaude mange son bleu), le cuivre a x 1.4 rend
 * 183,117,51 pour #B8763A (section 19).
 */
const BOARD_GAIN = [1.47, 1.94, 2.57] as const;
const TEX = {
  board: litCss('pcb', BOARD_GAIN),
  side: litCss('pcbSide', BOARD_GAIN),
  copper: litCss('copper', 1.4),
  core: litCss('pcbPadCore', 3),
  frame: litCss('yellow', 1.2),
  // Le blanc du brief est le blanc casse chaud : bone, pas un blanc pur
  silk: boneA(0.9),
  /** serigraphie et chevron de la puce LABEL allumee (survol, focus) */
  lit: litCss('yellow', 1.2),
  /** nom des puces cliquables : l'orange de navigation, comme les pages du panneau */
  nav: litCss('orange', 1.2),
} as const;

/**
 * Albedos lineaires des composants (couleurs de sommets), cales de meme :
 * dessus des puces 10,8,7 (#0B0B0D), pattes 147,147,147 (#8A8F98),
 * resistances 197,177,135 (#C9B48A), pile 183,180,178 (#B9BCC4) ; le
 * corps des condensateurs est vu de flanc, moins eclaire : gain fort.
 */
const RGB = {
  chip: albedoRgb('chip', 3),
  leg: albedoRgb('leg', 1.4),
  capBody: albedoRgb('capBody', 4),
  capTop: albedoRgb('capTop', 1.5),
  cell: albedoRgb('cell', 1.25),
  resistor: albedoRgb('resistor', 1.3),
  dot: albedoRgb('yellow', 1.3),
  /**
   * dessus de la puce LABEL allumee : jaune, gain par canal (l'ACES delave
   * un jaune vif et fait monter son bleu), lu 241,195,73 a la vue ouverte
   * par defaut, comme le flash des pads (241,193,74)
   */
  litTop: albedoRgb('yellow', 1).map((v, i) => v * [2, 1.3, 0.3][i]),
} as const;

/* ---------------- generateur ---------------- */

/** Grille des pistes : 0.4 de pas, 0.3 de marge au bord de la carte. */
const G = PCB.grid;
const X0 = -PCB.w / 2 + 0.3;
const Z0 = -PCB.d / 2 + 0.3;
const COLS = Math.floor((PCB.w - 0.6) / G + 1e-6) + 1;
const ROWS = Math.floor((PCB.d - 0.6) / G + 1e-6) + 1;
const gx = (i: number): number => X0 + i * G;
const gz = (j: number): number => Z0 + j * G;
/** Huit directions a 45 deg d'ecart (i vers +x, j vers +z). */
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const FREE = 0;
const BLOCKED = 1;
const USED = 2;

/** Emprise d'un composant ou d'un texte, en unites de la carte. */
interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Un texte serigraphie ; reserve : px (texture desktop) gardes libres a sa droite (chevron). */
interface SilkText {
  text: string;
  x: number;
  z: number;
  px: number;
  align: 'left' | 'center' | 'right';
  reserve: number;
  /** nom d'une puce cliquable : en orange (navigation), pas en bone */
  nav?: boolean;
}

/** Nom d'une puce en px de la texture : bord gauche, ligne de base, hauteur de capitale, taille, depart du chevron. */
interface LabelGeom {
  x0: number;
  baseline: number;
  cap: number;
  px: number;
  markX: number;
}

/** Zone redessinee d'une puce qui sort du site : son nom et son chevron, en px de la texture. */
interface ExtZone {
  id: ChipId;
  text: string;
  geom: LabelGeom;
  /** rectangle a restaurer (px entiers) */
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * la carte sous ce rectangle, sans rien d'allume : copie dans un petit
   * canvas (drawImage, pas de relecture getImageData), prise apres chaque
   * dessin complet
   */
  base: HTMLCanvasElement | null;
}

/** Un contour serigraphie (et son designateur). */
interface Footprint {
  x: number;
  z: number;
  hx: number;
  hz: number;
  round: boolean;
  /** cadre jaune : puce cliquable */
  frame: boolean;
  ref: string;
  /** position du designateur (x, z) et son alignement */
  refX: number;
  refZ: number;
  refAlign: 'left' | 'center' | 'right';
  /** direction des pistes qui en partent : sur z (puces) ou sur x */
  axis: 'x' | 'z';
}

function footprints(): Footprint[] {
  const out: Footprint[] = [];
  const P = PCB_PARTS;
  const legHz = CHIP.legZ + CHIP.legD / 2;
  CHIPS.forEach((c, k) => {
    out.push({
      x: c.x,
      z: c.z,
      hx: CHIP.w / 2 + 0.06,
      hz: legHz + 0.04,
      round: false,
      frame: true,
      ref: `U${k + 1}`,
      refX: c.x - CHIP.w / 2 - 0.06,
      refZ: c.z - legHz - 0.26,
      refAlign: 'left',
      axis: 'z',
    });
  });
  P.small.forEach((s, k) => {
    const hz = P.small3.d / 2 + 0.05;
    out.push({ x: s.x, z: s.z, hx: P.small3.w / 2 + 0.05, hz, round: false, frame: false, ref: `U${k + CHIPS.length + 1}`, refX: s.x, refZ: s.z - hz - 0.2, refAlign: 'center', axis: 'x' });
  });
  P.caps.forEach((c, k) => {
    const r = P.cap3.r + 0.05;
    out.push({ x: c.x, z: c.z, hx: r, hz: r, round: true, frame: false, ref: `C${k + 1}`, refX: c.x + r + 0.08, refZ: c.z, refAlign: 'left', axis: 'x' });
  });
  const r = P.cell3.r + 0.05;
  out.push({ x: P.cell.x, z: P.cell.z, hx: r, hz: r, round: true, frame: false, ref: 'BT1', refX: P.cell.x, refZ: P.cell.z - r - 0.2, refAlign: 'center', axis: 'x' });
  P.resistors.forEach((s, k) => {
    const hz = P.resistor3.d / 2 + 0.05;
    out.push({ x: s.x, z: s.z, hx: P.resistor3.w / 2 + 0.05, hz, round: false, frame: false, ref: `R${k + 1}`, refX: s.x, refZ: s.z - hz - 0.18, refAlign: 'center', axis: 'z' });
  });
  P.crystals.forEach((s, k) => {
    const hz = P.crystal3.r + 0.05;
    out.push({ x: s.x, z: s.z, hx: P.crystal3.l / 2 + 0.05, hz, round: false, frame: false, ref: `X${k + 1}`, refX: s.x, refZ: s.z - hz - 0.18, refAlign: 'center', axis: 'x' });
  });
  return out;
}

/* ---------------- geometrie des composants ---------------- */

type Rgb = readonly number[];

function box(w: number, h: number, d: number, x: number, y: number, z: number, rgb: Rgb): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y, z);
  g.deleteAttribute('uv');
  paintLinear(g, rgb);
  return g;
}

/** Cylindre vertical pose a y0 (ou couche le long de x, centre a y0 + r). */
function cyl(r: number, h: number, seg: number, x: number, y0: number, z: number, rgb: Rgb, alongX = false): BufferGeometry {
  const g = new CylinderGeometry(r, r, h, seg);
  if (alongX) {
    g.rotateZ(Math.PI / 2);
    g.translate(x, y0 + r, z);
  } else {
    g.translate(x, y0 + h / 2, z);
  }
  g.deleteAttribute('uv');
  paintLinear(g, rgb);
  return g;
}

function merge(parts: BufferGeometry[], what: string): BufferGeometry {
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error(`pcb: ${what} merge failed`);
  return g;
}

/** Plage de sommets d'une grosse puce dans la geometrie fusionnee (survol). */
interface ChipRange {
  id: ChipId;
  start: number;
  count: number;
  baseY: Float32Array;
  rise: number;
  /** sommets du dessus du corps (4, contigus) : premier et nombre */
  topStart: number;
  topCount: number;
  lit: boolean;
}

function buildParts(mobile: boolean): { geo: BufferGeometry; ranges: ChipRange[] } {
  const P = PCB_PARTS;
  const seg = mobile ? 12 : 16;
  const pieces: BufferGeometry[] = [];
  const ranges: ChipRange[] = [];
  let offset = 0;
  const push = (g: BufferGeometry): void => {
    pieces.push(g);
    offset += g.getAttribute('position').count;
  };
  // Les quatre puces d'abord : leurs plages de sommets restent simples
  for (const c of CHIPS) {
    const sub: BufferGeometry[] = [box(CHIP.w, CHIP.y1 - CHIP.y0, CHIP.d, c.x, (CHIP.y0 + CHIP.y1) / 2, c.z, RGB.chip)];
    for (const side of [-1, 1]) {
      for (let j = 0; j < CHIP.legsPerSide; j += 1) {
        const lx = c.x - ((CHIP.legsPerSide - 1) * CHIP.legPitch) / 2 + j * CHIP.legPitch;
        sub.push(box(CHIP.legW, CHIP.legH, CHIP.legD, lx, CHIP.legH / 2, c.z + side * CHIP.legZ, RGB.leg));
      }
    }
    // Broche 1 : le point jaune des puces cliquables
    sub.push(cyl(CHIP.dotR, 0.012, 12, c.x - CHIP.w / 2 + 0.22, CHIP.y1, c.z - CHIP.d / 2 + 0.22, RGB.dot));
    const g = merge(sub, 'chip');
    const start = offset;
    push(g);
    const count = g.getAttribute('position').count;
    const pos = g.getAttribute('position');
    const nrm = g.getAttribute('normal');
    const baseY = new Float32Array(count);
    // Le dessus du corps : normale vers le haut, a la hauteur du corps (ni
    // le point jaune, 0.012 plus haut, ni le dessus des pattes)
    let t0 = -1;
    let t1 = -1;
    for (let k = 0; k < count; k += 1) {
      baseY[k] = pos.getY(k);
      if (nrm.getY(k) > 0.9 && Math.abs(pos.getY(k) - CHIP.y1) < 1e-5) {
        if (t0 < 0) t0 = k;
        t1 = k;
      }
    }
    ranges.push({ id: c.id, start, count, baseY, rise: 0, topStart: start + t0, topCount: t0 < 0 ? 0 : t1 - t0 + 1, lit: false });
  }
  for (const s of P.small) push(box(P.small3.w, P.small3.h, P.small3.d, s.x, P.small3.h / 2, s.z, RGB.chip));
  for (const c of P.caps) {
    push(cyl(P.cap3.r, P.cap3.h, seg, c.x, 0, c.z, RGB.capBody));
    push(cyl(P.cap3.r * 0.92, P.cap3.topH, seg, c.x, P.cap3.h, c.z, RGB.capTop));
  }
  push(cyl(P.cell3.r, P.cell3.h, seg + 8, P.cell.x, 0, P.cell.z, RGB.cell));
  for (const s of P.resistors) push(box(P.resistor3.w, P.resistor3.h, P.resistor3.d, s.x, P.resistor3.h / 2, s.z, RGB.resistor));
  for (const s of P.crystals) push(cyl(P.crystal3.r, P.crystal3.l, 12, s.x, 0, s.z, RGB.leg, true));
  return { geo: merge(pieces, 'parts'), ranges };
}

/** Carte : dessus texture, flancs et dessous sur l'aplat pcbSide du coin de la texture. */
function buildBoard(W: number, H: number): BufferGeometry {
  const g = new BoxGeometry(PCB.w, PCB.h, PCB.d);
  g.translate(0, PCB.h / 2, 0);
  const uv = g.getAttribute('uv');
  const n = g.getAttribute('normal');
  // UV constant : derivees nulles, niveau 0 de la texture, l'aplat exact
  const u = 1 - 4 / W;
  const v = 1 - 4 / H;
  for (let i = 0; i < uv.count; i += 1) if (n.getY(i) < 0.5) uv.setXY(i, u, v);
  return g;
}

/* ---------------- le PCB ---------------- */

export interface PcbInfo {
  size: [number, number];
  traces: number;
  /** segments de piste (grille) */
  segments: number;
  pads: number;
  vias: number;
  parts: number;
  triangles: number;
  draws: number;
  webfont: boolean;
  /** soulevement des puces (survol) */
  rise: Record<ChipId, number>;
  /** puce allumee (LABEL : survol ou focus clavier) */
  lit: Record<ChipId, boolean>;
  /** redessins de la zone d'une puce allumee ou eteinte */
  litDraws: number;
}

export class Pcb {
  readonly board: Mesh;
  readonly parts: Mesh;
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D & { letterSpacing?: string };
  private W: number;
  private H: number;
  private boardMat: MeshStandardMaterial;
  private partsMat: MeshStandardMaterial;
  private prints: Footprint[];
  /** polylignes en unites de la carte [x0, z0, x1, z1, ...] */
  private traces: number[][] = [];
  private vias: [number, number][] = [];
  private ranges: ChipRange[];
  /** noms des puces qui sortent du site et leur chevron (redessins au survol) */
  private zones: ExtZone[] = [];
  private draws = 0;
  private litDraws = 0;
  private segments = 0;

  constructor(mobile: boolean, anisotropy: number) {
    const [W, H] = mobile ? PCB.tex.mobile : PCB.tex.desktop;
    this.W = W;
    this.H = H;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('pcb: no 2d context');
    this.ctx = ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    this.prints = footprints();
    this.route();

    this.boardMat = new MeshStandardMaterial({ map: this.texture, roughness: 0.75, metalness: 0 });
    this.boardMat.name = 'pcb';
    this.board = new Mesh(buildBoard(W, H), this.boardMat);
    this.board.name = 'pcbBoard';

    const { geo, ranges } = buildParts(mobile);
    this.ranges = ranges;
    (geo.getAttribute('position') as BufferAttribute).setUsage(DynamicDrawUsage);
    (geo.getAttribute('color') as BufferAttribute).setUsage(DynamicDrawUsage);
    this.partsMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
    this.partsMat.name = 'parts';
    this.parts = new Mesh(geo, this.partsMat);
    this.parts.name = 'pcbParts';
    // Les composants poussent depuis le dessus de la carte
    this.parts.position.y = PCB.h;
    this.parts.scale.y = 0.001;
    // Ni ombre portee ni recue : sous le plateau leve la carte serait noire
    this.draw();
  }

  /* ---------- texture ---------- */

  private px(x: number): number {
    return ((x + PCB.w / 2) / PCB.w) * this.W;
  }

  private py(z: number): number {
    return ((z + PCB.d / 2) / PCB.d) * this.H;
  }

  /** Echelle des tailles en px (donnees pour la texture desktop). */
  private get k(): number {
    return this.W / PCB.tex.desktop[0];
  }

  /** Les textes du PCB : serigraphie, noms des puces, designateurs. */
  private texts(): SilkText[] {
    const out: SilkText[] = [];
    for (const s of PCB_SILK) out.push({ text: s.text, x: s.x, z: s.z, px: s.px, align: s.align, reserve: 0 });
    // Puce qui sort du site : la place du chevron, a droite de son nom
    for (const c of CHIPS) {
      const reserve = c.href ? CHIP.extGapPx + PCB.chipLabelPx * SILK.capRatio : 0;
      out.push({ text: c.silk, x: c.x, z: c.z + CHIP.labelDz, px: PCB.chipLabelPx, align: 'center', reserve, nav: true });
    }
    for (const f of this.prints) out.push({ text: f.ref, x: f.refX, z: f.refZ, px: PCB.designatorPx, align: f.refAlign, reserve: 0 });
    return out;
  }

  /**
   * Boite d'un texte en unites de la carte (largeur mesuree + 20 % : la
   * police du site peut arriver apres), plus la place reservee a sa droite.
   */
  private textRect(t: SilkText): Rect {
    const u = this.W / PCB.w;
    const px = t.px * this.k;
    const w = (trackedWidth(this.ctx, t.text, px, PCB_TYPE.weight, PCB_TYPE.tracking) * 1.2) / u;
    const h = (px * SILK.capRatio) / u;
    const x0 = t.align === 'left' ? t.x : t.align === 'right' ? t.x - w : t.x - w / 2;
    return { x0, z0: t.z - h / 2, x1: x0 + w + (t.reserve * this.k) / u, z1: t.z + h / 2 };
  }

  /**
   * Le routage, une fois pour toutes (graine fixe) : grille des obstacles
   * (composants et textes, marge 0.12), departs au ras des composants,
   * marches aleatoires qui preferent la ligne droite et le virage a 45 deg.
   */
  private route(): void {
    const rnd = mulberry32(PCB.seed);
    const grid = new Uint8Array(COLS * ROWS);
    const at = (i: number, j: number): number => grid[j * COLS + i];
    const put = (i: number, j: number, v: number): void => {
      grid[j * COLS + i] = v;
    };
    const inGrid = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < COLS && j < ROWS;
    const M = 0.12;
    const block = (r: Rect): void => {
      for (let j = 0; j < ROWS; j += 1) {
        for (let i = 0; i < COLS; i += 1) {
          const x = gx(i);
          const z = gz(j);
          if (x >= r.x0 - M && x <= r.x1 + M && z >= r.z0 - M && z <= r.z1 + M) put(i, j, BLOCKED);
        }
      }
    };
    for (const f of this.prints) block({ x0: f.x - f.hx, z0: f.z - f.hz, x1: f.x + f.hx, z1: f.z + f.hz });
    for (const t of this.texts()) block(this.textRect(t));

    // Departs : les points libres au ras de chaque composant, direction vers l'exterieur
    const starts: { i: number; j: number; d: number; main: boolean }[] = [];
    for (const f of this.prints) {
      const x0 = f.x - f.hx - M;
      const x1 = f.x + f.hx + M;
      const z0 = f.z - f.hz - M;
      const z1 = f.z + f.hz + M;
      if (f.axis === 'z') {
        for (let i = 0; i < COLS; i += 1) {
          if (gx(i) < f.x - f.hx || gx(i) > f.x + f.hx) continue;
          const jf = Math.ceil((z1 - Z0) / G - 1e-6);
          const jb = Math.floor((z0 - Z0) / G + 1e-6);
          if (inGrid(i, jf)) starts.push({ i, j: jf, d: 2, main: f.frame });
          if (inGrid(i, jb)) starts.push({ i, j: jb, d: 6, main: f.frame });
        }
      } else {
        for (let j = 0; j < ROWS; j += 1) {
          if (gz(j) < f.z - f.hz || gz(j) > f.z + f.hz) continue;
          const ir = Math.ceil((x1 - X0) / G - 1e-6);
          const il = Math.floor((x0 - X0) / G + 1e-6);
          if (inGrid(ir, j)) starts.push({ i: ir, j, d: 0, main: false });
          if (inGrid(il, j)) starts.push({ i: il, j, d: 4, main: false });
        }
      }
    }
    // Melange reproductible, les puces cliquables en tete
    for (let k = starts.length - 1; k > 0; k -= 1) {
      const m = Math.floor(rnd() * (k + 1));
      [starts[k], starts[m]] = [starts[m], starts[k]];
    }
    starts.sort((a, b) => Number(b.main) - Number(a.main));

    const diag = new Set<string>();
    const diagKey = (i: number, j: number, di: number, dj: number, flip: boolean): string => {
      const ci = Math.min(i, i + di);
      const cj = Math.min(j, j + dj);
      const slash = di * dj < 0;
      return `${ci},${cj},${flip ? !slash : slash}`;
    };
    let segments = 0;
    /** Une piste depuis (i0, j0) vers d0 ; gardee si elle a au moins 4 points. */
    const walk = (i0: number, j0: number, d0: number): void => {
      if (at(i0, j0) !== FREE) return;
      const path = [i0, j0];
      const mine: string[] = [];
      put(i0, j0, USED);
      let i = i0;
      let j = j0;
      let d = d0;
      const len = 5 + Math.floor(rnd() * 11);
      for (let step = 0; step < len; step += 1) {
        // Tout droit d'abord, puis 45 deg, rarement 90
        const cands: [number, number][] =
          step < 2
            ? [[d, 1]]
            : [
                [d, 6],
                [(d + 1) % 8, 1.6],
                [(d + 7) % 8, 1.6],
                [(d + 2) % 8, 0.5],
                [(d + 6) % 8, 0.5],
              ];
        const ok = cands.filter(([nd]) => {
          const [di, dj] = DIRS[nd];
          const ni = i + di;
          const nj = j + dj;
          if (!inGrid(ni, nj) || at(ni, nj) !== FREE) return false;
          // Une diagonale ne croise jamais l'autre diagonale de la meme case
          return !(di !== 0 && dj !== 0 && diag.has(diagKey(i, j, di, dj, true)));
        });
        if (ok.length === 0) break;
        let r = rnd() * ok.reduce((a, c) => a + c[1], 0);
        let pick = ok[0][0];
        for (const [nd, w] of ok) {
          r -= w;
          if (r <= 0) {
            pick = nd;
            break;
          }
        }
        const [di, dj] = DIRS[pick];
        if (di !== 0 && dj !== 0) {
          const key = diagKey(i, j, di, dj, false);
          diag.add(key);
          mine.push(key);
        }
        i += di;
        j += dj;
        d = pick;
        put(i, j, USED);
        path.push(i, j);
      }
      if (path.length < 8) {
        // Trop courte : on rend la place
        for (let k = 0; k < path.length; k += 2) put(path[k], path[k + 1], FREE);
        for (const key of mine) diag.delete(key);
        return;
      }
      segments += path.length / 2 - 1;
      const pts: number[] = [];
      for (let k = 0; k < path.length; k += 2) pts.push(gx(path[k]), gz(path[k + 1]));
      this.traces.push(pts);
    };
    for (const s of starts) {
      if (this.traces.length >= PCB.traces) break;
      walk(s.i, s.j, s.d);
    }
    // Les departs au ras des composants s'epuisent vite (voisins pris) : le
    // reste part de points libres tires au hasard, d'une pastille a l'autre
    for (let guard = 0; this.traces.length < PCB.traces && guard < 800; guard += 1) {
      walk(Math.floor(rnd() * COLS), Math.floor(rnd() * ROWS), Math.floor(rnd() * 4) * 2);
    }
    // Vias : des pastilles seules sur la grille libre
    for (let guard = 0; this.vias.length < PCB.vias && guard < 2000; guard += 1) {
      const i = Math.floor(rnd() * COLS);
      const j = Math.floor(rnd() * ROWS);
      if (at(i, j) !== FREE) continue;
      put(i, j, USED);
      this.vias.push([gx(i), gz(j)]);
    }
    this.segments = segments;
  }

  /** Dessine toute la carte (au montage, puis a l'arrivee des polices). */
  draw(): void {
    const ctx = this.ctx;
    const { W, H } = this;
    const k = this.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = TEX.board;
    ctx.fillRect(0, 0, W, H);
    // L'aplat des flancs, dans le coin arriere droit (sous le plateau leve)
    ctx.fillStyle = TEX.side;
    ctx.fillRect(W - 8, 0, 8, 8);

    // Pistes
    ctx.strokeStyle = TEX.copper;
    ctx.lineWidth = PCB.traceW * k;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const t of this.traces) {
      ctx.beginPath();
      for (let n = 0; n < t.length; n += 2) {
        const x = this.px(t[n]);
        const y = this.py(t[n + 1]);
        if (n === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Pastilles : bouts de pistes et vias
    const pad = (x: number, z: number): void => {
      const cx = this.px(x);
      const cy = this.py(z);
      ctx.beginPath();
      ctx.arc(cx, cy, PCB.padR * k, 0, Math.PI * 2);
      ctx.fillStyle = TEX.copper;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, (PCB.padR - PCB.padRing) * k, 0, Math.PI * 2);
      ctx.fillStyle = TEX.core;
      ctx.fill();
    };
    for (const t of this.traces) {
      pad(t[0], t[1]);
      pad(t[t.length - 2], t[t.length - 1]);
    }
    for (const [x, z] of this.vias) pad(x, z);

    // Contours : blancs, jaunes pour les puces cliquables
    for (const f of this.prints) {
      ctx.strokeStyle = f.frame ? TEX.frame : TEX.silk;
      ctx.lineWidth = Math.max(1, (f.frame ? PCB.chipFrame : PCB.outline) * k);
      ctx.beginPath();
      if (f.round) ctx.arc(this.px(f.x), this.py(f.z), f.hx * (this.W / PCB.w), 0, Math.PI * 2);
      else ctx.rect(this.px(f.x - f.hx), this.py(f.z - f.hz), f.hx * 2 * (this.W / PCB.w), f.hz * 2 * (this.H / PCB.d));
      ctx.stroke();
    }

    // Textes, centres en z sur leur hauteur de capitale
    ctx.fillStyle = TEX.silk;
    ctx.textBaseline = 'alphabetic';
    for (const t of this.texts()) {
      ctx.fillStyle = t.nav ? TEX.nav : TEX.silk;
      const px = t.px * k;
      const w = trackedWidth(ctx, t.text, px, PCB_TYPE.weight, PCB_TYPE.tracking);
      const x = this.px(t.x);
      const x0 = t.align === 'left' ? x : t.align === 'right' ? x - w : x - w / 2;
      drawTracked(ctx, t.text, x0, this.py(t.z) + (px * SILK.capRatio) / 2, px, PCB_TYPE.weight, PCB_TYPE.tracking);
    }
    // La carte au repos sous le nom des puces qui sortent du site, puis
    // leur etat allume s'il l'etait (dessin refait a l'arrivee des polices)
    this.captureZones();
    for (const z of this.zones) if (this.rangeOf(z.id)?.lit) this.paintZone(z, true);
    this.draws += 1;
    this.texture.needsUpdate = true;
  }

  /**
   * Zone de chaque puce qui sort du site (spec 20.5) : son nom et la place
   * du chevron, en px de la texture, et la copie de la carte dessous. Le
   * routage l'a gardee libre (textRect, reserve), un aplat suffit donc a
   * effacer le nom.
   */
  private captureZones(): void {
    const k = this.k;
    const old = this.zones.slice();
    this.zones.length = 0;
    for (const c of CHIPS) {
      if (!c.href) continue;
      const g = this.labelGeom(c.silk, c.x, c.z + CHIP.labelDz);
      const pad = Math.ceil(4 * k);
      const x0 = Math.max(0, Math.floor(g.x0) - pad);
      const y0 = Math.max(0, Math.floor(g.baseline - g.cap) - pad);
      const x1 = Math.min(this.W, Math.ceil(g.markX + g.cap) + pad);
      const y1 = Math.min(this.H, Math.ceil(g.baseline) + pad);
      const w = x1 - x0;
      const h = y1 - y0;
      // Copie a l'echelle 1, en px entiers : exacte
      let base = old.find((z) => z.id === c.id)?.base ?? null;
      if (w > 0 && h > 0) {
        if (!base) base = document.createElement('canvas');
        base.width = w;
        base.height = h;
        base.getContext('2d')?.drawImage(this.canvas, x0, y0, w, h, 0, 0, w, h);
      } else base = null;
      this.zones.push({ id: c.id, text: c.silk, geom: g, x: x0, y: y0, w, h, base });
    }
  }

  /** Nom d'une puce en px de la texture (mesure avec la police du moment). */
  private labelGeom(text: string, x: number, z: number): LabelGeom {
    const k = this.k;
    const px = PCB.chipLabelPx * k;
    const cap = px * SILK.capRatio;
    const w = trackedWidth(this.ctx, text, px, PCB_TYPE.weight, PCB_TYPE.tracking);
    const x0 = this.px(x) - w / 2;
    return { x0, baseline: this.py(z) + cap / 2, cap, px, markX: x0 + w + CHIP.extGapPx * k };
  }

  /**
   * La zone d'une puce : la copie de la carte au repos, ou allumee (aplat
   * de la carte, le nom en jaune et le chevron sortant apres lui, haut
   * comme les capitales, trait CHIP.extStroke dans la boite de 12).
   */
  private paintZone(z: ExtZone, lit: boolean): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!lit) {
      if (z.base) ctx.drawImage(z.base, z.x, z.y);
    } else {
      const g = z.geom;
      ctx.fillStyle = TEX.board;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.fillStyle = TEX.lit;
      ctx.textBaseline = 'alphabetic';
      drawTracked(ctx, z.text, g.x0, g.baseline, g.px, PCB_TYPE.weight, PCB_TYPE.tracking);
      const s = g.cap / EXTERNAL_MARK.box;
      ctx.setTransform(s, 0, 0, s, g.markX, g.baseline - g.cap);
      ctx.strokeStyle = TEX.lit;
      ctx.lineWidth = CHIP.extStroke;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(new Path2D(EXTERNAL_MARK.d));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.litDraws += 1;
    this.texture.needsUpdate = true;
  }

  private rangeOf(id: ChipId): ChipRange | undefined {
    return this.ranges.find((q) => q.id === id);
  }

  /* ---------- puces ---------- */

  /** Les quatre puces pour le picking : leur boite pattes comprises, sur le dessus de la carte. */
  hotspots(layer: Object3D): HotspotDef[] {
    return CHIPS.map((c) => ({
      id: `chip-${c.id}`,
      kind: 'chip' as const,
      layer,
      shape: 'box' as const,
      x: c.x,
      z: c.z,
      hx: CHIP.w / 2,
      hz: CHIP.legZ + CHIP.legD / 2,
      y0: PCB.h,
      y1: PCB.h + CHIP.y1,
      // Actives seulement pendant l'ouverture et vue ouverte (le Stage les allume)
      enabled: false,
      chip: c.id,
      // LIVE et STUDIO : leur section, dont la trace part de la puce
      section: c.section ?? undefined,
    }));
  }

  riseOf(id: ChipId): number {
    return this.rangeOf(id)?.rise ?? 0;
  }

  /**
   * Survol ou focus clavier d'une puce qui sort du site (LABEL) : le dessus
   * de son corps passe au jaune (couleurs de sommets, ses quatre sommets
   * seulement, RGB.litTop), son nom au jaune avec le chevron (zone de la
   * texture) ; eteinte, tout revient. true s'il faut une frame. Les puces
   * LIVE et STUDIO (des boutons) ne s'allument pas : elles se soulevent.
   */
  setLit(id: ChipId, on: boolean): boolean {
    const r = this.rangeOf(id);
    if (!r || r.lit === on || !CHIPS.some((c) => c.id === id && c.href)) return false;
    r.lit = on;
    if (r.topCount > 0) {
      const col = this.parts.geometry.getAttribute('color') as BufferAttribute;
      const a = col.array as Float32Array;
      const rgb = on ? RGB.litTop : RGB.chip;
      for (let n = 0; n < r.topCount; n += 1) {
        const o = (r.topStart + n) * 3;
        a[o] = rgb[0];
        a[o + 1] = rgb[1];
        a[o + 2] = rgb[2];
      }
      col.addUpdateRange(r.topStart * 3, r.topCount * 3);
      col.needsUpdate = true;
    }
    const z = this.zones.find((q) => q.id === id);
    if (z) this.paintZone(z, on);
    return true;
  }

  /** Survol : la puce se souleve (sommets de sa plage seulement) ; true s'il faut une frame. */
  setRise(id: ChipId, y: number): boolean {
    const r = this.rangeOf(id);
    if (!r || r.rise === y) return false;
    r.rise = y;
    const pos = this.parts.geometry.getAttribute('position') as BufferAttribute;
    const a = pos.array as Float32Array;
    for (let n = 0; n < r.count; n += 1) a[(r.start + n) * 3 + 1] = r.baseY[n] + y;
    // Pas de clearUpdateRanges : deux puces changees avant le prochain envoi
    // gardent chacune leur plage ; three fusionne et vide apres l'envoi
    pos.addUpdateRange(r.start * 3, r.count * 3);
    pos.needsUpdate = true;
    return true;
  }

  info(): PcbInfo {
    const idx = this.parts.geometry.getIndex();
    const rise = Object.fromEntries(CHIPS.map((c) => [c.id, 0])) as Record<ChipId, number>;
    const lit = Object.fromEntries(CHIPS.map((c) => [c.id, false])) as Record<ChipId, boolean>;
    for (const r of this.ranges) {
      rise[r.id] = +r.rise.toFixed(4);
      lit[r.id] = r.lit;
    }
    return {
      size: [this.W, this.H],
      traces: this.traces.length,
      segments: this.segments,
      pads: this.traces.length * 2 + this.vias.length,
      vias: this.vias.length,
      parts: CHIPS.length + PCB_PARTS.small.length + PCB_PARTS.caps.length + 1 + PCB_PARTS.resistors.length + PCB_PARTS.crystals.length,
      triangles: idx ? idx.count / 3 : this.parts.geometry.getAttribute('position').count / 3,
      draws: this.draws,
      webfont: fontsReady(),
      rise,
      lit,
      litDraws: this.litDraws,
    };
  }

  dispose(): void {
    this.board.geometry.dispose();
    this.parts.geometry.dispose();
    this.boardMat.dispose();
    this.partsMat.dispose();
    this.texture.dispose();
    for (const z of this.zones) {
      if (!z.base) continue;
      z.base.width = 0;
      z.base.height = 0;
    }
    this.zones.length = 0;
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
