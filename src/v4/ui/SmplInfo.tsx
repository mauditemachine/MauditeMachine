/**
 * Les touches OPEN et INFO du MM-SMPL. INFO (2026-10-05, Mika : "un tout
 * petit bouton INFO pour savoir comment utiliser SMPL : on tombe sur un PDF
 * complet, avec des captures d'ecran, en francais") ouvre le mode d'emploi
 * (public/docs) dans un nouvel onglet. Depuis le meme jour (Mika : "le
 * bouton INFO doit etre a l'interieur OPEN de la machine SMPL") elle est
 * dans la machine ouverte, sur la plaque de l'interieur (a gauche de CLOSE,
 * ui/HoodClose.tsx ; seule et centree au telephone, ou CLOSE est en bas de
 * l'ecran) ; la touche OPEN prend sa place dans le bandeau du haut, a gauche
 * du logo, et ouvre le capot (smplExplode).
 */

import React, { useSyncExternalStore } from 'react';
import { openToggle } from '../actions';
import type { Stage } from '../scene/renderer';
import { smplExplode } from '../state/explode';
import { focus } from '../state/focus';
import { SMPL_INFO_KEY, SMPL_INFO_KEY_SOLO, SMPL_OPEN_KEY } from '../smpl/theme';
import { MachineKey } from './MachineKey';

/** Le mode d'emploi du MM-SMPL (francais). */
export const SMPL_MANUAL_URL = `${import.meta.env.BASE_URL}docs/MM-SMPL-mode-emploi.pdf`;

interface Props {
  getStage: () => Stage | null;
  /** mise en page telephone : CLOSE est en bas de l'ecran (ui/PcbClose.tsx), INFO seule sur la plaque */
  mobile: boolean;
}

export const SmplInfo: React.FC<Props> = ({ getStage, mobile }) => {
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const hood = useSyncExternalStore(smplExplode.subscribe, smplExplode.get, smplExplode.get);
  if (f !== 'smpl') return null;
  if (hood === 'closed') {
    return (
      <MachineKey key="open" getStage={getStage} layer={(st) => st.smpl?.top} spot={SMPL_OPEN_KEY} className="v4-info-key v4-smpl-open-key" label="Open the MM-SMPL" onClick={() => openToggle(getStage(), 'smpl')}>
        OPEN
      </MachineKey>
    );
  }
  if (hood !== 'open') return null;
  return (
    <MachineKey key="info" getStage={getStage} layer={(st) => st.smpl?.plate.top} spot={mobile ? SMPL_INFO_KEY_SOLO : SMPL_INFO_KEY} className="v4-info-key" label="MM-SMPL user guide (PDF, in French)" href={SMPL_MANUAL_URL}>
      <span className="v4-info-i" aria-hidden="true">
        i
      </span>
      INFO
    </MachineKey>
  );
};

export default SmplInfo;
