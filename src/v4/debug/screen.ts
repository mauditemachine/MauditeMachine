/**
 * window.__v4 (?debug=1), la part de la lane B5 ECRAN ET MENUS en V.6.0 (gabarit DT2 de l'ecran, menus, pages SRC). Vide en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) :
 * la lane ajoute ici ses champs (l'interface et leurs valeurs, des accesseurs au besoin), jamais dans debug/index.ts ;
 * installDebug les copie sur window.__v4.
 */

import type { DebugSource } from './index';

export interface ScreenLaneDebug {}

export function screenLane(_src: DebugSource): ScreenLaneDebug {
  return {};
}
