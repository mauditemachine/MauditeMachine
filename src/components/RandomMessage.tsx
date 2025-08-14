import React, { useEffect, useMemo, useState } from 'react'

type LinkInfo = {
  label: string
  href: string
}

type MessageItem = {
  title: string
  description?: string
  image?: string
  link?: LinkInfo
}

export default function RandomMessage({ className = '' }: { className?: string }): React.ReactElement | null {
  const [items, setItems] = useState<MessageItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState<number>(0)
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    const url = `/medias/messages.json?v=${Date.now()}`
    fetch(url, { cache: 'no-cache' })
      .then(r => r.json())
      .then((data: MessageItem[]) => { if (!cancelled) setItems(Array.isArray(data) ? data : []) })
      .catch(() => {
        if (cancelled) return
        setError('load_failed')
        // Fallback pour garder une visibilité si le JSON ne charge pas
        setItems([
          {
            title: 'Stay tuned',
            description: 'News and announcements coming soon.',
            image: '/medias/images/Simetra.webp'
          }
        ])
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!items || items.length === 0) return
    setIndex(Math.floor(Math.random() * items.length))
  }, [items])

  useEffect(() => {
    if (!items || items.length <= 1) return
    const DISPLAY_MS = 10000
    const FADE_MS = 800
    let fadeTimeoutId: number | null = null
    const intervalId = window.setInterval(() => {
      setIsFadingOut(true)
      fadeTimeoutId = window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % items.length)
        setIsFadingOut(false)
      }, FADE_MS)
    }, DISPLAY_MS)
    return () => {
      clearInterval(intervalId)
      if (fadeTimeoutId) clearTimeout(fadeTimeoutId)
    }
  }, [items])

  const item = useMemo(() => {
    if (!items || items.length === 0) return null
    return items[index % items.length]
  }, [items, index])

  if (!item) return null

  return (
    <section className={`message-card ${className} ${isFadingOut ? 'is-fading' : ''}`} aria-live="polite">
      {item.image ? (
        <img className="message-image" src={item.image} alt={item.title || 'Message'} />
      ) : null}
      <div className="message-body">
        <div className="message-title">{item.title}</div>
        {item.description ? (
          <div className="message-desc">{item.description}</div>
        ) : null}
        {item.link && item.link.href && item.link.label ? (
          <a className="message-link" href={item.link.href} target="_blank" rel="noreferrer">
            {item.link.label}
          </a>
        ) : null}
      </div>
    </section>
  )
}


