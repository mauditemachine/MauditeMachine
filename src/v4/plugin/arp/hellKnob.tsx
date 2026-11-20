/**
 * Le potard HELL de la face avant (2026-11-13, Mika : "UN knob HELL (mix de l'effet) sur la face avant ... double-clic
 * dessus -> ouvre OPEN sur la page HELL"). La seule piece ajoutee a la face : un petit potard comme ses voisins, dans la
 * colonne EFFECTS, sur la rangee du bas (vide jusque-la), centre sous DELAY et REVERB (voyager/theme.ts VOY_HELL_PLACE),
 * son nom serigraphie dessous (voyager/silk.ts voySilkExtraKnob). Il regle xHellMix (extra.ts) : un DialId z:hell
 * inscrit comme une fiche (scene/screen/menus/registry.ts), que le geste des potards de la face (ui/Hotspots.tsx) tourne
 * comme les autres ; sa valeur s'ecrit sur l'ecran de la machine.
 *
 * Le clic de la face (voyager/faceDbl.ts, 2026-11-16 ; le double clic avant) : un clic sans mouvement sur un potard ouvre
 * le capot sur la page qui le detaille (un glisser le tourne, rien ne s'ouvre ; la remise a la valeur de depart passe a
 * Alt / Cmd / Ctrl + clic) :
 *   HELL -> la page HELL ; REVERB -> la page REVERB ; DISTO -> la page DISTO ; DELAY -> la page DELAY (v27). Les autres :
 *   rien (pageOf). Les pieces de l'encart d'EDIT (v27, faceExtras.tsx) : un levier bascule, une touche passe au cran
 *   suivant.
 */

import { useEffect } from 'react';
import { openToggle } from '../../actions';
import type { Stage } from '../../scene/renderer';
import type { HotspotDef } from '../../scene/hit';
import { potAngle } from '../../scene/encoders';
import { registerDialSpec } from '../../scene/screen/menus/registry';
import { voyExplode } from '../../state/explode';
import type { EncId } from '../../theme';
import { faceDbl } from '../../voyager/faceDbl';
import { RYTM_KNOB } from '../../voyager/rytmKnob';
import { voyMsg } from '../../voyager/msg';
import { voySilkExtraKnob } from '../../voyager/silk';
import { VOY_HELL_PLACE, VOY_KNOB } from '../../voyager/theme';
import { arpExtra } from './extra';
import { hoodPage, type HoodFx, type HoodTab } from './hoodPage';
import { encartTap } from './faceExtras';
import { VKnobSet } from './vknob';
import { VKNOB_LIFT } from './vknobFace';

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

/**
 * La page d'un potard de la face (2026-11-16, Mika : "seuls les boutons qui ont une page ou une section dediee dans OPEN
 * l'ouvrent") : REVERB (sa page), HELL (sa page), DISTO (sa page), DELAY (sa page, v27). Tous les autres ne font
 * rien au clic (ni OPEN, ni saut de valeur : ui/Hotspots.tsx tapDial) ; ils se tournent au glisser comme avant.
 */
function pageOf(dial: string): { tab: HoodTab; fx: HoodFx | null; focus: string } | null {
  if (dial === HELL_DIAL) return { tab: 'fx', fx: 'hell', focus: 'HELL' };
  if (dial === 'v:reverb') return { tab: 'fx', fx: 'reverb', focus: 'REVERB' };
  // v27 : la page DELAY (facon EchoBoy / H-Delay), le cadre FEEDBACK · MIX (le potard DELAY de la face est MIX)
  if (dial === 'v:delay') return { tab: 'fx', fx: 'delay', focus: 'FEEDBACK · MIX' };
  // DISTO (2026-11-17, la DISTO facon Decapitator) : sa page, le cadre DRIVE
  if (dial === 'v:dist') return { tab: 'fx', fx: 'disto', focus: 'DRIVE' };
  return null;
}

/** Le potard HELL dans la scene, et le clic des potards de la face ; rien a dessiner en HTML. */
export const HellKnob: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  useEffect(() => {
    const rig = stage?.voy;
    if (!stage || !rig) return undefined;
    const P = VOY_HELL_PLACE;
    // v43 : le potard de Mika (vknob.ts k1), comme tous ceux de la face : son PNG, meme centre, meme rayon exterieur
    const set = new VKnobSet('k1', 1);
    set.place(0, P.x, VKNOB_LIFT, P.z, RYTM_KNOB.R * P.s);
    rig.panel.add(...set.meshes);
    const turn = (): void => {
      set.setAngle(0, Math.fround(potAngle(arpExtra.of(ID))));
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
      y1: RYTM_KNOB.h * P.s,
      enabled: true,
      machine: 'voy',
    };
    stage.hit.add([def]);
    faceDbl.set((dial) => {
      if (encartTap(dial)) return true;
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
      rig.panel.remove(...set.meshes);
      set.dispose();
    };
  }, [stage]);
  return null;
};
