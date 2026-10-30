/**
 * window.__v4 (?debug=1), la part de la lane B1 MOTEUR en V.6.0 (les 16 pistes, tracks, shots par piste, plafond de sources, rendus hors ligne a 16). Vide en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) :
 * la lane ajoute ici ses champs (l'interface et leurs valeurs, des accesseurs au besoin), jamais dans debug/index.ts ;
 * installDebug les copie sur window.__v4.
 *
 * V.5.9 (2026-10-30, le moteur a 16 pistes, invisible) : __v4.tracks, le store des 16 pistes (audio/tracks.ts : get, of,
 * param, set, setMany, machine, sample, voice, mix, replace, swap, subscribe, tweak, sig, engine, vfx, info...) ; et
 * __v4.tracks16, ce que les sondes lisent en plus (les cles, la migration pure, les formes stockees, les vues d'avant des
 * facades, les tranches et le plafond de sources : __v4.audio.tracks16). Rien d'ici n'a de commande visible.
 */

import type { DebugSource } from './index';
import { LEGACY_KEYS, TRACKS_KEY, TRACK_KEYS, kit16FromLegacy, kit16FromStored, kit16ToStored, sameKit16, tracks, tracksLegacy } from '../audio/tracks';
import { ensure } from '../audio/drums';
import { clock } from '../audio/clock';
import { FLAGS } from '../state/flags';

/** Les sondes seulement, sous ?mute=1&debug=1 (MASTER a 0 pour toute la page : rien ne sort des enceintes). */
const muted = (what: string): void => {
  if (!FLAGS.mute || !FLAGS.debug) throw new Error(`${what}: ?mute=1&debug=1 only`);
};

export interface AudioLaneDebug {
  /** le store des 16 pistes (V.5.9) */
  readonly tracks: typeof tracks;
  /** ce que les sondes des 16 pistes lisent (V.5.9) */
  readonly tracks16: {
    readonly keys: typeof TRACK_KEYS;
    readonly legacyKeys: typeof LEGACY_KEYS;
    readonly storageKey: typeof TRACKS_KEY;
    readonly kit16FromLegacy: typeof kit16FromLegacy;
    readonly toStored: typeof kit16ToStored;
    readonly fromStored: typeof kit16FromStored;
    readonly same: typeof sameKit16;
    /** les vues d'avant que lisent les facades kit et voiceFx (pistes 1 a 8) */
    readonly legacy: typeof tracksLegacy.kit;
    readonly legacyVoices: typeof tracksLegacy.voices;
    /** le contexte audio d'un geste (les sondes du graphe vivant : ses tranches) ; MASTER a 0, aucun coup */
    ctx(): boolean;
    /** RUN et STOP de l'horloge (les sondes de la re-programmation par piste), MASTER a 0 */
    run(on: boolean): boolean;
  };
}

export function audioLane(_src: DebugSource): AudioLaneDebug {
  return {
    tracks,
    tracks16: {
      keys: TRACK_KEYS,
      legacyKeys: LEGACY_KEYS,
      storageKey: TRACKS_KEY,
      kit16FromLegacy,
      toStored: kit16ToStored,
      fromStored: kit16FromStored,
      same: sameKit16,
      legacy: tracksLegacy.kit,
      legacyVoices: tracksLegacy.voices,
      ctx(): boolean {
        muted('tracks16.ctx');
        return ensure() !== undefined;
      },
      run(on: boolean): boolean {
        muted('tracks16.run');
        if (on) return clock.start();
        clock.stop();
        return false;
      },
    },
  };
}
