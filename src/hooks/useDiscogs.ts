// hooks/useDiscogs.ts - VERSION FIXÉE
import { useState, useEffect, useCallback, useMemo } from 'react';

export interface DiscogsRelease {
  id: number;
  title: string;
  cleanTitle: string;
  artist: string;
  year?: number;
  type: 'master' | 'release';
  category: 'Album' | 'Single' | 'EP' | 'Remix' | 'Compilation';
  format: string;
  role: string;
  thumb?: string;
  coverImage?: string;
  discogsUrl: string;
  resourceUrl: string;
  duration?: string;
  trackCount?: number;
  labels: Array<{
    name: string;
    catno?: string;
    id: number;
  }>;
  genres: string[];
  styles: string[];
  community?: {
    have: number;
    want: number;
  };
}

export interface DiscographyStats {
  total: number;
  albums: number;
  singles: number;
  eps: number;
  remixes: number;
  compilations: number;
  years: number[];
  yearRange: string;
  labels: Record<string, number>;
  topGenres: Array<{ genre: string; count: number }>;
}

const ARTIST_ID = '5831599';
const API_KEY = 'aYRSRvOTkEpilgDiyjUQ';
const API_SECRET = 'SVtLcCbgUHndVVIoNujcgjjuRnFdhNcW';
const CACHE_DURATION = 60 * 60 * 1000; // 1 heure

export const useDiscogs = () => {
  const [releases, setReleases] = useState<DiscogsRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState('all');

  // Fonction de nettoyage sécurisée
  const cleanTitle = (title: string | undefined): string => {
    if (!title || typeof title !== 'string') return 'Titre non disponible';
    return title.replace(/^Maudite Machine\s*[-–]\s*/i, '').trim();
  };

  // Catégorisation sécurisée
  const categorizeRelease = (release: any, format: string): DiscogsRelease['category'] => {
    const title = (release?.title || '').toLowerCase();
    
    if (title.includes('remix') || title.includes('rmx')) return 'Remix';
    if (title.includes('compilation') || format.includes('Compilation')) return 'Compilation';
    if (title.includes(' ep') || title.includes('ep ') || format === 'EP') return 'EP';
    if (release?.type === 'master' || format === 'LP' || format === 'Album') return 'Album';
    if (format === 'Single' || title.includes('single')) return 'Single';
    
    return 'Single'; // Fallback sécurisé
  };

  // Amélioration d'image sécurisée
  const getHighQualityImage = (thumbUrl?: string): string | undefined => {
    if (!thumbUrl || typeof thumbUrl !== 'string') return undefined;
    
    try {
      return thumbUrl
        .replace('/150x150/', '/500x500/')
        .replace('quality(40)', 'quality(95)')
        .replace('filters:strip_icc()', 'filters:strip_icc():format(webp)');
    } catch {
      return thumbUrl; // Fallback vers l'original si erreur
    }
  };

  // Récupération des détails d'une release (durée, tracklist, URI)
  const fetchReleaseDetails = async (releaseId: number): Promise<{duration?: string, trackCount?: number, discogsUrl?: string}> => {
    try {
      const headers = {
        'Authorization': `Discogs key=${API_KEY}, secret=${API_SECRET}`,
        'User-Agent': 'MauditeMachine/2.0 +https://mauditemachine.com',
      };

      const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, { headers });
      
      if (!response.ok) {
        return {};
      }

      const data = await response.json();
      
      let duration, trackCount;
      if (data.tracklist && Array.isArray(data.tracklist)) {
        const tracks = data.tracklist.filter((track: any) => track.type_ === 'track');
        const totalDuration = tracks.find((track: any) => track.duration)?.duration;
        
        duration = totalDuration || undefined;
        trackCount = tracks.length || undefined;
      }
      
      return {
        duration,
        trackCount,
        discogsUrl: data.uri || undefined
      };
    } catch (error) {
      console.warn(`Impossible de récupérer les détails pour la release ${releaseId}:`, error);
      return {};
    }
  };

  // Traitement sécurisé d'une release
  const processRelease = (release: any): DiscogsRelease | null => {
    try {
      // Vérifications de sécurité
      if (!release || typeof release !== 'object') {
        console.warn('Release invalide:', release);
        return null;
      }

      if (!release.id) {
        console.warn('Release sans ID:', release);
        return null;
      }

      const basicInfo = release.basic_information || {};
      const format = basicInfo.formats?.[0]?.name || release.type || 'Release';
      const category = categorizeRelease(release, format);
      
      // Construction sécurisée de l'objet
      const processedRelease: DiscogsRelease = {
        id: release.id,
        title: release.title || 'Titre non disponible',
        cleanTitle: cleanTitle(release.title),
        artist: release.artist || 'Maudite Machine',
        year: release.year || basicInfo.year || undefined,
        type: release.type || 'release',
        category,
        format,
        role: release.role || 'Main',
        thumb: release.thumb || basicInfo.thumb,
        coverImage: getHighQualityImage(release.thumb || basicInfo.thumb),
        discogsUrl: release.resource_url 
          ? release.resource_url.replace('api.discogs.com', 'www.discogs.com').replace('/releases/', '/release/')
          : `https://www.discogs.com/release/${release.id}`,
        resourceUrl: release.resource_url || basicInfo.resource_url || '',
        duration: undefined, // Sera rempli plus tard si nécessaire
        trackCount: undefined, // Sera rempli plus tard si nécessaire
        labels: Array.isArray(basicInfo.labels) ? basicInfo.labels : [],
        genres: Array.isArray(basicInfo.genres) ? basicInfo.genres : [],
        styles: Array.isArray(basicInfo.styles) ? basicInfo.styles : [],
        community: release.community || undefined,
      };

      return processedRelease;
    } catch (error) {
      console.error('Erreur lors du traitement de la release:', error, release);
      return null;
    }
  };

  // Fetch sécurisé
  const fetchReleases = useCallback(async (): Promise<DiscogsRelease[]> => {
    try {
      console.log('🎵 Début du fetch Discogs...');
      
      const allReleases: any[] = [];
      let page = 1;
      let hasMore = true;
      const maxPages = 10; // Limite de sécurité

      const headers = {
        'Authorization': `Discogs key=${API_KEY}, secret=${API_SECRET}`,
        'User-Agent': 'MauditeMachine/2.0 +https://mauditemachine.com',
      };

      while (hasMore && page <= maxPages) {
        const url = `https://api.discogs.com/artists/${ARTIST_ID}/releases?sort=year&sort_order=desc&per_page=100&page=${page}`;
        
        console.log(`📡 Fetch page ${page}...`);
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          if (response.status === 429) {
            console.log('⏳ Rate limit atteint, attente...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Vérification de la structure des données
        if (!data || typeof data !== 'object') {
          throw new Error('Réponse API invalide');
        }

        if (!Array.isArray(data.releases)) {
          console.warn('Pas de releases dans la réponse:', data);
          break;
        }

        console.log(`✅ Page ${page}: ${data.releases.length} releases`);
        allReleases.push(...data.releases);
        
        hasMore = Boolean(data.pagination?.urls?.next);
        page++;
        
        // Rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
      }

      console.log(`🎯 Total releases récupérées: ${allReleases.length}`);

      // Traitement sécurisé de toutes les releases
      const processedReleases = allReleases
        .map(processRelease)
        .filter((release): release is DiscogsRelease => release !== null)
        .sort((a, b) => {
          if (a.year !== b.year) {
            return (b.year || 0) - (a.year || 0);
          }
          return a.cleanTitle.localeCompare(b.cleanTitle);
        });

      console.log(`✨ Releases traitées: ${processedReleases.length}`);
      
      // Enrichir les 10 releases les plus récentes avec les détails de durée
      const recentReleases = processedReleases.slice(0, 10);
      const enrichedReleases = [...processedReleases];
      
      for (let i = 0; i < recentReleases.length; i++) {
        try {
          const details = await fetchReleaseDetails(recentReleases[i].id);
          enrichedReleases[i] = {
            ...enrichedReleases[i],
            duration: details.duration,
            trackCount: details.trackCount,
            discogsUrl: details.discogsUrl || enrichedReleases[i].discogsUrl
          };
          
          // Rate limiting pour les détails
          if (i < recentReleases.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1200));
          }
        } catch (error) {
          console.warn(`Erreur lors de l'enrichissement de la release ${recentReleases[i].id}:`, error);
        }
      }
      
      console.log(`🎯 Releases enrichies avec durées: ${recentReleases.length}`);
      return enrichedReleases;

    } catch (error) {
      console.error('💥 Erreur fetch:', error);
      throw error;
    }
  }, []);

  // Chargement principal
  const loadDiscography = useCallback(async (useCache = true) => {
    setLoading(true);
    setError(null);

    try {
      // Vérification du cache
      if (useCache) {
        const cacheKey = 'maudite-machine-discography';
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION) {
              console.log('📦 Utilisation du cache');
              setReleases(data);
              setLoading(false);
              return;
            }
          } catch {
            localStorage.removeItem(cacheKey);
          }
        }
      }

      // Fetch depuis l'API
      const freshReleases = await fetchReleases();
      setReleases(freshReleases);

      // Sauvegarde en cache
      try {
        const cacheKey = 'maudite-machine-discography';
        localStorage.setItem(cacheKey, JSON.stringify({
          data: freshReleases,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.warn('Cache storage failed:', error);
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement';
      setError(message);
      console.error('Erreur discographie:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchReleases]);

  // Releases filtrées
  const filteredReleases = useMemo(() => {
    if (currentFilter === 'all') return releases;
    return releases.filter(release => 
      release.category.toLowerCase() === currentFilter.toLowerCase()
    );
  }, [releases, currentFilter]);

  // Recherche
  const searchReleases = useCallback((query: string): DiscogsRelease[] => {
    if (!query.trim()) return releases;
    
    const lowerQuery = query.toLowerCase();
    return releases.filter(release =>
      release.cleanTitle.toLowerCase().includes(lowerQuery) ||
      release.genres.some(genre => genre.toLowerCase().includes(lowerQuery)) ||
      release.styles.some(style => style.toLowerCase().includes(lowerQuery)) ||
      release.labels.some(label => label.name.toLowerCase().includes(lowerQuery))
    );
  }, [releases]);

  // Stats sécurisées
  const stats: DiscographyStats = useMemo(() => {
    const labelCounts: Record<string, number> = {};
    const genreCounts: Record<string, number> = {};
    
    const categoryCounts = releases.reduce((acc, release) => {
      acc[release.category] = (acc[release.category] || 0) + 1;
      
      // Comptage des labels
      release.labels.forEach(label => {
        if (label?.name) {
          labelCounts[label.name] = (labelCounts[label.name] || 0) + 1;
        }
      });
      
      // Comptage des genres
      release.genres.forEach(genre => {
        if (genre) {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        }
      });
      
      return acc;
    }, {} as Record<string, number>);

    const years = [...new Set(releases.map(r => r.year).filter(Boolean))].sort();
    const yearRange = years.length > 0 ? `${years[0]} - ${years[years.length - 1]}` : '';

    const topGenres = Object.entries(genreCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));

    return {
      total: releases.length,
      albums: categoryCounts.Album || 0,
      singles: categoryCounts.Single || 0,
      eps: categoryCounts.EP || 0,
      remixes: categoryCounts.Remix || 0,
      compilations: categoryCounts.Compilation || 0,
      years,
      yearRange,
      labels: labelCounts,
      topGenres,
    };
  }, [releases]);

  // Refetch forcé
  const refetch = useCallback(() => loadDiscography(false), [loadDiscography]);

  // Chargement initial
  useEffect(() => {
    loadDiscography();
  }, [loadDiscography]);

  return {
    releases,
    filteredReleases,
    stats,
    loading,
    error,
    currentFilter,
    setFilter: setCurrentFilter,
    refetch,
    searchReleases,
  };
};