/**
 * Serigraphie de la face arriere (2026-10-01) : le logo MAUDITE MACHINE a
 * gauche, MM-808 DRUM MACHINE et la version du firmware dessous,
 * l'etiquette du numero de serie (code-barres), et le nom de chaque prise
 * au-dessus d'elle, les groupes (MAIN OUT, SYNC, MIDI) coiffes d'un
 * crochet et de leur titre. Bone sur fond transparent, une texture sur un
 * plan pose 0.003 devant la face (un draw call), vu de derriere : u va de
 * gauche a droite pour qui regarde l'arriere (x monde = -u). Redessinee
 * quand les polices et le logo arrivent.
 */

import { Mesh, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { BACK, BODY, FONT_DISPLAY, SILK, boneA } from '../theme';
import { drawTracked, logoImage, makeCanvasTexture, trackedWidth } from './silk';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

const PL = BACK.plane;
const PH = PL.y1 - PL.y0;

export class BackPlate {
  readonly mesh: Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private texture: CanvasTexture;
  private W: number;
  private H: number;
  draws = 0;

  constructor(mobile: boolean, anisotropy: number) {
    this.W = mobile ? BACK.tex.mobile : BACK.tex.desktop;
    this.H = Math.round((this.W * PH) / PL.w);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const ctx = this.canvas.getContext('2d') as Ctx | null;
    if (!ctx) throw new Error('backplate: no 2d context');
    this.ctx = ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    const geo = new PlaneGeometry(PL.w, PH);
    // Face vers l'arriere (-z) : le bord gauche de la texture tombe en +x
    geo.rotateY(Math.PI);
    const mat = new MeshStandardMaterial({ map: this.texture, transparent: true, depthWrite: false, roughness: 0.55, metalness: 0 });
    mat.name = 'backplate';
    this.mesh = new Mesh(geo, mat);
    this.mesh.name = 'backplate';
    this.mesh.position.set(0, (PL.y0 + PL.y1) / 2, -BODY.d / 2 - PL.gap);
    this.draw();
  }

  private px(u: number): number {
    return ((u + PL.w / 2) / PL.w) * this.W;
  }

  private py(y: number): number {
    return ((PL.y1 - y) / PH) * this.H;
  }

  /** Texte suivi, la hauteur de capitale centree en y ; align : bord ou centre. */
  private text(t: string, u: number, y: number, cap: number, align: 'left' | 'center', alpha: number = SILK.alpha, weight: number = SILK.weight): void {
    const ppu = this.W / PL.w;
    const px = (cap / SILK.capRatio) * ppu;
    const w = trackedWidth(this.ctx, t, px, weight);
    const x0 = align === 'left' ? this.px(u) : this.px(u) - w / 2;
    this.ctx.fillStyle = boneA(alpha);
    drawTracked(this.ctx, t, x0, this.py(y) + (cap * ppu) / 2, px, weight);
  }

  draw(): void {
    const ctx = this.ctx;
    const ppu = this.W / PL.w;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.textBaseline = 'alphabetic';

    // Logo (blanc, teinte a l'encre), sinon son nom en toutes lettres
    const L = BACK.logo;
    const img = logoImage('wordmark');
    if (img) {
      const w = Math.round(L.w * ppu);
      const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const t = tmp.getContext('2d');
      if (t) {
        t.drawImage(img, 0, 0, w, h);
        t.globalCompositeOperation = 'source-in';
        t.fillStyle = boneA(SILK.alpha);
        t.fillRect(0, 0, w, h);
        ctx.drawImage(tmp, Math.round(this.px(L.u)), Math.round(this.py(L.y) - h / 2));
      }
      tmp.width = 0;
      tmp.height = 0;
    } else this.text('MAUDITE MACHINE', L.u, L.y, 0.13, 'left', SILK.alpha, SILK.strongWeight);
    this.text(BACK.model.text, BACK.model.u, BACK.model.y, BACK.model.cap, 'left');
    this.text(BACK.firmware.text, BACK.firmware.u, BACK.firmware.y, BACK.firmware.cap, 'left', BACK.firmware.alpha);

    // Etiquette du numero de serie : papier argente, code-barres, numero
    const S = BACK.sticker;
    const x0 = this.px(S.u0);
    const x1 = this.px(S.u1);
    const y0 = this.py(S.y1);
    const y1 = this.py(S.y0);
    ctx.fillStyle = 'rgba(206, 206, 198, 0.92)';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = '#16161a';
    const pad = (x1 - x0) * 0.06;
    const barTop = y0 + (y1 - y0) * 0.14;
    const barBottom = y0 + (y1 - y0) * 0.6;
    let bx = x0 + pad;
    let seed = 808;
    while (bx < x1 - pad) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const bw = Math.max(1, ((seed >> 8) % 3) + 1) * (ppu / 160);
      ctx.fillRect(bx, barTop, bw, barBottom - barTop);
      bx += bw + Math.max(1, ((seed >> 12) % 3) + 1) * (ppu / 160);
    }
    const sPx = (0.055 / SILK.capRatio) * ppu;
    ctx.font = `600 ${sPx.toFixed(1)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText(S.serial, (x0 + x1) / 2, y1 - (y1 - y0) * 0.12);
    ctx.textAlign = 'left';

    // Les prises : leur nom, et les groupes coiffes d'un crochet et d'un titre
    const groups = new Map<string, number[]>();
    for (const p of BACK.ports) {
      this.text(p.label, p.u, BACK.labelY, BACK.cap, 'center');
      if (p.group) groups.set(p.group, [...(groups.get(p.group) ?? []), p.u]);
    }
    ctx.strokeStyle = boneA(SILK.lineAlpha);
    ctx.lineWidth = Math.max(1, SILK.lineWidth * ppu);
    for (const [name, us] of groups) {
      const a = Math.min(...us) - 0.22;
      const b = Math.max(...us) + 0.22;
      const yb = this.py(BACK.bracketY);
      const tick = 0.06 * ppu;
      ctx.beginPath();
      ctx.moveTo(this.px(a), yb + tick);
      ctx.lineTo(this.px(a), yb);
      ctx.lineTo(this.px(b), yb);
      ctx.lineTo(this.px(b), yb + tick);
      ctx.stroke();
      this.text(name, (a + b) / 2, BACK.groupY, BACK.groupCap, 'center');
    }

    this.draws += 1;
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
