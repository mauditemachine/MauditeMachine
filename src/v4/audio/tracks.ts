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
 */

import type { Kit, KitFamily, KitModel, ShotTweak } from './kit';
import type { KitLockId, LayerLockId } from './locks';
import type { LfoKey, LfoParam } from './lfo';
import type { TrigParam } from './trig';
import type { VoiceFx, VoiceParam } from './voicefx';
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
/** Les pistes poly d'heritage : 4 sources au plus (la plus vieille coupee en 8 ms). */
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
  void kit;
  void voices;
  throw new Error('kit16FromLegacy : le corps est a ecrire par la lane B1 (contrat P0)');
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
