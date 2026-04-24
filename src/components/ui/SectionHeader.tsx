/**
 * SectionHeader — titre titanesque avec reveal cinematique au scroll.
 *
 * Typographie magazine brutaliste (clamp(3rem, 12vw, 12rem)) uppercase
 * font-black tracking serré leading dense. Reveal par masque
 * (overflow-hidden + y translate) via CSS keyframe reveal-y.
 *
 * Structure minimaliste :
 *   - title (le mot massif)
 *   - subtitle optionnel (petit texte sous le titre)
 *
 * Les kickers ("02 / Presskit · About") ont ete retires pour un look
 * plus minimaliste. Les props `number` et `kicker` sont conservees pour
 * backward-compat mais ignorees (deprecated).
 */

import React from 'react'
import { cn } from '../../lib/cn'

interface SectionHeaderProps {
  /** @deprecated Retire du rendu — conserve pour compat */
  number?: string
  /** @deprecated Retire du rendu — conserve pour compat */
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
      {/* Titre massif : reveal par masque + stagger par mot, via CSS keyframe */}
      <Tag
        className={cn(
          'font-display font-black uppercase',
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
