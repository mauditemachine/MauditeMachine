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

/*
 * L'etape 2 de la refonte (2026-10-09, Mika : "on doit ensuite avoir un
 * bouton ENV donc AMP doit s'appeler ENV et doit etre plus complet pour
 * modifier les choses") : neuf reglages de plus par voix, tous coup par coup
 * (audio/drums.ts hitParams) et donc verrouillables pas par pas :
 * - atk, hold : l'attaque et la tenue de l'enveloppe du coup (ENV ATK et
 *   HOLD), avant DEC ; a 0 le coup d'avant au pixel pres (la frappe nette, les
 *   4 ms de DECAY_HOLD_S) ;
 * - fine : l'accord fin de toute la voix (VOICE FINE, +/-64 cents, au cent),
 *   a cote de PITCH (les demi-tons de tune) ;
 * - ftype, fcut, freso, fenv, fatk, fdec : le filtre de la page FLTR (un
 *   BiquadFilterNode par coup : passe-bas, passe-haut ou passe-bande, sa
 *   coupure, sa resonance, la profondeur et les temps de son enveloppe) ; au
 *   depart (passe-bas ouvert, sans enveloppe) il n'existe pas, le son d'avant.
 */
export type VoiceParam =
  | 'tone'
  | 'decay'
  | 'level'
  | 'dist'
  | 'reverb'
  | 'delay'
  | 'chorus'
  | 'tune'
  | 'pan'
  | 'start'
  | 'atk'
  | 'hold'
  | 'fine'
  | 'ftype'
  | 'fcut'
  | 'freso'
  | 'fenv'
  | 'fatk'
  | 'fdec';
export const VOICE_PARAMS: readonly VoiceParam[] = ['tone', 'decay', 'level', 'dist', 'reverb', 'delay', 'chorus', 'tune', 'pan', 'start', 'atk', 'hold', 'fine', 'ftype', 'fcut', 'freso', 'fenv', 'fatk', 'fdec'];

export type VoiceFx = Record<VoiceParam, number>;

export const VOICE_FX_DEFAULT: Readonly<VoiceFx> = {
  tone: 0,
  decay: 1,
  level: 0.8,
  dist: 0,
  reverb: 0,
  delay: 0,
  chorus: 0,
  tune: 0,
  pan: 0,
  start: 0,
  atk: 0,
  hold: 0,
  fine: 0,
  ftype: 0,
  fcut: 1,
  freso: 0,
  fenv: 0,
  fatk: 0,
  fdec: 0.5,
};

/* ---------------- l'enveloppe du coup (ENV, 2026-10-09) ---------------- */

/** ATK : 0 la frappe nette (aucune rampe) ; sinon 1 ms a 0.5 s, en loi exponentielle (le milieu : 22 ms). */
export const atkS = (v: number): number => (v > 0 ? 0.001 * Math.pow(500, Math.min(1, v)) : 0);
/** HOLD : la tenue avant DEC ; 0 les 4 ms d'avant (DECAY_HOLD_S), jusqu'a environ 1 s (le milieu : 49 ms). */
export const holdS = (v: number): number => 0.004 + (v > 0 ? 0.002 * Math.pow(500, Math.min(1, v)) : 0);

/* ---------------- FINE (2026-10-09) ---------------- */

/** FINE : +/-64 cents aux butees, au cent (129 crans). */
export const FINE_CENTS = 64;
export const snapFine = (v: number): number => (Number.isFinite(v) ? Math.max(-FINE_CENTS, Math.min(FINE_CENTS, Math.round(v * FINE_CENTS))) / FINE_CENTS : 0);
export const fineCents = (v: number): number => Math.round(snapFine(v) * FINE_CENTS);
/** Son facteur de hauteur : exactement 1 a 0. */
export const fineFactor = (v: number): number => {
  const c = fineCents(v);
  return c === 0 ? 1 : Math.pow(2, c / 1200);
};

/* ---------------- le filtre (FLTR, 2026-10-09) ---------------- */

/** Les types du filtre : passe-bas, passe-haut, passe-bande (ftype 0, 0.5, 1). */
export const FILTER_TYPES = ['LP', 'HP', 'BP'] as const;
export type FilterType = (typeof FILTER_TYPES)[number];
export const filterIndex = (v: number): number => Math.max(0, Math.min(2, Math.round((Number.isFinite(v) ? v : 0) * 2)));
export const filterType = (v: number): FilterType => FILTER_TYPES[filterIndex(v)];
/** FREQ : 20 Hz a 20 kHz, en loi exponentielle (le milieu : 632 Hz). */
export const cutHz = (v: number): number => 20 * Math.pow(1000, Math.max(0, Math.min(1, v)));
/** RESO : le Q du filtre, 0.707 (aucune bosse) a environ 12. */
export const resoQ = (v: number): number => Math.SQRT1_2 * (1 + 16 * Math.pow(Math.max(0, Math.min(1, v)), 1.5));
/** ENV : la profondeur de l'enveloppe du filtre, +/-5 octaves de coupure au sommet. */
export const FENV_OCT = 5;
/** F.ATK : comme ATK ; F.DEC : la constante de temps de la descente, 10 ms a 1.6 s (le milieu : 126 ms). */
export const fatkS = atkS;
export const fdecTau = (v: number): number => 0.01 * Math.pow(160, Math.max(0, Math.min(1, v)));

/**
 * Le filtre d'un coup a-t-il quelque chose a faire ? Non au depart (passe-bas
 * ouvert ou passe-haut ferme, sans enveloppe) : aucun noeud, le son d'avant.
 */
export const filterOpen = (type: number, cut: number, env: number): boolean => {
  if (env !== 0) return false;
  const t = filterIndex(type);
  return (t === 0 && cut >= 0.999) || (t === 1 && cut <= 0.001);
};

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
  if (p === 'fine') return snapFine(v);
  if (p === 'ftype') return filterIndex(v) / 2;
  // ENV du filtre : -1 a 1, colle au centre comme PAN (un glisser y revient)
  if (p === 'fenv') return snapPan(v);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : p === 'decay' || p === 'fcut' ? 1 : p === 'fdec' ? 0.5 : 0;
};

const INSTS: readonly Inst[] = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'];

/**
 * Gardes dans le navigateur (2026-10-11, Mika : "j'ai tout perdu") : avant, les reglages des voix repartaient au
 * neutre a chaque rechargement ; relus au depart, chacun passe par clamp (un reglage absent : sa valeur neutre).
 */
const KEY = 'mm.v4.rytm.voices.1';
const SAVE_MS = 300;

function load(): Record<Inst, VoiceFx> {
  const out = Object.fromEntries(INSTS.map((i) => [i, { ...VOICE_FX_DEFAULT }])) as Record<Inst, VoiceFx>;
  if (typeof window === 'undefined') return out;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<Record<Inst, Partial<Record<VoiceParam, unknown>>>> | null;
    if (!raw || typeof raw !== 'object') return out;
    for (const i of INSTS) {
      const r = raw[i];
      if (!r || typeof r !== 'object') continue;
      for (const p of VOICE_PARAMS) {
        const v = r[p];
        if (typeof v === 'number' && Number.isFinite(v)) out[i][p] = clamp(p, v);
      }
    }
  } catch {
    /* rien de retenu */
  }
  return out;
}

let state: Readonly<Record<Inst, Readonly<VoiceFx>>> = load();
const listeners = new Set<() => void>();
let saveTimer = 0;

function changed(): void {
  listeners.forEach((l) => l());
  if (typeof window === 'undefined') return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      // Seulement ce qui quitte le neutre : le JSON reste court
      const keep: Partial<Record<Inst, Partial<VoiceFx>>> = {};
      for (const i of INSTS) {
        const d = VOICE_PARAMS.filter((p) => state[i][p] !== VOICE_FX_DEFAULT[p]);
        if (d.length) keep[i] = Object.fromEntries(d.map((p) => [p, state[i][p]]));
      }
      if (Object.keys(keep).length) window.localStorage.setItem(KEY, JSON.stringify(keep));
      else window.localStorage.removeItem(KEY);
    } catch {
      /* stockage plein ou bloque : les reglages vivent pour la visite */
    }
  }, SAVE_MS);
}

export const voiceFx = {
  get: (): Readonly<Record<Inst, Readonly<VoiceFx>>> => state,
  of: (inst: Inst): Readonly<VoiceFx> => state[inst],
  /** Un reglage d'une voix ; rien ne part si rien ne change. */
  set(inst: Inst, p: VoiceParam, v: number): void {
    const t = clamp(p, v);
    if (state[inst][p] === t) return;
    state = { ...state, [inst]: { ...state[inst], [p]: t } };
    changed();
  },
  /** La voix revient au neutre. */
  reset(inst: Inst): void {
    state = { ...state, [inst]: { ...VOICE_FX_DEFAULT } };
    changed();
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
