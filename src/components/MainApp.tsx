import React, { useState, useEffect } from "react";
import SoundCloudPlayer from "./SoundCloudPlayer";
import RandomMessage from "./RandomMessage";
import NewsMessages from "./NewsMessages";
import EventsDisplay from "./EventsDisplay";
import InstagramFeed from "./InstagramFeed";
import Store from "./Store";
import Message from "./Message";
import Presskit from "./Presskit";
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
    label: "Instagram",
    href: "https://www.instagram.com/mauditemachine/",
    platform: "instagram",
    hoverColor: "#E4405F"
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [bgUrl, setBgUrl] = useState<string>("");
  const [defaultBgUrl, setDefaultBgUrl] = useState<string>(
    encodeURI(import.meta.env.BASE_URL + "images/mixtape37.webp")
  );
  const [activeSection, setActiveSection] = useState("home");
  const [bioText, setBioText] = useState<string>("");
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Vérifier si l'utilisateur a déjà une préférence sauvegardée
    const savedMode = localStorage.getItem('darkMode');
    // Par défaut, mode sombre activé (true)
    return savedMode !== null ? JSON.parse(savedMode) : true;
  });

  // Titres des sections pour les tooltips
  const sectionTitles = {
    home: "Home",
    events: "Events", 
    medias: "Medias",
    store: "Store",
    message: "Contact",
    presskit: "Press Kit"
  };

  // Fonction pour basculer le mode sombre
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    // Sauvegarder la préférence dans localStorage
    localStorage.setItem('darkMode', JSON.stringify(newMode));
  };

  // Appliquer la classe dark mode au body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  // Fonction pour déclencher des événements Facebook Pixel
  const trackFacebookEvent = (eventName: string, parameters?: any) => {
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', eventName, parameters);
    }
  };

  // Fonction pour changer de section avec tracking
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    setMenuOpen(false);
    
    // Tracking Facebook Pixel pour les interactions
    trackFacebookEvent('ViewContent', {
      content_name: section,
      content_category: 'Navigation'
    });
  };

  // Charger la bio depuis localStorage
  useEffect(() => {
    const savedBio = localStorage.getItem('admin_bio_backup');
    if (savedBio) {
      const bio = JSON.parse(savedBio);
      setBioText(bio.text);
    } else {
      // Bio par défaut si aucune sauvegarde
      setBioText("Maudite Machine is a Canadian DJ and producer known for his raw, hypnotic approach to minimal and indie dance. Born from the Montreal underground, he has performed at major events including Piknic Électronik, Eclipse Festival, and the iconic Techno Parade in Paris, delivering sets that blur the line between intensity and atmosphere across Canada and Europe.\n\nAs the founder of VRSTL Records, he curates a sound that embraces tension, groove, and experimentation, having shared the stage with electronic music legends like Carl Craig, Ellen Allien, The Hacker, Popof, and Agoria. His collaborations with influential artists reflect a constant drive to push boundaries and redefine the underground with a distinct sonic signature, championing bold artists who share his vision for the darker, experimental sides of electronic music.");
    }
  }, []);

  // Charger les paramètres de background depuis localStorage
  useEffect(() => {
    const loadBackgroundSettings = () => {
      const savedBackground = localStorage.getItem('admin_background_settings');
      console.log('🔄 Chargement background settings:', savedBackground);
      
      if (savedBackground) {
        const backgroundData = JSON.parse(savedBackground);
        console.log('📊 Background data complet:', backgroundData);
        
        // Si l'utilisateur a désactivé le background
        if (backgroundData.useBackground === false) {
          console.log('🚫 Background désactivé - suppression de l\'image');
          setDefaultBgUrl('');
          setBgUrl('');
          return;
        }
        
        // Assurer la rétrocompatibilité avec les valeurs par défaut
        const settings = {
          useBackground: backgroundData.useBackground !== false,
          backgroundType: backgroundData.backgroundType || 'image',
          defaultImage: backgroundData.defaultImage || 'images/mixtape37.webp',
          gradientColor1: backgroundData.gradientColor1 || '#1a1a2e',
          gradientColor2: backgroundData.gradientColor2 || '#16213e',
          gradientDirection: backgroundData.gradientDirection || '135deg'
        };
        
        console.log('🔧 Settings après rétrocompatibilité:', settings);
        
        if (settings.backgroundType === 'gradient') {
          // Créer un gradient CSS
          const gradient = `linear-gradient(${settings.gradientDirection}, ${settings.gradientColor1}, ${settings.gradientColor2})`;
          console.log('🎨 Background gradient activé:', gradient);
          console.log('🌈 Couleurs gradient:', settings.gradientColor1, '→', settings.gradientColor2);
          console.log('📐 Direction gradient:', settings.gradientDirection);
          console.log('🔍 Type de background détecté:', settings.backgroundType);
          console.log('✅ Application du gradient...');
          setDefaultBgUrl(gradient);
          setBgUrl(gradient);
          console.log('✅ Gradient appliqué avec succès!');
        } else {
          // Image normale
          if (settings.defaultImage) {
            const newDefaultBg = settings.defaultImage.startsWith('data:') 
              ? settings.defaultImage 
              : encodeURI(import.meta.env.BASE_URL + settings.defaultImage);
            console.log('✅ Background image activé:', newDefaultBg.substring(0, 50) + '...');
            setDefaultBgUrl(newDefaultBg);
            setBgUrl(newDefaultBg);
          } else {
            console.log('⚠️ Pas d\'image définie, utilisation du défaut');
            const defaultBg = encodeURI(import.meta.env.BASE_URL + "images/mixtape37.webp");
            setDefaultBgUrl(defaultBg);
            setBgUrl(defaultBg);
          }
        }
      } else {
        // Utiliser le background par défaut
        const defaultBg = encodeURI(import.meta.env.BASE_URL + "images/mixtape37.webp");
        console.log('🎨 Background par défaut:', defaultBg);
        setDefaultBgUrl(defaultBg);
        setBgUrl(defaultBg);
      }
    };

    // Charger au démarrage
    loadBackgroundSettings();

    // Écouter les changements de localStorage (quand l'admin sauvegarde)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'admin_background_settings') {
        loadBackgroundSettings();
      }
    };

    // Écouter les changements personnalisés (même onglet)
    const handleCustomStorageChange = () => {
      loadBackgroundSettings();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('admin_background_updated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('admin_background_updated', handleCustomStorageChange);
    };
  }, []);

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
    <div className="page">
      <div className="bg-stack">
        {bgUrl && (
          bgUrl.startsWith('linear-gradient') ? (
            <div 
              className="bg-photo" 
              style={{ 
                background: bgUrl,
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: -1
              }}
            />
          ) : (
            <img className="bg-photo" src={bgUrl} alt="Background" />
          )
        )}
        {/* <BackgroundLines /> */}
      </div>
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
        onClick={() => setMenuOpen(false)}
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

      {/* Bouton Dark Mode en haut à droite */}
      <button 
        className="dark-mode-toggle"
        onClick={toggleDarkMode}
        title={isDarkMode ? "Mode clair" : "Mode sombre"}
      >
        <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
      </button>

      {/* Navigation en haut du site */}
      <div className="second-third-combined">
        {/* Boutons de navigation en haut */}
        <div className="nav-buttons-container">
          <button
            className={`nav-icon-btn ${activeSection === "home" ? "active" : ""}`}
            onClick={() => handleSectionChange("home")}
            onMouseEnter={() => setHoveredButton("home")}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <i className="fa-solid fa-house-chimney"></i>
          </button>
          <button
            className={`nav-icon-btn ${activeSection === "events" ? "active" : ""}`}
            onClick={() => handleSectionChange("events")}
            onMouseEnter={() => setHoveredButton("events")}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <i className="fa-solid fa-calendar-days"></i>
          </button>

          <button
            className={`nav-icon-btn ${activeSection === "medias" ? "active" : ""}`}
            onClick={() => handleSectionChange("medias")}
            onMouseEnter={() => setHoveredButton("medias")}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <i className="fa-solid fa-image"></i>
          </button>
          <button 
            className={`nav-icon-btn ${activeSection === "store" ? "active" : ""}`}
            onClick={() => handleSectionChange("store")}
            onMouseEnter={() => setHoveredButton("store")}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <i className="fa-solid fa-store"></i>
          </button>
          <button 
            className={`nav-icon-btn ${activeSection === "message" ? "active" : ""}`}
            onClick={() => handleSectionChange("message")}
            onMouseEnter={() => setHoveredButton("message")}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <i className="fa-solid fa-message"></i>
          </button>
          <button 
            className={`nav-icon-btn ${activeSection === "presskit" ? "active" : ""}`}
            onClick={() => handleSectionChange("presskit")}
            onMouseEnter={() => setHoveredButton("presskit")}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <i className="fa-solid fa-newspaper"></i>
          </button>
          
          {/* Tooltip pour afficher le titre de la section */}
          {hoveredButton && (
            <div 
              className="nav-tooltip"
              data-text={sectionTitles[hoveredButton as keyof typeof sectionTitles]}
            />
          )}
        </div>

        {/* Rectangle principal sous les boutons */}
        <div className="main-rectangle">
          {activeSection === "home" && (
            <>
              <div className="bio-text">
                {bioText.split('\n\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
              <NewsMessages />
            </>
          )}
          {activeSection === "events" && <EventsDisplay showPastEventsButton={true} />}

          {activeSection === "store" && <Store />}
          {activeSection === "message" && <Message />}
          {activeSection === "presskit" && <Presskit onNavigateToMessage={() => handleSectionChange("message")} />}
        </div>
      </div>

      <main className="main-content">
        {/* Logo principal MAUDITE MACHINE */}
        <div className="main-logo">
          <img
            src={import.meta.env.BASE_URL + "logo/mauditemachine-logo.png"}
            alt="Maudite Machine"
          />
        </div>



        {/* Player SoundCloud en dessous du logo */}
        <div className="player-section" style={{ marginTop: "20px" }}>
          <SoundCloudPlayer onBackgroundChange={(url) => setBgUrl(url)} />
        </div>
      </main>

      <footer className="bottom">
        {/* Social Links */}
        <div className="social-links-container">
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
        
        <a href="https://vrstlrecords.com" target="_blank" rel="noreferrer">
          <img
            className="vrstl"
            src={import.meta.env.BASE_URL + "logo/vrstl-logo.svg"}
            alt="VRSTL Records"
          />
        </a>
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

        {/* Random messages */}
        <div className="mobile-section mobile-random-messages">
          <RandomMessage />
        </div>

        {/* Lecteur */}
        <div className="mobile-section mobile-player">
          <SoundCloudPlayer onBackgroundChange={(url) => setBgUrl(url)} />
        </div>

        {/* Events - 3 prochains */}
        <div className="mobile-section mobile-events">
          <h3>Events</h3>
          <EventsDisplay limit={3} />
        </div>

        {/* Instagram sans scroll */}
        <div className="mobile-section mobile-instagram">
          <h3>Medias</h3>
          <InstagramFeed isMobile={true} />
        </div>

        {/* Store */}
        <div className="mobile-section mobile-store">
          <h3>Store</h3>
          <div className="store-message">
            <h4>New merch dropping soon!</h4>
            <p>Get ready for fresh t-shirts, hoodies, stickers, and bags in multiple sizes.</p>
            <span className="timeline-date">August 2025</span>
          </div>
        </div>

        {/* Presskit */}
        <div className="mobile-section mobile-presskit">
          <h3>Press Kit</h3>
          <Presskit onNavigateToMessage={() => {}} />
        </div>

        {/* Message */}
        <div className="mobile-section mobile-message">
          <Message />
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
  );
}
