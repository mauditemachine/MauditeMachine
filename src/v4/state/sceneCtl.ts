/**
 * Le crossfader et les touches SCENE A et B (2026-10-27, la phase 2) : l'etat du moment, jamais garde (une visite commence
 * a x = 0, cote A, aucune scene armee). x de 0 (A) a 1 (B) : des variables du module, hors de tout instantane React (un
 * glisser a 60 Hz ne rerend rien) ; onX previent a chaque valeur (le morphing, le renderer, le jumeau). L'armement : deux
 * touches a tenir ou a taper (state/holdLatch.ts onUse 'stay' : une scene gardee reste gardee pendant qu'on tourne), la
 * derniere enfoncee gagne ; get() ne change qu'avec l'armement. Une autre machine ou la couche de saisie demontee
 * desarment ; la fenetre qui perd le focus lache une tenue (une scene gardee reste).
 */

import { FACE_HOLD_MS } from '../theme';
import type { SceneId } from '../rytm/sceneData';
import type { CtlSrc } from './ctl';
import { focus } from './focus';
import { holdLatch, type HoldLatch } from './holdLatch';

export interface SceneArm {
  readonly armed: SceneId | null;
  readonly how: 'held' | 'latched' | null;
}

const latches: Readonly<Record<SceneId, HoldLatch>> = {
  a: holdLatch({ tapMs: FACE_HOLD_MS, onUse: 'stay' }),
  b: holdLatch({ tapMs: FACE_HOLD_MS, onUse: 'stay' }),
};

let x = 0;
let rest = 0;
let moving = false;
let movedBy: CtlSrc = 'ui';
const xListeners = new Set<(x: number, src: CtlSrc) => void>();
const gestureListeners = new Set<(on: boolean, src: CtlSrc) => void>();
const armListeners = new Set<() => void>();
let arm: SceneArm = Object.freeze({ armed: null, how: null });
/** les changements de x depuis le chargement (les tests) */
const stats = { sets: 0, gestures: 0 };

function readArm(): SceneArm {
  for (const w of ['a', 'b'] as const) {
    const m = latches[w].get().mode;
    if (m === 'held') return { armed: w, how: 'held' };
    if (m === 'latched' || m === 'closing') return { armed: w, how: 'latched' };
  }
  return { armed: null, how: null };
}

function syncArm(): void {
  const next = readArm();
  if (next.armed === arm.armed && next.how === arm.how) return;
  arm = Object.freeze(next);
  armListeners.forEach((fn) => fn());
}
latches.a.subscribe(syncArm);
latches.b.subscribe(syncArm);

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export const sceneCtl = {
  /** l'armement (une scene tenue ou gardee) : un nouvel objet seulement quand il change */
  get: (): SceneArm => arm,
  subscribe(fn: () => void): () => void {
    armListeners.add(fn);
    return () => {
      armListeners.delete(fn);
    };
  },
  /** la touche d'une scene (le jumeau HoldTwin, aria-pressed) */
  latch: (w: SceneId): HoldLatch => latches[w],
  x: (): number => x,
  /** x a la fin du dernier geste */
  rest: (): number => rest,
  /** un geste du crossfader en cours */
  moving: (): boolean => moving,
  /** qui a pose x en dernier */
  by: (): CtlSrc => movedBy,
  onX(fn: (x: number, src: CtlSrc) => void): () => void {
    xListeners.add(fn);
    return () => {
      xListeners.delete(fn);
    };
  },
  onGesture(fn: (on: boolean, src: CtlSrc) => void): () => void {
    gestureListeners.add(fn);
    return () => {
      gestureListeners.delete(fn);
    };
  },
  /** x borne a 0..1 ; rien si rien ne change */
  setX(v: number, src: CtlSrc): void {
    const n = clamp01(v);
    if (n === x) return;
    x = n;
    movedBy = src;
    stats.sets += 1;
    xListeners.forEach((fn) => fn(x, src));
  },
  /** le debut et la fin d'un geste (la fin : x au repos, le reglage qui attend le repos s'applique) */
  gesture(on: boolean, src: CtlSrc): void {
    if (on === moving) return;
    moving = on;
    if (!on) rest = x;
    stats.gestures += 1;
    gestureListeners.forEach((fn) => fn(on, src));
  },
  /** une touche SCENE enfoncee ; l'autre scene armee se desarme (la derniere enfoncee gagne) */
  armDown(w: SceneId, src: string, t: number): void {
    const o: SceneId = w === 'a' ? 'b' : 'a';
    if (latches[o].engaged()) latches[o].cancel();
    latches[w].down(src, t);
  },
  armUp(w: SceneId, src: string, t: number): void {
    latches[w].up(src, t);
  },
  /** une valeur ecrite dans la scene armee (une tenue qui a servi ne se garde pas) */
  use(t: number): void {
    for (const w of ['a', 'b'] as const) if (latches[w].engaged()) latches[w].use(t);
  },
  /** Echap, une autre machine, le P-LOCK fixe, CLEAR de la scene : plus rien d'arme */
  cancel(): void {
    latches.a.cancel();
    latches.b.cancel();
  },
  stats,
  /** les tests : x a 0, rien d'arme, pas de geste */
  reset(): void {
    latches.a.cancel();
    latches.b.cancel();
    moving = false;
    rest = 0;
    if (x !== 0) {
      x = 0;
      xListeners.forEach((fn) => fn(0, 'ui'));
    }
  },
};

if (typeof window !== 'undefined') {
  focus.subscribe(() => {
    if (focus.get() !== 'mm808') sceneCtl.cancel();
  });
  window.addEventListener('blur', () => {
    latches.a.releaseAll();
    latches.b.releaseAll();
  });
}
