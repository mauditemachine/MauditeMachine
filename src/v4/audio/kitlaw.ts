/**
 * Les lois du kit du MM-RYTM, PURES (2026-10-30, la V.5.9 : le moteur a 16 pistes, docs/v4/dt2/dt2-master-spec.md 4) :
 * tout ce que audio/kit.ts avait hors de son store (types, labels, familles, couches, potards, la lecture d'un kit
 * retenu, la vue d'un son, son calcul et sa signature), sans etat. Le store des sons est audio/tracks.ts (les 16
 * pistes) ; audio/kit.ts en est la facade (son API d'aujourd'hui) et re-exporte ce module tel quel : aucun import du
 * reste du code ne change. Deplace sans rien reecrire, sauf la vue (viewWith) et la lecture (parseKit), qui prennent
 * en argument ce qu'elles lisaient dans le store.
 *
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
 * famille, la synthese a 0 ; les autres familles leur synthese. OH aussi
 * depuis le 2026-10-18 (Mika : "Le OH par defaut sonne super mal !") : le
 * premier open hat de Mika (public/samples/rytm/oh), la synthese a 0 ; un kit
 * retenu dont l'OH est encore celui d'avant (MM seul, jamais regle) le prend
 * aussi (load, KIT_V 4). Un kit
 * retenu d'avant R3 se traduit au meme son (load) : un echantillon choisi
 * devient la couche SAMPLE (TUNE et DECAY du kick d'alors : son TUNE et son
 * LEN), un modele la couche SYNTH seule ; le son par defaut d'alors (BD 909,
 * SD MM, jamais choisi ni regle : ses potards a leur depart) prend le nouveau
 * defaut. Un sample emprunte a une autre famille par un verrou joue seul sur
 * son pas (revue de R3). Les potards au 127e depuis
 * R3 (au cinquantieme avant : un kit retenu garde ses valeurs exactes).
 *
 * Une famille par voix (2026-10-18, Mika : "un selecteur de sample environ
 * 20 samples dans chacun des voices qui sont en rapport avec les dossiers") :
 * bd, sd, ch, oh, cp, tom, ht, cy. Avant, CH et OH partageaient hh, TOM et
 * HT partageaient tom, CY n'avait pas de famille (un seul son), rs restait
 * d'avant les huit voix. Un kit retenu d'avant (KIT_V 2, ou d'avant R3) se
 * traduit au meme son (foldFamilies, load) : ce que hh avait (MACHINE, sample,
 * couches) va a ch et a oh, ce que tom avait a tom et a ht, rs s'en va ; un
 * sample d'un dossier parti (hh/..., tom/...) laisse la synthese jouer. Les
 * presets (state/presets.ts) et les verrous (audio/locks.ts, snd hh: -> ch:)
 * se lisent avec la meme traduction. Un sample de Mika garde dans ce
 * navigateur (audio/usersamples.ts, cle famille/u:id) se choisit comme un
 * sample du site ; retire pendant qu'une voix le joue, la couche SAMPLE
 * passe sur OFF et la synthese reprend si elle etait a 0.
 */

import { lenOfDecay, sampleTuneSt } from './sampledsp';
import { isUserKey, sampleByKey, samplesOf } from './samples';
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

/** Les familles de voix qui changent de son : une par voix (2026-10-18), dans l'ordre des pads. */
export type KitFamily = 'bd' | 'sd' | 'ch' | 'oh' | 'cp' | 'tom' | 'ht' | 'cy';
/** Les reglages continus de la machine, et GATE (0 ou 1, un commutateur a deux crans). */
export type KitKnob = 'tune' | 'attack' | 'decay' | 'drive' | 'snappy' | 'gate' | 'sweep' | 'sdtune' | 'sddecay' | 'sdtone';
/** Un TWEAK du MM-RYTM : un choix de son ou un potard. */
export type KitId = KitFamily | KitKnob;

export const KIT_FAMILIES: readonly KitFamily[] = ['bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'];
export const KIT_KNOBS: readonly KitKnob[] = ['tune', 'attack', 'decay', 'drive', 'snappy', 'gate', 'sweep', 'sdtune', 'sddecay', 'sdtone'];
/**
 * Les reglages du kit gardes par un preset (state/presets.ts) et cibles MIDI
 * (rytm:kit:<id>), dans leur ordre : les onze cases de l'ancienne plaque
 * TWEAKS (R3 n'en ajoute pas) ; oh, ht et cy (une famille par voix depuis le
 * 2026-10-18) suivent a part (midi/targets.ts).
 */
export const KIT_IDS: readonly KitId[] = ['bd', 'tune', 'attack', 'decay', 'drive', 'sd', 'snappy', 'cp', 'gate', 'ch', 'tom'];
/**
 * La plaque TWEAKS (OPEN) et ses jumeaux, dans leur ordre : les reglages de la
 * machine seulement depuis le 2026-10-18 (Mika : "je veux avoir la selection
 * dans les Sounds ! et d'ailleurs pas dans OPEN") ; le son de chaque voix se
 * choisit a l'ecran (SOUND, page VOICE) et au MIDI (rytm:kit:<famille>).
 */
export const KIT_PLATE_IDS: readonly KitId[] = ['tune', 'attack', 'decay', 'drive', 'snappy', 'gate'];
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

/** Les sons d'une famille, un par cran (909, 808, MM, puis ses echantillons) : les cartes INFOS, le SOUND en P-LOCK d'avant. */
export const kitSoundNames = (f: KitFamily): string[] => [...KIT_MODELS.map((m) => KIT_MODEL_LABEL[m]), ...samplesOf(f).map((s) => s.label)];
/** Les machines de la couche SYNTH (MACHINE de SRC). */
export const kitMachineNames = (): string[] => KIT_MODELS.map((m) => KIT_MODEL_LABEL[m]);
/*
 * La liste unique de SOUND (VOICE, 2026-10-09) : actions.ts voiceSounds (OFF, 909, 808, MM, puis les samples de la
 * famille) ; le navigateur des sons (2026-10-18, state/lcdSamples.ts) la montre entiere.
 */
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
 * undefined s'il n'y en a aucun (ou pas une cle de cette famille). Un sample
 * de Mika garde dans ce navigateur (famille/u:id, audio/usersamples.ts) : sa
 * cle telle quelle s'il est la, undefined s'il est parti (jamais un autre a
 * sa place : ce n'etait pas un numero de dossier).
 */
export function resolveSample(f: KitFamily, key: unknown): string | undefined {
  if (typeof key !== 'string' || !key) return undefined;
  const hit = sampleByKey(key);
  if (hit) return hit.family === f ? key : undefined;
  if (isUserKey(key)) return undefined;
  if (!key.startsWith(`${f}/`)) return undefined;
  // Seulement les samples du site (revue du 2026-10-18) : un sample du site renomme ne prend pas la place d'un sample
  // depose dans ce navigateur
  const list = samplesOf(f).filter((s) => !s.user);
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

export const KNOB_DEFAULT: Readonly<Record<KitKnob, number>> = { tune: 0.5, attack: 0.5, decay: 0.45, drive: 0.25, snappy: 0.5, gate: 0, sweep: 0.5, sdtune: 0.5, sddecay: 0.5, sdtone: 0.5 };
export const MODEL_DEFAULT: Readonly<Record<KitFamily, KitModel>> = { bd: '909', sd: 'mm', ch: 'mm', oh: 'mm', cp: 'mm', tom: 'mm', ht: 'mm', cy: 'mm' };
/**
 * Les familles que le kit de depart joue en echantillon (2026-10-08, Mika : "change les tout de suite pour BD et SD") ;
 * OH depuis le 2026-10-18 (Mika : "Le OH par defaut sonne super mal !") : un vrai open hat de ses projets plutot que la
 * synthese. Sans sample dans le dossier, la famille garde sa synthese (MODEL_DEFAULT).
 */
export const SAMPLE_FIRST: readonly KitFamily[] = ['bd', 'sd', 'oh'];

export function defaultKit(): Kit {
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
  ch: 'CL HAT',
  oh: 'OP HAT',
  cp: 'CLAP',
  tom: 'TOM',
  ht: 'HI TOM',
  cy: 'CYMBAL',
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
  ch: 'Closed hi-hat sound',
  oh: 'Open hi-hat sound',
  cp: 'Clap sound',
  tom: 'Tom sound',
  ht: 'High tom sound',
  cy: 'Cymbal sound',
  sweep: 'Kick pitch sweep',
  sdtune: 'Snare tune',
  sddecay: 'Snare decay',
  sdtone: 'Snare tone',
};

/** La famille d'un son : sa voix (une par voix depuis le 2026-10-18 ; CHopen est le charley ferme qui s'ouvre, avec CH). */
export const familyOf = (id: ShotId): KitFamily | null => {
  if (id === 'BD') return 'bd';
  if (id === 'SD') return 'sd';
  if (id === 'CH' || id === 'CHopen') return 'ch';
  if (id === 'OH') return 'oh';
  if (id === 'CP') return 'cp';
  if (id === 'TOM') return 'tom';
  if (id === 'HT') return 'ht';
  if (id === 'CY') return 'cy';
  return null;
};

/** Les sons d'une famille (pour recalculer ceux qui changent). */
export const shotsOf = (f: KitFamily): readonly ShotId[] =>
  f === 'bd' ? ['BD'] : f === 'sd' ? ['SD'] : f === 'ch' ? ['CH', 'CHopen'] : f === 'oh' ? ['OH'] : f === 'cp' ? ['CP'] : f === 'tom' ? ['TOM'] : f === 'ht' ? ['HT'] : f === 'cy' ? ['CY'] : [];

/**
 * Les familles d'avant le 2026-10-18 et celles qui les remplacent : ce que hh
 * (les deux charleys) avait va a ch et a oh, ce que tom (les deux toms) avait
 * a tom et a ht ; rs (d'avant les huit voix) s'en va, cy n'avait rien.
 */
const OLD_FAMILY: Readonly<Partial<Record<KitFamily, string>>> = { ch: 'hh', oh: 'hh', ht: 'tom' };

/**
 * Un enregistrement par famille lu d'un kit, d'un preset ou d'une empreinte
 * d'avant le 2026-10-18 (model, sample, layer, sounds...), ramene aux
 * familles d'aujourd'hui : une cle deja la gagne, sinon celle de l'ancienne
 * famille ; rien d'autre ne passe. Un enregistrement d'aujourd'hui revient
 * tel quel (sans cle inconnue).
 */
export function foldFamilies<T>(rec: unknown): Partial<Record<KitFamily, T>> {
  const out: Partial<Record<KitFamily, T>> = {};
  if (!rec || typeof rec !== 'object') return out;
  const x = rec as Record<string, T | undefined>;
  for (const f of KIT_FAMILIES) {
    const old = OLD_FAMILY[f];
    const v = x[f] !== undefined ? x[f] : old ? x[old] : undefined;
    if (v !== undefined) out[f] = v;
  }
  return out;
}

/**
 * Un potard au 127e depuis R3 (2026-10-08, la valeur a l'ecran est 0 a 127 :
 * chaque cran de molette un vrai changement ; au cinquantieme avant) ; GATE 0
 * ou 1. exact : une valeur lue (un kit retenu, un preset) garde la sienne.
 */
export const q = (v: number, id?: KitKnob, exact = false): number => (id === 'gate' ? (v >= 0.5 ? 1 : 0) : exact ? clamp01(v) : Math.round(clamp01(v) * 127) / 127);

/** Le choix de son d'une valeur de commutateur a trois crans (0, 0.5, 1 : un preset d'avant les echantillons). */
export const modelAt = (v: number): KitModel => KIT_MODELS[Math.max(0, Math.min(2, Math.round(v * 2)))];
export const modelValue = (m: KitModel): number => KIT_MODELS.indexOf(m) / 2;

/** Le cran du son d'une famille (le raccourci SOUND) : 0 a 2 les modeles, puis ses echantillons ; la couche SAMPLE d'abord. */
export function soundIndex(k: Readonly<Kit>, f: KitFamily): number {
  const key = k.sample[f];
  const j = key ? samplesOf(f).findIndex((x) => x.key === key) : -1;
  return j >= 0 ? KIT_MODELS.length + j : KIT_MODELS.indexOf(k.model[f]);
}
export const soundValue = (k: Readonly<Kit>, f: KitFamily): number => {
  const n = kitSteps(f);
  return n > 1 ? soundIndex(k, f) / (n - 1) : 0;
};
/** Le son choisi d'une famille : 909, 808, mm, ou la cle d'un echantillon. */
export type KitSound = KitModel | string;
export const isModel = (s: unknown): s is KitModel => typeof s === 'string' && (KIT_MODELS as readonly string[]).includes(s);

/** Les potards d'avant R3 qui faconnaient le son par defaut d'une famille (le KICK 909, la caisse claire MM). */
const SHAPING: Partial<Record<KitFamily, readonly KitKnob[]>> = { bd: ['tune', 'attack', 'decay', 'drive'], sd: ['snappy'] };
/** Ces potards sont-ils tous a leur depart (un kit d'avant R3 qui n'a jamais regle ce son) ? */
const untouchedKnobs = (kn: Readonly<Record<KitKnob, number>>, f: KitFamily): boolean => (SHAPING[f] ?? []).every((n) => Math.abs(kn[n] - KNOB_DEFAULT[n]) < 1e-6);

/** La cle du kit retenu (V.5.3 et d'avant) : la V.5.9 la relit (la migration) et la re-ecrit (pistes 1 a 8, le retour arriere). */
export const KIT_KEY = 'mm.v4.kit.1';
/**
 * La forme retenue : 2 depuis R3 (les couches), 3 depuis le 2026-10-18 (une famille par voix) ; une forme 2 se traduit
 * (foldFamilies). 4 depuis le 2026-10-18 aussi (l'OH par defaut devient un sample) : une forme 2 ou 3 dont l'OH est
 * encore le defaut d'alors (oldOh) prend celui d'aujourd'hui.
 */
export const KIT_V = 4;

/**
 * L'OH d'un kit retenu avant le 2026-10-18 est-il encore son defaut d'alors (MM, aucun sample, ses reglages de couche a
 * leur depart) ? Rien ne le distingue d'un MM choisi a la main : comme pour BD et SD le 2026-10-08, le defaut gagne
 * (un MM voulu se rechoisit d'un geste, et c'est le nouveau, audio/shotsdsp.ts openHat).
 */
const oldOh = (model: unknown, sample: unknown, layer: unknown): boolean => {
  if (model !== 'mm' || sample !== undefined) return false;
  const l = cleanLayer(layer);
  return LAYER_PARAMS.every((p) => l[p] === LAYER_DEFAULT[p]);
};

/**
 * Le kit d'un texte retenu sous KIT_KEY (null : rien de retenu, le kit de depart) : le load() d'avant la V.5.9, tel
 * quel (les familles d'avant le 2026-10-18, l'OH d'alors, un kit d'avant R3).
 */
export function parseKit(raw: string | null): Kit {
  const k = defaultKit();
  try {
    if (!raw) return k;
    const o = JSON.parse(raw) as { v?: number; model?: unknown; knob?: Partial<Record<KitKnob, unknown>>; sample?: unknown; layer?: unknown };
    // Les familles d'avant le 2026-10-18 (hh, tom a deux voix, rs) : ce qu'elles avaient passe a leurs voix
    const model = foldFamilies<unknown>(o.model);
    const sample = foldFamilies<unknown>(o.sample);
    const layer = foldFamilies<unknown>(o.layer);
    for (const f of KIT_FAMILIES) {
      const m = model[f];
      if (isModel(m)) k.model[f] = m;
    }
    for (const n of KIT_KNOBS) {
      const v = o.knob?.[n];
      if (typeof v === 'number' && Number.isFinite(v)) k.knob[n] = q(v, n, true);
    }
    if ((o.v === KIT_V || o.v === 3 || o.v === 2) && o.layer && typeof o.layer === 'object') {
      for (const f of KIT_FAMILIES) {
        // L'OH d'avant le 2026-10-18 encore a son defaut (MM seul) : celui d'aujourd'hui, le sample (defaultKit)
        if (f === 'oh' && o.v !== KIT_V && k.sample.oh && oldOh(model.oh, sample.oh, layer.oh)) continue;
        const l = cleanLayer(layer[f]);
        const key = resolveSample(f, sample[f]);
        if (key) k.sample[f] = key;
        else delete k.sample[f];
        // Plus d'echantillon du tout (le dossier vide, un sample de ce navigateur parti, un dossier hh/ ou tom/
        // d'avant) : la synthese reprend, jamais une voix muette sans raison
        if (!key && sample[f] && l.syn <= 0) l.syn = 1;
        k.layer[f] = l;
      }
      return k;
    }
    // Un kit d'avant R3 : un echantillon choisi devient la couche SAMPLE, TUNE et DECAY du kick d'alors compris ;
    // un modele, la couche SYNTH seule ; le son par defaut d'alors (BD 909, SD MM, sans echantillon) n'etait pas un
    // choix : il prend celui d'aujourd'hui (2026-10-08, Mika : "change les tout de suite pour BD et SD")
    for (const f of KIT_FAMILIES) {
      const key = resolveSample(f, sample[f]);
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

/**
 * Le numero du choix de son (2026-10-21, audit RS-3) monte quand ce que joue un son change de nature : son sample, sa
 * MACHINE, une couche qui se tait ou revient ; pas quand un potard tourne. La cle de ce qui compte.
 */
export const choiceKeyOf = (sample: string | undefined, model: KitModel, layer: Readonly<Layer>): string => `${sample ?? ''}|${model}|${layer.syn > 0 ? 1 : 0}|${layer.lev > 0 ? 1 : 0}`;

/** Les familles touchees par un reglage (les potards du KICK : le kick ; SNAPPY et ceux de la caisse claire : elle ; GATE : elle et le clap). */
export const familiesOf = (id: KitId): readonly KitFamily[] =>
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

/**
 * Ce que joue un son avant tout verrou (V.5.9) : sa MACHINE, ses potards, son echantillon, ses couches. Celui d'une
 * famille du kit d'avant (kit.ts : ses potards globaux) ou celui d'une piste (audio/tracks.ts : les siens).
 */
export interface KitBase {
  model: KitModel;
  knob: Readonly<Record<KitKnob, number>>;
  sample: string | undefined;
  layer: Readonly<Layer>;
}

/** Ce que joue un son, un verrou compris. */
export interface KitView {
  model: KitModel;
  knob: Readonly<Record<KitKnob, number>>;
  sample: string | undefined;
  /** la famille de l'echantillon quand ce n'est pas celle du son (un sample lock) */
  from: string | undefined;
  layer: Readonly<Layer>;
}

/**
 * La vue d'un son de la famille f (son moteur) sur sa base, un verrou compris : la vue d'avant la V.5.9 (viewOf), qui
 * lisait le store du kit (state.model[f], state.knob, state.sample[f], state.layer[f]), le meme calcul sur une base.
 */
export function viewWith(base: Readonly<KitBase>, f: KitFamily | null, ov?: KitOverride | null): KitView {
  const model = ov?.model ?? base.model;
  const knob = ov?.knobs ? { ...base.knob, ...ov.knobs } : base.knob;
  const sample = ov && ov.sample !== undefined ? (ov.sample ?? undefined) : base.sample;
  const sf = sample ? sampleByKey(sample)?.family : undefined;
  const from = sf && sf !== f ? sf : undefined;
  let layer: Readonly<Layer> = ov?.layer ? { ...base.layer, ...ov.layer } : base.layer;
  // Un sample emprunte a une autre famille (un sample lock) joue seul sur son pas, comme le sample lock de R2 (revue
  // de R3, 2026-10-08 : la cymbale restait dessous, sans moyen de la couper) ; un SYN LEVEL verrouille sur le meme
  // pas remet la synthese avec lui
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
export const playsOf = (v: KitView): Plays => ({ model: v.model, syn: v.layer.syn, lev: v.layer.lev, sample: v.sample, from: v.from, synth: v.layer.syn > 0, smp: !!v.sample && v.layer.lev > 0 });

/**
 * Le rang de ce que joue une famille dans la liste de SOUND (actions.ts voiceSounds,
 * 2026-10-09) : son sample s'il s'entend (avec ou sans la synthese dessous),
 * sinon sa machine si la synthese s'entend, sinon OFF (0).
 */
export function voiceSoundIndexOf(p: Readonly<Plays>, f: KitFamily): number {
  if (p.smp && p.sample && !p.from) {
    const j = samplesOf(f).findIndex((x) => x.key === p.sample);
    if (j >= 0) return 1 + KIT_MODELS.length + j;
  }
  if (p.synth) return 1 + KIT_MODELS.indexOf(p.model);
  return 0;
}

/**
 * MIX de VOICE SYNTH (2026-10-09) : la part des deux couches, 0 la synthese
 * seule, 1 le sample seul, 0.5 les deux a leur plein ; lu de leurs deux
 * niveaux (le plus fort reste a sa place), ecrit en les deux (mixLevels).
 */
export function mixOf(syn: number, lev: number): number {
  if (syn <= 0 && lev <= 0) return 0.5;
  return syn >= lev ? 0.5 * (lev / syn) : 1 - 0.5 * (syn / lev);
}
/** Les deux niveaux d'un MIX m, le plus fort a S (celui du moment ; 1 si les deux sont a 0). */
export function mixLevels(m: number, S: number): { syn: number; lev: number } {
  const x = Math.max(0, Math.min(1, m));
  const top = S > 0 ? S : 1;
  return { syn: top * Math.min(1, 2 * (1 - x)), lev: top * Math.min(1, 2 * x) };
}

/** Ce que le calcul d'un son doit savoir d'une vue (les deux couches). */
export function tweakOf(v: KitView): ShotTweak {
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
export function sigOf(f: KitFamily | null, v: KitView): string {
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

/** Une vue joue-t-elle un kick (la synthese du kick, ou un echantillon de kick) ? Le SIDECHAIN du MM-ARP s'y cale. */
export const kickOf = (v: KitView): boolean => v.layer.syn > 0 || (!!v.sample && !v.from);

/**
 * Le repli d'un son dont l'echantillon manque (2026-10-21, audit RS-1 et RS-10) : la couche SYNTH de sa voix seule, a
 * son plein niveau, avec ses potards du moment (ou ceux d'un verrou : tw est celui du coup). La meme regle partout :
 * audio/shots.ts en temps reel (un sample en echec, ou en chargement sans son precedent) et hors ligne (makeNow).
 * Sa signature est celle d'une voix qui joue cette machine seule (sigOf) : un repli deja calcule sert aussi a
 * choisir cette machine, et l'inverse.
 */
export function synthFallback(id: ShotId, tw: Readonly<ShotTweak>): { tw: ShotTweak; sig: string } {
  const f = familyOf(id);
  const out: ShotTweak = { ...tw };
  delete out.sample;
  delete out.smp;
  delete out.syn;
  let s: string = tw.model;
  if (f === 'bd') s += `~${tw.tune}~${tw.attack}~${tw.decay}~${tw.drive}~${tw.sweep}`;
  else if (f === 'sd') s += `~${tw.snappy}~${tw.gate ? 1 : 0}~${tw.sdTune}~${tw.sdDecay}~${tw.sdTone}`;
  else if (f === 'cp') s += `~${tw.gate ? 1 : 0}`;
  return { tw: out, sig: s };
}

/** Un coup qui ne fait aucun son (OFF, les deux couches a 0) : rien a calculer ni a jouer a sa place (2026-10-21). */
export const silentTweak = (tw: Readonly<ShotTweak>): boolean => (tw.syn ?? 1) <= 0 && !(tw.sample && (tw.smp?.lev ?? 1) > 0);

/** Une frequence : 120 HZ, 2.1 KHZ, 18 KHZ. */
export const hzText = (f: number): string => (f < 1000 ? `${Math.round(f)} HZ` : `${f / 1000 < 10 ? (f / 1000).toFixed(1) : Math.round(f / 1000)} KHZ`);
/** Le nom d'un echantillon par sa cle (BLUEPRINT). */
export const sampleLabelOf = (key: string | undefined): string => (key ? (sampleByKey(key)?.label ?? 'SAMPLE') : 'OFF');

/** Un kit a remplir (un preset) : celui de depart, copie. */
export const kitDefaultCopy = (): Kit => defaultKit();
/** Les valeurs lues d'un kit (un preset) : un potard dans son domaine (exact), un reglage de couche dans le sien. */
export const cleanKnob = (n: KitKnob, v: number): number => q(v, n, true);
export { cleanLayer };
