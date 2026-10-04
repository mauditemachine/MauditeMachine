/**
 * Effets par piste (2026-10-01) : chaque voix (BD a PC, dix depuis le 2026-10-03) a son
 * propre TONE (hauteur et filtre), DECAY (2026-10-04, la queue du coup ; le
 * STRETCH des voix avant), LEVEL, DIST, REVERB, DELAY et CHORUS.
 * Un pad selectionne : les potards reglent cette voix ; sans selection,
 * ils reglent tout le pattern (le bus, drums.ts). Neutre au depart :
 * TONE 0, DECAY 1 (la queue entiere), LEVEL 0.8 (gain 1, la voix telle quelle), le reste a 0 ; a ces
 * valeurs chaque insert est en bypass reel et chaque envoi debranche.
 * Garde en memoire seulement : une visite repart neutre.
 */

import type { Inst } from '../theme';
import { snapTone } from './tone';

export type VoiceParam = 'tone' | 'decay' | 'level' | 'dist' | 'reverb' | 'delay' | 'chorus';
export const VOICE_PARAMS: readonly VoiceParam[] = ['tone', 'decay', 'level', 'dist', 'reverb', 'delay', 'chorus'];

export type VoiceFx = Record<VoiceParam, number>;

export const VOICE_FX_DEFAULT: Readonly<VoiceFx> = { tone: 0, decay: 1, level: 0.8, dist: 0, reverb: 0, delay: 0, chorus: 0 };

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
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : p === 'decay' ? 1 : 0;
};

const INSTS: readonly Inst[] = ['BD', 'SD', 'TOM', 'CH', 'OH', 'CP', 'RS', 'HT', 'CY', 'PC'];

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
