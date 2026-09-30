/**
 * Textures canvas (spec 4.5 et 20.3.9). La serigraphie du panneau, facon
 * legendes Elektron : SF Pro Display 500 (le nom de la machine en 600),
 * capitales fines espacees de 0.2 em, bone 85 %, filets fins a 35 %,
 * dessinee au runtime sur tout le panneau (14 x 9.045). Premier dessin
 * avec la police disponible ; si les polices du site ne sont pas encore
 * chargees, redessin quand document.fonts.load() les livre (ou apres 3 s).
 * Aussi : le brossage du panneau (roughnessMap) et le halo des pads.
 * Jamais de createPattern : index.html le neutralise.
 */

import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import {
  BRUSH,
  FONT_DISPLAY,
  FONT_LOADS,
  FONT_TIMEOUT_MS,
  HEX,
  OPEN_SILK_INDEX,
  PAD,
  SILK,
  SILK_LINES,
  SILK_PLANE,
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

/* ---------------- texte suivi (interlettrage) ---------------- */

const setFont = (ctx: Ctx, px: number, weight: number): void => {
  ctx.font = `${weight} ${px.toFixed(2)}px ${FONT_DISPLAY}`;
};

/** Largeur visible d'un texte suivi (sans l'interlettrage apres la derniere lettre). */
export function trackedWidth(ctx: Ctx, text: string, px: number, weight: number = SILK.weight, tracking: number = SILK.tracking): number {
  setFont(ctx, px, weight);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
  return ctx.measureText(text).width + tracking * px * Math.max(0, text.length - 1);
}

/** Dessine a partir du bord gauche x0 ; letterSpacing natif, sinon glyphe par glyphe. */
export function drawTracked(
  ctx: Ctx,
  text: string,
  x0: number,
  baseline: number,
  px: number,
  weight: number = SILK.weight,
  tracking: number = SILK.tracking
): void {
  setFont(ctx, px, weight);
  const ls = tracking * px;
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

/** mulberry32 : 32 bits d'etat, assez pour un decor reproductible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas2d(w: number, h: number, what: string): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(`${what}: no 2d context`);
  return { canvas, ctx: ctx as Ctx };
}

/* ---------------- brossage du panneau ---------------- */

/**
 * Le brossage de l'aluminium (brief) : un gris par ligne (0.86 a 1,
 * graine 808), une strie a 0.8 ou 1 toutes les 12 lignes ; en roughnessMap
 * (canal vert, donnees : pas d'espace colorimetrique), repete, mipmaps.
 * Rugosite effective 0.53 a 0.62 : invisible de loin (les mipmaps moyennent
 * les lignes), de fines lignes horizontales de pres. Sans anisotropie
 * (revue de la revision 2) : elle garderait les lignes nettes en vue
 * rasante, la ou elles doivent se fondre (moire), et ajouterait jusqu'a
 * 8 lectures par fragment sur la plus grande surface de la vue. Le canvas
 * reste la source de la texture : three le re-televerse depuis lui apres
 * une perte de contexte (le liberer effacerait le brossage).
 */
export function makeBrushTexture(): CanvasTexture {
  const n = BRUSH.size;
  const { canvas, ctx } = canvas2d(4, n, 'brush');
  const rnd = mulberry32(BRUSH.seed);
  for (let y = 0; y < n; y += 1) {
    let v = BRUSH.min + (1 - BRUSH.min) * rnd();
    if (y % BRUSH.streakEvery === 0) v = rnd() < 0.5 ? BRUSH.streakLo : 1;
    const g = Math.round(v * 255);
    ctx.fillStyle = `rgb(${g}, ${g}, ${g})`;
    ctx.fillRect(0, y, 4, 1);
  }
  const t = new CanvasTexture(canvas);
  t.colorSpace = NoColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(BRUSH.repeat, BRUSH.repeat);
  t.anisotropy = 1;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  return t;
}

/* ---------------- halo des pads ---------------- */

/**
 * Le halo d'un pad retroeclaire (spec 20.3.5) : 64 x 64, blanc, alpha
 * nul au bord du carre de 1.25, plein au bord du pad (0.96, coins de
 * 0.08), decroissance au carre ; la couleur vient de l'instance.
 */
export function makeHaloTexture(): CanvasTexture {
  const n = 64;
  const { canvas, ctx } = canvas2d(n, n, 'halo');
  const img = ctx.createImageData(n, n);
  const s = PAD.size / PAD.halo;
  const r = (2 * PAD.radius) / PAD.halo;
  const band = 1 - s;
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const u = Math.abs(((i + 0.5) / n) * 2 - 1);
      const v = Math.abs(((j + 0.5) / n) * 2 - 1);
      const qx = u - (s - r);
      const qy = v - (s - r);
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      const a = d <= 0 ? 1 : Math.max(0, 1 - d / band) ** 2;
      const o = (j * n + i) * 4;
      img.data[o] = 255;
      img.data[o + 1] = 255;
      img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  return t;
}

/* ---------------- la serigraphie du panneau ---------------- */

export type OpenLabel = 'OPEN' | 'CLOSE';

export interface SilkInfo {
  draws: number;
  /** vrai si le dernier dessin avait les polices du site */
  webfont: boolean;
  /** police du dernier texte dessine (revue) */
  font: string;
  size: [number, number];
  /** libelle du pad OPEN tel que dessine : OPEN, ou CLOSE vue eclatee */
  openLabel: OpenLabel;
}

export class PanelSilk {
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
    const c = canvas2d(W, H, 'silk');
    this.canvas = c.canvas;
    this.ctx = c.ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);

    const geo = new PlaneGeometry(SILK_PLANE.w, SILK_PLANE.d);
    // Plan couche sur le panneau : rangee 0 du canvas vers l'arriere (z negatif)
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
    // Noms des pages en orange (2026-09-30) : sous la lumiere l'encre
    // orange rendait brun ; seule elle luit un peu (texel ou le rouge
    // domine nettement le bleu : le bone, lui, n'est pas touche).
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * step(0.5, diffuseColor.r - diffuseColor.b) * ${SILK.orangeGlow.toFixed(2)};`
      );
    };
    mat.customProgramCacheKey = () => 'silkOrange';
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
      const w = trackedWidth(ctx, it.text, (it.cap / SILK.capRatio) * u, it.weight ?? SILK.weight) / u;
      return w > it.maxW ? it.maxW / w : 1;
    });
    const groupMin = new Map<string, number>();
    items.forEach((it, i) => {
      if (it.group) groupMin.set(it.group, Math.min(groupMin.get(it.group) ?? 1, fit[i]));
    });
    return items.map((it, i) => (it.group ? groupMin.get(it.group) ?? fit[i] : fit[i]));
  }

  /** Redessine tout le panneau et marque la texture pour re-televersement. */
  draw(): void {
    const ctx = this.ctx;
    const u = this.ppu;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.textBaseline = 'alphabetic';

    // Filets : le separateur VOICES / PAGES, les crochets des touches trig
    ctx.strokeStyle = boneA(SILK.lineAlpha);
    ctx.lineWidth = Math.max(1, SILK.lineWidth * u);
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    for (const l of SILK_LINES) {
      ctx.beginPath();
      for (let k = 0; k < l.length; k += 2) {
        const x = this.px(l[k]);
        const y = this.py(l[k + 1]);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Textes, la hauteur de capitale centree en z ; le pad OPEN lit CLOSE vue eclatee
    const items = SILK_TEXTS.map((t, i) => (i === OPEN_SILK_INDEX ? { ...t, text: this.openLabel } : t));
    const scales = this.scales(items);
    items.forEach((it, i) => {
      const cap = it.cap * scales[i];
      const fontPx = (cap / SILK.capRatio) * u;
      const weight = it.weight ?? SILK.weight;
      const w = trackedWidth(ctx, it.text, fontPx, weight);
      const cx = this.px(it.x);
      const x0 = it.align === 'right' ? cx - w : it.align === 'left' ? cx : cx - w / 2;
      ctx.fillStyle = it.ink === 'orange' ? HEX.orange : boneA(it.alpha ?? SILK.alpha);
      drawTracked(ctx, it.text, x0, this.py(it.z) + (cap * u) / 2, fontPx, weight);
    });

    this.info.draws += 1;
    this.info.webfont = fontsReady();
    this.info.font = ctx.font;
    this.info.openLabel = this.openLabel;
    this.texture.needsUpdate = true;
  }

  /** OPEN <-> CLOSE sous le pad OPEN : deux televersements par cycle d'eclate. */
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
