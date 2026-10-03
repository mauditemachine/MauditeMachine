/**
 * Fermer la machine ouverte, au telephone (2026-10-02, demande de Mika) :
 * machine ouverte, le pad CLOSE est sur le capot releve, loin et de biais ;
 * un bouton CLOSE orange, facon pad, se pose en bas de l'ecran sur l'avant
 * de la carte, au-dessus de la languette du Dock. Mise en page mobile
 * seulement (index.tsx) ; il apparait une fois la machine ouverte, part des
 * que la fermeture commence.
 */

import React, { useSyncExternalStore } from 'react';
import { hoodMachine, hoodOf, openToggle } from '../actions';
import type { Stage } from '../scene/renderer';
import { explode, voyExplode } from '../state/explode';
import { focus } from '../state/focus';

interface Props {
  getStage: () => Stage | null;
}

export const PcbClose: React.FC<Props> = ({ getStage }) => {
  // Le capot de la machine qu'on utilise (deux machines, 2026-10-03)
  useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const m = hoodMachine();
  if (hoodOf(m).get() !== 'open') return null;
  return (
    <button type="button" className="v4-pcb-close" aria-label="Close the machine" onClick={() => openToggle(getStage(), m)}>
      CLOSE
    </button>
  );
};

export default PcbClose;
