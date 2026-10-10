/**
 * CHORUS (2026-10-01, effets par piste) : deux lignes de retard courtes
 * (14 et 21 ms) modulees par deux LFO lents (0.53 et 0.71 Hz, +/-7 ms
 * depuis le 2026-10-02, +/-3.5 avant : trop subtil a 100 % pour Mika),
 * l'une a gauche, l'autre a droite : le son s'elargit et ondule. En insert
 * a bypass reel (audio/insert.ts) : a 0 l'entree rejoint directement la
 * sortie ; la branche (retards, LFO, panoramiques) n'existe que tant que le
 * CHORUS est engage, et s'arrete au retour a 0 (LFO stoppes, noeuds
 * debranches). Melange : sec 1 - 0.5 v, chorus 1.0 v (0.35 et 0.7 avant).
 */

import chorusUrl from './chorus.worklet.js?url';
import { glide } from './glide';
import { Insert, UNLINK_MS, type InsertInfo } from './insert';

/**
 * Le chorus sans interpolation lineaire (2026-10-04, audio/chorus.worklet.js,
 * interpolation sinc a 16 points) :
 * son module se charge une fois par contexte (drums.ensure, les rendus hors
 * ligne) ; une branche construite avant (ou sans AudioWorklet) garde les
 * DelayNode d'avant.
 */
const chorusReady = new WeakSet<BaseAudioContext>();
const chorusLoading = new WeakMap<BaseAudioContext, Promise<void>>();
/** Les branches construites avant le module, a passer au worklet des qu'il est la. */
const upgrades = new WeakMap<BaseAudioContext, Set<() => void>>();

function whenChorusReady(c: BaseAudioContext, fn: () => void): void {
  if (chorusReady.has(c) || !chorusLoading.has(c)) return;
  let set = upgrades.get(c);
  if (!set) {
    set = new Set();
    upgrades.set(c, set);
  }
  set.add(fn);
}

export function loadChorus(c: BaseAudioContext): Promise<void> {
  if (chorusReady.has(c)) return Promise.resolve();
  const busy = chorusLoading.get(c);
  if (busy) return busy;
  if (!c.audioWorklet) return Promise.resolve();
  const p = c.audioWorklet
    .addModule(chorusUrl)
    .then(() => {
      chorusReady.add(c);
      const set = upgrades.get(c);
      if (set) for (const fn of set) fn();
      set?.clear();
    })
    .catch(() => undefined);
  chorusLoading.set(c, p);
  return p;
}

/** Le noeud du chorus (mouille seul), ou null tant que son module n'est pas charge. */
function chorusNode(c: BaseAudioContext, opts: Record<string, unknown>): AudioWorkletNode | null {
  if (!chorusReady.has(c)) return null;
  try {
    return new AudioWorkletNode(c, 'mm-chorus', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      // 'max' : une entree mono reste mono (le panoramique mono du StereoPannerNode)
      channelCountMode: 'max',
      processorOptions: opts,
    });
  } catch {
    return null;
  }
}

/** Une voix du chorus : retard de base (s), vitesse du LFO (Hz), panoramique. */
export interface ChorusVoice {
  delay: number;
  rate: number;
  pan: number;
}

/** Reglage d'un chorus : ses voix, la profondeur du LFO (s), le sec et le mouille a 1. */
export interface ChorusCfg {
  voices: readonly ChorusVoice[];
  depth: number;
  dry: number;
  wet: number;
}

const CHORUS: ChorusCfg = {
  voices: [
    { delay: 0.014, rate: 0.53, pan: -0.7 },
    { delay: 0.021, rate: 0.71, pan: 0.7 },
  ],
  depth: 0.007,
  dry: 0.5,
  wet: 1.0,
};

/** CHORUS DEPTH au depart (2026-10-10) : la profondeur des LFO d'avant (s). */
export const CHORUS_DEPTH = CHORUS.depth;
/** Les bornes de setMod : le facteur de vitesse, la profondeur (s ; le worklet garde 60 ms de memoire). */
const MOD = { mulMin: 0.05, mulMax: 8, depthMax: 0.02 } as const;

export interface ChorusInfo {
  value: number;
  /** branche vivante (LFO en marche) */
  live: boolean;
  built: number;
  insert: InsertInfo;
  /** CHORUS RATE et DEPTH (2026-10-10) : le facteur des vitesses, la profondeur (s) ; absents des chorus sans setMod */
  mul?: number;
  depth?: number;
}

export interface ChorusStage {
  input: AudioNode;
  set(v: number): void;
  value(): number;
  reset(): void;
  info(): ChorusInfo;
  /**
   * Les verrous CHORUS d'une voix du MM-RYTM (2026-10-09, audio/lockfx.ts) :
   * tenue (la branche construite et reliee, au repos le meme signal), la
   * valeur d'un coup a l'instant when. Absent du chorus du MM-VOYAGER.
   */
  lockHold?(on: boolean): void;
  lockAt?(when: number, v: number): void;
  /** Appele apres une rampe de set() ou de l'arrivee du worklet : audio/lockfx.ts repose ses points. */
  onRetime?: (() => void) | null;
  /**
   * CHORUS RATE et DEPTH (2026-10-10, la page CHORUS du MM-RYTM) : les
   * vitesses des LFO multipliees par mul, leur profondeur (s), rejointes en
   * douceur. Seul le chorus du bus les recoit ; ceux des voix gardent les
   * leurs, celui du MM-ARP n'en a pas.
   */
  setMod?(mul: number, depth: number): void;
}

/** cfg : le chorus de la boite a rythmes par defaut ; le MM-VOYAGER a le sien (audio/synth.ts). */
export function buildChorus(c: BaseAudioContext, out: AudioNode, cfg: ChorusCfg = CHORUS): ChorusStage {
  const input = c.createGain();
  input.gain.value = 1;
  const insert = new Insert(c, input, out);
  let value = 0;
  let built = 0;
  /** CHORUS RATE et DEPTH (2026-10-10, setMod) : 1 et la profondeur de cfg tant que rien ne les change */
  let mul = 1;
  let modDepth = cfg.depth;
  let branch: { nodes: AudioNode[]; lfos: OscillatorNode[]; w?: AudioWorkletNode; depths?: GainNode[] } | null = null;

  const build = (): void => {
    const bIn = c.createGain();
    const bOut = c.createGain();
    const nodes: AudioNode[] = [bIn, bOut];
    const lfos: OscillatorNode[] = [];
    const depths: GainNode[] = [];
    // Le worklet (interpolation sinc) si son module est la ; sinon les DelayNode
    const w = chorusNode(c, { kind: 'bus', voices: cfg.voices, depth: modDepth, mul });
    if (w) {
      bIn.connect(w);
      w.connect(bOut);
      nodes.push(w);
      branch = { nodes, lfos, w };
      built += 1;
      insert.setBranch(bIn, bOut);
      return;
    }
    for (const v of cfg.voices) {
      const d = c.createDelay(0.05);
      d.delayTime.value = v.delay;
      const lfo = c.createOscillator();
      lfo.frequency.value = v.rate * mul;
      const depth = c.createGain();
      depth.gain.value = modDepth;
      depths.push(depth);
      lfo.connect(depth);
      depth.connect(d.delayTime);
      const pan = c.createStereoPanner();
      pan.pan.value = v.pan;
      bIn.connect(d);
      d.connect(pan);
      pan.connect(bOut);
      lfo.start();
      nodes.push(d, depth, pan, lfo);
      lfos.push(lfo);
    }
    branch = { nodes, lfos, depths };
    built += 1;
    insert.setBranch(bIn, bOut);
    whenChorusReady(c, upgrade);
  };

  // Repos atteint : la branche s'arrete et sort du graphe
  const teardown = (): void => {
    if (!branch) return;
    for (const l of branch.lfos) {
      try {
        l.stop();
      } catch {
        /* deja arrete */
      }
    }
    for (const n of branch.nodes) n.disconnect();
    branch = null;
  };
  insert.onIdle = teardown;

  const apply = (t: number): void => insert.engage(1 - cfg.dry * t, cfg.wet * t);

  // Le module arrive : la branche des DelayNode s'efface (mouille a 0 en 20 ms), le worklet la remplace
  function upgrade(): void {
    if (!branch || value === 0 || branch.lfos.length === 0) return;
    insert.engage(1 - cfg.dry * value, 0);
    setTimeout(() => {
      if (value === 0 || !branch || branch.lfos.length === 0) return;
      teardown();
      build();
      apply(value);
      stage.onRetime?.();
    }, UNLINK_MS);
  }

  const stage: ChorusStage = {
    input,
    onRetime: null,
    set(v: number) {
      const t = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
      if (t === value) return;
      value = t;
      if (t === 0) insert.release();
      else {
        if (!branch) build();
        apply(t);
      }
      stage.onRetime?.();
    },
    value: () => value,
    reset() {
      value = 0;
      insert.reset();
    },
    info: () => ({ value, live: branch !== null, built, insert: insert.info(), mul, depth: modDepth }),
    lockHold(on: boolean) {
      if (on && !branch) build();
      insert.hold(on);
    },
    lockAt(when: number, v: number) {
      const t = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
      if (!branch) return;
      insert.at(when, 1 - cfg.dry * t, cfg.wet * t);
    },
    setMod(m: number, d: number) {
      const nm = Number.isFinite(m) ? Math.max(MOD.mulMin, Math.min(MOD.mulMax, m)) : 1;
      const nd = Number.isFinite(d) ? Math.max(0, Math.min(MOD.depthMax, d)) : cfg.depth;
      if (nm === mul && nd === modDepth) return;
      mul = nm;
      modDepth = nd;
      const b = branch;
      if (!b) return;
      // Le worklet lisse lui-meme (20 ms) ; les DelayNode : la rampe de 20 ms des reglages
      if (b.w) b.w.port.postMessage({ depth: nd, mul: nm });
      b.lfos.forEach((l, i) => glide(l.frequency, cfg.voices[i].rate * nm, c));
      for (const g of b.depths ?? []) glide(g.gain, nd, c);
    },
  };
  return stage;
}

/**
 * Le chorus du MM-VOYAGER (2026-10-03, Mika : "comme un Juno-106") : deux
 * lignes BBD, une par cote, autour de 3.5 ms, modulees par UN triangle lent
 * en opposition de phase (le son s'ouvre en stereo et ondule large), un
 * passe-bas a 8 kHz sur le mouille (la couleur des BBD), sec et mouille a
 * parts egales des que le chorus est engage : il s'entend tout de suite.
 * Le potard va du mode I (0.5 Hz) au mode II (0.85 Hz) ; au-dela des trois
 * quarts, le I+II : un second triangle rapide et peu profond (8 Hz) ajoute
 * son frisson. Insert a bypass reel a 0.
 */
const JUNO = {
  base: 0.0035,
  depth: { min: 0.0016, max: 0.0021 },
  rate: { min: 0.5, max: 0.85 },
  fast: { rate: 8, depth: 0.00022, from: 0.75 },
  lowpass: 8000,
  /** mouille plein des 30 % du potard ; sec et mouille a parts egales (un peu plus de mouille au bout) */
  full: 0.3,
  dry: 0.62,
  wet: 0.78,
} as const;

export function buildJunoChorus(c: BaseAudioContext, out: AudioNode): ChorusStage {
  const input = c.createGain();
  input.gain.value = 1;
  const insert = new Insert(c, input, out);
  let value = 0;
  let built = 0;
  let branch: {
    nodes: AudioNode[];
    lfos: OscillatorNode[];
    /** les DelayNode d'avant (sans worklet) */
    slow?: OscillatorNode;
    depth?: GainNode;
    fastDepth?: GainNode;
    /** le worklet (interpolation sinc) */
    node?: AudioWorkletNode;
  } | null = null;

  const build = (): void => {
    const w = chorusNode(c, { kind: 'juno', base: JUNO.base, depth: JUNO.depth.min, lowpass: JUNO.lowpass });
    if (w) {
      const wIn = c.createGain();
      wIn.connect(w);
      branch = { nodes: [wIn, w], lfos: [], node: w };
      built += 1;
      insert.setBranch(wIn, w);
      return;
    }
    const bIn = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = JUNO.lowpass;
    lp.Q.value = 0.5;
    bIn.connect(lp);
    const dl = c.createDelay(0.02);
    const dr = c.createDelay(0.02);
    dl.delayTime.value = JUNO.base;
    dr.delayTime.value = JUNO.base;
    lp.connect(dl);
    lp.connect(dr);
    const slow = c.createOscillator();
    slow.type = 'triangle';
    slow.frequency.value = JUNO.rate.min;
    const depth = c.createGain();
    depth.gain.value = JUNO.depth.min;
    const inv = c.createGain();
    inv.gain.value = -1;
    slow.connect(depth);
    depth.connect(dl.delayTime);
    depth.connect(inv);
    inv.connect(dr.delayTime);
    const fast = c.createOscillator();
    fast.type = 'triangle';
    fast.frequency.value = JUNO.fast.rate;
    const fastDepth = c.createGain();
    fastDepth.gain.value = 0;
    fast.connect(fastDepth);
    fastDepth.connect(dl.delayTime);
    fastDepth.connect(dr.delayTime);
    const merge = c.createChannelMerger(2);
    dl.connect(merge, 0, 0);
    dr.connect(merge, 0, 1);
    slow.start();
    fast.start();
    branch = { nodes: [bIn, lp, dl, dr, depth, inv, fastDepth, merge, slow, fast], lfos: [slow, fast], slow, depth, fastDepth };
    built += 1;
    insert.setBranch(bIn, merge);
    whenChorusReady(c, upgrade);
  };

  const teardown = (): void => {
    if (!branch) return;
    for (const l of branch.lfos) {
      try {
        l.stop();
      } catch {
        /* deja arrete */
      }
    }
    for (const n of branch.nodes) n.disconnect();
    branch = null;
  };
  insert.onIdle = teardown;

  // Le module arrive : les DelayNode s'effacent en 20 ms, le worklet prend la suite
  function upgrade(): void {
    if (!branch || value === 0 || branch.node) return;
    const m = Math.min(1, value / JUNO.full);
    insert.engage(1 - (1 - JUNO.dry) * m, 0);
    setTimeout(() => {
      if (value === 0 || !branch || branch.node) return;
      teardown();
      build();
      apply(value);
    }, UNLINK_MS);
  }

  function apply(t: number): void {
    const b = branch;
    if (b) {
      const rate = JUNO.rate.min + (JUNO.rate.max - JUNO.rate.min) * t;
      const depth = JUNO.depth.min + (JUNO.depth.max - JUNO.depth.min) * t;
      const f = t > JUNO.fast.from ? (t - JUNO.fast.from) / (1 - JUNO.fast.from) : 0;
      const fastDepth = JUNO.fast.depth * f;
      if (b.node) b.node.port.postMessage({ rate, depth, fastDepth });
      if (b.slow) b.slow.frequency.value = rate;
      if (b.depth) b.depth.gain.value = depth;
      if (b.fastDepth) b.fastDepth.gain.value = fastDepth;
    }
    const m = Math.min(1, t / JUNO.full);
    insert.engage(1 - (1 - JUNO.dry) * m, JUNO.wet * m * (0.85 + 0.15 * t));
  }

  return {
    input,
    set(v: number) {
      const t = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
      if (t === value) return;
      value = t;
      if (t === 0) {
        insert.release();
        return;
      }
      if (!branch) build();
      apply(t);
    },
    value: () => value,
    reset() {
      value = 0;
      insert.reset();
    },
    info: () => ({ value, live: branch !== null, built, insert: insert.info() }),
  };
}
