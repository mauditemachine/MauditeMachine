/**
 * MM-VOYAGER (2026-10-03, demande de Mika) : les potards du synthe, leurs
 * valeurs (0 a 1) et leur traduction en son. Un petit store observable,
 * persiste sous mm.v4.voyager.1 (try/catch partout : navigation privee,
 * stockage plein, JSON corrompu, rien ne leve).
 *
 * Sections, facon Voyager : ARPEGGIATOR (RATE, MODE, RANGE, NOTES, GATE,
 * OCTAVE, sur le plateau), OSCILLATORS (WAVE 1, WAVE 2, TUNE 2, MIX, FINE,
 * GLIDE ; deux oscillateurs facon Typhon depuis le 2026-10-03), FILTER (CUTOFF, RES, ENV AMT),
 * deux enveloppes ADSR (FILTER EG et AMP EG), EFFECTS (DIST, CHORUS, DELAY,
 * REVERB) et OUTPUT (VOLUME). Les potards a crans (RATE, MODE, RANGE,
 * NOTES, OCTAVE, WAVE 1, WAVE 2, TUNE 2) gardent une valeur ronde : idx / (n - 1).
 *
 * NOTES (2026-10-03, Mika : "le choix du nombre de notes dans l'arp") : la
 * longueur du motif. ALL : toutes les notes de l'accord sur RANGE octaves,
 * dans l'ordre du MODE ; 1 a 8 : les N premieres de cette suite, puis le
 * motif reprend (au-dela de la suite, elle reboucle) ; 3 notes sur des
 * doubles croches tournent contre la mesure.
 *
 * FINE desaccorde les deux oscillateurs l'un contre l'autre, de part et
 * d'autre de la note : le centre reste juste, le son grossit sans jamais
 * sortir de la tonalite (la demande de Mika).
 */

export type VoyKnobId =
  | 'rate'
  | 'mode'
  | 'range'
  | 'notes'
  | 'gate'
  | 'wave1'
  | 'wave2'
  | 'tune2'
  | 'mix'
  | 'fm'
  | 'ratio'
  | 'fine'
  | 'octave'
  | 'glide'
  | 'cutoff'
  | 'res'
  | 'envAmt'
  | 'noise'
  | 'slope'
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
export const OCTAVES = ['-2', '-1', '0', '+1', '+2'] as const;
/**
 * Deux oscillateurs facon Dreadbox Typhon (2026-10-03, Mika) : une forme
 * par cran, dessinee autour du selecteur. OSC 1 a la FM en dernier cran (sa
 * sinusoide modulee par OSC 2).
 */
export const WAVES1 = ['SINE', 'TRI', 'SAW', 'SQUARE', 'PULSE', 'FM'] as const;
export const WAVES2 = ['SINE', 'TRI', 'SAW', 'SQUARE', 'PULSE'] as const;
/** TUNE 2 : OSC 2 par crans musicaux, toujours dans la tonalite (octave dessous, unisson, quinte, une et deux octaves). */
export const TUNES2 = ['-1 OCT', '0', '5TH', '+1 OCT', '+2 OCT'] as const;
const TUNE2_SEMI = [-12, 0, 7, 12, 24] as const;
/** SLOPE : la pente du filtre (2026-10-03), 2 ou 4 poles. */
export const SLOPES = ['12 dB', '24 dB'] as const;
/** RATIO : frequence de l'operateur FM / OSC 1, des rapports harmoniques (le son reste dans la tonalite). */
export const RATIOS = ['1/2', '1', '3/2', '2', '3', '7/2', '4', '5', '7'] as const;
const RATIO_X = [0.5, 1, 1.5, 2, 3, 3.5, 4, 5, 7] as const;
export const NOTES = ['ALL', '1', '2', '3', '4', '5', '6', '7', '8'] as const;

/** Dans l'ordre de lecture du panneau (et de tabulation des jumeaux). */
export const VOY_KNOBS: readonly VoyKnob[] = [
  { id: 'rate', label: 'RATE', aria: 'Arpeggiator rate', section: 'arp', def: 2 / 3, steps: RATES },
  { id: 'mode', label: 'MODE', aria: 'Arpeggiator mode', section: 'arp', def: 0, steps: MODES },
  { id: 'range', label: 'RANGE', aria: 'Arpeggiator range', section: 'arp', def: 0.5, steps: RANGES },
  { id: 'notes', label: 'NOTES', aria: 'Arpeggiator notes, how many before the pattern starts again', section: 'arp', def: 0, steps: NOTES },
  { id: 'gate', label: 'GATE', aria: 'Arpeggiator gate length', section: 'arp', def: 0.5 },
  { id: 'wave1', label: 'WAVE 1', aria: 'Oscillator 1 wave: sine, triangle, saw, square, pulse, FM', section: 'osc', def: 2 / 5, steps: WAVES1 },
  { id: 'wave2', label: 'WAVE 2', aria: 'Oscillator 2 wave: sine, triangle, saw, square, pulse', section: 'osc', def: 2 / 4, steps: WAVES2 },
  { id: 'tune2', label: 'TUNE 2', aria: 'Oscillator 2 tuning: octave down, unison, fifth, one or two octaves up', section: 'osc', def: 0, steps: TUNES2 },
  { id: 'mix', label: 'MIX', aria: 'Oscillator mix, 1 to 2', section: 'osc', def: 0.5 },
  { id: 'fm', label: 'FM', aria: 'FM amount, a sine operator modulates oscillator 1, shaped by the filter envelope', section: 'osc', def: 0 },
  { id: 'ratio', label: 'RATIO', aria: 'FM ratio, the operator frequency against oscillator 1', section: 'osc', def: 1 / 8, steps: RATIOS },
  { id: 'fine', label: 'FINE', aria: 'Fine tune, the two oscillators apart, always in key', section: 'osc', def: 0.35 },
  { id: 'octave', label: 'OCTAVE', aria: 'Octave', section: 'osc', def: 0.5, steps: OCTAVES },
  { id: 'glide', label: 'GLIDE', aria: 'Glide between notes', section: 'osc', def: 0 },
  { id: 'cutoff', label: 'CUTOFF', aria: 'Filter cutoff', section: 'filter', def: 0.5, big: true },
  { id: 'res', label: 'RES', aria: 'Filter resonance', section: 'filter', def: 0.35 },
  { id: 'envAmt', label: 'ENV AMT', aria: 'Filter envelope amount', section: 'filter', def: 0.5 },
  { id: 'noise', label: 'NOISE', aria: 'Noise level into the filter', section: 'filter', def: 0 },
  { id: 'slope', label: 'SLOPE', aria: 'Filter slope, 12 or 24 dB per octave, tap to switch', section: 'filter', def: 1, steps: SLOPES },
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
/** Glissement entre deux notes (s) : jusqu'a 0.6 s, bien audible des le premier quart. */
export const glideS = (v: number): number => (v <= 0 ? 0 : 0.015 + v * v * 0.6);
/** Desaccord total entre les deux oscillateurs (cents), centre sur la note : jusqu'a 45, le gros son Moog. */
export const fineCents = (v: number): number => v * 45;
/** Duree d'une note de l'arpege, en fraction de l'intervalle entre deux notes. */
export const gateFrac = (v: number): number => 0.08 + 0.92 * v;
/** Pas de 16e par note : 1/4 = 4, 1/8 = 2, 1/16 = 1, 1/32 = 0.5. */
export const stepsPerNote = (v: number): number => [4, 2, 1, 0.5][stepIndex('rate', v)];
export const octaves = (v: number): number => stepIndex('range', v) + 1;
/** NOTES : longueur du motif (0 : ALL, toute la suite). */
export const notesCount = (v: number): number => stepIndex('notes', v);
/** OCTAVE : -2 a +2 octaves (le centre : l'octave d'origine). */
export const octaveShift = (v: number): number => stepIndex('octave', v) - 2;
/** TUNE 2 en demi-tons. */
export const tune2Semi = (v: number): number => TUNE2_SEMI[stepIndex('tune2', v)];
/** RATIO en multiple de la frequence d'OSC 1. */
export const fmRatio = (v: number): number => RATIO_X[stepIndex('ratio', v)];

/**
 * Les reglages du moteur (audio/moog.worklet.js), en unites physiques :
 * secondes, hertz, octaves. Envoyes au moteur a chaque changement.
 */
export interface EngineParams {
  /** formes : index de WAVES1 et WAVES2 */
  wave1: number;
  wave2: number;
  /** OSC 2 en demi-tons ; MIX 0 (OSC 1) a 1 (OSC 2) */
  tune2: number;
  mix: number;
  /** FM : 0 a 1 (l'indice suit l'enveloppe du filtre) ; RATIO : operateur / OSC 1 */
  fm: number;
  ratio: number;
  fine: number;
  glide: number;
  cutoff: number;
  res: number;
  envOct: number;
  /** NOISE : 0 a 1 ; SLOPE : 0 = 12 dB, 1 = 24 dB */
  noise: number;
  slope: number;
  fA: number;
  fD: number;
  fS: number;
  fR: number;
  aA: number;
  aD: number;
  aS: number;
  aR: number;
  drive: number;
}

export function engineParams(v: Readonly<VoyValues>): EngineParams {
  return {
    wave1: stepIndex('wave1', v.wave1),
    wave2: stepIndex('wave2', v.wave2),
    tune2: tune2Semi(v.tune2),
    mix: v.mix,
    fm: v.fm,
    ratio: fmRatio(v.ratio),
    fine: fineCents(v.fine),
    glide: glideS(v.glide),
    cutoff: cutoffHz(v.cutoff),
    res: v.res,
    envOct: envOctaves(v.envAmt),
    noise: v.noise,
    slope: stepIndex('slope', v.slope),
    fA: attackS(v.fA),
    fD: decayS(v.fD),
    fS: v.fS,
    fR: releaseS(v.fR),
    aA: attackS(v.aA),
    aD: decayS(v.aD),
    aS: v.aS,
    aR: releaseS(v.aR),
    drive: v.dist,
  };
}

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

export const VOY_STORAGE_KEY = 'mm.v4.voyager.1';
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
