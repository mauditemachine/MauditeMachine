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

import { PORTRAIT, TEMPO_UI } from '../theme';
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
  /** les tailles (xl, l, m, s, sw) : SIZE_SCALE, plus bas ; portrait : le plateau garde 1.3 (au doigt), le panneau 1.0 (huit potards par rangee depuis le 2026-10-04 ; 1.15 avant) */
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
 * La hierarchie des potards (2026-10-04, Mika, une photo du Typhon a
 * l'appui : "un effort de design de placement de knobs, avec des plus gros
 * et des moins gros") : cinq tailles. xl : CUTOFF, le heros ; l : les deux
 * selecteurs de forme et VOLUME ; m : ce qui sculpte le son (niveaux
 * d'oscillateurs, FM, RES, ENV AMT, DEPTH, RATE et GATE de l'arpege) ; s :
 * les reglages fins (enveloppes, effets, MOD, accords d'OSC 2, bruit) ;
 * sw : le commutateur MODE. Les gros portent leurs graduations (les arcs
 * imprimes des autres sont partis le 2026-10-04, Mika ne les aimait pas).
 * sel (2026-10-04) : les selecteurs de forme dans les rangees
 * d'oscillateurs facon Mini V, plus petits que l pour tenir a deux rangees.
 */
export type KnobSize = 'xl' | 'l' | 'm' | 's' | 'sw' | 'sel';
const SIZE_SCALE: Readonly<Record<KnobSize, number>> = PORTRAIT
  ? { xl: 1.6, l: 1.15, m: 0.95, s: 0.8, sw: 0.62, sel: 0.8 }
  : { xl: 1.5, l: 1.18, m: 1, s: 0.8, sw: 0.62, sel: 0.85 };

/** Une place : x, z, taille ; plateau (deck) ou panneau. */
type Spot = readonly [number, number, KnobSize];

/**
 * Desktop : le panneau en sections facon Moog, separees de filets ; dans
 * chaque section une composition, plus une grille :
 *   OSCILLATORS (2026-10-04, facon Mini V, Mika : "tu pourrais avoir les
 *     oscillateurs de cette maniere") : une rangee par oscillateur, son
 *     numero a gauche, WAVEFORM, RANGE, SEMI, FINE, ON et sa LED ; dessous
 *     le melangeur et la FM : OSC 1, OSC 2, NOISE, FM, RATIO ;
 *   FILTER : CUTOFF en tres grand, RES et ENV AMT dessous, MODE en bas ;
 *   FILTER EG, AMP EG, MOD (DEPTH plus gros) : trois rangees de petits ;
 *   EFFECTS : quatre petits ; OUTPUT : VOLUME en grand.
 * L'arpegiateur est sur le plateau, a gauche de l'ecran (RATE et GATE plus
 * gros).
 */
const DESK_ROWS = [-0.72, 0.66, 1.72];
/** titres des sections, et le haut des filets */
const DESK_TITLE_Z = -1.6;
const [RA, RB, RC] = DESK_ROWS;
/** les colonnes des rangees d'oscillateurs, du melangeur, des enveloppes et des effets ; les filets entre les sections */
const DESK_OSC = { badge: -6.1, wave: -5.38, range: -4.28, semi: -3.17, fine: -2.17, on: -1.42 } as const;
const DESK_EG = [1.12, 1.84, 2.56, 3.28] as const;
const DESK_FX = [4.02, 4.72] as const;
const DESK_FILTER_X = -0.15;
const DESK_OUT_X = 5.66;
const DESK_RULES_X = [-1.05, 0.75, 3.65, 5.07] as const;
const DESK_PANEL: Partial<Record<VoyKnobId, Spot>> = {
  wave1: [DESK_OSC.wave, RA, 'sel'],
  range1: [DESK_OSC.range, RA, 's'],
  semi1: [DESK_OSC.semi, RA, 'm'],
  fine1: [DESK_OSC.fine, RA, 's'],
  on1: [DESK_OSC.on, RA, 'sw'],
  wave2: [DESK_OSC.wave, RB, 'sel'],
  range2: [DESK_OSC.range, RB, 's'],
  semi2: [DESK_OSC.semi, RB, 'm'],
  fine2: [DESK_OSC.fine, RB, 's'],
  on2: [DESK_OSC.on, RB, 'sw'],
  osc1: [-5.55, RC, 's'],
  osc2: [-4.75, RC, 's'],
  noise: [-3.95, RC, 's'],
  fm: [-2.95, RC, 'm'],
  ratio: [-2.05, RC, 's'],
  cutoff: [DESK_FILTER_X, -0.5, 'xl'],
  res: [DESK_FILTER_X - 0.5, RB, 'm'],
  envAmt: [DESK_FILTER_X + 0.5, RB, 'm'],
  fmode: [DESK_FILTER_X, RC, 'sw'],
  fA: [DESK_EG[0], RA, 's'],
  fD: [DESK_EG[1], RA, 's'],
  fS: [DESK_EG[2], RA, 's'],
  fR: [DESK_EG[3], RA, 's'],
  aA: [DESK_EG[0], RB, 's'],
  aD: [DESK_EG[1], RB, 's'],
  aS: [DESK_EG[2], RB, 's'],
  aR: [DESK_EG[3], RB, 's'],
  lfoRate: [DESK_EG[0], RC, 's'],
  lfoShape: [DESK_EG[1], RC, 's'],
  lfoDest: [DESK_EG[2], RC, 's'],
  lfoAmt: [DESK_EG[3], RC, 'm'],
  dist: [DESK_FX[0], RA, 's'],
  chorus: [DESK_FX[1], RA, 's'],
  delay: [DESK_FX[0], RB, 's'],
  reverb: [DESK_FX[1], RB, 's'],
  volume: [DESK_OUT_X, (RA + RB) / 2, 'l'],
};
/** Plateau, desktop : l'arpegiateur en rangee a gauche de l'ecran (GLIDE au bout, 2026-10-03). */
const DESK_ARP_Z = 0.85;
const DESK_DECK: Partial<Record<VoyKnobId, Spot>> = {
  rate: [-5.55, DESK_ARP_Z, 'm'],
  mode: [-4.8, DESK_ARP_Z, 's'],
  range: [-4.05, DESK_ARP_Z, 's'],
  notes: [-3.3, DESK_ARP_Z, 's'],
  gate: [-2.55, DESK_ARP_Z, 'm'],
  octave: [-1.8, DESK_ARP_Z, 's'],
  glide: [-1.05, DESK_ARP_Z, 's'],
};

/**
 * Portrait : trois zones :
 *   OSCILLATORS (2026-10-04, facon Mini V) : une rangee par oscillateur,
 *     son numero a gauche, WAVEFORM, RANGE, SEMI, FINE, ON et sa LED, puis
 *     FM (rangee 1) et RATIO (rangee 2) ; pas de crochet, les numeros
 *     disent les rangees ;
 *   FILTER : CUTOFF en tres grand, RES, ENV AMT, MODE ; MIXER : OSC 1,
 *     OSC 2, NOISE ;
 *   FILTER EG et MOD, puis AMP EG et EFFECTS : des rangees de petits.
 * Le plateau prend l'ecran et VOLUME, le transport, l'arpegiateur (RATE
 * MODE RANGE NOTES GATE OCTAVE GLIDE) et les pads.
 */
const PORT_O1 = -2.25;
const PORT_O2 = -1.0;
const PORT_F = 0.2;
const PORT_E1 = 1.58;
const PORT_E2 = 2.56;
const PORT_OSC = { badge: -3.62, wave: -2.95, range: -1.8, semi: -0.6, fine: 0.5, on: 1.5, fm: 2.8 } as const;
const PORT_PANEL: Partial<Record<VoyKnobId, Spot>> = {
  wave1: [PORT_OSC.wave, PORT_O1, 'sel'],
  range1: [PORT_OSC.range, PORT_O1, 's'],
  semi1: [PORT_OSC.semi, PORT_O1, 'm'],
  fine1: [PORT_OSC.fine, PORT_O1, 's'],
  on1: [PORT_OSC.on, PORT_O1, 'sw'],
  fm: [PORT_OSC.fm, PORT_O1, 'm'],
  wave2: [PORT_OSC.wave, PORT_O2, 'sel'],
  range2: [PORT_OSC.range, PORT_O2, 's'],
  semi2: [PORT_OSC.semi, PORT_O2, 'm'],
  fine2: [PORT_OSC.fine, PORT_O2, 's'],
  on2: [PORT_OSC.on, PORT_O2, 'sw'],
  ratio: [PORT_OSC.fm, PORT_O2, 's'],
  cutoff: [-2.6, PORT_F + 0.15, 'xl'],
  res: [-1.35, PORT_F, 'm'],
  envAmt: [-0.45, PORT_F, 'm'],
  fmode: [0.55, PORT_F, 'sw'],
  osc1: [1.45, PORT_F, 'm'],
  osc2: [2.35, PORT_F, 'm'],
  noise: [3.2, PORT_F, 's'],
  fA: [-3.15, PORT_E1, 's'],
  fD: [-2.35, PORT_E1, 's'],
  fS: [-1.55, PORT_E1, 's'],
  fR: [-0.75, PORT_E1, 's'],
  lfoRate: [0.4, PORT_E1, 's'],
  lfoShape: [1.15, PORT_E1, 's'],
  lfoDest: [1.9, PORT_E1, 's'],
  lfoAmt: [2.8, PORT_E1, 'm'],
  aA: [-3.15, PORT_E2, 's'],
  aD: [-2.35, PORT_E2, 's'],
  aS: [-1.55, PORT_E2, 's'],
  aR: [-0.75, PORT_E2, 's'],
  dist: [0.4, PORT_E2, 's'],
  chorus: [1.15, PORT_E2, 's'],
  delay: [1.9, PORT_E2, 's'],
  reverb: [2.8, PORT_E2, 's'],
};
/** Plateau, portrait : l'arpegiateur en rangee (GLIDE au bout), VOLUME a droite de l'ecran. */
const PORT_ARP_Z = 3.0;
const PORT_DECK: Partial<Record<VoyKnobId, Spot>> = {
  rate: [-2.9, PORT_ARP_Z, 'm'],
  mode: [-1.933, PORT_ARP_Z, 's'],
  range: [-0.967, PORT_ARP_Z, 's'],
  notes: [0, PORT_ARP_Z, 's'],
  gate: [0.967, PORT_ARP_Z, 'm'],
  octave: [1.933, PORT_ARP_Z, 's'],
  glide: [2.9, PORT_ARP_Z, 's'],
  volume: [2.45, 0.3, 'l'],
};

/** La taille d'un potard (m par defaut). */
export function knobSize(id: VoyKnobId): KnobSize {
  const d = PORTRAIT ? PORT_DECK[id] ?? PORT_PANEL[id] : DESK_DECK[id] ?? DESK_PANEL[id];
  return d ? d[2] : 'm';
}
/** Les gros potards (xl et l, hors selecteurs) portent des graduations 0 a 10. */
export const isBigKnob = (id: VoyKnobId): boolean => !isSelector(id) && (knobSize(id) === 'xl' || knobSize(id) === 'l');
/** Commutateurs : un petit potard a quelques positions (MODE du filtre : quatre). */
export const isSwitch = (id: VoyKnobId): boolean => knobSize(id) === 'sw';
export const VOY_SWITCH = { tick: { r0: 0.03, len: 0.05 }, markR: 0.18, cap: 0.052 } as const;
/** Course d'un commutateur de n positions (deg) : un quart de tour a deux, 150 au-dela. */
export const switchThrowDeg = (n: number): number => (n <= 2 ? 90 : 150);

/**
 * Les echelles des rangees d'oscillateurs (2026-10-04, facon Mini V) :
 * RANGE, un selecteur a six crans (LO a 2') sur 180 deg, chaque cran ecrit ;
 * SEMI, quinze crans sur la course entiere, les impairs ecrits ; FINE,
 * -50 0 +50 (le capuchon noir des autres potards). ON : un commutateur,
 * son nom dessous, sa LED rouge au-dessus.
 */
export type VoyScale = 'range' | 'semi' | 'fine';
export function voyScale(id: VoyKnobId): VoyScale | null {
  if (id === 'range1' || id === 'range2') return 'range';
  if (id === 'semi1' || id === 'semi2') return 'semi';
  if (id === 'fine1' || id === 'fine2') return 'fine';
  return null;
}
export const isOscOn = (id: VoyKnobId): boolean => id === 'on1' || id === 'on2';
export const RANGE_THROW_DEG = 180;
/** Course d'un potard de n crans (deg) : commutateur, RANGE, ou la course entiere. */
export const knobThrowDeg = (id: VoyKnobId, n: number): number => (isSwitch(id) ? switchThrowDeg(n) : voyScale(id) === 'range' ? RANGE_THROW_DEG : TEMPO_UI.sweepDeg);
/** Angle (deg, 90 : en haut, sens trigonometrique) du cran i sur n, pour une course de throw deg. */
export const stepDeg = (i: number, n: number, throwDeg: number): number => 90 + throwDeg / 2 - (throwDeg * i) / Math.max(1, n - 1);
/** Le numero de chaque rangee d'oscillateur : un onglet a l'encre, le chiffre en creux (Mini V). */
export const VOY_BADGE = { w: 0.22, h: 0.3, r: 0.045, cap: 0.15 } as const;
export const VOY_OSC_BADGES: readonly { text: string; x: number; z: number }[] = PORTRAIT
  ? [
      { text: '1', x: PORT_OSC.badge, z: PORT_O1 },
      { text: '2', x: PORT_OSC.badge, z: PORT_O2 },
    ]
  : [
      { text: '1', x: DESK_OSC.badge, z: RA },
      { text: '2', x: DESK_OSC.badge, z: RB },
    ];
/** La LED de ON : rouge allumee, au-dessus du commutateur (dz sous le haut de sa jupe). */
export const VOY_LED = { r: 0.055, dz: 0.15, on: '#ff3b2f', off: 'rgba(110, 24, 18, 0.55)' } as const;
/** Libelle sous la jupe : 0.13 sous son bord ; sous la couronne d'un selecteur ; plus bas sous des graduations. */
const labelBelow = (id: VoyKnobId, s: number): number => {
  if (isSelector(id)) return VOY_SEL.labelR * s;
  // FINE : son nom passe entre -50 et +50, un peu plus bas
  if (voyScale(id) === 'fine') return VOY_KNOB.skirt.r * s + 0.15;
  const big = !isSelector(id) && (knobSize(id) === 'xl' || knobSize(id) === 'l');
  return VOY_KNOB.skirt.r * s + (big ? 0.15 : 0.13);
};

export function voyKnobPlace(id: VoyKnobId): VoyKnobPlace {
  const deck = PORTRAIT ? PORT_DECK[id] : DESK_DECK[id];
  const panel = PORTRAIT ? PORT_PANEL[id] : DESK_PANEL[id];
  const spot = deck ?? panel ?? ([0, 0, 'm'] as Spot);
  const where: VoyWhere = deck ? 'deck' : 'panel';
  const base = where === 'deck' ? VOY_KNOB.scale : VOY_KNOB.panelScale;
  const s = base * SIZE_SCALE[spot[2]];
  // Un commutateur pose plus bas : son libelle s'aligne sur ceux de la rangee (taille m)
  const z = spot[1] + (spot[2] === 'sw' ? VOY_KNOB.skirt.r * base * (SIZE_SCALE.m - SIZE_SCALE.sw) : 0);
  return { id, where, x: spot[0], z, s, labelZ: z + labelBelow(id, s) };
}

/** Titres entre deux rangees (AMP EG, MOD) : au milieu du jour entre les libelles du dessus et les petits potards du dessous. */
const betweenRows = (r: number): number => {
  const sr = VOY_KNOB.skirt.r * SIZE_SCALE.s;
  return (DESK_ROWS[r] + sr + 0.13 + DESK_ROWS[r + 1] - sr) / 2;
};

/**
 * Titres des sections facon Moog (desktop : au-dessus des colonnes, avec
 * des filets verticaux entre elles). En portrait les groupes portent des
 * crochets (VOY_GROUPS) a la place.
 */
export const VOY_SECTIONS: readonly { text: string; x: number; z: number }[] = PORTRAIT
  ? []
  : [
      { text: 'OSCILLATORS', x: (-6.25 + DESK_RULES_X[0]) / 2, z: DESK_TITLE_Z },
      { text: 'FILTER', x: DESK_FILTER_X, z: DESK_TITLE_Z },
      { text: 'FILTER EG', x: (DESK_EG[0] + DESK_EG[3]) / 2, z: DESK_TITLE_Z },
      { text: 'AMP EG', x: (DESK_EG[0] + DESK_EG[3]) / 2, z: betweenRows(0) },
      { text: 'MOD', x: (DESK_EG[0] + DESK_EG[3]) / 2, z: betweenRows(1) },
      { text: 'EFFECTS', x: (DESK_FX[0] + DESK_FX[1]) / 2, z: DESK_TITLE_Z },
      { text: 'OUTPUT', x: DESK_OUT_X, z: DESK_TITLE_Z },
    ];

/** Filets verticaux entre les sections (desktop), jusqu'au bas de la troisieme rangee. */
const RULE_END = RC + 0.5;
export const VOY_RULES: readonly (readonly number[])[] = PORTRAIT ? [] : DESK_RULES_X.map((x) => [x, DESK_TITLE_Z - 0.15, x, RULE_END]);

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

export type VoyButtonId = 'run' | 'clear' | 'random' | 'edit' | 'open';

/**
 * Boutons du plateau (2026-10-03 : les pages sont passees sur la carte,
 * PAGE_CHIPS) : RUN/STOP, CLEAR, RANDOM, EDIT (2026-10-04 : ouvre la suite
 * de l'arpege, state/editor.ts) et OPEN, a droite de l'ecran (desktop :
 * l'arpegiateur a sa gauche) ou en rangee sous lui (portrait).
 */
export const VOY_BUTTONS: readonly { id: VoyButtonId; label: string; x: number; z: number; w: number; d: number }[] = PORTRAIT
  ? [
      { id: 'run', label: 'RUN/STOP', x: -2.6, z: 1.6, w: 1.15, d: 0.6 },
      { id: 'clear', label: 'CLEAR', x: -1.3, z: 1.6, w: 1.15, d: 0.6 },
      { id: 'random', label: 'RANDOM', x: 0, z: 1.6, w: 1.15, d: 0.6 },
      { id: 'edit', label: 'EDIT', x: 1.3, z: 1.6, w: 1.15, d: 0.6 },
      { id: 'open', label: 'OPEN', x: 2.6, z: 1.6, w: 1.15, d: 0.6 },
    ]
  : [
      { id: 'run', label: 'RUN/STOP', x: 2.5, z: 0.85, w: 0.7, d: 0.55 },
      { id: 'clear', label: 'CLEAR', x: 3.25, z: 0.85, w: 0.7, d: 0.55 },
      { id: 'random', label: 'RANDOM', x: 4.0, z: 0.85, w: 0.7, d: 0.55 },
      { id: 'edit', label: 'EDIT', x: 4.75, z: 0.85, w: 0.7, d: 0.55 },
      { id: 'open', label: 'OPEN', x: 5.65, z: 0.85, w: 0.9, d: 0.55 },
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
  const S = VOY_GROUP_TYPE.side;
  // Les bords du groupe : le plus a gauche et le plus a droite (une composition, plus une rangee ; couronne des selecteurs comprise)
  const half = (p: VoyKnobPlace): number => (isSelector(p.id) ? (VOY_SEL.glyphR + VOY_SEL.glyph.w / 2) * p.s : VOY_KNOB.skirt.r * p.s);
  return {
    text,
    where: ps[0].where,
    x0: Math.min(...ps.map((p) => p.x - half(p))) - S,
    x1: Math.max(...ps.map((p) => p.x + half(p))) + S,
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
      knobGroup('FILTER', ['cutoff', 'res', 'envAmt', 'fmode'], ['osc1']),
      knobGroup('MIXER', ['osc1', 'osc2', 'noise'], ['cutoff']),
      knobGroup('FILTER EG', ['fA', 'fD', 'fS', 'fR'], ['lfoAmt']),
      knobGroup('MOD', ['lfoRate', 'lfoShape', 'lfoDest', 'lfoAmt'], ['fA']),
      knobGroup('AMP EG', ['aA', 'aD', 'aS', 'aR'], ['dist']),
      knobGroup('EFFECTS', ['dist', 'chorus', 'delay', 'reverb'], ['aA']),
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

/* ---------- TWEAKS : la plaque sous le capot (2026-10-04) ---------- */

/**
 * TWEAKS (2026-10-04, Mika, une photo du panneau d'oscillateurs du Mini V
 * a l'appui : "dans OPEN, d'autres boutons a l'interieur pour changer
 * certaines choses ; enleve les liens du site et mets des tweaks a la
 * place ; je veux un super synth") : une plaque a la couleur du capot,
 * vissee sur quatre entretoises au-dessus de la carte, la ou etaient les
 * puces des pages (au-dessus des condensateurs bas, a cote des hauts).
 * Les noms au-dessus des potards, les graduations 0 a 10 autour, les bouts
 * de course ecrits dessous (FREE, OFF...), comme sur le Mini V.
 * cx, cz : son centre dans le repere de la carte (avant PCB_TURN) ; la
 * plaque, elle, se lit droite (en portrait, elle tourne a l'inverse de la
 * carte) : x a droite, z vers soi. y : le dessous de la plaque au-dessus de
 * la carte. Huit cases : sept potards et le titre.
 */
// 2026-10-04 (Mika : "on voit rien ; les boutons un peu plus gros et surtout les titres, sans trop exagerer") :
// potards 1.3 -> 1.5 (1.45 au telephone), noms 0.08 -> 0.11, bouts de course 0.055 -> 0.068, titre 0.2 -> 0.24
export const VOY_TWEAK_PLATE = PORTRAIT
  ? { cx: 0, cz: 1.4, w: 4.0, d: 8.2, y: 0.5, t: 0.08, r: 0.12, screwIn: 0.17, frame: 0.28, knob: 1.45, label: 0.11, end: 0.068, title: 0.24 }
  : { cx: 0, cz: 1.4, w: 8.2, d: 3.9, y: 0.5, t: 0.08, r: 0.12, screwIn: 0.22, frame: 0.36, knob: 1.5, label: 0.11, end: 0.068, title: 0.24 };

export type VoyTweakCell = VoyKnobId | 'title';

/** Les cases de la plaque (repere de la plaque, son centre) : desktop deux rangees de quatre, portrait quatre rangees de deux. */
export const VOY_TWEAK_CELLS: readonly { id: VoyTweakCell; x: number; z: number }[] = (PORTRAIT
  ? ([
      ['phase', -0.95, -2.85],
      ['drift', 0.95, -2.85],
      ['width', -0.95, -0.95],
      ['monoLow', 0.95, -0.95],
      ['keyTrack', -0.95, 0.95],
      ['accent', 0.95, 0.95],
      ['sync', -0.95, 2.85],
      ['title', 0.95, 2.85],
    ] as const)
  : ([
      ['phase', -2.85, -0.72],
      ['drift', -0.95, -0.72],
      ['width', 0.95, -0.72],
      ['monoLow', 2.85, -0.72],
      ['keyTrack', -2.85, 0.86],
      ['accent', -0.95, 0.86],
      ['sync', 0.95, 0.86],
      ['title', 2.85, 0.86],
    ] as const)
).map(([id, x, z]) => ({ id, x, z }));

/**
 * Les bouts de course ecrits sous chaque potard (gauche : 0, droite : 10) ;
 * SYNC, un commutateur, porte OFF et ON a ses reperes.
 */
export const VOY_TWEAK_ENDS: Partial<Record<VoyKnobId, readonly [string, string]>> = {
  phase: ['FREE', '360'],
  drift: ['STABLE', 'LOOSE'],
  width: ['MONO', 'WIDE'],
  monoLow: ['OFF', '300 HZ'],
  keyTrack: ['0', 'FULL'],
  accent: ['FLAT', 'HARD'],
};

/** La place d'un TWEAK sur sa plaque (null : pas un TWEAK) ; SYNC en commutateur. */
export function voyTweakPlace(id: VoyKnobId): { x: number; z: number; s: number; sw: boolean } | null {
  const c = VOY_TWEAK_CELLS.find((k) => k.id === id);
  if (!c) return null;
  const sw = id === 'sync';
  return { x: c.x, z: c.z, s: VOY_TWEAK_PLATE.knob * (sw ? 0.8 : 1), sw };
}


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
