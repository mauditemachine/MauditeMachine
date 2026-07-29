/**
 * Moteur de donnees de l'explorateur Radar : API iTunes Search.
 * Gratuite, CORS ouvert, sans cle. Fournit pochettes (artworkUrl100) et
 * extraits audio 30 s (previewUrl).
 *
 * Rien n'est appele avant une interaction utilisateur, et chaque nom
 * cherche est mis en cache memoire (Map de promesses : les clics rapides
 * successifs sur le meme nom partagent la meme requete).
 */

export interface ExplorerItem {
  id: number;
  kind: 'song' | 'album';
  title: string;
  artist: string;
  album?: string;
  date: string;
  artwork: string;
  previewUrl?: string;
  /** Pour les albums : id iTunes permettant de resoudre un extrait a la demande. */
  collectionId?: number;
  storeUrl?: string;
}

export interface ExplorerResult {
  items: ExplorerItem[];
  /** true quand le filtre label n'a rien matche et qu'on montre les resultats bruts. */
  approximate: boolean;
}

const API = 'https://itunes.apple.com';

const cache = new Map<string, Promise<ExplorerResult>>();
const previewCache = new Map<string, Promise<string | null>>();

/** Normalisation fuzzy : casse et accents ignores, espaces compactes. */
const norm = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Correspondance souple entre deux noms (l'un contient l'autre). */
const fuzzyMatch = (a: string, b: string) => {
  const na = norm(a);
  const nb = norm(b);
  return !!na && !!nb && (na === nb || na.includes(nb) || nb.includes(na));
};

const artwork300 = (url: string | undefined) =>
  String(url || '').replace('100x100', '300x300');

async function itunesFetch(path: string, params: Record<string, string>): Promise<any[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}${path}?${qs}`);
  if (!res.ok) throw new Error(`iTunes HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

const byDateDesc = (a: ExplorerItem, b: ExplorerItem) => (b.date || '').localeCompare(a.date || '');

/** Dernieres sorties d'un artiste : morceaux avec extrait, tries par date. */
export function searchArtist(name: string): Promise<ExplorerResult> {
  const key = `a:${norm(name)}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const raw = await itunesFetch('/search', {
          term: name,
          entity: 'song',
          limit: '25',
        });
        const seen = new Set<string>();
        const items: ExplorerItem[] = [];
        for (const r of raw) {
          if (!fuzzyMatch(r.artistName, name)) continue;
          const dedupe = norm(`${r.trackName}|${r.collectionName}`);
          if (seen.has(dedupe)) continue;
          seen.add(dedupe);
          items.push({
            id: r.trackId || r.collectionId || items.length,
            kind: 'song',
            title: r.trackName || '',
            artist: r.artistName || '',
            album: r.collectionName || '',
            date: String(r.releaseDate || '').slice(0, 10),
            artwork: artwork300(r.artworkUrl100),
            previewUrl: r.previewUrl || undefined,
            storeUrl: r.trackViewUrl || r.collectionViewUrl || undefined,
          });
        }
        items.sort(byDateDesc);
        return { items, approximate: false };
      })().catch((err) => {
        cache.delete(key); // un echec reseau ne doit pas s'installer dans le cache
        throw err;
      }),
    );
  }
  return cache.get(key)!;
}

/**
 * Dernieres sorties d'un label : albums dont le copyright ou le titre
 * mentionne le label. Si rien ne matche, resultats bruts marques approximatifs.
 */
export function searchLabel(name: string): Promise<ExplorerResult> {
  const key = `l:${norm(name)}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const raw = await itunesFetch('/search', {
          term: name,
          entity: 'album',
          limit: '25',
        });
        const target = norm(name);
        // Le copyright ("P 2024 Permanent Vacation") identifie vraiment le
        // label. Le titre d'album n'est qu'un second choix : chercher
        // "Permanent Vacation" par titre ramene surtout des morceaux
        // homonymes sans rapport avec le label.
        const byCopyright = raw.filter((r) => norm(r.copyright || '').includes(target));
        const byName = raw.filter(
          (r) => !byCopyright.includes(r) && norm(r.collectionName || '').includes(target),
        );
        const matched = byCopyright.length > 0 ? byCopyright : byName;
        const approximate = byCopyright.length === 0 && raw.length > 0;
        const source = matched.length > 0 ? matched : raw;
        const items: ExplorerItem[] = source.map((r, i) => ({
          id: r.collectionId || i,
          kind: 'album' as const,
          title: r.collectionName || '',
          artist: r.artistName || '',
          date: String(r.releaseDate || '').slice(0, 10),
          artwork: artwork300(r.artworkUrl100),
          collectionId: r.collectionId || undefined,
          storeUrl: r.collectionViewUrl || undefined,
        }));
        items.sort(byDateDesc);
        return { items, approximate };
      })().catch((err) => {
        cache.delete(key);
        throw err;
      }),
    );
  }
  return cache.get(key)!;
}

/** Premier extrait jouable d'un album (lookup a la demande, mis en cache). */
export function resolveAlbumPreview(collectionId: number): Promise<string | null> {
  const key = `c:${collectionId}`;
  if (!previewCache.has(key)) {
    previewCache.set(
      key,
      (async () => {
        const raw = await itunesFetch('/lookup', {
          id: String(collectionId),
          entity: 'song',
          limit: '30',
        });
        const song = raw.find((r) => r.wrapperType === 'track' && r.previewUrl);
        return song ? String(song.previewUrl) : null;
      })().catch(() => {
        previewCache.delete(key);
        return null;
      }),
    );
  }
  return previewCache.get(key)!;
}

/**
 * Resout l'extrait d'une ligne du flux (artiste + titre de la release).
 * null si iTunes ne connait pas le morceau : l'appelant retombe sur le lien.
 */
export function resolveTrackPreview(artist: string, title: string): Promise<string | null> {
  const key = `t:${norm(artist)}|${norm(title)}`;
  if (!previewCache.has(key)) {
    previewCache.set(
      key,
      (async () => {
        const raw = await itunesFetch('/search', {
          term: `${artist} ${title}`,
          entity: 'song',
          limit: '10',
        });
        const match = raw.find(
          (r) =>
            r.previewUrl &&
            fuzzyMatch(r.artistName, artist) &&
            (fuzzyMatch(r.trackName, title) || fuzzyMatch(r.collectionName || '', title)),
        );
        const loose = match || raw.find((r) => r.previewUrl && fuzzyMatch(r.artistName, artist));
        return loose ? String(loose.previewUrl) : null;
      })().catch(() => {
        previewCache.delete(key);
        return null;
      }),
    );
  }
  return previewCache.get(key)!;
}

/** Liens de secours quand iTunes ne connait pas un nom. */
export const fallbackLinks = (name: string) => [
  { site: 'Beatport', url: `https://www.beatport.com/search/releases?q=${encodeURIComponent(name)}` },
  { site: 'SoundCloud', url: `https://soundcloud.com/search?q=${encodeURIComponent(name)}` },
  { site: 'Spotify', url: `https://open.spotify.com/search/${encodeURIComponent(name)}` },
];
