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
 *
 * La face V.4.0 (2026-10-27) : un texte peut avoir son corps (cap), la largeur
 * de son quad (qw), son decalage (dz) et se caler a gauche (le numero d'un pas) ;
 * V.4.2 (2026-10-27, Mika : "appuie-toi pour Rytm de la Digitakt pour les
 * boutons parce que les icones des fois c'est difficile a deviner c'est quoi") :
 * les pictogrammes partent, les douze touches portent un mot, avec son
 * interlettrage (tracking), et RUN/STOP ses signes (marks : le triangle PLAY et
 * le carre STOP, des formes pleines peintes dans leur cellule, theme.ts
 * KEY_MARK) ; une encre fixe, comme une touche imprimee. Tant qu'aucun nom ne
 * s'en sert (le telephone), l'atlas reste celui d'avant au pixel pres (deux
 * colonnes, une cellule de 128 par nom) ; sinon les cellules se rangent en
 * etageres sur 2048 de large, a SHELF_PPU px l'unite.
 */

import { BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial, type CanvasTexture } from 'three';
import type { FpMark } from '../rytm/faceplate';
import { APPEARANCE, FONT_DISPLAY, KEY_LABEL, KEY_MARK, SILK, marksW, type KeyLabelSpec } from '../theme';
import { drawTracked, makeCanvasTexture, trackedWidth } from './silk';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/** La hauteur d'une cellule de l'atlas, en px (la hauteur du quad). */
const CELL_H = 128;
/** La hauteur du quad : tant de fois la hauteur de capitale (l'air au-dessus et au-dessous du nom). */
const QUAD_CAPS = 2.2;
/** Le noir d'un nom sur une touche allumee ; l'os de RUN/STOP au repos. */
const DARK_INK = 'rgba(14, 14, 16, 0.92)';
const BONE_INK = 'rgba(246, 241, 231, 0.92)';

/** L'air autour des signes de RUN/STOP dans leur quad (V.4.2), en part de leur hauteur. */
const MARK_AIR = 0.25;

/** Le quad d'un nom sur sa touche, en unites : sa largeur (la touche moins l'air des deux bouts) et sa profondeur ; des signes, leur rangee et son air. */
export const labelQuad = (s: KeyLabelSpec): { w: number; h: number } =>
  s.marks
    ? { w: marksW(s.marks) + 2 * MARK_AIR * KEY_MARK.h, h: KEY_MARK.h * (1 + 2 * MARK_AIR) }
    : { w: s.qw ?? Math.max(0.1, s.w - 2 * KEY_LABEL.margin), h: (s.cap ?? KEY_LABEL.cap) * QUAD_CAPS };

/** Les etageres de la face V.4.0 (2026-10-27) : la largeur du canvas, l'air entre deux cellules, les px par unite. */
const SHELF_W = 2048;
const SHELF_GAP = 8;
const SHELF_PPU = 512;

interface Cell {
  /** son coin en haut a gauche et sa taille, en px du canvas */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface KeyLabelAtlasInfo {
  draws: number;
  size: [number, number];
  /** le corps de chaque groupe apres ajustement, en part du corps voulu */
  fit: Record<string, number>;
  font: string;
  /** l'ancien rangement (deux colonnes) ou les etageres de la face V.4.0 (2026-10-27) ; le nombre de cellules */
  layout: 'columns' | 'shelves';
  cells: number;
}

/** La cle d'une cellule : le nom, sa variante (allumee). */
const cellKey = (id: string, lit: boolean): string => `${id}|${lit ? 1 : 0}`;

export class KeyLabelAtlas {
  readonly texture: CanvasTexture;
  readonly info: KeyLabelAtlasInfo;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  /** px de l'atlas par unite de scene (l'ancien rangement : un seul, celui du corps commun) */
  private ppu: number;
  private cells = new Map<string, Cell>();
  private legacy: boolean;

  constructor(
    private specs: readonly KeyLabelSpec[],
    anisotropy: number
  ) {
    // L'ancien rangement tant qu'aucun nom n'a de signes, de corps, de quad ni d'interlettrage a lui (le telephone : au pixel pres)
    this.legacy = specs.every((s) => !s.marks && s.cap === undefined && s.qw === undefined && s.align === undefined && s.tracking === undefined);
    this.canvas = document.createElement('canvas');
    if (this.legacy) {
      this.ppu = CELL_H / (KEY_LABEL.cap * QUAD_CAPS);
      const colW = Math.ceil(Math.max(...specs.map((s) => labelQuad(s).w)) * this.ppu);
      specs.forEach((s, i) => {
        const w = Math.ceil(labelQuad(s).w * this.ppu);
        // Deux colonnes : la variante eteinte a gauche, l'allumee a droite
        this.cells.set(cellKey(s.id, false), { x: 0, y: i * CELL_H, w, h: CELL_H });
        this.cells.set(cellKey(s.id, true), { x: colW, y: i * CELL_H, w, h: CELL_H });
      });
      this.canvas.width = 2 * colW;
      this.canvas.height = specs.length * CELL_H;
    } else {
      this.ppu = SHELF_PPU;
      // Les etageres : les cellules de gauche a droite, une rangee de plus quand la largeur est pleine
      let x = 0;
      let y = 0;
      let row = 0;
      for (const s of specs) {
        const q = labelQuad(s);
        const w = Math.ceil(q.w * SHELF_PPU);
        const h = Math.ceil(q.h * SHELF_PPU);
        for (const lit of [false, true]) {
          if (x + w > SHELF_W) {
            x = 0;
            y += row + SHELF_GAP;
            row = 0;
          }
          this.cells.set(cellKey(s.id, lit), { x, y, w, h });
          x += w + SHELF_GAP;
          row = Math.max(row, h);
        }
      }
      this.canvas.width = SHELF_W;
      this.canvas.height = Math.max(1, y + row);
    }
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('keyLabels: no 2d context');
    this.ctx = ctx as Ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    this.info = { draws: 0, size: [this.canvas.width, this.canvas.height], fit: {}, font: '', layout: this.legacy ? 'columns' : 'shelves', cells: this.cells.size };
    this.draw();
  }

  /** L'encre d'un nom : le noir sur une touche allumee, l'os de RUN/STOP, sinon celle de la serigraphie de l'apparence. */
  private ink(s: KeyLabelSpec, lit: boolean): string {
    // L'encre au repos (2026-10-22, audit SB-06) : pleine, plus celle de la serigraphie a 85 %
    return lit ? DARK_INK : s.rest === 'bone' ? BONE_INK : KEY_LABEL.inkRest[APPEARANCE.current === 'light' ? 'light' : 'dark'];
  }

  /** Les signes de RUN/STOP dans leur cellule (V.4.2, 2026-10-27) : le triangle PLAY, le carre STOP, des formes pleines, centres. */
  private drawMarks(c: Cell, marks: readonly FpMark[], ink: string): void {
    const ctx = this.ctx;
    const u = this.ppu;
    const h = KEY_MARK.h * u;
    let x = c.x + (c.w - marksW(marks) * u) / 2;
    const y0 = c.y + (c.h - h) / 2;
    ctx.fillStyle = ink;
    marks.forEach((m, i) => {
      if (i > 0) x += KEY_MARK.gap * u;
      ctx.beginPath();
      if (m === 'play') {
        const w = h * KEY_MARK.playW;
        ctx.moveTo(x, y0);
        ctx.lineTo(x + w, y0 + h / 2);
        ctx.lineTo(x, y0 + h);
        x += w;
      } else if (m === 'rec') {
        // Le rond de REC (V.5.0, 2026-10-29), plein, du diametre du carre de STOP
        ctx.arc(x + h / 2, y0 + h / 2, h / 2, 0, Math.PI * 2);
        x += h;
      } else {
        ctx.rect(x, y0, h, h);
        x += h;
      }
      ctx.closePath();
      ctx.fill();
    });
  }

  /** Redessine tous les noms (les polices du site arrivees) et marque la texture. */
  draw(): void {
    const ctx = this.ctx;
    const u = this.ppu;
    const weight = KEY_LABEL.weight;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.textBaseline = 'alphabetic';
    // Le corps : le nom tient dans son quad, le plus petit de son groupe pour tous
    const pxOf = (s: KeyLabelSpec): number => ((s.cap ?? KEY_LABEL.cap) / SILK.capRatio) * u;
    const fit = this.specs.map((s) => {
      if (s.marks) return 1;
      const room = this.cells.get(cellKey(s.id, false))?.w ?? 0;
      const w = trackedWidth(ctx, s.text, pxOf(s), weight, s.tracking);
      return w > room ? room / w : 1;
    });
    const group = new Map<string, number>();
    this.specs.forEach((s, i) => group.set(s.group, Math.min(group.get(s.group) ?? 1, fit[i])));
    this.specs.forEach((s) => {
      for (const lit of [false, true]) {
        const c = this.cells.get(cellKey(s.id, lit));
        if (!c) continue;
        const ink = this.ink(s, lit);
        if (s.marks) {
          this.drawMarks(c, s.marks, ink);
          continue;
        }
        const k = group.get(s.group) ?? 1;
        const size = pxOf(s) * k;
        const cap = (s.cap ?? KEY_LABEL.cap) * u * k;
        const w = trackedWidth(ctx, s.text, size, weight, s.tracking);
        const base = c.y + c.h / 2 + cap / 2;
        ctx.fillStyle = ink;
        drawTracked(ctx, s.text, c.x + (s.align === 'left' ? 0 : (c.w - w) / 2), base, size, weight, s.tracking);
      }
    });
    this.info.draws += 1;
    this.info.fit = Object.fromEntries([...group].map(([g, k]) => [g, +k.toFixed(3)]));
    this.info.font = `${weight} ${((KEY_LABEL.cap / SILK.capRatio) * u).toFixed(1)}px ${FONT_DISPLAY}`;
    this.texture.needsUpdate = true;
  }

  /** Les uv de la cellule d'un nom (la texture est retournee : la rangee 0 du canvas est en haut, v = 1). */
  uv(id: string, lit: boolean): { u0: number; u1: number; v0: number; v1: number } {
    const c = this.cells.get(cellKey(id, lit));
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!c) return { u0: 0, u1: 0, v0: 0, v1: 0 };
    return { u0: c.x / W, u1: (c.x + c.w) / W, v0: 1 - c.y / H, v1: 1 - (c.y + c.h) / H };
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
      const zc = s.z + (s.dz ?? (s.marks ? KEY_MARK.dz : KEY_LABEL.dz));
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
