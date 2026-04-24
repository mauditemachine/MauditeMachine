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
import SectionHeader from "./ui/SectionHeader";
import EditorialPhoto from "./ui/EditorialPhoto";
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
  'events': 'shows',
  'shows': 'shows',
  'store': 'store',
  'goodies': 'goodies',
  'techrider': 'techrider',
  'message': 'message',
  'contact': 'message',
};

const SECTION_IDS = ['hero', 'presskit', 'shows', 'store', 'goodies', 'techrider', 'message'];

// Type Wall of Fame (past-events.json)
interface PastShow {
  name: string;
  date: string;
  venue: string;
  city: string;
  lineup?: string[];
  facebook_event?: string;
}
interface YearArchive {
  year: number;
  shows: PastShow[];
}

const TECH_RIDER_PDF = `${import.meta.env.BASE_URL}Presskit_Maudite_Machine_2026.pdf`;

export default function MainApp() {
  const { designMode, t } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bgUrl, setBgUrl] = useState<string>("");
  const [activeSection, setActiveSection] = useState("hero");
  const [messagePrefill, setMessagePrefill] = useState<{ subject: string; message: string } | null>(null);
  const [showsArchive, setShowsArchive] = useState<YearArchive[]>([]);

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

  // Init variable CSS track-bg + garde body overflow propre
  useEffect(() => {
    document.documentElement.style.setProperty('--track-bg', 'none');
    document.querySelector('.page')?.classList.remove('track-active');
  }, []);

  // One-shot : clear body overflow au mount (au cas ou Store l'aurait laisse a 'auto')
  useEffect(() => {
    if (document.body.style.overflow === 'auto') {
      document.body.style.overflow = '';
    }
  }, []);

  // Load past-events.json pour Wall of Fame typographique + clickable
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}past-events.json`)
      .then((r) => r.json())
      .then((data: { events: YearArchive[] }) => {
        if (cancelled) return;
        const sorted = (data.events || [])
          .slice()
          .sort((a, b) => b.year - a.year)
          .map((y) => ({
            ...y,
            shows: y.shows
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date)),
          }));
        setShowsArchive(sorted);
      })
      .catch(() => {});
    return () => { cancelled = true; };
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
    { key: 'presskit',  label: t.nav.presskit,  section: 'presskit' },
    { key: 'shows',     label: t.nav.events,    section: 'shows' },
    { key: 'store',     label: t.nav.merch,     section: 'store' },
    { key: 'goodies',   label: t.nav.goodies,   section: 'goodies' },
    { key: 'techrider', label: t.nav.techrider, section: 'techrider' },
    { key: 'message',   label: t.nav.contacts,  section: 'message' },
  ];

  return (
    <>
      <LiquidGlass />

      <div
        className={cn(
          'page',
          designMode === 'alternate' ? 'design-alternate' : '',
        )}
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

        {/* HEADER — hauteur fixe h-16, tout centre via flex items-center */}
        <header
          className="site-header"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            height: 64,
            padding: '0 32px',
            background: 'rgba(0, 0, 0, 0.15)',
            backdropFilter: 'blur(12px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="h-full max-w-[1600px] mx-auto w-full flex items-center justify-between gap-6">
            {/* Logo gauche — container flex centre, img block sans marges */}
            <button
              type="button"
              onClick={() => scrollToSection('hero')}
              aria-label={t.a11y.homeLink}
              className="h-full flex items-center shrink-0 p-0 m-0 bg-transparent border-0 cursor-pointer hover:opacity-70 transition-opacity leading-none"
            >
              <img
                src={import.meta.env.BASE_URL + "logo/mauditemachine-logo-gold.png"}
                alt="Maudite Machine"
                className="h-6 w-auto block m-0 p-0 align-middle"
                style={{ filter: 'brightness(0) invert(1)', display: 'block' }}
              />
            </button>

            {/* Nav droite — buttons h-full items-center, font-semibold tracking-wide */}
            <nav className="h-full hidden max-[900px]:hidden min-[901px]:flex items-center gap-6">
              {navLinks.map((l) => {
                const active = activeSection === l.section;
                return (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => handleSectionChange(l.section)}
                    className={cn(
                      'h-full inline-flex items-center',
                      'font-body text-sm font-extrabold uppercase tracking-wide',
                      'leading-none m-0 px-0',
                      'bg-transparent border-0 cursor-pointer',
                      'transition-colors duration-300',
                      active ? 'text-white' : 'text-white/80 hover:text-white',
                    )}
                  >
                    {l.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* Fond video meduses — fixed, traverse toutes les sections */}
        <div className="global-bg">
          <JellyfishBackground />
        </div>

        {/* MAIN CONTENT — stack vertical single-page */}
        <main className="relative z-[1]" style={{ paddingTop: '80px', paddingBottom: '96px' }}>

          {/* HERO — logo + bio alignee gauche, article magazine */}
          <section
            id="hero"
            className={cn(
              'scroll-mt-20',
              'min-h-[calc(100svh-186px)]',
              'flex flex-col justify-center',
              'px-6 md:px-10 py-16 md:py-24',
              'max-w-7xl mx-auto w-full',
            )}
          >
            <img
              src={import.meta.env.BASE_URL + "logo/LogoStack.svg"}
              alt="Maudite Machine"
              className="w-[85vw] max-w-[780px] h-auto mb-10 md:mb-14 animate-fade-up"
              style={{
                filter: 'brightness(0) invert(1)',
                animationDelay: '100ms',
                animationFillMode: 'both',
              }}
            />
            <p
              className={cn(
                'max-w-3xl',
                'text-xl md:text-2xl lg:text-[1.75rem]',
                'font-light leading-relaxed text-left',
                'text-ink-95 font-body',
                '[text-shadow:_0_2px_12px_rgba(0,0,0,0.5)]',
                'animate-fade-up',
              )}
              style={{ animationDelay: '280ms', animationFillMode: 'both' }}
            >
              {displayBioText}
            </p>
          </section>

          {/* PRESSKIT — bio, stats, performances, album, catalogue, label, contact */}
          <section id="presskit" className="scroll-mt-20">
            <Suspense fallback={null}>
              <Presskit onNavigateToMessage={() => scrollToSection('message')} />
            </Suspense>
          </section>

          {/* SHOWS — upcoming events + Wall of Fame typographic archive */}
          <section
            id="shows"
            className="scroll-mt-20 py-20 md:py-32 px-6 md:px-10 max-w-7xl mx-auto w-full"
          >
            <SectionHeader
              title={t.shows.title}
              subtitle={t.shows.subtitle}
              className="mb-12 md:mb-20"
            />

            {/* UPCOMING shows (EventsDisplay) */}
            <EventsDisplay showPastEventsButton={false} />

            {/* WALL OF FAME — typographic archive avec vrais liens Facebook */}
            {showsArchive.length > 0 && (
              <div className="mt-24 md:mt-40">
                <div className="flex items-baseline justify-between mb-8 md:mb-14">
                  <div className="text-sm md:text-base font-semibold uppercase tracking-[0.25em] text-white/80 font-body">
                    {t.shows.wallOfFame}
                  </div>
                  <div className="text-xs md:text-sm font-semibold uppercase tracking-[0.3em] text-white/50 font-body">
                    {showsArchive[showsArchive.length - 1]?.year} — {showsArchive[0]?.year}
                  </div>
                </div>

                {/* Glass box avec scroll interne (max-h 500px) */}
                <div className="pk-glass rounded-2xl md:rounded-3xl p-4 md:p-6">
                  <div className="max-h-[500px] overflow-y-auto pr-4 custom-scrollbar divide-y divide-white/5">
                  {showsArchive.map((row, i) => (
                    <div
                      key={row.year}
                      className={cn(
                        'grid gap-4 md:gap-8 py-6 md:py-10 animate-fade-up items-start',
                        // Colonne annee fixe : 160px md, 200px lg. Plus aucun chevauchement
                        'grid-cols-1 md:grid-cols-[160px_1fr] lg:grid-cols-[200px_1fr]',
                      )}
                      style={{
                        animationDelay: `${100 + i * 60}ms`,
                        animationFillMode: 'both',
                      }}
                    >
                      {/* Year massif — colonne fixe, pas de col-span toxique */}
                      <div
                        className={cn(
                          'font-display font-black uppercase text-ink-95',
                          'text-4xl md:text-6xl lg:text-7xl',
                          'leading-none tracking-[-0.03em]',
                          // Sticky en haut sur desktop pour accompagner le scroll interne
                          'md:sticky md:top-0',
                        )}
                      >
                        {row.year}
                      </div>
                      {/* Shows stackés — clickables vers Facebook */}
                      <div className="flex flex-col gap-2 md:gap-3 min-w-0">
                        {row.shows.map((show, j) => {
                          const href = show.facebook_event;
                          const content = (
                            <>
                              <div className="font-body font-medium leading-tight text-ink-95 text-base md:text-xl lg:text-2xl group-hover:text-white transition-colors">
                                {show.name}
                              </div>
                              <div className="font-body text-xs md:text-sm text-white/50 leading-tight mt-0.5">
                                {show.venue}{show.city ? ` · ${show.city}` : ''}
                                {show.lineup && show.lineup.length > 0 && (
                                  <span className="text-white/30">
                                    {' · w/ '}
                                    {show.lineup.slice(0, 3).join(', ')}
                                    {show.lineup.length > 3 && ' …'}
                                  </span>
                                )}
                              </div>
                            </>
                          );
                          if (href) {
                            return (
                              <a
                                key={`${row.year}-${j}`}
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="group flex items-start gap-3 md:gap-4 no-underline text-inherit hover:bg-white/[0.03] rounded-lg px-2 py-1 -mx-2 transition-colors"
                              >
                                <span className="flex-1 min-w-0">{content}</span>
                                <svg
                                  className="shrink-0 w-4 h-4 md:w-5 md:h-5 mt-1 text-white/30 group-hover:text-white transition-colors"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M7 17L17 7M17 7H8M17 7v9" />
                                </svg>
                              </a>
                            );
                          }
                          return (
                            <div key={`${row.year}-${j}`} className="px-2 py-1 -mx-2">
                              {content}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* STORE / MERCH */}
          <section
            id="store"
            className="scroll-mt-20 py-20 md:py-32 px-6 md:px-10 max-w-7xl mx-auto w-full"
          >
            <SectionHeader
              title={t.merch.title}
              subtitle={t.merch.subtitle}
              className="mb-12 md:mb-20"
            />
            <Store onSectionChange={(s) => handleSectionChange(s)} />
          </section>

          {/* GOODIES */}
          <section
            id="goodies"
            className="scroll-mt-20 py-20 md:py-32 px-6 md:px-10 max-w-7xl mx-auto w-full"
          >
            <SectionHeader
              title={t.goodiesSection.title}
              subtitle={t.goodiesSection.subtitle}
              className="mb-12 md:mb-20"
            />
            <Goodies />
          </section>

          {/* EDITORIAL SPREAD — photo pleine largeur avec parallax avant Tech Rider */}
          <section
            aria-label="Editorial spread"
            className="py-8 md:py-16 px-4 md:px-8 max-w-[1600px] mx-auto w-full"
          >
            <EditorialPhoto
              src="/images/MauditeMachine-1.webp"
              alt="Maudite Machine"
              issueTag={t.editorial.issueTag}
              caption={t.editorial.caption}
              heightVh={75}
            />
          </section>

          {/* TECH RIDER — Bento Box : LIVE SETUP / DJ SETUP / HOSPITALITY + XXL CTA */}
          <section
            id="techrider"
            className="scroll-mt-20 py-20 md:py-32 px-6 md:px-10 max-w-7xl mx-auto w-full"
          >
            <SectionHeader
              title={t.techrider.title}
              subtitle={t.techrider.subtitle}
              className="mb-12 md:mb-20"
            />

            {/* BENTO GRID — 12 cols asymétrique */}
            <div className="grid grid-cols-12 gap-4 md:gap-6 mb-12 md:mb-20">
              {/* LIVE SETUP — col-span 7 */}
              <div
                className="col-span-12 md:col-span-7 pk-glass p-6 md:p-10 rounded-2xl md:rounded-3xl animate-fade-up"
                style={{ animationDelay: '120ms', animationFillMode: 'both' }}
              >
                <div className="text-xs md:text-sm uppercase tracking-[0.4em] text-ink-50 font-body mb-4 md:mb-6">
                  {t.techrider.liveLabel}
                </div>
                <h3 className="font-display font-black uppercase text-ink-95 text-3xl md:text-5xl lg:text-6xl leading-[0.9] tracking-[-0.03em] mb-6 md:mb-10 whitespace-pre-line">
                  {t.techrider.liveTitle}
                </h3>
                <ul className="font-body text-base md:text-xl text-ink-95 space-y-2 md:space-y-3">
                  <li>— Macbook Pro</li>
                  <li>— Ableton Push 3</li>
                  <li>— Dreadbox Typhon</li>
                  <li>— Akai APC40</li>
                </ul>
              </div>

              {/* DJ SETUP — col-span 5 */}
              <div
                className="col-span-12 md:col-span-5 pk-glass p-6 md:p-10 rounded-2xl md:rounded-3xl animate-fade-up"
                style={{ animationDelay: '220ms', animationFillMode: 'both' }}
              >
                <div className="text-xs md:text-sm uppercase tracking-[0.4em] text-ink-50 font-body mb-4 md:mb-6">
                  {t.techrider.djLabel}
                </div>
                <h3 className="font-display font-black uppercase text-ink-95 text-3xl md:text-5xl lg:text-6xl leading-[0.9] tracking-[-0.03em] mb-6 md:mb-10 whitespace-pre-line">
                  {t.techrider.djTitle}
                </h3>
                <ul className="font-body text-sm md:text-base text-ink-95 space-y-2 md:space-y-3">
                  <li>
                    — {t.techrider.djLine1Main}{' '}
                    <span className="text-ink-95 font-medium">{t.techrider.djLine1Variant}</span>
                    <span className="text-ink-50"> {t.techrider.djLine1Alt}</span>
                  </li>
                  <li className="text-ink-50 text-xs md:text-sm uppercase tracking-[0.2em]">
                    {t.techrider.djFirmware}
                  </li>
                  <li className="pt-2">
                    — {t.techrider.djMixerMain}{' '}
                    <span className="font-medium">{t.techrider.djMixerPrimary}</span>
                    <span className="text-ink-50">{t.techrider.djMixerAlt}</span>
                  </li>
                </ul>
              </div>

              {/* HOSPITALITY — col-span 12 (full width, quote italique) */}
              <div
                className="col-span-12 pk-glass p-8 md:p-14 rounded-2xl md:rounded-3xl animate-fade-up"
                style={{ animationDelay: '320ms', animationFillMode: 'both' }}
              >
                <div className="text-xs md:text-sm uppercase tracking-[0.4em] text-ink-50 font-body mb-4 md:mb-6">
                  {t.techrider.hospitalityLabel}
                </div>
                <blockquote className="font-display italic text-ink-95 text-2xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] max-w-4xl">
                  <span className="text-ink-30">« </span>
                  {t.techrider.hospitalityQuote}
                  <span className="text-ink-30"> »</span>
                </blockquote>
              </div>
            </div>

            {/* XXL DOWNLOAD CTA — Tech Rider & CV */}
            <a
              href={TECH_RIDER_PDF}
              download
              aria-label={t.techrider.ctaAria}
              className={cn(
                'group block relative rounded-2xl md:rounded-3xl overflow-hidden',
                'border border-ink-10 hover:border-ink-30',
                'bg-glass backdrop-blur-heavy backdrop-saturate-glass',
                'transition-all duration-500 ease-out-expo',
                'hover:shadow-glow-white hover:bg-glass-strong',
                'no-underline text-inherit',
                'animate-fade-up',
              )}
              style={{ animationDelay: '440ms', animationFillMode: 'both' }}
            >
              <div className="relative p-8 md:p-14 lg:p-20">
                <div className="flex items-center justify-between mb-6 md:mb-10 text-xs md:text-sm uppercase tracking-[0.3em] text-ink-50 font-body">
                  <span>{t.techrider.ctaMeta}</span>
                  <span>{t.techrider.ctaEdition}</span>
                </div>

                {/* Titre XXL qui se remplit au hover */}
                <div
                  className={cn(
                    'font-display font-black uppercase whitespace-pre-line',
                    'text-[clamp(2.25rem,8vw,9rem)] md:text-[clamp(3rem,6vw,8rem)]',
                    'leading-[0.85] tracking-[-0.045em]',
                    'text-ink-30 group-hover:text-ink-95',
                    'transition-colors duration-700 ease-out-expo',
                    'group-hover:[text-shadow:_0_4px_40px_rgba(255,255,255,0.25)]',
                  )}
                >
                  {t.techrider.ctaTitle}
                </div>

                <div className="mt-8 md:mt-12 flex items-center justify-between">
                  <span className="text-sm md:text-base text-ink-70 font-body">
                    {t.techrider.ctaFooter}
                  </span>
                  <span className="inline-flex items-center justify-center w-14 h-14 md:w-20 md:h-20 rounded-full border border-ink-20 group-hover:border-ink-95 text-ink-85 group-hover:text-ink-95 transition-colors duration-500">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="transform group-hover:translate-y-1 transition-transform duration-400 ease-out-expo"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="19 12 12 19 5 12" />
                    </svg>
                  </span>
                </div>
              </div>
            </a>
          </section>

          {/* MESSAGE / CONTACT */}
          <section
            id="message"
            className="scroll-mt-20 py-20 md:py-32 px-6 md:px-10 max-w-5xl mx-auto w-full"
          >
            <SectionHeader
              title={t.contactSection.title}
              subtitle={t.contactSection.subtitle}
              className="mb-12 md:mb-20"
              align="center"
            />
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
