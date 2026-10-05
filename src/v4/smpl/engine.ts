/**
 * Le moteur du MM-SMPL cote page (2026-10-04) : il garde le sample (ses
 * canaux, sa frequence, son mono pour l'ecran et les attaques), le confie
 * au worklet (smpl/smpl.worklet.js), lui passe les voix, les nuages et les
 * reglages, et recoit les positions qui jouent (l'ecran les montre).
 *
 * Apres le worklet : FILTER (deux biquads en serie, un passe-bas puis un
 * passe-haut, jamais de changement de type : plus de trou en passant le
 * milieu, 2026-10-05), LEVEL, puis l'analyseur de la boite a rythmes (le bus de sortie du site,
 * avant son limiteur : ?mute=1 tient). REC branche la sortie du site
 * (apres le limiteur) sur l'entree du worklet le temps de l'enregistrement.
 *
 * Le dernier sample est retenu dans le navigateur (IndexedDB mm-smpl) : il
 * revient a la visite suivante. Au plus SMPL_MAX_S secondes.
 * 2026-10-05 : un message envoye pendant le chargement du worklet attend son
 * tour (un lacher tres rapide au premier toucher ne laisse plus une note
 * bloquee).
 */

import workletUrl from './smpl.worklet.js?url';
import { synthPort } from '../audio/drums';
import { attackS, densityHz, filterOf, levelGain, pitchSemis, releaseS, scanSpeed, sizeS, smplParams } from './params';
import { monoOf } from './slices';
import { smplState } from './state';

/** La plus longue prise (secondes) : la memoire d'un telephone. */
export const SMPL_MAX_S = 60;

interface Graph {
  ctx: AudioContext;
  node: AudioWorkletNode;
  filter: BiquadFilterNode;
  hp: BiquadFilterNode;
  level: GainNode;
  /** la sortie du site, branchee sur l'entree pendant REC */
  tap: AudioNode;
}

export interface SmplData {
  channels: Float32Array[];
  rate: number;
  mono: Float32Array;
}

let graph: Graph | null = null;
let loading: Promise<Graph | null> | null = null;
let data: SmplData | null = null;
let recDone: ((d: { channels: Float32Array[]; rate: number } | null) => void) | null = null;

/** Ce qui joue (secondes dans le sample) : les voix et les nuages par identifiant. */
const live = { voices: new Map<number, number>(), clouds: new Map<number, number>(), at: 0 };
const posListeners = new Set<() => void>();

function onMsg(e: MessageEvent<{ type: string; voices?: [number, number][]; clouds?: [number, number][]; L?: Float32Array; R?: Float32Array; rate?: number }>): void {
  const m = e.data;
  if (m.type === 'pos') {
    live.voices = new Map(m.voices ?? []);
    live.clouds = new Map(m.clouds ?? []);
    live.at = performance.now();
    posListeners.forEach((fn) => fn());
  } else if (m.type === 'rec') {
    const done = recDone;
    recDone = null;
    if (graph) {
      try {
        graph.tap.disconnect(graph.node);
      } catch {
        /* deja debranchee */
      }
    }
    done?.(m.L && m.L.length > 1 ? { channels: [m.L, m.R ?? m.L], rate: m.rate ?? 48000 } : null);
  }
}

/** Les reglages du worklet, d'apres les potards et l'etat. */
function workletParams(): Record<string, number | boolean> {
  const v = smplParams.get();
  return {
    attack: attackS(v.attack),
    release: releaseS(v.release),
    size: sizeS(v.size),
    density: densityHz(v.density),
    spray: v.spray,
    scan: scanSpeed(v.scan),
    pitch: pitchSemis(v.pitch),
    reverse: smplState.get().reverse,
  };
}

function applyNodes(g: Graph): void {
  const v = smplParams.get();
  const t = g.ctx.currentTime;
  g.level.gain.setTargetAtTime(levelGain(v.level), t, 0.02);
  const f = filterOf(v.filter);
  // Deux filtres en serie, jamais de changement de type : LP ouvert a 22 kHz, HP ouvert a 10 Hz
  g.filter.frequency.setTargetAtTime(f.type === 'lowpass' ? f.hz : 22000, t, 0.02);
  g.hp.frequency.setTargetAtTime(f.type === 'highpass' ? f.hz : 10, t, 0.02);
}

function sendSample(g: Graph): void {
  if (!data) return;
  // Des copies : le moteur garde les siennes (ecran, attaques, SAVE)
  const L = data.channels[0].slice();
  const R = (data.channels[1] ?? data.channels[0]).slice();
  g.node.port.postMessage({ type: 'sample', L, R, rate: data.rate }, [L.buffer, R.buffer]);
}

/** Le worklet sur le contexte de la page (au premier geste) ; null sans son. */
function ensure(): Promise<Graph | null> {
  if (graph) return Promise.resolve(graph);
  if (loading) return loading;
  const port = synthPort();
  if (!port || !port.ctx.audioWorklet) return Promise.resolve(null);
  const ctx = port.ctx as AudioContext;
  loading = ctx.audioWorklet
    .addModule(workletUrl)
    .then(() => {
      const node = new AudioWorkletNode(ctx, 'mm-smpl', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
      node.port.onmessage = onMsg;
      const filter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 22000, Q: 0.707 });
      const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 10, Q: 0.707 });
      const level = new GainNode(ctx, { gain: levelGain(smplParams.of('level')) });
      node.connect(filter).connect(hp).connect(level).connect(port.input);
      graph = { ctx, node, filter, hp, level, tap: port.out };
      node.port.postMessage({ type: 'params', p: workletParams() });
      applyNodes(graph);
      sendSample(graph);
      return graph;
    })
    .catch(() => null)
    .finally(() => {
      loading = null;
    });
  return loading;
}

// Les potards et REV suivent : le worklet et les noeuds
smplParams.subscribe(() => {
  if (!graph) return;
  graph.node.port.postMessage({ type: 'params', p: workletParams() });
  applyNodes(graph);
});
let lastRev = smplState.get().reverse;
smplState.subscribe(() => {
  const r = smplState.get().reverse;
  if (r === lastRev) return;
  lastRev = r;
  graph?.node.port.postMessage({ type: 'params', p: workletParams() });
});

/* ---------------- la memoire du navigateur ---------------- */

const DB = 'mm-smpl';
const STORE = 'samples';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

interface Stored {
  name: string;
  source: 'deck' | 'file' | 'rec';
  rate: number;
  channels: ArrayBuffer[];
}

async function remember(s: Stored): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(s, 'last');
    await new Promise<void>((done) => {
      tx.oncomplete = () => done();
      tx.onerror = () => done();
      tx.onabort = () => done();
    });
  } catch {
    /* quota depasse, navigation privee : le sample vit pour la visite */
  }
  db.close();
}

async function recall(): Promise<Stored | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('last');
    const out = await new Promise<Stored | null>((done) => {
      req.onsuccess = () => done((req.result as Stored | undefined) ?? null);
      req.onerror = () => done(null);
    });
    db.close();
    return out;
  } catch {
    db.close();
    return null;
  }
}

let sampleId = 0;

/** Un message au worklet ; pendant son chargement, il attend son tour (create : le charger s'il ne l'est pas). */
function send(msg: Record<string, unknown>, create = true): void {
  if (graph) graph.node.port.postMessage(msg);
  else if (create || loading) void ensure().then((g) => g?.node.port.postMessage(msg));
}

export const smplEngine = {
  ensure,
  /** Le sample pose (canaux, frequence, mono), ou null. */
  data: (): SmplData | null => data,
  /**
   * Pose un sample : coupe a SMPL_MAX_S, le confie au worklet, le retient
   * (remember : false au rappel d'une visite passee). Renvoie sa duree.
   */
  setSample(channels: Float32Array[], rate: number, name: string, source: Stored['source'], keep = true): number {
    const max = Math.floor(SMPL_MAX_S * rate);
    const ch = channels.slice(0, 2).map((c) => (c.length > max ? c.slice(0, max) : c));
    data = { channels: ch, rate, mono: monoOf(ch) };
    sampleId += 1;
    const duration = ch[0].length / rate;
    smplState.set({ sample: { id: sampleId, name, source, duration, rate }, pads: [], preview: false });
    if (graph) sendSample(graph);
    if (keep) void remember({ name, source, rate, channels: ch.map((c) => c.slice().buffer) });
    return duration;
  },
  /** Le sample d'une visite passee, s'il y en a un. */
  async restore(): Promise<boolean> {
    if (data) return true;
    const s = await recall();
    if (!s || data || !s.channels?.length) return false;
    smplEngine.setSample(
      s.channels.map((b) => new Float32Array(b)),
      s.rate,
      s.name,
      s.source,
      false
    );
    return true;
  },
  /** Une voix de a a b (s) ; at : l'heure du contexte ou elle part (un pas de la sequence), 0 tout de suite. */
  play(id: number, a: number, b: number, loop: boolean, at = 0): void {
    send({ type: 'play', id, a, b, loop, at });
  },
  /** Un nuage a pos (s) dans [a, b] ; at et dur : un nuage de la sequence (son heure, sa duree). */
  cloud(id: number, pos: number, a: number, b: number, at = 0, dur = 0): void {
    send({ type: 'cloud', id, pos, a, b, at, dur });
  },
  /** Le contexte du son, s'il existe (la sequence s'y cale). */
  get ctx(): AudioContext | null {
    return graph?.ctx ?? null;
  },
  move(id: number, pos: number, a = 0, b = 0): void {
    send({ type: 'move', id, pos, a, b }, false);
  },
  release(id: number): void {
    send({ type: 'release', id }, false);
  },
  stop(): void {
    send({ type: 'stop' }, false);
  },
  /** LOOP pris ou lache : les pads tenus et PLAY suivent */
  loop(on: boolean): void {
    send({ type: 'loop', on }, false);
  },
  /** La sequence se re-programme : ses voix et ses nuages pas encore partis, a partir de `from` (temps du contexte), sont oublies. */
  unseq(from: number): void {
    send({ type: 'unseq', time: from }, false);
  },
  /** REC : enregistre la sortie du site ; la promesse rend la prise au stop (ou a SMPL_MAX_S). */
  async record(): Promise<{ channels: Float32Array[]; rate: number } | null> {
    const g = await ensure();
    if (!g) return null;
    if (recDone) return null;
    g.tap.connect(g.node);
    g.node.port.postMessage({ type: 'rec', on: true, max: SMPL_MAX_S });
    return new Promise((resolve) => {
      recDone = resolve;
    });
  },
  stopRecord(): void {
    graph?.node.port.postMessage({ type: 'rec', on: false });
  },
  get recording(): boolean {
    return recDone !== null;
  },
  /** Ce qui joue : voix et nuages (secondes dans le sample), par identifiant. */
  live: (): { voices: ReadonlyMap<number, number>; clouds: ReadonlyMap<number, number>; at: number } => live,
  /** Les lumieres se revoient sans nouveau rapport du worklet. */
  recheck(): void {
    posListeners.forEach((fn) => fn());
  },
  subscribeLive(fn: () => void): () => void {
    posListeners.add(fn);
    return () => {
      posListeners.delete(fn);
    };
  },
  info: () => ({ ready: graph !== null, sample: data ? { rate: data.rate, length: data.channels[0].length, channels: data.channels.length } : null, voices: live.voices.size, clouds: live.clouds.size }),
};
