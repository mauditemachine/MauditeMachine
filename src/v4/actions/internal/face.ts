/**
 * Les actions du MM-RYTM, face : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { resume } from '../../audio/drums';
import { INSTRUMENTS, pattern } from '../../audio/pattern';
import type { Stage } from '../../scene/renderer';
import { lcdMessage } from '../../state/lcdMessage';
import { editor } from '../../state/editor';
import { presetMode } from '../../state/presetMode';
import type { FpButtonId } from '../../rytm/faceplate';
import { undo } from '../../state/undo';
import { func } from '../../state/func';
import { dtFace } from '../../state/dtFace';
import { rytmPage } from '../../state/rytmPage';
import { type RytmPageId } from '../../rytm/pages';
import { voices } from '../../state/voices';
import { DT_FACE, DT_GESTURE, LCD_NO_VOICE } from '../../theme';
import { st } from '../state';
import { TRK_HINT_MS } from './tracks';
import { pageKeyBody } from './pages';
import { soundBrowserOpen } from '../browser';
import { presetTurns } from '../presets';

export const FUNC_LOCKED = 'FUNC LOCKED: + KEYS · NO: OFF';
export const funcSay = (text: string): void => {
  st.funcLcd = text;
  lcdMessage.show(text, TRK_HINT_MS);
};

/**
 * La touche qui lit FUNC la consomme (V.5.0) : true quand FUNC etait engagee (tenue : elle reste ; gardee pour une touche :
 * relachee ; verrouillee : elle reste). Le telephone n'a pas de FUNC.
 */
export function funcTake(): boolean {
  if (!DT_FACE || !func.engaged()) return false;
  func.use();
  return true;
}

/** Les pages de la rangee et leur touche (les touches de l'ecran du mode presets, rytm/presetKeys.ts). */
export const PAGE_BTN: Readonly<Partial<Record<RytmPageId, FpButtonId>>> = { trig: 'trig', voice: 'src', fltr: 'fltr', env: 'amp', fx: 'fx', mod: 'mod' };

/**
 * Une touche de page du desktop (la face, son jumeau, le MIDI rytm:page:<page>) avant le chemin de toujours : true quand
 * elle est prise (FUNC + la touche : sa fonction orange ; MOD sur le MIXER : l'onglet suivant).
 */
export function dtPageKeyFirst(id: RytmPageId, stage: Stage | null): boolean {
  if (!funcTake()) {
    // MOD rappuye sur le MIXER (FUNC + MOD) : l'onglet suivant, LEVELS puis MASTER
    if (id === 'mod' && rytmPage.get().page === 'mixer' && rytmPage.get().view === 'page' && !presetMode.on('mm808') && editor.get() !== 'mm808') {
      stage?.pressFaceKey('pkey-mod');
      funcPage('mixer');
      return true;
    }
    return false;
  }
  resume();
  st.pageArm = null;
  const key = PAGE_BTN[id] ? `pkey-${id}` : null;
  if (key) stage?.pressFaceKey(key);
  switch (id) {
    case 'trig':
      funcPage('tempo');
      return true;
    case 'voice':
      // SOUNDS : la liste des sons de la voix (le navigateur d'aujourd'hui)
      if (!pattern.get().instrument) lcdMessage.show(LCD_NO_VOICE);
      else soundBrowserOpen();
      return true;
    case 'fltr':
      lcdMessage.show('SETUP (TRACK LENGTH): V.5.2', 1800);
      return true;
    case 'env':
      lcdMessage.show('EUCLID: V.5.3', 1800);
      return true;
    case 'fx':
      funcPage('sendfx');
      return true;
    case 'mod':
      funcPage('mixer');
      return true;
    default:
      return false;
  }
}

/** Une page de FUNC (TEMPO, SEND FX, MIXER) : comme une touche de page (sa page, et rappuyee l'onglet suivant ou HOME). */
function funcPage(p: RytmPageId): void {
  pageKeyBody(p, null);
  // SEND FX et le MIXER s'arment pour YES (au hasard) et NO (recharges), comme une touche de page ; TEMPO non : YES y est le TAP
  if ((p === 'sendfx' || p === 'mixer') && !presetTurns()) st.pageArm = { page: p, until: performance.now() + DT_GESTURE.pageArmMs };
}

/** Apres le chemin de toujours (V.5.0) : la page reste armee pour YES et NO. */
export function dtPageKeyAfter(id: RytmPageId): void {
  st.pageArm = presetTurns() ? null : { page: id, until: performance.now() + DT_GESTURE.pageArmMs };
}

/** NO tenue (NO + un pad efface la voix au fil de la tete de lecture) ; celles qui ont efface (leur lacher ne fait pas NO). */
export const noHolders = new Set<string>();
export const noUsed = new Set<string>();

/** Un pas tape en mode MUTE : 1 a 8 coupent leur voix ou la rendent (le jeu global ou celui du pattern). */
export function muteStep(i: number, stage: Stage | null): void {
  resume();
  stage?.pressStep(i);
  const inst = i >= 0 && i < INSTRUMENTS.length ? INSTRUMENTS[i] : null;
  if (!inst) {
    lcdMessage.show('MUTE: STEPS 1-8 ARE THE VOICES');
    return;
  }
  if (dtFace.mute() === 'pattern') {
    undo.boundary('mm808', 'step');
    pattern.togglePmute(inst);
    lcdMessage.show(`${inst} ${pattern.pmuted(inst) ? 'MUTED IN THE PATTERN' : 'BACK IN THE PATTERN'}`);
    return;
  }
  voices.toggleMute(inst);
  lcdMessage.show(`${inst} ${voices.isMuted(inst) ? 'MUTED' : 'BACK'}`);
}
