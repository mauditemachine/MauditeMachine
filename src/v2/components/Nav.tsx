/**
 * Nav /v2 : bouton burger minimal (mono, blend difference) qui ouvre un
 * overlay plein ecran. Les entrees melangent ancres de la one-page et
 * pages dediees (Radar), toutes au meme niveau visuel — seule la
 * mecanique de navigation differe (scroll vs route).
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SocialLinks from './SocialLinks';

type Entry = { label: string; href?: string; to?: string };

/* Ordre des sections reelles, Radar (page dediee) juste avant Press Kit */
const ENTRIES: Entry[] = [
  { href: '#music', label: 'Music' },
  { href: '#mixtapes', label: 'Mixtapes' },
  { href: '#live', label: 'Live' },
  { href: '#gallery', label: 'Gallery' },
  { to: '/v2/radar', label: 'Radar' },
  { href: '#merch', label: 'Merch' },
  { href: '#epk', label: 'Press Kit' },
  { href: '#contact', label: 'Contact' },
];


const Nav: React.FC = () => {
  const [open, setOpen] = useState(false);

  // Le jump d'ancre natif est avale tant que body est en overflow: hidden
  // (menu ouvert) : on restaure le scroll puis on navigue a la main.
  const go = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setOpen(false);
    document.body.style.overflow = '';
    const el = document.querySelector(href);
    if (!el) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = window.scrollY;
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    history.replaceState(null, '', href);
    if (smooth) {
      // Filet : certains environnements n'animent pas le smooth scroll
      window.setTimeout(() => {
        if (Math.abs(window.scrollY - from) < 2) el.scrollIntoView({ behavior: 'instant' });
      }, 400);
    }
  };

  // Echap ferme, et le scroll du fond est gele tant que l'overlay est ouvert
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="v2-burger"
        aria-expanded={open}
        aria-controls="v2-menu"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Close' : 'Menu'}
      </button>

      <nav id="v2-menu" className={`v2-menu${open ? ' is-open' : ''}`} aria-hidden={!open}>
        {ENTRIES.map((e) =>
          e.to ? (
            <Link
              key={e.to}
              className="v2-menu-link"
              to={e.to}
              onClick={() => {
                setOpen(false);
                document.body.style.overflow = '';
              }}
            >
              {e.label}
            </Link>
          ) : (
            <a
              key={e.href}
              className="v2-menu-link"
              href={e.href}
              onClick={(ev) => go(ev, e.href!)}
            >
              {e.label}
            </a>
          )
        )}

        <SocialLinks className="v2-menu-socialicons" />
      </nav>
    </>
  );
};

export default Nav;
