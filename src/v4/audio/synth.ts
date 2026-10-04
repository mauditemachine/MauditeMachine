/**
 * Le son du MM-VOYAGER (2026-10-03, revu le meme jour apres l'essai de
 * Mika : "beaucoup de knobs qui ne fonctionnent pas", "les FX flagrants",
 * "le plus proche possible d'un Voyager"). Le moteur est un AudioWorklet
 * (audio/moog.worklet.js : trois oscillateurs, filtre en echelle 24 dB,
 * enveloppes analogiques, DIST dans le filtre et a sa sortie), charge au
 * premier geste. Il joue les notes que l'arpegiateur lui envoie, chacune a
 * son instant (temps du contexte).
 *
 * Apres lui, dans le graphe :
 *   moteur -> CHORUS (facon Juno-106, chorus.ts) -> VOLUME -> compresseur
 *   de la boite a rythmes (drums.synthPort : analyseur, ecreteur, master,
 *   ?mute=1 tient)
 *   VOLUME -> DELAY : le sien, ping-pong stereo en croche pointee calee sur
 *   le tempo, reinjection qui monte avec le potard (0.35 a 0.68)
 *   VOLUME -> REVERB : la reverbe de la boite, envoi renforce.
 * Le contexte audio est celui de la page, jamais cree ici.
 */

import workletUrl from './moog.worklet.js?url';
import { engineParams, voyParams, type VoyValues } from '../voyager/params';
import { buildJunoChorus, type ChorusStage } from './chorus';
import { synthPort } from './drums';
import { glide } from './glide';
import { pattern } from './pattern';
import type { Send } from './sends';

/**
 * Surechantillonnage du moteur (2026-10-03, qualite) : 4 sur ordinateur,
 * 2 au telephone (pointeur grossier : le calcul compte plus).
 */
const engineOs = (): number => (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 2 : 4);

/** VOLUME a 1 (gain au carre), et reprise de niveau : DELAY et REVERB s'ajoutent au son sec. */
const VOLUME_K = 1.15;
const MAKEUP = { delay: 0.35, reverb: 0.5 } as const;
/** REVERB : envoi renforce vers la reverbe partagee. */
const REVERB_BOOST = 1.25;
/** DELAY ping-pong : croche pointee, reinjection 0.35 a 0.68, filtre dans la boucle. */
const PINGPONG = { steps: 3, fbMin: 0.35, fbMax: 0.68, wet: 1.1, lowpass: 4800, highpass: 260, maxS: 2 } as const;

interface SynthGraph {
  ctx: BaseAudioContext;
  node: AudioWorkletNode;
  chorus: ChorusStage;
  vol: GainNode;
  delaySend: GainNode;
  delayFb: [GainNode, GainNode];
  delayL: DelayNode;
  delayR: DelayNode;
  reverb: Send;
}

let sg: SynthGraph | null = null;
let loading: Promise<void> | null = null;
let failed = false;
/** notes envoyees avant que le moteur soit pret : parties a son arrivee */
const early: { midi: number; time: number; gate: number; accent: number; from: number | null }[] = [];
let notes = 0;

const stepOf = (): number => 60 / pattern.get().bpm / 4;

/** Le delay ping-pong du synthe : gauche, droite, gauche... en croche pointee. */
function buildPingPong(c: BaseAudioContext, out: AudioNode): { send: GainNode; fb: [GainNode, GainNode]; l: DelayNode; r: DelayNode } {
  const send = c.createGain();
  send.gain.value = 0;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = PINGPONG.highpass;
  const t = Math.min(PINGPONG.maxS, PINGPONG.steps * stepOf());
  const l = c.createDelay(PINGPONG.maxS);
  const r = c.createDelay(PINGPONG.maxS);
  l.delayTime.value = t;
  r.delayTime.value = t;
  const lpL = c.createBiquadFilter();
  lpL.type = 'lowpass';
  lpL.frequency.value = PINGPONG.lowpass;
  const lpR = c.createBiquadFilter();
  lpR.type = 'lowpass';
  lpR.frequency.value = PINGPONG.lowpass;
  const fbL = c.createGain();
  const fbR = c.createGain();
  fbL.gain.value = PINGPONG.fbMin;
  fbR.gain.value = PINGPONG.fbMin;
  const merge = c.createChannelMerger(2);
  // Mono vers la gauche ; la gauche repond a droite, la droite a gauche
  send.connect(hp);
  hp.connect(l);
  l.connect(lpL);
  lpL.connect(merge, 0, 0);
  lpL.connect(fbL);
  fbL.connect(r);
  r.connect(lpR);
  lpR.connect(merge, 0, 1);
  lpR.connect(fbR);
  fbR.connect(l);
  const wet = c.createGain();
  wet.gain.value = PINGPONG.wet;
  merge.connect(wet);
  wet.connect(out);
  return { send, fb: [fbL, fbR], l, r };
}

function build(c: BaseAudioContext, out: AudioNode, reverb: { attach(src: AudioNode): Send }, node: AudioWorkletNode): SynthGraph {
  const vol = c.createGain();
  vol.gain.value = 0;
  vol.connect(out);
  const chorus = buildJunoChorus(c, vol);
  node.connect(chorus.input);
  const pp = buildPingPong(c, out);
  vol.connect(pp.send);
  const boost = c.createGain();
  boost.gain.value = REVERB_BOOST;
  vol.connect(boost);
  const g: SynthGraph = { ctx: c, node, chorus, vol, delaySend: pp.send, delayFb: pp.fb, delayL: pp.l, delayR: pp.r, reverb: reverb.attach(boost) };
  applyFx(g, voyParams.get(), true);
  return g;
}

/** CHORUS, DELAY, REVERB et VOLUME sur la chaine. */
function applyFx(g: SynthGraph, p: Readonly<VoyValues>, now = false): void {
  g.chorus.set(p.chorus);
  g.reverb.set(p.reverb);
  const fb = PINGPONG.fbMin + (PINGPONG.fbMax - PINGPONG.fbMin) * p.delay;
  const v = (p.volume * p.volume * VOLUME_K) / (1 + MAKEUP.delay * p.delay + MAKEUP.reverb * p.reverb);
  if (now) {
    g.vol.gain.value = v;
    g.delaySend.gain.value = p.delay;
    g.delayFb[0].gain.value = fb;
    g.delayFb[1].gain.value = fb;
  } else {
    glide(g.vol.gain, v, g.ctx);
    glide(g.delaySend.gain, p.delay, g.ctx);
    glide(g.delayFb[0].gain, fb, g.ctx);
    glide(g.delayFb[1].gain, fb, g.ctx);
  }
}

voyParams.subscribe(() => {
  if (!sg) return;
  applyFx(sg, voyParams.get());
  sg.node.port.postMessage({ type: 'params', params: engineParams(voyParams.get()) });
});

/* Tempo : le delay reste une croche pointee. */
pattern.subscribe(() => {
  if (!sg) return;
  const t = Math.min(PINGPONG.maxS, PINGPONG.steps * stepOf());
  glide(sg.delayL.delayTime, t, sg.ctx);
  glide(sg.delayR.delayTime, t, sg.ctx);
});

/**
 * Charge le moteur sur le contexte de la page (au premier geste, et des
 * qu'une note est demandee) ; sans contexte ou sans AudioWorklet, rien.
 */
export function prepareSynth(): void {
  if (sg || loading || failed) return;
  const port = synthPort();
  if (!port || !port.ctx.audioWorklet) return;
  const c = port.ctx;
  loading = c.audioWorklet
    .addModule(workletUrl)
    .then(() => {
      const node = new AudioWorkletNode(c, 'mm-voyager', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { params: engineParams(voyParams.get()), os: engineOs() },
      });
      sg = build(c, port.input, port.reverb, node);
      // Les notes arrivees avant le moteur : celles encore a venir partent
      const now = c.currentTime;
      for (const n of early) if (n.time > now - 0.05) node.port.postMessage({ type: 'note', ...n, time: Math.max(n.time, now) });
      early.length = 0;
    })
    .catch(() => {
      failed = true;
    })
    .finally(() => {
      loading = null;
    });
}

/**
 * Une note a `time` (temps du contexte), porte de `gate` s ; from : la
 * note precedente (GLIDE). false sans contexte.
 */
export function noteOn(midi: number, time: number, gate: number, from: number | null = null, accent = 1): boolean {
  const msg = { midi, time, gate: Math.max(0.02, gate), accent, from };
  notes += 1;
  if (sg) {
    sg.node.port.postMessage({ type: 'note', ...msg });
    return true;
  }
  if (!synthPort()) return false;
  early.push(msg);
  prepareSynth();
  return true;
}

/** STOP de l'arpegiateur : plus rien d'attendu, ce qui sonne s'eteint en 12 ms. */
export function synthStop(): void {
  early.length = 0;
  if (sg) sg.node.port.postMessage({ type: 'stop', time: sg.ctx.currentTime });
}

/* ---------------- rendu hors ligne (tests : rien ne sort des enceintes) ---------------- */

export interface SynthOfflineOpts {
  seconds: number;
  sampleRate?: number;
  /** notes [midi, debut (s), porte (s)] ; accent 1 */
  notes: [number, number, number][];
  /** reglages imposes (les autres : ceux du store) */
  params?: Partial<VoyValues>;
  /** envois REVERB et DELAY (true par defaut) */
  sends?: boolean;
  /** surechantillonnage du moteur (4 par defaut) */
  os?: 1 | 2 | 4;
}

/** Rendu stereo hors ligne de la chaine complete ; renvoie [gauche, droite]. */
export async function renderSynthOffline(o: SynthOfflineOpts): Promise<[Float32Array, Float32Array]> {
  const sr = o.sampleRate ?? 48000;
  const oc = new OfflineAudioContext(2, Math.round(o.seconds * sr), sr);
  await oc.audioWorklet.addModule(workletUrl);
  const { buildReverbBus } = await import('./sends');
  const out = oc.createGain();
  out.connect(oc.destination);
  const reverb = buildReverbBus(oc, out);
  const p = { ...voyParams.get(), ...(o.params ?? {}) };
  let prev: number | null = null;
  const list = o.notes.map(([m, t, gate]) => {
    const n = { midi: m, time: t, gate, accent: 1, from: prev };
    prev = m;
    return n;
  });
  const node = new AudioWorkletNode(oc, 'mm-voyager', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: { params: engineParams(p), notes: list, os: o.os ?? 4 },
  });
  const noSend = { attach: () => ({ set: () => undefined, info: () => ({ value: 0, linked: false }) }) };
  const g = build(oc, out, o.sends === false ? noSend : reverb, node);
  applyFx(g, o.sends === false ? { ...p, delay: 0, reverb: 0 } : p, true);
  const buf = await oc.startRendering();
  return [buf.getChannelData(0).slice(), buf.getChannelData(1).slice()];
}

/* ---------------- debug (window.__v4.voyager.synth) ---------------- */

export const synthDebug = {
  get built(): boolean {
    return sg !== null;
  },
  get failed(): boolean {
    return failed;
  },
  get notes(): number {
    return notes;
  },
  get volGain(): number | undefined {
    return sg?.vol.gain.value;
  },
  get chorus() {
    return sg?.chorus.info() ?? null;
  },
  renderOffline: renderSynthOffline,
};
