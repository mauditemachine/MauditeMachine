/**
 * /v4 MM-808 : palette, dimensions, cadrage, lumieres. Revision 2 (spec
 * 20) : la machine devient une boite a rythmes noire facon Elektron
 * Analog Rytm, un coin (wedge) plus epais a l'arriere (2.2) qu'a l'avant
 * (1.3), le panneau du dessus incline d'environ 6 deg vers l'utilisateur.
 * Tout nombre de la scene vit ici : la scene 3D, les jumeaux HTML et le SVG
 * de repli lisent les memes constantes.
 * Repere monde : +y vers le haut, +x la largeur (droite), +z vers l'avant
 * (l'utilisateur), sol a y 0 ; le corps fait 14 x 9 au sol.
 * Repere "panneau" : celui du plateauGroup, origine au centre du dessus du
 * panneau, x a droite, z qui descend la pente vers l'utilisateur, y 0 = le
 * dessus du panneau.
 */

import seoMeta from '../data/seo-meta.json';
import { fwText } from './firmware';
import { RYTM_FACEPLATE, fpU, fpX, fpZ, type FpMark } from './rytm/faceplate';
import { GLOBAL_FX_RULE, HEAD, type Inst, KEY_MARK, OLED, OLED_UH, PAD, PAGE_KNOB_IDS, type PageId, type PageKnobId, PORTRAIT, type SilkLogoId, VOICE_COLS } from './theme/base';
import { keyDz, KEYS, keyX, KNOB_RING, SILK_TEXTS } from './theme/face';
export * from './theme/face';
export { PORTRAIT, SILK, OLED_UH, OLED, SCENE_KEY, faceKeyX, PAD, VOICE_COLS, VOICE_KEYS, OPEN_KEY, EDIT_KEY, PADS, PAGE_KNOB_IDS, PAGE_KNOB_LETTERS, GLOBAL_FX_RULE, pageKnobX, GLOBAL_ENC_LABELS, RYTM_PAGE_KEYS, KEY_MARK } from './theme/base';
export type { FaceKeyId, Inst, PageId, VoicePad, PagePad, OpenPad, EditPad, PadSpec, PageKnobId, FaceKnobId, EncPlace, KeyLabelSpec, SilkText, SilkLogoId } from './theme/base';

/* ---------- couleurs (spec 4.4 et 20.3) ---------- */

export const HEX = {
  ink: '#0A0A0B',
  graphite: '#141417',
  graphiteHi: '#1C1D21',
  graphiteLo: '#08080A',
  line: '#2E3036',
  bone: '#F6F1E7',
  yellow: '#F2C230',
  yellowHi: '#FFD75E',
  red: '#C8442F',
  /** orange de navigation : noms des pages et des puces, pas programmes (demande de Mika, 2026-09-30) */
  orange: '#FF6A13',
  /** pas programme : orange, pour voir d'un coup d'oeil quels pas sont mis (velocite forte) */
  ledSet: '#FF6A13',
  /** velocite moyenne : l'orange a 68 % */
  ledMid: '#AD480D',
  /** velocite douce : l'orange a 38 % */
  ledLow: '#612807',
  ledHover: '#A9A69F',
  // Revision 2 (spec 20.3), couleurs AFFICHEES visees (voir GAIN)
  /** flancs et dessous du chassis, mats (brief) */
  body: '#0C0C0E',
  /** chanfreins du chassis tournes vers le haut : ils accrochent la lumiere */
  bodyEdge: '#2A2B30',
  /** dessus du chassis, vu seulement panneau leve */
  bodyTop: '#09090A',
  /** pieds en caoutchouc */
  rubber: '#050506',
  /** dessus du panneau, aluminium anodise noir mat (brief) */
  panel: '#141417',
  /** chanfrein du panneau : l'arete anodisee qui accroche la lumiere */
  panelEdge: '#3A3B40',
  panelSide: '#101012',
  /** verre et cadre de l'ecran OLED : noir profond */
  oled: '#050506',
  /** pads en caoutchouc noir */
  pad: '#111113',
  /** touches trig */
  key: '#1E1F23',
  /** encodeurs noirs et leur collerette */
  encoder: '#101012',
  collar: '#1A1B1F',
  // Le PCB de la vue eclatee (spec 5.6)
  pcb: '#0F3A25',
  /** piste sous le vernis (2026-10-01) : le cuivre eclaircit le vert, sans briller */
  pcbTrace: '#2A6644',
  pcbSide: '#0E2418',
  pcbPadCore: '#0B1A11',
  copper: '#B8763A',
  chip: '#0B0B0D',
  leg: '#8A8F98',
  capBody: '#23283A',
  capTop: '#4A5068',
  cell: '#B9BCC4',
  resistor: '#C9B48A',
  // MM-VOYAGER (2026-10-03) : peinture noire mate du capot, son chant, le bac,
  // capuchons des potards Moog et leur jupe d'aluminium (2026-10-03 : plus
  // fine et plus sombre sur la machine noire, Mika ; les encodeurs de la 808
  // ont la meme depuis)
  voyPanel: '#131315',
  voyPanelEdge: '#2C2D32',
  voyBody: '#0C0C0E',
  voyKnob: '#0F0F11',
  voySkirt: '#5D6167',
} as const;

export type Tone = keyof typeof HEX;

/** Les memes teintes en nombres, pour three (Color, setClearColor). */
export const COLOR = Object.fromEntries(
  (Object.keys(HEX) as Tone[]).map((k) => [k, parseInt(HEX[k].slice(1), 16)])
) as Record<Tone, number>;

/**
 * La langue des couleurs de la Digitakt (V.5.0, 2026-10-29, l'etape D1, docs/v4/digitakt-d1-spec.md section 2 et
 * docs/v4/digitakt-reference.md section 2) : au desktop seulement (DT_FACE), le telephone garde ses couleurs au pixel
 * pres. Le rouge : les coups, REC, la page affichee, la voix choisie, le pattern qui joue ; le jaune : les verrous ; le
 * blanc : la tete de lecture, les anneaux, les flashs ; le vert : PLAY et le mode MUTE global ; le magenta : le mute du
 * pattern ; le bleu : les scenes ; l'orange : FUNC et les fonctions secondaires SEULEMENT. Des couleurs AFFICHEES (sRGB) :
 * les temoins, la serigraphie, les LED du boitier ; sur la machine creme, les memes teintes plus sombres et lisibles, le
 * blanc devient l'encre sombre (applyAppearance).
 */
export const DT_FACE: boolean = !PORTRAIT;
export type DtTone = 'red' | 'yellow' | 'white' | 'green' | 'magenta' | 'blue' | 'orange';
/** La palette de la machine noire : aussi celle du boitier (hw/snapshot.ts, la revue de D1, R10 : le boitier n'a pas de creme). */
export const DT_HEX_DARK: Readonly<Record<DtTone, string>> = { red: '#FF2B2B', yellow: '#FFD75E', white: '#F4F1EA', green: '#3DDC5A', magenta: '#E04DD8', blue: '#4DA3FF', orange: '#FF6A13' };
// L'orange de la creme (la revue de D1, R3) : #A84300, l'encre des fonctions secondaires sous l'eclairage (le #D9560A d'avant
// lisait a 2,4:1 sur le panneau eclaire)
const DT_HEX_LIGHT: Readonly<Record<DtTone, string>> = { red: '#D81E1E', yellow: '#E09A10', white: '#191919', green: '#1F9E3A', magenta: '#B23AAB', blue: '#2F78D6', orange: '#A84300' };
/** La palette de l'apparence posee (applyAppearance la change en place). */
export const DT_HEX: Record<DtTone, string> = { ...DT_HEX_DARK };

/**
 * Les teintes du brief sont des couleurs AFFICHEES (section 19 point 12) :
 * sous l'eclairage et l'ACES, un albedo egal a la teinte rend bien plus
 * sombre (le pied de la courbe ACES ecrase les noirs). Albedo = teinte
 * lineaire x gain, un gain par teinte, cale par lecture de pixels a
 * 1440 x 900 a la vue par defaut (azimut 45, elevation 38) sur la face qui
 * definit la teinte : body sur les faces avant et droite du chassis (la
 * cle les eclaire de biais : gain fort), panel sur le dessus du panneau
 * (metalness 0.35 sans carte d'environnement : 35 % du diffus en moins),
 * panelEdge sur son chanfrein (face a la cle : gain faible). Mesures en
 * section 20.16.
 */
export const GAIN: Readonly<Partial<Record<Tone, number>>> & { parts: number } = {
  body: 7.5,
  bodyEdge: 3,
  bodyTop: 3,
  panel: 4.2,
  panelEdge: 2.3,
  panelSide: 18,
  pad: 1.8,
  encoder: 2.4,
  collar: 2.4,
  /** pieds, connectique, cadre de l'ecran */
  parts: 3,
  voyPanel: 3.6,
  voyPanelEdge: 2.3,
  voyBody: 7.5,
  voyKnob: 2.4,
  voySkirt: 1,
};
/** Gain d'une teinte (GAIN, sinon celui des pieces). */
export const gainOf = (t: Tone): number => GAIN[t] ?? GAIN.parts;

/** Gain historique des corps (revision 1) : PCB et composants gardent le leur. */
export const ALBEDO_GAIN = 3;

/** bone (#F6F1E7) a une opacite donnee (canvas, CSS). */
export const boneA = (a: number): string => `rgba(246, 241, 231, ${a})`;

/* ---------- polices ---------- */

export const FONT_DISPLAY = '"SF Pro Display", system-ui, -apple-system, sans-serif';
export const FONT_TITLE = '"Robot Radicals", "SF Pro Display", system-ui, sans-serif';
export const FONT_MONO = 'ui-monospace, Menlo, Consolas, monospace';
/**
 * Ce que les textures canvas attendent avant leur dessin definitif (spec
 * 4.5) : 500 et 600 pour la serigraphie du panneau (revision 2, legendes
 * fines), 700 pour celle du PCB. 2026-10-22 (audit SB-01) : 300 et 400
 * aussi, les grandes valeurs et le texte courant des ecrans (RYTM, ARP,
 * BASS) ; sans eux check() restait faux et rien ne redessinait les ecrans.
 */
export const FONT_LOADS = [
  '300 40px "SF Pro Display"',
  '400 40px "SF Pro Display"',
  '500 40px "SF Pro Display"',
  '600 40px "SF Pro Display"',
  '700 40px "SF Pro Display"',
  '400 40px "Robot Radicals"',
] as const;
export const FONT_TIMEOUT_MS = 3000;

/** Serigraphie du PCB : l'ancienne, 700, 0.18 em (spec 5.7). */
export const PCB_TYPE = { weight: 700, tracking: 0.18 } as const;

/* ---------- le corps : chassis en coin, panneau, pieds (spec 20.3.2 et 20.3.3) ---------- */

/**
 * Chassis : 12.6 x 8 au sol (2026-10-01, plus compact : 14 x 9 avant,
 * LABEL et SONAA ont quitte les pads), dessous a y 0.12 (les pieds), 2.2
 * de haut a l'arriere et 1.3 a l'avant au-dessus du dessous : le panneau
 * s'incline de atan(0.9 / 8) = 6.42 deg vers l'utilisateur (la signature
 * Elektron). Toutes les aretes sont chanfreinees (chamfer).
 */
/*
 * La face V.4.0 du desktop (2026-10-27, Mika : "faceplate 256 x 156 mm, 20 mm l'unite") : le panneau fait 12.8 x 7.8
 * le long de la pente (rytm/faceplate.ts RYTM_FACEPLATE.size), le corps 12.8 de large et d au sol tel que d / cos(TILT)
 * = 7.8 avec la meme hauteur a l'arriere et a l'avant (le profil du coin et la face arriere gardent leur reglage) :
 * d = sqrt(7.8^2 - 0.9^2) = 7.748, TILT = 6.63 deg (6.42 avant). Les voisines gardent la place du corps d'avant
 * (RYTM_V3_BODY). Le telephone garde le sien (phase 5).
 */
export const BODY = PORTRAIT
  ? ({ w: 8.2, d: 14.4, back: 2.2, front: 1.3, feet: 0.12, chamfer: 0.06 } as const)
  : ({ w: fpU(RYTM_FACEPLATE.size.w), d: Math.sqrt(fpU(RYTM_FACEPLATE.size.h) ** 2 - (2.2 - 1.3) ** 2), back: 2.2, front: 1.3, feet: 0.12, chamfer: 0.06 } as const);
/**
 * La place du MM-RYTM d'avant V.4.0 sur la table (2026-10-27) : sa largeur et sa profondeur au sol de la V.3.0. Les
 * cartes PCB (celle du MM-RYTM, du MM-ARP et du MM-BASS, theme PCB) et le MM-BASS (bass/theme.ts : sa taille et sa
 * place) la gardent : les voisines ne bougent pas quand la face du MM-RYTM change de taille.
 */
export const RYTM_V3_BODY = PORTRAIT ? ({ w: 8.2, d: 14.4 } as const) : ({ w: 12.6, d: 8 } as const);
/** Inclinaison du panneau (rad) : son avant descend. */
export const TILT = Math.atan((BODY.back - BODY.front) / BODY.d);

/**
 * Panneau (spec 20.3.3) : dalle a coins arrondis (le chassis moins 0.2) +
 * chanfrein de 0.1 (empreinte BODY.w x BODY.d / cos TILT le long de la
 * pente, BODY.w x BODY.d au sol), 0.14 d'epaisseur, dessus a y 0 du repere
 * panneau. Le cadre de l'ecran OLED lui est fusionne.
 */
export const PANEL = {
  shapeW: BODY.w - 0.2,
  shapeD: BODY.d / Math.cos(TILT) - 0.2,
  radius: 0.2,
  /** three subdivise les arcs en 2 x curveSegments */
  curveSegments: 4,
  t: 0.14,
  bevelThickness: 0.05,
  bevelSize: 0.1,
} as const;
/** Longueur de la pente du panneau : BODY.d / cos TILT. */
export const PANEL_D = PANEL.shapeD + 2 * PANEL.bevelSize;
/** Centre du dessus du panneau, monde, machine fermee : 0.12 + (2.2 + 1.3) / 2. */
export const PANEL_TOP_Y = BODY.feet + (BODY.back + BODY.front) / 2;
/**
 * Dessus du chassis (= dessous du panneau) a la profondeur z (monde) :
 * y = PANEL_TOP_Y - epaisseur verticale du panneau - z tan(TILT).
 */
export const chassisTopY = (z: number): number => PANEL_TOP_Y - PANEL.t / Math.cos(TILT) - z * Math.tan(TILT);

/**
 * Le dessus du chassis est un bac (spec 20.3.11) : un rebord de wall, des
 * parois et un fond depth plus bas, paralleles au panneau. Le PCB y dort
 * machine fermee et en sort a l'ouverture sans traverser aucune surface
 * (ouverture 13.52 x 8.51 dans le repere du panneau, carte 12.6 x 7.8).
 */
export const TRAY = { wall: 0.18, depth: 0.55 } as const;

/** Pieds en caoutchouc aux quatre coins (visibles en orbite basse). */
export const FEET = { r: 0.42, h: BODY.feet, x: BODY.w / 2 - 0.55, z: BODY.d / 2 - 0.55, segments: { desktop: 16, mobile: 12 } } as const;

/**
 * Face arriere (2026-10-01, plus realiste) : la connectique d'une vraie
 * boite a rythmes et sa serigraphie, le logo a gauche. u : abscisse vue de
 * derriere (de gauche a droite pour qui regarde l'arriere ; x monde = -u),
 * y : hauteur du centre. La face va de y 0.12 a 2.32 (z -BODY.d / 2).
 * Les pieces sont fusionnees au chassis (zero draw call) ; la serigraphie
 * est une texture sur un plan pose 0.003 devant la face (scene/backplate.ts).
 */
export type BackPortKind = 'jack' | 'mini' | 'din' | 'usb' | 'dc' | 'power';
export const BACK = {
  portY: 1.0,
  /** libelle sous chaque groupe : nom du port ; au-dessus : titre du groupe et son crochet */
  labelY: 1.43,
  bracketY: 1.6,
  groupY: 1.75,
  cap: 0.075,
  groupCap: 0.065,
  /** portrait : la meme connectique resserree sur 8.2 de large */
  ports: (PORTRAIT
    ? [
        { id: 'phones', kind: 'jack', u: -3.45, label: 'PHONES' },
        { id: 'outL', kind: 'jack', u: -2.65, label: 'L', group: 'MAIN OUT' },
        { id: 'outR', kind: 'jack', u: -2.0, label: 'R', group: 'MAIN OUT' },
        { id: 'syncIn', kind: 'mini', u: -1.2, label: 'IN', group: 'SYNC' },
        { id: 'syncOut', kind: 'mini', u: -0.65, label: 'OUT', group: 'SYNC' },
        { id: 'midiIn', kind: 'din', u: 0.2, label: 'IN', group: 'MIDI' },
        { id: 'midiOut', kind: 'din', u: 0.9, label: 'OUT', group: 'MIDI' },
        { id: 'usb', kind: 'usb', u: 1.75, label: 'USB' },
        { id: 'dc', kind: 'dc', u: 2.55, label: 'DC 12V' },
        { id: 'power', kind: 'power', u: 3.35, label: 'POWER' },
      ]
    : [
        { id: 'phones', kind: 'jack', u: -1.9, label: 'PHONES' },
        { id: 'outL', kind: 'jack', u: -1.0, label: 'L', group: 'MAIN OUT' },
        { id: 'outR', kind: 'jack', u: -0.25, label: 'R', group: 'MAIN OUT' },
        { id: 'syncIn', kind: 'mini', u: 0.65, label: 'IN', group: 'SYNC' },
        { id: 'syncOut', kind: 'mini', u: 1.25, label: 'OUT', group: 'SYNC' },
        { id: 'midiIn', kind: 'din', u: 2.2, label: 'IN', group: 'MIDI' },
        { id: 'midiOut', kind: 'din', u: 2.95, label: 'OUT', group: 'MIDI' },
        { id: 'usb', kind: 'usb', u: 3.85, label: 'USB' },
        { id: 'dc', kind: 'dc', u: 4.65, label: 'DC 12V' },
        { id: 'power', kind: 'power', u: 5.45, label: 'POWER' },
      ]) as readonly { id: string; kind: BackPortKind; u: number; label: string; group?: string }[],
  /** jack 6.35 : ecrou hexagonal, fut, trou ; mini-jack 3.5 : plus petit */
  jack: { nut: 0.2, nutH: 0.05, barrel: 0.14, barrelH: 0.08, hole: 0.065 },
  mini: { nut: 0.13, nutH: 0.04, barrel: 0.09, barrelH: 0.06, hole: 0.04 },
  /** DIN 5 broches : collerette, fut, fond noir, broches sur un demi-cercle, ergot */
  din: { flange: 0.28, flangeH: 0.02, shell: 0.23, shellH: 0.06, inner: 0.19, pinR: 0.022, pinRing: 0.11, key: 0.05 },
  /** USB-C : coque en stade, fond noir, languette */
  usb: { w: 0.34, h: 0.13, d: 0.04, inner: { w: 0.29, h: 0.085 }, tongue: { w: 0.17, h: 0.026 } },
  /** jack d'alimentation : boitier carre, trou, broche centrale */
  dc: { w: 0.36, d: 0.05, hole: 0.11, pin: 0.03 },
  /** interrupteur a bascule : cadre, bascule inclinee */
  power: { w: 0.32, h: 0.5, d: 0.05, rocker: { w: 0.25, h: 0.42, d: 0.06, tiltDeg: 9 } },
  /** serigraphie : plan de la face, texture (px), logo, textes, etiquette du numero de serie */
  plane: { w: BODY.w - 0.3, y0: 0.2, y1: 2.24, gap: 0.003 },
  tex: { desktop: 2048, mobile: 1024 },
  logo: PORTRAIT ? { u: -3.8, y: 0.5, w: 1.6 } : { u: -5.95, y: 1.66, w: 3.2 },
  model: { u: PORTRAIT ? -2.05 : -5.95, y: PORTRAIT ? 0.55 : 1.3, text: 'MM-RYTM DRUM MACHINE', cap: PORTRAIT ? 0.06 : 0.08 },
  firmware: { u: PORTRAIT ? -2.05 : -5.95, y: PORTRAIT ? 0.38 : 1.08, text: fwText('mm808'), cap: PORTRAIT ? 0.05 : 0.06, alpha: 0.55 },
  sticker: PORTRAIT
    ? { u0: 2.3, u1: 3.8, y0: 0.26, y1: 0.58, serial: 'S/N MMRYTM-000808' }
    : { u0: -5.95, u1: -4.45, y0: 0.42, y1: 0.78, serial: 'S/N MMRYTM-000808' },
} as const;

/**
 * Brossage du panneau (brief) : une texture de gris, une valeur par ligne
 * (0.86 a 1, une ligne sur 12 une strie a 0.8 ou 1), en roughnessMap,
 * repetee 0.5 fois par unite (UV en unites) : fines lignes horizontales,
 * invisibles de loin (mipmaps), visibles de pres.
 */
export const BRUSH = { size: 256, min: 0.86, streakEvery: 12, streakLo: 0.8, repeat: 0.5, seed: 808 } as const;

/** Materiaux du brief : panneau anodise mat, chassis mat. */
export const MATERIAL = {
  panel: { roughness: 0.62, metalness: 0.35 },
  chassis: { roughness: 0.85, metalness: 0 },
  pad: { roughness: 0.9, metalness: 0 },
  key: { roughness: 0.6, metalness: 0 },
  encoder: { roughness: 0.55, metalness: 0 },
} as const;

/* ---------- PCB (spec 5.6 et 20.3.11) ---------- */

/**
 * Carte : le chassis moins 1.4 x 1.2 (11.2 x 6.8), 0.1 d'epaisseur, dans
 * pcbGroup (incline comme le panneau). Revision 5 : chanfrein de 0.03 sur
 * les quatre bords (la fibre de verre nue en tranche), pistes sur une
 * grille de 0.2 a 45 deg (jamais d'angle droit), largeurs en unites de la
 * carte (signal, alimentation, paires differentielles), textures de
 * 2048 x 1280 (desktop) generees a la premiere apparition du PCB.
 */
export const PCB = {
  /** portrait : la carte d'origine (11.2 x 6.8), tournee d'un quart de tour (PCB_TURN) ; depuis le 2026-10-27 du corps de la V.3.0 (RYTM_V3_BODY : le MM-ARP et le MM-BASS ont la meme carte) */
  w: PORTRAIT ? RYTM_V3_BODY.d - 3.2 : RYTM_V3_BODY.w - 1.4,
  d: PORTRAIT ? RYTM_V3_BODY.w - 1.4 : RYTM_V3_BODY.d - 1.2,
  h: 0.1,
  chamfer: 0.03,
  tex: { desktop: [2048, 1280], mobile: [2048, 1280] },
  /** generateur des pistes (spec 5.7) : grille de 0.2, graine 808 (mulberry32) */
  grid: 0.2,
  seed: 808,
  traces: 230,
  vias: 150,
  /** largeurs (unites de la carte) ; 2026-10-01 : plus fines, plus nombreuses, sous le vernis */
  signalW: 0.022,
  powerW: 0.08,
  pairW: 0.018,
  pairGap: 0.06,
  padR: 0.035,
  viaR: 0.03,
  viaHole: 0.013,
  /** paires differentielles, pistes d'alimentation, serpentins d'egalisation */
  pairs: 4,
  power: 4,
  meanders: 2,
  /** px de la texture de reference (1024 de large) : traits et textes */
  outline: 1,
  chipFrame: 1,
  designatorPx: 10,
  chipLabelPx: 30,
} as const;

/**
 * Une position de la carte dessinee pour la carte d'origine 12.6 x 7.8,
 * ramenee a la carte actuelle (2026-10-01, machine compacte) : les
 * composants, les puces et la serigraphie gardent leur place relative.
 */
export const pcbAt = (x: number, z: number): { x: number; z: number } => ({ x: (x * PCB.w) / 12.6, z: (z * PCB.d) / 7.8 });
/** Portrait : la carte tourne d'un quart de tour dans son plan (rad, autour de y du pcbGroup). */
export const PCB_TURN = PORTRAIT ? Math.PI / 2 : 0;

/**
 * Origines des trois couches (monde, machine fermee). Le plateauGroup est
 * au centre du dessus du panneau ; le pcbGroup, incline pareil, pose la
 * carte dans le chassis, son dessus 0.1 sous le dessus du chassis (cachee
 * tant que la machine est fermee) ; le socle (chassis et sol) ne bouge
 * jamais.
 */
export const LAYERS = {
  plateauY: PANEL_TOP_Y,
  pcbY: PANEL_TOP_Y - (PANEL.t + 0.1 + PCB.h) / Math.cos(TILT),
  socleY: 0,
} as const;

/* ---------- plan de serigraphie ---------- */

/** Plan de serigraphie : tout le panneau (spec 20.3.9), 146.3 / 73.1 px par unite. */
export const SILK_PLANE = {
  w: BODY.w,
  d: PANEL_D,
  y: 0.004,
  /** mobile en pleine definition depuis le 2026-10-01 : a 1024, la serigraphie bavait au DPR 3 */
  // La face V.4.0 du desktop (2026-10-27) : 12.8 x 7.8, le meme texel carre (2048 x 1323 avant, pour 12.6 x 8.14)
  tex: PORTRAIT ? { desktop: [1166, 2048], mobile: [1166, 2048] } : { desktop: [2048, 1248], mobile: [2048, 1248] },
  /**
   * Un ecran Retina au desktop (2026-10-22, audit : a DPR 2 la machine couvre environ 2400 px pour 12.6 unites, les
   * 2048 de la serigraphie etaient agrandis 1.16 fois, les petits noms un peu doux) : 2560 de large, 1.07 texel par pixel ;
   * 17 Mo de plus sur la carte graphique, seulement a partir de retinaDpr (scene/silk.ts PanelSilk)
   */
  // 2560 x 1560 depuis la face V.4.0 (2026-10-27, 12.8 x 7.8 ; 2560 x 1654 avant) ; jamais au telephone
  retina: [2560, 1560],
  retinaDpr: 1.75,
} as const;

/**
 * Sol (spec 20.2.6) : un grand plan opaque a l'encre sous la machine,
 * enfant du socle (il suit l'intro). Son shader (scene/floor.ts, un seul
 * draw call) porte un halo radial tres discret au centre (le sol y vaut
 * haloHex, l'encre ailleurs), l'ombre portee de la cle (opacite shadow ;
 * 0.8 depuis la revue de la revision 2 : a 0.5 elle ne sortait que de 4
 * niveaux sur 255 sur le sol sombre),
 * l'ombre de contact autour de l'empreinte 14 x 9 du chassis (0.6 au
 * bord, nulle a falloff : le sol au ras de la base passe sous l'encre
 * malgre le halo) et un brouillard exponentiel carre
 * 1 - exp(-(fog x r)^2) sur la distance r au centre, qui efface ombres et
 * halo vers le bord. La base du sol EST la couleur de fond : aucune ligne
 * d'horizon, meme a 18 deg d'elevation. Pas de fog de scene : il laverait
 * aussi la machine.
 */
export const FLOOR = {
  size: 120,
  y: -0.001,
  haloHex: '#121215',
  haloR: 9,
  fog: 0.045,
  shadow: 0.8,
  contact: { halfW: BODY.w / 2, halfD: BODY.d / 2, radius: 0.1, falloff: 1.4, opacity: 0.6 },
} as const;

/**
 * Fond granite de la machine noire (2026-10-01, demande de Mika : le fond
 * de sonaa.ca). La page porte le granite (v4.css : page #0C0B09, soit
 * oklch(0.15 0.004 70), et la tuile SVG de Sonaa a 12 %) ; le canevas
 * devient transparent et le sol n'y ecrit plus que son ombre, en alpha.
 * Pas de halo : un eclaircissement additif (couleur plus forte que l'alpha)
 * n'est garde par Chrome que la ou l'alpha est non nul, il dessinait un
 * rectangle clair autour de la machine. La machine claire garde son sol
 * opaque creme. applyAppearance le pose.
 */
export const BACKDROP: { transparent: boolean; readonly page: string } = { transparent: true, page: '#0C0B09' };
/** Le decalage vertical (unites) du dessin de 120 de haut (HOME, EDIT, les presets) dans un ecran plus haut : centre. */
export const OLED_DY = (OLED_UH - 120) / 2;

/**
 * Dessin de l'ecran (spec 20.3.8) : texte bone sur noir profond,
 * monospace 40 px, marges de 24 px, trois lignes a 64, 136 et 208 px. La
 * texture (640 x 240) a les proportions du verre : aucune compression.
 */
export const OLED_DRAW = { font: `400 40px ${FONT_MONO}`, pad: 24, baselines: [64, 136, 208] } as const;

/**
 * Barre de progression de l'ecran (2026-10-01), ligne 3, en px de la
 * texture : 22 de haut, posee 3 au-dessus de la ligne de base, a 14 des
 * temps ; contour de 2, remplissage en retrait de 4. Un clic dessus (et sur
 * toute la bande de la ligne 3) fait avancer la piste.
 */
export const OLED_BAR = { h: 22, lift: 3, gap: 14, stroke: 2, inset: 4, bandY0: 160 + 2 * OLED_DY, bandY1: 236 + 2 * OLED_DY } as const;

/**
 * La meme bande en vue PAGE du MM-RYTM (2026-10-08, rytm/pages.ts) : la
 * piste tient sur la ligne du bas (y 114 des 120 unites), sous la seconde
 * rangee de blocs ; une touche sur cette rangee ne fait jamais avancer la
 * piste. Depuis le 2026-10-08 le pied montre aussi les seize pas a gauche :
 * la bande ne couvre que sa droite (u0 a u1 de la largeur, 132 a 312 des 320
 * unites), une touche sur les pas ne ramene pas la piste au debut.
 * Au telephone (2026-10-09, l'ecran plus haut) : le pied est en bas du
 * dessin de 158, la bande aussi (les 17 dernieres unites).
 */
export const OLED_BAR_PAGE = { bandY0: 2 * OLED_UH - 34, bandY1: 2 * OLED_UH, u0: 132 / 320, u1: 312 / 320 } as const;

/**
 * Le reste de l'ecran en vue PAGE (2026-10-08, revue de R1), px de la
 * texture : toucher l'ecran ouvre les presets seulement sur son en-tete
 * (openY1 : le pattern, le tempo ; une tape sur un bloc ouvrait les presets,
 * a la surprise de tous) ; les six onglets du pied (desktop) sont six
 * touches de page, de tabY0 a tabY1, sur la largeur u0 a u1 du pied.
 */
export const OLED_PAGE_ZONES = { openY1: 44, tabY0: 2 * OLED_UH - 36, tabY1: 2 * OLED_UH - 4 } as const;

/**
 * Page MIX de l'ecran (2026-10-01, facon Elektron), px de la texture
 * 640 x 240 : cinq cellules de 128 separees par un filet (bone 30 %) ; en
 * haut le nom de la voix (la voix reglee en negatif, dans une etiquette
 * arrondie), au milieu un potard dessine (piste de 270 deg comme les
 * encodeurs, arc de la valeur, aiguille du centre vers le bord), en bas la
 * valeur (0 a 100).
 */
export const OLED_MIX = {
  font: `400 30px ${FONT_MONO}`,
  valueFont: `400 26px ${FONT_MONO}`,
  labelY: 42,
  tag: { w: 94, h: 40, r: 8 },
  dialY: 128,
  r: 40,
  track: 3,
  trackA: 0.35,
  arc: 6,
  needle: 4,
  valueY: 212,
  rule: 2,
  ruleA: 0.3,
  ruleInset: 14,
} as const;

/** level : le volume principal (MASTER) ; vol : le volume de la voix selectionnee (VOLUME). */
/**
 * Deux jeux de potards depuis le 2026-10-01 (demande de Mika) : GLOBAL a
 * gauche, sous RUN/STOP (SWING, STRETCH, DIST, CHORUS, DELAY, REVERB : tout
 * le pattern), VOICE a droite, sous les pads (VOLUME, TONE et les effets de
 * la voix selectionnee). Les potards de voix ont leurs ids (vdecay...) :
 * deux DIST, deux CHORUS... coexistent sur le panneau. DECAY (2026-10-04)
 * remplace le STRETCH de la voix ; STRETCH reste dans GLOBAL, en
 * etirement facon Impulse (audio/stretch.ts).
 */
export type EncId =
  | 'tempo'
  | 'level'
  | 'swing'
  | 'stretch'
  | 'dist'
  | 'chorus'
  | 'delay'
  | 'reverb'
  | 'vol'
  | 'vsound'
  | 'tone'
  | 'vdecay'
  | 'vdist'
  | 'vchorus'
  | 'vdelay'
  | 'vreverb'
  // TUNE, PAN et START de la voix (2026-10-08, l'etape R2 des P-locks) : sur les pages (SRC, AMP, SMPL), pas sur la face
  | 'vtune'
  | 'vpan'
  | 'vstart'
  // L'etape 2 (2026-10-09, audio/voicefx.ts) : ATK et HOLD de ENV, FINE de VOICE, le filtre de FLTR
  | 'vatk'
  | 'vhold'
  | 'vfine'
  | 'vftype'
  | 'vfcut'
  | 'vfreso'
  | 'vfenv'
  | 'vfatk'
  | 'vfdec'
  // DLY TIME et DLY FB (2026-10-09, les encodeurs G et H du desktop : la machine entiere)
  | 'dtime'
  | 'dfb'
  // BIT et COMP (2026-10-10, Mika : "on a deja DELAY, remplace par bit reduction et compressor") : les encodeurs G et H
  | 'bits'
  | 'comp'
  // Les reglages de chaque FX global (2026-10-10, audio/pattern.ts FX_SETTINGS) : sur la page de leur FX
  | 'dtone'
  | 'rsize'
  | 'rtone'
  | 'rpre'
  | 'xtone'
  | 'crate'
  | 'cdepth'
  | 'brate'
  | 'catk'
  | 'crel'
  // Le COMP refait le 2026-10-18 (audio/pattern.ts FX_SETTINGS) : seuil, rapport, genou, rattrapage, HPF de sa chaine laterale
  | 'cthr'
  | 'cratio'
  | 'cknee'
  | 'cmake'
  | 'chpf';

/**
 * Les potards de la rangee VOICE et le parametre de voix qu'ils reglent
 * (audio/voicefx.ts) : sans pad selectionne, ils demandent d'en toucher un
 * (TAP A PAD FIRST). TEMPO, MASTER et la rangee GLOBAL reglent le pattern.
 */
export const VOICE_PARAM = {
  vol: 'level',
  tone: 'tone',
  vdecay: 'decay',
  vdist: 'dist',
  vchorus: 'chorus',
  vdelay: 'delay',
  vreverb: 'reverb',
  vtune: 'tune',
  vpan: 'pan',
  vstart: 'start',
  vatk: 'atk',
  vhold: 'hold',
  vfine: 'fine',
  vftype: 'ftype',
  vfcut: 'fcut',
  vfreso: 'freso',
  vfenv: 'fenv',
  vfatk: 'fatk',
  vfdec: 'fdec',
} as const;
/** Les potards de la rangee VOICE qui reglent un parametre de voix (VOLUME, TONE, DECAY, les effets). */
export type VoiceFxEncId = keyof typeof VOICE_PARAM;
/**
 * SAMPLE (2026-10-05, Mika : "dans les parametres des voices, a droite de
 * Volume, un knob samples selection ; quand on commence a le tourner on voit
 * sur l'ecran la liste des echantillons ; on a appuye sur un voice et la on
 * choisit le sample") : le huitieme potard de la rangee VOICE, a droite de
 * VOLUME, regle le SON de la voix selectionnee (audio/kit.ts : 909, 808, MM,
 * puis ses echantillons) ; l'ecran en montre la liste (state/lcdSamples.ts).
 */
export type VoiceEncId = VoiceFxEncId | 'vsound';
export const VOICE_ENCODERS: readonly VoiceEncId[] = [
  'vol',
  'vsound',
  'tone',
  'vdecay',
  'vdist',
  'vchorus',
  'vdelay',
  'vreverb',
  'vtune',
  'vpan',
  'vstart',
  'vatk',
  'vhold',
  'vfine',
  'vftype',
  'vfcut',
  'vfreso',
  'vfenv',
  'vfatk',
  'vfdec',
];
export const isVoiceEnc = (id: EncId): id is VoiceEncId => (VOICE_ENCODERS as readonly string[]).includes(id);

/** Potards a zero au centre (-1 a 1) : TONE et STRETCH ; TUNE et PAN de la voix (2026-10-08) ; FINE et l'ENV du filtre (2026-10-09). */
export const BIPOLAR: readonly EncId[] = ['tone', 'stretch', 'vtune', 'vpan', 'vfine', 'vfenv'];
export const isBipolar = (id: EncId): boolean => BIPOLAR.includes(id);

/**
 * Le crossfader (2026-10-27, la phase 2) : resyncMs, une re-programmation bornee pendant un glisser (pointeur fin) ;
 * settleMs, la fin d'un geste MIDI (le silence) ; screenGapMs, l'ecran redessine au plus toutes les 100 ms pendant un
 * glisser ; readoutMs, la ligne XFADE A 70 · B 30 au plus toutes les 120 ms.
 */
export const XFADE_UI = { resyncMs: 240, settleMs: 120, screenGapMs: 100, readoutMs: 120 } as const;

/**
 * La part allumee du segment j (0 a 26) pour une course t : de 0 a t ; a zero au centre, du milieu a t, le segment du
 * milieu toujours a KNOB_RING.center au moins. Pure (2026-10-27) : les anneaux 3D (scene/encoders.ts) et ceux de la
 * machine sans WebGL (fallback/StaticMachine.tsx) la lisent.
 */
export function ringLit(j: number, t: number, bipolar: boolean): number {
  const n = KNOB_RING.segments;
  const v = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) * n : 0;
  const mid = n / 2;
  const lo = bipolar ? Math.min(mid, v) : 0;
  const hi = bipolar ? Math.max(mid, v) : v;
  const f = Math.min(1, Math.max(0, Math.min(hi, j + 1) - Math.max(lo, j)));
  return bipolar && j === Math.floor(mid) ? Math.max(f, KNOB_RING.center) : f;
}

/**
 * Les teintes de l'anneau d'un potard de la face (2026-10-27, les potards suivent la page) : la couleur de ses segments
 * allumes et leur part (k, 0 a 1 ; des LED mono du materiel, un niveau) ; base : l'orange des pas mis, l'anneau de la
 * phase 1 ; off : tout eteint (rien sous le potard, un dessin, un reglage de voix sans voix). En P-LOCK (P2-13) : lock, le
 * jaune du P-LOCK (le bloc verrouille sur ce pas ; un ambre plus sombre sur la machine claire), unlocked, l'orange a 45 %
 * (il lit la valeur de la voix, le tourner pose le verrou), global, l'orange a 30 % (un FX global ou un reglage sans
 * verrou : il refuse le P-LOCK).
 */
export type KnobTone = 'base' | 'off' | 'lock' | 'unlocked' | 'global' | 'scene' | 'dim';
/** L'ambre du P-LOCK sur la machine claire (le jaune vif s'y perd). */
const RING_LOCK_LIGHT = '#E09A10';
export interface RingTone {
  on: string;
  k: number;
}
/*
 * V.5.0 (2026-10-29, la langue des couleurs de la Digitakt, DT_HEX) : base le blanc, lock le jaune, unlocked le blanc a 45 %,
 * global le blanc a 30 %, scene le bleu, dim le blanc a 15 % ; les anneaux n'existent qu'au desktop (le telephone n'en a
 * pas). applyAppearance les relit.
 */
export const RING_TONE: Record<KnobTone, RingTone> = {
  base: { on: DT_HEX.white, k: 1 },
  off: { on: DT_HEX.white, k: 0 },
  lock: { on: DT_HEX.yellow, k: 1 },
  unlocked: { on: DT_HEX.white, k: 0.45 },
  global: { on: DT_HEX.white, k: 0.3 },
  // Une scene armee (2026-10-27, P2-19) : scene, le bleu des scenes depuis V.5.0 (l'os de la DA avant) ; dim, un bloc NO
  // SCENE (un choix de son)
  scene: { on: DT_HEX.blue, k: 1 },
  dim: { on: DT_HEX.white, k: 0.15 },
};
/** La bande du crossfader des anneaux (V.5.0) : le bleu des scenes. */
export const RING_BAND: { on: string } = { on: DT_HEX.blue };

/**
 * Dans l'ordre de lecture (2026-10-01) : MASTER au-dessus de TEMPO, a
 * droite de l'ecran ; la rangee GLOBAL a gauche (SWING, STRETCH, puis les
 * effets dans l'ordre du signal : DIST, CHORUS, DELAY, REVERB) ; la rangee
 * VOICE a droite (VOLUME, TONE, STRETCH et les memes effets, pour la voix
 * selectionnee). MASTER est l'ancien LEVEL, le volume principal seul.
 * aria : nom du jumeau (role slider).
 */
export const ENCODERS: readonly { id: EncId; label: string; aria: string }[] = [
  { id: 'level', label: 'MASTER', aria: 'Master volume' },
  { id: 'tempo', label: 'TEMPO', aria: 'Tempo' },
  { id: 'swing', label: 'SWING', aria: 'Global swing' },
  { id: 'stretch', label: 'STRETCH', aria: 'Global time stretch, shorter or longer hits at the same pitch' },
  { id: 'dist', label: 'DIST', aria: 'Global distortion' },
  { id: 'chorus', label: 'CHORUS', aria: 'Global chorus' },
  { id: 'delay', label: 'DELAY', aria: 'Global delay' },
  { id: 'reverb', label: 'REVERB', aria: 'Global reverb' },
  { id: 'vol', label: 'VOLUME', aria: 'Voice volume' },
  { id: 'vsound', label: 'SAMPLE', aria: 'Voice sample, the sound of the selected voice' },
  { id: 'tone', label: 'TONE', aria: 'Voice tone, pitch and filter' },
  { id: 'vdecay', label: 'DECAY', aria: 'Voice decay, a shorter tail' },
  { id: 'vdist', label: 'DIST', aria: 'Voice distortion' },
  { id: 'vchorus', label: 'CHORUS', aria: 'Voice chorus' },
  { id: 'vdelay', label: 'DELAY', aria: 'Voice delay' },
  { id: 'vreverb', label: 'REVERB', aria: 'Voice reverb' },
  // Sur les pages seulement (2026-10-08) : SRC TUNE, AMP PAN, SMPL START ; PITCH de VOICE, PAN et START de ENV depuis le 2026-10-09
  { id: 'vtune', label: 'PITCH', aria: 'Voice pitch, in semitones' },
  { id: 'vpan', label: 'PAN', aria: 'Voice pan, left to right' },
  { id: 'vstart', label: 'START', aria: 'Voice sample start' },
  // L'etape 2 (2026-10-09) : ENV, FINE, le filtre de FLTR (sur les pages), DLY TIME et DLY FB (les encodeurs G et H)
  { id: 'vatk', label: 'ATK', aria: 'Voice envelope attack' },
  { id: 'vhold', label: 'HOLD', aria: 'Voice envelope hold' },
  { id: 'vfine', label: 'FINE', aria: 'Voice fine tune, in cents' },
  { id: 'vftype', label: 'TYPE', aria: 'Voice filter type, low pass, high pass or band pass' },
  { id: 'vfcut', label: 'FREQ', aria: 'Voice filter frequency' },
  { id: 'vfreso', label: 'RESO', aria: 'Voice filter resonance' },
  { id: 'vfenv', label: 'ENV', aria: 'Voice filter envelope amount' },
  { id: 'vfatk', label: 'F.ATK', aria: 'Voice filter envelope attack' },
  { id: 'vfdec', label: 'F.DEC', aria: 'Voice filter envelope decay' },
  { id: 'dtime', label: 'DLY TIME', aria: 'Global delay time' },
  { id: 'dfb', label: 'DLY FB', aria: 'Global delay feedback' },
  { id: 'bits', label: 'BIT', aria: 'Global bit reduction' },
  { id: 'comp', label: 'COMP', aria: 'Global compressor' },
  { id: 'dtone', label: 'DLY TONE', aria: 'Delay tone, the low pass of the echoes' },
  { id: 'rsize', label: 'REV SIZE', aria: 'Reverb size, the length of its tail' },
  { id: 'rtone', label: 'REV TONE', aria: 'Reverb tone, the brightness of its tail' },
  { id: 'rpre', label: 'REV PRE', aria: 'Reverb pre-delay' },
  { id: 'xtone', label: 'DIST TONE', aria: 'Distortion tone, the low pass after the drive' },
  { id: 'crate', label: 'CHO RATE', aria: 'Chorus rate' },
  { id: 'cdepth', label: 'CHO DEPTH', aria: 'Chorus depth' },
  { id: 'brate', label: 'BIT RATE', aria: 'Bit reduction sample rate divider' },
  { id: 'catk', label: 'COMP ATK', aria: 'Compressor attack' },
  { id: 'crel', label: 'COMP REL', aria: 'Compressor release, AUTO at the top' },
  { id: 'cthr', label: 'COMP THR', aria: 'Compressor threshold' },
  { id: 'cratio', label: 'COMP RATIO', aria: 'Compressor ratio' },
  { id: 'cknee', label: 'COMP KNEE', aria: 'Compressor knee' },
  { id: 'cmake', label: 'COMP MAKEUP', aria: 'Compressor makeup gain, AUTO at the bottom' },
  { id: 'chpf', label: 'COMP HPF', aria: 'Compressor sidechain high pass' },
];

/** Libelle serigraphie d'un encodeur (l'ecran l'affiche aussi : VOLUME 80%). */
export const encLabel = (id: EncId): string => ENCODERS.find((e) => e.id === id)?.label ?? id.toUpperCase();
/**
 * Les six touches de page du desktop (V.5.0, 2026-10-29, l'ordre de la Digitakt) : la page de chacune (rytm/pages.ts
 * RytmPageId ; SRC ouvre la page voice, AMP la page env, les ids d'avant) et sa touche de la rangee.
 */
export const DT_PAGE_KEYS = [
  { id: 'trig', btn: 'trig', label: 'TRIG' },
  { id: 'voice', btn: 'src', label: 'SRC' },
  { id: 'fltr', btn: 'fltr', label: 'FLTR' },
  { id: 'env', btn: 'amp', label: 'AMP' },
  { id: 'fx', btn: 'fx', label: 'FX' },
  { id: 'mod', btn: 'mod', label: 'MOD' },
] as const;
export const XFADE = {
  x: fpX((RYTM_FACEPLATE.scenes.xfade.x0 + RYTM_FACEPLATE.scenes.xfade.x1) / 2),
  z: fpZ(RYTM_FACEPLATE.scenes.xfade.y),
  slot: { w: fpU(RYTM_FACEPLATE.scenes.xfade.x1 - RYTM_FACEPLATE.scenes.xfade.x0), d: fpU(RYTM_FACEPLATE.scenes.xfade.slot), h: 0.005 },
  cap: { w: fpU(RYTM_FACEPLATE.scenes.xfade.cap.w), d: fpU(RYTM_FACEPLATE.scenes.xfade.cap.h), h: fpU(RYTM_FACEPLATE.scenes.xfade.cap.z), radius: 0.05, mark: { w: 0.03, d: 0.5 } },
} as const;
/** Le centre du capuchon du crossfader a x (2026-10-27, P2-20 : 0 au bout de la scene A, 1 au bout de la scene B). */
export const xfadeCapX = (x: number): number => XFADE.x + (Math.max(0, Math.min(1, x)) - 0.5) * (XFADE.slot.w - XFADE.cap.w);

/**
 * Temoin des boutons du transport (2026-10-01) : un fin trait lumineux sur
 * le dessus, pres du bord arriere (back : du bord a son centre), comme un
 * guide de lumiere. Eteint, une fente discrete (line) ; allume, l'orange
 * des pas programmes (ledSet), jaune (yellowHi) sur RUN, rouge. RUN/STOP, MUTE et SOLO restent allumes tant
 * que leur etat dure (lecture, voix coupee, solo) ; chaque appui le fait
 * briller flashMs (plein sur hold de sa duree, puis il s'eteint), le seul
 * signe de CLEAR et RANDOM, boutons a un coup.
 */
export const BTN_LED = { w: 0.46, d: 0.05, back: 0.13, y: 0.002, flashMs: 520, hold: 0.5 } as const;
/** Les sections du panneau : les cinq pages, GOODIES, MERCH et STUDIO (puces de la vue eclatee). */
export type SectionId = PageId | 'goodies' | 'merch' | 'studio';
export type PadId = Inst | PageId | 'open' | 'edit';

/** Les cinq pages, dans l'ordre du site (onglets de la feuille, touches 1 a 5). */
export const PAGES: readonly { id: PageId; label: string; key: string }[] = [
  { id: 'tracks', label: 'TRACKS', key: '1' },
  { id: 'mixtapes', label: 'MIXTAPES', key: '2' },
  { id: 'shows', label: 'SHOWS', key: '3' },
  { id: 'press', label: 'PRESS', key: '4' },
  { id: 'contact', label: 'CONTACT', key: '5' },
];
export const isPage = (s: string | null): s is PageId => PAGES.some((p) => p.id === s);

/**
 * Frappe d'un pad (spec 20.3.5), en ms. Un appui immobile de plus de
 * 400 ms n'active rien (regle du brief, spec 20.1 R2-1) : plus de charley
 * ouvert au pointeur.
 */
export const PAD_FX = {
  downMs: 60,
  upMs: 180,
  flashMs: 120,
  /** coup du sequenceur : flash seul, sans mouvement */
  seqFlashMs: 100,
} as const;

/**
 * Retroeclairage des pads (spec 20.3.5), emissif lineaire du dessus (le
 * dome et le dessus plat, 55 % sur les flancs), cale sur la couleur
 * AFFICHEE par lecture de pixels (section 19 point 22) :
 * voix : flash jaune vif (#F2C230) 120 ms a la frappe, 100 ms par coup du
 * sequenceur ; l'instrument selectionne reste en blanc chaud faible ;
 * pages : jaune faible en permanence, plus fort au survol (souris), jaune
 * vif (yellowHi #FFD75E) pour la page ouverte, une seule a la fois ;
 * OPEN : jaune faible, yellowHi pendant l'ouverture et vue ouverte.
 */
export const PAD_GLOW = {
  /** dessus 241,193,74 (#F2C230 : 242,194,48, le bleu hors gamut sous l'ACES) */
  flash: [1.2, 0.42, 0],
  /**
   * la voix choisie, blanc chaud. 2026-10-22 (audit SB-04) : dessus vers 78,74,66 (le caoutchouc 18,17,16 plus 60
   * niveaux) ; avant [0.011, 0.0105, 0.0085], 29 contre 17 sur les autres pads : on ne voyait pas quelle voix l'ecran,
   * les pas et les P-locks modifient
   */
  selected: [0.062, 0.057, 0.046],
  /** dessus 40,34,18 : environ 10 % de jaune sur le caoutchouc */
  faint: [0.022, 0.016, 0.001],
  /** dessus 86,71,24 : environ 30 % */
  hover: [0.085, 0.06, 0.003],
  /** dessus 246,223,124 (#FFD75E : 255,215,94, meme limite de gamut) */
  active: [1.8, 0.85, 0.02],
  /** OPEN, machine fermee (revision 4) : orange plein, l'action qui transforme la page */
  orange: [1.6, 0.2, 0.004],
  /** OPEN devenu CLOSE, machine ouverte : orange faible */
  orangeDim: [0.16, 0.024, 0],
  /** voix coupee (2026-10-07, Mika : "Mute en rouge, type LED a travers un caoutchouc") : une LED rouge allumee sous le pad */
  muted: [0.62, 0.025, 0.012],
} as const;

/**
 * Intensite du halo additif autour de chaque pad, par etat (jaune, ou
 * blanc chaud pour la selection, lineaire x intensite) : +20 niveaux au
 * ras d'une page au repos, +75 autour de la page ouverte.
 */
// selected 0.025 -> 0.08 (2026-10-22, audit SB-04) : la voix choisie a son halo, plus faible que celui de la page ouverte
export const PAD_HALO = { selected: 0.08, faint: 0.025, hover: 0.06, active: 0.35, flash: 0.45, orange: 0.3, orangeDim: 0.06, muted: 0.22 } as const;

/**
 * Pads de voix coupes ou en solo (2026-10-01, demande de Mika) : le
 * caoutchouc change de teinte, meme matiere (rugosite, dome, flancs) ;
 * SOLO en bleu ; MUTE en rouge depuis le 2026-10-07 (Mika : "je n'aime pas
 * la couleur du Mute ; mieux en rouge, type LED a travers un caoutchouc") :
 * un rouge profond et sa LED allumee dessous (PAD_GLOW.muted, le dessus
 * plus lumineux que les flancs). Couleurs AFFICHEES visees, converties par
 * pads.ts en multiplicateur du caoutchouc. Le solo passe avant le mute
 * (state/voices.ts). La machine claire a les siennes (applyAppearance).
 */
export const VOICE_TINT = { mute: '#4A0F0C', solo: '#2B5896' };

/**
 * Le coup d'une voix sur la machine claire (2026-10-07, Mika : "en light
 * mode, le petit eclairage quand les voix jouent est jaunatre, difficile a
 * voir") : le caoutchouc passe a l'orange franc le temps du flash (un
 * multiplicateur de sa couleur, comme OPEN), en plus de sa lueur. null : la
 * lueur seule (la machine noire, ou le jaune se voit).
 */
export const FLASH_TINT: { rgb: number[] | null } = { rgb: null };

/**
 * OPEN respire (2026-10-01, demande de Mika : le pad lui-meme, plus le
 * carre lumineux pose sur son jumeau) : son retroeclairage et son halo
 * descendent a min puis remontent, une sinusoide de periodMs, machine
 * fermee seulement ; ni en mouvement reduit, ni au palier mobile (le Dock
 * a son bouton OPEN qui respire deja). Sa teinte (OPEN_TINT) suit, de
 * tintMin a 1 : sur la machine claire l'orange plein sature, la lumiere
 * seule ne se voyait pas (246,112,63 a 248,119,78 mesure). Une image
 * toutes les frameMs (20 par seconde), sans passe d'ombre : la boucle ne
 * dort plus machine fermee, mais ne rend que la lumiere.
 */
// faceMin (2026-10-27, la touche OPEN de la face V.4.0 du desktop) : le creux de l'eclat de son dessus, toujours a
// l'orange plein (scene/rytmFaceKeys.ts state). Mesure a 1440 x 900 : machine noire, 233,97,54 au creux pour 244,112,58
// au haut, RUN/STOP au repos 192,69,50 (CIE76 17 au creux ; 14 a 0.7, 4 a l'ancien 0.45) ; machine claire, 246,129,69
// a 247,129,74 (l'orange plein, plus de peche)
export const OPEN_BREATHE = { periodMs: 3200, min: 0.45, tintMin: 0.5, frameMs: 50, faceMin: 0.8 } as const;

/**
 * Les encodeurs sont-ils sur la face ? Au desktop depuis le 2026-10-08 ; au
 * telephone de nouveau depuis le 2026-10-19 (les FX globaux, comme au desktop).
 */
export const PAGE_KNOBS_ON_FACE = true;
/**
 * Les huit potards de la face suivent la page (2026-10-27, Mika : "ils devraient etre assignes aux fonctions de la page
 * qui est cliquee, comme la DIGITAKT ; les knobs de droite doivent se refleter") : au desktop, le potard k tourne le bloc
 * pose dans la case k de l'ecran (rytm/pages.ts faceBlockOf, rytm:knob:k+1) ; le telephone garde ses FX globaux (phase 5).
 */
export const FACE_FOLLOWS_PAGE: boolean = !PORTRAIT;
/**
 * Les capuchons des potards de la face vont a leur nouvelle valeur comme des potards motorises (2026-10-27) : une page,
 * une voix, l'entree ou la sortie du P-LOCK ; 60 ms plus 160 ms pour toute la course (d de 0 a 1), easeInOutCubic ; les
 * anneaux (des LED) sautent ; un potard tourne a la main, la reduction des animations, une autre valeur : tout de suite.
 */
export const KNOB_MOTOR = { baseMs: 60, fullMs: 160, ms: (d: number): number => 60 + 160 * Math.min(1, Math.abs(d)) } as const;
/** Un potard glisse a la souris (2026-10-27) : la passe d'ombre une seule fois, ce temps apres le dernier mouvement. */
export const KNOB_SHADOW_MS = 120;
/**
 * Le telephone (2026-10-09) : les huit blocs de l'ecran se glissent au doigt (un
 * glisser vertical, deux tapes, le LOCK a deux doigts) ; les cartes INFOS y
 * parlent de tapes, pas de clics ni de molette (rytm/infos.ts).
 */
export const BLOCKS_ARE_KNOBS = PORTRAIT;

/**
 * Les huit encodeurs de la face, a poste fixe depuis le 2026-10-09 (l'etape
 * 2, Mika : "en desktop tu les laisses mais par contre ils ne servent qu'a
 * faire les modifs des FX globaux de la machine ; les FX des parameters lock
 * se font dans l'ecran") : A DIST (kick compris depuis le 2026-10-18), B CHORUS,
 * C DELAY, D REVERB (le bus des voix, sans le kick : NO BD), E STRETCH, F SWING (toute la machine), G BIT
 * et H COMP. Jamais un verrou,
 * meme en P-LOCK ; tournes, l'ecran montre leur valeur un instant (le
 * popup), sans changer de page. Leur nom est serigraphie a leur place (la
 * lettre d'avant), leurs zones gardent leurs ids (penc-0 a penc-7). Le MIDI
 * rytm:knob:1 a 8 garde son sens : le bloc k de la page a l'ecran (le Roto).
 * Au telephone aussi depuis le 2026-10-19.
 */
export const GLOBAL_ENCODERS: readonly EncId[] = ['dist', 'chorus', 'delay', 'reverb', 'stretch', 'swing', 'bits', 'comp'];
export const isPageKnob = (id: string): id is PageKnobId => (PAGE_KNOB_IDS as readonly string[]).includes(id);
/** Le rang (0 a 7) d'un potard de page. */
export const pageKnobIndex = (id: PageKnobId): number => PAGE_KNOB_IDS.indexOf(id);

/**
 * Les noms imprimes sur les touches (2026-10-18, Mika : "au lieu d'ecrire les
 * choses en dessous des boutons je voudrais que ce soit ecrit directement sur
 * le bouton") : VOICE FLTR ENV FX et RUN/STOP CLEAR RANDOM MUTE SOLO, au
 * centre de leur dessus, dans la police et l'interlettrage de la serigraphie
 * (SILK), en capitales. scene/keyLabels.ts les peint dans une seule texture
 * (deux variantes par nom : l'encre sur une touche eteinte, le noir sur une
 * touche allumee) et pose un petit plan sur chaque touche, qui s'enfonce avec
 * elle. cap : la hauteur de capitale ; dz : le centre du nom, un rien en avant
 * du centre (le temoin est pres du bord arriere) ; margin : l'air a chaque
 * bout (le corps reduit pour tenir, le plus petit de son groupe pour tous,
 * comme la serigraphie) ; au telephone (des touches plus larges, le doigt) un
 * corps plus gros.
 */
// Plus petits le 2026-10-18 (Mika : "les ecritures sur les boutons sont vraiment trop grosses") : un peu moins que le
// nom des encodeurs GLOBAL FX au desktop (0.085 et 0.12 avant)
// 2026-10-22 (audit SB-06) : lisibles sans revenir aux gros corps refuses par Mika ; un rien plus grands (toujours sous le
// nom des encodeurs : 0.062 contre 0.065 au desktop, 0.094 contre 0.1 au telephone), en 700 au lieu de 600, l'encre au
// repos pleine (inkRest : l'os a 0.96 sur la machine noire, un charbon sur la claire ; silkA(0.85) avant, 3 a 3.7:1)
export const KEY_LABEL = PORTRAIT
  ? ({ cap: 0.094, dz: 0.03, margin: 0.1, weight: 700, inkRest: { dark: 'rgba(246, 241, 231, 0.96)', light: 'rgba(38, 38, 41, 0.96)' } } as const)
  : ({ cap: 0.062, dz: 0.024, margin: 0.08, weight: 700, inkRest: { dark: 'rgba(246, 241, 231, 0.96)', light: 'rgba(38, 38, 41, 0.96)' } } as const);
/** La largeur des signes d'une legende (en unites) : chacun sa largeur, l'air entre eux. */
export const marksW = (m: readonly FpMark[]): number => m.reduce((w, k, i) => w + (k === 'play' ? KEY_MARK.h * KEY_MARK.playW : KEY_MARK.h) + (i > 0 ? KEY_MARK.gap : 0), 0);
/** Le rond de REC (V.5.0, 2026-10-29) : son diametre, en part de la hauteur des signes (le carre de STOP en fait 1). */
export const REC_MARK_D = 1;
/**
 * L'ecran du MM-RYTM se touche-t-il (V.4.2, 2026-10-27, Mika : "Pourrais tu faire en sorte qu'on ne puisse pas toucher a
 * l'ecran ? qu'on puisse toujours utiliser les knobs et boutons") : un seul interrupteur. Faux au desktop (la face a ses
 * huit potards et ses touches : l'ecran ne fait que montrer, le pointeur le traverse comme le corps de la machine, ses
 * jumeaux HTML restent pour le clavier et les lecteurs d'ecran) ; vrai au telephone (sans potards, il se touche) ; le
 * futur kiosque ?hw=1 (l'ecran tactile du boitier) le voudra vrai. scene/hit.ts HitMap.screenTouch, ui/Hotspots.tsx.
 */
export const SCREEN_TOUCH: boolean = PORTRAIT;

/**
 * Les commandes de la face visibles et inertes : curseur par defaut, rien ne part. Vide depuis P2-20 (2026-10-27) : TRK,
 * SCENE A et B, puis le crossfader agissent.
 */
export const FACE_INERT: ReadonlySet<string> = new Set<string>();

/**
 * Une touche selectionnee s'allume en entier (2026-10-18, Mika : "quand c'est
 * selectionne que ce soit plus voyant") : la page montree (pas en vue HOME :
 * son temoin a peine, comme avant), RUN/STOP pendant la lecture, MUTE tant que
 * des voix sont coupees (une tape les rend toutes) et SOLO arme ou tant que des
 * voix sont en solo (state/voices.ts lit), CLEAR et RANDOM le temps de leur
 * eclair. Le
 * dessus prend la couleur de son temoin, lumineux comme une touche Elektron
 * allumee (glow : l'emissif lineaire, par couleur ; RUN plus chaud que le
 * rouge de MUTE, sur son rouge), le nom passe au noir au-dela de dark ; le
 * temoin reste l'accent, sa couleur tiree vers le blanc de ledWhite (sinon il
 * disparait dans la touche). La machine claire (KEY_LIT_LIGHT, applyAppearance) :
 * le dessus prend aussi la teinte (tint, albedo lineaire), l'emissif seul
 * palissait en peche, comme l'appui (PRESS_TINT).
 */
/*
 * V.5.0 (2026-10-29, la langue des couleurs de la Digitakt, DT_HEX) : les teintes de la face du desktop, d* (dred : les
 * coups, REC, la page, la voix choisie ; dgreen : PLAY, le mute global ; dwhite : la tete de lecture, les flashs ;
 * dmagenta : le mute du pattern ; dblue : les scenes ; dorange : FUNC) ; le telephone garde orange, run, red et blue.
 */
// dyellow (V.5.1, 2026-10-29) : un lock trig sur les pas (le jaune des verrous de la Digitakt, DT_HEX.yellow)
export type KeyLitTone = 'orange' | 'run' | 'red' | 'blue' | 'dred' | 'dgreen' | 'dwhite' | 'dmagenta' | 'dblue' | 'dorange' | 'dyellow';
export const KEY_LIT = {
  // Cales par lecture de pixels a 1440 x 900 (2026-10-18) : orange 244,110,56 (l'orange d'OPEN : 235,111,38), RUN 243,97,62
  // (au repos 192,70,52), MUTE 239,59,57, SOLO 97,133,230 ; plus fort, l'ACES les palissait en peche (252,160,75)
  // V.5.0 : les teintes d* a 0.9 de leur couleur lineaire environ (le blanc plus bas, il eblouissait)
  glow: {
    orange: [0.95, 0.08, 0],
    run: [0.5, 0.015, 0],
    red: [0.8, 0, 0],
    blue: [0.03, 0.15, 1.05],
    dred: [0.9, 0.012, 0.012],
    dgreen: [0.035, 0.62, 0.08],
    dwhite: [0.6, 0.58, 0.54],
    dmagenta: [0.66, 0.05, 0.6],
    dblue: [0.05, 0.3, 0.95],
    // La revue de D1 (R7) : 0.16 de vert (0.08 lisait a 11 degres de teinte, pres du rouge d'une touche allumee)
    dorange: [0.95, 0.16, 0],
    // V.5.1 : le jaune #FFD75E des lock trigs (lineaire 1, 0.68, 0.11), un peu plus sature (l'ACES le palissait en paille)
    dyellow: [0.9, 0.52, 0.03],
  } as Readonly<Record<KeyLitTone, readonly number[]>>,
  dark: 0.4,
  ledWhite: 0.55,
} as const;
/** La machine claire : la teinte du dessus allume (null : l'emissif seul, la machine noire) et l'echelle de l'emissif. */
export const KEY_LIT_LIGHT: { tint: Readonly<Record<KeyLitTone, readonly number[]>> | null; glow: number } = { tint: null, glow: 1 };

/**
 * Les pas allumes par leur velocite (2026-10-19, Mika : "je veux que les boutons
 * soient allumes au complet sur le step quand la velocite est a 127 ; les trois
 * barres au-dessus, ca casse le design") : un pas mis s'allume en entier, le
 * dessus a l'orange des touches allumees (KEY_LIT.glow.orange, la teinte de
 * KEY_LIT_LIGHT sur la machine claire), plein a la velocite la plus forte (127 a
 * l'ecran), de moins en moins pour les autres ; un pas vide reste eteint.
 * ramp : la part de l'orange pour chacun des neuf niveaux (0 : vide), calee par
 * lecture de pixels pour que les neuf se distinguent (du rouge sombre a l'orange
 * plein, a peu pres le meme ecart de l'un a l'autre a l'ecran).
 * head : la tete de lecture (et le test de l'intro), un blanc chaud ajoute au
 * pas (vide : headEmpty ; sur la machine claire, ou l'emissif se perd, le dessus
 * tire vers le jaune chaud de headLight, a headLightMix) ; hover : le pas sous
 * la souris, a peine ; lock et
 * lockDim : le pas en LOCK qui clignote (un jaune clair, puis sa lueur) ;
 * locks : un pas vide qui porte des verrous (un trig sans note, a peine) ; la
 * marque des verrous (KEYS.lockMark) dit le reste. EDIT (les pas sont les
 * patterns) : le pattern courant plein, celui qui attend, ceux de la chaine, un
 * pattern plein (la part de l'orange). lightFloor : sur la machine claire, la
 * teinte d'un pattern d'EDIT part de cette part (le plus doux s'y voit encore).
 * lightRamp : sur la machine claire, la teinte d'un pas mis a chacun des neuf
 * niveaux (0 : vide), reguliere (relecture du 2026-10-19 : ramp, calee pour la
 * lueur de la machine noire, serrait les niveaux 1 a 5 en quelques pour cent de
 * teinte, a peine distincts) ; ramp garde l'emissif.
 */
/*
 * V.5.0 (2026-10-29, la Digitakt, au desktop) : la tete de lecture en blanc pur (le blanc chaud avant ; l'encre sombre sur
 * la machine creme), le pas en LOCK clignote en jaune ; la vue PTN : le pattern qui joue rouge plein, le suivant et la
 * chaine rouges clignotants, un pattern plein blanc faible (dtEdit). Le telephone garde ses valeurs.
 */
export const STEP_LIT = {
  ramp: [0, 0.075, 0.115, 0.165, 0.225, 0.3, 0.39, 0.51, 0.69, 1] as readonly number[],
  lightRamp: [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] as readonly number[],
  head: PORTRAIT ? [0.34, 0.24, 0.1] : [0.3, 0.3, 0.29],
  headEmpty: PORTRAIT ? [0.11, 0.085, 0.05] : [0.1, 0.1, 0.098],
  headLight: PORTRAIT ? [1.0, 0.72, 0.18] : [0.012, 0.012, 0.012],
  headLightMix: 0.6,
  lightFloor: 0.12,
  hover: [0.018, 0.016, 0.012],
  lock: PORTRAIT ? [0.62, 0.42, 0.1] : [0.72, 0.56, 0.05],
  lockDim: PORTRAIT ? [0.07, 0.045, 0.008] : [0.08, 0.062, 0.005],
  locks: [0.03, 0.012, 0.002],
  edit: { cur: 1, next: 0.51, chain: 0.3, filled: 0.115 },
  /** la vue PTN du desktop (V.5.0) : le courant, le suivant et la chaine (clignotants), un pattern plein (blanc) */
  dtEdit: { cur: 1, next: 1, chain: 0.6, filled: 0.2, blinkMs: 260 },
  /** un lock trig (V.5.1, au desktop) : le pas allume en jaune (dyellow), a cette part ; sans velocite, il ne joue pas */
  lockTrig: 0.9,
} as const;
/** La teinte d'un pas mis (V.5.0) : le rouge de la Digitakt au desktop, l'orange de la machine au telephone. */
export const STEP_TONE: KeyLitTone = PORTRAIT ? 'orange' : 'dred';

/**
 * Tenir une touche (2026-10-27, la phase 2) : TRK, SCENE A et B ; plus court, c'est une tape (la touche se garde) ; la
 * valeur de LOCK_HOLD_MS (ui/Hotspots.tsx) et de HOLD_MS (midi/seqlink.ts), qui gardent leur constante.
 */
export const FACE_HOLD_MS = 350;

/**
 * Les gestes de la face facon Digitakt (V.5.0, 2026-10-29, docs/v4/digitakt-d1-spec.md section 3), en ms : FUNC tapee deux
 * fois dans funcDoubleMs se garde ; une touche de page tapee reste tenue pour YES et NO pageArmMs ; STOP deux fois dans
 * stopDoubleMs coupe les queues ; un pas tenu muteHoldMs en mode MUTE passe sa voix en SOLO ; TEMPO : la moyenne apres
 * tapTaps tapes, une pause de tapResetMs recommence ; un rappel (REC TO WRITE STEPS) au plus toutes les hintMs.
 */
/** REC au clavier (V.5.0) : W, R etant RESET VIEW depuis toujours. */
export const REC_KEY = 'W';
export const DT_GESTURE = { funcDoubleMs: 400, pageArmMs: 1500, stopDoubleMs: 600, muteHoldMs: 400, tapTaps: 4, tapResetMs: 2000, hintMs: 2000 } as const;

/**
 * TRK d'une seule couleur (V.4.2, 2026-10-27, Mika : "je veux des boutons d'une meme couleur et pas arc en ciel") : les
 * pas 1 a 8 a l'orange d'un pas allume (KEY_LIT.glow.orange ; la teinte de KEY_LIT_LIGHT sur la machine claire), la voix
 * choisie plus forte (TRK_LIT) ; les couleurs par voix (2026-10-27) sont parties.
 *
 * Et les coups qui flashent (Mika : "que les 8 voices puissent jouer en meme temps dans les carres, comme ca je repere
 * plus facilement ce qui joue ; que ca flashe quand il y a un step qui passe par dessus") : pendant la lecture, le carre
 * d'une voix s'eclaire a l'instant ou elle frappe (l'heure audio, comme la tete de lecture) puis s'eteint en ms (une
 * decroissance au carre, rapide) ; glow, l'eclat ajoute au plus fort (un orange plus clair et plus chaud que celui du pas,
 * il reste de la couleur de la machine) ; sur la machine claire, le dessus fonce et sature vers lightTint (un orange plus
 * profond que celui d'une touche allumee) a la part light de l'eclat, et lightGlow remplace l'echelle de l'emissif
 * (2026-10-27, la revue : tire vers le jaune de la tete de lecture, l'eclair gardait la luminosite du pas, un coup doux se
 * voyait a peine et la voix choisie palissait) ; velFloor, l'eclat de la velocite la plus douce (la plus forte : 1) ;
 * levels, les crans de la decroissance (une image par cran au plus, rien entre deux).
 */
// V.5.0 (2026-10-29) : l'eclair en blanc au desktop (sur le rouge de la vue TRK), l'encre sombre sur la machine creme
export const TRK_FLASH = { ms: 160, glow: PORTRAIT ? [0.7, 0.24, 0.05] : [0.55, 0.54, 0.5], light: 1, lightTint: PORTRAIT ? [1.0, 0.08, 0.0] : [0.02, 0.02, 0.02], lightGlow: 0, velFloor: 0.5, levels: 8 } as const;
/** TRK tenu (2026-10-27) : la voix choisie pleine, les autres lisibles, une voix coupee a peine ; la machine claire plus fort. */
export const TRK_LIT = { cur: 1, other: 0.22, muted: 0.07 } as const;
export const TRK_LIT_LIGHT = { cur: 1, other: 0.35, muted: 0.12 } as const;

/** Appui long sur un pas (revision 4) : il se vide au lieu de changer, en ms. */
export const STEP_HOLD_MS = 400;

/**
 * Deux tapes sur la meme voix en moins de ce temps (2026-10-10) : la voix se coupe ou revient ; sur un pad de la machine
 * au doigt (ui/Hotspots.tsx) et, depuis le 2026-10-22 (la revue : la touche MUTE du Dock le promettait), sur une voix du
 * Dock (ui/Dock.tsx).
 */
export const PAD_DOUBLE_TAP_MS = 400;

/**
 * Appui sur un pas (2026-10-01) : la touche s'enfonce de depth et s'eclaire
 * (emissif glow, lineaire) en downMs, remonte et s'eteint en upMs.
 */
/**
 * L'appui au desktop (V.5.0, la revue de D1, R2) : neutre, comme la Digitakt (l'orange n'est qu'a FUNC) : sur la machine
 * noire un eclat blanc faible (glow, emissif lineaire) ; sur la creme, sans eclat, le dessus fonce vers un gris (tint, albedo
 * lineaire, PRESS_TINT). Le telephone garde son eclat orange.
 */
const DT_PRESS = { glow: [0.06, 0.06, 0.058], light: { glow: [0, 0, 0], tint: [0.32, 0.32, 0.31] } } as const;
export const STEP_PRESS = { depth: 0.045, downMs: 40, upMs: 160, glow: (DT_FACE ? [...DT_PRESS.glow] : [0.16, 0.04, 0.004]) as readonly number[] } as const;

/**
 * Les touches en relief de la face du desktop (V.4.2, 2026-10-27, Mika : "plus avec un effet 3d, parce que je trouve ca
 * plat", scene/keyCap.ts) : on, la face du desktop (le telephone garde ses touches) ; seg, les segments d'un coin ; shade,
 * la teinte par sommet (le pied du flanc, son haut, le chanfrein un rien plus clair qui attrape la lumiere, le dessus :
 * l'ombre de la touche sur elle-meme) et la part de l'eclat d'une touche allumee (glow : le dessus plein, le chanfrein
 * presque, les flancs un peu) ; skirt, l'ombre a son pied sur la face, comme le jour sombre d'une touche dans sa decoupe
 * (sa largeur, son noir a son bord, plus doux sur la machine claire) ; key et step, la course de l'appui
 * (RYTM_FACEPLATE buttons.travel et steps.travel ; STEP_PRESS.depth au telephone).
 */
export const KEY_RELIEF = {
  on: !PORTRAIT,
  seg: 4,
  shade: { foot: 0.42, wall: 0.74, bevel: 1.16, top: 1, glow: { foot: 0.18, wall: 0.4, bevel: 0.85 } },
  skirt: { w: fpU(1.1), alpha: { dark: 0.62, light: 0.4 }, y: 0.0016 },
  key: PORTRAIT ? STEP_PRESS.depth : fpU(RYTM_FACEPLATE.buttons.travel),
  step: PORTRAIT ? STEP_PRESS.depth : fpU(RYTM_FACEPLATE.steps.travel),
} as const;

/**
 * Le survol a la souris (2026-10-22, audit : seuls les pas, les pads et les blocs de l'ecran reagissaient, les encodeurs,
 * les touches de page et le transport ne changeaient que de curseur) : un rien de lumiere chaude sur la touche (glow,
 * emissif lineaire, sous celui d'une touche allumee), l'encodeur un peu plus clair (knob : multiplicateur de sa
 * couleur, le chanfrein s'eclaire ; skirt : sa jupe).
 */
export const HOVER_LIGHT = { glow: [0.018, 0.017, 0.015], knob: 2.2, skirt: 1.25 } as const;

/* ---------- picking (spec 6.2, 6.5 et 20.7) ---------- */

/** Picking, en px CSS. */
export const HIT = {
  /** tactile : un point hors de toute forme compte a moins de 24 px du bord */
  touchSlop: 24,
  /** rectangle cible minimal (jumeaux, zone tactile) : tactile, souris */
  minCoarse: 48,
  minFine: 32,
} as const;

/** Noms parles des instruments : etiquettes aria, Dock. */
export const INST_NAMES: Readonly<Record<Inst, string>> = {
  BD: 'bass drum',
  SD: 'snare',
  TOM: 'tom',
  CH: 'closed hi-hat',
  OH: 'open hi-hat',
  CP: 'clap',
  HT: 'high tom',
  CY: 'cymbal',
};

/**
 * Albedos LINEAIRES des touches (spec 20.3.6), cales sur la couleur
 * AFFICHEE du dessus a 1440 x 900 (vue par defaut) : key #1E1F23 ; run :
 * red #C8442F ; clear : graphiteHi #1C1D21. Depuis le 2026-10-01, RUN,
 * MUTE et SOLO gardent leur teinte allumes : leur etat passe par le temoin
 * (BTN_LED), plus par un bouton entier jaune ou orange.
 */
export const LIT = {
  key: [0.0286, 0.0299, 0.0495],
  run: [0.61, 0.0805, 0.0478],
  clear: [0.0217, 0.0229, 0.0385],
  /** repere des encodeurs : bone */
  mark: [2.8308, 2.6988, 2.4532],
} as const;

/**
 * TEMPO (spec 6.1) : glisser vertical, 100 px = 50 BPM (vers le haut =
 * plus vite) ; molette 1 BPM par cran de 100 px ; double tape = 130.
 * Angle d'un encodeur : 270 deg de course centree sur le repere a 0, sens
 * horaire vu du dessus quand la valeur monte (section 19). Le glisser part
 * au seuil de l'orbite (6 px) ; parti d'un encodeur, il ne fait jamais
 * orbiter la vue : l'axe dominant au seuil le tourne (vers le haut ou vers
 * la droite = plus ; spec 20.17 FX-5, qui remplace la regle verticale de
 * R2-2). Au doigt aussi, tout de suite depuis le 2026-10-01 : un seul
 * doigt ne tourne plus la vue (scene/orbit.ts), plus rien a departager.
 */
export const TEMPO_UI = { pxPerBpm: 2, wheelPx: 100, tapMs: 350, sweepDeg: 270 } as const;

/**
 * Les autres encodeurs : glisser, 150 px = toute la course ; molette
 * 2 % par cran de 100 px ; double tape = valeur de depart (TONE et STRETCH
 * au centre, LEVEL 80 %, SWING, DIST, REVERB, DELAY et CHORUS a 0, leur
 * neutre). Ecran : la valeur reste 1200 ms en ligne 3 (spec 20.3.8). TONE
 * et STRETCH vont de -1 a 1 (leur course fait 2) : molette et fleches de
 * 0.05, pour sortir du cran du centre (+/-0.04) en un pas.
 */
export const POT_UI = {
  pxRange: 150,
  wheelPx: 100,
  wheelStep: 0.02,
  bipolarStep: 0.05,
  readoutMs: 1200,
  reset: {
    level: 0.8,
    swing: 0,
    stretch: 0,
    dist: 0,
    chorus: 0,
    delay: 0,
    reverb: 0,
    vol: 0.8,
    vsound: 0,
    tone: 0,
    vdecay: 1,
    vdist: 0,
    vchorus: 0,
    vdelay: 0,
    vreverb: 0,
    vtune: 0,
    vpan: 0,
    vstart: 0,
    vatk: 0,
    vhold: 0,
    vfine: 0,
    vftype: 0,
    vfcut: 1,
    vfreso: 0,
    vfenv: 0,
    vfatk: 0,
    vfdec: 0.5,
    // La croche pointee, la reinjection d'avant (audio/pattern.ts DELAY_DIVS, DELAY_FB_MAX)
    dtime: 0.4,
    dfb: 2 / 3,
    bits: 0,
    comp: 0,
    // Les reglages des FX (2026-10-10) : deux tapes, le son d'avant (audio/pattern.ts FX_SETTINGS)
    dtone: 0.638,
    rsize: 0.566,
    rtone: 0.442,
    rpre: 0.167,
    xtone: 1,
    crate: 0.624,
    cdepth: 0.5,
    brate: 0,
    // Le COMP (2026-10-18) : ses departs (audio/pattern.ts FX_SETTINGS), -18 dB, 4:1, 10 ms, AUTO, 6 dB, AUTO, 60 Hz
    catk: 0.742,
    crel: 1,
    cthr: 0.45,
    cratio: 0.571,
    cknee: 0.5,
    cmake: 0,
    chpf: 0.5,
  },
} as const;

/** Bornes d'un encodeur hors TEMPO : TONE et STRETCH -1 a 1, les autres 0 a 1. */
export const potMin = (id: EncId): number => (isBipolar(id) ? -1 : 0);
/** Course 0 a 1 d'un encodeur hors TEMPO (angle) : TONE et STRETCH au centre a 0. */
export const potCourse = (id: EncId, v: number): number => (isBipolar(id) ? (v + 1) / 2 : v);

/**
 * SWING (spec 20.8) : les pas pairs (2, 4 ... 16) partent en retard, de 0
 * a un tiers de pas (maxDelay : le shuffle de triolet). L'ecran et le
 * jumeau l'affichent en rapport de doubles croches, 50 % (droit) a 67 %.
 */
export const SWING = { maxDelay: 1 / 3 } as const;
export const swingRatio = (v: number): number => Math.round(50 * (1 + v * SWING.maxDelay));

/* ---------- navigation : sections, panneau, trace (spec 11 et 20.2.7) ---------- */

/** Titres des sections : panneau, onglets, ecran (spec 11.1). */
export const SECTION_TITLES: Readonly<Record<SectionId, string>> = {
  tracks: 'TRACKS',
  mixtapes: 'MIXTAPES',
  press: 'PRESS',
  shows: 'SHOWS',
  contact: 'CONTACT',
  goodies: 'GOODIES',
  merch: 'MERCH',
  studio: 'STUDIO',
};

/**
 * Cadrage quand une section est ouverte (desktop, spec 20.2.5 et R2-6) :
 * la machine glisse a gauche du panneau, centre a stageW / 2 avec
 * stageW = bord gauche du panneau - gap, et tient par son cercle
 * englobant (rayon horizontal : la plus grande distance d'un sommet a
 * l'axe vertical du pivot, measure().fit.radius sur les maillages reels :
 * 7.46 fermee, les coins du chassis ; 8.32 ouverte, le panneau recule ; machine compacte) :
 * aucune orientation ne la fait passer sous le panneau a zoom <= 1.
 * Jamais plus grande qu'au repos.
 */
/** portrait : les rayons de la machine en hauteur (measure().fit.radius : 8.29 fermee, 10.26 ouverte) */
// La face V.4.0 du desktop (2026-10-27) : fermee 7.481 mesure (7.463 avant), arrondi au-dessus ; ouverte, la mesure baisse
// de 0.04 (11.717 contre 11.759) : 8.33 couvre toujours, garde
export const SECTION_FRAME = { ms: 400, gap: 16, radius: PORTRAIT ? { closed: 8.3, open: 10.3 } : { closed: 7.49, open: 8.33 } } as const;

/**
 * Boite du panneau desktop, en phase avec v4.css (.v4-panel) : 460 px au
 * plus a 32 px du bord, jamais plus que la largeur moins 340 px ; sous
 * 1100 px, 420 px a 16 px du bord, largeur moins 280 px au plus.
 */
export const PANEL_BOX = {
  wideMin: 1100,
  wide: { right: 32, maxW: 460, margin: 340 },
  narrow: { right: 16, maxW: 420, margin: 280 },
} as const;

/** Bord gauche du panneau desktop pour une largeur de fenetre W (px CSS). */
export function panelLeft(W: number): number {
  const b = W >= PANEL_BOX.wideMin ? PANEL_BOX.wide : PANEL_BOX.narrow;
  return W - b.right - Math.max(0, Math.min(b.maxW, W - b.margin));
}

/**
 * Trace de l'objet au panneau (spec 11.2 et 20.2.7), px CSS et ms :
 * droite, un ou deux coudes a angle droit, dessinee en 400 ms, un point
 * lumineux la parcourt une fois (350 ms, apres le dessin). L'ancre (le
 * dessus du pad de la page, ou de la puce LIVE ou STUDIO) est reprojetee
 * a chaque frame rendue ; hors du canvas (edgeMargin), a moins de
 * panelMargin du panneau ou cachee par la machine, la trace s'efface
 * (fondu de fadeMs) et le panneau ne bouge jamais.
 */
export const TRACE = {
  drawMs: 400,
  dotDelayMs: 400,
  dotMs: 350,
  fadeMs: 150,
  clearance: 28,
  panelGap: 40,
  anchorDy: 36,
  straightTol: 12,
  minRun: 12,
  edgeMargin: 8,
  panelMargin: 12,
} as const;

/** Feuille mobile (spec 11.3) : fermee par un glisser de 80 px ou un geste vif. */
export const SHEET = { closeDragPx: 80, flickPxPerMs: 0.5, dragSlopPx: 6 } as const;

/** Ecran (spec 5.5 et 20.3.8) : 20 colonnes, compose au plus 4 fois par seconde. */
export const LCD_TEXT = {
  cols: 20,
  tickMs: 250,
  idle: 'MM-RYTM',
  ready: 'READY',
  run: 'RUN',
  loading: 'LOADING',
  paused: 'PAUSED',
  skipped: 'SKIPPED',
  noSignal: 'NO SIGNAL',
  noSignalMs: 4000,
  pendingMs: 8000,
} as const;

export const SILK_LOGOS: readonly { id: SilkLogoId; src: string; x: number; z: number; w?: number; h?: number; align: 'left' | 'right' }[] = [
  { id: 'wordmark', src: '/logo/mauditemachine-logo-aligned.svg', x: HEAD.word.x, z: HEAD.word.z, w: HEAD.word.w, align: 'left' },
  { id: 'mark', src: '/logo/mauditemachine-logotype.svg', x: HEAD.mark.x, z: HEAD.mark.z, h: HEAD.mark.h, align: 'right' },
];
/** Index du libelle du pad OPEN dans SILK_TEXTS (redessine en CLOSE pendant la vue eclatee). */
export const OPEN_SILK_INDEX = SILK_TEXTS.findIndex((t) => t.text === 'OPEN');

/**
 * Filets du panneau (polylignes [x0, z0, x1, z1, ...]) : celui qui separe
 * les voix des pages (a droite de CH, puis sous la rangee des voix) et un
 * crochet sous chaque groupe de quatre touches trig.
 */
// La face V.4.0 du desktop (2026-10-27) : aucun filet (ni la colonne d'OPEN, ni le filet de GLOBAL FX, ni les crochets)
export const SILK_LINES: readonly (readonly number[])[] = [
  // la colonne d'OPEN a part (les deux rangees sont des voix depuis le 2026-10-03)
  ...(PORTRAIT ? [[PAD.x0 + (VOICE_COLS - 0.5) * PAD.pitch, PAD.rowZ[0] - 0.5, PAD.x0 + (VOICE_COLS - 0.5) * PAD.pitch, PAD.rowZ[1] + 0.72]] : []),
  // Revue du 2026-10-09 : un filet sous les noms des touches de page, de la largeur du verre ; les touches et l'ecran
  // d'un cote, les huit encodeurs de l'autre (les noms se lisaient comme ceux des potards) ; sous les touches elles-memes
  // depuis le 2026-10-18 (leurs noms sont dessus) ; au telephone aussi depuis le 2026-10-19 (les encodeurs y reviennent)
  ...(PORTRAIT
    ? [
        [OLED.x - OLED.w / 2, GLOBAL_FX_RULE.z, OLED.x - GLOBAL_FX_RULE.gap, GLOBAL_FX_RULE.z],
        [OLED.x + GLOBAL_FX_RULE.gap, GLOBAL_FX_RULE.z, OLED.x + OLED.w / 2, GLOBAL_FX_RULE.z],
      ]
    : []),
  // Plus de crochets au desktop depuis la face V.4.0 (2026-10-27) : le cadre des temps 1 5 9 13 les marque
  ...(PORTRAIT
    ? [0, 1, 2, 3].map((g) => {
        const a = keyX(4 * g) - KEYS.w / 2;
        const b = keyX(4 * g + 3) + KEYS.w / 2;
        const z = KEYS.bracketZ + keyDz(4 * g);
        const t = z - KEYS.bracketTick;
        return [a, t, a, z, b, z, b, t];
      })
    : []),
];

/* ---------- camera, orbite et cadrage (spec 20.2) ---------- */

export const FRAME_DESKTOP = 0.78;
/** portrait : 0.86, la face avant (plus pres de la camera) touchait les bords a 0.92 */
export const FRAME_MOBILE = PORTRAIT ? 0.86 : 0.92;
/** Largeur projetee de l'empreinte 14 x 9 (coins vifs) a l'azimut 45 : 0.7071 x (14 + 9). */
export const PLATEAU_W = Math.SQRT1_2 * (BODY.w + BODY.d);
/**
 * Mobile (2026-10-01) : un seul doigt ne tourne plus la vue, la machine
 * reste de face ; le cadre suit sa largeur reelle (14) et non celle de
 * l'azimut 45 (16.3) : environ 20 % plus grande a l'ecran. Tournee a deux
 * doigts, elle peut deborder un peu : c'est le geste qui le veut.
 */
export const FRONT_W = BODY.w;
/**
 * Hauteur projetee de la machine fermee a la vue par defaut (azimut 45,
 * elevation 38), mesuree sur les sommets reels (measure().fit, encodeurs
 * compris) : 10.64 pour la machine compacte du 2026-10-01 (11.68 a 14 x 9). Elle
 * tient toujours dans 86 % du canvas a la vue par defaut ; le cadre ne suit
 * jamais l'orbite (echelle constante, spec 20.1 R2-5).
 */
// La face V.4.0 du desktop (2026-10-27) : 10.614 mesure (10.637 avant, scratch measure.mjs, la meme regle)
export const MACHINE_H = PORTRAIT ? 14.2 : 10.61;
export const FIT_H = 0.86;

/**
 * Orbite (spec 20.2.1), controleur maison scene/orbit.ts. Azimut libre,
 * mesure de +z vers +x (camera en +x +z de la cible a 45) ; elevation
 * bornee 18 a 78 deg (jamais sous la table, jamais a la verticale) ; zoom
 * = camera.zoom borne 0.55 a 2.4 (molette et pincement, jamais la
 * position) ; aucun decalage lateral. Inertie 0.08 par frame a 60 fps
 * (independante du framerate) sur la rotation et le log du zoom ; arret
 * net quand le pas d'une frame passe sous stop (0.001 rad, 0.001 de
 * log-zoom) une fois le pointeur relache ; pointeur tenu immobile : le
 * reste, sous snap, est applique d'un coup. Vitesse : pi rad par hauteur
 * de canvas (px CSS). Molette : zoom x exp(-deltaY x wheel), x wheelCtrl
 * avec Ctrl. Tape : moins de tapPx ET moins de tapMs, un seul pointeur.
 * Double tape du fond : deux tapes a moins de bgTapMs et bgTapPx. Retour
 * a la vue par defaut en resetMs (easeOutCubic, azimut par le plus court).
 * La vue a "bouge" (RESET VIEW visible) au-dela de movedDeg ou movedZoom.
 * Cible (pivot) : le centre projete de la machine fermee a la vue par
 * defaut (mesure sur les sommets reels) ; la vue eclatee la monte vers
 * EXPLODE.targetY.
 */
export const ORBIT = {
  /**
   * Vue d'arrivee (2026-10-01) : la machine de face, droite, vue de haut
   * (69 deg, l'angle choisi par Mika sur une capture : le panneau se lit en
   * entier, la face avant n'est plus qu'un filet). Le cadrage reste celui
   * de l'azimut 45 (le pire cas, PLATEAU_W et MACHINE_H) : tourner ne la
   * fait jamais sortir.
   */
  azDeg: 0,
  elDeg: 69,
  zoom: 1,
  elMinDeg: 18,
  elMaxDeg: 78,
  zoomMin: 0.55,
  zoomMax: 2.4,
  damping: 0.08,
  stop: 0.001,
  snap: 0.0001,
  radPerHeight: Math.PI,
  wheel: 0.0015,
  wheelCtrl: 6,
  tapPx: 6,
  tapMs: 400,
  bgTapMs: 300,
  bgTapPx: 30,
  resetMs: 500,
  movedDeg: 0.5,
  movedZoom: 0.01,
  /** distance de depart ; le Stage la recalcule (cadrage en perspective) */
  distance: 30,
  /**
   * Camera perspective (2026-10-01, a la place de l'orthographique : les
   * proportions se deformaient en tournant). Champ vertical de 30 deg, un
   * cadrage de photo produit : la perspective se voit sans deformer.
   */
  fovDeg: 30,
  /**
   * near 0.1 jusqu'au 2026-10-05 : de loin (l'intro, la vue d'ensemble), la
   * profondeur n'etait plus assez fine pour les serigraphies et les LED
   * posees a quelques millimetres de leur surface, qui scintillaient ; la
   * camera ne vient jamais a moins de 8 de la machine
   */
  near: 1,
  far: 160,
  /** centre projete de la machine fermee a la vue d'arrivee (measure().fit.targetY : 1.216, machine compacte ; 1.269 en portrait) */
  // La face V.4.0 du desktop (2026-10-27) : la mesure ne bouge pas (1.269 avant et apres), la valeur non plus
  targetY: PORTRAIT ? 1.269 : 1.216,
} as const;

export const MOBILE_QUERY = '(max-width: 767px)';
export const COARSE_QUERY = '(hover: none) and (pointer: coarse)';
/**
 * Plafond de densite de pixels. Mobile 3 depuis le 2026-10-01 (1.5 avant) :
 * a 1.5 et sans lissage, la machine paraissait pixellisee sur l'iPhone de
 * Mika ; le rendu est a la demande, la pleine definition ne coute qu'aux
 * images rendues.
 */
export const DPR_MAX = { desktop: 2, mobile: 3 } as const;
/**
 * Plancher desktop (2026-10-05, Mika : "des petits glitchs graphiques,
 * genre aliasing, quand on start et que ca fait la jolie 3D") : sur un
 * ecran a 1 dppx, le rendu se fait a 1.5 (sur-echantillonne, puis reduit
 * par le navigateur) : les cannelures des potards, les filets et les
 * aretes ne crenelent plus pendant que la camera tourne.
 */
export const DPR_MIN_DESKTOP = 1.5;

/* ---------- lumieres (spec 4.2, 4.3 et 20.3.10) ---------- */

/**
 * Lumiere cle, fixe dans le MONDE (jamais attachee a la camera) : l'ombre
 * reste la meme sous tous les angles de l'orbite. Sa camera d'ombre ne
 * depend pas de la vue ; etendue 11.5 (11 en revision 1) : elle couvre la
 * pile ouverte du coin (spec 20.2.6, mesure en section 20.16).
 */
export const LIGHT_KEY = {
  color: 0xfff6e8,
  intensity: 2.2,
  x: 8,
  y: 14,
  z: 6,
  mapSize: { desktop: 1024, mobile: 1024 },
  extent: 11.5,
  near: 1,
  far: 40,
  bias: -0.0004,
  normalBias: 0.02,
  /** PCF de three 0.186 : rayon du disque d'echantillons, en texels (ombre douce) */
  radius: { desktop: 4, mobile: 3 },
} as const;

export const LIGHT_HEMI = { sky: COLOR.bone, ground: COLOR.ink, intensity: 0.35 } as const;

/**
 * Lisere chaud rasant depuis la gauche (section 19 point 80) : un
 * PointLight jaune a decroissance physique, fixe dans le monde.
 */
export const LIGHT_RIM = {
  color: COLOR.yellow,
  intensity: 6,
  decay: 2,
  x: -9,
  y: 3,
  z: 0,
} as const;

/**
 * Contre-jour (spec 20.1 R2-13) : une DirectionalLight bone fixe dans le
 * monde, depuis l'arriere gauche, sans ombre (0 draw call). La cle
 * n'atteint jamais la face arriere : sans elle, la connectique (la
 * recompense de l'orbite) serait noire. Rasante (y 2.5 et non 7 du plan)
 * et plus forte (0.9 et non 0.35) : la face arriere lit comme les flancs
 * (11,10,10 contre 2,2,2) sans eclaircir le dessus du panneau, deja cale
 * (mesures en section 20.16).
 */
export const LIGHT_BACK = { color: COLOR.bone, intensity: 0.9, x: -5, y: 2.5, z: -12 } as const;

/** Le premier rendu attend les polices, au plus ce delai. */
export const FIRST_FRAME_WAIT_MS = 1500;

/**
 * Intro (spec 7.4), mouvement complet seulement : la machine monte de
 * dropY a sa place en ms (easeOutCubic) pendant que les 16 LED font leur
 * test, de gauche a droite puis retour (ledMs, apres ledFromMs). Le
 * premier geste la termine d'un coup.
 */
/**
 * Intro (2026-10-01) : la machine arrive eclatee et s'assemble toute seule
 * en 3 s. Elle reste ouverte hold ms, le PCB rentre dans le chassis, puis
 * le panneau redescend (il part apres et finit apres : il reste toujours
 * au-dessus de la carte, aucune interpenetration), et les LED des pas font
 * leur test une fois posee. Le cadrage suit, du plan large au plan de la
 * machine fermee. Le premier geste la termine d'un coup ; rien sous
 * reduced motion.
 */
export const INTRO = {
  /** l'intro part plus bas (les couches se voient) et rejoint ORBIT.elDeg en s'assemblant */
  elFromDeg: 40,
  /**
   * L'arrivee en 3D (2026-10-05, Mika : "qu'une seule machine s'ouvre et se
   * ferme et arrive en 3D zoom pour se mettre dans la vue par defaut") : la
   * camera part tournee de azFromDeg (d'un cote ou de l'autre, au hasard) et
   * plus loin (zoomFrom), et rejoint la vue par defaut avec l'assemblage
   */
  azFromDeg: 38,
  zoomFrom: 0.62,
  /** une image lente n'avance pas l'intro de plus de maxStepMs (pas de saut : elle ralentit) */
  maxStepMs: 50,
  ms: 3100,
  hold: 300,
  pcb: { from: 300, ms: 1500 },
  plateau: { from: 800, ms: 2000 },
  ledFromMs: 2700,
  ledMs: 400,
} as const;

/* ---------- textes ---------- */

/** Les titres des pages statiques (src/data/seo-meta.json, la source du prerender), en anglais. */
const SEO_TITLES: Readonly<Record<string, string | undefined>> = Object.fromEntries(Object.entries((seoMeta as Record<string, Record<string, { title: string }>>).en ?? {}).map(([k, v]) => [k, v.title]));

/**
 * /presskit (2026-10-01) : la machine, et la visionneuse du press kit
 * par-dessus, 250 ms apres le montage ; la machine a 20 images par seconde
 * au plus pendant qu'elle est ouverte ; la ligne d'apres fermeture 5 s.
 */
export const PRESSKIT_ROUTE = {
  re: /^\/presskit\/?$/,
  delayMs: 250,
  frameCapMs: 50,
  hintMs: 5000,
  // 2026-10-21 (audit SEO F2) : le titre de sa page statique (src/data/seo-meta.json), un par page depuis ce jour
  title: SEO_TITLES['/presskit'] ?? 'Press Kit 2027 | Maudite Machine',
} as const;

export const COPY = {
  // 2026-10-21 (audit SEO F3) : l'accueil est MM-STUDIO, son titre le dit (src/data/seo-meta.json, le meme que dist/index.html)
  title: SEO_TITLES['/'] ?? 'MM-STUDIO by Maudite Machine: Free Drum Machine & Synth',
  wordmark: 'MAUDITE MACHINE',
  model: 'MM-RYTM',
} as const;

/* ---------- OPEN : vue eclatee (spec 20.3.11) ---------- */

/**
 * Vue eclatee sur le coin (spec 20.1 R2-8) : le panneau (et tout ce qui
 * est dessus) monte de lift, recule de slideZ et s'incline jusqu'a
 * tiltOpenDeg (le bord avant monte, comme un capot), rotation autour de
 * l'axe x de la machine passant par le centre du panneau ; le PCB sort du
 * chassis de pcbRise ; le chassis (et le sol) ne bouge pas. 900 ms
 * easeInOutQuart par couche : a l'ouverture le panneau part, le PCB 80 ms
 * apres ; a la fermeture le PCB d'abord, le panneau 80 ms apres : le PCB
 * ne rattrape jamais le panneau (aucune interpenetration). Cadrage : la
 * pile ouverte dans 86 % de la hauteur (fitHalfH) et le pivot qui monte a
 * targetY (mesures en section 20.16).
 */
/**
 * Portrait (2026-10-01) : le capot s'ouvre comme un couvercle a charniere
 * arriere (60 deg : son centre monte de 7.2 sin 60 et recule de
 * 7.2 (1 - cos 60)) ; glisse vers l'arriere comme sur desktop, il cachait
 * la carte, plus longue que large, sauf sa bande avant.
 */
export const EXPLODE = {
  ms: 900,
  staggerMs: 80,
  /** desktop (2026-10-03) : plus haut et plus loin, la rangee des pages au milieu de la carte se voit en entier */
  lift: PORTRAIT ? 7.5 : 5.0,
  /**
   * 2026-10-08 (revue de l'OPEN moins zoome) : le capot leve sort tout entier
   * du cadre ouvert, au-dessus du haut de l'ecran (desktop 1440 x 900 : 84 px
   * au-dessus ; telephone 390 x 844 : 40 px), plus rien de lui sous l'en-tete
   * translucide ; avant, son bord avant y passait. Portrait : 6.3 / -3.6 ->
   * 7.5 / -7.4 ; desktop -3.9 -> -6.4. Ses commandes ne repondent plus
   * capot ouvert (renderer.ts syncChips).
   */
  slideZ: PORTRAIT ? -7.4 : -6.4,
  tiltOpenDeg: PORTRAIT ? -60 : -24,
  pcbRise: 0.9,
  /**
   * Ouverture du 2026-10-01 (plus grande) : la pile fait 11.30 de haut a la
   * vue d'arrivee et 16.76 a l'azimut 45 (le pire cas). 8.4 garde la part de
   * hauteur d'avant a l'arrivee (67 %) et tient encore l'azimut 45 entier
   * (100 % au lieu de 86 %) : la machine ouverte ne rapetisse que de 10 %.
   */
  fitHalfH: PORTRAIT ? 11.5 : 8.4,
  /**
   * son centre projete a la vue d'arrivee (measure().fit.targetY, ouverte) ; portrait : la carte au milieu, le couvercle en
   * haut. La face V.4.0 du desktop (2026-10-27) : la mesure monte de 0.04 (10.684 contre 10.644), la valeur aussi
   */
  targetY: PORTRAIT ? 3.9 : 5.94,
  /** echelle verticale des composants replies (jamais 0 : matrice inversible) */
  partsMin: 0.001,
  /**
   * les puces ne repondent au pointeur qu'une fois decouvertes (panneau a
   * 85 % de sa course)
   */
  chipsFrom: 0.85,
} as const;

/**
 * OPEN (2026-10-05, Mika : "quand on OPEN une machine j'aimerais que ca
 * puisse zoom vers le contenu de l'interieur ; quand on ferme on revient
 * dans la vue reset view") : desktop, la camera ne cadre plus la pile
 * entiere (le capot et la carte) mais l'interieur : la plaque des TWEAKS et sa
 * carte, a la vue par defaut. fill : la part de la largeur que prend la
 * plaque (largeur de la plaque + marge, divisee par fill) ; h : la hauteur
 * que le cadrage garde (la plaque et un peu de sa carte). Le pivot va au
 * centre de la plaque ouverte (y, z du monde) : tourner la vue tourne
 * autour d'elle. Telephone : le cadrage d'avant (la plaque debout y tient deja).
 *
 * 2026-10-08 (Mika : "deja c'est super zoome") : on regarde toujours dans
 * la machine, mais comme un objet : la carte entiere (ses bords, ses vis),
 * a 70 % de la largeur au desktop, une marge calme autour, rien sous
 * l'en-tete (le capot leve sort du cadre par le haut, EXPLODE, et les
 * voisines par les cotes, renderer.ts placeNeighbors) ; au telephone aussi
 * (la carte debout, 86 % de la largeur). fill : la part de la largeur que
 * prend la carte (sa largeur vue, divisee par fill) ; h : la hauteur que le
 * cadrage garde. Le pivot va un peu derriere le centre de la carte ouverte
 * (y, z du monde, l'open* de chaque machine).
 */
export const OPEN_VIEW = {
  fill: PORTRAIT ? 0.86 : 0.7,
  margin: 0,
  h: PORTRAIT ? 10.9 : 7.6,
} as const;

/**
 * Puce cliquable d'une carte : GOODIES, MERCH et STUDIO sur la 808 ; sur
 * le MM-VOYAGER (2026-10-03) toutes les sections, pages comprises.
 */
export type ChipId = SectionId;

/**
 * Grosse puce (spec 5.6) : corps 1.7 x 0.2 x 1.2 pose 0.03 au-dessus de la
 * carte ; un point jaune marque la broche 1 des puces cliquables. Boitier
 * QFP depuis le 2026-10-01 : des pattes fines (0.04 de large, pas de 0.1)
 * sur les quatre cotes, 14 devant et derriere, 9 a gauche et a droite,
 * 0.14 de long, au ras du corps.
 */
export const CHIP = {
  w: 1.7,
  d: 1.2,
  y0: 0.03,
  y1: 0.23,
  legW: 0.04,
  legH: 0.035,
  legD: 0.14,
  legZ: 0.66,
  legX: 0.91,
  legPitch: 0.1,
  legsPerSide: 14,
  legsPerEnd: 9,
  dotR: 0.07,
  /** leur serigraphie : centree 1.02 devant le centre de la puce */
  labelDz: 1.02,
  /** survol : la puce se souleve (150 ms) */
  rise: 0.06,
  riseMs: 150,
  /**
   * Puce qui sort du site (LABEL, spec 20.5) : au survol et au focus
   * clavier de son jumeau, le dessus de la puce passe au jaune, sa
   * serigraphie aussi, et le chevron sortant (le trace de ExternalMark,
   * haut comme les capitales) apparait extGapPx apres le texte (px de la
   * texture desktop) ; le routage des pistes lui garde sa place. Son trait
   * (extStroke, dans la boite de 12) suit la graisse 700 de la serigraphie.
   */
  extGapPx: 7,
  extStroke: 2,
} as const;

/** Page Bandcamp du label (brief, verifiee par la session principale) : puce LABEL et section LABEL. */
export const LABEL_URL = 'https://vrstlrecords.bandcamp.com';

/**
 * Chevron sortant des liens qui quittent le site (spec 20.5) : une fleche
 * nord-est a equerre dans une boite de 12, trait de 1.4. Le meme trace pour
 * les liens HTML (ui/ExternalLink.tsx) et la puce LABEL du PCB.
 */
export const EXTERNAL_MARK = { d: 'M3.5 2.5h6v6M9.5 2.5l-7 7', box: 12, stroke: 1.4 } as const;

/**
 * Les trois puces cliquables (revision 4), rangee a z 2.6 de la carte :
 * sous le panneau leve et recule, la moitie avant de la carte se voit
 * depuis la vue par defaut, les cotes et les vues basses de l'arriere en
 * montrent une partie. GOODIES, MERCH et STUDIO ouvrent leur section (et
 * portent l'ancre de sa trace). LABEL et LIVE ont quitte la carte : ce
 * sont des pads de page (et des boutons du Dock), machine fermee. Une puce
 * a href (lien sortant) reste possible : pcb.ts sait la dessiner.
 */
export interface ChipSpec {
  id: ChipId;
  silk: string;
  x: number;
  z: number;
  /** nom du jumeau */
  aria: string;
  /** lien sortant du jumeau (nouvel onglet) ; null : la puce ouvre sa section */
  href: string | null;
  /** section ouverte par la puce */
  section: SectionId | null;
  /** boitier : la grosse puce QFP (defaut), ou la moyenne (pages du Voyager) */
  size?: 'big' | 'mid';
}

/**
 * Puce moyenne (2026-10-03, les pages sur la carte du MM-VOYAGER) : un QFP
 * plus petit, sa serigraphie plus petite et plus pres.
 */
export const CHIP_MID = {
  w: 1.2,
  d: 0.86,
  legZ: 0.49,
  legX: 0.66,
  legsPerSide: 10,
  legsPerEnd: 6,
  labelDz: 0.76,
  labelPx: 22,
} as const;

/**
 * Les pages sur la carte (2026-10-03, Mika : "mets-les dans OPEN, en mode
 * PCB", le MM-VOYAGER d'abord, puis la MM-808) : cinq puces moyennes en
 * rangee devant les composants, derriere GOODIES, MERCH et STUDIO,
 * decalees vers la gauche de la carte (au telephone, le capot ouvert cache
 * son bout droit). Repere de la carte (pcbAt : la carte d'origine 12.6 x 7.8).
 */
export const PAGE_CHIPS: readonly ChipSpec[] = [
  { id: 'tracks', silk: 'TRACKS', ...pcbAt(-4.85, 0.17), aria: 'Tracks', href: null, section: 'tracks', size: 'mid' },
  { id: 'mixtapes', silk: 'MIXTAPES', ...pcbAt(-2.85, 0.17), aria: 'Mixtapes', href: null, section: 'mixtapes', size: 'mid' },
  { id: 'shows', silk: 'SHOWS', ...pcbAt(-0.85, 0.17), aria: 'Shows', href: null, section: 'shows', size: 'mid' },
  { id: 'press', silk: 'PRESS', ...pcbAt(1.15, 0.17), aria: 'Press', href: null, section: 'press', size: 'mid' },
  { id: 'contact', silk: 'CONTACT', ...pcbAt(3.15, 0.17), aria: 'Contact', href: null, section: 'contact', size: 'mid' },
];

export const CHIPS: readonly ChipSpec[] = [
  { id: 'goodies', silk: 'GOODIES', ...pcbAt(-3.4, 2.45), aria: 'Goodies: wallpapers and covers', href: null, section: 'goodies' },
  { id: 'merch', silk: 'MERCH', ...pcbAt(0, 2.45), aria: 'Merch: apparel and stickers', href: null, section: 'merch' },
  { id: 'studio', silk: 'STUDIO', ...pcbAt(3.4, 2.45), aria: 'Studio: setup, lessons, print', href: null, section: 'studio' },
];

/** Toutes les puces cliquables d'une carte (les deux machines) : GOODIES, MERCH, STUDIO et les pages. */
export const BOARD_CHIPS: readonly ChipSpec[] = [...CHIPS, ...PAGE_CHIPS];

/**
 * Composants de decor (spec 5.6), repere de la carte (x, z), replaces pour
 * la vue ouverte du coin (section 20.16) : la bande avant de la carte
 * (z 0 a 3.9) et la bande droite (x > 4.4) se voient depuis la vue par
 * defaut, le reste passe sous le panneau leve.
 */
export const PCB_PARTS = {
  small: [pcbAt(-5.3, 2.6), pcbAt(5.3, 2.6), { x: 4.45, z: -2.75 }, pcbAt(-2.7, -2.9)],
  /** references serigraphiees en blanc sur le dessus des petites puces */
  smallRefs: ['TL072', 'NE555', '74HC595', 'LM386'],
  caps: [{ x: -4.5, z: 3.02 }, pcbAt(1.7, 2.3), pcbAt(5.55, -1.6), pcbAt(5.55, -2.35), pcbAt(-3.6, -2.2), pcbAt(0.4, -2.8)],
  /** deux hauteurs de condensateurs electrolytiques */
  capTall: [true, false, true, false, true, false],
  cell: pcbAt(5.35, -0.55),
  /** resistances CMS : la rangee d'origine et quatre entre les puces, code a trois chiffres */
  resistors: [
    ...Array.from({ length: 10 }, (_, k) => pcbAt(-4.6 + 0.9 * k, 1.25)),
    { x: -1.5, z: 2.3 },
    { x: -1.5, z: 2.6 },
    { x: 1.5, z: 2.6 },
    { x: -4.71, z: 1.66 },
    // 2026-10-01 : une rangee de plus sous MAUDITE MACHINE devenue plus petite
    ...[-1.2, -0.2, 0.8, 1.8, 2.8].map((x) => ({ x, z: 0.35 })),
  ],
  resistorCodes: ['103', '472', '221', '100', '331', '473', '102', '222', '470', '104', '101', '683', '152', '334', '473', '102', '220', '104', '331'],
  /** condensateurs ceramiques CMS (decouplage) */
  ceramics: [
    { x: -1.8, z: 1.7 },
    { x: -1.2, z: 1.7 },
    { x: 1.15, z: 1.55 },
    { x: 1.9, z: 1.55 },
    { x: 4.2, z: 1.6 },
    { x: 5.2, z: 1.6 },
    { x: -3.75, z: -2.8 },
    { x: -3.75, z: -1.62 },
    { x: 2.7, z: -1.9 },
    { x: -0.2, z: -1.6 },
    ...[-0.7, 0.3, 1.3, 2.3].map((x) => ({ x, z: 0.35 })),
  ],
  crystals: [pcbAt(-1.7, 3.5), pcbAt(1.7, 3.5)],
  /** regulateur TO-220 debout contre son dissipateur vertical, dans le plan de masse */
  regulator: { x: -4.3, z: -2.1 },
  /** connecteur de nappe 2 x 8 a broches dorees, et bornier a vis 3 points */
  header: { x: 1.7, z: -2.7, cols: 8 },
  terminal: { x: 3.2, z: -2.85, n: 3 },
  /** LED temoin, allumee */
  led: { x: 4.4, z: 3.12 },
  /** trous de fixation et leurs vis cruciformes, aux quatre coins */
  holes: [
    { x: -5.3, z: -3.1 },
    { x: 5.3, z: -3.1 },
    { x: -5.3, z: 3.1 },
    { x: 5.3, z: 3.1 },
  ],
  /** plan de masse hachure (unites de la carte) */
  pour: { x0: -5.5, z0: -3.3, x1: -0.7, z1: -0.55 },
  small3: { w: 0.8, h: 0.14, d: 0.6 },
  cap3: { r: 0.28, h: 0.6, hShort: 0.4, topH: 0.02 },
  cell3: { r: 0.5, h: 0.14 },
  resistor3: { w: 0.32, h: 0.08, d: 0.16 },
  ceramic3: { w: 0.26, h: 0.12, d: 0.14 },
  crystal3: { r: 0.12, l: 0.5 },
} as const;


/* ---------- jumeaux HTML et clavier (spec 6.1, 6.3, 13 et 20.7) ---------- */

/** Noms des pads de voix pour leur jumeau : "Bass drum pad, key A". */
export const PAD_ARIA: Readonly<Record<Inst, string>> = {
  BD: 'Bass drum pad, key A',
  SD: 'Snare pad, key S',
  TOM: 'Tom pad, key X',
  CH: 'Hi-hat pad, key D',
  OH: 'Open hi-hat pad, key F',
  CP: 'Clap pad, key Z',
  HT: 'High tom pad, key C',
  CY: 'Cymbal pad, key V',
};

/**
 * Jumeau du pad OPEN (spec 6.1) : un nom fixe, l'etat passe par
 * aria-pressed (un bouton bascule ne change pas de nom, revue).
 */
export const OPEN_ARIA = 'Open the machine, key 6 or O';

/** Bouton de retour a la vue par defaut (spec 20.2.9), visible des que la vue a bouge. */
export const RESET_VIEW = { label: 'RESET VIEW', aria: 'Reset view' } as const;

/**
 * Les messages de l'ecran sans voix choisie (2026-10-27) : au telephone, ses pads ; la face V.4.0 du desktop n'en a plus
 * (une voix se choisit au clavier, A S D F et Z X C V, ou au MIDI). Un fichier lache sans voix choisie : LCD_DROP_NO_VOICE
 * (au desktop, un fichier lache n'importe ou sur la machine va a la voix choisie, ui/Hotspots.tsx dropAt).
 */
export const LCD_NO_VOICE = PORTRAIT ? 'TAP A PAD FIRST' : 'PICK A VOICE FIRST';
export const LCD_DROP_NO_VOICE = PORTRAIT ? 'DROP ON A PAD' : LCD_NO_VOICE;
/**
 * MUTE sans voix coupee : au telephone, comment en couper une. Au desktop (la face V.4.0, sans pads, 2026-10-27), MUTE
 * arme le mode et l'ecran le dit lui-meme (actions.ts modeTap, MUTE: TAP A VOICE) : ce texte n'y sert pas.
 */
export const LCD_MUTE_HINT = PORTRAIT ? { touch: 'MUTE: DOUBLE TAP A VOICE', mouse: 'MUTE: RIGHT CLICK A VOICE' } : { touch: 'MUTE: TAP A VOICE', mouse: 'MUTE: TAP A VOICE' };

/**
 * Encodeurs au clavier (jumeaux role slider) : fleches 1 BPM ou 2 %, avec
 * Maj ou Page 5 BPM ou 10 % ; Debut et Fin aux butees.
 */
export const DIAL_KEYS = { tempo: { step: 1, big: 5 }, pot: { step: 0.02, big: 0.1 } } as const;

/**
 * Reglage fin, Maj tenue sur un potard (2026-10-01, comme dans Ableton) :
 * le glisser dix fois plus fin (1 % pour 15 px au lieu de 1.5), la molette
 * a 1 % le cran (TEMPO garde 1 BPM le cran, deja son plus petit pas).
 */
export const DIAL_FINE = { drag: 0.1, wheelStep: 0.01 } as const;

/* ---------- apparence : sombre ou claire (2026-10-01) ---------- */

export type Appearance = 'dark' | 'light';

/**
 * Encre de la serigraphie du panneau et de la face arriere (r, g, b) :
 * bone sur la machine noire, le gris du press kit (#434343) sur la
 * machine claire. Le PCB garde la sienne (bone sur vert).
 */
export const INK = { silk: [246, 241, 231] as number[] };
/** L'encre de la serigraphie a une opacite donnee (canvas). */
export const silkA = (a: number): string => `rgba(${INK.silk[0]}, ${INK.silk[1]}, ${INK.silk[2]}, ${a})`;

/** Exposition du rendu, selon l'apparence. */
export const EXPOSURE = { value: 1 };
/** L'apparence posee sur la scene (lue a la construction des modules). */
export const APPEARANCE: { current: Appearance } = { current: 'dark' };

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] };

/**
 * La machine claire (demande de Mika, 2026-10-01) : un blanc a peine creme,
 * plus blanc que le papier du press kit, sur une table creme (#F1EDE5) ;
 * serigraphie gris #434343, noms des pages en orange #FF6A13, encodeurs
 * charbon a repere bone, touches et pads gris tres clair, ecran noir.
 * Teintes AFFICHEES visees ; gains cales par lecture de pixels comme ceux
 * de la machine noire.
 */
const LIGHT = {
  hex: {
    ink: '#F1EDE5',
    body: '#E6E2DA',
    bodyEdge: '#F8F6F1',
    bodyTop: '#DCD8CF',
    rubber: '#3B3A37',
    panel: '#FAF8F4',
    panelEdge: '#FFFFFF',
    panelSide: '#E4E0D8',
    pad: '#E6E3DD',
    key: '#E8E5DF',
    encoder: '#26262A',
    collar: '#D4D0C8',
    line: '#D7D3CB',
    ledHover: '#8E8A83',
    voyPanel: '#F8F5EF',
    voyPanelEdge: '#FFFFFF',
    voyBody: '#E2DED6',
    voyKnob: '#232326',
    voySkirt: '#E6E8EC',
  } as Partial<Record<Tone, string>>,
  gain: {
    body: 1.25,
    bodyEdge: 1,
    bodyTop: 1.1,
    panel: 1,
    panelEdge: 1,
    panelSide: 1.2,
    pad: 1.05,
    encoder: 2.4,
    collar: 1,
    voyPanel: 1,
    voyPanelEdge: 1,
    voyBody: 1.2,
    voyKnob: 2.4,
    voySkirt: 1,
  } as Partial<Record<Tone, number>>,
  lit: { key: [0.84, 0.82, 0.78], clear: [0.82, 0.8, 0.76] } as Record<string, number[]>,
  material: { panel: { roughness: 0.5, metalness: 0 }, chassis: { roughness: 0.7, metalness: 0 }, key: { roughness: 0.55, metalness: 0 }, pad: { roughness: 0.85, metalness: 0 } },
  /** lueurs des pads en orange (le jaune palit sur le caoutchouc clair) */
  glow: {
    // La voix choisie (2026-10-22, audit SB-04) : le caoutchouc clair vire a l'orange pale ([0.05, 0.016, 0] avant, a peine rose)
    selected: [0.26, 0.075, 0.006],
    active: [0.42, 0.1, 0.0],
    flash: [0.3, 0.045, 0.0],
    orange: [0.32, 0.035, 0.0],
    orangeDim: [0.08, 0.01, 0.0],
    muted: [0.2, 0.004, 0.0],
  } as Record<string, number[]>,
  /** le flash d'une voix : le caoutchouc a l'orange (FLASH_TINT), un peu plus clair que celui d'OPEN */
  flashTint: [1.32, 0.21, 0.014],
  floor: { haloHex: '#FAF8F4', shadow: 0.32, contact: 0.32 },
  hemi: { ground: 0xe9e5dd, intensity: 0.6, sky: 0xffffff },
  /** lumieres blanches neutres : la machine reste blanche, pas creme */
  key: 0xffffff,
  rim: 1.5,
  silk: [67, 67, 67],
  exposure: 1.3,
  /** appui d'une touche ou d'un bouton : un eclat orange franc (le faible ne se voyait pas sur le clair) */
  press: [0.55, 0.14, 0.012],
  /** OPEN, multiplicateur de sa couleur : l'orange plein sur le caoutchouc clair */
  openTint: [1.32, 0.19, 0.012],
  /** pads de voix coupes (rouge LED) et en solo (bleu) */
  voiceTint: { mute: '#C8372C', solo: '#8DB2E4' },
  /** une touche allumee (2026-10-18, KEY_LIT) : le dessus a la couleur de son temoin, un emissif plus doux */
  // V.5.0 (2026-10-29) : les teintes de la Digitakt sur la machine creme, plus sombres et lisibles (DT_HEX_LIGHT) ; le blanc
  // d'un flash, l'encre sombre
  keyLit: {
    orange: [1.0, 0.24, 0.035],
    run: [1.0, 0.13, 0.05],
    red: [0.85, 0.035, 0.025],
    blue: [0.09, 0.26, 1.0],
    dred: [0.85, 0.03, 0.025],
    dgreen: [0.03, 0.42, 0.06],
    dwhite: [0.03, 0.03, 0.03],
    dmagenta: [0.55, 0.06, 0.5],
    dblue: [0.05, 0.24, 0.8],
    dorange: [0.85, 0.2, 0.01],
    // V.5.1 : le jaune des lock trigs sur la creme (#E09A10, DT_HEX_LIGHT)
    dyellow: [0.75, 0.33, 0.006],
  } as Record<KeyLitTone, number[]>,
  keyLitGlow: 0.3,
};

/** Multiplicateur de couleur du pad OPEN (blanc : la teinte du caoutchouc). */
export const OPEN_TINT: number[] = [1, 1, 1];
/**
 * Teinte d'une touche enfoncee (albedo lineaire), machine claire : l'orange
 * plein, l'eclat seul palissait en peche. null : l'eclat seul (machine noire).
 */
export const PRESS_TINT: { rgb: number[] | null } = { rgb: null };

/** L'etat sombre d'origine, copie au chargement pour pouvoir y revenir. */
const DARK = {
  hex: { ...HEX },
  gain: { ...GAIN },
  lit: Object.fromEntries(Object.entries(LIT).map(([k, v]) => [k, [...v]])) as Record<string, number[]>,
  material: JSON.parse(JSON.stringify(MATERIAL)) as Mutable<typeof MATERIAL>,
  glow: Object.fromEntries((['selected', 'active', 'flash', 'orange', 'orangeDim', 'muted'] as const).map((k) => [k, [...PAD_GLOW[k]]])) as Record<string, number[]>,
  floor: { haloHex: FLOOR.haloHex as string, shadow: FLOOR.shadow as number, contact: FLOOR.contact.opacity as number },
  hemi: { ground: LIGHT_HEMI.ground as number, intensity: LIGHT_HEMI.intensity as number, sky: LIGHT_HEMI.sky as number },
  key: LIGHT_KEY.color as number,
  rim: LIGHT_RIM.intensity as number,
  press: [...STEP_PRESS.glow],
  silk: [...INK.silk],
  voiceTint: { ...VOICE_TINT },
};

/**
 * Pose une apparence sur les constantes de la scene, AVANT la creation du
 * Stage (index.tsx le reconstruit a chaque changement) : chaque module lit
 * ses teintes a la construction. Les memes objets sont modifies en place :
 * les references gardees ailleurs (pads, encodeurs) suivent.
 */
export function applyAppearance(a: Appearance): void {
  const L = a === 'light';
  const hex = HEX as Record<Tone, string>;
  Object.assign(hex, DARK.hex, L ? LIGHT.hex : {});
  const color = COLOR as Record<Tone, number>;
  for (const k of Object.keys(hex) as Tone[]) color[k] = parseInt(hex[k].slice(1), 16);
  const gain = GAIN as Record<string, number>;
  for (const k of Object.keys(gain)) delete gain[k];
  Object.assign(gain, DARK.gain, L ? LIGHT.gain : {});
  for (const [k, v] of Object.entries(DARK.lit)) Object.assign((LIT as unknown as Record<string, number[]>)[k], L && LIGHT.lit[k] ? LIGHT.lit[k] : v);
  const mat = MATERIAL as unknown as Mutable<typeof MATERIAL>;
  for (const k of Object.keys(DARK.material) as (keyof typeof MATERIAL)[]) {
    Object.assign(mat[k], DARK.material[k], L ? (LIGHT.material as Record<string, object>)[k] ?? {} : {});
  }
  for (const k of ['selected', 'active', 'flash', 'orange', 'orangeDim', 'muted'] as const) Object.assign(PAD_GLOW[k] as unknown as number[], L ? LIGHT.glow[k] : DARK.glow[k]);
  FLASH_TINT.rgb = L ? [...LIGHT.flashTint] : null;
  Object.assign(STEP_PRESS.glow as unknown as number[], L ? (DT_FACE ? DT_PRESS.light.glow : LIGHT.press) : DARK.press);
  const floor = FLOOR as unknown as { haloHex: string; shadow: number; contact: { opacity: number } };
  floor.haloHex = L ? LIGHT.floor.haloHex : DARK.floor.haloHex;
  floor.shadow = L ? LIGHT.floor.shadow : DARK.floor.shadow;
  floor.contact.opacity = L ? LIGHT.floor.contact : DARK.floor.contact;
  const hemi = LIGHT_HEMI as unknown as { ground: number; intensity: number; sky: number };
  hemi.ground = L ? LIGHT.hemi.ground : DARK.hemi.ground;
  hemi.intensity = L ? LIGHT.hemi.intensity : DARK.hemi.intensity;
  hemi.sky = L ? LIGHT.hemi.sky : DARK.hemi.sky;
  (LIGHT_KEY as unknown as { color: number }).color = L ? LIGHT.key : DARK.key;
  (LIGHT_RIM as unknown as { intensity: number }).intensity = L ? LIGHT.rim : DARK.rim;
  INK.silk.splice(0, 3, ...(L ? LIGHT.silk : DARK.silk));
  EXPOSURE.value = L ? LIGHT.exposure : 1;
  OPEN_TINT.splice(0, 3, ...(L ? LIGHT.openTint : [1, 1, 1]));
  PRESS_TINT.rgb = L ? (DT_FACE ? [...DT_PRESS.light.tint] : [1.0, 0.24, 0.035]) : null;
  // Une touche allumee sur la machine claire (2026-10-18) : sa teinte, l'emissif plus doux
  KEY_LIT_LIGHT.tint = L ? LIGHT.keyLit : null;
  KEY_LIT_LIGHT.glow = L ? LIGHT.keyLitGlow : 1;
  BACKDROP.transparent = !L;
  Object.assign(VOICE_TINT, L ? LIGHT.voiceTint : DARK.voiceTint);
  // La palette de la Digitakt (V.5.0, 2026-10-29) : plus sombre et lisible sur la machine creme
  Object.assign(DT_HEX, L ? DT_HEX_LIGHT : DT_HEX_DARK);
  // Les teintes des anneaux de la face (2026-10-27) : relues apres la palette ; V.5.0 : le blanc, le jaune, le bleu
  RING_TONE.base.on = DT_HEX.white;
  RING_TONE.off.on = DT_HEX.white;
  RING_TONE.lock.on = L ? RING_LOCK_LIGHT : DT_HEX.yellow;
  RING_TONE.unlocked.on = DT_HEX.white;
  RING_TONE.global.on = DT_HEX.white;
  RING_TONE.scene.on = DT_HEX.blue;
  RING_TONE.dim.on = DT_HEX.white;
  RING_BAND.on = DT_HEX.blue;
  APPEARANCE.current = a;
}
