import { useState, useEffect } from 'react';

export interface BandcampTrack {
  id: string;
  title: string;
  artist: string;
  trackId: string;
  linkColor: string;
  url: string;
  type?: 'album' | 'track';
}

// Cache global pour éviter de recharger
let cachedTracks: BandcampTrack[] | null = null;
let cachePromise: Promise<BandcampTrack[]> | null = null;

const loadTracksFromJSON = async (): Promise<BandcampTrack[]> => {
  if (cachedTracks) {
    return cachedTracks;
  }

  if (cachePromise) {
    return cachePromise;
  }

  cachePromise = (async () => {
    try {
      const response = await fetch('/bandcamp.json', {
        cache: 'force-cache' // Forcer le cache navigateur
      });
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des tracks Bandcamp');
      }
      const data = await response.json();
      cachedTracks = data;
      return data;
    } catch (err) {
      cachePromise = null; // Reset en cas d'erreur
      throw err;
    }
  })();

  return cachePromise;
};

export const useBandcampTracks = () => {
  const [tracks, setTracks] = useState<BandcampTrack[]>(cachedTracks || []);
  const [loading, setLoading] = useState(!cachedTracks);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedTracks) {
      // Déjà en cache, pas besoin de charger
      return;
    }

    const loadTracks = async () => {
      try {
        setLoading(true);
        const data = await loadTracksFromJSON();
        setTracks(data);
        setError(null);
      } catch (err) {
        console.error('Erreur chargement Bandcamp:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    loadTracks();
  }, []);

  return { tracks, loading, error };
};
