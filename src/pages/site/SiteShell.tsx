/**
 * La coquille des pages du site hors des machines (2026-11-27, Mika : "je veux tout separer des machines") : en-tete
 * (logo, hamburger), fil d'Ariane, contenu, pied. /shows/ et /goodies/ l'utilisent ; rien de la machine n'est charge.
 */

import React, { useEffect, useRef, useState } from 'react';
import './site.css';

const LOGO = '/logo/mauditemachine-logo-gold.svg';
export const SITE_NAV: readonly [string, string][] = [
  ['Tracks', '/tracks/'],
  ['Mixtapes', '/mixtapes/'],
  ['Studio', '/studio/'],
  ['Goodies', '/goodies/'],
  ['Shows', '/shows/'],
  ['Press', '/presskit/'],
  ['Contact', '/contact/'],
];

/** Un lien sortant (nouvel onglet). */
export const Ext: React.FC<{ href: string; className?: string; children: React.ReactNode }> = ({ href, className, children }) => (
  <a href={href} className={className} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

/** Le titre d'une adresse du menu (fil d'Ariane). */
const labelOf = (href: string): string => SITE_NAV.find(([, h]) => h === href)?.[0] ?? '';

/**
 * 2026-11-28 (Mika : "je veux un fil ariane ! ... je veux un menu hamburger partout !!!" ; le bouton MACHINES "ca doit
 * etre dans le menu !") : l'en-tete n'a plus que le logo et le hamburger, sur toutes les tailles. Le menu plein ecran
 * liste les pages, puis MACHINES. Sous l'en-tete, le fil d'Ariane : Maudite Machine / la page.
 */
export const SiteShell: React.FC<{ current: string; children: React.ReactNode }> = ({ current, children }) => {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // La coquille de demarrage de la machine n'a rien a faire ici (prerendu ou navigation depuis la machine)
    document.getElementById('mm-boot')?.remove();
    document.documentElement.classList.add('mm-site-root');
    return () => document.documentElement.classList.remove('mm-site-root');
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.documentElement.classList.add('mms-menu-open');
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('mms-menu-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="mms">
      <header className="mms-head">
        <a href="/" className="mms-logo" aria-label="Maudite Machine, home">
          <img src={LOGO} alt="Maudite Machine" width={150} height={33} />
        </a>
        <button
          ref={btn}
          type="button"
          className="mms-burger"
          data-open={open ? '1' : '0'}
          aria-expanded={open}
          aria-controls="mms-menu"
          aria-label={open ? 'Close the menu' : 'Open the menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="mms-burger-word" aria-hidden="true">
            {open ? 'Close' : 'Menu'}
          </span>
          <span className="mms-burger-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      </header>
      <nav id="mms-menu" className="mms-menu" aria-label="Site" hidden={!open}>
        <ol className="mms-menu-list">
          {SITE_NAV.map(([label, href], i) => (
            <li key={href}>
              <a href={href} aria-current={href === current ? 'page' : undefined}>
                <span className="mms-menu-num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {label}
              </a>
            </li>
          ))}
          <li>
            <a href="/" className="mms-menu-machines">
              <span className="mms-menu-num" aria-hidden="true">
                {String(SITE_NAV.length + 1).padStart(2, '0')}
              </span>
              Machines <span aria-hidden="true">↗</span>
            </a>
          </li>
        </ol>
      </nav>
      <nav className="mms-crumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <a href="/">Maudite Machine</a>
          </li>
          <li aria-current="page">{labelOf(current)}</li>
        </ol>
      </nav>
      <main className="mms-main">
        {children}
        <footer className="mms-foot">
          <a href="/contact/">Booking</a>
          <a href="/techrider/">Tech rider</a>
          <a href="/press/">Press</a>
          <a href="/">MM-STUDIO</a>
        </footer>
      </main>
    </div>
  );
};
