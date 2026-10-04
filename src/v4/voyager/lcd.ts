/**
 * L'ecran du MM-VOYAGER (2026-10-03) : le meme verre que l'OLED de la 808
 * (texte bone sur noir profond, monospace, non eclaire), pose sur son
 * cadre a gauche du plateau. Trois lignes :
 * 1. MM-VOYAGER au repos ; l'arpege qui joue : le triangle de lecture et
 *    1/16 UP 2 OCT ; a droite le tempo (celui de la 808 : 123 BPM) ;
 * 2. la progression (l'accord qui joue en negatif, dans une etiquette) ;
 * 3. le message passager (le potard qu'on tourne : CUTOFF 64%) ou l'aide
 *    (TAP A CHORD PAD).
 * Redessine seulement quand le texte change, jamais par frame.
 */

import { BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { makeCanvasTexture } from '../scene/silk';
import { albedo } from '../scene/materials';
import { FONT_MONO, GAIN, HEX } from '../theme';
import { VOY_COPY, VOY_LCD } from './theme';

export interface VoyLcdText {
  line1: string;
  /** progression : noms des accords, et l'index de celui qui joue (-1 : aucun) */
  chords: readonly string[];
  playing: number;
  line3: string;
  /** tempo partage avec la 808, et l'arpege qui joue */
  bpm: number;
  running: boolean;
}

const keyOf = (t: VoyLcdText): string => `${t.line1}\n${t.chords.join(' ')}\n${t.playing}\n${t.line3}\n${t.bpm}\n${t.running}`;

export class VoyLcd {
  readonly glass: Mesh;
  readonly bezel: Mesh;
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private shown = '';
  private bezelMat: MeshStandardMaterial;
  draws = 0;

  constructor(anisotropy: number) {
    const [W, H] = VOY_LCD.tex;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('voyager: no 2d context');
    this.ctx = ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    const geo = new PlaneGeometry(VOY_LCD.w, VOY_LCD.d);
    geo.rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({ map: this.texture, toneMapped: false });
    mat.name = 'voyLcd';
    this.glass = new Mesh(geo, mat);
    this.glass.name = 'voyLcd';
    this.glass.position.set(VOY_LCD.x, VOY_LCD.bezel.h + 0.004, VOY_LCD.z);
    const b = VOY_LCD.bezel;
    const bg = new BoxGeometry(b.w, b.h, b.d);
    bg.translate(VOY_LCD.x, b.h / 2, VOY_LCD.z);
    this.bezelMat = new MeshStandardMaterial({ color: albedo('oled').clone().multiplyScalar(GAIN.parts), roughness: 0.4, metalness: 0 });
    this.bezelMat.name = 'voyLcdBezel';
    this.bezel = new Mesh(bg, this.bezelMat);
    this.bezel.name = 'voyLcdBezel';
    this.bezel.receiveShadow = true;
    this.paint({ line1: VOY_COPY.lcdIdle, chords: [], playing: -1, line3: 'TAP A CHORD PAD', bpm: 0, running: false });
  }

  /** true si l'ecran a ete redessine (il faut une frame). */
  set(t: VoyLcdText): boolean {
    if (keyOf(t) === this.shown) return false;
    this.paint(t);
    return true;
  }

  get text(): string {
    return this.shown;
  }

  private paint(t: VoyLcdText): void {
    const ctx = this.ctx;
    const [W, H] = VOY_LCD.tex;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = HEX.oled;
    ctx.fillRect(0, 0, W, H);
    const pad = 22;
    const rows = [H * 0.27, H * 0.58, H * 0.88];
    const px = Math.round(H * 0.17);
    ctx.font = `400 ${px}px ${FONT_MONO}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = HEX.bone;
    let x1 = pad;
    if (t.running) {
      // Le triangle de lecture
      const h = px * 0.72;
      const top = rows[0] - h;
      ctx.beginPath();
      ctx.moveTo(pad, top);
      ctx.lineTo(pad + h * 0.85, top + h / 2);
      ctx.lineTo(pad, top + h);
      ctx.closePath();
      ctx.fill();
      x1 = pad + h * 0.85 + px * 0.45;
    }
    // Le tempo a droite ; la ligne 1 se resserre si elle le toucherait
    const bpm = t.bpm > 0 ? `${t.bpm} BPM` : '';
    const room = W - pad - x1 - (bpm ? ctx.measureText(bpm).width + px * 0.6 : 0);
    const w1 = ctx.measureText(t.line1).width;
    if (w1 > room) {
      ctx.font = `400 ${Math.floor((px * room) / w1)}px ${FONT_MONO}`;
      ctx.fillText(t.line1, x1, rows[0]);
      ctx.font = `400 ${px}px ${FONT_MONO}`;
    } else ctx.fillText(t.line1, x1, rows[0]);
    if (bpm) {
      ctx.textAlign = 'right';
      ctx.fillText(bpm, W - pad, rows[0]);
      ctx.textAlign = 'left';
    }
    // Progression : chaque accord, celui qui joue en negatif
    let x = pad;
    const gap = px * 0.55;
    t.chords.forEach((c, i) => {
      const w = ctx.measureText(c).width;
      if (x + w > W - pad) return;
      if (i === t.playing) {
        ctx.fillStyle = HEX.bone;
        const r = 6;
        const bx = x - 6;
        const by = rows[1] - px * 0.86;
        const bw = w + 12;
        const bh = px * 1.08;
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
        ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
        ctx.arcTo(bx, by + bh, bx, by, r);
        ctx.arcTo(bx, by, bx + bw, by, r);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = HEX.oled;
        ctx.fillText(c, x, rows[1]);
      } else {
        ctx.fillStyle = HEX.bone;
        ctx.fillText(c, x, rows[1]);
      }
      x += w + gap;
    });
    ctx.fillStyle = HEX.bone;
    ctx.globalAlpha = 0.75;
    ctx.fillText(t.line3, pad, rows[2]);
    ctx.globalAlpha = 1;
    this.shown = keyOf(t);
    this.draws += 1;
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.glass.geometry.dispose();
    (this.glass.material as MeshBasicMaterial).dispose();
    this.bezel.geometry.dispose();
    this.bezelMat.dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
