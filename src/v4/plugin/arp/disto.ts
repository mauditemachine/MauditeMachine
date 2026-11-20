/**
 * DISTO (2026-11-16, facon Decapitator ; completee le 2026-11-17, v25, la maquette validee par Mika : "ok code et
 * publie, masque la pedale avec conversion"). Le DSP : plugin/mm-arp/dsp/Decap.{h,cpp} ; les reglages : extra-params.json,
 * section disto, et le potard DISTO de la face (dist) pour DRIVE. Ici, cote face :
 * - les styles, les lois (les memes que Decap.cpp) et la courbe de chaque style (l'ecran TRANSFER de la page) ;
 * - la banque de presets (v46 : les 18 de distoBank.ts, par famille) : un preset regle toute la DISTO, DRIVE compris ;
 *   INIT : tout a son depart sauf STYLE (A, pour qu'on entende) et DRIVE (celui du moment) ;
 * - la conversion de la pedale DISTORTION masquee (xDist, xDistTone), pour un preset (le C++ fait la meme pour un projet,
 *   PluginProcessor::convertPedal) ;
 * - ce qui est grise sur la page (inert).
 */

import spec from '../../../../plugin/mm-arp/extra-params.json';
import { voyParams } from '../../voyager/params';
import { arpExtra } from './extra';
import { DISTO_BANK, type DistoBankPreset } from './distoBank';

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
  /** PUNISH v2 : le second etage, dur asymetrique (genou 0.9, biais 0.12) attaque a +6 dB, ramene a pente 1 */
  punish2: (u: number): number => (kneeG(0.9, 2 * u + 0.12) - kneeG(0.9, 0.12)) / 2,
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

/**
 * v46 (2026-11-20, Mika valide la page A) : la banque de la page est celle de distoBank.ts, 18 presets facon Decapitator
 * ranges par famille (TAPE, TUBE, TRANSISTOR, DESTROY) ; les 20 d'avant ne sont plus montres. PUNISH y est le PUNISH v2
 * (xDPunish2), l'ancien (xDPunish, OLD) a 0.
 */
export type DistoPreset = DistoBankPreset;
export const DISTO_PRESETS: readonly DistoPreset[] = DISTO_BANK;

const pick = (id: string, name: string): number => {
  const s = steps(id);
  const i = s.indexOf(name);
  if (i < 0) throw new Error(`DISTO : ${id} inconnu ${name}`);
  return i / (s.length - 1);
};
const filtV = (hz: number): number => Math.log(hz / 20) / Math.log(1000);

const PKEYS = Object.keys(DISTO_PRESETS[0].v);
const cur = (k: string): number => (k === 'dist' ? voyParams.of('dist') : X(k));

/** Le preset dont les reglages sont ceux du moment (a un millieme pres), sinon null. */
export function distoCurrent(): DistoPreset | null {
  return DISTO_PRESETS.find((p) => PKEYS.every((k) => Math.abs(cur(k) - (p.v[k] ?? 0)) < 0.0015)) ?? null;
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
