/**
 * Nav /v2 : bouton burger minimal (mono, blend difference) qui ouvre un
 * overlay plein ecran. Les entrees melangent ancres de la one-page et
 * pages dediees (Radar), toutes au meme niveau visuel — seule la
 * mecanique de navigation differe (scroll vs route).
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type Entry = { label: string; href?: string; to?: string };

/* Ordre des sections reelles, Radar (page dediee) juste avant Press Kit */
const ENTRIES: Entry[] = [
  { href: '#music', label: 'Music' },
  { href: '#mixtapes', label: 'Mixtapes' },
  { href: '#live', label: 'Live' },
  { href: '#gallery', label: 'Gallery' },
  { to: '/v2/radar', label: 'Radar' },
  { href: '#epk', label: 'Press Kit' },
  { href: '#contact', label: 'Contact' },
];

const SOCIALS = [
  { label: 'SoundCloud', href: 'https://www.soundcloud.com/mauditemachine/' },
  { label: 'Instagram', href: 'https://www.instagram.com/mauditemachine/' },
  { label: 'Bandcamp', href: 'https://mauditemachine.bandcamp.com/' },
  { label: 'Spotify', href: 'https://open.spotify.com/artist/2FHPGWPEBQbCsgkLP9uuI4' },
  { label: 'Beatport', href: 'https://www.beatport.com/artist/maudite-machine/1158916' },
  { label: 'YouTube', href: 'https://www.youtube.com/@mauditemachine-official' },
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

        <div className="v2-menu-socials">
          {SOCIALS.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer">
              {s.label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
};

export default Nav;
