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

export const DJ_UNIT = { deckW: 9, mixW: 8.4, d: 11, gap: 0.25 } as const;
/** Largeur de l'ensemble : deux platines, la table, deux jours. */
export const DJ_W = 2 * DJ_UNIT.deckW + DJ_UNIT.mixW + 2 * DJ_UNIT.gap;
/** Coin commun aux trois blocs (hauteurs au-dessus des pieds), biseau des aretes. */
export const DJ_BODY = { feet: 0.12, front: 1.0, back: 1.5, bevel: 0.06 } as const;
/** Pente du dessus (rad) : l'avant descend. */
export const DJ_TILT = Math.atan((DJ_BODY.back - DJ_BODY.front) / DJ_UNIT.d);
/** Centre du dessus, repere du rig. */
export const DJ_TOP_Y = DJ_BODY.feet + (DJ_BODY.front + DJ_BODY.back) / 2;

export type DjUnit = 'a' | 'mix' | 'b';
export type DjDeck = 'a' | 'b';
export const UNIT_X: Readonly<Record<DjUnit, number>> = {
  a: -(DJ_UNIT.mixW / 2 + DJ_UNIT.gap + DJ_UNIT.deckW / 2),
  mix: 0,
  b: DJ_UNIT.mixW / 2 + DJ_UNIT.gap + DJ_UNIT.deckW / 2,
};
export const unitW = (u: DjUnit): number => (u === 'mix' ? DJ_UNIT.mixW : DJ_UNIT.deckW);

/** Place de la troisieme machine : a droite du MM-ARP, le meme jour qu'entre la 808 et lui. */
export const DJ_X = VOY_X + VOY_BODY.w / 2 + (PORTRAIT ? 1.8 : 2.6) + DJ_W / 2;

/**
 * Cadrage : l'ensemble de face (largeur reelle : a l'azimut 45 la
 * projection est a peine plus large), hauteur projetee a la vue d'arrivee
 * (elevation 69), pivot, rayons du cadrage de section, etendue de la
 * camera d'ombre.
 */
export const DJ_FRAME = { fill: 0.92, h: 11.2, targetY: 1.3, radius: { closed: DJ_W / 2 + 0.6, open: DJ_W / 2 + 0.6 }, extent: DJ_W / 2 + 2 } as const;

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

export type DjChannel = 0 | 1 | 2 | 3;
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
 * La table, colonnes : quatre voies (1 et 2 jouent A et B, 3 et 4 libres),
 * puis MASTER. Rangees des potards de voie, du haut vers le bas, libelles
 * au-dessus (Mika, 2026-10-03 : "les titres au-dessus des boutons").
 */
export const MIX = {
  cols: [-3.1, -1.65, -0.2, 1.25] as readonly number[],
  masterX: 2.95,
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
  fxX0: -3.3,
  fxPitch: 1.1,
  sFx: 0.95,
  master: { z: -1.45, s: 1.25 },
  /** ecran des effets et touches de temps */
  screen: { x: -1.75, z: -4.25, w: 3.9, d: 0.95 },
  times: { x0: 0.62, pitch: 0.6, z: -4.1, w: 0.5, d: 0.34 },
  /** faders de voie : fente de z0 a z1 ; VU a cote */
  fader: { z0: 2.62, z1: 4.4 },
  vu: { dx: 0.5, z0: -1.45, z1: 1.95, n: 15, w: 0.14, d: 0.16 },
  /** VU du master (deux colonnes) */
  masterVu: { z0: -0.6, z1: 4.3, dx: 0.17 },
  /** crossfader */
  xfader: { z: 5.0, x0: -1.7, x1: 1.7 },
  /** la touche PLAYLIST, en bas a droite (Mika, 2026-10-04 : comme les EDIT du MM-RYTM et du MM-ARP) */
  playlist: { x: 3.05, z: 5.0, w: 1.15, d: 0.42 },
  head: { z: -5.05 },
} as const;

/* ---------- la platine (repere du bloc) ---------- */

export const DECK = {
  head: { z: -5.05 },
  screen: { x: 0, z: -3.55, w: 8.1, d: 2.0 },
  /** hot cues : une rangee de quatre sous l'ecran, une seule couleur (Mika, 2026-10-03) */
  cues: { xs: [-2.4, -0.8, 0.8, 2.4] as readonly number[], z: -1.95, w: 1.32, d: 0.5 },
  /** le jog : platine noire, bague d'aluminium, ecran rond au centre, anneau de LED */
  jog: { x: 0.15, z: 1.85, ring: 2.55, ringIn: 2.24, ringH: 0.16, platter: 2.2, platterH: 0.3, center: 0.92, ledR: 2.4, leds: 48 },
  /** colonne de gauche : LOAD, les deux touches de bend, CUE et PLAY */
  load: { x: -3.6, z: -0.75, w: 1.45, d: 0.5 },
  bend: { xs: [-3.98, -3.22] as readonly number[], z: 0.42, w: 0.62, d: 0.5 },
  cue: { x: -3.6, z: 2.25, r: 0.56 },
  play: { x: -3.6, z: 3.85, r: 0.56 },
  /** le fader de pitch, a droite du jog ; zero au milieu, LED */
  pitch: { x: 3.75, z0: -0.45, z1: 4.25 },
  /**
   * Le tempo au dixieme de BPM (Mika, 2026-10-04 : "j'ai du mal a arriver
   * vers 123.4, ca saute toujours") : deux petites touches sous le fader,
   * un dixieme par appui, en continu tenues.
   */
  tempo: { xs: [3.45, 4.05] as readonly number[], z: 4.98, w: 0.5, d: 0.34 },
} as const;

/**
 * L'ecran de la platine, en fractions de sa largeur (u, depuis la gauche)
 * et de sa hauteur (v, depuis le haut) : le texte en haut (titre, artiste,
 * BPM, Camelot, temps), la forme d'onde fine au milieu (elle defile, la
 * tete de lecture au centre), la piste entiere en bas, et a sa droite les
 * deux touches du zoom.
 */
export const DECK_SCREEN = {
  text: 0.4,
  detail: { u0: 0.02, u1: 0.98, v0: 0.42, v1: 0.78 },
  overview: { u0: 0.02, u1: 0.84, v0: 0.83, v1: 0.95 },
  zoom: { u0: 0.86, u1: 0.98, v0: 0.81, v1: 0.97 },
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
