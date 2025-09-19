import React, { useEffect, useState } from 'react'
import EventCard from './EventCard'
import { loadEvents } from '../utils/adminApi'

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
  showPastEventsButton?: boolean;
}

export default function EventsDisplay({ limit, showPastEventsButton = false }: EventsDisplayProps): JSX.Element {
  const [events, setEvents] = useState<EventItem[]>([])
  const [pastEvents, setPastEvents] = useState<EventItem[]>([])
  const [showPastEvents, setShowPastEvents] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    
    const loadEventsData = async () => {
      try {
        const data = await loadEvents();
        if (!cancelled) {
          const eventsArray = Array.isArray(data) ? data : [];
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Séparer les événements futurs et passés
          const futureEvents = eventsArray.filter(event => new Date(event.date) >= today);
          const pastEventsArray = eventsArray.filter(event => new Date(event.date) < today);
          
          // Trier les futurs du plus proche au plus lointain
          futureEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          // Trier les passés du plus récent au plus ancien
          pastEventsArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          // Limiter les événements futurs si une limite est spécifiée
          const limitedEvents = typeof limit === 'number' ? futureEvents.slice(0, limit) : futureEvents;
          
          setEvents(limitedEvents);
          setPastEvents(pastEventsArray);
        }
      } catch (error) {
        if (!cancelled) setError('Failed to load events');
      }
    };
    
    loadEventsData();
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
      
      {showPastEventsButton && pastEvents.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <button 
              className="nav-btn"
              onClick={() => setShowPastEvents(!showPastEvents)}
            >
              PAST
            </button>
            <span style={{ color: '#ccc', fontSize: '12px', fontStyle: 'italic' }}>
              Click here to see past events sorted by years
            </span>
          </div>
          
          {showPastEvents && (
            <div className="past-events-container">
              <h4 style={{ color: '#fff', marginBottom: '15px', fontSize: '14px' }}>2025</h4>
              {pastEvents.map((event, index) => (
                <EventCard 
                  key={`past-${index}`} 
                  event={event}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
