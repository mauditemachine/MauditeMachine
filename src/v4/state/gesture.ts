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
import { DT2_FACE, DT_GESTURE, FACE_HOLD_MS } from '../theme';
import { focus } from './focus';
import { func } from './func';
import { trk } from './trk';

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

/* ---------------- V.6.0 : l'implementation (lane B4, 2026-11-01) ---------------- */

/*
 * Le comportement, derriere ?face=dt2 seulement (theme.ts DT2_FACE : actions/ n'appelle la couche que la). FUNC et TRK
 * gardent leurs stores d'avant (state/func.ts, state/trk.ts : la face 3D, le boitier et les sondes les lisent deja) ; la
 * couche les lit et leur passe les gestes, sans en changer la loi (FUNC : tenue, gardee pour une touche, verrouillee par
 * deux tapes ; TRK : tenue, gardee jusqu'au choix d'une piste). Toutes les autres touches modificatrices vivent ici :
 * - tenue : tant qu'une main la tient (le pointeur, le doigt, une touche du clavier, le MIDI, le boitier) ;
 * - gardee : lachee avant FACE_HOLD_MS sans avoir servi, elle reste armee armMs (1,5 s) pour la touche suivante ;
 * - un TRIG (step:n) ne se garde qu'apres un appui long (trigHoldMs, 350 ms) : une tape est un pas ; SETTINGS seulement
 *   apres settingsHoldMs (1 s) : sa tape ouvre son menu ;
 * - use : tenue, elle reste (elle a servi, son lacher ne la garde pas) ; gardee, elle s'en va ;
 * - l'ordre d'engagement est retenu (before) : YES puis PAGE n'est pas PAGE puis YES.
 * Aucune minuterie : une garde perimee se lit eteinte (on, state) et s'efface a la lecture suivante.
 */

/** Les delais de la couche (cahier 2.7). */
export const GESTURE_TIMING: Readonly<GestureTiming> = { armMs: DT_GESTURE.pageArmMs, doubleMs: DT_GESTURE.funcDoubleMs, trigHoldMs: 350, settingsHoldMs: 1000 };

interface Own {
  mode: 'held' | 'armed';
  since: number;
  used: boolean;
  holders: string[];
  seq: number;
}

const OFF_HOLDERS: readonly GestureSrc[] = Object.freeze([]) as readonly GestureSrc[];
const own = new Map<ModKey, Own>();
/** l'ordre d'engagement de FUNC et TRK (leurs stores ne le gardent pas) */
const linkSeq = new Map<'func' | 'trk', number>();
let seq = 0;
let changes = 0;
const listeners = new Set<() => void>();
const perfNow = (): number => (typeof performance !== 'undefined' ? performance.now() : 0);
let clock: () => number = perfNow;

function emit(): void {
  changes += 1;
  listeners.forEach((fn) => fn());
}

/** Une garde passee : effacee (sans prevenir : la lecture la voit deja eteinte). */
function fresh(k: ModKey): Own | undefined {
  const e = own.get(k);
  if (e && e.mode === 'armed' && clock() - e.since > GESTURE_TIMING.armMs) {
    own.delete(k);
    return undefined;
  }
  return e;
}

const linked = (k: ModKey): k is 'func' | 'trk' => k === 'func' || k === 'trk';

function linkState(k: 'func' | 'trk'): ModState {
  if (k === 'func') {
    const f = func.get();
    const mode: ModMode = f.mode === 'off' ? 'off' : f.mode === 'held' ? 'held' : f.mode === 'once' ? 'armed' : 'locked';
    return { key: k, mode, since: f.since, used: f.used, holders: f.holders };
  }
  const t = trk.get();
  const mode: ModMode = t.mode === 'off' ? 'off' : t.mode === 'held' ? 'held' : 'armed';
  return { key: k, mode, since: t.since, used: t.used, holders: t.holders };
}

function stateOf(k: ModKey): ModState {
  if (linked(k)) return linkState(k);
  const e = fresh(k);
  if (!e) return { key: k, mode: 'off', since: 0, used: false, holders: OFF_HOLDERS };
  return { key: k, mode: e.mode, since: e.since, used: e.used, holders: [...e.holders] };
}

function seqOf(k: ModKey): number {
  if (linked(k)) return linkSeq.get(k) ?? -1;
  return fresh(k)?.seq ?? -1;
}

/** Le TRIG d'un modificateur step:1 a step:16 (0 a 15) ; sinon null. */
export function stepModIndex(k: ModKey): number | null {
  if (typeof k !== 'string' || !k.startsWith('step:')) return null;
  const n = Number(k.slice(5));
  return Number.isInteger(n) && n >= 1 && n <= 16 ? n - 1 : null;
}

export const gesture: GestureLayer & {
  /** le numero de version de l'etat (les sondes) */
  readonly changes: number;
  /** gardee (tapee, plus tenue) */
  armed(k: ModKey): boolean;
  /** tenue par une main en ce moment */
  held(k: ModKey): boolean;
  /** les tests : l'horloge de la couche (performance.now par defaut, null la rend) */
  setClock(fn: (() => number) | null): void;
} = {
  get(): GestureSnapshot {
    const keys: ModKey[] = [...own.keys(), 'func', 'trk'];
    const mods = keys
      .map((k) => stateOf(k))
      .filter((m) => m.mode !== 'off')
      .sort((a, b) => seqOf(a.key) - seqOf(b.key));
    return { mods, changes };
  },
  state: (k: ModKey): ModState => stateOf(k),
  on: (k: ModKey): boolean => stateOf(k).mode !== 'off',
  armed: (k: ModKey): boolean => stateOf(k).mode === 'armed',
  held: (k: ModKey): boolean => stateOf(k).mode === 'held',
  down(k: ModKey, src: GestureSrc, t: number): void {
    if (k === 'func') {
      func.down(src, t);
      return;
    }
    if (k === 'trk') {
      trk.down(src, t);
      return;
    }
    const e = fresh(k);
    if (e && e.mode === 'held') {
      if (!e.holders.includes(src)) {
        e.holders.push(src);
        emit();
      }
      return;
    }
    // Un appui neuf, ou sur une touche gardee : elle repart tenue, la derniere dans l'ordre
    seq += 1;
    own.set(k, { mode: 'held', since: t, used: false, holders: [src], seq });
    emit();
  },
  up(k: ModKey, src: GestureSrc, t: number): void {
    if (k === 'func') {
      func.up(src, t);
      return;
    }
    if (k === 'trk') {
      trk.up(src, t);
      return;
    }
    const e = own.get(k);
    if (!e || e.mode !== 'held' || !e.holders.includes(src)) return;
    e.holders = e.holders.filter((h) => h !== src);
    if (e.holders.length > 0) {
      emit();
      return;
    }
    const dt = t - e.since;
    const step = stepModIndex(k) !== null;
    // Un TRIG et SETTINGS se gardent apres un appui long sans usage ; les autres apres une tape
    const keep = t >= 0 && !e.used && (step ? dt >= GESTURE_TIMING.trigHoldMs : k === 'settings' ? dt >= GESTURE_TIMING.settingsHoldMs : dt < FACE_HOLD_MS);
    if (keep) {
      e.mode = 'armed';
      e.since = t;
    } else own.delete(k);
    emit();
  },
  use(k: ModKey): void {
    if (k === 'func') {
      func.use();
      return;
    }
    if (k === 'trk') {
      trk.use(clock());
      return;
    }
    const e = fresh(k);
    if (!e) return;
    if (e.mode === 'armed') own.delete(k);
    else if (!e.used) e.used = true;
    else return;
    emit();
  },
  cancel(k?: ModKey): void {
    if (k === undefined) {
      func.cancel();
      trk.cancel();
      if (own.size > 0) {
        own.clear();
        emit();
      }
      return;
    }
    if (k === 'func') func.cancel();
    else if (k === 'trk') trk.cancel();
    else if (own.delete(k)) emit();
  },
  releaseAll(): void {
    func.releaseAll();
    trk.releaseAll();
    let changed = false;
    for (const [k, e] of own) {
      if (e.mode !== 'held') continue;
      own.delete(k);
      changed = true;
    }
    if (changed) emit();
  },
  before(a: ModKey, b: ModKey): boolean | null {
    const sa = stateOf(a).mode !== 'off' ? seqOf(a) : -1;
    const sb = stateOf(b).mode !== 'off' ? seqOf(b) : -1;
    if (sa < 0 || sb < 0) return null;
    return sa < sb;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  get changes(): number {
    return changes;
  },
  setClock(fn: (() => number) | null): void {
    clock = fn ?? perfNow;
  },
};

/** FUNC et TRK : leur ordre d'engagement suit leurs stores (engagee : un numero ; eteinte : aucun). */
function follow(k: 'func' | 'trk', engaged: () => boolean): () => void {
  return () => {
    const on = engaged();
    if (on && !linkSeq.has(k)) {
      seq += 1;
      linkSeq.set(k, seq);
      emit();
    } else if (!on && linkSeq.has(k)) {
      linkSeq.delete(k);
      emit();
    }
  };
}

// La face DT2 seulement : sans le drapeau, la couche n'ecoute rien (la V.5.3 ne la connait pas)
if (DT2_FACE && typeof window !== 'undefined') {
  func.subscribe(follow('func', () => func.engaged()));
  trk.subscribe(follow('trk', () => trk.engaged()));
  // Les mains parties : les tenues s'en vont, les gardes restent ; une autre machine : tout se relache
  window.addEventListener('blur', () => gesture.releaseAll());
  focus.subscribe(() => {
    if (focus.get() !== 'mm808') gesture.cancel();
  });
}
