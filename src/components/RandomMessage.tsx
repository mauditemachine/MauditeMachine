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

export default function RandomMessage({ className = '', offset = 0, items: presetItems, rotateMs = 6000 }: { className?: string; offset?: number; items?: MessageItem[]; rotateMs?: number }): React.ReactElement | null {
  const [items, setItems] = useState<MessageItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState<number>(0)
  const [isFadingOut] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    if (presetItems && presetItems.length > 0) {
      setItems(presetItems)
      return
    }
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
  }, [presetItems])

  useEffect(() => {
    if (!items || items.length === 0) return
    // Démarre sur le premier item (ex: New Album), pour un ordre contrôlé
    setIndex(0)
  }, [items])

  // Rotation simple (sans effet) si plusieurs items
  useEffect(() => {
    if (!items || items.length <= 1) return
    const id = window.setInterval(() => {
      setIndex(prev => (prev + 1) % items.length)
    }, Math.max(2000, rotateMs))
    return () => clearInterval(id)
  }, [items, rotateMs])

  const item = useMemo(() => {
    if (!items || items.length === 0) return null
    const base = index % items.length
    const withOffset = (base + (offset % items.length) + items.length) % items.length
    return items[withOffset]
  }, [items, index, offset])

  if (!item) return null

  return (
    <section className={`message-card ${className}`} aria-live="polite">
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


