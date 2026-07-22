/**
 * eventSchema — genere le JSON-LD schema.org/MusicEvent pour les concerts.
 *
 * Objectif SEO : declencher les "rich results" Google Events. Quand quelqu'un
 * cherche "Maudite Machine concert" ou "DJ Montreal ce weekend", Google peut
 * afficher les dates directement dans les resultats (carrousel evenements).
 *
 * Docs : https://developers.google.com/search/docs/appearance/structured-data/event
 */

import { SITE_URL } from './seo';

export interface UpcomingEvent {
  date: string;      // "2026-07-23"
  title: string;     // "GROOVE & BASS 2026"
  url?: string;      // lien Facebook event
  location: string;  // "Bryson, QC"
  image?: string;    // "events/grooveandbass2026.jpg"
}

const PERFORMER = {
  '@type': 'MusicGroup',
  name: 'Maudite Machine',
  url: SITE_URL,
  sameAs: [
    'https://open.spotify.com/artist/2FHPGWPEBQbCsgkLP9uuI4',
    'https://soundcloud.com/mauditemachine',
    'https://www.instagram.com/mauditemachine/',
  ],
};

/**
 * Parse "Bryson, QC" ou "St Cristaud (France)" en objet Place schema.org.
 * On reste volontairement permissif : Google accepte un Place minimal avec
 * juste un name + address, et une adresse partielle vaut mieux que rien.
 */
function toPlace(location: string) {
  const clean = (location || '').trim();
  // "St Cristaud (France)" -> ville "St Cristaud", pays "France"
  const parenMatch = clean.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    return {
      '@type': 'Place',
      name: parenMatch[1].trim(),
      address: {
        '@type': 'PostalAddress',
        addressLocality: parenMatch[1].trim(),
        addressCountry: parenMatch[2].trim(),
      },
    };
  }
  // "Bryson, QC" -> ville "Bryson", region "QC", pays Canada par defaut
  const commaParts = clean.split(',').map((s) => s.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    return {
      '@type': 'Place',
      name: clean,
      address: {
        '@type': 'PostalAddress',
        addressLocality: commaParts[0],
        addressRegion: commaParts[1],
        addressCountry: 'CA',
      },
    };
  }
  // Lieu simple ("Theatre Paradoxe") : Montreal par defaut (base de l'artiste)
  return {
    '@type': 'Place',
    name: clean || 'Montréal',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Montréal',
      addressRegion: 'QC',
      addressCountry: 'CA',
    },
  };
}

/** Resout une image d'event en URL absolue (requis par schema.org). */
function toAbsoluteImage(image?: string): string {
  if (!image) return `${SITE_URL}/images/og-image.jpg`;
  if (/^https?:\/\//.test(image)) return image;
  return `${SITE_URL}/${image.replace(/^\//, '')}`;
}

/**
 * Construit le tableau de MusicEvent pour les dates a venir.
 * Retourne null si aucun event futur (on n'injecte pas de JSON-LD vide).
 */
export function buildEventsJsonLd(events: UpcomingEvent[]): unknown | null {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter((e) => e?.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (upcoming.length === 0) return null;

  return upcoming.map((e) => ({
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: e.title,
    // Date-only : Google accepte YYYY-MM-DD. Heure inconnue cote data.
    startDate: e.date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: toPlace(e.location),
    image: [toAbsoluteImage(e.image)],
    performer: PERFORMER,
    organizer: {
      '@type': 'Organization',
      name: 'VRSTL Records',
      url: 'https://vrstlrecords.com',
    },
    ...(e.url ? { url: e.url, offers: {
      '@type': 'Offer',
      url: e.url,
      availability: 'https://schema.org/InStock',
      validFrom: new Date().toISOString().slice(0, 10),
    } } : {}),
  }));
}
