/**
 * La couche de gestes unique de la face DT2 : le CONTRAT (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 2.7). Une
 * interface, sans comportement : personne ne l'importe en P0. B4 l'implemente en V.6.0 (elle generalise state/func.ts,
 * state/holdLatch.ts et le pageArm de actions/face.ts), C4 l'etend en V.6.1, sans changer un nom d'ici.
 *
 * Toute touche modificatrice a trois etats : tenue (une vraie tenue au pointeur, au doigt, au clavier, au MIDI) ; gardee
 * (tapee : gardee pour la touche suivante pendant DT_GESTURE.pageArmMs, 1,5 s) ; FUNC seule garde aussi la double tape =
 * verrouillee. NO ou Echap relachent. L'ordre compte, comme sur la DT2 : YES gardee puis PAGE = FILL un cycle ; PAGE
 * gardee puis YES = FILL verrouille ; la validation au relacher de FUNC se fait au relacher reel ou a la tape suivante.
 */

import type { Dt2ButtonId } from '../rytm/dtFaceIds';

/** Un modificateur : une touche de la face DT2, ou un TRIG (step:1 a step:16 ; appui long 350 ms = tenu et garde). */
export type ModKey = Dt2ButtonId | `step:${number}`;

/** off ; held : tenue ; armed : tapee, gardee pour la touche suivante ; locked : verrouillee (FUNC, double tape). */
export type ModMode = 'off' | 'held' | 'armed' | 'locked';

/** Ce qui tient la touche : 'ptr:<pointerId>', 'key', 'midi', 'hw', 'at' (comme state/func.ts). */
export type GestureSrc = string;

export interface ModState {
  readonly key: ModKey;
  readonly mode: ModMode;
  /** l'instant de l'appui (held), de la garde (armed : sa fin se mesure de la) */
  readonly since: number;
  /** une autre touche s'en est servie pendant la tenue ou la garde */
  readonly used: boolean;
  readonly holders: readonly GestureSrc[];
}

/** Un instantane : les modificateurs engages, dans l'ordre ou ils l'ont ete (l'ordre compte). */
export interface GestureSnapshot {
  readonly mods: readonly ModState[];
  /** le numero de version de l'etat (les sondes, comme func.changes) */
  readonly changes: number;
}

export interface GestureTiming {
  /** la garde d'une touche tapee (DT_GESTURE.pageArmMs, 1500 ms) */
  armMs: number;
  /** la double tape de FUNC (DT_GESTURE.funcDoubleMs) */
  doubleMs: number;
  /** l'appui long d'un TRIG qui le tient et le garde (350 ms, comme le P-LOCK d'aujourd'hui) */
  trigHoldMs: number;
  /** la tenue de SETTINGS (1 s) */
  settingsHoldMs: number;
}

export interface GestureLayer {
  get(): GestureSnapshot;
  state(k: ModKey): ModState;
  /** engagee (tenue ou gardee) */
  on(k: ModKey): boolean;
  down(k: ModKey, src: GestureSrc, t: number): void;
  /** t < 0 : un pointeur perdu, lachee sans garde */
  up(k: ModKey, src: GestureSrc, t: number): void;
  /** une touche a servi avec k : tenue, elle reste ; gardee, relachee ; verrouillee, elle reste */
  use(k: ModKey): void;
  /** NO, Echap, une autre machine : relache k (ou tout) */
  cancel(k?: ModKey): void;
  /** la fenetre perd le focus : les tenues s'en vont, les gardes et les verrous restent */
  releaseAll(): void;
  /** l'ordre d'engagement de deux modificateurs (DT2 : YES puis PAGE n'est pas PAGE puis YES) ; null si l'un manque */
  before(a: ModKey, b: ModKey): boolean | null;
  subscribe(fn: () => void): () => void;
}
