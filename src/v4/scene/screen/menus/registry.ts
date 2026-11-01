/**
 * Le registre des menus de l'ecran (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 2.5 et 5.0) : un contrat, sans
 * comportement. Un menu plein ecran de la Digitakt II (x 0..320, y 22..192, l'en-tete garde) = un id et son dessinateur ;
 * chaque lane inscrit les siens depuis son fichier de scene/screen/menus/ (B5 en V.6.0 : MACHINE, TEMPO, QUANTIZE,
 * PRESET/KIT, SOUNDS et SAMPLES, SETTINGS, MIXER et SCENES ; D2 en V.6.2 : preset, kit, naming ; D3 : song, chain ;
 * D4 : settings), et Screen.paint le consultera a partir de V.6.0. Vide en P0 : personne n'y inscrit rien, personne ne
 * le lit, l'ecran ne change pas. Il ne s'exporte pas par scene/screen.ts (ses exports restent ceux d'avant) : l'importer
 * d'ici.
 */

import type { LcdState } from '../../../state/lcd';
import type { PageSlot } from '../../../rytm/pages';
import type { Screen } from '../core';

/** Les menus de la DT2 sans sampling (cahier 2.5 et 3), noms figes ; une lane qui en ajoute un l'ajoute a la fin. */
export type ScreenMenuId =
  | 'machine'
  | 'tempo'
  | 'quantize'
  | 'preset'
  | 'kit'
  | 'sounds'
  | 'samples'
  | 'settings'
  | 'mixer'
  | 'scenes'
  | 'setup'
  | 'pagesetup'
  | 'trigmode'
  | 'kbsetup'
  | 'song'
  | 'songedit'
  | 'chain'
  | 'naming'
  | 'perform'
  | 'midiconfig';

/** Ce qu'un menu recoit pour se dessiner : l'etat de l'ecran (state/lcd.ts) et l'heure de l'image. */
export interface ScreenMenuCtx {
  state: LcdState;
  now: number;
}

/**
 * Une saisie de navigation donnee au menu ouvert (contrat V.6.0, B4 -> B5) : B4 (la face, actions/face.ts) la route vers
 * screenMenu(dtFace.menu) quand un menu est ouvert ; B5 l'implemente dans chaque menu. data : LEVEL/DATA tourne de delta
 * crans (signe : vers la droite, vers le bas de la liste). func : FUNC tenue ou gardee au moment de la saisie (FUNC +
 * UP/DOWN = une page de liste, FUNC + YES = pre-ecoute...). Les potards A a H restent a B5 (actions/dials).
 */
export type ScreenMenuInputKind = 'up' | 'down' | 'left' | 'right' | 'yes' | 'no' | 'data';
export interface ScreenMenuInput {
  kind: ScreenMenuInputKind;
  /** data seulement : les crans */
  delta?: number;
  func: boolean;
  /** 'down' : l'appui ; 'up' : le relacher (YES et NO agissent au relacher sur la touche, comme en D1) */
  phase: 'down' | 'up';
}

export interface ScreenMenu {
  id: ScreenMenuId;
  /** la lane qui le possede (cahier 5.1 a 5.3) : un seul proprietaire par menu */
  owner: string;
  /** dessine le menu sur la toile de l'ecran ; rend dans combien de ms il faut une autre image (0 : aucune) */
  paint: (screen: Screen, ctx: ScreenMenuCtx) => number;
  /** les zones du menu (lignes, panneaux), pour la saisie et les sondes ; vide si le menu n'en a pas */
  zones?: (screen: Screen) => readonly { id: string; x0: number; y0: number; x1: number; y1: number }[];
  /**
   * La saisie de navigation (contrat V.6.0) : true si le menu l'a prise. NO non pris = B4 ferme le menu (dtFace.menu a
   * null) ; une fleche non prise ne fait rien. Absent : le menu ne se navigue pas (B4 ne lui envoie rien, NO le ferme).
   */
  onInput?: (input: ScreenMenuInput) => boolean;
  /*
   * V.6.0 (lane B5, 2026-11-01), des ajouts facultatifs au contrat, aucun nom d'avant ne change :
   */
  /** le titre de l'en-tete, a la place du nom du pattern (TEMPO, MACHINE, SETTINGS > PATTERN) */
  title?: () => string;
  /**
   * ses huit potards A a H, comme une page (le bloc k est le potard k, sa case k) : l'ecran les dessine dans la grille, les
   * potards de la face, le MIDI rytm:knob et les jumeaux les reglent (actions/kit.ts curSlots) ; null : pas de potards
   */
  slots?: () => readonly PageSlot[] | null;
  /** un potard presse (clic sans glisser, B4 l'envoie par actions screenKnobPress) : true s'il l'a pris */
  knobPress?: (k: number) => boolean;
  /** dtFace.menu vient de passer a lui (ou de le quitter) : son curseur repart, ce qu'il garde se pose ou se rend */
  onOpen?: () => void;
  onClose?: () => void;
  /** ce qu'il montre, en une ligne (les sondes, le jumeau) */
  info?: () => string;
  /** le nombre de ses sous-pages et celle affichee (l'indicateur de droite) ; absent : aucune */
  pages?: () => { n: number; cur: number };
}

/*
 * Les reglages des menus et des 16 pistes (V.6.0, lane B5) : un DialId neuf (t:<reglage> la piste active, k:<piste> le TRK
 * LEV d'une piste, z:<id> un reglage d'un menu) se lit et s'ecrit par sa fiche, que le menu ou actions/kit.ts inscrit ;
 * actions/anyDial.ts la consulte avant tout le reste (un id inconnu ne tombe jamais dans le chemin des FX globaux).
 */
export interface DialSpec {
  /** ce que montre le bloc et ce que lit le potard (dans ses unites) */
  value: () => number;
  /** ecrit (dans ses unites, borne par l'appelant) */
  set: (v: number) => void;
  range: () => readonly [number, number];
  /** ses crans (0 : continu) */
  steps: () => number;
  text: (v: number) => string;
  unit: (v: number) => string;
  /** le depart (le double clic, potard presse + NO) ; absent : rien */
  reset?: () => number;
  /** false : rien a regler maintenant (pas de piste, un reglage a venir) : le bloc dit -- */
  live?: () => boolean;
  /** le message du pied apres un geste (T1 LEV 102  -1.2 DB) ; absent : NOM VALEUR UNITE */
  say?: (v: number) => string;
}

const SPECS = new Map<string, DialSpec>();
const PREFIXES: { prefix: string; of: (id: string) => DialSpec | null }[] = [];

/** Inscrit la fiche d'un reglage (un id exact). */
export function registerDialSpec(id: string, spec: DialSpec): void {
  SPECS.set(id, spec);
}

/** Inscrit un resolveur de fiches pour un prefixe (t:, k:). */
export function registerDialPrefix(prefix: string, of: (id: string) => DialSpec | null): void {
  PREFIXES.push({ prefix, of });
}

/** La fiche d'un reglage neuf (V.6.0) ; null : un DialId d'avant (son chemin de toujours). */
export function dialSpecOf(id: string): DialSpec | null {
  const s = SPECS.get(id);
  if (s) return s;
  for (const p of PREFIXES) if (id.startsWith(p.prefix)) return p.of(id);
  return null;
}

/** Un DialId neuf de V.6.0 (t:, k:, z:) ? Meme sans fiche : il ne doit jamais tomber dans un chemin d'avant. */
export const isDialV60 = (id: string): boolean => id.startsWith('t:') || id.startsWith('k:') || id.startsWith('z:');

const MENUS = new Map<ScreenMenuId, ScreenMenu>();

/** Inscrit un menu (une fois par id : un doublon est une erreur de lane, pas un remplacement). */
export function registerScreenMenu(menu: ScreenMenu): void {
  if (MENUS.has(menu.id)) throw new Error(`menu d'ecran deja inscrit : ${menu.id}`);
  MENUS.set(menu.id, menu);
}

/** Le menu d'un id, undefined s'il n'est pas (encore) inscrit. */
export function screenMenu(id: ScreenMenuId): ScreenMenu | undefined {
  return MENUS.get(id);
}

/** Les menus inscrits, dans l'ordre d'inscription (les sondes). */
export function screenMenus(): readonly ScreenMenu[] {
  return [...MENUS.values()];
}
