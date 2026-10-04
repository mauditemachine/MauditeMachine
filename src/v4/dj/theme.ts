/**
 * MM-DECKS (2026-10-04, demande de Mika : "je veux bouger Deck dans
 * mauditemachine.com", "en 3d please") : la troisieme machine, celle des
 * Decks de sonaa.ca. Deux platines facon CDJ (DECK A, DECK B) et une table
 * de mixage facon DJM (MIXER) entre elles, posees cote a cote sur la meme
 * table que le MM-RYTM et le MM-ARP, a droite du MM-ARP.
 *
 * Les trois blocs ont le meme coin (avant 1.0, arriere 1.5 au-dessus des
 * pieds) : leurs dessus sont dans un meme plan incline, le repere "top" du
 * rig. Repere du rig : origine au centre de l'ensemble, au sol ; +x a
 * droite, +z vers l'utilisateur. Repere top : origine au centre du dessus,
 * x a droite, z qui descend la pente vers l'utilisateur, y 0 = le dessus.
 * Chaque bloc a son centre en x (UNIT_X) ; ses commandes sont donnees dans
 * son repere (x, z autour de son centre).
 *
 * Les memes blocs au telephone : seul le cadrage change (un bloc a la
 * fois, plus tard). Les couleurs ne passent pas par la palette partagee
 * (theme.ts) : DJ_TONE donne chaque teinte AFFICHEE visee et son gain,
 * pour la machine noire et la claire.
 */

import { APPEARANCE, PORTRAIT } from '../theme';
import { VOY_BODY, VOY_X } from '../voyager/theme';

/* ---------- blocs ---------- */

/*
 * Des platines en plus (Mika, 2026-10-04 : "j'aimerais pouvoir en rajouter
 * a droite, ce qui cree directement une piste dans MIXER") : de deux a
 * quatre platines, DECK C puis DECK D a droite de DECK B, chacune avec sa
 * voie au MIXER (5 et 6). Rien ne se voit au repos (Mika : "quand on survole
 * la partie droite, un + s'affiche, sinon rien") : un + apparait au survol
 * du bord droit (dj/AddDeck.tsx) ; au telephone, un + fin en bout de
 * defilement des blocs ('add', sans corps). REMOVE, sur la derniere
 * ajoutee, la retire. Les places
 * (UNIT_X, DJ_W, DJ_X, MIX, DJ_FRAME) se recalculent alors et le Stage est
 * reconstruit (index.tsx), comme au changement Dark / Light ; le son
 * continue. Le bord gauche de l'ensemble ne bouge pas : il grandit a
 * droite.
 *
 * La platine est plus etroite depuis le meme jour (Mika : "le jog n'est
 * pas super utile, diminue sa taille et donc reduis le DECK en largeur",
 * puis "les decks sont trop gros, on ne voit pas les choses ; moins de jog
 * et plus d'ecran pour voir la waveform") : 6 au lieu de 9, le jog de 2.55
 * a 1.35 de rayon, l'ecran de 2.0 a 3.2 de profondeur.
 */
export const DJ_UNIT = { deckW: 6, mixW: 8.4, addW: 3.2, d: 11, gap: 0.25 } as const;
/** Coin commun aux blocs (hauteurs au-dessus des pieds), biseau des aretes. */
export const DJ_BODY = { feet: 0.12, front: 1.0, back: 1.5, bevel: 0.06 } as const;
/** Pente du dessus (rad) : l'avant descend. */
export const DJ_TILT = Math.atan((DJ_BODY.back - DJ_BODY.front) / DJ_UNIT.d);
/** Centre du dessus, repere du rig. */
export const DJ_TOP_Y = DJ_BODY.feet + (DJ_BODY.front + DJ_BODY.back) / 2;

/** Les quatre platines possibles, de gauche a droite apres la table : A, puis B, C, D. */
export type DjDeck = 'a' | 'b' | 'c' | 'd';
export const DJ_DECKS_ALL: readonly DjDeck[] = ['a', 'b', 'c', 'd'];
/**
 * Un bloc : une platine, la table, ou 'add' (le + au telephone, sans corps,
 * tant qu'on peut en ajouter). 'mix1' et 'mix2' : les deux moities de la
 * table, cadrees l'une apres l'autre au telephone (Mika, 2026-10-04 : "en
 * mobile, toutes les fonctionnalites, avec de plus gros boutons").
 */
export type DjUnit = DjDeck | 'mix' | 'mix1' | 'mix2' | 'mix3' | 'add';
export const DJ_DECKS_MIN = 2;
export const DJ_DECKS_MAX = 4;
/** La voie de la table d'une platine : A 3, B 4, C 5, D 6 (index 2 a 5). */
export const deckChannel = (d: DjDeck): DjChannel => (2 + DJ_DECKS_ALL.indexOf(d)) as DjChannel;

/** Les platines posees, de gauche a droite (A, B, puis C et D si ajoutees). */
export let DJ_DECKS: readonly DjDeck[] = ['a', 'b'];
/** Les blocs poses (avec un corps), de gauche a droite. */
export let DJ_UNITS_ON: readonly DjUnit[] = ['a', 'mix', 'b'];
/** Les blocs qu'on fait defiler au telephone : les blocs poses, puis le + s'il reste une place. */
export let DJ_VIEW_UNITS: readonly DjUnit[] = ['a', 'mix', 'b', 'add'];
/** Le nombre de voies de la table : le MM-RYTM, le MM-ARP, puis une par platine. */
export let DJ_CHANNELS = 4;
/** La table s'elargit d'une colonne par voie en plus. */
export const MIX_COL = 1.45;
export const mixWidth = (channels: number): number => DJ_UNIT.mixW + (channels - 4) * MIX_COL;

/** Centre de chaque bloc pose (repere du rig : 0 au milieu de l'ensemble). */
export const UNIT_X: Record<DjUnit, number> = { a: 0, b: 0, c: 0, d: 0, mix: 0, mix1: 0, mix2: 0, mix3: 0, add: 0 };
/** La largeur d'une vue de la table au telephone : celle d'une platine, a peu pres. */
const MIX_VIEW = 5.6;
const MIX_VIEWS = ['mix1', 'mix2', 'mix3'] as const;
export const unitW = (u: DjUnit): number =>
  u === 'mix' ? mixWidth(DJ_CHANNELS) : u === 'mix1' || u === 'mix2' || u === 'mix3' ? MIX_VIEW : u === 'add' ? DJ_UNIT.addW : DJ_UNIT.deckW;
/** Combien de vues pour la table au telephone : deux a quatre voies, trois au-dela. */
let mixViews = 2;
/** Largeur de l'ensemble pose. */
export let DJ_W = 0;
/** Place de la troisieme machine : a droite du MM-ARP, le meme jour qu'entre la 808 et lui ; son bord gauche ne bouge pas. */
const DJ_LEFT = VOY_X + VOY_BODY.w / 2 + (PORTRAIT ? 1.8 : 2.6);
export let DJ_X = 0;

/**
 * Cadrage : l'ensemble de face (largeur reelle : a l'azimut 45 la
 * projection est a peine plus large), hauteur projetee a la vue d'arrivee
 * (elevation 69), pivot, rayons du cadrage de section, etendue de la
 * camera d'ombre.
 */
export const DJ_FRAME = { fill: 0.92, h: 11.2, targetY: 1.3, radius: { closed: 0, open: 0 }, extent: 0 };

/* ---------- combien de platines ---------- */

const DECKS_KEY = 'mm.v4.dj.decks';
const readDecks = (): number => {
  try {
    const n = Number(window.localStorage.getItem(DECKS_KEY));
    return Number.isInteger(n) && n >= DJ_DECKS_MIN && n <= DJ_DECKS_MAX ? n : DJ_DECKS_MIN;
  } catch {
    return DJ_DECKS_MIN;
  }
};

/** Les places (blocs, table, cadrage) pour n platines. */
function place(n: number): void {
  DJ_DECKS = DJ_DECKS_ALL.slice(0, n);
  DJ_CHANNELS = 2 + n;
  DJ_UNITS_ON = ['a', 'mix', ...DJ_DECKS.slice(1)];
  // Au telephone, la table se voit en deux ou trois vues, de gauche a droite
  mixViews = Math.min(MIX_VIEWS.length, Math.max(2, Math.ceil(mixWidth(DJ_CHANNELS) / MIX_VIEW)));
  const views: DjUnit[] = [...MIX_VIEWS.slice(0, mixViews)];
  DJ_VIEW_UNITS = [...DJ_UNITS_ON.flatMap((u): DjUnit[] => (u === 'mix' ? views : [u])), ...(n < DJ_DECKS_MAX ? (['add'] as const) : [])];
  const widths = DJ_UNITS_ON.map(unitW);
  DJ_W = widths.reduce((a, w) => a + w, 0) + (widths.length - 1) * DJ_UNIT.gap;
  for (const u of Object.keys(UNIT_X) as DjUnit[]) UNIT_X[u] = 0;
  let x = -DJ_W / 2;
  DJ_UNITS_ON.forEach((u, i) => {
    UNIT_X[u] = x + widths[i] / 2;
    x += widths[i] + DJ_UNIT.gap;
  });
  // Le + : juste a droite de l'ensemble, hors de son cadrage (desktop)
  UNIT_X.add = DJ_W / 2 + DJ_UNIT.gap + DJ_UNIT.addW / 2;
  // Les vues de la table : la premiere contre son bord gauche, la derniere contre son bord droit
  const mw = mixWidth(DJ_CHANNELS);
  const c0 = -mw / 2 + MIX_VIEW / 2;
  const c1 = mw / 2 - MIX_VIEW / 2;
  MIX_VIEWS.forEach((u, i) => {
    UNIT_X[u] = UNIT_X.mix + (mixViews > 1 ? c0 + ((c1 - c0) * Math.min(i, mixViews - 1)) / (mixViews - 1) : 0);
  });
  DJ_X = DJ_LEFT + DJ_W / 2;
  DJ_FRAME.radius.closed = DJ_W / 2 + 0.6;
  DJ_FRAME.radius.open = DJ_W / 2 + 0.6;
  DJ_FRAME.extent = DJ_W / 2 + 2;
  placeMix(DJ_CHANNELS);
}

let decks = typeof window === 'undefined' ? DJ_DECKS_MIN : readDecks();
/** Les modules qui recalculent leurs listes (dj/layout.ts), avant tout le monde. */
const relayout = new Set<() => void>();
const deckListeners = new Set<() => void>();

/**
 * Le nombre de platines posees (2 a 4), retenu dans le navigateur. Le
 * changer recalcule les places, puis previent : index.tsx reconstruit le
 * Stage.
 */
export const djDecks = {
  get: (): number => decks,
  set(n: number): void {
    const next = Math.max(DJ_DECKS_MIN, Math.min(DJ_DECKS_MAX, Math.round(n)));
    if (next === decks) return;
    decks = next;
    try {
      window.localStorage.setItem(DECKS_KEY, String(next));
    } catch {
      /* le nombre vit pour la visite */
    }
    place(next);
    relayout.forEach((fn) => fn());
    deckListeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    deckListeners.add(fn);
    return () => {
      deckListeners.delete(fn);
    };
  },
  /** dj/layout.ts : ses listes se refont a chaque changement, avant la reconstruction. */
  onRelayout(fn: () => void): void {
    relayout.add(fn);
  },
};

/* ---------- couleurs ---------- */

export type DjTone =
  | 'body'
  | 'panel'
  | 'edge'
  | 'rubber'
  | 'bezel'
  | 'slot'
  | 'slit'
  | 'knob'
  | 'skirt'
  | 'mark'
  | 'cap'
  | 'platter'
  | 'groove'
  | 'ring'
  | 'hot';

/** [teinte affichee visee, gain] par tone ; la machine claire a les siennes. */
const DARK_TONES: Record<DjTone, readonly [string, number]> = {
  body: ['#0C0C0E', 7.5],
  panel: ['#131315', 3.6],
  edge: ['#2C2D32', 2.3],
  rubber: ['#111113', 1.8],
  bezel: ['#050506', 3],
  slot: ['#070708', 3],
  slit: ['#000000', 1],
  knob: ['#0F0F11', 2.4],
  skirt: ['#5D6167', 1],
  mark: ['#F6F1E7', 1.15],
  cap: ['#16161A', 2.4],
  platter: ['#0E0E10', 2.6],
  groove: ['#1A1B1F', 2.6],
  ring: ['#9AA0A8', 0.9],
  /** le capuchon de FILTER : l'orange du pad OPEN du MM-RYTM (Mika, 2026-10-04) */
  hot: ['#FF6A13', 0.95],
};
const LIGHT_TONES: Record<DjTone, readonly [string, number]> = {
  body: ['#E2DED6', 1.2],
  panel: ['#F8F5EF', 1],
  edge: ['#FFFFFF', 1],
  rubber: ['#E6E3DD', 1.05],
  bezel: ['#0A0A0B', 3],
  slot: ['#2A2A2E', 2],
  slit: ['#000000', 1],
  knob: ['#232326', 2.4],
  skirt: ['#E6E8EC', 1],
  mark: ['#F6F1E7', 1.15],
  cap: ['#26262A', 2.4],
  platter: ['#26262A', 2.2],
  groove: ['#34343A', 2.2],
  ring: ['#D9DCE1', 0.9],
  hot: ['#FF6A13', 0.95],
};
/** La teinte et le gain d'un tone dans l'apparence posee (le Stage est reconstruit a chaque changement). */
export const djTone = (t: DjTone): readonly [string, number] => (APPEARANCE.current === 'light' ? LIGHT_TONES : DARK_TONES)[t];

/** Couleurs des lumieres (emissifs lineaires, LED) : l'orange et le jaune des machines. */
export const DJ_LIGHT = {
  orange: '#FF6A13',
  yellow: '#FFD75E',
  red: '#E0402A',
  /** LED eteinte : un gris a peine visible */
  off: '#26272B',
  /**
   * Theme clair (Mika, 2026-10-04 : "les vumetres, on a du mal a les voir en
   * light mode") : la LED eteinte est une fente sombre, comme les temoins du
   * MM-RYTM, et les VU allumes sont satures (orange, puis rouge en haut),
   * lisibles au soleil sur le panneau creme.
   */
  offLight: '#34312C',
  vuLight: ['#FF5A00', '#E3340B', '#BE1A12'],
} as const;

/* ---------- commandes : potards (repere du bloc) ---------- */

/** Potard Moog, la geometrie du MM-ARP (capuchon cannele, jupe d'aluminium, repere). */
export const DJ_KNOB = {
  r: 0.25,
  rTop: 0.22,
  h: 0.34,
  flutes: 24,
  fluteDepth: 0.012,
  skirt: { r: 0.284, h: 0.04, rTop: 0.272 },
  mark: { w: 0.03, h: 0.01, d: 0.15 },
  segments: { desktop: 40, mobile: 28 },
} as const;

/** Les voies de la table : 1 le MM-RYTM, 2 le MM-ARP, 3 a 6 les platines A a D. */
export type DjChannel = 0 | 1 | 2 | 3 | 4 | 5;
export const DJ_CHANNELS_MAX = 6;
export type DjEqId = 'gain' | 'hi' | 'mid' | 'low' | 'filter';
export const DJ_EQ: readonly { id: DjEqId; label: string }[] = [
  { id: 'gain', label: 'GAIN' },
  { id: 'hi', label: 'HI' },
  { id: 'mid', label: 'MID' },
  { id: 'low', label: 'LOW' },
  { id: 'filter', label: 'FILTER' },
];
/** OVERDRIVE remplace DISTO le 2026-10-04 (Mika : "au lieu de disto je veux Overdrive"). */
export const DJ_FX = ['overdrive', 'crush', 'chorus', 'flanger', 'trans', 'delay', 'reverb'] as const;
export type DjFxId = (typeof DJ_FX)[number];
export const DJ_FX_LABEL: Readonly<Record<DjFxId, string>> = {
  overdrive: 'OVERDRIVE',
  crush: 'CRUSH',
  chorus: 'CHORUS',
  flanger: 'FLANGER',
  trans: 'TRANS',
  delay: 'DELAY',
  reverb: 'REVERB',
};
/** Les temps des effets (fractions de temps), comme sur Sonaa. */
export const DJ_TIMES = [0.25, 0.5, 0.75, 1, 2, 4] as const;
export const timeLabel = (d: number): string => (d === 0.25 ? '1/4' : d === 0.5 ? '1/2' : d === 0.75 ? '3/4' : String(d));

/**
 * La table, colonnes : une voie par machine et par platine (1 MM-RYTM, 2
 * MM-ARP, 3 a 6 les platines), puis MASTER. Rangees des potards de voie, du
 * haut vers le bas, libelles au-dessus (Mika, 2026-10-03 : "les titres
 * au-dessus des boutons"). Repere du bloc ; a quatre voies, la table fait
 * 8.4 de large, chaque voie en plus l'elargit de MIX_COL a droite : la
 * rangee des effets s'etale, l'ecran et TIME restent au milieu.
 */
export const MIX = {
  /** colonnes des voies et MASTER : recalcules par placeMix */
  cols: [] as number[],
  masterX: 0,
  numZ: -2.2,
  rows: [-1.5, -0.64, 0.24, 1.12, 1.98] as readonly number[],
  /**
   * echelle des potards : GAIN et FILTER, les trois EQ un peu plus gros
   * (Mika, 2026-10-03 : "pas trop non plus" ; 2026-10-04 : "les knobs je les
   * veux plus gros")
   */
  sGain: 1.0,
  sEq: 1.15,
  /** effets : rangee sous l'ecran */
  fxZ: -3.0,
  fxX0: 0,
  fxPitch: 1.1,
  sFx: 0.95,
  master: { z: -1.45, s: 1.25 },
  /** ecran des effets et touches de temps */
  screen: { x: 0, z: -4.25, w: 3.9, d: 0.95 },
  times: { x0: 0, pitch: 0.6, z: -4.1, w: 0.5, d: 0.34 },
  /** faders de voie : fente de z0 a z1 (plus longue depuis que le crossfader est parti) ; VU a cote */
  fader: { z0: 2.62, z1: 5.0 },
  vu: { dx: 0.5, z0: -1.45, z1: 1.95, n: 15, w: 0.14, d: 0.16 },
  /** VU du master (deux colonnes) */
  masterVu: { z0: -0.6, z1: 4.3, dx: 0.17 },
  head: { z: -5.05 },
};

/** Les colonnes de la table pour n voies (repere du bloc). */
function placeMix(n: number): void {
  const w = mixWidth(n);
  const L = -w / 2;
  const mid = (w - DJ_UNIT.mixW) / 2;
  MIX.cols = Array.from({ length: n }, (_, i) => L + 1.1 + i * MIX_COL);
  MIX.masterX = MIX.cols[n - 1] + 1.7;
  MIX.fxX0 = L + 0.9;
  MIX.fxPitch = (w - 1.8) / (DJ_FX.length - 1);
  MIX.screen.x = L + mid + 2.45;
  MIX.times.x0 = L + mid + 4.82;
}

/* ---------- la platine (repere du bloc) ---------- */

export const DECK = {
  head: { z: -5.05 },
  /**
   * Le logotype de l'en-tete (2026-10-04, Mika : "on ne voit plus le logo
   * type") : l'ecran agrandi montait sous lui (son cadre a z -4.92) ; plus
   * petit que celui de la table et remonte, il reste entier au-dessus.
   */
  logo: { h: 0.32, z: -5.13 },
  /**
   * L'ecran, la moitie haute de la platine (Mika, 2026-10-04 : "trop
   * miniature, on ne voit rien ; je veux un plus grand ecran et voir la
   * playlist a l'interieur de chaque deck, comme un CDJ") : le morceau et
   * ses formes d'onde, ou la liste des morceaux (dj/TrackBrowser.tsx) ;
   * toucher l'ecran passe de l'un a l'autre.
   */
  screen: { x: 0, z: -2.55, w: 5.6, d: 4.5 },
  /** hot cues : une rangee de quatre sous l'ecran, une seule couleur (Mika, 2026-10-03) */
  cues: { xs: [-1.95, -0.65, 0.65, 1.95] as readonly number[], z: 0.3, w: 1.1, d: 0.38 },
  /**
   * LOOP (Mika, 2026-10-04 : "continue avec les boucles LOOP") : 1, 2, 4 et
   * 8 temps, sous les hot cues ; la boucle part du temps ou l'on est (la
   * grille de SYNC), une autre longueur la redimensionne, la meme touche la
   * quitte.
   */
  loops: { xs: [-1.95, -0.65, 0.65, 1.95] as readonly number[], beats: [1, 2, 4, 8] as readonly number[], z: 1.2, w: 1.1, d: 0.38 },
  /**
   * le jog, sobre (Mika, 2026-10-04 : "les jogs sont moches") : un grand
   * potard des machines MM, capuchon noir cannele, jupe d'aluminium, un
   * trait os qui tourne ; au centre, l'ecran rond est la touche SYNC
   */
  jog: { x: -0.1, z: 3.55, ring: 1.22, platter: 1.08, platterH: 0.26, center: 0.46 },
  /** colonne de gauche : BEND, puis CUE et PLAY, boutons ronds en metal */
  bend: { xs: [-2.5, -1.9] as readonly number[], z: 2.05, w: 0.5, d: 0.4 },
  cue: { x: -2.2, z: 3.2, r: 0.5 },
  play: { x: -2.2, z: 4.6, r: 0.5 },
  /** le fader de pitch, a droite du jog ; zero au milieu, LED */
  pitch: { x: 2.2, z0: 2.0, z1: 4.2 },
  /**
   * PITCH - et + (Mika, 2026-10-04 : "je voudrais pouvoir changer le pitch
   * avec des + et des -") : deux touches nommees sous le fader, un dixieme
   * de BPM par appui, en continu tenues (Maj : un BPM).
   */
  tempo: { xs: [1.9, 2.5] as readonly number[], z: 4.88, w: 0.52, d: 0.38 },
  /** REMOVE : sur la derniere platine ajoutee (C ou D), dans l'en-tete, avant le logo */
  remove: { x: 1.45, z: -5.05, w: 0.6, d: 0.28 },
} as const;

/**
 * L'ecran de la platine, en fractions de sa largeur (u, depuis la gauche)
 * et de sa hauteur (v, depuis le haut) : le morceau en haut (titre,
 * artiste, BPM, Camelot, temps), la forme d'onde fine au milieu, haute
 * (elle defile, la tete de lecture au centre), la piste entiere en bas, et
 * a sa droite les deux touches du zoom. Seuls le texte et le zoom passent
 * par la texture des ecrans (dj/screens.ts) ; les formes d'onde ont leur
 * shader ; la liste des morceaux est une page HTML posee sur l'ecran.
 */
export const DECK_SCREEN = {
  text: 0.22,
  detail: { u0: 0.02, u1: 0.98, v0: 0.25, v1: 0.76 },
  overview: { u0: 0.02, u1: 0.84, v0: 0.8, v1: 0.95 },
  zoom: { u0: 0.86, u1: 0.98, v0: 0.79, v1: 0.96 },
} as const;

/* ---------- faders, touches ---------- */

export const DJ_FADER = {
  slot: { w: 0.16, h: 0.012, margin: 0.18 },
  slit: { w: 0.045 },
  cap: { w: 0.56, h: 0.3, d: 0.3, radius: 0.05 },
  xcap: { w: 0.3, d: 0.56 },
} as const;
export const DJ_KEY = { h: 0.12, radius: 0.05, press: 0.04 } as const;
export const DJ_ROUND = { h: 0.16, ring: 0.07, ringH: 0.07 } as const;
export const DJ_BEZEL = { margin: 0.12, h: 0.02 } as const;

/* Les places au chargement (le nombre retenu), une fois MIX et DJ_FX definis. */
place(decks);
