/**
 * Les encodeurs noirs a repere blanc (spec 20.3.7) : depuis le 2026-10-08 (la
 * refonte facon Digitakt), les huit potards de page A a H sous l'ecran
 * (theme.ts FACE_KNOBS ; les rangees GLOBAL FX et VOICE FX sont parties sur
 * les pages). Un potard de page tourne a la course de ce qu'il regle sur la
 * page affichee : son repere suit la page (setValue depuis le Stage), le
 * nombre qui compte est a l'ecran. UN InstancedMesh, une geometrie fusionnee
 * a couleurs de sommets : corps legerement conique (le haut plus etroit : un
 * chanfrein), repere bone sur le dessus, du centre vers l'arriere. L'angle
 * tourne autour de la normale du panneau (y du repere panneau) : 270 deg de
 * course centres sur le repere a midi, sens horaire quand la valeur monte
 * (section 19). Les animations n'existent pas : l'angle suit la valeur.
 *
 * Jupe (2026-10-03, Mika : "ce genre de stroke dans la 808") : a la place
 * de la collerette sombre, l'anneau d'aluminium biseaute des potards du
 * MM-VOYAGER (meme teinte, meme matiere un peu metallique), un second
 * InstancedMesh immobile (la jupe ne tourne pas).
 *
 * MASTER et TEMPO ont ete des potards d'aluminium au-dessus des voix du
 * 2026-10-09 au 2026-10-19 ; ils sont dessines dans l'ecran depuis (Mika :
 * "mets ces boutons dans l'ecran en mobile et en desktop, je voudrais qu'ils
 * soient mieux faits" ; scene/screen.ts, les zones lcd-master et lcd-tempo).
 * Il ne reste ici que les huit encodeurs, au telephone aussi depuis le meme
 * jour (deux rangees de quatre, theme.ts FACE_KNOBS) : leur zone y couvre toute
 * leur colonne, 44 px de haut (PAGE_KNOBS.hitW, hitD), le doigt.
 *
 * L'anneau de valeur (2026-10-27, la face V.4.0 du desktop, Mika : "la machine
 * aura des potards motorises qui suivent la valeur") : 27 segments a plat autour
 * de chaque capuchon (theme.ts KNOB_RING), un seul InstancedMesh de 216 segments
 * non eclaires (un draw call), leur couleur par instance : la fente eteinte,
 * l'orange des pas mis allume, le dernier en partie. setValue l'ecrit avec
 * l'angle : l'anneau suit la valeur comme le potard motorise la suivra. Le
 * telephone n'en a pas (opts.rings).
 *
 * Les potards suivent la page (2026-10-27, Mika : "les knobs de droite doivent se refleter") : au desktop le Stage pose
 * l'anneau (setRing : la course, a zero au centre ou non, la teinte, theme.ts RING_TONE) et le capuchon (setCap) de
 * chacun depuis rytm/faceKnobs.ts ; setValue reste celui du telephone (ses FX globaux).
 */

import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, DynamicDrawUsage, Float32BufferAttribute, InstancedMesh, LatheGeometry, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, RingGeometry, Vector2, Vector3, BufferGeometry, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLOR, DT_FACE, DT_HEX, ENCODER, FACE_KNOBS, GLOBAL_ENCODERS, HOVER_LIGHT, KNOB_RING, LIT, MATERIAL, PAGE_KNOBS, PORTRAIT, RING_BAND, RING_TONE, TEMPO_UI, gainOf, isBipolar, pageKnobIndex, ringLit, type FaceKnobId, type KnobTone } from '../theme';
import type { HotspotDef } from './hit';
import { albedoRgb, paintLinear, paintSolid } from './materials';
import { IN_PLUGIN } from '../pluginMode';

const DEG = Math.PI / 180;
const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
const tint = new Color();

/**
 * Angle d'un encodeur pour une course t de 0 a 1 : 270 deg centres sur le
 * repere a 0, +135 (sept heures et demie) au minimum, -135 (quatre heures
 * et demie) au maximum : sens horaire quand la valeur monte (section 19).
 */
export function potAngle(t: number): number {
  const c = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  return (TEMPO_UI.sweepDeg / 2 - TEMPO_UI.sweepDeg * c) * DEG;
}

/** Une geometrie non indexee, sans uv (les couleurs de sommets la peignent). */
function flat(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone();
  g.dispose();
  out.deleteAttribute('uv');
  return out;
}

/**
 * Les cotes d'un capuchon (theme.ts ENCODER ; V.6.0, la face DT2 : celles de MAIN VOLUME et LEVEL/DATA aussi,
 * scene/sideKnobs.ts) : son corps, son chanfrein, ses cannelures, son repere (null : sans repere, un encodeur sans fin),
 * sa jupe.
 */
export interface EncoderDims {
  r: number;
  rTop: number;
  h: number;
  chamfer: number;
  chamferGain: number;
  flutes: number;
  fluteDepth: number;
  segments: { desktop: number; mobile: number };
  mark: { w: number; h: number; d: number } | null;
  skirt: { r: number; rTop: number; h: number };
}
/** Les cotes d'un anneau de valeur (theme.ts KNOB_RING) : ses rayons, ses segments, l'air entre eux, sa hauteur. */
export interface RingDims {
  r0: number;
  r1: number;
  segments: number;
  airDeg: number;
  y: number;
}

/**
 * Le corps (2026-10-22) : le flanc cannele (un tour, ses creux en cos^2 comme le MM-ARP, voyager/knobs.ts), le chanfrein
 * du haut et le dessus plat, trois tours a part : chacun ses normales, les aretes restent nettes.
 */
function bodyParts(seg: number, E: EncoderDims = ENCODER): BufferGeometry[] {
  const c = E.chamfer;
  const wall = new LatheGeometry([new Vector2(E.r, 0), new Vector2(E.rTop, E.h - c)], seg);
  const p = wall.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const k = 1 - (E.fluteDepth / r) * Math.max(0, Math.cos(Math.atan2(z, x) * E.flutes)) ** 2;
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  wall.computeVertexNormals();
  const chamfer = new LatheGeometry([new Vector2(E.rTop, E.h - c), new Vector2(E.rTop - c, E.h)], seg);
  const top = new CircleGeometry(E.rTop - c, seg);
  top.rotateX(-Math.PI / 2);
  top.translate(0, E.h, 0);
  return [wall, chamfer, top];
}

/* ---------------- le potard du plugin, facon Moog (2026-11-11) ---------------- */

/**
 * Mika, une photo d'un potard a jupe cannelee et capuchon de metal brosse : "pourrais-tu mettre ce type de knob, mais le
 * dessus, au lieu de chrome, mets chrome fonce, plus noir ; mets ca sur tous les knobs". Dans le plugin, chaque potard de la
 * face (A a H, MAIN VOLUME, LEVEL/DATA) prend cette forme, vue de dessus :
 * - une jupe noire large a douze cannelures (des gorges etroites entre des lobes ronds), son epaule qui remonte vers le
 *   capuchon, et le repere blanc pose sur l'epaule, du capuchon au bord : elle tourne avec la valeur ;
 * - un capuchon de metal au centre, plus haut ; son dessus est a part et ne tourne pas (encoderSkirtGeometry, le maillage
 *   immobile) : le reflet d'un metal brosse reste face a la lumiere quand on tourne le potard. Il est peint en chrome
 *   fonce : deux lobes clairs opposes (en haut a gauche, en bas a droite) sur un fond presque noir.
 * Le site garde ses capuchons (IN_PLUGIN).
 */
const MOOG = { lobes: 14, depth: 0.075, cap: 0.58, base: 0.44, shoulder: 0.6, groove: 3 } as const;
interface MoogDims {
  /** le rayon de la jupe, celui du capuchon */
  R: number;
  rc: number;
  /** le haut du flanc de la jupe, le pied du capuchon, son dessus, son chanfrein */
  hb: number;
  hs: number;
  hc: number;
  c: number;
  seg: number;
}
function moogDims(mobile: boolean, E: EncoderDims): MoogDims {
  const R = Math.max(E.r, E.skirt.r);
  return { R, rc: R * MOOG.cap, hb: E.h * MOOG.base, hs: E.h * MOOG.shoulder, hc: E.h, c: E.chamfer * 0.55, seg: Math.max(MOOG.lobes * (mobile ? 6 : 10), mobile ? E.segments.mobile : E.segments.desktop) };
}
/** Les cannelures : la part de rayon que garde un point a l'angle a, a la distance r de l'axe (rien au capuchon, tout au bord). */
function fluteAt(a: number, r: number, D: MoogDims): number {
  const out = Math.max(0, Math.min(1, (r - D.rc) / (D.R - D.rc)));
  return 1 - MOOG.depth * out * Math.pow(0.5 + 0.5 * Math.cos(a * MOOG.lobes), MOOG.groove);
}
function flute(g: BufferGeometry, D: MoogDims): void {
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const k = fluteAt(Math.atan2(z, x), r, D);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  g.computeVertexNormals();
}
/** La jupe cannelee, l'epaule, le flanc du capuchon, son chanfrein, le repere : ce qui tourne. */
function moogGeometry(mobile: boolean, E: EncoderDims): BufferGeometry {
  const D = moogDims(mobile, E);
  const wall = new LatheGeometry([new Vector2(D.R, 0), new Vector2(D.R, D.hb)], D.seg);
  flute(wall, D);
  // L'epaule : du bord cannele au pied du capuchon, en trois pas (les cannelures s'y effacent)
  const sh = [0, 0.34, 0.67, 1].map((t) => new Vector2(D.R + (D.rc * 1.02 - D.R) * t, D.hb + (D.hs - D.hb) * t));
  const shoulder = new LatheGeometry(sh, D.seg);
  flute(shoulder, D);
  const capWall = new LatheGeometry([new Vector2(D.rc, D.hs), new Vector2(D.rc, D.hc - D.c)], D.seg);
  const chamfer = new LatheGeometry([new Vector2(D.rc, D.hc - D.c), new Vector2(D.rc - D.c, D.hc)], D.seg);
  const parts: BufferGeometry[] = [wall, shoulder, capWall, chamfer];
  const mk = E.mark;
  if (mk) {
    // Le repere blanc sur l'epaule, du capuchon au bord (vers l'arriere, -z : midi), couche sur sa pente
    const r0 = D.rc * 1.06;
    const r1 = D.R * (1 - MOOG.depth * 0.4);
    const len = Math.hypot(r1 - r0, D.hs - D.hb);
    const mark = new BoxGeometry(mk.w * 0.85, mk.h, len);
    mark.rotateX(-Math.atan2(D.hs - D.hb, D.R - D.rc));
    mark.translate(0, (D.hb + D.hs) / 2 + mk.h * 0.9, -(r0 + r1) / 2);
    parts.push(mark);
  }
  const flatParts = parts.map(flat);
  const body = albedoRgb('encoder', gainOf('encoder'));
  paintSolid(flatParts[0], 'encoder');
  paintLinear(flatParts[1], body.map((v) => v * 1.35));
  // Le flanc du capuchon : le metal dans l'ombre ; son chanfrein accroche la lumiere
  paintLinear(flatParts[2], body.map((v) => v * 2.4));
  paintLinear(flatParts[3], body.map((v) => v * 16));
  if (flatParts[4]) paintLinear(flatParts[4], LIT.mark);
  const g = mergeGeometries(flatParts, false);
  for (const q of flatParts) q.dispose();
  if (!g) throw new Error('encoders: merge failed');
  return g;
}
/**
 * Le dessus du capuchon, immobile : un disque de metal brosse en chrome fonce. Sa teinte suit l'angle (deux lobes clairs
 * opposes, deux plus faibles en travers), des anneaux le foncent vers le bord : le reflet d'un tournage fin.
 */
function moogTopGeometry(mobile: boolean, E: EncoderDims): BufferGeometry {
  const D = moogDims(mobile, E);
  const r = D.rc - D.c;
  const g = new RingGeometry(0, r, mobile ? 48 : 96, 6);
  g.rotateX(-Math.PI / 2);
  g.translate(0, D.hc, 0);
  const out = flat(g);
  const body = albedoRgb('encoder', gainOf('encoder'));
  const p = out.getAttribute('position');
  const col = new Float32Array(p.count * 3);
  // Les lobes clairs : en haut a gauche et en bas a droite de la face (x a droite, z vers soi)
  const a0 = (-135 * Math.PI) / 180;
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const rr = Math.hypot(x, z) / r;
    const a = Math.atan2(z, x) - a0;
    const lobe = Math.pow(Math.abs(Math.cos(a)), 5);
    const cross = Math.pow(Math.abs(Math.sin(a)), 8);
    // Au centre les lobes se rejoignent (un gris moyen), au bord le disque fonce un peu
    const k = 1.1 + (lobe * 34 + cross * 7) * Math.min(1, rr * 1.5) + 9 * Math.max(0, 1 - rr * 1.5);
    const v = k * (1 - 0.25 * rr * rr);
    col[i * 3] = body[0] * v;
    col[i * 3 + 1] = body[1] * v;
    col[i * 3 + 2] = body[2] * v * 1.04;
  }
  out.setAttribute('color', new Float32BufferAttribute(col, 3));
  return out;
}

/** Le capuchon (le corps, son chanfrein, son dessus, son repere s'il en a un) : une geometrie fusionnee a couleurs de sommets. */
export function encoderGeometry(mobile: boolean, E: EncoderDims = ENCODER): BufferGeometry {
  if (IN_PLUGIN) return moogGeometry(mobile, E);
  const seg = mobile ? E.segments.mobile : E.segments.desktop;
  const mk = E.mark;
  const mark = mk ? new BoxGeometry(mk.w, mk.h, mk.d) : null;
  // Du centre vers l'arriere (-z), pose sur le dessus
  if (mark && mk) mark.translate(0, E.h + mk.h / 2 - 0.002, -mk.d / 2);
  const parts = [...bodyParts(seg, E), ...(mark ? [mark] : [])].map(flat);
  paintSolid(parts[0], 'encoder');
  paintSolid(parts[1], 'encoder', gainOf('encoder') * E.chamferGain);
  paintSolid(parts[2], 'encoder');
  if (parts[3]) paintLinear(parts[3], LIT.mark);
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error('encoders: merge failed');
  return g;
}

/** La jupe d'aluminium : un disque biseaute a la base de l'encodeur. */
export function encoderSkirtGeometry(mobile: boolean, E: EncoderDims = ENCODER): BufferGeometry {
  // Le plugin : le maillage immobile porte le dessus du capuchon (son reflet ne tourne pas), plus de collerette
  if (IN_PLUGIN) return moogTopGeometry(mobile, E);
  const C = E.skirt;
  const g = new CylinderGeometry(C.rTop, C.r, C.h, mobile ? E.segments.mobile + 12 : E.segments.desktop + 16);
  g.translate(0, C.h / 2, 0);
  const out = flat(g);
  paintSolid(out, 'voySkirt');
  return out;
}

/** Un segment de l'anneau (2026-10-27) : un secteur a plat, son milieu vers l'arriere (-z, midi : le repere a mi-course). */
export function ringSegmentGeometry(R: RingDims = KNOB_RING): BufferGeometry {
  const a = ((TEMPO_UI.sweepDeg / R.segments - R.airDeg) * Math.PI) / 180;
  const g = new RingGeometry(R.r0, R.r1, 4, 1, Math.PI / 2 - a / 2, a);
  // (cos t, sin t, 0) -> (cos t, 0, -sin t) : a plat, face vers le haut
  g.rotateX(-Math.PI / 2);
  g.translate(0, R.y, 0);
  g.deleteAttribute('uv');
  return g;
}

// La part allumee d'un segment (ringLit) vit dans theme.ts depuis le 2026-10-27 : la machine sans WebGL
// (fallback/StaticMachine.tsx) dessine les memes anneaux sans three ; re-exportee ici pour les lecteurs d'avant
export { ringLit };

export interface EncodersInfo {
  ids: FaceKnobId[];
  /** angles en degres */
  angleDeg: number[];
  /** course 0 a 1 */
  values: number[];
  /** l'anneau de valeur (2026-10-27) : la somme des parts allumees de ses 27 segments, par potard ; [] sans anneaux */
  ring: number[];
  /** la teinte de chaque anneau (2026-10-27, les potards suivent la page) */
  tones: (KnobTone | null)[];
  /** la bande du crossfader de chaque anneau (lo, hi), null sans bande (2026-10-27, P2-20) */
  bands: ([number, number] | null)[];
  /** les potards eclaires par le survol (un potard, ou ceux d'un bloc de l'ecran survole) */
  hover: number[];
}

export class Encoders {
  /** les huit encodeurs (au telephone aussi depuis le 2026-10-19) */
  readonly mesh: InstancedMesh;
  /** leurs jupes d'aluminium (immobiles) */
  readonly skirts: InstancedMesh;
  private material: MeshStandardMaterial;
  private skirtMat: MeshStandardMaterial;
  private angle = new Float32Array(FACE_KNOBS.length);
  private value = new Float32Array(FACE_KNOBS.length);
  /** les encodeurs eclaires par le survol (2026-10-22, HOVER_LIGHT ; un masque depuis le 2026-10-27 : un bloc de l'ecran survole eclaire tous ses potards) */
  private hoverMask = 0;
  /** les anneaux de valeur (2026-10-27, la face V.4.0 du desktop) ; null au telephone */
  readonly rings: InstancedMesh | null = null;
  private ringMat: MeshBasicMaterial | null = null;
  /** la course que montre chaque anneau (NaN : pas encore peint) et la part allumee de chaque segment */
  private ringT = new Float32Array(FACE_KNOBS.length).fill(Number.NaN);
  private ringPart = new Float32Array(FACE_KNOBS.length * KNOB_RING.segments);
  private ringOff = new Color();
  private ringOn = new Color();
  /** la teinte et la loi (a zero au centre) que montre chaque anneau */
  private ringTone: (KnobTone | null)[] = new Array(FACE_KNOBS.length).fill(null);
  private ringBip = new Uint8Array(FACE_KNOBS.length);
  /** la bande du crossfader de chaque anneau (2026-10-27, P2-20) : ses deux bouts tries, NaN sans bande */
  private bandLo = new Float32Array(FACE_KNOBS.length).fill(Number.NaN);
  private bandHi = new Float32Array(FACE_KNOBS.length).fill(Number.NaN);
  /** V.5.0 : le segment luit de la bande (le bleu des scenes), pas de la course */
  private ringBand = new Uint8Array(FACE_KNOBS.length * KNOB_RING.segments);
  private toneColor = new Map<string, Color>();

  constructor(opts: { mobile: boolean; castShadow: boolean; rings?: boolean }) {
    const n = FACE_KNOBS.length;
    this.material = new MeshStandardMaterial({ vertexColors: true, ...MATERIAL.encoder });
    this.material.name = 'encoder';
    this.mesh = new InstancedMesh(encoderGeometry(opts.mobile), this.material, n);
    this.mesh.name = 'encoders';
    this.mesh.castShadow = opts.castShadow;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    // La jupe : la matiere de celle du MM-VOYAGER (voyager/knobs.ts)
    this.skirtMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.28 });
    this.skirtMat.name = 'encoderSkirt';
    this.skirts = new InstancedMesh(encoderSkirtGeometry(opts.mobile), this.skirtMat, n);
    this.skirts.name = 'encoderSkirts';
    this.skirts.receiveShadow = true;
    for (let i = 0; i < n; i += 1) {
      const p = FACE_KNOBS[i];
      this.skirts.setMatrixAt(i, m4.compose(pos.set(p.x, 0, p.z), quat.identity(), scl.setScalar(p.s)));
      this.place(i);
    }
    this.skirts.instanceMatrix.needsUpdate = true;
    // Une couleur par instance (le survol, 2026-10-22) : blanche, la teinte des sommets
    for (let i = 0; i < n; i += 1) {
      this.mesh.setColorAt(i, tint.setScalar(1));
      this.skirts.setColorAt(i, tint.setScalar(1));
    }
    this.mesh.instanceColor?.setUsage(DynamicDrawUsage);
    this.skirts.instanceColor?.setUsage(DynamicDrawUsage);
    if (opts.rings) {
      // Les anneaux (2026-10-27) : la fente eteinte (line), l'orange des pas mis (ledSet) ; non eclaires, comme les temoins
      const S = KNOB_RING.segments;
      this.ringOff.setHex(COLOR.line);
      // V.5.0 (la face facon Digitakt, le desktop) : la course en blanc (l'encre sombre sur la machine creme), plus l'orange
      if (DT_FACE) this.ringOn.set(DT_HEX.white);
      else this.ringOn.setHex(COLOR.ledSet);
      this.ringMat = new MeshBasicMaterial({ toneMapped: false });
      this.ringMat.name = 'knobRing';
      const rings = new InstancedMesh(ringSegmentGeometry(), this.ringMat, n * S);
      rings.name = 'knobRings';
      rings.receiveShadow = false;
      for (let i = 0; i < n; i += 1) {
        const p = FACE_KNOBS[i];
        for (let j = 0; j < S; j += 1) {
          quat.setFromAxisAngle(AXIS_Y, potAngle((j + 0.5) / S));
          rings.setMatrixAt(i * S + j, m4.compose(pos.set(p.x, 0, p.z), quat, scl.setScalar(1)));
          rings.setColorAt(i * S + j, tint.copy(this.ringOff));
        }
      }
      rings.instanceMatrix.needsUpdate = true;
      rings.instanceColor?.setUsage(DynamicDrawUsage);
      this.rings = rings;
    }
  }

  /** La couleur allumee d'une teinte (theme.ts RING_TONE, relue a chaque fois : l'apparence peut changer). */
  private onColor(tone: KnobTone): Color {
    return this.hexColor(RING_TONE[tone].on);
  }
  private hexColor(hex: string): Color {
    let c = this.toneColor.get(hex);
    if (!c) {
      c = new Color(hex);
      this.toneColor.set(hex, c);
    }
    return c;
  }

  /**
   * L'anneau du potard i a la course t, a zero au centre ou non, d'une teinte : ses 27 segments ; true s'il a change. La
   * bande du crossfader (P2-20, lo a hi, NaN sans bande) : les segments eteints entre les courses de A et de B luisent a
   * KNOB_RING.band de la teinte.
   */
  private paintRing(i: number, t: number, bip: boolean, tone: KnobTone, lo = Number.NaN, hi = Number.NaN): boolean {
    const r = this.rings;
    const same = (a: number, b: number): boolean => (Number.isNaN(a) ? Number.isNaN(b) : a === Math.fround(b));
    if (!r || (this.ringT[i] === Math.fround(t) && this.ringBip[i] === (bip ? 1 : 0) && this.ringTone[i] === tone && same(this.bandLo[i], lo) && same(this.bandHi[i], hi))) return false;
    const toneChanged = this.ringTone[i] !== tone;
    this.ringT[i] = t;
    this.ringBip[i] = bip ? 1 : 0;
    this.ringTone[i] = tone;
    this.bandLo[i] = lo;
    this.bandHi[i] = hi;
    const S = KNOB_RING.segments;
    const on = tone === 'base' ? this.ringOn : this.onColor(tone);
    const level = RING_TONE[tone].k;
    const glow = KNOB_RING.band * level;
    const banded = !Number.isNaN(lo);
    let changed = false;
    for (let j = 0; j < S; j += 1) {
      const c = (j + 0.5) / S;
      const lit = ringLit(j, t, bip) * level;
      const inBand = banded && c >= lo - 0.5 / S && c <= hi + 0.5 / S;
      const f = inBand ? Math.max(lit, glow) : lit;
      // V.5.0 au desktop : la bande du crossfader luit en bleu (RING_BAND), la course garde sa teinte
      const band = DT_FACE && inBand && glow > lit ? 1 : 0;
      const k = i * S + j;
      if (!toneChanged && Math.abs(this.ringPart[k] - f) < 1e-4 && this.ringBand[k] === band) continue;
      this.ringPart[k] = f;
      this.ringBand[k] = band;
      r.setColorAt(k, tint.copy(this.ringOff).lerp(band ? this.hexColor(RING_BAND.on) : on, f));
      changed = true;
    }
    if (changed && r.instanceColor) r.instanceColor.needsUpdate = true;
    return changed;
  }

  /** L'anneau du potard i (2026-10-27, la vue de rytm/faceKnobs.ts) : la course, a zero au centre, la teinte, la bande du crossfader ; true s'il faut une frame. */
  setRing(i: number, o: { t: number; bipolar: boolean; tone: KnobTone; band?: readonly [number, number] | null }): boolean {
    if (i < 0 || i >= FACE_KNOBS.length) return false;
    const b = o.band;
    return b ? this.paintRing(i, o.t, o.bipolar, o.tone, Math.min(b[0], b[1]), Math.max(b[0], b[1])) : this.paintRing(i, o.t, o.bipolar, o.tone);
  }

  /** Le capuchon du potard i a la course t (2026-10-27 : le moteur du potard motorise) ; true s'il faut une frame. */
  setCap(i: number, t: number): boolean {
    if (i < 0 || i >= FACE_KNOBS.length) return false;
    const a = potAngle(t);
    this.value[i] = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
    if (this.angle[i] === Math.fround(a)) return false;
    this.angle[i] = a;
    this.place(i);
    return true;
  }

  /** La course que montre le capuchon i. */
  capT(i: number): number {
    return this.value[i] ?? 0;
  }

  /**
   * L'encodeur k sous la souris (-1 aucun), ou depuis le 2026-10-27 plusieurs (le bloc de l'ecran survole eclaire ses
   * potards) : un peu plus clair, sa jupe aussi ; true s'il faut une frame.
   */
  setHover(k: number | readonly number[]): boolean {
    let mask = 0;
    for (const i of typeof k === 'number' ? [k] : k) if (i >= 0 && i < FACE_KNOBS.length) mask |= 1 << i;
    if (mask === this.hoverMask) return false;
    for (let i = 0; i < FACE_KNOBS.length; i += 1) {
      const was = (this.hoverMask >> i) & 1;
      const on = (mask >> i) & 1;
      if (was === on) continue;
      this.mesh.setColorAt(i, tint.setScalar(on ? HOVER_LIGHT.knob : 1));
      this.skirts.setColorAt(i, tint.setScalar(on ? HOVER_LIGHT.skirt : 1));
    }
    this.hoverMask = mask;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (this.skirts.instanceColor) this.skirts.instanceColor.needsUpdate = true;
    return true;
  }

  /** Les maillages a poser sur le plateau. */
  objects(): Object3D[] {
    return this.rings ? [this.mesh, this.skirts, this.rings] : [this.mesh, this.skirts];
  }

  private index(id: FaceKnobId): number {
    for (let i = 0; i < FACE_KNOBS.length; i += 1) if (FACE_KNOBS[i].id === id) return i;
    return -1;
  }

  private place(i: number): void {
    quat.setFromAxisAngle(AXIS_Y, this.angle[i]);
    const p = FACE_KNOBS[i];
    this.mesh.setMatrixAt(i, m4.compose(pos.set(p.x, 0, p.z), quat, scl.setScalar(p.s)));
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Course t (0 a 1) -> angle ; true s'il faut une frame. */
  setValue(id: FaceKnobId, t: number): boolean {
    const i = this.index(id);
    if (i < 0) return false;
    const a = potAngle(t);
    // La valeur d'abord : TONE et STRETCH au centre ont deja leur angle de depart
    this.value[i] = t;
    // L'anneau suit la valeur (2026-10-27), meme quand l'angle n'a pas bouge (le premier dessin)
    const id0 = GLOBAL_ENCODERS[i];
    const ring = this.paintRing(i, t, id0 !== undefined && isBipolar(id0), 'base');
    if (this.angle[i] === Math.fround(a)) return ring;
    this.angle[i] = a;
    this.place(i);
    return true;
  }

  /**
   * L'encodeur pour le picking (penc-0 a penc-7, kind penc, son rang dans
   * index) : au desktop un cylindre de son rayon, a son echelle ; au telephone
   * (2026-10-19) une zone a plat sur toute sa colonne, 44 px de haut, du dessus
   * de son nom au bas de la rangee (PAGE_KNOBS.hitW, hitD, hitUp).
   */
  hotspot(id: FaceKnobId, layer: Object3D): HotspotDef {
    const i = this.index(id);
    if (i < 0) throw new Error(`encoders: unknown ${id}`);
    const p = FACE_KNOBS[i];
    const k = pageKnobIndex(id);
    if (PORTRAIT) {
      const K = PAGE_KNOBS;
      return { id: `penc-${k}`, kind: 'penc', layer, shape: 'box', x: p.x, z: p.z - K.hitUp + K.hitD / 2, hx: K.hitW / 2, hz: K.hitD / 2, y0: 0, y1: 0.02, enabled: true, index: k };
    }
    // La face V.4.0 du desktop (2026-10-27) : le disque du potard et de son anneau (PAGE_KNOBS.hitR, 28 mm)
    const r = PAGE_KNOBS.hitR > 0 ? PAGE_KNOBS.hitR : ENCODER.r * p.s;
    return { id: `penc-${k}`, kind: 'penc', layer, shape: 'disc', x: p.x, z: p.z, hx: r, hz: r, y0: 0, y1: ENCODER.h * p.s, enabled: true, index: k };
  }

  info(): EncodersInfo {
    return {
      ids: FACE_KNOBS.map((e) => e.id),
      angleDeg: Array.from(this.angle, (a) => +(a / DEG).toFixed(2)),
      values: Array.from(this.value, (v) => +v.toFixed(4)),
      ring: this.rings
        ? FACE_KNOBS.map((_, i) => {
            let sum = 0;
            for (let j = 0; j < KNOB_RING.segments; j += 1) sum += this.ringPart[i * KNOB_RING.segments + j];
            return Math.round(sum * 100) / 100;
          })
        : [],
      tones: [...this.ringTone],
      bands: FACE_KNOBS.map((_, i) => (Number.isNaN(this.bandLo[i]) ? null : [+this.bandLo[i].toFixed(4), +this.bandHi[i].toFixed(4)])),
      hover: FACE_KNOBS.map((_, i) => i).filter((i) => (this.hoverMask >> i) & 1),
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
    this.skirts.geometry.dispose();
    this.skirtMat.dispose();
    this.skirts.dispose();
    if (this.rings) {
      this.rings.geometry.dispose();
      this.rings.dispose();
    }
    this.ringMat?.dispose();
  }
}
