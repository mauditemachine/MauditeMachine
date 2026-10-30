/**
 * Les actions du MM-RYTM : les P-LOCKS (le LOCK, les verrous d'un pas, leur ecriture, leurs noms, leur liste). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/locks.ts.
 */

import { kitOverride, mix } from '../audio/drums';
import { voiceFx } from '../audio/voicefx';
import { KIT_MODELS, KIT_MODEL_LABEL, familyOf, isFamily, kit, kitSoundNames, type KitFamily, type KitModel, type Plays } from '../audio/kit';
import { lockOf, parseSnd, type LockKey, type StepLock } from '../audio/locks';
import { samplesOf } from '../audio/samples';
import { VEL_MAX, pattern, velocity } from '../audio/pattern';
import { lcdMessage } from '../state/lcdMessage';
import type { ShotId } from '../audio/shotsdsp';
import { editor } from '../state/editor';
import { presetMode } from '../state/presetMode';
import { rytmPage } from '../state/rytmPage';
import { rytmLock } from '../state/rytmLock';
import { sceneCtl } from '../state/sceneCtl';
import { SCREEN_PAGE, allScreens, pageLabel, pageSlots, type PageSlot } from '../rytm/pages';
import { encText, encUnit, kitUnitAt, layerText, layerUnit, v127Text, velTo127, velWord, type LayerDial } from '../rytm/values';
import { DT_FACE, LCD_NO_VOICE, POT_UI, isBipolar, potCourse, type Inst } from '../theme';
import { voyParams } from '../voyager/params';
import { two } from './shared';
import { sceneDrop } from './internal/scenes';
import { recHoldHint } from './internal/steps';
import type { ContEnc } from './internal/dials';
import { layerSpan, sampleCtx, voiceSoundAt } from './internal/kit';
import { FAM_TAG, LFO_KEY_NAMES, LOCK_FAMS, lockName, lockSampleCache, lockSoundCache, lockWrite } from './internal/locks';
import { stepWrites } from './steps';
import { anyDial, anyDialReset } from './anyDial';
import { type DialId, kitIdOf, layerIdOf, mixText, mixUnit, mixValueOf, pageSlotOf, voiceSounds, voiceSoundText, voiceSoundUnit } from './kit';
import { liveOn } from './live';
import { seqDialOf, seqRange, seqText, seqUnit } from './mixer';

/* ---------------- les verrous du MM-RYTM (2026-10-08, l'etape R2 des P-locks) ---------------- */

/*
 * Mika (2026-10-08) : "quand on clic sur un step on selectionne la partie
 * qu'on veut modifier, est-ce que le voice, est-ce que le FX, est-ce que
 * l'enveloppe, et ensuite on tourne un encoder sur ce step et donc ce step a
 * une valeur differente, et on voit a l'ecran que quand le sequenceur passe
 * sur ce step alors le changement est fait ... MEME CHOSE DANS RYTM". Un pas
 * tenu (ou mis en P-LOCK, state/rytmLock.ts), une page, un bloc de l'ecran
 * (ou un potard MIDI rytm:knob) : le bloc pose son verrou sur ce pas
 * (audio/locks.ts), l'ecran le montre en negatif. Hors de EDIT seulement (ses
 * pas y sont les patterns). Depuis le 2026-10-09 les encodeurs du desktop ne
 * verrouillent plus jamais (les FX globaux) : les verrous se font a l'ecran.
 */

/** Les blocs reglent-ils des verrous (un pas en P-LOCK ou tenu, hors EDIT) ? */
export function lockMode(): boolean {
  return rytmLock.active() && editor.get() !== 'mm808';
}

/** Le pas dont les blocs lisent les verrous : le pas en P-LOCK ; -1 hors P-LOCK. */
export function lockReadStep(): number {
  return lockMode() ? rytmLock.get().step : -1;
}

/** Un son de la liste de SOUND en LOCK (R2, l'ancien SOUND) : le verrou ('<famille>:<son>' ; '' : le son de la voix) et son nom. */
export interface LockSound {
  snd: string;
  label: string;
}

/**
 * SOUND en LOCK (le "sample lock" d'une Digitakt, R2) : les sons de la famille
 * de la voix d'abord (909, 808, MM, ses echantillons), puis ceux des autres
 * familles ; une voix sans famille (CY) commence par son propre son. Le
 * raccourci vsound (le MIDI rytm:enc:vsound) le garde.
 */
export function lockSounds(inst: Inst): readonly LockSound[] {
  let out = lockSoundCache.get(inst);
  if (out) return out;
  const own = familyOf(inst as ShotId);
  const list: LockSound[] = own ? [] : [{ snd: '', label: inst }];
  for (const f of own ? [own, ...LOCK_FAMS.filter((x) => x !== own)] : LOCK_FAMS) {
    const names = kitSoundNames(f);
    const sounds = [...KIT_MODELS, ...samplesOf(f).map((x) => x.key)];
    sounds.forEach((snd, i) => list.push({ snd: `${f}:${snd}`, label: f === own ? names[i] : `${FAM_TAG[f]} ${names[i]}` }));
  }
  out = list;
  lockSoundCache.set(inst, out);
  return out;
}

/**
 * SMPL SAMPLE en LOCK (R3, le sample lock de l'Analog Rytm) : OFF (la couche
 * SAMPLE muette sur ce pas), les echantillons de la famille de la voix, puis
 * ceux des autres familles ; une voix sans famille (CY) : OFF et ceux de toutes.
 */
export function lockSamples(inst: Inst): readonly LockSound[] {
  let out = lockSampleCache.get(inst);
  if (out) return out;
  const own = familyOf(inst as ShotId);
  const list: LockSound[] = [{ snd: `${own ?? 'bd'}:off`, label: 'OFF' }];
  for (const f of own ? [own, ...LOCK_FAMS.filter((x) => x !== own)] : LOCK_FAMS) {
    for (const x of samplesOf(f)) list.push({ snd: `${f}:${x.key}`, label: f === own ? x.label : `${FAM_TAG[f]} ${x.label}` });
  }
  out = list;
  lockSampleCache.set(inst, out);
  return out;
}

/** Les cles de verrou qu'un bloc ecrit (le son et le melange en ont plusieurs). */
const slotLockKeys = (slot: PageSlot): readonly LockKey[] => (slot.locks ? slot.locks : slot.lock && slot.lock !== 'vel' ? [slot.lock] : []);

/** Le bloc porte-t-il un verrou sur ce pas ? SOUND : son son ou sa machine ; MIX : un de ses niveaux ; les autres : leur cle. */
function slotLocked(slot: PageSlot, l: Readonly<StepLock>): boolean {
  if (slot.target === 'voice:sound') return l.snd !== undefined || l.mach !== undefined;
  if (slot.target === 'voice:mix') return l.syn !== undefined || l.slev !== undefined;
  return !!slot.lock && slot.lock !== 'vel' && l[slot.lock] !== undefined;
}

/**
 * Ce que montre le bloc k pour les verrous du pas `step` de la voix choisie
 * (en P-LOCK, ou le pas qui joue) : sa valeur ecrite, son unite, sa course et
 * sa valeur ; null quand le pas n'a pas de verrou pour ce bloc. VEL : la
 * velocite du pas lui-meme (c'est son verrou), null sur un pas vide.
 */
export function pageLockView(k: number, step: number, lockArg?: Readonly<StepLock> | null): LockView | null {
  const slot = pageSlotOf(k);
  const inst = pattern.get().instrument;
  if (!slot || !inst) return null;
  return slotLockView(slot, inst, step, lockArg);
}

/** Ce qu'un verrou montre : sa valeur ecrite, son unite, sa course et sa valeur. */
export interface LockView {
  text: string;
  unit: string;
  course: number;
  value: number;
}

/** Un verrou du pas, nomme et ecrit (le panneau des verrous de l'ecran, toutes pages, revue de R2). */
export interface LockLine extends LockView {
  page: string;
  name: string;
}

/**
 * Tous les verrous du pas `step` de la voix choisie, ecran apres ecran, avec
 * leur valeur (revue de R2) : un par bloc qui en porte (SOUND, MIX : un seul
 * pour leurs cles) ; VEL n'en est pas un (c'est le pas). Les verrous d'un
 * reglage qui n'est plus sur aucun ecran (S.TUNE, S.START de l'ancien SMPL)
 * suivent, a leur nom : ils jouent encore, CLEAR les efface.
 */
export function lockList(step: number, lockArg?: Readonly<StepLock> | null): LockLine[] {
  const inst = pattern.get().instrument;
  if (!inst || step < 0) return [];
  const l = lockArg === undefined ? lockOf(pattern.get().locks, inst, step) : lockArg;
  if (!l) return [];
  const out: LockLine[] = [];
  const seen = new Set<string>();
  for (const sc of allScreens(inst)) {
    for (const slot of pageSlots(sc, inst)) {
      if (!slot.lock || slot.lock === 'vel' || slot.graph) continue;
      const keys = slotLockKeys(slot);
      if (keys.every((x) => seen.has(x)) || !slotLocked(slot, l)) continue;
      const lv = slotLockView(slot, inst, step, l);
      if (!lv) continue;
      for (const x of keys) seen.add(x);
      out.push({ ...lv, page: pageLabel(SCREEN_PAGE[sc]), name: lockNameOf(slot.lock, inst) ?? lockName(slot) });
    }
  }
  // Les cles sans bloc (les reglages de l'ancien SMPL) : a leur nom, leur valeur brute
  for (const x of LOCK_NAMES) {
    if (seen.has(x.key) || !(x.key in l)) continue;
    const v = (l as Record<string, unknown>)[x.key];
    if (typeof v !== 'number') continue;
    seen.add(x.key);
    const lp = LEGACY_LAYER[x.key];
    out.push({ text: lp ? layerText(lp, v) : v127Text(Math.max(0, Math.min(1, v))), unit: '', course: 0, value: v, page: x.page, name: x.name });
  }
  return out;
}

function slotLockView(slot: PageSlot, inst: Inst, step: number, lockArg?: Readonly<StepLock> | null): LockView | null {
  if (!slot.lock || step < 0) return null;
  if (slot.lock === 'vel') {
    const v = velocity(pattern.get().steps, inst, step);
    if (v === 0) return null;
    // Le pas est deja dans P-LOCK 05 de l'en-tete : son mot seul, HIGH MID LOW ou son gain
    return { text: String(velTo127(v)), unit: velWord(v), course: v / VEL_MAX, value: v };
  }
  const l = lockArg === undefined ? lockOf(pattern.get().locks, inst, step) : lockArg;
  if (!l || !slotLocked(slot, l)) return null;
  // SOUND (2026-10-09) : ce que le pas joue, son rang dans la liste du P-LOCK
  if (slot.target === 'voice:sound') {
    const p = stepPlays(inst, l);
    const list = voiceSounds(inst, true);
    const i = voiceSoundAt(list, p);
    return { text: voiceSoundText(inst, p), unit: voiceSoundUnit(inst, p), course: list.length > 1 ? i / (list.length - 1) : 0, value: i };
  }
  if (slot.target === 'voice:mix') {
    const p = stepPlays(inst, l);
    const m = mixValueOf(p);
    return { text: mixText(p), unit: mixUnit(p), course: m, value: m };
  }
  if (slot.lock === 'mach') {
    if (!l.mach) return null;
    const i = Math.max(0, KIT_MODELS.indexOf(l.mach as KitModel));
    return { text: KIT_MODEL_LABEL[KIT_MODELS[i]], unit: 'SYNTH', course: i / (KIT_MODELS.length - 1), value: i };
  }
  if (slot.lock === 'snd') {
    if (!l.snd) return null;
    if (slot.target === 'smpl:sample') {
      // La couche SAMPLE du pas (R3) : OFF, un sample de la voix, ou d'une autre voix
      const list = lockSamples(inst);
      const i = list.findIndex((x) => x.snd === l.snd);
      const off = parseSnd(l.snd)?.sound === 'off';
      const n = Math.max(1, list.length - 1);
      return { text: off ? 'OFF' : i > 0 ? list[i].label : sndLabel(inst, l.snd), unit: off ? 'NO SAMPLE' : i > 0 ? `${i} OF ${n}` : 'SAMPLE', course: i > 0 ? i / n : 0, value: Math.max(0, i) };
    }
    const label = sndLabel(inst, l.snd);
    const list = lockSounds(inst);
    const i = list.findIndex((x) => x.snd === l.snd);
    const n = Math.max(1, list.length - 1);
    const ps = parseSnd(l.snd);
    const synth = !!ps && (KIT_MODELS as readonly string[]).includes(ps.sound);
    return { text: label, unit: synth ? 'SYNTH' : 'SAMPLE', course: Math.max(0, i) / n, value: Math.max(0, i) };
  }
  const id = slot.lock;
  const v = l[id];
  if (v === undefined) return null;
  // Un reglage de couche (R3) : son nombre et son unite a cette valeur
  const lp = slot.target ? layerIdOf(slot.target) : null;
  if (lp && lp !== 'mach') {
    const [lo, hi] = layerSpan(lp);
    const f = familyOf(inst as ShotId);
    return { text: layerText(lp, v), unit: layerUnit(lp, v, f ? sampleCtx(f, l) : undefined), course: hi > lo ? (v - lo) / (hi - lo) : 0, value: v };
  }
  // Un reglage de trig ou d'un LFO (V.5.1) : son texte et son unite a cette valeur
  const sd = slot.target ? seqDialOf(slot.target) : null;
  if (sd) {
    const [lo, hi] = seqRange(sd);
    return { text: seqText(sd, v), unit: seqUnit(sd, v, l), course: hi > lo ? (v - lo) / (hi - lo) : 0, value: v };
  }
  // Un potard de la machine (revue de R2) : 0 a 127 et son unite a cette valeur (52 HZ, 216 MS) ; GATE ON ou OFF
  const r = slot.target && slot.target !== 'step:vel' && slot.target !== 'smpl:sample' ? kitIdOf(slot.target) : null;
  if (r && !isFamily(r)) {
    if (r === 'gate') return { text: kit.knobText('gate', v), unit: `STEP ${two(step + 1)}`, course: v, value: v };
    return { text: v127Text(v), unit: kitUnitAt(r, v), course: v, value: v };
  }
  const e = slot.target as ContEnc;
  const course = potCourse(e, v);
  return { text: encText(e, v, course, isBipolar(e)), unit: encUnit(e, v), course, value: v };
}

/** Le nom d'un son verrouille, tel que la liste l'ecrit (BLUEPRINT, CP 909). */
function sndLabel(inst: Inst, snd: string): string {
  const hit = lockSounds(inst).find((x) => x.snd === snd);
  if (hit) return hit.label;
  const p = parseSnd(snd);
  return p ? kit.soundName(p.family as KitFamily, p.sound) : snd.toUpperCase();
}

/** Les reglages de l'ancien SMPL sans bloc depuis le 2026-10-09 : leur nombre comme leur page l'ecrivait. */
const LEGACY_LAYER: Readonly<Record<string, LayerDial>> = { stune: 'tune', sfine: 'fine', sstart: 'start' };
const LOCK_NAMES: readonly { key: string; name: string; page: string }[] = [
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

/** Le nom court d'un verrou pour cette voix (le TONE de la caisse claire, le TUNE du kick : ceux de leur machine). */
function lockNameOf(key: string, _inst: Inst): string | undefined {
  return LOCK_NAMES.find((x) => x.key === key)?.name;
}

/** Les verrous du pas en P-LOCK, par leur nom court, toutes pages, dans l'ordre des pages : SOUND VOL DEC (l'ecran et le Dock les listent). */
export function lockSummary(step: number): string[] {
  const inst = pattern.get().instrument;
  const l = inst && step >= 0 ? lockOf(pattern.get().locks, inst, step) : null;
  if (!l || !inst) return [];
  // Une fois chaque nom (MIX pose ses deux niveaux, SOUND sa machine et son sample)
  const names = LOCK_NAMES.filter((x) => x.key in l).map((x) => (x.key === 'mach' && l.snd !== undefined ? 'SOUND' : (lockNameOf(x.key, inst) ?? x.name)));
  return [...new Set(names)];
}

/** Combien de verrous sur ce pas (un par reglage : SOUND et MIX comptent une fois) : le compte de l'en-tete, 3 P-LOCKS. */
export function lockCountOf(step: number): number {
  return lockSummary(step).length;
}

/** Les pages ou le pas a des verrous (VOICE ENV) : le pied de l'ecran les dit quand la liste ne tient pas. */
export function lockPages(step: number): string[] {
  const inst = pattern.get().instrument;
  const l = inst && step >= 0 ? lockOf(pattern.get().locks, inst, step) : null;
  if (!l) return [];
  return [...new Set(LOCK_NAMES.filter((x) => x.key in l).map((x) => x.page))];
}

/**
 * Ce que joue la voix sur un pas (revue de R3, 2026-10-08) : ses deux
 * couches avec les verrous du pas (null : le kit du moment) ; un sample
 * emprunte a une autre famille y joue seul (audio/kit.ts). L'ecran (l'en-tete,
 * les blocs en retrait) et les messages du P-LOCK le lisent.
 */
export function stepPlays(inst: Inst, lock: Readonly<StepLock> | null | undefined): Plays {
  return kit.playsWith(inst as ShotId, lock ? kitOverride(lock) : null);
}

/**
 * Deux tapes sur un bloc (la face, le Dock, l'ecran) : en P-LOCK, son verrou
 * s'en va (le pas reprend la valeur de la voix ; SOUND et MIX : toutes leurs
 * cles) ; sinon, sa valeur de depart.
 */
export function pageKnobReset(k: number): void {
  const id = `p:${k}` as DialId;
  // Une scene armee (2026-10-27) : sa cle s'en va (le reglage revient a la base dans cette scene)
  if (sceneDrop(id)) return;
  if (!lockMode()) {
    anyDial(id, anyDialReset(id));
    return;
  }
  const slot = pageSlotOf(k);
  const inst = pattern.get().instrument;
  if (!slot || !slot.label || slot.target === null || slot.graph) return;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  if (slot.scope === 'all' || !slot.lock) {
    lockWrite(k, slot, 0);
    return;
  }
  const steps = rytmLock.targets();
  const at = rytmLock.get().step >= 0 ? rytmLock.get().step : steps[0];
  if (slot.lock === 'vel') {
    // VEL : un pas remis a la velocite des nouveaux pas de la voix
    for (const i of steps) pattern.set(inst, i, rytmPage.tapVel(inst));
  } else for (const key of slotLockKeys(slot)) pattern.clearLock(inst, steps, key);
  rytmLock.wrote();
  lcdMessage.show(`STEP ${two(at + 1)} ${lockName(slot)} ${slot.lock === 'vel' ? velWord(rytmPage.tapVel(inst)) : 'UNLOCKED'}`, POT_UI.readoutMs, true);
  rytmPage.echo(k, inst);
}

/**
 * Le P-LOCK sur le pas i (une tenue, L, le MIDI, le Dock) ; latched : il reste
 * au lacher. L'ecran passe a la vue PAGE (HOME ne montre pas les blocs).
 * false s'il n'a pas pu (EDIT, pas de voix).
 */
export function rytmLockEnter(i: number, latched: boolean, dock = false): boolean {
  if (editor.get() === 'mm808') {
    // V.5.0 au desktop : la touche s'appelle PTN
    lcdMessage.show(DT_FACE ? 'CLOSE PTN TO P-LOCK A STEP' : 'CLOSE EDIT TO P-LOCK A STEP');
    return false;
  }
  // Le P-LOCK demande REC au desktop (V.5.0, comme la Digitakt) ; le Dock garde le sien
  if (!dock && !stepWrites()) {
    recHoldHint(true);
    return false;
  }
  // LIVE REC (V.5.3, la revue de D3b R1 R14) : un pas 1 a 8 y est un pad ; les potards s'y enregistrent seuls
  if (!dock && liveOn()) {
    lcdMessage.show('LIVE REC: TURN A KNOB TO RECORD IT', 1400);
    return false;
  }
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return false;
  }
  rytmLock.enter(i, latched);
  rytmPage.select(i);
  rytmPage.setView('page');
  if (presetMode.on('mm808')) presetMode.close();
  const n = lockCountOf(i);
  lcdMessage.show(`P-LOCK STEP ${two(i + 1)} ${inst}${n > 0 ? `: ${n} P-LOCK${n > 1 ? 'S' : ''}` : ''}`, POT_UI.readoutMs, true);
  return true;
}

/** Une tape sur un pas en P-LOCK : le meme pas en sort, un autre y deplace le P-LOCK. */
export function rytmLockTap(i: number): void {
  const s = rytmLock.get();
  if (s.step === i) {
    rytmLock.leave();
    lcdMessage.show('P-LOCK OFF');
    return;
  }
  rytmLockEnter(i, true);
}

/** L, rytm:lock : le P-LOCK sur ce pas (le pas choisi par defaut), ou hors P-LOCK s'il y est deja. */
export function rytmLockToggle(i: number = rytmPage.get().sel, dock = false): void {
  const s = rytmLock.get();
  if (s.step >= 0 && (i < 0 || s.step === i)) {
    rytmLock.leave();
    lcdMessage.show('P-LOCK OFF');
    return;
  }
  if (i < 0) {
    lcdMessage.show(stepWrites() || dock ? 'HOLD A STEP TO P-LOCK IT' : '● REC + HOLD A STEP: P-LOCK');
    return;
  }
  rytmLockEnter(i, true, dock);
}

/** CLEAR en P-LOCK : les verrous des pas en P-LOCK (ou tenus) s'en vont ; leurs coups restent. */
export function rytmLockClear(): void {
  const inst = pattern.get().instrument;
  const steps = rytmLock.targets();
  if (!inst || steps.length === 0) return;
  const had = steps.some((i) => lockOf(pattern.get().locks, inst, i) !== null);
  pattern.clearLock(inst, steps);
  rytmLock.wrote();
  const who = steps.length > 1 ? `${steps.length} STEPS` : `STEP ${two(steps[0] + 1)}`;
  lcdMessage.show(had ? `${who} P-LOCKS CLEARED` : `${who} HAS NO P-LOCKS`);
}

/** Un seul abonnement pour toutes les valeurs des potards (les deux machines, le kit). */
export function subscribeDials(fn: () => void): () => void {
  // Les scenes, leur armement et le crossfader (2026-10-28) : un potard qu'une scene fait entendre bouge avec eux
  const offs = [voyParams.subscribe(fn), mix.subscribe(fn), voiceFx.subscribe(fn), kit.subscribe(() => fn()), pattern.subscribe(fn), pattern.fx.subscribe(fn), rytmLock.subscribe(fn), pattern.scenes.subscribe(() => fn()), sceneCtl.subscribe(fn), sceneCtl.onX(() => fn())];
  return () => {
    for (const off of offs) off();
  };
}
