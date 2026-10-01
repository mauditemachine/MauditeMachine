/**
 * Clavier global (spec 7.2, 13 et 20.6.2), sur le modele de
 * src/v3/hooks/useKeys.ts. A S D F frappent BD SD TOM CH (le son part a la
 * touche), 1 a 7 ouvrent les pages des pads en ordre de lecture (TRACKS,
 * MIXTAPES, PRESS, SHOWS, CONTACT, LABEL, SONAA ; la page deja ouverte se
 * ferme), 8 et O ouvrent ou referment la machine (le pad OPEN), Espace
 * lance ou arrete le sequenceur, R ramene la vue par defaut, Echap ferme
 * la section ouverte (sinon referme la vue eclatee, sinon deselectionne
 * l'instrument).
 * Rien ne part avec Alt, Ctrl ou Meta, dans un champ editable, ni sur une
 * repetition de touche. Espace est laisse au controle qui l'utilise deja
 * (bouton, lien, jumeau bouton ou lien) : il l'active, comme partout. Un
 * encodeur (role slider) n'a rien a faire d'Espace : il reste RUN/STOP.
 * Sans WebGL (page de repli, pas de machine) seul Echap reste.
 */

import { useEffect, useRef } from 'react';
import { escape, openToggle, padHit, page, resetView, runToggle } from '../actions';
import type { Stage } from '../scene/renderer';
import { PADS } from '../theme';

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

/** 'a' -> BD ... ; les majuscules (verrou) comptent aussi. */
const PAD_KEYS = new Map(PADS.flatMap((p) => (p.kind === 'voice' ? [[p.key.toLowerCase(), p.id] as const] : [])));
/** Les pads de navigation et OPEN : leur chiffre. */
const DIGIT_PADS = PADS.filter((p) => p.kind !== 'voice');

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
      const inst = PAD_KEYS.get(e.key.toLowerCase());
      if (inst) {
        e.preventDefault();
        padHit(inst, getStage());
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        if (ownsSpace(e.target)) return;
        // Pas de defilement : la page ne defile jamais
        e.preventDefault();
        runToggle(getStage());
        return;
      }
      // Touche physique aussi : sur un clavier AZERTY les chiffres sont en Maj
      const pad = DIGIT_PADS.find((p) => p.key === e.key || e.code === `Digit${p.key}` || e.code === `Numpad${p.key}`);
      if (pad) {
        e.preventDefault();
        if (pad.kind === 'page') page(pad.id, getStage());
        else openToggle(getStage());
        return;
      }
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        openToggle(getStage());
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
