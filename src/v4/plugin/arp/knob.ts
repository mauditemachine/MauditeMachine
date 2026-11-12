/**
 * Le potard des couches HTML de la face du plugin MM-ARP (2026-11-12, Mika : "peut-etre que je preferais les knobs NOIRS,
 * mais au moins en 3D") : l'IMAGE du potard de la machine 3D (voyager/knobs.ts : la jupe, le flanc cannele, le dessus
 * bombe, noirs), rendue par la scene elle-meme, sous sa lumiere, a 2.8 px par px CSS, sans son index, puis detouree
 * (deux rendus sur deux fonds unis, l'alpha par difference : l'ombre portee vient avec). Le rack, le sequenceur et les
 * pages d'OPEN portent donc le meme potard que la machine, a la meme taille (42.4 px), avec le meme relief ; seul l'index
 * blanc est dessine en CSS (il tourne autour du centre du capuchon : INDEX).
 *
 * L'image se refait avec la sonde de developpement (window.__mmStage, ArpFace.tsx) quand la geometrie ou la lumiere du
 * potard changent : un potard normal du panneau, centre sur le milieu de sa silhouette, dans une boite de BOX px.
 */
import url from './knob.png';

export const KNOB = {
  url,
  /** la boite de l'image (px CSS) : le potard au milieu, son ombre autour */
  box: 80,
  /** le rayon de la jupe (px) : celui d'un potard normal de la machine (voyager/theme.ts SIZE_SCALE 0.92) */
  r: 21.2,
  /** le pied du potard (le centre de ses graduations) et le centre du capuchon (l'axe de l'index), sous le milieu de la silhouette */
  footY: -0.7,
  capY: 5.9,
  /** l'index : de r0 a r1 depuis le centre du capuchon, sa largeur (VOY_PLUGIN_KNOB.mark, a 74.5 px par unite) */
  index: { r0: 2.6, r1: 15.3, w: 3 },
  /** les graduations : de t0 a t1 depuis le pied (VOY_PLUGIN_SKIN.tick) */
  tick: { r0: 24.4, r1: 27.7 },
} as const;
