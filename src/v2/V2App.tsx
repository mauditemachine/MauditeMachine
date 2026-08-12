/**
 * /v2 — refonte parallele du site, one-page isolee du reste de l'app :
 * montee HORS Layout (pas de nav v1, pas de PlayerProvider v1, pas de fond
 * jellyfish). Le CSS est scope .v2-root, les fonts Space Mono viennent de
 * @fontsource, Robot Radicals du @font-face global.
 *
 * Tant que /v2 est une preview : meta robots noindex posee au mount,
 * retiree au unmount (la v1 reste indexable).
 */

import React, { useEffect } from 'react';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './v2.css';
import { AudioPlayerProvider, useAudioPlayer } from './context/AudioPlayerContext';
import Cursor from './components/Cursor';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Discography from './components/Discography';
import StickyPlayer from './components/StickyPlayer';
import Footer from './components/Footer';

const V2Shell: React.FC = () => {
  const { current } = useAudioPlayer();
  useEffect(() => {
    // Neutralise le padding mobile du body v1 + fond noir garanti
    document.body.classList.add('v2-active');

    // noindex tant que la refonte est en preview
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);

    const prevTitle = document.title;
    document.title = 'Maudite Machine — V2 preview';

    return () => {
      document.body.classList.remove('v2-active');
      robots.remove();
      document.title = prevTitle;
    };
  }, []);

  return (
    <div className={`v2-root${current ? ' has-player' : ''}`}>
      <Cursor />
      <Nav />
      <Hero />

      <Discography />

      {/* Sections livrees a l'etape 4 */}
      <section className="v2-section" id="live">
        <div className="v2-section-head">
          <h2 className="v2-section-title">Live</h2>
          <span className="v2-label">Upcoming dates</span>
        </div>
        <p className="v2-label">Coming in step 4.</p>
      </section>

      <section className="v2-section" id="gallery">
        <div className="v2-section-head">
          <h2 className="v2-section-title">Gallery</h2>
          <span className="v2-label">Photos</span>
        </div>
        <p className="v2-label">Coming in step 4.</p>
      </section>

      <section className="v2-section" id="epk">
        <div className="v2-section-head">
          <h2 className="v2-section-title">EPK</h2>
          <span className="v2-label">Press kit</span>
        </div>
        <p className="v2-label">Coming in step 4.</p>
      </section>

      <Footer />
      <StickyPlayer />
    </div>
  );
};

const V2App: React.FC = () => (
  <AudioPlayerProvider>
    <V2Shell />
  </AudioPlayerProvider>
);

export default V2App;
