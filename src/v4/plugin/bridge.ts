/**
 * Le pont de la face et du plugin (2026-11-08, plugin/mm-rytm, Mika : "lance la WebView avec ma vraie face").
 *
 * Le plugin joue le son (C++) et doit jouer fenetre fermee et pendant un export d'Ableton : la face n'est que la face.
 * Elle compile donc ce qu'il faut jouer en un PROGRAMME (les sons de chaque piste, chaque coup de chaque pas avec sa
 * hauteur, son DECAY, son gain, son PAN, son START), calcule par les fonctions du site lui-meme (audio/drums.ts
 * resolveHit, tracks.tweakWith) : le C++ n'interprete rien, il joue. Le programme part a chaque changement (50 ms de
 * repos), et avec lui l'etat complet de la machine (les cles mm.v4.* du localStorage, la persistance du site), que le
 * plugin garde dans le projet.
 *
 * Dans l'autre sens : la position du transport (la tete de lecture, plugin/head.ts) et RUN / STOP (audio/clock.ts
 * external). Le son du navigateur est coupe (FLAGS.mute) ; un coup joue en direct (un pad, une touche) part vers le C++.
 *
 * Protocole (window.__JUCE__.backend, sans la bibliotheque JS de JUCE) :
 *   face -> C++ : mm_ready {}, mm_program {program}, mm_state {ls}, mm_hit {t, vel, hit}, mm_run {on}, mm_fill {on},
 *                 mm_log {where, msg}
 *   C++ -> face : mm_transport {playing, internal, step, seq, mask, bpm}
 */

import { clock, type ExternalTransport } from '../audio/clock';
import { liveHook, resolveHit, type HitParams } from '../audio/drums';
import { lockOf } from '../audio/locks';
import { CONDS, trigNow } from '../audio/trig';
import { pattern, VEL_GAIN, velocity } from '../audio/pattern';
import { tracks, TRACK_KEYS, type TrackKey } from '../audio/tracks';
import { decayTau, START_MAX } from '../audio/voicelaw';
import type { Stage } from '../scene/renderer';
import { FLAGS } from '../state/flags';
import { fill } from '../state/fill';
import { patterns } from '../state/patterns';
import { sceneCtl } from '../state/sceneCtl';
import { voices } from '../state/voices';
import { SWING } from '../theme';
import { extHead, type HeadEntry } from './head';

/* ---------------- le programme (lu par plugin/mm-rytm/dsp/Program.cpp) ---------------- */

/** Un son a calculer : le moteur, la recette du site (ShotTweak), STRETCH, la hauteur ; variants : 1 ou celles du moteur. */
export interface ProgSound {
  id: string;
  tw: unknown;
  ts: number;
  pf: number;
  variants: boolean;
}

/** Un coup : son pas (0 a 127), sa velocite (gain), son son, son enveloppe, son gain, son PAN, son START. */
export interface ProgHit {
  g: number;
  vel: number;
  snd: number;
  /** DECAY : la constante de temps (s) ; -1 : aucune (le son entier) */
  tau: number;
  atk: number;
  hold: number;
  gain: number;
  pan: number;
  /** START, en part de la duree du son (0 a START_MAX) */
  start: number;
  /**
   * Le trig (V.5.1, audio/trig.ts trigNow, les reglages de la voix et les verrous du pas) : LEN et RLEN en pas (-1 : INF),
   * PROB (0 a 100), COND (ck : 0 NONE, 1 FILL, 2 PRE, 3 NEI, 4 1ST, 5 LST, 6 A:B ; cn : NOT ; ca:cb), uTIME en pas, RTRG,
   * RATE (every, en pas), VFAD ; lt : un lock trig (aucun son, ses verrous vont au coup qui sonne). Absents : le coup du pad.
   */
  len?: number;
  prob?: number;
  ck?: number;
  cn?: number;
  ca?: number;
  cb?: number;
  shift?: number;
  rtrg?: number;
  every?: number;
  vfad?: number;
  rlen?: number;
  lt?: number;
}

export interface ProgTrack {
  key: TrackKey;
  /** le gain de la tranche (LEVEL, TRK LEV) */
  slice: number;
  /** la voix joue (MUTE, SOLO, le mute du pattern) */
  plays: boolean;
  mono: boolean;
  choke: number;
  gated: boolean;
  /** le coup du pad (sans verrou) : ce que joue un coup en direct */
  live: ProgHit;
  hits: ProgHit[];
}

export interface Program {
  v: 1;
  bpm: number;
  /** nombre de pas du pattern (1 a 64) ; loop : -1 toutes les pages, 0 a 3 la page bouclee */
  len: number;
  loop: number;
  /** le retard des pas impairs, en part de pas (SWING x 1/3) */
  swing: number;
  sounds: ProgSound[];
  tracks: ProgTrack[];
}

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Le genre d'une COND pour le C++ (dsp/Engine.cpp condTrue). */
const COND_KIND: Readonly<Record<string, number>> = { none: 0, fill: 1, pre: 2, nei: 3, first: 4, last: 5, ab: 6 };

function compile(): Program {
  const cur = pattern.get();
  const len = pattern.stepCount();
  const loop = pattern.loopPage();
  const scenes = pattern.scenes.get();
  const sounds: ProgSound[] = [];
  const index = new Map<string, number>();
  const soundOf = (t: TrackKey, hp: HitParams): number => {
    const tw = hp.ov ? hp.ov.tw : tracks.tweakWith(t, null);
    const s: ProgSound = { id: hp.id, tw, ts: r6(hp.ts), pf: r6(hp.pf), variants: !hp.ov };
    const key = JSON.stringify(s);
    let i = index.get(key);
    if (i === undefined) {
      i = sounds.length;
      sounds.push(s);
      index.set(key, i);
    }
    return i;
  };
  const hitOf = (t: TrackKey, g: number, vel: number, hp: HitParams): ProgHit => {
    const tau = decayTau(hp.decay);
    return {
      g,
      vel: r6(vel),
      snd: soundOf(t, hp),
      tau: tau === null ? -1 : r6(tau),
      atk: r6(hp.atk),
      hold: r6(hp.hold),
      gain: r6(hp.gain),
      pan: r6(Math.max(-1, Math.min(1, hp.pan))),
      start: r6(hp.start > 0 ? Math.min(hp.start, 1) * START_MAX : 0),
    };
  };
  const pages = [0, 1, 2, 3].map((p) => pattern.stepsOfPage(p));
  const out: ProgTrack[] = [];
  for (const t of TRACK_KEYS) {
    const vo = tracks.voiceOf(t);
    const base = resolveHit(t, null, scenes);
    const hits: ProgHit[] = [];
    for (let g = 0; g < len; g += 1) {
      const s = g % 16;
      const v = velocity(pages[Math.floor(g / 16)], t, s);
      const lock = lockOf(cur.locks, t, s);
      // Un lock trig (V.5.1) : un pas sans velocite dont le verrou ltrg vaut 1
      const lt = v <= 0 && lock?.ltrg === 1;
      if (v <= 0 && !lt) continue;
      const r = lock ? resolveHit(t, lock, scenes) : base;
      const h = hitOf(t, g, lt ? 0 : VEL_GAIN[Math.min(VEL_GAIN.length - 1, v)], r.hp);
      const tn = trigNow(cur.trigs, t, lock);
      const c = CONDS[tn.cond] ?? CONDS[0];
      h.len = tn.len === null ? -1 : tn.len;
      h.prob = tn.prob;
      h.ck = COND_KIND[c.kind];
      h.cn = c.not ? 1 : 0;
      h.ca = c.a;
      h.cb = c.b;
      h.shift = r6(tn.shift);
      h.rtrg = tn.rtrg ? 1 : 0;
      h.every = r6(tn.every);
      h.vfad = tn.vfad;
      h.rlen = tn.rlen === null ? -1 : tn.rlen;
      if (lt) h.lt = 1;
      hits.push(h);
    }
    out.push({
      key: t,
      slice: r6(base.slice),
      plays: voices.plays(t, cur.pmutes),
      mono: vo.vmode === 'mono',
      choke: vo.choke,
      gated: vo.gated,
      live: hitOf(t, -1, 1, base.hp),
      hits,
    });
  }
  return { v: 1, bpm: cur.bpm, len, loop, swing: r6(pattern.fx.get().swing * SWING.maxDelay), sounds, tracks: out };
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

interface Transport {
  playing: boolean;
  internal: boolean;
  step: number;
  seq: number;
  mask: number;
}

let transport: Transport = { playing: false, internal: false, step: -1, seq: -1, mask: 0 };

const external: ExternalTransport = {
  running: () => transport.playing,
  start: () => send('mm_run', { on: true }),
  stop: () => send('mm_run', { on: false }),
};

function onTransport(o: unknown): void {
  if (!o || typeof o !== 'object') return;
  const x = o as Partial<Transport>;
  const was = transport.playing;
  transport = {
    playing: x.playing === true,
    internal: x.internal === true,
    step: typeof x.step === 'number' ? x.step : -1,
    seq: typeof x.seq === 'number' ? x.seq : -1,
    mask: typeof x.mask === 'number' ? x.mask : 0,
  };
  if (was !== transport.playing) clock.externalChanged();
  extHead.wake();
}

const headOf = (): HeadEntry | null => (transport.playing && transport.step >= 0 ? { seq: transport.seq, step: transport.step, mask: transport.mask } : null);

/* ---------------- l'etat (les cles du site) ---------------- */

import { STATE_PREFIX } from './restore';

/** Les cles mm.v4.* du localStorage : toute la persistance du site (motif, pistes, banques, presets...). */
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

function sendProgram(): void {
  progTimer = 0;
  let json: string;
  try {
    json = JSON.stringify(compile());
  } catch (err) {
    bridge.log('compile', String(err));
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
    tracks.flush();
  } catch {
    /* rien */
  }
  send('mm_state', { ls: JSON.stringify({ v: 1, ls: snapshotLs() }) });
}

function changed(): void {
  if (!progTimer) progTimer = window.setTimeout(sendProgram, 50);
  if (stateTimer) window.clearTimeout(stateTimer);
  stateTimer = window.setTimeout(sendState, 900);
}

export const bridge = {
  /** Le plugin est-il la (window.__JUCE__) ? */
  present: (): boolean => backend() !== null,
  start(): void {
    if (started) return;
    started = true;
    // Le son vient du plugin : le navigateur se tait (son horloge ne joue jamais, son transport est celui du C++)
    FLAGS.mute = true;
    clock.external(external);
    extHead.set(headOf);
    backend()?.addEventListener('mm_transport', onTransport);
    // Un coup en direct (pad, touche, apercu) : le C++ le joue, avec ce que le site aurait joue
    liveHook.set((inst, vel, lock) => {
      const r = resolveHit(inst, lock);
      const tr = TRACK_KEYS.indexOf(inst);
      if (tr < 0) return;
      const tau = decayTau(r.hp.decay);
      const tw = r.hp.ov ? r.hp.ov.tw : tracks.tweakWith(inst, null);
      send('mm_hit', {
        t: tr,
        vel,
        slice: r.slice,
        sound: { id: r.hp.id, tw, ts: r6(r.hp.ts), pf: r6(r.hp.pf), variants: !r.hp.ov },
        tau: tau === null ? -1 : tau,
        atk: r.hp.atk,
        hold: r.hp.hold,
        gain: r.hp.gain,
        pan: Math.max(-1, Math.min(1, r.hp.pan)),
        start: r.hp.start > 0 ? Math.min(r.hp.start, 1) * START_MAX : 0,
      });
    });
    pattern.subscribe(changed);
    pattern.fx.subscribe(changed);
    pattern.scenes.subscribe(() => changed());
    tracks.subscribe(() => changed());
    voices.subscribe(changed);
    patterns.subscribe(changed);
    // Le crossfader (les scenes A et B) : le programme suit sa position
    sceneCtl.onX(() => changed());
    sceneCtl.subscribe(changed);
    // FILL (tenir PAGE ou YES) : les trigs a condition FILL jouent tant qu'il est tenu
    fill.subscribe(() => send('mm_fill', { on: fill.on }));
    send('mm_ready', {});
    sendProgram();
    sendState();
  },
  attachStage(stage: Stage | null): void {
    // Plus tard : la cadence de rendu selon la visibilite de la fenetre du plugin
    void stage;
  },
  log(where: string, msg: string): void {
    send('mm_log', { where, msg });
  },
  /** Pour les essais (Chromium) : le programme tel qu'il partirait. */
  compile,
};
