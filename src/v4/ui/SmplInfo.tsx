/**
 * La touche INFO du MM-SMPL (2026-10-05, Mika : "un tout petit bouton INFO
 * pour savoir comment utiliser SMPL : on tombe sur un PDF complet, avec des
 * captures d'ecran, en francais"). Posee sur la machine, dans son bandeau du
 * haut, a gauche du logo ; elle ouvre le mode d'emploi (public/docs) dans un
 * nouvel onglet.
 */

import React, { useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { focus } from '../state/focus';
import { PORTRAIT } from '../theme';
import { SMPL, SMPL_W } from '../smpl/theme';
import { MachineKey, type KeySpot } from './MachineKey';

/** Le mode d'emploi du MM-SMPL (francais). */
export const SMPL_MANUAL_URL = `${import.meta.env.BASE_URL}docs/MM-SMPL-mode-emploi.pdf`;

/** Dans le bandeau du haut, a gauche du logo (repere du dessus de la machine). */
const SPOT: KeySpot = PORTRAIT ? { x: SMPL_W / 2 - 1.75, y: 0.02, z: SMPL.head.z, w: 0.95, d: 0.32 } : { x: SMPL_W / 2 - 1.9, y: 0.02, z: SMPL.head.z, w: 0.9, d: 0.28 };

export const SmplInfo: React.FC<{ getStage: () => Stage | null }> = ({ getStage }) => {
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  if (f !== 'smpl') return null;
  return (
    <MachineKey getStage={getStage} layer={(st) => st.smpl?.top} spot={SPOT} className="v4-info-key" label="MM-SMPL user guide (PDF, in French)" href={SMPL_MANUAL_URL}>
      <span className="v4-info-i" aria-hidden="true">
        i
      </span>
      INFO
    </MachineKey>
  );
};

export default SmplInfo;
