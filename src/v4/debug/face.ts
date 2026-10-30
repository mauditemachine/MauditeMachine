/**
 * window.__v4 (?debug=1), la part de la lane B3 FACE 3D en V.6.0 (faceplate, touches par classe, LED de page, cadres). Vide en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) :
 * la lane ajoute ici ses champs (l'interface et leurs valeurs, des accesseurs au besoin), jamais dans debug/index.ts ;
 * installDebug les copie sur window.__v4.
 *
 * V.6.0 (2026-10-30, la lane B3) : le drapeau de la face DT2 (?face=dt2), le controle de la grille (le meme que npm run
 * face:test), MAIN VOLUME et LEVEL/DATA, et la projection d'un point de la face (mm) a l'ecran, pour la sonde qui compare
 * la place projetee de chaque zone a la grille du cahier (2.2). Les touches, leurs looks et les LED de page :
 * __v4.stage.faceKeys.info() (ou __v4.face).
 */

import { dt2FaceplateCheck, faceplateCheck, fpU, fpX, fpZ } from '../rytm/faceplate';
import type { SideKnobsInfo } from '../scene/sideKnobs';
import { DT2_FACE } from '../theme';
import type { DebugSource } from './index';

export interface FaceLaneDebug {
  /** la face DT2 est-elle dessinee (?face=dt2, au desktop) */
  readonly dt2Face: boolean;
  /** les problemes de la face dessinee ([] attendu : rytm/faceplate.ts faceplateCheck, ou dt2FaceplateCheck) */
  readonly faceCheck: string[];
  /** MAIN VOLUME et LEVEL/DATA (null sur la face de la V.5.3) */
  readonly sideKnobs: SideKnobsInfo | null;
  /** le point (x, y) de la face en mm, a h mm au-dessus d'elle, projete a l'ecran (px CSS du canvas) ; null sans scene */
  projectFace(xMm: number, yMm: number, hMm?: number): { x: number; y: number } | null;
}

export function faceLane(src: DebugSource): FaceLaneDebug {
  return {
    get dt2Face() {
      return DT2_FACE;
    },
    get faceCheck() {
      return DT2_FACE ? dt2FaceplateCheck() : faceplateCheck();
    },
    get sideKnobs() {
      return src.stage()?.sideKnobs?.info() ?? null;
    },
    projectFace(xMm: number, yMm: number, hMm = 0) {
      const st = src.stage();
      if (!st) return null;
      const p = st.projectPlateau(fpX(xMm), fpU(hMm), fpZ(yMm));
      return { x: +p.x.toFixed(2), y: +p.y.toFixed(2) };
    },
  };
}
