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
 *
 * Le moteur MONARK (2026-10-09, Mika : "je veux vraiment un son a la MONARK
 * de Native Instruments ! BASS doit etre vraiment bon !") : une voix de
 * Minimoog Model D (bass/bass.worklet.js), MODE (fmode) choisit la sortie de
 * l'echelle (LP24, LP12, LP6, BP) ou la 303 d'avant. Dix-huit reglages de
 * plus : OSC 1 (son niveau), OSC 2 et OSC 3 (forme, RANGE en pieds, SEMI,
 * FINE, niveau), NOISE, FEEDBACK, DRIFT, MODE, F.ATTACK, F.SUSTAIN,
 * POLARITY. Chaque reglage a une valeur d'heritage (legacy : celle qui rend
 * le son d'avant, MODE 303) : un enregistrement d'avant qui n'a pas la cle la
 * prend (le son d'avant revient), une premiere visite prend def (le patch de
 * depart MM CLASSIC, sound.md section 8). Les defauts du son changent donc
 * (CUTOFF 140 Hz, EMPH 0.2, LOAD 0.55...), leur legacy garde l'ancien. Les
 * lois sont ici, exportees avec leur inverse (state/factory.ts BU,
 * bass/diagrams.ts, bass/screen.ts et les outils hors ligne s'en servent au
 * lieu de recopier des constantes) ; DECAY, GLIDE, DRIVE et ENV MOD se lisent
 * selon le MODE global (bassValueText, bassUnit). WAVE et PW s'appellent
 * OSC 1 WAVE et OSC 1 PW (les ids ne changent pas).
 */

import { BASS_LEGACY_SOUNDS } from '../state/bassLegacy';

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
  | 'rtone'
  // Le moteur MONARK (2026-10-09)
  | 'o1lvl'
  | 'o2wave'
  | 'o2range'
  | 'o2semi'
  | 'o2fine'
  | 'o2lvl'
  | 'o3wave'
  | 'o3range'
  | 'o3semi'
  | 'o3fine'
  | 'o3lvl'
  | 'noise'
  | 'feedback'
  | 'drift'
  | 'fmode'
  | 'fattack'
  | 'fsustain'
  | 'fpol';

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
  /**
   * la valeur qui rend le moteur d'avant le 2026-10-09 (MODE 303) : celle que prend un enregistrement ou un preset
   * d'avant qui n'a pas la cle ; absente : def (le reglage n'a pas change)
   */
  legacy?: number;
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
/** ATTACK (et F.ATTACK) : 0.5 ms a 1 s (2.5 ms : l'ancienne constante du VCA ; l'echelle : le temps du plein). */
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
const c01 = (v: number): number => Math.min(1, Math.max(0, v));

/* ---------------- les lois du moteur MONARK (2026-10-09), les memes que bass.worklet.js ---------------- */

/** MODE : la sortie de l'echelle (24, 12, 6 dB par octave, passe-bande) ou la 303 d'avant. */
export const BASS_MODES = ['LP24', 'LP12', 'LP6', 'BP', '303'] as const;
export type BassMode = (typeof BASS_MODES)[number];
/** Les formes d'OSC 2 (Model D) ; OSC 3 a REV SAW (la dent de scie montante) a la place de SHARK. */
export const OSC2_WAVES = ['TRI', 'SHARK', 'SAW', 'SQR', 'WIDE', 'NARROW'] as const;
export const OSC3_WAVES = ['TRI', 'REV SAW', 'SAW', 'SQR', 'WIDE', 'NARROW'] as const;
/** RANGE en pieds d'orgue : 32' une octave sous la note, 16' la note (OSC 1), 8' et 4' au-dessus. */
export const BASS_FEET = ["32'", "16'", "8'", "4'"] as const;
/** SEMI : -7 a +7 demi-tons. */
export const BASS_SEMIS = ['-7', '-6', '-5', '-4', '-3', '-2', '-1', '0', '+1', '+2', '+3', '+4', '+5', '+6', '+7'] as const;
/** POLARITY du contour du filtre (Monark) : il ouvre (POS) ou ferme (NEG). */
export const BASS_POLS = ['POS', 'NEG'] as const;

/** CUTOFF : 60 Hz a 6 kHz (les deux moteurs). */
export const cutoffHz = (v: number): number => 60 * Math.pow(100, c01(v));
export const cutoffOf = (hz: number): number => c01(inv(60, 6000, hz));
/** RESO de l'echelle : l'emphase EMPH = v^1.5, le retour k = 4.3 EMPH (auto-oscillation des 0.953, CC 121). */
export const emphOf = (v: number): number => Math.pow(c01(v), 1.5);
export const resoOfEmph = (e: number): number => c01(Math.pow(Math.max(0, e), 2 / 3));
/** RESO de la 303 : la courbe d'Open303. */
export const reso303 = (v: number): number => (1 - Math.exp(-3 * c01(v))) / (1 - Math.exp(-3));
/** ENV MOD : l'amplitude du contour, 0 a 5 octaves (son signe : POLARITY, sur l'echelle). */
export const envOct = (v: number): number => 5 * c01(v);
/** DECAY : l'echelle, une constante de temps de 10 ms a 2.5 s ; la 303, 120 ms a 2.5 s (en ms). */
export const decayMs = (v: number, mode: BassMode): number => (mode === '303' ? 120 * Math.pow(2500 / 120, c01(v)) : 10 * Math.pow(250, c01(v)));
export const decayOfTau = (ms: number, mode: BassMode): number => c01(mode === '303' ? inv(120, 2500, ms) : inv(10, 2500, ms));
/** ATTACK et F.ATTACK pour une duree voulue (ms). */
export const attackOfMs = (ms: number): number => c01(inv(0.5, 1000, ms));
/** GLIDE : 12 a 350 ms (l'echelle : par octave, Monark MM ; la 303 : le temps du glisse). */
export const glideMs = (v: number): number => 12 * Math.pow(350 / 12, c01(v));
export const glideOfMs = (ms: number): number => c01(inv(12, 350, ms));
/** DRIVE de l'echelle (LOAD) : le melangeur pousse l'entree, 0.5x a 4x, +18 dB sur la course (rattrape en sortie). */
export const loadGain = (v: number): number => 0.5 * Math.pow(8, c01(v));
export const loadDb = (v: number): number => 20 * Math.log10(Math.pow(8, c01(v)));
/** Le rattrapage de LOAD en sortie (bass.worklet.js MAKEUP). */
export const LOAD_MAKEUP = 0.45;
/** DRIVE de la 303 : la saturation apres le filtre, x (1 + 14 v^2). */
export const driveGain = (v: number): number => 1 + 14 * c01(v) * c01(v);
/** OSC 2 et OSC 3 : la forme par son nom (OSC 3 : REV SAW au rang 1). */
export function waveOf(name: string): number {
  const i = name === 'REV SAW' ? 1 : (OSC2_WAVES as readonly string[]).indexOf(name);
  return i < 0 ? 0.4 : i / 5;
}
/** RANGE : le rang 0 a 3 (32' a 4'), son octave par rapport a la note. */
export const rangeOf = (ft: string): number => Math.max(0, (BASS_FEET as readonly string[]).indexOf(ft)) / 3;
export const rangeOct = (v: number): number => [-1, 0, 1, 2][Math.round(c01(v) * 3)];
/** SEMI : -7 a +7. */
export const semiOf = (st: number): number => c01((Math.round(st) + 7) / 14);
export const semiSt = (v: number): number => Math.round(c01(v) * 14) - 7;
/** FINE : -50 a +50 cents. */
export const fineOf = (ct: number): number => c01(0.5 + ct / 100);
export const fineCt = (v: number): number => (c01(v) - 0.5) * 100;
/** MODE : le rang de son nom, et l'inverse. */
export const modeOf = (name: BassMode): number => BASS_MODES.indexOf(name) / (BASS_MODES.length - 1);
export const modeName = (v: number): BassMode => BASS_MODES[Math.round(c01(v) * (BASS_MODES.length - 1))];
/** POLARITY : POS 0, NEG 1. */
export const polOf = (name: (typeof BASS_POLS)[number]): number => (name === 'NEG' ? 1 : 0);
/** Un niveau du melangeur en dB (lineaire), NOISE au carre du potard. */
export const levelDb = (v: number): number => 20 * Math.log10(Math.max(1e-6, c01(v)));
export const noiseDb = (v: number): number => 40 * Math.log10(Math.max(1e-6, c01(v)));
/**
 * La reponse de l'echelle (2026-10-09, le prototype analogique de bass.worklet.js) a f / fc = ratio, RESO v : LP24
 * H(s) = (1 + c k) / ((1 + s)^4 + k), s = j ratio ; LP12 x (1 + s)^2 / (1 + 0.12 k), LP6 x 0.8 (1 + s)^3 / (1 + 0.12 k),
 * BP x 1.25 s (1 + s)^2 / (1 + 0.12 k) ; le module (1 : 0 dB). Les dessins du filtre (bass/screen.ts, bass/diagrams.ts).
 */
export function ladderMag(ratio: number, v: number, mode: Exclude<BassMode, '303'>): number {
  const k = 4.3 * emphOf(v);
  const r2 = 1 + ratio * ratio;
  const th = Math.atan(ratio);
  const r4 = r2 * r2;
  const re = r4 * Math.cos(4 * th) + k;
  const im = r4 * Math.sin(4 * th);
  const h24 = (1 + 0.5 * k) / Math.sqrt(re * re + im * im);
  const tap = 1 / (1 + 0.12 * k);
  if (mode === 'LP12') return h24 * r2 * tap;
  if (mode === 'LP6') return 0.8 * h24 * Math.pow(r2, 1.5) * tap;
  if (mode === 'BP') return 1.25 * h24 * ratio * r2 * tap;
  return h24;
}

/** L'intervalle d'un SEMI, en un mot. */
export function semiName(st: number): string {
  const a = Math.abs(st);
  const w = a === 0 ? 'UNISON' : a === 3 ? 'MIN 3RD' : a === 4 ? 'MAJ 3RD' : a === 5 ? 'FOURTH' : a === 7 ? 'FIFTH' : 'ST';
  return a === 0 || w === 'ST' ? w : st < 0 ? `${w} DOWN` : w;
}

export const BASS_KNOBS: readonly BassKnobDef[] = [
  // Le patch de depart MM CLASSIC (2026-10-09, sound.md section 8) ; legacy : le defaut d'avant, la 303
  { id: 'cutoff', label: 'CUTOFF', aria: 'Filter cutoff', def: 0.184, legacy: 0.32 },
  { id: 'reso', label: 'RESO', aria: 'Filter resonance, the emphasis of the ladder', def: 0.342, legacy: 0.62 },
  { id: 'envmod', label: 'ENV MOD', aria: 'Filter contour amount, in octaves', def: 0.52, legacy: 0.55 },
  { id: 'decay', label: 'DECAY', aria: 'Filter contour decay', def: 0.314, legacy: 0.42 },
  { id: 'accent', label: 'ACCENT', aria: 'Accent amount', def: 0.5, legacy: 0.65 },
  { id: 'wave', label: 'OSC 1 WAVE', aria: 'Oscillator 1 waveform, saw to square', def: 0 },
  { id: 'sub', label: 'SUB', aria: 'Sub oscillator level, a clean sine one octave below', def: 0, legacy: 0.35 },
  { id: 'drive', label: 'DRIVE', aria: 'Drive: the mixer loads the ladder filter (MODE 303: after the filter)', def: 0.55, legacy: 0.18 },
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
  { id: 'sweep', label: 'SWEEP', aria: 'Accent sweep: how high successive accents push the filter, 0 to 4 octaves', def: 0.15, legacy: 2.2 / 4, plate: true },
  { id: 'release', label: 'RELEASE', aria: 'Release of a note, 6 to 400 milliseconds', def: 0.287, legacy: inv(6, 400, 14), plate: true },
  { id: 'suboct', label: 'SUB OCT', aria: 'Sub oscillator octave: one or two below the note', def: 0, steps: 2, names: BASS_SUBOCTS, plate: true },
  { id: 'tune', label: 'TUNE', aria: 'Fine tune, minus 50 to plus 50 cents', def: 0.5, bipolar: true, plate: true },
  // La machine Elektron (2026-10-08) : a zero d'effet par defaut (le son d'avant)
  { id: 'pw', label: 'OSC 1 PW', aria: 'Oscillator 1 pulse width, 50 to 95 percent', def: 0 },
  { id: 'keytrack', label: 'KEY TRK', aria: 'Key tracking: the cutoff follows the note (Moog: one third, two thirds)', def: 0.33, legacy: 0 },
  { id: 'attack', label: 'ATTACK', aria: 'Amp attack, half a millisecond to one second', def: 0.091, legacy: inv(0.5, 1000, 2.5) },
  { id: 'adecay', label: 'AMP DECAY', aria: 'Amp decay toward the sustain level, 20 milliseconds to 4 seconds', def: 0.354, legacy: inv(20, 4000, 400) },
  { id: 'sustain', label: 'SUSTAIN', aria: 'Amp sustain level', def: 0.85, legacy: 1 },
  { id: 'delay', label: 'DELAY', aria: 'Delay send', def: 0 },
  { id: 'dtime', label: 'DLY TIME', aria: 'Delay time in steps of the tempo, a sixteenth to a half note', def: 2 / 5, steps: BASS_DTIMES.length, names: BASS_DTIMES },
  { id: 'dfb', label: 'DLY FB', aria: 'Delay feedback, 0 to 90 percent', def: 0.5 },
  { id: 'reverb', label: 'REVERB', aria: 'Reverb send', def: 0 },
  { id: 'rsize', label: 'REV SIZE', aria: 'Reverb length, 0.3 to 8 seconds', def: inv(0.3, 8, 2) },
  { id: 'rtone', label: 'REV TONE', aria: 'Reverb tone: how much treble the tail keeps, 800 hertz to 12 kilohertz', def: inv(800, 12000, 4000) },
  // Le moteur MONARK (2026-10-09) : legacy, le son d'avant (OSC 2, OSC 3, NOISE, FEEDBACK, DRIFT a 0, MODE 303)
  { id: 'o1lvl', label: 'OSC 1', aria: 'Oscillator 1 level in the mixer', def: 0.9, legacy: 1 },
  { id: 'o2wave', label: 'OSC 2 WAVE', aria: 'Oscillator 2 waveform: triangle, shark, saw, square, wide or narrow pulse', def: 0.4, steps: 6, names: OSC2_WAVES },
  { id: 'o2range', label: 'OSC 2 RANGE', aria: 'Oscillator 2 range in feet: 32, 16, 8 or 4', def: 1 / 3, steps: 4, names: BASS_FEET },
  { id: 'o2semi', label: 'OSC 2 SEMI', aria: 'Oscillator 2 interval, minus 7 to plus 7 semitones', def: 0.5, steps: 15, names: BASS_SEMIS },
  { id: 'o2fine', label: 'OSC 2 FINE', aria: 'Oscillator 2 fine tune, minus 50 to plus 50 cents', def: 0.55, legacy: 0.5, bipolar: true },
  { id: 'o2lvl', label: 'OSC 2', aria: 'Oscillator 2 level in the mixer', def: 0.8, legacy: 0 },
  { id: 'o3wave', label: 'OSC 3 WAVE', aria: 'Oscillator 3 waveform: triangle, reverse saw, saw, square, wide or narrow pulse', def: 0.6, steps: 6, names: OSC3_WAVES },
  { id: 'o3range', label: 'OSC 3 RANGE', aria: 'Oscillator 3 range in feet: 32, 16, 8 or 4', def: 0, steps: 4, names: BASS_FEET },
  { id: 'o3semi', label: 'OSC 3 SEMI', aria: 'Oscillator 3 interval, minus 7 to plus 7 semitones', def: 0.5, steps: 15, names: BASS_SEMIS },
  { id: 'o3fine', label: 'OSC 3 FINE', aria: 'Oscillator 3 fine tune, minus 50 to plus 50 cents', def: 0.47, legacy: 0.5, bipolar: true },
  { id: 'o3lvl', label: 'OSC 3', aria: 'Oscillator 3 level in the mixer', def: 0.6, legacy: 0 },
  { id: 'noise', label: 'NOISE', aria: 'Pink noise level in the mixer', def: 0 },
  { id: 'feedback', label: 'FEEDBACK', aria: 'Feedback: the output back into the filter input, warm then gritty', def: 0 },
  { id: 'drift', label: 'DRIFT', aria: 'Analog drift of the oscillators and the cutoff, for the whole machine', def: 0.4, legacy: 0 },
  { id: 'fmode', label: 'MODE', aria: 'Filter mode: ladder 24, 12 or 6 dB, band pass, or the TB-303 filter', def: 0, legacy: 1, steps: 5, names: BASS_MODES },
  { id: 'fattack', label: 'F.ATTACK', aria: 'Filter contour attack, half a millisecond to one second', def: 0 },
  { id: 'fsustain', label: 'F.SUSTAIN', aria: 'Filter contour sustain level', def: 0.15, legacy: 0 },
  { id: 'fpol', label: 'POLARITY', aria: 'Filter contour polarity: it opens the filter, or closes it', def: 0, steps: 2, names: BASS_POLS },
];

/**
 * Les reglages que lit le worklet (2026-10-09) : les 26 d'avant et les 18 du moteur MONARK ; engine.ts les envoie tous a
 * chaque changement, les outils hors ligne aussi.
 */
export const ENGINE_IDS: readonly BassKnobId[] = [
  'pw', 'keytrack', 'attack', 'adecay', 'sustain', 'delay', 'dtime', 'dfb', 'reverb', 'rsize', 'rtone', 'cutoff', 'reso', 'envmod', 'decay', 'accent', 'wave', 'sub', 'drive', 'glide', 'volume', 'accdecay', 'sweep', 'release', 'suboct', 'tune',
  'o1lvl', 'o2wave', 'o2range', 'o2semi', 'o2fine', 'o2lvl', 'o3wave', 'o3range', 'o3semi', 'o3fine', 'o3lvl', 'noise', 'feedback', 'drift', 'fmode', 'fattack', 'fsustain', 'fpol',
];
/** Les 26 reglages du son d'avant le 2026-10-09 (dans l'ordre de state/bassLegacy.ts). */
export const LEGACY_SOUND_IDS: readonly BassKnobId[] = ENGINE_IDS.slice(0, 26);

/** Les potards dedies de la face (STYLE, DENSITY depuis la machine Elektron), et ceux de la plaque sous le capot (2026-10-08). */
export const BASS_FACE_KNOBS: readonly BassKnobDef[] = BASS_KNOBS.filter((k) => k.face);
export const BASS_PLATE_KNOBS: readonly BassKnobDef[] = BASS_KNOBS.filter((k) => k.plate);

export const bassKnob = (id: BassKnobId): BassKnobDef => BASS_KNOBS.find((k) => k.id === id) as BassKnobDef;
/** La valeur d'heritage d'un reglage (le son d'avant le 2026-10-09). */
export const legacyOf = (k: BassKnobDef): number => k.legacy ?? k.def;

/** Le cran d'un potard a crans (0 a steps - 1). */
export const stepOf = (id: BassKnobId, v: number): number => {
  const k = bassKnob(id);
  const n = k.steps ?? 1;
  return Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))));
};

const pct = (v: number): string => `${Math.round(v * 100)}`;

/** Le MODE du moment (global : un verrou ne le change pas) ; DECAY, GLIDE, DRIVE, ENV MOD se lisent selon lui. */
export const bassMode = (): BassMode => modeName(values.fmode);
/** L'echelle du Moog (LP24 a BP) sonne, pas la 303. */
export const bassLadder = (): boolean => bassMode() !== '303';

/** Sa valeur lisible (l'ecran, les jumeaux). */
export function bassValueText(id: BassKnobId, v: number): string {
  const k = bassKnob(id);
  if (k.names) return k.names[stepOf(id, v)];
  if (id === 'cutoff') return hzText(cutoffHz(v));
  if (id === 'decay') return msText(decayMs(v, bassMode()));
  if (id === 'glide') return bassLadder() ? `${Math.round(glideMs(v))} MS/OCT` : `${Math.round(glideMs(v))} MS`;
  if (id === 'drive') return v < 0.02 ? 'CLEAN' : bassLadder() ? `LOAD ${dbText(loadDb(v))}` : `POST ${Math.round(v * 100)} %`;
  if (id === 'envmod') return `${bassLadder() && values.fpol >= 0.5 ? '-' : '+'}${envOct(v).toFixed(1)} OCT`;
  if (id === 'fattack') return msText(attackMs(v));
  if (id === 'fsustain' || id === 'sustain') return v >= 0.999 ? 'FULL' : v <= 0.001 ? 'OFF' : `${Math.round(v * 100)} %`;
  if (id === 'o2fine' || id === 'o3fine') {
    const c = Math.round(fineCt(v));
    return c === 0 ? '0 CT' : `${c > 0 ? '+' : ''}${c} CT`;
  }
  if (id === 'o1lvl' || id === 'o2lvl' || id === 'o3lvl') return v <= 0.001 ? 'OFF' : dbText(levelDb(v));
  if (id === 'noise') return v <= 0.001 ? 'OFF' : dbText(noiseDb(v));
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
  if (id === 'rsize') return `${rsizeS(v).toFixed(1)} S`;
  if (id === 'rtone') return hzText(rtoneHz(v));
  if (id === 'dfb') return `${Math.round(dfbPct(v))} %`;
  if ((id === 'delay' || id === 'reverb' || id === 'feedback') && v <= 0.001) return 'OFF';
  return pct(v);
}

/** Ce que fait chaque forme, en deux mots (l'unite sous son nom). */
const WAVE_WORD: Readonly<Record<string, string>> = { TRI: 'SOFT, ODD', SHARK: 'TRI + SAW', 'REV SAW': 'RISING SAW', SAW: 'ALL HARMONICS', SQR: 'HOLLOW, ODD', WIDE: 'PULSE 30 %', NARROW: 'PULSE 12 %' };
/** Ce que fait chaque MODE. */
const MODE_WORD: Readonly<Record<BassMode, string>> = { LP24: '24 DB / OCT', LP12: '12 DB / OCT', LP6: '6 DB / OCT', BP: 'BAND PASS', 303: 'TB-303 FILTER' };

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
    case 'drive':
      return bassValueText(id, v);
    case 'keytrack':
      // Les crans du Model D (K.T. 1/3 et 2/3) se reconnaissent
      return v < 0.02 ? 'OFF' : v > 0.98 ? 'FULL' : Math.abs(v - 1 / 3) < 0.02 ? '1/3 MOOG' : Math.abs(v - 2 / 3) < 0.02 ? '2/3 MOOG' : `${Math.round(v * 100)} %`;
    case 'o2wave':
    case 'o3wave':
      return WAVE_WORD[(bassKnob(id).names as readonly string[])[stepOf(id, v)]] ?? '';
    case 'o2range':
    case 'o3range': {
      const o = rangeOct(v);
      return o === 0 ? 'THE NOTE' : `${o > 0 ? '+' : ''}${o} OCT`;
    }
    case 'o2semi':
    case 'o3semi':
      return semiName(semiSt(v));
    case 'fmode':
      return MODE_WORD[modeName(v)];
    case 'fpol':
      return v >= 0.5 ? 'CLOSES, THEN OPENS' : 'OPENS THE FILTER';
    case 'feedback':
      return v <= 0.001 ? 'OFF' : v < 0.45 ? `WARM ${Math.round(v * 100)} %` : `GRIT ${Math.round(v * 100)} %`;
    case 'drift':
      return v <= 0.001 ? 'STABLE' : `${Math.round(v * 100)} %`;
    case 'reso':
    case 'accent':
    case 'density':
    case 'slides':
    case 'accents':
      return `${Math.round(v * 100)} %`;
    case 'sustain':
    case 'fsustain':
      return v >= 0.999 ? '0 DB' : v <= 0.001 ? 'OFF' : dbText(20 * Math.log10(v));
    case 'delay':
    case 'reverb':
      return v <= 0.001 ? 'OFF' : `SEND ${Math.round(v * 100)} %`;
    case 'dfb': {
      // Ce que perd chaque repetition (2026-10-08, la revue : FEEDBACK 45 % sous un grand 64 se contredisait)
      const g = dfbPct(v) / 100;
      return g < 0.01 ? 'ONE ECHO' : `${(20 * Math.log10(g)).toFixed(1)} DB / ECHO`;
    }
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
/** Les valeurs d'heritage de tous les reglages (MODE 303 : le son d'avant le 2026-10-09). */
export const LEGACY_VALUES = Object.fromEntries(BASS_KNOBS.map((k) => [k.id, legacyOf(k)])) as BassValues;

/**
 * Ce que load() a trouve (2026-10-09) : un enregistrement d'avant le moteur MONARK (sans MODE), et le preset d'usine
 * d'avant dont il a le son (ses 26 reglages du son a 1e-6 pres, state/bassLegacy.ts), pour la migration de
 * state/presets.ts ; null : aucun.
 */
export interface BassLegacyRecord {
  legacy: boolean;
  match: string | null;
}
let legacyRec: BassLegacyRecord = { legacy: false, match: null };

/** Le preset d'usine d'avant dont ces valeurs ont le son (les 26 reglages d'alors, a 1e-6 pres) ; null : aucun. */
export function legacyMatch(v: Partial<Record<string, number>>): string | null {
  for (const [name, row] of Object.entries(BASS_LEGACY_SOUNDS)) {
    if (LEGACY_SOUND_IDS.every((id, i) => typeof v[id] === 'number' && Math.abs((v[id] as number) - row[i]) <= 1e-6)) return name;
  }
  return null;
}

/**
 * Un enregistrement retenu : chaque cle presente (un nombre fini, borne a 0..1) ; une cle absente prend legacy ?? def
 * (2026-10-09 : un enregistrement d'avant revient avec son son d'avant, MODE 303) ; rien de retenu (premiere visite) :
 * def, le patch de depart MM CLASSIC. Un enregistrement sans MODE est d'avant le moteur MONARK (legacyRec).
 */
function load(): BassValues {
  const v = { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return v;
    const o = JSON.parse(raw) as Partial<BassValues> | null;
    if (!o || typeof o !== 'object') return v;
    for (const k of BASS_KNOBS) {
      const x = o[k.id];
      v[k.id] = typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : legacyOf(k);
    }
    if (typeof o.fmode !== 'number') legacyRec = { legacy: true, match: legacyMatch(v) };
  } catch {
    /* rien de retenu */
  }
  return v;
}

let values: BassValues = typeof window === 'undefined' ? { ...DEFAULTS } : load();
const listeners = new Set<() => void>();
let saveTimer = 0;

function save(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(values));
    } catch {
      /* stockage indisponible : les reglages vivent pour la visite */
    }
  }, 300);
}

export const bassParams = {
  get: (): BassValues => values,
  of: (id: BassKnobId): number => values[id],
  def: (id: BassKnobId): number => bassKnob(id).def,
  /**
   * La valeur de depart d'un reglage dans le MODE du moment (2026-10-09, deux tapes : le defaut du moteur qui sonne) :
   * def sur l'echelle, legacy ?? def en 303 ; MODE lui-meme revient a LP24.
   */
  reset(id: BassKnobId): number {
    const k = bassKnob(id);
    return id === 'fmode' || bassLadder() ? k.def : legacyOf(k);
  },
  /** L'enregistrement trouve au chargement : d'avant le moteur MONARK, et le preset d'usine d'avant dont il a le son. */
  legacy: (): BassLegacyRecord => legacyRec,
  /** La migration est faite, ou il n'y a rien a faire : plus rien a reconnaitre. */
  legacyDone(): void {
    legacyRec = { legacy: false, match: null };
  },
  /** Une valeur (0 a 1, au cran pres) ; true si elle change. */
  set(id: BassKnobId, v: number): boolean {
    const k = bassKnob(id);
    let x = Math.min(1, Math.max(0, v));
    if (k.steps && k.steps > 1) x = Math.round(x * (k.steps - 1)) / (k.steps - 1);
    if (values[id] === x) return false;
    values = { ...values, [id]: x };
    listeners.forEach((fn) => fn());
    save();
    return true;
  },
  /** Plusieurs valeurs d'un coup (une migration) : une seule notification, un seul message au worklet ; true si une change. */
  setMany(next: Partial<Record<BassKnobId, number>>): boolean {
    const out = { ...values };
    let changed = false;
    for (const k of BASS_KNOBS) {
      const v = next[k.id];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      let x = Math.min(1, Math.max(0, v));
      if (k.steps && k.steps > 1) x = Math.round(x * (k.steps - 1)) / (k.steps - 1);
      if (out[k.id] !== x) {
        out[k.id] = x;
        changed = true;
      }
    }
    if (!changed) return false;
    values = out;
    listeners.forEach((fn) => fn());
    save();
    return true;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
