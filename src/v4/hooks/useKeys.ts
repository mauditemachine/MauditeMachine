/**
 * Clavier global (spec 7.2, 13 et 20.6.2), sur le modele de
 * src/v3/hooks/useKeys.ts. A S D F frappent BD SD CH OH, Z X C V frappent
 * CP TOM HT CY (les huit voix depuis le 2026-10-05, theme.ts PADS ; le son
 * part a la touche, en mode MUTE la voix se coupe). Sur le MM-RYTM
 * (2026-10-08, state/rytmPage.ts), hors EDIT et du mode presets : H passe
 * de la vue PAGE de l'ecran (par defaut) a HOME et retour, [ et ] passent a
 * la page d'avant ou d'apres (comme les touches de page). 1 a 5 ouvrent les pages (TRACKS, MIXTAPES,
 * SHOWS, PRESS, CONTACT ; la page deja ouverte se ferme), 6 et O ouvrent ou
 * referment la machine (le pad OPEN), Espace lance ou arrete le
 * sequenceur (RUN/STOP du MM-VOYAGER quand on l'utilise), R ramene la vue par defaut, Echap ferme
 * la section ouverte (sinon referme la vue eclatee, sinon deselectionne
 * l'instrument). E ouvre ou ferme l'editeur (EDIT) du MM-ARP ou du
 * MM-RYTM (2026-10-04). Gauche et droite passent d'une machine a l'autre
 * (2026-10-05), sauf sur un controle qui s'en sert (encodeur, onglets).
 * Rien ne part avec Alt, Ctrl ou Meta, dans un champ editable, ni sur une
 * repetition de touche. Espace est laisse au controle qui l'utilise deja
 * (bouton, lien, jumeau bouton ou lien) : il l'active, comme partout. Un
 * encodeur (role slider) n'a rien a faire d'Espace : il reste RUN/STOP.
 * Sans WebGL (page de repli, pas de machine) seul Echap reste.
 */

import { useEffect, useRef } from 'react';
import { editToggle, escape, openToggle, padHit, page, presetKey, resetView, runToggle, stepMachine, voyPad, voyRun } from '../actions';
import { presetMode } from '../state/presetMode';
import type { Stage } from '../scene/renderer';
import { editor } from '../state/editor';
import { focus } from '../state/focus';
import { rytmPage } from '../state/rytmPage';
import { section } from '../state/section';
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        if (escape()) e.preventDefault();
        return;
      }
      if (!on.current) return;
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
          rytmPage.toggleView();
          return;
        }
        if (e.code === 'BracketLeft' || e.code === 'BracketRight' || k === '[' || k === ']') {
          e.preventDefault();
          rytmPage.step(e.code === 'BracketLeft' || k === '[' ? -1 : 1);
          return;
        }
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
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [getStage]);
}
