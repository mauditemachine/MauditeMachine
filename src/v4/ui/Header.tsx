/**
 * En-tete fin (2026-10-01, desktop seulement) : le logo Maudite Machine a
 * gauche (retour a la vue d'arrivee : sections et capot fermes, vue
 * recentree), le menu a droite. Chaque lien actionne le bouton de la
 * machine : une page enfonce son pad et ouvre sa section (actions.page,
 * comme le pad, avec la trace) ; GOODIES, MERCH et STUDIO ouvrent d'abord
 * le capot, puis la section de leur puce. 52 px, transparent sur un
 * degrade : la machine reste le sujet.
 */

import React, { useSyncExternalStore } from 'react';
import { closeSection, openSection, openToggle, page, resetView } from '../actions';
import type { Stage } from '../scene/renderer';
import { appearance } from '../state/appearance';
import { explode } from '../state/explode';
import { section } from '../state/section';
import { EXPLODE, type PageId } from '../theme';
import { AppearanceToggle } from './AppearanceToggle';

type HoodId = 'goodies' | 'merch' | 'studio';

const PAGE_LINKS: readonly { id: PageId; label: string }[] = [
  { id: 'tracks', label: 'Tracks' },
  { id: 'mixtapes', label: 'Mixtapes' },
  { id: 'press', label: 'Press' },
  { id: 'shows', label: 'Shows' },
  { id: 'contact', label: 'Contact' },
];

const HOOD_LINKS: readonly { id: HoodId; label: string }[] = [
  { id: 'goodies', label: 'Goodies' },
  { id: 'merch', label: 'Merch' },
  { id: 'studio', label: 'Studio' },
];

/** Le capot s'ouvre : la section part quand les puces sont decouvertes. */
const HOOD_DELAY_MS = Math.round(EXPLODE.ms * EXPLODE.chipsFrom);

interface Props {
  getStage: () => Stage | null;
}

export const Header: React.FC<Props> = ({ getStage }) => {
  const open = useSyncExternalStore(section.subscribe, section.get, section.get);
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);

  const onHome = (e: React.MouseEvent): void => {
    e.preventDefault();
    closeSection();
    if (explode.get() === 'open') openToggle(getStage());
    resetView(getStage());
  };

  const onHood = (id: HoodId): void => {
    const s = explode.get();
    if (s === 'closed') {
      if (openToggle(getStage())) window.setTimeout(() => openSection(id), HOOD_DELAY_MS);
      return;
    }
    if (section.get() === id) closeSection();
    else openSection(id);
  };

  return (
    <header className="v4-header">
      <a className="v4-logo" href="/" aria-label="Maudite Machine, back to the machine" onClick={onHome}>
        <img src={look === 'light' ? '/logo/mauditemachine-logo-ink.svg' : '/logo/mauditemachine-logo-gold.svg'} alt="Maudite Machine" width={118} height={26} />
      </a>
      <nav className="v4-nav" aria-label="Main">
        <ul>
          {PAGE_LINKS.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className="v4-nav-link"
                aria-expanded={open === l.id}
                aria-controls={`v4-section-${l.id}`}
                data-press-button={l.id === 'press' ? '' : undefined}
                onClick={() => page(l.id, getStage())}
              >
                {l.label}
              </button>
            </li>
          ))}
          <li className="v4-nav-sep" aria-hidden="true" />
          {HOOD_LINKS.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className="v4-nav-link"
                aria-expanded={open === l.id}
                aria-controls={`v4-section-${l.id}`}
                onClick={() => onHood(l.id)}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <AppearanceToggle />
    </header>
  );
};

export default Header;
