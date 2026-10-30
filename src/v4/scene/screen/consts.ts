/**
 * L'ecran du MM-RYTM : les constantes, la grille d'unites, les palettes et les aides de haut de fichier (P0, 2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), deplacees telles quelles de scene/screen.ts. scene/screen.ts re-exporte ce qui
 * l'etait (PRESET_LAYOUT, presetKeySpot, INFO_KEY, blockSpot, infoKeySpot).
 */

import { familyOf, kit } from '../../audio/kit';
import { pattern } from '../../audio/pattern';
import { dialRange, dialShown, dialUnit, dialValueText, stepWrites, type DialId } from '../../actions';
import type { ShotId } from '../../audio/shotsdsp';
import { BROWSER_ROWS } from '../../state/lcdSamples';
import { voices } from '../../state/voices';
import { dtFace } from '../../state/dtFace';
import { DT_FACE, FONT_DISPLAY, HEX, OLED, OLED_DY, OLED_UH, PORTRAIT, SCREEN_TOUCH, type EncId, type Inst } from '../../theme';
import { PRESET_SLOTS } from '../../state/presetMode';
import { softKeyPitchU, softKeyU } from '../../rytm/presetKeys';
import { pageLabel, type RytmPageId, type RytmScreenId, type SlotCell } from '../../rytm/pages';

/** Au plus un redessin tous les 60 ms (un potard tourne a la cadence du pointeur). */
export const MIN_GAP_MS = 60;
/** Les animations courtes : une image tous les 50 ms. */
export const ANIM_MS = 50;
/** L'aiguille du COMP sur sa page (2026-10-18) : une image toutes les 50 ms tant qu'elle bouge. */
export const METER_MS = 50;
export const BLINK_MS = 600;
/** Un coup qui sonne : il pulse PULSE_MS. */
export const PULSE_MS = 260;
/** La vague du repos : apres IDLE_MS sans rien, WAVE_MS de vague (desktop). */
export const IDLE_MS = 15000;
export const WAVE_MS = 7000;

/**
 * La mise en page, en unites : 320 de large ; 120 de haut au desktop, 158 au
 * telephone depuis le 2026-10-09 (theme.ts OLED_UH, Mika : "forcement
 * donne-moi un ecran plus grand") : la vue PAGE y a sa mise en page haute
 * (TALL : des blocs de 52.5 au lieu de 37, de plus gros corps, un pied de 26),
 * les autres vues (HOME, EDIT, les presets) gardent leur dessin de 120,
 * centre (OLED_DY). Le desktop aussi depuis le 2026-10-18 (Mika : "RYTM je
 * voudrais un ecran plus grand") : le meme dessin haut sur un verre plus grand
 * (theme.ts OLED, 5.3 x 2.617) ; ce qui tient au doigt reste au telephone
 * (PORTRAIT : les lignes du navigateur, SB), le reste suit TALL.
 * La face V.4.0 du desktop (2026-10-27, Mika : "ecran 4.3 pouces 800 x 480") :
 * 320 x 192 unites (5:3, la dalle de la machine), une toile de 1600 x 960 (deux
 * fois la dalle) ; les 34 unites de plus (GROW) vont aux blocs de la vue PAGE
 * (72 x 69.5), a leur dessin et aux neuf lignes du navigateur des sons ; HOME,
 * EDIT et les presets restent centres (DY 36), le pied et l'en-tete suivent UH.
 */
export const UW = 320;
export const UH = OLED_UH;
export const TALL = UH > 120;
export const DY = OLED_DY;
/**
 * La hauteur gagnee par l'ecran 5:3 du desktop V.4.0 (2026-10-27, Mika : "ecran 4.3 pouces 800 x 480") : 320 x 192
 * unites au lieu de 320 x 158, 34 unites de plus ; 0 au telephone. Les blocs de la vue PAGE et les lignes du navigateur
 * des sons la prennent ; le reste (l'en-tete, le pied, HOME centre par DY) suit deja UH.
 */
export const GROW = UH - 158;

/**
 * La touche i (R4, 2026-10-08), en unites : son centre, dans le coin en haut
 * a droite, et son rayon dessine ; hit : le rayon de sa zone de saisie (au
 * telephone 26 unites, 45 px CSS a 390 x 844 : le contrat veut 44 ; elle mord
 * le tempo de l'en-tete, qui ouvre les presets). INFOS allume, les blocs de
 * la vue PAGE ont leur zone (lcd-blk) : au telephone, sa zone se centre alors
 * sur le coin du verre (blocks, revue de R4 : elle mordait le coin du bloc D,
 * de 236 a 308 sur 24 a 61), toujours aussi large et le i dedans.
 * scene/renderer.ts pose la zone lcd-i avec.
 */
/**
 * Le mode presets (2026-10-27, la V.4.2), en unites, sur toute la hauteur de l'ecran : la ligne du titre (head), les
 * trois lignes de la liste (avant, le curseur, apres), le nom en cours et son aide (sub, hint), et la rangee des cinq
 * touches (keyY, son centre ; keyH, la hauteur d'une pastille). Au desktop les pastilles sont au-dessus des touches de la
 * face qu'elles nomment (rytm/presetKeys.ts) ; au telephone, en cinquiemes, assez grandes pour le doigt.
 */
export const PRESET_LAYOUT = PORTRAIT
  ? { head: 17, rows: [44, 74, 99], sub: 99, hint: 112, keyY: 133, keyH: 20, keyFont: 9.5 }
  : { head: 20, rows: [56, 92, 122], sub: 122, hint: 142, keyY: 172, keyH: 16, keyFont: 8 };

/**
 * Ou est la touche i (0 a 4, PRESET_SLOTS) du mode presets sur la largeur de l'ecran, de 0 a 1 : son centre et sa zone.
 * Au desktop, au-dessus de la touche de la face qu'elle nomme ; au telephone, le cinquieme de la largeur.
 */
export function presetKeySpot(i: number, mobile: boolean = PORTRAIT): { u: number; u0: number; u1: number } {
  if (mobile) return { u: (i + 0.5) / 5, u0: i / 5, u1: (i + 1) / 5 };
  const u = softKeyU(PRESET_SLOTS[i]);
  const half = softKeyPitchU() / 2;
  return { u, u0: Math.max(0, u - half), u1: Math.min(1, u + half) };
}

export const INFO_KEY = { x: UW - 8, y: 10.5, r: { desk: 5.2, phone: 6.6 }, hit: { desk: 8, phone: 26 }, blocks: { x: UW, y: 0 } } as const;

/**
 * Le bloc k de la vue PAGE sur le verre (u, v de 0 a 1) : INFOS allume, sa
 * zone (lcd-blk-<k>, scene/renderer.ts) montre la carte de son encodeur au
 * survol ou au toucher (R4 : on regarde l'ecran, pas le potard).
 */
export function blockSpot(k: number): { u0: number; u1: number; v0: number; v1: number } {
  const x = MATRIX.x0 + MATRIX.pitch * (k % 4);
  const y = MATRIX.rows[k >> 2];
  return { u0: x / UW, u1: (x + MATRIX.w) / UW, v0: y / UH, v1: (y + MATRIX.h) / UH };
}

/**
 * La zone de la touche i sur le verre : son centre (u, v de 0 a 1) et son
 * rayon en part de la largeur de l'ecran ; blocks : les blocs ont leur zone
 * (au telephone, elle s'ecarte du bloc D ; au desktop, elle ne le touche pas).
 */
export const infoKeySpot = (mobile: boolean, blocks = false): { u: number; v: number; r: number } => {
  const away = mobile && blocks;
  return {
    u: (away ? INFO_KEY.blocks.x : INFO_KEY.x) / UW,
    v: (away ? INFO_KEY.blocks.y : INFO_KEY.y) / UH,
    r: (mobile ? INFO_KEY.hit.phone : INFO_KEY.hit.desk) / UW,
  };
};
/**
 * 2026-10-22 (audit SB-02, RS-11) : au telephone, les zones de saisie de l'en-tete (les onglets, MASTER et TEMPO, PREV et
 * NEXT du navigateur) montent de tant d'unites au-dessus du verre (22 px a 390 de large ; rien a toucher sur cette
 * bordure) : 40 px de haut au lieu de 20. La zone n'a pas a egaler le dessin.
 */
export const HEAD_HIT_UP = 24;

/** Les coordonnees de texture du reste du site (theme OLED.tex, 640 x 240) : deux par unite. */
export const TEX_K = OLED.tex[0] / UW;

/** L'os, et ses deux intensites eteintes (sur le noir de l'OLED). */
export const INK: string = HEX.bone;
export const HALF: string = 'rgba(246, 241, 231, 0.5)';
export const FAINT: string = 'rgba(246, 241, 231, 0.2)';
/**
 * 2026-10-22 (audit SB-07) : le texte a peine (onglets inactifs, aides, PICK A VOICE), 0.4 soit plus de 3:1 sur le noir ;
 * FAINT (0.2, 1.65:1) reste aux filets, cadres et decors : l'onglet SYNTH ou GLOBAL ne disparaissait plus en 3D.
 */
export const FAINT_TEXT: string = 'rgba(246, 241, 231, 0.4)';
export const BLACK: string = HEX.oled;
/** Le cadre d'un bloc de la vue PAGE : a peine (un reglage a venir, encore moins). */
export const FRAME: string = 'rgba(246, 241, 231, 0.14)';
export const FRAME_DIM: string = 'rgba(246, 241, 231, 0.07)';

/**
 * La palette des dessins (2026-10-08) : la normale (l'os sur le noir), ou la
 * negative d'un bloc verrouille (le noir sur l'os plein) ; bg : le fond.
 */
export interface Pal {
  ink: string;
  half: string;
  faint: string;
  /** le texte a peine (2026-10-22, FAINT_TEXT) */
  faintText: string;
  bg: string;
}
export const PAL: Pal = { ink: INK, half: HALF, faint: FAINT, faintText: FAINT_TEXT, bg: BLACK };
export const PAL_NEG: Pal = { ink: BLACK, half: 'rgba(0, 0, 0, 0.58)', faint: 'rgba(0, 0, 0, 0.24)', faintText: 'rgba(0, 0, 0, 0.42)', bg: INK };

/** L'anneau des pas : son centre, son rayon ; la colonne de droite. */
export const RING = { cx: 60, cy: 60, r: 47 } as const;
export const COL = { x0: 124, x1: 314 } as const;
/** Les trois reglages : la zone de leur image, leur nom, leur valeur. */
export const CARD = { y0: 30, y1: 64, label: 74, value: 90, gap: 8 } as const;
/** La ligne du bas (message, piste). */
export const LINE = { y: 110 } as const;
/**
 * Le menu de HOME au telephone (2026-10-22, audit SB-02) : ses zones montent jusque sous les valeurs des cartes (dans le
 * dessin de 120 : le haut de l'ecran est a DY), 39 px de haut au lieu de 14 ; lcd-open (les presets) s'arrete plus haut,
 * a la bande de la piste (theme.ts OLED_BAR), et la touche de page sous le verre ne prend plus une tape un peu basse.
 */
export const MENU_HIT_TOP = CARD.value + 6;
/** La largeur d'une carte de HOME ((190 - 2 x 8) / 3) : les images des blocs, plus petites, s'y rapportent. */
export const CARD_W = 58;

/** Une zone de dessin, en unites. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** La place du panneau des verrous dans la matrice : sa premiere colonne, combien, sa premiere rangee, combien. */
export interface PanelArea {
  c0: number;
  n: number;
  r0: number;
  rows: number;
}

/*
 * La vue PAGE (2026-10-08) : huit blocs de 72 x 37 en 2 x 4, les centres des
 * colonnes (44, 120, 196, 272) au-dessus des potards de page ; dans un bloc
 * le nom et la lettre du potard en haut, la valeur en grand (16, puis 13, 11
 * et 9 pour tenir), la ligne d'unite dessous, l'image a droite de la
 * valeur, l'etiquette ALL ou NO BD au bout de la ligne d'unite.
 */
/*
 * Au telephone (TALL, 2026-10-09) : des blocs de 72 x 52.5 (37 avant), 44 px
 * de haut a 390 x 844, assez pour un doigt (ils sont les potards de page) ;
 * la valeur plus grande, l'image un peu plus petite a sa droite. Les deux
 * rangees a 3 l'une de l'autre (4 avant la revue du meme jour : le pied y
 * gagne sa place, 132 a 158).
 */
// L'ecran 5:3 du desktop (2026-10-27) : les blocs prennent les 34 unites de plus, moitie chacun (72 x 69.5, la grille finit a UH - 26)
export const MATRIX: { x0: number; pitch: number; w: number; h: number; rows: readonly [number, number]; r: number } = TALL
  ? { x0: 8, pitch: 76, w: 72, h: 52.5 + GROW / 2, rows: [24, 24 + 52.5 + GROW / 2 + 3], r: 4.5 }
  : { x0: 8, pitch: 76, w: 72, h: 37, rows: [24, 63], r: 3.5 };
// valueW au telephone 39 (revue du 2026-10-09 : 127 touchait le dessin a 42 ; a trois chiffres la valeur prend le corps d'en dessous).
// L'ecran 5:3 (la revue du 2026-10-27) : le bas du dessin a 37 + 0.3 GROW (47.2), l'air du telephone au-dessus de la
// ligne d'unite (57.5) ; a 0.6 GROW il descendait jusqu'a elle, sur FROM TOP, BOTH et l'unite de MIX
export const BLOCK: { padX: number; valueW: number; draw: { dx0: number; dx1: number; dy0: number; dy1: number } } = TALL
  ? { padX: 6, valueW: 39, draw: { dx0: 49, dx1: 67, dy0: 20 + GROW * 0.2, dy1: 37 + GROW * 0.3 } }
  : {
      padX: 5,
      /** la largeur de la valeur avant l'image */
      valueW: 34,
      draw: { dx0: 42, dx1: 67, dy0: 13, dy1: 29 },
    };
/**
 * Les corps de la vue PAGE (2026-10-08, revue de R1, Mika : "plus gros, plus
 * de detail ; super responsive en mobile") : l'ecran fait 465 px de large au
 * desktop (1.45 px l'unite) et 280 px au telephone (0.88 px l'unite) ; au
 * telephone le nom a 10 et l'unite a 8.6 (7.5 a 8.5 px a l'ecran ; 6.5 et
 * 5.5 n'y faisaient pas 5 px), la valeur a 17 ; ni lettre de potard dans le bloc
 * (elle est imprimee a cote du potard), ni crans au bout de l'unite, ni les
 * six onglets du pied (la touche allumee et la pastille de l'en-tete disent
 * la page) : la place va au texte.
 */
export const BLOCK_TYPE = {
  desk: {
    nameSize: 7,
    letterSize: 5.5,
    unitSize: 6,
    /** l'etiquette d'un bloc (BOTH, MACHINE, NO BD...) : sa place (le bout de la ligne du nom ou de l'unite) et son corps */
    tagAt: 'name' as 'name' | 'unit',
    tagSize: 5.2,
    valueSizes: [17, 14, 12, 10],
    nameDy: 9.5,
    valueDy: 27.5,
    unitDy: 34.6,
    letters: true,
    notchRow: true,
    /*
     * Plus d'onglets au pied depuis la revue du 2026-10-09 : les six touches de
     * page sont juste sous le verre, sur sa largeur (Mika : "TRIG, je veux ces
     * boutons en dessous de l'ecran") ; leurs six noms repetes dans le pied, sur
     * sa droite seulement, ne tombaient sur aucune touche. Le pied dit ce que
     * dit celui du telephone (le pas verrouille qui joue, le geste des verrous).
     * Le dessin et les zones des onglets (lcd-tab-*) restent : tabs les rallume.
     */
    tabs: false,
    tabSize: 6.5,
    foot: 8,
    head: { pill: 7.5, pillH: 12, voice: 12, sound: 7.5, bpm: 6.5, num: 12 },
    selR: 0.9,
    /** le panneau des verrous : son corps, son interligne ; le cadenas d'un bloc verrouille, sa place */
    panelSize: 6.8,
    panelLh: 8.2,
    lockS: 4.6,
    lockW: 7,
    lockDx: 5.5,
  },
  phone: {
    nameSize: 10,
    letterSize: 0,
    unitSize: 8.6,
    tagAt: 'unit' as 'name' | 'unit',
    tagSize: 8.6,
    valueSizes: [17, 14.5, 12, 10],
    nameDy: 10.2,
    // L'unite plus haut (revue de R2 : CENTER, -8.2 DB touchaient le bord du bloc)
    valueDy: 25.9,
    unitDy: 33.5,
    letters: false,
    notchRow: false,
    tabs: false,
    tabSize: 0,
    foot: 9.5,
    head: { pill: 9, pillH: 13.5, voice: 13, sound: 9, bpm: 8, num: 13 },
    selR: 1.3,
    panelSize: 9,
    panelLh: 10.4,
    lockS: 6,
    lockW: 7,
    lockDx: 5.5,
  },
  /*
   * L'ecran haut du telephone (2026-10-09, Mika : "donne-moi un ecran plus
   * grand") : 293 px de large et 129 de haut a 390 x 844 (280 x 105 avant),
   * des blocs de 66 x 44 px (62 x 31 avant) ; le nom a 11.5 (10 px a
   * l'ecran), la valeur a 26 (24 px), l'unite a 9.5 ; l'en-tete et le pied un
   * rien plus gros aussi.
   */
  tall: {
    nameSize: 11.5,
    letterSize: 0,
    // L'unite et l'etiquette a 10 (revue du 2026-10-09 : 9.5 faisaient moins de 9 px a l'ecran, 69-common2 point 6)
    unitSize: 10,
    tagAt: 'unit' as 'name' | 'unit',
    tagSize: 10,
    valueSizes: [26, 23, 19, 15],
    nameDy: 12.5,
    valueDy: 36.5,
    unitDy: 47.3,
    letters: false,
    notchRow: false,
    tabs: false,
    tabSize: 0,
    foot: 10.5,
    head: { pill: 10, pillH: 14.5, voice: 14.5, sound: 10, bpm: 9.8, num: 14.5 },
    selR: 1.4,
    panelSize: 10,
    panelLh: 12,
    lockS: 7,
    lockW: 8.5,
    lockDx: 6.5,
  },
  /*
   * L'ecran 5:3 du desktop V.4.0 (2026-10-27) : les blocs de 72 x 69.5 (52.5 avant) ; la valeur plus grande et plus bas,
   * l'unite au bas du bloc, le panneau des verrous plus aere. Le reste, celui du dessin haut.
   */
  wide: {
    nameSize: 11.5,
    letterSize: 0,
    unitSize: 10,
    tagAt: 'unit' as 'name' | 'unit',
    tagSize: 10,
    // Un dernier cran a 15, celui du dessin haut : un nom qui y tenait (BLUEPRINT dans SOUND) tient encore
    valueSizes: [30, 26, 22, 18, 15],
    nameDy: 13.5,
    valueDy: 44,
    unitDy: 57.5,
    letters: false,
    notchRow: false,
    tabs: false,
    tabSize: 0,
    foot: 10.5,
    head: { pill: 10, pillH: 14.5, voice: 14.5, sound: 10, bpm: 9.8, num: 14.5 },
    selR: 1.4,
    panelSize: 10,
    panelLh: 13,
    lockS: 7,
    lockW: 8.5,
    lockDx: 6.5,
  },
} as const;
/** right : le bord droit du pattern et du tempo, a gauche de la touche i (R4 ; 312 avant) ; gap : l'air entre le son, le pattern et le tempo (R4 : 8 et 10 avant, la place rendue au son). */
/** Les points de page sous la pastille (2026-10-27, desktop) : leur rayon, l'ecart de leurs centres (unites). */
export const PAGE_DOTS = { r: 1.1, gap: 4.4 } as const;
export const PAGE_HEAD: { y: number; iconX: number; pillX: number; pillY: number; right: number; rule: number; gap: number } = TALL
  ? { y: 16.5, iconX: 10, pillX: 23, pillY: 4, right: 299, rule: 22.5, gap: 7 }
  : { y: 15.5, iconX: 10, pillX: 23, pillY: 4.5, right: 301, rule: 21.5, gap: 7 };
/**
 * L'en-tete de la vue PAGE a places fixes (2026-10-22, audit SB-13). Les paliers de serrage de ses onglets : le corps
 * (s, de celui des onglets), l'air dans un onglet (pad), entre deux (gap), apres un titre sans cadre (tpad, DELAY de
 * DELAY > GLOBAL) et apres le trait du chevron (chev). headPlan ne compte que jusqu'au palier HEAD_FIT_MAX (90 % du
 * corps), pour les huit voix ; le dernier, 80 %, sert sans voix choisie (revue RB3-4, 2026-10-22, mesure avec SF Pro :
 * FX > VOICE FX > GLOBAL au desktop, 90 % au plus avec une voix ; le telephone reste a 100 %) et a une police de repli
 * plus large. Compter la page sans voix dans headPlan ferait tomber A01 de toutes les pages du desktop (149.0 > 148.5).
 */
export const HEAD_FIT = [
  { s: 1, pad: 9, gap: 3, tpad: 9, chev: 5.8 },
  { s: 1, pad: 7, gap: 2, tpad: 4, chev: 3.5 },
  { s: 0.9, pad: 6, gap: 2, tpad: 2, chev: 3 },
  { s: 0.8, pad: 5, gap: 1.5, tpad: 2, chev: 2 },
] as const;
export type HeadFit = (typeof HEAD_FIT)[number];
export const HEAD_FIT_MAX = 2;
/** Au telephone, le palier jusqu'ou la colonne de la voix recule pour laisser de la place a la zone de MASTER (headPlan). */
export const HEAD_FIT_PHONE = 1;
/**
 * La colonne de la voix : l'air entre elle et le pattern (gap), entre elle et la lettre d'un mode arme (badgeAir), et
 * ce que les onglets lui laissent (air ; tabAir sous DIST CHORUS DELAY REVERB, ou la voix est cernee comme un onglet,
 * tabPad l'air dans son cadre).
 */
export const HEAD_COL = { gap: 6, badgeAir: 5, air: 5, tabAir: 6.5, tabPad: 2.5 } as const;
/** Un trait de la gauche de l'en-tete (headLeft) : un chevron, un titre ou GLOBAL en retrait, un onglet et sa zone. */
export type HeadOp =
  | { kind: 'chev'; x: number; w: number }
  | { kind: 'text'; text: string; x: number; w: number; color: string; align: 'left' | 'center' }
  | { kind: 'tab'; text: string; x: number; w: number; on: boolean; zone: { screen: RytmScreenId; x0: number; x1: number } };
export interface HeadLeft {
  label: string;
  pw: number;
  ts: number;
  chev: number;
  ops: HeadOp[];
  end: number;
  heads: string;
}
/** Les paliers de MASTER, TEMPO et du pattern : A01 et le niveau en dB, A01 seul, ni l'un ni l'autre. */
export type DialTier = { a01: boolean; full: boolean };
export const DIAL_TIERS: readonly DialTier[] = [
  { a01: true, full: true },
  { a01: true, full: false },
  { a01: false, full: false },
];
/** L'air entre le pattern et MASTER (g), entre MASTER et TEMPO (gd). */
export const DIAL_GAP = { g: 6, gd: 9 } as const;
/**
 * Les valeurs de reference de la vue PAGE (2026-10-22) : le tempo compte a son plus large (100 a 150) et le niveau en dB
 * aussi, le groupe ne bouge pas quand ils changent ; le pattern a A01 (un pattern plus large, A08, prend 2.5 unites sur
 * les 6 d'air avec la voix, son bord droit ne bouge pas).
 */
export const DIAL_REF = { bpm: ['100', '108', '140', '148', '150'], db: '-48.8', slot: 'A01' } as const;
export interface HeadPlan {
  tier: DialTier;
  voiceX: number;
  colW: number;
  groupLeft: number;
}
export interface DialGeom {
  level: number;
  db: string;
  mNum: string;
  mUnit: string;
  bpmV: number;
  bpm: string;
  tw: number;
  tuw: number;
  meterW: number;
  mnw: number;
  muw: number;
  mFull: number;
  slot: string;
  aw: number;
  width: (t: DialTier) => number;
}
/**
 * Les seize pas du pied (a gauche) et le reste du pied (a droite) ; au
 * telephone (2026-10-09), en bas de l'ecran haut. Revue du meme jour (les
 * deux lignes de l'aide collaient au bas du verre, la seconde a peine
 * lisible) : le pied du telephone va de 132 a 158, ses lignes au milieu ; une
 * ligne a y, deux a y1 et y2 (3.7 d'air entre elles, 5 sous la seconde), les
 * pas centres sur elles.
 */
export const PAGE_STRIP: { x0: number; y: number; size: number; pitch: number } = TALL ? { x0: 10, y: UH - 16, size: 6, pitch: 7 } : { x0: 10, y: 105.5, size: 5.5, pitch: 7 };
export const PAGE_FOOT: { x0: number; x1: number; y: number; y1: number; y2: number } = TALL
  ? { x0: 132, x1: 312, y: UH - 9.5, y1: UH - 15, y2: UH - 5 }
  : { x0: 132, x1: 312, y: 112.5, y1: 106.8, y2: 114.8 };
/**
 * Le flash d'un pas verrouille qui joue (revue de R2 : un seizieme, 115 ms a
 * 130 BPM, ne se lisait pas) : il tient jusqu'au coup suivant de la voix, au
 * moins min, au plus max (ms).
 */
export const FLASH = { min: 280, max: 900 } as const;
/** La valeur d'un bloc haut (VOICE FX, deux rangees) : un corps plus gros (revue du 2026-10-09 : son milieu restait vide). */
export const TALL_VALUE = 1.45;
/** SOUND, MIX et COMP sur une seule case au desktop (2026-10-27, la face) : des corps de plus pour la valeur, l'unite a 84 puis 72 %. */
export const FACE_TEXT_SIZES: readonly number[] = [13, 11.5, 10, 8.6];
export const FACE_UNIT_SHRINK: readonly number[] = [0.84, 0.72];
/** Leur bande au pied du bloc (2026-10-27) : de bh - up a bh - down, sous la ligne d'unite. */
export const FACE_STRIP = { up: 9, down: 4 } as const;
/** La largeur des deux plaques de BOTH (layersGlyph), en unites. */
const LAYERS_GLYPH_W = 8.6;
/** Le pied du LOCK au telephone : ses deux aides alternent (ms). */
export const TIP_MS = 2400;
/**
 * Le geste qui regle un bloc, dans les aides : DRAG A VALUE depuis le
 * 2026-10-09 (au telephone d'abord, les potards de page ont quitte la face ;
 * au desktop aussi depuis l'etape 2, ses encodeurs sont les FX globaux). TURN
 * A KNOB au desktop depuis V.4.2 (2026-10-27) : l'ecran ne se touche plus
 * (theme.ts SCREEN_TOUCH), le potard sous le bloc le tourne.
 */
export const TURN = SCREEN_TOUCH ? 'DRAG A VALUE' : 'TURN A KNOB';
/**
 * Le navigateur des sons (2026-10-18), en unites : rows, le haut et le bas de
 * ses lignes (la place des blocs ; BROWSER_ROWS lignes : 12,5 de haut au
 * desktop, 27 au telephone, assez pour un doigt) ; x0 et x1, leur largeur ;
 * bar, la barre de defilement ; del, le x d'un sample de ce navigateur au
 * bout de sa ligne (desktop ; 0 au telephone : l'appui long) ; arrows, PREV et
 * NEXT dans l'en-tete, a gauche de la touche i (au telephone, sa zone est alors
 * dans le coin du verre) ; les corps : le titre, le rang, le numero, le nom,
 * l'etiquette, l'aide du pied.
 */
export const SB: {
  rows: readonly [number, number];
  x0: number;
  x1: number;
  bar: number;
  del: number;
  arrows: readonly [readonly [number, number], readonly [number, number]];
  arrow: number;
  head: number;
  rank: number;
  num: number;
  label: number;
  tag: number;
  hint: [number, number];
} = PORTRAIT
  ? // PREV et NEXT plus larges (2026-10-22, audit RS-11 : 29 x 22 px, leurs zones de 48 px se chevauchaient de 17) : 46 unites,
    // 42 px chacune ; les trois lignes de 36 unites (BROWSER_ROWS), le nom un peu plus gros
    { rows: [24, 132], x0: 8, x1: 305, bar: 312, del: 0, arrows: [[196, 242], [246, 292]], arrow: 6, head: 14.5, rank: 10.5, num: 9.5, label: 14, tag: 9, hint: [10, 10] }
  : TALL
    ? // L'ecran haut du desktop (2026-10-18) : la place des lignes du telephone, sept lignes de 15,4 (BROWSER_ROWS), le x des
      // samples perso garde (la souris), l'en-tete du dessin haut ; l'ecran 5:3 (2026-10-27) : jusqu'a 166, neuf lignes de 15,8
      { rows: [24, 132 + GROW], x0: 8, x1: 305, bar: 312, del: 18, arrows: [[226, 257], [260, 291]], arrow: 5.6, head: 14.5, rank: 10.5, num: 7.5, label: 10.5, tag: 7, hint: [9, 8] }
    : { rows: [24, 99], x0: 8, x1: 306, bar: 312.5, del: 17, arrows: [[255, 277], [280, 302]], arrow: 4.2, head: 11.5, rank: 8, num: 6, label: 8.8, tag: 5.6, hint: [6.8, 5.8] };
/** Une ligne du navigateur. */
export const SB_PITCH = (SB.rows[1] - SB.rows[0]) / BROWSER_ROWS;
/** Une ligne du navigateur sous la souris : un fond un peu plus franc que celui d'un bloc (une ligne est plus mince). */
export const SB_HOVER = 'rgba(246, 241, 231, 0.09)';

export const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Le fond d'un bloc sous la souris (desktop, 2026-10-09) : a peine plus clair. */
export const HOVER_FILL = 'rgba(246, 241, 231, 0.05)';

/** Le rectangle d'un bloc dans la grille (2026-10-09) : ses cases, et l'air entre elles quand il en couvre plusieurs. */
export function cellRect(c: SlotCell): { x: number; y: number; w: number; h: number } {
  const M = MATRIX;
  const w = Math.max(1, c.w);
  const h = Math.max(1, c.h);
  return { x: M.x0 + M.pitch * c.c, y: M.rows[c.r] ?? M.rows[0], w: M.pitch * (w - 1) + M.w, h: (M.rows[1] - M.rows[0]) * (h - 1) + M.h };
}

/** Une frequence courte : 120HZ, 2.1KHZ. */
export const hzShort = (f: number): string => (f < 1000 ? `${Math.round(f)}HZ` : `${(f / 1000).toFixed(f < 10000 ? 1 : 0)}KHZ`);

/** La valeur d'un FX global (le popup d'un encodeur) : son nombre, son unite, sa course. */
export function globalValueOf(id: EncId): { text: string; unit: string; course: number } {
  const d = id as DialId;
  const [lo, hi] = dialRange(d);
  return { text: dialValueText(d), unit: dialUnit(d), course: hi > lo ? (dialShown(d) - lo) / (hi - lo) : 0 };
}

/**
 * MUTE et SOLO au pied (2026-10-09, la machine a trois etats d'actions.ts) :
 * ONE (une voix attendue), MULTI (et ses voix), ou les voix gardees ; le
 * geste suivant a droite. null : rien a dire.
 */
export function modeLines(): { left: string; tip: string; short: string } | null {
  const v = voices.get();
  // Le mode MUTE de FUNC + TRK (V.5.0, le desktop) : global ou du pattern, les voix coupees, comment en sortir
  const dm = DT_FACE ? dtFace.mute() : 'off';
  if (dm === 'global') return { left: `GLOBAL MUTE: ${v.muted.length ? v.muted.join(' ') : 'STEPS 1-8'}`, tip: 'HOLD: SOLO  NO: EXIT', short: 'NO: EXIT' };
  if (dm === 'pattern') {
    const pm = pattern.get().pmutes;
    return { left: `PATTERN MUTE: ${pm.length ? pm.join(' ') : 'STEPS 1-8'}`, tip: 'FUNC + TRK OR NO: EXIT', short: 'NO: EXIT' };
  }
  // short : l'aide quand la liste des voix prend la place (la revue du 2026-10-09 : MULTI MUTE: B. au desktop)
  if (v.soloMode)
    return v.soloMulti
      ? { left: `MULTI SOLO: ${v.solo.length ? v.solo.join(' ') : 'TAP VOICES'}`, tip: 'SOLO: DONE  HOLD: ALL OFF', short: 'HOLD: ALL OFF' }
      : { left: 'SOLO: TAP A VOICE', tip: 'SOLO AGAIN: SEVERAL', short: 'AGAIN: SEVERAL' };
  if (v.muteMode)
    return v.muteMulti
      ? { left: `MULTI MUTE: ${v.muted.length ? v.muted.join(' ') : 'TAP VOICES'}`, tip: 'MUTE: DONE  HOLD: ALL ON', short: 'HOLD: ALL ON' }
      : { left: 'MUTE: TAP A VOICE', tip: 'MUTE AGAIN: SEVERAL', short: 'AGAIN: SEVERAL' };
  if (v.solo.length) return { left: `SOLO: ${v.solo.join(' ')}`, tip: 'HOLD SOLO: ALL OFF', short: 'HOLD: ALL OFF' };
  // MUTE rend toutes les voix d'une tape (2026-10-10) ; au desktop (V.5.0) le mode MUTE de FUNC + TRK les rend une a une
  if (v.muted.length) return DT_FACE ? { left: `MUTED: ${v.muted.join(' ')}`, tip: 'FUNC + TRK: MUTE MODE', short: 'FUNC + TRK' } : { left: `MUTED: ${v.muted.join(' ')}`, tip: 'MUTE: ALL ON', short: 'MUTE: ALL ON' };
  // Le mute du pattern (V.5.0)
  const pm = DT_FACE ? pattern.get().pmutes : [];
  if (pm.length) return { left: `PTN MUTED: ${pm.join(' ')}`, tip: 'FUNC + TRK 2X: PATTERN MUTE', short: 'FUNC + TRK' };
  return null;
}

/**
 * La touche qui ramene l'onglet suivant d'une page (V.5.0, le desktop) : celle de la page, ou pour une page de FUNC la
 * touche qui l'ouvre (MOD sur le MIXER, FUNC + TRIG pour TEMPO, FUNC + FX pour SEND FX).
 */
const FUNC_PAGE_KEY: Readonly<Partial<Record<RytmPageId, string>>> = { mixer: 'MOD', tempo: 'FUNC + TRIG', sendfx: 'FUNC + FX' };
export const pageKeyWord = (page: RytmPageId): string => (DT_FACE ? (FUNC_PAGE_KEY[page] ?? pageLabel(page)) : pageLabel(page));

/**
 * L'aide du P-LOCK au pied (la revue de D1, T2) : au desktop hors REC, le P-LOCK demande REC ; les formes, de la plus longue
 * a la plus courte.
 */
export function plockHints(): readonly string[] {
  if (!stepWrites()) return [`${TURN}  ·  ● REC + HOLD STEP: P-LOCK`, `${TURN} · ● REC + HOLD STEP: P-LOCK`, '● REC + HOLD STEP: P-LOCK'];
  return [`${TURN}  ·  HOLD A STEP: P-LOCK`, `${TURN} · HOLD A STEP: P-LOCK`, `${TURN} · HOLD STEP: P-LOCK`];
}

/** Le mute du pattern qui joue (V.5.0) : au desktop seulement, le telephone ne le montre pas (la revue de D1, K5). */
export const pmutesNow = (): readonly Inst[] => (DT_FACE ? pattern.get().pmutes : []);

/** Coupe a n lettres, un point final quand ca deborde. */
export const fit = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}.`);

/** Le son d'une voix : 909, 808, MM ou son sample. */
export function soundOf(inst: Inst): string {
  const f = familyOf(inst as ShotId);
  return f ? kit.valueText(f) : 'MM';
}

/** La police : FONT_DISPLAY, en unites (le contexte est a l'echelle). */
export const font = (weight: number, size: number): string => `${weight} ${size}px ${FONT_DISPLAY}`;
