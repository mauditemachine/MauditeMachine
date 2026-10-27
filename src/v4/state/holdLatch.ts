/**
 * Une touche a tenir ou a taper (2026-10-27, la phase 2 du MM-RYTM V.4.0 : TRK, SCENE A et SCENE B) : pure, sans minuteur
 * ni image, lue par state/trk.ts et state/sceneCtl.ts. Tenir = momentane (la touche agit tant qu'on la tient) ; taper
 * (lacher avant tapMs sans s'en etre servi) = garde (latched) jusqu'a la tape suivante, Echap, ou l'usage :
 * - onUse 'close' (TRK) : un usage ferme la touche gardee apres closeMs (la vue reste le temps d'une deuxieme tape) ;
 * - onUse 'stay' (les scenes) : elle reste gardee.
 * La meme regle pour une souris (un seul pointeur ne peut pas tenir TRK et cliquer un pas : une tape garde), un ecran
 * tactile (la garde "jusqu'au choix d'une voix" du telephone), le clavier, le MIDI et la touche du boitier ; un ecran
 * multitouch a la tenue de la Digitakt en plus. Plusieurs sources peuvent tenir la touche (le doigt et la touche Espace) :
 * le dernier lacher decide.
 */

export type HoldMode = 'off' | 'held' | 'latched' | 'closing';

export interface HoldState {
  readonly mode: HoldMode;
  /** l'instant de l'appui (held), de la garde (latched) ou du dernier usage (closing) */
  readonly since: number;
  /** on s'en est servi pendant la tenue ou la garde */
  readonly used: boolean;
  /** ce qui la tient : 'ptr:<pointerId>', 'key', 'at' (un clic d'assistance), 'midi', 'hw' */
  readonly holders: readonly string[];
}

export interface HoldLatch {
  get(): HoldState;
  /** un appui ; src : 'ptr:<pointerId>' | 'key' | 'at' | 'midi' | 'hw' */
  down(src: string, t: number): void;
  /** un lacher ; t < 0 : un pointeur perdu, lache sans garde */
  up(src: string, t: number): void;
  /** on s'en est servi (une voix choisie, une valeur de scene ecrite) */
  use(t: number): void;
  /** Echap, le focus ailleurs, la couche demontee : eteinte */
  cancel(): void;
  /** la fenetre perd le focus : les mains sont parties ; tenue -> eteinte, gardee -> reste */
  releaseAll(): void;
  /** le temps de la fermeture est passe -> eteinte */
  tick(t: number): void;
  /** allumee (tenue, gardee ou en fermeture) */
  engaged(): boolean;
  subscribe(fn: () => void): () => void;
}

const OFF: HoldState = Object.freeze({ mode: 'off', since: 0, used: false, holders: Object.freeze([]) as readonly string[] });

export function holdLatch(o: { tapMs: number; onUse: 'close' | 'stay'; closeMs?: number }): HoldLatch {
  let state: HoldState = OFF;
  /** les lachers a avaler (un appui sur une touche gardee l'a eteinte : son lacher ne la rallume pas) */
  const swallow = new Set<string>();
  const listeners = new Set<() => void>();
  const set = (next: HoldState): void => {
    if (next === state) return;
    state = next;
    listeners.forEach((fn) => fn());
  };
  return {
    get: () => state,
    down(src, t) {
      if (state.mode === 'latched' || state.mode === 'closing') {
        // Une tape sur une touche gardee l'eteint ; son lacher est avale
        swallow.add(src);
        set(OFF);
        return;
      }
      if (state.mode === 'held') {
        if (!state.holders.includes(src)) set({ ...state, holders: [...state.holders, src] });
        return;
      }
      swallow.delete(src);
      set({ mode: 'held', since: t, used: false, holders: [src] });
    },
    up(src, t) {
      if (swallow.delete(src)) return;
      if (state.mode !== 'held' || !state.holders.includes(src)) return;
      const holders = state.holders.filter((h) => h !== src);
      if (holders.length > 0) {
        set({ ...state, holders });
        return;
      }
      if (t >= 0 && !state.used && t - state.since < o.tapMs) set({ mode: 'latched', since: t, used: false, holders: [] });
      else set(OFF);
    },
    use(t) {
      if (state.mode === 'held') {
        if (!state.used) set({ ...state, used: true });
        return;
      }
      if (state.mode === 'latched') {
        if (o.onUse === 'close') set({ mode: 'closing', since: t, used: true, holders: [] });
        else if (!state.used) set({ ...state, used: true });
        return;
      }
      if (state.mode === 'closing') set({ ...state, since: t });
    },
    cancel() {
      swallow.clear();
      set(OFF);
    },
    releaseAll() {
      if (state.mode === 'held') set(OFF);
    },
    tick(t) {
      if (state.mode === 'closing' && t >= state.since + (o.closeMs ?? 0)) set(OFF);
    },
    engaged: () => state.mode !== 'off',
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
