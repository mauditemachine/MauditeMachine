/**
 * Les actions du MM-RYTM, browser : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { KIT_FAMILIES, kit, type KitFamily } from '../../audio/kit';
import { BROWSER_ROWS, lcdSamples } from '../../state/lcdSamples';
import { soundBrowserOpen, soundBrowserView } from '../browser';

/** La premiere ligne montree, bornee (la derniere page reste pleine). */
export const browserClampTop = (top: number, len: number): number => Math.max(0, Math.min(Math.max(0, len - BROWSER_ROWS), Math.round(top)));

/** La ligne i en vue (le defilement le plus court). */
export function browserReveal(i: number): void {
  const v = soundBrowserView();
  if (!v || i < 0) return;
  const top = i < v.top ? i : i >= v.top + v.visible ? i - v.visible + 1 : v.top;
  if (top !== v.top) lcdSamples.update({ top: browserClampTop(top, v.rows.length) });
}

/** Le son a change par un potard (SOUND, l'ancien SAMPLE, le raccourci vsound) : la liste s'ouvre et le suit. */
export function soundBrowserFollow(): void {
  if (!soundBrowserOpen()) return;
  const v = soundBrowserView();
  if (!v) return;
  lcdSamples.update({ cursor: -1, arm: -1 });
  browserReveal(v.cur);
}

/*
 * Un sample du kit qui n'a pas pu venir (2026-10-21, audit RS-1) : l'ecran le dit une fois (BD ENGELHARDT: OFFLINE,
 * 909 PLAYS), pas a chaque nouvel essai ; revenu, il le dit aussi (BD ENGELHARDT LOADED).
 */
export const failShown = new Map<string, string>();
export const kitFamiliesOf = (key: string): KitFamily[] => KIT_FAMILIES.filter((f) => kit.get().sample[f] === key && kit.layerOf(f).lev > 0);
