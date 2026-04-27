/**
 * TechRiderPage — Bento Box Live Setup / DJ Setup / Hospitality + CTA XXL.
 */

import React from 'react';
import { useTranslation } from '../lib/i18n';
import { cn } from '../lib/cn';

const TECH_RIDER_PDF = `${import.meta.env.BASE_URL}Presskit_Maudite_Machine_2026.pdf`;

const TechRiderPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="pt-24 pb-32 py-20 md:py-32 px-6 md:px-10 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-12 gap-4 md:gap-6 mb-12 md:mb-20">
        {/* LIVE SETUP — col 7 */}
        <div
          className="col-span-12 md:col-span-7 pk-glass p-6 md:p-10 rounded-2xl md:rounded-3xl animate-fade-up"
          style={{ animationDelay: '120ms', animationFillMode: 'both' }}
        >
          <div className="text-xs md:text-sm uppercase tracking-[0.4em] text-ink-50 font-body mb-4 md:mb-6">
            {t.techrider.liveLabel}
          </div>
          <h3 className="font-display font-black uppercase text-ink-95 text-3xl md:text-5xl lg:text-6xl leading-[0.9] tracking-[-0.03em] mb-6 md:mb-10 whitespace-pre-line">
            {t.techrider.liveTitle}
          </h3>
          <ul className="font-body text-base md:text-xl text-ink-95 space-y-2 md:space-y-3">
            <li>— Macbook Pro</li>
            <li>— Ableton Push 3</li>
            <li>— Dreadbox Typhon</li>
            <li>— Akai APC40</li>
          </ul>
        </div>

        {/* DJ SETUP — col 5 */}
        <div
          className="col-span-12 md:col-span-5 pk-glass p-6 md:p-10 rounded-2xl md:rounded-3xl animate-fade-up"
          style={{ animationDelay: '220ms', animationFillMode: 'both' }}
        >
          <div className="text-xs md:text-sm uppercase tracking-[0.4em] text-ink-50 font-body mb-4 md:mb-6">
            {t.techrider.djLabel}
          </div>
          <h3 className="font-display font-black uppercase text-ink-95 text-3xl md:text-5xl lg:text-6xl leading-[0.9] tracking-[-0.03em] mb-6 md:mb-10 whitespace-pre-line">
            {t.techrider.djTitle}
          </h3>
          <ul className="font-body text-sm md:text-base text-ink-95 space-y-2 md:space-y-3">
            <li>
              — {t.techrider.djLine1Main}{' '}
              <span className="text-ink-95 font-medium">{t.techrider.djLine1Variant}</span>
              <span className="text-ink-50"> {t.techrider.djLine1Alt}</span>
            </li>
            <li className="text-ink-50 text-xs md:text-sm uppercase tracking-[0.2em]">
              {t.techrider.djFirmware}
            </li>
            <li className="pt-2">
              — {t.techrider.djMixerMain}{' '}
              <span className="font-medium">{t.techrider.djMixerPrimary}</span>
              <span className="text-ink-50">{t.techrider.djMixerAlt}</span>
            </li>
          </ul>
        </div>

        {/* HOSPITALITY — col 12 quote italic */}
        <div
          className="col-span-12 pk-glass p-8 md:p-14 rounded-2xl md:rounded-3xl animate-fade-up"
          style={{ animationDelay: '320ms', animationFillMode: 'both' }}
        >
          <div className="text-xs md:text-sm uppercase tracking-[0.4em] text-ink-50 font-body mb-4 md:mb-6">
            {t.techrider.hospitalityLabel}
          </div>
          <blockquote className="font-display italic text-ink-95 text-2xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] max-w-4xl">
            <span className="text-ink-30">« </span>
            {t.techrider.hospitalityQuote}
            <span className="text-ink-30"> »</span>
          </blockquote>
        </div>
      </div>

      {/* XXL DOWNLOAD CTA */}
      <a
        href={TECH_RIDER_PDF}
        download
        aria-label={t.techrider.ctaAria}
        className={cn(
          'group block relative rounded-2xl md:rounded-3xl overflow-hidden',
          'border border-ink-10 hover:border-ink-30',
          'bg-glass backdrop-blur-heavy backdrop-saturate-glass',
          'transition-all duration-500 ease-out-expo',
          'hover:shadow-glow-white hover:bg-glass-strong',
          'no-underline text-inherit',
          'animate-fade-up',
        )}
        style={{ animationDelay: '440ms', animationFillMode: 'both' }}
      >
        <div className="relative p-8 md:p-14 lg:p-20">
          <div className="flex items-center justify-between mb-6 md:mb-10 text-xs md:text-sm uppercase tracking-[0.3em] text-ink-50 font-body">
            <span>{t.techrider.ctaMeta}</span>
            <span>{t.techrider.ctaEdition}</span>
          </div>

          <div
            className={cn(
              'font-display font-black uppercase whitespace-pre-line',
              'text-[clamp(2.25rem,8vw,9rem)] md:text-[clamp(3rem,6vw,8rem)]',
              'leading-[0.85] tracking-[-0.045em]',
              'text-ink-30 group-hover:text-ink-95',
              'transition-colors duration-700 ease-out-expo',
              'group-hover:[text-shadow:_0_4px_40px_rgba(255,255,255,0.25)]',
            )}
          >
            {t.techrider.ctaTitle}
          </div>

          <div className="mt-8 md:mt-12 flex items-center justify-between">
            <span className="text-sm md:text-base text-ink-70 font-body">
              {t.techrider.ctaFooter}
            </span>
            <span className="inline-flex items-center justify-center w-14 h-14 md:w-20 md:h-20 rounded-full border border-ink-20 group-hover:border-ink-95 text-ink-85 group-hover:text-ink-95 transition-colors duration-500">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="transform group-hover:translate-y-1 transition-transform duration-400 ease-out-expo">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </span>
          </div>
        </div>
      </a>
    </section>
  );
};

export default TechRiderPage;
