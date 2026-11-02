/**
 * Flux SoundCloud par platine du MM-DECKS (2026-11-02, Mika : "tracks et
 * mixtape devrait jouer directement dans mixer avec des decks") : chaque
 * platine pilote son propre widget SoundCloud officiel (w.soundcloud.com/player/api.js)
 * pour lire en entier les morceaux de TRACKS et les mixtapes de MIXTAPES sans
 * dependre de la cle OAuth du Worker.
 *
 * Les formes d'onde (overview, detail et les trois bandes basses / mediums /
 * aigus) sont calees sur le BPM et la grille des temps du morceau ; le volume
 * du widget suit en direct le gain, l'isolateur 3 bandes, le filtre, le fader
 * de la voie et le MASTER de la table (muet sous ?mute=1).
 */

import { FLAGS } from '../state/flags';
import type { DjDeck } from './theme';

const SC_API_URL = 'https://w.soundcloud.com/player/api.js';
const OVERVIEW_SLICES = 1024;
const DETAIL_RATE = 400;
/** Plafond de tranches fines par texture (24 lignes de 4096 = 245 s a 400 Hz, bouclees au-dela pour les mixtapes d'1h30). */
const MAX_DETAIL_SLICES = 4096 * 24;

interface ScWidget {
  load: (url: string, opts?: Record<string, unknown>) => void;
  play: () => void;
  pause: () => void;
  seekTo: (ms: number) => void;
  setVolume: (vol: number) => void;
  getDuration: (cb: (ms: number) => void) => void;
  bind: (event: string, cb: (data?: { currentPosition?: number }) => void) => void;
}

interface ScGlobal {
  Widget: ((iframe: HTMLIFrameElement) => ScWidget) & {
    Events: {
      READY: string;
      PLAY: string;
      PAUSE: string;
      FINISH: string;
      PLAY_PROGRESS: string;
      ERROR: string;
    };
  };
}

function getSC(): ScGlobal | undefined {
  return (window as unknown as { SC?: ScGlobal }).SC;
}

let apiPromise: Promise<ScGlobal> | null = null;

function ensureScApi(): Promise<ScGlobal> {
  const existing = getSC();
  if (existing?.Widget) return Promise.resolve(existing);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<ScGlobal>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SC_API_URL;
    script.async = true;
    script.onload = () => {
      const sc = getSC();
      if (sc?.Widget) resolve(sc);
      else {
        apiPromise = null;
        reject(new Error('SC.Widget missing'));
      }
    };
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('SC script failed'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Hachage deterministe 32 bits d'une chaine (graine du relief d'un morceau). */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

/** Generateur pseudo-aleatoire rapide (xorshift32, 0 a 1). */
function makeRng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

export interface StreamPeaks {
  overview: Float32Array;
  detail: Float32Array;
  bands: {
    overview: Float32Array;
    detail: Float32Array;
  };
}

/**
 * Construit les formes d'onde (piste entiere, detail a 400 Hz et 3 bandes
 * basses / mediums / aigus) calees sur la grille des temps (spb = 60 / bpm)
 * pour un morceau ou une mixtape.
 */
export function buildStreamPeaks(seedKey: string, duration: number, bpm: number): StreamPeaks {
  const dur = Math.max(30, duration || 360);
  const tempo = bpm > 0 ? bpm : 124;
  const spb = 60 / tempo;
  const rng = makeRng(hashSeed(seedKey));

  // Enveloppe macro de l'arrangement (64 paliers : intro, montees, drops, breaks, outro)
  const sections = 64;
  const macro = new Float32Array(sections);
  for (let i = 0; i < sections; i += 1) {
    const pos = i / (sections - 1);
    const introOutro = pos < 0.06 ? 0.38 + (pos / 0.06) * 0.52 : pos > 0.92 ? 0.9 - ((pos - 0.92) / 0.08) * 0.65 : 1;
    const isBreak = (pos > 0.34 && pos < 0.44) || (pos > 0.68 && pos < 0.76);
    const body = isBreak ? 0.42 + rng() * 0.18 : 0.78 + rng() * 0.22;
    macro[i] = Math.min(1, Math.max(0.18, introOutro * body));
  }

  const macroAt = (u: number): number => {
    const x = Math.max(0, Math.min(1, u)) * (sections - 1);
    const i = Math.min(sections - 2, Math.floor(x));
    const f = x - i;
    return macro[i] * (1 - f) + macro[i + 1] * f;
  };

  const overview = new Float32Array(OVERVIEW_SLICES);
  const ovBands = new Float32Array(OVERVIEW_SLICES * 3);
  for (let i = 0; i < OVERVIEW_SLICES; i += 1) {
    const u = i / OVERVIEW_SLICES;
    const env = macroAt(u);
    const pulse = 0.82 + 0.18 * Math.sin(i * 0.37);
    const r = rng();
    const low = Math.min(1, env * pulse * (0.76 + r * 0.24));
    const mid = Math.min(1, env * (0.62 + rng() * 0.32));
    const hi = Math.min(1, env * (0.45 + rng() * 0.45));
    ovBands[i * 3] = low;
    ovBands[i * 3 + 1] = mid;
    ovBands[i * 3 + 2] = hi;
    overview[i] = Math.min(1, Math.max(low * 0.95, mid * 0.85, hi * 0.75));
  }

  // Detail a 400 tranches par seconde, aligne sur un nombre entier de mesures (16 temps) pour boucler sans couture
  const barSec = spb * 16;
  const maxBars = Math.max(4, Math.floor(MAX_DETAIL_SLICES / DETAIL_RATE / barSec));
  const detailDur = Math.min(dur, maxBars * barSec);
  const detailLen = Math.max(DETAIL_RATE, Math.min(MAX_DETAIL_SLICES, Math.floor(detailDur * DETAIL_RATE)));
  const detail = new Float32Array(detailLen);
  const detBands = new Float32Array(detailLen * 3);

  for (let i = 0; i < detailLen; i += 1) {
    const t = i / DETAIL_RATE;
    const u = t / detailDur;
    const env = macroAt(u);
    const beatPos = (t / spb) % 1;
    const barBeat = Math.floor(t / spb) % 4;
    // Kick franc sur chaque temps, basse sur le contretemps
    const kick = Math.exp(-beatPos * 9.5);
    const sub = beatPos > 0.42 && beatPos < 0.88 ? Math.sin(((beatPos - 0.42) / 0.46) * Math.PI) * 0.68 : 0;
    // Clap / snare sur les temps 2 et 4 (barBeat 1 et 3), synth stab sur les doubles croches
    const snare = (barBeat === 1 || barBeat === 3) ? Math.exp(-beatPos * 12) * 0.85 : 0;
    const sixteenth = (beatPos * 4) % 1;
    const synth = Math.exp(-sixteenth * 4.5) * (0.48 + 0.25 * Math.sin(t * 3.2));
    // Charley ouvert sur le demi-temps, ferme sur les doubles croches
    const offHat = beatPos >= 0.48 && beatPos < 0.92 ? Math.exp(-(beatPos - 0.48) * 7) * 0.82 : 0;
    const closedHat = Math.exp(-sixteenth * 14) * 0.48;
    const jitter = 0.9 + rng() * 0.1;

    const low = Math.min(1, env * Math.max(kick, sub) * jitter);
    const mid = Math.min(1, env * Math.max(snare, synth) * jitter);
    const hi = Math.min(1, env * Math.max(offHat, closedHat) * jitter);

    detBands[i * 3] = low;
    detBands[i * 3 + 1] = mid;
    detBands[i * 3 + 2] = hi;
    detail[i] = Math.min(1, Math.max(low * 0.96, mid * 0.86, hi * 0.72));
  }

  return {
    overview,
    detail,
    bands: { overview: ovBands, detail: detBands },
  };
}

/**
 * Controleur du widget SoundCloud d'une platine (un iframe cache par platine).
 * Sous ?mute=1 (tests et revue sans son), aucun iframe externe n'est cree.
 */
export class DeckScController {
  private iframe: HTMLIFrameElement | null = null;
  private widget: ScWidget | null = null;
  private ready = false;
  private currentUrl: string | null = null;
  private wantPlay = false;
  private wantPos = 0;
  private wantVol = 80;
  private onDurationCb: ((durSec: number) => void) | null = null;
  private onEndCb: (() => void) | null = null;

  constructor(private readonly deck: DjDeck) {}

  private ensureWidget(): Promise<ScWidget> | null {
    if (FLAGS.mute || typeof document === 'undefined') return null;
    if (this.widget && this.ready) return Promise.resolve(this.widget);
    return ensureScApi().then((SC) => {
      if (this.widget && this.ready) return this.widget;
      return new Promise<ScWidget>((resolve) => {
        if (!this.iframe) {
          const el = document.createElement('iframe');
          el.id = `mm-dj-sc-${this.deck}`;
          el.title = `SoundCloud Deck ${this.deck.toUpperCase()}`;
          el.allow = 'autoplay';
          el.setAttribute('aria-hidden', 'true');
          el.tabIndex = -1;
          el.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;bottom:0;opacity:0;pointer-events:none;border:0;';
          const initial = this.currentUrl || 'https://soundcloud.com/mauditemachine/voodoo';
          el.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(initial)}&auto_play=false&visual=false&show_artwork=false&download=false&sharing=false`;
          document.body.appendChild(el);
          this.iframe = el;
        }
        const w = SC.Widget(this.iframe);
        this.widget = w;
        const E = SC.Widget.Events;
        w.bind(E.READY, () => {
          this.ready = true;
          w.setVolume(FLAGS.mute ? 0 : this.wantVol);
          this.queryDuration();
          resolve(w);
        });
        w.bind(E.PLAY, () => {
          w.setVolume(FLAGS.mute ? 0 : this.wantVol);
          this.queryDuration();
          if (!this.wantPlay) w.pause();
        });
        w.bind(E.FINISH, () => {
          this.wantPlay = false;
          this.onEndCb?.();
        });
      });
    });
  }

  private queryDuration(): void {
    const w = this.widget;
    if (!w || !this.ready) return;
    try {
      w.getDuration((ms) => {
        if (ms > 0) this.onDurationCb?.(ms / 1000);
      });
    } catch {
      /* ignore */
    }
  }

  load(url: string, onDuration: (durSec: number) => void, onEnd: () => void): void {
    this.onDurationCb = onDuration;
    this.onEndCb = onEnd;
    this.wantPlay = false;
    this.wantPos = 0;
    const same = this.currentUrl === url;
    this.currentUrl = url;
    if (FLAGS.mute || typeof document === 'undefined') return;
    void this.ensureWidget()?.then((w) => {
      if (this.currentUrl !== url) return;
      if (same) {
        w.pause();
        w.seekTo(0);
        this.queryDuration();
        return;
      }
      w.load(url, {
        auto_play: this.wantPlay,
        visual: false,
        show_artwork: false,
        download: false,
        sharing: false,
        buying: false,
        liking: false,
        show_comments: false,
        show_playcount: false,
        show_user: false,
        callback: () => {
          w.setVolume(FLAGS.mute ? 0 : this.wantVol);
          this.queryDuration();
          if (this.wantPos > 0.2) w.seekTo(this.wantPos * 1000);
          if (this.wantPlay) w.play();
          else w.pause();
        },
      });
    }).catch(() => undefined);
  }

  play(posSec: number, vol0to100: number): void {
    this.wantPlay = true;
    this.wantPos = Math.max(0, posSec);
    this.wantVol = FLAGS.mute ? 0 : Math.max(0, Math.min(100, Math.round(vol0to100)));
    if (FLAGS.mute || typeof document === 'undefined') return;
    void this.ensureWidget()?.then((w) => {
      if (!this.wantPlay) return;
      w.setVolume(this.wantVol);
      if (this.wantPos > 0.2) w.seekTo(this.wantPos * 1000);
      w.play();
    }).catch(() => undefined);
  }

  pause(): void {
    this.wantPlay = false;
    if (!this.widget || !this.ready) return;
    try {
      this.widget.pause();
    } catch {
      /* ignore */
    }
  }

  seek(posSec: number): void {
    this.wantPos = Math.max(0, posSec);
    if (!this.widget || !this.ready) return;
    try {
      this.widget.seekTo(this.wantPos * 1000);
    } catch {
      /* ignore */
    }
  }

  setVolume(vol0to100: number): void {
    this.wantVol = FLAGS.mute ? 0 : Math.max(0, Math.min(100, Math.round(vol0to100)));
    if (!this.widget || !this.ready) return;
    try {
      this.widget.setVolume(this.wantVol);
    } catch {
      /* ignore */
    }
  }

  unload(): void {
    this.wantPlay = false;
    this.wantPos = 0;
    this.onDurationCb = null;
    this.onEndCb = null;
    this.pause();
  }
}

const controllers: Partial<Record<DjDeck, DeckScController>> = {};

export function deckScController(deck: DjDeck): DeckScController {
  return (controllers[deck] ??= new DeckScController(deck));
}
