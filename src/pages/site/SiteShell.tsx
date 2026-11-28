/**
 * La coquille des pages du site hors des machines (2026-11-27, Mika : "je veux tout separer des machines") : en-tete
 * (logo, pages, bouton MACHINES), contenu, pied. /shows/ et /goodies/ l'utilisent ; rien de la machine n'est charge.
 */

import React, { useEffect, useRef } from 'react';
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

export const SiteShell: React.FC<{ current: string; children: React.ReactNode }> = ({ current, children }) => {
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    // Au telephone, la barre des pages defile : la page courante visible
    const n = nav.current;
    const a = n?.querySelector<HTMLElement>('[aria-current="page"]');
    if (n && a && n.scrollWidth > n.clientWidth) n.scrollLeft = Math.max(0, a.offsetLeft - n.offsetLeft - 16);
  }, []);
  useEffect(() => {
    // La coquille de demarrage de la machine n'a rien a faire ici (prerendu ou navigation depuis la machine)
    document.getElementById('mm-boot')?.remove();
    document.documentElement.classList.add('mm-site-root');
    return () => document.documentElement.classList.remove('mm-site-root');
  }, []);
  return (
    <div className="mms">
      <header className="mms-head">
        <a href="/" className="mms-logo" aria-label="Maudite Machine, home">
          <img src={LOGO} alt="Maudite Machine" width={150} height={33} />
        </a>
        <nav className="mms-nav" aria-label="Site" ref={nav}>
          {SITE_NAV.map(([label, href]) => (
            <a key={href} href={href} aria-current={href === current ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <a href="/" className="mms-machines">
          Machines <span aria-hidden="true">↗</span>
        </a>
      </header>
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
