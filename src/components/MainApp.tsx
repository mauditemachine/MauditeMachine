import React, { useState, useEffect, Suspense } from "react";
import SoundCloudPlayer from "./SoundCloudPlayer";
import { useApp } from "../context/AppContext";
import EventsDisplay from "./EventsDisplay";
import Store from "./Store";
import Message from "./Message";
import Goodies from "./Goodies";
import JellyfishBackground from "./JellyfishBackground";
import LiquidGlass from "./LiquidGlass";
import MobileMenu from "./ui/MobileMenu";
import { cn } from "../lib/cn";

// Presskit : lazy (360 lignes de contenu statique, gros chunk)
const Presskit = React.lazy(() => import("./Presskit"));

// Supprimer les erreurs SoundCloud/Bandcamp bruyantes
const suppressWidgetErrors = () => {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  let soundcloudErrorCount = 0;
  let hasShownSoundCloudGroupedError = false;

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
      soundcloudErrorCount++;
      if (!hasShownSoundCloudGroupedError && soundcloudErrorCount >= 5) {
        originalLog('%c🔇 SoundCloud widget errors suppressed (' + soundcloudErrorCount + ' errors)', 'color: #666; font-style: italic;');
        hasShownSoundCloudGroupedError = true;
      }
      return;
    }
    originalError.apply(console, args);
  };

  console.warn = (...args) => {
    const m = args[0]?.toString() || '';
    if (m.includes('SoundCloud') || m.includes('widget-') || m.includes('encrypted-media') ||
        m.includes('Permissions policy') || m.includes('Feature Policy') ||
        m.includes('bandcamp') || m.includes('bcbits.com')) return;
    originalWarn.apply(console, args);
  };

  console.log = (...args) => {
    const m = args[0]?.toString() || '';
    if (m.includes('SoundCloud Embed Player') || m.includes('widget-') ||
        m.includes('📦 Utilisation du cache') || m.includes('ErrorCollector: enabled') ||
        m.includes('initing HTMLEmbeddedPlayer3')) return;
    originalLog.apply(console, args);
  };
};

// Mapping des hashes legacy vers les nouvelles sections (backwards compat)
const HASH_MAP: Record<string, string> = {
  'home': 'hero',
  'presskit': 'presskit',
  'events': 'events',
  'store': 'store',
  'goodies': 'goodies',
  'message': 'message',
  'contact': 'message',
};

const SECTION_IDS = ['hero', 'presskit', 'events', 'store', 'goodies', 'message'];

export default function MainApp() {
  const { designMode, t } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bgUrl, setBgUrl] = useState<string>("");
  const [activeSection, setActiveSection] = useState("hero");
  const [messagePrefill, setMessagePrefill] = useState<{ subject: string; message: string } | null>(null);

  const handleBgChange = (url: string) => {
    setBgUrl(url);
    document.documentElement.style.setProperty('--track-bg', `url(${url})`);
    document.querySelector('.page')?.classList.add('track-active');
  };

  // Smooth scroll vers une section
  const scrollToSection = (id: string) => {
    const target = HASH_MAP[id] || id;
    const el = document.getElementById(target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${target}`);
    }
  };

  // Nav click : scroll vers section + menu close + FB pixel + prefill
  const handleSectionChange = (section: string, prefill?: { subject: string; message: string }) => {
    setMenuOpen(false);
    if (prefill) setMessagePrefill(prefill);
    else setMessagePrefill(null);

    scrollToSection(section);

    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'ViewContent', {
        content_name: section,
        content_category: 'Navigation',
      });
    }
  };

  // Tracking de la section active via IntersectionObserver (pour highlight nav)
  useEffect(() => {
    const sections = SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          setActiveSection(id);
          // Update URL hash without scroll
          if (id !== 'hero') {
            window.history.replaceState(null, '', `#${id}`);
          } else {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75] }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // Scroll initial vers hash si present
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setTimeout(() => scrollToSection(hash), 400);
    }
  }, []);

  // Init variable CSS track-bg
  useEffect(() => {
    document.documentElement.style.setProperty('--track-bg', 'none');
    document.querySelector('.page')?.classList.remove('track-active');
  }, []);

  // Suppression des erreurs externes (SoundCloud/Bandcamp)
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
        filename.includes('bandcamp') ||
        filename.includes('bcbits.com')
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
        reason.includes('bandcamp') ||
        reason.includes('bcbits.com')
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

  const displayBioText = t.home.bio;

  const navLinks = [
    { key: 'presskit', label: t.nav.presskit, section: 'presskit' },
    { key: 'events',   label: t.nav.events,   section: 'events' },
    { key: 'store',    label: t.nav.merch,    section: 'store' },
    { key: 'goodies',  label: t.nav.goodies,  section: 'goodies' },
    { key: 'message',  label: t.nav.contacts, section: 'message' },
  ];

  return (
    <>
      <LiquidGlass />

      <div
        className={cn(
          'page',
          designMode === 'alternate' ? 'design-alternate' : '',
        )}
        // Override layout CSS legacy : single-page scroll natif
        style={{ height: 'auto', minHeight: '100vh', overflow: 'visible', display: 'block' }}
      >
        {/* Menu mobile Pro Max */}
        <MobileMenu
          isOpen={menuOpen}
          onToggle={() => setMenuOpen((v) => !v)}
          onClose={() => setMenuOpen(false)}
          activeSection={activeSection}
          onNavigate={handleSectionChange}
          links={navLinks}
        />

        {/* HEADER — Logo gauche + Nav droite, fixed */}
        <header className="site-header liquid-glass">
          <div className="header-content">
            <div className="header-logo-left">
              <img
                src={import.meta.env.BASE_URL + "logo/mauditemachine-logo-gold.png"}
                style={{ filter: 'brightness(0) invert(1)' }}
                alt="Maudite Machine"
                onClick={() => scrollToSection('hero')}
              />
            </div>
            <div className="header-right">
              <nav className="header-nav-right">
                {navLinks.map((l) => (
                  <button
                    key={l.key}
                    className={activeSection === l.section ? 'active' : ''}
                    onClick={() => handleSectionChange(l.section)}
                  >
                    {l.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </header>

        {/* Fond video meduses — fixed, traverse toutes les sections */}
        <div className="global-bg">
          <JellyfishBackground />
        </div>

        {/* MAIN CONTENT — stack vertical single-page */}
        <main className="relative z-[1]" style={{ paddingTop: '90px', paddingBottom: '96px' }}>

          {/* HERO — logo + bio, plein ecran */}
          <section
            id="hero"
            className={cn(
              'scroll-mt-20',
              'min-h-[calc(100svh-186px)]',
              'flex flex-col items-center justify-center',
              'px-6 md:px-10 py-16 md:py-24',
            )}
          >
            <div className="max-w-5xl w-full flex flex-col items-center text-center">
              <img
                src={import.meta.env.BASE_URL + "logo/LogoStack.svg"}
                alt="Maudite Machine"
                className="w-[85vw] max-w-[780px] h-auto mb-8 md:mb-10 animate-fade-up"
                style={{
                  filter: 'brightness(0) invert(1)',
                  animationDelay: '100ms',
                  animationFillMode: 'both',
                }}
              />
              <p
                className={cn(
                  'max-w-2xl text-base md:text-lg lg:text-xl',
                  'leading-relaxed text-ink-85 font-body',
                  'animate-fade-up',
                )}
                style={{ animationDelay: '280ms', animationFillMode: 'both' }}
              >
                {displayBioText}
              </p>
            </div>
          </section>

          {/* PRESSKIT — bio, stats, performances, album, catalogue, label, contact */}
          <section id="presskit" className="scroll-mt-20">
            <Suspense fallback={null}>
              <Presskit onNavigateToMessage={() => scrollToSection('message')} />
            </Suspense>
          </section>

          {/* EVENTS */}
          <section
            id="events"
            className="scroll-mt-20 py-16 md:py-24 px-6 md:px-10 max-w-6xl mx-auto w-full"
          >
            <EventsDisplay showPastEventsButton={true} />
          </section>

          {/* STORE */}
          <section
            id="store"
            className="scroll-mt-20 py-16 md:py-24 px-6 md:px-10 max-w-6xl mx-auto w-full"
          >
            <Store onSectionChange={(s) => handleSectionChange(s)} />
          </section>

          {/* GOODIES */}
          <section
            id="goodies"
            className="scroll-mt-20 py-16 md:py-24 px-6 md:px-10 max-w-6xl mx-auto w-full"
          >
            <Goodies />
          </section>

          {/* MESSAGE (Contact) */}
          <section
            id="message"
            className="scroll-mt-20 py-16 md:py-24 px-6 md:px-10 max-w-3xl mx-auto w-full"
          >
            <Message
              prefillSubject={messagePrefill?.subject}
              prefillMessage={messagePrefill?.message}
            />
          </section>

        </main>

        {/* Logo VRSTL fixe en bas a droite */}
        <a href="https://vrstlrecords.com" target="_blank" rel="noreferrer" className="vrstl-fixed">
          <img src={import.meta.env.BASE_URL + "logo/vrstl-logo-clean.svg"} alt="VRSTL Records" />
        </a>

        {/* Lecteur audio — 1 seule instance, rendu son footer fixe lui-meme */}
        <SoundCloudPlayer onBackgroundChange={handleBgChange} />
      </div>
    </>
  );
}
