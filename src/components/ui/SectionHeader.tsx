/**
 * SectionHeader — titre titanesque avec reveal cinematique au scroll.
 *
 * Typographie magazine brutaliste (clamp(3rem, 12vw, 12rem)) uppercase
 * font-black tracking serré leading dense. Reveal par masque
 * (overflow-hidden + y translate) via framer-motion whileInView.
 *
 * Structure :
 *   - kicker (petit tag en tete : "02 / Presskit")
 *   - title (le mot massif)
 *   - subtitle optionnel (petit texte sous le titre)
 */

import React from 'react'
import { cn } from '../../lib/cn'

interface SectionHeaderProps {
  /** Numero de section (ex "02") */
  number?: string
  /** Tag descriptif (ex "Presskit / About") */
  kicker?: string
  /** Titre massif */
  title: string
  /** Sous-titre optionnel */
  subtitle?: string
  align?: 'left' | 'center'
  className?: string
  /** Force le tag H2 ou permettre override */
  as?: 'h1' | 'h2' | 'h3'
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  number,
  kicker,
  title,
  subtitle,
  align = 'left',
  className,
  as = 'h2',
}) => {
  const Tag = as as any
  const words = title.split(/\s+/)

  return (
    <header
      className={cn(
        'w-full',
        align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      {/* Kicker : fade-up au mount */}
      {(number || kicker) && (
        <div
          className={cn(
            'flex items-center gap-3 mb-4 md:mb-6',
            'text-sm md:text-sm font-body',
            'uppercase tracking-[0.4em] text-ink-50',
            'animate-fade-up',
            align === 'center' && 'justify-center',
          )}
          style={{ animationFillMode: 'both' }}
        >
          {number && <span>{number}</span>}
          {number && kicker && <span className="opacity-40">/</span>}
          {kicker && <span>{kicker}</span>}
        </div>
      )}

      {/* Titre massif : reveal par masque + stagger par mot, via CSS keyframe */}
      <Tag
        className={cn(
          'font-body font-black uppercase',
          'text-ink-95',
          'leading-[0.85] tracking-[-0.035em]',
          'text-[18vw] sm:text-[14vw] md:text-[11vw] lg:text-[10vw]',
          'max-[400px]:text-[22vw]',
          'xl:text-[10rem]',
        )}
      >
        {words.map((word, i) => (
          <span
            key={i}
            className="inline-block overflow-hidden align-baseline pb-[0.08em]"
            style={{ marginRight: i < words.length - 1 ? '0.2em' : undefined }}
          >
            <span
              className="inline-block will-change-transform animate-[reveal-y_0.9s_cubic-bezier(0.19,1,0.22,1)_both]"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {word}
            </span>
          </span>
        ))}
      </Tag>

      {/* Subtitle : fade-up delayed */}
      {subtitle && (
        <p
          className={cn(
            'mt-5 md:mt-6 font-body',
            'text-base md:text-lg text-ink-70',
            'max-w-2xl',
            'animate-fade-up',
            align === 'center' && 'mx-auto',
          )}
          style={{
            animationDelay: `${300 + words.length * 90}ms`,
            animationFillMode: 'both',
          }}
        >
          {subtitle}
        </p>
      )}
    </header>
  )
}

export default SectionHeader
