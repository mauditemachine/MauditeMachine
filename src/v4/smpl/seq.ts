/**
 * La sequence du MM-SMPL (2026-10-05, Mika : "ya beaucoup de choses qui
 * manquent sur cette machine, genre RANDOM, genre EDIT, genre CLEAR") :
 * seize pas, chacun vide ou une slice (son numero, 0 a 15), comme une piste
 * d'Elektron. EDIT fait des trigs les seize pas (smpl/gestures.ts) : taper
 * pose ou enleve un pas (la slice de meme numero, la decoupe dans l'ordre),
 * glisser vers le haut ou le bas change sa slice. RANDOM en tire une,
 * CLEAR la vide, PLAY la joue (sinon, sans pas, la region comme avant).
 *
 * Calage : la technique de l'arpegiateur (voyager/arp.ts) : un reveil de
 * 25 ms programme sur l'horloge AUDIO chaque pas de l'horizon (300 ms depuis
 * le 2026-10-05, audio/sched.ts ; un changement de pas, de slice, de mode,
 * de region, de POSITION, de tempo ou de swing re-programme tout de suite
 * ce qui n'est pas encore parti, le worklet l'oublie : 'unseq'), sur la
 * grille du MM-RYTM s'il joue, sinon sur celle du MM-ARP, sinon la sienne
 * au tempo du motif (le SWING de la boite aussi). Chaque pas joue sa slice
 * jusqu'au pas suivant (une piste : le suivant coupe le precedent) ; en
 * GRAIN, un nuage a son debut, le temps du pas.
 * La suite est retenue (mm.v4.smpl.seq.1).
 */

import { clock } from '../audio/clock';
import { context } from '../audio/drums';
import { pattern } from '../audio/pattern';
import { DROP_AFTER_S, GUARD_S, TICK_MS, askReschedule, horizon, registerScheduler, type Scheduler } from '../audio/sched';
import { SWING } from '../theme';
import { arp } from '../voyager/arp';
import { smplEngine } from './engine';
import { SMPL_PADS } from './slices';
import { padSlice, smplState } from './state';
import { smplParams } from './params';

export const SEQ_STEPS = 16;
/** L'identifiant des voix de la sequence (une piste : une voix a la fois) ; les nuages : SEQ_CLOUD + pas. */
const SEQ_VOICE = 200;
const SEQ_CLOUD = 300;
const START_DELAY_S = 0.05;
const RING = 32;
const KEY = 'mm.v4.smpl.seq.1';

export type SmplStep = number | null;

export interface SmplSeqState {
  steps: readonly SmplStep[];
  /** EDIT : les trigs sont les pas */
  edit: boolean;
  running: boolean;
}

function load(): SmplStep[] {
  const out: SmplStep[] = Array.from({ length: SEQ_STEPS }, () => null);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return out;
    const o = JSON.parse(raw) as unknown;
    if (!Array.isArray(o)) return out;
    for (let i = 0; i < SEQ_STEPS; i += 1) {
      const v = o[i];
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < SMPL_PADS) out[i] = v;
    }
  } catch {
    /* rien de retenu */
  }
  return out;
}

let state: SmplSeqState = { steps: typeof window === 'undefined' ? Array.from({ length: SEQ_STEPS }, () => null) : load(), edit: false, running: false };
const listeners = new Set<() => void>();

function setState(next: SmplSeqState): void {
  const keep = next.steps !== state.steps;
  state = next;
  if (keep) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state.steps));
    } catch {
      /* stockage indisponible : la suite vit pour la visite */
    }
    // Un pas change pendant la lecture : on l'entend au prochain passage, pas apres l'horizon
    if (state.running) askReschedule(me);
  }
  listeners.forEach((fn) => fn());
}

/* ---------------- l'horloge ---------------- */

let timer = 0;
let anchor = 0;
let n = 0;
let stepDur = 60 / pattern.get().bpm / 4;
let nextTime = 0;
let stepIdx = 0;
/** les pas programmes (la tete de lecture des trigs et de l'ecran les suit) */
let ring: { when: number; step: number }[] = [];
/** les pas programmes pas encore partis : de quoi repartir de chacun (re-programmation) */
const plan: { time: number; stepIdx: number; anchor: number; n: number; stepDur: number }[] = [];

function pushPos(when: number, step: number): void {
  ring.push({ when, step });
  if (ring.length > RING) ring.shift();
}

/** La slice qu'un pas joue : son numero, ramene au nombre de slices du moment (une decoupe plus courte la reprend). */
function sliceOf(v: SmplStep): number | null {
  if (v === null) return null;
  const count = Math.max(0, smplState.get().slices.length - 1);
  return count > 0 ? v % count : null;
}

/** La grille d'une autre machine qui joue : le MM-RYTM d'abord, puis le MM-ARP. */
function gridOf(t: number): { time: number; step: number; dur: number } | null {
  return clock.gridAfter(t) ?? arp.grid(t);
}

function scheduleStep(): void {
  const when = nextTime + ((stepIdx & 1) === 1 ? pattern.fx.get().swing * SWING.maxDelay * stepDur : 0);
  pushPos(when, stepIdx);
  const k = sliceOf(state.steps[stepIdx]);
  if (k === null) return;
  const sl = padSlice(k);
  if (!sl) return;
  const s = smplState.get();
  if (s.mode === 'grain') {
    const v = smplParams.get();
    // Le nuage tient jusqu'au prochain pas plein (au plus la mesure), a POSITION dans sa slice (SCAN l'y fait avancer)
    let len = 1;
    while (len < SEQ_STEPS && state.steps[(stepIdx + len) % SEQ_STEPS] === null) len += 1;
    smplEngine.cloud(SEQ_CLOUD + stepIdx, sl.a + (sl.b - sl.a) * v.position, sl.a, sl.b, when, len * stepDur);
  } else smplEngine.play(SEQ_VOICE, sl.a, sl.b, false, when);
}

function advance(): void {
  const g = gridOf(nextTime + stepDur * 0.5);
  if (g) {
    nextTime = g.time;
    stepIdx = g.step;
    stepDur = g.dur;
    anchor = nextTime;
    n = 0;
    return;
  }
  const d = 60 / pattern.get().bpm / 4;
  if (d !== stepDur) {
    anchor = nextTime + stepDur;
    n = 0;
    stepDur = d;
    nextTime = anchor;
  } else {
    n += 1;
    nextTime = anchor + n * stepDur;
  }
  stepIdx = (stepIdx + 1) % SEQ_STEPS;
}

function tick(): void {
  if (!state.running) return;
  const c = context();
  if (!c) return;
  const now = c.currentTime;
  let k = 0;
  for (let i = 0; i < plan.length; i += 1) if (plan[i].time >= now) plan[k++] = plan[i];
  plan.length = k;
  const until = horizon(now);
  for (let guard = 0; nextTime < until && guard < 96; guard += 1) {
    // Un pas rate de plus de 50 ms (onglet gele) est saute, pas rattrape
    if (nextTime >= now - DROP_AFTER_S) {
      plan.push({ time: nextTime, stepIdx, anchor, n, stepDur });
      scheduleStep();
    }
    advance();
  }
}

/** Un changement : les pas pas encore partis (au-dela de GUARD_S) sont oublies du worklet et refaits. */
function reschedule(): void {
  if (!state.running) return;
  const c = context();
  if (!c) return;
  const edge = c.currentTime + GUARD_S;
  const i = plan.findIndex((x) => x.time > edge);
  if (i < 0) return;
  const s = plan[i];
  plan.length = i;
  smplEngine.unseq(s.time);
  ring = ring.filter((e) => e.when < s.time);
  nextTime = s.time;
  stepIdx = s.stepIdx;
  anchor = s.anchor;
  n = s.n;
  stepDur = s.stepDur;
  tick();
}

const me: Scheduler = { tick, reschedule, order: 2 };
registerScheduler(me);
const ask = (): void => {
  if (state.running) askReschedule(me);
};
// Ce qui change un pas : la suite (setState), la decoupe et le mode, la region et POSITION, le tempo, le swing
let cutKey = '';
smplState.subscribe(() => {
  const st = smplState.get();
  const k = `${st.mode}|${st.slices.join(',')}|${st.sample?.id ?? 0}`;
  if (k === cutKey) return;
  cutKey = k;
  ask();
});
let regionKey = '';
smplParams.subscribe(() => {
  const v = smplParams.get();
  const k = `${v.start}|${v.end}|${v.position}`;
  if (k === regionKey) return;
  regionKey = k;
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

function start(): boolean {
  if (state.running) return true;
  const c = context();
  if (!c || c.state === 'closed') return false;
  const now = c.currentTime;
  const g = gridOf(now + 0.02);
  if (g) {
    nextTime = g.time;
    stepIdx = g.step;
    stepDur = g.dur;
  } else {
    stepDur = 60 / pattern.get().bpm / 4;
    nextTime = now + START_DELAY_S;
    stepIdx = 0;
  }
  anchor = nextTime;
  n = 0;
  ring = [];
  plan.length = 0;
  timer = window.setInterval(tick, TICK_MS);
  setState({ ...state, running: true });
  tick();
  return true;
}

function stop(): void {
  if (!state.running) return;
  window.clearInterval(timer);
  timer = 0;
  ring = [];
  plan.length = 0;
  setState({ ...state, running: false });
}

/* ---------------- RANDOM ---------------- */

/**
 * Une suite au hasard, mais musicale : le 1 toujours plein (la premiere
 * slice), les temps (1,
 * 5, 9, 13) souvent, les autres pas une fois sur deux ; chaque pas prend
 * plutot la slice de son rang (la boucle d'origine, decoupee dans l'ordre),
 * parfois une autre, parfois la meme que le pas d'avant (un coup repete).
 */
export function randomSteps(count: number): SmplStep[] {
  const m = Math.max(1, Math.min(SMPL_PADS, count));
  const out: SmplStep[] = [];
  for (let i = 0; i < SEQ_STEPS; i += 1) {
    const beat = i % 4 === 0;
    const on = i === 0 || Math.random() < (beat ? 0.85 : 0.5);
    if (!on) {
      out.push(null);
      continue;
    }
    // Le 1 : la premiere slice (le debut de la boucle, l'ancre)
    if (i === 0) {
      out.push(0);
      continue;
    }
    const prev = out[i - 1];
    const r = Math.random();
    if (prev !== null && prev !== undefined && r < 0.15) out.push(prev);
    else if (r < 0.6) out.push(i % m);
    else out.push(Math.floor(Math.random() * m));
  }
  return out;
}

/* ---------------- le store ---------------- */

export const smplSeq = {
  get: (): SmplSeqState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Des pas pleins. */
  any: (): boolean => state.steps.some((v) => v !== null),
  setEdit(on: boolean): void {
    if (on !== state.edit) setState({ ...state, edit: on });
  },
  /** Taper un pas : plein, il se vide ; vide, il prend la slice de son rang (ou slice). */
  toggle(i: number, slice?: number): void {
    if (i < 0 || i >= SEQ_STEPS) return;
    const steps = [...state.steps];
    steps[i] = steps[i] === null ? (slice ?? i) % SMPL_PADS : null;
    setState({ ...state, steps });
  },
  /** La slice d'un pas (null : vide). */
  set(i: number, v: SmplStep): void {
    if (i < 0 || i >= SEQ_STEPS) return;
    const x = v === null ? null : Math.max(0, Math.min(SMPL_PADS - 1, Math.round(v)));
    if (state.steps[i] === x) return;
    const steps = [...state.steps];
    steps[i] = x;
    setState({ ...state, steps });
  },
  /** Toute la suite (RANDOM, un rappel). */
  setAll(steps: readonly SmplStep[]): void {
    const out = Array.from({ length: SEQ_STEPS }, (_, i) => {
      const v = steps[i];
      return typeof v === 'number' && v >= 0 ? Math.min(SMPL_PADS - 1, Math.round(v)) : null;
    });
    setState({ ...state, steps: out });
  },
  clear(): void {
    setState({ ...state, steps: Array.from({ length: SEQ_STEPS }, () => null) });
  },
  start,
  stop,
  /** La slice que joue un pas (ramenee a la decoupe du moment), null s'il est vide. */
  sliceOf,
  /** Le pas sous la tete de lecture a t (temps du contexte), -1 a l'arret. */
  stepAt(t: number): number {
    if (!state.running) return -1;
    let best: { when: number; step: number } | null = null;
    for (const e of ring) if (e.when <= t && (!best || e.when > best.when)) best = e;
    return best ? best.step : -1;
  },
  /** L'heure du contexte, s'il y en a un (la tete de lecture). */
  now: (): number => context()?.currentTime ?? 0,
};
