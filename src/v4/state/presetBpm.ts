/**
 * Le tempo dans les presets du MM-RYTM (2026-10-27, la revue des coutures de la V.4.2 et du MIXER SYNC, SEAM-1 a
 * SEAM-4). Le SYNC du MIXER (state/tempoSync.ts) fait suivre au MM-RYTM la platine MASTER, au centieme ; le TEMPO du
 * potard et du stockage, lui, reste entier (audio/pattern.ts serialize et setBpm : clampBpm). Donc :
 * - pendant le SYNC, le tempo est celui des platines, pas celui du son : il ne compte pas dans ce qu'on reconnait d'un
 *   son (le preset charge et son etoile, EDITED, un son a mettre de cote ou deja mis de cote) ;
 * - hors SYNC, il compte au BPM entier, celui qu'apply pose (un preset garde a 124.37 et rendu a 124 est le meme son) ;
 * - SAVE, OVERWRITE et un son mis de cote gardent le BPM entier.
 * Sans import (npm run presets:test le charge tel quel) : clamp est audio/pattern.ts clampBpm.
 */

type Clamp = (bpm: number) => number;

/** Un etat tel qu'il se compare : sans bpm pendant le SYNC (synced), au BPM entier sinon ; sans bpm : tel quel. */
export function bpmForSig(o: Record<string, unknown>, synced: boolean, clamp: Clamp): Record<string, unknown> {
  if (!('bpm' in o)) return o;
  const { bpm, ...rest } = o;
  if (synced) return rest;
  return typeof bpm === 'number' ? { ...rest, bpm: clamp(bpm) } : o;
}

/** Un etat a garder (SAVE, OVERWRITE, un son mis de cote) : au BPM entier, comme le stockage du motif. */
export function bpmToKeep<T extends { bpm?: unknown }>(d: T, clamp: Clamp): T {
  return typeof d.bpm === 'number' ? { ...d, bpm: clamp(d.bpm) } : d;
}
