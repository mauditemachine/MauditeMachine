/**
 * window.__v4 (?debug=1), la part de la lane B3 FACE 3D en V.6.0 (faceplate, touches par classe, LED de page, cadres). Vide en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) :
 * la lane ajoute ici ses champs (l'interface et leurs valeurs, des accesseurs au besoin), jamais dans debug/index.ts ;
 * installDebug les copie sur window.__v4.
 */

import type { DebugSource } from './index';

export interface FaceLaneDebug {}

export function faceLane(_src: DebugSource): FaceLaneDebug {
  return {};
}
