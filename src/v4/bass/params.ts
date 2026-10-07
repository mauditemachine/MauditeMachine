/**
 * Les potards du MM-BASS (2026-10-07), tous de 0 a 1 dans le store (retenus
 * sous mm.v4.bass.params), en trois familles :
 * - FILTER, ceux de la TB-303 : CUTOFF (le grand, comme sur le Minitaur),
 *   RESO, ENV MOD, DECAY, ACCENT ;
 * - VOICE : WAVE (dent de scie vers carre), SUB (un sinus une octave sous la
 *   note), DRIVE, GLIDE (la duree d'un SLIDE), VOLUME, OCTAVE (de -2 a +1 :
 *   les subs descendent jusqu'a 20 Hz) ;
 * - GENERATOR, facon Torso T-1 : STYLE (ACID, DISCO, ROLL, SUB), DENSITY,
 *   SLIDES, ACCENTS (leurs chances), RANGE (l'etendue en octaves), ROOT (la
 *   tonique, ou ARP : elle suit les accords du MM-ARP), SCALE.
 */

export type BassKnobId = 'cutoff' | 'reso' | 'envmod' | 'decay' | 'accent' | 'wave' | 'sub' | 'drive' | 'glide' | 'volume' | 'octave' | 'style' | 'density' | 'slides' | 'accents' | 'range' | 'root' | 'scale';

export interface BassKnobDef {
  id: BassKnobId;
  label: string;
  aria: string;
  def: number;
  bipolar?: boolean;
  /** crans (OCTAVE, STYLE, RANGE, ROOT, SCALE) */
  steps?: number;
  /** le nom de chaque cran */
  names?: readonly string[];
}

export const BASS_STYLES = ['ACID', 'DISCO', 'ROLL', 'SUB'] as const;
export type BassStyle = (typeof BASS_STYLES)[number];
/** ROOT : ARP (les accords du MM-ARP), puis les douze toniques depuis fa diese (la tonalite du site). */
export const BASS_ROOTS = ['ARP', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F'] as const;
export const BASS_SCALES = ['MINOR', 'DORIAN', 'PHRYGIAN', 'HARMONIC', 'PENTA'] as const;
/** Les intervalles de chaque gamme (demi-tons depuis la tonique). */
export const SCALE_TONES: Readonly<Record<(typeof BASS_SCALES)[number], readonly number[]>> = {
  MINOR: [0, 2, 3, 5, 7, 8, 10],
  DORIAN: [0, 2, 3, 5, 7, 9, 10],
  PHRYGIAN: [0, 1, 3, 5, 7, 8, 10],
  HARMONIC: [0, 2, 3, 5, 7, 8, 11],
  PENTA: [0, 3, 5, 7, 10],
};
export const BASS_OCTAVES = ['-2', '-1', '0', '+1'] as const;
export const BASS_RANGES = ['1', '2', '3'] as const;

export const BASS_KNOBS: readonly BassKnobDef[] = [
  { id: 'cutoff', label: 'CUTOFF', aria: 'Filter cutoff', def: 0.32 },
  { id: 'reso', label: 'RESO', aria: 'Filter resonance', def: 0.62 },
  { id: 'envmod', label: 'ENV MOD', aria: 'Filter envelope amount', def: 0.55 },
  { id: 'decay', label: 'DECAY', aria: 'Filter envelope decay', def: 0.42 },
  { id: 'accent', label: 'ACCENT', aria: 'Accent amount', def: 0.65 },
  { id: 'wave', label: 'WAVE', aria: 'Waveform, saw to square', def: 0 },
  { id: 'sub', label: 'SUB', aria: 'Sub oscillator level, a sine one octave below', def: 0.35 },
  { id: 'drive', label: 'DRIVE', aria: 'Drive after the filter', def: 0.18 },
  { id: 'glide', label: 'GLIDE', aria: 'Slide time', def: 0.35 },
  { id: 'volume', label: 'VOLUME', aria: 'Volume', def: 0.78 },
  { id: 'octave', label: 'OCTAVE', aria: 'Octave, from minus two to plus one', def: 2 / 3, steps: 4, names: BASS_OCTAVES },
  { id: 'style', label: 'STYLE', aria: 'Generator style: acid, disco, roll or sub', def: 0, steps: 4, names: BASS_STYLES },
  { id: 'density', label: 'DENSITY', aria: 'Generator density: how many notes', def: 0.6 },
  { id: 'slides', label: 'SLIDES', aria: 'Generator: chance of a slide', def: 0.3 },
  { id: 'accents', label: 'ACCENTS', aria: 'Generator: chance of an accent', def: 0.35 },
  { id: 'range', label: 'RANGE', aria: 'Generator: range in octaves', def: 0.5, steps: 3, names: BASS_RANGES },
  { id: 'root', label: 'ROOT', aria: 'Root note, or ARP: follow the MM-ARP chords', def: 1 / 12, steps: 13, names: BASS_ROOTS },
  { id: 'scale', label: 'SCALE', aria: 'Scale', def: 0, steps: 5, names: BASS_SCALES },
];

export const bassKnob = (id: BassKnobId): BassKnobDef => BASS_KNOBS.find((k) => k.id === id) as BassKnobDef;

/** Le cran d'un potard a crans (0 a steps - 1). */
export const stepOf = (id: BassKnobId, v: number): number => {
  const k = bassKnob(id);
  const n = k.steps ?? 1;
  return Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))));
};

const pct = (v: number): string => `${Math.round(v * 100)}`;

/** Sa valeur lisible (l'ecran, les jumeaux). */
export function bassValueText(id: BassKnobId, v: number): string {
  const k = bassKnob(id);
  if (k.names) return k.names[stepOf(id, v)];
  if (id === 'cutoff') {
    const hz = 60 * Math.pow(100, v);
    return hz >= 1000 ? `${(hz / 1000).toFixed(1)} KHZ` : `${Math.round(hz)} HZ`;
  }
  if (id === 'decay') {
    const s = 0.12 * Math.pow(2.5 / 0.12, v);
    return s < 1 ? `${Math.round(s * 1000)} MS` : `${s.toFixed(2)} S`;
  }
  if (id === 'glide') return `${Math.round(12 * Math.pow(0.35 / 0.012, v))} MS`;
  if (id === 'wave') return v < 0.03 ? 'SAW' : v > 0.97 ? 'SQUARE' : pct(v);
  return pct(v);
}

/* ---------------- le store ---------------- */

export type BassValues = Record<BassKnobId, number>;
const KEY = 'mm.v4.bass.params';
const DEFAULTS = Object.fromEntries(BASS_KNOBS.map((k) => [k.id, k.def])) as BassValues;

function load(): BassValues {
  const v = { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return v;
    const o = JSON.parse(raw) as Partial<BassValues>;
    for (const k of BASS_KNOBS) {
      const x = o[k.id];
      if (typeof x === 'number' && Number.isFinite(x)) v[k.id] = Math.min(1, Math.max(0, x));
    }
  } catch {
    /* rien de retenu */
  }
  return v;
}

let values: BassValues = typeof window === 'undefined' ? { ...DEFAULTS } : load();
const listeners = new Set<() => void>();
let saveTimer = 0;

export const bassParams = {
  get: (): BassValues => values,
  of: (id: BassKnobId): number => values[id],
  def: (id: BassKnobId): number => bassKnob(id).def,
  /** Une valeur (0 a 1, au cran pres) ; true si elle change. */
  set(id: BassKnobId, v: number): boolean {
    const k = bassKnob(id);
    let x = Math.min(1, Math.max(0, v));
    if (k.steps && k.steps > 1) x = Math.round(x * (k.steps - 1)) / (k.steps - 1);
    if (values[id] === x) return false;
    values = { ...values, [id]: x };
    listeners.forEach((fn) => fn());
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(values));
      } catch {
        /* stockage indisponible : les reglages vivent pour la visite */
      }
    }, 300);
    return true;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
