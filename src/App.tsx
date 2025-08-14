import React, { useState } from 'react'
import BackgroundLines from './components/BackgroundLines'
import SoundCloudPlayer from './components/SoundCloudPlayer'
import Events from './components/Events'
import RandomMessage from './components/RandomMessage'
import DraggableWindow from './components/DraggableWindow'

const socialLinks: { label: string; href: string }[] = [
  { label: 'Facebook', href: 'https://www.facebook.com/MauditeMachine' },
  { label: 'Instagram', href: 'https://www.instagram.com/mauditemachine/' },
  { label: 'Spotify', href: 'https://open.spotify.com/artist/2FHPGWPEBQbCsgkLP9uuI4' },
  { label: 'Deezer', href: 'https://www.deezer.com/fr/artist/8651600' },
  { label: 'Soundcloud', href: 'https://www.soundcloud.com/mauditemachine/' },
  { label: 'Bandcamp', href: 'https://mauditemachine.bandcamp.com/' },
  { label: 'Youtube', href: 'https://www.youtube.com/@mauditemachine-official' },
  { label: 'Mixcloud', href: 'https://www.mixcloud.com/mauditemachine/' },
  { label: 'Tiktok', href: 'https://www.tiktok.com/@mauditemachine' },
  { label: 'Linktree', href: 'https://linktr.ee/mauditemachine' },
  { label: 'Hyppedit', href: 'https://music.vrstlrecords.com/mauditemachine' },
  { label: 'Apple Music', href: 'https://music.apple.com/us/artist/maudite-machine/1028417516' },
  { label: 'Beatport', href: 'https://www.beatport.com/fr/artist/maudite-machine/500537' },
  { label: 'Booking Inquiries', href: 'mailto:booking@vrstlrecords.com' },
]

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [bgUrl, setBgUrl] = useState<string>(encodeURI('/medias/images/Simetra.webp'))
  return (
    <div className="page">
      <div className="bg-stack">
        <img className="bg-photo" src={bgUrl} alt="Background" />
        <BackgroundLines />
      </div>
      {/* Hamburger + menu mobile */}
      <button className="hamburger" aria-label="Ouvrir le menu" onClick={() => setMenuOpen(v => !v)}>
        <span></span>
      </button>
      <nav className={`menu ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
        <ul className="links links-mobile">
          {socialLinks.map(link => (
            <li key={link.label}>
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a href="https://drive.google.com/drive/folders/1qI9hbn2NwDLwAg-q2Jn9-5U202CKP7P3?usp=drive_link" target="_blank" rel="noreferrer">
              Presskit & Techrider
            </a>
          </li>
        </ul>
      </nav>

      <main className="content">
        <div className="brand">
          <img className="logo" src="/medias/logos/mauditemachine-logo.svg" alt="Maudite Machine" />
          {/* Message en mobile: juste sous le logo */}
          <RandomMessage className="message-mobile" />
          <p className="bio">
            Maudite Machine is the owner of VRSTL Records, a Canadian label dedicated to dark disco and indie dance. Known for a unique approach to the genre, both as a DJ and producer, Maudite Machine has made a lasting impact on the electronic music scene. He has mesmerized audiences at major events and iconic venues across the country. His collaborations with industry leaders further cement his status as an influential figure in electronic music, pushing boundaries and continually redefining Indie dance sound.
          </p>
          <Events />
          <DraggableWindow className="player-window">
            <div className="player"><SoundCloudPlayer onBackgroundChange={(url) => setBgUrl(url)} /></div>
          </DraggableWindow>
        </div>
        <div className="right-rail">
          <RandomMessage className="message-desktop" />
          <ul className="links links-desktop">
            {socialLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a href="https://drive.google.com/drive/folders/1qI9hbn2NwDLwAg-q2Jn9-5U202CKP7P3?usp=drive_link" target="_blank" rel="noreferrer" className="pressk">
                Presskit & Techrider
              </a>
            </li>
          </ul>

        </div>
      </main>

      <footer className="bottom">
        <img className="vrstl" src="/medias/logos/vrstl-logo.svg" alt="VRSTL" />
      </footer>
    </div>
  )
}


