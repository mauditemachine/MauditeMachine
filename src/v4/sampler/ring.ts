/**
 * La memoire du MIXER, cote page (2026-10-07) : le worklet de
 * sampler/ring.worklet.js branche sur la sortie du site (audio/drums.ts
 * synthPort().out, apres le limiteur), des que le MM-DECKS a son moteur
 * (dj/actions.ts) : REC MIX d'une platine y prend les temps qui viennent de
 * passer. RING_S secondes : huit mesures a 60 BPM, et un peu de marge.
 */

import ringUrl from './ring.worklet.js?url';
import { synthPort } from '../audio/drums';

export const RING_S = 34;

let node: AudioWorkletNode | null = null;
let ctx: BaseAudioContext | null = null;
let loading: Promise<AudioWorkletNode | null> | null = null;
let asks = 0;
const waiting = new Map<number, (r: { channels: Float32Array[]; rate: number } | null) => void>();

/** Branche la memoire (une fois, apres le premier geste) ; rien sans son. */
export function startRing(): Promise<AudioWorkletNode | null> {
  if (node) return Promise.resolve(node);
  if (loading) return loading;
  const port = synthPort();
  const out = (port as { out?: AudioNode } | null)?.out;
  if (!port || !out || !port.ctx.audioWorklet) return Promise.resolve(null);
  const c = port.ctx as AudioContext;
  loading = c.audioWorklet
    .addModule(ringUrl)
    .then(() => {
      const n = new AudioWorkletNode(c, 'mm-ring', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit', processorOptions: { seconds: RING_S } });
      n.port.onmessage = (e: MessageEvent<{ type: string; id: number; L: Float32Array | null; R: Float32Array | null; rate: number }>) => {
        const m = e.data;
        const done = waiting.get(m.id);
        if (!done) return;
        waiting.delete(m.id);
        done(m.L && m.L.length > 1 ? { channels: [m.L, m.R ?? m.L], rate: m.rate } : null);
      };
      out.connect(n);
      // Tire par la destination (sa sortie est du silence) : le navigateur le fait tourner
      n.connect(c.destination);
      node = n;
      ctx = c;
      return n;
    })
    .catch(() => null)
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Ce que le MIXER a sorti entre t0 et t1 (temps du contexte), ce qui en reste en memoire ; null sans rien. */
export async function grabRing(t0: number, t1: number): Promise<{ channels: Float32Array[]; rate: number } | null> {
  const n = await startRing();
  if (!n || !ctx) return null;
  const rate = ctx.sampleRate;
  asks += 1;
  const id = asks;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    n.port.postMessage({ type: 'grab', id, from: t0 * rate, to: t1 * rate });
    // Le worklet ne repond plus (contexte suspendu) : on n'attend pas indefiniment
    window.setTimeout(() => {
      if (!waiting.has(id)) return;
      waiting.delete(id);
      resolve(null);
    }, 1500);
  });
}

/** La memoire tourne-t-elle ? */
export const ringOn = (): boolean => node !== null;
