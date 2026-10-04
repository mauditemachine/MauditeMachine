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
  type BufferGeometry,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HotspotDef } from '../scene/hit';
import { potAngle } from '../scene/encoders';
import { withInstanceEmissive } from '../scene/materials';
import { APPEARANCE } from '../theme';
import { partDj } from './body';
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

/** Potard ; capTone : la teinte du capuchon (FILTER : l'orange du pad OPEN du MM-RYTM). */
function knobGeometry(mobile: boolean, capTone: DjTone = 'knob'): BufferGeometry {
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
  return merge([partDj(skirt, 'skirt'), partDj(cap, capTone), partDj(mark, 'mark')], 'knobs');
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
function keyGeometry(mobile: boolean): BufferGeometry {
  const g = new RoundedBoxGeometry(1, DJ_KEY.h, 1, mobile ? 2 : 3, DJ_KEY.radius);
  g.translate(0, DJ_KEY.h / 2, 0);
  const out = partDj(g, 'rubber');
  const n = out.getAttribute('normal');
  setMask(out, (i) => 0.55 + 0.45 * smooth(0.55, 0.95, n.getY(i)));
  return out;
}

/**
 * Bouton rond unite (rayon 1, mis a l'echelle en x et z) : une bague
 * lumineuse a la base (masque 1) et le capuchon de caoutchouc au bord
 * arrondi (masque faible : la lumiere ne traverse pas le noir).
 */
function roundGeometry(mobile: boolean): BufferGeometry {
  const seg = mobile ? 32 : 48;
  const R = DJ_ROUND;
  const ring = new LatheGeometry(
    [new Vector2(0.84, 0), new Vector2(1.0, 0), new Vector2(1.0, R.ringH * 0.7), new Vector2(0.96, R.ringH), new Vector2(0.84, R.ringH)],
    seg
  );
  const capPts = [new Vector2(0.82, 0), new Vector2(0.82, R.h - 0.05), new Vector2(0.78, R.h - 0.01), new Vector2(0.7, R.h), new Vector2(0, R.h)];
  const cap = new LatheGeometry(capPts, seg);
  const r = partDj(ring, 'rubber');
  setMask(r, () => 1);
  const c = partDj(cap, 'rubber');
  setMask(c, () => 0.06);
  return merge([r, c], 'round keys');
}

/* ---------------- jogs ---------------- */

/**
 * La platine du jog (rayon DECK.jog.platter, sommet a platterH) : un dessus
 * a cercles concentriques (des anneaux de deux teintes) et un repere os au
 * bord, qui montre qu'elle tourne.
 */
function platterGeometry(mobile: boolean): BufferGeometry {
  const J = DECK.jog;
  const seg = mobile ? 48 : 72;
  const R = J.platter;
  const H = J.platterH;
  /*
   * Le flanc cannele comme les capuchons des potards Moog des machines MM
   * (2026-10-04, Mika : "un jog plus design, toujours dans le design des
   * autres machines") : la meme modulation du rayon, plus fine et plus
   * nombreuse a l'echelle d'une platine.
   */
  const flutes = mobile ? 48 : 72;
  const side = new LatheGeometry([new Vector2(R - 0.06, 0), new Vector2(R, 0.02), new Vector2(R, H - 0.06), new Vector2(R - 0.06, H)], flutes * 4);
  const sp = side.getAttribute('position');
  for (let i = 0; i < sp.count; i += 1) {
    const x = sp.getX(i);
    const z = sp.getZ(i);
    const r = Math.hypot(x, z);
    if (r < R - 0.001) continue;
    const k = 1 - (0.022 / r) * Math.max(0, Math.cos(Math.atan2(z, x) * flutes)) ** 2;
    sp.setX(i, x * k);
    sp.setZ(i, z * k);
  }
  side.computeVertexNormals();
  const parts: BufferGeometry[] = [partDj(side, 'platter')];
  // Le dessus : des anneaux (stries), du bord vers la bague du centre
  const C = J.center;
  const inner = C + 0.08;
  const band = 0.07;
  for (let k = 0; k < 24; k += 1) {
    const r1 = R - 0.06 - k * band;
    const r0 = r1 - band;
    if (r0 < inner) break;
    const g = new LatheGeometry([new Vector2(r0, H), new Vector2(r1, H)].reverse(), seg);
    parts.push(partDj(g, k % 2 === 0 ? 'groove' : 'platter'));
  }
  const top = new CylinderGeometry(inner, inner, 0.002, seg);
  top.translate(0, H - 0.001, 0);
  parts.push(partDj(top, 'platter'));
  // Une bague d'aluminium autour de l'ecran du centre (SYNC), la jupe des potards en grand
  const bezel = new LatheGeometry([new Vector2(C + 0.07, H), new Vector2(C + 0.055, H + 0.016), new Vector2(C + 0.005, H + 0.016), new Vector2(C, H + 0.006)], seg);
  parts.push(partDj(bezel, 'skirt'));
  const mark = new BoxGeometry(0.045, 0.006, 0.34);
  mark.translate(0, H + 0.003, -(R - 0.26));
  parts.push(partDj(mark, 'mark'));
  return merge(parts, 'platters');
}

/** La bague d'aluminium fixe, autour de la platine. */
function ringGeometry(mobile: boolean): BufferGeometry {
  const J = DECK.jog;
  const seg = mobile ? 48 : 72;
  const h = J.ringH;
  const lathe = new LatheGeometry(
    [new Vector2(J.ringIn, 0), new Vector2(J.ringIn, h), new Vector2(J.ring - 0.06, h), new Vector2(J.ring, h - 0.05), new Vector2(J.ring, 0)].reverse(),
    seg
  );
  const parts: BufferGeometry[] = [];
  for (const d of DJ_DECKS) {
    const c = jogCenter(d);
    const g = lathe.clone();
    g.translate(c.x, 0, c.z);
    parts.push(partDj(g, 'ring'));
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
}

/** Les segments : VU des voies (15 chacun), du master (deux colonnes), anneaux des jogs, zero des pitchs. */
function ledSpecs(light: boolean): { leds: DjLedSpec[]; vu: number[][]; master: number[][]; jog: Record<DjDeck, number[]>; zero: Record<DjDeck, number> } {
  const leds: DjLedSpec[] = [];
  const V = MIX.vu;
  const [lo, mid, top] = light ? DJ_LIGHT.vuLight : [DJ_LIGHT.yellow, DJ_LIGHT.orange, DJ_LIGHT.red];
  const tone = (k: number): string => (k >= V.n - 1 ? top : k >= V.n - 4 ? mid : lo);
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
    const c = jogCenter(d);
    const J = DECK.jog;
    for (let k = 0; k < J.leds; k += 1) {
      const a = (k / J.leds) * Math.PI * 2;
      jog[d].push(leds.length);
      // Le segment 0 en haut (vers l'arriere), dans le sens des aiguilles d'une montre vu de dessus
      leds.push({ x: c.x + Math.sin(a) * J.ledR, y: J.ringH + 0.003, z: c.z - Math.cos(a) * J.ledR, w: ((Math.PI * 2 * J.ledR) / J.leds) * 0.62, d: 0.07, rot: -a, hex: DJ_LIGHT.orange });
    }
    zero[d] = leds.length;
    leds.push({ x: UNIT_X[d] + DECK.pitch.x - 0.34, y: 0.004, z: (DECK.pitch.z0 + DECK.pitch.z1) / 2, w: 0.12, d: 0.07, rot: 0, hex: DJ_LIGHT.yellow });
  }
  return { leds, vu, master, jog, zero };
}

/* ---------------- l'ensemble ---------------- */

export interface DjControlsOpts {
  mobile: boolean;
  castShadow: boolean;
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
  readonly rounds: InstancedMesh;
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
  private roundEm: InstancedBufferAttribute;
  private ledOn: Float32Array;
  private ledOff = new Color();
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

    const rg = roundGeometry(opts.mobile);
    this.roundEm = new InstancedBufferAttribute(new Float32Array(DJ_ROUND_KEYS.length * 3), 3);
    this.roundEm.setUsage(DynamicDrawUsage);
    rg.setAttribute('instanceEmissive', this.roundEm);
    this.rounds = new InstancedMesh(rg, std('djRound', { roughness: 0.9, metalness: 0 }, true), DJ_ROUND_KEYS.length);
    this.rounds.name = 'djRounds';

    this.platters = new InstancedMesh(platterGeometry(opts.mobile), std('djPlatter', { roughness: 0.72, metalness: 0 }), DJ_DECKS.length);
    this.platters.name = 'djPlatters';
    this.rings = new Mesh(ringGeometry(opts.mobile), std('djRing', { roughness: 0.3, metalness: light ? 0.2 : 0.55 }));
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
    this.ledOn = new Float32Array(this.ledMap.leds.length);

    for (const m of [this.knobs, this.knobsHot, this.caps, this.keys, this.rounds, this.platters]) {
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
      this.leds.setColorAt(i, this.ledOff);
    });
    this.leds.instanceMatrix.needsUpdate = true;
    if (this.leds.instanceColor) this.leds.instanceColor.setUsage(DynamicDrawUsage);
  }

  /** Les objets a poser dans le repere top. */
  get objects(): Object3D[] {
    return [this.knobs, this.knobsHot, this.caps, this.keys, this.rounds, this.platters, this.rings, this.leds];
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
    this.rounds.setMatrixAt(i, m4.compose(v3.set(k.x, this.roundY[i], k.z), q0, s3.set(k.w / 2, 1, k.d / 2)));
    this.rounds.instanceMatrix.needsUpdate = true;
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
    const attr = round ? this.roundEm : this.keyEm;
    const a = attr.array as Float32Array;
    if (a[i * 3] === rgb[0] && a[i * 3 + 1] === rgb[1] && a[i * 3 + 2] === rgb[2]) return false;
    a[i * 3] = rgb[0];
    a[i * 3 + 1] = rgb[1];
    a[i * 3 + 2] = rgb[2];
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
    col.set(this.ledMap.leds[i].hex).lerp(this.ledOff, 1 - k);
    if (k === 0) col.copy(this.ledOff);
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
    for (const m of [this.knobs, this.knobsHot, this.caps, this.keys, this.rounds, this.platters, this.leds]) {
      m.geometry.dispose();
      m.dispose();
    }
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
