/**
 * Picking en espace ecran (spec 6.2, decision 1 ; revision 2, spec 20.7).
 * Chaque objet interactif est declare dans une liste explicite : une
 * boite (ou un cylindre) dans le repere de son calque. Sa silhouette
 * projetee (enveloppe convexe des coins, en px CSS du canvas) est la forme
 * de clic. Le test ne tourne qu'aux evenements de pointeur, jamais dans la
 * boucle de rendu ; la projection n'est refaite que si la camera, un
 * calque ou la taille du canvas ont bouge (signature des matrices).
 * Revision 2 (l'orbite montre la machine de partout) :
 * - plusieurs silhouettes sous le point : le plus proche le long du rayon
 *   de vue gagne, et les occulteurs declares (dalle du panneau, coin du
 *   chassis, carte) cachent ce qui est derriere eux (une puce vue a travers
 *   le panneau leve n'est pas cliquable) ; tests de rayon analytiques contre
 *   des polyedres convexes (demi-espaces), pas de Raycaster ;
 * - visible() : un point (l'ancre de la trace) est-il cache par la machine ;
 * - onMachine() : le point est-il sur la machine (sinon c'est le fond) ;
 * - rects() : les rectangles cibles des jumeaux, recalcules sans aucune
 *   allocation a chaque frame rendue ou la vue a bouge (meme passe que le
 *   rendu).
 * Tactile : un point hors de toute forme compte encore a moins de 24 px du
 * bord d'un objet dont le dessus se voit ; le centre le plus proche gagne.
 */

import { Matrix4, Vector3, type Camera, type Object3D, type PerspectiveCamera } from 'three';
import { MACHINES, type MachineId } from '../state/focus';
import type { PresetKey } from '../state/presetMode';
import { HIT, type ChipId, type EncId, type Inst, type SectionId } from '../theme';
import type { VoyKnobId } from '../voyager/params';

/**
 * pad (voix), page (pads de navigation), open, step, run, clear, chip
 * (puces du PCB) : une tape (relachement a moins de 6 px et 400 ms) ;
 * encoder : un glisser parti de lui le tourne sur son axe dominant (TEMPO
 * a REVERB, spec 20.17 FX-5), une tape double le remet a sa valeur de
 * depart.
 */
export type HotspotKind =
  | 'pad'
  | 'page'
  | 'open'
  // EDIT du MM-RYTM (2026-10-04) : l'editeur du motif
  | 'edit'
  | 'step'
  | 'run'
  | 'clear'
  | 'mute'
  | 'solo'
  | 'random'
  | 'encoder'
  | 'chip'
  | 'seek'
  // Les presets sur l'ecran (2026-10-04, state/presetMode.ts) : MM-RYTM (lcd), MM-ARP (vlcd)
  | 'lcd'
  | 'vlcd'
  // MM-VOYAGER (2026-10-03) : pads d'accords, pages, OPEN, CLEAR et RANDOM, potards, puces
  | 'vpad'
  | 'vpage'
  | 'vopen'
  | 'vbtn'
  | 'vknob'
  | 'vchip'
  // MM-DECKS (2026-10-04) : potards, faders, touches, jogs
  | 'djknob'
  | 'djfader'
  | 'djkey'
  | 'djjog'
  | 'djscreen';

export interface HotspotDef {
  id: string;
  kind: HotspotKind;
  /** groupe qui porte l'objet (plateauGroup...) : sa matrixWorld le place */
  layer: Object3D;
  /** box : pave ; disc : cylindre vertical de rayon hx (= hz) */
  shape: 'box' | 'disc';
  /** centre et demi-etendues dans le repere du calque ; hauteur y0 a y1 */
  x: number;
  z: number;
  hx: number;
  hz: number;
  y0: number;
  y1: number;
  /** modifiable : les pas 3D se coupent quand le Dock les remplace (mobile) */
  enabled: boolean;
  /** instrument d'un pad de voix */
  inst?: Inst;
  /** numero d'un pas, 0 a 15 */
  index?: number;
  /** section ouverte par un pad de page (ou les puces LIVE et STUDIO) */
  section?: SectionId;
  /** encodeur */
  param?: EncId;
  /** puce du PCB (vue eclatee) */
  chip?: ChipId;
  /** la machine qui le porte (deux machines, 2026-10-03) ; absent : toujours actif */
  machine?: MachineId;
  /** MM-VOYAGER : pad d'accord (0 a 7), bouton, potard */
  vpad?: number;
  vbtn?: 'run' | 'clear' | 'random' | 'edit';
  /** une touche de l'ecran (mode presets) */
  lcd?: PresetKey;
  vknob?: VoyKnobId;
  /** MM-DECKS : l'id de la commande (dj/layout.ts) */
  dj?: string;
}

/**
 * Un volume plein qui cache ce qui est derriere lui, dans le repere de son
 * calque : une boite (min, max), ou un polyedre convexe (demi-espaces
 * [a, b, c, d] : a x + b y + c z + d <= 0 a l'interieur, et ses coins pour
 * la silhouette).
 */
export type Occluder = (
  | { layer: Object3D; min: readonly [number, number, number]; max: readonly [number, number, number] }
  | { layer: Object3D; planes: readonly number[]; corners: readonly number[] }
) & { tag?: MachineId };

/** Vue projetee, donnees simples (window.__v4.hotspots). */
export interface HotspotView {
  id: string;
  kind: HotspotKind;
  shape: 'box' | 'disc';
  enabled: boolean;
  inst?: Inst;
  index?: number;
  section?: SectionId;
  param?: EncId;
  chip?: ChipId;
  machine?: MachineId;
  vpad?: number;
  vbtn?: 'run' | 'clear' | 'random' | 'edit';
  /** une touche de l'ecran (mode presets) */
  lcd?: PresetKey;
  vknob?: VoyKnobId;
  /** rectangle cible : la boite projetee, elargie a 48 x 48 (tactile) ou 32 x 32 (souris) autour du centre */
  x: number;
  y: number;
  w: number;
  h: number;
  /** centre projete du dessus de l'objet */
  cx: number;
  cy: number;
  /** boite englobante projetee exacte (ellipses analytiques pour un cylindre) */
  bx: number;
  by: number;
  bw: number;
  bh: number;
  /** silhouette convexe [x0, y0, x1, y1, ...], px CSS du canvas */
  poly: number[];
}

/** Occulteur ramene a une forme unique : demi-espaces et coins. */
interface Occ {
  layer: Object3D;
  planes: Float64Array;
  corners: Float64Array;
  tag?: MachineId;
}

/** Une boite en six demi-espaces et huit coins. */
function boxOcc(layer: Object3D, min: readonly number[], max: readonly number[]): Occ {
  const planes = new Float64Array([-1, 0, 0, min[0], 1, 0, 0, -max[0], 0, -1, 0, min[1], 0, 1, 0, -max[1], 0, 0, -1, min[2], 0, 0, 1, -max[2]]);
  const corners = new Float64Array(24);
  for (let k = 0; k < 8; k += 1) {
    corners[k * 3] = k & 1 ? max[0] : min[0];
    corners[k * 3 + 1] = k & 2 ? max[1] : min[1];
    corners[k * 3 + 2] = k & 4 ? max[2] : min[2];
  }
  return { layer, planes, corners };
}

const DISC_SEGMENTS = 12;
/** ecart de profondeur (unites) sous lequel deux objets sont a egalite : le centre le plus proche gagne */
const TIE = 0.05;
/** marge de profondeur (unites) : un occulteur doit etre franchement devant */
const EPS = 0.02;
const v = new Vector3();
const o = new Vector3();
const d = new Vector3();
const lo = new Vector3();
const ld = new Vector3();
const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Visible dans la scene : lui et tous ses parents (une machine cachee cache ses calques). */
function shown(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Enveloppe convexe (chaine monotone d'Andrew) ; entree et sortie [x, y, ...]. */
function hull(pts: number[]): number[] {
  const n = pts.length / 2;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => pts[a * 2] - pts[b * 2] || pts[a * 2 + 1] - pts[b * 2 + 1]);
  const cross = (q: number, a: number, b: number): number =>
    (pts[a * 2] - pts[q * 2]) * (pts[b * 2 + 1] - pts[q * 2 + 1]) - (pts[a * 2 + 1] - pts[q * 2 + 1]) * (pts[b * 2] - pts[q * 2]);
  const lower: number[] = [];
  for (const i of idx) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], i) <= 0) lower.pop();
    lower.push(i);
  }
  const upper: number[] = [];
  for (let k = idx.length - 1; k >= 0; k -= 1) {
    const i = idx[k];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], i) <= 0) upper.pop();
    upper.push(i);
  }
  lower.pop();
  upper.pop();
  const out: number[] = [];
  for (const i of lower.concat(upper)) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

/** Point dans un polygone convexe (orientation quelconque). */
function inside(poly: number[], x: number, y: number): boolean {
  const n = poly.length / 2;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i += 1) {
    const ax = poly[i * 2];
    const ay = poly[i * 2 + 1];
    const bx = poly[((i + 1) % n) * 2];
    const by = poly[((i + 1) % n) * 2 + 1];
    const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (c === 0) continue;
    const s = c > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Distance du point au contour du polygone. */
function edgeDistance(poly: number[], x: number, y: number): number {
  const n = poly.length / 2;
  let best = Infinity;
  for (let i = 0; i < n; i += 1) {
    const ax = poly[i * 2];
    const ay = poly[i * 2 + 1];
    const bx = poly[((i + 1) % n) * 2];
    const by = poly[((i + 1) % n) * 2 + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    const ex = ax + t * dx - x;
    const ey = ay + t * dy - y;
    const dist = Math.sqrt(ex * ex + ey * ey);
    if (dist < best) best = dist;
  }
  return best;
}

/** Intervalle [t0, t1] ou le rayon est dans le volume (resultat partage, aucune allocation). */
const span = { t0: 0, t1: 0 };

/** Une dalle [a, b] sur un axe (origine p, direction q) : resserre span ; false si vide. */
function slab(p: number, q: number, a: number, b: number): boolean {
  if (Math.abs(q) < 1e-12) return p >= a && p <= b;
  let ta = (a - p) / q;
  let tb = (b - p) / q;
  if (ta > tb) {
    const s = ta;
    ta = tb;
    tb = s;
  }
  if (ta > span.t0) span.t0 = ta;
  if (tb < span.t1) span.t1 = tb;
  return span.t0 <= span.t1;
}

/** Rayon (repere local) contre un pave ; false s'il le manque. */
function spanBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
  span.t0 = -Infinity;
  span.t1 = Infinity;
  return slab(ox, dx, x0, x1) && slab(oy, dy, y0, y1) && slab(oz, dz, z0, z1);
}

/** Rayon (repere local) contre un cylindre vertical (cx, cz, r, y0 a y1) ; false s'il le manque. */
function spanDisc(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, cx: number, cz: number, r: number, y0: number, y1: number): boolean {
  span.t0 = -Infinity;
  span.t1 = Infinity;
  const px = ox - cx;
  const pz = oz - cz;
  const a = dx * dx + dz * dz;
  const c = px * px + pz * pz - r * r;
  if (a < 1e-12) {
    if (c > 0) return false;
  } else {
    const b = 2 * (px * dx + pz * dz);
    const disc = b * b - 4 * a * c;
    if (disc < 0) return false;
    const s = Math.sqrt(disc);
    span.t0 = (-b - s) / (2 * a);
    span.t1 = (-b + s) / (2 * a);
  }
  return slab(oy, dy, y0, y1);
}

/** Rayon (repere local) contre un polyedre convexe (demi-espaces) ; false s'il le manque. */
function spanPlanes(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, pl: Float64Array): boolean {
  span.t0 = -Infinity;
  span.t1 = Infinity;
  for (let k = 0; k < pl.length; k += 4) {
    const dist = pl[k] * ox + pl[k + 1] * oy + pl[k + 2] * oz + pl[k + 3];
    const den = pl[k] * dx + pl[k + 1] * dy + pl[k + 2] * dz;
    if (Math.abs(den) < 1e-12) {
      if (dist > 0) return false;
      continue;
    }
    const t = -dist / den;
    if (den < 0) {
      if (t > span.t0) span.t0 = t;
    } else if (t < span.t1) span.t1 = t;
    if (span.t0 > span.t1) return false;
  }
  return true;
}

export class HitMap {
  private defs: HotspotDef[] = [];
  private occluders: Occ[] = [];
  /** calques distincts des objets et des occulteurs (plateau, PCB, socle) */
  private layers: Object3D[] = [];
  /** par calque : projection complete (camera x calque) et inverse du calque */
  private mvp: Matrix4[] = [];
  private inv: Matrix4[] = [];
  /** index du calque de chaque objet et de chaque occulteur */
  private defLayer: number[] = [];
  private occLayer: number[] = [];
  private views: HotspotView[] = [];
  private idList: string[] = [];
  /** rectangles cibles des jumeaux [x, y, w, h] par objet, dans l'ordre de la liste */
  private rectBuf = new Float32Array(0);
  /** signature de la derniere projection, reecrite sur place (aucune allocation par frame) */
  private sig: number[] = [];
  private si = 0;
  private sd = false;
  private stale = true;
  private rectsStale = true;
  private prepStale = true;
  /** avance a chaque changement de signature (voir version()) */
  private ver = 0;
  /**
   * Machine dont les objets repondent (2026-10-03) : 'any' (une seule
   * machine sur la table), l'une des deux, ou null (vue d'ensemble, zoom
   * en cours : aucun objet, un clic choisit une machine).
   */
  private active: MachineId | null | 'any' = 'any';

  /** Les objets de cette machine seulement repondent ; null : aucun ; 'any' : tous. */
  setActive(m: MachineId | null | 'any'): void {
    if (m === this.active) return;
    this.active = m;
    this.invalidate();
  }

  private live(def: HotspotDef): boolean {
    return def.enabled && (this.active === 'any' || (def.machine !== undefined ? def.machine === this.active : this.active !== null));
  }

  /**
   * camera : celle du Stage ; size : taille CSS du canvas ; coarse : le
   * pointeur principal est-il grossier (rectangles cibles 48 px).
   */
  constructor(
    private camera: Camera,
    private size: () => { w: number; h: number },
    private coarse: () => boolean
  ) {}

  private layerIndex(l: Object3D): number {
    let i = this.layers.indexOf(l);
    if (i < 0) {
      i = this.layers.length;
      this.layers.push(l);
      this.mvp.push(new Matrix4());
      this.inv.push(new Matrix4());
    }
    return i;
  }

  add(defs: readonly HotspotDef[]): void {
    for (const def of defs) {
      this.defs.push(def);
      this.defLayer.push(this.layerIndex(def.layer));
      this.idList.push(def.id);
    }
    this.rectBuf = new Float32Array(this.defs.length * 4);
    this.invalidate();
  }

  /** Un volume de la machine qui cache ce qui est derriere lui (dalle du panneau, coin du chassis, carte). */
  addOccluder(occ: Occluder): void {
    const o: Occ = 'min' in occ ? boxOcc(occ.layer, occ.min, occ.max) : { layer: occ.layer, planes: new Float64Array(occ.planes), corners: new Float64Array(occ.corners) };
    o.tag = occ.tag;
    this.occluders.push(o);
    this.occLayer.push(this.layerIndex(occ.layer));
    this.invalidate();
  }

  /** Force la prochaine projection (debug : window.__v4.reproject). */
  invalidate(): void {
    this.stale = true;
    this.rectsStale = true;
    this.prepStale = true;
  }

  /** Les ids des objets, dans l'ordre de la liste (et de rects()). */
  ids(): readonly string[] {
    return this.idList;
  }

  /**
   * Numero de la vue : il avance a chaque changement de signature (camera,
   * calques, taille). Compare la signature sans reprojeter ni allouer.
   */
  version(): number {
    this.sync();
    return this.ver;
  }

  /** Vues a jour (reprojetees si besoin). */
  list(): HotspotView[] {
    this.refresh();
    return this.views;
  }

  /** Une valeur de la signature, comparee et ecrite sur place. */
  private put(val: number): void {
    const s = this.sig;
    if (this.si >= s.length) {
      s.push(val);
      this.sd = true;
    } else if (s[this.si] !== val) {
      s[this.si] = val;
      this.sd = true;
    }
    this.si += 1;
  }

  private putMatrix(e: ArrayLike<number>): void {
    for (let k = 0; k < 16; k += 1) this.put(e[k]);
  }

  /**
   * Signature de tout ce qui deplace les silhouettes (taille, pointeur,
   * camera, calques, drapeaux) ; marque tout a refaire si elle a change.
   * Appelee a chaque frame rendue (jumeaux) : aucune allocation.
   */
  private sync(): void {
    this.si = 0;
    this.sd = false;
    const box = this.size();
    const cam = this.camera;
    cam.updateMatrixWorld();
    this.put(box.w);
    this.put(box.h);
    this.put(this.coarse() ? 1 : 0);
    this.putMatrix(cam.projectionMatrix.elements);
    this.putMatrix(cam.matrixWorld.elements);
    const layers = this.layers;
    for (let i = 0; i < layers.length; i += 1) {
      const l = layers[i];
      l.updateWorldMatrix(true, false);
      this.putMatrix(l.matrixWorld.elements);
      this.put(shown(l) ? 1 : 0);
    }
    this.put(this.active === 'any' ? 2 : this.active === null ? 0 : this.active === 'mm808' ? 3 : this.active === 'voy' ? 4 : 5);
    const defs = this.defs;
    for (let i = 0; i < defs.length; i += 1) this.put(defs[i].enabled ? 1 : 0);
    if (this.sig.length !== this.si) {
      this.sig.length = this.si;
      this.sd = true;
    }
    if (this.sd) {
      this.ver += 1;
      this.stale = true;
      this.rectsStale = true;
      this.prepStale = true;
    }
  }

  /** Matrices par calque (projection complete, inverse), refaites quand la vue a bouge. */
  private prepare(): void {
    if (!this.prepStale) return;
    this.prepStale = false;
    const cam = this.camera;
    for (let i = 0; i < this.layers.length; i += 1) {
      const m = this.layers[i].matrixWorld;
      this.mvp[i].multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).multiply(m);
      this.inv[i].copy(m).invert();
    }
  }

  /** Point du calque li en px CSS du canvas, ecrit dans px / py (aucune allocation). */
  private px = 0;
  private py = 0;
  private toPx(li: number, x: number, y: number, z: number): void {
    const e = this.mvp[li].elements;
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    const nx = (e[0] * x + e[4] * y + e[8] * z + e[12]) / w;
    const ny = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w;
    const s = this.size();
    this.px = ((nx + 1) / 2) * s.w;
    this.py = ((1 - ny) / 2) * s.h;
  }

  /**
   * Rectangle cible de l'objet i dans out[o..o+3] : sa boite projetee
   * exacte (8 coins d'un pave, ou les deux ellipses d'un cylindre, en
   * orthographique), elargie a min x min autour du centre de son dessus ;
   * renvoie aussi la boite brute et le centre dans box.
   */
  private box = { x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0 };
  private rectOf(i: number, min: number, out: Float32Array, off: number): void {
    const def = this.defs[i];
    const li = this.defLayer[i];
    const b = this.box;
    b.x0 = Infinity;
    b.y0 = Infinity;
    b.x1 = -Infinity;
    b.y1 = -Infinity;
    if (def.shape === 'box') {
      for (let k = 0; k < 8; k += 1) {
        this.toPx(li, def.x + (k & 1 ? def.hx : -def.hx), k & 2 ? def.y1 : def.y0, def.z + (k & 4 ? def.hz : -def.hz));
        if (this.px < b.x0) b.x0 = this.px;
        if (this.px > b.x1) b.x1 = this.px;
        if (this.py < b.y0) b.y0 = this.py;
        if (this.py > b.y1) b.y1 = this.py;
      }
    } else {
      // Ellipse projetee d'un cercle horizontal : demi-axes ecran (exacts en
      // orthographique, a la profondeur du centre en perspective)
      const e = this.mvp[li].elements;
      const s = this.size();
      const wc = Math.abs(e[3] * def.x + e[7] * def.y1 + e[11] * def.z + e[15]) || 1;
      const ex = (def.hx * (s.w / 2) * Math.hypot(e[0], e[8])) / wc;
      const ey = (def.hx * (s.h / 2) * Math.hypot(e[1], e[9])) / wc;
      for (let k = 0; k < 2; k += 1) {
        this.toPx(li, def.x, k ? def.y1 : def.y0, def.z);
        if (this.px - ex < b.x0) b.x0 = this.px - ex;
        if (this.px + ex > b.x1) b.x1 = this.px + ex;
        if (this.py - ey < b.y0) b.y0 = this.py - ey;
        if (this.py + ey > b.y1) b.y1 = this.py + ey;
      }
    }
    this.toPx(li, def.x, def.y1, def.z);
    b.cx = this.px;
    b.cy = this.py;
    const tx0 = Math.min(b.x0, b.cx - min / 2);
    const tx1 = Math.max(b.x1, b.cx + min / 2);
    const ty0 = Math.min(b.y0, b.cy - min / 2);
    const ty1 = Math.max(b.y1, b.cy + min / 2);
    out[off] = tx0;
    out[off + 1] = ty0;
    out[off + 2] = tx1 - tx0;
    out[off + 3] = ty1 - ty0;
  }

  /**
   * Rectangles cibles des jumeaux, [x, y, w, h] par objet dans l'ordre de
   * ids() ; refaits seulement si la vue a bouge, sans allocation (appele
   * dans la passe de rendu, a chaque frame rendue).
   */
  rects(): Float32Array {
    this.sync();
    if (this.rectsStale) {
      this.rectsStale = false;
      this.prepare();
      const min = this.coarse() ? HIT.minCoarse : HIT.minFine;
      for (let i = 0; i < this.defs.length; i += 1) this.rectOf(i, min, this.rectBuf, i * 4);
    }
    return this.rectBuf;
  }

  private refresh(): void {
    this.sync();
    if (!this.stale) return;
    this.stale = false;
    this.prepare();
    const min = this.coarse() ? HIT.minCoarse : HIT.minFine;
    const rect = new Float32Array(4);
    this.views = this.defs.map((def, i) => {
      const li = this.defLayer[i];
      const pts: number[] = [];
      const push = (x: number, y: number, z: number): void => {
        this.toPx(li, x, y, z);
        pts.push(this.px, this.py);
      };
      if (def.shape === 'box') {
        for (const y of [def.y0, def.y1]) {
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) push(def.x + sx * def.hx, y, def.z + sz * def.hz);
        }
      } else {
        for (const y of [def.y0, def.y1]) {
          for (let k = 0; k < DISC_SEGMENTS; k += 1) {
            const a = (k / DISC_SEGMENTS) * Math.PI * 2;
            push(def.x + Math.cos(a) * def.hx, y, def.z + Math.sin(a) * def.hz);
          }
        }
      }
      const poly = hull(pts);
      this.rectOf(i, min, rect, 0);
      const b = this.box;
      return {
        id: def.id,
        kind: def.kind,
        shape: def.shape,
        enabled: this.live(def) && shown(def.layer),
        ...(def.inst ? { inst: def.inst } : {}),
        ...(def.index !== undefined ? { index: def.index } : {}),
        ...(def.section ? { section: def.section } : {}),
        ...(def.param ? { param: def.param } : {}),
        ...(def.chip ? { chip: def.chip } : {}),
        ...(def.machine ? { machine: def.machine } : {}),
        ...(def.vpad !== undefined ? { vpad: def.vpad } : {}),
        ...(def.vbtn ? { vbtn: def.vbtn } : {}),
        ...(def.lcd ? { lcd: def.lcd } : {}),
        ...(def.vknob ? { vknob: def.vknob } : {}),
        x: r1(rect[0]),
        y: r1(rect[1]),
        w: r1(rect[2]),
        h: r1(rect[3]),
        cx: r1(b.cx),
        cy: r1(b.cy),
        bx: r1(b.x0),
        by: r1(b.y0),
        bw: r1(b.x1 - b.x0),
        bh: r1(b.y1 - b.y0),
        poly: poly.map(r1),
      };
    });
  }

  /** Un point (px CSS) d'un calque : projete dans out (aucune allocation). */
  project(layer: Object3D, x: number, y: number, z: number, out: { x: number; y: number }): { x: number; y: number } {
    // Un calque inconnu allonge la signature : sync() fait alors tout recalculer
    const li = this.layerIndex(layer);
    this.sync();
    this.prepare();
    this.toPx(li, x, y, z);
    out.x = this.px;
    out.y = this.py;
    return out;
  }

  /** Bord droit projete de la machine (px) : les 8 coins des occulteurs visibles. */
  rightEdge(): number {
    this.sync();
    this.prepare();
    let best = -Infinity;
    for (let j = 0; j < this.occluders.length; j += 1) {
      const oc = this.occluders[j];
      if (!shown(oc.layer)) continue;
      const c = oc.corners;
      for (let k = 0; k < c.length; k += 3) {
        this.toPx(this.occLayer[j], c[k], c[k + 1], c[k + 2]);
        if (this.px > best) best = this.px;
      }
    }
    return best;
  }

  /**
   * Le point (x, y, z) du calque se voit-il depuis la camera ? Son calque
   * est visible, et le rayon qui en part vers la camera ne traverse ni un
   * occulteur ni un autre objet (ignoreId excepte ; occludersOnly : les
   * occulteurs seulement). Pointeurs et trace seulement, jamais par frame
   * de rendu sans elle.
   */
  visible(layer: Object3D, x: number, y: number, z: number, ignoreId?: string, occludersOnly = false): boolean {
    for (let p: Object3D | null = layer; p; p = p.parent) if (!p.visible) return false;
    this.sync();
    this.prepare();
    // Monde : le point, et la direction vers la camera (perspective : vers
    // son centre ; orthographique : la meme partout)
    o.set(x, y, z).applyMatrix4(layer.matrixWorld);
    if ((this.camera as PerspectiveCamera).isPerspectiveCamera) d.setFromMatrixPosition(this.camera.matrixWorld).sub(o).normalize();
    else d.set(0, 0, 1).transformDirection(this.camera.matrixWorld);
    for (let j = 0; j < this.occluders.length; j += 1) {
      const oc = this.occluders[j];
      if (!shown(oc.layer)) continue;
      const inv = this.inv[this.occLayer[j]];
      lo.copy(o).applyMatrix4(inv);
      ld.copy(d).transformDirection(inv);
      if (spanPlanes(lo.x, lo.y, lo.z, ld.x, ld.y, ld.z, oc.planes) && span.t1 > EPS) return false;
    }
    if (occludersOnly) return true;
    for (let i = 0; i < this.defs.length; i += 1) {
      const def = this.defs[i];
      if (def.id === ignoreId || !shown(def.layer)) continue;
      const inv = this.inv[this.defLayer[i]];
      lo.copy(o).applyMatrix4(inv);
      ld.copy(d).transformDirection(inv);
      if (this.spanOf(def) && span.t1 > EPS) return false;
    }
    return true;
  }

  /** Le rayon courant (lo, ld, repere local) contre le volume d'un objet. */
  private spanOf(def: HotspotDef): boolean {
    return def.shape === 'box'
      ? spanBox(lo.x, lo.y, lo.z, ld.x, ld.y, ld.z, def.x - def.hx, def.y0, def.z - def.hz, def.x + def.hx, def.y1, def.z + def.hz)
      : spanDisc(lo.x, lo.y, lo.z, ld.x, ld.y, ld.z, def.x, def.z, def.hx, def.y0, def.y1);
  }

  /** Le point (px CSS du canvas) est-il sur la machine : l'enveloppe des occulteurs visibles. */
  onMachine(x: number, y: number): boolean {
    this.sync();
    this.prepare();
    const pts: number[] = [];
    for (let j = 0; j < this.occluders.length; j += 1) {
      const oc = this.occluders[j];
      if (!shown(oc.layer)) continue;
      const c = oc.corners;
      for (let k = 0; k < c.length; k += 3) {
        this.toPx(this.occLayer[j], c[k], c[k + 1], c[k + 2]);
        pts.push(this.px, this.py);
      }
    }
    return pts.length >= 6 && inside(hull(pts), x, y);
  }

  /**
   * La machine sous le point (px CSS du canvas) : l'enveloppe des
   * occulteurs visibles de chacune ; null sur le fond (2026-10-03).
   */
  machineAt(x: number, y: number): MachineId | null {
    this.sync();
    this.prepare();
    for (const tag of MACHINES) {
      const pts = this.hullPoints(tag);
      if (pts.length >= 6 && inside(hull(pts), x, y)) return tag;
    }
    return null;
  }

  /** Boite projetee d'une machine (px CSS du canvas), null si elle est cachee. */
  machineBox(tag: MachineId): { x: number; y: number; w: number; h: number } | null {
    this.sync();
    this.prepare();
    const pts = this.hullPoints(tag);
    if (pts.length < 6) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let k = 0; k < pts.length; k += 2) {
      if (pts[k] < x0) x0 = pts[k];
      if (pts[k] > x1) x1 = pts[k];
      if (pts[k + 1] < y0) y0 = pts[k + 1];
      if (pts[k + 1] > y1) y1 = pts[k + 1];
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  private hullPoints(tag: MachineId): number[] {
    const pts: number[] = [];
    for (let j = 0; j < this.occluders.length; j += 1) {
      const oc = this.occluders[j];
      if ((oc.tag ?? 'mm808') !== tag || !shown(oc.layer)) continue;
      const c = oc.corners;
      for (let k = 0; k < c.length; k += 3) {
        this.toPx(this.occLayer[j], c[k], c[k + 1], c[k + 2]);
        pts.push(this.px, this.py);
      }
    }
    return pts;
  }

  /** Rayon de vue du point ecran (x, y) : origine sur le plan proche (o), direction (d), monde. */
  private ray(x: number, y: number): void {
    const s = this.size();
    // Du plan proche au plan lointain : juste en perspective comme en orthographique
    const nx = (x / s.w) * 2 - 1;
    const ny = 1 - (y / s.h) * 2;
    o.set(nx, ny, -1).unproject(this.camera);
    d.set(nx, ny, 1).unproject(this.camera).sub(o).normalize();
  }

  /**
   * Entree du rayon courant (o, d) dans l'objet i, en unites depuis le plan
   * proche ; Infinity s'il le manque (bord numerique).
   */
  private entry(i: number): number {
    const inv = this.inv[this.defLayer[i]];
    lo.copy(o).applyMatrix4(inv);
    ld.copy(d).transformDirection(inv);
    return this.spanOf(this.defs[i]) && span.t1 >= 0 ? Math.max(0, span.t0) : Infinity;
  }

  /** Un occulteur coupe-t-il le rayon courant avant t ? */
  private blocked(t: number): boolean {
    for (let j = 0; j < this.occluders.length; j += 1) {
      const oc = this.occluders[j];
      if (!shown(oc.layer)) continue;
      const inv = this.inv[this.occLayer[j]];
      lo.copy(o).applyMatrix4(inv);
      ld.copy(d).transformDirection(inv);
      if (spanPlanes(lo.x, lo.y, lo.z, ld.x, ld.y, ld.z, oc.planes) && span.t1 >= 0 && Math.max(0, span.t0) < t - EPS) return true;
    }
    return false;
  }

  /**
   * L'objet sous le point (px CSS du canvas), ou null. Dans une forme : le
   * plus proche le long du rayon de vue parmi celles qui le contiennent,
   * sauf ceux qu'un occulteur cache (egalite a 0.05 pres : le centre le plus
   * proche). Tactile (coarse) : sinon, parmi les objets a moins de 24 px de
   * leur bord et dont le dessus se voit, le centre le plus proche.
   */
  pick(x: number, y: number, coarse: boolean): HotspotView | null {
    this.refresh();
    const views = this.views;
    const cand: number[] = [];
    for (let i = 0; i < views.length; i += 1) if (views[i].enabled && inside(views[i].poly, x, y)) cand.push(i);
    if (cand.length > 0) {
      this.ray(x, y);
      const t: number[] = [];
      let minT = Infinity;
      for (const i of cand) {
        let ti = this.entry(i);
        // Bord numerique : la profondeur du centre du dessus
        if (!Number.isFinite(ti)) {
          v.set(this.defs[i].x, this.defs[i].y1, this.defs[i].z).applyMatrix4(this.defs[i].layer.matrixWorld);
          ti = v.sub(o).dot(d);
        }
        const hidden = this.blocked(ti);
        t.push(hidden ? Infinity : ti);
        if (!hidden && ti < minT) minT = ti;
      }
      if (Number.isFinite(minT)) {
        let best: HotspotView | null = null;
        let bestD = Infinity;
        cand.forEach((i, k) => {
          if (t[k] > minT + TIE) return;
          const hv = views[i];
          const dd = (hv.cx - x) ** 2 + (hv.cy - y) ** 2;
          if (dd < bestD) {
            bestD = dd;
            best = hv;
          }
        });
        if (best) return best;
      }
    }
    if (!coarse) return null;
    let best: HotspotView | null = null;
    let bestD = Infinity;
    for (let i = 0; i < views.length; i += 1) {
      const hv = views[i];
      if (!hv.enabled || edgeDistance(hv.poly, x, y) > HIT.touchSlop) continue;
      const def = this.defs[i];
      if (!this.visible(def.layer, def.x, def.y1, def.z, def.id, true)) continue;
      const dd = (hv.cx - x) ** 2 + (hv.cy - y) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = hv;
      }
    }
    return best;
  }
}
