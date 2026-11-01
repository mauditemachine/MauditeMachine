/**
 * window.__v4 (?debug=1), la part de la lane B4 SAISIE ET TOUCHES en V.6.0 (gestes, accords, jumeaux, clavier). Vide en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) :
 * la lane ajoute ici ses champs (l'interface et leurs valeurs, des accesseurs au besoin), jamais dans debug/index.ts ;
 * installDebug les copie sur window.__v4.
 *
 * V.6.0 (2026-11-01, la lane B4) : __v4.input, pour les sondes muettes de la face DT2 (?face=dt2) : la couche de gestes,
 * la table des accords (l'accord que ferait un geste, ceux partis, leur compte), les saisies routees aux menus, les indices
 * des gestes qui changent de place, la piste active, FILL, et les entrees de la face (appui, lacher, tape, LEVEL/DATA).
 * Rien ne joue un son de plus : ce sont les memes chemins que la souris (les sondes tournent sous ?mute=1, --mute-audio).
 */

import { dataTurn, editGridToggle, faceKeyDown, faceKeyTap, faceKeyUp, mainVolumeTurn } from '../actions';
import { CHORDS } from '../actions/chords';
import { chordCount, chordFor, chordLog, hintLog, menuLog } from '../actions/internal/keys60';
import { CHORDS_60, HINT_GESTURES } from '../actions/chords/chords60';
import { dtFace } from '../state/dtFace';
import { editor } from '../state/editor';
import { fill } from '../state/fill';
import { gesture } from '../state/gesture';
import { activeTrack } from '../state/trk';
import { voices } from '../state/voices';
import { DT2_FACE } from '../theme';
import type { DebugSource } from './index';

export interface InputLaneDebug {
  readonly input: {
    /** la face DT2 est-elle la (?face=dt2) */
    readonly dt2: boolean;
    gesture: typeof gesture;
    /** la table entiere (toutes les lanes) et celle de 6.0 */
    readonly chords: typeof CHORDS;
    readonly chords60: typeof CHORDS_60;
    chordFor: typeof chordFor;
    readonly chordLog: typeof chordLog;
    readonly chordCount: Record<string, number>;
    readonly menuLog: typeof menuLog;
    readonly hintLog: typeof hintLog;
    readonly hintGestures: typeof HINT_GESTURES;
    activeTrack: typeof activeTrack;
    fill: typeof fill;
    dtFace: typeof dtFace;
    editor: typeof editor;
    voices: typeof voices;
    keyDown: typeof faceKeyDown;
    keyUp: typeof faceKeyUp;
    keyTap: typeof faceKeyTap;
    dataTurn: typeof dataTurn;
    mainVolumeTurn: typeof mainVolumeTurn;
    editGrid: typeof editGridToggle;
  };
}

export function inputLane(src: DebugSource): InputLaneDebug {
  void src;
  return {
    input: {
      dt2: DT2_FACE,
      gesture,
      chords: CHORDS,
      chords60: CHORDS_60,
      chordFor,
      chordLog,
      get chordCount() {
        return Object.fromEntries(chordCount);
      },
      menuLog,
      hintLog,
      hintGestures: HINT_GESTURES,
      activeTrack,
      fill,
      dtFace,
      editor,
      voices,
      keyDown: faceKeyDown,
      keyUp: faceKeyUp,
      keyTap: faceKeyTap,
      dataTurn,
      mainVolumeTurn,
      editGrid: editGridToggle,
    },
  };
}
