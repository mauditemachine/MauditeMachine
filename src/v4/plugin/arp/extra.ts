/**
 * Les reglages du VST3 seul (2026-11-10, Mika : "une qualite eblouissante, seulement le VST3, le site on n'y touche
 * pas") : le mode HQ, la seconde destination du LFO de la face, un second LFO, la reverb reglable, la section master.
 * La source unique est plugin/mm-arp/extra-params.json (le C++ lit le meme fichier) : ils ne sont PAS dans
 * voyager/params.ts, le site ne les connait pas. Seule la face du plugin importe ce module.
 *
 * Comme voyParams : des valeurs de 0 a 1, rondes sur leur cran pour un reglage a crans (i / (n - 1)), au millieme
 * sinon. Gardees dans le localStorage sous mm.v4.plugin.arp.extra : une cle mm.v4.*, elle part donc dans l'etat du
 * projet avec le reste (plugin/restore.ts, bridge.ts snapshotLs).
 */

import spec from '../../../../plugin/mm-arp/extra-params.json';
import { skyText, skyTypeIndex } from './skyModel';
import { hellShiftText, LFO_BEAT_NAMES } from './hell';

/**
 * Les blocs du JSON. Les cinq premiers : la page SOUND+ du capot (SoundPlus.tsx). Les autres (2026-11-11) : le module
 * d'extension de la face avant (FrontModule.tsx) : seq (SWING), osc et filter (OSC / FILTER +), phaser, flanger, pump,
 * crush et space (FX RACK). Les derniers (2026-11-11, les pages du panneau d'OPEN) : matrix (la matrice de modulation, six
 * lignes source / destination / quantite : Matrix.tsx), voice, amp, eq et dist (la page OPTIONS).
 */
export type ExtraSection = 'engine' | 'lfo1' | 'lfo2' | 'reverb' | 'master' | 'seq' | 'osc' | 'filter' | 'phaser' | 'flanger' | 'pump' | 'crush' | 'space' | 'matrix' | 'voice' | 'amp' | 'eq' | 'dist' | 'hell' | 'sky' | 'disto';

export interface ExtraParam {
  id: string;
  label: string;
  section: ExtraSection;
  def: number;
  steps?: readonly string[];
  help?: string;
}

export const EXTRA_STORAGE_KEY = 'mm.v4.plugin.arp.extra';

export const EXTRA_PARAMS: readonly ExtraParam[] = (spec.params as readonly ExtraParam[]).map((p) => ({ id: p.id, label: p.label, section: p.section, def: p.def, steps: p.steps, help: p.help }));
export const EXTRA_IDS: readonly string[] = EXTRA_PARAMS.map((p) => p.id);

/** Les blocs de la page SOUND+, dans l'ordre de l'ecran (ceux du module avant : FrontModule.tsx). */
export const EXTRA_SECTIONS: readonly { id: ExtraSection; title: string }[] = [
  { id: 'engine', title: 'ENGINE' },
  { id: 'lfo1', title: 'LFO 1' },
  { id: 'lfo2', title: 'LFO 2' },
  { id: 'reverb', title: 'REVERB' },
  { id: 'master', title: 'MASTER' },
];

const BY_ID = new Map(EXTRA_PARAMS.map((p) => [p.id, p]));

export const isExtra = (id: string): boolean => BY_ID.has(id);
export const extraParam = (id: string): ExtraParam | undefined => BY_ID.get(id);

export type ExtraValues = Readonly<Record<string, number>>;

/** L'index du cran d'un reglage a crans (0 sinon). */
export function extraStepIndex(id: string, v: number): number {
  const s = BY_ID.get(id)?.steps;
  if (!s) return 0;
  return Math.max(0, Math.min(s.length - 1, Math.round(v * (s.length - 1))));
}

/** Une valeur posee : bornee, ronde sur son cran, au millieme sinon. */
function clean(p: ExtraParam, v: number): number {
  const t = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : p.def;
  return p.steps ? extraStepIndex(p.id, t) / (p.steps.length - 1) : Math.round(t * 1000) / 1000;
}

const DEFAULTS: ExtraValues = Object.fromEntries(EXTRA_PARAMS.map((p) => [p.id, clean(p, p.def)]));

function load(): Record<string, number> {
  const out: Record<string, number> = { ...DEFAULTS };
  try {
    const raw = JSON.parse(window.localStorage.getItem(EXTRA_STORAGE_KEY) ?? 'null') as { values?: unknown } | null;
    const vals = raw && typeof raw === 'object' && raw.values && typeof raw.values === 'object' ? (raw.values as Record<string, unknown>) : null;
    if (vals) for (const p of EXTRA_PARAMS) if (typeof vals[p.id] === 'number') out[p.id] = clean(p, vals[p.id] as number);
    // un etat d'avant la reverbe facon BigSky (2026-11-16) : la reverbe d'avant (CLASSIC)
    if (vals && typeof vals.xSkyType !== 'number') out.xSkyType = 0;
  } catch {
    /* illisible ou stockage refuse : les valeurs de depart */
  }
  return out;
}

let values: ExtraValues = load();
const listeners = new Set<() => void>();

function save(): void {
  try {
    window.localStorage.setItem(EXTRA_STORAGE_KEY, JSON.stringify({ v: 1, values }));
  } catch {
    /* stockage refuse : rien */
  }
}

/* ---------------- le texte d'une valeur ---------------- */

const signed = (x: number, digits: number): string => {
  const r = Number(x.toFixed(digits));
  return r === 0 ? '0' : `${r > 0 ? '+' : ''}${r.toFixed(digits)}`;
};

/** La duree de la reverb (le help du JSON) : 0.6 s a 9.6 s, 2.4 s au centre. */
export const revSizeS = (v: number): number => 2.4 * Math.pow(4, 2 * v - 1);
/** Le pre-delay : 0 a 100 ms. */
export const revPreMs = (v: number): number => 100 * v;
/** BASS, AIR : -6 a +6 dB. */
export const shelfDb = (v: number): number => (v - 0.5) * 12;
/** WIDTH : 0 mono, 100 % celle du site, 200 % le double du cote. */
export const widthPct = (v: number): number => 200 * v;

/* Le module avant (2026-11-11). Les lois sont celles que disent les help du JSON, exponentielles entre leurs bornes. */
const expo = (lo: number, hi: number, v: number): number => lo * Math.pow(hi / lo, v);
/** PHASER RATE : 0.05 a 8 Hz. */
export const phRateHz = (v: number): number => expo(0.05, 8, v);
/** FLANGER RATE : 0.03 a 5 Hz. */
export const flRateHz = (v: number): number => expo(0.03, 5, v);
/** HIGH PASS : 20 Hz a 2 kHz (0 : absent). */
export const hpfHz = (v: number): number => expo(20, 2000, v);
/** CRUSH : 16 a 4 bits (0 : contourne). */
export const crushBits = (v: number): number => 16 - 12 * v;
/** DOWNSAMPLE : de 48 kHz a 2 kHz (0 : contourne). */
export const crushHz = (v: number): number => expo(48000, 2000, v);

const hz = (f: number): string => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)} kHz` : f >= 100 ? `${Math.round(f)} Hz` : f >= 10 ? `${f.toFixed(1)} Hz` : `${f.toFixed(2)} Hz`);
/** L'EQ : LOW, MID, HIGH de -12 a +12 dB ; AIR BAND de -10 a +10 dB. */
export const eqDb = (v: number): number => (v - 0.5) * 24;
export const eqAirDb = (v: number): number => (v - 0.5) * 20;
/** La quantite d'une ligne de la matrice : -100 a +100 %. */
export const matrixPct = (v: number): number => (v - 0.5) * 200;
/** Les lignes de la matrice de modulation (xM1Src, xM1Dst, xM1Amt ... xM6). */
export const MATRIX_ROWS = 6;
const MATRIX_AMT = /^xM\dAmt$/;

const pct = (v: number): string => `${Math.round(v * 100)} %`;
/** Une dose : OFF a zero. */
const dose = (v: number): string => (v <= 0 ? 'OFF' : pct(v));
/** Un reglage a zero au centre : -100 a +100 %. */
const bipolar = (v: number): string => `${signed((v - 0.5) * 200, 0)} %`;

function text(id: string, v: number): string {
  const p = BY_ID.get(id);
  if (!p) return '';
  // la reverbe facon BigSky : le texte depend de la machine (skyModel.ts)
  if (p.section === 'sky' && id !== 'xSkyType') return skyText(skyTypeIndex(values.xSkyType ?? 0), id, v);
  if (id === 'xPbRange' && p.steps) return `${p.steps[extraStepIndex(id, v)]} ST`;
  if (p.steps) return p.steps[extraStepIndex(id, v)];
  if (MATRIX_AMT.test(id)) return `${signed(matrixPct(v), 0)} %`;
  switch (id) {
    case 'xEqLow':
    case 'xEqMid':
    case 'xEqHigh':
      return `${signed(eqDb(v), 1)} dB`;
    case 'xEqAir':
      return `${signed(eqAirDb(v), 1)} dB`;
    case 'xFeedback':
    case 'xDist':
      return dose(v);
    case 'xRevSize': {
      const s = revSizeS(v);
      return `${s < 1 ? s.toFixed(2) : s.toFixed(1)} s`;
    }
    case 'xRevPre':
      return `${Math.round(revPreMs(v))} ms`;
    case 'xBass':
    case 'xAir':
      return `${signed(shelfDb(v), 1)} dB`;
    case 'xWidth':
      return v <= 0 ? 'MONO' : `${Math.round(widthPct(v))} %`;
    case 'xRing':
    case 'xFold':
    case 'xComb':
    case 'xPhMix':
    case 'xFlMix':
    case 'xPumpDepth':
    case 'xShimmer':
      return dose(v);
    case 'xNoiseColor':
      return v === 0.5 ? 'WHITE' : bipolar(v);
    case 'xCombFb':
    case 'xFlFb':
      return bipolar(v);
    case 'xHellMix':
      return dose(v);
    case 'xHellTime': {
      const t = 5 * Math.pow(400, v);
      return t >= 1000 ? `${(t / 1000).toFixed(2)} s` : `${Math.round(t)} ms`;
    }
    // le decalage : sa loi depend de RANGE (hell.ts)
    case 'xHellShift':
      return hellShiftText(v, Math.round((values.xHellRange ?? 0) * 3));
    case 'xHellUpDown':
      return v >= 0.999 ? 'UP' : v <= 0.001 ? 'DOWN' : Math.abs(v - 0.5) < 0.01 ? 'R.M.' : `${Math.round((1 - v) * 100)} / ${Math.round(v * 100)}`;
    case 'xHellLfoRate':
      return (values.xHellLfoSync ?? 0) >= 0.5 ? LFO_BEAT_NAMES[Math.round(Math.min(1, Math.max(0, v)) * (LFO_BEAT_NAMES.length - 1))] : hz(0.02 * Math.pow(500, v));
    // DISTO facon Decapitator (dsp/Decap.h)
    case 'xDLow':
      return v < 0.02 ? 'OFF' : hz(20 * Math.pow(50, (v - 0.02) / 0.98));
    case 'xDHigh':
      return v > 0.98 ? 'OFF' : hz(1000 * Math.pow(20, v / 0.98));
    case 'xDTone': {
      const t = (v - 0.5) * 2;
      return Math.abs(t) < 0.02 ? 'FLAT' : `${t < 0 ? 'DARK' : 'BRIGHT'} ${Math.abs(t * 6).toFixed(1)} dB`;
    }
    case 'xDMix':
      return `${Math.round(v * 100)} %`;
    case 'xDOut': {
      const d = -18 + 36 * v;
      return Math.abs(d) < 0.05 ? '0.0 dB' : `${signed(d, 1)} dB`;
    }
    // DISTO v25 (dsp/Decap.h, disto.ts)
    case 'xDMorph':
    case 'xDFb':
      return dose(v);
    case 'xDDyn':
      return Math.abs(v - 0.5) < 0.005 ? 'OFF' : `${v < 0.5 ? 'COMP' : 'EXP'} ${Math.round(Math.abs(v - 0.5) * 200)} %`;
    case 'xDEnvAmt':
    case 'xDLfoAmt':
      return bipolar(v);
    case 'xDFbFreq':
      return hz(40 * Math.pow(30, v));
    case 'xDXLo':
      return hz(40 * Math.pow(25, v));
    case 'xDXHi':
      return hz(600 * Math.pow(25, v));
    case 'xDPreFreq':
    case 'xDPostFreq':
      return hz(20 * Math.pow(1000, v));
    case 'xDPreReso':
    case 'xDPostReso':
      return `Q ${(0.7071 * Math.pow(16, v)).toFixed(2)}`;
    case 'xDB1Drive':
    case 'xDB2Drive':
    case 'xDB3Drive': {
      const d = -18 + 36 * v;
      return Math.abs(d) < 0.05 ? '0.0 dB' : `${signed(d, 1)} dB`;
    }
    case 'xDB1Level':
    case 'xDB2Level':
    case 'xDB3Level': {
      const d = -12 + 24 * v;
      return Math.abs(d) < 0.05 ? '0.0 dB' : `${signed(d, 1)} dB`;
    }
    case 'xDB1Mix':
    case 'xDB2Mix':
    case 'xDB3Mix':
    case 'xDBoxMix':
      return `${Math.round(v * 100)} %`;
    case 'xDEnvSpd':
      return `${Math.round(Math.pow(30, v))} / ${Math.round(30 * Math.pow(30, v))} ms`;
    case 'xDLfoRate':
      return (values.xDLfoSync ?? 0) >= 0.5 ? LFO_BEAT_NAMES[Math.round(Math.min(1, Math.max(0, v)) * (LFO_BEAT_NAMES.length - 1))] : hz(0.02 * Math.pow(500, v));
    case 'xDBoxSize':
      return `${signed((v - 0.5) * 1.2, 1)} oct`;
    case 'xHellHp':
      return v <= 0.001 ? 'OFF' : hz(20 * Math.pow(200, v));
    case 'xHellLp':
      return v >= 0.999 ? 'OFF' : hz(300 * Math.pow(20000 / 300, v));
    case 'xHellSmear':
      return dose(v);
    case 'xHellPhase':
      return `${Math.round(v * 360)} DEG`;
    case 'xHellLfoAmt':
      return bipolar(v);
    case 'xHellLfoDepth':
      return v <= 0 ? 'OFF' : `${Math.round(400 * v * v)} Hz`;
    case 'xHellTone':
      return Math.abs(v - 0.5) <= 0.01 ? 'FLAT' : v < 0.5 ? `LP ${hz(600 * Math.pow(30, v / 0.49))}` : `HP ${hz(20 * Math.pow(150, (v - 0.51) / 0.49))}`;
    case 'xHpf':
      return v <= 0 ? 'OFF' : hz(hpfHz(v));
    case 'xPhRate':
      return hz(phRateHz(v));
    case 'xFlRate':
      return hz(flRateHz(v));
    case 'xCrushBits':
      return v <= 0 ? 'OFF' : `${crushBits(v).toFixed(1)} BIT`;
    case 'xCrushRate':
      return v <= 0 ? 'OFF' : hz(crushHz(v));
    default:
      return `${Math.round(v * 100)} %`;
  }
}

export const arpExtra = {
  get: (): ExtraValues => values,
  of: (id: string): number => values[id] ?? 0,
  def: (id: string): number => DEFAULTS[id] ?? 0,
  defaults: (): ExtraValues => DEFAULTS,
  /** true si la valeur a change. */
  set(id: string, v: number): boolean {
    const p = BY_ID.get(id);
    if (!p) return false;
    const t = clean(p, v);
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
  /** Le texte d'une valeur (celle du moment par defaut) : le nom du cran, ou des secondes, ms, dB, %. */
  text: (id: string, v: number = values[id] ?? 0): string => text(id, v),
  /** La cle ecrite meme si rien n'a bouge (l'etat du projet la porte toujours). */
  flush: save,
};
