import { useEffect, useMemo, useState } from 'react'

interface HeroSlideshowProps {
  images: string[]
  intervalMs?: number
  shuffled?: boolean
}

export default function HeroSlideshow({
  images,
  intervalMs = 6000,
  shuffled = true,
}: HeroSlideshowProps) {
  const slides = useMemo(() => {
    if (!shuffled || images.length <= 1) return images
    // Garde la première image en premier, shuffle le reste
    const [first, ...rest] = images
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[rest[i], rest[j]] = [rest[j], rest[i]]
    }
    return [first, ...rest]
  }, [images, shuffled])

  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, intervalMs)
    return () => clearInterval(id)
  }, [slides.length, intervalMs])

  useEffect(() => {
    const next = (index + 1) % slides.length
    const img = new Image()
    img.src = slides[next]
  }, [index, slides])

  if (slides.length === 0) return null

  return (
    <div className="hero-slideshow" aria-hidden="true">
      {slides.map((src, i) => (
        <div
          key={src}
          className={`hero-slide ${i === index ? 'active' : ''}`}
          style={{ backgroundImage: `url(${src})` }}
        />
      ))}
      <div className="hero-slideshow-overlay" />
    </div>
  )
}
