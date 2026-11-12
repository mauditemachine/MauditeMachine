/**
 * Le plugin (2026-11-12, Mika : "la longueur de steps, je devrais pouvoir la voir directement sur la machine, la on voit
 * toujours les 16 meme quand on change") : ce qu'une piste joue, lu en un seul endroit par les touches de pas (scene/
 * renderer.ts), le graphe TRACK STEPS de l'ecran, la frappe d'un pas et les anneaux de l'automation. La meme loi que le
 * moteur (plugin/head.ts trackStepAt, trackSpan ; dsp/Engine.cpp evalStep).
 */

import { pattern } from '../audio/pattern';
import type { TrackKey } from '../audio/tracks';
import { extHead, trackSpan, trackStepAt } from '../plugin/head';

/** La longueur de la piste (TLEN) : 0, celle du pattern. */
export const trackLen = (inst: TrackKey): number => Math.round(pattern.get().trigs?.[inst]?.tlen ?? 0);

/** Les pas que la piste joue, en pas du pattern : [debut, fin). */
export const trackSpanOf = (inst: TrackKey): [number, number] => trackSpan(pattern.stepCount(), pattern.loopPage(), trackLen(inst));

/** Les touches de la page affichee que la piste joue : [debut, fin) de 0 a 16 (vide : [0, 0]). */
export function trackKeySpan(inst: TrackKey): [number, number] {
  const [lo, hi] = trackSpanOf(inst);
  const p0 = pattern.editPage() * 16;
  const a = Math.max(0, Math.min(16, lo - p0));
  const b = Math.max(a, Math.min(16, hi - p0));
  return [a, b];
}

/** La touche i de la page affichee est-elle jouee par la piste ? */
export const trackKeyOn = (inst: TrackKey, i: number): boolean => {
  const [a, b] = trackKeySpan(inst);
  return i >= a && i < b;
};

/** Le pas que la piste joue sous la tete du moteur (en pas du pattern) ; -1 a l'arret ou sans moteur. */
export function trackStepNow(inst: TrackKey): number {
  const h = extHead.get();
  if (!h) return -1;
  return trackStepAt(h, pattern.stepCount(), pattern.loopPage(), trackLen(inst));
}
