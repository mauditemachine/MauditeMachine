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

/* ---------------- le potard du plugin, d'apres la photo de Mika (2026-11-11) ---------------- */

/**
 * Mika, une photo d'un potard : "pourrais-tu mettre ce type de knob, mais le dessus, au lieu de chrome, mets chrome fonce,
 * plus noir ; mets ca sur tous les knobs". Puis, devant un premier essai (quatorze petites cannelures, un petit capuchon
 * terne, un repere fin) : "ca ne va pas du tout, pourquoi tu peux pas faire comme ce que je t'ai envoye ?". La photo,
 * mesuree : de dehors en dedans,
 * - une base ronde et lisse, gris sombre, plus claire en haut a gauche (la lumiere) qu'en bas a droite : rayon 1 ;
 * - une prise noire a six lobes larges, des encoches courtes entre eux : 0.85 aux lobes, 0.74 aux encoches ;
 * - un grand capuchon de metal brosse : 0.63 ; deux reflets francs opposes (10 h 30, large ; 4 h 30, etroit), le plus
 *   sombre a 7 h 30, des stries fines ;
 * - un repere blanc epais, du bord du capuchon presque au bord de la base (0.95), large de 0.13.
 * Ici le meme, le metal en chrome fonce (les memes reflets sur un fond presque noir). Deux maillages : ce qui tourne (la
 * prise, le repere, le flanc du capuchon : moogGeometry) et ce qui ne tourne pas (la base et le dessus du capuchon, dont
 * l'eclairage reste face a la lumiere : moogTopGeometry, le maillage immobile de l'ancienne collerette). Les faces peintes
 * sont a plat (vues de dessus) : la lumiere de la scene les multiplie toutes pareil, le dessin reste celui-ci.
 * Le site garde ses capuchons (IN_PLUGIN).
 */
const MOOG = { lobes: 6, lobe: 0.85, notch: 0.74, cap: 0.63, base: 1.1, markEnd: 0.95, markW: 0.13, hBase: 0.22, hGrip: 0.6 } as const;
interface MoogDims {
  /** le rayon de la base, celui du capuchon */
  R: number;
  rc: number;
  /** le dessus de la base, celui de la prise, celui du capuchon ; le chanfrein de la prise */
  h1: number;
  h2: number;
  h3: number;
  b: number;
  seg: number;
}
function moogDims(mobile: boolean, E: EncoderDims): MoogDims {
  const R = Math.max(E.r, E.skirt.r) * MOOG.base;
  return { R, rc: R * MOOG.cap, h1: E.h * MOOG.hBase, h2: E.h * MOOG.hGrip, h3: E.h, b: R * 0.035, seg: mobile ? 96 : 144 };
}
/** Le rayon de la prise a l'angle a (rad, 0 : le repere, vers l'arriere) : un lobe sous le repere, six en tout. */
function gripR(a: number, D: MoogDims): number {
  const notch = Math.pow(0.5 - 0.5 * Math.cos(a * MOOG.lobes), 3);
  return D.R * (MOOG.lobe - (MOOG.lobe - MOOG.notch) * notch);
}
/** Un tour de revolution (son bord au rayon des lobes) deforme en prise a six lobes : tout au bord, rien au pied du capuchon. */
function lobed(g: BufferGeometry, D: MoogDims): void {
  const rl = D.R * MOOG.lobe;
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    // 0 au repere (-z), sens horaire vu de dessus
    const a = Math.atan2(x, -z);
    const out = Math.max(0, Math.min(1, (r - D.rc) / (rl - D.rc)));
    const f = 1 + (gripR(a, D) / rl - 1) * out;
    p.setX(i, x * f);
    p.setZ(i, z * f);
  }
  g.computeVertexNormals();
}
/** La prise a six lobes, son chanfrein, son dessus, le flanc du capuchon, le repere : ce qui tourne. */
function moogGeometry(mobile: boolean, E: EncoderDims): BufferGeometry {
  const D = moogDims(mobile, E);
  const rl = D.R * MOOG.lobe;
  const wall = new LatheGeometry([new Vector2(rl, D.h1 * 0.5), new Vector2(rl, D.h2 - D.b)], D.seg);
  lobed(wall, D);
  const bevel = new LatheGeometry([new Vector2(rl, D.h2 - D.b), new Vector2(rl - D.b, D.h2)], D.seg);
  lobed(bevel, D);
  const top = new LatheGeometry([new Vector2(rl - D.b, D.h2), new Vector2((rl - D.b + D.rc) / 2, D.h2), new Vector2(D.rc, D.h2)], D.seg);
  lobed(top, D);
  const capWall = new LatheGeometry([new Vector2(D.rc, D.h2), new Vector2(D.rc, D.h3)], D.seg);
  const parts: BufferGeometry[] = [wall, bevel, top, capWall];
  const mk = E.mark;
  if (mk) {
    // Le repere blanc epais, du bord du capuchon presque au bord de la base (vers l'arriere, -z : midi)
    const r0 = D.rc * 0.99;
    const r1 = D.R * MOOG.markEnd;
    const mark = new BoxGeometry(D.R * MOOG.markW, mk.h * 1.5, r1 - r0);
    mark.translate(0, D.h2 + mk.h * 0.75, -(r0 + r1) / 2);
    parts.push(mark);
  }
  const flatParts = parts.map(flat);
  const body = albedoRgb('encoder', gainOf('encoder'));
  paintLinear(flatParts[0], body.map((v) => v * 0.55));
  paintLinear(flatParts[1], body.map((v) => v * 1.5));
  paintLinear(flatParts[2], body.map((v) => v * 0.42));
  paintLinear(flatParts[3], body.map((v) => v * 0.5));
  if (flatParts[4]) paintLinear(flatParts[4], LIT.mark);
  const g = mergeGeometries(flatParts, false);
  for (const q of flatParts) q.dispose();
  if (!g) throw new Error('encoders: merge failed');
  return g;
}
/** Le gris voulu a l'ecran (0 a 255) d'une face a plat du maillage immobile -> le facteur de l'albedo du capuchon (mesure). */
const moogF = (srgb: number): number => Math.pow(Math.max(4, srgb) / 36.7, 2.54);
/** Un bruit fixe par angle (les stries du metal brosse) : -1 a 1. */
const streak = (i: number): number => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};
/** La difference d'angle ramenee a -pi..pi. */
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
/**
 * Le gris du dessus du capuchon (0 a 255) a l'angle a (rad, atan2(z, x) : 0 a droite, 90 deg vers soi), en chrome fonce :
 * le fond va de 24 (7 h 30) a 68 (1 h), deux reflets francs (10 h 30, large ; 4 h 30, etroit), un filet a 1 h 30.
 */
export function moogCapGrey(a: number): number {
  const D2R = Math.PI / 180;
  const bell = (c: number, w: number): number => Math.exp(-Math.pow(wrap(a - c * D2R) / (w * D2R), 2));
  return 46 + 22 * Math.cos(a + 60 * D2R) + 172 * bell(-135, 23) + 165 * bell(45, 13) + 18 * bell(-45, 7) + 12 * bell(165, 9);
}
/**
 * Ce qui ne tourne pas : la base ronde (plus claire en haut a gauche, son bord arrondi, l'ombre de la prise) et le dessus
 * du capuchon (le chrome fonce, ses stries, son filet).
 */
function moogTopGeometry(mobile: boolean, E: EncoderDims): BufferGeometry {
  const D = moogDims(mobile, E);
  const body = albedoRgb('encoder', gainOf('encoder'));
  const paint = (g: BufferGeometry, grey: (x: number, z: number) => number): void => {
    const p = g.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i += 1) {
      const f = moogF(grey(p.getX(i), p.getZ(i)));
      col[i * 3] = body[0] * f;
      col[i * 3 + 1] = body[1] * f;
      col[i * 3 + 2] = body[2] * f * 1.03;
    }
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
  };
  // La lumiere vient d'en haut a gauche (x a droite, z vers soi)
  const lit = (x: number, z: number, r: number): number => 0.5 - (0.5 * (x + z)) / (Math.SQRT2 * r);
  // La base : son dessus a plat, jusqu'au bord
  const base = new RingGeometry(D.R * (MOOG.notch - 0.04), D.R, mobile ? 64 : 120, 8);
  base.rotateX(-Math.PI / 2);
  base.translate(0, D.h1, 0);
  const baseFlat = flat(base);
  paint(baseFlat, (x, z) => {
    const rr = Math.hypot(x, z) / D.R;
    const t = lit(x, z, D.R * Math.max(0.3, rr));
    // Le bord arrondi : il s'eclaire cote lumiere, s'assombrit a l'oppose ; l'ombre de la prise pres d'elle
    const edge = Math.max(0, (rr - 0.9) / 0.1);
    const round = 1 + edge * edge * (t - 0.62) * 0.9;
    const ao = 0.62 + 0.38 * Math.min(1, Math.max(0, (rr - 0.8) / 0.1));
    return (48 + 54 * t) * round * ao;
  });
  const side = flat(new LatheGeometry([new Vector2(D.R, 0), new Vector2(D.R, D.h1)], mobile ? 64 : 120));
  paintLinear(side, body.map((v) => v * 0.3));
  // Le dessus du capuchon : un disque, sa teinte par angle (moogCapGrey), ses stries, son filet au bord
  const r = D.rc * 0.985;
  const N = mobile ? 180 : 360;
  const cap = new RingGeometry(0, r, N, 5);
  cap.rotateX(-Math.PI / 2);
  cap.translate(0, D.h3, 0);
  const capFlat = flat(cap);
  let mean = 0;
  for (let i = 0; i < 72; i += 1) mean += moogCapGrey((i / 72) * Math.PI * 2) / 72;
  paint(capFlat, (x, z) => {
    const rr = Math.hypot(x, z) / r;
    const a = Math.atan2(z, x);
    const k = Math.round(((a + Math.PI) / (2 * Math.PI)) * N);
    let g = moogCapGrey(a) * (1 + 0.045 * streak(k) + 0.03 * streak(k * 7 + 3));
    // Au centre les secteurs se rejoignent ; au bord, le filet : clair cote lumiere, sombre a l'oppose
    if (rr < 0.1) g = mean + (g - mean) * (rr / 0.1);
    if (rr > 0.9) g *= 0.55 + 0.9 * lit(x, z, r * rr);
    return g;
  });
  const g = mergeGeometries([baseFlat, side, capFlat], false);
  baseFlat.dispose();
  side.dispose();
  capFlat.dispose();
  if (!g) throw new Error('encoders: merge failed');
  return g;
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
    // Le plugin : le maillage immobile porte la base du potard, qui fait son ombre sur le panneau ; elle n'en recoit pas
    // (l'ombre de la prise la noircissait toute : la sienne est peinte, moogTopGeometry)
    this.skirts.receiveShadow = !IN_PLUGIN;
    this.skirts.castShadow = IN_PLUGIN && opts.castShadow;
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
