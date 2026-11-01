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
}

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
