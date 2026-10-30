/**
 * Les actions du MM-RYTM, kit : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { kitOverride, resume } from '../../audio/drums';
import { KIT_DEFAULT, KIT_MODELS, KIT_MODEL_LABEL, LAYER_DEFAULT, kit, kitSteps, layerRange, layerSteps, mixLevels, type KitFamily, type KitModel, type Plays } from '../../audio/kit';
import { type StepLock } from '../../audio/locks';
import { samplesOf, type SampleFail } from '../../audio/samples';
import { VEL_MAX, pattern } from '../../audio/pattern';
import { lcdMessage } from '../../state/lcdMessage';
import type { ShotId } from '../../audio/shotsdsp';
import { rytmPage } from '../../state/rytmPage';
import { layerText, layerUnit, velTo127, velWord, type LayerDial } from '../../rytm/values';
import { LCD_NO_VOICE, POT_UI, type Inst } from '../../theme';
import { type VoyKnobId } from '../../voyager/params';
import { touchPage } from './dials';
import { soundBrowserFollow } from './browser';
import { type DialId, mixText, soundFamily, type VoiceSound, voiceSounds, voiceSoundText } from '../kit';

/** SAMPLE : le son de la voix selectionnee ; l'ecran montre la liste de ses sons (le navigateur, state/lcdSamples.ts). */
export function soundDial(v: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const f = soundFamily();
  if (!f) {
    lcdMessage.show(`${inst} HAS ONE SOUND`);
    return;
  }
  kit.set(f, v);
  soundBrowserFollow();
  touchPage('vsound', inst);
}

export const voyId = (id: DialId): VoyKnobId | null => (id.startsWith('v:') ? (id.slice(2) as VoyKnobId) : null);
/** Son nom dans un message. */
const LAYER_NAME: Readonly<Record<LayerDial, string>> = {
  mach: 'MACHINE',
  syn: 'SYNTH LEVEL',
  lev: 'SAMPLE LEVEL',
  tune: 'SAMPLE TUNE',
  fine: 'SAMPLE FINE',
  start: 'SAMPLE START',
  len: 'SAMPLE LEN',
  rev: 'SAMPLE REV',
};

/** La valeur d'un reglage de couche d'une famille (la MACHINE : son rang, 0 a 2 ; null : CY, sans couches). */
export function layerValueOf(f: KitFamily | null, p: LayerDial): number {
  if (!f) return p === 'mach' ? KIT_MODELS.indexOf('mm') : LAYER_DEFAULT[p];
  return p === 'mach' ? KIT_MODELS.indexOf(kit.get().model[f]) : kit.layerOf(f)[p];
}
/** Celle de la voix choisie. */
export const layerValue = (p: LayerDial): number => layerValueOf(soundFamily(), p);
export const layerSpan = (p: LayerDial): [number, number] => (p === 'mach' ? [0, KIT_MODELS.length - 1] : layerRange(p));
export const layerNotches = (p: LayerDial): number => (p === 'mach' ? KIT_MODELS.length : layerSteps(p));
/** Son depart : celui du kit de depart (BD, SD et OH : SYNTH 0, leurs samples). */
export function layerReset(p: LayerDial): number {
  const f = soundFamily();
  if (!f) return layerValue(p);
  return p === 'mach' ? KIT_MODELS.indexOf(KIT_DEFAULT.model[f]) : kit.layerDef(f, p);
}
/**
 * Ce que la couche SAMPLE de la voix joue (LEN se dit en ms quand le fichier
 * est la) ; lock : le pas montre (revue de R3 : son sample, son START et son
 * TUNE verrouilles comptent dans la longueur de LEN).
 */
export const sampleCtx = (f: KitFamily, lock?: Readonly<StepLock> | null): { key: string; layer: ReturnType<typeof kit.layerOf> } | undefined => {
  const ov = lock ? kitOverride(lock) : null;
  const snd = ov && ov.sample !== undefined ? ov.sample : kit.get().sample[f];
  if (!snd) return undefined;
  return { key: snd, layer: ov?.layer ? { ...kit.layerOf(f), ...ov.layer } : kit.layerOf(f) };
};
/** Sa ligne d'unite, ce qui l'empeche de s'entendre compris (la couche muette) ; f : la famille (la voix choisie). */
export function layerUnitNow(p: LayerDial, f: KitFamily | null = soundFamily()): string {
  if (!f) return '';
  const v = layerValueOf(f, p);
  if (p === 'mach') return kit.layerOf(f).syn > 0 ? 'SYNTH' : 'SYNTH OFF';
  return layerUnit(p, v, sampleCtx(f));
}

/** Ce que dit l'ecran quand un reglage de couche tourne : BD SAMPLE TUNE +2  2ND ; et pourquoi il ne s'entend pas. */
export function layerReadout(p: LayerDial, inst: Inst | string, f: KitFamily): string {
  const l = kit.layerOf(f);
  const smp = !!kit.get().sample[f];
  let why = '';
  if (p !== 'mach' && p !== 'syn' && !smp) why = '  SAMPLE OFF';
  else if ((p === 'syn' && l.syn <= 0 && (!smp || l.lev <= 0)) || (p === 'lev' && l.lev <= 0 && l.syn <= 0)) why = '  VOICE SILENT';
  // La MACHINE : son nom, et la couche a rallumer si elle est muette (l'unite SYNTH OFF ne se repete pas)
  if (p === 'mach') return `${inst} MACHINE ${layerText(p, layerValueOf(f, p))}${l.syn <= 0 ? '  SYNTH OFF: LEVEL H' : ''}`;
  return `${inst} ${LAYER_NAME[p]} ${layerText(p, layerValueOf(f, p))}  ${layerUnitNow(p, f)}${why}`;
}

/** Un reglage de couche tourne (un potard de page, un jumeau) : la voix choisie, sa famille. */
export function layerDial(p: LayerDial, v: number): void {
  resume();
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const f = soundFamily();
  if (!f) {
    lcdMessage.show(`${inst} HAS ONE SOUND`);
    return;
  }
  // La MACHINE : trois crans, son nom dans le bloc et au pied suffit (pas de liste)
  if (p === 'mach') kit.setMachine(f, KIT_MODELS[Math.max(0, Math.min(KIT_MODELS.length - 1, Math.round(v)))]);
  else kit.setLayer(f, p, v);
  lcdMessage.show(layerReadout(p, inst, f), POT_UI.readoutMs, true);
  touchPage(`l:${p}`, inst);
}

/** Les echantillons de la famille de la voix choisie, 0 sans voix ni famille. */
export function sampleCount(): number {
  const f = soundFamily();
  return f ? Math.max(0, kitSteps(f) - KIT_MODELS.length) : 0;
}

/** SMPL SAMPLE (l'ancien, le MIDI et l'INFOS le connaissent) : 0 (OFF) ou le rang de l'echantillon de la couche, 1 a n. */
export function sampleValue(): number {
  const f = soundFamily();
  if (!f) return 0;
  const key = kit.get().sample[f];
  return key ? samplesOf(f).findIndex((x) => x.key === key) + 1 : 0;
}

/**
 * SMPL SAMPLE tourne (2026-10-08, revue de R1 ; la couche SAMPLE depuis R3) :
 * OFF coupe la couche SAMPLE, un cran plus loin l'un des echantillons de la
 * famille ; la liste s'ouvre a l'ecran. Plus sur aucune page depuis le
 * 2026-10-09 (SOUND de VOICE le remplace) : le chemin reste pour ce qui le vise.
 */
export function sampleDial(v: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const f = soundFamily();
  const n = sampleCount();
  if (!f || n === 0) {
    lcdMessage.show(`${inst}: NO SAMPLES`);
    return;
  }
  const j = Math.max(0, Math.min(n, Math.round(v)));
  kit.setSample(f, j === 0 ? null : samplesOf(f)[j - 1].key);
  // La liste de SOUND de la voix (le navigateur, 2026-10-18 : une seule liste, l'ancienne couche SAMPLE y est)
  soundBrowserFollow();
  if (j === 0) lcdMessage.show(kit.layerOf(f).syn > 0 ? `${inst} SAMPLE OFF: SYNTH ONLY` : `${inst} SILENT: SOUND UP`, POT_UI.readoutMs, true);
  touchPage('smpl:sample', inst);
}

/** SMPL SAMPLE ecrit : OFF, ou le nom de l'echantillon de la couche SAMPLE ; '--' sans echantillon a choisir. */
export function sampleText(): string {
  const f = soundFamily();
  if (!f || sampleCount() === 0) return '--';
  return sampleValue() === 0 ? 'OFF' : kit.sampleLabel(f);
}

/** Sa ligne d'unite : SYNTH 909 (OFF : le son de synthese joue), 2 OF 6. */
export function sampleUnit(): string {
  const f = soundFamily();
  const n = sampleCount();
  if (!f) return '';
  if (n === 0) return 'NO SAMPLES';
  const j = sampleValue();
  return j === 0 ? (kit.layerOf(f).syn > 0 ? `SYNTH ${KIT_MODEL_LABEL[kit.get().model[f]]}` : 'VOICE SILENT') : `${j} OF ${n}`;
}

export const voiceSoundCache = new Map<string, readonly VoiceSound[]>();

/** Le rang de ce que joue p (une voix, un pas) dans une liste de SOUND. */
export function voiceSoundAt(list: readonly VoiceSound[], p: Readonly<Plays>): number {
  if (p.smp && p.sample) {
    const i = list.findIndex((x) => x.kind === 'smp' && x.key === p.sample);
    if (i >= 0) return i;
  }
  if (p.synth) {
    const i = list.findIndex((x) => x.kind === 'mach' && x.key === p.model);
    if (i >= 0) return i;
  }
  return 0;
}

/** Le mot d'un sample en echec (2026-10-21) : l'ecran dit pourquoi la voix ne le joue pas. */
export const FAIL_WORD: Readonly<Record<SampleFail, string>> = { offline: 'OFFLINE', missing: 'FILE MISSING', bad: 'FILE ERROR', storage: 'STORAGE OFF', gone: 'REMOVED' };
/** Le meme, court (la colonne de droite du navigateur des sons). */
export const FAIL_TAG: Readonly<Record<SampleFail, string>> = { offline: 'OFFLINE', missing: 'MISSING', bad: 'ERROR', storage: 'STORAGE', gone: 'GONE' };

/** Le niveau des couches a garder quand le son change : le plus fort des deux (1 si la voix se taisait). */
export const layerTop = (syn: number, lev: number): number => (Math.max(syn, lev) > 0 ? Math.max(syn, lev) : 1);

/**
 * La voix joue ce son de sa liste de SOUND (hors P-LOCK ; audio/kit.ts setVoice) : OFF la fait taire ; une machine
 * joue seule a son niveau (le sample reste en memoire, MIX le ramene) ; un sample garde la synthese posee dessous s'il
 * y en avait un (MIX), sinon il joue seul a son niveau. Le potard, le navigateur des sons et un fichier depose (2026-10-18)
 * passent tous par ici.
 */
export function setVoiceSound(f: KitFamily, s: Readonly<Pick<VoiceSound, 'kind' | 'key'>>): void {
  const k = kit.get();
  const l = k.layer[f];
  const top = layerTop(l.syn, l.lev);
  const smpOn = !!k.sample[f] && l.lev > 0;
  if (s.kind === 'off') kit.setVoice(f, { syn: 0, lev: 0 });
  else if (s.kind === 'mach') kit.setVoice(f, { model: s.key as KitModel, syn: top, lev: 0 });
  else if (s.kind === 'smp') kit.setVoice(f, smpOn ? { sample: s.key } : { sample: s.key, syn: 0, lev: top });
}

/** SOUND tourne (hors P-LOCK) : la voix joue ce son, le navigateur des sons s'ouvre sur lui (2026-10-18). */
export function voiceSoundDial(v: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const f = soundFamily();
  if (!f) {
    lcdMessage.show(`${inst} HAS ONE SOUND: P-LOCK A SAMPLE`);
    return;
  }
  const list = voiceSounds(inst);
  setVoiceSound(f, list[Math.max(0, Math.min(list.length - 1, Math.round(v)))]);
  soundBrowserFollow();
  touchPage('voice:sound', inst);
}

/** Le son de la voix choisie dans sa liste (hors P-LOCK). */
export function voiceSoundValue(): number {
  const inst = pattern.get().instrument;
  const f = soundFamily();
  return inst && f ? kit.voiceIndex(f) : 0;
}

/** Le premier sample de la famille, celui du kit de depart d'abord (MIX qui pose un sample sous une machine seule). */
export function firstSampleOf(f: KitFamily): string | undefined {
  return KIT_DEFAULT.sample[f] ?? samplesOf(f)[0]?.key;
}

/** MIX tourne (hors P-LOCK) : les deux niveaux, le plus fort a sa place ; sans sample, le premier de la famille vient dessous. */
export function voiceMixDial(v: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const f = soundFamily();
  if (!f || samplesOf(f).length === 0) {
    lcdMessage.show(`${inst}: NO SAMPLES TO MIX`);
    return;
  }
  const k = kit.get();
  const l = k.layer[f];
  const m = Math.max(0, Math.min(1, v));
  const lv = mixLevels(m, layerTop(l.syn, l.lev));
  const sample = !k.sample[f] && m > 0 ? firstSampleOf(f) : undefined;
  kit.setVoice(f, { syn: lv.syn, lev: lv.lev, ...(sample ? { sample } : {}) });
  const p = kit.playsWith(inst as ShotId, null);
  lcdMessage.show(`${inst} MIX ${mixText(p)}  ${voiceSoundText(inst, p)}`, POT_UI.readoutMs, true);
  touchPage('voice:mix', inst);
}

/**
 * VEL hors P-LOCK (2026-10-09) : la velocite des nouveaux pas de la voix (et de son pad), 1 a 9. Plus de bloc VEL
 * depuis le 2026-10-10 (fusionne dans VOL) : seul un bloc step:vel l'appellerait encore.
 */
export function tapVelDial(v: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const n = Math.max(1, Math.min(VEL_MAX, Math.round(v)));
  rytmPage.setTapVel(inst, n);
  lcdMessage.show(`${inst} NEW STEPS VEL ${velTo127(n)}  ${velWord(n)}`, POT_UI.readoutMs, true);
  touchPage('step:vel', inst);
}
