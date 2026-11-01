/**
 * Le menu SETTINGS de la face DT2, partie V.6.0 (lane B5, 2026-11-01, cahier dt2 3.11 ; inv-dt-ui.md 7.3) : la touche
 * SETTINGS. UP / DOWN ou LEVEL/DATA, YES ouvre ou change, NO revient d'un cran (de la racine, ferme).
 * - PATTERN : RENAME (le nom du pattern, 8 caracteres : UP / DOWN la lettre, LEFT / RIGHT le curseur, YES garde) ; CLEAR
 *   (WHOLE PATTERN et SEQUENCE DATA effacent les pas, les verrous et les reglages de trig du pattern ; le kit est encore
 *   global en V.6.0 et V.6.1 : KIT DATA s'appelle CLEAR SOUNDS (ALL PATTERNS) et demande deux confirmations) ; EDIT GRID
 *   (la grille de Mika posee sur les pas, ui/BeatEditor.tsx) ;
 * - PERSONALIZE : LED INTENSITY (LOW, MID, MAX), LED BACKLIGHT, REMEMBER SUBPAGE, TRK SELECT (NORMAL, SILENT, MANUAL,
 *   INVERTED) : des reglages de la machine, gardes dans ce navigateur (personalize, lus par la face et la saisie) ;
 * - SYSTEM : ABOUT (le firmware), STORAGE (la place prise par le site dans ce navigateur) ;
 * - PROJECT, SONG, MIDI CONFIG (V.6.2) et AUDIO ROUTING (V.6.1) : a peine, leur version le dit.
 */

import { kit16FromLegacy, tracks } from '../../../audio/tracks';
import { defaultKit } from '../../../audio/kitlaw';
import { parseVoices } from '../../../audio/voicelaw';
import { pattern } from '../../../audio/pattern';
import { resume } from '../../../audio/drums';
import { fwText, fwVersion } from '../../../firmware';
import { editor } from '../../../state/editor';
import { lcdMessage } from '../../../state/lcdMessage';
import { patterns, slotName } from '../../../state/patterns';
import { undo } from '../../../state/undo';
import type { Screen } from '../core';
import { BLACK, HALF, INK } from '../consts';
import { registerScreenMenu } from './registry';
import { acting, paintHint, paintList, paintPopupBox, scrollTop, stepCursor, type MenuRow } from './frame';
import { menuChanged, setOpenMenu } from './open';
import { NAME_CHARS, NAME_MAX, patternName, setPatternName } from './names';

/* ---------------- PERSONALIZE : le store ---------------- */

export const PERSONALIZE_KEY = 'mm.v4.rytm.personalize.1';
export type LedIntensity = 'low' | 'mid' | 'max';
export type TrkSelect = 'normal' | 'silent' | 'manual' | 'inverted';
export interface Personalize {
  led: LedIntensity;
  backlight: boolean;
  /** une touche de page rouvre la sous-page ou on l'a laissee (sinon la premiere) */
  subpage: boolean;
  /** TRK + TRIG (manuel DT2 14.7) : NORMAL choisit et joue, SILENT choisit sans jouer, MANUAL, INVERTED */
  trkSelect: TrkSelect;
}
/** Le depart : la machine d'aujourd'hui (TRK SELECT NORMAL est le comportement de la V.5.x, cahier 3.2). */
export const PERSONALIZE_DEFAULT: Readonly<Personalize> = { led: 'max', backlight: true, subpage: true, trkSelect: 'normal' };
const LEDS: readonly LedIntensity[] = ['low', 'mid', 'max'];
const TRKS: readonly TrkSelect[] = ['normal', 'silent', 'manual', 'inverted'];

let pers: Personalize | null = null;
const persListeners = new Set<() => void>();
function persLoad(): Personalize {
  if (pers) return pers;
  pers = { ...PERSONALIZE_DEFAULT };
  try {
    const o = JSON.parse(window.localStorage.getItem(PERSONALIZE_KEY) ?? 'null') as Partial<Personalize> | null;
    if (o && typeof o === 'object') {
      if (LEDS.includes(o.led as LedIntensity)) pers.led = o.led as LedIntensity;
      if (typeof o.backlight === 'boolean') pers.backlight = o.backlight;
      if (typeof o.subpage === 'boolean') pers.subpage = o.subpage;
      if (TRKS.includes(o.trkSelect as TrkSelect)) pers.trkSelect = o.trkSelect as TrkSelect;
    }
  } catch {
    // illisible : le depart
  }
  return pers;
}
/** Les reglages PERSONALIZE (la face, la saisie B4 et B3 les lisent ; rien ne les applique encore hors de ce menu). */
export const personalize = {
  get: (): Readonly<Personalize> => persLoad(),
  set(patch: Partial<Personalize>): void {
    pers = { ...persLoad(), ...patch };
    try {
      window.localStorage.setItem(PERSONALIZE_KEY, JSON.stringify(pers));
    } catch {
      // pour la visite
    }
    persListeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    persListeners.add(fn);
    return () => {
      persListeners.delete(fn);
    };
  },
};

/* ---------------- l'arbre ---------------- */

type Node = 'root' | 'pattern' | 'clear' | 'personalize' | 'system';
type Pop = null | { kind: 'rename' } | { kind: 'confirm'; what: 'seq' | 'sounds'; n: number } | { kind: 'about' } | { kind: 'storage' };

let path: Node[] = ['root'];
const cursors: Partial<Record<Node, number>> = {};
let top = 0;
let pop: Pop = null;
let draft: string[] = [];
let at = 0;
let storage = '';
let body = '';

const here = (): Node => path[path.length - 1];
const onOff = (b: boolean): string => (b ? 'ON' : 'OFF');

function rows(n: Node): MenuRow[] {
  const p = persLoad();
  switch (n) {
    case 'root':
      return [
        { label: 'PROJECT', sub: true, dim: true, value: 'V.6.2' },
        { label: 'SONG', sub: true, dim: true, value: 'V.6.2' },
        { label: 'PATTERN', sub: true },
        { label: 'MIDI CONFIG', sub: true, dim: true, value: 'V.6.2' },
        { label: 'AUDIO ROUTING', sub: true, dim: true, value: 'V.6.1' },
        { label: 'PERSONALIZE', sub: true },
        { label: 'SYSTEM', sub: true },
      ];
    case 'pattern':
      return [{ label: 'RENAME', value: patternName(patterns.get().cur) || slotName(patterns.get().cur) }, { label: 'CLEAR', sub: true }, { label: 'EDIT GRID', value: 'SHIFT+E' }];
    case 'clear':
      return [{ label: 'WHOLE PATTERN' }, { label: 'SEQUENCE DATA' }, { label: 'CLEAR SOUNDS (ALL PATTERNS)' }];
    case 'personalize':
      return [
        { label: 'LED INTENSITY', value: p.led.toUpperCase() },
        { label: 'LED BACKLIGHT', value: onOff(p.backlight) },
        { label: 'REMEMBER SUBPAGE', value: onOff(p.subpage) },
        { label: 'TRK SELECT', value: p.trkSelect.toUpperCase() },
        { label: 'U/D KEY MODE', dim: true, value: 'V.6.1' },
        { label: 'PAGE AUTOCOPY', dim: true, value: 'V.6.1' },
        { label: 'SCREEN SAVER', dim: true, value: 'V.6.1' },
      ];
    case 'system':
      return [{ label: 'ABOUT', sub: true }, { label: 'STORAGE', sub: true }, { label: 'RESET, FORMAT', dim: true, value: 'V.6.2' }];
  }
}

const TITLE: Readonly<Record<Node, string>> = { root: 'SETTINGS', pattern: 'PATTERN', clear: 'CLEAR', personalize: 'PERSONALIZE', system: 'SYSTEM' };

/** STORAGE : la place que prend le site (navigator.storage.estimate) et celle des cles du MM-RYTM dans localStorage. */
function measure(): void {
  storage = 'MEASURING...';
  let ls = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i) ?? '';
      if (k.startsWith('mm.v4.')) ls += k.length + (window.localStorage.getItem(k) ?? '').length;
    }
  } catch {
    ls = 0;
  }
  const kb = (b: number): string => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
  const local = `MACHINES ${kb(ls * 2)}`;
  const est = typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function' ? navigator.storage.estimate() : null;
  if (!est) {
    storage = `${local}|SITE: UNKNOWN`;
    return;
  }
  void est
    .then((e) => {
      storage = `${local}|SITE ${kb(e.usage ?? 0)} OF ${kb(e.quota ?? 0)}`;
      menuChanged();
    })
    .catch(() => {
      storage = `${local}|SITE: UNKNOWN`;
      menuChanged();
    });
}

/** YES sur une ligne. */
function choose(): void {
  const n = here();
  const c = cursors[n] ?? 0;
  const r = rows(n)[c];
  if (!r) return;
  if (r.dim) {
    lcdMessage.show(`${r.label}: BIENTOT ${r.value ?? ''}`.trim(), 1400);
    return;
  }
  if (n === 'root') path.push(c === 2 ? 'pattern' : c === 5 ? 'personalize' : 'system');
  else if (n === 'pattern') {
    if (c === 0) {
      const cur = patternName(patterns.get().cur);
      draft = [...cur.padEnd(NAME_MAX, ' ')].slice(0, NAME_MAX);
      at = 0;
      pop = { kind: 'rename' };
    } else if (c === 1) path.push('clear');
    else {
      setOpenMenu(null);
      if (editor.get() !== 'mm808') editor.toggle('mm808');
      lcdMessage.show('EDIT GRID: NO OR SHIFT+E TO CLOSE', 1600);
      return;
    }
  } else if (n === 'clear') pop = { kind: 'confirm', what: c === 2 ? 'sounds' : 'seq', n: c === 2 ? 2 : 1 };
  else if (n === 'personalize') {
    const p = persLoad();
    if (c === 0) personalize.set({ led: LEDS[(LEDS.indexOf(p.led) + 1) % LEDS.length] });
    else if (c === 1) personalize.set({ backlight: !p.backlight });
    else if (c === 2) personalize.set({ subpage: !p.subpage });
    else if (c === 3) personalize.set({ trkSelect: TRKS[(TRKS.indexOf(p.trkSelect) + 1) % TRKS.length] });
  } else if (n === 'system') {
    if (c === 0) pop = { kind: 'about' };
    else {
      pop = { kind: 'storage' };
      measure();
    }
  }
  top = 0;
}

/** La confirmation d'un CLEAR (la seconde pour CLEAR SOUNDS) : efface. */
function confirm(p: { what: 'seq' | 'sounds'; n: number }): void {
  if (p.n > 1) {
    pop = { kind: 'confirm', what: p.what, n: p.n - 1 };
    return;
  }
  pop = null;
  resume();
  undo.boundary('mm808', 'step');
  if (p.what === 'seq') {
    pattern.clear();
    lcdMessage.show(`${slotName(patterns.get().cur)} SEQUENCE CLEARED`, 1400);
  } else {
    tracks.replace(kit16FromLegacy(defaultKit(), parseVoices(null)));
    lcdMessage.show('SOUNDS RESET: ALL PATTERNS', 1400);
  }
}

function paint(screen: Screen): number {
  const n = here();
  const r = rows(n);
  const c = Math.min(cursors[n] ?? 0, r.length - 1);
  top = scrollTop(top, c, r.length, 8);
  body = `${path.join('>')}|${paintList(screen, r, c, top, { x0: 4, x1: 316, y0: 26, y1: 170 })}`;
  paintHint(screen, n === 'root' ? 'UP/DOWN: CHOOSE   YES: OPEN   NO: EXIT' : 'UP/DOWN: CHOOSE   YES: OPEN OR CHANGE   NO: BACK');
  if (!pop) return 0;
  if (pop.kind === 'rename') {
    // L'ecran du nom : les 8 cases, celle du curseur en negatif
    screen.roundRect(40, 50, 240, 92, 5, BLACK, INK, 1.2);
    screen.text(`PATTERN NAME  ${slotName(patterns.get().cur)}`, 160, 66, 8.5, HALF, 700, 'center', 0.6);
    for (let i = 0; i < NAME_MAX; i += 1) {
      const x = 60 + i * 25;
      if (i === at) screen.roundRect(x, 76, 22, 26, 3, INK);
      else screen.roundRect(x, 76, 22, 26, 3, null, HALF, 0.8);
      screen.text(draft[i] === ' ' ? '' : draft[i], x + 11, 95, 15, i === at ? BLACK : INK, 600, 'center');
    }
    screen.text('UP/DOWN: LETTER   L/R: MOVE   YES: SAVE   NO: ABORT', 160, 128, 7, HALF, 700, 'center', 0.5);
    body += `|RENAME ${draft.join('')}@${at}`;
  } else if (pop.kind === 'confirm') {
    const sounds = pop.what === 'sounds';
    body += `|${paintPopupBox(screen, sounds ? [pop.n > 1 ? 'CLEAR SOUNDS?' : 'REALLY? ALL PATTERNS', 'THE 16 TRACKS GO BACK', 'TO THEIR FIRST SOUND'] : ['CLEAR PATTERN?', `${slotName(patterns.get().cur)}: STEPS, LOCKS, TRIGS`], 'YES: CLEAR   NO: BACK')}`;
  } else if (pop.kind === 'about') {
    body += `|${paintPopupBox(screen, ['MM-RYTM', fwText('mm808'), `V.${fwVersion('mm808')} · MAUDITE MACHINE`, 'FACE DIGITAKT II · 16 TRACKS'], 'NO: BACK')}`;
  } else {
    body += `|${paintPopupBox(screen, ['STORAGE', ...storage.split('|')], 'NO: BACK')}`;
  }
  return 0;
}

registerScreenMenu({
  id: 'settings',
  owner: 'B5',
  title: () => path.map((n) => TITLE[n]).join(' > '),
  paint: (screen) => paint(screen),
  onOpen() {
    path = ['root'];
    cursors.root = 2;
    top = 0;
    pop = null;
  },
  onClose() {
    pop = null;
  },
  info: () => body,
  onInput(i) {
    if (!acting(i)) return true;
    const dir = i.kind === 'up' ? -1 : i.kind === 'down' ? 1 : i.kind === 'data' ? Math.round(i.delta ?? 0) : 0;
    if (pop) {
      if (pop.kind === 'rename') {
        if (i.kind === 'up' || i.kind === 'down' || i.kind === 'data') {
          const k = NAME_CHARS.indexOf(draft[at] ?? ' ');
          const d = i.kind === 'data' ? dir : -dir;
          draft[at] = NAME_CHARS[(((k + d) % NAME_CHARS.length) + NAME_CHARS.length) % NAME_CHARS.length];
        } else if (i.kind === 'left' || i.kind === 'right') at = Math.max(0, Math.min(NAME_MAX - 1, at + (i.kind === 'right' ? 1 : -1)));
        else if (i.kind === 'yes') {
          setPatternName(patterns.get().cur, draft.join(''));
          lcdMessage.show(`${slotName(patterns.get().cur)} NAMED ${patternName(patterns.get().cur) || '(NONE)'}`, 1400);
          pop = null;
        } else if (i.kind === 'no') pop = null;
      } else if (pop.kind === 'confirm') {
        if (i.kind === 'yes') confirm(pop);
        else if (i.kind === 'no') pop = null;
      } else if (i.kind === 'no' || i.kind === 'yes') pop = null;
      menuChanged();
      return true;
    }
    const n = here();
    if (dir) cursors[n] = stepCursor(cursors[n] ?? 0, rows(n).length, Math.sign(dir) * Math.max(1, Math.abs(dir)), i.func && i.kind !== 'data', 8);
    else if (i.kind === 'yes' || i.kind === 'right') choose();
    else if (i.kind === 'no' || i.kind === 'left') {
      if (path.length <= 1) return i.kind === 'left';
      path.pop();
      top = 0;
    }
    menuChanged();
    return true;
  },
});
