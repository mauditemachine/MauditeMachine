/**
 * Clavier global (spec 7.2 et 13), sur le modele de src/v3/hooks/useKeys.ts.
 * A S D F frappent BD SD TOM CH (le son part a la touche, sans charley
 * ouvert : pas de maintien au clavier), Espace lance ou arrete le
 * sequenceur, 1 a 5 ouvrent TRACKS a CONTACT (ou ferment la section deja
 * ouverte), O ouvre ou referme la machine, Echap ferme la section ouverte
 * (sinon referme la vue eclatee, sinon deselectionne l'instrument).
 * Rien ne part avec Alt, Ctrl ou Meta, dans un champ editable, ni sur une
 * repetition de touche. Espace est laisse au controle qui l'utilise deja
 * (bouton, lien, jumeau bouton ou lien) : il l'active, comme partout. Un
 * potard (role slider) n'a rien a faire d'Espace : il reste RUN/STOP.
 * Sans WebGL (page de repli, pas de machine) seul Echap reste.
 */

import { useEffect, useRef } from 'react';
import { escape, knob, openToggle, padDown, runToggle } from '../actions';
import type { Stage } from '../scene/renderer';
import { NAV_KNOBS, PADS } from '../theme';

const isEditable = (t: EventTarget | null): boolean => {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
};

/** Un controle qui fait deja quelque chose d'Espace (pas les potards : fleches seulement). */
const ownsSpace = (t: EventTarget | null): boolean => {
  if (!(t instanceof Element)) return false;
  return t.closest('button, a[href], [role="button"], summary, input, textarea, select, [contenteditable="true"]') !== null;
};

/** 'a' -> BD ... ; les majuscules (verrou) comptent aussi. */
const PAD_KEYS = new Map(PADS.map((p) => [p.key.toLowerCase(), p.id] as const));

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
        padDown(inst, getStage());
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        if (ownsSpace(e.target)) return;
        // Pas de defilement : la page ne defile jamais
        e.preventDefault();
        runToggle();
        return;
      }
      // Touche physique aussi : sur un clavier AZERTY les chiffres sont en Maj
      const nav = NAV_KNOBS.find((k) => k.key === e.key || e.code === `Digit${k.key}` || e.code === `Numpad${k.key}`);
      if (nav) {
        e.preventDefault();
        knob(nav.id);
        return;
      }
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        openToggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [getStage]);
}
