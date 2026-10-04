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
import { sc } from '../audio/soundcloud';
import { arp } from '../voyager/arp';
import { djEngine, djEngineIfAny, type DjEngine } from './engine';
import { estimateBpm } from './math';
import { djState, type DjTrack } from './state';
import { DJ_FX, type DjChannel, type DjDeck, type DjEqId, type DjFxId } from './theme';

/* ---------------- le moteur suit le store ---------------- */

let synced: DjEngine | null = null;

/** Pose tout le store sur le moteur (a sa creation), puis chaque changement. */
function apply(e: DjEngine): void {
  const s = djState.get();
  for (const i of [0, 1] as const) {
    const c = s.ch[i];
    const ch = e.mixer.ch[i];
    ch.setGain(c.gain);
    ch.setBand('hi', c.hi);
    ch.setBand('mid', c.mid);
    ch.setBand('low', c.low);
    ch.setFilter(c.filter);
    ch.setFader(c.fader);
  }
  e.mixer.setXfader(s.xfader);
  e.mixer.setMaster(s.master);
  for (const f of DJ_FX) e.mixer.fx.dose(f, s.fx[f]);
  for (const d of ['a', 'b'] as const) e.decks[d].setPitch(s.deck[d].pitch * s.deck[d].range);
  e.mixer.fx.tempo({ bpm: heardBpm(s), beats: s.time });
}

/** Le tempo de la platine qu'on entend le plus (crossfader, faders, lecture). */
export function heardBpm(s = djState.get()): number {
  const w = (d: DjDeck, i: 0 | 1): number => {
    const ds = s.deck[d];
    if (!ds.playing || !ds.track?.bpm) return 0;
    const x = (s.xfader + 1) / 2;
    return s.ch[i].fader * (i === 0 ? 1 - x : x);
  };
  const a = w('a', 0);
  const b = w('b', 1);
  const d: DjDeck = b > a ? 'b' : 'a';
  const ds = s.deck[d];
  return ds.track?.bpm ? ds.track.bpm * (1 + (ds.pitch * ds.range) / 100) : 120;
}

/** Le moteur (cree au besoin, apres le premier geste), branche sur le store une fois. */
function engine(): DjEngine | null {
  const e = djEngine();
  if (!e || synced === e) return e;
  synced = e;
  apply(e);
  djState.subscribe(() => apply(e));
  for (const d of ['a', 'b'] as const) {
    e.decks[d].onEnd = () => djState.setDeck(d, { playing: false });
  }
  // Une autre source part (RUN de la 808, l'arpege, une piste du site) : les platines se taisent
  clock.subscribe(() => {
    if (clock.running) djPauseAll();
  });
  arp.subscribe(() => {
    if (arp.get().running) djPauseAll();
  });
  sc.subscribe(() => {
    if (sc.get().status === 'playing') djPauseAll();
  });
  return e;
}

/** Une platine part : les autres sources du site se taisent. */
function silenceOthers(): void {
  sc.pauseForRun();
  if (clock.running) clock.stop();
  if (arp.get().running) arp.stop();
}

/** Une autre source part (RUN, une piste SoundCloud) : les platines se taisent. */
export function djPauseAll(): void {
  const e = djEngineIfAny();
  if (!e) return;
  for (const d of ['a', 'b'] as const) {
    if (!e.decks[d].playing) continue;
    e.decks[d].pause();
    djState.setDeck(d, { playing: false });
  }
}

/* ---------------- charger ---------------- */

const AUDIUS = 'https://api.audius.co';
let audiusHost: Promise<string> | null = null;
/** Audius annonce le serveur a interroger ; demande une fois. */
export function audiusHostUrl(): Promise<string> {
  audiusHost ??= fetch(AUDIUS)
    .then((r) => (r.ok ? (r.json() as Promise<{ data?: string[] }>) : null))
    .then((d) => d?.data?.[0] ?? AUDIUS)
    .catch(() => AUDIUS);
  return audiusHost;
}
export const AUDIUS_APP = 'mauditemachine';

/** Telecharge avec la progression (0 a 1). */
async function download(url: string, progress: (p: number) => void, signal: AbortSignal): Promise<ArrayBuffer> {
  const r = await fetch(url, { signal });
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
  const total = Number(r.headers.get('content-length') ?? 0);
  const reader = r.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    if (total > 0) progress(Math.min(1, got / total));
  }
  const out = new Uint8Array(got);
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out.buffer;
}

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

/** Pose un morceau sur une platine : telecharge (Audius) ou lit (fichier), decode, BPM si absent. */
export async function djLoad(d: DjDeck, track: DjTrack): Promise<void> {
  const e = engine();
  if (!e) return;
  loads[d]?.abort();
  const ctl = new AbortController();
  loads[d] = ctl;
  djState.setDeck(d, { playing: false, loaded: false, track, loading: 0, error: null });
  try {
    let bytes: ArrayBuffer;
    if (track.source === 'file' && track.file) bytes = await track.file.arrayBuffer();
    else {
      const host = await audiusHostUrl();
      bytes = await download(`${host}/v1/tracks/${encodeURIComponent(track.id)}/stream?app_name=${AUDIUS_APP}`, (p) => djState.setDeck(d, { loading: p }), ctl.signal);
    }
    if (ctl.signal.aborted) return;
    await e.decks[d].load(bytes);
    if (ctl.signal.aborted) return;
    const p = e.decks[d];
    let bpm = track.bpm;
    const ch0 = p.channel0;
    if (!bpm && ch0) bpm = estimateBpm(ch0, p.sampleRate);
    const { cue, cues } = savedCues(track.id);
    djState.setDeck(d, { loaded: true, loading: null, track: { ...track, bpm, duration: p.duration }, cue, cues });
    p.seek(cue);
  } catch (err) {
    if (ctl.signal.aborted) return;
    djState.setDeck(d, { loading: null, loaded: false, error: err instanceof Error ? err.message : 'load failed' });
  }
}

/* ---------------- transport ---------------- */

export function djPlay(d: DjDeck): void {
  const e = engine();
  if (!e) return;
  const p = e.decks[d];
  if (!p.loaded) return;
  if (p.playing) {
    p.pause();
    djState.setDeck(d, { playing: false });
    return;
  }
  silenceOthers();
  p.play();
  djState.setDeck(d, { playing: p.playing });
}

/** CUE tenu en pause : la platine joue depuis le cue tant qu'on tient (preview). */
const previewing: Record<DjDeck, boolean> = { a: false, b: false };

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
      djState.setDeck(d, { playing: false });
      return;
    }
    const here = p.position();
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
  p.seek(at);
  if (!p.playing) {
    silenceOthers();
    p.play();
    djState.setDeck(d, { playing: p.playing });
  }
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
    const revPerS = dt > 0 ? dAngle / (2 * Math.PI) / dt : 0;
    p.bend(Math.max(-0.5, Math.min(0.5, revPerS * 0.25)));
    return;
  }
  p.grain(p.position() + (dAngle / (2 * Math.PI)) * 1.8);
}

/** La main quitte le jog : la vitesse revient. */
export function djJogRelease(d: DjDeck): void {
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

export function djSetMaster(v: number): void {
  engine();
  djState.setMaster(v);
}

export function djSetXfader(v: number): void {
  engine();
  djState.setXfader(v);
}

export function djSetTime(beats: number): void {
  engine();
  djState.setTime(beats);
}

export function djSetPitch(d: DjDeck, v: number): void {
  engine();
  djState.setDeck(d, { pitch: v });
}
