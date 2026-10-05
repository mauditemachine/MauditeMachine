/**
 * Le code du MM-SMPL, charge a part (2026-10-04), comme celui du MM-DECKS
 * (state/djload.ts) : il arrive apres le chargement principal, en un seul
 * chargement, partage par la scene (scene/renderer.ts), la couche de
 * saisie (ui/Hotspots.tsx), le verrou de lecture et le debug ; avec
 * ?smpl=0, jamais. smpl/theme.ts (sa place, son cadrage) reste dans le
 * chargement principal.
 */

import { SMPL } from './focus';

export interface SmplModules {
  SmplRig: typeof import('../smpl/rig').SmplRig;
  SmplGestures: typeof import('../smpl/gestures').SmplGestures;
  smplState: typeof import('../smpl/state').smplState;
  smplEngine: typeof import('../smpl/engine').smplEngine;
  /** la sequence (state/playLock.ts : elle joue, le son ne dort pas onglet cache) */
  smplSeq: typeof import('../smpl/seq').smplSeq;
  /** GRAB : la boucle (ou la fenetre) d'une platine, LOOP > SMPL du mixer aussi */
  smplGrab: typeof import('../smpl/actions').smplGrab;
}

let mods: SmplModules | null = null;
let pending: Promise<SmplModules> | null = null;
const listeners = new Set<() => void>();

export const smplLoad = {
  /** Les modules, une fois arrives (null avant, et toujours avec ?smpl=0). */
  get: (): SmplModules | null => mods,
  /** Le chargement (une fois) ; null avec ?smpl=0. */
  load(): Promise<SmplModules> | null {
    if (!SMPL) return null;
    // smpl/midi : ses cibles MIDI s'inscrivent (midi/targets.ts, 2026-10-05)
    pending ??= Promise.all([import('../smpl/rig'), import('../smpl/gestures'), import('../smpl/state'), import('../smpl/engine'), import('../smpl/actions'), import('../smpl/seq'), import('../smpl/midi')]).then(([rig, gestures, state, engine, actions, seq]) => {
      mods = { SmplRig: rig.SmplRig, SmplGestures: gestures.SmplGestures, smplState: state.smplState, smplEngine: engine.smplEngine, smplSeq: seq.smplSeq, smplGrab: actions.smplGrab };
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
