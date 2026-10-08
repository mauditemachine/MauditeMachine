/**
 * Le kit du MM-RYTM (2026-10-04, Mika : "le kick sonne flat.. met un kick
 * de 909 s'il te plait et tweakable comme il faut dans le OPEN de la
 * machine ; sous le capot, a la place des liens, un systeme de Tweaks..
 * genre changement de samples pour les voices"). Les TWEAKS sous le capot
 * (scene/rytmTweaks.ts) reglent ce store :
 * - le son de chaque famille de voix : 909, 808 ou MM (celui d'avant), une
 *   synthese a la facon de chaque machine (audio/shotsdsp.ts), jamais un
 *   echantillon d'une autre. KICK en 909 par defaut, les autres en MM.
 *   Depuis le 2026-10-05 (Mika : "mets ces samples dans le selecteur de
 *   samples, pour BD et SD"), les echantillons de Mika poses dans
 *   audio/samples/<famille>/ suivent, un cran chacun (audio/samples.ts) ;
 * - le KICK : TUNE (sa hauteur), ATTACK (la frappe), DECAY (sa longueur),
 *   DRIVE (sa saturation), pour les trois sons ;
 * - SNAPPY : le timbre de la caisse claire (les trois sons) ;
 * - GATE (2026-10-04, Mika : "trop de gate reverb sur le snare et le clap,
 *   je veux pouvoir l'activer ou pas dans OPEN") : la reverbe a porte de
 *   la caisse claire MM et la petite piece des claps MM et 909, OFF par
 *   defaut, ON pour les retrouver. Un commutateur a deux crans.
 * Chaque coup est calcule avec le kit du moment (audio/shots.ts : sa
 * signature fait partie de la cle de l'echantillon) ; un reglage tourne
 * recalcule le son en fond. Retenu dans le navigateur.
 *
 * Les deux couches (2026-10-08, l'etape R3, Mika : "une machine pour la
 * configuration a la main du Voice pour avoir des samples et aussi une
 * configuration digitale du BD ou SD.. comme la ANALOG Rytm ou on peut
 * mettre des samples mais le kick peut etre parametre comme une machine") :
 * chaque famille a deux couches qui jouent ensemble, puis passent par la
 * meme voix (AMP, effets, le bus du kick, le kick monophonique) :
 * - SYNTH (la page SRC) : sa MACHINE (909, 808, MM : model) et ses potards
 *   (knob) : le KICK TUNE, ATTACK, SWEEP (nouveau : la profondeur de sa
 *   descente), DECAY, DRIVE ; la caisse claire TUNE, SNAPPY, TONE, DECAY
 *   (nouveaux, sauf SNAPPY), GATE ; son niveau layer.syn ;
 * - SAMPLE (la page SMPL) : son echantillon (sample, absent : OFF) et ses
 *   reglages a elle (layer : TUNE, FINE, START, LEN, REV, son niveau lev).
 * ATTACK et DRIVE du kick, SNAPPY de la caisse claire font le caractere de
 * la voix : ils reglent les deux couches (BOTH a l'ecran), comme avant R3
 * quand un echantillon jouait ; TUNE, SWEEP, DECAY, TONE ne reglent que la
 * synthese.
 * Le choix de son d'avant (SOUND : 909, 808, MM, puis les echantillons ; la
 * plaque KICK, rytm:kit:bd) reste : un raccourci vers UNE couche (un modele :
 * la synthese seule ; un echantillon : lui seul, la synthese a 0).
 * Par defaut (2026-10-08, Mika : "change les tout de suite pour BD et SD ...
 * c'est ceux la que je veux") : BD et SD jouent le premier echantillon de leur
 * famille, la synthese a 0 ; les autres familles leur synthese. Un kit
 * retenu d'avant R3 se traduit au meme son (load) : un echantillon choisi
 * devient la couche SAMPLE (TUNE et DECAY du kick d'alors : son TUNE et son
 * LEN), un modele la couche SYNTH seule ; le son par defaut d'alors (BD 909,
 * SD MM, jamais choisi ni regle : ses potards a leur depart) prend le nouveau
 * defaut. Un sample emprunte a une autre famille par un verrou joue seul sur
 * son pas (revue de R3). Les potards au 127e depuis
 * R3 (au cinquantieme avant : un kit retenu garde ses valeurs exactes).
 */

import { lenOfDecay, sampleTuneSt } from './sampledsp';
import { sampleByKey, samplesOf } from './samples';
import {
  KICK_SWEEP,
  SD_BODY_HZ,
  SD_DECAY_S,
  SD_TONE_HZ,
  kickDecayS,
  kickHz,
  sdDecayFactor,
  sdToneFactor,
  sdTuneFactor,
  sweepDepth,
  type KitModel,
  type SampleLayer,
  type ShotId,
  type ShotTweak,
} from './shotsdsp';

export type { KitModel, ShotTweak } from './shotsdsp';
export const KIT_MODELS: readonly KitModel[] = ['909', '808', 'mm'];
export const KIT_MODEL_LABEL: Readonly<Record<KitModel, string>> = { '909': '909', '808': '808', mm: 'MM' };

/** Les familles de voix qui changent de son. */
export type KitFamily = 'bd' | 'sd' | 'hh' | 'cp' | 'tom' | 'rs';
/** Les reglages continus de la machine, et GATE (0 ou 1, un commutateur a deux crans). */
export type KitKnob = 'tune' | 'attack' | 'decay' | 'drive' | 'snappy' | 'gate' | 'sweep' | 'sdtune' | 'sddecay' | 'sdtone';
/** Un TWEAK du MM-RYTM : un choix de son ou un potard. */
export type KitId = KitFamily | KitKnob;

export const KIT_FAMILIES: readonly KitFamily[] = ['bd', 'sd', 'hh', 'cp', 'tom', 'rs'];
export const KIT_KNOBS: readonly KitKnob[] = ['tune', 'attack', 'decay', 'drive', 'snappy', 'gate', 'sweep', 'sdtune', 'sddecay', 'sdtone'];
// Plus de RIM depuis le 2026-10-05 (huit voix, plus de RS) : la famille reste pour les anciens reglages, sans potard
/** La plaque TWEAKS (OPEN) et ses jumeaux, dans leur ordre : ses onze cases (R3 n'en ajoute pas). */
export const KIT_IDS: readonly KitId[] = ['bd', 'tune', 'attack', 'decay', 'drive', 'sd', 'snappy', 'cp', 'gate', 'hh', 'tom'];
/** Les potards de la machine ajoutes par R3 (2026-10-08) : sur la page SRC et en MIDI (rytm:kit:<id>), pas sur la plaque. */
export const KIT_MORE: readonly KitKnob[] = ['sweep', 'sdtune', 'sddecay', 'sdtone'];

export const isFamily = (id: KitId): id is KitFamily => (KIT_FAMILIES as readonly string[]).includes(id);
/** Les crans d'un TWEAK : 3 pour un choix de son (plus un par echantillon de la famille), 2 pour GATE, 0 pour un potard. */
export const kitSteps = (id: KitId): number => (isFamily(id) ? KIT_MODELS.length + samplesOf(id).length : id === 'gate' ? 2 : 0);
/** Les noms des crans d'un choix de son : 909, 808, MM, puis le nom de chaque echantillon (la plaque). */
export const kitStepLabels = (f: KitFamily): string[] => {
  const list = samplesOf(f);
  // Jusqu'a huit echantillons : leurs noms (ENGELHARDT, CARASSI) ; au-dela, leur numero (le premier, le dernier et un sur cinq ecrits)
  if (list.length <= 8) return [...KIT_MODELS.map((m) => KIT_MODEL_LABEL[m]), ...list.map((s) => s.label)];
  const named = (i: number): boolean => i === 0 || i === list.length - 1 || (i + 1) % 5 === 0;
  return [...KIT_MODELS.map((m) => KIT_MODEL_LABEL[m]), ...list.map((_, i) => (named(i) ? String(i + 1) : ''))];
};
export const GATE_LABELS = ['OFF', 'ON'] as const;

/** Les sons d'une famille, un par cran (909, 808, MM, puis ses echantillons) : la liste de l'ecran (state/lcdSamples.ts). */
export const kitSoundNames = (f: KitFamily): string[] => [...KIT_MODELS.map((m) => KIT_MODEL_LABEL[m]), ...samplesOf(f).map((s) => s.label)];
/** Les machines de la couche SYNTH (MACHINE de SRC). */
export const kitMachineNames = (): string[] => KIT_MODELS.map((m) => KIT_MODEL_LABEL[m]);
/** La couche SAMPLE d'une famille : OFF, puis ses echantillons (SAMPLE de SMPL). */
export const kitSampleNames = (f: KitFamily): string[] => ['OFF', ...samplesOf(f).map((s) => s.label)];

/* ---------------- les couches (2026-10-08, l'etape R3) ---------------- */

/**
 * Les reglages de couche d'une famille : syn, le niveau de la couche SYNTH ;
 * lev, celui de la couche SAMPLE (0 a 1, gain au carre : 1 la couche calee,
 * 0 muette) ; tune (-1 a 1, +/-24 demi-tons au demi-ton), fine (-1 a 1, +/-64
 * cents), start, len (0 a 1), rev (0 ou 1) : la page SMPL.
 */
export type LayerParam = 'syn' | 'lev' | 'tune' | 'fine' | 'start' | 'len' | 'rev';
export const LAYER_PARAMS: readonly LayerParam[] = ['syn', 'lev', 'tune', 'fine', 'start', 'len', 'rev'];
export type Layer = Record<LayerParam, number>;
export const LAYER_DEFAULT: Readonly<Layer> = { syn: 1, lev: 1, tune: 0, fine: 0, start: 0, len: 1, rev: 0 };
/** TUNE de la couche SAMPLE : +/-24 demi-tons ; FINE : +/-64 cents. */
export const LAYER_TUNE_ST = 24;
export const LAYER_FINE_CENTS = 64;

/** Le domaine d'un reglage de couche. */
export const layerRange = (p: LayerParam): [number, number] => (p === 'tune' || p === 'fine' ? [-1, 1] : [0, 1]);
/** Ses crans (0 : continu) : TUNE au demi-ton (49), FINE au cent (129), REV OFF / ON. */
export const layerSteps = (p: LayerParam): number => (p === 'tune' ? 2 * LAYER_TUNE_ST + 1 : p === 'fine' ? 2 * LAYER_FINE_CENTS + 1 : p === 'rev' ? 2 : 0);

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Un reglage de couche dans son domaine, a son cran (exact : la valeur telle quelle, une traduction d'un kit d'avant). */
export function clampLayer(p: LayerParam, v: number, exact = false): number {
  if (!Number.isFinite(v)) return LAYER_DEFAULT[p];
  if (p === 'tune') return Math.max(-LAYER_TUNE_ST, Math.min(LAYER_TUNE_ST, Math.round(v * LAYER_TUNE_ST))) / LAYER_TUNE_ST;
  if (p === 'fine') return Math.max(-LAYER_FINE_CENTS, Math.min(LAYER_FINE_CENTS, Math.round(v * LAYER_FINE_CENTS))) / LAYER_FINE_CENTS;
  if (p === 'rev') return v >= 0.5 ? 1 : 0;
  return exact ? clamp01(v) : Math.round(clamp01(v) * 127) / 127;
}

/** La hauteur de la couche SAMPLE en demi-tons (TUNE plus FINE en centiemes). */
export const layerSt = (l: Readonly<Layer>): number => Math.round(l.tune * LAYER_TUNE_ST) + Math.round(l.fine * LAYER_FINE_CENTS) / 100;

function cleanLayer(o: unknown): Layer {
  const out: Layer = { ...LAYER_DEFAULT };
  if (!o || typeof o !== 'object') return out;
  const x = o as Record<string, unknown>;
  for (const p of LAYER_PARAMS) {
    const v = x[p];
    if (typeof v === 'number' && Number.isFinite(v)) out[p] = clampLayer(p, v, true);
  }
  return out;
}

/**
 * Un echantillon retenu qui n'est plus dans le dossier (un nouvel import a
 * renomme ceux de Mika, scripts/import-rytm-samples.mjs) : celui du meme
 * numero (bd/04 ... : le quatrieme), sinon le premier de la famille ;
 * undefined s'il n'y en a aucun (ou pas une cle de cette famille).
 */
export function resolveSample(f: KitFamily, key: unknown): string | undefined {
  if (typeof key !== 'string' || !key) return undefined;
  const hit = sampleByKey(key);
  if (hit) return hit.family === f ? key : undefined;
  if (!key.startsWith(`${f}/`)) return undefined;
  const list = samplesOf(f);
  if (list.length === 0) return undefined;
  const m = /^[a-z]+\/0*(\d+)/i.exec(key);
  const n = m ? Number(m[1]) : 0;
  return (n >= 1 && list[n - 1] ? list[n - 1] : list[0]).key;
}

export interface Kit {
  /** la MACHINE de la couche SYNTH de chaque famille */
  model: Record<KitFamily, KitModel>;
  knob: Record<KitKnob, number>;
  /** l'echantillon de la couche SAMPLE de chaque famille (audio/samples.ts : sa cle) ; absent : OFF */
  sample: Partial<Record<KitFamily, string>>;
  /** les niveaux des deux couches et les reglages de la couche SAMPLE (R3) */
  layer: Record<KitFamily, Layer>;
}

const KNOB_DEFAULT: Readonly<Record<KitKnob, number>> = { tune: 0.5, attack: 0.5, decay: 0.45, drive: 0.25, snappy: 0.5, gate: 0, sweep: 0.5, sdtune: 0.5, sddecay: 0.5, sdtone: 0.5 };
const MODEL_DEFAULT: Readonly<Record<KitFamily, KitModel>> = { bd: '909', sd: 'mm', hh: 'mm', cp: 'mm', tom: 'mm', rs: 'mm' };
/** Les familles que le kit de depart joue en echantillon (2026-10-08, Mika : "change les tout de suite pour BD et SD"). */
const SAMPLE_FIRST: readonly KitFamily[] = ['bd', 'sd'];

function defaultKit(): Kit {
  const layer = Object.fromEntries(KIT_FAMILIES.map((f) => [f, { ...LAYER_DEFAULT }])) as Record<KitFamily, Layer>;
  const sample: Partial<Record<KitFamily, string>> = {};
  for (const f of SAMPLE_FIRST) {
    const first = samplesOf(f)[0];
    if (!first) continue;
    sample[f] = first.key;
    layer[f] = { ...LAYER_DEFAULT, syn: 0 };
  }
  return { model: { ...MODEL_DEFAULT }, knob: { ...KNOB_DEFAULT }, sample, layer };
}

export const KIT_DEFAULT: Readonly<Kit> = defaultKit();

/** Noms sur la plaque, a l'ecran et pour les lecteurs d'ecran. */
export const KIT_LABEL: Readonly<Record<KitId, string>> = {
  bd: 'KICK',
  tune: 'TUNE',
  attack: 'ATTACK',
  decay: 'DECAY',
  drive: 'DRIVE',
  sd: 'SNARE',
  snappy: 'SNAPPY',
  gate: 'GATE',
  hh: 'HATS',
  cp: 'CLAP',
  tom: 'TOMS',
  rs: 'RIM',
  sweep: 'SWEEP',
  sdtune: 'TUNE',
  sddecay: 'DECAY',
  sdtone: 'TONE',
};
export const KIT_ARIA: Readonly<Record<KitId, string>> = {
  bd: 'Kick sound',
  tune: 'Kick tune',
  attack: 'Kick attack',
  decay: 'Kick decay',
  drive: 'Kick drive',
  sd: 'Snare sound',
  snappy: 'Snare snappy',
  gate: 'Gated reverb on the snare and the clap',
  hh: 'Hi-hats sound',
  cp: 'Clap sound',
  tom: 'Toms sound',
  rs: 'Rimshot sound',
  sweep: 'Kick pitch sweep',
  sdtune: 'Snare tune',
  sddecay: 'Snare decay',
  sdtone: 'Snare tone',
};

/** La famille d'un son : ses voix (les charleys ensemble, les deux toms ensemble). */
export const familyOf = (id: ShotId): KitFamily | null => {
  if (id === 'BD') return 'bd';
  if (id === 'SD') return 'sd';
  if (id === 'CH' || id === 'CHopen' || id === 'OH') return 'hh';
  if (id === 'CP') return 'cp';
  if (id === 'TOM' || id === 'HT') return 'tom';
  return null;
};

/** Les sons d'une famille (pour recalculer ceux qui changent). */
export const shotsOf = (f: KitFamily): readonly ShotId[] =>
  f === 'bd' ? ['BD'] : f === 'sd' ? ['SD'] : f === 'hh' ? ['CH', 'CHopen', 'OH'] : f === 'cp' ? ['CP'] : f === 'tom' ? ['TOM', 'HT'] : [];

/**
 * Un potard au 127e depuis R3 (2026-10-08, la valeur a l'ecran est 0 a 127 :
 * chaque cran de molette un vrai changement ; au cinquantieme avant) ; GATE 0
 * ou 1. exact : une valeur lue (un kit retenu, un preset) garde la sienne.
 */
const q = (v: number, id?: KitKnob, exact = false): number => (id === 'gate' ? (v >= 0.5 ? 1 : 0) : exact ? clamp01(v) : Math.round(clamp01(v) * 127) / 127);

/** Le choix de son d'une valeur de commutateur a trois crans (0, 0.5, 1 : un preset d'avant les echantillons). */
export const modelAt = (v: number): KitModel => KIT_MODELS[Math.max(0, Math.min(2, Math.round(v * 2)))];
export const modelValue = (m: KitModel): number => KIT_MODELS.indexOf(m) / 2;

/** Le cran du son d'une famille (le raccourci SOUND) : 0 a 2 les modeles, puis ses echantillons ; la couche SAMPLE d'abord. */
function soundIndex(k: Kit, f: KitFamily): number {
  const key = k.sample[f];
  const j = key ? samplesOf(f).findIndex((x) => x.key === key) : -1;
  return j >= 0 ? KIT_MODELS.length + j : KIT_MODELS.indexOf(k.model[f]);
}
/** Le cran du son d'une famille, pour l'ecran (le choix du moment). */
export const kitSoundIndex = (f: KitFamily): number => soundIndex(state, f);
const soundValue = (k: Kit, f: KitFamily): number => {
  const n = kitSteps(f);
  return n > 1 ? soundIndex(k, f) / (n - 1) : 0;
};
/** Le son choisi d'une famille : 909, 808, mm, ou la cle d'un echantillon. */
export type KitSound = KitModel | string;
const isModel = (s: unknown): s is KitModel => typeof s === 'string' && (KIT_MODELS as readonly string[]).includes(s);

/** Les potards d'avant R3 qui faconnaient le son par defaut d'une famille (le KICK 909, la caisse claire MM). */
const SHAPING: Partial<Record<KitFamily, readonly KitKnob[]>> = { bd: ['tune', 'attack', 'decay', 'drive'], sd: ['snappy'] };
/** Ces potards sont-ils tous a leur depart (un kit d'avant R3 qui n'a jamais regle ce son) ? */
const untouchedKnobs = (kn: Readonly<Record<KitKnob, number>>, f: KitFamily): boolean => (SHAPING[f] ?? []).every((n) => Math.abs(kn[n] - KNOB_DEFAULT[n]) < 1e-6);

const KEY = 'mm.v4.kit.1';
/** La forme retenue : 2 depuis R3 (les couches). */
const KIT_V = 2;

function load(): Kit {
  const k = defaultKit();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return k;
    const o = JSON.parse(raw) as Partial<Kit> & { v?: number };
    for (const f of KIT_FAMILIES) {
      const m = o.model?.[f];
      if (isModel(m)) k.model[f] = m;
    }
    for (const n of KIT_KNOBS) {
      const v = o.knob?.[n];
      if (typeof v === 'number' && Number.isFinite(v)) k.knob[n] = q(v, n, true);
    }
    if (o.v === KIT_V && o.layer) {
      for (const f of KIT_FAMILIES) {
        const l = cleanLayer(o.layer[f]);
        const key = resolveSample(f, o.sample?.[f]);
        if (key) k.sample[f] = key;
        else delete k.sample[f];
        // Plus d'echantillon du tout (le dossier vide) : la synthese reprend, jamais une voix muette sans raison
        if (!key && o.sample?.[f] && l.syn <= 0) l.syn = 1;
        k.layer[f] = l;
      }
      return k;
    }
    // Un kit d'avant R3 : un echantillon choisi devient la couche SAMPLE, TUNE et DECAY du kick d'alors compris ;
    // un modele, la couche SYNTH seule ; le son par defaut d'alors (BD 909, SD MM, sans echantillon) n'etait pas un
    // choix : il prend celui d'aujourd'hui (2026-10-08, Mika : "change les tout de suite pour BD et SD")
    for (const f of KIT_FAMILIES) {
      const key = resolveSample(f, o.sample?.[f]);
      if (key) {
        k.sample[f] = key;
        k.layer[f] = {
          ...LAYER_DEFAULT,
          syn: 0,
          tune: f === 'bd' ? sampleTuneSt(k.knob.tune) / LAYER_TUNE_ST : 0,
          len: f === 'bd' ? lenOfDecay(k.knob.decay) : 1,
        };
        continue;
      }
      // Le defaut d'alors jamais touche : sa machine ET ses potards a leur depart (revue de R3 : un 909 accorde, une
      // MM au SNAPPY regle etaient un choix, ils restent ; leur DRIVE ou leur ATTACK auraient sature le sample de Mika)
      const oldDefault = SAMPLE_FIRST.includes(f) && k.model[f] === MODEL_DEFAULT[f] && untouchedKnobs(k.knob, f);
      if (oldDefault && k.sample[f]) continue;
      delete k.sample[f];
      k.layer[f] = { ...LAYER_DEFAULT };
    }
  } catch {
    /* rien de retenu : le kit de depart */
  }
  return k;
}

let state: Kit = typeof window === 'undefined' ? defaultKit() : load();
const listeners = new Set<(changed: readonly KitFamily[]) => void>();
let saveTimer = 0;

function save(): void {
  if (typeof window === 'undefined') return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ v: KIT_V, ...state }));
    } catch {
      /* stockage plein ou refuse : le kit vit pour la visite */
    }
  }, 300);
}

function emit(changed: readonly KitFamily[]): void {
  save();
  listeners.forEach((fn) => fn(changed));
}

/** Les familles touchees par un reglage (les potards du KICK : le kick ; SNAPPY et ceux de la caisse claire : elle ; GATE : elle et le clap). */
const familiesOf = (id: KitId): readonly KitFamily[] =>
  isFamily(id) ? [id] : id === 'snappy' || id === 'sdtune' || id === 'sddecay' || id === 'sdtone' ? ['sd'] : id === 'gate' ? ['sd', 'cp'] : ['bd'];

/** Des potards du kit pour un coup verrouille (revue de R2, audio/locks.ts) : ceux du moment, sauf ceux du pas. */
export type KitKnobs = Partial<Record<KitKnob, number>>;

/**
 * Ce qu'un pas verrouille change au kit de sa voix (2026-10-08, R2 puis R3,
 * audio/locks.ts) : la MACHINE, des potards, l'echantillon de la couche
 * SAMPLE (une cle de n'importe quelle famille ; null : OFF), des reglages de
 * couche. Rien : le kit du moment.
 */
export interface KitOverride {
  model?: KitModel;
  knobs?: KitKnobs;
  sample?: string | null;
  layer?: Partial<Layer>;
}

/** Ce que joue une famille (null : CY, sans kit : sa synthese seule), un verrou compris. */
interface View {
  model: KitModel;
  knob: Readonly<Record<KitKnob, number>>;
  sample: string | undefined;
  /** la famille de l'echantillon quand ce n'est pas la sienne (un sample lock) */
  from: string | undefined;
  layer: Readonly<Layer>;
}

function viewOf(f: KitFamily | null, ov?: KitOverride | null): View {
  const model = ov?.model ?? (f ? state.model[f] : 'mm');
  const knob = ov?.knobs ? { ...state.knob, ...ov.knobs } : state.knob;
  const sample = ov && ov.sample !== undefined ? (ov.sample ?? undefined) : f ? state.sample[f] : undefined;
  const sf = sample ? sampleByKey(sample)?.family : undefined;
  const from = sf && sf !== f ? sf : undefined;
  const base = f ? state.layer[f] : LAYER_DEFAULT;
  let layer: Readonly<Layer> = ov?.layer ? { ...base, ...ov.layer } : base;
  // Un sample emprunte a une autre famille (un sample lock ; CY, sans famille, n'a que ceux-la) joue seul sur son pas,
  // comme le sample lock de R2 (revue de R3, 2026-10-08 : la cymbale restait dessous, sans moyen de la couper) ; un
  // SYN LEVEL verrouille sur le meme pas remet la synthese avec lui
  if (from && ov?.sample && ov.layer?.syn === undefined) layer = { ...layer, syn: 0 };
  return { model, knob, sample, from, layer };
}

/** Ce que joue une voix (revue de R3) : sa MACHINE, ses deux niveaux, son sample, et quelles couches s'entendent. */
export interface Plays {
  model: KitModel;
  syn: number;
  lev: number;
  sample: string | undefined;
  from: string | undefined;
  synth: boolean;
  smp: boolean;
}
const playsOf = (v: View): Plays => ({ model: v.model, syn: v.layer.syn, lev: v.layer.lev, sample: v.sample, from: v.from, synth: v.layer.syn > 0, smp: !!v.sample && v.layer.lev > 0 });

/** Ce que le calcul d'un son doit savoir d'une vue (les deux couches). */
function tweakOf(v: View): ShotTweak {
  const k = v.knob;
  const L = v.layer;
  const tw: ShotTweak = {
    model: v.model,
    tune: k.tune,
    attack: k.attack,
    decay: k.decay,
    drive: k.drive,
    snappy: k.snappy,
    gate: k.gate >= 0.5,
    sweep: k.sweep,
    sdTune: k.sdtune,
    sdDecay: k.sddecay,
    sdTone: k.sdtone,
  };
  if (L.syn !== 1) tw.syn = L.syn;
  if (v.sample) {
    tw.sample = v.sample;
    const smp: SampleLayer = { lev: L.lev, st: layerSt(L), start: L.start, len: L.len, rev: L.rev >= 0.5, ...(v.from ? { from: v.from } : {}) };
    tw.smp = smp;
  }
  return tw;
}

/** La signature d'une vue de la famille f : seulement ce qui change son calcul (une couche muette n'y compte pas). */
function sigOf(f: KitFamily | null, v: View): string {
  const k = v.knob;
  const L = v.layer;
  const synth = L.syn > 0;
  let s = synth ? v.model : '-';
  if (synth) {
    if (f === 'bd') s += `~${k.tune}~${k.attack}~${k.decay}~${k.drive}~${k.sweep}`;
    else if (f === 'sd') s += `~${k.snappy}~${k.gate}~${k.sdtune}~${k.sddecay}~${k.sdtone}`;
    else if (f === 'cp') s += `~${k.gate}`;
    if (L.syn !== 1) s += `~s${L.syn}`;
  }
  if (v.sample && L.lev > 0) {
    s += `|${v.sample}~${L.lev}~${layerSt(L)}~${L.start}~${L.len}~${L.rev}`;
    // Le caractere de la voix sur l'echantillon (ATTACK et DRIVE du kick, SNAPPY de la caisse claire)
    const sf = v.from ?? f;
    if (sf === 'bd') s += `~${k.attack}~${k.drive}`;
    // GATE passe aussi sur le sample de la caisse claire (revue de R3)
    else if (sf === 'sd') s += `~${k.snappy}~${k.gate}`;
    if (v.from) s += `~${v.from}`;
  }
  return s;
}

const stText = (st: number): string => (st === 0 ? '0 ST' : `${st > 0 ? '+' : ''}${st} ST`);
/** Une frequence : 120 HZ, 2.1 KHZ, 18 KHZ. */
const hzText = (f: number): string => (f < 1000 ? `${Math.round(f)} HZ` : `${f / 1000 < 10 ? (f / 1000).toFixed(1) : Math.round(f / 1000)} KHZ`);
/** Le nom d'un echantillon par sa cle (BLUEPRINT). */
const sampleLabelOf = (key: string | undefined): string => (key ? (sampleByKey(key)?.label ?? 'SAMPLE') : 'OFF');

export const kit = {
  get: (): Readonly<Kit> => state,
  /** Un TWEAK de 0 a 1 (un choix de son : son cran sur la course). */
  value(id: KitId): number {
    return isFamily(id) ? soundValue(state, id) : state.knob[id];
  },
  def(id: KitId): number {
    return isFamily(id) ? soundValue(KIT_DEFAULT, id) : KIT_DEFAULT.knob[id];
  },
  /** Le son d'une famille (le raccourci SOUND) : son echantillon s'il joue, sinon sa machine. */
  sound(f: KitFamily): KitSound {
    return state.sample[f] ?? state.model[f];
  },
  /** Les deux couches jouent-elles (la synthese au-dessus de 0 et un echantillon) ? */
  layered(f: KitFamily): boolean {
    return !!state.sample[f] && state.layer[f].syn > 0 && state.layer[f].lev > 0;
  },
  /** Choisit le son d'une famille (un modele ou la cle d'un echantillon), le raccourci vers une couche ; true s'il change. */
  setSound(f: KitFamily, snd: KitSound): boolean {
    const n = kitSteps(f);
    const i = isModel(snd) ? KIT_MODELS.indexOf(snd) : KIT_MODELS.length + samplesOf(f).findIndex((x) => x.key === snd);
    if (i < 0 || i >= n) return false;
    return kit.set(f, n > 1 ? i / (n - 1) : 0);
  },
  /**
   * Regle un TWEAK ; true s'il change. Un choix de son (SOUND, la plaque,
   * rytm:kit:<famille>) : le raccourci vers UNE couche, a son plein niveau,
   * comme avant R3 : un modele joue seul (la couche SYNTH a 127, plus
   * d'echantillon), un echantillon joue seul (lui a 127, la synthese a 0).
   * Deja ce son, seul : rien ne change.
   */
  set(id: KitId, v: number): boolean {
    if (isFamily(id)) {
      const n = kitSteps(id);
      const i = Math.max(0, Math.min(n - 1, Math.round(clamp01(v) * (n - 1))));
      const l = state.layer[id];
      const alone = i < KIT_MODELS.length ? !state.sample[id] && l.syn === 1 : l.syn === 0 && l.lev === 1;
      if (i === soundIndex(state, id) && alone) return false;
      if (i < KIT_MODELS.length) {
        const sample = { ...state.sample };
        delete sample[id];
        state = { ...state, model: { ...state.model, [id]: KIT_MODELS[i] }, sample, layer: { ...state.layer, [id]: { ...l, syn: 1 } } };
      } else {
        const key = samplesOf(id)[i - KIT_MODELS.length].key;
        state = { ...state, sample: { ...state.sample, [id]: key }, layer: { ...state.layer, [id]: { ...l, syn: 0, lev: 1 } } };
      }
    } else {
      const n = q(v, id);
      if (state.knob[id] === n) return false;
      state = { ...state, knob: { ...state.knob, [id]: n } };
    }
    emit(familiesOf(id));
    return true;
  },
  /** La MACHINE de la couche SYNTH (909, 808, MM) ; true si elle change. La couche SAMPLE et les niveaux restent. */
  setMachine(f: KitFamily, m: KitModel): boolean {
    if (!isModel(m) || state.model[f] === m) return false;
    state = { ...state, model: { ...state.model, [f]: m } };
    emit([f]);
    return true;
  },
  /** L'echantillon de la couche SAMPLE (null : OFF) ; true s'il change. La couche SYNTH reste. */
  setSample(f: KitFamily, key: string | null): boolean {
    const k = key ? resolveSample(f, key) : undefined;
    if (key && !k) return false;
    if ((state.sample[f] ?? null) === (k ?? null)) return false;
    const sample = { ...state.sample };
    if (k) sample[f] = k;
    else delete sample[f];
    state = { ...state, sample };
    emit([f]);
    return true;
  },
  /** Les reglages de couche d'une famille. */
  layerOf(f: KitFamily): Readonly<Layer> {
    return state.layer[f];
  },
  /** Leur depart (le kit de depart : BD et SD a SYNTH 0). */
  layerDef(f: KitFamily, p: LayerParam): number {
    return KIT_DEFAULT.layer[f][p];
  },
  /** Un reglage de couche ; true s'il change. */
  setLayer(f: KitFamily, p: LayerParam, v: number): boolean {
    const n = clampLayer(p, v);
    if (state.layer[f][p] === n) return false;
    state = { ...state, layer: { ...state.layer, [f]: { ...state.layer[f], [p]: n } } };
    emit([f]);
    return true;
  },
  /** Ce que le calcul d'un son doit savoir (MM et reglages neutres pour CY). */
  tweak(id: ShotId): ShotTweak {
    return tweakOf(viewOf(familyOf(id)));
  },
  /** La signature d'un son dans la cle de son echantillon : seulement ce qui le change. */
  sig(id: ShotId): string {
    const f = familyOf(id);
    return sigOf(f, viewOf(f));
  },
  /**
   * Un coup verrouille (2026-10-08, les parameter locks, audio/locks.ts) : ce
   * que le calcul du son id doit savoir avec ce que le pas change (la
   * MACHINE, des potards, l'echantillon, des reglages de couche).
   */
  tweakWith(id: ShotId, ov: KitOverride | null): ShotTweak {
    return tweakOf(viewOf(familyOf(id), ov));
  },
  /** Sa signature (la cle de l'echantillon verrouille). */
  sigWith(id: ShotId, ov: KitOverride | null): string {
    const f = familyOf(id);
    return sigOf(f, viewOf(f, ov));
  },
  /**
   * Ce que joue la voix id (revue de R3, 2026-10-08) : ses deux couches, un
   * verrou de pas compris (kitOverride du pas, audio/drums.ts ; null : le
   * kit du moment). L'en-tete de l'ecran, le pied des couches et les blocs en
   * retrait le lisent : ce qu'ils montrent pendant un LOCK ou un flash est ce
   * que le pas joue.
   */
  playsWith(id: ShotId, ov: KitOverride | null): Plays {
    return playsOf(viewOf(familyOf(id), ov));
  },
  /** Ce qui joue en un mot : BLUEPRINT, 909, 909+BLUEPRINT, SILENT (l'en-tete). */
  playsText(p: Readonly<Plays>): string {
    if (!p.synth && !p.smp) return 'SILENT';
    if (!p.smp) return KIT_MODEL_LABEL[p.model];
    const name = sampleLabelOf(p.sample);
    return p.synth ? `${KIT_MODEL_LABEL[p.model]}+${name}` : name;
  },
  /** Le coup d'une famille avec ce verrou joue-t-il un kick (la synthese, ou un echantillon de kick) ? Le SIDECHAIN du MM-ARP s'y cale. */
  kickWith(ov: KitOverride | null): boolean {
    const v = viewOf('bd', ov);
    return v.layer.syn > 0 || (!!v.sample && !v.from);
  },
  /** Le nom d'un son d'une famille (909, 808, MM, BLUEPRINT), pour l'ecran d'un verrou. */
  soundName(_f: KitFamily, sound: KitSound): string {
    if (isModel(sound)) return KIT_MODEL_LABEL[sound];
    if (sound === 'off') return 'OFF';
    return sampleByKey(sound)?.label ?? String(sound).toUpperCase();
  },
  /** Le nom de l'echantillon de la couche SAMPLE (OFF sans lui). */
  sampleLabel(f: KitFamily): string {
    return sampleLabelOf(state.sample[f]);
  },
  /**
   * La valeur seule d'un TWEAK (sous un potard du telephone) : 909, 52 HZ,
   * 216 MS, 50 ; un choix de son, ce qui joue (909+BLUEPRINT : les deux couches).
   */
  valueText(id: KitId): string {
    // Les deux couches muettes (SYNTH a 0, SAMPLE sur OFF ou a 0) : la voix se tait, l'ecran le dit
    if (isFamily(id)) return kit.playsText(playsOf(viewOf(id)));
    return kit.knobText(id, state.knob[id]);
  },
  /**
   * La valeur d'un potard de la machine a v (un verrou de pas, revue de R2) :
   * 52 HZ, 216 MS, ON, 50 ; ceux de la couche SYNTH lus a sa MACHINE (model :
   * celle d'un verrou).
   */
  knobText(id: KitKnob, v: number, model?: KitModel): string {
    if (id === 'gate') return GATE_LABELS[v >= 0.5 ? 1 : 0];
    if (id === 'tune') return `${Math.round(kickHz(model ?? state.model.bd, v))} HZ`;
    if (id === 'decay') return `${Math.round(kickDecayS(model ?? state.model.bd, v) * 1000)} MS`;
    if (id === 'sweep') return `${Math.log2(1 + KICK_SWEEP[model ?? state.model.bd] * sweepDepth(v)).toFixed(1)} OCT`;
    const sm = model ?? state.model.sd;
    if (id === 'sdtune') return hzText(SD_BODY_HZ[sm] * sdTuneFactor(v));
    if (id === 'sddecay') return `${Math.round(3 * SD_DECAY_S[sm] * sdDecayFactor(v) * 1000)} MS`;
    if (id === 'sdtone') return `HP ${hzText(SD_TONE_HZ[sm] * sdToneFactor(v))}`;
    return `${Math.round(v * 100)}`;
  },
  /** La valeur lisible d'un TWEAK (l'ecran du MM-RYTM). */
  readout(id: KitId): string {
    if (isFamily(id)) return `${KIT_LABEL[id]} ${kit.valueText(id)}`;
    const v = state.knob[id];
    if (id === 'gate') return `SNARE + CLAP GATE ${GATE_LABELS[v >= 0.5 ? 1 : 0]}`;
    if (id === 'tune' || id === 'decay' || id === 'sweep') return `KICK ${KIT_LABEL[id]} ${kit.valueText(id)}`;
    if (id === 'sdtune' || id === 'sddecay' || id === 'sdtone') return `SNARE ${KIT_LABEL[id]} ${kit.valueText(id)}`;
    const label = id === 'snappy' ? 'SNARE SNAPPY' : `KICK ${KIT_LABEL[id]}`;
    return `${label} ${Math.round(v * 100)}`;
  },
  /** Le kit de depart (tests ; un CLEAR du kit) : tout revient, les echantillons de Mika sur BD et SD. */
  reset(): void {
    state = defaultKit();
    emit(KIT_FAMILIES);
  },
  /** Un kit entier (un preset) : un seul changement annonce. */
  replace(next: Kit): void {
    state = {
      model: { ...next.model },
      knob: { ...next.knob },
      sample: { ...next.sample },
      layer: Object.fromEntries(KIT_FAMILIES.map((f) => [f, { ...next.layer[f] }])) as Record<KitFamily, Layer>,
    };
    emit(KIT_FAMILIES);
  },
  subscribe(fn: (changed: readonly KitFamily[]) => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/** Un kit a remplir (un preset) : celui de depart, copie. */
export const kitDefaultCopy = (): Kit => defaultKit();
/** Les valeurs lues d'un kit (un preset) : un potard dans son domaine (exact), un reglage de couche dans le sien. */
export const cleanKnob = (n: KitKnob, v: number): number => q(v, n, true);
export { cleanLayer };
