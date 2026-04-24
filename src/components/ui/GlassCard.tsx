/**
 * GlassCard — wrapper generique liquid-glass avec hover premium.
 *
 * - bg-glass-strong + backdrop-blur + saturate 0.6 (tue le bleu jellyfish)
 * - border qui s'illumine au hover (ink-8 → ink-30)
 * - shadow glow white soft au hover
 * - lift -4px au hover (Framer Motion spring)
 * - Entrance : CSS keyframe `animate-fade-up` + delay par index (stagger)
 * - supporte <a>, <div>, onClick
 */

import React, { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  href?: string
  onClick?: (e: React.MouseEvent) => void
  target?: string
  rel?: string
  /** Active le lift au hover. Default: true. */
  hoverable?: boolean
  /** Taille du lift en px. Default: 4. */
  liftPx?: number
  /** Index pour stagger de l'entree (optionnel). 0-based. */
  index?: number
  /** Delay entre chaque card en ms. Default 80ms. */
  staggerMs?: number
  'aria-label'?: string
}

const GlassCard = forwardRef<HTMLElement, GlassCardProps>(
  (
    {
      children,
      className,
      href,
      onClick,
      target,
      rel,
      hoverable = true,
      liftPx = 4,
      index = 0,
      staggerMs = 80,
      'aria-label': ariaLabel,
    },
    ref,
  ) => {
    const baseClasses = cn(
      'relative block overflow-hidden rounded-2xl',
      'bg-glass-strong backdrop-blur-glass backdrop-saturate-glass',
      'border border-ink-8',
      'text-inherit no-underline',
      'transition-[border-color,box-shadow] duration-400 ease-out-expo',
      'animate-fade-up',
      hoverable && 'hover:border-ink-30 hover:shadow-glow-white-soft',
      className,
    )

    const entranceStyle: React.CSSProperties = {
      animationDelay: `${index * staggerMs}ms`,
      animationFillMode: 'both',
    }

    const hoverProps = hoverable
      ? { whileHover: { y: -liftPx }, transition: { type: 'spring' as const, stiffness: 400, damping: 28 } }
      : {}

    if (href) {
      return (
        <motion.a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          target={target}
          rel={rel}
          onClick={onClick}
          aria-label={ariaLabel}
          className={baseClasses}
          style={entranceStyle}
          {...hoverProps}
        >
          {children}
        </motion.a>
      )
    }

    return (
      <motion.div
        ref={ref as React.Ref<HTMLDivElement>}
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(baseClasses, onClick && 'cursor-pointer')}
        style={entranceStyle}
        {...hoverProps}
      >
        {children}
      </motion.div>
    )
  },
)

GlassCard.displayName = 'GlassCard'

export default GlassCard

// Compat : export conserve (unused par default maintenant)
export const staggerContainerVariants = {}
