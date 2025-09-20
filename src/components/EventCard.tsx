/**
 * Composant pour afficher un événement avec son image
 */

import React, { useState } from 'react';

interface Event {
  date: string;
  title: string;
  url: string;
  location: string;
  color: string;
  image?: string;
}

interface EventCardProps {
  event: Event;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Utiliser l'image du JSON directement (medias/ est le publicDir)
  const displayImage = event.image && event.image.trim() !== '' ? event.image : null;

  return (
    <div className="event-card">
      <a 
        href={event.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="event-link"
      >
        <div className="event-content">
          {displayImage && (
            <div className="event-banner">
              <img
                src={displayImage}
                alt={event.title}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                style={{
                  opacity: imageLoaded && !imageError ? 1 : 0,
                  transition: 'opacity 0.3s ease'
                }}
              />
              {(!imageLoaded || imageError) && (
                <div className="event-placeholder">
                  <span className="event-emoji">🎵</span>
                </div>
              )}
            </div>
          )}
          
          <div className="event-details">
            <div className="event-date" style={{ color: event.color }}>
              {formatDate(event.date)}
            </div>
            <div className="event-title" style={{ color: event.color }}>
              {event.title}
            </div>
            <div className="event-location">
              {event.location}
            </div>
          </div>
        </div>
      </a>
    </div>
  );
};

export default EventCard;
