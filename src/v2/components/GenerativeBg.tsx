/**
 * Background generatif du hero /v2 : canvas 2D pur, zero lib.
 *
 * Direction : lignes/ondes horizontales qui pulsent lentement, blanc casse
 * tres discret sur #0A0A0A, avec une bande de focus qui derive verticalement
 * (sensation de balayage hypnotique, esthetique signal/oscilloscope).
 *
 * Perf : ~24 courbes x ~90 segments par frame (trivial en 2D), DPR cap 2
 * desktop / 1.5 mobile, moins de lignes sous 768px, boucle rAF avec delta
 * borne (pas de saut au retour d'onglet), pause explicite quand l'onglet
 * est cache, premiere frame dessinee de maniere synchrone au mount.
 * prefers-reduced-motion : pas de canvas, degrade statique sombre.
 */

import React, { useEffect, useRef } from 'react';

const REDUCED = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Line {
  base: number; // position verticale relative (0..1)
  amp: number; // amplitude de base en px
  k: number; // frequence spatiale
  k2: number; // frequence spatiale secondaire
  speed: number; // vitesse de phase
  pulse: number; // frequence de pulsation d'amplitude
  off: number; // dephasage
}

const buildLines = (count: number): Line[] =>
  Array.from({ length: count }, (_, i) => {
    // Pseudo-aleatoire deterministe (pas de Math.random : rendu stable)
    const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const r2 = Math.abs(Math.sin(i * 78.233) * 12543.2571) % 1;
    const r3 = Math.abs(Math.sin(i * 39.425) * 26251.4133) % 1;
    return {
      base: (i + 0.5) / count,
      amp: 7 + r1 * 16,
      k: 0.0035 + r2 * 0.004,
      k2: 0.011 + r3 * 0.009,
      speed: 0.000045 + r1 * 0.00006,
      pulse: 0.00006 + r2 * 0.00009,
      off: r3 * Math.PI * 2,
    };
  });

const GenerativeBg: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = REDUCED();

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = false;
    let t = 0; // temps accumule (ms), borne pour rester continu
    let last = 0;
    let lines: Line[] = [];
    let W = 0;
    let H = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // Onglet charge en arriere-plan : le layout peut encore etre a 0,
      // on retombe sur le viewport pour ne pas figer un canvas de 1px
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      const mobile = w < 768;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
      W = Math.max(1, Math.round(w));
      H = Math.max(1, Math.round(h));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lines = buildLines(mobile ? 13 : 24);
    };

    const draw = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 1;

      // Bande de focus qui derive verticalement (periode ~75 s)
      const focus = 0.5 + 0.42 * Math.sin(t * 0.0000838);
      const step = Math.max(10, Math.round(W / 90));

      for (const ln of lines) {
        const baseY = ln.base * H;
        // Amplitude pulsee lentement
        const amp = ln.amp * (0.55 + 0.45 * Math.sin(t * ln.pulse + ln.off));
        // Plus proche du focus = plus visible
        const prox = Math.max(0, 1 - Math.abs(ln.base - focus) * 4.5);
        const alpha = 0.035 + 0.075 * (amp / 23) + 0.16 * prox * prox;
        ctx.strokeStyle = `rgba(242, 240, 235, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        for (let x = 0; x <= W + step; x += step) {
          const y =
            baseY +
            amp * Math.sin(x * ln.k + ln.off + t * ln.speed) +
            amp * 0.35 * Math.sin(x * ln.k2 - t * ln.speed * 1.7 + ln.off * 2);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    const loop = (now: number) => {
      if (!running) return;
      // Delta borne : pas de bond apres une suspension d'onglet
      t += Math.min(now - last, 50);
      last = now;
      draw();
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running) return;
      // Re-mesure au reveil : les callbacks ResizeObserver ne firent pas
      // tant que l'onglet n'a pas de cycle de rendu
      resize();
      draw();
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };

    resize();
    draw(); // premiere frame synchrone : jamais de hero vide
    if (document.visibilityState === 'visible') start();

    const onWindowResize = () => {
      resize();
      draw();
    };

    const ro = new ResizeObserver(onWindowResize);
    ro.observe(canvas);
    // resize window fire meme sans cycle de rendu (contrairement au RO)
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      ro.disconnect();
      window.removeEventListener('resize', onWindowResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  if (reduced) {
    return <div className="v2-hero-fallback" aria-hidden="true" />;
  }

  return <canvas ref={canvasRef} className="v2-hero-canvas" aria-hidden="true" />;
};

export default GenerativeBg;
