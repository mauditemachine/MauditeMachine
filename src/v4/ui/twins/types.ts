/**
 * Le registre des jumeaux HTML (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0 et critique C3.7) : les jumeaux
 * qu'une lane ajoute au desktop sans ecrire dans ui/Hotspots.tsx, a une place fixe de l'ordre de tabulation (l'ordre de
 * lecture de la face). Un fichier par lane (ui/twins/*.ts), l'ordre fige dans ui/twins/index.ts. Vide en P0 : Hotspots
 * n'ajoute rien au DOM, rien ne change.
 */

import type React from 'react';
import type { Stage } from '../../scene/renderer';

/**
 * Les places dans l'ordre de tabulation du desktop : screen (apres les zones de l'ecran), knobs (apres les huit potards),
 * keys (apres YES et NO, la rangee des touches), steps (apres les seize pas).
 */
export type TwinAnchor = 'screen' | 'knobs' | 'keys' | 'steps';

/** Ce qu'une lane recoit pour rendre ses jumeaux : le Stage et le crochet qui inscrit un jumeau (data-hotspot). */
export interface TwinCtx {
  stage: Stage | null;
  refFor: (id: string) => (el: HTMLElement | null) => void;
}

export interface LaneTwins {
  /** ses jumeaux par place (des elements avec une key) ; une place absente : aucun */
  at: Partial<Record<TwinAnchor, (ctx: TwinCtx) => readonly React.ReactElement[]>>;
}
