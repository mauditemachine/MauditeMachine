/**
 * Curseur custom /v2 : point (position directe) + cercle (poursuite LERP
 * via requestAnimationFrame, transform: translate3d). Le cercle grossit au
 * survol des elements cliquables (a, button, [data-cursor]).
 *
 * Desactive si : pointeur grossier (touch), viewport < 768px, ou
 * prefers-reduced-motion. Le CSS masque aussi en ceinture.
 */

import React, { useEffect, useRef, useState } from 'react';

const enabled = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: fine)').matches &&
  window.innerWidth >= 768 &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const Cursor: React.FC = () => {
  const [active] = useState(enabled);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      // Le point suit sans latence
      dot.style.transform = `translate3d(${mx - 3}px, ${my - 3}px, 0)`;
    };

    // Grossit sur les cibles interactives (delegation : survit aux re-renders)
    const isInteractive = (el: EventTarget | null) =>
      el instanceof Element && !!el.closest('a, button, [data-cursor], input, select, [role="button"]');
    const onOver = (e: MouseEvent) => {
      ring.classList.toggle('is-hover', isInteractive(e.target));
    };

    const loop = () => {
      // LERP : le cercle rattrape la souris a 18 % par frame
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      const half = ring.offsetWidth / 2;
      ring.style.transform = `translate3d(${rx - half}px, ${ry - half}px, 0)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      cancelAnimationFrame(raf);
    };
  }, [active]);

  if (!active) return null;

  return (
    <>
      <div ref={dotRef} className="v2-cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="v2-cursor-ring" aria-hidden="true" />
    </>
  );
};

export default Cursor;
