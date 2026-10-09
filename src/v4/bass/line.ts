/**
 * La ligne du MM-BASS et son generateur (2026-10-09, Mika : "je ne vois pas
 * ce que Style et density font.. j'aime bien l'image qu'il y a dans density",
 * puis "Je trouve Style et Density complexe a utiliser") : le seul a ecrire
 * la ligne pour le generateur. Une ligne = des pas (bass/state.ts, ce que
 * jouent seq.ts et l'ecran) et sa recette v2 (le style, la prise, combien de
 * barreaux jouent, l'echelle) ; apres chaque geste, les pas sont exactement
 * render(recette, tes pas) (bass/gen.ts), et les potards STYLE et NOTES en
 * sont le miroir (bassParams.style, bassParams.density = notes / 16) : les
 * potards, les jumeaux, le MIDI et les moteurs du Roto suivent la ligne.
 * - STYLE : chaque cran joue la prise 01 du style a son compte (sa ligne
 *   d'usine) ; chaque style garde ou on l'a laisse sur cette ligne (mem) ;
 * - NOTES : un cran, une note de plus ou de moins, toujours dans l'ordre de
 *   l'echelle ; tes notes restent (le plancher), un pas en P-LOCK aussi ;
 * - GEN : la prise suivante (99 revient a 01), le meme nombre de notes ;
 *   tenu : la prise d'avant ; MUTATE : 2 ou 3 notes de la machine, le meme
 *   compte, annulable (huit fois, pour la visite) ;
 * - tes pas (une tape, un glisser, ACCENT, SLIDE, NOTE, OCT, un P-lock) : le
 *   generateur n'y touche jamais ; rendu a vide, son barreau passe a la fin
 *   de l'echelle (le dernier a revenir) ; CLEAR efface tout, NOTES remonte la
 *   prise note a note.
 * Une ligne d'avant (une recette v1, ou aucune) est adoptee au chargement,
 * sans qu'un pas change (inaudible).
 */

import { bassCuratedLines, parseLine } from '../state/factory';
import { adopt, curatedLadder, genLadder, isFreeStep, mutateLadder, noteCount, notesCeiling, notesDown, notesFloor, notesUp, onForCount, pinsOf, render, takeSeed, type LineOpts, type Pins } from './gen';
import { BASS_SCALES, BASS_STYLES, SCALE_TONES, bassParams, stepOf, type BassStyle } from './params';
import { BASS_STEPS, bassFresh, bassLoadedRecipe, bassState, cleanRecipe, cleanRecipeV1, type BassLadder, type BassRecipe, type BassState, type BassStep } from './state';

/** Les prises numerotees de 01 a 99 par style. */
export const TAKES = 99;
/** Les niveaux d'annulation de MUTATE (pour la visite). */
const UNDO_LEVELS = 8;

const clampStyle = (i: number): number => Math.max(0, Math.min(BASS_STYLES.length - 1, Math.round(i)));
export const styleName = (i: number): BassStyle => BASS_STYLES[clampStyle(i)];
const degrees = (): number => SCALE_TONES[BASS_SCALES[stepOf('scale', bassParams.of('scale'))]].length;

/** Ce qui joue sur l'echelle maintenant : le style de la ligne, SLIDE PROB, ACC PROB, RANGE. */
export function lineOpts(style: number): LineOpts {
  const v = bassParams.get();
  return { style: styleName(style), slides: v.slides, accents: v.accents, range: stepOf('range', v.range) + 1 };
}

/* ---------------- les prises ---------------- */

/** Les lignes ecrites de chaque style (state/factory.ts, dans l'ordre de BASS : les prises 01 a k). */
let curated: Map<BassStyle, BassStep[][]> | null = null;
export function curatedOf(style: BassStyle): readonly BassStep[][] {
  if (!curated) {
    curated = new Map();
    for (const c of bassCuratedLines()) {
      const list = curated.get(c.style) ?? [];
      list.push(parseLine(c.line).map((x): BassStep => ({ ...x, src: 'gen' })));
      curated.set(c.style, list);
    }
  }
  return curated.get(style) ?? [];
}

/** L'echelle d'une prise et son compte a elle (une prise ecrite : ses notes ; generee : celui de la prise 01 du style). */
export function takeLadder(style: number, take: number): { ladder: BassLadder; on: number } {
  const st = styleName(style);
  const lines = curatedOf(st);
  const t = Math.max(1, Math.min(TAKES, Math.round(take)));
  if (t <= lines.length) return curatedLadder(st, lines[t - 1], t, degrees());
  const ladder = genLadder(st, t, degrees());
  const own = lines.length ? curatedLadder(st, lines[0], 1, degrees()).on : 8;
  return { ladder, on: onForCount(ladder, own, Array.from({ length: BASS_STEPS }, () => null), lineOpts(style)) };
}

/** La recette d'une prise a son compte (une ligne neuve, la premiere visite). */
export function takeRecipe(style: number, take: number): BassRecipe {
  const t = takeLadder(style, take);
  return { v: 2, style: clampStyle(style), take: Math.max(1, Math.min(TAKES, take)), on: t.on, ladder: t.ladder, mutated: false, mem: {} };
}

/* ---------------- la migration (inaudible) ---------------- */

const sameContent = (a: readonly BassStep[], b: readonly BassStep[]): boolean =>
  a.length === b.length && a.every((s, i) => s.kind === b[i].kind && (s.kind !== 'note' || (s.deg === b[i].deg && s.oct === b[i].oct && s.acc === b[i].acc && s.slide === b[i].slide)));

/**
 * La recette v2 d'une ligne gardee (2026-10-09) : une v2 telle quelle ; une v1 dont la ligne d'usine (anchor) est une
 * prise ecrite : cette prise, ses notes encore la en tete, le reste adopte ; une autre v1 : adoptee dans son style (ou
 * celui du potard), prise 0 ; aucune (une ligne d'avant le 2026-10-09) : adoptee, ses notes sans src sont deja a toi.
 * Les pas ne changent pas.
 */
export function migrate(steps: readonly BassStep[], raw: unknown): BassRecipe {
  const v2 = cleanRecipe(raw);
  if (v2) return v2;
  const v1 = cleanRecipeV1(raw);
  const deg = degrees();
  if (v1?.anchor) {
    const style = stepOf('style', v1.anchor.style);
    const lines = curatedOf(styleName(style));
    const k = lines.findIndex((l) => sameContent(l, v1.anchor?.steps ?? []));
    if (k >= 0) {
      const c = curatedLadder(styleName(style), lines[k], k + 1, deg);
      const a = adopt(steps, styleName(style), deg, 0, c.ladder);
      return { v: 2, style, take: k + 1, on: a.on, ladder: a.ladder, mutated: false, mem: {} };
    }
  }
  const style = stepOf('style', v1?.gen?.style ?? bassParams.of('style'));
  const a = adopt(steps, styleName(style), deg, v1 ? v1.seed : takeSeed(styleName(style), 0));
  return { v: 2, style, take: 0, on: a.on, ladder: a.ladder, mutated: false, mem: {} };
}

/* ---------------- l'ecriture ---------------- */

const sameStep = (a: BassStep, b: BassStep | undefined): boolean =>
  !!b && a.kind === b.kind && a.deg === b.deg && a.oct === b.oct && a.acc === b.acc && a.slide === b.slide && a.src === b.src && a.locks === b.locks;

/** Les miroirs : STYLE et NOTES montrent la ligne (le cran du style, le compte / 16). */
function mirrors(r: BassRecipe, steps: readonly BassStep[]): void {
  bassParams.setMany({ style: r.style / (BASS_STYLES.length - 1), density: noteCount(steps) / BASS_STEPS });
}

let undo: { ladder: BassLadder; mutated: boolean }[] = [];
let version = 0;
const listeners = new Set<() => void>();

function recipe(): BassRecipe {
  return bassState.get().recipe ?? takeRecipe(1, 1);
}

/** Ecrit la recette et la ligne rendue (les pas qui ne changent pas gardent leur objet) ; also : le reste de l'etat. */
function write(r: BassRecipe, steps: readonly BassStep[], also: Partial<BassState> = {}): void {
  const old = bassState.get().steps;
  const next = steps.map((s, i) => (sameStep(s, old[i]) ? old[i] : s));
  const changed = next.some((s, i) => s !== old[i]);
  mirrors(r, next);
  bassState.set({ ...also, recipe: r, ...(changed ? { steps: next } : {}) });
}

/** Tes pas, et le pas en P-LOCK s'il est une note de la machine (protege tant qu'il est choisi). */
function pinsNow(steps: readonly BassStep[], lock: number): (BassStep | null)[] {
  const p = pinsOf(steps);
  if (lock >= 0 && !p[lock] && steps[lock]?.kind === 'note') p[lock] = steps[lock];
  return p;
}

/** Le pas en P-LOCK, une note de la machine, que la nouvelle ligne changerait : il devient a toi (STYLE le garde). */
function keepLatched(steps: readonly BassStep[], next: readonly BassStep[]): BassStep[] {
  const lock = bassState.get().lock;
  const out = next.slice();
  if (lock >= 0 && isFreeStep(steps[lock]) && steps[lock].kind === 'note' && !sameStep(steps[lock], next[lock])) out[lock] = { ...steps[lock], src: 'hand' };
  return out;
}

/** Ce que rend un geste du generateur. */
export type GenResult =
  | { ok: true; count: number; step?: number; first?: boolean; mutated?: number }
  | { ok: false; why: 'yours' | 'floor' | 'ceiling' | 'first' | 'old' | 'none' | 'nothing' | 'same'; count: number };

export const bassLine = {
  get: (): BassRecipe => recipe(),
  /** Change a chaque ligne posee d'un bloc (un pattern, un preset) : un potard tenu repart du compte de la nouvelle ligne. */
  version: (): number => version,
  opts: (): LineOpts => lineOpts(recipe().style),
  pins: (): Pins => pinsOf(bassState.get().steps),
  count: (): number => noteCount(bassState.get().steps),
  /** Tes notes (des notes, pas les liaisons ni tes silences). */
  yours: (): number => bassState.get().steps.filter((s) => s.kind === 'note' && !isFreeStep(s)).length,
  floor: (): number => notesFloor(recipe().ladder, pinsNow(bassState.get().steps, bassState.get().lock), lineOpts(recipe().style)),
  ceiling: (): number => notesCeiling(recipe().ladder, pinsOf(bassState.get().steps), lineOpts(recipe().style)),
  /** Les seize pas sont a toi : le generateur n'a plus rien a faire. */
  allYours: (): boolean => bassState.get().steps.every((s) => !isFreeStep(s)),
  canUndo: (): boolean => undo.length > 0,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  /**
   * Une ligne posee d'un bloc (un pattern, un preset, le chargement) : sa recette (migree si besoin), les pas tels
   * quels ; STYLE et NOTES sautent a elle ; l'annulation de MUTATE repart a zero.
   */
  load(steps: readonly BassStep[], raw: unknown, also: Partial<BassState> = {}): BassRecipe {
    const r = migrate(steps, raw);
    undo = [];
    version += 1;
    mirrors(r, steps);
    bassState.set({ ...also, steps, recipe: r });
    listeners.forEach((fn) => fn());
    return r;
  },

  /** La ligne rendue de nouveau (SLIDE PROB, ACC PROB, RANGE : les notes de la machine suivent, les tiennes restent). */
  rerender(also: Partial<BassState> = {}): void {
    const st = bassState.get();
    const r = recipe();
    write(r, render(r.ladder, r.on, pinsOf(st.steps), lineOpts(r.style)), also);
  },

  /**
   * Un pas change a la main (une tape, un glisser, ACCENT, SLIDE, NOTE, OCT, un verrou ; 2026-10-09) : il est a toi ;
   * rendu a la machine (vide, ou sans verrou), son barreau passe a la fin de l'echelle (vide) ou rejoint ceux qui jouent
   * (une note de la machine qui perd ses verrous : elle continue de jouer). Un vide que la machine continuerait (une
   * liaison) reste un silence a toi. Les autres pas suivent (une liaison, le legato de SUB), NOTES aussi.
   */
  edit(i: number, patch: Partial<BassStep>, also: Partial<BassState> = {}): void {
    const st = bassState.get();
    const old = st.steps[i];
    if (!old) return;
    let next: BassStep = { ...old, ...patch };
    if ('locks' in patch && !patch.locks) delete next.locks;
    let r = recipe();
    const o = lineOpts(r.style);
    let rungs = r.ladder.rungs;
    let on = r.on;
    const steps = st.steps.slice();
    const wasPin = !isFreeStep(old);
    if (next.kind === 'off' && !next.locks && next.src === 'hand') {
      // Un vide : rendu a la machine s'il y reste un vide, sinon un silence a toi (la machine l'aurait continue)
      const free: BassStep = { ...next, src: 'gen' };
      steps[i] = free;
      const k0 = rungs.findIndex((x) => x.step === i);
      const tail = k0 >= 0 ? [...rungs.slice(0, k0), ...rungs.slice(k0 + 1), rungs[k0]] : rungs;
      const on0 = k0 >= 0 && k0 < on ? on - 1 : on;
      const probe = render({ ...r.ladder, rungs: tail }, on0, pinsOf(steps), o);
      if (probe[i].kind === 'off') {
        next = free;
        rungs = tail;
        on = on0;
      }
    } else if (wasPin && isFreeStep(next) && next.kind === 'note') {
      // Une note de la machine qui perd ses verrous : son barreau joue, avec ce qu'elle joue
      const k0 = rungs.findIndex((x) => x.step === i);
      if (k0 >= 0) {
        const rung = { step: i, deg: next.deg, oct: next.oct, acc: next.acc, slide: next.slide, holds: rungs[k0].holds };
        const rest = [...rungs.slice(0, k0), ...rungs.slice(k0 + 1)];
        const at = k0 < on ? on - 1 : on;
        rungs = [...rest.slice(0, at), rung, ...rest.slice(at)];
        on = at + 1;
      }
    } else if (wasPin && isFreeStep(next) && next.kind === 'off') {
      // Un pas a toi rendu vide (le P-LOCK d'un vide qu'on quitte) : son barreau a la fin
      const k0 = rungs.findIndex((x) => x.step === i);
      if (k0 >= 0) {
        rungs = [...rungs.slice(0, k0), ...rungs.slice(k0 + 1), rungs[k0]];
        if (k0 < on) on -= 1;
      }
    }
    steps[i] = next;
    if (rungs !== r.ladder.rungs || on !== r.on) r = { ...r, ladder: { ...r.ladder, rungs }, on };
    write(r, render(r.ladder, r.on, pinsOf(steps), o), also);
  },

  /** STYLE au cran s (sa memoire sur cette ligne, sinon sa prise 01 a son compte) ; tes pas et tes P-locks restent. */
  style(s: number, also: Partial<BassState> = {}): GenResult {
    const r = recipe();
    const style = clampStyle(s);
    const count = noteCount(bassState.get().steps);
    if (style === r.style) return { ok: false, why: 'same', count };
    if (bassLine.allYours()) return { ok: false, why: 'yours', count };
    const mem = { ...r.mem, [r.style]: { take: r.take, on: r.on, ...(r.mutated || r.take === 0 ? { ladder: r.ladder } : {}) } };
    const m = r.mem[style];
    delete mem[style];
    let next: BassRecipe;
    if (m) {
      const t = m.ladder ? { ladder: m.ladder } : takeLadder(style, m.take);
      next = { v: 2, style, take: m.take, on: m.on, ladder: t.ladder, mutated: !!m.ladder && m.take > 0, mem };
    } else next = { ...takeRecipe(style, 1), mem };
    undo = [];
    const st = bassState.get();
    const steps = keepLatched(st.steps, render(next.ladder, next.on, pinsNow(st.steps, -1), lineOpts(style)));
    write(next, render(next.ladder, next.on, pinsOf(steps), lineOpts(style)), also);
    return { ok: true, count: noteCount(bassState.get().steps), first: !m };
  },

  /** NOTES d'un cran (dir +1 / -1) : une note exactement, ou rien (au plancher, au plafond). */
  notes(dir: 1 | -1, also: Partial<BassState> = {}): GenResult {
    const st = bassState.get();
    const r = recipe();
    const o = lineOpts(r.style);
    const pins = pinsOf(st.steps);
    const count = noteCount(st.steps);
    if (bassLine.allYours()) return { ok: false, why: 'yours', count };
    const before = st.steps;
    let next: BassRecipe;
    if (dir > 0) {
      const on = notesUp(r.ladder, r.on, pins, o);
      if (on === null) return { ok: false, why: 'ceiling', count };
      next = { ...r, on };
    } else {
      const lock = st.lock >= 0 && isFreeStep(st.steps[st.lock]) ? st.lock : -1;
      const d = notesDown(r.ladder, r.on, pins, o, lock);
      if (!d) return { ok: false, why: 'floor', count };
      next = { ...r, on: d.on, ladder: d.ladder };
    }
    const line = render(next.ladder, next.on, pins, o);
    write(next, line, also);
    const step = line.findIndex((s, i) => (s.kind === 'note') !== (before[i].kind === 'note'));
    return { ok: true, count: noteCount(line), step };
  },

  /** NOTES a n (le MIDI, deux tapes) : une note a la fois jusqu'a n ou jusqu'a une limite. */
  notesTo(n: number, also: Partial<BassState> = {}): GenResult {
    let last: GenResult = { ok: false, why: 'same', count: bassLine.count() };
    for (let k = 0; k < BASS_STEPS + 1; k += 1) {
      const c = bassLine.count();
      if (c === n) break;
      const res = bassLine.notes(c < n ? 1 : -1, also);
      if (!res.ok) {
        if (!last.ok) last = res;
        break;
      }
      last = res;
    }
    return last;
  },

  /** GEN (dir 1) : la prise suivante, le meme compte (a 0 : son compte a elle) ; tenu (dir -1) : la prise d'avant. */
  gen(dir: 1 | -1, also: Partial<BassState> = {}): GenResult {
    const st = bassState.get();
    const r = recipe();
    const count = noteCount(st.steps);
    if (bassLine.allYours()) return { ok: false, why: 'yours', count };
    if (dir < 0 && r.take === 0) return { ok: false, why: 'old', count };
    if (dir < 0 && r.take <= 1) return { ok: false, why: 'first', count };
    const take = dir > 0 ? (r.take === 0 || r.take >= TAKES ? 1 : r.take + 1) : r.take - 1;
    const t = takeLadder(r.style, take);
    const pins = pinsOf(st.steps);
    const o = lineOpts(r.style);
    const on = count === 0 ? t.on : onForCount(t.ladder, count, pins, o);
    const next: BassRecipe = { ...r, take, on, ladder: t.ladder, mutated: false };
    undo = [];
    write(next, render(next.ladder, next.on, pins, o), also);
    return { ok: true, count: noteCount(bassState.get().steps) };
  },

  /** MUTATE : 2 ou 3 notes de la machine changent, le compte reste ; l'echelle d'avant va sur la pile d'annulation. */
  mutate(rnd: () => number = Math.random, also: Partial<BassState> = {}): GenResult {
    const st = bassState.get();
    const r = recipe();
    const count = noteCount(st.steps);
    if (bassLine.allYours()) return { ok: false, why: 'yours', count };
    const o = lineOpts(r.style);
    const pins = pinsOf(st.steps);
    const m = mutateLadder(r.ladder, r.on, pins, o, degrees(), st.lock, rnd);
    if (!m) return { ok: false, why: 'none', count };
    undo = [...undo, { ladder: r.ladder, mutated: r.mutated }].slice(-UNDO_LEVELS);
    const next: BassRecipe = { ...r, ladder: m.ladder, mutated: true };
    write(next, render(next.ladder, next.on, pins, o), also);
    return { ok: true, count: noteCount(bassState.get().steps), mutated: m.changed };
  },

  /** MUTATE tenu : la derniere mutation s'annule (la ligne d'avant, exactement). */
  undo(also: Partial<BassState> = {}): GenResult {
    const st = bassState.get();
    const count = noteCount(st.steps);
    const u = undo[undo.length - 1];
    if (!u) return { ok: false, why: 'nothing', count };
    undo = undo.slice(0, -1);
    const r = recipe();
    const next: BassRecipe = { ...r, ladder: u.ladder, mutated: u.mutated };
    write(next, render(next.ladder, next.on, pinsOf(st.steps), lineOpts(r.style)), also);
    return { ok: true, count: noteCount(bassState.get().steps) };
  },

  /** Deux tapes sur STYLE : la prise 01 du style a son compte (tes pas restent, la mutation part). */
  home(also: Partial<BassState> = {}): GenResult {
    const st = bassState.get();
    const r = recipe();
    if (bassLine.allYours()) return { ok: false, why: 'yours', count: noteCount(st.steps) };
    const t = takeLadder(r.style, 1);
    const next: BassRecipe = { ...r, take: 1, on: t.on, ladder: t.ladder, mutated: false };
    undo = [];
    write(next, render(next.ladder, next.on, pinsOf(st.steps), lineOpts(r.style)), also);
    return { ok: true, count: noteCount(bassState.get().steps), first: true };
  },

  /** Le compte qu'aurait la ligne avec on barreaux actifs (deux tapes sur NOTES : le compte de la prise). */
  countAt(on: number): number {
    const r = recipe();
    return noteCount(render(r.ladder, on, pinsOf(bassState.get().steps), lineOpts(r.style)));
  },

  /** CLEAR (hors P-LOCK) : tous les pas vides, les tiens et leurs verrous compris ; l'echelle, la prise et mem restent. */
  clear(also: Partial<BassState> = {}): void {
    const r = { ...recipe(), on: 0 };
    write(r, render(r.ladder, 0, Array.from({ length: BASS_STEPS }, () => null), lineOpts(r.style)), also);
  },

  /** Le pas que NOTES + 1 remplirait, et celui que NOTES - 1 retirerait (-1 : aucun) : l'ecran GENERATOR les montre. */
  nextSteps(): { plus: number; minus: number } {
    const st = bassState.get();
    const r = recipe();
    const o = lineOpts(r.style);
    const pins = pinsOf(st.steps);
    const now = render(r.ladder, r.on, pins, o);
    const up = notesUp(r.ladder, r.on, pins, o);
    const lock = st.lock >= 0 && isFreeStep(st.steps[st.lock]) ? st.lock : -1;
    const down = notesDown(r.ladder, r.on, pins, o, lock);
    const diff = (line: readonly BassStep[]): number => line.findIndex((s, i) => (s.kind === 'note') !== (now[i].kind === 'note'));
    return { plus: up === null ? -1 : diff(render(r.ladder, up, pins, o)), minus: down ? diff(render(down.ladder, down.on, pins, o)) : -1 };
  },
};

/* ---------------- le chargement ---------------- */

// La ligne retenue recoit sa recette (une premiere visite : DARK DISCO 01, la ligne de START_LINE ; une ligne d'avant :
// adoptee), sans qu'un pas change ; STYLE et NOTES sautent a elle
if (!bassState.get().recipe) {
  const steps = bassState.get().steps;
  const r = bassFresh ? takeRecipe(1, 1) : migrate(steps, bassLoadedRecipe);
  mirrors(r, steps);
  bassState.set({ recipe: r });
}
