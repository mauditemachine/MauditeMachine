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
    // Onglet cache au mount (ouverture en arriere-plan, previews) : rAF est
    // gele, un gsap.from resterait fige a opacity 0. On saute les entrances,
    // le contenu est simplement visible quand l'onglet le devient.
    if (document.visibilityState === 'hidden') return;

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

      // Tetes de section : chaque type a son timing propre (les reveals
      // uniformes lisaient comme mecaniques). Titre geant : glissement
      // lateral bref ; label droit : fondu decale.
      gsap.utils.toArray<HTMLElement>('.v2-section-head').forEach((el) => {
        const title = el.querySelector('.v2-section-title');
        const label = el.querySelector(':scope > .v2-label, :scope > a');
        const trigger = { trigger: el, start: 'top 88%', once: true };
        if (title) {
          gsap.from(title, {
            autoAlpha: 0,
            x: -30,
            duration: 0.7,
            ease: 'power3.out',
            clearProps: 'all',
            scrollTrigger: trigger,
          });
        }
        if (label) {
          gsap.from(label, {
            autoAlpha: 0,
            duration: 0.6,
            delay: 0.18,
            ease: 'power2.out',
            clearProps: 'all',
            scrollTrigger: trigger,
          });
        }
      });

      // Listes (gigs, downloads) : stagger discret par lot. Les lignes de
      // la matrice n'y sont pas : elles remontent au changement de filtre
      // et doivent rester instantanees.
      ScrollTrigger.batch('.v2-gig-row, .v2-download', {
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

      // Galerie : entree en damier (ordre aleatoire, leger scale)
      ScrollTrigger.batch('.v2-gallery-item, .v2-merch-card', {
        start: 'top 92%',
        once: true,
        onEnter: (els) =>
          gsap.from(els, {
            autoAlpha: 0,
            scale: 0.965,
            y: 14,
            duration: 0.6,
            ease: 'power2.out',
            stagger: { each: 0.07, from: 'random' },
            clearProps: 'all',
          }),
      });
    }, rootRef);

    return () => ctx.revert();
  }, [rootRef]);
}
