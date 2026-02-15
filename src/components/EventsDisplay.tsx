import React, { useEffect, useState, useRef, useCallback } from 'react'
import EventCard from './EventCard'
import { loadEvents } from '../utils/adminApi'
import { useApp } from '../context/AppContext'

type EventItem = {
  date: string
  title: string
  url: string
  location: string
  color: string
  image?: string
}

type PastShow = {
  name: string
  date: string
  venue: string
  city: string
  lineup?: string[]
  facebook_event?: string
}

type YearData = {
  year: number
  shows: PastShow[]
}

type PastEventsData = {
  events: YearData[]
}

interface EventsDisplayProps {
  limit?: number;
  showPastEventsButton?: boolean;
}

export default function EventsDisplay({ limit, showPastEventsButton = false }: EventsDisplayProps): JSX.Element {
  const { t } = useApp()
  const [events, setEvents] = useState<EventItem[]>([])
  const [pastEventsData, setPastEventsData] = useState<YearData[]>([])
  const [showPastEvents, setShowPastEvents] = useState(false)
  const [expandedYears, setExpandedYears] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [bubbleStyle, setBubbleStyle] = useState<React.CSSProperties>({ opacity: 0 })
  const yearsBarRef = useRef<HTMLDivElement>(null)
  const yearBtnRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  useEffect(() => {
    let cancelled = false
    
    const loadEventsData = async () => {
      try {
        // Charger les événements à venir
        const data = await loadEvents();
        if (!cancelled) {
          const eventsArray = Array.isArray(data) ? data : [];
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const todayString = `${year}-${month}-${day}`;
          
          const futureEvents = eventsArray.filter(event => event.date >= todayString);
          futureEvents.sort((a, b) => a.date.localeCompare(b.date));
          const limitedEvents = typeof limit === 'number' ? futureEvents.slice(0, limit) : futureEvents;
          setEvents(limitedEvents);
        }

        // Charger les événements passés
        const pastResponse = await fetch('/past-events.json');
        if (pastResponse.ok) {
          const pastData: PastEventsData = await pastResponse.json();
          if (!cancelled && pastData.events) {
            // Trier par année décroissante
            const sortedYears = pastData.events.sort((a, b) => b.year - a.year);
            // Trier les shows de chaque année par date décroissante
            sortedYears.forEach(yearData => {
              yearData.shows.sort((a, b) => b.date.localeCompare(a.date));
            });
            setPastEventsData(sortedYears);
          }
        }
      } catch (error) {
        if (!cancelled) setError('Failed to load events');
      }
    };
    
    loadEventsData();
    return () => { cancelled = true }
  }, [limit])

  const updateBubble = useCallback((year: number | null) => {
    if (!year || !yearsBarRef.current) {
      setBubbleStyle({ opacity: 0, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' })
      return
    }
    const btn = yearBtnRefs.current.get(year)
    const bar = yearsBarRef.current
    if (btn && bar) {
      const barRect = bar.getBoundingClientRect()
      const btnRect = btn.getBoundingClientRect()
      setBubbleStyle({
        opacity: 1,
        left: btnRect.left - barRect.left,
        top: btnRect.top - barRect.top,
        width: btnRect.width,
        height: btnRect.height,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      })
    }
  }, [])

  const toggleYear = (year: number) => {
    setExpandedYears(prev => {
      const isClosing = prev.includes(year)
      const next = isClosing ? prev.filter(y => y !== year) : [year]
      // Update bubble after state change
      setTimeout(() => updateBubble(isClosing ? null : year), 0)
      return next
    })
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  const getTotalShows = () => {
    return pastEventsData.reduce((acc, year) => acc + year.shows.length, 0);
  };

  if (error) return <div>{t.events.errorLoading}</div>

  return (
    <div className="events-display">
      {/* Événements à venir */}
      {events.length > 0 && (
        <div className="upcoming-events">
          {events.map((event, index) => (
            <EventCard 
              key={index} 
              event={event}
            />
          ))}
        </div>
      )}
      
      {/* Section événements passés */}
      {showPastEventsButton && pastEventsData.length > 0 && (
        <div className="past-events-section">
          {/* Barre horizontale des années */}
          <div className="past-years-bar" ref={yearsBarRef}>
            <div className="past-years-bubble" style={bubbleStyle} />
            {pastEventsData.map((yearData) => (
              <button
                key={yearData.year}
                ref={(el) => { if (el) yearBtnRefs.current.set(yearData.year, el) }}
                className={`past-year-btn ${expandedYears.includes(yearData.year) ? 'active' : ''}`}
                onClick={() => toggleYear(yearData.year)}
              >
                {yearData.year}
              </button>
            ))}
          </div>

          {/* Shows de l'année sélectionnée */}
          {pastEventsData.map((yearData) => (
            expandedYears.includes(yearData.year) && (
              <div key={yearData.year} className="year-shows">
                {yearData.shows.map((show, idx) => (
                  <a
                    key={idx}
                    href={show.facebook_event || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="past-show-card"
                  >
                    <div className="show-date">{formatDate(show.date)}</div>
                    <div className="show-details">
                      <div className="show-name">{show.name}</div>
                      <div className="show-venue">{show.venue}, {show.city}</div>
                      {show.lineup && show.lineup.length > 0 && (
                        <div className="show-lineup">
                          w/ {show.lineup.slice(0, 4).join(', ')}
                          {show.lineup.length > 4 && '...'}
                        </div>
                      )}
                    </div>
                    {show.facebook_event && (
                      <div className="show-link">
                        <i className="fab fa-facebook"></i>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
