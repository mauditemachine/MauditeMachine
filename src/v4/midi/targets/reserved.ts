/**
 * Les ids MIDI reserves de la refonte Digitakt II (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 2.6, 4.1 et 5.5) :
 * des noms FIGES, PAS ENCORE PUBLIES (aucune cible ne les porte en P0 : ni MIDI LEARN, ni le CSV, ni le Roto ne les
 * voient). Chaque lane publie les siens dans son fichier reserve de midi/targets/ (face60.ts...), a la fin, sans changer
 * un nom d'ici ; un libelle peut changer, jamais un id. <K> : une cle de piste (audio/tracks.ts TRACK_KEYS).
 */

import type { MidiTarget } from './types';

export const RESERVED_TARGET_IDS = {
  /** V.6.0, la face DT2 (2.6) : la touche PAGE prend rytm:ptnpage (rytm:page est la valeur de page) ; rytm:fill anime PAGE */
  face60: ['rytm:data', 'rytm:keyboard', 'rytm:song', 'rytm:preset', 'rytm:settings', 'rytm:sounds', 'rytm:tap', 'rytm:up', 'rytm:down', 'rytm:left', 'rytm:right', 'rytm:ptnpage', 'rytm:tempo:bpm', 'rytm:tempo:swing'],
  /**
   * V.6.0, les 16 pistes : les reglages, mutes, pads, choix et pas du sequenceur du Roto de T9 a T16 (les memes formes que
   * BD..CY), TRK LEV sur les 16 ; rytm:voice:<K>:<reglage> pour chaque reglage de voix, de trig et de LFO d'aujourd'hui
   */
  tracks60: ['rytm:voice:<K>:tlev', 'rytm:voice:<T9..T16>:<reglage>', 'rytm:voice:<T9..T16>:mute', 'rytm:pad:<T9..T16>', 'rytm:voice:select:<T9..T16>', 'rytm:seq:voice:<T9..T16>'],
  phone60: [],
  /** V.6.1 : les reglages neufs des pages (audio/tracks.ts RESERVED_PARAM_IDS.v61) sur chaque piste */
  pages61: ['rytm:voice:<K>:<RESERVED_PARAM_IDS.v61>'],
  /** V.6.1 : les reglages de trig neufs (RESERVED_PARAM_IDS.trig61) sur chaque piste */
  seq61: ['rytm:voice:<K>:<RESERVED_PARAM_IDS.trig61>'],
  face61: [],
  kit62: [],
  song62: [],
  settings62: [],
  face62: [],
} as const;

/**
 * Les deux cibles neuves de TEMPO (1.3) : 30 a 300 BPM au 1/10 et swing 50 a 80 % ; rytm:enc:tempo et rytm:enc:swing (le
 * setup Roto RYTM) gardent 100-150 et 50-67 % (libelle LEGACY RANGE).
 */
export const TEMPO_RANGE_DT2 = { bpm: [30, 300], swing: [50, 80] } as const;

/**
 * Le kind relatif (2.6, critique C4) : MidiTarget.kind n'a aujourd'hui que value, press et hold ; rytm:data (LEVEL/DATA,
 * un encodeur sans butee) sera 'relative' (MIDI LEARN, la detection des CC relatifs et le retour Roto : B6 en V.6.0).
 * Ce type ne s'ajoute a MidiTarget qu'avec son code.
 */
export type MidiTargetKindDt2 = MidiTarget['kind'] | 'relative';
