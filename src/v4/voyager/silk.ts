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
 *   de SEMI (-7 a +7, les impairs ecrits), celle de FINE (-50 0 +50) ;
 * - les deux LED rouges du bouton SUB OCT (2026-10-11, a la place de celles
 *   de ON) et leurs noms, -1 et -2 : l'octave choisie allumee (redessinees
 *   quand elle change) ; celles du bouton CHORUS (2026-10-12), I et II comme
 *   sur le Juno-106, eteintes a OFF.
 * Deux textures canvas sur deux plans couches sur le capot ; redessinees
 * a l'arrivee des polices et des logos, et OPEN <-> CLOSE.
 */

import { BufferAttribute, Color, Mesh, MeshLambertMaterial, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { albedo } from '../scene/materials';
import { LEATHER_TILE, leatherShade, leatherTile, setLeatherAmount } from './leather';
import { LEATHER_MEAN } from './leatherField';
import { drawTracked, fontsReady, logoImage, makeCanvasTexture, trackedWidth } from '../scene/silk';
import { APPEARANCE, GAIN, HEX, PLUGIN_ARP, PORTRAIT, SILK, silkA } from '../theme';
import { CHORDS } from './chords';
import { wavePoints } from './glyphs';
import { VOY_FACE_KNOBS, WAVES1, WAVES2, morphPos, stepIndex, voyParams, type VoyKnobId } from './params';
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
  isPush,
  isSwitch,
  knobThrowDeg,
  stepDeg,
  voyScale,
  knobSize,
  switchThrowDeg,
  voyKnobPlace,
  voyPadAt,
  voyPushLeds,
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

/**
 * Les noms de potards poses par un autre que le site (2026-11-13 : HELL, le plugin MM-ARP seul, plugin/arp/hellKnob.ts) :
 * vide au site. Meme corps que les noms des potards du plan.
 */
const EXTRA_KNOB_TEXTS: { where: VoySilkKind; text: string; x: number; z: number }[] = [];
export function voySilkExtraKnob(where: VoySilkKind, text: string, x: number, labelZ: number): void {
  if (!EXTRA_KNOB_TEXTS.some((t) => t.where === where && t.text === text)) EXTRA_KNOB_TEXTS.push({ where, text, x, z: labelZ });
}

/** Les libelles des potards d'un plan (meme corps pour tous : un seul groupe). */
function knobTexts(where: VoySilkKind): Text[] {
  const out: Text[] = [];
  for (const t of EXTRA_KNOB_TEXTS) if (t.where === where) out.push({ text: t.text, x: t.x, z: t.z, cap: PORTRAIT ? 0.1 : 0.068, maxW: PORTRAIT ? 0.84 : 0.76, group: PORTRAIT ? `knob${Math.round(t.z * 4)}` : 'knob' });
  for (const k of VOY_FACE_KNOBS) {
    const p = voyKnobPlace(k.id);
    if (p.where !== where) continue;
    // Le nom sur la machine (les rangees d'oscillateurs : WAVEFORM, RANGE, SEMI, FINE) ; SUB OCT et SUB WAVE en entier,
    // partout depuis le 2026-10-11 (desktop : OCT et WAVE avant, la rangee du bas au pas de 0.62 ; elle est au pas de 0.9)
    // Le VST3 (2026-11-17, Mika : "Overdrive doit s'appeler DISTO maintenant") : OVERDRIVE devient DISTO ; le site garde OVERDRIVE
    const name = PLUGIN_ARP && k.id === 'dist' ? 'DISTO' : (k.face ?? k.label);
    // Au telephone tenu droit (2026-10-05, Mika : "trop difficile a lire") : des noms plus gros, un corps par rangee
    if (name) out.push({ text: name, x: p.x, z: p.labelZ, cap: PORTRAIT ? 0.1 : 0.068, maxW: PORTRAIT ? 0.84 : 0.76, group: PORTRAIT ? `knob${Math.round(p.labelZ * 4)}` : 'knob' });
    // Commutateur : ses positions ecrites au bout de leur repere (MOOG, 12, BP, HP)
    const steps = k.steps;
    if (isSwitch(k.id) && steps) {
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
    const nav = b.id === 'open' || b.id === 'preset';
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

/**
 * Le cuir du plugin MM-ARP (v35 : une photo du cuir, voyager/leather.ts) : LEATHER TEXTURE dose la photo (0 : la laque
 * lisse, 1 : le cuir du fond de Legend HZ, le depart). tone : la teinte du cuir plein (lineaire, par canal), reglee a la
 * mesure pour que le panneau sorte a l'ecran comme la photo : ~23 / 255, et NEUTRE (les lumieres de la scene sont
 * chaudes : le bleu les compense, le fond de Legend HZ est un gris sans dominante). grain : la part de la photo a
 * LEATHER TEXTURE 100 (la courbe de la scene accentue les noirs : a 1, le grain sortait plus contraste que la photo).
 */
export const LEATHER = { def: 1, tone: [0.0312, 0.0333, 0.0382], grain: 0.69 } as const;
/** La moyenne de la photo, en lumiere lineaire (sRGB 23 / 255) : la couleur du materiau la compense. */
const LEATHER_LIN = ((LEATHER_MEAN / 255 + 0.055) / 1.055) ** 2.4;
/** La lumiere du panneau (0..1, 0.5 neutre) : le gain de sa teinte, de 0.6 a 1.4. */
export const lightGain = (light: number): number => 0.6 + 0.8 * Math.min(1, Math.max(0, light));

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
  /** le cuir (le plugin MM-ARP seul), sa dose (0 : la laque, cache) et la force des aretes entre les sections */
  leather: Mesh | null = null;
  private seam = 0;
  /** logos poses au dernier dessin (panneau) */
  logos: string[] = [];
  /** crans choisis des deux selecteurs de forme */
  /** positions des morphings (rig.ts les arrondit au vingtieme de cran : un dessin par vingtieme) */
  private sel = { wave1: morphPos('wave1', voyParams.of('wave1')), wave2: morphPos('wave2', voyParams.of('wave2')) };
  /** le cran de chaque bouton poussoir (SUB OCT : 0 pour -1, 1 pour -2 ; CHORUS : 0 OFF, 1 I, 2 II), sa LED allumee */
  private push: Partial<Record<VoyKnobId, number>> = Object.fromEntries(VOY_FACE_KNOBS.filter((k) => isPush(k.id)).map((k) => [k.id, stepIndex(k.id, voyParams.of(k.id))]));

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
    // Le cuir du panneau, sous la serigraphie (2026-11-16, Mika : "fond en cuir") ; setLook le dose (LEATHER TEXTURE,
    // 0 : la laque d'avant, le plan cache) et regle sa lumiere (plugin/arp/look.ts)
    if (PLUGIN_ARP) {
      // v35 : la photo du cuir en couleur (une tuile de 4 unites, en boucle), sur un materiau MAT sans reflet (Lambert) :
      // sur un noir aussi profond, le reflet d'un materiau standard pesait autant que la couleur et delavait le grain de
      // moitie ; sans carte de normales, rien ne scintille. De larges nappes de lumiere par les couleurs de sommets.
      const tile = leatherTile(this.plane.w / LEATHER_TILE, this.plane.d / LEATHER_TILE);
      const SX = 28;
      const SY = Math.max(4, Math.round((SX * this.plane.d) / this.plane.w));
      const lg = new PlaneGeometry(this.plane.w, this.plane.d, SX, SY);
      const shade = leatherShade(this.plane.w, this.plane.d, kind === 'panel' ? 31 : 47);
      const uv = lg.getAttribute('uv');
      const cols = new Float32Array(uv.count * 3);
      for (let i = 0; i < uv.count; i += 1) cols[i * 3] = cols[i * 3 + 1] = cols[i * 3 + 2] = shade(uv.getX(i), uv.getY(i));
      lg.setAttribute('color', new BufferAttribute(cols, 3));
      lg.rotateX(-Math.PI / 2);
      lg.translate(0, 0, this.plane.cz);
      const lm = new MeshLambertMaterial({
        color: new Color(),
        map: tile,
        vertexColors: true,
        polygonOffset: true,
        polygonOffsetFactor: -0.5,
        polygonOffsetUnits: -0.5,
      });
      lm.name = 'arpLeather';
      const leather = new Mesh(lg, lm);
      leather.name = `arpLeather-${kind}`;
      leather.position.y = -0.002;
      leather.receiveShadow = true;
      leather.renderOrder = -1;
      this.mesh.add(leather);
      this.leather = leather;
      this.setLook(LEATHER.def, 0.5);
    }
    this.draw();
  }

  /**
   * Le cuir dose (t : 0 la laque d'avant, 1 le cuir plein) et la lumiere du panneau (light : 0.5 neutre) ; true si la
   * serigraphie est a redessiner (les aretes entre les sections suivent le cuir). Le plugin MM-ARP seul (look.ts).
   */
  setLook(t: number, light: number): boolean {
    const L = this.leather;
    if (!L) return false;
    const m = L.material as MeshLambertMaterial;
    const k = lightGain(light);
    L.visible = t > 0.001;
    const lac = albedo('voyPanel', new Color(), GAIN.voyPanel ?? GAIN.parts);
    // la photo (moyenne LEATHER_LIN) : la couleur la compense ; de la teinte de la laque a celle du cuir ; la photo dosee par t
    const c = lac.clone().lerp(new Color(LEATHER.tone[0], LEATHER.tone[1], LEATHER.tone[2]), t).multiplyScalar(k / LEATHER_LIN);
    m.color.copy(c);
    setLeatherAmount(t * LEATHER.grain);
    const seam = Math.round(Math.min(1, t * 1.5) * 20) / 20;
    if (seam === this.seam) return false;
    this.seam = seam;
    return true;
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
    // Les aretes entre les sections (le cuir seul, 2026-11-16, comme des panneaux separes) : un sillon sombre a gauche
    // du filet, un lisere clair a sa droite ; le filet reste
    if (this.kind === 'panel' && this.seam > 0) {
      ctx.save();
      for (const l of VOY_RULES) {
        const x = this.px(l[0]);
        const y0 = this.py(l[1]);
        const y1 = this.py(l[3]);
        ctx.fillStyle = `rgba(0, 0, 0, ${(0.7 * this.seam).toFixed(3)})`;
        ctx.fillRect(x - 0.03 * PPU, y0, 0.026 * PPU, y1 - y0);
        ctx.fillStyle = `rgba(0, 0, 0, ${(0.3 * this.seam).toFixed(3)})`;
        ctx.fillRect(x - 0.048 * PPU, y0, 0.018 * PPU, y1 - y0);
        ctx.fillStyle = `rgba(255, 250, 240, ${(0.1 * this.seam).toFixed(3)})`;
        ctx.fillRect(x + 0.006 * PPU, y0, Math.max(1, 0.008 * PPU), y1 - y0);
      }
      ctx.restore();
    }
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
    // Les rangees d'oscillateurs facon Mini V : echelles, numeros ; les LED des boutons poussoirs
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
        const align = ('align' in VOY_HEAD.mark ? VOY_HEAD.mark.align : 'right') ?? 'right';
        const x0 = align === 'center'
          ? Math.round(this.px(VOY_HEAD.mark.x) - w / 2)
          : Math.round(this.px(VOY_HEAD.mark.x) - w);
        ctx.drawImage(this.tint(mark, w, h), x0, Math.round(this.py(VOY_HEAD.mark.z) - h / 2));
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
    // Le plugin MM-ARP (v30, Mika : "a la place du jaune cette couleur FF0066") : la couleur d'accent (HEX.orange) a la place du jaune Typhon
    const dark = PLUGIN_ARP ? new Color(HEX.orange).getStyle().replace('rgb(', '').replace(')', '') : '242, 194, 48';
    const color = (a: number, on: boolean): string => (light ? (on ? HEX.orange : silkA(a)) : `rgba(${dark}, ${a})`);
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

  /**
   * Les LED de chaque bouton poussoir (SUB OCT, 2026-10-11 : celles de ON avant ; CHORUS, 2026-10-12), son nom
   * au-dessus de chacune (-1, -2 ; I, II) : celle du cran choisi rouge allumee (elle luit), les autres sombres ;
   * CHORUS a OFF : toutes eteintes.
   */
  private leds(): void {
    for (const k of VOY_FACE_KNOBS) {
      if (!isPush(k.id) || voyKnobPlace(k.id).where !== this.kind) continue;
      const cur = this.push[k.id] ?? 0;
      for (const led of voyPushLeds(k.id, k.steps ?? [])) {
        this.led(led.x, led.z, led.step === cur);
        this.mini(led.text, led.x, led.tz, 0.05 * K, 0.85);
      }
    }
  }

  /** Une LED en (x, z) : rouge allumee (elle luit), sombre eteinte. */
  private led(lx: number, lz: number, lit: boolean): void {
    const ctx = this.ctx;
    const x = this.px(lx);
    const y = this.py(lz);
    const r = VOY_LED.r * PPU;
    if (PLUGIN_ARP) {
      // 2026-11-16 : une vraie LED : la bague noire, la lentille bombee (son reflet), le halo allumee ; eteinte, un
      // rouge sombre qu'on voit
      if (lit) {
        // le halo, attenue (2026-11-16, Mika : "trop fort")
        const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.6);
        g.addColorStop(0, 'rgba(255, 60, 40, 0.38)');
        g.addColorStop(0.45, 'rgba(255, 50, 30, 0.12)');
        g.addColorStop(1, 'rgba(255, 50, 30, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#050404';
      ctx.beginPath();
      ctx.arc(x, y + r * 0.08, r * 1.28, 0, Math.PI * 2);
      ctx.fill();
      const lens = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
      if (lit) {
        lens.addColorStop(0, '#fff1e8');
        lens.addColorStop(0.28, '#ff8a6a');
        lens.addColorStop(0.7, '#ff2d1c');
        lens.addColorStop(1, '#b3140a');
      } else {
        lens.addColorStop(0, '#7a3a34');
        lens.addColorStop(0.35, '#4a1612');
        lens.addColorStop(1, '#260806');
      }
      ctx.fillStyle = lens;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lit ? 'rgba(255,255,255,0.75)' : 'rgba(255,220,210,0.35)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.32, y - r * 0.38, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
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

  /** Les crans des boutons poussoirs, leur LED allumee (revue : window.__v4.voyager.rig). */
  get pushes(): Readonly<Partial<Record<VoyKnobId, number>>> {
    return this.push;
  }

  /** Le cran d'un bouton poussoir (sa LED) ; true si redessine. */
  setPush(id: VoyKnobId, step: number): boolean {
    if (!isPush(id) || this.push[id] === step) return false;
    this.push = { ...this.push, [id]: step };
    if (voyKnobPlace(id).where !== this.kind) return false;
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
