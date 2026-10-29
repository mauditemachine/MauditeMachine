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
import { INSTRUMENTS, STEP_COUNT, cleanPmutes, pattern, type Steps } from '../audio/pattern';
import type { Inst } from '../theme';
import { NO_SCENES, anyScenes, cleanScenes, sameScenes, toStored, type SceneSet } from '../rytm/sceneData';

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
  /** les scenes A et B de chaque emplacement (2026-10-27, la phase 2) ; null : aucune */
  scenes: readonly (SceneSet | null)[];
  /** le mute de chaque pattern (V.5.0, 2026-10-29, FUNC + TRK deux fois) ; null : aucune voix coupee */
  pmutes: readonly (readonly Inst[] | null)[];
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
/** Les scenes a garder dans un emplacement : null sans scene. */
const keepScenes = (s: SceneSet | null | undefined): SceneSet | null => (s && anyScenes(s) ? s : null);
const sameKept = (a: SceneSet | null, b: SceneSet | null): boolean => a === b || (!!a && !!b && sameScenes(a, b));
/** Le mute d'un pattern a garder : null sans voix coupee. */
const keepPmutes = (m: readonly Inst[] | null | undefined): readonly Inst[] | null => (m && m.length > 0 ? [...m] : null);
const samePm = (a: readonly Inst[] | null, b: readonly Inst[] | null): boolean => (a ?? []).join() === (b ?? []).join();

function load(): PatternsState {
  const slots: (Steps | null)[] = Array.from({ length: PATTERN_SLOTS }, () => null);
  const locks: (Readonly<Locks> | null)[] = Array.from({ length: PATTERN_SLOTS }, () => null);
  const scenes: (SceneSet | null)[] = Array.from({ length: PATTERN_SLOTS }, () => null);
  const pmutes: (readonly Inst[] | null)[] = Array.from({ length: PATTERN_SLOTS }, () => null);
  let cur = 0;
  let chain: number[] = [0];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as { slots?: unknown[]; locks?: unknown[]; scenes?: unknown[]; pmutes?: unknown[]; cur?: unknown; chain?: unknown[] } | null;
    if (raw && Array.isArray(raw.slots)) {
      for (let i = 0; i < PATTERN_SLOTS; i += 1) slots[i] = raw.slots[i] ? validSteps(raw.slots[i]) : null;
      // Une sauvegarde d'avant les verrous (2026-10-08) : aucun
      if (Array.isArray(raw.locks)) for (let i = 0; i < PATTERN_SLOTS; i += 1) locks[i] = cleanLocks(raw.locks[i]);
      // Les scenes (2026-10-27) : une sauvegarde d'avant n'en a pas ; une illisible part, jamais une exception
      if (Array.isArray(raw.scenes)) for (let i = 0; i < PATTERN_SLOTS; i += 1) scenes[i] = keepScenes(cleanScenes(raw.scenes[i]));
      // Le mute de chaque pattern (V.5.0) : une sauvegarde d'avant n'en a pas
      if (Array.isArray(raw.pmutes)) for (let i = 0; i < PATTERN_SLOTS; i += 1) pmutes[i] = keepPmutes(cleanPmutes(raw.pmutes[i]));
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
  scenes[cur] = keepScenes(pattern.scenes.get());
  pmutes[cur] = keepPmutes(pattern.get().pmutes);
  if (!chain.includes(cur)) chain = [cur];
  return { slots, locks, scenes, pmutes, cur, chain, pos: Math.max(0, chain.indexOf(cur)), next: -1 };
}

let state: PatternsState = typeof window === 'undefined' ? { slots: [], locks: [], scenes: [], pmutes: [], cur: 0, chain: [0], pos: 0, next: -1 } : load();
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
      // Les scenes de meme (2026-10-27) : une sauvegarde sans scene reste octet pour octet celle d'avant
      const scenes = state.scenes.some((s) => s !== null) ? state.scenes.map((s) => (s ? (toStored(s) ?? null) : null)) : undefined;
      // Les mutes des patterns de meme (V.5.0)
      const pmutes = state.pmutes.some((m) => m !== null) ? state.pmutes : undefined;
      window.localStorage.setItem(KEY, JSON.stringify({ slots: state.slots, ...(locks ? { locks } : {}), ...(scenes ? { scenes } : {}), ...(pmutes ? { pmutes } : {}), cur: state.cur, chain: state.chain }));
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
  // Son mute (V.5.0, 2026-10-29) : celui du pattern pose
  pattern.setPmutes(state.pmutes[i] ?? []);
  // Ses scenes (2026-10-27), a l'heure de la mesure qui commence (le bus tombe sur le temps fort) ; a l'arret tout de suite
  pattern.scenes.replace(state.scenes[i] ?? NO_SCENES, clock.barAt());
  loading = false;
}

// Chaque edition du motif (ses pas, ses verrous) est gardee dans l'emplacement courant
if (typeof window !== 'undefined') {
  pattern.subscribe(() => {
    if (loading) return;
    const { steps, locks, pmutes } = pattern.get();
    const had = state.slots[state.cur];
    const sameL = sameLocks(state.locks[state.cur], keepLocks(locks));
    // Le mute du pattern (V.5.0) : garde dans l'emplacement courant, comme ses verrous
    const sameM = samePm(state.pmutes[state.cur] ?? null, keepPmutes(pmutes));
    if (!sameM) {
      const pm = state.pmutes.slice();
      pm[state.cur] = keepPmutes(pmutes);
      state = { ...state, pmutes: pm };
    }
    if (had && sameSteps(had, steps) && sameL) {
      if (!sameM) setState({ ...state });
      return;
    }
    if (!had && isEmpty(steps) && sameL) {
      if (!sameM) setState({ ...state });
      return;
    }
    const slots = state.slots.slice();
    slots[state.cur] = isEmpty(steps) && !had && !keepLocks(locks) ? null : { ...steps };
    const ls = state.locks.slice();
    ls[state.cur] = keepLocks(locks);
    setState({ ...state, slots, locks: ls });
  });
  // Ses scenes aussi (2026-10-27) : leurs propres ecouteurs, pas ceux du motif
  pattern.scenes.subscribe(() => {
    if (loading) return;
    const s = keepScenes(pattern.scenes.get());
    if (sameKept(state.scenes[state.cur] ?? null, s)) return;
    const sc = state.scenes.slice();
    sc[state.cur] = s;
    setState({ ...state, scenes: sc });
  });
}

/**
 * Ce qu'etait la chaine avant le dernier debut de mesure (V.5.0, la revue de D1, G3) : une pause avant que cette mesure ne
 * s'entende y revient (unbar) ; null : rien a rendre.
 */
let beforeBar: { cur: number; pos: number; next: number } | null = null;

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
    // Ses scenes aussi (2026-10-27)
    const scenes = state.scenes.slice();
    scenes[i] = keepScenes(pattern.scenes.get());
    // Son mute aussi (V.5.0)
    const pmutes = state.pmutes.slice();
    pmutes[i] = keepPmutes(pattern.get().pmutes);
    setState({ ...state, slots, locks, scenes, pmutes });
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
    beforeBar = { cur: state.cur, pos: state.pos, next: state.next };
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
  /** La pause avant que la mesure annoncee ne s'entende (audio/clock.ts onUnbar) : la chaine revient a ce qu'elle etait. */
  unbar(): void {
    const b = beforeBar;
    beforeBar = null;
    if (!b) return;
    if (b.cur !== state.cur) apply(b.cur);
    setState({ ...state, cur: b.cur, pos: b.pos, next: b.next });
  },
  /** Tests : tout vide, A01 courant (le motif du moment). */
  reset(): void {
    window.clearTimeout(saveTimer);
    lastTap = -Infinity;
    const slots: (Steps | null)[] = Array.from({ length: PATTERN_SLOTS }, () => null);
    slots[0] = { ...pattern.get().steps };
    const locks: (Readonly<Locks> | null)[] = Array.from({ length: PATTERN_SLOTS }, () => null);
    locks[0] = keepLocks(pattern.get().locks);
    const scenes: (SceneSet | null)[] = Array.from({ length: PATTERN_SLOTS }, () => null);
    scenes[0] = keepScenes(pattern.scenes.get());
    const pmutes: (readonly Inst[] | null)[] = Array.from({ length: PATTERN_SLOTS }, () => null);
    pmutes[0] = keepPmutes(pattern.get().pmutes);
    setState({ slots, locks, scenes, pmutes, cur: 0, chain: [0], pos: 0, next: -1 });
  },
};

// La chaine avance avec l'horloge du MM-RYTM
clock.onBar((first) => patterns.bar(first));
clock.onUnbar(() => patterns.unbar());
