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

import { Insert, type InsertInfo } from './insert';

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

export interface ChorusInfo {
  value: number;
  /** branche vivante (LFO en marche) */
  live: boolean;
  built: number;
  insert: InsertInfo;
}

export interface ChorusStage {
  input: AudioNode;
  set(v: number): void;
  value(): number;
  reset(): void;
  info(): ChorusInfo;
}

/** cfg : le chorus de la boite a rythmes par defaut ; le MM-VOYAGER a le sien (audio/synth.ts). */
export function buildChorus(c: BaseAudioContext, out: AudioNode, cfg: ChorusCfg = CHORUS): ChorusStage {
  const input = c.createGain();
  input.gain.value = 1;
  const insert = new Insert(c, input, out);
  let value = 0;
  let built = 0;
  let branch: { nodes: AudioNode[]; lfos: OscillatorNode[] } | null = null;

  const build = (): void => {
    const bIn = c.createGain();
    const bOut = c.createGain();
    const nodes: AudioNode[] = [bIn, bOut];
    const lfos: OscillatorNode[] = [];
    for (const v of cfg.voices) {
      const d = c.createDelay(0.05);
      d.delayTime.value = v.delay;
      const lfo = c.createOscillator();
      lfo.frequency.value = v.rate;
      const depth = c.createGain();
      depth.gain.value = cfg.depth;
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
    branch = { nodes, lfos };
    built += 1;
    insert.setBranch(bIn, bOut);
  };

  // Repos atteint : la branche s'arrete et sort du graphe
  insert.onIdle = () => {
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
      insert.engage(1 - cfg.dry * t, cfg.wet * t);
    },
    value: () => value,
    reset() {
      value = 0;
      insert.reset();
    },
    info: () => ({ value, live: branch !== null, built, insert: insert.info() }),
  };
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
    slow: OscillatorNode;
    depth: GainNode;
    fastDepth: GainNode;
  } | null = null;

  const build = (): void => {
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
  };

  insert.onIdle = () => {
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
      const b = branch;
      if (b) {
        b.slow.frequency.value = JUNO.rate.min + (JUNO.rate.max - JUNO.rate.min) * t;
        b.depth.gain.value = JUNO.depth.min + (JUNO.depth.max - JUNO.depth.min) * t;
        const f = t > JUNO.fast.from ? (t - JUNO.fast.from) / (1 - JUNO.fast.from) : 0;
        b.fastDepth.gain.value = JUNO.fast.depth * f;
      }
      const m = Math.min(1, t / JUNO.full);
      insert.engage(1 - (1 - JUNO.dry) * m, JUNO.wet * m * (0.85 + 0.15 * t));
    },
    value: () => value,
    reset() {
      value = 0;
      insert.reset();
    },
    info: () => ({ value, live: branch !== null, built, insert: insert.info() }),
  };
}
