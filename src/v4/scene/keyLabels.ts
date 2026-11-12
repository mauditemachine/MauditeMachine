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

import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Mesh, MeshStandardMaterial, type CanvasTexture } from 'three';
import type { FpMark } from '../rytm/faceplate';
import { APPEARANCE, FONT_DISPLAY, ICON_LINE, KEY_LABEL, KEY_MARK, MARK_ICON, SILK, markW, marksH, marksW, type KeyLabelSpec } from '../theme';
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
export const labelQuad = (s: KeyLabelSpec): { w: number; h: number } => {
  const tw = s.qw ?? Math.max(0.1, s.w - 2 * KEY_LABEL.margin);
  const th = (s.cap ?? KEY_LABEL.cap) * QUAD_CAPS;
  if (!s.marks) return { w: tw, h: th };
  // Les pictogrammes du plugin (2026-11-09) : la rangee prend la hauteur du plus grand
  const hh = marksH(s.marks);
  const mw = marksW(s.marks) + 2 * MARK_AIR * hh;
  const mh = hh * (1 + 2 * MARK_AIR);
  return s.altText ? { w: Math.max(mw, tw), h: Math.max(mh, th) } : { w: mw, h: mh };
};

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
        const ids = s.altText ? [s.id, `${s.id}:alt`] : [s.id];
        for (const id of ids) {
          for (const lit of [false, true]) {
            if (x + w > SHELF_W) {
              x = 0;
              y += row + SHELF_GAP;
              row = 0;
            }
            this.cells.set(cellKey(id, lit), { x, y, w, h });
            x += w + SHELF_GAP;
            row = Math.max(row, h);
          }
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
      // Les pictogrammes du plugin (2026-11-09, facon Digitakt II) : leur boite (centree en hauteur), un trait
      if (MARK_ICON[m]) {
        const iw = markW(m) * u;
        const ih = (MARK_ICON[m]?.s ?? 1) * h;
        this.drawIcon(m, x, c.y + (c.h - ih) / 2, iw, ih, ink);
        x += iw;
        return;
      }
      // Les chevrons des fleches (V.6.0, la face DT2, cahier 2.3) : un trait, pas une forme pleine ; < et > etroits, ^ et v
      // de la largeur des autres signes et moins hauts, le trait dans la cellule (l'inset d'un demi-trait)
      if (m === 'up' || m === 'down' || m === 'left' || m === 'right') {
        const C = KEY_MARK.chevron;
        const lw = C.line * h;
        const k = lw / 2;
        const narrow = h * C.narrow;
        ctx.save();
        ctx.strokeStyle = ink;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (m === 'left' || m === 'right') {
          const x0 = x + k;
          const x1 = x + narrow - k;
          const ya = y0 + k;
          const yb = y0 + h - k;
          if (m === 'left') {
            ctx.moveTo(x1, ya);
            ctx.lineTo(x0, (ya + yb) / 2);
            ctx.lineTo(x1, yb);
          } else {
            ctx.moveTo(x0, ya);
            ctx.lineTo(x1, (ya + yb) / 2);
            ctx.lineTo(x0, yb);
          }
          x += narrow;
        } else {
          const top = y0 + (h - narrow) / 2 + k;
          const bot = y0 + (h + narrow) / 2 - k;
          const x0 = x + k;
          const x1 = x + h - k;
          if (m === 'up') {
            ctx.moveTo(x0, bot);
            ctx.lineTo((x0 + x1) / 2, top);
            ctx.lineTo(x1, bot);
          } else {
            ctx.moveTo(x0, top);
            ctx.lineTo((x0 + x1) / 2, bot);
            ctx.lineTo(x1, top);
          }
          x += h;
        }
        ctx.stroke();
        ctx.restore();
        return;
      }
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

  /**
   * Un pictogramme du plugin (2026-11-09, la face facon Digitakt II) dans sa boite (x, y, w, h en px du canvas) : des traits
   * ronds a l'encre du nom, comme les icones de la DT2 ; les touches noires du clavier, les points du de et la note pleins.
   */
  private drawIcon(m: FpMark, x: number, y: number, w: number, h: number, ink: string): void {
    const ctx = this.ctx;
    const lw = ICON_LINE * h;
    const k = lw / 2;
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const rrect = (rx: number, ry: number, rw: number, rh: number, r: number): void => {
      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
      ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
      ctx.arcTo(rx, ry + rh, rx, ry, r);
      ctx.arcTo(rx, ry, rx + rw, ry, r);
      ctx.closePath();
    };
    const line = (x0: number, y0: number, x1: number, y1: number): void => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };
    if (m === 'recO') {
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h / 2 - k, 0, Math.PI * 2);
      ctx.stroke();
    } else if (m === 'playO') {
      ctx.beginPath();
      ctx.moveTo(x + k, y + k);
      ctx.lineTo(x + w - k, y + h / 2);
      ctx.lineTo(x + k, y + h - k);
      ctx.closePath();
      ctx.stroke();
    } else if (m === 'stopO') {
      rrect(x + k, y + k, w - lw, h - lw, 0.2 * h);
      ctx.stroke();
    } else if (m === 'list') {
      // PRESET (la DT2 : PERFORM) : une note et trois lignes
      for (let j = 0; j < 3; j += 1) line(x + 0.5 * w, y + k + j * 0.3 * h, x + w - k, y + k + j * 0.3 * h);
      line(x + 0.5 * w, y + h - k, x + w - k, y + h - k);
      ctx.beginPath();
      ctx.ellipse(x + 0.2 * w, y + 0.8 * h, 0.17 * w, 0.13 * h, -0.35, 0, Math.PI * 2);
      ctx.fill();
      line(x + 0.35 * w, y + 0.78 * h, x + 0.35 * w, y + k);
      line(x + 0.35 * w, y + k, x + 0.42 * w, y + 0.12 * h);
    } else if (m === 'perf') {
      // PERFORM (le plugin) : trois curseurs a des hauteurs differentes
      const at = [0.34, 0.7, 0.48];
      at.forEach((v, j) => {
        const cx = x + k + ((w - lw) * (j + 0.5)) / 3;
        line(cx, y + k, cx, y + h - k);
        const cy = y + k + (h - lw) * v;
        const hw = 0.13 * w;
        ctx.fillRect(cx - hw, cy - 0.085 * h, 2 * hw, 0.17 * h);
      });
    } else if (m === 'dice') {
      rrect(x + k, y + k, w - lw, h - lw, 0.22 * h);
      ctx.stroke();
      const r = 0.075 * h;
      for (const [px, py] of [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]]) {
        ctx.beginPath();
        ctx.arc(x + px * w, y + py * h, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (m === 'gear') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const R = h / 2 - k;
      const r = R * 0.74;
      ctx.beginPath();
      for (let t = 0; t < 8; t += 1) {
        const a = (t * Math.PI) / 4;
        const pts: [number, number][] = [[r, a - 0.36], [R, a - 0.19], [R, a + 0.19], [r, a + 0.36]];
        pts.forEach(([rr, aa], j) => (t === 0 && j === 0 ? ctx.moveTo(cx + rr * Math.cos(aa), cy + rr * Math.sin(aa)) : ctx.lineTo(cx + rr * Math.cos(aa), cy + rr * Math.sin(aa))));
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.32, 0, Math.PI * 2);
      ctx.stroke();
    } else if (m === 'disk') {
      // Les presets (le plugin) : une disquette (le corps au coin coupe, le volet, l'etiquette)
      const x0 = x + k;
      const y0 = y + k;
      const W = w - lw;
      const H = h - lw;
      const cut = 0.24 * W;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + W - cut, y0);
      ctx.lineTo(x0 + W, y0 + cut);
      ctx.lineTo(x0 + W, y0 + H);
      ctx.lineTo(x0, y0 + H);
      ctx.closePath();
      ctx.stroke();
      // le volet (en haut) et l'etiquette (en bas)
      ctx.strokeRect(x0 + 0.24 * W, y0, 0.42 * W, 0.3 * H);
      ctx.strokeRect(x0 + 0.2 * W, y0 + 0.56 * H, 0.6 * W, 0.44 * H);
    } else if (m === 'wave') {
      // SOUNDS (la DT2 : SAMPLES) : des barres verticales d'une forme d'onde
      const hs = [0.32, 0.66, 1, 0.5, 0.82, 0.42, 0.2];
      const step = (w - lw) / (hs.length - 1);
      hs.forEach((v, j) => {
        const half = Math.max(lw, (h - lw) * v) / 2;
        line(x + k + j * step, y + h / 2 - half + k / 2, x + k + j * step, y + h / 2 + half - k / 2);
      });
    } else if (m === 'metro') {
      // TEMPO : le metronome (un trapeze, son balancier)
      ctx.beginPath();
      ctx.moveTo(x + 0.36 * w, y + k);
      ctx.lineTo(x + 0.64 * w, y + k);
      ctx.lineTo(x + w - k, y + h - k);
      ctx.lineTo(x + k, y + h - k);
      ctx.closePath();
      ctx.stroke();
      line(x + 0.5 * w, y + 0.74 * h, x + 0.86 * w, y + 0.12 * h);
      line(x + 0.22 * w, y + 0.74 * h, x + 0.78 * w, y + 0.74 * h);
    } else if (m === 'piano') {
      // KEYBOARD : un clavier, trois touches noires
      rrect(x + k, y + k, w - lw, h - lw, 0.16 * h);
      ctx.stroke();
      const bw = 0.13 * w;
      for (const f of [0.3, 0.5, 0.7]) ctx.fillRect(x + f * w - bw / 2, y + k, bw, 0.58 * h);
      for (const f of [0.3, 0.5, 0.7]) line(x + f * w, y + 0.58 * h, x + f * w, y + h - k);
    }
    ctx.restore();
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
    const altOrange = APPEARANCE.current === 'light' ? '#D94E00' : '#FF781F';
    this.specs.forEach((s) => {
      for (const lit of [false, true]) {
        const c = this.cells.get(cellKey(s.id, lit));
        if (!c) continue;
        const ink = this.ink(s, lit);
        if (s.marks) {
          this.drawMarks(c, s.marks, ink);
        } else {
          const k = group.get(s.group) ?? 1;
          const size = pxOf(s) * k;
          const cap = (s.cap ?? KEY_LABEL.cap) * u * k;
          const w = trackedWidth(ctx, s.text, size, weight, s.tracking);
          const base = c.y + c.h / 2 + cap / 2;
          ctx.fillStyle = ink;
          drawTracked(ctx, s.text, c.x + (s.align === 'left' ? 0 : (c.w - w) / 2), base, size, weight, s.tracking);
          // Le numero souligne d'un pas (le plugin, 2026-11-09, facon Digitakt II)
          if (s.underline) {
            const uw = Math.max(w, cap * 0.9) * 1.15;
            const x0 = c.x + (s.align === 'left' ? w / 2 : c.w / 2) - uw / 2;
            ctx.fillRect(x0, base + cap * 0.3, uw, cap * 0.13);
          }
        }
        if (s.altText) {
          const ca = this.cells.get(cellKey(`${s.id}:alt`, lit));
          if (ca) {
            const k0 = group.get(s.group) ?? 1;
            const rawSize = pxOf(s) * k0;
            const rawW = trackedWidth(ctx, s.altText, rawSize, weight, s.tracking);
            const kAlt = rawW > ca.w * 0.94 ? (ca.w * 0.94) / rawW : 1;
            const sizeAlt = rawSize * kAlt;
            const capAlt = (s.cap ?? KEY_LABEL.cap) * u * k0 * kAlt;
            const wAlt = trackedWidth(ctx, s.altText, sizeAlt, weight, s.tracking);
            const baseAlt = ca.y + ca.h / 2 + capAlt / 2;
            ctx.fillStyle = lit ? DARK_INK : altOrange;
            drawTracked(ctx, s.altText, ca.x + (ca.w - wAlt) / 2, baseAlt, sizeAlt, weight, s.tracking);
          }
        }
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
  private funcMode = false;
  /** l'encre de chaque nom, a sa part (dimmable : une couleur par sommet ; null sans) */
  private dims: BufferAttribute | null = null;
  /** le y du dessus des touches, au repos */
  private y: number;

  constructor(
    private atlas: KeyLabelAtlas,
    private specs: readonly KeyLabelSpec[],
    keyH: number,
    name: string,
    dimmable = false
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
    // Des noms qui s'eteignent (les pas hors de la longueur de la piste, le plugin) : une couleur par sommet, 1 au depart
    if (dimmable) {
      this.dims = new BufferAttribute(new Float32Array(n * 12).fill(1), 3);
      this.dims.setUsage(DynamicDrawUsage);
      this.geo.setAttribute('color', this.dims);
    }
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
      vertexColors: dimmable,
    });
    this.mat.name = `${name}Labels`;
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.name = `${name}Labels`;
    this.mesh.receiveShadow = true;
    // Les quads bougent (appui) : pas de culling sur une sphere qui ne suivrait pas
    this.mesh.frustumCulled = false;
  }

  private writeUv(i: number): void {
    const s = this.specs[i];
    const key = this.funcMode && s.altText ? `${s.id}:alt` : s.id;
    const r = this.atlas.uv(key, this.lit[i]);
    this.uvs.set([r.u0, r.v0, r.u1, r.v0, r.u0, r.v1, r.u1, r.v1], i * 8);
    this.uvs.needsUpdate = true;
  }

  /** Quand FUNC est engagee (Mika : "PRESET on appui sur FUNC et ca devient PERFORM") : bascule tous les noms secondaires sur les touches. */
  setFuncMode(on: boolean): boolean {
    if (this.funcMode === on) return false;
    this.funcMode = on;
    let changed = false;
    this.specs.forEach((s, i) => {
      if (s.altText) {
        this.writeUv(i);
        changed = true;
      }
    });
    return changed;
  }

  /** La variante du nom i : le noir sur une touche allumee ; true s'il a change. */
  setLit(i: number, on: boolean): boolean {
    if (i < 0 || i >= this.lit.length || this.lit[i] === on) return false;
    this.lit[i] = on;
    this.writeUv(i);
    return true;
  }

  /** L'encre du nom i a la part f (0 a 1 ; seulement dimmable) ; true si elle a change. */
  setDim(i: number, f: number): boolean {
    const d = this.dims;
    if (!d || i < 0 || i >= this.lit.length) return false;
    const a = d.array as Float32Array;
    if (a[i * 12] === f) return false;
    a.fill(f, i * 12, i * 12 + 12);
    d.needsUpdate = true;
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
