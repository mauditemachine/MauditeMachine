/**
 * Le menu PRESET/KIT de la face DT2 (V.6.0, lane B5, 2026-11-01, cahier dt2 1.3, 1.4, 3.10 ; inv-dt-ui.md 7.1) : la touche
 * PRESET/KIT. Sa racine : PRESET (le son d'une piste, V.6.2), KIT (la liste d'aujourd'hui, les presets de toute la machine,
 * state/presetMode.ts) et RANDOM BEAT (le beat entier au hasard, l'extra de Mika, rytm:random). Navigation DT2 : UP / DOWN
 * ou LEVEL/DATA, YES entre ou charge, NO revient d'un cran (de la racine, ferme). Dans KIT : RIGHT ouvre le panneau des
 * operations (SAVE TO HERE, RENAME, DELETE) ; LEFT le tri (V.6.2). Les questions de la liste (OVERWRITE ou AS NEW, DELETE?)
 * et l'ecran du nom passent par les memes touches : le nom, UP / DOWN la lettre, LEFT / RIGHT le curseur, YES valide.
 * Plus de touches d'ecran sur la face DT2 (rytm/presetKeys.ts realU suppose la rangee d'avant) : les fleches les remplacent.
 */

import { presetKey, randomPattern } from '../../../actions';
import { lcdMessage } from '../../../state/lcdMessage';
import { PRESET_SLOTS, presetMode, type PresetSlot } from '../../../state/presetMode';
import type { Screen } from '../core';
import { BLACK, HALF, INK } from '../consts';
import { registerScreenMenu, type ScreenMenu } from './registry';
import { DIM_TEXT, acting, paintHint, paintList, paintPanel, paintPopupBox, stepCursor, type MenuRow } from './frame';
import { menuChanged } from './open';

const M = 'mm808' as const;
type Level = 'root' | 'kit' | 'ops';
let level: Level = 'root';
let cursor = 1;
let opCursor = 0;
let qCursor = 0;
let body = '';

const ROOT: readonly MenuRow[] = [
  { label: 'PRESET', sub: true, dim: true, value: 'V.6.2' },
  { label: 'KIT', sub: true },
  { label: 'RANDOM BEAT', value: 'YES' },
];
/** Le panneau d'operations (RIGHT) : sa ligne et la touche du mode presets qu'elle presse. */
const OPS: readonly { label: string; key: PresetSlot }[] = [
  { label: 'SAVE TO HERE', key: 'save' },
  { label: 'RENAME', key: 'name' },
  { label: 'DELETE', key: 'del' },
];

function enterKit(): void {
  if (!presetMode.on(M)) presetKey(M, 'open');
  level = 'kit';
}

/** Les touches d'une question (OVERWRITE, AS NEW, YES...) : leur place dans PRESET_SLOTS et leur nom. */
function questionKeys(): { slot: PresetSlot; label: string }[] {
  const v = presetMode.view(M);
  if (!v) return [];
  return v.keys.map((label, i) => ({ slot: PRESET_SLOTS[i], label })).filter((k) => k.label && k.slot !== 'exit');
}

function paint(screen: Screen): number {
  // Les presets ouverts par un autre chemin (le clavier P, le MIDI) : la liste KIT
  if (level === 'root' && presetMode.on(M)) level = 'kit';
  if (level === 'root' || !presetMode.on(M)) {
    body = paintList(screen, ROOT, cursor, 0);
    paintHint(screen, 'UP/DOWN: CHOOSE   YES: OPEN   NO: EXIT');
    return 0;
  }
  const v = presetMode.view(M);
  if (!v) return 0;
  // La liste : la ligne d'avant, le curseur en grand, celle d'apres ; le rang et le titre
  screen.text(v.title, 8, 36, 8, HALF, 700, 'left', 0.6);
  screen.text(`${v.group ? `${v.group}  ` : ''}${v.count}`, 312, 36, 8, HALF, 700, 'right', 0.5);
  if (v.prev) screen.text(screen.fitText(v.prev, 296, 10, 0.4, 600), 12, 62, 10, DIM_TEXT, 600, 'left', 0.4);
  screen.roundRect(4, 72, 306, 30, 4, INK);
  const mark = v.mark === 'edited' ? ' *' : v.mark === 'loaded' ? '  (LOADED)' : '';
  screen.text(screen.fitText(`${v.empty ? 'NO PRESETS' : v.name}${mark}`, 290, 15, 0.4, 600), 12, 92.5, 15, BLACK, 600, 'left', 0.4);
  if (v.next) screen.text(screen.fitText(v.next, 296, 10, 0.4, 600), 12, 122, 10, DIM_TEXT, 600, 'left', 0.4);
  body = `${v.stage}|${v.prev}|>${v.name}${mark}|${v.next}|${v.count}`;
  if (v.stage === 'name' && v.naming) {
    const n = v.naming;
    body += `|NAME ${n.text}@${n.at}`;
    paintPopupBox(screen, [n.kind === 'new' ? 'SAVE AS' : 'RENAME', ' ', n.problem || ' '], 'UP/DOWN: LETTER  L/R: MOVE  YES: SAVE  NO: BACK');
    body += `|CURSOR ${paintName(screen, n.text, n.at)}`;
  } else if (v.stage !== 'browse') {
    const ks = questionKeys();
    qCursor = Math.min(qCursor, Math.max(0, ks.length - 1));
    body += `|Q ${paintPanel(screen, 'right', 'CONFIRM', ks.map((k) => ({ label: k.label })), qCursor)}`;
  } else if (level === 'ops') {
    body += `|${paintPanel(screen, 'right', 'OPERATIONS', OPS.map((o) => ({ label: o.label })), opCursor)}`;
  }
  paintHint(screen, level === 'ops' ? 'UP/DOWN: CHOOSE   YES: DO IT   NO: BACK' : 'UP/DOWN: PRESET   YES: LOAD   RIGHT: OPERATIONS   NO: BACK');
  return 0;
}

/**
 * Le nom en cours dans la fenetre SAVE AS ou RENAME (la deuxieme ligne du cadre des pop-ups, frame.ts paintPopupBox) : le
 * caractere du curseur en negatif (relecture de la V.6.0 : on ne voyait pas quelle lettre UP / DOWN change ; comme les cases
 * du RENAME de SETTINGS). Rend le nom avec le curseur entre crochets (les sondes).
 */
const NAME_Y = 62 + 18 + 15;
const NAME_SIZE = 11;
function paintName(screen: Screen, text: string, at: number): string {
  const chars = [...text];
  const a = Math.max(0, Math.min(Math.max(0, chars.length - 1), at));
  // Une case par caractere, de la largeur du plus large (le curseur ne fait rien bouger) ; les cases vides de l'utilisateur
  // (avant la barre) soulignees, comme le nom de la liste (____/DEEP KICK)
  const cell = screen.textWidth('W', NAME_SIZE, 600) + 0.6;
  const user = Math.max(0, text.indexOf('/'));
  let cx = 160 - (cell * chars.length) / 2;
  chars.forEach((ch, i) => {
    if (i === a) screen.roundRect(cx, NAME_Y - NAME_SIZE + 1, cell, NAME_SIZE + 3.2, 1.6, INK);
    if (ch !== ' ') screen.text(ch, cx + cell / 2, NAME_Y, NAME_SIZE, i === a ? BLACK : INK, 600, 'center');
    else if (i !== a && i < user) screen.line([cx + 1.5, NAME_Y + 1, cx + cell - 1.5, NAME_Y + 1], HALF, 0.8);
    cx += cell;
  });
  return `${chars.slice(0, a).join('')}[${chars[a] ?? ' '}]${chars.slice(a + 1).join('')}`;
}

function input(i: Parameters<NonNullable<ScreenMenu['onInput']>>[0]): boolean {
  if (!acting(i)) return true;
  const dir = i.kind === 'up' ? -1 : i.kind === 'down' ? 1 : i.kind === 'data' ? Math.sign(i.delta ?? 0) : 0;
  // La racine
  if (level === 'root' || !presetMode.on(M)) {
    level = 'root';
    if (dir) cursor = stepCursor(cursor, ROOT.length, dir, false);
    else if (i.kind === 'yes') {
      if (cursor === 0) lcdMessage.show('PRESET (TRACK SOUND): BIENTOT V.6.2', 1400);
      else if (cursor === 1) enterKit();
      else randomPattern(null);
    } else if (i.kind === 'no') return false;
    menuChanged();
    return true;
  }
  const v = presetMode.view(M);
  if (!v) return true;
  // L'ecran du nom : UP / DOWN la lettre (le potard A d'avant), LEFT / RIGHT le curseur (B), YES valide, NO revient
  if (v.stage === 'name') {
    if (i.kind === 'up' || i.kind === 'down') presetMode.turn(M, 0, i.kind === 'up' ? 1 : -1);
    else if (i.kind === 'data') presetMode.turn(M, 0, Math.round(i.delta ?? 0));
    else if (i.kind === 'left' || i.kind === 'right') presetMode.turn(M, 1, i.kind === 'right' ? 1 : -1);
    else if (i.kind === 'yes') presetMode.nameOk(M);
    else if (i.kind === 'no') presetMode.back();
    menuChanged();
    return true;
  }
  // Une question (OVERWRITE ou AS NEW, DELETE?) : ses touches en panneau
  if (v.stage !== 'browse') {
    const ks = questionKeys();
    if (dir) qCursor = stepCursor(qCursor, ks.length, dir, false);
    else if (i.kind === 'yes' && ks[qCursor]) presetKey(M, ks[qCursor].slot);
    else if (i.kind === 'no') presetMode.back();
    menuChanged();
    return true;
  }
  if (level === 'ops') {
    if (dir) opCursor = stepCursor(opCursor, OPS.length, dir, false);
    else if (i.kind === 'yes') {
      level = 'kit';
      qCursor = 0;
      presetKey(M, OPS[opCursor].key);
    } else if (i.kind === 'no' || i.kind === 'left') level = 'kit';
    menuChanged();
    return true;
  }
  // La liste
  if (i.kind === 'up' || i.kind === 'down') {
    const n = i.func ? 8 : 1;
    for (let k = 0; k < n; k += 1) presetKey(M, i.kind === 'up' ? 'prev' : 'next');
  } else if (i.kind === 'data') presetMode.step(M, Math.round(i.delta ?? 0), true);
  else if (i.kind === 'yes') presetKey(M, 'load');
  else if (i.kind === 'right') {
    level = 'ops';
    opCursor = 0;
  } else if (i.kind === 'left') lcdMessage.show('SORT, FILTER, SEARCH: BIENTOT V.6.2', 1400);
  else if (i.kind === 'no') {
    presetMode.close();
    level = 'root';
  }
  menuChanged();
  return true;
}

function menu(id: 'preset' | 'kit'): ScreenMenu {
  return {
    id,
    owner: 'B5',
    title: () => (level === 'root' ? 'PRESET/KIT' : 'KIT'),
    paint: (screen) => paint(screen),
    onOpen() {
      opCursor = 0;
      qCursor = 0;
      if (id === 'kit' || presetMode.on(M)) enterKit();
      else {
        level = 'root';
        cursor = 1;
      }
    },
    onClose() {
      if (presetMode.on(M)) presetMode.close();
      level = 'root';
    },
    info: () => `${level}|${body}`,
    onInput: input,
  };
}

registerScreenMenu(menu('preset'));
registerScreenMenu(menu('kit'));
