/**
 * Les actions du MM-RYTM : un potard par son id (anyDial, sa course, ses crans, sa lecture, son unite), et les potards de page. Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/anyDial.ts.
 */

import { setVoiceFx } from '../audio/drums';
import { TAP_VEL_DEFAULT } from '../state/rytmPage';
import { tempoSync } from '../state/tempoSync';
import { VOICE_FX_DEFAULT, voiceFx } from '../audio/voicefx';
import { KIT_DEFAULT, isFamily, kit, kitSoundIndex, kitSteps, mixOf } from '../audio/kit';
import { samplesOf } from '../audio/samples';
import { BPM, DELAY_DIVS, FX_NOTCHES, VEL_MAX, delayDiv, isFxSetting, pattern } from '../audio/pattern';
import type { ShotId } from '../audio/shotsdsp';
import { rytmPage } from '../state/rytmPage';
import { type SlotTarget } from '../rytm/pages';
import { encText, encUnit, kitUnit, layerText, v127Text, velTo127, velWord } from '../rytm/values';
import { isBipolar, isVoiceEnc, potCourse, potMin, type EncId } from '../theme';
import { voyKnob, voyParams, voyReadout, voyValueText } from '../voyager/params';
import { two } from './shared';
import { sceneHint, sceneMark, sceneNative } from './internal/scenes';
import { type ContEnc, kitReadout, pageDial, readout } from './internal/dials';
import { layerDial, layerNotches, layerReadout, layerReset, layerSpan, layerUnitNow, layerValue, sampleCount, sampleText, sampleUnit, sampleValue, voiceSoundValue, voyId } from './internal/kit';
import { lockDialValue, lockSampleList, lockSoundsOf } from './internal/locks';
import { mixerDial, mixerInst, seqDefault, seqDial, seqName, seqValue } from './internal/mixer';
import { dialEdit, dialShown, sceneTake } from './scenes';
import { dial, dialReset, dialTarget, dialValue } from './dials';
import { type DialId, kitDial, kitIdOf, layerIdOf, mixText, mixUnit, mixValueOf, pageKnobOf, pageSlotOf, pageTarget, soundFamily, voiceSounds, voiceSoundText, voiceSoundUnit, voyDial } from './kit';
import { lockMode, lockReadStep, pageLockView } from './locks';
import { seqDialOf, seqRange, seqText, seqUnit } from './mixer';

/**
 * Le potard de page k a-t-il quelque chose a regler maintenant (un bloc
 * vivant) ? Non pour un bloc vide, un dessin, un reglage de voix sans voix
 * choisie, SOUND d'une voix a un seul son hors P-LOCK.
 */
export function pageKnobLive(k: number): boolean {
  return dialValueText(`p:${k}` as DialId) !== '--';
}

/**
 * La course (0 a 1) du potard de page k : celle de ce que son bloc regle,
 * que lisent son jumeau et le MIDI (rytm:knob) ; un bloc qui n'a rien a
 * regler : en bas.
 */
export function pageKnobCourse(k: number): number {
  if (!pageKnobLive(k)) return 0;
  const id = `p:${k}` as DialId;
  const [lo, hi] = dialRange(id);
  // Une scene armee (2026-10-27) : la valeur de la scene (un Roto motorise reste ou on l'a tourne) ; sinon ce qu'on entend
  // (2026-10-28 : la base, ou ce qu'une scene en fait entendre)
  return hi > lo ? Math.max(0, Math.min(1, (dialEdit(id) - lo) / (hi - lo))) : 0;
}

/** Ce que montre le potard de page k (les anneaux de la face, P2-19) : armee la scene, en P-LOCK le verrou, sinon ce qui joue. */
export function pageKnobShown(k: number, live = false): number {
  // live : l'appelant sait deja le bloc vivant (rytm/faceKnobs.ts, sa partie fixe) : aucun texte calcule ici
  if (!live && !pageKnobLive(k)) return 0;
  const id = `p:${k}` as DialId;
  const [lo, hi] = dialRange(id);
  return hi > lo ? Math.max(0, Math.min(1, (dialShown(id) - lo) / (hi - lo))) : 0;
}

/** La cible d'un potard (un potard de page : celle de son bloc ; null, vide ou un dessin). */
const resolve = (id: DialId): SlotTarget | null => {
  const k = pageKnobOf(id);
  return k < 0 ? id : pageTarget(k);
};

export function anyDial(id: DialId, v: number): void {
  const pk = pageKnobOf(id);
  if (pk >= 0) return pageDial(pk, v);
  // Une scene armee (2026-10-27) : rytm:enc:*, les TWEAKS, les couches ; TEMPO et MASTER passent (sceneTake rend false)
  if (sceneTake(id, v)) return;
  if (!voyId(id)) sceneHint(id);
  const r = kitIdOf(id);
  if (r) return kitDial(r, v);
  const lp = layerIdOf(id);
  if (lp) return layerDial(lp, v);
  const mi = mixerInst(id);
  if (mi) return mixerDial(mi, v);
  const sd = seqDialOf(id);
  if (sd) return seqDial(sd, v);
  const k = voyId(id);
  if (k) voyDial(k, v);
  else dial(id as EncId, v);
}

export function anyDialValue(id: DialId): number {
  const pk = pageKnobOf(id);
  if (pk >= 0 && lockMode()) {
    const lv = lockDialValue(pk);
    if (lv !== null) return lv;
  }
  const t = resolve(id);
  if (t === null) return 0;
  if (t === 'step:vel') {
    const inst = pattern.get().instrument;
    // En P-LOCK : la velocite du pas (lockDialValue) ; sinon celle des nouveaux pas
    return inst ? rytmPage.tapVel(inst) : TAP_VEL_DEFAULT;
  }
  if (t === 'smpl:sample') return sampleValue();
  if (t === 'voice:sound') return voiceSoundValue();
  if (t === 'voice:mix') {
    const inst = pattern.get().instrument;
    return inst && soundFamily() ? mixValueOf(kit.playsWith(inst as ShotId, null)) : 0;
  }
  const r = kitIdOf(t);
  if (r) return kit.value(r);
  const lp = layerIdOf(t);
  if (lp) return layerValue(lp);
  const mi = mixerInst(t);
  if (mi) return voiceFx.of(mi).level;
  const sd = seqDialOf(t);
  if (sd) return seqValue(sd);
  const k = voyId(t);
  return k ? voyParams.of(k) : dialValue(t as EncId);
}

export function anyDialReset(id: DialId): number {
  const t = resolve(id);
  if (t === null) return 0;
  // VEL : HIGH, la velocite d'un appui (celle d'avant)
  if (t === 'step:vel') return TAP_VEL_DEFAULT;
  // SMPL SAMPLE : celui du kit de depart (BD, SD, OH : le premier sample de Mika ; les autres OFF)
  if (t === 'smpl:sample') {
    const f = soundFamily();
    const key = f ? KIT_DEFAULT.sample[f] : undefined;
    return f && key ? samplesOf(f).findIndex((x) => x.key === key) + 1 : 0;
  }
  // SOUND : celui du kit de depart (BD, SD, OH : le premier sample de Mika ; les autres leur machine MM)
  if (t === 'voice:sound') {
    const f = soundFamily();
    const inst = pattern.get().instrument;
    if (!f || !inst) return 0;
    const key = KIT_DEFAULT.sample[f];
    const list = voiceSounds(inst);
    const i = key ? list.findIndex((x) => x.kind === 'smp' && x.key === key) : list.findIndex((x) => x.kind === 'mach' && x.key === KIT_DEFAULT.model[f]);
    return Math.max(0, i);
  }
  // MIX : celui du kit de depart (le sample seul pour BD, SD et OH)
  if (t === 'voice:mix') {
    const f = soundFamily();
    return f ? mixOf(KIT_DEFAULT.layer[f].syn, KIT_DEFAULT.layer[f].lev) : 0;
  }
  const r = kitIdOf(t);
  if (r) return kit.def(r);
  const lp = layerIdOf(t);
  if (lp) return layerReset(lp);
  const mi = mixerInst(t);
  if (mi) {
    setVoiceFx(mi, 'level', VOICE_FX_DEFAULT.level);
    return VOICE_FX_DEFAULT.level;
  }
  const sd = seqDialOf(t);
  if (sd) return seqDefault(sd);
  const k = voyId(t);
  return k ? voyParams.def(k) : dialReset(t as EncId);
}

/**
 * Les potards a l'ecran du telephone (2026-10-04, ui/KnobPanel.tsx, Mika :
 * "tous les boutons, beau et accessible, pas tout petit") : la meme saisie
 * que la machine, lue d'un seul identifiant (DialId).
 */

/** La course d'un potard : TEMPO en BPM, TONE et STRETCH de -1 a 1, les autres de 0 a 1 ; VEL de 1 a 9 (0 a 9 en P-LOCK). */
export function dialRange(id: DialId): [number, number] {
  const t = resolve(id);
  if (t === null) return [0, 1];
  const inPage = pageKnobOf(id) >= 0;
  if (t === 'vsound' && inPage && lockMode()) return [0, Math.max(1, lockSoundsOf().length - 1)];
  if (t === 'step:vel') return inPage && lockMode() ? [0, VEL_MAX] : [1, VEL_MAX];
  // SAMPLE en LOCK (R3) : OFF, les samples de la voix, puis ceux des autres voix (le sample lock)
  if (t === 'smpl:sample' && inPage && lockMode()) return [0, Math.max(1, lockSampleList().length - 1)];
  if (t === 'smpl:sample') return [0, Math.max(1, sampleCount())];
  // SOUND (2026-10-09) : sa liste ; en P-LOCK, avec les samples des autres voix
  if (t === 'voice:sound') {
    const inst = pattern.get().instrument;
    return [0, Math.max(1, inst ? voiceSounds(inst, inPage && lockMode()).length - 1 : 1)];
  }
  if (t === 'voice:mix') return [0, 1];
  const lp = layerIdOf(t);
  if (lp) return layerSpan(lp);
  const sd = seqDialOf(t);
  if (sd) return seqRange(sd);
  if (kitIdOf(t) || voyId(t)) return [0, 1];
  if (t === 'tempo') return [BPM.min, BPM.max];
  return [potMin(t as EncId), 1];
}

/** Ses crans (0 : continu) : les selecteurs du MM-ARP (pas le morphing de WAVE), les choix de son du kit. */
export function dialSteps(id: DialId): number {
  const t = resolve(id);
  if (t === null) return 0;
  const inPage = pageKnobOf(id) >= 0;
  if (t === 'step:vel') return inPage && lockMode() ? VEL_MAX + 1 : VEL_MAX;
  // SOUND en LOCK (2026-10-08) : les sons de toutes les familles, un cran chacun
  if (t === 'vsound' && inPage && lockMode()) return lockSoundsOf().length;
  // PITCH : au demi-ton, 49 crans (-24 a +24) ; FINE au cent (129) ; le TYPE du filtre (LP HP BP) ; DLY TIME ses divisions
  if (t === 'vtune') return 49;
  if (t === 'vfine') return 129;
  if (t === 'vftype') return 3;
  if (t === 'dtime') return DELAY_DIVS.length;
  // RATIO et HPF du COMP (2026-10-18, audio/pattern.ts FX_NOTCHES) : leurs crans
  if (isFxSetting(t) && FX_NOTCHES[t]) return FX_NOTCHES[t] ?? 0;
  if (t === 'smpl:sample' && inPage && lockMode()) return lockSampleList().length;
  if (t === 'smpl:sample') {
    const n = sampleCount();
    return n > 0 ? n + 1 : 0;
  }
  if (t === 'voice:sound') {
    const inst = pattern.get().instrument;
    return inst ? voiceSounds(inst, inPage && lockMode()).length : 0;
  }
  if (t === 'voice:mix') return 0;
  const lp = layerIdOf(t);
  if (lp) return layerNotches(lp);
  // Les reglages de trig et des LFO (V.5.1) : des entiers, un cran chacun
  const sd = seqDialOf(t);
  if (sd) {
    const [lo, hi] = seqRange(sd);
    return hi - lo + 1;
  }
  if (t === 'vsound') {
    const f = soundFamily();
    return f ? kitSteps(f) : 0;
  }
  const r = kitIdOf(t);
  if (r) return kitSteps(r);
  const k = voyId(t);
  if (k) {
    const vk = voyKnob(k);
    return vk.morph ? 0 : (vk.steps?.length ?? 0);
  }
  return 0;
}

/**
 * Un cran de molette ou de fleche (2026-10-08, Mika : "de 0 a 127") : un
 * cent-vingt-septieme de la course (un cran pour un reglage a crans), n crans
 * dans le sens de n. Un cran que le reglage ne prend pas (un TWEAK du kit au
 * cinquantieme, le centre accrocheur de TONE et STRETCH) est repris un cran
 * plus loin, jusqu'a ce que la valeur bouge : jamais un geste sans effet.
 */
export function dialNudge(id: DialId, n: number, set: (v: number) => void = (v) => anyDial(id, v)): void {
  if (n === 0) return;
  const [lo, hi] = dialRange(id);
  const steps = dialSteps(id);
  const notch = steps > 1 ? (hi - lo) / (steps - 1) : (hi - lo) / 127;
  // D'ou part le cran et ce qui dit qu'il a pris : la valeur de la scene armee (2026-10-27 : sans cela, un cran de molette
  // ecrivait jusqu'a huit valeurs de scene), sinon la base
  const v0 = dialEdit(id);
  for (let m = 1; m <= 8; m += 1) {
    const v = Math.min(hi, Math.max(lo, v0 + n * notch * m));
    set(Math.round(v * 10000) / 10000);
    if (dialEdit(id) !== v0 || v === lo || v === hi) return;
  }
}

/** Sa valeur lisible (celle des ecrans des machines) ; une voix a choisir d'abord pour la rangee VOICE. */
export function dialReadout(id: DialId): string {
  const pk = pageKnobOf(id);
  if (pk >= 0) {
    const slot = pageSlotOf(pk);
    if (!slot || !slot.label) return 'nothing on this page';
    if (slot.graph) return `${slot.label}, a picture of the ${slot.graph === 'ahd' ? 'envelope' : 'filter'}`;
    const t = slot.target;
    if (t === null) return `${slot.label}, coming soon`;
    // En P-LOCK (2026-10-08) : ce que le pas a, verrouille ou non
    const ls = lockReadStep();
    if (lockMode() && ls >= 0) {
      const lv = pageLockView(pk, ls);
      if (slot.scope === 'all') return `${slot.label}, global, not lockable`;
      if (!slot.lock) return `${slot.label}, not lockable yet`;
      if (lv) return `${slot.label} ${lv.text}${lv.unit ? `, ${lv.unit.toLowerCase()}` : ''}, locked on step ${two(ls + 1)}`;
      return `${slot.label} ${dialValueText(id)}, not locked on step ${two(ls + 1)}`;
    }
    const inst = pattern.get().instrument;
    if (t === 'step:vel') {
      if (!inst) return 'TAP A VOICE';
      const v = rytmPage.tapVel(inst);
      return `VEL ${velTo127(v)}, ${velWord(v).toLowerCase()}, for the new steps of ${inst}`;
    }
    if (t === 'smpl:sample') {
      const txt = sampleText();
      return txt === '--' ? (inst ? 'SAMPLE, no samples for this voice' : 'TAP A VOICE') : `SAMPLE ${txt}, ${sampleUnit().toLowerCase()}`;
    }
    if (t === 'voice:sound' || t === 'voice:mix') {
      if (!inst) return 'TAP A VOICE';
      const p = kit.playsWith(inst as ShotId, null);
      return t === 'voice:sound' ? `SOUND ${voiceSoundText(inst, p)}, ${voiceSoundUnit(inst, p).toLowerCase()}` : `MIX ${mixText(p)}, ${mixUnit(p).toLowerCase()}`;
    }
    return dialReadout(t);
  }
  const r = kitIdOf(id);
  if (r) return kitReadout(r);
  const lp = layerIdOf(id);
  if (lp) {
    const inst = pattern.get().instrument;
    const f = soundFamily();
    if (!inst) return 'TAP A VOICE';
    return f ? layerReadout(lp, inst, f) : `${inst} HAS ONE SOUND`;
  }
  const k = voyId(id);
  if (k) return voyReadout(k, voyParams.of(k));
  const mi = mixerInst(id);
  if (mi) return `${mi} VOLUME ${dialValueText(id)}, ${dialUnit(id).toLowerCase()}`;
  const sd = seqDialOf(id);
  if (sd) {
    const inst = pattern.get().instrument;
    if (!inst) return 'TAP A VOICE';
    const v = seqValue(sd);
    return `${inst} ${seqName(sd)} ${seqText(sd, v)}, ${seqUnit(sd, v).toLowerCase()}`;
  }
  if (id === 'tempo') return tempoSync.label(pattern.get().bpm);
  const e = id as Exclude<EncId, 'tempo'>;
  if (isVoiceEnc(e) && !pattern.get().instrument) return 'TAP A VOICE';
  if (e === 'vsound') {
    const f = soundFamily();
    return f ? kit.readout(f) : `${pattern.get().instrument} HAS ONE SOUND`;
  }
  // Ce que montrent l'ecran et l'anneau (2026-10-27, revue B1, spec 10.3) : armee la scene, sinon ce qui joue, et le coin
  // de la scene ; sans scene, la base comme avant
  const sh = sceneNative(e, true);
  return sh === null ? readout(e, dialValue(e), dialTarget(e)) : `${readout(e, sh, dialTarget(e))}${sceneMark(e)}`;
}

/**
 * Sa valeur seule (sous un potard du telephone, dans un bloc de l'ecran) :
 * TEMPO en BPM, les potards du MM-RYTM de 0 a 127 (-64 a +63 a zero au
 * centre) depuis le 2026-10-08, un choix de son par son nom (909, BLUEPRINT),
 * GATE OFF ou ON ; le MM-ARP garde les siens (SAW, 52 HZ).
 */
export function dialValueText(id: DialId): string {
  const pk = pageKnobOf(id);
  if (pk >= 0) {
    const t = pageTarget(pk);
    if (t === null) return '--';
    const inst = pattern.get().instrument;
    // En P-LOCK (2026-10-08) : la valeur verrouillee du pas, sinon celle de la voix
    const ls = lockReadStep();
    if (ls >= 0 && inst) {
      const lv = pageLockView(pk, ls);
      if (lv) return lv.text;
      // VEL en P-LOCK : le pas lui-meme (vide : OFF)
      if (t === 'step:vel') return 'OFF';
    }
    if (t === 'step:vel') return inst ? String(velTo127(rytmPage.tapVel(inst))) : '--';
    if (t === 'smpl:sample') return sampleText();
    if (t === 'voice:sound') return inst ? (soundFamily() || ls >= 0 ? voiceSoundText(inst, kit.playsWith(inst as ShotId, null)) : '--') : '--';
    if (t === 'voice:mix') return inst && soundFamily() ? mixText(kit.playsWith(inst as ShotId, null)) : '--';
    return dialValueText(t);
  }
  const r = kitIdOf(id);
  if (r) return isFamily(r) || r === 'gate' ? kit.valueText(r) : v127Text(kit.value(r));
  const lp = layerIdOf(id);
  if (lp) return pattern.get().instrument && soundFamily() ? layerText(lp, layerValue(lp)) : '--';
  const k = voyId(id);
  if (k) return voyValueText(k, voyParams.of(k));
  if (mixerInst(id)) {
    const v = dialShown(id);
    return encText('vol', v, v, false);
  }
  const sd = seqDialOf(id);
  if (sd) return pattern.get().instrument ? seqText(sd, seqValue(sd)) : '--';
  if (id === 'tempo') return tempoSync.text(pattern.get().bpm);
  const e = id as Exclude<EncId, 'tempo'>;
  if (isVoiceEnc(e) && !pattern.get().instrument) return '--';
  if (e === 'vsound') {
    const f = soundFamily();
    return f ? kit.valueText(f) : '--';
  }
  const v = dialShown(e);
  return encText(e, v, potCourse(e, v), isBipolar(e));
}

/** La ligne d'unite d'un potard du MM-RYTM (216 MS, -3.2 DB, rytm/values.ts) ; '' sans unite. */
export function dialUnit(id: DialId): string {
  const t = resolve(id);
  if (t === null) return '';
  const pk = pageKnobOf(id);
  const ls = lockReadStep();
  const inst = pattern.get().instrument;
  if (pk >= 0 && ls >= 0 && inst) {
    const lv = pageLockView(pk, ls);
    if (lv) return lv.unit;
    if (t === 'step:vel') return 'EMPTY STEP';
  }
  if (t === 'step:vel') return inst ? `NEW STEPS ${velWord(rytmPage.tapVel(inst))}` : '';
  if (t === 'smpl:sample') return sampleUnit();
  if (t === 'voice:sound') return inst ? voiceSoundUnit(inst, kit.playsWith(inst as ShotId, null)) : '';
  if (t === 'voice:mix') return inst && soundFamily() ? mixUnit(kit.playsWith(inst as ShotId, null)) : '';
  const r = kitIdOf(t);
  if (r) return isFamily(r) ? '' : r === 'gate' ? 'SD + CP' : kitUnit(r);
  const lp = layerIdOf(t);
  if (lp) return inst ? layerUnitNow(lp) : '';
  if (t === 'vsound') {
    // Le choix du son : d'ou il vient (SYNTH 909 / 808 / MM, ou un echantillon) et son rang, comme le bloc de l'ecran
    const f = soundFamily();
    const n = f ? kitSteps(f) : 0;
    const i = f ? kitSoundIndex(f) : 0;
    return n > 0 ? `${i < 3 ? 'SYNTH' : 'SAMPLE'} ${i + 1}/${n}` : '';
  }
  if (voyId(t) || t === 'tempo') return '';
  const mi = mixerInst(t);
  if (mi) return encUnit('vol', dialShown(t));
  const sd = seqDialOf(t);
  if (sd) return inst ? seqUnit(sd, seqValue(sd)) : '';
  const e = t as ContEnc;
  if (isVoiceEnc(e) && !inst) return '';
  // DLY TIME : sa duree au tempo du moment ; ce qui se montre (2026-10-27 : la scene armee, ou ce qui joue)
  if (e === 'dtime') return `${Math.round(((60 / pattern.get().bpm / 4) * delayDiv(dialShown(e)).steps) * 1000)} MS`;
  return encUnit(e, dialShown(e));
}
