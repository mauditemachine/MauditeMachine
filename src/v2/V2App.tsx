/**
 * /v2 — refonte parallele du site, one-page isolee du reste de l'app :
 * montee HORS Layout (pas de nav v1, pas de PlayerProvider v1, pas de fond
 * jellyfish). Le CSS est scope .v2-root, les fonts Space Mono viennent de
 * @fontsource, Robot Radicals du @font-face global.
 *
 * Tant que /v2 est une preview : meta robots noindex posee au mount,
 * retiree au unmount (la v1 reste indexable).
 */

import React, { useRef } from 'react';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './v2.css';
import { AudioPlayerProvider, useAudioPlayer } from './context/AudioPlayerContext';
import useReveals from './hooks/useReveals';
import useV2Chrome from './hooks/useV2Chrome';
import Cursor from './components/Cursor';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Discography from './components/Discography';
import Mixtapes from './components/Mixtapes';
import StickyPlayer from './components/StickyPlayer';
import LiveGigs from './components/LiveGigs';
import Gallery from './components/Gallery';
import EPK from './components/EPK';
import Footer from './components/Footer';

const V2Shell: React.FC = () => {
  const { current } = useAudioPlayer();
  const rootRef = useRef<HTMLDivElement>(null);
  useReveals(rootRef);
  // Chrome commun /v2 (body class, noindex, description, titre),
  // restaure au unmount — partage avec /v2/radar
  useV2Chrome('Maudite Machine — V2 preview');

  return (
    <div ref={rootRef} className={`v2-root${current ? ' has-player' : ''}`}>
      <Cursor />
      <Nav />
      <Hero />

      <Discography />
      <Mixtapes />
      <LiveGigs />
      <Gallery />
      <EPK />
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
