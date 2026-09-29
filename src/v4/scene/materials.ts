/**
 * Materiaux partages et couleurs de sommets (spec 4.4). Les couleurs de
 * sommets sont ecrites dans l'espace lineaire de three (Color convertit
 * depuis le sRGB des constantes), multipliees par ALBEDO_GAIN pour que la
 * face rendue ait la teinte du brief (voir theme.ts).
 */

import { Color, Float32BufferAttribute, MeshStandardMaterial, type BufferGeometry, type ShadowMaterial } from 'three';
import { ALBEDO_GAIN, COLOR, CONTACT_SHADOW, type Tone } from '../theme';

const tmp = new Color();

/**
 * Albedo lineaire d'une teinte de la palette (teinte affichee visee). Le
 * gain depend de la luminance : l'ACES n'est pas lineaire, un dessus plus
 * clair que le graphite demande moins que x 3 (voir PAD_TOP_GAIN).
 */
export function albedo(tone: Tone, target: Color = tmp, gain: number = ALBEDO_GAIN): Color {
  return target.setHex(COLOR[tone]).multiplyScalar(gain);
}

/**
 * Emissif par instance (spec 4.4), que three n'a pas : un attribut
 * d'instance vec3 instanceEmissive ajoute au rayonnement emissif. Avec
 * `masked`, il est pondere par un attribut de sommet emissiveMask (1 sur la
 * face superieure d'un pad, 0 sur ses flancs) : seul le dessus s'allume.
 */
export function withInstanceEmissive<M extends MeshStandardMaterial>(m: M, masked: boolean): M {
  const mask = masked ? ' * emissiveMask' : '';
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nattribute vec3 instanceEmissive;\n${masked ? 'attribute float emissiveMask;\n' : ''}varying vec3 vInstanceEmissive;`
      )
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n\tvInstanceEmissive = instanceEmissive${mask};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vInstanceEmissive;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vInstanceEmissive;');
  };
  // Un programme par variante, pas un par materiau
  m.customProgramCacheKey = () => (masked ? 'instEmissiveMasked' : 'instEmissive');
  return m;
}

const glf = (v: number): string => v.toFixed(4);

/**
 * Ombre de contact sur le plan d'ombre (theme.ts CONTACT_SHADOW) : le
 * ShadowMaterial garde son ombre portee et prend le max avec un
 * assombrissement calcule depuis la position du fragment dans le repere du
 * socle (distance a son empreinte arrondie). Aucune texture, aucun draw
 * call ; le plan etant enfant du socle, l'ombre descend avec lui (OPEN).
 */
export function withContactShadow<M extends ShadowMaterial>(m: M): M {
  const c = CONTACT_SHADOW;
  const fn = `
varying vec2 vContact;
float v4Contact(vec2 p) {
  vec2 q = abs(p) - vec2(${glf(c.halfW - c.radius)}, ${glf(c.halfD - c.radius)});
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${glf(c.radius)};
  return ${glf(c.opacity)} * (1.0 - smoothstep(0.0, ${glf(c.falloff)}, d));
}`;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vContact;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvContact = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${fn}`)
      .replace(
        'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',
        'gl_FragColor = vec4( color, max( opacity * ( 1.0 - getShadowMask() ), v4Contact( vContact ) ) );'
      );
  };
  m.customProgramCacheKey = () => 'v4Contact';
  return m;
}

/** Corps (plateau, socle) : couleurs de sommets, facettes franches. */
export function makeBodyMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7, metalness: 0 });
  m.name = 'body';
  return m;
}

/** Une teinte par face selon sa pente (voir BodyTones). */
export interface BodyTones {
  top: Tone;
  bottom: Tone;
  side: Tone;
  /** chanfrein tourne vers le haut : la bande claire */
  bevelUp: Tone;
  /** chanfrein tourne vers le bas : dans l'ombre */
  bevelDown: Tone;
}

/**
 * Colore une geometrie NON indexee face par face d'apres la normale de la
 * face (ExtrudeGeometry en donne une par face). Le dessus plat est a ny = 1
 * exactement ; la facette interieure du chanfrein a ny = 0.97, d'ou le
 * seuil a 0.995 et non 0.97 : toute la bande de 0.3 prend graphiteHi.
 */
export function paintByNormal(g: BufferGeometry, tones: BodyTones): void {
  const n = g.getAttribute('normal');
  const count = n.count;
  const col = new Float32Array(count * 3);
  for (let i = 0; i + 2 < count; i += 3) {
    const ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
    const tone =
      ny > 0.995
        ? tones.top
        : ny < -0.995
          ? tones.bottom
          : Math.abs(ny) < 0.15
            ? tones.side
            : ny > 0
              ? tones.bevelUp
              : tones.bevelDown;
    albedo(tone);
    for (let k = 0; k < 3; k += 1) {
      const o = (i + k) * 3;
      col[o] = tmp.r;
      col[o + 1] = tmp.g;
      col[o + 2] = tmp.b;
    }
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
}

/** Une seule teinte pour toute la geometrie. */
export function paintSolid(g: BufferGeometry, tone: Tone): void {
  albedo(tone);
  paintLinear(g, [tmp.r, tmp.g, tmp.b]);
}

/** Une couleur lineaire deja calee (theme.ts LIT) pour toute la geometrie. */
export function paintLinear(g: BufferGeometry, rgb: readonly number[]): void {
  const count = g.getAttribute('position').count;
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    col[i * 3] = rgb[0];
    col[i * 3 + 1] = rgb[1];
    col[i * 3 + 2] = rgb[2];
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
}

/** Albedo lineaire d'une teinte x gain, en triplet (couleurs de sommets des composants). */
export function albedoRgb(tone: Tone, gain: number): [number, number, number] {
  albedo(tone, tmp, gain);
  return [tmp.r, tmp.g, tmp.b];
}

/**
 * Couleur CSS a peindre dans une texture eclairee pour que la face rendue
 * ait la teinte visee (meme calage que les couleurs de sommets) : teinte
 * lineaire x gain, reencodee en sRGB, bornee a 1 par canal.
 */
export function litCss(tone: Tone, gain: number | readonly [number, number, number]): string {
  if (typeof gain === 'number') albedo(tone, tmp, gain);
  else {
    // Gain par canal : la lumiere chaude mange le bleu des teintes froides
    tmp.setHex(COLOR[tone]);
    tmp.setRGB(tmp.r * gain[0], tmp.g * gain[1], tmp.b * gain[2]);
  }
  return `#${tmp.getHexString()}`;
}
