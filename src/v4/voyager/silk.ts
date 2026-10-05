/**
 * Serigraphie du MM-VOYAGER (2026-10-03), la meme encre et la meme police
 * que la 808 (SF Pro Display, capitales espacees, encre de l'apparence) :
 * - le panneau : wordmark Maudite Machine, MM-VOYAGER, le logotype a
 *   droite (comme la 808), les titres des sections facon Moog et leurs
 *   filets (desktop), le nom de chaque potard, les graduations 0 a 10
 *   autour des gros potards ;
 * - le plateau : les noms des accords sous les pads, RUN/STOP, CLEAR,
 *   RANDOM, OPEN en orange (CLOSE capot ouvert) ; portrait : les potards
 *   de l'arpegiateur et VOLUME ;
 * - sur l'un ou l'autre : les crochets nommes sous chaque groupe
 *   (VOY_GROUPS), le nom en gras dans le trait ;
 * - autour de WAVE 1 et WAVE 2 (2026-10-03, facon Typhon) : un arc jaune
 *   par cran et le dessin de sa forme ; le cran choisi en plein, les autres
 *   pales (redessine quand le cran change).
 * - les rangees d'oscillateurs facon Mini V (2026-10-04) : le numero de
 *   chaque rangee en onglet, les crans de RANGE ecrits (LO a 2'), l'echelle
 *   de SEMI (-7 a +7, les impairs ecrits), celle de FINE (-50 0 +50), la
 *   LED rouge de ON (redessinee quand ON change).
 * Deux textures canvas sur deux plans couches sur le capot ; redessinees
 * a l'arrivee des polices et des logos, et OPEN <-> CLOSE.
 */

import { Mesh, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { drawTracked, fontsReady, logoImage, makeCanvasTexture, trackedWidth } from '../scene/silk';
import { APPEARANCE, HEX, PORTRAIT, SILK, silkA } from '../theme';
import { CHORDS } from './chords';
import { wavePoints } from './glyphs';
import { VOY_FACE_KNOBS, WAVES1, WAVES2, morphPos, voyParams } from './params';
import {
  VOY_BODY,
  VOY_BUTTONS,
  VOY_BUTTON,
  VOY_COPY,
  VOY_GROUPS,
  VOY_GROUP_TYPE,
  VOY_HEAD,
  VOY_BADGE,
  VOY_KNOB,
  VOY_LED,
  VOY_LID_W,
  VOY_OSC_BADGES,
  VOY_PAD,
  VOY_PANEL,
  VOY_RULES,
  VOY_SECTIONS,
  VOY_SEL,
  VOY_SWITCH,
  isSelector,
  isBigKnob,
  isOscOn,
  isSwitch,
  knobThrowDeg,
  stepDeg,
  voyScale,
  knobSize,
  switchThrowDeg,
  voyKnobPlace,
  voyPadAt,
} from './theme';

/** Angle (deg, 90 : en haut) de la position i d'un commutateur : 12 a gauche, 24 a droite. */
const switchDeg = (i: number, n: number): number => 90 + switchThrowDeg(n) / 2 - (switchThrowDeg(n) * i) / Math.max(1, n - 1);

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

/** Les libelles des potards d'un plan (meme corps pour tous : un seul groupe). */
function knobTexts(where: VoySilkKind): Text[] {
  const out: Text[] = [];
  for (const k of VOY_FACE_KNOBS) {
    const p = voyKnobPlace(k.id);
    if (p.where !== where) continue;
    // Le nom sur la machine (les rangees d'oscillateurs : WAVEFORM, RANGE, SEMI, FINE ; ON : son nom sous le commutateur)
    const name = isOscOn(k.id) ? 'ON' : k.face ?? k.label;
    // Au telephone tenu droit (2026-10-05, Mika : "trop difficile a lire") : des noms plus gros, un corps par rangee
    if (name) out.push({ text: name, x: p.x, z: p.labelZ, cap: PORTRAIT ? 0.1 : 0.068, maxW: PORTRAIT ? 0.84 : 0.76, group: PORTRAIT ? `knob${Math.round(p.labelZ * 4)}` : 'knob' });
    // Commutateur : ses positions ecrites au bout de leur repere (MOOG, 12, BP, HP) ; ON : sa LED les dit
    const steps = k.steps;
    if (isSwitch(k.id) && steps && !isOscOn(k.id)) {
      steps.forEach((step, i) => {
        const a = switchDeg(i, steps.length);
        const r = VOY_KNOB.skirt.r * p.s + VOY_SWITCH.markR;
        const x = p.x + Math.cos((a * Math.PI) / 180) * r;
        const z = p.z - Math.sin((a * Math.PI) / 180) * r;
        // Les reperes : MOOG, 12, BP, HP (MODE du filtre)
        out.push({ text: step.replace('LP', ''), x, z, cap: VOY_SWITCH.cap * K, weight: 600 });
      });
    }
  }
  return out;
}

/** Les noms des groupes d'un plan, poses dans leur crochet. */
function groupTexts(where: VoySilkKind): Text[] {
  return VOY_GROUPS.filter((g) => g.where === where).map((g) => ({
    text: g.text,
    x: (g.x0 + g.x1) / 2,
    z: g.z,
    cap: VOY_GROUP_TYPE.cap,
    weight: VOY_GROUP_TYPE.weight,
    alpha: 1,
  }));
}

function panelTexts(): Text[] {
  const out: Text[] = [];
  out.push({ text: VOY_COPY.model, x: VOY_HEAD.model.x, z: VOY_HEAD.z, cap: VOY_HEAD.model.cap, align: 'left', weight: SILK.strongWeight });
  if (VOY_HEAD.sub) out.push({ text: VOY_HEAD.sub.text, x: VOY_HEAD.sub.x, z: VOY_HEAD.z, cap: 0.065, align: 'right', alpha: 0.45 });
  out.push({ text: 'MAUDITE MACHINE', x: VOY_HEAD.word.x, z: VOY_HEAD.z, cap: 0.18, align: 'left', weight: SILK.strongWeight, group: 'fallback' });
  for (const s of VOY_SECTIONS) out.push({ text: s.text, x: s.x, z: s.z, cap: 0.075 * K, weight: 700, alpha: 1 });
  out.push(...knobTexts('panel'), ...groupTexts('panel'));
  return out;
}

function deckTexts(open: boolean): Text[] {
  const out: Text[] = [];
  CHORDS.forEach((c, i) => {
    const p = voyPadAt(i);
    out.push({ text: c.label, x: p.x, z: p.z + VOY_PAD.labelDz, cap: 0.1 * K, weight: 600, maxW: VOY_PAD.size, group: 'pads' });
  });
  out.push(...knobTexts('deck'), ...groupTexts('deck'));
  for (const b of VOY_BUTTONS) {
    const label = b.id === 'open' && open ? 'CLOSE' : b.label;
    const nav = b.id === 'open';
    out.push({
      text: label,
      x: b.x,
      z: b.z + b.d / 2 + VOY_BUTTON.labelGap,
      cap: PORTRAIT ? 0.12 : 0.08,
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
  /** logos poses au dernier dessin (panneau) */
  logos: string[] = [];
  /** crans choisis des deux selecteurs de forme */
  /** positions des morphings (rig.ts les arrondit au vingtieme de cran : un dessin par vingtieme) */
  private sel = { wave1: morphPos('wave1', voyParams.of('wave1')), wave2: morphPos('wave2', voyParams.of('wave2')) };
  /** ON des deux oscillateurs (leurs LED) */
  private on = { on1: voyParams.of('on1') >= 0.5, on2: voyParams.of('on2') >= 0.5 };

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
    // Filets entre les sections (desktop), crochets des groupes
    ctx.strokeStyle = silkA(SILK.lineAlpha);
    ctx.lineWidth = Math.max(1, SILK.lineWidth * PPU);
    if (this.kind === 'panel') {
      for (const l of VOY_RULES) {
        ctx.beginPath();
        ctx.moveTo(this.px(l[0]), this.py(l[1]));
        ctx.lineTo(this.px(l[2]), this.py(l[3]));
        ctx.stroke();
      }
    }
    this.brackets();
    // Graduations 0 a 10 autour des gros potards (CUTOFF, VOLUME), facon Moog
    ctx.strokeStyle = silkA(0.6);
    for (const k of VOY_FACE_KNOBS) {
      if (!isBigKnob(k.id)) continue;
      const p = voyKnobPlace(k.id);
      if (p.where !== this.kind) continue;
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
    // Commutateurs : un repere par position
    ctx.strokeStyle = silkA(0.75);
    ctx.lineWidth = Math.max(1, 0.016 * PPU);
    for (const k of VOY_FACE_KNOBS) {
      const steps = k.steps;
      if (!isSwitch(k.id) || !steps) continue;
      const p = voyKnobPlace(k.id);
      if (p.where !== this.kind) continue;
      const r0 = VOY_KNOB.skirt.r * p.s + VOY_SWITCH.tick.r0;
      const r1 = r0 + VOY_SWITCH.tick.len;
      steps.forEach((_, i) => {
        const a = (switchDeg(i, steps.length) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(this.px(p.x + Math.cos(a) * r0), this.py(p.z - Math.sin(a) * r0));
        ctx.lineTo(this.px(p.x + Math.cos(a) * r1), this.py(p.z - Math.sin(a) * r1));
        ctx.stroke();
      });
    }
    // Plus d'arcs imprimes autour des potards (2026-10-04, Mika : "les contours des knobs, enleve ca") : seules les couronnes de WAVE 1 et WAVE 2 restent
    this.selectors();
    // Les rangees d'oscillateurs facon Mini V : echelles, numeros, LED
    this.oscScales();
    this.badges();
    this.leds();
    if (this.kind === 'panel') {
      // Wordmark a gauche, logotype a droite (comme la 808)
      const img = logoImage('wordmark');
      items = panelTexts();
      if (img) {
        const ratio = img.naturalWidth / img.naturalHeight;
        const w = Math.round(VOY_HEAD.word.w * PPU);
        const h = Math.max(1, Math.round(w / ratio));
        ctx.drawImage(this.tint(img, w, h), Math.round(this.px(VOY_HEAD.word.x)), Math.round(this.py(VOY_HEAD.z) - h / 2));
        items = items.filter((t) => t.group !== 'fallback');
      }
      const mark = logoImage('mark');
      if (mark) {
        const h = Math.round(VOY_HEAD.mark.h * PPU);
        const w = Math.max(1, Math.round((h * mark.naturalWidth) / mark.naturalHeight));
        ctx.drawImage(this.tint(mark, w, h), Math.round(this.px(VOY_HEAD.mark.x) - w), Math.round(this.py(VOY_HEAD.mark.z) - h / 2));
        this.logos = logoImage('wordmark') ? ['wordmark', 'mark'] : ['mark'];
      } else this.logos = img ? ['wordmark'] : [];
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

  /**
   * Crochets des groupes de ce plan : un tic qui monte au bord du premier
   * element, le trait sous les libelles, interrompu pour le nom, le tic du
   * dernier.
   */
  private brackets(): void {
    const ctx = this.ctx;
    const T = VOY_GROUP_TYPE;
    const fontPx = (T.cap / SILK.capRatio) * PPU;
    for (const g of VOY_GROUPS) {
      if (g.where !== this.kind) continue;
      const mid = (g.x0 + g.x1) / 2;
      const half = trackedWidth(ctx, g.text, fontPx, T.weight) / PPU / 2 + T.pad;
      const t = g.z - T.tick;
      for (const l of [
        [g.x0, t, g.x0, g.z, mid - half, g.z],
        [mid + half, g.z, g.x1, g.z, g.x1, t],
      ]) {
        ctx.beginPath();
        ctx.moveTo(this.px(l[0]), this.py(l[1]));
        for (let i = 2; i < l.length; i += 2) ctx.lineTo(this.px(l[i]), this.py(l[i + 1]));
        ctx.stroke();
      }
    }
  }

  /**
   * Les couronnes des selecteurs de forme de ce plan : pour chaque cran, un
   * arc (un jour entre deux) et le dessin de la forme dehors, droit. Le
   * morphing (2026-10-03) : entre deux formes, les deux s'allument, chacune
   * en proportion de sa part.
   */
  private selectors(): void {
    const ctx = this.ctx;
    const S = VOY_SEL;
    // Machine noire : jaune Typhon, le cran choisi plein. Machine claire (2026-10-03,
    // Mika n'aimait pas l'ambre) : l'encre de la serigraphie, le cran choisi en orange
    const light = APPEARANCE.current === 'light';
    const color = (a: number, on: boolean): string => (light ? (on ? HEX.orange : silkA(a)) : `rgba(242, 194, 48, ${a})`);
    const dim = light ? S.dim.light : S.dim.dark;
    for (const k of VOY_FACE_KNOBS) {
      if (!isSelector(k.id)) continue;
      const p = voyKnobPlace(k.id);
      if (p.where !== this.kind) continue;
      const waves = k.id === 'wave1' ? WAVES1 : WAVES2;
      const n = waves.length;
      const pos = this.sel[k.id as 'wave1' | 'wave2'];
      const step = 270 / (n - 1);
      const half = step / 2 - S.gapDeg / 2;
      const cx = this.px(p.x);
      const cy = this.py(p.z);
      const rArc = S.arcR * p.s * PPU;
      ctx.lineCap = 'butt';
      waves.forEach((w, i) => {
        const a = 225 - step * i;
        // La part de cette forme dans le morphing : 1 sur son cran, 0 a un cran et plus
        const part = Math.max(0, 1 - Math.abs(pos - i));
        const on = part >= 0.5;
        // Clair : l'orange porte la forme dominante, plus ou moins fort ; les autres a l'encre
        const alpha = light && on ? 0.35 + 0.65 * part : dim + (1 - dim) * part;
        ctx.globalAlpha = light && on ? alpha : 1;
        // Arc : angles du canvas (y vers le bas), le sens inverse de ceux du panneau
        ctx.strokeStyle = color(alpha, on);
        ctx.lineWidth = Math.max(1, S.arcW * p.s * PPU);
        ctx.beginPath();
        ctx.arc(cx, cy, rArc, (-(a + half) * Math.PI) / 180, (-(a - half) * Math.PI) / 180);
        ctx.stroke();
        const gx = p.x + Math.cos((a * Math.PI) / 180) * S.glyphR * p.s;
        const gz = p.z - Math.sin((a * Math.PI) / 180) * S.glyphR * p.s;
        this.glyph(w, this.px(gx), this.py(gz), S.glyph.w * p.s * PPU, S.glyph.h * p.s * PPU, Math.max(1, S.glyph.stroke * p.s * PPU), color(alpha, on));
        ctx.globalAlpha = 1;
      });
    }
  }

  /** Un texte centre sur (x, z), au corps cap (unites), a l'encre (alpha). */
  private mini(text: string, x: number, z: number, cap: number, alpha: number, weight = 600): void {
    const ctx = this.ctx;
    const fontPx = (cap / SILK.capRatio) * PPU;
    const w = trackedWidth(ctx, text, fontPx, weight);
    ctx.fillStyle = silkA(alpha);
    drawTracked(ctx, text, this.px(x) - w / 2, this.py(z) + (cap * PPU) / 2, fontPx, weight);
  }

  /** Un trait de graduation, de r0 a r1 autour de (x, z), a l'angle a (deg). */
  private tick(x: number, z: number, a: number, r0: number, r1: number): void {
    const ctx = this.ctx;
    const c = Math.cos((a * Math.PI) / 180);
    const sn = Math.sin((a * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(this.px(x + c * r0), this.py(z - sn * r0));
    ctx.lineTo(this.px(x + c * r1), this.py(z - sn * r1));
    ctx.stroke();
  }

  /**
   * Les echelles des rangees d'oscillateurs (Mini V) : RANGE, un repere et
   * son nom par cran (LO a 2') ; SEMI, un repere par demi-ton, le 0 plus
   * long, les impairs ecrits ; FINE, onze reperes, -50 0 +50 ecrits.
   */
  private oscScales(): void {
    const ctx = this.ctx;
    const cap = 0.05 * K;
    for (const k of VOY_FACE_KNOBS) {
      const sc = voyScale(k.id);
      if (!sc) continue;
      const p = voyKnobPlace(k.id);
      if (p.where !== this.kind) continue;
      const r0 = VOY_KNOB.skirt.r * p.s + 0.04;
      const r1 = r0 + 0.06;
      ctx.strokeStyle = silkA(0.7);
      if (sc === 'range' || sc === 'semi') {
        const steps = k.steps ?? [];
        const n = steps.length;
        const throwDeg = knobThrowDeg(k.id, n);
        steps.forEach((label, i) => {
          const a = stepDeg(i, n, throwDeg);
          const zero = sc === 'semi' && i === 7;
          ctx.lineWidth = Math.max(1, (zero ? 0.02 : 0.013) * PPU);
          this.tick(p.x, p.z, a, r0, zero ? r1 + 0.03 : r1);
          // RANGE : chaque cran ; SEMI : les impairs (-7 -5 ... +7)
          if (sc === 'semi' && i % 2 === 1) return;
          if (sc === 'semi' && i === 7) return;
          const rt = r1 + (sc === 'range' ? 0.11 : 0.09);
          this.mini(label, p.x + Math.cos((a * Math.PI) / 180) * rt, p.z - Math.sin((a * Math.PI) / 180) * rt, cap, 0.85);
        });
      } else {
        for (let t = 0; t <= 10; t += 1) {
          const a = 225 - 27 * t;
          const major = t % 5 === 0;
          ctx.lineWidth = Math.max(1, (major ? 0.02 : 0.012) * PPU);
          this.tick(p.x, p.z, a, r0, major ? r1 + 0.03 : r1);
        }
        const rt = r1 + 0.1;
        for (const [t, label] of [
          [0, '-50'],
          [5, '0'],
          [10, '+50'],
        ] as const) {
          const a = ((225 - 27 * t) * Math.PI) / 180;
          this.mini(label, p.x + Math.cos(a) * rt, p.z - Math.sin(a) * rt, cap, 0.85);
        }
      }
    }
  }

  /** Le numero de chaque rangee d'oscillateur : un onglet a l'encre, le chiffre en creux. */
  private badges(): void {
    if (this.kind !== 'panel') return;
    const ctx = this.ctx;
    const B = VOY_BADGE;
    for (const b of VOY_OSC_BADGES) {
      const x0 = this.px(b.x - B.w / 2);
      const y0 = this.py(b.z - B.h / 2);
      const w = B.w * PPU;
      const h = B.h * PPU;
      const r = B.r * PPU;
      ctx.fillStyle = silkA(0.85);
      ctx.beginPath();
      ctx.moveTo(x0 + r, y0);
      ctx.lineTo(x0 + w - r, y0);
      ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
      ctx.lineTo(x0 + w, y0 + h - r);
      ctx.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
      ctx.lineTo(x0 + r, y0 + h);
      ctx.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
      ctx.lineTo(x0, y0 + r);
      ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
      ctx.fill();
      // Le chiffre en creux : la couleur du panneau passe au travers
      ctx.globalCompositeOperation = 'destination-out';
      const fontPx = (B.cap / SILK.capRatio) * PPU;
      const tw = trackedWidth(ctx, b.text, fontPx, 700, 0);
      drawTracked(ctx, b.text, this.px(b.x) - tw / 2, this.py(b.z) + (B.cap * PPU) / 2, fontPx, 700, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** La LED de ON au-dessus de chaque commutateur : rouge allumee (elle luit), sombre eteinte. */
  private leds(): void {
    const ctx = this.ctx;
    for (const id of ['on1', 'on2'] as const) {
      const p = voyKnobPlace(id);
      if (p.where !== this.kind) continue;
      const x = this.px(p.x);
      const y = this.py(p.z - VOY_KNOB.skirt.r * p.s - VOY_LED.dz);
      const r = VOY_LED.r * PPU;
      const lit = this.on[id];
      if (lit) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
        g.addColorStop(0, 'rgba(255, 70, 50, 0.55)');
        g.addColorStop(1, 'rgba(255, 70, 50, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = lit ? VOY_LED.on : VOY_LED.off;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** ON des oscillateurs (leurs LED) ; true si redessine. */
  setLeds(on1: boolean, on2: boolean): boolean {
    if (on1 === this.on.on1 && on2 === this.on.on2) return false;
    this.on = { on1, on2 };
    if (voyKnobPlace('on1').where !== this.kind && voyKnobPlace('on2').where !== this.kind) return false;
    this.draw();
    return true;
  }

  /** Le dessin d'une forme dans une boite w x h centree (px) ; FM ecrit. */
  private glyph(w: string, cx: number, cy: number, bw: number, bh: number, lw: number, color: string): void {
    const ctx = this.ctx;
    const X = (u: number): number => cx + (u * bw) / 2;
    const Y = (v: number): number => cy + (v * bh) / 2;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (w === 'FM') {
      const fontPx = bh * 1.5;
      ctx.font = `700 ${fontPx}px 'SF Pro Display', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FM', cx, cy);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      return;
    }
    const pts = wavePoints(w) ?? [];
    ctx.beginPath();
    pts.forEach(([u, v], i) => (i === 0 ? ctx.moveTo(X(u), Y(v)) : ctx.lineTo(X(u), Y(v))));
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  /** Les positions des selecteurs de forme ; true si le panneau a ete redessine. */
  setSelectors(wave1: number, wave2: number): boolean {
    if (wave1 === this.sel.wave1 && wave2 === this.sel.wave2) return false;
    this.sel = { wave1, wave2 };
    if (!VOY_FACE_KNOBS.some((k) => isSelector(k.id) && voyKnobPlace(k.id).where === this.kind)) return false;
    this.draw();
    return true;
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
