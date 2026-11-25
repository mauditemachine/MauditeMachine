/**
 * La page DELAY du capot. v27 (2026-11-17) : facon Soundtoys EchoBoy et Waves H-Delay, leurs fonctions, nos algorithmes ;
 * le DSP : plugin/mm-arp/dsp/Echo.h autour des deux coeurs du DELAY du site ; les reglages : delay.ts, extra-params.json
 * section delay ; MIX est le potard DELAY de la face (son clic ouvre cette page).
 *
 * v46 (2026-11-20) : la page est l'option A des maquettes v44, validee par Mika (DelayPage2.tsx) : les echos facon Echo
 * en haut, le petit ecran avec les presets dans le coin, les reglages en trois rangees. Aucun reglage neuf.
 */

import React from 'react';
import { DelayPageA } from './DelayPage2';

export const DelayPage: React.FC = () => <DelayPageA />;
