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
 * Les potards vont de 0 a 1, les choix de son aussi (un commutateur a
 * crans : 909, 808, MM, puis les echantillons de la famille ; sans
 * echantillon 0 : 909, 0.5 : 808, 1 : MM). Chaque coup est calcule avec le
 * kit du moment (audio/shots.ts : sa signature fait partie de la cle de
 * l'echantillon) ; un reglage tourne recalcule le son en fond. Retenu
 * dans le navigateur.
 */

import { sampleDecayPart, sampleTuneSt } from './sampledsp';
import { sampleByKey, samplesOf } from './samples';
import { kickDecayS, kickHz, type KitModel, type ShotId, type ShotTweak } from './shotsdsp';

export type { KitModel, ShotTweak } from './shotsdsp';
export const KIT_MODELS: readonly KitModel[] = ['909', '808', 'mm'];
export const KIT_MODEL_LABEL: Readonly<Record<KitModel, string>> = { '909': '909', '808': '808', mm: 'MM' };

/** Les familles de voix qui changent de son. */
export type KitFamily = 'bd' | 'sd' | 'hh' | 'cp' | 'tom' | 'rs';
/** Les reglages continus, et GATE (0 ou 1, un commutateur a deux crans). */
export type KitKnob = 'tune' | 'attack' | 'decay' | 'drive' | 'snappy' | 'gate';
/** Un TWEAK du MM-RYTM : un choix de son ou un potard. */
export type KitId = KitFamily | KitKnob;

export const KIT_FAMILIES: readonly KitFamily[] = ['bd', 'sd', 'hh', 'cp', 'tom', 'rs'];
export const KIT_KNOBS: readonly KitKnob[] = ['tune', 'attack', 'decay', 'drive', 'snappy', 'gate'];
// Plus de RIM depuis le 2026-10-05 (huit voix, plus de RS) : la famille reste pour les anciens reglages, sans potard
export const KIT_IDS: readonly KitId[] = ['bd', 'tune', 'attack', 'decay', 'drive', 'sd', 'snappy', 'cp', 'gate', 'hh', 'tom'];

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

export interface Kit {
  model: Record<KitFamily, KitModel>;
  knob: Record<KitKnob, number>;
  /** l'echantillon joue par une famille (audio/samples.ts : sa cle), a la place de son modele */
  sample: Partial<Record<KitFamily, string>>;
}

export const KIT_DEFAULT: Readonly<Kit> = {
  model: { bd: '909', sd: 'mm', hh: 'mm', cp: 'mm', tom: 'mm', rs: 'mm' },
  knob: { tune: 0.5, attack: 0.5, decay: 0.45, drive: 0.25, snappy: 0.5, gate: 0 },
  sample: {},
};

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

/** Un potard au cinquantieme : la cle d'un echantillon ne change pas a chaque pixel de glisser ; GATE 0 ou 1. */
const q = (v: number, id?: KitKnob): number => (id === 'gate' ? (v >= 0.5 ? 1 : 0) : Math.round(Math.min(1, Math.max(0, v)) * 50) / 50);

/** Le choix de son d'une valeur de commutateur a trois crans (0, 0.5, 1 : un preset d'avant les echantillons). */
export const modelAt = (v: number): KitModel => KIT_MODELS[Math.max(0, Math.min(2, Math.round(v * 2)))];
export const modelValue = (m: KitModel): number => KIT_MODELS.indexOf(m) / 2;

/** Le cran du son d'une famille : 0 a 2 les modeles, puis ses echantillons. */
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

const KEY = 'mm.v4.kit.1';

function load(): Kit {
  const k: Kit = { model: { ...KIT_DEFAULT.model }, knob: { ...KIT_DEFAULT.knob }, sample: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return k;
    const o = JSON.parse(raw) as Partial<Kit>;
    for (const f of KIT_FAMILIES) {
      const m = o.model?.[f];
      if (m && (KIT_MODELS as readonly string[]).includes(m)) k.model[f] = m;
    }
    for (const n of KIT_KNOBS) {
      const v = o.knob?.[n];
      if (typeof v === 'number' && Number.isFinite(v)) k.knob[n] = q(v, n);
    }
    // Un echantillon retenu qui n'est plus dans le dossier : la famille garde son modele
    for (const f of KIT_FAMILIES) {
      const key = o.sample?.[f];
      if (typeof key === 'string' && sampleByKey(key)?.family === f) k.sample[f] = key;
    }
  } catch {
    /* rien de retenu : le kit de depart */
  }
  return k;
}

let state: Kit = typeof window === 'undefined' ? { model: { ...KIT_DEFAULT.model }, knob: { ...KIT_DEFAULT.knob }, sample: {} } : load();
const listeners = new Set<(changed: readonly KitFamily[]) => void>();
let saveTimer = 0;

function save(): void {
  if (typeof window === 'undefined') return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* stockage plein ou refuse : le kit vit pour la visite */
    }
  }, 300);
}

/** Les familles touchees par un reglage (les potards du KICK : le kick ; SNAPPY : la caisse claire ; GATE : elle et le clap). */
const familiesOf = (id: KitId): readonly KitFamily[] => (isFamily(id) ? [id] : id === 'snappy' ? ['sd'] : id === 'gate' ? ['sd', 'cp'] : ['bd']);

/** Des potards du kit pour un coup verrouille (revue de R2, audio/locks.ts) : ceux du moment, sauf ceux du pas. */
export type KitKnobs = Partial<Record<KitKnob, number>>;
const knobsWith = (kn?: KitKnobs | null): Record<KitKnob, number> => (kn ? { ...state.knob, ...kn } : state.knob);

/** La signature d'un son de la famille f qui joue m (un modele ou un echantillon), les potards du kit du moment. */
function sigOf(f: KitFamily, m: KitSound, k: Readonly<Record<KitKnob, number>> = state.knob): string {
  if (f === 'bd') return `${m}~${k.tune}~${k.attack}~${k.decay}~${k.drive}`;
  if (f === 'sd') return `${m}~${k.snappy}~${k.gate}`;
  if (f === 'cp') return `${m}~${k.gate}`;
  return m;
}

const stText = (st: number): string => (st === 0 ? '0 ST' : `${st > 0 ? '+' : ''}${st} ST`);
/** Le nom du son d'une famille : 909, 808, MM, ou celui de son echantillon (BLUEPRINT F). */
function soundLabel(f: KitFamily): string {
  const key = state.sample[f];
  const smp = key ? sampleByKey(key) : undefined;
  return smp ? smp.label : KIT_MODEL_LABEL[state.model[f]];
}

export const kit = {
  get: (): Readonly<Kit> => state,
  /** Un TWEAK de 0 a 1 (un choix de son : son cran sur la course). */
  value(id: KitId): number {
    return isFamily(id) ? soundValue(state, id) : state.knob[id];
  },
  def(id: KitId): number {
    return isFamily(id) ? soundValue(KIT_DEFAULT, id) : KIT_DEFAULT.knob[id];
  },
  /** Le son d'une famille : son modele, ou la cle de son echantillon. */
  sound(f: KitFamily): KitSound {
    return state.sample[f] ?? state.model[f];
  },
  /** Choisit le son d'une famille (un modele ou la cle d'un echantillon) ; true s'il change. */
  setSound(f: KitFamily, snd: KitSound): boolean {
    const n = kitSteps(f);
    const i = (KIT_MODELS as readonly string[]).includes(snd) ? KIT_MODELS.indexOf(snd as KitModel) : KIT_MODELS.length + samplesOf(f).findIndex((x) => x.key === snd);
    if (i < 0 || i >= n) return false;
    return kit.set(f, n > 1 ? i / (n - 1) : 0);
  },
  /** Regle un TWEAK ; true s'il change. */
  set(id: KitId, v: number): boolean {
    if (isFamily(id)) {
      const n = kitSteps(id);
      const i = Math.max(0, Math.min(n - 1, Math.round(Math.min(1, Math.max(0, v)) * (n - 1))));
      if (i === soundIndex(state, id)) return false;
      if (i < KIT_MODELS.length) {
        const sample = { ...state.sample };
        delete sample[id];
        state = { ...state, model: { ...state.model, [id]: KIT_MODELS[i] }, sample };
      } else state = { ...state, sample: { ...state.sample, [id]: samplesOf(id)[i - KIT_MODELS.length].key } };
    } else {
      const n = q(v, id);
      if (state.knob[id] === n) return false;
      state = { ...state, knob: { ...state.knob, [id]: n } };
    }
    save();
    const changed = familiesOf(id);
    listeners.forEach((fn) => fn(changed));
    return true;
  },
  /** Ce que le calcul d'un son doit savoir (MM et reglages neutres pour CY et PC). */
  tweak(id: ShotId): ShotTweak {
    const f = familyOf(id);
    const k = state.knob;
    const sample = f ? state.sample[f] : undefined;
    return { model: f ? state.model[f] : 'mm', tune: k.tune, attack: k.attack, decay: k.decay, drive: k.drive, snappy: k.snappy, gate: k.gate >= 0.5, ...(sample ? { sample } : {}) };
  },
  /** La signature d'un son dans la cle de son echantillon : seulement ce qui le change. */
  sig(id: ShotId): string {
    const f = familyOf(id);
    if (!f) return 'mm';
    return sigOf(f, state.sample[f] ?? state.model[f]);
  },
  /**
   * Un son verrouille (2026-10-08, le sample lock d'un pas, audio/locks.ts) :
   * ce que le calcul du son id doit savoir s'il joue `sound` (un modele ou la
   * cle d'un echantillon de sa famille) au lieu du son du kit ; les potards
   * du kit restent ceux du moment.
   */
  tweakWith(id: ShotId, sound: KitSound, kn?: KitKnobs | null): ShotTweak {
    const f = familyOf(id);
    // Les potards verrouilles du pas (revue de R2) a la place de ceux du kit
    const k = knobsWith(kn);
    const isModel = (KIT_MODELS as readonly string[]).includes(sound);
    const model: KitModel = isModel ? (sound as KitModel) : f ? state.model[f] : 'mm';
    return { model, tune: k.tune, attack: k.attack, decay: k.decay, drive: k.drive, snappy: k.snappy, gate: k.gate >= 0.5, ...(!isModel && f ? { sample: sound } : {}) };
  },
  /** Sa signature (la cle de l'echantillon verrouille). */
  sigWith(id: ShotId, sound: KitSound, kn?: KitKnobs | null): string {
    const f = familyOf(id);
    return f ? sigOf(f, sound, knobsWith(kn)) : 'mm';
  },
  /** Le nom d'un son d'une famille (909, 808, MM, BLUEPRINT), pour l'ecran d'un verrou. */
  soundName(f: KitFamily, sound: KitSound): string {
    if ((KIT_MODELS as readonly string[]).includes(sound)) return KIT_MODEL_LABEL[sound as KitModel];
    return sampleByKey(sound)?.label ?? String(sound).toUpperCase();
  },
  /** La valeur seule d'un TWEAK (sous un potard du telephone) : 909, 52 HZ, 216 MS, 50. */
  valueText(id: KitId): string {
    if (isFamily(id)) return soundLabel(id);
    return kit.knobText(id, state.knob[id]);
  },
  /** La valeur d'un potard du kit a v (un verrou de pas, revue de R2) : 52 HZ, 216 MS, ON, 50. */
  knobText(id: KitKnob, v: number): string {
    if (id === 'gate') return GATE_LABELS[v >= 0.5 ? 1 : 0];
    // Un echantillon au kick : TUNE en demi-tons, DECAY en part de sa longueur
    if (id === 'tune') return state.sample.bd ? stText(sampleTuneSt(v)) : `${Math.round(kickHz(state.model.bd, v))} HZ`;
    if (id === 'decay') return state.sample.bd ? `${Math.round(sampleDecayPart(v) * 100)}%` : `${Math.round(kickDecayS(state.model.bd, v) * 1000)} MS`;
    return `${Math.round(v * 100)}`;
  },
  /** La valeur lisible d'un TWEAK (l'ecran du MM-RYTM). */
  readout(id: KitId): string {
    if (isFamily(id)) return `${KIT_LABEL[id]} ${soundLabel(id)}`;
    const v = state.knob[id];
    if (id === 'gate') return `SNARE + CLAP GATE ${GATE_LABELS[v >= 0.5 ? 1 : 0]}`;
    if (id === 'tune') return `KICK TUNE ${kit.valueText('tune')}`;
    if (id === 'decay') return `KICK DECAY ${kit.valueText('decay')}`;
    const label = id === 'snappy' ? 'SNARE SNAPPY' : `KICK ${KIT_LABEL[id]}`;
    return `${label} ${Math.round(v * 100)}`;
  },
  subscribe(fn: (changed: readonly KitFamily[]) => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
