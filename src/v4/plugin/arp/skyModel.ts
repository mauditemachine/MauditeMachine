/**
 * La reverbe facon BigSky du plugin MM-ARP (2026-11-16, Mika : "quand on clic sur le knob Reverb on tombe sur une page de
 * configuration pour la reverb avec tous les parametres AINSI QUE la qualite de Strymon BigSky mais au design de
 * MM-ARP") : le modele de la page REVERB. Repris de la reference ecrite pour le site (docs/vst3/sky-reference/sky.ts,
 * branche claude/gallant-franklin-3hka73) ; le moteur est en C++ (plugin/mm-arp/dsp/Sky.{h,cpp} : skyEngine y traduit
 * les memes reglages). Aucun import : extra.ts (le texte des valeurs) et sky.ts (la memoire des machines) s'en servent.
 *
 * Les reglages du VST3 (extra-params.json, section sky) : xSkyType (CLASSIC, la reverbe d'avant, puis les douze machines
 * dans l'ordre du selecteur TYPE du BigSky), xSkyDecay, xSkyPre, xSkyTone, xSkyMod, xSkyLow, et cinq places xSkyP1 a
 * xSkyP5 dont le sens depend de la machine (leur ordre est celui de la page, comme dans Sky.cpp skyEngine).
 */

export type SkyMachineId = 'room' | 'hall' | 'plate' | 'spring' | 'swell' | 'bloom' | 'cloud' | 'chorale' | 'shimmer' | 'magneto' | 'nonlinear' | 'reflections';

export interface SkySlot {
  label: string;
  /** les crans (un reglage a crans) */
  options?: readonly string[];
  /** son texte (une duree, des Hz...) : sinon 0 a 127, ou le nom du cran */
  kind?: 'time' | 'lateDecay' | 'modSpeed' | 'length' | 'locX' | 'locY';
}

export interface SkyMachineDef {
  id: SkyMachineId;
  name: string;
  blurb: string;
  decayLabel: string;
  preLabel: string;
  /** les reglages propres (xSkyP1...) */
  slots: readonly SkySlot[];
  /** les valeurs de depart : DECAY, PRE-DELAY, TONE, MOD, LOW END, puis les places */
  def: { decay: number; pre: number; tone: number; mod: number; low: number; p: readonly number[] };
}

const SHIFTS = ['-1 OCT', '-5TH', '-4TH', 'DETUNE', '+3RD', '+4TH', '+5TH', '+6TH', '+1 OCT', '+OCT +5TH', '+2 OCT'] as const;
export const RISE_TIMES = [0.08, 0.1, 0.12, 0.14, 0.17, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 1.7, 2, 2.5, 3, 4] as const;
const idx = (i: number, n: number): number => (n <= 1 ? 0 : i / (n - 1));

export const SKY_MACHINES: readonly SkyMachineDef[] = [
  { id: 'room', name: 'ROOM', blurb: 'A real room: the tight studio or the lively club, early reflections then the tail.', decayLabel: 'DECAY', preLabel: 'PRE-DELAY', slots: [{ label: 'SIZE', options: ['STUDIO', 'CLUB'] }, { label: 'DIFFUSION' }], def: { decay: 0.4, pre: 0.06, tone: 0.55, mod: 0.3, low: 0.5, p: [0, 0.6] } },
  { id: 'hall', name: 'HALL', blurb: 'The warm, balanced concert hall, or the biggest indoor arena.', decayLabel: 'DECAY', preLabel: 'PRE-DELAY', slots: [{ label: 'MID' }, { label: 'SIZE', options: ['CONCERT', 'ARENA'] }], def: { decay: 0.43, pre: 0.14, tone: 0.5, mod: 0.35, low: 0.5, p: [0.5, 0] } },
  { id: 'plate', name: 'PLATE', blurb: 'The studio steel plate: dense from the first millisecond, bright, no room around it.', decayLabel: 'DECAY', preLabel: 'PRE-DELAY', slots: [{ label: 'SIZE', options: ['SMALL', 'LARGE'] }], def: { decay: 0.45, pre: 0.08, tone: 0.65, mod: 0.3, low: 0.45, p: [1] } },
  { id: 'spring', name: 'SPRING', blurb: 'The amp spring tank: the falling drip, the preamp that breaks up.', decayLabel: 'DECAY', preLabel: 'PRE-DELAY', slots: [{ label: 'DWELL', options: ['CLEAN', 'COMBO', 'TUBE', 'OVERDRIVE'] }, { label: 'SPRINGS', options: ['1', '2', '3'] }], def: { decay: 0.45, pre: 0, tone: 0.5, mod: 0.15, low: 0.4, p: [idx(1, 4), idx(1, 3)] } },
  { id: 'swell', name: 'SWELL', blurb: 'The volume rises by itself: the reverb, or the sound, swells in behind every attack.', decayLabel: 'DECAY', preLabel: 'PRE-DELAY', slots: [{ label: 'RISE TIME', options: RISE_TIMES.map((t) => (t < 1 ? `${Math.round(t * 1000)} MS` : `${t} S`)) }, { label: 'MODE', options: ['SWLWET', 'SWLDRY'] }], def: { decay: 0.55, pre: 0.1, tone: 0.5, mod: 0.4, low: 0.5, p: [idx(10, RISE_TIMES.length), 0] } },
  { id: 'bloom', name: 'BLOOM', blurb: 'The reverb blooms: it slowly swells after the note before dying away.', decayLabel: 'DECAY', preLabel: 'PRE-DELAY', slots: [{ label: 'LENGTH', kind: 'length' }, { label: 'FEEDBACK' }], def: { decay: 0.5, pre: 0.1, tone: 0.5, mod: 0.4, low: 0.5, p: [0.5, 0.5] } },
  { id: 'cloud', name: 'CLOUD', blurb: 'A huge ambient cloud, up to fifty seconds of tail.', decayLabel: 'DECAY', preLabel: 'PRE-DELAY', slots: [{ label: 'DIFFUSION' }], def: { decay: 0.5, pre: 0.15, tone: 0.45, mod: 0.45, low: 0.5, p: [0.7] } },
  { id: 'chorale', name: 'CHORALE', blurb: 'A choir comes along: the tail sings vowels.', decayLabel: 'DECAY', preLabel: 'PRE-DELAY', slots: [{ label: 'VOWEL', options: ['AAHHOO', 'AAHH', 'AAHHOH', 'OH', 'OOOHOH', 'OOOO', 'RANDOM'] }, { label: 'RESONANCE', options: ['MILD', 'MEDIUM', 'HIGH'] }], def: { decay: 0.5, pre: 0.1, tone: 0.5, mod: 0.4, low: 0.5, p: [0, idx(1, 3)] } },
  { id: 'shimmer', name: 'SHIMMER', blurb: 'Two pitched voices inside the reverb: octaves rising to the sky.', decayLabel: 'DECAY', preLabel: 'PRE-DELAY', slots: [{ label: 'SHIFT 1', options: SHIFTS }, { label: 'SHIFT 2', options: ['OFF', ...SHIFTS] }, { label: 'AMOUNT' }, { label: 'MODE', options: ['INPUT', 'REGEN', 'IN+REG'] }], def: { decay: 0.55, pre: 0.1, tone: 0.55, mod: 0.4, low: 0.4, p: [idx(8, SHIFTS.length), 0, 0.5, idx(1, 3)] } },
  { id: 'magneto', name: 'MAGNETO', blurb: 'A multi-head tape echo that turns into reverb: the heads spread and diffuse.', decayLabel: 'DECAY', preLabel: 'FEEDBACK', slots: [{ label: 'DIFFUSION' }, { label: 'HEADS', options: ['3', '4', '6'] }, { label: 'SPACING', options: ['EVEN', 'UNEVEN'] }, { label: 'TIME', kind: 'time' }], def: { decay: 0.4, pre: 0.35, tone: 0.45, mod: 0.35, low: 0.45, p: [0.5, idx(1, 3), 0, 0.45] } },
  { id: 'nonlinear', name: 'NONLINEAR', blurb: 'The enveloped reverbs of the eighties: the gate, the reverse, the bell.', decayLabel: 'TIME', preLabel: 'FEEDBACK', slots: [{ label: 'SHAPE', options: ['SWOOSH', 'REVERSE', 'RAMP', 'GATE', 'GAUSS', 'BOUNCE'] }, { label: 'DIFFUSION' }, { label: 'LATE DECAY', kind: 'lateDecay' }, { label: 'LATE LEVEL' }, { label: 'MOD SPEED', kind: 'modSpeed' }], def: { decay: 0.45, pre: 0, tone: 0.55, mod: 0.2, low: 0.5, p: [idx(3, 6), 0.6, 0.4, 0.3, 0.3] } },
  { id: 'reflections', name: 'REFLECTIONS', blurb: 'The small psychoacoustic room: an amp placed in it, every wall calculated.', decayLabel: 'SIZE', preLabel: 'PRE-DELAY', slots: [{ label: 'LOCATION X', kind: 'locX' }, { label: 'LOCATION Y', kind: 'locY' }, { label: 'SHAPE', options: ['SQUARE', 'RECT', 'OBLONG'] }], def: { decay: 0.4, pre: 0, tone: 0.5, mod: 0.15, low: 0.5, p: [0.5, 0.5, 0] } },
];

/** xSkyType : 0 CLASSIC, 1 a 12 les machines. */
export const SKY_TYPES = 13;
export const skyMachineOf = (type: number): SkyMachineDef | null => (type >= 1 && type <= 12 ? SKY_MACHINES[type - 1] : null);
export const skyTypeIndex = (v: number): number => Math.max(0, Math.min(SKY_TYPES - 1, Math.round(v * (SKY_TYPES - 1))));
export const SKY_SLOTS = ['xSkyP1', 'xSkyP2', 'xSkyP3', 'xSkyP4', 'xSkyP5'] as const;
export const SKY_FACE = ['xSkyDecay', 'xSkyPre', 'xSkyTone', 'xSkyMod', 'xSkyLow'] as const;

const DECAY_RANGE: Readonly<Record<SkyMachineId, readonly [number, number]>> = {
  room: [0.2, 10],
  hall: [0.5, 20],
  plate: [0.5, 20],
  spring: [0.5, 8],
  swell: [0.5, 20],
  bloom: [1, 50],
  cloud: [1, 50],
  chorale: [0.5, 20],
  shimmer: [0.5, 20],
  magneto: [0.2, 8],
  nonlinear: [0.1, 1.5],
  reflections: [100, 1000],
};
const expo = (lo: number, hi: number, v: number): number => lo * Math.pow(hi / lo, v);
export const stepOf = (v: number, n: number): number => Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))));
export const decayOf = (m: SkyMachineId, v: number): number => expo(DECAY_RANGE[m][0], DECAY_RANGE[m][1], v);
export const preOf = (v: number): number => v * v;
export const toneHzOf = (v: number): number => (v >= 0.97 ? 22000 : expo(900, 20000, v));
export const tapeTimeOf = (v: number): number => 0.05 + 1.35 * Math.pow(v, 1.5);
export const lateDecayOf = (v: number): number => expo(0.3, 10, v);
export const modSpeedOf = (v: number): number => expo(0.1, 6, v);
export const bloomLenOf = (v: number): number => 0.03 + 0.32 * v;

const fmtS = (s: number): string => (s < 1 ? `${Math.round(s * 1000)} MS` : s < 10 ? `${s.toFixed(2)} S` : `${s.toFixed(1)} S`);
const n127 = (v: number): string => `${Math.round(v * 127)}`;

/** Le nom d'un reglage sky pour la machine en cours (DECAY / TIME / SIZE, PRE-DELAY / FEEDBACK, la place) ; null : aucun. */
export function skyLabel(type: number, id: string): string | null {
  const m = skyMachineOf(type);
  if (!m) return null;
  switch (id) {
    case 'xSkyDecay':
      return m.decayLabel;
    case 'xSkyPre':
      return m.preLabel;
    case 'xSkyTone':
      return 'TONE';
    case 'xSkyMod':
      return 'MOD';
    case 'xSkyLow':
      return 'LOW END';
    default: {
      const i = SKY_SLOTS.indexOf(id as (typeof SKY_SLOTS)[number]);
      return i >= 0 ? (m.slots[i]?.label ?? null) : null;
    }
  }
}

/** Les crans d'une place pour la machine en cours (rien pour un reglage continu). */
export function skySteps(type: number, id: string): readonly string[] | undefined {
  const m = skyMachineOf(type);
  const i = SKY_SLOTS.indexOf(id as (typeof SKY_SLOTS)[number]);
  return m && i >= 0 ? m.slots[i]?.options : undefined;
}

/** Le texte d'une valeur (secondes, ms, Hz, le nom d'un cran, 0 a 127), comme la page du BigSky. */
export function skyText(type: number, id: string, v: number): string {
  const m = skyMachineOf(type);
  if (!m) return `${Math.round(v * 100)} %`;
  switch (id) {
    case 'xSkyDecay':
      if (m.id === 'reflections') return `${Math.round(decayOf(m.id, v) / 10) * 10} SQ FT`;
      return fmtS(decayOf(m.id, v));
    case 'xSkyPre':
      return m.preLabel === 'FEEDBACK' ? `${Math.round(v * 100)} %` : `${Math.round(preOf(v) * 1000)} MS`;
    case 'xSkyTone':
      return v >= 0.97 ? 'FULL' : `${(toneHzOf(v) / 1000).toFixed(1)} KHZ`;
    case 'xSkyMod':
    case 'xSkyLow':
      return n127(v);
    default: {
      const i = SKY_SLOTS.indexOf(id as (typeof SKY_SLOTS)[number]);
      const s = i >= 0 ? m.slots[i] : undefined;
      if (!s) return '-';
      if (s.options) return s.options[stepOf(v, s.options.length)];
      switch (s.kind) {
        case 'time':
          return fmtS(tapeTimeOf(v));
        case 'lateDecay':
          return fmtS(lateDecayOf(v));
        case 'modSpeed':
          return `${modSpeedOf(v).toFixed(2)} HZ`;
        case 'length':
          return fmtS(bloomLenOf(v));
        case 'locX':
          return v < 0.02 ? 'L' : v > 0.98 ? 'R' : `${v < 0.5 ? 'L' : 'R'} ${Math.round(Math.abs(v - 0.5) * 200)}`.replace(/^[LR] 0$/, 'C');
        case 'locY':
          return v < 0.02 ? 'F' : v > 0.98 ? 'B' : `${v < 0.5 ? 'F' : 'B'} ${Math.round(Math.abs(v - 0.5) * 200)}`.replace(/^[FB] 0$/, 'MID');
        default:
          return n127(v);
      }
    }
  }
}
