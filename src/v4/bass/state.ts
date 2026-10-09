/**
 * L'etat du MM-BASS (2026-10-07) : la suite de seize pas, facon TB-303 et
 * Elektron. Un pas est vide, une note (un degre de la gamme, une octave en
 * plus, ACCENT, SLIDE) ou une liaison (TIE : la note d'avant continue,
 * comme le mode TIME de la 303). SLIDE sur un pas : sa note glisse vers la
 * suivante sans se relacher. Le pas choisi (le dernier touche) recoit
 * ACCENT, SLIDE, NOTE - +, OCT - +. Retenu sous mm.v4.bass.state.
 *
 * Les verrous (2026-10-07, Mika : "des boutons au-dessus de chaque step ;
 * quand j'appuie sur ce bouton, je peux parametrer tout ce que je veux sur
 * CE step uniquement, et les parametres changent au passage de ce step") :
 * les parameter locks des Elektron. Un pas garde ses valeurs des potards du
 * son (locks) ; lock : le pas dont on regle les verrous (-1 : aucun), les
 * potards du son ne changent alors que lui.
 */

import type { BassKnobId } from './params';
import { generate } from './gen';

export type BassStepKind = 'off' | 'note' | 'tie';

export interface BassStep {
  kind: BassStepKind;
  /** le degre dans la gamme (0 : la tonique ; au-dela de la gamme : l'octave suivante) */
  deg: number;
  /** octaves en plus (-1 a +2) */
  oct: number;
  acc: boolean;
  slide: boolean;
  /** les valeurs verrouillees de ce pas (0 a 1), absentes : celles des potards */
  locks?: BassLocks;
  /**
   * qui a ecrit ce pas (2026-10-09, STYLE et DENSITY qui agissent vraiment, bass/gen.ts) : gen, le generateur (STYLE et
   * DENSITY le reecrivent) ; hand, la main (une tape, un glisser, ACCENT, SLIDE, NOTE, OCT, MUTATE : ils n'y touchent
   * plus) ; absent (une ligne d'avant, une ligne d'usine) : une note ou une liaison est a la main, un vide est libre
   */
  src?: 'gen' | 'hand';
}

/**
 * La recette d'une ligne (2026-10-09, Mika : "je ne vois pas ce que STYLE et DENSITY font") : sa graine, d'ou STYLE et
 * DENSITY reecrivent les pas du generateur a chaque cran (bass/gen.ts regenerate) ; base : null pour une ligne de GEN
 * (DENSITY la regle toute), sinon la DENSITY a laquelle la ligne est telle qu'on l'a ecrite (une ligne d'usine, une ligne
 * a la main : au-dessus, des notes generees s'ajoutent autour des tiennes) ; gen : les regles du generateur au dernier
 * calcul (STYLE, DENSITY, SLIDE PROB, ACC PROB, RANGE, de 0 a 1). Gardee avec la ligne (ici, dans les patterns, dans
 * les presets).
 */
export interface BassRecipe {
  seed: number;
  base: number | null;
  gen?: { style: number; density: number; slides: number; accents: number; range: number };
}

export const BASS_STEPS = 16;

/**
 * Les potards du son qu'un pas peut verrouiller (pas ceux du generateur, ni OCTAVE) ; LENGTH aussi (2026-10-08, la longueur de la note du pas).
 * La machine Elektron (2026-10-08, Mika : "on tourne un encodeur sur ce step et donc ce step a une valeur differente") : tout
 * le son de chaque page se verrouille, les crans compris (SUB OCT) ; restent globaux OCTAVE (le pas a son OCT) et les
 * reglages des effets eux-memes (DLY TIME, DLY FB, REV SIZE, REV TONE : une seule unite par effet, comme une Elektron).
 */
export type BassLockId =
  | 'cutoff'
  | 'reso'
  | 'envmod'
  | 'decay'
  | 'accent'
  | 'wave'
  | 'sub'
  | 'drive'
  | 'glide'
  | 'volume'
  | 'length'
  | 'accdecay'
  | 'sweep'
  | 'keytrack'
  | 'pw'
  | 'suboct'
  | 'tune'
  | 'attack'
  | 'adecay'
  | 'sustain'
  | 'release'
  | 'delay'
  | 'reverb';
export const BASS_LOCKABLE: readonly BassLockId[] = ['cutoff', 'reso', 'envmod', 'decay', 'accent', 'wave', 'sub', 'drive', 'glide', 'volume', 'length', 'accdecay', 'sweep', 'keytrack', 'pw', 'suboct', 'tune', 'attack', 'adecay', 'sustain', 'release', 'delay', 'reverb'];
export const isLockable = (id: string): id is BassLockId => (BASS_LOCKABLE as readonly string[]).includes(id);
export type BassLocks = Partial<Record<BassLockId, number>>;

export interface BassState {
  steps: readonly BassStep[];
  /** le pas choisi (0 a 15) */
  sel: number;
  running: boolean;
  /** la ligne de message de l'ecran */
  message: string | null;
  /** un numero par suite generee (l'ecran fait son petit effet) */
  gen: number;
  /** le pas dont on regle les verrous (-1 : aucun) */
  lock: number;
  /**
   * le dernier potard tourne et quand (performance.now) : l'ecran le montre un instant, facon Elektron (2026-10-08) ;
   * enc (2026-10-09) : tourne par un encodeur de la face (les FX globaux), l'ecran le montre dans une bulle sans quitter
   * la page ; before : la ligne d'avant un cran de STYLE ou de DENSITY (l'echo montre les pas ajoutes et retires)
   */
  touched: { id: BassKnobId; at: number; enc?: number; before?: readonly BassStep[] } | null;
  /** la recette de la ligne (null : une ligne sans graine, d'avant le 2026-10-09 ; le premier cran de STYLE ou DENSITY en donne une) */
  recipe: BassRecipe | null;
}

const KEY = 'mm.v4.bass.state';
/** La recette de la ligne (2026-10-09), a part : une sauvegarde d'avant (la suite seule sous KEY) se lit toujours. */
const RECIPE_KEY = 'mm.v4.bass.recipe';
const off = (): BassStep => ({ kind: 'off', deg: 0, oct: 0, acc: false, slide: false });

/**
 * La ligne de depart d'une premiere visite (2026-10-09) : une ligne acid du generateur (sa graine, les reglages de
 * depart des potards : ACID, DENSITY 60, SLIDE PROB 30, ACC PROB 35, deux octaves, la gamme mineure), chaque pas a lui :
 * STYLE et DENSITY la reecrivent des le premier cran, dans les deux sens. La graine choisie hors ligne : la tonique
 * accentuee sur le 1, des octaves, des slides, treize notes (huit a DENSITY 0, quinze a 100).
 */
export const START_SEED = 0x339217fd;
export const START_RECIPE: BassRecipe = { seed: START_SEED, base: null, gen: { style: 0, density: 0.6, slides: 0.3, accents: 0.35, range: 0.5 } };
function initial(): BassStep[] {
  return generate({ style: 'ACID', density: 0.6, slides: 0.3, accents: 0.35, range: 2, degrees: 7, seed: START_SEED });
}

function clean(o: unknown): BassStep | null {
  if (!o || typeof o !== 'object') return null;
  const s = o as Partial<BassStep>;
  const kind: BassStepKind = s.kind === 'note' || s.kind === 'tie' ? s.kind : 'off';
  const deg = typeof s.deg === 'number' && Number.isFinite(s.deg) ? Math.max(0, Math.min(20, Math.round(s.deg))) : 0;
  const oct = typeof s.oct === 'number' && Number.isFinite(s.oct) ? Math.max(-1, Math.min(2, Math.round(s.oct))) : 0;
  const out: BassStep = { kind, deg, oct, acc: !!s.acc, slide: !!s.slide };
  const locks = cleanLocks(s.locks);
  if (locks) out.locks = locks;
  if (s.src === 'gen' || s.src === 'hand') out.src = s.src;
  return out;
}

/** Une recette lue (stockage, pattern, preset) ; null si elle n'en est pas une. */
export function cleanRecipe(o: unknown): BassRecipe | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Partial<BassRecipe>;
  if (typeof r.seed !== 'number' || !Number.isFinite(r.seed)) return null;
  const base = typeof r.base === 'number' && Number.isFinite(r.base) ? Math.min(1, Math.max(0, r.base)) : null;
  const out: BassRecipe = { seed: r.seed >>> 0, base };
  const g = r.gen as Record<string, unknown> | undefined;
  if (g && typeof g === 'object') {
    const n = (k: string): number => (typeof g[k] === 'number' && Number.isFinite(g[k]) ? Math.min(1, Math.max(0, g[k] as number)) : 0);
    out.gen = { style: n('style'), density: n('density'), slides: n('slides'), accents: n('accents'), range: n('range') };
  }
  return out;
}

/** Des verrous lus : seulement les potards du son, de 0 a 1 ; null s'il n'en reste aucun. */
export function cleanLocks(o: unknown): BassLocks | null {
  if (!o || typeof o !== 'object') return null;
  const out: BassLocks = {};
  let n = 0;
  for (const id of BASS_LOCKABLE) {
    const v = (o as Record<string, unknown>)[id];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[id] = Math.min(1, Math.max(0, v));
      n += 1;
    }
  }
  return n ? out : null;
}

/**
 * Les verrous qui sonnent au pas i (2026-10-08, la revue : l'ecran et le son disaient deux choses sur une liaison) :
 * une note, les siens ; une liaison continue la note d'avant (en remontant les liaisons, la boucle comprise : une
 * liaison au pas 1 continue la note du pas 16), avec ses verrous puis ceux de chaque liaison jusqu'a i (le dernier
 * l'emporte) ; LENGTH reste celui du pas lui-meme (la duree de la note, decidee par le pas qui la relache, seq.ts).
 * null : aucun verrou, ou une liaison qui ne continue aucune note (un silence). seq.ts l'envoie au worklet, l'ecran
 * le montre (bass/pageView.ts) : les memes valeurs.
 */
export function chainLocks(steps: readonly BassStep[], i: number): BassLocks | null {
  const s = steps[i];
  if (!s || s.kind === 'off') return null;
  if (s.kind === 'note') return s.locks ?? null;
  const n = steps.length;
  let j = i;
  let k = 0;
  while (k < n && steps[j].kind === 'tie') {
    j = (j - 1 + n) % n;
    k += 1;
  }
  if (k >= n || steps[j].kind !== 'note') return null;
  const out: BassLocks = {};
  for (let p = j; ; p = (p + 1) % n) {
    const l = steps[p].locks;
    if (l) for (const id of BASS_LOCKABLE) if (id !== 'length' && l[id] !== undefined) out[id] = l[id];
    if (p === i) break;
  }
  if (s.locks?.length !== undefined) out.length = s.locks.length;
  return Object.keys(out).length ? out : null;
}

/** Une suite lue (stockage, pattern, preset) : seize pas valides, ou null. */
export function cleanSteps(o: unknown): BassStep[] | null {
  if (!Array.isArray(o) || o.length !== BASS_STEPS) return null;
  const steps = o.map(clean);
  return steps.every((x) => x) ? (steps as BassStep[]) : null;
}

/** La ligne retenue et sa recette ; une premiere visite (rien de retenu, ou illisible) : la ligne de depart et sa graine. */
function load(): { steps: BassStep[]; recipe: BassRecipe | null } {
  try {
    const raw = window.localStorage.getItem(KEY);
    const steps = raw ? cleanSteps(JSON.parse(raw) as unknown) : null;
    if (!steps) return { steps: initial(), recipe: START_RECIPE };
    // Une ligne d'avant la recette (2026-10-09) : sans graine, ses notes a la main ; le premier cran en donne une
    let recipe: BassRecipe | null = null;
    try {
      recipe = cleanRecipe(JSON.parse(window.localStorage.getItem(RECIPE_KEY) ?? 'null') as unknown);
    } catch {
      recipe = null;
    }
    return { steps, recipe };
  } catch {
    return { steps: initial(), recipe: START_RECIPE };
  }
}

const loaded = typeof window === 'undefined' ? { steps: initial(), recipe: START_RECIPE } : load();
let state: BassState = { steps: loaded.steps, sel: 0, running: false, message: null, gen: 0, lock: -1, touched: null, recipe: loaded.recipe };
const listeners = new Set<() => void>();
let msgTimer = 0;
let saveTimer = 0;

/** Retenue un peu apres (un potard verrouille qui tourne ecrit des dizaines de fois par seconde). */
function save(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state.steps));
      if (state.recipe) window.localStorage.setItem(RECIPE_KEY, JSON.stringify(state.recipe));
      else window.localStorage.removeItem(RECIPE_KEY);
    } catch {
      /* stockage indisponible : la suite vit pour la visite */
    }
  }, 300);
}

export const bassState = {
  get: (): BassState => state,
  set(patch: Partial<BassState>): void {
    const keep = (patch.steps !== undefined && patch.steps !== state.steps) || (patch.recipe !== undefined && patch.recipe !== state.recipe);
    state = { ...state, ...patch };
    if (keep) save();
    listeners.forEach((fn) => fn());
  },
  /** Un pas change (les autres restent) ; also : le reste de l'etat dans la meme notification (2026-10-08 : un encodeur en LOCK, un seul dessin de l'ecran). */
  setStep(i: number, patch: Partial<BassStep>, also: Partial<BassState> = {}): void {
    if (i < 0 || i >= BASS_STEPS) return;
    const steps = state.steps.map((s, k) => {
      if (k !== i) return s;
      const next: BassStep = { ...s, ...patch };
      if ('locks' in patch && !patch.locks) delete next.locks;
      return next;
    });
    bassState.set({ ...also, steps });
  },
  /** Une ligne a l'ecran, quelques secondes ; also : le reste de l'etat dans la meme notification (2026-10-08, la revue : un potard qui tourne, un seul dessin). */
  say(text: string | null, ms = 2200, also: Partial<BassState> = {}): void {
    window.clearTimeout(msgTimer);
    bassState.set({ ...also, message: text });
    if (text) msgTimer = window.setTimeout(() => bassState.set({ message: null }), ms);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const emptyStep = off;
