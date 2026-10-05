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
 * 25 ms programme sur l'horloge AUDIO chaque pas des 100 ms a venir, sur la
 * grille du MM-RYTM s'il joue, sinon sur celle du MM-ARP, sinon la sienne
 * au tempo du motif (le SWING de la boite aussi). Chaque pas joue sa slice
 * jusqu'au pas suivant (une piste : le suivant coupe le precedent) ; en
 * GRAIN, un nuage a son debut, le temps du pas.
 * La suite est retenue (mm.v4.smpl.seq.1).
 */

import { clock, LOOKAHEAD_S, TICK_MS } from '../audio/clock';
import { context } from '../audio/drums';
import { pattern } from '../audio/pattern';
import { SWING } from '../theme';
import { arp } from '../voyager/arp';
import { smplEngine } from './engine';
import { SMPL_PADS } from './slices';
import { padSlice, regionOf, smplState } from './state';
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
const ring: { when: number; step: number }[] = [];
let head = 0;

function pushPos(when: number, step: number): void {
  if (ring.length < RING) ring.push({ when, step });
  else ring[head] = { when, step };
  head = (head + 1) % RING;
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
    const r = regionOf(v.start, v.end);
    // Le nuage tient jusqu'au prochain pas plein (au plus la mesure)
    let len = 1;
    while (len < SEQ_STEPS && state.steps[(stepIdx + len) % SEQ_STEPS] === null) len += 1;
    smplEngine.cloud(SEQ_CLOUD + stepIdx, sl.a, r.a, r.b, when, len * stepDur);
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
  const horizon = now + LOOKAHEAD_S;
  for (let guard = 0; nextTime < horizon && guard < 64; guard += 1) {
    // Un pas rate de plus de 50 ms (onglet gele) est saute, pas rattrape
    if (nextTime >= now - 0.05) scheduleStep();
    advance();
  }
}

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
  ring.length = 0;
  head = 0;
  timer = window.setInterval(tick, TICK_MS);
  setState({ ...state, running: true });
  tick();
  return true;
}

function stop(): void {
  if (!state.running) return;
  window.clearInterval(timer);
  timer = 0;
  ring.length = 0;
  head = 0;
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
