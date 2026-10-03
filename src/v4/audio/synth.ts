/**
 * Le son du MM-VOYAGEUR (2026-10-03, demande de Mika) : un synthe
 * monophonique d'esprit Moog, tres simple, joue par l'arpegiateur
 * (voyager/arp.ts). Une note :
 *
 *   OSC 1 + OSC 2 (meme forme, FINE les ecarte de part et d'autre de la
 *   note) -> passe-bas 24 dB (deux etages : le premier plat, le second
 *   resonant, RES) -> ampli
 *
 * FILTER EG (ATTACK, DECAY, SUSTAIN, RELEASE) ouvre la coupure de 0 a 6
 * octaves (ENV AMT) ; la coupure suit le clavier a moitie. AMP EG module le
 * volume. WAVE passe de la dent de scie au carre puis a l'impulsion fine
 * (neuf tables d'onde calculees une fois). GLIDE fait glisser chaque note
 * depuis la precedente.
 *
 * Les notes se rejoignent sur un bus : DIST (la saturation de la boite) ->
 * CHORUS (le sien, trois voix lentes et larges, facon Juno : Mika le veut
 * tres present) -> VOLUME -> compresseur de la boite a rythmes
 * (drums.synthPort) ; REVERB et DELAY sont des envois vers les unites de la
 * boite. Le contexte audio est celui de la page, jamais cree ici.
 */

import { voyParams } from '../voyager/params';
import {
  attackS,
  cutoffHz,
  decayS,
  envOctaves,
  fineCents,
  glideS,
  releaseS,
  resDb,
  type VoyValues,
} from '../voyager/params';
import { midiHz } from '../voyager/chords';
import { buildChorus, type ChorusCfg, type ChorusStage } from './chorus';
import { synthPort } from './drums';
import { buildDrive, glide, type DriveStage } from './fx';
import type { Send } from './sends';

/** Le chorus du synthe : trois voix lentes, peu profondes, ouvertes en stereo. */
const SYNTH_CHORUS: ChorusCfg = {
  voices: [
    { delay: 0.0115, rate: 0.41, pan: -0.85 },
    { delay: 0.0165, rate: 0.57, pan: 0.85 },
    { delay: 0.0085, rate: 0.29, pan: 0 },
  ],
  depth: 0.0024,
  dry: 0.35,
  wet: 0.95,
};

/** Niveau d'une note (deux oscillateurs normalises), et VOLUME a 1 (gain au carre). */
const VOICE_K = 0.72;
const VOLUME_K = 1.1;
/**
 * Gain de sortie selon les effets : DIST porte une note de -15 dB au plein
 * (tanh), le volume est repris d'autant ; REVERB et DELAY s'ajoutent au
 * son sec (le DELAY reinjecte) : un peu de marge quand ils montent.
 */
const MAKEUP = { dist: 2.6, delay: 0.35, reverb: 0.3 } as const;
/** Notes qui sonnent en meme temps au plus : au-dela, la plus ancienne s'efface en 5 ms. */
const MAX_VOICES = 10;
/** Tables d'onde : dent de scie (0) -> carre (0.5) -> impulsion de 12 % (1). */
const WAVES = 9;
const HARMONICS = 96;
/** Suivi du clavier de la coupure, autour de fa diese 3. */
const KEY_TRACK = 0.5;
const TRACK_ROOT = 54;

export interface SynthVoice {
  when: number;
  /** fin de la porte (debut du relachement) */
  off: number;
  srcs: OscillatorNode[];
  nodes: AudioNode[];
  amp: GainNode;
}

interface SynthGraph {
  ctx: BaseAudioContext;
  bus: GainNode;
  drive: DriveStage;
  chorus: ChorusStage;
  vol: GainNode;
  reverb: Send;
  delay: Send;
  waves: PeriodicWave[];
}

let sg: SynthGraph | null = null;
const live: SynthVoice[] = [];
let notes = 0;

/** Coefficients de Fourier d'une forme : melange lineaire scie -> carre -> impulsion. */
function waveCoefs(m: number): { real: Float32Array; imag: Float32Array } {
  const real = new Float32Array(HARMONICS + 1);
  const imag = new Float32Array(HARMONICS + 1);
  // m 0 a 0.5 : scie -> carre ; 0.5 a 1 : carre -> impulsion (rapport cyclique 50 % -> 12 %)
  const toSquare = Math.min(1, m * 2);
  const duty = m <= 0.5 ? 0.5 : 0.5 - (m - 0.5) * 0.76;
  for (let n = 1; n <= HARMONICS; n += 1) {
    // Scie : sin, (-1)^(n+1) 2 / (n pi)
    const saw = ((n % 2 === 1 ? 1 : -1) * 2) / (n * Math.PI);
    // Impulsion de rapport d, centree : cos, 2 sin(n pi d) / (n pi)
    const pulse = (2 * Math.sin(n * Math.PI * duty)) / (n * Math.PI);
    imag[n] = saw * (1 - toSquare);
    real[n] = pulse * toSquare;
  }
  return { real, imag };
}

function build(c: BaseAudioContext, out: AudioNode, reverb: { attach(src: AudioNode): Send }, delay: { attach(src: AudioNode): Send }): SynthGraph {
  const bus = c.createGain();
  bus.gain.value = 1;
  const vol = c.createGain();
  vol.gain.value = 0;
  vol.connect(out);
  const chorus = buildChorus(c, vol, SYNTH_CHORUS);
  const drive = buildDrive(c, chorus.input);
  bus.connect(drive.input);
  const waves: PeriodicWave[] = [];
  for (let i = 0; i < WAVES; i += 1) {
    const { real, imag } = waveCoefs(i / (WAVES - 1));
    waves.push(c.createPeriodicWave(real, imag));
  }
  const g: SynthGraph = { ctx: c, bus, drive, chorus, vol, reverb: reverb.attach(vol), delay: delay.attach(vol), waves };
  applyFx(g, voyParams.get(), true);
  return g;
}

/** DIST, CHORUS, envois et VOLUME sur la chaine (chaque reglage ne fait rien s'il ne change pas). */
function applyFx(g: SynthGraph, p: Readonly<VoyValues>, now = false): void {
  g.drive.set(p.dist);
  g.chorus.set(p.chorus);
  g.reverb.set(p.reverb);
  g.delay.set(p.delay);
  const v = (p.volume * p.volume * VOLUME_K) / ((1 + MAKEUP.dist * p.dist) * (1 + MAKEUP.delay * p.delay + MAKEUP.reverb * p.reverb));
  if (now) g.vol.gain.value = v;
  else if (g.vol.gain.value !== v) glide(g.vol.gain, v, g.ctx);
}

voyParams.subscribe(() => {
  if (sg) applyFx(sg, voyParams.get());
});

/** La chaine du synthe sur le contexte de la page, construite au premier besoin ; null sans contexte. */
function graph(): SynthGraph | null {
  if (sg) return sg;
  const port = synthPort();
  if (!port) return null;
  sg = build(port.ctx, port.input, port.reverb, port.delay);
  return sg;
}

/**
 * Enveloppe ADSR lineaire sur un parametre : de lo a hi en A, vers le
 * sustain (lo + (hi - lo) S) en D, puis vers lo en R a la fin de la porte.
 * Une porte plus courte que l'attaque relache depuis la ou l'attaque en est.
 */
function adsr(p: AudioParam, when: number, gate: number, A: number, D: number, S: number, R: number, lo: number, hi: number): void {
  const off = when + gate;
  p.setValueAtTime(lo, when);
  if (A >= gate) {
    p.linearRampToValueAtTime(lo + (hi - lo) * (gate / A), off);
  } else {
    p.linearRampToValueAtTime(hi, when + A);
    p.setTargetAtTime(lo + (hi - lo) * S, when + A, D / 3);
  }
  p.setTargetAtTime(lo, off, R / 3);
}

/** La meme en octaves (coupure du filtre) : rampes exponentielles. */
function adsrHz(p: AudioParam, when: number, gate: number, A: number, D: number, S: number, R: number, base: number, oct: number): void {
  const off = when + gate;
  const peak = base * Math.pow(2, oct);
  p.setValueAtTime(base, when);
  if (A >= gate) {
    p.exponentialRampToValueAtTime(base * Math.pow(2, oct * (gate / A)), off);
  } else {
    p.exponentialRampToValueAtTime(peak, when + A);
    p.setTargetAtTime(base * Math.pow(2, oct * S), when + A, D / 3);
  }
  p.setTargetAtTime(base, off, R / 3);
}

/** Une note : ses noeuds, branchee sur `dest`, programmee a `when` pour une porte de `gate` s. */
function voice(g: SynthGraph, p: Readonly<VoyValues>, midi: number, when: number, gate: number, prev: number | null, accent: number, dest: AudioNode): SynthVoice {
  const c = g.ctx;
  const nyq = c.sampleRate * 0.45;
  const f = midiHz(midi);
  const cents = fineCents(p.fine);
  const wave = g.waves[Math.round(p.wave * (WAVES - 1))];
  const gl = glideS(p.glide);
  const A = Math.max(0.001, attackS(p.aA));
  const D = Math.max(0.005, decayS(p.aD));
  const R = Math.max(0.005, releaseS(p.aR));
  const fA = Math.max(0.001, attackS(p.fA));
  const fD = Math.max(0.005, decayS(p.fD));
  const fR = Math.max(0.005, releaseS(p.fR));
  const gateS = Math.max(0.02, gate);
  const mix = c.createGain();
  mix.gain.value = 0.5;
  const srcs: OscillatorNode[] = [];
  for (const sign of [-1, 1]) {
    const o = c.createOscillator();
    o.setPeriodicWave(wave);
    o.detune.value = (sign * cents) / 2;
    if (gl > 0 && prev !== null && prev !== midi) {
      o.frequency.setValueAtTime(midiHz(prev), when);
      o.frequency.setTargetAtTime(f, when, gl / 3);
    } else {
      o.frequency.setValueAtTime(f, when);
    }
    o.connect(mix);
    srcs.push(o);
  }
  // Passe-bas 24 dB : un etage plat (Butterworth, -3 dB), un etage resonant
  const base = Math.min(nyq, cutoffHz(p.cutoff) * Math.pow(2, ((midi - TRACK_ROOT) / 12) * KEY_TRACK));
  const oct = Math.min(envOctaves(p.envAmt), Math.log2(nyq / base));
  const lp1 = c.createBiquadFilter();
  lp1.type = 'lowpass';
  lp1.Q.value = -3.01;
  const lp2 = c.createBiquadFilter();
  lp2.type = 'lowpass';
  const q = resDb(p.res);
  lp2.Q.value = q;
  for (const lp of [lp1, lp2]) adsrHz(lp.frequency, when, gateS, fA, fD, p.fS, fR, base, Math.max(0, oct));
  // La resonance rehausse la coupure : la moitie de son gain est reprise
  const level = VOICE_K * accent * Math.pow(10, -Math.max(0, q) / 40);
  const amp = c.createGain();
  adsr(amp.gain, when, gateS, A, D, p.aS, R, 0, level);
  mix.connect(lp1);
  lp1.connect(lp2);
  lp2.connect(amp);
  amp.connect(dest);
  const off = when + gateS;
  const end = off + R * 2.6 + 0.02;
  const nodes: AudioNode[] = [...srcs, mix, lp1, lp2, amp];
  srcs[0].onended = () => {
    for (const n of nodes) n.disconnect();
  };
  for (const o of srcs) {
    o.start(when);
    o.stop(end);
  }
  return { when, off, srcs, nodes, amp };
}

/** Oublie les notes finies ; au-dela de MAX_VOICES, la plus ancienne s'efface en 5 ms a `when`. */
function steal(when: number, c: BaseAudioContext): void {
  let k = 0;
  for (let i = 0; i < live.length; i += 1) {
    const v = live[i];
    const end = v.off + 4;
    if (end > c.currentTime) live[k++] = v;
  }
  live.length = k;
  while (live.length >= MAX_VOICES) {
    const v = live.shift();
    if (!v) break;
    const t = Math.max(when, c.currentTime);
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setTargetAtTime(0, t, 0.005);
    for (const s of v.srcs) {
      try {
        s.stop(t + 0.05);
      } catch {
        /* deja arretee */
      }
    }
  }
}

/**
 * Joue une note a `when` (temps du contexte), porte de `gate` s ; prev :
 * la note precedente (GLIDE). Ne cree jamais le contexte. La note est
 * renvoyee (l'arpegiateur la garde pour pouvoir l'annuler) ; null sans son.
 */
export function noteOn(midi: number, when: number, gate: number, prev: number | null = null, accent = 1): SynthVoice | null {
  const g = graph();
  if (!g) return null;
  const t = Math.max(when, g.ctx.currentTime);
  steal(t, g.ctx);
  const v = voice(g, voyParams.get(), midi, t, gate, prev, accent, g.bus);
  live.push(v);
  notes += 1;
  return v;
}

/**
 * STOP de l'arpegiateur : une note pas encore partie ne part jamais ; une
 * note qui sonne relache en 30 ms (pas de clic).
 */
export function cancelNote(v: SynthVoice, c: BaseAudioContext): void {
  const now = c.currentTime;
  if (v.when > now + 0.003) {
    for (const s of v.srcs) {
      s.onended = null;
      try {
        s.stop(0);
      } catch {
        /* deja arretee */
      }
    }
    for (const n of v.nodes) n.disconnect();
    return;
  }
  v.amp.gain.cancelScheduledValues(now);
  v.amp.gain.setTargetAtTime(0, now, 0.01);
  for (const s of v.srcs) {
    try {
      s.stop(now + 0.08);
    } catch {
      /* deja arretee */
    }
  }
}

/* ---------------- rendu hors ligne (tests : rien ne sort des enceintes) ---------------- */

export interface SynthOfflineOpts {
  seconds: number;
  sampleRate?: number;
  /** notes [midi, debut (s), porte (s)] ; accent 1 */
  notes: [number, number, number][];
  /** reglages imposes (les autres : ceux du store) */
  params?: Partial<VoyValues>;
  /** envois REVERB et DELAY vers des unites neuves (true par defaut) */
  sends?: boolean;
  stepS?: number;
}

/** Rendu stereo hors ligne de la chaine complete ; renvoie [gauche, droite]. */
export async function renderSynthOffline(o: SynthOfflineOpts): Promise<[Float32Array, Float32Array]> {
  const sr = o.sampleRate ?? 48000;
  const oc = new OfflineAudioContext(2, Math.round(o.seconds * sr), sr);
  const { buildDelayBus, buildReverbBus } = await import('./sends');
  const out = oc.createGain();
  out.connect(oc.destination);
  const reverb = buildReverbBus(oc, out);
  const delay = buildDelayBus(oc, out, o.stepS ?? 60 / 130 / 4);
  const p = { ...voyParams.get(), ...(o.params ?? {}) };
  const noSend = { attach: () => ({ set: () => undefined, info: () => ({ value: 0, linked: false }) }) };
  const g = build(oc, out, o.sends === false ? noSend : reverb, o.sends === false ? noSend : delay);
  applyFx(g, p, true);
  let prev: number | null = null;
  for (const [m, t, gate] of o.notes) {
    const v = voice(g, p, m, t, gate, prev, 1, g.bus);
    for (const s of v.srcs) s.onended = null;
    prev = m;
  }
  const buf = await oc.startRendering();
  return [buf.getChannelData(0).slice(), buf.getChannelData(1).slice()];
}

/* ---------------- debug (window.__v4.synth) ---------------- */

export const synthDebug = {
  get built(): boolean {
    return sg !== null;
  },
  get live(): number {
    return live.length;
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
  get drive(): number {
    return sg?.drive.value() ?? 0;
  },
  renderOffline: renderSynthOffline,
};
