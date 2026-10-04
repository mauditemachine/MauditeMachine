/**
 * Le PCB de la vue eclatee (spec 5.6, 5.7 et 20.3.11 ; revision 5 : une
 * carte qui a l'air vraie), incline comme le panneau dans le chassis en
 * coin ; il en sort de 0.9 quand la machine s'ouvre.
 *
 * La carte : chanfrein sur les quatre bords, tranche en fibre de verre nue
 * (beige). Vernis epargne vert sombre jamais uni (bruit tres doux en
 * couleur et en rugosite, un peu de poussiere), cuivre metallique
 * (metalness 0.85, roughness 0.34, par la carte ORM : occlusion en rouge,
 * rugosite en vert, metal en bleu) qui accroche la lumiere grace a une
 * petite carte d'environnement procedurale. Routage a graine (mulberry32,
 * 808) sur une grille de 0.2 : lignes droites et virages a 45 deg, jamais
 * d'angle droit ; pistes de signal fines, d'alimentation larges, paires
 * differentielles (deux pistes paralleles a ecartement constant),
 * serpentins d'egalisation de longueur, vias aux changements de couche ;
 * plan de masse hachure avec ses vias de couture ; pastilles dorees sous
 * les pattes ; trous de fixation a pastille metallique et vis cruciformes.
 * Ombre de contact courte et sombre au pied de chaque composant (cuite dans
 * la couleur et dans l'occlusion). Serigraphie d'origine gardee (MAUDITE
 * MACHINE, MM-808, versions, designateurs), noms des puces cliquables en
 * orange. Les textures sont generees une fois, a la premiere apparition du
 * PCB (intro ou premier OPEN), pas au montage.
 *
 * Les composants : quatre geometries fusionnees, une par materiau (le
 * budget de draw calls ne tient pas un InstancedMesh par famille) :
 * plastiques et corps (couleurs de sommets, mat), metaux (pattes, broches
 * dorees, boitiers de quartz, dissipateur, vis, dessus des condensateurs :
 * metalness 0.85), marquages blancs (references des puces, codes des
 * resistances, un atlas), la LED allumee et sa lueur sur le cuivre
 * (additive, non eclairee). parts.scale.y (0.001 a 1) fait sortir le tout
 * de la carte : les trois autres sont ses enfants.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  EquirectangularReflectionMapping,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  Vector2,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type BufferAttribute,
  type CanvasTexture,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BOARD_CHIPS, CHIP, CHIP_MID, EXTERNAL_MARK, FONT_DISPLAY, PCB, PCB_PARTS, PCB_TYPE, SILK, boneA, pcbAt, type ChipId, type ChipSpec } from '../theme';
import type { HotspotDef } from './hit';
import { albedoRgb, litCss } from './materials';
import { drawTracked, fontsReady, makeCanvasTexture, mulberry32, trackedWidth } from './silk';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };
type Rgb = readonly number[];

/* ---------------- teintes ---------------- */

/** Px de la texture de reference (1024 de large) : traits et textes gardent leur taille. */
const PX_REF = 1024;

const tmpC = new Color();
/** Couleur de sommet : sRGB -> lineaire x gain. */
const lin = (hex: number, gain = 1): [number, number, number] => {
  tmpC.setHex(hex).multiplyScalar(gain);
  return [tmpC.r, tmpC.g, tmpC.b];
};
/** Couleur a peindre dans une texture eclairee : lineaire x gain, reencodee en sRGB. */
const css = (hex: number, gain = 1): string => `#${tmpC.setHex(hex).multiplyScalar(gain).getHexString()}`;

/**
 * Peintes dans la texture de la carte (eclairee), calees comme les
 * couleurs de sommets du corps (section 19) : le vernis par canal (la
 * lumiere chaude mange son bleu).
 */
const BOARD_GAIN = [1.47, 1.94, 2.57] as const;
const TEX = {
  board: litCss('pcb', BOARD_GAIN),
  copper: css(0xc98a55, 1),
  /** piste et plan de masse sous le vernis (2026-10-01) : un vert plus clair */
  trace: litCss('pcbTrace', BOARD_GAIN),
  /** pastilles en or (finition ENIG) */
  gold: css(0xd9b45e, 1),
  hole: '#070807',
  /** tranche : fibre de verre nue */
  fiber: css(0xc4b88c, 1.25),
  frame: litCss('yellow', 1.2),
  silk: boneA(0.9),
  lit: litCss('yellow', 1.2),
  nav: litCss('orange', 1.2),
} as const;

/** Carte ORM : occlusion (rouge), rugosite (vert), metal (bleu). */
const ORM = {
  /** vernis satine (2026-10-01 : rugosite 0.55 au lieu de 0.75, il accroche la lumiere) */
  board: 'rgb(255, 140, 13)',
  /** piste sous le vernis : un peu plus lisse, jamais metallique */
  trace: 'rgb(255, 115, 13)',
  copper: 'rgb(255, 87, 217)',
  silk: 'rgb(255, 204, 0)',
  hole: 'rgb(150, 235, 0)',
  fiber: 'rgb(255, 217, 0)',
} as const;

/** Carte de hauteur (gris) : vernis, piste dessous, pastille, serigraphie, trou, etiquette. */
const HEIGHT = {
  board: '#808080',
  trace: '#a2a2a2',
  pad: '#aaaaaa',
  silk: '#b6b6b6',
  hole: '#262626',
  sticker: '#c2c2c2',
} as const;

/** Albedos lineaires des composants (couleurs de sommets). */
const RGB = {
  chip: albedoRgb('chip', 3),
  dot: albedoRgb('yellow', 1.3),
  dimple: lin(0x1c1c1f, 3),
  capBody: albedoRgb('capBody', 4),
  capBand: lin(0xb8bcc4, 1.5),
  ceramic: lin(0xb8996a, 1.9),
  resistor: lin(0x131315, 3),
  shroud: lin(0x151517, 3),
  block: lin(0x2f6fb5, 2),
  blockHole: lin(0x050506, 1),
  holder: lin(0x111113, 3),
  /**
   * dessus de la puce LABEL allumee : jaune, gain par canal (l'ACES delave
   * un jaune vif et fait monter son bleu)
   */
  litTop: albedoRgb('yellow', 1).map((v, i) => v * [2, 1.3, 0.3][i]),
} as const;
/** Metaux (couleur speculaire). */
const METAL = {
  leg: lin(0xc8ccd2),
  gold: lin(0xe2b65a),
  can: lin(0xdadde1),
  alu: lin(0xbcc0c6),
  capTop: lin(0xd0d3d8),
  capCross: lin(0x8f939a),
  screw: lin(0xc4c7cc),
  recess: lin(0x2a2c30),
  cell: lin(0xd5d8dc),
} as const;
const LED_RGB = { dome: [1.0, 0.5, 0.2], glow: [0.95, 0.36, 0.08] } as const;

/* ---------------- grille des pistes ---------------- */

const G = PCB.grid;
const X0 = -PCB.w / 2 + 0.3;
const Z0 = -PCB.d / 2 + 0.3;
const COLS = Math.floor((PCB.w - 0.6) / G + 1e-6) + 1;
const ROWS = Math.floor((PCB.d - 0.6) / G + 1e-6) + 1;
const gx = (i: number): number => X0 + i * G;
const gz = (j: number): number => Z0 + j * G;
/** Huit directions a 45 deg d'ecart (i vers +x, j vers +z). */
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const FREE = 0;
const BLOCKED = 1;
const USED = 2;

interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

interface SilkText {
  text: string;
  x: number;
  z: number;
  px: number;
  align: 'left' | 'center' | 'right';
  reserve: number;
  nav?: boolean;
}

interface LabelGeom {
  x0: number;
  baseline: number;
  cap: number;
  px: number;
  markX: number;
}

interface ExtZone {
  id: ChipId;
  text: string;
  geom: LabelGeom;
  x: number;
  y: number;
  w: number;
  h: number;
  base: HTMLCanvasElement | null;
}

/** Un composant sur la carte : contour, designateur, pastilles, ombre. */
interface Footprint {
  x: number;
  z: number;
  hx: number;
  hz: number;
  round: boolean;
  frame: boolean;
  ref: string;
  refX: number;
  refZ: number;
  refAlign: 'left' | 'center' | 'right';
  /** direction des pistes qui en partent ; null : aucune */
  axis: 'x' | 'z' | null;
  /** contour serigraphie */
  outline: boolean;
  /** pastilles (rectangles centres) en unites */
  pads: { x: number; z: number; w: number; d: number; round?: boolean }[];
  /** emprise de l'ombre de contact */
  shadow: { x: number; z: number; hx: number; hz: number; round: boolean } | null;
}

/** Une piste routee et son rendu. */
interface Trace {
  pts: number[];
  kind: 'signal' | 'power' | 'pair';
  /** index du point ou la piste change de couche (via) ; -1 : aucun */
  viaAt: number;
  /** serpentin : index du premier point d'une ligne droite et nombre de pas */
  meander: [number, number] | null;
  /** score de visibilite (vue ouverte : bande avant et bande droite) */
  vis: number;
}

/* ---------------- les composants, en donnees ---------------- */

/**
 * Pattes d'une puce QFP (2026-10-01) : rectangles (centre, largeur en x,
 * profondeur en z), devant et derriere puis a gauche et a droite.
 */
function qfpLegs(c: ChipSpec): { x: number; z: number; w: number; d: number }[] {
  const D = chipDims(c);
  const out: { x: number; z: number; w: number; d: number }[] = [];
  for (const side of [-1, 1]) {
    for (let j = 0; j < D.legsPerSide; j += 1) {
      out.push({ x: c.x - ((D.legsPerSide - 1) * CHIP.legPitch) / 2 + j * CHIP.legPitch, z: c.z + side * D.legZ, w: CHIP.legW, d: CHIP.legD });
    }
    for (let j = 0; j < D.legsPerEnd; j += 1) {
      out.push({ x: c.x + side * D.legX, z: c.z - ((D.legsPerEnd - 1) * CHIP.legPitch) / 2 + j * CHIP.legPitch, w: CHIP.legD, d: CHIP.legW });
    }
  }
  return out;
}

/** Cotes d'une puce cliquable : la grosse (defaut) ou la moyenne (pages du Voyager). */
function chipDims(c: ChipSpec): { w: number; d: number; legZ: number; legX: number; legsPerSide: number; legsPerEnd: number; labelDz: number; labelPx: number } {
  if (c.size === 'mid') return CHIP_MID;
  return { w: CHIP.w, d: CHIP.d, legZ: CHIP.legZ, legX: CHIP.legX, legsPerSide: CHIP.legsPerSide, legsPerEnd: CHIP.legsPerEnd, labelDz: CHIP.labelDz, labelPx: PCB.chipLabelPx };
}

/**
 * La bande des pages (z de -0.55 a 1.32, les deux cartes depuis le
 * 2026-10-03) : degagee des resistances, des condensateurs CMS et de la
 * pile ; le plan de masse s'arrete plus loin, sous MAUDITE MACHINE.
 */
const PAGE_BAND = { z0: -0.55, z1: 1.32 } as const;
const inBand = (z: number): boolean => z > PAGE_BAND.z0 && z < PAGE_BAND.z1;
const POUR = { ...PCB_PARTS.pour, z1: -1.12 } as const;

const P = PCB_PARTS;
const LEG_SMALL = { n: 6, pitch: 0.12, w: 0.05, h: 0.05, d: 0.1 } as const;
const HEADER = { pitch: 0.13, w: 1.2, d: 0.42, h: 0.3, wall: 0.035 } as const;
const TERM = { pitch: 0.35, d: 0.34, h: 0.36 } as const;

/**
 * Les deux cartes (2026-10-03, Mika : "des PCB quasiment realistes") :
 * la MM-808 garde ses puces numeriques et recoit des transistors CMS, des
 * points de test, des mires de fabrication et son etiquette a code-barres ;
 * celle du MM-VOYAGER est analogique : trimmers bleus, condensateurs film
 * rouges, transistors TO-92, amplis-op en boitier DIP (le filtre en
 * echelle), et ses petites puces deviennent des puces audio.
 */
export type PcbVariant = 'mm808' | 'voy';

type ExtraKind = 'trim' | 'film' | 'to92' | 'dip' | 'sot' | 'tp' | 'fid';

interface Extra {
  kind: ExtraKind;
  x: number;
  z: number;
  ref: string;
  label?: string;
}

const EXTRA_SIZE: Record<ExtraKind, { hx: number; hz: number }> = {
  trim: { hx: 0.18, hz: 0.18 },
  film: { hx: 0.22, hz: 0.09 },
  to92: { hx: 0.13, hz: 0.09 },
  dip: { hx: 0.45, hz: 0.17 },
  sot: { hx: 0.1, hz: 0.06 },
  tp: { hx: 0.07, hz: 0.07 },
  fid: { hx: 0.06, hz: 0.06 },
};

/** Les composants de plus, en unites de la carte (bande du milieu, visible capot ouvert). */
function extrasOf(variant: PcbVariant): Extra[] {
  const fid: Extra[] = [
    { kind: 'fid', x: -0.35, z: -0.5, ref: '' },
    { kind: 'fid', x: 3.95, z: -1.45, ref: '' },
  ];
  if (variant === 'voy') {
    return [
      ...[-0.15, 0.35, 0.85, 1.35].map((x, k) => ({ kind: 'trim' as const, x, z: -0.78, ref: `RV${k + 1}` })),
      ...[2.0, 2.55, 3.1].map((x, k) => ({ kind: 'film' as const, x, z: -0.74, ref: `C${21 + k}`, label: 'MKS2' })),
      ...[-0.1, 0.3, 0.7, 1.1, 1.5].map((x, k) => ({ kind: 'to92' as const, x, z: -1.3, ref: `Q${k + 1}` })),
      { kind: 'dip', x: 2.35, z: -1.28, ref: 'U13', label: 'TL074' },
      { kind: 'dip', x: 3.35, z: -1.28, ref: 'U14', label: 'LM13700' },
      { kind: 'tp', x: 3.72, z: -0.72, ref: 'TP1' },
      ...fid,
    ];
  }
  return [
    ...[
      [2.35, -0.72],
      [2.8, -0.72],
      [2.35, -1.12],
      [2.8, -1.12],
    ].map(([x, z], k) => ({ kind: 'sot' as const, x, z, ref: `Q${k + 1}` })),
    ...[
      [3.35, -0.7],
      [3.35, -1.05],
      [0.05, -1.35],
      [0.35, -1.35],
    ].map(([x, z], k) => ({ kind: 'tp' as const, x, z, ref: `TP${k + 1}` })),
    ...fid,
  ];
}

/** L'etiquette a code-barres de la carte (MM-808) : centre, demi-etendues. */
const STICKER = { x: 1.15, z: -0.88, hx: 0.6, hz: 0.24 } as const;

function footprints(variant: PcbVariant, chips: readonly ChipSpec[]): Footprint[] {
  const out: Footprint[] = [];
  chips.forEach((c, k) => {
    const D = chipDims(c);
    const legHz = D.legZ + CHIP.legD / 2;
    const legHx = D.legX + CHIP.legD / 2;
    const pads: Footprint['pads'] = [];
    for (const leg of qfpLegs(c)) pads.push({ x: leg.x, z: leg.z, w: leg.w + 0.03, d: leg.d + 0.06 });
    out.push({
      x: c.x,
      z: c.z,
      hx: legHx + 0.04,
      hz: legHz + 0.04,
      round: false,
      frame: true,
      ref: `U${k + 1}`,
      // Au-dessus du coin droit de la puce, entre elle et la rangee de resistances
      refX: c.x + legHx,
      refZ: c.z - legHz - 0.1,
      refAlign: 'right',
      axis: 'z',
      outline: true,
      pads,
      shadow: { x: c.x, z: c.z, hx: D.w / 2, hz: D.d / 2, round: false },
    });
  });
  P.small.forEach((s, k) => {
    const hz = P.small3.d / 2 + 0.1;
    const pads: Footprint['pads'] = [];
    for (const side of [-1, 1]) {
      for (let j = 0; j < LEG_SMALL.n; j += 1) {
        const lx = s.x - ((LEG_SMALL.n - 1) * LEG_SMALL.pitch) / 2 + j * LEG_SMALL.pitch;
        pads.push({ x: lx, z: s.z + side * (P.small3.d / 2 + 0.04), w: LEG_SMALL.w + 0.03, d: LEG_SMALL.d + 0.04 });
      }
    }
    out.push({ x: s.x, z: s.z, hx: P.small3.w / 2 + 0.05, hz, round: false, frame: false, ref: `U${k + chips.length + 1}`, refX: s.x, refZ: s.z - hz - 0.16, refAlign: 'center', axis: 'x', outline: true, pads, shadow: { x: s.x, z: s.z, hx: P.small3.w / 2, hz: P.small3.d / 2, round: false } });
  });
  P.caps.forEach((c, k) => {
    const r = P.cap3.r + 0.05;
    out.push({ x: c.x, z: c.z, hx: r, hz: r, round: true, frame: false, ref: `C${k + 1}`, refX: c.x + r + 0.08, refZ: c.z, refAlign: 'left', axis: 'x', outline: true, pads: [], shadow: { x: c.x, z: c.z, hx: P.cap3.r, hz: P.cap3.r, round: true } });
  });
  // Plus de pile bouton (2026-10-03) : sa place est dans la bande des pages
  P.resistors.forEach((s, k) => {
    if (inBand(s.z)) return;
    const R = P.resistor3;
    const hz = R.d / 2 + 0.04;
    const pads = [-1, 1].map((sd) => ({ x: s.x + sd * (R.w / 2 - 0.03), z: s.z, w: 0.1, d: R.d + 0.04 }));
    out.push({ x: s.x, z: s.z, hx: R.w / 2 + 0.06, hz, round: false, frame: false, ref: `R${k + 1}`, refX: s.x, refZ: s.z - hz - 0.12, refAlign: 'center', axis: 'z', outline: false, pads, shadow: { x: s.x, z: s.z, hx: R.w / 2, hz: R.d / 2, round: false } });
  });
  P.ceramics.forEach((s, k) => {
    if (inBand(s.z)) return;
    const Cc = P.ceramic3;
    const pads = [-1, 1].map((sd) => ({ x: s.x + sd * (Cc.w / 2 - 0.03), z: s.z, w: 0.09, d: Cc.d + 0.04 }));
    out.push({ x: s.x, z: s.z, hx: Cc.w / 2 + 0.06, hz: Cc.d / 2 + 0.04, round: false, frame: false, ref: `C${k + P.caps.length + 1}`, refX: s.x, refZ: s.z + Cc.d / 2 + 0.16, refAlign: 'center', axis: 'z', outline: false, pads, shadow: { x: s.x, z: s.z, hx: Cc.w / 2, hz: Cc.d / 2, round: false } });
  });
  P.crystals.forEach((s, k) => {
    const hz = P.crystal3.r + 0.05;
    const pads = [-1, 1].map((sd) => ({ x: s.x + sd * (P.crystal3.l / 2 + 0.05), z: s.z, w: 0.08, d: 0.1 }));
    out.push({ x: s.x, z: s.z, hx: P.crystal3.l / 2 + 0.1, hz, round: false, frame: false, ref: `X${k + 1}`, refX: s.x, refZ: s.z - hz - 0.16, refAlign: 'center', axis: 'x', outline: true, pads, shadow: { x: s.x, z: s.z, hx: P.crystal3.l / 2, hz: P.crystal3.r * 0.9, round: false } });
  });
  {
    const r = P.regulator;
    const pads = [-1, 0, 1].map((k) => ({ x: r.x + k * 0.1, z: r.z + 0.05, w: 0.07, d: 0.1, round: true }));
    out.push({ x: r.x, z: r.z - 0.15, hx: 0.42, hz: 0.33, round: false, frame: false, ref: 'VR1', refX: r.x + 0.48, refZ: r.z + 0.05, refAlign: 'left', axis: null, outline: true, pads, shadow: { x: r.x, z: r.z - 0.17, hx: 0.38, hz: 0.27, round: false } });
  }
  {
    const h = P.header;
    const pads: Footprint['pads'] = [];
    for (let c = 0; c < h.cols; c += 1) {
      for (const row of [-1, 1]) pads.push({ x: h.x + (c - (h.cols - 1) / 2) * HEADER.pitch, z: h.z + row * HEADER.pitch * 0.5, w: 0.07, d: 0.07, round: true });
    }
    out.push({ x: h.x, z: h.z, hx: HEADER.w / 2 + 0.05, hz: HEADER.d / 2 + 0.05, round: false, frame: false, ref: 'J1', refX: h.x - HEADER.w / 2, refZ: h.z + HEADER.d / 2 + 0.16, refAlign: 'left', axis: 'z', outline: true, pads, shadow: { x: h.x, z: h.z, hx: HEADER.w / 2, hz: HEADER.d / 2, round: false } });
  }
  {
    const t = P.terminal;
    const w = t.n * TERM.pitch;
    out.push({ x: t.x, z: t.z, hx: w / 2 + 0.05, hz: TERM.d / 2 + 0.05, round: false, frame: false, ref: 'J2', refX: t.x + w / 2, refZ: t.z + TERM.d / 2 + 0.16, refAlign: 'right', axis: 'z', outline: true, pads: [], shadow: { x: t.x, z: t.z, hx: w / 2, hz: TERM.d / 2, round: false } });
  }
  {
    const l = P.led;
    const pads = [-1, 1].map((sd) => ({ x: l.x + sd * 0.06, z: l.z, w: 0.06, d: 0.09 }));
    out.push({ x: l.x, z: l.z, hx: 0.12, hz: 0.12, round: true, frame: false, ref: 'D1', refX: l.x + 0.2, refZ: l.z - 0.05, refAlign: 'left', axis: 'x', outline: true, pads, shadow: { x: l.x, z: l.z, hx: 0.08, hz: 0.08, round: true } });
  }
  for (const h of P.holes) {
    out.push({ x: h.x, z: h.z, hx: 0.24, hz: 0.24, round: true, frame: false, ref: '', refX: 0, refZ: 0, refAlign: 'center', axis: null, outline: false, pads: [], shadow: { x: h.x, z: h.z, hx: 0.15, hz: 0.15, round: true } });
  }
  for (const e of extrasOf(variant)) {
    const S = EXTRA_SIZE[e.kind];
    const pads: Footprint['pads'] = [];
    if (e.kind === 'tp') pads.push({ x: e.x, z: e.z, w: 0.13, d: 0.13, round: true });
    else if (e.kind === 'fid') pads.push({ x: e.x, z: e.z, w: 0.09, d: 0.09, round: true });
    else if (e.kind === 'trim' || e.kind === 'to92') for (const k of [-1, 0, 1]) pads.push({ x: e.x + k * 0.1, z: e.z + S.hz + 0.02, w: 0.07, d: 0.07, round: true });
    else if (e.kind === 'film') for (const k of [-1, 1]) pads.push({ x: e.x + k * 0.15, z: e.z, w: 0.08, d: 0.08, round: true });
    else if (e.kind === 'dip') for (const sd of [-1, 1]) for (let j = 0; j < 7; j += 1) pads.push({ x: e.x - 0.36 + j * 0.12, z: e.z + sd * (S.hz + 0.04), w: 0.06, d: 0.06, round: true });
    else for (const k of [-1, 1]) pads.push({ x: e.x + k * 0.07, z: e.z + S.hz + 0.03, w: 0.05, d: 0.05 });
    const flat = e.kind === 'tp' || e.kind === 'fid';
    out.push({
      x: e.x,
      z: e.z,
      hx: S.hx + 0.04,
      hz: S.hz + 0.04,
      round: flat || e.kind === 'trim',
      frame: false,
      ref: e.ref,
      refX: e.x,
      refZ: e.z - S.hz - 0.14,
      refAlign: 'center',
      axis: flat ? null : e.kind === 'film' ? 'x' : 'z',
      outline: !flat,
      pads,
      shadow: flat ? null : { x: e.x, z: e.z, hx: S.hx, hz: S.hz, round: e.kind === 'to92' },
    });
  }
  if (variant === 'mm808') {
    out.push({ x: STICKER.x, z: STICKER.z, hx: STICKER.hx + 0.05, hz: STICKER.hz + 0.05, round: false, frame: false, ref: '', refX: 0, refZ: 0, refAlign: 'center', axis: null, outline: false, pads: [], shadow: null });
  }
  return out;
}

/* ---------------- geometrie ---------------- */

function box(w: number, h: number, d: number, x: number, y: number, z: number, rgb: Rgb | null): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y, z);
  if (rgb) {
    g.deleteAttribute('uv');
    paint(g, rgb);
  }
  return g;
}

interface CylOpts {
  /** couche le long de x (centre a y0 + r) */
  alongX?: boolean;
  open?: boolean;
  thetaStart?: number;
  thetaLength?: number;
  /** aplatissement vertical (boitier ovale) */
  squash?: number;
}

function cyl(r: number, h: number, seg: number, x: number, y0: number, z: number, rgb: Rgb, o: CylOpts = {}): BufferGeometry {
  const g = new CylinderGeometry(r, r, h, seg, 1, o.open ?? false, o.thetaStart ?? 0, o.thetaLength ?? Math.PI * 2);
  if (o.alongX) {
    g.rotateZ(Math.PI / 2);
    if (o.squash) {
      g.scale(1, o.squash, 1);
      g.computeVertexNormals();
    }
    g.translate(x, y0 + r * (o.squash ?? 1), z);
  } else {
    g.translate(x, y0 + h / 2, z);
  }
  g.deleteAttribute('uv');
  paint(g, rgb);
  return g;
}

function paint(g: BufferGeometry, rgb: Rgb): void {
  const count = g.getAttribute('position').count;
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    col[i * 3] = rgb[0];
    col[i * 3 + 1] = rgb[1];
    col[i * 3 + 2] = rgb[2];
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
}

/** Pieces d'une geometrie fusionnee ; add rend le premier sommet de la piece. */
class Bucket {
  private pieces: BufferGeometry[] = [];
  count = 0;
  add(g: BufferGeometry): number {
    const start = this.count;
    this.pieces.push(g);
    this.count += g.getAttribute('position').count;
    return start;
  }
  build(what: string): BufferGeometry {
    const g = mergeGeometries(this.pieces, false);
    for (const p of this.pieces) p.dispose();
    this.pieces = [];
    if (!g) throw new Error(`pcb: ${what} merge failed`);
    return g;
  }
}

/** Plage de sommets d'une geometrie fusionnee (soulevement d'une puce). */
interface Span {
  start: number;
  count: number;
  baseY: Float32Array;
}

interface ChipRange {
  id: ChipId;
  spans: [Span | null, Span | null, Span | null];
  rise: number;
  topStart: number;
  topCount: number;
  lit: boolean;
}

/** Atlas des marquages : cellules de 4 x 1, texte blanc. */
const ATLAS = { cols: 4, rows: 16 } as const;

interface AtlasEntry {
  lines: string[];
  weight: number;
}

/** Quad de marquage couche sur un dessus, UV sur sa cellule de l'atlas. */
function labelQuad(cell: number, w: number, h: number, x: number, y: number, z: number): BufferGeometry {
  const g = new PlaneGeometry(w, h);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  const uv = g.getAttribute('uv');
  const cu = (cell % ATLAS.cols) / ATLAS.cols;
  const cv = 1 - (Math.floor(cell / ATLAS.cols) + 1) / ATLAS.rows;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, cu + uv.getX(i) / ATLAS.cols, cv + uv.getY(i) / ATLAS.rows);
  return g;
}

interface Built {
  parts: BufferGeometry;
  metal: BufferGeometry;
  labels: BufferGeometry;
  led: BufferGeometry;
  ranges: ChipRange[];
  atlas: AtlasEntry[];
}

/** Teintes des composants analogiques (carte du MM-VOYAGER). */
const RGB_EXTRA = {
  trim: lin(0x1d5fb8, 2.2),
  film: lin(0xb3122a, 2.4),
  to92: lin(0x111113, 3),
} as const;

const SMALL_REFS_VOY = ['TL072', 'CA3046', 'LM13700', 'LM324'] as const;

function buildParts(mobile: boolean, variant: PcbVariant, chips: readonly ChipSpec[]): Built {
  const seg = mobile ? 12 : 16;
  const parts = new Bucket();
  const metal = new Bucket();
  const labels = new Bucket();
  const led = new Bucket();
  const atlas: AtlasEntry[] = [];
  const ranges: ChipRange[] = [];
  const span = (b: Bucket, start: number, g: BufferGeometry): Span => {
    const pos = g.getAttribute('position');
    const baseY = new Float32Array(pos.count);
    for (let k = 0; k < pos.count; k += 1) baseY[k] = pos.getY(k);
    return { start, count: pos.count, baseY };
  };
  const mergeOf = (list: BufferGeometry[], what: string): BufferGeometry => {
    const g = mergeGeometries(list, false);
    for (const p of list) p.dispose();
    if (!g) throw new Error(`pcb: ${what} merge failed`);
    return g;
  };

  // Les trois puces cliquables d'abord : corps et point jaune (plastique),
  // pattes (metal), reference blanche sur le dessus (marquage)
  chips.forEach((c, k) => {
    const D = chipDims(c);
    const body = box(D.w, CHIP.y1 - CHIP.y0, D.d, c.x, (CHIP.y0 + CHIP.y1) / 2, c.z, RGB.chip);
    const mid = c.size === 'mid';
    const inset = mid ? 0.16 : 0.22;
    const dot = cyl(CHIP.dotR * (mid ? 0.75 : 1), 0.012, 12, c.x - D.w / 2 + inset, CHIP.y1, c.z - D.d / 2 + inset, RGB.dot);
    const gp = mergeOf([body, dot], 'chip');
    const pStart = parts.add(gp);
    const pos = gp.getAttribute('position');
    const nrm = gp.getAttribute('normal');
    let t0 = -1;
    let t1 = -1;
    for (let q = 0; q < pos.count; q += 1) {
      if (nrm.getY(q) > 0.9 && Math.abs(pos.getY(q) - CHIP.y1) < 1e-5) {
        if (t0 < 0) t0 = q;
        t1 = q;
      }
    }
    const legs = qfpLegs(c).map((l) => box(l.w, CHIP.legH, l.d, l.x, CHIP.legH / 2, l.z, METAL.leg));
    const gm = mergeOf(legs, 'legs');
    const mStart = metal.add(gm);
    const cell = atlas.length;
    atlas.push({ lines: [`${variant === 'voy' ? 'MM-ARP' : 'MM-RYTM'} ${['G1', 'M2', 'S3', 'P1', 'P2', 'P3', 'P4', 'P5'][k] ?? 'X'}`, 'VRSTL 2026'], weight: 600 });
    const lw = mid ? 0.8 : 1.1;
    const gl = labelQuad(cell, lw, lw / 4, c.x + (mid ? 0.07 : 0.1), CHIP.y1 + 0.002, c.z + (mid ? 0.06 : 0.08));
    const lStart = labels.add(gl);
    ranges.push({
      id: c.id,
      spans: [span(parts, pStart, gp), span(metal, mStart, gm), span(labels, lStart, gl)],
      rise: 0,
      topStart: pStart + t0,
      topCount: t0 < 0 ? 0 : t1 - t0 + 1,
      lit: false,
    });
  });

  // Petites puces : corps, creux de la broche 1, pattes sur les flancs, reference
  P.small.forEach((s, k) => {
    const S = P.small3;
    parts.add(box(S.w, S.h, S.d, s.x, 0.03 + S.h / 2, s.z, RGB.chip));
    parts.add(cyl(0.035, 0.004, 10, s.x - S.w / 2 + 0.1, 0.03 + S.h, s.z - S.d / 2 + 0.1, RGB.dimple));
    for (const side of [-1, 1]) {
      for (let j = 0; j < LEG_SMALL.n; j += 1) {
        const lx = s.x - ((LEG_SMALL.n - 1) * LEG_SMALL.pitch) / 2 + j * LEG_SMALL.pitch;
        metal.add(box(LEG_SMALL.w, LEG_SMALL.h, LEG_SMALL.d, lx, LEG_SMALL.h / 2, s.z + side * (S.d / 2 + 0.03), METAL.leg));
      }
    }
    const cell = atlas.length;
    atlas.push({ lines: [(variant === 'voy' ? SMALL_REFS_VOY[k] : P.smallRefs[k]) ?? 'IC'], weight: 600 });
    labels.add(labelQuad(cell, 0.56, 0.14, s.x + 0.04, 0.03 + S.h + 0.002, s.z + 0.05));
  });

  // Condensateurs electrolytiques, deux hauteurs : gaine, bande de polarite,
  // dessus en aluminium et sa croix en relief
  P.caps.forEach((c, k) => {
    const C3 = P.cap3;
    const h = P.capTall[k] ? C3.h : C3.hShort;
    parts.add(cyl(C3.r, h, seg, c.x, 0, c.z, RGB.capBody));
    parts.add(cyl(C3.r * 1.012, h * 0.9, 4, c.x, h * 0.04, c.z, RGB.capBand, { open: true, thetaStart: Math.PI * 1.15, thetaLength: 0.75 }));
    metal.add(cyl(C3.r * 0.93, 0.014, seg, c.x, h, c.z, METAL.capTop));
    metal.add(box(C3.r * 1.3, 0.016, 0.026, c.x, h + 0.014 + 0.008, c.z, METAL.capCross));
    metal.add(box(0.026, 0.016, C3.r * 1.3, c.x, h + 0.014 + 0.008, c.z, METAL.capCross));
  });

  // Resistances CMS : corps noir, terminaisons argentees, code sur le dessus
  P.resistors.forEach((s, k) => {
    if (inBand(s.z)) return;
    const R = P.resistor3;
    parts.add(box(R.w - 0.1, R.h, R.d, s.x, R.h / 2, s.z, RGB.resistor));
    for (const sd of [-1, 1]) metal.add(box(0.05, R.h + 0.006, R.d + 0.006, s.x + sd * (R.w / 2 - 0.025), (R.h + 0.006) / 2, s.z, METAL.leg));
    const cell = atlas.length;
    atlas.push({ lines: [P.resistorCodes[k] ?? '000'], weight: 500 });
    labels.add(labelQuad(cell, 0.2, 0.05, s.x, R.h + 0.002, s.z));
  });

  // Condensateurs ceramiques CMS : petits blocs beiges, terminaisons
  for (const s of P.ceramics) {
    if (inBand(s.z)) continue;
    const Cc = P.ceramic3;
    parts.add(box(Cc.w - 0.08, Cc.h, Cc.d, s.x, Cc.h / 2, s.z, RGB.ceramic));
    for (const sd of [-1, 1]) metal.add(box(0.04, Cc.h + 0.006, Cc.d + 0.006, s.x + sd * (Cc.w / 2 - 0.02), (Cc.h + 0.006) / 2, s.z, METAL.leg));
  }

  // Quartz : boitier metallique ovale, couche
  for (const s of P.crystals) metal.add(cyl(P.crystal3.r, P.crystal3.l, seg, s.x, 0, s.z, METAL.can, { alongX: true, squash: 0.62 }));

  // Regulateur TO-220 debout, sa languette, son dissipateur vertical a ailettes
  {
    const r = P.regulator;
    for (const k of [-1, 0, 1]) metal.add(box(0.035, 0.1, 0.035, r.x + k * 0.1, 0.05, r.z + 0.05, METAL.leg));
    parts.add(box(0.4, 0.3, 0.16, r.x, 0.1 + 0.15, r.z + 0.05, RGB.chip));
    metal.add(box(0.4, 0.44, 0.04, r.x, 0.1 + 0.22, r.z - 0.05, METAL.leg));
    metal.add(box(0.72, 0.6, 0.05, r.x, 0.3, r.z - 0.095, METAL.alu));
    for (let f = 0; f < 6; f += 1) metal.add(box(0.035, 0.6, 0.28, r.x - 0.3 + f * 0.12, 0.3, r.z - 0.26, METAL.alu));
  }

  // Connecteur de nappe 2 x 8 : boitier noir, broches dorees
  {
    const h = P.header;
    const H = HEADER;
    parts.add(box(H.w, 0.04, H.d, h.x, 0.02, h.z, RGB.shroud));
    for (const sd of [-1, 1]) parts.add(box(H.w, H.h, H.wall, h.x, H.h / 2, h.z + sd * (H.d / 2 - H.wall / 2), RGB.shroud));
    for (const sd of [-1, 1]) parts.add(box(H.wall, H.h, H.d - 2 * H.wall, h.x + sd * (H.w / 2 - H.wall / 2), H.h / 2, h.z, RGB.shroud));
    for (let c = 0; c < h.cols; c += 1) {
      for (const row of [-1, 1]) metal.add(box(0.03, 0.24, 0.03, h.x + (c - (h.cols - 1) / 2) * H.pitch, 0.04 + 0.12, h.z + row * H.pitch * 0.5, METAL.gold));
    }
  }

  // Bornier a vis 3 points : bloc bleu, entrees des fils, vis et leur fente
  {
    const t = P.terminal;
    const w = t.n * TERM.pitch;
    parts.add(box(w, TERM.h, TERM.d, t.x, TERM.h / 2, t.z, RGB.block));
    for (let k = 0; k < t.n; k += 1) {
      const x = t.x - w / 2 + TERM.pitch * (k + 0.5);
      parts.add(box(0.2, 0.14, 0.012, x, 0.13, t.z - TERM.d / 2 - 0.004, RGB.blockHole));
      metal.add(cyl(0.1, 0.03, seg, x, TERM.h, t.z + 0.03, METAL.screw));
      metal.add(box(0.15, 0.012, 0.028, x, TERM.h + 0.03 + 0.004, t.z + 0.03, METAL.recess));
    }
  }

  // Vis cruciformes des trous de fixation
  for (const h of P.holes) {
    metal.add(cyl(0.15, 0.045, seg, h.x, 0, h.z, METAL.screw));
    metal.add(box(0.17, 0.012, 0.03, h.x, 0.045 + 0.004, h.z, METAL.recess));
    metal.add(box(0.03, 0.012, 0.17, h.x, 0.045 + 0.004, h.z, METAL.recess));
  }

  // LED allumee : son dome, et sa lueur couchee sur le cuivre
  {
    const l = P.led;
    const body = new CylinderGeometry(0.07, 0.075, 0.06, 12);
    body.translate(l.x, 0.03, l.z);
    const dome = new SphereGeometry(0.07, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(l.x, 0.06, l.z);
    for (const g of [body, dome]) {
      const uv = g.getAttribute('uv');
      for (let i = 0; i < uv.count; i += 1) uv.setXY(i, 0.5, 0.5);
      paint(g, LED_RGB.dome);
      led.add(g);
    }
    const glow = new PlaneGeometry(1.1, 1.1);
    glow.rotateX(-Math.PI / 2);
    glow.translate(l.x, 0.004, l.z);
    paint(glow, LED_RGB.glow);
    led.add(glow);
  }

  // Les composants de plus (2026-10-03)
  for (const e of extrasOf(variant)) {
    const S = EXTRA_SIZE[e.kind];
    if (e.kind === 'trim') {
      // Trimmer : boitier carre bleu, rotor blanc et sa fente en croix
      parts.add(box(S.hx * 2, 0.2, S.hz * 2, e.x, 0.1, e.z, RGB_EXTRA.trim));
      parts.add(cyl(0.12, 0.03, seg, e.x, 0.2, e.z, RGB.capBand));
      metal.add(box(0.17, 0.012, 0.03, e.x, 0.235, e.z, METAL.recess));
      metal.add(box(0.03, 0.012, 0.17, e.x, 0.235, e.z, METAL.recess));
      for (const k of [-1, 0, 1]) metal.add(box(0.03, 0.05, 0.03, e.x + k * 0.1, 0.025, e.z + S.hz + 0.02, METAL.leg));
    } else if (e.kind === 'film') {
      // Condensateur film : bloc rouge, deux pattes, marquage
      parts.add(box(S.hx * 2, 0.34, S.hz * 2, e.x, 0.17, e.z, RGB_EXTRA.film));
      const cell = atlas.length;
      atlas.push({ lines: [e.label ?? 'MKS2', '.1 63V'], weight: 600 });
      labels.add(labelQuad(cell, 0.4, 0.13, e.x, 0.342, e.z));
    } else if (e.kind === 'to92') {
      // Transistor TO-92 : demi-cylindre noir sur trois pattes
      parts.add(cyl(0.12, 0.24, seg, e.x, 0.08, e.z, RGB_EXTRA.to92, { thetaStart: Math.PI / 2, thetaLength: Math.PI }));
      parts.add(box(0.24, 0.24, 0.012, e.x, 0.2, e.z, RGB_EXTRA.to92));
      for (const k of [-1, 0, 1]) metal.add(box(0.025, 0.08, 0.025, e.x + k * 0.08, 0.04, e.z + 0.03, METAL.leg));
    } else if (e.kind === 'dip') {
      // Ampli-op DIP-14 : corps noir sur ses pattes, encoche, marquage
      parts.add(box(S.hx * 2, 0.15, S.hz * 2, e.x, 0.05 + 0.075, e.z, RGB.chip));
      parts.add(cyl(0.05, 0.004, 10, e.x - S.hx + 0.02, 0.2, e.z, RGB.dimple, { thetaStart: 0, thetaLength: Math.PI }));
      for (const sd of [-1, 1]) {
        for (let j = 0; j < 7; j += 1) {
          metal.add(box(0.05, 0.03, 0.08, e.x - 0.36 + j * 0.12, 0.11, e.z + sd * (S.hz + 0.01), METAL.leg));
          metal.add(box(0.03, 0.1, 0.03, e.x - 0.36 + j * 0.12, 0.05, e.z + sd * (S.hz + 0.04), METAL.leg));
        }
      }
      const cell = atlas.length;
      atlas.push({ lines: [e.label ?? 'IC', 'VRSTL 2026'], weight: 600 });
      labels.add(labelQuad(cell, 0.7, 0.2, e.x + 0.04, 0.203, e.z));
    } else if (e.kind === 'sot') {
      // SOT-23 : petit corps noir, trois pattes
      parts.add(box(S.hx * 2, 0.07, S.hz * 2, e.x, 0.045, e.z, RGB.chip));
      for (const k of [-1, 1]) metal.add(box(0.03, 0.03, 0.06, e.x + k * 0.07, 0.015, e.z + S.hz + 0.02, METAL.leg));
      metal.add(box(0.03, 0.03, 0.06, e.x, 0.015, e.z - S.hz - 0.02, METAL.leg));
    }
  }

  return { parts: parts.build('parts'), metal: metal.build('metal'), labels: labels.build('labels'), led: led.build('led'), ranges, atlas };
}

/**
 * La carte : dessus (texture), chanfrein de 0.03 sur les quatre bords,
 * tranches et dessous sur l'aplat de fibre de verre du coin de la texture
 * (UV constant : niveau 0, l'aplat exact). 20 triangles.
 */
function buildBoard(W: number, H: number): BufferGeometry {
  const w = PCB.w / 2;
  const d = PCB.d / 2;
  const h = PCB.h;
  const c = PCB.chamfer;
  const eu = 1 - 2 / W;
  const ev = 1 - 2 / H;
  const pos: number[] = [];
  const uv: number[] = [];
  type V = [number, number, number];
  const topUv = (p: V): [number, number] => [(p[0] + w) / (2 * w), 1 - (p[2] + d) / (2 * d)];
  const quad = (a: V, b: V, cc: V, dd: V, out: V, mapped: boolean): void => {
    // Ordre des sommets : la normale geometrique du triangle suit `out`
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = cc[0] - a[0];
    const vy = cc[1] - a[1];
    const vz = cc[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const flip = nx * out[0] + ny * out[1] + nz * out[2] < 0;
    const tris: V[] = flip ? [a, cc, b, a, dd, cc] : [a, b, cc, a, cc, dd];
    for (const p of tris) {
      pos.push(p[0], p[1], p[2]);
      const t = mapped ? topUv(p) : [eu, ev];
      uv.push(t[0], t[1]);
    }
  };
  const t = h;
  const s = h - c;
  // Dessus
  quad([-w + c, t, -d + c], [w - c, t, -d + c], [w - c, t, d - c], [-w + c, t, d - c], [0, 1, 0], true);
  // Chanfreins
  quad([-w + c, t, d - c], [w - c, t, d - c], [w, s, d], [-w, s, d], [0, 1, 1], false);
  quad([w - c, t, -d + c], [-w + c, t, -d + c], [-w, s, -d], [w, s, -d], [0, 1, -1], false);
  quad([w - c, t, d - c], [w - c, t, -d + c], [w, s, -d], [w, s, d], [1, 1, 0], false);
  quad([-w + c, t, -d + c], [-w + c, t, d - c], [-w, s, d], [-w, s, -d], [-1, 1, 0], false);
  // Tranches
  quad([-w, s, d], [w, s, d], [w, 0, d], [-w, 0, d], [0, 0, 1], false);
  quad([w, s, -d], [-w, s, -d], [-w, 0, -d], [w, 0, -d], [0, 0, -1], false);
  quad([w, s, d], [w, s, -d], [w, 0, -d], [w, 0, d], [1, 0, 0], false);
  quad([-w, s, -d], [-w, s, d], [-w, 0, d], [-w, 0, -d], [-1, 0, 0], false);
  // Dessous
  quad([-w, 0, -d], [w, 0, -d], [w, 0, d], [-w, 0, d], [0, -1, 0], false);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/* ---------------- textures annexes ---------------- */

function canvas2d(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('pcb: no 2d context');
  return { canvas, ctx: ctx as Ctx };
}

/**
 * Carte d'environnement procedurale (equirectangulaire 256 x 128) : un
 * studio sombre, une boite a lumiere chaude du cote de la cle, une plus
 * petite jaune a gauche (le lisere), le sol a l'encre. Les metaux du PCB
 * y prennent leurs reflets ; three la prefiltre (PMREM) une fois.
 */
function drawEnv(ctx: Ctx, W: number, H: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#b4ab9c');
  g.addColorStop(0.4, '#6c665c');
  g.addColorStop(0.5, '#3d3933');
  g.addColorStop(0.62, '#24221f');
  g.addColorStop(1, '#141413');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const soft = (x: number, y: number, rx: number, ry: number, color: string): void => {
    const r = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    r.addColorStop(0, color);
    r.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    ctx.translate(-x, -y);
    ctx.fillStyle = r;
    ctx.fillRect(x - Math.max(rx, ry), y - Math.max(rx, ry), 2 * Math.max(rx, ry), 2 * Math.max(rx, ry));
    ctx.restore();
  };
  soft(W * 0.62, H * 0.2, W * 0.14, H * 0.13, 'rgba(255, 244, 226, 1)');
  soft(W * 0.12, H * 0.38, W * 0.06, H * 0.09, 'rgba(242, 194, 48, 0.9)');
  soft(W * 0.88, H * 0.3, W * 0.09, H * 0.1, 'rgba(246, 241, 231, 0.7)');
  soft(W * 0.37, H * 0.42, W * 0.1, H * 0.06, 'rgba(246, 241, 231, 0.45)');
}

/** Halo de la LED : blanc, alpha de 1 au centre a 0 au bord, decroissance au carre. */
function drawRadial(ctx: Ctx, n: number): void {
  const img = ctx.createImageData(n, n);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const dx = ((i + 0.5) / n) * 2 - 1;
      const dy = ((j + 0.5) / n) * 2 - 1;
      const a = Math.max(0, 1 - Math.hypot(dx, dy)) ** 2;
      const o = (j * n + i) * 4;
      img.data[o] = 255;
      img.data[o + 1] = 255;
      img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------------- le PCB ---------------- */

export interface PcbInfo {
  size: [number, number];
  /** textures generees (premiere apparition), et leur cout */
  prepared: boolean;
  prepareMs: number;
  traces: number;
  segments: number;
  pairs: number;
  power: number;
  meanders: number;
  pads: number;
  vias: number;
  parts: number;
  /** triangles de toutes les geometries du PCB (carte comprise) */
  triangles: number;
  /** objets dessines du PCB : carte, plastiques, metaux, marquages, LED */
  meshes: number;
  draws: number;
  webfont: boolean;
  rise: Record<ChipId, number>;
  lit: Record<ChipId, boolean>;
  litDraws: number;
}

export class Pcb {
  readonly board: Mesh;
  readonly parts: Mesh;
  readonly metal: Mesh;
  readonly labels: Mesh;
  readonly led: Mesh;
  readonly texture: CanvasTexture;
  private orm: CanvasTexture;
  private atlasTex: CanvasTexture;
  private radialTex: CanvasTexture;
  private envTex: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private ormCanvas: HTMLCanvasElement;
  private ormCtx: Ctx;
  private atlasCanvas: HTMLCanvasElement;
  private envCanvas: HTMLCanvasElement;
  private W: number;
  private H: number;
  private aW: number;
  private aH: number;
  private boardMat: MeshPhysicalMaterial;
  /** relief de la carte (2026-10-03) : pistes, pastilles et serigraphie en bosse sous le vernis brillant */
  private normalTex: CanvasTexture;
  private normalCanvas: HTMLCanvasElement;
  private partsMat: MeshStandardMaterial;
  private metalMat: MeshStandardMaterial;
  private labelMat: MeshStandardMaterial;
  private ledMat: MeshBasicMaterial;
  private prints: Footprint[];
  private atlas: AtlasEntry[];
  private traces: Trace[] = [];
  private vias: [number, number][] = [];
  private stitch: [number, number][] = [];
  private ranges: ChipRange[];
  private zones: ExtZone[] = [];
  private prepared = false;
  private prepareMs = 0;
  private draws = 0;
  private litDraws = 0;
  private segments = 0;

  /**
   * model : la ligne de modele de la serigraphie (MM-VOYAGER, 2026-10-03), MM-808 par defaut ; variant : la carte ;
   * chips false : une carte sans les puces des pages (le MM-ARP depuis le 2026-10-04 : ses TWEAKS a leur place)
   */
  private model: string | null;
  private variant: PcbVariant;
  /** puces cliquables et plan de masse de cette carte */
  readonly chips: readonly ChipSpec[];
  private pour: { x0: number; z0: number; x1: number; z1: number };

  constructor(mobile: boolean, anisotropy: number, opts: { model?: string; variant?: PcbVariant; chips?: boolean } = {}) {
    this.model = opts.model ?? null;
    this.variant = opts.variant ?? 'mm808';
    this.chips = opts.chips === false ? [] : BOARD_CHIPS;
    this.pour = POUR;
    const [W, H] = mobile ? PCB.tex.mobile : PCB.tex.desktop;
    this.W = W;
    this.H = H;
    this.aW = mobile ? 512 : 1024;
    this.aH = this.aW;
    // Petits aplats tant que le PCB n'est pas apparu : les materiaux ont
    // leurs cartes des le depart (programmes compiles une fois), les vraies
    // tailles viennent a prepare()
    const c = canvas2d(4, 4);
    this.canvas = c.canvas;
    this.ctx = c.ctx;
    this.ctx.fillStyle = TEX.board;
    this.ctx.fillRect(0, 0, 4, 4);
    const o = canvas2d(4, 4);
    this.ormCanvas = o.canvas;
    this.ormCtx = o.ctx;
    this.ormCtx.fillStyle = ORM.board;
    this.ormCtx.fillRect(0, 0, 4, 4);
    this.atlasCanvas = canvas2d(4, 4).canvas;
    // L'environnement tout de suite (256 x 128, un instant) : three le
    // prefiltre une seule fois, a la compilation des programmes
    const e = canvas2d(256, 128);
    drawEnv(e.ctx, 256, 128);
    this.envCanvas = e.canvas;
    const r = canvas2d(64, 64);
    drawRadial(r.ctx, 64);

    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    this.orm = makeCanvasTexture(this.ormCanvas, anisotropy);
    this.orm.colorSpace = NoColorSpace;
    this.atlasTex = makeCanvasTexture(this.atlasCanvas, anisotropy);
    this.radialTex = makeCanvasTexture(r.canvas, 1);
    this.envTex = makeCanvasTexture(this.envCanvas, 1, false);
    this.envTex.mapping = EquirectangularReflectionMapping;
    this.envTex.colorSpace = SRGBColorSpace;

    this.prints = footprints(this.variant, this.chips);

    // Relief plat tant que la carte n'est pas dessinee
    const nrm = canvas2d(4, 4);
    nrm.ctx.fillStyle = 'rgb(128, 128, 255)';
    nrm.ctx.fillRect(0, 0, 4, 4);
    this.normalCanvas = nrm.canvas;
    this.normalTex = makeCanvasTexture(this.normalCanvas, anisotropy);
    this.normalTex.colorSpace = NoColorSpace;
    // Vernis epargne brillant (2026-10-03) : la couche de vernis (clearcoat) reflete
    // le studio et suit les bosses des pistes, comme une vraie carte
    this.boardMat = new MeshPhysicalMaterial({
      map: this.texture,
      roughnessMap: this.orm,
      metalnessMap: this.orm,
      aoMap: this.orm,
      aoMapIntensity: 1,
      roughness: 1,
      metalness: 1,
      envMap: this.envTex,
      envMapIntensity: 1,
      normalMap: this.normalTex,
      normalScale: new Vector2(0.9, 0.9),
      clearcoat: 0.9,
      clearcoatRoughness: 0.16,
      clearcoatNormalMap: this.normalTex,
      clearcoatNormalScale: new Vector2(0.45, 0.45),
    });
    this.boardMat.name = 'pcb';
    this.board = new Mesh(buildBoard(W, H), this.boardMat);
    this.board.name = 'pcbBoard';

    const built = buildParts(mobile, this.variant, this.chips);
    this.ranges = built.ranges;
    this.atlas = built.atlas;
    for (const g of [built.parts, built.metal, built.labels]) {
      (g.getAttribute('position') as BufferAttribute).setUsage(DynamicDrawUsage);
    }
    (built.parts.getAttribute('color') as BufferAttribute).setUsage(DynamicDrawUsage);
    this.partsMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, envMap: this.envTex, envMapIntensity: 0.35 });
    this.partsMat.name = 'parts';
    this.parts = new Mesh(built.parts, this.partsMat);
    this.parts.name = 'pcbParts';
    this.metalMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.85, envMap: this.envTex, envMapIntensity: 1.5 });
    this.metalMat.name = 'pcbMetal';
    this.metal = new Mesh(built.metal, this.metalMat);
    this.metal.name = 'pcbMetal';
    this.labelMat = new MeshStandardMaterial({ map: this.atlasTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, roughness: 0.7, metalness: 0 });
    this.labelMat.name = 'pcbLabels';
    this.labels = new Mesh(built.labels, this.labelMat);
    this.labels.name = 'pcbLabels';
    this.ledMat = new MeshBasicMaterial({ map: this.radialTex, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    this.ledMat.name = 'pcbLed';
    this.led = new Mesh(built.led, this.ledMat);
    this.led.name = 'pcbLed';
    this.led.renderOrder = 2;
    // Les composants poussent depuis le dessus de la carte, les trois autres avec eux
    this.parts.position.y = PCB.h;
    this.parts.scale.y = 0.001;
    this.parts.add(this.metal, this.labels, this.led);
    // Ni ombre portee ni recue : sous le plateau leve la carte serait noire
  }

  /* ---------- textures (premiere apparition) ---------- */

  /**
   * Genere une fois les textures : routage, carte (couleur et ORM), atlas
   * des marquages, environnement. A la premiere apparition du PCB (intro,
   * premier OPEN), jamais au montage. true si elles viennent d'etre faites.
   */
  prepare(): boolean {
    if (this.prepared) return false;
    const t0 = performance.now();
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.ormCanvas.width = this.W;
    this.ormCanvas.height = this.H;
    this.atlasCanvas.width = this.aW;
    this.atlasCanvas.height = this.aH;
    this.route();
    this.prepared = true;
    this.draw();
    this.prepareMs = performance.now() - t0;
    return true;
  }

  /** Polices arrivees : redessin, seulement si les textures existent deja. */
  redraw(): void {
    if (this.prepared) this.draw();
  }

  private get ux(): number {
    return this.W / PCB.w;
  }

  private get uz(): number {
    return this.H / PCB.d;
  }

  private px(x: number): number {
    return ((x + PCB.w / 2) / PCB.w) * this.W;
  }

  private py(z: number): number {
    return ((z + PCB.d / 2) / PCB.d) * this.H;
  }

  /** Echelle des tailles en px donnees pour la texture de reference (1024). */
  private get k(): number {
    return this.W / PX_REF;
  }

  /** Repere en unites de la carte (x, z), origine au centre. */
  private units(ctx: Ctx): void {
    ctx.setTransform(this.ux, 0, 0, this.uz, this.W / 2, this.H / 2);
  }

  private texts(): SilkText[] {
    const out: SilkText[] = [];
    // La bande des pages est prise : le nom passe derriere elle, le modele a droite des puces.
    // Pas de ville (regle du site, section 19 point 103).
    const model = this.model ?? 'MM-RYTM REV 4.0';
    const cut = model.indexOf(' ');
    const name = cut < 0 ? model : model.slice(0, cut);
    const rev = cut < 0 ? '' : model.slice(cut + 1);
    out.push({ text: 'MAUDITE MACHINE', ...pcbAt(-5.33, -0.86), px: 24, align: 'left', reserve: 0 });
    out.push({ text: name, ...pcbAt(5.8, -0.05), px: 15, align: 'right', reserve: 0 });
    if (rev) out.push({ text: `${rev}  2026`, ...pcbAt(5.8, 0.33), px: 12, align: 'right', reserve: 0 });
    for (const c of this.chips) {
      const D = chipDims(c);
      const reserve = c.href ? CHIP.extGapPx + D.labelPx * SILK.capRatio : 0;
      out.push({ text: c.silk, x: c.x, z: c.z + D.labelDz, px: D.labelPx, align: 'center', reserve, nav: true });
    }
    for (const f of this.prints) if (f.ref) out.push({ text: f.ref, x: f.refX, z: f.refZ, px: PCB.designatorPx, align: f.refAlign, reserve: 0 });
    out.push({ text: 'PWR', x: P.led.x + 0.2, z: P.led.z + 0.12, px: 10, align: 'left', reserve: 0 });
    out.push({ text: 'GND', x: this.pour.x0 + 0.25, z: this.pour.z1 - 0.2, px: 12, align: 'left', reserve: 0 });
    for (const c of P.caps) out.push({ text: '+', x: c.x - P.cap3.r - 0.1, z: c.z, px: 12, align: 'center', reserve: 0 });
    return out;
  }

  private textRect(t: SilkText): Rect {
    const u = this.ux;
    const px = t.px * this.k;
    const w = (trackedWidth(this.ctx, t.text, px, PCB_TYPE.weight, PCB_TYPE.tracking) * 1.2) / u;
    const h = (px * SILK.capRatio) / this.uz;
    const x0 = t.align === 'left' ? t.x : t.align === 'right' ? t.x - w : t.x - w / 2;
    return { x0, z0: t.z - h / 2, x1: x0 + w + (t.reserve * this.k) / u, z1: t.z + h / 2 };
  }

  /**
   * Le routage, une fois pour toutes (graine fixe) : grille des obstacles
   * (composants, textes, trous, plan de masse ; marge 0.1), departs au ras
   * des composants, marches aleatoires a 45 deg (tout droit d'abord, jamais
   * d'angle droit). Puis le choix des paires, des pistes d'alimentation,
   * des serpentins et des changements de couche, et les vias.
   */
  private route(): void {
    const rnd = mulberry32(PCB.seed);
    const grid = new Uint8Array(COLS * ROWS);
    const at = (i: number, j: number): number => grid[j * COLS + i];
    const put = (i: number, j: number, v: number): void => {
      grid[j * COLS + i] = v;
    };
    const inGrid = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < COLS && j < ROWS;
    const M = 0.1;
    const block = (r: Rect, m = M): void => {
      for (let j = 0; j < ROWS; j += 1) {
        for (let i = 0; i < COLS; i += 1) {
          const x = gx(i);
          const z = gz(j);
          if (x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m) put(i, j, BLOCKED);
        }
      }
    };
    for (const f of this.prints) block({ x0: f.x - f.hx, z0: f.z - f.hz, x1: f.x + f.hx, z1: f.z + f.hz });
    for (const t of this.texts()) block(this.textRect(t));
    block({ x0: this.pour.x0, z0: this.pour.z0, x1: this.pour.x1, z1: this.pour.z1 }, 0.12);

    const starts: { i: number; j: number; d: number; main: boolean }[] = [];
    for (const f of this.prints) {
      if (!f.axis) continue;
      const x0 = f.x - f.hx - M;
      const x1 = f.x + f.hx + M;
      const z0 = f.z - f.hz - M;
      const z1 = f.z + f.hz + M;
      if (f.axis === 'z') {
        for (let i = 0; i < COLS; i += 1) {
          if (gx(i) < f.x - f.hx || gx(i) > f.x + f.hx) continue;
          const jf = Math.ceil((z1 - Z0) / G - 1e-6);
          const jb = Math.floor((z0 - Z0) / G + 1e-6);
          if (inGrid(i, jf)) starts.push({ i, j: jf, d: 2, main: f.frame });
          if (inGrid(i, jb)) starts.push({ i, j: jb, d: 6, main: f.frame });
        }
      } else {
        for (let j = 0; j < ROWS; j += 1) {
          if (gz(j) < f.z - f.hz || gz(j) > f.z + f.hz) continue;
          const ir = Math.ceil((x1 - X0) / G - 1e-6);
          const il = Math.floor((x0 - X0) / G + 1e-6);
          if (inGrid(ir, j)) starts.push({ i: ir, j, d: 0, main: false });
          if (inGrid(il, j)) starts.push({ i: il, j, d: 4, main: false });
        }
      }
    }
    for (let q = starts.length - 1; q > 0; q -= 1) {
      const m = Math.floor(rnd() * (q + 1));
      [starts[q], starts[m]] = [starts[m], starts[q]];
    }
    starts.sort((a, b) => Number(b.main) - Number(a.main));

    const diag = new Set<string>();
    const diagKey = (i: number, j: number, di: number, dj: number, flip: boolean): string => {
      const ci = Math.min(i, i + di);
      const cj = Math.min(j, j + dj);
      const slash = di * dj < 0;
      return `${ci},${cj},${flip ? !slash : slash}`;
    };
    let segments = 0;
    const raw: number[][] = [];
    const walk = (i0: number, j0: number, d0: number): void => {
      if (at(i0, j0) !== FREE) return;
      const path = [i0, j0];
      const mine: string[] = [];
      put(i0, j0, USED);
      let i = i0;
      let j = j0;
      let d = d0;
      const len = 6 + Math.floor(rnd() * 17);
      for (let step = 0; step < len; step += 1) {
        // Tout droit d'abord, puis 45 deg ; jamais 90 (regle de routage)
        const cands: [number, number][] =
          step < 2
            ? [[d, 1]]
            : [
                [d, 7],
                [(d + 1) % 8, 1.5],
                [(d + 7) % 8, 1.5],
              ];
        const ok = cands.filter(([nd]) => {
          const [di, dj] = DIRS[nd];
          const ni = i + di;
          const nj = j + dj;
          if (!inGrid(ni, nj) || at(ni, nj) !== FREE) return false;
          return !(di !== 0 && dj !== 0 && diag.has(diagKey(i, j, di, dj, true)));
        });
        if (ok.length === 0) break;
        let r = rnd() * ok.reduce((a, c) => a + c[1], 0);
        let pick = ok[0][0];
        for (const [nd, w] of ok) {
          r -= w;
          if (r <= 0) {
            pick = nd;
            break;
          }
        }
        const [di, dj] = DIRS[pick];
        if (di !== 0 && dj !== 0) {
          const key = diagKey(i, j, di, dj, false);
          diag.add(key);
          mine.push(key);
        }
        i += di;
        j += dj;
        d = pick;
        put(i, j, USED);
        path.push(i, j);
      }
      if (path.length < 10) {
        for (let q = 0; q < path.length; q += 2) put(path[q], path[q + 1], FREE);
        for (const key of mine) diag.delete(key);
        return;
      }
      segments += path.length / 2 - 1;
      raw.push(path);
    };
    for (const s of starts) {
      if (raw.length >= PCB.traces) break;
      walk(s.i, s.j, s.d);
    }
    for (let guard = 0; raw.length < PCB.traces && guard < 1500; guard += 1) {
      walk(Math.floor(rnd() * COLS), Math.floor(rnd() * ROWS), Math.floor(rnd() * 4) * 2);
    }

    // Les pistes en unites, leur visibilite (vue ouverte : bande avant, bande droite)
    const traces: Trace[] = raw.map((path) => {
      const pts: number[] = [];
      let vis = 0;
      for (let q = 0; q < path.length; q += 2) {
        const x = gx(path[q]);
        const z = gz(path[q + 1]);
        pts.push(x, z);
        vis += (z > 1.1 ? 1 : 0) + (x > 3.6 ? 0.6 : 0);
      }
      return { pts, kind: 'signal', viaAt: -1, meander: null, vis: vis / (path.length / 2) };
    });
    // Ligne droite sur un axe d'au moins 4 pas : la place d'un serpentin
    const straightRun = (pts: number[]): [number, number] | null => {
      let best: [number, number] | null = null;
      let a = 0;
      for (let q = 1; q < pts.length / 2; q += 1) {
        const dx = pts[q * 2] - pts[(q - 1) * 2];
        const dz = pts[q * 2 + 1] - pts[(q - 1) * 2 + 1];
        const axial = Math.abs(dx) < 1e-6 || Math.abs(dz) < 1e-6;
        const pdx = q > 1 ? pts[(q - 1) * 2] - pts[(q - 2) * 2] : dx;
        const pdz = q > 1 ? pts[(q - 1) * 2 + 1] - pts[(q - 2) * 2 + 1] : dz;
        const same = Math.abs(dx - pdx) < 1e-6 && Math.abs(dz - pdz) < 1e-6;
        if (!axial || !same) a = q - 1;
        const n = q - a;
        if (axial && n >= 4 && (!best || n > best[1])) best = [a, n];
      }
      return best;
    };
    const byVis = traces.map((t, q) => q).sort((p, q) => traces[q].vis - traces[p].vis);
    let pairs = 0;
    let power = 0;
    let meanders = 0;
    for (const q of byVis) {
      const t = traces[q];
      const n = t.pts.length / 2;
      if (meanders < PCB.meanders && t.kind === 'signal') {
        const run = straightRun(t.pts);
        if (run) {
          t.meander = run;
          meanders += 1;
          continue;
        }
      }
      if (pairs < PCB.pairs && n >= 8) {
        t.kind = 'pair';
        pairs += 1;
        continue;
      }
      if (power < PCB.power && n >= 6) {
        t.kind = 'power';
        power += 1;
      }
    }
    // Changement de couche : une piste de signal sur trois s'arrete sur un via
    for (const t of traces) {
      if (t.kind !== 'signal' || t.meander || rnd() > 0.34) continue;
      const n = t.pts.length / 2;
      t.viaAt = 3 + Math.floor(rnd() * Math.max(1, n - 4));
    }
    this.traces = traces;
    // Vias seuls sur la grille libre
    for (let guard = 0; this.vias.length < PCB.vias && guard < 3000; guard += 1) {
      const i = Math.floor(rnd() * COLS);
      const j = Math.floor(rnd() * ROWS);
      if (at(i, j) !== FREE) continue;
      put(i, j, USED);
      this.vias.push([gx(i), gz(j)]);
    }
    // Vias de couture du plan de masse : un reseau de 0.32, hors des composants
    const R = this.pour;
    for (let z = R.z0 + 0.2; z < R.z1 - 0.1; z += 0.32) {
      for (let x = R.x0 + 0.2; x < R.x1 - 0.1; x += 0.32) {
        const hit = this.prints.some((f) => x > f.x - f.hx - 0.12 && x < f.x + f.hx + 0.12 && z > f.z - f.hz - 0.12 && z < f.z + f.hz + 0.12);
        const text = x < R.x0 + 0.9 && z > R.z1 - 0.35;
        if (!hit && !text) this.stitch.push([x, z]);
      }
    }
    this.segments = segments;
  }

  /** Le trace d'une piste en unites (serpentin compris) ; jusqu'au via s'il y en a un. */
  private tracePath(ctx: Ctx, t: Trace, offset = 0): void {
    const n = t.viaAt > 0 ? t.viaAt + 1 : t.pts.length / 2;
    const P2: [number, number][] = [];
    for (let q = 0; q < n; q += 1) P2.push([t.pts[q * 2], t.pts[q * 2 + 1]]);
    // Decalage parallele (paires) : normale moyenne des deux segments a chaque sommet, en onglet
    const pts = offset === 0 ? P2 : P2.map((p, q) => {
      const a = P2[Math.max(0, q - 1)];
      const b = P2[Math.min(P2.length - 1, q + 1)];
      const n1 = q > 0 ? norm(p[0] - a[0], p[1] - a[1]) : norm(b[0] - p[0], b[1] - p[1]);
      const n2 = q < P2.length - 1 ? norm(b[0] - p[0], b[1] - p[1]) : n1;
      let nx = -(n1[1] + n2[1]);
      let nz = n1[0] + n2[0];
      const l = Math.hypot(nx, nz) || 1;
      nx /= l;
      nz /= l;
      const cos = Math.max(0.5, nx * -n1[1] + nz * n1[0]);
      return [p[0] + (nx * offset) / cos, p[1] + (nz * offset) / cos] as [number, number];
    });
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let q = 1; q < pts.length; q += 1) {
      if (t.meander && q - 1 === t.meander[0]) {
        // Serpentin : des zigzags serres le long de la ligne droite
        const a = pts[q - 1];
        const b = pts[t.meander[0] + t.meander[1]];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ux = (b[0] - a[0]) / len;
        const uz = (b[1] - a[1]) / len;
        const amp = 0.07;
        const pitch = 0.055;
        const lead = 0.08;
        ctx.lineTo(a[0] + ux * lead, a[1] + uz * lead);
        let s = lead;
        let side = 1;
        while (s + pitch < len - lead) {
          const cx = a[0] + ux * s;
          const cz = a[1] + uz * s;
          ctx.lineTo(cx - uz * amp * side, cz + ux * amp * side);
          ctx.lineTo(cx + ux * pitch - uz * amp * side, cz + uz * pitch + ux * amp * side);
          ctx.lineTo(cx + ux * pitch, cz + uz * pitch);
          s += pitch;
          side = -side;
        }
        ctx.lineTo(b[0], b[1]);
        q = t.meander[0] + t.meander[1];
        continue;
      }
      ctx.lineTo(pts[q][0], pts[q][1]);
    }
  }

  /**
   * Tout le cuivre (hors plan de masse) : pistes, bouts de pistes et vias
   * dans `copper` (sous le vernis depuis le 2026-10-01), pastilles des
   * composants et anneaux des trous de fixation dans `pads` (l'or, nu).
   */
  private copper(ctx: Ctx, copper: string, pads: string): void {
    this.units(ctx);
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = copper;
    for (const t of this.traces) {
      if (t.kind === 'pair') {
        ctx.lineWidth = PCB.pairW;
        for (const sd of [-1, 1]) {
          this.tracePath(ctx, t, (sd * PCB.pairGap) / 2);
          ctx.stroke();
        }
      } else {
        ctx.lineWidth = t.kind === 'power' ? PCB.powerW : PCB.signalW;
        this.tracePath(ctx, t);
        ctx.stroke();
      }
    }
    ctx.fillStyle = copper;
    const disc = (x: number, z: number, r: number): void => {
      ctx.beginPath();
      ctx.ellipse(x, z, r, r, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    // Bouts de pistes et vias (sous le vernis), puis pastilles et anneaux (or)
    for (const t of this.traces) {
      const n = t.viaAt > 0 ? t.viaAt + 1 : t.pts.length / 2;
      const r = t.kind === 'power' ? PCB.padR * 1.6 : PCB.padR;
      if (t.kind === 'pair') {
        continue;
      }
      disc(t.pts[0], t.pts[1], r);
      disc(t.pts[(n - 1) * 2], t.pts[(n - 1) * 2 + 1], t.viaAt > 0 ? PCB.viaR * 1.2 : r);
    }
    for (const [x, z] of this.vias) disc(x, z, PCB.viaR);
    for (const [x, z] of this.stitch) disc(x, z, PCB.viaR);
    ctx.fillStyle = pads;
    for (const f of this.prints) {
      for (const p of f.pads) {
        if (p.round) disc(p.x, p.z, p.w / 2);
        else ctx.fillRect(p.x - p.w / 2, p.z - p.d / 2, p.w, p.d);
      }
    }
    for (const h of P.holes) disc(h.x, h.z, 0.22);
  }

  /** Trous : centres des vias et trous de fixation. */
  private holes(ctx: Ctx, color: string): void {
    this.units(ctx);
    ctx.fillStyle = color;
    const disc = (x: number, z: number, r: number): void => {
      ctx.beginPath();
      ctx.ellipse(x, z, r, r, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const t of this.traces) if (t.viaAt > 0) disc(t.pts[t.viaAt * 2], t.pts[t.viaAt * 2 + 1], PCB.viaHole);
    for (const [x, z] of this.vias) disc(x, z, PCB.viaHole);
    for (const [x, z] of this.stitch) disc(x, z, PCB.viaHole);
    for (const h of P.holes) disc(h.x, h.z, 0.12);
  }

  /**
   * Plan de masse : hachures a 45 deg dans un rectangle arrondi, degagees
   * de 0.08 autour des composants et de leurs pastilles ; un masque blanc
   * (alpha), teinte ensuite pour la couleur et pour l'ORM.
   */
  private pourMask(): HTMLCanvasElement {
    const { canvas, ctx } = canvas2d(this.W, this.H);
    this.units(ctx);
    const R = this.pour;
    const rr = (x0: number, z0: number, x1: number, z1: number, r: number): void => {
      ctx.beginPath();
      ctx.moveTo(x0 + r, z0);
      ctx.arcTo(x1, z0, x1, z1, r);
      ctx.arcTo(x1, z1, x0, z1, r);
      ctx.arcTo(x0, z1, x0, z0, r);
      ctx.arcTo(x0, z0, x1, z0, r);
      ctx.closePath();
    };
    ctx.save();
    rr(R.x0, R.z0, R.x1, R.z1, 0.12);
    ctx.clip();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.022;
    const span = R.x1 - R.x0 + R.z1 - R.z0;
    for (let s = -span; s < span; s += 0.09) {
      ctx.beginPath();
      ctx.moveTo(R.x0 + s, R.z0);
      ctx.lineTo(R.x0 + s + span, R.z0 + span);
      ctx.moveTo(R.x0 + s, R.z1);
      ctx.lineTo(R.x0 + s + span, R.z1 - span);
      ctx.stroke();
    }
    ctx.restore();
    ctx.lineWidth = 0.04;
    rr(R.x0, R.z0, R.x1, R.z1, 0.12);
    ctx.stroke();
    // Degagements
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    const clr = 0.08;
    for (const f of this.prints) {
      if (f.round) {
        ctx.beginPath();
        ctx.ellipse(f.x, f.z, f.hx + clr, f.hz + clr, 0, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(f.x - f.hx - clr, f.z - f.hz - clr, 2 * (f.hx + clr), 2 * (f.hz + clr));
    }
    // La place du texte GND
    ctx.fillRect(R.x0 + 0.12, R.z1 - 0.34, 0.85, 0.26);
    for (const [x, z] of this.stitch) {
      ctx.beginPath();
      ctx.ellipse(x, z, PCB.viaR + 0.035, PCB.viaR + 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas;
  }

  /** Le masque teinte d'une couleur, pose sur ctx. */
  private stamp(ctx: Ctx, mask: HTMLCanvasElement, color: string, tint: { canvas: HTMLCanvasElement; ctx: Ctx }): void {
    const t = tint.ctx;
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, this.W, this.H);
    t.drawImage(mask, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = color;
    t.fillRect(0, 0, this.W, this.H);
    t.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tint.canvas, 0, 0);
  }

  /** Ombres de contact : une tache sombre et floue au pied de chaque composant. */
  private shadows(ctx: Ctx, color: string, op: GlobalCompositeOperation): void {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = op;
    const off = this.W * 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 0.07 * this.ux;
    ctx.shadowOffsetX = off;
    ctx.fillStyle = '#000';
    const spread = 0.03;
    for (const f of this.prints) {
      const s = f.shadow;
      if (!s) continue;
      const x = this.px(s.x) - off;
      const y = this.py(s.z);
      const rx = (s.hx + spread) * this.ux;
      const ry = (s.hz + spread) * this.uz;
      ctx.beginPath();
      if (s.round) ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      else ctx.rect(x - rx, y - ry, 2 * rx, 2 * ry);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Bruit tres doux (vernis jamais uni) : une petite grille aleatoire etiree, lissee. */
  private blotches(seed: number, cols: number, rows: number): HTMLCanvasElement {
    const { canvas, ctx } = canvas2d(cols, rows);
    const img = ctx.createImageData(cols, rows);
    const rnd = mulberry32(seed);
    for (let q = 0; q < cols * rows; q += 1) {
      img.data[q * 4] = 255;
      img.data[q * 4 + 1] = 255;
      img.data[q * 4 + 2] = 255;
      img.data[q * 4 + 3] = Math.round(rnd() * 255);
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  /** Dessine toute la carte (couleur et ORM) et l'atlas des marquages. */
  draw(): void {
    if (!this.prepared) return;
    const ctx = this.ctx;
    const orm = this.ormCtx;
    const { W, H } = this;
    const k = this.k;
    const rnd = mulberry32(PCB.seed + 1);
    for (const c of [ctx, orm]) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.imageSmoothingEnabled = true;
    }

    // Relief (2026-10-03) : une carte de hauteur dessinee comme la couleur
    const hgt = canvas2d(W, H);
    const hc = hgt.ctx;
    hc.fillStyle = HEIGHT.board;
    hc.fillRect(0, 0, W, H);

    // Vernis : un vert sombre jamais uni (taches tres douces), rugosite qui varie
    ctx.fillStyle = TEX.board;
    ctx.fillRect(0, 0, W, H);
    orm.fillStyle = ORM.board;
    orm.fillRect(0, 0, W, H);
    const lo = this.blotches(PCB.seed + 2, 28, 18);
    const hi = this.blotches(PCB.seed + 3, 9, 6);
    const tintOf = (mask: HTMLCanvasElement, color: string): HTMLCanvasElement => {
      const { canvas, ctx: t } = canvas2d(mask.width, mask.height);
      t.drawImage(mask, 0, 0);
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = color;
      t.fillRect(0, 0, mask.width, mask.height);
      return canvas;
    };
    ctx.globalAlpha = 0.07;
    ctx.drawImage(tintOf(lo, '#3d6b4a'), 0, 0, W, H);
    ctx.globalAlpha = 0.1;
    ctx.drawImage(tintOf(hi, '#040a06'), 0, 0, W, H);
    ctx.globalAlpha = 1;
    orm.globalAlpha = 0.45;
    orm.drawImage(tintOf(lo, 'rgb(255, 214, 13)'), 0, 0, W, H);
    orm.globalAlpha = 0.35;
    orm.drawImage(tintOf(hi, 'rgb(255, 168, 13)'), 0, 0, W, H);
    orm.globalAlpha = 1;

    // Cuivre : plan de masse, pistes, pastilles (or), vias
    const mask = this.pourMask();
    const tint = canvas2d(W, H);
    this.stamp(ctx, mask, TEX.trace, tint);
    this.stamp(orm, mask, ORM.trace, tint);
    this.stamp(hc, mask, HEIGHT.trace, tint);
    mask.width = 0;
    mask.height = 0;
    tint.canvas.width = 0;
    tint.canvas.height = 0;
    this.copper(ctx, TEX.trace, TEX.gold);
    this.copper(orm, ORM.trace, ORM.copper);
    this.copper(hc, HEIGHT.trace, HEIGHT.pad);
    this.holes(ctx, TEX.hole);
    this.holes(orm, ORM.hole);
    this.holes(hc, HEIGHT.hole);

    // Serigraphie : contours (blancs, les puces cliquables aussi depuis le 2026-10-01), textes
    for (const [c, ink, frame] of [
      [ctx, TEX.silk, TEX.silk],
      [orm, ORM.silk, ORM.silk],
      [hc, HEIGHT.silk, HEIGHT.silk],
    ] as const) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      for (const f of this.prints) {
        if (!f.outline) continue;
        c.strokeStyle = f.frame ? frame : ink;
        c.lineWidth = Math.max(1, (f.frame ? PCB.chipFrame : PCB.outline) * k);
        c.beginPath();
        if (f.round) c.ellipse(this.px(f.x), this.py(f.z), f.hx * this.ux, f.hz * this.uz, 0, 0, Math.PI * 2);
        else c.rect(this.px(f.x - f.hx), this.py(f.z - f.hz), f.hx * 2 * this.ux, f.hz * 2 * this.uz);
        c.stroke();
      }
      c.textBaseline = 'alphabetic';
      for (const t of this.texts()) {
        c.fillStyle = c === ctx ? (t.nav ? TEX.nav : TEX.silk) : c === hc ? HEIGHT.silk : ORM.silk;
        const px = t.px * k;
        const w = trackedWidth(c, t.text, px, PCB_TYPE.weight, PCB_TYPE.tracking);
        const x = this.px(t.x);
        const x0 = t.align === 'left' ? x : t.align === 'right' ? x - w : x - w / 2;
        drawTracked(c, t.text, x0, this.py(t.z) + (px * SILK.capRatio) / 2, px, PCB_TYPE.weight, PCB_TYPE.tracking);
      }
    }

    // L'etiquette a code-barres de la MM-808 (papier blanc mat, en leger relief)
    if (this.variant === 'mm808') this.sticker(ctx, orm, hc);

    // Ombres de contact : la couleur s'assombrit, l'occlusion (rouge) aussi
    this.shadows(ctx, 'rgba(0, 0, 0, 0.62)', 'source-over');
    this.shadows(orm, 'rgb(70, 255, 255)', 'darken');

    // Poussiere : des grains clairs tres discrets
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const specks = Math.round(2600 * (W / 2048) * (H / 1280));
    for (let q = 0; q < specks; q += 1) {
      const x = rnd() * W;
      const y = rnd() * H;
      const s = (0.6 + rnd() * 1.4) * k;
      ctx.fillStyle = `rgba(225, 222, 205, ${(0.04 + rnd() * 0.08).toFixed(3)})`;
      ctx.fillRect(x, y, s, s);
    }

    // Tranche : l'aplat de fibre de verre du coin (sous le chanfrein)
    ctx.fillStyle = TEX.fiber;
    ctx.fillRect(W - 4, 0, 4, 4);
    orm.fillStyle = ORM.fiber;
    orm.fillRect(W - 4, 0, 4, 4);

    this.normals(hgt.canvas);
    hgt.canvas.width = 0;
    hgt.canvas.height = 0;

    this.captureZones();
    for (const z of this.zones) if (this.rangeOf(z.id)?.lit) this.paintZone(z, true);
    this.drawAtlas();
    this.draws += 1;
    this.texture.needsUpdate = true;
    this.orm.needsUpdate = true;
  }

  /** L'etiquette a code-barres : papier blanc, barres noires, numero de serie. */
  private sticker(ctx: Ctx, orm: Ctx, hc: Ctx): void {
    const S = STICKER;
    const x0 = this.px(S.x - S.hx);
    const y0 = this.py(S.z - S.hz);
    const w = 2 * S.hx * this.ux;
    const h = 2 * S.hz * this.uz;
    const r = 0.03 * this.ux;
    const rr = (c: Ctx): void => {
      c.beginPath();
      c.moveTo(x0 + r, y0);
      c.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
      c.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
      c.arcTo(x0, y0 + h, x0, y0, r);
      c.arcTo(x0, y0, x0 + w, y0, r);
      c.closePath();
    };
    for (const [c, fill] of [
      [ctx, '#e9e6dc'],
      [orm, 'rgb(255, 232, 0)'],
      [hc, HEIGHT.sticker],
    ] as const) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = fill;
      rr(c);
      c.fill();
    }
    // Barres : largeurs tirees (graine fixe), sur 70 % de la largeur
    const rnd = mulberry32(PCB.seed + 7);
    ctx.fillStyle = '#16171a';
    let x = x0 + w * 0.08;
    const end = x0 + w * 0.92;
    const bt = y0 + h * 0.14;
    const bh = h * 0.5;
    while (x < end) {
      const bw = (0.004 + rnd() * 0.012) * this.ux;
      if (rnd() > 0.35) ctx.fillRect(x, bt, bw, bh);
      x += bw + (0.004 + rnd() * 0.008) * this.ux;
    }
    ctx.textBaseline = 'alphabetic';
    const px = h * 0.2;
    drawTracked(ctx, 'SN MMRYTM-000808  REV 4.0', x0 + w * 0.08, y0 + h * 0.88, px, 600, 0.08);
  }

  /**
   * Carte de normales du relief : la hauteur ramenee a demi-definition
   * (moyenne 2 x 2), derivees centrees ; le vert suit v (rangee 0 du canevas
   * en haut de la texture).
   */
  private normals(height: HTMLCanvasElement): void {
    const W = Math.floor(this.W / 2);
    const H = Math.floor(this.H / 2);
    const c = this.normalCanvas;
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(height, 0, 0, W, H);
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const h = new Float32Array(W * H);
    for (let i = 0; i < W * H; i += 1) h[i] = d[i * 4] / 255;
    const k = 5.5;
    for (let y = 0; y < H; y += 1) {
      const ym = y > 0 ? y - 1 : y;
      const yp = y < H - 1 ? y + 1 : y;
      for (let x = 0; x < W; x += 1) {
        const xm = x > 0 ? x - 1 : x;
        const xp = x < W - 1 ? x + 1 : x;
        const nx = -(h[y * W + xp] - h[y * W + xm]) * k;
        const ny = (h[yp * W + x] - h[ym * W + x]) * k;
        const l = Math.hypot(nx, ny, 1);
        const o = (y * W + x) * 4;
        d[o] = Math.round(((nx / l) * 0.5 + 0.5) * 255);
        d[o + 1] = Math.round(((ny / l) * 0.5 + 0.5) * 255);
        d[o + 2] = Math.round(((1 / l) * 0.5 + 0.5) * 255);
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.normalTex.needsUpdate = true;
  }

  /** Atlas des marquages : references des puces et codes des resistances, en blanc. */
  private drawAtlas(): void {
    const c = this.atlasCanvas.getContext('2d') as Ctx | null;
    if (!c) return;
    const cw = this.aW / ATLAS.cols;
    const ch = this.aH / ATLAS.rows;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.aW, this.aH);
    c.fillStyle = 'rgba(236, 234, 228, 0.92)';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    this.atlas.forEach((e, n) => {
      const x = (n % ATLAS.cols) * cw + cw / 2;
      const y = Math.floor(n / ATLAS.cols) * ch + ch / 2;
      const lines = e.lines.length;
      const px = (ch * 0.62) / lines;
      c.font = `${e.weight} ${px.toFixed(1)}px ${FONT_DISPLAY}`;
      const wmax = Math.max(...e.lines.map((l) => c.measureText(l).width));
      const s = Math.min(1, (cw * 0.9) / Math.max(1, wmax));
      e.lines.forEach((l, q) => {
        c.save();
        c.translate(x, y + (q - (lines - 1) / 2) * px * 1.15);
        c.scale(s, 1);
        c.fillText(l, 0, 0);
        c.restore();
      });
    });
    this.atlasTex.needsUpdate = true;
  }

  private captureZones(): void {
    const k = this.k;
    const old = this.zones.slice();
    this.zones.length = 0;
    for (const c of this.chips) {
      if (!c.href) continue;
      const g = this.labelGeom(c.silk, c.x, c.z + chipDims(c).labelDz);
      const pad = Math.ceil(4 * k);
      const x0 = Math.max(0, Math.floor(g.x0) - pad);
      const y0 = Math.max(0, Math.floor(g.baseline - g.cap) - pad);
      const x1 = Math.min(this.W, Math.ceil(g.markX + g.cap) + pad);
      const y1 = Math.min(this.H, Math.ceil(g.baseline) + pad);
      const w = x1 - x0;
      const h = y1 - y0;
      let base = old.find((z) => z.id === c.id)?.base ?? null;
      if (w > 0 && h > 0) {
        if (!base) base = document.createElement('canvas');
        base.width = w;
        base.height = h;
        base.getContext('2d')?.drawImage(this.canvas, x0, y0, w, h, 0, 0, w, h);
      } else base = null;
      this.zones.push({ id: c.id, text: c.silk, geom: g, x: x0, y: y0, w, h, base });
    }
  }

  private labelGeom(text: string, x: number, z: number): LabelGeom {
    const k = this.k;
    const px = PCB.chipLabelPx * k;
    const cap = px * SILK.capRatio;
    const w = trackedWidth(this.ctx, text, px, PCB_TYPE.weight, PCB_TYPE.tracking);
    const x0 = this.px(x) - w / 2;
    return { x0, baseline: this.py(z) + cap / 2, cap, px, markX: x0 + w + CHIP.extGapPx * k };
  }

  private paintZone(z: ExtZone, lit: boolean): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!lit) {
      if (z.base) ctx.drawImage(z.base, z.x, z.y);
    } else {
      const g = z.geom;
      ctx.fillStyle = TEX.board;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.fillStyle = TEX.lit;
      ctx.textBaseline = 'alphabetic';
      drawTracked(ctx, z.text, g.x0, g.baseline, g.px, PCB_TYPE.weight, PCB_TYPE.tracking);
      const s = g.cap / EXTERNAL_MARK.box;
      ctx.setTransform(s, 0, 0, s, g.markX, g.baseline - g.cap);
      ctx.strokeStyle = TEX.lit;
      ctx.lineWidth = CHIP.extStroke;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(new Path2D(EXTERNAL_MARK.d));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.litDraws += 1;
    this.texture.needsUpdate = true;
  }

  private rangeOf(id: ChipId): ChipRange | undefined {
    return this.ranges.find((q) => q.id === id);
  }

  /* ---------- puces ---------- */

  hotspots(layer: Object3D): HotspotDef[] {
    return this.chips.map((c) => ({
      id: `chip-${c.id}`,
      kind: 'chip' as const,
      layer,
      shape: 'box' as const,
      x: c.x,
      z: c.z,
      hx: chipDims(c).legX + CHIP.legD / 2,
      hz: chipDims(c).legZ + CHIP.legD / 2,
      y0: PCB.h,
      y1: PCB.h + CHIP.y1,
      enabled: false,
      chip: c.id,
      section: c.section ?? undefined,
    }));
  }

  riseOf(id: ChipId): number {
    return this.rangeOf(id)?.rise ?? 0;
  }

  setLit(id: ChipId, on: boolean): boolean {
    const r = this.rangeOf(id);
    if (!r || r.lit === on || !this.chips.some((c) => c.id === id && c.href)) return false;
    r.lit = on;
    if (r.topCount > 0) {
      const col = this.parts.geometry.getAttribute('color') as BufferAttribute;
      const a = col.array as Float32Array;
      const rgb = on ? RGB.litTop : RGB.chip;
      for (let n = 0; n < r.topCount; n += 1) {
        const o = (r.topStart + n) * 3;
        a[o] = rgb[0];
        a[o + 1] = rgb[1];
        a[o + 2] = rgb[2];
      }
      col.addUpdateRange(r.topStart * 3, r.topCount * 3);
      col.needsUpdate = true;
    }
    const z = this.zones.find((q) => q.id === id);
    if (z) this.paintZone(z, on);
    return true;
  }

  /** Survol : la puce se souleve (corps, pattes, reference) ; true s'il faut une frame. */
  setRise(id: ChipId, y: number): boolean {
    const r = this.rangeOf(id);
    if (!r || r.rise === y) return false;
    r.rise = y;
    const meshes = [this.parts, this.metal, this.labels];
    r.spans.forEach((sp, m) => {
      if (!sp) return;
      const pos = meshes[m].geometry.getAttribute('position') as BufferAttribute;
      const a = pos.array as Float32Array;
      for (let n = 0; n < sp.count; n += 1) a[(sp.start + n) * 3 + 1] = sp.baseY[n] + y;
      pos.addUpdateRange(sp.start * 3, sp.count * 3);
      pos.needsUpdate = true;
    });
    return true;
  }

  info(): PcbInfo {
    const tris = (g: BufferGeometry): number => {
      const idx = g.getIndex();
      return idx ? idx.count / 3 : g.getAttribute('position').count / 3;
    };
    const rise = Object.fromEntries(this.chips.map((c) => [c.id, 0])) as Record<ChipId, number>;
    const lit = Object.fromEntries(this.chips.map((c) => [c.id, false])) as Record<ChipId, boolean>;
    for (const r of this.ranges) {
      rise[r.id] = +r.rise.toFixed(4);
      lit[r.id] = r.lit;
    }
    return {
      size: [this.W, this.H],
      prepared: this.prepared,
      prepareMs: Math.round(this.prepareMs * 10) / 10,
      traces: this.traces.length,
      segments: this.segments,
      pairs: this.traces.filter((t) => t.kind === 'pair').length,
      power: this.traces.filter((t) => t.kind === 'power').length,
      meanders: this.traces.filter((t) => t.meander).length,
      pads: this.prints.reduce((a, f) => a + f.pads.length, 0),
      vias: this.vias.length + this.stitch.length + this.traces.filter((t) => t.viaAt > 0).length,
      parts: this.prints.length,
      triangles: [this.board, this.parts, this.metal, this.labels, this.led].reduce((a, m) => a + tris(m.geometry), 0),
      meshes: 5,
      draws: this.draws,
      webfont: fontsReady(),
      rise,
      lit,
      litDraws: this.litDraws,
    };
  }

  dispose(): void {
    for (const m of [this.board, this.parts, this.metal, this.labels, this.led]) m.geometry.dispose();
    for (const m of [this.boardMat, this.partsMat, this.metalMat, this.labelMat, this.ledMat]) m.dispose();
    for (const t of [this.texture, this.orm, this.atlasTex, this.radialTex, this.envTex, this.normalTex]) t.dispose();
    for (const z of this.zones) {
      if (!z.base) continue;
      z.base.width = 0;
      z.base.height = 0;
    }
    this.zones.length = 0;
    for (const c of [this.canvas, this.ormCanvas, this.atlasCanvas, this.envCanvas, this.normalCanvas]) {
      c.width = 0;
      c.height = 0;
    }
  }
}

/** Vecteur unitaire (x, z). */
function norm(x: number, z: number): [number, number] {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}
