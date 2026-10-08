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
 * Desktop : 13.6 x 8.6 au sol ; portrait (telephone) : 8.6 x 15.6, les
 * memes elements places en hauteur, comme la 808.
 *
 * Le grand ecran (2026-10-08, Mika : "je veux le meme type d'ecran pour ARP
 * aussi, plus gros, plus de detail ! fais de la place et bien sur que ce
 * soit super responsive en mobile et utilisable") : l'ecran de la famille
 * MM-RYTM / MM-BASS (voyager/screen.ts) au milieu du plateau. Desktop :
 * l'arpegiateur en deux rangees a sa gauche (RATE MODE RANGE NOTES, puis
 * GATE OCTAVE GLIDE en quinconce), les touches en deux rangees a sa droite
 * (CLEAR RANDOM EDIT, puis RUN/STOP en large et OPEN), les pads plus minces
 * dessous. Portrait : le plateau s'allonge de 1.2 (le panneau ne bouge
 * pas : le pli recule d'autant), l'ecran prend toute la largeur, VOLUME
 * rejoint la rangee de l'arpegiateur (son crochet OUTPUT).
 */

import { PCB, PORTRAIT, TEMPO_UI } from '../theme';
import { BASS } from '../state/focus';
import { BASS_W, bassX } from '../bass/theme';
import type { VoyKnobId } from './params';
import { tweakClearOf } from '../scene/tweaklayout';

// Portrait (2026-10-08, le grand ecran) : d 14.4, bendZ -0.5, backZ -6.85 avant ; le panneau garde sa longueur (6.35)
export const VOY_BODY = PORTRAIT
  ? { w: 8.6, d: 15.6, cheek: 0.45, feet: 0.12, deckY: 1.32, bendZ: -1.1, backZ: -7.45, topY: 3.05, lidT: 0.12, wall: 0.16, floorY: 0.32 }
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
 * Place du MM-ARP (vue d'ensemble) : a droite de la 808, un jour de 2.6
 * entre elles (1.8 en portrait) ; depuis le 2026-10-07 (Mika : "MM-BASS
 * devrait se situer avant MM-ARP") a droite du MM-BASS, le meme jour, quand
 * celui-ci est sur la table.
 */
export const VOY_X = (BASS ? bassX() + BASS_W / 2 : PORTRAIT ? 8.2 / 2 : 12.6 / 2) + (PORTRAIT ? 1.8 : 2.6) + VOY_BODY.w / 2;

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
  /**
   * les tailles (xl, l, m, s, sw) : SIZE_SCALE, plus bas ; portrait : le
   * plateau garde 1.3 (au doigt), le panneau 1.12 depuis le 2026-10-05 (Mika :
   * "en mobile, les boutons plus gros, c'est trop difficile a attraper et a
   * lire" : AMP EG et EFFECTS sont descendus sur le plateau, le panneau n'a
   * plus que quatre rangees ; 1.0 avant ; 2026-10-07, Mika : "en mobile,
   * MM-ARP, je trouve les boutons petits" : 1.36 et 1.2, et chaque potard se
   * prend au doigt dans un disque de touchR au moins, la demi-colonne)
   */
  scale: PORTRAIT ? 1.36 : 1,
  panelScale: PORTRAIT ? 1.2 : 1,
  /** au telephone, le rayon de prise minimal d'un potard (les rangees de huit sont a 0.88) */
  touchR: PORTRAIT ? 0.42 : 0,
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
// Desktop un peu plus gros le 2026-10-05 (Mika : "MM-ARP, j'aimerais que les knobs soient un peu plus gros en desktop") :
// xl 1.5, l 1.18, m 1, s 0.8, sw 0.62, sel 0.85 avant
// Au telephone, plus gros le 2026-10-07 (Mika : "en mobile, MM-ARP, je trouve les boutons petits") :
// xl 1.6, l 1.15, m 0.95, s 0.8, sel 0.8 avant (le plateau a 1.36, le panneau a 1.2 : les selecteurs et XL a peine plus gros) ; les rangees de huit tiennent encore (pas de 0.88)
const SIZE_SCALE: Readonly<Record<KnobSize, number>> = PORTRAIT
  ? { xl: 1.5, l: 1.1, m: 1.08, s: 0.98, sw: 0.62, sel: 0.76 }
  : { xl: 1.6, l: 1.28, m: 1.1, s: 0.9, sw: 0.68, sel: 0.92 };

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
/**
 * Plateau, desktop : l'arpegiateur a gauche de l'ecran. Une rangee de sept
 * jusqu'au 2026-10-08 (z 0.85, x -5.55 a -1.05) ; depuis le grand ecran,
 * deux rangees facon Elektron : RATE MODE RANGE NOTES, puis GATE OCTAVE
 * GLIDE en quinconce (entre les colonnes du dessus). Les colonnes
 * repondent a celles des touches, a droite de l'ecran (DESK_KEY_X).
 */
const DESK_ARP_Z = [0.84, 1.9] as const;
const DESK_ARP_X = [-5.75, -4.95, -4.15, -3.35] as const;
const between = (a: number, b: number): number => (a + b) / 2;
const DESK_DECK: Partial<Record<VoyKnobId, Spot>> = {
  rate: [DESK_ARP_X[0], DESK_ARP_Z[0], 'm'],
  mode: [DESK_ARP_X[1], DESK_ARP_Z[0], 's'],
  range: [DESK_ARP_X[2], DESK_ARP_Z[0], 's'],
  notes: [DESK_ARP_X[3], DESK_ARP_Z[0], 's'],
  gate: [between(DESK_ARP_X[0], DESK_ARP_X[1]), DESK_ARP_Z[1], 'm'],
  octave: [between(DESK_ARP_X[1], DESK_ARP_X[2]), DESK_ARP_Z[1], 's'],
  glide: [between(DESK_ARP_X[2], DESK_ARP_X[3]), DESK_ARP_Z[1], 's'],
};

/**
 * Portrait : trois zones :
 *   OSCILLATORS (2026-10-04, facon Mini V) : une rangee par oscillateur,
 *     son numero a gauche, WAVEFORM, RANGE, SEMI, FINE, ON et sa LED, puis
 *     FM (rangee 1) et RATIO (rangee 2) ; pas de crochet, les numeros
 *     disent les rangees ;
 *   FILTER : CUTOFF en tres grand, RES, ENV AMT, MODE ; MIXER : OSC 1,
 *     OSC 2, NOISE ;
 *   FILTER EG et MOD : une rangee de huit, sur toute la largeur.
 * Le plateau prend l'ecran et VOLUME, le transport, l'arpegiateur (RATE
 * MODE RANGE NOTES GATE OCTAVE GLIDE), AMP EG et EFFECTS (descendus du
 * panneau le 2026-10-05, la place des pads, plus petits, en une rangee de
 * huit) et les pads.
 */
const PORT_O1 = -2.15;
const PORT_O2 = -0.72;
const PORT_F = 0.78;
const PORT_E1 = 2.32;
const PORT_OSC = { badge: -3.66, wave: -2.95, range: -1.8, semi: -0.6, fine: 0.5, on: 1.5, fm: 2.8 } as const;
/** Les huit colonnes des rangees de petits (deux groupes de quatre), panneau et plateau. */
const PORT_EIGHT = [-3.3, -2.42, -1.54, -0.66, 0.56, 1.44, 2.32, 3.2] as const;
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
  cutoff: [-2.65, PORT_F + 0.15, 'xl'],
  res: [-1.3, PORT_F, 'm'],
  envAmt: [-0.35, PORT_F, 'm'],
  fmode: [0.55, PORT_F, 'sw'],
  osc1: [1.5, PORT_F, 'm'],
  osc2: [2.4, PORT_F, 'm'],
  noise: [3.25, PORT_F, 's'],
  fA: [PORT_EIGHT[0], PORT_E1, 's'],
  fD: [PORT_EIGHT[1], PORT_E1, 's'],
  fS: [PORT_EIGHT[2], PORT_E1, 's'],
  fR: [PORT_EIGHT[3], PORT_E1, 's'],
  lfoRate: [PORT_EIGHT[4], PORT_E1, 's'],
  lfoShape: [PORT_EIGHT[5], PORT_E1, 's'],
  lfoDest: [PORT_EIGHT[6], PORT_E1, 's'],
  lfoAmt: [PORT_EIGHT[7], PORT_E1, 'm'],
};
/**
 * Plateau, portrait : l'arpegiateur en rangee (GLIDE au bout), AMP EG et
 * EFFECTS dessous. Le grand ecran (2026-10-08) prend toute la largeur :
 * VOLUME (a droite du petit ecran, en l, avant) passe au bout de la rangee
 * de l'arpegiateur, en m, sous son crochet OUTPUT ; les sept potards de
 * l'arpege au pas des rangees de huit (0.88). Rangees en z : 2.95 et 4.35
 * avant (le plateau commencait a -0.5, il commence a -1.1).
 */
const PORT_ARP_Z = 3.9;
const PORT_E2 = 5.33;
const PORT_ARP_X = [-3.3, -2.42, -1.54, -0.66, 0.22, 1.1, 1.98] as const;
const PORT_DECK: Partial<Record<VoyKnobId, Spot>> = {
  rate: [PORT_ARP_X[0], PORT_ARP_Z, 'm'],
  mode: [PORT_ARP_X[1], PORT_ARP_Z, 's'],
  range: [PORT_ARP_X[2], PORT_ARP_Z, 's'],
  notes: [PORT_ARP_X[3], PORT_ARP_Z, 's'],
  gate: [PORT_ARP_X[4], PORT_ARP_Z, 'm'],
  octave: [PORT_ARP_X[5], PORT_ARP_Z, 's'],
  glide: [PORT_ARP_X[6], PORT_ARP_Z, 's'],
  volume: [3.2, PORT_ARP_Z, 'm'],
  aA: [PORT_EIGHT[0], PORT_E2, 's'],
  aD: [PORT_EIGHT[1], PORT_E2, 's'],
  aS: [PORT_EIGHT[2], PORT_E2, 's'],
  aR: [PORT_EIGHT[3], PORT_E2, 's'],
  dist: [PORT_EIGHT[4], PORT_E2, 's'],
  chorus: [PORT_EIGHT[5], PORT_E2, 's'],
  delay: [PORT_EIGHT[6], PORT_E2, 's'],
  reverb: [PORT_EIGHT[7], PORT_E2, 's'],
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
// Cinq crans et plus (2026-10-05 : CHORD, les choix de son du MM-RYTM avec les echantillons) : 240 deg, leurs noms respirent
export const switchThrowDeg = (n: number): number => (n <= 2 ? 90 : n <= 4 ? 150 : 240);

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
    { z: -1.98, word: { x: -5.9, w: 3.0 }, model: { x: -2.6, cap: 0.14 }, mark: { x: 5.9, h: 0.34, z: -2.05 }, sub: { x: 5.25, text: 'FIRMWARE V.2.3 / 2026' } };

/* ---------- plateau (repere du capot, y = 0 : dessus du plateau) ---------- */

/**
 * Les huit pads d'accords : caoutchouc retroeclaire, comme ceux de la 808,
 * plus grands ; au telephone tenu droit, une rangee de huit (2026-10-05,
 * Mika : "reduis les pads en bas, qui sont enormes, pour faire plus de place
 * aux knobs" ; deux rangees de quatre de 1.1 avant).
 */
// Plus minces le 2026-10-08 (le grand ecran) : depth, la profondeur, plus courte que la largeur (size) ; carres de 0.86 et 0.98 avant (labelDz 0.62 et 0.72)
export const VOY_PAD = PORTRAIT
  ? { size: 0.86, depth: 0.66, height: 0.2, radius: 0.08, dome: 0.035, xs: [-3.29, -2.35, -1.41, -0.47, 0.47, 1.41, 2.35, 3.29], zs: [6.72], perRow: 8, labelDz: 0.57 }
  : { size: 0.98, depth: 0.7, height: 0.22, radius: 0.08, dome: 0.04, xs: [-4.2, -3.0, -1.8, -0.6, 0.6, 1.8, 3.0, 4.2], zs: [3.16], perRow: 8, labelDz: 0.55 };

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
/**
 * Desktop, depuis le grand ecran (2026-10-08) : deux rangees a droite de
 * l'ecran, en miroir de l'arpegiateur (ses quatre puis trois potards en
 * quinconce) : en haut CLEAR, RANDOM, EDIT ; en bas, entre elles, RUN/STOP
 * (le transport sous la main, comme sur les Elektron) et OPEN. Une rangee
 * de cinq a z 0.85 avant (x 2.5 a 5.65). L'ordre du tableau (pads.ts,
 * jumeaux) ne change pas.
 */
const DESK_KEY_X = [3.55, 4.55, 5.55] as const;
const DESK_KEY_Z = [0.8, 1.86] as const;
export const VOY_BUTTONS: readonly { id: VoyButtonId; label: string; x: number; z: number; w: number; d: number }[] = PORTRAIT
  ? // Plus gros au telephone (2026-10-05, Mika : "trop difficile a attraper") : 1.15 x 0.6 avant ; 1.3 x 0.68 jusqu'au 2026-10-07 ; z 1.6 jusqu'au grand ecran
    [
      { id: 'run', label: 'RUN/STOP', x: -2.9, z: 2.38, w: 1.36, d: 0.78 },
      { id: 'clear', label: 'CLEAR', x: -1.45, z: 2.38, w: 1.36, d: 0.78 },
      { id: 'random', label: 'RANDOM', x: 0, z: 2.38, w: 1.36, d: 0.78 },
      { id: 'edit', label: 'EDIT', x: 1.45, z: 2.38, w: 1.36, d: 0.78 },
      { id: 'open', label: 'OPEN', x: 2.9, z: 2.38, w: 1.36, d: 0.78 },
    ]
  : [
      { id: 'run', label: 'RUN/STOP', x: between(DESK_KEY_X[0], DESK_KEY_X[1]), z: DESK_KEY_Z[1], w: 0.82, d: 0.52 },
      { id: 'clear', label: 'CLEAR', x: DESK_KEY_X[0], z: DESK_KEY_Z[0], w: 0.82, d: 0.52 },
      { id: 'random', label: 'RANDOM', x: DESK_KEY_X[1], z: DESK_KEY_Z[0], w: 0.82, d: 0.52 },
      { id: 'edit', label: 'EDIT', x: DESK_KEY_X[2], z: DESK_KEY_Z[0], w: 0.82, d: 0.52 },
      { id: 'open', label: 'OPEN', x: between(DESK_KEY_X[1], DESK_KEY_X[2]), z: DESK_KEY_Z[1], w: 0.82, d: 0.52 },
    ];
export const VOY_BUTTON = { h: 0.12, radius: 0.05, labelGap: 0.2, press: 0.04 } as const;

/**
 * L'ecran du plateau (verre, cadre fusionne au capot). Le grand ecran
 * (2026-10-08, voyager/screen.ts) : 5.3 x 2.06 au milieu du plateau
 * (2.4 x 0.9 a droite de l'arpegiateur avant), 7.0 x 2.42 sur toute la
 * largeur au telephone (3.9 x 1.0 avant) ; les deux au meme format (2.7 a
 * 2.9 pour 1), une seule mise en page. tex : la largeur de la texture.
 */
export const VOY_LCD = PORTRAIT
  ? { x: 0, z: 0.4, w: 7.0, d: 2.42, bezel: { w: 7.34, d: 2.76, h: 0.02 }, tex: 1024 }
  : { x: 0, z: 1.4, w: 5.3, d: 2.06, bezel: { w: 5.6, d: 2.36, h: 0.02 }, tex: 1280 };

/**
 * La touche i de l'ecran (2026-10-08, Mika : "un petit bouton i dans
 * l'ecran a activer, et de ce fait on peut voir les infos au survol") : un
 * i cerne dessine dans le coin en haut a droite du verre (voyager/screen.ts
 * le dessine a u, v), sa zone de saisie autour (repere du plateau, un peu
 * plus haute que celle de l'ecran : elle passe devant).
 */
/** La largeur de la mise en page de l'ecran, en unites (voyager/screen.ts) : 300 au desktop, 260 au telephone (le texte plus gros). */
export const VOY_SCREEN_UW = PORTRAIT ? 260 : 300;
export const VOY_INFO_KEY = (() => {
  const L = VOY_LCD;
  const UW = VOY_SCREEN_UW;
  // Le centre du i : a 11 unites du bord droit et 10.5 du haut (screen.ts INFO_I)
  const u = 1 - 11 / UW;
  const v = (10.5 * L.w) / UW / L.d;
  // La zone de saisie : un disque de r. scene/hit.ts pick() garde d'abord les formes qui contiennent le
  // doigt (la marge tactile de 24 px ne joue que hors de toute forme) : a cote du disque, c'est vlcd-open
  // (tout l'ecran) qui gagne et PRESETS s'ouvre. Au telephone (revue du 2026-10-08) r 0.6, 46 x 45 px CSS
  // a 390 x 844 (0.3 avant : 23 px, une tape a 14 px du centre ouvrait PRESETS), le contrat veut 44 px ;
  // le disque mord le tempo de l'en-tete, rien d'autre : le pli est a z -1.1, le bord du capot a x 3.83
  const r = PORTRAIT ? 0.6 : 0.17;
  return { u, v, x: L.x - L.w / 2 + u * L.w, z: L.z - L.d / 2 + v * L.d, r };
})();

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
      // VOLUME au bout de la rangee de l'arpegiateur (2026-10-08, le grand ecran) : son crochet a lui
      knobGroup('ARPEGGIATOR', ['rate', 'mode', 'range', 'notes', 'gate', 'octave', 'glide'], ['volume']),
      knobGroup('OUTPUT', ['volume'], ['rate']),
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
// 2026-10-08 : slideZ -3.8 -> -5.1 (desktop), -3.4 -> -5.6 (portrait) : le cadrage ouvert est moins zoome, seul le bord du capot leve se devine en haut
export const VOY_EXPLODE = PORTRAIT
  ? { lift: 6.3, slideZ: -5.6, tiltOpenDeg: -55, pcbRise: 1.0 }
  : { lift: 5.0, slideZ: -5.1, tiltOpenDeg: -24, pcbRise: 1.0 };

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
 * la carte. Dix cases : sept potards, les selecteurs SYNC et CHORD (depuis
 * le 2026-10-05) et le titre.
 */
// 2026-10-04 (Mika : "on voit rien ; les boutons un peu plus gros et surtout les titres, sans trop exagerer") :
// potards 1.3 -> 1.5 (1.45 au telephone), noms 0.08 -> 0.11, bouts de course 0.055 -> 0.068, titre 0.2 -> 0.24
/**
 * 2026-10-08 (Mika : "c'est moche des grosses cases par dessus un PCB..
 * avoir de la finesse design ici") : plus de plaque, les neuf reglages
 * sont soudes sur l'avant de la carte (scene/tweakplate.ts), en trois
 * groupes serigraphies : OSCILLATORS (PHASE, DRIFT, la glissiere SYNC),
 * OUTPUT (WIDTH, BASS MONO, SIDECHAIN), PERFORMANCE (KEY TRACK, ACCENT,
 * le selecteur CHORD) ; le cartouche MM-ARP / TWEAKS, SCOPE et CLOSE
 * dessous. Desktop : deux rangees entre les deux petites puces des cotes
 * (TL072, CA3046, gardees) ; portrait : la carte debout, trois colonnes.
 * La zone : son centre (repere de la carte), ses cotes (repere droit).
 */
const VT = PORTRAIT
  ? (() => {
      // Les rangees, et les cadres : 1.02 au-dessus d'une rangee (le titre du groupe, puis le nom), 0.66 dessous
      const R = [-1.22, 0.78, 2.78];
      const C = [-2.15, 0, 2.15];
      return {
        dims: { cx: 0, cz: 0, w: 6.6, d: 10.6 },
        cellW: 2.05,
        at: {
          phase: [C[0], R[0]],
          drift: [C[1], R[0]],
          sync: [C[2], R[0]],
          width: [C[0], R[1]],
          monoLow: [C[1], R[1]],
          duck: [C[2], R[1]],
          keyTrack: [C[0], R[2]],
          accent: [C[1], R[2]],
          chord: [C[2], R[2]],
        } as Partial<Record<VoyKnobId, readonly [number, number]>>,
        groups: [
          { title: 'OSCILLATORS', x0: -3.15, z0: R[0] - 1.02, x1: 3.15, z1: R[0] + 0.66, accent: true },
          { title: 'OUTPUT', x0: -3.15, z0: R[1] - 1.02, x1: 3.15, z1: R[1] + 0.66 },
          { title: 'PERFORMANCE', x0: -3.15, z0: R[2] - 1.02, x1: 3.15, z1: R[2] + 0.66 },
        ],
        title: { x0: -3.15, z0: -3.44, x1: 1.0, z1: -2.59, name: 'MM-ARP', sub: 'ANALOG CONTROL', rev: 'REV 1.0' },
        scope: { x: 2.2, z: -3.01, w: 1.6, d: 0.5, y: 0.01 },
        close: { x: 2.2, z: -3.01, w: 1.6, d: 0.5, y: 0.01 },
      };
    })()
  : (() => {
      const A = -0.66;
      const B = 0.92;
      return {
        dims: { cx: 0, cz: 1.25, w: 8.4, d: 3.4 },
        cellW: 1.2,
        at: {
          phase: [-3.4, A],
          drift: [-2.15, A],
          sync: [-0.85, A],
          width: [0.75, A],
          monoLow: [2.0, A],
          duck: [3.3, A],
          keyTrack: [-3.4, B],
          accent: [-2.15, B],
          chord: [-0.45, B],
        } as Partial<Record<VoyKnobId, readonly [number, number]>>,
        groups: [
          { title: 'OSCILLATORS', x0: -4.0, z0: A - 0.62, x1: -0.12, z1: A + 0.52, accent: true },
          { title: 'OUTPUT', x0: 0.12, z0: A - 0.62, x1: 4.0, z1: A + 0.52 },
          { title: 'PERFORMANCE', x0: -4.0, z0: B - 0.62, x1: 1.2, z1: B + 0.52 },
        ],
        title: { x0: 1.6, z0: B - 0.62, x1: 4.0, z1: B - 0.05, name: 'MM-ARP', sub: 'ANALOG CONTROL', rev: 'REV 1.0' },
        scope: { x: 1.6 + 0.47, z: B + 0.2, w: 0.94, d: 0.25, y: 0.01 },
        close: { x: 4.0 - 0.47, z: B + 0.2, w: 0.94, d: 0.25, y: 0.01 },
      };
    })();

export const VOY_TWEAK_PLATE = VT.dims;
export const VOY_TWEAK_GROUPS = VT.groups;
export const VOY_TWEAK_TITLE = VT.title;
export const VOY_TWEAK_CELL_W = VT.cellW;

/**
 * Le cadrage ouvert (renderer, OPEN_VIEW ; 2026-10-08, Mika : "deja c'est
 * super zoome") : le pivot sur le dessus de la carte sortie (a plat), un peu
 * derriere son centre, la largeur a tenir : la carte entiere (debout au
 * telephone).
 */
export const VOY_OPEN_FRAME = { y: VOY_PCB_Y + VOY_EXPLODE.pcbRise + PCB.h, z: PORTRAIT ? 0 : -0.15, w: PORTRAIT ? PCB.d : PCB.w } as const;

/** La zone de la carte degagee pour les TWEAKS (repere de la carte ; scene/tweaklayout.ts tweakClearOf). */
export function voyTweakClear(): { x0: number; x1: number; z0: number; z1: number } {
  return tweakClearOf(VT.dims, VT.groups, VT.title);
}

/**
 * La touche SCOPE (2026-10-05, Mika : "le Scope, un bouton a l'interieur de
 * OPEN du MM-ARP") : sous le cartouche, a gauche (repere de la zone :
 * centre, largeur, profondeur ; ui/Scope.tsx la pose et la suit) ; au
 * telephone a droite du cartouche.
 */
export const VOY_SCOPE_KEY = VT.scope;

/**
 * CLOSE dans le MM-ARP ouvert (2026-10-05, Mika : "quand on clique sur OPEN
 * on devrait voir un CLOSE a l'interieur de la machine, voyant") : desktop,
 * sous le cartouche, a droite (au telephone, ui/PcbClose.tsx).
 */
export const VOY_CLOSE_KEY = VT.close;

/**
 * Les bouts de course ecrits sous chaque potard (gauche : 0, droite : 10) ;
 * SYNC, un commutateur, porte OFF et ON a ses reperes.
 */
export const VOY_TWEAK_ENDS: Partial<Record<VoyKnobId, readonly [string, string]>> = {
  phase: ['FREE', '360'],
  duck: ['OFF', '-24 DB'],
  drift: ['STABLE', 'LOOSE'],
  width: ['MONO', 'WIDE'],
  monoLow: ['OFF', '300 HZ'],
  keyTrack: ['0', 'FULL'],
  accent: ['FLAT', 'HARD'],
};

/** La place d'un TWEAK sur la carte (null : pas un TWEAK) ; SYNC et CHORD : des commutateurs (leurs crans). */
export function voyTweakPlace(id: VoyKnobId): { x: number; z: number; sw: boolean } | null {
  const c = VT.at[id];
  if (!c) return null;
  return { x: c[0], z: c[1], sw: id === 'sync' || id === 'chord' };
}


/**
 * Cadrage (desktop : la largeur projetee a l'azimut 45 ; mobile : la
 * largeur de face) et hauteur projetee fermee a la vue d'arrivee, pivot,
 * rayons (cadrage de section), pile ouverte : mesures sur la machine
 * (window.__v4.voyager.fit()).
 */
// Portrait : h 14.4, rayons 8.4 et 10.4, fitHalfH 11.5 avant le plateau allonge (2026-10-08)
export const VOY_FRAME = PORTRAIT
  ? { plate: VOY_BODY.w, h: VOY_BODY.d, targetY: 1.6, radius: { closed: 9.0, open: 11.0 }, fitHalfH: 12.4, explodeTargetY: 4.2 }
  : { plate: Math.SQRT1_2 * (VOY_BODY.w + VOY_BODY.d), h: 9.4, targetY: 1.6, radius: { closed: 8.1, open: 9.6 }, fitHalfH: 8.6, explodeTargetY: 5.9 };


/**
 * Le nom de la machine (2026-10-03, Mika : "le titre c'est MM-808 et
 * l'autre c'est MM-ARP") : serigraphie, ecran, carte, navigation. Le code
 * garde ses noms internes (voy, voyager, VOYAGER, ?voyager=0).
 */
export const VOY_COPY = { model: 'MM-ARP', group: 'MM-ARP arpeggiator synthesizer', lcdIdle: 'MM-ARP' } as const;
