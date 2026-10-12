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
  /** le chorus du MM-ARP (2026-10-12, facon Juno-106) : la vitesse de son triangle (Hz), 0 coupe */
  rate?: number;
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
 * Le chorus du MM-ARP, refait le 2026-10-12 a l'identique de celui du Roland
 * Juno-106 (Mika : "ARP le chorus n'est pas efficace.. je veux le meme chorus
 * sur le Roland Juno 106"). D'apres le schema de la carte JACK du Juno-106
 * (service notes, 31 juillet 1984) et les mesures publiees du Juno-60 (le
 * meme circuit : deux MN3009 de 256 etages, leurs horloges MN3101) :
 * - un seul LFO triangle (IC1 : un trigger et un integrateur, C3 0.1 uF) et
 *   son inverse (IC2a, 33K sur 33K) : chacun mene l'horloge d'un BBD, les
 *   deux lignes en opposition de phase, une par sortie ;
 * - les modes ne changent que sa vitesse (Tr1 court-circuite R3, 2.2M) :
 *   I 0.513 Hz, II 0.863 Hz (mesures ; le calcul du schema donne 0.55 et
 *   0.90, un Juno-106 mesure 0.5 et 0.8), la meme course de 1.66 a 5.35 ms
 *   (mesuree, filtres compris) ; pas de I+II sur le 106 : la carte n'a que
 *   deux commandes, CHORUS ON/OFF et CHORUS I/II ;
 * - l'horloge suit le triangle (un VCO a courant) et le retard d'un BBD est
 *   256 / (2 x horloge) : le retard suit l'inverse du triangle, la hauteur
 *   ondule plus vers le long retard (le vibrato du Juno, jusqu'a 22 cents en
 *   I et 37 en II, contre 8 avant) ;
 * - chaque sortie (IC6) : le sec plein (100K / 47K) et sa ligne (100K / 39K,
 *   apres le diviseur des deux sorties du BBD, 47K sur 1.65K) : 1.16 fois
 *   plus de mouille que de sec, a gauche avec une ligne, a droite avec
 *   l'autre ; chorus coupe, le sec seul ;
 * - autour des BBD (un 4 poles avant, le meme apres) : deux Sallen-Key a 22K,
 *   820p / 680p (9.7 kHz, Q 0.55) et 1.8n / 270p (10.4 kHz, Q 1.29), un
 *   Butterworth vers 10 kHz, plus 10K et 2.2n (7.2 kHz) a l'entree du BBD :
 *   le mouille s'eteint vers 7 kHz, plus sombre que le sec.
 * TRIM : le niveau d'ensemble, pour que le MM-ARP lise au VU du MIXER ce
 * qu'il lisait avec le chorus d'avant a son depart (R14-258) ; le rapport
 * du Juno entre sec et mouille ne change pas. Insert a bypass reel : OFF,
 * la branche n'existe pas (aucun calcul).
 */
export const JUNO = {
  /** les vitesses du triangle, mode I puis II (Hz) */
  rates: [0.513, 0.863],
  /** la course du retard entendu (s), mesuree filtres compris */
  delay: { min: 0.00166, max: 0.00535 },
  /** le retard de groupe des filtres (s) : la ligne seule va de min - 0.106 ms a max - 0.106 ms */
  filterDelay: 0.000106,
  /** les Sallen-Key d'avant et d'apres les BBD (Hz, Q), et le pole de l'entree du BBD (Hz) */
  biquads: [
    [9688, 0.549],
    [10378, 1.291],
    [9688, 0.549],
    [10378, 1.291],
  ],
  pole: 7234,
  /** le mouille contre le sec, sur chaque sortie (R71 / R72 et le diviseur des sorties du BBD) */
  wet: 1.16,
  /** le niveau d'ensemble, chorus en marche (0.66 avant le 2026-10-12 : +0.36 dB au MIXER contre l'ancien chorus) */
  trim: 0.633,
} as const;

/** Les modes du chorus du MM-ARP : 0 OFF, 1 I, 2 II. */
export type JunoMode = 0 | 1 | 2;

export function buildJunoChorus(c: BaseAudioContext, out: AudioNode): ChorusStage {
  const input = c.createGain();
  input.gain.value = 1;
  const insert = new Insert(c, input, out);
  let mode: JunoMode = 0;
  let built = 0;
  let branch: {
    nodes: AudioNode[];
    lfos: OscillatorNode[];
    /** les DelayNode de secours (sans worklet) : leur LFO */
    slow?: OscillatorNode;
    /** le worklet (interpolation sinc) */
    node?: AudioWorkletNode;
  } | null = null;
  const lineMin = JUNO.delay.min - JUNO.filterDelay;
  const lineMax = JUNO.delay.max - JUNO.filterDelay;
  const rateOf = (m: JunoMode): number => JUNO.rates[m === 2 ? 1 : 0];

  const build = (): void => {
    const w = chorusNode(c, { kind: 'juno', dmin: lineMin, dmax: lineMax, biquads: JUNO.biquads, pole: JUNO.pole, rate: rateOf(mode) });
    if (w) {
      const wIn = c.createGain();
      wIn.connect(w);
      branch = { nodes: [wIn, w], lfos: [], node: w };
      built += 1;
      insert.setBranch(wIn, w);
      return;
    }
    // Sans worklet : deux DelayNode, un triangle lineaire (le meme centre, la meme course), les deux Sallen-Key d'avant
    const bIn = c.createGain();
    let last: AudioNode = bIn;
    const nodes: AudioNode[] = [bIn];
    for (const [hz, q] of JUNO.biquads.slice(0, 2)) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = hz;
      f.Q.value = 20 * Math.log10(q);
      last.connect(f);
      nodes.push(f);
      last = f;
    }
    const dl = c.createDelay(0.02);
    const dr = c.createDelay(0.02);
    const mid = (lineMin + lineMax) / 2;
    dl.delayTime.value = mid;
    dr.delayTime.value = mid;
    last.connect(dl);
    last.connect(dr);
    const slow = c.createOscillator();
    slow.type = 'triangle';
    slow.frequency.value = rateOf(mode);
    const depth = c.createGain();
    depth.gain.value = (lineMax - lineMin) / 2;
    const inv = c.createGain();
    inv.gain.value = -1;
    slow.connect(depth);
    depth.connect(dl.delayTime);
    depth.connect(inv);
    inv.connect(dr.delayTime);
    const merge = c.createChannelMerger(2);
    dl.connect(merge, 0, 0);
    dr.connect(merge, 0, 1);
    slow.start();
    nodes.push(dl, dr, depth, inv, merge, slow);
    branch = { nodes, lfos: [slow], slow };
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

  // Chaque sortie : le sec et sa ligne, au rapport du Juno ; TRIM pour le niveau d'ensemble
  const engage = (): void => insert.engage(JUNO.trim, JUNO.trim * JUNO.wet);

  // Le module arrive : les DelayNode s'effacent en 20 ms, le worklet prend la suite
  function upgrade(): void {
    if (!branch || mode === 0 || branch.node) return;
    insert.engage(JUNO.trim, 0);
    setTimeout(() => {
      if (mode === 0 || !branch || branch.node) return;
      teardown();
      build();
      engage();
    }, UNLINK_MS);
  }

  return {
    input,
    /** v : le mode (0 OFF, 1 I, 2 II) ; I et II ne changent que la vitesse du triangle, sans saut */
    set(v: number) {
      const m: JunoMode = v >= 1.5 ? 2 : v >= 0.5 ? 1 : 0;
      if (m === mode) return;
      const was = mode;
      mode = m;
      if (m === 0) {
        insert.release();
        return;
      }
      if (branch) {
        if (branch.node) branch.node.port.postMessage({ rate: rateOf(m) });
        if (branch.slow) branch.slow.frequency.value = rateOf(m);
      } else build();
      if (was === 0) engage();
    },
    value: () => mode,
    reset() {
      mode = 0;
      insert.reset();
    },
    info: () => ({ value: mode, live: branch !== null, built, insert: insert.info(), rate: mode ? rateOf(mode) : 0 }),
  };
}
