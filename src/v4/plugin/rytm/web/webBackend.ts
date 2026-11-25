/**
 * MM-RYTM dans le navigateur (2026-11-25, /mm-rytm/play/, Mika : "le plugin en entier, et uniquement en desktop") : la
 * face du VST3 telle quelle (plugin/PluginFace.tsx, plugin/bridge.ts) et, a la place de JUCE, ce module, qui pose
 * window.__JUCE__ avant que la face se charge. Le son est celui du VST3 : son processeur (plugin/mm-rytm/web-engine, en
 * WebAssembly) tourne dans un AudioWorklet (rytmEngine.worklet.js), son fil du calcul dans un Worker
 * (rytmRender.worker.js : les sons et la reponse de la reverb). Ici, l'editeur (PluginEditor.cpp) :
 *
 * - les messages de la face (options()) : mm_program, mm_state, mm_hit, mm_run, mm_fill, mm_ready, mm_log ; le programme
 *   et le coup partent au moteur en texte JSON (UTF-8), lus par le C++ comme le VST3 les lit (juce::JSON) ;
 * - le minuteur (timerCallback, 30 Hz) : mm_transport {playing, internal, step, seq, mask} a chaque pas joue, a chaque
 *   depart ou arret, et une fois par seconde (quietTicks_), seulement page visible (emitEventIfBrowserIsVisible) ;
 * - initialisationData : rien (mmState vide) ; l'etat de la face vit dans son propre espace du localStorage
 *   (arp/web/storage.ts, espace mm.web.rytm.ls:), comme la WebView du VST3 a le sien : jamais les cles mm.v4.* du site.
 *   mm_state (ce que le VST3 garde dans le projet) n'a donc rien a faire.
 * - la banque des samples : la liste du site (virtual:rytm-samples), que le Worker telecharge a la demande.
 *
 * Le contexte audio : celui du site (audio/drums.ts, muet : FLAGS.mute, pose par bridge.start), cree par la face au
 * premier geste ; le worklet s'y branche droit sur la sortie. Avant ce geste, les messages pour le moteur attendent, dans
 * l'ordre, et le Worker calcule deja les sons du programme (a la frequence de la derniere visite, sinon 48 et 44,1 kHz) :
 * le premier PLAY part tout de suite.
 */

import FOUND from 'virtual:rytm-samples';
import { isolateStorage } from '../../arp/web/storage';
import workletUrl from './rytmEngine.worklet.js?url';

type Fn = (o: unknown) => void;
type Obj = Record<string, unknown>;

export type RytmWebStatus = 'idle' | 'starting' | 'running' | 'unavailable' | 'error';

const WASM_URL = '/mm-rytm/mm-rytm-engine.wasm';
// l'espace du localStorage de l'instance (celui du MM-ARP est mm.web.arp.ls:)
const STORAGE_NS = 'mm.web.rytm.ls:';
// les calculs d'avance : avant le geste, la frequence du contexte n'est pas connue ; celle de la derniere visite (gardee
// hors des cles du site), sinon les deux courantes
const SR_KEY = 'mm.web.rytm.sr';
const prefetchRates = (): number[] => {
  let last = 0;
  try {
    last = Number(window.localStorage.getItem(SR_KEY)) || 0;
  } catch {
    /* stockage refuse */
  }
  return last >= 8000 && last <= 384000 ? [last] : [48000, 44100];
};

/* ---------------- les evenements (window.__JUCE__.backend) ---------------- */

const listeners = new Map<string, Set<Fn>>();

/** emitEventIfBrowserIsVisible : comme la WebView, l'evenement arrive apres le code en cours (jamais en reentrance). */
function emit(id: string, o: unknown): void {
  queueMicrotask(() => {
    const set = listeners.get(id);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(o);
      } catch (err) {
        console.error(`MM-RYTM ${id}`, err);
      }
    }
  });
}

/* ---------------- le statut (la page le montre) ---------------- */

let status: RytmWebStatus = 'idle';
let statusMsg = '';
const statusListeners = new Set<() => void>();

function setStatus(s: RytmWebStatus, msg = ''): void {
  if (s === status && msg === statusMsg) return;
  status = s;
  statusMsg = msg;
  statusListeners.forEach((fn) => fn());
}

export const rytmWebStatus = {
  get: (): RytmWebStatus => status,
  message: (): string => statusMsg,
  subscribe(fn: () => void): () => void {
    statusListeners.add(fn);
    return () => {
      statusListeners.delete(fn);
    };
  },
};

/* ---------------- le moteur (le worklet) et son fil du calcul (le Worker) ---------------- */

type EngineMsg = { type: 'program'; bytes: Uint8Array } | { type: 'hit'; bytes: Uint8Array } | { type: 'run'; on: boolean } | { type: 'fill'; on: boolean };

let port: MessagePort | null = null;
/** Les messages d'avant le premier geste (le moteur n'existe pas encore) : rejoues dans l'ordre. */
const queue: EngineMsg[] = [];
const dead = (): boolean => status === 'unavailable' || status === 'error';
const enc = new TextEncoder();

function toEngine(m: EngineMsg): void {
  if (port) {
    port.postMessage(m, 'bytes' in m ? [m.bytes.buffer] : []);
    return;
  }
  if (dead()) return;
  // avant le son : seul le dernier programme compte (FILL et RUN gardent leur ordre)
  if (m.type === 'program') {
    for (let i = queue.length - 1; i >= 0; i -= 1) if (queue[i].type === 'program') queue.splice(i, 1);
  }
  queue.push(m);
}

/** La tete de lecture du moteur (Feedback : playing, internal, step, seq, mask) et ses compteurs. */
let fb: number[] = [0, 0, -1, 0, 0];
let engineStats: Int32Array | null = null;
let peak = 0;
let peakMax = 0;
let held = false;
let fbCount = 0;

let modP: Promise<WebAssembly.Module | null> | null = null;

/** Le moteur compile (fetch au chargement de la page, sans son) ; null : le fichier n'est pas la (pas encore publie). */
function loadModule(): Promise<WebAssembly.Module | null> {
  if (!modP)
    modP = (async () => {
      try {
        const r = await fetch(WASM_URL);
        if (!r.ok) return null;
        return await WebAssembly.compile(await r.arrayBuffer());
      } catch {
        return null;
      }
    })();
  return modP;
}

/** La banque du VST3 (SampleBank : les .wav de public/samples/rytm), telle que le site la liste. */
const bankList = (): { key: string; url: string }[] =>
  FOUND.filter((s) => /\.wav$/i.test(s.file))
    .map((s) => ({ key: `${s.family}/${s.file}`, url: `${import.meta.env.BASE_URL}samples/rytm/${s.family}/${encodeURIComponent(s.file)}` }));

let worker: Worker | null = null;
let workerStats: Obj | null = null;

function startWorker(mod: WebAssembly.Module): void {
  if (worker) return;
  try {
    worker = new Worker(new URL('./rytmRender.worker.js', import.meta.url), { type: 'module' });
  } catch (err) {
    setStatus('error', String((err as Error)?.message ?? err));
    return;
  }
  worker.onmessage = (ev: MessageEvent) => {
    const d = ev.data as Obj;
    if (d.type === 'error') setStatus('error', String(d.msg ?? ''));
    else if (d.type === 'stats') workerStats = d.stats as Obj;
    else if (d.type === 'log') console.warn('MM-RYTM render:', d.msg);
  };
  worker.onerror = () => setStatus('error', 'The sound engine stopped.');
  worker.postMessage({ type: 'init', module: mod, samples: bankList(), rates: prefetchRates() });
  // le programme deja la (bridge.start l'a envoye avant le geste) : ses sons se calculent d'avance
  const last = [...queue].reverse().find((m) => m.type === 'program');
  if (last && last.type === 'program') worker.postMessage({ type: 'prefetch', bytes: last.bytes.slice() });
}

let starting = false;
let ctxRef: AudioContext | null = null;

async function startAudio(): Promise<void> {
  if (starting) return;
  starting = true;
  setStatus('starting');
  const mod = await loadModule();
  if (!mod) {
    unavailable();
    return;
  }
  try {
    // Le contexte du site (cree par la face a ce meme geste : PluginFace.tsx gesture), muet ; le moteur sort a cote
    const [{ context, ensure }, { FLAGS }] = await Promise.all([import('../../../audio/drums'), import('../../../state/flags')]);
    FLAGS.mute = true;
    const c = context() ?? ensure();
    if (!c) {
      setStatus('error', 'Web Audio is not available in this browser.');
      return;
    }
    ctxRef = c;
    startWorker(mod);
    if (!worker) return;
    await c.audioWorklet.addModule(workletUrl);
    const opts = (processorOptions: Obj): AudioWorkletNodeOptions => ({ numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions });
    let node: AudioWorkletNode;
    try {
      node = new AudioWorkletNode(c, 'mm-rytm-engine', opts({ module: mod }));
    } catch {
      // un navigateur qui ne passe pas un WebAssembly.Module au worklet : les octets, compiles la-bas
      node = new AudioWorkletNode(c, 'mm-rytm-engine', opts({ bytes: await (await fetch(WASM_URL)).arrayBuffer() }));
    }
    node.onprocessorerror = () => setStatus('error', 'The sound engine stopped.');
    node.port.onmessage = (ev: MessageEvent) => onEngine(ev.data as Obj);
    // le fil du calcul : un port direct entre le worklet et le Worker
    const ch = new MessageChannel();
    worker.postMessage({ type: 'port', port: ch.port1 }, [ch.port1]);
    node.port.postMessage({ type: 'renderer', port: ch.port2 }, [ch.port2]);
    node.connect(c.destination);
    port = node.port;
    for (const q of queue) port.postMessage(q, 'bytes' in q ? [q.bytes.buffer] : []);
    queue.length = 0;
    if (c.state !== 'running') void c.resume().catch(() => undefined);
  } catch (err) {
    setStatus('error', String((err as Error)?.message ?? err));
  }
}

/** Le moteur n'est pas publie : plus rien n'attend. */
function unavailable(): void {
  setStatus('unavailable');
  queue.length = 0;
}

function onGesture(): void {
  if (!starting) void startAudio();
  else if (ctxRef && ctxRef.state === 'suspended') void ctxRef.resume().catch(() => undefined);
}

function onEngine(d: Obj): void {
  switch (d.type) {
    case 'ready':
      setStatus('running');
      try {
        if (typeof d.sr === 'number') window.localStorage.setItem(SR_KEY, String(d.sr));
      } catch {
        /* stockage refuse */
      }
      break;
    case 'fb': {
      fb = Array.isArray(d.fb) ? (d.fb as number[]) : fb;
      if (d.stats instanceof Int32Array) engineStats = d.stats;
      peak = Number(d.peak) || 0;
      peakMax = Math.max(peakMax, peak);
      held = d.held === true;
      fbCount += 1;
      break;
    }
    case 'error':
      setStatus('error', String(d.msg ?? ''));
      break;
    default:
      break;
  }
}

/* ---------------- l'editeur (PluginEditor.cpp) ---------------- */

let ready = false;
let lastSeq = -1;
let lastPlaying = false;
let lastInternal = false;
let quietTicks = 0;
let sentTransport = 0;

/** timerCallback : la tete de lecture vers la face, a chaque pas joue, a chaque depart ou arret (et une fois par seconde). */
function onTimer(): void {
  if (!ready) return;
  const playing = fb[0] > 0;
  const internal = fb[1] > 0;
  const step = fb[2];
  const seq = fb[3];
  const mask = fb[4];
  quietTicks += 1;
  if (seq === lastSeq && playing === lastPlaying && internal === lastInternal && quietTicks < 30) return;
  lastSeq = seq;
  lastPlaying = playing;
  lastInternal = internal;
  quietTicks = 0;
  if (document.visibilityState === 'hidden') return;
  sentTransport += 1;
  emit('mm_transport', { playing, internal, step: playing ? step : -1, seq, mask });
}

/* ---------------- les messages de la face ---------------- */

const str = (x: unknown): string => (typeof x === 'string' ? x : typeof x === 'number' ? String(x) : '');
/** static_cast<bool>(juce::var) */
const varBool = (x: unknown, d = false): boolean => (x === undefined ? d : typeof x === 'boolean' ? x : typeof x === 'number' ? x !== 0 : typeof x === 'string' ? x.trim() === 'true' || (parseInt(x, 10) || 0) !== 0 : x !== null);

let programs = 0;
let hits = 0;

const handlers: Record<string, (o: Obj) => void> = {
  mm_ready: () => {
    lastSeq = -1;
    quietTicks = 1000;
    ready = true;
  },
  mm_program: (o) => {
    const bytes = enc.encode(str(o.program));
    programs += 1;
    // avant le son, le Worker calcule d'avance (le worklet les lui redemandera)
    if (!port && worker) worker.postMessage({ type: 'prefetch', bytes: bytes.slice() });
    toEngine({ type: 'program', bytes });
  },
  // l'etat de la face : deja dans son espace du localStorage (le VST3 le garde dans le projet)
  mm_state: () => undefined,
  // la WebView passe l'objet du message en JSON, lu par JSON::parse : ici le meme texte
  mm_hit: (o) => {
    hits += 1;
    toEngine({ type: 'hit', bytes: enc.encode(JSON.stringify(o)) });
  },
  mm_run: (o) => toEngine({ type: 'run', on: varBool(o.on) }),
  mm_fill: (o) => toEngine({ type: 'fill', on: varBool(o.on) }),
  mm_log: (o) => console.debug('MM-RYTM face:', str(o.where), str(o.msg)),
};

/* ---------------- window.__JUCE__ ---------------- */

const backend = {
  addEventListener(id: string, fn: Fn): [string, Fn] {
    let set = listeners.get(id);
    if (!set) {
      set = new Set();
      listeners.set(id, set);
    }
    set.add(fn);
    return [id, fn];
  },
  removeEventListener(token: [string, Fn]): void {
    if (Array.isArray(token)) listeners.get(token[0])?.delete(token[1]);
  },
  emitEvent(id: string, o: unknown): void {
    const h = handlers[id];
    if (!h) return;
    h(o && typeof o === 'object' ? (o as Obj) : {});
  },
};

let installed = false;

/**
 * Pose window.__JUCE__ et le stockage de l'instance (a appeler avant le premier module de la face : les stores lisent le
 * localStorage a leur chargement, bridge.start cherche le backend), lance le chargement du moteur et son Worker (sans son)
 * et attend le premier geste pour le contexte audio.
 */
export function installRytmWebBackend(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  isolateStorage(STORAGE_NS);
  (window as unknown as { __JUCE__?: unknown }).__JUCE__ = { initialisationData: {}, backend };
  void loadModule().then((m) => {
    if (!m) unavailable();
    else startWorker(m);
  });
  const opts = { capture: true, passive: true } as const;
  window.addEventListener('pointerdown', onGesture, opts);
  window.addEventListener('keydown', onGesture, opts);
  window.setInterval(onTimer, 1000 / 30);
  // ?probe (les essais sans son, Chromium) : l'etat du moteur, lu par le JS
  if (window.location.search.includes('probe'))
    (window as unknown as { __mmRytmWeb?: unknown }).__mmRytmWeb = {
      status: () => ({ status, msg: statusMsg, ctx: ctxRef?.state ?? null, sr: ctxRef?.sampleRate ?? null, port: port !== null, worker: worker !== null, queued: queue.length, held, programs, hits, fbCount, sentTransport }),
      fb: () => fb.slice(),
      // programs, published, liveNow, liveLater, rendered, delivered, jobs, notes, bpm x 1000, len, loop, sons, coups, pistes jouees, reverb x 1000, swing x 1000
      stats: () => (engineStats ? Array.from(engineStats) : null),
      peak: () => peak,
      peakMax: () => peakMax,
      resetPeak: () => {
        peakMax = 0;
      },
      workerStats: () => {
        worker?.postMessage({ type: 'stats' });
        return workerStats;
      },
    };
}
