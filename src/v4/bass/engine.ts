/**
 * Le moteur du MM-BASS cote page (2026-10-07) : le worklet de
 * bass/bass.worklet.js sur le contexte du site (cree au premier geste), sa
 * sortie sur le bus de la page (l'analyseur, puis le limiteur : ?mute=1
 * tient), les reglages qui suivent les potards, les notes de la sequence et
 * celles jouees a la main, et ce qui sonne (la coupure du moment, la note
 * tenue : l'ecran les montre).
 */

import workletUrl from './bass.worklet.js?url';
import { setBassDuck, synthPort } from '../audio/drums';
import { pattern } from '../audio/pattern';
import { ENGINE_IDS, bassParams, sidechainDepth } from './params';
import type { BassLocks } from './state';

/** La duree d'un pas (une double croche) au tempo du motif. */
const stepS = (): number => 60 / Math.max(20, pattern.get().bpm) / 4;

interface Graph {
  ctx: AudioContext;
  node: AudioWorkletNode;
}

let graph: Graph | null = null;
let loading: Promise<Graph | null> | null = null;
let moduleCtx: BaseAudioContext | null = null;

/** Ce qui sonne : la coupure (Hz), l'enveloppe du filtre, la note tenue (-1 : rien), l'instant du rapport. */
const live = { cut: 0, env: 0, gate: false, midi: -1, peak: 0, at: 0 };
const liveListeners = new Set<() => void>();

/**
 * Les reglages du worklet ; les reglages fins de la voix aussi (2026-10-08 ; LENGTH n'en est pas un : la duree des notes, seq.ts),
 * et ceux des pages de la machine Elektron (le meme jour : PW, KEY TRK, l'ampli, le DELAY, la REVERB). Depuis le moteur
 * MONARK (2026-10-09) : la liste vient de bass/params.ts ENGINE_IDS (les 44, toujours tous : un reglage jamais envoye
 * sonnerait sur la valeur d'heritage du worklet).
 */
function params(): Record<string, number> {
  const v = bassParams.get();
  const out: Record<string, number> = {};
  for (const id of ENGINE_IDS) out[id] = v[id];
  return out;
}

/** Les verrous du son d'un pas, sans LENGTH (la duree de sa note, seq.ts) : null s'il n'en reste aucun. */
export function soundLocks(l: BassLocks | null | undefined): BassLocks | null {
  if (!l) return null;
  // Seulement des nombres finis (2026-10-09, Mika : "je baisse DRIVE au max et plus de son dans BASS") : une valeur
  // undefined ou NaN dans un verrou faisait taire le worklet jusqu'au rechargement ; LENGTH n'est pas un reglage du son
  const out: BassLocks = {};
  let n = 0;
  for (const [k, v] of Object.entries(l)) {
    if (k === 'length' || typeof v !== 'number' || !Number.isFinite(v)) continue;
    (out as Record<string, number>)[k] = v;
    n += 1;
  }
  return n ? out : null;
}

function ensure(): Promise<Graph | null> {
  if (graph) return Promise.resolve(graph);
  if (loading) return loading;
  const port = synthPort();
  if (!port || !port.ctx.audioWorklet) return Promise.resolve(null);
  const ctx = port.ctx as AudioContext;
  const add = moduleCtx === ctx ? Promise.resolve() : ctx.audioWorklet.addModule(workletUrl);
  moduleCtx = ctx;
  loading = add
    .then(() => {
      const node = new AudioWorkletNode(ctx, 'mm-bass', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
      node.port.onmessage = (e: MessageEvent<{ type: string; cut: number; env: number; gate: boolean; midi: number; peak: number }>) => {
        const m = e.data;
        if (m.type !== 'pos') return;
        live.cut = m.cut;
        live.env = m.env;
        live.gate = m.gate;
        live.midi = m.midi;
        live.peak = m.peak;
        live.at = performance.now();
        liveListeners.forEach((fn) => fn());
      };
      // Sa prise (2026-10-07) : le master, ou la voie 2 du mixer du MM-DECKS (audio/drums.ts routeMachines)
      node.connect(port.bass);
      node.port.postMessage({ type: 'params', p: params() });
      node.port.postMessage({ type: 'tempo', step: stepS() });
      graph = { ctx, node };
      return graph;
    })
    .catch(() => null)
    .finally(() => {
      loading = null;
    });
  return loading;
}

bassParams.subscribe(() => graph?.node.port.postMessage({ type: 'params', p: params() }));
// SIDECHAIN (2026-10-10) : pas un reglage du worklet ; l'entree du MM-BASS baisse a chaque kick du MM-RYTM (audio/drums.ts)
const applyDuck = (): void => setBassDuck(sidechainDepth(bassParams.of('sidechain')));
bassParams.subscribe(applyDuck);
applyDuck();
// Le tempo : le temps du DELAY reste en pas (2026-10-08)
let lastStep = stepS();
pattern.subscribe(() => {
  const s = stepS();
  if (s === lastStep) return;
  lastStep = s;
  graph?.node.port.postMessage({ type: 'tempo', step: s });
});

/** Un message ; pendant le chargement du worklet, il attend son tour (create : le charger s'il ne l'est pas). */
function send(msg: Record<string, unknown>, create = true): void {
  if (graph) graph.node.port.postMessage(msg);
  else if (create || loading) void ensure().then((g) => g?.node.port.postMessage(msg));
}

export const bassEngine = {
  ensure,
  /** Une note a l'heure at du contexte (0 : tout de suite) ; legato : elle glisse depuis la note tenue ; lock : les verrous de son pas. */
  on(midi: number, acc: boolean, legato: boolean, at = 0, lock: BassLocks | null = null): void {
    send({ type: 'on', at, midi, acc, legato, lock: soundLocks(lock) });
  },
  /** Les verrous d'une liaison a l'heure at (la note continue). */
  lock(at: number, lock: BassLocks | null): void {
    send({ type: 'lock', at, lock: soundLocks(lock) }, false);
  },
  off(at = 0): void {
    send({ type: 'off', at }, false);
  },
  /** La sequence se re-programme : ce qui partait a from ou apres s'oublie. */
  unseq(from: number): void {
    send({ type: 'unseq', time: from }, false);
  },
  stop(): void {
    send({ type: 'stop' }, false);
  },
  get ctx(): AudioContext | null {
    return graph?.ctx ?? null;
  },
  live: (): Readonly<typeof live> => live,
  subscribeLive(fn: () => void): () => void {
    liveListeners.add(fn);
    return () => {
      liveListeners.delete(fn);
    };
  },
  info: () => ({ ready: graph !== null, ...live }),
};
