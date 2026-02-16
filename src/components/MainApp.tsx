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
  const { designMode, setDesignMode, lang, setLang, t } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bgUrl, setBgUrl] = useState<string>("");
  const [activeSection, setActiveSection] = useState("home");

  // Animation aléatoire des lettres du logo patchwork
  useEffect(() => {
    if (activeSection !== "home") return
    const interval = setInterval(() => {
      const letters = document.querySelectorAll('.logo-letter')
      if (!letters.length) return
      // Faire disparaître plusieurs lettres à la fois pour un effet plus visible
      const count = Math.floor(Math.random() * 3) + 2
      for (let n = 0; n < count; n++) {
        const idx = Math.floor(Math.random() * letters.length)
        const el = letters[idx] as HTMLElement
        el.style.transition = 'opacity 1.2s ease'
        el.style.opacity = '0'
        setTimeout(() => {
          el.style.opacity = '1'
        }, 1200)
      }
    }, 500)
    return () => clearInterval(interval)
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
        <div className="menu-toggles">
          <button
            className="menu-toggle-btn"
            onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
            aria-label="Changer de langue"
          >
            {lang === 'en' ? 'FR' : 'EN'}
          </button>
        </div>
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
            <div className="header-toggles">
              <button
                className="header-toggle-btn header-lang-btn"
                onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
                title={lang === 'en' ? 'Français' : 'English'}
                aria-label="Changer de langue"
              >
                {lang === 'en' ? 'FR' : 'EN'}
              </button>
            </div>
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

      {/* MAIN CONTENT */}
      <main className="site-main">
        {/* Page d'accueil - Landing page */}
        {activeSection === "home" ? (
          <div className="landing-page">
            <div className="landing-logo-patchwork">
              {Array.from({ length: 60 }).map((_, i) => (
                <svg key={i} className="patchwork-logo" viewBox="0 0 1198 1238" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path className="logo-letter" d="M249.798 24.9H394.089L394.527 325.393H250.235L249.798 290.379L209.713 325.393L168.734 290.379V325.393H24.8999L25.3572 24.9H169.649L209.733 55.7387L249.798 24.9Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M775.727 24.9V325.393H631.435V250.136L582.443 325.393H405.642V307.618L598.926 24.9H775.727ZM405.662 136.742V24.9H487.163L405.662 136.742Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M1026.43 155.552V24.9H1149.35L1148.91 325.91H786.861L787.298 24.9H908.426V155.552H1026.43Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M24.8999 338.787H342.373V470.93L249.718 603.074H24.8999V338.807V338.787Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M351.758 338.787H479.607V603.054H351.758V338.787Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M489.369 457.17V338.806H815.432V457.17L719.635 456.713L720.033 602.615H592.582L592.184 456.713L489.349 457.17H489.369Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M1109.07 510.378L1150.9 561.756V603.511H824.837V338.787H1150.9V436.97H1109.07L1150.9 487.891V510.378H1109.07Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M249.241 615.408H392.598L393.035 913.953H249.678L249.241 879.158L209.415 913.953L168.714 879.158V913.953H25.7944L26.2319 615.408H169.589L209.415 646.048L249.241 615.408Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M771.749 615.408V913.953H628.392V839.192L579.718 913.953H404.071V896.297L596.082 615.408H771.729H771.749ZM404.09 726.515V615.408H485.054L404.09 726.515Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M783.241 798.154L1031 615.408H1150.9V758.706L1083.2 798.154H1150.9V914.45H783.241V798.154Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M234.567 1164.59H130.718L131.115 1190.24H24.8999H25.2976L25.6952 926.328H131.891V951.977H235.74L235.343 926.328H343.109L342.711 1190.24H234.567V1164.59Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M352.851 926.348H480.521V1190.26H352.851V926.348Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M645.292 926.348L814.736 1174.21V1189.78H659.727L616.78 1123.81V1189.78H490.284V926.328H645.292V926.348ZM743.276 926.348H814.716V1024.39L743.276 926.348Z" fill="#FFCC00"/>
                  <path className="logo-letter" d="M1109.13 1097.7L1150.9 1149.02V1190.71H825.274V926.348H1150.9V1024.39H1109.13L1150.9 1075.25V1097.7H1109.13Z" fill="#FFCC00"/>
                </svg>
              ))}
            </div>
            <div className="landing-tagline">{t.home.subtitle}</div>
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
