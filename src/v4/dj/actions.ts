/**
 * Les gestes du MM-DECKS (2026-10-04), en actions : ce que font PLAY, CUE,
 * les hot cues, BEND, le jog, les potards et les faders, d'ou qu'ils
 * viennent (la scene, les jumeaux, le clavier). Chaque action ecrit le
 * store (dj/state.ts) ; le moteur (dj/engine.ts) le suit. Le son ne nait
 * qu'au premier geste (actions.ts gesture), jamais avant.
 *
 * Une seule source a la fois : une platine qui part met en pause la piste
 * SoundCloud du site, la boite a rythmes et l'arpege, comme RUN.
 */

import { clock } from '../audio/clock';
import { pattern } from '../audio/pattern';
import { arp } from '../voyager/arp';
import { anyPlaying } from '../state/playLock';
import { routeMachines } from '../audio/drums';
import { sc } from '../audio/soundcloud';
import { startRing } from '../sampler/ring';
import { NUDGE_MAX, djEngine, djEngineIfAny, type DjEngine } from './engine';
import { crateFile, crateLearn, setCrateBusy } from './crate';
import { analysisSignal, phaseShift, trackGridSteps, type TrackGrid } from './math';
import { soundcloudBytes } from './soundcloud';
import { DJ_WAVES, DJ_ZOOMS, djState, type DjTrack } from './state';
import { DJ_CHANNELS, DJ_CH_NAMES, DJ_DECKS, DJ_DECKS_ALL, DJ_FX, deckChannel, djDecks, type DjChannel, type DjDeck, type DjEqId, type DjFxId } from './theme';

/* ---------------- le moteur suit le store ---------------- */

let synced: DjEngine | null = null;

/** Pose tout le store sur le moteur (a sa creation), puis chaque changement. */
function apply(e: DjEngine): void {
  const s = djState.get();
  s.ch.forEach((c, i) => {
    const ch = e.mixer.ch[i];
    ch.setGain(c.gain);
    ch.setBand('hi', c.hi);
    ch.setBand('mid', c.mid);
    ch.setBand('low', c.low);
    ch.setFilter(c.filter);
    ch.setFader(c.fader);
  });
  e.mixer.setMaster(s.master);
  e.mixer.setFxTo(fxTarget(s));
  for (const f of DJ_FX) e.mixer.fx.dose(f, s.fx[f]);
  for (const d of DJ_DECKS_ALL) e.decks[d].setPitch(s.deck[d].pitch * s.deck[d].range);
  e.mixer.fx.tempo({ bpm: heardBpm(s), beats: s.time });
}

/** Le BPM joue d'une platine (au pitch), ou null sans BPM connu. */
const deckBpm = (s: ReturnType<typeof djState.get>, d: DjDeck): number | null => {
  const ds = s.deck[d];
  return ds.track?.bpm ? ds.track.bpm * (1 + (ds.pitch * ds.range) / 100) : null;
};

/** Ce qu'on entend d'une platine qui joue : le fader de sa voie ; 0 a l'arret ou sans BPM. */
function heardWeight(s: ReturnType<typeof djState.get>, d: DjDeck): number {
  const ds = s.deck[d];
  if (!ds.playing || !ds.track?.bpm) return 0;
  return s.ch[deckChannel(d)].fader;
}

/** Le tempo de la platine qu'on entend le plus (crossfader, faders, lecture). */
export function heardBpm(s = djState.get()): number {
  let best: DjDeck = 'a';
  let w = -1;
  for (const d of DJ_DECKS_ALL) {
    const k = heardWeight(s, d);
    if (k > w) {
      w = k;
      best = d;
    }
  }
  return deckBpm(s, best) ?? 120;
}

/** Le moteur (cree au besoin, apres le premier geste), branche sur le store une fois. */
function engine(): DjEngine | null {
  const e = djEngine();
  if (!e || synced === e) return e;
  synced = e;
  apply(e);
  djState.subscribe(() => apply(e));
  for (const d of DJ_DECKS_ALL) {
    e.decks[d].onEnd = () => djState.setDeck(d, { playing: false });
  }
  // Les analyses de la caisse attendent que plus rien ne joue (2026-10-05 : le MM-RYTM, le MM-ARP et les
  // samplers aussi, plus seulement les platines ; decoder et chercher le BPM d'un morceau gelait la page
  // une fraction de seconde, la musique se coupait)
  setCrateBusy(() => DJ_DECKS_ALL.some((d) => e.decks[d].playing) || anyPlaying());
  /*
   * Les machines du site entrent sur la table (2026-10-04, Mika : "1 et 2
   * doivent etre RYTM et ARP") : effets compris ; on mixe donc les platines
   * avec elles, elles ne se taisent plus l'une l'autre. Seule la piste
   * SoundCloud du site, qui ne passe pas par la table, reste une source a
   * part. Trois machines depuis le 2026-10-07, dans l'ordre de la table :
   * 1 MM-RYTM, 2 MM-BASS, 3 MM-ARP.
   */
  routeMachines({ rytm: e.mixer.ch[0].input, bass: e.mixer.ch[1].input, arp: e.mixer.ch[2].input });
  // La memoire du MIXER (2026-10-07) : REC MIX d'une platine y prend les temps qui viennent de passer
  void startRing();
  watchMachines();
  // Le verrou de phase de SYNC (2026-10-08) : quatre mesures par seconde, un rattrapage invisible au besoin
  window.setInterval(() => phaseLock(e), LOCK.everyMs);
  // Seulement quand la piste du site PART (2026-10-08) : le pont emet aussi pendant qu'elle joue (la progression)
  let scWas = sc.get().status;
  sc.subscribe(() => {
    const now = sc.get().status;
    if (now === 'playing' && scWas !== 'playing') djPauseAll();
    scWas = now;
  });
  return e;
}

/**
 * La table en vue (2026-10-04, Mika : "quand on joue sur les machines MM et
 * qu'on arrive sur le mixer, on ne voit pas les pistes jouer sur 1 et 2") :
 * le moteur se cree des que le son existe, sans attendre un geste sur la
 * table ; les machines passent alors par les voies 1 a 3 et
 * leurs VU les montrent. null avant le premier geste du site.
 */
export function djWake(): DjEngine | null {
  return engine();
}

/** Une platine part : la piste SoundCloud du site se tait (elle ne passe pas par la table). */
function silenceOthers(): void {
  sc.pauseForRun();
}

/** Une autre source part (RUN, une piste SoundCloud) : les platines se taisent. */
export function djPauseAll(): void {
  const e = djEngineIfAny();
  if (!e) return;
  for (const d of DJ_DECKS_ALL) {
    if (!e.decks[d].playing) continue;
    e.decks[d].pause();
    djState.setDeck(d, { playing: false });
  }
}

/* ---------------- charger ---------------- */

const loads: Partial<Record<DjDeck, AbortController>> = {};
const CUES_KEY = (id: string): string => `mm.v4.dj.cues.${id}`;

function savedCues(id: string): { cue: number; cues: (number | null)[] } {
  try {
    const raw = window.localStorage.getItem(CUES_KEY(id));
    if (raw) {
      const o = JSON.parse(raw) as { cue?: number; cues?: (number | null)[] };
      const cues = [0, 1, 2, 3].map((i) => (typeof o.cues?.[i] === 'number' ? (o.cues[i] as number) : null));
      return { cue: typeof o.cue === 'number' ? o.cue : 0, cues };
    }
  } catch {
    /* rien de retenu */
  }
  return { cue: 0, cues: [null, null, null, null] };
}

function saveCues(d: DjDeck): void {
  const ds = djState.get().deck[d];
  if (!ds.track) return;
  try {
    window.localStorage.setItem(CUES_KEY(ds.track.id), JSON.stringify({ cue: ds.cue, cues: ds.cues }));
  } catch {
    /* stockage plein : les cues vivent pour la visite */
  }
}

/**
 * Pose un morceau sur une platine : lit (fichier de la caisse) ou ouvre le
 * flux (SoundCloud), decode, BPM si absent. Audius est parti le 2026-10-04
 * (Mika : "cache Audius, serieux c'est nul").
 *
 * Le chargement d'un vrai morceau prend quelques secondes (2026-10-08, Mika :
 * "quand on lance une track sur le deck de gauche puis celui de droite, le
 * droit demarre pas quand on clic sur play") : un MP3 de 7 min, 2 a 5 s ; un
 * WAV 24 bits, jusqu'a 10 s la premiere fois. Avant, un PLAY presse pendant ce
 * temps ne faisait rien, sans le dire ; et si la platine tenait deja un
 * morceau, il relancait l'ancien, que le decodage coupait ensuite en laissant
 * la platine allumee, muette. Maintenant :
 * - l'ancien morceau s'arrete tout de suite (il ne peut plus repartir) ;
 * - l'ecran dit l'etape (READING, DECODING, ANALYSING) ;
 * - PLAY (et SYNC) presses pendant ce temps s'arment : PLAY s'allume en orange,
 *   la platine part toute seule des qu'elle est prete ; un second appui desarme ;
 * - un cue retenu a la fin du morceau n'y gare plus la platine.
 */
export async function djLoad(d: DjDeck, track: DjTrack): Promise<void> {
  const e = engine();
  if (!e) return;
  loads[d]?.abort();
  const ctl = new AbortController();
  loads[d] = ctl;
  // L'ancien morceau s'ejecte : ni PLAY, ni CUE, ni un hot cue ne peuvent le relancer pendant le chargement
  e.decks[d].unload();
  previewing[d] = false;
  syncArmed.delete(d);
  lastDeck = d;
  djState.setDeck(d, { playing: false, loaded: false, track, loading: 0, loadStep: 'read', armed: false, error: null, beat: null, sync: false, loop: null });
  try {
    let bytes: ArrayBuffer;
    if (track.source === 'file') {
      // Un fichier de la caisse : copie, en memoire, ou relie (l'acces au dossier se redemande pendant ce clic)
      const blob = track.file ?? (await crateFile(track.id));
      if (!blob) throw new Error(track.relink ? 'drop the folder again' : 'folder access needed');
      bytes = await blob.arrayBuffer();
    } else {
      // SoundCloud : le Worker de Sonaa ouvre le flux ; le son passe sans etre garde
      bytes = await soundcloudBytes(track.id, (p) => djState.setDeck(d, { loading: p }), ctl.signal);
    }
    if (ctl.signal.aborted) return;
    djState.setDeck(d, { loadStep: 'decode' });
    await e.decks[d].load(bytes);
    if (ctl.signal.aborted) return;
    djState.setDeck(d, { loadStep: 'analyse' });
    const p = e.decks[d];
    const ch0 = p.channel0;
    /*
     * L'analyse du morceau entier (2026-10-08, Mika : "je pense qu'il faut
     * analyser la track pour que ca fonctionne") : le tempo au millieme et
     * le premier temps a la milliseconde (dj/math.ts trackGridSteps). Le BPM
     * de SoundCloud ou des tags ne fait que guider : faux, le son l'emporte.
     * Par tranches de quelques millisecondes : l'ecran et l'autre platine
     * ne figent pas.
     */
    const grid = ch0 ? await analyse(ch0, p.sampleRate, track.bpm, ctl.signal) : null;
    if (ctl.signal.aborted) return;
    const bpm = grid?.bpm ?? track.bpm;
    const saved = savedCues(track.id);
    // Un cue pose a la toute fin (CUE presse apres la fin du morceau) : la platine repart du debut
    const atEnd = saved.cue >= p.duration - END_S;
    const cue = atEnd ? 0 : saved.cue;
    const armed = djState.get().deck[d].armed;
    djState.setDeck(d, { loaded: true, loading: null, loadStep: null, armed: false, track: { ...track, bpm, duration: p.duration }, cue, cues: saved.cues, beat: grid?.offset ?? null, sync: false });
    if (atEnd) saveCues(d);
    // La caisse apprend la duree et le BPM : le morceau n'a plus a etre analyse en fond
    if (track.source === 'file') void crateLearn(track.id, p.duration, bpm);
    p.seek(cue);
    // SYNC puis PLAY armes pendant le chargement : SYNC d'abord, PLAY part alors sur un temps de la reference
    if (syncArmed.delete(d)) djSync(d);
    if (armed && !p.playing) djPlay(d);
  } catch (err) {
    if (ctl.signal.aborted) return;
    syncArmed.delete(d);
    djState.setDeck(d, { loading: null, loadStep: null, armed: false, loaded: false, error: err instanceof Error ? err.message : 'load failed' });
  }
}

/**
 * L'analyse d'un morceau (dj/math.ts trackGridSteps) dans un worker
 * (dj/grid.worker.ts) : sur le signal reduit a 11 kHz environ
 * (analysisSignal), transfere sans copie ; la scene et l'autre platine ne
 * sautent aucune image. Sans worker (ou s'il plante) : sur le fil principal,
 * par tranches de ANALYSE_SLICE_MS. null si un autre morceau arrive
 * entre-temps.
 */
const ANALYSE_SLICE_MS = 12;
let gridWorker: Worker | null | undefined;
let gridJob = 0;
/** les analyses en cours dans le worker : leur reponse (undefined : le worker a plante) */
const gridWaiting = new Map<number, (g: TrackGrid | null | undefined) => void>();
/** La duree de la derniere analyse (ms, le calcul seul ; le debug, les tests). */
let lastAnalyseMs = 0;
export const djAnalyseMs = (): number => lastAnalyseMs;

function getGridWorker(): Worker | null {
  if (gridWorker !== undefined) return gridWorker;
  try {
    const w = new Worker(new URL('./grid.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (m: MessageEvent<{ id: number; grid: TrackGrid | null; ms: number }>) => {
      lastAnalyseMs = m.data.ms;
      gridWaiting.get(m.data.id)?.(m.data.grid);
      gridWaiting.delete(m.data.id);
    };
    w.onerror = () => {
      w.terminate();
      gridWorker = null;
      for (const done of gridWaiting.values()) done(undefined);
      gridWaiting.clear();
    };
    gridWorker = w;
  } catch {
    gridWorker = null;
  }
  return gridWorker;
}

async function analyse(signal: Float32Array, rate: number, hint: number | null, abort: AbortSignal): Promise<TrackGrid | null> {
  const s = analysisSignal(signal, rate);
  const w = getGridWorker();
  if (w) {
    const id = ++gridJob;
    const grid = await new Promise<TrackGrid | null | undefined>((done) => {
      gridWaiting.set(id, done);
      w.postMessage({ id, x: s.x, rate: s.rate, hint }, [s.x.buffer]);
    });
    if (abort.aborted) return null;
    if (grid !== undefined) return grid;
    // Le worker a plante : le signal est parti avec lui, on le refait sur le fil principal
    return analyse(signal, rate, hint, abort);
  }
  const t0 = performance.now();
  const it = trackGridSteps(s.x, s.rate, hint);
  let r = it.next();
  while (!r.done) {
    await new Promise<void>((done) => window.setTimeout(done, 0));
    if (abort.aborted) return null;
    const t1 = performance.now();
    while (!r.done && performance.now() - t1 < ANALYSE_SLICE_MS) r = it.next();
  }
  lastAnalyseMs = performance.now() - t0;
  return r.value;
}

/** Une platine a moins de 50 ms de la fin ne repart pas (DjPlayer.play) : on la ramene au cue, ou au debut. */
const END_S = 0.05;
/** SYNC presse pendant le chargement : il se fait des que la platine est prete. */
const syncArmed = new Set<DjDeck>();
/** La derniere platine touchee (pointeur, doigt, clavier, MIDI, chargement) : Espace la lance. */
let lastDeck: DjDeck = 'a';
export const djLastDeck = (): DjDeck => lastDeck;
export function djTouchDeck(d: DjDeck): void {
  lastDeck = d;
}

/* ---------------- transport ---------------- */

export function djPlay(d: DjDeck): void {
  const e = engine();
  if (!e) return;
  const p = e.decks[d];
  const ds = djState.get().deck[d];
  // En chargement : PLAY s'arme (ou se desarme), la platine partira des qu'elle est prete (djLoad)
  if (ds.loading !== null) {
    djState.setDeck(d, { armed: !ds.armed });
    return;
  }
  if (!p.loaded || !ds.loaded) return;
  if (p.playing) {
    p.pause();
    djState.setDeck(d, { playing: false });
    return;
  }
  const t0 = performance.now();
  // Au bout du morceau, PLAY repart du cue (ou du debut) au lieu de ne rien faire
  if (p.position() >= p.duration - END_S) p.seek(ds.cue < p.duration - END_S ? ds.cue : 0);
  silenceOthers();
  // Les machines jouent (2026-10-07) : la platine prend leur tempo et cale ses temps sur les leurs
  freed.delete(d);
  follow(d);
  startSynced(d, e, t0);
}

/**
 * Le depart d'une platine en pause, tout de suite (2026-10-08, Mika :
 * "quand j'utilise SYNC, quand j'appuie sur play ca met une demi seconde
 * avant de se lancer ! faut corriger ca c'est insoutenable"). Avant, SYNC
 * attendait le prochain temps de la reference pour partir : jusqu'a un
 * temps entier (0.48 s a 124 BPM). Comme une CDJ ou Rekordbox : PLAY part
 * maintenant, et c'est la tete qui se deplace d'au plus un demi-temps
 * (inPhase) pour que les temps tombent sur ceux de la reference.
 */
function startSynced(d: DjDeck, e: DjEngine, t0: number): void {
  const p = e.decks[d];
  const ds = djState.get().deck[d];
  const from = p.position();
  // Un seul instant pour le calcul et le depart (deckBeat)
  const when = startTime(e, d);
  if (ds.sync) {
    const to = inPhase(d, e, from, when);
    if (Math.abs(to - from) > 1e-4) p.seek(to);
    loopFollows(d, e);
    rearm(d, e);
  }
  p.play(when);
  e.sync.lastPlay = { deck: d, callMs: performance.now() - t0, leadMs: p.startLead() * 1000, jumpMs: ((p.position() - from) / p.speed) * 1000, sync: ds.sync };
  djState.setDeck(d, { playing: p.playing });
}

/** CUE tenu en pause : la platine joue depuis le cue tant qu'on tient (preview). */
const previewing: Record<DjDeck, boolean> = { a: false, b: false, c: false, d: false };

/**
 * CUE, facon CDJ : en lecture, retour au cue et pause ; en pause, le cue se
 * pose ici (si on a bouge), puis tenu, la platine joue depuis lui ; lache,
 * elle y revient.
 */
export function djCue(d: DjDeck, down: boolean): void {
  const e = engine();
  if (!e) return;
  const p = e.decks[d];
  if (!p.loaded) return;
  const ds = djState.get().deck[d];
  if (down) {
    if (p.playing) {
      p.pause();
      p.seek(ds.cue);
      loopFollows(d, e);
      djState.setDeck(d, { playing: false });
      return;
    }
    const here = p.position();
    // Le morceau est fini : CUE ramene au cue (ou au debut), comme une CDJ, sans poser de cue a la fin
    if (here >= p.duration - END_S) {
      p.seek(ds.cue < p.duration - END_S ? ds.cue : 0);
      loopFollows(d, e);
      djState.setDeck(d, { playing: false });
      return;
    }
    if (Math.abs(here - ds.cue) > 0.01) {
      djState.setDeck(d, { cue: here });
      saveCues(d);
      return;
    }
    silenceOthers();
    previewing[d] = true;
    p.play();
    djState.setDeck(d, { playing: true });
    return;
  }
  if (!previewing[d]) return;
  previewing[d] = false;
  p.pause();
  p.seek(djState.get().deck[d].cue);
  djState.setDeck(d, { playing: false });
}

/** PLAY pendant un preview de CUE : la lecture continue au lacher de CUE. */
export function djKeepPreview(d: DjDeck): void {
  previewing[d] = false;
}

/** Un preview de CUE joue-t-il ? (un CUE tenu sans preview ne doit pas bloquer PLAY) */
export const djPreviewing = (d: DjDeck): boolean => previewing[d];

/** Hot cue : vide, il se pose ici ; pose, la platine y saute (et joue). */
export function djHotcue(d: DjDeck, n: number): void {
  const e = engine();
  if (!e) return;
  const p = e.decks[d];
  if (!p.loaded) return;
  const ds = djState.get().deck[d];
  const at = ds.cues[n];
  if (at === null || at === undefined) {
    const cues = ds.cues.slice();
    cues[n] = p.position();
    djState.setDeck(d, { cues });
    saveCues(d);
    return;
  }
  if (p.playing) {
    // SYNC arme : le saut garde la phase (au plus un demi-temps de decalage), en un seul saut
    jumpSynced(d, e, at);
    return;
  }
  const t0 = performance.now();
  p.seek(at);
  loopFollows(d, e);
  silenceOthers();
  // Les machines jouent (2026-10-07) : la platine prend leur tempo et part tout de suite, calee (startSynced)
  freed.delete(d);
  follow(d);
  startSynced(d, e, t0);
}

/** Un hot cue tenu longtemps s'efface. */
export function djHotcueClear(d: DjDeck, n: number): void {
  const ds = djState.get().deck[d];
  if (ds.cues[n] === null) return;
  const cues = ds.cues.slice();
  cues[n] = null;
  djState.setDeck(d, { cues });
  saveCues(d);
}

/** BEND tenu : la platine accelere ou freine de 4 % (beatmatch a l'oreille). */
export function djBend(d: DjDeck, dir: -1 | 0 | 1): void {
  touching[d] = dir !== 0;
  const p = engine()?.decks[d];
  if (!p || !p.playing) {
    p?.bend(0);
    return;
  }
  p.bend(dir * 0.04);
}

/**
 * Le jog : un angle tourne (rad, sens horaire = en avant) pendant dt
 * secondes. En lecture, il accelere ou freine (bend selon la vitesse de la
 * main) ; en pause, il deplace le point et fait entendre un grain (un tour
 * = 1.8 s, un vinyle a 33 tours).
 */
export function djJog(d: DjDeck, dAngle: number, dt: number): void {
  const p = engine()?.decks[d];
  if (!p || !p.loaded) return;
  if (p.playing) {
    touching[d] = true;
    const revPerS = dt > 0 ? dAngle / (2 * Math.PI) / dt : 0;
    p.bend(Math.max(-0.5, Math.min(0.5, revPerS * 0.25)));
    return;
  }
  p.grain(p.position() + (dAngle / (2 * Math.PI)) * 1.8);
}

/** La main quitte le jog : la vitesse revient. */
export function djJogRelease(d: DjDeck): void {
  touching[d] = false;
  djEngineIfAny()?.decks[d].bend(0);
}

/* ---------------- table ---------------- */

export function djSetEq(ch: DjChannel, id: DjEqId, v: number): void {
  engine();
  djState.setChannel(ch, id, v);
}

export function djSetFader(ch: DjChannel, v: number): void {
  engine();
  djState.setChannel(ch, 'fader', v);
}

export function djSetFx(id: DjFxId, v: number): void {
  engine();
  djState.setFx(id, v);
}

/** La voie des effets (FX TO) parmi celles posees : -1 toutes. */
export const fxTarget = (s = djState.get()): number => (s.fxTo >= DJ_CHANNELS ? -1 : s.fxTo);

/** FX TO en mots : ALL, ou le numero et le nom de la voie, comme sur la table (2 BASS). */
export const fxToText = (t = fxTarget()): string => (t < 0 ? 'ALL' : `${t + 1} ${DJ_CH_NAMES[t]}`);

/** FX TO en position de potard (0 a 1, DJ_CHANNELS + 1 crans : ALL puis les voies). */
export const fxToValue = (t = fxTarget()): number => (t + 1) / DJ_CHANNELS;
export const fxToOfValue = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * DJ_CHANNELS) - 1;

/** FX TO : -1 toutes les voies, sinon une voie (0 a 6) ; au-dela des voies posees : toutes. */
export function djSetFxTo(t: number): void {
  engine();
  djState.setFxTo(t >= DJ_CHANNELS ? -1 : t);
}

export function djSetMaster(v: number): void {
  engine();
  djState.setMaster(v);
}

export function djSetTime(beats: number): void {
  engine();
  djState.setTime(beats);
}

/**
 * Le pas du tempo d'une platine (2026-10-07, Mika : "je veux pouvoir
 * modifier le pitch des decks finement, arriver a des .05 sans probleme, et
 * avec le doigt aussi en mobile") : 0.05 BPM, au lieu du dixieme.
 */
export const TEMPO_STEP = 0.05;

/**
 * Le pitch a la main (fader, molette, PITCH - et +) : SYNC se desarme ; les
 * machines qui jouent ne la suivent plus (freed). Un BPM connu : le tempo
 * tombe sur le pas de 0.05 BPM le plus proche (le fader au doigt s'y arrete
 * sans chercher) ; sinon au centieme de pour cent (2026-10-05).
 */
export function djSetPitch(d: DjDeck, v: number): void {
  engine();
  if (machinesOn()) freed.add(d);
  const ds = djState.get().deck[d];
  const r = ds.range || 8;
  const bpm = ds.track?.bpm ?? null;
  let pitch = Math.round(v * r * 100) / (r * 100);
  if (bpm) {
    const target = Math.round((bpm * (1 + (v * r) / 100)) / TEMPO_STEP) * TEMPO_STEP;
    pitch = Math.max(-1, Math.min(1, ((target / bpm - 1) * 100) / r));
  }
  djState.setDeck(d, { pitch, sync: false });
}

/**
 * Le tempo au pas de 0.05 BPM (2026-10-04 au dixieme, 2026-10-07 au
 * vingtieme) : le BPM affiche (au pitch) va au pas le plus proche dans la
 * direction voulue, et le pitch s'y cale ; sans BPM connu, un pas de
 * 0.01 %. step : en BPM (TEMPO_STEP, ou 1 avec Maj).
 */
export function djTempoStep(d: DjDeck, dir: -1 | 1, step = TEMPO_STEP): void {
  const ds = djState.get().deck[d];
  const bpm = ds.track?.bpm ?? null;
  let next: number;
  if (bpm) {
    const now = bpm * (1 + (ds.pitch * ds.range) / 100);
    const target = Math.round((now + dir * step) / TEMPO_STEP) * TEMPO_STEP;
    next = ((target / bpm - 1) * 100) / ds.range;
  } else next = ds.pitch + (dir * 0.01) / ds.range;
  djSetPitch(d, Math.max(-1, Math.min(1, next)));
}

/* ---------------- SYNC ---------------- */

/** Les machines du site jouent (le MM-RYTM, ou l'arpege seul) : elles font la reference des platines. */
export const machinesOn = (): boolean => clock.running || arp.get().running;
/** Leur grille en doubles croches apres t (celle du MM-RYTM, sinon celle de l'arpege). */
const machinesGrid = (t: number): { time: number; step: number; dur: number } | null => clock.gridAfter(t) ?? arp.grid(t);
/** Leur tempo. */
const machinesBpm = (): number => (clock.running ? clock.bpm : pattern.get().bpm);

/**
 * La platine qu'on entend le plus parmi les autres (celle sur laquelle on se
 * cale), ou null ; null aussi quand les machines jouent (2026-10-07) : elles
 * sont la reference de toutes les platines.
 */
function syncDeck(d: DjDeck, s = djState.get()): DjDeck | null {
  if (machinesOn()) return null;
  let best: DjDeck | null = null;
  let w = 0;
  for (const o of DJ_DECKS_ALL) {
    if (o === d) continue;
    const k = heardWeight(s, o);
    if (k > w) {
      w = k;
      best = o;
    }
  }
  return best;
}

/**
 * Le tempo de reference pour SYNC : les machines quand elles jouent
 * (2026-10-07), sinon la platine qu'on entend le plus parmi les autres ;
 * null s'il n'y a rien sur quoi se caler.
 */
export function syncBpm(d: DjDeck, s = djState.get()): number | null {
  if (machinesOn()) return machinesBpm();
  const r = syncDeck(d, s);
  return r ? deckBpm(s, r) : null;
}

/**
 * Le prochain temps d'une platine apres l'instant t du contexte : dans
 * combien de secondes il tombe et la periode, en temps reel. pos : la
 * platine posee la a l'instant t (un depart, un saut) ; sinon la ou elle est
 * a t. null sans grille. Toutes les mesures de SYNC prennent un seul instant
 * t (2026-10-08) : deux lectures de currentTime peuvent tomber de part et
 * d'autre d'un paquet de rendu, 2.9 ms d'ecart de phase.
 */
function deckBeat(d: DjDeck, e: DjEngine, s = djState.get(), pos?: number, t = e.ctx.currentTime): { in: number; period: number } | null {
  const ds = s.deck[d];
  const p = e.decks[d];
  if (ds.beat === null || !ds.track?.bpm || !p.loaded) return null;
  const spb = 60 / ds.track.bpm;
  const speed = p.speed;
  const beats = ((pos ?? p.positionAt(t)) - ds.beat) / spb;
  return { in: ((1 - (beats - Math.floor(beats))) * spb) / speed, period: spb / speed };
}

/** Le prochain temps de la reference (une platine, ou les machines du site) apres l'instant t, en temps reel. */
function refBeat(d: DjDeck, e: DjEngine, s = djState.get(), t = e.ctx.currentTime): { in: number; period: number } | null {
  const r = syncDeck(d, s);
  if (r) return deckBeat(r, e, s, undefined, t);
  if (!machinesOn()) return null;
  // Les machines : seize pas par mesure, un temps tous les quatre
  const g = machinesGrid(t);
  if (!g) return null;
  const k = (4 - (g.step % 4)) % 4;
  return { in: g.time + k * g.dur - t, period: 4 * g.dur };
}

/**
 * La place ou poser la tete pour que la platine, partie de pos a l'instant
 * when du contexte (une nouvelle source, en pause comme en lecture), tombe
 * sur les temps de la reference : le plus petit saut, au plus un demi-temps,
 * dans un sens ou dans l'autre (avant le debut du morceau, l'autre sens).
 * pos tel quel sans grille ni reference. playing : la platine joue deja (un
 * saut en lecture).
 */
function inPhase(d: DjDeck, e: DjEngine, pos: number, when: number, playing = false): number {
  const p = e.decks[d];
  const s = djState.get();
  const own = deckBeat(d, e, s, pos, when);
  const ref = refBeat(d, e, s, when);
  if (!own || !ref) return pos;
  const shift = phaseShift(own.in, own.period, ref.in, ref.period);
  const period = Math.min(own.period, ref.period) * p.speed;
  let to = pos + shift * p.speed;
  if (to < 0) to += period;
  if (to > p.duration - END_S) to -= period;
  return playing ? Math.max(0, to) : Math.max(0, Math.min(p.duration, to));
}

/** L'instant d'un depart ou d'un saut : maintenant, plus l'avance d'un depart (dj/engine.ts startLead). */
const startTime = (e: DjEngine, d: DjDeck): number => e.ctx.currentTime + e.decks[d].startLead();

/**
 * Un saut en lecture vers pos, cale si la platine est calee : la nouvelle
 * source part a l'instant prevu, sa tete deplacee d'au plus un demi-temps
 * (un seul saut, en fondu croise : dj/engine.ts seek).
 */
function jumpSynced(d: DjDeck, e: DjEngine, pos: number): void {
  const p = e.decks[d];
  const synced = djState.get().deck[d].sync;
  const when = startTime(e, d);
  p.seek(synced ? inPhase(d, e, pos, when, true) : pos, when);
  loopFollows(d, e);
  if (synced) rearm(d, e);
}

/**
 * En lecture : la platine saute d'au plus un demi-temps, ses temps tombent
 * sur ceux de la reference (un seul saut, en fondu croise : dj/engine.ts
 * seek). gentle : un petit ecart (moins de LOCK.seekAboveS) est laisse au
 * verrou de phase, qui le rattrape sans saut.
 */
function alignNow(d: DjDeck, e: DjEngine, gentle = false): void {
  const p = e.decks[d];
  if (!p.playing) return;
  const when = startTime(e, d);
  const here = p.positionAt(when);
  const to = inPhase(d, e, here, when, true);
  const jump = Math.abs(to - here) / p.speed;
  if (jump < 0.002 || (gentle && jump < LOCK.seekAboveS)) return;
  p.seek(to, when);
  loopFollows(d, e);
  rearm(d, e);
}

/**
 * SYNC, le centre du jog (Mika, 2026-10-04 : le jog "pas super utile",
 * "trouve-lui une utilite", puis "continue avec le calage des temps") : le
 * tempo de la platine se cale sur celui qu'on entend (une autre platine, ou
 * les machines), au double ou a la moitie si c'est plus pres ; la plage du
 * pitch s'ouvre a 16 % au besoin. Puis les temps : en lecture, la platine
 * saute d'au plus un demi-temps pour tomber sur ceux de la reference ; en
 * pause, PLAY (et un hot cue) partira sur un de ses temps. SYNC reste arme
 * tant qu'on ne touche pas au pitch.
 */
export function djSync(d: DjDeck): void {
  // En chargement : SYNC attend la platine (djLoad) ; un second appui le desarme
  if (djState.get().deck[d].loading !== null) {
    if (!syncArmed.delete(d)) syncArmed.add(d);
    return;
  }
  if (!matchTempo(d)) return;
  // Un SYNC a la main : la platine redevient suivie par les machines, ses temps exactement sur la reference
  freed.delete(d);
  const e = engine();
  if (!e) return;
  rearm(d, e);
  if (e.decks[d].playing) alignNow(d, e);
}

/** Le tempo de la platine sur celui de la reference (SYNC, sans les temps) ; false s'il est trop loin ou inconnu. */
function matchTempo(d: DjDeck): boolean {
  const s = djState.get();
  const ds = s.deck[d];
  const ref = syncBpm(d, s);
  const own = ds.track?.bpm;
  if (!ref || !own) return false;
  const ratio = [ref, ref * 2, ref / 2].map((r) => r / own).reduce((a, b) => (Math.abs(b - 1) < Math.abs(a - 1) ? b : a));
  const pct = (ratio - 1) * 100;
  const range = Math.abs(pct) <= 8 ? ds.range : Math.abs(pct) <= 16 ? 16 : 0;
  if (range === 0) return false;
  engine();
  djState.setDeck(d, { range, pitch: Math.max(-1, Math.min(1, pct / range)), sync: true });
  return true;
}

/**
 * La platine est-elle calee sur ce qu'on entend ? Le tempo au centieme de
 * BPM, et en lecture ses temps a 20 ms au plus de ceux de la reference
 * (l'ecran rond s'allume en orange ; un nudge au jog ou a BEND l'eteint
 * puis le rallume).
 */
export function djSynced(d: DjDeck, s = djState.get()): boolean {
  const ref = syncBpm(d, s);
  const own = deckBpm(s, d);
  if (!ref || !own) return false;
  if (![ref, ref * 2, ref / 2].some((r) => Math.abs(own - r) < 0.05)) return false;
  const e = djEngineIfAny();
  if (!e || !e.decks[d].playing) return true;
  const t = e.ctx.currentTime;
  const a = deckBeat(d, e, s, undefined, t);
  const b = refBeat(d, e, s, t);
  if (!a || !b) return true;
  // L'ecart garde par un nudge a la main compte comme cale (le verrou de phase le tient)
  return Math.abs(wrapPhase(phaseShift(a.in, a.period, b.in, b.period) - keep[d], Math.min(a.period, b.period))) < 0.02;
}

/* ---------------- le verrou de phase de SYNC ---------------- */

/**
 * Les platines calees le restent (2026-10-08) : SYNC ne calait les temps
 * qu'a l'appui et aux changements de tempo. Quatre fois par seconde, l'ecart
 * de phase de chaque platine calee (SYNC, ou suivie par les machines) avec
 * sa reference ; au-dela de 4 ms, la platine accelere ou freine de 0.3 % au
 * plus (cinq centiemes de demi-ton, inaudible) le temps de combler l'ecart,
 * un temps au plus a chaque mesure, jusqu'a 1 ms d'ecart. Jamais de saut en lecture (un saut s'entend). Au-dela
 * d'un huitieme de temps, rien d'automatique : la grille est fausse, le jog
 * ou BEND corrigent. Un nudge a la main (jog, BEND) est respecte : l'ecart
 * laisse par la main devient celui que le verrou garde, jusqu'au prochain
 * SYNC, PLAY ou saut cale.
 */
const LOCK = { everyMs: 250, startS: 0.004, settleS: 0.001, seekAboveS: 0.02 } as const;
const each = <T>(v: T): Record<DjDeck, T> => ({ a: v, b: v, c: v, d: v });
/** l'ecart garde (s, positif : en retard), pose par la main */
const keep = each(0);
/** la main tient la platine (jog en lecture, BEND) */
const touching = each(false);
/** la main vient de lacher : l'ecart du moment devient celui qu'on garde */
const recapture = new Set<DjDeck>();
const nudgeEnd = each(0);
/** le rattrapage est lance (au-dela de 4 ms) : il continue jusqu'a 1 ms d'ecart, sans osciller autour du seuil */
const locking = each(false);

/** Un ecart ramene dans une demi-periode. */
function wrapPhase(x: number, period: number): number {
  if (!(period > 0)) return x;
  let v = ((x % period) + period) % period;
  if (v > period / 2) v -= period;
  return v;
}

/** Un calage exact (SYNC, PLAY, un saut cale) : plus d'ecart garde, plus de rattrapage en cours. */
function rearm(d: DjDeck, e: DjEngine): void {
  keep[d] = 0;
  recapture.delete(d);
  stopNudge(d, e, true);
}

function stopNudge(d: DjDeck, e: DjEngine, done = false): void {
  if (done) locking[d] = false;
  window.clearTimeout(nudgeEnd[d]);
  if (e.decks[d].nudging !== 0) e.decks[d].nudge(0);
  e.sync.nudge[d] = 0;
}

function phaseLock(e: DjEngine): void {
  const s = djState.get();
  for (const d of DJ_DECKS_ALL) {
    const p = e.decks[d];
    const ds = s.deck[d];
    const t = e.ctx.currentTime;
    const own = p.playing && ds.sync && ds.loaded ? deckBeat(d, e, s, undefined, t) : null;
    const ref = own ? refBeat(d, e, s, t) : null;
    if (!own || !ref) {
      stopNudge(d, e, true);
      e.sync.errMs[d] = null;
      continue;
    }
    const period = Math.min(own.period, ref.period);
    const raw = phaseShift(own.in, own.period, ref.in, ref.period);
    if (touching[d] || p.bending) {
      // La main tient la platine : on la laisse faire, on retiendra l'ecart qu'elle laisse
      stopNudge(d, e, true);
      recapture.add(d);
      e.sync.errMs[d] = wrapPhase(raw - keep[d], period) * 1000;
      continue;
    }
    if (recapture.delete(d)) keep[d] = raw;
    e.sync.keepMs[d] = keep[d] * 1000;
    const err = wrapPhase(raw - keep[d], period);
    e.sync.errMs[d] = err * 1000;
    if (Math.abs(err) > LOCK.startS) locking[d] = true;
    if (Math.abs(err) <= LOCK.settleS || Math.abs(err) > period / 8) locking[d] = false;
    if (!locking[d]) {
      stopNudge(d, e);
      continue;
    }
    // En retard (err > 0) : un peu plus vite, le temps de combler l'ecart (un temps au plus)
    const n = Math.max(-NUDGE_MAX, Math.min(NUDGE_MAX, err / period));
    p.nudge(n);
    e.sync.nudge[d] = n;
    window.clearTimeout(nudgeEnd[d]);
    nudgeEnd[d] = window.setTimeout(() => stopNudge(d, e), Math.min(period, Math.abs(err / n)) * 1000);
  }
}

/* ---------------- les platines suivent les machines ---------------- */

/**
 * Les platines suivent les machines (2026-10-07, Mika : "j'aimerais que les
 * decks soient sync avec les machines, automatiquement, quand les machines
 * jouent") : tant que le MM-RYTM (ou l'arpege) joue, chaque platine qui
 * joue prend son tempo (au double ou a la moitie si c'est plus pres, la
 * plage du pitch a 16 % au plus) et cale ses temps sur les siens, comme
 * SYNC ; elle le garde quand le tempo des machines change, et une platine
 * qui part attend un de leurs temps. Toucher son pitch (fader, PITCH - et
 * +, molette) la libere jusqu'a sa prochaine lecture, ou un SYNC ; les
 * machines a l'arret, chaque platine garde son tempo.
 */
const freed = new Set<DjDeck>();
let watching = false;

/** Une platine prend le tempo et les temps des machines (tempo : sans les temps), si elles jouent et qu'on ne l'a pas liberee. */
function follow(d: DjDeck, tempo = false): void {
  if (!machinesOn() || freed.has(d)) return;
  const ds = djState.get().deck[d];
  if (!ds.track?.bpm || !ds.loaded || !matchTempo(d)) return;
  const e = djEngineIfAny();
  // Un petit ecart (un tempo qui vient de changer) : le verrou de phase le rattrape, sans saut
  if (!tempo && e && e.decks[d].playing) alignNow(d, e, true);
}

/** Toutes celles qui jouent. */
function followAll(tempo = false): void {
  for (const d of DJ_DECKS) if (djState.get().deck[d].playing) follow(d, tempo);
}
let realign = 0;

/** Les machines partent (une platine joue : elle les suit), leur tempo change (les platines suivies aussi). */
function watchMachines(): void {
  if (watching) return;
  watching = true;
  let on = machinesOn();
  let bpm = machinesBpm();
  const check = (): void => {
    const now = machinesOn();
    if (now && !on) {
      // Le depart : leur grille existe un instant plus tard ; chaque platine redevient suivie
      freed.clear();
      window.setTimeout(followAll, 80);
    }
    on = now;
  };
  clock.subscribe(check);
  arp.subscribe(check);
  pattern.subscribe(() => {
    const b = machinesBpm();
    if (Math.abs(b - bpm) < 1e-6) return;
    bpm = b;
    if (!machinesOn()) return;
    // Le tempo tout de suite ; les temps une fois le potard pose (un recalage par geste, pas un par pixel)
    followAll(true);
    window.clearTimeout(realign);
    realign = window.setTimeout(() => followAll(), 400);
  });
}

/* ---------------- les grilles, pour le sampler des platines ---------------- */

/**
 * La grille en doubles croches d'une platine qui joue (2026-10-07, la
 * sequence de son sampler s'y cale) : le premier pas a partir de t (temps
 * du contexte), son numero dans la mesure, sa duree ; null a l'arret ou
 * sans grille des temps.
 */
export function deckGridAfter(d: DjDeck, t: number): { time: number; step: number; dur: number } | null {
  const e = djEngineIfAny();
  const ds = djState.get().deck[d];
  const p = e?.decks[d];
  if (!e || !p || !p.playing || ds.beat === null || !ds.track?.bpm) return null;
  const sub = 60 / ds.track.bpm / 4;
  const speed = p.speed;
  const now = e.ctx.currentTime;
  const pos = p.positionAt(now);
  const k = Math.ceil((pos + (t - now) * speed - ds.beat) / sub - 1e-6);
  return { time: now + (ds.beat + k * sub - pos) / speed, step: ((k % 16) + 16) % 16, dur: sub / speed };
}

/**
 * Le dernier temps de ce que sort le MIXER (2026-10-07, REC MIX d'une
 * platine) : son heure (temps du contexte), la periode d'un temps et son
 * rang dans la mesure (0 a 3, null s'il n'est pas connu). La reference : la
 * platine qu'on entend le plus, sinon le MM-RYTM ou le MM-ARP qui tournent ;
 * null s'il n'y a rien sur quoi se caler.
 */
export function mixBeat(): { last: number; period: number; index: number | null } | null {
  const e = djEngineIfAny();
  if (!e) return null;
  const s = djState.get();
  const now = e.ctx.currentTime;
  let best: DjDeck | null = null;
  let w = 0;
  for (const d of DJ_DECKS_ALL) {
    const k = heardWeight(s, d);
    if (k > w) {
      w = k;
      best = d;
    }
  }
  if (best) {
    const b = deckBeat(best, e, s, undefined, now);
    const ds = s.deck[best];
    const p = e.decks[best];
    if (b && ds.beat !== null && ds.track?.bpm) {
      const idx = Math.floor((p.positionAt(now) - ds.beat) / (60 / ds.track.bpm) + 1e-6);
      return { last: now + b.in - b.period, period: b.period, index: ((idx % 4) + 4) % 4 };
    }
  }
  const g = clock.gridAfter(now) ?? arp.grid(now);
  if (!g) return null;
  const k = (4 - (g.step % 4)) % 4;
  const next = g.time + k * g.dur;
  const period = 4 * g.dur;
  const nextIndex = Math.floor(((g.step + k) % 16) / 4);
  return { last: next - period, period, index: (nextIndex + 3) % 4 };
}

/* ---------------- LOOP ---------------- */

/** Un saut hors de la boucle la quitte (dj/engine.ts seek) : le store suit. */
function loopFollows(d: DjDeck, e: DjEngine): void {
  if (djState.get().deck[d].loop !== null && !e.decks[d].loop) djState.setDeck(d, { loop: null });
}

/**
 * LOOP (Mika, 2026-10-04 : "continue avec les boucles LOOP") : une boucle
 * de n temps au temps pres. Elle part du temps ou l'on est, sur la grille
 * des temps du morceau (celle de SYNC) ; sans grille, d'ici. Une autre
 * longueur pendant la boucle la redimensionne depuis le meme depart ; la
 * meme touche la quitte, et la lecture continue tout droit. La source boucle
 * d'elle-meme, a l'echantillon pres (dj/engine.ts setLoop).
 */
export function djLoop(d: DjDeck, beats: number): void {
  const e = engine();
  const p = e?.decks[d];
  if (!e || !p || !p.loaded) return;
  const ds = djState.get().deck[d];
  if (p.loop && ds.loop === beats) {
    p.setLoop(null);
    djState.setDeck(d, { loop: null });
    return;
  }
  const spb = 60 / (ds.track?.bpm || 120);
  let a: number;
  if (p.loop) a = p.loop.a;
  else {
    const pos = p.position();
    a = ds.beat !== null ? ds.beat + Math.floor((pos - ds.beat) / spb + 1e-6) * spb : pos;
    if (a < 0) a = Math.max(0, a + spb);
  }
  p.setLoop({ a, b: Math.min(p.duration, a + beats * spb) });
  djState.setDeck(d, { loop: p.loop ? beats : null });
}

/* ---------------- des platines en plus ---------------- */

/** ADD DECK : une platine de plus a droite (C, puis D), avec sa voie au MIXER. */
export function djAddDeck(): void {
  djDecks.set(djDecks.get() + 1);
}

/**
 * REMOVE : la derniere platine ajoutee s'arrete, se vide et s'en va. Une
 * platine qui joue ne part pas d'un seul geste (Mika, 2026-10-04 : "quand
 * on a add un deck par erreur, comment on l'enleve ?") : le premier appui
 * arme REMOVE (la touche s'allume, l'ecran dit d'appuyer encore), le
 * second, dans les REMOVE_ARM_MS, la retire.
 */
const REMOVE_ARM_MS = 3000;
let removeTimer = 0;

export function djRemoveDeck(d: DjDeck): void {
  if (DJ_DECKS[DJ_DECKS.length - 1] !== d || DJ_DECKS.length <= 2) return;
  const p = djEngineIfAny()?.decks[d];
  window.clearTimeout(removeTimer);
  if (p?.playing && !djState.get().deck[d].remove) {
    djState.setDeck(d, { remove: true });
    removeTimer = window.setTimeout(() => djState.setDeck(d, { remove: false }), REMOVE_ARM_MS);
    return;
  }
  if (p?.playing) p.pause();
  loads[d]?.abort();
  syncArmed.delete(d);
  djState.setDeck(d, { playing: false, loaded: false, track: null, loading: null, loadStep: null, armed: false, error: null, cue: 0, cues: [null, null, null, null], pitch: 0, range: 8, remove: false });
  djDecks.set(djDecks.get() - 1);
  // FX TO visait la voie retiree : les effets reviennent sur toutes
  if (djState.get().fxTo >= DJ_CHANNELS) djState.setFxTo(-1);
}

/* ---------------- l'ecran : recherche, scrub, zoom ---------------- */

/**
 * Aller a un instant de la piste (en lecture, elle continue de la). Calee
 * et en lecture (2026-10-08) : le saut garde la phase, a un demi-temps pres
 * de l'endroit touche, comme une CDJ en QUANTIZE ; sinon le verrou de phase
 * ne pourrait plus la rattraper.
 */
export function djSeek(d: DjDeck, seconds: number): void {
  const e = engine();
  const p = e?.decks[d];
  if (!e || !p || !p.loaded) return;
  if (p.playing) {
    jumpSynced(d, e, seconds);
    return;
  }
  p.seek(seconds);
  loopFollows(d, e);
}

/** Le doigt sur la forme d'onde, en pause : le point suit et on entend un grain (poser un cue a l'oreille). */
export function djScrub(d: DjDeck, seconds: number): void {
  const p = engine()?.decks[d];
  if (!p || !p.loaded || p.playing) return;
  p.grain(seconds);
}

/** Position du moment (0 sans morceau). */
export function djPosition(d: DjDeck): number {
  return djEngineIfAny()?.decks[d].position() ?? 0;
}

/** La fenetre de la forme d'onde fine, bornee de 1 a 64 secondes. */
export function djZoom(d: DjDeck, seconds: number): void {
  const z = Math.max(1, Math.min(64, seconds));
  djState.setDeck(d, { zoom: Math.round(z * 100) / 100 });
}

/** WAVE : l'affichage suivant des formes d'onde (3BAND, RGB, MONO), pour toutes les platines. */
export function djWaveNext(): void {
  const w = djState.get().wave;
  djState.setWave(DJ_WAVES[(DJ_WAVES.indexOf(w) + 1) % DJ_WAVES.length]);
}

/** Un cran de zoom (DJ_ZOOMS) : -1 plus pres, +1 plus loin. */
export function djZoomStep(d: DjDeck, dir: -1 | 1): void {
  const z = djState.get().deck[d].zoom;
  const next = dir > 0 ? DJ_ZOOMS.find((v) => v > z + 1e-6) : [...DJ_ZOOMS].reverse().find((v) => v < z - 1e-6);
  if (next !== undefined) djZoom(d, next);
}
