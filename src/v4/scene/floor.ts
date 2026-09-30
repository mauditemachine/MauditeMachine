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
 */

import { Color, Mesh, PlaneGeometry, ShadowMaterial } from 'three';
import { COLOR, FLOOR } from '../theme';

const glf = (v: number): string => v.toFixed(6);
const vec3 = (c: Color): string => `vec3(${glf(c.r)}, ${glf(c.g)}, ${glf(c.b)})`;

/** Le motif de ShadowMaterial remplace (three 0.186, shadow.glsl.js). */
const SHADOW_LINE = 'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );';

function makeMaterial(): ShadowMaterial {
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
  const fn = `
varying vec2 vFloor;
float v4Contact(vec2 p) {
  vec2 q = abs(p) - vec2(${glf(c.halfW - c.radius)}, ${glf(c.halfD - c.radius)});
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${glf(c.radius)};
  return ${glf(c.opacity)} * (1.0 - smoothstep(0.0, ${glf(c.falloff)}, d));
}`;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFloor;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvFloor = position.xz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>${fn}`).replace(
      SHADOW_LINE,
      `float r = length(vFloor);
	float fr = ${glf(FLOOR.fog)} * r;
	float hr = r / ${glf(FLOOR.haloR)};
	float a = max(opacity * (1.0 - getShadowMask()), v4Contact(vFloor)) * exp(-fr * fr);
	vec3 base = ${vec3(ink)} + ${vec3(halo)} * exp(-hr * hr);
	gl_FragColor = vec4(base * (1.0 - a), 1.0);`
    );
  };
  m.customProgramCacheKey = () => 'v4Floor';
  return m;
}

export class Floor {
  readonly mesh: Mesh;
  private material: ShadowMaterial;

  constructor() {
    const g = new PlaneGeometry(FLOOR.size, FLOOR.size);
    // A plat, face vers le haut ; position.xz = le repere du socle (centre de la machine)
    g.rotateX(-Math.PI / 2);
    g.deleteAttribute('uv');
    this.material = makeMaterial();
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
