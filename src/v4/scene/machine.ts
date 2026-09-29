/**
 * Le corps de la MM-808 (spec 5.1 et 5.2) : trois couches pour la vue
 * eclatee (scene/explode.ts). plateauGroup (y 1.6) porte le plateau
 * graphite a chanfrein graphiteHi et tout ce qui est pose dessus ;
 * pcbGroup (y 0.72) porte le PCB (scene/pcb.ts), cache tant que la machine
 * est fermee ; socleGroup (y 0) porte le socle graphiteLo, un peu plus
 * large, ses connecteurs, sa mention et le plan d'ombre. machineRoot recoit
 * la parallaxe. Deux draw calls pour tout le corps.
 */

import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, Shape, type BufferGeometry, type MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONNECTORS, LAYERS, LCD_BEZEL, PLATE, SOCLE, type BodySpec, type Tone } from '../theme';
import { makeBodyMaterial, paintByNormal, paintSolid } from './materials';

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

/**
 * Bloc extrude a chanfreins, axe d'extrusion vertical. La depth de three
 * exclut les deux chanfreins : on la deduit de l'epaisseur totale pour que
 * le bloc occupe exactement [yBottom, yBottom + thickness].
 */
function extrudeBody(spec: BodySpec, yBottom: number): BufferGeometry {
  const depth = spec.thickness - 2 * spec.bevelThickness;
  const g = new ExtrudeGeometry(roundedRect(spec.shapeW, spec.shapeD, spec.radius), {
    depth,
    steps: 1,
    curveSegments: spec.curveSegments,
    bevelEnabled: true,
    bevelThickness: spec.bevelThickness,
    bevelSize: spec.bevelSize,
    bevelSegments: spec.bevelSegments,
  });
  // (x, y, z) -> (x, z, -y) : l'extrusion devient la hauteur, de -bevel a depth + bevel
  g.rotateX(-Math.PI / 2);
  g.translate(0, yBottom + spec.bevelThickness, 0);
  g.deleteAttribute('uv');
  return g;
}

/** Plateau : dessus a y 0, dessous a -0.9 ; cadre de l'ecran fusionne. */
function buildPlate(): BufferGeometry {
  const plate = extrudeBody(PLATE, -PLATE.thickness);
  paintByNormal(plate, { top: 'graphite', bottom: 'graphiteLo', side: 'graphite', bevelUp: 'graphiteHi', bevelDown: 'graphiteLo' });
  const bezelIndexed = new BoxGeometry(LCD_BEZEL.w, LCD_BEZEL.h, LCD_BEZEL.d);
  const bezel = bezelIndexed.toNonIndexed();
  bezelIndexed.dispose();
  bezel.translate(LCD_BEZEL.x, LCD_BEZEL.h / 2, LCD_BEZEL.z);
  bezel.deleteAttribute('uv');
  paintSolid(bezel, 'graphiteLo');
  const merged = mergeGeometries([plate, bezel], false);
  plate.dispose();
  bezel.dispose();
  if (!merged) throw new Error('machine: plate merge failed');
  return merged;
}

/** Piece non indexee (comme l'extrusion), une teinte, prete a fusionner. */
function part(g: BufferGeometry, tone: Tone): BufferGeometry {
  const out = g.toNonIndexed();
  g.dispose();
  out.deleteAttribute('uv');
  paintSolid(out, tone);
  return out;
}

/**
 * Alimentation et connecteurs du flanc droit (spec 5.2) : prise secteur,
 * deux jacks (fut line, trou encre), USB. Fusionnes au socle : zero draw
 * call de plus.
 */
function buildConnectors(): BufferGeometry[] {
  const C = CONNECTORS;
  const out: BufferGeometry[] = [];
  const inlet = new BoxGeometry(C.inlet.w, C.inlet.h, C.inlet.d);
  inlet.translate(C.inlet.x, C.inlet.y, C.inlet.z);
  out.push(part(inlet, 'graphite'));
  for (const j of C.jacks) {
    const body = new CylinderGeometry(C.jackR, C.jackR, C.jackL, 16);
    body.rotateZ(Math.PI / 2);
    body.translate(j.x, j.y, j.z);
    out.push(part(body, 'line'));
    const hole = new CylinderGeometry(C.holeR, C.holeR, C.jackL + 0.004, 12);
    hole.rotateZ(Math.PI / 2);
    hole.translate(j.x + 0.002, j.y, j.z);
    out.push(part(hole, 'ink'));
  }
  const usb = new BoxGeometry(C.usb.w, C.usb.h, C.usb.d);
  usb.translate(C.usb.x, C.usb.y, C.usb.z);
  out.push(part(usb, 'line'));
  return out;
}

/** Socle : y 0 a 0.7, sa bande de chanfrein en graphite, ses connecteurs. */
function buildSocle(): BufferGeometry {
  const g = extrudeBody(SOCLE, 0);
  paintByNormal(g, { top: 'graphiteLo', bottom: 'graphiteLo', side: 'graphiteLo', bevelUp: 'graphite', bevelDown: 'graphiteLo' });
  const parts = [g, ...buildConnectors()];
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('machine: socle merge failed');
  return merged;
}

export class Machine {
  /** machineRoot : la parallaxe tourne ce groupe, jamais la camera */
  readonly root = new Group();
  readonly plateau = new Group();
  readonly pcb = new Group();
  readonly socle = new Group();
  readonly body: MeshStandardMaterial;
  readonly plate: Mesh;
  readonly base: Mesh;

  constructor(mobile: boolean) {
    this.root.name = 'machineRoot';
    this.plateau.name = 'plateauGroup';
    this.pcb.name = 'pcbGroup';
    this.socle.name = 'socleGroup';
    this.plateau.position.set(0, LAYERS.plateauY, 0);
    this.pcb.position.set(0, LAYERS.pcbY, 0);
    this.pcb.visible = false;
    this.socle.position.set(0, LAYERS.socleY, 0);
    this.root.add(this.plateau, this.pcb, this.socle);

    this.body = makeBodyMaterial();
    this.plate = new Mesh(buildPlate(), this.body);
    this.plate.name = 'plateau';
    this.plate.castShadow = true;
    this.plate.receiveShadow = true;
    this.base = new Mesh(buildSocle(), this.body);
    this.base.name = 'socle';
    // Mobile : seuls le plateau et les pads projettent (spec 4.3)
    this.base.castShadow = !mobile;
    this.base.receiveShadow = true;
    this.plateau.add(this.plate);
    this.socle.add(this.base);
  }

  dispose(): void {
    this.plate.geometry.dispose();
    this.base.geometry.dispose();
    this.body.dispose();
  }
}
