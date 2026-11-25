/**
 * MM-ARP dans le navigateur (2026-11-25, /mm-arp/play/, Mika : "le plugin en entier, et uniquement en desktop") : la
 * face du VST3 telle quelle (plugin/arp, bridge.ts), et a la place de JUCE ce module, qui pose window.__JUCE__ avant
 * que la face se charge. Le son est celui du VST3 au bit pres : le moteur (plugin/mm-arp/web-engine, en WebAssembly)
 * tourne dans un AudioWorklet (arpEngine.worklet.js), qui fait le processeur (PluginProcessor.cpp : faceProgram,
 * faceParam, faceRun, MIDI LEARN, arpMidi). Ici, l'editeur (PluginEditor.cpp) :
 *
 * - les messages de la face (options()) : mm_ready, mm_program, mm_state, mm_run, mm_param, mm_gesture, mm_preset_save,
 *   mm_preset_open, mm_preset_list, mm_preset_load, mm_drag_midi, mm_save_mid, mm_learn, mm_view, mm_vis, mm_unmap,
 *   mm_unmap_all, mm_keys, mm_midimap_get, mm_log ;
 * - le minuteur (timerCallback) : 30 Hz face a l'ecran, 4 Hz cachee, un seul mm_tick {k, m, e, c, s} par tick et
 *   seulement ce qui a change (sent_, quietTicks_, cpuTick_, specTick_, la remise a zero de mm_ready). La tete (t) part
 *   en mm_transport (meme objet, juste apres) : bridge.ts la traite pareil, et hostClock.ts (la tete de la page DELAY,
 *   DelayPage2.tsx) ne lit qu'elle ;
 * - les presets du disque : le localStorage de ce navigateur (mm.web.arp.preset:<nom>) ; SAVE TO DISK telecharge aussi
 *   le fichier .mmarp, OPEN FROM DISK ouvre un .mmarp ou un .json (et le garde dans la liste) ;
 * - DRAG MIDI et SAVE .MID : le fichier .mid du VST3 (midiFile.ts), telecharge ;
 * - le MIDI qui entre (Web MIDI) : demande seulement quand on arme MIDI LEARN ou qu'on met MIDI IN sur autre chose que
 *   NOTES (ou si le navigateur l'a deja permis) ;
 * - la graine du hasard et la table MIDI LEARN gardees (localStorage), comme l'etat du projet du VST3. Le reste de
 *   l'etat (potards, suite, progression) est celui de la face, dans son propre espace du localStorage (storage.ts :
 *   jamais les cles du site) ; le moteur le reprend par la regle knobsKnown de faceProgram.
 *
 * Le contexte audio : celui du site (audio/drums.ts, muet : FLAGS.mute), cree par la face au premier geste ; le worklet
 * s'y branche droit sur la sortie. Avant ce geste, les messages pour le moteur attendent, dans l'ordre.
 * Non repris : mm_gesture (pas d'automation d'hote), mm_keys (le clavier reste a la page), mm_state (le localStorage du
 * site garde deja l'etat de la face).
 */

import workletUrl from './arpEngine.worklet.js?url';
import { midiFileBytes } from './midiFile';
import { isolateStorage } from './storage';

type Fn = (o: unknown) => void;
type Obj = Record<string, unknown>;

export type ArpWebStatus = 'idle' | 'starting' | 'running' | 'unavailable' | 'error';

const WASM_URL = '/mm-arp/mm-arp-engine.wasm';
const SEED_KEY = 'mm.web.arp.seed';
const MAP_KEY = 'mm.web.arp.ccmap';
const PRESET_PREFIX = 'mm.web.arp.preset:';
const PRESET_DIR = 'This browser';
const PRESET_MAX = 1024 * 1024;

// la telemetrie du moteur (ArpEngine.h Telemetry, 72 doubles)
const T = {
  playing: 0,
  internal: 1,
  seq: 2,
  slot: 3,
  pos: 4,
  len: 5,
  chord: 6,
  midi: 7,
  skip: 8,
  dur: 9,
  ppq: 10,
  bpm: 11,
  mod: 12,
  showK: 24,
  showV: 32,
  hellLfo: 40,
  distoVu: 41,
  eg: 42,
  cpu: 49,
  cpuPeak: 57,
  os: 58,
  voices: 59,
  pro: 60,
  sr: 61,
  block: 62,
  knobsKnown: 66,
  learn: 67,
  specOn: 69,
} as const;
/** MMArpProcessor::kModIds : les arcs lumineux */
const MOD_IDS = ['wave1', 'wave2', 'fm', 'cutoff', 'res', 'noise', 'sub', 'envAmt', 'stack', 'xRing', 'xFold', 'xComb'];
const MOD_SLOTS = 8;
const EG_N = 6;
const CPU_N = 8;
const SPEC_N = 96;

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
        console.error(`MM-ARP ${id}`, err);
      }
    }
  });
}

/* ---------------- l'etat ---------------- */

const lsGet = (k: string): string | null => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string): boolean => {
  try {
    window.localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
};

/** La graine du hasard de l'instance (RAND, DRIFT, PROB, LFO 4), gardee comme dans le projet du VST3. */
function loadSeed(): number {
  const v = Number(lsGet(SEED_KEY));
  if (Number.isInteger(v) && v > 0 && v <= 0xffffffff) return v >>> 0;
  let s = 0;
  try {
    s = crypto.getRandomValues(new Uint32Array(1))[0];
  } catch {
    s = Math.floor(Math.random() * 0xffffffff);
  }
  s = s >>> 0 || 808;
  lsSet(SEED_KEY, String(s));
  return s;
}

interface MapItem {
  cc: number;
  ch: number;
  id: string;
}

function storedMap(): MapItem[] {
  try {
    const raw = JSON.parse(lsGet(MAP_KEY) ?? '[]') as unknown;
    return Array.isArray(raw)
      ? raw.filter((i): i is MapItem => !!i && typeof i === 'object' && typeof (i as MapItem).cc === 'number' && typeof (i as MapItem).ch === 'number' && typeof (i as MapItem).id === 'string')
      : [];
  } catch {
    return [];
  }
}

/* ---------------- le statut (la page le montre) ---------------- */

let status: ArpWebStatus = 'idle';
let statusMsg = '';
const statusListeners = new Set<() => void>();

function setStatus(s: ArpWebStatus, msg = ''): void {
  if (s === status && msg === statusMsg) return;
  status = s;
  statusMsg = msg;
  statusListeners.forEach((fn) => fn());
}

export const arpWebStatus = {
  get: (): ArpWebStatus => status,
  message: (): string => statusMsg,
  subscribe(fn: () => void): () => void {
    statusListeners.add(fn);
    return () => {
      statusListeners.delete(fn);
    };
  },
};

/* ---------------- le moteur (le worklet) ---------------- */

type EngineMsg = (
  | { type: 'program'; json: string }
  | { type: 'param'; id: string; v: number }
  | { type: 'run'; on: boolean }
  | { type: 'learn'; id: string }
  | { type: 'unmap'; ch: number; cc: number }
  | { type: 'unmapAll' }
  | { type: 'spec'; on: boolean }
  | { type: 'rate'; hz: number }
  | { type: 'clip'; id: number; cycles: number }
  | { type: 'midi'; s: number; d1: number; d2: number }
) & { seq?: number };

let port: MessagePort | null = null;
/** Les messages d'avant le premier geste (le moteur n'existe pas encore) : rejoues dans l'ordre. */
const queue: EngineMsg[] = [];
const dead = (): boolean => status === 'unavailable' || status === 'error';

/** Le numero du dernier message parti vers le moteur ; le worklet renvoie celui du dernier traite (ack). */
let msgSeq = 0;

function toEngine(m: EngineMsg): number {
  msgSeq += 1;
  const msg = { ...m, seq: msgSeq };
  if (port) {
    port.postMessage(msg);
    return msgSeq;
  }
  if (dead()) return msgSeq;
  // un potard tourne avant le son (la molette) : seule sa derniere valeur compte
  const last = queue[queue.length - 1];
  if (msg.type === 'param' && last && last.type === 'param' && last.id === msg.id) queue[queue.length - 1] = msg;
  else queue.push(msg);
  return msgSeq;
}

/**
 * Les mm_param pas encore traites par le moteur (id -> valeur float32 bornee, numero du message). Dans le VST3,
 * setValueNotifyingHost change getValue tout de suite, sur le fil du minuteur ; ici le moteur la change un peu plus tard :
 * jusqu'a ce que le worklet l'ait traite (ack), le minuteur lit cette valeur, pas celle de la derniere telemetrie (sinon
 * un mm_tick k renverrait a la face la valeur d'avant, le potard sauterait en arriere).
 */
const inflight = new Map<string, { v: number; seq: number }>();

let ids: string[] = [];
let index = new Map<string, number>();
/** les valeurs de depart des parametres (mmarp_param_default), en float32 */
let engineDefaults: Float32Array | null = null;

interface Snap {
  tele: Float64Array;
  params: Float32Array;
  peak: number;
  frame: number;
}

let snap: Snap | null = null;
let ccmap: Int32Array | null = null;
let learnIdx = -1;
let mapPending = false;
let lastSpec: Float32Array | null = null;
let peakMax = 0;
let ticks = 0;
/** l'horloge du compteur CPU dans le worklet ('performance' ou 'date') */
let clock = '';

let modP: Promise<{ mod: WebAssembly.Module; bytes: ArrayBuffer } | null> | null = null;

/** Le moteur compile (fetch au chargement de la page, sans son) ; null : le fichier n'est pas la (pas encore publie). */
function loadModule(): Promise<{ mod: WebAssembly.Module; bytes: ArrayBuffer } | null> {
  if (!modP)
    modP = (async () => {
      try {
        const r = await fetch(WASM_URL);
        if (!r.ok) return null;
        const bytes = await r.arrayBuffer();
        const mod = await WebAssembly.compile(bytes);
        return { mod, bytes };
      } catch {
        return null;
      }
    })();
  return modP;
}

let seed = 0;
let starting = false;
let ctxRef: AudioContext | null = null;

async function startAudio(): Promise<void> {
  if (starting) return;
  starting = true;
  setStatus('starting');
  const m = await loadModule();
  if (!m) {
    unavailable();
    return;
  }
  try {
    // Le contexte du site (cree par la face a ce meme geste : ArpFace.tsx gesture), muet ; le moteur sort a cote
    const [{ context, ensure }, { FLAGS }] = await Promise.all([import('../../../audio/drums'), import('../../../state/flags')]);
    FLAGS.mute = true;
    const c = context() ?? ensure();
    if (!c) {
      setStatus('error', 'Web Audio is not available in this browser.');
      return;
    }
    ctxRef = c;
    await c.audioWorklet.addModule(workletUrl);
    const opts = (withModule: boolean): AudioWorkletNodeOptions => ({
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { ...(withModule ? { module: m.mod } : { bytes: m.bytes }), seed, ccmap: storedMap(), postHz: shown ? 30 : 4 },
    });
    let node: AudioWorkletNode;
    try {
      node = new AudioWorkletNode(c, 'mm-arp-engine', opts(true));
    } catch {
      // un navigateur qui ne passe pas un WebAssembly.Module au worklet : les octets, compiles la-bas
      node = new AudioWorkletNode(c, 'mm-arp-engine', opts(false));
    }
    node.onprocessorerror = () => setStatus('error', 'The sound engine stopped.');
    node.port.onmessage = (ev: MessageEvent) => onEngine(ev.data as Obj);
    node.connect(c.destination);
    port = node.port;
    for (const q of queue) port.postMessage(q);
    queue.length = 0;
    if (c.state !== 'running') void c.resume().catch(() => undefined);
    void midiIfGranted();
  } catch (err) {
    setStatus('error', String((err as Error)?.message ?? err));
  }
}

/** Le moteur n'est pas publie : plus rien n'attend (un clip demande avant le geste le dit). */
function unavailable(): void {
  setStatus('unavailable');
  queue.length = 0;
  if (clipWait.size > 0) {
    clipWait.clear();
    hint(false, NO_ENGINE);
  }
}

function onGesture(): void {
  if (!starting) void startAudio();
  else if (ctxRef && ctxRef.state === 'suspended') void ctxRef.resume().catch(() => undefined);
}

function onEngine(d: Obj): void {
  switch (d.type) {
    case 'ready': {
      ids = (d.ids as string[]) ?? [];
      index = new Map(ids.map((id, i) => [id, i]));
      const defs = d.defaults as Float32Array;
      engineDefaults = defs;
      // mm_ready avant le moteur : sent_ prend les valeurs de l'instance neuve (potards inconnus), puis les mm_param deja
      // partis (PluginEditor.cpp : sent_ suit chaque mm_param)
      if (sentFromDefaults) {
        sent = Float32Array.from(defs);
        for (const [id, v] of preSent) {
          const i = index.get(id);
          if (i !== undefined && v >= 0 && v <= 1) sent[i] = Math.fround(v);
        }
        preSent.clear();
        sentFromDefaults = false;
      }
      clock = String(d.clock ?? '');
      setStatus('running');
      break;
    }
    case 'tick': {
      snap = { tele: d.tele as Float64Array, params: d.params as Float32Array, peak: Number(d.peak) || 0, frame: Number(d.frame) || 0 };
      const ack = Number(d.ack) || 0;
      for (const [id, f] of inflight) if (f.seq <= ack) inflight.delete(id);
      peakMax = Math.max(peakMax, snap.peak);
      if (d.map instanceof Int32Array) {
        ccmap = d.map;
        learnIdx = Number(d.learn);
        mapPending = true;
        saveMap();
      }
      if (d.spec instanceof Float32Array) lastSpec = d.spec;
      break;
    }
    case 'clip':
      onClip(d);
      break;
    case 'error':
      setStatus('error', String(d.msg ?? ''));
      break;
    case 'log':
      console.warn('MM-ARP engine:', d.msg);
      break;
    default:
      break;
  }
}

/* ---------------- MIDI LEARN ---------------- */

function mapItems(): MapItem[] {
  if (!ccmap || ids.length === 0) return storedMap();
  const items: MapItem[] = [];
  for (let k = 0; k < ccmap.length; k += 1) {
    const i = ccmap[k];
    if (i < 0 || i >= ids.length) continue;
    items.push({ cc: k % 128, ch: Math.floor(k / 128) + 1, id: ids[i] });
  }
  return items;
}

function saveMap(): void {
  lsSet(MAP_KEY, JSON.stringify(mapItems()));
}

/** MMArpProcessor::midiMap */
const midiMap = (): { items: MapItem[]; learn: string } => ({ items: mapItems(), learn: learnIdx >= 0 && learnIdx < ids.length ? ids[learnIdx] : '' });

/* ---------------- le MIDI qui entre (Web MIDI) ---------------- */

let midiAsked = false;
const wired = new WeakSet<MIDIInput>();

function onMidi(ev: Event): void {
  const d = (ev as MIDIMessageEvent).data;
  if (!d || d.length === 0 || !port) return;
  const s = d[0];
  // les messages de canal seulement (NOTE ON / OFF, CC, PITCH BEND, PRESSION...) ; ni horloge ni SysEx
  if (s < 0x80 || s >= 0xf0) return;
  port.postMessage({ type: 'midi', s, d1: d[1] ?? 0, d2: d[2] ?? 0 } satisfies EngineMsg);
}

function wireMidi(a: MIDIAccess): void {
  a.inputs.forEach((input) => {
    if (wired.has(input)) return;
    wired.add(input);
    input.addEventListener('midimessage', onMidi);
    void input.open().catch(() => undefined);
  });
}

function midiWanted(): void {
  if (midiAsked || typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') return;
  midiAsked = true;
  navigator.requestMIDIAccess({ sysex: false }).then(
    (a) => {
      wireMidi(a);
      a.addEventListener('statechange', () => wireMidi(a));
    },
    () => {
      midiAsked = false;
    }
  );
}

async function midiIfGranted(): Promise<void> {
  try {
    const p = await navigator.permissions?.query({ name: 'midi' as PermissionName });
    if (p?.state === 'granted') midiWanted();
  } catch {
    /* le navigateur ne dit pas l'autorisation : on attend MIDI LEARN ou MIDI IN */
  }
}

/* ---------------- l'editeur (PluginEditor.cpp) ---------------- */

let ready = false;
let faceVisible = true;
let shown = true;
let specWanted = false;
/** La derniere valeur de chaque parametre connue de la face (-1 : a envoyer) ; null avant mm_ready. */
let sent: Float32Array | null = null;
/** mm_ready avant le moteur : sent_ prendra les valeurs de depart a son arrivee. */
let sentFromDefaults = false;
const preSent = new Map<string, number>();
let lastSeq = -1;
let lastPlaying = false;
let lastInternal = false;
let lastRolling = false;
let quietTicks = 0;
let modSent = false;
let modKey = '';
let egKey = '';
let egSent = false;
let cpuTick = 0;
let cpuQuiet = 0;
let cpuKey = '';
let specTick = 0;
const specSent = new Int32Array(SPEC_N);
let specHas = false;
let timer = 0;

/** std::lround : la moitie s'eloigne de zero */
const lround = (v: number): number => (v < 0 ? -Math.round(-v) : Math.round(v));

function armTimer(hz: number): void {
  if (timer) window.clearInterval(timer);
  timer = window.setInterval(onTimer, 1000 / hz);
}

/** setShown : cachee, plus rien ne part, l'analyseur s'arrete, le minuteur passe a 4 Hz ; revenue, tout repart. */
function setShown(on: boolean): void {
  if (on === shown) return;
  shown = on;
  toEngine({ type: 'spec', on: specWanted && on });
  toEngine({ type: 'rate', hz: on ? 30 : 4 });
  if (on) {
    quietTicks = 1000;
    modKey = '?';
    cpuKey = '';
    specHas = false;
    modSent = true;
    egKey = '?';
    egSent = true;
    armTimer(30);
  } else armTimer(4);
}

function onTimer(): void {
  if (!ready) return;
  ticks += 1;
  if (mapPending) {
    mapPending = false;
    emit('mm_midimap', midiMap());
  }
  setShown(faceVisible && document.visibilityState !== 'hidden');
  if (!shown || !snap || !sent) return;
  const t = snap.tele;
  const params = snap.params;
  const tick: Obj = {};
  let any = false;

  // k : les potards changes par l'hote (MIDI LEARN, RUN qui remet ARP RUN, la reprise de la face), valeurs exactes
  {
    const changed: Obj = {};
    let count = 0;
    const n = Math.min(params.length, sent.length, ids.length);
    for (let i = 0; i < n; i += 1) {
      const f = inflight.size > 0 ? inflight.get(ids[i]) : undefined;
      const v = f ? f.v : params[i];
      if (!(v < sent[i] || v > sent[i])) continue;
      sent[i] = v;
      changed[ids[i]] = v;
      count += 1;
    }
    if (count > 0) {
      tick.k = changed;
      any = true;
    }
  }

  // m : les arcs (a 1 / 10 000 pres), la matrice, le VU du LFO de HELL et celui de DISTO
  {
    const mIds: string[] = [];
    const vals: number[] = [];
    let key = '';
    const add = (id: string, v: number): void => {
      const q = lround(v * 10000);
      mIds.push(id);
      vals.push(q / 10000);
      key += `${id}:${q};`;
    };
    for (let i = 0; i < MOD_IDS.length; i += 1) {
      const v = t[T.mod + i];
      if (Number.isNaN(v)) continue;
      add(MOD_IDS[i], v);
    }
    for (let j = 0; j < MOD_SLOTS; j += 1) {
      const k = t[T.showK + j];
      if (k < 0 || k >= ids.length) continue;
      const v = t[T.showV + j];
      const id = ids[k];
      if (Number.isNaN(v) || mIds.includes(id)) continue;
      add(id, v);
    }
    const hl = t[T.hellLfo];
    if (!Number.isNaN(hl)) add('hellLfo', 0.5 + 0.5 * hl);
    const dv = t[T.distoVu];
    if (!Number.isNaN(dv)) add('distoVu', dv);
    if ((mIds.length > 0 || modSent) && key !== modKey) {
      tick.m = { ids: mIds, v: vals };
      any = true;
      modSent = mIds.length > 0;
    }
    modKey = key;
  }

  // e : les deux enveloppes de la voix la plus recente ; un dernier etat vide quand elle se tait
  {
    const ev: number[] = [];
    let key = '';
    if (!Number.isNaN(t[T.eg])) {
      for (let i = 0; i < EG_N; i += 1) {
        const q = lround(t[T.eg + i] * 10000);
        ev.push(q / 10000);
        key += `${q},`;
      }
    }
    if ((ev.length > 0 || egSent) && key !== egKey) {
      tick.e = ev;
      any = true;
      egSent = ev.length > 0;
    }
    egKey = key;
  }

  // t : la note jouee, a chaque note, depart ou arret, et une fois par seconde
  let beat = false;
  let head: Obj | null = null;
  {
    const playing = t[T.playing] > 0;
    const internal = t[T.internal] > 0;
    const seq = t[T.seq];
    quietTicks += 1;
    const ppq = t[T.ppq];
    const rolling = ppq >= 0;
    if (!(seq === lastSeq && playing === lastPlaying && internal === lastInternal && rolling === lastRolling && quietTicks < 30)) {
      beat = quietTicks >= 30;
      lastRolling = rolling;
      lastSeq = seq;
      lastPlaying = playing;
      lastInternal = internal;
      quietTicks = 0;
      head = {
        playing,
        internal,
        seq,
        slot: playing ? t[T.slot] : -1,
        pos: t[T.pos],
        len: t[T.len],
        chord: playing ? t[T.chord] : -1,
        midi: playing ? t[T.midi] : -1,
        skip: playing && t[T.skip] > 0,
        dur: t[T.dur],
      };
      if (rolling) head.ppq = ppq;
      head.bpm = t[T.bpm];
    }
  }

  // c : le compteur CPU, 5 fois par seconde au dixieme, s'il change, et au moins une fois par seconde
  cpuQuiet += 1;
  cpuTick += 1;
  if (cpuTick >= 6 || (beat && cpuQuiet >= 15)) {
    cpuTick = 0;
    const r1 = (v: number): number => lround(v * 10);
    const sv: number[] = [];
    let key = '';
    for (let i = 0; i < CPU_N; i += 1) {
      const q = r1(t[T.cpu + i]);
      sv.push(q / 10);
      key += `${q},`;
    }
    // le pic du moteur mesure chaque bloc : avec l'horloge a la milliseconde (Date.now, le fil audio de Chrome n'a pas
    // performance), un bloc de 3 ms vaut 0 ou 34 % ; le total lisse (250 ms, sans biais) le remplace
    const pk = r1(clock === 'date' ? t[T.cpu + CPU_N - 1] : t[T.cpuPeak]);
    key += `${pk},${t[T.os]},${t[T.voices]},${t[T.pro] > 0 ? 1 : 0},${t[T.sr]},${t[T.block]}`;
    if (key !== cpuKey || cpuQuiet >= 30 || beat) {
      cpuKey = key;
      cpuQuiet = 0;
      tick.c = { s: sv, pk: pk / 10, os: t[T.os], voices: t[T.voices], pro: t[T.pro] > 0, sr: t[T.sr], block: t[T.block] };
      any = true;
    }
  }

  // s : l'analyseur de la page SOUND, 15 fois par seconde, seulement si une bande a bouge
  if (t[T.specOn] > 0) {
    specTick += 1;
    if ((specTick & 1) === 0 && lastSpec) {
      let same = specHas;
      for (let i = 0; i < SPEC_N; i += 1) {
        const b = lround(lastSpec[i]);
        if (b !== specSent[i]) same = false;
        specSent[i] = b;
      }
      if (!same) {
        specHas = true;
        tick.s = Array.from(specSent);
        any = true;
      }
    }
  }

  if (any) emit('mm_tick', tick);
  // la tete en dernier (elle reveille la scene) ; mm_transport : bridge.ts et hostClock.ts l'ecoutent
  if (head) emit('mm_transport', head);
}

function onReady(): void {
  lastSeq = -1;
  quietTicks = 1000;
  modKey = '?';
  cpuKey = '';
  specHas = false;
  faceVisible = true;
  ready = true;
  // tous les potards vers la face, s'ils sont connus ; sinon c'est la face qui donne les siens
  preSent.clear();
  if (snap && ids.length > 0) {
    sent = new Float32Array(ids.length).fill(-1);
    if (!(snap.tele[T.knobsKnown] > 0)) sent.set(snap.params.subarray(0, ids.length));
    sentFromDefaults = false;
  } else if (engineDefaults) {
    // le moteur vient de naitre (un clic pendant le chargement de la face), rien recu encore : une instance neuve
    sent = Float32Array.from(engineDefaults);
    sentFromDefaults = false;
  } else {
    sent = null;
    sentFromDefaults = true;
  }
  presetList();
}

/* ---------------- les presets du disque (le localStorage de ce navigateur) ---------------- */

/** juce::File::createLegalFileName, ou le nom de depart */
function safeName(n: string): string {
  const s = n
    .trim()
    .replace(/["#@,;:<>*^|?\\/]/g, '')
    .trim()
    .slice(0, 128);
  return s || 'MM-ARP preset';
}

const presetPath = (name: string): string => `${PRESET_DIR}/${name}.mmarp`;

function presetNames(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PRESET_PREFIX)) out.push(k.slice(PRESET_PREFIX.length));
    }
  } catch {
    /* stockage refuse : aucun */
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function presetList(): void {
  emit('mm_presets', { items: presetNames().map((name) => ({ name, path: presetPath(name) })), dir: PRESET_DIR });
}

function nameOfPath(path: string): string | null {
  const pre = `${PRESET_DIR}/`;
  return path.startsWith(pre) && path.endsWith('.mmarp') ? path.slice(pre.length, -'.mmarp'.length) : null;
}

const isJsonObject = (text: string): boolean => {
  try {
    const o = JSON.parse(text) as unknown;
    return !!o && typeof o === 'object' && !Array.isArray(o);
  } catch {
    return false;
  }
};

function download(name: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function presetSave(name: string, preset: string): void {
  if (!preset) return;
  const n = safeName(name);
  const ok = lsSet(PRESET_PREFIX + n, preset);
  // le fichier aussi, pour le garder hors du navigateur (ou l'ouvrir dans le VST3)
  try {
    download(`${n}.mmarp`, preset, 'application/json');
  } catch {
    /* pas de telechargement : le preset reste dans la liste */
  }
  emit('mm_saved', ok ? { name: n, ok, path: presetPath(n) } : { name: n, ok });
  presetList();
}

function presetLoad(path: string): void {
  const name = nameOfPath(path);
  if (name === null) return;
  const text = lsGet(PRESET_PREFIX + name);
  if (text === null || text.length > PRESET_MAX || !isJsonObject(text)) return;
  emit('mm_preset', { name, preset: text, path });
}

let picker: HTMLInputElement | null = null;

/** OPEN FROM DISK : un .mmarp (ou .json) choisi sur l'ordinateur, garde dans la liste de ce navigateur. */
function presetOpen(): void {
  if (!picker) {
    picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.mmarp,.json,application/json';
    picker.style.display = 'none';
    picker.addEventListener('change', () => {
      const f = picker?.files?.[0];
      if (picker) picker.value = '';
      if (!f || f.size > PRESET_MAX) return;
      void f.text().then((text) => {
        if (!isJsonObject(text)) return;
        const name = safeName(f.name.replace(/\.[^.]*$/, ''));
        const kept = lsSet(PRESET_PREFIX + name, text);
        emit('mm_preset', { name, preset: text, path: kept ? presetPath(name) : f.name });
        if (kept) presetList();
      });
    });
    document.body.appendChild(picker);
  }
  picker.click();
}

/* ---------------- DRAG MIDI, SAVE .MID ---------------- */

const NO_CHORD = 'No chord: tap the pads to make a progression';
const NO_ENGINE = 'The sound engine is not available yet: no MIDI clip';
let clipId = 0;
const clipWait = new Map<number, 'drag' | 'save'>();

function hint(ok: boolean, msg: string): void {
  emit('mm_drag_status', { ok, msg });
}

function clipAsk(kind: 'drag' | 'save', cycles: number): void {
  if (dead()) {
    hint(false, NO_ENGINE);
    return;
  }
  clipId += 1;
  clipWait.set(clipId, kind);
  toEngine({ type: 'clip', id: clipId, cycles });
}

const pad2 = (v: number): string => String(v).padStart(2, '0');

function onClip(d: Obj): void {
  const id = Number(d.id);
  const kind = clipWait.get(id);
  clipWait.delete(id);
  if (!kind) return;
  const bars = Number(d.bars) || 0;
  if (bars <= 0) {
    hint(false, NO_CHORD);
    return;
  }
  const bytes = midiFileBytes(d.notes as Float32Array, Number(d.bpm) || 120);
  const now = new Date();
  const stamp = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}-${pad2(now.getMinutes())}-${pad2(now.getSeconds())}`;
  const name = kind === 'save' ? `MM-ARP ${bars} bars.mid` : `MM-ARP ${stamp} (${bars} bars).mid`;
  try {
    download(name, bytes, 'audio/midi');
    hint(true, kind === 'save' ? `MIDI clip saved: ${name}` : `Clip downloaded: drop ${name} on a track`);
  } catch {
    hint(false, `Impossible to save ${name}`);
  }
}

/* ---------------- les messages de la face ---------------- */

const str = (x: unknown): string => (typeof x === 'string' ? x : typeof x === 'number' ? String(x) : '');
/** static_cast<bool>(juce::var) */
const varBool = (x: unknown, d = false): boolean => (x === undefined ? d : typeof x === 'boolean' ? x : typeof x === 'number' ? x !== 0 : typeof x === 'string' ? x.trim() === 'true' || (parseInt(x, 10) || 0) !== 0 : x !== null);
/** static_cast<double>(juce::var) */
const varNum = (x: unknown, d: number): number => (x === undefined ? d : typeof x === 'number' ? x : typeof x === 'boolean' ? (x ? 1 : 0) : typeof x === 'string' ? parseFloat(x) || 0 : 0);
const varInt = (x: unknown, d: number): number => Math.trunc(varNum(x, d));
const clampInt = (lo: number, hi: number, v: number): number => Math.min(hi, Math.max(lo, v));

let cycles = 1;

const handlers: Record<string, (o: Obj) => void> = {
  mm_ready: onReady,
  mm_program: (o) => toEngine({ type: 'program', json: str(o.program) }),
  // l'etat de la face : deja dans le localStorage du site (le VST3 le garde dans le projet)
  mm_state: () => undefined,
  mm_run: (o) => toEngine({ type: 'run', on: varBool(o.on) }),
  mm_param: (o) => {
    const id = str(o.id);
    const v = varNum(o.v, -1);
    const seq = toEngine({ type: 'param', id, v });
    // faceParam : un id inconnu ou une valeur non finie ne fait rien ; sinon getValue vaut deja la valeur bornee
    if (Number.isFinite(v) && (ids.length === 0 || index.has(id))) inflight.set(id, { v: Math.fround(Math.min(1, Math.max(0, v))), seq });
    if (!(v >= 0 && v <= 1)) return;
    const i = index.get(id);
    if (sent && i !== undefined) sent[i] = Math.fround(v);
    else if (sentFromDefaults) preSent.set(id, v);
    // MIDI IN sur ARP ou LAYER : le clavier MIDI de l'ordinateur sert, on le demande
    if (id === 'xMidiIn' && v > 0) midiWanted();
  },
  // pas d'automation d'hote dans le navigateur
  mm_gesture: () => undefined,
  mm_preset_save: (o) => presetSave(str(o.name), str(o.preset)),
  mm_preset_open: () => presetOpen(),
  mm_preset_list: () => presetList(),
  mm_preset_load: (o) => presetLoad(str(o.path)),
  mm_drag_midi: (o) => clipAsk('drag', clampInt(1, 8, varInt(o.cycles, 1))),
  mm_save_mid: (o) => {
    cycles = clampInt(1, 8, varInt(o.cycles, 1));
    clipAsk('save', cycles);
  },
  mm_learn: (o) => {
    const id = str(o.id);
    toEngine({ type: 'learn', id });
    if (id) midiWanted();
  },
  mm_view: (o) => {
    specWanted = varBool(o.spec);
    toEngine({ type: 'spec', on: specWanted && shown });
  },
  mm_vis: (o) => {
    faceVisible = varBool(o.on, true);
    setShown(faceVisible && document.visibilityState !== 'hidden');
  },
  mm_unmap: (o) => toEngine({ type: 'unmap', ch: varInt(o.ch, 0), cc: varInt(o.cc, -1) }),
  mm_unmap_all: () => toEngine({ type: 'unmapAll' }),
  // le clavier reste a la page (pas d'hote a qui le rendre)
  mm_keys: () => undefined,
  mm_midimap_get: () => emit('mm_midimap', midiMap()),
  mm_log: (o) => console.debug('MM-ARP face:', str(o.where), str(o.msg)),
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
 * Pose window.__JUCE__ et le stockage de l'instance (a appeler avant le premier module de la face : DelayPage2.tsx ecoute
 * mm_transport a son evaluation, les stores lisent le localStorage), lance le chargement du moteur (sans son) et attend le
 * premier geste pour le contexte audio.
 */
export function installArpWebBackend(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  // l'etat de l'instance a part de celui du site, avant que les stores de la machine le lisent
  isolateStorage();
  (window as unknown as { __JUCE__?: unknown }).__JUCE__ = { initialisationData: {}, backend };
  seed = loadSeed();
  void loadModule().then((m) => {
    if (!m) unavailable();
  });
  const opts = { capture: true, passive: true } as const;
  window.addEventListener('pointerdown', onGesture, opts);
  window.addEventListener('keydown', onGesture, opts);
  armTimer(30);
  // ?probe (les essais sans son, Chromium) : l'etat du moteur, lu par le JS
  if (window.location.search.includes('probe'))
    (window as unknown as { __mmArpWeb?: unknown }).__mmArpWeb = {
      status: () => ({ status, msg: statusMsg, ctx: ctxRef?.state ?? null, sr: ctxRef?.sampleRate ?? null, port: port !== null, queued: queue.length, ticks, clock, inflight: inflight.size }),
      peak: () => snap?.peak ?? 0,
      peakMax: () => peakMax,
      resetPeak: () => {
        peakMax = 0;
      },
      tele: () => (snap ? Array.from(snap.tele) : null),
      param: (id: string) => {
        const i = index.get(id);
        return snap && i !== undefined ? snap.params[i] : null;
      },
      ids: () => ids.slice(),
      map: () => midiMap(),
      presets: () => presetNames(),
      midi: (s: number, d1: number, d2: number) => port?.postMessage({ type: 'midi', s, d1, d2 } satisfies EngineMsg),
    };
}
