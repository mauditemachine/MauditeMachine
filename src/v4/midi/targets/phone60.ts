/**
 * Cibles MIDI reservees a V.6.0, lane B6 (le telephone). Vide en P0 (2026-10-30, cahier dt2 5.5) : la lane n'ajoute qu'ici, a la suite, dans
 * l'ordre ou ses cibles doivent sortir du CSV (npm run docs:midi : des lignes ajoutees seulement, a la fin du bloc de leur
 * machine). L'ordre des fichiers est fige dans midi/targets/index.ts (GROUPS).
 */

import type { MidiTarget } from './types';

export function phone60Targets(_out: MidiTarget[]): void {
  // rien en P0
}
