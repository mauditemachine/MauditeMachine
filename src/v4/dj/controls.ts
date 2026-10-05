/**
 * Les commandes en 3D du MM-DECKS (2026-10-04), toutes dans le repere top
 * (le dessus incline) et toutes instanciees :
 * - les potards (28) : la geometrie du MM-ARP, capuchon cannele noir, jupe
 *   d'aluminium, repere os ; 270 deg de course (potAngle) ;
 * - les capuchons des faders (7) : caoutchouc noir, un trait os ;
 * - les touches (20, carrees) et les gros boutons ronds CUE et PLAY (4),
 *   caoutchouc retroeclaire par instance (instanceEmissive) : la touche
 *   entiere pour les carrees, la bague lumineuse pour les rondes ;
 * - les deux jogs : la platine noire (qui tourne, un repere os au bord) et
 *   la bague d'aluminium fixe ;
 * - les LED plates (VU des voies et du master, anneaux des jogs, zero du
 *   pitch) : une instance par segment, couleur par instance.
 */

import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector2,
  Vector3,
  BufferGeometry,
  type CanvasTexture,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HotspotDef } from '../scene/hit';
import { potAngle } from '../scene/encoders';
import { withInstanceEmissive } from '../scene/materials';
import { makeCanvasTexture } from '../scene/silk';
import { APPEARANCE, FONT_DISPLAY } from '../theme';
import { partDj } from './body';
import { VU_DB, vuZone } from './math';
import { DJ_FADERS, DJ_KEYS, DJ_KNOBS, DJ_RECT_KEYS, DJ_ROUND_KEYS, faderPos, jogCenter, type DjFaderSpec, type DjKeySpec } from './layout';
import { DECK, DJ_DECKS, DJ_DECKS_ALL, DJ_FADER, DJ_KEY, DJ_KNOB, DJ_LIGHT, DJ_ROUND, MIX, UNIT_X, type DjDeck, type DjTone } from './theme';

const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const v3 = new Vector3();
const q = new Quaternion();
const q0 = new Quaternion();
const s3 = new Vector3();
const col = new Color();

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function merge(parts: BufferGeometry[], what: string): BufferGeometry {
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error(`dj: ${what} merge failed`);
  return g;
}

/** Masque d'emission : 1 la ou la lumiere passe, base partout ailleurs. */
function setMask(g: BufferGeometry, fn: (i: number) => number): void {
  const n = g.getAttribute('position').count;
  const m = new Float32Array(n);
  for (let i = 0; i < n; i += 1) m[i] = fn(i);
  g.setAttribute('emissiveMask', new Float32BufferAttribute(m, 1));
}

/* ---------------- potards ---------------- */

/** Potard ; capTone : la teinte du capuchon (FILTER : l'orange du pad OPEN du MM-RYTM) ; markTone : son repere (noir sur l'aluminium). */
export function knobGeometry(mobile: boolean, capTone: DjTone = 'knob', markTone: DjTone = 'mark'): BufferGeometry {
  const K = DJ_KNOB;
  const seg = mobile ? K.segments.mobile : K.segments.desktop;
  const skirt = new CylinderGeometry(K.skirt.rTop, K.skirt.r, K.skirt.h, seg);
  skirt.translate(0, K.skirt.h / 2, 0);
  const cap = new CylinderGeometry(K.rTop, K.r, K.h, seg, 1);
  const p = cap.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const k = 1 - (K.fluteDepth / r) * Math.max(0, Math.cos(Math.atan2(z, x) * K.flutes)) ** 2;
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  cap.computeVertexNormals();
  cap.translate(0, K.skirt.h + K.h / 2, 0);
  const mark = new BoxGeometry(K.mark.w, K.mark.h, K.mark.d);
  mark.translate(0, K.skirt.h + K.h + K.mark.h / 2 - 0.002, -K.mark.d / 2 - 0.02);
  return merge([partDj(skirt, 'skirt'), partDj(cap, capTone), partDj(mark, markTone)], 'knobs');
}

/* ---------------- faders ---------------- */

function capGeometry(): BufferGeometry {
  const C = DJ_FADER.cap;
  const body = new RoundedBoxGeometry(C.w, C.h, C.d, 2, C.radius);
  body.translate(0, C.h / 2, 0);
  // Le dessus creuse d'une rainure, un trait os au milieu
  const groove = new BoxGeometry(C.w - 0.08, 0.006, 0.06);
  groove.translate(0, C.h + 0.001, 0);
  const line = new BoxGeometry(C.w - 0.14, 0.006, 0.018);
  line.translate(0, C.h + 0.004, 0);
  return merge([partDj(body, 'cap'), partDj(groove, 'slit'), partDj(line, 'mark')], 'fader caps');
}

/* ---------------- touches ---------------- */

/** Touche unite (1 x h x 1), mise a l'echelle par instance ; le dessus s'allume, les flancs moins. */
export function keyGeometry(mobile: boolean): BufferGeometry {
  const g = new RoundedBoxGeometry(1, DJ_KEY.h, 1, mobile ? 2 : 3, DJ_KEY.radius);
  g.translate(0, DJ_KEY.h / 2, 0);
  const out = partDj(g, 'rubber');
  const n = out.getAttribute('normal');
  setMask(out, (i) => 0.55 + 0.45 * smooth(0.55, 0.95, n.getY(i)));
  return out;
}

/**
 * Bouton rond unite (rayon 1, mis a l'echelle en x et z). 2026-10-05 (Mika :
 * "je trouve que les boutons CUE et PLAY font un peu trop jouets") : plus
 * le gros disque orange et le disque d'aluminium bombes, mais la facon d'un
 * lecteur de club : un capuchon de caoutchouc sombre, plat et bas, son nom
 * imprime petit, et autour, separe par une fente, un anneau fin qui
 * s'allume (masque 1 : orange pour CUE, jaune pour PLAY). capTone : la
 * teinte du capuchon.
 */
export function roundGeometry(mobile: boolean, capTone: DjTone = 'cap'): BufferGeometry {
  const seg = mobile ? 32 : 48;
  const R = DJ_ROUND;
  const ring = new LatheGeometry(
    [new Vector2(R.ringIn, 0), new Vector2(1.0, 0), new Vector2(1.0, R.ringH * 0.6), new Vector2(0.975, R.ringH), new Vector2(R.ringIn, R.ringH)],
    seg
  );
  const capPts = [new Vector2(R.cap, 0), new Vector2(R.cap, R.h - 0.03), new Vector2(R.cap - 0.02, R.h - 0.008), new Vector2(R.cap - 0.07, R.h), new Vector2(0, R.h)];
  const cap = new LatheGeometry(capPts, seg);
  const r = partDj(ring, 'slot');
  setMask(r, () => 1);
  const c = partDj(cap, capTone);
  setMask(c, () => 0);
  return merge([r, c], 'round keys');
}

/**
 * Les noms imprimes sur les boutons ronds : une texture, CUE a gauche (en
 * orange, petit et espace), le triangle et les deux barres de PLAY / PAUSE
 * a droite (en os) ; lisibles sur le caoutchouc sombre, en clair comme en
 * sombre.
 */
export function labelTexture(anisotropy: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  if (x) {
    x.clearRect(0, 0, 512, 256);
    x.fillStyle = DJ_LIGHT.orange;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `700 50px ${FONT_DISPLAY}`;
    // Espace entre les lettres (letterSpacing n'existe pas partout)
    const word = 'CUE';
    const track = 7;
    const widths = [...word].map((ch) => x.measureText(ch).width);
    let cx = 128 - (widths.reduce((a, w) => a + w, 0) + track * (word.length - 1)) / 2;
    x.textAlign = 'left';
    [...word].forEach((ch, i) => {
      x.fillText(ch, cx, 131);
      cx += widths[i] + track;
    });
    // PLAY / PAUSE : le triangle, puis deux barres
    x.fillStyle = '#ECE6DA';
    const cy = 128;
    x.beginPath();
    x.moveTo(338, cy - 26);
    x.lineTo(338, cy + 26);
    x.lineTo(374, cy);
    x.closePath();
    x.fill();
    x.fillRect(388, cy - 25, 9, 50);
    x.fillRect(405, cy - 25, 9, 50);
  }
  return makeCanvasTexture(c, anisotropy);
}

/** Le disque d'un nom grave, pose sur le dessus plat du capuchon ; half : 0 CUE, 1 PLAY. */
export function labelGeometry(mobile: boolean, half: 0 | 1): BufferGeometry {
  const g = new CircleGeometry(0.66, mobile ? 32 : 48);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i += 1) uv.setX(i, (uv.getX(i) + half) / 2);
  g.rotateX(-Math.PI / 2);
  g.translate(0, DJ_ROUND.h + 0.002, 0);
  return g;
}

/* ---------------- jogs ---------------- */

/**
 * La roue du jog (Mika, 2026-10-04 : "refais encore les jogs, les tirets
 * sont moches ; je veux quelque chose de sombre, tu vois les ronds enfonces
 * dans la couronne ?") : une couronne sombre percee d'une rangee de 18
 * alveoles rondes en creux (des coupelles : la lumiere y tombe en
 * degrade), un plateau lisse un cran plus bas, la bague d'aluminium de
 * l'ecran SYNC au centre, un trait os qui tourne avec elle. Pas de logo.
 */
function wheelGeometry(mobile: boolean): BufferGeometry {
  const J = DECK.jog;
  const seg = mobile ? 48 : 72;
  const R = J.platter;
  const H = J.platterH;
  const C = J.center;
  const edge = 0.035;
  const r0 = R * 0.52;
  const r1 = R - edge;
  // Dix-huit alveoles : a l'echelle d'un petit jog, assez grandes pour se lire de loin
  const N = 18;
  const rc = (r0 + r1) / 2;
  const rd = Math.min((r1 - r0) * 0.4, ((Math.PI * rc) / N) * 0.8);
  const depth = rd * 0.8;
  // La couronne : une grille polaire dont les sommets s'enfoncent dans chaque coupelle
  const aSeg = N * (mobile ? 8 : 12);
  const rSeg = mobile ? 10 : 16;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rSeg; j += 1) {
    const r = r0 + ((r1 - r0) * j) / rSeg;
    for (let i = 0; i <= aSeg; i += 1) {
      const a = (i / aSeg) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const ac = Math.round(a / ((Math.PI * 2) / N)) * ((Math.PI * 2) / N);
      const d = Math.hypot(x - Math.cos(ac) * rc, z - Math.sin(ac) * rc);
      const y = d < rd ? H - depth * Math.sqrt(1 - (d / rd) ** 2) : H;
      pos.push(x, y, z);
    }
  }
  const row = aSeg + 1;
  for (let j = 0; j < rSeg; j += 1) {
    for (let i = 0; i < aSeg; i += 1) {
      const p = j * row + i;
      // Vers le haut : l'angle croit de x vers z, l'ordre des sommets fait face au ciel
      idx.push(p, p + 1, p + row, p + 1, p + row + 1, p + row);
    }
  }
  const crown = new BufferGeometry();
  crown.setAttribute('position', new Float32BufferAttribute(pos, 3));
  crown.setIndex(idx);
  crown.computeVertexNormals();
  // Le bord : un biseau, puis le flanc lisse jusqu'au dessus de la platine
  const side = new LatheGeometry([new Vector2(R - 0.04, 0), new Vector2(R, 0.03), new Vector2(R, H - edge), new Vector2(r1, H)], seg);
  // Le plateau, un cran plus bas que la couronne, et la marche entre eux
  const step = 0.016;
  const plate = new LatheGeometry([new Vector2(C + 0.06, H - step), new Vector2(r0, H - step), new Vector2(r0, H)], seg);
  // La bague d'aluminium autour de l'ecran du centre (SYNC)
  const bezel = new LatheGeometry([new Vector2(C + 0.06, H - step), new Vector2(C + 0.05, H + 0.014), new Vector2(C + 0.005, H + 0.014), new Vector2(C, H + 0.006)], seg);
  // Le repere : un trait os sur le plateau, qui tourne avec la roue
  const mark = new BoxGeometry(0.04, 0.006, r0 - C - 0.12);
  mark.translate(0, H - step + 0.003, -(C + 0.06 + (r0 - C - 0.12) / 2));
  // Le fond des alveoles plus sombre que la couronne : elles se lisent meme vues de haut
  const ring = partDj(crown, 'cap');
  const cp = ring.getAttribute('position');
  const cc = ring.getAttribute('color');
  for (let i = 0; i < cp.count; i += 1) {
    const k = Math.min(1, ((H - cp.getY(i)) / depth) * 1.6);
    if (k <= 0) continue;
    const f = 1 - 0.78 * k;
    cc.setXYZ(i, cc.getX(i) * f, cc.getY(i) * f, cc.getZ(i) * f);
  }
  return merge([ring, partDj(side, 'cap'), partDj(plate, 'platter'), partDj(bezel, 'skirt'), partDj(mark, 'mark')], 'jog wheels');
}

/** Le socle fixe sous chaque roue : une jupe d'aluminium sombre, fine, comme celle des potards. */
function ringGeometry(mobile: boolean): BufferGeometry {
  const J = DECK.jog;
  const seg = mobile ? 48 : 72;
  const lathe = new LatheGeometry(
    [new Vector2(J.platter - 0.02, 0.05), new Vector2(J.ring - 0.03, 0.05), new Vector2(J.ring, 0.03), new Vector2(J.ring, 0)].reverse(),
    seg
  );
  const parts: BufferGeometry[] = [];
  for (const d of DJ_DECKS) {
    const c = jogCenter(d);
    const g = lathe.clone();
    g.translate(c.x, 0, c.z);
    parts.push(partDj(g, 'skirt'));
  }
  lathe.dispose();
  return merge(parts, 'jog rings');
}

/* ---------------- LED ---------------- */

export interface DjLedSpec {
  x: number;
  /** hauteur (repere top) : a plat sur le dessus, ou sur la bague du jog */
  y: number;
  z: number;
  w: number;
  d: number;
  /** angle autour de y (anneau du jog) */
  rot: number;
  /** couleur allumee */
  hex: string;
  /** couleur eteinte, si elle n'est pas celle de l'apparence (anneau du jog en clair) */
  off?: string;
}

/** Les segments : VU des voies (15 chacun), du master (deux colonnes), anneaux des jogs, zero des pitchs. */
function ledSpecs(light: boolean): { leds: DjLedSpec[]; vu: number[][]; master: number[][]; jog: Record<DjDeck, number[]>; zero: Record<DjDeck, number> } {
  const leds: DjLedSpec[] = [];
  const V = MIX.vu;
  const [lo, mid, top] = light ? DJ_LIGHT.vuLight : [DJ_LIGHT.yellow, DJ_LIGHT.orange, DJ_LIGHT.red];
  // La couleur suit la loi en dBFS (dj/math.ts VU_DB) : rouge a -1, orange de -6 a -2, jaune dessous
  const tone = (k: number): string => {
    const z = vuZone(VU_DB[Math.min(k, VU_DB.length - 1)]);
    return z === 'red' ? top : z === 'orange' ? mid : lo;
  };
  const column = (x: number, z0: number, z1: number): number[] => {
    const pitch = (z1 - z0) / V.n;
    const out: number[] = [];
    // Theme clair : une fente sombre continue sous la colonne (jamais allumee)
    if (light) leds.push({ x, y: 0.003, z: (z0 + z1) / 2, w: V.w + 0.08, d: z1 - z0 + 0.06, rot: 0, hex: DJ_LIGHT.offLight });
    for (let k = 0; k < V.n; k += 1) {
      out.push(leds.length);
      leds.push({ x, y: light ? 0.007 : 0.004, z: z1 - pitch * (k + 0.5), w: V.w, d: pitch * 0.68, rot: 0, hex: tone(k) });
    }
    return out;
  };
  const vu = MIX.cols.map((cx) => column(UNIT_X.mix + cx + V.dx, V.z0, V.z1));
  const M = MIX.masterVu;
  const master = [-1, 1].map((s) => column(UNIT_X.mix + MIX.masterX + s * M.dx, M.z0, M.z1));
  const jog: Record<DjDeck, number[]> = { a: [], b: [], c: [], d: [] };
  const zero: Record<DjDeck, number> = { a: -1, b: -1, c: -1, d: -1 };
  for (const d of DJ_DECKS) {
    // Plus d'anneau de LED autour du jog (Mika : "les tirets sont moches") ; la position est sur l'ecran SYNC
    zero[d] = leds.length;
    leds.push({ x: UNIT_X[d] + DECK.pitch.x - 0.34, y: 0.004, z: (DECK.pitch.z0 + DECK.pitch.z1) / 2, w: 0.12, d: 0.07, rot: 0, hex: DJ_LIGHT.yellow });
  }
  return { leds, vu, master, jog, zero };
}

/* ---------------- l'ensemble ---------------- */

export interface DjControlsOpts {
  mobile: boolean;
  castShadow: boolean;
  anisotropy: number;
}

/** FILTER porte le capuchon orange : un second InstancedMesh, un draw call de plus. */
const isHot = (i: number): boolean => {
  const t = DJ_KNOBS[i].target;
  return t.kind === 'eq' && t.eq === 'filter';
};
/** Chaque potard : son mesh (normal ou orange) et sa place dedans (pour les listes du moment). */
function knobSlots(): { hot: boolean; j: number }[] {
  let n = 0;
  let h = 0;
  return DJ_KNOBS.map((_, i) => (isHot(i) ? { hot: true, j: h++ } : { hot: false, j: n++ }));
}

export class DjControls {
  readonly knobs: InstancedMesh;
  readonly knobsHot: InstancedMesh;
  readonly caps: InstancedMesh;
  readonly keys: InstancedMesh;
  /** CUE (orange) et PLAY / PAUSE (aluminium), et leurs noms graves */
  readonly roundsCue: InstancedMesh;
  readonly roundsPlay: InstancedMesh;
  readonly labelsCue: InstancedMesh;
  readonly labelsPlay: InstancedMesh;
  private labelTex: CanvasTexture;
  /** chaque bouton rond : son mesh (CUE ou PLAY) et sa place dedans */
  private roundSlot: { play: boolean; j: number }[] = [];
  readonly platters: InstancedMesh;
  readonly rings: Mesh;
  readonly leds: InstancedMesh;
  readonly ledMap: ReturnType<typeof ledSpecs>;
  private knobAngle = new Float32Array(DJ_KNOBS.length);
  private faderAt = new Float32Array(DJ_FADERS.length);
  private keyY = new Float32Array(DJ_RECT_KEYS.length);
  private roundY = new Float32Array(DJ_ROUND_KEYS.length);
  private jogAngle: Record<DjDeck, number> = { a: 0, b: 0, c: 0, d: 0 };
  private knobSlot = knobSlots();
  private keyEm: InstancedBufferAttribute;
  private cueEm: InstancedBufferAttribute;
  private playEm: InstancedBufferAttribute;
  private ledOn: Float32Array;
  private ledOff = new Color();
  /** la couleur eteinte de chaque LED */
  private ledOffs: Color[] = [];
  private materials: (MeshStandardMaterial | MeshBasicMaterial)[] = [];

  constructor(opts: DjControlsOpts) {
    const light = APPEARANCE.current === 'light';
    const std = (name: string, p: { roughness: number; metalness: number }, emissive = false): MeshStandardMaterial => {
      const m = new MeshStandardMaterial({ vertexColors: true, ...p });
      m.name = name;
      this.materials.push(m);
      return emissive ? withInstanceEmissive(m, true) : m;
    };

    const knobMat = std('djKnob', { roughness: 0.42, metalness: 0.28 });
    const hotCount = this.knobSlot.filter((k) => k.hot).length;
    this.knobs = new InstancedMesh(knobGeometry(opts.mobile), knobMat, DJ_KNOBS.length - hotCount);
    this.knobs.name = 'djKnobs';
    this.knobsHot = new InstancedMesh(knobGeometry(opts.mobile, 'hot'), knobMat, hotCount);
    this.knobsHot.name = 'djKnobsHot';

    this.caps = new InstancedMesh(capGeometry(), std('djCap', { roughness: 0.75, metalness: 0 }), DJ_FADERS.length);
    this.caps.name = 'djCaps';

    const kg = keyGeometry(opts.mobile);
    this.keyEm = new InstancedBufferAttribute(new Float32Array(DJ_RECT_KEYS.length * 3), 3);
    this.keyEm.setUsage(DynamicDrawUsage);
    kg.setAttribute('instanceEmissive', this.keyEm);
    this.keys = new InstancedMesh(kg, std('djKey', { roughness: 0.9, metalness: 0 }, true), DJ_RECT_KEYS.length);
    this.keys.name = 'djKeys';

    let nc = 0;
    let np = 0;
    // PLAY des platines et PLAY/STOP des machines (mixer) : l'aluminium et son triangle
    this.roundSlot = DJ_ROUND_KEYS.map((k) => (k.target.kind === 'play' || k.target.kind === 'machines' ? { play: true, j: np++ } : { play: false, j: nc++ }));
    // CUE et PLAY (2026-10-05) : le meme caoutchouc sombre, leur anneau dit ce qu'ils sont (orange, jaune)
    const cg = roundGeometry(opts.mobile);
    this.cueEm = new InstancedBufferAttribute(new Float32Array(Math.max(1, nc) * 3), 3);
    this.cueEm.setUsage(DynamicDrawUsage);
    cg.setAttribute('instanceEmissive', this.cueEm);
    this.roundsCue = new InstancedMesh(cg, std('djRoundCue', { roughness: 0.78, metalness: 0 }, true), nc);
    this.roundsCue.name = 'djRoundsCue';
    const pg = roundGeometry(opts.mobile);
    this.playEm = new InstancedBufferAttribute(new Float32Array(Math.max(1, np) * 3), 3);
    this.playEm.setUsage(DynamicDrawUsage);
    pg.setAttribute('instanceEmissive', this.playEm);
    this.roundsPlay = new InstancedMesh(pg, std('djRoundPlay', { roughness: 0.78, metalness: 0 }, true), np);
    this.roundsPlay.name = 'djRoundsPlay';
    // Les noms graves : une encre mate posee sur le dessus plat
    this.labelTex = labelTexture(opts.anisotropy);
    const labelMat = new MeshStandardMaterial({
      map: this.labelTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      roughness: 0.6,
      metalness: 0,
    });
    labelMat.name = 'djRoundLabels';
    this.materials.push(labelMat);
    this.labelsCue = new InstancedMesh(labelGeometry(opts.mobile, 0), labelMat, nc);
    this.labelsCue.name = 'djLabelsCue';
    this.labelsPlay = new InstancedMesh(labelGeometry(opts.mobile, 1), labelMat, np);
    this.labelsPlay.name = 'djLabelsPlay';

    // Un peu de brillant : la lumiere coule dans les alveoles
    this.platters = new InstancedMesh(wheelGeometry(opts.mobile), std('djPlatter', { roughness: 0.5, metalness: 0.15 }), DJ_DECKS.length);
    this.platters.name = 'djPlatters';
    this.rings = new Mesh(ringGeometry(opts.mobile), std('djRing', { roughness: 0.35, metalness: light ? 0.2 : 0.5 }));
    this.rings.name = 'djRings';

    this.ledMap = ledSpecs(light);
    const lg = new PlaneGeometry(1, 1);
    lg.rotateX(-Math.PI / 2);
    const ledMat = new MeshBasicMaterial({ toneMapped: false });
    ledMat.name = 'djLeds';
    this.materials.push(ledMat);
    this.leds = new InstancedMesh(lg, ledMat, this.ledMap.leds.length);
    this.leds.name = 'djLeds';
    this.ledOff.set(light ? DJ_LIGHT.offLight : DJ_LIGHT.off);
    this.ledOffs = this.ledMap.leds.map((l) => (l.off ? new Color(l.off) : this.ledOff));
    this.ledOn = new Float32Array(this.ledMap.leds.length);

    for (const m of [this.knobs, this.knobsHot, this.caps, this.keys, this.roundsCue, this.roundsPlay, this.labelsCue, this.labelsPlay, this.platters]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.castShadow = opts.castShadow;
      m.receiveShadow = true;
    }
    // Les platines tournent : leur ombre ne change pas, elles n'en projettent pas (aucune passe d'ombre par frame)
    this.platters.castShadow = false;
    this.rings.castShadow = opts.castShadow;
    this.rings.receiveShadow = true;

    DJ_KNOBS.forEach((k, i) => {
      this.knobAngle[i] = potAngle(k.bipolar ? 0.5 : 0);
      this.placeKnob(i);
    });
    DJ_FADERS.forEach((f, i) => {
      this.faderAt[i] = faderPos(f, f.target.kind === 'channel' ? 0.8 : 0);
      this.placeCap(i);
    });
    DJ_RECT_KEYS.forEach((_, i) => this.placeKey(i));
    DJ_ROUND_KEYS.forEach((_, i) => this.placeRound(i));
    for (const d of DJ_DECKS) this.placePlatter(d);
    this.ledMap.leds.forEach((l, i) => {
      m4.compose(v3.set(l.x, l.y, l.z), q.setFromAxisAngle(AXIS_Y, l.rot), s3.set(l.w, 1, l.d));
      this.leds.setMatrixAt(i, m4);
      this.leds.setColorAt(i, this.ledOffs[i]);
    });
    this.leds.instanceMatrix.needsUpdate = true;
    if (this.leds.instanceColor) this.leds.instanceColor.setUsage(DynamicDrawUsage);
  }

  /** Les objets a poser dans le repere top. */
  get objects(): Object3D[] {
    return [this.knobs, this.knobsHot, this.caps, this.keys, this.roundsCue, this.roundsPlay, this.labelsCue, this.labelsPlay, this.platters, this.rings, this.leds];
  }

  /* ---------- placement ---------- */

  private placeKnob(i: number): void {
    const k = DJ_KNOBS[i];
    m4.compose(v3.set(k.x, 0, k.z), q.setFromAxisAngle(AXIS_Y, this.knobAngle[i]), s3.setScalar(k.s));
    const slot = this.knobSlot[i];
    const mesh = slot.hot ? this.knobsHot : this.knobs;
    mesh.setMatrixAt(slot.j, m4);
    mesh.instanceMatrix.needsUpdate = true;
  }

  private placeCap(i: number): void {
    const f = DJ_FADERS[i];
    const p = this.faderAt[i];
    if (f.across) m4.compose(v3.set(p, DJ_FADER.slot.h, f.z), q.setFromAxisAngle(AXIS_Y, Math.PI / 2), s3.set(1, 1, 1));
    else m4.compose(v3.set(f.x, DJ_FADER.slot.h, p), q0, s3.set(1, 1, 1));
    this.caps.setMatrixAt(i, m4);
    this.caps.instanceMatrix.needsUpdate = true;
  }

  private placeKey(i: number): void {
    const k = DJ_RECT_KEYS[i];
    this.keys.setMatrixAt(i, m4.compose(v3.set(k.x, this.keyY[i], k.z), q0, s3.set(k.w, 1, k.d)));
    this.keys.instanceMatrix.needsUpdate = true;
  }

  private placeRound(i: number): void {
    const k = DJ_ROUND_KEYS[i];
    const slot = this.roundSlot[i];
    m4.compose(v3.set(k.x, this.roundY[i], k.z), q0, s3.set(k.w / 2, 1, k.d / 2));
    const mesh = slot.play ? this.roundsPlay : this.roundsCue;
    const label = slot.play ? this.labelsPlay : this.labelsCue;
    mesh.setMatrixAt(slot.j, m4);
    label.setMatrixAt(slot.j, m4);
    mesh.instanceMatrix.needsUpdate = true;
    label.instanceMatrix.needsUpdate = true;
  }

  private placePlatter(d: DjDeck): void {
    const c = jogCenter(d);
    this.platters.setMatrixAt(DJ_DECKS.indexOf(d), m4.compose(v3.set(c.x, 0, c.z), q.setFromAxisAngle(AXIS_Y, this.jogAngle[d]), s3.set(1, 1, 1)));
    this.platters.instanceMatrix.needsUpdate = true;
  }

  /* ---------- etats ---------- */

  /** Valeur d'un potard (bipolaire : -1 a 1 ; sinon 0 a 1) ; true si l'angle change. */
  setKnob(i: number, v: number): boolean {
    const k = DJ_KNOBS[i];
    const a = Math.fround(potAngle(k.bipolar ? (v + 1) / 2 : v));
    if (this.knobAngle[i] === a) return false;
    this.knobAngle[i] = a;
    this.placeKnob(i);
    return true;
  }

  /** Valeur d'un fader ; true si le capuchon bouge. */
  setFader(i: number, v: number): boolean {
    const p = Math.fround(faderPos(DJ_FADERS[i], v));
    if (this.faderAt[i] === p) return false;
    this.faderAt[i] = p;
    this.placeCap(i);
    return true;
  }

  /** Angle de la platine d'un jog (rad, sens horaire vu de dessus quand il monte) ; true s'il change. */
  setJog(d: DjDeck, angle: number): boolean {
    if (!DJ_DECKS.includes(d)) return false;
    const a = Math.fround(-angle);
    if (this.jogAngle[d] === a) return false;
    this.jogAngle[d] = a;
    this.placePlatter(d);
    return true;
  }

  /** Lumiere d'une touche (lineaire) ; true si elle change. */
  setKeyGlow(i: number, rgb: readonly number[], round = false): boolean {
    let attr = this.keyEm;
    // L'anneau fin d'un bouton rond : une LED, plus vive qu'un dessus de touche
    const g = round ? DJ_ROUND.glow : 1;
    if (round) {
      const slot = this.roundSlot[i];
      attr = slot.play ? this.playEm : this.cueEm;
      i = slot.j;
    }
    const a = attr.array as Float32Array;
    const r = Math.fround(rgb[0] * g);
    const gg = Math.fround(rgb[1] * g);
    const b = Math.fround(rgb[2] * g);
    if (a[i * 3] === r && a[i * 3 + 1] === gg && a[i * 3 + 2] === b) return false;
    a[i * 3] = r;
    a[i * 3 + 1] = gg;
    a[i * 3 + 2] = b;
    attr.needsUpdate = true;
    return true;
  }

  /** Une touche enfoncee (0 a 1) ; true si elle bouge. */
  setKeyPress(i: number, v: number, round = false): boolean {
    const ys = round ? this.roundY : this.keyY;
    const y = Math.fround(-DJ_KEY.press * v);
    if (ys[i] === y) return false;
    ys[i] = y;
    if (round) this.placeRound(i);
    else this.placeKey(i);
    return true;
  }

  /** Allume une LED (0 a 1, sa couleur au prorata) ; true si elle change. */
  setLed(i: number, v: number): boolean {
    if (i < 0) return false;
    const k = Math.fround(Math.max(0, Math.min(1, v)));
    if (this.ledOn[i] === k) return false;
    this.ledOn[i] = k;
    col.set(this.ledMap.leds[i].hex).lerp(this.ledOffs[i], 1 - k);
    if (k === 0) col.copy(this.ledOffs[i]);
    this.leds.setColorAt(i, col);
    if (this.leds.instanceColor) this.leds.instanceColor.needsUpdate = true;
    return true;
  }

  /* ---------- picking ---------- */

  /** Les cibles du picking, dans le repere top. */
  hotspots(top: Object3D): HotspotDef[] {
    const out: HotspotDef[] = [];
    for (const k of DJ_KNOBS) {
      const r = DJ_KNOB.skirt.r * k.s + 0.04;
      out.push({ id: k.id, kind: 'djknob', layer: top, shape: 'disc', x: k.x, z: k.z, hx: r, hz: r, y0: 0, y1: (DJ_KNOB.skirt.h + DJ_KNOB.h) * k.s, enabled: true, dj: k.id });
    }
    for (const f of DJ_FADERS) out.push(faderHotspot(f, top));
    for (const k of [...DJ_RECT_KEYS, ...DJ_ROUND_KEYS]) out.push(keyHotspot(k, top));
    // SYNC, l'ecran rond au centre du jog : au-dessus de la platine, il passe avant le jog au picking
    for (const k of DJ_KEYS) if (k.screen) out.push({ ...keyHotspot(k, top), y1: DECK.jog.platterH + 0.06 });
    for (const d of DJ_DECKS) {
      const c = jogCenter(d);
      const r = DECK.jog.ring;
      out.push({ id: `dj-${d}-jog`, kind: 'djjog', layer: top, shape: 'disc', x: c.x, z: c.z, hx: r, hz: r, y0: 0, y1: DECK.jog.platterH, enabled: true, dj: `dj-${d}-jog` });
    }
    return out;
  }

  info() {
    return {
      knobs: DJ_KNOBS.length,
      faders: DJ_FADERS.length,
      keys: DJ_RECT_KEYS.length,
      rounds: DJ_ROUND_KEYS.length,
      leds: this.ledMap.leds.length,
      jog: Object.fromEntries(DJ_DECKS_ALL.map((d) => [d, +this.jogAngle[d].toFixed(3)])),
    };
  }

  dispose(): void {
    for (const m of [this.knobs, this.knobsHot, this.caps, this.keys, this.roundsCue, this.roundsPlay, this.labelsCue, this.labelsPlay, this.platters, this.leds]) {
      m.geometry.dispose();
      m.dispose();
    }
    this.labelTex.dispose();
    this.rings.geometry.dispose();
    for (const m of this.materials) m.dispose();
  }
}

/** La fente entiere d'un fader se prend (le capuchon glisse dessus). */
function faderHotspot(f: DjFaderSpec, top: Object3D): HotspotDef {
  const half = Math.abs(f.b - f.a) / 2 + DJ_FADER.cap.d / 2;
  const across = DJ_FADER.cap.w / 2 + 0.05;
  return {
    id: f.id,
    kind: 'djfader',
    layer: top,
    shape: 'box',
    x: f.x,
    z: f.z,
    hx: f.across ? half : across,
    hz: f.across ? across : half,
    y0: 0,
    y1: DJ_FADER.cap.h + DJ_FADER.slot.h,
    enabled: true,
    dj: f.id,
  };
}

function keyHotspot(k: DjKeySpec, top: Object3D): HotspotDef {
  return {
    id: k.id,
    kind: 'djkey',
    layer: top,
    shape: k.round ? 'disc' : 'box',
    x: k.x,
    z: k.z,
    hx: k.w / 2,
    hz: k.d / 2,
    y0: 0,
    y1: k.round ? DJ_ROUND.h : DJ_KEY.h,
    enabled: true,
    dj: k.id,
  };
}

/** Lumieres lineaires des touches (emissif) : eteinte, discrete, allumee. */
export const DJ_GLOW = {
  off: [0, 0, 0],
  dim: [0.012, 0.004, 0.0],
  orange: [0.42, 0.1, 0.0],
  yellow: [0.5, 0.36, 0.04],
} as const;
