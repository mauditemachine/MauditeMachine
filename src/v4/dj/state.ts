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
  /** l'etape du chargement montree a l'ecran (lecture du fichier ou flux, decodage, BPM et grille), ou null */
  loadStep: 'read' | 'decode' | 'analyse' | null;
  /**
   * PLAY presse pendant le chargement (2026-10-08, Mika : "quand on lance une
   * track sur le deck de gauche puis celui de droite, le droit demarre pas
   * quand on clic sur play") : la platine partira des qu'elle est prete
   */
  armed: boolean;
  error: string | null;
  /** le point de CUE (secondes) */
  cue: number;
  /** hot cues poses (secondes, ou null) */
  cues: (number | null)[];
  /** la fenetre de la forme d'onde fine, en secondes (le zoom) */
  zoom: number;
  /** le premier temps du morceau (secondes, dj/math.ts trackGridSteps), ou null sans grille */
  beat: number | null;
  /**
   * SYNC arme : le tempo est cale ; tant que personne ne touche au pitch,
   * PLAY part sur un temps de la reference et un hot cue garde la phase
   */
  sync: boolean;
  /** LOOP : la longueur de la boucle en temps (1, 2, 4, 8), ou null (ses bornes sont dans le lecteur) */
  loop: number | null;
  /** REMOVE arme : la platine joue, un deuxieme appui la retire (dj/actions.ts djRemoveDeck) */
  remove: boolean;
}

/** Les crans du zoom de la forme d'onde fine (secondes a l'ecran), du plus pres au plus loin. */
export const DJ_ZOOMS = [2, 4, 8, 16, 32] as const;

/**
 * L'affichage des formes d'onde (2026-10-04, Mika : "on a du mal a voir les
 * choses, ya pas un autre affichage ?"), pour toutes les platines, comme le
 * reglage d'une CDJ :
 * - 3BAND : basses en bleu, mediums en ambre, aigus en blanc, superposes ;
 * - RGB : la silhouette des trois bandes, teintee par leur melange (rouge
 *   les basses, vert les mediums, bleu les aigus) ;
 * - MONO : l'energie seule, en os (l'affichage d'avant) ;
 * - WARM (2026-10-05, Mika : "des couleurs plus chaudes, genre jaune et
 *   orange ; les autres modes j'aime ca, mais avoir un truc mieux") : les
 *   trois bandes aux couleurs de la marque, basses orange profond, mediums
 *   or, aigus jaune pale, le coeur plus lumineux ; l'affichage de depart.
 */
export const DJ_WAVES = ['warm', '3band', 'rgb', 'mono'] as const;
export type DjWaveMode = (typeof DJ_WAVES)[number];
export const DJ_WAVE_LABEL: Readonly<Record<DjWaveMode, string>> = { warm: 'WARM', '3band': '3BAND', rgb: 'RGB', mono: 'MONO' };

export interface DjState {
  /** sept voies : 1 MM-RYTM, 2 MM-BASS, 3 MM-ARP, 4 a 7 les platines A a D (C et D seulement si posees) */
  ch: DjChannelState[];
  fx: Record<DjFxId, number>;
  time: number;
  master: number;
  /**
   * FX TO (2026-10-04, Mika : "assigner avec un knob les FX vers une piste,
   * un knob qui selectionne la piste de destination ou alors toutes les
   * pistes") : -1 toutes les voies, sinon la voie (0 : 1 MM-RYTM, 1 : 2
   * MM-BASS, 2 : 3 MM-ARP, 3 a 6 : les platines A a D). Retenu.
   */
  fxTo: number;
  /** l'affichage des formes d'onde, retenu */
  wave: DjWaveMode;
  deck: Record<DjDeck, DjDeckState>;
}

/**
 * La table a quatre voies depuis le 2026-10-04 : 1 MM-RYTM, 2 MM-ARP, 3 et 4
 * les platines ; cinq depuis le 2026-10-07 : 1 MM-RYTM, 2 MM-BASS, 3 MM-ARP,
 * 4 et 5 les platines. Nouvelle cle a chaque fois : l'ancienne est lue une
 * fois et ses voies passent a leur nouvelle place (SLOT).
 */
const KEY = 'mm.v4.dj.3';
const OLD_KEYS = ['mm.v4.dj.2', 'mm.v4.dj.1'] as const;
/** La place d'une voie d'une table d'avant : mm.v4.dj.2 (RYTM, ARP, platines), mm.v4.dj.1 (deux platines). */
const SLOT: Readonly<Record<(typeof OLD_KEYS)[number], (i: number) => number>> = {
  'mm.v4.dj.2': (i) => (i === 0 ? 0 : i === 1 ? 2 : i + 1),
  'mm.v4.dj.1': (i) => i + 3,
};
/** Les machines : fader en haut, le son du site ne change pas ; les platines : 0.8, comme une table. */
const channel = (fader = 0.8): DjChannelState => ({ gain: 0, hi: 0, mid: 0, low: 0, filter: 0, fader });
const deck = (): DjDeckState => ({ pitch: 0, range: 8, playing: false, loaded: false, track: null, loading: null, loadStep: null, armed: false, error: null, cue: 0, cues: [null, null, null, null], zoom: 8, beat: null, sync: false, loop: null, remove: false });

function fresh(): DjState {
  return {
    ch: [channel(1), channel(1), channel(1), channel(), channel(), channel(), channel()],
    fx: Object.fromEntries(DJ_FX.map((f) => [f, 0])) as Record<DjFxId, number>,
    time: 1,
    master: 0.88,
    fxTo: -1,
    wave: 'warm',
    deck: { a: deck(), b: deck(), c: deck(), d: deck() },
  };
}

const clamp = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

/** La table retenue (les platines non : rien n'y est charge au retour). */
function load(): DjState {
  const s = fresh();
  try {
    const raw = window.localStorage.getItem(KEY);
    const old = raw ? undefined : OLD_KEYS.find((k) => window.localStorage.getItem(k) !== null);
    const text = raw ?? (old ? window.localStorage.getItem(old) : null);
    if (!text) return s;
    const o = JSON.parse(text) as Partial<DjState>;
    // Une table d'avant : chaque voie a sa nouvelle place (le MM-BASS arrive en 2, ses reglages de depart)
    const slot = (i: number): number => (old ? SLOT[old](i) : i);
    o.ch?.forEach((c, i) => {
      if (slot(i) > 6 || !c) return;
      const t = s.ch[slot(i)];
      t.gain = clamp(c.gain, -1, 1);
      t.hi = clamp(c.hi, -1, 1);
      t.mid = clamp(c.mid, -1, 1);
      t.low = clamp(c.low, -1, 1);
      t.filter = clamp(c.filter, -1, 1);
      t.fader = clamp(c.fader, 0, 1);
    });
    if (o.fx) for (const f of DJ_FX) s.fx[f] = clamp(o.fx[f] ?? 0, 0, 1);
    // DISTO est devenu OVERDRIVE (2026-10-04) : sa dose retenue suit
    const disto = (o.fx as Record<string, number> | undefined)?.disto;
    if (typeof disto === 'number' && o.fx && o.fx.overdrive === undefined) s.fx.overdrive = clamp(disto, 0, 1);
    if (typeof o.time === 'number' && (DJ_TIMES as readonly number[]).includes(o.time)) s.time = o.time;
    if (typeof o.master === 'number') s.master = clamp(o.master, 0, 1);
    if (typeof o.fxTo === 'number' && Number.isInteger(o.fxTo)) s.fxTo = o.fxTo < 0 ? -1 : clamp(slot(o.fxTo), 0, 6);
    // WARM arrive (2026-10-05) : le 3BAND retenu etait l'affichage de depart, il passe a WARM ; RGB ou MONO choisis restent
    const w = (o as { waveMode?: unknown }).waveMode ?? (o.wave === 'rgb' || o.wave === 'mono' ? o.wave : undefined);
    if (typeof w === 'string' && (DJ_WAVES as readonly string[]).includes(w)) s.wave = w as DjWaveMode;
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
      const { ch, fx, time, master, fxTo, wave } = state;
      window.localStorage.setItem(KEY, JSON.stringify({ ch, fx, time, master, fxTo, waveMode: wave }));
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
    const ch = state.ch.slice();
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
  /** FX TO : -1 toutes les voies, sinon une voie (0 a 6). */
  setFxTo(t: number): void {
    const next = Math.round(clamp(t, -1, 6));
    if (state.fxTo === next) return;
    state = { ...state, fxTo: next };
    emit();
  },
  setWave(w: DjWaveMode): void {
    if (state.wave === w) return;
    state = { ...state, wave: w };
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
