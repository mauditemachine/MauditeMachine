/**
 * Serigraphie en CanvasTexture (spec 4.5 et 5.4) : SF Pro Display 700,
 * capitales, interlettrage 0.18 em, bone 70 %, dessinee au runtime.
 * Premier dessin avec la police disponible ; si les polices du site ne sont
 * pas encore chargees, redessin quand document.fonts.load() les livre (ou
 * apres 3 s). Jamais de createPattern : index.html le neutralise.
 */

import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import {
  FONT_DISPLAY,
  FONT_LOADS,
  FONT_TIMEOUT_MS,
  HEX,
  MENTION,
  OPEN_FRAME,
  OPEN_LABEL,
  SILK,
  SILK_PLANE,
  SILK_RULES,
  SILK_TEXTS,
  boneA,
  type SilkText,
} from '../theme';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/* ---------------- polices ---------------- */

let fontsPromise: Promise<void> | null = null;

/** true si les polices du site sont deja utilisables par un canvas. */
export function fontsReady(): boolean {
  try {
    const f = document.fonts;
    return !f || FONT_LOADS.every((q) => f.check(q));
  } catch {
    return true;
  }
}

/** Resout quand les polices sont chargees, ou apres 3 s ; jamais rejetee. */
export function whenFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  const f = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!f) {
    fontsPromise = Promise.resolve();
    return fontsPromise;
  }
  fontsPromise = Promise.race([
    Promise.all(FONT_LOADS.map((q) => f.load(q))).then(
      () => undefined,
      () => undefined
    ),
    new Promise<void>((resolve) => window.setTimeout(resolve, FONT_TIMEOUT_MS)),
  ]);
  return fontsPromise;
}

/* ---------------- texte suivi a 0.18 em ---------------- */

const setFont = (ctx: Ctx, px: number): void => {
  ctx.font = `${SILK.weight} ${px.toFixed(2)}px ${FONT_DISPLAY}`;
};

/** Largeur visible d'un texte suivi (sans l'interlettrage apres la derniere lettre). */
export function trackedWidth(ctx: Ctx, text: string, px: number): number {
  setFont(ctx, px);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
  return ctx.measureText(text).width + SILK.tracking * px * Math.max(0, text.length - 1);
}

/** Dessine a partir du bord gauche x0 ; letterSpacing natif, sinon glyphe par glyphe. */
export function drawTracked(ctx: Ctx, text: string, x0: number, baseline: number, px: number): void {
  setFont(ctx, px);
  const ls = SILK.tracking * px;
  ctx.textAlign = 'left';
  if (ctx.letterSpacing !== undefined) {
    ctx.letterSpacing = `${ls.toFixed(2)}px`;
    ctx.fillText(text, x0, baseline);
    ctx.letterSpacing = '0px';
    return;
  }
  let x = x0;
  for (const ch of text) {
    ctx.fillText(ch, x, baseline);
    x += ctx.measureText(ch).width + ls;
  }
}

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** CanvasTexture sRGB, mipmaps et anisotropie (spec 4.5). */
export function makeCanvasTexture(canvas: HTMLCanvasElement, anisotropy: number, mipmaps = true): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.generateMipmaps = mipmaps;
  t.minFilter = mipmaps ? LinearMipmapLinearFilter : LinearFilter;
  t.magFilter = LinearFilter;
  return t;
}

/* ---------------- la serigraphie du plateau ---------------- */

export type OpenLabel = 'OPEN' | 'CLOSE';

export interface SilkInfo {
  draws: number;
  /** vrai si le dernier dessin avait les polices du site */
  webfont: boolean;
  /** police du dernier texte dessine (revue) */
  font: string;
  size: [number, number];
  /** libelle du bouton OPEN tel que dessine : OPEN, ou CLOSE vue eclatee */
  openLabel: OpenLabel;
}

export class PlateauSilk {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  readonly info: SilkInfo;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private W: number;
  private H: number;
  /** pixels de texture par unite de scene */
  private ppu: number;
  private openLabel: OpenLabel = 'OPEN';

  constructor(mobile: boolean, anisotropy: number) {
    const [W, H] = mobile ? SILK_PLANE.tex.mobile : SILK_PLANE.tex.desktop;
    this.W = W;
    this.H = H;
    this.ppu = W / SILK_PLANE.w;
    this.info = { draws: 0, webfont: false, font: '', size: [W, H], openLabel: 'OPEN' };
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('silk: no 2d context');
    this.ctx = ctx as Ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);

    const geo = new PlaneGeometry(SILK_PLANE.w, SILK_PLANE.d);
    // Plan couche sur le dessus : rangee 0 du canvas vers l'arriere (z -4.2)
    geo.rotateX(-Math.PI / 2);
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
    mat.name = 'silk';
    this.mesh = new Mesh(geo, mat);
    this.mesh.name = 'silk';
    this.mesh.position.y = SILK_PLANE.y;
    this.mesh.receiveShadow = true;
    this.draw();
  }

  private px(x: number): number {
    return ((x + SILK_PLANE.w / 2) / SILK_PLANE.w) * this.W;
  }

  private py(z: number): number {
    return ((z + SILK_PLANE.d / 2) / SILK_PLANE.d) * this.H;
  }

  /** Echelle de chaque texte : maxW d'abord, puis le plus petit corps de son groupe. */
  private scales(items: readonly SilkText[]): number[] {
    const ctx = this.ctx;
    const u = this.ppu;
    const fit = items.map((it) => {
      if (!it.maxW) return 1;
      const w = trackedWidth(ctx, it.text, (it.cap / SILK.capRatio) * u) / u;
      return w > it.maxW ? it.maxW / w : 1;
    });
    const groupMin = new Map<string, number>();
    items.forEach((it, i) => {
      if (it.group) groupMin.set(it.group, Math.min(groupMin.get(it.group) ?? 1, fit[i]));
    });
    return items.map((it, i) => (it.group ? groupMin.get(it.group) ?? fit[i] : fit[i]));
  }

  /** Redessine tout le plateau et marque la texture pour re-televersement. */
  draw(): void {
    const ctx = this.ctx;
    const u = this.ppu;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.textBaseline = 'alphabetic';

    // Filets
    ctx.fillStyle = HEX.line;
    const rw = SILK.ruleWidth * u;
    for (const r of SILK_RULES) {
      const xa = this.px(Math.min(r.x0, r.x1));
      const xb = this.px(Math.max(r.x0, r.x1));
      const ya = this.py(Math.min(r.z0, r.z1));
      const yb = this.py(Math.max(r.z0, r.z1));
      if (r.x0 === r.x1) ctx.fillRect(xa - rw / 2, ya, rw, yb - ya);
      else ctx.fillRect(xa, ya - rw / 2, xb - xa, rw);
    }

    // Cadre jaune du bouton OPEN
    const fx = this.px(OPEN_FRAME.x0);
    const fy = this.py(OPEN_FRAME.z0);
    ctx.strokeStyle = HEX.yellow;
    ctx.lineWidth = OPEN_FRAME.stroke * u;
    roundRectPath(ctx, fx, fy, this.px(OPEN_FRAME.x1) - fx, this.py(OPEN_FRAME.z1) - fy, OPEN_FRAME.radius * u);
    ctx.stroke();

    // Textes, centres sur leur point (la hauteur de capitale centree en z)
    const items: SilkText[] = [...SILK_TEXTS, { ...OPEN_LABEL, text: this.openLabel }];
    const scales = this.scales(items);
    items.forEach((it, i) => {
      const cap = it.cap * scales[i];
      const fontPx = (cap / SILK.capRatio) * u;
      const w = trackedWidth(ctx, it.text, fontPx);
      const cx = this.px(it.x);
      const x0 = it.align === 'right' ? cx - w : cx - w / 2;
      ctx.fillStyle = boneA(it.alpha ?? SILK.alpha);
      drawTracked(ctx, it.text, x0, this.py(it.z) + (cap * u) / 2, fontPx);
    });

    this.info.draws += 1;
    this.info.webfont = fontsReady();
    this.info.font = ctx.font;
    this.info.openLabel = this.openLabel;
    this.texture.needsUpdate = true;
  }

  /** OPEN <-> CLOSE : deux televersements par cycle d'eclate (spec 5.4). */
  setOpenLabel(label: OpenLabel): boolean {
    if (label === this.openLabel) return false;
    this.openLabel = label;
    this.draw();
    return true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
    this.texture.dispose();
    // Libere la memoire du canvas tout de suite (Safari la garde sinon)
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}

/* ---------------- la mention du socle ---------------- */

/**
 * V.4 / 2026 sur la face avant du socle (spec 5.2) : discrete, en line
 * (#2E3036) sur fond transparent, non eclairee (la teinte exacte sur le
 * socle graphiteLo). Descend avec le socle pendant l'eclate.
 */
export class Mention {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;

  constructor(anisotropy: number) {
    const [W, H] = MENTION.tex;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('mention: no 2d context');
    this.ctx = ctx as Ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    // PlaneGeometry regarde +z : la face avant du socle
    const mat = new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, toneMapped: false });
    mat.name = 'mention';
    this.mesh = new Mesh(new PlaneGeometry(MENTION.w, MENTION.h), mat);
    this.mesh.name = 'mention';
    this.mesh.position.set(MENTION.x, MENTION.y, MENTION.z);
    this.draw();
  }

  /** Redessin (apres le chargement des polices). */
  draw(): void {
    const [W, H] = MENTION.tex;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = HEX.line;
    ctx.textBaseline = 'alphabetic';
    const px = MENTION.px;
    const w = trackedWidth(ctx, MENTION.text, px);
    drawTracked(ctx, MENTION.text, (W - w) / 2, H / 2 + (px * SILK.capRatio) / 2, px);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
