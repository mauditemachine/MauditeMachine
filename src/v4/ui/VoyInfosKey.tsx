/**
 * INFOS dans le MM-ARP ouvert (2026-10-08, la revue de l'OPEN ; Mika :
 * "excellent pour le bouton INFO ! ... je veux la meme chose pour RYTM
 * aussi") : capot ouvert, le i du grand ecran sort du cadre avec le capot
 * leve ; une touche INFOS posee sur la carte, sous le cartouche des TWEAKS,
 * entre SCOPE et CLOSE (au telephone a droite de SCOPE), la meme que celle
 * du MM-BASS (ui/BassInfosKey.tsx). Allumee tant que le mode est la
 * (state/voyInfos.ts) ; le mode reste allume apres CLOSE, la face se
 * survole avec ses cartes.
 */

import React, { useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { voyExplode } from '../state/explode';
import { voyInfos } from '../state/voyInfos';
import { focus } from '../state/focus';
import { VOY_INFOS_KEY } from '../voyager/theme';
import { MachineKey } from './MachineKey';

interface Props {
  getStage: () => Stage | null;
}

export const VoyInfosKey: React.FC<Props> = ({ getStage }) => {
  const hood = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const on = useSyncExternalStore(voyInfos.subscribe, () => voyInfos.get().on, () => false);
  if (f !== 'voy' || hood !== 'open') return null;
  return (
    <MachineKey
      getStage={getStage}
      layer={(st) => st.voy?.tweaks.top}
      spot={VOY_INFOS_KEY}
      className="v4-info-key v4-bass-infos-key"
      label={on ? 'INFOS on: hover a control of the MM-ARP (tap on a phone) to read what it does. Press to turn off' : 'INFOS: hover a control of the MM-ARP (tap on a phone) to read what it does'}
      pressed={on}
      onClick={() => voyInfos.toggle()}
    >
      <span className="v4-info-i" aria-hidden="true">
        i
      </span>
      INFOS
    </MachineKey>
  );
};

export default VoyInfosKey;
