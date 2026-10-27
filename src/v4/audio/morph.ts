/**
 * Le morphing des scenes (2026-10-27, la phase 2, Mika : "SCENE A, la fente du crossfader, SCENE B") : ce que le MM-RYTM
 * joue, a partir des stores de base (pattern.fx, voiceFx, le STRETCH de drums.ts), des scenes du motif (pattern.scenes)
 * et de x (state/sceneCtl.ts). LA formule de Mika par parametre (rytm/sceneData.ts morph01), dans le 0 a 1 de sa cible,
 * puis posee sur ses crans (rytm/sceneParams.ts from01). Jamais un store ecrit : le crossfader ne change ni le motif ni
 * l'UNDO ni le navigateur.
 *
 * L'identite d'abord : sans scene, fx() rend pattern.fx.get() lui-meme, voice(i) voiceFx.of(i), hit() le verrou du pas
 * lui-meme et kit null, stretch() le STRETCH : chaque chemin du son reste au bit pres celui d'avant. Avec des scenes : un
 * objet effectif garde par domaine (fx, chaque voix touchee), recalcule sur place quand x, les scenes ou la base changent
 * (aucune allocation par mouvement du crossfader) ; les lecteurs prennent ses champs tout de suite. Un pas rejoue d'une
 * autre banque (un pattern de la chaine) passe par morphHitPure (il alloue, c'est rare).
 */

import { NO_SCENES, morph01, type SceneSet } from '../rytm/sceneData';
import { bindingOf, from01, to01, type SceneBinding } from '../rytm/sceneParams';
import { sceneCtl } from '../state/sceneCtl';
import type { Inst } from '../theme';
import type { KitOverride } from './kit';
import type { StepLock } from './locks';
import { pattern, type Fx } from './pattern';
import { voiceFx, type VoiceFx, type VoiceParam } from './voicefx';

interface Entry {
  readonly b: SceneBinding;
  readonly a: number | undefined;
  readonly v: number | undefined;
}

export type MorphCause = 'x' | 'scenes' | 'switch' | 'base' | 'settle';
export interface MorphChange {
  readonly cause: MorphCause;
  /** switch : l'heure audio de la mesure ou les scenes arrivent */
  readonly at?: number;
}
export interface MorphHas {
  ramp: boolean;
  worklet: boolean;
  notch: boolean;
  settle: boolean;
  hit: boolean;
  pitch: boolean;
  heavy: boolean;
}
export interface MorphHit {
  readonly fx: Readonly<VoiceFx>;
  readonly lock: Readonly<StepLock> | null;
  readonly kit: KitOverride | null;
  /** une hauteur menee par le crossfader : le coup joue le calcul le plus proche plutot que d'attendre (P2-18) */
  readonly lazy: boolean;
}

const VOICES: readonly Inst[] = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'];

/** Les entrees vivantes d'un jeu de scenes : par domaine (le heavy attend P2-22). */
function entriesOf(s: SceneSet): { fx: Entry[]; voice: Partial<Record<Inst, Entry[]>>; stretch: Entry | null; all: Entry[] } {
  const out = { fx: [] as Entry[], voice: {} as Partial<Record<Inst, Entry[]>>, stretch: null as Entry | null, all: [] as Entry[] };
  if (s === NO_SCENES) return out;
  const keys = new Set([...Object.keys(s.a), ...Object.keys(s.b)]);
  for (const id of keys) {
    const b = bindingOf(id);
    if (!b || b.cls === 'heavy') continue;
    const e: Entry = { b, a: s.a[id], v: s.b[id] };
    out.all.push(e);
    if (b.domain === 'fx') out.fx.push(e);
    else if (b.domain === 'stretch') out.stretch = e;
    else if (b.domain === 'voice' && b.inst) (out.voice[b.inst] ??= []).push(e);
  }
  return out;
}

/** La valeur native jouee d'une entree pour une base native et x. */
const played = (e: Entry, baseNative: number, x: number): number => from01(e.b, morph01(e.a, e.v, to01(e.b, baseNative), x));

/** fx morphes (pur, alloue) : le meme objet sans entree de fx. */
export function morphFxPure(base: Readonly<Fx>, s: SceneSet, x: number): Readonly<Fx> {
  const es = entriesOf(s).fx;
  if (es.length === 0) return base;
  const out = { ...base } as Fx;
  for (const e of es) (out as unknown as Record<string, number>)[e.b.key] = played(e, (base as unknown as Record<string, number>)[e.b.key], x);
  return out;
}

/** Les reglages d'une voix morphes (pur, alloue) : le meme objet sans entree pour elle. */
export function morphVoicePure(inst: Inst, base: Readonly<VoiceFx>, s: SceneSet, x: number): Readonly<VoiceFx> {
  const es = entriesOf(s).voice[inst];
  if (!es || es.length === 0) return base;
  const out = { ...base };
  for (const e of es) out[e.b.key as VoiceParam] = played(e, base[e.b.key as VoiceParam], x);
  return out;
}

/**
 * Un coup morphe (pur) : pour chaque parametre de la voix dans une scene, la base est le verrou du pas s'il en a un,
 * sinon la voix ; la valeur jouee entre dans fx et sort du verrou (une valeur dans B seule laisse jouer le verrou a x = 0 ;
 * un verrou sur un parametre absent des deux scenes reste tel quel).
 */
export function morphHitPure(inst: Inst, base: Readonly<VoiceFx>, lock: Readonly<StepLock> | null, s: SceneSet, x: number): { fx: Readonly<VoiceFx>; lock: Readonly<StepLock> | null; kit: KitOverride | null } {
  return hitWith(entriesOf(s).voice[inst], base, lock, x);
}

function hitWith(es: readonly Entry[] | undefined, base: Readonly<VoiceFx>, lock: Readonly<StepLock> | null, x: number): { fx: Readonly<VoiceFx>; lock: Readonly<StepLock> | null; kit: KitOverride | null } {
  if (!es || es.length === 0) return { fx: base, lock, kit: null };
  let fx: VoiceFx | null = null;
  let lk: Record<string, unknown> | null = null;
  for (const e of es) {
    const p = e.b.key as VoiceParam;
    const lv = lock ? (lock as Record<string, unknown>)[p] : undefined;
    const b0 = typeof lv === 'number' ? lv : base[p];
    fx ??= { ...base };
    fx[p] = played(e, b0, x);
    if (lv !== undefined) {
      lk ??= { ...(lock as Record<string, unknown>) };
      delete lk[p];
    }
  }
  const outLock = lk ? (Object.keys(lk).length > 0 ? (lk as StepLock) : null) : lock;
  return { fx: fx ?? base, lock: outLock, kit: null };
}

/* ---------------- le moteur vivant ---------------- */

let scenes: SceneSet = pattern.scenes.get();
let x = sceneCtl.x();
let live = entriesOf(scenes);
const effFx: Fx = { ...pattern.fx.get() };
let fxDirty = true;
const effVoice: Partial<Record<Inst, VoiceFx>> = {};
const voiceDirty = new Set<Inst>(VOICES);
let stretchBase: () => number = () => 0;
const listeners = new Set<(c: MorphChange) => void>();

const stats = { applies: 0, reschedAsks: 0, settles: 0, renders: 0, applyMs: [] as number[], rebuilds: 0, notifies: 0 };

function rebuild(): void {
  live = entriesOf(scenes);
  fxDirty = true;
  for (const i of VOICES) voiceDirty.add(i);
  stats.rebuilds += 1;
}

function notify(c: MorphChange): void {
  stats.notifies += 1;
  listeners.forEach((fn) => fn(c));
}

function fxNow(): Readonly<Fx> {
  if (live.fx.length === 0) return pattern.fx.get();
  if (fxDirty) {
    const base = pattern.fx.get();
    Object.assign(effFx, base);
    const r = effFx as unknown as Record<string, number>;
    const br = base as unknown as Record<string, number>;
    for (const e of live.fx) r[e.b.key] = played(e, br[e.b.key], x);
    fxDirty = false;
  }
  return effFx;
}

function voiceNow(inst: Inst): Readonly<VoiceFx> {
  const es = live.voice[inst];
  if (!es || es.length === 0) return voiceFx.of(inst);
  let o = effVoice[inst];
  if (!o || voiceDirty.has(inst)) {
    const base = voiceFx.of(inst);
    if (!o) {
      o = { ...base };
      effVoice[inst] = o;
    } else Object.assign(o, base);
    for (const e of es) o[e.b.key as VoiceParam] = played(e, base[e.b.key as VoiceParam], x);
    voiceDirty.delete(inst);
  }
  return o;
}

export const morph = {
  /** fx joues : pattern.fx.get() lui-meme quand aucun de ses reglages n'est dans une scene */
  fx: fxNow,
  /** les reglages joues d'une voix : voiceFx.of(inst) lui-meme sans scene pour elle */
  voice: voiceNow,
  /** le STRETCH joue */
  stretch(): number {
    const e = live.stretch;
    const b = stretchBase();
    return e ? played(e, b, x) : b;
  },
  /**
   * Un coup, pour une banque de scenes (Snap.scenes) au x du moment : la valeur de base est celle du trig (son verrou s'il
   * en a). Sans scene pour la voix : le verrou lui-meme, fx de la voix, kit null.
   */
  hit(inst: Inst, lock: Readonly<StepLock> | null, s: SceneSet): MorphHit {
    if (s === scenes) {
      const es = live.voice[inst];
      if (!es || es.length === 0) return { fx: voiceFx.of(inst), lock, kit: null, lazy: false };
      const lazy = es.some((e) => e.b.cls === 'pitch' || e.b.alsoPitch);
      if (!lock) return { fx: voiceNow(inst), lock: null, kit: null, lazy };
      return { ...hitWith(es, voiceFx.of(inst), lock, x), lazy };
    }
    if (s === NO_SCENES) return { fx: voiceFx.of(inst), lock, kit: null, lazy: false };
    const es = entriesOf(s).voice[inst];
    const lazy = !!es && es.some((e) => e.b.cls === 'pitch' || e.b.alsoPitch);
    return { ...hitWith(es, voiceFx.of(inst), lock, x), lazy };
  },
  /** le 0 a 1 joue d'un id qui se morphe (les anneaux, les blocs, les moteurs) ; null : pas morphe */
  played01(id: string): number | null {
    const e = live.all.find((x0) => x0.b.id === id);
    if (!e) return null;
    const b = e.b;
    if (b.domain === 'fx') return to01(b, (fxNow() as unknown as Record<string, number>)[b.key]);
    if (b.domain === 'stretch') return to01(b, morph.stretch());
    if (b.domain === 'voice' && b.inst) return to01(b, voiceNow(b.inst)[b.key as VoiceParam]);
    return null;
  },
  /** un id est-il dans une scene du motif (morphe) */
  touches: (id: string): boolean => live.all.some((e) => e.b.id === id),
  /** les classes presentes dans les scenes du motif */
  has(): MorphHas {
    const h: MorphHas = { ramp: false, worklet: false, notch: false, settle: false, hit: false, pitch: false, heavy: false };
    for (const e of live.all) {
      h[e.b.cls] = true;
      if (e.b.alsoPitch) h.pitch = true;
    }
    return h;
  },
  /** les valeurs jouees des cles de coup et de hauteur, au 1/1024 : la cle de la re-programmation */
  hitSig(): string {
    let s = '';
    for (const e of live.all) {
      if (e.b.cls !== 'hit' && e.b.cls !== 'pitch' && !e.b.alsoPitch) continue;
      s += `${e.b.id}:${Math.round((morph.played01(e.b.id) ?? 0) * 1024)};`;
    }
    return s;
  },
  /** les scenes vivantes (celles du motif) */
  scenes: (): SceneSet => scenes,
  x: (): number => x,
  subscribe(fn: (c: MorphChange) => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** drums.ts donne son STRETCH de base (morph ne l'importe pas : drums importe morph) */
  bindStretch(fn: () => number): void {
    stretchBase = fn;
  },
  /** la base a change ailleurs (le STRETCH) */
  baseChanged(): void {
    if (live.stretch) notify({ cause: 'base' });
  },
  stats,
};

if (typeof window !== 'undefined') {
  pattern.scenes.subscribe((at) => {
    const next = pattern.scenes.get();
    if (next === scenes) return;
    scenes = next;
    rebuild();
    notify(at !== undefined && at > 0 ? { cause: 'switch', at } : { cause: 'scenes' });
  });
  pattern.fx.subscribe(() => {
    if (live.fx.length === 0) return;
    fxDirty = true;
    notify({ cause: 'base' });
  });
  voiceFx.subscribe(() => {
    let any = false;
    for (const i of VOICES) {
      if (live.voice[i]?.length) {
        voiceDirty.add(i);
        any = true;
      }
    }
    if (any) notify({ cause: 'base' });
  });
  sceneCtl.onX((nx) => {
    x = nx;
    if (live.all.length === 0) return;
    fxDirty = true;
    for (const i of VOICES) if (live.voice[i]?.length) voiceDirty.add(i);
    notify({ cause: 'x' });
  });
  sceneCtl.onGesture((on) => {
    if (on || live.all.length === 0) return;
    stats.settles += 1;
    notify({ cause: 'settle' });
  });
}
