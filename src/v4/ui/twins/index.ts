/** Les jumeaux des lanes, dans un ORDRE FIGE (P0, cahier dt2 5.5) : face60, input60, screen60, phone60, v61, v62. */

import type React from 'react';
import type { LaneTwins, TwinAnchor, TwinCtx } from './types';
import { TWINS_FACE60 } from './face60';
import { TWINS_INPUT60 } from './input60';
import { TWINS_SCREEN60 } from './screen60';
import { TWINS_PHONE60 } from './phone60';
import { TWINS_V61 } from './v61';
import { TWINS_V62 } from './v62';

export type { LaneTwins, TwinAnchor, TwinCtx } from './types';

const LANES: readonly LaneTwins[] = [TWINS_FACE60, TWINS_INPUT60, TWINS_SCREEN60, TWINS_PHONE60, TWINS_V61, TWINS_V62];

/** Les jumeaux des lanes a une place, dans l'ordre (vide en P0 : React ne rend rien). */
export function laneTwins(anchor: TwinAnchor, ctx: TwinCtx): React.ReactElement[] {
  return LANES.flatMap((l) => [...(l.at[anchor]?.(ctx) ?? [])]);
}
