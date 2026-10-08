/**
 * INFOS sur la plaque du MM-BASS ouvert (2026-10-08, Mika : "dans le OPEN,
 * un bouton INFOS : quand je clique dessus et que je survole chaque
 * parametre du BASS, j'ai un descriptif") : une touche posee sur la plaque
 * TWEAKS (desktop sous le titre, a gauche de CLOSE ; au telephone dans la
 * derniere case), allumee tant que le mode est la (state/bassInfos.ts). Le
 * mode reste allume apres CLOSE : la face se survole avec ses cartes.
 */

import React, { useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { bassExplode } from '../state/explode';
import { bassInfos } from '../state/bassInfos';
import { focus } from '../state/focus';
import { BASS_INFOS_KEY } from '../bass/theme';
import { MachineKey } from './MachineKey';

interface Props {
  getStage: () => Stage | null;
}

export const BassInfosKey: React.FC<Props> = ({ getStage }) => {
  const hood = useSyncExternalStore(bassExplode.subscribe, bassExplode.get, bassExplode.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const on = useSyncExternalStore(bassInfos.subscribe, () => bassInfos.get().on, () => false);
  if (f !== 'bass' || hood !== 'open') return null;
  return (
    <MachineKey
      getStage={getStage}
      layer={(st) => st.bass?.tweaks.top}
      spot={BASS_INFOS_KEY}
      className="v4-info-key v4-bass-infos-key"
      label={on ? 'INFOS on: hover a control of the MM-BASS (tap on a phone) to read what it does. Press to turn off' : 'INFOS: hover a control of the MM-BASS (tap on a phone) to read what it does'}
      pressed={on}
      onClick={() => bassInfos.toggle()}
    >
      <span className="v4-info-i" aria-hidden="true">
        i
      </span>
      INFOS
    </MachineKey>
  );
};

export default BassInfosKey;
