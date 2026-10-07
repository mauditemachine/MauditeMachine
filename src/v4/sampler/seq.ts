/**
 * La sequence d'un sampler (2026-10-05, nee dans le MM-SMPL ; une par
 * platine du MM-DECKS depuis le 2026-10-07) : seize pas, chacun vide ou une
 * slice (son numero, 0 a 15), comme une piste d'Elektron. La page SEQ de
 * l'ecran de la platine (dj/SamplerScreen.tsx) en fait seize cases : taper
 * pose ou enleve un pas, glisser vers le haut ou le bas change sa slice.
 * RANDOM en tire une, CLEAR la vide, PLAY la joue (sinon, sans pas, la
 * region).
 *
 * Calage : la technique de l'arpegiateur (voyager/arp.ts) : un reveil de
 * 25 ms programme sur l'horloge AUDIO chaque pas de l'horizon (audio/sched.ts ;
 * un changement de pas, de slice, de mode, de region, de POSITION, de tempo
 * ou de swing re-programme tout de suite ce qui n'est pas encore parti, le
 * worklet l'oublie : 'unseq'). La grille : celle de sa platine si elle joue
 * (ses temps, sa vitesse ; 2026-10-07), sinon celle du MM-RYTM, sinon celle
 * du MM-ARP, sinon la sienne au tempo du sample (le SWING de la boite aussi).
 * Chaque pas joue sa slice jusqu'au pas suivant (une piste : le suivant
 * coupe le precedent) ; en GRAIN, un nuage a son debut, le temps du pas.
 */

import { clock } from '../audio/clock';
import { context } from '../audio/drums';
import { pattern } from '../audio/pattern';
import { DROP_AFTER_S, GUARD_S, TICK_MS, askReschedule, horizon, registerScheduler, type Scheduler } from '../audio/sched';
import { SWING } from '../theme';
import { arp } from '../voyager/arp';
import { SMPL_PADS } from './slices';

export const SEQ_STEPS = 16;
/** L'identifiant des voix de la sequence (une piste : une voix a la fois) ; les nuages : SEQ_CLOUD + pas. */
export const SEQ_VOICE = 200;
const SEQ_CLOUD = 300;
const START_DELAY_S = 0.05;
const RING = 32;

export type SmplStep = number | null;

export interface SmplSeqState {
  steps: readonly SmplStep[];
  running: boolean;
}

/** Une grille : le prochain pas (son heure, son numero dans la mesure, sa duree). */
export type SeqGrid = (t: number) => { time: number; step: number; dur: number } | null;

/** Ce que la sequence demande a son sampler. */
export interface SeqHost {
  /** la slice k (ses bornes), ou null */
  slice(k: number): { a: number; b: number } | null;
  /** le nombre de slices */
  count(): number;
  mode(): 'slice' | 'grain';
  position(): number;
  /** le tempo propre quand rien d'autre ne donne la grille */
  bpm(): number;
  /** la grille de la platine qui joue, ou null */
  deckGrid: SeqGrid;
  play(id: number, a: number, b: number, at: number): void;
  cloud(id: number, pos: number, a: number, b: number, at: number, dur: number): void;
  unseq(from: number): void;
}

export class SmplSeq {
  private state: SmplSeqState;
  private listeners = new Set<() => void>();
  private timer = 0;
  private anchor = 0;
  private n = 0;
  private stepDur = 0.125;
  private nextTime = 0;
  private stepIdx = 0;
  /** les pas programmes (la tete de lecture des cases les suit) */
  private ring: { when: number; step: number }[] = [];
  /** les pas programmes pas encore partis : de quoi repartir de chacun (re-programmation) */
  private plan: { time: number; stepIdx: number; anchor: number; n: number; stepDur: number }[] = [];
  private me: Scheduler;

  constructor(
    private key: string,
    private host: SeqHost
  ) {
    this.state = { steps: typeof window === 'undefined' ? Array.from({ length: SEQ_STEPS }, () => null) : this.load(), running: false };
    this.me = { tick: () => this.tick(), reschedule: () => this.reschedule(), order: 2 };
    registerScheduler(this.me);
    let lastBpm = pattern.get().bpm;
    pattern.subscribe(() => {
      if (pattern.get().bpm === lastBpm) return;
      lastBpm = pattern.get().bpm;
      this.ask();
    });
    let lastSwing = pattern.fx.get().swing;
    pattern.fx.subscribe(() => {
      if (pattern.fx.get().swing === lastSwing) return;
      lastSwing = pattern.fx.get().swing;
      this.ask();
    });
  }

  private load(): SmplStep[] {
    const out: SmplStep[] = Array.from({ length: SEQ_STEPS }, () => null);
    try {
      const raw = window.localStorage.getItem(this.key);
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

  private setState(next: SmplSeqState): void {
    const keep = next.steps !== this.state.steps;
    this.state = next;
    if (keep) {
      try {
        window.localStorage.setItem(this.key, JSON.stringify(this.state.steps));
      } catch {
        /* stockage indisponible : la suite vit pour la visite */
      }
      // Un pas change pendant la lecture : on l'entend au prochain passage, pas apres l'horizon
      if (this.state.running) askReschedule(this.me);
    }
    this.listeners.forEach((fn) => fn());
  }

  /** Un reglage qui change ce que joue un pas (la decoupe, le mode, la region, POSITION) : re-programmer. */
  ask(): void {
    if (this.state.running) askReschedule(this.me);
  }

  /* ---------------- l'horloge ---------------- */

  private pushPos(when: number, step: number): void {
    this.ring.push({ when, step });
    if (this.ring.length > RING) this.ring.shift();
  }

  /** La slice qu'un pas joue : son numero, ramene au nombre de slices du moment (une decoupe plus courte la reprend). */
  sliceOf = (v: SmplStep): number | null => {
    if (v === null) return null;
    const count = this.host.count();
    return count > 0 ? v % count : null;
  };

  /** La grille d'une autre source qui joue : la platine d'abord, puis le MM-RYTM, puis le MM-ARP. */
  private gridOf(t: number): { time: number; step: number; dur: number } | null {
    return this.host.deckGrid(t) ?? clock.gridAfter(t) ?? arp.grid(t);
  }

  private ownDur(): number {
    return 60 / Math.max(40, Math.min(240, this.host.bpm())) / 4;
  }

  private scheduleStep(): void {
    // Le SWING de la boite, sauf sur la grille d'une platine (le morceau a le sien)
    const onDeck = !!this.host.deckGrid(this.nextTime + this.stepDur * 0.5);
    const swing = onDeck ? 0 : pattern.fx.get().swing * SWING.maxDelay * this.stepDur;
    const when = this.nextTime + ((this.stepIdx & 1) === 1 ? swing : 0);
    this.pushPos(when, this.stepIdx);
    const k = this.sliceOf(this.state.steps[this.stepIdx]);
    if (k === null) return;
    const sl = this.host.slice(k);
    if (!sl) return;
    if (this.host.mode() === 'grain') {
      // Le nuage tient jusqu'au prochain pas plein (au plus la mesure), a POSITION dans sa slice (SCAN l'y fait avancer)
      let len = 1;
      while (len < SEQ_STEPS && this.state.steps[(this.stepIdx + len) % SEQ_STEPS] === null) len += 1;
      this.host.cloud(SEQ_CLOUD + this.stepIdx, sl.a + (sl.b - sl.a) * this.host.position(), sl.a, sl.b, when, len * this.stepDur);
    } else this.host.play(SEQ_VOICE, sl.a, sl.b, when);
  }

  private advance(): void {
    const g = this.gridOf(this.nextTime + this.stepDur * 0.5);
    if (g) {
      this.nextTime = g.time;
      this.stepIdx = g.step;
      this.stepDur = g.dur;
      this.anchor = this.nextTime;
      this.n = 0;
      return;
    }
    const d = this.ownDur();
    if (Math.abs(d - this.stepDur) > 1e-9) {
      this.anchor = this.nextTime + this.stepDur;
      this.n = 0;
      this.stepDur = d;
      this.nextTime = this.anchor;
    } else {
      this.n += 1;
      this.nextTime = this.anchor + this.n * this.stepDur;
    }
    this.stepIdx = (this.stepIdx + 1) % SEQ_STEPS;
  }

  private tick(): void {
    if (!this.state.running) return;
    const c = context();
    if (!c) return;
    const now = c.currentTime;
    let k = 0;
    const plan = this.plan;
    for (let i = 0; i < plan.length; i += 1) if (plan[i].time >= now) plan[k++] = plan[i];
    plan.length = k;
    const until = horizon(now);
    for (let guard = 0; this.nextTime < until && guard < 96; guard += 1) {
      // Un pas rate de plus de 50 ms (onglet gele) est saute, pas rattrape
      if (this.nextTime >= now - DROP_AFTER_S) {
        plan.push({ time: this.nextTime, stepIdx: this.stepIdx, anchor: this.anchor, n: this.n, stepDur: this.stepDur });
        this.scheduleStep();
      }
      this.advance();
    }
  }

  /** Un changement : les pas pas encore partis (au-dela de GUARD_S) sont oublies du worklet et refaits. */
  private reschedule(): void {
    if (!this.state.running) return;
    const c = context();
    if (!c) return;
    const edge = c.currentTime + GUARD_S;
    const i = this.plan.findIndex((x) => x.time > edge);
    if (i < 0) return;
    const s = this.plan[i];
    this.plan.length = i;
    this.host.unseq(s.time);
    this.ring = this.ring.filter((e) => e.when < s.time);
    this.nextTime = s.time;
    this.stepIdx = s.stepIdx;
    this.anchor = s.anchor;
    this.n = s.n;
    this.stepDur = s.stepDur;
    this.tick();
  }

  start(): boolean {
    if (this.state.running) return true;
    const c = context();
    if (!c || c.state === 'closed') return false;
    const now = c.currentTime;
    const g = this.gridOf(now + 0.02);
    if (g) {
      this.nextTime = g.time;
      this.stepIdx = g.step;
      this.stepDur = g.dur;
    } else {
      this.stepDur = this.ownDur();
      this.nextTime = now + START_DELAY_S;
      this.stepIdx = 0;
    }
    this.anchor = this.nextTime;
    this.n = 0;
    this.ring = [];
    this.plan.length = 0;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.setState({ ...this.state, running: true });
    this.tick();
    return true;
  }

  stop(): void {
    if (!this.state.running) return;
    window.clearInterval(this.timer);
    this.timer = 0;
    this.ring = [];
    this.plan.length = 0;
    this.setState({ ...this.state, running: false });
  }

  /* ---------------- le store ---------------- */

  get = (): SmplSeqState => this.state;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  /** Des pas pleins. */
  any = (): boolean => this.state.steps.some((v) => v !== null);
  /** Taper un pas : plein, il se vide ; vide, il prend la slice slice. */
  toggle(i: number, slice: number): void {
    if (i < 0 || i >= SEQ_STEPS) return;
    const steps = [...this.state.steps];
    steps[i] = steps[i] === null ? slice % SMPL_PADS : null;
    this.setState({ ...this.state, steps });
  }
  /** La slice d'un pas (null : vide). */
  set(i: number, v: SmplStep): void {
    if (i < 0 || i >= SEQ_STEPS) return;
    const x = v === null ? null : Math.max(0, Math.min(SMPL_PADS - 1, Math.round(v)));
    if (this.state.steps[i] === x) return;
    const steps = [...this.state.steps];
    steps[i] = x;
    this.setState({ ...this.state, steps });
  }
  /** Toute la suite (RANDOM). */
  setAll(steps: readonly SmplStep[]): void {
    const out = Array.from({ length: SEQ_STEPS }, (_, i) => {
      const v = steps[i];
      return typeof v === 'number' && v >= 0 ? Math.min(SMPL_PADS - 1, Math.round(v)) : null;
    });
    this.setState({ ...this.state, steps: out });
  }
  clear(): void {
    this.setState({ ...this.state, steps: Array.from({ length: SEQ_STEPS }, () => null) });
  }
  /** Le pas sous la tete de lecture a t (temps du contexte), -1 a l'arret. */
  stepAt(t: number): number {
    if (!this.state.running) return -1;
    let best: { when: number; step: number } | null = null;
    for (const e of this.ring) if (e.when <= t && (!best || e.when > best.when)) best = e;
    return best ? best.step : -1;
  }
}

/**
 * La slice qu'un pas prend quand on le pose (2026-10-07) : celle qui tombe a
 * son heure dans le sample (un sample de quatre temps en huit slices : une
 * slice tous les deux pas) ; sans duree en temps connue, celle de son rang.
 */
export function sliceForStep(i: number, count: number, stepsPerSlice: number | null): number {
  if (count <= 0) return i;
  if (!stepsPerSlice || stepsPerSlice <= 0) return i % count;
  return Math.floor(i / stepsPerSlice) % count;
}

/**
 * Une suite au hasard, mais musicale : le 1 toujours plein (la premiere
 * slice), les temps (1, 5, 9, 13) souvent, les autres pas une fois sur deux
 * (plus souvent la ou une slice commence) ; chaque pas prend plutot la slice
 * de son heure (la boucle d'origine), parfois une autre, parfois la meme que
 * le pas d'avant (un coup repete).
 */
export function randomSteps(count: number, stepsPerSlice: number | null = null): SmplStep[] {
  const m = Math.max(1, Math.min(SMPL_PADS, count));
  const out: SmplStep[] = [];
  for (let i = 0; i < SEQ_STEPS; i += 1) {
    const beat = i % 4 === 0;
    const onSlice = !stepsPerSlice || stepsPerSlice < 1 || i % Math.max(1, Math.round(stepsPerSlice)) === 0;
    const on = i === 0 || Math.random() < (beat ? 0.85 : onSlice ? 0.55 : 0.25);
    if (!on) {
      out.push(null);
      continue;
    }
    if (i === 0) {
      out.push(0);
      continue;
    }
    const prev = out[i - 1];
    const r = Math.random();
    if (prev !== null && prev !== undefined && r < 0.15) out.push(prev);
    else if (r < 0.65) out.push(sliceForStep(i, m, stepsPerSlice));
    else out.push(Math.floor(Math.random() * m));
  }
  return out;
}
