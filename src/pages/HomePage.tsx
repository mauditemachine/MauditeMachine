/**
 * HomePage — page d'accueil "couverture d'album" 100vh sans scroll.
 * Contenu : logo + WE ARE MUSIC MAKERS (Robot Radicals) + slogan + tagline.
 * Le fond meduses + lecteur audio sont rendus par Layout (persistents).
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
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
        'relative w-full h-screen',
        'flex flex-col items-center justify-center text-center gap-6',
        'px-6',
      )}
    >
      {/* 1. Logo MAUDITE MACHINE */}
      <motion.img
        src={import.meta.env.BASE_URL + 'logo/LogoStack.svg'}
        alt="Maudite Machine"
        className="w-[85vw] max-w-[780px] h-auto"
        style={{
          filter: 'brightness(0) invert(1) drop-shadow(0 4px 24px rgba(0,0,0,0.4))',
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.0, ease: [0.19, 1, 0.22, 1], delay: 0.1 }}
      />

      {/* 2. WE ARE MUSIC MAKERS — Robot Radicals 30px blanc tracking 4px */}
      <motion.h2
        className={cn(
          'font-robot uppercase',
          'text-[30px]',
          'tracking-[4px]',
          'text-white',
          'leading-none',
          '[text-shadow:_0_2px_12px_rgba(0,0,0,0.5)]',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.0, ease: [0.19, 1, 0.22, 1], delay: 0.35 }}
      >
        {t.signature.musicMakers}
      </motion.h2>

      {/* 3. RAW. HYPNOTIC. UNDERGROUND. — font-semibold 600 */}
      <motion.div
        className={cn(
          'text-white font-semibold uppercase',
          'tracking-[0.3em]',
          'text-sm md:text-base',
          '[text-shadow:_0_2px_12px_rgba(0,0,0,0.45)]',
          'mt-2',
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.7 }}
      >
        {t.presskit.catchphrase}
      </motion.div>

      {/* 4. Tagline 3 lignes — DJ & Producer / Montreal / genres */}
      <motion.div
        className={cn(
          'flex flex-col items-center gap-1.5 md:gap-2',
          'font-semibold uppercase tracking-[0.25em]',
          'text-base md:text-lg',
          'text-white/80',
          '[text-shadow:_0_2px_12px_rgba(0,0,0,0.45)]',
          'mt-2',
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease: 'easeOut', delay: 0.9 }}
      >
        <span>{t.signature.role}</span>
        <span className="text-white/60">{t.signature.location}</span>
        <span className="text-white/50 text-sm md:text-base tracking-[0.3em]">
          {t.signature.genres}
        </span>
      </motion.div>
    </section>
  );
};

export default HomePage;
