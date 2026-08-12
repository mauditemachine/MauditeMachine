/**
 * Hero /v2 : video fullscreen en boucle (dream-bg deja optimisee, 3.6 Mo),
 * overlay noir 50 %, logo en mix-blend difference, tagline, 3 CTA ancres,
 * indicateur de scroll.
 *
 * iOS Safari : muted doit etre pose en VRAI attribut DOM via ref callback,
 * React ne le rend pas (piege verifie sur le site v1). prefers-reduced-motion
 * ou data saver : on montre le poster, pas la video.
 */

import React, { useCallback } from 'react';

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const Hero: React.FC = () => {
  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return;
    el.muted = true;
    el.setAttribute('muted', '');
    el.play().catch(() => {
      /* autoplay refuse : le poster reste affiche */
    });
  }, []);

  return (
    <header className="v2-hero" id="top">
      {REDUCED ? (
        <img
          className="v2-hero-video"
          src="/videos/dream-bg-poster.jpg"
          alt=""
          aria-hidden="true"
        />
      ) : (
        <video
          ref={videoRef}
          className="v2-hero-video"
          autoPlay
          loop
          playsInline
          preload="metadata"
          poster="/videos/dream-bg-poster.jpg"
          aria-hidden="true"
        >
          <source src="/videos/dream-bg-720.mp4" media="(max-width: 768px)" type="video/mp4" />
          <source src="/videos/dream-bg-1080.mp4" type="video/mp4" />
        </video>
      )}
      <div className="v2-hero-overlay" aria-hidden="true" />

      <div className="v2-hero-content">
        <h1 style={{ margin: 0 }}>
          <img
            className="v2-hero-logo"
            src="/logo/mauditemachine-logo-white.png"
            alt="Maudite Machine"
          />
        </h1>

        <div className="v2-hero-tagline">
          <span className="v2-label">Raw. Hypnotic. Underground.</span>
          <span className="v2-label">Montréal → France</span>
        </div>

        <div className="v2-hero-ctas">
          <a className="v2-cta" href="#music">Listen</a>
          <a className="v2-cta" href="#live">Live dates</a>
          <a className="v2-cta" href="#epk">Press kit</a>
        </div>
      </div>

      <div className="v2-scroll-hint" aria-hidden="true">
        <span className="v2-label">Scroll</span>
      </div>
    </header>
  );
};

export default Hero;
