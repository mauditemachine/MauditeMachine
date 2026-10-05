/**
 * Materiaux partages et couleurs de sommets (spec 4.4 et 20.3). Les
 * couleurs de sommets sont ecrites dans l'espace lineaire de three (Color
 * convertit depuis le sRGB des constantes), multipliees par un gain cale
 * pour que la face rendue ait la teinte du brief (theme.ts GAIN).
 */

import { Color, Float32BufferAttribute, MeshStandardMaterial, type BufferGeometry, type Texture } from 'three';
import { ALBEDO_GAIN, COLOR, MATERIAL, gainOf, type Tone } from '../theme';

const tmp = new Color();

/**
 * Albedo lineaire d'une teinte de la palette (teinte affichee visee) : la
 * teinte lineaire x gain (l'ACES n'est pas lineaire : chaque materiau a le
 * sien, cale par lecture de pixels).
 */
export function albedo(tone: Tone, target: Color = tmp, gain: number = ALBEDO_GAIN): Color {
  return target.setHex(COLOR[tone]).multiplyScalar(gain);
}

/**
 * Emissif par instance (spec 4.4), que three n'a pas : un attribut
 * d'instance vec3 instanceEmissive ajoute au rayonnement emissif. Avec
 * `masked`, il est pondere par un attribut de sommet emissiveMask (le
 * dessus d'un pad s'allume, ses flancs moins) : le retroeclairage.
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

/**
 * Touche de caoutchouc a LED dedans (2026-10-05, Mika : "les boutons
 * poussoirs genre caoutchouc avec une LED interieure, la diffusion doit
 * etre de cette maniere") : l'emissif par instance, mais diffuse comme par
 * une LED sous le caoutchouc : plus fort au centre du dessus, qui s'etale
 * vers les bords, les flancs a peine (la matiere laisse passer un peu de
 * lumiere). Pour une geometrie unite (x et z de -0.5 a 0.5, dj/controls.ts
 * keyGeometry), mise a l'echelle par instance : la tache suit la forme de
 * la touche.
 */
export function withRubberLed<M extends MeshStandardMaterial>(m: M): M {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 instanceEmissive;\nvarying vec3 vInstanceEmissive;\nvarying vec2 vLedUv;\nvarying float vLedTop;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvInstanceEmissive = instanceEmissive;\n\tvLedUv = position.xz * 2.0;\n\tvLedTop = normal.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vInstanceEmissive;\nvarying vec2 vLedUv;\nvarying float vLedTop;')
      .replace(
        '#include <color_fragment>',
        [
          '#include <color_fragment>',
          '\tfloat ledR = length(vLedUv);',
          '\tfloat ledCore = 1.0 - smoothstep(0.0, 1.3, ledR);',
          '\tfloat ledTop = smoothstep(0.2, 0.95, vLedTop);',
          '\tfloat ledGlow = mix(0.3, 1.0, ledTop) * (0.4 + 0.95 * ledCore * ledCore);',
          // La ou la LED eclaire, la matiere prend sa couleur (sur un caoutchouc clair, la lumiere ne se perd pas dans le blanc)
          '\tfloat ledOn = clamp(max(vInstanceEmissive.r, max(vInstanceEmissive.g, vInstanceEmissive.b)) * ledGlow * 2.5, 0.0, 1.0);',
          '\tdiffuseColor.rgb *= 1.0 - 0.6 * ledOn;',
        ].join('\n')
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vInstanceEmissive * ledGlow;');
  };
  m.customProgramCacheKey = () => 'rubberLed';
  return m;
}

/** Chassis (coin, pieds, connectique) : couleurs de sommets, facettes franches, mat. */
export function makeChassisMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, flatShading: true, ...MATERIAL.chassis });
  m.name = 'chassis';
  return m;
}

/**
 * Panneau (brief) : aluminium anodise noir mat, roughness 0.62 et
 * metalness 0.35, le brossage en roughnessMap (fines lignes horizontales).
 */
export function makePanelMaterial(brush: Texture): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughnessMap: brush, ...MATERIAL.panel });
  m.name = 'panel';
  return m;
}

/**
 * Colore une geometrie NON indexee face par face d'apres sa normale (une
 * par face pour une extrusion) : pick(nx, ny, nz) choisit la teinte, son
 * gain la cale (theme.ts GAIN).
 */
export function paintFaces(g: BufferGeometry, pick: (nx: number, ny: number, nz: number) => Tone): void {
  const n = g.getAttribute('normal');
  const count = n.count;
  const col = new Float32Array(count * 3);
  for (let i = 0; i + 2 < count; i += 3) {
    const nx = (n.getX(i) + n.getX(i + 1) + n.getX(i + 2)) / 3;
    const ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
    const nz = (n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2)) / 3;
    const tone = pick(nx, ny, nz);
    albedo(tone, tmp, gainOf(tone));
    for (let k = 0; k < 3; k += 1) {
      const o = (i + k) * 3;
      col[o] = tmp.r;
      col[o + 1] = tmp.g;
      col[o + 2] = tmp.b;
    }
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
}

/** Une seule teinte pour toute la geometrie (gain de la teinte par defaut). */
export function paintSolid(g: BufferGeometry, tone: Tone, gain: number = gainOf(tone)): void {
  albedo(tone, tmp, gain);
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
