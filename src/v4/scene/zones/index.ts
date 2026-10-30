/** Les zones des lanes, dans un ORDRE FIGE (P0, cahier dt2 5.5) : face60, input60, screen60, phone60, v61, v62. */

import type { HotspotDef } from '../hit';
import type { LaneZones, ZoneCtx } from './types';
import { ZONES_FACE60 } from './face60';
import { ZONES_INPUT60 } from './input60';
import { ZONES_SCREEN60 } from './screen60';
import { ZONES_PHONE60 } from './phone60';
import { ZONES_V61 } from './v61';
import { ZONES_V62 } from './v62';

export type { LaneZones, ZoneCtx } from './types';

const LANES: readonly LaneZones[] = [ZONES_FACE60, ZONES_INPUT60, ZONES_SCREEN60, ZONES_PHONE60, ZONES_V61, ZONES_V62];

/** Les zones de toutes les lanes, dans l'ordre (vide en P0). */
export function laneZones(ctx: ZoneCtx): HotspotDef[] {
  return LANES.flatMap((l) => [...l.build(ctx)]);
}

/** L'infobulle d'une zone de lane (undefined : aucune). */
export function laneZoneTitle(id: string): string | undefined {
  for (const l of LANES) {
    const t = l.titles?.[id];
    if (t) return t;
  }
  return undefined;
}
