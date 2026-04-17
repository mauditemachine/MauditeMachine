import { useEffect } from 'react'

/**
 * Liquid Glass engine - Apple WWDC25 inspired.
 *
 * Ce composant fait 2 choses :
 * 1. Injecte un <svg> avec un filter de deplacement pour la refraction des bords
 * 2. Attache des listeners mousemove (desktop) + deviceorientation (mobile)
 *    pour que les specular highlights suivent le curseur/tilt sur tout element
 *    qui porte la classe .liquid-glass
 *
 * Chaque .liquid-glass element expose 2 CSS variables --lg-x et --lg-y
 * (0-100% de sa propre bounding box) que le CSS utilise pour positionner
 * le highlight radial.
 */
export default function LiquidGlass() {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const els = document.querySelectorAll<HTMLElement>('.liquid-glass')
      els.forEach((el) => {
        const rect = el.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        el.style.setProperty('--lg-x', `${x.toFixed(1)}%`)
        el.style.setProperty('--lg-y', `${y.toFixed(1)}%`)
      })
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // gamma: -90..90 (left-right tilt), beta: -180..180 (front-back tilt)
      const { gamma, beta } = e
      if (gamma == null || beta == null) return
      const x = Math.min(100, Math.max(0, 50 + (gamma / 45) * 25))
      const y = Math.min(100, Math.max(0, 50 + ((beta - 45) / 45) * 25))
      document.documentElement.style.setProperty('--lg-global-x', `${x.toFixed(1)}%`)
      document.documentElement.style.setProperty('--lg-global-y', `${y.toFixed(1)}%`)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('deviceorientation', handleOrientation, { passive: true })

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [])

  return (
    <svg
      aria-hidden="true"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    >
      <defs>
        {/* Filter subtil pour courber les bords du glass */}
        <filter id="liquid-edge" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.012"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="8"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Filter plus fort pour hover */}
        <filter id="liquid-edge-strong" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02 0.02"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="1.5" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="14"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}
