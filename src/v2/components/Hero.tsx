/**
 * Hero /v2 : background generatif code (GenerativeBg, canvas 2D) derriere
 * le logo en mix-blend difference, tagline, 3 CTA ancres, indicateur scroll.
 *
 * USE_VIDEO : l'ancien fond video (dream-bg) est conserve derriere ce flag.
 * Si Mika fournit une nouvelle video, il suffit de repasser a true (et le
 * pattern muted iOS via ref callback est deja la). L'overlay 50 % n'a de
 * sens que sur la video : le generatif est deja sombre.
 */

import React, { useCallback, useEffect, useState } from 'react';
import GenerativeBg from './GenerativeBg';

const USE_VIDEO = false;

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const Hero: React.FC = () => {
  // Le hint SCROLL s'efface des que l'utilisateur a compris (premier scroll)
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // iOS Safari : muted doit etre pose en VRAI attribut DOM, React ne le
  // rend pas (piege verifie sur le site v1)
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
      {USE_VIDEO ? (
        <>
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
        </>
      ) : (
        <GenerativeBg />
      )}

      <div className="v2-hero-content">
        <h1 style={{ margin: 0 }}>
          {/* SVG vectoriel (le PNG blanc ne fait que 357px de large) ;
              width/height intrinseques contre le CLS */}
          <img
            className="v2-hero-logo"
            src="/logo/mauditemachine-logo.svg"
            alt="Maudite Machine"
            width={396}
            height={87}
          />
        </h1>

        <div className="v2-hero-tagline">
          <span className="v2-label">Raw. Hypnotic. Underground.</span>
          <span className="v2-label">Canada · France · Spain</span>
        </div>

        <div className="v2-hero-ctas">
          <a className="v2-cta" href="#music">Listen</a>
          <a className="v2-cta" href="#live">Live dates</a>
          <a className="v2-cta" href="#epk">Press kit</a>
        </div>
      </div>

      <div className={`v2-scroll-hint${scrolled ? ' is-done' : ''}`} aria-hidden="true">
        <span className="v2-label">Scroll</span>
      </div>
    </header>
  );
};

export default Hero;
