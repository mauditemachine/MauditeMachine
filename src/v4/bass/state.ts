/**
 * L'etat du MM-BASS (2026-10-07) : la suite de seize pas, facon TB-303 et
 * Elektron. Un pas est vide, une note (un degre de la gamme, une octave en
 * plus, ACCENT, SLIDE) ou une liaison (TIE : la note d'avant continue,
 * comme le mode TIME de la 303). SLIDE sur un pas : sa note glisse vers la
 * suivante sans se relacher. Le pas choisi (le dernier touche) recoit
 * ACCENT, SLIDE, NOTE - +, OCT - +. Retenu sous mm.v4.bass.state.
 */

export type BassStepKind = 'off' | 'note' | 'tie';

export interface BassStep {
  kind: BassStepKind;
  /** le degre dans la gamme (0 : la tonique ; au-dela de la gamme : l'octave suivante) */
  deg: number;
  /** octaves en plus (-1 a +2) */
  oct: number;
  acc: boolean;
  slide: boolean;
}

export const BASS_STEPS = 16;

export interface BassState {
  steps: readonly BassStep[];
  /** le pas choisi (0 a 15) */
  sel: number;
  running: boolean;
  /** la ligne de message de l'ecran */
  message: string | null;
  /** un numero par suite generee (l'ecran fait son petit effet) */
  gen: number;
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
  return { kind, deg, oct, acc: !!s.acc, slide: !!s.slide };
}

function load(): BassStep[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initial();
    const o = JSON.parse(raw) as unknown;
    if (!Array.isArray(o) || o.length !== BASS_STEPS) return initial();
    const steps = o.map(clean);
    return steps.every((x) => x) ? (steps as BassStep[]) : initial();
  } catch {
    return initial();
  }
}

let state: BassState = { steps: typeof window === 'undefined' ? initial() : load(), sel: 0, running: false, message: null, gen: 0 };
const listeners = new Set<() => void>();
let msgTimer = 0;

export const bassState = {
  get: (): BassState => state,
  set(patch: Partial<BassState>): void {
    const keep = patch.steps !== undefined && patch.steps !== state.steps;
    state = { ...state, ...patch };
    if (keep) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(state.steps));
      } catch {
        /* stockage indisponible : la suite vit pour la visite */
      }
    }
    listeners.forEach((fn) => fn());
  },
  /** Un pas change (les autres restent). */
  setStep(i: number, patch: Partial<BassStep>): void {
    if (i < 0 || i >= BASS_STEPS) return;
    const steps = state.steps.map((s, k) => (k === i ? { ...s, ...patch } : s));
    bassState.set({ steps });
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
