/**
 * L'etat du MM-SMPL (2026-10-04) : le sample pose (son nom, d'ou il vient,
 * sa duree), la decoupe (SLICES : 4, 8, 16 parts egales ou AUTO, les
 * attaques) et ses bornes, le mode (SLICE : un pad joue sa slice ; GRAIN :
 * un pad joue un nuage de grains a son debut), REV, LOOP, ce qui sonne
 * (les pads allumes, PLAY), REC, et la ligne de message de l'ecran.
 * SLICES, le mode, REV et LOOP sont retenus (mm.v4.smpl.state) ; le sample
 * lui-meme l'est par le moteur (smpl/engine.ts, IndexedDB).
 */

import { SMPL_SLICINGS, type SmplSlicing } from './slices';

export type SmplMode = 'slice' | 'grain';
export type SmplSource = 'deck' | 'file' | 'rec';

export interface SmplSample {
  /** un numero par sample pose (l'ecran et les formes d'onde s'y fient) */
  id: number;
  name: string;
  source: SmplSource;
  duration: number;
  rate: number;
}

export interface SmplState {
  sample: SmplSample | null;
  slicing: SmplSlicing;
  /** les bornes des slices dans le sample (secondes) : n debuts, puis la fin */
  slices: readonly number[];
  mode: SmplMode;
  reverse: boolean;
  loop: boolean;
  /** les pads qui sonnent (0 a 15) */
  pads: readonly number[];
  /** PLAY : la region entiere (SLICE) ou le nuage a POSITION (GRAIN) */
  preview: boolean;
  recording: boolean;
  /** un chargement en cours (un fichier qui se decode) */
  busy: boolean;
  message: string | null;
}

const KEY = 'mm.v4.smpl.state';

function load(): Pick<SmplState, 'slicing' | 'mode' | 'reverse' | 'loop'> {
  const s = { slicing: 8 as SmplSlicing, mode: 'slice' as SmplMode, reverse: false, loop: false };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return s;
    const o = JSON.parse(raw) as Partial<typeof s>;
    if ((SMPL_SLICINGS as readonly unknown[]).includes(o.slicing)) s.slicing = o.slicing as SmplSlicing;
    if (o.mode === 'slice' || o.mode === 'grain') s.mode = o.mode;
    if (typeof o.reverse === 'boolean') s.reverse = o.reverse;
    if (typeof o.loop === 'boolean') s.loop = o.loop;
  } catch {
    /* rien de retenu */
  }
  return s;
}

let state: SmplState = {
  sample: null,
  slices: [],
  pads: [],
  preview: false,
  recording: false,
  busy: false,
  message: null,
  ...(typeof window === 'undefined' ? { slicing: 8, mode: 'slice', reverse: false, loop: false } : load()),
};
const listeners = new Set<() => void>();
let msgTimer = 0;

function save(): void {
  try {
    const { slicing, mode, reverse, loop } = state;
    window.localStorage.setItem(KEY, JSON.stringify({ slicing, mode, reverse, loop }));
  } catch {
    /* stockage indisponible : l'etat vit pour la visite */
  }
}

export const smplState = {
  get: (): SmplState => state,
  set(patch: Partial<SmplState>): void {
    const next = { ...state, ...patch };
    const keep = patch.slicing !== undefined || patch.mode !== undefined || patch.reverse !== undefined || patch.loop !== undefined;
    state = next;
    if (keep) save();
    listeners.forEach((fn) => fn());
  },
  /** Une ligne a l'ecran, quelques secondes (null : l'efface). */
  say(text: string | null, ms = 2600): void {
    window.clearTimeout(msgTimer);
    smplState.set({ message: text });
    if (text) msgTimer = window.setTimeout(() => smplState.set({ message: null }), ms);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/** La region (secondes) pour START et END (parts du sample). */
export function regionOf(start: number, end: number): { a: number; b: number } {
  const d = state.sample?.duration ?? 0;
  return { a: start * d, b: end * d };
}

/** Les bornes [a, b] de la slice d'un pad, ou null (pas de sample, pad sans slice). */
export function padSlice(i: number): { a: number; b: number } | null {
  const s = state.slices;
  if (!state.sample || i < 0 || i + 1 >= s.length) return null;
  return { a: s[i], b: s[i + 1] };
}

/** Combien de pads ont une slice. */
export const padCount = (): number => Math.max(0, state.slices.length - 1);
