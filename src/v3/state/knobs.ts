/**
 * Les six boutons du panneau (0..1), store externe pour React
 * (useSyncExternalStore) et lecture directe par la scene a chaque frame.
 * Persistes dans localStorage mm_v3_knobs (ecriture differee de 200 ms :
 * un drag ne fait pas d'entree-sortie disque a chaque pointermove),
 * valides a la lecture.
 */

import { useSyncExternalStore } from 'react';

export type KnobKey = 'tuning' | 'cutoff' | 'resonance' | 'envmod' | 'decay' | 'accent';
export type KnobValues = Record<KnobKey, number>;

export const KNOB_KEYS: KnobKey[] = ['tuning', 'cutoff', 'resonance', 'envmod', 'decay', 'accent'];

export const KNOB_DEFAULTS: KnobValues = {
  tuning: 0.5,
  cutoff: 0.5,
  resonance: 0.18,
  envmod: 0.5,
  decay: 0.4,
  accent: 0.6,
};

export const KNOB_LABELS: Record<KnobKey, string> = {
  tuning: 'TUNING',
  cutoff: 'CUT OFF FREQ',
  resonance: 'RESONANCE',
  envmod: 'ENV MOD',
  decay: 'DECAY',
  accent: 'ACCENT',
};

export const KNOB_TIPS: Record<KnobKey, string> = {
  tuning: 'TUNING: bends the wave of the line',
  cutoff: 'CUT OFF: detail and glow',
  resonance: 'RESONANCE: winds the coil',
  envmod: 'ENV MOD: how much the current swells the line',
  decay: 'DECAY: tail length of the current',
  accent: 'ACCENT: brightness of the current and the flashes',
};

const STORAGE_KEY = 'mm_v3_knobs';
const SAVE_DELAY_MS = 200;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function load(): KnobValues {
  const v: KnobValues = { ...KNOB_DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return v;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const k of KNOB_KEYS) {
      const x = parsed[k];
      if (typeof x === 'number' && Number.isFinite(x)) v[k] = clamp01(x);
    }
  } catch {
    /* stockage bloque ou JSON casse : valeurs par defaut */
  }
  return v;
}

function save(v: KnobValues): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* quota ou navigation privee : on continue sans persistance */
  }
}

let values: KnobValues = typeof window === 'undefined' ? { ...KNOB_DEFAULTS } : load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let saveTimer: number | undefined;
let unsaved = false;

/** Ecrit tout de suite ce qui attend (fin de fenetre, page cachee ou quittee). */
function flushSave(): void {
  if (saveTimer !== undefined) {
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  if (!unsaved) return;
  unsaved = false;
  save(values);
}

/** Debounce : la sauvegarde part 200 ms apres le dernier changement. */
function scheduleSave(): void {
  unsaved = true;
  if (typeof window === 'undefined') return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, SAVE_DELAY_MS);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
}

export const knobs = {
  get: (): KnobValues => values,
  set(key: KnobKey, value: number): void {
    const v = clamp01(value);
    if (values[key] === v) return;
    values = { ...values, [key]: v };
    scheduleSave();
    emit();
  },
  reset(key?: KnobKey): void {
    values = key ? { ...values, [key]: KNOB_DEFAULTS[key] } : { ...KNOB_DEFAULTS };
    scheduleSave();
    emit();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const useKnobs = (): KnobValues => useSyncExternalStore(knobs.subscribe, knobs.get, knobs.get);

/**
 * Mapping boutons -> uniforms de la scene. Concentre ici pour que le
 * panneau (aria-valuetext) et la scene parlent des memes nombres.
 */
export const knobUniforms = (v: KnobValues) => ({
  tuning: 0.25 + 1.5 * v.tuning,
  cutoff: v.cutoff,
  resonance: v.resonance,
  envmod: v.envmod,
  decay: 0.01 + 0.14 * v.decay,
  accent: 0.2 + 1.3 * v.accent,
});
