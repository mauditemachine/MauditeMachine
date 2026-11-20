/**
 * v43 : les potards de la face sont les PNG de Mika (vknob.ts), a la place des potards 3D du MM-RYTM (voyager/knobs.ts :
 * leurs maillages sont caches des que les PNG sont la ; leurs zones de prise, leur course, leur glissement restent, les
 * angles arrivent par VoyKnobs.onPlace) :
 * - WAVEFORM 1 et 2, RANGE 1 et 2 : le selecteur (sel) ;
 * - FINE 1 et 2 : le petit (k3), comme FM, RATIO, OSC 1... (poses par faceExtras.tsx) ;
 * - tous les autres potards a capuchon de metal (SEMI, CUTOFF, RES, ENV AMT, les enveloppes, MOD, les effets, VOLUME,
 *   l'arpegiateur du plateau, le commutateur MODE du filtre) : le potard (k1) ; HELL aussi (hellKnob.tsx).
 * Meme centre, meme rayon exterieur (celui de la base du potard d'avant : RYTM_KNOB.R x son echelle).
 */

import type { Group } from 'three';
import type { Stage } from '../../scene/renderer';
import { DIALS, FLUTED_DIALS } from '../../voyager/knobs';
import type { VoyKnobId } from '../../voyager/params';
import { RYTM_KNOB } from '../../voyager/rytmKnob';
import { voyKnobPlace } from '../../voyager/theme';
import { VKnobSet, onVKnobLoad, vknobLoaded, type VKnobKind } from './vknob';

/** La hauteur des quads au-dessus de leur plan (au-dessus de la serigraphie et de ses encarts). */
export const VKNOB_LIFT = 0.012;
const KIND: Partial<Record<VoyKnobId, VKnobKind>> = { wave1: 'sel', wave2: 'sel', range1: 'sel', range2: 'sel', fine1: 'k3', fine2: 'k3' };

export function attachVKnobs(stage: Stage): () => void {
  const rig = stage.voy;
  if (!rig) return () => undefined;
  const knobs = rig.knobs;
  const groups = new Map<string, { kind: VKnobKind; layer: Group; ids: VoyKnobId[] }>();
  for (const k of DIALS) {
    if (FLUTED_DIALS.has(k.id)) continue;
    const pl = voyKnobPlace(k.id);
    const kind = KIND[k.id] ?? 'k1';
    const key = `${kind}:${pl.where}`;
    if (!groups.has(key)) groups.set(key, { kind, layer: pl.where === 'panel' ? rig.panel : rig.lid, ids: [] });
    groups.get(key)!.ids.push(k.id);
  }
  const index = new Map<VoyKnobId, { set: VKnobSet; i: number }>();
  const sets: { set: VKnobSet; layer: Group }[] = [];
  for (const g of groups.values()) {
    const set = new VKnobSet(g.kind, g.ids.length);
    g.ids.forEach((id, i) => {
      const pl = voyKnobPlace(id);
      set.place(i, pl.x, VKNOB_LIFT, pl.z, RYTM_KNOB.R * pl.s);
      set.setAngle(i, knobs.angleOf(id));
      index.set(id, { set, i });
    });
    g.layer.add(...set.meshes);
    sets.push({ set, layer: g.layer });
  }
  knobs.onPlace = (id, a) => {
    const e = index.get(id);
    if (e) e.set.setAngle(e.i, a);
  };
  // les potards 3D : caches une fois les PNG la (jamais une face sans potards)
  const swap = (): void => {
    if (vknobLoaded()) knobs.mesh.visible = false;
    stage.invalidate();
  };
  const off = onVKnobLoad(swap);
  swap();
  return () => {
    off();
    knobs.onPlace = null;
    knobs.mesh.visible = true;
    for (const { set, layer } of sets) {
      layer.remove(...set.meshes);
      set.dispose();
    }
    stage.invalidate();
  };
}
