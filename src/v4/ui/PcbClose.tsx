/**
 * Fermer la machine ouverte, au telephone (2026-10-02, demande de Mika) :
 * machine ouverte, le pad CLOSE est sur le capot releve, loin et de biais ;
 * un bouton CLOSE orange, facon pad, se pose en bas de l'ecran sur l'avant
 * de la carte, au-dessus de la languette du Dock. Mise en page mobile
 * seulement (index.tsx) ; il apparait une fois la machine ouverte, part des
 * que la fermeture commence.
 */

import React, { useSyncExternalStore } from 'react';
import { openToggle } from '../actions';
import type { Stage } from '../scene/renderer';
import { explode } from '../state/explode';

interface Props {
  getStage: () => Stage | null;
}

export const PcbClose: React.FC<Props> = ({ getStage }) => {
  const s = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  if (s !== 'open') return null;
  return (
    <button type="button" className="v4-pcb-close" aria-label="Close the machine" onClick={() => openToggle(getStage())}>
      CLOSE
    </button>
  );
};

export default PcbClose;
