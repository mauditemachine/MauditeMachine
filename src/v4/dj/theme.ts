/**
 * MM-DECKS (2026-10-04, demande de Mika : "je veux bouger Deck dans
 * mauditemachine.com", "en 3d please") : la troisieme machine, celle des
 * Decks de sonaa.ca. Deux platines facon CDJ (DECK A, DECK B) et une table
 * de mixage facon DJM (MIXER) entre elles, posees cote a cote sur la meme
 * table que le MM-RYTM, le MM-BASS et le MM-ARP, a droite du MM-ARP.
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
import { BASS } from '../state/focus';

/* ---------- blocs ---------- */

/*
 * Des platines en plus (Mika, 2026-10-04 : "j'aimerais pouvoir en rajouter
 * a droite, ce qui cree directement une piste dans MIXER") : de deux a
 * quatre platines, DECK C puis DECK D a droite de DECK B, chacune avec sa
 * voie au MIXER (5 et 6). Rien ne se voit au repos (Mika : "quand on survole
 * la partie droite, un + s'affiche, sinon rien") : un + apparait au survol
 * du bord droit (dj/Twins.tsx) ; au telephone, un + fin en bout de
 * defilement des blocs ('add', sans corps). REMOVE DECK, juste sous ADD
 * DECK au meme endroit, et la touche REMOVE de la derniere ajoutee la
 * retirent. Les places
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
/**
 * Les machines du site sur la table (2026-10-07, Mika : "avec MM-BASS, ca
 * fait trois machines, on devrait avoir trois tranches pour les machines et
 * deux pour les DECKS, donc 5") : dans l'ordre de la table, 1 MM-RYTM, 2
 * MM-BASS, 3 MM-ARP ; les platines ensuite.
 */
export const DJ_MACHINE_CHANNELS = 3;
/** La voie de la table d'une platine : A 4, B 5, C 6, D 7 (index 3 a 6). */
export const deckChannel = (d: DjDeck): DjChannel => (DJ_MACHINE_CHANNELS + DJ_DECKS_ALL.indexOf(d)) as DjChannel;

/** Les platines posees, de gauche a droite (A, B, puis C et D si ajoutees). */
export let DJ_DECKS: readonly DjDeck[] = ['a', 'b'];
/** Les blocs poses (avec un corps), de gauche a droite. */
export let DJ_UNITS_ON: readonly DjUnit[] = ['a', 'mix', 'b'];
/**
 * Les blocs qu'on fait defiler au telephone : les blocs poses (la table en
 * deux ou trois vues). Le bloc de fin (ADD DECK, REMOVE DECK) est parti le
 * 2026-10-05 : ADD DECK est une touche de la table, REMOVE DECK celle de la
 * derniere platine.
 */
export let DJ_VIEW_UNITS: readonly DjUnit[] = ['a', 'mix', 'b'];
/** Le nombre de voies de la table : le MM-RYTM, le MM-BASS, le MM-ARP, puis une par platine. */
export let DJ_CHANNELS = 5;
/**
 * Les voies dessinees sur la table, de gauche a droite (2026-10-10, Mika : "supprime la voix BASS dans le MIXER") :
 * le MM-BASS cache (state/focus.ts BASS), sa voie 2 n'est plus sur la table ; les numeros des voies ne bougent pas
 * (ids dj-ch3-..., MIDI, Roto, l'etat garde), seules leurs colonnes se resserrent. DJ_COL : la colonne d'une voie.
 */
export let DJ_SHOWN: readonly DjChannel[] = [0, 1, 2, 3, 4];
/** La voie d'une colonne de la table (son rang dans DJ_SHOWN). */
export const djShownOf = (n: number): DjChannel[] => Array.from({ length: n }, (_, i) => i as DjChannel).filter((c) => BASS || c !== 1);
/**
 * La table s'elargit d'une colonne par voie en plus. Au telephone tenu
 * droit (2026-10-05, Mika : "redesign le MIXER en mobile, ca doit rentrer
 * dans la fenetre") : a quatre voies, la largeur d'une platine, en une
 * seule vue ; des colonnes plus serrees.
 */
export const MIX_COL = PORTRAIT ? 1.08 : 1.45;
const MIX_W4 = PORTRAIT ? DJ_UNIT.deckW : DJ_UNIT.mixW;
export const mixWidth = (channels: number): number => MIX_W4 + (channels - 4) * MIX_COL;

/** Centre de chaque bloc pose (repere du rig : 0 au milieu de l'ensemble). */
export const UNIT_X: Record<DjUnit, number> = { a: 0, b: 0, c: 0, d: 0, mix: 0, mix1: 0, mix2: 0, mix3: 0, add: 0 };
/** La largeur d'une vue de la table au telephone : celle d'une platine, a peu pres. */
const MIX_VIEW = 5.6;
const MIX_VIEWS = ['mix1', 'mix2', 'mix3'] as const;
export const unitW = (u: DjUnit): number =>
  u === 'mix' ? mixWidth(DJ_SHOWN.length) : u === 'mix1' || u === 'mix2' || u === 'mix3' ? MIX_VIEW : u === 'add' ? DJ_UNIT.addW : DJ_UNIT.deckW;
/** Combien de vues pour la table au telephone : deux a quatre voies, trois au-dela. */
let mixViews = 2;
/** Largeur de l'ensemble pose. */
export let DJ_W = 0;
/**
 * Place du MM-DECKS : la derniere machine, a droite du MM-ARP (qui suit le
 * MM-BASS depuis le 2026-10-07), le meme jour qu'entre la 808 et le MM-ARP ;
 * son bord gauche ne bouge pas quand on ajoute une platine.
 */
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
  DJ_CHANNELS = DJ_MACHINE_CHANNELS + n;
  DJ_SHOWN = djShownOf(DJ_CHANNELS);
  DJ_UNITS_ON = ['a', 'mix', ...DJ_DECKS.slice(1)];
  // Au telephone couche, la table se voit en deux ou trois vues, de gauche a droite ; tenu droit, en une
  mixViews = Math.min(MIX_VIEWS.length, Math.max(2, Math.ceil(mixWidth(DJ_SHOWN.length) / MIX_VIEW)));
  const views: DjUnit[] = PORTRAIT ? ['mix'] : [...MIX_VIEWS.slice(0, mixViews)];
  DJ_VIEW_UNITS = DJ_UNITS_ON.flatMap((u): DjUnit[] => (u === 'mix' ? views : [u]));
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
  const mw = mixWidth(DJ_SHOWN.length);
  const c0 = -mw / 2 + MIX_VIEW / 2;
  const c1 = mw / 2 - MIX_VIEW / 2;
  MIX_VIEWS.forEach((u, i) => {
    UNIT_X[u] = UNIT_X.mix + (mixViews > 1 ? c0 + ((c1 - c0) * Math.min(i, mixViews - 1)) / (mixViews - 1) : 0);
  });
  DJ_X = DJ_LEFT + DJ_W / 2;
  DJ_FRAME.radius.closed = DJ_W / 2 + 0.6;
  DJ_FRAME.radius.open = DJ_W / 2 + 0.6;
  DJ_FRAME.extent = DJ_W / 2 + 2;
  placeMix(DJ_SHOWN.length);
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
  vuLight: ['#14B83C', '#F2B800', '#D81E16'],
  /**
   * Les vumetres aux couleurs d'un vumetre (2026-10-08, Mika : "blanc creme
   * c'est vert, orange c'est jaune, et rouge c'est rouge") : vert, puis jaune
   * de -6 a -2 dBFS, rouge a -1 ; plus saturees en clair (vuLight).
   */
  vu: ['#2FD65A', '#FFD23F', '#FF2A1F'],
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

/** Les voies de la table : 1 le MM-RYTM, 2 le MM-BASS, 3 le MM-ARP, 4 a 7 les platines A a D. */
export type DjChannel = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const DJ_CHANNELS_MAX = 7;
/** Le nom court de chaque voie (la serigraphie, FX TO, le Roto-Control). */
export const DJ_CH_NAMES = ['RYTM', 'BASS', 'ARP', 'A', 'B', 'C', 'D'] as const;
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
 * MM-BASS, 3 MM-ARP, 4 a 7 les platines), puis MASTER. Rangees des potards de voie, du
 * haut vers le bas, libelles au-dessus (Mika, 2026-10-03 : "les titres
 * au-dessus des boutons"). Repere du bloc ; a quatre voies, la table fait
 * 8.4 de large, chaque voie en plus l'elargit de MIX_COL a droite : la
 * rangee des effets s'etale, l'ecran et TIME restent au milieu.
 */
export const MIX = {
  /** colonnes des voies et MASTER : recalcules par placeMix */
  cols: [] as number[],
  masterX: 0,
  numZ: PORTRAIT ? -0.42 : -2.2,
  rows: (PORTRAIT ? [0.45, 1.33, 2.21, 3.09, 3.97] : [-1.5, -0.64, 0.24, 1.12, 1.98]) as readonly number[],
  /**
   * Au telephone tenu droit, le volume de la voie est un potard sous FILTER
   * (Mika, 2026-10-05 : "au pire mets des rotary au lieu des faders, qui
   * sont d'ailleurs longs") ; il garde l'id du fader (MIDI, Roto-Control).
   */
  vol: { z: 4.85, s: 1.15 },
  /**
   * echelle des potards : GAIN et FILTER, les trois EQ un peu plus gros
   * (Mika, 2026-10-03 : "pas trop non plus" ; 2026-10-04 : "les knobs je les
   * veux plus gros")
   */
  sGain: 1.0,
  sEq: PORTRAIT ? 1.1 : 1.15,
  /**
   * effets : rangee sous l'ecran ; au telephone tenu droit, deux rangees de
   * quatre (FX TO la derniere), plus gros (Mika, 2026-10-05 : "les knobs FX
   * sont trop petits") ; fxRowDz : l'ecart des deux rangees
   */
  fxZ: PORTRAIT ? -2.55 : -3.0,
  fxRowDz: 1.1,
  fxX0: 0,
  fxPitch: 1.1,
  sFx: PORTRAIT ? 1.25 : 0.95,
  master: PORTRAIT ? { z: 0.6, s: 1.15 } : { z: -1.45, s: 1.25 },
  /** ecran des effets et touches de temps */
  screen: PORTRAIT ? { x: 0, z: -4.42, w: 5.5, d: 0.66 } : { x: 0, z: -4.25, w: 3.9, d: 0.95 },
  times: PORTRAIT ? { x0: 0, pitch: 0.9, z: -3.55, w: 0.7, d: 0.32 } : { x0: 0, pitch: 0.6, z: -4.1, w: 0.5, d: 0.34 },
  /** faders de voie : fente de z0 a z1 (plus longue depuis que le crossfader est parti) ; VU a cote */
  fader: { z0: 2.62, z1: 5.0 },
  vu: PORTRAIT ? { dx: 0.42, z0: 0.25, z1: 3.65, n: 15, w: 0.14, d: 0.16 } : { dx: 0.5, z0: -1.45, z1: 1.95, n: 15, w: 0.14, d: 0.16 },
  /** VU du master (deux colonnes) ; raccourci pour PLAY dessous */
  masterVu: PORTRAIT ? { z0: 1.15, z1: 2.5, dx: 0.17 } : { z0: -0.6, z1: 3.55, dx: 0.17 },
  /**
   * PLAY/STOP des machines (2026-10-04, Mika : "un bouton playstop dans le
   * mixer, bien place, pas trop imposant") : sous le VU du master, plus
   * petit que le PLAY d'une platine, son nom (MACHINES : les trois depuis le
   * 2026-10-07) au-dessus
   */
  play: PORTRAIT ? { z: 3.25, r: 0.34, labelZ: 2.8 } : { z: 4.62, r: 0.36, labelZ: 3.98 },
  /** l'en-tete (MIXER), a la hauteur de celui des platines */
  head: { z: -5.19 },
  /**
   * ADD DECK (2026-10-05, Mika : "quand on pose la souris sur le bord du
   * deck B pour voir ce qu'il y a a droite, c'est trop fragile, on clique
   * sans faire expres pour ajouter un deck ; juste pouvoir rajouter un deck
   * a partir du mixer") : dans l'en-tete, a gauche du logotype (la place de
   * LOOP > SMPL, parti le 2026-10-07 avec le MM-SMPL), comme REMOVE DECK sur
   * une platine. dx : son centre depuis le bord droit de la table
   */
  add: PORTRAIT ? { dx: 0, z: 4.12, w: 0.72, d: 0.3 } : { dx: 1.62, z: -5.19, w: 0.72, d: 0.28 },
  /**
   * Au telephone tenu droit, l'en-tete n'a plus la place : ADD DECK descend
   * dans la colonne du MASTER, sous PLAY, son nom au-dessus.
   */
  keysInMaster: PORTRAIT,
};

/** Les colonnes de la table pour n voies (repere du bloc). */
function placeMix(n: number): void {
  const w = mixWidth(n);
  const L = -w / 2;
  if (PORTRAIT) {
    // Tenu droit : les voies a gauche, le MASTER a droite ; les effets en deux rangees de quatre sur toute la largeur
    MIX.cols = Array.from({ length: n }, (_, i) => L + 0.55 + i * MIX_COL);
    MIX.masterX = MIX.cols[n - 1] + 1.41;
    MIX.fxPitch = w / 4;
    MIX.fxX0 = L + w / 8;
    MIX.screen.x = 0;
    MIX.times.x0 = (-(DJ_TIMES.length - 1) * MIX.times.pitch) / 2;
    return;
  }
  const mid = (w - DJ_UNIT.mixW) / 2;
  MIX.cols = Array.from({ length: n }, (_, i) => L + 1.1 + i * MIX_COL);
  MIX.masterX = MIX.cols[n - 1] + 1.7;
  MIX.fxX0 = L + 0.9;
  // Les effets, puis FX TO au bout de la rangee (2026-10-04) : huit places
  MIX.fxPitch = (w - 1.8) / DJ_FX.length;
  MIX.screen.x = L + mid + 2.45;
  MIX.times.x0 = L + mid + 4.82;
}

/* ---------- la platine (repere du bloc) ---------- */

export const DECK = {
  /**
   * L'en-tete (DECK A...) : remonte de 0.14 (2026-10-04, Mika : "remonte un
   * peu le titre DECK A de 10px, c'est trop colle a l'ecran" ; il touchait
   * presque le cadre de l'ecran, a z -4.92) ; la table suit, les titres
   * restent alignes.
   */
  head: { z: -5.19 },
  /**
   * Le logotype de l'en-tete (2026-10-04, Mika : "on ne voit plus le logo
   * type") : l'ecran agrandi montait sous lui (son cadre a z -4.92) ; plus
   * petit que celui de la table et remonte, il reste entier au-dessus.
   */
  logo: { h: 0.32, z: -5.19 },
  /**
   * L'ecran, la moitie haute de la platine (Mika, 2026-10-04 : "trop
   * miniature, on ne voit rien ; je veux un plus grand ecran et voir la
   * playlist a l'interieur de chaque deck, comme un CDJ") : le morceau et
   * ses formes d'onde, ou la liste des morceaux (dj/TrackBrowser.tsx) ;
   * toucher l'ecran passe de l'un a l'autre.
   */
  screen: { x: 0, z: -2.55, w: 5.6, d: 4.5 },
  /**
   * Le sampler : une rangee de quatre sous l'ecran (SMPL, REC DECK, REC MIX,
   * PLAY), a la place des hot cues depuis le 2026-10-07 (dj/layout.ts)
   */
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
  /**
   * REMOVE DECK : sur la derniere platine ajoutee (C ou D), dans l'en-tete,
   * avant le logo ; son nom en orange a gauche, assez grand pour se lire
   * (Mika, 2026-10-04 : il ne le voyait pas), a la place de DIGITAL DECK
   */
  remove: { x: 1.42, z: -5.19, w: 0.72, d: 0.28 },
} as const;

/**
 * L'ecran de la platine, en fractions de sa largeur (u, depuis la gauche)
 * et de sa hauteur (v, depuis le haut) : le morceau en haut (titre,
 * artiste, BPM, Camelot, temps), la forme d'onde fine au milieu, haute
 * (elle defile, la tete de lecture au centre), la piste entiere en bas, et
 * a sa droite la touche WAVE (l'affichage des formes d'onde : 3BAND, RGB,
 * MONO, dj/state.ts DJ_WAVES) et les deux touches du zoom. Seuls le texte,
 * WAVE et le zoom passent par la texture des ecrans (dj/screens.ts) ; les
 * formes d'onde ont leur shader ; la liste des morceaux est une page HTML
 * posee sur l'ecran.
 */
export const DECK_SCREEN = {
  text: 0.22,
  /**
   * La touche BACK (2026-10-08, Mika : "je devrais aussi avoir un bouton
   * retour arriere pour aller choisir une autre track") : a gauche de la
   * bande de texte, toute sa hauteur, jusqu'a u1 ; elle ouvre la liste des
   * morceaux de la platine sans arreter celui qui joue.
   */
  back: { u1: 0.155 },
  detail: { u0: 0.02, u1: 0.98, v0: 0.25, v1: 0.76 },
  overview: { u0: 0.02, u1: 0.71, v0: 0.8, v1: 0.95 },
  wave: { u0: 0.73, u1: 0.845, v0: 0.79, v1: 0.96 },
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
/**
 * Les boutons ronds (CUE, PLAY, PLAY/STOP du mixer), rayon 1 mis a
 * l'echelle : le capuchon (rayon cap, hauteur h), la fente, l'anneau de
 * LED (de ringIn a 1, hauteur ringH) et le gain de sa lumiere.
 */
export const DJ_ROUND = { h: 0.1, cap: 0.8, ringIn: 0.86, ringH: 0.045, glow: 2.2 } as const;
export const DJ_BEZEL = { margin: 0.12, h: 0.02 } as const;

/* Les places au chargement (le nombre retenu), une fois MIX et DJ_FX definis. */
place(decks);
