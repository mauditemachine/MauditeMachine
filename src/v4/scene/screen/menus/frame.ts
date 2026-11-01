/**
 * Le cadre des menus plein ecran de la face DT2 (V.6.0, lane B5, 2026-11-01, cahier dt2 2.5, inv-dt-ui.md 4.2) : une liste
 * de lignes sous l'en-tete (x 0..320, y 22..192), la ligne choisie en negatif, une barre de defilement a droite ; le
 * panneau d'operations (RIGHT) et le panneau de tri (LEFT) sur un bord ; les confirmations dans le cadre des pop-ups
 * (x 50..270, y 40..160). Des fonctions, l'ecran en premier argument (Screen n'est importe que par son type).
 */

import type { Screen } from '../core';
import type { ScreenMenuInput } from './registry';
import { BLACK, FAINT, FRAME, HALF, INK } from '../consts';

/**
 * Le texte a peine des menus DT2 (une ligne a venir, l'aide du bas) : 0.52 de l'os sur le noir de l'ecran, 5,2:1 (la regle
 * de Mika du 2026-11-01, "en blanc on ne voit pas les ecritures" : tout texte a 4,5:1 au moins, en noir comme en creme ;
 * l'ecran reste noir dans les deux apparences). FAINT_TEXT (0.4, 3,4:1) reste aux ecrans d'avant.
 */
export const DIM_TEXT = 'rgba(246, 241, 231, 0.52)';

/** Une ligne d'un menu. sub : un sous-menu (...) ; dim : a venir (sa valeur dit BIENTOT) ; on : coche. */
export interface MenuRow {
  label: string;
  value?: string;
  sub?: boolean;
  dim?: boolean;
  on?: boolean;
}

/** La zone de la liste (unites) et la hauteur d'une ligne. */
export const LIST = { x0: 4, x1: 316, y0: 25, y1: 190, row: 15.5 } as const;
/** Combien de lignes tiennent. */
export const LIST_ROWS = Math.floor((LIST.y1 - LIST.y0) / LIST.row);

/** La premiere ligne montree pour que le curseur reste visible (le haut d'avant garde, tant qu'il le montre). */
export function scrollTop(top: number, cursor: number, n: number, rows = LIST_ROWS): number {
  let t = Math.max(0, Math.min(top, Math.max(0, n - rows)));
  if (cursor < t) t = cursor;
  if (cursor >= t + rows) t = cursor - rows + 1;
  return Math.max(0, t);
}

/**
 * Une liste : les lignes de top a top + rows, le curseur en negatif, la valeur a droite, ... d'un sous-menu, la barre de
 * defilement ; area : une autre zone (un panneau). Rend son texte (les sondes) : > devant le curseur, ~ une ligne a venir.
 */
export function paintList(screen: Screen, rows: readonly MenuRow[], cursor: number, top: number, area: { x0: number; x1: number; y0: number; y1: number; row?: number } = LIST): string {
  const rh = area.row ?? LIST.row;
  const n = Math.floor((area.y1 - area.y0) / rh);
  const out: string[] = [];
  for (let i = 0; i < n && top + i < rows.length; i += 1) {
    const k = top + i;
    const r = rows[k];
    const y = area.y0 + i * rh;
    const sel = k === cursor;
    if (sel) screen.roundRect(area.x0, y + 0.8, area.x1 - area.x0 - 6, rh - 1.6, 2.5, INK);
    const fg = sel ? BLACK : r.dim ? DIM_TEXT : INK;
    const label = `${r.label}${r.sub ? ' ...' : ''}`;
    const vx = area.x1 - 12;
    const vw = r.value ? screen.textWidth(r.value, 7.5, 600, 0.3) : 0;
    screen.text(screen.fitText(label, vx - vw - area.x0 - 12, 9, 0.4, 600), area.x0 + 5, y + rh * 0.68, 9, fg, 600, 'left', 0.4);
    if (r.on !== undefined) {
      const bx = area.x0 + (area.x1 - area.x0) - 20;
      screen.roundRect(bx, y + rh / 2 - 3.5, 7, 7, 1.2, r.on ? (sel ? BLACK : INK) : null, sel ? BLACK : HALF, 0.9);
    } else if (r.value) screen.text(r.value, vx, y + rh * 0.68, 7.5, sel ? BLACK : r.dim ? DIM_TEXT : HALF, 600, 'right', 0.3);
    out.push(`${sel ? '>' : ''}${r.dim ? '~' : ''}${label}${r.value ? `=${r.value}` : ''}${r.on !== undefined ? (r.on ? '[x]' : '[ ]') : ''}`);
  }
  // La barre de defilement (plus de lignes que la place)
  if (rows.length > n) {
    const x = area.x1 - 2.5;
    screen.line([x, area.y0 + 1, x, area.y1 - 1], FAINT, 1);
    const h = Math.max(8, ((area.y1 - area.y0) * n) / rows.length);
    const y = area.y0 + ((area.y1 - area.y0 - h) * top) / Math.max(1, rows.length - n);
    screen.line([x, y, x, y + h], INK, 2);
  }
  return out.join('|');
}

/** Un panneau sur le bord droit (RIGHT : les operations) ou gauche (LEFT : le tri), au-dessus de la liste ; rend son texte. */
export function paintPanel(screen: Screen, side: 'left' | 'right', title: string, rows: readonly MenuRow[], cursor: number): string {
  const w = 138;
  const x0 = side === 'right' ? 320 - w - 2 : 2;
  const y0 = 26;
  const h = Math.min(160, 18 + rows.length * 15.5 + 4);
  screen.roundRect(x0, y0, w, h, 4, BLACK, INK, 1);
  screen.text(title, x0 + 8, y0 + 12, 7, HALF, 700, 'left', 0.6);
  return `${title}:${paintList(screen, rows, cursor, 0, { x0: x0 + 4, x1: x0 + w, y0: y0 + 16, y1: y0 + h - 3 })}`;
}

/** Une question dans le cadre des pop-ups (x 50..270, y 40..160) : ses lignes, puis l'aide YES / NO ; rend son texte. */
export function paintPopupBox(screen: Screen, lines: readonly string[], hint = 'YES: OK   NO: BACK'): string {
  const x0 = 50;
  const y0 = 62;
  const w = 220;
  const h = 28 + lines.length * 15;
  screen.roundRect(x0, y0, w, h, 5, BLACK, INK, 1.2);
  lines.forEach((l, i) => screen.text(screen.fitText(l, w - 16, i === 0 ? 11 : 9, 0.4, 600), x0 + w / 2, y0 + 18 + i * 15, i === 0 ? 11 : 9, i === 0 ? INK : HALF, 600, 'center', 0.4));
  screen.text(hint, x0 + w / 2, y0 + h - 7, 7, DIM_TEXT, 700, 'center', 0.6);
  return `${lines.join(' / ')} [${hint}]`;
}

/** Une ligne d'aide au bas de la zone des menus (les gestes du moment). */
export function paintHint(screen: Screen, text: string): void {
  screen.line([4, 178, 316, 178], FRAME, 0.6);
  screen.text(screen.fitText(text, 300, 7, 0.5, 700), 160, 187.5, 7, DIM_TEXT, 700, 'center', 0.5);
}

/** Un pas de curseur dans une liste de n lignes (FUNC : une page) ; jamais hors de la liste. */
export function stepCursor(cur: number, n: number, dir: number, func: boolean, page = LIST_ROWS): number {
  if (n <= 0) return 0;
  return Math.max(0, Math.min(n - 1, cur + dir * (func ? page : 1)));
}

/**
 * La phase ou une saisie agit (le contrat de registry.ts) : YES et NO au relacher, les fleches et LEVEL/DATA a l'appui.
 * L'autre phase est prise sans rien faire (un menu ne laisse jamais B4 le fermer sur l'appui de NO).
 */
export const acting = (i: ScreenMenuInput): boolean => (i.kind === 'yes' || i.kind === 'no' ? i.phase === 'up' : i.phase === 'down');
