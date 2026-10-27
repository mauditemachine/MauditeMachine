/**
 * Les pictogrammes des douze touches du MM-RYTM V.4.0 (2026-10-27, Mika :
 * "pas de texte sur les boutons ; des pictogrammes Tabler outline ou les
 * tiens, trait de 1.75") : des traces SVG dans une boite de 24 (ICON_VIEWBOX),
 * traits ronds de ICON_STROKE. L'atlas des touches (scene/keyLabels.ts) les
 * peint avec Path2D, le repli sans WebGL et les jumeaux peuvent les reprendre
 * tels quels ; plus tard l'export SVG de la face aussi. Des donnees seules.
 *
 * Source : Tabler Icons, la serie outline 3.48.0 (le paquet npm
 * @tabler/icons, fichiers icons/outline/<nom>.svg), sans le carre vide
 * M0 0h24v24H0z de chaque fichier. Deux sont dessines pour Mika : FLTR (la
 * courbe d'un passe-bas) et ENV (une enveloppe ADSR). dice-5 a ses cinq
 * points pleins (fills : traces ET remplis, comme le fill currentColor de
 * Tabler). La licence MIT de Tabler, recopiee telle quelle :
 *
 * MIT License
 *
 * Copyright (c) 2020-2026 Paweł Kuna
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { FpIconId } from './faceplate';

/** La boite des traces (24 x 24) et l'epaisseur du trait (Mika : 1.75). */
export const ICON_VIEWBOX = 24;
export const ICON_STROKE = 1.75;

export interface RytmIcon {
  /** les traces, chacune tracee */
  readonly paths: readonly string[];
  /** les traces tracees et remplies (les points de dice-5) */
  readonly fills?: readonly string[];
}

export const RYTM_ICONS: Readonly<Record<FpIconId, RytmIcon>> = {
  // TRK
  'stack-2': { paths: ['M12 4l-8 4l8 4l8 -4l-8 -4', 'M4 12l8 4l8 -4', 'M4 16l8 4l8 -4'] },
  // VOICE
  'wave-sine': {
    paths: ['M21 12h-2c-.894 0 -1.662 -.857 -1.761 -2c-.296 -3.45 -.749 -6 -2.749 -6s-2.5 3.582 -2.5 8s-.5 8 -2.5 8s-2.452 -2.547 -2.749 -6c-.1 -1.147 -.867 -2 -1.763 -2h-2'],
  },
  // FLTR : un passe-bas, a plat puis la pente (Mika)
  lowpass: { paths: ['M3 8H12C16 8 17 12 21 18'] },
  // ENV : attaque, decay, sustain, release (Mika)
  adsr: { paths: ['M3 19L7 5L11 11H16L21 19'] },
  // FX
  sparkles: {
    paths: ['M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6'],
  },
  // EDIT
  'layout-grid': {
    paths: [
      'M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4',
      'M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4',
      'M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4',
      'M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4',
    ],
  },
  // OPEN
  'folder-open': {
    paths: ['M5 19l2.757 -7.351a1 1 0 0 1 .936 -.649h12.307a1 1 0 0 1 .986 1.164l-.996 5.211a2 2 0 0 1 -1.964 1.625h-14.026a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v2'],
  },
  // RUN/STOP a l'arret
  'player-play': { paths: ['M7 4v16l13 -8l-13 -8'] },
  // RUN/STOP pendant la lecture
  'player-stop': { paths: ['M5 7a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -10'] },
  // CLEAR
  eraser: { paths: ['M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3', 'M18 13.3l-6.3 -6.3'] },
  // RANDOM
  'dice-5': {
    paths: ['M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14'],
    fills: [
      'M8 8.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0',
      'M15 8.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0',
      'M15 15.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0',
      'M8 15.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0',
      'M11.5 12a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0',
    ],
  },
  // MUTE
  'volume-off': {
    paths: [
      'M15 8a5 5 0 0 1 1.912 4.934m-1.377 2.602a5 5 0 0 1 -.535 .464',
      'M17.7 5a9 9 0 0 1 2.362 11.086m-1.676 2.299a9 9 0 0 1 -.686 .615',
      'M9.069 5.054l.431 -.554a.8 .8 0 0 1 1.5 .5v2m0 4v8a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l1.294 -1.664',
      'M3 3l18 18',
    ],
  },
  // SOLO
  headphones: {
    paths: [
      'M4 15a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2l0 -3',
      'M15 15a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2l0 -3',
      'M4 15v-3a8 8 0 0 1 16 0v3',
    ],
  },
};
