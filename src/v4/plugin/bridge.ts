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
 *                 mm_xf {x}, mm_ptn {next, chain}, mm_import {family, track}, mm_log {where, msg}
 *   C++ -> face : mm_transport {playing, internal, step, seq, mask, xf, pat, patSeq}, mm_user {list}, mm_imported {track, key}
 */

import { clock, type ExternalTransport } from '../audio/clock';
import { liveHook, mix, resolveHit, type HitParams } from '../audio/drums';
import { morph } from '../audio/morph';
import type { StepLock } from '../audio/locks';
import type { VoiceFx } from '../audio/voicefx';
import { lockOf, type Locks } from '../audio/locks';
import { type TrigSet } from '../audio/trig';
import { NO_SCENES, type SceneSet } from '../rytm/sceneData';
import { type Inst } from '../theme';
import { CONDS, trigNow } from '../audio/trig';
import { activeLfos, LFO_DESTS, LFO_MODES, LFO_WAVES } from '../audio/lfo';
import { cutHz, filterIndex, resoQ } from '../audio/voicelaw';
import { liveNeeds } from '../audio/seqhit';
import { pattern, VEL_GAIN, velocity, type Steps } from '../audio/pattern';
import { tracks, TRACK_KEYS, TRACK_NAMES, typedFamily, type TrackKey } from '../audio/tracks';
import { KIT_FAMILIES } from '../audio/kitlaw';
import { setPluginSamples } from '../audio/samples';
import { fileImport } from '../actions/browser';
import { lcdMessage } from '../state/lcdMessage';
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
  /**
   * FLTR (audio/drums.ts hitFilter) : ft 0 aucun, 1 passe-bas, 2 passe-haut, 3 passe-bande ; fhz la coupure, fq la
   * resonance (lineaire) ; l'enveloppe : la coupure monte de foct octaves en fatk s, puis redescend (constante ftau s)
   */
  ft?: number;
  fhz?: number;
  fq?: number;
  foct?: number;
  fatk?: number;
  ftau?: number;
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
  /** la tranche de la piste a partir de ce coup (TONE, DIST, CHORUS, envois DELAY et REVERB : la voix, ses verrous) */
  sl?: number[];
  /**
   * Les LFO du coup (audio/lfo.ts activeLfos : la voix et les verrous du pas), chacun [n, spd, mult, fade, dest, wave,
   * phase, mode, depth] aux rangs du site ; lfot : LFO.T (le trig relance les LFO) ; lb : les bases des lois [LEVEL, RESO,
   * DECAY] (audio/drums.ts lfoLaw, seqhit.ts lfoHitLock)
   */
  lfo?: number[][];
  lfot?: number;
  lb?: number[];
  /** le panoramique meme au centre (un LFO PAN, un lock trig PAN de la voix : le gain porte le x racine de 2) */
  fp?: number;
  /** un lock trig : ce qu'il verrouille (1 VOL, 2 PAN, 4 RESO, 8 FREQ) ; lc : sa coupure (Hz) */
  lk?: number;
  lc?: number;
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
  /** la voie du kick (sans CHORUS ni envois globaux, audio/drums.ts kickBus) */
  kick: boolean;
  /** la tranche de la voix : TONE, DIST, CHORUS, DELAY, REVERB */
  sl: number[];
  /** le coup du pad (sans verrou) : ce que joue un coup en direct */
  live: ProgHit;
  hits: ProgHit[];
  /** la longueur de la piste (TLEN, 2026-11-08) : 0 = celle du pattern ; sinon 1 a len pas, qu'elle boucle sans repartir */
  tlen?: number;
}

export interface Program {
  v: 1;
  /** l'emplacement du pattern (0 a 127, A01 a H16) */
  slot: number;
  bpm: number;
  /** nombre de pas du pattern (1 a 64) ; loop : -1 toutes les pages, 0 a 3 la page bouclee */
  len: number;
  loop: number;
  /** le retard des pas impairs, en part de pas (SWING x 1/3) */
  swing: number;
  sounds: ProgSound[];
  tracks: ProgTrack[];
  /** les effets globaux (pattern.fx et ses scenes, morph.fx) : DIST, CHORUS, DELAY, REVERB, BIT, COMP et leurs reglages */
  fx: Record<string, number>;
  /**
   * Les scenes (2026-11-08, le crossfader dans le C++) : le programme aux XK + 1 positions du crossfader (x = k / XK), ses
   * valeurs seules (effets globaux, tranches, coups ; les memes coups dans le meme ordre) ; absent sans scene. Le C++
   * interpole entre les deux positions voisines du x de l'hote (le parametre XFADE), fenetre fermee comprise.
   */
  xk?: ProgX[];
  /** les autres patterns remplis (2026-11-08) : leurs coups et leur mute ; le kit, les sons et les effets sont ceux d'ici */
  pats?: ProgPat[];
}

/** Un autre pattern : son emplacement, sa longueur, ses coups et son mute par piste, ses scenes. */
export interface ProgPat {
  slot: number;
  len: number;
  loop: number;
  tracks: Pick<ProgTrack, 'plays' | 'hits' | 'tlen'>[];
  xk?: ProgX[];
}

/** Un programme a une position du crossfader : ce que les scenes changent. */
export interface ProgX {
  fx: Record<string, number>;
  tracks: Pick<ProgTrack, 'slice' | 'sl' | 'live' | 'hits'>[];
}

/** Les positions du crossfader compilees : 0, 1/8 ... 1 (le C++ interpole entre deux voisines). */
const XK = 8;

/** La tranche d'une voix pour un coup : ses reglages, ses verrous de pas (audio/drums.ts postSends, postInserts). */
const sliceOf = (fx: Readonly<VoiceFx>, lock: Readonly<StepLock> | null): number[] => [
  r6(lock?.tone ?? fx.tone),
  r6(lock?.dist ?? fx.dist),
  r6(lock?.chorus ?? fx.chorus),
  r6(lock?.delay ?? fx.delay),
  r6(lock?.reverb ?? fx.reverb),
];

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Le genre d'une COND pour le C++ (dsp/Engine.cpp condTrue). */
const COND_KIND: Readonly<Record<string, number>> = { none: 0, fill: 1, pre: 2, nei: 3, first: 4, last: 5, ab: 6 };

/** Le filtre d'un coup pour le C++ (absent : aucun filtre, le son d'avant). */
function filterOf(hp: HitParams): Partial<ProgHit> {
  const f = hp.filter;
  if (!f) return {};
  const ft = f.type === 'lowpass' ? 1 : f.type === 'highpass' ? 2 : f.type === 'bandpass' ? 3 : 0;
  if (!ft) return {};
  return { ft, fhz: r6(f.hz), fq: r6(f.q), foct: r6(f.oct), fatk: r6(f.atk), ftau: r6(f.tau) };
}

/** La table des sons d'un programme : partagee par ses positions du crossfader (les indices restent les memes). */
interface SoundTable {
  sounds: ProgSound[];
  index: Map<string, number>;
}

/** Un pattern a compiler : ses pas (par page), sa longueur, ses verrous, ses reglages de trig, son mute, ses scenes. */
interface PatSrc {
  slot: number;
  len: number;
  loop: number;
  pages: Steps[];
  locks: Readonly<Locks> | null;
  trigs: Readonly<TrigSet> | null;
  pmutes: readonly Inst[];
  scenes: SceneSet;
}

/** Le pattern courant : celui que la face edite (ses pages, sa longueur, sa page bouclee). */
function curSrc(): PatSrc {
  const cur = pattern.get();
  return {
    slot: patterns.get().cur,
    len: pattern.stepCount(),
    loop: pattern.loopPage(),
    pages: [0, 1, 2, 3].map((p) => pattern.stepsOfPage(p)),
    locks: cur.locks,
    trigs: cur.trigs,
    pmutes: cur.pmutes,
    scenes: pattern.scenes.get(),
  };
}

/** Un autre emplacement, tel qu'il sera pose (state/patterns.ts apply) : ses 16 pas, ses verrous, ses trigs, ses scenes. */
function slotSrc(i: number): PatSrc {
  const st = patterns.get();
  const empty = patterns.stepsOf(-1);
  return {
    slot: i,
    len: 16,
    loop: -1,
    pages: [patterns.stepsOf(i), empty, empty, empty],
    locks: patterns.locksOf(i),
    trigs: st.trigs[i] ?? null,
    pmutes: st.pmutes[i] ?? [],
    scenes: st.scenes[i] ?? NO_SCENES,
  };
}

/**
 * Le programme : le pattern courant, et (2026-11-08) chaque autre emplacement rempli dans pats, avec la meme table de sons :
 * le C++ change de pattern a la fin du pattern (la face, un program change d'Ableton), fenetre fermee comprise.
 */
function compile(): Program {
  const tab: SoundTable = { sounds: [], index: new Map() };
  const p = compilePat(curSrc(), tab);
  const pats: ProgPat[] = [];
  const st = patterns.get();
  for (let i = 0; i < st.slots.length; i += 1) {
    if (i === st.cur || !patterns.filled(i)) continue;
    const q = compilePat(slotSrc(i), tab);
    pats.push({ slot: i, len: q.len, loop: q.loop, tracks: q.tracks.map((t) => ({ plays: t.plays, hits: t.hits, ...(t.tlen ? { tlen: t.tlen } : {}) })), ...(q.xk ? { xk: q.xk } : {}) });
  }
  p.sounds = tab.sounds;
  if (pats.length > 0) p.pats = pats;
  return p;
}

/**
 * Un pattern, et sans scene rien de plus ; avec des scenes, aussi ses valeurs aux XK + 1 positions du crossfader
 * (morph.withScenes, morph.withX : le meme calcul que le son du site, a ce x).
 */
function compilePat(src: PatSrc, tab: SoundTable): Program {
  return morph.withScenes(src.scenes, () => {
    if (!morph.active()) return compileWith(src, tab);
    const at: Program[] = [];
    for (let k = 0; k <= XK; k += 1) at.push(morph.withX(k / XK, () => compileWith(src, tab)));
    const p = at[0];
    p.xk = at.map((q) => ({ fx: q.fx, tracks: q.tracks.map((t) => ({ slice: t.slice, sl: t.sl, live: t.live, hits: t.hits })) }));
    return p;
  });
}

function compileWith(src: PatSrc, tab: SoundTable): Program {
  const len = src.len;
  const loop = src.loop;
  const scenes = src.scenes;
  const { sounds, index } = tab;
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
      ...filterOf(hp),
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
  const pages = src.pages;
  const out: ProgTrack[] = [];
  for (const t of TRACK_KEYS) {
    const vo = tracks.voiceOf(t);
    const base = resolveHit(t, null, scenes);
    // Ce que les lock trigs de la voix demandent en direct a ses coups (VOL, PAN, le filtre) ; null : aucun lock trig
    const needs = liveNeeds(src.locks, t);
    const tlen = Math.round(src.trigs?.[t]?.tlen ?? 0);
    const hits: ProgHit[] = [];
    for (let g = 0; g < len; g += 1) {
      const s = g % 16;
      const v = velocity(pages[Math.floor(g / 16)], t, s);
      const lock = lockOf(src.locks, t, s);
      // Un lock trig (V.5.1) : un pas sans velocite dont le verrou ltrg vaut 1
      const lt = v <= 0 && lock?.ltrg === 1;
      if (v <= 0 && !lt) continue;
      const r = lock ? resolveHit(t, lock, scenes) : base;
      const h = hitOf(t, g, lt ? 0 : VEL_GAIN[Math.min(VEL_GAIN.length - 1, v)], r.hp);
      if (lock) h.sl = sliceOf(r.fx, r.lock);
      const tn = trigNow(src.trigs, t, lock);
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
      // Les LFO (V.5.1) : ceux de la voix, les verrous du pas les changent ; LFO.T relance leur ancre
      const fxv = r.fx;
      const lk = r.lock;
      const lfos = activeLfos(fxv, lock);
      h.lfot = tn.lfot ? 1 : 0;
      if (lfos.length > 0) h.lfo = lfos.map((l) => [l.n, l.spd, l.mult, l.fade, LFO_DESTS.indexOf(l.dest), LFO_WAVES.indexOf(l.wave), l.phase, LFO_MODES.indexOf(l.mode), l.depth]);
      // Les bases des lois des LFO et des lock trigs : LEVEL, RESO, DECAY du coup (audio/drums.ts lfoLaw, lockTrigOn)
      if (lfos.length > 0 || needs) h.lb = [r6(lk?.level ?? fxv.level), r6(lk?.freso ?? fxv.freso), r6(lk?.decay ?? fxv.decay)];
      // Un lock trig : ce qu'il verrouille de ce que le coup qui sonne change en direct (1 VOL, 2 PAN, 4 RESO, 8 FREQ)
      if (lt && lk) {
        h.lk = (lk.level !== undefined ? 1 : 0) | (lk.pan !== undefined ? 2 : 0) | (lk.freso !== undefined ? 4 : 0) | (lk.fcut !== undefined ? 8 : 0);
        if (lk.fcut !== undefined) h.lc = r6(cutHz(lk.fcut));
      }
      // Le panoramique et le filtre en direct (audio/drums.ts seqExtra) : un LFO PAN ou un lock trig PAN de la voix, un coup
      // au centre passe quand meme par le panoramique (x racine de 2) ; un LFO FREQ ou RESO, un lock trig FREQ ou RESO, un
      // coup sans filtre en recoit un, ouvert, sans enveloppe
      const needPan = !!needs?.pan || lfos.some((l) => l.dest === 'PAN');
      if (needPan && r.hp.pan === 0) {
        h.fp = 1;
        h.gain = r6(h.gain * Math.SQRT2);
      }
      const needFilter = !!needs?.filter || lfos.some((l) => l.dest === 'FREQ' || l.dest === 'RESO');
      if (needFilter && !h.ft) {
        h.ft = filterIndex(lk?.ftype ?? fxv.ftype) + 1;
        h.fhz = r6(cutHz(lk?.fcut ?? fxv.fcut));
        h.fq = r6(resoQ(lk?.freso ?? fxv.freso));
        h.foct = 0;
        h.fatk = 0;
        h.ftau = 0.1;
      }
      hits.push(h);
    }
    out.push({
      key: t,
      slice: r6(base.slice),
      plays: voices.plays(t, src.pmutes),
      mono: vo.vmode === 'mono',
      choke: vo.choke,
      gated: vo.gated,
      kick: tracks.family(t) === 'bd',
      sl: sliceOf(base.fx, null),
      live: hitOf(t, -1, 1, base.hp),
      hits,
      // TLEN : la longueur de la piste, au plus celle du pattern (ses pas sont ceux du pattern)
      ...(tlen > 0 && tlen < len ? { tlen } : {}),
    });
  }
  const gfx: Record<string, number> = {};
  for (const [k, v] of Object.entries(morph.fx())) if (typeof v === 'number') gfx[k] = r6(v);
  gfx.tone = r6(mix.tone);
  gfx.level = r6(mix.level);
  return { v: 1, slot: src.slot, bpm: pattern.get().bpm, len, loop, swing: r6(pattern.fx.get().swing * SWING.maxDelay), sounds, tracks: out, fx: gfx };
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
  /** le crossfader du plugin (le parametre XFADE d'Ableton) ; -1 : absent */
  xf: number;
  /** le pattern que le moteur joue (0 a 127) ; patSeq : +1 a chaque changement fait par le moteur (fin de pattern, program change) */
  pat: number;
  patSeq: number;
}

let transport: Transport = { playing: false, internal: false, step: -1, seq: -1, mask: 0, xf: -1, pat: -1, patSeq: -1 };
/** le dernier changement de pattern du moteur que la face a suivi (-2 : aucun message encore) */
let patSeqSeen = -2;
/** x pose par l'hote (la face ne le renvoie pas) ; l'heure du dernier x envoye par la face (l'hote ne le reprend pas aussitot) */
let xfFromHost = false;
let xfSentAt = -1e9;

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
    xf: typeof x.xf === 'number' ? x.xf : -1,
    pat: typeof x.pat === 'number' ? x.pat : -1,
    patSeq: typeof x.patSeq === 'number' ? x.patSeq : -1,
  };
  if (was !== transport.playing) clock.externalChanged();
  extHead.wake();
  // Le pattern que le moteur joue (2026-11-08) : il change a la fin du pattern (le suivant choisi, la chaine) ou sur un
  // program change d'Ableton ; la face le suit (ses pas, ses verrous, ses scenes), a l'ouverture de la fenetre aussi
  if (transport.pat >= 0 && transport.patSeq !== patSeqSeen) {
    const first = patSeqSeen === -2;
    patSeqSeen = transport.patSeq;
    if (!first || transport.pat !== patterns.get().cur) patterns.follow(transport.pat);
  }
  // Le crossfader mene par Ableton (son automation, un controleur MIDI mappe) : celui de la face le suit ; jamais pendant un
  // geste de la face, ni juste apres (l'hote renvoie encore l'ancienne valeur)
  if (transport.xf >= 0 && !sceneCtl.moving() && performance.now() - xfSentAt > 400 && Math.abs(transport.xf - sceneCtl.x()) > 1e-4) {
    xfFromHost = true;
    try {
      sceneCtl.setX(transport.xf, 'hw');
    } finally {
      xfFromHost = false;
    }
  }
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

/** Le pattern suivant et la chaine (PTN puis TRIG en lecture, des tapes dans les 2 s) : le moteur les joue a la fin du pattern. */
let lastPtn = '';
function sendPtn(): void {
  const st = patterns.get();
  const o = { next: st.next, chain: st.chain };
  const j = JSON.stringify(o);
  if (j === lastPtn) return;
  lastPtn = j;
  send('mm_ptn', o);
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
        ...filterOf(r.hp),
        sl: sliceOf(r.fx, r.lock),
      });
    });
    pattern.subscribe(changed);
    pattern.fx.subscribe(changed);
    pattern.scenes.subscribe(() => changed());
    tracks.subscribe(() => changed());
    voices.subscribe(changed);
    // Les patterns : le suivant et la chaine vont au moteur (il change a la fin du pattern) ; le programme les porte tous
    patterns.subscribe(() => {
      sendPtn();
      changed();
    });
    // Le crossfader (les scenes A et B) : le programme porte toutes ses positions, le C++ joue celle du parametre XFADE ;
    // la face lui envoie la sienne (Ableton l'enregistre en automation)
    sceneCtl.onX((v) => {
      if (xfFromHost) return;
      xfSentAt = performance.now();
      send('mm_xf', { x: v });
    });
    sceneCtl.subscribe(changed);
    // TONE et LEVEL du mix, STRETCH
    mix.subscribe(changed);
    // FILL (tenir PAGE ou YES) : les trigs a condition FILL jouent tant qu'il est tenu
    fill.subscribe(() => send('mm_fill', { on: fill.on }));
    // Les samples perso (2026-11-08) : le dossier ~/Music/MM-RYTM Samples du Mac, que le plugin lit ; + LOAD A FILE... de
    // SOUNDS ouvre son choix de fichiers (copies dans le dossier du type de la piste), le premier devient le sample de la piste
    fileImport.plugin = (t) => {
      const i = TRACK_KEYS.indexOf(t);
      if (i < 0) return;
      lcdMessage.show(`${TRACK_NAMES[i]} : CHOOSE FILES ON THE MAC`, 2400);
      send('mm_import', { family: KIT_FAMILIES.indexOf(typedFamily(i)), track: i });
    };
    // Le dossier dans le Finder (une famille : son sous-dossier) et sa relecture (2026-11-09 : SAMPLES, OPEN)
    fileImport.reveal = (family) => send('mm_reveal', { family: family ?? '' });
    fileImport.rescan = () => send('mm_rescan', {});
    backend()?.addEventListener('mm_user', (o: unknown) => setPluginSamples((o as { list?: unknown } | null)?.list));
    backend()?.addEventListener('mm_imported', (o: unknown) => {
      const x = o as { track?: unknown; key?: unknown } | null;
      const i = typeof x?.track === 'number' ? x.track : -1;
      const key = typeof x?.key === 'string' ? x.key : '';
      if (i < 0 || i >= TRACK_KEYS.length || !key) return;
      tracks.sample(TRACK_KEYS[i], key);
      lcdMessage.show(`${TRACK_NAMES[i]} SAMPLE ${key.split('/~').pop()?.replace(/\.[a-z0-9]+$/i, '').toUpperCase() ?? ''}`, 2400);
    });
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
