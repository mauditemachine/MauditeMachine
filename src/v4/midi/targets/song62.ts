/**
 * Cibles MIDI reservees a V.6.2, lane D4 ou D5 (SONG et chaines). Vide en P0 (2026-10-30, cahier dt2 5.5) : la lane n'ajoute qu'ici, a la suite, dans
 * l'ordre ou ses cibles doivent sortir du CSV (npm run docs:midi : des lignes ajoutees seulement, a la fin du bloc de leur
 * machine). L'ordre des fichiers est fige dans midi/targets/index.ts (GROUPS).
 */

import type { MidiTarget } from './types';

export function song62Targets(_out: MidiTarget[]): void {
  // rien en P0
}
