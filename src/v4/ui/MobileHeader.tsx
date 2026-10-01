/**
 * En-tete mobile (2026-10-01, demande de Mika : le menu prenait trop de
 * place dans le Dock) : le logo a gauche (retour a la vue d'arrivee), un
 * hamburger a droite, 52 px par-dessus le haut de la scene, sur un degrade.
 * Le hamburger deroule le menu sous l'en-tete : les cinq pages, GOODIES,
 * MERCH et STUDIO, ouvrir ou fermer la machine, recentrer la vue, et
 * Dark / Light. Un choix ferme le menu ; Echap, la croix ou une tape
 * dehors aussi (le focus revient au hamburger). Memes actions que
 * l'en-tete desktop (ui/Header.tsx).
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { openToggle, page, resetView } from '../actions';
import type { Stage } from '../scene/renderer';
import { appearance } from '../state/appearance';
import { explode } from '../state/explode';
import { section } from '../state/section';
import { AppearanceToggle } from './AppearanceToggle';
import { HOOD_LINKS, PAGE_LINKS, goHome, openHood } from './Header';

const ICONS: Readonly<Record<string, string>> = {
  tracks: 'fa-solid fa-compact-disc',
  mixtapes: 'fa-solid fa-record-vinyl',
  shows: 'fa-solid fa-calendar-days',
  press: 'fa-solid fa-file-lines',
  contact: 'fa-solid fa-envelope',
  goodies: 'fa-solid fa-gift',
  merch: 'fa-solid fa-shirt',
  studio: 'fa-solid fa-microchip',
};

const Icon: React.FC<{ name: string }> = ({ name }) => <i className={`${name} v4-fa`} aria-hidden="true" />;

interface Props {
  getStage: () => Stage | null;
}

export const MobileHeader: React.FC<Props> = ({ getStage }) => {
  const [menu, setMenu] = useState(false);
  const open = useSyncExternalStore(section.subscribe, section.get, section.get);
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);
  const ex = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const opened = ex === 'opening' || ex === 'open';
  const burgerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  // Menu ouvert : le focus sur le premier lien, Echap le ferme
  useEffect(() => {
    if (!menu) return undefined;
    menuRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setMenu(false);
      burgerRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [menu]);

  /** Un choix du menu : il se ferme, puis l'action part. */
  const pick = (fn: () => void) => (): void => {
    setMenu(false);
    fn();
  };

  return (
    <>
      <header className="v4-mhead">
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
      {menu && <div className="v4-mmenu-veil" aria-hidden="true" onPointerDown={() => setMenu(false)} />}
      <nav ref={menuRef} id="v4-mmenu" className="v4-mmenu" aria-label="Main" hidden={!menu}>
        <ul className="v4-mmenu-list">
          {PAGE_LINKS.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className="v4-mmenu-link"
                data-active={open === l.id ? '1' : '0'}
                aria-expanded={open === l.id}
                aria-controls={`v4-section-${l.id}`}
                onClick={pick(() => page(l.id, getStage()))}
              >
                <Icon name={ICONS[l.id]} />
                <span>{l.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <ul className="v4-mmenu-list v4-mmenu-hood">
          {HOOD_LINKS.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className="v4-mmenu-link"
                data-active={open === l.id ? '1' : '0'}
                aria-expanded={open === l.id}
                aria-controls={`v4-section-${l.id}`}
                onClick={pick(() => openHood(l.id, getStage()))}
              >
                <Icon name={ICONS[l.id]} />
                <span>{l.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="v4-mmenu-row">
          <button type="button" className="v4-mmenu-open" data-open={opened ? '1' : '0'} aria-pressed={opened} onClick={pick(() => openToggle(getStage()))}>
            {opened ? 'Close the machine' : 'Open the machine'}
          </button>
          <button type="button" className="v4-mmenu-reset" onClick={pick(() => resetView(getStage()))}>
            <Icon name="fa-solid fa-arrows-rotate" />
            <span>Reset view</span>
          </button>
        </div>
        <AppearanceToggle />
      </nav>
    </>
  );
};

export default MobileHeader;
