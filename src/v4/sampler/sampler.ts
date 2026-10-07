/**
 * Le sampler d'une platine du MM-DECKS (2026-10-07, Mika : "je voudrais
 * deplacer le contenu de MM-SMPL dans un DECK ; chaque deck doit avoir les
 * memes choses pour sampler ce qui est en cours, ou sampler le mixer ;
 * profitons d'avoir un grand ecran pour voir les choses, et les boutons de
 * CUE, transforme-les en boutons pour le sampler"). Tout ce que faisait le
 * MM-SMPL, une fois par platine :
 * - REC DECK : les temps de la platine, tout de suite, pris dans son morceau
 *   (sa boucle si elle boucle ; sinon, en lecture, les LEN derniers temps
 *   jusqu'a la derniere barre de mesure ; a l'arret, LEN temps a partir
 *   d'ici) ;
 * - REC MIX : les LEN derniers temps de ce que sort le MIXER (sa memoire,
 *   sampler/ring.ts), sur la grille de ce qu'on entend ;
 * - FILE : un fichier de l'appareil ;
 * - les slices (SLICES : 4, 8, 16 ou AUTO), SLICE ou GRAIN, REV, LOOP, les
 *   douze reglages (sampler/params.ts), seize pads (les slices), la
 *   sequence de seize pas (sampler/seq.ts), SAVE (la region en WAV).
 * Sa sortie passe par la voie de sa platine au MIXER (EQ, FILTER, fader,
 * effets) : le sampler fait partie de la platine.
 *
 * Son etat (la decoupe, le mode, LEN, la page de l'ecran) est retenu sous
 * mm.v4.dj.smpl.<platine> ; le dernier sample de chaque platine revient a
 * la visite suivante (IndexedDB mm-smpl, celui du MM-SMPL va sur DECK A).
 */

import workletUrl from './sampler.worklet.js?url';
import { gesture } from '../actions';
import { clock } from '../audio/clock';
import { pattern } from '../audio/pattern';
import { arp } from '../voyager/arp';
import { deckGridAfter, heardBpm, mixBeat } from '../dj/actions';
import { djEngine, djEngineIfAny } from '../dj/engine';
import { djState } from '../dj/state';
import { deckChannel, type DjDeck } from '../dj/theme';
import { SmplParams, attackS, densityHz, filterOf, levelGain, pitchSemis, releaseS, scanSpeed, sizeS, smplReadout, type SmplKnobId } from './params';
import { grabRing } from './ring';
import { SEQ_STEPS, SmplSeq, randomSteps, sliceForStep } from './seq';
import { SMPL_PADS, SMPL_SLICINGS, equalSlices, monoOf, onsetSlices, wavOf, type SmplSlicing } from './slices';

/** La plus longue prise (secondes) : la memoire d'un telephone. */
export const SMPL_MAX_S = 60;
/** LEN : combien de temps prennent REC DECK et REC MIX. */
export const SMPL_LENS = [1, 2, 4, 8, 16] as const;
export type SmplLen = (typeof SMPL_LENS)[number];

export type SmplMode = 'slice' | 'grain';
export type SmplSource = 'deck' | 'mix' | 'file';
/** Les pages de l'ecran : les pads, les reglages du son, ceux des grains, la sequence. */
export type SmplTab = 'pads' | 'sample' | 'grain' | 'seq';
export const SMPL_TABS: readonly SmplTab[] = ['pads', 'sample', 'grain', 'seq'];

export interface SmplSample {
  /** un numero par sample pose (l'ecran s'y fie) */
  id: number;
  name: string;
  source: SmplSource;
  duration: number;
  rate: number;
  /** sa longueur en temps (REC DECK, REC MIX), null pour un fichier */
  beats: number | null;
  /** son tempo a la prise, null s'il n'est pas connu */
  bpm: number | null;
}

export interface SmplState {
  sample: SmplSample | null;
  slicing: SmplSlicing;
  /** les bornes des slices dans le sample (secondes) : n debuts, puis la fin */
  slices: readonly number[];
  mode: SmplMode;
  reverse: boolean;
  loop: boolean;
  len: SmplLen;
  tab: SmplTab;
  /** la page SMPL est sur l'ecran de la platine (sinon : le morceau) */
  open: boolean;
  /** les pads qui sonnent */
  pads: readonly number[];
  /** PLAY : la region (ou le nuage) */
  preview: boolean;
  /** un chargement en cours (un fichier qui se decode, la memoire du MIXER) */
  busy: boolean;
  message: string | null;
  /** la touche REC qui vient de prendre (sa LED s'allume un instant) */
  flash: 'deck' | 'mix' | null;
}

interface Graph {
  ctx: AudioContext;
  node: AudioWorkletNode;
  filter: BiquadFilterNode;
  hp: BiquadFilterNode;
  level: GainNode;
}

interface SmplData {
  channels: Float32Array[];
  rate: number;
  mono: Float32Array;
}

/** L'identifiant de PLAY pour le moteur (les pads : 0 a 15) ; celui du nuage de l'ecran (GRAIN) ; celui de l'ecoute d'un pas. */
const PREVIEW = 100;
const TOUCH = 120;
const AUDITION = 150;
const GRAIN_KNOBS: ReadonlySet<SmplKnobId> = new Set(['position', 'scan', 'size', 'density', 'spray']);
const NO_SAMPLE = 'PRESS REC DECK OR REC MIX, OR PICK A FILE';
const FRESH_MS = 250;
const FLASH_MS = 450;

/* ---------------- le module du worklet, une fois par contexte ---------------- */

let moduleCtx: BaseAudioContext | null = null;
let moduleReady: Promise<boolean> | null = null;
function addModule(ctx: AudioContext): Promise<boolean> {
  if (moduleCtx === ctx && moduleReady) return moduleReady;
  moduleCtx = ctx;
  moduleReady = ctx.audioWorklet.addModule(workletUrl).then(
    () => true,
    () => false
  );
  return moduleReady;
}

/* ---------------- la memoire du navigateur ---------------- */

const DB = 'mm-smpl';
const STORE = 'samples';

interface Stored {
  name: string;
  source: SmplSource | 'rec';
  rate: number;
  channels: ArrayBuffer[];
  beats?: number | null;
  bpm?: number | null;
}

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

async function remember(key: string, s: Stored): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(s, key);
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

async function recall(key: string): Promise<Stored | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
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

let sampleIds = 0;

/* ---------------- un sampler ---------------- */

export class Sampler {
  readonly params: SmplParams;
  readonly seq: SmplSeq;
  private state: SmplState;
  private listeners = new Set<() => void>();
  private graph: Graph | null = null;
  private loading: Promise<Graph | null> | null = null;
  private data: SmplData | null = null;
  private live = { voices: new Map<number, number>(), clouds: new Map<number, number>(), at: 0 };
  private liveListeners = new Set<() => void>();
  private msgTimer = 0;
  private flashTimer = 0;
  private touching = false;
  private pressedAt = new Map<number, number>();
  /** les pads tenus (leur lumiere tient, meme avant que le worklet ne les montre) */
  private held = new Set<number>();
  private key: string;

  constructor(readonly deck: DjDeck) {
    this.key = `mm.v4.dj.smpl.${deck}`;
    this.params = new SmplParams(`${this.key}.params`);
    this.state = {
      sample: null,
      slices: [],
      pads: [],
      preview: false,
      busy: false,
      message: null,
      flash: null,
      open: false,
      slicing: 8,
      mode: 'slice',
      reverse: false,
      loop: false,
      len: 4,
      tab: 'pads',
      ...this.load(),
    };
    this.seq = new SmplSeq(`${this.key}.seq`, {
      slice: (k) => this.padSlice(k),
      count: () => this.padCount(),
      mode: () => this.state.mode,
      position: () => this.params.of('position'),
      bpm: () => this.state.sample?.bpm ?? (djEngineIfAny() ? heardBpm() : pattern.get().bpm),
      deckGrid: (t) => deckGridAfter(this.deck, t),
      play: (id, a, b, at) => this.send({ type: 'play', id, a, b, loop: false, at }),
      cloud: (id, pos, a, b, at, dur) => this.send({ type: 'cloud', id, pos, a, b, at, dur }),
      unseq: (from) => this.send({ type: 'unseq', time: from }, false),
    });
    // Les potards suivent : le worklet et les noeuds ; START et END refont la decoupe
    let region = '';
    let resliceRaf = 0;
    this.params.subscribe(() => {
      const g = this.graph;
      if (g) {
        g.node.port.postMessage({ type: 'params', p: this.workletParams() });
        this.applyNodes(g);
      }
      const v = this.params.get();
      const k = `${v.start}|${v.end}|${v.position}`;
      if (k === region) return;
      region = k;
      this.seq.ask();
      if (resliceRaf) return;
      resliceRaf = requestAnimationFrame(() => {
        resliceRaf = 0;
        this.reslice();
        this.followClouds();
      });
    });
    void this.restore();
  }

  /* ---------------- le store ---------------- */

  private load(): Partial<SmplState> {
    const s: Partial<SmplState> = {};
    if (typeof window === 'undefined') return s;
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return s;
      const o = JSON.parse(raw) as Partial<SmplState>;
      if ((SMPL_SLICINGS as readonly unknown[]).includes(o.slicing)) s.slicing = o.slicing as SmplSlicing;
      if (o.mode === 'slice' || o.mode === 'grain') s.mode = o.mode;
      if (typeof o.reverse === 'boolean') s.reverse = o.reverse;
      if (typeof o.loop === 'boolean') s.loop = o.loop;
      if ((SMPL_LENS as readonly unknown[]).includes(o.len)) s.len = o.len as SmplLen;
      if ((SMPL_TABS as readonly unknown[]).includes(o.tab)) s.tab = o.tab as SmplTab;
    } catch {
      /* rien de retenu */
    }
    return s;
  }

  get = (): SmplState => this.state;

  set(patch: Partial<SmplState>): void {
    const prev = this.state;
    this.state = { ...prev, ...patch };
    const s = this.state;
    if (patch.slicing !== undefined || patch.mode !== undefined || patch.reverse !== undefined || patch.loop !== undefined || patch.len !== undefined || patch.tab !== undefined) {
      try {
        const { slicing, mode, reverse, loop, len, tab } = s;
        window.localStorage.setItem(this.key, JSON.stringify({ slicing, mode, reverse, loop, len, tab }));
      } catch {
        /* stockage indisponible : l'etat vit pour la visite */
      }
    }
    // Ce qui change ce que joue un pas : la sequence se re-programme
    if (prev.mode !== s.mode || prev.slices !== s.slices || prev.sample !== s.sample) this.seq.ask();
    if (prev.reverse !== s.reverse) this.graph?.node.port.postMessage({ type: 'params', p: this.workletParams() });
    this.listeners.forEach((fn) => fn());
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  /** Une ligne a l'ecran, quelques secondes (null : l'efface). */
  say(text: string | null, ms = 2600): void {
    window.clearTimeout(this.msgTimer);
    this.set({ message: text });
    if (text) this.msgTimer = window.setTimeout(() => this.set({ message: null }), ms);
  }

  /** La region (secondes) pour START et END. */
  region(): { a: number; b: number } {
    const v = this.params.get();
    const d = this.state.sample?.duration ?? 0;
    return { a: v.start * d, b: v.end * d };
  }

  /** Les bornes de la slice d'un pad, ou null. */
  padSlice(i: number): { a: number; b: number } | null {
    const s = this.state.slices;
    if (!this.state.sample || i < 0 || i + 1 >= s.length) return null;
    return { a: s[i], b: s[i + 1] };
  }

  padCount = (): number => Math.max(0, this.state.slices.length - 1);

  /** Combien de pas de la sequence dure une slice (un sample de temps connus, en parts egales), sinon null. */
  stepsPerSlice(): number | null {
    const s = this.state;
    const n = this.padCount();
    if (!s.sample?.beats || s.slicing === 'auto' || n <= 0) return null;
    const v = this.params.get();
    const steps = s.sample.beats * 4 * (v.end - v.start);
    return steps / n;
  }

  /* ---------------- le son ---------------- */

  private workletParams(): Record<string, number | boolean> {
    const v = this.params.get();
    return {
      attack: attackS(v.attack),
      release: releaseS(v.release),
      size: sizeS(v.size),
      density: densityHz(v.density),
      spray: v.spray,
      scan: scanSpeed(v.scan),
      pitch: pitchSemis(v.pitch),
      reverse: this.state.reverse,
    };
  }

  private applyNodes(g: Graph): void {
    const v = this.params.get();
    const t = g.ctx.currentTime;
    g.level.gain.setTargetAtTime(levelGain(v.level), t, 0.02);
    const f = filterOf(v.filter);
    // Deux filtres en serie, jamais de changement de type : LP ouvert a 22 kHz, HP ouvert a 10 Hz
    g.filter.frequency.setTargetAtTime(f.type === 'lowpass' ? f.hz : 22000, t, 0.02);
    g.hp.frequency.setTargetAtTime(f.type === 'highpass' ? f.hz : 10, t, 0.02);
  }

  private sendSample(g: Graph): void {
    const d = this.data;
    if (!d) return;
    const L = d.channels[0].slice();
    const R = (d.channels[1] ?? d.channels[0]).slice();
    g.node.port.postMessage({ type: 'sample', L, R, rate: d.rate }, [L.buffer, R.buffer]);
  }

  private onMsg = (e: MessageEvent<{ type: string; voices?: [number, number][]; clouds?: [number, number][] }>): void => {
    const m = e.data;
    if (m.type !== 'pos') return;
    this.live = { voices: new Map(m.voices ?? []), clouds: new Map(m.clouds ?? []), at: performance.now() };
    this.liveChanged();
  };

  /** Le worklet, branche sur la voie de la platine au MIXER (cree au premier geste) ; null sans son. */
  ensure(): Promise<Graph | null> {
    if (this.graph) return Promise.resolve(this.graph);
    if (this.loading) return this.loading;
    const e = djEngine();
    if (!e || !e.ctx.audioWorklet) return Promise.resolve(null);
    const ctx = e.ctx;
    this.loading = addModule(ctx)
      .then((ok) => {
        if (!ok) return null;
        const node = new AudioWorkletNode(ctx, 'mm-smpl', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
        node.port.onmessage = this.onMsg;
        const filter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 22000, Q: 0.707 });
        const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 10, Q: 0.707 });
        const level = new GainNode(ctx, { gain: levelGain(this.params.of('level')) });
        node.connect(filter).connect(hp).connect(level).connect(e.mixer.ch[deckChannel(this.deck)].input);
        const g: Graph = { ctx, node, filter, hp, level };
        this.graph = g;
        node.port.postMessage({ type: 'params', p: this.workletParams() });
        this.applyNodes(g);
        this.sendSample(g);
        return g;
      })
      .catch(() => null)
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  /** Un message au worklet ; pendant son chargement, il attend son tour (create : le charger s'il ne l'est pas). */
  private send(msg: Record<string, unknown>, create = true): void {
    if (this.graph) this.graph.node.port.postMessage(msg);
    else if (create || this.loading) void this.ensure().then((g) => g?.node.port.postMessage(msg));
  }

  /** Le sample pose (canaux, frequence, mono), ou null. */
  sampleData = (): SmplData | null => this.data;

  /** L'heure du contexte du son (la tete de lecture de la sequence), 0 sans son. */
  now = (): number => this.graph?.ctx.currentTime ?? djEngineIfAny()?.ctx.currentTime ?? 0;

  /** Ce qui joue : voix et nuages (secondes dans le sample), par identifiant. */
  liveNow = (): { voices: ReadonlyMap<number, number>; clouds: ReadonlyMap<number, number>; at: number } => this.live;

  subscribeLive = (fn: () => void): (() => void) => {
    this.liveListeners.add(fn);
    return () => {
      this.liveListeners.delete(fn);
    };
  };

  /** Quelque chose sonne-t-il ? (le verrou de lecture, la LED de PLAY) */
  sounding(): boolean {
    return this.live.voices.size > 0 || this.live.clouds.size > 0 || this.seq.get().running || this.state.preview;
  }

  /** Une voix simple finie : sa lumiere s'eteint (les positions ne la donnent plus). */
  private liveChanged(): void {
    const s = this.state;
    const live = this.live;
    const now = performance.now();
    const sounds = (id: number): boolean => this.held.has(id) || live.voices.has(id) || live.clouds.has(id) || now - (this.pressedAt.get(id) ?? -Infinity) < FRESH_MS;
    const pads = s.pads.filter(sounds);
    const preview = s.preview && sounds(PREVIEW);
    if (pads.length !== s.pads.length || preview !== s.preview) this.set({ pads, preview });
    const fresh = (id: number): boolean => !live.voices.has(id) && !live.clouds.has(id) && now - (this.pressedAt.get(id) ?? -Infinity) < FRESH_MS;
    if (pads.some(fresh) || (preview && fresh(PREVIEW))) window.setTimeout(() => this.liveChanged(), FRESH_MS);
    this.liveListeners.forEach((fn) => fn());
  }

  /* ---------------- la decoupe ---------------- */

  /** Refait les slices pour la region et SLICES du moment. */
  reslice(): void {
    const s = this.state;
    const d = this.data;
    if (!s.sample || !d) {
      if (s.slices.length) this.set({ slices: [] });
      return;
    }
    const { a, b } = this.region();
    const slices = s.slicing === 'auto' ? onsetSlices(d.mono, d.rate, a, b, SMPL_PADS) : equalSlices(a, b, s.slicing);
    this.set({ slices });
  }

  /* ---------------- les sources ---------------- */

  /** Pose un sample : coupe a SMPL_MAX_S, le confie au worklet, le retient (keep : false au rappel). */
  private place(channels: Float32Array[], rate: number, name: string, source: SmplSource, beats: number | null, bpm: number | null, keep = true): void {
    const max = Math.floor(SMPL_MAX_S * rate);
    const ch = channels.slice(0, 2).map((c) => (c.length > max ? c.slice(0, max) : c));
    this.data = { channels: ch, rate, mono: monoOf(ch) };
    sampleIds += 1;
    const duration = ch[0].length / rate;
    // Les voix d'avant se taisent (elles jouaient l'ancien sample)
    this.send({ type: 'stop' }, false);
    this.touching = false;
    this.set({ sample: { id: sampleIds, name, source, duration, rate, beats, bpm }, pads: [], preview: false });
    if (this.graph) this.sendSample(this.graph);
    if (keep) void remember(`deck-${this.deck}`, { name, source, rate, beats, bpm, channels: ch.map((c) => c.slice().buffer) });
    // Un sample neuf : la region entiere
    this.params.set('start', 0);
    this.params.set('end', 1);
    this.reslice();
  }

  /** Le dernier sample de cette platine (celui du MM-SMPL pour DECK A, la premiere fois). */
  private async restore(): Promise<void> {
    const s = (await recall(`deck-${this.deck}`)) ?? (this.deck === 'a' ? await recall('last') : null);
    if (!s || this.data || !s.channels?.length) return;
    const source: SmplSource = s.source === 'deck' || s.source === 'mix' ? s.source : s.source === 'rec' ? 'mix' : 'file';
    this.place(
      s.channels.map((b) => new Float32Array(b)),
      s.rate,
      s.name,
      source,
      s.beats ?? null,
      s.bpm ?? null,
      false
    );
  }

  private flash(which: 'deck' | 'mix'): void {
    window.clearTimeout(this.flashTimer);
    this.set({ flash: which });
    this.flashTimer = window.setTimeout(() => this.set({ flash: null }), FLASH_MS);
  }

  /**
   * REC DECK : les temps de la platine, pris dans son morceau. Sa boucle si
   * elle boucle ; en lecture, les LEN derniers temps jusqu'a la derniere
   * barre (de mesure, ou de LEN temps s'il en fait moins de quatre) ; a
   * l'arret, LEN temps a partir du temps le plus proche. Sans grille des
   * temps : au tempo du morceau (120 sans BPM), d'ici.
   */
  recDeck(): void {
    gesture();
    const e = djEngine();
    const p = e?.decks[this.deck];
    const ds = djState.get().deck[this.deck];
    this.flash('deck');
    this.set({ open: true });
    if (!e || !p || !p.loaded) {
      this.say(`DECK ${this.deck.toUpperCase()} IS EMPTY: LOAD A TRACK, OR PRESS REC MIX`);
      return;
    }
    const len = this.state.len;
    const bpm = ds.track?.bpm ?? null;
    const spb = 60 / (bpm || 120);
    const pos = p.position();
    let a: number;
    let b: number;
    let beats: number | null = len;
    const loop = p.loop;
    if (loop) {
      a = loop.a;
      b = loop.b;
      beats = ds.loop ?? Math.round((b - a) / spb);
    } else if (ds.beat !== null && bpm) {
      const align = Math.min(len, 4);
      if (p.playing) {
        const idx = Math.floor((pos - ds.beat) / spb + 1e-6);
        const end = idx - (((idx % align) + align) % align);
        a = ds.beat + (end - len) * spb;
        if (a < 0) a += Math.ceil(-a / (align * spb) - 1e-6) * align * spb;
      } else a = ds.beat + Math.round((pos - ds.beat) / spb) * spb;
      if (a < 0) a = Math.max(0, a + spb);
      b = a + len * spb;
    } else if (p.playing) {
      b = pos;
      a = Math.max(0, pos - len * spb);
    } else {
      a = pos;
      b = pos + len * spb;
    }
    b = Math.min(p.duration, b);
    const x = b - a >= 0.05 ? p.excerpt(a, b) : null;
    if (!x) {
      this.say('NOTHING TO SAMPLE HERE');
      return;
    }
    const title = ds.track?.title ?? `DECK ${this.deck.toUpperCase()}`;
    const got = beats !== null ? Math.round(((b - a) / spb) * 100) / 100 : null;
    this.place(x.channels, x.rate, title, 'deck', got, bpm);
    this.say(`DECK ${this.deck.toUpperCase()}: ${got ?? len} BEATS SAMPLED${loop ? ' (THE LOOP)' : ''}`);
  }

  /**
   * REC MIX : les LEN derniers temps du MIXER, jusqu'a la derniere barre
   * (sur la grille de ce qu'on entend ; sans grille : jusqu'a maintenant, au
   * tempo de la platine qu'on entend).
   */
  recMix(): void {
    gesture();
    this.flash('mix');
    this.set({ open: true });
    const e = djEngine();
    if (!e) {
      this.say('NO SOUND YET: PLAY SOMETHING FIRST');
      return;
    }
    const len = this.state.len;
    const now = e.ctx.currentTime;
    const mb = mixBeat();
    let end: number;
    let period: number;
    if (mb) {
      period = mb.period;
      const align = Math.min(len, 4);
      const back = mb.index === null ? 0 : mb.index % align;
      end = mb.last - back * period;
    } else {
      period = 60 / heardBpm();
      end = now;
    }
    const start = end - len * period;
    const bpm = Math.round((60 / period) * 100) / 100;
    this.set({ busy: true });
    void grabRing(start, end).then((x) => {
      this.set({ busy: false });
      if (!x || x.channels[0].length < x.rate * 0.05) {
        this.say('THE MIXER IS SILENT: NOTHING TO SAMPLE');
        return;
      }
      // Le MIXER ne garde que RING_S secondes : une prise plus courte que demande
      const beats = Math.round((x.channels[0].length / x.rate / period) * 100) / 100;
      this.place(x.channels, x.rate, `MIXER ${bpm.toFixed(1)} BPM`, 'mix', beats, bpm);
      this.say(`MIXER: ${beats} BEATS SAMPLED`);
    });
  }

  /** FILE : un fichier audio (le choix du systeme, ou un fichier depose). */
  async loadFile(file: File): Promise<void> {
    gesture();
    const ctx = (await this.ensure())?.ctx ?? null;
    this.set({ busy: true, open: true });
    this.say(`LOADING ${file.name.toUpperCase()}`, 60000);
    try {
      const bytes = await file.arrayBuffer();
      const c = ctx ?? new OfflineAudioContext(2, 1, 48000);
      const buf = await c.decodeAudioData(bytes);
      const ch = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, k) => buf.getChannelData(k));
      this.place(ch, buf.sampleRate, file.name.replace(/\.[a-z0-9]+$/i, ''), 'file', null, null);
      this.say(buf.duration > SMPL_MAX_S ? `KEPT THE FIRST ${SMPL_MAX_S} S` : `${file.name.toUpperCase()}  ${Math.min(buf.duration, SMPL_MAX_S).toFixed(2)} S`);
    } catch {
      this.say('THIS FILE DOES NOT DECODE');
    } finally {
      this.set({ busy: false });
    }
  }

  /** FILE : ouvre le choix d'un fichier. */
  pickFile(): void {
    gesture();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac,.ogg';
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) void this.loadFile(f);
    };
    input.click();
  }

  /* ---------------- l'ecran : la page, les reglages ---------------- */

  /** SMPL : la page du sampler sur l'ecran de la platine, ou le morceau. */
  toggleOpen(on = !this.state.open): void {
    this.set({ open: on });
  }

  setTab(t: SmplTab): void {
    if (t !== this.state.tab) this.set({ tab: t });
  }

  lenNext(): void {
    const i = SMPL_LENS.indexOf(this.state.len);
    const len = SMPL_LENS[(i + 1) % SMPL_LENS.length];
    this.set({ len });
    this.say(`REC LENGTH: ${len} BEAT${len > 1 ? 'S' : ''}`, 1400);
  }

  slicingNext(): void {
    const s = this.state;
    const next = SMPL_SLICINGS[(SMPL_SLICINGS.indexOf(s.slicing) + 1) % SMPL_SLICINGS.length];
    this.set({ slicing: next });
    this.reslice();
    this.say(next === 'auto' ? `SLICES AUTO: ${this.padCount()} HITS` : `SLICES ${next}`, 1400);
  }

  modeToggle(): void {
    // Les voix se taisent ; la sequence continue (elle jouera dans le nouveau mode)
    this.send({ type: 'stop' }, false);
    this.touching = false;
    this.set({ pads: [], preview: false, mode: this.state.mode === 'slice' ? 'grain' : 'slice' });
    this.say(this.state.mode === 'grain' ? 'GRAIN: PADS AND THE WAVE PLAY GRAIN CLOUDS' : 'SLICE: PADS PLAY THEIR SLICE', 1800);
  }

  reverseToggle(): void {
    this.set({ reverse: !this.state.reverse });
  }

  loopToggle(): void {
    this.set({ loop: !this.state.loop });
    this.send({ type: 'loop', on: this.state.loop }, false);
  }

  /** Un reglage (0 a 1) ; l'ecran dit sa valeur. POSITION, START et END deplacent les nuages qui jouent. */
  dial(id: SmplKnobId, v: number): void {
    if (!this.params.set(id, v)) return;
    const s = this.state;
    const text = smplReadout(id, this.params.of(id), s.sample?.duration ?? 0);
    this.say(s.mode === 'slice' && GRAIN_KNOBS.has(id) ? `${text}   GRAIN ONLY: PRESS MODE` : text, 1400);
    if (id === 'position' || id === 'start' || id === 'end') this.followClouds();
  }

  /** GRAIN : le nuage de PLAY, celui de l'ecran et ceux des pads tenus suivent POSITION, START et END. */
  private followClouds(): void {
    const s = this.state;
    if (s.mode !== 'grain') return;
    const v = this.params.get();
    const { a, b } = this.region();
    if (s.preview) this.send({ type: 'move', id: PREVIEW, pos: this.cloudPos(), a, b }, false);
    if (this.touching) this.send({ type: 'move', id: TOUCH, pos: this.cloudPos(), a, b }, false);
    for (const i of s.pads) {
      const sl = this.padSlice(i);
      if (sl) this.send({ type: 'move', id: i, pos: sl.a + (sl.b - sl.a) * v.position, a: sl.a, b: sl.b }, false);
    }
  }

  private cloudPos(): number {
    const v = this.params.get();
    const { a, b } = this.region();
    return a + (b - a) * v.position;
  }

  /** GRAIN, la forme d'onde : le doigt pose y fait naitre un nuage (POSITION le suit), leve il s'eteint. */
  touch(down: boolean): void {
    const s = this.state;
    if (down) {
      if (this.touching || s.preview || s.mode !== 'grain') return;
      gesture();
      if (!s.sample) {
        this.say(NO_SAMPLE);
        return;
      }
      const { a, b } = this.region();
      this.touching = true;
      this.send({ type: 'cloud', id: TOUCH, pos: this.cloudPos(), a, b, at: 0, dur: 0 });
      return;
    }
    if (!this.touching) return;
    this.touching = false;
    this.send({ type: 'release', id: TOUCH }, false);
  }

  /* ---------------- jouer ---------------- */

  private setPad(i: number, on: boolean): void {
    if (on) {
      this.pressedAt.set(i, performance.now());
      this.held.add(i);
    } else {
      this.held.delete(i);
      // Lache : la lumiere tient encore un instant (le temps que le worklet dise si la voix sonne)
      this.pressedAt.set(i, performance.now());
    }
    const pads = this.state.pads.filter((p) => p !== i);
    this.set({ pads: on ? [...pads, i] : pads });
  }

  /** Un pad enfonce ou lache. */
  pad(i: number, down: boolean): void {
    const s = this.state;
    if (down) {
      gesture();
      const sl = this.padSlice(i);
      if (!sl) {
        if (!s.sample) this.say(NO_SAMPLE);
        return;
      }
      const v = this.params.get();
      if (s.mode === 'grain') this.send({ type: 'cloud', id: i, pos: sl.a + (sl.b - sl.a) * v.position, a: sl.a, b: sl.b, at: 0, dur: 0 });
      else this.send({ type: 'play', id: i, a: sl.a, b: sl.b, loop: s.loop, at: 0 });
      this.setPad(i, true);
      return;
    }
    this.send({ type: 'release', id: i }, false);
    this.setPad(i, false);
  }

  /** PLAY : la sequence s'il y a des pas ; sinon la region (SLICE) ou le nuage a POSITION (GRAIN) ; encore : tout s'arrete. */
  playToggle(): void {
    gesture();
    const s = this.state;
    if (this.seq.get().running || s.preview) {
      this.stopAll();
      return;
    }
    if (!s.sample) {
      this.set({ open: true });
      this.say(NO_SAMPLE);
      return;
    }
    if (this.seq.any()) {
      void this.ensure().then(() => {
        if (this.seq.start()) this.say('SEQUENCE PLAYING', 1400);
      });
      return;
    }
    const { a, b } = this.region();
    if (s.mode === 'grain') this.send({ type: 'cloud', id: PREVIEW, pos: this.cloudPos(), a, b, at: 0, dur: 0 });
    else this.send({ type: 'play', id: PREVIEW, a, b, loop: true, at: this.nextBeat() });
    this.pressedAt.set(PREVIEW, performance.now() + Math.max(0, (this.nextBeat() - (this.graph?.ctx.currentTime ?? 0)) * 1000));
    this.set({ preview: true });
  }

  /**
   * Le prochain temps de ce qui joue (la platine, sinon le MM-RYTM ou le
   * MM-ARP), pour que la boucle de PLAY parte dessus ; 0 (tout de suite)
   * s'il n'y a pas de grille.
   */
  private nextBeat(): number {
    const c = this.graph?.ctx ?? djEngineIfAny()?.ctx;
    if (!c) return 0;
    const t = c.currentTime + 0.03;
    const g = deckGridAfter(this.deck, t) ?? clock.gridAfter(t) ?? arp.grid(t);
    if (!g) return 0;
    return g.time + ((4 - (g.step % 4)) % 4) * g.dur;
  }

  /** Tout se tait, la sequence s'arrete. */
  stopAll(): void {
    this.seq.stop();
    this.send({ type: 'stop' }, false);
    this.touching = false;
    this.held.clear();
    this.set({ pads: [], preview: false });
  }

  /* ---------------- la sequence ---------------- */

  /** RANDOM : une sequence au hasard sur les slices du moment ; elle part (s'il y a un sample). */
  random(): void {
    gesture();
    this.seq.setAll(randomSteps(this.padCount() || 8, this.stepsPerSlice()));
    if (!this.state.sample) {
      this.say(`RANDOM SEQUENCE: ${NO_SAMPLE}`);
      return;
    }
    if (this.state.preview) {
      this.send({ type: 'release', id: PREVIEW }, false);
      this.set({ preview: false });
    }
    void this.ensure().then(() => this.seq.start());
    this.say('RANDOM SEQUENCE', 1400);
  }

  clear(): void {
    if (!this.seq.any()) {
      this.say('THE SEQUENCE IS EMPTY', 1400);
      return;
    }
    this.seq.clear();
    this.say('SEQUENCE CLEARED', 1400);
  }

  /** On ecoute la slice d'un pas qu'on regle (seulement a l'arret : la sequence joue deja). */
  private audition(k: number | null): void {
    if (k === null || this.seq.get().running) return;
    const sl = this.padSlice(k);
    if (sl) this.send({ type: 'play', id: AUDITION, a: sl.a, b: sl.b, loop: false, at: 0 });
  }

  /** Taper un pas : plein, il se vide ; vide, il prend la slice de son heure dans le sample. */
  stepTap(i: number): void {
    gesture();
    const n = this.padCount();
    const k = sliceForStep(i, n, this.stepsPerSlice());
    this.seq.toggle(i, k);
    const v = this.seq.get().steps[i];
    this.say(v === null ? `STEP ${i + 1} OFF` : `STEP ${i + 1}  SLICE ${(this.seq.sliceOf(v) ?? v) + 1}`, 1400);
    if (v !== null) this.audition(this.seq.sliceOf(v));
  }

  /** La slice d'un pas (glisser sur sa case) ; on l'entend a l'arret. */
  stepSlice(i: number, v: number): void {
    gesture();
    const max = Math.max(1, this.padCount() || SMPL_PADS);
    const k = Math.max(0, Math.min(max - 1, Math.round(v)));
    if (this.seq.get().steps[i] === k) return;
    this.seq.set(i, k);
    this.say(`STEP ${i + 1}  SLICE ${k + 1}`, 1400);
    this.audition(k);
  }

  /** Un trig (MIDI) : sur la page SEQ, l'appui pose ou enleve son pas ; sinon, son pad. */
  trig(i: number, down: boolean): void {
    if (this.state.open && this.state.tab === 'seq') {
      if (down && i < SEQ_STEPS) this.stepTap(i);
      return;
    }
    this.pad(i, down);
  }

  /* ---------------- SAVE ---------------- */

  /** La region au PITCH (vitesse changee, comme a l'ecoute en SLICE), a l'envers avec REV. */
  private render(): { channels: Float32Array[]; rate: number } | null {
    const d = this.data;
    const s = this.state;
    if (!d || !s.sample) return null;
    const v = this.params.get();
    const { a, b } = this.region();
    const i0 = Math.floor(a * d.rate);
    const i1 = Math.min(d.channels[0].length, Math.ceil(b * d.rate));
    const step = Math.pow(2, pitchSemis(v.pitch) / 12);
    const n = Math.max(2, Math.floor((i1 - i0) / step));
    const out = d.channels.map((c) => {
      const o = new Float32Array(n);
      for (let k = 0; k < n; k += 1) {
        const x = i0 + k * step;
        const j = Math.floor(x);
        const t = x - j;
        const y1 = c[Math.min(c.length - 1, j)];
        const y2 = c[Math.min(c.length - 1, j + 1)];
        o[k] = y1 + (y2 - y1) * t;
      }
      if (s.reverse) o.reverse();
      return o;
    });
    return { channels: out, rate: d.rate };
  }

  /** SAVE : la region en WAV, telechargee. */
  save(): void {
    const r = this.render();
    const s = this.state;
    if (!r || !s.sample) {
      this.say('NOTHING TO SAVE YET');
      return;
    }
    const wav = wavOf(r.channels, r.rate);
    const semis = pitchSemis(this.params.of('pitch'));
    const safe = s.sample.name.replace(/[^a-z0-9 ._-]+/gi, '').trim().slice(0, 40) || 'sample';
    const name = `MM-DECKS ${this.deck.toUpperCase()} ${safe}${semis ? ` ${semis > 0 ? '+' : ''}${semis}` : ''}${s.reverse ? ' REV' : ''}.wav`;
    const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    this.say(`SAVED ${name.toUpperCase()}`);
  }

  info() {
    return { deck: this.deck, ready: this.graph !== null, open: this.state.open, tab: this.state.tab, sample: this.state.sample, slices: this.padCount(), voices: this.live.voices.size, clouds: this.live.clouds.size, seq: this.seq.get().running };
  }
}

/* ---------------- un sampler par platine ---------------- */

const all: Partial<Record<DjDeck, Sampler>> = {};

/** Le sampler d'une platine (cree a la premiere demande). */
export function samplerOf(d: DjDeck): Sampler {
  let s = all[d];
  if (!s) {
    s = new Sampler(d);
    all[d] = s;
  }
  return s;
}

/** Les samplers deja crees. */
export const samplers = (): Sampler[] => Object.values(all) as Sampler[];

/** Un sampler sonne-t-il ? (le verrou de lecture) */
export const samplersSounding = (): boolean => samplers().some((s) => s.sounding());
