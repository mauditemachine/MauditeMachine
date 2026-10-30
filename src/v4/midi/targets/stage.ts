/** Les cibles MIDI : la scene (pour les actions qui animent une touche de la machine). Deplace de midi/targets.ts en P0. */

import type { Stage } from '../../scene/renderer';

let getStage: () => Stage | null = () => null;
/** La scene (pour les actions qui animent une touche de la machine). */
export function attachStage(fn: () => Stage | null): void {
  getStage = fn;
}
export const stageNow = (): Stage | null => getStage();
