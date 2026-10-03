/**
 * Pont SoundCloud de /v4, miroir de src/v3/state/bridge.ts : un etat plat
 * que React ecrit dans UN effet (EngineBridge, engine.ts) et que l'ecran,
 * les listes et la scene lisent sans render par tick du widget.
 *
 * Le moteur est celui de la v2 (AudioPlayerProvider, reutilise tel quel
 * comme sur /v3) : il pilote src/utils/scWidget.ts, inchange. scPlay part
 * au premier clic sur une ligne (l'iframe cachee du widget nait la, jamais
 * avant : le provider ne cree qu'un <audio> hors DOM), setScHandlers relie
 * play / pause / progress / finish / error au provider, le playGen du
 * widget annule un play encore en chargement quand un autre arrive, une
 * erreur donne un notice (titre saute, 4 s) et la file passe a la suivante.
 *
 * Ici, les regles de la machine (spec 8.4) :
 * - une piste qui demarre (playing false -> true) met la boite a rythmes en
 *   STOP ; une piste qui s'arrete ne relance rien ;
 * - RUN pendant qu'une piste joue la met d'abord en pause (actions.ts) ;
 * - LOADING tant que le son n'est pas la, 8 s au plus, puis NO SIGNAL sur
 *   l'ecran (4 s). Chaque demande porte un numero (playGen, comme le
 *   widget) : une demande plus recente annule l'echeance de la precedente.
 * La position (s) vit hors du store : l'ecran la lit a 4 Hz.
 */

import { scPreload } from '../../utils/scWidget';
import { isPlayable, type V2Track } from '../../v2/context/AudioPlayerContext';
import { FLAGS } from '../state/flags';
import { lcdMessage } from '../state/lcdMessage';
import { LCD_TEXT } from '../theme';
import { arp } from '../voyager/arp';
import { clock } from './clock';

export type ScStatus = 'idle' | 'loading' | 'playing' | 'paused';

/** Ce que lisent l'ecran et les listes ; remplace seulement quand il change. */
export interface ScState {
  status: ScStatus;
  id: string | null;
  title: string | null;
  /** duree de la piste en s, 0 tant qu'inconnue */
  duration: number;
  /** titre saute (lien mort) pendant 4 s, sinon null */
  notice: string | null;
}

/** Le moteur tel que React le voit (useEngine). */
export interface EngineSnapshot {
  current: V2Track | null;
  playing: boolean;
  /** 0 a 1 */
  progress: number;
  /** s */
  duration: number;
  notice: string | null;
}

export interface EngineHandle {
  play: (track: V2Track, queue?: V2Track[]) => void;
  toggle: () => void;
  /** position 0 a 1 dans la piste courante */
  seek: (ratio: number) => void;
}

const IDLE: EngineSnapshot = { current: null, playing: false, progress: 0, duration: 0, notice: null };

let engine: EngineHandle | null = null;
/** revue (scDebug.simulate) : un moteur factice remplace le vrai, rien ne sort */
let simEngine: EngineHandle | null = null;
let snap: EngineSnapshot = IDLE;
let state: ScState = { status: 'idle', id: null, title: null, duration: 0, notice: null };
let pending = false;
let playGen = 0;
let pendingTimer = 0;
const counters = { requests: 0, starts: 0, autoStops: 0, runPauses: 0, noSignal: 0 };
const listeners = new Set<() => void>();

function derive(): void {
  const cur = snap.current;
  const status: ScStatus = pending ? 'loading' : cur ? (snap.playing ? 'playing' : 'paused') : 'idle';
  const next: ScState = {
    status,
    id: cur?.id ?? null,
    title: cur?.title ?? null,
    duration: snap.duration,
    notice: snap.notice,
  };
  if (
    next.status === state.status &&
    next.id === state.id &&
    next.title === state.title &&
    next.duration === state.duration &&
    next.notice === state.notice
  ) {
    return;
  }
  state = next;
  listeners.forEach((fn) => fn());
}

/** LOADING : 8 s au plus. Le numero de la demande annule les echeances plus anciennes. */
function setPending(v: boolean): void {
  window.clearTimeout(pendingTimer);
  pendingTimer = 0;
  pending = v;
  playGen += 1;
  if (!v) return;
  const gen = playGen;
  pendingTimer = window.setTimeout(() => {
    pendingTimer = 0;
    if (gen !== playGen || !pending) return;
    pending = false;
    counters.noSignal += 1;
    lcdMessage.show(LCD_TEXT.noSignal, LCD_TEXT.noSignalMs);
    derive();
  }, LCD_TEXT.pendingMs);
}

/** Le widget a deja ete prechauffe (une fois par page). */
let warmed = false;

export const sc = {
  get: (): ScState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /**
   * Liste TRACKS ou MIXTAPES ouverte : le widget SoundCloud se cree
   * d'avance, sans jouer (scPreload), pour que le premier clic parte dans
   * le geste. Rien avec le moteur factice (?v4mock) ni une fois cree.
   */
  warm(track: V2Track | undefined): void {
    if (warmed || !track?.soundcloudUrl || FLAGS.v4mock !== 'off' || simEngine) return;
    warmed = true;
    scPreload(track.soundcloudUrl);
  },
  /** Avancement 0 a 1 de la piste courante (0 sans piste). */
  progress: (): number => (snap.current ? snap.progress : 0),
  /**
   * Barre de progression (2026-10-01) : la piste courante saute a ratio
   * (0 a 1), en lecture comme en pause. false sans piste ou sans moteur.
   * L'avancement affiche suit tout de suite, sans attendre le widget.
   */
  seek(ratio: number): boolean {
    const e = simEngine ?? engine;
    if (!e || !snap.current || !Number.isFinite(ratio)) return false;
    const r = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
    e.seek(r);
    snap = { ...snap, progress: r };
    listeners.forEach((fn) => fn());
    return true;
  },
  /** Position de lecture en s (0 sans piste). */
  position: (): number => (snap.current ? snap.progress * snap.duration : 0),

  /**
   * Clic sur une ligne (spec 7.2 ROW_PLAY) : la piste courante se met en
   * pause ou reprend ; une autre part avec sa file (les lignes jouables de
   * la liste, dans l'ordre affiche). false sans moteur ou sans SoundCloud.
   */
  play(track: V2Track, queue: V2Track[]): boolean {
    const e = simEngine ?? engine;
    if (!e || !isPlayable(track)) return false;
    counters.requests += 1;
    if (snap.current?.id === track.id) {
      // Reprise : LOADING jusqu'au retour du son ; pause : rien a attendre
      setPending(!snap.playing);
      e.toggle();
    } else {
      setPending(true);
      e.play(track, queue);
    }
    derive();
    return true;
  },

  /** RUN pendant qu'une piste joue : elle passe en pause d'abord (spec decision 5). */
  pauseForRun(): boolean {
    const e = simEngine ?? engine;
    if (!e || !snap.current || !snap.playing) return false;
    counters.runPauses += 1;
    e.toggle();
    return true;
  },

  /** Le moteur a change (EngineBridge, un effet React). */
  sync(n: EngineSnapshot): void {
    const prev = snap;
    snap = n;
    const id = n.current?.id ?? null;
    // Nouvelle piste courante (clic, file qui avance, lien mort saute) : on
    // l'attend, 8 s pour chacune
    if (id !== null && id !== (prev.current?.id ?? null)) setPending(true);
    // Le son est la (comme /v3 : playing et une progression) : fin du chargement
    if (pending && n.playing && n.progress > 0) setPending(false);
    if (id === null && pending) setPending(false);
    // Une piste demarre : la boite a rythmes passe en STOP, rien ne la relance ;
    // l'arpege du MM-VOYAGER s'arrete aussi (2026-10-03)
    if (n.playing && !prev.playing) {
      counters.starts += 1;
      if (clock.running) {
        clock.stop();
        counters.autoStops += 1;
      }
      if (arp.get().running) arp.clear();
    }
    derive();
  },

  attach(h: EngineHandle | null): void {
    engine = h;
  },

  /** Demontage : plus d'echeance en attente, etat de repos. */
  reset(): void {
    window.clearTimeout(pendingTimer);
    pendingTimer = 0;
    pending = false;
    simEngine = null;
    playGen += 1;
    snap = IDLE;
    derive();
  },
};

/* ---------------- debug (window.__v4.sc) ---------------- */

/** Le moteur choisi au chargement (engine.ts lit le meme drapeau au meme moment). */
const MOCK = FLAGS.v4mock !== 'off';

export interface ScDebug {
  readonly state: ScState & { position: number };
  /** true : moteur factice de /v3 (?v4mock, DEV seulement) */
  readonly mock: boolean;
  readonly attached: boolean;
  readonly pending: boolean;
  readonly playGen: number;
  /** demandes (clics de ligne), departs de piste, STOP automatiques, pauses par RUN, NO SIGNAL */
  readonly counters: typeof counters;
  /**
   * Revue sans son : pousse un etat de moteur FACTICE dans le pont et
   * remplace le moteur par un faux qui ne fait que basculer cet etat (ni
   * moteur v2, ni widget, ni iframe). Exemple : simulate({ title: 'X',
   * playing: true, progress: 0.1, duration: 300 }). simulate(null) revient
   * au repos et rend le vrai moteur.
   */
  simulate(p: { title?: string; id?: string; playing?: boolean; progress?: number; duration?: number; notice?: string | null } | null): void;
}

export const scDebug: ScDebug = {
  get state() {
    return { ...state, position: sc.position() };
  },
  get mock() {
    return MOCK;
  },
  get attached() {
    return engine !== null;
  },
  get pending() {
    return pending;
  },
  get playGen() {
    return playGen;
  },
  get counters() {
    return { ...counters };
  },
  simulate(p) {
    if (!p) {
      simEngine = null;
      sc.sync(IDLE);
      return;
    }
    simEngine = {
      play: (track) => sc.sync({ ...snap, current: track, playing: false, progress: 0 }),
      toggle: () => sc.sync({ ...snap, playing: !snap.playing }),
      seek: (r) => sc.sync({ ...snap, progress: r }),
    };
    const title = p.title ?? snap.current?.title ?? 'Test';
    const current: V2Track | null =
      p.title === undefined && p.id === undefined && snap.current
        ? snap.current
        : {
            id: p.id ?? `sim-${title}`,
            title,
            project: 'Test',
            artist: 'Maudite Machine',
            role: 'Artist',
            year: 2026,
            category: 'originals',
            link: '',
          };
    sc.sync({
      current,
      playing: p.playing ?? snap.playing,
      progress: p.progress ?? snap.progress,
      duration: p.duration ?? snap.duration,
      notice: p.notice === undefined ? snap.notice : p.notice,
    });
  },
};
