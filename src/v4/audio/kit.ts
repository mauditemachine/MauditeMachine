/**
 * Le kit du MM-RYTM (2026-10-04, Mika : "le kick sonne flat.. met un kick
 * de 909 s'il te plait et tweakable comme il faut dans le OPEN de la
 * machine ; sous le capot, a la place des liens, un systeme de Tweaks..
 * genre changement de samples pour les voices"). Les TWEAKS sous le capot
 * (scene/rytmTweaks.ts) reglent ce store :
 * - le son de chaque famille de voix : 909, 808 ou MM (celui d'avant), une
 *   synthese a la facon de chaque machine (audio/shotsdsp.ts), jamais un
 *   echantillon d'une autre : aucun fichier, aucune licence. KICK en 909
 *   par defaut, les autres en MM ;
 * - le KICK : TUNE (sa hauteur), ATTACK (la frappe), DECAY (sa longueur),
 *   DRIVE (sa saturation), pour les trois sons ;
 * - SNAPPY : le timbre de la caisse claire (les trois sons).
 * Les potards vont de 0 a 1, les choix de son aussi (0 : 909, 0.5 : 808,
 * 1 : MM, un commutateur a trois crans). Chaque coup est calcule avec le
 * kit du moment (audio/shots.ts : sa signature fait partie de la cle de
 * l'echantillon) ; un reglage tourne recalcule le son en fond. Retenu
 * dans le navigateur.
 */

import { kickDecayS, kickHz, type KitModel, type ShotId, type ShotTweak } from './shotsdsp';

export type { KitModel, ShotTweak } from './shotsdsp';
export const KIT_MODELS: readonly KitModel[] = ['909', '808', 'mm'];
export const KIT_MODEL_LABEL: Readonly<Record<KitModel, string>> = { '909': '909', '808': '808', mm: 'MM' };

/** Les familles de voix qui changent de son. */
export type KitFamily = 'bd' | 'sd' | 'hh' | 'cp' | 'tom' | 'rs';
/** Les reglages continus. */
export type KitKnob = 'tune' | 'attack' | 'decay' | 'drive' | 'snappy';
/** Un TWEAK du MM-RYTM : un choix de son ou un potard. */
export type KitId = KitFamily | KitKnob;

export const KIT_FAMILIES: readonly KitFamily[] = ['bd', 'sd', 'hh', 'cp', 'tom', 'rs'];
export const KIT_KNOBS: readonly KitKnob[] = ['tune', 'attack', 'decay', 'drive', 'snappy'];
export const KIT_IDS: readonly KitId[] = ['bd', 'tune', 'attack', 'decay', 'drive', 'sd', 'snappy', 'hh', 'cp', 'tom', 'rs'];

export const isFamily = (id: KitId): id is KitFamily => (KIT_FAMILIES as readonly string[]).includes(id);

export interface Kit {
  model: Record<KitFamily, KitModel>;
  knob: Record<KitKnob, number>;
}

export const KIT_DEFAULT: Readonly<Kit> = {
  model: { bd: '909', sd: 'mm', hh: 'mm', cp: 'mm', tom: 'mm', rs: 'mm' },
  knob: { tune: 0.5, attack: 0.5, decay: 0.45, drive: 0.25, snappy: 0.5 },
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
  if (id === 'RS') return 'rs';
  return null;
};

/** Les sons d'une famille (pour recalculer ceux qui changent). */
export const shotsOf = (f: KitFamily): readonly ShotId[] =>
  f === 'bd' ? ['BD'] : f === 'sd' ? ['SD'] : f === 'hh' ? ['CH', 'CHopen', 'OH'] : f === 'cp' ? ['CP'] : f === 'tom' ? ['TOM', 'HT'] : ['RS'];

/** Un potard au cinquantieme : la cle d'un echantillon ne change pas a chaque pixel de glisser. */
const q = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 50) / 50;

/** Le choix de son d'une valeur de commutateur (0, 0.5, 1). */
export const modelAt = (v: number): KitModel => KIT_MODELS[Math.max(0, Math.min(2, Math.round(v * 2)))];
export const modelValue = (m: KitModel): number => KIT_MODELS.indexOf(m) / 2;

const KEY = 'mm.v4.kit.1';

function load(): Kit {
  const k: Kit = { model: { ...KIT_DEFAULT.model }, knob: { ...KIT_DEFAULT.knob } };
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
      if (typeof v === 'number' && Number.isFinite(v)) k.knob[n] = q(v);
    }
  } catch {
    /* rien de retenu : le kit de depart */
  }
  return k;
}

let state: Kit = typeof window === 'undefined' ? { model: { ...KIT_DEFAULT.model }, knob: { ...KIT_DEFAULT.knob } } : load();
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

/** Les familles touchees par un reglage (les potards du KICK : le kick ; SNAPPY : la caisse claire). */
const familiesOf = (id: KitId): readonly KitFamily[] => (isFamily(id) ? [id] : id === 'snappy' ? ['sd'] : ['bd']);

export const kit = {
  get: (): Readonly<Kit> => state,
  /** Un TWEAK de 0 a 1 (un choix de son : 0, 0.5 ou 1). */
  value(id: KitId): number {
    return isFamily(id) ? modelValue(state.model[id]) : state.knob[id];
  },
  def(id: KitId): number {
    return isFamily(id) ? modelValue(KIT_DEFAULT.model[id]) : KIT_DEFAULT.knob[id];
  },
  /** Regle un TWEAK ; true s'il change. */
  set(id: KitId, v: number): boolean {
    if (isFamily(id)) {
      const m = modelAt(v);
      if (state.model[id] === m) return false;
      state = { ...state, model: { ...state.model, [id]: m } };
    } else {
      const n = q(v);
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
    return { model: f ? state.model[f] : 'mm', tune: k.tune, attack: k.attack, decay: k.decay, drive: k.drive, snappy: k.snappy };
  },
  /** La signature d'un son dans la cle de son echantillon : seulement ce qui le change. */
  sig(id: ShotId): string {
    const f = familyOf(id);
    if (!f) return 'mm';
    const m = state.model[f];
    const k = state.knob;
    if (f === 'bd') return `${m}~${k.tune}~${k.attack}~${k.decay}~${k.drive}`;
    if (f === 'sd') return `${m}~${k.snappy}`;
    return m;
  },
  /** La valeur seule d'un TWEAK (sous un potard du telephone) : 909, 52 HZ, 216 MS, 50. */
  valueText(id: KitId): string {
    if (isFamily(id)) return KIT_MODEL_LABEL[state.model[id]];
    const v = state.knob[id];
    if (id === 'tune') return `${Math.round(kickHz(state.model.bd, v))} HZ`;
    if (id === 'decay') return `${Math.round(kickDecayS(state.model.bd, v) * 1000)} MS`;
    return `${Math.round(v * 100)}`;
  },
  /** La valeur lisible d'un TWEAK (l'ecran du MM-RYTM). */
  readout(id: KitId): string {
    if (isFamily(id)) return `${KIT_LABEL[id]} ${KIT_MODEL_LABEL[state.model[id]]}`;
    const v = state.knob[id];
    if (id === 'tune') return `KICK TUNE ${Math.round(kickHz(state.model.bd, v))} HZ`;
    if (id === 'decay') return `KICK DECAY ${Math.round(kickDecayS(state.model.bd, v) * 1000)} MS`;
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
