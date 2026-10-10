/**
 * Serigraphie du MM-DECKS (2026-10-04), la meme encre et la meme police que
 * la 808 et le MM-ARP (SF Pro Display, capitales espacees, encre de
 * l'apparence) : une texture par bloc, sur un plan couche sur son dessus.
 * - En-tete : DECK A, DECK B ou MIXER en gras, le role en petit, le
 *   logotype a droite (Mika, 2026-10-03 : les plaques facon MM-ARP).
 * - Platine : HOT CUE sous les quatre pads, LOAD, BEND et ses signes, CUE,
 *   PLAY / PAUSE, TEMPO et sa graduation, la plage du pitch.
 * - Table : EFFECTS (ses sept potards), TIME et ses valeurs, les numeros
 *   des voies, le nom de chaque potard au-dessus de lui (Mika : "les
 *   titres au-dessus des boutons"), la graduation des faders, MASTER,
 *   CROSSFADER entre A et B.
 * Redessinee a l'arrivee des polices et des logos.
 */

import { Mesh, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { drawTracked, logoImage, makeCanvasTexture, trackedWidth } from '../scene/silk';
import { HEX, PORTRAIT, SILK, silkA } from '../theme';
import { DJ_FADERS, DJ_KNOBS, DJ_KEYS, knobLabelZ, type DjKeySpec } from './layout';
import { DECK, DJ_CHANNELS, DJ_CH_NAMES, DJ_SHOWN, DJ_KNOB, DJ_UNIT, MIX, UNIT_X, unitW, type DjDeck, type DjUnit } from './theme';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

export interface Text {
  text: string;
  /** repere du bloc */
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

export type Line = readonly number[];

const COPY: Readonly<Record<DjUnit, { name: string; sub: string }>> = {
  a: { name: 'DECK A', sub: 'DIGITAL DECK' },
  b: { name: 'DECK B', sub: 'DIGITAL DECK' },
  c: { name: 'DECK C', sub: 'DIGITAL DECK' },
  d: { name: 'DECK D', sub: 'DIGITAL DECK' },
  mix: { name: 'MIXER', sub: 'DJ MIXER' },
  mix1: { name: 'MIXER', sub: '' },
  mix2: { name: 'MIXER', sub: '' },
  mix3: { name: 'MIXER', sub: '' },
  add: { name: 'ADD', sub: '' },
};

/** Crochet sous un groupe : tics aux bords, trait interrompu pour le nom. */
export interface Bracket {
  text: string;
  x0: number;
  x1: number;
  z: number;
  /** au-dessus d'un groupe : les tics vers lui (vers soi) ; le nom en orange */
  down?: boolean;
  ink?: 'bone' | 'orange';
}

const BRACKET = { cap: 0.075, weight: 700, tick: 0.08, pad: 0.1 } as const;

/** FX TO (2026-10-04) : la voie visee (-1 toutes), posee par le rig avant de redessiner la table. */
let silkFxTo = -1;
export const setSilkFxTo = (t: number): void => {
  silkFxTo = t;
};

/** L'en-tete d'une plaque large de w : le nom en gras a gauche, le role en petit a subX de lui (le logotype est a droite, draw). */
export function headTexts(name: string, sub: string, w: number, z: number, subX: number): Text[] {
  const hw = w / 2 - 0.45;
  const out: Text[] = [{ text: name, x: -hw, z, cap: 0.2, align: 'left', weight: 700, alpha: 1 }];
  if (sub) out.push({ text: sub, x: -hw + subX, z: z + 0.035, cap: 0.065, align: 'left', alpha: 0.45 });
  return out;
}

function head(u: DjUnit): Text[] {
  const c = COPY[u];
  const z = u === 'mix' ? MIX.head.z : DECK.head.z;
  // La platine qu'on peut retirer : REMOVE DECK prend la place du sous-titre ; sur la table, ADD DECK (2026-10-05)
  const removable = DJ_KEYS.some((k) => k.target.kind === 'removedeck' && k.target.deck === u);
  // ADD DECK est pres du logotype depuis que LOOP > SMPL est parti (2026-10-07) : le sous-titre de la table revient
  const sub = u === 'mix' ? `${DJ_SHOWN.length} CHANNEL ${c.sub}` : removable ? '' : c.sub;
  return headTexts(c.name, sub, unitW(u), z, u === 'mix' ? 1.55 : 1.85);
}

/** Textes, filets et crochets d'une platine (repere du bloc). */
function deckItems(u: DjDeck): { texts: Text[]; lines: Line[]; brackets: Bracket[] } {
  const ux = UNIT_X[u];
  const texts = head(u);
  const lines: Line[] = [];
  const brackets: Bracket[] = [];
  for (const k of DJ_KEYS) {
    if (k.target.kind === 'time' || !('deck' in k.target) || k.target.deck !== u) continue;
    const x = k.x - ux;
    // Le sampler (2026-10-07) : les noms au-dessus des touches, REC DECK et REC MIX en orange
    if (k.target.kind === 'smpl') texts.push({ text: k.label, x, z: k.z - k.d / 2 - 0.16, cap: 0.075, weight: 700, group: 'cues', ...(k.target.fn === 'recdeck' || k.target.fn === 'recmix' ? { ink: 'orange' as const, alpha: 1 } : {}) });
    else if (k.target.kind === 'bend') texts.push({ text: k.label, x, z: k.z + k.d / 2 + 0.2, cap: 0.12, weight: 600 });
    else if (k.target.kind === 'loop') texts.push({ text: k.label, x, z: k.z - k.d / 2 - 0.16, cap: 0.075, weight: 600, group: 'loops' });
    // CUE et PLAY / PAUSE : leur nom est grave sur le bouton (dj/controls.ts)
    else if (k.target.kind === 'removedeck') texts.push({ text: 'REMOVE DECK', x: x - k.w / 2 - 0.14, z: k.z, cap: 0.11, weight: 700, ink: 'orange', alpha: 1, align: 'right' });
  }
  // SYNC : l'ecran rond du jog se touche ; son nom sous la bague
  const J = DECK.jog;
  texts.push({ text: 'TOUCH CENTER TO SYNC', x: J.x, z: J.z + J.ring + 0.24, cap: 0.058, weight: 600, alpha: 0.5 });
  const C = DECK.cues;
  brackets.push({ text: 'SAMPLER', x0: C.xs[0] - C.w / 2, x1: C.xs[C.xs.length - 1] + C.w / 2, z: C.z + C.d / 2 + 0.22 });
  // LOOP : son crochet sous la rangee, comme SAMPLER
  const Lp = DECK.loops;
  brackets.push({ text: 'LOOP', x0: Lp.xs[0] - Lp.w / 2, x1: Lp.xs[Lp.xs.length - 1] + Lp.w / 2, z: Lp.z + Lp.d / 2 + 0.22 });
  // BEND : son nom entre ses deux signes, sous les touches (le crochet LOOP est au-dessus)
  const B = DECK.bend;
  texts.push({ text: 'BEND', x: (B.xs[0] + B.xs[1]) / 2, z: B.z + B.d / 2 + 0.2, cap: 0.058, weight: 700 });
  // Le pitch : graduation a droite de la fente, le zero plus long ; son nom est sur ses touches
  const P = DECK.pitch;
  const n = 16;
  for (let i = 0; i <= n; i += 1) {
    const z = P.z0 + ((P.z1 - P.z0) * i) / n;
    const big = i % 4 === 0;
    lines.push([P.x + 0.22, z, P.x + (i === n / 2 ? 0.5 : big ? 0.42 : 0.32), z]);
  }
  // PITCH - et + (Mika, 2026-10-04) : le nom au-dessus des touches, un grand signe dessous
  const Tm = DECK.tempo;
  texts.push({ text: 'PITCH', x: (Tm.xs[0] + Tm.xs[1]) / 2, z: Tm.z - Tm.d / 2 - 0.17, cap: 0.075, weight: 700, ink: 'orange', alpha: 1 });
  Tm.xs.forEach((x, k) => texts.push({ text: k === 0 ? '-' : '+', x, z: Tm.z + Tm.d / 2 + 0.24, cap: 0.17, weight: 700, alpha: 1 }));
  return { texts, lines, brackets };
}

/** Textes, filets et crochets de la table (repere du bloc). */
function mixItems(): { texts: Text[]; lines: Line[]; brackets: Bracket[] } {
  const ux = UNIT_X.mix;
  const texts = head('mix');
  const lines: Line[] = [];
  const brackets: Bracket[] = [];
  for (const k of DJ_KNOBS) {
    // Les butees et, pour les potards a zero au centre, le cran du milieu : de petits traits autour de la jupe
    const r0 = DJ_KNOB.skirt.r * k.s + 0.035;
    const r1 = r0 + 0.055;
    const kx = k.x - ux;
    for (const deg of k.bipolar ? [225, 90, -45] : [225, -45]) {
      const a = (deg * Math.PI) / 180;
      lines.push([kx + Math.cos(a) * r0, k.z - Math.sin(a) * r0, kx + Math.cos(a) * r1, k.z - Math.sin(a) * r1]);
    }
    const pale = k.idle ? 0.4 : SILK.alpha;
    // Tenu droit, des noms plus gros (ils se lisent au telephone) ; ceux des effets ont la place d'une colonne
    const isFx = k.target.kind === 'fx' || k.target.kind === 'fxto';
    texts.push({ text: k.label, x: k.x - ux, z: knobLabelZ(k), cap: PORTRAIT ? 0.085 : 0.062, alpha: pale, maxW: PORTRAIT ? (isFx ? 1.3 : 0.95) : 0.9, group: isFx ? 'fx' : 'knob' });
    // FX TO : un cran par position (ALL puis chaque voie), ALL ecrit au premier
    if (k.target.kind === 'fxto') {
      const n = DJ_SHOWN.length;
      for (let j = 1; j < n; j += 1) {
        const a = ((225 - (270 * j) / n) * Math.PI) / 180;
        lines.push([kx + Math.cos(a) * r0, k.z - Math.sin(a) * r0, kx + Math.cos(a) * r1, k.z - Math.sin(a) * r1]);
      }
      const a0 = (225 * Math.PI) / 180;
      const rt = r1 + 0.1;
      texts.push({ text: 'ALL', x: kx + Math.cos(a0) * rt - 0.02, z: k.z - Math.sin(a0) * rt + 0.04, cap: 0.05, weight: 600, align: 'right' });
    }
  }
  // FX TO vise une voie : son numero passe en orange
  const fxTo = silkFxTo;
  // Effets : crochet sous la rangee ; TIME au-dessus de ses touches, chaque valeur dessous
  const fx = DJ_KNOBS.filter((k) => k.target.kind === 'fx' || (PORTRAIT && k.target.kind === 'fxto'));
  const r = DJ_KNOB.skirt.r * MIX.sFx;
  // Tenu droit : deux rangees de quatre, le crochet sous la seconde, d'un bord a l'autre
  const fxLow = Math.max(...fx.map((k) => k.z));
  brackets.push({ text: 'EFFECTS', x0: Math.min(...fx.map((k) => k.x)) - ux - r, x1: Math.max(...fx.map((k) => k.x)) - ux + r, z: fxLow + r + 0.2 });
  const T = MIX.times;
  const times = DJ_KEYS.filter((k) => k.target.kind === 'time');
  for (const k of times) texts.push({ text: k.label, x: k.x - ux, z: k.z + k.d / 2 + 0.15, cap: PORTRAIT ? 0.075 : 0.058, weight: 600, group: 'time' });
  texts.push({ text: 'TIME', x: T.x0 + ((times.length - 1) * T.pitch) / 2, z: T.z - T.d / 2 - 0.17, cap: PORTRAIT ? 0.08 : 0.07, weight: 700 });
  // Voies : le numero, et la platine qui y joue
  MIX.cols.forEach((cx, j) => {
    // Chaque voie joue : 1 le MM-RYTM, 2 le MM-BASS, 3 le MM-ARP, puis les platines (Mika, 2026-10-04 et 2026-10-07) ;
    // les voies dessinees seulement (DJ_SHOWN, 2026-10-10), numerotees de gauche a droite
    const i = DJ_SHOWN[j] as number;
    texts.push({ text: String(j + 1), x: cx - 0.1, z: MIX.numZ, cap: 0.17, weight: 700, alpha: 1, align: 'right', ...(fxTo === i ? { ink: 'orange' as const } : {}) });
    texts.push({ text: DJ_CH_NAMES[i], x: cx + 0.02, z: MIX.numZ, cap: 0.09, weight: 700, ink: 'orange', alpha: 1, align: 'left', maxW: 0.62, group: 'chname' });
    // Graduation du fader de voie : 11 tics, 10 en haut (tenu droit, pas de fader)
    const F = MIX.fader;
    if (!PORTRAIT) for (let t = 0; t <= 10; t += 1) {
      const z = F.z0 + ((F.z1 - F.z0) * t) / 10;
      lines.push([cx - 0.17, z, cx - (t % 5 === 0 ? 0.36 : 0.28), z]);
    }
  });
  texts.push({ text: 'M', x: MIX.masterX, z: MIX.numZ, cap: 0.17, weight: 700, alpha: 1 });
  // PLAY/STOP des machines : ce qu'il lance (les trois), en orange comme les noms de leurs voies
  texts.push({ text: 'MACHINES', x: MIX.masterX, z: MIX.play.labelZ, cap: 0.075, weight: 700, ink: 'orange', alpha: 1, maxW: 1.1 });
  // Tenu droit, ADD DECK est dans la colonne du MASTER : son nom au-dessus ; sinon a gauche de sa touche, en orange comme REMOVE DECK
  const keyName = (k: DjKeySpec, text: string): Text =>
    MIX.keysInMaster
      ? { text, x: k.x - ux, z: k.z - k.d / 2 - 0.15, cap: 0.075, weight: 700, ink: 'orange', alpha: 1, maxW: 1.1 }
      : { text, x: k.x - ux - k.w / 2 - 0.14, z: k.z, cap: 0.11, weight: 700, ink: 'orange', alpha: 1, align: 'right' };
  const ad = DJ_KEYS.find((k) => k.target.kind === 'adddeck');
  if (ad) texts.push(keyName(ad, 'ADD DECK'));
  return { texts, lines, brackets };
}

/**
 * Une plaque serigraphiee (2026-10-04) : sa
 * largeur, sa place (x, repere du rig), ce qu'elle porte, son logotype a
 * droite de l'en-tete.
 */
export interface SilkSpec {
  name: string;
  w: number;
  x: number;
  items(): { texts: Text[]; lines: Line[]; brackets: Bracket[] };
  logo: { h: number; z: number };
  /** sa profondeur (par defaut celle d'un bloc du MM-DECKS ; le MM-SMPL en hauteur au telephone est plus profond) */
  d?: number;
}

const specOf = (u: DjUnit): SilkSpec => ({
  name: `djSilk-${u}`,
  w: unitW(u),
  x: UNIT_X[u],
  items: () => (u === 'a' || u === 'b' || u === 'c' || u === 'd' ? deckItems(u) : mixItems()),
  // Platine : plus petit et plus haut, au-dessus du cadre de l'ecran
  logo: u === 'mix' && !PORTRAIT ? { h: 0.42, z: MIX.head.z } : { h: DECK.logo.h, z: DECK.logo.z },
});

export class DjSilk {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private W: number;
  private H: number;
  private w: number;
  private d: number;
  private ppu: number;
  private spec: SilkSpec;
  draws = 0;

  /** Un bloc du MM-DECKS, ou une plaque decrite (le MM-SMPL). */
  constructor(unit: DjUnit | SilkSpec, anisotropy: number, mobile: boolean) {
    this.spec = typeof unit === 'string' ? specOf(unit) : unit;
    this.ppu = mobile ? 130 : 150;
    this.w = this.spec.w;
    this.d = this.spec.d ?? DJ_UNIT.d;
    this.W = Math.round(this.w * this.ppu);
    this.H = Math.round(this.d * this.ppu);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('dj: no 2d context');
    this.ctx = ctx as Ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    const geo = new PlaneGeometry(this.w, this.d);
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
    mat.name = 'djSilk';
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * step(0.5, diffuseColor.r - diffuseColor.b) * ${SILK.orangeGlow.toFixed(2)};`
      );
    };
    mat.customProgramCacheKey = () => 'silkOrange';
    this.mesh = new Mesh(geo, mat);
    this.mesh.name = this.spec.name;
    this.mesh.position.set(this.spec.x, 0.004, 0);
    this.mesh.receiveShadow = true;
    this.draw();
  }

  private px(x: number): number {
    return (x + this.w / 2) * this.ppu;
  }

  private py(z: number): number {
    return (z + this.d / 2) * this.ppu;
  }

  private scales(items: readonly Text[]): number[] {
    const fit = items.map((it) => {
      if (!it.maxW) return 1;
      const w = trackedWidth(this.ctx, it.text, (it.cap / SILK.capRatio) * this.ppu, it.weight ?? SILK.weight) / this.ppu;
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
    const P = this.ppu;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.textBaseline = 'alphabetic';
    ctx.lineCap = 'butt';
    const { texts, lines, brackets } = this.spec.items();
    ctx.lineWidth = Math.max(1, 0.014 * P);
    ctx.strokeStyle = silkA(0.55);
    for (const l of lines) {
      ctx.beginPath();
      ctx.moveTo(this.px(l[0]), this.py(l[1]));
      for (let i = 2; i < l.length; i += 2) ctx.lineTo(this.px(l[i]), this.py(l[i + 1]));
      ctx.stroke();
    }
    this.brackets(brackets);
    // Le logotype a droite de l'en-tete
    const mark = logoImage('mark');
    if (mark) {
      const h = Math.round(this.spec.logo.h * P);
      const w = Math.max(1, Math.round((h * mark.naturalWidth) / mark.naturalHeight));
      const z = this.spec.logo.z;
      ctx.drawImage(this.tint(mark, w, h), Math.round(this.px(this.w / 2 - 0.45) - w), Math.round(this.py(z) - h / 2));
    }
    const scales = this.scales(texts);
    texts.forEach((it, i) => {
      const cap = it.cap * scales[i];
      const fontPx = (cap / SILK.capRatio) * P;
      const weight = it.weight ?? SILK.weight;
      const w = trackedWidth(ctx, it.text, fontPx, weight);
      const cx = this.px(it.x);
      const x0 = it.align === 'right' ? cx - w : it.align === 'left' ? cx : cx - w / 2;
      ctx.fillStyle = it.ink === 'orange' ? HEX.orange : silkA(it.alpha ?? SILK.alpha);
      ctx.globalAlpha = it.ink === 'orange' ? (it.alpha ?? 1) : 1;
      drawTracked(ctx, it.text, x0, this.py(it.z) + (cap * P) / 2, fontPx, weight);
      ctx.globalAlpha = 1;
    });
    this.draws += 1;
    this.texture.needsUpdate = true;
  }

  private brackets(list: readonly Bracket[]): void {
    const ctx = this.ctx;
    const B = BRACKET;
    const fontPx = (B.cap / SILK.capRatio) * this.ppu;
    ctx.strokeStyle = silkA(SILK.lineAlpha);
    ctx.lineWidth = Math.max(1, SILK.lineWidth * this.ppu);
    for (const g of list) {
      const mid = (g.x0 + g.x1) / 2;
      const half = trackedWidth(ctx, g.text, fontPx, B.weight) / this.ppu / 2 + B.pad;
      const t = g.down ? g.z + B.tick : g.z - B.tick;
      for (const l of [
        [g.x0, t, g.x0, g.z, mid - half, g.z],
        [mid + half, g.z, g.x1, g.z, g.x1, t],
      ]) {
        ctx.beginPath();
        ctx.moveTo(this.px(l[0]), this.py(l[1]));
        for (let i = 2; i < l.length; i += 2) ctx.lineTo(this.px(l[i]), this.py(l[i + 1]));
        ctx.stroke();
      }
      ctx.fillStyle = g.ink === 'orange' ? HEX.orange : silkA(1);
      const w = trackedWidth(ctx, g.text, fontPx, B.weight);
      drawTracked(ctx, g.text, this.px(mid) - w / 2, this.py(g.z) + (B.cap * this.ppu) / 2, fontPx, B.weight);
    }
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

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
