/**
 * Les huit potards de la face du desktop (2026-10-27, Mika : "les nouveaux knobs j'aime ca ! mais ils devraient etre
 * assignes aux fonctions de la page qui est cliquee, comme la DIGITAKT ; les knobs de droite doivent se refleter") :
 * ce que montre chaque potard, lu en un seul endroit par les anneaux et les capuchons 3D (scene/renderer.ts), la machine
 * sans WebGL (fallback/StaticMachine.tsx), les jumeaux, les tests et, en phase 3, le pont du boitier (les potards
 * motorises vont a pos quand la valeur change sans venir d'eux).
 *
 * Huit objets gardes et mis a jour sur place (aucune allocation par changement) ; leur partie fixe (le bloc, son nom, son
 * etat, ses crans) ne se refait que quand la signature change (l'ecran, la voix, le P-LOCK, EDIT, la liste des samples) ;
 * leur partie vive (pos, la course 0 a 1 de ce qu'ils reglent) a chaque changement d'une valeur. Les notifications se
 * groupent dans une microtache et disent leur cause : page (l'ecran ou les blocs ont change), voice (seule la voix),
 * lock (le P-LOCK), pot (un potard tourne a la main, le MIDI, une touche), value (un preset, UNDO, RANDOM, un bloc de
 * l'ecran glisse, une autre cible MIDI).
 */

import { curScreen, dialRange, dialSteps, knobBlock, knobDialOf, lockReadStep, pageKnobBand, pageKnobLive, pageKnobShown, pageLockView, sceneIdOfDial, type DialId } from '../actions';
import { mix } from '../audio/drums';
import { morph } from '../audio/morph';
import { kit } from '../audio/kit';
import { pattern } from '../audio/pattern';
import { samplesChanged, samplesVersion } from '../audio/samples';
import { voiceFx } from '../audio/voicefx';
import { faceTouch } from '../state/ctl';
import { editor } from '../state/editor';
import { rytmLock } from '../state/rytmLock';
import { rytmPage } from '../state/rytmPage';
import { sceneCtl } from '../state/sceneCtl';
import { PAGE_KNOB_LETTERS, type KnobTone } from '../theme';
import { pageSlots } from './pages';
import type { SceneId } from './sceneData';
import { bindingOf, from01, sceneRole, type SceneBinding } from './sceneParams';

export type { KnobTone };

export interface FaceKnobView {
  /** 0 a 7 */
  readonly k: number;
  /** A a H (la serigraphie) */
  readonly letter: string;
  /** le bloc qu'il tourne (knobBlock) ; null : rien sur sa case */
  readonly block: number | null;
  /** il tourne le bloc d'une autre case (un bloc haut, un dessin large) */
  readonly alias: boolean;
  readonly dial: DialId;
  /** le nom de son bloc ('' : aucun) : le jumeau, INFOS, la legende optionnelle */
  readonly label: string;
  /** off : un reglage de voix sans voix, SOUND d'une voix a un seul son */
  readonly state: 'live' | 'off' | 'picture' | 'empty';
  /** 0 a 1 : l'anneau allume, l'angle du capuchon, la cible du moteur (phase 3) */
  readonly pos: number;
  readonly bipolar: boolean;
  /** ses crans (0 : continu) : les crans virtuels du potard motorise (phase 3) */
  readonly steps: number;
  readonly tone: KnobTone;
  /** son id absolu dans le registre (2026-10-27, sceneIdOfDial : la cle d'une scene, le pont du boitier) ; null : aucun */
  readonly target: string | null;
  /**
   * la bande du crossfader (2026-10-27, P2-20) : sa course a x 0 (A) puis a x 1 (B), la ou le crossfader peut le mener ;
   * null : son reglage ne se morphe pas (ou le P-LOCK montre un verrou). Le meme tableau, mis a jour sur place.
   */
  readonly band: readonly [number, number] | null;
}

/**
 * scene (2026-10-27, P2-19) : une scene armee ou desarmee, les teintes et les capuchons vont a la valeur de la scene ;
 * xfade (P2-20) : seul le crossfader a bouge, les capuchons le suivent tout de suite (aucun moteur, aucune ombre en route)
 */
export type KnobCause = 'pot' | 'page' | 'voice' | 'lock' | 'scene' | 'xfade' | 'value';
export interface FaceKnobChange {
  readonly cause: KnobCause;
  /** les potards dont la vue a change */
  readonly moved: readonly number[];
}

type Mut = { -readonly [K in keyof FaceKnobView]: FaceKnobView[K] };

const N = 8;
/** Un potard tourne il y a moins de POT_MS : la cause est la main (le moteur ne le deplace pas). */
const POT_MS = 120;

const views: Mut[] = Array.from({ length: N }, (_, k) => ({
  k,
  letter: PAGE_KNOB_LETTERS[k] ?? '?',
  block: null,
  alias: false,
  dial: `p:${k}` as DialId,
  label: '',
  state: 'empty',
  pos: 0,
  bipolar: false,
  steps: 0,
  tone: 'off',
  target: null,
  band: null,
}));
/** les bandes, une par potard (aucune allocation par changement) */
const bands: [number, number][] = Array.from({ length: N }, () => [0, 0]);
/**
 * Ce qu'un pas du crossfader relit (P2-20, sans allocation) : la liaison de la cible, la course du potard (lo, hi), et si
 * la cible se morphe ; poses par la partie fixe et quand les scenes du motif changent.
 */
const fast: { b: SceneBinding | null; lo: number; hi: number; morphed: boolean }[] = Array.from({ length: N }, () => ({ b: null, lo: 0, hi: 0, morphed: false }));
let sigMorph: unknown = null;
const bandNow: [number, number] = [0, 0];
/** des notifications depuis le dernier calcul : celles du crossfader seul, et les autres */
let xPokes = 0;
let otherPokes = 0;

const listeners = new Set<(c: FaceKnobChange) => void>();
let version = 0;
let started = false;
let dirty = true;
let queued = false;
let sigScreen = '';
let sigVoice = '';
let sigLock = '';
let sigRest = '';
let sigArm = '';
/** Les scenes du motif au dernier calcul de la partie fixe : armee, une cle ecrite change la teinte (unlocked, scene). */
let sigScenes: unknown = null;
/** Les verrous du motif au dernier calcul de la partie fixe : en P-LOCK, un verrou pose change la teinte (unlocked, lock). */
let sigLocks: unknown = null;
/** les dernieres durees d'un calcul (ms), pour le debug (__v4.knobs.ms) */
const ms: number[] = [];
let lastCause: KnobCause = 'value';

/** La partie fixe d'un potard (le bloc, son nom, son etat, sa teinte) ; true si elle a change. */
function fixPart(v: Mut): boolean {
  const slots = pageSlots(curScreen(), pattern.get().instrument);
  const block = knobBlock(v.k);
  const slot = block === null ? null : (slots[block] ?? null);
  const dial = knobDialOf(v.k);
  const state: Mut['state'] = !slot || !slot.label ? 'empty' : slot.graph ? 'picture' : block !== null && pageKnobLive(block) ? 'live' : 'off';
  const label = slot?.label ?? '';
  const [lo] = state === 'live' ? dialRange(dial) : [0];
  const bipolar = lo < 0;
  const steps = state === 'live' ? dialSteps(dial) : 0;
  const w = sceneCtl.get().armed;
  const tone: KnobTone = state !== 'live' || !slot ? (w && slot && slot.label && !slot.graph ? 'dim' : 'off') : w ? sceneTone(dial, w) : lockTone(slot, block);
  const target = block === null ? null : sceneIdOfDial(dial);
  const alias = block !== null && block !== v.k;
  const changed = v.block !== block || v.dial !== dial || v.state !== state || v.label !== label || v.bipolar !== bipolar || v.steps !== steps || v.tone !== tone || v.alias !== alias || v.target !== target;
  const f = fast[v.k];
  f.b = target ? bindingOf(target) : null;
  [f.lo, f.hi] = state === 'live' ? dialRange(dial) : [0, 0];
  v.target = target;
  v.block = block;
  v.dial = dial;
  v.state = state;
  v.label = label;
  v.bipolar = bipolar;
  v.steps = steps;
  v.tone = tone;
  v.alias = alias;
  return changed;
}

/**
 * La teinte d'un potard vivant (P2-13) : hors P-LOCK, base ; en P-LOCK, lock (son bloc verrouille sur ce pas, ou VEL : le
 * pas lui-meme), unlocked (verrouillable, pas encore verrouille), global (un FX global, un reglage sans verrou).
 */
function lockTone(slot: { scope?: string; lock?: string | null }, block: number | null): KnobTone {
  const step = lockReadStep();
  if (step < 0 || block === null) return 'base';
  if (slot.scope === 'all' || !slot.lock) return 'global';
  if (slot.lock === 'vel') return 'lock';
  return pageLockView(block, step) ? 'lock' : 'unlocked';
}

/**
 * La teinte d'un potard pendant qu'une scene est armee (2026-10-27, P2-19) : scene, une cle de la scene armee ; unlocked,
 * un reglage qui se morphe pas encore dans la scene (le tourner la cree) ; dim, NO SCENE (un choix de son, un reglage
 * lourd avant P2-22) ; base, ce qui passe a la base (TEMPO, MASTER).
 */
function sceneTone(dial: DialId, w: SceneId): KnobTone {
  const id = sceneIdOfDial(dial);
  if (!id) return 'dim';
  const role = sceneRole(id);
  if (role === 'passthrough') return 'base';
  if (role !== 'sceneable') return 'dim';
  return pattern.scenes.get()[w][id] !== undefined ? 'scene' : 'unlocked';
}

/**
 * La partie vive (pos) ; un potard sans rien a regler garde sa place (un moteur ne bouge pas pour rien), off retombe a 0.
 * Ce qui se montre (2026-10-27) : armee, la valeur de la scene ; en P-LOCK, le verrou ; sinon ce qui joue (les scenes au
 * x du crossfader) ; aucun texte calcule ici (l'etat vivant vient de la partie fixe).
 */
function livePart(v: Mut): boolean {
  const pos = v.state === 'live' && v.block !== null ? pageKnobShown(v.block, true) : v.state === 'off' ? 0 : v.pos;
  // La bande (P2-20) : les deux bouts du crossfader, lus seulement quand le motif a des scenes
  const has = v.state === 'live' && v.block !== null && pageKnobBand(v.block, bandNow);
  let changed = pos !== v.pos;
  v.pos = pos;
  if (has) {
    const b = bands[v.k];
    if (v.band !== b || b[0] !== bandNow[0] || b[1] !== bandNow[1]) {
      b[0] = bandNow[0];
      b[1] = bandNow[1];
      v.band = b;
      changed = true;
    }
  } else if (v.band !== null) {
    v.band = null;
    changed = true;
  }
  return changed;
}

/** Le changement du chemin court (un seul objet, relu tout de suite par les ecouteurs ; jamais garde par eux). */
const xMoved: number[] = [];
const X_CHANGE: FaceKnobChange = { cause: 'xfade', moved: xMoved };

/**
 * Un pas du crossfader seul (P2-20) : seuls les potards dont la cible se morphe bougent, a ce qui joue (la course de
 * morph.played01, la meme loi que pageKnobShown) ; aucune allocation, aucun texte.
 */
function xPart(moved: number[]): void {
  for (const v of views) {
    const f = fast[v.k];
    if (!f.morphed || v.state !== 'live' || !f.b || !v.target) continue;
    const p = morph.played01(v.target);
    if (p === null) continue;
    const pos = f.hi > f.lo ? Math.max(0, Math.min(1, (from01(f.b, p) - f.lo) / (f.hi - f.lo))) : 0;
    if (pos === v.pos) continue;
    v.pos = pos;
    moved.push(v.k);
  }
}

/** Recalcule les huit vues ; rend ce qui a bouge et pourquoi (null : rien). */
function recompute(): FaceKnobChange | null {
  dirty = false;
  const t0 = performance.now();
  // Seul le crossfader a bouge depuis le dernier calcul (P2-20) : la cause xfade
  const xOnly = xPokes > 0 && otherPokes === 0;
  xPokes = 0;
  otherPokes = 0;
  // Le chemin court d'un pas du crossfader : aucune autre source n'a prevenu (la partie fixe ne peut pas avoir change), ni
  // scene armee (la scene se montre), ni P-LOCK ou pas tenu (le verrou), les scenes du motif deja lues : seuls les potards
  // morphes relisent ce qui joue, sans allocation (une notification en attente : le chemin ordinaire)
  if (xOnly && sigScreen !== '' && pending === null && !sceneCtl.get().armed && !rytmLock.active() && pattern.scenes.get() === sigMorph) {
    xMoved.length = 0;
    xPart(xMoved);
    ms.push(performance.now() - t0);
    if (ms.length > 120) ms.shift();
    if (xMoved.length === 0) return null;
    version += 1;
    lastCause = 'xfade';
    return X_CHANGE;
  }
  const inst = pattern.get().instrument;
  const lk = rytmLock.get();
  const screen = curScreen();
  const voice = inst ?? '-';
  const lock = `${lk.step}|${lk.latched ? 1 : 0}|${lk.held.join(',')}`;
  const rest = `${editor.get() ?? '-'}|${samplesVersion()}`;
  const am = sceneCtl.get();
  const arm = `${am.armed ?? '-'}|${am.how ?? '-'}`;
  // En P-LOCK, un verrou pose ou retire change la teinte : les verrous comptent dans la signature ; une scene armee, ses cles
  const locks = lk.step >= 0 ? pattern.get().locks : sigLocks;
  const scenes = am.armed ? pattern.scenes.get() : sigScenes;
  const fixed = screen !== sigScreen || voice !== sigVoice || lock !== sigLock || rest !== sigRest || locks !== sigLocks || arm !== sigArm || scenes !== sigScenes;
  sigLocks = locks;
  sigScenes = scenes;
  const cause: KnobCause | null = screen !== sigScreen ? 'page' : voice !== sigVoice ? 'voice' : lock !== sigLock ? 'lock' : arm !== sigArm ? 'scene' : null;
  sigScreen = screen;
  sigVoice = voice;
  sigLock = lock;
  sigRest = rest;
  sigArm = arm;
  const moved: number[] = [];
  let blocksMoved = false;
  for (const v of views) {
    const b0 = v.block;
    const f = fixed ? fixPart(v) : false;
    if (v.block !== b0) blocksMoved = true;
    const l = livePart(v);
    if (f || l) moved.push(v.k);
  }
  // Ce que le chemin court du crossfader relira : les cibles qui se morphent
  const allScenes = pattern.scenes.get();
  if (fixed || allScenes !== sigMorph) {
    sigMorph = allScenes;
    for (const v of views) fast[v.k].morphed = !!v.target && morph.touches(v.target);
  }
  ms.push(performance.now() - t0);
  if (ms.length > 120) ms.shift();
  if (moved.length === 0) return null;
  version += 1;
  const now = performance.now();
  const c: KnobCause =
    blocksMoved && cause !== 'lock' && cause !== 'scene' ? (cause === 'voice' ? 'voice' : 'page') : cause ?? (moved.some((k) => faceTouch.recent(k, POT_MS, now)) ? 'pot' : xOnly ? 'xfade' : 'value');
  lastCause = c;
  return { cause: c, moved };
}

/** Un changement lu (get) avant la microtache : il part quand meme avec elle, fondu avec les suivants. */
let pending: FaceKnobChange | null = null;
const CAUSE_ORDER: readonly KnobCause[] = ['page', 'voice', 'lock', 'scene', 'pot', 'xfade', 'value'];

function merge(a: FaceKnobChange | null, b: FaceKnobChange | null): FaceKnobChange | null {
  if (!a) return b;
  if (!b) return a;
  const moved = [...new Set([...a.moved, ...b.moved])].sort((x, y) => x - y);
  const cause = CAUSE_ORDER.find((o) => a.cause === o || b.cause === o) ?? 'value';
  return { cause, moved };
}

function flush(): void {
  queued = false;
  const c = merge(pending, dirty ? recompute() : null);
  pending = null;
  if (!c) return;
  for (const fn of listeners) fn(c);
}

function schedule(): void {
  if (queued) return;
  queued = true;
  queueMicrotask(flush);
}

function poke(): void {
  otherPokes += 1;
  dirty = true;
  schedule();
}

/** Le crossfader (P2-20) : ce qui joue change, rien d'autre */
function pokeX(): void {
  xPokes += 1;
  dirty = true;
  schedule();
}

function start(): void {
  if (started) return;
  started = true;
  rytmPage.subscribe(poke);
  rytmLock.subscribe(poke);
  pattern.subscribe(poke);
  pattern.fx.subscribe(poke);
  voiceFx.subscribe(poke);
  kit.subscribe(poke);
  mix.subscribe(poke);
  samplesChanged.subscribe(poke);
  editor.subscribe(poke);
  // Les scenes (2026-10-27) : l'armement, leurs valeurs, le crossfader (ce qui joue)
  pattern.scenes.subscribe(poke);
  sceneCtl.subscribe(poke);
  sceneCtl.onX(pokeX);
}

export const faceKnobs = {
  /** les huit vues, a jour (un calcul en attente se fait ici, sans notifier : la microtache le fera) */
  get(): readonly FaceKnobView[] {
    start();
    if (dirty) {
      pending = merge(pending, recompute());
      if (pending) schedule();
    }
    return views;
  },
  version: (): number => version,
  /** la derniere cause */
  cause: (): KnobCause => lastCause,
  subscribe(fn: (c: FaceKnobChange) => void): () => void {
    start();
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** les dernieres durees d'un calcul, ms */
  ms: (): readonly number[] => ms,
};
