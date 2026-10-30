/** Les cibles MIDI (midi/targets.ts, decoupe en P0 le 2026-10-30, cahier dt2 5.0) : leurs types. */

import { type SceneTag } from '../../rytm/sceneParams';
import { type MachineId } from '../../state/focus';

export type TargetScope = MachineId | 'global';

export interface MidiTarget {
  id: string;
  /** la machine qui le porte ; global : la navigation */
  scope: TargetScope;
  /** son nom (le panneau MIDI) */
  label: string;
  /** value : un parametre ; press : une action au premier appui ; hold : appui puis relachement */
  kind: 'value' | 'press' | 'hold';
  /** valeur de 0 a 1 */
  get?: () => number;
  set?: (v: number) => void;
  /** crans (0 : continu) */
  steps?: number;
  /**
   * page : un potard de page (rytm:knob:1-8, 2026-10-08) ; ce qu'il regle,
   * sa course et ses crans suivent la page affichee (le catalogue MIDI le dit
   * au lieu de figer les crans de la page de depart)
   */
  follows?: 'page';
  /**
   * Les scenes A et B (2026-10-27, la phase 2, rytm/sceneParams.ts) : la classe d'une cible qui se morphe (ramp, worklet,
   * notch, settle, hit, pitch, heavy), ou son role (passthrough, noscene, resolved) ; absent hors du MM-RYTM
   */
  scene?: SceneTag;
  /**
   * Une touche tenue de la phase 3 (2026-10-27, rytm:trk, rytm:scene:a et b ; la spec de Mika : "valeur > 0 enfonce, 0
   * lache") : nonzero, un CC enfonce des 1 (sinon au-dessus de 63, comme avant) ; une note : enfoncee, lachee
   */
  gate?: 'nonzero';
  down?: () => void;
  up?: () => void;
}
