/**
 * Les patterns du MM-RYTM (2026-10-05, Mika : "pour la RYTM on peut placer
 * des patterns, et d'ailleurs on peut rajouter des sequences comme le fait
 * la Elektron Digitakt") : seize emplacements, A01 a A16, chacun un motif
 * entier (les dix voix, leurs velocites) ; le motif qui joue (audio/
 * pattern.ts) est celui de l'emplacement courant, et chaque changement y
 * est garde. Une CHAINE : des patterns joues l'un apres l'autre, une mesure
 * chacun, en boucle, comme le chain mode d'une Digitakt.
 * - EDIT (sur la machine, les seize steps sont les emplacements) : taper un
 *   pattern le choisit ; a l'arret tout de suite, en lecture a la fin de la
 *   mesure (NEXT). Taper d'autres patterns dans les deux secondes les
 *   ajoute a la suite : la chaine (A01 > A03 > A02...). Tenir un
 *   emplacement vide y copie le pattern courant.
 * - L'horloge (audio/clock.ts onBar) previent avant de programmer le
 *   premier pas de chaque mesure : le pattern suivant de la chaine (ou
 *   celui qui attend) est pose a ce moment, ses coups partent a l'heure.
 * Retenu sous mm.v4.patterns.1 (les emplacements, le courant, la chaine).
 * Les verrous (2026-10-08, l'etape R2, audio/locks.ts) : chaque emplacement
 * garde aussi ceux de ses pas (locks, a cote des slots ; une sauvegarde
 * d'avant n'en a pas : aucun) ; changer de pattern pose les siens, la copie
 * d'un emplacement les copie.
 */

import { clock } from '../audio/clock';
import { anyLocks, cleanLocks, sameLocks, type Locks } from '../audio/locks';
import { INSTRUMENTS, STEP_COUNT, pattern, type Steps } from '../audio/pattern';

export const PATTERN_SLOTS = 16;
/** Taper un autre pattern dans ce delai l'ajoute a la chaine. */
export const CHAIN_MS = 2000;
const KEY = 'mm.v4.patterns.1';
const SAVE_MS = 400;
const STEPS_RE = /^[0-9]{16}$/;

export interface PatternsState {
  /** les seize emplacements ; null : vide (jamais ecrit) */
  slots: readonly (Steps | null)[];
  /** les verrous de chaque emplacement (2026-10-08) ; null : aucun */
  locks: readonly (Readonly<Locks> | null)[];
  /** l'emplacement qui joue (et qu'on edite) */
  cur: number;
  /** la chaine : au moins un pattern (le courant seul : pas de chaine) */
  chain: readonly number[];
  /** sa position (la mesure en cours) */
  pos: number;
  /** le pattern qui attend la fin de la mesure (lecture), -1 aucun */
  next: number;
}

/** Le nom d'un emplacement : A01 a A16. */
export const slotName = (i: number): string => `A${String(i + 1).padStart(2, '0')}`;

const emptySteps = (): Steps => Object.fromEntries(INSTRUMENTS.map((k) => [k, '0'.repeat(STEP_COUNT)])) as Steps;
const isEmpty = (s: Steps): boolean => INSTRUMENTS.every((k) => /^0+$/.test(s[k]));
const sameSteps = (a: Steps, b: Steps): boolean => INSTRUMENTS.every((k) => a[k] === b[k]);

function validSteps(x: unknown): Steps | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const out = {} as Steps;
  for (const k of INSTRUMENTS) {
    const v = o[k];
    out[k] = typeof v === 'string' && STEPS_RE.test(v) ? v : '0'.repeat(STEP_COUNT);
  }
  return out;
}

/** Les verrous a garder dans un emplacement : null sans verrou (le JSON reste court). */
// Au moins un verrou (anyLocks : la forme v des verrous de R3 seule n'en est pas un)
const keepLocks = (l: Readonly<Locks> | null | undefined): Readonly<Locks> | null => (l && anyLocks(l) ? l : null);

function load(): PatternsState {
  const slots: (Steps | null)[] = Array.from({ length: PATTERN_SLOTS }, () => null);
  const locks: (Readonly<Locks> | null)[] = Array.from({ length: PATTERN_SLOTS }, () => null);
  let cur = 0;
  let chain: number[] = [0];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as { slots?: unknown[]; locks?: unknown[]; cur?: unknown; chain?: unknown[] } | null;
    if (raw && Array.isArray(raw.slots)) {
      for (let i = 0; i < PATTERN_SLOTS; i += 1) slots[i] = raw.slots[i] ? validSteps(raw.slots[i]) : null;
      // Une sauvegarde d'avant les verrous (2026-10-08) : aucun
      if (Array.isArray(raw.locks)) for (let i = 0; i < PATTERN_SLOTS; i += 1) locks[i] = cleanLocks(raw.locks[i]);
      if (Number.isInteger(raw.cur) && (raw.cur as number) >= 0 && (raw.cur as number) < PATTERN_SLOTS) cur = raw.cur as number;
      if (Array.isArray(raw.chain)) {
        const c = raw.chain.filter((v): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < PATTERN_SLOTS).slice(0, PATTERN_SLOTS);
        if (c.length > 0) chain = c;
      }
    }
  } catch {
    /* rien de retenu */
  }
  // Le motif du moment (retenu par audio/pattern.ts) est celui de l'emplacement courant, ses verrous aussi
  slots[cur] = { ...pattern.get().steps };
  locks[cur] = keepLocks(pattern.get().locks);
  if (!chain.includes(cur)) chain = [cur];
  return { slots, locks, cur, chain, pos: Math.max(0, chain.indexOf(cur)), next: -1 };
}

let state: PatternsState = typeof window === 'undefined' ? { slots: [], locks: [], cur: 0, chain: [0], pos: 0, next: -1 } : load();
const listeners = new Set<() => void>();
let saveTimer = 0;
/** le motif pose par nous (un changement de pattern) : pas une edition a garder */
let loading = false;
let lastTap = -Infinity;

function save(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      // Les verrous seulement s'il y en a (une sauvegarde sans verrou reste celle d'avant)
      const locks = state.locks.some((l) => l !== null) ? state.locks : undefined;
      window.localStorage.setItem(KEY, JSON.stringify({ slots: state.slots, ...(locks ? { locks } : {}), cur: state.cur, chain: state.chain }));
    } catch {
      /* stockage indisponible : les patterns vivent pour la visite */
    }
  }, SAVE_MS);
}

function setState(next: PatternsState, keep = true): void {
  state = next;
  if (keep) save();
  listeners.forEach((fn) => fn());
}

/** Pose le pattern i dans le motif qui joue (ses coups et leurs verrous, rien d'autre : tempo, effets et kit restent). */
function apply(i: number): void {
  const steps = state.slots[i] ?? emptySteps();
  loading = true;
  pattern.replace(steps, state.locks[i] ?? {});
  loading = false;
}

// Chaque edition du motif (ses pas, ses verrous) est gardee dans l'emplacement courant
if (typeof window !== 'undefined') {
  pattern.subscribe(() => {
    if (loading) return;
    const { steps, locks } = pattern.get();
    const had = state.slots[state.cur];
    const sameL = sameLocks(state.locks[state.cur], keepLocks(locks));
    if (had && sameSteps(had, steps) && sameL) return;
    if (!had && isEmpty(steps) && sameL) return;
    const slots = state.slots.slice();
    slots[state.cur] = isEmpty(steps) && !had && !keepLocks(locks) ? null : { ...steps };
    const ls = state.locks.slice();
    ls[state.cur] = keepLocks(locks);
    setState({ ...state, slots, locks: ls });
  });
}

/** Passe au pattern i tout de suite (a l'arret, ou au debut d'une mesure). */
function switchTo(i: number, pos: number): void {
  if (i !== state.cur) apply(i);
  setState({ ...state, cur: i, pos, next: -1 });
}

export const patterns = {
  get: (): PatternsState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Un emplacement a-t-il des coups. */
  filled(i: number): boolean {
    const s = state.slots[i];
    return !!s && !isEmpty(s);
  },
  /**
   * EDIT, un emplacement touche : il devient le pattern (a l'arret tout de
   * suite, en lecture a la fin de la mesure) ; dans les CHAIN_MS du
   * precedent, il s'ajoute a la chaine. Renvoie ce qui s'est passe.
   */
  tap(i: number, running: boolean, now = performance.now()): 'chain' | 'next' | 'now' {
    if (i < 0 || i >= PATTERN_SLOTS) return 'now';
    const chaining = now - lastTap < CHAIN_MS && state.chain.length < PATTERN_SLOTS;
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
    if (i < 0 || i >= PATTERN_SLOTS || (i === state.cur && state.chain.length === 1 && state.next < 0)) return;
    if (i !== state.cur) apply(i);
    setState({ ...state, cur: i, chain: [i], pos: 0, next: -1 });
  },
  /** Tenir un emplacement vide : il recoit une copie du pattern courant ; false s'il est plein (ou le courant vide). */
  copyTo(i: number): boolean {
    if (i < 0 || i >= PATTERN_SLOTS || patterns.filled(i) || isEmpty(pattern.get().steps)) return false;
    const slots = state.slots.slice();
    slots[i] = { ...pattern.get().steps };
    // Ses verrous aussi (2026-10-08)
    const locks = state.locks.slice();
    locks[i] = keepLocks(pattern.get().locks);
    setState({ ...state, slots, locks });
    return true;
  },
  /** La chaine redevient le pattern courant seul. */
  unchain(): void {
    if (state.chain.length === 1 && state.chain[0] === state.cur) return;
    setState({ ...state, chain: [state.cur], pos: 0, next: -1 });
  },
  /**
   * Le debut d'une mesure (audio/clock.ts, avant d'en programmer le premier
   * pas) : le pattern qui attend, ou le suivant de la chaine. first : le
   * premier pas d'une lecture (la chaine repart de son debut).
   */
  bar(first: boolean): void {
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
  /** Tests : tout vide, A01 courant (le motif du moment). */
  reset(): void {
    window.clearTimeout(saveTimer);
    lastTap = -Infinity;
    const slots: (Steps | null)[] = Array.from({ length: PATTERN_SLOTS }, () => null);
    slots[0] = { ...pattern.get().steps };
    const locks: (Readonly<Locks> | null)[] = Array.from({ length: PATTERN_SLOTS }, () => null);
    locks[0] = keepLocks(pattern.get().locks);
    setState({ slots, locks, cur: 0, chain: [0], pos: 0, next: -1 });
  },
};

// La chaine avance avec l'horloge du MM-RYTM
clock.onBar((first) => patterns.bar(first));
