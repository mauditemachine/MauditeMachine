/**
 * En-tete mobile (2026-10-01, demande de Mika : le menu prenait trop de
 * place dans le Dock) : le logo a gauche (retour a la vue d'arrivee), un
 * hamburger a droite, 52 px par-dessus le haut de la scene, sur un degrade.
 * Le hamburger deroule le menu plein ecran sous l'en-tete (ui/MenuSheet.tsx,
 * le meme que sur desktop depuis le 2026-10-04). Un choix ferme le menu ;
 * Echap ou la croix aussi (le focus revient au hamburger).
 */

import React, { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { appearance } from '../state/appearance';
import { goHome } from './Header';
import { MenuSheet } from './MenuSheet';

interface Props {
  getStage: () => Stage | null;
}

export const MobileHeader: React.FC<Props> = ({ getStage }) => {
  const [menu, setMenu] = useState(false);
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);
  const burgerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((refocus: boolean): void => {
    setMenu(false);
    if (refocus) burgerRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <header className="v4-mhead" data-menu={menu ? '1' : '0'}>
        <a
          className="v4-logo"
          href="/"
          aria-label="Maudite Machine, back to the machine"
          onClick={(e) => {
            e.preventDefault();
            setMenu(false);
            goHome(getStage());
          }}
        >
          <span className="v4-logotype" aria-hidden="true" />
          <img src={look === 'light' ? '/logo/mauditemachine-logo-ink.svg' : '/logo/mauditemachine-logo-gold.svg'} alt="Maudite Machine" width={104} height={23} />
        </a>
        <button
          ref={burgerRef}
          type="button"
          className="v4-burger"
          data-open={menu ? '1' : '0'}
          aria-expanded={menu}
          aria-controls="v4-mmenu"
          aria-label={menu ? 'Close the menu' : 'Open the menu'}
          data-press-button=""
          onClick={() => setMenu((m) => !m)}
        >
          <span className="v4-burger-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      </header>
      <MenuSheet getStage={getStage} open={menu} onClose={close} variant="mobile" />
    </>
  );
};

export default MobileHeader;
