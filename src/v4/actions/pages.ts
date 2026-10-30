/**
 * Les actions du MM-RYTM : les touches de page (rytmPageKey, les FX en detail, les onglets, HOME, RANDOM et RELOAD d'une page). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/pages.ts.
 */

import { resume } from '../audio/drums';
import { pattern } from '../audio/pattern';
import type { Stage } from '../scene/renderer';
import { lcdMessage } from '../state/lcdMessage';
import { editor } from '../state/editor';
import { presetMode } from '../state/presetMode';
import { rytmPage } from '../state/rytmPage';
import { rytmLock } from '../state/rytmLock';
import { SCREEN_PAGE, SCREEN_TITLE, fxDetailBase, fxDetailOf, fxVoiceDetailOf, isFxPage, isFxVoiceDetail, isRytmPage, pageOfAlias, screensOf, tabWord, type FxPageId, type RytmPageId, type RytmScreenId } from '../rytm/pages';
import { DT_FACE } from '../theme';
import { two } from './shared';
import { leaveRytmOverlay, pageKeyBody } from './internal/pages';
import { dtPageKeyAfter, dtPageKeyFirst, PAGE_BTN } from './internal/face';
import { presetSoftKey } from './internal/presets';
import { curScreen, pageTarget } from './kit';
import { soundBrowserOpen } from './browser';

/**
 * Une touche de page du MM-RYTM (la face, le Dock, le MIDI, 2026-10-08) :
 * sa page s'affiche, sur son onglet retenu ; la touche deja allumee pressee
 * encore (2026-10-09) : l'onglet suivant (VOICE : MAIN puis SYNTH ; FX : VOICE
 * puis GLOBAL), ou HOME pour une page sans onglet (FLTR, ENV ; puis PAGE).
 * Sous EDIT ou les presets, elle les referme et montre sa page. En P-LOCK,
 * jamais HOME (l'ecran reste aux blocs). La touche s'enfonce.
 */
export function rytmPageKey(id: RytmPageId, stage: Stage | null = null): void {
  // Une page que cet appareil n'a pas (V.5.0 : MOD, TRIG, TEMPO, le MIXER au telephone, par le MIDI) : rien
  if (!isRytmPage(id)) return;
  // Le mode presets du desktop (2026-10-27) : des touches de la rangee sont ses touches de l'ecran (SRC LOAD, FLTR SAVE, AMP
  // NAME, FX DEL ; PTN EXIT, editToggle)
  const btn = PAGE_BTN[id];
  if (btn && presetSoftKey(btn, () => stage?.pressPageKey(id))) return;
  // V.5.0 au desktop : FUNC + la touche, sa fonction orange ; MOD sur le MIXER, l'onglet suivant
  if (DT_FACE && dtPageKeyFirst(id, stage)) return;
  pageKeyBody(id, stage);
  if (DT_FACE && btn) dtPageKeyAfter(id);
}

/**
 * La page d'un FX que tient le bloc k de l'ecran affiche (2026-10-10) : sur
 * GLOBAL FX (DIST CHORUS DELAY REVERB BIT COMP) sa page GLOBAL ; sur VOICE FX
 * (DIST CHORUS DELAY REVERB de la voix) sa page sous la voix (fxvdelay) ; null
 * ailleurs, pour STRETCH et SWING, sur la page d'un FX elle-meme.
 */
export function pageFxDetail(k: number): FxPageId | null {
  const screen = curScreen();
  if (screen !== 'fxg' && screen !== 'fxv') return null;
  const t = pageTarget(k);
  if (!t) return null;
  return screen === 'fxg' ? fxDetailOf(t) : fxVoiceDetailOf(t);
}

/**
 * La page d'un FX (2026-10-10, Mika : "quand je touche a un FX, par exemple
 * DELAY, dans l'ecran, ca doit afficher les configurations que je peux avoir
 * pour DELAY ; pareil pour tous les autres") : une tape sur son bloc de GLOBAL
 * FX (ui/Hotspots.tsx), Entree sur son jumeau, le MIDI rytm:screen:fxdelay ;
 * sous la voix (fxvdelay, Mika : "je veux avoir le choix entre GLOBAL ou
 * VOICE") une tape sur son bloc de VOICE FX, l'onglet de la voix dans
 * l'en-tete, rytm:screen:fxvdelay ; l'onglet GLOBAL y ramene la page de la
 * machine. Le grand bloc cerne un instant, le message dit la page et le retour.
 */
export function rytmFxOpen(p: FxPageId): void {
  const inst = pattern.get().instrument;
  rytmPage.openFx(fxDetailBase(p), inst, isFxVoiceDetail(p));
  rytmPage.echo(0, inst);
  lcdMessage.show(`${tabWord(curScreen(), inst)} · FX: BACK`, 1400);
}

/**
 * Retour a l'onglet de FX du mode (GLOBAL FX ; VOICE FX sous la voix) depuis la
 * page d'un FX (Echap ; la touche FX passe par rytmPage). Seulement quand on la
 * voit : la vue PAGE, ni EDIT ni les presets par-dessus. true si elle s'est refermee.
 */
export function rytmFxClose(): boolean {
  const s = rytmPage.get();
  if (!s.detail || s.view !== 'page' || editor.get() === 'mm808' || presetMode.on('mm808')) return false;
  rytmPage.closeFx();
  lcdMessage.show(SCREEN_TITLE[curScreen()], 900);
  return true;
}

/**
 * Un onglet de l'en-tete de l'ecran touche (2026-10-09) : la page s'affiche sur
 * lui ; la page d'un FX (2026-10-10) s'ouvre, GLOBAL ou sous la voix (ses deux
 * onglets passent de l'une a l'autre).
 */
export function rytmScreenTab(screen: RytmScreenId): void {
  resume();
  if (isFxPage(screen)) {
    rytmFxOpen(screen);
    return;
  }
  const inst = pattern.get().instrument;
  const page = SCREEN_PAGE[screen];
  // V.5.0 : TRIG, MOD, TEMPO et le MIXER sont des pages du desktop (le telephone ne les a pas)
  if (!isRytmPage(page)) return;
  const i = screensOf(page, inst).indexOf(screen);
  if (i < 0) return;
  rytmPage.setTab(page, i, inst);
  lcdMessage.show(SCREEN_TITLE[screen], 900);
}

/** rytm:page en MIDI : la page (un nom d'avant : la sienne d'aujourd'hui), en vue PAGE ; sous EDIT ou les presets, comme une touche. */
export function rytmShowPage(id: RytmPageId | string): void {
  const page = pageOfAlias(id);
  if (!page) return;
  const left = leaveRytmOverlay();
  // La page d'un FX ouverte (2026-10-10) : rytm:page:fx ramene GLOBAL FX, et le dit
  const same = page === rytmPage.get().page && rytmPage.get().view === 'page' && !rytmPage.get().detail;
  rytmPage.setPage(page);
  if (left || !same) lcdMessage.show(`${SCREEN_TITLE[curScreen()]} PAGE`);
}

/**
 * Le menu de la voix sous HOME (2026-10-18, Mika : "je veux voir le menu dans l'ecran pour modifier le voice" ; scene/screen.ts
 * HOME_MENU) : SOUND ouvre la liste des sons de la voix ; VOICE FLTR ENV FX passent a leur page, en vue PAGE (la touche de la
 * page s'enfonce, comme sous le doigt ; la touche allumee pressee encore ramene HOME).
 */
export function rytmMenu(id: string, stage: Stage | null = null): void {
  resume();
  if (id === 'sound') {
    soundBrowserOpen();
    return;
  }
  if (!isRytmPage(id)) return;
  stage?.pressPageKey(id);
  rytmShowPage(id);
}

/** rytm:home en MIDI (H au clavier, hors EDIT) : HOME, ou la vue PAGE ; sous EDIT ou les presets, les referme sur HOME. */
export function rytmHome(): void {
  if (leaveRytmOverlay()) {
    rytmPage.setView('home');
    return;
  }
  // En LOCK (revue de R2) : l'ecran reste aux blocs (HOME ne montre pas les verrous)
  const lk = rytmLock.get().step;
  if (lk >= 0) {
    lcdMessage.show(`P-LOCK ${two(lk + 1)}: ESC FIRST, THEN HOME`);
    return;
  }
  rytmPage.toggleView();
}
