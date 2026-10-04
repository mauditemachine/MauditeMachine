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
import { routeMachines } from '../audio/drums';
import { sc } from '../audio/soundcloud';
import { djEngine, djEngineIfAny, type DjEngine } from './engine';
import { crateFile, crateLearn, setCrateBusy } from './crate';
import { estimateBpm } from './math';
import { soundcloudBytes } from './soundcloud';
import { DJ_ZOOMS, djState, type DjTrack } from './state';
import { DJ_DECKS, DJ_DECKS_ALL, DJ_FX, deckChannel, djDecks, type DjChannel, type DjDeck, type DjEqId, type DjFxId } from './theme';

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
  e.mixer.setXfader(s.xfader);
  e.mixer.setMaster(s.master);
  for (const f of DJ_FX) e.mixer.fx.dose(f, s.fx[f]);
  for (const d of DJ_DECKS_ALL) e.decks[d].setPitch(s.deck[d].pitch * s.deck[d].range);
  e.mixer.fx.tempo({ bpm: heardBpm(s), beats: s.time });
}

/** Le BPM joue d'une platine (au pitch), ou null sans BPM connu. */
const deckBpm = (s: ReturnType<typeof djState.get>, d: DjDeck): number | null => {
  const ds = s.deck[d];
  return ds.track?.bpm ? ds.track.bpm * (1 + (ds.pitch * ds.range) / 100) : null;
};

/**
 * Ce qu'on entend d'une platine qui joue : son fader, et pour A et B le
 * crossfader (C et D passent a cote) ; 0 a l'arret ou sans BPM.
 */
function heardWeight(s: ReturnType<typeof djState.get>, d: DjDeck): number {
  const ds = s.deck[d];
  if (!ds.playing || !ds.track?.bpm) return 0;
  const i = deckChannel(d);
  const x = (s.xfader + 1) / 2;
  return s.ch[i].fader * (d === 'a' ? 1 - x : d === 'b' ? x : 1);
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
  // Les analyses de la caisse attendent que les platines s'arretent
  setCrateBusy(() => DJ_DECKS_ALL.some((d) => e.decks[d].playing));
  /*
   * Les machines du site entrent sur la table (2026-10-04, Mika : "1 et 2
   * doivent etre RYTM et ARP") : le MM-RYTM sur la voie 1, le MM-ARP sur la
   * voie 2, effets compris ; on mixe donc les platines avec elles, elles ne
   * se taisent plus l'une l'autre. Seule la piste SoundCloud du site, qui
   * ne passe pas par la table, reste une source a part.
   */
  routeMachines({ rytm: e.mixer.ch[0].input, arp: e.mixer.ch[1].input });
  sc.subscribe(() => {
    if (sc.get().status === 'playing') djPauseAll();
  });
  return e;
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
 */
export async function djLoad(d: DjDeck, track: DjTrack): Promise<void> {
  const e = engine();
  if (!e) return;
  loads[d]?.abort();
  const ctl = new AbortController();
  loads[d] = ctl;
  djState.setDeck(d, { playing: false, loaded: false, track, loading: 0, error: null });
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
    await e.decks[d].load(bytes);
    if (ctl.signal.aborted) return;
    const p = e.decks[d];
    let bpm = track.bpm;
    const ch0 = p.channel0;
    if (!bpm && ch0) bpm = estimateBpm(ch0, p.sampleRate);
    const { cue, cues } = savedCues(track.id);
    djState.setDeck(d, { loaded: true, loading: null, track: { ...track, bpm, duration: p.duration }, cue, cues });
    // La caisse apprend la duree et le BPM : le morceau n'a plus a etre analyse en fond
    if (track.source === 'file') void crateLearn(track.id, p.duration, bpm);
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

/**
 * Le tempo au dixieme de BPM (2026-10-04) : le BPM affiche (au pitch) va au
 * dixieme le plus proche dans la direction voulue, et le pitch s'y cale ;
 * sans BPM connu, un pas de 0.02 %. step : en BPM (0.1, ou 1 avec Maj).
 */
export function djTempoStep(d: DjDeck, dir: -1 | 1, step = 0.1): void {
  const ds = djState.get().deck[d];
  const bpm = ds.track?.bpm ?? null;
  let next: number;
  if (bpm) {
    const now = bpm * (1 + (ds.pitch * ds.range) / 100);
    const target = Math.round((now + dir * step) / 0.1) * 0.1;
    next = ((target / bpm - 1) * 100) / ds.range;
  } else next = ds.pitch + (dir * 0.02) / ds.range;
  djSetPitch(d, Math.max(-1, Math.min(1, next)));
}

/* ---------------- SYNC ---------------- */

/**
 * Le tempo de reference pour SYNC : la platine qu'on entend le plus parmi
 * les autres, sinon le MM-RYTM et le MM-ARP s'ils tournent ; null s'il n'y a
 * rien sur quoi se caler.
 */
export function syncBpm(d: DjDeck, s = djState.get()): number | null {
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
  if (best) return deckBpm(s, best);
  return clock.running ? clock.bpm : null;
}

/**
 * SYNC, le centre du jog (Mika, 2026-10-04 : le jog "pas super utile",
 * "trouve-lui une utilite") : le tempo de la platine se cale sur celui
 * qu'on entend (une autre platine, ou les machines), au double ou a la
 * moitie si c'est plus pres ; la plage du pitch s'ouvre a 16 % au besoin.
 * Le calage du temps (la phase) reste a l'oreille : BEND, ou le jog.
 */
export function djSync(d: DjDeck): void {
  const s = djState.get();
  const ds = s.deck[d];
  const ref = syncBpm(d, s);
  const own = ds.track?.bpm;
  if (!ref || !own) return;
  const ratio = [ref, ref * 2, ref / 2].map((r) => r / own).reduce((a, b) => (Math.abs(b - 1) < Math.abs(a - 1) ? b : a));
  const pct = (ratio - 1) * 100;
  const range = Math.abs(pct) <= 8 ? ds.range : Math.abs(pct) <= 16 ? 16 : 0;
  if (range === 0) return;
  engine();
  djState.setDeck(d, { range, pitch: Math.max(-1, Math.min(1, pct / range)) });
}

/** La platine est-elle calee sur ce qu'on entend (au centieme de BPM) ? */
export function djSynced(d: DjDeck, s = djState.get()): boolean {
  const ref = syncBpm(d, s);
  const own = deckBpm(s, d);
  if (!ref || !own) return false;
  return [ref, ref * 2, ref / 2].some((r) => Math.abs(own - r) < 0.05);
}

/* ---------------- des platines en plus ---------------- */

/** ADD DECK : une platine de plus a droite (C, puis D), avec sa voie au MIXER. */
export function djAddDeck(): void {
  djDecks.set(djDecks.get() + 1);
}

/** REMOVE : la derniere platine ajoutee s'arrete, se vide et s'en va. */
export function djRemoveDeck(d: DjDeck): void {
  if (DJ_DECKS[DJ_DECKS.length - 1] !== d || DJ_DECKS.length <= 2) return;
  const p = djEngineIfAny()?.decks[d];
  if (p?.playing) p.pause();
  loads[d]?.abort();
  djState.setDeck(d, { playing: false, loaded: false, track: null, loading: null, error: null, cue: 0, cues: [null, null, null, null], pitch: 0, range: 8 });
  djDecks.set(djDecks.get() - 1);
}

/* ---------------- l'ecran : recherche, scrub, zoom ---------------- */

/** Aller a un instant de la piste (en lecture, elle continue de la). */
export function djSeek(d: DjDeck, seconds: number): void {
  const p = engine()?.decks[d];
  if (!p || !p.loaded) return;
  p.seek(seconds);
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

/** Un cran de zoom (DJ_ZOOMS) : -1 plus pres, +1 plus loin. */
export function djZoomStep(d: DjDeck, dir: -1 | 1): void {
  const z = djState.get().deck[d].zoom;
  const next = dir > 0 ? DJ_ZOOMS.find((v) => v > z + 1e-6) : [...DJ_ZOOMS].reverse().find((v) => v < z - 1e-6);
  if (next !== undefined) djZoom(d, next);
}
