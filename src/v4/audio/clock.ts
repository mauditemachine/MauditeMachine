/**
 * Horloge du sequenceur (spec 9) : ordonnancement par anticipation sur
 * l'horloge AUDIO. Un setInterval de 25 ms reveille l'ordonnanceur, qui
 * programme sur ctx.currentTime chaque pas tombant dans les 100 ms a venir.
 * La grille est exacte : nextTime = ancre + n x stepDur, jamais une
 * mesure du temps ecoule ni une somme de pas (revue de la revision 2 : la
 * somme derivait de 1e-8 ms par minute, en flottants), et un pas programme
 * ne bouge plus. Le minuteur ne donne jamais l'heure (pas de setTimeout
 * seul) : un reveil en retard programme plus pres de l'echeance, il ne
 * decale rien.
 *
 * Le rendu (LED, flash des pads, Dock) suit la position AUDIO avec
 * entryAt(ctx.currentTime), pas l'instant de programmation qui la precede
 * de 100 ms au plus. onStep() previent a chaque pas programme (reveil de la
 * boucle de rendu). CLEAR vide le motif sans arreter la lecture. STOP
 * annule les coups deja programmes qui n'ont pas encore sonne : un RUN
 * juste apres ne les entend pas par-dessus son premier pas, et une piste
 * SoundCloud qui demarre n'a pas 100 ms de batterie sur ses premieres notes.
 *
 * SWING (revision 2, spec 20.8) : les pas pairs (2, 4 ... 16, index
 * impairs) partent en retard de swing x un tiers de pas, sur le temps
 * programme lui-meme (jamais un minuteur) ; la grille attendue du journal
 * (expected) porte le meme retard, drift() se mesure donc contre la grille
 * swinguee. La valeur est lue a chaque pas programme : un reglage s'entend
 * au plus 100 ms plus tard (l'horizon), comme un changement de tempo.
 */

import { voices } from '../state/voices';
import { SWING } from '../theme';
import { cancelVoice, context, trigger, type Voice } from './drums';
import { INSTRUMENTS, STEP_COUNT, VEL_GAIN, pattern, velocity } from './pattern';

/** Reveil de l'ordonnanceur, en ms. */
export const TICK_MS = 25;
/** Horizon de programmation, en s. */
export const LOOKAHEAD_S = 0.1;
/** Premier pas 50 ms apres RUN : le debut se programme proprement. */
const START_DELAY_S = 0.05;
/**
 * Un pas rate de plus de 50 ms (onglet gele, processeur sature) est saute
 * et compte, pas rattrape en rafale : la grille continue sans decalage.
 */
const DROP_AFTER_S = 0.05;
/** Garde-fou d'une boucle de programmation (une mesure entiere et plus). */
const MAX_PER_TICK = 64;
const RING = 64;

/** Un pas programme. */
export interface StepEvent {
  /** numero global croissant */
  seq: number;
  /** 0 a 15 */
  step: number;
  /** instant programme, temps du contexte (la grille, swing compris) */
  when: number;
  /** grille ideale : ancre + n x duree du pas + retard du swing */
  expected: number;
  /** ctx.currentTime au moment de la programmation */
  at: number;
  /** instruments joues : bit k = INSTRUMENTS[k] */
  mask: number;
  /** retard du swing (s) : 0 sur les pas impairs (1, 3 ... 15) */
  off: number;
}

export interface Drift {
  /** ecart |when - expected| : max et moyenne, en ms, depuis RUN (ou resetStats) */
  maxMs: number;
  meanMs: number;
  /** pas programmes apres leur echeance (at > when) : 0 dans un onglet au premier plan */
  lateMs: number;
  lateCount: number;
  /** pas programmes et pas sautes (DROP_AFTER_S) */
  count: number;
  dropped: number;
  /** avance minimale d'une programmation (when - at), en ms */
  minLeadMs: number;
  /** plus long intervalle entre deux reveils, en ms */
  maxTickGapMs: number;
  ticks: number;
}

export const stepDuration = (bpm: number): number => 60 / bpm / 4;

let running = false;
let timer = 0;
let bpm = pattern.get().bpm;
let stepDur = stepDuration(bpm);
/** nouvelle duree en attente de la prochaine frontiere de pas ; 0 = aucune */
let pendingDur = 0;
let anchor = 0;
let n = 0;
let nextTime = 0;
let step = 0;
let seq = 0;
/** premier seq de la lecture en cours */
let runFirst = 0;
const ring: StepEvent[] = [];
let head = 0;
/** voix programmees par la lecture en cours, pas encore toutes parties */
const pending: Voice[] = [];
/** repli sans WebGL affiche : plus de machine, RUN refuse (index.tsx) */
let locked = false;

const stats = {
  count: 0,
  maxDrift: 0,
  sumDrift: 0,
  maxLate: 0,
  lateCount: 0,
  dropped: 0,
  minLead: Infinity,
  ticks: 0,
  maxGap: 0,
  lastTick: 0,
  /** voix annulees par STOP depuis le chargement (jamais remis a zero) */
  cancelled: 0,
};

const runListeners = new Set<() => void>();
const stepListeners = new Set<(e: StepEvent) => void>();

function resetStats(): void {
  stats.count = 0;
  stats.maxDrift = 0;
  stats.sumDrift = 0;
  stats.maxLate = 0;
  stats.lateCount = 0;
  stats.dropped = 0;
  stats.minLead = Infinity;
  stats.ticks = 0;
  stats.maxGap = 0;
  stats.lastTick = 0;
}

function push(e: StepEvent): void {
  if (ring.length < RING) ring.push(e);
  else ring[head] = e;
  head = (head + 1) % RING;
}

/** i = 0 : le pas le plus recemment programme. */
function recent(i: number): StepEvent | undefined {
  if (i >= ring.length) return undefined;
  return ring[(head - 1 - i + 2 * RING) % RING];
}

/** Programme un pas : les voix a `when`, l'entree du journal, les ecouteurs. */
function schedule(s: number, when: number, expected: number, now: number, off: number): void {
  const steps = pattern.get().steps;
  let mask = 0;
  for (let k = 0; k < INSTRUMENTS.length; k += 1) {
    const inst = INSTRUMENTS[k];
    // Velocite 1 a 3 (0 : rien) ; les coups du sequenceur sont toujours des
    // charleys fermes ; MUTE et SOLO (state/voices.ts) retirent la voix
    const vel = velocity(steps, inst, s);
    if (vel > 0 && voices.plays(inst)) {
      mask |= 1 << k;
      trigger(inst, when, false, pending, VEL_GAIN[vel]);
    }
  }
  const e: StepEvent = { seq, step: s, when, expected, at: now, mask, off };
  seq += 1;
  push(e);
  const drift = Math.abs(when - expected);
  stats.count += 1;
  stats.sumDrift += drift;
  if (drift > stats.maxDrift) stats.maxDrift = drift;
  const late = now - when;
  if (late > 0) {
    stats.lateCount += 1;
    if (late > stats.maxLate) stats.maxLate = late;
  }
  if (-late < stats.minLead) stats.minLead = -late;
  stepListeners.forEach((fn) => fn(e));
}

/** Oublie les voix deja parties (compactage sur place, aucune allocation). */
function prune(now: number): void {
  let k = 0;
  for (let i = 0; i < pending.length; i += 1) {
    if (pending[i].when >= now) pending[k++] = pending[i];
  }
  pending.length = k;
}

function tick(): void {
  if (!running) return;
  const c = context();
  if (!c) return;
  const p = performance.now();
  if (stats.lastTick > 0 && p - stats.lastTick > stats.maxGap) stats.maxGap = p - stats.lastTick;
  stats.lastTick = p;
  stats.ticks += 1;
  // Contexte suspendu (onglet cache) : currentTime est fige, rien ne part
  const now = c.currentTime;
  prune(now);
  const horizon = now + LOOKAHEAD_S;
  for (let guard = 0; nextTime < horizon && guard < MAX_PER_TICK; guard += 1) {
    // Nouveau tempo : il part de cette frontiere de pas, la grille s'y reancre
    if (pendingDur > 0) {
      stepDur = pendingDur;
      pendingDur = 0;
      anchor = nextTime;
      n = 0;
    }
    if (nextTime < now - DROP_AFTER_S) stats.dropped += 1;
    else {
      // SWING : un pas pair (index impair) part plus tard, jamais au-dela d'un tiers de pas
      const off = (step & 1) === 1 ? pattern.fx.get().swing * SWING.maxDelay * stepDur : 0;
      schedule(step, nextTime + off, anchor + n * stepDur + off, now, off);
    }
    // Depuis l'ancre, pas par addition : aucune erreur qui s'accumule
    n += 1;
    nextTime = anchor + n * stepDur;
    step = (step + 1) % STEP_COUNT;
  }
}

const emit = (): void => runListeners.forEach((fn) => fn());

function setBpm(b: number): void {
  if (b === bpm) return;
  bpm = b;
  const d = stepDuration(b);
  // En lecture : a la prochaine frontiere de pas ; a l'arret : tout de suite
  if (running) pendingDur = d;
  else stepDur = d;
}

// Le tempo suit le store du motif (TEMPO, tests, rechargement)
pattern.subscribe(() => setBpm(pattern.get().bpm));

function start(): boolean {
  if (running) return true;
  if (locked) return false;
  const c = context();
  if (!c || c.state === 'closed') return false;
  bpm = pattern.get().bpm;
  stepDur = stepDuration(bpm);
  pendingDur = 0;
  anchor = c.currentTime + START_DELAY_S;
  nextTime = anchor;
  n = 0;
  step = 0;
  runFirst = seq;
  resetStats();
  running = true;
  timer = window.setInterval(tick, TICK_MS);
  tick();
  emit();
  return true;
}

/**
 * STOP : les coups programmes qui n'ont pas encore sonne (100 ms au plus)
 * sont annules. Ceux qui partent dans le quantum de rendu en cours (moins
 * de 3 ms) jouent jusqu'au bout : les couper net ferait un clic.
 */
function stop(): void {
  if (!running) return;
  running = false;
  window.clearInterval(timer);
  timer = 0;
  const c = context();
  if (c) {
    const edge = c.currentTime + 128 / c.sampleRate;
    for (let i = 0; i < pending.length; i += 1) {
      if (pending[i].when > edge) {
        cancelVoice(pending[i]);
        stats.cancelled += 1;
      }
    }
  }
  pending.length = 0;
  emit();
}

/** Le dernier pas de la lecture en cours dont l'instant est passe a t (temps du contexte). */
function entryAt(t: number): StepEvent | null {
  if (!running) return null;
  for (let i = 0; i < ring.length; i += 1) {
    const e = recent(i);
    if (!e || e.seq < runFirst) return null;
    if (e.when <= t) return e;
  }
  return null;
}

function drift(): Drift {
  const ms = (s: number): number => s * 1000;
  return {
    maxMs: ms(stats.maxDrift),
    meanMs: stats.count > 0 ? ms(stats.sumDrift / stats.count) : 0,
    lateMs: ms(stats.maxLate),
    lateCount: stats.lateCount,
    count: stats.count,
    dropped: stats.dropped,
    minLeadMs: stats.minLead === Infinity ? 0 : ms(stats.minLead),
    maxTickGapMs: stats.maxGap,
    ticks: stats.ticks,
  };
}

export const clock = {
  get running(): boolean {
    return running;
  },
  get bpm(): number {
    return bpm;
  },
  /** RUN : exige le contexte (cree par le geste qui appelle) ; false sinon. */
  start,
  stop,
  /**
   * Repli sans WebGL (perte de contexte, erreur) : STOP, et RUN refuse tant
   * qu'il est affiche ; la page de repli n'a aucune commande de transport.
   */
  lock(on: boolean): void {
    locked = on;
    if (on) stop();
  },
  /** RUN/STOP ; renvoie le nouvel etat. */
  toggle(): boolean {
    if (running) stop();
    else start();
    return running;
  },
  /** CLEAR : vide les quatre rangees, la lecture continue (spec 7.2). */
  clear(): void {
    pattern.clear();
  },
  entryAt,
  /** Le pas sous la tete de lecture a t (temps du contexte), -1 a l'arret ou avant le premier. */
  currentStep(t: number): number {
    return entryAt(t)?.step ?? -1;
  },
  /** RUN et STOP. */
  subscribe(fn: () => void): () => void {
    runListeners.add(fn);
    return () => {
      runListeners.delete(fn);
    };
  },
  /** Chaque pas programme, a l'instant de programmation (jusqu'a 100 ms avant l'echeance). */
  onStep(fn: (e: StepEvent) => void): () => void {
    stepListeners.add(fn);
    return () => {
      stepListeners.delete(fn);
    };
  },
  drift,
  /** Nouvelle fenetre de mesure pour drift(), sans toucher a la lecture. */
  resetStats,
};

/* ---------------- debug (window.__v4.clock) ---------------- */

export interface ClockDebug {
  readonly running: boolean;
  readonly bpm: number;
  readonly stepDur: number;
  /** les 64 derniers pas programmes, du plus ancien au plus recent */
  readonly scheduled: StepEvent[];
  drift(): Drift;
  resetStats(): void;
  /** le pas sous la tete de lecture maintenant (-1 a l'arret) */
  currentStep(): number;
  /** voix programmees pas encore parties ; voix annulees par STOP (total) */
  readonly pending: number;
  readonly cancelled: number;
  /** RUN refuse (repli sans WebGL affiche) */
  readonly locked: boolean;
}

export const clockDebug: ClockDebug = {
  get running() {
    return running;
  },
  get bpm() {
    return bpm;
  },
  get stepDur() {
    return stepDur;
  },
  get scheduled() {
    const out: StepEvent[] = [];
    for (let i = ring.length - 1; i >= 0; i -= 1) {
      const e = recent(i);
      if (e) out.push({ ...e });
    }
    return out;
  },
  drift,
  resetStats,
  currentStep() {
    const c = context();
    return c ? clock.currentStep(c.currentTime) : -1;
  },
  get pending() {
    return pending.length;
  },
  get cancelled() {
    return stats.cancelled;
  },
  get locked() {
    return locked;
  },
};
