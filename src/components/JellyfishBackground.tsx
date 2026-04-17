import { useEffect, useRef, useState } from 'react'
import { useApp, THEMES } from '../context/AppContext'

interface JellyfishBackgroundProps {
  srcHd?: string
  srcMobile?: string
  poster?: string
}

/**
 * Fond video meduses fullscreen avec teinte adaptative selon le theme.
 * Sert la version 4K sur desktop, 1080p sur mobile (economie de data).
 * Utilise grayscale(1) + multiply overlay pour teinter dynamiquement.
 */
export default function JellyfishBackground({
  srcHd = '/videos/jellyfish.mp4',         // 4K (16MB)
  srcMobile = '/videos/jellyfish-1080.mp4', // 1080p (7.6MB)
  poster,
}: JellyfishBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { theme } = useApp()
  const t = THEMES[theme]

  // Choix de la source selon la largeur d'ecran
  const [src] = useState(() => {
    if (typeof window === 'undefined') return srcHd
    return window.innerWidth <= 900 ? srcMobile : srcHd
  })

  useEffect(() => {
    // Forcer le play apres mount (certains navigateurs bloquent autoplay sans interaction)
    const v = videoRef.current
    if (!v) return
    const playPromise = v.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay bloque - retenter au premier click sur le document
        const retry = () => {
          v.play().catch(() => {})
          document.removeEventListener('click', retry)
          document.removeEventListener('touchstart', retry)
        }
        document.addEventListener('click', retry, { once: true })
        document.addEventListener('touchstart', retry, { once: true })
      })
    }
  }, [])

  // Grayscale + multiply overlay = teinte exacte et predictible
  const filter = `grayscale(${t.grayscale}) brightness(${t.brightness}) contrast(${t.contrast})`

  return (
    <div className="jellyfish-bg" aria-hidden="true">
      <video
        ref={videoRef}
        className="jellyfish-video"
        src={src}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        style={{ filter }}
      />
      {/* Teinte par multiply: garde la luminance du video, remplace la couleur */}
      <div
        className="jellyfish-tint-mul"
        style={{ background: t.tint }}
      />
      <div className="jellyfish-overlay" />
      {/* Glow subtil au centre avec la couleur swatch */}
      <div
        className="jellyfish-glow"
        style={{ background: `radial-gradient(ellipse at center, ${t.swatch}22 0%, transparent 55%)` }}
      />
    </div>
  )
}
