/**
 * window.__v4 (?debug=1), la part de la lane B4 SAISIE ET TOUCHES en V.6.0 (gestes, accords, jumeaux, clavier). Vide en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) :
 * la lane ajoute ici ses champs (l'interface et leurs valeurs, des accesseurs au besoin), jamais dans debug/index.ts ;
 * installDebug les copie sur window.__v4.
 */

import type { DebugSource } from './index';

export interface InputLaneDebug {}

export function inputLane(_src: DebugSource): InputLaneDebug {
  return {};
}
