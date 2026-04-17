import { useEffect, useRef } from 'react'
import { useApp, THEMES } from '../context/AppContext'

interface JellyfishBackgroundProps {
  src?: string
  poster?: string
}

/**
 * Fond video meduses fullscreen avec teinte adaptative selon le theme.
 * Utilise CSS filter (hue-rotate + saturate + brightness) pour recolorer
 * la video en live - aucun re-encodage necessaire.
 */
export default function JellyfishBackground({
  src = '/videos/jellyfish.mp4',
  poster,
}: JellyfishBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { theme } = useApp()
  const t = THEMES[theme]

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
