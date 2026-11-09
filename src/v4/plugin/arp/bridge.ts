/**
 * Le pont de la face du MM-ARP et de son plugin (2026-11-09, plugin/mm-arp), sur le modele de celui du MM-RYTM
 * (plugin/bridge.ts).
 *
 * Le plugin joue le son (C++), fenetre fermee et pendant un export d'Ableton : la face n'est que la face. Elle compile ce
 * qu'il faut jouer en un PROGRAMME, avec les fonctions du site lui-meme : les reglages du moteur tels que audio/synth.ts
 * les envoie a son worklet (engineState), les effets de la chaine (applyFx), et l'arpege resolu en notes MIDI (la suite de
 * chaque accord de la progression, voyager/seq.ts et chords.ts, OCTAVE comprise). Le C++ refait voyager/arp.ts
 * scheduleStep avec : il n'a ni gamme ni suite a calculer. Le programme part a chaque changement (50 ms de repos), l'etat
 * complet (les cles mm.v4.* du localStorage) 900 ms apres.
 *
 * Dans l'autre sens : la position du C++ (mm_transport) fait running et la tete de lecture (voyager/arp.ts arpExternal :
 * l'ecran, les pads, la suite). Le son du navigateur est coupe (FLAGS.mute), son arpegiateur ne programme rien.
 *
 * Protocole (window.__JUCE__.backend, sans la bibliotheque JS de JUCE) :
 *   face -> C++ : mm_ready {}, mm_program {program}, mm_state {ls}, mm_run {on}, mm_log {where, msg}
 *   C++ -> face : mm_transport {playing, internal, seq, slot, pos, len, chord, midi}
 * (pas de mm_note : la face du MM-ARP ne joue aucune note en direct, un pad ajoute ou retire un accord de la progression)
 */

import { pattern } from '../../audio/pattern';
import { engineState, GATE_MIN_S } from '../../audio/synth';
import { FLAGS } from '../../state/flags';
import { presets } from '../../state/presets';
import { SWING } from '../../theme';
import { ACCENT_DEPTHS } from '../../voyager/preview';
import { arp, arpExternal, type ArpExtHead } from '../../voyager/arp';
import { CHORDS, degreeMidi } from '../../voyager/chords';
import { chorusMode, delaySixteenths, fxAmount, gateFrac, monoLowHz, octaveShift, stepsPerNote, VOY_STORAGE_KEY, voyParams } from '../../voyager/params';
import { poolSteps, seq } from '../../voyager/seq';
import { extHead } from '../head';
import { STATE_PREFIX } from '../restore';

/* ---------------- le programme (lu par plugin/mm-arp/dsp/Arp.cpp) ---------------- */

export interface ArpProgChord {
  /** l'accord (indice de CHORDS) */
  c: number;
  /** la suite (EDIT, ou AUTO : MODE, RANGE, NOTES, CHORD) en notes MIDI, OCTAVE comprise ; null : un silence */
  steps?: (number | null)[];
  /** MODE RAND en AUTO : la reserve ou tirer chaque note (MIDI, OCTAVE comprise) */
  pool?: number[];
}

export interface ArpProgram {
  v: 1;
  kind: 'arp';
  /** le tempo de la face (l'horloge interne quand Ableton est arrete) */
  bpm: number;
  /** le retard des doubles croches impaires, en part de pas (SWING x 1/3) */
  swing: number;
  /** audio/synth.ts engineMsg sans bpm : { ...engineParams(v), outLevel: volGain(v) } */
  engine: Record<string, number>;
  /** la chaine du synthe (audio/synth.ts applyFx) */
  fx: { chorus: number; delay: number; reverb: number; tape: number; dly16: number; monoHz: number; volume: number };
  arp: {
    /** pas de double croche par note (4, 2, 1, 0.5 : deux notes par pas) */
    spn: number;
    /** la porte, en part de l'intervalle entre deux notes ; gateMin : la plus courte (s, audio/synth.ts GATE_MIN_S) */
    gate: number;
    gateMin: number;
    /** ACCENT et DRIFT (TWEAKS) : 0 a 1 */
    accent: number;
    drift: number;
    /** les accents par double croche du temps (1, e, et, a : voyager/arp.ts ACCENT) */
    accents: number[];
    /** la progression (indices de CHORDS), un accord par mesure */
    prog: number[];
    /** chaque accord distinct de la progression */
    chords: ArpProgChord[];
  };
}

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;

function compile(): ArpProgram {
  const p = voyParams.get();
  const prog = [...arp.get().prog];
  const shift = 12 * octaveShift(p.octave);
  const chords: ArpProgChord[] = [];
  for (const c of prog) {
    if (chords.some((x) => x.c === c)) continue;
    const steps = seq.steps(c);
    if (steps) chords.push({ c, steps: steps.map((d) => (d === null ? null : degreeMidi(c, d) + shift)) });
    else chords.push({ c, pool: poolSteps(c, p, 0).map((d) => degreeMidi(c, d) + shift) });
  }
  const engine: Record<string, number> = {};
  for (const [k, v] of Object.entries(engineState(p))) engine[k] = r6(v);
  return {
    v: 1,
    kind: 'arp',
    bpm: pattern.get().bpm,
    swing: r6(pattern.fx.get().swing * SWING.maxDelay),
    engine,
    fx: {
      chorus: chorusMode(p.chorus),
      delay: r6(p.delay),
      reverb: r6(p.reverb),
      tape: r6(fxAmount(p.tape)),
      dly16: delaySixteenths(p.dlyTime),
      monoHz: r6(monoLowHz(p.monoLow)),
      volume: r6(p.volume),
    },
    arp: {
      spn: stepsPerNote(p.rate),
      gate: r6(gateFrac(p.gate)),
      gateMin: GATE_MIN_S,
      accent: r6(p.accent),
      drift: r6(p.drift),
      accents: [...ACCENT_DEPTHS],
      prog,
      chords,
    },
  };
}

/* ---------------- JUCE ---------------- */

interface JuceBackend {
  addEventListener(id: string, fn: (o: unknown) => void): unknown;
  emitEvent(id: string, o: unknown): void;
}

const backend = (): JuceBackend | null => {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { __JUCE__?: { backend?: JuceBackend } }).__JUCE__?.backend ?? null;
};

function send(id: string, o: unknown): void {
  try {
    backend()?.emitEvent(id, o);
  } catch {
    /* le plugin est parti (fenetre fermee) : rien a faire */
  }
}

/* ---------------- le transport du C++ ---------------- */

let internal = false;

const num = (x: unknown, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);

function onTransport(o: unknown): void {
  if (!o || typeof o !== 'object') return;
  const x = o as Record<string, unknown>;
  internal = x.internal === true;
  const chord = num(x.chord, -1);
  const h: ArpExtHead = {
    playing: x.playing === true,
    seq: num(x.seq, -1),
    slot: num(x.slot, -1),
    pos: num(x.pos, -1),
    len: Math.max(0, num(x.len, 0)),
    chord: chord >= 0 && chord < CHORDS.length ? chord : -1,
    midi: num(x.midi, -1),
  };
  arpExternal.head(h);
  // Les boucles de rendu se reveillent (scene/renderer.ts : extHead.onWake)
  extHead.wake();
}

/* ---------------- l'etat (les cles du site) ---------------- */

/**
 * La progression (le site ne la garde pas : chaque visite repart sans accord) : le plugin la garde dans le projet, avec le
 * reste ; remise au chargement (arp.load : sans lancer ni arreter l'arpege).
 */
const PROG_KEY = 'mm.v4.plugin.arp.prog';

function saveProg(): void {
  try {
    window.localStorage.setItem(PROG_KEY, JSON.stringify(arp.get().prog));
  } catch {
    /* stockage refuse : rien */
  }
}

function loadProg(): void {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PROG_KEY) ?? 'null') as unknown;
    if (Array.isArray(raw) && raw.length > 0) arp.load(raw.filter((k): k is number => typeof k === 'number'));
  } catch {
    /* illisible : sans accord */
  }
}

function snapshotLs(): Record<string, string> {
  const ls: Record<string, string> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STATE_PREFIX)) {
        const v = window.localStorage.getItem(k);
        if (v !== null) ls[k] = v;
      }
    }
  } catch {
    /* stockage refuse : rien */
  }
  return ls;
}

/* ---------------- le pont ---------------- */

let started = false;
let progTimer = 0;
let stateTimer = 0;
let lastProgram = '';
let lastProg = '';

function sendProgram(): void {
  progTimer = 0;
  let json: string;
  try {
    json = JSON.stringify(compile());
  } catch (err) {
    arpBridge.log('compile', String(err));
    return;
  }
  if (json === lastProgram) return;
  lastProgram = json;
  send('mm_program', { program: json });
}

function sendState(): void {
  stateTimer = 0;
  // Les ecritures du site sont retardees (300 a 400 ms) : on les force avant de lire
  try {
    pattern.flush();
    window.localStorage.setItem(VOY_STORAGE_KEY, JSON.stringify({ v: 1, knobs: voyParams.get() }));
  } catch {
    /* rien */
  }
  saveProg();
  send('mm_state', { ls: JSON.stringify({ v: 1, ls: snapshotLs() }) });
}

function stateChanged(): void {
  if (stateTimer) window.clearTimeout(stateTimer);
  stateTimer = window.setTimeout(sendState, 900);
}

function changed(): void {
  if (!progTimer) progTimer = window.setTimeout(sendProgram, 50);
  stateChanged();
}

export const arpBridge = {
  /** Le plugin est-il la (window.__JUCE__) ? */
  present: (): boolean => backend() !== null,
  start(): void {
    if (started) return;
    started = true;
    // Le son vient du plugin : le navigateur se tait, son arpegiateur ne programme rien (voyager/arp.ts arpExternal)
    FLAGS.mute = true;
    arpExternal.set({ run: (on) => send('mm_run', { on }) });
    loadProg();
    lastProg = JSON.stringify(arp.get().prog);
    backend()?.addEventListener('mm_transport', onTransport);
    voyParams.subscribe(changed);
    seq.subscribe(changed);
    // La progression (running aussi passe par la : le programme identique ne repart pas)
    arp.subscribe(() => {
      const k = JSON.stringify(arp.get().prog);
      if (k === lastProg) return;
      lastProg = k;
      changed();
    });
    // Le tempo et le swing (le reste du motif du MM-RYTM ne change rien : le programme identique ne repart pas)
    pattern.subscribe(changed);
    pattern.fx.subscribe(changed);
    presets.subscribe(stateChanged);
    send('mm_ready', {});
    sendProgram();
    sendState();
  },
  /** Le transport du C++ est-il l'horloge interne (Ableton arrete) ? */
  internal: (): boolean => internal,
  log(where: string, msg: string): void {
    send('mm_log', { where, msg });
  },
  /** Pour les essais (Chromium) : le programme tel qu'il partirait. */
  compile,
};
