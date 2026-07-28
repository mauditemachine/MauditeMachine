/**
 * HomePage — page d'accueil "couverture d'album" 100vh sans scroll.
 * Contenu : logo + WE ARE MUSIC MAKERS (Robot Radicals) + slogan + tagline.
 * Le fond meduses + lecteur audio sont rendus par Layout (persistents).
 *
 * Entrances en CSS animate-fade-up (PAS framer-motion : le pattern
 * initial->animate au mount ne se declenche pas de facon fiable dans ce
 * codebase — StrictMode + Vite HMR — et laissait la page a opacity 0).
 */

import React, { useEffect } from 'react';
import { useTranslation } from '../lib/i18n';
import { cn } from '../lib/cn';

const HomePage: React.FC = () => {
  const { t } = useTranslation();

  // Lock body scroll while on Home (100vh strict, pas de scroll)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <section
      className={cn(
        'relative w-full',
        'h-screen h-[100svh]', // svh : small viewport height stable sur iOS Safari (URL bar)
        'flex flex-col items-center justify-center text-center',
        'gap-4 sm:gap-6',
        'px-4 sm:px-6',
      )}
    >
      {/* H1 SEO : lu par Google et les lecteurs d'ecran, invisible a l'oeil.
          Le logo juste en dessous joue le role de titre visuel. */}
      <h1 className="sr-only">{t.headings.home}</h1>

      {/* 1. Logo MAUDITE MACHINE — pleine largeur ecran sur mobile */}
      <img
        src={import.meta.env.BASE_URL + 'logo/LogoStack.svg'}
        alt="Maudite Machine"
        className="w-[92vw] max-w-[780px] h-auto animate-fade-up"
        style={{
          filter: 'brightness(0) invert(1) drop-shadow(0 4px 24px rgba(0,0,0,0.4))',
          animationDelay: '100ms',
          animationFillMode: 'both',
        }}
      />

      {/* 2. WE ARE MUSIC MAKERS — Robot Radicals 30px blanc tracking 4px */}
      <h2
        className={cn(
          'font-robot',
          'text-[30px]',
          'tracking-[4px]',
          'text-white',
          'leading-none',
          '[text-shadow:_0_2px_12px_rgba(0,0,0,0.5)]',
          'animate-fade-up',
        )}
        style={{ animationDelay: '350ms', animationFillMode: 'both' }}
      >
        {t.signature.musicMakers}
      </h2>

      {/* 3. RAW. HYPNOTIC. UNDERGROUND. — la string est en caps (signature
          brand), pas de classe uppercase ni de tracking geant */}
      <div
        className={cn(
          'text-white font-semibold',
          'tracking-widest',
          'text-xs md:text-sm',
          '[text-shadow:_0_2px_12px_rgba(0,0,0,0.45)]',
          'mt-1',
          'animate-fade-up',
        )}
        style={{ animationDelay: '600ms', animationFillMode: 'both' }}
      >
        {t.presskit.catchphrase}
      </div>

      {/* 4. Tagline 3 lignes — casse normale, tracking discret, weight 600 */}
      <div
        className={cn(
          'flex flex-col items-center gap-1 md:gap-1.5',
          'font-semibold tracking-wide',
          'text-xs md:text-sm',
          'text-white/85',
          '[text-shadow:_0_2px_12px_rgba(0,0,0,0.45)]',
          'mt-1',
          'animate-fade-up',
        )}
        style={{ animationDelay: '800ms', animationFillMode: 'both' }}
      >
        <span>{t.signature.role}</span>
        <span className="text-white/70">{t.signature.location}</span>
        <span className="text-white/60">{t.signature.genres}</span>
      </div>
    </section>
  );
};

export default HomePage;
