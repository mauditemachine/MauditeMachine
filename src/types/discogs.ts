/**
 * Types pour l'API Discogs et la discographie Maudite Machine
 */

export interface DiscogsApiResponse {
  releases: DiscogsApiRelease[];
  pagination: {
    page: number;
    per_page: number;
    pages: number;
    items: number;
    urls: {
      next?: string;
      prev?: string;
    };
  };
}

export interface DiscogsApiRelease {
  id: number;
  status: string;
  type: 'master' | 'release';
  format: string;
  label: string;
  title: string;
  role: string;
  artist: string;
  year?: number;
  resource_url: string;
  basic_information: {
    id: number;
    title: string;
    year: number;
    formats: Array<{
      name: string;
      qty: string;
      descriptions?: string[];
    }>;
    labels: Array<{
      name: string;
      catno: string;
      entity_type: string;
      id: number;
    }>;
    artists: Array<{
      name: string;
      id: number;
    }>;
    genres: string[];
    styles: string[];
    thumb: string;
    cover_image: string;
  };
}

export interface DiscogsRelease {
  id: number;
  title: string;
  cleanTitle: string;
  artist: string;
  year?: number;
  type: 'master' | 'release';
  category: 'Album' | 'Single' | 'EP' | 'Remix' | 'Compilation' | 'Other';
  format: string;
  coverImage?: string;
  discogsUrl: string;
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
  totalReleases: number;
  albums: number;
  singles: number;
  eps: number;
  remixes: number;
  compilations: number;
  other: number;
  firstRelease?: number;
  latestRelease?: number;
  topGenres: Array<{ genre: string; count: number }>;
  topLabels: Array<{ label: string; count: number }>;
}

export interface DiscographyFilters {
  searchQuery: string;
  category: 'All' | 'Album' | 'Single' | 'EP' | 'Remix' | 'Compilation' | 'Other';
  sortBy: 'year' | 'title' | 'format';
  sortOrder: 'asc' | 'desc';
  viewMode: 'grid' | 'list';
}

export interface UseDiscogsReturn {
  releases: DiscogsRelease[];
  filteredReleases: DiscogsRelease[];
  stats: DiscographyStats | null;
  loading: boolean;
  error: string | null;
  filters: DiscographyFilters;
  setFilters: (filters: Partial<DiscographyFilters>) => void;
  refetch: () => Promise<void>;
}

export interface CacheData {
  releases: DiscogsRelease[];
  timestamp: number;
  ttl: number;
}
