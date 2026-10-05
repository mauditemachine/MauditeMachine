/**
 * La place et le dessus du MM-SMPL (2026-10-04, Mika : "une machine de
 * travail du sample avec une partie granulaire, rajoute-la dans la liste
 * des machines"). Redessine le 2026-10-05 (Mika : "un petit Elektron
 * Tonverk, mais a mes couleurs, avec les fonctionnalites de samples") : un
 * bloc large et peu profond, la pente et les pieces du MM-DECKS (le coin,
 * le dessus brosse, les potards, les touches en caoutchouc), pose a droite
 * de la table. Le dessus, du fond vers soi (repere top du bloc : x de -6.2
 * a 6.2, z de -3.8 a 3.8) :
 * - l'en-tete : MM-SMPL, SAMPLER / SLICER / GRANULAR, le logotype ;
 * - en haut a gauche l'ecran (le sample, la region, les slices, ce qui
 *   joue) ; a sa droite douze encodeurs en trois rangees, comme les pages
 *   d'une Elektron (SAMPLE, SHAPE, GRAIN : leur nom a gauche, en orange) ;
 * - une rangee de touches de fonction : PLAY, STOP | GRAB A, GRAB B, FILE,
 *   REC | SLICES, MODE, REV, LOOP, SAVE ;
 * - seize touches de trig en ligne, de 1 a 16 de gauche a droite, par
 *   groupes de quatre : les slices (orange pale quand elles en ont une,
 *   or quand elles sonnent).
 * Ce module reste dans le chargement principal (le Stage en a besoin pour
 * cadrer) ; le reste du MM-SMPL arrive a part (state/smplload.ts).
 */

import { DJ_W, DJ_X } from '../dj/theme';
import { PORTRAIT } from '../theme';
import { VOY_BODY, VOY_X } from '../voyager/theme';
import type { SmplKnobId } from './params';

export const SMPL_W = 12.4;
export const SMPL_D = 7.6;
/** Le jour avec la machine de gauche : celui du MM-DECKS avec le MM-ARP. */
const GAP = PORTRAIT ? 1.8 : 2.6;

/** Le centre du MM-SMPL : a droite du MM-DECKS (ou du MM-ARP sans lui) ; suit le nombre de platines. */
export function smplX(withDj: boolean): number {
  const left = withDj ? DJ_X + DJ_W / 2 : VOY_X + VOY_BODY.w / 2;
  return left + GAP + SMPL_W / 2;
}

/** Le cadrage : de face, sa hauteur projetee (moins profond que le MM-DECKS). */
export const SMPL_FRAME = { h: SMPL_D + 0.5, targetY: 1.3 } as const;

/** Les touches de trig : seize en ligne, par groupes de quatre (un jour de plus entre deux groupes). */
const TRIG = { x0: -5.49, pitch: 0.7, group: 0.16, z: 2.36, w: 0.58, d: 0.5, h: 1.15 } as const;

export const SMPL = {
  head: { z: -3.42 },
  logo: { h: 0.3, z: -3.42 },
  /** l'ecran, et dedans : la bande de texte en haut, la forme d'onde dessous (fractions de sa hauteur) */
  screen: { x: -2.68, z: -1.7, w: 6.1, d: 2.62, text: 0.24, wave: { v0: 0.3, v1: 0.95, u0: 0.02, u1: 0.98 } },
  /** les touches de fonction : x de la premiere, pas, jours en plus avant GRAB A et SLICES */
  keys: { z: 0.96, x0: -5.12, pitch: 0.98, gap: 0.22, w: 0.8, d: 0.36 },
  knobs: { xs: [1.42, 2.7, 3.98, 5.26] as readonly number[], zs: [-2.62, -1.52, -0.42] as readonly number[], s: 0.86, nameX: 0.86 },
  trigs: TRIG,
} as const;

/** Les touches de fonction, de gauche a droite (PLAY et STOP en tete, comme une Elektron). */
export type SmplKeyKind = 'play' | 'stop' | 'grabA' | 'grabB' | 'file' | 'rec' | 'slices' | 'mode' | 'rev' | 'loop' | 'save';
export const SMPL_KEYS: readonly { kind: SmplKeyKind; label: string; aria: string }[] = [
  { kind: 'play', label: 'PLAY', aria: 'Play or stop the whole region, or the grain cloud at POSITION' },
  { kind: 'stop', label: 'STOP', aria: 'Stop everything that plays' },
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
/** Les groupes de touches (un filet et un jour entre eux) : transport, sources, le reste. */
export const SMPL_KEY_GROUPS: readonly number[] = [2, 6];

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

/** La place d'une touche de trig (0 a 15 : de 1 a 16, de gauche a droite). */
export function smplPadAt(i: number): { x: number; z: number } {
  return { x: TRIG.x0 + i * TRIG.pitch + Math.floor(i / 4) * TRIG.group, z: TRIG.z };
}

/** La place d'une touche de fonction (un jour de plus apres chaque groupe). */
export const smplKeyAt = (i: number): { x: number; z: number } => ({
  x: SMPL.keys.x0 + i * SMPL.keys.pitch + SMPL_KEY_GROUPS.filter((g) => i >= g).length * SMPL.keys.gap,
  z: SMPL.keys.z,
});
