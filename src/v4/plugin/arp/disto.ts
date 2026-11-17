/**
 * DISTO (2026-11-16, facon Decapitator ; completee le 2026-11-17, v25, la maquette validee par Mika : "ok code et
 * publie, masque la pedale avec conversion"). Le DSP : plugin/mm-arp/dsp/Decap.{h,cpp} ; les reglages : extra-params.json,
 * section disto, et le potard DISTO de la face (dist) pour DRIVE. Ici, cote face :
 * - les styles, les lois (les memes que Decap.cpp) et la courbe de chaque style (l'ecran TRANSFER de la page) ;
 * - la banque de presets (20, noms et reglages a nous) : un preset regle toute la DISTO, DRIVE compris ; INIT : tout a
 *   son depart sauf STYLE (A, pour qu'on entende) et DRIVE (celui du moment) ;
 * - la conversion de la pedale DISTORTION masquee (xDist, xDistTone), pour un preset (le C++ fait la meme pour un projet,
 *   PluginProcessor::convertPedal) ;
 * - ce qui est grise sur la page (inert).
 */

import spec from '../../../../plugin/mm-arp/extra-params.json';
import { voyParams } from '../../voyager/params';
import { arpExtra } from './extra';
import { LFO_BEAT_NAMES } from './hell';

const steps = (id: string): readonly string[] => (spec.params.find((p) => p.id === id)?.steps ?? []) as readonly string[];
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const idxOf = (id: string, v: number): number => {
  const n = steps(id).length;
  return Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))));
};

/** MM, A, E, N, T, P, TAPE, FUZZ, DIODE, AMP, RECT, FOLD, CRUSH (xDStyle) */
export const DISTO_STYLES = steps('xDStyle');
/** A ... CRUSH : les courbes (xDMorphTo, et Decap.cpp, 0..11) */
export const DISTO_CURVES = steps('xDMorphTo');
export const DISTO_LONG: Readonly<Record<string, string>> = {
  MM: 'ENGINE OVERDRIVE',
  A: 'TUBE PREAMP',
  E: 'TRANSISTOR',
  N: 'TRANSFORMER',
  T: 'TRIODE',
  P: 'PENTODE',
  TAPE: 'TAPE',
  FUZZ: 'FUZZ',
  DIODE: 'DIODE CLIP',
  AMP: 'GUITAR AMP',
  RECT: 'RECTIFIER',
  FOLD: 'WAVEFOLDER',
  CRUSH: 'BIT CRUSHER',
  MAIN: 'MAIN STYLE',
};
export const DISTO_IDS: readonly string[] = spec.params.filter((p) => p.section === 'disto').map((p) => p.id);
const DEF: Readonly<Record<string, number>> = Object.fromEntries(spec.params.filter((p) => p.section === 'disto').map((p) => [p.id, p.def]));
const X = (id: string): number => arpExtra.of(id);

/* ---------------- les lois (Decap.cpp) ---------------- */

export const distoLaws = {
  driveDb: (v: number, punish: boolean): number => 36 * v + (punish ? 20 : 0),
  outDb: (v: number): number => -18 + 36 * v,
  lowHz: (v: number): number => (v < 0.02 ? 0 : 20 * Math.pow(50, (v - 0.02) / 0.98)),
  highHz: (v: number): number => (v > 0.98 ? 0 : 1000 * Math.pow(20, v / 0.98)),
  filtHz: (v: number): number => 20 * Math.pow(1000, clamp01(v)),
  xLoHz: (v: number): number => 40 * Math.pow(25, clamp01(v)),
  xHiHz: (v: number): number => 600 * Math.pow(25, clamp01(v)),
};

/* ---------------- les courbes (le miroir de Decap.cpp, pour l'ecran TRANSFER) ---------------- */

const BIAS = [0.2, 0.04, 0.08, 0, 0.12, 0.05, 0.35, 0, 0.15, 0, 0, 0];
const KNEE = [0, 0.55, 0, 0, 0.85, 0, 0.25, 0.9, 0, 0, 0, 0];
const CRUSH_Q = 1 / 12;
const kneeG = (a: number, u: number): number => {
  const v = Math.abs(u);
  if (v <= a) return u;
  if (v >= 2 - a) return Math.sign(u);
  const d = v - a;
  return Math.sign(u) * (v - (d * d) / (4 * (1 - a)));
};
function rawG(s: number, u: number): number {
  switch (s) {
    case 0:
      return Math.tanh(u);
    case 1:
    case 4:
    case 6:
    case 7:
      return kneeG(KNEE[s], u);
    case 2:
      return u > 1.5 ? 1 : u < -1.5 ? -1 : u - (4 / 27) * u * u * u;
    case 3:
      return u >= 0 ? Math.tanh(0.7 * u) / 0.7 : Math.tanh(1.5 * u) / 1.5;
    case 5:
      return (2 / Math.PI) * Math.atan((Math.PI / 2) * u);
    case 8:
      return u >= 0 ? Math.tanh(1.2 * u) / 1.2 : Math.tanh(2.4 * u) / 2.4;
    case 9: {
      const t = Math.tanh(u);
      return t + 0.9 * t * t;
    }
    case 10:
      return Math.sin(u);
    case 11:
      return Math.sign(u) * CRUSH_Q * Math.min(12, Math.floor(Math.abs(u) / CRUSH_Q + 0.5));
    default:
      return u;
  }
}
const NORM = BIAS.map((b, s) => {
  const h = 1e-5;
  return { gb: rawG(s, b), inv: s === 11 ? 1 : 1 / ((rawG(s, b + h) - rawG(s, b - h)) / (2 * h)) };
});
/** La courbe d'une des 12 courbes (0 A ... 11 CRUSH), pente 1 a l'origine (sauf CRUSH). */
export function distoCurve(s: number, x: number): number {
  const k = Math.max(0, Math.min(11, s));
  return (rawG(k, x + BIAS[k]) - NORM[k].gb) * NORM[k].inv;
}

/* ---------------- les presets ---------------- */

export interface DistoPreset {
  name: string;
  desc: string;
  /** les reglages de la DISTO, et dist (DRIVE) */
  v: Readonly<Record<string, number>>;
}

type Curve = 'A' | 'E' | 'N' | 'T' | 'P' | 'TAPE' | 'FUZZ' | 'DIODE' | 'AMP' | 'RECT' | 'FOLD' | 'CRUSH';
interface Band {
  st?: Curve;
  /** dB autour du DRIVE */
  dr?: number;
  mix?: number;
  /** dB */
  lv?: number;
  solo?: boolean;
  byp?: boolean;
}
interface Units {
  st: Curve | 'MM';
  drive: number;
  punish?: boolean;
  /** Hz (0 : OFF) */
  low?: number;
  thump?: boolean;
  /** -1 (DARK) .. 1 (BRIGHT) */
  tone?: number;
  /** Hz (0 : OFF) */
  high?: number;
  steep?: boolean;
  mix?: number;
  /** dB */
  out?: number;
  auto?: boolean;
  morph?: number;
  to?: Curve;
  /** -1 COMP .. 1 EXPAND */
  dyn?: number;
  fb?: number;
  fbHz?: number;
  bands?: 1 | 2 | 3;
  xLo?: number;
  xHi?: number;
  b?: [Band?, Band?, Band?];
  /** -1 .. 1 */
  env?: number;
  envSpd?: number;
  lfo?: { shape?: 'SINE' | 'TRI' | 'SAW' | 'SQUARE' | 'RANDOM'; rate: number | string; amt: number; tgt: 'DRIVE' | 'MORPH' | 'TONE' | 'PRE' | 'POST' | 'MIX' };
  pre?: { mode: 'LP' | 'BP' | 'HP' | 'PEAK'; hz: number; reso?: number };
  post?: { mode: 'LP' | 'BP' | 'HP' | 'PEAK'; hz: number; reso?: number };
  box?: { type: 'SMALL' | 'COMBO' | 'STACK' | 'RADIO'; size?: number; mix?: number };
}

const pick = (id: string, name: string): number => {
  const s = steps(id);
  const i = s.indexOf(name);
  if (i < 0) throw new Error(`DISTO : ${id} inconnu ${name}`);
  return i / (s.length - 1);
};
const lowV = (hz: number): number => (hz <= 0 ? 0 : 0.02 + (0.98 * Math.log(hz / 20)) / Math.log(50));
const highV = (hz: number): number => (hz <= 0 ? 1 : (0.98 * Math.log(hz / 1000)) / Math.log(20));
const filtV = (hz: number): number => Math.log(hz / 20) / Math.log(1000);
const bip = (x: number): number => 0.5 + x / 2;

const P = (name: string, desc: string, o: Units): DistoPreset => {
  const v: Record<string, number> = { ...DEF };
  v.dist = o.drive;
  v.xDStyle = pick('xDStyle', o.st);
  v.xDPunish = o.punish ? 1 : 0;
  v.xDLow = lowV(o.low ?? 0);
  v.xDThump = o.thump ? 1 : 0;
  v.xDTone = bip(o.tone ?? 0);
  v.xDHigh = highV(o.high ?? 0);
  v.xDSteep = o.steep ? 1 : 0;
  v.xDMix = o.mix ?? 1;
  v.xDOut = ((o.out ?? 0) + 18) / 36;
  v.xDAuto = o.auto === false ? 0 : 1;
  v.xDMorph = o.morph ?? 0;
  v.xDMorphTo = pick('xDMorphTo', o.to ?? 'A');
  v.xDDyn = bip(o.dyn ?? 0);
  v.xDFb = o.fb ?? 0;
  if (o.fbHz) v.xDFbFreq = Math.log(o.fbHz / 40) / Math.log(30);
  v.xDBands = ((o.bands ?? 1) - 1) / 2;
  if (o.xLo) v.xDXLo = Math.log(o.xLo / 40) / Math.log(25);
  if (o.xHi) v.xDXHi = Math.log(o.xHi / 600) / Math.log(25);
  (o.b ?? []).forEach((b, i) => {
    if (!b) return;
    const k = `xDB${i + 1}`;
    v[`${k}Style`] = pick(`${k}Style`, b.st ?? 'MAIN');
    v[`${k}Drive`] = ((b.dr ?? 0) + 18) / 36;
    v[`${k}Mix`] = b.mix ?? 1;
    v[`${k}Level`] = ((b.lv ?? 0) + 12) / 24;
    v[`${k}Solo`] = b.solo ? 1 : 0;
    v[`${k}Byp`] = b.byp ? 1 : 0;
  });
  v.xDEnvAmt = bip(o.env ?? 0);
  if (o.envSpd !== undefined) v.xDEnvSpd = o.envSpd;
  if (o.lfo) {
    const sync = typeof o.lfo.rate === 'string';
    v.xDLfoShape = pick('xDLfoShape', o.lfo.shape ?? 'SINE');
    v.xDLfoSync = sync ? 1 : 0;
    v.xDLfoRate = sync ? LFO_BEAT_NAMES.indexOf(o.lfo.rate as (typeof LFO_BEAT_NAMES)[number]) / (LFO_BEAT_NAMES.length - 1) : Math.log((o.lfo.rate as number) / 0.02) / Math.log(500);
    v.xDLfoAmt = bip(o.lfo.amt);
    v.xDLfoTarget = pick('xDLfoTarget', o.lfo.tgt);
  }
  if (o.pre) {
    v.xDPreMode = pick('xDPreMode', o.pre.mode);
    v.xDPreFreq = filtV(o.pre.hz);
    v.xDPreReso = o.pre.reso ?? 0;
  }
  if (o.post) {
    v.xDPostMode = pick('xDPostMode', o.post.mode);
    v.xDPostFreq = filtV(o.post.hz);
    v.xDPostReso = o.post.reso ?? 0;
  }
  if (o.box) {
    v.xDBox = pick('xDBox', o.box.type);
    v.xDBoxSize = o.box.size ?? 0.5;
    v.xDBoxMix = o.box.mix ?? 1;
  }
  for (const [k, x] of Object.entries(v)) if (!Number.isFinite(x) || x < 0 || x > 1) throw new Error(`DISTO ${name} : ${k} hors de 0..1 (${x})`);
  return { name, desc, v };
};

export const DISTO_PRESETS: readonly DistoPreset[] = [
  P('WARM GLUE', 'Style A, a little drive, the level kept by AUTO', { st: 'A', drive: 0.25, tone: 0.1, high: 16000 }),
  P('TAPE KISS', 'Tape saturation, the highs rounded off', { st: 'TAPE', drive: 0.35, low: 30, high: 9000, dyn: -0.2 }),
  P('CONSOLE PUSH', 'Style N with THUMP, mix bus grit', { st: 'N', drive: 0.45, low: 60, thump: true, high: 14000 }),
  P('PENTODE BITE', 'Style P, bright and forward', { st: 'P', drive: 0.55, tone: 0.4, low: 120 }),
  P('TRIODE BLOOM', 'Triode warmth folding into the highs, breathing with the playing', {
    st: 'T',
    drive: 0.62,
    low: 70,
    thump: true,
    tone: 0.2,
    high: 11000,
    mix: 0.85,
    morph: 0.35,
    to: 'FOLD',
    dyn: -0.36,
    fb: 0.18,
    bands: 3,
    xLo: 120,
    xHi: 3100,
    b: [{ dr: -6, mix: 0.6 }, { dr: 4 }, { st: 'FOLD', mix: 0.72, lv: -1.5, byp: false }],
    env: 0.36,
    envSpd: 0.3,
    lfo: { shape: 'SINE', rate: '1/2', amt: 0.24, tgt: 'MORPH' },
    pre: { mode: 'HP', hz: 90, reso: 0.2 },
    post: { mode: 'LP', hz: 9000, reso: 0.38 },
    box: { type: 'COMBO', size: 0.4, mix: 0.3 },
  }),
  P('PUNISHED', 'Style E with PUNISH, steep high cut', { st: 'E', drive: 0.7, punish: true, low: 80, high: 6000, steep: true }),
  P('FUZZ CELLAR', 'Fuzz through a low box, dark and woolly', { st: 'FUZZ', drive: 0.75, tone: -0.3, post: { mode: 'LP', hz: 3500, reso: 0.2 }, box: { type: 'STACK', size: 0.7, mix: 0.8 } }),
  P('DIODE RAIL', 'Hard diode clipping, tight lows', { st: 'DIODE', drive: 0.6, low: 150, high: 12000, steep: true }),
  P('OCTAVE GHOST', 'Rectifier: an octave up shimmering over the note', { st: 'RECT', drive: 0.55, mix: 0.6, pre: { mode: 'HP', hz: 300 }, post: { mode: 'LP', hz: 9000 } }),
  P('FOLDED SINE', 'Wavefolder morphed by the LFO, in tempo', { st: 'A', drive: 0.5, morph: 0.4, to: 'FOLD', mix: 0.8, lfo: { shape: 'SINE', rate: '1/4', amt: 0.6, tgt: 'MORPH' } }),
  P('BITTER CRUSH', 'Bit crusher tamed by the post low-pass', { st: 'CRUSH', drive: 0.4, mix: 0.75, post: { mode: 'LP', hz: 4500, reso: 0.3 } }),
  P('SMALL RADIO', 'Band-pass before, a radio box after', { st: 'E', drive: 0.45, low: 200, pre: { mode: 'BP', hz: 1200, reso: 0.3 }, box: { type: 'RADIO', size: 0.5, mix: 1 } }),
  P('AMP IN A BOX', 'Guitar amp into a combo', { st: 'AMP', drive: 0.6, low: 90, box: { type: 'COMBO', size: 0.5, mix: 1 } }),
  P('STACK ATTACK', 'Amp into a stack, two bands', { st: 'AMP', drive: 0.65, dyn: 0.3, bands: 2, xLo: 250, b: [{ st: 'N', dr: -6 }, {}], box: { type: 'STACK', size: 0.6, mix: 0.9 } }),
  P('SUB SAFE', 'Three bands: the lows left clean, the mids driven', { st: 'P', drive: 0.6, bands: 3, xLo: 150, xHi: 3500, b: [{ byp: true }, { dr: 6 }, { mix: 0.6, lv: -3 }] }),
  P('AIR TEARS', 'Three bands: the highs folded, the rest warm', { st: 'A', drive: 0.45, bands: 3, xLo: 200, xHi: 5000, b: [{ st: 'TAPE' }, {}, { st: 'FOLD', dr: 6, mix: 0.7 }] }),
  P('BREATHING DIRT', 'Expanding dynamics, the envelope opens the drive', { st: 'T', drive: 0.35, dyn: 0.5, env: 0.7, envSpd: 0.4 }),
  P('WOBBLE GRIT', 'The LFO on DRIVE, synced to 1/8', { st: 'FUZZ', drive: 0.45, lfo: { shape: 'SINE', rate: '1/8', amt: 0.7, tgt: 'DRIVE' }, post: { mode: 'LP', hz: 6000 } }),
  P('MELTDOWN', 'Feedback, PUNISH and fuzz: handle with care', { st: 'FUZZ', drive: 0.8, punish: true, fb: 0.85, fbHz: 220, out: -6, post: { mode: 'LP', hz: 5000, reso: 0.4 } }),
  P('MAUDITE', 'The house sound: tape into triode, a touch of box', { st: 'TAPE', drive: 0.4, morph: 0.3, to: 'T', dyn: -0.2, high: 15000, box: { type: 'SMALL', size: 0.5, mix: 0.35 } }),
];

const PKEYS = Object.keys(DISTO_PRESETS[0].v);
const cur = (k: string): number => (k === 'dist' ? voyParams.of('dist') : X(k));

/** Le preset dont les reglages sont ceux du moment (a un millieme pres), sinon null. */
export function distoCurrent(): DistoPreset | null {
  return DISTO_PRESETS.find((p) => PKEYS.every((k) => Math.abs(cur(k) - Math.round((p.v[k] ?? 0) * 1000) / 1000) < 0.0015)) ?? null;
}

let lastIdx = -1;
export function distoLoad(p: DistoPreset): void {
  for (const [k, x] of Object.entries(p.v)) {
    if (k === 'dist') voyParams.set('dist', x);
    else arpExtra.set(k, x);
  }
  lastIdx = DISTO_PRESETS.indexOf(p);
}

/** Le precedent (-1) ou le suivant (+1), en boucle ; sans preset reconnu : depuis le dernier charge. */
export function distoStep(d: 1 | -1): void {
  const c = distoCurrent();
  const i = c ? DISTO_PRESETS.indexOf(c) : lastIdx;
  const n = DISTO_PRESETS.length;
  distoLoad(DISTO_PRESETS[i < 0 ? (d > 0 ? 0 : n - 1) : (i + d + n) % n]);
}

/** INIT : toute la DISTO a son depart, sauf STYLE (A : on l'entend) ; DRIVE reste ou il est (au moins 25 %). */
export function distoInit(): void {
  for (const id of DISTO_IDS) arpExtra.set(id, DEF[id]);
  arpExtra.set('xDStyle', pick('xDStyle', 'A'));
  if (voyParams.of('dist') <= 0) voyParams.set('dist', 0.25);
  lastIdx = -1;
}

/* ---------------- la pedale DISTORTION masquee : sa conversion (un preset) ---------------- */

const distToneHz = (t: number): number => 700 * Math.pow(18000 / 700, clamp01(t));
const distPresenceDb = (t: number): number => 12 * Math.max(0, clamp01(t) - 0.5);

/**
 * Un preset qui avait la pedale DISTORTION (xDist au-dessus de 0) : la DISTO la plus proche (la regle de
 * PluginProcessor::convertPedal) : STYLE DIODE, DRIVE = la dose, MIX = min(1, 20 x dose), AUTO, POST FILTER LP a la
 * frequence de son TONE (RESO 0), sa presence en TONE ; seulement si la DISTO est encore MM, sinon la pedale est coupee.
 * Rend les reglages convertis et, s'il change, le DRIVE.
 */
export function distoFromPedal(x: Record<string, unknown>): { x: Record<string, unknown>; dist?: number } {
  const a = typeof x.xDist === 'number' && Number.isFinite(x.xDist) ? x.xDist : 0;
  if (!(a > 0)) return { x };
  const t = typeof x.xDistTone === 'number' && Number.isFinite(x.xDistTone) ? x.xDistTone : 0.5;
  const out: Record<string, unknown> = { ...x, xDist: 0, xDistTone: 0.5 };
  const st = typeof x.xDStyle === 'number' ? idxOf('xDStyle', x.xDStyle) : 0;
  if (st !== 0) return { x: out };
  out.xDStyle = pick('xDStyle', 'DIODE');
  out.xDMix = Math.min(1, 20 * a);
  out.xDAuto = 1;
  out.xDPostMode = pick('xDPostMode', 'LP');
  out.xDPostFreq = filtV(distToneHz(t));
  out.xDPostReso = 0;
  if (t > 0.5) out.xDTone = 0.5 + distPresenceDb(t) / 12;
  return { x: out, dist: a };
}

/* ---------------- ce qui est grise sur la page ---------------- */

const BAND_RE = /^xDB([123])(Style|Drive|Mix|Level|Solo|Byp)$/;
/** Grise : sans effet tel que la DISTO est reglee (MM : seuls STYLE, DRIVE et OUTPUT agissent). */
export function distoInert(id: string): boolean {
  if (!id.startsWith('xD') || id === 'xDStyle' || id === 'xDOut' || id === 'xDist' || id === 'xDistTone' || id.startsWith('xDly')) return false;
  if (!(id in DEF)) return false;
  if (idxOf('xDStyle', X('xDStyle')) === 0) return true;
  const bands = 1 + idxOf('xDBands', X('xDBands'));
  const m = BAND_RE.exec(id);
  if (m) return Number(m[1]) > bands || bands === 1;
  const lfoOn = Math.abs(X('xDLfoAmt') - 0.5) > 0.001;
  switch (id) {
    case 'xDXLo':
      return bands < 2;
    case 'xDXHi':
      return bands < 3;
    case 'xDMorphTo':
      return X('xDMorph') <= 0 && !(lfoOn && idxOf('xDLfoTarget', X('xDLfoTarget')) === 1);
    case 'xDFbFreq':
      return X('xDFb') <= 0;
    case 'xDEnvSpd':
      return Math.abs(X('xDEnvAmt') - 0.5) < 0.001;
    case 'xDLfoShape':
    case 'xDLfoRate':
    case 'xDLfoSync':
    case 'xDLfoTarget':
      return !lfoOn;
    case 'xDPreFreq':
    case 'xDPreReso':
      return idxOf('xDPreMode', X('xDPreMode')) === 0;
    case 'xDPostFreq':
    case 'xDPostReso':
      return idxOf('xDPostMode', X('xDPostMode')) === 0;
    case 'xDBoxSize':
    case 'xDBoxMix':
      return idxOf('xDBox', X('xDBox')) === 0;
    default:
      return false;
  }
}
