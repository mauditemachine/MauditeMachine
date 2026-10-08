/**
 * L'analyse d'un morceau hors du fil principal (2026-10-08, dj/math.ts
 * trackGridSteps) : le tempo et la grille des temps d'un morceau de 7
 * minutes demandent quelques centaines de millisecondes de calcul, bien plus
 * sur un telephone ; ici, la scene et l'autre platine ne sautent aucune
 * image pendant ANALYSING. Recoit le signal (deja reduit a 11 kHz environ par
 * dj/actions.ts, transfere sans copie), renvoie la grille.
 */

import { analyseTrack, type TrackGrid } from './math';

interface Job {
  id: number;
  x: Float32Array;
  rate: number;
  hint: number | null;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Job>) => void) | null;
  postMessage(m: { id: number; grid: TrackGrid | null; ms: number }): void;
};

scope.onmessage = (e) => {
  const j = e.data;
  const t0 = performance.now();
  let grid: TrackGrid | null = null;
  try {
    grid = analyseTrack(j.x, j.rate, j.hint);
  } catch {
    grid = null;
  }
  scope.postMessage({ id: j.id, grid, ms: performance.now() - t0 });
};
