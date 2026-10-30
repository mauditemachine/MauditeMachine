/**
 * Les actions du MM-RYTM : le transport (runToggle, muteToggle, soloToggle, les modes tenus, setTempo, tapTempo). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/transport.ts.
 */

import { clock } from '../audio/clock';
import { resume } from '../audio/drums';
import { pattern } from '../audio/pattern';
import { sc } from '../audio/soundcloud';
import type { Stage } from '../scene/renderer';
import { lcdMessage } from '../state/lcdMessage';
import { voices } from '../state/voices';
import { LCD_MUTE_HINT, PORTRAIT } from '../theme';
import { gesture } from './shared';
import { coarsePointer } from './internal/transport';

/**
 * RUN/STOP ; renvoie l'etat de lecture. Le contexte vient du geste en
 * cours. Une piste SoundCloud qui joue passe d'abord en pause : une seule
 * source a la fois (spec decision 5).
 */
export function runToggle(stage: Stage | null = null): boolean {
  gesture();
  stage?.pressButton('run');
  if (!clock.running) sc.pauseForRun();
  return clock.toggle();
}

/**
 * MUTE (2026-10-03, Mika ; refait le 2026-10-07, puis le 2026-10-09, Mika :
 * "Dans RYTM quand on appuie deux fois sur MUTE on peut selectionner
 * plusieurs Voice pour les muter.. si une seule fois ca veut dire que c'est
 * juste un voice") : une machine a trois etats, sans fenetre de temps (deux
 * appuis, aussi lents qu'on veut) :
 * - OFF, MUTE : ONE (le temoin clignote, l'ecran dit MUTE: TAP A VOICE / MUTE
 *   AGAIN: SEVERAL) ; la voix touchee ensuite se coupe (ou revient) et le mode
 *   retombe a OFF ;
 * - ONE, MUTE encore : MULTI (le temoin fixe) ; chaque voix touchee se coupe
 *   ou revient, le mode reste, l'ecran liste les voix coupees ;
 * - MULTI, MUTE : OFF, les voix coupees le restent (comme une Elektron ; le
 *   temoin a peine allume tant qu'il y en a, leurs pads rouges a peine) ;
 * - MUTE tenu 600 ms (MODE_HOLD_MS, n'importe quel etat) : toutes les voix
 *   reviennent (ALL VOICES ON) ; Echap sort du mode (les voix coupees le
 *   restent) ; M au clavier (Maj + M : SOLO).
 * La liste des voix coupees et celle du solo sont independantes : armer SOLO
 * n'efface plus les mutes (le solo passe avant eux tant qu'il dure). Plus de
 * "voix puis MUTE" (le raccourci de 1.5 s du 2026-10-04 coupait la voix
 * touchee juste avant, pas celle qu'on touchait apres). Renvoie l'etat du
 * temoin (allume ou non).
 */
export function muteToggle(stage: Stage | null = null): boolean {
  resume();
  stage?.pressButton('mute');
  // 2026-10-10 (Mika : "quand je clique sur MUTE ca release tous les mutes que j'ai cliques") : MUTE rend toutes les
  // voix ; on coupe une voix au pad (clic droit, double tape : padMute). Plus de mode a armer.
  const v = voices.get();
  // La face V.4.0 du desktop (2026-10-27, la revue) n'a plus de pad a clic droit : MUTE y arme de nouveau la machine a
  // trois etats (modeTap, comme SOLO) tant qu'aucune voix n'est coupee, ou quand le mode est deja arme (ONE puis MULTI,
  // puis OFF, les voix coupees le restent) ; la voix vient au clavier (A S D F, Z X C V) ou au MIDI (rytm:pad:<voix>,
  // padHit). Des voix coupees hors du mode : MUTE les rend toutes, comme le 2026-10-10. Le telephone ne change pas.
  if (!PORTRAIT && (v.muteMode || !v.muted.length)) return modeTap('mute');
  if (v.muted.length || v.muteMode) {
    voices.release('mute');
    lcdMessage.show('ALL VOICES ON', MODE_MSG_MS);
  } else lcdMessage.show(coarsePointer() ? LCD_MUTE_HINT.touch : LCD_MUTE_HINT.mouse, MODE_MSG_MS);
  return false;
}

/** SOLO (2026-10-04 ; refait le 2026-10-07 et le 2026-10-09) : la meme machine a etats que MUTE. */
export function soloToggle(stage: Stage | null = null): boolean {
  resume();
  stage?.pressButton('solo');
  return modeTap('solo');
}

/** MUTE (SOLO) tenu au moins ce temps : toutes les voix reviennent (la face, le Dock, le clavier). */
export const MODE_HOLD_MS = 600;
/** Les messages des modes restent un peu plus que les autres ; l'ecran garde ensuite le mode et son aide (scene/screen.ts). */
const MODE_MSG_MS = 1200;

function modeTap(k: 'mute' | 'solo'): boolean {
  const v = voices.get();
  const word = k === 'mute' ? 'MUTE' : 'SOLO';
  const on = k === 'mute' ? v.muteMode : v.soloMode;
  const multi = k === 'mute' ? v.muteMulti : v.soloMulti;
  if (!on) {
    voices.arm(k, false);
    lcdMessage.show(`${word}: TAP A VOICE`, MODE_MSG_MS);
    return true;
  }
  if (!multi) {
    voices.arm(k, true);
    lcdMessage.show(`MULTI ${word}: TAP VOICES`, MODE_MSG_MS);
    return true;
  }
  voices.disarm(k);
  const list = k === 'mute' ? voices.get().muted : voices.get().solo;
  lcdMessage.show(list.length ? `${word} OFF  ${list.join(' ')} ${k === 'mute' ? 'STAY MUTED' : 'STAY SOLO'}` : `${word} OFF`, MODE_MSG_MS);
  return list.length > 0;
}

/** MUTE (SOLO) tenu (2026-10-09) : le mode s'eteint et toutes ses voix reviennent ; l'ecran le dit. */
export function modeHold(k: 'mute' | 'solo'): void {
  resume();
  voices.release(k);
  lcdMessage.show(k === 'mute' ? 'ALL VOICES ON' : 'SOLO OFF: ALL VOICES', MODE_MSG_MS);
}

/** TEMPO : borne et arrondi a 100..150 ; l'horloge le prend au prochain pas. */
export function setTempo(bpm: number): void {
  resume();
  pattern.setBpm(bpm);
}
