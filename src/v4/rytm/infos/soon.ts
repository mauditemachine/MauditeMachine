/** Les cartes INFOS du MM-RYTM : les reglages a venir (deplacees telles quelles de la table RAW de rytm/infos.ts en P0, 2026-10-30). */

import { type RytmInfoId } from '../diagrams';
import type { Raw } from './types';

export const RAW_SOON = {
  /* ---------- les reglages a venir (l'etude, sur aucun ecran) ---------- */
  'soon:prob': {
    section: 'VOICE',
    title: 'PROB',
    text: "Bientôt : la probabilité qu'un pas joue, de 0 à 100 % ; un charley à 50 % ne tombe qu'une fois sur deux, au hasard.",
    tip: 'Des charleys à 70 ou 80 % : un minimal qui ne se répète jamais tout à fait.',
  },
  'soon:micro': {
    section: 'VOICE',
    title: 'MICRO',
    text: 'Bientôt : décale un pas un peu avant ou après la grille, plus finement que SWING, pas par pas.',
    tip: 'Une caisse claire un rien en retard : la dark disco qui traîne.',
  },
  'soon:cond': {
    section: 'VOICE',
    title: 'COND',
    text: "Bientôt : une condition de pas, comme sur une Elektron : jouer une mesure sur deux (1:2), seulement la quatrième (4:4)...",
    tip: 'Un crash de CY en 1:4 : il ne tombe qu’au début de chaque phrase.',
  },
  'soon:rtrg': {
    section: 'VOICE',
    title: 'RTRG',
    text: 'Bientôt : le retrig, le pas répété plusieurs fois dans sa durée (des roulements de caisse claire, des charleys en rafale).',
  },
  'soon:rtim': {
    section: 'VOICE',
    title: 'RTIM',
    text: "Bientôt : la vitesse du retrig (1/16, 1/32...).",
  },
  'soon:br': {
    section: 'VOICE',
    title: 'BR',
    text: 'Bientôt : la réduction de bits, le grain des vieux samplers.',
  },
  'soon:loop': {
    section: 'VOICE',
    title: 'LOOP',
    text: "Bientôt : l'échantillon joué en boucle tant que le coup dure.",
  },
} satisfies Partial<Record<RytmInfoId, Raw>>;
