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
 * chaque note des 100 ms a venir. Quand la boite a rythmes joue, chaque pas
 * est pris sur SA grille (clock.gridAfter) : l'arpege tombe exactement sur
 * ses temps, mesures comprises, et suit son tempo ; sinon il tient sa
 * propre grille au meme tempo, et c'est la boite qui s'y cale si on la
 * lance ensuite (clock.follow) : les deux machines tombent toujours sur
 * les memes temps et les memes mesures. Le SWING de la boite s'applique aussi aux
 * doubles croches de l'arpege. Accents legers, facon basse de Mika (le
 * "a" de chaque temps plus fort).
 *
 * Une seule source a la fois, comme RUN : une piste SoundCloud qui part
 * arrete l'arpege (audio/soundcloud.ts, la progression reste) ; un accord
 * touche pendant une piste la met en pause (actions).
 */

import { clock, LOOKAHEAD_S, TICK_MS } from '../audio/clock';
import { context } from '../audio/drums';
import { pattern } from '../audio/pattern';
import { noteOn, synthStop } from '../audio/synth';
import { SWING } from '../theme';
import { arpSequence, CHORDS, type ArpMode } from './chords';
import { gateFrac, octaveShift, octaves, stepIndex, stepsPerNote, voyParams } from './params';

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
let seq = 0;
/** le pas suivant est le premier : il ouvre la mesure, quel que soit son numero */
let first = true;
const ring: ArpNote[] = [];
let head = 0;

function setState(next: ArpState): void {
  state = next;
  emit();
}

function push(e: ArpNote): void {
  if (ring.length < RING) ring.push(e);
  else ring[head] = e;
  head = (head + 1) % RING;
}

/** L'accord de la mesure en cours : celui de la progression, ou le suivant si on l'a retire. */
function chordFor(b: number): number {
  const p = state.prog;
  if (p.length === 0) return -1;
  return p[((b % p.length) + p.length) % p.length];
}

/** Programme les notes du pas courant (une, deux en 1/32, ou aucune). */
function scheduleStep(now: number): void {
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
  const mode = stepIndex('mode', p.mode) as ArpMode;
  const shift = 12 * octaveShift(p.octave);
  const seqNotes = arpSequence(chord, octaves(p.range), mode).map((m) => m + shift);
  if (seqNotes.length === 0) return;
  for (let k = 0; k < per; k += 1) {
    const when = nextTime + swing + k * interval;
    let midi: number;
    if (mode === 3) {
      // Au hasard, jamais deux fois la meme note de suite
      let pick = Math.floor(Math.random() * seqNotes.length);
      if (seqNotes.length > 1 && seqNotes[pick] === lastMidi) pick = (pick + 1) % seqNotes.length;
      midi = seqNotes[pick];
    } else {
      midi = seqNotes[noteIdx % seqNotes.length];
    }
    noteIdx += 1;
    const accent = ACCENT[stepIdx % 4] * (k === 1 ? 0.85 : 1);
    const gate = Math.max(0.02, gateFrac(p.gate) * interval);
    noteOn(midi, when, gate, lastMidi, accent);
    lastMidi = midi;
    push({ seq, when, chord, midi });
    seq += 1;
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
  const horizon = now + LOOKAHEAD_S;
  for (let guard = 0; nextTime < horizon && guard < 64; guard += 1) {
    // Un pas rate de plus de 50 ms (onglet gele) est saute, pas rattrape
    if (nextTime >= now - 0.05) scheduleStep(now);
    advance();
  }
}

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
  setState({ ...state, running: false });
}

/**
 * La progression change : sans accord, l'arpege s'arrete ; le premier
 * accord (ou go : RANDOM) le lance ; arrete par RUN/STOP, les pads ne le
 * relancent pas.
 */
function setProg(prog: number[], go = false): void {
  const was = state.prog.length;
  setState({ ...state, prog });
  if (prog.length === 0) stop();
  else if (go || was === 0) start();
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
