/**
 * Picking en espace ecran (spec 6.2, decision 1). Chaque objet interactif
 * est declare dans une liste explicite : une boite (ou un cylindre) dans
 * le repere de son calque. Sa silhouette projetee (enveloppe convexe des
 * coins, en px CSS du canvas) est la forme de clic. Le test ne tourne
 * qu'au pointerdown / pointermove, jamais dans la boucle de rendu ; la
 * projection n'est refaite que si la camera, la parallaxe, un calque ou la
 * taille du canvas ont bouge (signature des matrices), et seulement quand
 * on la lit (pick, list) : les jumeaux ne la lisent qu'au repos ou quand
 * l'un d'eux a le focus (version() compare la signature sans reprojeter).
 * Tactile : un point hors de toute forme compte encore a moins de 24 px du
 * bord d'un objet ; plusieurs candidats, le centre le plus proche gagne.
 */

import { Vector3, type Camera, type Object3D } from 'three';
import { HIT, type ChipId, type Inst, type NavId } from '../theme';

/**
 * pad : part au pointerdown ; step, run, clear, knob (navigation), open,
 * chip (puces du PCB) : au relachement ; tempo, tone, level : glisser
 * vertical (potards).
 */
export type HotspotKind = 'pad' | 'step' | 'run' | 'clear' | 'tempo' | 'knob' | 'tone' | 'level' | 'open' | 'chip';

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
  /** instrument d'un pad */
  inst?: Inst;
  /** numero d'un pas, 0 a 15 */
  index?: number;
  /** section ouverte par un knob de navigation */
  section?: NavId;
  /** puce du PCB (vue eclatee) */
  chip?: ChipId;
}

/** Vue projetee, donnees simples (window.__v4.hotspots). */
export interface HotspotView {
  id: string;
  kind: HotspotKind;
  shape: 'box' | 'disc';
  enabled: boolean;
  inst?: Inst;
  index?: number;
  section?: NavId;
  chip?: ChipId;
  /** rectangle cible : la boite projetee, elargie a 48 x 48 (tactile) ou 32 x 32 (souris) autour du centre */
  x: number;
  y: number;
  w: number;
  h: number;
  /** centre projete du dessus de l'objet */
  cx: number;
  cy: number;
  /** boite englobante projetee brute de la silhouette */
  bx: number;
  by: number;
  bw: number;
  bh: number;
  /** silhouette convexe [x0, y0, x1, y1, ...], px CSS du canvas */
  poly: number[];
}

const DISC_SEGMENTS = 12;
const v = new Vector3();
const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Enveloppe convexe (chaine monotone d'Andrew) ; entree et sortie [x, y, ...]. */
function hull(pts: number[]): number[] {
  const n = pts.length / 2;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => pts[a * 2] - pts[b * 2] || pts[a * 2 + 1] - pts[b * 2 + 1]);
  const cross = (o: number, a: number, b: number): number =>
    (pts[a * 2] - pts[o * 2]) * (pts[b * 2 + 1] - pts[o * 2 + 1]) - (pts[a * 2 + 1] - pts[o * 2 + 1]) * (pts[b * 2] - pts[o * 2]);
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
    const d = Math.sqrt(ex * ex + ey * ey);
    if (d < best) best = d;
  }
  return best;
}

export class HitMap {
  private defs: HotspotDef[] = [];
  /** calques distincts des objets (plateau, PCB) */
  private layers: Object3D[] = [];
  private views: HotspotView[] = [];
  /** signature de la derniere projection, reecrite sur place (aucune allocation par frame) */
  private sig: number[] = [];
  private si = 0;
  private sd = false;
  private stale = true;
  /** avance a chaque changement de signature (voir version()) */
  private ver = 0;

  /**
   * camera : celle du Stage ; size : taille CSS du canvas ; coarse : le
   * pointeur principal est-il grossier (rectangles cibles 48 px).
   */
  constructor(
    private camera: Camera,
    private size: () => { w: number; h: number },
    private coarse: () => boolean
  ) {}

  add(defs: readonly HotspotDef[]): void {
    this.defs.push(...defs);
    for (const d of defs) if (!this.layers.includes(d.layer)) this.layers.push(d.layer);
    this.stale = true;
  }

  /** Force la prochaine projection (debug : window.__v4.reproject). */
  invalidate(): void {
    this.stale = true;
  }

  /**
   * Numero de la vue : il avance a chaque changement de signature (camera,
   * calques, taille), qui que ce soit qui l'ait vu (pick, list, version).
   * Compare la signature sans reprojeter ni allouer ; la prochaine lecture
   * reprojettera. Deux frames de suite au meme numero : la vue est posee.
   */
  version(): number {
    if (this.changed()) this.stale = true;
    return this.ver;
  }

  /** Vues a jour (reprojetees si besoin). */
  list(): HotspotView[] {
    this.refresh();
    return this.views;
  }

  /** Une valeur de la signature, comparee et ecrite sur place. */
  private put(v: number): void {
    const s = this.sig;
    if (this.si >= s.length) {
      s.push(v);
      this.sd = true;
    } else if (s[this.si] !== v) {
      s[this.si] = v;
      this.sd = true;
    }
    this.si += 1;
  }

  private putMatrix(e: ArrayLike<number>): void {
    for (let k = 0; k < 16; k += 1) this.put(e[k]);
  }

  /**
   * Signature de tout ce qui deplace les silhouettes (taille, pointeur,
   * camera, calques, drapeaux) ; true si elle a change. Appelee a chaque
   * frame rendue (jumeaux) : aucune allocation.
   */
  private changed(): boolean {
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
      this.put(l.visible ? 1 : 0);
    }
    const defs = this.defs;
    for (let i = 0; i < defs.length; i += 1) this.put(defs[i].enabled ? 1 : 0);
    if (this.sig.length !== this.si) {
      this.sig.length = this.si;
      this.sd = true;
    }
    if (this.sd) this.ver += 1;
    return this.sd;
  }

  private refresh(): void {
    if (!this.changed() && !this.stale) return;
    this.stale = false;
    const { w: W, h: H } = this.size();
    const cam = this.camera;
    const min = this.coarse() ? HIT.minCoarse : HIT.minFine;
    const toPx = (x: number, y: number, z: number, m: Object3D['matrixWorld'], out: number[]): void => {
      v.set(x, y, z).applyMatrix4(m).project(cam);
      out.push(((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H);
    };
    this.views = this.defs.map((d) => {
      const m = d.layer.matrixWorld;
      const pts: number[] = [];
      if (d.shape === 'box') {
        for (const y of [d.y0, d.y1]) {
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) toPx(d.x + sx * d.hx, y, d.z + sz * d.hz, m, pts);
        }
      } else {
        for (const y of [d.y0, d.y1]) {
          for (let k = 0; k < DISC_SEGMENTS; k += 1) {
            const a = (k / DISC_SEGMENTS) * Math.PI * 2;
            toPx(d.x + Math.cos(a) * d.hx, y, d.z + Math.sin(a) * d.hz, m, pts);
          }
        }
      }
      const poly = hull(pts);
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < poly.length; i += 2) {
        x0 = Math.min(x0, poly[i]);
        x1 = Math.max(x1, poly[i]);
        y0 = Math.min(y0, poly[i + 1]);
        y1 = Math.max(y1, poly[i + 1]);
      }
      const c: number[] = [];
      toPx(d.x, d.y1, d.z, m, c);
      const [cx, cy] = c;
      // Rectangle cible : la boite brute, et au moins min x min autour du centre
      const tx0 = Math.min(x0, cx - min / 2);
      const tx1 = Math.max(x1, cx + min / 2);
      const ty0 = Math.min(y0, cy - min / 2);
      const ty1 = Math.max(y1, cy + min / 2);
      return {
        id: d.id,
        kind: d.kind,
        shape: d.shape,
        enabled: d.enabled && d.layer.visible,
        ...(d.inst ? { inst: d.inst } : {}),
        ...(d.index !== undefined ? { index: d.index } : {}),
        ...(d.section ? { section: d.section } : {}),
        ...(d.chip ? { chip: d.chip } : {}),
        x: r1(tx0),
        y: r1(ty0),
        w: r1(tx1 - tx0),
        h: r1(ty1 - ty0),
        cx: r1(cx),
        cy: r1(cy),
        bx: r1(x0),
        by: r1(y0),
        bw: r1(x1 - x0),
        bh: r1(y1 - y0),
        poly: poly.map(r1),
      };
    });
  }

  /**
   * L'objet sous le point (px CSS du canvas), ou null. Dans une forme :
   * le centre le plus proche parmi celles qui le contiennent. Tactile
   * (coarse) : sinon, parmi les objets a moins de 24 px de leur bord.
   */
  pick(x: number, y: number, coarse: boolean): HotspotView | null {
    this.refresh();
    const hit = this.nearest(x, y, (hv) => inside(hv.poly, x, y));
    if (hit || !coarse) return hit;
    return this.nearest(x, y, (hv) => edgeDistance(hv.poly, x, y) <= HIT.touchSlop);
  }

  private nearest(x: number, y: number, test: (hv: HotspotView) => boolean): HotspotView | null {
    let best: HotspotView | null = null;
    let bestD = Infinity;
    for (const hv of this.views) {
      if (!hv.enabled || !test(hv)) continue;
      const d = (hv.cx - x) ** 2 + (hv.cy - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = hv;
      }
    }
    return best;
  }
}
