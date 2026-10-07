/**
 * Serigraphie de la face arriere du MM-ARP (2026-10-03, Mika : "le
 * derriere doit etre beaucoup plus evolue, comme la MM-808") : le logo
 * MAUDITE MACHINE, MM-ARP ARPEGGIATOR SYNTHESIZER et le firmware,
 * l'etiquette du numero de serie (code-barres), le nom de chaque prise
 * au-dessus d'elle et chaque groupe (CV IN, GATE, PEDALS, MAIN OUT, SYNC,
 * MIDI) coiffe d'un crochet et de son titre. La meme facture que la face
 * arriere de la 808 (scene/backplate.ts) : une texture sur un plan pose
 * 0.003 devant la face, vu de derriere (x monde = -u), redessinee quand
 * les polices et le logo arrivent.
 */

import { Mesh, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { FONT_DISPLAY, SILK, silkA } from '../theme';
import { drawTracked, logoImage, makeCanvasTexture, trackedWidth } from '../scene/silk';
import { VOY_BACK, VOY_BODY, VOY_COPY, VOY_INNER } from './theme';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

const PL = { w: VOY_INNER - 0.1, y0: VOY_BODY.feet + 0.04, y1: VOY_BODY.topY - VOY_BODY.lidT - 0.04, gap: 0.003 };
const PH = PL.y1 - PL.y0;

export class VoyBackPlate {
  readonly mesh: Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private texture: CanvasTexture;
  private W: number;
  private H: number;
  draws = 0;

  constructor(mobile: boolean, anisotropy: number) {
    this.W = mobile ? 1024 : 2048;
    this.H = Math.round((this.W * PH) / PL.w);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const ctx = this.canvas.getContext('2d') as Ctx | null;
    if (!ctx) throw new Error('voyager: no 2d context');
    this.ctx = ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    const geo = new PlaneGeometry(PL.w, PH);
    // Face vers l'arriere (-z) : le bord gauche de la texture tombe en +x
    geo.rotateY(Math.PI);
    const mat = new MeshStandardMaterial({ map: this.texture, transparent: true, depthWrite: false, roughness: 0.6, metalness: 0 });
    mat.name = 'voyBackplate';
    this.mesh = new Mesh(geo, mat);
    this.mesh.name = 'voyBackplate';
    this.mesh.position.set(0, (PL.y0 + PL.y1) / 2, -VOY_BODY.d / 2 - PL.gap);
    this.draw();
  }

  private px(u: number): number {
    return ((u + PL.w / 2) / PL.w) * this.W;
  }

  private py(y: number): number {
    return ((PL.y1 - y) / PH) * this.H;
  }

  /** Texte suivi, la hauteur de capitale centree en y. */
  private text(t: string, u: number, y: number, cap: number, align: 'left' | 'center', alpha: number = SILK.alpha, weight: number = SILK.weight): void {
    const ppu = this.W / PL.w;
    const px = (cap / SILK.capRatio) * ppu;
    const w = trackedWidth(this.ctx, t, px, weight);
    const x0 = align === 'left' ? this.px(u) : this.px(u) - w / 2;
    this.ctx.fillStyle = silkA(alpha);
    drawTracked(this.ctx, t, x0, this.py(y) + (cap * ppu) / 2, px, weight);
  }

  draw(): void {
    const ctx = this.ctx;
    const ppu = this.W / PL.w;
    const K = VOY_BACK;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.textBaseline = 'alphabetic';

    // Logo (blanc, teinte a l'encre), sinon son nom en toutes lettres
    const img = logoImage('wordmark');
    if (img) {
      const w = Math.round(K.logo.w * ppu);
      const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const t = tmp.getContext('2d');
      if (t) {
        t.drawImage(img, 0, 0, w, h);
        t.globalCompositeOperation = 'source-in';
        t.fillStyle = silkA(SILK.alpha);
        t.fillRect(0, 0, w, h);
        ctx.drawImage(tmp, Math.round(this.px(K.logo.u)), Math.round(this.py(K.logo.y) - h / 2));
      }
      tmp.width = 0;
      tmp.height = 0;
    } else this.text('MAUDITE MACHINE', K.logo.u, K.logo.y, 0.12, 'left', SILK.alpha, SILK.strongWeight);
    this.text(`${VOY_COPY.model} ARPEGGIATOR SYNTHESIZER`, K.model.u, K.model.y, K.model.cap, 'left');
    this.text('FIRMWARE V.2.3 / 2026', K.firmware.u, K.firmware.y, K.firmware.cap, 'left', 0.55);

    // Etiquette du numero de serie : papier argente, code-barres, numero
    const S = K.sticker;
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
    let seed = 1974;
    while (bx < x1 - pad) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const bw = Math.max(1, ((seed >> 8) % 3) + 1) * (ppu / 160);
      ctx.fillRect(bx, barTop, bw, barBottom - barTop);
      bx += bw + Math.max(1, ((seed >> 12) % 3) + 1) * (ppu / 160);
    }
    const sPx = (0.05 / SILK.capRatio) * ppu;
    ctx.font = `600 ${sPx.toFixed(1)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText('S/N MMARP-000001', (x0 + x1) / 2, y1 - (y1 - y0) * 0.12);
    ctx.textAlign = 'left';

    // Les prises : leur nom, et chaque groupe (par rangee) coiffe d'un crochet et d'un titre
    const L = K.label;
    const groups = new Map<string, { name: string; y: number; us: number[] }>();
    for (const p of K.ports) {
      this.text(p.label, p.u, p.y + L.dy, L.cap, 'center');
      if (!p.group) continue;
      const key = `${p.group}@${p.y}`;
      const g = groups.get(key) ?? { name: p.group, y: p.y, us: [] };
      g.us.push(p.u);
      groups.set(key, g);
    }
    ctx.strokeStyle = silkA(SILK.lineAlpha);
    ctx.lineWidth = Math.max(1, SILK.lineWidth * ppu);
    for (const g of groups.values()) {
      const a = Math.min(...g.us) - 0.22;
      const b = Math.max(...g.us) + 0.22;
      const yb = this.py(g.y + L.bracket);
      const tick = 0.06 * ppu;
      ctx.beginPath();
      ctx.moveTo(this.px(a), yb + tick);
      ctx.lineTo(this.px(a), yb);
      ctx.lineTo(this.px(b), yb);
      ctx.lineTo(this.px(b), yb + tick);
      ctx.stroke();
      this.text(g.name, (a + b) / 2, g.y + L.group, L.groupCap, 'center', 1, 700);
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
