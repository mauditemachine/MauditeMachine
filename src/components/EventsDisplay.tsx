import React, { useEffect, useState } from 'react'
import EventCard from './EventCard'

type EventItem = {
  date: string
  title: string
  url: string
  location: string
  color: string
  image?: string
}

interface EventsDisplayProps {
  limit?: number;
}

export default function EventsDisplay({ limit }: EventsDisplayProps): JSX.Element {
  const [events, setEvents] = useState<EventItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/medias/events.json', { cache: 'no-cache' })
      .then(r => r.json())
      .then((data: EventItem[]) => { 
        if (!cancelled) {
          const eventsArray = Array.isArray(data) ? data : [];
          // Limiter les événements si une limite est spécifiée
          const limitedEvents = limit ? eventsArray.slice(0, limit) : eventsArray;
          setEvents(limitedEvents);
        }
      })
      .catch(() => { 
        if (!cancelled) setError('Failed to load events') 
      })
    return () => { cancelled = true }
  }, [limit])

  if (error) return <div>Error loading events</div>

  return (
    <div className="events-display">
      {events.map((event, index) => (
        <EventCard 
          key={index} 
          event={event}
        />
      ))}
    </div>
  )
}
