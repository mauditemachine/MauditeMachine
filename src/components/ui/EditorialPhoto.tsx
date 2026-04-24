/**
 * EditorialPhoto — bloc photo "double-page magazine" full-width avec parallax au scroll.
 *
 * - useScroll + useTransform (framer-motion) reagit au scroll global, donc
 *   fonctionne meme sans animation de mount (ce qui est fiable dans ce codebase).
 * - Limite translate en y a ~60px pour rester subtil, pas brusque.
 * - Container rounded-2xl/3xl, border ink-10, overflow-hidden.
 * - Label magazine optionnel en bas.
 */

import React, { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { cn } from '../../lib/cn'

interface EditorialPhotoProps {
  src: string
  alt: string
  /** Texte magazine optionnel superpose en bas */
  caption?: string
  /** Numero de spread magazine (ex "N° 03") */
  issueTag?: string
  /** Hauteur du bloc en vh — default 70 */
  heightVh?: number
  className?: string
}

const EditorialPhoto: React.FC<EditorialPhotoProps> = ({
  src,
  alt,
  caption,
  issueTag,
  heightVh = 70,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null)

  // Parallax scroll : la photo bouge de +/- 40px autour de sa position "idle"
  // quand on scroll sur la hauteur du bloc.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], ['-8%', '8%'])

  return (
    <div
      ref={ref}
      className={cn(
        'relative w-full overflow-hidden',
        'rounded-2xl md:rounded-3xl',
        'border border-ink-10',
        'bg-black/40',
        className,
      )}
      style={{ height: `${heightVh}vh`, minHeight: 360 }}
    >
      {/* Image parallax : un peu plus haute que le container pour absorber le translate */}
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        style={{ y }}
        className="absolute inset-0 w-full h-[120%] -top-[10%] object-cover"
      />

      {/* Vignette haut + bas pour lisibilite */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60 pointer-events-none" />

      {/* Tag magazine (coin haut-gauche) */}
      {issueTag && (
        <div className="absolute top-5 md:top-8 left-5 md:left-8 text-xs md:text-sm font-semibold uppercase tracking-[0.3em] text-white/90">
          {issueTag}
        </div>
      )}

      {/* Caption magazine (coin bas) — whitespace-pre-line pour gerer les \n */}
      {caption && (
        <div className="absolute bottom-5 md:bottom-10 left-5 md:left-10 right-5 md:right-10 max-w-3xl">
          <div className="font-display font-black uppercase text-white text-[clamp(1.25rem,3.5vw,3rem)] leading-[0.95] tracking-[-0.03em] whitespace-pre-line [text-shadow:_0_2px_20px_rgba(0,0,0,0.6)]">
            {caption}
          </div>
        </div>
      )}
    </div>
  )
}

export default EditorialPhoto
