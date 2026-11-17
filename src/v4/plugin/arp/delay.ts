/**
 * La page DELAY (v27, 2026-11-17 ; la maquette v26 validee par Mika : "ok code et publie"). Facon Soundtoys EchoBoy et
 * Waves H-Delay : leurs fonctions, nos algorithmes, ni leur look ni leurs noms. Le DSP : plugin/mm-arp/dsp/Echo.h autour
 * des deux coeurs du DELAY du site (dsp/ArpFx.cpp) ; les reglages : extra-params.json, section delay ; MIX est le potard
 * DELAY de la face (delay, l'envoi du site). Ici, cote face :
 * - les styles, les modes, les lois (les memes que Echo.cpp) et le texte de TIME ;
 * - la banque de presets (20, noms et reglages a nous) ; INIT : la page a son depart (le DELAY du site) ;
 * - la conversion de l'ancien DELAY (DLY TIME, TAPE, DELAY MODE, masques), pour un preset (le C++ fait la meme pour un
 *   projet, PluginProcessor::convertDelay ; la banque d'usine, presets/build.mjs) ;
 * - ce qui est grise sur la page (inert).
 */

import spec from '../../../../plugin/mm-arp/extra-params.json';
import { voyParams } from '../../voyager/params';
import { arpExtra } from './extra';

const steps = (id: string): readonly string[] => (spec.params.find((p) => p.id === id)?.steps ?? []) as readonly string[];
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const dlIdx = (id: string, v: number): number => {
  const n = steps(id).length;
  return Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))));
};
const pick = (id: string, name: string): number => {
  const s = steps(id);
  const i = s.indexOf(name);
  if (i < 0) throw new Error(`DELAY : ${id} sans ${name}`);
  return i / (s.length - 1);
};

/** TAPE, ANALOG, DIGITAL, SPACE, LO-FI, DUB, CASSETTE, CRYSTAL */
export const DL_STYLES = steps('xDlStyle');
export const DL_LONG: Readonly<Record<string, string>> = {
  TAPE: 'TAPE ECHO (THE SITE)',
  ANALOG: 'BUCKET BRIGADE',
  DIGITAL: 'PING-PONG (THE SITE)',
  SPACE: 'SPACE ECHO, THREE HEADS',
  'LO-FI': 'LO-FI SAMPLER',
  DUB: 'DUB, DARK AND HOT',
  CASSETTE: 'WORN CASSETTE',
  CRYSTAL: 'CRYSTAL, OCTAVE SHIMMER',
};
/** SINGLE, DUAL, PING-PONG, WIDE, RHYTHM */
export const DL_MODES = steps('xDlMode');
export const DL_DIVS = steps('xDlDiv');
export const DL_RHYTHMS = steps('xDlRhythm');
export const DELAY_IDS: readonly string[] = spec.params.filter((p) => p.section === 'delay').map((p) => p.id);
const DEF: Readonly<Record<string, number>> = Object.fromEntries(spec.params.filter((p) => p.section === 'delay').map((p) => [p.id, p.def]));
const X = (id: string): number => arpExtra.of(id);

/* ---------------- les lois (Echo.cpp) ---------------- */

const DIV16 = [0.5, 1, 2, 4, 8, 16, 32];
/** Les motifs RHYTHM (Echo.cpp kRhythm) : seize niveaux. */
export const DL_RHYTHM_LEVELS: readonly (readonly number[])[] = [
  [1, 0, 0.5, 0, 0.8, 0, 0, 0.4, 1, 0, 0.3, 0, 0.7, 0.25, 0, 0.55],
  [1, 0, 0, 0, 0.8, 0, 0, 0, 0.6, 0, 0, 0, 0.45, 0, 0, 0],
  [1, 0, 0, 0.8, 0, 0, 0.7, 0, 0, 0, 0.6, 0, 0.5, 0, 0, 0],
  [1, 0, 0, 0.8, 0, 0, 0.7, 0, 0.9, 0, 0, 0.6, 0, 0, 0.5, 0],
  [1, 0, 0.6, 0.6, 0.9, 0, 0.5, 0.5, 0.8, 0, 0.4, 0.4, 0.6, 0, 0.3, 0.3],
  [1, 0, 0, 0.8, 0, 0, 0.65, 0, 0, 0.5, 0, 0, 0.4, 0, 0, 0.3],
  [0, 0, 1, 0, 0, 0, 0.8, 0, 0, 0, 0.6, 0, 0, 0, 0.45, 0],
  [1, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0.62, 0, 0.48, 0.38, 0.3],
  [0.12, 0, 0.22, 0, 0.34, 0, 0.46, 0, 0.58, 0, 0.7, 0, 0.82, 0, 1, 0],
  [1, 0.9, 0.8, 0.72, 0.65, 0.58, 0.52, 0.47, 0.42, 0.38, 0.34, 0.3, 0.27, 0.24, 0.21, 0.19],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0],
  [1, 0, 0.7, 0, 0, 0.6, 0, 0.5, 0, 0, 0.4, 0, 0.35, 0, 0, 0],
];
/** La couleur des styles (Echo.cpp kVoicing) : le passe-bas et le passe-haut du coeur, x. */
const STYLE_LP = [1, 0.58, 1, 0.85, 0.62, 0.55, 0.62, 2.6];
const STYLE_HP = [1, 0.75, 1, 1, 1.6, 1.8, 1.4, 1.8];
const STYLE_TAPE = [true, false, false, true, false, true, true, false];

export const delayLaws = {
  /** FREE : 5 ms a 2 s. */
  ms: (v: number): number => 5 * Math.pow(400, clamp01(v)),
  msV: (ms: number): number => Math.log(ms / 5) / Math.log(400),
  /** LOW CUT / HIGH CUT : x1/8 a x8 autour de celui du style. */
  cut: (v: number): number => Math.pow(8, 2 * clamp01(v) - 1),
  /** RELEASE du ducking : 30 a 900 ms. */
  rel: (v: number): number => 30 * Math.pow(30, clamp01(v)),
  /** Le temps (s) du moment, au tempo bpm ; 2 s au plus. */
  seconds(bpm: number): number {
    if (dlIdx('xDlSync', X('xDlSync')) === 1) {
      const note = dlIdx('xDlNote', X('xDlNote'));
      const mul = note === 1 ? 1.5 : note === 2 ? 2 / 3 : 1;
      return Math.min(2, (DIV16[dlIdx('xDlDiv', X('xDlDiv'))] * mul * 60) / Math.max(20, bpm) / 4);
    }
    return Math.min(2, this.ms(X('xDlMs')) / 1000);
  },
  /** Les filtres du style du moment (Hz) : le passe-bas et le passe-haut de la boucle. */
  filters(): { lp: number; hp: number } {
    const s = dlIdx('xDlStyle', X('xDlStyle'));
    const tape = STYLE_TAPE[s] && dlIdx('xDlMode', X('xDlMode')) !== 4;
    const lp0 = tape ? 4800 - 1600 * clamp01(X('xDlWobble')) : 4800;
    const hp0 = tape ? 100 : 260;
    return { lp: Math.min(22000, lp0 * STYLE_LP[s] * this.cut(X('xDlHigh'))), hp: Math.min(20000, hp0 * STYLE_HP[s] * this.cut(X('xDlLow'))) };
  },
};

const hzText = (f: number): string => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)} KHZ` : `${Math.round(f)} HZ`);
const msText = (s: number): string => (s >= 1 ? `${s.toFixed(2)} S` : `${Math.round(s * 1000)} MS`);
const NOTE_MARK = ['', '.', 'T'];

/** Le temps tel qu'on le lit : 1/8. · 375 MS, ou 420 MS. */
export function delayTimeText(bpm: number): string {
  const s = delayLaws.seconds(bpm);
  if (dlIdx('xDlSync', X('xDlSync')) === 1) return `${DL_DIVS[dlIdx('xDlDiv', X('xDlDiv'))]}${NOTE_MARK[dlIdx('xDlNote', X('xDlNote'))]} · ${msText(s)}`;
  return msText(s);
}

/** Le texte d'un reglage de la page (extra.ts le demande ici). */
export function delayText(id: string, v: number): string | null {
  switch (id) {
    case 'xDlMs': {
      const ms = delayLaws.ms(v);
      return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
    }
    case 'xDlFb':
      return v >= 0.995 ? 'FULL' : `${Math.round(v * 100)} %`;
    case 'xDlOffset': {
      const p = Math.round((v - 0.5) * 50);
      return p === 0 ? '0' : `${p > 0 ? '+' : '−'}${Math.abs(p)} %`;
    }
    case 'xDlFeel': {
      const p = (v - 0.5) * 12;
      return Math.abs(p) < 0.05 ? 'ON THE BEAT' : `${p > 0 ? 'LATE' : 'EARLY'} ${Math.abs(p).toFixed(1)} %`;
    }
    case 'xDlLow':
      return hzText(delayLaws.filters().hp * (delayLaws.cut(v) / delayLaws.cut(X('xDlLow'))));
    case 'xDlHigh':
      return hzText(delayLaws.filters().lp * (delayLaws.cut(v) / delayLaws.cut(X('xDlHigh'))));
    case 'xDlDuckRel':
      return `${Math.round(delayLaws.rel(v))} ms`;
    case 'xDlWidth':
      return v <= 0 ? 'MONO' : `${Math.round(v * 100)} %`;
    case 'xDlSat':
    case 'xDlWobble':
    case 'xDlDiff':
    case 'xDlGroove':
    case 'xDlAnalog':
    case 'xDlDuck':
      return v <= 0 ? 'OFF' : `${Math.round(v * 100)} %`;
    default:
      return null;
  }
}

/* ---------------- les presets (20, a nous) ---------------- */

export interface DelayPreset {
  name: string;
  desc: string;
  /** les reglages de la page, et delay (MIX) */
  v: Readonly<Record<string, number>>;
}

type Style = 'TAPE' | 'ANALOG' | 'DIGITAL' | 'SPACE' | 'LO-FI' | 'DUB' | 'CASSETTE' | 'CRYSTAL';
type Mode = 'SINGLE' | 'DUAL' | 'PING-PONG' | 'WIDE' | 'RHYTHM';
interface Units {
  st: Style;
  mode: Mode;
  /** une note (1/8, 1/4 ...) ou des ms */
  div?: string;
  note?: 'S' | 'D' | 'T';
  ms?: number;
  fb: number;
  mix: number;
  width?: number;
  /** -1..1 (-25 % .. +25 %) */
  off?: number;
  sat?: number;
  wob?: number;
  diff?: number;
  /** octaves (-3..3) autour du style */
  low?: number;
  high?: number;
  groove?: number;
  /** -1..1 */
  feel?: number;
  prime?: boolean;
  lofi?: boolean;
  analog?: number;
  duck?: number;
  /** ms */
  rel?: number;
  rhythm?: string;
}

const P = (name: string, desc: string, o: Units): DelayPreset => {
  const v: Record<string, number> = { ...DEF };
  v.xDlStyle = pick('xDlStyle', o.st);
  v.xDlMode = pick('xDlMode', o.mode);
  if (o.ms !== undefined) {
    v.xDlSync = 0;
    v.xDlMs = Math.round(delayLaws.msV(o.ms) * 1000) / 1000;
  } else {
    v.xDlSync = 1;
    v.xDlDiv = pick('xDlDiv', o.div ?? '1/8');
    v.xDlNote = pick('xDlNote', o.note === 'D' ? 'DOTTED' : o.note === 'T' ? 'TRIPLET' : 'STRAIGHT');
  }
  v.xDlFb = o.fb;
  v.delay = o.mix;
  v.xDlWidth = o.width ?? 1;
  v.xDlOffset = 0.5 + (o.off ?? 0) / 2;
  v.xDlSat = o.sat ?? 0;
  v.xDlWobble = o.wob ?? 0;
  v.xDlDiff = o.diff ?? 0;
  v.xDlLow = 0.5 + (o.low ?? 0) / 6;
  v.xDlHigh = 0.5 + (o.high ?? 0) / 6;
  v.xDlGroove = o.groove ?? 0;
  v.xDlFeel = 0.5 + (o.feel ?? 0) / 2;
  v.xDlPrime = o.prime ? 1 : 0;
  v.xDlLofi = o.lofi ? 1 : 0;
  v.xDlAnalog = o.analog ?? 0;
  v.xDlDuck = o.duck ?? 0;
  v.xDlDuckRel = o.rel ? Math.round((Math.log(o.rel / 30) / Math.log(30)) * 1000) / 1000 : DEF.xDlDuckRel;
  v.xDlRhythm = pick('xDlRhythm', o.rhythm ?? 'MACHINE');
  for (const [k, x] of Object.entries(v)) if (!Number.isFinite(x) || x < 0 || x > 1) throw new Error(`DELAY ${name} : ${k} hors de 0..1 (${x})`);
  return { name, desc, v };
};

export const DELAY_PRESETS: readonly DelayPreset[] = [
  P('TAPE SLAP', 'A short tape slapback, a little wow', { st: 'TAPE', mode: 'SINGLE', ms: 110, fb: 0.15, mix: 0.35, wob: 0.35, sat: 0.15 }),
  P('DOTTED DREAM', 'Dotted eighths, soft and wide', { st: 'TAPE', mode: 'PING-PONG', div: '1/8', note: 'D', fb: 0.45, mix: 0.3, wob: 0.25, diff: 0.15, high: -0.5 }),
  P('DUB SIREN', 'Dark repeats that keep on climbing', { st: 'DUB', mode: 'PING-PONG', div: '1/4', note: 'D', fb: 0.82, mix: 0.4, sat: 0.4, wob: 0.4, low: 1 }),
  P('PING PONG CLUB', 'Eighths bouncing left and right', { st: 'DIGITAL', mode: 'PING-PONG', div: '1/8', fb: 0.5, mix: 0.3, high: 1.5 }),
  P('ANALOG WARMTH', 'Bucket brigade, rounded and warm', { st: 'ANALOG', mode: 'DUAL', div: '1/4', fb: 0.5, mix: 0.3, wob: 0.15, analog: 0.3 }),
  P('SPACE TRAIN', 'Three heads in rhythm, a spring of diffusion', { st: 'SPACE', mode: 'PING-PONG', div: '1/4', fb: 0.55, mix: 0.32, wob: 0.35, diff: 0.25 }),
  P('LO-FI MEMORY', 'Low rate, low bits, a faded memory', { st: 'LO-FI', mode: 'SINGLE', div: '1/8', note: 'D', fb: 0.5, mix: 0.35, lofi: true, analog: 0.3 }),
  P('CASSETTE GHOST', 'Worn cassette, flutter and hiss', { st: 'CASSETTE', mode: 'DUAL', div: '1/4', fb: 0.45, mix: 0.3, wob: 0.6, analog: 0.4 }),
  P('CRYSTAL TAILS', 'Repeats rising an octave into the air', { st: 'CRYSTAL', mode: 'PING-PONG', div: '1/4', note: 'D', fb: 0.6, mix: 0.3, diff: 0.3 }),
  P('RHYTHM MACHINE', 'Sixteen taps, a pattern of echoes', { st: 'DIGITAL', mode: 'RHYTHM', div: '1/16', fb: 0.35, mix: 0.32, rhythm: 'MACHINE' }),
  P('TRIPLET RAIN', 'Triplet quarters falling softly', { st: 'TAPE', mode: 'PING-PONG', div: '1/4', note: 'T', fb: 0.5, mix: 0.3, wob: 0.2, high: -0.5 }),
  P('PRIME SCATTER', 'Prime numbered times: no echo lines up', { st: 'DIGITAL', mode: 'DUAL', ms: 300, fb: 0.55, mix: 0.3, prime: true, off: 0.3 }),
  P('DUCKED LEAD', 'Echoes that wait for the notes to stop', { st: 'TAPE', mode: 'PING-PONG', div: '1/8', note: 'D', fb: 0.5, mix: 0.4, wob: 0.3, duck: 0.8, rel: 250 }),
  P('WIDE SLAPBACK', 'Two short times, one per side', { st: 'DIGITAL', mode: 'DUAL', ms: 90, fb: 0.12, mix: 0.35, off: 0.6 }),
  P('WOBBLY TAPE', 'Lots of wow and flutter', { st: 'TAPE', mode: 'PING-PONG', div: '1/4', fb: 0.5, mix: 0.3, wob: 1, sat: 0.2 }),
  P('DIGITAL CLEAN', 'Pristine repeats, nothing added', { st: 'DIGITAL', mode: 'PING-PONG', div: '1/8', note: 'D', fb: 0.4, mix: 0.28, high: 2, low: -1 }),
  P('HAUNTED HALL', 'Long diffused repeats, like a corridor', { st: 'SPACE', mode: 'PING-PONG', div: '1/2', fb: 0.7, mix: 0.35, diff: 0.7, wob: 0.4, high: -0.8 }),
  P('FEEDBACK STORM', 'Runaway feedback held by saturation', { st: 'DUB', mode: 'PING-PONG', div: '1/8', note: 'D', fb: 1, mix: 0.35, sat: 0.7, wob: 0.5, diff: 0.3 }),
  P('GROOVE ECHO', 'Swung echoes that sit behind the beat', { st: 'TAPE', mode: 'PING-PONG', div: '1/8', fb: 0.45, mix: 0.3, groove: 0.6, feel: 0.4, wob: 0.25 }),
  P('MAUDITE ECHO', 'The house echo: tape, dotted, ducked', { st: 'TAPE', mode: 'PING-PONG', div: '1/8', note: 'D', fb: 0.48, mix: 0.32, wob: 0.3, duck: 0.35, sat: 0.1, diff: 0.1 }),
];

const PKEYS = Object.keys(DELAY_PRESETS[0].v);
const cur = (k: string): number => (k === 'delay' ? voyParams.of('delay') : X(k));

/** Le preset dont les reglages sont ceux du moment (a un millieme pres), sinon null. */
export function delayCurrent(): DelayPreset | null {
  return DELAY_PRESETS.find((p) => PKEYS.every((k) => Math.abs(cur(k) - (k === 'xDlFb' ? p.v[k] : Math.round((p.v[k] ?? 0) * 1000) / 1000)) < 0.0015)) ?? null;
}

let lastIdx = -1;
export function delayLoad(p: DelayPreset): void {
  for (const [k, x] of Object.entries(p.v)) {
    if (k === 'delay') voyParams.set('delay', x);
    else arpExtra.set(k, x);
  }
  lastIdx = DELAY_PRESETS.indexOf(p);
}

/** Le precedent (-1) ou le suivant (+1), en boucle ; sans preset reconnu : depuis le dernier charge. */
export function delayStep(d: 1 | -1): void {
  const c = delayCurrent();
  const i = c ? DELAY_PRESETS.indexOf(c) : lastIdx;
  const n = DELAY_PRESETS.length;
  delayLoad(DELAY_PRESETS[i < 0 ? (d > 0 ? 0 : n - 1) : (i + d + n) % n]);
}

/** INIT : la page a son depart (le DELAY du site : la bande, 1/8., la reinjection du site) ; MIX reste (au moins 25 %). */
export function delayInit(): void {
  for (const id of DELAY_IDS) arpExtra.set(id, DEF[id]);
  if (voyParams.of('delay') <= 0) voyParams.set('delay', 0.25);
  lastIdx = -1;
}

/* ---------------- l'ancien DELAY : sa conversion (un preset) ---------------- */

const DIV_OF = [2, 2, 3, 3, 4];
const NOTE_OF = [0, 1, 0, 1, 0];

/**
 * Un preset d'avant la page DELAY (sans xDlStyle) : son ancien DELAY (DLY TIME, TAPE, DELAY MODE) passe a la page, par la
 * regle de PluginProcessor::convertDelay, au bit pres : TAPE au-dessus de 0.02 -> TAPE, WOBBLE = TAPE, PING-PONG ; sinon
 * DIGITAL, WOBBLE 0, PING PONG / STEREO / WIDE -> PING-PONG / DUAL / WIDE ; DLY TIME -> SYNC, 1/8 1/8. 1/4 1/4. 1/2 ;
 * FEEDBACK = 0.35 + 0.33 x DELAY. Le reste de la page a son depart.
 */
export function delayFromOld(x: Record<string, unknown>, k: { delay: number; dlyTime: number; tape: number }): Record<string, unknown> {
  if (typeof x.xDlStyle === 'number') return x;
  const out: Record<string, unknown> = { ...x };
  for (const id of DELAY_IDS) out[id] = DEF[id];
  const dm = typeof x.xDlyMode === 'number' ? Math.round(clamp01(x.xDlyMode) * 2) : 0;
  if (k.tape >= 0.02) {
    out.xDlStyle = pick('xDlStyle', 'TAPE');
    out.xDlWobble = k.tape;
    out.xDlMode = pick('xDlMode', 'PING-PONG');
  } else {
    out.xDlStyle = pick('xDlStyle', 'DIGITAL');
    out.xDlWobble = 0;
    out.xDlMode = pick('xDlMode', dm === 1 ? 'DUAL' : dm === 2 ? 'WIDE' : 'PING-PONG');
  }
  const dt = Math.max(0, Math.min(4, Math.round(clamp01(k.dlyTime) * 4)));
  out.xDlSync = 1;
  out.xDlDiv = DIV_OF[dt] / 6;
  out.xDlNote = NOTE_OF[dt] / 2;
  out.xDlFb = 0.35 + (0.68 - 0.35) * k.delay;
  return out;
}

/* ---------------- ce qui est grise sur la page ---------------- */

/** Grise : sans effet tel que le DELAY est regle. */
export function delayInert(id: string): boolean {
  if (!(id in DEF)) return false;
  const mode = dlIdx('xDlMode', X('xDlMode'));
  const single = mode === 0;
  const rhythm = mode === 4;
  switch (id) {
    case 'xDlOffset':
      return single || rhythm;
    case 'xDlGroove':
      return single;
    case 'xDlWidth':
      return single;
    case 'xDlRhythm':
      return !rhythm;
    case 'xDlDuckRel':
      return X('xDlDuck') <= 0;
    case 'xDlMs':
      return dlIdx('xDlSync', X('xDlSync')) === 1;
    case 'xDlDiv':
    case 'xDlNote':
      return dlIdx('xDlSync', X('xDlSync')) === 0;
    default:
      return false;
  }
}
