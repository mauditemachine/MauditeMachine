/**
 * En-tete fin (2026-10-01, desktop seulement) : le logo Maudite Machine a
 * gauche (retour a la vue d'arrivee : sections et capot fermes, vue
 * recentree), le bouton MENU a droite (2026-10-04, Mika : "le menu desktop
 * aussi plus beau comme le mobile") : il ouvre le menu plein ecran,
 * ui/MenuSheet.tsx, le meme qu'au telephone, a l'echelle d'un ecran. Chaque
 * page actionne le bouton de la machine (actions.page, comme le pad, avec
 * la trace) ; GOODIES, MERCH et STUDIO ouvrent leur section (le capot,
 * avant le 2026-10-04). 52 px, transparent sur un degrade : la machine
 * reste le sujet.
 */

import React, { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { closeSection, openSection, openToggle, resetView } from '../actions';
import type { Stage } from '../scene/renderer';
import { appearance } from '../state/appearance';
import { explode, voyExplode } from '../state/explode';
import { focus, VOYAGER } from '../state/focus';
import { section } from '../state/section';
import { MOBILE_QUERY, type PageId } from '../theme';
import { MenuSheet } from './MenuSheet';

export type HoodId = 'goodies' | 'merch' | 'studio';

/** Les liens du menu, partages avec l'en-tete mobile (ui/MobileHeader.tsx). */
export const PAGE_LINKS: readonly { id: PageId; label: string }[] = [
  { id: 'tracks', label: 'Tracks' },
  { id: 'mixtapes', label: 'Mixtapes' },
  { id: 'shows', label: 'Shows' },
  { id: 'press', label: 'Press' },
  { id: 'contact', label: 'Contact' },
];

export const HOOD_LINKS: readonly { id: HoodId; label: string }[] = [
  { id: 'goodies', label: 'Goodies' },
  { id: 'merch', label: 'Merch' },
  { id: 'studio', label: 'Studio' },
];

/**
 * Le logo : retour a la vue d'arrivee (sections et capots fermes, vue
 * recentree) ; deux machines : la vue d'ensemble sur desktop, la 808 au
 * telephone.
 */
export function goHome(stage: Stage | null): void {
  closeSection();
  if (explode.get() === 'open') openToggle(stage, 'mm808');
  if (voyExplode.get() === 'open') openToggle(stage, 'voy');
  resetView(stage);
  if (VOYAGER) focus.set(window.matchMedia(MOBILE_QUERY).matches ? 'mm808' : 'all');
}

/**
 * GOODIES, MERCH, STUDIO : leur section, comme les autres pages. Leurs puces
 * ont quitte les cartes le 2026-10-04 (Mika : "a la place des liens de
 * mauditemachine qui sont deja dans le header, un systeme de Tweaks") :
 * plus de capot a ouvrir d'abord.
 */
export function openHood(id: HoodId, _stage: Stage | null): void {
  if (section.get() === id) closeSection();
  else openSection(id);
}

interface Props {
  getStage: () => Stage | null;
}

export const Header: React.FC<Props> = ({ getStage }) => {
  const [menu, setMenu] = useState(false);
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((refocus: boolean): void => {
    setMenu(false);
    if (refocus) btnRef.current?.focus({ preventScroll: true });
  }, []);

  const onHome = (e: React.MouseEvent): void => {
    e.preventDefault();
    setMenu(false);
    goHome(getStage());
  };

  return (
    <>
      <header className="v4-header" data-menu={menu ? '1' : '0'}>
        <a className="v4-logo" href="/" aria-label="Maudite Machine, back to the machine" onClick={onHome}>
          <span className="v4-logotype" aria-hidden="true" />
          <img src={look === 'light' ? '/logo/mauditemachine-logo-ink.svg' : '/logo/mauditemachine-logo-gold.svg'} alt="Maudite Machine" width={118} height={26} />
        </a>
        <button
          ref={btnRef}
          type="button"
          className="v4-menu-btn"
          data-open={menu ? '1' : '0'}
          aria-expanded={menu}
          aria-controls="v4-mmenu"
          aria-label={menu ? 'Close the menu' : 'Open the menu'}
          data-press-button=""
          onClick={() => setMenu((m) => !m)}
        >
          <span className="v4-menu-word" aria-hidden="true">
            {menu ? 'Close' : 'Menu'}
          </span>
          <span className="v4-burger-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      </header>
      <MenuSheet getStage={getStage} open={menu} onClose={close} variant="desk" />
    </>
  );
};

export default Header;
