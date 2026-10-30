/**
 * Les actions du MM-RYTM, pages : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { resume, setStretch, setVoiceFx } from '../../audio/drums';
import { VOICE_FX_DEFAULT, voiceFx, type VoiceFx, type VoiceParam } from '../../audio/voicefx';
import { TRIG_DEF, TRIG_PARAMS, type TrigSet } from '../../audio/trig';
import { LFO_PARAMS, lfoDefault, type LfoParam } from '../../audio/lfo';
import { INSTRUMENTS, pattern } from '../../audio/pattern';
import type { Stage } from '../../scene/renderer';
import { lcdMessage } from '../../state/lcdMessage';
import { editor } from '../../state/editor';
import { patterns, slotName } from '../../state/patterns';
import { presetMode } from '../../state/presetMode';
import { undo } from '../../state/undo';
import { rytmPage } from '../../state/rytmPage';
import { rytmLock } from '../../state/rytmLock';
import { SCREEN_LABEL, SCREEN_TITLE, pageLabel, screensOf, tabWord, type RytmPageId, type RytmScreenId } from '../../rytm/pages';
import { FACE_FOLLOWS_PAGE, LCD_NO_VOICE, type Inst } from '../../theme';
import { st } from '../state';
import { rand, two } from '../shared';
import { randomVoiceSounds } from './patterns';
import { mixerSet } from './mixer';
import { sceneTakeId } from '../scenes';
import { anyDial } from '../anyDial';
import { curScreen } from '../kit';

/**
 * EDIT ou le mode presets du MM-RYTM tiennent-ils l'ecran ? Une touche de
 * page les referme (2026-10-08, revue de R1) ; rend true s'il y en avait un.
 */
export function leaveRytmOverlay(): boolean {
  let left = false;
  if (editor.get() === 'mm808') {
    editor.close();
    left = true;
  }
  if (presetMode.on('mm808')) {
    presetMode.close();
    left = true;
  }
  return left;
}

/** Le chemin de toujours d'une touche de page (et des pages de FUNC au desktop). */
export function pageKeyBody(id: RytmPageId, stage: Stage | null): void {
  resume();
  stage?.pressPageKey(id);
  const inst = pattern.get().instrument;
  if (leaveRytmOverlay()) {
    rytmPage.setPage(id);
    lcdMessage.show(`${SCREEN_TITLE[curScreen()]} PAGE`);
    return;
  }
  const lk = rytmLock.get().step;
  if (lk >= 0 && editor.get() !== 'mm808') {
    const tabs = screensOf(id, inst).length;
    if (rytmPage.get().page === id && rytmPage.get().view === 'page' && tabs > 1) rytmPage.press(id, inst);
    else rytmPage.setPage(id);
    lcdMessage.show(`${SCREEN_TITLE[curScreen()]}  P-LOCK ${two(lk + 1)}`);
    return;
  }
  const was = rytmPage.get().view;
  const r = rytmPage.press(id, inst);
  // HOME le dit (et comment revenir) ; un onglet dit le suivant
  if (r.view === 'home') lcdMessage.show(`HOME  ${pageLabel(id)} AGAIN: PAGE`, 1600);
  else if (r.tabs > 1) {
    // SYNTH · VOICE AGAIN: MAIN (revue du 2026-10-09 : VOICE SYNTH  VOICE AGAIN: VOI. au telephone) ; au desktop depuis le
    // 2026-10-27 l'onglet dit son rang (SYNTH 2/2 : la deuxieme page des huit potards, comme une Digitakt)
    const next = screensOf(id, inst)[(r.tab + 1) % r.tabs];
    // Un onglet nomme par son rang (V.5.1, TRIG 1/2 et 2/2) : son titre, sans rang de plus (1/2 1/2 se lisait)
    const word = (sc: RytmScreenId): string => (SCREEN_LABEL[sc].includes('/') ? SCREEN_TITLE[sc] : tabWord(sc, inst));
    const cur = curScreen();
    const rank = FACE_FOLLOWS_PAGE && !SCREEN_LABEL[cur].includes('/') ? ` ${r.tab + 1}/${r.tabs}` : '';
    lcdMessage.show(`${word(cur)}${rank} · ${pageLabel(id)} AGAIN: ${word(next)}`, 1600);
  } else if (was === 'home') lcdMessage.show(`${pageLabel(id)} PAGE`);
}

/* ---------- la page au hasard (une page puis YES), la page rechargee (une page puis NO) ---------- */

/** Les reglages de la voix de chaque page (audio/voicefx.ts), et ce qu'en tire le hasard : [bas, haut]. */
const PAGE_VOICE_PARAMS: Readonly<Partial<Record<RytmPageId, readonly VoiceParam[]>>> = {
  trig: ['tune'],
  voice: ['level', 'tune', 'fine'],
  fltr: ['fcut', 'freso', 'ftype', 'tone', 'fatk', 'fdec', 'fenv'],
  env: ['atk', 'hold', 'decay', 'start', 'pan'],
  fx: ['dist', 'chorus', 'delay', 'reverb'],
};
const RANDOM_SPAN: Readonly<Partial<Record<VoiceParam, readonly [number, number]>>> = {
  level: [0.55, 0.95],
  tune: [-0.25, 0.25],
  fine: [-0.2, 0.2],
  fcut: [0.35, 1],
  freso: [0, 0.6],
  ftype: [0, 1],
  tone: [-0.4, 0.4],
  fatk: [0, 0.3],
  fdec: [0.2, 0.8],
  fenv: [-0.5, 0.5],
  atk: [0, 0.25],
  hold: [0, 0.5],
  decay: [0.3, 1],
  start: [0, 0.25],
  pan: [-0.4, 0.4],
  dist: [0, 0.4],
  chorus: [0, 0.4],
  delay: [0, 0.35],
  reverb: [0, 0.45],
};

/**
 * Une page au hasard (V.5.0, la touche de la page puis YES) : ses reglages de la voix choisie dans des bornes musicales
 * (RANDOM_SPAN), le son de la voix sur SRC ; SEND FX les FX de la machine, TEMPO le tempo et le SWING, le MIXER les
 * niveaux des huit voix. Une etape d'UNDO ; une scene armee les prend (comme un potard).
 */
export function randomPage(pg: RytmPageId): void {
  const inst = pattern.get().instrument;
  // MOD (V.5.1) : le LFO de l'onglet affiche (MOD 1/2 : LFO 1, 2/2 : LFO 2) de la voix choisie, une modulation qui s'entend
  if (pg === 'mod') {
    if (!inst) {
      lcdMessage.show(LCD_NO_VOICE);
      return;
    }
    undo.boundary('mm808', 'step');
    const n = curScreen() === 'mod2' ? 2 : 1;
    const pick = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (hi - lo + 1));
    const sign = (): number => (Math.random() < 0.5 ? -1 : 1);
    const set = (k: string, v: number): void => voiceFx.setLfo(inst, `l${n}${k}` as LfoParam, v);
    set('spd', sign() * pick(4, 32));
    set('mul', pick(0, 3));
    set('fad', 0);
    set('dst', pick(1, 5));
    set('wav', pick(0, 6));
    set('phs', 0);
    set('mod', pick(0, 4));
    set('dep', sign() * pick(12, 40));
    lcdMessage.show(`${inst} LFO${n} RANDOM`);
    return;
  }
  undo.boundary('mm808', 'step');
  if (pg === 'sendfx') {
    pattern.fx.set({ drive: rand(0, 0.35), chorus: rand(0, 0.35), delay: rand(0, 0.35), reverb: rand(0, 0.45), bits: Math.random() < 0.3 ? rand(0, 0.3) : 0, comp: rand(0, 0.5) });
    lcdMessage.show('SEND FX RANDOM');
    return;
  }
  if (pg === 'tempo') {
    anyDial('tempo', Math.round(rand(110, 140)));
    pattern.fx.set({ swing: rand(0, 0.35) });
    lcdMessage.show(`TEMPO RANDOM ${Math.round(pattern.get().bpm)} BPM`);
    return;
  }
  if (pg === 'mixer') {
    for (const v of INSTRUMENTS) mixerSet(v, rand(0.55, 0.95));
    lcdMessage.show('MIXER RANDOM');
    return;
  }
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  for (const p of PAGE_VOICE_PARAMS[pg] ?? []) {
    const [lo, hi] = RANDOM_SPAN[p] ?? [0.2, 0.8];
    const v = p === 'ftype' ? [0, 0.5, 1][Math.floor(Math.random() * 3)] : rand(lo, hi);
    const id = `rytm:voice:${inst}:${p}`;
    const bip = p === 'tone' || p === 'tune' || p === 'pan' || p === 'fine' || p === 'fenv';
    if (!sceneTakeId(id, bip ? (v + 1) / 2 : v)) setVoiceFx(inst, p, v);
  }
  if (pg === 'voice') randomVoiceSounds([inst]);
  lcdMessage.show(`${inst} ${pageLabel(pg)} RANDOM`);
}

/**
 * Une page rechargee du point de sauvegarde (V.5.0, la touche de la page puis NO) : ses reglages de la voix choisie ; SEND
 * FX les FX de la machine et STRETCH, TEMPO le tempo et le SWING, le MIXER les niveaux. Le son de SRC et les potards de
 * machine de SRC SYNTH reviennent avec FUNC + NO (tout le point). Une etape d'UNDO.
 */
export function reloadPage(pg: RytmPageId): void {
  if (!st.savePoint) {
    lcdMessage.show('NOTHING SAVED: FUNC + YES FIRST', 1800);
    return;
  }
  if (st.savePoint.slot !== patterns.get().cur) {
    lcdMessage.show(`SAVED ON ${slotName(st.savePoint.slot)}`, 1800);
    return;
  }
  const d = st.savePoint.data as { voices?: Partial<Record<Inst, Partial<VoiceFx>>>; fx?: Record<string, number>; stretch?: number; bpm?: number };
  undo.boundary('mm808', 'step');
  if (pg === 'sendfx') {
    if (d.fx) pattern.fx.set({ ...d.fx });
    setStretch(typeof d.stretch === 'number' ? d.stretch : 0);
  } else if (pg === 'tempo') {
    if (typeof d.bpm === 'number') pattern.setBpm(d.bpm);
    if (d.fx && typeof d.fx.swing === 'number') pattern.fx.set({ swing: d.fx.swing });
  } else if (pg === 'mixer') {
    for (const v of INSTRUMENTS) {
      const l = d.voices?.[v]?.level;
      if (typeof l === 'number') voiceFx.set(v, 'level', l);
    }
  } else {
    const inst = pattern.get().instrument;
    if (!inst) {
      lcdMessage.show(LCD_NO_VOICE);
      return;
    }
    const saved = d.voices?.[inst];
    for (const p of PAGE_VOICE_PARAMS[pg] ?? []) voiceFx.set(inst, p, typeof saved?.[p] === 'number' ? (saved[p] as number) : VOICE_FX_DEFAULT[p]);
    // V.5.1 : MOD, les deux LFO de la voix ; TRIG, ses reglages de trig par defaut (ceux du pattern au point de sauvegarde)
    if (pg === 'mod') {
      for (const p of LFO_PARAMS) {
        const v = (saved as Partial<Record<string, number>> | undefined)?.[p];
        voiceFx.setLfo(inst, p, typeof v === 'number' ? v : lfoDefault(p));
      }
    }
    if (pg === 'trig') {
      const row = (st.savePoint.data as { trigs?: TrigSet }).trigs?.[inst];
      for (const p of TRIG_PARAMS) pattern.setTrig(inst, p, typeof row?.[p] === 'number' ? (row[p] as number) : TRIG_DEF[p]);
    }
  }
  lcdMessage.show(`${pageLabel(pg)} RELOADED FROM ${slotName(st.savePoint.slot)}`);
}
