import React, { useState } from "react";
import SoundCloudPlayer from "./components/SoundCloudPlayer";
import RandomMessage from "./components/RandomMessage";
import NewsMessages from "./components/NewsMessages";
import EventsDisplay from "./components/EventsDisplay";
import { Discography } from "./components/Discography";
import InstagramFeed from "./components/InstagramFeed";
import Store from "./components/Store";
import Message from "./components/Message";
import Presskit from "./components/Presskit";
import SocialIcon from "./components/SocialIcon";

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
    label: "Mixcloud",
    href: "https://www.mixcloud.com/mauditemachine/",
    platform: "mixcloud",
    hoverColor: "#314359"
  },
  {
    label: "Apple Music",
    href: "https://music.apple.com/us/artist/maudite-machine/1028417516",
    platform: "apple",
    hoverColor: "#000000"
  }
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bgUrl, setBgUrl] = useState<string>(
    encodeURI("/images/Simetra.webp")
  );
  const [activeSection, setActiveSection] = useState("home");

  return (
    <div className="page">
      <div className="bg-stack">
        <img className="bg-photo" src={bgUrl} alt="Background" />
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

      {/* Navigation en haut du site */}
      <div className="second-third-combined">
        {/* Boutons de navigation en haut */}
        <div className="nav-buttons">
          <button
            className={`nav-btn ${activeSection === "home" ? "active" : ""}`}
            onClick={() => setActiveSection("home")}
          >
            HOME
          </button>
          <button
            className={`nav-btn ${activeSection === "events" ? "active" : ""}`}
            onClick={() => setActiveSection("events")}
          >
            EVENTS
          </button>
          <button className={`nav-btn ${activeSection === "disco" ? "active" : ""}`} onClick={() => setActiveSection("disco")}>DISCO</button>
          <button className={`nav-btn ${activeSection === "medias" ? "active" : ""}`} onClick={() => setActiveSection("medias")}>MEDIAS</button>
          <button 
            className={`nav-btn ${activeSection === "store" ? "active" : ""}`}
            onClick={() => setActiveSection("store")}
          >
            STORE
          </button>
          <button 
            className={`nav-btn ${activeSection === "message" ? "active" : ""}`}
            onClick={() => setActiveSection("message")}
          >
            MESSAGE
          </button>
          <button 
            className={`nav-btn ${activeSection === "presskit" ? "active" : ""}`}
            onClick={() => setActiveSection("presskit")}
          >
            PRESSKIT
          </button>
        </div>

        {/* Rectangle principal sous les boutons */}
        <div className="main-rectangle">
          {activeSection === "home" && (
            <>
              <div className="bio-text">
                <p>Maudite Machine is a Canadian DJ and producer known for his raw, hypnotic approach to minimal and indie dance. Born from the Montreal underground, he has performed at major events including Piknic Électronik, Eclipse Festival, and the iconic Techno Parade in Paris, delivering sets that blur the line between intensity and atmosphere across Canada and Europe.</p>
                <p>As the founder of VRSTL Records, he curates a sound that embraces tension, groove, and experimentation, having shared the stage with electronic music legends like Carl Craig, Ellen Allien, The Hacker, Popof, and Agoria. His collaborations with influential artists reflect a constant drive to push boundaries and redefine the underground with a distinct sonic signature, championing bold artists who share his vision for the darker, experimental sides of electronic music.</p>
              </div>
              <NewsMessages />
            </>
          )}
          {activeSection === "events" && <EventsDisplay />}
          {activeSection === "disco" && <Discography />}
          {activeSection === "medias" && <InstagramFeed />}
          {activeSection === "store" && <Store />}
          {activeSection === "message" && <Message />}
          {activeSection === "presskit" && <Presskit onNavigateToMessage={() => setActiveSection("message")} />}
        </div>
      </div>

      <main className="main-content">
        {/* Logo principal MAUDITE MACHINE */}
        <div className="main-logo">
          <img
            src="/logo/mauditemachine-logo.png"
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
            src="/logo/vrstl-logo.svg"
            alt="VRSTL Records"
          />
        </a>
      </footer>

      {/* Mobile Layout */}
      <div className="mobile-layout" style={{ display: 'none' }}>
        {/* Logo 100% largeur */}
        <div className="mobile-section mobile-logo">
          <img
            src="/logo/mauditemachine-logo.png"
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
          <p>Maudite Machine is a Canadian DJ and producer known for his raw, hypnotic approach to minimal and indie dance. Born from the Montreal underground, he has performed at major events including Piknic Électronik, Eclipse Festival, and the iconic Techno Parade in Paris, delivering sets that blur the line between intensity and atmosphere across Canada and Europe.</p>
          <p>As the founder of VRSTL Records, he curates a sound that embraces tension, groove, and experimentation, having shared the stage with electronic music legends like Carl Craig, Ellen Allien, The Hacker, Popof, and Agoria. His collaborations with influential artists reflect a constant drive to push boundaries and redefine the underground with a distinct sonic signature, championing bold artists who share his vision for the darker, experimental sides of electronic music.</p>
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

        {/* Message */}
        <div className="mobile-section mobile-message">
          <h3>Contact</h3>
          <Message />
        </div>

        {/* Footer VRSTL Logo */}
        <div className="mobile-section mobile-footer">
          <a href="https://vrstlrecords.com" target="_blank" rel="noreferrer">
            <img
              className="vrstl-mobile"
              src="/logo/vrstl-logo.svg"
              alt="VRSTL Records"
            />
          </a>
        </div>
      </div>
    </div>
  );
}
