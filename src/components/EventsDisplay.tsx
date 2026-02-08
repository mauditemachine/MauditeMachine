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
  const [events, setEvents] = useState<EventItem[]>([])
  const [pastEventsData, setPastEventsData] = useState<YearData[]>([])
  const [showPastEvents, setShowPastEvents] = useState(false)
  const [expandedYears, setExpandedYears] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

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

  const toggleYear = (year: number) => {
    setExpandedYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year]
    );
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

  if (error) return <div>Error loading events</div>

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
          <button 
            className="past-events-toggle"
            onClick={() => setShowPastEvents(!showPastEvents)}
          >
            <span className="toggle-icon">{showPastEvents ? '−' : '+'}</span>
            <span className="toggle-text">Past Events</span>
            <span className="toggle-count">{getTotalShows()} shows</span>
          </button>
          
          {showPastEvents && (
            <div className="past-events-timeline">
              {pastEventsData.map((yearData) => (
                <div key={yearData.year} className="year-section">
                  <button 
                    className={`year-header ${expandedYears.includes(yearData.year) ? 'expanded' : ''}`}
                    onClick={() => toggleYear(yearData.year)}
                  >
                    <span className="year-number">{yearData.year}</span>
                    <span className="year-count">{yearData.shows.length} shows</span>
                    <span className="year-arrow">{expandedYears.includes(yearData.year) ? '▼' : '▶'}</span>
                  </button>
                  
                  {expandedYears.includes(yearData.year) && (
                    <div className="year-shows">
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
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
