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

import { focusMachine } from '../actions';
import { clock } from '../audio/clock';
import { smplLoad } from '../state/smplload';
import { routeMachines } from '../audio/drums';
import { sc } from '../audio/soundcloud';
import { djEngine, djEngineIfAny, type DjEngine } from './engine';
import { crateFile, crateLearn, setCrateBusy } from './crate';
import { beatGrid, estimateBpm, phaseShift } from './math';
import { soundcloudBytes } from './soundcloud';
import { DJ_WAVES, DJ_ZOOMS, djState, type DjTrack } from './state';
import { DJ_CHANNELS, DJ_DECKS, DJ_DECKS_ALL, DJ_FX, deckChannel, djDecks, type DjChannel, type DjDeck, type DjEqId, type DjFxId } from './theme';

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

/**
 * La table en vue (2026-10-04, Mika : "quand on joue sur les machines MM et
 * qu'on arrive sur le mixer, on ne voit pas les pistes jouer sur 1 et 2") :
 * le moteur se cree des que le son existe, sans attendre un geste sur la
 * table ; le MM-RYTM et le MM-ARP passent alors par les voies 1 et 2 et
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
 */
export async function djLoad(d: DjDeck, track: DjTrack): Promise<void> {
  const e = engine();
  if (!e) return;
  loads[d]?.abort();
  const ctl = new AbortController();
  loads[d] = ctl;
  djState.setDeck(d, { playing: false, loaded: false, track, loading: 0, error: null, beat: null, sync: false, loop: null });
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
    // La grille des temps (SYNC cale aussi les temps) : le premier temps, et le BPM affine au centieme
    const grid = ch0 ? beatGrid(ch0, p.sampleRate, bpm) : null;
    if (grid) bpm = grid.bpm;
    const { cue, cues } = savedCues(track.id);
    djState.setDeck(d, { loaded: true, loading: null, track: { ...track, bpm, duration: p.duration }, cue, cues, beat: grid?.offset ?? null, sync: false });
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
  p.play(syncedStart(d, e));
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
  if (p.playing) {
    p.seek(at);
    loopFollows(d, e);
    // SYNC arme : le saut garde la phase (au plus un demi-temps de decalage)
    if (ds.sync) alignNow(d, e);
    return;
  }
  p.seek(at);
  loopFollows(d, e);
  silenceOthers();
  p.play(syncedStart(d, e));
  djState.setDeck(d, { playing: p.playing });
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

/** La voie des effets (FX TO) parmi celles posees : -1 toutes. */
export const fxTarget = (s = djState.get()): number => (s.fxTo >= DJ_CHANNELS ? -1 : s.fxTo);

/** Les noms des voies, comme sur la table : 1 RYTM, 2 ARP, 3 A... */
const FX_TO_NAMES = ['RYTM', 'ARP', 'A', 'B', 'C', 'D'] as const;

/** FX TO en mots : ALL, ou le numero et le nom de la voie (2 ARP). */
export const fxToText = (t = fxTarget()): string => (t < 0 ? 'ALL' : `${t + 1} ${FX_TO_NAMES[t]}`);

/** FX TO en position de potard (0 a 1, DJ_CHANNELS + 1 crans : ALL puis les voies). */
export const fxToValue = (t = fxTarget()): number => (t + 1) / DJ_CHANNELS;
export const fxToOfValue = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * DJ_CHANNELS) - 1;

/** FX TO : -1 toutes les voies, sinon une voie (0 a 5) ; au-dela des voies posees : toutes. */
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

/** Le pitch a la main (fader, molette, PITCH - et +) : SYNC se desarme. */
export function djSetPitch(d: DjDeck, v: number): void {
  engine();
  // Au centieme de pour cent (2026-10-05) : la valeur lue a l'ecran est celle qui joue
  const r = djState.get().deck[d].range || 8;
  djState.setDeck(d, { pitch: Math.round(v * r * 100) / (r * 100), sync: false });
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

/** La platine qu'on entend le plus parmi les autres (celle sur laquelle on se cale), ou null. */
function syncDeck(d: DjDeck, s = djState.get()): DjDeck | null {
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
 * Le tempo de reference pour SYNC : la platine qu'on entend le plus parmi
 * les autres, sinon le MM-RYTM et le MM-ARP s'ils tournent ; null s'il n'y a
 * rien sur quoi se caler.
 */
export function syncBpm(d: DjDeck, s = djState.get()): number | null {
  const r = syncDeck(d, s);
  if (r) return deckBpm(s, r);
  return clock.running ? clock.bpm : null;
}

/**
 * Le prochain temps d'une platine, en temps reel : dans combien de
 * secondes il tombe (si elle part maintenant, quand elle est en pause) et
 * la periode. null sans grille.
 */
function deckBeat(d: DjDeck, e: DjEngine, s = djState.get()): { in: number; period: number } | null {
  const ds = s.deck[d];
  const p = e.decks[d];
  if (ds.beat === null || !ds.track?.bpm || !p.loaded) return null;
  const spb = 60 / ds.track.bpm;
  const speed = p.speed;
  const beats = (p.position() - ds.beat) / spb;
  return { in: ((1 - (beats - Math.floor(beats))) * spb) / speed, period: spb / speed };
}

/** Le prochain temps de la reference (une platine, ou les machines du site), en temps reel. */
function refBeat(d: DjDeck, e: DjEngine, s = djState.get()): { in: number; period: number } | null {
  const r = syncDeck(d, s);
  if (r) return deckBeat(r, e, s);
  if (!clock.running) return null;
  // Les machines : seize pas par mesure, un temps tous les quatre
  const now = e.ctx.currentTime;
  const g = clock.gridAfter(now);
  if (!g) return null;
  const k = (4 - (g.step % 4)) % 4;
  return { in: g.time + k * g.dur - now, period: 4 * g.dur };
}

/** En lecture : la platine saute d'au plus un demi-temps, ses temps tombent sur ceux de la reference. */
function alignNow(d: DjDeck, e: DjEngine): void {
  const own = deckBeat(d, e);
  const ref = refBeat(d, e);
  const p = e.decks[d];
  if (!own || !ref || !p.playing) return;
  const shift = phaseShift(own.in, own.period, ref.in, ref.period);
  if (Math.abs(shift) < 0.002) return;
  p.seek(p.position() + shift * p.speed);
  loopFollows(d, e);
}

/**
 * En pause, SYNC arme : l'instant ou partir pour que le prochain temps de
 * la platine tombe sur un temps de la reference (au plus une periode
 * d'attente) ; 0 (tout de suite) sans SYNC ou sans reference.
 */
function syncedStart(d: DjDeck, e: DjEngine): number {
  if (!djState.get().deck[d].sync) return 0;
  const own = deckBeat(d, e);
  const ref = refBeat(d, e);
  if (!own || !ref) return 0;
  const now = e.ctx.currentTime;
  let at = now + ref.in - own.in;
  while (at < now + 0.01) at += ref.period;
  return at;
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
  const s = djState.get();
  const ds = s.deck[d];
  const ref = syncBpm(d, s);
  const own = ds.track?.bpm;
  if (!ref || !own) return;
  const ratio = [ref, ref * 2, ref / 2].map((r) => r / own).reduce((a, b) => (Math.abs(b - 1) < Math.abs(a - 1) ? b : a));
  const pct = (ratio - 1) * 100;
  const range = Math.abs(pct) <= 8 ? ds.range : Math.abs(pct) <= 16 ? 16 : 0;
  if (range === 0) return;
  const e = engine();
  djState.setDeck(d, { range, pitch: Math.max(-1, Math.min(1, pct / range)), sync: true });
  if (e && e.decks[d].playing) alignNow(d, e);
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
  const a = deckBeat(d, e, s);
  const b = refBeat(d, e, s);
  if (!a || !b) return true;
  return Math.abs(phaseShift(a.in, a.period, b.in, b.period)) < 0.02;
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
/** La derniere platine ou une boucle a ete posee (LOOP > SMPL la prend d'abord). */
let lastLoopDeck: DjDeck | null = null;

export function djLoop(d: DjDeck, beats: number): void {
  const e = engine();
  const p = e?.decks[d];
  if (!e || !p || !p.loaded) return;
  lastLoopDeck = d;
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

/**
 * LOOP > SMPL (2026-10-05, Mika : "quand je fais une loop dans un DECK, un
 * bouton Exporter situe sur le MIXER vers SMPL, et la je peux editer mon
 * sample") : la boucle de la derniere platine bouclee (sinon d'une autre qui
 * boucle, sinon la fenetre de celle qu'on entend, sinon de la premiere
 * chargee) part dans le MM-SMPL, qui vient devant pour l'editer (son
 * ecran dit ce qu'il a pris, ou qu'il n'y a rien a prendre).
 */
export function djExportDeck(): DjDeck {
  const e = djEngineIfAny();
  const s = djState.get();
  const looping = (d: DjDeck): boolean => !!e?.decks[d].loop;
  if (lastLoopDeck && DJ_DECKS.includes(lastLoopDeck) && looping(lastLoopDeck)) return lastLoopDeck;
  const loop = DJ_DECKS.find(looping);
  if (loop) return loop;
  let best: DjDeck | null = null;
  let w = 0;
  for (const d of DJ_DECKS) {
    const k = heardWeight(s, d) || (s.deck[d].playing ? 0.01 : 0);
    if (k > w) {
      w = k;
      best = d;
    }
  }
  return best ?? DJ_DECKS.find((d) => s.deck[d].loaded) ?? 'a';
}

export async function djExportToSmpl(): Promise<void> {
  const d = djExportDeck();
  focusMachine('smpl');
  const m = await smplLoad.load();
  m?.smplGrab(d);
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
  djState.setDeck(d, { playing: false, loaded: false, track: null, loading: null, error: null, cue: 0, cues: [null, null, null, null], pitch: 0, range: 8, remove: false });
  djDecks.set(djDecks.get() - 1);
  // FX TO visait la voie retiree : les effets reviennent sur toutes
  if (djState.get().fxTo >= DJ_CHANNELS) djState.setFxTo(-1);
}

/* ---------------- l'ecran : recherche, scrub, zoom ---------------- */

/** Aller a un instant de la piste (en lecture, elle continue de la). */
export function djSeek(d: DjDeck, seconds: number): void {
  const e = engine();
  const p = e?.decks[d];
  if (!e || !p || !p.loaded) return;
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
