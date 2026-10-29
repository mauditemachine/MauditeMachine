/**
 * Ce que les scenes peuvent tenir (2026-10-27, la phase 2) : le role de chaque cible MIDI du MM-RYTM et, pour celles qui
 * se morphent, leur liaison au store (le domaine, la cle, la course native lo a hi, les crans, la classe d'application).
 * Pur : lu par actions.ts (l'enregistrement), audio/morph.ts (le crossfader), midi/targets.ts (le champ scene) et les
 * tests. La grammaire des ids est celle de midi/targets.ts coreTargets (aucune table a la main) ; chaque liaison porte la
 * meme loi affine que sa cible (lo..hi, a zero au centre : (v + 1) / 2), le test A2 le prouve cible par cible.
 *
 * Les roles :
 * - sceneable : un reglage de son, lineaire dans son 0 a 1 ;
 * - resolved : relatif (rytm:knob:1-8, la rangee de la voix choisie rytm:enc:vol vdecay...) : resolu a l'enregistrement en
 *   son id absolu, jamais garde tel quel ;
 * - passthrough : le transport, la navigation, MASTER, TEMPO et les mutes : ils agissent comme avant meme scene armee ;
 * - noscene : un choix de son (SOUND, SAMPLE, MACHINE, une famille du kit) : l'interpoler passerait par des sons sans
 *   rapport ; les TWEAKS et les couches (heavy) aussi tant que HEAVY_RECORDABLE est faux (P2-22).
 */

import { DELAY_DIVS, FX_NOTCHES, fxSnap, isFxSetting } from '../audio/pattern';
import { snapTime } from '../audio/time';
import { VOICE_PARAMS, voiceClamp, type VoiceParam } from '../audio/voicefx';
import { isTrigParam } from '../audio/trig';
import { isLfoParam } from '../audio/lfo';
import type { KitFamily } from '../audio/kit';
import { VOICE_PARAM, isVoiceEnc, type EncId, type Inst } from '../theme';

/** Comment une valeur morphee s'applique (audio/morph.ts, audio/drums.ts). */
export type MorphClass = 'ramp' | 'worklet' | 'notch' | 'settle' | 'hit' | 'pitch' | 'heavy';
export type SceneRole = 'sceneable' | 'resolved' | 'passthrough' | 'noscene';
/** Le champ scene des cibles MIDI (midi/targets.ts) : la classe d'une cible morphable, ou son role. */
export type SceneTag = MorphClass | 'passthrough' | 'noscene' | 'resolved';

/** Les TWEAKS et les couches dans les scenes (P2-22, optionnel) : pas encore. */
export const HEAVY_RECORDABLE = false;

export interface SceneBinding {
  readonly id: string;
  /** le store : pattern.fx, le STRETCH de drums.ts, voiceFx, le kit, une couche */
  readonly domain: 'fx' | 'stretch' | 'voice' | 'kit' | 'layer';
  /** la cle dans le store (un champ de Fx, un VoiceParam, un potard du kit, un reglage de couche) */
  readonly key: string;
  readonly inst: Inst | null;
  readonly fam: KitFamily | null;
  /** la course native (celle du store) */
  readonly lo: number;
  readonly hi: number;
  /** ses crans (0 : continu) */
  readonly steps: number;
  readonly cls: MorphClass;
  /** TONE d'une voix : une rampe (la tranche) et une hauteur (le coup) */
  readonly alsoPitch: boolean;
}

const VOICES: readonly Inst[] = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'];
const FAMS: readonly KitFamily[] = ['bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'];

/** Les champs de pattern.fx et leur classe (la table de la spec 7.2) ; dist ecrit drive. */
const FX_CLASS: Readonly<Record<string, MorphClass>> = {
  dist: 'ramp',
  chorus: 'ramp',
  delay: 'ramp',
  reverb: 'ramp',
  dfb: 'ramp',
  dtone: 'ramp',
  xtone: 'ramp',
  crate: 'ramp',
  cdepth: 'ramp',
  bits: 'worklet',
  comp: 'worklet',
  cthr: 'worklet',
  cknee: 'worklet',
  catk: 'worklet',
  crel: 'worklet',
  cmake: 'worklet',
  dtime: 'notch',
  cratio: 'notch',
  chpf: 'notch',
  brate: 'notch',
  rsize: 'settle',
  rtone: 'settle',
  rpre: 'settle',
  swing: 'hit',
};
const FX_KEY = (e: string): string => (e === 'dist' ? 'drive' : e);

/** Les reglages de voix et leur classe. */
const VOICE_CLASS: Readonly<Record<VoiceParam, MorphClass>> = {
  level: 'ramp',
  dist: 'ramp',
  chorus: 'ramp',
  delay: 'ramp',
  reverb: 'ramp',
  tone: 'ramp',
  decay: 'hit',
  pan: 'hit',
  start: 'hit',
  atk: 'hit',
  hold: 'hit',
  fenv: 'hit',
  fatk: 'hit',
  fdec: 'hit',
  fcut: 'hit',
  freso: 'hit',
  ftype: 'hit',
  tune: 'pitch',
  fine: 'pitch',
};
/** A zero au centre (-1 a 1) : la meme liste que midi/targets.ts. */
const VOICE_BIP: ReadonlySet<VoiceParam> = new Set<VoiceParam>(['tone', 'tune', 'pan', 'fine', 'fenv']);
const VOICE_STEPS: Readonly<Partial<Record<VoiceParam, number>>> = { tune: 49, fine: 129, ftype: 3 };

/** Les potards du kit (pas les familles, des choix de son) et les reglages de couche qui se morpheraient (heavy). */
const KIT_KNOBS: ReadonlySet<string> = new Set(['tune', 'attack', 'decay', 'drive', 'snappy', 'gate', 'sweep', 'sdtune', 'sddecay', 'sdtone']);
const LAYER_HEAVY: ReadonlySet<string> = new Set(['syn', 'lev', 'tune', 'fine', 'start', 'len', 'rev']);

/** Pourquoi une cible n'entre pas dans les scenes (INFOS, les tests). */
export const MORPH_EXCLUDED: Readonly<Record<string, string>> = {
  'rytm:enc:tempo': 'TEMPO: passes through (transport)',
  'rytm:enc:level': 'MASTER: passes through (safety)',
  'rytm:enc:vsound': 'SOUND: a sound choice, no scene',
  'rytm:voice:*:mute': 'live mutes pass through',
  'rytm:kit:<family>': 'a sound choice, no scene',
  'rytm:layer:*:sample': 'a sample choice, no scene',
  'rytm:layer:*:mach': 'a machine choice, no scene',
  'rytm:kit:<knob>': HEAVY_RECORDABLE ? 'heavy: applied at rest' : 'heavy: not yet (P2-22)',
  'rytm:layer:*:<param>': HEAVY_RECORDABLE ? 'heavy: applied at rest' : 'heavy: not yet (P2-22)',
  'rytm:knob:*': 'relative: resolved to its block when recorded',
  'rytm:enc:<voice row>': 'relative: resolved to the selected voice when recorded',
  'rytm:voice:*:<trig setting>': 'V.5.1 trig settings (LEN, PROB, COND...): not in the scenes yet',
  'rytm:voice:*:<lfo setting>': 'V.5.1 LFOs (l1spd ... l2dep): not in the scenes yet',
};

const bindings = new Map<string, SceneBinding | null>();

/** La liaison d'un id morphable (heavy compris, meme non enregistrable) ; null pour les autres. */
export function bindingOf(id: string): SceneBinding | null {
  const hit = bindings.get(id);
  if (hit !== undefined) return hit;
  const b = parse(id);
  bindings.set(id, b);
  return b;
}

function parse(id: string): SceneBinding | null {
  const p = id.split(':');
  if (p[0] !== 'rytm') return null;
  if (p[1] === 'enc' && p.length === 3) {
    const e = p[2];
    if (e === 'stretch') return { id, domain: 'stretch', key: 'stretch', inst: null, fam: null, lo: -1, hi: 1, steps: 0, cls: 'pitch', alsoPitch: false };
    const cls = FX_CLASS[e];
    if (!cls) return null;
    const steps = e === 'dtime' ? DELAY_DIVS.length : isFxSetting(e) ? (FX_NOTCHES[e] ?? 0) : 0;
    return { id, domain: 'fx', key: FX_KEY(e), inst: null, fam: null, lo: 0, hi: 1, steps, cls, alsoPitch: false };
  }
  if (p[1] === 'voice' && p.length === 4) {
    const inst = p[2] as Inst;
    const vp = p[3] as VoiceParam;
    if (!VOICES.includes(inst) || !(VOICE_PARAMS as readonly string[]).includes(vp)) return null;
    const bip = VOICE_BIP.has(vp);
    return { id, domain: 'voice', key: vp, inst, fam: null, lo: bip ? -1 : 0, hi: 1, steps: VOICE_STEPS[vp] ?? 0, cls: VOICE_CLASS[vp], alsoPitch: vp === 'tone' };
  }
  if (p[1] === 'kit' && p.length === 3 && KIT_KNOBS.has(p[2])) return { id, domain: 'kit', key: p[2], inst: null, fam: null, lo: 0, hi: 1, steps: 0, cls: 'heavy', alsoPitch: false };
  if (p[1] === 'layer' && p.length === 4 && (FAMS as readonly string[]).includes(p[2]) && LAYER_HEAVY.has(p[3])) {
    return { id, domain: 'layer', key: p[3], inst: null, fam: p[2] as KitFamily, lo: 0, hi: 1, steps: 0, cls: 'heavy', alsoPitch: false };
  }
  return null;
}

/** Le role d'une cible de valeur du MM-RYTM. */
export function sceneRole(id: string): SceneRole {
  const p = id.split(':');
  if (p[0] !== 'rytm') return 'passthrough';
  if (p[1] === 'knob') return 'resolved';
  if (p[1] === 'enc' && p.length === 3) {
    const e = p[2] as EncId;
    if (e === 'tempo' || e === 'level') return 'passthrough';
    if (e === 'vsound') return 'noscene';
    if (isVoiceEnc(e)) return 'resolved';
  }
  if (p[1] === 'voice' && p[3] === 'mute') return 'passthrough';
  // Les reglages de trig et les LFO d'une voix (V.5.1) : hors des scenes en D2
  if (p[1] === 'voice' && p.length === 4 && (isTrigParam(p[3]) || isLfoParam(p[3]))) return 'noscene';
  const b = bindingOf(id);
  if (b) return b.cls === 'heavy' && !HEAVY_RECORDABLE ? 'noscene' : 'sceneable';
  if (p[1] === 'kit' || p[1] === 'layer') return 'noscene';
  return 'passthrough';
}

/** Le champ scene d'une cible MIDI : sa classe si elle se morphe, sinon son role. */
export function sceneTag(id: string): SceneTag {
  const r = sceneRole(id);
  if (r !== 'sceneable') {
    const b = bindingOf(id);
    return b && b.cls === 'heavy' ? 'heavy' : r;
  }
  return bindingOf(id)?.cls ?? 'noscene';
}

/** 0 a 1 d'une valeur native (la loi de la cible MIDI), borne. */
export function to01(b: SceneBinding, native: number): number {
  const span = b.hi - b.lo;
  return span > 0 ? Math.max(0, Math.min(1, (native - b.lo) / span)) : 0;
}

/** La valeur native d'un 0 a 1, posee sur ses crans comme le store la poserait. */
export function from01(b: SceneBinding, v01: number): number {
  const v = Number.isFinite(v01) ? Math.max(0, Math.min(1, v01)) : 0;
  const native = b.lo + v * (b.hi - b.lo);
  if (b.domain === 'voice') return voiceClamp(b.key as VoiceParam, native);
  if (b.domain === 'stretch') return snapTime(native);
  if (b.domain === 'fx') {
    if (b.key === 'dtime') return Math.round(native * (DELAY_DIVS.length - 1)) / (DELAY_DIVS.length - 1);
    if (isFxSetting(b.key)) return fxSnap(b.key, native);
  }
  return native;
}

/** Un 0 a 1 pose sur les crans de sa cible (ce que la scene garde). */
export const snap01 = (b: SceneBinding, v01: number): number => to01(b, from01(b, v01));

/** L'id absolu d'un encodeur de la rangee de la voix choisie (rytm:enc:vdecay -> rytm:voice:SD:decay) ; null sans voix. */
export function voiceRowId(e: EncId, inst: Inst | null): string | null {
  if (!inst || !isVoiceEnc(e) || e === 'vsound') return null;
  const vp = (VOICE_PARAM as Readonly<Record<string, VoiceParam>>)[e];
  return vp ? `rytm:voice:${inst}:${vp}` : null;
}

/** L'id absolu d'un verrou de voix (le meme nom que son VoiceParam) ; null pour les autres verrous. */
export function lockKeyToId(inst: Inst, key: string): string | null {
  return (VOICE_PARAMS as readonly string[]).includes(key) ? `rytm:voice:${inst}:${key}` : null;
}

/** Toutes les liaisons morphables (le debug, le test A2). */
export function allBindings(): SceneBinding[] {
  const out: SceneBinding[] = [];
  for (const e of [...Object.keys(FX_CLASS), 'stretch']) out.push(bindingOf(`rytm:enc:${e}`) as SceneBinding);
  for (const inst of VOICES) for (const vp of VOICE_PARAMS) out.push(bindingOf(`rytm:voice:${inst}:${vp}`) as SceneBinding);
  return out;
}
