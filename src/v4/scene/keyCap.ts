/**
 * Les touches en relief de la face du desktop (V.4.2, 2026-10-27, Mika : "plus avec un effet 3d, parce que je trouve ca
 * plat") : une seule recette pour les douze touches de la rangee, SCENE A et B et les seize pas (des InstancedMesh, une
 * geometrie partagee par maillage) ; le telephone garde ses RoundedBoxGeometry.
 *
 * keyCapGeometry : un capuchon a flancs droits et chanfrein. Le contour est un rectangle a coins arrondis (son rayon, seg
 * segments par coin) ; trois bandes de haut en bas : le dessus a plat (inset du chanfrein), le chanfrein a 45 deg (il
 * attrape la lumiere), le flanc droit jusqu'a la face. Des normales franches par bande (le chanfrein se lit), lissees
 * autour des coins ; une couleur par sommet (l'ombre portee de la touche sur elle-meme : le pied du flanc plus sombre),
 * multipliee par celle de l'instance (vertexColors) ; la part de l'eclat de l'instance par sommet (emissiveMask : une
 * touche allumee l'est par son dessus, ses flancs un peu). Base a y 0, dessus a y h ; quelques centaines de triangles (moins
 * que la RoundedBoxGeometry a trois segments d'avant).
 *
 * keySkirtGeometry : la jupe, l'ombre douce ou la touche touche la face : un anneau a plat autour de chaque touche, noir
 * a son bord interieur (alpha), transparent dehors ; une seule geometrie pour toutes les touches (elles ne bougent qu'en
 * hauteur : l'ombre reste sur la face), un seul appel de dessin, aucune passe d'ombre.
 */

import { BufferAttribute, BufferGeometry } from 'three';

/** Un point du contour : sa place et sa normale vers l'exterieur (dans le plan). */
interface Pt {
  x: number;
  z: number;
  nx: number;
  nz: number;
}

/** Le contour d'un rectangle a coins arrondis (demi-largeurs hw, hd, rayon r), seg + 1 points par coin, en tournant de +x vers +z. */
function contour(hw: number, hd: number, r: number, seg: number): Pt[] {
  const rr = Math.max(0, Math.min(r, hw, hd));
  const out: Pt[] = [];
  // Les quatre coins, du coin (+x, +z) en tournant : centre du quart de cercle et angle de depart
  const corners: [number, number, number][] = [
    [hw - rr, hd - rr, 0],
    [-(hw - rr), hd - rr, Math.PI / 2],
    [-(hw - rr), -(hd - rr), Math.PI],
    [hw - rr, -(hd - rr), (3 * Math.PI) / 2],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let k = 0; k <= seg; k += 1) {
      const a = a0 + (k / seg) * (Math.PI / 2);
      const c = Math.cos(a);
      const s = Math.sin(a);
      out.push({ x: cx + rr * c, z: cz + rr * s, nx: c, nz: s });
    }
  }
  return out;
}

/** L'ombre sur la touche (couleur par sommet, multipliee par celle de l'instance) : le pied du flanc, son haut, le chanfrein et le dessus. */
export interface KeyShade {
  foot: number;
  wall: number;
  /** le chanfrein (au-dessus de 1 : un rien plus clair, il attrape la lumiere) */
  bevel: number;
  top: number;
  /** la part de l'eclat de l'instance (une touche allumee, l'appui) au pied du flanc, a son haut, sur le chanfrein : le dessus en a toute */
  glow: { foot: number; wall: number; bevel: number };
}

/**
 * Le capuchon : w x d, hauteur h, coins de rayon radius, chanfrein bevel (en unites), seg segments par coin ; shade, ses
 * teintes. Base a y 0.
 */
export function keyCapGeometry(w: number, h: number, d: number, radius: number, bevel: number, seg: number, shade: KeyShade): BufferGeometry {
  const b = Math.max(0, Math.min(bevel, h * 0.9, w / 2 - 1e-4, d / 2 - 1e-4));
  const outer = contour(w / 2, d / 2, radius, seg);
  const inner = contour(w / 2 - b, d / 2 - b, Math.max(0, radius - b), seg);
  const n = outer.length;
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const msk: number[] = [];
  const idx: number[] = [];
  const add = (x: number, y: number, z: number, nx: number, ny: number, nz: number, c: number, m: number): number => {
    pos.push(x, y, z);
    nrm.push(nx, ny, nz);
    col.push(c, c, c);
    msk.push(m);
    return pos.length / 3 - 1;
  };
  // Un quadrilatere (a b en bas, c d en haut, dans l'ordre du contour) tourne vers l'exterieur : l'ordre est choisi d'apres la normale voulue
  const quad = (i0: number, i1: number, i2: number, i3: number, wantX: number, wantY: number, wantZ: number): void => {
    const p = (i: number): [number, number, number] => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    const [ax, ay, az] = p(i0);
    const [bx, by, bz] = p(i1);
    const [cx, cy, cz] = p(i2);
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const dot = (uy * vz - uz * vy) * wantX + (uz * vx - ux * vz) * wantY + (ux * vy - uy * vx) * wantZ;
    if (dot >= 0) idx.push(i0, i1, i2, i0, i2, i3);
    else idx.push(i0, i2, i1, i0, i3, i2);
  };
  // Le flanc : du pied (y 0) au debut du chanfrein, normales horizontales
  const yb = h - b;
  const wall0: number[] = [];
  const wall1: number[] = [];
  for (const q of outer) {
    wall0.push(add(q.x, 0, q.z, q.nx, 0, q.nz, shade.foot, shade.glow.foot));
    wall1.push(add(q.x, yb, q.z, q.nx, 0, q.nz, shade.wall, shade.glow.wall));
  }
  // Le chanfrein : du haut du flanc au bord du dessus, normales a 45 deg
  const k = Math.SQRT1_2;
  const ch0: number[] = [];
  const ch1: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const o = outer[i];
    const q = inner[i];
    ch0.push(add(o.x, yb, o.z, o.nx * k, k, o.nz * k, shade.bevel, shade.glow.bevel));
    ch1.push(add(q.x, h, q.z, o.nx * k, k, o.nz * k, shade.bevel, shade.glow.bevel));
  }
  // Le dessus a plat
  const top: number[] = inner.map((q) => add(q.x, h, q.z, 0, 1, 0, shade.top, 1));
  const center = add(0, h, 0, 0, 1, 0, shade.top, 1);
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const mx = (outer[i].nx + outer[j].nx) / 2;
    const mz = (outer[i].nz + outer[j].nz) / 2;
    quad(wall0[i], wall0[j], wall1[j], wall1[i], mx, 0, mz);
    quad(ch0[i], ch0[j], ch1[j], ch1[i], mx, 1, mz);
    // Le dessus : un eventail depuis le centre (le contour est convexe), tourne vers le haut
    const p = (v: number): [number, number] => [pos[v * 3], pos[v * 3 + 2]];
    const [ax, az] = p(top[i]);
    const [bx, bz] = p(top[j]);
    const up = ax * bz - az * bx;
    if (up <= 0) idx.push(center, top[i], top[j]);
    else idx.push(center, top[j], top[i]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  // L'eclat de l'instance par sommet (materials.ts withInstanceEmissive, masked) : une touche allumee l'est par son dessus
  g.setAttribute('emissiveMask', new BufferAttribute(new Float32Array(msk), 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Une touche pour la jupe : son centre (x, z), sa taille, le rayon de ses coins, en unites. */
export interface SkirtKey {
  x: number;
  z: number;
  w: number;
  d: number;
  radius: number;
}

/**
 * La jupe de toutes les touches : pour chacune, un anneau de largeur width autour de son pied, l'alpha a son bord
 * interieur, 0 dehors ; a y (un rien au-dessus de la face). Couleur RGBA par sommet (noir).
 */
export function keySkirtGeometry(keys: readonly SkirtKey[], width: number, alpha: number, y: number, seg: number): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const kk of keys) {
    const ring = contour(kk.w / 2, kk.d / 2, kk.radius, seg);
    const n = ring.length;
    const o = pos.length / 3;
    for (const q of ring) {
      pos.push(kk.x + q.x, y, kk.z + q.z);
      col.push(0, 0, 0, alpha);
    }
    for (const q of ring) {
      pos.push(kk.x + q.x + q.nx * width, y, kk.z + q.z + q.nz * width);
      col.push(0, 0, 0, 0);
    }
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const a = o + i;
      const bb = o + j;
      const c = o + n + j;
      const d = o + n + i;
      // Les deux faces se dessinent (le materiau de la jupe est DoubleSide) : l'ordre ne compte pas
      idx.push(a, bb, c, a, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 4));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
