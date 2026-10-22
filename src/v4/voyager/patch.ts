/**
 * Le nom du son du MM-ARP, en tete du grand ecran (2026-10-08, revue du
 * grand ecran : le nom d'un preset charge y restait apres RANDOM, un potard
 * tourne ou le preset efface, et revenait tel quel a la visite suivante).
 * Le nom suit maintenant ce qui sonne :
 * - un preset charge ou garde (LOADED, SAVED du mode presets) : son nom, et
 *   l'empreinte du son a cet instant (les potards, VOLUME a part, et la
 *   suite d'EDIT ; la progression des pads n'en est pas : elle ne se garde
 *   pas d'une visite a l'autre et CLEAR ne change pas le son) ;
 * - RANDOM : RANDOM et son style (RANDOM ACID), de meme ;
 * - le son s'ecarte de l'empreinte (un potard, une note d'EDIT) : le nom
 *   prend une etoile (DARK DISCO*), comme un patch modifie d'une machine ;
 *   il revient tel quel si le son revient ;
 * - le preset efface : plus de nom ; renomme (NAME) : le nouveau ;
 * - aucun nom et le son de depart (toutes les valeurs de depart, la suite
 *   des potards) : INIT.
 * L'origine (l'id du preset, son nom, l'empreinte) est gardee dans le
 * navigateur avec les potards (eux aussi gardes) : le nom revient a la
 * visite suivante seulement si le son est toujours le meme.
 */

import { presetMode } from '../state/presetMode';
import { presets } from '../state/presets';
import { RETIRED_ON, VOY_KNOB_IDS, chorusStep, foldLegacyKnobs, lfoShapeStep, voyKnob, voyParams, type VoyKnobId } from './params';
import { seq } from './seq';

const KEY = 'mm.v4.voyager.preset';
/**
 * Les potards ajoutes apres l'empreinte (SUB, 2026-10-10) : hors de la liste
 * d'origine, ils ne s'y ajoutent que s'ils quittent leur valeur de depart ;
 * une empreinte gardee avant eux reste donc valable (pas d'etoile pour rien).
 */
const ADDED_IDS: readonly VoyKnobId[] = ['sub', 'subOct', 'subWave'];
/**
 * Les potards ajoutes ensuite (ACC FILTER, 2026-10-21), une seconde rangee marquee 'v2' : elle ne s'ajoute que s'ils
 * quittent leur valeur d'heritage (params.ts legacy : celle d'un son garde avant eux, qui la prend a la lecture) ; une
 * empreinte gardee avant eux reste valable, la rangee des SUB aussi.
 */
const ADDED_V2: readonly VoyKnobId[] = ['accFlt'];
const heir = (id: VoyKnobId): number => voyKnob(id).legacy ?? voyParams.def(id);
/**
 * Les ON des oscillateurs (on1 apres FINE 1, on2 apres FINE 2), retires le 2026-10-11 (Mika : "si on veut pas les osc
 * on coupe les volumes") : l'empreinte garde leur place, a ON (1), la valeur qu'ils ont toujours une fois un son migre
 * (un OFF est devenu le niveau a 0, params.ts migrateKnobs) ; une empreinte gardee avant eux reste valable (read les
 * y ramene : un OFF y devient ON et son niveau 0, comme les potards).
 */
type SigId = VoyKnobId | 'on1' | 'on2';
const RETIRED_AFTER: Readonly<Partial<Record<VoyKnobId, SigId>>> = { fine1: 'on1', fine2: 'on2' };
/** Le niveau de sortie n'est pas le son : VOLUME tourne ne marque pas le patch (RANDOM le garde aussi). */
const SOUND_IDS: readonly SigId[] = VOY_KNOB_IDS.filter((id) => id !== 'volume' && !ADDED_IDS.includes(id) && !ADDED_V2.includes(id)).flatMap((id): SigId[] => {
  const after = RETIRED_AFTER[id];
  return after ? [id, after] : [id];
});
const isRetired = (id: SigId): id is 'on1' | 'on2' => id === 'on1' || id === 'on2';

interface Origin {
  /** l'id du preset (presets.list), null : RANDOM */
  id: string | null;
  name: string;
  sig: string;
}

/**
 * L'empreinte d'un son : ses potards (un absent : sa valeur de depart ; un ON d'avant plie dans son niveau, le CHORUS
 * continu d'avant le 2026-10-12 a son mode) et sa suite d'EDIT.
 */
function sigOf(raw: Partial<Record<VoyKnobId, number>>, s: { edit: boolean; len: number; buf: readonly unknown[] }): string {
  const v = foldLegacyKnobs(raw) as Partial<Record<VoyKnobId, number>>;
  const at = (id: VoyKnobId): number => v[id] ?? voyParams.def(id);
  const sound = (id: SigId): number => (isRetired(id) ? 1 : at(id));
  const added = ADDED_IDS.some((id) => at(id) !== voyParams.def(id)) ? [ADDED_IDS.map(at)] : [];
  const added2 = ADDED_V2.some((id) => at(id) !== heir(id)) ? [['v2', ...ADDED_V2.map(at)]] : [];
  return JSON.stringify([SOUND_IDS.map(sound), s.edit ? [s.len, s.buf] : 0, ...added, ...added2]);
}

/**
 * Une empreinte gardee avant le 2026-10-11 (ses ON a leur place) : un oscillateur coupe (ON a 0) y devient ON et son
 * niveau 0, comme ses potards a la lecture ; le meme son, la meme empreinte (pas d'etoile pour rien). Le CHORUS
 * continu d'avant le 2026-10-12 : son mode (params.ts chorusStep), comme a la lecture des potards. SHAPE sur quatre
 * crans d'avant le 2026-10-18 : sur ses cinq (params.ts lfoShapeStep).
 */
const CHORUS_AT = SOUND_IDS.indexOf('chorus');
const SHAPE_AT = SOUND_IDS.indexOf('lfoShape');
function migrateSig(sig: string): string {
  try {
    const a = JSON.parse(sig) as unknown[];
    const knobs = Array.isArray(a) ? a[0] : null;
    if (!Array.isArray(knobs) || knobs.length !== SOUND_IDS.length) return sig;
    let moved = false;
    for (const [on, osc] of RETIRED_ON) {
      const i = SOUND_IDS.indexOf(on as SigId);
      const j = SOUND_IDS.indexOf(osc);
      if (i < 0 || j < 0 || typeof knobs[i] !== 'number' || knobs[i] >= 0.5) continue;
      knobs[i] = 1;
      knobs[j] = 0;
      moved = true;
    }
    const c = knobs[CHORUS_AT];
    if (CHORUS_AT >= 0 && typeof c === 'number' && chorusStep(c) !== c) {
      knobs[CHORUS_AT] = chorusStep(c);
      moved = true;
    }
    // SHAPE sur quatre crans d'avant le 2026-10-18 (RND au milieu) : la meme forme sur ses cinq
    const s = knobs[SHAPE_AT];
    if (SHAPE_AT >= 0 && typeof s === 'number' && lfoShapeStep(s) !== s) {
      knobs[SHAPE_AT] = lfoShapeStep(s);
      moved = true;
    }
    return moved ? JSON.stringify(a) : sig;
  } catch {
    return sig;
  }
}

/** L'empreinte du son tel qu'il est. */
const sigNow = (): string => sigOf(voyParams.get(), seq.get());

/**
 * L'empreinte du son de depart (INIT) ; celui d'un navigateur d'avant ACC FILTER (2026-10-21, son heritage) aussi.
 */
const INIT_KNOBS = Object.fromEntries(VOY_KNOB_IDS.map((id) => [id, voyParams.def(id)])) as Record<VoyKnobId, number>;
const NO_EDIT = { edit: false, len: 0, buf: [] as readonly unknown[] };
const INIT_SIGS: readonly string[] = [sigOf(INIT_KNOBS, NO_EDIT), sigOf({ ...INIT_KNOBS, ...Object.fromEntries(ADDED_V2.map((id) => [id, heir(id)])) }, NO_EDIT)];
const isInit = (sig: string): boolean => INIT_SIGS.includes(sig);

function read(): Origin | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<Origin> | null;
    if (!raw || typeof raw.name !== 'string' || typeof raw.sig !== 'string') return null;
    return { id: typeof raw.id === 'string' ? raw.id : null, name: raw.name, sig: migrateSig(raw.sig) };
  } catch {
    return null;
  }
}

let origin: Origin | null = typeof window === 'undefined' ? null : read();
let cache: string | null = null;
const listeners = new Set<() => void>();

function remember(next: Origin): void {
  origin = next;
  cache = null;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* stockage plein ou bloque : le nom reste pour la visite */
  }
  listeners.forEach((fn) => fn());
}

/**
 * Le son revenu tel quel a un preset (un UNDO, 2026-10-11 : le nom restait sur l'ancien, avec son etoile) : il
 * devient l'origine, apres le dessin (remember previent l'ecran).
 */
function matchPreset(now: string): string | null {
  const p = presets.list('voy').find((x) => {
    const d = x.data as { knobs?: Partial<Record<VoyKnobId, number>>; seq?: { edit: boolean; len: number; buf: readonly unknown[] } };
    return !!d.knobs && !!d.seq && sigOf(d.knobs, d.seq) === now;
  });
  if (!p) return null;
  const name = p.name.toUpperCase();
  queueMicrotask(() => {
    if (sigNow() === now) remember({ id: p.id, name, sig: now });
  });
  return name;
}

function compute(): string {
  const now = sigNow();
  if (origin) {
    let name = origin.name;
    if (origin.id !== null) {
      const id = origin.id;
      const p = presets.list('voy').find((x) => x.id === id);
      // Le preset efface : son nom part avec lui
      if (p) name = p.name.toUpperCase();
      else return matchPreset(now) ?? (isInit(now) ? 'INIT' : '');
    }
    return now === origin.sig ? name : (matchPreset(now) ?? `${name}*`);
  }
  return matchPreset(now) ?? (isInit(now) ? 'INIT' : '');
}

// Ce qui change le nom : les potards, la suite, la liste des presets (NAME, DEL)
const dirty = (): void => {
  cache = null;
};
voyParams.subscribe(dirty);
seq.subscribe(dirty);
presets.subscribe(dirty);

// LOADED ou SAVED (state/presetMode.ts) : le preset montre est ce qui sonne. Un seul releve par chargement :
// la note qui arrive, ou un autre preset sous la meme note (NEXT deux fois de suite) ; NAME ou DEL? sous la
// note ne refont pas l'empreinte (un potard tourne entre-temps garderait son etoile)
let lastNote = '';
presetMode.subscribe(() => {
  const st = presetMode.get();
  const note = st.machine === 'voy' ? st.note : '';
  const fresh = note !== lastNote;
  lastNote = note;
  if (note !== 'LOADED' && note !== 'SAVED') return;
  const list = presets.list('voy');
  const p = list[Math.min(st.index, list.length - 1)];
  if (!p) return;
  if (fresh || !origin || origin.id !== p.id) remember({ id: p.id, name: p.name.toUpperCase(), sig: sigNow() });
});

export const voyPatch = {
  /** Le nom a montrer : DARK DISCO, DARK DISCO*, RANDOM ACID, INIT, '' (rien). */
  label(): string {
    if (cache === null) cache = compute();
    return cache;
  },
  /** RANDOM vient de poser tout le patch : son style devient le nom. */
  random(style: string): void {
    remember({ id: null, name: `RANDOM ${style}`, sig: sigNow() });
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
