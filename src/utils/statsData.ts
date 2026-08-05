/**
 * Donnees du dashboard stats (/mm-admin/stats).
 *
 * Deux fichiers, deux niveaux d'exposition :
 * - public/data/stats-public.json : followers, streams, geo, posts.
 *   Versionne et servi par GitHub Pages -> consultable en prod.
 * - data/stats-private.json : revenus Ditto. LOCAL UNIQUEMENT (gitignore),
 *   lu via le serveur d'ecriture local (npm run admin), jamais en prod.
 *
 * Les snapshots sont produits par scripts/fetch-stats.mjs (cron GitHub
 * Actions quotidien ou refresh manuel local) et par l'import CSV manuel
 * (Ditto, Bandcamp, TikTok) via l'admin local.
 */

export type SourceStatus = 'ok' | 'unavailable' | 'disabled';

export interface SourceBase {
  status: SourceStatus;
  /** Message court quand status != ok (cle manquante, API en panne...) */
  error?: string;
}

export interface YouTubeStats extends SourceBase {
  subscribers?: number;
  totalViews?: number;
  videoCount?: number;
  videos?: Array<{
    id: string;
    title: string;
    publishedAt: string;
    thumbnail: string;
    views: number;
    likes: number;
    comments: number;
  }>;
}

export interface SpotifyStats extends SourceBase {
  followers?: number;
  popularity?: number;
  topTracks?: Array<{
    id: string;
    title: string;
    album: string;
    cover: string;
    popularity: number;
  }>;
}

export interface InstagramStats extends SourceBase {
  followers?: number;
  reach?: number;
  impressions?: number;
  posts?: Array<{
    id: string;
    type: string;
    caption: string;
    timestamp: string;
    thumbnail: string;
    permalink: string;
    likes: number;
    comments: number;
    shares?: number;
    saves?: number;
    plays?: number;
  }>;
  audience?: {
    cities?: Record<string, number>;
    countries?: Record<string, number>;
    ages?: Record<string, number>;
  };
}

export interface FacebookStats extends SourceBase {
  followers?: number;
  reach?: number;
}

export interface SoundCloudStats extends SourceBase {
  followers?: number;
  tracks?: Array<{
    id: number;
    title: string;
    plays: number;
    likes: number;
    reposts: number;
  }>;
}

/** Geo YouTube Analytics (OAuth) : vues par pays sur les 90 derniers jours. */
export interface YouTubeGeo extends SourceBase {
  countries?: Record<string, number>;
}

export interface Snapshot {
  generatedAt: string;
  /** 'cron' | 'manual' | 'seed' */
  origin: string;
  youtube: YouTubeStats;
  youtubeGeo: YouTubeGeo;
  spotify: SpotifyStats;
  instagram: InstagramStats;
  facebook: FacebookStats;
  soundcloud: SoundCloudStats;
}

/** Donnees des CSV manuels, sans les revenus (qui restent en prive local). */
export interface ManualData {
  /** Ditto : streams par plateforme et par pays (fenetre du rapport importe) */
  ditto?: {
    importedAt: string;
    period?: string;
    streamsByPlatform: Record<string, number>;
    streamsByCountry: Record<string, number>;
  };
  bandcamp?: {
    importedAt: string;
    plays: number;
    sales: number;
  };
  tiktok?: {
    importedAt: string;
    followers?: number;
    videoViews?: number;
    profileViews?: number;
    likes?: number;
  };
}

export interface StatsPublic {
  snapshots: Snapshot[];
  manual: ManualData;
}

/** Revenus Ditto, local uniquement. */
export interface StatsPrivate {
  dittoRevenue: Array<{
    importedAt: string;
    period?: string;
    total: number;
    currency: string;
    byPlatform: Record<string, number>;
    byCountry: Record<string, number>;
  }>;
}

export const EMPTY_STATS: StatsPublic = { snapshots: [], manual: {} };

const isLocalhost = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/** Charge l'historique public (fichier statique, partout). */
export async function loadStatsPublic(): Promise<StatsPublic> {
  const res = await fetch(`/data/stats-public.json?t=${Date.now()}`);
  if (!res.ok) return EMPTY_STATS;
  const data = await res.json();
  return {
    snapshots: Array.isArray(data.snapshots) ? data.snapshots : [],
    manual: data.manual && typeof data.manual === 'object' ? data.manual : {},
  };
}

/** Charge les revenus prives via le serveur local. null hors localhost. */
export async function loadStatsPrivate(): Promise<StatsPrivate | null> {
  if (!isLocalhost()) return null;
  try {
    const res = await fetch('http://localhost:3001/api/stats/private');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const latestSnapshot = (s: StatsPublic): Snapshot | undefined =>
  s.snapshots[s.snapshots.length - 1];

export const previousSnapshot = (s: StatsPublic): Snapshot | undefined =>
  s.snapshots[s.snapshots.length - 2];

/** Delta d'une metrique entre les deux derniers snapshots. */
export function delta(
  s: StatsPublic,
  pick: (snap: Snapshot) => number | undefined,
): { value: number | undefined; diff: number | null } {
  const last = latestSnapshot(s);
  const prev = previousSnapshot(s);
  const value = last ? pick(last) : undefined;
  const before = prev ? pick(prev) : undefined;
  const diff = value !== undefined && before !== undefined ? value - before : null;
  return { value, diff };
}

/** Series temporelles followers pour le graphique ligne. */
export function followersSeries(s: StatsPublic) {
  return s.snapshots.map((snap) => ({
    date: snap.generatedAt.slice(0, 10),
    YouTube: snap.youtube.status === 'ok' ? snap.youtube.subscribers ?? null : null,
    Spotify: snap.spotify.status === 'ok' ? snap.spotify.followers ?? null : null,
    Instagram: snap.instagram.status === 'ok' ? snap.instagram.followers ?? null : null,
    Facebook: snap.facebook.status === 'ok' ? snap.facebook.followers ?? null : null,
    SoundCloud: snap.soundcloud.status === 'ok' ? snap.soundcloud.followers ?? null : null,
  }));
}

/** Agregation geo : YouTube Analytics + audience Instagram + Ditto (streams). */
export function geoBreakdown(s: StatsPublic): Array<{ country: string; value: number; source: string }> {
  const last = latestSnapshot(s);
  const out: Array<{ country: string; value: number; source: string }> = [];
  if (last?.youtubeGeo.status === 'ok' && last.youtubeGeo.countries) {
    for (const [country, value] of Object.entries(last.youtubeGeo.countries)) {
      out.push({ country, value, source: 'YouTube' });
    }
  }
  if (last?.instagram.status === 'ok' && last.instagram.audience?.countries) {
    for (const [country, value] of Object.entries(last.instagram.audience.countries)) {
      out.push({ country, value, source: 'Instagram' });
    }
  }
  if (s.manual.ditto?.streamsByCountry) {
    for (const [country, value] of Object.entries(s.manual.ditto.streamsByCountry)) {
      out.push({ country, value, source: 'Ditto' });
    }
  }
  return out;
}
