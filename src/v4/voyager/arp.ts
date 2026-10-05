/**
 * L'arpegiateur du MM-VOYAGER (2026-10-03). Les pads forment une
 * progression : un pad touche s'y ajoute (dans l'ordre des tapes, huit au
 * plus), retouche il en sort ; chaque accord dure une mesure, puis le
 * suivant. Le premier accord lance l'arpege ; plus d'accord (CLEAR, dernier
 * pad retire) : il s'arrete. RUN/STOP (2026-10-03) l'arrete ou le relance
 * sans toucher a la progression (vide : il part sur F#m) ; arrete, les pads
 * composent la progression sans le relancer. RANDOM le lance.
 *
 * Calage : la meme technique que l'horloge de la boite a rythmes
 * (audio/clock.ts) : un reveil de 25 ms programme sur l'horloge AUDIO
 * chaque note de l'horizon (300 ms depuis le 2026-10-05, audio/sched.ts ;
 * 100 ms avant : le son se coupait au moindre gel de la page). Un
 * changement (un accord, la suite, RATE, GATE, OCTAVE, MODE, RANGE, NOTES,
 * ACCENT, DRIFT, le tempo, le swing) re-programme tout de suite les notes
 * pas encore parties : chaque pas programme garde de quoi repartir de lui
 * (sa grille, la mesure, l'accord, la note, la derniere hauteur), le
 * moteur oublie les notes annulees ('cancel'). Un pas saute (plus de 50 ms
 * de retard) fait quand meme avancer la mesure et la suite : la
 * progression ne se decale plus. Quand la boite a rythmes joue, chaque pas
 * est pris sur SA grille (clock.gridAfter) : l'arpege tombe exactement sur
 * ses temps, mesures comprises, et suit son tempo ; sinon il tient sa
 * propre grille au meme tempo, et c'est la boite qui s'y cale si on la
 * lance ensuite (clock.follow) : les deux machines tombent toujours sur
 * les memes temps et les memes mesures. Le SWING de la boite s'applique aussi aux
 * doubles croches de l'arpege. Accents legers, facon basse de Mika (le
 * "a" de chaque temps plus fort).
 *
 * Les notes (2026-10-04) : la suite de voyager/seq.ts, en degres de la
 * gamme au-dessus de la racine de l'accord : AUTO (MODE, RANGE, NOTES, les
 * memes notes qu'avant) ou EDIT (la suite modifiee a la main, silences
 * compris). Chaque pas, note ou silence, est note (posAt) : la suite
 * montre ce qui joue.
 *
 * Une seule source a la fois, comme RUN : une piste SoundCloud qui part
 * arrete l'arpege (audio/soundcloud.ts, la progression reste) ; un accord
 * touche pendant une piste la met en pause (actions).
 */

import { clock } from '../audio/clock';
import { context } from '../audio/drums';
import { pattern } from '../audio/pattern';
import { DROP_AFTER_S, GUARD_S, TICK_MS, askReschedule, horizon, registerScheduler, type Scheduler } from '../audio/sched';
import { noteOn, synthCancel, synthStop } from '../audio/synth';
import { SWING } from '../theme';
import { CHORDS, degreeMidi } from './chords';
import { gateFrac, octaveShift, stepsPerNote, voyParams } from './params';
import { poolSteps, seq, type SeqStep } from './seq';

const START_DELAY_S = 0.05;
const MAX_CHORDS = 8;
/** Accents par double croche du temps : 1, e, et, a (le "a" en avant). */
const ACCENT = [1, 0.8, 0.92, 1.12] as const;
const RING = 32;

export interface ArpState {
  /** progression : indices de CHORDS, dans l'ordre des tapes */
  prog: readonly number[];
  running: boolean;
}

/** Une note programmee (l'ecran et les pads la suivent a l'heure audio). */
export interface ArpNote {
  seq: number;
  when: number;
  chord: number;
  midi: number;
}

/** Un pas de la suite programme, note ou silence (la tete de lecture de la suite le suit). */
export interface ArpPos {
  when: number;
  /** position dans la suite, et sa longueur */
  pos: number;
  len: number;
  chord: number;
}

let state: ArpState = { prog: [], running: false };
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

let timer = 0;
let anchor = 0;
let n = 0;
let stepDur = 60 / pattern.get().bpm / 4;
let nextTime = 0;
let stepIdx = 0;
/** mesures commencees depuis le depart */
let bar = -1;
let chord = -1;
let noteIdx = 0;
let lastMidi: number | null = null;
let serial = 0;
/** le pas suivant est le premier : il ouvre la mesure, quel que soit son numero */
let first = true;
let ring: ArpNote[] = [];
let posRing: ArpPos[] = [];

/** Un pas programme : tout ce qu'il faut pour repartir de lui (re-programmation). */
interface Snap {
  time: number;
  stepIdx: number;
  anchor: number;
  n: number;
  stepDur: number;
  bar: number;
  chord: number;
  noteIdx: number;
  lastMidi: number | null;
  first: boolean;
}
const plan: Snap[] = [];

function setState(next: ArpState): void {
  state = next;
  emit();
}

function push(e: ArpNote): void {
  ring.push(e);
  if (ring.length > RING) ring.shift();
}

function pushPos(e: ArpPos): void {
  posRing.push(e);
  if (posRing.length > RING) posRing.shift();
}

/** L'accord de la mesure en cours : celui de la progression, ou le suivant si on l'a retire. */
function chordFor(b: number): number {
  const p = state.prog;
  if (p.length === 0) return -1;
  return p[((b % p.length) + p.length) % p.length];
}

/** Programme les notes du pas courant (une, deux en 1/32, ou aucune) ; silent : un pas saute, la suite avance sans rien jouer. */
function scheduleStep(now: number, silent = false): void {
  const p = voyParams.get();
  // Nouvelle mesure : l'accord suivant, l'arpege repart de sa premiere note
  if (first || stepIdx === 0) {
    bar += 1;
    first = false;
    const c = chordFor(bar);
    if (c !== chord) noteIdx = 0;
    chord = c;
  } else if (!state.prog.includes(chord)) {
    // Accord retire en cours de mesure : le suivant, tout de suite
    chord = chordFor(bar);
    noteIdx = 0;
  }
  if (chord < 0) return;
  const spn = stepsPerNote(p.rate);
  if (spn > 1 && stepIdx % spn !== 0) return;
  const swing = (stepIdx & 1) === 1 ? pattern.fx.get().swing * SWING.maxDelay * stepDur : 0;
  const interval = spn * stepDur;
  const per = spn < 1 ? 2 : 1;
  const shift = 12 * octaveShift(p.octave);
  // La suite (voyager/seq.ts) : EDIT, ou AUTO (MODE, RANGE, NOTES) ; null : RAND, une note tiree a chaque pas
  const steps = seq.steps(chord);
  const pool = steps ? [] : poolSteps(chord, p, 0);
  const len = steps ? steps.length : pool.length;
  if (len === 0) return;
  for (let k = 0; k < per; k += 1) {
    const when = nextTime + swing + k * interval;
    const pos = noteIdx % len;
    noteIdx += 1;
    if (silent) continue;
    let d: SeqStep;
    if (steps) {
      d = steps[pos];
    } else {
      // Au hasard, jamais deux fois la meme note de suite
      let pick = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && degreeMidi(chord, pool[pick]) + shift === lastMidi) pick = (pick + 1) % pool.length;
      d = pool[pick];
      seq.noteLive(pos, d);
    }
    pushPos({ when, pos, len, chord });
    // Un silence de la suite : rien ne part, le glissement repartira de la derniere note
    if (d === null) continue;
    const midi = degreeMidi(chord, d) + shift;
    // ACCENT (TWEAKS) : la profondeur des accents, 0.5 celle d'avant, 0 tout a plat, 1 le double
    // DRIFT (2026-10-05) : chaque note un peu plus ou moins appuyee (+-4 % a 5), une main plutot qu'une machine
    const human = 1 + (Math.random() - 0.5) * 0.16 * p.drift;
    const accent = Math.max(0.3, (1 + (ACCENT[stepIdx % 4] * (k === 1 ? 0.85 : 1) - 1) * 2 * p.accent) * human);
    const gate = Math.max(0.02, gateFrac(p.gate) * interval);
    noteOn(midi, when, gate, lastMidi, accent);
    lastMidi = midi;
    push({ seq: serial, when, chord, midi });
    serial += 1;
  }
  void now;
}

/** Pas suivant : sur la grille de la boite a rythmes si elle joue, sinon sur la notre. */
function advance(): void {
  const g = clock.gridAfter(nextTime + stepDur * 0.5);
  if (g) {
    nextTime = g.time;
    stepIdx = g.step;
    stepDur = g.dur;
    // Si la boite s'arrete, notre grille repart de ce pas
    anchor = nextTime;
    n = 0;
    return;
  }
  const d = 60 / pattern.get().bpm / 4;
  if (d !== stepDur) {
    // Nouveau tempo : il part de cette frontiere de pas
    anchor = nextTime + stepDur;
    n = 0;
    stepDur = d;
    nextTime = anchor;
  } else {
    n += 1;
    nextTime = anchor + n * stepDur;
  }
  stepIdx = (stepIdx + 1) % 16;
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
    // Un pas rate de plus de 50 ms (onglet gele) est saute, pas rattrape : la mesure et la suite avancent quand meme
    if (nextTime >= now - DROP_AFTER_S) {
      plan.push({ time: nextTime, stepIdx, anchor, n, stepDur, bar, chord, noteIdx, lastMidi, first });
      scheduleStep(now);
    } else scheduleStep(now, true);
    advance();
  }
}

/** Un changement : les pas pas encore partis (au-dela de GUARD_S) sont oublies du moteur et refaits. */
function reschedule(): void {
  if (!state.running) return;
  const c = context();
  if (!c) return;
  const edge = c.currentTime + GUARD_S;
  const i = plan.findIndex((x) => x.time > edge);
  if (i < 0) return;
  const s = plan[i];
  plan.length = i;
  synthCancel(s.time);
  ring = ring.filter((e) => e.when < s.time);
  posRing = posRing.filter((e) => e.when < s.time);
  nextTime = s.time;
  stepIdx = s.stepIdx;
  anchor = s.anchor;
  n = s.n;
  stepDur = s.stepDur;
  bar = s.bar;
  chord = s.chord;
  noteIdx = s.noteIdx;
  lastMidi = s.lastMidi;
  first = s.first;
  tick();
}

const me: Scheduler = { tick, reschedule, order: 1 };
registerScheduler(me);
const ask = (): void => {
  if (state.running) askReschedule(me);
};
// Ce qui change les notes : les potards de l'arpege (pas ceux du son, que le moteur suit en direct), la suite, le tempo, le swing
const arpKey = (): string => {
  const p = voyParams.get();
  return `${p.rate}|${p.gate}|${p.octave}|${p.mode}|${p.range}|${p.notes}|${p.chord}|${p.accent}|${p.drift}`;
};
let lastArpKey = arpKey();
voyParams.subscribe(() => {
  const k = arpKey();
  if (k === lastArpKey) return;
  lastArpKey = k;
  ask();
});
seq.subscribe(ask);
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
  const g = clock.gridAfter(now + 0.02);
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
  bar = -1;
  chord = -1;
  noteIdx = 0;
  lastMidi = null;
  first = true;
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
  synthStop();
  chord = -1;
  plan.length = 0;
  setState({ ...state, running: false });
}

/**
 * La progression change : sans accord, l'arpege s'arrete ; le premier
 * accord (ou go : RANDOM) le lance ; arrete par RUN/STOP, les pads ne le
 * relancent pas.
 */
function setProg(prog: number[], go = false): void {
  const was = state.prog.length;
  const playing = state.running;
  setState({ ...state, prog });
  if (prog.length === 0) stop();
  else if (go || was === 0) start();
  // Un accord ajoute ou retire pendant qu'il joue : les pas deja programmes le suivent
  if (playing) ask();
}

/**
 * La grille de l'arpege qui joue seul (la boite a rythmes arretee) : la
 * premiere frontiere de pas a t ou apres, et son numero. La boite s'y cale
 * quand on la lance (clock.follow).
 */
function gridAfter(t: number): { time: number; step: number } | null {
  if (!state.running || clock.running) return null;
  const k = Math.ceil((t - nextTime) / stepDur - 1e-9);
  return { time: nextTime + k * stepDur, step: (((stepIdx + k) % 16) + 16) % 16 };
}
clock.follow(gridAfter);

export const arp = {
  get: (): ArpState => state,
  /** La grille de l'arpege qui joue seul (l'oscilloscope s'y cale, ui/Scope.tsx) : premiere frontiere de pas a t ou apres, son numero, sa duree. */
  grid(t: number): { time: number; step: number; dur: number } | null {
    const g = gridAfter(t);
    return g ? { ...g, dur: stepDur } : null;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Pad touche : l'accord entre dans la progression, ou en sort. */
  toggle(i: number): void {
    if (i < 0 || i >= CHORDS.length) return;
    const p = state.prog;
    if (p.includes(i)) setProg(p.filter((k) => k !== i));
    else if (p.length < MAX_CHORDS) setProg([...p, i]);
  },
  /** RANDOM : une progression toute faite, qui part. */
  set(prog: readonly number[]): void {
    setProg(prog.filter((k) => k >= 0 && k < CHORDS.length).slice(0, MAX_CHORDS), true);
  },
  /** Un preset (state/presets.ts) : la progression, sans lancer ni arreter l'arpege (vide : il s'arrete). */
  load(prog: readonly number[]): void {
    const p = prog.filter((k) => Number.isInteger(k) && k >= 0 && k < CHORDS.length).slice(0, MAX_CHORDS);
    setState({ ...state, prog: p });
    if (p.length === 0) stop();
    else ask();
  },
  /** RUN/STOP : arrete ou relance ; sans progression, part sur F#m. Renvoie l'etat. */
  toggleRun(): boolean {
    if (state.running) stop();
    else if (state.prog.length === 0) setProg([0], true);
    else start();
    return state.running;
  },
  /** Piste SoundCloud qui part : silence, la progression reste. */
  stop,
  /** CLEAR, piste SoundCloud qui part, demontage : plus d'accord, silence. */
  clear(): void {
    if (state.prog.length === 0 && !state.running) return;
    setProg([]);
  },
  /** Le pas de la suite qui joue a t (temps du contexte) ; null a l'arret. */
  posAt(t: number): ArpPos | null {
    if (!state.running) return null;
    let best: ArpPos | null = null;
    for (const e of posRing) if (e.when <= t && (!best || e.when > best.when)) best = e;
    return best;
  },
  /** L'accord qui sonne a t (temps du contexte), et sa note ; null a l'arret. */
  noteAt(t: number): ArpNote | null {
    if (!state.running) return null;
    let best: ArpNote | null = null;
    for (const e of ring) if (e.when <= t && (!best || e.seq > best.seq)) best = e;
    return best;
  },
};

/* ---------------- debug (window.__v4.arp) ---------------- */

export const arpDebug = {
  get state(): ArpState {
    return state;
  },
  get notes(): ArpNote[] {
    return ring.slice().sort((a, b) => a.seq - b.seq);
  },
  get stepIdx(): number {
    return stepIdx;
  },
  get bar(): number {
    return bar;
  },
};
