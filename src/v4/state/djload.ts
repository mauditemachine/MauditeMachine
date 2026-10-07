/**
 * Le code du MM-DECKS, charge a part (2026-10-04, l'accueil de Deck) : il
 * arrive apres le chargement principal (la page s'affiche sans l'attendre),
 * en un seul chargement, partage par la scene (scene/renderer.ts), la
 * couche de saisie (ui/Hotspots.tsx) et le debug ; avec ?dj=0, jamais.
 * Les petits modules (dj/theme, dj/view : places, cadrage, bloc au
 * telephone) restent dans le chargement principal.
 */

import { DJ } from './focus';

export interface DjModules {
  DjRig: typeof import('../dj/rig').DjRig;
  DjGestures: typeof import('../dj/gestures').DjGestures;
  djState: typeof import('../dj/state').djState;
  djEngineIfAny: typeof import('../dj/engine').djEngineIfAny;
  /** le sampler d'une platine sonne (2026-10-07 : le verrou de lecture, le son qui ne dort pas) */
  samplersSounding: typeof import('../sampler/sampler').samplersSounding;
  /** le sampler d'une platine (le debug, les tests) */
  samplerOf: typeof import('../sampler/sampler').samplerOf;
}

let mods: DjModules | null = null;
let pending: Promise<DjModules> | null = null;
const listeners = new Set<() => void>();

export const djLoad = {
  /** Les modules, une fois arrives (null avant, et toujours avec ?dj=0). */
  get: (): DjModules | null => mods,
  /** Le chargement (une fois) ; null avec ?dj=0. */
  load(): Promise<DjModules> | null {
    if (!DJ) return null;
    // dj/midi : ses cibles MIDI s'inscrivent (midi/targets.ts, 2026-10-05)
    pending ??= Promise.all([import('../dj/rig'), import('../dj/gestures'), import('../dj/state'), import('../dj/engine'), import('../sampler/sampler'), import('../dj/midi')]).then(([rig, gestures, state, engine, sampler]) => {
      mods = { DjRig: rig.DjRig, DjGestures: gestures.DjGestures, djState: state.djState, djEngineIfAny: engine.djEngineIfAny, samplersSounding: sampler.samplersSounding, samplerOf: sampler.samplerOf };
      listeners.forEach((fn) => fn());
      return mods;
    });
    return pending;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
