/**
 * Le code du MM-BASS, charge a part (2026-10-07), comme celui du MM-DECKS
 * (state/djload.ts) : il arrive apres le chargement principal, en un seul
 * chargement, partage par la scene (scene/renderer.ts), la couche de
 * saisie (ui/Hotspots.tsx), le verrou de lecture et le debug ; avec
 * ?bass=0, jamais. bass/theme.ts (sa place, son cadrage) reste dans le
 * chargement principal.
 */

import { BASS } from './focus';

export interface BassModules {
  BassRig: typeof import('../bass/rig').BassRig;
  BassGestures: typeof import('../bass/gestures').BassGestures;
  bassState: typeof import('../bass/state').bassState;
  bassParams: typeof import('../bass/params').bassParams;
  bassEngine: typeof import('../bass/engine').bassEngine;
  /** la sequence (state/playLock.ts : elle joue, la vue se pose, le son ne dort pas) */
  bassSeq: typeof import('../bass/seq').bassSeq;
  /** la basse s'arrete (une piste du site qui part) */
  bassStop: typeof import('../bass/actions').bassStop;
}

let mods: BassModules | null = null;
let pending: Promise<BassModules> | null = null;
const listeners = new Set<() => void>();

export const bassLoad = {
  /** Les modules, une fois arrives (null avant, et toujours avec ?bass=0). */
  get: (): BassModules | null => mods,
  /** Le chargement (une fois) ; null avec ?bass=0. */
  load(): Promise<BassModules> | null {
    if (!BASS) return null;
    // bass/midi : ses cibles MIDI s'inscrivent (midi/targets.ts)
    pending ??= Promise.all([import('../bass/rig'), import('../bass/gestures'), import('../bass/state'), import('../bass/params'), import('../bass/engine'), import('../bass/seq'), import('../bass/actions'), import('../bass/midi')]).then(([rig, gestures, state, params, engine, seq, actions]) => {
      mods = { BassRig: rig.BassRig, BassGestures: gestures.BassGestures, bassState: state.bassState, bassParams: params.bassParams, bassEngine: engine.bassEngine, bassSeq: seq.bassSeq, bassStop: actions.bassStop };
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
