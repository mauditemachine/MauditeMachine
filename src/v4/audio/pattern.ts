/**
 * Motif du sequenceur (spec 10) : 16 pas x 10 voix (5 jusqu'au 2026-10-03), l'instrument
 * selectionne (celui du dernier pad frappe) et le tempo. Petit store
 * observable : React le lit par useSyncExternalStore, la scene par get().
 * Motif, tempo et, depuis la revision 2, les trois effets SWING, DIST et
 * REVERB (pattern.fx) persistent sous mm.v4.pattern ; l'instrument non (une
 * visite commence avec le BD), TONE et LEVEL non plus (une visite qui
 * commencerait muette serait un piege). Chaque lecture et chaque ecriture
 * du localStorage passent par try/catch : navigation privee, stockage
 * bloque ou plein, JSON corrompu, rien ne leve jamais.
 *
 * OH (2026-10-01) : le charley ouvert remplace la basse de la revision 4 ;
 * un motif enregistre sans lui (ou avec l'ancienne rangee BASS) recoit la
 * rangee OH par defaut, la rangee BASS est ignoree. Un appui long vide un
 * pas (toutes les voix).
 *
 * Velocites (2026-10-01) : chaque pas vaut 0 (vide), 1 (fort), 2 (moyen)
 * ou 3 (doux). Un appui sur un pas vide le pose fort ; chaque appui
 * suivant baisse d'un cran, puis le vide (0 1 2 3 0). L'ancien '1' (pose)
 * reste donc un pas fort.
 *
 * Neuf niveaux (2026-10-04, Mika : "des editions de pattern rythmique,
 * avec velocite") : chaque pas vaut 0 (vide) a 9 (le plus fort), dessines
 * dans l'editeur (ui/BeatEditor.tsx). Les trois crans d'avant deviennent
 * 9, 6 et 3, aux memes gains (le son d'un motif ne change pas) ; un appui
 * sur un pas fait toujours vide, fort, moyen, doux, vide. Un motif de la
 * cle '.2' est converti a la lecture (fromLevels3) ; les generateurs de
 * RANDOM pensent toujours en 1 2 3 et convertissent a la sortie.
 *
 * Les verrous (2026-10-08, l'etape R2, les parameter locks facon Elektron,
 * audio/locks.ts) : le motif porte aussi les verrous de ses pas (locks),
 * gardes sous la meme cle (un champ de plus, absent quand il n'y en a pas :
 * un vieux motif se lit sans verrou, la revision d'avant ignore le champ).
 * CLEAR les efface avec les pas ; un pas vide garde les siens ; RANDOM les
 * garde (replace 'keep') ; un pattern ou un preset pose les siens.
 */

import type { Inst } from '../theme';
import { anyLocks, cleanLocks, NO_LOCKS, withLock, withoutLock, type LockKey, type Locks } from './locks';
import { NO_SCENES, cleanScenes, clearScene, sameScenes, toStored, withScene, withoutScene, type SceneId, type SceneSet, type StoredScenes } from '../rytm/sceneData';

// Huit voix (2026-10-05), dans l'ordre des pads : BD SD CH OH en haut, CP TOM HT CY dessous
export const INSTRUMENTS: readonly Inst[] = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'];
export const STEP_COUNT = 16;
export const BPM = { min: 100, max: 150, initial: 130 } as const;
/**
 * Cle de stockage. 2026-10-01 : '.2' avec les velocites ; les motifs
 * enregistres avant sont laisses de cote une fois, pour que chacun recoive
 * le motif d'arrivee.
 */
export const STORAGE_KEY = 'mm.v4.pattern.3';
/** La cle d'avant les neuf niveaux (velocites 1 2 3), relue une fois et convertie. */
const LEGACY_KEY = 'mm.v4.pattern.2';
const SAVE_DEBOUNCE_MS = 300;
const STEPS_RE = /^[0-9]{16}$/;
const LEGACY_RE = /^[0-3]{16}$/;

/** Les trois crans d'avant (1 fort, 2 moyen, 3 doux) en niveaux : 9, 6, 3. */
export const fromLevels3 = (s: string): string => s.replace(/[12]/g, (c) => (c === '1' ? '9' : '6'));

export type Steps = Record<Inst, string>;

export interface Pattern {
  bpm: number;
  steps: Steps;
}

/**
 * SWING, DIST, REVERB (revision 2, spec 20.8), DELAY et CHORUS
 * (2026-10-01) : 0 a 1, 0 = neutre (le son de la revision 1). Les effets
 * de tout le pattern, persistes avec le motif ; un motif stocke sans
 * DELAY ni CHORUS les recoit a 0.
 */
export interface Fx {
  swing: number;
  drive: number;
  reverb: number;
  delay: number;
  chorus: number;
  /**
   * Le temps et la reinjection du DELAY (2026-10-09, les encodeurs G et H du
   * desktop, Mika : "ils ne servent qu'a faire les modifs des FX globaux de la
   * machine") : dtime choisit la division (DELAY_DIVS, la croche pointee au
   * depart), dfb la reinjection (0.58 au depart, DELAY_FB_MAX a fond) ; un
   * motif stocke sans eux les recoit a leur depart (le delay d'avant).
   */
  dtime: number;
  dfb: number;
  /** BIT et COMP (2026-10-10, les encodeurs G et H a la place de DLY TIME et DLY FB) : 0, rien ne change */
  bits: number;
  comp: number;
  /** Les reglages de chaque FX global (2026-10-10, FX_SETTINGS : leur page a l'ecran) */
  dtone: number;
  rsize: number;
  rtone: number;
  rpre: number;
  xtone: number;
  crate: number;
  cdepth: number;
  brate: number;
  catk: number;
  crel: number;
  /** Le COMP refait le 2026-10-18 (FX_SETTINGS) : seuil, rapport, genou, rattrapage, passe-haut de sa chaine laterale */
  cthr: number;
  cratio: number;
  cknee: number;
  cmake: number;
  chpf: number;
}

/**
 * Les reglages des FX globaux du MM-RYTM (2026-10-10, Mika : "quand je touche a un FX, par exemple DELAY, l'ecran
 * affiche les configurations de ce FX, pareil pour tous les autres") : 0 a 1, leur valeur de depart rend le son
 * d'avant (le delay filtre a 4.5 kHz, la reverbe de 2.4 s, son pre-delay de 20 ms, etc.). Leurs lois : fxLaw.
 */
/*
 * Le COMP refait le 2026-10-18 (Mika : "donne-moi le choix avec du ratio et threshold ! Fais un bon compresseur",
 * audio/glue.worklet.js) : COMP (pattern.fx.comp, l'encodeur H) est son MIX, 0 = le son tel quel ; ses reglages sont
 * ceux d'un compresseur de bus : THRESH (cthr, -18 dB au depart), RATIO (cratio, 4:1), ATTACK (catk, 10 ms ; 0.742),
 * RELEASE (crel, AUTO tout en haut : 1), KNEE (cknee, 6 dB), MAKEUP (cmake, AUTO tout en bas : 0), HPF de la chaine
 * laterale (chpf, 60 Hz). catk 0.918 et crel 0.546 du 2026-10-11 (30 et 150 ms affiches) sonnaient en fait 3 et 120 ms
 * (drums.ts FX_BEFORE) : depuis, chaque reglage du COMP suit sa loi, ce que l'ecran dit est ce qu'on entend.
 */
export const FX_SETTINGS = {
  dtone: 0.638,
  rsize: 0.566,
  rtone: 0.442,
  rpre: 0.167,
  xtone: 1,
  crate: 0.624,
  cdepth: 0.5,
  brate: 0,
  catk: 0.742,
  crel: 1,
  cthr: 0.45,
  cratio: 0.571,
  cknee: 0.5,
  cmake: 0,
  chpf: 0.5,
} as const;
/** Les crans du RATIO (2026-10-18) : 1:1 (rien), 1.5, 2, 3, 4 (le depart), 6, 10, 20 (presque un limiteur). */
export const COMP_RATIOS: readonly number[] = [1, 1.5, 2, 3, 4, 6, 10, 20];
/** Les crans du passe-haut de la chaine laterale (Hz ; 0 : aucun, le kick entier fait compresser). */
export const COMP_HPF: readonly number[] = [0, 60, 120];
/** RELEASE tout en haut (127) : AUTO, le retour suit la musique ; MAKEUP tout en bas (0) : AUTO, fixe, de la courbe. */
export const CREL_AUTO = 0.996;
export const CMAKE_AUTO = 0.004;
/**
 * Le niveau de programme que suppose MAKEUP AUTO (dB a l'entree du COMP, avant RYTM_TRIM : le motif de depart y crete
 * vers 0 dBFS pour un RMS de -14.7 dBFS ; son detecteur lit les coups vers -12.5) et la douceur de son genou (dB).
 */
const MAKEUP_REF_DB = -12.5;
const MAKEUP_SOFT_DB = 3.6;
/** Le rattrapage AUTO le plus fort (dB), celui de MAKEUP a la main. */
export const CMAKE_MAX_DB = 18;
export type FxSettingId = keyof typeof FX_SETTINGS;
export const FX_SETTING_IDS = Object.keys(FX_SETTINGS) as FxSettingId[];
export const isFxSetting = (id: string): id is FxSettingId => Object.prototype.hasOwnProperty.call(FX_SETTINGS, id);
const lawClamp = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
/** Les lois des reglages (la meme source pour le son et l'ecran) : Hz, secondes, un facteur, un diviseur. */
export const fxLaw = {
  /** DELAY TONE : le passe-bas des echos, 800 Hz a 12 kHz */
  dtone: (v: number): number => 800 * Math.pow(15, lawClamp(v)),
  /** REVERB SIZE : la duree de la queue (RT60), 0.5 a 8 s */
  rsize: (v: number): number => 0.5 * Math.pow(16, lawClamp(v)),
  /** REVERB TONE : les aigus de la queue (ou elle s'assombrit), 1 a 12 kHz */
  rtone: (v: number): number => 1000 * Math.pow(12, lawClamp(v)),
  /** REVERB PRE : le pre-delay, 0 a 120 ms */
  rpre: (v: number): number => 0.12 * lawClamp(v),
  /** DIST TONE : le passe-bas apres la saturation, 1 a 16 kHz (16 kHz : ouvert) */
  xtone: (v: number): number => 1000 * Math.pow(16, lawClamp(v)),
  /** CHORUS RATE : la vitesse des LFO, x0.1 a x4 de celle d'avant */
  crate: (v: number): number => 0.1 * Math.pow(40, lawClamp(v)),
  /** CHORUS DEPTH : la profondeur des LFO, 0 a 14 ms (7 ms : celle d'avant) */
  cdepth: (v: number): number => 0.014 * lawClamp(v),
  /** BIT RATE : l'echantillonnage divise par 1 a 16 */
  brate: (v: number): number => 1 + Math.round(lawClamp(v) * 15),
  /** COMP ATTACK : 0.1 a 50 ms (10 ms au depart) */
  catk: (v: number): number => 0.0001 * Math.pow(500, lawClamp(v)),
  /** COMP RELEASE : 20 ms a 0.78 s ; tout en haut AUTO (compRelAuto) */
  crel: (v: number): number => 0.02 * Math.pow(40, lawClamp(v)),
  /** COMP THRESH : 0 a -40 dB (-18 au depart) */
  cthr: (v: number): number => -40 * lawClamp(v),
  /** COMP RATIO : ses huit crans (COMP_RATIOS, 4:1 au depart) */
  cratio: (v: number): number => COMP_RATIOS[Math.round(lawClamp(v) * (COMP_RATIOS.length - 1))],
  /** COMP KNEE : 0 (genou dur) a 12 dB (6 au depart) */
  cknee: (v: number): number => 12 * lawClamp(v),
  /** COMP MAKEUP a la main : -6 a +18 dB (tout en bas : AUTO, compMakeAuto) */
  cmake: (v: number): number => -6 + 24 * lawClamp(v),
  /** COMP HPF : le passe-haut de la chaine laterale, OFF, 60 Hz (le depart) ou 120 Hz */
  chpf: (v: number): number => COMP_HPF[Math.round(lawClamp(v) * (COMP_HPF.length - 1))],
} as const satisfies Record<FxSettingId, (v: number) => number>;

/** Les crans d'un reglage de FX (0 : continu) : RATIO et HPF du COMP. */
export const FX_NOTCHES: Readonly<Partial<Record<FxSettingId, number>>> = { cratio: COMP_RATIOS.length, chpf: COMP_HPF.length };
/** Un reglage de FX pose sur son cran le plus proche (les autres tels quels). */
export function fxSnap(id: FxSettingId, v: number): number {
  const n = FX_NOTCHES[id];
  return n ? Math.round(lawClamp(v) * (n - 1)) / (n - 1) : v;
}
/** RELEASE sur AUTO (tout en haut) ; MAKEUP sur AUTO (tout en bas). */
export const compRelAuto = (v: number): boolean => lawClamp(v) >= CREL_AUTO;
export const compMakeAuto = (v: number): boolean => lawClamp(v) <= CMAKE_AUTO;
/**
 * MAKEUP AUTO (2026-10-18) : un gain fixe, de la courbe seule (seuil et rapport), jamais une moyenne qui suit le
 * motif (celui du 2026-10-11 respirait) : la reduction d'un programme de niveau MAKEUP_REF_DB, le genou adouci de
 * MAKEUP_SOFT_DB (un programme n'est pas un sinus). Mesure hors ligne : le motif de depart garde son RMS a 0.3 dB pres de
 * -6 a -30 dB et de 1.5:1 a 20:1 (plus bas, la borne de +18 dB laisse le son un peu sous le sec) ; un motif plus fort
 * sort un peu plus bas, un plus doux un peu plus haut (6 dB plus doux, a -30 dB et 20:1 : jusqu'a +5.8 dB).
 */
export function compAutoMakeup(thrDb: number, ratio: number): number {
  const slope = 1 - 1 / Math.max(1, ratio);
  const x = (MAKEUP_REF_DB - thrDb) / MAKEUP_SOFT_DB;
  const over = MAKEUP_SOFT_DB * (x > 30 ? x : Math.log1p(Math.exp(x)));
  return Math.min(CMAKE_MAX_DB, slope * over);
}
/** Le rattrapage (dB) de ces reglages : AUTO (de la courbe) ou celui de la main. */
export function compMakeup(f: Readonly<Pick<Fx, 'cthr' | 'cratio' | 'cmake'>>): number {
  return compMakeAuto(f.cmake) ? compAutoMakeup(fxLaw.cthr(f.cthr), fxLaw.cratio(f.cratio)) : fxLaw.cmake(f.cmake);
}

/**
 * Un COMP d'avant le 2026-10-18 (aucun reglage cthr : un seul potard, son seuil -6 a -24 dB et son rapport 1.5 a 4
 * ensemble, tout compresse, genou de 8 dB) : son seuil, le cran de RATIO le plus proche, son genou, MAKEUP AUTO, et COMP
 * (le MIX) a 100 % ; son ATTACK et son RELEASE restent les siens. Un motif, un preset, un son mis de cote ou un pas
 * d'UNDO gardes avant gardent ainsi leur caractere ; COMP a 0 (ou un etat d'aujourd'hui) : rien a traduire.
 */
export function compLegacy(raw: unknown): Partial<Fx> {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  if (o.cthr !== undefined) return {};
  const a = o.comp;
  if (typeof a !== 'number' || !Number.isFinite(a) || a <= 0 || a > 1) return {};
  const thr = -6 - 18 * Math.sqrt(a);
  const ratio = 1.5 + 2.5 * a;
  let best = 0;
  COMP_RATIOS.forEach((r, i) => {
    if (Math.abs(Math.log(r / ratio)) < Math.abs(Math.log(COMP_RATIOS[best] / ratio))) best = i;
  });
  return { comp: 1, cthr: r3(thr / -40), cratio: r3(best / (COMP_RATIOS.length - 1)), cknee: r3(8 / 12), cmake: 0 };
}

/** Les divisions du DELAY, en doubles croches (pas) : 1/16, 1/8, 1/8 pointee (le depart), 1/4, 1/4 pointee, 1/2. */
export const DELAY_DIVS: readonly { steps: number; label: string }[] = [
  { steps: 1, label: '1/16' },
  { steps: 2, label: '1/8' },
  { steps: 3, label: '1/8D' },
  { steps: 4, label: '1/4' },
  { steps: 6, label: '1/4D' },
  { steps: 8, label: '1/2' },
];
/** La division d'une valeur dtime (0 a 1, un cran par division). */
export const delayDiv = (v: number): (typeof DELAY_DIVS)[number] => DELAY_DIVS[Math.max(0, Math.min(DELAY_DIVS.length - 1, Math.round((Number.isFinite(v) ? v : 0) * (DELAY_DIVS.length - 1))))];
/** La reinjection du DELAY a fond ; au depart 2/3 de la course : 0.58, celle d'avant. */
export const DELAY_FB_MAX = 0.87;
export const delayFb = (v: number): number => DELAY_FB_MAX * Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
export const DTIME_DEFAULT = 2 / (DELAY_DIVS.length - 1);
export const DFB_DEFAULT = 2 / 3;

export const NEUTRAL_FX: Readonly<Fx> = { swing: 0, drive: 0, reverb: 0, delay: 0, chorus: 0, dtime: DTIME_DEFAULT, dfb: DFB_DEFAULT, bits: 0, comp: 0, ...FX_SETTINGS };
const FX_KEYS: readonly (keyof Fx)[] = ['swing', 'drive', 'reverb', 'delay', 'chorus', 'dtime', 'dfb', 'bits', 'comp', ...FX_SETTING_IDS];

/**
 * Forme stockee (et celle de window.__v4.state.pattern). fx vient de la
 * revision 2 : un motif stocke sans lui (ou un fx invalide) repart neutre,
 * et la revision 1 ignore ce champ (tout le reste de l'objet l'est).
 */
export interface StoredPattern {
  v: 1;
  bpm: number;
  steps: Steps;
  fx: Fx;
  /** les verrous des pas (2026-10-08, audio/locks.ts) ; absent sans verrou */
  locks?: Locks;
  /** les scenes A et B du motif (2026-10-27, rytm/sceneData.ts) ; absentes sans scene (le JSON d'avant, octet pour octet) */
  scenes?: StoredScenes;
}

export interface PatternState extends Pattern {
  instrument: Inst | null;
  /** les verrous des pas (2026-10-08, audio/locks.ts) : {} sans verrou */
  locks: Readonly<Locks>;
}

/**
 * Le motif d'arrivee (2026-10-01), techno a 130 BPM, charge
 * mais muet tant qu'on n'appuie pas sur RUN : grosse caisse four to the
 * floor, clap sur 2 et 4, charley ferme en doubles croches avec des
 * velocites (moyen sur le temps, doux sur le "e", fort juste avant le
 * temps suivant : le roulement), charley ouvert fort sur les contretemps
 * (le ferme suivant le coupe, comme une 808), tom syncope qui monte (doux
 * sur 7, moyen sur 12, fort sur 15). Index 0 = pas 1 ; 9 fort, 6 moyen,
 * 3 doux.
 */
export const DEFAULT_STEPS: Readonly<Steps> = {
  BD: '9000900090009000',
  SD: '0000900000009000',
  TOM: '0000003000060090',
  CH: '6309630963096309',
  OH: '0090009000900090',
  // Les voix du 2026-10-03 arrivent vides : le motif d'arrivee ne change pas
  CP: '0000000000000000',
  HT: '0000000000000000',
  CY: '0000000000000000',
};

/** Velocite du pas i de inst : 0 (vide) a 9 (le plus fort). */
export const velocity = (steps: Steps, inst: Inst, i: number): number => {
  const c = steps[inst].charCodeAt(i) - 48;
  return c >= 0 && c <= 9 ? c : 0;
};

/** Le niveau le plus fort. */
export const VEL_MAX = 9;

/** Pas i joue par inst. */
export const isOn = (steps: Steps, inst: Inst, i: number): boolean => velocity(steps, inst, i) > 0;

/** Gain de chaque niveau (0 : rien) ; 9, 6 et 3 gardent ceux des crans d'avant (1, 0.6, 0.32). */
// 2026-10-10 (Mika : "on entend trop le kick et rien pour le reste") : la courbe adoucie, LOW -8 dB (avant -10), MID -3.1 dB (avant -4.4)
export const VEL_GAIN: readonly number[] = [0, 0.16, 0.26, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
/** Noms de l'ecran : STEP 05 CH MID, STEP 06 CH VEL 7. */
export const VEL_NAMES: readonly string[] = ['OFF', 'VEL 1', 'VEL 2', 'LOW', 'VEL 4', 'VEL 5', 'MID', 'VEL 7', 'VEL 8', 'HIGH'];
/** Traits de velocite au-dessus d'un pas (2026-10-01) : vide 0, doux 1 (1 a 3), moyen 2 (4 a 6), fort 3 (7 a 9). */
export const VEL_BARS: readonly number[] = [0, 1, 1, 1, 2, 2, 2, 3, 3, 3];

/**
 * Les effets de l'arrivee : un soupcon de SWING (55 %) pour que les
 * doubles croches roulent, DIST et REVERB neutres. Un motif stocke garde
 * les siens.
 */
export const DEFAULT_FX: Readonly<Fx> = { swing: 0.3, drive: 0, reverb: 0, delay: 0, chorus: 0, dtime: DTIME_DEFAULT, dfb: DFB_DEFAULT, bits: 0, comp: 0, ...FX_SETTINGS };

export const defaultPattern = (): Pattern => ({ bpm: BPM.initial, steps: { ...DEFAULT_STEPS } });

/* ---------------- fonctions pures ---------------- */

export const clampBpm = (bpm: number): number =>
  Math.min(BPM.max, Math.max(BPM.min, Math.round(Number.isFinite(bpm) ? bpm : BPM.initial)));

/** Valide champ par champ ; tout ce qui manque ou cloche reprend la valeur par defaut. legacy : un motif de la cle '.2' (1 2 3). */
export function validate(raw: unknown, legacy = false): Pattern {
  const out = defaultPattern();
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as { v?: unknown; bpm?: unknown; steps?: unknown };
  if (o.v !== 1) return out;
  if (typeof o.bpm === 'number' && Number.isInteger(o.bpm) && o.bpm >= BPM.min && o.bpm <= BPM.max) out.bpm = o.bpm;
  if (o.steps && typeof o.steps === 'object') {
    const steps = o.steps as Record<string, unknown>;
    for (const inst of INSTRUMENTS) {
      const s = steps[inst];
      if (typeof s !== 'string') continue;
      if (legacy) {
        if (LEGACY_RE.test(s)) out.steps[inst] = fromLevels3(s);
      } else if (STEPS_RE.test(s)) out.steps[inst] = s;
    }
  }
  return out;
}

/** Un reglage d'effet : 0 a 1 ; NaN et l'infini valent 0. */
export const clampFx = (v: number): number => (Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0);

/** Les effets d'un objet stocke : chaque valeur hors de 0..1 (ou absente) reste neutre. */
export function validateFx(raw: unknown): Fx {
  // Rien de stocke : les effets de l'arrivee (un soupcon de swing)
  const out = { ...DEFAULT_FX };
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as { v?: unknown; fx?: unknown };
  if (o.v !== 1 || !o.fx || typeof o.fx !== 'object') return out;
  const f = o.fx as Record<string, unknown>;
  for (const k of FX_KEYS) {
    const v = f[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) out[k] = v;
  }
  // Un COMP d'avant le 2026-10-18 : ses reglages d'aujourd'hui (compLegacy)
  return { ...out, ...compLegacy(f) };
}

/** Le motif stocke ; legacy : celui de la cle '.2' (avant les neuf niveaux), a convertir. */
function readStored(): { raw: unknown; legacy: boolean } {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (text) return { raw: JSON.parse(text), legacy: false };
    const old = window.localStorage.getItem(LEGACY_KEY);
    return { raw: old ? JSON.parse(old) : null, legacy: old !== null };
  } catch {
    return { raw: null, legacy: false };
  }
}

export function load(): Pattern {
  const st = readStored();
  return validate(st.raw, st.legacy);
}

/** Au millieme : le JSON reste court, un glisser donne des valeurs continues. */
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

export function serialize(p: Pattern, f: Readonly<Fx> = NEUTRAL_FX, locks: Readonly<Locks> = NO_LOCKS, scenes: SceneSet = NO_SCENES): StoredPattern {
  const out: StoredPattern = {
    v: 1,
    // Au BPM entier (2026-10-27) : un tempo suivi au centieme (followBpm) se retient arrondi, validate le relit
    bpm: clampBpm(p.bpm),
    steps: { ...p.steps },
    fx: { swing: r3(f.swing), drive: r3(f.drive), reverb: r3(f.reverb), delay: r3(f.delay), chorus: r3(f.chorus), dtime: r3(f.dtime ?? DTIME_DEFAULT), dfb: r3(f.dfb ?? DFB_DEFAULT), bits: r3(f.bits ?? 0), comp: r3(f.comp ?? 0), ...(Object.fromEntries(FX_SETTING_IDS.map((k) => [k, r3(f[k] ?? FX_SETTINGS[k])])) as Record<FxSettingId, number>) },
  };
  if (anyLocks(locks)) out.locks = locks as Locks;
  const sc = toStored(scenes);
  if (sc) out.scenes = sc;
  return out;
}

/** Les scenes d'un motif stocke ; NO_SCENES sans elles, ou illisibles. */
export function validateScenes(raw: unknown): SceneSet {
  if (!raw || typeof raw !== 'object') return NO_SCENES;
  return cleanScenes((raw as { scenes?: unknown }).scenes) ?? NO_SCENES;
}

/** Les verrous d'un motif stocke (la cle d'avant les neuf niveaux n'en a pas) ; {} sans verrou. */
export function validateLocks(raw: unknown): Readonly<Locks> {
  if (!raw || typeof raw !== 'object') return NO_LOCKS;
  return cleanLocks((raw as { locks?: unknown }).locks) ?? NO_LOCKS;
}

/** true si l'ecriture a reussi. */
export function save(p: Pattern, f: Readonly<Fx> = NEUTRAL_FX, locks: Readonly<Locks> = NO_LOCKS, scenes: SceneSet = NO_SCENES): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(p, f, locks, scenes)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Nouveau motif avec le pas i de inst au cran suivant (mise a jour
 * immuable) : vide, fort (9), moyen (6), doux (3), vide ; un niveau
 * dessine passe au cran en dessous.
 */
export function toggleStep(p: Pattern, inst: Inst, i: number): Pattern {
  if (!Number.isInteger(i) || i < 0 || i >= STEP_COUNT) return p;
  const s = p.steps[inst];
  const v = velocity(p.steps, inst, i);
  const next = String(v === 0 ? 9 : v > 6 ? 6 : v > 3 ? 3 : 0);
  return { ...p, steps: { ...p.steps, [inst]: s.slice(0, i) + next + s.slice(i + 1) } };
}

/** Le pas i de inst a un niveau (0 a 9 ; 0 : vide). */
export function setStep(p: Pattern, inst: Inst, i: number, v: number): Pattern {
  if (!Number.isInteger(i) || i < 0 || i >= STEP_COUNT) return p;
  const c = String(Math.max(0, Math.min(VEL_MAX, Math.round(v))));
  const s = p.steps[inst];
  if (s[i] === c) return p;
  return { ...p, steps: { ...p.steps, [inst]: s.slice(0, i) + c + s.slice(i + 1) } };
}

/** Le pas i de inst vide (appui long) ; le meme motif s'il l'etait deja. */
export function clearStep(p: Pattern, inst: Inst, i: number): Pattern {
  if (!Number.isInteger(i) || i < 0 || i >= STEP_COUNT) return p;
  const s = p.steps[inst];
  if (s[i] === '0') return p;
  return { ...p, steps: { ...p.steps, [inst]: s.slice(0, i) + '0' + s.slice(i + 1) } };
}

export function clearSteps(p: Pattern): Pattern {
  const empty = '0'.repeat(STEP_COUNT);
  return { ...p, steps: Object.fromEntries(INSTRUMENTS.map((k) => [k, empty])) as Steps };
}

/* ---------------- le store ---------------- */

const stored = typeof window === 'undefined' ? { raw: null, legacy: false } : readStored();
// Depuis le 2026-10-05 (Mika : "par defaut je veux toujours que le BD soit selectionne pour les FX Voices") : la grosse caisse
let state: PatternState = { ...validate(stored.raw, stored.legacy), instrument: 'BD', locks: stored.legacy ? NO_LOCKS : validateLocks(stored.raw) };
let fxState: Readonly<Fx> = validateFx(stored.raw);
let scenesState: SceneSet = stored.legacy ? NO_SCENES : validateScenes(stored.raw);
const listeners = new Set<() => void>();
const fxListeners = new Set<() => void>();
const sceneListeners = new Set<(at?: number) => void>();
let saveTimer = 0;

const emit = (): void => listeners.forEach((l) => l());

function scheduleSave(): void {
  if (saveTimer !== 0) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    save(state, fxState, state.locks, scenesState);
  }, SAVE_DEBOUNCE_MS);
}

/** Ecrit tout de suite une sauvegarde en attente (pagehide, demontage). */
function flush(): void {
  if (saveTimer === 0) return;
  window.clearTimeout(saveTimer);
  saveTimer = 0;
  save(state, fxState, state.locks, scenesState);
}

function commit(next: PatternState, persist: boolean): void {
  state = next;
  if (persist) scheduleSave();
  emit();
}

/**
 * Les effets : leurs propres ecouteurs (l'audio, les encodeurs, leurs
 * jumeaux), pas ceux du motif. Un encodeur tourne a la cadence du pointeur
 * sans rerendre le Dock, les LED ni la racine ; la sauvegarde est la meme
 * (300 ms apres le dernier changement).
 */
const fxStore = {
  get: (): Readonly<Fx> => fxState,
  /** Un ou plusieurs reglages, bornes a 0..1 ; rien ne part si rien ne change. */
  set(patch: Partial<Fx>): void {
    let next: Fx | null = null;
    for (const k of FX_KEYS) {
      const v = patch[k];
      if (v === undefined) continue;
      const c = clampFx(v);
      if (c === fxState[k]) continue;
      if (!next) next = { ...fxState };
      next[k] = c;
    }
    if (!next) return;
    fxState = next;
    scheduleSave();
    fxListeners.forEach((l) => l());
  },
  subscribe(fn: () => void): () => void {
    fxListeners.add(fn);
    return () => {
      fxListeners.delete(fn);
    };
  },
};

/**
 * Les scenes A et B du motif (2026-10-27, la phase 2) : un troisieme sous-store, a cote de fx, avec SES ecouteurs. Une
 * valeur de scene ecrite ne previent jamais pattern.subscribe (ni l'horloge, ni le Dock, ni les pas, ni la couche de
 * saisie) ; la sauvegarde est la meme (300 ms apres le dernier changement). at (replace) : l'heure audio de la mesure ou
 * elles arrivent (un changement de pattern a la mesure), absente : tout de suite.
 */
const scenesStore = {
  get: (): SceneSet => scenesState,
  /** Une valeur de 0 a 1 dans une scene : 'same' rien ne change, 'full' la scene a deja ses 64 valeurs. */
  write(w: SceneId, id: string, v01: number): 'ok' | 'same' | 'full' {
    const next = withScene(scenesState, w, id, v01);
    if (next === 'full') return 'full';
    if (next === scenesState) return 'same';
    scenesState = next;
    scheduleSave();
    sceneListeners.forEach((l) => l());
    return 'ok';
  },
  /** Une valeur retiree (deux tapes sur un potard, scene armee). */
  drop(w: SceneId, id: string): void {
    const next = withoutScene(scenesState, w, id);
    if (next === scenesState) return;
    scenesState = next;
    scheduleSave();
    sceneListeners.forEach((l) => l());
  },
  /** SCENE + CLEAR : la scene videe. */
  clear(w: SceneId): void {
    const next = clearScene(scenesState, w);
    if (next === scenesState) return;
    scenesState = next;
    scheduleSave();
    sceneListeners.forEach((l) => l());
  },
  /** Les scenes d'un autre pattern, d'un preset, de l'UNDO ; at : l'heure audio de la mesure (le changement a la mesure). */
  replace(next: SceneSet, at?: number): void {
    const n = sameScenes(next, NO_SCENES) ? NO_SCENES : next;
    if (n === scenesState || sameScenes(n, scenesState)) return;
    scenesState = n;
    scheduleSave();
    sceneListeners.forEach((l) => l(at));
  },
  subscribe(fn: (at?: number) => void): () => void {
    sceneListeners.add(fn);
    return () => {
      sceneListeners.delete(fn);
    };
  },
};

export const pattern = {
  get: (): PatternState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Le dernier pad frappe ; null = aucune selection. */
  select(inst: Inst | null): void {
    if (state.instrument === inst) return;
    commit({ ...state, instrument: inst }, false);
  },
  toggle(inst: Inst, i: number): void {
    const next = toggleStep(state, inst, i);
    if (next !== state) commit({ ...next, instrument: state.instrument, locks: state.locks }, true);
  },
  /** L'editeur (ui/BeatEditor.tsx) : un pas a un niveau, 0 a 9. */
  set(inst: Inst, i: number, v: number): void {
    const next = setStep(state, inst, i, v);
    if (next !== state) commit({ ...next, instrument: state.instrument, locks: state.locks }, true);
  },
  /** Appui long : le pas vide. */
  clearStep(inst: Inst, i: number): void {
    const next = clearStep(state, inst, i);
    if (next !== state) commit({ ...next, instrument: state.instrument, locks: state.locks }, true);
  },
  /** CLEAR : les pas et leurs verrous, toutes les voix. */
  clear(): void {
    commit({ ...clearSteps(state), instrument: state.instrument, locks: NO_LOCKS }, true);
  },
  /**
   * Un motif entier ; les rangees invalides gardent les leurs. locks : ceux
   * du motif pose (un pattern, un preset : les siens, ou aucun), 'keep'
   * (RANDOM) : ceux d'avant restent.
   */
  replace(steps: Steps, locks: Readonly<Locks> | 'keep' = 'keep'): void {
    const next = { ...state.steps };
    for (const inst of INSTRUMENTS) if (STEPS_RE.test(steps[inst])) next[inst] = steps[inst];
    commit({ ...state, steps: next, locks: locks === 'keep' ? state.locks : (cleanLocks(locks) ?? NO_LOCKS) }, true);
  },
  /** Un verrou sur des pas d'une voix (2026-10-08, audio/locks.ts) : la valeur du domaine, ou le son (snd). */
  setLock(inst: Inst, steps: readonly number[], key: LockKey, v: number | string): void {
    const locks = withLock(state.locks, inst, steps, key, v);
    if (JSON.stringify(locks[inst]) === JSON.stringify(state.locks[inst])) return;
    commit({ ...state, locks }, true);
  },
  /** Un verrou retire de ces pas ; key absent : tous ceux de ces pas. */
  clearLock(inst: Inst, steps: readonly number[], key?: LockKey): void {
    const locks = withoutLock(state.locks, inst, steps, key);
    if (locks !== state.locks) commit({ ...state, locks }, true);
  },
  setBpm(bpm: number): void {
    const b = clampBpm(bpm);
    if (b !== state.bpm) commit({ ...state, bpm: b }, true);
  },
  /**
   * Le tempo suivi (2026-10-27, le SYNC du MIXER : le MM-RYTM suit la platine MASTER, dj/actions.ts) : au centieme de
   * BPM, dans BPM.min..BPM.max, sans etre retenu a chaque changement ; keep (la fin du suivi) : retenu. Il se retient au
   * BPM entier (serialize) : le TEMPO du potard et du stockage reste entier.
   */
  followBpm(bpm: number, keep = false): void {
    if (!Number.isFinite(bpm)) return;
    const b = Math.min(BPM.max, Math.max(BPM.min, Math.round(bpm * 100) / 100));
    if (b !== state.bpm) commit({ ...state, bpm: b }, keep);
    else if (keep) scheduleSave();
  },
  serialize: (): StoredPattern => serialize(state, fxState, state.locks, scenesState),
  flush,
  /** SWING, DIST, REVERB, DELAY, CHORUS (0 a 1) : get, set(patch), subscribe. */
  fx: fxStore,
  /** Les scenes A et B (2026-10-27) : get, write, drop, clear, replace(next, at), subscribe. */
  scenes: scenesStore,
};

if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
