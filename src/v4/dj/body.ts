/**
 * Le corps du MM-DECKS (2026-10-04) : trois blocs en coin (DECK A, MIXER,
 * DECK B), aretes biseautees, dessus peint comme le capot du MM-ARP ;
 * sous chacun quatre pieds de caoutchouc ; sur les dessus, les cadres noirs
 * des ecrans et les fentes des faders (une fente sombre, une fente plus
 * noire au milieu). Un seul draw call : tout est fusionne, couleurs de
 * sommets (dj/theme.ts DJ_TONE), dans le repere du rig.
 */

import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, ExtrudeGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Shape, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { APPEARANCE } from '../theme';
import { DECK, DJ_BEZEL, DJ_BODY, DJ_FADER, DJ_TILT, DJ_TOP_Y, DJ_UNIT, MIX, UNIT_X, djTone, unitW, type DjTone, type DjUnit } from './theme';

type P2 = [number, number];

const tmp = new Color();

/** Albedo lineaire d'un tone (teinte affichee x gain), en triplet. */
export function djRgb(t: DjTone): [number, number, number] {
  const [hex, gain] = djTone(t);
  tmp.setHex(parseInt(hex.slice(1), 16)).multiplyScalar(gain);
  return [tmp.r, tmp.g, tmp.b];
}

/** Une seule teinte pour toute la geometrie (non indexee ou non). */
export function paintDj(g: BufferGeometry, t: DjTone | readonly number[]): void {
  const rgb = typeof t === 'string' ? djRgb(t) : t;
  const count = g.getAttribute('position').count;
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    col[i * 3] = rgb[0];
    col[i * 3 + 1] = rgb[1];
    col[i * 3 + 2] = rgb[2];
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
}

/** Teinte par face d'apres sa normale (geometrie non indexee). */
function paintFaces(g: BufferGeometry, pick: (nx: number, ny: number, nz: number) => DjTone): void {
  const n = g.getAttribute('normal');
  const col = new Float32Array(n.count * 3);
  const cache = new Map<DjTone, [number, number, number]>();
  for (let i = 0; i + 2 < n.count; i += 3) {
    const nx = (n.getX(i) + n.getX(i + 1) + n.getX(i + 2)) / 3;
    const ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
    const nz = (n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2)) / 3;
    const t = pick(nx, ny, nz);
    let rgb = cache.get(t);
    if (!rgb) {
      rgb = djRgb(t);
      cache.set(t, rgb);
    }
    for (let k = 0; k < 3; k += 1) col.set(rgb, (i + k) * 3);
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
}

/** Piece non indexee, sans UV, d'une teinte. */
export function partDj(g: BufferGeometry, t: DjTone): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  if (out.getAttribute('uv')) out.deleteAttribute('uv');
  paintDj(out, t);
  return out;
}

/** Le repere top (dessus incline) dans celui du rig. */
export const TOP_M = new Matrix4().compose(new Vector3(0, DJ_TOP_Y, 0), new Quaternion().setFromEuler(new Euler(DJ_TILT, 0, 0)), new Vector3(1, 1, 1));

/* ---------------- profil en coin ---------------- */

function area(pts: P2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/** Polygone convexe rentre de d (chaque cote glisse vers l'interieur). */
function inset(pts: P2[], d: number): P2[] {
  const n = pts.length;
  const sgn = area(pts) > 0 ? 1 : -1;
  const lines = pts.map((a, i) => {
    const b = pts[(i + 1) % n];
    const du = b[0] - a[0];
    const dv = b[1] - a[1];
    const l = Math.hypot(du, dv) || 1;
    const nu = (-dv / l) * sgn;
    const nv = (du / l) * sgn;
    const p: P2 = [a[0] + nu * d, a[1] + nv * d];
    return [dv, -du, dv * p[0] - du * p[1]] as const;
  });
  return pts.map((_, i) => {
    const l1 = lines[(i + n - 1) % n];
    const l2 = lines[i];
    const det = l1[0] * l2[1] - l2[0] * l1[1];
    return [(l1[2] * l2[1] - l2[2] * l1[1]) / det, (l1[0] * l2[2] - l2[0] * l1[2]) / det] as P2;
  });
}

/**
 * Un bloc : le profil (u = -z, v = y) du coin, rentre du biseau, extrude
 * le long de x de x0 a x1 ; la piece finie a les cotes du theme.
 */
function wedge(x0: number, x1: number): BufferGeometry {
  const B = DJ_BODY;
  const d = DJ_UNIT.d;
  const b = B.bevel;
  const pts: P2[] = [
    [-d / 2, B.feet],
    [d / 2, B.feet],
    [d / 2, B.feet + B.back],
    [-d / 2, B.feet + B.front],
  ];
  const ins = inset(pts, b);
  const s = new Shape();
  s.moveTo(ins[0][0], ins[0][1]);
  for (let i = 1; i < ins.length; i += 1) s.lineTo(ins[i][0], ins[i][1]);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: x1 - x0 - 2 * b, steps: 1, curveSegments: 4, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2 });
  g.rotateY(Math.PI / 2);
  g.translate(x0 + b, 0, 0);
  const out = g.toNonIndexed();
  g.dispose();
  out.deleteAttribute('uv');
  const ny = Math.cos(DJ_TILT);
  paintFaces(out, (nx, y) => {
    if (Math.abs(nx) > 0.6) return 'body';
    if (Math.abs(y - ny) < 0.004) return 'panel';
    if (y > 0.25) return 'edge';
    return 'body';
  });
  return out;
}

/* ---------------- pieces du dessus (repere top) ---------------- */

function topBox(w: number, h: number, d: number, x: number, z: number, t: DjTone, y0 = 0): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y0 + h / 2, z);
  g.applyMatrix4(TOP_M);
  return partDj(g, t);
}

/** Cadre d'un ecran : une dalle noire a peine plus haute que le dessus. */
function bezel(x: number, z: number, w: number, d: number): BufferGeometry {
  const m = DJ_BEZEL.margin;
  return topBox(w + 2 * m, DJ_BEZEL.h, d + 2 * m, x, z, 'bezel');
}

/** Fente d'un fader de z0 a z1 (ou de x0 a x1 couchee) : la fente, et sa fente noire. */
function slot(x: number, z0: number, z1: number, across = false): BufferGeometry[] {
  const F = DJ_FADER;
  const len = Math.abs(z1 - z0) + 2 * F.slot.margin;
  const c = (z0 + z1) / 2;
  const [w, d] = across ? [len, F.slot.w] : [F.slot.w, len];
  const [sw, sd] = across ? [len - 0.1, F.slit.w] : [F.slit.w, len - 0.1];
  const cx = across ? c : x;
  const cz = across ? x : c;
  return [topBox(w, F.slot.h, d, cx, cz, 'slot'), topBox(sw, F.slot.h + 0.002, sd, cx, cz, 'slit')];
}

function feet(u: DjUnit, seg: number): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const hw = unitW(u) / 2 - 0.6;
  const hd = DJ_UNIT.d / 2 - 0.6;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const g = new CylinderGeometry(0.3, 0.3, DJ_BODY.feet, seg);
      g.translate(UNIT_X[u] + sx * hw, DJ_BODY.feet / 2, sz * hd);
      out.push(partDj(g, 'rubber'));
    }
  }
  return out;
}

function buildBody(mobile: boolean): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const seg = mobile ? 12 : 16;
  for (const u of ['a', 'mix', 'b'] as const) {
    const x = UNIT_X[u];
    const w = unitW(u);
    parts.push(wedge(x - w / 2, x + w / 2), ...feet(u, seg));
  }
  // Ecrans : les deux platines, les effets de la table
  for (const d of ['a', 'b'] as const) {
    const x = UNIT_X[d];
    parts.push(bezel(x + DECK.screen.x, DECK.screen.z, DECK.screen.w, DECK.screen.d));
    parts.push(...slot(x + DECK.pitch.x, DECK.pitch.z0, DECK.pitch.z1));
  }
  parts.push(bezel(MIX.screen.x, MIX.screen.z, MIX.screen.w, MIX.screen.d));
  for (const cx of MIX.cols) parts.push(...slot(cx, MIX.fader.z0, MIX.fader.z1));
  parts.push(...slot(MIX.xfader.z, MIX.xfader.x0, MIX.xfader.x1, true));
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error('dj: body merge failed');
  return g;
}

export class DjBody {
  readonly mesh: Mesh;
  private material: MeshStandardMaterial;

  constructor(mobile: boolean) {
    const light = APPEARANCE.current === 'light';
    this.material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: light ? 0.55 : 0.68, metalness: light ? 0 : 0.18 });
    this.material.name = 'djBody';
    this.mesh = new Mesh(buildBody(mobile), this.material);
    this.mesh.name = 'djBody';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
