import { useEffect, useRef, useState } from 'react'

interface JellyfishBackgroundProps {
  srcHd?: string
  srcMobile?: string
  poster?: string
}

/**
 * Fond video fullscreen — ping-pong loop 14s (forward 7s + reverse 7s encode baked).
 * Le fichier dream-bg-1080/720.mp4 contient deja le ping-pong pre-encode par ffmpeg,
 * donc un simple <video loop> suffit.
 *
 * 1080p (3.4MB) sur desktop, 720p (1.3MB) sur mobile.
 */
export default function JellyfishBackground({
  srcHd = '/videos/dream-bg-1080.mp4',
  srcMobile = '/videos/dream-bg-720.mp4',
  poster,
}: JellyfishBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

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
      />
      <div className="jellyfish-overlay" />
    </div>
  )
}
