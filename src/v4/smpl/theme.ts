/**
 * La place et le dessus du MM-SMPL (2026-10-04, Mika : "une machine de
 * travail du sample avec une partie granulaire, rajoute-la dans la liste
 * des machines"). Un bloc de la famille du MM-DECKS (le meme coin, le meme
 * dessus, les memes potards et touches), pose a droite de la table, de
 * SMPL_W de large. Le dessus, du fond vers soi (repere top du bloc : x de
 * -4.2 a 4.2, z de -5.5 a 5.5) :
 * - l'en-tete : MM-SMPL, SAMPLER / SLICER / GRANULAR, le logotype ;
 * - l'ecran : le sample entier, la region, les slices, ce qui joue ;
 * - une rangee de touches : GRAB A, GRAB B, FILE, REC | SLICES, MODE, REV,
 *   LOOP, SAVE ;
 * - a gauche, douze potards en trois rangees (SAMPLE, SHAPE, GRAIN) et
 *   PLAY ; a droite, seize pads (1 en bas a gauche, comme une MPC).
 * Ce module reste dans le chargement principal (le Stage en a besoin pour
 * cadrer) ; le reste du MM-SMPL arrive a part (state/smplload.ts).
 */

import { DJ_UNIT, DJ_W, DJ_X } from '../dj/theme';
import { PORTRAIT } from '../theme';
import { VOY_BODY, VOY_X } from '../voyager/theme';
import type { SmplKnobId } from './params';

export const SMPL_W = 8.4;
export const SMPL_D = DJ_UNIT.d;
/** Le jour avec la machine de gauche : celui du MM-DECKS avec le MM-ARP. */
const GAP = PORTRAIT ? 1.8 : 2.6;

/** Le centre du MM-SMPL : a droite du MM-DECKS (ou du MM-ARP sans lui) ; suit le nombre de platines. */
export function smplX(withDj: boolean): number {
  const left = withDj ? DJ_X + DJ_W / 2 : VOY_X + VOY_BODY.w / 2;
  return left + GAP + SMPL_W / 2;
}

/** Le cadrage : de face, sa hauteur projetee comme le MM-DECKS. */
export const SMPL_FRAME = { h: 11.2, targetY: 1.3 } as const;

export const SMPL = {
  head: { z: -5.19 },
  logo: { h: 0.32, z: -5.19 },
  /** l'ecran, et dedans : la bande de texte en haut, la forme d'onde dessous (fractions de sa hauteur) */
  screen: { x: 0, z: -3.05, w: 7.7, d: 3.3, text: 0.24, wave: { v0: 0.3, v1: 0.95, u0: 0.02, u1: 0.98 } },
  keys: { z: -0.78, x0: -3.44, pitch: 0.86, w: 0.7, d: 0.36 },
  knobs: { xs: [-3.35, -2.45, -1.55, -0.65] as readonly number[], zs: [0.62, 1.97, 3.32] as readonly number[], s: 0.95 },
  pads: { xs: [0.5, 1.45, 2.4, 3.35] as readonly number[], zs: [3.6, 2.65, 1.7, 0.75] as readonly number[], size: 0.84, h: 1.5 },
  play: { x: -2.9, z: 4.55, r: 0.4 },
} as const;

/** Les touches de la rangee, de gauche a droite. */
export type SmplKeyKind = 'grabA' | 'grabB' | 'file' | 'rec' | 'slices' | 'mode' | 'rev' | 'loop' | 'save';
export const SMPL_KEYS: readonly { kind: SmplKeyKind; label: string; aria: string }[] = [
  { kind: 'grabA', label: 'GRAB A', aria: 'Grab the zoomed window or the loop of deck A' },
  { kind: 'grabB', label: 'GRAB B', aria: 'Grab the zoomed window or the loop of deck B' },
  { kind: 'file', label: 'FILE', aria: 'Load an audio file' },
  { kind: 'rec', label: 'REC', aria: 'Record the site output, press again to stop' },
  { kind: 'slices', label: 'SLICES', aria: 'Slices: 4, 8, 16 or auto (the hits)' },
  { kind: 'mode', label: 'MODE', aria: 'Mode: slice or grain' },
  { kind: 'rev', label: 'REV', aria: 'Reverse' },
  { kind: 'loop', label: 'LOOP', aria: 'Loop while a pad is held' },
  { kind: 'save', label: 'SAVE', aria: 'Save the region as a WAV file' },
];

/** Les potards, rangee par rangee (SAMPLE, SHAPE, GRAIN). */
export const SMPL_KNOB_ROWS: readonly (readonly SmplKnobId[])[] = [
  ['start', 'end', 'pitch', 'level'],
  ['attack', 'release', 'filter', 'spread'],
  ['position', 'size', 'density', 'spray'],
];
export const SMPL_ROW_NAMES = ['SAMPLE', 'SHAPE', 'GRAIN'] as const;

/** La place d'un potard (repere top du bloc). */
export function smplKnobAt(id: SmplKnobId): { x: number; z: number } {
  for (let r = 0; r < SMPL_KNOB_ROWS.length; r += 1) {
    const c = SMPL_KNOB_ROWS[r].indexOf(id);
    if (c >= 0) return { x: SMPL.knobs.xs[c], z: SMPL.knobs.zs[r] };
  }
  return { x: 0, z: 0 };
}

/** La place d'un pad (0 a 15 : 1 en bas a gauche, 16 en haut a droite). */
export function smplPadAt(i: number): { x: number; z: number } {
  return { x: SMPL.pads.xs[i % 4], z: SMPL.pads.zs[Math.floor(i / 4)] };
}

/** La place d'une touche de la rangee. */
export const smplKeyAt = (i: number): { x: number; z: number } => ({ x: SMPL.keys.x0 + i * SMPL.keys.pitch, z: SMPL.keys.z });
