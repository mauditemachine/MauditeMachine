/**
 * Le potard HELL de la face avant (2026-11-13, Mika : "UN knob HELL (mix de l'effet) sur la face avant ... double-clic
 * dessus -> ouvre OPEN sur la page HELL"). La seule piece ajoutee a la face : un petit potard comme ses voisins, dans la
 * colonne EFFECTS, sur la rangee du bas (vide jusque-la), centre sous DELAY et REVERB (voyager/theme.ts VOY_HELL_PLACE),
 * son nom serigraphie dessous (voyager/silk.ts voySilkExtraKnob). Il regle xHellMix (extra.ts) : un DialId z:hell
 * inscrit comme une fiche (scene/screen/menus/registry.ts), que le geste des potards de la face (ui/Hotspots.tsx) tourne
 * comme les autres ; sa valeur s'ecrit sur l'ecran de la machine.
 *
 * Le double clic de la face (voyager/faceDbl.ts) : deux tapes sur un potard ouvrent le capot sur la page qui le detaille
 * (au site : la remise a la valeur de depart ; dans le plugin elle passe a Alt / Cmd / Ctrl + clic) :
 *   HELL -> FX / HELL ; DELAY -> FX, DELAY ; REVERB -> FX, REVERB ; OVERDRIVE -> SOUND, DISTORTION ;
 *   oscillateurs -> SOUND, OSC + ; filtre -> SOUND, FILTER + ; enveloppes -> SOUND, AMP ; MOD -> SEQ, LFO 2 ;
 *   arpegiateur -> SEQ, STEP SEQUENCER ; VOLUME -> SOUND, MASTER.
 */

import { useEffect } from 'react';
import { Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { openToggle } from '../../actions';
import type { Stage } from '../../scene/renderer';
import type { HotspotDef } from '../../scene/hit';
import { potAngle } from '../../scene/encoders';
import { registerDialSpec } from '../../scene/screen/menus/registry';
import { voyExplode } from '../../state/explode';
import type { EncId } from '../../theme';
import { faceDbl } from '../../voyager/faceDbl';
import { buildKnobGeometry } from '../../voyager/knobs';
import { voyMsg } from '../../voyager/msg';
import { voyKnob, type VoyKnobId } from '../../voyager/params';
import { voySilkExtraKnob } from '../../voyager/silk';
import { VOY_HELL_PLACE, VOY_KNOB } from '../../voyager/theme';
import { arpExtra } from './extra';
import { hoodPage, type HoodFx, type HoodTab } from './hoodPage';

const ID = 'xHellMix';
export const HELL_DIAL = 'z:hell';

// Le nom sous le potard, avant que la scene ne dessine sa serigraphie
voySilkExtraKnob('panel', 'HELL', VOY_HELL_PLACE.x, VOY_HELL_PLACE.labelZ);

registerDialSpec(HELL_DIAL, {
  value: () => arpExtra.of(ID),
  set: (v) => {
    arpExtra.set(ID, Math.min(1, Math.max(0, v)));
    voyMsg.show(`HELL ${arpExtra.text(ID)}`, 1800);
  },
  range: () => [0, 1] as const,
  steps: () => 0,
  text: (v) => arpExtra.text(ID, v),
  unit: () => '',
  reset: () => arpExtra.def(ID),
  say: (v) => `HELL ${arpExtra.text(ID, v)}`,
});

/** La page d'un potard de la face : sa page du capot, sa sous-page, le cadre a montrer. */
function pageOf(dial: string): { tab: HoodTab; fx: HoodFx | null; focus: string } | null {
  if (dial === HELL_DIAL) return { tab: 'fx', fx: 'hell', focus: 'HELL' };
  if (!dial.startsWith('v:')) return null;
  const id = dial.slice(2) as VoyKnobId;
  if (id === 'delay') return { tab: 'fx', fx: 'rack', focus: 'DELAY' };
  if (id === 'reverb') return { tab: 'fx', fx: 'rack', focus: 'REVERB' };
  if (id === 'dist') return { tab: 'sound', fx: null, focus: 'DISTORTION' };
  if (id === 'chorus') return { tab: 'fx', fx: 'rack', focus: 'DELAY' };
  if (id === 'volume') return { tab: 'sound', fx: null, focus: 'MASTER' };
  switch (voyKnob(id)?.section) {
    case 'osc':
      return { tab: 'sound', fx: null, focus: 'OSC +' };
    case 'filter':
      return { tab: 'sound', fx: null, focus: 'FILTER +' };
    case 'feg':
    case 'aeg':
      return { tab: 'sound', fx: null, focus: 'AMP' };
    case 'mod':
      return { tab: 'seq', fx: null, focus: 'LFO 2' };
    case 'arp':
      return { tab: 'seq', fx: null, focus: 'STEP SEQUENCER' };
    default:
      return null;
  }
}

const DEF_ANGLE_AXIS = new Vector3(0, 1, 0);

/** Le potard HELL dans la scene, et le double clic de la face ; rien a dessiner en HTML. */
export const HellKnob: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  useEffect(() => {
    const rig = stage?.voy;
    if (!stage || !rig) return undefined;
    const P = VOY_HELL_PLACE;
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.28 });
    material.name = 'voyHellKnob';
    const mesh = new Mesh(buildKnobGeometry(false), material);
    mesh.name = 'voyHellKnob';
    mesh.castShadow = rig.knobs.mesh.castShadow;
    mesh.receiveShadow = true;
    mesh.position.set(P.x, 0, P.z);
    mesh.scale.setScalar(P.s);
    rig.panel.add(mesh);
    const q = new Quaternion();
    const turn = (): void => {
      mesh.quaternion.copy(q.setFromAxisAngle(DEF_ANGLE_AXIS, Math.fround(potAngle(arpExtra.of(ID)))));
      stage.invalidate();
    };
    turn();
    const off = arpExtra.subscribe(turn);
    const r = Math.max(VOY_KNOB.touchR, VOY_KNOB.skirt.r * P.s);
    const def: HotspotDef = {
      id: 'vhell',
      kind: 'encoder',
      param: HELL_DIAL as EncId,
      layer: rig.panel,
      shape: 'disc',
      x: P.x,
      z: P.z,
      hx: r,
      hz: r,
      y0: 0,
      y1: (VOY_KNOB.skirt.h + VOY_KNOB.h) * P.s,
      enabled: true,
      machine: 'voy',
    };
    stage.hit.add([def]);
    faceDbl.set((dial) => {
      const pg = pageOf(dial);
      if (!pg) return false;
      hoodPage.show(pg.tab, pg.fx, pg.focus);
      if (voyExplode.get() === 'closed') openToggle(stage, 'voy');
      return true;
    });
    return () => {
      off();
      faceDbl.set(null);
      def.enabled = false;
      rig.panel.remove(mesh);
      mesh.geometry.dispose();
      material.dispose();
    };
  }, [stage]);
  return null;
};
