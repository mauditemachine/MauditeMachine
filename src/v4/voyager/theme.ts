/**
 * MM-VOYAGER (2026-10-03, demande de Mika) : la seconde machine, un synthe
 * d'esprit Minimoog Voyager dessine dans la langue de la MM-808. Joues de
 * noyer de chaque cote, panneau noir mat qui se releve vers l'arriere (les
 * potards, sections encadrees facon Moog), plateau avant ou les pads
 * remplacent le clavier : huit accords de fa diese mineur que
 * l'arpegiateur enchaine. RUN/STOP, CLEAR, RANDOM et OPEN sur le
 * plateau ; OPEN souleve le capot (plateau et panneau d'un bloc) et montre
 * la carte : les puces GOODIES, MERCH et STUDIO de la 808, et celles des
 * pages du site (TRACKS a CONTACT, PAGE_CHIPS).
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
  ? { w: 8.6, d: 14.4, cheek: 0.45, feet: 0.12, deckY: 1.32, bendZ: -0.5, backZ: -6.85, topY: 3.05, lidT: 0.12, wall: 0.16, floorY: 0.32 }
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
export const VOY_CHEEK = { above: 0.16, noseR: 0.62, backR: 0.4 } as const;

/**
 * Place de la seconde machine (vue d'ensemble) : a droite de la 808, un
 * jour de 2.6 entre elles (1.8 en portrait).
 */
export const VOY_X = PORTRAIT ? 8.2 / 2 + 1.8 + VOY_BODY.w / 2 : 12.6 / 2 + 2.6 + VOY_BODY.w / 2;

/* ---------- potards (repere du panneau, ou du plateau) ---------- */

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
  /** 2026-10-03 (Mika, deux fois) : un filet fin autour du capuchon (r 0.35 a l'origine) */
  skirt: { r: 0.284, h: 0.04, rTop: 0.272 },
  mark: { w: 0.03, h: 0.01, d: 0.15 },
  segments: { desktop: 48, mobile: 32 },
  big: PORTRAIT ? 1.12 : 1.28,
  /** commutateur (SLOPE) : un petit potard a deux positions */
  small: 0.62,
  /** portrait : le plateau garde 1.3 (au doigt), le panneau 1.0 (huit potards par rangee depuis le 2026-10-04 ; 1.15 avant) */
  scale: PORTRAIT ? 1.3 : 1,
  panelScale: 1,
} as const;

/**
 * Selecteurs de forme (WAVE 1, WAVE 2, 2026-10-03, Mika : "les formes
 * d'onde dessinees autour du knob, quelque chose de type Typhon") : autour
 * du potard, un arc jaune par cran (un jour entre eux) et le dessin de sa
 * forme juste dehors ; le cran choisi en plein, les autres plus pales. En
 * unites du potard (multipliees par son echelle) : arc a arcR, epaisseur
 * arcW, dessins centres a glyphR (boite glyph), libelle a labelR du centre.
 */
export const VOY_SEL = {
  arcR: 0.36,
  arcW: 0.045,
  gapDeg: 7,
  glyphR: 0.55,
  glyph: { w: 0.2, h: 0.1, stroke: 0.018 },
  labelR: 0.79,
  /** encre : jaune Typhon sur la machine noire ; sur la claire l'encre de la serigraphie, le cran choisi en orange ; les autres crans a dim */
  dim: { dark: 0.42, light: 0.5 },
} as const;
const SELECTORS = new Set<VoyKnobId>(['wave1', 'wave2']);
export const isSelector = (id: VoyKnobId): boolean => SELECTORS.has(id);

/** Ou se pose un potard : le panneau incline, ou le plateau (l'arpegiateur, et VOLUME au telephone). */
export type VoyWhere = 'panel' | 'deck';

export interface VoyKnobPlace {
  id: VoyKnobId;
  where: VoyWhere;
  x: number;
  z: number;
  /** echelle (gros potard, portrait) */
  s: number;
  labelZ: number;
}

/**
 * Desktop : le panneau garde le son, en colonnes facon Moog, sur trois
 * rangees depuis le 2026-10-04 (le bas du panneau etait libre) :
 *   OSCILLATORS : WAVE 1, WAVE 2 (les selecteurs dessines), TUNE 2 ; le
 *     melangeur OSC 1, OSC 2, NOISE ; FM, RATIO, FINE ;
 *   FILTER : CUTOFF en grand au milieu ; RES, ENV AMT et le commutateur
 *     MODE (LP 24, LP 12, BP, HP) en colonne a cote ;
 *   FILTER EG, AMP EG, puis MOD (SPEED, SHAPE, TARGET, DEPTH) ;
 *   EFFECTS (DIST, CHORUS, DELAY, REVERB), OUTPUT (VOLUME).
 * L'arpegiateur (RATE MODE RANGE NOTES GATE OCTAVE GLIDE) est sur le
 * plateau, a gauche de l'ecran.
 */
const DESK_COLS = [-5.35, -4.0, -2.95, -1.95, -0.9, 0.15, 0.95, 1.75, 2.55, 3.6, 4.4, 5.55];
const DESK_ROWS = [-0.74, 0.46, 1.64];
/** titres des sections, et le haut des filets */
const DESK_TITLE_Z = -1.6;

/** Cellule (colonne, rangee) de chaque potard du panneau ; une rangee fractionnaire : entre deux. */
const DESK_CELLS: Partial<Record<VoyKnobId, [number, number]>> = {
  wave1: [0, 0],
  wave2: [1, 0],
  tune2: [2, 0],
  osc1: [0, 1],
  osc2: [1, 1],
  noise: [2, 1],
  fm: [0, 2],
  ratio: [1, 2],
  fine: [2, 2],
  cutoff: [3, 1],
  res: [4, 0],
  envAmt: [4, 1],
  fmode: [4, 2],
  fA: [5, 0],
  fD: [6, 0],
  fS: [7, 0],
  fR: [8, 0],
  aA: [5, 1],
  aD: [6, 1],
  aS: [7, 1],
  aR: [8, 1],
  lfoRate: [5, 2],
  lfoShape: [6, 2],
  lfoDest: [7, 2],
  lfoAmt: [8, 2],
  dist: [9, 0],
  chorus: [10, 0],
  delay: [9, 1],
  reverb: [10, 1],
  volume: [11, 0.5],
};
/** Plateau, desktop : l'arpegiateur en rangee a gauche de l'ecran. */
const DESK_ARP_Z = 0.85;
/** GLIDE rejoint l'arpegiateur (2026-10-03) */
const DESK_DECK: Partial<Record<VoyKnobId, [number, number]>> = {
  rate: [-5.55, DESK_ARP_Z],
  mode: [-4.8, DESK_ARP_Z],
  range: [-4.05, DESK_ARP_Z],
  notes: [-3.3, DESK_ARP_Z],
  gate: [-2.55, DESK_ARP_Z],
  octave: [-1.8, DESK_ARP_Z],
  glide: [-1.05, DESK_ARP_Z],
};

/**
 * Portrait : le panneau ne garde que le son, quatre rangees, chaque groupe
 * souligne d'un crochet a son nom (2026-10-04 : potards un peu plus petits,
 * huit par rangee) :
 *   OSCILLATORS (WAVE 1, WAVE 2, TUNE 2, FM, RATIO, FINE)
 *   FILTER (CUTOFF RES ENV AMT NOISE MODE)           COLOR (DIST CHORUS)
 *   FILTER EG (A D S R)         MOD (SPEED SHAPE TARGET DEPTH)
 *   AMP EG (A D S R)            MIXER (OSC 1 OSC 2)  SPACE (DELAY REVERB)
 * Le plateau prend l'ecran et VOLUME, le transport, l'arpegiateur (RATE
 * MODE RANGE NOTES GATE OCTAVE GLIDE) et les pads.
 */
const PORT_PANEL_ROWS = [-1.85, -0.2, 1.1, 2.4];
/** pas entre deux potards, jour entre deux groupes, x du premier */
const PORT_PITCH = 0.843;
const PORT_GAP = 0.3;
const PORT_X0 = -3.25;
/** Rangee des oscillateurs : les deux selecteurs (leur couronne de formes), puis TUNE 2, FM, RATIO et FINE au pas 0.85. */
const PORT_OSC_X: Partial<Record<VoyKnobId, number>> = { wave1: -2.55, wave2: -0.7, tune2: 0.575, fm: 1.425, ratio: 2.275, fine: 3.125 };
/** Les trois autres rangees : (rangee, colonne 0 a 7, jours de groupe avant elle). */
const PORT_PANEL: Partial<Record<VoyKnobId, [number, number, number]>> = {
  cutoff: [1, 0, 0],
  res: [1, 1, 0],
  envAmt: [1, 2, 0],
  noise: [1, 3, 0],
  fmode: [1, 4, 0],
  dist: [1, 6, 2],
  chorus: [1, 7, 2],
  fA: [2, 0, 0],
  fD: [2, 1, 0],
  fS: [2, 2, 0],
  fR: [2, 3, 0],
  lfoRate: [2, 4, 1],
  lfoShape: [2, 5, 1],
  lfoDest: [2, 6, 1],
  lfoAmt: [2, 7, 1],
  aA: [3, 0, 0],
  aD: [3, 1, 0],
  aS: [3, 2, 0],
  aR: [3, 3, 0],
  osc1: [3, 4, 1],
  osc2: [3, 5, 1],
  delay: [3, 6, 2],
  reverb: [3, 7, 2],
};
/** Plateau, portrait : l'arpegiateur en rangee (GLIDE au bout), VOLUME a droite de l'ecran. */
const PORT_ARP_Z = 3.0;
const PORT_DECK: Partial<Record<VoyKnobId, [number, number]>> = {
  rate: [-2.9, PORT_ARP_Z],
  mode: [-1.933, PORT_ARP_Z],
  range: [-0.967, PORT_ARP_Z],
  notes: [0, PORT_ARP_Z],
  gate: [0.967, PORT_ARP_Z],
  octave: [1.933, PORT_ARP_Z],
  glide: [2.9, PORT_ARP_Z],
  volume: [2.45, 0.3],
};

/** x d'une colonne (fractionnaire : entre deux colonnes). */
const colX = (cols: readonly number[], c: number): number => {
  const i = Math.floor(c);
  const f = c - i;
  return f === 0 ? cols[i] : cols[i] + (cols[i + 1] - cols[i]) * f;
};
/** z d'une rangee (fractionnaire : entre deux rangees). */
const rowZ = (r: number): number => colX(DESK_ROWS, r);

/** Les gros potards (graduations 0 a 10) : CUTOFF et VOLUME ; au telephone VOLUME seul (huit potards par rangee). */
const BIG = new Set<VoyKnobId>(PORTRAIT ? ['volume'] : ['cutoff', 'volume']);
export const isBigKnob = (id: VoyKnobId): boolean => BIG.has(id);
/** Commutateurs : un petit potard a quelques positions (MODE du filtre : quatre). */
const SMALL = new Set<VoyKnobId>(['fmode']);
export const VOY_SWITCH = { tick: { r0: 0.03, len: 0.05 }, markR: 0.18, cap: 0.052 } as const;
export const isSwitch = (id: VoyKnobId): boolean => SMALL.has(id);
/** Course d'un commutateur de n positions (deg) : un quart de tour a deux, 150 au-dela. */
export const switchThrowDeg = (n: number): number => (n <= 2 ? 90 : 150);
/** Libelle sous la jupe : 0.13 sous son bord ; sous la couronne d'un selecteur. */
const labelBelow = (id: VoyKnobId, s: number): number => (isSelector(id) ? VOY_SEL.labelR * s : VOY_KNOB.skirt.r * s + 0.13);

export function voyKnobPlace(id: VoyKnobId): VoyKnobPlace {
  const big = BIG.has(id);
  const k = big ? VOY_KNOB.big : SMALL.has(id) ? VOY_KNOB.small : 1;
  if (PORTRAIT) {
    const d = PORT_DECK[id];
    if (d) {
      const s = VOY_KNOB.scale * k;
      return { id, where: 'deck', x: d[0], z: d[1], s, labelZ: d[1] + labelBelow(id, s) };
    }
    const s = VOY_KNOB.panelScale * k;
    const ox = PORT_OSC_X[id];
    if (ox !== undefined) {
      const z = PORT_PANEL_ROWS[0];
      return { id, where: 'panel', x: ox, z, s, labelZ: z + labelBelow(id, s) };
    }
    const [r, c, gaps] = PORT_PANEL[id] ?? [1, 0, 0];
    // Un commutateur pose plus bas : son libelle s'aligne sur ceux de la rangee
    const z = PORT_PANEL_ROWS[r] + (SMALL.has(id) ? VOY_KNOB.skirt.r * VOY_KNOB.panelScale * (1 - VOY_KNOB.small) : 0);
    return { id, where: 'panel', x: PORT_X0 + c * PORT_PITCH + gaps * PORT_GAP, z, s, labelZ: z + labelBelow(id, s) };
  }
  const s = VOY_KNOB.scale * k;
  const d = DESK_DECK[id];
  if (d) return { id, where: 'deck', x: d[0], z: d[1], s, labelZ: d[1] + labelBelow(id, s) };
  const [c, r] = DESK_CELLS[id] ?? [0, 0];
  // Un commutateur pose plus bas : son libelle s'aligne sur ceux de la rangee
  const z = rowZ(r) + (SMALL.has(id) ? VOY_KNOB.skirt.r * (1 - VOY_KNOB.small) : 0);
  return { id, where: 'panel', x: colX(DESK_COLS, c), z, s, labelZ: z + labelBelow(id, s) };
}

/** Titres entre deux rangees (AMP EG, MOD) : au milieu du jour entre les libelles du dessus et les potards du dessous. */
const betweenRows = (r: number): number => (DESK_ROWS[r] + VOY_KNOB.skirt.r + 0.13 + DESK_ROWS[r + 1] - VOY_KNOB.skirt.r) / 2;

/**
 * Titres des sections facon Moog (desktop : au-dessus des colonnes, avec
 * des filets verticaux entre elles). En portrait les groupes portent des
 * crochets (VOY_GROUPS) a la place.
 */
export const VOY_SECTIONS: readonly { text: string; x: number; z: number }[] = PORTRAIT
  ? []
  : [
      { text: 'OSCILLATORS', x: (DESK_COLS[0] + DESK_COLS[2]) / 2, z: DESK_TITLE_Z },
      { text: 'FILTER', x: (DESK_COLS[3] + DESK_COLS[4]) / 2, z: DESK_TITLE_Z },
      { text: 'FILTER EG', x: (DESK_COLS[5] + DESK_COLS[8]) / 2, z: DESK_TITLE_Z },
      { text: 'AMP EG', x: (DESK_COLS[5] + DESK_COLS[8]) / 2, z: betweenRows(0) },
      { text: 'MOD', x: (DESK_COLS[5] + DESK_COLS[8]) / 2, z: betweenRows(1) },
      { text: 'EFFECTS', x: (DESK_COLS[9] + DESK_COLS[10]) / 2, z: DESK_TITLE_Z },
      { text: 'OUTPUT', x: DESK_COLS[11], z: DESK_TITLE_Z },
    ];

/** Filets verticaux entre les sections (desktop), jusqu'au bas de la troisieme rangee. */
const RULE_END = DESK_ROWS[2] + 0.5;
const rule = (a: number, b: number): readonly number[] => [(DESK_COLS[a] + DESK_COLS[b]) / 2, DESK_TITLE_Z - 0.15, (DESK_COLS[a] + DESK_COLS[b]) / 2, RULE_END];
export const VOY_RULES: readonly (readonly number[])[] = PORTRAIT ? [] : [rule(2, 3), rule(4, 5), rule(8, 9), rule(10, 11)];

/**
 * En-tete du panneau, comme celui de la 808 : le wordmark a gauche,
 * MM-VOYAGER juste apres, le logotype (mark) a droite ; desktop : le
 * sous-titre avant le logotype.
 */
export const VOY_HEAD = PORTRAIT
  ? { z: -2.95, word: { x: -3.6, w: 2.3 }, model: { x: -1.08, cap: 0.12 }, mark: { x: 3.6, h: 0.4, z: -2.95 }, sub: null }
  : // desktop : le logotype remonte et rapetisse (2026-10-03, Mika : il touchait OUTPUT)
    { z: -1.98, word: { x: -5.9, w: 3.0 }, model: { x: -2.6, cap: 0.14 }, mark: { x: 5.9, h: 0.34, z: -2.05 }, sub: { x: 5.25, text: 'ARPEGGIATOR SYNTHESIZER' } };

/* ---------- plateau (repere du capot, y = 0 : dessus du plateau) ---------- */

/** Les huit pads d'accords : caoutchouc retroeclaire, comme ceux de la 808, plus grands. */
export const VOY_PAD = PORTRAIT
  ? { size: 1.1, height: 0.24, radius: 0.1, dome: 0.045, xs: [-2.55, -0.85, 0.85, 2.55], zs: [4.5, 6.0], perRow: 4, labelDz: 0.74 }
  : { size: 0.98, height: 0.22, radius: 0.08, dome: 0.04, xs: [-4.2, -3.0, -1.8, -0.6, 0.6, 1.8, 3.0, 4.2], zs: [2.75], perRow: 8, labelDz: 0.72 };

export const voyPadAt = (i: number): { x: number; z: number } => ({
  x: VOY_PAD.xs[i % VOY_PAD.perRow],
  z: VOY_PAD.zs[Math.floor(i / VOY_PAD.perRow)],
});

export type VoyButtonId = 'run' | 'clear' | 'random' | 'open';

/**
 * Boutons du plateau (2026-10-03 : les pages sont passees sur la carte,
 * PAGE_CHIPS) : RUN/STOP, CLEAR, RANDOM et OPEN, a droite de l'ecran
 * (desktop : l'arpegiateur a sa gauche) ou en rangee sous lui (portrait,
 * alignes sur les pads).
 */
export const VOY_BUTTONS: readonly { id: VoyButtonId; label: string; x: number; z: number; w: number; d: number }[] = PORTRAIT
  ? [
      { id: 'run', label: 'RUN/STOP', x: -2.55, z: 1.6, w: 1.3, d: 0.6 },
      { id: 'clear', label: 'CLEAR', x: -0.85, z: 1.6, w: 1.3, d: 0.6 },
      { id: 'random', label: 'RANDOM', x: 0.85, z: 1.6, w: 1.3, d: 0.6 },
      { id: 'open', label: 'OPEN', x: 2.55, z: 1.6, w: 1.3, d: 0.6 },
    ]
  : [
      { id: 'run', label: 'RUN/STOP', x: 2.65, z: 0.85, w: 0.8, d: 0.55 },
      { id: 'clear', label: 'CLEAR', x: 3.5, z: 0.85, w: 0.8, d: 0.55 },
      { id: 'random', label: 'RANDOM', x: 4.35, z: 0.85, w: 0.8, d: 0.55 },
      { id: 'open', label: 'OPEN', x: 5.55, z: 0.85, w: 0.9, d: 0.55 },
    ];
export const VOY_BUTTON = { h: 0.12, radius: 0.05, labelGap: 0.2, press: 0.04 } as const;

/** L'ecran du plateau (verre, cadre fusionne au capot), et sa texture. */
export const VOY_LCD = PORTRAIT
  ? { x: -1.6, z: 0.3, w: 3.9, d: 1.0, bezel: { w: 4.14, d: 1.24, h: 0.02 }, tex: [780, 200] as const }
  : { x: 0.75, z: 0.9, w: 2.4, d: 0.9, bezel: { w: 2.62, d: 1.12, h: 0.02 }, tex: [640, 240] as const };

/**
 * Crochets nommes sous un groupe (comme les rangees de la 808) : le trait
 * part du bord du premier element, file sous les libelles, s'interrompt
 * pour le nom (en gras) et remonte au bord du dernier. Plan : panneau ou
 * plateau.
 */
export interface VoyGroup {
  text: string;
  where: VoyWhere;
  x0: number;
  x1: number;
  z: number;
}
export const VOY_GROUP_TYPE = { cap: PORTRAIT ? 0.095 : 0.075, weight: 700, dz: PORTRAIT ? 0.27 : 0.2, side: 0.06, tick: 0.08, pad: 0.1 } as const;

/** Crochet d'un groupe de potards ; with : les autres groupes de la rangee (memes hauteurs). */
function knobGroup(text: string, ids: readonly VoyKnobId[], with_: readonly VoyKnobId[] = []): VoyGroup {
  const ps = ids.map(voyKnobPlace);
  const a = ps[0];
  const b = ps[ps.length - 1];
  const S = VOY_GROUP_TYPE.side;
  return {
    text,
    where: a.where,
    x0: a.x - VOY_KNOB.skirt.r * a.s - S,
    x1: b.x + VOY_KNOB.skirt.r * b.s + S,
    z: Math.max(...[...ids, ...with_].map((id) => voyKnobPlace(id).labelZ)) + VOY_GROUP_TYPE.dz,
  };
}

const CHORDS_TEXT = 'CHORDS  F# MINOR';
const padGroup = (): VoyGroup => ({
  text: CHORDS_TEXT,
  where: 'deck',
  x0: VOY_PAD.xs[0] - VOY_PAD.size / 2 - VOY_GROUP_TYPE.side,
  x1: VOY_PAD.xs[VOY_PAD.perRow - 1] + VOY_PAD.size / 2 + VOY_GROUP_TYPE.side,
  z: VOY_PAD.zs[VOY_PAD.zs.length - 1] + VOY_PAD.labelDz + VOY_GROUP_TYPE.dz,
});

export const VOY_GROUPS: readonly VoyGroup[] = PORTRAIT
  ? [
      knobGroup('OSCILLATORS', ['wave1', 'wave2', 'tune2', 'fm', 'ratio', 'fine']),
      knobGroup('FILTER', ['cutoff', 'res', 'envAmt', 'noise', 'fmode'], ['dist']),
      knobGroup('COLOR', ['dist', 'chorus'], ['cutoff']),
      knobGroup('FILTER EG', ['fA', 'fD', 'fS', 'fR'], ['lfoRate']),
      knobGroup('MOD', ['lfoRate', 'lfoShape', 'lfoDest', 'lfoAmt'], ['fA']),
      knobGroup('AMP EG', ['aA', 'aD', 'aS', 'aR'], ['osc1']),
      knobGroup('MIXER', ['osc1', 'osc2'], ['aA']),
      knobGroup('SPACE', ['delay', 'reverb'], ['aA']),
      knobGroup('ARPEGGIATOR', ['rate', 'mode', 'range', 'notes', 'gate', 'octave', 'glide']),
      padGroup(),
    ]
  : [knobGroup('ARPEGGIATOR', ['rate', 'mode', 'range', 'notes', 'gate', 'octave', 'glide']), padGroup()];

/* ---------- face arriere (2026-10-03, Mika : "aussi evoluee que la MM-808") ---------- */

export type VoyPortKind = 'jack' | 'mini' | 'din' | 'usb' | 'dc' | 'power';
export interface VoyPort {
  kind: VoyPortKind;
  /** position vue de derriere (x monde = -u), hauteur du centre */
  u: number;
  y: number;
  label: string;
  group?: string;
}

/**
 * La face arriere du bac, facon Voyager : en haut les entrees de
 * modulation (CV IN : PITCH, CUTOFF, RES, VOLUME, WAVE ; GATE IN et OUT ;
 * PEDALS : EXP et SUS ; EXT IN), en bas l'audio et le reste (PHONES, MAIN
 * OUT L et R, SYNC IN et OUT, MIDI IN, OUT et THRU, USB, DC 12V, POWER).
 * Les memes prises que la MM-808 (BACK : jacks 6.35, mini-jacks, DIN,
 * USB-C, alimentation, interrupteur) ; le nom de chaque prise au-dessus
 * d'elle, chaque groupe coiffe d'un crochet et de son titre ; le logo, le
 * modele, le firmware et l'etiquette du numero de serie ; des vis aux
 * coins et des fentes d'aeration.
 */
export const VOY_BACK = PORTRAIT
  ? {
      rows: { a: 1.95, b: 0.95 },
      label: { dy: 0.35, bracket: 0.5, group: 0.63, cap: 0.06, groupCap: 0.052 },
      ports: [
        { kind: 'mini', u: -3.3, y: 1.95, label: 'PITCH', group: 'CV IN' },
        { kind: 'mini', u: -2.8, y: 1.95, label: 'CUTOFF', group: 'CV IN' },
        { kind: 'mini', u: -2.3, y: 1.95, label: 'RES', group: 'CV IN' },
        { kind: 'mini', u: -1.8, y: 1.95, label: 'VOL', group: 'CV IN' },
        { kind: 'mini', u: -1.3, y: 1.95, label: 'WAVE', group: 'CV IN' },
        { kind: 'mini', u: -0.55, y: 1.95, label: 'IN', group: 'GATE' },
        { kind: 'mini', u: -0.05, y: 1.95, label: 'OUT', group: 'GATE' },
        { kind: 'jack', u: 0.75, y: 1.95, label: 'EXP', group: 'PEDALS' },
        { kind: 'jack', u: 1.45, y: 1.95, label: 'SUS', group: 'PEDALS' },
        { kind: 'jack', u: 2.3, y: 1.95, label: 'EXT IN' },
        { kind: 'jack', u: -3.3, y: 0.95, label: 'PHONES' },
        { kind: 'jack', u: -2.65, y: 0.95, label: 'L', group: 'MAIN OUT' },
        { kind: 'jack', u: -2.05, y: 0.95, label: 'R', group: 'MAIN OUT' },
        { kind: 'mini', u: -1.4, y: 0.95, label: 'IN', group: 'SYNC' },
        { kind: 'mini', u: -0.95, y: 0.95, label: 'OUT', group: 'SYNC' },
        { kind: 'din', u: -0.2, y: 0.95, label: 'IN', group: 'MIDI' },
        { kind: 'din', u: 0.45, y: 0.95, label: 'OUT', group: 'MIDI' },
        { kind: 'din', u: 1.1, y: 0.95, label: 'THRU', group: 'MIDI' },
        { kind: 'usb', u: 1.85, y: 0.95, label: 'USB' },
        { kind: 'dc', u: 2.55, y: 0.95, label: 'DC 12V' },
        { kind: 'power', u: 3.25, y: 0.95, label: 'POWER' },
      ] as readonly VoyPort[],
      vents: { u0: 2.85, u1: 3.6, y0: 1.75, y1: 2.6, n: 5 },
      screws: [[-3.62, 2.72], [3.62, 2.72]] as readonly (readonly [number, number])[],
      logo: { u: -3.6, y: 0.45, w: 1.4 },
      model: { u: -2.05, y: 0.5, cap: 0.06 },
      firmware: { u: -2.05, y: 0.33, cap: 0.045 },
      sticker: { u0: 2.2, u1: 3.6, y0: 0.2, y1: 0.5 },
    }
  : {
      rows: { a: 2.3, b: 1.0 },
      label: { dy: 0.43, bracket: 0.6, group: 0.75, cap: 0.075, groupCap: 0.065 },
      ports: [
        { kind: 'mini', u: -2.4, y: 2.3, label: 'PITCH', group: 'CV IN' },
        { kind: 'mini', u: -1.8, y: 2.3, label: 'CUTOFF', group: 'CV IN' },
        { kind: 'mini', u: -1.2, y: 2.3, label: 'RES', group: 'CV IN' },
        { kind: 'mini', u: -0.6, y: 2.3, label: 'VOLUME', group: 'CV IN' },
        { kind: 'mini', u: 0.0, y: 2.3, label: 'WAVE', group: 'CV IN' },
        { kind: 'mini', u: 0.9, y: 2.3, label: 'IN', group: 'GATE' },
        { kind: 'mini', u: 1.5, y: 2.3, label: 'OUT', group: 'GATE' },
        { kind: 'jack', u: 2.45, y: 2.3, label: 'EXP', group: 'PEDALS' },
        { kind: 'jack', u: 3.25, y: 2.3, label: 'SUS', group: 'PEDALS' },
        { kind: 'jack', u: 4.2, y: 2.3, label: 'EXT IN' },
        { kind: 'jack', u: -2.4, y: 1.0, label: 'PHONES' },
        { kind: 'jack', u: -1.55, y: 1.0, label: 'L', group: 'MAIN OUT' },
        { kind: 'jack', u: -0.8, y: 1.0, label: 'R', group: 'MAIN OUT' },
        { kind: 'mini', u: 0.05, y: 1.0, label: 'IN', group: 'SYNC' },
        { kind: 'mini', u: 0.6, y: 1.0, label: 'OUT', group: 'SYNC' },
        { kind: 'din', u: 1.5, y: 1.0, label: 'IN', group: 'MIDI' },
        { kind: 'din', u: 2.2, y: 1.0, label: 'OUT', group: 'MIDI' },
        { kind: 'din', u: 2.9, y: 1.0, label: 'THRU', group: 'MIDI' },
        { kind: 'usb', u: 3.75, y: 1.0, label: 'USB' },
        { kind: 'dc', u: 4.55, y: 1.0, label: 'DC 12V' },
        { kind: 'power', u: 5.4, y: 1.0, label: 'POWER' },
      ] as readonly VoyPort[],
      vents: { u0: 4.95, u1: 6.0, y0: 1.95, y1: 2.95, n: 6 },
      screws: [[-6.05, 0.35], [6.05, 0.35], [-6.05, 3.0], [6.05, 3.0]] as readonly (readonly [number, number])[],
      logo: { u: -5.75, y: 2.65, w: 2.8 },
      model: { u: -5.75, y: 2.2, cap: 0.08 },
      firmware: { u: -5.75, y: 1.98, cap: 0.058 },
      sticker: { u0: -5.75, u1: -4.25, y0: 0.42, y1: 0.78 },
    };

/* ---------- vue eclatee, carte ---------- */

/**
 * OPEN : le capot (plateau et panneau) monte, recule et se cabre, comme
 * celui de la 808 ; la carte sort du bac. Memes durees que la 808. Desktop
 * (2026-10-03) : plus haut et plus loin que la 808, la rangee des pages au
 * milieu de la carte se voit en entier.
 */
export const VOY_EXPLODE = PORTRAIT
  ? { lift: 6.3, slideZ: -3.4, tiltOpenDeg: -55, pcbRise: 1.0 }
  : { lift: 5.0, slideZ: -3.8, tiltOpenDeg: -24, pcbRise: 1.0 };

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
  : { plate: Math.SQRT1_2 * (VOY_BODY.w + VOY_BODY.d), h: 9.4, targetY: 1.6, radius: { closed: 8.1, open: 9.6 }, fitHalfH: 8.6, explodeTargetY: 5.9 };


/**
 * Le nom de la machine (2026-10-03, Mika : "le titre c'est MM-808 et
 * l'autre c'est MM-ARP") : serigraphie, ecran, carte, navigation. Le code
 * garde ses noms internes (voy, voyager, VOYAGER, ?voyager=0).
 */
export const VOY_COPY = { model: 'MM-ARP', group: 'MM-ARP arpeggiator synthesizer', lcdIdle: 'MM-ARP' } as const;
