/**
 * L'apercu de l'arpege (2026-10-08, le grand ecran : "plus de detail") :
 * les notes que l'arpegiateur joue sur un accord, telles qu'il les joue
 * (arp.ts scheduleStep) : la suite (EDIT, ou AUTO : MODE, RANGE, NOTES,
 * CHORD), OCTAVE appliquee, RATE (pas de double croche par note) et GATE
 * (la duree de chaque note en part de l'intervalle). Pur, sans DOM ni son :
 * l'ecran (voyager/screen.ts) en fait son echelle de notes, les dessins
 * des INFOS (voyager/diagrams.ts) leurs contours, les tests le comparent a
 * l'etat de l'arpege (window.__v4.voyager.rig.screen).
 */

import { degreeMidi } from './chords';
import { gateFrac, octaveShift, stepIndex, stepsPerNote, type VoyValues } from './params';
import { poolSteps, type SeqStep } from './seq';

/** Les accents par double croche du temps (1, e, et, a), ceux d'arp.ts ACCENT (recopies : arp.ts tire tout le son). */
export const ACCENT_DEPTHS = [1, 0.8, 0.92, 1.12] as const;

export interface ArpPreviewNote {
  /** rang dans la suite */
  pos: number;
  /** degre de la gamme au-dessus de la racine (null : un silence de la suite EDIT) */
  deg: number | null;
  /** la note MIDI jouee (OCTAVE comprise), null : silence */
  midi: number | null;
}

export interface ArpPreview {
  chord: number;
  notes: ArpPreviewNote[];
  /** MODE RAND en AUTO : la suite montree est la reserve (ou les dernieres notes tirees), chaque pas en tire une */
  random: boolean;
  /** pas de double croche par note (4, 2, 1, 0.5) */
  spn: number;
  /** la duree d'une note, en part de l'intervalle entre deux notes */
  gate: number;
  /** OCTAVE en demi-tons */
  shift: number;
  /** la plus basse et la plus haute note (MIDI) ; 0 sans note */
  lo: number;
  hi: number;
}

/**
 * L'apercu d'un accord : steps, la suite montree (seq.shown, EDIT ou AUTO
 * avec les tirages de RAND) ; sans elle, la suite AUTO des potards (celle
 * des dessins des INFOS).
 */
export function arpPreview(chord: number, values: Readonly<VoyValues>, steps?: readonly SeqStep[] | null): ArpPreview {
  const random = !steps && stepIndex('mode', values.mode) === 3;
  const list: readonly SeqStep[] = steps ?? poolSteps(chord, values, (random ? 0 : stepIndex('mode', values.mode)) as 0 | 1 | 2 | 3);
  const shift = 12 * octaveShift(values.octave);
  const notes = list.map((d, pos) => ({ pos, deg: d, midi: d === null ? null : degreeMidi(chord, d) + shift }));
  const ms = notes.map((n) => n.midi).filter((m): m is number => m !== null);
  return {
    chord,
    notes,
    random,
    spn: stepsPerNote(values.rate),
    gate: gateFrac(values.gate),
    shift,
    lo: ms.length ? Math.min(...ms) : 0,
    hi: ms.length ? Math.max(...ms) : 0,
  };
}
