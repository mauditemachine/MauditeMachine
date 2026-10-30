/**
 * Le registre des zones de la scene (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0 et critique C3.7) : les zones
 * (hotspots) qu'une lane ajoute a la face sans ecrire dans scene/renderer.ts, et leur infobulle sans ecrire dans
 * theme/face.ts FACE_TITLE. Un fichier par lane (scene/zones/*.ts), l'ordre fige dans scene/zones/index.ts ; le renderer
 * les ajoute juste apres les touches de la face (l'ordre de la liste est l'ordre de tabulation des jumeaux). Vide en P0 :
 * le renderer n'ajoute rien, rien ne change.
 */

import type { Object3D } from 'three';
import type { HotspotDef } from '../hit';

/** Ce qu'une lane recoit pour placer ses zones : le calque du plateau de la face du MM-RYTM. */
export interface ZoneCtx {
  plateau: Object3D;
}

export interface LaneZones {
  /** les zones de la lane, dans leur ordre de tabulation (vide : aucune) */
  build(ctx: ZoneCtx): readonly HotspotDef[];
  /** l'infobulle de ses zones au desktop (id -> texte), lue quand FACE_TITLE n'en a pas */
  titles?: Readonly<Record<string, string>>;
}
