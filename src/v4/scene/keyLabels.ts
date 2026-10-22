/**
 * Les noms imprimes sur les touches du MM-RYTM (2026-10-18, Mika : "au lieu
 * d'ecrire les choses en dessous des boutons je voudrais que ce soit ecrit
 * directement sur le bouton ; j'aime le format des boutons VOICE et FLTR etc.,
 * je veux juste que ce soit ecrit dessus et quand c'est selectionne que ce soit
 * plus voyant") : VOICE FLTR ENV FX et RUN/STOP CLEAR RANDOM MUTE SOLO (theme.ts
 * KEY_LABELS), plus sur la serigraphie sous elles.
 *
 * UNE texture pour tous (KeyLabelAtlas) : chaque nom deux fois, l'encre de la
 * serigraphie (l'os sur la machine noire, le gris sur la claire ; RUN/STOP
 * toujours en os, sur son rouge) pour une touche eteinte, le noir pour une
 * touche allumee (theme.ts KEY_LIT) ; 128 px de haut par cellule (net au DPR 2
 * et 3, les mipmaps font le reste), la police et l'interlettrage de la
 * serigraphie (SILK, FONT_DISPLAY), le corps reduit pour tenir, le plus petit
 * de son groupe pour tous (comme silk.ts). Redessinee quand les polices du
 * site arrivent (renderer.ts gate).
 *
 * Les plans (KeyLabels) : un maillage par rangee de touches (les touches de
 * page, le transport : deux draw calls), un quad par touche, couche sur son
 * dessus un rien au-dessus (polygonOffset, depthWrite false : aucun z-fight
 * avec la touche) ; setDy le fait descendre avec sa touche quand elle
 * s'enfonce (les touches sont des InstancedMesh : le quad suit la meme
 * translation), setLit choisit sa variante (les uv de sa cellule). Matiere
 * eclairee comme la serigraphie (roughness 0.7) : le nom se lit comme elle.
 */

import { BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial, type CanvasTexture } from 'three';
import { APPEARANCE, FONT_DISPLAY, KEY_LABEL, SILK, type KeyLabelSpec } from '../theme';
import { drawTracked, makeCanvasTexture, trackedWidth } from './silk';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/** La hauteur d'une cellule de l'atlas, en px (la hauteur du quad). */
const CELL_H = 128;
/** La hauteur du quad : tant de fois la hauteur de capitale (l'air au-dessus et au-dessous du nom). */
const QUAD_CAPS = 2.2;
/** Le noir d'un nom sur une touche allumee ; l'os de RUN/STOP au repos. */
const DARK_INK = 'rgba(14, 14, 16, 0.92)';
const BONE_INK = 'rgba(246, 241, 231, 0.92)';

/** Le quad d'un nom sur sa touche, en unites : sa largeur (la touche moins l'air des deux bouts) et sa profondeur. */
export const labelQuad = (s: KeyLabelSpec): { w: number; h: number } => ({ w: Math.max(0.1, s.w - 2 * KEY_LABEL.margin), h: KEY_LABEL.cap * QUAD_CAPS });

interface Cell {
  /** la rangee de la cellule (depuis le haut du canvas) */
  row: number;
  /** sa largeur en px */
  w: number;
}

export interface KeyLabelAtlasInfo {
  draws: number;
  size: [number, number];
  /** le corps de chaque groupe apres ajustement, en part du corps voulu */
  fit: Record<string, number>;
  font: string;
}

export class KeyLabelAtlas {
  readonly texture: CanvasTexture;
  readonly info: KeyLabelAtlasInfo;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  /** px de l'atlas par unite de scene */
  private ppu: number;
  private colW: number;
  private cells = new Map<string, Cell>();

  constructor(
    private specs: readonly KeyLabelSpec[],
    anisotropy: number
  ) {
    this.ppu = CELL_H / (KEY_LABEL.cap * QUAD_CAPS);
    this.colW = Math.ceil(Math.max(...specs.map((s) => labelQuad(s).w)) * this.ppu);
    specs.forEach((s, i) => this.cells.set(s.id, { row: i, w: Math.ceil(labelQuad(s).w * this.ppu) }));
    this.canvas = document.createElement('canvas');
    // Deux colonnes : la variante eteinte a gauche, l'allumee a droite
    this.canvas.width = 2 * this.colW;
    this.canvas.height = specs.length * CELL_H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('keyLabels: no 2d context');
    this.ctx = ctx as Ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    this.info = { draws: 0, size: [this.canvas.width, this.canvas.height], fit: {}, font: '' };
    this.draw();
  }

  /** Redessine tous les noms (les polices du site arrivees) et marque la texture. */
  draw(): void {
    const ctx = this.ctx;
    const u = this.ppu;
    const weight = KEY_LABEL.weight;
    const px = (KEY_LABEL.cap / SILK.capRatio) * u;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.textBaseline = 'alphabetic';
    // Le corps : le nom tient dans son quad, le plus petit de son groupe pour tous
    const fit = this.specs.map((s) => {
      const room = this.cells.get(s.id)?.w ?? 0;
      const w = trackedWidth(ctx, s.text, px, weight);
      return w > room ? room / w : 1;
    });
    const group = new Map<string, number>();
    this.specs.forEach((s, i) => group.set(s.group, Math.min(group.get(s.group) ?? 1, fit[i])));
    this.specs.forEach((s) => {
      const c = this.cells.get(s.id);
      if (!c) return;
      const k = group.get(s.group) ?? 1;
      const size = px * k;
      const cap = KEY_LABEL.cap * u * k;
      const w = trackedWidth(ctx, s.text, size, weight);
      const top = c.row * CELL_H;
      const base = top + CELL_H / 2 + cap / 2;
      for (const lit of [false, true]) {
        // L'encre au repos (2026-10-22, audit SB-06) : pleine, plus celle de la serigraphie a 85 %
        ctx.fillStyle = lit ? DARK_INK : s.rest === 'bone' ? BONE_INK : KEY_LABEL.inkRest[APPEARANCE.current === 'light' ? 'light' : 'dark'];
        drawTracked(ctx, s.text, (lit ? this.colW : 0) + (c.w - w) / 2, base, size, weight);
      }
    });
    this.info.draws += 1;
    this.info.fit = Object.fromEntries([...group].map(([g, k]) => [g, +k.toFixed(3)]));
    this.info.font = `${weight} ${px.toFixed(1)}px ${FONT_DISPLAY}`;
    this.texture.needsUpdate = true;
  }

  /** Les uv de la cellule d'un nom (la texture est retournee : la rangee 0 du canvas est en haut, v = 1). */
  uv(id: string, lit: boolean): { u0: number; u1: number; v0: number; v1: number } {
    const c = this.cells.get(id);
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!c) return { u0: 0, u1: 0, v0: 0, v1: 0 };
    const x0 = lit ? this.colW : 0;
    return { u0: x0 / W, u1: (x0 + c.w) / W, v0: 1 - (c.row * CELL_H) / H, v1: 1 - ((c.row + 1) * CELL_H) / H };
  }

  dispose(): void {
    this.texture.dispose();
    // Libere la memoire du canvas tout de suite (Safari la garde sinon)
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}

/** Les noms d'une rangee de touches : un maillage, un quad par touche, dans l'ordre donne. */
export class KeyLabels {
  readonly mesh: Mesh;
  private geo: BufferGeometry;
  private mat: MeshStandardMaterial;
  private pos: BufferAttribute;
  private uvs: BufferAttribute;
  private lit: boolean[];
  /** le y du dessus des touches, au repos */
  private y: number;

  constructor(
    private atlas: KeyLabelAtlas,
    private specs: readonly KeyLabelSpec[],
    keyH: number,
    name: string
  ) {
    const n = specs.length;
    this.y = keyH + 0.003;
    this.lit = specs.map(() => false);
    const p = new Float32Array(n * 12);
    const nrm = new Float32Array(n * 12);
    const idx: number[] = [];
    specs.forEach((s, i) => {
      const q = labelQuad(s);
      const x0 = s.x - q.w / 2;
      const x1 = s.x + q.w / 2;
      const zc = s.z + KEY_LABEL.dz;
      const z0 = zc - q.h / 2;
      const z1 = zc + q.h / 2;
      // Arriere gauche, arriere droit, avant gauche, avant droit : le haut du nom vers l'arriere, il se lit le long de +x
      p.set([x0, this.y, z0, x1, this.y, z0, x0, this.y, z1, x1, this.y, z1], i * 12);
      for (let k = 0; k < 4; k += 1) nrm[i * 12 + k * 3 + 1] = 1;
      const o = i * 4;
      // Face vers le haut (+y) : (AG, VG, AD) et (AD, VG, VD)
      idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
    });
    this.geo = new BufferGeometry();
    this.pos = new BufferAttribute(p, 3);
    this.uvs = new BufferAttribute(new Float32Array(n * 8), 2);
    this.geo.setAttribute('position', this.pos);
    this.geo.setAttribute('normal', new BufferAttribute(nrm, 3));
    this.geo.setAttribute('uv', this.uvs);
    this.geo.setIndex(idx);
    specs.forEach((_, i) => this.writeUv(i));
    this.geo.computeBoundingSphere();
    this.mat = new MeshStandardMaterial({
      map: atlas.texture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      roughness: 0.7,
      metalness: 0,
    });
    this.mat.name = `${name}Labels`;
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.name = `${name}Labels`;
    this.mesh.receiveShadow = true;
    // Les quads bougent (appui) : pas de culling sur une sphere qui ne suivrait pas
    this.mesh.frustumCulled = false;
  }

  private writeUv(i: number): void {
    const r = this.atlas.uv(this.specs[i].id, this.lit[i]);
    this.uvs.set([r.u0, r.v0, r.u1, r.v0, r.u0, r.v1, r.u1, r.v1], i * 8);
    this.uvs.needsUpdate = true;
  }

  /** La variante du nom i : le noir sur une touche allumee ; true s'il a change. */
  setLit(i: number, on: boolean): boolean {
    if (i < 0 || i >= this.lit.length || this.lit[i] === on) return false;
    this.lit[i] = on;
    this.writeUv(i);
    return true;
  }

  /** Le nom i descend avec sa touche (dy : la translation de l'instance, negative). */
  setDy(i: number, dy: number): void {
    if (i < 0 || i >= this.lit.length) return;
    const a = this.pos.array as Float32Array;
    for (let k = 0; k < 4; k += 1) a[i * 12 + k * 3 + 1] = this.y + dy;
    this.pos.needsUpdate = true;
  }

  /** Les variantes, dans l'ordre (revue : window.__v4.stage). */
  litState(): boolean[] {
    return [...this.lit];
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
