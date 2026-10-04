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
  /** portrait : le plateau garde 1.3 (au doigt), le panneau 1.15 (quatre rangees depuis le 2026-10-03) */
  scale: PORTRAIT ? 1.3 : 1,
  panelScale: PORTRAIT ? 1.15 : 1,
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
  /** encre : jaune Typhon sur la machine noire, ambre fonce sur la claire ; les crans non choisis a dim (noire, claire) */
  dim: { dark: 0.42, light: 0.58 },
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
 * Desktop : le panneau garde le son, en colonnes facon Moog. OSCILLATORS
 * (2026-10-03, deux oscillateurs facon Typhon) sur trois colonnes : WAVE 1,
 * WAVE 2 (les selecteurs dessines) et TUNE 2 en haut, FINE, MIX et GLIDE
 * dessous ; puis FILTER, FILTER EG / AMP EG, EFFECTS, OUTPUT.
 * L'arpegiateur (RATE MODE RANGE NOTES GATE OCTAVE) est sur le plateau, a
 * gauche de l'ecran, comme au telephone.
 */
const DESK_COLS = [-5.35, -4.0, -2.95, -1.95, -0.9, 0.15, 0.95, 1.75, 2.55, 3.6, 4.4, 5.55];
const DESK_ROWS = [-0.72, 0.85];
/** titres des sections, et le haut des filets */
const DESK_TITLE_Z = -1.6;

/** Cellule (colonne, rangee) de chaque potard du panneau ; 'mid' : entre les deux rangees (gros potards). */
const DESK_CELLS: Partial<Record<VoyKnobId, [number, number | 'mid']>> = {
  wave1: [0, 0],
  wave2: [1, 0],
  tune2: [2, 0],
  fine: [0, 1],
  mix: [1, 1],
  glide: [2, 1],
  cutoff: [3, 'mid'],
  res: [4, 0],
  envAmt: [4, 1],
  fA: [5, 0],
  fD: [6, 0],
  fS: [7, 0],
  fR: [8, 0],
  aA: [5, 1],
  aD: [6, 1],
  aS: [7, 1],
  aR: [8, 1],
  dist: [9, 0],
  chorus: [10, 0],
  delay: [9, 1],
  reverb: [10, 1],
  volume: [11, 'mid'],
};
/** Plateau, desktop : l'arpegiateur en rangee a gauche de l'ecran. */
const DESK_ARP_Z = 0.85;
const DESK_DECK: Partial<Record<VoyKnobId, [number, number]>> = {
  rate: [-5.55, DESK_ARP_Z],
  mode: [-4.77, DESK_ARP_Z],
  range: [-3.99, DESK_ARP_Z],
  notes: [-3.21, DESK_ARP_Z],
  gate: [-2.43, DESK_ARP_Z],
  octave: [-1.65, DESK_ARP_Z],
};

/**
 * Portrait : le panneau ne garde que le son, quatre rangees (2026-10-03,
 * deux oscillateurs), chaque groupe souligne d'un crochet a son nom :
 *   OSCILLATORS (WAVE 1, WAVE 2, TUNE 2, MIX)
 *   FILTER (CUTOFF RES ENV AMT)          COLOR (DIST CHORUS)
 *   FILTER EG (A D S R)                  SPACE (DELAY REVERB)
 *   AMP EG (A D S R)                     PITCH (FINE GLIDE)
 * Le plateau prend l'ecran et VOLUME, le transport, l'arpegiateur (RATE
 * MODE RANGE NOTES GATE OCTAVE) et les pads.
 */
const PORT_PANEL_ROWS = [-1.85, -0.2, 1.1, 2.4];
const PORT_PITCH = 1.15;
const PORT_GAP = 0.5;
/** x de la colonne k (0 a 5) d'une rangee dont le second groupe commence a split. */
const portX = (k: number, split: number): number => -2.5 * PORT_PITCH - PORT_GAP / 2 + k * PORT_PITCH + (k >= split ? PORT_GAP : 0);
/** Rangee des oscillateurs : les deux selecteurs (leur couronne de formes), puis TUNE 2 et MIX. */
const PORT_OSC_X: Partial<Record<VoyKnobId, number>> = { wave1: -2.55, wave2: -0.6, tune2: 1.15, mix: 2.65 };
const PORT_PANEL: Partial<Record<VoyKnobId, [number, number, number]>> = {
  cutoff: [0, 1, 3],
  res: [1, 1, 3],
  envAmt: [2, 1, 3],
  dist: [4, 1, 3],
  chorus: [5, 1, 3],
  fA: [0, 2, 4],
  fD: [1, 2, 4],
  fS: [2, 2, 4],
  fR: [3, 2, 4],
  delay: [4, 2, 4],
  reverb: [5, 2, 4],
  aA: [0, 3, 4],
  aD: [1, 3, 4],
  aS: [2, 3, 4],
  aR: [3, 3, 4],
  fine: [4, 3, 4],
  glide: [5, 3, 4],
};
/** Plateau, portrait : l'arpegiateur en rangee, VOLUME a droite de l'ecran. */
const PORT_ARP_Z = 3.0;
const PORT_DECK: Partial<Record<VoyKnobId, [number, number]>> = {
  rate: [-2.9, PORT_ARP_Z],
  mode: [-1.74, PORT_ARP_Z],
  range: [-0.58, PORT_ARP_Z],
  notes: [0.58, PORT_ARP_Z],
  gate: [1.74, PORT_ARP_Z],
  octave: [2.9, PORT_ARP_Z],
  volume: [2.45, 0.3],
};

/** x d'une colonne (fractionnaire : entre deux colonnes). */
const colX = (cols: readonly number[], c: number): number => {
  const i = Math.floor(c);
  const f = c - i;
  return f === 0 ? cols[i] : cols[i] + (cols[i + 1] - cols[i]) * f;
};

const BIG = new Set<VoyKnobId>(['cutoff', 'volume']);
/** Libelle sous la jupe : 0.13 sous son bord ; sous la couronne d'un selecteur. */
const labelBelow = (id: VoyKnobId, s: number): number => (isSelector(id) ? VOY_SEL.labelR * s : VOY_KNOB.skirt.r * s + 0.13);

export function voyKnobPlace(id: VoyKnobId): VoyKnobPlace {
  const big = BIG.has(id);
  const k = big ? VOY_KNOB.big : 1;
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
    const [c, r, split] = PORT_PANEL[id] ?? [0, 1, 3];
    const z = PORT_PANEL_ROWS[r];
    return { id, where: 'panel', x: portX(c, split), z, s, labelZ: z + labelBelow(id, s) };
  }
  const s = VOY_KNOB.scale * k;
  const d = DESK_DECK[id];
  if (d) return { id, where: 'deck', x: d[0], z: d[1], s, labelZ: d[1] + labelBelow(id, s) };
  const [c, r] = DESK_CELLS[id] ?? [0, 0];
  const z = r === 'mid' ? (DESK_ROWS[0] + DESK_ROWS[1]) / 2 : DESK_ROWS[r];
  return { id, where: 'panel', x: colX(DESK_COLS, c), z, s, labelZ: z + labelBelow(id, s) };
}

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
      { text: 'AMP EG', x: (DESK_COLS[5] + DESK_COLS[8]) / 2, z: 0.13 },
      { text: 'EFFECTS', x: (DESK_COLS[9] + DESK_COLS[10]) / 2, z: DESK_TITLE_Z },
      { text: 'OUTPUT', x: DESK_COLS[11], z: DESK_TITLE_Z },
    ];

/** Filets verticaux entre les sections (desktop). */
const rule = (a: number, b: number): readonly number[] => [(DESK_COLS[a] + DESK_COLS[b]) / 2, DESK_TITLE_Z - 0.15, (DESK_COLS[a] + DESK_COLS[b]) / 2, 1.6];
export const VOY_RULES: readonly (readonly number[])[] = PORTRAIT ? [] : [rule(2, 3), rule(4, 5), rule(8, 9), rule(10, 11)];

/**
 * En-tete du panneau, comme celui de la 808 : le wordmark a gauche,
 * MM-VOYAGER juste apres, le logotype (mark) a droite ; desktop : le
 * sous-titre avant le logotype.
 */
export const VOY_HEAD = PORTRAIT
  ? { z: -2.95, word: { x: -3.6, w: 2.3 }, model: { x: -1.08, cap: 0.12 }, mark: { x: 3.6, h: 0.4 }, sub: null }
  : { z: -1.98, word: { x: -5.9, w: 3.0 }, model: { x: -2.6, cap: 0.14 }, mark: { x: 5.9, h: 0.44 }, sub: { x: 5.2, text: 'ARPEGGIATOR SYNTHESIZER' } };

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
      { id: 'run', label: 'RUN/STOP', x: 2.2, z: 0.85, w: 0.8, d: 0.55 },
      { id: 'clear', label: 'CLEAR', x: 3.1, z: 0.85, w: 0.8, d: 0.55 },
      { id: 'random', label: 'RANDOM', x: 4.0, z: 0.85, w: 0.8, d: 0.55 },
      { id: 'open', label: 'OPEN', x: 5.3, z: 0.85, w: 0.9, d: 0.55 },
    ];
export const VOY_BUTTON = { h: 0.12, radius: 0.05, labelGap: 0.2, press: 0.04 } as const;

/** L'ecran du plateau (verre, cadre fusionne au capot), et sa texture. */
export const VOY_LCD = PORTRAIT
  ? { x: -1.6, z: 0.3, w: 3.9, d: 1.0, bezel: { w: 4.14, d: 1.24, h: 0.02 }, tex: [780, 200] as const }
  : { x: 0.2, z: 0.9, w: 2.4, d: 0.9, bezel: { w: 2.62, d: 1.12, h: 0.02 }, tex: [640, 240] as const };

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
      knobGroup('OSCILLATORS', ['wave1', 'wave2', 'tune2', 'mix']),
      knobGroup('FILTER', ['cutoff', 'res', 'envAmt'], ['dist']),
      knobGroup('COLOR', ['dist', 'chorus'], ['cutoff']),
      knobGroup('FILTER EG', ['fA', 'fD', 'fS', 'fR']),
      knobGroup('SPACE', ['delay', 'reverb']),
      knobGroup('AMP EG', ['aA', 'aD', 'aS', 'aR']),
      knobGroup('PITCH', ['fine', 'glide']),
      knobGroup('ARPEGGIATOR', ['rate', 'mode', 'range', 'notes', 'gate', 'octave']),
      padGroup(),
    ]
  : [knobGroup('ARPEGGIATOR', ['rate', 'mode', 'range', 'notes', 'gate', 'octave']), padGroup()];

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
