/**
 * /v2 — refonte parallele du site, one-page isolee du reste de l'app :
 * montee HORS Layout (pas de nav v1, pas de PlayerProvider v1, pas de fond
 * jellyfish). Le CSS est scope .v2-root ; la typo du site est Larsseit
 * (woff2 auto-heberges, @font-face dans v2.css).
 */

import React, { useEffect, useRef } from 'react';
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
import Merch from './components/Merch';
import EPK from './components/EPK';
import Footer from './components/Footer';

/** Rideau d'entree : une fois par session, jamais en reduced-motion. */
const useCurtain = () => {
  const [show, setShow] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (document.visibilityState === 'hidden') return false;
    if (sessionStorage.getItem('mm_v2_entered')) return false;
    try {
      sessionStorage.setItem('mm_v2_entered', '1');
    } catch {
      /* stockage bloque : le rideau jouera a chaque visite, sans gravite */
    }
    return true;
  });
  return { show, done: () => setShow(false) };
};

const V2Shell: React.FC = () => {
  const { current } = useAudioPlayer();
  const rootRef = useRef<HTMLDivElement>(null);
  const curtain = useCurtain();
  useReveals(rootRef);
  // Chrome commun /v2 (body class, noindex, description, titre),
  // restaure au unmount — partage avec /v2/radar
  useV2Chrome('Maudite Machine | DJ & Producer · Indie Dance, Dark Disco');

  // Arrivee avec une ancre (redirections /about -> /#epk, liens partages) :
  // le contenu monte apres le paint initial, le jump natif rate sa cible.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const t = window.setTimeout(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
    }, 60);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div ref={rootRef} className={`v2-root${current ? ' has-player' : ''}`}>
      {curtain.show && (
        <div className="v2-curtain" aria-hidden="true" onAnimationEnd={curtain.done} />
      )}
      <Cursor />
      <Nav />
      <Hero />

      <Discography />
      <Mixtapes />
      <LiveGigs />
      <Gallery />
      <Merch />
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
