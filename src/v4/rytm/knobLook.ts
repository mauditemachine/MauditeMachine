/**
 * Le potard du plugin, d'apres la photo de Mika (2026-11-11). D'abord : "mets ce type de knob, mais le dessus en chrome
 * fonce" ; puis, devant le chrome fonce : "fais-les chrome alors, les boutons exactement comme sur l'image". Tout ce qui
 * suit est mesure sur la photo (agrandie, autour du centre du capuchon), en part du rayon de la base et en gris 0 a 255.
 * Un module sans import : la face 3D (scene/encoders.ts) et les petits potards d'OPEN (ui/KnobPanel.tsx) dessinent le meme.
 *
 * De dehors en dedans :
 * - la base ronde et lisse (rayon 1) : presque noire (26), un large reflet en haut a gauche (jusqu'a 124, vers 11 h) ;
 * - la prise a six lobes : 0.85 aux lobes, 0.74 aux encoches, gris tres sombre (38), un lobe sous le repere ;
 * - le capuchon de metal brosse : 0.62 ; deux reflets satures opposes (10 h 20, large ; 4 h 40, etroit), deux bandes
 *   sombres en travers (90), deux filets faibles (6 h 40 et 1 h 40) ;
 * - le repere blanc epais (215), du bord du capuchon a 0.95, large de 0.13.
 */
export const KNOB_LOOK = { lobes: 6, lobe: 0.85, notch: 0.74, cap: 0.62, markEnd: 0.95, markW: 0.13 } as const;

const D2R = Math.PI / 180;
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const bell = (a: number, c: number, w: number): number => Math.exp(-Math.pow(wrap(a - c * D2R) / (w * D2R), 2));

/**
 * Le gris du dessus du capuchon (0 a 255) a l'angle a (rad ; 0 a droite, 90 deg vers le bas de l'image). Le chrome de la
 * photo : le fond 104 +/- 14 (clair dans l'axe des reflets, 90 en travers), les deux reflets satures (50 deg, etroit ;
 * 230 deg, large), deux filets (107 et 310 deg).
 */
export function capGrey(a: number): number {
  const g = 104 + 14 * Math.cos(2 * (a - 50 * D2R)) + 300 * bell(a, 50, 13) + 300 * bell(a, 230, 17.8) + 30 * bell(a, 107, 9) + 28 * bell(a, 310, 8);
  return Math.min(255, g);
}

/** Le gris du dessus de la base a l'angle a : presque noir, son large reflet en haut a gauche (235 deg). */
export function baseGrey(a: number): number {
  return 28 + 98 * bell(a, 235, 38);
}

/** Le rayon de la prise (en part du rayon de la base) a l'angle a compte depuis le repere : un lobe sous lui, six en tout. */
export function gripRadius(a: number): number {
  return KNOB_LOOK.lobe - (KNOB_LOOK.lobe - KNOB_LOOK.notch) * Math.pow(0.5 - 0.5 * Math.cos(a * KNOB_LOOK.lobes), 3);
}

/** Un bruit fixe par secteur (les stries du metal brosse) : -1 a 1. */
export function streak(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}
