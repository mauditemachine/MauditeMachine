/**
 * UNDO et REDO (2026-10-11, Mika : "faut vraiment que tu fasses un bouton UNDO juste a gauche de MIDI. Je voulais
 * enregistrer un preset que j'avais fait mais malheureusement ca ne fonctionne pas bien.. du coup j'ai tout perdu..
 * parce que j'ai du passer un preset nouveau.. je voulais revenir en arriere mais ca ne fonctionne pas, CMD + Z").
 * Une seule histoire pour les machines qu'on joue : le MM-RYTM, le MM-ARP, et le MM-BASS quand il est sur la table.
 * - Une etape garde l'etat d'une machine AVANT un changement, sous la forme des presets (state/presets.ts capture et
 *   apply) : ce qu'un preset garde, UNDO le rend ; ce qu'on ajoutera aux presets, UNDO le rendra aussi.
 * - Les gestes se regroupent en rafales : le premier changement pose l'etat stable d'avant (deja connu : rien a
 *   capturer a ce moment) ; 600 ms sans geste (2 s au plus pendant un potard qu'on tourne), l'etat d'arrivee devient
 *   le nouvel etat stable ; une rafale revenue a son point de depart ne laisse rien.
 * - La lecture, la tete de lecture, la voix choisie, les pages et les onglets ne comptent pas : ils ne sont pas dans
 *   l'etat d'un preset (une signature des stores le voit sans rien capturer). Ni ce que font UNDO et REDO.
 * - RANDOM, CLEAR et un preset charge (le mode presets, PREV et NEXT) font chacun leur etape (boundary, appele par
 *   actions.ts) : "mon reglage, puis un preset" fait deux etapes, jamais une. Des presets parcourus a la suite (NEXT
 *   NEXT NEXT, rien d'autre entre eux) n'en font qu'une, celle d'avant le premier : UNDO rend ce qui jouait avant de
 *   parcourir (PREV et NEXT ramenent a un preset de la liste), et cinquante presets parcourus ne poussent pas les
 *   reglages de Mika hors de l'histoire.
 * - Les emplacements d'EDIT (A01 a A16 du MM-RYTM et du MM-BASS) : changer d'emplacement n'est pas une etape (une
 *   chaine qui joue en change a chaque mesure). Une etape prise sur un autre emplacement rend le son, les effets et
 *   le tempo, et laisse le motif de l'emplacement qu'on regarde : il ne recoit jamais le motif d'un autre.
 * - Cinquante etapes en memoire, un REDO apres chaque UNDO (un nouveau changement l'efface). Les vingt dernieres de
 *   chaque pile sont retenues sous mm.v4.undo.1 (1,5 Mo au plus : moins d'etapes plutot qu'un echec) : apres un
 *   rechargement, UNDO revient encore avant le mauvais preset. L'etat de depart d'une machine, lui, se lit au
 *   chargement (capture) : c'est ce qui joue, ses stores l'ont retenu.
 * Pour les tests : window.__v4.undo (debug.ts).
 */

import { mix } from '../audio/drums';
import { kit } from '../audio/kit';
import { INSTRUMENTS, STEP_COUNT, pattern } from '../audio/pattern';
import { voiceFx } from '../audio/voicefx';
import { bassParams } from '../bass/params';
import { BASS_STEPS, bassState, emptyStep } from '../bass/state';
import { arp } from '../voyager/arp';
import { voyMsg } from '../voyager/msg';
import { voyParams } from '../voyager/params';
import { seq } from '../voyager/seq';
import { bassLoad } from './bassload';
import { BASS, VOYAGER, focus } from './focus';
import { lcdMessage } from './lcdMessage';
import { patterns } from './patterns';
import { presetMode } from './presetMode';
import { apply, capture, type PresetMachine } from './presets';

/** L'etat d'une machine, tel qu'un preset le garde. */
type Snap = ReturnType<typeof capture>;

/** Ce qui a fait l'etape : un geste, RANDOM ou CLEAR (step), un preset charge. */
export type UndoKind = 'edit' | 'step' | 'preset';

export interface UndoEntry {
  m: PresetMachine;
  /** l'etat de la machine avant le changement */
  data: Snap;
  /** Date.now() */
  at: number;
  /** l'emplacement d'EDIT d'alors (MM-RYTM, MM-BASS), null sans emplacement */
  slot: number | null;
  kind: UndoKind;
}

/** Ce que l'en-tete montre. */
export interface UndoView {
  /** etapes a defaire (une rafale en cours compte deja) */
  undo: number;
  redo: number;
  /** la machine que le prochain UNDO touche, null : rien */
  next: PresetMachine | null;
  nextRedo: PresetMachine | null;
}

const QUIET_MS = 600;
const MAX_MS = 2000;
const DEPTH = 50;
const KEEP = 20;
const KEY = 'mm.v4.undo.1';
const MAX_CHARS = 1_500_000;
const SAVE_MS = 400;

/** Les machines suivies : celles de la table. */
const MS: readonly PresetMachine[] = ['mm808', ...(VOYAGER ? (['voy'] as const) : []), ...(VOYAGER && BASS ? (['bass'] as const) : [])];

export const UNDO_MACHINE_NAME: Readonly<Record<PresetMachine, string>> = { mm808: 'MM-RYTM', voy: 'MM-ARP', bass: 'MM-BASS' };

/* ---------------- les emplacements d'EDIT ---------------- */

/** Les emplacements du MM-BASS (bass/patterns.ts), ce qu'on en lit. */
interface BassSlots {
  get(): { cur: number; slots: readonly (readonly unknown[] | null)[]; recipes: readonly unknown[]; lens: readonly number[] };
  subscribe(fn: () => void): () => void;
  select(i: number): void;
}

/** Ils arrivent avec le code du MM-BASS (state/bassload.ts) ; null avant. */
let bassSlots: BassSlots | null = null;

function slotOf(m: PresetMachine): number | null {
  if (m === 'mm808') return patterns.get().cur;
  if (m === 'bass') return bassSlots?.get().cur ?? null;
  return null;
}

type Part = Record<string, unknown>;
/** Les cles d'un etat qui appartiennent a l'emplacement (le motif et ses verrous ; la ligne, sa recette, sa longueur). */
const PART_KEYS: Readonly<Record<PresetMachine, readonly string[]>> = { mm808: ['steps', 'locks'], bass: ['steps', 'recipe', 'len'], voy: [] };

function partOf(m: PresetMachine, d: Snap): Part {
  const o = d as unknown as Part;
  const out: Part = {};
  for (const k of PART_KEYS[m]) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

/** Un etat dont la part de l'emplacement vient d'ailleurs. */
function withPart(m: PresetMachine, d: Snap, part: Part): Snap {
  const out = { ...(d as unknown as Part) };
  for (const k of PART_KEYS[m]) delete out[k];
  return { ...out, ...part } as unknown as Snap;
}

/** La part retenue dans un emplacement (son motif tel que la derniere edition l'y a laisse). */
function storedPart(m: PresetMachine, slot: number): Part {
  if (m === 'mm808') {
    const p = patterns.get();
    const steps = p.slots[slot] ?? (Object.fromEntries(INSTRUMENTS.map((k) => [k, '0'.repeat(STEP_COUNT)])) as Record<string, string>);
    const locks = p.locks[slot];
    return { steps: { ...steps }, ...(locks ? { locks: JSON.parse(JSON.stringify(locks)) as unknown } : {}) };
  }
  const b = bassSlots?.get();
  const steps = b?.slots[slot];
  const len = b?.lens[slot] ?? 16;
  const recipe = b?.recipes[slot];
  return {
    steps: steps ? (JSON.parse(JSON.stringify(steps)) as unknown) : Array.from({ length: BASS_STEPS }, emptyStep),
    ...(recipe ? { recipe: JSON.parse(JSON.stringify(recipe)) as unknown } : {}),
    ...(len !== 16 ? { len } : {}),
  };
}

/* ---------------- la signature des stores (rien de capture) ---------------- */

function sigOf(m: PresetMachine): readonly unknown[] {
  if (m === 'mm808') {
    const p = pattern.get();
    return [p.steps, p.bpm, p.locks, pattern.fx.get(), mix.stretch, voiceFx.get(), kit.get()];
  }
  if (m === 'voy') return [voyParams.get(), seq.get(), arp.get().prog];
  const s = bassState.get();
  return [bassParams.get(), s.steps, s.recipe, s.len];
}

const sameSig = (a: readonly unknown[], b: readonly unknown[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** Le JSON aux cles triees : deux etats egaux s'ecrivent pareil, quel que soit l'ordre de leurs cles (un kit relu). */
function sorted(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? 'null';
  if (Array.isArray(x)) return `[${x.map(sorted).join(',')}]`;
  const o = x as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${sorted(o[k])}`).join(',')}}`;
}

/**
 * La comparaison de deux etats, sans les crans des sons du kit (kit, lus sur la liste des echantillons du moment :
 * les echantillons de Mika qui arrivent les deplacent ; machines, samples et layers disent deja tout).
 */
function norm(m: PresetMachine, d: Snap): string {
  return sorted(m === 'mm808' ? { ...(d as unknown as Part), kit: undefined } : d);
}

const clone = (d: Snap): Snap => JSON.parse(JSON.stringify(d)) as Snap;

/* ---------------- l'histoire ---------------- */

interface Burst {
  entry: UndoEntry;
  /** l'etape d'un preset precedent, reprise (des presets parcourus a la suite) */
  merged: boolean;
  start: number;
  timer: number;
  kind: UndoKind;
}

interface Track {
  /** l'etat stable : celui d'avant la prochaine rafale */
  stable: Snap;
  slot: number | null;
  sig: readonly unknown[];
  burst: Burst | null;
  /** un examen attend la fin de la tache */
  queued: boolean;
  /** MM-ARP : l'arpege jouait au dernier examen */
  running: boolean;
}

const tracks: Partial<Record<PresetMachine, Track>> = {};
let undoStack: UndoEntry[] = [];
let redoStack: UndoEntry[] = [];
/** La derniere etape d'un preset charge : un preset charge juste apres la reprend. */
let mergeable: UndoEntry | null = null;
/** Ce que la tache en cours fait d'un bloc (RANDOM, CLEAR, un preset) : une etape a elle, tout de suite fermee. */
const seal: Partial<Record<PresetMachine, UndoKind>> = {};
/** UNDO et REDO posent un etat : rien ne s'enregistre. */
let applying = false;

const listeners = new Set<() => void>();
let view: UndoView = { undo: 0, redo: 0, next: null, nextRedo: null };

function emit(): void {
  const top = undoStack[undoStack.length - 1];
  const rtop = redoStack[redoStack.length - 1];
  const next: UndoView = { undo: undoStack.length, redo: redoStack.length, next: top?.m ?? null, nextRedo: rtop?.m ?? null };
  if (next.undo === view.undo && next.redo === view.redo && next.next === view.next && next.nextRedo === view.nextRedo) return;
  view = next;
  listeners.forEach((fn) => fn());
}

function pushUndo(e: UndoEntry): void {
  undoStack.push(e);
  if (undoStack.length > DEPTH) undoStack = undoStack.slice(-DEPTH);
}

function removeEntry(e: UndoEntry): void {
  const i = undoStack.lastIndexOf(e);
  if (i >= 0) undoStack.splice(i, 1);
}

/** L'etat stable refait sur ce qui joue (apres une rafale, un UNDO, un changement d'emplacement). */
function rebase(t: Track, m: PresetMachine, data: Snap = capture(m)): void {
  t.stable = data;
  t.sig = sigOf(m);
  t.slot = slotOf(m);
  t.running = m === 'voy' && arp.get().running;
}

/** La rafale se ferme : l'etat d'arrivee (end) devient stable ; revenue a son depart, elle ne laisse rien. */
function settle(m: PresetMachine, end?: Snap): void {
  const t = tracks[m];
  const b = t?.burst;
  if (!t || !b) return;
  window.clearTimeout(b.timer);
  t.burst = null;
  const now = capture(m);
  const last = end ?? now;
  if (norm(m, last) === norm(m, b.entry.data)) {
    removeEntry(b.entry);
    if (mergeable === b.entry) mergeable = null;
  } else {
    redoStack = [];
    mergeable = b.kind === 'preset' ? b.entry : null;
  }
  rebase(t, m, now);
  emit();
  persist();
}

/** Un changement vu : la rafale commence (l'etat stable d'avant devient une etape) ou continue. */
function change(m: PresetMachine, t: Track): void {
  const kind = seal[m];
  if (!t.burst) {
    // Un preset charge juste apres un autre (rien entre eux, ni ailleurs) : la meme etape, celle d'avant le premier
    const prev = mergeable;
    const merged = kind === 'preset' && prev !== null && prev.m === m && undoStack[undoStack.length - 1] === prev;
    let entry: UndoEntry;
    if (merged && prev) entry = prev;
    else {
      entry = { m, data: t.stable, at: Date.now(), slot: t.slot, kind: kind ?? 'edit' };
      pushUndo(entry);
    }
    // La rafale fermee le redira (un preset qui reste)
    mergeable = null;
    t.burst = { entry, merged, start: performance.now(), timer: 0, kind: kind ?? 'edit' };
    emit();
  }
  const b = t.burst;
  window.clearTimeout(b.timer);
  // RANDOM, CLEAR, un preset : l'etape se ferme avec la tache
  if (kind) {
    settle(m);
    return;
  }
  const wait = Math.max(0, Math.min(QUIET_MS, b.start + MAX_MS - performance.now()));
  b.timer = window.setTimeout(() => settle(m), wait);
  persist();
}

/**
 * Un autre emplacement (EDIT, ou la chaine qui avance) : pas une etape. Une rafale en cours se ferme sur ce qu'elle
 * avait fait (le motif de l'emplacement quitte, tel que retenu, avec le son du moment) ; l'etat stable est celui du
 * nouvel emplacement.
 */
function slotSwitch(m: PresetMachine, t: Track, from: number): void {
  if (t.burst) settle(m, withPart(m, capture(m), storedPart(m, from)));
  else rebase(t, m);
}

function examine(m: PresetMachine): void {
  const t = tracks[m];
  if (!t || !t.queued) return;
  t.queued = false;
  if (applying) return;
  const slot = slotOf(m);
  if (slot !== t.slot) {
    if (t.slot !== null && slot !== null) {
      slotSwitch(m, t, t.slot);
      return;
    }
    // Les emplacements du MM-BASS arrivent : on le sait maintenant
    t.slot = slot;
  }
  const sig = sigOf(m);
  const started = m === 'voy' && arp.get().running && !t.running;
  if (m === 'voy') t.running = arp.get().running;
  if (sameSig(sig, t.sig)) return;
  // RUN sur une progression vide part sur F#m (voyager/arp.ts toggleRun) : la lecture, pas un reglage
  if (started && sig[0] === t.sig[0] && sig[1] === t.sig[1] && (t.sig[2] as readonly number[]).length === 0) {
    if (t.burst) t.sig = sig;
    else rebase(t, m);
    return;
  }
  t.sig = sig;
  change(m, t);
}

/** Un store a bouge : examine a la fin de la tache (un geste qui touche plusieurs stores : un seul examen). */
function touch(m: PresetMachine): void {
  const t = tracks[m];
  if (!t || applying || t.queued) return;
  t.queued = true;
  queueMicrotask(() => {
    try {
      examine(m);
    } catch {
      // Jamais une machine arretee par UNDO : la rafale est oubliee, l'etat stable refait
      t.queued = false;
      t.burst = null;
      try {
        rebase(t, m);
      } catch {
        /* rien de plus */
      }
    }
  });
}

/** Tout ce qui attend : examine et ferme. */
function flush(ms: readonly PresetMachine[] = MS): void {
  for (const m of ms) {
    examine(m);
    settle(m);
  }
}

/* ---------------- poser un etat ---------------- */

const MSG_MS = 1200;

function say(m: PresetMachine | null, text: string): void {
  if (m === 'mm808') lcdMessage.show(text, MSG_MS);
  else if (m === 'voy') voyMsg.show(text, MSG_MS);
  else if (m === 'bass') bassState.say(text, MSG_MS);
}

/** L'etat de l'etape sur la machine ; false si elle n'a pas pu se poser (une etape illisible). */
function put(e: UndoEntry, other: UndoEntry[]): boolean {
  const t = tracks[e.m];
  if (!t) return false;
  const now = capture(e.m);
  const nowSlot = slotOf(e.m);
  let data = e.data;
  if (e.slot !== null && nowSlot !== null && e.slot !== nowSlot) {
    // Une etape d'un autre emplacement : on y retourne et elle s'y pose (avant, le motif de celui qu'on regardait
    // restait : une etape qui ne changeait que ses pas ne faisait rien) ; sans banque : le motif d'ici reste
    const sel = e.m === 'mm808' ? patterns : e.m === 'bass' ? bassSlots : null;
    if (sel) {
      applying = true;
      try {
        sel.select(e.slot);
      } finally {
        applying = false;
      }
    } else data = withPart(e.m, e.data, partOf(e.m, now));
  }
  let ok = true;
  applying = true;
  try {
    apply(e.m, clone(data));
  } catch {
    ok = false;
    // Une etape qu'apply ne lit plus (une version d'avant) : ce qui jouait revient
    try {
      apply(e.m, clone(now));
    } catch {
      /* rien de plus a faire */
    }
  } finally {
    applying = false;
  }
  rebase(t, e.m);
  if (!ok) return false;
  other.push({ m: e.m, data: now, at: Date.now(), slot: nowSlot, kind: e.kind });
  if (other.length > DEPTH) other.splice(0, other.length - DEPTH);
  mergeable = null;
  return true;
}

function step(from: 'undo' | 'redo'): boolean {
  try {
    return stepNow(from);
  } catch {
    applying = false;
    emit();
    return false;
  }
}

function stepNow(from: 'undo' | 'redo'): boolean {
  flush();
  for (;;) {
    const e = from === 'undo' ? undoStack.pop() : redoStack.pop();
    if (!e) {
      say(focusedMachine(), from === 'undo' ? 'NOTHING TO UNDO' : 'NOTHING TO REDO');
      emit();
      return false;
    }
    if (put(e, from === 'undo' ? redoStack : undoStack)) {
      // Le mode presets montrait le preset charge : il se ferme, l'ecran montre ce qui joue (et UNDO)
      if (presetMode.on(e.m)) presetMode.close();
      say(e.m, from === 'undo' ? 'UNDO' : 'REDO');
      emit();
      persist();
      return true;
    }
  }
}

function focusedMachine(): PresetMachine | null {
  const f = focus.machine();
  return f && f !== 'dj' && (MS as readonly string[]).includes(f) ? f : null;
}

/* ---------------- retenu dans le navigateur ---------------- */

let saveTimer = 0;

function persist(): void {
  if (typeof window === 'undefined') return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(write, SAVE_MS);
}

function write(): void {
  window.clearTimeout(saveTimer);
  saveTimer = 0;
  const last = (xs: UndoEntry[], n: number): UndoEntry[] => (n > 0 ? xs.slice(-n) : []);
  // Trop gros, ou le stockage plein : moins d'etapes, jamais un echec
  for (const n of [KEEP, 10, 5, 2, 1, 0]) {
    const json = JSON.stringify({ v: 1, at: Date.now(), undo: last(undoStack, n), redo: last(redoStack, n) });
    if (json.length > MAX_CHARS) continue;
    try {
      window.localStorage.setItem(KEY, json);
      return;
    } catch {
      /* stockage plein : moins d'etapes */
    }
  }
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : l'histoire vit pour la visite */
  }
}

const okData = (m: PresetMachine, d: unknown): boolean => {
  if (!d || typeof d !== 'object') return false;
  const o = d as Part;
  if (m === 'mm808') return !!o.steps && typeof o.steps === 'object' && !!o.voices && typeof o.voices === 'object' && !!o.fx && typeof o.bpm === 'number';
  if (m === 'voy') return !!o.knobs && typeof o.knobs === 'object' && !!o.seq && Array.isArray(o.prog);
  return !!o.params && typeof o.params === 'object' && Array.isArray(o.steps);
};

function readEntries(xs: unknown): UndoEntry[] {
  if (!Array.isArray(xs)) return [];
  const out: UndoEntry[] = [];
  for (const x of xs.slice(-KEEP)) {
    const e = x as Partial<UndoEntry> | null;
    if (!e || !MS.includes(e.m as PresetMachine) || !okData(e.m as PresetMachine, e.data)) continue;
    const kind: UndoKind = e.kind === 'step' || e.kind === 'preset' ? e.kind : 'edit';
    out.push({ m: e.m as PresetMachine, data: e.data as Snap, at: typeof e.at === 'number' ? e.at : 0, slot: typeof e.slot === 'number' ? e.slot : null, kind });
  }
  return out;
}

function load(): void {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as { v?: number; undo?: unknown; redo?: unknown } | null;
    if (!raw || raw.v !== 1) return;
    undoStack = readEntries(raw.undo);
    redoStack = readEntries(raw.redo);
  } catch {
    undoStack = [];
    redoStack = [];
  }
}

/* ---------------- le depart ---------------- */

function watch(m: PresetMachine, stores: readonly { subscribe(fn: () => void): () => void }[]): void {
  tracks[m] = { stable: capture(m), slot: slotOf(m), sig: sigOf(m), burst: null, queued: false, running: m === 'voy' && arp.get().running };
  for (const s of stores) s.subscribe(() => touch(m));
}

/** Une machine suivie ; un etat illisible au depart : elle ne l'est pas (UNDO ne doit jamais empecher le site de partir). */
function safeWatch(m: PresetMachine, stores: readonly { subscribe(fn: () => void): () => void }[]): void {
  try {
    watch(m, stores);
  } catch {
    delete tracks[m];
  }
}

if (typeof window !== 'undefined') {
  load();
  safeWatch('mm808', [pattern, pattern.fx, mix, voiceFx, kit, patterns]);
  if (MS.includes('voy')) safeWatch('voy', [voyParams, seq, arp]);
  if (MS.includes('bass')) {
    safeWatch('bass', [bassParams, bassState]);
    // Ses emplacements (bass/patterns.ts) arrivent avec le code du MM-BASS
    const hook = (): void => {
      if (bassSlots || !bassLoad.get()) return;
      void import('../bass/patterns').then((mod) => {
        if (bassSlots) return;
        const slots: BassSlots = mod.bassPatterns;
        bassSlots = slots;
        slots.subscribe(() => touch('bass'));
        const t = tracks.bass;
        if (t && !t.burst) t.slot = slotOf('bass');
      });
    };
    bassLoad.subscribe(hook);
    hook();
  }
  emit();
  // La page s'en va : ce qui attend se ferme et s'ecrit tout de suite
  window.addEventListener('pagehide', () => {
    try {
      flush();
    } catch {
      /* ce qui attend reste comme il est */
    }
    write();
  });
}

export const undo = {
  get: (): UndoView => view,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Defait la derniere etape (toutes machines) ; false s'il n'y en avait pas. */
  undo: (): boolean => step('undo'),
  redo: (): boolean => step('redo'),
  /**
   * Ferme tout de suite la rafale en cours (de cette machine, ou de toutes) : le prochain changement fait une autre
   * etape. kind : ce que fait la tache en cours (RANDOM, CLEAR : 'step' ; un preset : 'preset') fait une etape a
   * elle, fermee avec la tache.
   */
  boundary(m?: PresetMachine, kind?: Exclude<UndoKind, 'edit'>): void {
    if (typeof window === 'undefined') return;
    if (m && !tracks[m]) return;
    flush(m ? [m] : MS);
    if (m && kind) {
      seal[m] = kind;
      window.setTimeout(() => {
        delete seal[m];
      }, 0);
    }
  },
  /** Tests : les deux piles (les plus recentes en dernier), sans les etats ; pending : les rafales ouvertes. */
  debug(): { undo: { m: PresetMachine; kind: UndoKind; slot: number | null; at: number }[]; redo: { m: PresetMachine; kind: UndoKind; slot: number | null; at: number }[]; pending: PresetMachine[]; machines: readonly PresetMachine[]; slots: Record<PresetMachine, number | null> } {
    const lite = (e: UndoEntry): { m: PresetMachine; kind: UndoKind; slot: number | null; at: number } => ({ m: e.m, kind: e.kind, slot: e.slot, at: e.at });
    return { undo: undoStack.map(lite), redo: redoStack.map(lite), pending: MS.filter((m) => !!tracks[m]?.burst), machines: MS, slots: Object.fromEntries(MS.map((m) => [m, slotOf(m)])) as Record<PresetMachine, number | null> };
  },
  /** Tests : l'etat d'une etape (0 : la plus recente). */
  peek: (i = 0, from: 'undo' | 'redo' = 'undo'): Snap | null => {
    const s = from === 'undo' ? undoStack : redoStack;
    const e = s[s.length - 1 - i];
    return e ? clone(e.data) : null;
  },
  /** Tests : l'histoire vide (memoire et navigateur), l'etat stable refait. */
  reset(): void {
    for (const m of MS) {
      const t = tracks[m];
      if (!t) continue;
      if (t.burst) window.clearTimeout(t.burst.timer);
      t.burst = null;
      rebase(t, m);
    }
    undoStack = [];
    redoStack = [];
    mergeable = null;
    write();
    emit();
  },
  /** Ecrit tout de suite (tests ; la page qui s'en va le fait seule). */
  save(): void {
    flush();
    write();
  },
};
