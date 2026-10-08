/**
 * Effets par piste (2026-10-01) : chaque voix (BD a PC, dix depuis le 2026-10-03) a son
 * propre TONE (hauteur et filtre), DECAY (2026-10-04, la queue du coup ; le
 * STRETCH des voix avant), LEVEL, DIST, REVERB, DELAY et CHORUS.
 * Un pad selectionne : les potards reglent cette voix ; sans selection,
 * ils reglent tout le pattern (le bus, drums.ts). Neutre au depart :
 * TONE 0, DECAY 1 (la queue entiere), LEVEL 0.8 (gain 1, la voix telle quelle), le reste a 0 ; a ces
 * valeurs chaque insert est en bypass reel et chaque envoi debranche.
 * Garde en memoire seulement : une visite repart neutre.
 *
 * TUNE, PAN et START (2026-10-08, l'etape R2 des P-locks, Mika : "quand on
 * clic sur un step on selectionne la partie qu'on veut modifier ... on tourne
 * un encoder sur ce step et donc ce step a une valeur differente") : trois
 * reglages de plus par voix, comme sur une Digitakt (SRC TUNE, AMP PAN, SMPL
 * START), appliques coup par coup (audio/drums.ts hitParams) et donc
 * verrouillables pas par pas (audio/locks.ts). A 0 (leur depart), rien ne
 * change dans le graphe ni dans le son :
 * - TUNE : -1 a 1, au demi-ton (+/-24) ; le coup est calcule a sa hauteur,
 *   comme TONE (audio/shots.ts), jamais relu plus vite ;
 * - PAN : -1 (gauche) a 1 (droite), un StereoPannerNode par coup, seulement
 *   hors du centre ;
 * - START : 0 a 1, ou le coup commence dans son echantillon (0 : au debut).
 */

import type { Inst } from '../theme';
import { snapTone } from './tone';

export type VoiceParam = 'tone' | 'decay' | 'level' | 'dist' | 'reverb' | 'delay' | 'chorus' | 'tune' | 'pan' | 'start';
export const VOICE_PARAMS: readonly VoiceParam[] = ['tone', 'decay', 'level', 'dist', 'reverb', 'delay', 'chorus', 'tune', 'pan', 'start'];

export type VoiceFx = Record<VoiceParam, number>;

export const VOICE_FX_DEFAULT: Readonly<VoiceFx> = { tone: 0, decay: 1, level: 0.8, dist: 0, reverb: 0, delay: 0, chorus: 0, tune: 0, pan: 0, start: 0 };

/** TUNE : +/-24 demi-tons aux butees, au demi-ton pres (49 crans). */
export const TUNE_ST = 24;
/** TUNE au demi-ton : -1 a 1 par pas de 1/24. */
export const snapTune = (v: number): number => (Number.isFinite(v) ? Math.max(-TUNE_ST, Math.min(TUNE_ST, Math.round(v * TUNE_ST))) / TUNE_ST : 0);
/** Les demi-tons de TUNE (-24 a +24). */
export const tuneSt = (v: number): number => Math.round(snapTune(v) * TUNE_ST);
/** Le facteur de hauteur de TUNE : exactement 1 a 0. */
export const tuneFactor = (v: number): number => {
  const st = tuneSt(v);
  return st === 0 ? 1 : Math.pow(2, st / 12);
};
/** PAN : -1 a 1, colle au centre a moins de 2 % (un glisser y revient). */
export const snapPan = (v: number): number => {
  const c = Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
  return Math.abs(c) < 0.02 ? 0 : Math.round(c * 1000) / 1000;
};
/** START : 0 a 1 ; au plus 90 % de l'echantillon (au-dela, presque rien ne sonnerait). */
export const START_MAX = 0.9;

/**
 * DECAY d'une voix (2026-10-04, Mika : "au lieu de Stretch dans les voices,
 * mets Decay pour gerer le decay des oneshots") : 1, la queue entiere (pas
 * d'enveloppe) ; en dessous, le coup garde son attaque (4 ms) puis s'eteint
 * en exponentielle, constante de temps 12 ms (0) a environ 0.7 s (0.99).
 */
export const DECAY_HOLD_S = 0.004;
export const decayTau = (v: number): number | null => (v >= 0.995 ? null : 0.012 * Math.pow(60, Math.max(0, v)));

/** LEVEL d'une voix : gain (v / 0.8)^2, donc exactement 1 au depart, +3.9 dB a fond. */
export const voiceGain = (level: number): number => (level / VOICE_FX_DEFAULT.level) ** 2;

const clamp = (p: VoiceParam, v: number): number => {
  if (p === 'tone') return snapTone(v);
  if (p === 'tune') return snapTune(v);
  if (p === 'pan') return snapPan(v);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : p === 'decay' ? 1 : 0;
};

const INSTS: readonly Inst[] = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'];

let state: Readonly<Record<Inst, Readonly<VoiceFx>>> = Object.fromEntries(INSTS.map((i) => [i, { ...VOICE_FX_DEFAULT }])) as Record<Inst, VoiceFx>;
const listeners = new Set<() => void>();

export const voiceFx = {
  get: (): Readonly<Record<Inst, Readonly<VoiceFx>>> => state,
  of: (inst: Inst): Readonly<VoiceFx> => state[inst],
  /** Un reglage d'une voix ; rien ne part si rien ne change. */
  set(inst: Inst, p: VoiceParam, v: number): void {
    const t = clamp(p, v);
    if (state[inst][p] === t) return;
    state = { ...state, [inst]: { ...state[inst], [p]: t } };
    listeners.forEach((l) => l());
  },
  /** La voix revient au neutre. */
  reset(inst: Inst): void {
    state = { ...state, [inst]: { ...VOICE_FX_DEFAULT } };
    listeners.forEach((l) => l());
  },
  /** true si la voix a au moins un effet engage. */
  active: (inst: Inst): boolean => VOICE_PARAMS.some((p) => state[inst][p] !== VOICE_FX_DEFAULT[p]),
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
