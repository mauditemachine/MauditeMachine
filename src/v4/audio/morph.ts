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
import { snapTone } from './tone';
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

/**
 * Les inserts que les scenes menent (2026-10-27, drums.ts holdInserts et les tenues du bus) : une voix dont DIST ou
 * CHORUS est dans une scene garde son insert engage, le DIST et le CHORUS du bus restent relies ; un crossfader qui passe
 * par 0 ne branche ni ne debranche rien.
 */
export interface InsertNeeds {
  readonly dist: ReadonlySet<Inst>;
  readonly chorus: ReadonlySet<Inst>;
  readonly busDist: boolean;
  readonly busChorus: boolean;
}
export const NO_NEEDS: InsertNeeds = Object.freeze({ dist: new Set<Inst>(), chorus: new Set<Inst>(), busDist: false, busChorus: false });

function needsOf(all: readonly Entry[]): InsertNeeds {
  if (all.length === 0) return NO_NEEDS;
  const dist = new Set<Inst>();
  const chorus = new Set<Inst>();
  let busDist = false;
  let busChorus = false;
  for (const e of all) {
    const b = e.b;
    if (b.domain === 'voice' && b.inst) {
      if (b.key === 'dist') dist.add(b.inst);
      else if (b.key === 'chorus') chorus.add(b.inst);
    } else if (b.domain === 'fx') {
      if (b.key === 'drive') busDist = true;
      else if (b.key === 'chorus') busChorus = true;
    }
  }
  return { dist, chorus, busDist, busChorus };
}

/** Les inserts menes par un jeu de scenes (pur ; le rendu hors ligne). */
export const insertNeedsOf = (s: SceneSet): InsertNeeds => needsOf(entriesOf(s).all);

/**
 * La valeur native jouee d'une entree pour une base native et x. La base elle-meme, au bit pres, quand elle seule
 * s'entend a ce x (2026-10-27, revue AP-1 : une cle dans B seule a x = 0, dans A seule a x = 1 ; l'aller-retour par le 0
 * a 1 pouvait deplacer le dernier bit d'un verrou ou d'une base).
 */
const played = (e: Entry, baseNative: number, x: number): number => {
  if ((e.a === undefined && (x <= 0 || e.v === undefined)) || (e.v === undefined && x >= 1)) return baseNative;
  return from01(e.b, morph01(e.a, e.v, to01(e.b, baseNative), x));
};

/**
 * La hauteur d'un coup menee par le crossfader (2026-10-27, P2-18) : TONE sur une grille de 1/28 de sa course (57
 * hauteurs de -1 a 1, un quart de demi-ton) ; TUNE (1 demi-ton) et FINE (1 cent) le sont deja par leur loi, STRETCH par
 * la grille des one-shots (shots.ts shotKey). Un balayage complet demande au plus 57 calculs par son ; le filtre de la
 * tranche (le TONE de applyVoice) reste continu.
 */
export const TONE_PITCH_GRID = 28;
export const hitTone = (v: number): number => snapTone(Math.round(v * TONE_PITCH_GRID) / TONE_PITCH_GRID);
/**
 * La hauteur TONE d'un coup a x (2026-10-27, revue F4) : sur la grille seulement strictement dans un balayage ; aux bouts
 * (x 0 ou 1, ou le crossfader se pose le plus souvent) la valeur exacte, comme sans scene (avant : jusqu'a 12.5 cents
 * de desaccord au repos).
 */
const toneAt = (v: number, x: number): number => (x > 0 && x < 1 ? hitTone(v) : v);
const pitchy = (e: Entry): boolean => e.b.cls === 'pitch' || e.b.alsoPitch;

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
 * sinon la voix (une valeur dans B seule laisse jouer le verrou a x = 0 ; un verrou sur un parametre absent des deux
 * scenes reste tel quel). Un parametre de coup ou de hauteur (DECAY, PAN, le filtre, TUNE, FINE...) : la valeur jouee
 * entre dans fx et sort du verrou (hitParams lit lock ?? fx). Un parametre de tranche (VOL, DIST, CHORUS, DELAY, REVERB,
 * TONE) verrouille (2026-10-27, revue AP-1) : la valeur jouee, morphee depuis le verrou, RESTE dans le verrou, et fx garde
 * la valeur jouee de la tranche ; le rapport du VOL (verrou sur tranche), les points des envois et des inserts
 * (postSends, postInserts) et le filtre du TONE du coup (hitEntry) ne lisent que le verrou : sorti du verrou, il se
 * perdait, le coup jouait la tranche (un VOL 0.2 a plein, +24 dB).
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
    fx ??= { ...base };
    if (typeof lv === 'number' && e.b.cls === 'ramp') {
      // Un verrou de tranche : il reste verrou, a sa valeur jouee ; fx dit ce que joue la tranche
      lk ??= { ...(lock as Record<string, unknown>) };
      lk[p] = p === 'tone' ? toneAt(played(e, lv, x), x) : played(e, lv, x);
      fx[p] = played(e, base[p], x);
      continue;
    }
    const b0 = typeof lv === 'number' ? lv : base[p];
    fx[p] = p === 'tone' ? toneAt(played(e, b0, x), x) : played(e, b0, x);
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
let needs = needsOf(live.all);
/** les entrees par id (2026-10-27, P2-20 : les anneaux lisent ce qui joue a chaque pas du crossfader, sans allocation) */
let byId = new Map<string, Entry>(live.all.map((e) => [e.b.id, e]));
const effFx: Fx = { ...pattern.fx.get() };
let fxDirty = true;
const effVoice: Partial<Record<Inst, VoiceFx>> = {};
const voiceDirty = new Set<Inst>(VOICES);
/** ce que joue un coup sans verrou d'une voix dont TONE se morphe : la voix jouee, sa hauteur sur la grille (hitTone) */
const effHit: Partial<Record<Inst, VoiceFx>> = {};
let stretchBase: () => number = () => 0;
const listeners = new Set<(c: MorphChange) => void>();

const stats = { applies: 0, reschedAsks: 0, settles: 0, renders: 0, applyMs: [] as number[], rebuilds: 0, notifies: 0 };

function rebuild(): void {
  live = entriesOf(scenes);
  needs = needsOf(live.all);
  byId = new Map(live.all.map((e) => [e.b.id, e]));
  fxDirty = true;
  for (const i of VOICES) voiceDirty.add(i);
  stats.rebuilds += 1;
}

const X_CAUSE: MorphChange = Object.freeze({ cause: 'x' });
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
  /** le STRETCH a un autre x (drums.ts prepareScenes : les deux bouts d'un balayage) */
  stretchAt(x0: number): number {
    const e = live.stretch;
    const b = stretchBase();
    return e ? played(e, b, x0) : b;
  },
  /**
   * les voix dont une hauteur se morphe (TUNE, FINE, TONE) : leurs coups se preparent aux deux bouts ; toutes quand le
   * STRETCH est dans une scene (2026-10-27, revue F2 : il change la duree de chaque coup)
   */
  pitchVoices(): Inst[] {
    if (live.stretch) return [...VOICES];
    return VOICES.filter((i) => live.voice[i]?.some(pitchy));
  },
  /**
   * Un coup, pour une banque de scenes (Snap.scenes) au x du moment : la valeur de base est celle du trig (son verrou s'il
   * en a). Sans scene pour la voix : le verrou lui-meme, fx de la voix, kit null.
   */
  hit(inst: Inst, lock: Readonly<StepLock> | null, s: SceneSet): MorphHit {
    // Le STRETCH dans une scene (2026-10-27, revue F2) : chaque coup de chaque voix a une hauteur menee par le
    // crossfader ; lazy, le plus proche joue et son calcul ne re-programme rien (sans lui, chaque arrivee demandait une
    // re-programmation, la tempete du F9)
    if (s === scenes) {
      const es = live.voice[inst];
      const st = live.stretch !== null;
      if (!es || es.length === 0) return { fx: voiceFx.of(inst), lock, kit: null, lazy: st };
      const lazy = st || es.some(pitchy);
      if (!lock) {
        const v = voiceNow(inst);
        if (!(x > 0 && x < 1) || !es.some((e) => e.b.key === 'tone')) return { fx: v, lock: null, kit: null, lazy };
        const h = (effHit[inst] ??= { ...v });
        Object.assign(h, v);
        h.tone = hitTone(v.tone);
        return { fx: h, lock: null, kit: null, lazy };
      }
      return { ...hitWith(es, voiceFx.of(inst), lock, x), lazy };
    }
    if (s === NO_SCENES) return { fx: voiceFx.of(inst), lock, kit: null, lazy: false };
    const ls = entriesOf(s);
    const es = ls.voice[inst];
    const lazy = ls.stretch !== null || (!!es && es.some(pitchy));
    return { ...hitWith(es, voiceFx.of(inst), lock, x), lazy };
  },
  /** le 0 a 1 joue d'un id qui se morphe (les anneaux, les blocs, les moteurs) ; null : pas morphe */
  played01(id: string): number | null {
    const e = byId.get(id);
    if (!e) return null;
    const b = e.b;
    if (b.domain === 'fx') return to01(b, (fxNow() as unknown as Record<string, number>)[b.key]);
    if (b.domain === 'stretch') return to01(b, morph.stretch());
    if (b.domain === 'voice' && b.inst) return to01(b, voiceNow(b.inst)[b.key as VoiceParam]);
    return null;
  },
  /**
   * Les deux bouts d'un id qui se morphe (2026-10-27, P2-20 : la bande A-B des anneaux), dans le 0 a 1 de sa cible : ce
   * qu'il joue a x 0 et a x 1 (une scene sans lui : la base) ; false : pas morphe. out est rempli sur place (sans allocation).
   */
  ends01(id: string, out: [number, number]): boolean {
    const e = byId.get(id);
    if (!e) return false;
    const b = e.b;
    const base =
      b.domain === 'fx'
        ? (pattern.fx.get() as unknown as Record<string, number>)[b.key]
        : b.domain === 'stretch'
          ? stretchBase()
          : b.domain === 'voice' && b.inst
            ? voiceFx.of(b.inst)[b.key as VoiceParam]
            : undefined;
    if (typeof base !== 'number') return false;
    const b01 = to01(b, base);
    out[0] = morph01(e.a, e.v, b01, 0);
    out[1] = morph01(e.a, e.v, b01, 1);
    return true;
  },
  /** un reglage de fx est-il dans une scene du motif (drums.ts : ses changements de base passent par l'applicateur) */
  fxMorphed: (): boolean => live.fx.length > 0,
  /** un reglage de la voix est-il dans une scene du motif */
  voiceMorphed: (inst: Inst): boolean => (live.voice[inst]?.length ?? 0) > 0,
  /** les inserts que les scenes du motif menent (le meme objet tant qu'elles ne changent pas) */
  inserts: (): InsertNeeds => needs,
  /** une duree d'application (ms) gardee pour les tests, les 4096 dernieres au plus */
  noteApply(ms: number): void {
    stats.applies += 1;
    if (stats.applyMs.length >= 4096) stats.applyMs.splice(0, 2048);
    stats.applyMs.push(ms);
  },
  /** un id est-il dans une scene du motif (morphe) */
  touches: (id: string): boolean => byId.has(id),
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
    // Un seul objet pour tous les pas du crossfader (2026-10-27, P2-20 : aucune allocation par pas)
    notify(X_CAUSE);
  });
  sceneCtl.onGesture((on) => {
    if (on || live.all.length === 0) return;
    stats.settles += 1;
    notify({ cause: 'settle' });
  });
}
