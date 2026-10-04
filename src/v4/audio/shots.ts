/**
 * Les one-shots du MM-RYTM, prets a jouer (2026-10-03) : le calcul est dans
 * audio/shotsdsp.ts (fait dans un worker, audio/shots.worker.ts), ce module
 * garde les AudioBuffer et choisit celui de chaque coup.
 * - Un echantillon depend de son STRETCH (la duree des enveloppes),
 *   arrondi au huitieme de facteur 4 (shotKey) : calcule a la demande, garde
 *   (LRU, MAX_ENTRIES).
 * - shots.warm() prepare tous les sons a STRETCH 0, un a la fois, dans
 *   le worker (sans worker : une tache chacun), la variante 0 de chaque son
 *   d'abord, dans l'ordre du motif d'arrivee. Une premiere fois a 48 kHz
 *   des que la page est calme (shots.prewarm, sans aucun AudioContext), puis
 *   a la frequence du contexte des qu'il existe.
 * - Un coup dont l'echantillon n'est pas pret prend le plus proche deja
 *   calcule : meme frequence et STRETCH voisin, sinon l'autre frequence (le
 *   navigateur reechantillonne), sinon une autre variante ; et le bon part
 *   en file. Aucun : calcule tout de suite (le rendu hors ligne passe
 *   toujours par la, sync).
 * - Les sons bruites ont plusieurs variantes, tirees au hasard, jamais deux
 *   fois la meme de suite.
 * - TONE (2026-10-04, pour l'ecoute aux intra-auriculaires) : un coup
 *   transpose n'est plus relu plus vite ou plus lentement (le navigateur
 *   interpole lineairement : aigus ternis et flottants) ; il est calcule a
 *   sa hauteur, au millieme de demi-ton (pitchKey) : rendu a sr / pf puis
 *   lu a sr, vitesse 1, l'echantillon exact. En attendant qu'il soit pret,
 *   le plus proche, relu a la vitesse qu'il faut.
 */

import { renderShot, VARIANTS, type ShotId } from './shotsdsp';

export type { ShotId } from './shotsdsp';

/** STRETCH arrondi au huitieme de facteur 4 : la cle d'un echantillon. */
export const shotKey = (ts: number): number => Math.max(-11, Math.min(10, Math.round((Math.log(ts) / Math.log(4)) * 8)));
const keyTs = (k: number): number => Math.pow(4, k / 8);
/** TONE en milliemes de demi-ton : la hauteur d'un echantillon. */
export const pitchKey = (pf: number): number => Math.round(Math.log2(pf) * 12000);
const keyPf = (pk: number): number => Math.pow(2, pk / 12000);

const MAX_ENTRIES = 160;
/** Ordre du prechauffage : les voix du motif d'arrivee d'abord. */
const IDS: readonly ShotId[] = ['BD', 'CH', 'CP', 'SD', 'TOM', 'CY', 'OH', 'RS', 'HT', 'PC', 'CHopen'];
/** Frequence du prechauffage, avant tout contexte (la plus courante). */
const PREWARM_SR = 48000;
let prewarmed = false;

interface Job {
  key: string;
  id: ShotId;
  /** frequence du contexte (celle de l'AudioBuffer) */
  sr: number;
  ts: number;
  v: number;
  /** hauteur (milliemes de demi-ton) : le calcul se fait a sr / pf */
  pk: number;
}

/** Un coup pret a partir : l'echantillon, et sa vitesse de lecture (1 : exact). */
export interface ShotPlay {
  buf: AudioBuffer;
  rate: number;
}

const cache = new Map<string, AudioBuffer>();
const queue: Job[] = [];
/** La commande en cours dans le worker (une a la fois). */
let busy: Job | null = null;
/** undefined : pas encore essaye ; null : pas de worker (calcul sur le fil principal). */
let worker: Worker | null | undefined;
const stats = { rendered: 0, ms: 0, sync: 0, nearest: 0, inWorker: 0 };
/** La derniere variante jouee de chaque son. */
const lastVar = new Map<ShotId, number>();

const cacheKey = (id: ShotId, k: number, v: number, sr: number, pk = 0): string => `${id}|${k}|${v}|${sr}|${pk}`;

function toBuffer(L: Float32Array, R: Float32Array | null, sr: number): AudioBuffer {
  const b = new AudioBuffer({ length: L.length, numberOfChannels: 2, sampleRate: sr });
  b.copyToChannel(L, 0);
  b.copyToChannel(R ?? L, 1);
  return b;
}

function put(key: string, b: AudioBuffer): void {
  cache.delete(key);
  cache.set(key, b);
  while (cache.size > MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

/** Calcul sur le fil principal (sans worker, ou un coup qui ne peut pas attendre). */
function makeNow(j: Job): AudioBuffer {
  const t0 = performance.now();
  const s = renderShot(j.id, j.sr / keyPf(j.pk), j.ts, j.v);
  const b = toBuffer(s.L, s.L === s.R ? null : s.R, j.sr);
  stats.ms += performance.now() - t0;
  stats.rendered += 1;
  put(j.key, b);
  return b;
}

function onDone(e: MessageEvent<{ key: string; L: Float32Array; R: Float32Array | null; ms: number }>): void {
  const d = e.data;
  const j = busy;
  busy = null;
  if (j && j.key === d.key && !cache.has(d.key)) {
    put(d.key, toBuffer(d.L, d.R, j.sr));
    stats.rendered += 1;
    stats.inWorker += 1;
    stats.ms += d.ms;
  }
  pump();
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    const w = new Worker(new URL('./shots.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = onDone;
    w.onerror = () => {
      // Le worker ne demarre pas (ou plante) : tout se calcule sur le fil principal
      w.terminate();
      worker = null;
      const j = busy;
      busy = null;
      if (j) queue.unshift(j);
      pump();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

function pump(): void {
  if (busy) return;
  let j = queue.shift();
  while (j && cache.has(j.key)) j = queue.shift();
  if (!j) return;
  const w = getWorker();
  busy = j;
  if (w) {
    // Le worker calcule a la frequence de rendu (sr / pf) ; le buffer gardera sr
    w.postMessage({ key: j.key, id: j.id, sr: j.sr / keyPf(j.pk), ts: j.ts, v: j.v });
    return;
  }
  setTimeout(() => {
    const cur = busy;
    busy = null;
    if (cur && !cache.has(cur.key)) makeNow(cur);
    pump();
  }, 0);
}

function enqueue(id: ShotId, k: number, v: number, sr: number, pk = 0): void {
  const key = cacheKey(id, k, v, sr, pk);
  if (cache.has(key) || busy?.key === key || queue.some((j) => j.key === key)) return;
  queue.push({ key, id, sr, ts: keyTs(k), v, pk });
  pump();
}

export const shots = {
  /** Prepare tous les sons a STRETCH 0 (le contexte vient d'etre cree). */
  warm(sr: number): void {
    const most = Math.max(...IDS.map((id) => VARIANTS[id]));
    for (let v = 0; v < most; v += 1) for (const id of IDS) if (v < VARIANTS[id]) enqueue(id, 0, v, sr);
  },
  /** Le prechauffage a 48 kHz, une fois, quand la page est calme (aucun AudioContext). */
  prewarm(): void {
    if (prewarmed || typeof window === 'undefined') return;
    prewarmed = true;
    const go = (): void => shots.warm(PREWARM_SR);
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(go, { timeout: 3000 });
    else setTimeout(go, 1000);
  },
  /**
   * L'echantillon d'un coup : sa variante (au hasard, jamais la derniere),
   * son STRETCH, sa hauteur (pf, TONE). sync : jamais d'approximation
   * (rendu hors ligne).
   */
  get(id: ShotId, ts: number, pf: number, sr: number, sync = false): ShotPlay {
    const n = VARIANTS[id];
    let v = n > 1 ? Math.floor(Math.random() * (n - 1)) : 0;
    if (n > 1 && v >= (lastVar.get(id) ?? -1)) v += 1;
    v = Math.min(n - 1, v);
    lastVar.set(id, v);
    const k = shotKey(ts);
    const pk = pitchKey(pf);
    const key = cacheKey(id, k, v, sr, pk);
    const hit = cache.get(key);
    if (hit) return { buf: hit, rate: 1 };
    if (!sync) {
      // Le plus proche : STRETCH voisin (1 par cran), hauteur (2 par demi-ton), autre frequence (+30), autre variante (+60)
      let best: AudioBuffer | null = null;
      let bestPk = 0;
      let score = Infinity;
      const pre = `${id}|`;
      for (const [ck, b] of cache) {
        if (!ck.startsWith(pre)) continue;
        const [, kk, vv, ss, pp] = ck.split('|');
        const sc = Math.abs(Number(kk) - k) + Math.abs(Number(pp) - pk) / 500 + (Number(ss) === sr ? 0 : 30) + (Number(vv) === v ? 0 : 60);
        if (sc < score) {
          best = b;
          bestPk = Number(pp);
          score = sc;
        }
      }
      if (best) {
        stats.nearest += 1;
        enqueue(id, k, v, sr, pk);
        return { buf: best, rate: pf / keyPf(bestPk) };
      }
    }
    stats.sync += 1;
    return { buf: makeNow({ key, id, sr, ts: keyTs(k), v, pk }), rate: 1 };
  },
  /** La rotation des variantes repart du debut (rendus hors ligne reproductibles). */
  resetRotation(): void {
    lastVar.clear();
  },
  info: () => ({ ...stats, cached: cache.size, queued: queue.length + (busy ? 1 : 0), worker: worker === undefined ? 'idle' : worker ? 'on' : 'off' }),
};
