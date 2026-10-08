/**
 * CLOSE dans la machine ouverte, desktop (2026-10-05, Mika : "quand on clic
 * sur OPEN on devrait voir un CLOSE a l'interieur de la machine quand meme,
 * voyant") : depuis que OPEN cadre l'interieur, le capot releve et son pad
 * CLOSE sortent de l'image. Une touche orange, allumee, posee sur la plaque
 * des TWEAKS du MM-RYTM (sous son titre), du MM-ARP (a cote de SCOPE) ou du
 * MM-BASS (sous son titre, a droite d'INFOS, 2026-10-08) ; elle
 * suit la camera (ui/MachineKey.tsx), apparait une fois la machine ouverte et
 * part des que la fermeture commence. Au telephone : ui/PcbClose.tsx.
 * 2026-10-08 (Mika : "avoir de la finesse design ici") : plus de dalle
 * orange, une touche fine posee sur la carte sous le cartouche des TWEAKS,
 * son filet et sa LED orange allumee (v4.css .v4-close-key).
 */

import React, { useSyncExternalStore } from 'react';
import { hoodMachine, hoodOf, openToggle } from '../actions';
import type { Stage } from '../scene/renderer';
import { RYTM_CLOSE_KEY } from '../scene/rytmTweaks';
import { bassExplode, explode, voyExplode } from '../state/explode';
import { focus } from '../state/focus';
import { VOY_CLOSE_KEY } from '../voyager/theme';
import { BASS_CLOSE_KEY } from '../bass/theme';
import { MachineKey } from './MachineKey';

interface Props {
  getStage: () => Stage | null;
}

export const HoodClose: React.FC<Props> = ({ getStage }) => {
  useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  useSyncExternalStore(bassExplode.subscribe, bassExplode.get, bassExplode.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const m = hoodMachine();
  if ((f !== 'mm808' && f !== 'voy' && f !== 'bass') || hoodOf(m).get() !== 'open') return null;
  return (
    <MachineKey
      key={m}
      getStage={getStage}
      layer={(st) => (m === 'voy' ? st.voy?.tweaks.top : m === 'bass' ? st.bass?.tweaks.top : st.rytmTweaks.top)}
      spot={m === 'voy' ? VOY_CLOSE_KEY : m === 'bass' ? BASS_CLOSE_KEY : RYTM_CLOSE_KEY}
      className="v4-close-key"
      label="Close the machine"
      onClick={() => openToggle(getStage(), m)}
    >
      <span className="v4-close-led" aria-hidden="true" />
      CLOSE
    </MachineKey>
  );
};

export default HoodClose;
