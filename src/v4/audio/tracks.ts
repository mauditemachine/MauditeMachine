/**
 * Les 16 pistes libres du MM-RYTM : le CONTRAT (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 4.1 a 4.5, et
 * docs/v4/dt2/inv/inv-mm-model.md 3 et 4). Des types, des constantes figees et des signatures, sans comportement :
 * personne ne l'importe en P0 (le build ne l'embarque meme pas), le son ne change pas. La lane B1 (V.5.9 puis V.6.0)
 * ecrit les corps (le store, kit16FromLegacy, les facades), sans changer un nom ni un ordre d'ici.
 *
 * Une piste = un index 0..15 et sa CLE de stockage, de MIDI, de scene et de lien : BD..CY restent les cles des pistes 1
 * a 8 (des noms de piste, plus des sons : la piste 1 garde la cle BD meme avec une caisse claire), T9..T16 s'ajoutent.
 * Inst (theme.ts) reste le type des 8 cles d'heritage et des tables a 8 ; TrackKey est un type nouveau, adopte usage par
 * usage.
 *
 * V.5.9 (2026-10-30, la lane B1 et la lecture de B2, cahier 5.1 et 6 : le moteur a 16 pistes, invisible) : les corps.
 * - kit16FromLegacy, et le store `tracks` (le kit global, cle TRACKS_KEY) : la seule source des sons des 16 pistes ;
 *   audio/kit.ts et audio/voicefx.ts en sont les facades (toute leur API d'aujourd'hui, sur les pistes 1 a 8).
 * - Au chargement : le kit et les voix d'avant (mm.v4.kit.1, mm.v4.rytm.voices.1) se lisent comme avant puis passent par
 *   kit16FromLegacy ; TRACKS_KEY, s'il existe et si les vieilles cles n'ont pas bouge depuis son ecriture (son empreinte
 *   lg), donne tout ; si une version d'avant a re-ecrit les vieilles cles (un retour arriere puis un retour), les pistes
 *   1 a 8 viennent d'elles et les pistes 9 a 16 et le mix de TRACKS_KEY. Rien n'est ecrit au chargement (le stockage
 *   d'une visiteuse reste octet pour octet celui de V.5.3 tant que rien ne change).
 * - La double ecriture : a chaque changement, TRACKS_KEY (des diffs) ET les vieilles cles (les pistes 1 a 8, au meme
 *   format qu'avant, seulement le domaine qui a change) : un retour arriere vers V.5.3 retrouve son son.
 * - Les potards de la machine d'avant (globaux) restent globaux par la facade : un potard tourne ecrit les pistes 1 a 8
 *   (la loi de V.5.3) ; set() sur une piste n'ecrit qu'elle (V.6.0).
 */

import type { Kit, KitBase, KitFamily, KitKnob, KitModel, KitOverride, Layer, LayerParam, Plays, ShotTweak } from './kitlaw';
import { KIT_FAMILIES, KIT_KEY, KIT_KNOBS, KIT_MODELS, KIT_V, KNOB_DEFAULT, LAYER_DEFAULT, LAYER_PARAMS, choiceKeyOf, clampLayer, defaultKit, isModel, kickOf, parseKit, playsOf, q, resolveSample, sigOf, tweakOf, viewWith } from './kitlaw';
import type { KitLockId, LayerLockId } from './locks';
import type { LfoKey, LfoParam } from './lfo';
import { LFO_PARAMS, clampLfo, lfoDefault } from './lfo';
import type { TrigParam } from './trig';
import type { VoiceFx, VoiceParam } from './voicelaw';
import { VOICES_KEY, VOICE_FX_DEFAULT, VOICE_PARAMS, parseVoices, voiceClamp, voiceGain, voicesOut } from './voicelaw';
import { sampleByKey, samplesChanged } from './samples';
import type { Inst } from '../theme';

/* ---------------- les pistes ---------------- */

export const TRACK_COUNT = 16;
/** Les cles des 16 pistes, ordre FIGE (le rang est l'index de la piste). */
export const TRACK_KEYS = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16'] as const;
export type TrackKey = (typeof TRACK_KEYS)[number];
/** Les 8 cles d'heritage (l'ancien Inst) : les vieilles donnees, le telephone tant qu'il reste a 8. */
export const LEGACY_KEYS: readonly TrackKey[] = TRACK_KEYS.slice(0, 8);
/** Le nom affiche d'une piste (ecran, libelles MIDI) : T1 a T16, suivi du nom du son ("T1 BLUEPRINT"). */
export const TRACK_NAMES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16'] as const;
export const trackIndex = (k: TrackKey): number => TRACK_KEYS.indexOf(k);

/**
 * Une cle lue (BD..CY, T9..T16, et les alias T1..T8 de BD..CY ; casse libre) ; null si inconnue. Acceptee a la lecture
 * partout (MIDI appris, scenes, verrous, liens v2), jamais ecrite : on ecrit toujours TRACK_KEYS.
 */
export function normTrackKey(k: unknown): TrackKey | null {
  if (typeof k !== 'string') return null;
  const u = k.trim().toUpperCase();
  if ((TRACK_KEYS as readonly string[]).includes(u)) return u as TrackKey;
  const m = /^T([1-8])$/.exec(u);
  return m ? TRACK_KEYS[Number(m[1]) - 1] : null;
}

/* ---------------- les moteurs et les machines ---------------- */

/** Les 9 algorithmes de shotsdsp.ts, inchanges (ShotId cesse d'etre Inst : il devient EngineId). */
export type EngineId = 'BD' | 'SD' | 'CH' | 'CHopen' | 'OH' | 'CP' | 'TOM' | 'HT' | 'CY';

/** La machine SRC (le menu MACHINE, FUNC + SRC), ordre FIGE : son rang entre dans le lien SHARE v2. */
export const SRC_MACHINES = ['oneshot', 'bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'] as const;
export type SrcMachine = (typeof SRC_MACHINES)[number];
export const SRC_MACHINE_LABEL: Readonly<Record<SrcMachine, string>> = {
  oneshot: 'ONESHOT',
  bd: 'KICK',
  sd: 'SNARE',
  ch: 'CL HAT',
  oh: 'OP HAT',
  cp: 'CLAP',
  tom: 'LO TOM',
  ht: 'HI TOM',
  cy: 'CYMBAL',
};
/** Une machine de synthese est une famille du kit d'aujourd'hui (le moteur, et la categorie du pool de samples). */
export type SynthMachine = Exclude<SrcMachine, 'oneshot'> & KitFamily;
/** La machine FLTR (V.6.1) ; 'legacy' = le filtre d'aujourd'hui (LP HP BP par biquad). */
export type FltrMachine = 'legacy' | 'multi' | 'lp4' | 'eq';

/* ---------------- les reglages : l'espace des verrous ---------------- */

/**
 * Les ids de reglages reserves en P0 (cahier 4.1), noms FIGES, ajoutes A LA FIN des listes quand leur version arrive
 * (LOCK_IDS, LFO_PARAMS, TRIG_PARAMS : les indices stockes restent justes). Un reglage a UN id : le son de la piste, le
 * P-LOCK, la cible MIDI rytm:voice:<K>:<id>, la scene, CONTROL ALL et le lien v2.
 */
export const RESERVED_PARAM_IDS = {
  /** V.6.0 : TRK LEV (potard LEVEL/DATA, pages INTERNAL MIXER, non verrouillable, dans le kit, 0.8 = 0 dB) */
  v60: ['tlev'],
  /** V.6.1 : AMP, FLTR 1 et 2, FX, SRC ONESHOT, LFO 3 */
  v61: ['sus', 'rel', 'amode', 'arst', 'fsus', 'frel', 'fdel', 'fkey', 'frst', 'fbase', 'fwid', 'bwrt', 'br', 'srr', 'srrt', 'odrt', 'chr', 'splay', 'sloop', 'l3spd', 'l3mul', 'l3fad', 'l3dst', 'l3wav', 'l3phs', 'l3mod', 'l3dep'],
  /** V.6.1 : les reglages de trig neufs (par pattern, pas dans le son) */
  trig61: ['fltt', 'ptim', 'port', 'vel', 'fill'],
  /** V.6.2 : la chaine de verrou du preset lock (le rang dans le pool) */
  lock62: ['prs'],
} as const;
export type ReservedParamId = (typeof RESERVED_PARAM_IDS)[keyof typeof RESERVED_PARAM_IDS][number];
/** Le LFO 3 (V.6.1) : l3<cle>, les memes cles que l1 et l2. */
export type Lfo3Param = `l3${LfoKey}`;
/** Les reglages neufs d'une piste (V.6.0, V.6.1), hors reglages de trig et chaines de verrou. */
export type NewParamId = (typeof RESERVED_PARAM_IDS)['v60' | 'v61'][number];
/** Tous les reglages numeriques d'une piste, dans l'espace des verrous (audio/locks.ts LockId, hors reglages de trig). */
export type TrackParamId = VoiceParam | KitLockId | LayerLockId | LfoParam | NewParamId;
/** Les reglages de trig, ceux d'aujourd'hui et ceux de V.6.1. */
export type TrackTrigParam = TrigParam | (typeof RESERVED_PARAM_IDS)['trig61'][number];

/* ---------------- le son, le comportement, le kit ---------------- */

export interface TrackSound {
  /** SRC */
  mach: SrcMachine;
  /** la synthese (garde, sans effet, en ONESHOT) */
  model: KitModel;
  /** la cle du sample ('' : OFF) ; sa categorie = son dossier */
  snd: string;
  /** FLTR (V.6.1) ; absent : 'legacy' */
  fmach?: FltrMachine;
  /** les reglages : complets en memoire, seulement ce qui quitte le depart au stockage */
  p: Readonly<Record<TrackParamId, number>>;
  /** V.6.2 : le nom de ce son quand il vient d'un preset de piste */
  name?: string;
}

/** Le comportement de voix d'une piste (dans le kit, pas dans le preset de son), cahier 4.3. */
export interface TrackVoice {
  /** mono : le coup suivant de la piste coupe le precedent (3 ms avant de frapper, la loi du BD d'aujourd'hui) */
  vmode: 'mono' | 'poly';
  /** groupe de choke ; 0 aucun */
  choke: 0 | 1 | 2 | 3 | 4;
  /** un coup du groupe coupe cette piste (8 ms) */
  gated: boolean;
}

/** Le comportement d'aujourd'hui, ce que la migration donne (cahier 4.3) ; T9..T16 mono comme la DT2. */
export const TRACK_VOICE_LEGACY: Readonly<Record<TrackKey, Readonly<TrackVoice>>> = {
  BD: { vmode: 'mono', choke: 0, gated: false },
  SD: { vmode: 'poly', choke: 0, gated: false },
  CH: { vmode: 'poly', choke: 1, gated: false },
  OH: { vmode: 'mono', choke: 1, gated: true },
  CP: { vmode: 'poly', choke: 0, gated: false },
  TOM: { vmode: 'poly', choke: 0, gated: false },
  HT: { vmode: 'poly', choke: 0, gated: false },
  CY: { vmode: 'poly', choke: 0, gated: false },
  T9: { vmode: 'mono', choke: 0, gated: false },
  T10: { vmode: 'mono', choke: 0, gated: false },
  T11: { vmode: 'mono', choke: 0, gated: false },
  T12: { vmode: 'mono', choke: 0, gated: false },
  T13: { vmode: 'mono', choke: 0, gated: false },
  T14: { vmode: 'mono', choke: 0, gated: false },
  T15: { vmode: 'mono', choke: 0, gated: false },
  T16: { vmode: 'mono', choke: 0, gated: false },
};
/**
 * Une piste poly : 4 sources au plus (la plus vieille coupee en 8 ms). Relecture de V.5.9 (R5) : seulement les pistes 9 a
 * 16 (les pistes 1 a 8 n'avaient aucun plafond en V.5.3, et sonnent comme elle).
 */
export const LEGACY_POLY_MAX = 4;

/** Ce que la DT2 range dans le kit en plus des 16 sons (MIXER, menu KIT). */
export interface KitMix {
  /** 16 valeurs, TRK LEV, meme loi que level (0.8 = 0 dB) */
  tlev: readonly number[];
  /** CONTROL ALL CONFIG, masque 16 bits (0xFFFF) */
  ctlAll: number;
  /** COMPRESSOR ROUTING, masque (0xFFFF : tout passe, comme aujourd'hui) */
  compRoute: number;
  /** la piste source du SIDECHAIN ARP/BASS (0 = T1, comme aujourd'hui) */
  scSrc: number;
  /** V.6.1 : le VOL du pattern */
  vol?: number;
}
export const KIT_MIX_DEFAULT: Readonly<KitMix> = { tlev: Array.from({ length: TRACK_COUNT }, () => 0.8), ctlAll: 0xffff, compRoute: 0xffff, scSrc: 0 };

export interface Kit16 {
  v: 1;
  /** 16 */
  tracks: readonly TrackSound[];
  /** 16 */
  voice: readonly TrackVoice[];
  mix: KitMix;
}

/** La forme stockee (mm.v4.rytm.tracks.1 en V.6.0 et V.6.1) : des diffs seulement, les pistes vides absentes. */
export interface StoredKit16 {
  v: 1;
  t?: Partial<Record<TrackKey, { m?: SrcMachine; mo?: KitModel; s?: string; f?: FltrMachine; p?: Partial<Record<TrackParamId, number>>; vm?: 'mono' | 'poly'; ch?: number; g?: 1 }>>;
  mix?: Partial<{ tlev: Partial<Record<TrackKey, number>>; ctlAll: number; compRoute: number; scSrc: number; vol: number }>;
}
/** La cle du kit global (V.6.0 et V.6.1) ; les vieilles cles mm.v4.kit.1 et mm.v4.rytm.voices.1 restent ecrites jusqu'en V.6.2. */
export const TRACKS_KEY = 'mm.v4.rytm.tracks.1';

/* ---------------- le motif au-dela de 16 pas (cahier 4.5) ---------------- */

/**
 * Le reglage du pattern (PAGE SETUP, V.6.1) : sa longueur, son mode, ses vitesses. Absent : 16 pas, 1X, par pattern.
 */
export interface PatternSetup {
  /** 1 a 128 */
  len: number;
  /** PER PATTERN / PER TRACK */
  mode?: 'ptn' | 'trk';
  /** 1/8X a 2X */
  speed?: number;
  trk?: Partial<Record<TrackKey, { len: number; speed: number }>>;
}
/**
 * Les champs NOUVEAUX et facultatifs du motif stocke (StoredPattern) que V.6.0 lit deja et recopie tels quels a
 * l'ecriture, pour qu'un retour arriere de V.6.1 vers V.6.0 ne perde rien : steps[K] reste la chaine de 16 chiffres de
 * la PAGE 1 (les versions d'avant remettent a zero une rangee qui n'est pas /^[0-9]{16}$/) ; les pas 17 a 128 vont dans
 * pages[K] (la suite, une chaine de chiffres 0-9 de longueur len - 16) ; les verrous des pas 16 a 127 restent dans
 * locks (cles '16' a '127', ignorees par les versions d'avant) ; setup porte la longueur et les vitesses.
 */
export interface StoredPatternMore {
  pages?: Partial<Record<TrackKey, string>>;
  setup?: PatternSetup;
  /** V.6.2 : l'empreinte du kit de ce pattern dans le pool */
  kit?: string;
}

/* ---------------- la migration et le store (corps : lane B1) ---------------- */

/**
 * La seule fonction de migration (cahier 4.5, inv-mm-model.md 4.2) : le kit et les voix d'aujourd'hui (apres les
 * traductions d'heritage deja en place : foldFamilies, KIT_V, oldOh, fromR2, compLegacy) vers les 16 pistes. Pure.
 * Piste i < 8 : mach = la famille (toujours la synthese, meme a syn 0), model, snd, les 19 reglages et les LFO de la
 * voix, les 10 potards globaux copies sur chaque piste, la couche ; i >= 8 : piste vide (ONESHOT, OFF, muette).
 * Appelee par le chargement du store, presets.apply, rytmNow, undo, share.dataOfBeat et les presets d'usine.
 */
export function kit16FromLegacy(kit: Readonly<Kit>, voices: Readonly<Record<Inst, Readonly<VoiceFx>>>): Kit16 {
  const tracks = TRACK_KEYS.map((key, i) => {
    if (i >= LEGACY_COUNT) return TRACK_EMPTY;
    const f = KIT_FAMILIES[i];
    const p: Record<TrackParamId, number> = { ...TRACK_P_DEFAULT };
    const v = (voices as Readonly<Record<string, Readonly<Partial<VoiceFx>> | undefined>>)[key] ?? {};
    for (const vp of VOICE_PARAMS) {
      const x = v[vp];
      if (typeof x === 'number' && Number.isFinite(x)) p[vp] = x;
    }
    for (const lp of LFO_PARAMS) {
      const x = v[lp];
      if (typeof x === 'number' && Number.isFinite(x)) p[lp] = x;
    }
    // Les 10 potards GLOBAUX d'avant, copies sur chaque piste : seuls ceux du moteur de la piste comptent (sigOf)
    for (const n of KIT_KNOBS) p[KNOB_PID[n]] = kit.knob[n];
    const l = kit.layer[f] ?? LAYER_DEFAULT;
    for (const lp of LAYER_PARAMS) p[LAYER_PID[lp]] = l[lp];
    const t: TrackSound = { mach: f, model: kit.model[f], snd: kit.sample[f] ?? '', p };
    return t;
  });
  return { v: 1, tracks, voice: TRACK_KEYS.map((k) => ({ ...TRACK_VOICE_LEGACY[k] })), mix: mixDefault() };
}

/**
 * Le store des 16 pistes (cle TRACKS_KEY) : l'interface que B1 implemente. Pendant V.6.0, kit (audio/kit.ts) et voiceFx
 * (audio/voicefx.ts) en deviennent des facades qui gardent TOUTE leur API d'aujourd'hui (environ 125 appels kit.* et 62
 * voiceFx.*), retirees en V.6.1.
 */
export interface TracksStore {
  get(): Readonly<Kit16>;
  of(t: TrackKey): Readonly<TrackSound>;
  param(t: TrackKey, id: TrackParamId): number;
  set(t: TrackKey, id: TrackParamId, v: number): void;
  setMany(t: TrackKey, patch: Readonly<Partial<Record<TrackParamId, number>>>): void;
  machine(t: TrackKey, mach: SrcMachine, model?: KitModel): void;
  sample(t: TrackKey, key: string): void;
  voice(t: TrackKey, patch: Readonly<Partial<TrackVoice>>): void;
  mix(patch: Readonly<Partial<KitMix>>): void;
  /** at : l'heure du contexte audio ou le kit se pose (V.6.2, le kit du pattern suivant a la mesure) */
  replace(kit: Readonly<Kit16>, at?: number): void;
  /** TRACK SWAP (V.6.1) */
  swap(a: TrackKey, b: TrackKey): void;
  subscribe(fn: (changed: readonly TrackKey[]) => void): () => void;
  /** ce que le calcul d'un coup de la piste lit (comme kit.tweak aujourd'hui), avec un verrou eventuel */
  tweak(t: TrackKey, ov?: Readonly<Partial<Record<TrackParamId, number>>>): ShotTweak;
  /** l'empreinte du son d'une piste (la cle du cache des coups), avec un verrou eventuel */
  sig(t: TrackKey, ov?: Readonly<Partial<Record<TrackParamId, number>>>): string;
  /** le moteur d'une piste (sa machine, ou la categorie de son sample en ONESHOT) */
  engine(t: TrackKey): EngineId;
}

/* ---------------- V.5.9 : les reglages d'une piste, leurs departs et leurs lois ---------------- */

/** Les pistes d'heritage (BD..CY, les voix d'avant) : leur rang est celui de KIT_FAMILIES et de INSTRUMENTS. */
export const LEGACY_COUNT = 8;
/** Une piste d'heritage (1 a 8) ? */
export const isLegacyTrack = (t: TrackKey): t is Inst => trackIndex(t) < LEGACY_COUNT;

/** Le reglage de piste de chaque potard de la machine d'avant (les ids des verrous : ktune...). */
export const KNOB_PID: Readonly<Record<KitKnob, KitLockId>> = { tune: 'ktune', attack: 'kattack', decay: 'kdecay', drive: 'kdrive', snappy: 'snappy', gate: 'gate', sweep: 'ksweep', sdtune: 'sdtune', sddecay: 'sddecay', sdtone: 'sdtone' };
/** Le reglage de piste de chaque reglage de couche (syn, slev...). */
export const LAYER_PID: Readonly<Record<LayerParam, LayerLockId>> = { syn: 'syn', lev: 'slev', tune: 'stune', fine: 'sfine', start: 'sstart', len: 'slen', rev: 'srev' };
const KNOB_OF_PID = Object.fromEntries(KIT_KNOBS.map((n) => [KNOB_PID[n], n])) as Readonly<Record<KitLockId, KitKnob>>;
const LAYER_OF_PID = Object.fromEntries(LAYER_PARAMS.map((p) => [LAYER_PID[p], p])) as Readonly<Record<LayerLockId, LayerParam>>;

/** Tous les reglages d'une piste, dans un ordre fixe : la voix, ses LFO, la machine, les couches, TRK LEV, puis ceux de V.6.1. */
export const TRACK_P_IDS: readonly TrackParamId[] = [...VOICE_PARAMS, ...LFO_PARAMS, ...KIT_KNOBS.map((n) => KNOB_PID[n]), ...LAYER_PARAMS.map((p) => LAYER_PID[p]), 'tlev', ...RESERVED_PARAM_IDS.v61];

type ParamKind = 'voice' | 'lfo' | 'knob' | 'layer' | 'tlev' | 'v61';
const KIND: ReadonlyMap<string, ParamKind> = new Map<string, ParamKind>([
  ...VOICE_PARAMS.map((p) => [p, 'voice'] as const),
  ...LFO_PARAMS.map((p) => [p, 'lfo'] as const),
  ...KIT_KNOBS.map((n) => [KNOB_PID[n], 'knob'] as const),
  ...LAYER_PARAMS.map((p) => [LAYER_PID[p], 'layer'] as const),
  ['tlev', 'tlev'] as const,
  ...RESERVED_PARAM_IDS.v61.map((p) => [p, 'v61'] as const),
]);
/** Un id de reglage de piste (l'espace des verrous, hors reglages de trig) ? */
export const isTrackParam = (id: unknown): id is TrackParamId => typeof id === 'string' && KIND.has(id);
/** Le reglage change-t-il ce que joue la voix (sa tranche, ses coups : VoiceParam et LFO) plutot que son son calcule ? */
const voiceKind = (id: TrackParamId): boolean => {
  const k = KIND.get(id);
  return k === 'voice' || k === 'lfo';
};

function defOf(id: TrackParamId): number {
  switch (KIND.get(id)) {
    case 'voice':
      return VOICE_FX_DEFAULT[id as VoiceParam];
    case 'lfo':
      return lfoDefault(id as LfoParam);
    case 'knob':
      return KNOB_DEFAULT[KNOB_OF_PID[id as KitLockId]];
    case 'layer':
      return LAYER_DEFAULT[LAYER_OF_PID[id as LayerLockId]];
    case 'tlev':
      return 0.8;
    default:
      // V.6.1 : reserves, inertes en V.5.9 (jamais ecrits : leur depart se fixera avec leur version)
      return 0;
  }
}

/** Les departs de tous les reglages d'une piste (une piste vide, et la base des diffs stockes). */
export const TRACK_P_DEFAULT: Readonly<Record<TrackParamId, number>> = Object.freeze(Object.fromEntries(TRACK_P_IDS.map((id) => [id, defOf(id)])) as Record<TrackParamId, number>);

/**
 * Un reglage de piste sur ses crans et dans son domaine, comme son store d'avant le pose (voiceFx.set, le kit, la
 * couche) ; exact : une valeur lue (le stockage, un preset) garde la sienne dans son domaine.
 */
export function clampTrackParam(id: TrackParamId, v: number, exact = false): number {
  switch (KIND.get(id)) {
    case 'voice':
      return voiceClamp(id as VoiceParam, v);
    case 'lfo':
      return clampLfo(id as LfoParam, v);
    case 'knob':
      return q(v, KNOB_OF_PID[id as KitLockId], exact);
    case 'layer':
      return clampLayer(LAYER_OF_PID[id as LayerLockId], v, exact);
    case 'tlev':
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8;
    default:
      return Number.isFinite(v) ? v : 0;
  }
}

/** La loi de TRK LEV (cahier 4.1) : celle de level, 0.8 = 0 dB, exactement 1 au depart. */
export const tlevGain = (v: number): number => voiceGain(v);

/** Une piste vide (T9 a T16 au depart) : ONESHOT, son OFF, muette (l'identite audio), mono (la DT2). */
export const TRACK_EMPTY: Readonly<TrackSound> = Object.freeze({ mach: 'oneshot' as SrcMachine, model: 'mm' as KitModel, snd: '', p: TRACK_P_DEFAULT });
const VOICE_EMPTY: Readonly<TrackVoice> = Object.freeze({ vmode: 'mono', choke: 0, gated: false });
const mixDefault = (): KitMix => ({ tlev: Array.from({ length: TRACK_COUNT }, () => 0.8), ctlAll: 0xffff, compRoute: 0xffff, scSrc: 0 });

/** Le moteur de chaque famille (les 9 algorithmes de shotsdsp.ts ; CHopen : le charley ferme qui s'ouvre au pad tenu). */
export const FAMILY_ENGINE: Readonly<Record<KitFamily, EngineId>> = { bd: 'BD', sd: 'SD', ch: 'CH', oh: 'OH', cp: 'CP', tom: 'TOM', ht: 'HT', cy: 'CY' };
const FAMILY_RE = /^([a-z]+)\//;
/** La categorie d'un sample (son dossier, ou celle que dit sa cle) ; undefined sans sample ou hors des 8. */
export function sampleFamily(key: string): KitFamily | undefined {
  if (!key) return undefined;
  const hit = sampleByKey(key)?.family;
  const f = hit ?? FAMILY_RE.exec(key)?.[1];
  return f && (KIT_FAMILIES as readonly string[]).includes(f) ? (f as KitFamily) : undefined;
}
/** La famille du moteur d'une piste : sa machine de synthese, ou la categorie de son sample en ONESHOT (BD par defaut). */
export const soundFamily = (tr: Readonly<TrackSound>): KitFamily => (tr.mach === 'oneshot' ? (sampleFamily(tr.snd) ?? 'bd') : tr.mach);

/** La base du calcul d'un son de piste (ses potards, son sample, ses couches) ; une piste ONESHOT n'a pas de synthese. */
const baseCache = new WeakMap<Readonly<TrackSound>, KitBase>();
function baseOf(tr: Readonly<TrackSound>): KitBase {
  const hit = baseCache.get(tr);
  if (hit) return hit;
  const knob = {} as Record<KitKnob, number>;
  for (const n of KIT_KNOBS) knob[n] = tr.p[KNOB_PID[n]];
  const layer = {} as Layer;
  for (const lp of LAYER_PARAMS) layer[lp] = tr.p[LAYER_PID[lp]];
  if (tr.mach === 'oneshot') layer.syn = 0;
  const b: KitBase = { model: tr.model, knob, sample: tr.snd || undefined, layer };
  baseCache.set(tr, b);
  return b;
}

/** Les reglages de la voix d'une piste (VoiceFx : les 19, puis ses LFO hors de leur depart, comme voiceFx les gardait). */
function vfxOf(tr: Readonly<TrackSound>): VoiceFx {
  const v = {} as VoiceFx;
  for (const p of VOICE_PARAMS) v[p] = tr.p[p];
  for (const p of LFO_PARAMS) if (tr.p[p] !== lfoDefault(p)) v[p] = tr.p[p];
  return v;
}

/** Le kit d'avant (par famille, ses potards globaux) que montrent les pistes 1 a 8 : les potards du kick de T1, ceux de la caisse claire et GATE de T2. */
function kitViewOf(k: Readonly<Kit16>): Kit {
  const t1 = k.tracks[0].p;
  const t2 = k.tracks[1].p;
  const kickKnob = (n: KitKnob): boolean => n === 'tune' || n === 'attack' || n === 'decay' || n === 'drive' || n === 'sweep';
  const knob = Object.fromEntries(KIT_KNOBS.map((n) => [n, (kickKnob(n) ? t1 : t2)[KNOB_PID[n]]])) as Record<KitKnob, number>;
  const model = Object.fromEntries(KIT_FAMILIES.map((f, i) => [f, k.tracks[i].model])) as Record<KitFamily, KitModel>;
  const sample: Partial<Record<KitFamily, string>> = {};
  KIT_FAMILIES.forEach((f, i) => {
    const s = k.tracks[i].snd;
    if (s) sample[f] = s;
  });
  const layer = Object.fromEntries(
    KIT_FAMILIES.map((f, i) => {
      const p = k.tracks[i].p;
      return [f, Object.fromEntries(LAYER_PARAMS.map((lp) => [lp, p[LAYER_PID[lp]]])) as Layer];
    })
  ) as Record<KitFamily, Layer>;
  return { model, knob, sample, layer };
}

/* ---------------- la forme stockee (des diffs, cahier 4.1) ---------------- */

/** La forme stockee sous TRACKS_KEY : StoredKit16, plus l'empreinte des vieilles cles au moment de l'ecriture (lg). */
interface StoredTracks extends StoredKit16 {
  /** l'empreinte (FNV-1a) de mm.v4.kit.1 et mm.v4.rytm.voices.1 telles qu'ecrites avec elle : une autre, une version d'avant les a re-ecrites */
  lg?: string;
}

/** Les diffs d'un kit de 16 pistes : chaque piste contre la piste vide, le mix contre son depart (l'ordre des cles est fixe). */
export function kit16ToStored(k: Readonly<Kit16>): StoredKit16 {
  const t: NonNullable<StoredKit16['t']> = {};
  TRACK_KEYS.forEach((key, i) => {
    const tr = k.tracks[i] ?? TRACK_EMPTY;
    const vo = k.voice[i] ?? VOICE_EMPTY;
    const d: NonNullable<StoredKit16['t']>[TrackKey] = {};
    if (tr.mach !== 'oneshot') d.m = tr.mach;
    if (tr.model !== TRACK_EMPTY.model) d.mo = tr.model;
    if (tr.snd) d.s = tr.snd;
    if (tr.fmach && tr.fmach !== 'legacy') d.f = tr.fmach;
    const p: Partial<Record<TrackParamId, number>> = {};
    let n = 0;
    for (const id of TRACK_P_IDS) {
      if (id === 'tlev') continue;
      if (tr.p[id] !== TRACK_P_DEFAULT[id]) {
        p[id] = tr.p[id];
        n += 1;
      }
    }
    if (n > 0) d.p = p;
    if (vo.vmode !== 'mono') d.vm = vo.vmode;
    if (vo.choke) d.ch = vo.choke;
    if (vo.gated) d.g = 1;
    if (Object.keys(d).length > 0) t[key] = d;
  });
  const mix: NonNullable<StoredKit16['mix']> = {};
  const tl: Partial<Record<TrackKey, number>> = {};
  TRACK_KEYS.forEach((key, i) => {
    const v = k.mix.tlev[i] ?? 0.8;
    if (v !== 0.8) tl[key] = v;
  });
  if (Object.keys(tl).length > 0) mix.tlev = tl;
  if (k.mix.ctlAll !== 0xffff) mix.ctlAll = k.mix.ctlAll;
  if (k.mix.compRoute !== 0xffff) mix.compRoute = k.mix.compRoute;
  if (k.mix.scSrc !== 0) mix.scSrc = k.mix.scSrc;
  if (k.mix.vol !== undefined) mix.vol = k.mix.vol;
  return { v: 1, ...(Object.keys(t).length > 0 ? { t } : {}), ...(Object.keys(mix).length > 0 ? { mix } : {}) };
}

const int16 = (v: unknown, d: number): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffff ? v : d);

/**
 * Un sample lu pour une piste : celui du dossier de sa machine renomme se retrouve (resolveSample, comme le kit
 * d'avant) ; en ONESHOT, dans sa categorie ; '' s'il n'est plus la.
 */
function trackSample(mach: SrcMachine, key: unknown): string {
  if (typeof key !== 'string' || !key) return '';
  const f = mach === 'oneshot' ? sampleFamily(key) : mach;
  if (!f) return '';
  // Une machine de synthese peut jouer un sample de n'importe quelle categorie (cahier 4.2) : tel quel s'il est la
  if (sampleByKey(key)) return key;
  return resolveSample(f, key) ?? '';
}

/** Un kit de 16 pistes lu (le stockage, un preset) ; null s'il n'en a pas la forme. Chaque valeur dans son domaine. */
export function kit16FromStored(raw: unknown): Kit16 | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { v?: unknown; t?: unknown; mix?: unknown };
  if (o.v !== 1) return null;
  const rows: Record<string, unknown> = {};
  if (o.t && typeof o.t === 'object') {
    for (const [k, v] of Object.entries(o.t as Record<string, unknown>)) {
      const key = normTrackKey(k);
      // La cle d'aujourd'hui gagne sur son alias (T1 pour BD)
      if (key && (rows[key] === undefined || k === key)) rows[key] = v;
    }
  }
  const tracks: TrackSound[] = [];
  const voice: TrackVoice[] = [];
  for (const key of TRACK_KEYS) {
    const r = rows[key] as { m?: unknown; mo?: unknown; s?: unknown; f?: unknown; p?: unknown; vm?: unknown; ch?: unknown; g?: unknown } | undefined;
    if (!r || typeof r !== 'object') {
      tracks.push(TRACK_EMPTY);
      voice.push({ ...VOICE_EMPTY });
      continue;
    }
    const mach: SrcMachine = typeof r.m === 'string' && (SRC_MACHINES as readonly string[]).includes(r.m) ? (r.m as SrcMachine) : 'oneshot';
    const model: KitModel = isModel(r.mo) ? r.mo : TRACK_EMPTY.model;
    const p: Record<TrackParamId, number> = { ...TRACK_P_DEFAULT };
    if (r.p && typeof r.p === 'object') {
      for (const [id, v] of Object.entries(r.p as Record<string, unknown>)) {
        if (!isTrackParam(id) || id === 'tlev' || typeof v !== 'number' || !Number.isFinite(v)) continue;
        p[id] = clampTrackParam(id, v, true);
      }
    }
    const snd = trackSample(mach, r.s);
    // Plus d'echantillon (un dossier renomme vide, un sample de ce navigateur parti) : la synthese reprend, jamais une
    // piste muette sans raison (la regle du kit d'avant)
    if (!snd && typeof r.s === 'string' && r.s && mach !== 'oneshot' && p.syn <= 0) p.syn = 1;
    const fm = r.f === 'multi' || r.f === 'lp4' || r.f === 'eq' ? r.f : undefined;
    tracks.push({ mach, model, snd, ...(fm ? { fmach: fm } : {}), p });
    const ch = typeof r.ch === 'number' && Number.isInteger(r.ch) && r.ch >= 0 && r.ch <= 4 ? (r.ch as TrackVoice['choke']) : 0;
    voice.push({ vmode: r.vm === 'poly' ? 'poly' : 'mono', choke: ch, gated: r.g === 1 || r.g === true });
  }
  const mix = mixDefault();
  if (o.mix && typeof o.mix === 'object') {
    const m = o.mix as { tlev?: unknown; ctlAll?: unknown; compRoute?: unknown; scSrc?: unknown; vol?: unknown };
    if (m.tlev && typeof m.tlev === 'object') {
      const tl = [...mix.tlev];
      for (const [k, v] of Object.entries(m.tlev as Record<string, unknown>)) {
        const key = normTrackKey(k);
        if (key && typeof v === 'number' && Number.isFinite(v)) tl[trackIndex(key)] = clampTrackParam('tlev', v, true);
      }
      mix.tlev = tl;
    }
    mix.ctlAll = int16(m.ctlAll, 0xffff);
    mix.compRoute = int16(m.compRoute, 0xffff);
    mix.scSrc = typeof m.scSrc === 'number' && Number.isInteger(m.scSrc) && m.scSrc >= 0 && m.scSrc < TRACK_COUNT ? m.scSrc : 0;
    if (typeof m.vol === 'number' && Number.isFinite(m.vol)) mix.vol = Math.min(1, Math.max(0, m.vol));
  }
  return { v: 1, tracks, voice, mix };
}

/** Deux kits de 16 pistes egaux (leurs diffs) : un preset n'ecrit ses pistes a cote que si elles different de ses cles d'avant. */
export const sameKit16 = (a: Readonly<Kit16>, b: Readonly<Kit16>): boolean => JSON.stringify(kit16ToStored(a)) === JSON.stringify(kit16ToStored(b));

/** FNV-1a sur 32 bits (l'empreinte des vieilles cles, lg). */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
const legacyPrint = (rk: string | null, rv: string | null): string => fnv(`${rk ?? ''}\u0001${rv ?? ''}`);

/* ---------------- le store (V.5.9) ---------------- */

/** Ce qu'un changement du store a touche (le moteur, les facades). */
export interface TracksChange {
  /** les pistes dont quelque chose a change (son, voix, comportement, TRK LEV) */
  readonly tracks: readonly TrackKey[];
  /** le son calcule (machine, modele, sample, potards, couches) */
  readonly sound: readonly TrackKey[];
  /** les reglages de la voix (VoiceParam, LFO) */
  readonly voice: readonly TrackKey[];
  /** les familles du kit d'avant (pistes 1 a 8) dont la vue a change : ce que kit.subscribe annonce */
  readonly kit: readonly KitFamily[];
  /** le comportement de voix (mono, choke, gated) */
  readonly beh: boolean;
  /** le mix (TRK LEV, CONTROL ALL, routage, source du SIDECHAIN) */
  readonly mix: boolean;
}

const SAVE_MS = 300;
const store = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};
const readKey = (k: string): string | null => {
  try {
    return store()?.getItem(k) ?? null;
  } catch {
    return null;
  }
};

/** D'ou vient le kit de ce chargement : les vieilles cles seules, TRACKS_KEY, ou les deux (un retour arriere entre-temps). */
let loadedFrom: 'legacy' | 'tracks' | 'mixed' = 'legacy';
/**
 * Les vieilles cles telles que CET onglet les connait (relecture de V.5.9, R1) : lues au chargement, puis ce qu'il y a
 * lui-meme ecrit. L'empreinte de TRACKS_KEY se prend sur elles, pas sur le stockage du moment : un autre onglet (V.5.3 ou
 * V.5.9) qui a re-ecrit le kit ou les voix depuis ne passe pas pour ce que ce kit connait ; au chargement suivant,
 * l'empreinte differe, et les pistes 1 a 8 viennent des vieilles cles (mixed) : les deux editions sont gardees.
 */
let seenKit: string | null = null;
let seenVoices: string | null = null;

function load(): Kit16 {
  if (typeof window === 'undefined') return kit16FromLegacy(defaultKit(), parseVoices(null));
  const rk = readKey(KIT_KEY);
  const rv = readKey(VOICES_KEY);
  seenKit = rk;
  seenVoices = rv;
  const legacy = kit16FromLegacy(parseKit(rk), parseVoices(rv));
  const raw = readKey(TRACKS_KEY);
  if (!raw) return legacy;
  let o: StoredTracks | null = null;
  try {
    o = JSON.parse(raw) as StoredTracks;
  } catch {
    return legacy;
  }
  const full = kit16FromStored(o);
  if (!full) return legacy;
  if (o && o.lg === legacyPrint(rk, rv)) {
    loadedFrom = 'tracks';
    return full;
  }
  // Une version d'avant (V.5.3) a re-ecrit le kit ou les voix depuis : elles disent les pistes 1 a 8 ; le reste (9 a 16,
  // le comportement, le mix) vient de TRACKS_KEY, qu'elle ne connait pas
  loadedFrom = 'mixed';
  return { v: 1, tracks: [...legacy.tracks.slice(0, LEGACY_COUNT), ...full.tracks.slice(LEGACY_COUNT)], voice: full.voice, mix: full.mix };
}

let K: Kit16 = load();
let ver = 0;
let saves = 0;
const subs = new Set<(c: TracksChange) => void>();
/** Les facades (kit.ts, voicefx.ts) : appelees apres le moteur, comme leurs abonnes l'etaient (le moteur s'abonnait le premier). */
const facades = new Set<(c: TracksChange) => void>();

/** Le numero du choix de son de chaque piste (kit.choice d'avant, par piste) : il monte quand ce qu'elle joue change de nature. */
const choiceKeyOfTrack = (tr: Readonly<TrackSound>): string => `${tr.mach}|${choiceKeyOf(tr.snd || undefined, tr.model, baseOf(tr).layer)}`;
const choiceSeen = K.tracks.map(choiceKeyOfTrack);
const choiceGen = K.tracks.map(() => 0);

/* Les vues des facades, en cache (la meme reference tant que rien de leur domaine ne change) */
let kitCache: Kit | null = null;
const vfxCache: (VoiceFx | null)[] = TRACK_KEYS.map(() => null);
let voicesCache: Record<Inst, VoiceFx> | null = null;

let saveTimer = 0;
let dirtyKit = false;
let dirtyVoices = false;

/** La double ecriture : TRACKS_KEY, et les vieilles cles des domaines qui ont change (au format d'avant, octet pour octet). */
function flushSave(): void {
  saveTimer = 0;
  const s = store();
  if (!s) return;
  if (dirtyKit) {
    try {
      const out = JSON.stringify({ v: KIT_V, ...legacyKit() });
      s.setItem(KIT_KEY, out);
      seenKit = out;
    } catch {
      /* stockage plein ou refuse : le kit vit pour la visite */
    }
  }
  if (dirtyVoices) {
    try {
      const out = voicesOut(legacyVoices());
      if (out) s.setItem(VOICES_KEY, out);
      else s.removeItem(VOICES_KEY);
      seenVoices = out || null;
    } catch {
      /* stockage plein ou bloque : les reglages vivent pour la visite */
    }
  }
  dirtyKit = false;
  dirtyVoices = false;
  try {
    const st: StoredTracks = { ...kit16ToStored(K), lg: legacyPrint(seenKit, seenVoices) };
    s.setItem(TRACKS_KEY, JSON.stringify(st));
    saves += 1;
  } catch {
    /* les vieilles cles gardent les pistes 1 a 8 */
  }
}

function saveSoon(c: TracksChange): void {
  if (typeof window === 'undefined') return;
  if (c.kit.length > 0) dirtyKit = true;
  if (c.voice.some(isLegacyTrack)) dirtyVoices = true;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, SAVE_MS);
}

const sameVoiceMode = (a: Readonly<TrackVoice>, b: Readonly<TrackVoice>): boolean => a.vmode === b.vmode && a.choke === b.choke && a.gated === b.gated;

/**
 * Le seul chemin d'un changement : ce qui a change, piste par piste et par domaine ; rien ne part si rien ne change.
 * kitFams : les familles que la facade du kit annonce (celles de son geste, comme avant) ; absentes, celles des pistes
 * 1 a 8 dont le son a change.
 */
function commit(next: Kit16, kitFams?: readonly KitFamily[]): boolean {
  const tr: TrackKey[] = [];
  const sound: TrackKey[] = [];
  const voice: TrackKey[] = [];
  let beh = false;
  let mix = false;
  TRACK_KEYS.forEach((key, i) => {
    const a = K.tracks[i];
    const b = next.tracks[i];
    let s = false;
    let v = false;
    if (a !== b) {
      s = a.mach !== b.mach || a.model !== b.model || a.snd !== b.snd || a.fmach !== b.fmach;
      for (const id of TRACK_P_IDS) {
        if (a.p[id] === b.p[id]) continue;
        if (voiceKind(id)) v = true;
        else s = true;
      }
    }
    const bh = !sameVoiceMode(K.voice[i], next.voice[i]);
    const tl = K.mix.tlev[i] !== next.mix.tlev[i];
    if (s) sound.push(key);
    if (v) voice.push(key);
    if (bh) beh = true;
    if (tl) mix = true;
    if (s || v || bh || tl) tr.push(key);
  });
  if (K.mix.ctlAll !== next.mix.ctlAll || K.mix.compRoute !== next.mix.compRoute || K.mix.scSrc !== next.mix.scSrc || K.mix.vol !== next.mix.vol) mix = true;
  if (tr.length === 0 && !mix) return false;
  const kit = kitFams ? [...kitFams] : sound.filter(isLegacyTrack).map((k) => KIT_FAMILIES[trackIndex(k)]);
  K = next;
  ver += 1;
  if (kit.length > 0 || sound.some(isLegacyTrack)) kitCache = null;
  for (const k of voice) {
    vfxCache[trackIndex(k)] = null;
    if (isLegacyTrack(k)) voicesCache = null;
  }
  for (const k of sound) {
    const i = trackIndex(k);
    const c = choiceKeyOfTrack(K.tracks[i]);
    if (c !== choiceSeen[i]) {
      choiceSeen[i] = c;
      choiceGen[i] += 1;
    }
  }
  const change: TracksChange = { tracks: tr, sound, voice, kit, beh, mix };
  saveSoon(change);
  for (const fn of [...subs]) fn(change);
  for (const fn of [...facades]) fn(change);
  return true;
}

const idx = (t: TrackKey): number => {
  const i = trackIndex(t);
  if (i < 0) throw new Error(`tracks : piste inconnue ${String(t)}`);
  return i;
};
const withTrack = (i: number, tr: TrackSound): Kit16 => ({ ...K, tracks: K.tracks.map((x, j) => (j === i ? tr : x)) });

function legacyKit(): Kit {
  kitCache ??= kitViewOf(K);
  return kitCache;
}
function vfxAt(i: number): VoiceFx {
  let v = vfxCache[i];
  if (!v) {
    v = vfxOf(K.tracks[i]);
    vfxCache[i] = v;
  }
  return v;
}
function legacyVoices(): Record<Inst, VoiceFx> {
  voicesCache ??= Object.fromEntries(LEGACY_KEYS.map((k, i) => [k, vfxAt(i)])) as Record<Inst, VoiceFx>;
  return voicesCache;
}

/** Un changement de reglages (des ids de verrous) en ce que le calcul du son lit (les potards, les couches). */
function paramOv(ov: Readonly<Partial<Record<TrackParamId, number>>> | undefined): KitOverride | null {
  if (!ov) return null;
  let out: KitOverride | null = null;
  for (const [id, v] of Object.entries(ov)) {
    if (typeof v !== 'number') continue;
    const k = KIND.get(id);
    if (k === 'knob') {
      out ??= {};
      out.knobs = { ...(out.knobs ?? {}), [KNOB_OF_PID[id as KitLockId]]: v };
    } else if (k === 'layer') {
      out ??= {};
      out.layer = { ...(out.layer ?? {}), [LAYER_OF_PID[id as LayerLockId]]: v };
    }
  }
  return out;
}

// Un sample de Mika retire de ce navigateur (audio/usersamples.ts) pendant qu'une piste le joue : elle passe sur OFF et
// sa synthese reprend si elle etait a 0 (la regle du kit d'avant, sur les 16 pistes)
samplesChanged.subscribe(() => {
  const gone = K.tracks.map((tr, i) => (tr.snd && !sampleByKey(tr.snd) ? i : -1)).filter((i) => i >= 0);
  if (gone.length === 0) return;
  const tracksNext = K.tracks.map((tr, i) => {
    if (!gone.includes(i)) return tr;
    const p = tr.mach !== 'oneshot' && tr.p.syn <= 0 ? { ...tr.p, syn: 1 } : tr.p;
    return { ...tr, snd: '', p };
  });
  commit({ ...K, tracks: tracksNext }, gone.filter((i) => i < LEGACY_COUNT).map((i) => KIT_FAMILIES[i]));
});

/**
 * Le store des 16 pistes (V.5.9). L'interface du contrat (TracksStore), plus ce que le moteur lit (la voix d'une piste,
 * le calcul de son coup avec un verrou de pas, son moteur, son comportement, le mix).
 */
export const tracks = {
  get: (): Readonly<Kit16> => K,
  of: (t: TrackKey): Readonly<TrackSound> => K.tracks[idx(t)],
  param(t: TrackKey, id: TrackParamId): number {
    const i = idx(t);
    return id === 'tlev' ? K.mix.tlev[i] : K.tracks[i].p[id];
  },
  set(t: TrackKey, id: TrackParamId, v: number): void {
    tracks.setMany(t, { [id]: v } as Partial<Record<TrackParamId, number>>);
  },
  /** Des reglages d'une piste (sur leurs crans) : un seul changement annonce ; TRK LEV va au mix. */
  setMany(t: TrackKey, patch: Readonly<Partial<Record<TrackParamId, number>>>): void {
    const i = idx(t);
    const tr = K.tracks[i];
    let p: Record<TrackParamId, number> | null = null;
    let tlev = K.mix.tlev;
    for (const [id, v] of Object.entries(patch)) {
      if (!isTrackParam(id) || typeof v !== 'number') continue;
      const c = clampTrackParam(id, v);
      if (id === 'tlev') {
        if (tlev[i] !== c) tlev = tlev.map((x, j) => (j === i ? c : x));
        continue;
      }
      if (tr.p[id] === c) continue;
      p ??= { ...tr.p };
      p[id] = c;
    }
    if (!p && tlev === K.mix.tlev) return;
    const next = p ? withTrack(i, { ...tr, p }) : K;
    commit(tlev === K.mix.tlev ? next : { ...next, mix: { ...next.mix, tlev } });
  },
  /** La machine SRC d'une piste (et la synthese de sa couche SYNTH) ; ses reglages restent. */
  machine(t: TrackKey, mach: SrcMachine, model?: KitModel): void {
    if (!(SRC_MACHINES as readonly string[]).includes(mach)) return;
    const i = idx(t);
    const tr = K.tracks[i];
    const m = model !== undefined && isModel(model) ? model : tr.model;
    if (tr.mach === mach && tr.model === m) return;
    commit(withTrack(i, { ...tr, mach, model: m }));
  },
  /** Le sample d'une piste (n'importe quelle categorie, cahier 4.2) ; '' : OFF. Une cle inconnue ne change rien. */
  sample(t: TrackKey, key: string): void {
    const i = idx(t);
    const tr = K.tracks[i];
    if (key !== '' && !sampleByKey(key)) return;
    if (tr.snd === key) return;
    commit(withTrack(i, { ...tr, snd: key }));
  },
  /** Le comportement de voix d'une piste (mono / poly, groupe de choke, gated). */
  voice(t: TrackKey, patch: Readonly<Partial<TrackVoice>>): void {
    const i = idx(t);
    const cur = K.voice[i];
    const nv: TrackVoice = {
      vmode: patch.vmode === 'poly' || patch.vmode === 'mono' ? patch.vmode : cur.vmode,
      choke: typeof patch.choke === 'number' && Number.isInteger(patch.choke) && patch.choke >= 0 && patch.choke <= 4 ? patch.choke : cur.choke,
      gated: typeof patch.gated === 'boolean' ? patch.gated : cur.gated,
    };
    if (sameVoiceMode(cur, nv)) return;
    commit({ ...K, voice: K.voice.map((x, j) => (j === i ? nv : x)) });
  },
  /** Le mix (TRK LEV des 16, CONTROL ALL, COMPRESSOR ROUTING, la source du SIDECHAIN). */
  mix(patch: Readonly<Partial<KitMix>>): void {
    const m: KitMix = { ...K.mix };
    if (Array.isArray(patch.tlev)) m.tlev = K.mix.tlev.map((x, i) => (typeof patch.tlev?.[i] === 'number' ? clampTrackParam('tlev', patch.tlev[i]) : x));
    if (patch.ctlAll !== undefined) m.ctlAll = int16(patch.ctlAll, K.mix.ctlAll);
    if (patch.compRoute !== undefined) m.compRoute = int16(patch.compRoute, K.mix.compRoute);
    if (typeof patch.scSrc === 'number' && Number.isInteger(patch.scSrc) && patch.scSrc >= 0 && patch.scSrc < TRACK_COUNT) m.scSrc = patch.scSrc;
    if (typeof patch.vol === 'number' && Number.isFinite(patch.vol)) m.vol = Math.min(1, Math.max(0, patch.vol));
    commit({ ...K, mix: m });
  },
  /** Un kit entier (un preset, l'UNDO, un test) : un seul changement annonce ; at (V.6.2) : pas encore, tout de suite. */
  replace(kit: Readonly<Kit16>, at?: number): void {
    void at;
    const n = kit16FromStored(kit16ToStored(kit));
    if (n) commit(n);
  },
  /** TRACK SWAP (V.6.1) : deux pistes echangent leur son, leur comportement et leur TRK LEV. */
  swap(a: TrackKey, b: TrackKey): void {
    const i = idx(a);
    const j = idx(b);
    if (i === j) return;
    const sw = <T>(xs: readonly T[]): T[] => xs.map((x, k) => (k === i ? xs[j] : k === j ? xs[i] : x));
    commit({ ...K, tracks: sw(K.tracks), voice: sw(K.voice), mix: { ...K.mix, tlev: sw(K.mix.tlev) } });
  },
  subscribe(fn: (changed: readonly TrackKey[]) => void): () => void {
    const w = (c: TracksChange): void => fn(c.tracks);
    subs.add(w);
    return () => {
      subs.delete(w);
    };
  },
  /** Le detail de chaque changement (le moteur : quelles pistes, quel domaine). */
  onChange(fn: (c: TracksChange) => void): () => void {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
  tweak(t: TrackKey, ov?: Readonly<Partial<Record<TrackParamId, number>>>): ShotTweak {
    return tracks.tweakWith(t, paramOv(ov));
  },
  sig(t: TrackKey, ov?: Readonly<Partial<Record<TrackParamId, number>>>): string {
    return tracks.sigWith(t, paramOv(ov));
  },
  engine(t: TrackKey): EngineId {
    return FAMILY_ENGINE[soundFamily(K.tracks[idx(t)])];
  },
  /** La famille du moteur d'une piste (la categorie de ses samples, la loi de sa signature). */
  family(t: TrackKey): KitFamily {
    return soundFamily(K.tracks[idx(t)]);
  },
  /** Ce que le calcul d'un coup de la piste lit, avec ce qu'un pas change au son (kit.tweakWith d'avant, par piste). */
  tweakWith(t: TrackKey, ov: KitOverride | null): ShotTweak {
    const tr = K.tracks[idx(t)];
    return tweakOf(viewWith(baseOf(tr), soundFamily(tr), ov));
  },
  /** Sa signature (la cle du cache des coups ; deux pistes au meme son partagent le calcul). */
  sigWith(t: TrackKey, ov: KitOverride | null): string {
    const tr = K.tracks[idx(t)];
    const f = soundFamily(tr);
    return sigOf(f, viewWith(baseOf(tr), f, ov));
  },
  /** Ce que joue la piste (ses couches), un verrou compris. */
  playsWith(t: TrackKey, ov: KitOverride | null): Plays {
    const tr = K.tracks[idx(t)];
    return playsOf(viewWith(baseOf(tr), soundFamily(tr), ov));
  },
  /** Le coup de la piste joue-t-il un kick (un moteur KICK et sa synthese, ou un sample de kick) ? Le SIDECHAIN s'y cale. */
  kickWith(t: TrackKey, ov: KitOverride | null): boolean {
    const tr = K.tracks[idx(t)];
    const f = soundFamily(tr);
    return f === 'bd' && kickOf(viewWith(baseOf(tr), f, ov));
  },
  /** Les reglages de la voix d'une piste (la forme VoiceFx : voiceFx.of d'avant, sur 16). */
  vfx(t: TrackKey): Readonly<VoiceFx> {
    return vfxAt(idx(t));
  },
  /** Le comportement de voix d'une piste. */
  voiceOf(t: TrackKey): Readonly<TrackVoice> {
    return K.voice[idx(t)];
  },
  /** TRK LEV d'une piste, en gain (exactement 1 au depart). */
  tlevGain(t: TrackKey): number {
    return tlevGain(K.mix.tlev[idx(t)]);
  },
  /** La piste source du SIDECHAIN (mix.scSrc : T1 au depart). */
  scSrc(): TrackKey {
    return TRACK_KEYS[K.mix.scSrc] ?? 'BD';
  },
  /** Le numero du choix de son de la piste (kit.choice d'avant, par piste). */
  choice(t: TrackKey): number {
    return choiceGen[idx(t)];
  },
  /** La piste a-t-elle un son (une piste vide est muette, rien a calculer ni a construire) ? */
  sounds(t: TrackKey): boolean {
    const tr = K.tracks[idx(t)];
    const b = baseOf(tr);
    return b.layer.syn > 0 || (!!b.sample && b.layer.lev > 0);
  },
  /** Ecrit tout de suite une sauvegarde en attente (tests, pagehide). */
  flush(): void {
    if (!saveTimer || typeof window === 'undefined') return;
    window.clearTimeout(saveTimer);
    flushSave();
  },
  /** Revue (__v4.tracks.info) : la version, l'origine du chargement, les sauvegardes, les pistes qui ont un son. */
  info(): { ver: number; loadedFrom: 'legacy' | 'tracks' | 'mixed'; saves: number; sounding: TrackKey[]; stored: StoredKit16 } {
    return { ver, loadedFrom, saves, sounding: TRACK_KEYS.filter((k) => tracks.sounds(k)), stored: kit16ToStored(K) };
  },
};

/**
 * Ce que les facades lisent et ecrivent (audio/kit.ts, audio/voicefx.ts) : les vues d'avant des pistes 1 a 8 et leurs
 * ecritures, aux valeurs exactes que la facade a deja posees sur leurs crans. Personne d'autre ne s'en sert.
 */
export const tracksLegacy = {
  /** Le kit d'avant (par famille) que jouent les pistes 1 a 8 ; la meme reference tant qu'il ne change pas. */
  kit: (): Readonly<Kit> => legacyKit(),
  /** Les reglages des 8 voix ; la meme reference tant qu'ils ne changent pas. */
  voices: (): Readonly<Record<Inst, Readonly<VoiceFx>>> => legacyVoices(),
  voice: (inst: Inst): Readonly<VoiceFx> => vfxAt(idx(inst)),
  /**
   * Un kit d'avant ecrit sur les pistes 1 a 8 : model, sample et couches des familles fams ; knobs : les potards (sur
   * les 8 pistes, globaux comme avant). Annonce fams a kit.subscribe (le geste de la facade), comme avant.
   */
  writeKit(next: Readonly<Kit>, fams: readonly KitFamily[], knobs: boolean): boolean {
    const tracksNext = K.tracks.map((tr, i) => {
      if (i >= LEGACY_COUNT) return tr;
      const f = KIT_FAMILIES[i];
      let p = tr.p;
      const put = (id: TrackParamId, v: number): void => {
        if (p[id] === v) return;
        if (p === tr.p) p = { ...tr.p };
        (p as Record<TrackParamId, number>)[id] = v;
      };
      let model = tr.model;
      let snd = tr.snd;
      if (fams.includes(f)) {
        model = next.model[f];
        snd = next.sample[f] ?? '';
        const l = next.layer[f] ?? LAYER_DEFAULT;
        for (const lp of LAYER_PARAMS) put(LAYER_PID[lp], l[lp]);
      }
      if (knobs) for (const n of KIT_KNOBS) put(KNOB_PID[n], next.knob[n]);
      return p === tr.p && model === tr.model && snd === tr.snd ? tr : { ...tr, model, snd, p };
    });
    return commit({ ...K, tracks: tracksNext }, fams);
  },
  /** Des reglages de la voix inst (VoiceParam, LFO), aux valeurs exactes deja posees ; un seul changement annonce. */
  writeVoice(inst: Inst, patch: Readonly<Partial<Record<VoiceParam | LfoParam, number>>>): boolean {
    const i = idx(inst);
    const tr = K.tracks[i];
    let p: Record<TrackParamId, number> | null = null;
    for (const [id, v] of Object.entries(patch)) {
      if (typeof v !== 'number' || !isTrackParam(id) || tr.p[id] === v) continue;
      p ??= { ...tr.p };
      p[id] = v;
    }
    return p ? commit(withTrack(i, { ...tr, p })) : false;
  },
  /** Les facades s'abonnent ici : leurs abonnes passent apres le moteur. */
  onChange(fn: (c: TracksChange) => void): () => void {
    facades.add(fn);
    return () => {
      facades.delete(fn);
    };
  },
};

/** Les modeles de synthese (re-export pour le contrat : un modele est l'une des trois machines d'avant). */
export const TRACK_MODELS: readonly KitModel[] = KIT_MODELS;
