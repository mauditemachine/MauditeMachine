import React, { useEffect, useMemo, useState } from 'react'

type EventItem = {
  date: string // ISO 8601
  title: string
  url: string
  location: string
}

export default function Events(): JSX.Element {
  const [items, setItems] = useState<EventItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/medias/events.json', { cache: 'no-cache' })
      .then(r => r.json())
      .then((data: EventItem[]) => { if (!cancelled) setItems(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setError('') })
    return () => { cancelled = true }
  }, [])

  const upcoming = useMemo(() => {
    const now = new Date().getTime()
    return items
      .map(e => ({ ...e, time: new Date(e.date).getTime() }))
      .filter(e => !isNaN(e.time) && e.time >= now)
      .sort((a, b) => a.time - b.time)
      .slice(0, 8)
  }, [items])

  if (error) return <div className="events-grid" aria-live="polite" />

  return (
    <div className="events-grid" aria-live="polite">
      {upcoming.map((ev, idx) => (
        <a key={ev.title + ev.date}
           className={`event-card pos-${idx}`}
           href={ev.url}
           target="_blank"
           rel="noreferrer"
        >
          <div className="event-date">{new Date(ev.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          <div className="event-title">{ev.title}</div>
          <div className="event-loc">{ev.location}</div>
        </a>
      ))}
    </div>
  )
}


