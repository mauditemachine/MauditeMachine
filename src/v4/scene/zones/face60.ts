/**
 * Les zones de la scene de la lane B3 FACE 3D (V.6.0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 2.6) : celles des
 * commandes nouvelles de la face DT2 (?face=dt2, theme.ts DT2_FACE), a leur place (theme.ts FACE_KEYS, SIDE_KNOBS) :
 * MAIN VOLUME (mvol, kind encoder param level : le glisser, la molette et la double tape d'un encodeur le tournent deja, la
 * cible MIDI rytm:enc:level aussi), LEVEL/DATA (data), puis les onze touches dans l'ordre de lecture de la face
 * (rytm/dtFaceIds.ts DT2_BUTTONS) : kbd song preset settings sounds tempo up left down right ptnpage. Leurs ids et leurs
 * kinds sont ceux du contrat P0 (DT2_ZONES) ; les fleches portent leur dir. Les touches de la V.5.3 (func trk pad-edit
 * rec run stop pkey-* yes no) et le logo M (pad-open) gardent leurs zones, a leur nouvelle place, dans
 * scene/rytmFaceKeys.ts hotspots().
 *
 * Tant que la lane B4 ne les a pas branchees, les zones nouvelles ne font rien (ui/Hotspots.tsx ne connait pas leurs
 * kinds : une tape n'y trouve aucune action, aucune erreur ; theme.ts FACE_INERT leur garde la fleche) ; seule mvol
 * tourne deja le niveau general. Rien sur la face de la V.5.3 ni au telephone : build rend [].
 */

import { DT2_ZONES, type Dt2ZoneKind } from '../../rytm/dtFaceIds';
import { DT2_FACE, FACE_KEY, FACE_KEYS, SIDE_KNOBS, type EncId } from '../../theme';
import type { HotspotDef, HotspotKind } from '../hit';
import type { LaneZones } from './types';

/**
 * Une zone de la face DT2 : un HotspotDef, sa fleche en plus (dir, le contrat Dt2ZoneKind arrow). Le kind est un
 * Dt2ZoneKind : la lane B4 elargit scene/hit.ts HotspotKind a ces kinds (P0 ne l'a pas fait, sans comportement) ; d'ici
 * la, la conversion ci-dessous est la seule.
 */
export type Dt2ZoneDef = HotspotDef & { dir?: 'up' | 'down' | 'left' | 'right'; dt2Kind: Dt2ZoneKind };

const asKind = (k: Dt2ZoneKind): HotspotKind => k as HotspotKind;

/** Les zones des commandes nouvelles de la face DT2, dans l'ordre de lecture (theme.ts SIDE_KNOBS puis FACE_KEYS). */
export function dt2Zones(layer: HotspotDef['layer']): Dt2ZoneDef[] {
  if (!DT2_FACE) return [];
  const out: Dt2ZoneDef[] = [];
  for (const s of SIDE_KNOBS) {
    const z = DT2_ZONES.find((d) => d.id === s.id);
    if (!z) continue;
    const param = 'param' in z ? (z.param as EncId) : undefined;
    out.push({ id: s.id, kind: asKind(z.kind), dt2Kind: z.kind, layer, shape: 'disc', x: s.x, z: s.z, hx: s.hitR, hz: s.hitR, y0: 0, y1: s.cap.h, enabled: true, ...(param ? { param } : {}) });
  }
  for (const k of FACE_KEYS) {
    const z = DT2_ZONES.find((d) => d.id === k.hotspot);
    if (!z || z.kind === 'encoder' || z.kind === 'data') continue;
    out.push({ id: k.hotspot, kind: asKind(z.kind), dt2Kind: z.kind, layer, shape: 'box', x: k.x, z: k.z, hx: k.w / 2, hz: k.d / 2, y0: 0, y1: FACE_KEY.h, enabled: true, ...('dir' in z ? { dir: z.dir } : {}) });
  }
  return out;
}

export const ZONES_FACE60: LaneZones = { build: (ctx) => dt2Zones(ctx.plateau) };
