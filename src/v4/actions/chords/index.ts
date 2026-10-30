/**
 * La table des accords, assemblee dans un ORDRE FIGE (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 2.7 et 5.5) : un
 * fichier par lane, l'ordre des fichiers ne depend pas de l'ordre de fin des lanes. Vide en P0 ; personne ne la lit
 * encore (le baril actions.ts ne l'exporte pas : ses exports restent ceux d'avant).
 */

import type { Chord } from './types';
import { CHORDS_60 } from './chords60';
import { CHORDS_61_SEQ } from './chords61seq';
import { CHORDS_61_FACE } from './chords61face';
import { CHORDS_62_KIT } from './chords62kit';
import { CHORDS_62_SONG } from './chords62song';
import { CHORDS_62_SETTINGS } from './chords62settings';

export type { Chord, ChordEvent, ChordGesture, ChordKey } from './types';

export const CHORDS: readonly Chord[] = [
  ...CHORDS_60,
  ...CHORDS_61_SEQ,
  ...CHORDS_61_FACE,
  ...CHORDS_62_KIT,
  ...CHORDS_62_SONG,
  ...CHORDS_62_SETTINGS,
];
