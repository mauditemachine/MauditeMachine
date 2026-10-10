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
 * La recette d'avant (v1, 2026-10-09 au matin : une graine, base, gen, anchor) : seulement lue, pour la migration
 * (bass/line.ts l'adopte, la ligne ne change pas).
 */
export interface BassRecipeV1 {
  seed: number;
  base: number | null;
  gen?: { style: number; density: number; slides: number; accents: number; range: number };
  anchor?: { steps: readonly BassStep[]; style: number };
}

/**
 * Un barreau de l'echelle (2026-10-09, NOTES : bass/gen.ts) : un pas et ce qu'il y joue (degres, comme BassStep), les
 * liaisons qui le suivent (holds) ; les tirages du generateur (absents sur une note ecrite, ou changee par MUTATE) :
 * slideU (le slide sous SLIDE PROB x le style), accU (accentuee si ACC PROB le passe), octR (l'octave a RANGE 1, 2, 3).
 */
export interface BassRung {
  step: number;
  deg: number;
  oct: number;
  acc: boolean;
  slide: boolean;
  holds: number[];
  slideU?: number;
  accU?: number;
  octR?: [number, number, number];
}
/** L'echelle d'une ligne : seize barreaux dans leur ordre ; rests, les silences ecrits (une prise d'usine) ; legato (SUB). */
export interface BassLadder {
  rungs: BassRung[];
  rests: number[];
  legato: boolean;
}
/** Ou un style a ete laisse sur cette ligne : sa prise, son nombre de barreaux actifs, son echelle si elle a mute. */
export interface BassTakeMem {
  take: number;
  on: number;
  ladder?: BassLadder;
}
/**
 * La recette d'une ligne (v2, 2026-10-09, Mika : "Je trouve Style et Density complexe a utiliser") : son style (0 a 10,
 * BASS_STYLES), sa prise (01 a 99 ; 0, une ligne d'avant les prises), combien de barreaux jouent (on : NOTES s'en deduit,
 * le compte des notes), son echelle (toujours gardee : un generateur change plus tard ne change jamais une ligne
 * gardee), mutated (MUTATE y est passe : ACID 07*), mem (ou chaque autre style a ete laisse sur cette ligne). Gardee
 * avec la ligne (ici, dans chaque pattern, dans chaque preset) ; bass/line.ts est le seul a l'ecrire.
 */
export interface BassRecipe {
  v: 2;
  style: number;
  take: number;
  on: number;
  ladder: BassLadder;
  mutated: boolean;
  mem: Partial<Record<number, BassTakeMem>>;
}

export const BASS_STEPS = 16;

/**
 * Les potards du son qu'un pas peut verrouiller (pas ceux du generateur, ni OCTAVE) ; LENGTH aussi (2026-10-08, la longueur de la note du pas).
 * La machine Elektron (2026-10-08, Mika : "on tourne un encodeur sur ce step et donc ce step a une valeur differente") : tout
 * le son de chaque page se verrouille, les crans compris (SUB OCT) ; restent globaux OCTAVE (le pas a son OCT) et les
 * reglages des effets eux-memes (DLY TIME, DLY FB, REV SIZE, REV TONE : une seule unite par effet, comme une Elektron).
 * Le moteur MONARK (2026-10-09) : les seize reglages de la voix de Minimoog se verrouillent aussi (les oscillateurs, le
 * melangeur, le contour du filtre) ; MODE et DRIFT restent globaux (une machine a un seul filtre, une seule usure).
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
  | 'reverb'
  | 'o1lvl'
  | 'o2wave'
  | 'o2range'
  | 'o2semi'
  | 'o2fine'
  | 'o2lvl'
  | 'o3wave'
  | 'o3range'
  | 'o3semi'
  | 'o3fine'
  | 'o3lvl'
  | 'noise'
  | 'feedback'
  | 'fattack'
  | 'fsustain'
  | 'fpol';
export const BASS_LOCKABLE: readonly BassLockId[] = [
  'cutoff', 'reso', 'envmod', 'decay', 'accent', 'wave', 'sub', 'drive', 'glide', 'volume', 'length', 'accdecay', 'sweep', 'keytrack', 'pw', 'suboct', 'tune', 'attack', 'adecay', 'sustain', 'release', 'delay', 'reverb',
  'o1lvl', 'o2wave', 'o2range', 'o2semi', 'o2fine', 'o2lvl', 'o3wave', 'o3range', 'o3semi', 'o3fine', 'o3lvl', 'noise', 'feedback', 'fattack', 'fsustain', 'fpol',
];
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
   * la page ; before : la ligne d'avant un geste du generateur (l'ecran GENERATOR montre les pas venus et partis) ;
   * note : la ligne du bas de l'ecran GENERATOR ; gen : GEN, MUTATE, CLEAR, leurs tenues (l'ecran GENERATOR, ms : son
   * temps, 1.6 s)
   */
  touched: { id: BassKnobId; at: number; enc?: number; before?: readonly BassStep[]; note?: string; gen?: boolean; ms?: number } | null;
  /**
   * la recette de la ligne (v2, 2026-10-09) ; null le temps du chargement seulement : bass/line.ts en donne une a toute
   * ligne (une ligne d'avant : adoptee, ses pas ne changent pas)
   */
  recipe: BassRecipe | null;
  /**
   * la longueur de la ligne, 1 a 16 pas (2026-10-10, Mika : "je ne sais pas comment on fait pour changer la longueur du
   * sequenceur, par exemple je voudrais 4 steps") : la sequence boucle sur les len premiers pas
   */
  len: number;
}

const KEY = 'mm.v4.bass.state';
/** La longueur de la ligne (2026-10-10), a part : une sauvegarde d'avant se lit toujours (16). */
const LEN_KEY = 'mm.v4.bass.len';
/** Une longueur propre : un entier de 1 a 16, 16 pour tout le reste. */
export const cleanLen = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.min(16, Math.round(v))) : 16);
function loadLen(): number {
  try {
    return cleanLen(JSON.parse(window.localStorage.getItem(LEN_KEY) ?? '16') as unknown);
  } catch {
    return 16;
  }
}
/** La recette de la ligne (2026-10-09), a part : une sauvegarde d'avant (la suite seule sous KEY) se lit toujours. */
const RECIPE_KEY = 'mm.v4.bass.recipe';
const off = (): BassStep => ({ kind: 'off', deg: 0, oct: 0, acc: false, slide: false });

/**
 * La ligne de depart d'une premiere visite (2026-10-09, la prise 01 de DARK DISCO a son compte, 12 notes : la ligne du
 * preset d'usine A01, le genre de Mika d'abord ; elle joue le patch de depart du moteur). Ecrite ici telle que
 * bass/gen.ts render la rend (un test hors ligne verifie qu'elle est la ligne de DARK DISCO 01 et celle du preset 0) ;
 * bass/line.ts lui donne sa recette au chargement : un degre, + une octave, A l'accent, S le slide, - une liaison, .
 * un vide.
 */
export const START_LINE = '0A . 0 0+ 0 . 0 0+ 0A . 0 0+ 0 . 6 4';
/** Rien de retenu au chargement (une premiere visite) : bass/line.ts y pose DARK DISCO 01. */
export let bassFresh = false;
function initial(): BassStep[] {
  return START_LINE.split(' ').map((t): BassStep => {
    if (t === '.') return { ...off(), src: 'gen' };
    if (t === '-') return { kind: 'tie', deg: 0, oct: 0, acc: false, slide: false, src: 'gen' };
    const m = /^(\d+)(\+{1,2}|_?)(A?)(S?)$/.exec(t);
    return { kind: 'note', deg: Number(m?.[1] ?? 0), oct: m?.[2] === '_' ? -1 : (m?.[2] ?? '').length, acc: !!m?.[3], slide: !!m?.[4], src: 'gen' };
  });
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

const num = (x: unknown, lo: number, hi: number, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
const int = (x: unknown, lo: number, hi: number, d: number): number => Math.round(num(x, lo, hi, d));

/** Une echelle lue : seize barreaux, un par pas ; null sinon. */
export function cleanLadder(o: unknown): BassLadder | null {
  if (!o || typeof o !== 'object') return null;
  const l = o as Partial<BassLadder>;
  if (!Array.isArray(l.rungs) || l.rungs.length !== BASS_STEPS) return null;
  const seen = new Set<number>();
  const rungs: BassRung[] = [];
  for (const x of l.rungs as unknown[]) {
    if (!x || typeof x !== 'object') return null;
    const r = x as Partial<BassRung>;
    const step = int(r.step, -1, BASS_STEPS, -1);
    if (step < 0 || step >= BASS_STEPS || seen.has(step)) return null;
    seen.add(step);
    const out: BassRung = { step, deg: int(r.deg, 0, 20, 0), oct: int(r.oct, -1, 2, 0), acc: !!r.acc, slide: !!r.slide, holds: Array.isArray(r.holds) ? r.holds.filter((h): h is number => Number.isInteger(h) && h > step && h < BASS_STEPS) : [] };
    if (typeof r.slideU === 'number' && Number.isFinite(r.slideU)) out.slideU = r.slideU;
    if (typeof r.accU === 'number' && Number.isFinite(r.accU)) out.accU = r.accU;
    if (Array.isArray(r.octR) && r.octR.length === 3) out.octR = [int(r.octR[0], -1, 2, 0), int(r.octR[1], -1, 2, 0), int(r.octR[2], -1, 2, 0)];
    rungs.push(out);
  }
  const rests = Array.isArray(l.rests) ? l.rests.filter((h): h is number => Number.isInteger(h) && h >= 0 && h < BASS_STEPS) : [];
  return { rungs, rests, legato: !!l.legato };
}

/** Une recette lue (stockage, pattern, preset) : v2 seulement ; null sinon (une v1 : cleanRecipeV1, la migration). */
export function cleanRecipe(o: unknown): BassRecipe | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Partial<BassRecipe>;
  if (r.v !== 2) return null;
  const ladder = cleanLadder(r.ladder);
  if (!ladder) return null;
  const mem: Partial<Record<number, BassTakeMem>> = {};
  if (r.mem && typeof r.mem === 'object') {
    for (const [k, m] of Object.entries(r.mem as Record<string, unknown>)) {
      const st = Number(k);
      if (!Number.isInteger(st) || st < 0 || st > 10 || !m || typeof m !== 'object') continue;
      const x = m as Partial<BassTakeMem>;
      const one: BassTakeMem = { take: int(x.take, 0, 99, 1), on: int(x.on, 0, BASS_STEPS, 0) };
      const lad = x.ladder ? cleanLadder(x.ladder) : null;
      if (lad) one.ladder = lad;
      mem[st] = one;
    }
  }
  return { v: 2, style: int(r.style, 0, 10, 1), take: int(r.take, 0, 99, 1), on: int(r.on, 0, BASS_STEPS, 0), ladder, mutated: !!r.mutated, mem };
}

/** Une recette d'avant (v1 : une graine), pour la migration ; null si elle n'en est pas une. */
export function cleanRecipeV1(o: unknown): BassRecipeV1 | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Partial<BassRecipeV1>;
  if (typeof r.seed !== 'number' || !Number.isFinite(r.seed)) return null;
  const base = typeof r.base === 'number' && Number.isFinite(r.base) ? Math.min(1, Math.max(0, r.base)) : null;
  const out: BassRecipeV1 = { seed: r.seed >>> 0, base };
  const g = r.gen as Record<string, unknown> | undefined;
  if (g && typeof g === 'object') {
    const n = (k: string): number => num(g[k], 0, 1, 0);
    out.gen = { style: n('style'), density: n('density'), slides: n('slides'), accents: n('accents'), range: n('range') };
  }
  const a = r.anchor as { steps?: unknown; style?: unknown } | undefined;
  const steps = a && typeof a === 'object' ? cleanSteps(a.steps) : null;
  if (steps && typeof a?.style === 'number' && Number.isFinite(a.style)) out.anchor = { steps, style: Math.min(1, Math.max(0, a.style)) };
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

/**
 * La recette lue au chargement telle quelle (2026-10-09) : bass/line.ts la lit (une v2, une v1 a migrer, rien) puis
 * l'oublie.
 */
export let bassLoadedRecipe: unknown = null;

/** La ligne retenue ; une premiere visite (rien de retenu, ou illisible) : la ligne de depart (bassFresh). */
function load(): BassStep[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const steps = raw ? cleanSteps(JSON.parse(raw) as unknown) : null;
    if (!steps) {
      bassFresh = true;
      return initial();
    }
    try {
      bassLoadedRecipe = JSON.parse(window.localStorage.getItem(RECIPE_KEY) ?? 'null') as unknown;
    } catch {
      bassLoadedRecipe = null;
    }
    return steps;
  } catch {
    bassFresh = true;
    return initial();
  }
}

const loaded = typeof window === 'undefined' ? initial() : load();
let state: BassState = { steps: loaded, sel: 0, running: false, message: null, gen: 0, lock: -1, touched: null, recipe: null, len: typeof window === 'undefined' ? 16 : loadLen() };
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
    if (patch.len !== undefined) patch = { ...patch, len: cleanLen(patch.len) };
    const lenChanged = patch.len !== undefined && patch.len !== state.len;
    state = { ...state, ...patch };
    if (keep) save();
    if (lenChanged) {
      try {
        window.localStorage.setItem(LEN_KEY, String(state.len));
      } catch {
        /* stockage indisponible : la longueur vit pour la visite */
      }
    }
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
