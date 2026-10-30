/**
 * La face Digitakt II du MM-RYTM : le CONTRAT des ids (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 2.2 et 2.6). Des
 * noms figes et des tables, sans comportement : personne ne l'importe en P0. B3 (la face 3D), B4 (la saisie) et B6 (le
 * MIDI, le boitier) codent contre lui en V.6.0 ; FpButtonId (rytm/faceplate.ts) s'elargira a Dt2ButtonId, la liste de
 * HotspotKind (scene/hit.ts) a Dt2ZoneKind, sans changer un nom d'ici.
 */

import type { FpButtonId } from './faceplate';

/** La classe d'une touche (2.2) : P petite 12 x 11, L large 22 x 11, G PAGE 26 x 11 (mm). Les TRIG (22 x 19) sont des pas. */
export type Dt2KeyClass = 'P' | 'L' | 'G';

/**
 * Toutes les touches de la face DT2 (hors les 16 TRIG et les potards), dans l'ordre de lecture de la face (colonne de
 * gauche, menus et transport, page, YES/NO et fleches). Ordre FIGE : l'ordre de tabulation des jumeaux en derive.
 * cx, cy : le centre en mm sur la face de Mika (grille A, 2.2), func : la fonction orange (FUNC +), '' : aucune.
 */
export const DT2_BUTTONS = [
  { id: 'func', cls: 'L', cx: 19, cy: 83.5, legend: 'FUNC', func: '' },
  { id: 'kbd', cls: 'P', cx: 19, cy: 99.5, legend: 'KEYBOARD', func: 'KB SETUP' },
  { id: 'trk', cls: 'L', cx: 19, cy: 115, legend: 'TRK', func: 'MUTE MODE' },
  { id: 'ptn', cls: 'L', cx: 19, cy: 129.7, legend: 'PTN', func: 'BANK' },
  { id: 'song', cls: 'L', cx: 19, cy: 144.4, legend: 'SONG', func: 'SONG EDIT' },
  { id: 'preset', cls: 'P', cx: 52, cy: 83.5, legend: 'PRESET', func: 'PERFORM' },
  { id: 'settings', cls: 'P', cx: 75.5, cy: 83.5, legend: 'SETTINGS', func: 'SAVE PROJ' },
  { id: 'sounds', cls: 'P', cx: 99, cy: 83.5, legend: 'SOUNDS', func: 'SAMPLES' },
  { id: 'tempo', cls: 'P', cx: 122.5, cy: 83.5, legend: 'TEMPO', func: 'TAP TEMPO' },
  { id: 'rec', cls: 'L', cx: 56.5, cy: 99.5, legend: 'REC', func: 'COPY' },
  { id: 'play', cls: 'L', cx: 87, cy: 99.5, legend: 'PLAY', func: 'CLEAR' },
  { id: 'stop', cls: 'L', cx: 117.5, cy: 99.5, legend: 'STOP', func: 'PASTE' },
  { id: 'trig', cls: 'P', cx: 150, cy: 66.5, legend: 'TRIG', func: 'QUANTIZE' },
  { id: 'src', cls: 'P', cx: 168.4, cy: 66.5, legend: 'SRC', func: 'MACHINE' },
  { id: 'fltr', cls: 'P', cx: 186.8, cy: 66.5, legend: 'FLTR', func: 'SETUP' },
  { id: 'amp', cls: 'P', cx: 205.2, cy: 66.5, legend: 'AMP', func: 'SEQUENCER' },
  { id: 'fx', cls: 'P', cx: 223.6, cy: 66.5, legend: 'FX', func: 'SEND FX' },
  { id: 'mod', cls: 'P', cx: 242, cy: 66.5, legend: 'MOD', func: 'MIXER' },
  { id: 'yes', cls: 'P', cx: 150, cy: 83.5, legend: 'YES', func: 'SAVE' },
  { id: 'up', cls: 'P', cx: 186.8, cy: 83.5, legend: 'UP', func: 'TRIG MODE' },
  { id: 'no', cls: 'P', cx: 150, cy: 99.5, legend: 'NO', func: 'RELOAD' },
  { id: 'left', cls: 'P', cx: 168.4, cy: 99.5, legend: 'LEFT', func: 'uTIME-' },
  { id: 'down', cls: 'P', cx: 186.8, cy: 99.5, legend: 'DOWN', func: 'TRIG MODE' },
  { id: 'right', cls: 'P', cx: 205.2, cy: 99.5, legend: 'RIGHT', func: 'uTIME+' },
  { id: 'ptnpage', cls: 'G', cx: 235, cy: 99.5, legend: 'PAGE', func: 'FILL/SETUP' },
] as const satisfies readonly { id: string; cls: Dt2KeyClass; cx: number; cy: number; legend: string; func: string }[];
export type Dt2ButtonId = (typeof DT2_BUTTONS)[number]['id'];

/** Les touches d'aujourd'hui (V.5.3) sont toutes dans la liste DT2 : une verification de type, sans code. */
export type FpButtonsKept = [FpButtonId] extends [Dt2ButtonId] ? true : never;
const FP_BUTTONS_KEPT: FpButtonsKept = true;
void FP_BUTTONS_KEPT;

/** Les deux potards de la colonne gauche (2.2) : MAIN VOLUME (d 20) et LEVEL/DATA (d 22). */
export const DT2_SIDE_KNOBS = [
  { id: 'mvol', cx: 19, cy: 19, d: 20, legend: 'MAIN VOLUME', func: '' },
  { id: 'data', cx: 19, cy: 45, d: 22, legend: 'LEVEL/DATA', func: 'PRESET POOL' },
] as const;

/**
 * Les ids de zones gardes (2.6) : MIDI LEARN, INFOS, les sondes et faceHold s'y referent. pkey-<page>, penc-0 a penc-7,
 * step-1 a step-16 : un par touche de page, potard de page, pas.
 */
export const KEPT_ZONE_IDS = ['func', 'trk', 'pad-edit', 'rec', 'run', 'stop', 'pkey-*', 'yes', 'no', 'pad-open', 'penc-0..7', 'step-1..16'] as const;

/**
 * Les kinds des zones nouvelles (2.6). page est pris (les pads du site) et rytm:page aussi (la valeur de page) : la
 * touche PAGE prend la zone ptnpage, le kind pagekey. data est un kind nouveau, relatif (un encodeur sans butee).
 */
export type Dt2ZoneKind = 'encoder' | 'data' | 'kbd' | 'song' | 'preset' | 'settings' | 'sounds' | 'tempo' | 'arrow' | 'pagekey';

/**
 * Les zones nouvelles de la face DT2 (2.6), leur kind, leur cible MIDI (a la fin du groupe RYTM, midi/targets/face60.ts)
 * et la note ou le CC propose du boitier MMHW v2 (a confirmer avec protocol.js quand Mika le pousse). dir : la fleche.
 */
export const DT2_ZONES = [
  { id: 'mvol', kind: 'encoder', param: 'level', midi: ['rytm:enc:level'], hw: 'CC 29' },
  { id: 'data', kind: 'data', midi: ['rytm:data'], hw: 'CC 38' },
  { id: 'kbd', kind: 'kbd', midi: ['rytm:keyboard'], hw: 'note 74' },
  { id: 'song', kind: 'song', midi: ['rytm:song'], hw: 'note 75' },
  { id: 'preset', kind: 'preset', midi: ['rytm:preset'], hw: 'note 76' },
  { id: 'settings', kind: 'settings', midi: ['rytm:settings'], hw: 'note 77' },
  { id: 'sounds', kind: 'sounds', midi: ['rytm:sounds'], hw: 'note 78' },
  { id: 'tempo', kind: 'tempo', midi: ['rytm:screen:tempo', 'rytm:tap'], hw: 'note 81' },
  { id: 'up', kind: 'arrow', dir: 'up', midi: ['rytm:up'], hw: 'note 82' },
  { id: 'down', kind: 'arrow', dir: 'down', midi: ['rytm:down'], hw: 'note 83' },
  { id: 'left', kind: 'arrow', dir: 'left', midi: ['rytm:left'], hw: 'note 84' },
  { id: 'right', kind: 'arrow', dir: 'right', midi: ['rytm:right'], hw: 'note 85' },
  { id: 'ptnpage', kind: 'pagekey', midi: ['rytm:ptnpage', 'rytm:fill'], hw: 'note 86' },
] as const satisfies readonly { id: string; kind: Dt2ZoneKind; midi: readonly string[]; hw: string; dir?: 'up' | 'down' | 'left' | 'right'; param?: string }[];
export type Dt2ZoneId = (typeof DT2_ZONES)[number]['id'];

/** Les 8 LED de page n'ont pas de zone : leur etat est lu par __v4.stage.faceKeys.info() et le snapshot du boitier. */
export const PAGE_LEDS = 8;
