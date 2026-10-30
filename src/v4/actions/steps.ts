/**
 * Les actions du MM-RYTM : les pas (stepToggle, stepClear, la velocite d'un pas, les pas en FUNC, en P-LOCK et en REC). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/steps.ts.
 */

import { resume, trigger } from '../audio/drums';
import { TAP_VEL_DEFAULT } from '../state/rytmPage';
import { isLockTrig } from '../audio/locks';
import { INSTRUMENTS, VEL_GAIN, VEL_MAX, VEL_NAMES, pattern, velocity } from '../audio/pattern';
import type { Stage } from '../scene/renderer';
import { lcdMessage } from '../state/lcdMessage';
import { editor } from '../state/editor';
import { dtFace } from '../state/dtFace';
import { rytmPage } from '../state/rytmPage';
import { rytmLock } from '../state/rytmLock';
import { voices } from '../state/voices';
import { DT_FACE, DT_GESTURE, LCD_NO_VOICE, POT_UI, type Inst } from '../theme';
import { gesture, two } from './shared';
import { selectVoice } from './internal/tracks';
import { recHoldHint } from './internal/steps';
import { touchPage } from './internal/dials';
import { funcTake, muteStep } from './internal/face';
import { heardNow, liveRunning, liveSelect, liveVel } from './internal/live';
import { padHit, trkStep } from './tracks';
import { patternHold, patternTap } from './patterns';
import { rytmLockTap } from './locks';
import { muteView } from './face';
import { liveHit, liveOn } from './live';

/**
 * Pas i (0 a 15) pour l'instrument selectionne ; false sans selection
 * (spec 7.2 : il faut d'abord taper un pad). Chaque appui passe au cran
 * suivant : vide, fort, moyen, doux, vide (2026-10-01). Persiste par
 * pattern.ts ; la touche s'enfonce (stage.pressStep) ; l'ecran dira
 * STEP 07 BD HIGH / MID / LOW / OFF, ou TAP A PAD FIRST (PICK A VOICE FIRST
 * au desktop depuis la face V.4.0 sans pads, 2026-10-27 : theme.ts LCD_NO_VOICE).
 */
export function stepToggle(i: number, stage: Stage | null = null, dock = false, ts = -1): boolean {
  // FUNC + un pas (V.5.0, le desktop) : le mute rapide de sa voix, avant tout le reste. Le Dock (dock : une fenetre de
  // desktop etroite, sans FUNC ni REC a l'ecran) ecrit toujours comme avant
  if (DT_FACE && !dock && funcTake()) {
    funcStep(i, stage);
    return true;
  }
  // TRK engagee (2026-10-27) : le pas choisit sa voix, avant EDIT, le P-LOCK et la velocite
  if (trkStep(i, stage)) return true;
  // EDIT (2026-10-05) : les steps sont les seize patterns
  if (editor.get() === 'mm808') {
    patternTap(i, stage);
    return true;
  }
  // Le mode MUTE (V.5.0, FUNC + TRK) : les pas 1 a 8 sont les voix
  if (muteView() && !dock) {
    muteStep(i, stage);
    return true;
  }
  // LIVE REC (V.5.3) : les pas 1 a 8 jouent leur voix ; en lecture, la frappe s'ecrit (ts : l'heure de l'appui, ui/Hotspots.tsx
  // les fait partir au pointerdown, la revue de D3b R3)
  if (DT_FACE && !dock && dtFace.live() && rytmLock.get().step < 0) {
    stepPlay(i, stage, ts);
    return true;
  }
  // Hors REC au desktop (V.5.0) : le pas joue sa voix et la choisit, rien ne s'ecrit (le P-LOCK en cours garde sa tape)
  if (DT_FACE && !dock && !dtFace.rec() && rytmLock.get().step < 0) {
    stepPlay(i, stage);
    return true;
  }
  resume();
  stage?.pressStep(i);
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return false;
  }
  // En LOCK (2026-10-08) : une tape sur le pas en LOCK en sort, sur un autre y deplace le LOCK (le pas ne change pas)
  if (rytmLock.get().step >= 0) {
    rytmLockTap(i);
    return true;
  }
  // Un pas vide recoit la velocite des nouveaux pas de la voix (2026-10-09 : HIGH au depart ; sans bloc depuis le 2026-10-10) ; un pas pose
  // passe au cran d'en dessous comme avant (MID, LOW, vide). REC au desktop (V.5.0, comme la Digitakt) : une tape pose ou
  // retire le pas, sans le cycle (la velocite des nouveaux pas : HIGH, ou celle de VEL sur TRIG)
  // Un lock trig (V.5.1) : une tape l'enleve, avec ses verrous (comme la Digitakt), il ne devient pas un coup
  if (DT_FACE && velocity(pattern.get().steps, inst, i) === 0 && isLockTrig(pattern.get().locks, inst, i)) {
    pattern.clearLock(inst, [i]);
    rytmPage.select(i);
    lcdMessage.show(`STEP ${two(i + 1)} ${inst} LOCK TRIG OFF`);
    return true;
  }
  if (velocity(pattern.get().steps, inst, i) === 0) pattern.set(inst, i, rytmPage.tapVel(inst));
  else if (DT_FACE) pattern.clearStep(inst, i);
  else pattern.toggle(inst, i);
  rytmPage.select(i);
  // Le geste des verrous se dit a chaque pas pose (2026-10-08, Mika : "je ne comprends toujours pas comment mettre des parameter locks")
  lcdMessage.show(`${stepLine(inst, i)}  HOLD: P-LOCK`);
  return true;
}

/** Ligne d'ecran d'un pas : STEP 07 OH HIGH / MID / LOW / OFF. */
function stepLine(inst: Inst, i: number): string {
  return `STEP ${two(i + 1)} ${inst} ${VEL_NAMES[velocity(pattern.get().steps, inst, i)]}`;
}

/**
 * Appui long sur un pas (revision 4, 400 ms) : le pas de l'instrument
 * selectionne se vide. false sans selection.
 */
export function stepClear(i: number, stage: Stage | null = null): boolean {
  // Hors REC au desktop (V.5.0) : Suppr sur un pas ne l'efface pas
  if (!stepWrites()) {
    lcdMessage.show('● REC TO WRITE STEPS', 1400);
    return false;
  }
  resume();
  stage?.pressStep(i);
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return false;
  }
  // Un lock trig (V.5.1, la revue de D2, U4) : Suppr l'enleve avec ses verrous, comme une tape (l'ecran disait OFF et le
  // laissait)
  if (velocity(pattern.get().steps, inst, i) === 0 && isLockTrig(pattern.get().locks, inst, i)) {
    pattern.clearLock(inst, [i]);
    rytmPage.select(i);
    lcdMessage.show(`STEP ${two(i + 1)} ${inst} LOCK TRIG OFF`);
    return true;
  }
  pattern.clearStep(inst, i);
  rytmPage.select(i);
  lcdMessage.show(stepLine(inst, i));
  return true;
}

/**
 * La velocite d'un pas, appui tenu puis glisse (2026-10-05, Mika : "sur les
 * steps, quand je clique et que je reste appuye, je peux changer la
 * velocite") : de 1 a 9 ; un pas vide se remplit ; l'ecran la dit. false
 * sans voix choisie.
 */
export function stepVelocity(i: number, v: number): boolean {
  if (editor.get() === 'mm808') return false;
  // V.5.0 : hors REC au desktop, et dans le mode MUTE, un pas glisse ne change rien ; en LIVE REC non plus (V.5.3, la revue
  // de D3b R1 : un pas y est un pad)
  if (!stepWrites() || muteView() || liveOn()) return false;
  resume();
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return false;
  }
  const n = Math.max(1, Math.min(VEL_MAX, Math.round(v)));
  if (velocity(pattern.get().steps, inst, i) !== n) pattern.set(inst, i, n);
  // La vue PAGE (2026-10-08) : TRIG en coup d'oeil ; plus de bloc VEL depuis le 2026-10-10 (fusionne dans VOL) :
  // touchPage ne trouve rien a cerner, l'ecran dit la velocite du pas
  rytmPage.select(i);
  touchPage('step:vel', inst);
  lcdMessage.show(stepLine(inst, i), POT_UI.readoutMs, true);
  return true;
}

/** La velocite du pas i de la voix choisie (0 : vide, ou pas de voix). */
export function stepVelocityOf(i: number): number {
  const inst = pattern.get().instrument;
  return inst ? velocity(pattern.get().steps, inst, i) : 0;
}

/** L'appui tenu sur un pas, sans glisser encore : l'ecran dit sa velocite et comment la changer. */
export function stepHoldHint(i: number): void {
  if (editor.get() === 'mm808') {
    patternHold(i);
    return;
  }
  // V.5.0 : hors REC au desktop, la tenue ne met pas de P-LOCK ; l'ecran le dit une fois
  if (!stepWrites()) {
    recHoldHint();
    return;
  }
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  rytmPage.select(i);
  lcdMessage.show(`${stepLine(inst, i)}: DRAG`, POT_UI.readoutMs * 2, true);
}
/** L'aide des pas 9 a 16 hors REC : au plus une fois toutes les DT_GESTURE.hintMs. */
let recHintAt = -Infinity;

/** FUNC + un pas (V.5.0) : 1 a 8, le mute rapide de leur voix (le jeu global) ; 13 a 16, les pages a venir. En REC (V.5.1) : le lock trig. */
function funcStep(i: number, stage: Stage | null): void {
  resume();
  stage?.pressStep(i);
  // En REC (V.5.1) : le lock trig de la voix choisie ; hors REC, le mute rapide de D1
  if (dtFace.rec() && editor.get() !== 'mm808' && !muteView()) {
    lockTrigStep(i);
    return;
  }
  const inst = i >= 0 && i < INSTRUMENTS.length ? INSTRUMENTS[i] : null;
  if (inst) {
    voices.toggleMute(inst);
    lcdMessage.show(`${inst} ${voices.isMuted(inst) ? 'MUTED' : 'BACK'}`);
    return;
  }
  if (i >= 12) lcdMessage.show('PAGES 1-4: V.5.2', 1600);
}

/**
 * FUNC + un pas en REC (V.5.1, le lock trig de la Digitakt) : sur un pas vide, un lock trig (jaune, sans note : ses verrous
 * vont au coup de la voix qui sonne encore) ; sur un lock trig, il s'en va avec ses verrous ; sur un pas qui joue, il devient
 * un lock trig (ses verrous restent). Tenir le pas puis tourner un potard y pose ses verrous (le P-LOCK de toujours).
 */
function lockTrigStep(i: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const p = pattern.get();
  const vel = velocity(p.steps, inst, i);
  if (vel === 0 && isLockTrig(p.locks, inst, i)) {
    pattern.clearLock(inst, [i]);
    lcdMessage.show(`STEP ${two(i + 1)} ${inst} LOCK TRIG OFF`);
    return;
  }
  if (vel > 0) pattern.set(inst, i, 0);
  pattern.setLock(inst, [i], 'ltrg', 1);
  rytmPage.select(i);
  lcdMessage.show(vel > 0 ? `STEP ${two(i + 1)} ${inst} NOW A LOCK TRIG` : `STEP ${two(i + 1)} ${inst} LOCK TRIG: HOLD + KNOB`, 1800);
}

/**
 * Un pas hors REC au desktop (V.5.0, TRK SELECT NORMAL de la Digitakt II) : 1 a 8, sa voix joue (le chemin d'un pad, a la
 * velocite HIGH, meme en lecture) et devient la voix choisie ; rien ne s'ecrit. 9 a 16 : rien ne joue, l'ecran dit de
 * passer en REC (au plus une fois toutes les DT_GESTURE.hintMs).
 */
function stepPlay(i: number, stage: Stage | null, ts = -1): void {
  gesture();
  stage?.pressStep(i);
  const inst = i >= 0 && i < INSTRUMENTS.length ? INSTRUMENTS[i] : null;
  if (!inst) {
    const now = performance.now();
    if (now - recHintAt >= DT_GESTURE.hintMs) {
      recHintAt = now;
      lcdMessage.show(liveOn() ? 'LIVE REC: STEPS 1-8 PLAY THE VOICES' : '● REC TO WRITE STEPS', 1400);
    }
    return;
  }
  // Les modes MUTE et SOLO d'avant (M et Maj + M au clavier, MIDI rytm:mute) : la voix touchee y bascule, comme un pad
  const v = voices.get();
  if (v.soloMode || v.muteMode) {
    padHit(inst, null);
    return;
  }
  const live = liveRunning();
  const n = live ? liveVel() : TAP_VEL_DEFAULT;
  // LIVE REC en lecture (V.5.3) : la frappe s'ecrit (une voix coupee aussi) a l'heure de l'appui ; un pas qui joue deja la
  // voix la joue seul (la revue de D3b R10)
  const r = live ? liveHit(inst, n, ts >= 0 ? (heardNow(ts) ?? undefined) : undefined) : null;
  if (r !== 'quiet' && !voices.isMuted(inst) && !pattern.pmuted(inst)) trigger(inst, undefined, false, undefined, VEL_GAIN[n] ?? 1);
  // Elle choisit sa voix (la revue de D3b R4 : le potard verrouille ensuite la voix frappee)
  if (r) {
    liveSelect(inst);
    return;
  }
  if (pattern.get().instrument !== inst) selectVoice(inst);
  else lcdMessage.show(dtFace.live() ? `${inst} · PLAY: LIVE REC` : `${inst} · ● REC TO WRITE STEPS`, 900);
}

/** Le P-LOCK et la velocite d'un pas sont-ils possibles (REC allume au desktop ; toujours au telephone) ? */
export const stepWrites = (): boolean => !DT_FACE || dtFace.rec();
