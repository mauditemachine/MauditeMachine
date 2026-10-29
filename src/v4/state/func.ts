/**
 * FUNC, la touche des fonctions secondaires (V.5.0, 2026-10-29, l'etape D1 de la MM-RYTM facon Digitakt,
 * docs/v4/digitakt-d1-spec.md section 3) : FUNC + une touche fait la fonction imprimee en orange sous elle (FUNC + PLAY :
 * CLEAR, FUNC + REC : COPY...). Une souris ne tient pas deux touches a la fois : la regle de TRK et des scenes
 * (state/holdLatch.ts), avec la double tape de la Digitakt en plus. Pure, sans minuteur :
 * - tenue : momentanee (held), tant qu'on la tient ;
 * - une tape (lachee avant FACE_HOLD_MS sans s'en etre servi) : gardee pour LA touche suivante (once), puis relachee ;
 * - deux tapes rapides (la seconde dans DOUBLE_MS) : gardee (locked) jusqu'a une nouvelle tape ;
 * - Echap ou NO relachent une FUNC gardee (actions.ts) ; la fenetre qui perd le focus lache une FUNC tenue.
 * Plusieurs sources peuvent la tenir (le pointeur, Alt au clavier, le MIDI) : le dernier lacher decide. Au clavier, Alt
 * tenu = FUNC, jamais gardee (son lacher arrive avec t < 0).
 */

import { DT_GESTURE, FACE_HOLD_MS } from '../theme';
import { focus } from './focus';

/** off, tenue (held), gardee pour une touche (once), gardee (locked). */
export type FuncMode = 'off' | 'held' | 'once' | 'locked';

export interface FuncState {
  readonly mode: FuncMode;
  /** l'instant de l'appui (held), de la garde (once : la double tape se mesure de la) */
  readonly since: number;
  /** on s'en est servi pendant la tenue */
  readonly used: boolean;
  /** ce qui la tient : 'ptr:<pointerId>', 'key', 'at', 'midi', 'hw' */
  readonly holders: readonly string[];
}

const OFF: FuncState = Object.freeze({ mode: 'off', since: 0, used: false, holders: Object.freeze([]) as readonly string[] });

let state: FuncState = OFF;
/** les lachers a avaler (l'appui qui a garde ou relache FUNC : son lacher ne fait rien de plus) */
const swallow = new Set<string>();
const listeners = new Set<() => void>();
/** Les changements depuis le chargement (les tests). */
let changes = 0;

function set(next: FuncState): void {
  if (next === state) return;
  state = next;
  changes += 1;
  listeners.forEach((fn) => fn());
}

export const func = {
  get: (): FuncState => state,
  /** FUNC enfoncee (src : 'ptr:<pointerId>', 'key', 'at', 'midi', 'hw'). */
  down(src: string, t: number): void {
    if (state.mode === 'locked') {
      // Une tape sur une FUNC gardee la relache ; son lacher est avale
      swallow.add(src);
      set(OFF);
      return;
    }
    if (state.mode === 'once') {
      swallow.add(src);
      // La deuxieme tape rapide : gardee jusqu'a une nouvelle tape ; plus lente, relachee
      set(t - state.since <= DT_GESTURE.funcDoubleMs ? { mode: 'locked', since: t, used: false, holders: [] } : OFF);
      return;
    }
    if (state.mode === 'held') {
      if (!state.holders.includes(src)) set({ ...state, holders: [...state.holders, src] });
      return;
    }
    swallow.delete(src);
    set({ mode: 'held', since: t, used: false, holders: [src] });
  },
  /** FUNC lachee ; t < 0 : un pointeur perdu, ou Alt au clavier : lachee sans garde. */
  up(src: string, t: number): void {
    if (swallow.delete(src)) return;
    if (state.mode !== 'held' || !state.holders.includes(src)) return;
    const holders = state.holders.filter((h) => h !== src);
    if (holders.length > 0) {
      set({ ...state, holders });
      return;
    }
    if (t >= 0 && !state.used && t - state.since < FACE_HOLD_MS) set({ mode: 'once', since: t, used: false, holders: [] });
    else set(OFF);
  },
  /** Une touche a servi avec FUNC : tenue, elle reste ; gardee pour une touche, relachee ; gardee, elle reste. */
  use(): void {
    if (state.mode === 'held') {
      if (!state.used) set({ ...state, used: true });
      return;
    }
    if (state.mode === 'once') set(OFF);
  },
  /** Echap, NO, une autre machine, la couche demontee : relachee. */
  cancel(): void {
    swallow.clear();
    set(OFF);
  },
  /** La fenetre perd le focus : les mains sont parties ; tenue, relachee ; gardee, elle reste. */
  releaseAll(): void {
    if (state.mode === 'held') set(OFF);
  },
  /** FUNC est-elle engagee (tenue ou gardee) ? */
  engaged: (): boolean => state.mode !== 'off',
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Les tests (__v4.rytm.func). */
  get changes(): number {
    return changes;
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('blur', () => func.releaseAll());
  // Une autre machine : FUNC se relache (comme TRK, state/trk.ts)
  focus.subscribe(() => {
    if (focus.get() !== 'mm808') func.cancel();
  });
}
