/**
 * Motif du sequenceur (spec 10) : 16 pas x 4 instruments, l'instrument
 * selectionne (celui du dernier pad frappe) et le tempo. Petit store
 * observable : React le lit par useSyncExternalStore, la scene par get().
 * Motif, tempo et, depuis la revision 2, les trois effets SWING, DIST et
 * REVERB (pattern.fx) persistent sous mm.v4.pattern ; l'instrument non (une
 * visite commence sans selection), TONE et LEVEL non plus (une visite qui
 * commencerait muette serait un piege). Chaque lecture et chaque ecriture
 * du localStorage passent par try/catch : navigation privee, stockage
 * bloque ou plein, JSON corrompu, rien ne leve jamais.
 */

import type { Inst } from '../theme';

export const INSTRUMENTS: readonly Inst[] = ['BD', 'SD', 'TOM', 'CH'];
export const STEP_COUNT = 16;
export const BPM = { min: 100, max: 150, initial: 130 } as const;
export const STORAGE_KEY = 'mm.v4.pattern';
const SAVE_DEBOUNCE_MS = 300;
const STEPS_RE = /^[01]{16}$/;

export type Steps = Record<Inst, string>;

export interface Pattern {
  bpm: number;
  steps: Steps;
}

/**
 * SWING, DIST, REVERB (revision 2, spec 20.8) : 0 a 1, 0 = neutre (le
 * son de la revision 1). Persistes avec le motif.
 */
export interface Fx {
  swing: number;
  drive: number;
  reverb: number;
}

export const NEUTRAL_FX: Readonly<Fx> = { swing: 0, drive: 0, reverb: 0 };
const FX_KEYS: readonly (keyof Fx)[] = ['swing', 'drive', 'reverb'];

/**
 * Forme stockee (et celle de window.__v4.state.pattern). fx vient de la
 * revision 2 : un motif stocke sans lui (ou un fx invalide) repart neutre,
 * et la revision 1 ignore ce champ (tout le reste de l'objet l'est).
 */
export interface StoredPattern {
  v: 1;
  bpm: number;
  steps: Steps;
  fx: Fx;
}

export interface PatternState extends Pattern {
  instrument: Inst | null;
}

/** Four to the floor minimal : BD 1 5 9 13, CH 3 7 11 15, SD 5 13, TOM 15 (index 0 = pas 1). */
export const DEFAULT_STEPS: Readonly<Steps> = {
  BD: '1000100010001000',
  SD: '0000100000001000',
  TOM: '0000000000000010',
  CH: '0010001000100010',
};

export const defaultPattern = (): Pattern => ({ bpm: BPM.initial, steps: { ...DEFAULT_STEPS } });

/* ---------------- fonctions pures ---------------- */

export const clampBpm = (bpm: number): number =>
  Math.min(BPM.max, Math.max(BPM.min, Math.round(Number.isFinite(bpm) ? bpm : BPM.initial)));

/** Valide champ par champ ; tout ce qui manque ou cloche reprend la valeur par defaut. */
export function validate(raw: unknown): Pattern {
  const out = defaultPattern();
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as { v?: unknown; bpm?: unknown; steps?: unknown };
  if (o.v !== 1) return out;
  if (typeof o.bpm === 'number' && Number.isInteger(o.bpm) && o.bpm >= BPM.min && o.bpm <= BPM.max) out.bpm = o.bpm;
  if (o.steps && typeof o.steps === 'object') {
    const steps = o.steps as Record<string, unknown>;
    for (const inst of INSTRUMENTS) {
      const s = steps[inst];
      if (typeof s === 'string' && STEPS_RE.test(s)) out.steps[inst] = s;
    }
  }
  return out;
}

/** Un reglage d'effet : 0 a 1 ; NaN et l'infini valent 0. */
export const clampFx = (v: number): number => (Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0);

/** Les effets d'un objet stocke : chaque valeur hors de 0..1 (ou absente) reste neutre. */
export function validateFx(raw: unknown): Fx {
  const out = { ...NEUTRAL_FX };
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as { v?: unknown; fx?: unknown };
  if (o.v !== 1 || !o.fx || typeof o.fx !== 'object') return out;
  const f = o.fx as Record<string, unknown>;
  for (const k of FX_KEYS) {
    const v = f[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) out[k] = v;
  }
  return out;
}

function readStored(): unknown {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function load(): Pattern {
  return validate(readStored());
}

/** Au millieme : le JSON reste court, un glisser donne des valeurs continues. */
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

export function serialize(p: Pattern, f: Readonly<Fx> = NEUTRAL_FX): StoredPattern {
  return { v: 1, bpm: p.bpm, steps: { ...p.steps }, fx: { swing: r3(f.swing), drive: r3(f.drive), reverb: r3(f.reverb) } };
}

/** true si l'ecriture a reussi. */
export function save(p: Pattern, f: Readonly<Fx> = NEUTRAL_FX): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(p, f)));
    return true;
  } catch {
    return false;
  }
}

/** Nouveau motif avec le pas i de inst inverse (mise a jour immuable). */
export function toggleStep(p: Pattern, inst: Inst, i: number): Pattern {
  if (!Number.isInteger(i) || i < 0 || i >= STEP_COUNT) return p;
  const s = p.steps[inst];
  const flipped = s.slice(0, i) + (s[i] === '1' ? '0' : '1') + s.slice(i + 1);
  return { ...p, steps: { ...p.steps, [inst]: flipped } };
}

export function clearSteps(p: Pattern): Pattern {
  const empty = '0'.repeat(STEP_COUNT);
  return { ...p, steps: { BD: empty, SD: empty, TOM: empty, CH: empty } };
}

/* ---------------- le store ---------------- */

const stored = typeof window === 'undefined' ? null : readStored();
let state: PatternState = { ...validate(stored), instrument: null };
let fxState: Readonly<Fx> = validateFx(stored);
const listeners = new Set<() => void>();
const fxListeners = new Set<() => void>();
let saveTimer = 0;

const emit = (): void => listeners.forEach((l) => l());

function scheduleSave(): void {
  if (saveTimer !== 0) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    save(state, fxState);
  }, SAVE_DEBOUNCE_MS);
}

/** Ecrit tout de suite une sauvegarde en attente (pagehide, demontage). */
function flush(): void {
  if (saveTimer === 0) return;
  window.clearTimeout(saveTimer);
  saveTimer = 0;
  save(state, fxState);
}

function commit(next: PatternState, persist: boolean): void {
  state = next;
  if (persist) scheduleSave();
  emit();
}

/**
 * Les effets : leurs propres ecouteurs (l'audio, les encodeurs, leurs
 * jumeaux), pas ceux du motif. Un encodeur tourne a la cadence du pointeur
 * sans rerendre le Dock, les LED ni la racine ; la sauvegarde est la meme
 * (300 ms apres le dernier changement).
 */
const fxStore = {
  get: (): Readonly<Fx> => fxState,
  /** Un ou plusieurs reglages, bornes a 0..1 ; rien ne part si rien ne change. */
  set(patch: Partial<Fx>): void {
    let next: Fx | null = null;
    for (const k of FX_KEYS) {
      const v = patch[k];
      if (v === undefined) continue;
      const c = clampFx(v);
      if (c === fxState[k]) continue;
      if (!next) next = { ...fxState };
      next[k] = c;
    }
    if (!next) return;
    fxState = next;
    scheduleSave();
    fxListeners.forEach((l) => l());
  },
  subscribe(fn: () => void): () => void {
    fxListeners.add(fn);
    return () => {
      fxListeners.delete(fn);
    };
  },
};

export const pattern = {
  get: (): PatternState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Le dernier pad frappe ; null = aucune selection. */
  select(inst: Inst | null): void {
    if (state.instrument === inst) return;
    commit({ ...state, instrument: inst }, false);
  },
  toggle(inst: Inst, i: number): void {
    const next = toggleStep(state, inst, i);
    if (next !== state) commit({ ...next, instrument: state.instrument }, true);
  },
  clear(): void {
    commit({ ...clearSteps(state), instrument: state.instrument }, true);
  },
  setBpm(bpm: number): void {
    const b = clampBpm(bpm);
    if (b !== state.bpm) commit({ ...state, bpm: b }, true);
  },
  serialize: (): StoredPattern => serialize(state, fxState),
  flush,
  /** SWING, DIST, REVERB (0 a 1) : get, set(patch), subscribe. */
  fx: fxStore,
};

if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
