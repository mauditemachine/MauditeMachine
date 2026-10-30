/**
 * Les actions du MM-RYTM, scenes : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { KIT_LABEL } from '../../audio/kit';
import { pattern } from '../../audio/pattern';
import { lcdMessage } from '../../state/lcdMessage';
import { undo } from '../../state/undo';
import { sceneCtl } from '../../state/sceneCtl';
import { morph } from '../../audio/morph';
import { NO_SCENES, type SceneId } from '../../rytm/sceneData';
import { bindingOf, from01 } from '../../rytm/sceneParams';
import { MOBILE_QUERY, PAGE_KNOB_LETTERS, encLabel, type EncId } from '../../theme';
import { mixerInst, seqName } from './mixer';
import { sceneEdit01, sceneIdOfDial } from '../scenes';
import { type DialId, kitIdOf, layerIdOf, pageKnobOf, pageSlotOf } from '../kit';
import { seqDialOf } from '../mixer';

/* ---------------- SCENE A et B : tenir ou taper, puis tourner (2026-10-27, la phase 2) ---------------- */

/*
 * Facon Octatrack et Digitakt (Mika : "SCENE A, la fente du crossfader, SCENE B") : une touche SCENE tenue enregistre
 * tant qu'on la tient, une tape la garde (une autre tape, Echap, CLEAR de la scene ou une autre machine la rendent) ;
 * pendant ce temps chaque potard, bloc, jumeau ou cible MIDI du MM-RYTM qui se morphe ecrit dans la scene armee, jamais
 * dans la base (pattern.scenes, une etape d'UNDO par geste). Un pas tenu gagne (le P-LOCK) ; TEMPO, MASTER, les mutes, RUN
 * et les pages passent toujours a la base ; un choix de son dit NO SCENE. Armer une scene quitte un P-LOCK garde ; garder
 * le P-LOCK (un pas tenu lache sans tourner) desarme une scene gardee : jamais les deux.
 */
export const SCENE_WORD: Readonly<Record<SceneId, string>> = { a: 'SCENE A', b: 'SCENE B' };
export const SCENE_SHORT: Readonly<Record<SceneId, string>> = { a: 'SCN A', b: 'SCN B' };

/** Ce que montre la scene pour un potard, en unites du potard ; null : la base. */
export function sceneNative(dial: DialId, played: boolean): number | null {
  // Ni armee ni scene dans le motif : la base, sans rien chercher (le chemin de toujours)
  if (!sceneCtl.get().armed && (!played || pattern.scenes.get() === NO_SCENES)) return null;
  const id = sceneIdOfDial(dial);
  if (!id) return null;
  const b = bindingOf(id);
  if (!b) return null;
  if (sceneCtl.get().armed) {
    const v = sceneEdit01(id);
    return v === null ? null : from01(b, v);
  }
  if (!played) return null;
  const p = morph.played01(id);
  return p === null ? null : from01(b, p);
}

/** Le nom d'un potard pour l'ecran (le bloc, l'encodeur, la cible). */
export function dialName(dial: DialId): string {
  const pk = pageKnobOf(dial);
  if (pk >= 0) return pageSlotOf(pk)?.label ?? PAGE_KNOB_LETTERS[pk] ?? '?';
  const r = kitIdOf(dial);
  if (r) return KIT_LABEL[r] ?? r.toUpperCase();
  const lp = layerIdOf(dial);
  if (lp) return lp.toUpperCase();
  const mi = mixerInst(dial);
  if (mi) return `${mi} VOL`;
  const sd = seqDialOf(dial);
  if (sd) return seqName(sd);
  return encLabel(dial as EncId);
}

/**
 * La base d'un potard ne s'entend plus au x du moment (2026-10-27, revue B1) : son poids dans LA formule,
 * (A absent ? 1 - x : 0) + (B absent ? x : 0), vaut 0. 'AB' : les deux scenes l'ont ; 'A' : A seule a x = 0 (la
 * position d'arrivee) ; 'B' : B seule a x = 1 ; null : la base s'entend (en partie au moins), ou rien n'est morphe.
 */
function sceneHides(dial: DialId): 'A' | 'B' | 'AB' | null {
  if (sceneCtl.get().armed) return null;
  const s = pattern.scenes.get();
  if (s === NO_SCENES) return null;
  const id = sceneIdOfDial(dial);
  if (!id) return null;
  const inA = s.a[id] !== undefined;
  const inB = s.b[id] !== undefined;
  if (inA && inB) return 'AB';
  const x = sceneCtl.x();
  if (inA && x <= 0) return 'A';
  if (inB && x >= 1) return 'B';
  return null;
}
/** Le telephone n'a ni touche SCENE ni crossfader avant la phase 5 (revue BEH-2) : il dit seulement quelle scene joue. */
const phoneFace = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.(MOBILE_QUERY).matches;
const hideText = (dial: DialId, h: 'A' | 'B' | 'AB'): string =>
  phoneFace()
    ? `${dialName(dial)}: SCENE ${h === 'AB' ? 'A+B' : h} PLAYS`
    : h === 'AB'
      ? `${dialName(dial)}: IN SCENES A+B, HOLD A SCENE`
      : `${dialName(dial)}: SCENE ${h} PLAYS, HOLD SCENE ${h}`;

/**
 * Tourne hors scene sur un reglage que la scene entendue tient entierement (10.2, Feel ; les deux scenes, ou depuis la
 * revue B1 du 2026-10-27 A seule a x = 0 et B seule a x = 1) : la base change mais rien ne s'entend ; l'ecran le dit,
 * une fois toutes les 2 s au plus.
 */
let hintAt = -Infinity;
const SCENE_HINT_MS = 2000;
export function sceneHint(dial: DialId): void {
  const h = sceneHides(dial);
  if (!h) return;
  const now = performance.now();
  if (now - hintAt < SCENE_HINT_MS) return;
  hintAt = now;
  lcdMessage.show(hideText(dial, h));
}

/**
 * Le message d'un potard tourne hors scene (2026-10-27, revue B1) : sa base ne s'entend pas, l'ecran dit pourquoi a la
 * place de la valeur de base (le bloc et l'anneau montrent ce qui joue, le message ne les contredit plus) ; true : dit.
 */
export function sceneHideSay(dial: DialId): boolean {
  const h = sceneHides(dial);
  if (!h) return false;
  hintAt = performance.now();
  lcdMessage.show(hideText(dial, h));
  return true;
}

/** Le coin d'un reglage morphe pour une lecture (les jumeaux, 2026-10-27, revue B1) : comme le coin du bloc. */
export function sceneMark(dial: DialId): string {
  const s = pattern.scenes.get();
  if (s === NO_SCENES) return '';
  const id = sceneIdOfDial(dial);
  if (!id) return '';
  const inA = s.a[id] !== undefined;
  const inB = s.b[id] !== undefined;
  return inA && inB ? ', scenes A and B' : inA ? ', scene A' : inB ? ', scene B' : '';
}

/** Deux tapes ou Suppr sur un potard pendant qu'une scene est armee : sa cle s'en va (sa propre etape d'UNDO). */
export function sceneDrop(dial: DialId): boolean {
  const w = sceneCtl.get().armed;
  if (!w) return false;
  const id = sceneIdOfDial(dial);
  if (!id || pattern.scenes.get()[w][id] === undefined) return false;
  undo.boundary('mm808', 'step');
  pattern.scenes.drop(w, id);
  sceneCtl.use(performance.now());
  lcdMessage.show(`${SCENE_SHORT[w]} ${dialName(dial)} REMOVED`);
  return true;
}
