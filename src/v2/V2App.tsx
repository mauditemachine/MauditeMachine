/**
 * /v2 — refonte parallele du site, one-page isolee du reste de l'app :
 * montee HORS Layout (pas de nav v1, pas de PlayerProvider v1, pas de fond
 * jellyfish). Le CSS est scope .v2-root, les fonts Space Mono viennent de
 * @fontsource, Robot Radicals du @font-face global.
 *
 * Tant que /v2 est une preview : meta robots noindex posee au mount,
 * retiree au unmount (la v1 reste indexable).
 */

import React, { useEffect, useRef } from 'react';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './v2.css';
import { AudioPlayerProvider, useAudioPlayer } from './context/AudioPlayerContext';
import useReveals from './hooks/useReveals';
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
  useEffect(() => {
    // Neutralise le padding mobile du body v1 + fond noir garanti
    document.body.classList.add('v2-active');

    // noindex tant que la refonte est en preview. index.html porte deja
    // une meta robots "index, follow" : on la MODIFIE (pas d'empilement,
    // deux metas contradictoires c'est fragile) et on la restaure en
    // quittant /v2.
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const robots = existing ?? document.createElement('meta');
    const prevRobots = existing?.content ?? null;
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    if (!existing) document.head.appendChild(robots);

    const prevTitle = document.title;
    document.title = 'Maudite Machine — V2 preview';

    // Meme principe pour la description : celle d'index.html (v1) porte
    // encore « Montréal → France » ; /v2 affiche ses territoires, la v1
    // retrouve son texte au unmount.
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = desc?.content ?? null;
    if (desc) {
      desc.content =
        'DJ and producer for 15 years. Indie dance, dark disco and hypnotic minimal. Founder of VRSTL Records. Canada · France · Spain.';
    }

    return () => {
      document.body.classList.remove('v2-active');
      if (prevRobots !== null) robots.content = prevRobots;
      else robots.remove();
      if (desc && prevDesc !== null) desc.content = prevDesc;
      document.title = prevTitle;
    };
  }, []);

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
