import React, { useState, useEffect } from "react";
import SoundCloudPlayer from "./SoundCloudPlayer";
import NewsMessages from "./NewsMessages";
import { useApp } from "../context/AppContext";
import EventsDisplay from "./EventsDisplay";
import Store from "./Store";
import Message from "./Message";
import Presskit from "./Presskit";
import Goodies from "./Goodies";
import SocialIcon from "./SocialIcon";
import HeroSlideshow from "./HeroSlideshow";

// 5 photos paysage haute-qualite (studio en 1er, puis les 4 nouvelles)
const HERO_FIRST = `${import.meta.env.BASE_URL}images/hero/hero-05.webp`; // studio en 1er
const HERO_IMAGES = [
  HERO_FIRST,
  `${import.meta.env.BASE_URL}images/hero/hero-01.webp`,
  `${import.meta.env.BASE_URL}images/hero/hero-02.webp`,
  `${import.meta.env.BASE_URL}images/hero/hero-03.webp`,
  `${import.meta.env.BASE_URL}images/hero/hero-04.webp`,
];

// Supprimer les erreurs SoundCloud de la console
const suppressWidgetErrors = () => {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  let soundcloudErrorCount = 0;
  let hasShownSoundCloudGroupedError = false;
  
  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    const stack = args[1]?.stack || '';
    
    // Liste exhaustive des erreurs SoundCloud à supprimer
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
      stack.includes('soundcloud') ||
      args.some(arg => arg?.constructor?.name === 'constructor')
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
    const message = args[0]?.toString() || '';
    if (
      message.includes('SoundCloud') ||
      message.includes('widget-') ||
      message.includes('encrypted-media') ||
      message.includes('Permissions policy') ||
      message.includes('Feature Policy') ||
      message.includes('bandcamp') ||
      message.includes('bcbits.com')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  // Supprimer aussi les logs SoundCloud et Bandcamp
  console.log = (...args) => {
    const message = args[0]?.toString() || '';
    if (
      message.includes('SoundCloud Embed Player') ||
      message.includes('widget-') ||
      message.includes('📦 Utilisation du cache') ||
      message.includes('ErrorCollector: enabled') ||
      message.includes('initing HTMLEmbeddedPlayer3') ||
      message.includes('user not opted in: skipping Tracker record') ||
      message.includes('no events to send')
    ) {
      return;
    }
    originalLog.apply(console, args);
  };
};

const socialLinks: { 
  label: string; 
  href: string; 
  platform: string;
  hoverColor: string;
}[] = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/MauditeMachine",
    platform: "facebook",
    hoverColor: "#1877F2"
  },
  {
    label: "Spotify",
    href: "https://open.spotify.com/artist/2FHPGWPEBQbCsgkLP9uuI4",
    platform: "spotify",
    hoverColor: "#1DB954"
  },
  {
    label: "Youtube",
    href: "https://www.youtube.com/@mauditemachine-official",
    platform: "youtube",
    hoverColor: "#FF0000"
  },
  {
    label: "Soundcloud",
    href: "https://www.soundcloud.com/mauditemachine/",
    platform: "soundcloud",
    hoverColor: "#FF3300"
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/mauditemachine/",
    platform: "instagram",
    hoverColor: "#E4405F"
  },
  {
    label: "Bandcamp",
    href: "https://mauditemachine.bandcamp.com/",
    platform: "bandcamp",
    hoverColor: "#629AA0"
  },
  {
    label: "Apple Music",
    href: "https://music.apple.com/us/artist/maudite-machine/1028417516",
    platform: "apple",
    hoverColor: "#000000"
  }
];

export default function MainApp() {
  const { designMode, setDesignMode, lang, t } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bgUrl, setBgUrl] = useState<string>("");
  const [activeSection, setActiveSection] = useState("home");
  const [heroLogoFaded, setHeroLogoFaded] = useState(false);

  // Fade-out du logo central après 3s sur la home
  useEffect(() => {
    if (activeSection !== "home") { setHeroLogoFaded(false); return; }
    const t = setTimeout(() => setHeroLogoFaded(true), 3000);
    return () => clearTimeout(t);
  }, [activeSection])

  const handleBgChange = (url: string) => {
    setBgUrl(url)
    // Mettre à jour la variable CSS pour le desktop et afficher l'overlay
    document.documentElement.style.setProperty('--track-bg', `url(${url})`);
    // Ajouter la classe track-active pour afficher l'overlay
    document.querySelector('.page')?.classList.add('track-active');
  }
  const [bioText, setBioText] = useState<string>("");
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [messagePrefill, setMessagePrefill] = useState<{ subject: string; message: string } | null>(null);

  // Titres des sections pour les tooltips
  const sectionTitles = {
    home: "Home",
    events: "Events", 
    store: "Store",
    message: "Contact",
    presskit: "Press Kit"
  };



  // Fonction pour déclencher des événements Facebook Pixel
  const trackFacebookEvent = (eventName: string, parameters?: any) => {
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', eventName, parameters);
    }
  };

  // Fonction pour changer de section avec tracking et préremplissage optionnel
  const handleSectionChange = (section: string, prefill?: { subject: string; message: string }) => {
    setActiveSection(section);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });

    if (prefill) {
      setMessagePrefill(prefill);
    } else {
      setMessagePrefill(null);
    }

    // Tracking Facebook Pixel pour les interactions
    trackFacebookEvent('ViewContent', {
      content_name: section,
      content_category: 'Navigation'
    });
  };

  // Support des liens directs (#store, #events, etc.)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['home', 'events', 'store', 'message', 'goodies', 'presskit'].includes(hash)) {
        setActiveSection(hash);
      }
    };

    // Vérifier le hash au chargement
    handleHashChange();
    
    // Écouter les changements de hash
    window.addEventListener('hashchange', handleHashChange);
    
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Mettre à jour l'URL quand la section change
  useEffect(() => {
    if (activeSection !== 'home') {
      window.history.replaceState(null, '', `#${activeSection}`);
    } else {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [activeSection]);

  // Charger la bio depuis localStorage (EN uniquement)
  useEffect(() => {
    if (lang === 'en') {
      const savedBio = localStorage.getItem('admin_bio_backup');
      if (savedBio) {
        try {
          const bio = JSON.parse(savedBio);
          setBioText(bio.text || '');
        } catch (_) { setBioText(''); }
      } else {
        setBioText(t.home.bio);
      }
    }
  }, [lang, t.home.bio]);

  const displayBioText = lang === 'fr' ? t.home.bio : bioText || t.home.bio;

  // Initialiser la variable CSS pour le track background
  useEffect(() => {
    document.documentElement.style.setProperty('--track-bg', 'none');
    document.querySelector('.page')?.classList.remove('track-active');
  }, []);

  // Background géré en CSS (rock-bg.png) - pas besoin de JS

  // Supprimer les erreurs SoundCloud et Bandcamp au chargement
  useEffect(() => {
    suppressWidgetErrors();
    
    // Capturer aussi les erreurs globales du window
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

  return (
    <>
      {/* IMAGE DE LA TRACK EN BACKGROUND DYNAMIQUE - SUPPRIMÉ */}
      
      <div className={`page ${designMode === 'alternate' ? 'design-alternate' : ''}`}>
      {/* Hamburger + menu mobile (masqué en desktop) */}
      <button
        className="hamburger"
        aria-label="Ouvrir le menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span></span>
      </button>
      <nav
        className={`menu ${menuOpen ? "open" : ""}`}
        onClick={(e) => { if ((e.target as HTMLElement).closest('.menu-toggles')) return; setMenuOpen(false); }}
      >
        <ul className="links links-mobile">
          {socialLinks.map((link) => (
            <li key={link.label}>
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href="https://drive.google.com/drive/folders/1qI9hbn2NwDLwAg-q2Jn9-5U202CKP7P3?usp=drive_link"
              target="_blank"
              rel="noreferrer"
            >
              Presskit & Techrider
            </a>
          </li>
        </ul>
      </nav>


      {/* HEADER - Logo gauche + Navigation droite */}
      <header className="site-header">
        <div className="header-content">
          {/* Logo en haut à gauche - Gold */}
          <div className="header-logo-left">
            <img
              src={import.meta.env.BASE_URL + "logo/mauditemachine-logo-gold.png"}
              alt="Maudite Machine"
              onClick={() => { handleSectionChange("home"); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          </div>
          
          {/* Boutons design + langue en haut à droite, puis Navigation */}
          <div className="header-right">
            <nav className="header-nav-right">
              <button 
                className={activeSection === "events" ? "active" : ""}
                onClick={() => handleSectionChange("events")}
              >
                {t.nav.events}
              </button>
              <button 
                className={activeSection === "store" ? "active" : ""}
                onClick={() => handleSectionChange("store")}
              >
                {t.nav.merch}
              </button>
              <button 
                className={activeSection === "message" ? "active" : ""}
                onClick={() => handleSectionChange("message")}
              >
                {t.nav.contacts}
              </button>
              <button 
                className={activeSection === "goodies" ? "active" : ""}
                onClick={() => handleSectionChange("goodies")}
              >
                {t.nav.goodies}
              </button>
              <button 
                className={activeSection === "presskit" ? "active" : ""}
                onClick={() => handleSectionChange("presskit")}
              >
                {t.nav.presskit}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Slideshow global en fond (visible sur toutes les pages, assombri hors home) */}
      <div className={`global-bg ${activeSection !== 'home' ? 'dim' : ''}`}>
        <HeroSlideshow images={HERO_IMAGES} intervalMs={6000} />
      </div>

      {/* MAIN CONTENT */}
      <main className="site-main">
        {/* Page d'accueil - Landing page */}
        {activeSection === "home" ? (
          <div className="landing-page">
            <div className={`landing-logo-hero ${heroLogoFaded ? 'faded' : ''}`}>
              <img
                src={import.meta.env.BASE_URL + "logo/LogoStack.svg"}
                alt="Maudite Machine"
                className="landing-logo-hero-img"
              />
            </div>
            <div className="landing-bio-section">
              <p>Maudite Machine is a Canadian DJ and producer known for his raw, hypnotic approach to minimal and indie dance. Born from the Montreal underground, he has performed at major events including Piknic Électronik, Eclipse Festival, and the iconic Techno Parade in Paris, delivering sets that blur the line between intensity and atmosphere across Canada and Europe.</p>
              <p>As the founder of VRSTL Records, he curates a sound that embraces tension, groove, and experimentation, having shared the stage with electronic music legends like Carl Craig, Ellen Allien, The Hacker, Popof, and Agoria. His collaborations with influential artists reflect a constant drive to push boundaries and redefine the underground with a distinct sonic signature, championing bold artists who share his vision for the darker, experimental sides of electronic music.</p>
            </div>
          </div>
        ) : (
          /* Contenu des autres sections */
          <div className="content-wrapper">
            <div className="content-section">
              {activeSection === "events" && (
                <EventsDisplay showPastEventsButton={true} />
              )}
              {activeSection === "store" && (
                <Store onSectionChange={handleSectionChange} />
              )}
              {activeSection === "message" && (
                <Message prefillSubject={messagePrefill?.subject} prefillMessage={messagePrefill?.message} />
              )}
              {activeSection === "goodies" && (
                <Goodies />
              )}
              {activeSection === "presskit" && (
                <Presskit onNavigateToMessage={() => handleSectionChange("message")} />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Logo VRSTL fixé en bas à droite */}
      <a href="https://vrstlrecords.com" target="_blank" rel="noreferrer" className="vrstl-fixed">
        <img src={import.meta.env.BASE_URL + "logo/vrstl-logo-orange.png"} alt="VRSTL Records" />
      </a>

      {/* FOOTER avec player, icônes sociales et logo */}
      <footer className="site-footer">
        <div className="footer-content">
          {/* Player à gauche */}
          <div className="footer-player">
            <SoundCloudPlayer onBackgroundChange={handleBgChange} />
          </div>

          {/* Icônes sociales au centre */}
          <div className="footer-social">
            {socialLinks.map((link) => (
              <a 
                key={link.label}
                href={link.href} 
                target="_blank" 
                rel="noreferrer"
                className="social-icon-link"
                title={link.label}
                style={{ '--hover-color': link.hoverColor } as React.CSSProperties}
              >
                <i className={`fab fa-${link.platform === 'apple' ? 'apple' : link.platform}`}></i>
              </a>
            ))}
          </div>

          {/* Massive Medias */}
          <a href="https://massivemedias.com" target="_blank" rel="noreferrer" className="footer-massive">
            <span className="footer-madeby">{t.footer.madeBy}</span>
            <img src={import.meta.env.BASE_URL + "logo/massive-medias.svg"} alt="Massive Medias" />
            <span>&copy; 2026</span>
          </a>
        </div>
      </footer>

      {/* Mobile Layout - visible seulement via media query */}
      <div className="mobile-layout">
        {/* Logo 100% largeur */}
        <div className="mobile-section mobile-logo">
          <img
            src={import.meta.env.BASE_URL + "logo/mauditemachine-logo.png"}
            alt="Maudite Machine"
          />
        </div>

        {/* Social links carrés */}
        <div className="mobile-section mobile-social-links">
          {socialLinks.map((link) => (
            <SocialIcon
              key={link.label}
              platform={link.platform}
              href={link.href}
              label={link.label}
              hoverColor={link.hoverColor}
            />
          ))}
        </div>

        {/* Bio avec background */}
        <div className="mobile-section mobile-bio">
          {bioText.split('\n\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        {/* News messages */}
        <div className="mobile-section mobile-random-messages">
          <NewsMessages />
        </div>

        {/* Lecteur */}
        <div className="mobile-section mobile-player">
          <SoundCloudPlayer onBackgroundChange={handleBgChange} />
        </div>

        {/* Events - 3 prochains */}
        <div className="mobile-section mobile-events">
          <h3>Events</h3>
          <EventsDisplay limit={3} />
        </div>


        {/* Merch */}
        <div className="mobile-section mobile-store">
          <h3>Merch</h3>
          <Store onSectionChange={handleSectionChange} />
        </div>

        {/* Goodies - phone wallpapers only on mobile */}
        <div className="mobile-section mobile-goodies">
          <h3>Phone Wallpapers</h3>
          <Goodies mobileOnly={true} />
        </div>

        {/* Presskit */}
        <div className="mobile-section mobile-presskit">
          <h3>Press Kit</h3>
          <Presskit onNavigateToMessage={() => {}} />
        </div>

        {/* Message */}
        <div className="mobile-section mobile-message">
          <Message prefillSubject={messagePrefill?.subject} prefillMessage={messagePrefill?.message} />
        </div>

        {/* Footer VRSTL Logo */}
        <div className="mobile-section mobile-footer">
          <a href="https://vrstlrecords.com" target="_blank" rel="noreferrer">
            <img
              className="vrstl-mobile"
              src={import.meta.env.BASE_URL + "logo/vrstl-logo.svg"}
              alt="VRSTL Records"
            />
          </a>
        </div>
      </div>
    </div>
    </>
  );
}
