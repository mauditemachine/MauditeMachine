/**
 * TWEAKS du MM-ARP (2026-10-04, Mika : "un bouton pour qu'on n'ait pas de
 * probleme de phase dans les low ; dans OPEN, d'autres boutons comme le
 * Mini V ; enleve les liens du site et mets des tweaks a la place ; je veux
 * un super synth"). Sous le capot, la ou etaient les puces des pages : une
 * plaque a la couleur du capot, vissee sur quatre entretoises d'aluminium
 * au-dessus de la carte, et ses neuf potards (les memes que ceux de la
 * face) : PHASE, DRIFT, WIDTH, BASS MONO, KEY TRACK, ACCENT, le
 * commutateur SYNC, SIDECHAIN et le selecteur CHORD (2026-10-05)
 * (voyager/params.ts dit ce qu'ils font).
 *
 * La plaque elle-meme (geometrie, serigraphie) est commune avec celle du
 * MM-RYTM depuis le meme jour : scene/tweakplate.ts. Depuis le 2026-10-08
 * (Mika : "c'est moche des grosses cases par dessus un PCB.. avoir de la
 * finesse design ici"), plus de plaque : les reglages sont soudes sur la
 * carte, en trois groupes (voyager/theme.ts, la zone et les places). Les
 * cibles du picking (vk-<id>, comme ceux de la face) ne repondent que capot
 * ouvert (rig.ts, comme les puces avant elles).
 */

import type { HotspotDef } from '../scene/hit';
import { TweakPlate, type TweakItem } from '../scene/tweakplate';
import { VOY_TWEAK_CELL_W, VOY_TWEAK_ENDS, VOY_TWEAK_GROUPS, VOY_TWEAK_PLATE, VOY_TWEAK_TITLE, voyTweakPlace } from './theme';
import { VOY_TWEAKS, type VoyKnobId } from './params';

const P = VOY_TWEAK_PLATE;

function items(): TweakItem[] {
  return VOY_TWEAKS.map((k) => {
    const pl = voyTweakPlace(k.id) ?? { x: 0, z: 0, sw: false };
    return {
      hotspot: `vk-${k.id}`,
      label: k.label,
      x: pl.x,
      z: pl.z,
      // SYNC : un commutateur, OFF et ON a ses reperes (ON en orange) ; CHORD : cinq crans, 7TH (celui de depart) en orange
      ...(pl.sw ? { steps: k.steps ?? ['OFF', 'ON'], stepOrange: k.id === 'chord' ? 2 : 1 } : {}),
      // PHASE : FREE en orange (le reglage d'origine, la phase libre)
      ...(VOY_TWEAK_ENDS[k.id] ? { ends: VOY_TWEAK_ENDS[k.id], endOrange: k.id === 'phase' } : {}),
    };
  });
}

export class VoyTweaks extends TweakPlate {
  constructor(opts: { mobile: boolean; anisotropy: number }) {
    // SCOPE et CLOSE sous le cartouche (voyager/theme.ts VOY_SCOPE_KEY, VOY_CLOSE_KEY)
    // Les potards a la suite des trimmers RV1 a RV4 de la carte (scene/pcb.ts, la carte analogique)
    super({ name: 'voyTweaks', dims: P, items: items(), groups: VOY_TWEAK_GROUPS, title: VOY_TWEAK_TITLE, cellW: VOY_TWEAK_CELL_W, refStart: 5 }, opts);
  }

  /** Valeur 0 a 1 -> angle ; true s'il faut une frame. */
  setValue(id: VoyKnobId, v: number): boolean {
    return this.setAt(
      VOY_TWEAKS.findIndex((k) => k.id === id),
      v
    );
  }

  /** Les cibles du picking : une par reglage (la piece et sa serigraphie), coupees capot ferme. */
  hotspots(): HotspotDef[] {
    return this.track(VOY_TWEAKS.map((k, i) => {
      const h = this.hitOf(i);
      return {
        id: this.spec.items[i].hotspot,
        kind: 'vknob' as const,
        layer: this.top,
        shape: h.shape,
        x: h.x,
        z: h.z,
        hx: h.hx,
        hz: h.hz,
        y0: 0,
        y1: h.y1,
        enabled: false,
        vknob: k.id,
      };
    }));
  }

  info(): { ids: VoyKnobId[]; angleDeg: number[]; draws: number } {
    return { ids: VOY_TWEAKS.map((k) => k.id), angleDeg: this.angles(), draws: this.draws };
  }
}
