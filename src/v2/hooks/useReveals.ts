/**
 * Reveals GSAP + ScrollTrigger /v2 : entree du hero, apparition sobre des
 * tetes de section et des listes au scroll. Tout est desactive si
 * prefers-reduced-motion (le contenu reste visible : les etats initiaux
 * sont poses par GSAP au runtime, pas par le CSS).
 */

import { RefObject, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function useReveals(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!rootRef.current) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Entree du hero au chargement
      gsap.from('.v2-hero-content > *', {
        autoAlpha: 0,
        y: 26,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.12,
        delay: 0.15,
        clearProps: 'all',
      });

      // Tetes de section : fade-up a l'entree dans le viewport
      gsap.utils.toArray<HTMLElement>('.v2-section-head').forEach((el) => {
        gsap.from(el, {
          autoAlpha: 0,
          y: 28,
          duration: 0.8,
          ease: 'power3.out',
          clearProps: 'all',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      });

      // Listes (gigs, downloads, galerie) : stagger discret par lot.
      // Les lignes de la matrice n'y sont pas : elles remontent au changement
      // de filtre et doivent rester instantanees.
      ScrollTrigger.batch('.v2-gig-row, .v2-download, .v2-gallery-item', {
        start: 'top 92%',
        once: true,
        onEnter: (els) =>
          gsap.from(els, {
            autoAlpha: 0,
            y: 18,
            duration: 0.55,
            ease: 'power2.out',
            stagger: 0.05,
            clearProps: 'all',
          }),
      });
    }, rootRef);

    return () => ctx.revert();
  }, [rootRef]);
}
