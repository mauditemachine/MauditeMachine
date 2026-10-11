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
import { VOY_KNOB_IDS, voyParams, type VoyKnobId } from './params';
import { seq } from './seq';

const KEY = 'mm.v4.voyager.preset';
/**
 * Les potards ajoutes apres l'empreinte (SUB, 2026-10-10) : hors de la liste
 * d'origine, ils ne s'y ajoutent que s'ils quittent leur valeur de depart ;
 * une empreinte gardee avant eux reste donc valable (pas d'etoile pour rien).
 */
const ADDED_IDS: readonly VoyKnobId[] = ['sub', 'subOct', 'subWave'];
/** Le niveau de sortie n'est pas le son : VOLUME tourne ne marque pas le patch (RANDOM le garde aussi). */
const SOUND_IDS = VOY_KNOB_IDS.filter((id) => id !== 'volume' && !ADDED_IDS.includes(id));

interface Origin {
  /** l'id du preset (presets.list), null : RANDOM */
  id: string | null;
  name: string;
  sig: string;
}

/** L'empreinte d'un son : ses potards (un absent : sa valeur de depart) et sa suite d'EDIT. */
function sigOf(v: Partial<Record<VoyKnobId, number>>, s: { edit: boolean; len: number; buf: readonly unknown[] }): string {
  const at = (id: VoyKnobId): number => v[id] ?? voyParams.def(id);
  const added = ADDED_IDS.some((id) => at(id) !== voyParams.def(id)) ? [ADDED_IDS.map(at)] : [];
  return JSON.stringify([SOUND_IDS.map(at), s.edit ? [s.len, s.buf] : 0, ...added]);
}

/** L'empreinte du son tel qu'il est. */
const sigNow = (): string => sigOf(voyParams.get(), seq.get());

/** L'empreinte du son de depart (INIT). */
const INIT_SIG = JSON.stringify([SOUND_IDS.map((id) => voyParams.def(id)), 0]);

function read(): Origin | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<Origin> | null;
    if (!raw || typeof raw.name !== 'string' || typeof raw.sig !== 'string') return null;
    return { id: typeof raw.id === 'string' ? raw.id : null, name: raw.name, sig: raw.sig };
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
      else return matchPreset(now) ?? (now === INIT_SIG ? 'INIT' : '');
    }
    return now === origin.sig ? name : (matchPreset(now) ?? `${name}*`);
  }
  return matchPreset(now) ?? (now === INIT_SIG ? 'INIT' : '');
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
