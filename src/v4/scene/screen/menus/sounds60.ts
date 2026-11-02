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

import { userSamples } from '../../../audio/usersamples';
import { samplesChanged } from '../../../audio/samples';
import { soundBrowserClose, soundBrowserCursor, soundBrowserOpen, soundBrowserPick, soundBrowserStep, soundBrowserView, soundFilesPick, trackSoundList, trackSoundPick } from '../../../actions';
import { lcdMessage } from '../../../state/lcdMessage';
import { lcdSamples } from '../../../state/lcdSamples';
import { activeTrack } from '../../../state/trk';
import type { Screen } from '../core';
import { HALF } from '../consts';
import { registerScreenMenu } from './registry';
import { acting, LIST_ROWS, paintHint, paintList, scrollTop, stepCursor, type MenuRow } from './frame';
import { menuChanged, openMenuId, screenTrack } from './open';
import { TRACK_NAMES, isLegacyTrack, trackIndex, type TrackKey } from '../../../audio/tracks';

/* ---------------- SOUNDS ---------------- */

let soundsBody = '';

/*
 * Relecture de la V.6.0 :
 * - le menu ouvert tient la liste des voix 1 a 8 ouverte (lcdSamples.hold : plus de fermeture au repos sous le menu,
 *   NO SOUNDS ne reste plus a l'ecran) ; une saisie sur une liste fermee quand meme (une autre voix, le P-LOCK) la rouvre ;
 * - une piste 9 a 16 a sa liste, celle de son potard D SAMP (actions/browser.ts trackSoundList), et IMPORT pour elle.
 */
let release: (() => void) | null = null;
const LIST_AREA = { x0: 4, x1: 316, y0: 41, y1: 170 } as const;
const LIST_N = Math.floor((LIST_AREA.y1 - LIST_AREA.y0) / 15.5);

/** La liste d'une piste 9 a 16 : son curseur (-1 : le sample du moment), sa premiere ligne, la piste qu'elle montre. */
let hiCursor = -1;
let hiTop = -1;
let hiTrack: TrackKey | null = null;

/** La liste d'une piste 9 a 16 telle que l'ecran la montre ; null : une voix 1 a 8, ou aucune piste. */
function hiView(): { track: TrackKey; name: string; rows: MenuRow[]; keys: readonly (string | null)[]; cur: number; cursor: number } | null {
  const v = trackSoundList();
  if (!v) return null;
  if (v.track !== hiTrack) {
    hiTrack = v.track;
    hiCursor = -1;
    hiTop = -1;
  }
  const rows: MenuRow[] = v.rows.map((r, i) => ({ label: r.label, value: r.key === null ? '' : i === v.cur ? 'NOW' : r.family.toUpperCase() }));
  const cursor = hiCursor >= 0 && hiCursor < rows.length ? hiCursor : v.cur;
  return { track: v.track, name: v.name, rows, keys: v.rows.map((r) => r.key), cur: v.cur, cursor };
}

function paintSounds(screen: Screen): number {
  const h = hiView();
  if (h) {
    screen.text(`${h.cur + 1} / ${h.rows.length - 1}`, 312, 34, 7.5, HALF, 700, 'right', 0.5);
    hiTop = hiTop < 0 ? Math.max(0, h.cursor - 2) : hiTop;
    hiTop = scrollTop(hiTop, h.cursor, h.rows.length, LIST_N);
    soundsBody = `${h.name} SOUNDS|${paintList(screen, h.rows, h.cursor, hiTop, LIST_AREA)}`;
    paintHint(screen, 'UP/DOWN: SAMPLE   YES: CHOOSE   L/R: PREV NEXT   NO: EXIT');
    return 0;
  }
  let v = soundBrowserView();
  if (!v && screenTrack()) {
    soundBrowserOpen(true);
    v = soundBrowserView();
  }
  if (!v) {
    const t = screenTrack();
    screen.text(t ? 'YES: SHOW THE SOUNDS' : 'PICK A TRACK: TRK + TRIG', 160, 100, 10, HALF, 600, 'center', 0.4);
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
    const t = screenTrack();
    return t && (hiView() || soundBrowserView()) ? `SOUNDS  ${TRACK_NAMES[trackIndex(t)]}` : 'SOUNDS';
  },
  paint: (screen) => paintSounds(screen),
  onOpen() {
    hiCursor = -1;
    hiTop = -1;
    if (!release) release = lcdSamples.hold();
    if (!lcdSamples.isOpen() && !hiView()) soundBrowserOpen(true);
  },
  onClose() {
    release?.();
    release = null;
    if (lcdSamples.isOpen()) soundBrowserClose();
  },
  info: () => soundsBody,
  onInput(i) {
    if (!acting(i)) return true;
    if (i.kind === 'no') {
      soundBrowserClose();
      return false;
    }
    const h = hiView();
    if (h) {
      const last = h.rows.length - 1;
      if (i.kind === 'up' || i.kind === 'down') hiCursor = stepCursor(h.cursor, h.rows.length, i.kind === 'up' ? -1 : 1, i.func, LIST_N - 1);
      else if (i.kind === 'data') hiCursor = Math.max(0, Math.min(last, h.cursor + Math.round(i.delta ?? 0)));
      else if (i.kind === 'yes') {
        trackSoundPick(h.cursor);
        if (h.keys[h.cursor] !== null) hiCursor = -1;
      } else if (i.kind === 'left' || i.kind === 'right') {
        const n = Math.max(0, Math.min(last - 1, h.cur + (i.kind === 'left' ? -1 : 1)));
        if (n === h.cur) lcdMessage.show(`${h.name} SOUNDS: ${i.kind === 'left' ? 'FIRST' : 'LAST'} OF ${last}`);
        else trackSoundPick(n);
        hiCursor = -1;
      }
      menuChanged();
      return true;
    }
    // Une liste fermee sous le menu (une autre voix, le P-LOCK qui change) : toute saisie la rouvre
    let v = soundBrowserView();
    if (!v) {
      soundBrowserOpen(true);
      v = soundBrowserView();
      menuChanged();
      if (!v || i.kind === 'yes') return true;
    }
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
      // La piste active, T9 a T16 compris (relecture de la V.6.0 : le motif n'a alors plus de voix)
      if (cursor === 0) soundFilesPick(screenTrack(), false);
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

// Une autre piste choisie sous SOUNDS (relecture de la V.6.0) : une voix 1 a 8 retrouve sa liste (le navigateur d'avant se
// ferme quand le motif n'a plus de voix), une piste 9 a 16 la sienne
activeTrack.subscribe(() => {
  if (openMenuId() !== 'sounds') return;
  const t = screenTrack();
  if (t && isLegacyTrack(t) && !lcdSamples.isOpen()) soundBrowserOpen(true);
  menuChanged();
});
