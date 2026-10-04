/**
 * Le sol (revision 2, spec 20.2.6) : un plan opaque de 120 x 120 a l'encre,
 * enfant du socle, qui recoit l'ombre de la lumiere cle. Un seul draw call,
 * aucune texture : son shader (ShadowMaterial retouche) calcule
 * - le halo : l'encre relevee vers haloHex au centre, exp(-(r / haloR)^2) ;
 * - l'ombre portee (opacite FLOOR.shadow) et l'ombre de contact autour de
 *   l'empreinte 14 x 9 du chassis en coin (coins de 0.1) ;
 * - un brouillard exponentiel carre 1 - exp(-(fog x r)^2) sur la distance
 *   r au centre de la machine, qui efface ombres et halo vers le bord.
 * Au-dela du halo le sol vaut exactement la couleur de fond : aucune ligne
 * d'horizon, meme a 18 deg d'elevation, et le bord du plan ne se voit pas.
 * Couleur lineaire, sans tone mapping, puis le chunk d'espace colorimetrique.
 *
 * Machine noire (2026-10-01, BACKDROP) : le canevas est transparent et la
 * page porte le granite de sonaa.ca. Le sol n'ecrit que son ombre, noire,
 * en alpha, sans halo (voir BACKDROP). La page compose en sRGB : l'alpha
 * est ramene a l'assombrissement lineaire d'avant.
 */

import { Color, Mesh, PlaneGeometry, ShadowMaterial, Vector3 } from 'three';
import { DJ_UNIT, DJ_W } from '../dj/theme';
import { DJ, VOYAGER } from '../state/focus';
import { BACKDROP, COLOR, FLOOR } from '../theme';
import { VOY_BODY } from '../voyager/theme';

const glf = (v: number): string => v.toFixed(6);
const vec3 = (c: Color): string => `vec3(${glf(c.r)}, ${glf(c.g)}, ${glf(c.b)})`;

/** Le motif de ShadowMaterial remplace (three 0.186, shadow.glsl.js). */
const SHADOW_LINE = 'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );';

/**
 * Deux machines (2026-10-03) : une ombre de contact par machine (le
 * MM-VOYAGER a droite, ses cotes), et le brouillard mesure depuis le
 * centre de la machine visible la plus proche ; uOn (808, Voyager) les
 * allume, uX porte leur abscisse (la machine voisine se pousse au bord de
 * l'ecran, ui : le bout qui depasse, 2026-10-03) ;
 * allume : une machine cachee n'a plus d'ombre au sol.
 */
function makeMaterial(on: { value: Vector3 }, xs: { value: Vector3 }): ShadowMaterial {
  // Lineaires : Color convertit les hex sRGB de la palette
  const ink = new Color(COLOR.ink);
  const halo = new Color(FLOOR.haloHex).sub(ink);
  const c = FLOOR.contact;
  const m = new ShadowMaterial({ opacity: FLOOR.shadow });
  m.name = 'floor';
  // Opaque : il ecrit la profondeur et remplace le fond sous la machine
  m.transparent = false;
  m.depthWrite = true;
  m.toneMapped = false;
  /** Ombre de contact d'une empreinte w x d centree en (cx, 0). */
  const box = (name: string, cx: string, w: number, d: number): string => `
float ${name}(vec2 p) {
  vec2 q = abs(p - vec2(${cx}, 0.0)) - vec2(${glf(w / 2 - c.radius)}, ${glf(d / 2 - c.radius)});
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${glf(c.radius)};
  return ${glf(c.opacity)} * (1.0 - smoothstep(0.0, ${glf(c.falloff)}, d));
}`;
  const fn = `
varying vec2 vFloor;
uniform vec3 uOn;
uniform vec3 uX;
float v4Contact(vec2 p) {
  vec2 q = abs(p) - vec2(${glf(c.halfW - c.radius)}, ${glf(c.halfD - c.radius)});
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${glf(c.radius)};
  return ${glf(c.opacity)} * (1.0 - smoothstep(0.0, ${glf(c.falloff)}, d));
}${VOYAGER ? box('v4ContactVoy', 'uX.y', VOY_BODY.w, VOY_BODY.d) : ''}${DJ ? box('v4ContactDj', 'uX.z', DJ_W, DJ_UNIT.d) : ''}`;
  // Une machine cachee (uOn a 0) n'a ni ombre ni brouillard : sa distance vaut 1e4
  const far = (k: string): string => `mix(1.0e4, length(vFloor - vec2(uX.${k}, 0.0)), step(0.5, uOn.${k}))`;
  let contact = 'v4Contact(vFloor)';
  let radius = 'length(vFloor)';
  if (VOYAGER) {
    contact = 'max(v4Contact(vFloor - vec2(uX.x, 0.0)) * uOn.x, v4ContactVoy(vFloor) * uOn.y)';
    radius = `min(${far('x')}, ${far('y')})`;
  }
  if (DJ) {
    contact = `max(${contact}, v4ContactDj(vFloor) * uOn.z)`;
    // Le brouillard de l'ensemble DJ se mesure depuis son bord le plus proche (il est large)
    radius = `min(${radius}, mix(1.0e4, max(0.0, abs(vFloor.x - uX.z) - ${glf(DJ_W / 2 - 4)}) + length(vec2(0.0, vFloor.y)), step(0.5, uOn.z)))`;
  }
  const out = BACKDROP.transparent
    ? `gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - pow(1.0 - a, 0.4545));`
    : `vec3 base = ${vec3(ink)} + ${vec3(halo)} * exp(-hr * hr);
	gl_FragColor = vec4(base * (1.0 - a), 1.0);`;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uOn = on;
    shader.uniforms.uX = xs;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFloor;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvFloor = position.xz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>${fn}`).replace(
      SHADOW_LINE,
      `float r = ${radius};
	float fr = ${glf(FLOOR.fog)} * r;
	float hr = r / ${glf(FLOOR.haloR)};
	float a = max(opacity * (1.0 - getShadowMask()), ${contact}) * exp(-fr * fr);
	${out}`
    );
  };
  m.customProgramCacheKey = () => `${BACKDROP.transparent ? 'v4FloorClear' : 'v4Floor'}${DJ ? '3' : VOYAGER ? '2' : '1'}`;
  return m;
}

export class Floor {
  readonly mesh: Mesh;
  private material: ShadowMaterial;
  /** ombre de contact et brouillard : la 808, le MM-VOYAGER, le MM-DECKS (1 visible, 0 cachee) */
  private on = { value: new Vector3(1, VOYAGER ? 1 : 0, DJ ? 1 : 0) };
  /** abscisses des machines (la 808 a 0, les autres chez elles) */
  private xs = { value: new Vector3(0, 0, 0) };

  /** Les machines ont bouge (le bout qui depasse) ; true si ca change. */
  setCenters(x808: number, xVoy: number, xDj = 0): boolean {
    const v = this.xs.value;
    if (v.x === x808 && v.y === xVoy && v.z === xDj) return false;
    v.set(x808, xVoy, xDj);
    return true;
  }

  /** Les machines visibles ; true si ca change (une frame). */
  setMachines(mm808: boolean, voy: boolean, dj = false): boolean {
    const v = this.on.value;
    const x = mm808 ? 1 : 0;
    const y = voy && VOYAGER ? 1 : 0;
    const z = dj && DJ ? 1 : 0;
    if (v.x === x && v.y === y && v.z === z) return false;
    v.set(x, y, z);
    return true;
  }

  constructor() {
    const g = new PlaneGeometry(FLOOR.size, FLOOR.size);
    // A plat, face vers le haut ; position.xz = le repere du socle (centre de la machine)
    g.rotateX(-Math.PI / 2);
    g.deleteAttribute('uv');
    this.material = makeMaterial(this.on, this.xs);
    this.mesh = new Mesh(g, this.material);
    this.mesh.name = 'floor';
    this.mesh.position.y = FLOOR.y;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
