/**
 * Les patterns du MM-BASS (2026-10-07, Mika : "sur BASS il n'y a pas de
 * bouton EDIT, j'aimerais en avoir un"), comme ceux du MM-RYTM
 * (state/patterns.ts) : seize emplacements, A01 a A16, chacun une ligne
 * entiere (ses seize pas et leurs verrous) ; la ligne qui joue (bass/
 * state.ts) est celle de l'emplacement courant, et chaque changement y est
 * garde. EDIT (sur la machine, les seize pas sont les emplacements) :
 * - taper un emplacement le choisit : a l'arret tout de suite, en lecture
 *   au debut de la mesure suivante (NEXT) ;
 * - en taper d'autres dans les deux secondes les ajoute a la suite : la
 *   CHAINE (A01 > A03 > A02...), une mesure chacun, en boucle ;
 * - tenir un emplacement vide y copie la ligne courante.
 * La sequence (bass/seq.ts) previent au premier pas de chaque mesure qu'elle
 * programme (bar) : la ligne suivante est posee a ce moment.
 * Retenu sous mm.v4.bass.patterns (les emplacements, le courant, la chaine).
 * La recette de chaque ligne (2026-10-09, bass/state.ts BassRecipe : son
 * style, sa prise, ses notes, son echelle) voyage avec elle : recipes, a
 * cote des emplacements ; une recette d'avant (v1, ou aucune) est adoptee
 * au chargement (bass/line.ts migrate : les pas ne changent pas). Poser un
 * pattern pose sa recette : STYLE et NOTES sautent a sa ligne, et le cran
 * suivant agit dans son style (la revue : A02 en HOUSE ne se regenere plus
 * en ACID).
 */

import { bassLine, migrate, takeRecipe } from './line';
import { bassParams, stepOf } from './params';
import { BASS_STEPS, bassState, cleanLen, cleanSteps, emptyStep, type BassRecipe, type BassStep } from './state';

export const BASS_SLOTS = 16;
/** Taper un autre pattern dans ce delai l'ajoute a la chaine. */
const CHAIN_MS = 2000;
const KEY = 'mm.v4.bass.patterns';
const SAVE_MS = 400;

export interface BassPatternsState {
  /** les seize emplacements ; null : vide (jamais ecrit) */
  slots: readonly (readonly BassStep[] | null)[];
  /** la recette de chaque emplacement (2026-10-09), null : aucune */
  recipes: readonly (BassRecipe | null)[];
  /** la longueur de chaque emplacement (2026-10-10), 16 par defaut */
  lens: readonly number[];
  cur: number;
  chain: readonly number[];
  pos: number;
  /** le pattern qui attend la mesure suivante (lecture), -1 aucun */
  next: number;
}

export const bassSlotName = (i: number): string => `A${String(i + 1).padStart(2, '0')}`;

const isEmpty = (s: readonly BassStep[]): boolean => s.every((x) => x.kind === 'off');
const emptyLine = (): BassStep[] => Array.from({ length: BASS_STEPS }, emptyStep);

function load(): BassPatternsState {
  const slots: (readonly BassStep[] | null)[] = Array.from({ length: BASS_SLOTS }, () => null);
  const recipes: (BassRecipe | null)[] = Array.from({ length: BASS_SLOTS }, () => null);
  const lens: number[] = Array.from({ length: BASS_SLOTS }, () => 16);
  let cur = 0;
  let chain: number[] = [0];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as { slots?: unknown[]; recipes?: unknown[]; lens?: unknown[]; cur?: unknown; chain?: unknown[] } | null;
    if (raw && Array.isArray(raw.slots)) {
      for (let i = 0; i < BASS_SLOTS; i += 1) slots[i] = raw.slots[i] ? cleanSteps(raw.slots[i]) : null;
      for (let i = 0; i < BASS_SLOTS; i += 1) {
        const s = slots[i];
        recipes[i] = s ? migrate(s, Array.isArray(raw.recipes) ? raw.recipes[i] : null) : null;
        lens[i] = cleanLen(Array.isArray(raw.lens) ? raw.lens[i] : 16);
      }
      if (Number.isInteger(raw.cur) && (raw.cur as number) >= 0 && (raw.cur as number) < BASS_SLOTS) cur = raw.cur as number;
      if (Array.isArray(raw.chain)) {
        const c = raw.chain.filter((v): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < BASS_SLOTS).slice(0, BASS_SLOTS);
        if (c.length > 0) chain = c;
      }
    }
  } catch {
    /* rien de retenu */
  }
  // La ligne du moment (retenue par bass/state.ts) est celle de l'emplacement courant
  slots[cur] = bassState.get().steps;
  recipes[cur] = bassState.get().recipe;
  lens[cur] = bassState.get().len;
  if (!chain.includes(cur)) chain = [cur];
  return { slots, recipes, lens, cur, chain, pos: Math.max(0, chain.indexOf(cur)), next: -1 };
}

let state: BassPatternsState = typeof window === 'undefined' ? { slots: [], recipes: [], lens: [], cur: 0, chain: [0], pos: 0, next: -1 } : load();
const listeners = new Set<() => void>();
let saveTimer = 0;
let loading = false;
let lastTap = -Infinity;
/** l'heure (contexte) de la derniere mesure traitee : une re-programmation ne la rejoue pas */
let lastBar = -1;

function save(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ slots: state.slots, recipes: state.recipes, lens: state.lens, cur: state.cur, chain: state.chain }));
    } catch {
      /* stockage indisponible : les patterns vivent pour la visite */
    }
  }, SAVE_MS);
}

function setState(next: BassPatternsState, keep = true): void {
  state = next;
  if (keep) save();
  listeners.forEach((fn) => fn());
}

/**
 * Pose la ligne i (ses pas et leurs verrous, sa recette ; STYLE et NOTES sautent a elle, 2026-10-09) ; un emplacement
 * vide : la prise 01 du style du moment, a 0 note (NOTES la fait venir).
 */
function apply(i: number): void {
  loading = true;
  const r = state.recipes[i] ?? { ...takeRecipe(stepOf('style', bassParams.of('style')), 1), on: 0 };
  bassLine.load(state.slots[i] ?? emptyLine(), r, { lock: -1 });
  bassState.set({ len: state.lens[i] ?? 16 });
  loading = false;
}

// Chaque edition de la ligne (et de sa recette) est gardee dans l'emplacement courant
if (typeof window !== 'undefined') {
  let last = bassState.get().steps;
  let lastRecipe = bassState.get().recipe;
  let lastLen = bassState.get().len;
  bassState.subscribe(() => {
    const { steps, recipe, len } = bassState.get();
    if (steps === last && recipe === lastRecipe && len === lastLen) return;
    last = steps;
    lastRecipe = recipe;
    lastLen = len;
    if (loading) return;
    const had = state.slots[state.cur];
    const slots = state.slots.slice();
    const recipes = state.recipes.slice();
    const lens = state.lens.slice();
    slots[state.cur] = isEmpty(steps) && !had ? null : steps;
    recipes[state.cur] = slots[state.cur] ? recipe : null;
    lens[state.cur] = len;
    setState({ ...state, slots, recipes, lens });
  });
}

function switchTo(i: number, pos: number): void {
  if (i !== state.cur) apply(i);
  setState({ ...state, cur: i, pos, next: -1 });
}

export const bassPatterns = {
  get: (): BassPatternsState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  filled(i: number): boolean {
    const s = state.slots[i];
    return !!s && !isEmpty(s);
  },
  /** EDIT, un emplacement touche (voir plus haut) ; renvoie ce qui s'est passe. */
  tap(i: number, running: boolean, now = performance.now()): 'chain' | 'next' | 'now' {
    if (i < 0 || i >= BASS_SLOTS) return 'now';
    const chaining = now - lastTap < CHAIN_MS && state.chain.length < BASS_SLOTS;
    lastTap = now;
    if (chaining) {
      setState({ ...state, chain: [...state.chain, i] });
      return 'chain';
    }
    if (running) {
      setState({ ...state, chain: [i], next: i === state.cur ? -1 : i });
      return 'next';
    }
    if (i !== state.cur) apply(i);
    setState({ ...state, cur: i, chain: [i], pos: 0, next: -1 });
    return 'now';
  },
  /**
   * UNDO (state/undo.ts, 2026-10-11) : l'emplacement d'une etape devient tout de suite le courant (meme en lecture),
   * seul dans sa chaine, pour que l'etape s'y pose au lieu de ne rien changer a celui qu'on regarde.
   */
  select(i: number): void {
    if (i < 0 || i >= BASS_SLOTS || (i === state.cur && state.chain.length === 1 && state.next < 0)) return;
    if (i !== state.cur) apply(i);
    setState({ ...state, cur: i, chain: [i], pos: 0, next: -1 });
  },
  /** Tenir un emplacement vide : il recoit une copie de la ligne courante ; false s'il est plein (ou la ligne vide). */
  copyTo(i: number): boolean {
    const steps = bassState.get().steps;
    if (i < 0 || i >= BASS_SLOTS || bassPatterns.filled(i) || isEmpty(steps)) return false;
    const slots = state.slots.slice();
    const recipes = state.recipes.slice();
    slots[i] = steps;
    recipes[i] = bassState.get().recipe;
    const lens = state.lens.slice();
    lens[i] = bassState.get().len;
    setState({ ...state, slots, recipes, lens });
    return true;
  },
  /**
   * Le premier pas d'une mesure que la sequence programme, a l'heure at du
   * contexte (first : le premier de la lecture) : le pattern qui attend, ou
   * le suivant de la chaine. Une mesure deja traitee (re-programmation) ne
   * change rien.
   */
  bar(at: number, first: boolean): void {
    if (at <= lastBar + 1e-4) return;
    lastBar = at;
    const c = state.chain;
    if (first) {
      if (c.length > 1 && state.cur !== c[0]) switchTo(c[0], 0);
      else if (state.next >= 0) switchTo(state.next, 0);
      return;
    }
    if (state.next >= 0) {
      switchTo(state.next, Math.max(0, c.indexOf(state.next)));
      return;
    }
    if (c.length > 1) {
      const pos = (state.pos + 1) % c.length;
      switchTo(c[pos], pos);
    }
  },
  /** La lecture s'arrete : la prochaine mesure sera une premiere. */
  stopped(): void {
    lastBar = -1;
    if (state.next >= 0) setState({ ...state, next: -1 }, false);
  },
};
