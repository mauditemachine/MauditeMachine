/**
 * Le corps du MM-VOYAGER (2026-10-03) : deux joues de noyer (le fil court
 * le long de la joue, texture generee une fois), le bac entre elles (fond,
 * face avant, face arriere et sa connectique, quatre pieds), et le capot :
 * une tole pliee, plateau plat devant, panneau qui se releve vers
 * l'arriere, un rebord en haut. Chaque piece a son profil (z, y) extrude
 * le long de x, aretes arrondies (biseau) ; le profil est d'abord rentre
 * de la taille du biseau, la piece finie a donc les cotes du theme.
 * Trois draw calls : les joues (bois), le bac, le capot.
 */

import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Mesh, MeshStandardMaterial, Shape, type MeshPhysicalMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { APPEARANCE, BACK, GAIN, type Tone } from '../theme';
import { paintFaces, paintSolid } from '../scene/materials';
import { VOY_BACK, VOY_BODY, VOY_CHEEK, VOY_INNER, VOY_LID_W, VOY_PANEL } from './theme';
import { makeWood, makeWoodMaterial, type WoodMaps } from './wood';

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
 * Coin arrondi : la courbe (quadratique, tangente aux deux cotes) qui
 * remplace le sommet P entre ses voisins ; rayon borne par les cotes.
 */
function fillet(prev: P2, p: P2, next: P2, r: number, steps: number): P2[] {
  const d1u = p[0] - prev[0];
  const d1v = p[1] - prev[1];
  const d2u = next[0] - p[0];
  const d2v = next[1] - p[1];
  const l1 = Math.hypot(d1u, d1v) || 1;
  const l2 = Math.hypot(d2u, d2v) || 1;
  const cos = Math.max(-1, Math.min(1, (d1u * d2u + d1v * d2v) / (l1 * l2)));
  const phi = Math.acos(cos);
  if (phi < 1e-3 || r <= 0) return [p];
  const t = Math.min(r * Math.tan(phi / 2), 0.45 * l1, 0.45 * l2);
  const a: P2 = [p[0] - (d1u / l1) * t, p[1] - (d1v / l1) * t];
  const b: P2 = [p[0] + (d2u / l2) * t, p[1] + (d2v / l2) * t];
  const out: P2[] = [];
  for (let k = 0; k <= steps; k += 1) {
    const s = k / steps;
    const m0 = (1 - s) * (1 - s);
    const m1 = 2 * (1 - s) * s;
    const m2 = s * s;
    out.push([m0 * a[0] + m1 * p[0] + m2 * b[0], m0 * a[1] + m1 * p[1] + m2 * b[1]]);
  }
  return out;
}

/**
 * Profil d'une joue, repere du rig, (u = -z, v = y) : du sol (pieds) au
 * capot plus VOY_CHEEK.above. Tous les coins arrondis (2026-10-03, plus
 * dessine) : un nez genereux devant, un conge doux au pli du panneau, le
 * haut arriere arrondi, les pieds a peine casses. Rentre de b (le biseau).
 */
function cheekShape(b: number): Shape {
  const h = VOY_CHEEK.above;
  const uF = -B.d / 2;
  const uR = B.d / 2;
  const yF = B.deckY + h;
  const flat = lineThrough([0, yF], 1, 0);
  const slope = lineThrough([-B.bendZ, B.deckY + h / COS], 1, TAN);
  const top = lineThrough([0, B.topY + h], 1, 0);
  const corners: [P2, number][] = [
    [[uF, B.feet], 0.05],
    [[uF, yF], VOY_CHEEK.noseR],
    [meet(flat, slope), 1.1],
    [meet(slope, top), 0.6],
    [[uR, B.topY + h], VOY_CHEEK.backR],
    [[uR, B.feet], 0.05],
  ];
  const pts: P2[] = [];
  corners.forEach(([p, r], i) => {
    const prev = corners[(i + corners.length - 1) % corners.length][0];
    const next = corners[(i + 1) % corners.length][0];
    pts.push(...fillet(prev, p, next, r, r > 0.2 ? 12 : 3));
  });
  return shapeOf(inset(pts, b));
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
  // Face arriere (2026-10-03) : la connectique facon Voyager, vis, aerations
  parts.push(...buildBack(mobile, seg));
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

/**
 * La face arriere (VOY_BACK) : chaque prise a la facon de la MM-808 (BACK :
 * jacks 6.35 et mini-jacks a ecrou hexagonal, DIN 5 broches avec ergot,
 * USB-C en stade, jack d'alimentation, interrupteur a bascule), quatre vis
 * cruciformes aux coins (deux au telephone), des fentes d'aeration.
 */
function buildBack(mobile: boolean, seg: number): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const zb = -B.d / 2;
  const K = BACK;
  const stadium = (w: number, h: number, d: number, x: number, y: number, zFace: number, tone: Tone): void => {
    out.push(box(w - h, h, d, x, y, zFace - d / 2, tone, GAIN.parts));
    for (const sd of [-1, 1]) out.push(disc(h / 2, d, 12, x + (sd * (w - h)) / 2, y, zFace, tone));
  };
  for (const p of VOY_BACK.ports) {
    const x = -p.u;
    const y = p.y;
    if (p.kind === 'jack' || p.kind === 'mini') {
      const J = K[p.kind];
      out.push(disc(J.nut, J.nutH, 6, x, y, zb, 'leg'));
      out.push(disc(J.barrel, J.barrelH, seg, x, y, zb, 'line'));
      out.push(disc(J.hole, 0.004, 12, x, y, zb - J.barrelH, 'ink'));
    } else if (p.kind === 'din') {
      const D = K.din;
      out.push(disc(D.flange, D.flangeH, seg + 8, x, y, zb, 'leg'));
      out.push(disc(D.shell, D.shellH, seg + 8, x, y, zb, 'leg'));
      const zf = zb - D.shellH;
      out.push(disc(D.inner, 0.004, seg + 8, x, y, zf, 'line'));
      for (let k = 0; k < 5; k += 1) {
        const a = Math.PI + (Math.PI * k) / 4;
        out.push(disc(D.pinR, 0.004, 8, x + Math.cos(a) * D.pinRing, y + Math.sin(a) * D.pinRing, zf - 0.004, 'ink'));
      }
      out.push(box(D.key, D.key * 0.9, 0.004, x, y + D.inner - D.key * 0.45, zf - 0.006, 'ink', GAIN.parts));
    } else if (p.kind === 'usb') {
      const U = K.usb;
      stadium(U.w, U.h, U.d, x, y, zb, 'leg');
      stadium(U.inner.w, U.inner.h, 0.004, x, y, zb - U.d, 'ink');
      out.push(box(U.tongue.w, U.tongue.h, 0.004, x, y, zb - U.d - 0.006, 'line', GAIN.parts));
    } else if (p.kind === 'dc') {
      const D = K.dc;
      out.push(box(D.w, D.w, D.d, x, y, zb - D.d / 2, 'line', GAIN.parts));
      out.push(disc(D.hole, 0.004, seg, x, y, zb - D.d, 'ink'));
      out.push(disc(D.pin, 0.03, 10, x, y, zb - D.d + 0.02, 'leg'));
    } else {
      const P = K.power;
      out.push(box(P.w, P.h, P.d, x, y, zb - P.d / 2, 'line', GAIN.parts));
      const r = P.rocker;
      const g = new BoxGeometry(r.w, r.h, r.d);
      g.rotateX((r.tiltDeg * Math.PI) / 180);
      g.translate(x, y, zb - P.d - r.d / 2 + 0.03);
      out.push(part(g, 'ink', GAIN.parts));
    }
  }
  // Vis cruciformes : une tete bombee, une croix en creux
  for (const [u, y] of VOY_BACK.screws) {
    const x = -u;
    out.push(disc(0.09, 0.025, mobile ? 12 : 16, x, y, zb, 'leg'));
    out.push(box(0.11, 0.022, 0.004, x, y, zb - 0.027, 'ink', GAIN.parts));
    out.push(box(0.022, 0.11, 0.004, x, y, zb - 0.027, 'ink', GAIN.parts));
  }
  // Fentes d'aeration : des rainures sombres, a peine en creux
  const V = VOY_BACK.vents;
  const pitch = (V.y1 - V.y0) / (V.n - 1);
  for (let k = 0; k < V.n; k += 1) {
    // Sombres dans les deux apparences (l'encre s'inverse sur la machine claire)
    out.push(box(V.u1 - V.u0, 0.055, 0.004, -(V.u0 + V.u1) / 2, V.y0 + k * pitch, zb - 0.002, 'voyKnob', GAIN.parts));
  }
  return out;
}

/** Les deux joues (UV du profil en unites : le fil suit la longueur). */
function buildCheeks(): BufferGeometry {
  const b = 0.06;
  const shape = cheekShape(b);
  const half = B.w / 2;
  const parts = [extrudeX(shape, -half, -half + B.cheek, b, 4), extrudeX(shape, half - B.cheek, half, b, 4)].map((g) => {
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
  private wood: WoodMaps;
  private woodMat: MeshPhysicalMaterial;
  private trayMat: MeshStandardMaterial;
  private lidMat: MeshStandardMaterial;

  constructor(mobile: boolean) {
    // Une tuile de fil par joue : toute la longueur, toute la hauteur, sans raccord
    this.wood = makeWood(mobile);
    for (const t of [this.wood.color, this.wood.bump]) {
      t.repeat.set(1 / (B.d + 0.3), 1 / (B.topY + 0.6));
      t.offset.set(0.5, 0);
    }
    this.woodMat = makeWoodMaterial(this.wood);
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
    for (const t of [this.wood.color, this.wood.bump, this.wood.env]) {
      const c = t.image as HTMLCanvasElement;
      t.dispose();
      c.width = 0;
      c.height = 0;
    }
  }
}
