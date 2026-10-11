/**
 * Clavier global (spec 7.2, 13 et 20.6.2), sur le modele de
 * src/v3/hooks/useKeys.ts. A S D F frappent BD SD CH OH, Z X C V frappent
 * CP TOM HT CY (les huit voix depuis le 2026-10-05, theme.ts PADS ; le son
 * part a la touche, en mode MUTE la voix se coupe). Sur le MM-RYTM
 * (2026-10-08, state/rytmPage.ts), hors EDIT et du mode presets : H passe
 * de la vue PAGE de l'ecran (par defaut) a HOME et retour, [ et ] passent a
 * la page d'avant ou d'apres (comme les touches de page), L met le pas choisi
 * en LOCK (les parameter locks, 2026-10-08 ; L encore, ou Echap, en sort). 1 a 5 ouvrent les pages (TRACKS, MIXTAPES,
 * SHOWS, PRESS, CONTACT ; la page deja ouverte se ferme), 6 et O ouvrent ou
 * referment la machine (le pad OPEN), Espace lance ou arrete le
 * sequenceur (RUN/STOP du MM-VOYAGER quand on l'utilise), R ramene la vue par defaut, Echap ferme
 * la section ouverte (sinon referme la vue eclatee, sinon deselectionne
 * l'instrument). E ouvre ou ferme l'editeur (EDIT) du MM-ARP ou du
 * MM-RYTM (2026-10-04). I allume ou eteint les INFOS du MM-ARP
 * (2026-10-08, la touche i de son grand ecran), et celles du MM-RYTM quand
 * on l'utilise (l'etape R4, la touche i de son ecran). Gauche et droite passent
 * d'une machine a l'autre (2026-10-05), sauf sur un controle qui s'en sert
 * (encodeur, onglets).
 * M (2026-10-09) : MUTE du MM-RYTM, Maj + M : SOLO (la meme machine a etats
 * que la touche : une tape, le mode suivant, au lacher ; tenue MODE_HOLD_MS,
 * toutes les voix reviennent).
 * UNDO et REDO (2026-10-11, state/undo.ts) : Cmd+Z (Ctrl+Z hors Mac) defait,
 * Maj+Cmd+Z (Maj+Ctrl+Z) ou Ctrl+Y refait, sur toutes les machines ; un champ
 * qu'on tape (le nom d'un preset) garde les siens.
 * Rien d'autre ne part avec Alt, Ctrl ou Meta, dans un champ editable, ni sur une
 * repetition de touche. Espace est laisse au controle qui l'utilise deja
 * (bouton, lien, jumeau bouton ou lien) : il l'active, comme partout. Un
 * encodeur (role slider) n'a rien a faire d'Espace : il reste RUN/STOP.
 * Sans WebGL (page de repli, pas de machine) seul Echap reste.
 */

import { useEffect, useRef } from 'react';
import { MODE_HOLD_MS, editToggle, escape, modeHold, muteToggle, openToggle, padHit, page, presetKey, resetView, runToggle, rytmHome, rytmLockToggle, soloToggle, stepMachine, voyPad, voyRun } from '../actions';
import { presetMode } from '../state/presetMode';
import type { Stage } from '../scene/renderer';
import { editor } from '../state/editor';
import { focus } from '../state/focus';
import { rytmPage } from '../state/rytmPage';
import { section } from '../state/section';
import { voyInfos } from '../state/voyInfos';
import { rytmInfos } from '../state/rytmInfos';
import { undo } from '../state/undo';
import { PADS, PAGES, type PageId } from '../theme';

/** MM-VOYAGER (2026-10-03) : A S D F G H J K jouent les huit accords quand on l'utilise. */
const CHORD_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];

const isEditable = (t: EventTarget | null): boolean => {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
};

/** Un controle qui fait deja quelque chose d'Espace (pas les encodeurs : fleches seulement). */
const ownsSpace = (t: EventTarget | null): boolean => {
  if (!(t instanceof Element)) return false;
  return t.closest('button, a[href], [role="button"], summary, input, textarea, select, [contenteditable="true"]') !== null;
};

/** Un controle qui se sert des fleches (encodeur, onglets, liste, champ) : elles lui restent. */
const ownsArrows = (t: EventTarget | null): boolean => {
  if (!(t instanceof Element)) return false;
  return t.closest('[role="slider"], [role="tab"], [role="tablist"], [role="radio"], [role="menuitem"], [role="option"], [role="listbox"], input, textarea, select') !== null;
};

/** 'a' -> BD ... 'z' -> CP ... ; les majuscules (verrou) comptent aussi. */
const PAD_KEYS = new Map(PADS.flatMap((p) => (p.kind === 'voice' ? [[p.key.toLowerCase(), p.id] as const] : [])));
/** Les pages (1 a 5, sur la carte depuis le 2026-10-03) et OPEN (6) : leur chiffre. */
const DIGIT_KEYS: readonly { key: string; page: PageId | null }[] = [
  ...PAGES.map((p) => ({ key: p.key, page: p.id })),
  ...PADS.filter((p) => p.kind === 'open').map((p) => ({ key: p.key, page: null })),
];

export function useKeys(getStage: () => Stage | null, machine: boolean): void {
  // Le gestionnaire ne change pas : il lit l'etat courant ici
  const on = useRef(machine);
  on.current = machine;
  // M tenu (2026-10-09) : son mode (MUTE, Maj : SOLO), sa minuterie, et si la tenue a deja tout rendu
  const mKey = useRef<{ kind: 'mute' | 'solo'; timer: number; fired: boolean } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        if (escape()) e.preventDefault();
        return;
      }
      if (!on.current) return;
      // UNDO et REDO (2026-10-11) : Cmd+Z, Maj+Cmd+Z, Ctrl+Y ; la touche tenue ne repete pas (chaque etape recalcule les sons)
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !isEditable(e.target)) {
        const k = e.key.toLowerCase();
        if (k === 'z' || (k === 'y' && e.ctrlKey && !e.metaKey && !e.shiftKey)) {
          e.preventDefault();
          if (e.repeat) return;
          if (k === 'z' && !e.shiftKey) undo.undo();
          else undo.redo();
          return;
        }
      }
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat || isEditable(e.target)) return;
      // Mode presets (2026-10-04) : gauche et droite passent d'un preset a l'autre
      const pm = presetMode.get().machine;
      if (pm && pm === focus.get() && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        presetKey(pm, e.key === 'ArrowLeft' ? 'prev' : 'next');
        return;
      }
      // Gauche et droite (2026-10-05) : la machine d'a cote (pas avec une page ouverte par-dessus)
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !ownsArrows(e.target) && section.get() === null) {
        e.preventDefault();
        stepMachine(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      // I (2026-10-08) : INFOS du MM-ARP, l'aide au survol (la touche i de son grand ecran)
      if (focus.get() === 'voy' && (e.code === 'KeyI' || e.key.toLowerCase() === 'i')) {
        e.preventDefault();
        voyInfos.toggle();
        return;
      }
      // I (R4, 2026-10-08) : INFOS du MM-RYTM (la touche i de son ecran), partout ou on l'utilise (EDIT, presets compris)
      if (focus.get() === 'mm808' && (e.code === 'KeyI' || e.key.toLowerCase() === 'i')) {
        e.preventDefault();
        rytmInfos.toggle();
        return;
      }
      const chord = focus.get() === 'voy' ? CHORD_KEYS.indexOf(e.key.toLowerCase()) : -1;
      if (chord >= 0) {
        e.preventDefault();
        voyPad(chord, getStage());
        return;
      }
      const inst = focus.get() === 'voy' || focus.get() === 'dj' || focus.get() === 'bass' ? undefined : PAD_KEYS.get(e.key.toLowerCase());
      if (inst) {
        e.preventDefault();
        padHit(inst, getStage());
        return;
      }
      // Les pages du MM-RYTM (2026-10-08, Mika : "8 encodeurs assignables a condition de presser les bonnes
      // touches ; l'ecran divise en 8 blocs") : H bascule HOME et la vue PAGE, [ et ] changent de page ;
      // pas dans EDIT ni en mode presets (leurs ecrans passent avant)
      if (focus.get() === 'mm808' && editor.get() !== 'mm808' && presetMode.get().machine !== 'mm808') {
        const k = e.key.toLowerCase();
        if (e.code === 'KeyH' || k === 'h') {
          e.preventDefault();
          // rytm:home (actions.ts) : en LOCK, il le dit et ne change pas la vue (revue de R2)
          rytmHome();
          return;
        }
        if (e.code === 'BracketLeft' || e.code === 'BracketRight' || k === '[' || k === ']') {
          e.preventDefault();
          rytmPage.step(e.code === 'BracketLeft' || k === '[' ? -1 : 1);
          return;
        }
        // L (2026-10-08) : le LOCK sur le pas choisi (le dernier touche), ou hors LOCK
        if (e.code === 'KeyL' || k === 'l') {
          e.preventDefault();
          rytmLockToggle();
          return;
        }
      }
      // M (2026-10-09) : MUTE, Maj + M : SOLO, comme la touche de la face (la tape agit au lacher ; tenue, toutes les voix reviennent)
      if (focus.get() === 'mm808' && editor.get() !== 'mm808' && (e.code === 'KeyM' || e.key.toLowerCase() === 'm')) {
        e.preventDefault();
        if (mKey.current) return;
        const kind = e.shiftKey ? 'solo' : 'mute';
        const held = { kind, timer: 0, fired: false } as { kind: 'mute' | 'solo'; timer: number; fired: boolean };
        held.timer = window.setTimeout(() => {
          held.fired = true;
          getStage()?.pressButton(kind);
          modeHold(kind);
        }, MODE_HOLD_MS);
        mKey.current = held;
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        if (ownsSpace(e.target)) return;
        // Pas de defilement : la page ne defile jamais
        e.preventDefault();
        // Sur le MM-VOYAGER, son RUN/STOP (l'arpege) ; sur le MM-DECKS, rien encore
        if (focus.get() === 'voy') voyRun(getStage());
        else if (focus.get() !== 'dj' && focus.get() !== 'bass') runToggle(getStage());
        return;
      }
      // Touche physique aussi : sur un clavier AZERTY les chiffres sont en Maj
      const digit = DIGIT_KEYS.find((p) => p.key === e.key || e.code === `Digit${p.key}` || e.code === `Numpad${p.key}`);
      if (digit) {
        e.preventDefault();
        if (digit.page) page(digit.page, getStage());
        else if (focus.get() !== 'dj' && focus.get() !== 'bass') openToggle(getStage());
        return;
      }
      // O : OPEN de la machine qu'on utilise (le MM-DECKS n'a pas de capot ; le MM-BASS a le sien depuis le 2026-10-08)
      if ((e.key === 'o' || e.key === 'O') && focus.get() !== 'dj') {
        e.preventDefault();
        openToggle(getStage());
        return;
      }
      // E (2026-10-04) : EDIT de la machine qu'on utilise (la suite du MM-ARP, le motif du MM-RYTM)
      if ((e.key === 'e' || e.key === 'E') && (focus.get() === 'voy' || focus.get() === 'mm808')) {
        e.preventDefault();
        editToggle(focus.get() === 'voy' ? 'voy' : 'mm808', getStage());
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        resetView(getStage());
      }
    };
    const onUp = (e: KeyboardEvent): void => {
      const held = mKey.current;
      if (!held || !(e.code === 'KeyM' || e.key.toLowerCase() === 'm')) return;
      mKey.current = null;
      window.clearTimeout(held.timer);
      if (held.fired) return;
      if (held.kind === 'mute') muteToggle(getStage());
      else soloToggle(getStage());
    };
    // La fenetre perd le clavier pendant la tenue : rien ne part
    const onBlur = (): void => {
      if (mKey.current) window.clearTimeout(mKey.current.timer);
      mKey.current = null;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      onBlur();
    };
  }, [getStage]);
}
