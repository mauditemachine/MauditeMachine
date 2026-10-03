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

import { Color, Mesh, PlaneGeometry, ShadowMaterial, Vector2 } from 'three';
import { VOYAGER } from '../state/focus';
import { BACKDROP, COLOR, FLOOR } from '../theme';
import { VOY_BODY, VOY_X } from '../voyager/theme';

const glf = (v: number): string => v.toFixed(6);
const vec3 = (c: Color): string => `vec3(${glf(c.r)}, ${glf(c.g)}, ${glf(c.b)})`;

/** Le motif de ShadowMaterial remplace (three 0.186, shadow.glsl.js). */
const SHADOW_LINE = 'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );';

/**
 * Deux machines (2026-10-03) : une ombre de contact par machine (le
 * MM-VOYAGER a droite, ses cotes), et le brouillard mesure depuis le
 * centre de la machine visible la plus proche ; uOn (808, Voyager) les
 * allume : une machine cachee n'a plus d'ombre au sol.
 */
function makeMaterial(on: { value: Vector2 }): ShadowMaterial {
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
  const voy = VOYAGER
    ? `
float v4ContactVoy(vec2 p) {
  vec2 q = abs(p - vec2(${glf(VOY_X)}, 0.0)) - vec2(${glf(VOY_BODY.w / 2 - c.radius)}, ${glf(VOY_BODY.d / 2 - c.radius)});
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${glf(c.radius)};
  return ${glf(c.opacity)} * (1.0 - smoothstep(0.0, ${glf(c.falloff)}, d));
}`
    : '';
  const fn = `
varying vec2 vFloor;
uniform vec2 uOn;
float v4Contact(vec2 p) {
  vec2 q = abs(p) - vec2(${glf(c.halfW - c.radius)}, ${glf(c.halfD - c.radius)});
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${glf(c.radius)};
  return ${glf(c.opacity)} * (1.0 - smoothstep(0.0, ${glf(c.falloff)}, d));
}${voy}`;
  const contact = VOYAGER ? 'max(v4Contact(vFloor) * uOn.x, v4ContactVoy(vFloor) * uOn.y)' : 'v4Contact(vFloor)';
  const radius = VOYAGER
    ? `min(mix(1.0e4, length(vFloor), step(0.5, uOn.x)), mix(1.0e4, length(vFloor - vec2(${glf(VOY_X)}, 0.0)), step(0.5, uOn.y)))`
    : 'length(vFloor)';
  const out = BACKDROP.transparent
    ? `gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - pow(1.0 - a, 0.4545));`
    : `vec3 base = ${vec3(ink)} + ${vec3(halo)} * exp(-hr * hr);
	gl_FragColor = vec4(base * (1.0 - a), 1.0);`;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uOn = on;
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
  m.customProgramCacheKey = () => `${BACKDROP.transparent ? 'v4FloorClear' : 'v4Floor'}${VOYAGER ? '2' : '1'}`;
  return m;
}

export class Floor {
  readonly mesh: Mesh;
  private material: ShadowMaterial;
  /** ombre de contact et brouillard : la 808, le MM-VOYAGER (1 visible, 0 cachee) */
  private on = { value: new Vector2(1, VOYAGER ? 1 : 0) };

  /** Les machines visibles ; true si ca change (une frame). */
  setMachines(mm808: boolean, voy: boolean): boolean {
    const v = this.on.value;
    const x = mm808 ? 1 : 0;
    const y = voy && VOYAGER ? 1 : 0;
    if (v.x === x && v.y === y) return false;
    v.set(x, y);
    return true;
  }

  constructor() {
    const g = new PlaneGeometry(FLOOR.size, FLOOR.size);
    // A plat, face vers le haut ; position.xz = le repere du socle (centre de la machine)
    g.rotateX(-Math.PI / 2);
    g.deleteAttribute('uv');
    this.material = makeMaterial(this.on);
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
