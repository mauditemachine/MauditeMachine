/**
 * SOUNDS et SAMPLES de la face DT2 (V.6.0, lane B5, 2026-11-01, cahier dt2 1.3 et 3.2, la decision Q4 de Mika : la touche
 * SAMPLING devient SOUNDS) :
 * - SOUNDS (la touche) : la liste des sons de la piste active (le navigateur des sons d'aujourd'hui, actions/browser.ts),
 *   en plein ecran : UP / DOWN ou LEVEL/DATA le curseur (FUNC : une page), YES choisit (+ LOAD A FILE... : tes fichiers ;
 *   une ligne armee REMOVE? : elle part), LEFT / RIGHT le son d'avant ou d'apres, NO ferme ;
 * - SAMPLES (FUNC + SOUNDS) : tes fichiers. IMPORT FILES... ouvre le choix des fichiers (ils vont dans la categorie du son
 *   de la piste) ; YES sur un de tes samples l'arme (REMOVE?), YES encore le retire ; NO desarme, puis ferme.
 * Aucune ecoute ne part d'un deplacement du curseur ; choisir un son le fait entendre comme aujourd'hui.
 */

import { pattern } from '../../../audio/pattern';
import { userSamples } from '../../../audio/usersamples';
import { samplesChanged } from '../../../audio/samples';
import { soundBrowserClose, soundBrowserCursor, soundBrowserOpen, soundBrowserPick, soundBrowserStep, soundBrowserView, soundFilesPick } from '../../../actions';
import { lcdMessage } from '../../../state/lcdMessage';
import { lcdSamples } from '../../../state/lcdSamples';
import type { Screen } from '../core';
import { HALF } from '../consts';
import { registerScreenMenu } from './registry';
import { acting, LIST_ROWS, paintHint, paintList, scrollTop, stepCursor, type MenuRow } from './frame';
import { menuChanged } from './open';

/* ---------------- SOUNDS ---------------- */

let soundsBody = '';

function paintSounds(screen: Screen): number {
  const v = soundBrowserView();
  if (!v) {
    screen.text(pattern.get().instrument ? 'NO SOUNDS' : 'PICK A TRACK: TRK + TRIG', 160, 100, 10, HALF, 600, 'center', 0.4);
    soundsBody = '';
    return 0;
  }
  screen.text(v.rank, 312, 34, 7.5, HALF, 700, 'right', 0.5);
  const rows: MenuRow[] = v.rows.map((r, i) => ({ label: `${i === v.arm ? 'REMOVE? ' : ''}${r.label}`, value: i === v.cur ? 'NOW' : r.tag }));
  const top = scrollTop(v.top, v.cursor, rows.length, 8);
  soundsBody = `${v.title}|${paintList(screen, rows, v.cursor, top, { x0: 4, x1: 316, y0: 41, y1: 170 })}`;
  paintHint(screen, 'UP/DOWN: SOUND   YES: CHOOSE   L/R: PREV NEXT   NO: EXIT');
  return 0;
}

registerScreenMenu({
  id: 'sounds',
  owner: 'B5',
  title: () => {
    const v = soundBrowserView();
    return v ? `SOUNDS  ${v.inst}` : 'SOUNDS';
  },
  paint: (screen) => paintSounds(screen),
  onOpen() {
    if (!lcdSamples.isOpen()) soundBrowserOpen(true);
  },
  onClose() {
    if (lcdSamples.isOpen()) soundBrowserClose();
  },
  info: () => soundsBody,
  onInput(i) {
    if (!acting(i)) return true;
    const v = soundBrowserView();
    if (i.kind === 'no') {
      soundBrowserClose();
      return false;
    }
    if (!v) return i.kind !== 'yes' ? true : (soundBrowserOpen(true), true);
    if (i.kind === 'up' || i.kind === 'down') soundBrowserCursor((i.kind === 'up' ? -1 : 1) * (i.func ? Math.max(1, v.visible - 1) : 1));
    else if (i.kind === 'data') soundBrowserCursor(Math.round(i.delta ?? 0));
    else if (i.kind === 'yes') soundBrowserPick(v.cursor);
    else if (i.kind === 'left' || i.kind === 'right') soundBrowserStep(i.kind === 'left' ? -1 : 1);
    menuChanged();
    return true;
  },
});

/* ---------------- SAMPLES (FUNC + SOUNDS) ---------------- */

let cursor = 0;
let top = 0;
let arm = -1;
let samplesBody = '';

/** Les lignes : IMPORT FILES..., puis tes samples (leur categorie a droite). */
function sampleRows(): MenuRow[] {
  const mine = userSamples.all();
  return [{ label: 'IMPORT FILES', sub: true }, ...mine.map((s, i) => ({ label: `${i + 1 === arm ? 'REMOVE? ' : ''}${s.label}`, value: s.family.toUpperCase() }))];
}

function paintSamples(screen: Screen): number {
  const rows = sampleRows();
  cursor = Math.min(cursor, rows.length - 1);
  top = scrollTop(top, cursor, rows.length, LIST_ROWS - 1);
  screen.text(`${rows.length - 1} FILES`, 312, 34, 7.5, HALF, 700, 'right', 0.5);
  samplesBody = paintList(screen, rows, cursor, top, { x0: 4, x1: 316, y0: 41, y1: 170 });
  paintHint(screen, arm >= 0 ? 'YES AGAIN: REMOVE   NO: KEEP' : 'YES: IMPORT OR REMOVE   NO: EXIT');
  return 0;
}

registerScreenMenu({
  id: 'samples',
  owner: 'B5',
  title: () => 'SAMPLES  YOUR FILES',
  paint: (screen) => paintSamples(screen),
  onOpen() {
    cursor = 0;
    top = 0;
    arm = -1;
  },
  info: () => samplesBody,
  onInput(i) {
    if (!acting(i)) return true;
    const rows = sampleRows();
    if (i.kind === 'no') {
      if (arm >= 0) {
        arm = -1;
        menuChanged();
        return true;
      }
      return false;
    }
    if (i.kind === 'up' || i.kind === 'down' || i.kind === 'data') {
      const dir = i.kind === 'up' ? -1 : i.kind === 'down' ? 1 : Math.round(i.delta ?? 0);
      cursor = stepCursor(cursor, rows.length, dir, i.func && i.kind !== 'data', LIST_ROWS - 1);
      arm = -1;
    } else if (i.kind === 'yes') {
      if (cursor === 0) soundFilesPick(pattern.get().instrument, false);
      else if (arm === cursor) {
        const s = userSamples.all()[cursor - 1];
        arm = -1;
        if (s)
          void userSamples.remove(s.key).then((ok) => {
            lcdMessage.show(ok ? `${s.label} REMOVED` : 'NOT REMOVED', 1400);
            menuChanged();
          });
      } else {
        arm = cursor;
        lcdMessage.show('REMOVE? YES AGAIN', 1400);
      }
    }
    menuChanged();
    return true;
  },
});

// Un fichier importe ou retire (par ici ou par la liste des sons) : la liste se redessine
samplesChanged.subscribe(() => menuChanged());
