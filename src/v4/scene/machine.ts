/**
 * Le corps de la MM-808, revision 2 (spec 20.3.1 a 20.3.3) : une boite a
 * rythmes noire en coin, facon Elektron Analog Rytm. Trois couches pour la
 * vue eclatee (scene/explode.ts) :
 * - plateauGroup : le panneau (dalle d'aluminium anodise a chanfrein, le
 *   cadre de l'ecran fusionne) et tout ce qui est pose dessus ; son repere
 *   est incline de 5.711 deg (l'avant plus bas), origine au centre du
 *   dessus du panneau ;
 * - pcbGroup : le PCB (scene/pcb.ts), incline pareil, cache dans le
 *   chassis tant que la machine est fermee ;
 * - socleGroup : le chassis (le coin, ses chanfreins, son bac, quatre
 *   pieds en caoutchouc, la connectique arriere, un seul maillage) et le
 *   sol ; il ne bouge jamais.
 * machineRoot porte l'intro (la machine monte a sa place). Deux draw calls
 * pour tout le corps : chassis, panneau.
 */

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  Shape,
  type CanvasTexture,
  type MeshStandardMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BODY,
  BACK,
  FEET,
  GAIN,
  LAYERS,
  OLED,
  PANEL,
  PANEL_TOP_Y,
  TILT,
  TRAY,
  chassisTopY,
  gainOf,
  type Tone,
} from '../theme';
import { albedo, makeChassisMaterial, makePanelMaterial, paintFaces, paintSolid } from './materials';

/** Rectangle a coins arrondis centre, une suite d'arcs (three ajoute les cotes droits). */
function roundedRect(w: number, d: number, r: number): Shape {
  const hw = w / 2;
  const hd = d / 2;
  const s = new Shape();
  s.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false);
  s.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false);
  s.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false);
  s.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Intersection de deux droites a.x + b.y = c (profil du coin). */
function meet(a1: number, b1: number, c1: number, a2: number, b2: number, c2: number): [number, number] {
  const det = a1 * b2 - a2 * b1;
  return [(c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det];
}

/**
 * Profil du coin dans le plan (u, v) = (-z, y), retreci du chanfrein
 * (l'extrusion le rend en bevelSize) et ses quatre coins chanfreines :
 * 8 points. Extrude le long de x, chaque arete finit chanfreinee.
 */
function wedgeProfile(): Shape {
  const s = BODY.chamfer;
  const hz = BODY.d / 2;
  const y0 = BODY.feet;
  // Dessus : y = t0 - z tan(TILT), soit en (u = -z) : -tan(TILT) u + y = t0... en u : y = t0 + u tan
  const tanT = Math.tan(TILT);
  const t0 = chassisTopY(0);
  // Droites du profil (a u + b v = c), deja rentrees de s vers l'interieur
  const nrm = Math.hypot(tanT, 1);
  const top = { a: -tanT, b: 1, c: t0 - s * nrm }; // v - u tan = t0 - s |n|
  const bottom = { a: 0, b: 1, c: y0 + s };
  const back = { a: 1, b: 0, c: hz - s }; // u = +hz - s (z = -hz)
  const front = { a: 1, b: 0, c: -hz + s }; // u = -hz + s (z = +hz)
  const corners = [
    meet(back.a, back.b, back.c, bottom.a, bottom.b, bottom.c),
    meet(back.a, back.b, back.c, top.a, top.b, top.c),
    meet(front.a, front.b, front.c, top.a, top.b, top.c),
    meet(front.a, front.b, front.c, bottom.a, bottom.b, bottom.c),
  ];
  // Chaque coin coupe de s le long de ses deux aretes
  const pts: [number, number][] = [];
  for (let i = 0; i < 4; i += 1) {
    const p = corners[i];
    const prev = corners[(i + 3) % 4];
    const next = corners[(i + 1) % 4];
    const toward = (q: [number, number]): [number, number] => {
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const l = Math.hypot(dx, dy);
      return [p[0] + (dx / l) * s, p[1] + (dy / l) * s];
    };
    pts.push(toward(prev), toward(next));
  }
  const shape = new Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  return shape;
}

/** Repere du panneau ferme (x, y, z) -> monde du socle : rotation TILT autour de x, dessus a PANEL_TOP_Y. */
function fromPanel(x: number, y: number, z: number, out: number[]): void {
  const c = Math.cos(TILT);
  const sn = Math.sin(TILT);
  out.push(x, PANEL_TOP_Y + y * c - z * sn, y * sn + z * c);
}

/**
 * Le coin : dessous a y 0.12, dessus = le dessous du panneau (2.18 a
 * l'arriere, 1.28 a l'avant), x de -7 a 7. Couleurs par normale : flancs
 * et dessous body, chanfreins tournes vers le haut bodyEdge (ils
 * accrochent la lumiere). Puis le dessus plein devient un bac (tray) : un
 * rebord de TRAY.wall, des parois interieures et un fond TRAY.depth plus
 * bas, paralleles au panneau (bodyTop, body). Le PCB vit dans le bac et en
 * sort a l'ouverture sans jamais traverser une surface.
 */
function buildWedge(): BufferGeometry {
  const s = BODY.chamfer;
  const g = new ExtrudeGeometry(wedgeProfile(), {
    depth: BODY.w - 2 * s,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: true,
    bevelThickness: s,
    bevelSize: s,
    bevelSegments: 1,
  });
  // (u, v, w) -> (x = w, y = v, z = -u) : rotation de +90 deg autour de y
  g.rotateY(Math.PI / 2);
  g.translate(-BODY.w / 2 + s, 0, 0);
  g.deleteAttribute('uv');
  const topNy = Math.cos(TILT);
  const isTop = (nx: number, ny: number): boolean => ny > topNy - 0.01 && Math.abs(nx) < 0.01;
  paintFaces(g, (nx, ny) => {
    if (isTop(nx, ny)) return 'bodyTop';
    if (Math.abs(ny) < 0.15 || ny < -0.97) return 'body';
    return ny > 0 ? 'bodyEdge' : 'body';
  });
  return toTray(g, isTop);
}

/**
 * Remplace le dessus plein du coin par le bac : le contour exact du
 * dessus (lu sur ses triangles, dans le repere du panneau) donne le
 * rebord ; l'ouverture est rentree de TRAY.wall, le fond est TRAY.depth
 * sous le rebord. Chaque quad est oriente vers sa normale (faces avant).
 */
function toTray(g: BufferGeometry, isTop: (nx: number, ny: number) => boolean): BufferGeometry {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const col = g.getAttribute('color');
  const P: number[] = [];
  const N: number[] = [];
  const C: number[] = [];
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  const c = Math.cos(TILT);
  const sn = Math.sin(TILT);
  for (let i = 0; i + 2 < pos.count; i += 3) {
    const nx = (nor.getX(i) + nor.getX(i + 1) + nor.getX(i + 2)) / 3;
    const ny = (nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2)) / 3;
    if (isTop(nx, ny)) {
      for (let k = 0; k < 3; k += 1) {
        // Monde -> repere du panneau (rotation -TILT autour de x)
        const y = pos.getY(i + k) - PANEL_TOP_Y;
        const z = pos.getZ(i + k);
        const zp = -y * sn + z * c;
        x0 = Math.min(x0, pos.getX(i + k));
        x1 = Math.max(x1, pos.getX(i + k));
        z0 = Math.min(z0, zp);
        z1 = Math.max(z1, zp);
      }
      continue;
    }
    for (let k = 0; k < 3; k += 1) {
      P.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
      N.push(nor.getX(i + k), nor.getY(i + k), nor.getZ(i + k));
      C.push(col.getX(i + k), col.getY(i + k), col.getZ(i + k));
    }
  }
  const yTop = -PANEL.t;
  const yBot = yTop - TRAY.depth;
  const w = TRAY.wall;
  const ix0 = x0 + w;
  const ix1 = x1 - w;
  const iz0 = z0 + w;
  const iz1 = z1 - w;
  const top = albedo('bodyTop', new Color(), gainOf('bodyTop'));
  const side = albedo('body', new Color(), gainOf('body'));
  const tmp: number[] = [];
  /** Un quad (4 points du repere panneau), sa normale (repere panneau), sa couleur. */
  const quad = (q: number[][], n: [number, number, number], rgb: Color): void => {
    tmp.length = 0;
    for (const v of q) fromPanel(v[0], v[1], v[2], tmp);
    // Normale monde (rotation seule)
    const wn = [n[0], n[1] * c - n[2] * sn, n[1] * sn + n[2] * c];
    // Ordre des sommets : la face avant regarde la normale
    const ax = tmp[3] - tmp[0];
    const ay = tmp[4] - tmp[1];
    const az = tmp[5] - tmp[2];
    const bx = tmp[6] - tmp[0];
    const by = tmp[7] - tmp[1];
    const bz = tmp[8] - tmp[2];
    const flip = (ay * bz - az * by) * wn[0] + (az * bx - ax * bz) * wn[1] + (ax * by - ay * bx) * wn[2] < 0;
    const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    for (const k of order) {
      P.push(tmp[k * 3], tmp[k * 3 + 1], tmp[k * 3 + 2]);
      N.push(wn[0], wn[1], wn[2]);
      C.push(rgb.r, rgb.g, rgb.b);
    }
  };
  const up: [number, number, number] = [0, 1, 0];
  // Rebord : quatre bandes entre le contour du dessus et l'ouverture
  quad([[x0, yTop, z0], [x1, yTop, z0], [x1, yTop, iz0], [x0, yTop, iz0]], up, top);
  quad([[x0, yTop, iz1], [x1, yTop, iz1], [x1, yTop, z1], [x0, yTop, z1]], up, top);
  quad([[x0, yTop, iz0], [ix0, yTop, iz0], [ix0, yTop, iz1], [x0, yTop, iz1]], up, top);
  quad([[ix1, yTop, iz0], [x1, yTop, iz0], [x1, yTop, iz1], [ix1, yTop, iz1]], up, top);
  // Parois interieures, tournees vers le bac
  quad([[ix0, yTop, iz0], [ix1, yTop, iz0], [ix1, yBot, iz0], [ix0, yBot, iz0]], [0, 0, 1], side);
  quad([[ix0, yTop, iz1], [ix1, yTop, iz1], [ix1, yBot, iz1], [ix0, yBot, iz1]], [0, 0, -1], side);
  quad([[ix0, yTop, iz0], [ix0, yTop, iz1], [ix0, yBot, iz1], [ix0, yBot, iz0]], [1, 0, 0], side);
  quad([[ix1, yTop, iz0], [ix1, yTop, iz1], [ix1, yBot, iz1], [ix1, yBot, iz0]], [-1, 0, 0], side);
  // Fond
  quad([[ix0, yBot, iz0], [ix1, yBot, iz0], [ix1, yBot, iz1], [ix0, yBot, iz1]], up, top);
  g.dispose();
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new Float32BufferAttribute(N, 3));
  out.setAttribute('color', new Float32BufferAttribute(C, 3));
  return out;
}

/** Piece non indexee, une teinte, prete a fusionner. */
function part(g: BufferGeometry, tone: Tone): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  out.deleteAttribute('uv');
  paintSolid(out, tone, GAIN.parts);
  return out;
}

/** Un pave (w, h, d) centre en (x, y, z). */
function box(w: number, h: number, d: number, x: number, y: number, z: number, tone: Tone): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return part(g, tone);
}

/** Un cylindre d'axe z (face arriere), sa face externe a zFace - h. */
function disc(r: number, h: number, seg: number, x: number, y: number, zFace: number, tone: Tone): BufferGeometry {
  const g = new CylinderGeometry(r, r, h, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, zFace - h / 2);
  return part(g, tone);
}

/**
 * Connectique de la face arriere (2026-10-01, theme BACK) : casque, sorties
 * L et R (jacks 6.35, ecrou hexagonal, fut, trou), SYNC IN et OUT
 * (mini-jacks), MIDI IN et OUT (DIN 5 broches : collerette, fut, insert
 * noir perce de cinq trous et d'un ergot), USB-C (coque en stade, fond,
 * languette), jack d'alimentation, interrupteur a bascule. Des paves et
 * des cylindres a peu de facettes, fusionnes au chassis : zero draw call.
 */
function buildConnectors(mobile: boolean): BufferGeometry[] {
  const B = BACK;
  const zb = -BODY.d / 2;
  const seg = mobile ? 14 : 20;
  const y = B.portY;
  const out: BufferGeometry[] = [];
  /** Stade (coque USB-C) : un pave et deux demi-disques, face externe a zFace - h. */
  const stadium = (w: number, h: number, d: number, x: number, zFace: number, tone: Tone): void => {
    out.push(box(w - h, h, d, x, y, zFace - d / 2, tone));
    for (const sd of [-1, 1]) out.push(disc(h / 2, d, 12, x + (sd * (w - h)) / 2, y, zFace, tone));
  };
  for (const p of B.ports) {
    const x = -p.u;
    if (p.kind === 'jack' || p.kind === 'mini') {
      const J = B[p.kind];
      out.push(disc(J.nut, J.nutH, 6, x, y, zb, 'leg'));
      out.push(disc(J.barrel, J.barrelH, seg, x, y, zb, 'line'));
      out.push(disc(J.hole, 0.004, 12, x, y, zb - J.barrelH, 'ink'));
    } else if (p.kind === 'din') {
      const D = B.din;
      out.push(disc(D.flange, D.flangeH, seg + 8, x, y, zb, 'leg'));
      out.push(disc(D.shell, D.shellH, seg + 8, x, y, zb, 'leg'));
      const zf = zb - D.shellH;
      out.push(disc(D.inner, 0.004, seg + 8, x, y, zf, 'line'));
      // Cinq trous sur le demi-cercle du bas, l'ergot en haut
      for (let k = 0; k < 5; k += 1) {
        const a = Math.PI + (Math.PI * k) / 4;
        out.push(disc(D.pinR, 0.004, 8, x + Math.cos(a) * D.pinRing, y + Math.sin(a) * D.pinRing, zf - 0.004, 'ink'));
      }
      out.push(box(D.key, D.key * 0.9, 0.004, x, y + D.inner - D.key * 0.45, zf - 0.006, 'ink'));
    } else if (p.kind === 'usb') {
      const U = B.usb;
      stadium(U.w, U.h, U.d, x, zb, 'leg');
      stadium(U.inner.w, U.inner.h, 0.004, x, zb - U.d, 'ink');
      out.push(box(U.tongue.w, U.tongue.h, 0.004, x, y, zb - U.d - 0.006, 'line'));
    } else if (p.kind === 'dc') {
      const D = B.dc;
      out.push(box(D.w, D.w, D.d, x, y, zb - D.d / 2, 'line'));
      out.push(disc(D.hole, 0.004, seg, x, y, zb - D.d, 'ink'));
      out.push(disc(D.pin, 0.03, 10, x, y, zb - D.d + 0.02, 'leg'));
    } else {
      const P = B.power;
      out.push(box(P.w, P.h, P.d, x, y, zb - P.d / 2, 'line'));
      const r = P.rocker;
      const g = new BoxGeometry(r.w, r.h, r.d);
      g.rotateX((r.tiltDeg * Math.PI) / 180);
      g.translate(x, y, zb - P.d - r.d / 2 + 0.03);
      out.push(part(g, 'ink'));
    }
  }
  return out;
}

/** Quatre pieds en caoutchouc sous les coins (visibles en orbite basse). */
function buildFeet(mobile: boolean): BufferGeometry[] {
  const seg = mobile ? FEET.segments.mobile : FEET.segments.desktop;
  const out: BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const g = new CylinderGeometry(FEET.r, FEET.r, FEET.h, seg);
      g.translate(sx * FEET.x, FEET.h / 2, sz * FEET.z);
      out.push(part(g, 'rubber'));
    }
  }
  return out;
}

/** Chassis complet : coin, pieds, connectique ; une geometrie, un draw call. */
function buildChassis(mobile: boolean): BufferGeometry {
  const parts = [buildWedge(), ...buildFeet(mobile), ...buildConnectors(mobile)];
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('machine: chassis merge failed');
  return merged;
}

/**
 * Panneau : dalle extrudee (dessus a y 0, dessous a -0.14) a chanfrein
 * tourne vers le haut (panelEdge), cadre de l'ecran fusionne (oled). UV
 * du dessus en unites (x, -z) : le brossage (roughnessMap) court le long
 * de x.
 */
function buildPanel(): BufferGeometry {
  const P = PANEL;
  const depth = P.t - 2 * P.bevelThickness;
  const slab = new ExtrudeGeometry(roundedRect(P.shapeW, P.shapeD, P.radius), {
    depth,
    steps: 1,
    curveSegments: P.curveSegments,
    bevelEnabled: true,
    bevelThickness: P.bevelThickness,
    bevelSize: P.bevelSize,
    bevelSegments: 1,
  });
  // (x, y, z) -> (x, z, -y) : l'extrusion devient la hauteur, dessus a 0
  slab.rotateX(-Math.PI / 2);
  slab.translate(0, -(depth + P.bevelThickness), 0);
  paintFaces(slab, (_nx, ny) => (ny > 0.995 ? 'panel' : ny > 0.15 ? 'panelEdge' : 'panelSide'));
  const b = OLED.bezel;
  const bezelIndexed = new BoxGeometry(b.w, b.h, b.d);
  const bezel = bezelIndexed.toNonIndexed();
  bezelIndexed.dispose();
  bezel.translate(OLED.x, b.h / 2, OLED.z);
  paintSolid(bezel, 'oled', GAIN.parts);
  const merged = mergeGeometries([slab, bezel], false);
  slab.dispose();
  bezel.dispose();
  if (!merged) throw new Error('machine: panel merge failed');
  return merged;
}

export class Machine {
  /** machineRoot : l'intro le deplace, jamais la camera */
  readonly root = new Group();
  /** le panneau et tout ce qui est pose dessus (repere incline) */
  readonly plateau = new Group();
  readonly pcb = new Group();
  /** chassis et sol : fixes */
  readonly socle = new Group();
  readonly chassisMat: MeshStandardMaterial;
  readonly panelMat: MeshStandardMaterial;
  readonly chassis: Mesh;
  readonly panel: Mesh;

  constructor(mobile: boolean, brush: CanvasTexture) {
    this.root.name = 'machineRoot';
    this.plateau.name = 'plateauGroup';
    this.pcb.name = 'pcbGroup';
    this.socle.name = 'socleGroup';
    this.plateau.position.set(0, LAYERS.plateauY, 0);
    this.plateau.rotation.x = TILT;
    this.pcb.position.set(0, LAYERS.pcbY, 0);
    this.pcb.rotation.x = TILT;
    this.pcb.visible = false;
    this.socle.position.set(0, LAYERS.socleY, 0);
    this.root.add(this.socle, this.pcb, this.plateau);

    this.chassisMat = makeChassisMaterial();
    this.chassis = new Mesh(buildChassis(mobile), this.chassisMat);
    this.chassis.name = 'chassis';
    this.chassis.castShadow = true;
    this.chassis.receiveShadow = true;
    this.socle.add(this.chassis);

    this.panelMat = makePanelMaterial(brush);
    this.panel = new Mesh(buildPanel(), this.panelMat);
    this.panel.name = 'panel';
    // Mobile : le chassis et les pads suffisent a l'ombre (spec 20.9.1)
    this.panel.castShadow = !mobile;
    this.panel.receiveShadow = true;
    this.plateau.add(this.panel);
  }

  dispose(): void {
    this.chassis.geometry.dispose();
    this.panel.geometry.dispose();
    this.chassisMat.dispose();
    this.panelMat.dispose();
  }
}
