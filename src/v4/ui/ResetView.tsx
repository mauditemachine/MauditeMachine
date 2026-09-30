/**
 * RESET VIEW (revision 2, spec 20.2.9) : un bouton HTML discret en bas a
 * droite, visible seulement quand la vue a quitte la vue par defaut
 * (state/view.ts) ; il y revient en 500 ms (easeOutCubic, coupe en reduced
 * motion). Hors de .v4-stage (frere dans .v4-root) : ses pointeurs
 * n'atteignent jamais l'orbite. Cache : transparent, invisible pour le
 * clavier et les lecteurs d'ecran (visibility), fondu de 150 ms (CSS).
 * La touche R et la double tape du fond font la meme chose.
 * Le bouton se cache quand la vue arrive : il ne garde jamais le focus
 * (revue de la revision 2). Un focus clavier passe au jumeau juste avant
 * lui dans l'ordre de tabulation (la derniere touche trig), la ou en etait
 * le clavier ; un focus laisse par un clic retourne au document (Espace
 * reste RUN/STOP, au lieu d'activer un jumeau).
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { resetView } from '../actions';
import type { Stage } from '../scene/renderer';
import { view } from '../state/view';
import { RESET_VIEW } from '../theme';

interface Props {
  getStage: () => Stage | null;
}

/** Le bouton a-t-il un focus clavier (focus-visible) ? Sans le selecteur : non. */
function keyboardFocus(el: HTMLElement): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return false;
  }
}

export const ResetView: React.FC<Props> = ({ getStage }) => {
  const moved = useSyncExternalStore(view.subscribe, view.get, view.get);
  const ref = useRef<HTMLButtonElement>(null);

  // Appele dans view.set, AVANT le rendu React qui pose aria-hidden et
  // visibility : le focus a deja quitte le bouton quand il se cache
  useEffect(
    () =>
      view.subscribe(() => {
        const b = ref.current;
        if (view.get() || !b || document.activeElement !== b) return;
        const keyboard = keyboardFocus(b);
        b.blur();
        if (!keyboard) return;
        const twins = document.querySelectorAll<HTMLElement>('.v4-twins .v4-twin');
        twins[twins.length - 1]?.focus({ preventScroll: true });
      }),
    []
  );

  return (
    <button
      ref={ref}
      type="button"
      className="v4-reset"
      data-visible={moved ? '1' : '0'}
      aria-label={RESET_VIEW.aria}
      aria-hidden={moved ? undefined : true}
      tabIndex={moved ? 0 : -1}
      onClick={() => resetView(getStage())}
    >
      {RESET_VIEW.label}
    </button>
  );
};

export default ResetView;
