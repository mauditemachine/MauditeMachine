/**
 * EventCard — carte d'evenement Pro Max en Tailwind + GlassCard.
 *
 * Design monochrome blanc/verre. Le event.color (venant de Sanity)
 * est utilise uniquement comme fin liseré gauche subtil, pas sur
 * le titre ou la date.
 */

import React, { useState } from 'react'
import { cn } from '../lib/cn'
import GlassCard from './ui/GlassCard'

interface Event {
  date: string
  title: string
  url: string
  location: string
  color: string
  image?: string
}

interface EventCardProps {
  event: Event
  index?: number
}

const formatDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map((n) => parseInt(n))
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const EventCard: React.FC<EventCardProps> = ({ event, index = 0 }) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  // URL absolue (Sanity CDN) → laisser tel quel; sinon prefix "/"
  const displayImage =
    event.image && event.image.trim() !== ''
      ? /^https?:\/\//.test(event.image) || event.image.startsWith('/')
        ? event.image
        : `/${event.image}`
      : null

  return (
    <GlassCard
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${event.title}, ${formatDate(event.date)}`}
      className="group"
      index={index}
    >
      {/* Fin liseré vertical de couleur event.color — hyper subtil */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[3px] opacity-60 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundColor: event.color || 'rgba(255,255,255,0.3)' }}
      />

      {/* Banner image */}
      {displayImage && (
        <div className="relative w-full aspect-video overflow-hidden bg-black/40">
          <img
            src={displayImage}
            alt={event.title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={cn(
              'absolute inset-0 w-full h-full object-cover',
              'transition-[opacity,transform] duration-700 ease-out-expo',
              imageLoaded && !imageError ? 'opacity-100' : 'opacity-0',
              'group-hover:scale-105',
            )}
          />
          {(!imageLoaded || imageError) && (
            <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">
              🎵
            </div>
          )}
          {/* Gradient overlay pour lisibilite sur bord bas */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Details */}
      <div className="relative p-5 md:p-6 pl-6 md:pl-7">
        <div className="text-sm font-medium text-ink-70 mb-2 font-body">
          {formatDate(event.date)}
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-ink-95 mb-2 leading-tight font-body">
          {event.title}
        </h3>
        <div className="text-sm text-ink-70 font-body">
          {event.location}
        </div>
      </div>
    </GlassCard>
  )
}

export default EventCard
