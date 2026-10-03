/**
 * MM-VOYAGEUR (2026-10-03, demande de Mika) : la seconde machine, un synthe
 * d'esprit Minimoog Voyager dessine dans la langue de la MM-808. Joues de
 * noyer de chaque cote, panneau noir mat qui se releve vers l'arriere (les
 * potards, sections encadrees facon Moog), plateau avant ou les pads
 * remplacent le clavier : huit accords de fa diese mineur que
 * l'arpegiateur enchaine. Les liens du site (TRACKS a CONTACT) et OPEN sur
 * le plateau ; OPEN souleve le capot (plateau et panneau d'un bloc) et
 * montre la carte, avec les memes puces GOODIES, MERCH et STUDIO.
 *
 * Repere du rig : origine au centre de l'empreinte, au sol ; +x a droite,
 * +z vers l'utilisateur. Repere du capot (lid) : origine sur le dessus du
 * plateau, au-dessus du centre de l'empreinte ; le plateau est son plan
 * y = 0. Repere du panneau : origine au centre de sa face, x a droite, z
 * qui descend la pente vers l'utilisateur (comme le panneau de la 808).
 * Desktop : 13.6 x 8.6 au sol ; portrait (telephone) : 8.6 x 14.4, les
 * memes elements places en hauteur, comme la 808.
 */

import { PORTRAIT } from '../theme';
import type { VoyKnobId } from './params';

export const VOY_BODY = PORTRAIT
  ? { w: 8.6, d: 14.4, cheek: 0.45, feet: 0.12, deckY: 1.32, bendZ: -0.4, backZ: -6.85, topY: 3.05, lidT: 0.12, wall: 0.16, floorY: 0.32 }
  : { w: 13.6, d: 8.6, cheek: 0.5, feet: 0.12, deckY: 1.32, bendZ: 0.15, backZ: -3.95, topY: 3.36, lidT: 0.12, wall: 0.16, floorY: 0.32 };

/** Largeur entre les joues (le bac), et celle du capot (un jour de 0.02 de chaque cote). */
export const VOY_INNER = VOY_BODY.w - 2 * VOY_BODY.cheek;
export const VOY_LID_W = VOY_INNER - 0.04;
/** Le panneau : sa pente (rad), sa longueur le long de la pente, son centre (repere du capot). */
export const VOY_PANEL = (() => {
  const B = VOY_BODY;
  const run = B.bendZ - B.backZ;
  const rise = B.topY - B.deckY;
  return { angle: Math.atan2(rise, run), len: Math.hypot(run, rise), cy: rise / 2, cz: (B.bendZ + B.backZ) / 2 };
})();

/**
 * Joues de noyer : le profil (z, y) suit le capot de 0.16 au-dessus, arrondi
 * devant (le nez d'une joue de Moog) et derriere.
 */
export const VOY_CHEEK = { above: 0.16, noseR: 0.42, backR: 0.3 } as const;

/**
 * Place de la seconde machine (vue d'ensemble) : a droite de la 808, un
 * jour de 2.6 entre elles (1.8 en portrait).
 */
export const VOY_X = PORTRAIT ? 8.2 / 2 + 1.8 + VOY_BODY.w / 2 : 12.6 / 2 + 2.6 + VOY_BODY.w / 2;

/* ---------- potards (repere du panneau) ---------- */

/**
 * Potard Moog : un capuchon noir cannele (rTop en haut, r a la base,
 * 0.34 de haut, 24 cannelures), une jupe d'aluminium plus large, un repere
 * blanc sur le dessus. CUTOFF et VOLUME plus gros (big).
 */
export const VOY_KNOB = {
  r: 0.25,
  rTop: 0.22,
  h: 0.34,
  flutes: 24,
  fluteDepth: 0.012,
  skirt: { r: 0.35, h: 0.05, rTop: 0.33 },
  mark: { w: 0.03, h: 0.01, d: 0.15 },
  segments: { desktop: 48, mobile: 32 },
  big: PORTRAIT ? 1.12 : 1.28,
  scale: PORTRAIT ? 1.4 : 1,
} as const;

export interface VoyKnobPlace {
  id: VoyKnobId;
  x: number;
  z: number;
  /** echelle (gros potard, portrait) */
  s: number;
  labelZ: number;
}

const DESK_COLS = [-5.55, -4.75, -3.7, -2.9, -2.0, -0.95, 0.1, 0.9, 1.7, 2.5, 3.55, 4.35, 5.45];
const DESK_ROWS = [-0.8, 0.8];
const PORT_COLS = [-3.0, -1.8, -0.6, 0.6, 1.8, 3.0];
const PORT_ROWS = [-1.95, -0.45, 1.05, 2.55];
/** Portrait : le titre d'une rangee, au-dessus de ses potards. */
const PORT_TITLE = 0.68;

/** Cellule (colonne, rangee) de chaque potard ; 'mid' : entre les deux rangees (gros potards, desktop). */
const DESK_CELLS: Record<VoyKnobId, [number, number | 'mid']> = {
  rate: [0, 0],
  mode: [1, 0],
  range: [0, 1],
  gate: [1, 1],
  wave: [2, 0],
  fine: [3, 0],
  glide: [2.5, 1],
  cutoff: [4, 'mid'],
  res: [5, 0],
  envAmt: [5, 1],
  fA: [6, 0],
  fD: [7, 0],
  fS: [8, 0],
  fR: [9, 0],
  aA: [6, 1],
  aD: [7, 1],
  aS: [8, 1],
  aR: [9, 1],
  dist: [10, 0],
  chorus: [11, 0],
  delay: [10, 1],
  reverb: [11, 1],
  volume: [12, 'mid'],
};

const PORT_CELLS: Record<VoyKnobId, [number, number]> = {
  rate: [0, 0],
  mode: [1, 0],
  range: [2, 0],
  gate: [3, 0],
  wave: [4, 0],
  fine: [5, 0],
  cutoff: [0, 1],
  res: [1, 1],
  envAmt: [2, 1],
  glide: [4, 1],
  volume: [5, 1],
  fA: [0, 2],
  fD: [1, 2],
  fS: [2, 2],
  fR: [3, 2],
  dist: [4, 2],
  chorus: [5, 2],
  aA: [0, 3],
  aD: [1, 3],
  aS: [2, 3],
  aR: [3, 3],
  delay: [4, 3],
  reverb: [5, 3],
};

/** x d'une colonne (fractionnaire : entre deux colonnes). */
const colX = (cols: readonly number[], c: number): number => {
  const i = Math.floor(c);
  const f = c - i;
  return f === 0 ? cols[i] : cols[i] + (cols[i + 1] - cols[i]) * f;
};

const BIG = new Set<VoyKnobId>(['cutoff', 'volume']);
/** Libelle sous la jupe : 0.13 sous son bord. */
const labelBelow = (s: number): number => VOY_KNOB.skirt.r * s + 0.13;

export function voyKnobPlace(id: VoyKnobId): VoyKnobPlace {
  const big = BIG.has(id);
  const s = VOY_KNOB.scale * (big ? VOY_KNOB.big : 1);
  if (PORTRAIT) {
    const [c, r] = PORT_CELLS[id];
    const z = PORT_ROWS[r];
    return { id, x: colX(PORT_COLS, c), z, s, labelZ: z + labelBelow(s) };
  }
  const [c, r] = DESK_CELLS[id];
  const z = r === 'mid' ? (DESK_ROWS[0] + DESK_ROWS[1]) / 2 : DESK_ROWS[r];
  return { id, x: colX(DESK_COLS, c), z, s, labelZ: z + labelBelow(s) };
}

/**
 * Titres des sections (serigraphie du panneau) : texte, centre x, z ; et
 * les filets verticaux entre sections (x, z0, z1).
 */
export const VOY_SECTIONS: readonly { text: string; x: number; z: number }[] = PORTRAIT
  ? [
      { text: 'ARPEGGIATOR', x: (PORT_COLS[0] + PORT_COLS[3]) / 2, z: PORT_ROWS[0] - PORT_TITLE },
      { text: 'OSCILLATORS', x: (PORT_COLS[4] + PORT_COLS[5]) / 2, z: PORT_ROWS[0] - PORT_TITLE },
      { text: 'FILTER', x: (PORT_COLS[0] + PORT_COLS[2]) / 2, z: PORT_ROWS[1] - PORT_TITLE },
      { text: 'OUTPUT', x: PORT_COLS[5], z: PORT_ROWS[1] - PORT_TITLE },
      { text: 'FILTER EG', x: (PORT_COLS[0] + PORT_COLS[3]) / 2, z: PORT_ROWS[2] - PORT_TITLE },
      { text: 'EFFECTS', x: (PORT_COLS[4] + PORT_COLS[5]) / 2, z: PORT_ROWS[2] - PORT_TITLE },
      { text: 'AMP EG', x: (PORT_COLS[0] + PORT_COLS[3]) / 2, z: PORT_ROWS[3] - PORT_TITLE },
    ]
  : [
      { text: 'ARPEGGIATOR', x: (DESK_COLS[0] + DESK_COLS[1]) / 2, z: -1.45 },
      { text: 'OSCILLATORS', x: (DESK_COLS[2] + DESK_COLS[3]) / 2, z: -1.45 },
      { text: 'FILTER', x: (DESK_COLS[4] + DESK_COLS[5]) / 2, z: -1.45 },
      { text: 'FILTER EG', x: (DESK_COLS[6] + DESK_COLS[9]) / 2, z: -1.45 },
      { text: 'AMP EG', x: (DESK_COLS[6] + DESK_COLS[9]) / 2, z: 0.02 },
      { text: 'EFFECTS', x: (DESK_COLS[10] + DESK_COLS[11]) / 2, z: -1.45 },
      { text: 'OUTPUT', x: DESK_COLS[12], z: -1.45 },
    ];

/** Filets verticaux entre les sections (desktop) ; filets horizontaux entre rangees (portrait). */
export const VOY_RULES: readonly (readonly number[])[] = PORTRAIT
  ? [
      [-3.65, PORT_ROWS[1] - 0.86, 3.65, PORT_ROWS[1] - 0.86],
      [-3.65, PORT_ROWS[2] - 0.86, 3.65, PORT_ROWS[2] - 0.86],
      [(PORT_COLS[3] + PORT_COLS[4]) / 2, PORT_ROWS[0] - 0.8, (PORT_COLS[3] + PORT_COLS[4]) / 2, PORT_ROWS[3] + 0.72],
    ]
  : [
      [(DESK_COLS[1] + DESK_COLS[2]) / 2, -1.6, (DESK_COLS[1] + DESK_COLS[2]) / 2, 1.6],
      [(DESK_COLS[3] + DESK_COLS[4]) / 2 - 0.05, -1.6, (DESK_COLS[3] + DESK_COLS[4]) / 2 - 0.05, 1.6],
      [(DESK_COLS[5] + DESK_COLS[6]) / 2, -1.6, (DESK_COLS[5] + DESK_COLS[6]) / 2, 1.6],
      [(DESK_COLS[9] + DESK_COLS[10]) / 2, -1.6, (DESK_COLS[9] + DESK_COLS[10]) / 2, 1.6],
      [(DESK_COLS[11] + DESK_COLS[12]) / 2, -1.6, (DESK_COLS[11] + DESK_COLS[12]) / 2, 1.6],
    ];

/** En-tete du panneau : wordmark a gauche, MM-VOYAGEUR a droite, sous-titre. */
export const VOY_HEAD = PORTRAIT
  ? { z: -2.95, word: { x: -3.6, w: 2.5 }, model: { x: 3.6, cap: 0.13 }, sub: null }
  : { z: -1.98, word: { x: -5.9, w: 3.0 }, model: { x: 5.9, cap: 0.14 }, sub: { x: 3.55, text: 'ARPEGGIATOR SYNTHESIZER' } };

/* ---------- plateau (repere du capot, y = 0 : dessus du plateau) ---------- */

/** Les huit pads d'accords : caoutchouc retroeclaire, comme ceux de la 808, plus grands. */
export const VOY_PAD = PORTRAIT
  ? { size: 1.35, height: 0.24, radius: 0.1, dome: 0.045, xs: [-2.7, -0.9, 0.9, 2.7], zs: [3.85, 5.75], perRow: 4, labelDz: 0.84 }
  : { size: 0.98, height: 0.22, radius: 0.08, dome: 0.04, xs: [-3.25, -2.05, -0.85, 0.35, 1.55, 2.75, 3.95, 5.15], zs: [3.0], perRow: 8, labelDz: 0.72 };

export const voyPadAt = (i: number): { x: number; z: number } => ({
  x: VOY_PAD.xs[i % VOY_PAD.perRow],
  z: VOY_PAD.zs[Math.floor(i / VOY_PAD.perRow)],
});

export type VoyButtonId = 'tracks' | 'mixtapes' | 'shows' | 'press' | 'contact' | 'open' | 'clear' | 'random';

/** Boutons du plateau : les cinq pages et OPEN (rectangles), CLEAR et RANDOM (carres). */
export const VOY_BUTTONS: readonly { id: VoyButtonId; label: string; x: number; z: number; w: number; d: number }[] = PORTRAIT
  ? [
      { id: 'tracks', label: 'TRACKS', x: -3.05, z: 1.95, w: 1.0, d: 0.6 },
      { id: 'mixtapes', label: 'MIXTAPES', x: -1.83, z: 1.95, w: 1.0, d: 0.6 },
      { id: 'shows', label: 'SHOWS', x: -0.61, z: 1.95, w: 1.0, d: 0.6 },
      { id: 'press', label: 'PRESS', x: 0.61, z: 1.95, w: 1.0, d: 0.6 },
      { id: 'contact', label: 'CONTACT', x: 1.83, z: 1.95, w: 1.0, d: 0.6 },
      { id: 'open', label: 'OPEN', x: 3.05, z: 1.95, w: 1.0, d: 0.6 },
      { id: 'clear', label: 'CLEAR', x: 1.55, z: 0.5, w: 1.0, d: 0.75 },
      { id: 'random', label: 'RANDOM', x: 2.95, z: 0.5, w: 1.0, d: 0.75 },
    ]
  : [
      { id: 'tracks', label: 'TRACKS', x: -2.25, z: 0.78, w: 0.95, d: 0.5 },
      { id: 'mixtapes', label: 'MIXTAPES', x: -1.05, z: 0.78, w: 0.95, d: 0.5 },
      { id: 'shows', label: 'SHOWS', x: 0.15, z: 0.78, w: 0.95, d: 0.5 },
      { id: 'press', label: 'PRESS', x: 1.35, z: 0.78, w: 0.95, d: 0.5 },
      { id: 'contact', label: 'CONTACT', x: 2.55, z: 0.78, w: 0.95, d: 0.5 },
      { id: 'open', label: 'OPEN', x: 4.0, z: 0.78, w: 0.95, d: 0.5 },
      { id: 'clear', label: 'CLEAR', x: -5.55, z: 3.0, w: 0.8, d: 0.8 },
      { id: 'random', label: 'RANDOM', x: -4.55, z: 3.0, w: 0.8, d: 0.8 },
    ];
export const VOY_BUTTON = { h: 0.12, radius: 0.05, labelGap: 0.2, press: 0.04 } as const;

/** L'ecran du plateau (verre, cadre fusionne au capot), et sa texture. */
export const VOY_LCD = PORTRAIT
  ? { x: -1.75, z: 0.5, w: 3.6, d: 1.0, bezel: { w: 3.84, d: 1.24, h: 0.02 }, tex: [720, 200] as const }
  : { x: -4.55, z: 0.9, w: 2.4, d: 0.9, bezel: { w: 2.62, d: 1.12, h: 0.02 }, tex: [640, 240] as const };

/** Titre au-dessus des pads. */
export const VOY_CHORDS_TITLE = PORTRAIT ? { x: -3.38, z: 2.92, text: 'CHORDS  F# MINOR' } : { x: -3.74, z: 2.2, text: 'CHORDS  F# MINOR' };

/* ---------- vue eclatee, carte ---------- */

/**
 * OPEN : le capot (plateau et panneau) monte, recule et se cabre, comme
 * celui de la 808 ; la carte sort du bac. Memes durees que la 808.
 */
export const VOY_EXPLODE = PORTRAIT
  ? { lift: 6.3, slideZ: -3.4, tiltOpenDeg: -55, pcbRise: 1.0 }
  : { lift: 4.4, slideZ: -2.3, tiltOpenDeg: -12, pcbRise: 1.0 };

/** La carte (celle de la 808, meme taille) dans le bac, a plat. */
export const VOY_PCB_Y = VOY_BODY.floorY + 0.12;

/**
 * Cadrage (desktop : la largeur projetee a l'azimut 45 ; mobile : la
 * largeur de face) et hauteur projetee fermee a la vue d'arrivee, pivot,
 * rayons (cadrage de section), pile ouverte : mesures sur la machine
 * (window.__v4.voyager.fit()).
 */
export const VOY_FRAME = PORTRAIT
  ? { plate: VOY_BODY.w, h: 14.4, targetY: 1.6, radius: { closed: 8.4, open: 10.4 }, fitHalfH: 11.5, explodeTargetY: 4.2 }
  : { plate: Math.SQRT1_2 * (VOY_BODY.w + VOY_BODY.d), h: 9.4, targetY: 1.6, radius: { closed: 8.1, open: 9.0 }, fitHalfH: 8.6, explodeTargetY: 5.6 };

/** Noyer des joues : la texture de fil (px), sa graine, sa repetition. */
export const VOY_WOOD = { tex: [512, 256] as const, seed: 1974, repeat: 0.32 } as const;

export const VOY_COPY = { model: 'MM-VOYAGEUR', group: 'MM-VOYAGEUR synthesizer', lcdIdle: 'MM-VOYAGEUR' } as const;
