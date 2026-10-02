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

const CHORUS = {
  voices: [
    { delay: 0.014, rate: 0.53, pan: -0.7 },
    { delay: 0.021, rate: 0.71, pan: 0.7 },
  ],
  depth: 0.007,
  dry: 0.5,
  wet: 1.0,
} as const;

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

export function buildChorus(c: BaseAudioContext, out: AudioNode): ChorusStage {
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
    for (const v of CHORUS.voices) {
      const d = c.createDelay(0.05);
      d.delayTime.value = v.delay;
      const lfo = c.createOscillator();
      lfo.frequency.value = v.rate;
      const depth = c.createGain();
      depth.gain.value = CHORUS.depth;
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
      insert.engage(1 - CHORUS.dry * t, CHORUS.wet * t);
    },
    value: () => value,
    reset() {
      value = 0;
      insert.reset();
    },
    info: () => ({ value, live: branch !== null, built, insert: insert.info() }),
  };
}
