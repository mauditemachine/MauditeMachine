/**
 * Les potards du MM-BASS (2026-10-07), tous de 0 a 1 dans le store (retenus
 * sous mm.v4.bass.params), en trois familles :
 * - FILTER, ceux de la TB-303 : CUTOFF (le grand, comme sur le Minitaur),
 *   RESO, ENV MOD, DECAY, ACCENT ;
 * - VOICE : WAVE (dent de scie vers carre), SUB (un sinus une octave sous la
 *   note), DRIVE, GLIDE (la duree d'un SLIDE), VOLUME, OCTAVE (de -2 a +1 :
 *   les subs descendent jusqu'a 20 Hz) ;
 * - GENERATOR, facon Torso T-1 : STYLE (onze styles de musique electronique,
 *   2026-10-07, Mika : "des styles de musique electro differents, et pas juste
 *   Disco" : ACID, DARK DISCO, INDIE DANCE, MINIMAL, PSY PROG, TECHNO, HOUSE,
 *   ELECTRO, EBM, ITALO, SUB), DENSITY,
 *   SLIDES, ACCENTS (leurs chances), RANGE (l'etendue en octaves), ROOT (la
 *   tonique, ou ARP : elle suit les accords du MM-ARP), SCALE.
 *
 * La refonte facon Monark et Elektron (2026-10-08, Mika : "MM-BASS est un
 * peu complexe ; je m'attendais plus a une machine qui ressemble a un MONARK
 * de Native Instruments qu'a un T-1 incomprehensible ; j'aime Elektron :
 * quelque chose d'intuitif, pour qu'on ne cherche pas les choses ; un bouton
 * OPEN avec des parametres plus particuliers") : la face garde le son dans
 * l'ordre du signal et STYLE, DENSITY ; les regles du generateur (SLIDE
 * PROB, ACC PROB, RANGE, ROOT, SCALE) passent sous le capot (plate), avec
 * six reglages fins de la voix qui etaient des constantes du worklet
 * (LENGTH, ACC DECAY, SWEEP, RELEASE, SUB OCT, TUNE ; leur defaut est
 * l'ancienne constante, le son ne change pas). Les ids ne changent pas
 * (stockage, presets, MIDI, Roto) ; SLIDES et ACCENTS s'appellent SLIDE PROB
 * et ACC PROB (ils se confondaient avec SLIDE, GLIDE et ACCENT).
 *
 * La machine Elektron (2026-10-08, Mika : "faire comme un principe de machine
 * elektron : quand on clique sur un step on selectionne la partie qu'on veut
 * modifier, est-ce que le voice, est-ce que le FX, est-ce que l'enveloppe, et
 * ensuite on tourne un encodeur ; les valeurs des knobs sont a l'ecran, pas
 * sur les encodeurs, de 0 a 127") : les potards du son quittent la face pour
 * quatre pages de huit encodeurs (bass/pages.ts) ; la face ne garde en
 * potards dedies que STYLE et DENSITY (face). Onze reglages de plus, tous a
 * zero d'effet par defaut (le son d'avant, verifie hors ligne) : PW (la
 * largeur du carre), KEY TRK (la coupure suit la note), une vraie enveloppe
 * d'ampli (ATTACK, AMP DECAY, SUSTAIN ; RELEASE existait), un DELAY et une
 * REVERB dans la voix (envois, temps, retour, taille, couleur). L'ecran les
 * montre de 0 a 127 (bassCC), -64 a +63 pour TUNE, leur nom pour les crans,
 * et l'unite dessous (bassUnit).
 */

export type BassKnobId =
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
  | 'octave'
  | 'style'
  | 'density'
  | 'slides'
  | 'accents'
  | 'range'
  | 'root'
  | 'scale'
  | 'length'
  | 'accdecay'
  | 'sweep'
  | 'release'
  | 'suboct'
  | 'tune'
  | 'pw'
  | 'keytrack'
  | 'attack'
  | 'adecay'
  | 'sustain'
  | 'delay'
  | 'dtime'
  | 'dfb'
  | 'reverb'
  | 'rsize'
  | 'rtone';

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
  /** sous le capot (OPEN), sur la plaque TWEAKS, pas sur la face (2026-10-08) */
  plate?: boolean;
  /** un potard dedie sur la face (STYLE, DENSITY) ; les autres reglages du son passent par les encodeurs (2026-10-08) */
  face?: boolean;
}

export const BASS_STYLES = ['ACID', 'DARK DISCO', 'INDIE DANCE', 'MINIMAL', 'PSY PROG', 'TECHNO', 'HOUSE', 'ELECTRO', 'EBM', 'ITALO', 'SUB'] as const;
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
export const BASS_SUBOCTS = ['-1', '-2'] as const;
/** DLY TIME (2026-10-08) : en pas du tempo, de la double croche a la blanche (3/16 : la croche pointee, l'echo des dub). */
export const BASS_DTIMES = ['1/16', '1/8', '3/16', '1/4', '3/8', '1/2'] as const;
export const DTIME_STEPS: readonly number[] = [1, 2, 3, 4, 6, 8];

/* Les reglages fins de la voix (2026-10-08) : leurs lois (0 a 1 vers l'unite), le worklet fait les memes. */
/** LENGTH : 0 AUTO (la longueur du style), sinon 10 a 100 % du pas. */
export const lengthPct = (v: number): number | null => (v < 0.02 ? null : 10 + 90 * v);
/** ACC DECAY : 80 a 600 ms (200 : la 303). */
export const accDecayMs = (v: number): number => 80 * Math.pow(600 / 80, v);
/** SWEEP : la charge des accents qui se suivent, 0 a 4 octaves (2.2 : l'ancienne constante). */
export const sweepOct = (v: number): number => 4 * v;
/** RELEASE : 6 a 400 ms (14 : l'ancienne constante). */
export const releaseMs = (v: number): number => 6 * Math.pow(400 / 6, v);
/** TUNE : -50 a +50 cents. */
export const tuneCents = (v: number): number => (v - 0.5) * 100;
/* Les reglages de la machine Elektron (2026-10-08) : les memes lois que le worklet. */
/** PW : la largeur du carre, 50 a 95 % (50 : le carre d'avant). */
export const pwPct = (v: number): number => 50 + 45 * v;
/** ATTACK : 0.5 ms a 1 s (2.5 ms : l'ancienne constante du VCA). */
export const attackMs = (v: number): number => 0.5 * Math.pow(1000 / 0.5, v);
/** AMP DECAY : 20 ms a 4 s, vers SUSTAIN. */
export const adecayMs = (v: number): number => 20 * Math.pow(4000 / 20, v);
/** REV SIZE : la duree de la reverb (RT60), 0.3 a 8 s. */
export const rsizeS = (v: number): number => 0.3 * Math.pow(8 / 0.3, v);
/** REV TONE : l'amorti des aigus de la reverb, 800 Hz a 12 kHz. */
export const rtoneHz = (v: number): number => 800 * Math.pow(12000 / 800, v);
/** DLY FB : le retour du delai, 0 a 90 %. */
export const dfbPct = (v: number): number => 90 * v;
/** La valeur d'un potard pour une valeur voulue (les defauts = les anciennes constantes). */
const inv = (lo: number, hi: number, x: number): number => Math.log(x / lo) / Math.log(hi / lo);

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
  { id: 'style', label: 'STYLE', aria: 'Generator style: acid, dark disco, indie dance, minimal, psy prog, techno, house, electro, EBM, italo or sub', def: 0, steps: BASS_STYLES.length, names: BASS_STYLES, face: true },
  { id: 'density', label: 'DENSITY', aria: 'Generator density: how many notes', def: 0.6, face: true },
  { id: 'slides', label: 'SLIDE PROB', aria: 'Generator: chance of a slide when GEN writes a line', def: 0.3, plate: true },
  { id: 'accents', label: 'ACC PROB', aria: 'Generator: chance of an accent when GEN writes a line', def: 0.35, plate: true },
  { id: 'range', label: 'RANGE', aria: 'Generator: range in octaves', def: 0.5, steps: 3, names: BASS_RANGES, plate: true },
  { id: 'root', label: 'ROOT', aria: 'Root note, or ARP: follow the MM-ARP chords', def: 1 / 12, steps: 13, names: BASS_ROOTS, plate: true },
  { id: 'scale', label: 'SCALE', aria: 'Scale', def: 0, steps: 5, names: BASS_SCALES, plate: true },
  { id: 'length', label: 'LENGTH', aria: 'Note length: AUTO follows the style, or 10 to 100 percent of a step', def: 0, plate: true },
  { id: 'accdecay', label: 'ACC DECAY', aria: 'Filter decay of the accented notes, 80 to 600 milliseconds', def: inv(80, 600, 200), plate: true },
  { id: 'sweep', label: 'SWEEP', aria: 'Accent sweep: how high successive accents push the filter, 0 to 4 octaves', def: 2.2 / 4, plate: true },
  { id: 'release', label: 'RELEASE', aria: 'Release of a note, 6 to 400 milliseconds', def: inv(6, 400, 14), plate: true },
  { id: 'suboct', label: 'SUB OCT', aria: 'Sub oscillator octave: one or two below the note', def: 0, steps: 2, names: BASS_SUBOCTS, plate: true },
  { id: 'tune', label: 'TUNE', aria: 'Fine tune, minus 50 to plus 50 cents', def: 0.5, bipolar: true, plate: true },
  // La machine Elektron (2026-10-08) : a zero d'effet par defaut (le son d'avant)
  { id: 'pw', label: 'PW', aria: 'Pulse width of the square wave, 50 to 95 percent', def: 0 },
  { id: 'keytrack', label: 'KEY TRK', aria: 'Key tracking: the cutoff follows the note', def: 0 },
  { id: 'attack', label: 'ATTACK', aria: 'Amp attack, half a millisecond to one second', def: inv(0.5, 1000, 2.5) },
  { id: 'adecay', label: 'AMP DECAY', aria: 'Amp decay toward the sustain level, 20 milliseconds to 4 seconds', def: inv(20, 4000, 400) },
  { id: 'sustain', label: 'SUSTAIN', aria: 'Amp sustain level', def: 1 },
  { id: 'delay', label: 'DELAY', aria: 'Delay send', def: 0 },
  { id: 'dtime', label: 'DLY TIME', aria: 'Delay time in steps of the tempo, a sixteenth to a half note', def: 2 / 5, steps: BASS_DTIMES.length, names: BASS_DTIMES },
  { id: 'dfb', label: 'DLY FB', aria: 'Delay feedback, 0 to 90 percent', def: 0.5 },
  { id: 'reverb', label: 'REVERB', aria: 'Reverb send', def: 0 },
  { id: 'rsize', label: 'REV SIZE', aria: 'Reverb length, 0.3 to 8 seconds', def: inv(0.3, 8, 2) },
  { id: 'rtone', label: 'REV TONE', aria: 'Reverb tone: how much treble the tail keeps, 800 hertz to 12 kilohertz', def: inv(800, 12000, 4000) },
];

/** Les potards dedies de la face (STYLE, DENSITY depuis la machine Elektron), et ceux de la plaque sous le capot (2026-10-08). */
export const BASS_FACE_KNOBS: readonly BassKnobDef[] = BASS_KNOBS.filter((k) => k.face);
export const BASS_PLATE_KNOBS: readonly BassKnobDef[] = BASS_KNOBS.filter((k) => k.plate);

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
  if (id === 'length') {
    const l = lengthPct(v);
    return l === null ? 'AUTO' : `${Math.round(l)} %`;
  }
  if (id === 'accdecay') return `${Math.round(accDecayMs(v))} MS`;
  if (id === 'sweep') return `${sweepOct(v).toFixed(1)} OCT`;
  if (id === 'release') return `${Math.round(releaseMs(v))} MS`;
  if (id === 'tune') {
    const c = Math.round(tuneCents(v));
    return c === 0 ? '0 CT' : `${c > 0 ? '+' : ''}${c} CT`;
  }
  if (id === 'wave') return v < 0.03 ? 'SAW' : v > 0.97 ? 'SQUARE' : pct(v);
  if (id === 'pw') return `${Math.round(pwPct(v))} %`;
  if (id === 'attack') return msText(attackMs(v));
  if (id === 'adecay') return msText(adecayMs(v));
  if (id === 'sustain') return v >= 0.999 ? 'FULL' : v <= 0.001 ? 'OFF' : `${Math.round(v * 100)} %`;
  if (id === 'rsize') return `${rsizeS(v).toFixed(1)} S`;
  if (id === 'rtone') return hzText(rtoneHz(v));
  if (id === 'dfb') return `${Math.round(dfbPct(v))} %`;
  if ((id === 'delay' || id === 'reverb') && v <= 0.001) return 'OFF';
  return pct(v);
}

const msText = (ms: number): string => (ms < 10 ? `${ms.toFixed(1)} MS` : ms < 1000 ? `${Math.round(ms)} MS` : `${(ms / 1000).toFixed(2)} S`);
const hzText = (hz: number): string => (hz >= 1000 ? `${(hz / 1000).toFixed(1)} KHZ` : `${Math.round(hz)} HZ`);
const dbText = (db: number): string => `${db >= 0 ? '+' : ''}${db.toFixed(1)} DB`;

/**
 * Le nombre de l'ecran, facon Elektron (2026-10-08, Mika : "les valeurs des
 * knobs sont a l'ecran, de 0 a 127") : round(v x 127), -64 a +63 pour un
 * reglage bipolaire (TUNE). Le MIDI ecrit v = cc / 127 : le nombre lu est
 * celui du controleur.
 */
export function bassCC(id: BassKnobId, v: number): number {
  const n = Math.round(Math.min(1, Math.max(0, v)) * 127);
  return bassKnob(id).bipolar ? n - 64 : n;
}

/** Le grand texte d'un bloc : le nombre (signe s'il est bipolaire), ou le nom du cran (-1 OCT, 3/16...). */
export function bassBig(id: BassKnobId, v: number): string {
  const k = bassKnob(id);
  if (k.names) {
    const n = k.names[stepOf(id, v)];
    return id === 'octave' || id === 'suboct' ? `${n} OCT` : n;
  }
  const c = bassCC(id, v);
  return k.bipolar && c > 0 ? `+${c}` : String(c);
}

/** La ligne d'unite sous le nombre (216 MS, 1.2 KHZ...) ; bpm pour les temps du tempo (DLY TIME). */
export function bassUnit(id: BassKnobId, v: number, bpm = 120): string {
  switch (id) {
    case 'wave':
      return v < 0.03 ? 'SAW' : v > 0.97 ? 'SQUARE' : `SAW ${100 - Math.round(v * 100)} / SQ ${Math.round(v * 100)}`;
    case 'sub':
      return v <= 0.001 ? 'OFF' : dbText(20 * Math.log10(v));
    case 'volume':
      return v <= 0.001 ? 'OFF' : dbText(40 * Math.log10(v));
    case 'envmod':
      return `+${(5 * v).toFixed(1)} OCT`;
    case 'reso':
    case 'accent':
    case 'drive':
    case 'keytrack':
    case 'density':
    case 'slides':
    case 'accents':
      return `${Math.round(v * 100)} %`;
    case 'sustain':
      return v >= 0.999 ? '0 DB' : v <= 0.001 ? 'OFF' : dbText(20 * Math.log10(v));
    case 'delay':
    case 'reverb':
      return v <= 0.001 ? 'OFF' : `SEND ${Math.round(v * 100)} %`;
    case 'dfb':
      return `FEEDBACK ${Math.round(dfbPct(v))} %`;
    case 'dtime':
      return msText((60 / Math.max(20, bpm) / 4) * DTIME_STEPS[stepOf('dtime', v)] * 1000);
    case 'octave':
      return 'WHOLE LINE';
    case 'suboct':
      return 'SINE BELOW';
    default:
      return bassValueText(id, v);
  }
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
