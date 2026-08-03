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
  // Frame extraite de la video : si la lecture est bloquee (iOS economie
  // d'energie, reduced motion), on voit les meduses figees, jamais un fond uni.
  poster = '/videos/dream-bg-poster.jpg',
}: JellyfishBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Safari iOS n'autoplay que si l'attribut muted est REELLEMENT dans le DOM.
  // Or React ne rend pas la prop muted en attribut (bug connu) : on force les
  // deux (propriete + attribut) des que l'element existe, via un ref callback.
  const attachVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el
    if (el) {
      el.muted = true
      el.setAttribute('muted', '')
      el.setAttribute('playsinline', '')
    }
  }

  // Choix de la source selon la largeur d'ecran
  const [src] = useState(() => {
    if (typeof window === 'undefined') return srcHd
    return window.innerWidth <= 900 ? srcMobile : srcHd
  })

  useEffect(() => {
    // Forcer le play apres mount (certains navigateurs bloquent autoplay sans interaction)
    const v = videoRef.current
    if (!v) return

    try {
      const playPromise = v.play()
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {})
    } catch {}

    // Fallback iOS (economie d'energie, autoplay bloque) : a CHAQUE geste,
    // si la video est en pause, on retente. Pas de { once: true }, et les
    // listeners restent pour toute la vie du composant : iOS en mode
    // economie d'energie peut re-suspendre la video en cours de session,
    // le prochain tap la relance. Cout nul (listeners passifs).
    const retry = () => {
      if (v.paused) {
        try {
          const p = v.play()
          if (p && typeof p.catch === 'function') p.catch(() => {})
        } catch {}
      }
    }
    document.addEventListener('click', retry, { passive: true })
    document.addEventListener('touchstart', retry, { passive: true })
    return () => {
      document.removeEventListener('click', retry)
      document.removeEventListener('touchstart', retry)
    }
  }, [])

  return (
    <div className="jellyfish-bg" aria-hidden="true">
      {/*
        Video : zoom 1.03x + decalage -8px x / +8px y pour pousser le watermark
        "rip Meditation" (coin bas-gauche) hors du cadre visible.
        Le transform compose avec le translate(-50%, -50%) de centrage CSS.
      */}
      <video
        ref={attachVideo}
        className="jellyfish-video"
        src={src}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        style={{
          transform: 'translate(calc(-50% - 8px), calc(-50% + 8px)) scale(1.03)',
        }}
      />
      {/* Overlay global (existant) : gradient vertical doux */}
      <div className="jellyfish-overlay" />
      {/*
        Masque watermark : degrade noir dense en bas-gauche, transparent ailleurs.
        bg-gradient-to-tr = de bottom-left vers top-right, donc from-black/90
        se place dans le coin bas-gauche (la ou etait "rip Meditation").
      */}
      <div
        className="absolute inset-0 bg-gradient-to-tr from-black/90 via-transparent to-transparent pointer-events-none"
        aria-hidden="true"
      />
    </div>
  )
}
