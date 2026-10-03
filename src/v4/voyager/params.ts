/**
 * MM-VOYAGEUR (2026-10-03, demande de Mika) : les potards du synthe, leurs
 * valeurs (0 a 1) et leur traduction en son. Un petit store observable,
 * persiste sous mm.v4.voyageur.1 (try/catch partout : navigation privee,
 * stockage plein, JSON corrompu, rien ne leve).
 *
 * Sections du panneau, facon Voyager : ARPEGGIATOR (RATE, MODE, RANGE,
 * GATE), OSCILLATORS (WAVE, FINE, GLIDE), FILTER (CUTOFF, RES, ENV AMT),
 * deux enveloppes ADSR (FILTER EG et AMP EG), EFFECTS (DIST, CHORUS, DELAY,
 * REVERB) et OUTPUT (VOLUME). Les potards a crans (RATE, MODE, RANGE)
 * gardent une valeur ronde : idx / (n - 1).
 *
 * FINE desaccorde les deux oscillateurs l'un contre l'autre, de part et
 * d'autre de la note : le centre reste juste, le son grossit sans jamais
 * sortir de la tonalite (la demande de Mika).
 */

export type VoyKnobId =
  | 'rate'
  | 'mode'
  | 'range'
  | 'gate'
  | 'wave'
  | 'fine'
  | 'glide'
  | 'cutoff'
  | 'res'
  | 'envAmt'
  | 'fA'
  | 'fD'
  | 'fS'
  | 'fR'
  | 'aA'
  | 'aD'
  | 'aS'
  | 'aR'
  | 'dist'
  | 'chorus'
  | 'delay'
  | 'reverb'
  | 'volume';

export type VoySection = 'arp' | 'osc' | 'filter' | 'feg' | 'aeg' | 'fx' | 'out';

export interface VoyKnob {
  id: VoyKnobId;
  /** serigraphie */
  label: string;
  /** nom lu (jumeau, role slider) */
  aria: string;
  section: VoySection;
  /** valeur de depart (double tape) */
  def: number;
  /** crans nommes (RATE, MODE, RANGE) */
  steps?: readonly string[];
  /** le gros potard du filtre */
  big?: boolean;
}

export const RATES = ['1/4', '1/8', '1/16', '1/32'] as const;
export const MODES = ['UP', 'DOWN', 'UP/DN', 'RAND'] as const;
export const RANGES = ['1 OCT', '2 OCT', '3 OCT'] as const;

/** Dans l'ordre de lecture du panneau (et de tabulation des jumeaux). */
export const VOY_KNOBS: readonly VoyKnob[] = [
  { id: 'rate', label: 'RATE', aria: 'Arpeggiator rate', section: 'arp', def: 2 / 3, steps: RATES },
  { id: 'mode', label: 'MODE', aria: 'Arpeggiator mode', section: 'arp', def: 0, steps: MODES },
  { id: 'range', label: 'RANGE', aria: 'Arpeggiator range', section: 'arp', def: 0.5, steps: RANGES },
  { id: 'gate', label: 'GATE', aria: 'Arpeggiator gate length', section: 'arp', def: 0.5 },
  { id: 'wave', label: 'WAVE', aria: 'Oscillator wave, saw to square to pulse', section: 'osc', def: 0 },
  { id: 'fine', label: 'FINE', aria: 'Fine tune, the two oscillators apart, always in key', section: 'osc', def: 0.35 },
  { id: 'glide', label: 'GLIDE', aria: 'Glide between notes', section: 'osc', def: 0 },
  { id: 'cutoff', label: 'CUTOFF', aria: 'Filter cutoff', section: 'filter', def: 0.5, big: true },
  { id: 'res', label: 'RES', aria: 'Filter resonance', section: 'filter', def: 0.35 },
  { id: 'envAmt', label: 'ENV AMT', aria: 'Filter envelope amount', section: 'filter', def: 0.5 },
  { id: 'fA', label: 'ATTACK', aria: 'Filter envelope attack', section: 'feg', def: 0 },
  { id: 'fD', label: 'DECAY', aria: 'Filter envelope decay', section: 'feg', def: 0.3 },
  { id: 'fS', label: 'SUSTAIN', aria: 'Filter envelope sustain', section: 'feg', def: 0.2 },
  { id: 'fR', label: 'RELEASE', aria: 'Filter envelope release', section: 'feg', def: 0.3 },
  { id: 'aA', label: 'ATTACK', aria: 'Amp envelope attack', section: 'aeg', def: 0 },
  { id: 'aD', label: 'DECAY', aria: 'Amp envelope decay', section: 'aeg', def: 0.35 },
  { id: 'aS', label: 'SUSTAIN', aria: 'Amp envelope sustain', section: 'aeg', def: 0.6 },
  { id: 'aR', label: 'RELEASE', aria: 'Amp envelope release', section: 'aeg', def: 0.3 },
  { id: 'dist', label: 'DIST', aria: 'Distortion', section: 'fx', def: 0 },
  { id: 'chorus', label: 'CHORUS', aria: 'Chorus', section: 'fx', def: 0.4 },
  { id: 'delay', label: 'DELAY', aria: 'Delay', section: 'fx', def: 0.25 },
  { id: 'reverb', label: 'REVERB', aria: 'Reverb', section: 'fx', def: 0.25 },
  { id: 'volume', label: 'VOLUME', aria: 'Synth volume', section: 'out', def: 0.75, big: true },
];

export const VOY_KNOB_IDS: readonly VoyKnobId[] = VOY_KNOBS.map((k) => k.id);
export const voyKnob = (id: VoyKnobId): VoyKnob => VOY_KNOBS.find((k) => k.id === id) as VoyKnob;

export type VoyValues = Record<VoyKnobId, number>;

const DEFAULTS = Object.fromEntries(VOY_KNOBS.map((k) => [k.id, k.def])) as VoyValues;

/** Index du cran d'un potard a crans. */
export const stepIndex = (id: VoyKnobId, v: number): number => {
  const s = voyKnob(id).steps;
  if (!s) return 0;
  return Math.max(0, Math.min(s.length - 1, Math.round(v * (s.length - 1))));
};

/** Valeur posee : bornee, et ronde sur un potard a crans. */
function clean(id: VoyKnobId, v: number): number {
  const t = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULTS[id];
  const s = voyKnob(id).steps;
  return s ? stepIndex(id, t) / (s.length - 1) : Math.round(t * 1000) / 1000;
}

/* ---------------- traduction en son ---------------- */

/** Temps d'attaque : 1 ms a 2 s, exponentiel. */
export const attackS = (v: number): number => 0.001 * Math.pow(2000, v);
/** Decroissance : 5 ms a 2 s. */
export const decayS = (v: number): number => 0.005 * Math.pow(400, v);
/** Relachement : 5 ms a 3 s. */
export const releaseS = (v: number): number => 0.005 * Math.pow(600, v);
/** Coupure du filtre : 30 Hz a 19 kHz (9.3 octaves). */
export const cutoffHz = (v: number): number => 30 * Math.pow(2, v * 9.3);
/** Montee de l'enveloppe du filtre : 0 a 6 octaves au-dessus de la coupure. */
export const envOctaves = (v: number): number => v * 6;
/** Resonance du second etage (le Q des passe-bas Web Audio est en dB) : -3 a +20 dB. */
export const resDb = (v: number): number => -3 + v * 23;
/** Glissement entre deux notes (s). */
export const glideS = (v: number): number => v * v * 0.35;
/** Desaccord total entre les deux oscillateurs (cents), centre sur la note. */
export const fineCents = (v: number): number => v * 28;
/** Duree d'une note de l'arpege, en fraction de l'intervalle entre deux notes. */
export const gateFrac = (v: number): number => 0.08 + 0.92 * v;
/** Pas de 16e par note : 1/4 = 4, 1/8 = 2, 1/16 = 1, 1/32 = 0.5. */
export const stepsPerNote = (v: number): number => [4, 2, 1, 0.5][stepIndex('rate', v)];
export const octaves = (v: number): number => stepIndex('range', v) + 1;

/** Texte de l'ecran et du jumeau : CUTOFF 64%, RATE 1/16, MODE UP/DN. */
export function voyReadout(id: VoyKnobId, v: number): string {
  const k = voyKnob(id);
  if (k.steps) return `${k.label} ${k.steps[stepIndex(id, v)]}`;
  const sec = k.section === 'feg' ? 'F ' : k.section === 'aeg' ? 'A ' : '';
  return `${sec}${k.label} ${Math.round(v * 100)}%`;
}

/** Valeur lue d'un potard (jumeau) : "1/16", "64 %". */
export function voyValueText(id: VoyKnobId, v: number): string {
  const k = voyKnob(id);
  if (k.steps) return k.steps[stepIndex(id, v)];
  return `${Math.round(v * 100)} %`;
}

/* ---------------- store ---------------- */

export const VOY_STORAGE_KEY = 'mm.v4.voyageur.1';
const SAVE_DEBOUNCE_MS = 300;

function load(): VoyValues {
  const out = { ...DEFAULTS };
  try {
    const text = window.localStorage.getItem(VOY_STORAGE_KEY);
    if (!text) return out;
    const raw = JSON.parse(text) as { v?: unknown; knobs?: Record<string, unknown> };
    if (raw.v !== 1 || !raw.knobs || typeof raw.knobs !== 'object') return out;
    for (const id of VOY_KNOB_IDS) {
      const v = raw.knobs[id];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) out[id] = clean(id, v);
    }
  } catch {
    /* stockage illisible : les valeurs de depart */
  }
  return out;
}

let values: VoyValues = typeof window === 'undefined' ? { ...DEFAULTS } : load();
let saveTimer = 0;
const listeners = new Set<() => void>();

function save(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    try {
      window.localStorage.setItem(VOY_STORAGE_KEY, JSON.stringify({ v: 1, knobs: values }));
    } catch {
      /* stockage plein ou bloque : la visite garde ses reglages */
    }
  }, SAVE_DEBOUNCE_MS);
}

export const voyParams = {
  get: (): Readonly<VoyValues> => values,
  of: (id: VoyKnobId): number => values[id],
  def: (id: VoyKnobId): number => DEFAULTS[id],
  /** true si la valeur a change. */
  set(id: VoyKnobId, v: number): boolean {
    const t = clean(id, v);
    if (t === values[id]) return false;
    values = { ...values, [id]: t };
    save();
    listeners.forEach((fn) => fn());
    return true;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Tests : tout aux valeurs de depart. */
  reset(): void {
    values = { ...DEFAULTS };
    save();
    listeners.forEach((fn) => fn());
  },
};
