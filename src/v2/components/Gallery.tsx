/**
 * Galerie /v2 : grille lazy + lightbox custom (zero lib). Clavier : Echap
 * ferme, fleches naviguent. Le focus revient sur la vignette d'origine a
 * la fermeture. Photos artiste existantes de public/images/ (les thumbs
 * n'existent que pour 3 fichiers : on sert les full-res 1600px, lazy).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

const PHOTOS = [
  { src: '/images/presskit-hero.webp', alt: 'Maudite Machine, portrait presskit' },
  { src: '/images/presskit-performance.webp', alt: 'Maudite Machine en performance live' },
  { src: '/images/presskit-portrait2.webp', alt: 'Maudite Machine, portrait studio' },
  { src: '/images/MauditeMachine-1.webp', alt: 'Maudite Machine, photo editoriale 1' },
  { src: '/images/MauditeMachine-2.webp', alt: 'Maudite Machine, photo editoriale 2' },
  { src: '/images/MauditeMachine-8.webp', alt: 'Maudite Machine, photo editoriale 3' },
];

const Gallery: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastThumbRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpenIndex(null);
    lastThumbRef.current?.focus();
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    setOpenIndex((i) => (i === null ? i : (i + dir + PHOTOS.length) % PHOTOS.length));
  }, []);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [openIndex, close, step]);

  return (
    <section className="v2-section" id="gallery">
      <div className="v2-section-head">
        <h2 className="v2-section-title">Gallery</h2>
        <span className="v2-label">{PHOTOS.length} photos</span>
      </div>

      <div className="v2-gallery">
        {PHOTOS.map((p, i) => (
          <button
            key={p.src}
            type="button"
            className="v2-gallery-item"
            aria-label={`Agrandir : ${p.alt}`}
            onClick={(e) => {
              lastThumbRef.current = e.currentTarget;
              setOpenIndex(i);
            }}
          >
            <img src={p.src} alt={p.alt} loading="lazy" decoding="async" />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          ref={dialogRef}
          className="v2-lightbox"
          style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
          role="dialog"
          aria-modal="true"
          aria-label={PHOTOS[openIndex].alt}
          tabIndex={-1}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <img
            className="v2-lightbox-img"
            src={PHOTOS[openIndex].src}
            alt={PHOTOS[openIndex].alt}
          />
          <span className="v2-label v2-lightbox-count">
            {openIndex + 1} / {PHOTOS.length}
          </span>
          <button
            type="button"
            className="v2-player-btn v2-lightbox-close"
            aria-label="Fermer la galerie"
            onClick={close}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <button
            type="button"
            className="v2-player-btn v2-lightbox-prev"
            aria-label="Photo précédente"
            onClick={() => step(-1)}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="1.6" fill="none" />
            </svg>
          </button>
          <button
            type="button"
            className="v2-player-btn v2-lightbox-next"
            aria-label="Photo suivante"
            onClick={() => step(1)}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M6 2l6 6-6 6" stroke="currentColor" strokeWidth="1.6" fill="none" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
};

export default Gallery;
