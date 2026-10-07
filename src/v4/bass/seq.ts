/**
 * La sequence du MM-BASS (2026-10-07) : seize pas programmes sur l'horloge
 * AUDIO, la technique de l'arpegiateur (voyager/arp.ts) : un reveil de 25 ms
 * programme chaque pas de l'horizon (audio/sched.ts ; un changement de pas,
 * de reglage du generateur, de tempo ou de swing re-programme ce qui n'est
 * pas encore parti, le worklet l'oublie : 'unseq'). Sur la grille du
 * MM-RYTM s'il joue, sinon sur celle du MM-ARP, sinon la sienne au tempo du
 * motif ; le SWING de la boite aussi.
 *
 * Chaque pas, comme sur la TB-303 : une note part a son heure et se relache
 * a la moitie du pas (la duree change avec le style : plus courte en ROLL,
 * tenue en SUB) ; une note avec SLIDE ne se relache pas, la suivante glisse
 * vers sa hauteur sans relancer les enveloppes ; une liaison (TIE) prolonge
 * la note d'avant. La hauteur : la tonique (ROOT), la gamme (SCALE), le
 * degre et l'octave du pas, OCTAVE ; ROOT sur ARP : la basse suit la racine
 * de l'accord que joue le MM-ARP (dans la gamme de fa diese).
 */

import { clock } from '../audio/clock';
import { context } from '../audio/drums';
import { pattern } from '../audio/pattern';
import { DROP_AFTER_S, GUARD_S, TICK_MS, askReschedule, horizon, registerScheduler, type Scheduler } from '../audio/sched';
import { SWING } from '../theme';
import { arp } from '../voyager/arp';
import { CHORDS } from '../voyager/chords';
import { bassEngine } from './engine';
import { BASS_SCALES, BASS_STYLES, SCALE_TONES, bassParams, stepOf } from './params';
import { BASS_STEPS, bassState, type BassStep } from './state';

const START_DELAY_S = 0.05;
const RING = 32;
/** La note la plus grave (vers 20 Hz) et la plus aigue. */
const MIDI_MIN = 16;
const MIDI_MAX = 84;
/** La tonique de depart : fa diese 2 (92 Hz), la tonalite du site. */
const BASE = 42;

/** La duree d'une note (en part du pas) selon le style. */
const GATE: Readonly<Record<(typeof BASS_STYLES)[number], number>> = { ACID: 0.52, DISCO: 0.45, ROLL: 0.38, SUB: 0.92 };

/** Le degre de la gamme le plus proche sous un intervalle (pour suivre une racine d'accord). */
function degreeOf(semis: number, tones: readonly number[]): number {
  let best = 0;
  for (let i = 0; i < tones.length; i += 1) if (tones[i] <= semis) best = i;
  return best;
}

/** La hauteur MIDI d'un pas a l'heure t (ROOT sur ARP : l'accord du MM-ARP a cette heure). */
export function midiOf(s: BassStep, t = 0): number {
  const v = bassParams.get();
  const tones = SCALE_TONES[BASS_SCALES[stepOf('scale', v.scale)]];
  const root = stepOf('root', v.root);
  let shift = 0;
  let deg = s.deg;
  if (root === 0) {
    // ARP : fa diese, decale du degre de la racine de l'accord qui joue
    const c = arp.posAt(t + 0.005)?.chord ?? arp.get().prog[0];
    if (c !== undefined && CHORDS[c]) deg += degreeOf(CHORDS[c].root % 12, tones);
  } else {
    const semis = root - 1;
    shift = semis > 5 ? semis - 12 : semis;
  }
  const L = tones.length;
  const o = Math.floor(deg / L);
  const tone = tones[((deg % L) + L) % L];
  const octave = stepOf('octave', v.octave) - 2;
  const m = BASE + shift + tone + 12 * (o + s.oct + octave);
  return Math.max(MIDI_MIN, Math.min(MIDI_MAX, m));
}

/* ---------------- l'horloge ---------------- */

let running = false;
let timer = 0;
let anchor = 0;
let n = 0;
let stepDur = 60 / pattern.get().bpm / 4;
let nextTime = 0;
let stepIdx = 0;
/** la note tenue a la fin du dernier pas programme (SLIDE, TIE) */
let holding = false;
let ring: { when: number; step: number }[] = [];
const plan: { time: number; stepIdx: number; anchor: number; n: number; stepDur: number; holding: boolean }[] = [];

function gridOf(t: number): { time: number; step: number; dur: number } | null {
  return clock.gridAfter(t) ?? arp.grid(t);
}

function scheduleStep(): void {
  const when = nextTime + ((stepIdx & 1) === 1 ? pattern.fx.get().swing * SWING.maxDelay * stepDur : 0);
  ring.push({ when, step: stepIdx });
  if (ring.length > RING) ring.shift();
  const steps = bassState.get().steps;
  const s = steps[stepIdx];
  const next = steps[(stepIdx + 1) % BASS_STEPS];
  const prev = steps[(stepIdx + BASS_STEPS - 1) % BASS_STEPS];
  const style = BASS_STYLES[stepOf('style', bassParams.of('style'))];
  const gate = GATE[style] * stepDur;
  if (s.kind === 'off') {
    if (holding) bassEngine.off(when);
    holding = false;
    return;
  }
  if (s.kind === 'tie') {
    // La note d'avant continue ; rien a tenir : un silence
    if (!holding) return;
    if (next.kind !== 'tie' && !(s.slide && next.kind === 'note')) {
      bassEngine.off(when + gate);
      holding = false;
    }
    return;
  }
  // Une note : glissee depuis la precedente si celle-ci avait SLIDE (ou une liaison qui glisse)
  const legato = holding && prev.kind !== 'off' && prev.slide;
  if (holding && !legato) bassEngine.off(when);
  bassEngine.on(midiOf(s, when), s.acc, legato, when);
  holding = true;
  const held = (s.slide && next.kind === 'note') || next.kind === 'tie';
  if (!held) {
    bassEngine.off(when + gate);
    holding = false;
  }
}

function advance(): void {
  const g = gridOf(nextTime + stepDur * 0.5);
  if (g) {
    nextTime = g.time;
    stepIdx = g.step % BASS_STEPS;
    stepDur = g.dur;
    anchor = nextTime;
    n = 0;
    return;
  }
  const d = 60 / pattern.get().bpm / 4;
  if (Math.abs(d - stepDur) > 1e-9) {
    anchor = nextTime + stepDur;
    n = 0;
    stepDur = d;
    nextTime = anchor;
  } else {
    n += 1;
    nextTime = anchor + n * stepDur;
  }
  stepIdx = (stepIdx + 1) % BASS_STEPS;
}

function tick(): void {
  if (!running) return;
  const c = context();
  if (!c) return;
  const now = c.currentTime;
  let k = 0;
  for (let i = 0; i < plan.length; i += 1) if (plan[i].time >= now) plan[k++] = plan[i];
  plan.length = k;
  const until = horizon(now);
  for (let guard = 0; nextTime < until && guard < 96; guard += 1) {
    if (nextTime >= now - DROP_AFTER_S) {
      plan.push({ time: nextTime, stepIdx, anchor, n, stepDur, holding });
      scheduleStep();
    }
    advance();
  }
}

/** Un changement : les pas pas encore partis (au-dela de GUARD_S) sont oublies du worklet et refaits. */
function reschedule(): void {
  if (!running) return;
  const c = context();
  if (!c) return;
  const edge = c.currentTime + GUARD_S;
  const i = plan.findIndex((x) => x.time > edge);
  if (i < 0) return;
  const s = plan[i];
  plan.length = i;
  bassEngine.unseq(s.time);
  ring = ring.filter((e) => e.when < s.time);
  nextTime = s.time;
  stepIdx = s.stepIdx;
  anchor = s.anchor;
  n = s.n;
  stepDur = s.stepDur;
  holding = s.holding;
  tick();
}

const me: Scheduler = { tick, reschedule, order: 3 };
registerScheduler(me);
const ask = (): void => {
  if (running) askReschedule(me);
};
let lastSteps = bassState.get().steps;
bassState.subscribe(() => {
  const st = bassState.get();
  if (st.steps === lastSteps) return;
  lastSteps = st.steps;
  ask();
});
let pitchKey = '';
bassParams.subscribe(() => {
  const v = bassParams.get();
  const k = `${v.root}|${v.scale}|${v.octave}|${v.style}`;
  if (k === pitchKey) return;
  pitchKey = k;
  ask();
});
let lastBpm = pattern.get().bpm;
pattern.subscribe(() => {
  if (pattern.get().bpm === lastBpm) return;
  lastBpm = pattern.get().bpm;
  ask();
});
let lastSwing = pattern.fx.get().swing;
pattern.fx.subscribe(() => {
  if (pattern.fx.get().swing === lastSwing) return;
  lastSwing = pattern.fx.get().swing;
  ask();
});

export const bassSeq = {
  start(): boolean {
    if (running) return true;
    const c = context();
    if (!c || c.state === 'closed') return false;
    const now = c.currentTime;
    const g = gridOf(now + 0.02);
    if (g) {
      nextTime = g.time;
      stepIdx = g.step % BASS_STEPS;
      stepDur = g.dur;
    } else {
      stepDur = 60 / pattern.get().bpm / 4;
      nextTime = now + START_DELAY_S;
      stepIdx = 0;
    }
    anchor = nextTime;
    n = 0;
    holding = false;
    ring = [];
    plan.length = 0;
    running = true;
    timer = window.setInterval(tick, TICK_MS);
    bassState.set({ running: true });
    tick();
    return true;
  },
  stop(): void {
    if (!running) return;
    running = false;
    window.clearInterval(timer);
    timer = 0;
    ring = [];
    plan.length = 0;
    holding = false;
    bassEngine.stop();
    bassState.set({ running: false });
  },
  get running(): boolean {
    return running;
  },
  /** Le pas sous la tete de lecture a t (temps du contexte), -1 a l'arret. */
  stepAt(t: number): number {
    if (!running) return -1;
    let best: { when: number; step: number } | null = null;
    for (const e of ring) if (e.when <= t && (!best || e.when > best.when)) best = e;
    return best ? best.step : -1;
  },
  now: (): number => context()?.currentTime ?? 0,
};
