/**
 * Le corps du MM-VOYAGEUR (2026-10-03) : deux joues de noyer (le fil court
 * le long de la joue, texture generee une fois), le bac entre elles (fond,
 * face avant, face arriere et sa connectique, quatre pieds), et le capot :
 * une tole pliee, plateau plat devant, panneau qui se releve vers
 * l'arriere, un rebord en haut. Chaque piece a son profil (z, y) extrude
 * le long de x, aretes arrondies (biseau) ; le profil est d'abord rentre
 * de la taille du biseau, la piece finie a donc les cotes du theme.
 * Trois draw calls : les joues (bois), le bac, le capot.
 */

import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  ExtrudeGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { APPEARANCE, GAIN, type Tone } from '../theme';
import { mulberry32 } from '../scene/silk';
import { paintFaces, paintSolid } from '../scene/materials';
import { VOY_BODY, VOY_CHEEK, VOY_INNER, VOY_LID_W, VOY_PANEL, VOY_WOOD } from './theme';

type P2 = [number, number];

/** Droite a u + b v = c passant par p, de direction (du, dv). */
function lineThrough(p: P2, du: number, dv: number): [number, number, number] {
  const a = dv;
  const b = -du;
  return [a, b, a * p[0] + b * p[1]];
}

function meet(l1: [number, number, number], l2: [number, number, number]): P2 {
  const det = l1[0] * l2[1] - l2[0] * l1[1];
  return [(l1[2] * l2[1] - l2[2] * l1[1]) / det, (l1[0] * l2[2] - l2[0] * l1[2]) / det];
}

/** Aire signee (orientation du polygone). */
function area(pts: P2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/**
 * Polygone rentre de d : chaque cote glisse de d vers l'interieur, chaque
 * sommet est l'intersection des deux cotes voisins (exact pour des cotes
 * droits, convexes ou non, tant que d reste petit).
 */
function inset(pts: P2[], d: number): P2[] {
  const n = pts.length;
  const sgn = area(pts) > 0 ? 1 : -1;
  const lines = pts.map((a, i) => {
    const b = pts[(i + 1) % n];
    const du = b[0] - a[0];
    const dv = b[1] - a[1];
    const l = Math.hypot(du, dv) || 1;
    // Normale interieure : a gauche pour un polygone direct
    const nu = (-dv / l) * sgn;
    const nv = (du / l) * sgn;
    return lineThrough([a[0] + nu * d, a[1] + nv * d], du, dv);
  });
  return pts.map((_, i) => meet(lines[(i + n - 1) % n], lines[i]));
}

function shapeOf(pts: P2[]): Shape {
  const s = new Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

/**
 * Extrusion d'un profil (u = -z, v = y) le long de x, de x0 a x1, biseau b
 * (le profil donne est deja rentre de b) ; (u, v, w) -> (x, y, z = -u).
 */
function extrudeX(shape: Shape, x0: number, x1: number, b: number, segments = 2): BufferGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth: x1 - x0 - 2 * b,
    steps: 1,
    curveSegments: 10,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: segments,
  });
  g.rotateY(Math.PI / 2);
  g.translate(x0 + b, 0, 0);
  return g;
}

/* ---------------- profils ---------------- */

const B = VOY_BODY;
const H = B.topY - B.deckY;
const TAN = Math.tan(VOY_PANEL.angle);
const COS = Math.cos(VOY_PANEL.angle);

/**
 * Profil du capot, repere du capot (y = 0 : dessus du plateau), en
 * (u = -z, v = y) : plateau, pli, panneau, rebord arriere ; epaisseur lidT.
 */
export function lidProfile(): P2[] {
  const t = B.lidT;
  const uF = -B.d / 2;
  const uR = B.d / 2 - 0.02;
  const uBend = -B.bendZ;
  const uBack = -B.backZ;
  // Dessous du panneau : la pente decalee de t vers le bas (perpendiculaire)
  const slopeLow = lineThrough([uBend, -t / COS], 1, TAN);
  const deckLow = lineThrough([0, -t], 1, 0);
  const lipLow = lineThrough([0, H - t], 1, 0);
  return [
    [uF, 0],
    [uBend, 0],
    [uBack, H],
    [uR, H],
    [uR, H - t],
    meet(slopeLow, lipLow),
    meet(deckLow, slopeLow),
    [uF, -t],
  ];
}

/**
 * Profil d'une joue, repere du rig, (u = -z, v = y) : du sol (pieds) au
 * capot plus VOY_CHEEK.above, nez arrondi devant, coin arrondi derriere ;
 * rentre de b (le biseau du bois). Les arrondis par segments.
 */
function cheekShape(b: number): Shape {
  const h = VOY_CHEEK.above;
  const uF = -B.d / 2;
  const uR = B.d / 2;
  const yF = B.deckY + h;
  // Pli de la joue : le plat du dessus rencontre la pente, toutes deux a h au-dessus du capot
  const flat = lineThrough([0, yF], 1, 0);
  const slope = lineThrough([-B.bendZ, B.deckY + h / COS], 1, TAN);
  const top = lineThrough([0, B.topY + h], 1, 0);
  const bend = meet(flat, slope);
  const back = meet(slope, top);
  const nose = VOY_CHEEK.noseR;
  const br = VOY_CHEEK.backR;
  const pts: P2[] = [];
  const arc = (cu: number, cv: number, r: number, a0: number, a1: number): void => {
    const n = 10;
    for (let k = 0; k <= n; k += 1) {
      const a = a0 + ((a1 - a0) * k) / n;
      pts.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]);
    }
  };
  pts.push([uF, B.feet]);
  // Nez : quart de cercle de la face avant au plat du dessus
  arc(uF + nose, yF - nose, nose, Math.PI, Math.PI / 2);
  pts.push(bend);
  pts.push(back);
  // Coin arriere arrondi
  arc(uR - br, B.topY + h - br, br, Math.PI / 2, 0);
  pts.push([uR, B.feet]);
  // Les arcs sont deja des segments : le rentrer cote par cote
  const ins = inset(pts, b);
  return shapeOf(ins);
}

/* ---------------- noyer ---------------- */

/**
 * Fil de noyer : des cernes ondulants (bruit de valeur a deux octaves),
 * des pores sombres, trois teintes du brun au miel. Le fil court le long
 * de u (la longueur de la joue). Tuile horizontale (les bords gauche et
 * droit se raccordent), repetee.
 */
export function makeWoodTexture(): CanvasTexture {
  const [W, Hh] = VOY_WOOD.tex;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = Hh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('voyager: no 2d context');
  const rnd = mulberry32(VOY_WOOD.seed);
  // Bruit de valeur periodique en x
  const G = 32;
  const grid = Array.from({ length: G * G }, () => rnd());
  const noise = (x: number, y: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const at = (i: number, j: number): number => grid[(((j % G) + G) % G) * G + (((i % G) + G) % G)];
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const c = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (c - a) * sy;
  };
  const light = APPEARANCE.current === 'light';
  // Teintes affichees visees : noyer huile (plus clair sur la machine claire)
  const dark = light ? [92, 58, 34] : [46, 27, 15];
  const mid = light ? [138, 90, 54] : [84, 52, 30];
  const hi = light ? [176, 122, 76] : [120, 78, 46];
  const img = ctx.createImageData(W, Hh);
  for (let y = 0; y < Hh; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const u = (x / W) * G;
      const v = (y / Hh) * G;
      // Cernes : surtout en v, ondules par le bruit
      const warp = noise(u * 0.25, v * 0.5) * 2.2 + noise(u * 0.8, v * 1.6) * 0.5;
      const ring = (v * 0.9 + warp * 1.4) % 1;
      const band = Math.pow(Math.abs(ring * 2 - 1), 3);
      const fleck = noise(u * 6, v * 1.5);
      let t = 0.35 + 0.45 * band + (fleck - 0.5) * 0.25;
      t = Math.max(0, Math.min(1, t));
      const c0 = t < 0.5 ? dark : mid;
      const c1 = t < 0.5 ? mid : hi;
      const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      // Pores : de courts traits sombres le long du fil
      const pore = noise(u * 18, v * 3) > 0.86 ? 0.7 : 1;
      const o = (y * W + x) * 4;
      img.data[o] = Math.round((c0[0] + (c1[0] - c0[0]) * k) * pore);
      img.data[o + 1] = Math.round((c0[1] + (c1[1] - c0[1]) * k) * pore);
      img.data[o + 2] = Math.round((c0[2] + (c1[2] - c0[2]) * k) * pore);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(VOY_WOOD.repeat, VOY_WOOD.repeat);
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = 4;
  return t;
}

/* ---------------- pieces ---------------- */

/** Piece non indexee d'une teinte, prete a fusionner. */
function part(g: BufferGeometry, tone: Tone, gain?: number): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  if (out.getAttribute('uv')) out.deleteAttribute('uv');
  paintSolid(out, tone, gain ?? GAIN[tone] ?? GAIN.parts);
  return out;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, tone: Tone, gain?: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return part(g, tone, gain);
}

function disc(r: number, h: number, seg: number, x: number, y: number, zFace: number, tone: Tone): BufferGeometry {
  const g = new CylinderGeometry(r, r, h, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, zFace - h / 2);
  return part(g, tone, GAIN.parts);
}

/**
 * Le bac : fond, face avant (jusque sous le plateau), face arriere
 * (jusque sous le rebord du capot), et la connectique de la face arriere
 * (sorties, MIDI, alimentation) ; pieds sous les joues.
 */
function buildTray(mobile: boolean): BufferGeometry {
  const w = VOY_INNER;
  const t = B.wall;
  const seg = mobile ? 14 : 20;
  const parts: BufferGeometry[] = [];
  const bottom = 0.1;
  parts.push(box(w, bottom, B.d, 0, B.feet + bottom / 2, 0, 'voyBody'));
  const frontH = B.deckY - B.lidT - B.feet;
  parts.push(box(w, frontH, t, 0, B.feet + frontH / 2, B.d / 2 - t / 2, 'voyBody'));
  const backH = B.topY - B.lidT - B.feet;
  parts.push(box(w, backH, t, 0, B.feet + backH / 2, -B.d / 2 + t / 2, 'voyBody'));
  // Connectique arriere : deux sorties, casque, MIDI, alimentation
  const zb = -B.d / 2;
  const y = B.feet + 0.75;
  const xs = mobile ? [-2.6, -1.9, -1.2, 0.2, 1.1, 2.6] : [-4.2, -3.4, -2.6, -0.6, 0.4, 3.6];
  xs.forEach((x, k) => {
    if (k < 3) {
      parts.push(disc(0.19, 0.05, 6, x, y, zb, 'leg'));
      parts.push(disc(0.13, 0.08, seg, x, y, zb, 'line'));
      parts.push(disc(0.06, 0.004, 12, x, y, zb - 0.08, 'ink'));
    } else if (k < 5) {
      parts.push(disc(0.27, 0.02, seg + 8, x, y, zb, 'leg'));
      parts.push(disc(0.22, 0.06, seg + 8, x, y, zb, 'leg'));
      parts.push(disc(0.18, 0.004, seg + 8, x, y, zb - 0.06, 'line'));
    } else {
      parts.push(box(0.36, 0.36, 0.05, x, y, zb - 0.025, 'line'));
      parts.push(disc(0.11, 0.004, seg, x, y, zb - 0.05, 'ink'));
    }
  });
  // Pieds en caoutchouc sous les joues
  const fx = B.w / 2 - B.cheek / 2;
  const fz = B.d / 2 - 0.55;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const g = new CylinderGeometry(0.22, 0.22, B.feet, mobile ? 12 : 16);
      g.translate(sx * fx, B.feet / 2, sz * fz);
      parts.push(part(g, 'rubber', GAIN.parts));
    }
  }
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('voyager: tray merge failed');
  return merged;
}

/** Les deux joues (UV du profil en unites : le fil suit la longueur). */
function buildCheeks(): BufferGeometry {
  const b = 0.035;
  const shape = cheekShape(b);
  const half = B.w / 2;
  const parts = [extrudeX(shape, -half, -half + B.cheek, b, 3), extrudeX(shape, half - B.cheek, half, b, 3)].map((g) => {
    const out = g.toNonIndexed();
    g.dispose();
    return out;
  });
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('voyager: cheeks merge failed');
  return merged;
}

/**
 * Le capot (repere du capot) : dessus du plateau et du panneau en
 * voyPanel, biseaux tournes vers le haut en voyPanelEdge, dessous et
 * tranches en voyBody.
 */
function buildLid(): BufferGeometry {
  const b = 0.03;
  const shape = shapeOf(inset(lidProfile(), b));
  const g0 = extrudeX(shape, -VOY_LID_W / 2, VOY_LID_W / 2, b, 2);
  const g = g0.toNonIndexed();
  g0.dispose();
  g.deleteAttribute('uv');
  const ny = Math.cos(VOY_PANEL.angle);
  const nz = Math.sin(VOY_PANEL.angle);
  paintFaces(g, (nx, y, z) => {
    if (Math.abs(nx) > 0.5) return 'voyBody';
    // Le dessus du plateau, celui du panneau, le rebord
    if (y > 0.995) return 'voyPanel';
    if (Math.abs(y - ny) < 0.01 && Math.abs(z - nz) < 0.01) return 'voyPanel';
    if (y > 0.2) return 'voyPanelEdge';
    return 'voyBody';
  });
  return g;
}

export class VoyBody {
  readonly cheeks: Mesh;
  readonly tray: Mesh;
  readonly lid: Mesh;
  readonly woodTex: CanvasTexture;
  private woodMat: MeshStandardMaterial;
  private trayMat: MeshStandardMaterial;
  private lidMat: MeshStandardMaterial;

  constructor(mobile: boolean) {
    this.woodTex = makeWoodTexture();
    this.woodMat = new MeshStandardMaterial({ map: this.woodTex, roughness: 0.52, metalness: 0 });
    this.woodMat.name = 'voyWood';
    this.cheeks = new Mesh(buildCheeks(), this.woodMat);
    this.cheeks.name = 'voyCheeks';
    this.cheeks.castShadow = true;
    this.cheeks.receiveShadow = true;

    this.trayMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
    this.trayMat.name = 'voyTray';
    this.tray = new Mesh(buildTray(mobile), this.trayMat);
    this.tray.name = 'voyTray';
    this.tray.castShadow = true;
    this.tray.receiveShadow = true;

    this.lidMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: APPEARANCE.current === 'light' ? 0.55 : 0.68, metalness: APPEARANCE.current === 'light' ? 0 : 0.18 });
    this.lidMat.name = 'voyLid';
    this.lid = new Mesh(buildLid(), this.lidMat);
    this.lid.name = 'voyLid';
    this.lid.castShadow = true;
    this.lid.receiveShadow = true;
  }

  dispose(): void {
    for (const m of [this.cheeks, this.tray, this.lid]) m.geometry.dispose();
    for (const m of [this.woodMat, this.trayMat, this.lidMat]) m.dispose();
    this.woodTex.dispose();
  }
}
