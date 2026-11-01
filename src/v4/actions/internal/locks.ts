/**
 * Les actions du MM-RYTM, locks : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { KIT_FAMILIES, KIT_MODELS, familyOf, kit, mixLevels, type KitFamily, type KitModel } from '../../audio/kit';
import { isLockTrig, lockOf, parseSnd, type LockId } from '../../audio/locks';
import { samplesOf } from '../../audio/samples';
import { VEL_MAX, pattern, velocity } from '../../audio/pattern';
import { lcdMessage } from '../../state/lcdMessage';
import type { ShotId } from '../../audio/shotsdsp';
import { rytmPage } from '../../state/rytmPage';
import { rytmLock } from '../../state/rytmLock';
import { type PageSlot } from '../../rytm/pages';
import { DT2_FACE, LCD_NO_VOICE, POT_UI, potMin, type EncId, type Inst } from '../../theme';
import { isLegacyTrack, type TrackKey } from '../../audio/tracks';
import { activeTrack } from '../../state/trk';
import { TAP_VEL_DEFAULT } from '../../state/rytmPage';
import { dialSpecOf, isDialV60 } from '../../scene/screen/menus/registry';
import { two } from '../shared';
import { firstSampleOf, layerSpan, layerTop, trackSampleList, voiceSoundAt } from './kit';
import { kitIdOf, layerIdOf, mixValueOf, pageSlotOf, soundFamily, voiceSounds } from '../kit';
import { lockReadStep, lockSamples, type LockSound, lockSounds, pageLockView, stepPlays } from '../locks';
import { seqDialOf, seqRange } from '../mixer';

/*
 * Le P-LOCK sur les pistes 9 a 16 (l'integration de la V.6.0, la face DT2) : la piste du P-LOCK est la piste active de la
 * saisie (state/trk.ts activeTrack) ; une piste 1 a 8 garde tous les chemins d'avant (ses couches, ses sons par famille),
 * une piste 9 a 16 verrouille VEL et les reglages de piste de sa page SRC (t:<reglage>, la fiche de B5), avec le uTIME.
 * Sans la face DT2, la piste du P-LOCK reste la voix du motif.
 */
/** La piste dont le P-LOCK lit et ecrit les verrous (null : aucune). */
export const lockTrack = (): TrackKey | null => (DT2_FACE ? activeTrack.get() : pattern.get().instrument);
/** La piste du P-LOCK quand c'est une piste 9 a 16 (null : une voix 1 a 8, ou aucune). */
export function lockHi(): TrackKey | null {
  const t = lockTrack();
  return t && !isLegacyTrack(t) ? t : null;
}
/** Un bloc qu'une piste 9 a 16 verrouille : VEL, ou un reglage de piste (t:) qui a sa cle de verrou. */
export const hiLockable = (slot: PageSlot): boolean => slot.lock === 'vel' || (!!slot.lock && !!slot.target && isDialV60(slot.target) && slot.target.startsWith('t:'));

/** Les familles dans l'ordre de la liste (celle de la voix d'abord) : une par voix, dans l'ordre des pads (2026-10-18) ; et leur nom court. */
export const LOCK_FAMS: readonly KitFamily[] = KIT_FAMILIES;
export const FAM_TAG: Readonly<Record<KitFamily, string>> = { bd: 'BD', sd: 'SD', ch: 'CH', oh: 'OH', cp: 'CP', tom: 'TOM', ht: 'HT', cy: 'CY' };
export const lockSoundCache = new Map<string, readonly LockSound[]>();
export const lockSampleCache = new Map<string, readonly LockSound[]>();
export const lockSoundsOf = (): readonly LockSound[] => {
  const inst = pattern.get().instrument;
  return inst ? lockSounds(inst) : [];
};
export const lockSampleList = (): readonly LockSound[] => {
  const inst = pattern.get().instrument;
  return inst ? lockSamples(inst) : [];
};

/** Le nom d'un verrou pour l'ecran (DEC, SOUND, F.ATK) : le nom court du bloc. */
export const lockName = (slot: PageSlot): string => slot.lockName ?? slot.label;

/** La valeur du bloc k en P-LOCK (son domaine : celui du reglage, un rang de liste pour SOUND) ; null : celle de la voix. */
export function lockDialValue(k: number): number | null {
  const slot = pageSlotOf(k);
  const step = lockReadStep();
  const hi = lockHi();
  // Une piste 9 a 16 (la face DT2) : VEL, le sample lock de SAMP, la valeur brute d'un reglage de piste
  if (hi) {
    if (!slot || !slot.lock || step < 0 || !hiLockable(slot)) return null;
    if (slot.lock === 'vel') return velocity(pattern.get().steps, hi, step);
    const lh = lockOf(pattern.get().locks, hi, step);
    if (slot.lock === 'snd') {
      const ps = lh?.snd ? parseSnd(lh.snd) : null;
      const i = ps ? trackSampleList().findIndex((x) => x.key === ps.sound) : -1;
      return i >= 0 ? i : null;
    }
    if (slot.lock === 'mach') return null;
    const vh = lh?.[slot.lock];
    return vh === undefined ? null : vh;
  }
  const inst = pattern.get().instrument;
  if (!slot || !slot.lock || step < 0 || !inst) return null;
  if (slot.lock === 'vel') return velocity(pattern.get().steps, inst, step);
  const l = lockOf(pattern.get().locks, inst, step);
  // SOUND et MIX (2026-10-09) : ce que le pas joue (verrouille ou non : la voix), dans la liste du P-LOCK
  if (slot.target === 'voice:sound') return voiceSoundAt(voiceSounds(inst, true), stepPlays(inst, l));
  if (slot.target === 'voice:mix') return mixValueOf(stepPlays(inst, l));
  if (slot.lock === 'mach') {
    const i = l?.mach ? KIT_MODELS.indexOf(l.mach as KitModel) : -1;
    return i >= 0 ? i : null;
  }
  if (slot.lock === 'snd') {
    if (slot.target === 'smpl:sample') {
      const list = lockSamples(inst);
      const f = familyOf(inst as ShotId);
      const want = l?.snd ?? (f && kit.get().sample[f] ? `${f}:${kit.get().sample[f]}` : '');
      const i = list.findIndex((x) => x.snd === want);
      return l?.snd ? (i >= 0 ? i : null) : Math.max(0, i);
    }
    const list = lockSounds(inst);
    const f = familyOf(inst as ShotId);
    const want = l?.snd ?? (f ? `${f}:${kit.sound(f)}` : '');
    return Math.max(0, list.findIndex((x) => x.snd === want));
  }
  const v = l?.[slot.lock];
  return v === undefined ? null : v;
}

/**
 * Le nom court et la page de chaque verrou (dans l'ordre des pages, depuis
 * le 2026-10-09 : VOICE FLTR ENV FX) ; les reglages de l'ancien SMPL qui ne
 * sont plus sur un ecran (S.TUNE, S.FINE, S.START) gardent leur nom.
 */
/** Les noms courts des reglages d'un LFO (V.5.1) : SPD MULT FADE DEST WAVE PHAS MODE DEP. */
export const LFO_KEY_NAMES: readonly (readonly [string, string])[] = [
  ['spd', 'SPD'],
  ['mul', 'MULT'],
  ['fad', 'FADE'],
  ['dst', 'DEST'],
  ['wav', 'WAVE'],
  ['phs', 'PHAS'],
  ['mod', 'MODE'],
  ['dep', 'DEP'],
];
export const LOCK_NAMES: readonly { key: string; name: string; page: string }[] = [
  { key: 'snd', name: 'SOUND', page: 'VOICE' },
  { key: 'level', name: 'VOL', page: 'VOICE' },
  { key: 'tune', name: 'PITCH', page: 'VOICE' },
  { key: 'fine', name: 'FINE', page: 'VOICE' },
  { key: 'slen', name: 'LEN', page: 'VOICE' },
  { key: 'srev', name: 'REV', page: 'VOICE' },
  { key: 'mach', name: 'MACHINE', page: 'VOICE' },
  { key: 'syn', name: 'MIX', page: 'VOICE' },
  { key: 'slev', name: 'MIX', page: 'VOICE' },
  { key: 'ktune', name: 'TUNE', page: 'VOICE' },
  { key: 'sdtune', name: 'TUNE', page: 'VOICE' },
  { key: 'kattack', name: 'ATTACK', page: 'VOICE' },
  { key: 'snappy', name: 'SNAPPY', page: 'VOICE' },
  { key: 'ksweep', name: 'SWEEP', page: 'VOICE' },
  { key: 'sdtone', name: 'TONE', page: 'VOICE' },
  { key: 'kdecay', name: 'DECAY', page: 'VOICE' },
  { key: 'sddecay', name: 'DECAY', page: 'VOICE' },
  { key: 'kdrive', name: 'DRIVE', page: 'VOICE' },
  { key: 'gate', name: 'GATE', page: 'VOICE' },
  { key: 'stune', name: 'S.TUNE', page: 'VOICE' },
  { key: 'sfine', name: 'S.FINE', page: 'VOICE' },
  { key: 'sstart', name: 'S.START', page: 'VOICE' },
  { key: 'fcut', name: 'FREQ', page: 'FLTR' },
  { key: 'freso', name: 'RESO', page: 'FLTR' },
  { key: 'ftype', name: 'TYPE', page: 'FLTR' },
  { key: 'tone', name: 'TONE', page: 'FLTR' },
  { key: 'fatk', name: 'F.ATK', page: 'FLTR' },
  { key: 'fdec', name: 'F.DEC', page: 'FLTR' },
  { key: 'fenv', name: 'F.ENV', page: 'FLTR' },
  { key: 'atk', name: 'ATK', page: 'ENV' },
  { key: 'hold', name: 'HOLD', page: 'ENV' },
  { key: 'decay', name: 'DEC', page: 'ENV' },
  { key: 'start', name: 'START', page: 'ENV' },
  { key: 'pan', name: 'PAN', page: 'ENV' },
  { key: 'dist', name: 'DIST', page: 'FX' },
  { key: 'chorus', name: 'CHORUS', page: 'FX' },
  { key: 'delay', name: 'DELAY', page: 'FX' },
  { key: 'reverb', name: 'REVERB', page: 'FX' },
  // V.5.1 (2026-10-29) : la page TRIG et les deux LFO de MOD ; ltrg (le lock trig) n'est pas un reglage, il ne compte pas
  { key: 'len', name: 'LEN', page: 'TRIG' },
  { key: 'prob', name: 'PROB', page: 'TRIG' },
  { key: 'cond', name: 'COND', page: 'TRIG' },
  { key: 'utime', name: 'μTIME', page: 'TRIG' },
  { key: 'lfot', name: 'LFO.T', page: 'TRIG' },
  { key: 'rtrg', name: 'RTRG', page: 'TRIG' },
  { key: 'rate', name: 'RATE', page: 'TRIG' },
  { key: 'vfad', name: 'VFAD', page: 'TRIG' },
  { key: 'rlen', name: 'RLEN', page: 'TRIG' },
  ...([1, 2] as const).flatMap((n) => LFO_KEY_NAMES.map(([k, name]) => ({ key: `l${n}${k}`, name: `L${n} ${name}`, page: 'MOD' }))),
];

/** Le domaine de ce qu'un bloc verrouille : un reglage de couche le sien, un potard du kit 0 a 1, un potard de voix le sien. */
export function slotDomain(slot: PageSlot): [number, number] {
  const t = slot.target;
  if (!t || t === 'step:vel' || t === 'smpl:sample' || t === 'voice:sound' || t === 'voice:mix') return [0, 1];
  const lp = layerIdOf(t);
  if (lp) return layerSpan(lp);
  const sd = seqDialOf(t);
  if (sd) return seqRange(sd);
  if (kitIdOf(t)) return [0, 1];
  // V.6.0 (l'integration) : un reglage de piste ou de menu (t:, k:, z:) a la course de sa fiche (t:tune va sous 0, comme la
  // TUNE des voix ; avant, potMin d'un id inconnu bornait le verrou a 0..1)
  if (isDialV60(t)) {
    const r = dialSpecOf(t)?.range();
    return r ? [r[0], r[1]] : [0, 1];
  }
  return [potMin(t as EncId), 1];
}

/**
 * SOUND verrouille sur des pas (2026-10-09) : le pas joue ce son, avec ce qui
 * a du sens pour lui (le meme raisonnement que hors P-LOCK) : OFF, la voix se
 * tait sur ce pas ; une machine, elle seule (sa couche SAMPLE coupee) ; un
 * sample de la voix, il garde la synthese posee dessous, sinon il joue seul ;
 * un sample d'une autre voix, il joue seul (le sample lock) ; le son de CY :
 * plus de verrou de son.
 */
export function soundLockWrite(inst: Inst, steps: readonly number[], at: number, i: number): void {
  const list = voiceSounds(inst, true);
  const s = list[Math.max(0, Math.min(list.length - 1, Math.round(i)))];
  const own = familyOf(inst as ShotId);
  const p = stepPlays(inst, lockOf(pattern.get().locks, inst, at));
  const top = layerTop(p.syn, p.lev);
  if (s.kind === 'own') {
    pattern.clearLock(inst, steps, 'snd');
    pattern.clearLock(inst, steps, 'syn');
    pattern.clearLock(inst, steps, 'slev');
    return;
  }
  if (s.kind === 'off') {
    pattern.setLock(inst, steps, 'snd', `${own ?? 'bd'}:off`);
    pattern.setLock(inst, steps, 'syn', 0);
    pattern.clearLock(inst, steps, 'mach');
    return;
  }
  if (s.kind === 'mach') {
    pattern.setLock(inst, steps, 'mach', s.key);
    pattern.setLock(inst, steps, 'snd', `${own ?? 'bd'}:off`);
    if (p.syn <= 0) pattern.setLock(inst, steps, 'syn', top);
    return;
  }
  pattern.setLock(inst, steps, 'snd', `${s.fam ?? own ?? 'bd'}:${s.key}`);
  pattern.clearLock(inst, steps, 'mach');
  if (s.fam !== own) {
    // Un sample d'une autre voix : il joue seul sur ce pas (audio/kit.ts viewOf), a un niveau qui s'entend
    pattern.clearLock(inst, steps, 'syn');
    if (p.lev <= 0) pattern.setLock(inst, steps, 'slev', top);
    return;
  }
  // Un sample de la voix : avec la synthese dessous si elle y etait (MIX), sinon seul a son niveau
  if (!p.smp) {
    pattern.setLock(inst, steps, 'syn', 0);
    pattern.setLock(inst, steps, 'slev', top);
  }
}

/** MIX verrouille sur des pas (2026-10-09) : les deux niveaux du pas ; sans sample sur ce pas, le premier de la voix vient dessous. */
function mixLockWrite(inst: Inst, steps: readonly number[], at: number, m: number): boolean {
  const own = familyOf(inst as ShotId);
  if (!own || samplesOf(own).length === 0) return false;
  const p = stepPlays(inst, lockOf(pattern.get().locks, inst, at));
  const lv = mixLevels(m, layerTop(p.syn, p.lev));
  pattern.setLock(inst, steps, 'syn', lv.syn);
  pattern.setLock(inst, steps, 'slev', lv.lev);
  if (!p.sample && m > 0) {
    const key = firstSampleOf(own);
    if (key) pattern.setLock(inst, steps, 'snd', `${own}:${key}`);
  }
  return true;
}

/** Le bloc tourne en P-LOCK : son verrou pose sur les pas en P-LOCK ou tenus (ou un message, jamais un geste muet). */
export function lockWrite(k: number, slot: PageSlot, v: number): void {
  const hi = lockHi();
  if (hi) {
    lockWriteHi(k, slot, v, hi);
    return;
  }
  const inst = pattern.get().instrument;
  const steps = rytmLock.targets();
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  if (slot.scope === 'all') {
    lcdMessage.show(`${slot.label} IS GLOBAL: NO P-LOCK`);
    return;
  }
  if (!slot.lock) {
    lcdMessage.show(`${slot.label}: NOT LOCKABLE`);
    return;
  }
  if (steps.length === 0) return;
  // Une voix sans couches (CY, R3) : rien a verrouiller sur MACHINE ni sur les reglages de couche (SOUND, si : un sample lock)
  if (slot.target && layerIdOf(slot.target) && !soundFamily()) {
    lcdMessage.show(`${inst} HAS ONE SOUND: TRY SOUND`);
    return;
  }
  const at0 = rytmLock.get().step >= 0 ? rytmLock.get().step : steps[0];
  if (slot.lock === 'vel') {
    // VEL : la velocite des pas eux-memes (0 les vide, leurs verrous restent)
    const n = Math.max(0, Math.min(VEL_MAX, Math.round(v)));
    for (const i of steps) pattern.set(inst, i, n);
  } else {
    // Un pas vide qu'on verrouille recoit un coup (la velocite des nouveaux pas) : un verrou sans coup ne s'entendrait pas ;
    // un lock trig (V.5.1) reste sans velocite, ses verrous vont au coup qui sonne
    for (const i of steps) if (velocity(pattern.get().steps, inst, i) === 0 && !isLockTrig(pattern.get().locks, inst, i)) pattern.set(inst, i, rytmPage.tapVel(inst));
    if (slot.target === 'voice:sound') soundLockWrite(inst, steps, at0, v);
    else if (slot.target === 'voice:mix') {
      if (!mixLockWrite(inst, steps, at0, v)) {
        lcdMessage.show(`${inst}: NO SAMPLES TO MIX`);
        return;
      }
    } else if (slot.lock === 'snd' && slot.target === 't:snd') {
      // V.6.0 (la face DT2, SAMP de SRC) : le sample lock dans toute la banque (cahier 3.2 : depuis toute categorie)
      const s = trackSampleList()[Math.max(0, Math.round(v))];
      if (s && s.key) pattern.setLock(inst, steps, 'snd', `${s.family}:${s.key}`);
      else pattern.clearLock(inst, steps, 'snd');
    } else if (slot.lock === 'snd') {
      // L'ancien SAMPLE (le sample lock de R3) : OFF, ceux de la voix, puis ceux des autres voix
      const i = Math.max(0, Math.round(v));
      let snd = '';
      if (slot.target === 'smpl:sample') {
        const list = lockSamples(inst);
        if (list.length < 2) {
          lcdMessage.show('NO SAMPLES IN THE KIT');
          return;
        }
        snd = list[Math.min(list.length - 1, i)].snd;
      } else {
        const list = lockSounds(inst);
        snd = list[Math.min(list.length - 1, i)]?.snd ?? '';
      }
      if (snd) pattern.setLock(inst, steps, 'snd', snd);
      else pattern.clearLock(inst, steps, 'snd');
    } else if (slot.lock === 'mach') {
      // La MACHINE du pas (R3) : 909, 808, MM
      pattern.setLock(inst, steps, 'mach', KIT_MODELS[Math.max(0, Math.min(KIT_MODELS.length - 1, Math.round(v)))]);
    } else {
      const id: LockId = slot.lock;
      // PAN colle au centre, PITCH au demi-ton (comme la valeur de la voix, audio/voicefx.ts) ; le reste a son cran (audio/locks.ts)
      const val = id === 'pan' || id === 'fenv' ? (Math.abs(v) < 0.02 ? 0 : v) : id === 'tune' ? Math.round(v * 24) / 24 : v;
      const [lo, hi] = slotDomain(slot);
      pattern.setLock(inst, steps, id, Math.max(lo, Math.min(hi, val)));
    }
  }
  rytmLock.wrote();
  // Deux doigts (un pas tenu, un bloc tourne) : le P-LOCK s'affiche des le premier verrou
  if (rytmLock.get().step < 0) rytmLock.enter(steps[0], false);
  const at = rytmLock.get().step;
  const lv = pageLockView(k, at);
  const who = steps.length > 1 ? `${steps.length} STEPS` : `STEP ${two(at + 1)}`;
  // Une couche muette sur ce pas (R3) : le verrou est pose, il ne s'entendra qu'avec son son (SOUND, MIX), l'ecran le dit
  const silent = slot.layer && !slot.level && layerSilentAt(slot.layer, inst, at) ? `  ${slot.layer === 'synth' ? 'SYNTH' : 'SAMPLE'} OFF HERE` : '';
  lcdMessage.show(lv ? `${who} ${lockName(slot)} ${lv.text}${lv.unit ? `  ${lv.unit}` : ''}${silent}` : `${who} ${lockName(slot)}${silent}`, POT_UI.readoutMs, true);
  rytmPage.echo(k, inst);
}

/**
 * Un verrou pose sur une piste 9 a 16 (la face DT2, l'integration de la V.6.0) : VEL (la velocite des pas), le sample lock
 * de SAMP dans toute la banque, un reglage de piste (t:) a sa valeur dans son domaine ; le reste des pages (les reglages des
 * voix 1 a 8) ne s'y verrouille pas.
 */
function lockWriteHi(k: number, slot: PageSlot, v: number, t: TrackKey): void {
  const steps = rytmLock.targets();
  const name = `T${t.slice(1)}`;
  if (slot.scope === 'all') {
    lcdMessage.show(`${slot.label} IS GLOBAL: NO P-LOCK`);
    return;
  }
  if (!slot.lock || !hiLockable(slot)) {
    lcdMessage.show(`${slot.label}: NOT LOCKABLE ON ${name}`);
    return;
  }
  if (steps.length === 0) return;
  if (slot.lock === 'vel') {
    const n = Math.max(0, Math.min(VEL_MAX, Math.round(v)));
    for (const i of steps) pattern.set(t, i, n);
  } else {
    // Un pas vide qu'on verrouille recoit un coup (la velocite des nouveaux pas), comme sur les voix 1 a 8
    for (const i of steps) if (velocity(pattern.get().steps, t, i) === 0 && !isLockTrig(pattern.get().locks, t, i)) pattern.set(t, i, TAP_VEL_DEFAULT);
    if (slot.lock === 'snd') {
      const s = trackSampleList()[Math.max(0, Math.round(v))];
      if (s && s.key) pattern.setLock(t, steps, 'snd', `${s.family}:${s.key}`);
      else pattern.clearLock(t, steps, 'snd');
    } else if (slot.lock === 'mach') {
      pattern.setLock(t, steps, 'mach', KIT_MODELS[Math.max(0, Math.min(KIT_MODELS.length - 1, Math.round(v)))]);
    } else {
      const id: LockId = slot.lock;
      const val = id === 'tune' ? Math.round(v * 24) / 24 : v;
      const [lo, hi] = slotDomain(slot);
      pattern.setLock(t, steps, id, Math.max(lo, Math.min(hi, val)));
    }
  }
  rytmLock.wrote();
  if (rytmLock.get().step < 0) rytmLock.enter(steps[0], false);
  const at = rytmLock.get().step;
  const lv = pageLockView(k, at);
  const who = steps.length > 1 ? `${steps.length} STEPS` : `STEP ${two(at + 1)}`;
  lcdMessage.show(lv ? `${who} ${name} ${lockName(slot)} ${lv.text}${lv.unit ? `  ${lv.unit}` : ''}` : `${who} ${name} ${lockName(slot)}`, POT_UI.readoutMs, true);
}

/** La couche ne joue-t-elle pas sur ce pas (R3) : son niveau a 0 (ou son verrou), la couche SAMPLE sans sample ? */
function layerSilentAt(layer: 'synth' | 'sample', inst: Inst, step: number): boolean {
  const p = stepPlays(inst, lockOf(pattern.get().locks, inst, step));
  return layer === 'synth' ? !p.synth : !p.smp;
}
