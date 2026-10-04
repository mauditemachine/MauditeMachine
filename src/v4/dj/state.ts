/**
 * L'etat des commandes du MM-DECKS (2026-10-04) : ce que la scene montre
 * (angle des potards, place des faders, touches allumees) et ce que le
 * moteur audio applique. Un store fait main comme les autres (get, set,
 * subscribe), retenu dans le navigateur pour la table de mixage ; les
 * pitchs repartent de zero a chaque visite.
 *
 * Potards bipolaires (GAIN, EQ, FILTER) de -1 a 1, zero au centre ; effets
 * et MASTER de 0 a 1 ; faders de voie de 0 a 1 ; crossfader et pitch de
 * -1 a 1.
 */

import { DJ_FX, DJ_TIMES, type DjChannel, type DjDeck, type DjEqId, type DjFxId } from './theme';

export interface DjChannelState {
  gain: number;
  hi: number;
  mid: number;
  low: number;
  filter: number;
  fader: number;
}

/** Un morceau qu'on peut poser sur une platine : chez SoundCloud (ceux de Maudite Machine compris), ou un fichier de l'appareil. */
export interface DjTrack {
  id: string;
  source: 'file' | 'soundcloud';
  title: string;
  artist: string;
  bpm: number | null;
  /** tonalite en Camelot (9A), ou null */
  key: string | null;
  duration: number;
  /** la page du morceau (SoundCloud) */
  link?: string;
  /** SoundCloud : la licence Creative Commons (cc-by...) */
  license?: string;
  /** le fichier, pour une piste de l'appareil (jamais envoye nulle part) */
  file?: File;
  /** MY FILES : le dossier du morceau dans la caisse ('' : en vrac) */
  folder?: string;
  /** relie pour une visite passee : il faut glisser ou choisir le dossier de nouveau */
  relink?: boolean;
  /** le decodage a echoue : il ne se lit pas */
  unreadable?: boolean;
}

export interface DjDeckState {
  pitch: number;
  /** plage du pitch, en pour cent */
  range: number;
  playing: boolean;
  loaded: boolean;
  track: DjTrack | null;
  /** chargement en cours : part telechargee (0 a 1), ou null */
  loading: number | null;
  error: string | null;
  /** le point de CUE (secondes) */
  cue: number;
  /** hot cues poses (secondes, ou null) */
  cues: (number | null)[];
  /** la fenetre de la forme d'onde fine, en secondes (le zoom) */
  zoom: number;
}

/** Les crans du zoom de la forme d'onde fine (secondes a l'ecran), du plus pres au plus loin. */
export const DJ_ZOOMS = [2, 4, 8, 16, 32] as const;

export interface DjState {
  ch: [DjChannelState, DjChannelState, DjChannelState, DjChannelState];
  fx: Record<DjFxId, number>;
  time: number;
  master: number;
  xfader: number;
  deck: Record<DjDeck, DjDeckState>;
}

const KEY = 'mm.v4.dj.1';
const channel = (): DjChannelState => ({ gain: 0, hi: 0, mid: 0, low: 0, filter: 0, fader: 0.8 });
const deck = (): DjDeckState => ({ pitch: 0, range: 8, playing: false, loaded: false, track: null, loading: null, error: null, cue: 0, cues: [null, null, null, null], zoom: 8 });

function fresh(): DjState {
  return {
    ch: [channel(), channel(), channel(), channel()],
    fx: Object.fromEntries(DJ_FX.map((f) => [f, 0])) as Record<DjFxId, number>,
    time: 1,
    master: 0.88,
    xfader: 0,
    deck: { a: deck(), b: deck() },
  };
}

const clamp = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

/** La table retenue (les platines non : rien n'y est charge au retour). */
function load(): DjState {
  const s = fresh();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return s;
    const o = JSON.parse(raw) as Partial<DjState>;
    o.ch?.forEach((c, i) => {
      if (i > 3 || !c) return;
      const t = s.ch[i];
      t.gain = clamp(c.gain, -1, 1);
      t.hi = clamp(c.hi, -1, 1);
      t.mid = clamp(c.mid, -1, 1);
      t.low = clamp(c.low, -1, 1);
      t.filter = clamp(c.filter, -1, 1);
      t.fader = clamp(c.fader, 0, 1);
    });
    if (o.fx) for (const f of DJ_FX) s.fx[f] = clamp(o.fx[f] ?? 0, 0, 1);
    // DISTO est devenu OVERDRIVE (2026-10-04) : sa dose retenue suit
    const old = (o.fx as Record<string, number> | undefined)?.disto;
    if (typeof old === 'number' && o.fx && o.fx.overdrive === undefined) s.fx.overdrive = clamp(old, 0, 1);
    if (typeof o.time === 'number' && (DJ_TIMES as readonly number[]).includes(o.time)) s.time = o.time;
    if (typeof o.master === 'number') s.master = clamp(o.master, 0, 1);
    if (typeof o.xfader === 'number') s.xfader = clamp(o.xfader, -1, 1);
  } catch {
    /* rien de retenu : l'etat neuf */
  }
  return s;
}

let state: DjState = typeof window === 'undefined' ? fresh() : load();
let saveTimer = 0;
const listeners = new Set<() => void>();

function save(): void {
  if (typeof window === 'undefined') return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      const { ch, fx, time, master, xfader } = state;
      window.localStorage.setItem(KEY, JSON.stringify({ ch, fx, time, master, xfader }));
    } catch {
      /* stockage plein ou refuse : l'etat vit pour la visite */
    }
  }, 300);
}

function emit(): void {
  save();
  listeners.forEach((fn) => fn());
}

export const djState = {
  get: (): DjState => state,
  /** Un potard ou le fader d'une voie. */
  setChannel(i: DjChannel, id: DjEqId | 'fader', v: number): void {
    const lo = id === 'fader' ? 0 : -1;
    const next = clamp(v, lo, 1);
    if (state.ch[i][id] === next) return;
    const ch = state.ch.slice() as DjState['ch'];
    ch[i] = { ...ch[i], [id]: next };
    state = { ...state, ch };
    emit();
  },
  setFx(id: DjFxId, v: number): void {
    const next = clamp(v, 0, 1);
    if (state.fx[id] === next) return;
    state = { ...state, fx: { ...state.fx, [id]: next } };
    emit();
  },
  setTime(d: number): void {
    if (state.time === d) return;
    state = { ...state, time: d };
    emit();
  },
  setMaster(v: number): void {
    const next = clamp(v, 0, 1);
    if (state.master === next) return;
    state = { ...state, master: next };
    emit();
  },
  setXfader(v: number): void {
    const next = clamp(v, -1, 1);
    if (state.xfader === next) return;
    state = { ...state, xfader: next };
    emit();
  },
  setDeck(d: DjDeck, patch: Partial<DjDeckState>): void {
    const cur = state.deck[d];
    const next = { ...cur, ...patch };
    if (patch.pitch !== undefined) next.pitch = clamp(patch.pitch, -1, 1);
    state = { ...state, deck: { ...state.deck, [d]: next } };
    emit();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
