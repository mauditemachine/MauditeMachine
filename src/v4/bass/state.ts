/**
 * L'etat du MM-BASS (2026-10-07) : la suite de seize pas, facon TB-303 et
 * Elektron. Un pas est vide, une note (un degre de la gamme, une octave en
 * plus, ACCENT, SLIDE) ou une liaison (TIE : la note d'avant continue,
 * comme le mode TIME de la 303). SLIDE sur un pas : sa note glisse vers la
 * suivante sans se relacher. Le pas choisi (le dernier touche) recoit
 * ACCENT, SLIDE, NOTE - +, OCT - +. Retenu sous mm.v4.bass.state.
 *
 * Les verrous (2026-10-07, Mika : "des boutons au-dessus de chaque step ;
 * quand j'appuie sur ce bouton, je peux parametrer tout ce que je veux sur
 * CE step uniquement, et les parametres changent au passage de ce step") :
 * les parameter locks des Elektron. Un pas garde ses valeurs des potards du
 * son (locks) ; lock : le pas dont on regle les verrous (-1 : aucun), les
 * potards du son ne changent alors que lui.
 */

import type { BassKnobId } from './params';

export type BassStepKind = 'off' | 'note' | 'tie';

export interface BassStep {
  kind: BassStepKind;
  /** le degre dans la gamme (0 : la tonique ; au-dela de la gamme : l'octave suivante) */
  deg: number;
  /** octaves en plus (-1 a +2) */
  oct: number;
  acc: boolean;
  slide: boolean;
  /** les valeurs verrouillees de ce pas (0 a 1), absentes : celles des potards */
  locks?: BassLocks;
}

export const BASS_STEPS = 16;

/**
 * Les potards du son qu'un pas peut verrouiller (pas ceux du generateur, ni OCTAVE) ; LENGTH aussi (2026-10-08, la longueur de la note du pas).
 * La machine Elektron (2026-10-08, Mika : "on tourne un encodeur sur ce step et donc ce step a une valeur differente") : tout
 * le son de chaque page se verrouille, les crans compris (SUB OCT) ; restent globaux OCTAVE (le pas a son OCT) et les
 * reglages des effets eux-memes (DLY TIME, DLY FB, REV SIZE, REV TONE : une seule unite par effet, comme une Elektron).
 */
export type BassLockId =
  | 'cutoff'
  | 'reso'
  | 'envmod'
  | 'decay'
  | 'accent'
  | 'wave'
  | 'sub'
  | 'drive'
  | 'glide'
  | 'volume'
  | 'length'
  | 'accdecay'
  | 'sweep'
  | 'keytrack'
  | 'pw'
  | 'suboct'
  | 'tune'
  | 'attack'
  | 'adecay'
  | 'sustain'
  | 'release'
  | 'delay'
  | 'reverb';
export const BASS_LOCKABLE: readonly BassLockId[] = ['cutoff', 'reso', 'envmod', 'decay', 'accent', 'wave', 'sub', 'drive', 'glide', 'volume', 'length', 'accdecay', 'sweep', 'keytrack', 'pw', 'suboct', 'tune', 'attack', 'adecay', 'sustain', 'release', 'delay', 'reverb'];
export const isLockable = (id: string): id is BassLockId => (BASS_LOCKABLE as readonly string[]).includes(id);
export type BassLocks = Partial<Record<BassLockId, number>>;

export interface BassState {
  steps: readonly BassStep[];
  /** le pas choisi (0 a 15) */
  sel: number;
  running: boolean;
  /** la ligne de message de l'ecran */
  message: string | null;
  /** un numero par suite generee (l'ecran fait son petit effet) */
  gen: number;
  /** le pas dont on regle les verrous (-1 : aucun) */
  lock: number;
  /** le dernier potard tourne et quand (performance.now) : l'ecran le montre un instant, facon Elektron (2026-10-08) */
  touched: { id: BassKnobId; at: number } | null;
}

const KEY = 'mm.v4.bass.state';
const off = (): BassStep => ({ kind: 'off', deg: 0, oct: 0, acc: false, slide: false });

/** La suite de depart : une ligne acid en fa diese mineur. */
function initial(): BassStep[] {
  const n = (deg: number, oct = 0, acc = false, slide = false): BassStep => ({ kind: 'note', deg, oct, acc, slide });
  const t = (): BassStep => ({ kind: 'tie', deg: 0, oct: 0, acc: false, slide: false });
  return [n(0, 0, true), n(0), n(0, 1, false, true), n(4), n(0, 0, true), off(), n(2, 0, false, true), n(3), n(0), n(0, 1, true), n(6, 0, false, true), n(4), t(), n(0, 0, true), n(4, 0, false, true), n(0, 1)];
}

function clean(o: unknown): BassStep | null {
  if (!o || typeof o !== 'object') return null;
  const s = o as Partial<BassStep>;
  const kind: BassStepKind = s.kind === 'note' || s.kind === 'tie' ? s.kind : 'off';
  const deg = typeof s.deg === 'number' && Number.isFinite(s.deg) ? Math.max(0, Math.min(20, Math.round(s.deg))) : 0;
  const oct = typeof s.oct === 'number' && Number.isFinite(s.oct) ? Math.max(-1, Math.min(2, Math.round(s.oct))) : 0;
  const out: BassStep = { kind, deg, oct, acc: !!s.acc, slide: !!s.slide };
  const locks = cleanLocks(s.locks);
  if (locks) out.locks = locks;
  return out;
}

/** Des verrous lus : seulement les potards du son, de 0 a 1 ; null s'il n'en reste aucun. */
export function cleanLocks(o: unknown): BassLocks | null {
  if (!o || typeof o !== 'object') return null;
  const out: BassLocks = {};
  let n = 0;
  for (const id of BASS_LOCKABLE) {
    const v = (o as Record<string, unknown>)[id];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[id] = Math.min(1, Math.max(0, v));
      n += 1;
    }
  }
  return n ? out : null;
}

/** Une suite lue (stockage, pattern, preset) : seize pas valides, ou null. */
export function cleanSteps(o: unknown): BassStep[] | null {
  if (!Array.isArray(o) || o.length !== BASS_STEPS) return null;
  const steps = o.map(clean);
  return steps.every((x) => x) ? (steps as BassStep[]) : null;
}

function load(): BassStep[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initial();
    return cleanSteps(JSON.parse(raw) as unknown) ?? initial();
  } catch {
    return initial();
  }
}

let state: BassState = { steps: typeof window === 'undefined' ? initial() : load(), sel: 0, running: false, message: null, gen: 0, lock: -1, touched: null };
const listeners = new Set<() => void>();
let msgTimer = 0;
let saveTimer = 0;

/** Retenue un peu apres (un potard verrouille qui tourne ecrit des dizaines de fois par seconde). */
function save(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state.steps));
    } catch {
      /* stockage indisponible : la suite vit pour la visite */
    }
  }, 300);
}

export const bassState = {
  get: (): BassState => state,
  set(patch: Partial<BassState>): void {
    const keep = patch.steps !== undefined && patch.steps !== state.steps;
    state = { ...state, ...patch };
    if (keep) save();
    listeners.forEach((fn) => fn());
  },
  /** Un pas change (les autres restent) ; also : le reste de l'etat dans la meme notification (2026-10-08 : un encodeur en LOCK, un seul dessin de l'ecran). */
  setStep(i: number, patch: Partial<BassStep>, also: Partial<BassState> = {}): void {
    if (i < 0 || i >= BASS_STEPS) return;
    const steps = state.steps.map((s, k) => {
      if (k !== i) return s;
      const next: BassStep = { ...s, ...patch };
      if ('locks' in patch && !patch.locks) delete next.locks;
      return next;
    });
    bassState.set({ ...also, steps });
  },
  /** Une ligne a l'ecran, quelques secondes. */
  say(text: string | null, ms = 2200): void {
    window.clearTimeout(msgTimer);
    bassState.set({ message: text });
    if (text) msgTimer = window.setTimeout(() => bassState.set({ message: null }), ms);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const emptyStep = off;
