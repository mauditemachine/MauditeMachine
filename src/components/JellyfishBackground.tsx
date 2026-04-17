import { useEffect, useRef, useState } from 'react'

interface JellyfishBackgroundProps {
  srcHd?: string
  srcMobile?: string
  poster?: string
}

/**
 * Fond video meduses fullscreen - couleurs naturelles de la source.
 * Sert 1080p sur desktop, 720p sur mobile (economie de data).
 */
export default function JellyfishBackground({
  srcHd = '/videos/jellyfish.mp4',          // 1080p (14MB)
  srcMobile = '/videos/jellyfish-1080.mp4', // 720p (8.6MB)
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
