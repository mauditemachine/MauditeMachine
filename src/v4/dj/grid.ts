/**
 * L'analyse d'un morceau (2026-10-08, dj/math.ts trackGridSteps) dans un
 * worker (dj/grid.worker.ts) : sur le signal reduit a 11 kHz environ
 * (analysisSignal), transfere sans copie ; la scene et l'autre platine ne
 * sautent aucune image pendant ANALYSING, et la caisse analyse ses fichiers
 * en fond sans geler la liste. Sans worker (ou s'il plante) : sur le fil
 * principal, par tranches de SLICE_MS. Partage par le chargement d'une
 * platine (dj/actions.ts djLoad) et la caisse (dj/crate.ts).
 */

import { analysisSignal, trackGridSteps, type TrackGrid } from './math';

const SLICE_MS = 12;
let worker: Worker | null | undefined;
let job = 0;
/** les analyses en cours dans le worker : leur reponse (undefined : le worker a plante) */
const waiting = new Map<number, (g: TrackGrid | null | undefined) => void>();
/** La duree de la derniere analyse (ms, le calcul seul ; le debug, les tests). */
let lastMs = 0;
export const gridAnalyseMs = (): number => lastMs;

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    const w = new Worker(new URL('./grid.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (m: MessageEvent<{ id: number; grid: TrackGrid | null; ms: number }>) => {
      lastMs = m.data.ms;
      waiting.get(m.data.id)?.(m.data.grid);
      waiting.delete(m.data.id);
    };
    w.onerror = () => {
      w.terminate();
      worker = null;
      for (const done of waiting.values()) done(undefined);
      waiting.clear();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/**
 * Le tempo et la grille d'un morceau (signal : un canal, a sa frequence) ;
 * hint : un BPM connu, ou null. null : morceau trop court, sans attaques, ou
 * abort leve entre-temps (un autre morceau arrive).
 */
export async function analyseGrid(signal: Float32Array, rate: number, hint: number | null, abort?: AbortSignal): Promise<TrackGrid | null> {
  const s = analysisSignal(signal, rate);
  const w = getWorker();
  if (w) {
    const id = ++job;
    const grid = await new Promise<TrackGrid | null | undefined>((done) => {
      waiting.set(id, done);
      w.postMessage({ id, x: s.x, rate: s.rate, hint }, [s.x.buffer]);
    });
    if (abort?.aborted) return null;
    if (grid !== undefined) return grid;
    // Le worker a plante : le signal est parti avec lui, on le refait sur le fil principal
    return analyseGrid(signal, rate, hint, abort);
  }
  const t0 = performance.now();
  const it = trackGridSteps(s.x, s.rate, hint);
  let r = it.next();
  while (!r.done) {
    await new Promise<void>((done) => window.setTimeout(done, 0));
    if (abort?.aborted) return null;
    const t1 = performance.now();
    while (!r.done && performance.now() - t1 < SLICE_MS) r = it.next();
  }
  lastMs = performance.now() - t0;
  return r.value;
}
