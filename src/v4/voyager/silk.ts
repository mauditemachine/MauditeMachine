/**
 * Serigraphie du MM-VOYAGER (2026-10-03), la meme encre et la meme police
 * que la 808 (SF Pro Display, capitales espacees, encre de l'apparence) :
 * - le panneau : wordmark Maudite Machine, MM-VOYAGER, les titres des
 *   sections facon Moog et leurs filets, le nom de chaque potard, les
 *   graduations 0 a 10 autour des deux gros potards ;
 * - le plateau : les noms des accords sous les pads, CHORDS F# MINOR, les
 *   pages en orange (comme sur la 808), OPEN (CLOSE capot ouvert), CLEAR et
 *   RANDOM.
 * Deux textures canvas sur deux plans couches sur le capot ; redessinees
 * a l'arrivee des polices et des logos, et OPEN <-> CLOSE.
 */

import { Mesh, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { drawTracked, fontsReady, logoImage, makeCanvasTexture, trackedWidth } from '../scene/silk';
import { HEX, PORTRAIT, SILK, silkA } from '../theme';
import { CHORDS } from './chords';
import { VOY_KNOBS } from './params';
import {
  VOY_BODY,
  VOY_BUTTONS,
  VOY_BUTTON,
  VOY_CHORDS_TITLE,
  VOY_COPY,
  VOY_HEAD,
  VOY_KNOB,
  VOY_LID_W,
  VOY_PAD,
  VOY_PANEL,
  VOY_RULES,
  VOY_SECTIONS,
  voyKnobPlace,
  voyPadAt,
} from './theme';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

interface Text {
  text: string;
  x: number;
  z: number;
  cap: number;
  align?: 'left' | 'center' | 'right';
  weight?: number;
  alpha?: number;
  ink?: 'bone' | 'orange';
  maxW?: number;
  group?: string;
}

/** Pixels de texture par unite : desktop 163, portrait 200 (plans plus grands). */
const PPU = PORTRAIT ? 200 : 2048 / VOY_LID_W;
const K = PORTRAIT ? 1.3 : 1;

export type VoySilkKind = 'panel' | 'deck';

/** Le plan de chaque serigraphie : largeur, profondeur, centre z (dans son repere). */
const PLANE = {
  panel: { w: VOY_LID_W, d: VOY_PANEL.len, cz: 0 },
  deck: { w: VOY_LID_W, d: VOY_BODY.d / 2 - VOY_BODY.bendZ, cz: (VOY_BODY.d / 2 + VOY_BODY.bendZ) / 2 },
} as const;

function panelTexts(): Text[] {
  const out: Text[] = [];
  out.push({ text: VOY_COPY.model, x: VOY_HEAD.model.x, z: VOY_HEAD.z, cap: VOY_HEAD.model.cap, align: 'right', weight: SILK.strongWeight });
  if (VOY_HEAD.sub) out.push({ text: VOY_HEAD.sub.text, x: VOY_HEAD.sub.x, z: VOY_HEAD.z, cap: 0.065, align: 'right', alpha: 0.45 });
  out.push({ text: 'MAUDITE MACHINE', x: VOY_HEAD.word.x, z: VOY_HEAD.z, cap: 0.18, align: 'left', weight: SILK.strongWeight, group: 'fallback' });
  for (const s of VOY_SECTIONS) out.push({ text: s.text, x: s.x, z: s.z, cap: 0.075 * K, weight: 700, alpha: 1 });
  for (const k of VOY_KNOBS) {
    const p = voyKnobPlace(k.id);
    out.push({ text: k.label, x: p.x, z: p.labelZ, cap: 0.068 * K, maxW: PORTRAIT ? 1.1 : 0.76, group: 'knob' });
  }
  return out;
}

function deckTexts(open: boolean): Text[] {
  const out: Text[] = [];
  out.push({ text: VOY_CHORDS_TITLE.text, x: VOY_CHORDS_TITLE.x, z: VOY_CHORDS_TITLE.z, cap: 0.075 * K, align: 'left', weight: 700, alpha: 1 });
  CHORDS.forEach((c, i) => {
    const p = voyPadAt(i);
    out.push({ text: c.label, x: p.x, z: p.z + VOY_PAD.labelDz, cap: 0.1 * K, weight: 600, maxW: VOY_PAD.size, group: 'pads' });
  });
  for (const b of VOY_BUTTONS) {
    const label = b.id === 'open' && open ? 'CLOSE' : b.label;
    const nav = b.id !== 'clear' && b.id !== 'random';
    out.push({
      text: label,
      x: b.x,
      z: b.z + b.d / 2 + VOY_BUTTON.labelGap,
      cap: 0.08 * K,
      weight: nav ? 700 : SILK.weight,
      ink: nav ? 'orange' : 'bone',
      alpha: nav ? 1 : SILK.alpha,
      maxW: b.w + 0.12,
      group: nav ? 'nav' : 'tr',
    });
  }
  return out;
}

export class VoySilk {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private W: number;
  private H: number;
  private plane: (typeof PLANE)[VoySilkKind];
  private open = false;
  draws = 0;

  constructor(
    private kind: VoySilkKind,
    anisotropy: number
  ) {
    this.plane = PLANE[kind];
    this.W = Math.round(this.plane.w * PPU);
    this.H = Math.round(this.plane.d * PPU);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('voyager: no 2d context');
    this.ctx = ctx as Ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    const geo = new PlaneGeometry(this.plane.w, this.plane.d);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, this.plane.cz);
    const mat = new MeshStandardMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      roughness: 0.7,
      metalness: 0,
    });
    mat.name = 'voySilk';
    // Les noms orange luisent un peu, comme sur la 808
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * step(0.5, diffuseColor.r - diffuseColor.b) * ${SILK.orangeGlow.toFixed(2)};`
      );
    };
    mat.customProgramCacheKey = () => 'silkOrange';
    this.mesh = new Mesh(geo, mat);
    this.mesh.name = `voySilk-${kind}`;
    this.mesh.position.y = 0.004;
    this.mesh.receiveShadow = true;
    this.draw();
  }

  private px(x: number): number {
    return (x + this.plane.w / 2) * PPU;
  }

  private py(z: number): number {
    return (z - this.plane.cz + this.plane.d / 2) * PPU;
  }

  /** Echelle de chaque texte : maxW d'abord, puis le plus petit corps de son groupe. */
  private scales(items: readonly Text[]): number[] {
    const fit = items.map((it) => {
      if (!it.maxW) return 1;
      const w = trackedWidth(this.ctx, it.text, (it.cap / SILK.capRatio) * PPU, it.weight ?? SILK.weight) / PPU;
      return w > it.maxW ? it.maxW / w : 1;
    });
    const groups = new Map<string, number>();
    items.forEach((it, i) => {
      if (it.group) groups.set(it.group, Math.min(groups.get(it.group) ?? 1, fit[i]));
    });
    return items.map((it, i) => (it.group ? groups.get(it.group) ?? fit[i] : fit[i]));
  }

  draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.textBaseline = 'alphabetic';
    ctx.lineCap = 'butt';
    let items: Text[];
    if (this.kind === 'panel') {
      // Filets entre les sections
      ctx.strokeStyle = silkA(SILK.lineAlpha);
      ctx.lineWidth = Math.max(1, SILK.lineWidth * PPU);
      for (const l of VOY_RULES) {
        ctx.beginPath();
        ctx.moveTo(this.px(l[0]), this.py(l[1]));
        ctx.lineTo(this.px(l[2]), this.py(l[3]));
        ctx.stroke();
      }
      // Graduations 0 a 10 autour des gros potards (CUTOFF, VOLUME), facon Moog
      ctx.strokeStyle = silkA(0.6);
      for (const k of VOY_KNOBS) {
        if (!k.big) continue;
        const p = voyKnobPlace(k.id);
        const r0 = VOY_KNOB.skirt.r * p.s + 0.05;
        const r1 = r0 + 0.07;
        for (let t = 0; t <= 10; t += 1) {
          // 270 deg, de sept heures et demie a quatre heures et demie, sens horaire vu de face
          const a = ((225 - 27 * t) * Math.PI) / 180;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          ctx.lineWidth = Math.max(1, (t % 5 === 0 ? 0.022 : 0.012) * PPU);
          ctx.beginPath();
          ctx.moveTo(this.px(p.x + ca * r0), this.py(p.z - sa * r0));
          ctx.lineTo(this.px(p.x + ca * (t % 5 === 0 ? r1 + 0.03 : r1)), this.py(p.z - sa * (t % 5 === 0 ? r1 + 0.03 : r1)));
          ctx.stroke();
        }
      }
      // Wordmark
      const img = logoImage('wordmark');
      items = panelTexts();
      if (img) {
        const ratio = img.naturalWidth / img.naturalHeight;
        const w = Math.round(VOY_HEAD.word.w * PPU);
        const h = Math.max(1, Math.round(w / ratio));
        ctx.drawImage(this.tint(img, w, h), Math.round(this.px(VOY_HEAD.word.x)), Math.round(this.py(VOY_HEAD.z) - h / 2));
        items = items.filter((t) => t.group !== 'fallback');
      }
    } else {
      items = deckTexts(this.open);
    }
    const scales = this.scales(items);
    items.forEach((it, i) => {
      const cap = it.cap * scales[i];
      const fontPx = (cap / SILK.capRatio) * PPU;
      const weight = it.weight ?? SILK.weight;
      const w = trackedWidth(ctx, it.text, fontPx, weight);
      const cx = this.px(it.x);
      const x0 = it.align === 'right' ? cx - w : it.align === 'left' ? cx : cx - w / 2;
      ctx.fillStyle = it.ink === 'orange' ? HEX.orange : silkA(it.alpha ?? SILK.alpha);
      drawTracked(ctx, it.text, x0, this.py(it.z) + (cap * PPU) / 2, fontPx, weight);
    });
    this.draws += 1;
    this.texture.needsUpdate = true;
  }

  /** Le logo (blanc) teinte a l'encre de la serigraphie. */
  private tint(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    if (!x) return c;
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, w, h);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = silkA(SILK.alpha);
    x.fillRect(0, 0, w, h);
    return c;
  }

  /** OPEN <-> CLOSE (plateau) ; true si redessine. */
  setOpen(open: boolean): boolean {
    if (this.kind !== 'deck' || open === this.open) return false;
    this.open = open;
    this.draw();
    return true;
  }

  get webfont(): boolean {
    return fontsReady();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
