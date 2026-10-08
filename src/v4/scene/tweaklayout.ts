/**
 * Les donnees des TWEAKS montes sur la carte (2026-10-08) : la zone, les
 * reglages, les groupes, le cartouche, et ce qu'on en deduit sans rien
 * dessiner (le genre d'un reglage, la zone degagee de la carte). Un module
 * sans three : les themes des machines (bass/theme.ts, voyager/theme.ts) y
 * lisent sans tirer la scene. Le dessin : scene/tweakplate.ts.
 */

import { PORTRAIT } from '../theme';

/** La zone des reglages sur la carte : son centre (repere de la carte) et ses cotes (repere droit). */
export interface TweakPlateDims {
  cx: number;
  cz: number;
  w: number;
  d: number;
}

/** Un reglage : un potard, ou un commutateur (ses crans). */
export interface TweakItem {
  /** l'id de sa cible (hotspot) */
  hotspot: string;
  label: string;
  x: number;
  z: number;
  /** commutateur : le nom de chaque position (2 ou 3 : une glissiere ; plus : un selecteur) ; sinon un potard */
  steps?: readonly string[];
  /** la position d'origine, ecrite en orange */
  stepOrange?: number;
  /** les bouts de course d'un potard (0, 10) */
  ends?: readonly [string, string];
  /** le bout de gauche en orange (le reglage d'origine) */
  endOrange?: boolean;
  /** un potard a cran central (TUNE) : un petit repere a midi */
  center?: boolean;
  /** son designateur (VR1, SW1... sinon numerote dans l'ordre) */
  ref?: string;
}

/** Un groupe : un cadre fin de serigraphie et son titre, en haut a gauche. */
export interface TweakGroup {
  title: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** le titre en orange (le groupe principal) */
  accent?: boolean;
}

/** Le cartouche : la machine, TWEAKS, la ligne du dessous, la revision. */
export interface TweakTitle {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  name: string;
  sub: string;
  rev: string;
}

export interface TweakPlateSpec {
  name: string;
  dims: TweakPlateDims;
  items: readonly TweakItem[];
  groups: readonly TweakGroup[];
  title: TweakTitle | null;
  /** la largeur d'une case (les noms s'y tiennent) */
  cellW: number;
}

/**
 * La place des reglages sur la carte (repere de la carte) : le cadre des
 * groupes et du cartouche, avec 0.12 de marge ; aucun composant de decor
 * ne la touche, aucune piste ne la traverse (scene/pcb.ts clear). En
 * portrait, la zone tourne d'un quart de tour par rapport a la carte : ses
 * cotes s'echangent.
 */
export function tweakClearOf(dims: TweakPlateDims, groups: readonly TweakGroup[], title: TweakTitle | null): { x0: number; x1: number; z0: number; z1: number } {
  const boxes = [...groups, ...(title ? [title] : [])];
  const m = 0.12;
  const x0 = Math.min(...boxes.map((b) => b.x0)) - m;
  const x1 = Math.max(...boxes.map((b) => b.x1)) + m;
  const z0 = Math.min(...boxes.map((b) => b.z0)) - m - 0.06;
  const z1 = Math.max(...boxes.map((b) => b.z1)) + m;
  // Repere droit -> carte : desktop tel quel ; portrait (la zone tourne de -90 deg) x carte = cx - z, z carte = cz + x
  if (!PORTRAIT) return { x0: dims.cx + x0, x1: dims.cx + x1, z0: dims.cz + z0, z1: dims.cz + z1 };
  return { x0: dims.cx - z1, x1: dims.cx - z0, z0: dims.cz + x0, z1: dims.cz + x1 };
}

/** Le genre d'un reglage, d'apres ses crans. */
export type TweakKind = 'pot' | 'slide' | 'select' | 'legend';
export function tweakKind(it: Pick<TweakItem, 'steps'>): TweakKind {
  const n = it.steps?.length ?? 0;
  if (n === 0) return 'pot';
  if (n <= 3) return 'slide';
  return n > 5 || (it.steps ?? []).some((s) => s.length > 5) ? 'legend' : 'select';
}

