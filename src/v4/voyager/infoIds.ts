/**
 * Les ids des INFOS du MM-ARP et leurs sections (2026-10-08, revue) : la
 * partie legere, sortie de voyager/infos.ts pour que les textes en francais
 * ne partent qu'avec la carte (voyager/InfosCard.tsx, chargee a la demande
 * par index.tsx). Le grand ecran (la section dans l'en-tete de l'echo), la
 * couche de saisie (ui/Hotspots.tsx) et le rig n'ont besoin que de ceci.
 * Les dessins (voyager/diagrams.ts) restent dans le paquet principal :
 * l'echo d'un potard les dessine a l'ecran.
 */

import type { VoyInfoId } from './diagrams';

/** La section du panneau de chaque commande, en petites capitales (la carte, l'en-tete de l'echo). */
export const VOY_INFO_SECTION: Readonly<Record<VoyInfoId, string>> = {
  rate: 'ARPEGGIATOR',
  mode: 'ARPEGGIATOR',
  range: 'ARPEGGIATOR',
  notes: 'ARPEGGIATOR',
  gate: 'ARPEGGIATOR',
  octave: 'ARPEGGIATOR',
  glide: 'ARPEGGIATOR',
  wave1: 'OSCILLATORS',
  range1: 'OSCILLATORS',
  semi1: 'OSCILLATORS',
  fine1: 'OSCILLATORS',
  on1: 'OSCILLATORS',
  wave2: 'OSCILLATORS',
  range2: 'OSCILLATORS',
  semi2: 'OSCILLATORS',
  fine2: 'OSCILLATORS',
  on2: 'OSCILLATORS',
  osc1: 'MIXER',
  osc2: 'MIXER',
  sub: 'MIXER',
  subOct: 'OSCILLATORS',
  subWave: 'OSCILLATORS',
  noise: 'MIXER',
  fm: 'OSCILLATORS',
  ratio: 'OSCILLATORS',
  cutoff: 'FILTER',
  res: 'FILTER',
  envAmt: 'FILTER',
  fmode: 'FILTER',
  fA: 'FILTER EG',
  fD: 'FILTER EG',
  fS: 'FILTER EG',
  fR: 'FILTER EG',
  aA: 'AMP EG',
  aD: 'AMP EG',
  aS: 'AMP EG',
  aR: 'AMP EG',
  lfoRate: 'MOD',
  lfoShape: 'MOD',
  lfoDest: 'MOD',
  lfoAmt: 'MOD',
  dist: 'EFFECTS',
  chorus: 'EFFECTS',
  delay: 'EFFECTS',
  reverb: 'EFFECTS',
  volume: 'OUTPUT',
  phase: 'TWEAKS',
  drift: 'TWEAKS',
  width: 'TWEAKS',
  monoLow: 'TWEAKS',
  keyTrack: 'TWEAKS',
  accent: 'TWEAKS',
  sync: 'TWEAKS',
  duck: 'TWEAKS',
  chord: 'TWEAKS',
  pad: 'CHORDS',
  run: 'TRANSPORT',
  clear: 'TRANSPORT',
  random: 'TRANSPORT',
  edit: 'TRANSPORT',
  open: 'TRANSPORT',
  screen: 'SCREEN',
  presets: 'SCREEN',
  seq: 'EDIT',
  infos: 'SCREEN',
};

/** L'id des INFOS d'une zone de saisie du MM-ARP (vk-cutoff, vpad-3, vbtn-run, vlcd-open...), null : pas une commande du MM-ARP. */
export function voyInfoIdOf(hotspot: string): VoyInfoId | null {
  if (hotspot.startsWith('vk-')) {
    const id = hotspot.slice(3);
    return id in VOY_INFO_SECTION ? (id as VoyInfoId) : null;
  }
  if (hotspot.startsWith('vpad-')) return 'pad';
  if (hotspot.startsWith('vbtn-')) {
    const id = hotspot.slice(5);
    return id === 'run' || id === 'clear' || id === 'random' || id === 'edit' || id === 'open' ? id : null;
  }
  if (hotspot === 'vlcd-open') return 'screen';
  if (hotspot.startsWith('vlcd-')) return 'presets';
  if (hotspot === 'vseq') return 'seq';
  if (hotspot === 'vinfo') return 'infos';
  return null;
}
