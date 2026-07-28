/**
 * Layout — shell persistant pour toutes les pages.
 *
 * Contient :
 * - Header fixe avec NavLink (router-based, plus de scroll-to-section)
 * - MobileMenu hamburger
 * - JellyfishBackground (video meduses, fixed z-0, persiste entre routes)
 * - SoundCloudPlayer (pilule flottante bottom-center, persiste -> la
 *   musique continue quand on change de page)
 * - VRSTL logo flottant bottom-right
 * - <Outlet /> pour le contenu de la page courante
 */

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import SoundCloudPlayer from './SoundCloudPlayer';
import JellyfishBackground from './JellyfishBackground';
import LiquidGlass from './LiquidGlass';
import MobileMenu from './ui/MobileMenu';
import SocialSidebar from './ui/SocialSidebar';
import { useApp } from '../context/AppContext';
import { useSEO } from '../lib/seo';
import { cn } from '../lib/cn';

// Suppression silencieuse des erreurs SoundCloud / Bandcamp bruyantes
const suppressWidgetErrors = () => {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    const stack = args[1]?.stack || '';
    if (
      message.includes('createPattern') ||
      message.includes('canvas element with a width or height of 0') ||
      message.includes('widget-') ||
      message.includes('AbortError') ||
      message.includes('Script error') ||
      message.includes('InvalidStateError') ||
      message.includes('Permissions policy violation') ||
      message.includes('encrypted-media') ||
      message.includes('Failed to execute') ||
      message.includes('CanvasRenderingContext2D') ||
      message.includes('signal is aborted') ||
      message.includes('Uncaught') ||
      stack.includes('widget-') ||
      stack.includes('soundcloud')
    ) {
      return;
    }
    originalError.apply(console, args);
  };

  console.warn = (...args) => {
    const m = args[0]?.toString() || '';
    if (
      m.includes('SoundCloud') ||
      m.includes('widget-') ||
      m.includes('encrypted-media') ||
      m.includes('Permissions policy') ||
      m.includes('Feature Policy') ||
      m.includes('bandcamp') ||
      m.includes('bcbits.com')
    )
      return;
    originalWarn.apply(console, args);
  };

  console.log = (...args) => {
    const m = args[0]?.toString() || '';
    if (
      m.includes('SoundCloud Embed Player') ||
      m.includes('widget-') ||
      m.includes('📦 Utilisation du cache') ||
      m.includes('ErrorCollector: enabled') ||
      m.includes('initing HTMLEmbeddedPlayer3')
    )
      return;
    originalLog.apply(console, args);
  };
};

const Layout: React.FC = () => {
  const { designMode, t } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // SEO : synchronise title / description / canonical / OG / hreflang / JSON-LD
  // a chaque changement de route ou de langue.
  useSEO();
  const [menuOpen, setMenuOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bgUrl, setBgUrl] = useState<string>('');

  const handleBgChange = (url: string) => {
    setBgUrl(url);
    document.documentElement.style.setProperty('--track-bg', `url(${url})`);
    document.querySelector('.page')?.classList.add('track-active');
  };

  const navLinks = [
    { key: 'about',     label: t.nav.presskit,  to: '/about' },
    { key: 'shows',     label: t.nav.events,    to: '/shows' },
    { key: 'merch',     label: t.nav.merch,     to: '/merch' },
    { key: 'goodies',   label: t.nav.goodies,   to: '/goodies' },
    { key: 'techrider', label: t.nav.techrider, to: '/techrider' },
    { key: 'contact',   label: t.nav.contacts,  to: '/contact' },
  ];

  // Init suppression erreurs externes une fois
  useEffect(() => {
    suppressWidgetErrors();

    const handleError = (event: ErrorEvent) => {
      const message = event.message || '';
      const filename = event.filename || '';
      if (
        message.includes('createPattern') ||
        message.includes('canvas element') ||
        message.includes('AbortError') ||
        message.includes('Script error') ||
        message.includes('bandcamp') ||
        message.includes('bcbits.com') ||
        filename.includes('widget-') ||
        filename.includes('soundcloud') ||
        filename.includes('bandcamp')
      ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.toString() || '';
      if (
        reason.includes('AbortError') ||
        reason.includes('signal is aborted') ||
        reason.includes('widget-') ||
        reason.includes('soundcloud') ||
        reason.includes('bandcamp')
      ) {
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Init CSS var + clear body overflow stale
  useEffect(() => {
    document.documentElement.style.setProperty('--track-bg', 'none');
    document.querySelector('.page')?.classList.remove('track-active');
  }, []);

  // Garde body overflow propre quand on switche page (Store / Goodies / etc.
  // peuvent setter overflow:hidden via lightbox/modals)
  useEffect(() => {
    if (location.pathname !== '/' && document.body.style.overflow === 'hidden') {
      // Si on n'est pas sur Home et que body est lock par autre chose, libere
      // (Home gere son propre lock via useEffect dans HomePage)
    }
  }, [location.pathname]);

  // MobileMenu attend des links de format { key, label, section }, on adapte
  const mobileLinks = navLinks.map((l) => ({
    key: l.key,
    label: l.label,
    section: l.to.replace(/^\//, ''),
  }));

  // activeSection pour MobileMenu : derive du pathname courant
  const currentSection = location.pathname === '/' ? 'home' : location.pathname.replace(/^\//, '');

  return (
    <>
      <LiquidGlass />

      <div className={cn('page', designMode === 'alternate' ? 'design-alternate' : '')}>
        <MobileMenu
          isOpen={menuOpen}
          onToggle={() => setMenuOpen((v) => !v)}
          onClose={() => setMenuOpen(false)}
          activeSection={currentSection}
          onNavigate={(section) => {
            setMenuOpen(false);
            const target = section === 'home' ? '/' : `/${section}`;
            navigate(target);
          }}
          links={mobileLinks}
        />

        {/* HEADER fixe, NavLink router-based, padding responsive (16px mobile / 48px desktop / 64px large) */}
        <header
          className="site-header px-4 md:px-12 lg:px-16"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            height: 64,
            background: 'rgba(0, 0, 0, 0.15)',
            backdropFilter: 'blur(12px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="h-full max-w-[1600px] mx-auto w-full flex items-center justify-between gap-6">
            {/* Logo gauche -> Home */}
            <NavLink
              to="/"
              aria-label={t.a11y.homeLink}
              className="h-full flex items-center shrink-0 p-0 m-0 cursor-pointer hover:opacity-70 transition-opacity leading-none no-underline"
              style={{ color: '#fff', textDecoration: 'none' }}
            >
              <img
                src={import.meta.env.BASE_URL + 'logo/mauditemachine-logo-gold.png'}
                alt="Maudite Machine"
                className="h-6 w-auto block m-0 p-0 align-middle"
                style={{ filter: 'brightness(0) invert(1)', display: 'block' }}
              />
            </NavLink>

            {/* Nav droite — NavLink */}
            <nav className="h-full hidden max-[900px]:hidden min-[901px]:flex items-center gap-6">
              {navLinks.map((l) => (
                <NavLink
                  key={l.key}
                  to={l.to}
                  className={({ isActive }) =>
                    cn(
                      'h-full inline-flex items-center',
                      'font-body text-[13px] font-extrabold uppercase tracking-wide',
                      'leading-none m-0 px-0',
                      'transition-colors duration-300 no-underline',
                      isActive ? 'text-white' : 'text-white/80 hover:text-white',
                    )
                  }
                  style={{ textDecoration: 'none' }}
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        {/* Fond video meduses (fixed z-0, persiste entre toutes les routes) */}
        <div className="global-bg">
          <JellyfishBackground />
        </div>

        {/* MAIN — contenu de la page courante via Outlet.
            md:pr-16 sur les pages de contenu : reserve la colonne de droite
            a la SocialSidebar (fixed right-6 z-50). Sans ca, sur ecran
            <= ~1400px la sidebar recouvrait les elements cliquables au bord
            droit (ex: le "+" des accordeons Goodies ouvrait Apple Music).
            La home reste sans padding : son contenu est centre plein ecran. */}
        <main className={cn('relative z-[1]', location.pathname !== '/' && 'md:pr-16')}>
          <Outlet />
        </main>

        {/* Logo VRSTL fixe bottom-right (persiste) */}
        <a href="https://vrstlrecords.com" target="_blank" rel="noreferrer" className="vrstl-fixed">
          <img src={import.meta.env.BASE_URL + 'logo/vrstl-logo-clean.svg'} alt="VRSTL Records" />
        </a>

        {/* Social sidebar fixe right (desktop only) — persiste entre toutes les pages */}
        <SocialSidebar />

        {/* Lecteur audio — UNE SEULE INSTANCE persistante au niveau Layout.
            Ne se demonte JAMAIS pendant la navigation entre pages.
            La musique continue de jouer quand on switche /about -> /shows etc. */}
        <SoundCloudPlayer onBackgroundChange={handleBgChange} />
      </div>
    </>
  );
};

export default Layout;
