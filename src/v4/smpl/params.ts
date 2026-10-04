/**
 * Les potards du MM-SMPL (2026-10-04) : douze, en trois rangees de quatre
 * comme sur la machine, tous de 0 a 1 dans le store (retenus sous
 * mm.v4.smpl.1), convertis ici en grandeurs :
 * - SAMPLE : START et END (la region, en part du sample), PITCH (-24 a +24
 *   demi-tons, un cran par demi-ton), LEVEL ;
 * - SHAPE : ATTACK (0.5 ms a 1 s), RELEASE (5 ms a 3 s), FILTER (zero au
 *   milieu : passe-bas a gauche, passe-haut a droite), SPREAD (l'image des
 *   grains) ;
 * - GRAIN : POSITION (dans la region), SIZE (10 a 500 ms), DENSITY (2 a 80
 *   grains par seconde), SPRAY (de combien les grains s'ecartent).
 */

export type SmplKnobId = 'start' | 'end' | 'pitch' | 'level' | 'attack' | 'release' | 'filter' | 'spread' | 'position' | 'size' | 'density' | 'spray';

export interface SmplKnobDef {
  id: SmplKnobId;
  label: string;
  aria: string;
  def: number;
  /** zero au milieu (l'arc part du centre) */
  bipolar?: boolean;
  /** crans (PITCH : 49) */
  steps?: number;
}

export const SMPL_KNOBS: readonly SmplKnobDef[] = [
  { id: 'start', label: 'START', aria: 'Region start', def: 0 },
  { id: 'end', label: 'END', aria: 'Region end', def: 1 },
  { id: 'pitch', label: 'PITCH', aria: 'Pitch in semitones', def: 0.5, bipolar: true, steps: 49 },
  { id: 'level', label: 'LEVEL', aria: 'Level', def: 0.8 },
  { id: 'attack', label: 'ATTACK', aria: 'Attack', def: 0.05 },
  { id: 'release', label: 'RELEASE', aria: 'Release', def: 0.3 },
  { id: 'filter', label: 'FILTER', aria: 'Filter, low-pass to the left, high-pass to the right', def: 0.5, bipolar: true },
  { id: 'spread', label: 'SPREAD', aria: 'Grain stereo spread', def: 0.35 },
  { id: 'position', label: 'POSITION', aria: 'Grain position in the region', def: 0.25 },
  { id: 'size', label: 'SIZE', aria: 'Grain size', def: 0.4 },
  { id: 'density', label: 'DENSITY', aria: 'Grains per second', def: 0.5 },
  { id: 'spray', label: 'SPRAY', aria: 'Grain position spray', def: 0.12 },
];

export const smplKnob = (id: SmplKnobId): SmplKnobDef => SMPL_KNOBS.find((k) => k.id === id) as SmplKnobDef;

/* ---------------- grandeurs ---------------- */

const expMap = (v: number, lo: number, hi: number): number => lo * Math.pow(hi / lo, Math.min(1, Math.max(0, v)));

export const pitchSemis = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 48) - 24;
export const attackS = (v: number): number => expMap(v, 0.0005, 1);
export const releaseS = (v: number): number => expMap(v, 0.005, 3);
export const sizeS = (v: number): number => expMap(v, 0.01, 0.5);
export const densityHz = (v: number): number => expMap(v, 2, 80);
/** LEVEL : au carre (le potard suit l'oreille), x1.2 a fond. */
export const levelGain = (v: number): number => 1.2 * v * v;
/** FILTER : sous le milieu un passe-bas de 20 kHz a 200 Hz, au-dessus un passe-haut de 20 Hz a 4 kHz ; au milieu, rien. */
export function filterOf(v: number): { type: 'lowpass' | 'highpass' | 'off'; hz: number } {
  const d = (v - 0.5) * 2;
  if (Math.abs(d) < 0.02) return { type: 'off', hz: 0 };
  if (d < 0) return { type: 'lowpass', hz: expMap(1 + d, 200, 20000) };
  return { type: 'highpass', hz: expMap(d, 20, 4000) };
}

const ms = (s: number): string => (s < 1 ? `${Math.round(s * 1000)} MS` : `${s.toFixed(2)} S`);
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const hz = (f: number): string => (f >= 1000 ? `${(f / 1000).toFixed(1)} KHZ` : `${Math.round(f)} HZ`);

/** Sa valeur lisible (l'ecran de la machine, les jumeaux) ; dur : la duree du sample, pour START et END. */
export function smplValueText(id: SmplKnobId, v: number, dur = 0): string {
  switch (id) {
    case 'start':
    case 'end':
      return dur > 0 ? `${(v * dur).toFixed(2)} S` : pct(v);
    case 'pitch': {
      const s = pitchSemis(v);
      return s === 0 ? '0' : `${s > 0 ? '+' : ''}${s}`;
    }
    case 'attack':
      return ms(attackS(v));
    case 'release':
      return ms(releaseS(v));
    case 'size':
      return ms(sizeS(v));
    case 'density':
      return `${densityHz(v).toFixed(densityHz(v) < 10 ? 1 : 0)}/S`;
    case 'filter': {
      const f = filterOf(v);
      return f.type === 'off' ? 'OFF' : `${f.type === 'lowpass' ? 'LP' : 'HP'} ${hz(f.hz)}`;
    }
    default:
      return pct(v);
  }
}

export const smplReadout = (id: SmplKnobId, v: number, dur = 0): string => `${smplKnob(id).label} ${smplValueText(id, v, dur)}`;

/* ---------------- le store ---------------- */

export type SmplValues = Record<SmplKnobId, number>;
const KEY = 'mm.v4.smpl.1';
const DEFAULTS = Object.fromEntries(SMPL_KNOBS.map((k) => [k.id, k.def])) as SmplValues;

function load(): SmplValues {
  const v = { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return v;
    const o = JSON.parse(raw) as Partial<SmplValues>;
    for (const k of SMPL_KNOBS) {
      const x = o[k.id];
      if (typeof x === 'number' && Number.isFinite(x)) v[k.id] = Math.min(1, Math.max(0, x));
    }
  } catch {
    /* rien de retenu */
  }
  return v;
}

let values: SmplValues = typeof window === 'undefined' ? { ...DEFAULTS } : load();
const listeners = new Set<() => void>();
let saveTimer = 0;

/** La plus petite region (en part du sample) : START et END ne se croisent jamais. */
const MIN_SPAN = 0.002;

export const smplParams = {
  get: (): SmplValues => values,
  of: (id: SmplKnobId): number => values[id],
  def: (id: SmplKnobId): number => smplKnob(id).def,
  /** Une valeur (0 a 1, au cran pres) ; true si elle change. */
  set(id: SmplKnobId, v: number): boolean {
    const k = smplKnob(id);
    let x = Math.min(1, Math.max(0, v));
    if (k.steps && k.steps > 1) x = Math.round(x * (k.steps - 1)) / (k.steps - 1);
    if (id === 'start') x = Math.min(x, values.end - MIN_SPAN);
    if (id === 'end') x = Math.max(x, values.start + MIN_SPAN);
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
