/**
 * window.__v4 (?debug=1), la part de la lane B1 MOTEUR en V.6.0 (les 16 pistes, tracks, shots par piste, plafond de sources, rendus hors ligne a 16). Vide en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) :
 * la lane ajoute ici ses champs (l'interface et leurs valeurs, des accesseurs au besoin), jamais dans debug/index.ts ;
 * installDebug les copie sur window.__v4.
 */

import type { DebugSource } from './index';

export interface AudioLaneDebug {}

export function audioLane(_src: DebugSource): AudioLaneDebug {
  return {};
}
