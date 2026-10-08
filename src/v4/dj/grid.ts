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
/**
 * Un worker par analyse en cours (relecture du 2026-10-08) : avec un seul,
 * les analyses faisaient la queue, et une analyse abandonnee (un autre
 * morceau pose sur la platine, la caisse en fond) tournait jusqu'au bout,
 * retardant d'autant le ANALYSING suivant. Abandonnee, son worker s'arrete
 * net ; finie, il attend la suivante (un seul garde au repos).
 */
let idle: Worker | null = null;
/** false : pas de worker possible (navigateur, ou un worker a plante), le fil principal prend le relais */
let workers = true;
/** La duree de la derniere analyse (ms, le calcul seul ; le debug, les tests). */
let lastMs = 0;
export const gridAnalyseMs = (): number => lastMs;

function takeWorker(): Worker | null {
  if (!workers) return null;
  if (idle) {
    const w = idle;
    idle = null;
    return w;
  }
  try {
    return new Worker(new URL('./grid.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    workers = false;
    return null;
  }
}

function giveBack(w: Worker): void {
  w.onmessage = null;
  w.onerror = null;
  if (idle) w.terminate();
  else idle = w;
}

/** Une analyse dans un worker : la grille, null (abandonnee) ou undefined (le worker a plante). */
function inWorker(w: Worker, x: Float32Array, rate: number, hint: number | null, abort?: AbortSignal): Promise<TrackGrid | null | undefined> {
  return new Promise((done) => {
    const stop = (): void => {
      w.terminate();
      done(null);
    };
    abort?.addEventListener('abort', stop, { once: true });
    w.onmessage = (m: MessageEvent<{ grid: TrackGrid | null; ms: number }>) => {
      abort?.removeEventListener('abort', stop);
      lastMs = m.data.ms;
      giveBack(w);
      done(m.data.grid);
    };
    w.onerror = () => {
      abort?.removeEventListener('abort', stop);
      w.terminate();
      workers = false;
      done(undefined);
    };
    w.postMessage({ id: 0, x, rate, hint }, [x.buffer]);
  });
}

/**
 * Le tempo et la grille d'un morceau (signal : un canal, a sa frequence) ;
 * hint : un BPM connu, ou null. null : morceau trop court, sans attaques, ou
 * abort leve entre-temps (un autre morceau arrive).
 */
export async function analyseGrid(signal: Float32Array, rate: number, hint: number | null, abort?: AbortSignal): Promise<TrackGrid | null> {
  if (abort?.aborted) return null;
  const s = analysisSignal(signal, rate);
  const w = takeWorker();
  if (w) {
    const grid = await inWorker(w, s.x, s.rate, hint, abort);
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
